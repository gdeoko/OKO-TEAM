#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""СТАДИЯ 4 — ПУБЛИКАЦИЯ В БОТА (стандарт Даниэля):
ролик уходит ФАЙЛОМ (sendDocument), ОБЛОЖКА прикрепляется ПРЕВЬЮ-ПОСТЕРОМ (thumbnail) —
она НЕ часть ролика, а красивая картинка «до захода в ролик». Сам ролик стартует сразу с хука.
ОПИСАНИЕ — ОТДЕЛЬНЫМ сообщением. Аналитика — отдельным документом (стадия 1/5).
env: TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID
  python publish_bot.py reel.mp4 --cover cover.jpg --desc "описание..." [--report report.json]
"""
import os, sys, json, argparse, subprocess, urllib.request, urllib.parse, mimetypes
TOKEN=os.environ.get("TELEGRAM_BOT_TOKEN"); CHAT=os.environ.get("TELEGRAM_CHAT_ID")

def make_thumb(cover, out):
    """Telegram thumbnail: JPEG, ≤320px по стороне, <200КБ. Готовим из обложки."""
    try:
        subprocess.run(["ffmpeg","-y","-i",cover,"-vf",
            "scale='if(gt(iw,ih),320,-2)':'if(gt(iw,ih),-2,320)'","-q:v","6",out],
            capture_output=True, timeout=60)
        return out if os.path.exists(out) and os.path.getsize(out)<200*1024 else None
    except Exception:
        return None

def send_doc(path, caption="", thumb=None):
    b="----v"+os.urandom(8).hex(); body=b""
    for k,v in {"chat_id":CHAT,"caption":caption}.items():
        body+=f"--{b}\r\nContent-Disposition: form-data; name=\"{k}\"\r\n\r\n{v}\r\n".encode()
    def _file(field, fpath, ct=None):
        nonlocal body
        fn=os.path.basename(fpath); ct=ct or mimetypes.guess_type(fn)[0] or "application/octet-stream"
        body+=f"--{b}\r\nContent-Disposition: form-data; name=\"{field}\"; filename=\"{fn}\"\r\n".encode()
        body+=f"Content-Type: {ct}\r\n\r\n".encode()+open(fpath,"rb").read()+b"\r\n"
    _file("document", path)
    if thumb and os.path.exists(thumb):                 # обложка-постер приделана при публикации
        _file("thumbnail", thumb, "image/jpeg")
    body+=f"--{b}--\r\n".encode()
    r=urllib.request.Request(f"https://api.telegram.org/bot{TOKEN}/sendDocument",data=body,
        headers={"Content-Type":f"multipart/form-data; boundary={b}"})
    return json.loads(urllib.request.urlopen(r,timeout=180).read())

def send_msg(text):
    d=urllib.parse.urlencode({"chat_id":CHAT,"text":text}).encode()
    return json.loads(urllib.request.urlopen(f"https://api.telegram.org/bot{TOKEN}/sendMessage",data=d,timeout=60).read())

def main():
    ap=argparse.ArgumentParser()
    ap.add_argument("reel"); ap.add_argument("--cover",default=None)
    ap.add_argument("--desc",default=""); ap.add_argument("--report",default=None)
    a=ap.parse_args()
    if not TOKEN or not CHAT: sys.exit("нет TELEGRAM_BOT_TOKEN/TELEGRAM_CHAT_ID")
    thumb=None
    if a.cover and os.path.exists(a.cover):
        thumb=make_thumb(a.cover, os.path.join(os.path.dirname(a.reel) or ".","_thumb.jpg"))
    r1=send_doc(a.reel, "", thumb)                    # ролик ФАЙЛОМ + обложка превью-постером
    desc=a.desc
    if not desc and a.report and os.path.exists(a.report):
        rp=json.load(open(a.report)); desc=rp.get("description","")
        if rp.get("hashtags"): desc+="\n\n"+" ".join(rp["hashtags"])
    if desc: send_msg(desc)                            # описание ОТДЕЛЬНЫМ сообщением
    ok=r1.get("ok")
    print(("В БОТА: ролик файлом ✓, обложка-постер "+("✓" if thumb else "нет cover")+", описание отдельно ✓")
          if ok else r1)

if __name__=="__main__": main()
