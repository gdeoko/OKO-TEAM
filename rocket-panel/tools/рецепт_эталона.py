# -*- coding: utf-8 -*-
"""Генерация ТОЧНО по рецепту принятого эталона.

Граф взят из метаданных самого эталона: та же модель, тот же размер,
те же шаги и CFG, тот же сэмплер. Ничего сверх: ни опоры, ни лор, ни
второго прохода, ни зон, ни постобработки.

Промпт и негатив тоже берутся ИЗ ЭТАЛОНА - иначе сравнение было бы не
о рецепте, а о тексте.
"""
import json, os, sys, time, urllib.request, uuid
from PIL import Image

COMFY = "http://127.0.0.1:8188"
ВХОД = "/root/ComfyUI/input"
ВЫХОД = "/root/ComfyUI/output"


def запрос(путь, данные=None):
    тело = json.dumps(данные).encode() if данные is not None else None
    з = urllib.request.Request(COMFY + путь, data=тело,
                               headers={"Content-Type": "application/json"})
    with urllib.request.urlopen(з, timeout=120) as о:
        return json.load(о)


def граф_эталона(путь):
    и = Image.open(путь)
    инфо = getattr(и, "text", None) or getattr(и, "info", {})
    return json.loads(инфо["prompt"]), и.size


def прогнать(эталон, снимки, зерно=None, куда=None):
    г, размер = граф_эталона(эталон)
    # Подменяем ТОЛЬКО снимки людей и имя файла. Всё остальное - как
    # было в принятом кадре.
    номера = [к for к, з in г.items() if з.get("class_type") == "LoadImage"]
    for н, к in enumerate(sorted(номера, key=int)):
        if н < len(снимки):
            г[к]["inputs"]["image"] = снимки[н]
            г[к].pop("is_changed", None)
    for к, з in г.items():
        if з.get("class_type") == "SaveImage":
            з["inputs"]["filename_prefix"] = "recept"
        if з.get("class_type") == "KSampler" and зерно is not None:
            з["inputs"]["seed"] = int(зерно)
    о = запрос("/prompt", {"prompt": г})
    pid = о.get("prompt_id")
    т0 = time.time()
    while time.time() - т0 < 900:
        time.sleep(3)
        ист = запрос("/history/" + pid)
        з = ист.get(pid)
        if not з:
            continue
        for узел in (з.get("outputs") or {}).values():
            for и in (узел.get("images") or []):
                готов = os.path.join(ВЫХОД, и["filename"])
                if куда:
                    os.replace(готов, куда)
                    готов = куда
                return готов, round(time.time() - т0, 1), размер
        ст = (з.get("status") or {})
        if ст.get("status_str") == "error":
            return None, str(ст)[:300], размер
    return None, "не дождались", размер


if __name__ == "__main__":
    эталон = sys.argv[1]
    снимки = sys.argv[2:-1]
    куда = sys.argv[-1]
    п, сек, размер = прогнать(эталон, снимки, куда=куда)
    print("рецепт эталона:", размер, "->", п, сек, "с")
