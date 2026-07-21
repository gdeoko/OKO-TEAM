#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
СТАДИЯ 1 (часть B) — из research.json + анализа (analysis.json) собрать КРАСИВЫЙ
документ-аналитику (HTML→PDF) для отправки в бота.
analysis.json (заполняет Claude, читая раскадровки/транскрипты):
  {"<id>": {"hook":"...", "script":"...", "funnel":"...", "why_viral":"...",
            "product":"...", "borrow":"..."}, "synthesis":"общий вывод и связка с V.CODE"}
  python report.py research.json analysis.json out.html [--pdf out.pdf] [--accent "#EA5920"]
"""
import os, sys, json, argparse, subprocess, datetime

def hnum(n):
    try: n=float(n)
    except: return "—"
    for u,d in [("M",1e6),("K",1e3)]:
        if n>=d: return f"{n/d:.1f}{u}".replace(".0","")
    return str(int(n))

def er(it):
    v=it.get("views") or 0; l=it.get("likes") or 0; c=it.get("comments") or 0
    return f"{100*(l+c)/v:.1f}%" if v else "—"

def card(it, an, accent):
    sb=it.get("storyboard")
    img=f'<img src="file://{sb}" style="width:100%;border-radius:10px;margin:8px 0">' if sb and os.path.exists(sb) else ""
    rows=[("Просмотры",hnum(it.get("views"))),("Лайки",hnum(it.get("likes"))),
          ("Комменты",hnum(it.get("comments"))),("Вовлечённость",er(it)),
          ("Подписчиков",hnum(it.get("followers"))),("Длит.",f'{it.get("duration","—")}с')]
    metrics="".join(f'<div class="m"><b>{v}</b><span>{k}</span></div>' for k,v in rows)
    fields=[("Хук",an.get("hook")),("Сценарий",an.get("script")),("Воронка продаж",an.get("funnel")),
            ("Почему залетел",an.get("why_viral")),("Продукт",an.get("product")),
            ("Что забрать нам",an.get("borrow"))]
    body="".join(f'<div class="f"><h4>{k}</h4><p>{v or "—"}</p></div>' for k,v in fields if v)
    return f'''<div class="card">
      <div class="ch">{it.get("channel","—")} · <a href="{it.get("url")}">{it.get("id")}</a></div>
      <div class="ti">{it.get("title","")}</div>
      {img}<div class="metrics">{metrics}</div>{body}</div>'''

def main():
    ap=argparse.ArgumentParser()
    ap.add_argument("research"); ap.add_argument("analysis"); ap.add_argument("out")
    ap.add_argument("--pdf",default=None); ap.add_argument("--accent",default="#EA5920")
    ap.add_argument("--niche",default=""); a=ap.parse_args()
    R=json.load(open(a.research)); A=json.load(open(a.analysis)) if os.path.exists(a.analysis) else {}
    ac=a.accent; date=datetime.date.today().isoformat()
    cards="".join(card(it, A.get(it["id"],{}), ac) for it in R)
    syn=A.get("synthesis","")
    html=f'''<!doctype html><meta charset=utf-8><style>
    @import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Montserrat:wght@400;600;800&display=swap');
    body{{background:#0a0a0a;color:#f2f2f2;font-family:Montserrat,sans-serif;margin:0;padding:32px}}
    h1{{font-family:'Bebas Neue';font-size:52px;letter-spacing:1px;margin:0;color:{ac}}}
    .sub{{color:#888;margin:4px 0 24px;font-size:14px}}
    .card{{background:#141414;border:1px solid #262626;border-left:4px solid {ac};border-radius:14px;padding:20px;margin:18px 0}}
    .ch{{color:{ac};font-weight:600;font-size:13px}} .ch a{{color:#888}}
    .ti{{font-weight:800;font-size:19px;margin:6px 0 4px}}
    .metrics{{display:grid;grid-template-columns:repeat(6,1fr);gap:8px;margin:12px 0}}
    .m{{background:#0d0d0d;border-radius:8px;padding:8px;text-align:center}}
    .m b{{display:block;font-size:18px;color:{ac}}} .m span{{font-size:10px;color:#888;text-transform:uppercase}}
    .f{{margin:10px 0}} .f h4{{margin:0 0 3px;font-size:12px;color:{ac};text-transform:uppercase;letter-spacing:.5px}}
    .f p{{margin:0;font-size:14px;line-height:1.5;color:#ddd}}
    .syn{{background:{ac};color:#0a0a0a;border-radius:14px;padding:22px;margin-top:26px}}
    .syn h2{{font-family:'Bebas Neue';font-size:30px;margin:0 0 8px}} .syn p{{margin:0;font-weight:600;line-height:1.6}}
    </style>
    <h1>V.CODE · АНАЛИЗ КОНКУРЕНТОВ</h1>
    <div class=sub>{a.niche} · {date} · разобрано роликов: {len(R)} · порог: 1M+ просмотров</div>
    {cards}
    {'<div class=syn><h2>ВЫВОД И СВЯЗКА С V.CODE</h2><p>'+syn+'</p></div>' if syn else ''}'''
    open(a.out,"w").write(html)
    if a.pdf:
        try:
            subprocess.run(["chromium","--headless","--no-sandbox","--disable-gpu",
                f"--print-to-pdf={a.pdf}","--no-pdf-header-footer",f"file://{os.path.abspath(a.out)}"],
                capture_output=True,timeout=90)
        except Exception as e: sys.stderr.write(f"[pdf fail: {e}]\n")
    print(a.pdf or a.out)
if __name__=="__main__": main()
