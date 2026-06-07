<?php require_once __DIR__ . '/../config.php'; ?>
<!doctype html>
<html lang="ru">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no">
<meta name="robots" content="noindex,nofollow">
<title>DUCK'S — Админ-панель</title>
<link href="https://fonts.googleapis.com/css2?family=Orbitron:wght@500;700;900&family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet">
<script src="https://cdn.jsdelivr.net/npm/jsqr@1.4.0/dist/jsQR.js"></script>
<style>
:root{--red:#cc0000;--bg:#080808;--card:#101012;--card2:#15151a;--line:#222;--txt:#eaeaea;--mut:#8a8a92;}
*{box-sizing:border-box;-webkit-tap-highlight-color:transparent;}
html,body{margin:0;padding:0;background:var(--bg);color:var(--txt);font-family:Inter,system-ui,sans-serif;}
body{min-height:100vh;overflow-x:hidden;}
/* анимированный фон */
.bgfx{position:fixed;inset:0;z-index:0;overflow:hidden;pointer-events:none;}
.orb{position:absolute;border-radius:50%;filter:blur(60px);opacity:.5;animation:float 18s ease-in-out infinite;}
.orb.a{width:340px;height:340px;background:radial-gradient(circle,#cc000088,transparent 70%);top:-80px;left:-60px;}
.orb.b{width:300px;height:300px;background:radial-gradient(circle,#5a000066,transparent 70%);bottom:-60px;right:-40px;animation-delay:-6s;}
.orb.c{width:260px;height:260px;background:radial-gradient(circle,#ff224455,transparent 70%);top:40%;left:55%;animation-delay:-11s;}
@keyframes float{0%,100%{transform:translate(0,0) scale(1);}33%{transform:translate(40px,-30px) scale(1.1);}66%{transform:translate(-30px,30px) scale(.95);}}
.scan{position:fixed;inset:0;z-index:1;pointer-events:none;background:repeating-linear-gradient(0deg,transparent 0 3px,#0000000d 3px 4px);opacity:.4;}
/* логин */
#login{position:fixed;inset:0;z-index:50;display:flex;align-items:center;justify-content:center;flex-direction:column;background:radial-gradient(120% 100% at 50% 0%,#1a0000,#050505);}
#login img.duck{width:96px;height:auto;filter:drop-shadow(0 8px 24px rgba(204,0,0,.5));}
h3[data-ico]{display:flex;align-items:center;gap:8px;}
h3[data-ico] .ico{color:var(--red);flex:0 0 auto;}
.nav button .ico{margin-right:5px;color:inherit;}
.nav button{display:inline-flex;align-items:center;justify-content:center;}
#login .brand{font-family:Orbitron;font-weight:900;font-size:30px;letter-spacing:4px;margin:6px 0 2px;}
#login .brand span{color:var(--red);}
#login .sub{color:var(--mut);letter-spacing:5px;font-size:11px;margin-bottom:30px;}
.dots{display:flex;gap:14px;margin-bottom:24px;}
.dots i{width:16px;height:16px;border-radius:50%;border:2px solid #444;transition:.2s;}
.dots i.on{background:var(--red);border-color:var(--red);box-shadow:0 0 12px var(--red);}
.pad{display:grid;grid-template-columns:repeat(3,72px);gap:14px;}
.pad button{height:72px;border-radius:50%;border:1px solid var(--line);background:#111;color:#fff;font-size:24px;font-weight:600;cursor:pointer;transition:.15s;}
.pad button:active{background:var(--red);transform:scale(.94);}
.pad button.wide{border:none;background:transparent;font-size:15px;color:var(--mut);}
#login .err{color:var(--red);height:18px;margin-top:12px;font-size:13px;}
/* shell */
#app{position:relative;z-index:2;display:none;max-width:980px;margin:0 auto;padding:0 14px 90px;}
.top{display:flex;align-items:center;justify-content:space-between;padding:18px 4px 10px;position:sticky;top:0;background:linear-gradient(#080808,#080808ee 70%,transparent);z-index:10;}
.top .b{font-family:Orbitron;font-weight:900;letter-spacing:3px;font-size:18px;}
.top .b span{color:var(--red);}
.top .out{background:none;border:1px solid var(--line);color:var(--mut);border-radius:20px;padding:7px 14px;font-size:12px;cursor:pointer;}
.nav{display:flex;flex-wrap:wrap;gap:8px;margin:6px 0 18px;}
.nav button{flex:1 1 auto;min-width:90px;border:1px solid var(--line);background:var(--card);color:var(--mut);border-radius:14px;padding:11px 8px;font-size:13px;font-weight:600;cursor:pointer;transition:.15s;}
.nav button.on{background:var(--red);border-color:var(--red);color:#fff;box-shadow:0 6px 18px #cc000055;}
.page{display:none;animation:fade .3s;}
.page.on{display:block;}
@keyframes fade{from{opacity:0;transform:translateY(8px);}to{opacity:1;transform:none;}}
.card{background:var(--card);border:1px solid var(--line);border-radius:18px;padding:18px;margin-bottom:14px;}
.card h3{margin:0 0 14px;font-size:15px;letter-spacing:.5px;}
.h-sub{color:var(--mut);font-size:12px;margin:-8px 0 14px;}
/* stat grid */
.stats{display:grid;grid-template-columns:repeat(auto-fill,minmax(140px,1fr));gap:12px;}
.stat{background:var(--card2);border:1px solid var(--line);border-radius:16px;padding:16px;position:relative;overflow:hidden;}
.stat b{display:block;font-size:30px;font-weight:800;font-family:Orbitron;line-height:1;}
.stat span{color:var(--mut);font-size:12px;display:block;margin-top:6px;}
.stat .glow{position:absolute;right:-20px;top:-20px;width:70px;height:70px;border-radius:50%;background:radial-gradient(circle,#cc000044,transparent 70%);}
/* rings */
.rings{display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:14px;}
.ring{display:flex;flex-direction:column;align-items:center;gap:6px;}
.ring .lbl{color:var(--mut);font-size:12px;text-align:center;}
/* vertical cards (subscribers/coupons) */
.toolbar{display:flex;flex-wrap:wrap;gap:8px;margin-bottom:14px;align-items:center;}
.seg{display:inline-flex;background:var(--card2);border:1px solid var(--line);border-radius:14px;padding:3px;}
.seg button{border:none;background:none;color:var(--mut);padding:8px 14px;border-radius:11px;font-size:13px;font-weight:600;cursor:pointer;}
.seg button.on{background:var(--red);color:#fff;}
input,select,textarea{background:#0d0d10;border:1px solid var(--line);color:var(--txt);border-radius:12px;padding:11px 13px;font-size:14px;font-family:inherit;width:100%;}
input:focus,textarea:focus,select:focus{outline:none;border-color:var(--red);}
.search{flex:1 1 160px;min-width:140px;}
.btn{border:none;border-radius:12px;padding:11px 16px;font-size:13px;font-weight:700;cursor:pointer;background:var(--red);color:#fff;}
.btn.ghost{background:var(--card2);border:1px solid var(--line);color:var(--txt);}
.btn.sm{padding:8px 12px;font-size:12px;border-radius:10px;}
.list{display:flex;flex-direction:column;gap:10px;}
.row{background:var(--card2);border:1px solid var(--line);border-radius:16px;padding:14px;}
.row .rh{display:flex;justify-content:space-between;align-items:flex-start;gap:10px;}
.row .nm{font-weight:700;font-size:15px;}
.row .meta{color:var(--mut);font-size:13px;margin-top:5px;line-height:1.5;word-break:break-word;}
.tag{display:inline-block;font-size:10px;font-weight:700;letter-spacing:.5px;padding:3px 9px;border-radius:20px;text-transform:uppercase;}
.tag.form{background:#0a2a4a;color:#6cc4ff;}
.tag.darts{background:#3a1a00;color:#ff9d4d;}
.tag.active{background:#063a18;color:#5ee08a;}
.tag.used{background:#222;color:#999;}
.tag.void{background:#3a0606;color:#ff7a7a;}
.row .acts{display:flex;flex-wrap:wrap;gap:6px;margin-top:12px;}
.empty{text-align:center;color:var(--mut);padding:30px;font-size:14px;}
/* content editor */
.acc{border:1px solid var(--line);border-radius:14px;margin-bottom:10px;overflow:hidden;background:var(--card2);}
.acc summary{padding:14px 16px;cursor:pointer;font-weight:700;font-size:14px;list-style:none;user-select:none;}
.acc summary::-webkit-details-marker{display:none;}
.acc summary::after{content:'＋';float:right;color:var(--mut);}
.acc[open] summary::after{content:'－';}
.acc[open] summary{border-bottom:1px solid var(--line);}
.acc-b{padding:14px 16px;}
.field{margin-bottom:14px;}
/* rich-text редактор */
.rt-tools{display:flex;flex-wrap:wrap;gap:6px;margin-bottom:6px;}
.rt-tools button,.rt-tools select{background:var(--card2);border:1px solid var(--line);color:var(--txt);border-radius:9px;
  padding:7px 11px;font-size:13px;font-weight:700;cursor:pointer;width:auto;min-width:0;}
.rt-tools button:active{background:var(--red);}
.rt-ed{background:#0d0d10;border:1px solid var(--line);border-radius:12px;padding:12px 13px;min-height:64px;
  font-size:14px;line-height:1.5;color:var(--txt);outline:none;}
.rt-ed:focus{border-color:var(--red);}
.rt-ed:empty:before{content:attr(data-ph);color:#555;}
/* строки кнопок письма */
.btn-row{display:flex;gap:8px;margin-bottom:8px;align-items:center;}
.btn-row input{flex:1;}
.btn-row .del{background:#2a0a0a;border:1px solid #4a1a1a;color:#ff7a7a;border-radius:9px;padding:9px 12px;cursor:pointer;width:auto;flex:0 0 auto;}
/* QR-сканер */
#qr-video{width:100%;max-width:320px;border-radius:14px;background:#000;display:block;margin:0 auto;}
.qr-result{text-align:center;padding:16px;border-radius:14px;margin-top:12px;font-weight:700;}
.field label{display:block;font-size:12px;color:var(--mut);margin-bottom:6px;letter-spacing:.5px;}
textarea{min-height:70px;resize:vertical;}
/* modal */
.modal{position:fixed;inset:0;z-index:60;background:#000a;display:none;align-items:flex-end;justify-content:center;padding:0;}
.modal.on{display:flex;}
.sheet{background:var(--card);border:1px solid var(--line);border-radius:22px 22px 0 0;width:100%;max-width:560px;padding:22px 18px 30px;max-height:92vh;overflow:auto;animation:up .3s;}
@keyframes up{from{transform:translateY(40px);opacity:.5;}to{transform:none;opacity:1;}}
.sheet h3{margin:0 0 16px;}
.toast{position:fixed;left:50%;bottom:24px;transform:translateX(-50%) translateY(80px);background:var(--red);color:#fff;padding:12px 22px;border-radius:30px;font-weight:700;font-size:14px;z-index:80;opacity:0;transition:.3s;box-shadow:0 10px 30px #cc000066;}
.toast.on{opacity:1;transform:translateX(-50%) translateY(0);}
.tpl-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:10px;margin-bottom:14px;}
.tpl{background:var(--card2);border:1px solid var(--line);border-radius:14px;padding:14px;cursor:pointer;transition:.15s;}
.tpl:hover{border-color:var(--red);}
.tpl b{display:block;font-size:13px;margin-bottom:4px;}
.tpl span{color:var(--mut);font-size:11px;}
@media(min-width:760px){.modal{align-items:center;}.sheet{border-radius:22px;}}
canvas{display:block;width:100%;}
</style>
</head>
<body>
<div class="bgfx"><div class="orb a"></div><div class="orb b"></div><div class="orb c"></div></div>
<div class="scan"></div>

<!-- ЛОГИН -->
<div id="login">
  <img class="duck" src="../duck-mascot.png" alt="DUCK'S">
  <div class="brand">DUCK<span>'</span>S</div>
  <div class="sub">ADMIN PANEL</div>
  <div class="dots"><i></i><i></i><i></i><i></i></div>
  <div class="pad">
    <button data-k="1">1</button><button data-k="2">2</button><button data-k="3">3</button>
    <button data-k="4">4</button><button data-k="5">5</button><button data-k="6">6</button>
    <button data-k="7">7</button><button data-k="8">8</button><button data-k="9">9</button>
    <button class="wide" data-k="clr">сброс</button><button data-k="0">0</button><button class="wide" data-k="del">⌫</button>
  </div>
  <div class="err" id="login-err"></div>
</div>

<!-- ПРИЛОЖЕНИЕ -->
<div id="app">
  <div class="top">
    <div class="b">DUCK<span>'</span>S · админ</div>
    <button class="out" id="logout">Выйти</button>
  </div>
  <div class="nav">
    <button data-p="dash" class="on">Сводка</button>
    <button data-p="subs">База</button>
    <button data-p="coupons">Купоны</button>
    <button data-p="content">Тексты</button>
    <button data-p="news">Рассылки</button>
    <button data-p="settings">Настройки</button>
  </div>

  <!-- СВОДКА -->
  <div class="page on" id="page-dash">
    <div class="card"><h3 data-ico="dash">Показатели</h3><div class="stats" id="stat-grid"></div></div>
    <div class="card"><h3 data-ico="check">Конверсии</h3><div class="rings" id="ring-grid"></div></div>
    <div class="card"><h3 data-ico="dash">Заявки и купоны · 14 дней</h3><canvas id="chart-days" height="180"></canvas></div>
    <div class="card"><h3 data-ico="check">Топ кликов по кнопкам</h3><div id="top-clicks" class="list"></div></div>
  </div>

  <!-- БАЗА ПОДПИСЧИКОВ -->
  <div class="page" id="page-subs">
    <div class="toolbar">
      <div class="seg" id="subs-seg">
        <button data-f="all" class="on">Все</button>
        <button data-f="form">Форма</button>
        <button data-f="darts">Дартс −15%</button>
      </div>
      <input class="search" id="subs-q" placeholder="Поиск по имени, почте, телефону…">
      <button class="btn ghost sm" id="subs-export">CSV</button>
      <button class="btn sm" id="subs-add">+ Добавить</button>
    </div>
    <div class="list" id="subs-list"></div>
  </div>

  <!-- КУПОНЫ -->
  <div class="page" id="page-coupons">
    <div class="card">
      <h3 data-ico="qr">Проверка купона · сканер QR</h3>
      <div class="h-sub">Наведи камеру на QR из купона гостя — купон станет «использован».</div>
      <video id="qr-video" playsinline style="display:none"></video>
      <div class="toolbar" style="justify-content:center;margin-top:12px">
        <button class="btn" id="qr-start">Включить камеру</button>
        <button class="btn ghost" id="qr-stop" style="display:none">Стоп</button>
      </div>
      <div class="field" style="margin-top:6px"><label>или вручную по номеру</label>
        <div class="toolbar"><input class="search" id="qr-manual" placeholder="D15-XXXXXX">
        <button class="btn sm" id="qr-check">Проверить</button></div></div>
      <div id="qr-out"></div>
    </div>
    <div class="card">
      <h3 data-ico="ticket">Параметры скидки</h3>
      <div class="field"><label>Размер скидки, %</label><input id="cp-discount" type="number"></div>
      <div class="field"><label>Порог очков в дартсе (для купона)</label><input id="cp-points" type="number"></div>
      <button class="btn sm" id="cp-save-params">Сохранить параметры</button>
    </div>
    <div class="toolbar">
      <div class="seg" id="cp-seg">
        <button data-f="all" class="on">Все</button>
        <button data-f="active">Активные</button>
        <button data-f="used">Использованы</button>
        <button data-f="void">Аннулированы</button>
      </div>
      <input class="search" id="cp-q" placeholder="Поиск по номеру, имени, почте…">
      <button class="btn sm" id="cp-add">+ Выдать</button>
    </div>
    <div class="list" id="cp-list"></div>
  </div>

  <!-- ТЕКСТЫ САЙТА -->
  <div class="page" id="page-content">
    <div class="card">
      <h3 data-ico="text">Тексты сайта</h3>
      <div class="h-sub">Меняй заголовки, подзаголовки и тексты — сайт подхватит сразу.</div>
      <div id="content-fields"></div>
      <button class="btn" id="content-save">Сохранить тексты</button>
    </div>
    <div class="card">
      <h3 data-ico="text">Вопросы-фишки (FAQ)</h3>
      <div class="h-sub">Вопрос (\n — перенос строки) и ответ на фишке.</div>
      <div id="faq-fields"></div>
      <button class="btn" id="faq-save">Сохранить FAQ</button>
    </div>
  </div>

  <!-- РАССЫЛКИ -->
  <div class="page" id="page-news">
    <div class="card">
      <h3 data-ico="mail">Шаблоны</h3>
      <div class="tpl-grid" id="tpl-grid"></div>
    </div>
    <div class="card">
      <h3 data-ico="edit">Конструктор письма</h3>
      <div class="field"><label>Кому</label>
        <select id="nl-audience"><option value="all">Все подписчики</option><option value="form">Только форма</option><option value="darts">Только дартс −15%</option></select></div>
      <div class="field"><label>Тема письма</label><input id="nl-subject" placeholder="Тема"></div>
      <div class="field"><label>Текст письма ({name} подставит имя)</label>
        <div class="rt-tools" data-rt="nl-body"></div>
        <div class="rt-ed" id="nl-body" contenteditable="true" data-ph="Пиши текст, выделяй и форматируй…"></div>
      </div>
      <div class="field"><label>Кнопки письма (отдельно текст и ссылка)</label>
        <div id="nl-btn-rows"></div>
        <button class="btn ghost sm" id="nl-add-btn" type="button">+ добавить кнопку</button>
        <div class="h-sub" style="margin:10px 0 4px">Быстрая вставка кнопки с правильной ссылкой:</div>
        <div class="toolbar" id="nl-quick" style="margin-bottom:0"></div>
      </div>
      <div class="field"><label>Вложения (фото / видео / файлы / голос)</label><input id="nl-files" type="file" multiple></div>
      <div class="toolbar">
        <input class="search" id="nl-test" placeholder="Тестовое письмо на почту…">
        <button class="btn ghost sm" id="nl-test-btn">Тест</button>
        <button class="btn" id="nl-send">Отправить всем</button>
      </div>
    </div>
    <div class="card"><h3 data-ico="mail">История рассылок</h3><div class="list" id="nl-log"></div></div>
  </div>

  <!-- НАСТРОЙКИ -->
  <div class="page" id="page-settings">
    <div class="card">
      <h3 data-ico="lock">PIN-код входа</h3>
      <div class="h-sub">Цифровой пароль для входа в админку. Только цифры, 4–6 знаков.</div>
      <div class="field"><label>Новый PIN</label><input id="pin-new" type="password" inputmode="numeric" pattern="[0-9]*" maxlength="6" placeholder="например 2026"></div>
      <div class="field"><label>Повтори новый PIN</label><input id="pin-new2" type="password" inputmode="numeric" pattern="[0-9]*" maxlength="6" placeholder="ещё раз"></div>
      <button class="btn" id="pin-save">Сменить PIN</button>
    </div>
    <div class="card">
      <h3 data-ico="pin">Клуб и приглашение</h3>
      <div class="field"><label>Адрес клуба (в письмах-приглашениях)</label><input id="set-club_address"></div>
      <div class="field"><label>Ссылка на карту</label><input id="set-club_address_map"></div>
      <div class="field"><label>Текст «получили заявку»</label><textarea id="set-welcome_text"></textarea></div>
      <div class="field"><label>Текст приглашения (через 15 мин)</label><textarea id="set-invite_text"></textarea></div>
      <div class="h-sub" style="margin-top:4px">Цепочка из 4 лид-магнитов уходит автоматически: +15 мин, +1 ч, +6 ч, +24 ч после любой формы.</div>
      <button class="btn" id="set-save">Сохранить настройки</button>
    </div>
    <div class="card">
      <h3 data-ico="info">Подсказка</h3>
      <div class="h-sub" style="line-height:1.7">
        • Письма уходят с <b>ducks.game.space@gmail.com</b> (Gmail App Password, CURL SMTP).<br>
        • Новые заявки и купоны дублируются на почты руководителей.<br>
        • Авто-приглашение — через <b><?php echo INVITE_DELAY_MIN; ?> мин</b> после заявки (cron каждые ~10 сек).<br>
        • Всё работает только на почте — без Telegram-бота.
      </div>
    </div>
  </div>
</div>

<div class="modal" id="modal"><div class="sheet" id="sheet"></div></div>
<div class="toast" id="toast"></div>

<script>
const PIN_KEY='ducks_admin_pin';
let PIN=sessionStorage.getItem(PIN_KEY)||'';
const $=(s,r=document)=>r.querySelector(s);
const $$=(s,r=document)=>[...r.querySelectorAll(s)];
const esc=(s)=>String(s==null?'':s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
/* Профессиональные SVG-иконки (stroke=currentColor) вместо эмодзи */
const _s=(p,o='')=>`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" ${o}>${p}</svg>`;
const ICO={
  dash:_s('<path d="M3 13h8V3H3zM13 21h8V8h-8zM13 3v3h8V3zM3 21h8v-5H3z"/>'),
  users:_s('<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/>'),
  ticket:_s('<path d="M3 9a3 3 0 0 0 0 6v2a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-2a3 3 0 0 1 0-6V7a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2z"/><path d="M13 5v14" stroke-dasharray="2 2"/>'),
  text:_s('<path d="M4 7V5h16v2M9 5v14M7 19h4"/><path d="M14 13h6M17 10v6"/>'),
  mail:_s('<rect x="2" y="4" width="20" height="16" rx="2"/><path d="m22 6-10 7L2 6"/>'),
  gear:_s('<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-2.82 1.17V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 8 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.6 15H4a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 6 8a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 11 4.6V4a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 2.82-1.17l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 2z"/>'),
  trash:_s('<path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m3 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/>'),
  qr:_s('<path d="M3 3h7v7H3zM14 3h7v7h-7zM3 14h7v7H3zM14 14h3v3h-3zM20 14v7M17 20h4"/>'),
  send:_s('<path d="M22 2 11 13M22 2l-7 20-4-9-9-4z"/>'),
  download:_s('<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3"/>'),
  check:_s('<path d="M20 6 9 17l-5-5"/>'),
  edit:_s('<path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.12 2.12 0 0 1 3 3L12 15l-4 1 1-4z"/>'),
  invite:_s('<path d="M22 2 11 13M22 2l-7 20-4-9-9-4z"/>'),
  resend:_s('<path d="M3 2v6h6M21 12A9 9 0 0 0 6 5.3L3 8M21 22v-6h-6M3 12a9 9 0 0 0 15 6.7l3-2.7"/>'),
  plus:_s('<path d="M12 5v14M5 12h14"/>'),
  info:_s('<circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/>'),
  lock:_s('<rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>'),
  pin:_s('<path d="M21 10c0 7-9 12-9 12s-9-5-9-12a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/>'),
};
const I=(n,sz=18)=>`<span class="ico" style="display:inline-flex;width:${sz}px;height:${sz}px;vertical-align:-3px">${ICO[n]||''}</span>`;
function toast(m){const t=$('#toast');t.textContent=m;t.classList.add('on');setTimeout(()=>t.classList.remove('on'),2200);}
async function api(action,data={},opts={}){
  const url='../api.php?action='+action+(opts.query?'&'+opts.query:'');
  const r=await fetch(url,{method:opts.get?'GET':'POST',headers:{'Content-Type':'application/json','X-Admin-Pin':PIN},
    body:opts.get?undefined:JSON.stringify(data)});
  if(opts.raw) return r;
  return r.json();
}

/* ---------- ЛОГИН ---------- */
let entry='';
function renderDots(){$$('.dots i').forEach((d,i)=>d.classList.toggle('on',i<entry.length));}
$$('#login .pad button').forEach(b=>b.onclick=async()=>{
  const k=b.dataset.k;
  if(k==='del') entry=entry.slice(0,-1);
  else if(k==='clr') entry='';
  else if(entry.length<6) entry+=k;
  renderDots();
  if(entry.length>=4){ // пробуем авторизоваться при 4+
    const r=await fetch('../api.php?action=auth',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({pin:entry})});
    const j=await r.json().catch(()=>({}));
    if(j.ok){PIN=entry;sessionStorage.setItem(PIN_KEY,PIN);enterApp();}
    else if(entry.length>=6){$('#login-err').textContent='Неверный PIN';entry='';renderDots();setTimeout(()=>$('#login-err').textContent='',1500);}
  }
});
function enterApp(){$('#login').style.display='none';$('#app').style.display='block';loadDash();}
$('#logout').onclick=()=>{sessionStorage.removeItem(PIN_KEY);location.reload();};
if(PIN){ // авто-вход если pin есть
  fetch('../api.php?action=auth',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({pin:PIN})})
    .then(r=>r.json()).then(j=>{if(j.ok)enterApp();else sessionStorage.removeItem(PIN_KEY);});
}

/* ---------- НАВИГАЦИЯ ---------- */
$$('.nav button').forEach(b=>b.onclick=()=>{
  $$('.nav button').forEach(x=>x.classList.remove('on'));b.classList.add('on');
  $$('.page').forEach(p=>p.classList.remove('on'));$('#page-'+b.dataset.p).classList.add('on');
  ({dash:loadDash,subs:loadSubs,coupons:loadCoupons,content:loadContent,news:loadNews,settings:loadSettings}[b.dataset.p]||(()=>{}))();
});

/* ---------- СВОДКА ---------- */
function ringSVG(pct,label,color){
  const r=34,c=2*Math.PI*r,off=c*(1-Math.min(1,pct/100));
  return `<div class="ring"><svg width="84" height="84" viewBox="0 0 84 84">
    <circle cx="42" cy="42" r="${r}" fill="none" stroke="#222" stroke-width="9"/>
    <circle cx="42" cy="42" r="${r}" fill="none" stroke="${color}" stroke-width="9" stroke-linecap="round"
      stroke-dasharray="${c}" stroke-dashoffset="${c}" transform="rotate(-90 42 42)">
      <animate attributeName="stroke-dashoffset" from="${c}" to="${off}" dur="1s" fill="freeze" calcMode="spline" keySplines="0.4 0 0.2 1" keyTimes="0;1"/></circle>
    <text x="42" y="47" text-anchor="middle" fill="#fff" font-size="17" font-weight="800" font-family="Orbitron">${pct}%</text>
  </svg><div class="lbl">${label}</div></div>`;
}
async function loadDash(){
  const j=await api('getStats',{},{get:true,query:'pin='+PIN});
  if(!j.ok)return;
  const s=j.stats;
  const cells=[['Подписчиков',s.subscribers],['Из формы',s.fromForm],['Из дартса −15%',s.fromDarts],
    ['Приглашено',s.invited],['Купонов',s.coupons],['Активны',s.couponsActive],
    ['Визиты',s.visits],['Клики',s.clicks],['Конверсии',s.conversions]];
  $('#stat-grid').innerHTML=cells.map(([l,v])=>`<div class="stat"><div class="glow"></div><b>${v}</b><span>${l}</span></div>`).join('');
  const convRate=s.conversionRate||0;
  const usedRate=s.coupons?Math.round(s.couponsUsed/s.coupons*100):0;
  const invRate=s.subscribers?Math.round(s.invited/s.subscribers*100):0;
  $('#ring-grid').innerHTML=ringSVG(convRate,'Визит → заявка','#cc0000')+ringSVG(invRate,'Приглашено из базы','#ff7a2a')+ringSVG(usedRate,'Купоны использованы','#5ee08a');
  drawDays(j.days||[]);
  $('#top-clicks').innerHTML=(j.topClicks&&j.topClicks.length)?j.topClicks.map(c=>{
    const max=j.topClicks[0].c||1;return `<div class="row"><div class="rh"><div class="nm" style="font-size:13px">${esc(c.label||'—')}</div><b>${c.c}</b></div>
      <div style="height:6px;background:#222;border-radius:4px;margin-top:8px;overflow:hidden"><div style="height:100%;width:${Math.round(c.c/max*100)}%;background:var(--red)"></div></div></div>`;
  }).join(''):'<div class="empty">Пока нет данных</div>';
}
function drawDays(days){
  const cv=$('#chart-days');const dpr=window.devicePixelRatio||1;const W=cv.clientWidth,H=180;
  cv.width=W*dpr;cv.height=H*dpr;const x=cv.getContext('2d');x.scale(dpr,dpr);
  x.clearRect(0,0,W,H);
  const max=Math.max(1,...days.map(d=>Math.max(d.leads,d.coupons)));
  const pad=24,bw=(W-pad*2)/days.length;
  days.forEach((d,i)=>{
    const bx=pad+i*bw;
    const lh=(d.leads/max)*(H-50),ch=(d.coupons/max)*(H-50);
    x.fillStyle='#cc0000';x.fillRect(bx+bw*0.18,H-30-lh,bw*0.28,lh);
    x.fillStyle='#ff7a2a';x.fillRect(bx+bw*0.50,H-30-ch,bw*0.28,ch);
    x.fillStyle='#777';x.font='10px Inter';x.textAlign='center';
    if(i%2===0)x.fillText(d.date,bx+bw*0.5,H-12);
  });
  x.fillStyle='#cc0000';x.fillRect(pad,8,10,10);x.fillStyle='#aaa';x.textAlign='left';x.font='11px Inter';x.fillText('заявки',pad+14,17);
  x.fillStyle='#ff7a2a';x.fillRect(pad+80,8,10,10);x.fillStyle='#aaa';x.fillText('купоны',pad+94,17);
}

/* ---------- БАЗА ---------- */
let subsFilter='all';
$$('#subs-seg button').forEach(b=>b.onclick=()=>{$$('#subs-seg button').forEach(x=>x.classList.remove('on'));b.classList.add('on');subsFilter=b.dataset.f;loadSubs();});
$('#subs-q').oninput=debounce(loadSubs,300);
$('#subs-add').onclick=()=>editSub({});
$('#subs-export').onclick=()=>{window.open('../api.php?action=exportSubscribers&pin='+encodeURIComponent(PIN),'_blank');};
async function loadSubs(){
  const q=encodeURIComponent($('#subs-q').value);
  const j=await api('getSubscribers',{},{get:true,query:`pin=${PIN}&filter=${subsFilter}&q=${q}`});
  const el=$('#subs-list');
  if(!j.ok||!j.items.length){el.innerHTML='<div class="empty">Пусто</div>';return;}
  el.innerHTML=j.items.map(s=>{
    const dt=new Date(s.created*1000).toLocaleDateString('ru-RU');
    const src=s.source==='darts'?'<span class="tag darts">дартс −15%</span>':'<span class="tag form">форма</span>';
    return `<div class="row"><div class="rh"><div><div class="nm">${esc(s.name||'Без имени')}</div>
      <div class="meta"> ${esc(s.email)}<br> ${esc(s.phone||'—')}${s.game?'<br> '+esc(s.game+' '+(s.format||'')):''}<br> ${dt} · ${esc(s.status)}</div></div>${src}</div>
      <div class="acts">
        <button class="btn sm" onclick="manualInvite(${s.id})">Пригласить</button>
        <button class="btn ghost sm" onclick='editSub(${JSON.stringify(s)})'>Изменить</button>
        <button class="btn ghost sm" onclick="delSub(${s.id})">Удалить</button>
      </div></div>`;
  }).join('');
}
window.manualInvite=async(id)=>{await api('manualInvite',{pin:PIN,id});toast('Приглашение отправлено');loadSubs();};
window.delSub=async(id)=>{if(!confirm('Удалить подписчика?'))return;await api('deleteSubscriber',{pin:PIN,id});toast('Удалено');loadSubs();};
window.editSub=(s)=>{
  openSheet(`<h3>${s.id?'Изменить':'Новый'} подписчик</h3>
    <div class="field"><label>Имя</label><input id="e-name" value="${esc(s.name||'')}"></div>
    <div class="field"><label>Почта</label><input id="e-email" value="${esc(s.email||'')}"></div>
    <div class="field"><label>Телефон</label><input id="e-phone" value="${esc(s.phone||'')}"></div>
    <div class="field"><label>Игра</label><input id="e-game" value="${esc(s.game||'')}"></div>
    <div class="field"><label>Формат</label><input id="e-format" value="${esc(s.format||'')}"></div>
    <div class="field"><label>Источник</label><select id="e-source"><option value="form"${s.source!=='darts'?' selected':''}>Форма</option><option value="darts"${s.source==='darts'?' selected':''}>Дартс</option></select></div>
    <div class="field"><label>Статус</label><input id="e-status" value="${esc(s.status||'new')}"></div>
    <div class="field"><label>Заметка</label><textarea id="e-note">${esc(s.note||'')}</textarea></div>
    <button class="btn" id="e-save">Сохранить</button>`);
  $('#e-save').onclick=async()=>{
    await api('saveSubscriber',{pin:PIN,id:s.id||0,name:$('#e-name').value,email:$('#e-email').value,phone:$('#e-phone').value,
      game:$('#e-game').value,format:$('#e-format').value,source:$('#e-source').value,status:$('#e-status').value,note:$('#e-note').value});
    closeSheet();toast('Сохранено');loadSubs();
  };
};

/* ---------- КУПОНЫ ---------- */
let cpFilter='all';
$$('#cp-seg button').forEach(b=>b.onclick=()=>{$$('#cp-seg button').forEach(x=>x.classList.remove('on'));b.classList.add('on');cpFilter=b.dataset.f;loadCoupons();});
$('#cp-q').oninput=debounce(loadCoupons,300);
$('#cp-add').onclick=()=>issueCoupon();
$('#cp-save-params').onclick=async()=>{await api('saveSettings',{pin:PIN,settings:{coupon_discount:$('#cp-discount').value,coupon_points:$('#cp-points').value}});toast('Параметры сохранены');};
async function loadCoupons(){
  const q=encodeURIComponent($('#cp-q').value);
  const j=await api('getCoupons',{},{get:true,query:`pin=${PIN}&status=${cpFilter}&q=${q}`});
  if(j.discount!=null){$('#cp-discount').value=j.discount;$('#cp-points').value=j.points;}
  const el=$('#cp-list');
  if(!j.ok||!j.items.length){el.innerHTML='<div class="empty">Купонов нет</div>';return;}
  el.innerHTML=j.items.map(c=>{
    const dt=new Date(c.created*1000).toLocaleDateString('ru-RU');
    return `<div class="row"><div class="rh"><div><div class="nm">№ ${esc(c.number)} · −${c.discount}%</div>
      <div class="meta">${esc(c.name||'—')}<br> ${esc(c.email||'—')}<br> ${esc(c.phone||'—')} ·  ${c.score} очк · ${dt}</div></div>
      <span class="tag ${c.status}">${c.status==='active'?'активен':c.status==='used'?'использован':'аннулирован'}</span></div>
      <div class="acts">
        ${c.status!=='used'?`<button class="btn sm" onclick="cpAct(${c.id},'use')">Использован</button>`:''}
        ${c.status!=='void'?`<button class="btn ghost sm" onclick="cpAct(${c.id},'void')">Аннулировать</button>`:`<button class="btn ghost sm" onclick="cpAct(${c.id},'active')">Вернуть</button>`}
        <button class="btn ghost sm" onclick="cpAct(${c.id},'resend')">Переслать</button>
        <button class="btn ghost sm" onclick="window.open('../api.php?action=downloadCoupon&number=${encodeURIComponent(c.number)}','_blank')">Открыть</button>
        <button class="btn ghost sm" onclick="cpAct(${c.id},'delete')">Удалить</button>
      </div></div>`;
  }).join('');
}
window.cpAct=async(id,op)=>{if(op==='delete'&&!confirm('Удалить купон?'))return;await api('couponAction',{pin:PIN,id,op});toast('Готово');loadCoupons();};
window.issueCoupon=()=>{
  openSheet(`<h3>Выдать купон</h3>
    <div class="field"><label>Имя</label><input id="ic-name"></div>
    <div class="field"><label>Почта</label><input id="ic-email"></div>
    <div class="field"><label>Телефон</label><input id="ic-phone"></div>
    <div class="field"><label>Скидка, %</label><input id="ic-disc" type="number" value="${$('#cp-discount').value||15}"></div>
    <label style="display:flex;gap:8px;align-items:center;margin-bottom:14px;color:var(--mut);font-size:13px"><input type="checkbox" id="ic-send" style="width:auto" checked> отправить на почту</label>
    <button class="btn" id="ic-save">Выдать</button>`);
  $('#ic-save').onclick=async()=>{
    const r=await api('couponAction',{pin:PIN,op:'create',name:$('#ic-name').value,email:$('#ic-email').value,phone:$('#ic-phone').value,discount:$('#ic-disc').value,send:$('#ic-send').checked?1:0});
    closeSheet();toast('Купон '+(r.number||'')+' выдан');loadCoupons();
  };
};

/* ---------- СКАНЕР QR КУПОНА ---------- */
let qrStream=null,qrLoop=null;
function qrShow(res){
  const el=$('#qr-out');let bg='#15151a',col='#fff',txt='';
  if(!res||res.status==='notfound'){bg='#241010';col='#ff9d9d';txt='Купон не найден';}
  else if(res.status==='used'&&res.already){bg='#241a10';col='#ffcf8a';txt='Уже использован · '+(res.name||'')+' · №'+res.number;}
  else if(res.status==='void'){bg='#241010';col='#ff9d9d';txt='Аннулирован · №'+res.number;}
  else if(res.status==='ok'){bg='#0e2417';col='#7ef0a8';txt='Действителен −'+res.discount+'% · '+(res.name||'')+' · отмечен использованным';}
  el.innerHTML=`<div class="qr-result" style="background:${bg};color:${col}">${I('check',18)} ${esc(txt)}</div>`;
}
async function qrSubmit(data){ if(!data)return; const r=await api('scanCoupon',{pin:PIN,data}); qrShow(r); loadCoupons(); }
$('#qr-check').onclick=()=>qrSubmit($('#qr-manual').value.trim());
$('#qr-start').onclick=async()=>{
  try{
    qrStream=await navigator.mediaDevices.getUserMedia({video:{facingMode:'environment'}});
    const v=$('#qr-video');v.srcObject=qrStream;v.style.display='block';await v.play();
    $('#qr-start').style.display='none';$('#qr-stop').style.display='';
    const cv=document.createElement('canvas');const cx=cv.getContext('2d');let last=0;
    qrLoop=setInterval(()=>{
      if(v.readyState!==v.HAVE_ENOUGH_DATA||!window.jsQR)return;
      cv.width=v.videoWidth;cv.height=v.videoHeight;cx.drawImage(v,0,0,cv.width,cv.height);
      const img=cx.getImageData(0,0,cv.width,cv.height);
      const code=jsQR(img.data,img.width,img.height);
      if(code&&code.data&&Date.now()-last>2500){last=Date.now();qrSubmit(code.data);}
    },400);
  }catch(e){toast('Нет доступа к камере');}
};
$('#qr-stop').onclick=()=>{ if(qrLoop)clearInterval(qrLoop); if(qrStream)qrStream.getTracks().forEach(t=>t.stop());
  $('#qr-video').style.display='none';$('#qr-start').style.display='';$('#qr-stop').style.display='none'; };

/* ---------- ТЕКСТЫ (схема по разделам) ---------- */
const CONTENT_SCHEMA=[
  {g:'Главная (Hero)',f:[['hero.title','Заголовок'],['hero.sub','Подзаголовок'],['hero.desc','Описание',1]]},
  {g:'О клубе',f:[['about.label','Метка'],['about.title','Заголовок (формат: жирность/курсив/размер)',1,0,1],['about.note','Приписка'],
    ['about.c1.t','Карточка 1 · заголовок'],['about.c1.s','Карточка 1 · текст'],
    ['about.c2.t','Карточка 2 · заголовок'],['about.c2.s','Карточка 2 · текст'],
    ['about.c3.t','Карточка 3 · заголовок'],['about.c3.s','Карточка 3 · текст'],
    ['about.c4.t','Карточка 4 · заголовок'],['about.c4.s','Карточка 4 · текст']]},
  {g:'Покер',f:[['poker.title','Заголовок'],['poker.sub','Подзаголовок'],['poker.btn','Текст кнопки']]},
  {g:'Дартс',f:[['darts.title','Заголовок'],['darts.sub','Подзаголовок'],['darts.promo','Промо-строка (формат)',1,0,1]]},
  {g:'Бильярд',f:[['billiard.title','Заголовок'],['billiard.sub','Подзаголовок'],
    ['billiard.c1.t','Карточка 1 · заголовок'],['billiard.c1.s','Карточка 1 · текст'],
    ['billiard.c2.t','Карточка 2 · заголовок'],['billiard.c2.s','Карточка 2 · текст'],
    ['billiard.c3.t','Карточка 3 · заголовок'],['billiard.c3.s','Карточка 3 · текст'],
    ['billiard.c4.t','Карточка 4 · заголовок'],['billiard.c4.s','Карточка 4 · текст']]},
  {g:' Бар',f:[['bar.title','Заголовок'],['bar.sub','Подзаголовок'],
    ['bar.c1.t','Карточка 1 · заголовок'],['bar.c1.s','Карточка 1 · текст'],
    ['bar.c2.t','Карточка 2 · заголовок'],['bar.c2.s','Карточка 2 · текст'],
    ['bar.c3.t','Карточка 3 · заголовок'],['bar.c3.s','Карточка 3 · текст']]},
  {g:'FAQ — заголовок секции',f:[['faq.title','Заголовок'],['faq.sub','Подзаголовок']]},
  {g:'Форма «Записаться»',f:[['form.signup.kicker','Метка'],['form.signup.title','Заголовок'],['form.signup.desc','Описание',1],
    ['form.signup.labelName','Поле · Имя'],['form.signup.labelEmail','Поле · Email'],['form.signup.labelPhone','Поле · Телефон',1],
    ['form.signup.labelGame','Поле · Любимая игра'],['form.signup.labelFormat','Поле · Формат'],['form.signup.submit','Кнопка отправки'],
    ['form.signup.games','Варианты игр (через запятую)',0,1],['form.signup.formats','Варианты форматов (через запятую)',0,1]]},
];
let contentData={};
function cGet(k){return k.split('.').reduce((o,p)=>o&&o[p]!=null?o[p]:'',contentData);}
async function loadContent(){
  const j=await api('getContent',{},{get:true});
  contentData=j.content&&typeof j.content==='object'?j.content:{};
  $('#content-fields').innerHTML=CONTENT_SCHEMA.map(sec=>`
    <details class="acc"${sec.g.includes('Главная')?' open':''}><summary>${sec.g}</summary><div class="acc-b">${
      sec.f.map(([k,l,ml,list,html])=>{
        let v=cGet(k); if(list&&Array.isArray(v))v=v.join(', ');
        const id='ed_'+k.replace(/\W/g,'_');
        if(html) return `<div class="field"><label>${l}</label>`
          + `<div class="rt-tools" data-rt="${id}"></div>`
          + `<div class="rt-ed" id="${id}" contenteditable="true" data-ckh="${k}">${v}</div></div>`;
        return `<div class="field"><label>${l}</label>${ml?`<textarea data-ck="${k}"${list?' data-list="1"':''}>${esc(v)}</textarea>`:`<input data-ck="${k}"${list?' data-list="1"':''} value="${esc(v)}">`}</div>`;
      }).join('')
    }</div></details>`).join('');
  $$('#content-fields .rt-tools').forEach(t=>mountRT('[data-rt="'+t.dataset.rt+'"]'));
  const items=(contentData.faq&&contentData.faq.items)||[];
  $('#faq-fields').innerHTML=items.map((it,i)=>`<div class="field" style="border:1px solid var(--line);border-radius:14px;padding:12px;margin-bottom:12px">
    <label>Фишка ${i+1} — вопрос (\\n = новая строка)</label><textarea data-fq="${i}">${esc(it.q||'')}</textarea>
    <label style="margin-top:8px">Ответ</label><textarea data-fa="${i}">${esc(it.a||'')}</textarea></div>`).join('');
}
function setDeep(obj,path,val){const ks=path.split('.');let o=obj;for(let i=0;i<ks.length-1;i++){o[ks[i]]=o[ks[i]]||{};o=o[ks[i]];}o[ks[ks.length-1]]=val;}
$('#content-save').onclick=async()=>{
  $$('#content-fields [data-ck]').forEach(el=>{
    let v=el.value; if(el.dataset.list)v=v.split(',').map(s=>s.trim()).filter(Boolean);
    setDeep(contentData,el.dataset.ck,v);
  });
  $$('#content-fields [data-ckh]').forEach(el=>setDeep(contentData,el.dataset.ckh,el.innerHTML.trim()));
  await api('saveContent',{pin:PIN,content:contentData});toast('Тексты сохранены');
};
$('#faq-save').onclick=async()=>{
  contentData.faq=contentData.faq||{};contentData.faq.items=contentData.faq.items||[];
  $$('#faq-fields [data-fq]').forEach(el=>{const i=+el.dataset.fq;contentData.faq.items[i]=contentData.faq.items[i]||{};contentData.faq.items[i].q=el.value;});
  $$('#faq-fields [data-fa]').forEach(el=>{const i=+el.dataset.fa;contentData.faq.items[i]=contentData.faq.items[i]||{};contentData.faq.items[i].a=el.value;});
  await api('saveContent',{pin:PIN,content:contentData});toast('FAQ сохранён');
};

/* ---------- РАССЫЛКИ ---------- */
const BOT='https://t.me/ducks_gameclub_bot', CHAN='https://t.me/duckspokerspace';
const TEMPLATES=[
  {name:'Приглашение на вечер',sub:'зовём за стол',subject:'Ждём тебя на ближайшем вечере в DUCK\'S',
   body:'Привет, {name}!<br><br>В эту субботу собираемся за столом. Покер, дартс, бильярд и бар для своих.<br>Бронируй место — мест немного.',
   buttons:[{label:'Записаться',url:BOT},{label:'Мы в Telegram',url:CHAN}]},
  {name:'Турнир по покеру',sub:'анонс турнира',subject:'Покерный турнир в DUCK\'S — успей записаться',
   body:'{name}, открыта запись на турнир. Формат BOUNTY, призовой рейтинг клуба.<br>Старт в 19:00.',
   buttons:[{label:'Записаться',url:BOT},{label:'Подпишись на анонсы',url:CHAN}]},
  {name:'Возвращаем гостя',sub:'давно не виделись',subject:'Соскучились по тебе в DUCK\'S',
   body:'{name}, давно тебя не было за столом. Возвращайся — для своих всегда место найдётся.',
   buttons:[{label:'Записаться',url:BOT}]},
  {name:'Скидка −15%',sub:'напоминание о купоне',subject:'Твоя скидка −15% ещё ждёт',
   body:'{name}, напоминаем: у тебя есть скидка 15% на вечер. Покажи купон на входе.',
   buttons:[{label:'Забрать бонус',url:CHAN},{label:'Записаться',url:BOT}]},
];
// Правильные ссылки клуба и лид-магнитов (одно слово, без .html) для быстрой вставки
const SITE='https://ducks.games';
const QUICK=[
  ['Записаться',BOT],['Мы в Telegram',CHAN],
  ['Правила покера',SITE+'/pravila'],['Как читать людей',SITE+'/lyudi'],
  ['Игры для мозга',SITE+'/mozg'],['10 шагов',SITE+'/shagi'],['Система',SITE+'/system'],
];
let nlReady=false;
function loadNews(){
  if(!nlReady){
    mountRT('[data-rt="nl-body"]'); $('#nl-add-btn').onclick=()=>addBtnRow();
    $('#nl-quick').innerHTML=QUICK.map((q,i)=>`<button class="btn ghost sm" type="button" data-qi="${i}">+ ${esc(q[0])}</button>`).join('');
    $$('#nl-quick [data-qi]').forEach(b=>b.onclick=()=>{const q=QUICK[+b.dataset.qi];addBtnRow(q[0],q[1]);toast('Кнопка добавлена');});
    nlReady=true;
  }
  $('#tpl-grid').innerHTML=TEMPLATES.map((t,i)=>`<div class="tpl" onclick="useTpl(${i})"><b>${esc(t.name)}</b><span>${esc(t.sub)}</span></div>`).join('');
  api('getNewsletters',{},{get:true,query:'pin='+PIN}).then(j=>{
    $('#nl-log').innerHTML=(j.items&&j.items.length)?j.items.map(n=>{
      const dt=new Date(n.created*1000).toLocaleString('ru-RU');
      return `<div class="row"><div class="nm" style="font-size:14px">${esc(n.subject)}</div><div class="meta">${n.recipients} получателей · ${esc(n.audience)} · ${dt}</div></div>`;
    }).join(''):'<div class="empty">Рассылок ещё не было</div>';
  });
}
window.useTpl=(i)=>{const t=TEMPLATES[i];$('#nl-subject').value=t.subject;$('#nl-body').innerHTML=t.body;
  $('#nl-btn-rows').innerHTML='';(t.buttons||[]).forEach(b=>addBtnRow(b.label,b.url));toast('Шаблон загружен');};
function addBtnRow(text='',url=''){
  const wrap=$('#nl-btn-rows');const row=document.createElement('div');row.className='btn-row';
  row.innerHTML=`<input placeholder="Текст кнопки" value="${esc(text)}"><input placeholder="https://ссылка" value="${esc(url)}"><button type="button" class="del" title="Удалить">${ICO.trash}</button>`;
  row.querySelector('.del').onclick=()=>row.remove();wrap.append(row);
}
function getBtnRows(){return $$('#nl-btn-rows .btn-row').map(r=>{const i=r.querySelectorAll('input');return{label:i[0].value.trim(),url:i[1].value.trim()};}).filter(x=>x.label&&x.url);}
function nlBody(){return $('#nl-body').innerHTML.trim();}
function readFiles(){return Promise.all([...$('#nl-files').files].map(f=>new Promise(res=>{const r=new FileReader();r.onload=()=>res({name:f.name,type:f.type,data:r.result});r.readAsDataURL(f);})));}
$('#nl-test-btn').onclick=async()=>{
  const test=$('#nl-test').value.trim();if(!test)return toast('Укажи почту для теста');
  const atts=await readFiles();
  const r=await api('sendNewsletter',{pin:PIN,subject:$('#nl-subject').value,html:nlBody(),buttons:getBtnRows(),attachments:atts,test});
  toast(r.ok?'Тест отправлен':'Ошибка');
};
$('#nl-send').onclick=async()=>{
  if(!$('#nl-subject').value||!nlBody())return toast('Заполни тему и текст');
  if(!confirm('Отправить рассылку выбранной аудитории?'))return;
  const atts=await readFiles();
  $('#nl-send').textContent='Отправка…';$('#nl-send').disabled=true;
  const r=await api('sendNewsletter',{pin:PIN,subject:$('#nl-subject').value,html:nlBody(),buttons:getBtnRows(),attachments:atts,audience:$('#nl-audience').value});
  $('#nl-send').textContent='Отправить всем';$('#nl-send').disabled=false;
  toast(r.ok?`Отправлено: ${r.sent}/${r.total}`:'Ошибка');loadNews();
};

/* ---------- НАСТРОЙКИ ---------- */
async function loadSettings(){
  const j=await api('getSettings',{},{get:true,query:'pin='+PIN});
  if(!j.ok)return;const s=j.settings;
  ['club_address','club_address_map','welcome_text','invite_text'].forEach(k=>{const el=$('#set-'+k);if(el)el.value=s[k]||'';});
}
$('#set-save').onclick=async()=>{
  const o={};['club_address','club_address_map','welcome_text','invite_text'].forEach(k=>o[k]=$('#set-'+k).value);
  await api('saveSettings',{pin:PIN,settings:o});toast('Настройки сохранены');
};
// смена PIN — только цифры, обновляем сессию на лету
['pin-new','pin-new2'].forEach(id=>$('#'+id).addEventListener('input',e=>{e.target.value=e.target.value.replace(/\D/g,'');}));
$('#pin-save').onclick=async()=>{
  const a=$('#pin-new').value,b=$('#pin-new2').value;
  if(a.length<4||a.length>6)return toast('PIN: 4–6 цифр');
  if(a!==b)return toast('PIN не совпадает');
  const r=await api('setPin',{pin:PIN,newPin:a});
  if(r.ok){PIN=r.pin;sessionStorage.setItem(PIN_KEY,PIN);$('#pin-new').value='';$('#pin-new2').value='';toast('PIN изменён');}
  else toast(r.error||'Ошибка');
};

/* ---------- rich-text редактор (Ж/К/П, размер, цвет) ---------- */
function mountRT(sel){
  const tools=$(sel); if(!tools||tools.dataset.mounted) return; tools.dataset.mounted='1';
  const target=$('#'+tools.dataset.rt);
  const cmd=(c,v)=>{target.focus();document.execCommand(c,false,v);};
  const mk=(html,fn,title)=>{const b=document.createElement('button');b.type='button';b.title=title||'';b.innerHTML=html;
    b.onmousedown=(e)=>{e.preventDefault();fn();};return b;};
  tools.append(
    mk('<b>Ж</b>',()=>cmd('bold'),'Жирный'),
    mk('<i>К</i>',()=>cmd('italic'),'Курсив'),
    mk('<u>П</u>',()=>cmd('underline'),'Подчёркнутый'),
  );
  const sz=document.createElement('select');
  [['Размер',''],['Мелкий','2'],['Обычный','3'],['Крупный','5'],['Заголовок','6']].forEach(([t,v])=>{
    const o=document.createElement('option');o.textContent=t;o.value=v;sz.append(o);});
  sz.onchange=()=>{if(sz.value)cmd('fontSize',sz.value);sz.selectedIndex=0;};
  tools.append(sz, mk('<span style="color:#cc0000">Цвет</span>',()=>cmd('foreColor','#cc0000'),'Красный'),
    mk('Очистить',()=>cmd('removeFormat'),'Убрать формат'));
}

/* ---------- иконки в заголовках и навигации ---------- */
(function renderIcons(){
  $$('h3[data-ico]').forEach(h=>{ if(!h.querySelector('.ico')) h.insertAdjacentHTML('afterbegin', I(h.dataset.ico,18)+' '); });
  const navIco={dash:'dash',subs:'users',coupons:'ticket',content:'text',news:'mail',settings:'gear'};
  $$('.nav button').forEach(b=>{ const ic=navIco[b.dataset.p]; if(ic&&!b.querySelector('.ico')) b.insertAdjacentHTML('afterbegin', I(ic,16)); });
})();

/* ---------- modal/utils ---------- */
function openSheet(html){$('#sheet').innerHTML=html;$('#modal').classList.add('on');}
function closeSheet(){$('#modal').classList.remove('on');}
$('#modal').onclick=(e)=>{if(e.target.id==='modal')closeSheet();};
function debounce(fn,ms){let t;return(...a)=>{clearTimeout(t);t=setTimeout(()=>fn(...a),ms);};}
</script>
</body>
</html>
