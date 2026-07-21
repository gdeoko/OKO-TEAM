#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""СТАДИЯ 4 — ПУБЛИКАЦИЯ В БОТА (стандарт Даниэля):
ролик уходит ФАЙЛОМ (sendDocument, НЕ обычным видео), обложка уже ВНУТРИ ролика первым кадром;
ОПИСАНИЕ — ОТДЕЛЬНЫМ сообщением. Аналитика — отдельным документом (стадия 1/5).
env: TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID
  python publish_bot.py reel.mp4 --desc "описание..." [--report report.json]
"""
import os, sys, json, argparse, urllib.request, urllib.parse, mimetypes
TOKEN=os.environ.get("TELEGRAM_BOT_TOKEN"); CHAT=os.environ.get("TELEGRAM_CHAT_ID")

def send_doc(path, caption=""):
    b="----v"+os.urandom(8).hex(); body=b""
    for k,v in {"chat_id":CHAT,"caption":caption}.items():
        body+=f"--{b}\r\nContent-Disposition: form-data; name=\"{k}\"\r\n\r\n{v}\r\n".encode()
    fn=os.path.basename(path); ct=mimetypes.guess_type(fn)[0] or "application/octet-stream"
    body+=f"--{b}\r\nContent-Disposition: form-data; name=\"document\"; filename=\"{fn}\"\r\n".encode()
    body+=f"Content-Type: {ct}\r\n\r\n".encode()+open(path,"rb").read()+b"\r\n"+f"--{b}--\r\n".encode()
    r=urllib.request.Request(f"https://api.telegram.org/bot{TOKEN}/sendDocument",data=body,
        headers={"Content-Type":f"multipart/form-data; boundary={b}"})
    return json.loads(urllib.request.urlopen(r,timeout=180).read())

def send_msg(text):
    d=urllib.parse.urlencode({"chat_id":CHAT,"text":text}).encode()
    return json.loads(urllib.request.urlopen(f"https://api.telegram.org/bot{TOKEN}/sendMessage",data=d,timeout=60).read())

def main():
    ap=argparse.ArgumentParser()
    ap.add_argument("reel"); ap.add_argument("--desc",default=""); ap.add_argument("--report",default=None)
    a=ap.parse_args()
    if not TOKEN or not CHAT: sys.exit("нет TELEGRAM_BOT_TOKEN/TELEGRAM_CHAT_ID")
    r1=send_doc(a.reel, "")                         # ролик ФАЙЛОМ, без подписи (обложка внутри)
    desc=a.desc
    if not desc and a.report and os.path.exists(a.report):
        rp=json.load(open(a.report)); desc=rp.get("description","")
        if rp.get("hashtags"): desc+="\n\n"+" ".join(rp["hashtags"])
    if desc: send_msg(desc)                         # описание ОТДЕЛЬНЫМ сообщением
    print("В БОТА: ролик файлом ✓, описание отдельно ✓" if r1.get("ok") else r1)

if __name__=="__main__": main()
