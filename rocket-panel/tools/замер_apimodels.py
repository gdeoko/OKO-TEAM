#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Замер моделей APIMODELS на одном тексте и одном референсе.

## Зачем

Владелец 01.10.2026: прогнать самый тяжёлый текст («Соло интим сбоку»)
по всем моделям APIMODELS, которые могут его пропустить, на одной
героине и одном референсе. Сначала только фото: кто вообще принял и кто
справился лучше. Потом по выбранному кадру - видео. По каждой строке
сразу время и деньги.

## Как

    # фото: текст берётся из принятого эталона кнопки
    python3 tools/замер_apimodels.py фото --реф мария.jpg --кнопка ph_side

    # или текст из файла / из PNG эталона (чанк prompt ComfyUI)
    python3 tools/замер_apimodels.py фото --реф мария.jpg --текст-файл t.txt
    python3 tools/замер_apimodels.py фото --реф мария.jpg --эталон 02.png

    # видео по выбранному кадру
    python3 tools/замер_apimodels.py видео --кадр замер/фото/z-image-spicy.png \
        --текст-файл движение.txt

Всё складывается в `замер/<фото|видео>/`: файл на модель, `итог.json` и
`итог.html` - плитки рядом, под каждой принял/отказал, секунды, кредиты.

## Грабли

- Задача проходит `pending → processing → completed`; `success` здесь не
  бывает, ждать надо `completed`.
- Видео без кадра отвечает 400 «image is required» - кадр уходит base64,
  публичная ссылка не нужна.
- Цены по API нет (`/v1/pricing` - 404). Кредиты берутся из ответа
  задачи, если сервис их туда кладёт; иначе в таблице стоит task_id, и
  цена смотрится в /console/usage.
- Модель, не принимающая референс, отвечает на него 400. Тогда строка
  повторяется без референса и помечается «без рефа» - иначе в таблице
  был бы отказ, которого на самом деле нет.
"""
import argparse
import base64
import concurrent.futures as cf
import html
import json
import mimetypes
import os
import sys
import time
import urllib.error
import urllib.request

БАЗА = os.environ.get("APIMODELS_BASE", "https://api.apimodels.app/v1")

# Фото: единственная «spicy»-ветка, четыре Grok под вопросом и одна
# заведомо фильтрующая - контроль, чтобы было видно, как выглядит отказ.
ФОТО = [
    "z-image-spicy",
    "z-image-spicy-pro",
    "grok-imagine-image",
    "grok-imagine-image-2",
    "grok-imagine-image-pro",
    "grok-4.2-image",
    "doubao-seedream-5-0-pro",
]
ВИДЕО = [
    "wan-2.7-i2v-spicy",
    "wan-2.2-i2v-spicy",
]
ГОТОВО = ("completed",)
ПРОВАЛ = ("failed", "error", "fail", "cancelled", "canceled", "rejected")


def ключ():
    к = os.environ.get("APIMODELS_KEY")
    if not к:
        sys.exit("нет APIMODELS_KEY в окружении")
    return к


def зов(путь, тело=None):
    з = urllib.request.Request(
        БАЗА + путь,
        data=json.dumps(тело).encode() if тело is not None else None,
        method="POST" if тело is not None else "GET",
        headers={"Authorization": f"Bearer {ключ()}",
                 "Content-Type": "application/json"})
    try:
        return json.load(urllib.request.urlopen(з, timeout=180))
    except urllib.error.HTTPError as e:
        return {"__ошибка": e.code,
                "__тело": e.read().decode("utf-8", "ignore")[:900]}
    except Exception as e:                              # noqa: BLE001
        return {"__ошибка": "сеть", "__тело": str(e)[:300]}


def data_uri(путь):
    тип = mimetypes.guess_type(путь)[0] or "image/png"
    return f"data:{тип};base64," + base64.b64encode(
        open(путь, "rb").read()).decode()


def найти(о, проверка, глубина=0):
    """Первое значение во вложенном ответе, прошедшее проверку."""
    if глубина > 6:
        return None
    if isinstance(о, dict):
        for к, з in о.items():
            р = проверка(к, з)
            if р is not None:
                return р
            р = найти(з, проверка, глубина + 1)
            if р is not None:
                return р
    elif isinstance(о, list):
        for з in о:
            р = найти(з, проверка, глубина + 1)
            if р is not None:
                return р
    return None


def task_id(о):
    return найти(о, lambda к, з: з if к in ("taskId", "task_id", "id")
                 and isinstance(з, str) else None)


def состояние(о):
    с = найти(о, lambda к, з: з.lower() if к in ("state", "status")
              and isinstance(з, str) else None)
    return с or ""


def ссылка(о):
    return найти(о, lambda к, з: з if isinstance(з, str)
                 and з.startswith("http") and к not in ("callback_url",)
                 else None)


def кредиты(о):
    return найти(о, lambda к, з: з if isinstance(з, (int, float))
                 and any(с in к.lower() for с in
                         ("cost", "credit", "price", "consum", "charge"))
                 else None)


def дождаться(вид, tid, предел, шаг=4):
    while time.time() < предел:
        о = зов(f"/{вид}/generations?task_id={tid}")
        с = состояние(о)
        if с in ГОТОВО or с in ПРОВАЛ:
            return о, с
        time.sleep(шаг)
    return {"__таймаут": True}, "таймаут"


def скачать(url, куда):
    try:
        urllib.request.urlretrieve(url, куда)
        return куда
    except Exception:                                   # noqa: BLE001
        return None


def одна(вид, модель, тело, папка, предел_сек):
    """Одна строка замера. Время - от запроса до готового файла."""
    стр = {"модель": модель, "реф": True}
    т0 = time.time()
    о = зов(f"/{вид}/generations", тело)

    # Не берёт референс - повтор без него, чтобы не записать ложный отказ.
    # Слово «image» само по себе не признак: оно есть в любом списке моделей
    # («Invalid model ... gpt-image-2»). Ищем именно поле референса.
    тб = о.get("__тело", "").lower() if "__ошибка" in о else ""
    if (вид == "images" and тб and "invalid model" not in тб
            and any(с in тб for с in ("image_url", "image_urls", "reference",
                                       "ref image", "input image"))):
        тело = {к: з for к, з in тело.items()
                if к not in ("image_url", "image_urls", "image")}
        стр["реф"] = False
        т0 = time.time()
        о = зов(f"/{вид}/generations", тело)

    if "__ошибка" in о:
        стр.update(итог="отказ", сек=round(time.time() - т0, 1),
                   почему=f"{о['__ошибка']}: {о['__тело']}")
        return стр
    tid = task_id(о)
    стр["task_id"] = tid
    if not tid:
        стр.update(итог="непонятный ответ", почему=json.dumps(о)[:400])
        return стр

    ответ, с = дождаться(вид, tid, т0 + предел_сек)
    стр["сек"] = round(time.time() - т0, 1)
    стр["кредиты"] = кредиты(ответ) or кредиты(о)
    if с not in ГОТОВО:
        стр.update(итог="отказ" if с in ПРОВАЛ else с,
                   почему=json.dumps(ответ, ensure_ascii=False)[:500])
        return стр
    url = ссылка(ответ)
    расш = ".mp4" if вид == "video" else ".png"
    файл = скачать(url, os.path.join(папка, модель + расш)) if url else None
    стр.update(итог="принял", url=url,
               файл=os.path.basename(файл) if файл else None)
    return стр


def страница(вид, строки, папка, текст):
    плитки = []
    for с in строки:
        if с.get("файл"):
            медиа = (f'<video src="{с["файл"]}" controls loop muted playsinline></video>'
                     if вид == "video" else
                     f'<a href="{с["файл"]}"><img src="{с["файл"]}" loading="lazy"></a>')
        else:
            медиа = f'<div class="пусто">{html.escape(с.get("итог", ""))}</div>'
        цена = с.get("кредиты")
        цена = f"{цена} кр." if цена is not None else "цена: /console/usage"
        плитки.append(f"""
<figure class="{'ок' if с.get('итог') == 'принял' else 'нет'}">
  {медиа}
  <figcaption>
    <b>{html.escape(с['модель'])}</b>
    <span>{html.escape(с.get('итог', ''))}{'' if с.get('реф', True) else ' · без рефа'}</span>
    <span>{с.get('сек', '—')} с · {html.escape(str(цена))}</span>
    <small>{html.escape(с.get('task_id') or '')}</small>
    {f'<small class="почему">{html.escape(с["почему"][:300])}</small>' if с.get('почему') else ''}
  </figcaption>
</figure>""")
    open(os.path.join(папка, "итог.html"), "w", encoding="utf-8").write(f"""<!doctype html>
<html lang="ru"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Замер APIMODELS</title>
<style>
:root{{--фон:#0b0b0b;--плитка:#161616;--текст:#eee;--тускло:#888;--лайм:#9AFF00;--красн:#ff5a5a}}
body{{margin:0;padding:16px;background:var(--фон);color:var(--текст);font:14px/1.4 Montserrat,system-ui,sans-serif}}
h1{{font:28px 'Bebas Neue',Impact,sans-serif;letter-spacing:.04em;margin:0 0 4px}}
p{{color:var(--тускло);margin:0 0 16px}}
main{{display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:12px}}
figure{{margin:0;background:var(--плитка);border-radius:10px;overflow:hidden;border:1px solid #222}}
figure.ок{{border-color:var(--лайм)}} figure.нет{{opacity:.75}}
img,video{{width:100%;display:block;aspect-ratio:9/16;object-fit:cover;background:#000}}
.пусто{{aspect-ratio:9/16;display:grid;place-items:center;color:var(--красн)}}
figcaption{{padding:10px;display:grid;gap:2px}}
small{{color:var(--тускло);word-break:break-all}} .почему{{color:var(--красн)}}
</style></head><body>
<h1>Замер APIMODELS · {'видео' if вид == 'video' else 'фото'}</h1>
<p>{time.strftime('%d.%m.%Y %H:%M')} · принял {sum(с.get('итог') == 'принял' for с in строки)} из {len(строки)} · текст {len(текст)} знаков</p>
<main>{''.join(плитки)}</main>
</body></html>""")


def текст_из(арг):
    if арг.текст_файл:
        return open(арг.текст_файл, encoding="utf-8").read().strip()
    sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
    import промпты_эталонов as пэ
    if арг.эталон:
        т = пэ.позитив(пэ.граф(арг.эталон))
    else:
        т = (пэ.загрузить().get(арг.кнопка) or {}).get("промпт")
    if not т:
        sys.exit("текст не найден: проверь --кнопка / --эталон / --текст-файл")
    return т


def главное():
    п = argparse.ArgumentParser(description=__doc__.split("\n\n")[0])
    п.add_argument("вид", choices=("фото", "видео"))
    п.add_argument("--реф", help="референс героини (для фото)")
    п.add_argument("--кадр", help="первый кадр (для видео)")
    п.add_argument("--кнопка", default="ph_side")
    п.add_argument("--эталон")
    п.add_argument("--текст-файл", dest="текст_файл")
    п.add_argument("--модели", help="через запятую, иначе весь список")
    п.add_argument("--стороны", default="9:16")
    п.add_argument("--размер", default="2K")
    п.add_argument("--сек", type=int, default=5, help="длина ролика")
    п.add_argument("--предел", type=int, default=900, help="ожидание, с")
    п.add_argument("--папка", default="замер")
    а = п.parse_args()

    текст = текст_из(а)
    вид = "images" if а.вид == "фото" else "video"
    модели = а.модели.split(",") if а.модели else (ФОТО if вид == "images" else ВИДЕО)
    папка = os.path.join(а.папка, а.вид)
    os.makedirs(папка, exist_ok=True)

    if вид == "images":
        if not а.реф:
            sys.exit("для фото нужен --реф")
        реф = data_uri(а.реф)
        общее = {"prompt": текст, "aspect_ratio": а.стороны,
                 "resolution": а.размер, "image_urls": [реф]}
    else:
        if not а.кадр:
            sys.exit("для видео нужен --кадр")
        общее = {"prompt": текст, "image": data_uri(а.кадр),
                 "duration": а.сек, "aspect_ratio": а.стороны}

    print(f"{а.вид}: {len(модели)} моделей, текст {len(текст)} знаков")
    строки = []
    with cf.ThreadPoolExecutor(len(модели)) as пул:
        задачи = {пул.submit(одна, вид, м, {"model": м, **общее},
                             папка, а.предел): м for м in модели}
        for з in cf.as_completed(задачи):
            с = з.result()
            строки.append(с)
            print(f"  {с['модель']:<26} {с.get('итог',''):<10} "
                  f"{с.get('сек','—'):>6} с  {с.get('кредиты') or '—'} кр.")

    строки.sort(key=lambda с: модели.index(с["модель"]))
    json.dump({"вид": а.вид, "текст": текст, "строки": строки},
              open(os.path.join(папка, "итог.json"), "w", encoding="utf-8"),
              ensure_ascii=False, indent=1)
    страница(вид, строки, папка, текст)
    print("итог:", os.path.join(папка, "итог.html"))


if __name__ == "__main__":
    главное()
