#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
СТАДИЯ 4 (часть B) — ПУБЛИКАЦИЯ В БОТА. Вместо соцсетей выкладываем готовый ролик
в Telegram-бота @vcodemedia_bot с полным отчётом (сценарий, оценки, QA, обложкой).

env: TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID
  python publish_bot.py reel.mp4 --cover cover.jpg --report report.json
report.json — {"topic","kind","hook","description","hashtags":[...],
               "scenario_score","qa":{...},"competitors":"ссылка/сводка"}
"""
import os, sys, json, argparse, urllib.request, mimetypes

TOKEN=os.environ.get("TELEGRAM_BOT_TOKEN"); CHAT=os.environ.get("TELEGRAM_CHAT_ID")

def _post(method, fields, filefield=None, filepath=None):
    boundary="----vcode"+os.urandom(8).hex(); body=b""
    for k,v in fields.items():
        body+=f"--{boundary}\r\nContent-Disposition: form-data; name=\"{k}\"\r\n\r\n{v}\r\n".encode()
    if filefield and filepath:
        fn=os.path.basename(filepath); ct=mimetypes.guess_type(fn)[0] or "application/octet-stream"
        body+=f"--{boundary}\r\nContent-Disposition: form-data; name=\"{filefield}\"; filename=\"{fn}\"\r\n".encode()
        body+=f"Content-Type: {ct}\r\n\r\n".encode()+open(filepath,"rb").read()+b"\r\n"
    body+=f"--{boundary}--\r\n".encode()
    req=urllib.request.Request(f"https://api.telegram.org/bot{TOKEN}/{method}", data=body,
        headers={"Content-Type":f"multipart/form-data; boundary={boundary}"})
    return json.loads(urllib.request.urlopen(req,timeout=180).read())

def caption(r):
    kmap={"viral":"виральный","useful":"полезный","selling":"продающий"}
    qa=r.get("qa",{})
    tags=" ".join(r.get("hashtags",[]) or [])
    lines=[
        f"🎬 V.CODE — новый ролик ({kmap.get(r.get('kind'),r.get('kind',''))})",
        f"Тема: {r.get('topic','')}",
        f"Хук: {r.get('hook','')}",
        "",
        f"Сценарий: {r.get('scenario_score','—')}/100 · QA: {qa.get('score','—')}/100 {qa.get('verdict','')}",
        f"Длит: {qa.get('duration','—')}с · кадров: {qa.get('clips','—')} · наложений: {qa.get('overlays','—')}",
    ]
    if r.get("description"): lines+=["", "Описание для публикации:", r["description"]]
    if tags: lines+=["", tags]
    if r.get("competitors"): lines+=["", "На основе анализа: "+r["competitors"]]
    return "\n".join(lines)[:1024]

def main():
    ap=argparse.ArgumentParser()
    ap.add_argument("reel"); ap.add_argument("--cover",default=None); ap.add_argument("--report",default=None)
    a=ap.parse_args()
    if not TOKEN or not CHAT: sys.exit("нет TELEGRAM_BOT_TOKEN/TELEGRAM_CHAT_ID")
    r=json.load(open(a.report,encoding="utf-8")) if a.report and os.path.exists(a.report) else {}
    cap=caption(r)
    # обложка отдельным фото (превью), затем видео с полным описанием
    if a.cover and os.path.exists(a.cover):
        try: _post("sendPhoto", {"chat_id":CHAT,"caption":"Обложка ролика"}, "photo", a.cover)
        except Exception as e: sys.stderr.write(f"[cover fail: {e}]\n")
    res=_post("sendVideo", {"chat_id":CHAT,"caption":cap,"supports_streaming":"true"}, "video", a.reel)
    print("ОПУБЛИКОВАНО В БОТА ✓" if res.get("ok") else res)

if __name__=="__main__": main()
