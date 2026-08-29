#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Отправка документа/фото/видео в Telegram-бота @okoappbot.
Нужны env: TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID.
  python send_to_bot.py doc analytics.pdf "Аналитика конкурентов"
  python send_to_bot.py photo cover.jpg "Обложка"
  python send_to_bot.py video reel.mp4 "Ролик V.CODE"
"""
import os, sys, json, urllib.request, mimetypes
TOKEN=os.environ.get("TELEGRAM_BOT_TOKEN"); CHAT=os.environ.get("TELEGRAM_CHAT_ID")
def _post(method, fields, filefield, filepath):
    boundary="----oko"+os.urandom(8).hex(); body=b""
    for k,v in fields.items():
        body+=f"--{boundary}\r\nContent-Disposition: form-data; name=\"{k}\"\r\n\r\n{v}\r\n".encode()
    if filefield and filepath:
        fn=os.path.basename(filepath); ct=mimetypes.guess_type(fn)[0] or "application/octet-stream"
        body+=f"--{boundary}\r\nContent-Disposition: form-data; name=\"{filefield}\"; filename=\"{fn}\"\r\n".encode()
        body+=f"Content-Type: {ct}\r\n\r\n".encode()+open(filepath,"rb").read()+b"\r\n"
    body+=f"--{boundary}--\r\n".encode()
    req=urllib.request.Request(f"https://api.telegram.org/bot{TOKEN}/{method}", data=body,
        headers={"Content-Type":f"multipart/form-data; boundary={boundary}"})
    return json.loads(urllib.request.urlopen(req, timeout=120).read())
def main():
    if not TOKEN or not CHAT: sys.exit("нет TELEGRAM_BOT_TOKEN/TELEGRAM_CHAT_ID в env")
    kind=sys.argv[1]; path=sys.argv[2]; cap=sys.argv[3] if len(sys.argv)>3 else ""
    meth={"doc":"sendDocument","photo":"sendPhoto","video":"sendVideo"}[kind]
    field={"doc":"document","photo":"photo","video":"video"}[kind]
    r=_post(meth, {"chat_id":CHAT,"caption":cap}, field, path)
    print("ok" if r.get("ok") else r)
if __name__=="__main__": main()
