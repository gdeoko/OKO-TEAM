/* ============================================================================
   OKO · ПРОБНИК БИРЖИ
   Проходит полный пользовательский сценарий маркетплейса в трёх вьюпортах
   (телефон 390×844, узкий Android 360×740, ПК 1440×900) и на каждом шаге
   автоматически проверяет вёрстку:

     • горизонтальное переполнение страницы (scrollWidth > clientWidth)
     • обрезанный текст (scrollWidth > clientWidth + 2 без ellipsis/line-clamp)
     • контент, заехавший под нижнее меню (nav#tabs)
     • наличие кнопки «назад» на каждой подстранице
     • ошибки в консоли

   Сценарий:
     1. открыть биржу         → пусто, честный empty-state
     2. создать объявление    → мастер, 7 шагов
     3. проверить каталог     → карточка появилась
     4. «Мои объявления»      → карточка в «Активные»
     5. открыть карточку      → детальная страница
     6. в избранное           → счётчик избранного
     7. снять с публикации    → уехало в «Архив», каталог снова пуст
     8. удалить               → списки пусты, каталог пуст

   Запуск: node oko-app/tools/probe-market.mjs [--base URL]
   ============================================================================ */
import { chromium } from 'playwright-core';
import fs from 'node:fs/promises';
import path from 'node:path';

const args = Object.fromEntries(
  process.argv.slice(2).join(' ').split('--').filter(Boolean)
    .map(s => { const [k, ...v] = s.trim().split(/\s+/); return [k, v.join(' ') || true]; })
);
const BASE = args.base || 'http://127.0.0.1:8199/index.html';
const OUT = path.resolve('oko-app/tools');

const MODES = [
  { id: 'phone',   label: 'Телефон 390×844',      width: 390,  height: 844,  mobile: true },
  { id: 'narrow',  label: 'Узкий Android 360×740', width: 360, height: 740,  mobile: true },
  { id: 'desktop', label: 'ПК 1440×900',          width: 1440, height: 900,  mobile: false }
];

/* Пропуск авторизации — как в audit.mjs */
const INIT = `
  window.okoSkipAuth = function(){
    try{ localStorage.setItem('oko-auth','tg'); }catch(e){}
    var a=document.getElementById('authScreen'); if(a){a.classList.add('hidden'); a.style.display='none';}
    var s=document.getElementById('splash'); if(s){s.classList.add('gone'); s.style.display='none';}
    var o=document.getElementById('onboard'); if(o){o.classList.add('hidden'); o.style.display='none';}
  };
  try{
    localStorage.setItem('oko-onboard-done','1');
    localStorage.setItem('oko-stories-seen','1');
    localStorage.setItem('oko-tour-done','1');
    localStorage.setItem('oko-tour','1');
    localStorage.removeItem('oko-market-v3');
  }catch(e){}
`;

/* ---- Детектор дефектов вёрстки, выполняется в странице ---- */
const PROBE = `(() => {
  const out = { overflowX: 0, clipped: [], offRight: [], underNav: [], hasBack: false, backText: '', title: '', empty: false };
  const de = document.documentElement;
  out.overflowX = Math.max(0, de.scrollWidth - de.clientWidth);
  const VW = window.innerWidth, VH = window.innerHeight;

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
    if (r.left >= VW - 1 || r.right <= 1) return false;
    if (r.top >= VH - 1 || r.bottom <= 1) return false;
    return true;
  };

  const host = document.getElementById('ma-market');
  const scope = (host && host.style.display === 'block') ? host : document.body;

  /* кнопка «назад» на текущем экране биржи */
  const backBtn = scope.querySelector('[data-mk="back"], .mk2-back');
  out.hasBack = !!(backBtn && visible(backBtn));
  out.backText = backBtn ? (backBtn.textContent || '').trim() : '';
  const t = document.getElementById('mk3Title');
  out.title = t ? (t.textContent || '').trim() : '';
  out.empty = !!scope.querySelector('.mk2-empty');

  /* нижнее меню — под него ничего не должно заезжать */
  const nav = document.getElementById('tabs');
  const navTop = nav ? nav.getBoundingClientRect().top : VH;

  const all = Array.from(scope.querySelectorAll('*')).slice(0, 4000);
  for (const el of all) {
    if (el.ownerSVGElement) continue;
    if (!visible(el)) continue;
    const r = el.getBoundingClientRect();
    const cs = getComputedStyle(el);

    let inScroller = false;
    for (let p = el.parentElement, d = 0; p && d < 6; p = p.parentElement, d++) {
      const pcs = getComputedStyle(p);
      if (pcs.overflowX === 'auto' || pcs.overflowX === 'scroll') { inScroller = true; break; }
    }
    if (!inScroller && r.right > VW + 1 && r.width < VW * 1.6)
      out.offRight.push({ el: label(el), right: Math.round(r.right), vw: VW });

    const txt = (el.textContent || '').trim();
    if (txt && el.children.length === 0) {
      const intentional = cs.textOverflow === 'ellipsis' || cs.webkitLineClamp !== 'none';
      if (!intentional && el.scrollWidth > el.clientWidth + 2 && cs.overflow !== 'visible')
        out.clipped.push({ el: label(el), text: txt.slice(0, 48), sw: el.scrollWidth, cw: el.clientWidth });
    }

    /* фиксированные слои поверх нижнего меню */
    if ((cs.position === 'fixed' || cs.position === 'sticky') && nav) {
      const fullBleed = r.top <= 1 && r.bottom >= VH - 1;
      if (!fullBleed && r.bottom > navTop + 1 && r.top < navTop - 2 && cs.zIndex !== 'auto' && +cs.zIndex > 40)
        out.underNav.push({ el: label(el), bottom: Math.round(r.bottom), navTop: Math.round(navTop) });
    }
  }

  const dedupe = a => { const s = new Set(); return a.filter(x => { const k = JSON.stringify(x); if (s.has(k)) return false; s.add(k); return true; }); };
  out.clipped = dedupe(out.clipped).slice(0, 10);
  out.offRight = dedupe(out.offRight).slice(0, 10);
  out.underNav = dedupe(out.underNav).slice(0, 10);
  return out;
})()`;

/* --------------------------------------------------------------------------- */

const TITLE = 'Монтаж вертикальных роликов под ключ';
const DESC = 'Собираю Reels и Shorts из твоих исходников: динамичный монтаж, субтитры, звук, обложка. Две правки включены в стоимость, сдача в 1080x1920.';

async function run(page, mode, rep) {
  const steps = [];
  let stepNo = 0;

  async function check(name, opts = {}) {
    stepNo++;
    await page.waitForTimeout(opts.wait || 320);
    const probe = await page.evaluate(PROBE);
    const extra = opts.extra ? await page.evaluate(opts.extra) : null;
    const errors = [];
    if (probe.overflowX > 0) errors.push(`горизонтальное переполнение ${probe.overflowX}px`);
    if (probe.clipped.length) errors.push(`обрезан текст: ${probe.clipped.map(c => c.text).join(' | ')}`);
    if (probe.offRight.length) errors.push(`за правым краем: ${probe.offRight.map(c => c.el).join(', ')}`);
    if (probe.underNav.length) errors.push(`под нижним меню: ${probe.underNav.map(c => c.el).join(', ')}`);
    if (!opts.noBack && !probe.hasBack) errors.push('нет кнопки «назад»');
    if (opts.expect) {
      const bad = opts.expect(extra, probe);
      if (bad) errors.push(bad);
    }
    steps.push({
      n: stepNo, step: name, title: probe.title, back: probe.backText,
      overflowX: probe.overflowX, clipped: probe.clipped.length,
      offRight: probe.offRight.length, underNav: probe.underNav.length,
      hasBack: probe.hasBack, empty: probe.empty,
      state: extra, errors
    });
    const flag = errors.length ? 'ОШИБКИ: ' + errors.join('; ') : 'ok';
    console.log(`  ${String(stepNo).padStart(2, '0')} ${name.padEnd(34)} ${flag}`);
    if (opts.shot) {
      try { await page.screenshot({ path: path.join(OUT, `market-${mode.id}-${opts.shot}.png`), timeout: 15000, fullPage: !!opts.full }); }
      catch (e) { /* скрин не критичен */ }
    }
    return probe;
  }

  const STATE = `(() => {
    const S = JSON.parse(localStorage.getItem('oko-market-v3') || '{"listings":[],"favs":[],"history":[],"deals":[]}');
    const root = document.getElementById('marketRoot');
    return {
      listings: S.listings.length,
      active: S.listings.filter(l => l.status === 'active').length,
      archived: S.listings.filter(l => l.status === 'archived').length,
      favs: S.favs.length,
      cards: root ? root.querySelectorAll('[data-mk="card"]').length : 0,
      hasEmpty: !!(root && root.querySelector('.mk2-empty')),
      title: (document.getElementById('mk3Title') || {}).textContent || ''
    };
  })()`;

  const click = async (sel) => {
    await page.waitForSelector(sel, { state: 'visible', timeout: 8000 });
    await page.click(sel);
    await page.waitForTimeout(220);
  };

  /* 1. открыть биржу */
  await page.evaluate(`okoSkipAuth(); showTab('mini'); openMa('market');`);
  await check('1. Биржа · пустой каталог', {
    noBack: false, shot: '01-empty', extra: STATE,
    expect: (s) => (s.cards === 0 && s.hasEmpty) ? '' : 'ожидался пустой каталог с empty-state'
  });

  /* 2. мастер размещения */
  await click('[data-mk="create"]');
  await check('2. Мастер · шаг 1 категория', { shot: '02-wizard-cat', extra: STATE });

  await click('.mk2-catrow[data-val="video"]');
  await click('[data-mk="next"]');
  await check('3. Мастер · шаг 2 фото', { extra: STATE });

  await click('[data-mk="next"]');
  await page.fill('#mk2title', TITLE);
  await check('4. Мастер · шаг 3 заголовок', { shot: '03-wizard-title', extra: STATE });

  await click('[data-mk="next"]');
  await page.fill('#mk2desc', DESC);
  await check('5. Мастер · шаг 4 описание', { extra: STATE });

  await click('[data-mk="next"]');
  await page.fill('#mk2price', '4500');
  await check('6. Мастер · шаг 5 цена', { extra: STATE });

  await click('[data-mk="next"]');
  await check('7. Мастер · шаг 6 условия', { extra: STATE });

  await click('[data-mk="next"]');
  await check('8. Мастер · шаг 7 предпросмотр', { shot: '04-wizard-preview', extra: STATE, full: true });

  /* 3. публикация */
  await click('[data-mk="publish"]');
  await check('9. Карточка после публикации', {
    shot: '05-item', full: true, extra: STATE,
    expect: (s) => s.active === 1 ? '' : `после публикации активных должно быть 1, а их ${s.active}`
  });

  /* 4. каталог */
  await page.evaluate(`okoMarketOpen()`);
  await check('10. Каталог · объявление видно', {
    shot: '06-catalog', extra: STATE,
    expect: (s) => s.cards >= 1 ? '' : 'объявление не появилось в каталоге'
  });

  /* 5. мои объявления */
  await click('[data-mk="mine"]');
  await check('11. Мои объявления · активные', {
    shot: '07-mine', full: true, extra: STATE,
    expect: (s) => s.cards >= 1 ? '' : 'объявления нет в «Мои объявления»'
  });

  /* 6. открыть карточку из «Мои объявления» */
  await click('[data-mk="card"]');
  await check('12. Карточка объявления', { shot: '08-item-own', full: true, extra: STATE });

  /* 7. в избранное */
  await click('[data-mk="fav-toggle"]');
  await check('13. Добавлено в избранное', {
    extra: STATE,
    expect: (s) => s.favs === 1 ? '' : `в избранном должно быть 1, а там ${s.favs}`
  });

  /* 8. снять с публикации */
  await click('[data-mk="unpublish"]');
  await check('14. Снято с публикации', {
    shot: '09-archived', extra: STATE,
    expect: (s) => (s.archived === 1 && s.active === 0) ? '' : `ожидался архив 1 / активных 0, получено ${s.archived}/${s.active}`
  });

  /* каталог снова пуст */
  await page.evaluate(`okoMarketOpen()`);
  await check('15. Каталог снова пуст', {
    extra: STATE,
    expect: (s) => (s.cards === 0 && s.hasEmpty) ? '' : 'снятое объявление всё ещё в каталоге'
  });

  /* 9. удалить */
  await click('[data-mk="mine"]');
  await page.evaluate(`document.querySelector('.mk2-tabs button[data-val="archived"]').click()`);
  await page.waitForTimeout(250);
  await click('[data-mk="delete"]');
  await check('16. Подтверждение удаления', { extra: STATE, shot: '10-delete' });
  await click('[data-mk="delete-yes"]');
  await check('17. После удаления', {
    extra: STATE,
    expect: (s) => s.listings === 0 ? '' : `после удаления должно быть 0 объявлений, осталось ${s.listings}`
  });

  /* 10. обратно на главную биржи — снова честно пусто */
  await page.evaluate(`okoMarketOpen()`);
  await check('18. Биржа снова пуста', {
    shot: '11-empty-again', full: true, extra: STATE,
    expect: (s) => (s.cards === 0 && s.hasEmpty) ? '' : 'каталог должен быть пустым'
  });

  /* 11. остальные разделы */
  await click('[data-mk="fav"]');
  await check('19. Избранное', { extra: STATE, shot: '12-fav' });
  await page.evaluate(`okoMarketOpen()`);
  await click('[data-mk="history"]');
  await check('20. История просмотров', { extra: STATE });
  await page.evaluate(`okoMarketOpen()`);
  await click('[data-mk="deals"]');
  await check('21. Отклики и сделки', { extra: STATE, shot: '13-deals' });
  await page.evaluate(`okoMarketOpen()`);
  await click('[data-mk="filters"]');
  await check('22. Шторка фильтров', { extra: STATE, shot: '14-filters', noBack: false });
  await page.keyboard.press('Escape');
  await page.waitForTimeout(300);
  await check('23. Escape закрыл шторку', { extra: STATE });

  /* 12. системная «назад» из подстраницы */
  await click('[data-mk="mine"]');
  await page.goBack().catch(() => {});
  await page.waitForTimeout(400);
  await check('24. Системная «назад» вернула на биржу', {
    extra: STATE,
    expect: (s) => /Биржа/.test(s.title) ? '' : `после back ожидалась главная биржи, а заголовок «${s.title}»`
  });

  rep.steps = steps;
  rep.errors = steps.reduce((a, s) => a + s.errors.length, 0);
  return steps;
}

async function main() {
  const browser = await chromium.launch({
    executablePath: process.env.OKO_CHROME || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-gl=swiftshader', '--enable-unsafe-swiftshader']
  });

  const report = { at: new Date().toISOString(), base: BASE, modes: [] };

  for (const mode of MODES) {
    console.log(`\n=== ${mode.label} ===`);
    const ctx = await browser.newContext({
      viewport: { width: mode.width, height: mode.height },
      deviceScaleFactor: 2,
      isMobile: mode.mobile,
      hasTouch: mode.mobile,
      userAgent: mode.mobile
        ? 'Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126 Mobile Safari/537.36'
        : undefined
    });
    await ctx.addInitScript(INIT);
    const page = await ctx.newPage();

    const consoleErrors = [];
    const NOISE = /ERR_CONNECTION_RESET|ERR_NAME_NOT_RESOLVED|ERR_BLOCKED|net::ERR_|Failed to load resource/i;
    page.on('console', m => {
      if (m.type() !== 'error') return;
      const t = m.text().slice(0, 200);
      if (!NOISE.test(t)) consoleErrors.push(t);
    });
    page.on('pageerror', e => {
      const t = 'PAGEERROR: ' + String(e).slice(0, 200);
      if (!NOISE.test(t)) consoleErrors.push(t);
    });

    const rep = { mode: mode.id, label: mode.label, steps: [], errors: 0, consoleErrors: [] };
    try {
      await page.goto(BASE, { waitUntil: 'domcontentloaded', timeout: 40000 });
      await page.waitForTimeout(1500);
      await run(page, mode, rep);
    } catch (e) {
      rep.fatal = String(e).slice(0, 400);
      console.log('  FATAL:', rep.fatal);
    }
    rep.consoleErrors = consoleErrors.slice(0, 8);
    report.modes.push(rep);
    await ctx.close();
  }

  await browser.close();

  report.summary = {
    layoutErrors: report.modes.reduce((a, m) => a + (m.errors || 0), 0),
    consoleErrors: report.modes.reduce((a, m) => a + m.consoleErrors.length, 0),
    fatal: report.modes.filter(m => m.fatal).map(m => m.mode)
  };
  report.verdict = (report.summary.layoutErrors === 0 && report.summary.consoleErrors === 0 && !report.summary.fatal.length)
    ? 'ЧИСТО' : 'ЕСТЬ ЗАМЕЧАНИЯ';

  await fs.writeFile(path.join(OUT, 'market-report.json'), JSON.stringify(report, null, 2), 'utf8');
  console.log('\n===== ИТОГ =====');
  console.log(JSON.stringify({ verdict: report.verdict, summary: report.summary }, null, 2));
  for (const m of report.modes) {
    const bad = m.steps.filter(s => s.errors.length);
    if (bad.length) {
      console.log(`\n${m.label}:`);
      bad.forEach(s => console.log('  •', s.step, '→', s.errors.join('; ')));
    }
    if (m.consoleErrors.length) console.log(`  console(${m.mode}):`, m.consoleErrors.join(' | '));
  }
  process.exit(report.verdict === 'ЧИСТО' ? 0 : 1);
}

main().catch(e => { console.error(e); process.exit(2); });
