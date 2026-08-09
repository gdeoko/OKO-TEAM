/* ============================================================================
   OKO · ПРОБНИК ЕДИНОЙ КНОПКИ «НАЗАД»  (oko-back.js)
   ----------------------------------------------------------------------------
   Обходит все подстраницы, мини-аппы, оверлеи и шторки в мобильном вьюпорте
   390×844 и для каждой проверяет:
     • кнопка «назад» существует, видима, не меньше 32×32;
     • она не заезжает под шапку Telegram (top >= 0);
     • клик по ней реально меняет состояние приложения (экран / стек / слои)
       и НЕ перезагружает страницу;
     • визуал одинаковый: width / height / border-radius совпадают у всех
       найденных кнопок приложения.

   Запуск:  node oko-app/tools/probe-back.mjs [--base URL] [--json путь]
   ============================================================================ */
import { chromium } from 'playwright-core';
import fs from 'node:fs/promises';
import path from 'node:path';

const args = Object.fromEntries(
  process.argv.slice(2).join(' ').split('--').filter(Boolean)
    .map(s => { const [k, ...v] = s.trim().split(/\s+/); return [k, v.join(' ') || true]; })
);

const BASE = args.base || 'http://127.0.0.1:8199/index.html';
const OUT  = args.json && args.json !== true
  ? path.resolve(String(args.json))
  : path.resolve('oko-app/tools/probe-back.json');

/* Пропуск авторизации и тура — как в audit.mjs */
const INIT = `
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
  }catch(e){}
  window.__okoReloaded = false;
`;

/* --------------------------------------------------------------------------
   Маршруты. root:true — корневая вкладка, там кнопки «назад» БЫТЬ НЕ ДОЛЖНО.
   -------------------------------------------------------------------------- */
const R = (id, name, step, extra = {}) => ({ id, name, step, ...extra });

const ROUTES = [
  /* --- корневые вкладки: кнопки быть не должно --- */
  R('root-feed',    'Лента',            `okoSkipAuth(); showTab('feed');`,    { root:true }),
  R('root-chats',   'Чаты',             `okoSkipAuth(); showTab('chats');`,   { root:true }),
  R('root-mini',    'Мини-аппы',        `okoSkipAuth(); showTab('mini');`,    { root:true }),
  R('root-wallet',  'Кошелёк',          `okoSkipAuth(); showTab('wallet');`,  { root:true }),
  R('root-profile', 'Профиль',          `okoSkipAuth(); showTab('profile');`, { root:true }),

  /* --- экраны без вкладки в нижнем меню --- */
  R('partner',  'Партнёрка',      `okoSkipAuth(); showTab('partner');`),
  R('games',    'Рулетка / Игры', `okoSkipAuth(); showTab('games');`),
  R('academy',  'Академия',       `okoSkipAuth(); showTab('academy');`),
  R('ads',      'Реклама',        `okoSkipAuth(); showTab('ads');`),
  R('ton',      'TON-подарки',    `okoSkipAuth(); showTab('ton');`),

  /* --- мини-аппы --- */
  R('ma-video',   'Мини-апп · Проверка видео', `okoSkipAuth(); showTab('mini'); openMa('video');`),
  R('ma-market',  'Мини-апп · Биржа услуг',    `okoSkipAuth(); showTab('mini'); try{openMa('market')}catch(e){}`),
  R('ma-system',  'Мини-апп · Система роста',  `okoSkipAuth(); showTab('mini'); openMa('system');`),
  R('ma-factory', 'Мини-апп · Контент-завод',  `okoSkipAuth(); showTab('mini'); openMa('factory');`),
  R('ma-helper',  'Мини-апп · Помощник OKO',   `okoSkipAuth(); showTab('mini'); openMa('helper');`),
  R('ma-socials', 'Мини-апп · Мои соцсети',    `okoSkipAuth(); showTab('mini'); openMa('socials');`),

  /* --- Академия внутри --- */
  R('ac-course', 'Академия · курс',  `okoSkipAuth(); showTab('academy'); acOpenCourse(0);`),
  R('ac-lesson', 'Академия · урок',  `okoSkipAuth(); showTab('academy'); acOpenCourse(0); acOpen && acOpen(0);`,
    { alt: `okoSkipAuth(); showTab('academy'); acView='lesson'; acL=0; acRender();` }),

  /* --- подстраницы кошелька --- */
  ...['accounts','transfers','exchange','autopay','goals','analytics','receive','history','security','help']
    .map(k => R('w2-' + k, 'Кошелёк · ' + k, `okoSkipAuth(); showTab('wallet'); w2Open('${k}');`)),
  R('wal-stmt', 'Кошелёк · выписка', `okoSkipAuth(); showTab('wallet'); walOpenStatement();`),

  /* --- фуллскрин-вьюхи --- */
  R('settings',   'Настройки',            `okoSkipAuth(); showTab('profile'); st2Open();`),
  R('legal-hub',  'Документы · список',   `okoSkipAuth(); openLegalHub();`),
  R('legal-doc',  'Документы · оферта',   `okoSkipAuth(); openLegalDoc('terms');`),
  R('notifs',     'Уведомления',          `okoSkipAuth(); openNotifs();`),
  R('search',     'Поиск',                `okoSkipAuth(); openSearch();`),
  R('channels',   'Каналы',               `okoSkipAuth(); chOpen('list');`),
  R('pubprofile', 'Публичный профиль',    `okoSkipAuth(); psOpenProfile('Поддержка OKO');`),
  R('pssoc',      'Мои соцсети (хаб)',    `okoSkipAuth(); psSocOpen();`),
  R('editprof',   'Редактор профиля',     `okoSkipAuth(); showTab('profile'); openEdit();`),
  R('reg',        'Регистрация',          `okoSkipAuth(); regOpen();`),
  R('conv',       'Диалог в чатах',       `okoSkipAuth(); showTab('chats'); var r=document.querySelector('#chatList .ci, #chatList > *'); r && r.click();`),

  /* --- шторки --- */
  R('sh-npost',    'Шторка · новый пост',   `okoSkipAuth(); showTab('feed'); openSheet('npost');`),
  R('sh-newchat',  'Шторка · новый чат',    `okoSkipAuth(); showTab('chats'); openSheet('new-chat');`),
  R('sh-adscreate','Шторка · кампания',     `okoSkipAuth(); showTab('ads'); adsOpenCreate();`),
  R('sh-gmdaily',  'Шторка · задания дня',  `okoSkipAuth(); showTab('games'); gmDailyOpen();`),
  R('sh-gmbp',     'Шторка · боевой пропуск',`okoSkipAuth(); showTab('games'); gmBpOpen();`),
  R('sh-topup',    'Шторка · пополнение',   `okoSkipAuth(); showTab('wallet'); walOpenTopup();`),
  R('sh-send',     'Шторка · перевод',      `okoSkipAuth(); showTab('wallet'); walOpenSend();`),
  R('sh-payout',   'Шторка · выплата',      `okoSkipAuth(); showTab('partner'); openPayout();`),
  R('sh-vstopup',  'Шторка · пополнить TON',`okoSkipAuth(); showTab('ton'); vsOpenTopup();`),
  R('sh-vsrecv',   'Шторка · получить TON', `okoSkipAuth(); showTab('ton'); vsOpenRecv();`),
  R('sh-vshist',   'Шторка · история TON',  `okoSkipAuth(); showTab('ton'); vsOpenHistory();`),
  R('sh-vsmarket', 'Шторка · биржа подарков',`okoSkipAuth(); showTab('ton'); vsOpenMarket();`),
  R('sh-lang',     'Шторка · язык',         `okoSkipAuth(); showTab('profile'); openSheet('stLang');`),
];

/* --------------------------------------------------------------------------
   Замер в странице
   -------------------------------------------------------------------------- */
const MEASURE = `(() => {
  const VW = innerWidth, VH = innerHeight;

  /* элемент виден человеку: он сам и все предки не спрятаны */
  const shown = el => {
    let n = el;
    while (n && n.nodeType === 1) {
      const cs = getComputedStyle(n);
      if (cs.display === 'none' || cs.visibility === 'hidden' || parseFloat(cs.opacity) === 0) return false;
      if (cs.pointerEvents === 'none' && n !== el) return false;
      n = n.parentElement;
    }
    const r = el.getBoundingClientRect();
    return r.width > 0 && r.height > 0 && r.right > 1 && r.left < VW - 1 && r.bottom > 1 && r.top < VH - 1;
  };

  const label = el => {
    const id = el.id ? '#' + el.id : '';
    const cls = (typeof el.className === 'string' && el.className.trim())
      ? '.' + el.className.trim().split(/\\s+/).slice(0, 4).join('.') : '';
    return el.tagName.toLowerCase() + id + cls;
  };

  /* состояние приложения — по нему судим, что клик реально сработал */
  const state = () => {
    const s = document.querySelector('main > .screen.active');
    let nv = [];
    try { nv = nvStackLabels(); } catch (e) {}
    const open = Array.from(document.querySelectorAll('.open, [style*="display: block"]'))
      .filter(e => e.id).map(e => e.id).slice(0, 40).join(',');
    let ma = '';
    document.querySelectorAll('#screen-mini .ma-view').forEach(v => {
      if (getComputedStyle(v).display !== 'none') ma = v.id;
    });
    const ac = (typeof acView !== 'undefined') ? acView : '';
    const mk = (typeof mkView !== 'undefined') ? mkView : '';
    return [s ? s.id : '', nv.join('|'), open, ma, ac, mk].join('§');
  };

  const btns = [];
  document.querySelectorAll('button.oko-back').forEach(el => {
    if (!shown(el)) return;
    const r = el.getBoundingClientRect();
    const cs = getComputedStyle(el);
    btns.push({
      el: label(el),
      w: +r.width.toFixed(1), h: +r.height.toFixed(1),
      x: Math.round(r.left), y: Math.round(r.top),
      css: [cs.width, cs.height, cs.borderRadius, cs.display, cs.alignItems, cs.justifyContent].join('|'),
      icon: (() => { const u = el.querySelector('use'); return u ? (u.getAttribute('href') || '') : ''; })(),
      label: el.getAttribute('aria-label') || '',
    });
  });

  /* Чужие «назад» уровня экрана, оставшиеся с другим визуалом.
     Считаем только те, что стоят в шапочной зоне слева сверху — именно там
     человек ищет выход. Стрелки внутри контента (перелистывание слайдов,
     backspace в пин-коде, шаги мастеров) — не кнопки выхода. */
  const strays = [];
  const SKIP = /ac-arrow|ghosty|wal-live-x|mp-esc|mp-safety|acd-full|mp-mv-nav|reg-next|anketa/;
  document.querySelectorAll('button, a').forEach(el => {
    if (el.classList.contains('oko-back')) return;
    if (!shown(el)) return;
    if (SKIP.test(String(el.className || ''))) return;
    const u = el.querySelector('use');
    const href = u ? (u.getAttribute('href') || '') : '';
    if (href !== '#i-back') return;
    const r = el.getBoundingClientRect();
    if (r.top > 150 || r.left > 150) return;   /* не шапочная зона */
    strays.push({ el: label(el), text: (el.textContent || '').trim().slice(0, 20),
      w: Math.round(r.width), h: Math.round(r.height), y: Math.round(r.top) });
  });

  return { state: state(), btns, strays, reloaded: !!window.__okoReloaded };
})()`;

const STATE = `(() => {
  const s = document.querySelector('main > .screen.active');
  let nv = [];
  try { nv = nvStackLabels(); } catch (e) {}
  const open = Array.from(document.querySelectorAll('.open, [style*="display: block"]'))
    .filter(e => e.id).map(e => e.id).slice(0, 40).join(',');
  let ma = '';
  document.querySelectorAll('#screen-mini .ma-view').forEach(v => {
    if (getComputedStyle(v).display !== 'none') ma = v.id;
  });
  const ac = (typeof acView !== 'undefined') ? acView : '';
  const mk = (typeof mkView !== 'undefined') ? mkView : '';
  return [s ? s.id : '', nv.join('|'), open, ma, ac, mk].join('§');
})()`;

async function main() {
  const browser = await chromium.launch({
    executablePath: process.env.OKO_CHROME || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-gl=swiftshader', '--enable-unsafe-swiftshader'],
  });
  const ctx = await browser.newContext({
    viewport: { width: 390, height: 844 },
    isMobile: true, hasTouch: true, deviceScaleFactor: 1,
    userAgent: 'Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126 Mobile Safari/537.36',
  });
  await ctx.addInitScript(INIT);
  const page = await ctx.newPage();

  const errors = [];
  page.on('pageerror', e => errors.push(String(e).slice(0, 140)));

  const report = {
    at: new Date().toISOString(),
    viewport: '390x844',
    routes: [],
    visuals: {},
    summary: {},
  };

  for (const route of ROUTES) {
    const rep = { id: route.id, name: route.name, root: !!route.root, problems: [] };
    errors.length = 0;
    try {
      await page.goto(BASE, { waitUntil: 'domcontentloaded', timeout: 30000 });
      await page.waitForTimeout(1000);
      try { await page.evaluate(route.step); }
      catch (e) {
        rep.stepError = String(e.message || e).slice(0, 110);
        if (route.alt) { try { await page.evaluate(route.alt); } catch (e2) {} }
      }
      await page.waitForTimeout(700);

      const m = await page.evaluate(MEASURE);
      rep.buttons = m.btns.length;
      rep.strays = m.strays;
      rep.stateBefore = m.state;

      if (route.root) {
        /* на корневой вкладке кнопки быть не должно */
        if (m.btns.length) rep.problems.push('на корневой вкладке есть кнопка назад: ' + m.btns.map(b => b.el).join(', '));
      } else {
        if (!m.btns.length) {
          rep.problems.push('кнопки «назад» нет');
        } else {
          /* берём самую верхнюю-левую — она и есть «назад» этого экрана */
          const b = m.btns.slice().sort((p, q) => (p.y - q.y) || (p.x - q.x))[0];
          rep.back = b;
          if (b.w < 32 || b.h < 32) rep.problems.push(`кнопка мельче 32×32: ${b.w}×${b.h}`);
          if (b.y < 0) rep.problems.push(`кнопка заехала под шапку Telegram: top=${b.y}`);
          if (b.icon !== '#i-back') rep.problems.push('другой знак в кнопке: ' + b.icon);

          /* клик действительно уводит назад и не перезагружает страницу */
          const marked = await page.evaluate(`(() => {
            window.__okoNoReload = 1;
            return true;
          })()`);
          const sel = 'button.oko-back';
          const idx = m.btns.indexOf(b);
          await page.evaluate(`(() => {
            const list = Array.from(document.querySelectorAll('${sel}')).filter(el => {
              const r = el.getBoundingClientRect();
              return r.width > 0 && r.height > 0;
            });
            const el = list.sort((p,q)=>{
              const a=p.getBoundingClientRect(), b=q.getBoundingClientRect();
              return (a.top-b.top)||(a.left-b.left);
            })[0];
            if (el) el.click();
          })()`);
          await page.waitForTimeout(650);
          const after = await page.evaluate(STATE);
          rep.stateAfter = after;
          const survived = await page.evaluate('!!window.__okoNoReload');
          if (!survived) rep.problems.push('клик перезагрузил страницу');
          if (after === m.state) rep.problems.push('клик не изменил экран');
        }
      }

      if (m.strays.length) rep.problems.push('не приведены к единому виду: ' + m.strays.map(s => s.el).join(', '));
      if (errors.length) rep.jsErrors = errors.slice(0, 3);

      /* копим визуал для сверки одинаковости */
      for (const b of m.btns) {
        (report.visuals[b.css] = report.visuals[b.css] || []).push(route.id + ' ' + b.el);
      }
    } catch (e) {
      rep.fatal = String(e.message || e).slice(0, 160);
      rep.problems.push('падение маршрута');
    }
    report.routes.push(rep);
    const bad = rep.problems.length;
    console.log(`${rep.id.padEnd(14)} ${bad ? 'ПРОБЛЕМЫ: ' + rep.problems.join(' | ') : 'ok'}`);
  }

  await browser.close();

  const cssKeys = Object.keys(report.visuals);
  report.summary = {
    routes: report.routes.length,
    withProblems: report.routes.filter(r => r.problems.length).length,
    problems: report.routes.reduce((n, r) => n + r.problems.length, 0),
    distinctVisuals: cssKeys.length,
    visualsMatch: cssKeys.length <= 1,
  };

  await fs.writeFile(OUT, JSON.stringify(report, null, 2));
  console.log('\nИТОГ: маршрутов ' + report.summary.routes +
    ', с замечаниями ' + report.summary.withProblems +
    ', замечаний всего ' + report.summary.problems +
    ', вариантов визуала ' + report.summary.distinctVisuals);
  console.log('Отчёт: ' + OUT);
}

main().catch(e => { console.error(e); process.exit(1); });
