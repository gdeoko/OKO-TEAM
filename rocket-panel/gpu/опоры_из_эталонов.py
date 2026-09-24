#!/usr/bin/env python3
"""Опоры ControlNet из утверждённых эталонных кадров.

## Зачем

Кнопка с опорой обязана повторять принятую владельцем позу «в 10 из 10
случаев» — так было поставлено требование. Держится это не текстом, а
картой глубины принятого кадра: она уходит в ControlNet и держит
композицию, пока модель рисует.

Двадцать одна такая карта лежала на первой карте Hyperstack и уехала
вместе с ней. Панель об этом честно сообщает («опор 0 из 21»), но
ГЕНЕРАЦИЯ НЕ ПАДАЕТ: `wf_photo` молча собирает граф без ControlNet, и
человек платит за позу, которую не получает.

## Почему не все двадцать одна

Соответствие «кадр → кнопка» восстанавливается из кода, и восстановимо
оно не везде:

  * у раздевания и интима в `catalog.py` над каждым сценарием подписан
    его кадр по-русски («Крупный план» — кадр pR16_un_close__4242), и
    эти подписи совпадают с именами файлов буква в букву;
  * у жж и мж ключи описывают РАКУРС (`near`, `face`, `behind`, `pov`),
    а файлы — ДЕЙСТВИЕ (`кунилингус`, `наездница`, `минет`). Никакого
    общего признака между ними нет.

Гадать нельзя: промах даёт человеку не ту позу за его деньги, и узнает
он об этом раньше нас. Поэтому здесь только достоверные пары, а
остальные ждут владельца — он единственный, кто помнит, какой кадр под
какой кнопкой принимал.
"""
import json
import os
import sys
import time
import urllib.request
import uuid

COMFY = "http://127.0.0.1:8188"
КАДРЫ = "/root/эталоны"
КУДА = "/root/ГЛУБИНА"
ВХОД = "/root/ComfyUI/input"
ВЫХОД = "/root/ComfyUI/output"

# Пары взяты из подписей в `catalog.py`, а не подобраны по смыслу.
ПАРЫ = {
    "un_back":   "раздевание/01_вид_сзади.png",
    "un_lie":    "раздевание/02_лёжа_на_спине.png",
    "un_close":  "раздевание/03_крупный_план.png",
    "un_full":   "раздевание/04_в_полный_рост.png",
    "un_sit":    "раздевание/05_раздвинуть_ножки.png",
    "un_three":  "раздевание/06_поставить_раком.png",
    "ph_close":  "интим/01_мастурбация_крупно.png",
    "ph_side":   "интим/02_мастурбация_сбоку.png",
    "ph_above":  "интим/03_мастурбация_раком.png",
    "ph_below":  "интим/05_снимает_лифчик.png",
    "ph_push":   "интим/06_снимает_трусики.png",
}

# Кнопки, для которых кадр есть, но какой именно — знает только
# владелец. Печатаются в конце, чтобы он ответил одним списком.
БЕЗ_ПАРЫ = ["ph_back", "pf_ff_near", "pf_ff_face", "pf_ff_close",
            "pf_ff_behind", "pf_ff_pov", "pf_mf_near", "pf_mf_face",
            "pf_mf_behind", "pf_mf_pov"]


def запрос(путь, данные=None):
    тело = json.dumps(данные).encode() if данные is not None else None
    зпр = urllib.request.Request(COMFY + путь, data=тело,
                                 headers={"Content-Type": "application/json"})
    with urllib.request.urlopen(зпр, timeout=60) as о:
        return json.load(о)


def граф(имя_входа):
    """DepthAnything выбран потому, что скелет DWPose на сложенных телах
    находит одну голову вместо двух человек — это уже проверяли."""
    return {
        "1": {"class_type": "LoadImage", "inputs": {"image": имя_входа}},
        "2": {"class_type": "DepthAnythingV2Preprocessor",
              "inputs": {"image": ["1", 0], "ckpt_name": "depth_anything_v2_vitl.pth",
                         "resolution": 1024}},
        "3": {"class_type": "SaveImage",
              "inputs": {"images": ["2", 0], "filename_prefix": "glub"}},
    }


def снять_глубину(ключ, файл):
    исходник = os.path.join(КАДРЫ, файл)
    if not os.path.exists(исходник):
        return None, "нет кадра %s" % файл
    os.makedirs(ВХОД, exist_ok=True)
    имя = "op_%s_%s.png" % (ключ, uuid.uuid4().hex[:6])
    with open(исходник, "rb") as и, open(os.path.join(ВХОД, имя), "wb") as о:
        о.write(и.read())
    try:
        о = запрос("/prompt", {"prompt": граф(имя)})
    except Exception as e:
        return None, "ComfyUI отказал: %s" % str(e)[:120]
    pid = о.get("prompt_id")
    начало = time.time()
    while time.time() - начало < 300:
        time.sleep(3)
        try:
            ист = запрос("/history/" + pid)
        except Exception:
            continue
        з = ист.get(pid)
        if not з:
            continue
        for узел in (з.get("outputs") or {}).values():
            for и in (узел.get("images") or []):
                return os.path.join(ВЫХОД, и["filename"]), None
        ст = (з.get("status") or {})
        if ст.get("status_str") == "error":
            return None, str(ст)[:200]
    return None, "не дождалась за 5 минут"


os.makedirs(КУДА, exist_ok=True)
сделано, беды = [], []
print("=" * 64)
for ключ, файл in ПАРЫ.items():
    путь, беда = снять_глубину(ключ, файл)
    if беда:
        беды.append((ключ, беда))
        print("  %-12s НЕ ВЫШЛО: %s" % (ключ, беда), flush=True)
        continue
    цель = os.path.join(КУДА, ключ + ".png")
    with open(путь, "rb") as и, open(цель, "wb") as о:
        о.write(и.read())
    сделано.append(ключ)
    print("  %-12s <- %-38s %d КБ"
          % (ключ, файл, os.path.getsize(цель) // 1024), flush=True)

print("=" * 64)
print("опор снято: %d из %d достоверных пар" % (len(сделано), len(ПАРЫ)))
if беды:
    print("не вышло:", ", ".join(к for к, _ in беды))
print()
print("ЖДУТ ВЛАДЕЛЬЦА (кадр есть, но какой — знает только он):")
for к in БЕЗ_ПАРЫ:
    print("   ", к)
print()
print("СВОБОДНЫЕ КАДРЫ, не привязанные ни к одной кнопке:")
занято = set(ПАРЫ.values())
for корень, _, файлы in os.walk(КАДРЫ):
    for ф in sorted(файлы):
        отн = os.path.relpath(os.path.join(корень, ф), КАДРЫ)
        if отн not in занято:
            print("   ", отн)
sys.exit(0)
