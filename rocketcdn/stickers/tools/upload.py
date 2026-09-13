# -*- coding: utf-8 -*-
"""Заливка паков в Telegram через @rocket_cdn_bot.

Два набора из одних и тех же .tgs: обычные стикеры и кастом-эмодзи.
Telegram берёт анимированные эмодзи тем же форматом 512x512, что и
стикеры, поэтому пары совпадают файл в файл, а не «похожи».

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
OUT = os.path.join(HERE, "..", "out")
API = "https://api.telegram.org/bot%s"

TOKEN = os.environ.get("ROCKET_BOT_TOKEN", "")
OWNER = os.environ.get("ROCKET_OWNER_ID", "")
BOT = "rocket_cdn_bot"

PACKS = [
    {"kind": "regular",
     "name": "rocket_space_by_" + BOT,
     "title": "Rocket CDN · VPN"},
    {"kind": "custom_emoji",
     "name": "rocket_icons_by_" + BOT,
     "title": "Rocket CDN · VPN иконки"},
]

# за один вызов Telegram принимает не больше пятидесяти
CHUNK = 50


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
        return {"ok": False, "description": out[:400]}


def manifest():
    with open(os.path.join(OUT, "manifest.json"), encoding="utf-8") as f:
        return json.load(f)


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
        stickers.append({"sticker": "attach://" + key, "format": "animated",
                         "emoji_list": [it["emoji"]]})
        files[key] = os.path.join(OUT, it["file"])
    fields = {
        "user_id": OWNER, "name": pack["name"], "title": pack["title"],
        "sticker_type": pack["kind"],
        "stickers": json.dumps(stickers, ensure_ascii=False),
    }
    # Telegram придерживает создание наборов и сам называет паузу.
    # Ждём ровно столько, сколько он просит, и пробуем снова.
    for attempt in range(4):
        r = call("createNewStickerSet", fields, files)
        if r.get("ok"):
            break
        wait = (r.get("parameters") or {}).get("retry_after")
        if not wait:
            print("  создание не прошло: %s" % r.get("description"))
            return False
        print("  Telegram просит подождать %d с, жду" % wait)
        time.sleep(wait + 5)
    if not r.get("ok"):
        print("  создание не прошло: %s" % r.get("description"))
        return False
    print("  создан %s (%d шт)" % (pack["name"], len(first)))

    for it in rest:
        s = {"sticker": "attach://f", "format": "animated",
             "emoji_list": [it["emoji"]]}
        for attempt in range(3):
            r = call("addStickerToSet", {
                "user_id": OWNER, "name": pack["name"],
                "sticker": json.dumps(s, ensure_ascii=False),
            }, {"f": os.path.join(OUT, it["file"])})
            if r.get("ok"):
                break
            wait = (r.get("parameters") or {}).get("retry_after")
            if not wait:
                break
            time.sleep(wait + 3)
        if not r.get("ok"):
            print("  %s не добавлен: %s" % (it["key"], r.get("description")))
        time.sleep(0.4)   # набор собирается на стороне Telegram не мгновенно
    return True


def main():
    if not TOKEN or not OWNER:
        print("нужны ROCKET_BOT_TOKEN и ROCKET_OWNER_ID в окружении")
        return 1
    items = manifest()
    print("в паке %d единиц" % len(items))
    print("состояние наборов:")
    state = [show(p) for p in PACKS]
    if "--check" in sys.argv:
        return 0
    for pack, have in zip(PACKS, state):
        if have:
            print("  %s уже собран, пропускаю" % pack["name"])
            continue
        upload(pack, items)
    print("\nссылки:")
    for p in PACKS:
        kind = "addemoji" if p["kind"] == "custom_emoji" else "addstickers"
        print("  https://t.me/%s/%s" % (kind, p["name"]))
    return 0


if __name__ == "__main__":
    sys.exit(main())
