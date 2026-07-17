/* ===== NAVSTACK: единый стек навигации — «назад» работает ВЕЗДЕ =====
   Боль: в Telegram Mini App нет браузерных кнопок назад — приходится закрывать
   всё приложение. Модуль ведёт ЕДИНСТВЕННЫЙ источник правды о том, что открыто
   поверх корневых вкладок (стек NV, LIFO), и подключает к нему три «входа»:
     1) системный back браузера/Android (history API + popstate),
     2) Telegram BackButton (window.Telegram.WebApp.BackButton),
     3) клавишу Escape на десктопе.
   Патчи open- и close-функций сохраняют прежнее поведение (chain), синхронизация с
   закрытием крестиком/оверлеем — через nvPop и observers классов .open.

   API (глобальное, префикс nv):
     nvPush(label, closeFn[, stepFn]) — слой открыт (stepFn: внутренний шаг назад,
                                        вернуть true = слой обработал back и остался)
     nvBack()  — закрыть верхний слой (или не-feed вкладка -> feed)
     nvClear() — принудительно закрыть все слои
     nvStackLabels() — отладка: метки стека снизу вверх */

/* ---------- 1. Центральный стек ---------- */
let NV = [];              /* [{label, close, step, tab}] */
let nvClosing = false;    /* close выполняется самим стеком — патчи не трогают NV */
let nvSwallow = 0;        /* сколько ближайших popstate — наши программные history.back() */
let nvTab = 'feed';       /* текущая корневая вкладка */
let nvPrevTab = 'feed';
let nvTg = null;          /* Telegram.WebApp, когда появится */

function nvFind(prefix){
  for(let i = NV.length - 1; i >= 0; i--)
    if(NV[i].label.indexOf(prefix) === 0) return NV[i];
  return null;
}
function nvPush(label, close, step){
  if(nvClosing) return;
  const top = NV[NV.length - 1];
  if(top && top.label === label){ top.close = close; return; } /* повторное открытие того же слоя */
  NV.push({label: label, close: close, step: step || null, tab: nvTab});
  try{ history.pushState({nv: NV.length}, ''); }catch(e){}
  nvUi();
}
/* прямое закрытие (крестик/оверлей/свайп/код) — убрать запись БЕЗ повторного close */
function nvPop(label){
  if(nvClosing) return;
  for(let i = NV.length - 1; i >= 0; i--){
    if(NV[i].label.indexOf(label) === 0){
      NV.splice(i, 1);
      nvDropHistory();
      break;
    }
  }
  nvUi();
}
/* съесть одну history-запись; её popstate — программный, глушим флагом-счётчиком */
function nvDropHistory(){
  nvSwallow++;
  setTimeout(function(){ if(nvSwallow > 0) nvSwallow--; }, 900); /* страховка, если popstate не пришёл */
  try{ history.back(); }catch(e){}
}
function nvArm(){ try{ history.pushState({nv: NV.length}, ''); }catch(e){} }

/* закрыть верхний слой. Возврат: 'step' — слой шагнул внутрь себя и остался,
   'closed' — слой закрыт, false — стек пуст */
function nvBackTop(){
  const rec = NV[NV.length - 1];
  if(!rec) return false;
  if(rec.step){
    let stepped = false;
    nvClosing = true;
    try{ stepped = !!rec.step(); }catch(e){}
    nvClosing = false;
    if(stepped){ nvUi(); return 'step'; }
  }
  NV.pop();
  nvClosing = true;
  try{ rec.close(); }catch(e){}
  nvClosing = false;
  nvUi();
  return 'closed';
}
/* публичный «назад»: TG BackButton, Escape, вызовы из кода */
function nvBack(){
  if(NV.length){
    if(nvBackTop() === 'closed') nvDropHistory();
  } else if(nvTab !== 'feed' && typeof showTab === 'function'){
    showTab('feed');
  }
  nvUi();
}
function nvClear(){
  while(NV.length){
    const rec = NV.pop();
    nvClosing = true;
    try{ rec.close(); }catch(e){}
    nvClosing = false;
    nvDropHistory();
  }
  nvUi();
}
function nvStackLabels(){ return NV.map(function(r){ return r.label; }); }

/* ---------- 2. BROWSER/ANDROID BACK через history API ----------
   История: [корень nvRoot] -> [взведённая nv:0] -> по записи на каждый слой.
   Пользовательский back = popstate: стек непуст -> закрыть верхний слой;
   пуст и вкладка не feed -> feed + перевзвод; пуст на feed -> перевзвод
   (приложение не «выпадает»). Логика ведётся ТОЛЬКО по стеку — глубина в
   state не является источником правды, поэтому рассинхрон самоизлечивается. */
(function nvHistoryInit(){
  try{
    if('scrollRestoration' in history) history.scrollRestoration = 'manual';
    history.replaceState({nvRoot: true}, '');
    history.pushState({nv: 0}, '');
  }catch(e){}
})();

window.addEventListener('popstate', function(ev){
  const atRoot = !!(ev.state && ev.state.nvRoot);
  let armed = false;
  if(nvSwallow > 0){
    nvSwallow--;                       /* наш программный history.back() */
  } else if(NV.length){
    if(nvBackTop() === 'step'){ nvArm(); armed = true; } /* слой остался — вернуть запись */
  } else {
    if(nvTab !== 'feed' && typeof showTab === 'function') showTab('feed');
  }
  if(atRoot && !armed) nvArm();        /* никогда не остаёмся на корне без взведённой записи */
  nvUi();
});

/* Escape на десктопе = «назад» */
document.addEventListener('keydown', function(e){
  if(e.key === 'Escape') nvBack();
});

/* ---------- 3. TELEGRAM BackButton ----------
   tg-webapp подгружает telegram-web-app.js асинхронно ПОСЛЕ navstack —
   поллим появление window.Telegram каждые 500 мс до ~12 c. */
function nvUi(){
  if(!nvTg || !nvTg.BackButton) return;
  try{
    if(NV.length || nvTab !== 'feed') nvTg.BackButton.show();
    else nvTg.BackButton.hide();
  }catch(e){}
}
(function nvTgInit(n){
  const tg = window.Telegram && window.Telegram.WebApp;
  if(tg && tg.BackButton){
    nvTg = tg;
    try{
      if(typeof tg.BackButton.onClick === 'function') tg.BackButton.onClick(function(){ nvBack(); });
      else if(typeof tg.onEvent === 'function') tg.onEvent('backButtonClicked', function(){ nvBack(); });
    }catch(e){}
    nvUi();
    return;
  }
  if(n < 24) setTimeout(function(){ nvTgInit(n + 1); }, 500);
})(0);

/* ---------- 4. ПАТЧИ ЯДРА (chain, прежнее поведение сохраняется) ---------- */

/* вкладки — НЕ стек (корневые разделы), но помним текущую/предыдущую */
if(typeof showTab === 'function'){
  const _nvShowTab = showTab;
  showTab = function(t){
    if(t !== nvTab){ nvPrevTab = nvTab; nvTab = t; }
    _nvShowTab(t);
    nvUi();
  };
}

/* sheets: не стекуются между собой (closeSheet закрывает все) — одна запись, replace */
if(typeof openSheet === 'function' && typeof closeSheet === 'function'){
  const _nvOpenSheet = openSheet, _nvCloseSheet = closeSheet;
  openSheet = function(id){
    _nvOpenSheet(id);
    const r = nvFind('sheet:');
    if(r) r.label = 'sheet:' + id;
    else nvPush('sheet:' + id, function(){ closeSheet(); });
  };
  closeSheet = function(){
    _nvCloseSheet();
    nvPop('sheet:');
  };
}

/* чат-конверсация (только mobile-layout, где появляется .conv-open) */
if(typeof openConv === 'function' && typeof closeConv === 'function'){
  const _nvOpenConv = openConv, _nvCloseConv = closeConv;
  openConv = function(id){
    _nvOpenConv(id);
    const app = document.getElementById('app');
    if(app && app.classList.contains('conv-open') && !nvFind('conv'))
      nvPush('conv', function(){ closeConv(); });
  };
  closeConv = function(){
    _nvCloseConv();
    nvPop('conv');
  };
}

/* мини-аппы (#maGrid -> .ma-view): одна запись, replace при смене вьюхи */
if(typeof openMa === 'function' && typeof closeMa === 'function'){
  const _nvOpenMa = openMa, _nvCloseMa = closeMa;
  openMa = function(id){
    _nvOpenMa(id);
    const r = nvFind('ma:');
    if(r) r.label = 'ma:' + id;
    else nvPush('ma:' + id, function(){ closeMa(); });
  };
  closeMa = function(){
    _nvCloseMa();
    nvPop('ma:');
  };
}

/* попапы core-ext: showPopup сам вызывает closePopup (replace) — глушим
   внутренний вызов флагом, чтобы не гонять history.back()+pushState впритык */
if(typeof showPopup === 'function' && typeof closePopup === 'function'){
  const _nvShowPopup = showPopup, _nvClosePopup = closePopup;
  showPopup = function(o){
    const had = !!nvFind('popup');
    const was = nvClosing;
    nvClosing = true;
    try{ _nvShowPopup(o); } finally { nvClosing = was; }
    if(!had) nvPush('popup', function(){ closePopup(); });
  };
  closePopup = function(){
    _nvClosePopup();
    nvPop('popup');
  };
}

/* HQ-embed (admin-hq уже зовёт nvPush('hq-embed') при открытии) — прямое закрытие */
if(typeof hqCloseEmbed === 'function'){
  const _nvHqCloseEmbed = hqCloseEmbed;
  hqCloseEmbed = function(){
    _nvHqCloseEmbed();
    nvPop('hq-embed');
  };
}

/* ---------- 5. FULLSCREEN-ВЬЮХИ через observers класса .open ----------
   Надёжнее патчей: ловит ЛЮБОЙ путь открытия/закрытия (крестик, оверлей,
   обходные вызовы вроде гейта админки), включая асинхронные (сертификат). */
const NV_VIEWS = [
  /* [id элемента, метка, close, step|null] */
  ['searchView',  'view:search',      function(){ closeSearch(); },      null],
  ['notifsView',  'view:notifs',      function(){ closeNotifs(); },      null],
  ['adminView',   'view:admin',       function(){ closeAdmin(); },       null],
  ['systemView',  'view:system',      function(){ closeSystemView(); },  null],
  ['editProfile', 'view:editProfile', function(){ closeEditProfile(); }, null],
  ['storyViewer', 'story',            function(){ closeStory(); },       null],
  ['msgMenu',     'menu:msg',         function(){ closeMsgMenu(); },     null],
  ['legalView',   'view:legal',       function(){ if(typeof closeLegalDoc==='function') closeLegalDoc(); }, null],
  ['acCertFull',  'view:accert',      function(){ if(typeof acCertFullClose==='function') acCertFullClose(); }, null],
  ['regView',     'view:reg',         function(){ if(typeof regClose==='function') regClose(); },
    /* назад внутри регистрации = шаг назад, с шага 1 — закрыть */
    function(){
      if(typeof REG !== 'undefined' && REG && REG.step > 1 && typeof regBack === 'function'){
        regBack(); return true;
      }
      return false;
    }],
];
function nvSyncView(id, label, close, step){
  const el = document.getElementById(id);
  const open = !!(el && el.classList.contains('open'));
  if(open){ if(!nvFind(label)) nvPush(label, close, step); }
  else nvPop(label); /* записи нет — no-op; после nvBackTop запись уже снята */
}
(function nvViewObservers(){
  NV_VIEWS.forEach(function(v){
    const el = document.getElementById(v[0]);
    if(!el) return;
    try{
      new MutationObserver(function(){ nvSyncView(v[0], v[1], v[2], v[3]); })
        .observe(el, {attributes: true, attributeFilter: ['class']});
    }catch(e){}
  });
})();

/* ---------- 6. ВНУТРЕННЯЯ НАВИГАЦИЯ РАЗДЕЛОВ ---------- */

/* Академия: список курса <-> страница урока (единая точка рендера acRender).
   Кнопка «Академия» в уроке уже есть (.ac-back) — синк идёт через рендер. */
if(typeof acRender === 'function'){
  const _nvAcRender = acRender;
  acRender = function(){
    _nvAcRender();
    if(typeof acView !== 'undefined'){
      if(acView === 'lesson'){
        if(!nvFind('ac:lesson')) nvPush('ac:lesson', function(){ acBackHome(); });
      } else {
        nvPop('ac:lesson');
      }
    }
  };
}

/* Биржа: cats <-> list/fav/пакеты — один внутренний слой 'mk:*' (replace,
   без лишних записей истории). Кнопки «Категории»/«Биржа» (.mk-back) уже есть —
   синк идёт через единую точку рендера renderMarket. */
function nvMkToCats(){ mkView = 'cats'; mkCat = null; renderMarket(); }
function nvMkSlot(label){
  const r = nvFind('mk:');
  if(r){ r.label = label; r.close = nvMkToCats; }
  else nvPush(label, nvMkToCats);
}
if(typeof renderMarket === 'function'){
  const _nvRenderMarket = renderMarket;
  renderMarket = function(){
    _nvRenderMarket();
    if(typeof mkView !== 'undefined'){
      if(mkView === 'list' || mkView === 'fav') nvMkSlot('mk:list');
      else nvPop('mk:'); /* cats = корень биржи, внутренний слой снят */
    }
  };
}

/* Пакеты OKO Production (market-pro): страница поверх биржи, back -> категории */
if(typeof mpOpenPackages === 'function'){
  const _nvMpOpenPackages = mpOpenPackages;
  mpOpenPackages = function(){
    _nvMpOpenPackages();
    nvMkSlot('mk:pack');
  };
}

/* ---------- 7. САМОИНИЦИАЛИЗАЦИЯ: аудит уже открытого ---------- */
(function nvInit(){
  /* если что-то уже открыто к моменту загрузки модуля (авто-restore) — учесть */
  NV_VIEWS.forEach(function(v){ nvSyncView(v[0], v[1], v[2], v[3]); });
  const app = document.getElementById('app');
  if(app && app.classList.contains('conv-open') && !nvFind('conv') && typeof closeConv === 'function')
    nvPush('conv', function(){ closeConv(); });
  const activeScr = document.querySelector('.screen.active');
  if(activeScr && activeScr.id && activeScr.id.indexOf('screen-') === 0)
    nvTab = activeScr.id.slice(7);
  nvUi();
})();
