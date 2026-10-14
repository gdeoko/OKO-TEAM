# -*- coding: utf-8 -*-
"""Вырезы предметов для урока: APIMODELS, gpt-image-2.5-flare, ячейка «1K low».

Ячейка отдаёт PNG с родной альфой за $0.008: на экране предмет живёт не крупнее
540 пикселей, поэтому килопикселя хватает, а вырезать фон руками не нужно.

    APIMODELS_KEY=... python3 gen_png.py predmety.json [потолок]

Задание: [{"файл": "u3_svet_panel.png", "промпт": "...", "размер": "1:1"}]
Ключ берётся из окружения и в git не попадает. Траты пишутся в журнал рядом
с картинками, чтобы потолок считался по факту, а не по памяти.
"""
import json
import os
import subprocess
import sys
import time
import urllib.request

БАЗА = "https://api.apimodels.app/v1"
МОДЕЛЬ = "gpt-image-2.5-flare"
КОРЕНЬ = os.path.dirname(os.path.abspath(__file__))
ПАПКА = os.path.join(КОРЕНЬ, "remotion", "public", "kadr")
МЕЛКИЕ = os.path.join(ПАПКА, "m")
ЖУРНАЛ = os.path.join(КОРЕНЬ, "rashod_png.jsonl")
ЯЧЕЙКА = {"resolution": "1K", "quality": "low",
          "background": "transparent", "output_format": "png"}
ЦЕНА = 0.008


def ключ() -> str:
    к = os.environ.get("APIMODELS_KEY", "")
    if not к:
        raise SystemExit("нет APIMODELS_KEY в окружении")
    return к


def запрос(путь: str, тело=None, метод="GET"):
    данные = json.dumps(тело).encode() if тело is not None else None
    req = urllib.request.Request(БАЗА + путь, data=данные, method=метод,
                                 headers={"Authorization": "Bearer " + ключ(),
                                          "Content-Type": "application/json"})
    with urllib.request.urlopen(req, timeout=120) as r:
        return json.loads(r.read().decode())


def найти_url(o, найдено=None):
    import re
    найдено = найдено if найдено is not None else []
    if isinstance(o, str):
        м = re.search(r"https?://[^\s\"']+\.(png|jpg|jpeg|webp)", o, re.I)
        if м:
            найдено.append(м.group(0))
    elif isinstance(o, dict):
        for з in o.values():
            найти_url(з, найдено)
    elif isinstance(o, list):
        for з in o:
            найти_url(з, найдено)
    return найдено


def потрачено() -> float:
    если_нет = 0.0
    if not os.path.exists(ЖУРНАЛ):
        return если_нет
    сумма = 0.0
    for строка in open(ЖУРНАЛ, encoding="utf-8"):
        try:
            сумма += float(json.loads(строка).get("цена") or 0)
        except Exception:
            continue
    return сумма


def записать(файл: str, tid: str) -> None:
    with open(ЖУРНАЛ, "a", encoding="utf-8") as ф:
        ф.write(json.dumps({"файл": файл, "модель": МОДЕЛЬ, "цена": ЦЕНА,
                            "task": tid, "когда": time.strftime("%Y-%m-%d %H:%M")},
                           ensure_ascii=False) + "\n")


def мелкая(путь: str) -> None:
    """Рядом сразу кладём копию 800×800: в рендере работает только она."""
    try:
        from PIL import Image
        os.makedirs(МЕЛКИЕ, exist_ok=True)
        им = Image.open(путь).convert("RGBA")
        им.thumbnail((800, 800), Image.LANCZOS)
        им.save(os.path.join(МЕЛКИЕ, os.path.basename(путь)), optimize=True)
    except Exception as e:
        print("  мелкая копия не вышла:", e)


def одна(з: dict, потолок: float) -> dict:
    было = потрачено()
    if было + ЦЕНА > потолок:
        return {"ок": False, "почему": "потолок $%.2f исчерпан: истрачено $%.3f" % (потолок, было)}
    тело = {"model": МОДЕЛЬ, "prompt": з["промпт"],
            "aspect_ratio": з.get("размер") or "1:1"}
    тело.update(ЯЧЕЙКА)
    try:
        ответ = запрос("/images/generations", тело, "POST")
    except Exception as e:
        return {"ок": False, "почему": "%s" % e}
    d = ответ.get("data") or {}
    # taskId лежит в data, а не в корне: читаешь из корня — задача уже
    # оплачена, а ссылку на неё вернуть нечем.
    tid = d.get("taskId") or d.get("task_id") or ответ.get("taskId")
    if not tid:
        return {"ок": False, "почему": str(ответ)[:300]}
    записать(з["файл"], str(tid))
    url = ""
    for _ in range(90):
        time.sleep(4)
        try:
            с = запрос("/images/generations?task_id=" + str(tid))
        except Exception:
            continue
        ссылки = найти_url(с)
        if ссылки:
            url = ссылки[0]
            break
        if '"failed"' in json.dumps(с).lower():
            return {"ок": False, "почему": json.dumps(с, ensure_ascii=False)[:300]}
    if not url:
        return {"ок": False, "почему": "не дождались картинки"}
    путь = os.path.join(ПАПКА, з["файл"])
    # r2.apimodels.app отдаёт urllib 403, curl забирает файл без вопросов.
    р = subprocess.run(["curl", "-sS", "-m", "180", "-o", путь, url],
                       capture_output=True, text=True)
    if р.returncode or not os.path.exists(путь) or os.path.getsize(путь) < 5000:
        return {"ок": False, "почему": "не скачалось: %s" % (р.stderr or "")[:200], "url": url}
    мелкая(путь)
    return {"ок": True, "файл": путь, "байт": os.path.getsize(путь), "цена": ЦЕНА}


def главное() -> int:
    задания = json.load(open(sys.argv[1], encoding="utf-8"))
    потолок = float(sys.argv[2]) if len(sys.argv) > 2 else 0.60
    for з in задания:
        путь = os.path.join(ПАПКА, з["файл"])
        if os.path.exists(путь) and os.path.getsize(путь) > 10000:
            print(з["файл"], "уже есть", flush=True)
            continue
        try:
            р = одна(з, потолок)
        except Exception as e:
            р = {"ок": False, "почему": "сбой: %r" % e}
        print(з["файл"], json.dumps(р, ensure_ascii=False)[:220], flush=True)
    print("истрачено на вырезы: $%.3f" % потрачено())
    return 0


if __name__ == "__main__":
    raise SystemExit(главное())
