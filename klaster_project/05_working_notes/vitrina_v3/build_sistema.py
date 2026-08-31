#!/usr/bin/env python3
import markdown, json, os, html

ROOT="/home/user/OKO-TEAM/klaster_project"
RES=f"{ROOT}/05_working_notes/research"
OUT=f"{ROOT}/03_deliverables/system_oko/sistema-oko.html"
FONTS_CSS=open(f"{ROOT}/03_deliverables/website/assets/css/fonts.css").read()
LOGO=open(f"{ROOT}/03_deliverables/website/assets/logo/klaster-logo-horizontal.svg").read()
LOGO_W=open(f"{ROOT}/03_deliverables/website/assets/logo/klaster-logo-horizontal-white.svg").read()

md=markdown.Markdown(extensions=["tables","fenced_code","sane_lists","attr_list"])
def render(path):
    md.reset()
    return md.convert(open(path).read())

sections_md={
  "audience":("ЦА","analysis_audience.md"),
  "niche":("Ниша и тренды","analysis_niche_trends.md"),
  "sites":("Сайты конкурентов","analysis_competitor_sites.md"),
  "radialnya":("Канал @radialnya","analysis_radialnya.md"),
  "foundation":("Стратегия роста","growth_foundation.md"),
}
rendered={k:render(f"{RES}/{v[1]}") for k,v in sections_md.items()}
content_plan=render(f"{ROOT}/03_deliverables/content_plan/CONTENT_PLAN_M1.md")

comps=json.load(open(f"{RES}/competitors_all.json"))
comps_json=json.dumps(comps, ensure_ascii=False)

PLAT_LABEL={"site":"Сайт","telegram":"Telegram","youtube":"YouTube","instagram":"Instagram","tiktok":"TikTok","vc":"VC.ru","rbc":"РБК","dzen":"Дзен","vk":"ВК"}

# Extra authored sections: Обзор, SEO, Roadmap/KPI
overview=f"""
<div class="hero-s">
  <div class="eyebrow">Система OKO · Стратегия роста на 90 дней</div>
  <h1>Бизнес-парк «Кластер»</h1>
  <p class="big">Производство остаётся в Москве. Защищённое место для роста внутри МКАД, вне зоны КРТ, с двумя строящимися станциями метро.</p>
</div>
<div class="kpis">
  <div class="kpi"><b>50 000 м²</b><span>площадь комплекса</span></div>
  <div class="kpi"><b>100+</b><span>резидентов</span></div>
  <div class="kpi"><b>110</b><span>конкурентов в анализе</span></div>
  <div class="kpi"><b>6</b><span>отраслей ЦА</span></div>
  <div class="kpi"><b>340</b><span>Reels за 3 мес</span></div>
  <div class="kpi"><b>100%</b><span>цель: заполняемость</span></div>
</div>
<div class="callout">
  <b>Как читать систему.</b> Это рабочий штаб проекта: анализ рынка и ЦА, позиционирование и УТП,
  воронка, матрица контента и план на 90 дней. Разделы слева. Данные о конкурентах интерактивны:
  фильтруются по платформе и релевантности. Всё опирается на реальные данные объекта и проверенные
  источники. Тон коммуникации с клиентом: на «вы», экспертно.
</div>
"""

seo=f"""
<h1>SEO-ядро и семантика</h1>
<p class="lead-s">Стартовая семантика под аренду производственной недвижимости в Москве. Кластеры запросов ниже ложатся в структуру сайта (разделы, мета, статьи блога) и в темы статей РБК/VC/Дзен.</p>
<h2>Кластеры запросов</h2>
<table>
<thead><tr><th>Кластер</th><th>Ядро запросов</th><th>Куда</th></tr></thead>
<tbody>
<tr><td>Аренда производства</td><td>аренда производственного помещения Москва, аренда цеха, снять производство внутри МКАД, аренда производственно-складского помещения</td><td>Главная, каталог</td></tr>
<tr><td>Локация ЮАО</td><td>аренда производства ЮАО, производственное помещение у метро Царицыно, аренда цеха Бирюлёво, 6-я Радиальная</td><td>Раздел «Транспорт», лендинг</td></tr>
<tr><td>Склад</td><td>аренда склада Москва, теплый склад внутри МКАД, склад с рампой, ответственное хранение</td><td>Каталог, статья</td></tr>
<tr><td>Технопарк</td><td>технопарк Москва аренда, резидент технопарка, льготы технопарка</td><td>Раздел «Технопарк», статья</td></tr>
<tr><td>Параметры</td><td>помещение с кран-балкой аренда, потолки 9 метров, 100 кВт аренда, пол 4000 кг/м2</td><td>Раздел «Параметры», карточки лотов</td></tr>
<tr><td>Боль КРТ</td><td>КРТ производство снос, вывод производства из Москвы, куда переехать производству</td><td>Статьи РБК/VC/Дзен, блог</td></tr>
</tbody>
</table>
<h2>Технический SEO (сделано на сайте)</h2>
<ul>
<li>Мета title/description по каждому кластеру, Open Graph, canonical.</li>
<li>Schema.org RealEstateAgent + LocalBusiness (адрес, гео, телефон, рейтинг под отзывы).</li>
<li>robots.txt + sitemap.xml, человекопонятные URL, alt у изображений.</li>
<li>Скорость: самостоятельный хостинг шрифтов (base64), lazy-loading фото, PageSpeed-ориентир 95+.</li>
<li>Внутренняя перелинковка: главная → отрасли → каталог → заявка; блог → каталог.</li>
</ul>
<h2>Контент под SEO</h2>
<p>15 статей месяца (см. «Контент-план») закрывают информационные запросы кластера «Боль КРТ», «Технопарк», «Локация». Каждая статья ведёт на каталог и лид-магнит (чек-лист КРТ / калькулятор).</p>
"""

roadmap=f"""
<h1>Дорожная карта и KPI</h1>
<p class="lead-s">Три месяца по договору: фундамент, масштаб контента, полный захват алгоритмов. Метрики результата и точки контроля.</p>
<h2>Дорожная карта</h2>
<table>
<thead><tr><th>Месяц</th><th>Фокус</th><th>Контент</th><th>Ключевые вехи</th></tr></thead>
<tbody>
<tr><td>Месяц 1</td><td>Фундамент и запуск</td><td>30 Reels, 4 карусели, 12 постов, 15 статей</td><td>Сайт+бот, брендбук, оформление 5 соцсетей, воронка, старт Reels</td></tr>
<tr><td>Месяц 2</td><td>Масштаб контента</td><td>100 Reels, 8 каруселей, 12 постов, 15 статей</td><td>Разгон до 3-5 роликов/день, аналитика и корректировка стратегии</td></tr>
<tr><td>Месяц 3</td><td>Захват алгоритмов</td><td>210 Reels, 20 каруселей, 12 постов, 15 статей</td><td>7 роликов/день, финальная стратегия, итоговый отчёт</td></tr>
</tbody>
</table>
<h2>KPI (метрики результата)</h2>
<div class="kpis">
  <div class="kpi"><b>Заявки</b><span>главная метрика: лиды с сайта и соцсетей в отдел аренды</span></div>
  <div class="kpi"><b>Охваты</b><span>суммарные показы Reels/Shorts/TG, рост подписчиков @radialnya</span></div>
  <div class="kpi"><b>Трафик</b><span>визиты на сайт, глубина, конверсия в заявку</span></div>
  <div class="kpi"><b>Заполняемость</b><span>цель клиента: 100% занятых площадей</span></div>
</div>
<div class="callout">
  <b>Оговорка по договору.</b> Результаты (подписчики, охваты, заявки, выручка) не гарантированы и
  зависят от внешних факторов и алгоритмов (п.1.3). Наша зона ответственности: объём и качество
  работ по ТЗ, скорость и системность. Отчёт еженедельно, стратегические созвоны 2 раза в месяц.
</div>
<h2>Точки контроля</h2>
<ul>
<li>Еженедельный отчёт в рабочий чат: что сделано, метрики, план на неделю.</li>
<li>Аналитика каждые 2 недели: топ-ролики, антилидеры, корректировка тем и времени.</li>
<li>Ежемесячная корректировка стратегии по результатам (входит в договор).</li>
</ul>
"""

# open questions block
questions="""
<h1>Открытые вопросы к клиенту</h1>
<p class="lead-s">Не блокируют работу, но нужны для финализации. Держим в BRAND_FACTS, задаём Диане.</p>
<ul>
<li>Площадь комплекса: 50 000 м² (презентация) или 45 000 м² (вайрфрейм)? По умолчанию 50 000.</li>
<li>Публикация названий и логотипов резидентов (NDA по договору) — что можно показывать.</li>
<li>Домен сайта (для запуска и почты в едином стиле).</li>
<li>Формулировки про статус «Технопарк» до его получения (стоп-зона).</li>
<li>Стоп-слова и юридические ограничения по контенту.</li>
<li>Согласующая цепочка публикаций (Диана единолично или + директор/собственник).</li>
</ul>
"""

NAV=[("overview","Обзор"),("foundation","Стратегия роста"),("audience","Анализ ЦА"),
     ("niche","Ниша и тренды"),("competitors","Конкуренты · 110"),("sites","Сайты конкурентов"),
     ("radialnya","Канал @radialnya"),("contentplan","Контент-план М1"),("seo","SEO-ядро"),
     ("roadmap","Дорожная карта · KPI"),("questions","Вопросы клиенту")]

nav_html="\n".join(f'<a href="#" data-sec="{sid}">{lbl}</a>' for sid,lbl in NAV)

def sec(sid, body): return f'<section id="sec-{sid}" class="sec">{body}</section>'
body_sections="".join([
  sec("overview",overview),
  sec("foundation",rendered["foundation"]),
  sec("audience",rendered["audience"]),
  sec("niche",rendered["niche"]),
  sec("competitors",'<h1>Конкуренты и референсы · 110 карточек</h1><p class="lead-s">Реальные аккаунты и площадки с проверенными ссылками и честной оценкой аудитории. Фильтруйте по платформе и релевантности, ищите по названию. Поле «Перенести в Кластер» — что заимствуем.</p><div id="comp-app"></div>'),
  sec("sites",rendered["sites"]),
  sec("radialnya",rendered["radialnya"]),
  sec("contentplan",content_plan),
  sec("seo",seo),
  sec("roadmap",roadmap),
  sec("questions",questions),
])

CSS="""
:root{--amber:#E8A400;--amber-d:#C98A00;--amber-soft:#FFF6E0;--ink:#14171C;--dark:#0E1116;--bg:#F5F6F8;--muted:#6B7280;--line:#E6E8EC;--ok:#1F9D6B;--ff-d:'Oswald',sans-serif;--ff:'Manrope',sans-serif}
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:var(--ff);color:var(--ink);background:var(--bg);line-height:1.6}
.app{display:grid;grid-template-columns:270px 1fr;min-height:100vh}
.side{position:sticky;top:0;height:100vh;overflow-y:auto;background:var(--dark);color:#fff;padding:22px 16px}
.side .logo{height:34px;margin:6px 8px 20px}.side .logo svg{height:100%}
.side a{display:block;padding:11px 14px;border-radius:10px;color:rgba(255,255,255,.72);font-weight:600;font-size:14px;margin-bottom:2px;cursor:pointer;transition:.15s}
.side a:hover{background:rgba(255,255,255,.06);color:#fff}
.side a.active{background:var(--amber);color:var(--ink)}
.side .sidefoot{margin-top:20px;padding:14px;border-top:1px solid rgba(255,255,255,.1);font-size:12px;color:rgba(255,255,255,.4)}
.main{padding:0}
.topbar{position:sticky;top:0;z-index:5;background:rgba(245,246,248,.9);backdrop-filter:blur(10px);border-bottom:1px solid var(--line);padding:14px 40px;display:flex;align-items:center;gap:14px}
.topbar .t{font-family:var(--ff-d);font-weight:600;text-transform:uppercase;letter-spacing:.05em;font-size:14px;color:var(--muted)}
.wrap{max-width:1000px;margin:0 auto;padding:40px}
.sec{display:none;animation:fade .3s}.sec.on{display:block}
@keyframes fade{from{opacity:0;transform:translateY(8px)}to{opacity:1}}
h1{font-family:var(--ff-d);font-weight:700;text-transform:uppercase;font-size:clamp(26px,3.4vw,40px);line-height:1.05;margin:0 0 16px}
h2{font-family:var(--ff-d);font-weight:600;font-size:24px;margin:32px 0 12px;text-transform:none}
h3{font-family:var(--ff-d);font-weight:600;font-size:19px;margin:22px 0 8px;text-transform:none}
h4{font-family:var(--ff);font-weight:700;font-size:16px;margin:16px 0 6px}
p{margin:0 0 14px}
.wrap ul,.wrap ol{margin:0 0 16px 22px}.wrap li{margin-bottom:6px}
strong{font-weight:700}
blockquote{border-left:3px solid var(--amber);background:#fff;padding:12px 18px;border-radius:0 10px 10px 0;color:var(--muted);margin:0 0 18px;font-size:14px}
table{width:100%;border-collapse:collapse;margin:0 0 20px;background:#fff;border:1px solid var(--line);border-radius:10px;overflow:hidden;font-size:14px}
th{background:var(--dark);color:#fff;font-family:var(--ff-d);font-weight:500;text-align:left;padding:11px 14px;text-transform:uppercase;font-size:12px;letter-spacing:.03em}
td{padding:11px 14px;border-top:1px solid var(--line);vertical-align:top}
tr:nth-child(even) td{background:#fafbfc}
code{background:var(--amber-soft);padding:2px 6px;border-radius:5px;font-size:13px}
.eyebrow{font-family:var(--ff-d);font-weight:500;text-transform:uppercase;letter-spacing:.2em;font-size:13px;color:var(--amber-d);margin-bottom:10px}
.hero-s{background:var(--dark);color:#fff;border-radius:18px;padding:40px;margin-bottom:24px}
.hero-s h1{color:#fff}.hero-s .big{font-size:19px;color:rgba(255,255,255,.8);max-width:640px;margin:0}
.hero-s .eyebrow{color:var(--amber)}
.big{font-size:19px}
.lead-s{font-size:17px;color:var(--muted);margin-bottom:20px}
.kpis{display:grid;grid-template-columns:repeat(3,1fr);gap:14px;margin:22px 0}
.kpi{background:#fff;border:1px solid var(--line);border-radius:14px;padding:20px;border-top:3px solid var(--amber)}
.kpi b{font-family:var(--ff-d);font-size:28px;display:block;line-height:1}
.kpi span{font-size:13px;color:var(--muted)}
.callout{background:var(--amber-soft);border:1px solid #f0dfa8;border-radius:12px;padding:18px 20px;margin:18px 0;font-size:15px}
/* competitor app */
.comp-controls{display:flex;flex-wrap:wrap;gap:8px;margin:16px 0;position:sticky;top:52px;background:var(--bg);padding:8px 0;z-index:3}
.comp-controls input{flex:1;min-width:200px;padding:11px 14px;border:1.5px solid var(--line);border-radius:10px;font-family:var(--ff);font-size:14px}
.chip{background:#fff;border:1.5px solid var(--line);border-radius:20px;padding:8px 14px;font-size:13px;cursor:pointer;font-weight:600;transition:.15s}
.chip.on{background:var(--ink);color:#fff;border-color:var(--ink)}
.comp-count{font-size:13px;color:var(--muted);margin-bottom:12px}
.comp-grid{display:grid;grid-template-columns:repeat(2,1fr);gap:14px}
.comp{background:#fff;border:1px solid var(--line);border-radius:14px;padding:18px;border-left:3px solid var(--muted)}
.comp.high{border-left-color:var(--ok)}.comp.medium{border-left-color:var(--amber)}
.comp .ch{display:flex;justify-content:space-between;align-items:start;gap:10px}
.comp .nm{font-family:var(--ff-d);font-weight:600;font-size:17px}
.comp .pl{font-size:11px;font-weight:700;text-transform:uppercase;color:var(--amber-d);background:var(--amber-soft);padding:3px 8px;border-radius:6px;white-space:nowrap}
.comp .aud{font-size:13px;color:var(--muted);margin:4px 0 8px}
.comp a.u{font-size:12px;color:var(--amber-d);word-break:break-all;display:inline-block;margin-bottom:8px}
.comp .row{font-size:13px;margin-bottom:6px}.comp .row b{color:var(--ink)}
.comp .borrow{background:var(--amber-soft);border-radius:8px;padding:8px 10px;font-size:13px;margin-top:8px}
@media(max-width:900px){.app{grid-template-columns:1fr}.side{position:static;height:auto}.kpis,.comp-grid{grid-template-columns:1fr}.wrap{padding:24px}}
"""

JS="""
const secs=document.querySelectorAll('.sec');
const links=document.querySelectorAll('.side a');
function show(id){
  secs.forEach(s=>s.classList.toggle('on', s.id==='sec-'+id));
  links.forEach(a=>a.classList.toggle('active', a.dataset.sec===id));
  document.querySelector('.main').scrollTo(0,0); window.scrollTo(0,0);
  if(id==='competitors') renderComps();
  location.hash=id;
}
links.forEach(a=>a.addEventListener('click',e=>{e.preventDefault();show(a.dataset.sec)}));
// competitor app
const COMPS=__COMPS__;
const PL=__PL__;
let fPlat='all', fRel='all', q='';
function renderComps(){
  const app=document.getElementById('comp-app');
  if(app.dataset.built) { filterComps(); return; }
  app.dataset.built='1';
  const plats=['all',...Array.from(new Set(COMPS.map(c=>c.platform))).filter(Boolean)];
  const rels=['all','high','medium','low'];
  app.innerHTML=`
   <div class="comp-controls">
     <input id="cq" placeholder="Поиск по названию, позиционированию, ссылке...">
   </div>
   <div class="comp-controls" style="top:104px">
     ${plats.map(p=>`<button class="chip plat ${p==='all'?'on':''}" data-p="${p}">${p==='all'?'Все площадки':(PL[p]||p)}</button>`).join('')}
   </div>
   <div class="comp-controls" style="top:156px">
     ${rels.map(r=>`<button class="chip rel ${r==='all'?'on':''}" data-r="${r}">${r==='all'?'Вся релевантность':r}</button>`).join('')}
   </div>
   <div class="comp-count" id="cc"></div>
   <div class="comp-grid" id="cg"></div>`;
  app.querySelector('#cq').addEventListener('input',e=>{q=e.target.value.toLowerCase();filterComps()});
  app.querySelectorAll('.plat').forEach(b=>b.addEventListener('click',()=>{fPlat=b.dataset.p;app.querySelectorAll('.plat').forEach(x=>x.classList.toggle('on',x===b));filterComps()}));
  app.querySelectorAll('.rel').forEach(b=>b.addEventListener('click',()=>{fRel=b.dataset.r;app.querySelectorAll('.rel').forEach(x=>x.classList.toggle('on',x===b));filterComps()}));
  filterComps();
}
function filterComps(){
  const list=COMPS.filter(c=>(fPlat==='all'||c.platform===fPlat)&&(fRel==='all'||c.relevance===fRel)&&
    (!q||(c.name+c.positioning+c.url+c.borrow).toLowerCase().includes(q)));
  document.getElementById('cc').textContent=`Показано ${list.length} из ${COMPS.length}`;
  document.getElementById('cg').innerHTML=list.map(c=>{
    const top=(c.top||[]).filter(Boolean).map(t=>`<div class="row">• ${esc(String(t))}</div>`).join('');
    return `<div class="comp ${c.relevance}">
      <div class="ch"><div class="nm">${esc(c.name)}</div><div class="pl">${PL[c.platform]||c.platform}</div></div>
      <div class="aud">${esc(c.audience||'')}</div>
      ${c.url?`<a class="u" href="${esc(c.url)}" target="_blank" rel="noopener">${esc(c.url)}</a>`:''}
      ${c.positioning?`<div class="row"><b>Позиционирование:</b> ${esc(c.positioning)}</div>`:''}
      ${c.works?`<div class="row"><b>Что работает:</b> ${esc(c.works)}</div>`:''}
      ${top}
      ${c.borrow?`<div class="borrow"><b>Перенести в Кластер:</b> ${esc(c.borrow)}</div>`:''}
    </div>`}).join('');
}
function esc(s){return (s||'').replace(/[&<>"]/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[m]))}
// init
const h=location.hash.replace('#','')||'overview';
show(document.getElementById('sec-'+h)?h:'overview');
"""
JS=JS.replace("__COMPS__",comps_json).replace("__PL__",json.dumps(PLAT_LABEL,ensure_ascii=False))

htmlout=f"""<!DOCTYPE html><html lang="ru"><head><meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Система OKO · Бизнес-парк «Кластер»</title>
<style>{FONTS_CSS}
{CSS}</style></head>
<body><div class="app">
<aside class="side">
  <div class="logo">{LOGO_W}</div>
  <nav>{nav_html}</nav>
  <div class="sidefoot">Система OKO · v1 · 18.07.2026<br>OKO TEAM для ООО «Активити»<br>Тон: на «вы», экспертно.</div>
</aside>
<main class="main">
  <div class="topbar"><span class="t">Система роста · 90 дней</span></div>
  <div class="wrap">{body_sections}</div>
</main>
</div>
<script>{JS}</script>
</body></html>"""

os.makedirs(os.path.dirname(OUT),exist_ok=True)
open(OUT,"w").write(htmlout)
print("Система OKO:", os.path.getsize(OUT)//1024,"KB ->",OUT)
