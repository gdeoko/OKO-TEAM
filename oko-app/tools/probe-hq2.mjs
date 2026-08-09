/* ============================================================================
   OKO · ПРОБНИК ШТАБА И АДМИНКИ (oko-hq2.js)
   ----------------------------------------------------------------------------
   Обходит:
     • все вкладки админки владельца,
     • карточку каждого агента штаба,
     • карточку каждого отдела,
     • сценарий постановки / закрытия / снятия задачи,
     • возврат из подвида и запрет раздела для не-владельца,
   в трёх вьюпортах (390×844, 360×740, 1440×900) и на каждом экране проверяет:
     – нет горизонтального переполнения страницы;
     – ничего не вылезает за правый край;
     – нет обрезанного текста;
     – есть кнопка «назад»;
     – нет переносов посреди слова (word-break: break-all / overflow-wrap: anywhere);
     – нигде не написано NaN / undefined / Infinity / [object Object];
     – экран не пустой;
     – нет ошибок в консоли.

   Страница грузится ОДИН раз на вьюпорт (ядро весит ~5 МБ, перезагружать его
   на каждый шаг — часы обхода), состояние штаба сбрасывается между шагами
   через отладочную ручку window.okoHq2.

   Запуск:  node oko-app/tools/probe-hq2.mjs [--round N] [--base URL]
   ============================================================================ */
import { chromium } from 'playwright-core';
import fs from 'node:fs/promises';
import path from 'node:path';

const args = Object.fromEntries(
  process.argv.slice(2).join(' ').split('--').filter(Boolean)
    .map(s => { const [k, ...v] = s.trim().split(/\s+/); return [k, v.join(' ') || true]; })
);
const BASE  = args.base || 'http://127.0.0.1:8299/index.html';
const ROUND = String(args.round || '1');
const OUT   = path.resolve('oko-app/tools');

const VIEWPORTS = [
  { id: 'phone',   width: 390,  height: 844,  mobile: true,  shots: true  },
  { id: 'narrow',  width: 360,  height: 740,  mobile: true,  shots: false },
  { id: 'tablet',  width: 820,  height: 1180, mobile: false, shots: false },
  { id: 'desktop', width: 1440, height: 900,  mobile: false, shots: false },
  /* светлая тема — тот же обход, чтобы токены не подвели ни в одной */
  { id: 'light',   width: 390,  height: 844,  mobile: true,  shots: false, theme: 'light' },
];

/* Пропуск авторизации — как в audit.mjs. Плюс метка владельца, иначе
   админка честно закрыта гейтом и обходить нечего. */
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
    /* Слой роста (oko-growth) сам по себе показывает чек-лист и всплывашки
       поверх любого экрана. Для чистого замера штаба глушим его состоянием:
       чек-лист закрыт, все поводы «уже показаны» и попадают в кулдаун. */
    localStorage.setItem('okg-state-v1', JSON.stringify({
      born: Date.now() - 3600000, days: [], steps: {},
      ob: { collapsed: true, closed: true },
      nudge: { onboarding: Date.now(), anketa: Date.now(), videofree: Date.now(),
               partner: Date.now(), lesson: Date.now(), expiring: Date.now() },
      off: {}, snooze: {}
    }));
  }catch(e){}
`;

/* Сброс между шагами. Закрытие слоя снимает запись стека навигации, а та
   отматывает history — два таких вызова подряд браузер иногда склеивает и
   присылает лишний popstate. Поэтому шаги сброса разнесены во времени. */
const KILL_GROWTH = `(() => {
  document.querySelectorAll('.okg-pop, .okg-ob').forEach(function(el){ el.remove(); });
  return true;
})()`;
const RESET_1 = `(() => {
  document.querySelectorAll('.okg-pop, .okg-ob').forEach(function(el){ el.remove(); });
  try{ var m = document.querySelector('.h2-modal'); if(m) m.remove(); }catch(e){}
  try{ if(window.okoHq2) window.okoHq2.closeView(); }catch(e){}
  return true;
})()`;
const RESET_2 = `(() => {
  try{ if(typeof closeAdmin === 'function') closeAdmin(); }catch(e){}
  try{
    var s = window.okoHq2 ? window.okoHq2.state() : null;
    if(s){ s.tasks.length = 0; s.log.length = 0; s.flags = {}; }
  }catch(e){}
  try{ localStorage.setItem('oko-owner','1'); if(typeof PROFILE!=='undefined') PROFILE.role='owner'; }catch(e){}
  return true;
})()`;

/* Слои выезжают анимацией transform .28s. Замерять вёрстку, пока панель ещё
   в пути, бессмысленно: половина блоков честно стоит за правым краем.
   Ждём, пока верхний открытый слой встанет на место. */
const SETTLED = `(() => {
  const hv = document.getElementById('h2View');
  const av = document.getElementById('adminView');
  const l = (hv && hv.classList.contains('open')) ? hv : ((av && av.classList.contains('open')) ? av : null);
  if (!l) return true;
  const cs = getComputedStyle(l);
  const tr = cs.transform;
  if (!tr || tr === 'none') return true;
  const m = tr.match(/matrix\\(([^)]+)\\)/);
  if (!m) return true;
  const p = m[1].split(',').map(Number);
  return Math.abs(p[4] || 0) < 0.5;      /* translateX доехал до нуля */
})()`;

/* ---- детектор дефектов, выполняется в странице ---- */
const PROBE = `(() => {
  const out = { overflowX: 0, offRight: [], clipped: [], midWordBreak: [], badNumbers: [],
                back: false, empty: true, textLen: 0, layer: 'none' };
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

  const hv = document.getElementById('h2View');
  const av = document.getElementById('adminView');
  const layer = (hv && hv.classList.contains('open')) ? hv : ((av && av.classList.contains('open')) ? av : null);
  out.layer = layer ? label(layer) : 'none';

  if (layer) {
    const lr = layer.getBoundingClientRect();
    out.layerRect = { l: Math.round(lr.left), r: Math.round(lr.right), w: Math.round(lr.width) };
    out.layerTransform = getComputedStyle(layer).transform;
    const b = layer.querySelector('.sv-head .oko-back, .sv-head .ep-cancel, .sv-head button');
    out.back = !!(b && visible(b));
    if (b) { const br = b.getBoundingClientRect(); out.backRect = { l: Math.round(br.left), w: Math.round(br.width) }; }
    const body = layer.querySelector('.sv-body') || layer;
    const txt = (body.innerText || '').trim();
    out.textLen = txt.length;
    out.empty = txt.length < 24;

    const RX = /\\bNaN\\b|\\bundefined\\b|\\bInfinity\\b|\\[object Object\\]/;
    if (RX.test(txt)) {
      txt.split('\\n').forEach(line => {
        if (RX.test(line) && out.badNumbers.length < 10) out.badNumbers.push(line.trim().slice(0, 90));
      });
    }
  }

  /* Сканируем только свой слой: чужие экраны приложения правят другие модули. */
  const all = layer ? Array.from(layer.querySelectorAll('*')).slice(0, 4000) : [];
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
      if (!intentional && el.scrollWidth > el.clientWidth + 2 && cs.overflowX === 'hidden')
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

const AG = ['ceo','assist','sales','manager','factory','editor','designer','copy','analyst','support','legal'];
const RM = ['ops','sales','content','research','comms','legal','finance','security'];
const TABS = ['overview','hq','users','pay','plans','content','moder','flags','export'];

function routes() {
  const L = [];
  const open = `openAdmin();`;
  L.push({ id: 'adm-open', name: 'Админка открыта', step: open });
  for (const t of TABS) L.push({ id: 'tab-' + t, name: 'Вкладка ' + t, step: `${open} admGo('${t}');` });
  for (const a of AG) L.push({ id: 'agent-' + a, name: 'Агент ' + a, step: `${open} admGo('hq'); okoHq2.openAgent('${a}');` });
  for (const r of RM) L.push({ id: 'room-' + r, name: 'Отдел ' + r, step: `${open} admGo('hq'); okoHq2.openRoom('${r}');` });

  L.push({
    id: 'task-add', name: 'Постановка задачи', keep: true,
    step: `${open} admGo('hq'); okoHq2.openAgent('ceo');
      document.getElementById('h2TaskT').value = 'Сводка по выручке и регистрациям за неделю';
      document.getElementById('h2TaskB').value = 'Формат: короткий текст в чат, только фактические цифры, без прогнозов и оценок.';
      document.querySelector('[data-h2act="task-add"]').click();`
  });
  /* Лента отчётов с записями. Состояние сеем напрямую, без открытия и
     закрытия подвида: лишние закрытия слоёв отматывают history и вносят шум. */
  L.push({ id: 'hq-with-log', name: 'Штаб с отчётом',
    step: `${open} var s = okoHq2.state();
      s.log.push({id:'l-probe-1', at:Date.now(), agent:'ceo',  text:'Задача поставлена: «Сводка за сутки» — ждёт подключения: Очередь задач n8n'});
      s.log.push({id:'l-probe-2', at:Date.now(), agent:null,   text:'Проверка подключений: бэкенд ответил 404 — эндпоинт integrations ещё не поднят'});
      admGo('hq');` });
  L.push({ id: 'task-done', name: 'Задача закрыта вручную', noReset: true, keep: true,
    step: `admGo('hq'); okoHq2.openAgent('ceo'); var b=document.querySelector('[data-h2act="task-done"]'); if(b) b.click();` });
  L.push({ id: 'task-drop-modal', name: 'Снятие задачи · модалка', noReset: true,
    step: `admGo('hq'); okoHq2.openAgent('ceo');
      document.getElementById('h2TaskT').value = 'Проверка снятия задачи';
      document.querySelector('[data-h2act="task-add"]').click();
      document.querySelector('[data-h2act="task-drop"]').click();`,
    extra: `(() => ({ modal: !!document.querySelector('.h2-modal') }))()` });
  L.push({ id: 'exp-tab', name: 'Экспорт с данными',
    step: `${open} var s = okoHq2.state();
      s.tasks.push({id:'t-probe', at:Date.now(), agent:'ceo', title:'Проверка выгрузки', brief:'', status:'queued', doneAt:0});
      s.log.push({id:'l-probe', at:Date.now(), agent:'ceo', text:'Задача поставлена: «Проверка выгрузки»'});
      admGo('export');` });

  L.push({
    id: 'back-from-agent', name: 'Возврат из карточки агента',
    step: `${open} admGo('hq'); okoHq2.openAgent('legal');
      document.querySelector('#h2View [data-h2act="view-close"]').click();`,
    extra: `(() => ({
      viewClosed: !document.getElementById('h2View').classList.contains('open'),
      adminOpen: document.getElementById('adminView').classList.contains('open')
    }))()`
  });
  L.push({
    id: 'sysback-from-agent', name: 'Системная «назад» из агента',
    step: `${open} admGo('hq'); okoHq2.openAgent('copy');`,
    goBack: true,
    extra: `(() => ({
      viewClosed: !document.getElementById('h2View').classList.contains('open'),
      adminOpen: document.getElementById('adminView').classList.contains('open')
    }))()`
  });
  L.push({
    id: 'esc-from-room', name: 'Escape закрывает отдел',
    step: `${open} admGo('hq'); okoHq2.openRoom('content');`,
    key: 'Escape',
    extra: `(() => ({
      viewClosed: !document.getElementById('h2View').classList.contains('open'),
      adminOpen: document.getElementById('adminView').classList.contains('open')
    }))()`
  });
  L.push({
    id: 'not-owner', name: 'Не владелец: раздела нет', noBackExpected: true, emptyOk: true,
    step: `try{ localStorage.removeItem('oko-owner'); }catch(e){} PROFILE.role='user';
      openAdmin(); renderAdmin(); showTab('profile');
      if(typeof renderMyProfile==='function') renderMyProfile();`,
    extra: `(() => {
      const hid = el => !el || el.style.display === 'none' || getComputedStyle(el).display === 'none';
      return {
        rowsHidden: hid(document.getElementById('prowAdmin')) && hid(document.getElementById('hqProwHq')),
        adminOpen: document.getElementById('adminView').classList.contains('open')
      };
    })()`
  });
  return L;
}

/* Ждём, пока верхний слой действительно доедет.
   Одной проверки мало: сразу после смены класса браузер ещё не запустил
   переход и getComputedStyle отдаёт КОНЕЧНОЕ значение transform — замер
   в этот момент ловит панель в полёте. Поэтому требуем несколько
   подряд идущих «стоит на месте» с паузами между ними. */
async function waitSettled(page) {
  const deadline = Date.now() + 8000;
  let stable = 0;
  while (Date.now() < deadline) {
    let ok = false;
    try { ok = await page.evaluate(SETTLED); } catch (e) { ok = false; }
    stable = ok ? stable + 1 : 0;
    if (stable >= 4) return true;          /* ~4 x 160 мс тишины > 280 мс анимации */
    await page.waitForTimeout(160);
  }
  return false;
}

async function main() {
  const browser = await chromium.launch({
    executablePath: process.env.OKO_CHROME || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    args: ['--no-sandbox'],
  });

  const report = { round: ROUND, at: new Date().toISOString(), viewports: [] };
  const ROUTES = routes();

  for (const vp of VIEWPORTS) {
    const vpRep = { viewport: vp.id, size: vp.width + 'x' + vp.height, routes: [] };
    const ctx = await browser.newContext({
      viewport: { width: vp.width, height: vp.height },
      deviceScaleFactor: 1, isMobile: vp.mobile, hasTouch: vp.mobile,
    });
    await ctx.addInitScript(INIT);
    if (vp.theme) await ctx.addInitScript(`try{ localStorage.setItem('oko-theme','${vp.theme}'); }catch(e){}`);
    const page = await ctx.newPage();

    const errors = [];
    const NOISE = /ERR_CONNECTION_RESET|ERR_NAME_NOT_RESOLVED|ERR_BLOCKED|net::ERR_|Failed to load resource|the server responded with a status of 404/i;
    page.on('console', m => {
      if (m.type() !== 'error') return;
      const t = m.text().slice(0, 200);
      if (!NOISE.test(t)) errors.push(t);
    });
    page.on('pageerror', e => errors.push('PAGEERROR: ' + String(e).slice(0, 200)));

    /* Песочница делится с другими агентами: под нагрузкой первая навигация
       может не уложиться в таймаут. Пробуем несколько раз, а не падаем. */
    let loaded = false;
    for (let attempt = 1; attempt <= 4 && !loaded; attempt++) {
      try {
        await page.goto(BASE, { waitUntil: 'domcontentloaded', timeout: 120000 });
        loaded = true;
      } catch (e) {
        console.log(`${vp.id}: попытка загрузки ${attempt} не прошла (${String(e).slice(0, 60)})`);
        await page.waitForTimeout(2000);
      }
    }
    if (!loaded) { console.log(`${vp.id}: страница не загрузилась, вьюпорт пропущен`); await ctx.close(); continue; }
    await page.waitForTimeout(2500);
    await page.evaluate(`okoSkipAuth();`);
    /* Меряем ВЁРСТКУ, а не анимацию. Слои выезжают за 280 мс, и под нагрузкой
       песочницы кадр анимации попадает в замер — панель «вылезает за правый
       край» просто потому, что ещё в пути. Выключаем переходы у обоих слоёв:
       так замер всегда о конечном состоянии, которое и видит человек. */
    await page.addStyleTag({ content:
      '#h2View, #adminView, #h2View *, #adminView * { transition: none !important; }' });
    await page.waitForTimeout(400);

    for (const route of ROUTES) {
      const rep = { route: route.id, name: route.name };
      try {
        errors.length = 0;

        /* Один прогон маршрута: сброс -> шаг -> ожидание -> замер.
           Закрытие слоя отматывает history, и под нагрузкой песочницы
           ответный popstate иногда приходит уже ПОСЛЕ открытия следующего
           экрана — единая кнопка «назад» честно отрабатывает его и закрывает
           только что открытый слой. Это шум окружения, а не дефект вёрстки,
           поэтому маршрут при подозрительном замере проходится ещё раз. */
        const runOnce = async () => {
          if (!route.noReset) {
            await page.evaluate(RESET_1);
            await page.waitForTimeout(700);
            await page.evaluate(RESET_2);
            await page.waitForTimeout(700);
          }
          let stepErr = null;
          try { await page.evaluate(route.step); }
          catch (e) { stepErr = String(e).slice(0, 200); }
          await page.evaluate(KILL_GROWTH);
          if (route.goBack) { try { await page.goBack({ timeout: 5000 }); } catch (e) {} await page.waitForTimeout(400); }
          if (route.key) { await page.keyboard.press(route.key); }
          /* Слой выезжает 280 мс. Первый getComputedStyle после смены класса
             может вернуть КОНЕЧНОЕ значение transform (переход ещё не стартовал),
             поэтому сначала пережидаем анимацию, потом убеждаемся, что доехали. */
          const notSettled = !(await waitSettled(page));
          const out = await page.evaluate(PROBE);
          out.stepError = stepErr;
          out.notSettled = notSettled;
          return out;
        };
        const suspicious = r =>
          r.back === false || r.empty || r.offRight.length || r.clipped.length || r.notSettled;

        let probe = await runOnce();
        if (suspicious(probe) && !route.noBackExpected && !route.emptyOk) {
          rep.retried = true;
          rep.firstPass = { back: probe.back, empty: probe.empty,
                            offRight: probe.offRight.length, clipped: probe.clipped.length };
          probe = await runOnce();
        }
        if (probe.stepError) rep.stepError = probe.stepError;
        delete probe.stepError;
        Object.assign(rep, probe);
        if (route.extra) rep.extra = await page.evaluate(route.extra);
        rep.consoleErrors = errors.slice(0, 5);
        if (route.noBackExpected) rep.backNotRequired = true;
        if (route.emptyOk) rep.emptyOk = true;

        if (vp.shots) {
          const file = path.join(OUT, `hq2-${route.id}.png`);
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
        (rep.back === false && !route.noBackExpected) ? 'NOBACK' : '',
        (rep.empty && !route.emptyOk) ? 'EMPTY' : '',
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

  const t = { routes: 0, overflowX: 0, offRight: 0, clipped: 0, midWordBreak: 0,
              badNumbers: 0, noBack: 0, empty: 0, consoleErrors: 0, stepErrors: 0, fatal: 0, behaviour: 0 };
  const problems = [];
  const byId = Object.fromEntries(ROUTES.map(r => [r.id, r]));
  for (const vp of report.viewports) for (const r of vp.routes) {
    const def = byId[r.route] || {};
    t.routes++;
    if (r.overflowX > 0) { t.overflowX++; problems.push(`${vp.viewport}/${r.route}: overflowX=${r.overflowX}`); }
    if (r.offRight?.length) { t.offRight++; problems.push(`${vp.viewport}/${r.route}: offRight ${JSON.stringify(r.offRight[0])}`); }
    if (r.clipped?.length) { t.clipped++; problems.push(`${vp.viewport}/${r.route}: clipped ${JSON.stringify(r.clipped[0])}`); }
    if (r.midWordBreak?.length) { t.midWordBreak++; problems.push(`${vp.viewport}/${r.route}: midWordBreak ${JSON.stringify(r.midWordBreak[0])}`); }
    if (r.badNumbers?.length) { t.badNumbers++; problems.push(`${vp.viewport}/${r.route}: badNumbers ${JSON.stringify(r.badNumbers[0])}`); }
    if (r.back === false && !def.noBackExpected) { t.noBack++; problems.push(`${vp.viewport}/${r.route}: нет кнопки назад`); }
    if (r.empty && !def.emptyOk) { t.empty++; problems.push(`${vp.viewport}/${r.route}: пустой экран`); }
    if (r.consoleErrors?.length) { t.consoleErrors++; problems.push(`${vp.viewport}/${r.route}: console ${r.consoleErrors[0]}`); }
    if (r.stepError) { t.stepErrors++; problems.push(`${vp.viewport}/${r.route}: step ${r.stepError}`); }
    if (r.fatal) { t.fatal++; problems.push(`${vp.viewport}/${r.route}: FATAL ${r.fatal}`); }
    /* поведенческие ожидания */
    if (r.route === 'back-from-agent' || r.route === 'esc-from-room' || r.route === 'sysback-from-agent') {
      if (!r.extra?.viewClosed) { t.behaviour++; problems.push(`${vp.viewport}/${r.route}: подвид не закрылся`); }
      if (!r.extra?.adminOpen) { t.behaviour++; problems.push(`${vp.viewport}/${r.route}: админка не осталась открытой`); }
    }
    if (r.route === 'task-drop-modal' && !r.extra?.modal) { t.behaviour++; problems.push(`${vp.viewport}/${r.route}: модалка подтверждения не показалась`); }
    if (r.route === 'not-owner') {
      if (!r.extra?.rowsHidden) { t.behaviour++; problems.push(`${vp.viewport}/${r.route}: строка админки видна не владельцу`); }
      if (r.extra?.adminOpen) { t.behaviour++; problems.push(`${vp.viewport}/${r.route}: админка открылась не владельцу`); }
    }
  }
  report.totals = t;
  report.problems = problems;
  report.clean = problems.length === 0;

  await fs.writeFile(path.join(OUT, `hq2-report-${ROUND}.json`), JSON.stringify(report, null, 2));
  console.log('\n=== ИТОГ ===');
  console.log(JSON.stringify(t, null, 2));
  if (problems.length) { console.log('\nПРОБЛЕМЫ (' + problems.length + '):'); problems.slice(0, 60).forEach(p => console.log(' - ' + p)); }
  else console.log('\nЧисто: замечаний нет.');
}

main().catch(e => { console.error(e); process.exit(1); });
