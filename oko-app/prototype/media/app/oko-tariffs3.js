/* ============================================================================
   OKO TARIFFS v3 — лента тарифов и анимированный попап
   ----------------------------------------------------------------------------
   Правка Даниэля: «тарифы раньше были красивее и должны быть как раньше —
   сверху строка тарифов выделенная, и анимационные тарифы в попап окне».

   Что делает слой (и чего НЕ делает):
     • Раздел «Тарифы и подписка» открывается ЛЕНТОЙ: текущий тариф крупно,
       рядом факты по нему (лимит вывода, автопродление) и компактный
       переключатель планов. Лаймовый акцент — на активном, тёмные карточки —
       на остальных.
     • Сами карточки тарифов переехали в ПОПАП с анимацией: лист выезжает,
       карточка плана меняется со сдвигом в сторону переключения, пункты
       состава появляются каскадом. Всё это гасится при prefers-reduced-motion.
     • НИ ОДНОЙ своей цифры. Цены, состав, скидки по срокам, текущий тариф и
       лимит вывода СЧИТЫВАЮТСЯ из уже отрисованной разметки oko-wallet2.js
       (TARIFFS / PERIODS / curTier). Слой ничего не считает и не выдумывает.
     • Кнопка оплаты — это РОДНАЯ кнопка из oko-wallet2.js, перенесённая в попап
       вместе с её onclick. Слой сам ничего не активирует, никуда не платит и
       не рисует «Тариф включён».

   Как устроено. Ядро и кошелёк не трогаются: renderTariffs() приватна внутри
   IIFE oko-wallet2.js, поэтому перехват идёт по двум точкам —
     1) window.w2Open (обёртка над обёрткой кошелька) — отрисовать ленту сразу
        при открытии подстраницы;
     2) MutationObserver на #w2b-tariffs — кошелёк перерисовывает подстраницу
        сам (tarPeriod, tarPick, doPay, openPay), и лента переставляется поверх
        любой такой перерисовки.
   Признак «надо переложить» — наличие .w2-tar в теле. Слой его убирает, значит
   повторно на собственную правку не сработает и цикла нет. Экраны оплаты
   (спиннер, ссылка Lava, «оплата подключается») .w2-tar не содержат — они
   проходят нетронутыми, а попап при их появлении закрывается.
   ============================================================================ */
(function () {
'use strict';

var D = document;
var BOX = 'w2b-tariffs';

function $(id) { return D.getElementById(id); }
function ic(n, cls) {
  try { if (typeof I === 'function') return I(n, cls || ''); } catch (e) {}
  return '<svg class="i ' + (cls || '') + '"><use href="#i-' + n + '"/></svg>';
}
function esc(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
function txt(el) { return el ? String(el.textContent || '').trim() : ''; }
function reduced() {
  try { return !!(window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches); }
  catch (e) { return false; }
}

/* ===========================================================================
   1. СТИЛИ СЛОЯ (инлайном, как у остальных слоёв полировки)
   =========================================================================== */
var CSS = [
/* --- лента ---------------------------------------------------------------- */
'.t3-rib{ position:relative; overflow:hidden; margin:2px 0 14px; padding:15px 15px 13px;',
'  border-radius:20px; border:1px solid var(--border); background:var(--surface);',
'  box-shadow:0 10px 30px rgba(0,0,0,.22) }',
'.t3-rib::before{ content:""; position:absolute; inset:0; pointer-events:none;',
'  background:radial-gradient(120% 90% at 0% 0%, rgba(154,255,0,.16), transparent 62%) }',
'.t3-rib::after{ content:""; position:absolute; left:0; top:0; bottom:0; width:3px;',
'  background:linear-gradient(180deg, var(--lime), rgba(154,255,0,.12)) }',
'.t3-rib > *{ position:relative }',
'.t3-rib-top{ display:flex; align-items:flex-end; gap:12px; flex-wrap:wrap }',
'.t3-now{ display:flex; flex-direction:column; gap:2px; min-width:0; flex:1 1 auto }',
'.t3-now-lab{ font-size:10.5px; font-weight:800; letter-spacing:.1em; text-transform:uppercase;',
'  color:var(--dim) }',
'.t3-now-name{ font-family:var(--font-display); font-size:clamp(32px,10.5vw,46px); line-height:.94;',
'  letter-spacing:.045em; color:var(--accent); word-break:normal; overflow-wrap:break-word }',
'.t3-open{ flex:0 0 auto; display:inline-flex; align-items:center; gap:7px; cursor:pointer;',
'  padding:9px 13px; border-radius:999px; border:1px solid var(--accent); background:var(--lime-dim);',
'  color:var(--accent); font:inherit; font-size:12.5px; font-weight:800; line-height:1.2;',
'  white-space:nowrap; transition:transform .16s ease, background .16s ease }',
'.t3-open:active{ transform:scale(.96) }',
'.t3-open svg.i{ width:13px; height:13px; flex:0 0 auto }',
'.t3-facts{ display:flex; flex-wrap:wrap; gap:7px; margin:11px 0 0 }',
'.t3-fact{ display:inline-flex; flex-direction:column; gap:1px; min-width:0; max-width:100%;',
'  padding:6px 11px; border-radius:12px; background:var(--raised); border:1px solid var(--border) }',
'.t3-fact i{ font-style:normal; font-size:10px; font-weight:700; letter-spacing:.05em;',
'  text-transform:uppercase; color:var(--dim) }',
'.t3-fact b{ font-size:12.5px; font-weight:800; color:var(--text); overflow-wrap:break-word }',
/* край ряда гасим маской: так видно, что он прокручивается, а не обрезан */
'.t3-pills{ display:flex; gap:7px; margin:12px -15px -2px; padding:2px 15px 4px;',
'  overflow-x:auto; overflow-y:hidden; scrollbar-width:none; -webkit-overflow-scrolling:touch;',
'  -webkit-mask-image:linear-gradient(90deg,transparent 0,#000 15px,#000 calc(100% - 15px),transparent 100%);',
'  mask-image:linear-gradient(90deg,transparent 0,#000 15px,#000 calc(100% - 15px),transparent 100%) }',
'.t3-pills::-webkit-scrollbar{ display:none }',
'.t3-pill{ flex:0 0 auto; display:flex; flex-direction:column; align-items:flex-start; gap:1px;',
'  cursor:pointer; padding:8px 12px; border-radius:13px; border:1px solid var(--border);',
'  background:var(--raised); color:var(--text); font:inherit; text-align:left; white-space:nowrap;',
'  transition:transform .16s ease, border-color .16s ease, background .16s ease }',
'.t3-pill:active{ transform:scale(.96) }',
'.t3-pill span{ font-family:var(--font-display); font-size:17px; line-height:1; letter-spacing:.05em }',
'.t3-pill small{ font-size:10.5px; font-weight:700; color:var(--dim); line-height:1.25 }',
'.t3-pill.on{ border-color:var(--accent); background:var(--lime-dim); color:var(--accent) }',
'.t3-pill.on small{ color:var(--accent) }',
'.t3-pill.cur{ border-color:var(--lime); background:var(--lime); color:#0b0e07;',
'  box-shadow:0 0 0 1px rgba(154,255,0,.45), 0 6px 18px rgba(154,255,0,.20) }',
'.t3-pill.cur small{ color:rgba(11,14,7,.72) }',
'.t3-pill-cur{ display:inline-flex; align-items:center; gap:4px }',
'.t3-pill-cur svg.i{ width:11px; height:11px }',

/* --- попап ---------------------------------------------------------------- */
'.t3-pop{ position:fixed; inset:0; z-index:124; display:flex; align-items:flex-end;',
'  justify-content:center; opacity:0; visibility:hidden;',
'  transition:opacity .2s ease, visibility 0s linear .2s }',
'.t3-pop.on{ opacity:1; visibility:visible; transition:opacity .2s ease, visibility 0s }',
'.t3-pop-bg{ position:absolute; inset:0; background:rgba(0,0,0,.68); -webkit-backdrop-filter:blur(3px);',
'  backdrop-filter:blur(3px) }',
'body.t3-lock #w2p-tariffs .w2-body{ overflow:hidden }',
'.t3-sheet{ position:relative; width:100%; max-width:560px; display:flex; flex-direction:column;',
'  max-height:calc(100% - var(--oko-safe-top) - 26px);',
'  background:var(--surface); border:1px solid var(--border); border-bottom:0;',
'  border-radius:24px 24px 0 0; box-shadow:0 -20px 60px rgba(0,0,0,.55);',
'  transform:translate3d(0,26px,0); opacity:.6;',
'  transition:transform .3s cubic-bezier(.22,1,.36,1), opacity .22s ease }',
'.t3-pop.on .t3-sheet{ transform:none; opacity:1 }',
'.t3-sheet::before{ content:""; position:absolute; left:0; right:0; top:0; height:2px;',
'  background:linear-gradient(90deg, transparent, var(--lime), transparent); border-radius:24px 24px 0 0 }',
'@media (min-width:640px){ .t3-pop{ align-items:center }',
'  .t3-sheet{ border-radius:24px; border-bottom:1px solid var(--border);',
'    max-height:calc(100% - 60px); box-shadow:0 24px 70px rgba(0,0,0,.6) }',
'  .t3-sheet::before{ border-radius:24px 24px 0 0 } }',
'.t3-h{ display:flex; align-items:center; gap:10px; padding:15px 16px 10px; flex:0 0 auto }',
/* Bebas Neue без кириллицы, поэтому у смешанного заголовка разъезжает начертание —
   в шапке листа держим Montserrat, дисплейный шрифт остаётся на латинских названиях */
'.t3-h-t{ flex:1 1 auto; min-width:0; font-size:17px; font-weight:800; line-height:1.25;',
'  letter-spacing:.01em; color:var(--text) }',
'.t3-x{ flex:0 0 auto; width:34px; height:34px; border-radius:50%; cursor:pointer;',
'  border:1px solid var(--border); background:var(--raised); color:var(--text);',
'  display:flex; align-items:center; justify-content:center; padding:0 }',
'.t3-x svg.i{ width:14px; height:14px }',
'.t3-x:active{ transform:scale(.94) }',
'.t3-tabs{ display:flex; gap:6px; padding:0 16px 10px; overflow-x:auto; scrollbar-width:none; flex:0 0 auto }',
'.t3-tabs::-webkit-scrollbar{ display:none }',
'.t3-tab{ flex:0 0 auto; cursor:pointer; padding:7px 12px; border-radius:11px; font:inherit;',
'  font-family:var(--font-display); font-size:16px; letter-spacing:.05em; line-height:1.1;',
'  white-space:nowrap; border:1px solid var(--border); background:var(--raised); color:var(--dim);',
'  transition:color .16s ease, border-color .16s ease, background .16s ease }',
'.t3-tab.on{ border-color:var(--accent); background:var(--lime-dim); color:var(--accent) }',
'.t3-tab.cur{ border-color:var(--lime) }',
'.t3-per{ display:flex; gap:6px; padding:0 16px 12px; overflow-x:auto; scrollbar-width:none; flex:0 0 auto }',
'.t3-per::-webkit-scrollbar{ display:none }',
/* flex:1 0 auto — растягиваются на широком экране, но НЕ сжимаются:
   на 320 «без скидки» иначе вылезает за кнопку на 4px, ряд просто скроллится */
'.t3-per b{ flex:1 0 auto; min-width:64px; cursor:pointer; padding:7px 10px; border-radius:11px;',
'  border:1px solid var(--border); background:var(--raised); color:var(--text); font:inherit;',
'  font-size:12px; font-weight:700; line-height:1.25; text-align:center; white-space:nowrap;',
'  display:flex; flex-direction:column; gap:1px; transition:border-color .16s ease, background .16s ease }',
'.t3-per b i{ font-style:normal; font-size:10px; font-weight:700; color:var(--dim) }',
'.t3-per b.on{ border-color:var(--accent); background:var(--lime-dim); color:var(--accent) }',
'.t3-per b.on i{ color:var(--accent) }',
'.t3-stage{ position:relative; flex:1 1 auto; min-height:0; overflow-y:auto;',
'  -webkit-overflow-scrolling:touch; padding:0 16px 2px; transition:height .28s cubic-bezier(.22,1,.36,1) }',
'.t3-card{ border-radius:18px; border:1px solid var(--accent); background:var(--raised);',
'  padding:14px 14px 15px; box-shadow:0 0 0 1px rgba(154,255,0,.18) inset }',
'.t3-card.t3-out{ position:absolute; left:16px; right:16px; top:0; pointer-events:none }',
'.t3-card-h{ display:flex; align-items:baseline; gap:10px; flex-wrap:wrap }',
'.t3-name{ font-family:var(--font-display); font-size:30px; line-height:.98; letter-spacing:.05em;',
'  color:var(--text) }',
'.t3-price{ margin-left:auto; font-size:17px; font-weight:800; color:var(--accent); white-space:nowrap }',
'.t3-price small{ font-weight:600; font-size:11px; color:var(--dim) }',
'.t3-cur{ display:inline-flex; align-items:center; gap:6px; margin:9px 0 0; padding:4px 10px;',
'  border-radius:999px; background:var(--lime); color:#0b0e07; font-size:11px; font-weight:800;',
'  letter-spacing:.04em; text-transform:uppercase }',
'.t3-cur svg.i{ width:11px; height:11px }',
'.t3-who{ font-size:12.5px; line-height:1.5; color:var(--dim); margin:9px 0 11px;',
'  overflow-wrap:break-word }',
'.t3-f{ list-style:none; margin:0; padding:0; display:flex; flex-direction:column; gap:7px }',
'.t3-f li{ display:flex; gap:8px; font-size:12.8px; line-height:1.5; color:var(--text);',
'  overflow-wrap:break-word }',
'.t3-f li svg.i{ flex:0 0 auto; width:13px; height:13px; margin-top:3px; color:var(--accent) }',
'.t3-foot{ flex:0 0 auto; padding:12px 16px calc(14px + var(--oko-safe-bottom));',
'  border-top:1px solid var(--border); background:var(--surface) }',
'.t3-total{ font-size:11.5px; line-height:1.5; color:var(--dim); margin:0 0 9px;',
'  overflow-wrap:break-word }',
'.t3-total b{ color:var(--text) }',
'.t3-cta-wrap .btn{ width:100% }',
'.t3-cta-wrap .btn + .btn{ margin-top:8px }',

/* --- анимации ------------------------------------------------------------- */
'@keyframes t3-in-r{ from{ opacity:0; transform:translate3d(30px,0,0) scale(.985) } to{ opacity:1; transform:none } }',
'@keyframes t3-in-l{ from{ opacity:0; transform:translate3d(-30px,0,0) scale(.985) } to{ opacity:1; transform:none } }',
'@keyframes t3-out-l{ from{ opacity:1; transform:none } to{ opacity:0; transform:translate3d(-24px,0,0) scale(.985) } }',
'@keyframes t3-out-r{ from{ opacity:1; transform:none } to{ opacity:0; transform:translate3d(24px,0,0) scale(.985) } }',
'@keyframes t3-f-in{ from{ opacity:0; transform:translate3d(0,9px,0) } to{ opacity:1; transform:none } }',
'@keyframes t3-rib-in{ from{ opacity:0; transform:translate3d(0,-10px,0) } to{ opacity:1; transform:none } }',
'.t3-card.t3-a-r{ animation:t3-in-r .3s cubic-bezier(.22,1,.36,1) both }',
'.t3-card.t3-a-l{ animation:t3-in-l .3s cubic-bezier(.22,1,.36,1) both }',
'.t3-card.t3-out.t3-a-r{ animation:t3-out-l .26s ease both }',
'.t3-card.t3-out.t3-a-l{ animation:t3-out-r .26s ease both }',
'.t3-card.t3-a-r .t3-f li, .t3-card.t3-a-l .t3-f li{',
'  animation:t3-f-in .3s ease both; animation-delay:calc(90ms + var(--i) * 45ms) }',
'.t3-rib.t3-fresh{ animation:t3-rib-in .34s cubic-bezier(.22,1,.36,1) both }',

/* --- уважение к prefers-reduced-motion ------------------------------------ */
'@media (prefers-reduced-motion: reduce){',
'  .t3-pop, .t3-sheet, .t3-stage, .t3-card, .t3-card .t3-f li, .t3-rib, .t3-pill, .t3-tab,',
'  .t3-per b, .t3-open, .t3-x{ animation:none !important; transition:none !important }',
'  .t3-sheet{ transform:none !important; opacity:1 !important }',
'  .t3-card, .t3-card .t3-f li{ opacity:1 !important; transform:none !important }',
'  .t3-card.t3-out{ display:none !important } }',

/* --- попап ядра над подстраницей кошелька ---------------------------------
   #okoPopup имеет z-index 70, .w2-page — 118, поэтому «Как работает
   бесплатный тариф» открывался ПОД страницей тарифов и был не виден.
   Поднимаем только пока открыта страница тарифов. */
'body:has(#w2p-tariffs.open) #okoPopup{ z-index:2700 }'
].join('\n');

(function injectCss() {
  if ($('t3Css')) return;
  var s = D.createElement('style');
  s.id = 't3Css';
  s.textContent = CSS;
  (D.head || D.documentElement).appendChild(s);
})();

/* ===========================================================================
   2. ЧТЕНИЕ ДАННЫХ ИЗ РАЗМЕТКИ КОШЕЛЬКА
   Ни одна цифра здесь не рождается: всё берётся из уже отрисованного
   renderTariffs() в oko-wallet2.js.
   =========================================================================== */
var DATA = null;

function scrape(box) {
  var wrap = box.querySelector('.w2-tar');
  if (!wrap) return null;

  var plans = [].map.call(wrap.querySelectorAll('.w2-tar-c'), function (c) {
    var cta = c.querySelector('.w2-tar-cta');
    return {
      key: txt(c.querySelector('.w2-tar-n')),
      priceHtml: (c.querySelector('.w2-tar-p') || {}).innerHTML || '',
      who: txt(c.querySelector('.w2-tar-for')),
      feats: [].map.call(c.querySelectorAll('.w2-tar-f li span'), txt),
      isCur: !!c.querySelector('.w2-tar-cur'),
      sel: c.classList.contains('on'),
      ctaHtml: cta ? cta.innerHTML : ''
    };
  }).filter(function (p) { return p.key; });
  if (!plans.length) return null;

  var periods = [].map.call(box.querySelectorAll('.w2-per button'), function (b) {
    var m = /tarPeriod\((\d+)\)/.exec(b.getAttribute('onclick') || '');
    return {
      months: m ? +m[1] : 0,
      label: txt(b.querySelector('span')) || txt(b),
      note: txt(b.querySelector('i')),
      on: b.classList.contains('on')
    };
  }).filter(function (p) { return p.months; });

  var facts = [].map.call(box.querySelectorAll('.w2-kv .w2-kv-r'), function (r) {
    return { k: txt(r.querySelector('span')), v: txt(r.querySelector('b')) };
  });

  var fine = '';
  [].forEach.call(box.querySelectorAll('.w2-fine'), function (p) {
    if (/Итого к оплате/.test(p.textContent || '')) fine = p.innerHTML;
  });

  var cur = '';
  facts.forEach(function (f) { if (/^Тариф$/i.test(f.k)) cur = f.v; });
  if (!cur) {
    plans.forEach(function (p) { if (p.isCur) cur = p.key; });
  }

  var sel = '';
  plans.forEach(function (p) { if (p.sel) sel = p.key; });

  return {
    plans: plans,
    periods: periods,
    facts: facts.filter(function (f) { return f.k && !/^Тариф$/i.test(f.k); }),
    fine: fine,
    cur: cur,
    sel: sel
  };
}

/* ===========================================================================
   3. ЛЕНТА
   =========================================================================== */
function ribbonHtml(d) {
  var pills = d.plans.map(function (p) {
    var cls = 't3-pill' + (p.isCur ? ' cur' : (p.key === d.sel ? ' on' : ''));
    var price = String(p.priceHtml).replace(/<small>[\s\S]*?<\/small>/i, '').trim() || '—';
    return '<button type="button" class="' + cls + '" data-t3plan="' + esc(p.key) + '"' +
      ' aria-label="Тариф ' + esc(p.key) + (p.isCur ? ', твой сейчас' : '') + '">' +
      '<span>' + esc(p.key) + '</span>' +
      '<small>' + (p.isCur ? '<span class="t3-pill-cur">' + ic('check') + 'твой</span>' : price) + '</small>' +
      '</button>';
  }).join('');

  var facts = d.facts.map(function (f) {
    return '<span class="t3-fact"><i>' + esc(f.k) + '</i><b>' + esc(f.v) + '</b></span>';
  }).join('');

  return '<section class="t3-rib" aria-label="Твой тариф и планы">' +
    '<div class="t3-rib-top">' +
      '<span class="t3-now">' +
        '<span class="t3-now-lab">Твой тариф</span>' +
        '<span class="t3-now-name">' + esc(d.cur || '—') + '</span>' +
      '</span>' +
      '<button type="button" class="t3-open" data-t3open="1">' +
        ic('crown') + '<span>Все тарифы</span>' + ic('chev') +
      '</button>' +
    '</div>' +
    (facts ? '<div class="t3-facts">' + facts + '</div>' : '') +
    '<div class="t3-pills">' + pills + '</div>' +
  '</section>';
}

/* Убираем плоский список: он целиком переехал в ленту и попап. */
function stripFlat(box) {
  ['.w2-kv', '.w2-per', '.w2-tar'].forEach(function (sel) {
    var el = box.querySelector(sel);
    if (!el) return;
    var prev = el.previousElementSibling;
    if (prev && prev.classList && prev.classList.contains('w2-h')) prev.remove();
    el.remove();
  });
}

var lastCur = null;

function decorate() {
  var box = $(BOX);
  if (!box) return false;
  var d = scrape(box);
  if (!d) return false;

  DATA = d;
  stripFlat(box);

  var old = box.querySelector('.t3-rib');
  if (old) old.remove();

  var holder = D.createElement('div');
  holder.innerHTML = ribbonHtml(d);
  var rib = holder.firstElementChild;
  if (!reduced() && lastCur !== d.cur) rib.classList.add('t3-fresh');
  lastCur = d.cur;
  box.insertBefore(rib, box.firstChild);

  rib.addEventListener('click', function (e) {
    var open = e.target.closest ? e.target.closest('[data-t3open]') : null;
    if (open) { popOpen(DATA.sel || DATA.cur); return; }
    var pill = e.target.closest ? e.target.closest('[data-t3plan]') : null;
    if (pill) popOpen(pill.getAttribute('data-t3plan'));
  });

  /* «твой тариф» в ленте не должен оставаться за краем прокрутки */
  var pills = rib.querySelector('.t3-pills');
  var mark = rib.querySelector('.t3-pill.cur') || rib.querySelector('.t3-pill.on');
  if (pills && mark && mark.offsetLeft + mark.offsetWidth > pills.clientWidth - 8) {
    pills.scrollLeft = mark.offsetLeft + mark.offsetWidth - pills.clientWidth + 16;
  }

  if (popIsOn()) popFill(d, 0);
  return true;
}

/* ===========================================================================
   4. ПОПАП
   =========================================================================== */
var pop = null, stage = null, tabsEl = null, perEl = null, footEl = null;
var active = '';
var pendingDir = 0;

function buildPop() {
  if (pop) return pop;
  pop = D.createElement('div');
  pop.className = 't3-pop';
  pop.id = 't3Pop';
  pop.setAttribute('role', 'dialog');
  pop.setAttribute('aria-modal', 'true');
  pop.setAttribute('aria-label', 'Тарифы OKO');
  pop.innerHTML =
    '<div class="t3-pop-bg" data-t3close="1"></div>' +
    '<div class="t3-sheet">' +
      '<div class="t3-h">' +
        '<span class="t3-h-t">Тарифы OKO</span>' +
        '<button type="button" class="t3-x" data-t3close="1" aria-label="Закрыть">' + ic('x') + '</button>' +
      '</div>' +
      '<div class="t3-tabs" role="tablist"></div>' +
      '<div class="t3-per"></div>' +
      '<div class="t3-stage"></div>' +
      '<div class="t3-foot">' +
        '<p class="t3-total"></p>' +
        '<div class="t3-cta-wrap"></div>' +
      '</div>' +
    '</div>';
  D.body.appendChild(pop);

  stage  = pop.querySelector('.t3-stage');
  tabsEl = pop.querySelector('.t3-tabs');
  perEl  = pop.querySelector('.t3-per');
  footEl = pop.querySelector('.t3-foot');

  pop.addEventListener('click', function (e) {
    var c = e.target.closest ? e.target.closest('[data-t3close]') : null;
    if (c) { e.preventDefault(); popClose(); }
  });
  tabsEl.addEventListener('click', function (e) {
    var t = e.target.closest ? e.target.closest('[data-t3tab]') : null;
    if (t) pick(t.getAttribute('data-t3tab'));
  });
  perEl.addEventListener('click', function (e) {
    var b = e.target.closest ? e.target.closest('[data-t3per]') : null;
    if (!b) return;
    var m = +b.getAttribute('data-t3per');
    try { if (window.okoW2 && okoW2.tarPeriod) okoW2.tarPeriod(m); } catch (err) {}
    /* кошелёк перерисовал подстраницу — наблюдатель уже переложил ленту,
       здесь только подстраховка, если перерисовки не случилось */
    setTimeout(function () { if (popIsOn()) refresh(0); }, 0);
  });
  /* Кнопка внутри — РОДНАЯ кнопка кошелька со своим onclick. Мы её не
     подменяем, только уходим с дороги, если она увела человека дальше. */
  footEl.addEventListener('click', function (e) {
    if (!(e.target.closest && e.target.closest('.t3-cta-wrap'))) return;
    setTimeout(afterCta, 90);
  });
  return pop;
}

function afterCta() {
  if (!popIsOn()) return;
  var box = $(BOX);
  var gone = !box || !box.querySelector('.t3-rib');   /* пошла оплата: тело подменено */
  var other = !!D.querySelector('.w2-page.open:not(#w2p-tariffs)'); /* ушли на другую подстраницу */
  var corePop = !!$('okoPopup');                       /* открылось окно ядра */
  if (gone || other || corePop) popClose();
}

function popIsOn() { return !!(pop && pop.classList.contains('on')); }

function popOpen(key) {
  var box = $(BOX);
  if (!box) return;
  if (!DATA) DATA = scrape(box);
  if (!DATA) return;
  buildPop();
  active = '';
  pendingDir = 0;
  stage.innerHTML = '';
  popFill(DATA, 0, key);
  pop.classList.add('on');
  D.body.classList.add('t3-lock');
  try { if (typeof nvPush === 'function') nvPush('t3-tariffs', popClose); } catch (e) {}
  var on = tabsEl && tabsEl.querySelector('.t3-tab.on');
  if (on && on.scrollIntoView) { try { on.scrollIntoView({ block: 'nearest', inline: 'center' }); } catch (e) {} }
  /* открыли не на том плане, что выбран в кошельке — синхронизируем выбор,
     чтобы в подвале лежала родная кнопка оплаты именно этого тарифа */
  syncSel(active);
}

/* Синхронизация выбора с кошельком. tarPick у кошелька двойного назначения:
   пока план другой — он его выбирает, а на УЖЕ выбранном ЗАПУСКАЕТ ОПЛАТУ.
   Поэтому дёргаем его строго когда план точно другой. */
function syncSel(key) {
  if (!DATA || !key || key === DATA.sel || !idxIn(DATA, key)) return;
  try { if (window.okoW2 && okoW2.tarPick) okoW2.tarPick(key); } catch (e) {}
}

function popClose() {
  if (!pop) return;
  pop.classList.remove('on');
  D.body.classList.remove('t3-lock');
  try { if (typeof nvPop === 'function') nvPop('t3-tariffs'); } catch (e) {}
}

/* Выбор плана во вкладках попапа. */
function pick(key) {
  if (!key || !DATA || key === active || !idxIn(DATA, key)) return;
  pendingDir = dirTo(key);
  popFill(DATA, pendingDir, key);
  syncSel(key);
}

function dirTo(key) {
  if (!DATA) return 0;
  var a = idx(active), b = idx(key);
  if (a < 0 || b < 0 || a === b) return 0;
  return b > a ? 1 : -1;
}
function idx(key) {
  if (!DATA) return -1;
  for (var i = 0; i < DATA.plans.length; i++) if (DATA.plans[i].key === key) return i;
  return -1;
}

function refresh(dir) {
  var box = $(BOX);
  var d = box ? scrape(box) : null;
  if (d) DATA = d;
  if (DATA) popFill(DATA, dir);
}

function planCardHtml(p) {
  return '<article class="t3-card" data-k="' + esc(p.key) + '">' +
    '<div class="t3-card-h">' +
      '<span class="t3-name">' + esc(p.key) + '</span>' +
      '<span class="t3-price">' + p.priceHtml + '</span>' +
    '</div>' +
    (p.isCur ? '<span class="t3-cur">' + ic('check') + 'твой тариф</span>' : '') +
    (p.who ? '<p class="t3-who">' + esc(p.who) + '</p>' : '') +
    '<ul class="t3-f">' + p.feats.map(function (f, i) {
      return '<li style="--i:' + i + '">' + ic('check') + '<span>' + esc(f) + '</span></li>';
    }).join('') + '</ul>' +
  '</article>';
}

function popFill(d, dir, want) {
  if (!pop) return;
  if (!dir && pendingDir) dir = pendingDir;
  pendingDir = 0;
  var key = want || active || d.sel || d.cur || (d.plans[0] && d.plans[0].key);
  if (!idxIn(d, key)) key = d.plans[0] && d.plans[0].key;
  var plan = null;
  d.plans.forEach(function (p) { if (p.key === key) plan = p; });
  if (!plan) return;

  /* вкладки планов */
  tabsEl.innerHTML = d.plans.map(function (p) {
    return '<button type="button" role="tab" data-t3tab="' + esc(p.key) + '"' +
      ' aria-selected="' + (p.key === key ? 'true' : 'false') + '"' +
      ' class="t3-tab' + (p.key === key ? ' on' : '') + (p.isCur ? ' cur' : '') + '">' +
      esc(p.key) + '</button>';
  }).join('');

  /* сроки оплаты */
  perEl.innerHTML = d.periods.map(function (p) {
    return '<b role="button" tabindex="0" data-t3per="' + p.months + '"' +
      ' class="' + (p.on ? 'on' : '') + '">' + esc(p.label) +
      (p.note ? '<i>' + esc(p.note) + '</i>' : '') + '</b>';
  }).join('');

  /* карточка со сменой */
  var prev = stage.querySelector('.t3-card:not(.t3-out)');
  var samePlan = prev && prev.getAttribute('data-k') === key;
  var rm = reduced();

  if (samePlan && !dir) {
    /* тот же план и без направления — трогаем карточку ТОЛЬКО если у неё
       поменялась метка «твой тариф»: иначе снесём уже идущую анимацию */
    if (!!prev.querySelector('.t3-cur') !== !!plan.isCur) prev.outerHTML = planCardHtml(plan);
  } else if (!prev || rm || !dir) {
    stage.innerHTML = planCardHtml(plan);
    if (!rm && !prev) {
      var c0 = stage.querySelector('.t3-card');
      if (c0) c0.classList.add('t3-a-r');
    }
  } else {
    var h0 = stage.offsetHeight;
    prev.classList.add('t3-out', dir > 0 ? 't3-a-r' : 't3-a-l');
    var holder = D.createElement('div');
    holder.innerHTML = planCardHtml(plan);
    var card = holder.firstElementChild;
    card.classList.add(dir > 0 ? 't3-a-r' : 't3-a-l');
    stage.appendChild(card);
    var h1 = card.offsetHeight + 2;
    stage.style.height = h0 + 'px';
    /* принудительный reflow, иначе браузер склеит оба значения в одно */
    void stage.offsetHeight;
    stage.style.height = h1 + 'px';
    setTimeout(function () {
      stage.style.height = '';
      var out = stage.querySelector('.t3-card.t3-out');
      if (out) out.remove();
    }, 300);
  }

  /* итог и родная кнопка оплаты */
  pop.querySelector('.t3-total').innerHTML = d.fine ||
    'Цены — из раздела кошелька, слой их не пересчитывает.';
  pop.querySelector('.t3-cta-wrap').innerHTML = plan.ctaHtml || '';

  active = key;
}

function idxIn(d, key) {
  for (var i = 0; i < d.plans.length; i++) if (d.plans[i].key === key) return true;
  return false;
}

/* Выход есть всегда: крестик, тап по фону, Escape и системная «назад». */
D.addEventListener('keydown', function (e) {
  if (e.key !== 'Escape' && e.key !== 'Esc') return;
  if (!popIsOn()) return;
  e.preventDefault();
  e.stopPropagation();
  popClose();
}, true);

/* ===========================================================================
   5. ПОДКЛЮЧЕНИЕ
   =========================================================================== */
function watch() {
  var box = $(BOX);
  if (!box) return false;
  try {
    new MutationObserver(function () {
      /* .w2-tar есть только у «списочной» перерисовки кошелька */
      if (box.querySelector('.w2-tar')) { decorate(); return; }
      /* экраны оплаты (спиннер / ссылка Lava / «оплата подключается») —
         не трогаем, но попап убираем, чтобы человек их увидел */
      if (popIsOn() && !box.querySelector('.t3-rib')) popClose();
    }).observe(box, { childList: true });
  } catch (e) { return false; }
  decorate();
  return true;
}

(function hookOpen() {
  if (typeof window.w2Open !== 'function') return;
  var prev = window.w2Open;
  window.w2Open = function (id) {
    var r = prev.apply(this, arguments);
    if (id === 'tariffs') { try { decorate(); } catch (e) {} }
    return r;
  };
})();

/* Уход со страницы тарифов не должен оставлять попап висеть. */
(function hookClose() {
  if (typeof window.w2Close !== 'function') return;
  var prev = window.w2Close;
  window.w2Close = function (id) {
    if (id === 'tariffs') popClose();
    return prev.apply(this, arguments);
  };
})();

function boot() {
  if (watch()) return;
  var n = 0;
  var t = setInterval(function () {
    if (watch() || ++n > 40) clearInterval(t);
  }, 150);
}
if (D.readyState === 'loading') D.addEventListener('DOMContentLoaded', boot);
else boot();

window.okoT3 = { open: popOpen, close: popClose, redraw: decorate };

})();
