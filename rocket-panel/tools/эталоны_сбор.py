# -*- coding: utf-8 -*-
"""Сбор эталонов по органам с открытых витрин. Кадры платными не станут.

## Зачем это есть

Пороги приёмщика по паху и груди стояли от НАШЕГО же результата: кадр
объявлялся годным потому, что похож на вчерашний такой же. Эталон взять
было негде - генератор органы не рисует, а качать со страниц без
проверки возраста нельзя.

Открытая витрина закрывает дыру целиком. Обложка сета лежит без входа и
показывается всем, это собственная реклама площадки; возраст и релизы
держит она сама (18 U.S.C. 2257). На обложке как раз крупный план, то
есть ровно то, чего нам не хватало.

Кадры живут ТОЛЬКО как цель для замера: в продукт не идут, клиенту не
показываются, в репозиторий не кладутся.

## Два источника, и второй лучше

    Hegre         каталог отдаёт только последнюю сотню сетов, а глубина
                  открывается через страницы моделей. Группа сцены
                  угадывается по названию, и это слабое место: название
                  несёт место и настроение («ibiza», «sunset»), а не позу
    сеть MetArt   витрина отдаёт МЕТАДАННЫЕ: список моделей, тип записи,
                  число кадров. Пара определяется точно, а не угадыванием.
                  Обложка есть в версии `clean`, без надписей поверх кадра

Площадки сети сняты под разные группы: VivThomas снимает женские пары,
SexArt смешанные, MetArt соло. Мужских пар в сети нет вовсе, и по шести
кнопкам «мм» эталона не будет - так и говорим, вместо того чтобы
подставить туда чужую группу.

## Как звать

    python3 -m tools.эталоны_сбор hegre     [сколько]
    python3 -m tools.эталоны_сбор сеть      [сколько]

Выход в сеть обязателен: обе площадки с московского адреса не
отвечают. Идём через ОБХОД США (`OKO_SOCKS`, по умолчанию 10811),
он же открывает Runway и Envato.
"""
import json
import os
import re
import sys
import time
import urllib.request

ВЫХОД = os.environ.get("OKO_SOCKS", "socks5h://127.0.0.1:10811")
UA = ("Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) "
      "Chrome/141.0.0.0 Safari/537.36")
КУДА = os.environ.get("ETALONY_DIR", "/home/okoposter/эталоны_органов")
CDN = "https://gccdn.metartnetwork.com/"

_открывало = urllib.request.build_opener(
    urllib.request.ProxyHandler({"http": ВЫХОД, "https": ВЫХОД}))


def взять(адрес, реф, байты=False, попыток=3):
    """Страница или файл через выход. Пустая строка вместо исключения.

    Ошибка сети здесь это норма жизни, а не событие: витрина иногда
    отвечает 429, и падать на этом значит терять всю пачку.
    """
    з = urllib.request.Request(адрес, headers={
        "User-Agent": UA, "Referer": реф, "Accept": "*/*"})
    for _ in range(попыток):
        try:
            д = _открывало.open(з, timeout=40).read()
            return д if байты else д.decode("utf-8", "ignore")
        except Exception:                                   # noqa: BLE001
            time.sleep(2)
    return b"" if байты else ""


# ---------------------------------------------------------------- Hegre

ДОМ = "https://hegre.com"


def hegre(сколько=1500, папка=None):
    """Обложки сетов Hegre. Глубина берётся через страницы моделей.

    Каталог `/photos` отдаёт всегда одну и ту же сотню и на `?page=`
    не реагирует вовсе - первая попытка листать его дала сто сетов и
    остановилась. Список моделей при этом открыт целиком, а у каждой
    модели своя страница со ВСЕМИ её сетами.
    """
    папка = папка or КУДА
    os.makedirs(папка, exist_ok=True)
    модели = sorted(set(re.findall(r'href="(/models/[a-z0-9-]+)"',
                                   взять(ДОМ + "/models", ДОМ))))
    print(f"моделей: {len(модели)}", flush=True)
    было = set(f"/photos/{и[:-4]}" for и in os.listdir(папка)
               if и.endswith(".jpg"))
    сеты = set(было)
    новые = []
    for i, м in enumerate(модели):
        найд = set(re.findall(r'href="(/photos/[a-z0-9-]+)"',
                              взять(ДОМ + м, ДОМ)))
        для_нас = [с for с in найд if с not in сеты]
        сеты.update(для_нас)
        новые.extend(для_нас)
        if (i + 1) % 40 == 0:
            print(f"  модель {i+1}/{len(модели)}, новых {len(новые)}",
                  flush=True)
        if len(новые) + len(было) >= сколько:
            break
        time.sleep(0.4)

    взято = 0
    for с in новые:
        файл = os.path.join(папка, с.rsplit("/", 1)[-1] + ".jpg")
        if os.path.exists(файл):
            continue
        м = re.search(r'https://pp\.hegre\.com/[^"\' ]*?1600x\.jpg',
                      взять(ДОМ + с, ДОМ))
        if not м:
            continue
        д = взять(м.group(0), ДОМ, байты=True)
        if len(д) > 20000:
            open(файл, "wb").write(д)
            взято += 1
            if взято % 50 == 0:
                print(f"  скачано {взято}", flush=True)
        time.sleep(0.4)
    print(f"Hegre: +{взято}, всего {len(os.listdir(папка))}")
    return взято


# ----------------------------------------------------------- сеть MetArt

ПЛОЩАДКИ = {
    "пара_жж": ("https://www.vivthomas.com", 2),
    "пара_мж": ("https://www.sexart.com", 2),
    "соло_ню": ("https://www.met-art.com", 1),
}


def сеть(сколько=250, куда=None):
    """Обложки сети MetArt по группам сцен, с точным числом людей."""
    куда = куда or (КУДА + "_сеть")
    итог = {}
    for группа, (сайт, моделей) in ПЛОЩАДКИ.items():
        папка = os.path.join(куда, группа)
        os.makedirs(папка, exist_ok=True)
        взято, стр = 0, 1
        while взято < сколько and стр <= 80:
            т = взять(f"{сайт}/api/updates?tab=stream&page={стр}"
                      f"&direction=DESC", сайт)
            try:
                гал = json.loads(т).get("galleries") or []
            except Exception:                               # noqa: BLE001
                print(f"{группа}: страница {стр} не разобралась", flush=True)
                break
            if not гал:
                break
            for о in гал:
                # Ровно столько людей, сколько просит группа. Тройка в
                # эталоне пары испортит и число, и вывод: приёмщик
                # считает людей отдельной мерой.
                if len(о.get("models") or []) != моделей:
                    continue
                if о.get("type") != "GALLERY":
                    continue
                путь = о.get("coverCleanImagePath") or о.get("coverImagePath")
                if not путь:
                    continue
                имя = "".join(с if с.isalnum() or с in "-_" else "-"
                              for с in о["name"].lower())[:60]
                файл = os.path.join(папка, f"{имя}-{о['UUID'][:8]}.jpg")
                if os.path.exists(файл):
                    continue
                д = взять(CDN + о["siteUUID"] + путь, сайт, байты=True)
                if len(д) > 20000:
                    open(файл, "wb").write(д)
                    взято += 1
                    if взято % 25 == 0:
                        print(f"  {группа}: {взято}", flush=True)
                time.sleep(0.3)
                if взято >= сколько:
                    break
            стр += 1
        итог[группа] = взято
        print(f"{группа}: собрано {взято}", flush=True)
    return итог


if __name__ == "__main__":
    что = sys.argv[1] if len(sys.argv) > 1 else "сеть"
    сколько = int(sys.argv[2]) if len(sys.argv) > 2 else None
    if что == "hegre":
        hegre(сколько or 1500)
    else:
        сеть(сколько or 250)
