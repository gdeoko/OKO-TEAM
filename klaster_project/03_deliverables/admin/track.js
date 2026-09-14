/* Трекер посещений сайта «Кластер». Свой, без Метрики и Гугла.
   Зависимостей нет, наружу не ходит, грузится с нашего же домена.
   Подключение в конце body:
     <script src="/assets/js/track.js" defer data-endpoint="/track.php"></script>
   Разметка целей на сайте: data-track="phone|lead|presentation|shuttle|selector",
   зона подбора помещения: data-track-zone="podbor". */
(function () {
'use strict';

var TEG = document.currentScript;
var ADRES = (TEG && TEG.getAttribute('data-endpoint')) || '/track.php';
var VERSIYA = 1;

// 1. Отказ от слежения уважаем без оговорок, дальше не работаем вовсе.
var otkaz = navigator.doNotTrack || window.doNotTrack || navigator.msDoNotTrack;
if (otkaz === '1' || otkaz === 'yes' || navigator.globalPrivacyControl === true) return;
if (!navigator.sendBeacon) return;            // старые браузеры просто пропускаем

// 2. Хранилища. В приватном режиме бросают исключение, поэтому всё через обёртки.
function chit(hran, klyuch) { try { return window[hran].getItem(klyuch); } catch (e) { return null; } }
function pisat(hran, klyuch, znach) { try { window[hran].setItem(klyuch, znach); } catch (e) {} }

function sluchayny() {
  var abc = 'abcdefghijklmnopqrstuvwxyz0123456789', s = '', buf = null;
  try { buf = new Uint8Array(16); crypto.getRandomValues(buf); } catch (e) {}
  for (var i = 0; i < 16; i++) {
    var n = buf ? buf[i] : Math.floor(Math.random() * 256);
    s += abc.charAt(n % abc.length);
  }
  return s;
}

// 3. Кто пришёл. vid живёт в localStorage, sid в рамках вкладки.
var vid = chit('localStorage', 'kl_vid');
var novy = 0;
if (!vid) { vid = sluchayny(); novy = 1; pisat('localStorage', 'kl_vid', vid); pisat('localStorage', 'kl_first', String(Date.now())); }
var sid = chit('sessionStorage', 'kl_sid');
if (!sid) { sid = sluchayny(); pisat('sessionStorage', 'kl_sid', sid); }

// 4. Откуда пришёл. Свой реферер не считаем, метки держим на всю сессию,
//    иначе внутренние страницы обнулили бы источник.
var ref = '';
try {
  if (document.referrer && document.referrer.indexOf(location.host) === -1) ref = document.referrer.slice(0, 400);
} catch (e) {}
var sohranenRef = chit('sessionStorage', 'kl_ref');
if (ref) pisat('sessionStorage', 'kl_ref', ref); else if (sohranenRef) ref = sohranenRef;

var utm = {};
(function () {
  var polya = ['source', 'medium', 'campaign', 'content', 'term'];
  var p;
  try { p = new URLSearchParams(location.search); } catch (e) { p = null; }
  if (p) for (var i = 0; i < polya.length; i++) {
    var v = p.get('utm_' + polya[i]);
    if (v) utm[polya[i]] = v.slice(0, 100);
  }
  if (p && p.get('yclid')) utm.klik = p.get('yclid').slice(0, 60);
  if (Object.keys(utm).length) pisat('sessionStorage', 'kl_utm', JSON.stringify(utm));
  else {
    var st = chit('sessionStorage', 'kl_utm');
    if (st) { try { utm = JSON.parse(st) || {}; } catch (e) { utm = {}; } }
  }
})();

// 5. Устройство. Тип считаем по короткой стороне экрана и наличию касаний.
function ustroystvo() {
  var korotkaya = Math.min(screen.width || 0, screen.height || 0);
  var kasanie = ('ontouchstart' in window) || navigator.maxTouchPoints > 0;
  if (kasanie && korotkaya <= 480) return 'mobile';
  if (kasanie && korotkaya <= 1024) return 'tablet';
  return 'desktop';
}
var dev = ustroystvo();

// 6. Время на странице считаем только пока вкладка видна.
var nachalo = Date.now(), nakoplen = 0, vidno = !document.hidden;
function sekundy() { return Math.round((nakoplen + (vidno ? Date.now() - nachalo : 0)) / 1000); }

// 7. Буфер отправки. Копим и шлём пачкой, чтобы не дёргать сервер на каждый чих.
var bufer = [], taymer = null;

function sobytie(tip, dop) {
  var e = {
    t: tip, sid: sid, vid: vid, nw: novy,
    u: (location.pathname + location.search).slice(0, 400),
    ttl: (document.title || '').slice(0, 160),
    ref: ref, utm: utm,
    scr: (screen.width || 0) + 'x' + (screen.height || 0),
    dev: dev,
    lang: (navigator.language || '').slice(0, 12),
    ct: Date.now()
  };
  if (dop) for (var k in dop) if (Object.prototype.hasOwnProperty.call(dop, k)) e[k] = dop[k];
  bufer.push(e);
  if (bufer.length >= 12) otpravit();
  else { clearTimeout(taymer); taymer = setTimeout(otpravit, 2000); }
}

function otpravit() {
  clearTimeout(taymer);
  if (!bufer.length) return;
  var telo = JSON.stringify({ v: VERSIYA, b: bufer });
  bufer = [];
  try { navigator.sendBeacon(ADRES, new Blob([telo], { type: 'application/json' })); } catch (e) {}
}

// 8. Глубина прокрутки. Пороги 25/50/75/100, каждый отдаём один раз.
var porogi = [25, 50, 75, 100], otdano = {}, maks = 0, zhdyom = false;

function pometit(p) {
  if (otdano[p]) return;
  otdano[p] = 1;
  if (p > maks) maks = p;
  sobytie('scroll', { sd: p });
}

function proverit() {
  zhdyom = false;
  var h = document.documentElement;
  var vsego = Math.max(h.scrollHeight || 0, document.body ? document.body.scrollHeight : 0);
  var okno = window.innerHeight || h.clientHeight || 0;
  var verh = window.pageYOffset || h.scrollTop || 0;
  if (vsego <= okno + 4) { pometit(100); return; }          // страница короче экрана
  var pct = Math.round(((verh + okno) / vsego) * 100);
  for (var i = 0; i < porogi.length; i++) if (pct >= porogi[i]) pometit(porogi[i]);
}

window.addEventListener('scroll', function () {
  if (!zhdyom) { zhdyom = true; requestAnimationFrame(proverit); }
}, { passive: true });
window.addEventListener('resize', function () { proverit(); }, { passive: true });

// 9. Клики по важному. Сначала явная разметка data-track, потом разумные догадки.
var CELI = [
  ['phone',        'a[href^="tel:"], [data-track="phone"]'],
  ['lead',         '[data-track="lead"], .js-zayavka, a[href="#zayavka"], a[href="#form"]'],
  ['presentation', '[data-track="presentation"], a[href$=".pdf"], a[download]'],
  ['shuttle',      '[data-track="shuttle"]'],
  ['selector',     '[data-track="selector"]'],
  ['whatsapp',     'a[href*="wa.me"], a[href*="whatsapp"]'],
  ['telegram',     'a[href*="t.me"]'],
  ['mail',         'a[href^="mailto:"]']
];

function zona(el) {
  if (el.closest('header, .header, .shapka, [data-track-zone="shapka"]')) return 'shapka';
  if (el.closest('footer, .footer, .podval')) return 'podval';
  if (el.closest('[data-track-zone="podbor"], #podbor, .js-podbor')) return 'podbor';
  return 'telo';
}

document.addEventListener('click', function (ev) {
  var t = ev.target;
  if (!t || !t.closest) return;
  for (var i = 0; i < CELI.length; i++) {
    var el = t.closest(CELI[i][1]);
    if (!el) continue;
    sobytie('click', {
      el: CELI[i][0],
      zona: zona(el),
      txt: (el.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 60),
      sd: maks, dur: sekundy()
    });
    otpravit();                                   // цель важнее экономии запросов
    return;
  }
}, true);

// Подбор помещения ловим по изменению полей внутри его зоны, один раз за страницу.
var podborOtdan = false;
document.addEventListener('change', function (ev) {
  var t = ev.target;
  if (!t || !t.closest || podborOtdan) return;
  if (t.closest('[data-track-zone="podbor"], #podbor, .js-podbor')) {
    podborOtdan = true;
    sobytie('click', { el: 'selector', zona: 'podbor', dur: sekundy() });
  }
}, true);

// 10. Форма: начало заполнения и отправка. Между ними и живёт вся воронка.
function imyaFormy(f) {
  return (f.getAttribute('data-track-form') || f.id || f.name || 'форма').slice(0, 40);
}
var formaNachata = false;
document.addEventListener('focusin', function (ev) {
  var t = ev.target;
  if (formaNachata || !t || !t.closest) return;
  var f = t.closest('form');
  if (f) { formaNachata = true; sobytie('form_start', { el: imyaFormy(f), dur: sekundy() }); }
}, true);

document.addEventListener('submit', function (ev) {
  var f = ev.target;
  if (!f || f.nodeName !== 'FORM') return;
  sobytie('form_submit', { el: imyaFormy(f), sd: maks, dur: sekundy() });
  otpravit();
}, true);

// Ручка для форм на ajax: window.klTrack.cel('form_submit', 'заявка-шаттл')
window.klTrack = {
  cel: function (tip, imya) {
    if (tip !== 'form_submit' && tip !== 'form_start' && tip !== 'click') tip = 'click';
    sobytie(tip, { el: String(imya || 'other').slice(0, 40), sd: maks, dur: sekundy() });
    otpravit();
  }
};

// 11. Уход со страницы и переключение вкладки.
var uhodOtdan = false;
function uhod() {
  if (uhodOtdan) return;
  uhodOtdan = true;
  sobytie('exit', { dur: sekundy(), sd: maks });
  otpravit();
}
document.addEventListener('visibilitychange', function () {
  if (document.hidden) { nakoplen += Date.now() - nachalo; vidno = false; sobytie('time', { dur: sekundy(), sd: maks }); otpravit(); }
  else { nachalo = Date.now(); vidno = true; }
});
window.addEventListener('pagehide', uhod);
window.addEventListener('beforeunload', uhod);

// 12. Старт. Просмотр отдаём сразу, через полминуты подтверждаем время.
sobytie('view', {});
setTimeout(function () { if (!uhodOtdan) sobytie('time', { dur: sekundy(), sd: maks }); }, 30000);
if (document.readyState === 'complete') proverit();
else window.addEventListener('load', proverit);

})();
