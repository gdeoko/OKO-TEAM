#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Премиум тёмные standalone-страницы: календарь контента и витрина лого."""
import json, html, os
BASE="/home/user/OKO-TEAM/klaster_project"
SCRATCH="/tmp/claude-0/-home-user-OKO-TEAM/e9dade84-4efa-54bc-ab59-8461d2f37b40/scratchpad"
REPO=[d for d in os.listdir(SCRATCH) if d.startswith("mighty-melody-603-")][0]
PUB=f"{SCRATCH}/{REPO}/app/public"
FONTS=open(f"{BASE}/03_deliverables/website/assets/css/fonts.css").read()
EMBLEM=open(f"{SCRATCH}/web_emblem256.txt").read().strip()
LOGO=open(f"{SCRATCH}/web_logo512.txt").read().strip()
AVATAR=open(f"{SCRATCH}/web_avatar256.txt").read().strip()
def esc(s): return html.escape(str(s or ""))
content=json.load(open(f"{SCRATCH}/content.json",encoding="utf-8"))
calendar=json.load(open(f"{SCRATCH}/calendar.json",encoding="utf-8"))

CSS=r"""
*{margin:0;padding:0;box-sizing:border-box}
:root{--bg:#08090b;--panel:#101318;--panel2:#151922;--card:#12151b;--line:rgba(255,255,255,.07);--line2:rgba(255,255,255,.12);
 --gold:#E9B84A;--gold2:#C9982E;--gold-soft:rgba(233,184,74,.12);--gold-glow:rgba(233,184,74,.28);
 --ink:#EEF0F3;--ink2:#C6CAD2;--muted:#8A909B;--muted2:#5e646e;--ff-d:'Oswald',sans-serif;--ff:'Manrope',sans-serif}
body{background:var(--bg);color:var(--ink);font-family:var(--ff);line-height:1.6;-webkit-font-smoothing:antialiased;overflow-x:hidden}
#bgfx{position:fixed;inset:0;z-index:0;pointer-events:none}
.glow{position:fixed;z-index:0;pointer-events:none;filter:blur(80px);opacity:.5}
.glow.g1{top:-120px;right:-80px;width:520px;height:520px;background:radial-gradient(circle,rgba(233,184,74,.16),transparent 70%)}
.glow.g2{bottom:-160px;left:-100px;width:560px;height:560px;background:radial-gradient(circle,rgba(120,90,20,.14),transparent 70%)}
.wrap{position:relative;z-index:2;max-width:1120px;margin:0 auto;padding:26px 26px 80px}
.topnav{display:flex;align-items:center;gap:14px;padding:6px 2px 26px;border-bottom:1px solid var(--line);margin-bottom:30px}
.topnav img{width:40px;height:40px}
.topnav .bt{font-family:var(--ff-d);font-weight:600;font-size:17px;line-height:1}
.topnav .bt small{display:block;font-size:10px;letter-spacing:.18em;color:var(--gold);margin-top:3px;text-transform:uppercase;font-family:var(--ff);font-weight:600}
.home{margin-left:auto;display:inline-flex;align-items:center;gap:7px;color:var(--muted);font-size:13px;font-weight:600;text-decoration:none;padding:9px 14px;border:1px solid var(--line);border-radius:10px}
.home:hover{color:var(--gold);border-color:rgba(233,184,74,.4)}
.eyebrow{font-size:12px;font-weight:700;letter-spacing:.22em;text-transform:uppercase;color:var(--gold)}
h1{font-family:var(--ff-d);font-weight:700;text-transform:uppercase;font-size:clamp(30px,5vw,52px);line-height:1;margin:6px 0 14px}
.lead{font-size:17px;color:var(--ink2);max-width:760px;margin-bottom:28px}
h2.sub{font-family:var(--ff-d);font-weight:600;font-size:24px;margin:34px 0 16px}
svg.ic{width:16px;height:16px}
/* calendar */
.cal-legend{display:flex;flex-wrap:wrap;gap:14px;margin-bottom:18px}
.lg{display:flex;align-items:center;gap:6px;font-size:12.5px;color:var(--ink2)}.lg i{width:11px;height:11px;border-radius:3px;display:block}
.lg-reels i{background:#E9B84A}.lg-post i{background:#4AA3E9}.lg-carousel i{background:#8B5CF6}.lg-article i{background:#2CB67D}.lg-story i{background:#E9694A}.lg-live i{background:#E94A8B}
.cal-grid{display:grid;grid-template-columns:repeat(7,1fr);gap:8px}
.cal-wd{font-family:var(--ff-d);font-size:12px;color:var(--muted);text-align:center;padding-bottom:4px}
.cal-cell{min-height:104px;background:var(--card);border:1px solid var(--line);border-radius:12px;padding:9px;transition:.16s}
.cal-cell.has{background:linear-gradient(180deg,var(--panel2),var(--card))}
.cal-cell.has:hover{border-color:rgba(233,184,74,.4);transform:translateY(-2px)}
.cal-d{font-family:var(--ff-d);font-size:14px;color:var(--muted)}.cal-cell.has .cal-d{color:var(--gold)}
.cal-dots{display:flex;gap:3px;margin:5px 0}.dot{width:7px;height:7px;border-radius:2px;display:block}
.dot-reels{background:#E9B84A}.dot-post{background:#4AA3E9}.dot-carousel{background:#8B5CF6}.dot-article{background:#2CB67D}.dot-story{background:#E9694A}.dot-live{background:#E94A8B}
.cal-its{display:grid;gap:3px}
.cal-it{font-size:10.5px;line-height:1.3;color:var(--ink2);padding:3px 5px;border-radius:5px;background:rgba(255,255,255,.03);border-left:2px solid var(--muted2);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.it-reels{border-color:#E9B84A}.it-post{border-color:#4AA3E9}.it-carousel{border-color:#8B5CF6}.it-article{border-color:#2CB67D}.it-story{border-color:#E9694A}.it-live{border-color:#E94A8B}
.kpis{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:14px;margin-bottom:26px}
.kpi{background:linear-gradient(180deg,var(--panel2),var(--card));border:1px solid var(--line);border-radius:16px;padding:18px;position:relative;overflow:hidden}
.kpi:before{content:"";position:absolute;top:0;left:0;right:0;height:2px;background:linear-gradient(90deg,var(--gold),transparent)}
.kpi-v{font-family:var(--ff-d);font-weight:700;font-size:32px;line-height:1;background:linear-gradient(180deg,#fff,var(--gold));-webkit-background-clip:text;background-clip:text;-webkit-text-fill-color:transparent}
.kpi-l{font-size:13px;color:var(--ink2);margin-top:7px;font-weight:600}
/* brand */
.logos{display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:16px;margin-bottom:14px}
.lbox{border:1px solid var(--line);border-radius:16px;padding:34px;display:grid;place-items:center;min-height:190px;position:relative;overflow:hidden}
.lbox.dark{background:radial-gradient(circle at 50% 40%,#1a1d24,#0a0b0d)}
.lbox.light{background:#f3f4f6}.lbox.gold{background:linear-gradient(135deg,#E9B84A,#C9982E)}
.lbox img{max-width:74%;max-height:120px;object-fit:contain}
.lbox .cap{position:absolute;left:14px;bottom:12px;font-size:11px;color:var(--muted);font-family:var(--ff-d);letter-spacing:.08em;text-transform:uppercase}
.lbox.light .cap{color:#8a9099}
.sw{display:grid;grid-template-columns:repeat(auto-fit,minmax(130px,1fr));gap:12px;margin:16px 0 26px}
.swatch{border-radius:12px;border:1px solid var(--line);overflow:hidden;background:var(--card)}
.swatch .c{height:64px}.swatch .n{padding:9px 11px;font-size:12px}.swatch .n b{display:block;font-family:var(--ff-d);font-size:14px}
.dl{display:flex;flex-wrap:wrap;gap:10px;margin:8px 0 26px}
.dl a{display:inline-flex;align-items:center;gap:8px;background:var(--card);border:1px solid var(--line);border-radius:11px;padding:11px 16px;font-size:13px;font-weight:600;text-decoration:none;color:var(--ink)}
.dl a:hover{border-color:rgba(233,184,74,.45);color:var(--gold)}
.dl a.primary{background:linear-gradient(135deg,var(--gold),var(--gold2));color:#12130f;border:0}
.type-demo{background:var(--card);border:1px solid var(--line);border-radius:16px;padding:26px;margin-bottom:26px}
.rv{opacity:0;transform:translateY(14px);transition:.5s}.rv.in{opacity:1;transform:none}
@media(max-width:640px){.wrap{padding:20px 14px 60px}.cal-grid{gap:4px}.cal-cell{min-height:66px;padding:5px}.cal-its{display:none}.cal-d{font-size:12px}}
@media(prefers-reduced-motion:reduce){.rv{opacity:1;transform:none}}
"""
PARTICLES=r"""
const cv=document.getElementById('bgfx');if(cv&&!matchMedia('(prefers-reduced-motion:reduce)').matches){const cx=cv.getContext('2d');let W,H,P;
function rs(){W=cv.width=innerWidth;H=cv.height=innerHeight;const n=innerWidth<900?22:52;P=Array.from({length:n},()=>({x:Math.random()*W,y:Math.random()*H,r:Math.random()*1.5+.3,vx:(Math.random()-.5)*.14,vy:(Math.random()-.5)*.14,a:Math.random()*.5+.14}));}
rs();addEventListener('resize',rs);(function loop(){cx.clearRect(0,0,W,H);for(const p of P){p.x+=p.vx;p.y+=p.vy;if(p.x<0||p.x>W)p.vx*=-1;if(p.y<0||p.y>H)p.vy*=-1;cx.beginPath();cx.arc(p.x,p.y,p.r,0,7);cx.fillStyle='rgba(233,184,74,'+p.a+')';cx.fill();}requestAnimationFrame(loop);})();}
const io=new IntersectionObserver(es=>es.forEach(e=>{if(e.isIntersecting)e.target.classList.add('in')}),{threshold:.08});
document.querySelectorAll('.rv').forEach(e=>io.observe(e));
"""
ARROW='<svg class="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M14 5l-7 7 7 7" transform="rotate(180 12 12)"/></svg>'
BACK='<svg class="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 6l-6 6 6 6"/></svg>'

def shell(title,desc,body,extra_js=""):
    return f"""<!DOCTYPE html><html lang="ru"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<title>{esc(title)}</title><meta name="description" content="{esc(desc)}">
<style>{FONTS}
{CSS}</style></head><body>
<canvas id="bgfx"></canvas><div class="glow g1"></div><div class="glow g2"></div>
<div class="wrap">
<div class="topnav"><img src="{EMBLEM}" alt="Активити"><div class="bt">КЛАСТЕР<small>Витрина проекта</small></div>
<a class="home" href="/">{BACK} На главную</a></div>
{body}
</div><script>{PARTICLES}{extra_js}</script></body></html>"""

# ---------- content.html: calendar + plan ----------
def kpis_html(kpis):
    return '<div class="kpis">'+''.join(f'<div class="kpi rv"><div class="kpi-v">{esc(k["value"])}</div><div class="kpi-l">{esc(k["label"])}</div></div>' for k in kpis)+'</div>'
days=calendar.get("days",[])
tcolors={"reels":"reels","post":"post","carousel":"carousel","article":"article","story":"story","live":"live"}
tnames={"reels":"Reels","post":"Пост","carousel":"Карусель","article":"Статья","story":"Stories","live":"Эфир"}
leg="".join(f'<span class="lg lg-{v}"><i></i>{tnames[k]}</span>' for k,v in tcolors.items())
byday={d["day"]:d.get("items",[]) for d in days}
wd=["Пн","Вт","Ср","Чт","Пт","Сб","Вс"]
heads="".join(f'<div class="cal-wd">{w}</div>' for w in wd)
cells=[]
for d in range(1,31):
    items=byday.get(d,[])
    dots="".join(f'<i class="dot dot-{tcolors.get(it.get("type"),"post")}"></i>' for it in items[:4])
    titles="".join(f'<div class="cal-it it-{tcolors.get(it.get("type"),"post")}" title="{esc(it.get("title",""))}">{esc(it.get("title",""))[:40]}</div>' for it in items[:2])
    cells.append(f'<div class="cal-cell {"has" if items else ""}"><div class="cal-d">{d}</div><div class="cal-dots">{dots}</div><div class="cal-its">{titles}</div></div>')
total=sum(len(v) for v in byday.values())
cnt=content.get("content",{})
plan_kpis=cnt.get("kpis") or [{"value":"340","label":"Reels за 3 мес"},{"value":"32","label":"Карусели"},{"value":"36","label":"Посты Telegram"},{"value":"45","label":"Статьи"}]
cbody=f"""<div class="eyebrow rv">Контент-план · Месяц 1</div><h1 class="rv">Календарь контента</h1>
<p class="lead rv">{esc(cnt.get("intro","Контент-план месяца 1 по дням. Цвет обозначает формат, наведение показывает тему."))}</p>
{kpis_html(plan_kpis)}
<h2 class="sub rv">Календарь месяца 1 · {total} единиц</h2>
<div class="cal-legend rv">{leg}</div>
<div class="cal-grid rv">{heads}{"".join(cells)}</div>"""
open(f"{PUB}/content.html","w",encoding="utf-8").write(shell("Контент-план · Кластер","Календарь контента месяца 1: Reels, посты, карусели, статьи по дням.",cbody))
print("content.html", os.path.getsize(f"{PUB}/content.html")//1024,"KB")

# ---------- brand.html: logo showcase ----------
ZIP_HREF="/brand/aktiviti/LOGO_AKTIVITI_web.zip"
bbody=f"""<div class="eyebrow rv">Бренд · Логотип и стиль</div><h1 class="rv">Логотип «Активити»</h1>
<p class="lead rv">Фирменный знак бизнес-парка «Кластер» (ООО «Активити»): монограмма-«А» с вордмарком. Восстановлен по оригиналу и доведён до премиум-качества. Ниже начертания, палитра, шрифты и файлы во всех форматах.</p>
<div class="dl rv"><a class="primary" href="{ZIP_HREF}" download>Скачать пакет (ZIP, все форматы)</a>
<a href="/brand/aktiviti/logo.png" download>Логотип PNG</a>
<a href="/brand/aktiviti/emblem.png" download>Эмблема PNG</a>
<a href="/brand/aktiviti/emblem-mono.svg" download>Вектор SVG</a>
<a href="/brand/aktiviti/avatar.png" download>Аватар PNG</a></div>
<h2 class="sub rv">Начертания</h2>
<div class="logos rv">
 <div class="lbox dark"><img src="{LOGO}" alt="Логотип на тёмном"><span class="cap">Основной знак</span></div>
 <div class="lbox light"><img src="{LOGO}" alt="Логотип на светлом"><span class="cap">На светлом</span></div>
 <div class="lbox dark"><img src="{EMBLEM}" alt="Эмблема"><span class="cap">Эмблема</span></div>
 <div class="lbox dark"><img src="{AVATAR}" alt="Аватар"><span class="cap">Аватар · соцсети</span></div>
</div>
<h2 class="sub rv">Палитра</h2>
<div class="sw rv">
 <div class="swatch"><div class="c" style="background:#C9A233"></div><div class="n"><b>Золото</b>#C9A233</div></div>
 <div class="swatch"><div class="c" style="background:#E8A400"></div><div class="n"><b>Амбер</b>#E8A400</div></div>
 <div class="swatch"><div class="c" style="background:#14171C"></div><div class="n"><b>Графит</b>#14171C</div></div>
 <div class="swatch"><div class="c" style="background:#0A0B0D"></div><div class="n"><b>Глубокий</b>#0A0B0D</div></div>
</div>
<h2 class="sub rv">Типографика</h2>
<div class="type-demo rv">
 <div style="font-family:'Oswald';font-weight:700;font-size:40px;text-transform:uppercase;letter-spacing:.02em">Oswald — заголовки</div>
 <div style="font-family:'Manrope';font-size:17px;color:var(--ink2);margin-top:10px">Manrope — основной текст интерфейса и абзацы. Гуманистический гротеск, кириллица, веса 400 / 500 / 700.</div>
</div>
<h2 class="sub rv">Обзор пакета</h2>
<div class="lbox dark rv" style="min-height:auto;padding:16px"><img src="/brand/aktiviti/proof.jpg" alt="Обзор пакета лого" style="max-width:100%;max-height:none;border-radius:10px"></div>"""
open(f"{PUB}/brand.html","w",encoding="utf-8").write(shell("Логотип и бренд · Кластер","Логотип «Активити»: начертания, палитра, шрифты, файлы всех форматов.",bbody))
print("brand.html", os.path.getsize(f"{PUB}/brand.html")//1024,"KB")
