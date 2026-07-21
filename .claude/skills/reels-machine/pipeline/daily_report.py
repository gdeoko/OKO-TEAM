#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
СТАДИЯ 5 — ЕЖЕДНЕВНЫЙ ОТЧЁТ 10:00 МСК в бота.
Самодостаточно: свежий разбор топ-конкурентов ниши (всегда РАЗНЫЕ — дедуп-реестр) →
метрики+транскрипт+раскадровка → авто-документ → в Telegram-бота. Плюс сводка завода.

Запуск (крон/рутина 07:00 UTC = 10:00 МСК):
  export TELEGRAM_BOT_TOKEN=... TELEGRAM_CHAT_ID=... HF_TOKEN=...
  python daily_report.py "ниша ключевые слова"
"""
import os, sys, json, subprocess, datetime

HERE=os.path.dirname(os.path.abspath(__file__))
RES=os.path.join(HERE,"research")

def sh(cmd, **kw):
    return subprocess.run(cmd, capture_output=True, text=True, timeout=kw.get("t",600))

def main():
    niche=sys.argv[1] if len(sys.argv)>1 else "нейросети программирование"
    date=(datetime.datetime.utcnow()+datetime.timedelta(hours=3)).strftime("%d.%m.%Y")
    out=os.path.join("/tmp",f"daily_{date.replace('.','')}"); os.makedirs(out,exist_ok=True)
    # 1) свежий разбор конкурентов (разные — дедуп внутри discover)
    sh([sys.executable, os.path.join(RES,"discover.py"), niche,
        "--queries", "нейросети|chatgpt|ии для бизнеса|midjourney|автоматизация",
        "--n","5","--min-views","1000000","--outdir",out], t=700)
    rj=os.path.join(out,"research.json")
    R=json.load(open(rj)) if os.path.exists(rj) else []
    # 2) авто-анализ + документ
    A={}
    for it in R:
        A[it["id"]]={"hook":"Обложка/заголовок: "+((it.get("title") or "")[:60]),
            "script":"Транскрипт: "+((it.get("transcript") or "—")[:280]),
            "funnel":"Описание: "+((it.get("description") or "—")[:160]),
            "why_viral":f"{it.get('views')} просмотров.","product":"—",
            "borrow":"Разобрать хук/ритм под наш дев/ИИ-контент."}
    A["synthesis"]=f"Утренний разбор {len(R)} свежих конкурентов ниши на {date}. Форматы и хуки — основа сценариев дня."
    aj=os.path.join(out,"analysis.json"); json.dump(A,open(aj,"w"),ensure_ascii=False)
    html=os.path.join(out,"daily.html"); pdf=os.path.join(out,"daily.pdf")
    sh([sys.executable, os.path.join(RES,"report.py"), rj, aj, html, "--pdf", pdf,
        "--accent","#EA5920","--niche",f"{niche} · утро {date}"], t=180)
    # 3) в бота: сводка-текст + документ
    tok=os.environ.get("TELEGRAM_BOT_TOKEN"); chat=os.environ.get("TELEGRAM_CHAT_ID")
    if not tok or not chat: print("нет токенов бота"); return
    import urllib.request, urllib.parse
    top=", ".join(f"{it.get('channel')}({it.get('views')})" for it in R[:3]) or "—"
    txt=(f"☀️ V.CODE — утренний отчёт {date}\n\n"
         f"Разобрано свежих конкурентов 1М+: {len(R)}\n"
         f"Топ дня: {top}\n\n"
         f"Полная аналитика — документом ниже. На её основе собираю ролики дня "
         f"(голос Владимира 1.8×, всё с нуля, без повторов).")
    urllib.request.urlopen(urllib.request.Request(
        f"https://api.telegram.org/bot{tok}/sendMessage",
        data=urllib.parse.urlencode({"chat_id":chat,"text":txt}).encode()), timeout=60)
    doc=pdf if os.path.exists(pdf) else (html if os.path.exists(html) else None)
    if doc:
        sh([sys.executable, os.path.join(RES,"send_to_bot.py"),"doc",doc,f"Аналитика конкурентов — {date}"], t=180)
    print(f"отчёт отправлен: {len(R)} конкурентов, doc={bool(doc)}")

if __name__=="__main__": main()
