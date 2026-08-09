/* ============================================================================
   OKO · probe-onb2.mjs — пробник первого входа, поиска и уведомлений
   ----------------------------------------------------------------------------
   Проверяет то, что делает oko-onb2.js, и то, что вокруг него обязано остаться
   целым. Три вьюпорта, чистый первый вход без пропуска авторизации, все ветки
   провайдеров, поиск по каждому типу сущностей, уведомления с фильтрами.

   На каждом экране автоматически ищем:
     • горизонтальное переполнение страницы и блоков
     • обрезанный текст (реальная ширина больше видимой)
     • переносы посреди слова (word-break:break-all без .oko-breakable)
     • заезд под шапку Telegram и под нижний бар
     • отсутствие выхода (кнопки «назад» / закрытия)
     • пустой экран (отрисовался, а контента нет)

   Запуск:
     python3 -m http.server 8199 --bind 127.0.0.1   (из oko-app/prototype)
     node oko-app/tools/probe-onb2.mjs
   ============================================================================ */
import { chromium } from 'playwright-core';
import fs from 'node:fs/promises';
import path from 'node:path';

const BASE = process.env.ONB2_BASE || 'http://127.0.0.1:8199/index.html';
const OUT  = path.resolve('oko-app/tools');
const EXEC = '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';

const TG_HEADER = 56;   /* полоса, которую Telegram рисует сверху */
const TG_BOTTOM = 34;

const ALL_VIEWPORTS = [
  { id: 'phone',   label: 'Телефон 390',  width: 390,  height: 844,  mobile: true  },
  { id: 'narrow',  label: 'Узкий 360',    width: 360,  height: 740,  mobile: true  },
  { id: 'tablet',  label: 'Планшет 820',  width: 820,  height: 1180, mobile: false },
  { id: 'desktop', label: 'ПК 1440',      width: 1440, height: 900,  mobile: false },
];
/* ONB2_VP=phone,tablet — прогнать только выбранные вьюпорты
   ONB2_SC=search,notifs — только выбранные сценарии */
const VP_FILTER = (process.env.ONB2_VP || '').split(',').map(s => s.trim()).filter(Boolean);
const VIEWPORTS = VP_FILTER.length
  ? ALL_VIEWPORTS.filter(v => VP_FILTER.includes(v.id))
  : ALL_VIEWPORTS.filter(v => v.id !== 'tablet');   /* планшет — отдельным прогоном */

/* --------------------------------------------------------------------------
   Скрипт до загрузки страницы.
   tg=true — эмуляция Telegram Mini App (нужна для ветки «Продолжить в Telegram»).
   skip=true — пропуск авторизации (как в audit.mjs) для внутренних экранов.
   -------------------------------------------------------------------------- */
function initScript({ tg = false, skip = false } = {}) {
  return `
    window.okoSkipAuth = function(){
      try{ localStorage.setItem('oko-auth','tg'); }catch(e){}
      var a=document.getElementById('authScreen'); if(a){a.classList.add('hidden'); a.style.display='none';}
      var s=document.getElementById('splash'); if(s){s.classList.add('gone'); s.style.display='none';}
      var o=document.getElementById('onboard'); if(o){o.classList.add('hidden'); o.style.display='none';}
    };
    ${skip ? `try{
      localStorage.setItem('oko-auth','tg');
      localStorage.setItem('oko-onboarded','1');
      localStorage.setItem('oko-stories-seen','1');
      localStorage.setItem('oko-tour-done','1');
      localStorage.setItem('oko-tour','1');
      localStorage.setItem('oko-onb2-intro', JSON.stringify({done:true,skipped:false,role:'author',interests:['content'],goal:'grow',at:Date.now()}));
    }catch(e){}` : ''}
    ${tg ? `(function(){
      var handlers = {};
      window.Telegram = { WebApp: {
        initData: 'query_id=OKOPROBE&user=%7B%22id%22%3A1%7D&auth_date=1&hash=x',
        initDataUnsafe: { user: { id: 1, first_name: 'Тест', username: 'okoprobe' } },
        version: '8.0', platform: 'android', colorScheme: 'dark',
        isExpanded: true, isFullscreen: false,
        viewportHeight: 700, viewportStableHeight: 700,
        safeAreaInset: { top: 0, bottom: ${TG_BOTTOM}, left: 0, right: 0 },
        contentSafeAreaInset: { top: 0, bottom: 0, left: 0, right: 0 },
        themeParams: {},
        ready(){}, expand(){}, close(){},
        requestFullscreen(){ window.__okoFullscreenRequested = true; },
        exitFullscreen(){}, disableVerticalSwipes(){}, enableVerticalSwipes(){},
        lockOrientation(){}, unlockOrientation(){},
        setHeaderColor(){}, setBackgroundColor(){}, setBottomBarColor(){},
        openTelegramLink(u){ window.__okoTgLink = u; },
        onEvent(n,f){ (handlers[n]=handlers[n]||[]).push(f); }, offEvent(){},
        HapticFeedback: { impactOccurred(){}, notificationOccurred(){}, selectionChanged(){} },
        BackButton: { isVisible:false, show(){this.isVisible=true;}, hide(){this.isVisible=false;}, onClick(){}, offClick(){} },
        MainButton: { show(){}, hide(){}, setText(){}, onClick(){} },
        CloudStorage: { getItem(k,cb){cb&&cb(null,null);}, setItem(k,v,cb){cb&&cb(null,true);} },
      }};
    })();` : ''}
  `;
}

/* --------------------------------------------------------------------------
   Аудит экрана прямо в странице
   -------------------------------------------------------------------------- */
const AUDIT = `(function(opt){
  var tgTop = opt.tgTop || 0, tgBottom = opt.tgBottom || 0;
  var out = { overflowX: 0, issues: [], visibleText: 0, exits: 0 };
  var de = document.documentElement;
  out.overflowX = Math.max(0, de.scrollWidth - de.clientWidth);
  var W = window.innerWidth, H = window.innerHeight;
  var TG = !!tgBottom;

  function vis(el){
    var cs = getComputedStyle(el);
    if(cs.display === 'none' || cs.visibility === 'hidden' || cs.opacity === '0') return false;
    var r = el.getBoundingClientRect();
    if(r.width <= 0 || r.height <= 0) return false;
    /* закрытые оверлеи стоят за краем экрана — человек их не видит */
    if(r.left >= W - 1 || r.right <= 1) return false;
    if(r.top >= H - 1 || r.bottom <= 1) return false;
    return true;
  }
  function label(el){
    var t = (el.id ? '#' + el.id : '') + (el.className && typeof el.className === 'string'
      ? '.' + el.className.trim().split(/\s+/).slice(0,3).join('.') : '');
    return (el.tagName.toLowerCase() + t).slice(0, 90);
  }
  function inScroller(el){
    for(var p = el.parentElement, d = 0; p && d < 6; p = p.parentElement, d++){
      var pcs = getComputedStyle(p);
      if(pcs.overflowX === 'auto' || pcs.overflowX === 'scroll') return true;
    }
    return false;
  }

  /* верхний открытый слой: по нему считаем «есть ли выход» и «пусто ли» */
  var scope = null;
  var layers = ['.onb2-scrim.on', '#onb2Intro.on', '.okg-scrim', '#storyViewer.open', '#trStories.ts-on',
                '#searchView.open', '#notifsView.open', '#regView.open',
                '#authScreen:not(.hidden)', '#onboard:not(.hidden)'];
  for(var li = 0; li < layers.length; li++){
    var cand = document.querySelector(layers[li]);
    if(cand && vis(cand)){ scope = cand; break; }
  }
  if(!scope) scope = document.querySelector('main > .screen.active') || document.body;
  out.scope = label(scope);

  /* проверяем ВСЮ страницу — дефект вёрстки виден и за пределами слоя.
     Потолок высокий: оверлеи соседних слоёв висят в самом конце body и при
     лимите в 4000 узлов просто не попадали в обход. */
  var nodes = Array.prototype.slice.call(document.body.querySelectorAll('*'), 0, 20000);
  /* «наше» — экраны, за которые отвечает oko-onb2.js */
  var MINE = '#onb2Intro, .onb2-scrim, #searchView, #notifsView, #authScreen, #rg2Shell, .onb2-codehint';
  function mine(el){
    try{ return !!(el.closest && el.closest(MINE)); }catch(e){ return false; }
  }
  for(var i = 0; i < nodes.length; i++){
    var el = nodes[i];
    if(el.ownerSVGElement) continue;                     /* геометрия внутри svg не в раскладке */
    if(el.id === 'okoTgChrome') continue;
    if(!vis(el)) continue;
    var r = el.getBoundingClientRect();
    var cs = getComputedStyle(el);
    var txt = (el.textContent || '').trim();

    /* блок вылезает за правый край */
    if(!inScroller(el) && r.right > W + 1 && r.width < W * 1.6){
      out.issues.push({ kind:'out-right', el: label(el), mine: mine(el), by: Math.round(r.right - W) });
    }

    if(txt && el.children.length === 0){
      /* текст обрезан по горизонтали без многоточия */
      var intentional = cs.textOverflow === 'ellipsis' || cs.webkitLineClamp !== 'none';
      if(!intentional && el.scrollWidth > el.clientWidth + 2 && cs.overflow !== 'visible'){
        out.issues.push({ kind:'clip-x', el: label(el), mine: mine(el), text: txt.slice(0,48),
                          by: el.scrollWidth - el.clientWidth });
      }
      /* текст обрезан по высоте без многоточия и без line-clamp */
      if(!intentional && el.scrollHeight > el.clientHeight + 3 &&
         (cs.overflowY === 'hidden' || cs.overflow === 'hidden')){
        out.issues.push({ kind:'clip-y', el: label(el), mine: mine(el), text: txt.slice(0,48),
                          by: el.scrollHeight - el.clientHeight });
      }
      /* перенос посреди слова */
      if(cs.wordBreak === 'break-all' && !el.classList.contains('oko-breakable') &&
         /[А-Яа-яA-Za-z]{4,}/.test(txt)){
        out.issues.push({ kind:'break-all', el: label(el), mine: mine(el), text: txt.slice(0,40) });
      }
    }

    /* заезд под интерфейс Telegram: в fullsize вебвью уже под шапкой,
       поэтому «под шапкой» = уехал выше нуля */
    if(cs.position === 'fixed' || cs.position === 'sticky'){
      if(r.top < -1 && r.bottom > 2){
        out.issues.push({ kind:'under-tg-top', el: label(el), mine: mine(el), top: Math.round(r.top) });
      }
      var fullBleed = r.top <= 1 && r.bottom >= H - 1;
      if(TG && !fullBleed && r.bottom > H - tgBottom + 1 && r.top < H - 2 &&
         cs.zIndex !== 'auto' && +cs.zIndex > 40){
        out.issues.push({ kind:'under-tg-bottom', el: label(el), mine: mine(el), bottom: Math.round(r.bottom) });
      }
    }
  }

  /* видимый текст активного слоя */
  out.visibleText = (scope.innerText || '').trim().length;

  /* есть ли выход из активного слоя */
  var exitSel = '.oko-back, .ep-cancel, [data-close], .onb2-sheet-x, .onb2-skip, .sv-close, .ob-skip,' +
                ' .okg-x, .ts-close, [data-in="skip"], [data-in="done"]';
  var ex = scope.querySelectorAll ? scope.querySelectorAll(exitSel) : [];
  for(var k = 0; k < ex.length; k++) if(vis(ex[k])) out.exits++;
  /* корневая вкладка — выход не нужен: снизу меню.
     Экран входа и онбординг ядра — точка входа в приложение, возвращаться
     из них некуда: «выход» оттуда — это сам вход. */
  if(scope.matches && (scope.matches('main > .screen.active') ||
     scope.id === 'authScreen' || scope.id === 'onboard')) out.exits = out.exits || 1;

  /* две кнопки «назад» в одной шапке */
  var heads = document.querySelectorAll('.sv-head, .search-head, .onb2-in-head');
  Array.prototype.forEach.call(heads, function(h){
    if(!vis(h)) return;
    var n = 0;
    Array.prototype.forEach.call(h.querySelectorAll('.oko-back, .ep-cancel'), function(b){ if(vis(b)) n++; });
    if(n > 1) out.issues.push({ kind:'double-back', el: label(h), mine: mine(h), n: n });
  });

  /* дедуп */
  var seen = {};
  out.issues = out.issues.filter(function(x){
    var k2 = x.kind + '|' + x.el;
    if(seen[k2]) return false; seen[k2] = 1; return true;
  }).slice(0, 20);

  return out;
})`;

/* --------------------------------------------------------------------------
   Сценарии
   -------------------------------------------------------------------------- */

/* Чистый первый вход: без пропуска авторизации, пустой localStorage */
const FIRST_RUN = {
  id: 'first-run',
  name: 'Чистый первый вход',
  init: { tg: true, skip: false },
  steps: [
    { id: '01-auth',        name: 'Экран запуска и вход', wait: 2600, run: null },
    { id: '02-google-soon', name: 'Google: честный отказ', wait: 700,
      run: `doLogin('google')`,
      expect: `(function(){
        var s = document.querySelector('.onb2-scrim.on');
        var authed = false; try{ authed = !!localStorage.getItem('oko-auth'); }catch(e){}
        return { sheet: !!s, text: s ? s.innerText.slice(0,160) : '', falseLogin: authed };
      })()` },
    { id: '03-google-close',name: 'Отказ закрывается',    wait: 500,
      run: `document.querySelector('.onb2-scrim .onb2-sheet-x').click()`,
      expect: `({ sheetGone: !document.querySelector('.onb2-scrim.on') })` },
    { id: '04-apple-soon',  name: 'Apple: честный отказ',  wait: 600,
      run: `doLogin('apple')`,
      expect: `(function(){ var s=document.querySelector('.onb2-scrim.on'); return { sheet: !!s }; })()` },
    { id: '05-phone',       name: 'Телефон или почта',     wait: 900,
      run: `document.querySelector('.onb2-scrim .onb2-btn[data-a="1"]') ?
              document.querySelector('.onb2-scrim .onb2-btn[data-a="1"]').click() : doLogin('phone')`,
      expect: `({ rg2: !!document.querySelector('#rg2Shell.open') })` },
    { id: '06-code',        name: 'Честная подсказка про код', wait: 1200,
      run: `(function(){
        var c = document.getElementById('rg2Contact'); if(c) c.value = 'probe@oko.test';
        var p = document.getElementById('rg2Pass');    if(p) p.value = 'okoprobe123';
        var p2= document.getElementById('rg2Pass2');   if(p2) p2.value = 'okoprobe123';
        if(typeof rg2Next1 === 'function') rg2Next1();
      })()`,
      expect: `(function(){
        var h = document.querySelector('.onb2-codehint');
        return { hint: !!h, text: h ? h.innerText.replace(/\\s+/g,' ').slice(0,120) : '' };
      })()` },
    { id: '07-tg-login',    name: 'Вход через Telegram',   wait: 1800,
      run: `(function(){
        if(typeof rg2Exit === 'function') rg2Exit();
        doLogin('telegram');
      })()`,
      expect: `(function(){
        var a = document.getElementById('authScreen');
        return { authHidden: !!(a && a.classList.contains('hidden')),
                 onboard: !!document.querySelector('#onboard:not(.hidden)') };
      })()` },
    { id: '08-onboard',     name: 'Онбординг ядра',        wait: 900, run: null },
    { id: '09-intro',       name: 'Знакомство · вопрос 1', wait: 2200,
      run: `(function(){
        /* проматываем 7 слайдов онбординга ядра */
        for(var i=0;i<9;i++){ try{ if(typeof obNext==='function') obNext(); }catch(e){} }
      })()`,
      expect: `({ intro: !!document.querySelector('#onb2Intro.on'),
                  head: (document.querySelector('#onb2Stage .onb2-h')||{}).textContent || '' })` },
    { id: '10-intro-2',     name: 'Знакомство · вопрос 2', wait: 600,
      run: `(function(){
        var b = document.querySelector('#onb2Stage [data-in="role"][data-v="author"]'); b && b.click();
        var n = document.querySelector('#onb2Foot [data-in="next"]'); n && n.click();
      })()`,
      expect: `({ head: (document.querySelector('#onb2Stage .onb2-h')||{}).textContent || '' })` },
    { id: '11-intro-3',     name: 'Знакомство · вопрос 3', wait: 600,
      run: `(function(){
        ['content','ai'].forEach(function(v){
          var b = document.querySelector('#onb2Stage [data-in="int"][data-v="'+v+'"]'); b && b.click();
        });
        var n = document.querySelector('#onb2Foot [data-in="next"]'); n && n.click();
      })()`,
      expect: `({ head: (document.querySelector('#onb2Stage .onb2-h')||{}).textContent || '' })` },
    { id: '12-intro-plan',  name: 'Знакомство · первый шаг', wait: 700,
      run: `(function(){
        var b = document.querySelector('#onb2Stage [data-in="goal"][data-v="grow"]'); b && b.click();
        var n = document.querySelector('#onb2Foot [data-in="next"]'); n && n.click();
      })()`,
      expect: `(function(){
        var m = document.querySelector('.onb2-plan-main');
        return { plan: !!m, text: m ? m.innerText.replace(/\\s+/g,' ').slice(0,110) : '' };
      })()` },
    { id: '12b-light',      name: 'Знакомство · светлая тема', wait: 800,
      run: `(function(){ if(typeof applyTheme==='function') applyTheme('light'); })()`,
      expect: `({ theme: document.documentElement.getAttribute('data-theme'),
                  intro: !!document.querySelector('#onb2Intro.on') })` },
    { id: '12c-dark',       name: 'Знакомство · тёмная тема', wait: 600,
      run: `(function(){ if(typeof applyTheme==='function') applyTheme('dark'); })()`,
      expect: `({ theme: document.documentElement.getAttribute('data-theme') })` },
    { id: '13-feed',        name: 'Дошли до ленты',        wait: 1600,
      run: `(function(){
        var d = document.querySelector('#onb2Foot [data-in="done"]'); d && d.click();
        /* закрыть всё, что могло всплыть поверх (сторис/тур) */
        try{ if(typeof trStoriesClose==='function') trStoriesClose(); }catch(e){}
        try{ if(typeof closePopup==='function') closePopup(); }catch(e){}
        try{ if(typeof showTab==='function') showTab('feed'); }catch(e){}
      })()`,
      expect: `(function(){
        var s = document.getElementById('screen-feed');
        var st = null; try{ st = JSON.parse(localStorage.getItem('oko-onb2-intro')); }catch(e){}
        var reg = null; try{ reg = JSON.parse(localStorage.getItem('oko-registration')); }catch(e){}
        return { feedActive: !!(s && s.classList.contains('active')),
                 introSaved: !!(st && (st.done || st.skipped)),
                 goal: st && st.goal, interests: (reg && reg.interests) || [],
                 introOpen: !!document.querySelector('#onb2Intro.on') };
      })()` },
  ]
};

/* Полная регистрация по почте: rg2 не зовёт doLogin, знакомство должно
   подхватиться отдельно — иначе половина новых людей его не увидит */
const REG_PHONE = {
  id: 'reg-mail',
  name: 'Регистрация по почте до конца',
  init: { tg: false, skip: false },
  steps: [
    { id: '01-auth',   name: 'Экран входа',        wait: 2600, run: null },
    { id: '02-form',   name: 'Контакт и пароль',   wait: 900,
      run: `(function(){
        doLogin('phone');
        setTimeout(function(){
          var c = document.getElementById('rg2Contact'); if(c) c.value = 'probe@oko.test';
          var p = document.getElementById('rg2Pass');    if(p) p.value = 'okoprobe123';
          var q = document.getElementById('rg2Pass2');   if(q) q.value = 'okoprobe123';
        }, 120);
      })()`,
      expect: `({ rg2: !!document.querySelector('#rg2Shell.open') })` },
    { id: '03-code',   name: 'Код на экране',      wait: 1200,
      run: `(function(){ if(typeof rg2Next1==='function') rg2Next1(); })()`,
      expect: `(function(){
        var h = document.querySelector('.onb2-codehint');
        var sub = document.querySelector('#rg2Step2 .rg2-sub');
        return { hint: !!h, sub: sub ? sub.innerText.replace(/\\s+/g,' ').slice(0,60) : '' };
      })()` },
    { id: '04-profile',name: 'Профиль',            wait: 900,
      run: `(function(){
        var inputs = document.querySelectorAll('#rg2Code input');
        var code = (typeof RG2 !== 'undefined' && RG2.code) ? String(RG2.code) : '000000';
        inputs.forEach(function(i, k){ i.value = code[k] || '0'; });
        if(typeof rg2Next2==='function') rg2Next2();
      })()`,
      expect: `({ step3: !!document.querySelector('#rg2Step3.on, #rg2Step3') })` },
    { id: '05-tier',   name: 'Тариф',              wait: 900,
      run: `(function(){
        var n = document.getElementById('rg2Name'); if(n){ n.value = 'Пробник'; if(typeof rg2NameInput==='function') rg2NameInput(); }
        var k = document.getElementById('rg2Nick'); if(k){ k.value = 'probe_user_9'; if(typeof rg2NickInput==='function') rg2NickInput(); }
        setTimeout(function(){ if(typeof rg2Next3==='function') rg2Next3(); }, 500);
      })()`,
      expect: `({ step4: !!document.getElementById('rg2Step4') })` },
    { id: '06-finish', name: 'Готово — знакомство', wait: 4200,
      run: `(function(){
        if(typeof rg2Skip==='function') rg2Skip(); else if(typeof rg2Next4==='function') rg2Next4();
        /* приветственный попап ядра закрываем как человек — знакомство ждёт его */
        setTimeout(function(){ try{ if(typeof closePopup==='function') closePopup(); }catch(e){} }, 1200);
      })()`,
      expect: `(function(){
        return { intro: !!document.querySelector('#onb2Intro.on'),
                 authed: !!localStorage.getItem('oko-auth'),
                 head: (document.querySelector('#onb2Stage .onb2-h')||{}).textContent || '' };
      })()` },
    { id: '07-skip',   name: 'Знакомство пропускается', wait: 1400,
      run: `(function(){ var s = document.querySelector('#onb2Intro [data-in="skip"]'); s && s.click(); })()`,
      expect: `(function(){
        var st = null; try{ st = JSON.parse(localStorage.getItem('oko-onb2-intro')); }catch(e){}
        return { closed: !document.querySelector('#onb2Intro.on'), skipped: !!(st && st.skipped) };
      })()` },
  ]
};

/* Первый вход в обычном браузере: Telegram под нами нет */
const NO_TG = {
  id: 'no-telegram',
  name: 'Первый вход без Telegram',
  init: { tg: false, skip: false },
  steps: [
    { id: '01-auth',   name: 'Экран входа в браузере', wait: 2600, run: null,
      expect: `({ note: (document.querySelector('.onb2-auth-note')||{}).textContent || '',
                  soon: document.querySelectorAll('.onb2-soon').length })` },
    { id: '02-tg-note',name: 'Telegram: честный отказ', wait: 700,
      run: `doLogin('telegram')`,
      expect: `(function(){
        var s = document.querySelector('.onb2-scrim.on');
        var authed = false; try{ authed = !!localStorage.getItem('oko-auth'); }catch(e){}
        return { sheet: !!s, falseLogin: authed, text: s ? s.innerText.replace(/\\s+/g,' ').slice(0,140) : '' };
      })()` },
    { id: '03-escape', name: 'Escape закрывает',        wait: 600, key: 'Escape',
      expect: `({ sheetGone: !document.querySelector('.onb2-scrim.on') })` },
    { id: '04-offline',name: 'Нет сети',                wait: 800,
      offline: true,
      run: `doLogin('telegram')`,
      expect: `(function(){
        var s = document.querySelector('.onb2-scrim.on');
        return { sheet: !!s, offBar: !!document.querySelector('.onb2-auth-off'),
                 text: s ? s.innerText.replace(/\\s+/g,' ').slice(0,110) : '' };
      })()` },
  ]
};

/* Поиск: по каждому типу сущностей */
const SEARCH = {
  id: 'search',
  name: 'Глобальный поиск',
  init: { tg: false, skip: true },
  steps: [
    { id: '01-empty',    name: 'Поиск · пустой запрос', wait: 900,
      run: `okoSkipAuth(); openSearch();`,
      expect: `(function(){
        var b = document.getElementById('searchBody');
        return { open: !!document.querySelector('#searchView.open'),
                 quick: b.querySelectorAll('[data-h]').length,
                 note: !!b.querySelector('.onb2-note'),
                 chips: document.querySelectorAll('#searchView .onb2-chip').length };
      })()` },
    { id: '02-people',   name: 'Поиск · люди',     wait: 600, type: 'Даниэль',
      expect: `probeSecs()` },
    { id: '03-channel',  name: 'Поиск · каналы',   wait: 600, type: 'OKO',
      expect: `probeSecs()` },
    { id: '04-academy',  name: 'Поиск · Академия', wait: 600, type: 'мышление',
      expect: `probeSecs()` },
    { id: '05-section',  name: 'Поиск · разделы',  wait: 600, type: 'кошел',
      expect: `probeSecs()` },
    { id: '06-market',   name: 'Поиск · Биржа',    wait: 600, type: 'биржа',
      expect: `probeSecs()` },
    { id: '07-chat',     name: 'Поиск · сообщения',wait: 600, type: 'поддержка',
      expect: `probeSecs()` },
    { id: '08-filter',   name: 'Поиск · фильтр по типу', wait: 600,
      run: `(function(){
        var c = document.querySelector('#searchView .onb2-chip[data-flt="academy"]'); c && c.click();
      })()`,
      expect: `probeSecs()` },
    { id: '09-nothing',  name: 'Поиск · ничего не нашли', wait: 700, type: 'ъыфячсмить',
      expect: `(function(){
        var e = document.querySelector('#searchBody .onb2-empty');
        return { empty: !!e, text: e ? e.innerText.replace(/\\s+/g,' ').slice(0,140) : '',
                 hits: document.querySelectorAll('#searchBody [data-h]').length };
      })()` },
    { id: '10-recent',   name: 'Поиск · недавние запросы', wait: 1800,
      run: `(function(){
        /* даём отработать записи в «недавние» и чистим поле */
        setTimeout(function(){
          var i = document.getElementById('gSearchInput');
          if(i){ i.value=''; i.dispatchEvent(new Event('input',{bubbles:true})); }
          if(typeof renderSearch==='function') renderSearch();
        }, 1600);
      })()`,
      expect: `({ recent: document.querySelectorAll('#searchBody [data-rq]').length,
                  list: [].slice.call(document.querySelectorAll('#searchBody [data-rq]')).map(function(x){ return x.dataset.rq; }) })` },
    /* Фильтр по типу держится до конца сессии поиска — это нормально, но
       человек не должен думать, что «ничего нет». Проверяем честную подсказку
       и рабочую кнопку «Искать во всём». */
    { id: '11-filter-empty', name: 'Поиск · фильтр прячет результат честно', wait: 800,
      run: `(function(){
        var i = document.getElementById('gSearchInput'); i.value='кошел';
        i.dispatchEvent(new Event('input',{bubbles:true}));
      })()`,
      expect: `(function(){
        var e = document.querySelector('#searchBody .onb2-empty');
        return { empty: !!e, text: e ? e.innerText.replace(/\s+/g,' ').slice(0,140) : '',
                 resetBtn: !!document.querySelector('#searchBody [data-flt="all"]') };
      })()` },
    { id: '12-open-hit', name: 'Поиск · переход по результату', wait: 1300,
      run: `(function(){
        var b = document.querySelector('#searchBody [data-flt="all"]');
        if(b) b.click();
        setTimeout(function(){
          var h = document.querySelector('#searchBody [data-h]'); h && h.click();
        }, 350);
      })()`,
      expect: `({ searchClosed: !document.querySelector('#searchView.open'),
                  wallet: !!document.querySelector('#screen-wallet.active') })` },
    { id: '13-light',    name: 'Поиск · светлая тема', wait: 1000,
      run: `(function(){
        if(typeof applyTheme==='function') applyTheme('light');
        openSearch('OKO');
      })()`,
      expect: `({ theme: document.documentElement.getAttribute('data-theme'),
                  hits: document.querySelectorAll('#searchBody [data-h]').length })` },
  ]
};

/* Уведомления: категории, фильтры, дни, пустой экран */
const NOTIFS = {
  id: 'notifs',
  name: 'Центр уведомлений',
  init: { tg: false, skip: true },
  steps: [
    { id: '01-empty',    name: 'Уведомления · честно пусто', wait: 900,
      run: `okoSkipAuth(); openNotifs();`,
      expect: `(function(){
        var b = document.getElementById('notifsBody');
        return { open: !!document.querySelector('#notifsView.open'),
                 empty: !!b.querySelector('.np-empty'),
                 text: b.innerText.replace(/\\s+/g,' ').slice(0,120),
                 rows: b.querySelectorAll('.np-row').length };
      })()` },
    { id: '02-filled',   name: 'Уведомления · реальные события', wait: 900,
      run: `(function(){
        /* кладём события так же, как это делают модули приложения */
        NOTIFS.length = 0;
        NOTIFS.push({ic:'money', who:'OKO Bank', t:'зачисление 1 200 ₽ на счёт', time:'5 мин', g:'Сегодня', unread:true,
                     act:function(){ showTab('wallet'); }});
        NOTIFS.push({ic:'chat', who:'Поддержка OKO', t:'ответила в переписке', time:'40 мин', g:'Сегодня', unread:true});
        NOTIFS.push({ic:'star', who:'Академия OKO', t:'урок «Мышление и старт» открыт', time:'3 ч', g:'Сегодня', unread:true});
        NOTIFS.push({ic:'gm-flame', who:'Рулетка OKO', t:'бесплатная крутка сгорит через 3 часа', time:'вчера', g:'Ранее', unread:false});
        NOTIFS.push({ic:'briefcase', who:'Биржа OKO', t:'объявление прошло модерацию', time:'2 д', g:'Ранее', unread:true});
        renderNotifs();
      })()`,
      expect: `(function(){
        var b = document.getElementById('notifsBody');
        var groups = [].slice.call(b.querySelectorAll('.nt-group'))
          .filter(function(g){ return g.style.display !== 'none'; })
          .map(function(g){ return g.textContent.trim(); });
        var quick = [].slice.call(b.querySelectorAll('.np-q')).map(function(q){ return q.textContent.trim(); });
        return { rows: b.querySelectorAll('.np-row').length, groups: groups,
                 quick: Array.from(new Set(quick)),
                 done: (document.querySelector('#notifsView .ep-done')||{}).textContent || '' };
      })()` },
    { id: '03-filter',   name: 'Уведомления · фильтр «Партнёрка»', wait: 600,
      run: `(function(){ var c = document.querySelector('#notifsView .np-chip[data-k="partner"]'); c && c.click(); })()`,
      expect: `(function(){
        var b = document.getElementById('notifsBody');
        var vis = [].slice.call(b.querySelectorAll('.np-row')).filter(function(r){ return r.style.display !== 'none'; });
        return { visible: vis.length, text: b.innerText.replace(/\\s+/g,' ').slice(0,100) };
      })()` },
    { id: '04-settings', name: 'Уведомления · настройки категорий', wait: 700,
      run: `(function(){
        var c = document.querySelector('#notifsView .np-chip[data-k="all"]'); c && c.click();
        var cog = document.querySelector('#notifsView .np-hb[title="Настройки уведомлений"]'); cog && cog.click();
      })()`,
      expect: `({ cats: document.querySelectorAll('#notifsView [data-ncat]').length,
                  panel: !!document.querySelector('#notifsView.np-settings-on') })` },
    { id: '05-mute',     name: 'Уведомления · выключить категорию', wait: 700,
      run: `(function(){
        var sw = document.querySelector('#notifsView [data-ncat="games"]'); sw && sw.click();
      })()`,
      expect: `(function(){
        var b = document.getElementById('notifsBody');
        var hidden = [].slice.call(b.querySelectorAll('.np-row')).filter(function(r){ return r.style.display === 'none'; }).length;
        return { hidden: hidden, note: !!b.querySelector('.onb2-np-muted'),
                 noteText: (b.querySelector('.onb2-np-muted')||{}).innerText || '' };
      })()` },
    { id: '06-unmute',   name: 'Уведомления · вернуть категории', wait: 700,
      run: `(function(){ var b = document.querySelector('#notifsBody .onb2-np-muted button'); b && b.click(); })()`,
      expect: `(function(){
        var b = document.getElementById('notifsBody');
        var hidden = [].slice.call(b.querySelectorAll('.np-row')).filter(function(r){ return r.style.display === 'none'; }).length;
        return { hidden: hidden, note: !!b.querySelector('.onb2-np-muted') };
      })()` },
    { id: '07-readall',  name: 'Уведомления · прочитать всё', wait: 700,
      run: `(function(){
        var cog = document.querySelector('#notifsView .np-hb[title="Настройки уведомлений"]'); cog && cog.click();
        var d = document.querySelector('#notifsView .ep-done'); d && d.click();
      })()`,
      expect: `(function(){
        var unread = NOTIFS.filter(function(n){ return n.unread; }).length;
        var d = document.querySelector('#notifsView .ep-done');
        return { unread: unread, doneVisible: !!(d && d.style.display !== 'none') };
      })()` },
    { id: '08-tap',      name: 'Уведомления · переход к источнику', wait: 1100,
      run: `(function(){
        var row = document.querySelector('#notifsBody .np-row .nt-item'); row && row.click();
      })()`,
      expect: `({ closed: !document.querySelector('#notifsView.open'),
                  wallet: !!document.querySelector('#screen-wallet.active') })` },
    { id: '09-light',    name: 'Уведомления · светлая тема', wait: 1000,
      run: `(function(){
        if(typeof applyTheme==='function') applyTheme('light');
        openNotifs();
      })()`,
      expect: `({ theme: document.documentElement.getAttribute('data-theme'),
                  rows: document.querySelectorAll('#notifsBody .np-row').length })` },
  ]
};

const ALL_SCENARIOS = [FIRST_RUN, REG_PHONE, NO_TG, SEARCH, NOTIFS];
const SC_FILTER = (process.env.ONB2_SC || '').split(',').map(s => s.trim()).filter(Boolean);
const SCENARIOS = SC_FILTER.length
  ? ALL_SCENARIOS.filter(s => SC_FILTER.includes(s.id))
  : ALL_SCENARIOS;

/* --------------------------------------------------------------------------
   Прогон
   -------------------------------------------------------------------------- */
async function runScenario(browser, sc, vp) {
  const ctx = await browser.newContext({
    viewport: { width: vp.width, height: vp.height },
    isMobile: vp.mobile,
    hasTouch: vp.mobile,
    deviceScaleFactor: 1,
  });
  const page = await ctx.newPage();
  const errors = [];
  /* Шум окружения: 404 на слоях, которые ещё не выложены соседними агентами,
     и сетевые сбои Supabase — бэкенда у локального пробника нет. */
  const noise = /Failed to load resource|404|net::ERR_|favicon|Failed to fetch|supabase|NetworkError|AbortError/i;
  page.on('pageerror', e => errors.push(String(e).slice(0, 200)));
  page.on('console', m => {
    if (m.type() !== 'error') return;
    const t = m.text();
    if (noise.test(t)) return;
    errors.push('console: ' + t.slice(0, 160));
  });

  await page.addInitScript(initScript(sc.init));
  /* «load» на этой странице не наступает: часть слоёв ещё не выложена и висит
     в 404, а GLB грузится долго. Ждём DOM и даём слоям время подняться.
     Локальный сервер иногда захлёбывается на параллельных запросах — повторяем. */
  let opened = false;
  for (let attempt = 1; attempt <= 3 && !opened; attempt++) {
    try {
      await page.goto(BASE, { waitUntil: 'domcontentloaded', timeout: 45000 });
      opened = true;
    } catch (e) {
      if (attempt === 3) throw e;
      await page.waitForTimeout(1500);
    }
  }
  await page.waitForTimeout(1400);

  /* хелпер для проверок поиска — объявляем один раз */
  await page.evaluate(`window.probeSecs = function(){
    var b = document.getElementById('searchBody');
    var secs = [].slice.call(b.querySelectorAll('.onb2-sec')).map(function(s){
      return s.querySelector('b').textContent.trim() + ':' + ((s.querySelector('span')||{}).textContent || '').trim();
    });
    return { sections: secs, hits: b.querySelectorAll('[data-h]').length,
             first: (b.querySelector('[data-h] .nt-b span')||{}).textContent || '' };
  };`).catch(() => {});

  const result = { scenario: sc.id, name: sc.name, viewport: vp.id, steps: [], errors: [] };

  for (const step of sc.steps) {
    try {
      if (step.offline) await ctx.setOffline(true);
      if (step.run) await page.evaluate(step.run).catch(e => { throw new Error('run: ' + e.message); });
      if (step.type != null) {
        /* Печатаем по-настоящему: событие input нужно и для oninput ядра,
           и для записи запроса в «недавние». */
        await page.fill('#gSearchInput', step.type).catch(async () => {
          await page.evaluate(q => {
            const i = document.getElementById('gSearchInput');
            if (i) { i.value = q; i.dispatchEvent(new Event('input', { bubbles: true })); }
          }, step.type);
        });
      }
      if (step.key) await page.keyboard.press(step.key);
      await page.waitForTimeout(step.wait || 500);

      /* повторно объявляем хелпер: часть шагов перерисовывает страницу */
      await page.evaluate(`if(!window.probeSecs){ }`).catch(() => {});

      const audit = await page.evaluate(
        `(${AUDIT})({ tgTop: ${sc.init.tg ? TG_HEADER : 0}, tgBottom: ${sc.init.tg ? TG_BOTTOM : 0} })`
      );
      let expect = null;
      if (step.expect) {
        expect = await page.evaluate(step.expect).catch(e => ({ __error: e.message }));
      }
      /* Скрин — не критерий. На загруженной машине он иногда не успевает за
         30 сек; терять из-за этого результат аудита шага нельзя. */
      const shot = `onb2-${sc.id}-${vp.id}-${step.id}.png`;
      let shotOk = true;
      try {
        await page.screenshot({ path: path.join(OUT, shot), fullPage: false, timeout: 20000 });
      } catch (e) { shotOk = false; }

      result.steps.push({
        id: step.id, name: step.name, shot: shotOk ? shot : null,
        overflowX: audit.overflowX,
        scope: audit.scope,
        exits: audit.exits,
        visibleText: audit.visibleText,
        issues: audit.issues,
        expect,
      });
    } catch (e) {
      result.steps.push({ id: step.id, name: step.name, fail: String(e.message).slice(0, 200) });
    }
    if (step.offline) await ctx.setOffline(false);
  }

  result.errors = Array.from(new Set(errors)).slice(0, 12);
  await ctx.close();
  return result;
}

const browser = await chromium.launch({ executablePath: EXEC, args: ['--no-sandbox'] });
const report = { at: new Date().toISOString(), base: BASE, runs: [] };

for (const sc of SCENARIOS) {
  for (const vp of VIEWPORTS) {
    /* полный сценарий первого входа гоняем на всех вьюпортах, остальные — тоже:
       разница в ширине как раз и ловит переполнения */
    const r = await runScenario(browser, sc, vp);
    report.runs.push(r);
    const bad = r.steps.reduce((n, s) => n + (s.fail ? 1 : 0) + (s.issues ? s.issues.length : 0) + (s.overflowX > 0 ? 1 : 0), 0);
    console.log(`${sc.id} / ${vp.id}: шагов ${r.steps.length}, замечаний ${bad}, ошибок JS ${r.errors.length}`);
  }
}
await browser.close();

/* --------------------------------------------------------------------------
   Свод
   -------------------------------------------------------------------------- */
const summary = { overflowX: [], clipped: [], breakAll: [], underTg: [], noExit: [], emptyScreen: [], failed: [], jsErrors: [] };
const foreign = { clipped: [], breakAll: [], underTg: [], other: [] };   /* дефекты чужих слоёв */
for (const r of report.runs) {
  const where = `${r.scenario}/${r.viewport}`;
  for (const s of r.steps) {
    if (s.fail) { summary.failed.push(`${where}/${s.id}: ${s.fail}`); continue; }
    if (s.overflowX > 0) summary.overflowX.push(`${where}/${s.id}: +${s.overflowX}px`);
    for (const i of s.issues || []) {
      const line = `${where}/${s.id}: ${i.el}` + (i.by ? ` (+${i.by}px)` : '') + (i.text ? ` «${i.text}»` : '');
      const bucket = i.mine ? summary : foreign;
      if (i.kind === 'out-right' || i.kind === 'clip-x' || i.kind === 'clip-y') bucket.clipped.push(line);
      else if (i.kind === 'break-all') bucket.breakAll.push(line);
      else if (i.kind === 'under-tg-top' || i.kind === 'under-tg-bottom') bucket.underTg.push(line);
      else if (i.kind === 'double-back') (i.mine ? summary.noExit : foreign.other).push(`${where}/${s.id}: две кнопки назад в ${i.el}`);
    }
    if (!s.exits) summary.noExit.push(`${where}/${s.id}: нет кнопки выхода (${s.scope})`);
    if (s.visibleText < 40) summary.emptyScreen.push(`${where}/${s.id}: текста ${s.visibleText} симв.`);
  }
  for (const e of r.errors) summary.jsErrors.push(`${where}: ${e}`);
}
const dedup = o => { for (const k of Object.keys(o)) o[k] = Array.from(new Set(o[k])); return o; };
report.summary = dedup(summary);
report.foreign = dedup(foreign);   /* к oko-onb2.js отношения не имеет — только к сведению */
report.verdict = Object.keys(summary).every(k => summary[k].length === 0) ? 'ЧИСТО' : 'ЕСТЬ ЗАМЕЧАНИЯ';

const REPORT = process.env.ONB2_OUT || 'onb2-report.json';
await fs.writeFile(path.join(OUT, REPORT), JSON.stringify(report, null, 2), 'utf8');
console.log('\n=== СВОД (наши экраны) ===');
console.log(JSON.stringify(summary, null, 1).slice(0, 6000));
console.log('\n=== ЧУЖИЕ СЛОИ (не oko-onb2.js) ===');
console.log(JSON.stringify(report.foreign, null, 1).slice(0, 2500));
console.log('Вердикт:', report.verdict);
console.log('Отчёт: oko-app/tools/' + REPORT);
