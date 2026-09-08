# -*- coding: utf-8 -*-
"""Положить партию DIESEL в очередь постинга.

Элемент очереди это папка с тремя вещами: reel.mp4, cover.jpg и meta.json.
Тексты берутся из сданной партии, а не пишутся заново: они уже прошли приёмку.

Обложка обязательна: без неё YouTube ставит случайный кадр, а Instagram
отказывает. Первый кадр ролика и обложка это одно и то же по правилу, но
площадкам нужен отдельный файл.

    python3 ochered_diesel.py            показать, что положит
    python3 ochered_diesel.py делай      положить
"""
import json, os, re, shutil, sys

БАЗА = "/opt/oko-poster"
МЕДИА = "/var/www/okoteam/3d/diesel/media"
ОЧЕРЕДЬ = f"{БАЗА}/queue"
ДЕЛАЙ = len(sys.argv) > 1 and sys.argv[1] == "делай"
ТИРЕ = "\u2014"   # длинное тире, самим символом его в репозиторий нельзя

ЕДИНИЦЫ = json.load(open(f"{БАЗА}/cfg/diesel_partiya.json", encoding="utf-8"))


def номер():
    """Следующий свободный номер по очереди и по уже опубликованному."""
    было = []
    for где in (ОЧЕРЕДЬ, f"{БАЗА}/published"):
        if os.path.isdir(где):
            было += [int(x) for x in os.listdir(где) if x.isdigit()]
    return (max(было) + 1) if было else 1


н = номер()
план = []
for е in ЕДИНИЦЫ:
    ролик = f"{МЕДИА}/{е['файл']}.mp4"
    обложка = f"{МЕДИА}/{е['файл']}_cover.jpg"
    беды = []
    if not os.path.exists(ролик):
        беды.append("нет ролика " + ролик)
    if not os.path.exists(обложка):
        беды.append("нет обложки " + обложка)
    for поле in ("title", "caption", "yt_desc"):
        if ТИРЕ in е[поле]:
            беды.append("длинное тире в " + поле)
        if re.search(r"(?:^|\s)#[^\W\d_]", е[поле]):
            беды.append("хештег в " + поле)
    план.append({"номер": str(н).zfill(3), "единица": е, "ролик": ролик,
                 "обложка": обложка, "беды": беды})
    н += 1

for п in план:
    метка = "ОК " if not п["беды"] else "СТОП"
    print(метка, п["номер"], п["единица"]["файл"], "|", п["единица"]["title"][:60])
    for б in п["беды"]:
        print("      ", б)

плохие = [п for п in план if п["беды"]]
if плохие:
    print("\nНичего не кладу: сначала исправить", len(плохие), "штук")
    sys.exit(1)

if not ДЕЛАЙ:
    print("\nСУХО. Ничего не положено. Чтобы положить, добавь слово: делай")
    sys.exit(0)

for п in план:
    d = f"{ОЧЕРЕДЬ}/{п['номер']}"
    os.makedirs(d, exist_ok=True)
    shutil.copy2(п["ролик"], f"{d}/reel.mp4")
    shutil.copy2(п["обложка"], f"{d}/cover.jpg")
    м = {"batch": "A", "title": п["единица"]["title"],
         "caption": п["единица"]["caption"], "yt_desc": п["единица"]["yt_desc"],
         "источник": "партия 06.09.2026, сдана и принята"}
    json.dump(м, open(f"{d}/meta.json", "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    print("положено", п["номер"], п["единица"]["файл"])
print("\nв очереди теперь:", len([x for x in os.listdir(ОЧЕРЕДЬ) if x.isdigit()]))
