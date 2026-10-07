# -*- coding: utf-8 -*-
"""Второй аудит: живой язык через humanize и длина под Телеграм."""
import sys
sys.path.insert(0, "/opt/oko-agents")
sys.path.insert(0, "/opt/oko-poster/perepiska")
from emo import без_разметки, премиум
from nedelya1_chast1 import ЕДИНИЦЫ as ч1
from nedelya1_chast2 import ЕДИНИЦЫ as ч2
from core import humanize

беды = 0
for е in ч1 + ч2:
    если_нет = е.get("текст", "")
    if не_текст := (not если_нет):
        print(f"{е['код']}: только слайды, текста нет")
        continue
    чистый = без_разметки(если_нет)
    д = humanize.check(чистый)
    длина = len(премиум(если_нет))
    строка = f"{е['код']} · {е['площадка']}: {len(чистый)} знаков"
    if е["площадка"] == "Telegram":
        строка += f", с разметкой {длина}"
        if длина > 4096:
            строка += " ПЕРЕБОР"
            беды += 1
    if not д["ok"]:
        строка += f" | язык: {д['bad']}"
        беды += 1
    else:
        строка += " | язык чистый"
    print(строка)
print(f"\nитог: {'всё чисто' if not беды else f'бед {беды}'}")
