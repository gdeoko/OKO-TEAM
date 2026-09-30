# -*- coding: utf-8 -*-
"""Критик сравнением с живым: шесть кадров, включая живой контроль.

Годность критика видна по двум краям:
  - принятый владельцем кадр и ЖИВОЕ фото обязаны выходить «КАК ЖИВОЕ»
    или с высоким реализмом;
  - забракованные владельцем кадры - с низким.
Если живое фото получает те же упрёки, что и наши кадры, критик врёт.
"""
import json
import os
import re
import sys
import tempfile

sys.path.insert(0, "/root")
import kritik
from PIL import Image, ImageDraw, ImageFont

Э = "/root/komplekt/un_close"
ЭТ = sorted(os.path.join(Э, f) for f in os.listdir(Э) if f[0].isdigit())
КОНТРОЛЬ = sorted(os.path.join("/root/komplekt/живые_контроль", f)
                  for f in os.listdir("/root/komplekt/живые_контроль"))
КАДРЫ = [
    ("1-юки-заново", Э + "/B2_результат.png"),
    ("2-юки-первый", Э + "/B_результат.png"),
    ("3-показ-брак", "/srv/amberry/показ/un_close.png"),
    ("4-показ4-брак", "/srv/amberry/показ4/un_close.png"),
    ("5-принят", "/srv/amberry/эталоны/раздевание/03_крупный_план.png"),
] + [("6-КОНТРОЛЬ-живое-%d" % (i + 1), п) for i, п in enumerate(КОНТРОЛЬ)]
КУДА = "/root/sravni"
os.makedirs(КУДА, exist_ok=True)


def пара(живой, наш, куда):
    """Живое слева, наше справа, одной высоты, с подписями."""
    а, б = Image.open(живой).convert("RGB"), Image.open(наш).convert("RGB")
    в = 700
    а = а.resize((int(а.width * в / а.height), в))
    б = б.resize((int(б.width * в / б.height), в))
    и = Image.new("RGB", (а.width + б.width + 12, в + 44), (0, 0, 0))
    и.paste(а, (0, 44)); и.paste(б, (а.width + 12, 44))
    д = ImageDraw.Draw(и)
    try:
        ш = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", 28)
    except Exception:
        ш = ImageFont.load_default()
    д.text((10, 6), "ЖИВОЕ", fill=(120, 255, 120), font=ш)
    д.text((а.width + 22, 6), "ОЦЕНИВАЕМ", fill=(255, 120, 200), font=ш)
    и.save(куда, quality=90)


свод = {}
for имя, путь in КАДРЫ:
    д = os.path.join(КУДА, имя)
    os.makedirs(д, exist_ok=True)
    рамки, нет = kritik.зоны_по_скелету(путь)
    свод[имя] = {}
    print("=" * 60, "\n", имя, flush=True)
    with tempfile.TemporaryDirectory() as т:
        for зона, р in рамки.items():
            вид = "кисть" if зона.startswith("кисть") else зона
            if вид not in kritik.ЧТО_ЗОНА:
                continue
            наш = kritik.кроп(путь, р, os.path.join(т, "наш.jpg"))
            н = kritik.зона_эталона(ЭТ, вид)
            if not н:
                print("  %s: нет такой зоны у живых" % зона); continue
            живой = kritik.кроп(н[0], н[1], os.path.join(т, "живой.jpg"))
            ответ = kritik.спросить([живой, наш],
                                    kritik.ВОПРОС_СРАВНИ.format(что=kritik.ЧТО_ЗОНА[вид]), 450)
            м = re.search(r"РЕАЛИЗМ\s*(\d+)\s*/\s*10", ответ)
            балл = int(м.group(1)) if м else None
            пара(живой, наш, os.path.join(д, "%s.jpg" % зона.replace(" ", "-")))
            свод[имя][зона] = {"балл": балл, "как_живое": "КАК ЖИВОЕ" in ответ, "ответ": ответ}
            print("  --- %s: реализм %s ---\n%s" % (зона, балл, ответ), flush=True)
json.dump(свод, open(os.path.join(КУДА, "свод.json"), "w"), ensure_ascii=False, indent=1)
print("\nСВОД")
for имя, з in свод.items():
    print("  %-22s %s" % (имя, "  ".join("%s=%s%s" % (к, в["балл"], "(живое)" if в["как_живое"] else "")
                                          for к, в in з.items())))
