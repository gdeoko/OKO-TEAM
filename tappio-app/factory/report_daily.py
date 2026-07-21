#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
ЕЖЕДНЕВНЫЙ ОТЧЁТ (10:00 МСК) — реальные метрики опубликованных роликов.
Источник: YouTube (живые просмотры/лайки/комменты через yt-dlp по нашим shorts из
posted_reels.json). Считает суммарно + прирост со вчера (snapshot) + прогресс к цели
(100M просмотров, 500 роликов к 31.08). Документ -> бота @tappiorder_bot.

Честные пределы: TikTok/IG без открытого API метрик тут не тянутся (IG сессия+нет API,
TikTok — через Hooppy отдельно); поэтому раздел «по соцсети» пока = YouTube (реальные цифры),
остальные помечаются как «см. кабинет / нужен доступ». Не выдумываем числа.

Использование: python3 report_daily.py
"""
import json, os, subprocess, time, urllib.parse
HERE = os.path.dirname(os.path.abspath(__file__))
REG = os.path.join(HERE, "posted_reels.json")
SNAP = os.path.join(HERE, "analysis", "analytics_snap.json")
os.makedirs(os.path.join(HERE, "analysis"), exist_ok=True)

def load(p, d):
    try: return json.load(open(p))
    except Exception: return d

def yt_stats(vid):
    fmt = "%(view_count)s\t%(like_count)s\t%(comment_count)s\t%(title)s"
    try:
        out = subprocess.run(["yt-dlp","--skip-download","--no-warnings","--print",fmt,
                              f"https://www.youtube.com/shorts/{vid}"],
                             capture_output=True, text=True, timeout=60).stdout.strip()
        p = out.split("\t")
        def num(x):
            try: return int(x)
            except: return 0
        return dict(views=num(p[0]), likes=num(p[1] if len(p)>1 else 0), comments=num(p[2] if len(p)>2 else 0),
                    title=(p[3] if len(p)>3 else "")[:60])
    except Exception:
        return None

def main():
    reg = load(REG, {})
    snap = load(SNAP, {})
    yt_items = [(rid, e) for rid, e in reg.items() if e.get("yt_id")]
    rows = []
    tot_v = tot_l = tot_c = 0
    for rid, e in yt_items:
        st = yt_stats(e["yt_id"])
        time.sleep(0.6)
        if not st: continue
        prev = snap.get(e["yt_id"], {}).get("views", 0)
        dv = st["views"] - prev
        rows.append((rid, e["yt_id"], st, dv, e.get("app","")))
        tot_v += st["views"]; tot_l += st["likes"]; tot_c += st["comments"]
        snap[e["yt_id"]] = {"views": st["views"], "likes": st["likes"]}
    json.dump(snap, open(SNAP, "w"))

    total_reels = len(reg)
    L = []
    L.append("<b>📊 TAPPIO · аналитика за сутки (10:00 МСК)</b>")
    L.append(f"Роликов опубликовано всего: <b>{total_reels}</b> · цель к 31.08: 500")
    L.append("")
    L.append("<b>YouTube (живые метрики):</b>")
    L.append(f"Сумма: <b>{tot_v:,}</b> просм · {tot_l:,} лайк · {tot_c:,} комм".replace(",", " "))
    L.append(f"Прогресс к 100M просмотров: <b>{tot_v/1_000_000:.2f}M</b>")
    L.append("")
    rows.sort(key=lambda r: -r[2]["views"])
    for rid, vid, st, dv, app in rows[:12]:
        arrow = f"(+{dv:,})".replace(",", " ") if dv > 0 else ""
        L.append(f"• {app} {rid}: <b>{st['views']:,}</b>👁 {arrow} · {st['likes']}❤ · {st['comments']}💬 · youtu.be/{vid}".replace(",", " "))
    if not rows:
        L.append("<i>Пока нет роликов с записанным YouTube-id (появятся со следующих публикаций).</i>")
    L.append("")
    # Instagram — наши опубликованные рилы (из реестра, реальные ссылки на tappio.pro)
    ig_items = [(rid, e) for rid, e in reg.items() if e.get("ig_code")]
    L.append(f"<b>Instagram (@tappio.pro):</b> опубликовано рилов: <b>{len(ig_items)}</b>")
    for rid, e in ig_items[-8:]:
        L.append(f"• {e.get('app','')} {rid}: instagram.com/reel/{e['ig_code']}")
    L.append("<i>IG-просмотры/лайки — в кабинете аккаунта; ссылки выше кликабельны.</i>")
    L.append("<b>TikTok:</b> метрики — в кабинете Hooppy.")
    L.append("<i>Цифры YouTube реальные, с площадки. Ничего не выдумано.</i>")
    doc = "\n".join(L)

    tok = os.environ.get("TAPPIO_ANALYTICS_BOT_TOKEN"); chat = os.environ.get("TAPPIO_ANALYTICS_CHAT_ID", "1966985736")
    ca = "/root/.ccr/ca-bundle.crt"
    if tok:
        for i in range(0, len(doc), 3800):
            data = urllib.parse.urlencode({"chat_id": chat, "text": doc[i:i+3800], "parse_mode": "HTML",
                                           "disable_web_page_preview": "true"}).encode().decode()
            try: subprocess.run(["curl","-s","--cacert",ca,"-m","25",
                                 f"https://api.telegram.org/bot{tok}/sendMessage","--data",data],
                                capture_output=True, timeout=30)
            except Exception: pass
            time.sleep(0.5)
    print(f"REPORT sent: reels={total_reels} yt_tracked={len(rows)} total_views={tot_v}")

if __name__ == "__main__":
    main()
