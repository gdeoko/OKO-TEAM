/* ============================================================================
   OKO · ПРОБНИК ШТАБА И АДМИНКИ (oko-hq2.js)
   ----------------------------------------------------------------------------
   Обходит:
     • все вкладки админки владельца,
     • карточку каждого агента штаба,
     • карточку каждого отдела,
     • сценарий постановки/закрытия/снятия задачи,
   в трёх вьюпортах (390×844, 360×740, 1440×900) и на каждом экране проверяет:
     – нет горизонтального переполнения страницы;
     – ничего не вылезает за правый край;
     – нет обрезанного текста;
     – есть кнопка «назад»;
     – нет переносов посреди слова (word-break: break-all);
     – нигде не написано NaN / undefined / Infinity / [object Object];
     – экран не пустой;
     – нет ошибок в консоли.

   Запуск:  node oko-app/tools/probe-hq2.mjs [--round N] [--base URL]
   ============================================================================ */
import { chromium } from 'playwright-core';
import fs from 'node:fs/promises';
import path from 'node:path';

const args = Object.fromEntries(
  process.argv.slice(2).join(' ').split('--').filter(Boolean)
    .map(s => { const [k, ...v] = s.trim().split(/\s+/); return [k, v.join(' ') || true]; })
);
const BASE  = args.base || 'http://127.0.0.1:8199/index.html';
const ROUND = String(args.round || '1');
const OUT   = path.resolve('oko-app/tools');
const SHOTS = !!args.shots || true;

const VIEWPORTS = [
  { id: 'phone',   width: 390,  height: 844,  mobile: true  },
  { id: 'narrow',  width: 360,  height: 740,  mobile: true  },
  { id: 'desktop', width: 1440, height: 900,  mobile: false },
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
    localStorage.setItem('oko-owner','1');
  }catch(e){}
`;

/* ---- детектор дефектов, выполняется в странице ---- */
const PROBE = `(() => {
  const out = { overflowX: 0, offRight: [], clipped: [], midWordBreak: [], badNumbers: [],
                back: false, empty: true, textLen: 0, activeLabel: '' };
  const VW = window.innerWidth, VH = window.innerHeight;

  const de = document.documentElement;
  out.overflowX = Math.max(0, de.scrollWidth - de.clientWidth);

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

  /* активный слой: подвид штаба или тело админки */
  const layer = (document.getElementById('h2View') && document.getElementById('h2View').classList.contains('open'))
    ? document.getElementById('h2View')
    : document.getElementById('adminView');
  out.activeLabel = layer ? label(layer) : 'none';

  /* кнопка «назад» в шапке активного слоя */
  if (layer) {
    const b = layer.querySelector('.sv-head .oko-back, .sv-head .ep-cancel, .sv-head button[aria-label]');
    out.back = !!(b && visible(b));
  }

  /* содержимое активного слоя */
  const body = layer ? (layer.querySelector('.sv-body') || layer) : document.body;
  const txt = (body.innerText || '').trim();
  out.textLen = txt.length;
  out.empty = txt.length < 24;

  /* мусорные значения в интерфейсе */
  const RX = /\\bNaN\\b|\\bundefined\\b|\\bInfinity\\b|\\[object Object\\]/;
  if (RX.test(txt)) {
    txt.split('\\n').forEach(line => {
      if (RX.test(line) && out.badNumbers.length < 10) out.badNumbers.push(line.trim().slice(0, 90));
    });
  }

  const all = Array.from((layer || document.body).querySelectorAll('*')).slice(0, 4000);
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

    const t = (el.textContent || '').trim();
    if (t && el.children.length === 0) {
      const intentional = cs.textOverflow === 'ellipsis' || cs.webkitLineClamp !== 'none';
      if (!intentional && el.scrollWidth > el.clientWidth + 2 && cs.overflow !== 'visible')
        out.clipped.push({ el: label(el), text: t.slice(0, 48), sw: el.scrollWidth, cw: el.clientWidth });
      if (!intentional && el.scrollHeight > el.clientHeight + 3 && cs.overflowY === 'hidden')
        out.clipped.push({ el: label(el), text: t.slice(0, 48), sh: el.scrollHeight, ch: el.clientHeight });
      if ((cs.wordBreak === 'break-all' || cs.overflowWrap === 'anywhere') &&
          !el.classList.contains('oko-breakable') &&
          /[А-Яа-яA-Za-z]{5,}/.test(t))
        out.midWordBreak.push({ el: label(el), text: t.slice(0, 40) });
    }
  }

  const dedupe = a => { const s = new Set(); return a.filter(x => { const k = JSON.stringify(x); if (s.has(k)) return false; s.add(k); return true; }); };
  out.offRight = dedupe(out.offRight).slice(0, 10);
  out.clipped = dedupe(out.clipped).slice(0, 10);
  out.midWordBreak = dedupe(out.midWordBreak).slice(0, 10);
  return out;
})()`;

/* ---- шаги обхода ---- */
function steps() {
  const list = [];
  const openAdmin = `okoSkipAuth(); openAdmin();`;
  list.push({ id: 'adm-open', name: 'Админка открыта', step: openAdmin });

  for (const tab of ['overview', 'hq', 'users', 'pay', 'plans', 'content', 'moder', 'flags', 'export']) {
    list.push({ id: 'tab-' + tab, name: 'Вкладка ' + tab, step: `${openAdmin} admGo('${tab}');` });
  }
  /* каждая карточка агента */
  const AG = ['ceo','assist','sales','manager','factory','editor','designer','copy','analyst','support','legal'];
  for (const a of AG) {
    list.push({ id: 'agent-' + a, name: 'Агент ' + a, step: `${openAdmin} admGo('hq'); okoHq2.openAgent('${a}');` });
  }
  /* каждый отдел */
  const RM = ['ops','sales','content','research','comms','legal','finance','security'];
  for (const r of RM) {
    list.push({ id: 'room-' + r, name: 'Отдел ' + r, step: `${openAdmin} admGo('hq'); okoHq2.openRoom('${r}');` });
  }
  /* сценарий с задачей */
  list.push({
    id: 'task-flow', name: 'Постановка задачи',
    step: `${openAdmin} admGo('hq'); okoHq2.openAgent('ceo');
           document.getElementById('h2TaskT').value = 'Сводка по выручке и регистрациям за неделю';
           document.getElementById('h2TaskB').value = 'Формат: короткий текст в чат, только фактические цифры, без прогнозов.';
           document.querySelector('[data-h2act="task-add"]').click();`
  });
  list.push({
    id: 'task-queue', name: 'Очередь с задачей',
    step: `${openAdmin} admGo('hq'); okoHq2.openAgent('ceo');`
  });
  list.push({
    id: 'hq-filled', name: 'Штаб с отчётами',
    step: `${openAdmin} admGo('hq');`
  });
  list.push({
    id: 'task-done', name: 'Задача закрыта вручную',
    step: `${openAdmin} admGo('hq'); okoHq2.openAgent('ceo');
           var b = document.querySelector('[data-h2act="task-done"]'); if(b) b.click();`
  });
  list.push({
    id: 'task-drop', name: 'Снятие задачи (модалка)',
    step: `${openAdmin} admGo('hq'); okoHq2.openAgent('ceo');
           document.getElementById('h2TaskT').value = 'Проверка снятия';
           document.querySelector('[data-h2act="task-add"]').click();
           document.querySelector('[data-h2act="task-drop"]').click();`
  });
  /* возврат из подвида: кнопка «назад» должна вернуть в админку */
  list.push({
    id: 'back-from-agent', name: 'Возврат из карточки агента',
    step: `${openAdmin} admGo('hq'); okoHq2.openAgent('legal');
           document.querySelector('#h2View [data-h2act="view-close"]').click();`
  });
  /* не-владелец не видит раздел */
  list.push({
    id: 'not-owner', name: 'Не владелец: раздела нет',
    step: `okoSkipAuth(); try{ localStorage.removeItem('oko-owner'); }catch(e){} PROFILE.role='user'; renderAdmin();
           showTab('profile'); if(typeof renderMyProfile==='function') renderMyProfile();`
  });
  return list;
}

async function main() {
  const browser = await chromium.launch({
    executablePath: process.env.OKO_CHROME || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    args: ['--no-sandbox'],
  });

  const report = { round: ROUND, at: new Date().toISOString(), viewports: [], totals: {} };
  const ROUTES = steps();

  for (const vp of VIEWPORTS) {
    const vpRep = { viewport: vp.id, size: vp.width + 'x' + vp.height, routes: [] };
    const ctx = await browser.newContext({
      viewport: { width: vp.width, height: vp.height },
      deviceScaleFactor: 1,
      isMobile: vp.mobile,
      hasTouch: vp.mobile,
    });
    await ctx.addInitScript(INIT);
    const page = await ctx.newPage();

    const errors = [];
    const NOISE = /ERR_CONNECTION_RESET|ERR_NAME_NOT_RESOLVED|ERR_BLOCKED|net::ERR_|Failed to load resource|404/i;
    page.on('console', m => {
      if (m.type() !== 'error') return;
      const t = m.text().slice(0, 200);
      if (!NOISE.test(t)) errors.push(t);
    });
    page.on('pageerror', e => errors.push('PAGEERROR: ' + String(e).slice(0, 200)));

    for (const route of ROUTES) {
      const rep = { route: route.id, name: route.name };
      try {
        errors.length = 0;
        await page.goto(BASE, { waitUntil: 'domcontentloaded', timeout: 30000 });
        await page.waitForTimeout(1100);
        try { await page.evaluate(route.step); }
        catch (e) { rep.stepError = String(e).slice(0, 200); }
        await page.waitForTimeout(500);

        const probe = await page.evaluate(PROBE);
        Object.assign(rep, probe);
        rep.consoleErrors = errors.slice(0, 5);

        /* «не владелец» — там админка закрыта, экран пустой ожидаемо */
        if (route.id === 'not-owner') {
          rep.ownerRowHidden = await page.evaluate(`(() => {
            const r = document.getElementById('prowAdmin');
            const h = document.getElementById('hqProwHq');
            const hid = el => !el || el.style.display === 'none' || getComputedStyle(el).display === 'none';
            return hid(r) && hid(h);
          })()`);
          rep.empty = false;
        }
        if (route.id === 'back-from-agent') {
          rep.viewClosed = await page.evaluate(`!document.getElementById('h2View').classList.contains('open')`);
          rep.adminStillOpen = await page.evaluate(`document.getElementById('adminView').classList.contains('open')`);
        }
        if (route.id === 'task-drop') {
          rep.modalShown = await page.evaluate(`!!document.querySelector('.h2-modal')`);
        }

        if (SHOTS && vp.id === 'phone') {
          const file = path.join(OUT, `hq2-${vp.id}-${route.id}.png`);
          try { await page.screenshot({ path: file, timeout: 15000 }); rep.shot = path.basename(file); }
          catch (e) { rep.shotSkipped = String(e).slice(0, 60); }
        }
      } catch (e) {
        rep.fatal = String(e).slice(0, 200);
      }
      vpRep.routes.push(rep);
      const flags = [
        rep.overflowX > 0 ? `overflowX=${rep.overflowX}` : '',
        rep.offRight?.length ? `offRight=${rep.offRight.length}` : '',
        rep.clipped?.length ? `clipped=${rep.clipped.length}` : '',
        rep.midWordBreak?.length ? `midWord=${rep.midWordBreak.length}` : '',
        rep.badNumbers?.length ? `BADNUM=${rep.badNumbers.length}` : '',
        rep.back === false && route.id !== 'not-owner' ? 'NOBACK' : '',
        rep.empty ? 'EMPTY' : '',
        rep.consoleErrors?.length ? `err=${rep.consoleErrors.length}` : '',
        rep.stepError ? 'STEPERR' : '',
        rep.fatal ? 'FATAL' : '',
      ].filter(Boolean).join(' ');
      console.log(`${vp.id.padEnd(8)} ${route.id.padEnd(20)} ${flags || 'ok'}`);
    }
    await ctx.close();
    report.viewports.push(vpRep);
  }
  await browser.close();

  /* сводка */
  const t = { routes: 0, overflowX: 0, offRight: 0, clipped: 0, midWordBreak: 0,
              badNumbers: 0, noBack: 0, empty: 0, consoleErrors: 0, stepErrors: 0, fatal: 0 };
  const problems = [];
  for (const vp of report.viewports) for (const r of vp.routes) {
    t.routes++;
    if (r.overflowX > 0) { t.overflowX++; problems.push(`${vp.viewport}/${r.route}: overflowX=${r.overflowX}`); }
    if (r.offRight?.length) { t.offRight++; problems.push(`${vp.viewport}/${r.route}: offRight ${JSON.stringify(r.offRight[0])}`); }
    if (r.clipped?.length) { t.clipped++; problems.push(`${vp.viewport}/${r.route}: clipped ${JSON.stringify(r.clipped[0])}`); }
    if (r.midWordBreak?.length) { t.midWordBreak++; problems.push(`${vp.viewport}/${r.route}: midWordBreak ${JSON.stringify(r.midWordBreak[0])}`); }
    if (r.badNumbers?.length) { t.badNumbers++; problems.push(`${vp.viewport}/${r.route}: badNumbers ${JSON.stringify(r.badNumbers[0])}`); }
    if (r.back === false && r.route !== 'not-owner') { t.noBack++; problems.push(`${vp.viewport}/${r.route}: нет кнопки назад`); }
    if (r.empty) { t.empty++; problems.push(`${vp.viewport}/${r.route}: пустой экран`); }
    if (r.consoleErrors?.length) { t.consoleErrors++; problems.push(`${vp.viewport}/${r.route}: console ${r.consoleErrors[0]}`); }
    if (r.stepError) { t.stepErrors++; problems.push(`${vp.viewport}/${r.route}: step ${r.stepError}`); }
    if (r.fatal) { t.fatal++; problems.push(`${vp.viewport}/${r.route}: FATAL ${r.fatal}`); }
  }
  report.totals = t;
  report.problems = problems;
  report.clean = problems.length === 0;

  await fs.writeFile(path.join(OUT, `hq2-report-${ROUND}.json`), JSON.stringify(report, null, 2));
  console.log('\n=== ИТОГ ===');
  console.log(JSON.stringify(t, null, 2));
  if (problems.length) { console.log('\nПРОБЛЕМЫ:'); problems.slice(0, 40).forEach(p => console.log(' - ' + p)); }
  else console.log('\nЧисто: замечаний нет.');
}

main().catch(e => { console.error(e); process.exit(1); });
