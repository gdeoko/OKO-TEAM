# -*- coding: utf-8 -*-
"""Выгрузка текстов месяца в файлы под штатные проверки завода."""
import os
import sys

sys.path.insert(0, "/opt/oko-poster/perepiska")
from audit30 import всё
from emo import без_разметки

ПАПКА = "/tmp/teksty_m1"

if __name__ == "__main__":
    os.makedirs(ПАПКА, exist_ok=True)
    сколько = 0
    for е in всё():
        т = е.get("текст", "")
        if not т:
            continue
        # Хештеги в публикации идут внутри текста, значит и в проверку
        # уходят вместе с ним.
        целиком = без_разметки(т)
        if е.get("хештеги"):
            целиком += "\n\n" + е["хештеги"]
        путь = os.path.join(ПАПКА, е["код"] + ".txt")
        open(путь, "w", encoding="utf-8").write(целиком)
        сколько += 1
    print("выгружено текстов:", сколько, "в", ПАПКА)
