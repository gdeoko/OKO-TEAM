/* ============================================================================
   OKO · probe-mini2.mjs — ПРОБНИК ЧЕТЫРЁХ РАЗДЕЛОВ
   ----------------------------------------------------------------------------
   Обходит ИГРЫ, ПАРТНЁРКУ, РЕКЛАМУ, ДОКУМЕНТЫ и TON со всеми подстраницами
   в трёх вьюпортах (390×844 · телефон, 360×740 · узкий Android, 1440×900 · ПК)
   и на каждом экране автоматически проверяет:

     • нет горизонтального переполнения страницы;
     • ни один блок не вылезает за правый край;
     • нет обрезанного текста (scrollWidth/scrollHeight больше видимого);
     • подписи помещаются в кнопки (scrollWidth <= clientWidth + 1);
     • на экране есть кнопка «назад» и она одна и та же (.oko-back);
     • нет переносов посреди слова (word-break:break-all вне .oko-breakable);
     • в цифрах нет NaN / undefined / Infinity;
     • нет эмодзи в интерфейсе (правило бренда: только SVG-иконки);
     • нет ложных подтверждений («отправлено», «опубликовано» без действия).

   Запуск:  node oko-app/tools/probe-mini2.mjs [--round N] [--base URL]
   Сервер:  python3 -m http.server 8199 --bind 127.0.0.1  (из oko-app/prototype)
   Скрины:  oko-app/tools/mini2-*.png
   ============================================================================ */
import pw from 'playwright-core';
import fs from 'node:fs/promises';
import path from 'node:path';

const { chromium } = pw;

const args = Object.fromEntries(
  process.argv.slice(2).join(' ').split('--').filter(Boolean)
    .map(s => { const [k, ...v] = s.trim().split(/\s+/); return [k, v.join(' ') || true]; })
);

const BASE  = args.base || 'http://127.0.0.1:8199/index.html';
const ROUND = String(args.round || '1');
const OUT   = path.resolve('oko-app/tools');
const EXE   = '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';

const VIEWPORTS = [
  { id: 'phone',   label: 'Телефон 390×844',      width: 390,  height: 844,  mobile: true  },
  { id: 'narrow',  label: 'Узкий Android 360×740', width: 360,  height: 740,  mobile: true  },
  { id: 'desktop', label: 'ПК 1440×900',           width: 1440, height: 900,  mobile: false },
];

/* Маршруты: раздел -> экран/подстраница. step выполняется в браузере. */
const ROUTES = [
  /* --- ИГРЫ И РУЛЕТКА --- */
  { id:'gm-01-main',   sec:'Игры',       name:'Рулетка · главный',      step:`showTab('games')` },
  { id:'gm-02-odds',   sec:'Игры',       name:'Таблица шансов',         step:`showTab('games');gmOddsOpen()` },
  { id:'gm-03-stats',  sec:'Игры',       name:'Твоя статистика',        step:`showTab('games');gmStatsOpen()` },
  { id:'gm-04-prizes', sec:'Игры',       name:'Мои призы',              step:`showTab('games');gmPrizesOpen()` },
  { id:'gm-05-daily',  sec:'Игры',       name:'Задания дня',            step:`showTab('games');gmDailyOpen()` },
  { id:'gm-06-bp',     sec:'Игры',       name:'Боевой пропуск',         step:`showTab('games');gmBpOpen()` },
  { id:'gm-07-shop',   sec:'Игры',       name:'Витрина подарков',       step:`showTab('games');gmGiftsShopOpen()` },
  { id:'gm-08-inv',    sec:'Игры',       name:'Мои подарки (игры)',     step:`showTab('games');gmGiftsInvOpen()` },
  { id:'gm-09-streak', sec:'Игры',       name:'Серия заходов',          step:`showTab('games');gmStreakOpen()` },
  { id:'gm-10-lbworld',sec:'Игры',       name:'Лидеры · Мир',           step:`showTab('games');gmLbSetLeague('world');document.getElementById('gmLb').scrollIntoView({block:'center'})` },
  { id:'gm-12-rules',  sec:'Игры',       name:'Правила рулетки',        step:`showTab('games');document.getElementById('m2GmRules').scrollIntoView({block:'start'})` },
  { id:'gm-13-ach',    sec:'Игры',       name:'Достижения',             step:`showTab('games');document.getElementById('gmAch').scrollIntoView({block:'start'})` },
  /* --- ПАРТНЁРКА --- */
  { id:'pp-01-main',   sec:'Партнёрка',  name:'Кабинет партнёра',       step:`showTab('partner')` },
  { id:'pp-02-calc',   sec:'Партнёрка',  name:'Калькулятор · 40 клиентов', step:`showTab('partner');okoM2CalcSet(40);okoM2CalcPrice(30000);document.getElementById('m2PpCalc').scrollIntoView()` },
  { id:'pp-03-qr',     sec:'Партнёрка',  name:'Ссылка и QR',            step:`showTab('partner');document.getElementById('m2PpLink').scrollIntoView()` },
  { id:'pp-04-terms',  sec:'Партнёрка',  name:'Условия программы',      step:`showTab('partner');document.getElementById('m2PpTerms').scrollIntoView()` },
  { id:'pp-05-hist',   sec:'Партнёрка',  name:'История начислений',     step:`showTab('partner');document.getElementById('m2PpHist').scrollIntoView()` },
  { id:'pp-06-payout', sec:'Партнёрка',  name:'Выплаты',                step:`showTab('partner');document.getElementById('m2PpPayout').scrollIntoView()` },
  { id:'pp-07-promo',  sec:'Партнёрка',  name:'Промо-материалы',        step:`showTab('partner');ppOpenPromo(0)` },
  { id:'pp-08-refqr',  sec:'Партнёрка',  name:'QR-шторка ядра',         step:`showTab('partner');ppOpenQR()` },

  /* --- РЕКЛАМА --- */
  { id:'ad-01-main',   sec:'Реклама',    name:'Кабинет · черновики',    step:`showTab('ads')` },
  { id:'ad-01b-calc',  sec:'Реклама',    name:'Расчёт бюджета',         step:`showTab('ads');document.getElementById('m2AdsCalc').scrollIntoView({block:'start'})` },
  { id:'ad-01c-list',  sec:'Реклама',    name:'Список черновиков',      step:`showTab('ads');document.getElementById('m2AdsList').scrollIntoView({block:'start'})` },
  { id:'ad-02-create1',sec:'Реклама',    name:'Мастер · шаг 1',         step:`showTab('ads');adsOpenCreate()` },
  { id:'ad-03-create2',sec:'Реклама',    name:'Мастер · креатив',       step:`showTab('ads');adsOpenCreate();adsGotoStep(2)` },
  { id:'ad-04-create3',sec:'Реклама',    name:'Мастер · аудитория',     step:`showTab('ads');adsOpenCreate();adsGotoStep(3)` },
  { id:'ad-05-create4',sec:'Реклама',    name:'Мастер · бюджет',        step:`showTab('ads');adsOpenCreate();adsGotoStep(4)` },
  { id:'ad-06-bill',   sec:'Реклама',    name:'Биллинг',                step:`showTab('ads');adsOpenBilling()` },
  { id:'ad-07-auds',   sec:'Реклама',    name:'Аудитории',              step:`showTab('ads');adsShowAuds()` },
  { id:'ad-08-draft',  sec:'Реклама',    name:'Сохранённый черновик',   step:`showTab('ads');okoProbeMakeDraft()` },

  /* --- ДОКУМЕНТЫ --- */
  { id:'dc-01-hub',    sec:'Документы',  name:'Список документов',      step:`openLegalHub()` },
  { id:'dc-02-offer',  sec:'Документы',  name:'Публичная оферта',       step:`openLegalHub();openLegalDoc('offer')` },
  { id:'dc-03-privacy',sec:'Документы',  name:'Политика конфиденциальности', step:`openLegalHub();openLegalDoc('privacy')` },
  { id:'dc-04-terms',  sec:'Документы',  name:'Пользовательское соглашение', step:`openLegalHub();openLegalDoc('terms')` },
  { id:'dc-05-refund', sec:'Документы',  name:'Политика возврата',      step:`openLegalHub();openLegalDoc('refund')` },
  { id:'dc-06-license',sec:'Документы',  name:'Лицензия на ПО',         step:`openLegalHub();openLegalDoc('license')` },
  { id:'dc-07-consent',sec:'Документы',  name:'Согласие на обработку ПД', step:`openLegalHub();openLegalDoc('consent')` },
  { id:'dc-08-en',     sec:'Документы',  name:'Оферта · EN',            step:`openLegalHub();openLegalDoc('offer');lgSetLang('en')` },

  /* --- TON --- */
  { id:'tn-01-shop',   sec:'TON',        name:'Магазин подарков',       step:`showTab('ton')` },
  { id:'tn-01b-what',  sec:'TON',        name:'Что уже работает',       step:`showTab('ton');document.getElementById('m2TonWhat').scrollIntoView({block:'start'})` },
  { id:'tn-09-market', sec:'TON',        name:'Прайс подарков (биржа)', step:`showTab('ton');vsOpenMarket()` },
  { id:'tn-10-offers', sec:'TON',        name:'Ордера по подарку',      step:`showTab('ton');vsOpenOffers('crystal')` },
  { id:'tn-11-nft',    sec:'TON',        name:'Данные NFT',             step:`showTab('ton');vsOpenNft('crystal')` },
  { id:'tn-02-mine',   sec:'TON',        name:'Мои подарки',            step:`showTab('ton');vsTonTab('mine')` },
  { id:'tn-03-topup',  sec:'TON',        name:'Пополнить',              step:`showTab('ton');vsOpenTopup()` },
  { id:'tn-04-recv',   sec:'TON',        name:'Получить',               step:`showTab('ton');vsOpenRecv()` },
  { id:'tn-05-send',   sec:'TON',        name:'Отправить TON',          step:`showTab('ton');vsOpenSendTon()` },
  { id:'tn-06-hist',   sec:'TON',        name:'История операций',       step:`showTab('ton');vsOpenHistory()` },
  { id:'tn-07-buy',    sec:'TON',        name:'Карточка подарка',       step:`showTab('ton');vsOpenBuy('crystal')` },
  { id:'tn-08-conn',   sec:'TON',        name:'TON Connect',            step:`showTab('ton');vsConnectWallet()` },

  /* САМЫМ ПОСЛЕДНИМ. Крутка запускает шестисекундную анимацию колеса,
     конфетти и «джекпот»-оверлей. Страница после неё остаётся занятой, и
     любой следующий замер упирается в таймаут — поэтому маршрут стоит в
     конце обхода, чтобы не портить остальные экраны. */
  { id:'gm-99-spin',   sec:'Игры',       name:'После бесплатной крутки',step:`showTab('games');gmSelectMode('free');gmDoSpin(false)`, wait:9000 },
];

/* --only <префикс> — обойти только часть маршрутов (gm / pp / ad / dc / tn).
   Нужен, когда после точечной правки надо переснять один раздел, а не всё. */
const ONLY = typeof args.only === 'string' ? args.only.trim() : '';
const ROUTES_RUN = ONLY ? ROUTES.filter(r => r.id.startsWith(ONLY)) : ROUTES;

/* --vp <id> — только один вьюпорт (phone / narrow / desktop). */
const VP_ONLY = typeof args.vp === 'string' ? args.vp.trim() : '';
const VIEWPORTS_RUN = VP_ONLY ? VIEWPORTS.filter(v => v.id === VP_ONLY) : VIEWPORTS;

/* Скриншоты снимаем на телефоне — там ловятся все переполнения.
   --noshots пропускает съёмку: повторный прогон «на проверку красного»
   на нагруженной машине идёт в разы быстрее. */
const SHOT_ON = args.noshots ? '' : 'phone';

function initScript(){
  return `
    window.okoSkipAuth = function(){
      try{ localStorage.setItem('oko-auth','tg'); }catch(e){}
      var a=document.getElementById('authScreen'); if(a){a.classList.add('hidden'); a.style.display='none';}
      var s=document.getElementById('splash');     if(s){s.classList.add('gone');   s.style.display='none';}
      var o=document.getElementById('onboard');    if(o){o.classList.add('hidden'); o.style.display='none';}
    };
    try{
      localStorage.setItem('oko-onboard-done','1');
      localStorage.setItem('oko-stories-seen','1');
      localStorage.setItem('oko-tour-done','1');
      localStorage.setItem('oko-tour','1');
      localStorage.setItem('pp-welcome-shown-v1','1');
      /* модалки-наджи слоя роста (oko-growth.js) накрывают экраны своим
         оверлеем — для обхода вёрстки глушим их все разом */
      localStorage.setItem('okg-state-v1', JSON.stringify({
        off:{ onboarding:true, anketa:true, videofree:true, partner:true,
              lesson:true, expiring:true, market:true, reels:true }
      }));
    }catch(e){}
    /* создание черновика кампании без ручного прохода мастера */
    window.okoProbeMakeDraft = function(){
      try{
        if(typeof adsOpenCreate !== 'function') return;
        adsOpenCreate();
        var set = function(id, v){ var e=document.getElementById(id); if(e) e.value = v; };
        set('adsInpTitle','Тестовый черновик кампании OKO');
        set('adsInpText','Проверка вёрстки карточки черновика в рекламном кабинете OKO.');
        set('adsInpLink','okoteam.top');
        set('adsInpBudget','2500');
        set('adsInpBid','12');
        if(typeof adsLaunch === 'function') adsLaunch();
        if(typeof closePopup === 'function') closePopup();
        if(typeof closeSheet === 'function') closeSheet();
      }catch(e){}
    };
  `;
}

/* --------------------------------------------------------------------------
   Аудит одного экрана внутри страницы
   -------------------------------------------------------------------------- */
const AUDIT = () => {
  const issues = [];
  const add = (type, detail, el) => {
    issues.push({ type, detail, sel: el ? sel(el) : '' });
  };
  const sel = (el) => {
    if(!el || !el.tagName) return '';
    let s = el.tagName.toLowerCase();
    if(el.id) s += '#' + el.id;
    if(el.className && typeof el.className === 'string')
      s += '.' + el.className.trim().split(/\s+/).slice(0, 3).join('.');
    return s.slice(0, 90);
  };
  const vis = (el) => {
    const r = el.getBoundingClientRect();
    if(r.width < 2 || r.height < 2) return false;
    const cs = getComputedStyle(el);
    if(cs.display === 'none' || cs.visibility === 'hidden' || +cs.opacity === 0) return false;
    if(r.bottom < -200 || r.top > innerHeight + 2000) return false;
    return true;
  };
  /* видимая зона: только активный экран, открытые шторки, попапы и шапка —
     обход всего body на миллионном DOM занимал минуты и ничего не добавлял */
  const SKIP = new Set(['SCRIPT','STYLE','SVG','PATH','USE','DEFS','LINEARGRADIENT',
    'STOP','G','RECT','CIRCLE','LINE','POLYGON','POLYLINE','TEXT','TSPAN','CLIPPATH',
    'SYMBOL','ELLIPSE','FILTER','MASK','TEMPLATE','BR','HR']);
  const roots = [...document.querySelectorAll(
    '.screen.active, header, nav#tabs, .sheet.open, #okoPopup, #legalView.open, ' +
    '#searchView.open, #notifsView.open, #st2View.open, #psView.open'
  )].filter(r => r && vis(r));
  const seen = new Set();
  const alive = [];
  roots.forEach(root => {
    if(!seen.has(root)){ seen.add(root); alive.push(root); }
    const list = root.querySelectorAll('*');
    for(let i = 0; i < list.length && alive.length < 3500; i++){
      const el = list[i];
      if(SKIP.has(el.tagName) || seen.has(el)) continue;
      seen.add(el);
      if(vis(el)) alive.push(el);
    }
  });

  /* 1) горизонтальное переполнение страницы */
  const de = document.documentElement;
  if(de.scrollWidth > de.clientWidth + 1)
    add('page-overflow-x', `scrollWidth ${de.scrollWidth} > clientWidth ${de.clientWidth}`);

  /* 2) блоки за правым/левым краем.
     Карточки внутри горизонтальной ленты (overflow-x:auto/scroll) выходят
     за экран по замыслу — это рельса, её листают пальцем. Считаем дефектом
     только то, что вылезает из НЕпрокручиваемого родителя. */
  const W = de.clientWidth;
  const inRail = (el) => {
    for(let p = el.parentElement; p && p !== document.body; p = p.parentElement){
      const cs = getComputedStyle(p);
      if(cs.overflowX === 'auto' || cs.overflowX === 'scroll') return true;
      if(p.scrollWidth > p.clientWidth + 4 && cs.overflow !== 'visible') return true;
    }
    return false;
  };
  alive.forEach(el => {
    const r = el.getBoundingClientRect();
    if(r.width > W + 40) return;                        /* полноэкранные подложки */
    if(inRail(el)) return;
    const dcs = getComputedStyle(el);
    /* декорации (свечения, градиенты) не кликаются и текста не несут —
       если такое пятно выходит за край, человек этого не замечает */
    if(dcs.pointerEvents === 'none' && !(el.innerText || '').trim()) return;
    if(r.right > W + 1.5) add('outside-right', `right=${Math.round(r.right)} > ${W}`, el);
    if(r.left < -1.5 && r.width > 8) add('outside-left', `left=${Math.round(r.left)}`, el);
  });

  /* 3) обрезанный текст */
  alive.forEach(el => {
    const cs = getComputedStyle(el);
    const hasOwnText = [...el.childNodes].some(n => n.nodeType === 3 && n.textContent.trim().length > 1);
    if(!hasOwnText) return;
    const clipX = cs.overflowX === 'hidden' || cs.overflowX === 'clip';
    const clipY = cs.overflowY === 'hidden' || cs.overflowY === 'clip';
    if(clipX && el.scrollWidth > el.clientWidth + 2)
      add('text-clipped-x', `${el.scrollWidth}>${el.clientWidth} · «${el.innerText.trim().slice(0, 44)}»`, el);
    if(clipY && el.scrollHeight > el.clientHeight + 3 && cs.webkitLineClamp === 'none' && cs.textOverflow !== 'ellipsis')
      add('text-clipped-y', `${el.scrollHeight}>${el.clientHeight} · «${el.innerText.trim().slice(0, 44)}»`, el);
  });

  /* 4) подпись не помещается в кнопку.
     Один scrollWidth > clientWidth врёт: у элемента с overflow:visible он
     прибавляет служебные <defs> SVG с отрицательными координатами, хотя
     визуально всё на месте. Считаем дефектом два случая:
       • кнопка режет содержимое (overflow скрыт) и оно шире поля;
       • текст физически выходит за внутреннее поле кнопки. */
  alive.filter(el => el.matches('button, a.btn, .btn, [role="button"]')).forEach(el => {
    const t = (el.innerText || '').trim();
    if(!t) return;
    const cs = getComputedStyle(el);
    const clipped = cs.overflowX === 'hidden' || cs.overflowX === 'clip' || cs.overflowX === 'auto';
    if(clipped){
      if(el.scrollWidth > el.clientWidth + 1)
        add('button-label-overflow', `${el.scrollWidth}>${el.clientWidth} · «${t.slice(0, 44)}»`, el);
      return;
    }
    const r = el.getBoundingClientRect();
    const padR = parseFloat(cs.paddingRight) || 0, bR = parseFloat(cs.borderRightWidth) || 0;
    const padL = parseFloat(cs.paddingLeft) || 0,  bL = parseFloat(cs.borderLeftWidth) || 0;
    const inR = r.right - bR - padR + 1, inL = r.left + bL + padL - 1;
    const kids = [el, ...el.querySelectorAll('*')].filter(k =>
      [...k.childNodes].some(n => n.nodeType === 3 && n.textContent.trim().length > 0));
    for(const k of kids){
      const kr = k.getBoundingClientRect();
      if(kr.width < 1) continue;
      if(kr.right > inR || kr.left < inL){
        add('button-label-overflow',
          `текст за полем кнопки · «${(k.innerText || '').trim().slice(0, 40)}»`, el);
        break;
      }
    }
  });

  /* 5) кнопка «назад» — есть и одного вида */
  const backs = [...document.querySelectorAll('button.oko-back')].filter(el => {
    const r = el.getBoundingClientRect();
    if(r.width < 2 || r.height < 2) return false;
    const cs = getComputedStyle(el);
    return cs.display !== 'none' && cs.visibility !== 'hidden' && +cs.opacity !== 0;
  });
  const shapes = new Set(backs.map(b => {
    const r = b.getBoundingClientRect(), cs = getComputedStyle(b);
    return `${Math.round(r.width)}x${Math.round(r.height)}|${cs.borderRadius}`;
  }));
  if(!backs.length) add('no-back-button', 'кнопка «назад» не найдена');
  if(shapes.size > 1) add('back-button-mismatch', [...shapes].join(' / '));

  /* 6) перенос посреди слова */
  alive.forEach(el => {
    const cs = getComputedStyle(el);
    if(cs.wordBreak !== 'break-all') return;
    if(el.closest('.oko-breakable, .m2-mono, .m2-link-val, .lg-req, .lg-hub-op')) return;
    if(el.classList.contains('oko-breakable')) return;
    const t = (el.innerText || '').trim();
    if(t.length < 3) return;
    add('word-break-all', `«${t.slice(0, 44)}»`, el);
  });

  /* 7) NaN / undefined / Infinity в тексте */
  const body = roots.map(r => r.innerText || '').join('\n');
  ['NaN', 'undefined', 'Infinity', '[object Object]', 'null ₽', 'NaN ₽'].forEach(bad => {
    const i = body.indexOf(bad);
    if(i >= 0) add('bad-number', `${bad} · «${body.slice(Math.max(0, i - 34), i + 34).replace(/\n/g, ' ')}»`);
  });

  /* 8) эмодзи в интерфейсе (бренд: только SVG) */
  const emoji = body.match(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}]/gu);
  if(emoji && emoji.length) add('emoji-in-ui', [...new Set(emoji)].slice(0, 8).join(' '));

  /* 9) ложные подтверждения */
  const LIE = [
    /отправлено\s*\(демо\)/i, /спасибо,?\s*сигнал ушёл/i,
    /заявка принята/i, /придут на (карту|кошелёк)/i,
    /кампания .*прошла модерацию/i, /объявление в ленте/i,
  ];
  LIE.forEach(re => { const m = body.match(re); if(m) add('false-confirmation', m[0].slice(0, 60)); });

  /* 10) заезд под нижний бар. Длинная страница ниже бара — это норма, её
     листают. Дефект — когда пролистал до конца, а последняя строка всё равно
     спрятана под баром: значит контейнеру не хватает нижнего отступа. */
  const nav = document.getElementById('tabs');
  const scroller = document.querySelector('.screen.active .pad') || document.querySelector('.screen.active');
  /* когда сверху открыт полноэкранный слой (документы, поиск, шторка),
     нижний бар к нему отношения не имеет — проверять нечего */
  const overlayOpen = !!document.querySelector('#legalView.open, .sheet.open, #okoPopup, #searchView.open, #notifsView.open');
  if(nav && scroller && !overlayOpen){
    const nr = nav.getBoundingClientRect();
    /* на ПК меню превращается в боковую колонку — снизу оно ничего не закрывает */
    const isBottomBar = nr.width > nr.height && nr.top > innerHeight * 0.5;
    const navVisible = nr.height > 4 && nr.top < innerHeight - 4 &&
                       getComputedStyle(nav).display !== 'none' && isBottomBar;
    if(navVisible){
      /* Проверяем не последний элемент вообще, а нижний отступ контейнера:
         его должно хватать на высоту бара плюс безопасную зону. Так тест не
         зависит от прокрутки и не заставляет браузер пересчитывать всю
         многотысячную страницу игр. */
      const cs = getComputedStyle(scroller);
      const padBottom = parseFloat(cs.paddingBottom) || 0;
      if(padBottom + 2 < nr.height)
        add('under-bottom-bar', `нижний отступ ${Math.round(padBottom)} < высоты бара ${Math.round(nr.height)}`, scroller);
    }
  }

  return { issues, text: body.slice(0, 400) };
};

/* -------------------------------------------------------------------------- */
const LAUNCH = {
  executablePath: EXE,
  args: ['--no-sandbox', '--disable-dev-shm-usage', '--disable-gpu',
         '--disable-extensions', '--js-flags=--max-old-space-size=512'],
};

async function run(){
  const report = { round: ROUND, base: BASE, at: new Date().toISOString(), viewports: [], totals: {} };
  const shots = [];

  for(const vp of VIEWPORTS_RUN){
    /* свой браузер на каждый вьюпорт: страница приложения тяжёлая, и общий
       процесс на длинном обходе успевал упасть по памяти */
    const browser = await chromium.launch(LAUNCH);
    const ctx = await browser.newContext({
      viewport: { width: vp.width, height: vp.height },
      deviceScaleFactor: 1,
      isMobile: vp.mobile, hasTouch: vp.mobile,
      userAgent: vp.mobile
        ? 'Mozilla/5.0 (Linux; Android 13) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122 Mobile Safari/537.36'
        : undefined,
    });
    await ctx.addInitScript(initScript());
    const page = await ctx.newPage();
    const errors = [];
    page.on('pageerror', e => errors.push(String(e && e.message || e).slice(0, 180)));
    page.on('console', m => { if(m.type() === 'error') errors.push('console: ' + m.text().slice(0, 150)); });

    /* domcontentloaded, а не load: внешние CDN (amplitude/sentry) в облаке
       режет egress-прокси, и ожидание load упирается в таймаут */
    await page.goto(BASE, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForTimeout(3000);
    await page.evaluate('okoSkipAuth()');
    await page.waitForTimeout(400);

    const vpRes = { id: vp.id, label: vp.label, screens: [] };

    /* Любое обращение к странице ограничено по времени. На экране с
       крутящимся колесом и конфетти page.evaluate иногда не возвращается
       вовсе — без страховки один экран вешал весь обход. */
    const cap = (promise, ms, fallback) => Promise.race([
      Promise.resolve(promise).catch(() => fallback),
      new Promise(res => setTimeout(() => res(fallback), ms)),
    ]);

    for(const r of ROUTES_RUN){
     try{
      /* закрыть всё открытое перед следующим маршрутом */
      await cap(page.evaluate(`
        try{ if(typeof closeSheet==='function') closeSheet(); }catch(e){}
        try{ if(typeof closePopup==='function') closePopup(); }catch(e){}
        try{ if(typeof closeLegalDoc==='function') closeLegalDoc(); }catch(e){}
        try{ window.scrollTo(0,0); document.querySelectorAll('.screen.active .pad').forEach(p=>p.scrollTop=0); }catch(e){}
      `), 8000, null);
      await page.waitForTimeout(180);

      let stepErr = '';
      const stepRes = await cap(
        page.evaluate(r.step).then(() => '').catch(e => 'err: ' + String(e && e.message || e).slice(0, 130)),
        15000, 'step-timeout');
      if(stepRes) stepErr = stepRes;
      try{ await page.waitForTimeout(r.wait || 900); }catch(e){}

      let res;
      try{ res = await cap(page.evaluate(AUDIT), 25000,
        { issues: [{ type:'audit-timeout', detail:'аудит не уложился в 25 с', sel:'' }], text:'x' }); }
      catch(e){ res = { issues: [{ type:'audit-failed', detail:String(e).slice(0,120), sel:'' }], text:'' }; }

      if(vp.id === SHOT_ON){
        const f = path.join(OUT, `mini2-${r.id}.png`);
        try{
          const done = await cap(
            page.screenshot({ path: f, fullPage: true, animations: 'disabled', timeout: 18000 })
              .then(() => true).catch(() => false),
            22000, false);
          if(done) shots.push(path.basename(f));
        }catch(e){}
      }

      vpRes.screens.push({
        id: r.id, section: r.sec, name: r.name,
        stepError: stepErr || undefined,
        empty: (res.text || '').trim().length < 30 ? true : undefined,
        issues: res.issues,
      });
     }catch(e){
       /* маршрут не должен ронять весь обход */
       vpRes.screens.push({
         id: r.id, section: r.sec, name: r.name,
         stepError: 'route-crash: ' + String(e && e.message || e).slice(0, 120),
         issues: [],
       });
     }
    }

    vpRes.jsErrors = [...new Set(errors)].slice(0, 12);
    report.viewports.push(vpRes);
    try{ await ctx.close(); }catch(e){}
    try{ await browser.close(); }catch(e){}
  }

  /* --- сводка --- */
  const byType = {};
  let total = 0;
  report.viewports.forEach(v => v.screens.forEach(s => s.issues.forEach(i => {
    byType[i.type] = (byType[i.type] || 0) + 1; total++;
  })));
  report.totals = {
    screens: ROUTES_RUN.length * VIEWPORTS_RUN.length,
    issues: total,
    byType,
    jsErrors: report.viewports.reduce((n, v) => n + v.jsErrors.length, 0),
    shots: shots.length,
  };

  const jsonPath = path.join(OUT, 'probe-mini2.json');
  await fs.writeFile(jsonPath, JSON.stringify(report, null, 2), 'utf8');

  /* --- краткий вывод в консоль --- */
  console.log('\n═══ OKO · probe-mini2 · раунд ' + ROUND + ' ═══');
  console.log('Экранов проверено: ' + report.totals.screens + ' · замечаний: ' + total);
  console.log('По типам:', JSON.stringify(byType, null, 0));
  report.viewports.forEach(v => {
    const bad = v.screens.filter(s => s.issues.length || s.stepError || s.empty);
    console.log('\n— ' + v.label + ' — проблемных экранов: ' + bad.length + '/' + v.screens.length);
    bad.slice(0, 40).forEach(s => {
      console.log('  · [' + s.section + '] ' + s.name + (s.stepError ? ' · STEP: ' + s.stepError : '') + (s.empty ? ' · ПУСТО' : ''));
      s.issues.slice(0, 6).forEach(i => console.log('      ' + i.type + ' :: ' + i.detail + (i.sel ? '  @' + i.sel : '')));
    });
    if(v.jsErrors.length) console.log('  JS-ошибки: ' + v.jsErrors.join(' | '));
  });
  console.log('\nОтчёт: ' + jsonPath);
  console.log('Скриншоты: oko-app/tools/mini2-*.png (' + shots.length + ' шт.)');
}

run().catch(e => { console.error(e); process.exit(1); });
