#!/usr/bin/env python3
"""
Постинг ФОТО в Instagram OKO через instagrapi по живой сессии (sessionid).
ВАЖНО (грабли 18.07.2026): веб-создатель постов IG (accounts/... create) на свежей
сессии отдаёт «Произошла ошибка». Мобильный API instagrapi photo_upload по sessionid
работает надёжно. sessionid берём из Playwright storageState (cfg/ig_oko_state.json),
который пишет headed-логин (см. INTEGRATIONS §2а). Запуск на VPS oko-poster.
  python3 ig_photo_post.py <image.jpg> <caption.txt|-> 
"""
import sys, json
from instagrapi import Client
STATE = "/opt/oko-poster/cfg/ig_oko_state.json"

def sessionid(state=STATE):
    d = json.load(open(state))
    for c in d.get("cookies", []):
        if c.get("name") == "sessionid":
            return c["value"]
    raise SystemExit("no sessionid in " + state)

def main():
    img = sys.argv[1]
    cap = sys.stdin.read() if len(sys.argv) < 3 or sys.argv[2] == "-" else open(sys.argv[2], encoding="utf-8").read()
    c = Client(); c.delay_range = [2, 5]
    c.login_by_sessionid(sessionid())
    m = c.photo_upload(img, cap)
    print(json.dumps({"ok": True, "code": m.code, "pk": str(m.pk),
                      "url": f"https://www.instagram.com/p/{m.code}/"}, ensure_ascii=False))

if __name__ == "__main__":
    main()
