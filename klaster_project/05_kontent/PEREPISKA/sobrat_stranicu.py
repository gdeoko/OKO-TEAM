# -*- coding: utf-8 -*-
"""Готовим данные и картинки для страницы okoteam.top/klaster-kontent.

Кадры весят по два мегабайта, целиком на страницу их класть нельзя: с
телефона она не откроется. Поэтому каждый кадр сжимаем в две версии,
крупную под просмотр и мелкую под ленту, а тексты собираем в JSON.
"""
import glob, json, os, sys
sys.path.insert(0, "/opt/oko-poster/perepiska")
from PIL import Image
from audit30 import всё

КАДРЫ = "/opt/oko-poster/klaster_nedelya1"
СБОРКА = "/tmp/klaster_kontent"
os.makedirs(СБОРКА + "/img", exist_ok=True)
os.makedirs(СБОРКА + "/thumb", exist_ok=True)


def сжать(исходник, имя):
    им = Image.open(исходник).convert("RGB")
    большая = им.copy()
    большая.thumbnail((1400, 1400), Image.LANCZOS)
    большая.save("%s/img/%s.jpg" % (СБОРКА, имя), quality=84, optimize=True)
    мелкая = им.copy()
    мелкая.thumbnail((700, 700), Image.LANCZOS)
    мелкая.save("%s/thumb/%s.jpg" % (СБОРКА, имя), quality=78, optimize=True)


def кадры(е):
    имя = (е.get("кадр") or "").split("..")[0]
    if not имя or "снимаем" in имя:
        return []
    основа = имя.rsplit("-", 1)[0] if имя[-1].isdigit() else имя
    ряд = sorted(glob.glob(os.path.join(КАДРЫ, основа + "-*.png")))
    if ряд and ("карусель" in е["формат"] or "истори" in е["формат"]):
        return ряд
    один = os.path.join(КАДРЫ, имя + ".png")
    return [один] if os.path.exists(один) else []


def вид(е):
    ф = е["формат"]
    if "карусель" in ф:
        return "карусель"
    if "истори" in ф:
        return "истории"
    if е["площадка"] in ("Дзен", "vc.ru", "РБК"):
        return "статья"
    return "пост"


данные = []
сжато = set()
for е in всё():
    ряд = кадры(е)
    имена = []
    for путь in ряд:
        имя = os.path.basename(путь)[:-4]
        if имя not in сжато:
            сжать(путь, имя)
            сжато.add(имя)
        имена.append(имя)
    данные.append({
        "код": е["код"],
        "день": е["день"],
        "площадка": е["площадка"],
        "формат": е["формат"],
        "вид": вид(е),
        "рубрика": е.get("рубрика", ""),
        "заголовок": е.get("заголовок", ""),
        "текст": е.get("текст", ""),
        "слайды": е.get("слайды") or [],
        "опрос": е.get("опрос") or [],
        "хештеги": е.get("хештеги", ""),
        "кадры": имена,
    })

json.dump(данные, open(СБОРКА + "/kontent.json", "w", encoding="utf-8"),
          ensure_ascii=False, indent=1)
вес = sum(os.path.getsize(f) for f in glob.glob(СБОРКА + "/*/*.jpg"))
print("единиц:", len(данные), "картинок:", len(сжато), "вес:", вес // 1024 // 1024, "МБ")
