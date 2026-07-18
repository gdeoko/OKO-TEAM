#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Премиум тёмный дашборд «Система OKO» для проекта Кластер."""
import json, html, os

BASE = "/home/user/OKO-TEAM/klaster_project"
SCRATCH = "/tmp/claude-0/-home-user-OKO-TEAM/e9dade84-4efa-54bc-ab59-8461d2f37b40/scratchpad"
RES = f"{BASE}/05_working_notes/research"

FONTS = open(f"{BASE}/03_deliverables/website/assets/css/fonts.css").read()
EMBLEM = open(f"{SCRATCH}/web_emblem256.txt").read().strip()
LOGO = open(f"{SCRATCH}/web_logo512.txt").read().strip()

def esc(s): return html.escape(str(s or ""))

# ---------- data ----------
content = json.load(open(f"{SCRATCH}/content.json", encoding="utf-8"))
competitors = json.load(open(f"{RES}/competitors_all.json", encoding="utf-8"))
try: calendar = json.load(open(f"{SCRATCH}/calendar.json", encoding="utf-8"))
except Exception: calendar = {"days": []}

SECTION_ORDER = ["overview","strategy","audience","niche","competitors","sites","radialnya","content","calendar","seo","roadmap","kpi","questions"]
LABELS = {
 "overview":"Обзор проекта","strategy":"Стратегия","audience":"Целевая аудитория","niche":"Ниша и тренды",
 "competitors":"110 конкурентов","sites":"Сайты конкурентов","radialnya":"Аудит @radialnya",
 "content":"Контент-план","calendar":"Календарь","seo":"SEO-ядро","roadmap":"Дорожная карта","kpi":"KPI","questions":"Вопросы клиенту"}

# ---------- svg icons (line, brand) ----------
IC = {
 "overview":'<path d="M3 12l9-8 9 8"/><path d="M5 10v10h14V10"/>',
 "strategy":'<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3"/>',
 "audience":'<circle cx="9" cy="8" r="3"/><path d="M3 20a6 6 0 0112 0"/><circle cx="17" cy="9" r="2.4"/><path d="M15 20a5 5 0 016-4"/>',
 "niche":'<path d="M3 17l5-5 4 4 8-8"/><path d="M16 4h5v5"/>',
 "competitors":'<rect x="3" y="4" width="7" height="7" rx="1.5"/><rect x="14" y="4" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>',
 "sites":'<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 9h18"/><circle cx="6" cy="6.5" r=".6"/><circle cx="8.4" cy="6.5" r=".6"/>',
 "radialnya":'<path d="M21 5L2 12l7 2 2 7 3-5 5 4z"/>',
 "content":'<rect x="4" y="3" width="16" height="18" rx="2"/><path d="M8 8h8M8 12h8M8 16h5"/>',
 "calendar":'<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 9h18M8 3v4M16 3v4"/>',
 "seo":'<circle cx="11" cy="11" r="7"/><path d="M21 21l-4-4"/>',
 "roadmap":'<path d="M4 20c4 0 4-6 8-6s4 6 8 6"/><circle cx="4" cy="20" r="1.6"/><circle cx="12" cy="14" r="1.6"/><circle cx="20" cy="20" r="1.6"/>',
 "kpi":'<path d="M4 20V10M10 20V4M16 20v-7M22 20V7"/>',
 "questions":'<circle cx="12" cy="12" r="9"/><path d="M9.5 9a2.5 2.5 0 013.9-2c1.5 1 .9 3-.9 3.6-.7.3-1 .8-1 1.6"/><circle cx="12" cy="17" r=".7"/>',
 "arrow":'<path d="M7 17L17 7M17 7H8M17 7V16"/>',
 "search":'<circle cx="11" cy="11" r="7"/><path d="M21 21l-4-4"/>',
}
def icon(name, cls="ic"): return f'<svg class="{cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">{IC.get(name,"")}</svg>'

PLAT = {"site":"Сайт","youtube":"YouTube","instagram":"Instagram","telegram":"Telegram","tiktok":"TikTok","vc":"VC/РБК","media":"Медиа"}

# ---------- renderers ----------
def kpis_html(kpis):
    if not kpis: return ""
    out=['<div class="kpis">']
    for k in kpis:
        val=esc(k.get("value","")); num="".join(c for c in k.get("value","") if c in "0123456789")
        out.append(f'''<div class="kpi rv"><div class="kpi-v" data-target="{esc(num)}" data-raw="{val}">{val}</div>
        <div class="kpi-l">{esc(k.get("label",""))}</div>{f'<div class="kpi-s">{esc(k.get("sub"))}</div>' if k.get("sub") else ""}</div>''')
    out.append('</div>'); return "".join(out)

def cards_html(cards):
    if not cards: return ""
    out=['<div class="cards">']
    for c in cards:
        out.append(f'''<article class="card rv"><span class="tag">{esc(c.get("tag",""))}</span>
        <h3>{esc(c.get("title",""))}</h3><p>{esc(c.get("body",""))}</p></article>''')
    out.append('</div>'); return "".join(out)

def highlights_html(hs):
    if not hs: return ""
    out=['<div class="hl rv"><div class="hl-h">Ключевое</div><ul>']
    for h in hs: out.append(f'<li>{esc(h)}</li>')
    out.append('</ul></div>'); return "".join(out)

def infographic_html(ig):
    if not ig or not ig.get("items"): return ""
    kind=ig.get("kind","bars"); items=ig["items"]; title=esc(ig.get("title",""))
    body=""
    if kind in ("bars","donut"):
        # normalize numeric values for bar length
        nums=[]
        for it in items:
            v=str(it.get("value","")); n="".join(ch for ch in v if ch in "0123456789")
            nums.append(float(n) if n else 0)
        mx=max(nums) if any(nums) else 1
        rows=[]
        for it,n in zip(items,nums):
            pct=int(12+ (n/mx)*88) if mx else 40
            rows.append(f'''<div class="bar-row"><div class="bar-top"><span>{esc(it.get("label",""))}</span><b>{esc(it.get("value",""))}</b></div>
            <div class="bar-tr"><i class="bar-fill" style="--w:{pct}%"></i></div>{f'<div class="bar-note">{esc(it.get("note"))}</div>' if it.get("note") else ""}</div>''')
        body=f'<div class="bars">{"".join(rows)}</div>'
    elif kind=="funnel":
        rows=[]
        for i,it in enumerate(items):
            w=100-i*(70//max(1,len(items)))
            rows.append(f'''<div class="fn-row rv"><div class="fn-bar" style="--w:{max(28,w)}%"><span>{esc(it.get("label",""))}</span><b>{esc(it.get("value",""))}</b></div>
            {f'<div class="fn-note">{esc(it.get("note"))}</div>' if it.get("note") else ""}</div>''')
        body=f'<div class="funnel">{"".join(rows)}</div>'
    elif kind=="timeline":
        rows=[]
        for it in items:
            rows.append(f'''<div class="tl-row rv"><div class="tl-dot"></div><div class="tl-body"><div class="tl-top"><b>{esc(it.get("label",""))}</b><span>{esc(it.get("value",""))}</span></div>
            {f'<p>{esc(it.get("note"))}</p>' if it.get("note") else ""}</div></div>''')
        body=f'<div class="timeline">{"".join(rows)}</div>'
    elif kind=="steps":
        rows=[]
        for i,it in enumerate(items,1):
            rows.append(f'''<div class="step rv"><div class="step-n">{i:02d}</div><div><b>{esc(it.get("label",""))}</b>
            <span>{esc(it.get("value",""))}</span>{f'<p>{esc(it.get("note"))}</p>' if it.get("note") else ""}</div></div>''')
        body=f'<div class="steps">{"".join(rows)}</div>'
    else:
        body=""
    return f'<div class="ig rv"><div class="ig-h">{title}</div>{body}</div>'

SECTION_SUB={"strategy":"Позиционирование, УТП, оффер, воронка","audience":"Сегменты, боли, путь клиента","niche":"Тренды 2026, форматы, окно","competitors":"110 площадок, 9 сегментов","sites":"Чек-лист «сделать лучше»","radialnya":"Аудит и перезапуск канала","content":"Рубрикатор и объёмы","calendar":"Месяц 1 по дням","seo":"Кластеры запросов, посадочные","roadmap":"90 дней по этапам","kpi":"Метрики и цели","questions":"Что уточнить у клиента"}
def launcher_grid():
    tiles=[]
    for sid in SECTION_ORDER:
        if sid=="overview": continue
        i=SECTION_ORDER.index(sid)+1
        tiles.append(f'''<button class="lch rv" data-go="{sid}"><span class="lch-ic">{icon(sid,"ic")}</span>
        <span class="lch-n">{i:02d}</span><span class="lch-t">{esc(LABELS[sid])}</span>
        <span class="lch-s">{esc(SECTION_SUB.get(sid,""))}</span><span class="lch-a">{icon("arrow","ic-sm")}</span></button>''')
    return f'<h2 class="sub">Разделы штаба</h2><div class="launch">{"".join(tiles)}</div>'

def section_generic(sid):
    d=content.get(sid,{})
    parts=[f'<p class="lead rv">{esc(d.get("intro",""))}</p>']
    parts.append(kpis_html(d.get("kpis")))
    parts.append(infographic_html(d.get("infographic")))
    parts.append(cards_html(d.get("cards")))
    parts.append(highlights_html(d.get("highlights")))
    if sid=="overview": parts.append(launcher_grid())
    return "".join(parts)

def platform_chart():
    from collections import Counter
    names={"site":"Сайты","telegram":"Telegram","youtube":"YouTube","instagram":"Instagram","vc":"VC.ru","rbc":"РБК","tiktok":"TikTok","dzen":"Дзен","media":"Медиа"}
    cnt=Counter(c.get("platform","") for c in competitors)
    items=[{"label":names.get(k,k),"value":str(v)} for k,v in cnt.most_common()]
    return infographic_html({"title":"Распределение 110 конкурентов по платформам","kind":"bars","items":items})

def section_competitors():
    d=content.get("competitors",{})
    cats=[]
    for c in competitors:
        if c["category"] not in cats: cats.append(c["category"])
    short={cat:cat.split(":")[0].strip() if ":" in cat else cat for cat in cats}
    chips=['<button class="chip active" data-cat="all">Все · %d</button>'%len(competitors)]
    for cat in cats:
        n=sum(1 for c in competitors if c["category"]==cat)
        chips.append(f'<button class="chip" data-cat="{esc(cat)}">{esc(short[cat])} · {n}</button>')
    cards=[]
    for c in competitors:
        borrow=c.get("borrow",""); rel=c.get("relevance","")
        cards.append(f'''<article class="ccard rv" data-cat="{esc(c["category"])}" data-txt="{esc((c.get("name","")+" "+c.get("positioning","")+" "+borrow).lower())}">
        <div class="cc-top"><span class="cc-plat">{esc(PLAT.get(c.get("platform",""),c.get("platform","")))}</span>{f'<span class="cc-aud">{esc(c.get("audience",""))}</span>' if c.get("audience") else ""}</div>
        <h3>{esc(c.get("name",""))}</h3>
        <p class="cc-pos">{esc(c.get("positioning",""))}</p>
        {f'<div class="cc-borrow"><span>Перенести в Кластер</span>{esc(borrow)}</div>' if borrow else ""}
        {f'<a class="cc-link" href="{esc(c.get("url"))}" target="_blank" rel="noopener">Открыть источник {icon("arrow","ic-sm")}</a>' if c.get("url") else ""}
        </article>''')
    insights=""
    ins=content.get("_insights",{}).get("segments") if isinstance(content.get("_insights"),dict) else None
    if ins:
        rows="".join(f'<div class="card rv"><span class="tag">{esc(s.get("segment",""))}</span><h3>Инсайт</h3><p>{esc(s.get("insight",""))}</p><div class="cc-borrow"><span>Перенести</span>{esc(s.get("borrow",""))}</div></div>' for s in ins)
        insights=f'<h2 class="sub">Инсайты по сегментам</h2><div class="cards">{rows}</div>'
    return f'''<p class="lead rv">{esc(d.get("intro","110 реальных площадок и аккаунтов с проверенными ссылками, честной оценкой и разбором «что перенести в Кластер»."))}</p>
    {kpis_html(d.get("kpis") or [{"value":"110","label":"конкурентов"},{"value":"9","label":"сегментов"},{"value":"100%","label":"проверенные ссылки"}])}
    {platform_chart()}
    <div class="cbar"><div class="chips">{"".join(chips)}</div>
    <div class="cc-search">{icon("search","ic-sm")}<input id="ccq" placeholder="Поиск по названию, позиционированию, приёму"></div></div>
    <div class="ccount" id="ccount"></div>
    <div class="ccards" id="ccards">{"".join(cards)}</div>
    {insights}'''

def section_calendar():
    days=calendar.get("days",[])
    tcolors={"reels":"reels","post":"post","carousel":"carousel","article":"article","story":"story","live":"live"}
    tnames={"reels":"Reels","post":"Пост","carousel":"Карусель","article":"Статья","story":"Stories","live":"Эфир"}
    # legend
    leg="".join(f'<span class="lg lg-{v}"><i></i>{tnames[k]}</span>' for k,v in tcolors.items())
    cells=[]
    # weekday headers
    wd=["Пн","Вт","Ср","Чт","Пт","Сб","Вс"]
    heads="".join(f'<div class="cal-wd">{w}</div>' for w in wd)
    byday={d["day"]:d.get("items",[]) for d in days}
    # month 1 = 30 days, start Mon for simplicity
    for d in range(1,31):
        items=byday.get(d,[])
        dots="".join(f'<i class="dot dot-{tcolors.get(it.get("type"),"post")}" title="{esc(it.get("title",""))}"></i>' for it in items[:4])
        titles="".join(f'<div class="cal-it it-{tcolors.get(it.get("type"),"post")}">{esc(it.get("title",""))[:34]}</div>' for it in items[:2])
        cells.append(f'''<div class="cal-cell {'has' if items else ''} rv"><div class="cal-d">{d}</div><div class="cal-dots">{dots}</div><div class="cal-its">{titles}</div></div>''')
    total=sum(len(v) for v in byday.values())
    return f'''<p class="lead rv">Контент-план месяца 1 в виде календаря. Цвет — формат, наведение — тема. Всего единиц в месяце: {total}.</p>
    <div class="cal-legend rv">{leg}</div>
    <div class="cal-grid rv">{heads}{"".join(cells)}</div>'''

def render_section(sid):
    if sid=="competitors": inner=section_competitors()
    elif sid=="calendar": inner=section_calendar()
    else: inner=section_generic(sid)
    idx=SECTION_ORDER.index(sid)+1
    return f'''<section id="sec-{sid}" class="sec"><div class="sec-head rv"><div class="sec-num">{idx:02d}</div><div><div class="eyebrow">Система OKO · 90 дней</div><h1>{esc(LABELS[sid])}</h1></div></div>{inner}</section>'''

nav="".join(f'''<a class="nav" data-sec="{sid}"><span class="nav-ic">{icon(sid,"ic")}</span><span class="nav-n">{i+1:02d}</span><span class="nav-t">{esc(LABELS[sid])}</span></a>''' for i,sid in enumerate(SECTION_ORDER))
sections="".join(render_section(sid) for sid in SECTION_ORDER)

CSS = r"""
*{margin:0;padding:0;box-sizing:border-box}
:root{
 --bg:#08090b;--bg2:#0c0e12;--panel:#101318;--panel2:#151922;--card:#12151b;
 --line:rgba(255,255,255,.07);--line2:rgba(255,255,255,.12);
 --gold:#E9B84A;--gold2:#C9982E;--amber:#E8A400;--gold-soft:rgba(233,184,74,.12);--gold-glow:rgba(233,184,74,.28);
 --ink:#EEF0F3;--ink2:#C6CAD2;--muted:#8A909B;--muted2:#5e646e;
 --ff-d:'Oswald',sans-serif;--ff:'Manrope',sans-serif;--sb:264px}
html{scroll-behavior:smooth}
body{background:var(--bg);color:var(--ink);font-family:var(--ff);line-height:1.6;-webkit-font-smoothing:antialiased;overflow-x:hidden}
#bgfx{position:fixed;inset:0;z-index:0;pointer-events:none}
.glow{position:fixed;z-index:0;pointer-events:none;filter:blur(80px);opacity:.5}
.glow.g1{top:-120px;right:-80px;width:520px;height:520px;background:radial-gradient(circle,rgba(233,184,74,.16),transparent 70%)}
.glow.g2{bottom:-160px;left:-100px;width:560px;height:560px;background:radial-gradient(circle,rgba(120,90,20,.14),transparent 70%)}
.app{position:relative;z-index:2;display:grid;grid-template-columns:var(--sb) 1fr;min-height:100vh}
/* sidebar */
.side{position:sticky;top:0;height:100vh;overflow-y:auto;background:linear-gradient(180deg,rgba(18,21,27,.9),rgba(10,12,15,.92));
 border-right:1px solid var(--line);backdrop-filter:blur(14px);padding:22px 14px;scrollbar-width:thin}
.side::-webkit-scrollbar{width:6px}.side::-webkit-scrollbar-thumb{background:rgba(255,255,255,.08);border-radius:3px}
.brand{display:flex;align-items:center;gap:11px;padding:6px 10px 16px;border-bottom:1px solid var(--line);margin-bottom:14px}
.brand img{width:38px;height:38px;object-fit:contain}
.brand .bt{font-family:var(--ff-d);font-weight:600;font-size:16px;letter-spacing:.04em;line-height:1}
.brand .bt small{display:block;font-family:var(--ff);font-weight:600;font-size:10px;letter-spacing:.18em;color:var(--gold);margin-top:4px;text-transform:uppercase}
.home{display:flex;align-items:center;gap:8px;color:var(--muted);font-size:12.5px;font-weight:600;text-decoration:none;padding:8px 10px;margin-bottom:8px;border-radius:9px}
.home:hover{color:var(--gold);background:var(--gold-soft)}
.nav{display:grid;grid-template-columns:26px 24px 1fr;align-items:center;gap:9px;padding:9px 10px;border-radius:10px;color:var(--ink2);
 text-decoration:none;cursor:pointer;transition:.16s;position:relative;margin-bottom:1px}
.nav .nav-ic{color:var(--muted);display:flex}.nav .ic{width:18px;height:18px}
.nav-n{font-family:var(--ff-d);font-size:12px;color:var(--muted2);letter-spacing:.05em}
.nav-t{font-size:13.5px;font-weight:600}
.nav:hover{background:rgba(255,255,255,.04);color:#fff}.nav:hover .nav-ic{color:var(--gold)}
.nav.active{background:linear-gradient(90deg,var(--gold-soft),transparent);color:#fff}
.nav.active:before{content:"";position:absolute;left:0;top:8px;bottom:8px;width:3px;border-radius:3px;background:var(--gold);box-shadow:0 0 12px var(--gold-glow)}
.nav.active .nav-ic{color:var(--gold)}.nav.active .nav-n{color:var(--gold)}
.side-foot{margin-top:16px;padding:12px 10px;border-top:1px solid var(--line);font-size:11px;color:var(--muted2);line-height:1.5}
/* topbar mobile */
.top{display:none;position:sticky;top:0;z-index:30;align-items:center;gap:12px;padding:12px 16px;
 background:rgba(10,12,15,.86);backdrop-filter:blur(14px);border-bottom:1px solid var(--line)}
.top img{width:30px;height:30px}.top .tt{font-family:var(--ff-d);font-size:15px;flex:1}
.burger{width:42px;height:38px;border:1px solid var(--line2);border-radius:9px;background:rgba(255,255,255,.03);display:grid;place-items:center;cursor:pointer}
.burger svg{width:20px;height:20px;stroke:var(--ink)}
.scrim{display:none;position:fixed;inset:0;z-index:25;background:rgba(0,0,0,.6);backdrop-filter:blur(2px)}
/* main */
main{min-width:0}
.wrap{max-width:1080px;margin:0 auto;padding:40px 40px 80px}
.sec{display:none;animation:fade .45s ease}
.sec.on{display:block}
@keyframes fade{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:none}}
.sec-head{display:flex;align-items:center;gap:18px;margin-bottom:22px}
.sec-num{font-family:var(--ff-d);font-weight:700;font-size:46px;color:transparent;-webkit-text-stroke:1.4px var(--gold2);line-height:.9;opacity:.85}
.eyebrow{font-size:11.5px;font-weight:700;letter-spacing:.22em;text-transform:uppercase;color:var(--gold)}
h1{font-family:var(--ff-d);font-weight:700;text-transform:uppercase;font-size:clamp(30px,4.4vw,50px);line-height:1;letter-spacing:.01em;margin-top:4px}
h2.sub{font-family:var(--ff-d);font-weight:600;font-size:24px;margin:34px 0 14px;letter-spacing:.02em}
.lead{font-size:17px;color:var(--ink2);max-width:760px;margin-bottom:26px}
/* kpis */
.kpis{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:14px;margin-bottom:26px}
.kpi{background:linear-gradient(180deg,var(--panel2),var(--card));border:1px solid var(--line);border-radius:16px;padding:18px 18px 16px;position:relative;overflow:hidden}
.kpi:before{content:"";position:absolute;top:0;left:0;right:0;height:2px;background:linear-gradient(90deg,var(--gold),transparent)}
.kpi-v{font-family:var(--ff-d);font-weight:700;font-size:34px;line-height:1;background:linear-gradient(180deg,#fff,var(--gold));-webkit-background-clip:text;background-clip:text;-webkit-text-fill-color:transparent}
.kpi-l{font-size:13px;color:var(--ink2);margin-top:7px;font-weight:600}
.kpi-s{font-size:11.5px;color:var(--muted);margin-top:3px}
/* cards */
.cards{display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:14px;margin-bottom:26px}
.card{background:var(--card);border:1px solid var(--line);border-radius:16px;padding:20px;transition:.2s;position:relative}
.card:hover{transform:translateY(-3px);border-color:rgba(233,184,74,.4);box-shadow:0 16px 40px rgba(0,0,0,.4),0 0 0 1px rgba(233,184,74,.15)}
.tag{display:inline-block;font-family:var(--ff-d);font-size:11px;letter-spacing:.1em;text-transform:uppercase;color:var(--gold);
 background:var(--gold-soft);border:1px solid rgba(233,184,74,.24);border-radius:20px;padding:4px 11px;margin-bottom:12px}
.card h3{font-family:var(--ff-d);font-weight:600;font-size:18px;margin-bottom:8px;letter-spacing:.01em}
.card p{font-size:14px;color:var(--ink2);line-height:1.6}
/* highlights */
.hl{background:linear-gradient(135deg,rgba(233,184,74,.06),transparent);border:1px solid var(--line);border-left:3px solid var(--gold);border-radius:0 16px 16px 0;padding:20px 24px;margin-bottom:26px}
.hl-h{font-family:var(--ff-d);text-transform:uppercase;letter-spacing:.14em;font-size:13px;color:var(--gold);margin-bottom:12px}
.hl ul{list-style:none;display:grid;gap:9px}
.hl li{font-size:14.5px;color:var(--ink2);padding-left:22px;position:relative}
.hl li:before{content:"";position:absolute;left:0;top:9px;width:8px;height:8px;background:var(--gold);border-radius:2px;transform:rotate(45deg)}
/* infographic */
.ig{background:var(--panel);border:1px solid var(--line);border-radius:18px;padding:24px;margin-bottom:26px}
.ig-h{font-family:var(--ff-d);font-weight:600;font-size:19px;margin-bottom:18px;letter-spacing:.02em}
.bars{display:grid;gap:15px}
.bar-top{display:flex;justify-content:space-between;font-size:13.5px;margin-bottom:6px}.bar-top b{font-family:var(--ff-d);color:var(--gold)}
.bar-tr{height:10px;background:rgba(255,255,255,.05);border-radius:6px;overflow:hidden}
.bar-fill{display:block;height:100%;width:0;border-radius:6px;background:linear-gradient(90deg,var(--gold2),var(--gold));box-shadow:0 0 14px var(--gold-glow);transition:width 1.1s cubic-bezier(.2,.8,.2,1)}
.sec.on .bar-fill{width:var(--w)}
.bar-note{font-size:12px;color:var(--muted);margin-top:5px}
.funnel{display:grid;gap:10px}
.fn-bar{display:flex;justify-content:space-between;align-items:center;padding:14px 18px;margin:0 auto;width:var(--w);min-width:180px;
 background:linear-gradient(90deg,rgba(233,184,74,.16),rgba(233,184,74,.05));border:1px solid rgba(233,184,74,.25);border-radius:12px;font-size:14px;transition:width .8s}
.fn-bar b{font-family:var(--ff-d);color:var(--gold)}.fn-note{text-align:center;font-size:12px;color:var(--muted);margin-top:2px}
.timeline{position:relative;padding-left:26px}
.timeline:before{content:"";position:absolute;left:7px;top:6px;bottom:6px;width:2px;background:linear-gradient(180deg,var(--gold),transparent)}
.tl-row{position:relative;padding:0 0 20px}
.tl-dot{position:absolute;left:-26px;top:4px;width:16px;height:16px;border-radius:50%;background:var(--gold);box-shadow:0 0 0 4px rgba(233,184,74,.15)}
.tl-top{display:flex;gap:12px;align-items:baseline}.tl-top b{font-family:var(--ff-d);font-size:16px}.tl-top span{color:var(--gold);font-size:13px}
.tl-body p{font-size:13.5px;color:var(--muted);margin-top:3px}
.steps{display:grid;gap:12px}
.step{display:grid;grid-template-columns:auto 1fr;gap:14px;align-items:start;padding:14px 16px;background:var(--card);border:1px solid var(--line);border-radius:12px}
.step-n{font-family:var(--ff-d);font-size:22px;color:var(--gold2)}
.step b{font-family:var(--ff-d);font-size:15px}.step span{color:var(--gold);font-size:12.5px;margin-left:8px}.step p{font-size:13px;color:var(--muted);margin-top:4px}
/* competitors */
.cbar{display:flex;flex-wrap:wrap;gap:14px;justify-content:space-between;align-items:center;margin-bottom:14px}
.chips{display:flex;flex-wrap:wrap;gap:8px}
.chip{font-family:var(--ff);font-size:12.5px;font-weight:600;color:var(--ink2);background:var(--panel2);border:1px solid var(--line);
 border-radius:20px;padding:7px 13px;cursor:pointer;transition:.15s}
.chip:hover{border-color:var(--line2);color:#fff}
.chip.active{background:var(--gold);color:#12130f;border-color:var(--gold)}
.cc-search{display:flex;align-items:center;gap:8px;background:var(--panel2);border:1px solid var(--line);border-radius:11px;padding:8px 13px;min-width:240px}
.cc-search input{background:none;border:0;outline:0;color:var(--ink);font-family:var(--ff);font-size:13.5px;width:100%}
.cc-search .ic-sm{width:16px;height:16px;color:var(--muted)}
.ccount{font-size:12.5px;color:var(--muted);margin-bottom:14px}
.ccards{display:grid;grid-template-columns:repeat(auto-fill,minmax(290px,1fr));gap:14px}
.ccard{background:var(--card);border:1px solid var(--line);border-radius:16px;padding:18px;transition:.18s;display:flex;flex-direction:column}
.ccard:hover{transform:translateY(-3px);border-color:rgba(233,184,74,.35);box-shadow:0 14px 34px rgba(0,0,0,.4)}
.cc-top{display:flex;justify-content:space-between;align-items:center;gap:8px;margin-bottom:10px}
.cc-plat{font-family:var(--ff-d);font-size:10.5px;letter-spacing:.1em;text-transform:uppercase;color:var(--gold);background:var(--gold-soft);border-radius:5px;padding:3px 8px}
.cc-aud{font-size:11px;color:var(--muted);text-align:right}
.ccard h3{font-family:var(--ff-d);font-weight:600;font-size:16.5px;margin-bottom:7px;line-height:1.15}
.cc-pos{font-size:13px;color:var(--ink2);line-height:1.55;margin-bottom:12px;flex:1}
.cc-borrow{font-size:12.5px;color:var(--ink2);background:rgba(255,255,255,.03);border:1px solid var(--line);border-radius:10px;padding:9px 11px;line-height:1.5}
.cc-borrow span{display:block;font-family:var(--ff-d);text-transform:uppercase;font-size:10px;letter-spacing:.1em;color:var(--gold);margin-bottom:3px}
.cc-link{display:inline-flex;align-items:center;gap:5px;margin-top:11px;font-family:var(--ff-d);font-size:12px;text-transform:uppercase;letter-spacing:.05em;color:var(--muted);text-decoration:none}
.cc-link:hover{color:var(--gold)}.cc-link .ic-sm{width:14px;height:14px}
/* calendar */
.cal-legend{display:flex;flex-wrap:wrap;gap:14px;margin-bottom:16px}
.lg{display:flex;align-items:center;gap:6px;font-size:12.5px;color:var(--ink2)}.lg i{width:11px;height:11px;border-radius:3px;display:block}
.lg-reels i{background:#E9B84A}.lg-post i{background:#4AA3E9}.lg-carousel i{background:#8B5CF6}.lg-article i{background:#2CB67D}.lg-story i{background:#E9694A}.lg-live i{background:#E94A8B}
.cal-grid{display:grid;grid-template-columns:repeat(7,1fr);gap:8px}
.cal-wd{font-family:var(--ff-d);font-size:12px;color:var(--muted);text-align:center;padding-bottom:4px;letter-spacing:.05em}
.cal-cell{min-height:92px;background:var(--card);border:1px solid var(--line);border-radius:12px;padding:9px 9px 8px;transition:.16s;position:relative}
.cal-cell.has{background:linear-gradient(180deg,var(--panel2),var(--card))}
.cal-cell.has:hover{border-color:rgba(233,184,74,.4);transform:translateY(-2px)}
.cal-d{font-family:var(--ff-d);font-size:14px;color:var(--ink2)}.cal-cell.has .cal-d{color:var(--gold)}
.cal-dots{display:flex;gap:3px;margin:5px 0}.dot{width:7px;height:7px;border-radius:2px;display:block}
.dot-reels{background:#E9B84A}.dot-post{background:#4AA3E9}.dot-carousel{background:#8B5CF6}.dot-article{background:#2CB67D}.dot-story{background:#E9694A}.dot-live{background:#E94A8B}
.cal-its{display:grid;gap:3px}
.cal-it{font-size:10.5px;line-height:1.3;color:var(--ink2);padding:3px 5px;border-radius:5px;background:rgba(255,255,255,.03);border-left:2px solid var(--muted2);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.it-reels{border-color:#E9B84A}.it-post{border-color:#4AA3E9}.it-carousel{border-color:#8B5CF6}.it-article{border-color:#2CB67D}.it-story{border-color:#E9694A}.it-live{border-color:#E94A8B}
/* launcher grid */
.launch{display:grid;grid-template-columns:repeat(auto-fill,minmax(240px,1fr));gap:12px}
.lch{display:grid;grid-template-columns:auto auto 1fr auto;grid-template-areas:"ic n t a" "ic n s a";column-gap:12px;align-items:center;
 text-align:left;background:var(--card);border:1px solid var(--line);border-radius:14px;padding:15px 16px;cursor:pointer;transition:.18s;font-family:var(--ff);color:var(--ink)}
.lch:hover{transform:translateY(-3px);border-color:rgba(233,184,74,.45);box-shadow:0 14px 34px rgba(0,0,0,.4)}
.lch-ic{grid-area:ic;color:var(--gold);display:flex}.lch-ic .ic{width:22px;height:22px}
.lch-n{grid-area:n;font-family:var(--ff-d);font-size:13px;color:var(--muted2)}
.lch-t{grid-area:t;font-family:var(--ff-d);font-weight:600;font-size:15.5px}
.lch-s{grid-area:s;font-size:11.5px;color:var(--muted)}
.lch-a{grid-area:a;color:var(--muted)}.lch:hover .lch-a{color:var(--gold)}.lch-a .ic-sm{width:16px;height:16px}
/* reveal */
.rv{opacity:0;transform:translateY(14px);transition:opacity .5s,transform .5s}
.rv.in{opacity:1;transform:none}
/* responsive */
@media(max-width:900px){
 :root{--sb:0px}
 .app{grid-template-columns:1fr}
 .side{position:fixed;top:0;left:0;width:280px;z-index:40;transform:translateX(-100%);transition:transform .28s}
 .side.open{transform:none}
 .scrim.show{display:block}
 .top{display:flex}
 .wrap{padding:22px 16px 70px}
 .sec-num{font-size:36px}
 .kpis{grid-template-columns:1fr 1fr}
 .cards,.ccards{grid-template-columns:1fr}
 .cal-grid{grid-template-columns:repeat(7,1fr);gap:4px}
 .cal-cell{min-height:64px;padding:5px}.cal-its{display:none}.cal-d{font-size:12px}
 .cbar{flex-direction:column;align-items:stretch}.cc-search{min-width:0}
}
@media(prefers-reduced-motion:reduce){*{animation:none!important;transition:none!important}.rv{opacity:1;transform:none}.bar-fill{transition:none}}
"""

JS = r"""
const order=%%ORDER%%;
const secs=[...document.querySelectorAll('.sec')], navs=[...document.querySelectorAll('.nav')];
const side=document.querySelector('.side'), scrim=document.querySelector('.scrim');
function reveal(sec){const els=sec.querySelectorAll('.rv');els.forEach((e,i)=>setTimeout(()=>e.classList.add('in'),40+i*45));}
function countup(sec){sec.querySelectorAll('.kpi-v').forEach(el=>{const t=+el.dataset.target;if(!t||t>100000){return}const raw=el.dataset.raw;const suf=raw.replace(/[0-9\s]/g,'');let n=0;const step=Math.max(1,Math.round(t/38));const id=setInterval(()=>{n+=step;if(n>=t){n=t;clearInterval(id)}el.textContent=n.toLocaleString('ru')+suf.replace(/^\d*/,'')},22);});}
function show(id,push){if(!order.includes(id))id=order[0];secs.forEach(s=>s.classList.toggle('on',s.id==='sec-'+id));
 navs.forEach(a=>a.classList.toggle('active',a.dataset.sec===id));
 const sec=document.getElementById('sec-'+id);if(sec){sec.querySelectorAll('.rv').forEach(e=>e.classList.remove('in'));reveal(sec);countup(sec);}
 window.scrollTo({top:0,behavior:'instant'in window?'instant':'auto'});if(push!==false)history.replaceState(0,'','#'+id);closeNav();}
navs.forEach(a=>a.addEventListener('click',e=>{e.preventDefault();show(a.dataset.sec)}));
document.addEventListener('click',e=>{const b=e.target.closest('[data-go]');if(b){e.preventDefault();show(b.dataset.go);}});
function openNav(){side.classList.add('open');scrim.classList.add('show')}
function closeNav(){side.classList.remove('open');scrim.classList.remove('show')}
document.querySelector('.burger')?.addEventListener('click',openNav);scrim?.addEventListener('click',closeNav);
show((location.hash||'').replace('#','')||order[0],false);
// competitors filter+search
const ccards=[...document.querySelectorAll('.ccard')];const ccount=document.getElementById('ccount');const ccq=document.getElementById('ccq');
let curCat='all';
function applyCC(){const q=(ccq?.value||'').trim().toLowerCase();let n=0;ccards.forEach(c=>{const okCat=curCat==='all'||c.dataset.cat===curCat;const okQ=!q||c.dataset.txt.includes(q);const ok=okCat&&okQ;c.style.display=ok?'':'none';if(ok)n++;});if(ccount)ccount.textContent='Показано: '+n;}
document.querySelectorAll('.chip').forEach(ch=>ch.addEventListener('click',()=>{document.querySelectorAll('.chip').forEach(x=>x.classList.remove('active'));ch.classList.add('active');curCat=ch.dataset.cat;applyCC();}));
ccq?.addEventListener('input',applyCC);applyCC();
// particles
const cv=document.getElementById('bgfx');if(cv&&!matchMedia('(prefers-reduced-motion:reduce)').matches){const cx=cv.getContext('2d');let W,H,P;
 function rs(){W=cv.width=innerWidth;H=cv.height=innerHeight;const n=innerWidth<900?26:60;P=Array.from({length:n},()=>({x:Math.random()*W,y:Math.random()*H,r:Math.random()*1.6+.3,vx:(Math.random()-.5)*.15,vy:(Math.random()-.5)*.15,a:Math.random()*.5+.15}));}
 rs();addEventListener('resize',rs);
 (function loop(){cx.clearRect(0,0,W,H);for(const p of P){p.x+=p.vx;p.y+=p.vy;if(p.x<0||p.x>W)p.vx*=-1;if(p.y<0||p.y>H)p.vy*=-1;cx.beginPath();cx.arc(p.x,p.y,p.r,0,7);cx.fillStyle='rgba(233,184,74,'+p.a+')';cx.fill();}requestAnimationFrame(loop);})();}
"""

BURGER='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M3 6h18M3 12h18M3 18h18"/></svg>'

doc=f"""<!DOCTYPE html><html lang="ru"><head><meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<title>Система OKO · Бизнес-парк «Кластер»</title>
<meta name="description" content="Интерактивный штаб проекта «Кластер»: стратегия, ЦА, ниша, 110 конкурентов, контент-план 90 дней, SEO, дорожная карта и KPI.">
<link rel="icon" href="data:image/png;base64,iVBORw0KGgo=">
<style>{FONTS}
{CSS}</style></head><body>
<canvas id="bgfx"></canvas><div class="glow g1"></div><div class="glow g2"></div>
<div class="top"><img src="{EMBLEM}" alt=""><div class="tt">Система OKO</div><button class="burger" aria-label="Меню">{BURGER}</button></div>
<div class="scrim"></div>
<div class="app">
<aside class="side">
 <div class="brand"><img src="{EMBLEM}" alt="Активити"><div class="bt">КЛАСТЕР<small>Система OKO</small></div></div>
 <a class="home" href="/">{icon("arrow","ic")} На главную витрины</a>
 <nav>{nav}</nav>
 <div class="side-foot">Бизнес-парк «Кластер» · ООО «Активити»<br>Подготовлено OKO TEAM · 2026</div>
</aside>
<main><div class="wrap">{sections}</div></main>
</div>
<script>{JS.replace('%%ORDER%%', json.dumps(SECTION_ORDER))}</script>
</body></html>"""

OUT=f"{SCRATCH}/sistema_v2.html"
open(OUT,"w",encoding="utf-8").write(doc)
print("written", OUT, len(doc)//1024, "KB")
