/* ============================================================================
   OKO · ПРОБНИК КОШЕЛЬКА И ОПЛАТЫ (oko-wallet2.js)
   ----------------------------------------------------------------------------
   Обходит каждый экран и подстраницу кошелька в трёх вьюпортах и обеих темах
   и проверяет автоматически:
     • горизонтальное переполнение страницы;
     • блоки, вылезающие за правый край;
     • обрезанный текст без многоточия (режется «в никуда»);
     • перенос посреди слова (word-break:break-all вне .oko-breakable);
     • наличие кнопки «назад» на подстранице;
     • контент, заехавший под нижнее меню и под шапку Telegram;
     • пустой экран без объяснения;
     • выдуманные суммы и ложные подтверждения в тексте экрана.

   Запуск:
     python3 -m http.server 8199 --bind 127.0.0.1   (из oko-app/prototype)
     node oko-app/tools/probe-wallet2.mjs [--round N]
   ============================================================================ */
import { chromium } from 'playwright-core';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs/promises';
import fsSync from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const args = Object.fromEntries(
  process.argv.slice(2).join(' ').split('--').filter(Boolean)
    .map(s => { const [k, ...v] = s.trim().split(/\s+/); return [k, v.join(' ') || true]; })
);

const BASE  = args.base || 'http://127.0.0.1:8199/index.html';
const ROUND = String(args.round || '1');
const OUT   = path.resolve('oko-app/tools');
const CHROME = process.env.OKO_CHROME || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';

const TG_BOTTOM = 34;

const VIEWS = [
  { id: 'phone',   label: 'Телефон 390×844',  width: 390,  height: 844,  mobile: true },
  { id: 'narrow',  label: 'Узкий Android 360×740', width: 360, height: 740, mobile: true },
  { id: 'desktop', label: 'ПК 1440×900',      width: 1440, height: 900,  mobile: false }
];
const THEMES = ['dark', 'light'];

/* Страницы кошелька. step выполняется в браузере, уже после okoSkipAuth(). */
const PAGES = [
  { id: '01-wallet',    name: 'Кошелёк · главный экран', root: true,
    step: `showTab('wallet');` },
  { id: '02-accounts',  name: 'Мои счета',        step: `showTab('wallet'); w2Open('accounts');` },
  { id: '03-transfers', name: 'Переводы',         step: `showTab('wallet'); w2Open('transfers');` },
  { id: '04-templates', name: 'Шаблоны переводов',step: `showTab('wallet'); w2Open('templates');` },
  { id: '05-send',      name: 'Перевод по нику',  sheet: true,
    step: `showTab('wallet'); walOpenSend('');` },
  { id: '06-exchange',  name: 'Обмен валют',      step: `showTab('wallet'); w2Open('exchange');` },
  { id: '07-receive',   name: 'Приём платежа (QR)', step: `showTab('wallet'); w2Open('receive');` },
  { id: '08-topup',     name: 'Пополнение счёта', step: `showTab('wallet'); walOpenTopup();` },
  { id: '09-withdraw',  name: 'Вывод средств',    step: `showTab('wallet'); walOpenWithdraw();` },
  { id: '10-history',   name: 'История операций', step: `showTab('wallet'); w2Open('history');` },
  { id: '11-statement', name: 'Выписка за период',step: `showTab('wallet'); w2Open('statement');` },
  { id: '12-tx',        name: 'Карточка операции',
    step: `showTab('wallet');
           WALLET.ledger.unshift({t:'-',sum:1490,why:'Тариф START · 1 мес',at:Date.now()-3600e3});
           WALLET.ledger.unshift({t:'+',sum:5000,why:'Пополнение · Lava.top',at:Date.now()-7200e3});
           okoW2.tx(WALLET.ledger[0].at);` },
  { id: '13-receipt',   name: 'Чек по операции',
    step: `showTab('wallet');
           WALLET.ledger.unshift({t:'+',sum:5000,why:'Пополнение · Lava.top',at:Date.now()-7200e3});
           okoW2.tx(WALLET.ledger[0].at); okoW2.receipt();` },
  { id: '14-tariffs',   name: 'Тарифы и подписка',step: `showTab('wallet'); w2Open('tariffs');` },
  { id: '15-paypick',   name: 'Что оплатить',     step: `showTab('wallet'); w2OpenPay();` },
  { id: '16-limits',    name: 'Лимиты и комиссии',step: `showTab('wallet'); w2Open('limits');` },
  { id: '17-autopay',   name: 'Автоплатежи и подписки', step: `showTab('wallet'); w2Open('autopay');` },
  { id: '18-autorule',  name: 'Правило автопополнения', sheet: true,
    step: `showTab('wallet'); walOpenAutoRule();` },
  { id: '19-goals',     name: 'Финансовые цели',  step: `showTab('wallet'); w2Open('goals');` },
  { id: '20-goal-new',  name: 'Новая цель',       sheet: true,
    step: `showTab('wallet'); walOpenGoal();` },
  { id: '21-analytics', name: 'Аналитика',        step: `showTab('wallet'); w2Open('analytics');` },
  { id: '22-analytics-data', name: 'Аналитика с операциями',
    step: `showTab('wallet');
           WALLET.ledger.unshift({t:'-',sum:1490,why:'Тариф START · 1 мес',at:Date.now()-3*864e5});
           WALLET.ledger.unshift({t:'+',sum:5000,why:'Пополнение · Lava.top',at:Date.now()-5*864e5});
           w2Open('analytics');` },
  { id: '23-security',  name: 'Безопасность',     step: `showTab('wallet'); w2Open('security');` },
  { id: '24-pin',       name: 'ПИН-код',          sheet: true,
    step: `showTab('wallet'); walPinOpen('set','walPinView');` },
  { id: '25-help',      name: 'Помощь и лимиты',  step: `showTab('wallet'); w2Open('help');` }
];

/* Проверка QR на экране «Приём платежа»: код должен реально читаться, а не
   просто выглядеть как QR. Рисуем матрицу в PNG и просим OpenCV его прочитать. */
function qrReadable(svg, expect) {
  const total = Number((svg.match(/viewBox="0 0 (\d+) /) || [])[1] || 0);
  if (!total) return 'нет QR на экране';
  const grid = Array.from({ length: total }, () => new Array(total).fill(0));
  const d = (svg.match(/ d="([^"]*)"/) || [])[1] || '';
  const re = /M(\d+) (\d+)h(\d+)v1h-\d+z/g;
  let g;
  while ((g = re.exec(d))) {
    const x = +g[1], y = +g[2], len = +g[3];
    for (let i = 0; i < len; i++) grid[y][x + i] = 1;
  }
  const tmp = path.join(os.tmpdir(), 'oko-qr-probe.txt');
  fsSync.writeFileSync(tmp, grid.map(r => r.join('')).join('\n'));
  const py = `
import numpy as np, cv2, sys
rows = open(sys.argv[1]).read().split('\\n')
m = np.array([[0 if c=='1' else 255 for c in r] for r in rows], dtype=np.uint8)
img = np.kron(m, np.ones((10,10), dtype=np.uint8))
data, pts, _ = cv2.QRCodeDetector().detectAndDecode(img)
print(data if data else '')
`;
  let got = '';
  try { got = execFileSync('python3', ['-c', py, tmp], { encoding: 'utf8' }).trim(); }
  catch (e) { return null; }              /* нет OpenCV — проверку пропускаем */
  if (!got) return 'QR не читается сканером';
  if (expect && got !== expect) return 'QR ведёт не туда: ' + got.slice(0, 60);
  return '';
}

function initScript(theme) {
  return `
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
      localStorage.setItem('oko-theme','${theme}');
    }catch(e){}
    document.addEventListener('DOMContentLoaded', function(){
      try{ document.documentElement.dataset.theme = '${theme}'; }catch(e){}
    });
  `;
}

/* Замер выполняется в странице. */
const PROBE = `(() => {
  const out = { overflowX:0, offRight:[], clipped:[], midWord:[], underBottom:[], underTop:[],
                back:false, empty:false, textLen:0, fake:[], sample:'' };
  const VW = window.innerWidth, VH = window.innerHeight;
  const de = document.documentElement;
  out.overflowX = Math.max(0, de.scrollWidth - de.clientWidth);

  const label = el => {
    const id = el.id ? '#' + el.id : '';
    const cls = (el.className && typeof el.className === 'string')
      ? '.' + el.className.trim().split(/\\s+/).slice(0,3).join('.') : '';
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

  /* Активный слой: открытая подстраница кошелька > открытая шторка > экран */
  const page  = document.querySelector('.w2-page.open');
  const sheet = document.querySelector('.sheet.open');
  const scr   = document.querySelector('main > .screen.active');
  const scope = page || sheet || scr;
  out.scope = scope ? (scope.id || label(scope)) : 'none';

  /* кнопка «назад» / выход из слоя */
  const exitBtn = root => {
    if (!root) return false;
    if (root.querySelector('.w2-bar-nav, .oko-back, [data-w2back], .w2-sh-x')) return true;
    return Array.from(root.querySelectorAll('button')).some(b =>
      /отмена|закрыть|назад|готово|позже|понятно/i.test((b.textContent || '').trim()));
  };
  if (page) out.back = exitBtn(page);
  else if (sheet) out.back = exitBtn(sheet);
  else out.back = true;   /* корневой экран кошелька — выход через нижнее меню */

  /* нижнее меню */
  const tabs = document.getElementById('tabs');
  const tabsTop = (tabs && getComputedStyle(tabs).display !== 'none')
    ? tabs.getBoundingClientRect().top : VH;

  const nodes = scope ? Array.from(scope.querySelectorAll('*')).slice(0, 3000) : [];
  for (const el of nodes) {
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
        out.clipped.push({ el: label(el), text: txt.slice(0,48), sw: el.scrollWidth, cw: el.clientWidth });
      if (!intentional && el.scrollHeight > el.clientHeight + 3 && cs.overflowY === 'hidden')
        out.clipped.push({ el: label(el), text: txt.slice(0,48), sh: el.scrollHeight, ch: el.clientHeight });
      if (cs.wordBreak === 'break-all' && !el.classList.contains('oko-breakable') &&
          /[А-Яа-яA-Za-z]{4,}/.test(txt))
        out.midWord.push({ el: label(el), text: txt.slice(0,40) });
    }

    /* Под нижнее меню может заехать только «плавающий» элемент: обычный контент
       живёт в прокручиваемом <main> НАД меню и физически под него не попадает.
       Поэтому проверяем закреплённые элементы, кроме полноэкранных подложек.
       Подстраницы и шторки лежат поверх меню — для них это штатно. */
    if (!page && !sheet && cs.position === 'fixed' &&
        !(r.top <= 1 && r.bottom >= VH - 1) &&
        r.top < tabsTop - 2 && r.bottom > tabsTop + 2)
      out.underBottom.push({ el: label(el), bottom: Math.round(r.bottom), tabsTop: Math.round(tabsTop) });

    /* уехал под шапку (выше нуля вьюпорта) */
    if (r.bottom > 2 && r.top < -2 && cs.position === 'fixed')
      out.underTop.push({ el: label(el), top: Math.round(r.top) });
  }

  const text = scope ? (scope.innerText || '').trim() : '';
  out.textLen = text.length;
  out.empty = text.length < 40;
  out.sample = text.slice(0, 120).replace(/\\s+/g, ' ');

  /* поиск ложных подтверждений и выдуманных денег */
  const BAD = [
    [/Тариф\\s+\\w+\\s+активирован/i, 'ложное «тариф активирован»'],
    [/Счёт пополнен через/i,          'ложное «счёт пополнен»'],
    [/2\\s?200\\s?7007/,               'выдуманный номер карты'],
    [/UQAoKoAppTonWa11et/i,           'выдуманный TON-адрес'],
    [/TQoKo4fHFYyeJtsDdD7TgKLxAV1mFJnEok/i, 'выдуманный USDT-адрес'],
    [/TON-кошелёк подключён/i,        'ложное «кошелёк подключён»'],
    [/2\\s?500\\s?₽/,                  'выдуманный приветственный бонус'],
    [/\\(демо\\)/i,                    'демо-метка в интерфейсе'],
    [/Марк Волков|Аня Соколова|Тимур Н\\./i, 'выдуманные люди']
  ];
  for (const [re, why] of BAD) if (re.test(text)) out.fake.push(why);

  /* эмодзи в интерфейсе кошелька */
  const EMO = /[\\u{1F300}-\\u{1FAFF}\\u{2600}-\\u{27BF}]/u;
  if (EMO.test(text)) out.fake.push('эмодзи в интерфейсе');

  const dedupe = a => { const s = new Set(); return a.filter(x => { const k = JSON.stringify(x); if (s.has(k)) return false; s.add(k); return true; }); };
  out.offRight    = dedupe(out.offRight).slice(0, 8);
  out.clipped     = dedupe(out.clipped).slice(0, 8);
  out.midWord     = dedupe(out.midWord).slice(0, 8);
  out.underBottom = dedupe(out.underBottom).slice(0, 8);
  out.underTop    = dedupe(out.underTop).slice(0, 8);
  out.fake        = Array.from(new Set(out.fake));
  return out;
})()`;

async function main() {
  const browser = await chromium.launch({
    executablePath: CHROME,
    args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-gl=swiftshader', '--enable-unsafe-swiftshader']
  });

  const report = {
    probe: 'wallet2', round: ROUND, at: new Date().toISOString(),
    viewports: VIEWS.map(v => v.label), themes: THEMES,
    pages: PAGES.map(p => p.name),
    totals: { checks: 0, red: 0 },
    red: [], runs: []
  };

  const onlyView  = (args.view  && args.view  !== true) ? String(args.view)  : null;
  const onlyTheme = (args.theme && args.theme !== true) ? String(args.theme) : null;

  for (const view of VIEWS) {
    if (onlyView && view.id !== onlyView) continue;
    for (const theme of THEMES) {
      if (onlyTheme && theme !== onlyTheme) continue;
      const ctx = await browser.newContext({
        viewport: { width: view.width, height: view.height },
        deviceScaleFactor: 1,
        isMobile: view.mobile,
        hasTouch: view.mobile,
        colorScheme: theme,
        /* Service worker в песочнице перехватывал навигацию и ронял прогон
           («interrupted by another navigation»). Проверяем саму страницу. */
        serviceWorkers: 'block',
        userAgent: view.mobile
          ? 'Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126 Mobile Safari/537.36'
          : undefined
      });
      await ctx.addInitScript(initScript(theme));
      /* Внешняя сеть в песочнице закрыта: рубим сразу, чтобы прогон не ждал таймаутов */
      await ctx.route('**', route => {
        const u = route.request().url();
        if (u.startsWith('http://127.0.0.1:8199') || u.startsWith('data:') || u.startsWith('blob:')) return route.continue();
        return route.abort();
      });
      const page = await ctx.newPage();
      const errs = [];
      /* Отсутствие внешней сети — шум окружения, а не дефект кошелька */
      const NOISE = /ERR_CONNECTION_RESET|ERR_NAME_NOT_RESOLVED|ERR_BLOCKED|ERR_FAILED|net::ERR_|Failed to load resource|Failed to fetch|AbortError|NetworkError/i;
      page.on('console', m => { if (m.type() === 'error') { const t = m.text().slice(0, 180); if (!NOISE.test(t)) errs.push(t); } });
      page.on('pageerror', e => errs.push('PAGEERROR: ' + String(e).slice(0, 180)));

      /* Одна загрузка на связку «вьюпорт + тема»: приложение — SPA, между
         страницами кошелька ходим внутри неё и каждый раз возвращаем чистое
         состояние (ноль на счёте, пустая история, закрытые слои). */
      let navOk = false, navErr = null;
      for (let attempt = 0; attempt < 3 && !navOk; attempt++) {
        try { await page.goto(BASE, { waitUntil: 'domcontentloaded', timeout: 60000 }); navOk = true; }
        catch (e) { navErr = e; await page.waitForTimeout(1500); }
      }
      if (!navOk) { console.log('НЕ ЗАГРУЗИЛОСЬ', view.id, theme, String(navErr).slice(0, 120)); await ctx.close(); continue; }
      await page.waitForTimeout(1400);
      await page.evaluate(`okoSkipAuth(); document.documentElement.dataset.theme='${theme}';`);

      const RESET = `(() => {
        document.querySelectorAll('.w2-page.open').forEach(p => p.classList.remove('open'));
        try{ if (typeof closeSheet === 'function') closeSheet(); }catch(e){}
        /* попапы ядра и промо-окна других модулей закрываем, иначе они
           перекрывают экран кошелька и замер уходит не туда */
        try{ if (typeof closePopup === 'function') closePopup(); }catch(e){}
        document.querySelectorAll('#okoPopup, .okg-scrim, .okg-ob, .gr-pop, .pop, .popup, .oko-pop').forEach(p => p.remove());
        try{ var lk = document.getElementById('w2Lock'); if (lk) lk.classList.remove('open'); }catch(e){}
        try{ WALLET.ledger.length = 0; WALLET.balance = 0; WALLET.hold = 0; }catch(e){}
        try{ if (typeof nvStackLabels === 'function') { while (nvStackLabels().length && typeof nvPop === 'function') nvPop(nvStackLabels()[nvStackLabels().length-1]); } }catch(e){}
        try{ if (typeof showTab === 'function') showTab('feed'); }catch(e){}
      })()`;

      for (const p of PAGES) {
        const run = { view: view.id, theme, page: p.id, name: p.name, errors: [] };
        try {
          errs.length = 0;
          try { await page.evaluate(RESET); } catch (e) {}
          await page.waitForTimeout(420);
          try { await page.evaluate(p.step); } catch (e) { run.stepError = String(e).slice(0, 200); }
          await page.waitForTimeout(620);
          /* промо-попапы других модулей всплывают по таймеру — убираем перед замером */
          try { await page.evaluate(`document.querySelectorAll('#okoPopup, .okg-scrim, .okg-ob, .gr-pop').forEach(p => p.remove())`); } catch (e) {}

          const res = await page.evaluate(PROBE);
          Object.assign(run, res);
          run.errors = errs.slice(0, 5);

          /* экран приёма платежа: QR обязан читаться реальным сканером */
          if (p.id === '07-receive') {
            const q = await page.evaluate(`(() => {
              const box = document.querySelector('#w2RecvHost .w2-qr-box');
              const link = document.querySelector('#w2RecvHost .w2-qr-link span');
              return { svg: box ? box.innerHTML : '', link: link ? link.textContent.trim() : '' };
            })()`);
            const verdict = qrReadable(q.svg, q.link);
            if (verdict) run.qrProblem = verdict;
            else if (verdict === '') run.qrOk = true;
          }

          /* только один комплект скринов — телефон, обе темы */
          if (view.id === 'phone') {
            const file = path.join(OUT, `wallet2-${theme}-${p.id}.png`);
            try { await page.screenshot({ path: file, timeout: 15000 }); run.shot = path.basename(file); }
            catch (e) { run.shotSkipped = true; }
          }
        } catch (e) {
          run.fatal = String(e).slice(0, 200);
        }

        const problems = [];
        if (run.fatal)                     problems.push('fatal: ' + run.fatal);
        if (run.stepError)                 problems.push('step: ' + run.stepError);
        if (run.overflowX > 0)             problems.push('overflowX=' + run.overflowX);
        if (run.offRight?.length)          problems.push('offRight=' + run.offRight.length);
        if (run.clipped?.length)           problems.push('clipped=' + run.clipped.length);
        if (run.midWord?.length)           problems.push('midWord=' + run.midWord.length);
        if (run.underBottom?.length)       problems.push('underBottom=' + run.underBottom.length);
        if (run.underTop?.length)          problems.push('underTop=' + run.underTop.length);
        if (run.back === false)            problems.push('нет кнопки «назад»');
        if (run.empty)                     problems.push('пустой экран (' + run.textLen + ' симв.)');
        if (run.fake?.length)              problems.push('нечестность: ' + run.fake.join(', '));
        if (run.qrProblem)                 problems.push(run.qrProblem);
        if (run.errors?.length)            problems.push('js: ' + run.errors[0]);
        run.problems = problems;

        report.totals.checks++;
        if (problems.length) {
          report.totals.red++;
          report.red.push({ view: view.id, theme, page: p.name, problems });
        }
        report.runs.push(run);
        process.stdout.write(`${view.id}/${theme} ${p.id} ${p.name} — ${problems.length ? 'КРАСНОЕ: ' + problems.join('; ') : 'ок'}\n`);
      }
      await ctx.close();
    }
  }

  await browser.close();
  const out = path.join(OUT, 'wallet2-report.json');
  /* --merge: дописываем прогон в существующий отчёт (например, когда одна
     связка «вьюпорт+тема» не отработала из-за упавшего локального сервера) */
  if (args.merge) {
    try {
      const prev = JSON.parse(await fs.readFile(out, 'utf8'));
      const key = r => r.view + '|' + r.theme + '|' + r.page;
      const fresh = new Set(report.runs.map(key));
      const merged = prev.runs.filter(r => !fresh.has(key(r))).concat(report.runs);
      report.runs = merged;
      report.red = merged.filter(r => (r.problems || []).length)
        .map(r => ({ view: r.view, theme: r.theme, page: r.name, problems: r.problems }));
      report.totals = { checks: merged.length, red: report.red.length };
      report.round = prev.round + '+' + ROUND;
    } catch (e) { /* нечего сливать — пишем как есть */ }
  }
  await fs.writeFile(out, JSON.stringify(report, null, 2), 'utf8');
  console.log('\n=== ИТОГ ===');
  console.log('проверок:', report.totals.checks, '| красных:', report.totals.red);
  console.log('отчёт:', out);
  if (report.totals.red) {
    const byPage = {};
    report.red.forEach(r => { (byPage[r.page] = byPage[r.page] || []).push(r.view + '/' + r.theme + ': ' + r.problems.join('; ')); });
    Object.entries(byPage).forEach(([k, v]) => console.log('\n· ' + k + '\n   ' + v.slice(0, 6).join('\n   ')));
  }
}

main().catch(e => { console.error(e); process.exit(1); });
