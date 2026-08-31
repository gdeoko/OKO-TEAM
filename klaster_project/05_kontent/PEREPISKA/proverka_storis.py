# -*- coding: utf-8 -*-
"""Приёмка серий историй: текста поста у них нет, есть раскладка кадров.

Прогон месяца берёт только единицы с полем «текст», поэтому истории мимо
него проходили. Здесь их проверяем своим форматом: кадры 9:16, серия от
трёх до десяти, текст слайдов на живость и на регламент.
"""
import glob, os, subprocess, sys
sys.path.insert(0, "/opt/oko-poster/perepiska")
from audit30 import всё

ПИТОН = "/opt/oko-agents/.venv/bin/python3"
КАДРЫ = "/opt/oko-poster/klaster_nedelya1"
ПАПКА = "/tmp/storis_m1"
os.makedirs(ПАПКА, exist_ok=True)

годных, плохих = 0, []
for е in всё():
    if "истории" not in е["формат"]:
        continue
    слайды = е.get("слайды") or []
    файл = os.path.join(ПАПКА, е["код"] + ".txt")
    open(файл, "w", encoding="utf-8").write("\n\n".join(слайды))
    имя = (е.get("кадр") or "").split("..")[0]
    основа = имя.rsplit("-", 1)[0] if имя and имя[-1].isdigit() else имя
    ряд = sorted(glob.glob(os.path.join(КАДРЫ, основа + "-*.png")))
    доводы = [ПИТОН, "-m", "tools.proverka_posta", "--формат", "сторис",
              "--текст", файл]
    if ряд:
        доводы += ["--визуал"] + ряд
    r = subprocess.run(доводы, capture_output=True, text=True, cwd="/opt/oko-agents")
    вывод = ((r.stdout or "") + (r.stderr or "")).strip()
    первая = вывод.split("\n")[0] if вывод else "пусто"
    print(f"{е['код']:7} кадров {len(ряд)}  {первая[:70]}")
    if первая.startswith("ГОДИТСЯ"):
        годных += 1
    else:
        беды = [с.strip() for с in вывод.split("\n")[1:] if с.strip()][:3]
        плохих.append((е["код"], первая, " · ".join(беды)))
print(f"\nИСТОРИИ: годится {годных}, брак {len(плохих)}")
for код, итог, беды in плохих:
    print(f"  {код}: {итог} {беды}")
