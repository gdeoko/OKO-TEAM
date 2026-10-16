# -*- coding: utf-8 -*-
"""Заливка паков в Telegram через @rocket_cdn_bot.

Два набора из одних и тех же файлов: обычные стикеры и кастом-эмодзи.
Telegram берёт эмодзи тем же форматом 512x512, что и стикеры, поэтому
пары совпадают файл в файл, а не «похожи». Формат берётся по
расширению: .tgs это вектор, .webm это видеостикер с прозрачностью.

    python3 upload.py            залить оба набора
    python3 upload.py --check    только показать состояние наборов

Владельцем набора становится человек, чей user_id указан: набор живёт
в его аккаунте, бот лишь его держит.
"""

import json
import os
import subprocess
import sys
import time

HERE = os.path.dirname(os.path.abspath(__file__))
# папка выдачи меняется: векторный пак лежит в out, фотопак в out_foto
OUT = os.environ.get("ROCKET_OUT") or os.path.join(HERE, "..", "out")
API = "https://api.telegram.org/bot%s"

TOKEN = os.environ.get("ROCKET_BOT_TOKEN", "")
OWNER = os.environ.get("ROCKET_OWNER_ID", "")
BOT = "rocket_cdn_bot"

# У каждого набора своя папка: файлы те же по рисунку и по движению, но
# у кастом-эмодзи потолок веса втрое ниже, и 512x512 Telegram отбивает
# ответом «file is too big». Поэтому эмодзи берутся из пары «_emo»,
# собранной из ТЕХ ЖЕ кадров.
PACKS = [
    {"kind": "regular",
     "name": "rocket_pack_by_" + BOT,
     "title": "Rocket Pack",
     "dir": OUT},
    {"kind": "custom_emoji",
     "name": "rocket_pack_emoji_by_" + BOT,
     "title": "Rocket Pack",
     "dir": OUT + "_emo"},
]

# Набор создаётся ОДНИМ стикером, остальные досылаются по одному.
# Запрос с тремя десятками анимаций разом Telegram отбивает лимитом, а
# на лёгкий запрос отвечает и пропускает.
CHUNK = 1
# сколько раз ждать названную паузу, прежде чем сдаться
TRIES = 24


def call(method, fields, files=None):
    """Вызов Bot API через curl: multipart с файлами он собирает сам."""
    cmd = ["curl", "-s", "--max-time", "180", API % TOKEN + "/" + method]
    for k, v in fields.items():
        cmd += ["-F", "%s=%s" % (k, v)]
    for k, p in (files or {}).items():
        cmd += ["-F", "%s=@%s" % (k, p)]
    out = subprocess.run(cmd, capture_output=True, text=True).stdout
    try:
        return json.loads(out)
    except ValueError:
        # пустой ответ означает оборванный запрос, а не отказ Telegram
        return {"ok": False, "network": not out.strip(),
                "description": out[:400] or "запрос оборвался"}


def формат(имя):
    """Telegram различает вектор и видео названием формата, не файлом.

    Ошибиться здесь значит получить отказ «STICKER_FORMAT_INVALID» на
    каждом кадре, поэтому смотрим расширение, а не помним руками.
    """
    return "video" if имя.lower().endswith(".webm") else "animated"


def manifest(pack=None):
    папка = (pack or {}).get("dir", OUT)
    with open(os.path.join(папка, "manifest.json"), encoding="utf-8") as f:
        return json.load(f)


def путь(pack, it):
    return os.path.join(pack.get("dir", OUT), it["file"])


def show(pack):
    r = call("getStickerSet", {"name": pack["name"]})
    if r.get("ok"):
        st = r["result"]["stickers"]
        print("  %-34s есть, %d шт, тип %s" %
              (pack["name"], len(st), r["result"].get("sticker_type")))
        return len(st)
    print("  %-34s нет (%s)" % (pack["name"], r.get("description", "")[:60]))
    return 0


def upload(pack, items):
    """Создать набор и дослать остаток, если он длиннее одного вызова."""
    first, rest = items[:CHUNK], items[CHUNK:]
    stickers, files = [], {}
    for i, it in enumerate(first):
        key = "f%d" % i
        stickers.append({"sticker": "attach://" + key,
                         "format": формат(it["file"]),
                         "emoji_list": [it["emoji"]]})
        files[key] = путь(pack, it)
    fields = {
        "user_id": OWNER, "name": pack["name"], "title": pack["title"],
        "sticker_type": pack["kind"],
        "stickers": json.dumps(stickers, ensure_ascii=False),
    }
    # Telegram придерживает создание наборов и сам называет паузу.
    # Ждём ровно столько, сколько он просит, и пробуем снова.
    for attempt in range(TRIES):
        r = call("createNewStickerSet", fields, files)
        if r.get("ok"):
            break
        wait = (r.get("parameters") or {}).get("retry_after")
        if not wait:
            print("  создание не прошло: %s" % r.get("description"))
            return False
        print("  ждём %d с (попытка %d)" % (wait, attempt + 1))
        time.sleep(wait + 5)
    if not r.get("ok"):
        print("  создание не прошло: %s" % r.get("description"))
        return False
    print("  создан %s (%d шт)" % (pack["name"], len(first)))

    for it in rest:
        s = {"sticker": "attach://f", "format": формат(it["file"]),
             "emoji_list": [it["emoji"]]}
        for attempt in range(TRIES):
            r = call("addStickerToSet", {
                "user_id": OWNER, "name": pack["name"],
                "sticker": json.dumps(s, ensure_ascii=False),
            }, {"f": путь(pack, it)})
            if r.get("ok"):
                break
            wait = (r.get("parameters") or {}).get("retry_after")
            if not wait and not r.get("network"):
                break
            time.sleep((wait or 4) + 3)
        else:
            print("  %s: лимит не отпустил" % it["key"])
        if not r.get("ok"):
            print("  %s не добавлен: %s" % (it["key"], r.get("description")))
        else:
            print("    + %s" % it["key"])
        time.sleep(1.2)  # набор собирается не мгновенно, не частим
    return True


def fill(pack, items):
    """Дослать то, чего в наборе не хватает.

    Сетевой обрыв на одном файле не должен оставлять дыру в паке:
    сверяем набор с манифестом по эмодзи и досылаем недостающее.
    """
    r = call("getStickerSet", {"name": pack["name"]})
    if not r.get("ok"):
        print("  набора нет, доборка нечего делать")
        return
    have = [x.get("emoji") for x in r["result"]["stickers"]]
    miss = [it for it in items if it["emoji"] not in have]
    if not miss:
        print("  %s полон, %d шт" % (pack["name"], len(have)))
        return
    print("  %s: не хватает %d" % (pack["name"], len(miss)))
    for it in miss:
        s = {"sticker": "attach://f", "format": формат(it["file"]),
             "emoji_list": [it["emoji"]]}
        for _ in range(TRIES):
            res = call("addStickerToSet", {
                "user_id": OWNER, "name": pack["name"],
                "sticker": json.dumps(s, ensure_ascii=False),
            }, {"f": путь(pack, it)})
            if res.get("ok"):
                print("    + %s" % it["key"])
                break
            wait = (res.get("parameters") or {}).get("retry_after")
            if not wait and not res.get("network"):
                print("    %s: %s" % (it["key"], res.get("description")))
                break
            time.sleep((wait or 4) + 3)
        time.sleep(1.2)


def replace(pack, items):
    """Обновить набор целиком, не пересоздавая его.

    Пересоздание стоило бы новой ссылки и нового лимита на создание.
    Поэтому новые стикеры досылаются в тот же набор, а старые удаляются
    после - набор ни секунды не остаётся пустым, ссылка живёт.
    """
    r = call("getStickerSet", {"name": pack["name"]})
    if not r.get("ok"):
        return upload(pack, items)
    old = [x["file_id"] for x in r["result"]["stickers"]]
    print("  %s: было %d, кладу %d новых" %
          (pack["name"], len(old), len(items)))
    added = 0
    for it in items:
        s_ = {"sticker": "attach://f", "format": формат(it["file"]),
              "emoji_list": [it["emoji"]]}
        for _ in range(TRIES):
            res = call("addStickerToSet", {
                "user_id": OWNER, "name": pack["name"],
                "sticker": json.dumps(s_, ensure_ascii=False),
            }, {"f": путь(pack, it)})
            if res.get("ok"):
                added += 1
                break
            wait = (res.get("parameters") or {}).get("retry_after")
            if not wait and not res.get("network"):
                print("    %s: %s" % (it["key"], res.get("description")))
                break
            time.sleep((wait or 4) + 3)
        time.sleep(1.0)
    print("  добавлено %d, убираю прежние %d" % (added, len(old)))
    for fid in old:
        for _ in range(TRIES):
            res = call("deleteStickerFromSet", {"sticker": fid})
            if res.get("ok"):
                break
            wait = (res.get("parameters") or {}).get("retry_after")
            if not wait and not res.get("network"):
                break
            time.sleep((wait or 4) + 2)
        time.sleep(0.6)
    return True


def подменить(pack, items, ключи):
    """Заменить в наборе только названные единицы, не трогая остальные.

    Целиком набор перезаливать нельзя: у остальных тридцати стикеров
    поменялись бы file_id, а они уже стоят в чужих чатах и в статусах.
    Поэтому новый кладётся в конец, переставляется на место старого и
    только потом старый убирается - место в ряду сохраняется.
    """
    r = call("getStickerSet", {"name": pack["name"]})
    if not r.get("ok"):
        print("  набора нет: %s" % r.get("description"))
        return
    было = r["result"]["stickers"]
    по_эмодзи = {}
    for i, s_ in enumerate(было):
        по_эмодзи.setdefault(s_.get("emoji"), (i, s_["file_id"]))

    for it in items:
        if it["key"] not in ключи:
            continue
        место = по_эмодзи.get(it["emoji"])
        if not место:
            print("  %s: в наборе не нашёлся" % it["key"])
            continue
        индекс, старый = место
        s_ = {"sticker": "attach://f", "format": формат(it["file"]),
              "emoji_list": [it["emoji"]]}
        res = call("addStickerToSet", {
            "user_id": OWNER, "name": pack["name"],
            "sticker": json.dumps(s_, ensure_ascii=False),
        }, {"f": путь(pack, it)})
        if not res.get("ok"):
            print("  %s не лёг: %s" % (it["key"], res.get("description")))
            continue
        сейчас = call("getStickerSet", {"name": pack["name"]})
        новый = сейчас["result"]["stickers"][-1]["file_id"]
        call("setStickerPositionInSet", {"sticker": новый, "position": индекс})
        call("deleteStickerFromSet", {"sticker": старый})
        print("    ~ %s на месте %d" % (it["key"], индекс))
        time.sleep(1.0)


def убрать(pack, эмодзи):
    """Снять из набора названные знаки, остальных не трогая."""
    r = call("getStickerSet", {"name": pack["name"]})
    if not r.get("ok"):
        print("  набора нет: %s" % r.get("description"))
        return
    сняли = 0
    for s_ in r["result"]["stickers"]:
        if s_.get("emoji") in эмодзи:
            res = call("deleteStickerFromSet", {"sticker": s_["file_id"]})
            if res.get("ok"):
                сняли += 1
            else:
                print("    %s: %s" % (s_.get("emoji"), res.get("description")))
            time.sleep(0.6)
    print("  снято %d" % сняли)


def переставить(pack, items):
    """Выстроить набор в порядке манифеста, не перезаливая его.

    Перезалить набор ради порядка значит сменить file_id у всех тридцати
    с лишним стикеров, а они уже стоят в чужих чатах и статусах. Telegram
    умеет двигать стикер по месту, и этого достаточно: идём по списку
    сверху вниз и каждый ставим на его номер.
    """
    r = call("getStickerSet", {"name": pack["name"]})
    if not r.get("ok"):
        print("  набора нет: %s" % r.get("description"))
        return
    есть = {s_.get("emoji"): s_["file_id"] for s_ in r["result"]["stickers"]}
    место = 0
    for it in items:
        fid = есть.get(it["emoji"])
        if not fid:
            print("  %s: в наборе нет" % it["key"])
            continue
        res = call("setStickerPositionInSet", {"sticker": fid,
                                               "position": место})
        if not res.get("ok"):
            print("  %s: %s" % (it["key"], res.get("description")))
        место += 1
        time.sleep(0.35)
    print("  выстроено %d" % место)


def main():
    if not TOKEN or not OWNER:
        print("нужны ROCKET_BOT_TOKEN и ROCKET_OWNER_ID в окружении")
        return 1
    print("в паке %d единиц" % len(manifest(PACKS[0])))
    print("состояние наборов:")
    state = [show(p) for p in PACKS]
    if "--check" in sys.argv:
        return 0
    if "--убрать" in sys.argv:
        знаки = set(sys.argv[sys.argv.index("--убрать") + 1].split(","))
        for pack in PACKS:
            print("  %s: снимаю %s" % (pack["name"], " ".join(знаки)))
            убрать(pack, знаки)
        return 0
    if "--порядок" in sys.argv:
        for pack in PACKS:
            print("  %s" % pack["name"])
            переставить(pack, manifest(pack))
        return 0
    if "--swap" in sys.argv:
        ключи = set(sys.argv[sys.argv.index("--swap") + 1].split(","))
        for pack in PACKS:
            print("  %s: меняю %s" % (pack["name"], ", ".join(sorted(ключи))))
            подменить(pack, manifest(pack), ключи)
        return 0
    if "--replace" in sys.argv:
        for pack in PACKS:
            replace(pack, manifest(pack))
        print("\nссылки:")
        for p in PACKS:
            kind = "addemoji" if p["kind"] == "custom_emoji" else "addstickers"
            print("  https://t.me/%s/%s" % (kind, p["name"]))
        return 0
    if "--fill" in sys.argv:
        for pack in PACKS:
            fill(pack, manifest(pack))
        return 0
    made = 0
    for pack, have in zip(PACKS, state):
        if have:
            print("  %s уже собран, пропускаю" % pack["name"])
            continue
        if made:
            # два набора подряд Telegram не даёт создать: второму нужна
            # своя выдержка, иначе он сразу упирается в тот же лимит
            print("  выдержка перед вторым набором")
            time.sleep(90)
        if upload(pack, manifest(pack)):
            made += 1
    print("\nссылки:")
    for p in PACKS:
        kind = "addemoji" if p["kind"] == "custom_emoji" else "addstickers"
        print("  https://t.me/%s/%s" % (kind, p["name"]))
    return 0


if __name__ == "__main__":
    sys.exit(main())
