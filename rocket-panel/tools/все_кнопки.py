# -*- coding: utf-8 -*-
"""Прогнать ВСЕ кнопки каталога тем же путём, что идёт клиент.

## Зачем

До сих пор всё мерилось на одной кнопке, `ph_close`, и выводы могли
быть верны только для неё. Кнопок шестьдесят четыре, и у каждой свой
план, своя поза и свой состав людей: то, что лечит крупный план соло,
может ничего не дать паре в полный рост.

## Что считается

По каждой кнопке: время, числа зоны органов против цели своей группы,
доля кожи, крапины. Кадр сохраняется рядом, чтобы посмотреть глазами -
числа за день соврали трижды, и без глаза им верить нельзя.

## Как звать

    python3 -m tools.все_кнопки                 все 64
    python3 -m tools.все_кнопки Интим           один узел
    python3 -m tools.все_кнопки Интим ph_close  одну кнопку

Выход - папка с кадрами и сводка `итог.json` рядом с ними.
"""
import json
import os
import subprocess
import sys
import time

КУДА = os.environ.get("VSE_DIR", "/srv/amberry/опыт/все_кнопки")
ВХОД = os.environ.get("VHOD", "/srv/amberry/пробы/ника-канон-студия.jpg")
ВХОД2 = os.environ.get("VHOD2", "/srv/amberry/пробы/ника-одета-полроста.jpg")
ГПУ = "/opt/amberry/rocket-panel/gpu"
ПИТОН = "/opt/amberry/.venv/bin/python"


def узлы_и_кнопки():
    """Все узлы каталога с их кнопками. Парные помечаются."""
    sys.path.insert(0, "/opt/amberry/rocket-panel/bot")
    import catalog
    итог = []

    def обойти(узлы, путь=""):
        for у in узлы:
            имя = getattr(у, "title", "") or ""
            сцены = [s.key for s in (getattr(у, "scenes", None) or [])]
            if сцены:
                парный = any(len(catalog.полы(к) or ()) > 1 for к in сцены)
                итог.append((имя, сцены, парный))
            обойти(getattr(у, "дети", None) or [], путь + "/" + имя)

    обойти(catalog.РАЗДЕЛЫ)
    return итог


def прогнать(узел, кнопка, парный):
    """Один кадр тем же путём, что у клиента. Секунды или None."""
    рабочая = os.path.join(КУДА, "w")
    os.makedirs(рабочая, exist_ok=True)
    for и in os.listdir(рабочая):
        os.remove(os.path.join(рабочая, и))
    среда = dict(os.environ)
    среда.update({
        "VHOD": ВХОД, "KUDA": рабочая,
        "ZONES": "лицо,грудь,пах,руки", "ROCKET_ZONE_SIZE": "1024",
        "ROCKET_ZONE_TIMEOUT": "900",
    })
    # Второй человек парной сцене обязателен: без него кадр меряется по
    # сцене, где половина людей выдумана, и любые числа по ней врут.
    if парный:
        среда["VHOD2"] = ВХОД2
    т0 = time.time()
    subprocess.run([ПИТОН, "прогон_кнопок.py", узел, кнопка],
                   cwd=ГПУ, env=среда, capture_output=True, timeout=1800)
    сек = round(time.time() - т0, 1)
    готово = os.path.join(рабочая, f"{кнопка}.png")
    if not os.path.exists(готово):
        return None, сек
    куда = os.path.join(КУДА, f"{кнопка}.png")
    os.replace(готово, куда)
    return куда, сек


def измерить(путь, кнопка):
    """Числа кадра против цели своей группы."""
    sys.path.insert(0, "/opt/amberry/rocket-panel/bot")
    sys.path.insert(0, "/root")
    import cv2
    import резкость as Р
    import эталоны_органов as Э
    import доводка
    кадр = cv2.imread(путь)
    if кадр is None:
        return {}
    о = {"цель": Э.цель(кнопка) or {}}
    з = Р.зона(кадр)
    if з is not None:
        о.update(Р.меры(з))
    о.update(доводка.меры(кадр))
    return о


def главное(узел=None, кнопка=None):
    os.makedirs(КУДА, exist_ok=True)
    свод = {}
    for имя, кнопки, парный in узлы_и_кнопки():
        if узел and имя.lower() != узел.lower():
            continue
        for к in кнопки:
            if кнопка and к != кнопка:
                continue
            путь, сек = прогнать(имя, к, парный)
            запись = {"узел": имя, "секунд": сек, "парный": парный}
            запись.update(измерить(путь, к) if путь else {"МИМО": True})
            свод[к] = запись
            ц = запись.get("цель") or {}
            print(f"{к:14s} {сек:6.1f}с  лаплас {запись.get('лаплас', 0):7.1f}"
                  f" (цель {ц.get('лаплас', 0):5.0f})  шум {запись.get('шум', 0):5.2f}"
                  f"  кожи {запись.get('кожи', 0):5.1f}"
                  f"  крапин {запись.get('крапин', 0):6.0f}"
                  f"{'  МИМО' if not путь else ''}", flush=True)
            json.dump(свод, open(os.path.join(КУДА, "итог.json"), "w"),
                      ensure_ascii=False, indent=1)
    print("готово:", len(свод), "кнопок ->", КУДА)
    return свод


if __name__ == "__main__":
    главное(sys.argv[1] if len(sys.argv) > 1 else None,
            sys.argv[2] if len(sys.argv) > 2 else None)
