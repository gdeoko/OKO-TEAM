/* =============================================================================
   OKO · БИРЖА — полноценный маркетплейс (уровень Авито, адаптирован под OKO)

   Грузится ПОСЛЕ ядра и полностью перерисовывает мини-апп «Биржа».
   Ядро (index.html / app.js / app.css) не трогается: скрипт подменяет
   глобальные функции биржи и заново собирает контейнер #ma-market.

   Экраны:
     home    — поиск, категории, фильтры, сортировка, сетка объявлений
     list    — категория / результаты поиска
     item    — карточка объявления (галерея, продавец, действия, похожие)
     create  — пошаговый мастер размещения (7 шагов, черновики, предпросмотр)
     mine    — «Мои объявления OKO»: активные / черновики / модерация / архив
     fav     — избранное
     history — история просмотров
     deals   — отклики и сделки

   ЖЁСТКИЕ ПРАВИЛА, которые здесь соблюдены:
     • ноль демо-данных — каталог наполняется только тем, что создал человек;
     • ноль ложных подтверждений — кнопка либо делает дело, либо честно
       объясняет, что произойдёт дальше;
     • ноль эмодзи — только SVG из спрайта index.html;
     • safe-area только через var(--oko-safe-*);
     • из любого экрана есть выход: кнопка «назад», Escape, системная «назад»,
       тап вне шторки.
   ============================================================================= */
(function () {
'use strict';
if (window.__okoMarket3) return;
window.__okoMarket3 = true;

/* ============================== 1. УТИЛИТЫ ================================ */

var SVG = function (n, cls) {
  return '<svg class="i ' + (cls || '') + '" aria-hidden="true"><use href="#i-' + n + '"/></svg>';
};
function esc(s) { var d = document.createElement('div'); d.textContent = (s == null ? '' : String(s)); return d.innerHTML; }
function att(s) { return esc(s).replace(/"/g, '&quot;'); }
function say(m) { if (typeof window.toast === 'function') window.toast(m); }
function num(n) { try { return Number(n || 0).toLocaleString('ru-RU'); } catch (e) { return String(n || 0); } }
function scrollTopNow() {
  var m = document.querySelector('main');
  if (m) m.scrollTop = 0;
  var s = document.getElementById('screen-mini');
  if (s) s.scrollTop = 0;
}
function daysWord(n) {
  var a = Math.abs(n) % 100, b = a % 10;
  if (a > 10 && a < 20) return 'дней';
  if (b > 1 && b < 5) return 'дня';
  if (b === 1) return 'день';
  return 'дней';
}
function plural(n, one, few, many) {
  var a = Math.abs(n) % 100, b = a % 10;
  if (a > 10 && a < 20) return many;
  if (b > 1 && b < 5) return few;
  if (b === 1) return one;
  return many;
}
function dateShort(ts) {
  try {
    var d = new Date(ts), now = new Date();
    var same = d.toDateString() === now.toDateString();
    var hh = String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');
    if (same) return 'сегодня, ' + hh;
    return d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' }) + ', ' + hh;
  } catch (e) { return ''; }
}
function dateMonth(ts) {
  try { return new Date(ts).toLocaleDateString('ru-RU', { month: 'long', year: 'numeric' }); }
  catch (e) { return ''; }
}

/* ============================== 2. ХРАНИЛИЩЕ ============================== */

var KEY = 'oko-market-v3';
var S = load();

function blank() {
  return { v: 3, listings: [], favs: [], history: [], deals: [], searches: [], draft: null };
}
function load() {
  var d = blank();
  try {
    var raw = JSON.parse(localStorage.getItem(KEY) || 'null');
    if (raw && typeof raw === 'object') {
      ['listings', 'favs', 'history', 'deals', 'searches'].forEach(function (k) {
        if (Array.isArray(raw[k])) d[k] = raw[k];
      });
      if (raw.draft && typeof raw.draft === 'object') d.draft = raw.draft;
    }
  } catch (e) { /* битое хранилище — начинаем с чистого */ }
  return d;
}
var saveFailed = false;
function save() {
  try { localStorage.setItem(KEY, JSON.stringify(S)); saveFailed = false; return true; }
  catch (e) {
    saveFailed = true;
    say('В памяти устройства не осталось места. Удали лишние фото или объявления.');
    return false;
  }
}
function uid() { return 'l' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }
function find(id) { for (var i = 0; i < S.listings.length; i++) if (S.listings[i].id === id) return S.listings[i]; return null; }

/* ============================== 3. СПРАВОЧНИКИ ============================ */

var CATS = [
  { k: 'video',  s: 'Видео',    n: 'Видео и монтаж',         ic: 'camera',      kind: 'service' },
  { k: 'design', s: 'Дизайн',   n: 'Дизайн и графика',       ic: 'photo',       kind: 'service' },
  { k: 'ads',    s: 'Реклама',  n: 'Реклама и трафик',       ic: 'megaphone',   kind: 'service' },
  { k: 'smm',    s: 'SMM',      n: 'SMM и ведение страниц',  ic: 'users',       kind: 'service' },
  { k: 'text',   s: 'Тексты',   n: 'Тексты и сценарии',      ic: 'file',        kind: 'service' },
  { k: 'audio',  s: 'Аудио',    n: 'Аудио и озвучка',        ic: 'mic',         kind: 'service' },
  { k: 'web',    s: 'Сайты',    n: 'Сайты и приложения',     ic: 'globe',       kind: 'service' },
  { k: '3d',     s: '3D',       n: '3D и анимация',          ic: 'bolt',        kind: 'service' },
  { k: 'shoot',  s: 'Съёмка',   n: 'Фото- и видеосъёмка',    ic: 'circle-play', kind: 'service' },
  { k: 'edu',    s: 'Обучение', n: 'Обучение и консалтинг',  ic: 'briefcase',   kind: 'service' },
  { k: 'gear',   s: 'Техника',  n: 'Техника и оборудование', ic: 'device',      kind: 'goods'   },
  { k: 'job',    s: 'Вакансии', n: 'Вакансии и подработка',  ic: 'target',      kind: 'job'     }
];
function cat(k) { for (var i = 0; i < CATS.length; i++) if (CATS[i].k === k) return CATS[i]; return CATS[0]; }

var KINDS = [
  { k: 'service', n: 'Услуга' },
  { k: 'goods',   n: 'Товар' },
  { k: 'job',     n: 'Вакансия' }
];
var PRICE_KINDS = [
  { k: 'fixed', n: 'Точная цена' },
  { k: 'from',  n: 'Цена от' },
  { k: 'hour',  n: 'Цена за час' },
  { k: 'deal',  n: 'Договорная' },
  { k: 'free',  n: 'Бесплатно' }
];
var TERMS = ['до 1 дня', 'до 3 дней', 'до недели', 'до 2 недель', 'до месяца', 'по договорённости'];
var CITIES = ['Москва', 'Санкт-Петербург', 'Новосибирск', 'Екатеринбург', 'Казань', 'Нижний Новгород',
  'Челябинск', 'Самара', 'Уфа', 'Ростов-на-Дону', 'Краснодар', 'Сочи', 'Владивосток', 'Минск', 'Алматы', 'Ташкент'];
var SORTS = [
  ['new',    'Сначала новые'],
  ['cheap',  'Сначала дешевле'],
  ['exp',    'Сначала дороже'],
  ['rating', 'По рейтингу']
];
var STATUS = {
  active:     { n: 'Активно',       c: 'ok' },
  draft:      { n: 'Черновик',      c: 'draft' },
  moderation: { n: 'На модерации',  c: 'mod' },
  archived:   { n: 'Снято',         c: 'arch' }
};
var DEAL_ST = {
  'new':   { n: 'Новая',      c: 'mod' },
  'work':  { n: 'В работе',   c: 'ok' },
  'done':  { n: 'Завершена',  c: 'ok' },
  'cancel':{ n: 'Отменена',   c: 'arch' }
};

/* Стоп-лист автопроверки OKO. Это настоящая проверка содержимого,
   а не имитация модерации: слово нашлось — объявление не публикуется. */
var STOP = ['наркот', 'мефедрон', 'амфетамин', 'гашиш', 'закладк', 'оружие', 'взрывчат',
  'поддельн', 'обнал', 'купить диплом', 'купить паспорт', 'казино', 'ставки на спорт',
  'порно', 'интим-услуг', 'эскорт', 'кредит без отказа', 'обход блокировк банк'];
function moderate(t, d) {
  var s = ((t || '') + ' ' + (d || '')).toLowerCase().replace(/ё/g, 'е');
  var hits = [];
  STOP.forEach(function (w) { if (s.indexOf(w.replace(/ё/g, 'е')) >= 0) hits.push(w); });
  return hits;
}

/* ============================== 4. ПРОФИЛЬ ================================ */

function me() {
  var p = window.PROFILE || {};
  return {
    name: p.name || 'Ты',
    nick: p.nick || '',
    verified: !!p.verified,
    since: p.since || null,
    phone: p.phone || '',
    email: p.email || ''
  };
}
function initial(n) { return (String(n || 'O').trim()[0] || 'O').toUpperCase(); }

/* ============================== 5. ЦЕНА =================================== */

function priceText(l) {
  if (l.priceKind === 'free') return 'Бесплатно';
  if (l.priceKind === 'deal') return 'Договорная';
  var v = num(l.price);
  if (l.priceKind === 'from') return 'от ' + v + ' ₽';
  if (l.priceKind === 'hour') return v + ' ₽/час';
  return v + ' ₽';
}
function priceValue(l) {
  if (l.priceKind === 'free') return 0;
  if (l.priceKind === 'deal') return -1;   /* договорные — в конец при сортировке по цене */
  return Number(l.price) || 0;
}

/* ============================== 6. СОСТОЯНИЕ ============================== */

var F = { q: '', cat: '', kind: '', min: '', max: '', city: '', remote: false, verified: false, rating: 0, term: '', sort: 'new' };
var VS = [{ v: 'home' }];      /* стек экранов биржи */
var W = null;                  /* состояние мастера размещения */
var mineTab = 'active';
var dealsTab = 'resp';
var suggestOpen = false;
var revealed = {};             /* показанные контакты по id объявления */

function view() { return VS[VS.length - 1]; }

function filtersCount() {
  var n = 0;
  if (F.min !== '') n++;
  if (F.max !== '') n++;
  if (F.city) n++;
  if (F.remote) n++;
  if (F.verified) n++;
  if (F.rating) n++;
  if (F.term) n++;
  if (F.kind) n++;
  return n;
}
function resetFiltersState() {
  F.min = ''; F.max = ''; F.city = ''; F.remote = false; F.verified = false; F.rating = 0; F.term = ''; F.kind = '';
}

/* каталог = только опубликованные объявления */
function catalog() {
  return S.listings.filter(function (l) { return l.status === 'active'; });
}
function applyQuery(arr) {
  var q = (F.q || '').trim().toLowerCase();
  if (q) {
    arr = arr.filter(function (l) {
      var hay = (l.title + ' ' + l.desc + ' ' + cat(l.cat).n + ' ' + (l.city || '') + ' ' +
        (l.specs || []).map(function (s) { return s.k + ' ' + s.v; }).join(' ')).toLowerCase();
      return hay.indexOf(q) >= 0;
    });
  }
  if (F.cat) arr = arr.filter(function (l) { return l.cat === F.cat; });
  if (F.kind) arr = arr.filter(function (l) { return l.kind === F.kind; });
  if (F.min !== '') arr = arr.filter(function (l) { return priceValue(l) >= Number(F.min); });
  if (F.max !== '') arr = arr.filter(function (l) { var v = priceValue(l); return v >= 0 && v <= Number(F.max); });
  if (F.city) arr = arr.filter(function (l) { return (l.city || '').toLowerCase().indexOf(F.city.toLowerCase()) >= 0; });
  if (F.remote) arr = arr.filter(function (l) { return !!l.remote; });
  if (F.verified) arr = arr.filter(function (l) { return !!l.sellerVerified; });
  if (F.rating) arr = arr.filter(function (l) { return (l.rating || 0) >= F.rating; });
  if (F.term) arr = arr.filter(function (l) { return l.term === F.term; });

  var s = F.sort;
  arr = arr.slice();
  arr.sort(function (a, b) {
    if (s === 'cheap') return sortPrice(a, b, 1);
    if (s === 'exp') return sortPrice(b, a, 1);
    if (s === 'rating') return (b.rating || 0) - (a.rating || 0) || bumped(b) - bumped(a);
    return bumped(b) - bumped(a);
  });
  return arr;
}
function bumped(l) { return Math.max(l.bumpedAt || 0, l.publishedAt || 0, l.createdAt || 0); }
function sortPrice(a, b, dir) {
  var pa = priceValue(a), pb = priceValue(b);
  if (pa < 0 && pb < 0) return bumped(b) - bumped(a);
  if (pa < 0) return 1;
  if (pb < 0) return -1;
  return (pa - pb) * dir;
}

/* ============================== 7. НАВИГАЦИЯ ============================== */

function navPush() {
  if (typeof window.nvPush !== 'function') return;
  try { window.nvPush('mk3:' + VS.length, function () { if (VS.length > 1) VS.pop(); paint(); }); } catch (e) {}
}
function navPop(depth) {
  if (typeof window.nvPop !== 'function') return;
  try { window.nvPop('mk3:' + depth); } catch (e) {}
}
function navClearMine() {
  if (typeof window.nvFind !== 'function' || typeof window.nvPop !== 'function') return;
  var guard = 0;
  try { while (window.nvFind('mk3:') && guard++ < 16) window.nvPop('mk3:'); } catch (e) {}
}
function go(v, p) {
  var st = { v: v };
  if (p) for (var k in p) if (Object.prototype.hasOwnProperty.call(p, k)) st[k] = p[k];
  VS.push(st);
  navPush();
  paint();
}
function replace(v, p) {
  var st = { v: v };
  if (p) for (var k in p) if (Object.prototype.hasOwnProperty.call(p, k)) st[k] = p[k];
  VS[VS.length - 1] = st;
  paint();
}
function back() {
  if (VS.length > 1) {
    var d = VS.length;
    VS.pop();
    navPop(d);
    paint();
  } else {
    if (typeof window.closeMa === 'function') window.closeMa();
  }
}
function home() {
  navClearMine();
  VS = [{ v: 'home' }];
  paint();
}

/* ============================== 8. СТИЛИ ================================== */

var CSS = [
'#ma-market{padding-bottom:calc(18px + var(--oko-safe-bottom))}',
'.mk2{--mk-r:16px;font-family:var(--font-body);color:var(--text);overflow-wrap:break-word}',
'.mk2 *{box-sizing:border-box;min-width:0}',

/* --- шапка --- */
'.mk2-head{display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin:0 0 12px}',
'.mk2-back{display:inline-flex;align-items:center;gap:7px;height:38px;padding:0 15px 0 11px;border-radius:12px;',
  'background:var(--raised);border:1px solid var(--border);color:var(--text);font-size:13px;font-weight:600;line-height:1.2;transition:background .16s,transform .1s}',
'.mk2-back:active{transform:scale(.97)}',
'.mk2-back svg.i{width:1.05em;height:1.05em;transform:rotate(180deg);color:var(--accent)}',
'.mk2-head-sp{flex:1 1 auto}',
'.mk2-headbtn{display:inline-flex;align-items:center;gap:6px;height:38px;padding:0 13px;border-radius:12px;background:var(--raised);',
  'border:1px solid var(--border);color:var(--dim);font-size:12.5px;font-weight:600}',
'.mk2-headbtn.on{color:#000;background:var(--lime);border-color:var(--lime)}',
'.mk2-title{font-family:var(--font-display);font-size:34px;line-height:1.02;letter-spacing:.035em;margin:0 0 4px;',
  'display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;color:var(--text)}',
'.mk2-title.sm{font-size:28px}',
'.mk2-title.xs{font-size:23px;line-height:1.08}',
'.mk2-sub{color:var(--dim);font-size:12.5px;line-height:1.45;margin:0 0 16px}',

/* --- поиск --- */
'.mk2-searchwrap{position:relative;margin:0 0 12px}',
'.mk2-search{display:flex;align-items:center;gap:9px;height:48px;padding:0 12px;border-radius:14px;',
  'background:var(--raised);border:1px solid var(--border);transition:border-color .18s}',
'.mk2-search:focus-within{border-color:var(--accent)}',
'.mk2-search svg.i{color:var(--dim);width:1.15em;height:1.15em}',
'.mk2-search input{flex:1;min-width:0;height:100%;background:none;border:0;outline:none;color:var(--text);font-size:15px;font-family:var(--font-body)}',
'.mk2-search input::placeholder{color:var(--dim)}',
'.mk2-searchclr{width:30px;height:30px;border-radius:50%;display:flex;align-items:center;justify-content:center;color:var(--dim);background:var(--surface);flex:0 0 auto}',
'.mk2-sug{position:absolute;left:0;right:0;top:calc(100% + 6px);z-index:12;background:var(--surface);border:1px solid var(--border);',
  'border-radius:14px;padding:6px;box-shadow:0 18px 40px rgba(0,0,0,.35);max-height:52vh;overflow-y:auto}',
'.mk2-sug button{display:flex;align-items:center;gap:10px;width:100%;padding:10px 10px;border-radius:10px;color:var(--text);',
  'font-size:13.5px;text-align:left;line-height:1.35}',
'.mk2-sug button:hover{background:var(--raised)}',
'.mk2-sug button svg.i{color:var(--dim);flex:0 0 auto}',
'.mk2-sug .mk2-sug-h{padding:8px 10px 4px;color:var(--dim);font-size:11px;font-weight:700;letter-spacing:.06em;text-transform:uppercase}',

/* --- быстрые плитки --- */
'.mk2-quick{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:9px;margin:0 0 14px}',
'@media(min-width:560px){.mk2-quick{grid-template-columns:repeat(4,minmax(0,1fr))}}',
'.mk2-qt{display:flex;align-items:center;gap:10px;padding:12px 12px;border-radius:14px;background:var(--surface);',
  'border:1px solid var(--border);text-align:left;transition:border-color .16s,transform .1s}',
'.mk2-qt:active{transform:scale(.98)}',
'.mk2-qt-ic{width:34px;height:34px;flex:0 0 auto;border-radius:10px;background:var(--lime-dim);color:var(--accent);',
  'display:flex;align-items:center;justify-content:center}',
'.mk2-qt-b{display:flex;flex-direction:column;gap:2px;min-width:0}',
'.mk2-qt-b b{font-size:12.5px;font-weight:700;line-height:1.25}',
'.mk2-qt-b small{font-size:11px;color:var(--dim);line-height:1.25}',

/* --- главная кнопка --- */
'.mk2-btn{display:inline-flex;align-items:center;justify-content:center;gap:8px;width:100%;padding:14px 18px;border-radius:14px;',
  'background:linear-gradient(135deg,#B9FF4D,#9AFF00 55%,#7ACC00);color:#000;font-weight:800;font-size:14px;line-height:1.3;',
  'white-space:normal;text-align:center;transition:transform .12s}',
'.mk2-btn:active{transform:scale(.98)}',
'.mk2-btn.ghost{background:none;border:1px solid var(--border);color:var(--text);font-weight:700}',
'.mk2-btn.lime-ghost{background:none;border:1px solid var(--accent);color:var(--accent)}',
'.mk2-btn.danger{background:none;border:1px solid var(--danger);color:var(--danger)}',
'.mk2-btn.sm{width:auto;padding:9px 14px;font-size:12.5px;border-radius:11px}',
'.mk2-btnrow{display:flex;gap:9px;flex-wrap:wrap;margin-top:10px}',
'.mk2-btnrow>*{flex:1 1 140px}',

/* --- рельс категорий --- */
'.mk2-sech{display:flex;align-items:baseline;justify-content:space-between;gap:10px;margin:18px 0 10px}',
'.mk2-sech h3{font-family:var(--font-display);font-size:22px;letter-spacing:.045em;margin:0;line-height:1.1}',
'.mk2-sech button{color:var(--accent);font-size:12px;font-weight:700;flex:0 0 auto}',
'.mk2-rail{display:flex;gap:8px;overflow-x:auto;padding:2px 2px 8px;scrollbar-width:none;-webkit-overflow-scrolling:touch}',
'.mk2-rail::-webkit-scrollbar{height:0}',
'.mk2-cat{flex:0 0 auto;width:82px;display:flex;flex-direction:column;align-items:center;gap:7px;padding:11px 6px 10px;',
  'border-radius:14px;background:var(--surface);border:1px solid var(--border);transition:border-color .16s,transform .1s}',
'.mk2-cat:active{transform:scale(.96)}',
'.mk2-cat.on{border-color:var(--accent);background:var(--lime-dim)}',
'.mk2-cat-ic{width:34px;height:34px;border-radius:11px;background:var(--raised);color:var(--accent);display:flex;align-items:center;justify-content:center}',
'.mk2-cat.on .mk2-cat-ic{background:var(--lime);color:#000}',
'.mk2-cat b{font-size:11px;font-weight:700;line-height:1.2;text-align:center;color:var(--text)}',
'.mk2-cat i{font-style:normal;font-size:10px;color:var(--dim);line-height:1.1}',
'.mk2-catgrid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:9px}',
'@media(min-width:560px){.mk2-catgrid{grid-template-columns:repeat(3,minmax(0,1fr))}}',
'@media(min-width:980px){.mk2-catgrid{grid-template-columns:repeat(4,minmax(0,1fr))}}',
'.mk2-catrow{display:flex;align-items:center;gap:10px;padding:12px;border-radius:13px;background:var(--surface);',
  'border:1px solid var(--border);text-align:left}',
'.mk2-catrow.on{border-color:var(--accent)}',
'.mk2-catrow .mk2-cat-ic{width:32px;height:32px;flex:0 0 auto}',
'.mk2-catrow span{display:flex;flex-direction:column;gap:2px;min-width:0}',
'.mk2-catrow b{font-size:12.5px;font-weight:700;line-height:1.3}',
'.mk2-catrow small{font-size:11px;color:var(--dim)}',

/* --- чипы фильтров --- */
'.mk2-chips{display:flex;gap:7px;overflow-x:auto;padding:2px 2px 8px;scrollbar-width:none}',
'.mk2-chips::-webkit-scrollbar{height:0}',
'.mk2-chip{flex:0 0 auto;display:inline-flex;align-items:center;gap:6px;height:35px;padding:0 13px;border-radius:999px;',
  'background:var(--raised);border:1px solid var(--border);color:var(--dim);font-size:12.5px;font-weight:600;white-space:nowrap}',
'.mk2-chip svg.i{width:1.05em;height:1.05em}',
'.mk2-chip.on{background:var(--lime);border-color:var(--lime);color:#000}',
'.mk2-chip.reset{color:var(--danger);border-color:var(--danger)}',
'.mk2-chip i{font-style:normal;display:inline-flex;align-items:center;justify-content:center;min-width:17px;height:17px;',
  'padding:0 4px;border-radius:9px;background:#000;color:var(--lime);font-size:10.5px;font-weight:800}',
'.mk2-chip.on i{background:#000;color:var(--lime)}',

/* --- сетка карточек --- */
'.mk2-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}',
'@media(min-width:560px){.mk2-grid{grid-template-columns:repeat(3,minmax(0,1fr))}}',
'@media(min-width:980px){.mk2-grid{grid-template-columns:repeat(4,minmax(0,1fr))}}',
'.mk2-card{position:relative;display:flex;flex-direction:column;text-align:left;border-radius:var(--mk-r);overflow:hidden;',
  'background:var(--surface);border:1px solid var(--border);transition:border-color .16s,transform .12s}',
'.mk2-card:active{transform:scale(.985)}',
'.mk2-card:hover{border-color:var(--accent)}',
'.mk2-ph{position:relative;aspect-ratio:1/1;background:var(--raised);display:flex;align-items:center;justify-content:center;overflow:hidden}',
'.mk2-ph img{width:100%;height:100%;object-fit:cover;display:block}',
'.mk2-ph-empty{display:flex;flex-direction:column;align-items:center;gap:6px;color:var(--dim)}',
'.mk2-ph-empty svg.i{width:26px;height:26px;color:var(--accent);opacity:.7}',
'.mk2-ph-empty span{font-size:9.5px;letter-spacing:.06em;text-transform:uppercase;font-weight:700}',
'.mk2-ph-n{position:absolute;left:8px;bottom:8px;display:inline-flex;align-items:center;gap:4px;height:20px;padding:0 7px;',
  'border-radius:7px;background:rgba(0,0,0,.62);color:#fff;font-size:10.5px;font-weight:700}',
'.mk2-cb{padding:9px 10px 11px;display:flex;flex-direction:column;gap:4px}',
'.mk2-price{font-size:15px;font-weight:800;letter-spacing:.01em;line-height:1.2;color:var(--text)}',
'.mk2-ct{font-size:12.5px;line-height:1.32;color:var(--text);display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}',
'.mk2-cm{font-size:10.5px;line-height:1.35;color:var(--dim);display:flex;flex-wrap:wrap;gap:3px 7px;align-items:center}',
'.mk2-cm span{display:inline-flex;align-items:center;gap:3px}',
'.mk2-cm svg.i{width:.95em;height:.95em}',
'.mk2-favbtn{position:absolute;right:7px;top:7px;width:31px;height:31px;border-radius:50%;background:rgba(0,0,0,.5);',
  'color:#fff;display:flex;align-items:center;justify-content:center;z-index:2;backdrop-filter:blur(4px)}',
'.mk2-favbtn.on{background:var(--lime);color:#000}',
':root[data-theme="light"] .mk2-favbtn{background:rgba(255,255,255,.82);color:#333;box-shadow:0 1px 4px rgba(0,0,0,.14)}',
':root[data-theme="light"] .mk2-favbtn.on{background:var(--accent);color:#fff}',

/* --- статусы --- */
'.mk2-badge{display:inline-flex;align-items:center;gap:4px;height:19px;padding:0 7px;border-radius:7px;font-size:10px;',
  'font-weight:800;letter-spacing:.03em;white-space:nowrap}',
'.mk2-badge.ok{background:var(--lime-dim);color:var(--accent)}',
'.mk2-badge.mod{background:rgba(255,180,0,.16);color:#e0a300}',
'.mk2-badge.draft{background:var(--raised);color:var(--dim)}',
'.mk2-badge.arch{background:var(--raised);color:var(--dim)}',
'.mk2-badge.warn{background:rgba(255,77,77,.14);color:var(--danger)}',

/* --- пустые состояния --- */
'.mk2-empty{border:1px dashed var(--border);border-radius:20px;padding:26px 20px;text-align:center;background:var(--surface)}',
'.mk2-empty-ic{width:56px;height:56px;margin:0 auto 14px;border-radius:18px;background:var(--lime-dim);color:var(--accent);',
  'display:flex;align-items:center;justify-content:center}',
'.mk2-empty-ic svg.i{width:26px;height:26px}',
'.mk2-empty h4{font-family:var(--font-display);font-size:23px;letter-spacing:.04em;margin:0 0 8px;line-height:1.1;color:var(--text)}',
'.mk2-empty p{font-size:13px;line-height:1.55;color:var(--dim);margin:0 auto 16px;max-width:420px}',
'.mk2-empty .mk2-btn{max-width:320px;margin:0 auto}',
'.mk2-empty-row{display:flex;flex-direction:column;gap:9px;align-items:center}',
'.mk2-empty-row>*{width:100%;max-width:320px}',

/* --- карточка объявления --- */
'.mk2-gal{position:relative;border-radius:18px;overflow:hidden;background:var(--raised);border:1px solid var(--border)}',
'.mk2-galtrack{display:flex;overflow-x:auto;scroll-snap-type:x mandatory;scrollbar-width:none;-webkit-overflow-scrolling:touch}',
'.mk2-galtrack::-webkit-scrollbar{height:0}',
'.mk2-galtrack>div{flex:0 0 100%;scroll-snap-align:center;aspect-ratio:4/3;display:flex;align-items:center;justify-content:center;overflow:hidden}',
'.mk2-galtrack img{width:100%;height:100%;object-fit:cover;display:block}',
'.mk2-galdots{position:absolute;left:0;right:0;bottom:10px;display:flex;justify-content:center;gap:5px;pointer-events:none}',
'.mk2-galdots i{width:6px;height:6px;border-radius:50%;background:rgba(255,255,255,.42)}',
'.mk2-galdots i.on{background:var(--lime);width:16px;border-radius:3px}',
'.mk2-galcount{position:absolute;right:10px;top:10px;height:22px;padding:0 8px;border-radius:8px;background:rgba(0,0,0,.6);',
  'color:#fff;font-size:11px;font-weight:700;display:flex;align-items:center;gap:4px}',
'.mk2-iprice{font-family:var(--font-display);font-size:36px;letter-spacing:.02em;line-height:1.05;margin:16px 0 6px;color:var(--text)}',
'.mk2-ititle{font-size:17px;font-weight:700;line-height:1.34;margin:0 0 10px;color:var(--text)}',
'.mk2-tags{display:flex;flex-wrap:wrap;gap:6px;margin:0 0 14px}',
'.mk2-tag{display:inline-flex;align-items:center;gap:5px;height:27px;padding:0 10px;border-radius:9px;background:var(--raised);',
  'border:1px solid var(--border);color:var(--dim);font-size:11.5px;font-weight:600}',
'.mk2-tag svg.i{width:1em;height:1em;color:var(--accent)}',
'.mk2-block{background:var(--surface);border:1px solid var(--border);border-radius:16px;padding:15px;margin:0 0 12px}',
'.mk2-block h4{font-family:var(--font-display);font-size:19px;letter-spacing:.045em;margin:0 0 10px;line-height:1.1;color:var(--text)}',
'.mk2-desc{font-size:13.5px;line-height:1.6;color:var(--text);white-space:pre-wrap;margin:0}',
'.mk2-specs{display:flex;flex-direction:column;gap:0}',
'.mk2-spec{display:flex;gap:10px;padding:9px 0;border-bottom:1px solid var(--border);font-size:12.5px;line-height:1.45}',
'.mk2-spec:last-child{border-bottom:0;padding-bottom:0}',
'.mk2-spec b{flex:0 0 42%;color:var(--dim);font-weight:600}',
'.mk2-spec span{flex:1 1 auto;color:var(--text);font-weight:600}',
'.mk2-seller{display:flex;align-items:center;gap:12px}',
'.mk2-ava{width:48px;height:48px;flex:0 0 auto;border-radius:15px;background:var(--lime-dim);color:var(--accent);',
  'display:flex;align-items:center;justify-content:center;font-family:var(--font-display);font-size:23px;letter-spacing:.04em}',
'.mk2-seller-b{display:flex;flex-direction:column;gap:3px;min-width:0}',
'.mk2-seller-b b{font-size:14px;font-weight:700;line-height:1.3;display:flex;align-items:center;gap:5px;flex-wrap:wrap}',
'.mk2-seller-b b svg.i{color:var(--accent);width:1em;height:1em}',
'.mk2-seller-b small{font-size:11.5px;color:var(--dim);line-height:1.4}',
'.mk2-stats{display:flex;flex-wrap:wrap;gap:8px;margin:0 0 12px}',
'.mk2-stat{flex:1 1 90px;background:var(--surface);border:1px solid var(--border);border-radius:13px;padding:11px 12px;',
  'display:flex;flex-direction:column;gap:3px}',
'.mk2-stat b{font-family:var(--font-display);font-size:22px;letter-spacing:.03em;line-height:1;color:var(--text)}',
'.mk2-stat small{font-size:10.5px;color:var(--dim);line-height:1.3}',
'.mk2-note{display:flex;gap:9px;align-items:flex-start;padding:12px 13px;border-radius:13px;background:var(--raised);',
  'border:1px solid var(--border);font-size:12px;line-height:1.5;color:var(--dim);margin:0 0 12px}',
'.mk2-note svg.i{color:var(--accent);flex:0 0 auto;margin-top:1px}',
'.mk2-note.warn{border-color:var(--danger)}',
'.mk2-note.warn svg.i{color:var(--danger)}',
'.mk2-contact{display:flex;flex-direction:column;gap:7px;margin-top:10px}',
'.mk2-contact a,.mk2-contact div{display:flex;align-items:center;gap:8px;padding:11px 12px;border-radius:12px;background:var(--raised);',
  'border:1px solid var(--border);color:var(--text);font-size:13px;font-weight:600;text-decoration:none;line-height:1.4}',
'.mk2-contact svg.i{color:var(--accent);flex:0 0 auto}',

/* --- вкладки --- */
'.mk2-tabs{display:flex;gap:6px;overflow-x:auto;padding:3px;border-radius:13px;background:var(--raised);',
  'border:1px solid var(--border);margin:0 0 14px;scrollbar-width:none}',
'.mk2-tabs::-webkit-scrollbar{height:0}',
'.mk2-tabs button{flex:1 1 auto;white-space:nowrap;padding:9px 12px;border-radius:10px;color:var(--dim);font-size:12.5px;',
  'font-weight:700;display:inline-flex;align-items:center;justify-content:center;gap:6px;line-height:1.25}',
'.mk2-tabs button.on{background:var(--lime);color:#000}',
'.mk2-tabs button i{font-style:normal;font-size:11px;opacity:.75}',

/* --- строки «мои объявления» --- */
'.mk2-row{display:flex;gap:11px;padding:11px;border-radius:15px;background:var(--surface);border:1px solid var(--border);margin:0 0 10px}',
'.mk2-row-ph{width:76px;height:76px;flex:0 0 auto;border-radius:12px;overflow:hidden;background:var(--raised);',
  'display:flex;align-items:center;justify-content:center;color:var(--accent)}',
'.mk2-row-ph img{width:100%;height:100%;object-fit:cover;display:block}',
'.mk2-row-b{flex:1 1 auto;display:flex;flex-direction:column;gap:5px;min-width:0}',
'.mk2-row-t{font-size:13px;font-weight:700;line-height:1.34;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}',
'.mk2-row-p{font-size:14px;font-weight:800;line-height:1.2}',
'.mk2-row-m{display:flex;flex-wrap:wrap;gap:4px 9px;font-size:10.5px;color:var(--dim);align-items:center}',
'.mk2-row-m span{display:inline-flex;align-items:center;gap:3px}',
'.mk2-row-m svg.i{width:.95em;height:.95em}',
'.mk2-acts{display:flex;flex-wrap:wrap;gap:6px;margin-top:8px}',
'.mk2-act{display:inline-flex;align-items:center;gap:5px;height:31px;padding:0 11px;border-radius:10px;background:var(--raised);',
  'border:1px solid var(--border);color:var(--text);font-size:11.5px;font-weight:700;line-height:1.2}',
'.mk2-act svg.i{width:1em;height:1em;color:var(--accent)}',
'.mk2-act.danger{color:var(--danger)}',
'.mk2-act.danger svg.i{color:var(--danger)}',
'.mk2-act.primary{background:var(--lime);border-color:var(--lime);color:#000}',
'.mk2-act.primary svg.i{color:#000}',

/* --- мастер размещения --- */
'.mk2-steps{display:flex;gap:4px;margin:0 0 6px}',
'.mk2-steps i{flex:1 1 auto;height:4px;border-radius:2px;background:var(--border)}',
'.mk2-steps i.on{background:var(--lime)}',
'.mk2-stepnum{font-size:11.5px;color:var(--dim);font-weight:700;letter-spacing:.04em;margin:0 0 14px}',
'.mk2-field{margin:0 0 14px}',
'.mk2-lab{display:block;font-size:12px;font-weight:700;color:var(--dim);margin:0 0 7px;line-height:1.4}',
'.mk2-hint{font-size:11.5px;color:var(--dim);line-height:1.5;margin:6px 0 0}',
'.mk2-inp,.mk2-ta,.mk2-sel{width:100%;background:var(--raised);border:1px solid var(--border);border-radius:12px;',
  'padding:12px 13px;color:var(--text);font-size:14px;font-family:var(--font-body);outline:none;transition:border-color .16s}',
'.mk2-inp:focus,.mk2-ta:focus,.mk2-sel:focus{border-color:var(--accent)}',
'.mk2-ta{resize:vertical;min-height:120px;line-height:1.55}',
'.mk2-sel{appearance:none;-webkit-appearance:none;background-image:none}',
'.mk2-cnt{font-size:11px;color:var(--dim);text-align:right;margin-top:5px}',
'.mk2-cnt.bad{color:var(--danger)}',
'.mk2-opts{display:flex;flex-wrap:wrap;gap:7px}',
'.mk2-opt{display:inline-flex;align-items:center;gap:6px;padding:9px 13px;border-radius:11px;background:var(--raised);',
  'border:1px solid var(--border);color:var(--text);font-size:12.5px;font-weight:600;line-height:1.3}',
'.mk2-opt.on{background:var(--lime);border-color:var(--lime);color:#000}',
'.mk2-drop{display:flex;flex-direction:column;align-items:center;gap:9px;padding:24px 16px;border-radius:16px;',
  'border:1px dashed var(--border);background:var(--surface);color:var(--dim);text-align:center;width:100%}',
'.mk2-drop svg.i{width:26px;height:26px;color:var(--accent)}',
'.mk2-drop b{font-size:13px;color:var(--text);font-weight:700}',
'.mk2-drop small{font-size:11.5px;line-height:1.45}',
'.mk2-photos{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px;margin:12px 0 0}',
'@media(min-width:560px){.mk2-photos{grid-template-columns:repeat(6,minmax(0,1fr))}}',
'.mk2-pcell{position:relative;aspect-ratio:1/1;border-radius:12px;overflow:hidden;background:var(--raised);border:1px solid var(--border)}',
'.mk2-pcell img{width:100%;height:100%;object-fit:cover;display:block}',
'.mk2-pdel{position:absolute;right:4px;top:4px;width:24px;height:24px;border-radius:50%;background:rgba(0,0,0,.62);color:#fff;',
  'display:flex;align-items:center;justify-content:center}',
'.mk2-pmain{position:absolute;left:4px;bottom:4px;height:18px;padding:0 6px;border-radius:6px;background:var(--lime);color:#000;',
  'font-size:9.5px;font-weight:800;display:flex;align-items:center}',
'.mk2-specrow{display:flex;gap:7px;margin:0 0 8px}',
'.mk2-specrow .mk2-inp{flex:1 1 0}',
'.mk2-specdel{width:42px;flex:0 0 auto;border-radius:12px;background:var(--raised);border:1px solid var(--border);',
  'color:var(--danger);display:flex;align-items:center;justify-content:center}',
'.mk2-nav{display:flex;gap:9px;margin-top:20px}',
'.mk2-nav>*{flex:1 1 0}',
'.mk2-err{display:flex;gap:8px;align-items:flex-start;padding:11px 12px;border-radius:12px;background:rgba(255,77,77,.1);',
  'border:1px solid var(--danger);color:var(--danger);font-size:12px;line-height:1.5;margin:0 0 12px}',
'.mk2-err svg.i{flex:0 0 auto;margin-top:1px}',

/* --- шторка --- */
'#sheet-mk3 h3{font-family:var(--font-display);font-size:25px;letter-spacing:.04em;margin:2px 0 14px;line-height:1.1}',
'#sheet-mk3 .mk2-lab{margin-top:14px}',
'.mk2-prange{display:flex;align-items:center;gap:9px}',
'.mk2-prange .mk2-inp{flex:1 1 0}',
'.mk2-prange span{color:var(--dim);flex:0 0 auto}',
'.mk2-sheetlist button{display:flex;align-items:center;gap:11px;width:100%;padding:13px 12px;border-radius:12px;',
  'color:var(--text);font-size:13.5px;font-weight:600;text-align:left;line-height:1.4}',
'.mk2-sheetlist button:hover{background:var(--raised)}',
'.mk2-sheetlist button.on{background:var(--lime-dim);color:var(--accent)}',
'.mk2-sheetlist svg.i{color:var(--dim);flex:0 0 auto}',
'.mk2-sheetlist button.on svg.i{color:var(--accent)}',
'.mk2-steplist{counter-reset:mk2s;display:flex;flex-direction:column;gap:11px;margin:0 0 4px}',
'.mk2-steplist li{display:flex;gap:11px;font-size:12.5px;line-height:1.5;color:var(--dim);list-style:none}',
'.mk2-steplist li b{display:flex;align-items:center;justify-content:center;flex:0 0 auto;width:23px;height:23px;border-radius:8px;',
  'background:var(--lime-dim);color:var(--accent);font-size:11.5px;font-weight:800}',
'.mk2-steplist li span{color:var(--text)}',
'.mk2-sheetfoot{display:flex;gap:9px;margin-top:18px}',
'.mk2-sheetfoot>*{flex:1 1 0}',
'.mk2-linkbox{padding:12px;border-radius:12px;background:var(--raised);border:1px solid var(--border);font-size:12px;',
  'line-height:1.5;color:var(--text);overflow-wrap:anywhere;margin:0 0 12px}',
'.mk2-foot{margin-top:22px;padding-top:16px;border-top:1px solid var(--border);font-size:11.5px;line-height:1.55;color:var(--dim)}'
].join('');

function injectCSS() {
  if (document.getElementById('oko-market-css')) return;
  var st = document.createElement('style');
  st.id = 'oko-market-css';
  st.textContent = CSS;
  document.head.appendChild(st);
}

/* ============================== 9. РАЗМЕТКА =============================== */

function ph(l, big) {
  var c = cat(l.cat);
  if (l.photos && l.photos.length) {
    return '<img src="' + att(l.photos[0]) + '" alt="' + att(l.title) + '" loading="lazy">' +
      (l.photos.length > 1 ? '<span class="mk2-ph-n">' + SVG('photo') + l.photos.length + '</span>' : '');
  }
  return '<span class="mk2-ph-empty">' + SVG(c.ic) + '<span>' + esc(c.s) + '</span></span>';
}

function cardHTML(l) {
  var c = cat(l.cat);
  var fav = S.favs.indexOf(l.id) >= 0;
  var place = l.remote ? 'Удалённо' : (l.city || 'Не указан');
  return '<button class="mk2-card" data-mkact="open" data-id="' + att(l.id) + '" data-mk="card">' +
    '<span class="mk2-ph">' + ph(l) + '</span>' +
    '<span class="mk2-cb">' +
      '<span class="mk2-price">' + esc(priceText(l)) + '</span>' +
      '<span class="mk2-ct">' + esc(l.title) + '</span>' +
      '<span class="mk2-cm">' +
        '<span>' + SVG('pos') + esc(place) + '</span>' +
        '<span>' + SVG(c.ic) + esc(c.s) + '</span>' +
      '</span>' +
    '</span>' +
    '</button>' +
    '<button class="mk2-favbtn' + (fav ? ' on' : '') + '" data-mkact="fav" data-id="' + att(l.id) + '" data-mk="fav-toggle" ' +
      'aria-label="' + (fav ? 'Убрать из избранного' : 'В избранное') + '" title="' + (fav ? 'Убрать из избранного' : 'В избранное') + '">' +
      SVG('heart') + '</button>';
}
function gridHTML(arr) {
  return '<div class="mk2-grid">' + arr.map(function (l) {
    return '<div style="position:relative;display:flex">' + cardHTML(l) + '</div>';
  }).join('') + '</div>';
}

function emptyHTML(o) {
  return '<div class="mk2-empty">' +
    '<div class="mk2-empty-ic">' + SVG(o.ic || 'briefcase') + '</div>' +
    '<h4>' + esc(o.h) + '</h4>' +
    '<p>' + o.p + '</p>' +
    (o.actions ? '<div class="mk2-empty-row">' + o.actions + '</div>' : '') +
    '</div>';
}

function chipsHTML() {
  var fc = filtersCount();
  var sortName = (SORTS.filter(function (s) { return s[0] === F.sort; })[0] || SORTS[0])[1];
  var out = [];
  out.push('<button class="mk2-chip' + (fc ? ' on' : '') + '" data-mkact="filters" data-mk="filters">' + SVG('mk-filter') +
    'Фильтры' + (fc ? '<i>' + fc + '</i>' : '') + '</button>');
  out.push('<button class="mk2-chip" data-mkact="sortsheet">' + SVG('mk-sort') + esc(sortName) + '</button>');
  out.push('<button class="mk2-chip' + (F.min !== '' || F.max !== '' ? ' on' : '') + '" data-mkact="filters" data-val="price">' +
    SVG('mk-tag') + (F.min !== '' || F.max !== '' ?
      esc((F.min !== '' ? 'от ' + num(F.min) : '') + (F.max !== '' ? (F.min !== '' ? ' ' : '') + 'до ' + num(F.max) : '') + ' ₽') : 'Цена') + '</button>');
  out.push('<button class="mk2-chip' + (F.remote ? ' on' : '') + '" data-mkact="toggle" data-val="remote">' + SVG('globe') + 'Удалённо</button>');
  out.push('<button class="mk2-chip' + (F.city ? ' on' : '') + '" data-mkact="filters" data-val="city">' + SVG('pos') +
    (F.city ? esc(F.city) : 'Город') + '</button>');
  out.push('<button class="mk2-chip' + (F.rating ? ' on' : '') + '" data-mkact="filters" data-val="rating">' + SVG('star') +
    (F.rating ? 'от ' + F.rating : 'Рейтинг') + '</button>');
  out.push('<button class="mk2-chip' + (F.term ? ' on' : '') + '" data-mkact="filters" data-val="term">' + SVG('clock') +
    (F.term ? esc(F.term) : 'Срок') + '</button>');
  out.push('<button class="mk2-chip' + (F.verified ? ' on' : '') + '" data-mkact="toggle" data-val="verified">' + SVG('verified') + 'Проверенные</button>');
  if (fc) out.push('<button class="mk2-chip reset" data-mkact="resetf">' + SVG('x') + 'Сбросить</button>');
  return '<div class="mk2-chips">' + out.join('') + '</div>';
}

function searchHTML(placeholder) {
  return '<div class="mk2-searchwrap">' +
    '<div class="mk2-search">' + SVG('search') +
      '<input id="mk2q" type="search" inputmode="search" autocomplete="off" data-mkinput="q" ' +
        'value="' + att(F.q) + '" placeholder="' + att(placeholder || 'Поиск услуг, специалистов и товаров') + '" aria-label="Поиск по бирже">' +
      (F.q ? '<button class="mk2-searchclr" data-mkact="clearq" aria-label="Очистить">' + SVG('x') + '</button>' : '') +
    '</div>' +
    '<div id="mk2sug"></div>' +
  '</div>';
}

/* ============================== 10. ЭКРАНЫ ================================ */

function pageHome() {
  var all = catalog();
  var res = applyQuery(all);
  var mine = S.listings.length;
  var favN = S.favs.length;
  var respN = S.listings.reduce(function (a, l) { return a + ((l.responses || []).length); }, 0);
  var histN = S.history.length;

  var h = '';
  h += searchHTML();

  h += '<div class="mk2-quick">' +
    qt('briefcase', 'Мои объявления', mine ? mine + ' ' + plural(mine, 'объявление', 'объявления', 'объявлений') : 'Пока ни одного', 'mine', 'mine') +
    qt('heart', 'Избранное', favN ? favN + ' ' + plural(favN, 'карточка', 'карточки', 'карточек') : 'Пусто', 'fav', 'fav') +
    qt('swap', 'Отклики и сделки', respN + S.deals.length ? (respN + S.deals.length) + ' ' + plural(respN + S.deals.length, 'запись', 'записи', 'записей') : 'Пока пусто', 'deals', 'deals') +
    qt('clock', 'История просмотров', histN ? histN + ' ' + plural(histN, 'карточка', 'карточки', 'карточек') : 'Пусто', 'history', 'history') +
    '</div>';

  h += '<button class="mk2-btn" data-mkact="create" data-mk="create">' + SVG('plus') + 'Разместить объявление</button>';

  h += '<div class="mk2-sech"><h3>Категории</h3>' +
    (F.cat ? '<button data-mkact="setcat" data-val="">Сбросить</button>' : '') + '</div>';
  h += '<div class="mk2-rail">' + CATS.map(function (c) {
    var n = all.filter(function (l) { return l.cat === c.k; }).length;
    return '<button class="mk2-cat' + (F.cat === c.k ? ' on' : '') + '" data-mkact="cat" data-val="' + c.k + '">' +
      '<span class="mk2-cat-ic">' + SVG(c.ic) + '</span><b>' + esc(c.s) + '</b><i>' + n + '</i></button>';
  }).join('') + '</div>';

  h += '<div class="mk2-sech"><h3>' + (F.q ? 'Результаты' : 'Объявления') + '</h3>' +
    '<button data-mkact="allcats">Все категории</button></div>';
  h += chipsHTML();

  if (res.length) {
    h += '<p class="mk2-sub" style="margin:2px 0 10px">' + res.length + ' ' +
      plural(res.length, 'объявление', 'объявления', 'объявлений') + ' в каталоге</p>';
    h += gridHTML(res);
  } else if (all.length) {
    h += emptyHTML({
      ic: 'search', h: 'Ничего не нашлось',
      p: 'По этому запросу и фильтрам в каталоге пусто. Измени запрос или сбрось фильтры — объявления никуда не делись.',
      actions: '<button class="mk2-btn ghost" data-mkact="resetall">' + SVG('refresh') + 'Сбросить поиск и фильтры</button>'
    });
  } else {
    h += emptyHTML({
      ic: 'briefcase', h: 'Каталог биржи пуст',
      p: 'Здесь нет ни одного выдуманного объявления — <b>OKO не показывает демо-данные</b>. Биржа наполняется тем, что размещают живые люди. Разместись первым: услуга, товар или вакансия появятся в каталоге сразу.',
      actions: '<button class="mk2-btn" data-mkact="create" data-mk="create">' + SVG('plus') + 'Разместить объявление</button>' +
        '<button class="mk2-btn ghost" data-mkact="how">' + SVG('info') + 'Как работает биржа OKO</button>'
    });
  }

  h += footHTML();
  return { title: 'Биржа OKO', sub: 'Услуги, специалисты и товары для медиа, контента и маркетинга', html: h, root: true };
}

function qt(ic, t, s, act, mk) {
  return '<button class="mk2-qt" data-mkact="' + act + '" data-mk="' + mk + '">' +
    '<span class="mk2-qt-ic">' + SVG(ic) + '</span>' +
    '<span class="mk2-qt-b"><b>' + esc(t) + '</b><small>' + esc(s) + '</small></span></button>';
}

function footHTML() {
  return '<p class="mk2-foot">' + SVG('shield') + ' Биржа пока работает на этом устройстве: объявления сохраняются локально ' +
    'и видны только тебе. Когда подключим сервер OKO, каталог станет общим, а отклики и сделки — сквозными.</p>';
}

function pageList(st) {
  var c = st.cat ? cat(st.cat) : null;
  F.cat = st.cat || '';
  var res = applyQuery(catalog());
  var h = '';
  h += searchHTML(c ? 'Поиск в разделе «' + c.n + '»' : 'Поиск по бирже');
  h += chipsHTML();
  if (res.length) {
    h += '<p class="mk2-sub" style="margin:2px 0 12px">' + res.length + ' ' +
      plural(res.length, 'объявление', 'объявления', 'объявлений') + '</p>';
    h += gridHTML(res);
  } else {
    h += emptyHTML({
      ic: c ? c.ic : 'search',
      h: 'В разделе пока пусто',
      p: c ? 'В категории «' + esc(c.n) + '» ещё нет объявлений. Демо-карточек OKO не рисует — раздел заполнится, когда сюда разместятся специалисты. Можешь быть первым.'
           : 'По запросу ничего не нашлось. Измени формулировку или сбрось фильтры.',
      actions: '<button class="mk2-btn" data-mkact="createcat" data-val="' + (st.cat || '') + '">' + SVG('plus') + 'Разместить здесь</button>' +
        (filtersCount() || F.q ? '<button class="mk2-btn ghost" data-mkact="resetall">' + SVG('refresh') + 'Сбросить фильтры</button>' : '')
    });
  }
  return { title: c ? c.n : 'Поиск по бирже', sub: c ? 'Раздел биржи OKO' : (F.q ? 'Запрос: ' + esc(F.q) : ''), html: h };
}

function pageAllCats() {
  var all = catalog();
  var h = '<div class="mk2-catgrid">' + CATS.map(function (c) {
    var n = all.filter(function (l) { return l.cat === c.k; }).length;
    return '<button class="mk2-catrow" data-mkact="cat" data-val="' + c.k + '">' +
      '<span class="mk2-cat-ic">' + SVG(c.ic) + '</span>' +
      '<span><b>' + esc(c.n) + '</b><small>' + n + ' ' + plural(n, 'объявление', 'объявления', 'объявлений') + '</small></span></button>';
  }).join('') + '</div>';
  h += '<div style="margin-top:16px"><button class="mk2-btn" data-mkact="create">' + SVG('plus') + 'Разместить объявление</button></div>';
  return { title: 'Все категории', sub: '12 разделов биржи OKO', html: h };
}

function pageItem(st) {
  var l = find(st.id);
  if (!l) {
    return { title: 'Объявление', html: emptyHTML({
      ic: 'warning', h: 'Объявление не найдено',
      p: 'Похоже, оно удалено. Вернись в каталог и выбери другое.',
      actions: '<button class="mk2-btn" data-mkact="home">' + SVG('back') + 'В каталог</button>'
    }) };
  }
  var c = cat(l.cat);
  var u = me();
  var fav = S.favs.indexOf(l.id) >= 0;
  var isMine = !!l.mine;
  var resp = (l.responses || []).length;
  var deals = S.deals.filter(function (d) { return d.listingId === l.id; });
  var h = '';

  /* галерея */
  if (l.photos && l.photos.length) {
    h += '<div class="mk2-gal"><div class="mk2-galtrack" id="mk2gal">' +
      l.photos.map(function (p, i) { return '<div><img src="' + att(p) + '" alt="Фото ' + (i + 1) + '"></div>'; }).join('') +
      '</div>' +
      (l.photos.length > 1 ? '<div class="mk2-galdots" id="mk2dots">' +
        l.photos.map(function (_, i) { return '<i class="' + (i === 0 ? 'on' : '') + '"></i>'; }).join('') + '</div>' : '') +
      '<div class="mk2-galcount">' + SVG('photo') + '1 / ' + l.photos.length + '</div>' +
      '</div>';
  } else {
    h += '<div class="mk2-gal"><div class="mk2-galtrack"><div><span class="mk2-ph-empty">' +
      SVG(c.ic) + '<span>без фото</span></span></div></div></div>';
  }

  if (l.status !== 'active') {
    var stt = STATUS[l.status] || STATUS.draft;
    h += '<div style="margin-top:12px"><span class="mk2-badge ' + stt.c + '">' + esc(stt.n) + '</span></div>';
  }

  h += '<div class="mk2-iprice">' + esc(priceText(l)) + '</div>';
  h += '<h3 class="mk2-ititle">' + esc(l.title) + '</h3>';

  h += '<div class="mk2-tags">' +
    '<span class="mk2-tag">' + SVG(c.ic) + esc(c.n) + '</span>' +
    '<span class="mk2-tag">' + SVG(l.remote ? 'globe' : 'pos') + esc(l.remote ? 'Удалённо' : (l.city || 'Город не указан')) + '</span>' +
    (l.term ? '<span class="mk2-tag">' + SVG('clock') + esc(l.term) + '</span>' : '') +
    '<span class="mk2-tag">' + SVG('mk-tag') + esc((KINDS.filter(function (k) { return k.k === l.kind; })[0] || KINDS[0]).n) + '</span>' +
    '<span class="mk2-tag">' + SVG('bell') + esc(dateShort(l.publishedAt || l.createdAt)) + '</span>' +
    '</div>';

  if (l.status === 'moderation' && l.modReason) {
    h += '<div class="mk2-note warn">' + SVG('warning') + '<span><b>Автопроверка OKO не пропустила объявление.</b><br>' +
      esc(l.modReason) + ' Поправь текст и опубликуй заново — проверка запустится снова.</span></div>';
  }

  h += '<div class="mk2-block"><h4>Описание</h4><p class="mk2-desc">' + esc(l.desc) + '</p></div>';

  if (l.specs && l.specs.length) {
    h += '<div class="mk2-block"><h4>Характеристики</h4><div class="mk2-specs">' +
      l.specs.map(function (s) { return '<div class="mk2-spec"><b>' + esc(s.k) + '</b><span>' + esc(s.v) + '</span></div>'; }).join('') +
      '</div></div>';
  }

  /* продавец */
  var sinceTxt = l.sellerSince ? dateMonth(l.sellerSince) : dateMonth(l.createdAt);
  var doneDeals = S.deals.filter(function (d) { return d.status === 'done'; }).length;
  h += '<div class="mk2-block">' +
    '<div class="mk2-seller">' +
      '<div class="mk2-ava">' + esc(initial(l.sellerName)) + '</div>' +
      '<div class="mk2-seller-b">' +
        '<b>' + esc(l.sellerName) + (l.sellerVerified ? SVG('verified') : '') + '</b>' +
        '<small>' + (l.rating ? SVG('star') + ' ' + l.rating.toFixed(1) + ' · ' + (l.reviews || 0) + ' ' +
            plural(l.reviews || 0, 'отзыв', 'отзыва', 'отзывов')
          : 'Пока без отзывов — рейтинг появится после первых сделок') + '</small>' +
        '<small>На бирже с ' + esc(sinceTxt) + ' · ' + doneDeals + ' ' + plural(doneDeals, 'сделка', 'сделки', 'сделок') + ' завершено</small>' +
      '</div>' +
    '</div>' +
    (isMine ? '' :
      '<div style="margin-top:12px"><button class="mk2-btn ghost sm" style="width:100%" data-mkact="contacts" data-id="' + att(l.id) + '">' +
        SVG('phone') + 'Показать контакты</button></div>') +
    (revealed[l.id] ? contactsHTML(l) : '') +
    '</div>';

  /* счётчики */
  h += '<div class="mk2-stats">' +
    stat(l.views || 0, 'просмотров карточки') +
    stat(favCount(l.id), 'в избранном') +
    stat(resp, 'откликов') +
    stat(deals.length, 'сделок по объявлению') +
    '</div>';

  /* действия */
  if (isMine) {
    h += '<div class="mk2-note">' + SVG('info') + '<span>Это твоё объявление. Кнопки покупателя («Написать», «Безопасная сделка») ' +
      'появляются у других людей — тебе доступно управление.</span></div>';
    h += '<div class="mk2-btnrow">' +
      '<button class="mk2-btn" data-mkact="edit" data-id="' + att(l.id) + '" data-mk="edit">' + SVG('edit') + 'Редактировать</button>' +
      (l.status === 'active'
        ? '<button class="mk2-btn ghost" data-mkact="bump" data-id="' + att(l.id) + '">' + SVG('arrow-up') + 'Поднять в каталоге</button>'
        : '<button class="mk2-btn ghost" data-mkact="publish" data-id="' + att(l.id) + '">' + SVG('rocket') + 'Опубликовать</button>') +
      '</div>';
    h += '<div class="mk2-btnrow">' +
      '<button class="mk2-btn ghost" data-mkact="fav" data-id="' + att(l.id) + '" data-mk="fav-toggle">' + SVG('heart') +
        (fav ? 'В избранном' : 'В избранное') + '</button>' +
      (l.status === 'active'
        ? '<button class="mk2-btn ghost" data-mkact="archive" data-id="' + att(l.id) + '" data-mk="unpublish">' + SVG('mk-archive') + 'Снять с публикации</button>'
        : '<button class="mk2-btn ghost" data-mkact="draft" data-id="' + att(l.id) + '">' + SVG('file') + 'Убрать в черновики</button>') +
      '</div>';
    h += '<div class="mk2-btnrow">' +
      '<button class="mk2-btn ghost" data-mkact="share" data-id="' + att(l.id) + '">' + SVG('share') + 'Поделиться</button>' +
      '<button class="mk2-btn ghost" data-mkact="copylink" data-id="' + att(l.id) + '">' + SVG('copy') + 'Скопировать ссылку</button>' +
      '</div>';
    h += '<div class="mk2-btnrow">' +
      '<button class="mk2-btn danger" data-mkact="askdel" data-id="' + att(l.id) + '" data-mk="delete">' + SVG('trash') + 'Удалить объявление</button>' +
      '</div>';
  } else {
    h += '<div class="mk2-btnrow">' +
      '<button class="mk2-btn" data-mkact="write" data-id="' + att(l.id) + '">' + SVG('chat') + 'Написать</button>' +
      '<button class="mk2-btn ghost" data-mkact="fav" data-id="' + att(l.id) + '" data-mk="fav-toggle">' + SVG('heart') +
        (fav ? 'В избранном' : 'В избранное') + '</button>' +
      '</div>';
    h += '<div style="margin-top:10px"><button class="mk2-btn lime-ghost" data-mkact="deal" data-id="' + att(l.id) + '">' +
      SVG('shield') + 'Безопасная сделка OKO</button></div>';
    h += '<div class="mk2-btnrow">' +
      '<button class="mk2-btn ghost" data-mkact="share" data-id="' + att(l.id) + '">' + SVG('share') + 'Поделиться</button>' +
      '<button class="mk2-btn ghost" data-mkact="copylink" data-id="' + att(l.id) + '">' + SVG('copy') + 'Скопировать ссылку</button>' +
      '</div>';
    h += '<div class="mk2-btnrow">' +
      '<button class="mk2-btn ghost" data-mkact="report" data-id="' + att(l.id) + '">' + SVG('flag') + 'Пожаловаться</button>' +
      '</div>';
  }

  /* похожие */
  var similar = catalog().filter(function (x) { return x.id !== l.id && x.cat === l.cat; }).slice(0, 8);
  if (similar.length) {
    h += '<div class="mk2-sech"><h3>Похожие объявления</h3></div>' + gridHTML(similar);
  } else {
    h += '<div class="mk2-sech"><h3>Похожие объявления</h3></div>' +
      '<div class="mk2-note">' + SVG('info') + '<span>В категории «' + esc(c.n) + '» это единственное объявление. ' +
      'Похожие появятся, когда сюда разместятся другие специалисты — выдуманных карточек OKO не показывает.</span></div>';
  }

  return { title: 'Объявление', sub: esc(c.n), html: h, backLabel: 'Назад' };
}

function stat(v, t) {
  return '<div class="mk2-stat"><b>' + num(v) + '</b><small>' + esc(t) + '</small></div>';
}
function favCount(id) { return S.favs.indexOf(id) >= 0 ? 1 : 0; }
function contactsHTML(l) {
  var u = me();
  var out = '<div class="mk2-contact">';
  if (l.contactTg) out += '<div>' + SVG('send') + '<span>Telegram: ' + esc(l.contactTg) + '</span></div>';
  if (l.contactPhone) out += '<a href="tel:' + att(l.contactPhone.replace(/[^\d+]/g, '')) + '">' + SVG('phone') + '<span>' + esc(l.contactPhone) + '</span></a>';
  if (!l.contactTg && !l.contactPhone) out += '<div>' + SVG('info') + '<span>Автор не оставил контактов — пиши в чат OKO.</span></div>';
  out += '</div>';
  return out;
}

/* --------------------------- мои объявления ------------------------------ */

function pageMine() {
  var groups = {
    active: S.listings.filter(function (l) { return l.status === 'active'; }),
    draft: S.listings.filter(function (l) { return l.status === 'draft'; }),
    moderation: S.listings.filter(function (l) { return l.status === 'moderation'; }),
    archived: S.listings.filter(function (l) { return l.status === 'archived'; })
  };
  var tabs = [
    ['active', 'Активные', groups.active.length],
    ['draft', 'Черновики', groups.draft.length],
    ['moderation', 'На модерации', groups.moderation.length],
    ['archived', 'Архив', groups.archived.length]
  ];
  var h = '<div class="mk2-tabs">' + tabs.map(function (t) {
    return '<button class="' + (mineTab === t[0] ? 'on' : '') + '" data-mkact="minetab" data-val="' + t[0] + '">' +
      esc(t[1]) + '<i>' + t[2] + '</i></button>';
  }).join('') + '</div>';

  var totalViews = S.listings.reduce(function (a, l) { return a + (l.views || 0); }, 0);
  var totalResp = S.listings.reduce(function (a, l) { return a + ((l.responses || []).length); }, 0);
  if (S.listings.length) {
    h += '<div class="mk2-stats">' +
      stat(S.listings.length, 'всего объявлений') +
      stat(groups.active.length, 'опубликовано') +
      stat(totalViews, 'просмотров карточек') +
      stat(totalResp, 'откликов') +
      '</div>';
    h += '<div class="mk2-note">' + SVG('info') + '<span>Счётчики настоящие: считаются на этом устройстве по реальным открытиям ' +
      'и откликам. Ничего не дорисовано.</span></div>';
  }

  var arr = (groups[mineTab] || []).slice().sort(function (a, b) { return bumped(b) - bumped(a); });
  if (arr.length) {
    h += arr.map(rowHTML).join('');
  } else {
    h += emptyHTML(mineEmpty(mineTab));
  }
  h += '<div style="margin-top:14px"><button class="mk2-btn" data-mkact="create" data-mk="create">' + SVG('plus') + 'Разместить объявление</button></div>';
  return { title: 'Мои объявления OKO', sub: 'Управление публикациями, черновиками и архивом', html: h };
}

function mineEmpty(tab) {
  if (tab === 'active') return {
    ic: 'briefcase', h: 'Активных объявлений нет',
    p: 'Ты пока ничего не публиковал. Размести услугу, товар или вакансию — карточка сразу появится в каталоге биржи.',
    actions: '<button class="mk2-btn" data-mkact="create" data-mk="create">' + SVG('plus') + 'Разместить объявление</button>'
  };
  if (tab === 'draft') return {
    ic: 'file', h: 'Черновиков нет',
    p: 'Черновик сохраняется автоматически, когда ты выходишь из мастера размещения на середине. Ни одного незаконченного объявления нет.',
    actions: '<button class="mk2-btn ghost" data-mkact="create">' + SVG('plus') + 'Начать новое объявление</button>'
  };
  if (tab === 'moderation') return {
    ic: 'shield', h: 'На модерации пусто',
    p: 'Сюда попадают объявления, которые не прошли автопроверку OKO по запрещённым темам. Все твои публикации проверку прошли.',
    actions: ''
  };
  return {
    ic: 'mk-archive', h: 'Архив пуст',
    p: 'В архив уезжают объявления, снятые с публикации. Их можно вернуть в каталог в один тап.',
    actions: ''
  };
}

function rowHTML(l) {
  var c = cat(l.cat);
  var stt = STATUS[l.status] || STATUS.draft;
  var resp = (l.responses || []).length;
  var h = '<div class="mk2-row">' +
    '<button class="mk2-row-ph" data-mkact="open" data-id="' + att(l.id) + '" data-mk="card" aria-label="Открыть объявление">' +
      (l.photos && l.photos.length ? '<img src="' + att(l.photos[0]) + '" alt="">' : SVG(c.ic)) + '</button>' +
    '<div class="mk2-row-b">' +
      '<div class="mk2-row-p">' + esc(priceText(l)) + '</div>' +
      '<button class="mk2-row-t" data-mkact="open" data-id="' + att(l.id) + '" style="text-align:left">' + esc(l.title) + '</button>' +
      '<div class="mk2-row-m">' +
        '<span class="mk2-badge ' + stt.c + '">' + esc(stt.n) + '</span>' +
        '<span>' + SVG('eye') + num(l.views || 0) + '</span>' +
        '<span>' + SVG('chat') + resp + '</span>' +
        '<span>' + SVG('bell') + esc(dateShort(bumped(l))) + '</span>' +
      '</div>' +
      '<div class="mk2-acts">' +
        '<button class="mk2-act" data-mkact="edit" data-id="' + att(l.id) + '">' + SVG('edit') + 'Изменить</button>' +
        (l.status === 'active'
          ? '<button class="mk2-act" data-mkact="bump" data-id="' + att(l.id) + '">' + SVG('arrow-up') + 'Поднять</button>' +
            '<button class="mk2-act" data-mkact="archive" data-id="' + att(l.id) + '" data-mk="unpublish">' + SVG('mk-archive') + 'Снять</button>'
          : '<button class="mk2-act primary" data-mkact="publish" data-id="' + att(l.id) + '">' + SVG('rocket') + 'Опубликовать</button>') +
        '<button class="mk2-act danger" data-mkact="askdel" data-id="' + att(l.id) + '" data-mk="delete">' + SVG('trash') + 'Удалить</button>' +
      '</div>' +
    '</div>' +
  '</div>';
  return h;
}

/* ------------------------------ избранное -------------------------------- */

function pageFav() {
  var arr = S.favs.map(find).filter(Boolean);
  var h = '';
  if (arr.length) {
    h += '<p class="mk2-sub">' + arr.length + ' ' + plural(arr.length, 'объявление', 'объявления', 'объявлений') + ' в избранном</p>';
    h += gridHTML(arr);
    h += '<div style="margin-top:14px"><button class="mk2-btn ghost" data-mkact="clearfav">' + SVG('trash') + 'Очистить избранное</button></div>';
  } else {
    h += emptyHTML({
      ic: 'heart', h: 'В избранном пусто',
      p: 'Нажми на сердечко в углу любой карточки — объявление сохранится сюда и не потеряется в каталоге.',
      actions: '<button class="mk2-btn" data-mkact="home">' + SVG('search') + 'Открыть каталог</button>'
    });
  }
  return { title: 'Избранное', sub: 'Отложенные объявления', html: h };
}

/* ------------------------------- история --------------------------------- */

function pageHistory() {
  var arr = S.history.map(function (r) { var l = find(r.id); return l ? { l: l, at: r.at } : null; }).filter(Boolean);
  var h = '';
  if (arr.length) {
    h += '<p class="mk2-sub">Последние ' + arr.length + ' ' + plural(arr.length, 'карточка', 'карточки', 'карточек') + ', которые ты открывал</p>';
    h += arr.map(function (r) {
      var c = cat(r.l.cat);
      return '<div class="mk2-row">' +
        '<button class="mk2-row-ph" data-mkact="open" data-id="' + att(r.l.id) + '" aria-label="Открыть">' +
          (r.l.photos && r.l.photos.length ? '<img src="' + att(r.l.photos[0]) + '" alt="">' : SVG(c.ic)) + '</button>' +
        '<div class="mk2-row-b">' +
          '<div class="mk2-row-p">' + esc(priceText(r.l)) + '</div>' +
          '<button class="mk2-row-t" data-mkact="open" data-id="' + att(r.l.id) + '" style="text-align:left">' + esc(r.l.title) + '</button>' +
          '<div class="mk2-row-m"><span>' + SVG('clock') + esc(dateShort(r.at)) + '</span><span>' + SVG(c.ic) + esc(c.s) + '</span></div>' +
        '</div></div>';
    }).join('');
    h += '<div style="margin-top:14px"><button class="mk2-btn ghost" data-mkact="clearhist">' + SVG('trash') + 'Очистить историю</button></div>';
  } else {
    h += emptyHTML({
      ic: 'clock', h: 'История пуста',
      p: 'Здесь появятся объявления, которые ты открывал. История хранится только на этом устройстве и никуда не уходит.',
      actions: '<button class="mk2-btn" data-mkact="home">' + SVG('search') + 'Открыть каталог</button>'
    });
  }
  return { title: 'История просмотров', sub: 'Что ты недавно смотрел на бирже', html: h };
}

/* --------------------------- отклики и сделки ---------------------------- */

function pageDeals() {
  var resp = [];
  S.listings.forEach(function (l) {
    (l.responses || []).forEach(function (r) { resp.push({ l: l, r: r }); });
  });
  var tabs = [['resp', 'Отклики', resp.length], ['deals', 'Сделки', S.deals.length]];
  var h = '<div class="mk2-tabs">' + tabs.map(function (t) {
    return '<button class="' + (dealsTab === t[0] ? 'on' : '') + '" data-mkact="dealstab" data-val="' + t[0] + '">' +
      esc(t[1]) + '<i>' + t[2] + '</i></button>';
  }).join('') + '</div>';

  if (dealsTab === 'resp') {
    if (resp.length) {
      h += resp.sort(function (a, b) { return b.r.at - a.r.at; }).map(function (x) {
        return '<div class="mk2-row"><div class="mk2-row-b">' +
          '<div class="mk2-row-p">' + esc(x.r.from) + '</div>' +
          '<div class="mk2-row-t">' + esc(x.r.text) + '</div>' +
          '<div class="mk2-row-m"><span>' + SVG('briefcase') + esc(x.l.title) + '</span><span>' + SVG('clock') + esc(dateShort(x.r.at)) + '</span></div>' +
          '</div></div>';
      }).join('');
    } else {
      h += emptyHTML({
        ic: 'chat', h: 'Откликов пока нет',
        p: 'Отклик появляется, когда по твоему объявлению пишут. Пока биржа работает локально, писать тебе некому — ' +
           'отклики пойдут, как только каталог станет общим. Ничего выдуманного здесь не будет.',
        actions: '<button class="mk2-btn ghost" data-mkact="how">' + SVG('info') + 'Как это будет работать</button>' +
          '<button class="mk2-btn" data-mkact="create">' + SVG('plus') + 'Разместить объявление</button>'
      });
    }
  } else {
    if (S.deals.length) {
      h += S.deals.slice().sort(function (a, b) { return b.createdAt - a.createdAt; }).map(function (d) {
        var l = find(d.listingId);
        var stt = DEAL_ST[d.status] || DEAL_ST['new'];
        return '<div class="mk2-row"><div class="mk2-row-b">' +
          '<div class="mk2-row-p">' + esc(l ? priceText(l) : 'Объявление удалено') + '</div>' +
          '<div class="mk2-row-t">' + esc(l ? l.title : d.title || 'Без названия') + '</div>' +
          '<div class="mk2-row-m"><span class="mk2-badge ' + stt.c + '">' + esc(stt.n) + '</span>' +
            '<span>' + SVG('clock') + esc(dateShort(d.createdAt)) + '</span></div>' +
          '<div class="mk2-acts">' +
            (d.status === 'new' ? '<button class="mk2-act primary" data-mkact="dealst" data-id="' + att(d.id) + '" data-val="work">' + SVG('play') + 'В работу</button>' : '') +
            (d.status === 'work' ? '<button class="mk2-act primary" data-mkact="dealst" data-id="' + att(d.id) + '" data-val="done">' + SVG('check') + 'Завершить</button>' : '') +
            (d.status === 'new' || d.status === 'work' ? '<button class="mk2-act danger" data-mkact="dealst" data-id="' + att(d.id) + '" data-val="cancel">' + SVG('x') + 'Отменить</button>' : '') +
            '<button class="mk2-act danger" data-mkact="dealdel" data-id="' + att(d.id) + '">' + SVG('trash') + 'Удалить</button>' +
          '</div></div></div>';
      }).join('');
      h += '<div class="mk2-note">' + SVG('shield') + '<span>Движения денег пока нет: эскроу подключится вместе с кошельком OKO. ' +
        'Здесь ведётся статус работы — чтобы обе стороны видели, на каком шаге сделка.</span></div>';
    } else {
      h += emptyHTML({
        ic: 'shield', h: 'Сделок ещё нет',
        p: 'Безопасная сделка создаётся с карточки объявления: заказчик и исполнитель фиксируют условия, ' +
           'а деньги замораживаются до результата. Сейчас в списке пусто — и это честно, а не «пока загружается».',
        actions: '<button class="mk2-btn ghost" data-mkact="how">' + SVG('info') + 'Как работает безопасная сделка</button>'
      });
    }
  }
  return { title: 'Отклики и сделки', sub: 'Всё, что происходит вокруг твоих объявлений', html: h };
}

/* ============================== 11. МАСТЕР ================================ */

var STEPS = [
  { k: 'cat',   t: 'Категория' },
  { k: 'photo', t: 'Фото' },
  { k: 'title', t: 'Заголовок' },
  { k: 'desc',  t: 'Описание' },
  { k: 'price', t: 'Цена' },
  { k: 'terms', t: 'Условия' },
  { k: 'done',  t: 'Публикация' }
];

function newDraft(catKey) {
  var u = me();
  return {
    id: uid(), mine: true, cat: catKey || '', kind: catKey ? cat(catKey).kind : 'service',
    title: '', desc: '', specs: [], photos: [],
    priceKind: 'from', price: '',
    city: '', remote: true, term: 'по договорённости',
    contactTg: u.nick ? '@' + u.nick : '', contactPhone: u.phone || '',
    sellerName: u.name, sellerVerified: u.verified, sellerSince: u.since ? new Date(u.since).getTime() : Date.now(),
    status: 'draft', createdAt: Date.now(), updatedAt: Date.now(), publishedAt: 0, bumpedAt: 0,
    views: 0, responses: [], rating: 0, reviews: 0
  };
}

function startWizard(id, catKey) {
  if (id) {
    var l = find(id);
    if (!l) { say('Объявление не найдено'); return; }
    W = { step: 0, editing: true, d: JSON.parse(JSON.stringify(l)), err: '' };
  } else if (S.draft) {
    W = { step: S.draft.__step || 0, editing: false, d: S.draft, err: '' };
    if (catKey) { W.d.cat = catKey; W.d.kind = cat(catKey).kind; }
  } else {
    W = { step: 0, editing: false, d: newDraft(catKey), err: '' };
  }
  go('create');
}

function wizardSave() {
  if (!W || W.editing) return;
  W.d.__step = W.step;
  W.d.updatedAt = Date.now();
  S.draft = W.d;
  save();
}

function pageCreate() {
  if (!W) W = { step: 0, editing: false, d: newDraft(''), err: '' };
  var d = W.d, s = STEPS[W.step];
  var h = '';
  h += '<div class="mk2-steps">' + STEPS.map(function (_, i) {
    return '<i class="' + (i <= W.step ? 'on' : '') + '"></i>';
  }).join('') + '</div>';
  h += '<p class="mk2-stepnum">ШАГ ' + (W.step + 1) + ' ИЗ ' + STEPS.length + ' · ' + esc(s.t).toUpperCase() + '</p>';
  if (W.err) h += '<div class="mk2-err">' + SVG('warning') + '<span>' + esc(W.err) + '</span></div>';

  if (s.k === 'cat') h += stepCat(d);
  if (s.k === 'photo') h += stepPhoto(d);
  if (s.k === 'title') h += stepTitle(d);
  if (s.k === 'desc') h += stepDesc(d);
  if (s.k === 'price') h += stepPrice(d);
  if (s.k === 'terms') h += stepTerms(d);
  if (s.k === 'done') h += stepDone(d);

  if (s.k !== 'done') {
    h += '<div class="mk2-nav">' +
      (W.step > 0 ? '<button class="mk2-btn ghost" data-mkact="wprev">' + SVG('back') + 'Назад</button>' : '') +
      '<button class="mk2-btn" data-mkact="wnext" data-mk="next">Далее' + SVG('chev') + '</button>' +
      '</div>';
    if (!W.editing) {
      h += '<div style="margin-top:9px"><button class="mk2-btn ghost" data-mkact="wdraft">' + SVG('file') + 'Сохранить как черновик и выйти</button></div>';
    }
  }
  return { title: W.editing ? 'Редактирование' : 'Новое объявление', sub: esc(s.t), html: h };
}

function stepCat(d) {
  var h = '<div class="mk2-field"><label class="mk2-lab">Что размещаешь</label><div class="mk2-opts">' +
    KINDS.map(function (k) {
      return '<button class="mk2-opt' + (d.kind === k.k ? ' on' : '') + '" data-mkact="wkind" data-val="' + k.k + '">' + esc(k.n) + '</button>';
    }).join('') + '</div></div>';
  h += '<div class="mk2-field"><label class="mk2-lab">Категория</label><div class="mk2-catgrid">' +
    CATS.map(function (c) {
      return '<button class="mk2-catrow' + (d.cat === c.k ? ' on' : '') + '" data-mkact="wcat" data-val="' + c.k + '">' +
        '<span class="mk2-cat-ic">' + SVG(c.ic) + '</span><span><b>' + esc(c.n) + '</b><small>' +
        esc((KINDS.filter(function (k) { return k.k === c.kind; })[0] || KINDS[0]).n) + '</small></span></button>';
    }).join('') + '</div>' +
    '<p class="mk2-hint">Категория определяет, где объявление увидят. Тип можно поменять вручную — например, продать технику в разделе «Техника и оборудование».</p></div>';
  return h;
}

function stepPhoto(d) {
  var h = '<div class="mk2-field">' +
    '<label class="mk2-lab">Фото объявления · до 6 штук</label>' +
    '<input type="file" id="mk2file" accept="image/*" multiple style="position:absolute;width:1px;height:1px;opacity:0;pointer-events:none">' +
    '<button class="mk2-drop" data-mkact="wpick">' + SVG('attach-photo') +
      '<b>Выбрать фото с устройства</b>' +
      '<small>Первое фото станет обложкой в каталоге. Снимки уменьшаются до 1200 px и сохраняются на этом устройстве — в сеть ничего не уходит.</small>' +
    '</button>';
  if (d.photos.length) {
    h += '<div class="mk2-photos">' + d.photos.map(function (p, i) {
      return '<div class="mk2-pcell"><img src="' + att(p) + '" alt="Фото ' + (i + 1) + '">' +
        (i === 0 ? '<span class="mk2-pmain">ОБЛОЖКА</span>' : '') +
        '<button class="mk2-pdel" data-mkact="wdelphoto" data-val="' + i + '" aria-label="Удалить фото">' + SVG('x') + '</button></div>';
    }).join('') + '</div>';
  }
  h += '<p class="mk2-hint">Фото не обязательны — можно опубликовать и без них. Но карточки с обложкой открывают заметно чаще.</p></div>';
  return h;
}

function stepTitle(d) {
  var n = (d.title || '').length;
  return '<div class="mk2-field"><label class="mk2-lab">Заголовок объявления</label>' +
    '<input class="mk2-inp" id="mk2title" data-mkinput="title" value="' + att(d.title) + '" maxlength="70" ' +
    'placeholder="Например: Монтаж вертикальных роликов под ключ">' +
    '<div class="mk2-cnt' + (n && (n < 10 || n > 70) ? ' bad' : '') + '">' + n + ' / 70</div>' +
    '<p class="mk2-hint">От 10 до 70 символов. Пиши то, что человек ищет: «Монтаж Reels», «Съёмка предметки», «Настройка Яндекс.Директа». ' +
    'Заголовок целиком виден в каталоге — он не обрезается.</p></div>';
}

function stepDesc(d) {
  var n = (d.desc || '').length;
  var h = '<div class="mk2-field"><label class="mk2-lab">Описание</label>' +
    '<textarea class="mk2-ta" id="mk2desc" data-mkinput="desc" maxlength="4000" ' +
    'placeholder="Что входит в работу, как проходит процесс, что получит заказчик, сколько правок, какие форматы сдачи">' + esc(d.desc) + '</textarea>' +
    '<div class="mk2-cnt' + (n && n < 30 ? ' bad' : '') + '">' + n + ' / 4000</div>' +
    '<p class="mk2-hint">От 30 символов. Чем конкретнее — тем меньше пустых вопросов в переписке.</p></div>';

  h += '<div class="mk2-field"><label class="mk2-lab">Характеристики · необязательно</label>';
  (d.specs || []).forEach(function (sp, i) {
    h += '<div class="mk2-specrow">' +
      '<input class="mk2-inp" data-mkinput="speck" data-val="' + i + '" value="' + att(sp.k) + '" placeholder="Параметр">' +
      '<input class="mk2-inp" data-mkinput="specv" data-val="' + i + '" value="' + att(sp.v) + '" placeholder="Значение">' +
      '<button class="mk2-specdel" data-mkact="wdelspec" data-val="' + i + '" aria-label="Удалить строку">' + SVG('x') + '</button></div>';
  });
  h += '<button class="mk2-btn ghost sm" data-mkact="waddspec">' + SVG('plus') + 'Добавить характеристику</button>' +
    '<p class="mk2-hint">Пары «параметр — значение»: срок сдачи, формат, число правок, софт, оборудование.</p></div>';
  return h;
}

function stepPrice(d) {
  var needAmount = ['fixed', 'from', 'hour'].indexOf(d.priceKind) >= 0;
  var h = '<div class="mk2-field"><label class="mk2-lab">Как считаем цену</label><div class="mk2-opts">' +
    PRICE_KINDS.map(function (p) {
      return '<button class="mk2-opt' + (d.priceKind === p.k ? ' on' : '') + '" data-mkact="wpk" data-val="' + p.k + '">' + esc(p.n) + '</button>';
    }).join('') + '</div></div>';
  if (needAmount) {
    h += '<div class="mk2-field"><label class="mk2-lab">Сумма в рублях</label>' +
      '<input class="mk2-inp" id="mk2price" data-mkinput="price" inputmode="numeric" value="' + att(d.price) + '" placeholder="Например: 5000">' +
      '<p class="mk2-hint">Только число. В карточке покажем как «' +
      esc(priceText({ priceKind: d.priceKind, price: d.price || 0 })) + '».</p></div>';
  } else {
    h += '<div class="mk2-note">' + SVG('info') + '<span>В карточке цена будет показана как «' +
      esc(priceText({ priceKind: d.priceKind, price: 0 })) + '». Сумму указывать не нужно.</span></div>';
  }
  return h;
}

function stepTerms(d) {
  var h = '<div class="mk2-field"><label class="mk2-lab">Где работаешь</label><div class="mk2-opts">' +
    '<button class="mk2-opt' + (d.remote ? ' on' : '') + '" data-mkact="wremote" data-val="1">' + SVG('globe') + 'Удалённо</button>' +
    '<button class="mk2-opt' + (!d.remote ? ' on' : '') + '" data-mkact="wremote" data-val="0">' + SVG('pos') + 'В городе</button>' +
    '</div></div>';
  h += '<div class="mk2-field"><label class="mk2-lab">Город' + (d.remote ? ' · необязательно' : '') + '</label>' +
    '<input class="mk2-inp" id="mk2city" data-mkinput="city" list="mk2cities" value="' + att(d.city) + '" placeholder="Например: Москва">' +
    '<datalist id="mk2cities">' + CITIES.map(function (c) { return '<option value="' + att(c) + '"></option>'; }).join('') + '</datalist></div>';
  h += '<div class="mk2-field"><label class="mk2-lab">Срок выполнения</label><div class="mk2-opts">' +
    TERMS.map(function (t) {
      return '<button class="mk2-opt' + (d.term === t ? ' on' : '') + '" data-mkact="wterm" data-val="' + att(t) + '">' + esc(t) + '</button>';
    }).join('') + '</div></div>';
  h += '<div class="mk2-field"><label class="mk2-lab">Telegram для связи</label>' +
    '<input class="mk2-inp" data-mkinput="ctg" value="' + att(d.contactTg) + '" placeholder="@nickname"></div>';
  h += '<div class="mk2-field"><label class="mk2-lab">Телефон · необязательно</label>' +
    '<input class="mk2-inp" data-mkinput="cphone" inputmode="tel" value="' + att(d.contactPhone) + '" placeholder="+7 900 000-00-00">' +
    '<p class="mk2-hint">Контакты видны только тем, кто нажмёт «Показать контакты» в карточке.</p></div>';
  return h;
}

function stepDone(d) {
  var c = cat(d.cat);
  var hits = moderate(d.title, d.desc);
  var h = '<p class="mk2-sub" style="margin:0 0 12px">Так объявление увидят в каталоге. Проверь и публикуй.</p>';
  h += '<div class="mk2-grid" style="max-width:220px;margin:0 0 16px">' +
    '<div style="position:relative;display:flex">' +
      '<div class="mk2-card"><span class="mk2-ph">' + ph(d) + '</span><span class="mk2-cb">' +
      '<span class="mk2-price">' + esc(priceText(d)) + '</span>' +
      '<span class="mk2-ct">' + esc(d.title) + '</span>' +
      '<span class="mk2-cm"><span>' + SVG('pos') + esc(d.remote ? 'Удалённо' : (d.city || 'Не указан')) + '</span>' +
      '<span>' + SVG(c.ic) + esc(c.s) + '</span></span></span></div>' +
    '</div></div>';

  h += '<div class="mk2-block"><h4>Что публикуем</h4><div class="mk2-specs">' +
    spec('Тип', (KINDS.filter(function (k) { return k.k === d.kind; })[0] || KINDS[0]).n) +
    spec('Категория', c.n) +
    spec('Цена', priceText(d)) +
    spec('Формат', d.remote ? 'Удалённо' : ('Город: ' + (d.city || 'не указан'))) +
    spec('Срок', d.term || 'по договорённости') +
    spec('Фото', d.photos.length ? d.photos.length + ' ' + plural(d.photos.length, 'штука', 'штуки', 'штук') : 'без фото') +
    spec('Контакты', [d.contactTg, d.contactPhone].filter(Boolean).join(', ') || 'не указаны') +
    '</div></div>';

  if (hits.length) {
    h += '<div class="mk2-err">' + SVG('warning') + '<span><b>Автопроверка OKO нашла запрещённые темы:</b> ' +
      esc(hits.join(', ')) + '. Если опубликовать сейчас, объявление уйдёт во вкладку «На модерации» и в каталог не попадёт.</span></div>';
  } else {
    h += '<div class="mk2-note">' + SVG('shield') + '<span>Автопроверка OKO по запрещённым темам пройдена. ' +
      'После нажатия объявление появится в каталоге сразу — без ожидания.</span></div>';
  }
  h += '<div class="mk2-note">' + SVG('info') + '<span>Пока нет сервера: объявление сохраняется на этом устройстве ' +
    'и видно только тебе. Ничего никуда не отправляется — обещать обратное было бы враньём.</span></div>';

  h += '<div class="mk2-nav">' +
    '<button class="mk2-btn ghost" data-mkact="wprev">' + SVG('back') + 'Назад</button>' +
    '<button class="mk2-btn" data-mkact="wpublish" data-mk="publish">' + SVG('rocket') + (W.editing ? 'Сохранить' : 'Опубликовать') + '</button>' +
    '</div>';
  if (!W.editing) {
    h += '<div style="margin-top:9px"><button class="mk2-btn ghost" data-mkact="wdraft">' + SVG('file') + 'Сохранить как черновик</button></div>';
  }
  return h;
}
function spec(k, v) { return '<div class="mk2-spec"><b>' + esc(k) + '</b><span>' + esc(v) + '</span></div>'; }

function wizardValidate() {
  var d = W.d, s = STEPS[W.step].k;
  if (s === 'cat') { if (!d.cat) return 'Выбери категорию — без неё объявление некуда положить.'; }
  if (s === 'title') {
    var t = (d.title || '').trim();
    if (t.length < 10) return 'Заголовок слишком короткий: нужно минимум 10 символов.';
    if (t.length > 70) return 'Заголовок длиннее 70 символов — сократи.';
  }
  if (s === 'desc') {
    if ((d.desc || '').trim().length < 30) return 'Описание короче 30 символов. Расскажи, что именно получит заказчик.';
    var bad = (d.specs || []).some(function (x) { return (x.k && !x.v) || (!x.k && x.v); });
    if (bad) return 'В характеристиках есть незаполненная строка — заполни обе ячейки или удали строку.';
  }
  if (s === 'price') {
    if (['fixed', 'from', 'hour'].indexOf(d.priceKind) >= 0) {
      var p = parseInt(String(d.price).replace(/\D/g, ''), 10);
      if (!p || p <= 0) return 'Укажи сумму больше нуля или выбери «Договорная».';
    }
  }
  if (s === 'terms') {
    if (!d.remote && !(d.city || '').trim()) return 'Для работы в городе нужно указать город.';
  }
  return '';
}

function wizardPublish() {
  var d = W.d;
  d.title = (d.title || '').trim();
  d.desc = (d.desc || '').trim();
  d.city = (d.city || '').trim();
  d.specs = (d.specs || []).filter(function (x) { return x.k && x.v; });
  d.price = ['fixed', 'from', 'hour'].indexOf(d.priceKind) >= 0 ? (parseInt(String(d.price).replace(/\D/g, ''), 10) || 0) : 0;
  d.updatedAt = Date.now();
  delete d.__step;

  var hits = moderate(d.title, d.desc);
  if (hits.length) {
    d.status = 'moderation';
    d.modReason = 'Найдены слова: ' + hits.join(', ') + '.';
  } else {
    d.status = 'active';
    d.modReason = '';
    if (!d.publishedAt) d.publishedAt = Date.now();
    d.bumpedAt = Date.now();
  }

  var ex = find(d.id);
  if (ex) { for (var k in d) if (Object.prototype.hasOwnProperty.call(d, k)) ex[k] = d[k]; }
  else S.listings.unshift(d);
  if (S.draft && S.draft.id === d.id) S.draft = null;
  save();

  var wasEditing = W.editing;
  W = null;
  home();

  if (d.status === 'active') {
    go('item', { id: d.id });
    say(wasEditing ? 'Изменения сохранены, объявление в каталоге' : 'Объявление опубликовано в каталоге биржи');
  } else {
    mineTab = 'moderation';
    go('mine');
    say('Автопроверка не пропустила объявление — оно во вкладке «На модерации»');
  }
}

/* ============================== 12. ФОТО ================================== */

function loadPhotos(files, done) {
  var list = Array.prototype.slice.call(files || []);
  if (!list.length) return done([]);
  var out = [], left = list.length;
  function fin() { if (--left <= 0) done(out.filter(Boolean)); }
  list.forEach(function (f, i) {
    if (!/^image\//.test(f.type)) { fin(); return; }
    var fr = new FileReader();
    fr.onload = function () {
      var img = new Image();
      img.onload = function () {
        try {
          var m = 1200, w = img.naturalWidth || img.width, hh = img.naturalHeight || img.height;
          if (w > m || hh > m) { var k = Math.min(m / w, m / hh); w = Math.round(w * k); hh = Math.round(hh * k); }
          var cv = document.createElement('canvas'); cv.width = w; cv.height = hh;
          cv.getContext('2d').drawImage(img, 0, 0, w, hh);
          out[i] = cv.toDataURL('image/jpeg', 0.72);
        } catch (e) { out[i] = fr.result; }
        fin();
      };
      img.onerror = fin;
      img.src = fr.result;
    };
    fr.onerror = fin;
    fr.readAsDataURL(f);
  });
}

/* ============================== 13. ШТОРКИ ================================ */

function ensureSheet() {
  if (document.getElementById('sheet-mk3')) return;
  var d = document.createElement('div');
  d.className = 'sheet';
  d.id = 'sheet-mk3';
  d.innerHTML = '<div id="mk3SheetBody"></div>';
  document.body.appendChild(d);
}
function sheet(title, body) {
  ensureSheet();
  var b = document.getElementById('mk3SheetBody');
  if (!b) return;
  b.innerHTML = '<h3>' + esc(title) + '</h3>' + body;
  if (typeof window.openSheet === 'function') window.openSheet('mk3');
}
function sheetClose() { if (typeof window.closeSheet === 'function') window.closeSheet(); }

function openFiltersSheet() {
  var h = '';
  h += '<label class="mk2-lab">Цена, ₽</label><div class="mk2-prange">' +
    '<input class="mk2-inp" id="mk3min" inputmode="numeric" placeholder="от" value="' + att(F.min) + '">' +
    '<span>—</span>' +
    '<input class="mk2-inp" id="mk3max" inputmode="numeric" placeholder="до" value="' + att(F.max) + '"></div>';
  h += '<label class="mk2-lab">Тип</label><div class="mk2-opts">' +
    '<button class="mk2-opt' + (!F.kind ? ' on' : '') + '" data-mkact="fkind" data-val="">Любой</button>' +
    KINDS.map(function (k) {
      return '<button class="mk2-opt' + (F.kind === k.k ? ' on' : '') + '" data-mkact="fkind" data-val="' + k.k + '">' + esc(k.n) + '</button>';
    }).join('') + '</div>';
  h += '<label class="mk2-lab">Город</label>' +
    '<input class="mk2-inp" id="mk3city" list="mk2cities2" value="' + att(F.city) + '" placeholder="Любой город">' +
    '<datalist id="mk2cities2">' + CITIES.map(function (c) { return '<option value="' + att(c) + '"></option>'; }).join('') + '</datalist>';
  h += '<label class="mk2-lab">Формат</label><div class="mk2-opts">' +
    '<button class="mk2-opt' + (F.remote ? ' on' : '') + '" data-mkact="toggle" data-val="remote">' + SVG('globe') + 'Только удалённо</button>' +
    '<button class="mk2-opt' + (F.verified ? ' on' : '') + '" data-mkact="toggle" data-val="verified">' + SVG('verified') + 'Только проверенные</button>' +
    '</div>';
  h += '<label class="mk2-lab">Рейтинг продавца</label><div class="mk2-opts">' +
    [[0, 'Любой'], [4, 'от 4.0'], [4.5, 'от 4.5'], [4.8, 'от 4.8']].map(function (r) {
      return '<button class="mk2-opt' + (F.rating === r[0] ? ' on' : '') + '" data-mkact="frating" data-val="' + r[0] + '">' + esc(r[1]) + '</button>';
    }).join('') + '</div>';
  h += '<label class="mk2-lab">Срок выполнения</label><div class="mk2-opts">' +
    '<button class="mk2-opt' + (!F.term ? ' on' : '') + '" data-mkact="fterm" data-val="">Любой</button>' +
    TERMS.map(function (t) {
      return '<button class="mk2-opt' + (F.term === t ? ' on' : '') + '" data-mkact="fterm" data-val="' + att(t) + '">' + esc(t) + '</button>';
    }).join('') + '</div>';
  h += '<div class="mk2-sheetfoot">' +
    '<button class="mk2-btn ghost" data-mkact="resetf">Сбросить</button>' +
    '<button class="mk2-btn" data-mkact="applyf" data-mk="apply-filters">Показать</button></div>';
  sheet('Фильтры', h);
}

function openSortSheet() {
  var h = '<div class="mk2-sheetlist">' + SORTS.map(function (s) {
    return '<button class="' + (F.sort === s[0] ? 'on' : '') + '" data-mkact="setsort" data-val="' + s[0] + '">' +
      SVG(F.sort === s[0] ? 'check' : 'mk-sort') + '<span>' + esc(s[1]) + '</span></button>';
  }).join('') + '</div>';
  sheet('Сортировка', h);
}

function openHowSheet() {
  var h = '<ol class="mk2-steplist">' +
    '<li><b>1</b><span>Размещаешь объявление: категория, фото, цена, условия. Мастер ведёт по шагам и сохраняет черновик.</span></li>' +
    '<li><b>2</b><span>Автопроверка OKO смотрит текст на запрещённые темы. Прошло — карточка сразу в каталоге.</span></li>' +
    '<li><b>3</b><span>Заказчик пишет из карточки: диалог открывается в мессенджере OKO, отклик падает в «Мои объявления».</span></li>' +
    '<li><b>4</b><span>Безопасная сделка: условия фиксируются, деньги замораживаются на счёте OKO и уходят исполнителю после приёмки работы.</span></li>' +
    '<li><b>5</b><span>После завершения обе стороны ставят оценку. Из оценок собирается рейтинг — он и решает, кого видно выше.</span></li>' +
    '</ol>' +
    '<div class="mk2-note" style="margin-top:14px">' + SVG('info') + '<span>Шаги 3–5 заработают вместе с сервером OKO. ' +
      'Сейчас биржа полностью функциональна локально: каталог, карточки, размещение, избранное, история и статусы сделок.</span></div>' +
    '<div class="mk2-sheetfoot"><button class="mk2-btn" data-mkact="closesheet">Понятно</button></div>';
  sheet('Как работает биржа OKO', h);
}

function openDealSheet(id) {
  var l = find(id);
  if (!l) return;
  var h = '<p class="mk2-sub">Объявление: ' + esc(l.title) + ' · ' + esc(priceText(l)) + '</p>' +
    '<ol class="mk2-steplist">' +
    '<li><b>1</b><span>Фиксируем условия и сумму — обе стороны видят одно и то же.</span></li>' +
    '<li><b>2</b><span>Деньги замораживаются на счёте OKO. Исполнитель видит, что оплата есть, но снять её не может.</span></li>' +
    '<li><b>3</b><span>Работа сдаётся в чат сделки. Заказчик принимает или отправляет на доработку.</span></li>' +
    '<li><b>4</b><span>После приёмки деньги уходят исполнителю. Спор — на арбитраж OKO.</span></li>' +
    '</ol>' +
    '<div class="mk2-note warn" style="margin-top:14px">' + SVG('warning') + '<span>Заморозки денег сейчас нет: кошелёк ещё не подключён. ' +
      'Кнопка создаст запись сделки со статусами — деньгами она не двигает.</span></div>' +
    '<div class="mk2-sheetfoot">' +
      '<button class="mk2-btn ghost" data-mkact="closesheet">Отмена</button>' +
      '<button class="mk2-btn" data-mkact="dealcreate" data-id="' + att(id) + '">Создать сделку</button></div>';
  sheet('Безопасная сделка OKO', h);
}

function openReportSheet(id) {
  var reasons = ['Запрещённый товар или услуга', 'Мошенничество', 'Неверная категория', 'Спам или реклама', 'Оскорбления в тексте', 'Другое'];
  var h = '<div class="mk2-sheetlist">' + reasons.map(function (r) {
    return '<button data-mkact="reportsend" data-id="' + att(id) + '" data-val="' + att(r) + '">' + SVG('flag') + '<span>' + esc(r) + '</span></button>';
  }).join('') + '</div>' +
    '<div class="mk2-note" style="margin-top:12px">' + SVG('info') + '<span>Жалоба сохранится на устройстве и уйдёт модераторам, ' +
      'когда подключим сервер. Сейчас она никуда не отправляется — писать «отправлено» было бы неправдой.</span></div>';
  sheet('Пожаловаться на объявление', h);
}

function openDeleteSheet(id) {
  var l = find(id);
  if (!l) return;
  var h = '<p class="mk2-sub">«' + esc(l.title) + '» будет удалено с этого устройства навсегда. ' +
    'Фото, отклики и статистика по нему тоже пропадут. Отменить нельзя.</p>' +
    '<div class="mk2-sheetfoot">' +
      '<button class="mk2-btn ghost" data-mkact="closesheet">Оставить</button>' +
      '<button class="mk2-btn danger" data-mkact="del" data-id="' + att(id) + '" data-mk="delete-yes">Удалить</button></div>';
  sheet('Удалить объявление?', h);
}

function openLinkSheet(url) {
  var h = '<p class="mk2-sub">Скопируй ссылку вручную — браузер не дал доступ к буферу обмена.</p>' +
    '<div class="mk2-linkbox oko-breakable">' + esc(url) + '</div>' +
    '<div class="mk2-sheetfoot"><button class="mk2-btn" data-mkact="closesheet">Закрыть</button></div>';
  sheet('Ссылка на объявление', h);
}

/* ============================== 14. ДЕЙСТВИЯ ============================== */

function listingURL(id) {
  return location.origin + location.pathname + '#oko-market/' + id;
}

var ACT = {
  back: function () { back(); },
  home: function () { home(); },
  closesheet: function () { sheetClose(); },
  how: function () { openHowSheet(); },

  /* --- каталог --- */
  cat: function (id, v) { F.cat = v || ''; go('list', { cat: v || '' }); },
  setcat: function (id, v) { F.cat = v || ''; paint(); },
  allcats: function () { go('allcats'); },
  clearq: function () { F.q = ''; hideSug(); paint(); },
  toggle: function (id, v) { F[v] = !F[v]; if (isSheetOpen()) openFiltersSheet(); else paint(); },
  resetf: function () { resetFiltersState(); if (isSheetOpen()) openFiltersSheet(); paint(); },
  resetall: function () { resetFiltersState(); F.q = ''; paint(); },
  filters: function () { openFiltersSheet(); },
  sortsheet: function () { openSortSheet(); },
  setsort: function (id, v) { F.sort = v; sheetClose(); paint(); },
  fkind: function (id, v) { F.kind = v || ''; openFiltersSheet(); },
  frating: function (id, v) { F.rating = Number(v) || 0; openFiltersSheet(); },
  fterm: function (id, v) { F.term = v || ''; openFiltersSheet(); },
  applyf: function () {
    var a = document.getElementById('mk3min'), b = document.getElementById('mk3max'), c = document.getElementById('mk3city');
    F.min = a ? (a.value || '').replace(/\D/g, '') : '';
    F.max = b ? (b.value || '').replace(/\D/g, '') : '';
    F.city = c ? (c.value || '').trim() : '';
    sheetClose();
    paint();
  },

  /* --- карточка --- */
  open: function (id) { openItem(id); },
  fav: function (id) {
    var i = S.favs.indexOf(id);
    if (i >= 0) { S.favs.splice(i, 1); say('Убрано из избранного'); }
    else { S.favs.unshift(id); say('Добавлено в избранное'); }
    save();
    paint(true);
  },
  clearfav: function () { S.favs = []; save(); paint(); say('Избранное очищено'); },
  clearhist: function () { S.history = []; save(); paint(); say('История просмотров очищена'); },
  contacts: function (id) { revealed[id] = true; paint(true); },
  write: function (id) { writeSeller(id); },
  deal: function (id) { openDealSheet(id); },
  dealcreate: function (id) {
    var l = find(id);
    if (!l) return;
    S.deals.unshift({ id: 'd' + Date.now().toString(36), listingId: id, title: l.title, status: 'new', createdAt: Date.now() });
    save(); sheetClose();
    dealsTab = 'deals';
    go('deals');
    say('Сделка создана. Деньгами она пока не двигает — эскроу подключится с кошельком.');
  },
  dealst: function (id, v) {
    var d = null;
    S.deals.forEach(function (x) { if (x.id === id) d = x; });
    if (!d) return;
    d.status = v; save(); paint(true);
    say('Статус сделки: ' + (DEAL_ST[v] || DEAL_ST['new']).n.toLowerCase());
  },
  dealdel: function (id) {
    S.deals = S.deals.filter(function (x) { return x.id !== id; });
    save(); paint(true); say('Сделка удалена из списка');
  },
  report: function (id) { openReportSheet(id); },
  reportsend: function (id, v) {
    var l = find(id);
    if (l) { l.reports = (l.reports || []).concat([{ reason: v, at: Date.now() }]); save(); }
    sheetClose();
    say('Жалоба записана на устройстве. Модераторам уйдёт после подключения сервера.');
  },
  share: function (id) { shareListing(id); },
  copylink: function (id) { copyLink(id); },

  /* --- управление своими --- */
  mine: function () { go('mine'); },
  fav_page: function () { go('fav'); },
  history: function () { go('history'); },
  deals: function () { dealsTab = 'resp'; go('deals'); },
  minetab: function (id, v) { mineTab = v; paint(true); },
  dealstab: function (id, v) { dealsTab = v; paint(true); },
  create: function () { startWizard(null, F.cat || ''); },
  createcat: function (id, v) { startWizard(null, v || ''); },
  edit: function (id) { startWizard(id); },
  bump: function (id) {
    var l = find(id); if (!l) return;
    l.bumpedAt = Date.now(); save(); paint(true);
    say('Объявление поднято наверх в каталоге');
  },
  archive: function (id) {
    var l = find(id); if (!l) return;
    l.status = 'archived'; l.updatedAt = Date.now(); save();
    mineTab = 'archived';
    paint(true);
    say('Снято с публикации — объявление в архиве');
  },
  draft: function (id) {
    var l = find(id); if (!l) return;
    l.status = 'draft'; l.updatedAt = Date.now(); save();
    mineTab = 'draft'; paint(true);
    say('Объявление убрано в черновики');
  },
  publish: function (id) {
    var l = find(id); if (!l) return;
    var hits = moderate(l.title, l.desc);
    if (hits.length) {
      l.status = 'moderation';
      l.modReason = 'Найдены слова: ' + hits.join(', ') + '.';
      mineTab = 'moderation';
      say('Автопроверка не пропустила объявление — вкладка «На модерации»');
    } else {
      l.status = 'active';
      l.modReason = '';
      if (!l.publishedAt) l.publishedAt = Date.now();
      l.bumpedAt = Date.now();
      mineTab = 'active';
      say('Объявление снова в каталоге биржи');
    }
    l.updatedAt = Date.now();
    save(); paint(true);
  },
  askdel: function (id) { openDeleteSheet(id); },
  del: function (id) {
    S.listings = S.listings.filter(function (x) { return x.id !== id; });
    S.favs = S.favs.filter(function (x) { return x !== id; });
    S.history = S.history.filter(function (x) { return x.id !== id; });
    S.deals = S.deals.filter(function (x) { return x.listingId !== id; });
    if (S.draft && S.draft.id === id) S.draft = null;
    save();
    sheetClose();
    /* если стояли на карточке — уйти назад, её больше нет */
    if (view().v === 'item' && view().id === id) back();
    else paint(true);
    say('Объявление удалено');
  },

  /* --- мастер --- */
  wkind: function (id, v) { W.d.kind = v; wizardSave(); paint(true); },
  wcat: function (id, v) { W.d.cat = v; W.d.kind = cat(v).kind; W.err = ''; wizardSave(); paint(true); },
  wpk: function (id, v) { W.d.priceKind = v; wizardSave(); paint(true); },
  wremote: function (id, v) { W.d.remote = v === '1'; wizardSave(); paint(true); },
  wterm: function (id, v) { W.d.term = v; wizardSave(); paint(true); },
  waddspec: function () { W.d.specs = (W.d.specs || []).concat([{ k: '', v: '' }]); wizardSave(); paint(true); },
  wdelspec: function (id, v) { W.d.specs.splice(Number(v), 1); wizardSave(); paint(true); },
  wdelphoto: function (id, v) { W.d.photos.splice(Number(v), 1); wizardSave(); paint(true); },
  wpick: function () { var f = document.getElementById('mk2file'); if (f) f.click(); },
  wprev: function () { if (W.step > 0) { W.step--; W.err = ''; wizardSave(); paint(); } else back(); },
  wnext: function () {
    var e = wizardValidate();
    W.err = e;
    if (!e && W.step < STEPS.length - 1) W.step++;
    wizardSave();
    paint();
    if (e) say(e);
  },
  wdraft: function () {
    W.d.status = 'draft';
    W.d.title = (W.d.title || '').trim();
    W.d.updatedAt = Date.now();
    delete W.d.__step;
    var ex = find(W.d.id);
    if (ex) { for (var k in W.d) if (Object.prototype.hasOwnProperty.call(W.d, k)) ex[k] = W.d[k]; }
    else S.listings.unshift(W.d);
    S.draft = null;
    save();
    W = null;
    home();
    mineTab = 'draft';
    go('mine');
    say('Черновик сохранён — он во вкладке «Черновики»');
  },
  wpublish: function () {
    var e = '';
    for (var i = 0; i < STEPS.length - 1; i++) {
      var keep = W.step; W.step = i;
      e = wizardValidate();
      W.step = keep;
      if (e) { W.step = i; W.err = e; paint(); say(e); return; }
    }
    wizardPublish();
  }
};

function isSheetOpen() {
  var s = document.getElementById('sheet-mk3');
  return !!(s && s.classList.contains('open'));
}

function openItem(id) {
  var l = find(id);
  if (!l) { say('Объявление не найдено'); return; }
  /* просмотр считается только при заходе из каталога, поиска, избранного и истории */
  var from = view().v;
  if (from !== 'mine') {
    l.views = (l.views || 0) + 1;
    S.history = S.history.filter(function (x) { return x.id !== id; });
    S.history.unshift({ id: id, at: Date.now() });
    if (S.history.length > 60) S.history.length = 60;
    save();
  }
  go('item', { id: id });
}

function writeSeller(id) {
  var l = find(id);
  if (!l) return;
  if (l.mine) { say('Это твоё объявление — писать самому себе не нужно'); return; }
  l.responses = (l.responses || []).concat([{ from: me().name, text: 'Написал по объявлению', at: Date.now() }]);
  save();
  try {
    if (typeof window.CHATS !== 'undefined' && typeof window.openConv === 'function' && typeof window.showTab === 'function') {
      var chat = null;
      window.CHATS.forEach(function (c) { if (c.name === l.sellerName) chat = c; });
      if (!chat) {
        chat = {
          id: 'mk-' + l.id, ava: initial(l.sellerName), name: l.sellerName, kind: 'direct',
          nick: (l.sellerName || '').toLowerCase().replace(/\s+/g, '_'), kindIcon: null,
          preview: 'Объявление: ' + l.title, time: '', unread: 0, online: false,
          msgs: [{ kind: 'sys', body: 'Диалог по объявлению «' + l.title + '» · ' + priceText(l) }]
        };
        window.CHATS.unshift(chat);
      }
      window.showTab('chats');
      if (typeof window.renderChatList === 'function') window.renderChatList();
      window.openConv(chat.id);
      return;
    }
  } catch (e) {}
  say('Чат откроется, когда мессенджер будет готов принять диалог по объявлению');
}

function shareListing(id) {
  var l = find(id);
  if (!l) return;
  var url = listingURL(id);
  if (navigator.share) {
    navigator.share({ title: l.title, text: priceText(l) + ' · ' + l.title, url: url })
      .then(function () { say('Окно «Поделиться» открыто'); })
      .catch(function () { copyLink(id); });
  } else {
    copyLink(id);
  }
}
function copyLink(id) {
  var url = listingURL(id);
  var ok = function () { say('Ссылка скопирована в буфер обмена'); };
  var fail = function () { openLinkSheet(url); };
  try {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(url).then(ok).catch(fail);
      return;
    }
  } catch (e) {}
  try {
    var ta = document.createElement('textarea');
    ta.value = url; ta.style.position = 'fixed'; ta.style.opacity = '0';
    document.body.appendChild(ta); ta.select();
    var done = document.execCommand('copy');
    document.body.removeChild(ta);
    if (done) ok(); else fail();
  } catch (e) { fail(); }
}

/* ============================== 15. ПОДСКАЗКИ ============================= */

function suggestions(q) {
  q = (q || '').trim().toLowerCase();
  var out = { cats: [], items: [], hist: [] };
  CATS.forEach(function (c) {
    if (!q || c.n.toLowerCase().indexOf(q) >= 0 || c.s.toLowerCase().indexOf(q) >= 0) out.cats.push(c);
  });
  out.cats = out.cats.slice(0, 5);
  catalog().forEach(function (l) {
    if (out.items.length >= 5) return;
    if (!q || l.title.toLowerCase().indexOf(q) >= 0) out.items.push(l);
  });
  S.searches.forEach(function (s) {
    if (out.hist.length >= 4) return;
    if (!q || s.toLowerCase().indexOf(q) >= 0) out.hist.push(s);
  });
  return out;
}
function renderSug() {
  var box = document.getElementById('mk2sug');
  if (!box) return;
  if (!suggestOpen) { box.innerHTML = ''; return; }
  var s = suggestions(F.q);
  var h = '';
  if (s.hist.length) {
    h += '<div class="mk2-sug-h">Ты уже искал</div>' + s.hist.map(function (x) {
      return '<button data-mkact="sugq" data-val="' + att(x) + '">' + SVG('clock') + '<span>' + esc(x) + '</span></button>';
    }).join('');
  }
  if (s.items.length) {
    h += '<div class="mk2-sug-h">Объявления</div>' + s.items.map(function (l) {
      return '<button data-mkact="open" data-id="' + att(l.id) + '">' + SVG('briefcase') +
        '<span>' + esc(l.title) + ' · ' + esc(priceText(l)) + '</span></button>';
    }).join('');
  }
  if (s.cats.length) {
    h += '<div class="mk2-sug-h">Разделы биржи</div>' + s.cats.map(function (c) {
      return '<button data-mkact="cat" data-val="' + c.k + '">' + SVG(c.ic) + '<span>' + esc(c.n) + '</span></button>';
    }).join('');
  }
  if (!h) h = '<div class="mk2-sug-h">Совпадений нет — нажми Enter, чтобы искать по всему каталогу</div>';
  box.innerHTML = '<div class="mk2-sug">' + h + '</div>';
}
function hideSug() { suggestOpen = false; renderSug(); }

ACT.sugq = function (id, v) {
  F.q = v;
  hideSug();
  pushSearch(v);
  if (view().v === 'home') paint(); else replace('list', { cat: F.cat });
};
function pushSearch(q) {
  q = (q || '').trim();
  if (!q) return;
  S.searches = [q].concat(S.searches.filter(function (x) { return x !== q; })).slice(0, 8);
  save();
}

/* ============================== 16. РЕНДЕР ================================ */

var PAGES = {
  home: pageHome, list: pageList, allcats: pageAllCats, item: pageItem,
  create: pageCreate, mine: pageMine, fav: pageFav, history: pageHistory, deals: pageDeals
};

function mount() {
  var host = document.getElementById('ma-market');
  if (!host) return false;
  if (host.getAttribute('data-mk3') !== '1') {
    host.setAttribute('data-mk3', '1');
    host.innerHTML = '<div class="mk2" id="mk3Root">' +
      '<div class="mk2-head"><button class="mk2-back" data-mkact="back" data-mk="back">' + SVG('back') +
        '<span id="mk3BackLabel">К сервисам</span></button></div>' +
      '<h2 class="mk2-title" id="mk3Title">Биржа OKO</h2>' +
      '<p class="mk2-sub" id="mk3Sub"></p>' +
      '<div id="marketRoot"></div></div>';
  }
  ensureSheet();
  return true;
}

var painting = false;
function paint(keepScroll) {
  if (painting) return;
  if (!mount()) return;
  painting = true;
  try {
    var st = view();
    var p = (PAGES[st.v] || pageHome)(st);
    var root = document.getElementById('marketRoot');
    var tEl = document.getElementById('mk3Title');
    var sEl = document.getElementById('mk3Sub');
    var bEl = document.getElementById('mk3BackLabel');
    if (tEl) {
      tEl.textContent = p.title || 'Биржа OKO';
      var n = (p.title || '').length;
      tEl.className = 'mk2-title' + (n > 26 ? ' xs' : (n > 16 ? ' sm' : ''));
    }
    if (sEl) { sEl.innerHTML = p.sub || ''; sEl.style.display = p.sub ? '' : 'none'; }
    if (bEl) bEl.textContent = VS.length > 1 ? (p.backLabel || 'Назад') : 'К сервисам';
    if (root) root.innerHTML = p.html || '';
    hookGallery();
    if (!keepScroll) scrollTopNow();
  } catch (e) {
    var r = document.getElementById('marketRoot');
    if (r) {
      r.innerHTML = emptyHTML({
        ic: 'warning', h: 'Раздел не открылся',
        p: 'Что-то пошло не так при отрисовке биржи. Вернись на главную биржи и попробуй снова.',
        actions: '<button class="mk2-btn" data-mkact="home">' + SVG('refresh') + 'На главную биржи</button>'
      });
    }
    if (window.console && console.error) console.error('[oko-market]', e);
  }
  painting = false;
}

function hookGallery() {
  var t = document.getElementById('mk2gal');
  var d = document.getElementById('mk2dots');
  if (!t) return;
  var cnt = t.querySelector('.mk2-galcount');
  t.addEventListener('scroll', function () {
    var i = Math.round(t.scrollLeft / Math.max(1, t.clientWidth));
    if (d) Array.prototype.forEach.call(d.children, function (x, k) { x.classList.toggle('on', k === i); });
    var badge = t.parentElement && t.parentElement.querySelector('.mk2-galcount');
    if (badge) badge.innerHTML = SVG('photo') + (i + 1) + ' / ' + t.children.length;
  }, { passive: true });
}

/* ============================== 17. СОБЫТИЯ =============================== */

document.addEventListener('click', function (e) {
  var b = e.target && e.target.closest ? e.target.closest('[data-mkact]') : null;
  if (!b) {
    /* клик мимо поиска — прячем подсказки */
    if (suggestOpen && !(e.target.closest && e.target.closest('.mk2-searchwrap'))) hideSug();
    return;
  }
  var act = b.getAttribute('data-mkact');
  if (!ACT[act]) return;
  e.preventDefault();
  e.stopPropagation();
  ACT[act](b.getAttribute('data-id'), b.getAttribute('data-val'), b, e);
}, true);

document.addEventListener('input', function (e) {
  var el = e.target;
  if (!el || !el.getAttribute) return;
  var k = el.getAttribute('data-mkinput');
  if (!k) return;
  if (k === 'q') {
    F.q = el.value;
    suggestOpen = true;
    renderSug();
    softResults();
    return;
  }
  if (!W) return;
  var i;
  if (k === 'title') { W.d.title = el.value; softCount(el, 70, 10); }
  else if (k === 'desc') { W.d.desc = el.value; softCount(el, 4000, 30); }
  else if (k === 'price') { W.d.price = el.value.replace(/\D/g, ''); if (el.value !== W.d.price) el.value = W.d.price; }
  else if (k === 'city') W.d.city = el.value;
  else if (k === 'ctg') W.d.contactTg = el.value;
  else if (k === 'cphone') W.d.contactPhone = el.value;
  else if (k === 'speck') { i = Number(el.getAttribute('data-val')); if (W.d.specs[i]) W.d.specs[i].k = el.value; }
  else if (k === 'specv') { i = Number(el.getAttribute('data-val')); if (W.d.specs[i]) W.d.specs[i].v = el.value; }
  wizardSave();
});

document.addEventListener('change', function (e) {
  if (!e.target || e.target.id !== 'mk2file') return;
  var files = e.target.files;
  if (!files || !files.length || !W) return;
  var room = 6 - W.d.photos.length;
  if (room <= 0) { say('Больше 6 фото не поместится'); return; }
  loadPhotos(Array.prototype.slice.call(files).slice(0, room), function (arr) {
    W.d.photos = W.d.photos.concat(arr).slice(0, 6);
    wizardSave();
    paint(true);
    if (arr.length) say(arr.length + ' ' + plural(arr.length, 'фото добавлено', 'фото добавлено', 'фото добавлено'));
  });
  e.target.value = '';
});

document.addEventListener('keydown', function (e) {
  if (e.key !== 'Enter') return;
  var el = e.target;
  if (!el || !el.getAttribute || el.getAttribute('data-mkinput') !== 'q') return;
  e.preventDefault();
  hideSug();
  pushSearch(F.q);
  if (view().v === 'home' || view().v === 'list') paint(true);
  else go('list', { cat: '' });
});

function softCount(el, max, min) {
  var box = el.parentElement && el.parentElement.querySelector('.mk2-cnt');
  if (!box) return;
  var n = el.value.length;
  box.textContent = n + ' / ' + max;
  box.classList.toggle('bad', !!n && (n < min || n > max));
}
function softResults() {
  /* мягкое обновление сетки без перерисовки поля ввода — фокус не теряется */
  var st = view();
  if (st.v !== 'home' && st.v !== 'list') return;
  var grid = document.querySelector('#marketRoot .mk2-grid');
  var res = applyQuery(catalog());
  if (grid && res.length) grid.outerHTML = gridHTML(res);
}

/* ============================== 18. ЭКСПОРТ =============================== */

function enterMarket() {
  injectCSS();
  mount();
  navClearMine();
  VS = [{ v: 'home' }];
  W = null;
  paint();
}

function install() {
  var api = {
    renderMarket: function () { enterMarket(); },
    renderMarketList: function () { paint(true); },
    renderMarketListSoft: function () { paint(true); },
    renderMarketCats: function () { paint(true); },
    openMarketCat: function (k) { openMarket(); F.cat = k || ''; go('list', { cat: k || '' }); },
    mkOpenSearch: function () { openMarket(); setTimeout(function () { var i = document.getElementById('mk2q'); if (i) i.focus(); }, 60); },
    openListing: function (id) { openMarket(); openItem(id); },
    openMyListings: function () { openMarket(); go('mine'); },
    openListingForm: function (id) { openMarket(); startWizard(id || null, ''); },
    toggleFav: function (id) { ACT.fav(id); },
    contactSeller: function (id) { writeSeller(id); },
    orderListing: function (id) { openDealSheet(id); },
    removeListing: function (id) { openDeleteSheet(id); },
    saveListing: function () { /* мастер размещения заменил старую форму */ },
    openFilters: function () { openFiltersSheet(); },
    renderFilters: function () { openFiltersSheet(); },
    applyFilters: function () { ACT.applyf(); },
    resetFilters: function () { resetFiltersState(); paint(true); },
    cycleSort: function () { openSortSheet(); },
    openPromo: function (id) { ACT.bump(id); },
    buyPromo: function (id) { ACT.bump(id); },
    renderListingFav: function () { paint(true); },
    okoMarketOpen: function (id) { openMarket(); if (id) openItem(id); }
  };
  for (var k in api) if (Object.prototype.hasOwnProperty.call(api, k)) {
    try { window[k] = api[k]; } catch (e) {}
  }
}

function openMarket() {
  if (typeof window.showTab === 'function') window.showTab('mini');
  if (typeof window.openMa === 'function') {
    var host = document.getElementById('ma-market');
    if (!host || host.style.display !== 'block') window.openMa('market');
  }
  injectCSS();
  mount();
}

/* --- глубокая ссылка #oko-market/<id> --- */
function checkHash() {
  var m = /^#oko-market\/(.+)$/.exec(location.hash || '');
  if (!m) return;
  var id = decodeURIComponent(m[1]);
  setTimeout(function () {
    openMarket();
    enterMarket();
    if (find(id)) openItem(id);
    else say('Объявление по ссылке не найдено на этом устройстве');
  }, 600);
}

/* --- инициализация --- */
injectCSS();
install();

function boot() {
  injectCSS();
  install();
  mount();
  /* если биржа уже открыта (например, при горячей перезагрузке) — перерисовать */
  var host = document.getElementById('ma-market');
  if (host && host.style.display === 'block') enterMarket();
}
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
else boot();
window.addEventListener('load', function () { install(); mount(); checkHash(); });
setTimeout(install, 0);
setTimeout(install, 400);
setTimeout(install, 1600);
window.addEventListener('hashchange', checkHash);

})();
