# -*- coding: utf-8 -*-
"""Прогон всего месяца через штатные проверки завода.

Для каждой единицы берём её формат по площадке и виду, зовём
tools.proverka_posta и tools.zhivost, собираем сводку. Пока не ГОДИТСЯ по
каждой единице, наружу ничего не уходит.
"""
import glob
import os
import subprocess
import sys

sys.path.insert(0, "/opt/oko-poster/perepiska")
from audit30 import всё

ПАПКА = "/tmp/teksty_m1"
ПИТОН = "/opt/oko-agents/.venv/bin/python3"
КАДРЫ = "/opt/oko-poster/klaster_nedelya1"


def формат(е):
    вид = е["формат"]
    if "карусель" in вид:
        return "карусель"
    if "истори" in вид:
        return "сторис"
    if е["площадка"] in ("Дзен", "vc.ru", "РБК"):
        return "статья"
    if е["площадка"] == "Telegram":
        return "tg"
    return "пост"


def кадры(е):
    """Для карусели и историй отдаём всю серию, иначе один кадр."""
    имя = (е.get("кадр") or "").split("..")[0]
    if not имя or "снимаем" in имя:
        return []
    основа = имя.rsplit("-", 1)[0] if имя[-1].isdigit() else имя
    ряд = sorted(glob.glob(os.path.join(КАДРЫ, основа + "-*.png")))
    if ряд and ("карусель" in е["формат"] or "истори" in е["формат"]):
        return ряд
    один = os.path.join(КАДРЫ, имя + ".png")
    return [один] if os.path.exists(один) else []


def прогнать(е):
    файл = os.path.join(ПАПКА, е["код"] + ".txt")
    if not os.path.exists(файл):
        return "нет текста", ""
    доводы = [ПИТОН, "-m", "tools.proverka_posta", "--формат", формат(е),
              "--текст", файл]
    файлы = кадры(е)
    if файлы:
        доводы += ["--визуал"] + файлы
    r = subprocess.run(доводы, capture_output=True, text=True, cwd="/opt/oko-agents")
    вывод = ((r.stdout or "") + (r.stderr or "")).strip()
    первая = вывод.split("\n")[0] if вывод else "пусто"
    беды = [с.strip() for с in вывод.split("\n")[1:] if с.strip()][:2]
    return первая, " · ".join(беды)


if __name__ == "__main__":
    годных, плохих = 0, []
    for е in всё():
        if not е.get("текст"):
            continue
        итог, беды = прогнать(е)
        знак = "ГОДИТСЯ" if итог.startswith("ГОДИТСЯ") else "БРАК"
        if знак == "ГОДИТСЯ":
            годных += 1
        else:
            плохих.append((е["код"], формат(е), итог, беды))
        print(f"{е['код']:8} {формат(е):9} {итог[:70]}")
    print(f"\nИТОГ: годится {годных}, брак {len(плохих)}")
    for код, ф, итог, беды in плохих:
        print(f"  {код} ({ф}): {итог} {беды}")
