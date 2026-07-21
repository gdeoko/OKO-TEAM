#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Премиум-лендинг «Кластер» (светлый premium + кинематографичный тёмный hero)."""
import json, html, os
BASE="/home/user/OKO-TEAM/klaster_project"
SCRATCH="/tmp/claude-0/-home-user-OKO-TEAM/e9dade84-4efa-54bc-ab59-8461d2f37b40/scratchpad"
REPO=[d for d in os.listdir(SCRATCH) if d.startswith("mighty-melody-603-")][0]
PUB=f"{SCRATCH}/{REPO}/app/public"
FONTS=open(f"{BASE}/03_deliverables/website/assets/css/fonts.css").read()
EMBLEM=open(f"{SCRATCH}/web_emblem256.txt").read().strip()
IMG=json.load(open(f"{SCRATCH}/site_imgs.json"))
CAT=json.load(open(f"{SCRATCH}/site_catalog.json",encoding="utf-8"))
COPY={s["id"]:s for s in json.load(open(f"{SCRATCH}/sitecopy.json",encoding="utf-8"))["sections"]}
def esc(s): return html.escape(str(s or "").replace("—","-").replace("–","-"))
def C(sid,f,d=""): return COPY.get(sid,{}).get(f,d)
def bullets(sid): return COPY.get(sid,{}).get("bullets",[])

# icons
IC={
 "loc":'<path d="M12 21s-7-6.3-7-11a7 7 0 1114 0c0 4.7-7 11-7 11z"/><circle cx="12" cy="10" r="2.6"/>',
 "metro":'<rect x="5" y="4" width="14" height="12" rx="4"/><path d="M8 20l2-4M16 20l-2-4M6 10h12"/><circle cx="9" cy="12.5" r="1"/><circle cx="15" cy="12.5" r="1"/>',
 "power":'<path d="M13 2L4 14h7l-1 8 9-12h-7z"/>',
 "ceiling":'<path d="M3 4h18M6 4v10M18 4v10M6 14h12M9 14v6M15 14v6"/>',
 "load":'<path d="M4 20h16M7 20V9l5-4 5 4v11M10 20v-5h4v5"/>',
 "crane":'<path d="M4 21h16M6 21V4h9l4 4M6 8h9M12 8v6M12 14a2 2 0 100 4 2 2 0 000-4z"/>',
 "area":'<path d="M3 3h7v7H3zM14 3h7v7h-7zM3 14h7v7H3zM14 14h7v7h-7z"/>',
 "door":'<rect x="6" y="3" width="12" height="18" rx="1"/><circle cx="14.5" cy="12" r="1"/>',
 "park":'<rect x="4" y="4" width="16" height="16" rx="3"/><path d="M9 16V8h4a2.5 2.5 0 010 5H9"/>',
 "cafe":'<path d="M4 8h13v4a5 5 0 01-5 5H9a5 5 0 01-5-5zM17 9h2a2 2 0 010 4h-2M6 3v2M10 3v2M14 3v2"/>',
 "club":'<path d="M12 21s-7-4.5-7-10a4 4 0 017-2.6A4 4 0 0119 11c0 5.5-7 10-7 10z"/>',
 "cowork":'<rect x="3" y="5" width="18" height="12" rx="2"/><path d="M8 21h8M12 17v4"/>',
 "guard":'<path d="M12 3l7 3v5c0 5-3.5 8-7 10-3.5-2-7-5-7-10V6z"/><path d="M9.5 12l2 2 3.5-4"/>',
 "gas":'<rect x="6" y="9" width="9" height="11" rx="1"/><path d="M15 12h2a2 2 0 012 2v3a1.5 1.5 0 01-3 0M8 9V5a2 2 0 012-2h1a2 2 0 012 2v4"/>',
 "chip":'<rect x="7" y="7" width="10" height="10" rx="1.5"/><path d="M10 3v4M14 3v4M10 17v4M14 17v4M3 10h4M3 14h4M17 10h4M17 14h4"/>',
 "energy":'<path d="M13 2L4 14h7l-1 8 9-12h-7z"/>',
 "ict":'<rect x="3" y="4" width="18" height="12" rx="2"/><path d="M8 20h8M12 16v4"/>',
 "nano":'<circle cx="12" cy="12" r="3"/><ellipse cx="12" cy="12" rx="10" ry="4"/><ellipse cx="12" cy="12" rx="10" ry="4" transform="rotate(60 12 12)"/>',
 "med":'<path d="M12 5v14M5 12h14" stroke-width="2.4"/><rect x="3" y="3" width="18" height="18" rx="4"/>',
 "hi":'<path d="M4 20V8l8-5 8 5v12M9 20v-6h6v6"/>',
 "check":'<path d="M5 12l4 4 10-11"/>',
 "phone":'<path d="M5 4h4l2 5-3 2a12 12 0 005 5l2-3 5 2v4a2 2 0 01-2 2A16 16 0 013 6a2 2 0 012-2z"/>',
 "arrow":'<path d="M7 17L17 7M17 7H8M17 7V16"/>',
 "shield":'<path d="M12 3l7 3v5c0 5-3.5 8-7 10-3.5-2-7-5-7-10V6z"/>',
 "train":'<rect x="5" y="4" width="14" height="12" rx="3"/><path d="M8 20l2-4M16 20l-2-4"/>',
 "shuttle":'<rect x="3" y="6" width="18" height="9" rx="2"/><circle cx="7" cy="17" r="1.6"/><circle cx="17" cy="17" r="1.6"/><path d="M3 10h18"/>',
 "road":'<path d="M8 21L10 3M16 21L14 3M12 7v3M12 14v3"/>',
 "menu":'<path d="M3 6h18M3 12h18M3 18h18" stroke-width="2"/>',
 "close":'<path d="M6 6l12 12M18 6L6 18" stroke-width="2"/>',
 "chat":'<path d="M4 5h16v11H9l-4 3v-3H4z"/>',
}
def ic(n,w=22): return f'<svg class="ic" width="{w}" height="{w}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">{IC.get(n,"")}</svg>'

NAV=[("about","О комплексе"),("transport","Транспорт"),("specs","Параметры"),("infra","Инфраструктура"),("industries","Отрасли"),("catalog","Каталог"),("form","Заявка")]
def li(items): return "".join(f'<li>{ic("check",18)}<span>{esc(x)}</span></li>' for x in items)

# stat band
STATS=[("50000","м²","площадь комплекса"),("100","+","резидентов"),("1000","+","рабочих мест"),("6","","отраслей"),("5","МВт","мощность"),("550","","машиномест")]
statcards="".join(f'<div class="stat rv"><div class="stat-v"><span class="cnt" data-to="{v}">0</span>{esc(suf)}</div><div class="stat-l">{esc(l)}</div></div>' for v,suf,l in STATS)

# transport timeline
TRANS=[("train","Метро Каспийская","2027","7 минут пешком от комплекса"),
 ("metro","МЦД Котляково","2028","2 минуты пешком, линия Подольск - Нахабино"),
 ("shuttle","Шаттл от Царицыно","сейчас","бесплатный, около 15 минут"),
 ("road","МКАД и ТТК","","5 км от МКАД (~10 мин), 15 км от ТТК")]
transrows="".join(f'''<div class="tl rv"><div class="tl-ic">{ic(i,22)}</div><div class="tl-b"><div class="tl-h"><b>{esc(t)}</b>{f'<span class="tl-y">{esc(y)}</span>' if y else ''}</div><p>{esc(d)}</p></div></div>''' for i,t,y,d in TRANS)

# specs cards
SPECS=[("ceiling","Потолки 6-12 м","доступны лоты с 9 м"),("power","5 МВт на здание","до 100 кВт на помещение, с увеличением"),
 ("load","4000 кг/м²","нагрузка на перекрытия"),("crane","Кран-балка","2 лифта по 5 тонн"),
 ("area","100-12 000 м²","производство и склад; офисы 50-500 м²"),("door","Отдельные входы","ворота, офис и санузел в каждом блоке")]
speccards="".join(f'<div class="scard rv"><div class="s-ic">{ic(i,26)}</div><b>{esc(t)}</b><span>{esc(d)}</span></div>' for i,t,d in SPECS)

# infrastructure mosaic
INFRA=[("cafe","Кафе-столовая и кофейня","100 посадочных мест","cafe"),("club","КластерКлаб","раздевалки, душевые, зоны отдыха","cowork"),
 ("cowork","Коворкинг и переговорные","семинарские и конференц-зал","meeting"),("park","Парковка 550 м/м","удобная погрузка-разгрузка","facade"),
 ("guard","Охрана 24/7","видеонаблюдение, доступ круглосуточно","sport"),("gas","Инженерия","котельная, 3 провайдера, спортзоны","lobby")]
inframos="".join(f'''<div class="mtile rv" style="background-image:url({IMG.get(im,'')})"><div class="mt-ov"></div><div class="mt-c"><div class="mt-ic">{ic(i,22)}</div><b>{esc(t)}</b><span>{esc(d)}</span></div></div>''' for i,t,d,im in INFRA)

# industries
INDS=[("chip","Микроэлектроника","оптика и электронная аппаратура"),("energy","Энергоэффективность","современные технологии"),
 ("ict","ИКТ","информационно-коммуникационные технологии"),("nano","Материалы и нанотех","современные материалы"),
 ("med","Медтехнологии","оборудование и изделия"),("hi","Хайтек-производства","инновационные предприятия")]
indcards="".join(f'<div class="icard rv"><div class="i-ic">{ic(i,24)}</div><b>{esc(t)}</b><span>{esc(d)}</span></div>' for i,t,d in INDS)

# why
WHY=[("shield","Внутри МКАД, вне зоны КРТ","Долгосрочная аренда защищена от сноса промзон под жильё."),
 ("metro","Два метро строятся рядом","Каспийская 2027 и МЦД Котляково 2028 по периметру комплекса."),
 ("power","Инженерия под тяжёлое производство","Мощность, нагрузка и грузоподъёмность без компромиссов."),
 ("hi","Статус технопарка","Идёт процедура получения, впереди дополнительные возможности.")]
whycards="".join(f'<div class="wcard rv"><div class="w-ic">{ic(i,24)}</div><b>{esc(t)}</b><p>{esc(d)}</p></div>' for i,t,d in WHY)

# catalog
def catcard(it):
    params="".join(f'<span>{esc(p)}</span>' for p in it.get("params",[]))
    st=it.get("status","")
    return f'''<article class="ccard rv"><div class="cc-img" style="background-image:url({it.get("img_b64","")})"><span class="cc-st {'free' if 'вободно' in st else 'busy'}">{esc(st)}</span></div>
    <div class="cc-b"><h3>{esc(it.get("title",""))}</h3><div class="cc-params">{params}</div>
    <div class="cc-foot"><span class="cc-price">{esc(it.get("price",""))}<small>{esc(it.get("priceNote",""))}</small></span>
    <button class="cc-btn" data-title="{esc(it.get("title",""))}">Запросить {ic("arrow",15)}</button></div></div></article>'''
catcards="".join(catcard(it) for it in CAT)

# FAQ
FAQ=[("Когда откроется метро?","Станция Каспийская планируется к открытию в 2027 году (7 минут пешком), МЦД Котляково - в 2028 году (2 минуты). До запуска работает бесплатный шаттл от метро Царицыно."),
 ("Какие площади доступны?","Производство и склад - от 100 до 12 000 м², офисы - от 50 до 500 м². Потолки от 6 до 12 м, доступны лоты с высотой 9 м."),
 ("Какая электрическая мощность?","На комплекс выделено 5 МВт, на отдельное помещение - до 100 кВт с возможностью увеличения."),
 ("Что с погрузкой и разгрузкой?","Отдельные входы и ворота в каждом блоке, кран-балка, два лифта грузоподъёмностью по 5 тонн, парковка на 550 машиномест."),
 ("Почему аренда здесь надёжна?","Комплекс расположен вне зоны комплексного развития территорий (КРТ), поэтому долгосрочная аренда защищена от сноса под жилую застройку.")]
faqrows="".join(f'''<div class="faq rv"><button class="faq-q">{esc(q)}<span class="faq-i">{ic("arrow",18)}</span></button><div class="faq-a"><p>{esc(a)}</p></div></div>''' for q,a in FAQ)

navlinks="".join(f'<a href="#{sid}">{esc(t)}</a>' for sid,t in NAV)

CSS=r"""
*{margin:0;padding:0;box-sizing:border-box}
:root{--bg:#fff;--bg2:#F5F6F8;--bg3:#EEF1F4;--ink:#14171C;--ink2:#3a3f47;--muted:#6B7280;--line:#E6E8EC;
 --amber:#E9B84A;--amber-d:#C98A00;--amber-ink:#8A6200;--dark:#0d0f13;--dark2:#14171c;--gold:#E9B84A;
 --ff-d:'Oswald',sans-serif;--ff:'Manrope',sans-serif}
html{scroll-behavior:smooth;scroll-padding-top:84px}

.logo-i{display:block;flex-shrink:0;background:var(--logo) center/contain no-repeat}
body{font-family:var(--ff);color:var(--ink);background:var(--bg);line-height:1.65;-webkit-font-smoothing:antialiased;overflow-x:hidden}
img{max-width:100%;display:block}
.container{max-width:1180px;margin:0 auto;padding:0 24px}
section{position:relative}
.eyebrow{font-family:var(--ff);font-size:12px;font-weight:700;letter-spacing:.2em;text-transform:uppercase;color:var(--amber-ink)}
h2.sh{font-family:var(--ff-d);font-weight:700;text-transform:uppercase;font-size:clamp(28px,4.2vw,46px);line-height:1.03;letter-spacing:.01em;margin:10px 0 16px}
.sec-lead{font-size:17.5px;color:var(--ink2);max-width:720px;margin-bottom:34px}
/* header */
.hdr{position:fixed;top:0;left:0;right:0;z-index:50;transition:.3s}
.hdr .bar{display:flex;align-items:center;gap:18px;max-width:1180px;margin:0 auto;padding:14px 24px}
.hdr .brand{display:flex;align-items:center;gap:11px;text-decoration:none;color:#fff}
.hdr .brand .logo-i{width:38px;height:38px}
.hdr .brand b{font-family:var(--ff-d);font-size:19px;letter-spacing:.04em}
.hdr nav{margin-left:auto;display:flex;gap:24px}
.hdr nav a{color:rgba(255,255,255,.86);text-decoration:none;font-size:14px;font-weight:600;transition:.15s}
.hdr nav a:hover{color:var(--gold)}
.hdr .cta{display:inline-flex;align-items:center;gap:7px;background:linear-gradient(180deg,#F2C863,#D9A62E);color:#1a1305;font-weight:700;font-size:13.5px;padding:10px 16px;border-radius:10px;text-decoration:none}
.hdr .burger{display:none;margin-left:auto;width:44px;height:40px;border:1px solid rgba(255,255,255,.25);border-radius:9px;background:rgba(255,255,255,.06);color:#fff;place-items:center;cursor:pointer}
.hdr.solid{background:rgba(255,255,255,.92);backdrop-filter:blur(14px);border-bottom:1px solid var(--line);box-shadow:0 6px 24px rgba(0,0,0,.05)}
.hdr.solid .brand{color:var(--ink)}.hdr.solid nav a{color:var(--ink2)}.hdr.solid nav a:hover{color:var(--amber-d)}
.hdr.solid .burger{color:var(--ink);border-color:var(--line);background:var(--bg2)}
/* hero */
.hero{position:relative;min-height:100vh;min-height:100svh;display:flex;align-items:center;color:#fff;overflow:hidden;background:#0a0b0d}
.hero video,.hero .hero-poster{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;z-index:0}
.hero .hero-poster{animation:kb 22s ease-in-out infinite alternate;transform-origin:center}
@keyframes kb{from{transform:scale(1.04)}to{transform:scale(1.16) translateY(-1.5%)}}
.hero:after{content:"";position:absolute;inset:0;z-index:1;background:radial-gradient(120% 90% at 50% 15%,transparent,rgba(8,9,11,.35) 55%,rgba(8,9,11,.8)),linear-gradient(180deg,rgba(8,9,11,.35),rgba(8,9,11,.2) 35%,rgba(8,9,11,.82))}
.hero .hero-in{position:relative;z-index:2;padding:120px 0 60px}
.hero .eyebrow{color:var(--gold)}
.hero h1{font-family:var(--ff-d);font-weight:700;text-transform:uppercase;font-size:clamp(42px,8vw,92px);line-height:.98;letter-spacing:-.01em;margin:14px 0 10px;max-width:14ch}
.hero h1 .g{color:var(--gold)}
.hero .sub{font-size:clamp(17px,2.4vw,21px);color:rgba(255,255,255,.9);max-width:640px;margin-bottom:26px}
.hero .hbtns{display:flex;flex-wrap:wrap;gap:12px;margin-bottom:38px}
.btn{display:inline-flex;align-items:center;gap:9px;font-weight:700;font-size:15px;padding:15px 26px;border-radius:12px;text-decoration:none;cursor:pointer;border:0;transition:.18s;font-family:var(--ff)}
.btn.pri{background:linear-gradient(180deg,#F2C863,#D9A62E);color:#1a1305;box-shadow:0 8px 22px rgba(217,166,46,.34),inset 0 1px 0 rgba(255,255,255,.4)}.btn.pri:hover{transform:translateY(-2px);box-shadow:0 12px 30px rgba(217,166,46,.44),inset 0 1px 0 rgba(255,255,255,.5)}
.btn.sec{background:rgba(255,255,255,.1);color:#fff;border:1px solid rgba(255,255,255,.28);backdrop-filter:blur(6px)}
.btn.sec:hover{background:rgba(255,255,255,.18)}
.hchips{display:flex;flex-wrap:wrap;gap:10px}
.hchip{display:flex;align-items:center;gap:8px;font-size:13.5px;color:rgba(255,255,255,.92);background:rgba(255,255,255,.08);border:1px solid rgba(255,255,255,.16);border-radius:30px;padding:8px 15px;backdrop-filter:blur(6px)}
.hchip b{color:var(--gold);font-family:var(--ff-d);font-size:15px}
.scrollcue{position:absolute;bottom:24px;left:50%;transform:translateX(-50%);z-index:2;color:rgba(255,255,255,.6);font-size:11px;letter-spacing:.2em;text-transform:uppercase;display:flex;flex-direction:column;align-items:center;gap:8px}
.scrollcue i{width:1px;height:34px;background:linear-gradient(rgba(255,255,255,.5),transparent);animation:cue 1.8s infinite}
@keyframes cue{0%{opacity:0;transform:scaleY(.3)}50%{opacity:1}100%{opacity:0;transform:scaleY(1) translateY(10px)}}
/* stat band */
.statband{background:var(--dark);color:#fff;padding:34px 0;border-top:2px solid var(--gold)}
.stats{display:grid;grid-template-columns:repeat(6,1fr);gap:20px}
.stats>div:not(:last-child){border-right:1px solid rgba(255,255,255,.08)}
.stat-v{font-family:var(--ff-d);font-weight:700;font-size:clamp(28px,3.4vw,40px);line-height:1;color:var(--gold)}
.stat-l{font-size:12.5px;color:rgba(255,255,255,.6);margin-top:6px}
/* generic section pad */
.pad{padding:clamp(82px,9vw,120px) 0}
.pad.alt{background:var(--bg2);border-top:1px solid var(--line);border-bottom:1px solid var(--line)}
/* about */
.two{display:grid;grid-template-columns:1.05fr .95fr;gap:48px;align-items:center}
.two .img{border-radius:20px;overflow:hidden;box-shadow:0 30px 70px rgba(20,23,28,.18)}
.ulist{list-style:none;display:grid;gap:11px;margin-top:8px}
.ulist li{display:flex;gap:11px;align-items:flex-start;font-size:15px;color:var(--ink2)}
.ulist li .ic{color:var(--amber);flex-shrink:0;margin-top:2px}
/* transport */
.trans-wrap{display:grid;grid-template-columns:1fr 1fr;gap:44px;align-items:center}
.timeline2{display:grid;gap:14px}
.tl{display:grid;grid-template-columns:auto 1fr;gap:16px;background:#fff;border:1px solid var(--line);border-radius:16px;padding:18px 20px;transition:.18s}
.pad.alt .tl{background:#fff}
.tl:hover{border-color:rgba(217,166,46,.5);box-shadow:0 12px 30px rgba(20,23,28,.08);transform:translateX(4px)}
.tl-ic{width:46px;height:46px;border-radius:12px;background:#FFF6E0;color:var(--amber-d);display:grid;place-items:center;border:1px solid #f0dfa8}
.tl-h{display:flex;align-items:baseline;gap:12px}.tl-h b{font-family:var(--ff-d);font-size:18px}
.tl-y{font-size:12px;font-weight:700;color:#14130c;background:var(--amber);padding:2px 9px;border-radius:20px}
.tl-b p{font-size:14px;color:var(--muted);margin-top:3px}
.mapbox{border-radius:20px;overflow:hidden;position:relative;box-shadow:0 30px 70px rgba(20,23,28,.18)}
.mapbox img{width:100%}
.mappin{position:absolute;background:var(--amber);color:#14130c;font-size:11px;font-weight:700;padding:5px 10px;border-radius:20px;box-shadow:0 4px 14px rgba(0,0,0,.3);white-space:nowrap}
.mappin:after{content:"";position:absolute;bottom:-5px;left:14px;border:5px solid transparent;border-top-color:var(--amber);border-bottom:0}
/* specs grid */
.grid3{display:grid;grid-template-columns:repeat(3,1fr);gap:16px}
.scard{background:#fff;border:1px solid var(--line);border-radius:16px;padding:22px;transition:.2s;box-shadow:0 1px 2px rgba(20,23,28,.04),0 10px 26px -16px rgba(20,23,28,.14)}
.pad.alt .scard{background:#fff}
.scard:hover{border-color:rgba(217,166,46,.5);box-shadow:0 14px 34px rgba(20,23,28,.08);transform:translateY(-3px)}
.s-ic{width:50px;height:50px;border-radius:13px;background:#FFF6E0;color:var(--amber-d);display:grid;place-items:center;margin-bottom:14px;border:1px solid #f0dfa8}
.scard b{font-family:var(--ff-d);font-size:19px;display:block;margin-bottom:5px}
.scard span{font-size:13.5px;color:var(--muted)}
/* infra mosaic */
.mosaic{display:grid;grid-template-columns:repeat(3,1fr);gap:14px}
.mtile{position:relative;min-height:230px;border-radius:18px;overflow:hidden;background-size:cover;background-position:center;display:flex;align-items:flex-end}
.mt-ov{position:absolute;inset:0;background:linear-gradient(180deg,rgba(10,11,13,.05),rgba(10,11,13,.82))}
.mt-c{position:relative;z-index:2;padding:18px;color:#fff}
.mt-ic{width:40px;height:40px;border-radius:11px;background:rgba(232,164,0,.9);color:#14130c;display:grid;place-items:center;margin-bottom:10px}
.mt-c b{font-family:var(--ff-d);font-size:18px;display:block}.mt-c span{font-size:13px;color:rgba(255,255,255,.85)}
/* industries */
.grid3.ind .icard{background:#fff;border:1px solid var(--line);border-radius:16px;padding:22px;display:flex;gap:15px;align-items:center;transition:.18s}
.pad.alt .icard{background:#fff}
.icard:hover{border-color:rgba(217,166,46,.5);box-shadow:0 12px 30px rgba(20,23,28,.08);transform:translateY(-3px)}
.i-ic{width:52px;height:52px;border-radius:13px;background:var(--dark);color:var(--gold);display:grid;place-items:center;flex-shrink:0}
.icard b{font-family:var(--ff-d);font-size:17px;display:block}.icard span{font-size:13px;color:var(--muted)}
/* why */
.grid4{display:grid;grid-template-columns:repeat(4,1fr);gap:16px}
.wcard{background:var(--dark);color:#fff;border-radius:18px;padding:24px;position:relative;overflow:hidden}
.wcard:before{content:"";position:absolute;top:0;left:0;right:0;height:3px;background:linear-gradient(90deg,var(--amber),transparent)}
.w-ic{width:50px;height:50px;border-radius:13px;background:rgba(232,164,0,.16);color:var(--gold);display:grid;place-items:center;margin-bottom:14px}
.wcard b{font-family:var(--ff-d);font-size:18px;display:block;margin-bottom:8px}
.wcard p{font-size:13.5px;color:rgba(255,255,255,.75)}
/* catalog */
.catfilters{display:flex;gap:9px;flex-wrap:wrap;margin-bottom:22px}
.cf{font-size:13px;font-weight:600;padding:8px 15px;border-radius:22px;border:1px solid var(--line);background:#fff;cursor:pointer;transition:.15s}
.cf.active{background:var(--ink);color:#fff;border-color:var(--ink)}
.catgrid{display:grid;grid-template-columns:repeat(3,1fr);gap:18px}
.ccard{background:#fff;border:1px solid var(--line);border-radius:18px;overflow:hidden;transition:.18s;display:flex;flex-direction:column}
.ccard:hover{border-color:rgba(217,166,46,.5);box-shadow:0 18px 40px rgba(20,23,28,.12);transform:translateY(-4px)}
.cc-img{height:180px;background-size:cover;background-position:center;position:relative}
.cc-st{position:absolute;top:12px;left:12px;font-size:12px;font-weight:700;padding:4px 11px;border-radius:20px;color:#fff}
.cc-st.free{background:#1F9D6B}.cc-st.busy{background:#6B7280}
.cc-b{padding:20px;display:flex;flex-direction:column;flex:1}
.cc-b h3{font-family:var(--ff-d);font-size:20px;margin-bottom:12px}
.cc-params{display:flex;flex-wrap:wrap;gap:7px;margin-bottom:16px}
.cc-params span{font-size:12px;color:var(--ink2);background:var(--bg2);border:1px solid var(--line);border-radius:7px;padding:4px 9px}
.cc-foot{display:flex;justify-content:space-between;align-items:flex-end;margin-top:auto}
.cc-price{font-family:var(--ff-d);font-size:16px}.cc-price small{display:block;font-family:var(--ff);font-size:12px;color:var(--muted);font-weight:400}
.cc-btn{display:inline-flex;align-items:center;gap:6px;background:linear-gradient(180deg,#F2C863,#D9A62E);color:#1a1305;border:0;border-radius:10px;padding:9px 14px;font-weight:700;font-size:13px;cursor:pointer;font-family:var(--ff)}
.cc-btn:hover{filter:brightness(1.08)}
/* faq */
.faqs{max-width:820px;margin:0 auto;display:grid;gap:10px}
.faq{background:#fff;border:1px solid var(--line);border-radius:14px;overflow:hidden}
.pad.alt .faq{background:#fff}
.faq-q{width:100%;text-align:left;background:none;border:0;padding:19px 22px;font-family:var(--ff);font-weight:700;font-size:16px;cursor:pointer;display:flex;justify-content:space-between;align-items:center;gap:14px;color:var(--ink)}
.faq-i{color:var(--amber-d);transition:.25s;flex-shrink:0}
.faq.open .faq-i{transform:rotate(90deg)}
.faq-a{max-height:0;overflow:hidden;transition:max-height .3s}
.faq-a p{padding:0 22px 19px;font-size:14.5px;color:var(--ink2)}
/* form */
.formsec{background:var(--dark);color:#fff;position:relative;overflow:hidden}
.formsec .glow{position:absolute;top:-100px;right:-60px;width:440px;height:440px;background:radial-gradient(circle,rgba(232,164,0,.16),transparent 70%);filter:blur(70px)}
.form-wrap{display:grid;grid-template-columns:1fr 1fr;gap:48px;align-items:start;position:relative;z-index:2}
.formsec .eyebrow{color:var(--gold)}.formsec h2.sh{color:#fff}
.form-lead{font-size:16px;color:rgba(255,255,255,.8);margin-bottom:22px}
.form-contacts{display:grid;gap:12px;margin-top:8px}
.fc{display:flex;align-items:center;gap:12px;font-size:15px;color:rgba(255,255,255,.92)}
.fc .ic{color:var(--gold)}
form.lead{background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.1);border-radius:20px;padding:26px}
.fld{margin-bottom:14px}
.fld label{display:block;font-size:12.5px;color:rgba(255,255,255,.7);margin-bottom:6px;font-weight:600}
.fld input,.fld select,.fld textarea{width:100%;background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.16);border-radius:11px;padding:13px 14px;color:#fff;font-family:var(--ff);font-size:14.5px}
.fld input::placeholder,.fld textarea::placeholder{color:rgba(255,255,255,.4)}
.fld input:focus,.fld select:focus,.fld textarea:focus{outline:0;border-color:var(--amber)}
.fld select option{color:#14171c}
form.lead .btn.pri{width:100%;justify-content:center;margin-top:6px}
.form-ok{display:none;text-align:center;padding:30px}
.form-ok.show{display:block}.form-ok .ic{color:var(--gold);margin:0 auto 12px}
.privacy{font-size:11.5px;color:rgba(255,255,255,.5);margin-top:12px;text-align:center}
/* footer */
.foot{background:#08090b;color:rgba(255,255,255,.7);padding:44px 0 30px}
.foot-top{display:flex;justify-content:space-between;gap:24px;flex-wrap:wrap;padding-bottom:26px;border-bottom:1px solid rgba(255,255,255,.08)}
.foot .brand{display:flex;align-items:center;gap:11px;color:#fff}
.foot .brand .logo-i{width:40px;height:40px}.foot .brand b{font-family:var(--ff-d);font-size:20px}
.foot-c{font-size:14px;line-height:1.9}
.foot-bot{display:flex;justify-content:space-between;gap:16px;flex-wrap:wrap;padding-top:20px;font-size:12.5px;color:rgba(255,255,255,.45)}
/* chatbot */
.chatbtn{position:fixed;bottom:22px;right:22px;z-index:60;width:58px;height:58px;border-radius:50%;background:var(--amber);color:#14130c;border:0;display:grid;place-items:center;cursor:pointer;box-shadow:0 10px 30px rgba(232,164,0,.4)}
.chatbtn:hover{transform:scale(1.06)}
.chatbox{position:fixed;bottom:90px;right:22px;z-index:60;width:340px;max-width:calc(100vw - 44px);background:#fff;border:1px solid var(--line);border-radius:18px;box-shadow:0 24px 60px rgba(0,0,0,.24);overflow:hidden;display:none;flex-direction:column}
.chatbox.open{display:flex}
.chat-h{background:var(--dark);color:#fff;padding:16px 18px;font-family:var(--ff-d);font-size:16px;display:flex;align-items:center;gap:10px}
.chat-h .logo-i{width:26px;height:26px}
.chat-b{padding:16px;max-height:340px;overflow-y:auto;display:flex;flex-direction:column;gap:10px}
.msg{font-size:14px;padding:10px 13px;border-radius:12px;max-width:85%}
.msg.bot{background:var(--bg2);color:var(--ink);align-self:flex-start;border-bottom-left-radius:4px}
.msg.me{background:var(--amber);color:#14130c;align-self:flex-end;border-bottom-right-radius:4px}
.chat-quick{display:flex;flex-wrap:wrap;gap:7px;padding:0 16px 14px}
.chat-quick button{font-size:12.5px;border:1px solid var(--line);background:#fff;border-radius:16px;padding:7px 12px;cursor:pointer;color:var(--ink2)}
.chat-quick button:hover{border-color:var(--amber);color:var(--amber-d)}
/* reveal */
.rv{opacity:0;transform:translateY(20px);transition:opacity .6s,transform .6s}.rv.in{opacity:1;transform:none}
/* responsive */
@media(max-width:960px){
 .hdr nav,.hdr .cta{display:none}.hdr .burger{display:grid;height:44px}
 .cf{min-height:44px;display:inline-flex;align-items:center;padding:11px 16px}
 .cc-btn{min-height:44px;padding:12px 16px}
 .chat-quick button{min-height:40px;padding:9px 14px}
 .mappin{font-size:10px;padding:4px 8px;white-space:normal;max-width:42vw}
 .foot-c a{display:inline-block;padding:11px 0;line-height:1.3}.foot-bot{color:rgba(255,255,255,.62)}
 .two,.trans-wrap,.form-wrap{grid-template-columns:1fr;gap:28px}
 .stats{grid-template-columns:repeat(3,1fr);gap:14px}
 .grid3,.grid3.ind,.mosaic,.catgrid{grid-template-columns:1fr 1fr}
 .grid4{grid-template-columns:1fr 1fr}
}
@media(max-width:600px){
 .stats,.grid3,.grid3.ind,.mosaic,.catgrid,.grid4{grid-template-columns:1fr}
 .pad{padding:56px 0}.hero .hero-in{padding:100px 0 50px}
 .mnav{display:block}
}
/* mobile drawer */
.mdrawer{position:fixed;inset:0;z-index:70;background:rgba(8,9,11,.96);backdrop-filter:blur(6px);display:none;flex-direction:column;padding:20px 24px}
.mdrawer.open{display:flex}
.mdrawer .mtop{display:flex;justify-content:space-between;align-items:center;margin-bottom:30px}
.mdrawer .mtop b{font-family:var(--ff-d);color:#fff;font-size:20px}
.mdrawer .mclose{width:44px;height:44px;border:1px solid rgba(255,255,255,.2);border-radius:10px;background:none;color:#fff;display:grid;place-items:center;cursor:pointer}
.mdrawer a{color:#fff;text-decoration:none;font-family:var(--ff-d);font-size:24px;padding:14px 0;border-bottom:1px solid rgba(255,255,255,.08)}
.mdrawer a:active{color:var(--gold)}
@media(max-width:900px){.scrollcue{display:none}}
@media(prefers-reduced-motion:reduce){.rv{opacity:1;transform:none}.hero video{display:none}.hero .hero-poster{animation:none!important}.scrollcue i{animation:none!important}}
"""

JS=r"""
const hdr=document.querySelector('.hdr');
addEventListener('scroll',()=>hdr.classList.toggle('solid',scrollY>60),{passive:true});
if(scrollY>60)hdr.classList.add('solid');
// reveal
const io=new IntersectionObserver(es=>es.forEach(e=>{if(e.isIntersecting){e.target.classList.add('in');io.unobserve(e.target)}}),{threshold:.12});
document.querySelectorAll('.rv').forEach(e=>io.observe(e));
// count up
const cio=new IntersectionObserver(es=>es.forEach(e=>{if(e.isIntersecting){const el=e.target,to=+el.dataset.to;let n=0,st=Math.max(1,Math.round(to/45));const t=setInterval(()=>{n+=st;if(n>=to){n=to;clearInterval(t)}el.textContent=n.toLocaleString('ru')},22);cio.unobserve(el)}}),{threshold:.5});
document.querySelectorAll('.cnt').forEach(e=>cio.observe(e));
// mobile drawer
const dr=document.querySelector('.mdrawer');
document.querySelector('.burger').addEventListener('click',()=>dr.classList.add('open'));
document.querySelector('.mclose').addEventListener('click',()=>dr.classList.remove('open'));
dr.querySelectorAll('a').forEach(a=>a.addEventListener('click',()=>dr.classList.remove('open')));
// faq
document.querySelectorAll('.faq-q').forEach(q=>q.addEventListener('click',()=>{const f=q.closest('.faq');const open=f.classList.contains('open');document.querySelectorAll('.faq').forEach(x=>{x.classList.remove('open');x.querySelector('.faq-a').style.maxHeight=null});if(!open){f.classList.add('open');f.querySelector('.faq-a').style.maxHeight=f.querySelector('.faq-a').scrollHeight+'px'}}));
// catalog filter
document.querySelectorAll('.cf').forEach(b=>b.addEventListener('click',()=>{document.querySelectorAll('.cf').forEach(x=>x.classList.remove('active'));b.classList.add('active');const f=b.dataset.f;document.querySelectorAll('.ccard').forEach(c=>{const st=c.querySelector('.cc-st').textContent.toLowerCase();c.style.display=(f==='all'||(f==='free'&&st.includes('вободно')))?'':'none'});}));
// catalog -> form
document.querySelectorAll('.cc-btn').forEach(b=>b.addEventListener('click',()=>{const t=b.dataset.title;const msg=document.querySelector('#f-msg');if(msg)msg.value='Интересует: '+t;location.hash='#form';}));
// form submit (demo on showcase; real deploy posts to /api/lead.php)
const form=document.querySelector('form.lead');
form.addEventListener('submit',e=>{e.preventDefault();form.style.display='none';document.querySelector('.form-ok').classList.add('show');});
// chatbot
const cb=document.querySelector('.chatbox'),cbtn=document.querySelector('.chatbtn'),cbody=document.querySelector('.chat-b');
cbtn.addEventListener('click',()=>cb.classList.toggle('open'));
const KB={'метро':'Каспийская откроется в 2027 (7 мин пешком), МЦД Котляково - в 2028 (2 мин). Сейчас ходит бесплатный шаттл от Царицыно.','площад':'Производство и склад - от 100 до 12 000 м², офисы - от 50 до 500 м². Потолки 6-12 м.','мощнос':'5 МВт на комплекс, до 100 кВт на помещение с увеличением.','цена':'Стоимость зависит от лота. Оставьте заявку - отдел аренды подготовит расчёт.','аренд':'Комплекс вне зоны КРТ, долгосрочная аренда защищена от сноса.'};
function bot(t){const d=document.createElement('div');d.className='msg bot';d.textContent=t;cbody.appendChild(d);cbody.scrollTop=cbody.scrollHeight;}
function me(t){const d=document.createElement('div');d.className='msg me';d.textContent=t;cbody.appendChild(d);cbody.scrollTop=cbody.scrollHeight;}
function ask(q){me(q);let a='Спасибо за вопрос. Оставьте заявку - специалист отдела аренды ответит подробно и подберёт помещение.';for(const k in KB)if(q.toLowerCase().includes(k)){a=KB[k];break}setTimeout(()=>bot(a),350);}
document.querySelectorAll('.chat-quick button').forEach(b=>b.addEventListener('click',()=>ask(b.textContent)));
"""

BURGER=f'<button class="burger" aria-label="Меню">{ic("menu",22)}</button>'
doc=f"""<!DOCTYPE html><html lang="ru"><head><meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<title>Бизнес-парк «Кластер» - производство и офис внутри МКАД</title>
<meta name="description" content="Производственно-офисный комплекс 50 000 м² внутри МКАД, в 5 км от кольца. Инженерия промышленного уровня, вне зоны КРТ, рядом строятся две станции метро.">
<meta property="og:description" content="Производственно-офисный комплекс 50 000 м² внутри МКАД, в 5 км от кольца. Инженерия промышленного уровня, вне зоны КРТ, рядом строятся две станции метро.">
<meta property="og:type" content="website">
<meta property="og:title" content="Бизнес-парк «Кластер» - пространство успешных компаний">
<meta property="og:image" content="/og-cover.jpg">
<style>{FONTS}
{CSS}
:root{{--logo:url({EMBLEM})}}</style><noscript><style>.rv{{opacity:1!important;transform:none!important}}</style></noscript></head><body>

<header class="hdr"><div class="bar">
 <a class="brand" href="#top"><i class="logo-i" role="img" aria-label="Кластер"></i><b>КЛАСТЕР</b></a>
 <nav>{navlinks}</nav>
 <a class="cta" href="#form">{ic("phone",16)} Оставить заявку</a>
 {BURGER}
</div></header>

<div class="mdrawer"><div class="mtop"><b>КЛАСТЕР</b><button class="mclose">{ic("close",22)}</button></div>
{navlinks}<a href="#form" style="color:var(--gold)">Оставить заявку</a></div>

<section class="hero" id="top">
 <img class="hero-poster" src="{IMG.get('poster','')}" alt="Бизнес-парк Кластер, аэросъёмка">
 <video autoplay muted loop playsinline onerror="this.style.display='none'"><source src="/hero.mp4" type="video/mp4"></video>
 <div class="container hero-in">
  <div class="eyebrow">{esc(C('hero','eyebrow'))}</div>
  <h1>Пространство <span class="g">успешных</span> компаний</h1>
  <p class="sub">{esc(C('hero','body'))}</p>
  <div class="hbtns"><a class="btn pri" href="#form">{ic("phone",17)} Подобрать помещение</a>
   <a class="btn sec" href="#about">Узнать о комплексе</a></div>
  <div class="hchips"><div class="hchip"><b>50 000 м²</b> внутри МКАД</div>
   <div class="hchip"><b>2</b> метро строятся рядом</div>
   <div class="hchip"><b>вне зоны КРТ</b></div></div>
 </div>
 <div class="scrollcue">Листайте<i></i></div>
</section>

<section class="statband"><div class="container"><div class="stats">{statcards}</div></div></section>

<section class="pad" id="about"><div class="container"><div class="two">
 <div><div class="eyebrow">{esc(C('about','eyebrow'))}</div><h2 class="sh">{esc(C('about','heading'))}</h2>
  <p class="sec-lead" style="margin-bottom:18px">{esc(C('about','body'))}</p>
  <ul class="ulist">{li(bullets('about'))}</ul></div>
 <div class="img rv"><img src="{IMG.get('about','')}" alt="Комплекс Кластер"></div>
</div></div></section>

<section class="pad alt" id="transport"><div class="container">
 <div class="eyebrow">{esc(C('transport','eyebrow'))}</div><h2 class="sh">{esc(C('transport','heading'))}</h2>
 <p class="sec-lead">{esc(C('transport','body'))}</p>
 <div class="trans-wrap"><div class="timeline2">{transrows}</div>
  <div class="mapbox rv"><img src="{IMG.get('map','')}" alt="Схема расположения">
   <div class="mappin" style="top:16%;left:20%">м. Каспийская 2027</div>
   <div class="mappin" style="top:60%;left:48%">МЦД Котляково 2028</div></div>
 </div></div></section>

<section class="pad" id="specs"><div class="container">
 <div class="eyebrow">{esc(C('specs','eyebrow'))}</div><h2 class="sh">{esc(C('specs','heading'))}</h2>
 <p class="sec-lead">{esc(C('specs','body'))}</p>
 <div class="grid3">{speccards}</div></div></section>

<section class="pad alt" id="infra"><div class="container">
 <div class="eyebrow">{esc(C('infrastructure','eyebrow'))}</div><h2 class="sh">{esc(C('infrastructure','heading'))}</h2>
 <p class="sec-lead">{esc(C('infrastructure','body'))}</p>
 <div class="mosaic">{inframos}</div></div></section>

<section class="pad" id="industries"><div class="container">
 <div class="eyebrow">{esc(C('industries','eyebrow'))}</div><h2 class="sh">{esc(C('industries','heading'))}</h2>
 <p class="sec-lead">{esc(C('industries','body'))}</p>
 <div class="grid3 ind">{indcards}</div></div></section>

<section class="pad alt"><div class="container">
 <div class="eyebrow">{esc(C('why','eyebrow'))}</div><h2 class="sh">{esc(C('why','heading'))}</h2>
 <p class="sec-lead">{esc(C('why','body'))}</p>
 <div class="grid4">{whycards}</div></div></section>

<section class="pad" id="catalog"><div class="container">
 <div class="eyebrow">Каталог помещений</div><h2 class="sh">Доступные лоты</h2>
 <p class="sec-lead">Подбор помещений под производство, склад и офис. Актуальные варианты и статусы; точную стоимость подготовит отдел аренды по запросу.</p>
 <div class="catfilters"><button class="cf active" data-f="all">Все лоты</button><button class="cf" data-f="free">Свободные</button></div>
 <div class="catgrid">{catcards}</div></div></section>

<section class="pad alt"><div class="container">
 <div class="eyebrow" style="text-align:center">Вопросы и ответы</div><h2 class="sh" style="text-align:center">Частые вопросы</h2>
 <div class="faqs" style="margin-top:26px">{faqrows}</div></div></section>

<section class="pad formsec" id="form"><div class="glow"></div><div class="container"><div class="form-wrap">
 <div><div class="eyebrow">{esc(C('form','eyebrow'))}</div><h2 class="sh">{esc(C('form','heading'))}</h2>
  <p class="form-lead">{esc(C('form','body'))}</p>
  <div class="form-contacts">
   <div class="fc">{ic("phone",20)} 8 (985) 331 02 71</div>
   <div class="fc">{ic("loc",20)} Москва, ЮАО, ул. 6-я Радиальная, д. 17, стр. 1</div>
   <div class="fc">{ic("chat",20)} office@activity.su</div></div></div>
 <div><form class="lead" method="post" action="/api/lead.php">
   <div class="fld"><label>Имя и компания</label><input name="name" placeholder="Как к вам обращаться" required></div>
   <div class="fld"><label>Телефон или email</label><input name="contact" placeholder="Для связи" required></div>
   <div class="fld"><label>Назначение</label><select name="purpose"><option>Производство</option><option>Склад</option><option>Офис</option><option>Производство + офис</option></select></div>
   <div class="fld"><label>Задача (площадь, мощность)</label><textarea id="f-msg" name="message" rows="3" placeholder="Например: производство 500 м², 100 кВт, кран-балка"></textarea></div>
   <button class="btn pri" type="submit">{ic("arrow",17)} Отправить заявку</button>
   <div class="privacy">Нажимая кнопку, вы соглашаетесь на обработку персональных данных.</div>
  </form>
  <div class="form-ok">{ic("check",44)}<h3 style="font-family:var(--ff-d);font-size:24px;margin-bottom:8px">Заявка отправлена</h3>
   <p style="color:rgba(255,255,255,.75)">Специалист отдела аренды свяжется с вами в ближайшее время.</p></div>
 </div>
</div></div></section>

<footer class="foot"><div class="container">
 <div class="foot-top">
  <div><div class="brand"><i class="logo-i" role="img" aria-label="Кластер"></i><b>КЛАСТЕР</b></div>
   <p style="margin-top:12px;max-width:340px;font-size:14px">Центр развития высокотехнологичных производств внутри МКАД. Пространство успешных компаний.</p></div>
  <div class="foot-c"><b style="color:#fff;font-family:var(--ff-d)">Контакты</b><br>8 (985) 331 02 71<br>office@activity.su<br>Москва, ЮАО, ул. 6-я Радиальная, д. 17, стр. 1</div>
  <div class="foot-c"><b style="color:#fff;font-family:var(--ff-d)">Разделы</b><br>{"<br>".join(f'<a href="#{s}" style="color:rgba(255,255,255,.7);text-decoration:none">{esc(t)}</a>' for s,t in NAV)}</div>
 </div>
 <div class="foot-bot"><div>Бизнес-парк «Кластер» · ООО «Активити» · 2026</div><div>Подготовлено OKO TEAM</div></div>
</div></footer>

<button class="chatbtn" aria-label="Чат">{ic("chat",24)}</button>
<div class="chatbox"><div class="chat-h"><i class="logo-i" role="img" aria-label="Кластер"></i>Консультант «Кластер»</div>
 <div class="chat-b"><div class="msg bot">Здравствуйте! Помогу подобрать помещение и отвечу на вопросы о комплексе. Что вас интересует?</div></div>
 <div class="chat-quick"><button>Когда метро?</button><button>Какие площади?</button><button>Мощность?</button><button>Цена аренды?</button></div>
</div>

<script>{JS}</script>
</body></html>"""
open(f"{PUB}/site.html","w",encoding="utf-8").write(doc)
print("site.html", os.path.getsize(f"{PUB}/site.html")//1024, "KB")
