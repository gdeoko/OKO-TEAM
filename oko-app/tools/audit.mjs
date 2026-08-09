/* ============================================================================
   OKO · АУДИТ-ХАРНЕСС
   Обходит приложение по всем экранам в четырёх режимах, снимает скрины и
   автоматически ищет дефекты вёрстки, которые глазами ловятся долго:
     • горизонтальное переполнение страницы
     • блоки, вылезающие за правый край
     • обрезанный текст (реальная ширина больше видимой)
     • элементы, заехавшие под шапку Telegram или под нижний бар
     • пустые экраны (отрисовался, а контента нет)
     • переносы посреди слова

   Режим tg эмулирует Telegram Mini App: подставляет window.Telegram.WebApp
   с инсетами и рисует поверх страницы полосы, занятые интерфейсом Telegram,
   чтобы наложения были видны на скрине.

   Запуск:  node oko-app/tools/audit.mjs [--round N] [--only mode] [--base URL]
   ============================================================================ */
import { chromium } from 'playwright-core';
import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { CLEAN_START, CLOSE_OVERLAYS, OVERLAY_VISIBLE } from './clean-start.mjs';

const args = Object.fromEntries(
  process.argv.slice(2).join(' ').split('--').filter(Boolean)
    .map(s => { const [k, ...v] = s.trim().split(/\s+/); return [k, v.join(' ') || true]; })
);

const BASE  = args.base || 'http://127.0.0.1:8199/index.html';
const ROUND = String(args.round || '1');
const OUT   = path.resolve('oko-app/tools/audit-out', `round-${ROUND}`);

/* Высота шапки Telegram в мини-аппе (кнопка «назад», шеврон, «...») и
   нижней перетяжки. Значения соответствуют реальному клиенту на телефоне. */
const TG_HEADER = 56;
const TG_BOTTOM = 34;

const MODES = [
  { id: 'tg',      label: 'Telegram Mini App', width: 390, height: 844, mobile: true,  telegram: true  },
  { id: 'mobile',  label: 'Мобильный браузер', width: 390, height: 844, mobile: true,  telegram: false },
  { id: 'narrow',  label: 'Узкий Android',     width: 360, height: 740, mobile: true,  telegram: false },
  { id: 'tablet',  label: 'Планшет',           width: 820, height: 1180, mobile: false, telegram: false },
  { id: 'desktop', label: 'ПК',                width: 1440, height: 900, mobile: false, telegram: false },
];

/* Маршруты обхода. step: что сделать в браузере, чтобы попасть на экран. */
const ROUTES = [
  /* Слой полировки грузится как non-blocking стиль (media=print -> all).
     На 200 мс он ещё не применён, и закрытые выезжающие панели успевали
     попасть в замер. Даём стилям встать — иначе меряем не то состояние,
     которое человек видит. */
  { id: '01-splash',     name: 'Экран запуска',        wait: 1400, step: null },
  { id: '02-auth',       name: 'Вход и регистрация',   wait: 1200, step: `document.getElementById('splash')?.classList.add('gone'); document.getElementById('authScreen')?.classList.remove('hidden');` },
  { id: '03-feed-rec',   name: 'Лента · Рекомендации', step: `okoSkipAuth(); showTab('feed');` },
  /* Пауза перед кликом обязательна: вход в ленту через 20 мс форсит
     «Рекомендации» (лента по умолчанию всегда открывается на них), и клик в
     том же тике затирается. Человек в это окно не попадает физически, а
     маршрут попадал — и снимал «Подписки», которые на деле остались
     «Рекомендациями». Два одинаковых кадра в раунде 37 — ровно отсюда. */
  { id: '04-feed-sub',   name: 'Лента · Подписки',     step: `okoSkipAuth(); showTab('feed'); new Promise(r => setTimeout(r, 350)).then(() => { const b=document.querySelector('.feed-tabs button[data-fk="sub"]'); b&&b.click(); })` },
  { id: '05-chats',      name: 'Список чатов',         step: `okoSkipAuth(); showTab('chats');` },
  { id: '06-conv',       name: 'Диалог',               step: `okoSkipAuth(); showTab('chats'); const r=document.querySelector('#chatList .ci, #chatList > *'); r&&r.click();` },
  { id: '07-mini',       name: 'Мини-аппы',            step: `okoSkipAuth(); showTab('mini');` },
  { id: '08-wallet',     name: 'Кошелёк',              step: `okoSkipAuth(); showTab('wallet');` },
  { id: '09-profile',    name: 'Профиль',              step: `okoSkipAuth(); showTab('profile');` },
  { id: '10-partner',    name: 'Партнёрка',            step: `okoSkipAuth(); showTab('partner');` },
  { id: '11-academy',    name: 'Академия',             step: `okoSkipAuth(); showTab('academy');` },
  { id: '12-games',      name: 'Игры',                 step: `okoSkipAuth(); showTab('games');` },
  { id: '13-ads',        name: 'Реклама',              step: `okoSkipAuth(); showTab('ads');` },
  { id: '14-notifs',     name: 'Уведомления',          step: `okoSkipAuth(); typeof openNotifs==='function'&&openNotifs();` },
  { id: '15-search',     name: 'Поиск',                step: `okoSkipAuth(); typeof openSearch==='function'&&openSearch();` },
  { id: '16-settings',   name: 'Настройки',            step: `okoSkipAuth(); showTab('profile'); typeof st2Open==='function'?st2Open():(typeof openSettingsRoot==='function'&&openSettingsRoot());` },
  { id: '17-wallet-hist',name: 'История операций',     step: `okoSkipAuth(); showTab('wallet'); typeof w2Open==='function'&&w2Open('statement');` },
  { id: '18-wallet-tr',  name: 'Переводы',             step: `okoSkipAuth(); showTab('wallet'); typeof w2Open==='function'&&w2Open('transfers');` },
  { id: '19-wallet-ex',  name: 'Обмен валют',          step: `okoSkipAuth(); showTab('wallet'); typeof w2Open==='function'&&w2Open('exchange');` },
  { id: '20-wallet-sec', name: 'Безопасность',         step: `okoSkipAuth(); showTab('wallet'); typeof w2Open==='function'&&w2Open('security');` },
  { id: '21-clips',      name: 'Клипы (Reels)',        wait: 1400, step: `okoSkipAuth(); showTab('feed'); typeof okoOpenClips==='function'&&okoOpenClips();` },
  { id: '22-tour',       name: 'Сторис основателя',    wait: 1600, step: `okoSkipAuth(); typeof trStoriesStart==='function'&&trStoriesStart(null);` },
  { id: '23-channels',   name: 'Каналы',               step: `okoSkipAuth(); typeof chOpen==='function'&&chOpen('list');` },
  { id: '24-profile-pub',name: 'Публичный профиль',    step: `okoSkipAuth(); typeof psOpenProfile==='function'&&psOpenProfile('Поддержка OKO');` },
];

/* Скрипт, который выполняется ДО загрузки страницы каждого прогона. */
function initScript(mode) {
  return `
    /* Первый заход показывает сторис, тур и «Знакомство» — это штатное
       поведение приложения, но для обхода внутренних экранов всё это надо
       пометить просмотренным, иначе оно перекроет собой проверяемый экран.
       Список ключей — общий для всех проверок, см. clean-start.mjs: раньше
       он был копией в каждом файле, и появление oko-onb2.js со своим ключом
       незаметно превратило аудит в проверку одного и того же онбординга. */
    ${CLEAN_START}

    ${mode.telegram ? `
    /* ---- Эмуляция Telegram Mini App ---- */
    (function(){
      var handlers = {};
      window.Telegram = { WebApp: {
        initData: 'query_id=OKOAUDIT&user=%7B%22id%22%3A1%7D&auth_date=1&hash=x',
        initDataUnsafe: { user: { id: 1, first_name: 'Даниэль', last_name: 'Ильясов', username: 'ktodaniel' } },
        version: '8.0', platform: 'android', colorScheme: 'dark',
        isExpanded: true, isFullscreen: false,
        viewportHeight: ${mode.height - TG_HEADER}, viewportStableHeight: ${mode.height - TG_HEADER},
        /* В fullsize-режиме Telegram сам держит место под шапку -> инсеты нулевые */
        safeAreaInset: { top: 0, bottom: ${TG_BOTTOM}, left: 0, right: 0 },
        contentSafeAreaInset: { top: 0, bottom: 0, left: 0, right: 0 },
        themeParams: {},
        ready(){}, expand(){}, close(){},
        requestFullscreen(){ window.__okoFullscreenRequested = true; },
        exitFullscreen(){ this.isFullscreen = false; },
        disableVerticalSwipes(){}, enableVerticalSwipes(){},
        lockOrientation(){}, unlockOrientation(){},
        setHeaderColor(){}, setBackgroundColor(){}, setBottomBarColor(){},
        onEvent(n,f){ (handlers[n]=handlers[n]||[]).push(f); },
        offEvent(n,f){},
        HapticFeedback: { impactOccurred(){}, notificationOccurred(){}, selectionChanged(){} },
        BackButton: { isVisible:false, show(){this.isVisible=true;}, hide(){this.isVisible=false;}, onClick(){}, offClick(){} },
        MainButton: { show(){}, hide(){}, setText(){}, onClick(){} },
        CloudStorage: { getItem(k,cb){cb&&cb(null,null);}, setItem(k,v,cb){cb&&cb(null,true);} },
      }};
    })();
    ` : ''}
  `;
}

/* Оверлей, изображающий интерфейс Telegram поверх страницы — чтобы на скрине
   было сразу видно, что под него заезжает. */
const TG_CHROME = `
  (function(){
    if(document.getElementById('okoTgChrome')) return;
    var d=document.createElement('div'); d.id='okoTgChrome';
    d.style.cssText='position:fixed;inset:0;z-index:2147483647;pointer-events:none';
    d.innerHTML =
      '<div style="position:absolute;top:0;left:0;right:0;height:2px;'+
      'background:transparent;border-bottom:2px dashed rgba(255,0,80,.75);'+
      'font:600 11px/1 sans-serif;color:#fff;display:flex;align-items:center;'+
      'justify-content:space-between;padding:0 14px;box-sizing:border-box">'+
      '</div>'+
      '<div style="position:absolute;bottom:0;left:0;right:0;height:${TG_BOTTOM}px;'+
      'background:transparent;border-top:2px dashed rgba(255,0,80,.75)"></div>';
    document.body.appendChild(d);
  })();
`;

/* ---- Детектор дефектов вёрстки, выполняется в странице ---- */
const PROBE = `(() => {
  const out = { overflowX: 0, offRight: [], clipped: [], underTop: [], underBottom: [], empty: false, midWordBreak: [] };
  const VW = window.innerWidth, VH = window.innerHeight;
  const TOP = ${TG_HEADER}, BOT = ${TG_BOTTOM};
  const tg = !!(window.Telegram && window.Telegram.WebApp && window.Telegram.WebApp.initData);

  const de = document.documentElement;
  out.overflowX = Math.max(0, de.scrollWidth - de.clientWidth);
  out.fullscreenRequested = !!window.__okoFullscreenRequested;

  const label = el => {
    const id = el.id ? '#' + el.id : '';
    const cls = (el.className && typeof el.className === 'string')
      ? '.' + el.className.trim().split(/\\s+/).slice(0, 3).join('.') : '';
    return el.tagName.toLowerCase() + id + cls;
  };
  const visible = el => {
    const cs = getComputedStyle(el);
    if (cs.display === 'none' || cs.visibility === 'hidden' || cs.opacity === '0') return false;
    const r = el.getBoundingClientRect();
    if (r.width <= 0 || r.height <= 0) return false;
    /* Закрытые оверлеи стоят за правым краем (translateX(100%)) или ниже экрана.
       Они не видны человеку — считать их дефектами нельзя. */
    if (r.left >= VW - 1 || r.right <= 1) return false;
    if (r.top >= VH - 1 || r.bottom <= 1) return false;
    return true;
  };

  const all = Array.from(document.body.querySelectorAll('*')).slice(0, 4000);
  for (const el of all) {
    if (el.id === 'okoTgChrome' || el.closest('#okoTgChrome')) continue;
    /* Внутренности SVG (circle/path/rect) не участвуют в раскладке страницы:
       за размер отвечает сам <svg>, а декоративная геометрия внутри почти
       всегда обрезана контейнером с overflow:hidden. Их bounding box давал
       ложные срабатывания «вылезает за правый край». */
    if (el.ownerSVGElement) continue;
    if (!visible(el)) continue;
    const r = el.getBoundingClientRect();
    const cs = getComputedStyle(el);

    /* Есть ли предок с горизонтальной прокруткой: ряды чипов и фильтров
       ездят внутри себя — выходить за край для них нормально. */
    let inScroller = false;
    for (let p = el.parentElement, d = 0; p && d < 6; p = p.parentElement, d++) {
      const pcs = getComputedStyle(p);
      if (pcs.overflowX === 'auto' || pcs.overflowX === 'scroll') { inScroller = true; break; }
    }

    // блок вылезает за правый край
    if (!inScroller && r.right > VW + 1 && r.width < VW * 1.6)
      out.offRight.push({ el: label(el), right: Math.round(r.right), vw: VW });

    // текст обрезан по горизонтали
    const txt = (el.textContent || '').trim();
    if (txt && el.children.length === 0) {
      /* Многоточие — осознанное сокращение превью (список чатов, как в Telegram).
         Дефект — это когда текст режется БЕЗ многоточия, «в никуда». */
      const intentional = cs.textOverflow === 'ellipsis' || cs.webkitLineClamp !== 'none';
      if (!intentional && el.scrollWidth > el.clientWidth + 2 && cs.overflow !== 'visible') {
        out.clipped.push({ el: label(el), text: txt.slice(0, 48), sw: el.scrollWidth, cw: el.clientWidth });
      }
      // перенос посреди слова
      if (cs.wordBreak === 'break-all' && /[А-Яа-яA-Za-z]{4,}/.test(txt) && r.width < 120) {
        out.midWordBreak.push({ el: label(el), text: txt.slice(0, 40) });
      }
    }

    /* Обрезание по краям вьюпорта.
       В fullsize-режиме вебвью УЖЕ начинается под шапкой Telegram, поэтому
       «под шапкой» = уехал выше нуля. Снизу Telegram оставляет полосу
       домашнего индикатора высотой safeAreaInset.bottom. */
    if (cs.position === 'fixed' || cs.position === 'sticky') {
      if (r.top < -1 && r.bottom > 2) out.underTop.push({ el: label(el), top: Math.round(r.top) });
      /* Полноэкранная подложка (inset:0) законно занимает весь вьюпорт —
         это фон оверлея, а не контент. Считаем дефектом только то, что
         НАЧИНАЕТСЯ выше нижней полосы и в неё заезжает. */
      const fullBleed = r.top <= 1 && r.bottom >= VH - 1;
      if (tg && !fullBleed && r.bottom > VH - BOT + 1 && r.top < VH - 2 &&
          cs.zIndex !== 'auto' && +cs.zIndex > 40)
        out.underBottom.push({ el: label(el), bottom: Math.round(r.bottom) });
    }
  }

  // пустой экран: активный экран без видимого содержимого
  const act = document.querySelector('main > .screen.active') ||
              document.querySelector('.w2-page.open, .sv-body');
  if (act) {
    const t = (act.innerText || '').trim();
    out.empty = t.length < 12;
    out.activeScreen = act.id || label(act);
    out.activeText = t.slice(0, 60);
  }

  const dedupe = a => { const s = new Set(); return a.filter(x => { const k = JSON.stringify(x); if (s.has(k)) return false; s.add(k); return true; }); };
  out.offRight = dedupe(out.offRight).slice(0, 12);
  out.clipped = dedupe(out.clipped).slice(0, 12);
  out.underTop = dedupe(out.underTop).slice(0, 12);
  out.underBottom = dedupe(out.underBottom).slice(0, 12);
  out.midWordBreak = dedupe(out.midWordBreak).slice(0, 12);
  return out;
})()`;

async function main() {
  await fs.mkdir(OUT, { recursive: true });
  const browser = await chromium.launch({
    executablePath: process.env.OKO_CHROME || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-gl=swiftshader', '--enable-unsafe-swiftshader'],
  });

  const report = { round: ROUND, at: new Date().toISOString(), modes: [] };
  const only = args.only && args.only !== true ? String(args.only) : null;
  /* Отбор экранов: без него точечная проверка одного маршрута гоняет все 120
     и упирается в таймаут. Принимает часть имени: --screens feed,wallet */
  const маски = args.screens && args.screens !== true
    ? String(args.screens).split(',').map(s => s.trim()).filter(Boolean) : null;
  const нужен = r => !маски || маски.some(m => r.id.includes(m));

  for (const mode of MODES) {
    if (only && mode.id !== only) continue;
    const modeRep = { mode: mode.id, label: mode.label, routes: [] };
    const ctx = await browser.newContext({
      viewport: { width: mode.width, height: mode.telegram ? mode.height - TG_HEADER : mode.height },
      deviceScaleFactor: 2,
      isMobile: mode.mobile,
      hasTouch: mode.mobile,
      userAgent: mode.mobile
        ? 'Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126 Mobile Safari/537.36'
        : undefined,
    });
    await ctx.addInitScript(initScript(mode));

    const page = await ctx.newPage();
    const consoleErrors = [];
    /* Внешние CDN (amplitude / sentry / telegram.org) в песочнице режет прокси.
       Это шум окружения, а не дефект приложения — не засчитываем. */
    const NOISE = /ERR_CONNECTION_RESET|ERR_NAME_NOT_RESOLVED|ERR_BLOCKED|net::ERR_/i;
    page.on('console', m => {
      if (m.type() !== 'error') return;
      const t = m.text().slice(0, 200);
      if (!NOISE.test(t)) consoleErrors.push(t);
    });
    page.on('pageerror', e => consoleErrors.push('PAGEERROR: ' + String(e).slice(0, 200)));

    for (const route of ROUTES) {
      if (!нужен(route)) continue;
      const rep = { route: route.id, name: route.name, errors: [] };
      try {
        consoleErrors.length = 0;
        await page.goto(BASE, { waitUntil: 'domcontentloaded', timeout: 30000 });
        await page.waitForTimeout(route.wait || 900);
        if (route.step) {
          try { await page.evaluate(route.step); } catch (e) { rep.stepError = String(e).slice(0, 160); }
          await page.waitForTimeout(700);
        }
        if (mode.telegram) await page.evaluate(TG_CHROME);

        /* Перед замером снимаем всё, что могло всплыть поверх экрана:
           «Знакомство», тур, сторис, попап. Иначе меряется не тот экран —
           именно так аудит 36 проверил онбординг 33 раза вместо кошелька,
           клипов, каналов и настроек, и отрапортовал «0 замечаний». */
        rep.снятоПоверх = await page.evaluate(CLOSE_OVERLAYS).catch(() => []);
        if (rep.снятоПоверх.length) await page.waitForTimeout(250);

        /* Если что-то всё равно закрывает больше 40% экрана — замер
           недействителен, и об этом надо сказать вслух, а не молча зачесть. */
        rep.экранПодменён = await page.evaluate(OVERLAY_VISIBLE).catch(() => '');

        const probe = await page.evaluate(PROBE);
        Object.assign(rep, probe);
        rep.consoleErrors = consoleErrors.slice(0, 6);

        const file = path.join(OUT, `${mode.id}__${route.id}.png`);
        /* Скриншот иногда не успевает за 30 с, когда песочница занята другими
           прогонами. Это шум окружения, а не дефект экрана: замеры вёрстки
           уже сняты выше. Не валим из-за кадра весь маршрут. */
        try {
          await page.screenshot({ path: file, timeout: 15000 });
          rep.shot = path.relative(process.cwd(), file);
        } catch (e) {
          rep.shotSkipped = String(e).slice(0, 80);
        }
      } catch (e) {
        rep.fatal = String(e).slice(0, 200);
      }
      modeRep.routes.push(rep);
      const flags = [
        rep.overflowX > 0 ? `overflowX=${rep.overflowX}` : '',
        rep.offRight?.length ? `offRight=${rep.offRight.length}` : '',
        rep.clipped?.length ? `clipped=${rep.clipped.length}` : '',
        rep.underTop?.length ? `underTop=${rep.underTop.length}` : '',
        rep.empty ? 'EMPTY' : '',
        rep.consoleErrors?.length ? `err=${rep.consoleErrors.length}` : '',
        rep.fatal ? 'FATAL' : '',
        rep.экранПодменён ? `ПОДМЕНЁН ${rep.экранПодменён}` : '',
      ].filter(Boolean).join(' ');
      console.log(`${mode.id.padEnd(8)} ${route.id.padEnd(16)} ${flags || 'ok'}`);
    }
    await ctx.close();
    report.modes.push(modeRep);
  }

  await browser.close();
  await fs.writeFile(path.join(OUT, 'report.json'), JSON.stringify(report, null, 2));

  /* Сводка. Вёрстку и шум консоли считаем ОТДЕЛЬНО: локально всегда падает
     запрос к api.php (PHP-бэкенд живёт только на VPS), и раньше эти сотни
     одинаковых 404 подмешивались в общее число — выходило «332 замечания»
     при нулевых дефектах вёрстки. Теперь видно, что именно чинить. */
  let layout = 0, fatal = 0, backend = 0, other = 0;
  const otherMsgs = new Map();
  for (const m of report.modes) for (const r of m.routes) {
    layout += (r.overflowX > 0 ? 1 : 0) + (r.offRight?.length || 0) + (r.clipped?.length || 0) +
              (r.underTop?.length || 0) + (r.underBottom?.length || 0) +
              (r.midWordBreak?.length || 0) + (r.empty ? 1 : 0);
    if (r.fatal) fatal++;
    for (const e of (r.consoleErrors || [])) {
      const s = String(e);
      if (/api\.php|Failed to fetch|ERR_CONNECTION|404 \(File not found\)/i.test(s)) backend++;
      else { other++; otherMsgs.set(s.slice(0, 120), (otherMsgs.get(s.slice(0, 120)) || 0) + 1); }
    }
  }
  console.log(`\nРАУНД ${ROUND}`);
  console.log(`  вёрстка:            ${layout}`);
  console.log(`  падения маршрутов:  ${fatal}`);
  console.log(`  ошибки в коде:      ${other}`);
  console.log(`  бэкенд недоступен:  ${backend} (ожидаемо: api.php только на VPS)`);
  for (const [msg, n] of [...otherMsgs.entries()].slice(0, 8)) console.log(`    ${n}× ${msg}`);

  /* --- одинаковые кадры = экран не открылся --------------------------------
     Самая коварная поломка проверки: маршрут не сработал, поверх остался
     прошлый экран или оболочка, замеры сняты с него и все зелёные. Ловится
     только сверкой самих картинок. Аудит 36 так и прошёл: в «десктопе»
     16 кадров из 24 были одной и той же картинкой. */
  const кадры = new Map();
  for (const f of (await fs.readdir(OUT)).filter(f => f.endsWith('.png'))) {
    const h = crypto.createHash('md5').update(await fs.readFile(path.join(OUT, f))).digest('hex');
    if (!кадры.has(h)) кадры.set(h, []);
    кадры.get(h).push(f);
  }
  const повторы = [...кадры.values()].filter(g => g.length > 1);
  const вПовторах = повторы.reduce((n, g) => n + g.length, 0);
  console.log(`  одинаковых кадров:  ${вПовторах}${вПовторах ? '   ← эти экраны НЕ открылись, замеры по ним недействительны' : ''}`);
  for (const g of повторы.sort((a, b) => b.length - a.length).slice(0, 5)) {
    console.log(`    ${g.length}× ${g.slice(0, 4).join(', ')}${g.length > 4 ? ' …' : ''}`);
  }

  console.log(`  отчёт: ${path.join(OUT, 'report.json')}`);
}

main().catch(e => { console.error(e); process.exit(1); });
