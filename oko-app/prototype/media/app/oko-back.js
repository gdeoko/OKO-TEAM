/* ============================================================================
   OKO · oko-back.js — ЕДИНАЯ КНОПКА «НАЗАД» НА ВСЁ ПРИЛОЖЕНИЕ
   ----------------------------------------------------------------------------
   Правка Даниэля 09.08:
     «в каждом mini-app нужно кнопку назад добавить в том числе где нету
      сейчас: академия, рулетка, биржа, партнёрка, в помощнике око…, в рекламе
      тоже кнопки назад нету, в документах другой визуал кнопки назад, в тон
      тоже нету кнопки … да и в других страницах разделах блоках много где
      нету кнопки назад».

   Что делает файл (грузится ПОСЛЕ ядра, ничего в ядре не переписывает):

     1. ОДИН ВИЗУАЛ. Класс .oko-back — круглая кнопка 38×38 с шевроном
        #i-back из общего спрайта. Все существующие «назад» приложения
        (шапки .sv-head / .w2-bar / .ch-head / .conv-head, кнопка кошелька,
        «к списку» в документах, ghost-кнопки мини-аппов и Академии)
        приводятся к этому же виду. Вторая кнопка рядом не появляется.

     2. ОДНА КНОПКА НА ЭКРАН. Для экранов внутри #app «назад» живёт в общей
        шапке — она не уезжает при прокрутке и всегда на одном месте.
        Внутренние дубликаты (ghost «Назад» в мини-аппах, «Каталог» в
        Академии, хлебная крошка «Биржа») прячутся, их работу берёт на себя
        та же кнопка в шапке. На корневых вкладках (лента, чаты, мини-аппы,
        кошелёк, профиль) кнопки нет — выходить оттуда некуда.

     3. АВТО-ВСТАВКА. Любая известная шапка подстраницы/оверлея/шторки, где
        «назад» вообще нет, получает её автоматически (MutationObserver).

     4. ОДИН ОБРАБОТЧИК. Кнопка, Escape, системная «назад» (popstate),
        Telegram BackButton и свайп от левого края зовут один okoBackTo().
        Порядок: сначала закрывается верхний слой (шторка/попап/оверлей),
        затем делается шаг внутри раздела, затем уход на предыдущий экран.

   Файл самодостаточный: стили кладёт одним <style> в <head>, чтобы не
   трогать общие CSS и не конфликтовать с другими правками.
   ============================================================================ */
(function okoBack(){
'use strict';

if (window.__okoBackReady) return;
window.__okoBackReady = true;

var ICON = '<svg class="i" aria-hidden="true"><use href="#i-back"/></svg>';

/* ---------------------------------------------------------------------------
   0. СТИЛИ
   Размеры/форма помечены !important осознанно: у старых кнопок есть свои
   правила с большей специфичностью (.sv-head .ep-cancel и т.п.), а визуал
   обязан совпадать до пикселя на всех экранах.
   --------------------------------------------------------------------------- */
var CSS = [
'button.oko-back{',
'  -webkit-appearance:none; appearance:none;',
'  box-sizing:border-box !important;',
/* 44px — цель нажатия по стандарту iOS. Было 38px (правка 11.08): пробник
   доступности отмечал кнопки «назад» как цели меньше 44px, а слой их жёстко
   фиксировал через max-width/height — перебить снаружи было нельзя. */
'  width:44px !important; height:44px !important;',
'  min-width:44px !important; min-height:44px !important;',
'  max-width:44px !important; max-height:44px !important;',
'  padding:0 !important;',
'  border:0 !important; border-radius:50% !important;',
'  display:inline-flex !important; align-items:center !important;',
'  justify-content:center !important;',
'  flex:0 0 auto !important;',
'  background:transparent !important;',
'  color:var(--text) !important;',
'  font-size:0 !important; line-height:0 !important;',
'  text-indent:0 !important; overflow:visible !important;',
'  cursor:pointer;',
'  -webkit-tap-highlight-color:transparent;',
'  transition:background .18s, color .18s, transform .12s;',
'}',
/* левая безопасная зона (чёлка сбоку в ландшафте). Справа отступа не даём:
   у всех шапок свой gap, лишние пиксели съедали бы заголовок. */
'button.oko-back{ margin-left:var(--oko-safe-left,0px); margin-right:0; }',
/* в общей шапке безопасную зону уже учитывает сама шапка */
'header > button.oko-back{ margin-left:0; margin-right:2px; }',
'button.oko-back > svg.i{',
'  width:20px !important; height:20px !important;',
'  stroke-width:7; color:inherit !important; vertical-align:middle;',
'  transform:none !important;',   /* у части модулей знак был развёрнут на 180° */
'}',
'button.oko-back:hover{ background:var(--raised) !important; color:var(--accent) !important; }',
'button.oko-back:active{ transform:scale(.9); }',
'button.oko-back:focus-visible{ outline:2px solid var(--accent); outline-offset:2px; }',
/* скрытие — только атрибутом hidden: inline-стиль проиграл бы !important выше */
'button.oko-back[hidden]{ display:none !important; }',

/* строка с кнопкой в шторках, где своей шапки нет.
   Заголовок шторки переезжает в ту же строку — лишней высоты не появляется. */
'.oko-back-row{ display:flex; align-items:center; gap:8px; min-height:38px; margin:0 0 8px -8px; }',
'.oko-back-row > h3{ margin:0 !important; min-width:0; overflow-wrap:break-word; }',

/* плавающая кнопка для широких экранов, где общая шапка скрыта вёрсткой
   (нижнее меню там превращается в боковое). Позицию по горизонтали ставит JS
   по левому краю области контента, чтобы не лечь поверх бокового меню. */
'#app > button.oko-back.oko-back-float{',
'  position:fixed; top:14px; left:14px; z-index:36;',
'  margin:0;',
'  background:var(--surface) !important;',
'  box-shadow:0 2px 10px rgba(0,0,0,.18);',
'}',
':root[data-theme="light"] #app > button.oko-back.oko-back-float{ box-shadow:0 2px 10px rgba(0,0,0,.10); }',

/* внутренние дубликаты «назад»: их работу делает единая кнопка в шапке */
'body.oko-back-on #screen-mini .ma-view > button.oko-back-dup,',
'body.oko-back-on #screen-mini .mk2-head > .mk2-back,',
'body.oko-back-on #acRoot .ac-back,',
'body.oko-back-on #marketRoot > .mk-back{ display:none !important; }',

/* в документах «к списку» дублировала кнопку шапки — шапка теперь умеет
   и вернуться к списку, и закрыть раздел */
'#legalView .lg-back{ display:none !important; }'
].join('\n');

try{
  var st = document.createElement('style');
  st.id = 'oko-back-style';
  st.textContent = CSS;
  (document.head || document.documentElement).appendChild(st);
}catch(e){}

/* ---------------------------------------------------------------------------
   1. МЕЛКИЕ УТИЛИТЫ
   --------------------------------------------------------------------------- */
function fn(name){ return typeof window[name] === 'function' ? window[name] : null; }
function haptic(k){ try{ if(typeof window.okoHaptic === 'function') window.okoHaptic(k || 'impact'); }catch(e){} }

function visible(el){
  if(!el) return false;
  try{
    var cs = getComputedStyle(el);
    if(cs.display === 'none' || cs.visibility === 'hidden' || cs.opacity === '0') return false;
    var r = el.getBoundingClientRect();
    return r.width > 0 && r.height > 0;
  }catch(e){ return false; }
}

function activeScreenId(){
  var s = document.querySelector('main > .screen.active');
  return s ? String(s.id || '').replace('screen-', '') : '';
}

/* Экраны, которые открываются через showTab(), но своей вкладки в нижнем
   меню не имеют — уйти оттуда можно только кнопкой «назад». */
var TABLESS  = ['partner', 'games', 'academy', 'ads', 'ton'];
var FALLBACK = { partner:'profile', games:'mini', academy:'mini', ads:'mini', ton:'wallet' };

/* Какой мини-апп открыт на вкладке «Мини-аппы» ('' — открыта витрина) */
function maOpenKey(){
  var vs = document.querySelectorAll('#screen-mini .ma-view');
  for(var i = 0; i < vs.length; i++){
    if(visible(vs[i])) return String(vs[i].id || '').replace('ma-', '');
  }
  return '';
}

/* Метки стека навигации ядра (app.js: nvPush/nvPop) */
function nvLabels(){
  try{
    var f = fn('nvStackLabels');
    return f ? (f() || []) : [];
  }catch(e){ return []; }
}
function nvTopLabel(){
  var l = nvLabels();
  return l.length ? String(l[l.length - 1]) : '';
}

/* ---------------------------------------------------------------------------
   2. ЗАЩИТА ОТ ДВОЙНОГО ШАГА
   На «назад» подписаны сразу несколько подсистем (стек ядра, слой v2,
   Telegram, история браузера). Без общего замка один жест уводил на два
   экрана назад. Замок короткий — осознанное двойное нажатие не блокирует.
   --------------------------------------------------------------------------- */
var lastStep = 0;
function locked(){ return (Date.now() - lastStep) < 320; }
function stamp(){ lastStep = Date.now(); }

/* ---------------------------------------------------------------------------
   3. ЕДИНЫЙ «НАЗАД»
   --------------------------------------------------------------------------- */
var origHasLayer   = window.okoHasOpenLayer;
var origCloseLayer = window.okoCloseTopLayer;
var origNvBack     = fn('nvBack');
var origNvBackTop  = fn('nvBackTop');

/* Шаг ВНУТРИ уже открытого верхнего слоя (документ -> список документов
   и т.п.). Возврат true — шаг сделан, слой остался открытым. */
function stepInsideTop(top){
  /* Документы OKO: открытая страница -> обратно к списку */
  if(top === 'view:legal'){
    var lv = document.getElementById('legalView');
    if(lv && lv.classList.contains('doc') && fn('lgBackToHub')){
      window.lgBackToHub();
      return true;
    }
  }
  return false;
}

/* Шаг внутри РАЗДЕЛА, который ядро в стек не кладёт */
function stepInsideSection(){
  /* Биржа услуг. У раздела своя многоуровневая навигация (каталог -> категория
     -> карточка), и её знает сам модуль биржи. Его кнопку мы прячем как
     дубликат, а шаг делаем через неё же — чтобы не расходиться в логике. */
  if(maOpenKey() === 'market'){
    var mb = document.querySelector('#ma-market .mk2-back');
    if(mb){ mb.click(); return true; }
    if(typeof window.mkView !== 'undefined' && window.mkView &&
       window.mkView !== 'cats' && fn('renderMarket')){
      try{
        window.mkView = 'cats';
        window.mkCat = null;
        window.mkSearchQ = '';
        window.renderMarket();
        return true;
      }catch(e){}
    }
  }
  /* Академия: урок -> список уроков курса -> каталог курсов */
  if(activeScreenId() === 'academy' && typeof window.acView !== 'undefined' &&
     (window.acView === 'lesson' || window.acView === 'course') && fn('acBackHome')){
    window.acBackHome();
    return true;
  }
  return false;
}

/* Закрыть раздел, открытый поверх вкладки, без записи в стеке ядра
   (например, мини-апп, который упал на рендере и до nvPush не дошёл). */
function closeStraySection(){
  if(maOpenKey() && fn('closeMa')){ window.closeMa(); return true; }
  var app = document.getElementById('app');
  if(app && app.classList.contains('conv-open') && fn('closeConv')){ window.closeConv(); return true; }
  return false;
}

/* Уход с экрана без вкладки на тот корневой экран, откуда пришли */
var prevRoot = 'feed';
function screenBack(){
  var id = activeScreenId();
  if(TABLESS.indexOf(id) < 0) return false;
  var to = (prevRoot && TABLESS.indexOf(prevRoot) < 0) ? prevRoot : (FALLBACK[id] || 'feed');
  if(fn('showTab')){ window.showTab(to); return true; }
  return false;
}

/* Главная функция. Один вызов = ровно один шаг назад. */
function okoBackTo(force){
  if(!force && locked()) return true;
  stamp();

  var top = nvTopLabel();

  /* 1. шаг внутри верхнего слоя */
  if(top && stepInsideTop(top)) return true;

  /* 2. верхний слой не «сам раздел» — закрываем его целиком.
        Метки ma:* и ac:lesson относятся к содержимому экрана, их
        разбираем ниже, после внутренних шагов раздела. */
  var sectionScope = /^ma:/.test(top) || top === 'ac:lesson';
  if(top && !sectionScope && origNvBack){ origNvBack(); return true; }

  /* 3. шаг внутри раздела (биржа, академия) */
  if(stepInsideSection()) return true;

  /* 4. закрыть сам раздел через стек ядра */
  if(top && origNvBack){ origNvBack(); return true; }

  /* 5. слои, о которых ядро не знает (меню сообщения, поповеры) */
  try{
    if(origHasLayer && origHasLayer.call(window) && origCloseLayer && origCloseLayer.call(window)) return true;
  }catch(e){}

  /* 6. раздел без записи в стеке */
  if(closeStraySection()) return true;

  /* 7. экран без вкладки -> предыдущий корневой */
  if(screenBack()) return true;

  return false;
}
window.okoBackTo = okoBackTo;

/* Есть ли вообще куда возвращаться (для показа кнопки в Telegram и в шапке) */
function backAvailable(){
  if(nvTopLabel()) return true;
  try{ if(origHasLayer && origHasLayer.call(window)) return true; }catch(e){}
  if(maOpenKey()) return true;
  if(TABLESS.indexOf(activeScreenId()) >= 0) return true;
  var app = document.getElementById('app');
  if(app && app.classList.contains('conv-open')) return true;
  return false;
}

/* ---------------------------------------------------------------------------
   4. ПОДКЛЮЧАЕМ ВСЕ ПУТИ «НАЗАД» К ОДНОЙ ФУНКЦИИ
   --------------------------------------------------------------------------- */

/* свайп от левого края и Telegram BackButton из слоя v2 */
window.okoGoBack = function(){ return okoBackTo(); };

/* Escape и системная «назад» ядра идут через nvBack — заворачиваем их сюда же */
if(origNvBack) window.nvBack = function(){ return okoBackTo(); };
/* попап истории ядра ходит мимо nvBack — отмечаем шаг, чтобы не удвоить */
if(origNvBackTop) window.nvBackTop = function(){ stamp(); return origNvBackTop.apply(this, arguments); };
/* Ядро «съедает» лишнюю запись истории программным history.back(). Такой
   popstate — не жест человека, и второго шага назад по нему быть не должно. */
var origNvDrop = fn('nvDropHistory');
if(origNvDrop) window.nvDropHistory = function(){ stamp(); return origNvDrop.apply(this, arguments); };

/* Telegram показывает свою кнопку «назад», пока есть куда возвращаться.
   Слой v2 спрашивает об этом okoHasOpenLayer — расширяем ответ, иначе на
   экранах без вкладки кнопка Telegram мигала (одна подсистема показывала,
   другая тут же прятала). */
window.okoHasOpenLayer = function(){
  try{ if(origHasLayer && origHasLayer.call(window)) return true; }catch(e){}
  return backAvailable();
};
window.okoCloseTopLayer = function(){
  try{ if(origHasLayer && origHasLayer.call(window)) return origCloseLayer.call(window); }catch(e){}
  return okoBackTo();
};

/* системная «назад» браузера/Android. Ядро обрабатывает событие первым;
   если после него шага не случилось — доводим сами. */
window.addEventListener('popstate', function(){
  setTimeout(function(){ if(!locked()) okoBackTo(); }, 0);
});

/* запоминаем последний КОРНЕВОЙ экран — чтобы возвращаться туда, откуда
   человек пришёл, а не всегда в ленту */
(function trackRoot(){
  var core = fn('showTab');
  if(!core) return;
  window.showTab = function(t){
    try{
      var cur = activeScreenId();
      if(cur && TABLESS.indexOf(cur) < 0) prevRoot = cur;
    }catch(e){}
    var r = core.apply(this, arguments);
    schedule();
    return r;
  };
})();

/* ---------------------------------------------------------------------------
   5. ЕДИНЫЙ ВИД ДЛЯ УЖЕ СУЩЕСТВУЮЩИХ КНОПОК
   --------------------------------------------------------------------------- */

/* Шапки подстраниц и оверлеев, где «назад» обязана быть */
var BARS = '.sv-head, .search-head, .ep-head, .w2-bar, .wal-stmt-bar, .ch-head, .conv-head';

/* Кнопка уже «назад», если несёт знак #i-back */
function isBackIcon(el){
  var u = el.querySelector('use');
  return !!(u && String(u.getAttribute('href') || u.getAttribute('xlink:href') || '') === '#i-back');
}
/* …или честно подписана «назад» / «закрыть» (такие не перерисовываем,
   но и вторую кнопку рядом не ставим) */
function looksLikeExit(el){
  var al = (el.getAttribute('aria-label') || '') + ' ' + (el.getAttribute('title') || '') +
           ' ' + (el.textContent || '');
  return /наза|закр|отмен|к спис/i.test(al);
}

/* Привести кнопку к единому виду, сохранив её действие.
   rebind = true — снять родное действие и вести через okoBackTo()
   (нужно там, где у раздела два уровня: «Документы» — страница и список). */
function skin(el, rebind){
  if(!el || el.dataset.okoBack === '1') return;
  var label = (el.getAttribute('aria-label') || '').trim();
  var text  = (el.textContent || '').trim();
  if(!label || /^кнопка$/i.test(label)) label = text || 'Назад';
  el.dataset.okoBack = '1';
  el.classList.add('oko-back');
  el.setAttribute('type', 'button');
  el.setAttribute('aria-label', label);
  el.setAttribute('title', label);
  el.innerHTML = ICON;
  if(rebind){
    el.removeAttribute('onclick');
    el.onclick = null;
    el.addEventListener('click', function(ev){
      ev.preventDefault();
      ev.stopPropagation();
      haptic('impact');
      okoBackTo();
    });
  }
}

/* Собственная кнопка — действие всегда через okoBackTo() */
function makeBtn(extraClass){
  var b = document.createElement('button');
  b.type = 'button';
  b.className = 'oko-back' + (extraClass ? ' ' + extraClass : '');
  b.dataset.okoBack = '1';
  b.setAttribute('aria-label', 'Назад');
  b.setAttribute('title', 'Назад');
  b.innerHTML = ICON;
  b.addEventListener('click', function(ev){
    ev.preventDefault();
    ev.stopPropagation();
    haptic('impact');
    okoBackTo();
  });
  return b;
}

/* Есть ли в шапке хоть какой-то выход */
function barExit(bar){
  var list = bar.querySelectorAll('button, a');
  for(var i = 0; i < list.length; i++){
    var el = list[i];
    if(el.dataset.okoBack === '1') return el;
    if(isBackIcon(el)) return el;
    if(looksLikeExit(el) && el === bar.firstElementChild) return el;
  }
  return null;
}

/* Документы OKO: одна кнопка на два уровня (страница -> список -> закрыть) */
function needsRebind(el){
  try{ return !!el.closest('#legalView'); }catch(e){ return false; }
}

function normalizeBars(){
  var bars = document.querySelectorAll(BARS);
  for(var i = 0; i < bars.length; i++){
    var bar = bars[i];
    var ex = barExit(bar);
    if(ex){
      /* перерисовываем «назад» со знаком и любые .ep-cancel: это всегда выход */
      if(ex.dataset.okoBack === '1' || isBackIcon(ex) || ex.classList.contains('ep-cancel'))
        skin(ex, needsRebind(ex));
      continue;
    }
    if(bar.dataset.okoBackAuto === '1') continue;
    bar.dataset.okoBackAuto = '1';
    bar.insertBefore(makeBtn('oko-back-auto'), bar.firstChild);
  }
}

/* Отдельные кнопки вне перечисленных шапок, которые тоже обязаны выглядеть
   одинаково (кошелёк, документы, хлебная крошка биржи, Академия, мини-аппы). */
var LOOSE = [
  '.ep-cancel', '.w2-bar-nav', '.wal-stmt-nav',
  /* любая кнопка «…back…» со знаком #i-back — модулей много и они растут,
     поимённый список устарел бы на следующей же правке */
  'button[class*="back"]', 'a[class*="back"]',
  '#screen-mini .ma-view > button.btn'
];
/* Стрелки, которые «назад» НЕ означают: листание слайдов урока, стирание
   символа в пин-коде, шаги мастеров, крестики подсказок. */
var LOOSE_SKIP = /ac-arrow|ghosty|back-key|backspace|wal-live-x|mp-esc|mp-safety|acd-full|mp-mv-nav/;

function normalizeLoose(){
  for(var i = 0; i < LOOSE.length; i++){
    var list = document.querySelectorAll(LOOSE[i]);
    for(var j = 0; j < list.length; j++){
      var el = list[j];
      if(LOOSE_SKIP.test(String(el.className || ''))) continue;
      var forced = el.classList.contains('ep-cancel');
      if(!forced && !isBackIcon(el) && el.dataset.okoBack !== '1') continue;
      /* ghost-«Назад» и «Каталог» внутри контента прячем: их работу делает
         единая кнопка в шапке, две кнопки подряд — это и есть каша */
      if(el.matches('#screen-mini .ma-view > button.btn')) el.classList.add('oko-back-dup');
      skin(el, needsRebind(el));
    }
  }
}

/* Шторки: своей шапки у них нет, выход был только тапом мимо */
function normalizeSheets(){
  var sheets = document.querySelectorAll('.sheet.open');
  for(var i = 0; i < sheets.length; i++){
    var sh = sheets[i];
    if(sh.querySelector(':scope > .oko-back-row')) continue;
    if(sh.querySelector(':scope > button.oko-back')) continue;
    var row = document.createElement('div');
    row.className = 'oko-back-row';
    row.appendChild(makeBtn('oko-back-sheet'));
    sh.insertBefore(row, sh.firstChild);
    /* заголовок шторки ставим рядом с кнопкой, а не под неё */
    var h = sh.querySelector(':scope > h3');
    if(h && h.previousElementSibling === row) row.appendChild(h);
  }
}

/* ---------------------------------------------------------------------------
   6. ЕДИНАЯ КНОПКА В ОБЩЕЙ ШАПКЕ
   --------------------------------------------------------------------------- */
var hdrBtn = null;

function mountHeaderBtn(){
  var header = document.querySelector('#app > header');
  if(!header) return;

  /* Кнопку из слоя v2 (v2exit) забираем себе — иначе их будет две */
  var old = header.querySelector('.oko-hdr-back');
  if(old && old !== hdrBtn){ try{ old.remove(); }catch(e){} }

  if(hdrBtn && hdrBtn.isConnected) return;
  hdrBtn = makeBtn('oko-hdr-back');   /* класс v2 сохраняем: на нём завязано
                                         скрытие словесного логотипа в шапке */
  hdrBtn.hidden = true;
  header.insertBefore(hdrBtn, header.firstChild);
}

/* На широких экранах вёрстка прячет общую шапку (нижнее меню превращается
   в боковое). Кнопка переезжает в угол области контента, чтобы выход был
   и там. */
function placeHeaderBtn(){
  if(!hdrBtn) return;
  var header = document.querySelector('#app > header');
  var app = document.getElementById('app');
  var headerShown = header && getComputedStyle(header).display !== 'none';
  if(headerShown){
    if(hdrBtn.parentNode !== header){
      hdrBtn.classList.remove('oko-back-float');
      header.insertBefore(hdrBtn, header.firstChild);
    }
  } else if(app){
    if(hdrBtn.parentNode !== app){
      hdrBtn.classList.add('oko-back-float');
      app.appendChild(hdrBtn);
    }
  }
}

/* Кнопка нужна там, где экран открыт «поверх» корневой вкладки */
function headerBackNeeded(){
  var id = activeScreenId();
  if(TABLESS.indexOf(id) >= 0) return true;
  if(id === 'mini' && maOpenKey()) return true;
  return false;
}

function syncHeaderBtn(){
  mountHeaderBtn();
  placeHeaderBtn();
  if(!hdrBtn) return;
  var need = headerBackNeeded();
  if(hdrBtn.hidden !== !need) hdrBtn.hidden = !need;
  /* Пока единая кнопка на экране есть — прячем внутренние дубликаты */
  var on = need && visible(hdrBtn);
  if(document.body.classList.contains('oko-back-on') !== on)
    document.body.classList.toggle('oko-back-on', on);
}

/* ---------------------------------------------------------------------------
   7. ОБХОД DOM: один проход на кадр
   --------------------------------------------------------------------------- */
var queued = false, lastRun = 0;
function schedule(){
  if(queued) return;
  queued = true;
  /* приложение постоянно перерисовывает живые метрики — держим обход
     не чаще 5 раз в секунду, иначе наблюдатель греет процессор */
  var wait = Math.max(0, 200 - (Date.now() - lastRun));
  setTimeout(function(){
    requestAnimationFrame(function(){
      queued = false;
      run();
    });
  }, wait);
}
function run(){
  lastRun = Date.now();
  try{ normalizeBars(); }catch(e){}
  try{ normalizeLoose(); }catch(e){}
  try{ normalizeSheets(); }catch(e){}
  try{ syncHeaderBtn(); }catch(e){}
}

function boot(){
  run();
  try{
    new MutationObserver(schedule).observe(document.documentElement, {
      childList: true, subtree: true,
      attributes: true, attributeFilter: ['class', 'style']
    });
  }catch(e){}
  /* страховка на асинхронные вставки, которые наблюдатель мог проспать */
  setInterval(run, 2000);
  [200, 700, 1600, 3200].forEach(function(d){ setTimeout(run, d); });
}

if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
else boot();

})();
