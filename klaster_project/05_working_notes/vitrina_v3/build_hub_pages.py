#!/usr/bin/env python3
import markdown, os
KP="/home/user/OKO-TEAM/klaster_project"
PUB="/tmp/claude-0/-home-user-OKO-TEAM/e9dade84-4efa-54bc-ab59-8461d2f37b40/scratchpad/mighty-melody-603-0bfda5fd-0671-4325-b76b-3b3170f7688b/app/public"
FONTS=open(f"{KP}/03_deliverables/website/assets/css/fonts.css").read()
LOGO_W=open(f"{KP}/03_deliverables/website/assets/logo/klaster-logo-horizontal-white.svg").read()
md=markdown.Markdown(extensions=["tables","fenced_code","sane_lists"])
def render(path):
    md.reset(); return md.convert(open(path,encoding="utf-8").read())

CSS="""
:root{--amber:#E8A400;--amber-d:#C98A00;--amber-ink:#8A6200;--ink:#14171C;--dark:#0E1116;--muted:#6B7280;--line:#E6E8EC;--bg:#F5F6F8;--ok:#1F9D6B;--ff-d:'Oswald',sans-serif;--ff:'Manrope',sans-serif}
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:var(--ff);color:var(--ink);background:var(--bg);line-height:1.6}
.app{display:grid;grid-template-columns:280px 1fr;min-height:100vh}
.side{position:sticky;top:0;height:100vh;overflow-y:auto;background:var(--dark);color:#fff;padding:22px 16px}
.side .logo{height:32px;margin:6px 8px 8px}.side .logo svg{height:100%}
.side .home{display:block;color:var(--amber);font-size:13px;font-weight:700;margin:0 8px 16px;text-decoration:none}
.side a.nav{display:block;padding:10px 14px;border-radius:10px;color:rgba(255,255,255,.72);font-weight:600;font-size:14px;margin-bottom:2px;cursor:pointer;transition:.15s;text-decoration:none}
.side a.nav:hover{background:rgba(255,255,255,.06);color:#fff}
.side a.nav.active{background:var(--amber);color:var(--ink)}
.topbar{position:sticky;top:0;z-index:5;background:rgba(245,246,248,.9);backdrop-filter:blur(10px);border-bottom:1px solid var(--line);padding:14px 40px;font-family:var(--ff-d);font-weight:600;text-transform:uppercase;letter-spacing:.05em;font-size:14px;color:var(--muted)}
.wrap{max-width:940px;margin:0 auto;padding:40px}
.sec{display:none}.sec.on{display:block;animation:f .3s}@keyframes f{from{opacity:0;transform:translateY(8px)}to{opacity:1}}
h1{font-family:var(--ff-d);font-weight:700;text-transform:uppercase;font-size:clamp(24px,3vw,36px);margin:0 0 14px;line-height:1.05}
h2{font-family:var(--ff-d);font-weight:600;font-size:23px;margin:30px 0 10px}
h3{font-family:var(--ff-d);font-weight:600;font-size:18px;margin:22px 0 8px}
h4{font-weight:700;font-size:16px;margin:16px 0 6px}
p{margin:0 0 13px}ul,ol{margin:0 0 15px 22px}li{margin-bottom:5px}
blockquote{border-left:3px solid var(--amber);background:#fff;padding:12px 18px;border-radius:0 10px 10px 0;color:var(--muted);margin:0 0 18px;font-size:14px}
table{width:100%;border-collapse:collapse;margin:0 0 20px;background:#fff;border:1px solid var(--line);border-radius:10px;overflow:hidden;font-size:14px;display:block;overflow-x:auto}
th{background:var(--dark);color:#fff;font-family:var(--ff-d);font-weight:500;text-align:left;padding:10px 13px;text-transform:uppercase;font-size:12px}
td{padding:10px 13px;border-top:1px solid var(--line);vertical-align:top}
tr:nth-child(even) td{background:#fafbfc}
strong{font-weight:700}code{background:#FFF6E0;padding:2px 6px;border-radius:5px;font-size:13px}
hr{border:0;border-top:1px solid var(--line);margin:26px 0}
/* brand page */
.logos{display:grid;grid-template-columns:1fr 1fr;gap:16px;margin:20px 0}
.logobox{border:1px solid var(--line);border-radius:14px;padding:34px;display:grid;place-items:center;min-height:150px}
.logobox.dark{background:var(--dark)}.logobox.light{background:#fff}.logobox.amber{background:var(--amber)}
.logobox img{max-width:78%;max-height:90px}
.sw{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin:16px 0}
.swatch{border-radius:12px;border:1px solid var(--line);overflow:hidden;background:#fff}
.swatch .c{height:70px}.swatch .n{padding:8px 10px;font-size:12px}.swatch .n b{display:block;font-family:var(--ff-d)}
.dl{display:flex;flex-wrap:wrap;gap:10px;margin:16px 0}
.dl a{background:#fff;border:1px solid var(--line);border-radius:10px;padding:10px 16px;font-size:13px;font-weight:600;text-decoration:none;color:var(--ink)}
.dl a:hover{border-color:var(--ink)}
@media(max-width:900px){.app{grid-template-columns:1fr}.side{position:static;height:auto}.logos,.sw{grid-template-columns:1fr}.wrap{padding:24px}}
"""
JS_TMPL="""
const secs=document.querySelectorAll('.sec');const links=document.querySelectorAll('a.nav');
function show(id){secs.forEach(s=>s.classList.toggle('on',s.id==='sec-'+id));links.forEach(a=>a.classList.toggle('active',a.dataset.sec===id));window.scrollTo(0,0);location.hash=id;}
links.forEach(a=>a.addEventListener('click',e=>{e.preventDefault();show(a.dataset.sec)}));
const h=location.hash.replace('#','')||'__FIRST__';show(document.getElementById('sec-'+h)?h:'__FIRST__');
"""
def build(title, nav, sections, first, out):
    nav_html="".join(f'<a class="nav" data-sec="{sid}">{lbl}</a>' for sid,lbl in nav)
    body="".join(f'<section id="sec-{sid}" class="sec">{html}</section>' for sid,html in sections)
    js=JS_TMPL.replace("__FIRST__",first)
    doc=f"""<!DOCTYPE html><html lang="ru"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>{title}</title><style>{FONTS}
{CSS}</style></head><body><div class="app">
<aside class="side"><div class="logo">{LOGO_W}</div><a class="home" href="/">← На главную витрины</a><nav>{nav_html}</nav></aside>
<main><div class="topbar">{title}</div><div class="wrap">{body}</div></main></div><script>{js}</script></body></html>"""
    open(out,"w",encoding="utf-8").write(doc); print(os.path.basename(out),len(doc)//1024,"KB")

# ---------- content.html ----------
CP=f"{KP}/03_deliverables/content_plan"
csections=[
 ("plan","Обзор плана", render(f"{CP}/CONTENT_PLAN_M1.md")),
 ("reels1","Reels 1-10", render(f"{CP}/produced/reels_01-10.md")),
 ("reels2","Reels 11-20", render(f"{CP}/produced/reels_11-20.md")),
 ("reels3","Reels 21-30", render(f"{CP}/produced/reels_21-30.md")),
 ("posts","Посты Telegram", render(f"{CP}/produced/telegram_posts.md")),
 ("carousels","Карусели", render(f"{CP}/produced/carousels.md")),
 ("art1","Статьи 1-5", render(f"{CP}/produced/articles_01-05.md")),
 ("art2","Статьи 6-10", render(f"{CP}/produced/articles_06-10.md")),
 ("art3","Статьи 11-15", render(f"{CP}/produced/articles_11-15.md")),
 ("lm","Лид-магниты", render(f"{CP}/produced/lead_magnets.md")),
 ("m2","Банк тем М2", render(f"{CP}/produced/theme_bank_m2.md")),
 ("m3","Банк тем М3", render(f"{CP}/produced/theme_bank_m3.md")),
]
build("Контент-план · Кластер",[(s,l) for s,l,_ in csections],[(s,h) for s,_,h in csections],"plan",f"{PUB}/content.html")

# ---------- brand.html ----------
brand_intro=render(f"{KP}/03_deliverables/brandbook/BRANDBOOK.md")
logos_html='''
<h1>Логотип и брендбук «Кластер»</h1>
<p class="lead">Логотип воссоздан по реальному знаку парка (шестерёнка со стилизованной фигурой). Ниже начертания, палитра, шрифты и файлы во всех форматах.</p>
<h2>Начертания</h2>
<div class="logos">
  <div class="logobox light"><img src="/brand/klaster-logo-horizontal.svg" alt="Логотип на светлом"></div>
  <div class="logobox dark"><img src="/brand/klaster-logo-horizontal-white.svg" alt="Логотип на тёмном"></div>
  <div class="logobox amber"><img src="/brand/klaster-emblem.svg" alt="Эмблема на амбере"></div>
  <div class="logobox dark"><img src="/brand/klaster-emblem-amber.svg" alt="Эмблема амбер на тёмном"></div>
</div>
<h2>Палитра</h2>
<div class="sw">
  <div class="swatch"><div class="c" style="background:#E8A400"></div><div class="n"><b>Амбер</b>#E8A400</div></div>
  <div class="swatch"><div class="c" style="background:#14171C"></div><div class="n"><b>Графит</b>#14171C</div></div>
  <div class="swatch"><div class="c" style="background:#0E1116"></div><div class="n"><b>Тёмный</b>#0E1116</div></div>
  <div class="swatch"><div class="c" style="background:#F5F6F8"></div><div class="n"><b>Светлый фон</b>#F5F6F8</div></div>
</div>
<h2>Шрифты</h2>
<p style="font-family:'Oswald';font-weight:700;font-size:34px;text-transform:uppercase;margin:0">Oswald — заголовки</p>
<p style="font-family:'Manrope';font-size:18px">Manrope — основной текст интерфейса и абзацы.</p>
<h2>Файлы для скачивания</h2>
<div class="dl">
  <a href="/brand/klaster-logo-horizontal.svg" download>Логотип SVG</a>
  <a href="/brand/png/klaster-logo-horizontal.png" download>Логотип PNG</a>
  <a href="/brand/jpg/klaster-logo-horizontal.jpg" download>Логотип JPG</a>
  <a href="/brand/pdf/klaster-logo-horizontal.pdf" download>Логотип PDF</a>
  <a href="/brand/klaster-emblem.svg" download>Эмблема SVG</a>
  <a href="/brand/png/klaster-appicon-amber-1024.png" download>Иконка приложения PNG</a>
  <a href="/favicon.ico" download>favicon.ico</a>
</div>
<hr>
'''
build("Брендбук · Кластер",[("logos","Логотип и палитра"),("guide","Гайдлайн")],
      [("logos",logos_html),("guide",brand_intro)],"logos",f"{KP.replace('klaster_project','')}/_tmp_unused.html".replace("//","/") if False else f"{PUB}/brand.html")
