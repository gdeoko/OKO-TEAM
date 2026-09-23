"""Страница админ-панели AMBERRY: разметка, стиль и поведение.

Один самодостаточный файл на браузер — ни одной внешней ссылки. Панель
стоит за паролем и туннелем; тянуть с чужих сайтов шрифты и библиотеки
значило бы сообщать им адрес панели и время каждого захода владельца.

Графики нарисованы SVG прямо в браузере, без библиотек: столбики и
ломаная по десятку точек — это двадцать строк кода, а любая готовая
библиотека весит сотни килобайт и живёт на CDN.

Цвета и шрифт — бренда: чёрный, неон #FF0A8C. Эмодзи в разметке нет,
значки нарисованы SVG — правило владельца.

Разделы:

    Сводка      плитки и графики: люди, деньги, работы, визиты
    Люди        таблица с поиском, блокировка и удаление
    Оплаты      кто и когда платил
    Работы      что считалось, чем кончилось
    Поддержка   переписка с людьми и ответ прямо отсюда
    Рассылка    письмо всем или части, с ходом отправки
    Услуги      ступени оплаты и цены видов работ, можно спрятать
    Каталог     прежняя страница кнопок, целиком

Данные страница берёт у `/api/*` (см. `admin.py`), ничего не считает
сама и ничего не хранит между заходами.
"""


def страница(знак_data_uri=""):
    знак = (f'<img class="знак" src="{знак_data_uri}" alt="">'
            if знак_data_uri else "")
    return ШАБЛОН.replace("{{ЗНАК}}", знак)


ШАБЛОН = r"""<!doctype html>
<html lang="ru"><head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<meta name="robots" content="noindex,nofollow">
<title>AMBERRY — панель</title>
<style>
:root{
  --неон:#FF0A8C; --неон2:#7A2BFF;
  --фон:#07060A; --карта:#121016; --край:#241F2C;
  --текст:#F3EFF7; --тихо:#9A93A8; --зелёный:#31D07A; --красный:#FF4D5E;
}
*{box-sizing:border-box}
html,body{margin:0;padding:0;background:var(--фон);color:var(--текст);
  font:15px/1.45 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;
  -webkit-text-size-adjust:100%}

/* ЖИВОЙ ФОН. Два размытых пятна неона, медленно плывущие по экрану.
   Дёшево (две точки градиента, без canvas и без скриптов) и не мешает
   читать цифры: всё, что выше, лежит на непрозрачных карточках. */
.фон{position:fixed;inset:0;z-index:0;overflow:hidden;pointer-events:none}
.пятно{position:absolute;width:60vmax;height:60vmax;border-radius:50%;
  filter:blur(90px);opacity:.30}
.пятно.а{background:radial-gradient(circle,var(--неон),transparent 65%);
  animation:плыть1 34s ease-in-out infinite}
.пятно.б{background:radial-gradient(circle,var(--неон2),transparent 65%);
  animation:плыть2 44s ease-in-out infinite}
@keyframes плыть1{
  0%{transform:translate(-18vw,-14vh)}
  50%{transform:translate(42vw,26vh)}
  100%{transform:translate(-18vw,-14vh)}}
@keyframes плыть2{
  0%{transform:translate(58vw,8vh)}
  50%{transform:translate(-6vw,52vh)}
  100%{transform:translate(58vw,8vh)}}
@media (prefers-reduced-motion:reduce){.пятно{animation:none}}

.верх{position:sticky;top:0;z-index:30;display:flex;align-items:center;
  gap:12px;padding:12px 16px;padding-top:calc(12px + env(safe-area-inset-top));
  background:rgba(7,6,10,.86);backdrop-filter:blur(14px);
  border-bottom:1px solid var(--край)}
.знак{width:26px;height:26px;border-radius:7px;display:block}
.имя{font-weight:800;letter-spacing:.14em;font-size:14px}
.раздел_имя{color:var(--тихо);font-size:13px;margin-left:auto}

.бургер{width:40px;height:34px;border:1px solid var(--край);border-radius:10px;
  background:var(--карта);display:grid;place-items:center;cursor:pointer;flex:none}
.бургер span,.бургер span::before,.бургер span::after{
  content:"";display:block;width:16px;height:2px;background:var(--текст);
  border-radius:2px;transition:transform .22s ease,opacity .22s ease}
.бургер span::before{transform:translateY(-5px)}
.бургер span::after{transform:translateY(3px)}
body.меню_открыто .бургер span{background:transparent}
body.меню_открыто .бургер span::before{transform:rotate(45deg)}
body.меню_открыто .бургер span::after{transform:rotate(-45deg) translateY(0)}

.тень{position:fixed;inset:0;z-index:38;background:rgba(0,0,0,.6);
  opacity:0;pointer-events:none;transition:opacity .2s}
body.меню_открыто .тень{opacity:1;pointer-events:auto}
.меню{position:fixed;z-index:40;top:0;bottom:0;left:0;width:252px;
  transform:translateX(-102%);transition:transform .24s ease;
  background:#0C0A11;border-right:1px solid var(--край);
  padding:16px 12px;padding-top:calc(16px + env(safe-area-inset-top));
  display:flex;flex-direction:column;gap:4px;overflow:auto}
body.меню_открыто .меню{transform:none}
.меню a{display:flex;align-items:center;gap:10px;padding:11px 12px;
  border-radius:11px;color:var(--текст);text-decoration:none;font-weight:600}
.меню a:hover{background:#17131F}
.меню a.тут{background:linear-gradient(90deg,rgba(255,10,140,.20),transparent);
  box-shadow:inset 2px 0 0 var(--неон)}
.меню svg{width:18px;height:18px;flex:none;stroke:var(--неон);fill:none;
  stroke-width:1.8;stroke-linecap:round;stroke-linejoin:round}
.меню .счёт{margin-left:auto;background:var(--неон);color:#fff;font-size:11px;
  font-weight:800;border-radius:999px;padding:1px 7px}

main{position:relative;z-index:1;padding:16px;max-width:1180px;margin:0 auto;
  padding-bottom:calc(32px + env(safe-area-inset-bottom))}
section{display:none}
section.тут{display:block;animation:въезд .22s ease}
@keyframes въезд{from{opacity:0;transform:translateY(8px)}to{opacity:1}}

h2{margin:0 0 14px;font-size:20px;letter-spacing:.01em}
h3{margin:0 0 10px;font-size:14px;color:var(--тихо);font-weight:700;
  letter-spacing:.08em;text-transform:uppercase}

.карта{background:var(--карта);border:1px solid var(--край);border-radius:16px;
  padding:16px;margin-bottom:14px}
.плитки{display:grid;gap:10px;margin-bottom:14px;
  grid-template-columns:repeat(auto-fill,minmax(150px,1fr))}
.плитка{background:var(--карта);border:1px solid var(--край);border-radius:14px;
  padding:13px 14px;position:relative;overflow:hidden}
.плитка::after{content:"";position:absolute;inset:auto 0 0 0;height:2px;
  background:linear-gradient(90deg,var(--неон),transparent)}
.плитка .цифра{font-size:25px;font-weight:800;letter-spacing:-.02em}
.плитка .подпись{color:var(--тихо);font-size:12px;margin-top:2px}
.плитка .прирост{color:var(--зелёный);font-size:12px;font-weight:700}

table{width:100%;border-collapse:collapse;font-size:14px}
th{text-align:left;color:var(--тихо);font-weight:700;font-size:12px;
  text-transform:uppercase;letter-spacing:.06em;padding:0 10px 8px}
td{padding:10px;border-top:1px solid var(--край);vertical-align:middle}
tr.заблокирован td{opacity:.45}
.обёртка{overflow-x:auto;-webkit-overflow-scrolling:touch}

input,textarea,select{width:100%;background:#0B0910;color:var(--текст);
  border:1px solid var(--край);border-radius:11px;padding:11px 13px;
  font:inherit;outline:none}
input:focus,textarea:focus,select:focus{border-color:var(--неон)}
textarea{min-height:120px;resize:vertical}
.кн{display:inline-flex;align-items:center;gap:7px;border:0;cursor:pointer;
  background:var(--неон);color:#fff;font-weight:700;font:inherit;font-weight:700;
  border-radius:11px;padding:10px 16px}
.кн.тихая{background:#1B1723;color:var(--текст);border:1px solid var(--край)}
.кн.опасная{background:#2A1016;color:var(--красный);
  border:1px solid rgba(255,77,94,.4)}
.кн:disabled{opacity:.5;cursor:default}
.ряд{display:flex;gap:10px;align-items:center;flex-wrap:wrap}

.метка{display:inline-block;font-size:11px;font-weight:800;border-radius:999px;
  padding:2px 9px;letter-spacing:.04em}
.метка.ок{background:rgba(49,208,122,.16);color:var(--зелёный)}
.метка.плохо{background:rgba(255,77,94,.16);color:var(--красный)}
.метка.тихо{background:#1B1723;color:var(--тихо)}

.пузырь{max-width:78%;padding:9px 13px;border-radius:14px;margin-bottom:8px;
  white-space:pre-wrap;word-break:break-word}
.пузырь.он{background:#191521;border-bottom-left-radius:5px}
.пузырь.мы{background:linear-gradient(135deg,var(--неон),var(--неон2));
  color:#fff;margin-left:auto;border-bottom-right-radius:5px}
.когда{font-size:11px;color:var(--тихо);margin-top:3px}

.пусто{color:var(--тихо);padding:22px 0;text-align:center}
.полоса{height:7px;border-radius:999px;background:#1B1723;overflow:hidden}
.полоса i{display:block;height:100%;background:var(--неон);transition:width .3s}
iframe{width:100%;height:78vh;border:1px solid var(--край);border-radius:16px;
  background:#000}
@media(max-width:560px){
  main{padding:12px}
  .плитка .цифра{font-size:21px}
  td,th{padding:8px 6px}
}

/* НА ТЕЛЕФОНЕ ТАБЛИЦА СТАНОВИТСЯ КАРТОЧКАМИ. Владелец смотрит панель
   с телефона (это записано в правилах проекта), а таблица с кнопками
   «Заблокировать» и «Удалить» в шесть столбцов уезжает за правый край:
   кнопки видны наполовину, и жать их приходится вслепую. Заголовок
   столбца переезжает к самой ячейке — атрибутом data-л. */
@media(max-width:700px){
  table.карточками, table.карточками tbody, table.карточками tr,
  table.карточками td{display:block;width:100%}
  table.карточками tr:first-child{display:none}
  table.карточками tr{background:#17131F;border:1px solid var(--край);
    border-radius:13px;padding:10px 12px;margin-bottom:10px}
  table.карточками td{border:0;padding:4px 0;display:flex;
    justify-content:space-between;align-items:center;gap:12px}
  table.карточками td::before{content:attr(data-л);color:var(--тихо);
    font-size:12px;text-transform:uppercase;letter-spacing:.06em}
  table.карточками td:last-child{padding-top:10px}
  table.карточками td:last-child::before{content:""}
  table.карточками .ряд{width:100%}
  table.карточками .ряд .кн{flex:1;justify-content:center}
}
</style></head>
<body>
<div class="фон"><div class="пятно а"></div><div class="пятно б"></div></div>

<div class="верх">
  <button class="бургер" id="бургер" aria-label="Меню"><span></span></button>
  {{ЗНАК}}<div class="имя">AMBERRY</div>
  <div class="раздел_имя" id="где"></div>
</div>

<div class="тень" id="тень"></div>
<nav class="меню" id="меню"></nav>

<main>
  <section id="р_сводка" class="тут">
    <h2>Сводка</h2>
    <div class="плитки" id="плитки"></div>
    <div class="карта"><h3>Новые люди за 30 дней</h3><div id="г_люди"></div></div>
    <div class="карта"><h3>Куплено коинов за 30 дней</h3><div id="г_деньги"></div></div>
    <div class="карта"><h3>Генерации за 30 дней</h3><div id="г_работы"></div></div>
    <div class="карта"><h3>Что нажимают чаще всего</h3><div id="г_кнопки"></div></div>
  </section>

  <section id="р_люди">
    <h2>Люди</h2>
    <div class="карта">
      <div class="ряд"><input id="поиск" placeholder="id или @имя"
        style="flex:1;min-width:180px"><button class="кн" id="искать">Найти</button></div>
    </div>
    <div class="карта обёртка"><div id="т_люди"></div></div>
  </section>

  <section id="р_оплаты"><h2>Оплаты</h2>
    <div class="карта обёртка"><div id="т_оплаты"></div></div></section>

  <section id="р_работы"><h2>Генерации</h2>
    <div class="карта обёртка"><div id="т_работы"></div></div></section>

  <section id="р_поддержка"><h2>Поддержка</h2>
    <div class="карта" id="сп_диалоги"></div>
    <div class="карта" id="сп_переписка" style="display:none"></div></section>

  <section id="р_рассылка"><h2>Рассылка</h2>
    <div class="карта">
      <h3>Новое письмо</h3>
      <div class="ряд" style="margin-bottom:10px">
        <select id="кому" style="max-width:220px">
          <option value="всем">Всем</option>
          <option value="платившим">Только платившим</option>
          <option value="без оплат">Только без оплат</option>
        </select>
        <span class="когда" id="сколько_кому"></span>
      </div>
      <textarea id="письмо" placeholder="Текст письма. Можно &lt;b&gt;жирным&lt;/b&gt;."></textarea>
      <div class="ряд" style="margin-top:10px">
        <button class="кн" id="послать">Отправить</button>
        <span class="когда" id="ход"></span>
      </div>
      <div class="полоса" style="margin-top:10px"><i id="полоса" style="width:0"></i></div>
    </div>
    <div class="карта obёртка"><h3>Прошлые рассылки</h3><div id="т_рассылки"></div></div>
  </section>

  <section id="р_услуги"><h2>Услуги</h2>
    <div class="карта"><h3>Ступени оплаты</h3><div id="т_пакеты"></div></div>
    <div class="карта"><h3>Цены видов работ</h3><div id="т_работы_цены"></div></div>
  </section>

  <section id="р_франшиза"><h2>Франшиза</h2>
    <div class="карта" id="фр_итого"></div>
    <div class="карта обёртка"><div id="т_франшиза"></div></div>
    <div class="карта"><h3>О выплатах</h3>
      <p class="когда" style="margin:0">Панель только считает, сколько
      причитается партнёру. Перевод делает владелец руками: он необратим,
      а ошибка в доле или в реквизитах не откатывается ничем. После
      перевода впишите сумму в «Выплачено».</p></div>
  </section>

  <section id="р_каталог"><h2>Каталог кнопок</h2>
    <div class="карта" style="padding:8px"><iframe src="/каталог" title="Каталог"></iframe></div>
  </section>
</main>

<script>
const $ = s => document.querySelector(s);
/* Кириллица в адресной строке живёт процентами: `#люди` браузер
   отдаёт как `#%D0%BB%D1%8E%D0%B4%D0%B8`, и сравнение с «люди» не
   сходится — панель молча оставалась на сводке. */
const хэш = () => { try { return decodeURIComponent(location.hash.slice(1)); }
                    catch(e){ return ""; } };
const эк = s => String(s==null?"":s).replace(/[&<>"]/g,
  c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
const дата = t => t ? new Date(t*1000).toLocaleString("ru-RU",
  {day:"2-digit",month:"2-digit",hour:"2-digit",minute:"2-digit"}) : "";

const РАЗДЕЛЫ = [
  ["сводка","Сводка","M3 13h4l3 7 4-16 3 9h4"],
  ["люди","Люди","M16 19v-1a4 4 0 0 0-8 0v1M12 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6"],
  ["оплаты","Оплаты","M3 7h18v10H3zM3 11h18"],
  ["работы","Генерации","M4 5h16v14H4zM8 5v14M4 9h16"],
  ["поддержка","Поддержка","M21 12a8 8 0 1 1-3-6.2L21 4v6h-6"],
  ["рассылка","Рассылка","M3 6l9 6 9-6M3 6h18v12H3z"],
  ["услуги","Услуги","M12 3v18M7 7h7a3 3 0 0 1 0 6H8a3 3 0 0 0 0 6h8"],
  ["франшиза","Франшиза","M5 20h14M7 20V9l5-5 5 5v11M10 20v-5h4v5"],
  ["каталог","Каталог","M4 5h7v14H4zM13 5h7v14h-7z"],
];
let непрочитано = 0;

function меню(){
  $("#меню").innerHTML = РАЗДЕЛЫ.map(([к,имя,d]) =>
    `<a href="#${к}" data-к="${к}">
       <svg viewBox="0 0 24 24"><path d="${d}"/></svg>${имя}
       ${к==="поддержка"&&непрочитано?`<span class="счёт">${непрочитано}</span>`:""}
     </a>`).join("");
}

function открыть(к){
  к = РАЗДЕЛЫ.some(р => р[0]===к) ? к : "сводка";
  document.querySelectorAll("section").forEach(s => s.classList.remove("тут"));
  $("#р_"+к).classList.add("тут");
  document.querySelectorAll(".меню a").forEach(a =>
    a.classList.toggle("тут", a.dataset.к===к));
  $("#где").textContent = (РАЗДЕЛЫ.find(р=>р[0]===к)||[])[1] || "";
  document.body.classList.remove("меню_открыто");
  (ЗАГРУЗКА[к]||(()=>{}))();
}

$("#бургер").onclick = () => document.body.classList.toggle("меню_открыто");
$("#тень").onclick = () => document.body.classList.remove("меню_открыто");
addEventListener("hashchange", () => открыть(хэш()));

async function взять(п){
  const о = await fetch(п, {headers:{"Accept":"application/json"}});
  if(!о.ok) throw new Error(await о.text());
  return о.json();
}
async function послать(п, тело){
  const о = await fetch(п, {method:"POST",
    headers:{"Content-Type":"application/json"}, body:JSON.stringify(тело)});
  const д = await о.json().catch(()=>({}));
  if(!о.ok) throw new Error(д.ошибка || о.status);
  return д;
}

/* ---------- графики ---------- */
/* Столбики: по одному на день. Подписей у столбиков нет нарочно —
   тридцать дат на телефоне превращаются в серую кашу; вместо них
   подпись у крайних и всплывающая у каждого. */
function столбики(куда, пары, цвет){
  const у = $(куда);
  if(!пары || !пары.length){ у.innerHTML = '<div class="пусто">Пока пусто</div>'; return; }
  const Ш=Math.max(pairsШ(пары),300), В=140, макс=Math.max(...пары.map(p=>p[1]),1);
  const ш = Ш/пары.length;
  const столб = пары.map((p,i)=>{
    const h = Math.max(2, p[1]/макс*(В-26));
    return `<rect x="${i*ш+ш*0.15}" y="${В-18-h}" width="${ш*0.7}" height="${h}"
      rx="2" fill="${цвет}"><title>${эк(p[0])}: ${p[1]}</title></rect>`;
  }).join("");
  у.innerHTML =
    `<svg viewBox="0 0 ${Ш} ${В}" width="100%" height="${В}" preserveAspectRatio="none">
       ${столб}
     </svg>
     <div class="когда" style="display:flex;justify-content:space-between">
       <span>${эк(пары[0][0])}</span><span>макс ${макс}</span>
       <span>${эк(пары[пары.length-1][0])}</span></div>`;
}
const pairsШ = п => п.length*18;

function полосы(куда, пары){
  const у = $(куда);
  if(!пары.length){ у.innerHTML='<div class="пусто">Пока пусто</div>'; return; }
  const макс = Math.max(...пары.map(p=>p.сколько),1);
  у.innerHTML = пары.map(p=>`
    <div style="margin-bottom:9px">
      <div class="ряд" style="justify-content:space-between">
        <span>${эк(p.имя)}</span><b>${p.сколько}</b></div>
      <div class="полоса"><i style="width:${p.сколько/макс*100}%"></i></div>
    </div>`).join("");
}

/* ---------- разделы ---------- */
const ЗАГРУЗКА = {
  async сводка(){
    const д = await взять("/api/сводка");
    непрочитано = д.поддержка_новых; меню(); открыть_подсветить();
    const пл = [
      ["Людей", д.людей, д.людей_сутки ? "+"+д.людей_сутки+" за сутки" : ""],
      ["Платящих", д.платящих, ""],
      ["Куплено коинов", д.куплено, ""],
      ["Потрачено коинов", д.потрачено, ""],
      ["Генераций", д.работ, д.работ_сутки ? "+"+д.работ_сутки+" за сутки" : ""],
      ["Осечек", д.брака, ""],
      ["Писем без ответа", д.поддержка_новых, ""],
      ["Заблокированных", д.заблокированных, ""],
    ];
    $("#плитки").innerHTML = пл.map(([п,ц,пр])=>`
      <div class="плитка"><div class="цифра">${ц}</div>
        <div class="подпись">${п}</div>
        ${пр?`<div class="прирост">${пр}</div>`:""}</div>`).join("");
    столбики("#г_люди", д.новые_по_дням, "var(--неон)");
    столбики("#г_деньги", д.деньги_по_дням, "#7A2BFF");
    столбики("#г_работы", д.работы_по_дням, "#31D07A");
    полосы("#г_кнопки", д.топ_кнопок);
  },

  async люди(){
    const д = await взять("/api/люди?поиск="+encodeURIComponent($("#поиск").value||""));
    $("#т_люди").innerHTML = д.люди.length ? `<table class="карточками">
      <tr><th>Кто</th><th>Пришёл</th><th>Баланс</th><th>Куплено</th>
          <th>Работ</th><th></th></tr>
      ${д.люди.map(ч=>`<tr class="${ч.blocked?"заблокирован":""}">
        <td data-л="Кто"><b>${ч.username?"@"+эк(ч.username):эк(ч.tg_id)}</b>
            <div class="когда">${эк(ч.tg_id)}</div></td>
        <td data-л="Пришёл">${дата(ч.created_at)}</td>
        <td data-л="Баланс">${ч.баланс}</td>
        <td data-л="Куплено">${ч.куплено}</td>
        <td data-л="Работ">${ч.работ}</td>
        <td><div class="ряд">
          <button class="кн тихая" data-блок="${ч.tg_id}" data-как="${ч.blocked?0:1}">
            ${ч.blocked?"Разблокировать":"Заблокировать"}</button>
          <button class="кн опасная" data-удалить="${ч.tg_id}">Удалить</button>
        </div></td></tr>`).join("")}</table>` :
      '<div class="пусто">Никого не нашлось</div>';
  },

  async оплаты(){
    const д = await взять("/api/оплаты");
    $("#т_оплаты").innerHTML = д.оплаты.length ? `<table class="карточками">
      <tr><th>Когда</th><th>Кто</th><th>Коинов</th><th>За что</th></tr>
      ${д.оплаты.map(о=>`<tr><td data-л="Когда">${дата(о.at)}</td>
        <td data-л="Кто">${о.username?"@"+эк(о.username):эк(о.tg_id)}</td>
        <td data-л="Коинов"><b>+${о.delta}</b></td>
        <td data-л="За что">${эк(о.reason)}</td></tr>`).join("")}</table>` :
      '<div class="пусто">Оплат пока нет</div>';
  },

  async работы(){
    const д = await взять("/api/работы");
    $("#т_работы").innerHTML = д.работы.length ? `<table class="карточками">
      <tr><th>Когда</th><th>Кто</th><th>Что</th><th>Коинов</th><th>Итог</th></tr>
      ${д.работы.map(р=>`<tr><td data-л="Когда">${дата(р.at)}</td>
        <td data-л="Кто">${р.username?"@"+эк(р.username):эк(р.tg_id)}</td>
        <td data-л="Что">${эк(р.имя||р.kind)}</td>
        <td data-л="Коинов">${р.coins}</td>
        <td data-л="Итог"><span class="метка ${р.state==="ok"?"ок":(р.state==="err"?"плохо":"тихо")}">
          ${р.state==="ok"?"готово":(р.state==="err"?"осечка":"считает")}</span>
          ${р.error?`<div class="когда">${эк(р.error).slice(0,80)}</div>`:""}</td>
        </tr>`).join("")}</table>` :
      '<div class="пусто">Генераций пока нет</div>';
  },

  async поддержка(){
    $("#сп_переписка").style.display = "none";
    const д = await взять("/api/поддержка");
    непрочитано = д.диалоги.reduce((s,x)=>s+x.новых,0); меню(); открыть_подсветить();
    $("#сп_диалоги").innerHTML = д.диалоги.length ? `<table>
      <tr><th>Кто</th><th>Последнее</th><th>Писем</th><th></th></tr>
      ${д.диалоги.map(р=>`<tr><td>
        <b>${р.username?"@"+эк(р.username):эк(р.tg_id)}</b>
        ${р.новых?`<span class="счёт" style="background:var(--неон);color:#fff;
          border-radius:999px;padding:1px 7px;font-size:11px">${р.новых}</span>`:""}
        </td><td>${дата(р.at)}</td><td>${р.всего}</td>
        <td><button class="кн тихая" data-диалог="${р.tg_id}">Открыть</button></td>
      </tr>`).join("")}</table>` :
      '<div class="пусто">Писем пока не было</div>';
  },

  async рассылка(){
    const д = await взять("/api/рассылки");
    $("#т_рассылки").innerHTML = д.рассылки.length ? `<table>
      <tr><th>Когда</th><th>Кому</th><th>Дошло</th><th>Отказ</th><th>Итог</th></tr>
      ${д.рассылки.map(р=>`<tr><td>${дата(р.at)}</td><td>${эк(р.кому)}</td>
        <td>${р.дошло} из ${р.всего}</td><td>${р.отказ}</td>
        <td><span class="метка ${р.состояние==="готова"?"ок":"тихо"}">
          ${эк(р.состояние)}</span></td></tr>`).join("")}</table>` :
      '<div class="пусто">Рассылок ещё не было</div>';
    ход();
  },

  async услуги(){
    const д = await взять("/api/услуги");
    $("#т_пакеты").innerHTML = `<div class="обёртка"><table class="карточками">
      <tr><th>Ступень</th><th>Коинов</th><th>Рублей</th><th>За коин</th>
          <th>Скидка</th><th></th></tr>
      ${д.пакеты.map(п=>`<tr class="${п.скрыт?"заблокирован":""}">
        <td data-л="Ступень">${эк(п.ид)}</td>
        <td data-л="Коинов">${п.коинов}</td>
        <td data-л="Рублей">${п.рублей} ₽</td>
        <td data-л="За коин">${п.за_коин} ₽</td>
        <td data-л="Скидка">${п.скидка}%</td>
        <td><button class="кн тихая" data-пакет="${п.ид}" data-как="${п.скрыт?0:1}">
          ${п.скрыт?"Вернуть":"Убрать"}</button></td></tr>`).join("")}
      </table></div>`;
    $("#т_работы_цены").innerHTML = `<div class="обёртка"><table>
      <tr><th>Вид работы</th><th>Коинов</th></tr>
      ${д.работы.map(р=>`<tr><td>${эк(р.имя)}</td><td>${р.коинов}</td></tr>`).join("")}
      </table></div>`;
  },

  async франшиза(){
    const д = await взять("/api/франшиза");
    $("#фр_итого").innerHTML = `
      <div class="плитки" style="margin:0">
        <div class="плитка"><div class="цифра">${д.партнёры.length}</div>
          <div class="подпись">Партнёров</div></div>
        <div class="плитка"><div class="цифра">${д.к_выплате_всего}</div>
          <div class="подпись">К выплате, ₽</div></div>
        <div class="плитка"><div class="цифра">${д.цена_руб} ₽</div>
          <div class="подпись">Цена франшизы</div></div>
      </div>`;
    $("#т_франшиза").innerHTML = д.партнёры.length ? `<table class="карточками">
      <tr><th>Кто</th><th>Бот</th><th>Состояние</th><th>Выручка</th>
          <th>Доля</th><th>Выплачено</th><th>К выплате</th><th></th></tr>
      ${д.партнёры.map(п=>`<tr>
        <td data-л="Кто"><b>${п.username?"@"+эк(п.username):эк(п.tg_id)}</b>
          <div class="когда">${эк(п.tg_id)}</div></td>
        <td data-л="Бот">${эк(п.бот||"-")}
          ${п.есть_токен?`<div class="когда">токен ${эк(п.токен_хвост)}
            <button class="кн тихая" style="padding:2px 8px;font-size:11px"
              data-токен="${п.tg_id}">показать</button></div>`:""}</td>
        <td data-л="Состояние"><select data-сост="${п.tg_id}"
            style="max-width:150px">
          ${["ждёт токен","в работе","запущен","остановлен"].map(с=>
            `<option${с===п.состояние?" selected":""}>${с}</option>`).join("")}
        </select></td>
        <td data-л="Выручка"><input data-поле="выручка" data-кто="${п.tg_id}"
          value="${п.выручка}" inputmode="numeric" style="max-width:110px"></td>
        <td data-л="Доля"><input data-поле="доля" data-кто="${п.tg_id}"
          value="${п.доля}" inputmode="numeric" style="max-width:80px"></td>
        <td data-л="Выплачено"><input data-поле="выплачено" data-кто="${п.tg_id}"
          value="${п.выплачено}" inputmode="numeric" style="max-width:110px"></td>
        <td data-л="К выплате"><b>${п.к_выплате}</b></td>
        <td><button class="кн" data-учёт="${п.tg_id}">Записать</button></td>
      </tr>`).join("")}</table>` :
      '<div class="пусто">Франшизу ещё никто не купил</div>';
  },

  каталог(){},
};

function открыть_подсветить(){
  const к = хэш() || "сводка";
  document.querySelectorAll(".меню a").forEach(a =>
    a.classList.toggle("тут", a.dataset.к===к));
}

/* ---------- действия ---------- */
document.addEventListener("click", async e => {
  const б = e.target.closest("button");
  if(!б) return;
  try{
    if(б.dataset.блок){
      await послать("/api/человек/блок",
        {tg_id:+б.dataset.блок, блок: б.dataset.как==="1"});
      ЗАГРУЗКА.люди();
    } else if(б.dataset.удалить){
      if(!confirm("Удалить человека и всю его историю? Это не отменить."))
        return;
      await послать("/api/человек/удалить", {tg_id:+б.dataset.удалить});
      ЗАГРУЗКА.люди();
    } else if(б.dataset.диалог){
      открыть_диалог(+б.dataset.диалог);
    } else if(б.dataset.токен){
      const д = await взять("/api/франшиза/токен/"+б.dataset.токен);
      prompt("Токен бота партнёра (скопируйте и закройте):", д.токен||"");
    } else if(б.dataset["учёт"]){
      const кто = б.dataset["учёт"];
      const поле = и => {
        const э = document.querySelector(
          `input[data-кто="${кто}"][data-поле="${и}"]`);
        return э ? +э.value || 0 : undefined;
      };
      await послать("/api/франшиза/учёт", {tg_id:+кто,
        выручка:поле("выручка"), доля:поле("доля"),
        выплачено:поле("выплачено")});
      ЗАГРУЗКА.франшиза();
    } else if(б.dataset.пакет){
      await послать("/api/услуги/спрятать",
        {ид:б.dataset.пакет, скрыт: б.dataset.как==="1"});
      ЗАГРУЗКА.услуги();
    } else if(б.id==="искать"){
      ЗАГРУЗКА.люди();
    } else if(б.id==="послать"){
      const т = $("#письмо").value.trim();
      if(!т) return;
      if(!confirm("Отправить письмо? Отменить будет нельзя.")) return;
      б.disabled = true;
      await послать("/api/рассылка", {текст:т, кому:$("#кому").value});
      $("#письмо").value = "";
      ход();
    } else if(б.id==="назад_к_списку"){
      ЗАГРУЗКА.поддержка();
    } else if(б.id==="ответить"){
      const т = $("#ответ").value.trim();
      if(!т) return;
      б.disabled = true;
      const д = await послать("/api/поддержка/ответ",
        {tg_id:+б.dataset.кому, текст:т});
      б.disabled = false;
      if(!д.ушло){ alert("Телеграм не принял: "+(д.почему||"")); return; }
      $("#ответ").value = "";
      открыть_диалог(+б.dataset.кому);
    }
  }catch(ош){ alert("Не вышло: "+ош.message); б.disabled = false; }
});

async function открыть_диалог(id){
  const д = await взять("/api/поддержка/"+id);
  $("#сп_диалоги").style.display = "none";
  const о = $("#сп_переписка");
  о.style.display = "";
  о.innerHTML = `
    <div class="ряд" style="justify-content:space-between;margin-bottom:12px">
      <b>${д.username?"@"+эк(д.username):эк(id)}</b>
      <button class="кн тихая" id="назад_к_списку">К списку</button></div>
    <div style="max-height:52vh;overflow:auto;margin-bottom:12px">
      ${д.письма.map(п=>`<div class="пузырь ${п.откого==="мы"?"мы":"он"}">
        ${эк(п.текст)}<div class="когда">${дата(п.at)}</div></div>`).join("")}
    </div>
    <textarea id="ответ" placeholder="Ответ человеку"></textarea>
    <div class="ряд" style="margin-top:10px">
      <button class="кн" id="ответить" data-кому="${id}">Ответить</button></div>`;
  o_прокрутить(о);
}
function o_прокрутить(о){
  const л = о.querySelector("div[style*='overflow:auto']");
  if(л) л.scrollTop = л.scrollHeight;
}

/* Ход рассылки опрашивается раз в две секунды и только пока она идёт:
   полоса, которая дёргается на пустом месте, читается как поломка. */
let таймер = null;
async function ход(){
  clearTimeout(таймер);
  const д = await взять("/api/рассылка/ход");
  const с = д.ход;
  if(с.ид){
    const всё = с.дошло + с.отказ;
    $("#ход").textContent = `идёт: ${всё} из ${с.всего}, отказов ${с.отказ}`;
    $("#полоса").style.width = (с.всего ? всё/с.всего*100 : 0) + "%";
    $("#послать").disabled = true;
    таймер = setTimeout(ход, 2000);
  } else {
    $("#ход").textContent = "";
    $("#полоса").style.width = "0";
    $("#послать").disabled = false;
    ЗАГРУЗКА.рассылка_список && ЗАГРУЗКА.рассылка_список();
  }
}

$("#поиск").addEventListener("keydown", e => { if(e.key==="Enter") ЗАГРУЗКА.люди(); });
document.addEventListener("change", async e => {
  const с = e.target.closest("select[data-сост]");
  if(!с) return;
  try{
    await послать("/api/франшиза/состояние",
      {tg_id:+с.dataset["сост"], состояние:с.value});
    ЗАГРУЗКА.франшиза();
  }catch(ош){ alert("Не вышло: "+ош.message); }
});

$("#кому").addEventListener("change", сколько_кому);
async function сколько_кому(){
  const д = await взять("/api/рассылка/сколько?кому="+
    encodeURIComponent($("#кому").value));
  $("#сколько_кому").textContent = "адресатов: " + д.сколько;
}

меню();
открыть(хэш());
сколько_кому().catch(()=>{});
</script>
</body></html>
"""
