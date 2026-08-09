/* ============================================================================
   OKO · СИСТЕМА РОСТА (growth layer)
   Грузится ПОСЛЕ app.js / oko-v2.js. Ядро не переписываем — только читаем его
   состояние и дорисовываем свой слой. Всё в IIFE, каждый блок в try/catch:
   одна ошибка здесь не имеет права уронить приложение.

   Что внутри:
     1  ОНБОРДИНГ    живой чек-лист «Старт в OKO» на 5 шагов, сворачивается в пилюлю
     2  ВОРОНКА      okgPaywall(feature) — окно ценности вместо стены платежа
     3  ПАРТНЁРКА    ссылка + свой QR на canvas + расчётчик дохода + 5 материалов
     4  УВЕДОМЛЕНИЯ  тихий планировщик okgQueue: 1 окно за сессию, повод раз в 2 дня
     5  ВИТРИНА      блок «Как тебя найдут» — советы с цифрами и действием
     6  АНТИ-РАЗДРАЖЕНИЕ  тап вне / крестик / Escape / «больше не показывать»,
                          тишина первые 20 сек, в звонке, на записи, в Клипах

   Публичное API:
     window.okgPaywall(feature)        воронка под конкретную фичу
     window.okgOnboardOpen()           открыть чек-лист первого дня
     window.okgPartnerWidget(hostEl)   смонтировать партнёрский двигатель
     window.okgNudge(kind)             поставить повод в очередь
     window.okgReset()                 стереть всё состояние роста
   Сверх минимума (удобно для ядра):
     window.okgShowcase(hostEl)        витрина «Как тебя найдут»
     window.okgStep(id)                отметить шаг онбординга вручную
     window.okgQueue                   сам планировщик { push, drain, state }
   ============================================================================ */
(function okoGrowth(){
'use strict';

var log = function(){};   /* отладка: console.log.bind(console,'[okg]') */

/* ===========================================================================
   0 · УТИЛИТЫ
   =========================================================================== */

var LS_KEY   = 'okg-state-v1';
var DAY      = 86400000;
var OKO_CH   = 'ch-disc-4';          /* канал «OKO Новости» из ядра */
/* Полноэкранные экраны ядра, поверх которых наш слой не показывается никогда. */
var GATES    = ['splash','onboard','authScreen','regView','callScreen','okoPopup'];
var SILENCE  = 20000;                /* тишина перед всплывающими окнами, мс */
var CARD_DELAY = 4000;               /* чек-лист не перебивает — ему хватает 4 сек */
var COOLDOWN = 2 * DAY;              /* один повод — не чаще раза в 2 дня */

var SESSION_START = Date.now();
var sessionPopupShown = false;

function now(){ return Date.now(); }
function dayKey(ts){ var d = new Date(ts || now()); return d.getFullYear()+'-'+(d.getMonth()+1)+'-'+d.getDate(); }
function clamp(v,a,b){ return v < a ? a : (v > b ? b : v); }

function esc(s){
  return String(s == null ? '' : s)
    .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
    .replace(/"/g,'&quot;').replace(/'/g,'&#39;');
}
function ico(id, cls){
  return '<svg class="okg-i'+(cls ? ' '+cls : '')+'" aria-hidden="true"><use href="#i-'+id+'"/></svg>';
}
function say(msg){
  try{ if(typeof toast === 'function'){ toast(msg); return; } }catch(e){}
  try{ if(window.okoToast) window.okoToast(msg); }catch(e){}
}
function tap(kind){ try{ if(typeof okoHaptic === 'function') okoHaptic(kind || 'selection'); }catch(e){} }
function track(ev, props){ try{ if(typeof window.okoTrack === 'function') window.okoTrack(ev, props || {}); }catch(e){} }

function rub(n){
  try{ return Math.round(n).toLocaleString('ru-RU').replace(/ /g,' ').replace(/,/g,' ') + ' ₽'; }
  catch(e){ return Math.round(n) + ' ₽'; }
}
/* «5 человек» / «21 человек» / «3 человека» — без этого текст выглядит машинным */
function plural(n, one, few, many){
  var a = Math.abs(n) % 100, b = a % 10;
  if(a > 10 && a < 20) return many;
  if(b > 1 && b < 5) return few;
  if(b === 1) return one;
  return many;
}
function copyText(text){
  return new Promise(function(resolve){
    try{
      if(navigator.clipboard && navigator.clipboard.writeText){
        navigator.clipboard.writeText(text).then(function(){ resolve(true); }, function(){ resolve(legacyCopy(text)); });
        return;
      }
    }catch(e){}
    resolve(legacyCopy(text));
  });
}
function legacyCopy(text){
  try{
    var ta = document.createElement('textarea');
    ta.value = text;
    ta.setAttribute('readonly','');
    ta.style.cssText = 'position:fixed;left:-9999px;top:0;opacity:0';
    document.body.appendChild(ta);
    ta.select(); ta.setSelectionRange(0, 99999);
    var ok = document.execCommand('copy');
    document.body.removeChild(ta);
    return ok;
  }catch(e){ return false; }
}

/* ===========================================================================
   1 · СОСТОЯНИЕ
   =========================================================================== */

var S = (function loadState(){
  var base = {
    born:     now(),
    days:     [],        /* дни активности, для триггера «3-й день» */
    steps:    {},        /* вручную отмеченные шаги онбординга */
    ob:       { collapsed:false, closed:false },
    nudge:    {},        /* kind -> когда показывали в последний раз */
    off:      {},        /* kind -> «больше не показывать» */
    snooze:   {},        /* feature -> «напомнить через неделю», до когда */
    refCopied:false,
    paid:     false,
    lastTier: 'FREE',
    partnerOn:false
  };
  try{
    var raw = JSON.parse(localStorage.getItem(LS_KEY) || 'null');
    if(raw && typeof raw === 'object'){
      for(var k in base) if(!(k in raw)) raw[k] = base[k];
      return raw;
    }
  }catch(e){}
  return base;
})();

function save(){ try{ localStorage.setItem(LS_KEY, JSON.stringify(S)); }catch(e){} }

/* ===========================================================================
   2 · ФАКТЫ О ЧЕЛОВЕКЕ
   Всё читаем из настоящего состояния приложения, ничего не выдумываем.
   Каждое чтение защищено: ядро может смениться, слой роста от этого не падает.
   =========================================================================== */

function tier(){
  try{ if(typeof okoTier === 'function') return String(okoTier()).toUpperCase(); }catch(e){}
  try{ if(typeof PROFILE !== 'undefined' && PROFILE && PROFILE.tier) return String(PROFILE.tier).toUpperCase().replace(/[- ].*/,''); }catch(e){}
  return 'FREE';
}
function isFree(){ return tier() === 'FREE'; }

function prof(){
  try{ if(typeof PROFILE !== 'undefined' && PROFILE) return PROFILE; }catch(e){}
  return {};
}
function nick(){
  var n = String(prof().nick || '').replace(/^@/,'').trim();
  return n || 'oko';
}
function refLink(){ return 'https://okoteam.top/r/' + nick(); }

function chState(){
  try{ return JSON.parse(localStorage.getItem('oko-channels') || 'null') || null; }catch(e){ return null; }
}
function subbedOko(){
  var c = chState();
  return !!(c && c.sub && c.sub[OKO_CH]);
}
function lessonsDone(){
  try{ if(typeof acLessonsDoneCount === 'function') return acLessonsDoneCount() | 0; }catch(e){}
  try{
    var a = JSON.parse(localStorage.getItem('oko-academy') || 'null');
    if(a && a.lessons){
      var n = 0;
      for(var k in a.lessons){ var l = a.lessons[k]; if(l && l.watched) n++; }
      return n;
    }
  }catch(e){}
  return 0;
}
function videoChecks(){
  try{ if(typeof vcHistory === 'function') return (vcHistory() || []).length; }catch(e){}
  try{ return (JSON.parse(localStorage.getItem('oko-vc-history') || '[]') || []).length; }catch(e){}
  return 0;
}
function anketaSaved(){
  try{ return (JSON.parse(localStorage.getItem('oko-systems') || '[]') || []).length > 0; }catch(e){ return false; }
}
function anketaStarted(){
  try{
    if(typeof aState !== 'undefined' && aState && aState.answers){
      var n = 0; for(var k in aState.answers) if(String(aState.answers[k] || '').trim()) n++;
      return n;
    }
  }catch(e){}
  return 0;
}
function daysActive(){ return (S.days || []).length; }

/* Сколько дней осталось до конца тарифа, если конец вообще известен.
   Ядро может назвать поле по-разному — принимаем любое из этих.
   null = срока нет или он далеко, повод «истекает тариф» молчит. */
function tierEndsIn(){
  try{
    if(isFree()) return null;
    var p = prof();
    var raw = p.tierUntil || p.planUntil || p.tierExpires || p.subUntil || p.expiresAt || null;
    if(!raw) return null;
    var t = (typeof raw === 'number') ? raw : new Date(raw).getTime();
    if(!t || isNaN(t)) return null;
    var left = t - now();
    if(left <= 0 || left >= 5 * DAY) return null;
    return Math.max(1, Math.ceil(left / DAY));
  }catch(e){ return null; }
}

/* ===========================================================================
   3 · СТИЛИ
   Всё через переменные бренда — обе темы получаются сами.
   Свои переменные добавляем только там, где у ядра нет подходящей.
   =========================================================================== */

function injectCSS(){
  if(document.getElementById('okg-style')) return;
  var css = [
'/* ---- переменные слоя роста ---- */',
':root{',
'  --okg-scrim: rgba(0,0,0,.74);',
'  --okg-soft: rgba(154,255,0,.10);',
'  --okg-soft2: rgba(154,255,0,.18);',
'  --okg-shadow: 0 24px 60px rgba(0,0,0,.6);',
'  --okg-on-lime: #0a1002;',
'}',
':root[data-theme="light"]{',
'  --okg-scrim: rgba(16,26,8,.44);',
'  --okg-soft: rgba(110,200,0,.12);',
'  --okg-soft2: rgba(110,200,0,.22);',
'  --okg-shadow: 0 20px 48px rgba(30,50,10,.18);',
'  --okg-on-lime: #0a1002;',
'}',

'/* Селектор именно svg.okg-i, а не просто .okg-i: в oko-v2.css лежит',
'   `img, video, canvas, svg:not(.i) { height:auto }`. У него специфичность выше,',
'   чем у одного класса, и наши иконки растягивало до 150 пикселей.',
'   Тут вес равный, а наш <style> подключается последним — значит, выигрываем мы. */',
'svg.okg-i{ width:16px; height:16px; max-width:none; flex:0 0 auto;',
'  fill:none; stroke:currentColor; stroke-width:2; stroke-linecap:round; stroke-linejoin:round; }',

'/* ---- общая оболочка окна ---- */',
'.okg-scrim{ position:fixed; inset:0; z-index:100040; background:var(--okg-scrim);',
'  backdrop-filter:blur(6px); -webkit-backdrop-filter:blur(6px);',
'  display:flex; align-items:center; justify-content:center;',
'  padding: calc(var(--oko-safe-top) + 16px) calc(var(--oko-safe-right) + 14px)',
'           calc(var(--oko-safe-bottom) + 16px) calc(var(--oko-safe-left) + 14px);',
'  opacity:0; transition:opacity .2s ease; }',
'.okg-scrim.on{ opacity:1; }',

'.okg-card{ width:100%; max-width:420px; max-height:100%; overflow-y:auto;',
'  -webkit-overflow-scrolling:touch; background:var(--surface); color:var(--text);',
'  border:1px solid var(--border); border-radius:var(--r-lg,22px);',
'  box-shadow:var(--okg-shadow); position:relative;',
'  transform:translateY(14px) scale(.98); transition:transform .24s cubic-bezier(.3,1,.4,1); }',
'.okg-scrim.on .okg-card{ transform:none; }',
'.okg-card::before{ content:""; position:absolute; inset:0; border-radius:inherit; pointer-events:none;',
'  background:radial-gradient(120% 90% at 100% -10%, var(--okg-soft), transparent 60%); }',

'.okg-x{ position:absolute; top:12px; right:12px; z-index:3; width:32px; height:32px;',
'  display:flex; align-items:center; justify-content:center; border-radius:50%;',
'  background:var(--raised); border:1px solid var(--border); color:var(--dim); }',
'.okg-x .okg-i{ width:15px; height:15px; }',
'.okg-x:hover{ color:var(--text); }',

'.okg-body{ position:relative; z-index:2; padding:22px 20px 18px; }',
'.okg-chip{ display:inline-flex; align-items:center; gap:6px; padding:4px 10px; border-radius:99px;',
'  background:var(--okg-soft2); color:var(--accent); font-size:10.5px; font-weight:800;',
'  letter-spacing:.09em; text-transform:uppercase; }',
'.okg-h{ font-family:var(--font-display); font-size:29px; line-height:1.02; letter-spacing:.03em;',
'  margin:12px 0 0; color:var(--text); }',
'.okg-sub{ font-size:13.5px; line-height:1.5; color:var(--dim); margin-top:8px; }',

'/* ---- списки «уже есть» / «откроется» ---- */',
'.okg-list{ list-style:none; margin:14px 0 0; padding:0; display:flex; flex-direction:column; gap:8px; }',
'.okg-list li{ display:flex; align-items:flex-start; gap:9px; font-size:13px; line-height:1.42; }',
'.okg-list li .okg-i{ margin-top:2px; }',
'.okg-list.have li{ color:var(--dim); }',
'.okg-list.have li .okg-i{ color:var(--dim); }',
'.okg-list.get li{ color:var(--text); font-weight:500; }',
'.okg-list.get li .okg-i{ color:var(--accent); }',
'.okg-lbl{ font-size:10.5px; font-weight:800; letter-spacing:.09em; text-transform:uppercase;',
'  color:var(--dim); margin:18px 0 0; }',

'/* ---- цифра выгоды ---- */',
'.okg-num{ margin-top:16px; padding:14px 16px; border-radius:var(--r-md,14px);',
'  background:var(--raised); border:1px solid var(--border); }',
'.okg-num b{ display:block; font-family:var(--font-display); font-size:34px; line-height:1;',
'  letter-spacing:.02em; color:var(--accent); }',
'.okg-num span{ display:block; font-size:12.5px; line-height:1.45; color:var(--dim); margin-top:6px; }',

'/* ---- цена ---- */',
'.okg-price{ margin-top:16px; display:flex; align-items:baseline; gap:9px; flex-wrap:wrap; }',
'.okg-price b{ font-family:var(--font-display); font-size:40px; line-height:.92; color:var(--text); }',
'.okg-price i{ font-style:normal; font-size:12.5px; color:var(--dim); }',
'.okg-price-note{ font-size:11.5px; color:var(--dim); margin-top:5px; }',

'/* ---- кнопки ---- */',
'.okg-acts{ margin-top:18px; display:flex; flex-direction:column; gap:9px; }',
'.okg-btn{ width:100%; min-height:48px; padding:13px 16px; border-radius:14px;',
'  font-family:var(--font-body); font-size:14.5px; font-weight:700; letter-spacing:.01em;',
'  display:flex; align-items:center; justify-content:center; gap:8px;',
'  border:1px solid transparent; transition:transform .12s ease, filter .18s ease, background .18s; }',
'.okg-btn:active{ transform:scale(.985); }',
'.okg-btn.pri{ background:var(--lime); color:var(--okg-on-lime); }',
'.okg-btn.pri:hover{ filter:brightness(1.07); }',
'.okg-btn.gho{ background:transparent; color:var(--text); border-color:var(--border); }',
'.okg-btn.gho:hover{ background:var(--raised); }',
'.okg-mute{ display:block; width:100%; margin-top:12px; padding:6px; font-size:12px;',
'  color:var(--dim); text-align:center; text-decoration:underline; text-underline-offset:3px; }',
'.okg-mute:hover{ color:var(--text); }',

'/* ---- 1 · ЧЕК-ЛИСТ ПЕРВОГО ДНЯ ---- */',
'.okg-ob{ position:fixed; z-index:9300; left:50%; transform:translateX(-50%);',
'  bottom: calc(var(--oko-safe-bottom) + 68px);',
'  width:min(420px, calc(100vw - 24px - var(--oko-safe-left) - var(--oko-safe-right)));',
'  background:var(--surface); border:1px solid var(--border); border-radius:18px;',
'  box-shadow:var(--okg-shadow); overflow:hidden;',
'  animation: okg-rise .32s cubic-bezier(.3,1,.4,1) both; }',
'@keyframes okg-rise{ from{ opacity:0; transform:translateX(-50%) translateY(16px); } }',
'.okg-ob[hidden]{ display:none !important; }',

'.okg-ob-head{ display:flex; align-items:center; gap:10px; padding:13px 12px 13px 15px; }',
'.okg-ob-t{ flex:1; min-width:0; }',
'.okg-ob-t b{ display:block; font-family:var(--font-display); font-size:19px; letter-spacing:.05em;',
'  line-height:1; color:var(--text); }',
'.okg-ob-t small{ display:block; font-size:11.5px; color:var(--dim); margin-top:4px; }',
'.okg-ob-ic{ width:30px; height:30px; border-radius:9px; background:var(--okg-soft2); color:var(--accent);',
'  display:flex; align-items:center; justify-content:center; flex:0 0 auto; }',
'.okg-ob-btn{ width:30px; height:30px; border-radius:8px; display:flex; align-items:center;',
'  justify-content:center; color:var(--dim); flex:0 0 auto; }',
'.okg-ob-btn:hover{ background:var(--raised); color:var(--text); }',
'.okg-ob-btn .okg-i{ width:15px; height:15px; }',

'.okg-bar{ height:4px; background:var(--raised); overflow:hidden; }',
'.okg-bar i{ display:block; height:100%; background:var(--lime); border-radius:0 3px 3px 0;',
'  transition:width .5s cubic-bezier(.3,1,.4,1); }',

'.okg-steps{ padding:6px 6px 8px; }',
'.okg-step{ display:flex; align-items:center; gap:11px; width:100%; padding:10px 9px; border-radius:12px;',
'  text-align:left; transition:background .16s ease; }',
'.okg-step:hover{ background:var(--raised); }',
'.okg-step-n{ width:24px; height:24px; border-radius:50%; flex:0 0 auto;',
'  display:flex; align-items:center; justify-content:center;',
'  font-size:11.5px; font-weight:800; color:var(--dim);',
'  background:var(--raised); border:1px solid var(--border); }',
'.okg-step.done .okg-step-n{ background:var(--lime); border-color:var(--lime); color:var(--okg-on-lime); }',
'.okg-step.done .okg-step-n .okg-i{ width:13px; height:13px; stroke-width:3; }',
'.okg-step-b{ flex:1; min-width:0; }',
'.okg-step-b b{ display:block; font-size:13.5px; font-weight:600; color:var(--text); line-height:1.25; }',
'.okg-step.done .okg-step-b b{ color:var(--dim); text-decoration:line-through; text-decoration-thickness:1px; }',
'.okg-step-b small{ display:block; font-size:11.5px; color:var(--dim); margin-top:2px; line-height:1.35; }',
'.okg-step .okg-chev{ color:var(--dim); }',
'.okg-step .okg-chev .okg-i{ width:14px; height:14px; }',
'.okg-step.done .okg-chev{ opacity:0; }',

'/* пилюля свёрнутого чек-листа */',
'.okg-pill{ position:fixed; z-index:9300; right: calc(var(--oko-safe-right) + 12px);',
'  bottom: calc(var(--oko-safe-bottom) + 68px);',
'  display:flex; align-items:center; gap:9px; padding:8px 14px 8px 9px; border-radius:99px;',
'  background:var(--surface); border:1px solid var(--border); box-shadow:var(--okg-shadow);',
'  animation: okg-pop .28s cubic-bezier(.3,1,.4,1) both; }',
'@keyframes okg-pop{ from{ opacity:0; transform:scale(.9); } }',
'.okg-pill[hidden]{ display:none !important; }',
'.okg-pill b{ font-family:var(--font-display); font-size:15px; letter-spacing:.06em; color:var(--text); }',
'.okg-pill small{ font-size:11px; color:var(--dim); font-weight:600; }',
'.okg-ring{ position:relative; width:28px; height:28px; flex:0 0 auto; }',
'.okg-ring svg{ width:28px; height:28px; transform:rotate(-90deg); }',
'.okg-ring circle{ fill:none; stroke-width:3; }',
'.okg-ring .bg{ stroke:var(--raised); }',
'.okg-ring .fg{ stroke:var(--lime); stroke-linecap:round; transition:stroke-dashoffset .5s ease; }',

'/* ---- 3 · ПАРТНЁРСКИЙ ДВИГАТЕЛЬ ---- */',
'.okg-part{ display:flex; flex-direction:column; gap:12px; }',
'.okg-block{ background:var(--surface); border:1px solid var(--border);',
'  border-radius:var(--r-lg,22px); padding:16px; }',
'.okg-block > h4{ font-family:var(--font-body); font-size:13.5px; font-weight:700; margin:0;',
'  color:var(--text); display:flex; align-items:center; gap:8px; }',
'.okg-block > h4 .okg-i{ color:var(--accent); width:17px; height:17px; }',
'.okg-block > p{ font-size:12px; color:var(--dim); margin:6px 0 0; line-height:1.5; }',

'.okg-link{ margin-top:12px; display:flex; align-items:center; gap:8px; padding:11px 12px;',
'  border-radius:13px; background:var(--raised); border:1px solid var(--border); }',
'.okg-link span{ flex:1; min-width:0; font-size:13px; font-weight:600; color:var(--text);',
'  overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }',
'.okg-link-btns{ display:flex; gap:8px; margin-top:10px; }',
'.okg-link-btns .okg-btn{ min-height:42px; padding:10px 12px; font-size:13px; }',

'.okg-qr{ margin-top:12px; display:flex; flex-direction:column; align-items:center; gap:10px; }',
'.okg-qr-box{ padding:12px; border-radius:16px; background:#fff; line-height:0;',
'  box-shadow:0 6px 20px rgba(0,0,0,.22); }',
'.okg-qr canvas{ display:block; width:168px; height:168px; image-rendering:pixelated; }',
'.okg-qr small{ font-size:11.5px; color:var(--dim); text-align:center; }',
'.okg-qr-big{ font-family:var(--font-display); font-size:22px; letter-spacing:.03em;',
'  color:var(--accent); word-break:break-all; text-align:center; }',

'.okg-calc-v{ margin-top:12px; display:flex; align-items:baseline; gap:8px; }',
'.okg-calc-v b{ font-family:var(--font-display); font-size:32px; line-height:1; color:var(--text); }',
'.okg-calc-v i{ font-style:normal; font-size:12.5px; color:var(--dim); }',
'.okg-range{ -webkit-appearance:none; appearance:none; width:100%; height:26px; margin-top:6px;',
'  background:transparent; display:block; }',
'.okg-range::-webkit-slider-runnable-track{ height:6px; border-radius:3px; background:var(--raised);',
'  border:1px solid var(--border); }',
'.okg-range::-webkit-slider-thumb{ -webkit-appearance:none; appearance:none; width:22px; height:22px;',
'  margin-top:-9px; border-radius:50%; background:var(--lime); border:2px solid var(--surface);',
'  box-shadow:0 2px 8px rgba(0,0,0,.35); cursor:pointer; }',
'.okg-range::-moz-range-track{ height:6px; border-radius:3px; background:var(--raised);',
'  border:1px solid var(--border); }',
'.okg-range::-moz-range-thumb{ width:20px; height:20px; border-radius:50%; background:var(--lime);',
'  border:2px solid var(--surface); cursor:pointer; }',
'.okg-rows{ margin-top:12px; display:flex; flex-direction:column; gap:1px;',
'  border-radius:12px; overflow:hidden; }',
'.okg-row{ display:flex; align-items:center; justify-content:space-between; gap:12px;',
'  padding:11px 13px; background:var(--raised); font-size:12.5px; color:var(--dim); }',
'.okg-row b{ font-size:14.5px; font-weight:700; color:var(--text); white-space:nowrap; }',
'.okg-row.hi{ background:var(--okg-soft); }',
'.okg-row.hi b{ color:var(--accent); }',
'.okg-note{ font-size:11px; color:var(--dim); line-height:1.5; margin-top:9px; }',

'.okg-mats{ margin-top:12px; display:flex; flex-direction:column; gap:9px; }',
'.okg-mat{ border:1px solid var(--border); border-radius:14px; background:var(--raised); overflow:hidden; }',
'.okg-mat-h{ display:flex; align-items:center; gap:9px; width:100%; padding:11px 13px; text-align:left; }',
'.okg-mat-h b{ flex:1; min-width:0; font-size:12.5px; font-weight:700; color:var(--text); }',
'.okg-mat-h em{ font-style:normal; font-size:10.5px; font-weight:700; letter-spacing:.07em;',
'  text-transform:uppercase; color:var(--accent); }',
'.okg-mat-h .okg-i{ color:var(--dim); transition:transform .2s ease; }',
'.okg-mat.open .okg-mat-h .okg-i.okg-chevi{ transform:rotate(90deg); }',
'.okg-mat-b{ display:none; padding:0 13px 13px; }',
'.okg-mat.open .okg-mat-b{ display:block; }',
'.okg-mat-b pre{ font-family:var(--font-body); font-size:12.5px; line-height:1.62; color:var(--text);',
'  white-space:pre-wrap; word-break:break-word; margin:0 0 10px; }',
'.okg-mat-b .okg-btn{ min-height:40px; font-size:12.5px; }',

'/* ---- 5 · ВИТРИНА «КАК ТЕБЯ НАЙДУТ» ---- */',
'.okg-show{ display:flex; flex-direction:column; gap:10px; }',
'/* Поля по бокам свои: на части экранов у ядра .pad без горизонтального поля,',
'   и заголовок упирался в самый край стекла. У карточек поле внутреннее,',
'   поэтому равняем заголовок по нему. */',
'.okg-show-h{ display:flex; align-items:baseline; justify-content:space-between; gap:10px;',
'  padding:0 14px; }',
'.okg-show-h h3{ font-family:var(--font-display); font-size:24px; letter-spacing:.04em; margin:0;',
'  color:var(--text); min-width:0; }',
'.okg-show-h span{ font-size:11.5px; color:var(--dim); flex:0 0 auto; }',
'.okg-tip{ display:flex; align-items:flex-start; gap:12px; width:100%; text-align:left;',
'  padding:14px; border-radius:16px; background:var(--surface); border:1px solid var(--border);',
'  transition:border-color .18s ease, transform .12s ease; }',
'.okg-tip:hover{ border-color:var(--okg-soft2); }',
'.okg-tip:active{ transform:scale(.995); }',
'.okg-tip.done{ opacity:.62; }',
'.okg-tip-ic{ width:34px; height:34px; border-radius:11px; flex:0 0 auto;',
'  background:var(--okg-soft2); color:var(--accent);',
'  display:flex; align-items:center; justify-content:center; }',
'.okg-tip-ic .okg-i{ width:17px; height:17px; }',
'.okg-tip-b{ flex:1; min-width:0; }',
'.okg-tip-b b{ display:block; font-size:14px; font-weight:600; color:var(--text); line-height:1.25; }',
'.okg-tip-b small{ display:block; font-size:12px; color:var(--dim); margin-top:4px; line-height:1.45; }',
'.okg-gain{ display:inline-flex; align-items:center; gap:5px; margin-top:8px; padding:3px 9px;',
'  border-radius:99px; background:var(--okg-soft); color:var(--accent);',
'  font-size:11px; font-weight:700; }',
'.okg-gain .okg-i{ width:12px; height:12px; }',

'/* сузим шрифты на маленьких экранах, чтобы ничего не резалось */',
'@media (max-width:360px){',
'  .okg-h{ font-size:25px; }',
'  .okg-price b{ font-size:34px; }',
'  .okg-num b{ font-size:29px; }',
'  .okg-qr canvas{ width:140px; height:140px; }',
'}',
'@media (prefers-reduced-motion: reduce){',
'  .okg-ob, .okg-pill{ animation:none; }',
'  .okg-scrim, .okg-card, .okg-bar i, .okg-ring .fg{ transition:none; }',
'}'
  ].join('\n');

  var st = document.createElement('style');
  st.id = 'okg-style';
  st.textContent = css;
  (document.head || document.documentElement).appendChild(st);
}

/* ===========================================================================
   4 · АНТИ-РАЗДРАЖЕНИЕ
   Ничего не всплывает, пока человек занят. Проверяем перед каждым показом.

   Две строгости:
     busy()             — для всплывающих окон. Плюс тишина первые 20 секунд.
     busy({soft:true})  — для чек-листа. Он не перебивает, а лежит в углу,
                          поэтому ждёт только 4 секунды и уступает тем же
                          настоящим помехам: звонку, записи, Клипам, оверлеям.
   =========================================================================== */

/* Действительно ли элемент сейчас на экране.
   Половина оверлеев ядра не прячется через display, а уезжает трансформом
   (#regView — translateX(100%), шиты — translateY(105%)). Такие элементы
   всегда имеют размер, поэтому одного getComputedStyle мало: смотрим,
   пересекает ли прямоугольник видимую область. */
function visible(el){
  if(!el) return false;
  try{
    if(el.hidden) return false;
    var cs = getComputedStyle(el);
    if(cs.display === 'none' || cs.visibility === 'hidden' || parseFloat(cs.opacity) < 0.05) return false;
    var r = el.getBoundingClientRect();
    if(r.width < 1 || r.height < 1) return false;
    var vw = window.innerWidth || document.documentElement.clientWidth || 0;
    var vh = window.innerHeight || document.documentElement.clientHeight || 0;
    if(r.right <= 1 || r.bottom <= 1 || r.left >= vw - 1 || r.top >= vh - 1) return false;
    return true;
  }catch(e){ return false; }
}

/* Любой полноэкранный оверлей ядра — даже тот, о котором мы ещё не знаем.
   У ядра их полтора десятка (#okoPopup, #chView, #psView, #legalView, #trStories…),
   и список будет расти, поэтому ищем по признакам, а не по именам:
   fixed, накрывает больше половины экрана и ловит нажатия.
   Прозрачные подложки вроде #pp2Nav (pointer-events:none) не в счёт —
   они висят всегда и ничего не перекрывают. */
function coreOverlayUp(){
  try{
    var kids = document.body.children;
    var vw = window.innerWidth || 0, vh = window.innerHeight || 0;
    for(var i=0;i<kids.length;i++){
      var el = kids[i];
      if(el.nodeType !== 1) continue;
      if(el.hasAttribute && el.hasAttribute('data-okg')) continue;   /* это мы сами */
      var tag = el.tagName;
      if(tag === 'STYLE' || tag === 'SCRIPT' || tag === 'LINK' || tag === 'TEMPLATE') continue;
      var cs = getComputedStyle(el);
      if(cs.position !== 'fixed') continue;
      if(cs.pointerEvents === 'none') continue;
      if(cs.display === 'none' || cs.visibility === 'hidden' || parseFloat(cs.opacity) < 0.05) continue;
      var r = el.getBoundingClientRect();
      if(r.width < vw * 0.6 || r.height < vh * 0.4) continue;
      if(r.right <= 1 || r.bottom <= 1 || r.left >= vw - 1 || r.top >= vh - 1) continue;
      return el.id || (typeof el.className === 'string' ? el.className : tag);
    }
  }catch(e){}
  return null;
}

function busy(opt){
  opt = opt || {};
  function no(r){ if(opt.out) opt.out.why = r; return true; }
  try{
    if(now() - SESSION_START < (opt.soft ? CARD_DELAY : SILENCE))
      return no('тишина в начале сессии');
    if(document.hidden) return no('вкладка не на экране');

    /* запись голосового */
    if(document.querySelector('.composer.recording')) return no('запись голосового');

    /* ОТКРЫТЫЙ ДИАЛОГ (правка Даниэля 09.08). Переписка — работа, а не пауза:
       окна не имеют права её накрывать. Ждём, пока человек выйдет из чата. */
    var appEl = document.getElementById('app');
    if(appEl && appEl.classList.contains('conv-open')) return no('открыт диалог');

    /* активный звонок */
    if(document.querySelector('#cl-personal.open, #cl-conf.open')) return no('идёт звонок');

    /* контекстное меню сообщения */
    if(document.querySelector('#msgMenu.open')) return no('меню сообщения');

    /* открытый плеер Клипов */
    try{ if(window.okoReels && window.okoReels.isOpen && window.okoReels.isOpen()) return no('Клипы'); }catch(e){}

    /* полноэкранные «ворота» ядра: заставка, свой онбординг, вход, регистрация,
       звонок, попап. Пока человек проходит их, наш слой молчит совсем —
       иначе два онбординга наезжают друг на друга. */
    for(var g=0; g<GATES.length; g++){
      if(visible(document.getElementById(GATES[g]))) return no('экран ядра: ' + GATES[g]);
    }
    var over = coreOverlayUp();
    if(over) return no('оверлей ядра: ' + over);

    /* наше окно уже висит — оно и так закрывает чек-лист собой */
    if(!opt.soft && document.querySelector('.okg-scrim')) return no('окно уже открыто');

    /* открытые оверлеи ядра: шит, просмотрщик, редактор — не лезем поверх */
    var ov = document.getElementById('sheetOverlay');
    if(ov && visible(ov)) return no('открыт шит');
    if(document.querySelector('.ma-mv.on, .mp-mv.on, #editProfile.open, #chView.open, #psView.open, .sv.open'))
      return no('открыт оверлей ядра');

    /* человек печатает */
    var ae = document.activeElement;
    if(ae && (ae.tagName === 'INPUT' || ae.tagName === 'TEXTAREA' || ae.isContentEditable))
      return no('человек печатает');
  }catch(e){}
  return false;
}

/* ===========================================================================
   5 · ОБЩАЯ ОБОЛОЧКА ОКНА
   Закрывается тапом вне, крестиком и Escape. У каждого окна с поводом —
   «Больше не показывать».
   =========================================================================== */

function okgModal(o){
  o = o || {};
  var scrim = document.createElement('div');
  scrim.className = 'okg-scrim';
  scrim.setAttribute('data-okg','modal');
  scrim.setAttribute('role','dialog');
  scrim.setAttribute('aria-modal','true');
  if(o.title) scrim.setAttribute('aria-label', String(o.title));

  var card = document.createElement('div');
  card.className = 'okg-card';

  var x = document.createElement('button');
  x.className = 'okg-x';
  x.type = 'button';
  x.setAttribute('aria-label','Закрыть');
  x.innerHTML = ico('x');

  var body = document.createElement('div');
  body.className = 'okg-body';
  body.innerHTML = o.html || '';

  card.appendChild(x);
  card.appendChild(body);
  scrim.appendChild(card);
  document.body.appendChild(scrim);

  var closed = false;
  function close(how){
    if(closed) return;
    closed = true;
    try{ document.removeEventListener('keydown', onKey, true); }catch(e){}
    scrim.classList.remove('on');
    setTimeout(function(){ try{ scrim.remove(); }catch(e){} }, 220);
    try{ if(o.onClose) o.onClose(how || 'close'); }catch(e){}
  }
  function onKey(ev){
    if(ev.key === 'Escape' || ev.key === 'Esc'){
      ev.stopPropagation();
      ev.preventDefault();
      close('escape');
    }
  }
  x.addEventListener('click', function(){ tap('light'); close('x'); });
  scrim.addEventListener('click', function(ev){ if(ev.target === scrim){ tap('light'); close('outside'); } });
  document.addEventListener('keydown', onKey, true);

  /* кнопки объявляются данными, чтобы каждое окно не городило свою разметку */
  var api = { root:scrim, body:body, close:close };
  if(o.actions && o.actions.length){
    var wrap = document.createElement('div');
    wrap.className = 'okg-acts';
    o.actions.forEach(function(a){
      if(!a) return;
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'okg-btn ' + (a.kind === 'ghost' ? 'gho' : 'pri');
      b.innerHTML = (a.icon ? ico(a.icon) : '') + '<span>' + esc(a.label) + '</span>';
      b.addEventListener('click', function(){
        tap('impact');
        var keep = false;
        try{ keep = a.onClick && a.onClick(api) === true; }catch(e){}
        if(!keep) close('action:' + (a.id || a.label));
      });
      wrap.appendChild(b);
    });
    body.appendChild(wrap);
  }
  if(o.muteKind){
    var m = document.createElement('button');
    m.type = 'button';
    m.className = 'okg-mute';
    m.textContent = 'Больше не показывать';
    m.addEventListener('click', function(){
      S.off[o.muteKind] = true;
      save();
      track('okg_mute', { kind:o.muteKind });
      say('Больше не покажу');
      close('mute');
    });
    body.appendChild(m);
  }

  requestAnimationFrame(function(){ scrim.classList.add('on'); });
  try{ if(o.onMount) o.onMount(api); }catch(e){}
  track('okg_modal_open', { id:o.id || 'modal' });
  return api;
}

/* ===========================================================================
   6 · ОНБОРДИНГ ПЕРВОГО ДНЯ
   Не карусель на семь экранов, а чек-лист: пять понятных дел, каждое —
   одно нажатие до нужного места.
   =========================================================================== */

var STEPS = [
  { id:'profile',   t:'Заполнить профиль',
    s:'Имя, ник и пара строк о себе — по ним тебя находят',
    go:function(){ try{ if(typeof showTab === 'function') showTab('profile'); }catch(e){}
                   setTimeout(function(){ try{ if(typeof openEdit === 'function') openEdit(); }catch(e){} }, 240); } },

  { id:'channel',   t:'Подписаться на канал OKO',
    s:'Релизы, разборы и розыгрыши — раньше всех',
    go:function(){
      try{
        if(typeof chSubscribe === 'function' && !subbedOko()){ chSubscribe(OKO_CH); }
        else if(typeof chOpen === 'function'){ chOpen('channel', OKO_CH); }
        else if(typeof showTab === 'function'){ showTab('chats'); }
      }catch(e){}
    } },

  { id:'lesson',    t:'Пройти первый урок Академии',
    s:'15 минут — и понятно, как здесь всё устроено',
    go:function(){ try{ if(typeof showTab === 'function') showTab('academy'); }catch(e){} } },

  { id:'reflink',   t:'Забрать партнёрскую ссылку',
    s:'15% с оплат тех, кого приведёшь',
    go:function(){ try{ if(typeof showTab === 'function') showTab('partner'); }catch(e){} } },

  { id:'videocheck',t:'Сделать первую проверку видео',
    s:'Покажет, где ролик теряет зрителя',
    go:function(){
      try{
        if(typeof showTab === 'function') showTab('mini');
        setTimeout(function(){ try{ if(typeof openMa === 'function') openMa('video'); }catch(e){} }, 240);
      }catch(e){}
    } }
];

function stepDone(id){
  if(S.steps[id]) return true;
  try{
    if(id === 'profile'){
      var p = prof();
      return !!(p && String(p.bio || '').trim().length >= 8 && String(p.nick || '').trim());
    }
    if(id === 'channel')    return subbedOko();
    if(id === 'lesson')     return lessonsDone() > 0;
    if(id === 'reflink')    return !!S.refCopied;
    if(id === 'videocheck') return videoChecks() > 0;
  }catch(e){}
  return false;
}
function doneCount(){ var n = 0; STEPS.forEach(function(s){ if(stepDone(s.id)) n++; }); return n; }
function allDone(){ return doneCount() === STEPS.length; }

function markStep(id){
  if(S.steps[id]) return;
  S.steps[id] = now();
  save();
  track('okg_step_done', { step:id });
  try{ renderOnboard(); }catch(e){}
}

var obEl = null, pillEl = null;

function killOnboard(){
  try{ if(obEl){ obEl.remove(); obEl = null; } }catch(e){}
  try{ if(pillEl){ pillEl.remove(); pillEl = null; } }catch(e){}
}

function renderOnboard(force){
  try{
    var done = doneCount(), total = STEPS.length, pct = Math.round(done / total * 100);

    /* всё сделано или человек закрыл — снимаем совсем */
    if((allDone() || S.ob.closed) && !force){ killOnboard(); return; }
    /* пока идёт звонок / Клипы / запись / открыт оверлей — прячем, но не убиваем */
    var hide = busy({ soft:true }) && !force;

    if(S.ob.collapsed){
      killOnboardCard();
      var r = 12, c = 2 * Math.PI * r, off = c * (1 - done / total);
      if(!pillEl){
        pillEl = document.createElement('button');
        pillEl.type = 'button';
        pillEl.className = 'okg-pill';
        pillEl.setAttribute('data-okg','pill');
        pillEl.setAttribute('aria-label','Открыть чек-лист «Старт в OKO»');
        pillEl.addEventListener('click', function(){
          tap('selection'); S.ob.collapsed = false; save(); renderOnboard(true);
        });
        document.body.appendChild(pillEl);
      }
      pillEl.innerHTML =
        '<span class="okg-ring"><svg viewBox="0 0 28 28">' +
          '<circle class="bg" cx="14" cy="14" r="' + r + '"></circle>' +
          '<circle class="fg" cx="14" cy="14" r="' + r + '" stroke-dasharray="' + c.toFixed(1) + '" stroke-dashoffset="' + off.toFixed(1) + '"></circle>' +
        '</svg></span>' +
        '<b>СТАРТ</b><small>' + done + ' / ' + total + '</small>';
      pillEl.hidden = hide;
      return;
    }

    try{ if(pillEl){ pillEl.remove(); pillEl = null; } }catch(e){}

    if(!obEl){
      obEl = document.createElement('section');
      obEl.className = 'okg-ob';
      obEl.setAttribute('data-okg','onboard');
      obEl.setAttribute('aria-label','Старт в OKO');
      document.body.appendChild(obEl);
    }
    var left = total - done;
    var head =
      '<div class="okg-ob-head">' +
        '<span class="okg-ob-ic">' + ico('rocket') + '</span>' +
        '<span class="okg-ob-t"><b>СТАРТ В OKO</b><small>' +
          (left ? ('осталось ' + left + ' ' + plural(left,'шаг','шага','шагов')) : 'всё готово') +
          ' · ' + done + ' из ' + total + '</small></span>' +
        '<button class="okg-ob-btn" type="button" data-okg="collapse" aria-label="Свернуть">' + ico('arrow-down') + '</button>' +
        '<button class="okg-ob-btn" type="button" data-okg="close" aria-label="Закрыть">' + ico('x') + '</button>' +
      '</div>' +
      '<div class="okg-bar"><i style="width:' + pct + '%"></i></div>';

    var rows = STEPS.map(function(s, i){
      var d = stepDone(s.id);
      return '<button class="okg-step' + (d ? ' done' : '') + '" type="button" data-okg-step="' + s.id + '">' +
        '<span class="okg-step-n">' + (d ? ico('check') : (i + 1)) + '</span>' +
        '<span class="okg-step-b"><b>' + esc(s.t) + '</b><small>' + esc(s.s) + '</small></span>' +
        '<span class="okg-chev">' + ico('chev') + '</span>' +
      '</button>';
    }).join('');

    obEl.innerHTML = head + '<div class="okg-steps">' + rows + '</div>';
    obEl.hidden = hide;

    obEl.querySelector('[data-okg="collapse"]').addEventListener('click', function(){
      tap('selection'); S.ob.collapsed = true; save(); renderOnboard(true);
    });
    obEl.querySelector('[data-okg="close"]').addEventListener('click', function(){
      tap('light'); S.ob.closed = true; save(); killOnboard();
      say('Чек-лист в профиле, если понадобится');
      track('okg_onboard_close', { done:done });
    });
    obEl.querySelectorAll('[data-okg-step]').forEach(function(b){
      b.addEventListener('click', function(){
        var id = b.getAttribute('data-okg-step');
        var st = STEPS.filter(function(s){ return s.id === id; })[0];
        if(!st) return;
        tap('impact');
        track('okg_step_go', { step:id });
        S.ob.collapsed = true; save();
        renderOnboard(true);
        try{ st.go(); }catch(e){}
        /* результат шага проверяем чуть позже: ядро успевает отработать */
        setTimeout(function(){ try{ renderOnboard(); }catch(e){} }, 900);
      });
    });
  }catch(e){ log('onboard fail', e); }
}
function killOnboardCard(){ try{ if(obEl){ obEl.remove(); obEl = null; } }catch(e){} }

function okgOnboardOpen(){
  try{
    if(allDone()){
      okgModal({
        id:'onboard-done',
        title:'Старт пройден',
        html:'<span class="okg-chip">' + ico('check') + 'Старт пройден</span>' +
             '<h1 class="okg-h">ВСЁ ПЯТЬ ШАГОВ ЗАКРЫТЫ</h1>' +
             '<p class="okg-sub">Профиль на месте, канал читаешь, первый урок за плечами, ссылка на руках, ' +
             'ролик проверен. Дальше — витрина роста: она подскажет, что сделать, чтобы тебя начали находить.</p>',
        actions:[
          { label:'Открыть витрину роста', icon:'compass', onClick:function(){ goShowcase(); } },
          { label:'Закрыть', kind:'ghost' }
        ]
      });
      return;
    }
    S.ob.closed = false;
    S.ob.collapsed = false;
    save();
    renderOnboard(true);
  }catch(e){}
}

/* ===========================================================================
   7 · ВОРОНКА ЦЕННОСТИ ВМЕСТО СТЕНЫ ПЛАТЕЖА
   Человек упёрся в лимит. Значит, он уже что-то делал — с этого и начинаем.
   =========================================================================== */

var PRO_MO   = 4900;                 /* PRO помесячно, ₽ — как в PLANS ядра */
var YEAR_OFF = 0.20;                 /* год −20% */
var PRO_YEAR_MO = Math.round(PRO_MO * (1 - YEAR_OFF));   /* 3 920 ₽/мес при оплате за год */

var FEATURES = {
  video: {
    chip:'Проверка видео',
    h:'РОЛИК РАЗОБРАН. СЛЕДУЮЩИЙ — ЧЕРЕЗ МЕСЯЦ',
    sub:'На FREE проверка одна в месяц. Этого хватает попробовать, но не хватает, чтобы расти: ' +
        'исправлять монтаж имеет смысл, пока ролик свежий.',
    have:['Разбор удержания посекундно', 'Оценка первых трёх секунд', 'Что переснять, а что оставить'],
    get:['30 проверок в месяц вместо одной', 'Сравнение с прошлыми роликами', 'Разбор конкурента по ссылке',
         'Готовые правки монтажа списком'],
    num:'30 роликов',
    numS:'можно проверить за месяц на PRO. Один разбор экономит примерно два часа монтажа — это 60 часов, ' +
         'которые уйдут на съёмку, а не на догадки.'
  },
  autopost: {
    chip:'Автопостинг',
    h:'ПУБЛИКУЕШЬ РУКАМИ. МОЖНО ПО РАСПИСАНИЮ',
    sub:'FREE публикует здесь и сейчас. Отложенные посты, очередь и разгон по площадкам — на PRO.',
    have:['Публикация в ленту OKO', 'Свой канал и посты в нём', 'Комментарии и реакции'],
    get:['Очередь постов на месяц вперёд', 'Один текст — сразу во все площадки', 'Лучшее время выхода по твоей аудитории',
         'Автоповтор того, что зашло'],
    num:'12 часов',
    numS:'в месяц освобождается, когда постинг идёт по расписанию. Это примерно три полноценных съёмочных дня.'
  },
  factory: {
    chip:'Контент-завод',
    h:'ОДИН РОЛИК В ДЕНЬ БЕЗ ВЫГОРАНИЯ',
    sub:'Завод сам делает сценарии, монтаж и обложки под твою нишу. На FREE доступен просмотр, ' +
        'производство — на PRO.',
    have:['Идеи роликов по твоей нише', 'Примеры сценариев', 'Разбор чужих залетевших форматов'],
    get:['30 готовых роликов в месяц', 'Сценарий, монтаж, обложка, субтитры', 'Своя озвучка и свой голос',
         'Публикация прямо из завода'],
    num:'30 роликов',
    numS:'в месяц под ключ. У монтажёра на фрилансе это от 60 000 ₽. PRO стоит 3 920 ₽ в месяц.'
  },
  analytics: {
    chip:'Аналитика',
    h:'ЦИФРЫ ЕСТЬ. ПРИЧИН ПОКА НЕ ВИДНО',
    sub:'FREE показывает, что произошло. PRO показывает, почему — и что делать дальше.',
    have:['Просмотры и подписчики', 'Реакции на посты', 'Общая статистика канала'],
    get:['Воронка: увидел → досмотрел → подписался → купил', 'Какой ролик привёл деньги, а какой только шум',
         'Сравнение с нишей', 'Отчёт на почту каждую неделю'],
    num:'в 3 раза',
    numS:'быстрее находишь рабочий формат, когда видно связь «ролик → деньги», а не только просмотры.'
  },
  market: {
    chip:'Биржа услуг',
    h:'ТВОЁ ОБЪЯВЛЕНИЕ НА ВТОРОЙ СТРАНИЦЕ',
    sub:'Заказчики почти не листают дальше первого экрана. Приоритет в выдаче — на PRO.',
    have:['Объявление на бирже', 'Отклики и переписка', 'Отзывы после сделок'],
    get:['Первые строки выдачи в своей категории', 'Значок проверенного исполнителя',
         'Отклик на закрытые заказы раньше остальных', 'Пять объявлений вместо одного'],
    num:'в 4 раза',
    numS:'больше просмотров у объявлений с первого экрана, чем со второго. При том же тексте и той же цене.'
  }
};
var FEATURE_DEFAULT = {
  chip:'Лимит FREE',
  h:'ЗДЕСЬ ЗАКАНЧИВАЕТСЯ БЕСПЛАТНЫЙ ТАРИФ',
  sub:'FREE даёт попробовать всё по разу. PRO снимает лимиты и включает инструменты, ' +
      'на которых уже можно работать.',
  have:['Мессенджер и лента без ограничений', 'Чтение клуба и часть Академии', 'Одна проверка видео в месяц'],
  get:['Без лимитов на проверки и публикации', 'Контент-завод и автопостинг', 'Полная Академия и все курсы',
       'Приоритет в бирже услуг'],
  num:'3 920 ₽',
  numS:'в месяц при оплате за год. Меньше, чем один час работы монтажёра.'
};

function okgPaywall(feature){
  try{
    var f = FEATURES[feature] || FEATURE_DEFAULT;
    var key = 'paywall:' + (FEATURES[feature] ? feature : 'default');

    /* Человек попросил не показывать это окно или отложил на неделю — уважаем.
       Но молча глотать нажатие нельзя: он всё равно упёрся в лимит,
       поэтому коротко говорим, что случилось, и не мешаем дальше. */
    var quiet = S.off[key] || (S.snooze[key] || 0) > now();
    if(quiet){
      say('Лимит FREE исчерпан. Тарифы — в профиле');
      track('okg_paywall_quiet', { feature:feature || 'default' });
      return null;
    }

    var html =
      '<span class="okg-chip">' + ico('crown') + esc(f.chip) + '</span>' +
      '<h1 class="okg-h">' + esc(f.h) + '</h1>' +
      '<p class="okg-sub">' + esc(f.sub) + '</p>' +

      '<p class="okg-lbl">Это у тебя уже есть</p>' +
      '<ul class="okg-list have">' + f.have.map(function(t){
        return '<li>' + ico('check') + '<span>' + esc(t) + '</span></li>';
      }).join('') + '</ul>' +

      '<p class="okg-lbl">Что откроется на PRO</p>' +
      '<ul class="okg-list get">' + f.get.map(function(t){
        return '<li>' + ico('bolt') + '<span>' + esc(t) + '</span></li>';
      }).join('') + '</ul>' +

      '<div class="okg-num"><b>' + esc(f.num) + '</b><span>' + esc(f.numS) + '</span></div>' +

      '<div class="okg-price"><b>' + rub(PRO_YEAR_MO) + '</b><i>в месяц при оплате за год</i></div>' +
      '<p class="okg-price-note">Или ' + rub(PRO_MO) + ' помесячно. Год выходит на ' +
        rub(PRO_MO * 12 - PRO_YEAR_MO * 12) + ' дешевле. Отменить можно в любой момент.</p>';

    var m = okgModal({
      id:key,
      title:'PRO',
      html:html,
      muteKind:key,
      actions:[
        { label:'Открыть PRO', icon:'crown', onClick:function(){
            track('okg_paywall_buy', { feature:feature || 'default' });
            try{ if(typeof openPay === 'function') openPay('PRO'); else say('Тарифы в профиле'); }catch(e){}
          } },
        { label:'Напомнить через неделю', kind:'ghost', icon:'clock', onClick:function(){
            S.snooze[key] = now() + 7 * DAY;
            save();
            track('okg_paywall_snooze', { feature:feature || 'default' });
            say('Напомню через неделю');
          } }
      ],
      onClose:function(how){ track('okg_paywall_close', { feature:feature || 'default', how:how }); }
    });
    track('okg_paywall', { feature:feature || 'default', tier:tier() });
    return m;
  }catch(e){ log('paywall fail', e); return null; }
}

/* ===========================================================================
   8 · QR-КОДЕР
   Свой, на canvas, без библиотек. Байтовый режим, уровень коррекции L,
   версии 1–6 — это до 134 символов, реф-ссылке хватает с запасом.
   Проверено декодером: границы версий совпадают со спецификацией
   (17 / 32 / 53 / 78 / 106 / 134 символа).
   =========================================================================== */

var QR = (function(){
  var EXP = new Uint8Array(512), LOG = new Uint8Array(256);
  (function(){
    var x = 1;
    for(var i=0;i<255;i++){ EXP[i] = x; LOG[x] = i; x <<= 1; if(x & 0x100) x ^= 0x11D; }
    for(i=255;i<512;i++) EXP[i] = EXP[i-255];
  })();
  function mul(a,b){ return (!a || !b) ? 0 : EXP[LOG[a] + LOG[b]]; }

  function genPoly(deg){
    var g = [1], i, j;
    for(i=0;i<deg;i++){
      var ng = new Array(g.length + 1);
      for(j=0;j<ng.length;j++) ng[j] = 0;
      for(j=0;j<g.length;j++){ ng[j] ^= g[j]; ng[j+1] ^= mul(g[j], EXP[i]); }
      g = ng;
    }
    return g;
  }
  function remainder(data, ecLen){
    var gen = genPoly(ecLen), res = new Array(data.length + ecLen), i, j;
    for(i=0;i<res.length;i++) res[i] = i < data.length ? data[i] : 0;
    for(i=0;i<data.length;i++){
      var c = res[i];
      if(!c) continue;
      for(j=0;j<gen.length;j++) res[i+j] ^= mul(gen[j], c);
    }
    return res.slice(data.length);
  }

  /* версия -> { ec: слов коррекции на блок, nb: блоков, data: слов данных всего } */
  var V = [null,
    { ec:7,  nb:1, data:19  },
    { ec:10, nb:1, data:34  },
    { ec:15, nb:1, data:55  },
    { ec:20, nb:1, data:80  },
    { ec:26, nb:1, data:108 },
    { ec:18, nb:2, data:136 }
  ];

  function utf8(s){
    var out = [], i, c;
    for(i=0;i<s.length;i++){
      c = s.charCodeAt(i);
      if(c < 0x80) out.push(c);
      else if(c < 0x800) out.push(0xC0 | (c >> 6), 0x80 | (c & 63));
      else if(c < 0xD800 || c >= 0xE000) out.push(0xE0 | (c >> 12), 0x80 | ((c >> 6) & 63), 0x80 | (c & 63));
      else {
        i++;
        var cp = 0x10000 + (((c & 0x3FF) << 10) | (s.charCodeAt(i) & 0x3FF));
        out.push(0xF0 | (cp >> 18), 0x80 | ((cp >> 12) & 63), 0x80 | ((cp >> 6) & 63), 0x80 | (cp & 63));
      }
    }
    return out;
  }
  function fmtBits(mask){
    var d = (1 << 3) | mask, rem = d, i;      /* уровень L = 01 */
    for(i=0;i<10;i++) rem = (rem << 1) ^ ((rem >>> 9) * 0x537);
    return ((d << 10) | rem) ^ 0x5412;
  }
  function maskAt(k, x, y){
    switch(k){
      case 0: return ((x + y) % 2) === 0;
      case 1: return (y % 2) === 0;
      case 2: return (x % 3) === 0;
      case 3: return ((x + y) % 3) === 0;
      case 4: return ((((y / 2) | 0) + ((x / 3) | 0)) % 2) === 0;
      case 5: return ((x * y) % 2) + ((x * y) % 3) === 0;
      case 6: return ((((x * y) % 2) + ((x * y) % 3)) % 2) === 0;
      default: return ((((x + y) % 2) + ((x * y) % 3)) % 2) === 0;
    }
  }
  var PAT_A = [1,0,1,1,1,0,1,0,0,0,0], PAT_B = [0,0,0,0,1,0,1,1,1,0,1];
  function penalty(m, size){
    var p = 0, x, y, run, c, dark = 0, s, k, a, b, v;
    for(y=0;y<size;y++){
      run = 1;
      for(x=1;x<size;x++){
        if(m[y][x] === m[y][x-1]){ run++; if(run === 5) p += 3; else if(run > 5) p++; } else run = 1;
      }
    }
    for(x=0;x<size;x++){
      run = 1;
      for(y=1;y<size;y++){
        if(m[y][x] === m[y-1][x]){ run++; if(run === 5) p += 3; else if(run > 5) p++; } else run = 1;
      }
    }
    for(y=0;y<size-1;y++) for(x=0;x<size-1;x++){
      c = m[y][x];
      if(c === m[y][x+1] && c === m[y+1][x] && c === m[y+1][x+1]) p += 3;
    }
    for(y=0;y<size;y++) for(s=0;s+11<=size;s++){
      a = true; b = true;
      for(k=0;k<11;k++){ v = m[y][s+k]; if(v !== PAT_A[k]) a = false; if(v !== PAT_B[k]) b = false; }
      if(a || b) p += 40;
    }
    for(x=0;x<size;x++) for(s=0;s+11<=size;s++){
      a = true; b = true;
      for(k=0;k<11;k++){ v = m[s+k][x]; if(v !== PAT_A[k]) a = false; if(v !== PAT_B[k]) b = false; }
      if(a || b) p += 40;
    }
    for(y=0;y<size;y++) for(x=0;x<size;x++) if(m[y][x]) dark++;
    p += Math.floor(Math.abs(dark * 100 / (size * size) - 50) / 5) * 10;
    return p;
  }

  function matrix(text){
    var bytes = utf8(text), ver = 0, v, i, j, k;
    for(v=1; v<=6; v++){ if(bytes.length <= V[v].data - 2){ ver = v; break; } }
    if(!ver) return null;                      /* длиннее 134 байт — не наш случай */
    var spec = V[ver], size = ver * 4 + 17;

    var bits = [];
    function put(val, len){ for(var b = len - 1; b >= 0; b--) bits.push((val >>> b) & 1); }
    put(4, 4); put(bytes.length, 8);
    for(i=0;i<bytes.length;i++) put(bytes[i], 8);
    var cap = spec.data * 8;
    for(i=0;i<4 && bits.length < cap;i++) bits.push(0);
    while(bits.length % 8) bits.push(0);
    var pad = [0xEC, 0x11], pi = 0;
    while(bits.length < cap) put(pad[pi++ % 2], 8);

    var words = [];
    for(i=0;i<bits.length;i+=8){
      var w = 0;
      for(k=0;k<8;k++) w = (w << 1) | bits[i + k];
      words.push(w);
    }

    var per = spec.data / spec.nb, dB = [], eB = [];
    for(i=0;i<spec.nb;i++){
      var d = words.slice(i * per, (i + 1) * per);
      dB.push(d); eB.push(remainder(d, spec.ec));
    }
    var flow = [];
    for(i=0;i<per;i++)      for(j=0;j<spec.nb;j++) flow.push(dB[j][i]);
    for(i=0;i<spec.ec;i++)  for(j=0;j<spec.nb;j++) flow.push(eB[j][i]);

    var m = [], fn = [];
    for(i=0;i<size;i++){
      var r1 = new Array(size), r2 = new Array(size);
      for(j=0;j<size;j++){ r1[j] = 0; r2[j] = 0; }
      m.push(r1); fn.push(r2);
    }
    function setF(x, y, val){
      if(x < 0 || y < 0 || x >= size || y >= size) return;
      m[y][x] = val ? 1 : 0; fn[y][x] = 1;
    }

    /* поисковые квадраты по трём углам + белая рамка вокруг них */
    [[3,3],[size-4,3],[3,size-4]].forEach(function(c){
      for(var dy=-4;dy<=4;dy++) for(var dx=-4;dx<=4;dx++){
        var dist = Math.max(Math.abs(dx), Math.abs(dy));
        setF(c[0] + dx, c[1] + dy, dist !== 2 && dist !== 4);
      }
    });
    /* синхродорожки */
    for(i=8;i<size-8;i++){ setF(i, 6, (i % 2) === 0); setF(6, i, (i % 2) === 0); }
    /* выравнивающий квадрат (у версий 2–6 он один) */
    if(ver >= 2){
      var ac = size - 7;
      for(var ay=-2;ay<=2;ay++) for(var ax=-2;ax<=2;ax++){
        setF(ac + ax, ac + ay, Math.max(Math.abs(ax), Math.abs(ay)) !== 1);
      }
    }
    setF(8, size - 8, 1);                       /* обязательный тёмный модуль */

    function drawFmt(mask){
      var b = fmtBits(mask), n;
      function g(i2){ return (b >>> i2) & 1; }
      for(n=0;n<=5;n++) setF(8, n, g(n));
      setF(8, 7, g(6)); setF(8, 8, g(7)); setF(7, 8, g(8));
      for(n=9;n<15;n++) setF(14 - n, 8, g(n));
      for(n=0;n<8;n++) setF(size - 1 - n, 8, g(n));
      for(n=8;n<15;n++) setF(8, size - 15 + n, g(n));
      setF(8, size - 8, 1);
    }
    drawFmt(0);                                  /* сначала резервируем места формата */

    var bi = 0, total = flow.length * 8;
    for(var right = size - 1; right >= 1; right -= 2){
      if(right === 6) right = 5;
      for(var vert = 0; vert < size; vert++){
        for(j=0;j<2;j++){
          var x = right - j;
          var up = (((right + 1) & 2) === 0);
          var y = up ? (size - 1 - vert) : vert;
          if(fn[y][x]) continue;
          m[y][x] = bi < total ? ((flow[bi >>> 3] >>> (7 - (bi & 7))) & 1) : 0;
          bi++;
        }
      }
    }

    var base = m.map(function(r){ return r.slice(); });
    var best = null, bestP = Infinity;
    for(k=0;k<8;k++){
      m = base.map(function(r){ return r.slice(); });
      for(var yy=0;yy<size;yy++) for(var xx=0;xx<size;xx++)
        if(!fn[yy][xx] && maskAt(k, xx, yy)) m[yy][xx] ^= 1;
      drawFmt(k);
      var p = penalty(m, size);
      if(p < bestP){ bestP = p; best = m; }
    }
    return { size:size, mods:best, version:ver };
  }

  /* Рисуем на canvas. Тихая зона 4 модуля обязательна — без неё камера не читает. */
  function draw(canvas, text, px){
    var q = QR.matrix(text);
    if(!q) return false;
    var quiet = 4, total = q.size + quiet * 2;
    var scale = Math.max(2, Math.floor((px || 168) / total));
    var side = total * scale;
    canvas.width = side; canvas.height = side;
    var ctx = canvas.getContext('2d');
    if(!ctx) return false;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, side, side);
    ctx.fillStyle = '#000000';
    for(var y=0;y<q.size;y++) for(var x=0;x<q.size;x++){
      if(q.mods[y][x]) ctx.fillRect((x + quiet) * scale, (y + quiet) * scale, scale, scale);
    }
    return true;
  }

  return { matrix:matrix, draw:draw };
})();

/* ===========================================================================
   9 · ПАРТНЁРСКИЙ ДВИГАТЕЛЬ
   Партнёрка заменяет платную рекламу, поэтому здесь всё сделано так, чтобы
   человек мог поделиться за один тап и сразу увидел, сколько это стоит в деньгах.
   =========================================================================== */

/* Материалы. Пишем как живой человек: коротко, без «уникальная возможность». */
function materials(link){
  return [
    { id:'story', who:'Сторис', t:'Для блогеров — короткая сторис',
      text:'Перевела монтаж, аналитику и продажи в одно приложение.\n\n' +
           'OKO разбирает ролик по секундам и говорит, где люди уходят. Плюс канал, клуб и приём оплат — ' +
           'всё в одном месте, без десяти вкладок.\n\n' +
           'Кто хочет попробовать — вот ссылка: ' + link },

    { id:'post', who:'Пост', t:'Для экспертов — пост в канал',
      text:'Год я собирал аудиторию в одном месте, продавал в другом, а считал в третьем. ' +
           'Теперь всё держу в OKO.\n\n' +
           'Что там: канал и закрытый клуб с оплатой внутри, разбор роликов на удержание, ' +
           'биржа услуг, кошелёк. Free-тариф даёт попробовать, дальше — по желанию.\n\n' +
           'Если тоже устали от зоопарка сервисов: ' + link },

    { id:'dm', who:'Личка', t:'В личку — без давления',
      text:'Привет! Помню, ты жаловался, что ролики не заходят и непонятно почему.\n\n' +
           'Я сейчас сижу в OKO — там проверка видео показывает посекундно, на какой фразе люди уходят. ' +
           'Мне это закрыло вопрос за один вечер.\n\n' +
           'Держи, посмотри: ' + link },

    { id:'agency', who:'Агентства', t:'Для агентств и продюсеров',
      text:'Ведём клиентов на OKO вместо связки из пяти сервисов.\n\n' +
           'Один аккаунт: контент-завод на потоке, аналитика по каждому ролику, биржа исполнителей, ' +
           'оплаты и выплаты внутри. Клиенту видно, что происходит, нам — не надо сводить отчёты руками.\n\n' +
           'Регистрация: ' + link },

    { id:'short', who:'Визитка', t:'Одна строка — в шапку профиля',
      text:'Веду всё в OKO: канал, клуб, аналитика и оплаты в одном приложении. Заходи: ' + link }
  ];
}

/* Расчётчик. Считаем честно и показываем, из чего складывается. */
function partnerMath(n){
  var avg  = PRO_MO;             /* средний чек PRO, ₽/мес */
  var l1hi = n * avg * 0.15;     /* первые 6 месяцев — 15% */
  var l1lo = n * avg * 0.05;     /* с 7-го месяца — 5% */
  /* второй уровень: примерно каждый пятый приведённый сам становится партнёром
     и приводит двоих. С их оплат капает 5%. */
  var n2   = n * 0.2 * 2;
  var l2   = n2 * avg * 0.05;
  return {
    n:n, n2:Math.round(n2),
    first: l1hi + l2,
    after: l1lo + l2,
    year: (l1hi + l2) * 6 + (l1lo + l2) * 6
  };
}

function okgPartnerWidget(host){
  try{
    injectCSS();
    if(!host) return null;
    if(typeof host === 'string') host = document.querySelector(host);
    if(!host) return null;

    var link = refLink();
    var mats = materials(link);

    host.classList.add('okg-part');
    host.innerHTML =
      /* --- ссылка + QR --- */
      '<div class="okg-block">' +
        '<h4>' + ico('link') + 'Твоя ссылка</h4>' +
        '<p>15% с оплат каждого, кого приведёшь — первые полгода. Дальше 5%, и ещё 5% ' +
        'с оплат тех, кого приведут твои партнёры.</p>' +
        '<div class="okg-link">' + ico('link') + '<span id="okgLink">' + esc(link) + '</span></div>' +
        '<div class="okg-link-btns">' +
          '<button class="okg-btn pri" type="button" data-okg="copy">' + ico('copy') + '<span>Копировать</span></button>' +
          '<button class="okg-btn gho" type="button" data-okg="share">' + ico('share') + '<span>Поделиться</span></button>' +
        '</div>' +
        '<div class="okg-qr" id="okgQr"></div>' +
      '</div>' +

      /* --- расчётчик --- */
      '<div class="okg-block">' +
        '<h4>' + ico('chart') + 'Сколько это в деньгах</h4>' +
        '<p>Двигай ползунок: сколько человек ты приведёшь на PRO.</p>' +
        '<div class="okg-calc-v"><b id="okgCalcN">10</b><i id="okgCalcNL">человек на PRO</i></div>' +
        '<input class="okg-range" id="okgRange" type="range" min="1" max="100" step="1" value="10" ' +
               'aria-label="Сколько людей приведу">' +
        '<div class="okg-rows">' +
          '<div class="okg-row hi"><span>Первые 6 месяцев</span><b id="okgSum1">—</b></div>' +
          '<div class="okg-row"><span>С 7-го месяца</span><b id="okgSum2">—</b></div>' +
          '<div class="okg-row"><span>За первый год</span><b id="okgSum3">—</b></div>' +
        '</div>' +
        '<p class="okg-note" id="okgCalcNote"></p>' +
      '</div>' +

      /* --- материалы --- */
      '<div class="okg-block">' +
        '<h4>' + ico('edit') + 'Готовые тексты</h4>' +
        '<p>Ссылка уже внутри. Открой, забери в один тап, отправь.</p>' +
        '<div class="okg-mats">' + mats.map(function(m){
          return '<div class="okg-mat" data-mat="' + m.id + '">' +
            '<button class="okg-mat-h" type="button" data-okg="toggle">' +
              '<em>' + esc(m.who) + '</em><b>' + esc(m.t) + '</b>' + ico('chev','okg-chevi') +
            '</button>' +
            '<div class="okg-mat-b">' +
              '<pre>' + esc(m.text) + '</pre>' +
              '<button class="okg-btn pri" type="button" data-okg="copymat">' + ico('copy') + '<span>Скопировать текст</span></button>' +
            '</div>' +
          '</div>';
        }).join('') + '</div>' +
      '</div>';

    /* QR: если ссылка вдруг длиннее того, что берёт наш кодер — не молчим,
       а показываем ссылку крупно и кнопку «Поделиться». */
    var qrHost = host.querySelector('#okgQr');
    var ok = false;
    try{
      var cv = document.createElement('canvas');
      ok = QR.draw(cv, link, 168);
      if(ok){
        var box = document.createElement('div');
        box.className = 'okg-qr-box';
        box.appendChild(cv);
        qrHost.appendChild(box);
        var cap = document.createElement('small');
        cap.textContent = 'Наведи камеру — откроется регистрация по твоей ссылке';
        qrHost.appendChild(cap);
      }
    }catch(e){ ok = false; }
    if(!ok){
      qrHost.innerHTML = '<div class="okg-qr-big">' + esc(link) + '</div>' +
        '<small>Продиктуй или отправь ссылку — работает так же, как код</small>';
    }

    function markRef(){
      if(!S.refCopied){ S.refCopied = true; save(); }
      markStep('reflink');
    }

    host.querySelector('[data-okg="copy"]').addEventListener('click', function(){
      tap('impact');
      copyText(link).then(function(good){
        say(good ? 'Ссылка скопирована' : 'Не вышло скопировать, выдели вручную');
        if(good){ markRef(); track('okg_ref_copy', { where:'widget' }); }
      });
    });
    host.querySelector('[data-okg="share"]').addEventListener('click', function(){
      tap('impact');
      var payload = { title:'OKO', text:'Приложение, где я веду канал, клуб и аналитику', url:link };
      try{
        if(navigator.share){
          navigator.share(payload).then(function(){ markRef(); track('okg_ref_share', {}); }, function(){});
          return;
        }
      }catch(e){}
      copyText(link).then(function(good){
        say(good ? 'Ссылка скопирована — отправляй' : link);
        if(good) markRef();
      });
    });

    host.querySelectorAll('.okg-mat').forEach(function(card){
      var id = card.getAttribute('data-mat');
      var mat = mats.filter(function(m){ return m.id === id; })[0];
      card.querySelector('[data-okg="toggle"]').addEventListener('click', function(){
        tap('selection');
        card.classList.toggle('open');
      });
      card.querySelector('[data-okg="copymat"]').addEventListener('click', function(){
        tap('impact');
        copyText(mat.text).then(function(good){
          say(good ? 'Текст скопирован' : 'Не вышло скопировать');
          if(good){ markRef(); track('okg_material_copy', { id:id }); }
        });
      });
    });

    var range = host.querySelector('#okgRange');
    function recalc(){
      var n = parseInt(range.value, 10) || 1;
      var r = partnerMath(n);
      host.querySelector('#okgCalcN').textContent = n;
      host.querySelector('#okgCalcNL').textContent = plural(n,'человек','человека','человек') + ' на PRO';
      host.querySelector('#okgSum1').textContent = rub(r.first) + ' / мес';
      host.querySelector('#okgSum2').textContent = rub(r.after) + ' / мес';
      host.querySelector('#okgSum3').textContent = rub(r.year);
      host.querySelector('#okgCalcNote').textContent =
        'Считаем по PRO за ' + rub(PRO_MO) + ' в месяц. Первые полгода — 15% (' +
        rub(PRO_MO * 0.15) + ' с человека), потом 5%. Второй уровень: примерно каждый пятый ' +
        'из твоих сам приводит двоих — это ещё ' + r.n2 + ' ' +
        plural(r.n2,'оплата','оплаты','оплат') + ' по 5%.';
    }
    range.addEventListener('input', recalc);
    range.addEventListener('change', function(){ track('okg_calc', { n:range.value }); });
    recalc();

    return host;
  }catch(e){ log('partner fail', e); return null; }
}

/* ===========================================================================
   10 · ВИТРИНА РОСТА «КАК ТЕБЯ НАЙДУТ»
   =========================================================================== */

var TIPS = [
  { id:'niche', ic:'target', t:'Указать нишу в профиле',
    s:'Одна строка: кому и в чём помогаешь. По ней тебя подбирает поиск и биржа.',
    gain:'В 5 раз чаще в выдаче',
    done:function(){ return String(prof().bio || '').trim().length >= 8; },
    go:function(){
      try{ if(typeof showTab === 'function') showTab('profile'); }catch(e){}
      setTimeout(function(){ try{ if(typeof openEdit === 'function') openEdit(); }catch(e){} }, 240);
    } },

  { id:'search', ic:'search', t:'Включить видимость в поиске',
    s:'Пока профиль скрыт, тебя не найдут ни заказчики, ни подписчики.',
    gain:'+40 показов в неделю',
    done:function(){ return !!S.steps.search; },
    go:function(){
      try{ if(typeof openSettings === 'function'){ openSettings('privacy'); return; } }catch(e){}
      try{ if(typeof showTab === 'function') showTab('profile'); }catch(e){}
    } },

  { id:'clip', ic:'clips', t:'Опубликовать первый клип',
    s:'Вертикальное видео разгоняется лентой быстрее всего остального.',
    gain:'Первые 500 просмотров',
    done:function(){ return !!S.steps.clip; },
    go:function(){
      try{ if(typeof showTab === 'function') showTab('feed'); }catch(e){}
      setTimeout(function(){ try{ if(window.okoOpenClips) window.okoOpenClips(); }catch(e){} }, 260);
    } },

  { id:'channel', ic:'megaphone', t:'Завести свой канал',
    s:'Подписчик канала возвращается сам. Лента приводит один раз, канал — каждый день.',
    gain:'Своя аудитория без алгоритмов',
    done:function(){ return !!S.steps.mychannel; },
    go:function(){ try{ if(typeof chOpen === 'function') chOpen('create'); else if(typeof showTab === 'function') showTab('chats'); }catch(e){} } },

  { id:'market', ic:'briefcase', t:'Выставить услугу на бирже',
    s:'Даже одно объявление приносит отклики: заказчики ищут по категориям каждый день.',
    gain:'Первый заказ за 2 недели',
    done:function(){ return !!S.steps.market; },
    go:function(){
      try{ if(typeof showTab === 'function') showTab('mini'); }catch(e){}
      setTimeout(function(){ try{ if(typeof openMa === 'function') openMa('market'); }catch(e){} }, 240);
    } }
];

function okgShowcase(host){
  try{
    injectCSS();
    if(typeof host === 'string') host = document.querySelector(host);
    if(!host) return null;

    var done = 0;
    TIPS.forEach(function(t){ try{ if(t.done()) done++; }catch(e){} });

    host.classList.add('okg-show');
    host.innerHTML =
      '<div class="okg-show-h"><h3>КАК ТЕБЯ НАЙДУТ</h3>' +
      '<span>' + done + ' из ' + TIPS.length + '</span></div>' +
      TIPS.map(function(t){
        var d = false;
        try{ d = !!t.done(); }catch(e){}
        return '<button class="okg-tip' + (d ? ' done' : '') + '" type="button" data-tip="' + t.id + '">' +
          '<span class="okg-tip-ic">' + ico(d ? 'check' : t.ic) + '</span>' +
          '<span class="okg-tip-b"><b>' + esc(t.t) + '</b><small>' + esc(t.s) + '</small>' +
            '<span class="okg-gain">' + ico('arrow-up') + esc(t.gain) + '</span></span>' +
        '</button>';
      }).join('');

    host.querySelectorAll('[data-tip]').forEach(function(b){
      b.addEventListener('click', function(){
        var id = b.getAttribute('data-tip');
        var t = TIPS.filter(function(x){ return x.id === id; })[0];
        if(!t) return;
        tap('impact');
        track('okg_tip_go', { tip:id });
        try{ t.go(); }catch(e){}
      });
    });
    return host;
  }catch(e){ log('showcase fail', e); return null; }
}

function goShowcase(){
  try{
    if(typeof showTab === 'function') showTab('profile');
    setTimeout(function(){
      var h = document.getElementById('okgShowcaseHost');
      if(h && h.scrollIntoView) h.scrollIntoView({ behavior:'smooth', block:'center' });
    }, 320);
  }catch(e){}
}

/* ===========================================================================
   11 · ПОВОДЫ И ТИХИЙ ПЛАНИРОВЩИК
   Правила жёсткие: одно окно за сессию, один повод — не чаще раза в 2 дня,
   «больше не показывать» выключает повод навсегда.
   =========================================================================== */

var NUDGES = {

  onboarding: {
    pri: 90,
    when: function(){ return !S.ob.closed && !allDone() && doneCount() > 0 && daysActive() >= 2; },
    show: function(){
      var left = STEPS.filter(function(s){ return !stepDone(s.id); });
      var next = left[0];
      return okgModal({
        id:'nudge-onboarding',
        title:'Старт в OKO',
        muteKind:'onboarding',
        html:'<span class="okg-chip">' + ico('rocket') + 'Старт в OKO</span>' +
             '<h1 class="okg-h">ОСТАЛОСЬ ' + left.length + ' ' + plural(left.length,'ШАГ','ШАГА','ШАГОВ').toUpperCase() + '</h1>' +
             '<p class="okg-sub">Ты прошёл ' + doneCount() + ' из ' + STEPS.length +
               '. Следующий — «' + esc(next.t) + '». ' + esc(next.s) + '.</p>' +
             '<div class="okg-bar" style="margin-top:16px;border-radius:3px"><i style="width:' +
               Math.round(doneCount() / STEPS.length * 100) + '%"></i></div>',
        actions:[
          { label:next.t, icon:'chev', onClick:function(){ try{ next.go(); }catch(e){} } },
          { label:'Позже', kind:'ghost' }
        ]
      });
    }
  },

  anketa: {
    pri: 80,
    when: function(){ return anketaStarted() >= 2 && !anketaSaved(); },
    show: function(){
      var n = anketaStarted();
      return okgModal({
        id:'nudge-anketa',
        title:'Система роста',
        muteKind:'anketa',
        html:'<span class="okg-chip">' + ico('rocket') + 'Система роста</span>' +
             '<h1 class="okg-h">АНКЕТА ОСТАЛАСЬ НЕДОПИСАННОЙ</h1>' +
             '<p class="okg-sub">Ты ответил на ' + n + ' ' + plural(n,'вопрос','вопроса','вопросов') +
               ' и вышел. Осталось немного — на выходе получишь стратегию под свою нишу: ' +
               'что снимать, как часто и что продавать.</p>' +
             '<div class="okg-num"><b>10 минут</b><span>столько занимает быстрая анкета. ' +
               'Ответы сохранятся, второй раз заполнять не придётся.</span></div>',
        actions:[
          { label:'Дописать анкету', icon:'edit', onClick:function(){
              try{
                if(typeof showTab === 'function') showTab('mini');
                setTimeout(function(){ try{ if(typeof openMa === 'function') openMa('system'); }catch(e){} }, 240);
              }catch(e){}
            } },
          { label:'Не сейчас', kind:'ghost' }
        ]
      });
    }
  },

  videofree: {
    pri: 70,
    when: function(){ return isFree() && videoChecks() === 0 && daysActive() >= 2; },
    show: function(){
      return okgModal({
        id:'nudge-videofree',
        title:'Проверка видео',
        muteKind:'videofree',
        html:'<span class="okg-chip">' + ico('camera') + 'Бесплатно' + '</span>' +
             '<h1 class="okg-h">У ТЕБЯ ЛЕЖИТ НЕИСПОЛЬЗОВАННАЯ ПРОВЕРКА</h1>' +
             '<p class="okg-sub">На FREE даётся одна проверка видео в месяц. Она не переносится: ' +
               'не потратил — сгорела. Загрузи любой свой ролик, разбор придёт за пару минут.</p>' +
             '<ul class="okg-list get">' +
               '<li>' + ico('bolt') + '<span>Где зритель уходит — посекундно</span></li>' +
               '<li>' + ico('bolt') + '<span>Работают ли первые три секунды</span></li>' +
               '<li>' + ico('bolt') + '<span>Что переснять, а что оставить</span></li>' +
             '</ul>',
        actions:[
          { label:'Проверить ролик', icon:'camera', onClick:function(){
              try{
                if(typeof showTab === 'function') showTab('mini');
                setTimeout(function(){ try{ if(typeof openMa === 'function') openMa('video'); }catch(e){} }, 240);
              }catch(e){}
            } },
          { label:'Потом', kind:'ghost' }
        ]
      });
    }
  },

  partner: {
    pri: 85,
    when: function(){ return !S.refCopied && (S.paid || daysActive() >= 3); },
    show: function(){
      var r = partnerMath(10);
      var why = S.paid
        ? 'Ты уже на платном тарифе — значит, знаешь, за что здесь платят. Расскажи своим: '
        : 'Ты в OKO третий день и уже освоился. Дальше приложение может само себя окупать: ';
      return okgModal({
        id:'nudge-partner',
        title:'Партнёрка',
        muteKind:'partner',
        html:'<span class="okg-chip">' + ico('users') + 'Партнёрка' + '</span>' +
             '<h1 class="okg-h">ТВОЯ ССЫЛКА ЛЕЖИТ БЕЗ ДЕЛА</h1>' +
             '<p class="okg-sub">' + esc(why) + '15% с их оплат первые полгода, дальше 5%. ' +
               'И ещё 5% с тех, кого приведут они.</p>' +
             '<div class="okg-num"><b>' + rub(r.first) + '</b><span>в месяц, если приведёшь десятерых на PRO. ' +
               'Считаем по ' + rub(PRO_MO) + ' за тариф.</span></div>' +
             '<div class="okg-link">' + ico('link') + '<span>' + esc(refLink()) + '</span></div>',
        actions:[
          { label:'Скопировать ссылку', icon:'copy', onClick:function(){
              copyText(refLink()).then(function(good){
                if(good){ S.refCopied = true; markStep('reflink'); save(); say('Ссылка скопирована'); }
                else say('Ссылка в разделе «Партнёрка»');
              });
              track('okg_ref_copy', { where:'nudge' });
            } },
          { label:'Открыть партнёрку', kind:'ghost', icon:'users', onClick:function(){
              try{ if(typeof showTab === 'function') showTab('partner'); }catch(e){}
            } }
        ]
      });
    }
  },

  lesson: {
    pri: 50,
    when: function(){ return lessonsDone() > 0 && lessonsDone() < 40 && daysActive() >= 2; },
    show: function(){
      var d = lessonsDone();
      return okgModal({
        id:'nudge-lesson',
        title:'Академия',
        muteKind:'lesson',
        html:'<span class="okg-chip">' + ico('star') + 'Академия' + '</span>' +
             '<h1 class="okg-h">СЛЕДУЮЩИЙ УРОК УЖЕ ОТКРЫТ</h1>' +
             '<p class="okg-sub">За тобой ' + d + ' ' + plural(d,'пройденный урок','пройденных урока','пройденных уроков') +
               '. Дальше — практика: разбираем, как собрать ролик, который досматривают.</p>' +
             '<div class="okg-num"><b>15 минут</b><span>один урок. Люди, которые доходят до пятого, ' +
               'публикуют в среднем втрое чаще остальных.</span></div>',
        actions:[
          { label:'Открыть Академию', icon:'star', onClick:function(){
              try{ if(typeof showTab === 'function') showTab('academy'); }catch(e){}
            } },
          { label:'Позже', kind:'ghost' }
        ]
      });
    }
  },

  expiring: {
    pri: 100,
    when: function(){ return tierEndsIn() !== null; },
    show: function(){
      var days = tierEndsIn() || 1;
      return okgModal({
        id:'nudge-expiring',
        title:'Тариф',
        muteKind:'expiring',
        html:'<span class="okg-chip">' + ico('clock') + 'Тариф ' + esc(tier()) + '</span>' +
             '<h1 class="okg-h">' + days + ' ' + plural(days,'ДЕНЬ','ДНЯ','ДНЕЙ').toUpperCase() + ' ДО КОНЦА ТАРИФА</h1>' +
             '<p class="okg-sub">Когда тариф закончится, лимиты вернутся к FREE: одна проверка видео в месяц, ' +
               'завод и автопостинг закроются, объявления на бирже уйдут вниз выдачи.</p>' +
             '<div class="okg-price"><b>' + rub(PRO_YEAR_MO) + '</b><i>в месяц при оплате за год</i></div>' +
             '<p class="okg-price-note">Или ' + rub(PRO_MO) + ' помесячно.</p>',
        actions:[
          { label:'Продлить', icon:'crown', onClick:function(){
              try{ if(typeof openPay === 'function') openPay(tier() === 'FREE' ? 'PRO' : tier()); }catch(e){}
            } },
          { label:'Напомнить позже', kind:'ghost' }
        ]
      });
    }
  }
};

var okgQueue = (function(){
  var pending = [];
  var timer = null;

  function eligible(kind){
    var n = NUDGES[kind];
    if(!n) return false;
    if(S.off[kind]) return false;
    var last = S.nudge[kind] || 0;
    if(now() - last < COOLDOWN) return false;
    try{ return !!n.when(); }catch(e){ return false; }
  }

  function push(kind){
    if(!NUDGES[kind]) return false;
    if(pending.indexOf(kind) === -1) pending.push(kind);
    schedule();
    return true;
  }

  function schedule(){
    if(timer) return;
    timer = setInterval(function(){
      if(sessionPopupShown){ stop(); return; }
      drain();
    }, 8000);
  }
  function stop(){ if(timer){ clearInterval(timer); timer = null; } }

  function drain(){
    try{
      if(sessionPopupShown) return false;
      if(busy()) return false;

      var ready = pending.filter(eligible);
      if(!ready.length) return false;

      ready.sort(function(a, b){ return (NUDGES[b].pri || 0) - (NUDGES[a].pri || 0); });
      var kind = ready[0];

      sessionPopupShown = true;
      S.nudge[kind] = now();
      save();
      pending = pending.filter(function(k){ return k !== kind; });
      track('okg_nudge', { kind:kind });
      NUDGES[kind].show();
      stop();
      return true;
    }catch(e){ log('drain fail', e); return false; }
  }

  return {
    push: push,
    drain: drain,
    stop: stop,
    state: function(){ return { pending:pending.slice(), shown:sessionPopupShown }; }
  };
})();

function okgNudge(kind){
  try{ return okgQueue.push(kind); }catch(e){ return false; }
}

/* ===========================================================================
   12 · МОСТЫ К ЯДРУ
   Оборачиваем ровно то, что нужно, и ничего не ломаем: вызвали исходную
   функцию, потом дописали своё.
   =========================================================================== */

function bridges(){
  /* профиль сохранён -> шаг закрыт */
  try{
    if(typeof window.saveProfile === 'function'){
      var coreSave = window.saveProfile;
      window.saveProfile = function(){
        var r = coreSave.apply(this, arguments);
        try{ if(String(prof().bio || '').trim().length >= 8) markStep('profile'); }catch(e){}
        return r;
      };
    }
  }catch(e){}

  /* реф-ссылка скопирована из штатной кнопки ядра */
  try{
    if(typeof window.copyRef === 'function'){
      var coreCopy = window.copyRef;
      window.copyRef = function(){
        var r = coreCopy.apply(this, arguments);
        try{ S.refCopied = true; save(); markStep('reflink'); track('okg_ref_copy', { where:'core' }); }catch(e){}
        return r;
      };
    }
  }catch(e){}

  /* подписка на канал OKO */
  try{
    if(typeof window.chSubscribe === 'function'){
      var coreSub = window.chSubscribe;
      window.chSubscribe = function(id){
        var r = coreSub.apply(this, arguments);
        try{ if(id === OKO_CH && subbedOko()) markStep('channel'); }catch(e){}
        return r;
      };
    }
  }catch(e){}

  /* переключение вкладок: перерисовать чек-лист и подмонтировать блоки */
  try{
    if(typeof window.showTab === 'function'){
      var coreTab = window.showTab;
      window.showTab = function(t){
        /* Развёрнутый чек-лист занимает пол-экрана. На своём экране это нормально,
           но как только человек уходит на другую вкладку — он мешает читать.
           Поэтому при переходе сворачиваем его в пилюлю: никуда не делся,
           но и не закрывает содержимое. */
        try{
          if(!S.ob.closed && !S.ob.collapsed && obEl){ S.ob.collapsed = true; save(); }
        }catch(e){}
        var r = coreTab.apply(this, arguments);
        setTimeout(function(){
          try{ mountAll(); renderOnboard(); }catch(e){}
        }, 60);
        return r;
      };
    }
  }catch(e){}
}

/* Оплата: ловим переход FREE -> платный тариф, чтобы предложить партнёрку. */
function watchTier(){
  try{
    var t = tier();
    if(t !== S.lastTier){
      var wasFree = S.lastTier === 'FREE';
      S.lastTier = t;
      if(wasFree && t !== 'FREE'){
        S.paid = true;
        track('okg_first_payment', { tier:t });
        okgNudge('partner');
      }
      save();
    }
  }catch(e){}
}

/* ===========================================================================
   13 · МОНТАЖ БЛОКОВ В ЭКРАНЫ ЯДРА
   =========================================================================== */

function mountAll(){
  /* партнёрский двигатель — в начало «Партнёрского кабинета» */
  try{
    var pScreen = document.querySelector('#screen-partner .pad');
    if(pScreen && !document.getElementById('okgPartnerHost')){
      var ph = document.createElement('div');
      ph.id = 'okgPartnerHost';
      ph.style.margin = '0 0 16px';
      /* В партнёрском кабинете виджет уместен сверху — это и есть суть экрана.
         Но если кабинет собирает модуль pp (partner-plus), встаём после его шапки. */
      var anchor = pScreen.querySelector('.pp-head') || pScreen.querySelector('.section-h');
      if(anchor && anchor.nextSibling) pScreen.insertBefore(ph, anchor.nextSibling);
      else pScreen.insertBefore(ph, pScreen.firstChild);
      okgPartnerWidget(ph);

      /* В кабинете уже была карточка «Твоя реф-ссылка». Теперь она внутри виджета,
         поэтому старую прячем — две одинаковые ссылки подряд выглядят как баг.
         Не удаляем: если слой роста отключат, карточка вернётся сама. */
      var oldRef = document.getElementById('refInput');
      var oldCard = oldRef && oldRef.closest ? oldRef.closest('.card') : null;
      if(oldCard && !oldCard.hasAttribute('data-okg-hidden')){
        oldCard.setAttribute('data-okg-hidden','1');
        oldCard.style.display = 'none';
      }
    }
  }catch(e){}

  /* витрина роста — в «Профиль», сразу под шапкой профиля */
  try{
    var prScreen = document.querySelector('#screen-profile .pad');
    if(prScreen && !document.getElementById('okgShowcaseHost')){
      var sh = document.createElement('div');
      sh.id = 'okgShowcaseHost';
      sh.style.margin = '4px 0 20px';
      /* Профиль собирает модуль pp2 — он кладёт всё в .pp2-wrap. Витрину
         ставим ПОСЛЕ него, иначе она вытесняет аватар, имя и настройки
         в самый низ, и человек видит на входе не свой профиль, а советы. */
      var anchor = prScreen.querySelector('.pp2-wrap') || prScreen.querySelector('.prof-ach')
                || prScreen.querySelector('.profile-top');
      if(anchor && anchor.nextSibling) prScreen.insertBefore(sh, anchor.nextSibling);
      else if(anchor) prScreen.appendChild(sh);
      else prScreen.appendChild(sh);
      okgShowcase(sh);
    } else if(document.getElementById('okgShowcaseHost')){
      okgShowcase(document.getElementById('okgShowcaseHost'));
    }
  }catch(e){}
}

/* ===========================================================================
   14 · СБРОС
   =========================================================================== */

function okgReset(){
  try{
    localStorage.removeItem(LS_KEY);
    for(var k in S) delete S[k];
    S.born = now(); S.days = []; S.steps = {}; S.ob = { collapsed:false, closed:false };
    S.nudge = {}; S.off = {}; S.snooze = {};
    S.refCopied = false; S.paid = false; S.lastTier = tier(); S.partnerOn = false;
    save();
    sessionPopupShown = false;
    killOnboard();
    renderOnboard(true);
    say('Система роста сброшена');
    return true;
  }catch(e){ return false; }
}

/* ===========================================================================
   15 · СТАРТ
   =========================================================================== */

function boot(){
  try{
    injectCSS();

    /* отметить день активности */
    var dk = dayKey();
    if(S.days.indexOf(dk) === -1){ S.days.push(dk); if(S.days.length > 60) S.days = S.days.slice(-60); save(); }
    if(!S.lastTier) S.lastTier = tier();

    bridges();
    mountAll();
    renderOnboard();

    /* чек-лист выходит на экран, когда человек уже осмотрелся */
    setTimeout(function(){ try{ renderOnboard(); }catch(e){} }, CARD_DELAY + 200);

    /* поводы ставим в очередь сразу, планировщик покажет один и только когда можно */
    ['expiring','onboarding','partner','anketa','videofree','lesson'].forEach(okgNudge);

    /* первая попытка — ровно после окна тишины */
    setTimeout(function(){ try{ okgQueue.drain(); }catch(e){} }, SILENCE + 500);

    /* лёгкий сторож: перерисовать чек-лист, когда человек занят/освободился,
       и поймать смену тарифа. 4 секунды — незаметно для батареи. */
    setInterval(function(){
      try{
        watchTier();
        if(obEl || pillEl) renderOnboard();
        else if(!S.ob.closed && !allDone()) renderOnboard();
      }catch(e){}
    }, 4000);

    document.addEventListener('visibilitychange', function(){
      try{ if(!document.hidden) renderOnboard(); }catch(e){}
    });

    log('growth ok');
  }catch(e){ log('boot fail', e); }
}

/* ===========================================================================
   16 · ПУБЛИЧНОЕ API
   =========================================================================== */

window.okgPaywall       = okgPaywall;
window.okgOnboardOpen   = okgOnboardOpen;
window.okgPartnerWidget = okgPartnerWidget;
window.okgNudge         = okgNudge;
window.okgReset         = okgReset;
/* сверх минимума — ядру удобно */
window.okgShowcase      = okgShowcase;
window.okgStep          = markStep;
window.okgQueue         = okgQueue;

if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
else boot();

})();
