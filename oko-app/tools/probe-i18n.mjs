/* ============================================================================
   OKO · ПРОБНИК ЛОКАЛИЗАЦИИ (probe-i18n)

   Что делает:
     1. Обходит главные экраны приложения на RU и на EN.
     2. На EN считает, сколько ВИДИМЫХ строк интерфейса остались кириллицей
        (это и есть «непереведённое»), и выписывает их — с адресом узла.
     3. Проверяет вёрстку английской версии на 360 / 390 / 1440:
        горизонтальное переполнение, обрезанный текст, перенос посреди слова,
        заезд под шапку Telegram и под нижнее меню, NaN/undefined/Infinity,
        ошибки JS, наличие выхода с экрана.

   Замеры делаются ПОСЛЕ окончания анимаций (document.getAnimations()),
   ширина слова сравнивается с Math.max(clientWidth, rect.width) — у строчных
   элементов clientWidth всегда 0 и без этого детектор врёт сотнями.

   Запуск:
     node oko-app/tools/probe-i18n.mjs                  — полный прогон
     node oko-app/tools/probe-i18n.mjs --harvest        — только сбор строк
     node oko-app/tools/probe-i18n.mjs --json out.json  — куда писать отчёт
   ============================================================================ */
import { chromium } from 'playwright-core';
import fs from 'node:fs/promises';
import path from 'node:path';

const args = Object.fromEntries(
  process.argv.slice(2).join(' ').split('--').filter(Boolean)
    .map(s => { const [k, ...v] = s.trim().split(/\s+/); return [k, v.join(' ') || true]; })
);

const BASE = args.base || 'http://127.0.0.1:8199/index.html';
const OUTJSON = path.resolve(args.json || 'oko-app/tools/probe-i18n.json');
const HARVEST_ONLY = !!args.harvest;
const EXEC = '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';

const TG_HEADER = 56;
const TG_BOTTOM = 34;

const VIEWPORTS = [
  { id: 'narrow',  width: 360, height: 740,  mobile: true  },
  { id: 'phone',   width: 390, height: 844,  mobile: true  },
  { id: 'desktop', width: 1440, height: 900, mobile: false },
];

/* Маршруты: как попасть на экран. Покрывают ядро и все слои oko-*.js. */
const ROUTES = [
  { id: 'feed',        name: 'Лента',              step: `showTab('feed');` },
  { id: 'feed-sub',    name: 'Лента · Подписки',   step: `showTab('feed'); const b=document.querySelector('.feed-tabs button[data-fk="sub"]'); b&&b.click();` },
  { id: 'chats',       name: 'Чаты',               step: `showTab('chats');` },
  { id: 'conv',        name: 'Диалог',             step: `showTab('chats'); const r=document.querySelector('#chatList .ci, #chatList > *'); r&&r.click();` },
  { id: 'mini',        name: 'Мини-аппы',          step: `showTab('mini');` },
  { id: 'wallet',      name: 'Кошелёк',            step: `showTab('wallet');` },
  { id: 'wallet-hist', name: 'История операций',   step: `showTab('wallet'); typeof w2Open==='function'&&w2Open('statement');` },
  { id: 'wallet-tr',   name: 'Переводы',           step: `showTab('wallet'); typeof w2Open==='function'&&w2Open('transfers');` },
  { id: 'wallet-ex',   name: 'Обмен',              step: `showTab('wallet'); typeof w2Open==='function'&&w2Open('exchange');` },
  { id: 'wallet-sec',  name: 'Безопасность денег', step: `showTab('wallet'); typeof w2Open==='function'&&w2Open('security');` },
  { id: 'wallet-tar',  name: 'Тарифы',             step: `showTab('wallet'); typeof w2Open==='function'&&w2Open('tariffs');` },
  { id: 'profile',     name: 'Профиль',            step: `showTab('profile');` },
  { id: 'partner',     name: 'Партнёрка',          step: `showTab('partner');` },
  { id: 'academy',     name: 'Академия',           step: `showTab('academy');` },
  { id: 'games',       name: 'Игры',               step: `showTab('games');` },
  { id: 'ads',         name: 'Реклама',            step: `showTab('ads');` },
  { id: 'market',      name: 'Биржа',              step: `typeof mkOpen==='function'?mkOpen():(typeof showTab==='function'&&showTab('market'));` },
  { id: 'channels',    name: 'Каналы',             step: `typeof chOpen==='function'&&chOpen('list');` },
  { id: 'notifs',      name: 'Уведомления',        step: `typeof openNotifs==='function'&&openNotifs();` },
  { id: 'search',      name: 'Глобальный поиск',   step: `typeof openSearch==='function'&&openSearch();` },
  { id: 'settings',    name: 'Настройки',          step: `showTab('profile'); typeof st2Open==='function'?st2Open():(typeof openSettingsRoot==='function'&&openSettingsRoot());` },
  { id: 'settings-lang', name: 'Настройки · язык', step: `showTab('profile'); typeof st2Open==='function'&&st2Open('lang');` },
  { id: 'clips',       name: 'Клипы',              wait: 1200, step: `showTab('feed'); typeof okoOpenClips==='function'&&okoOpenClips();` },
  { id: 'profile-pub', name: 'Публичный профиль',  step: `typeof psOpenProfile==='function'&&psOpenProfile('Поддержка OKO');` },
  { id: 'factory',     name: 'Контент-завод',      step: `typeof fbOpen==='function'?fbOpen():(typeof showTab==='function'&&showTab('factory'));` },
  { id: 'system',      name: 'Система роста',      step: `typeof sysOpen==='function'&&sysOpen();` },
];

function initScript() {
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
    }catch(e){}
  `;
}

/* ---- Сбор видимых строк с кириллицей (то, что осталось непереведённым) ---- */
const HARVEST = `(() => {
  const SKIP_TAGS = {SCRIPT:1,STYLE:1,NOSCRIPT:1,IFRAME:1,TEMPLATE:1,VIDEO:1,AUDIO:1,CANVAS:1};
  const CYR = /[А-Яа-яЁё]/;
  const out = [];
  const seen = new Set();
  const VW = innerWidth, VH = innerHeight;

  const visibleEl = el => {
    const cs = getComputedStyle(el);
    if (cs.display === 'none' || cs.visibility === 'hidden' || +cs.opacity === 0) return false;
    const r = el.getBoundingClientRect();
    if (r.width <= 0 || r.height <= 0) return false;
    if (r.left >= VW - 1 || r.right <= 1) return false;
    if (r.top >= VH - 1 || r.bottom <= 1) return false;
    return true;
  };
  const label = el => {
    const id = el.id ? '#' + el.id : '';
    const cls = (el.className && typeof el.className === 'string')
      ? '.' + el.className.trim().split(/\\s+/).slice(0,2).join('.') : '';
    return el.tagName.toLowerCase() + id + cls;
  };

  const w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  let n;
  while ((n = w.nextNode())) {
    const raw = n.nodeValue;
    if (!raw || !CYR.test(raw)) continue;
    const el = n.parentElement;
    if (!el || SKIP_TAGS[el.tagName]) continue;
    if (el.closest('#okoTgChrome')) continue;
    if (!visibleEl(el)) continue;
    const key = raw.replace(/\\s+/g,' ').trim();
    if (!key) continue;
    const sig = key + '|' + label(el);
    if (seen.has(sig)) continue;
    seen.add(sig);
    out.push({ text: key, at: label(el) });
  }
  /* атрибуты */
  for (const a of ['placeholder','title','aria-label']) {
    document.querySelectorAll('[' + a + ']').forEach(el => {
      const v = el.getAttribute(a);
      if (!v || !CYR.test(v)) return;
      if (!visibleEl(el)) return;
      const key = v.replace(/\\s+/g,' ').trim();
      const sig = '@' + a + ':' + key;
      if (seen.has(sig)) return;
      seen.add(sig);
      out.push({ text: key, at: label(el) + '[' + a + ']', attr: a });
    });
  }
  return out;
})()`;

/* ---- Детектор вёрстки на английском ---- */
const LAYOUT = `(() => {
  const out = { overflowX: 0, offRight: [], clipped: [], midWordBreak: [], underTop: [], underBottom: [], badNum: [], noExit: false, empty: false };
  const VW = innerWidth, VH = innerHeight;
  const TOP = ${TG_HEADER}, BOT = ${TG_BOTTOM};
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
    if (cs.display === 'none' || cs.visibility === 'hidden' || +cs.opacity === 0) return false;
    const r = el.getBoundingClientRect();
    if (r.width <= 0 || r.height <= 0) return false;
    if (r.left >= VW - 1 || r.right <= 1) return false;
    if (r.top >= VH - 1 || r.bottom <= 1) return false;
    return true;
  };

  const all = Array.from(document.body.querySelectorAll('*')).slice(0, 5000);
  for (const el of all) {
    if (el.ownerSVGElement) continue;
    if (el.id === 'okoTgChrome' || el.closest('#okoTgChrome')) continue;
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

    /* обрезанный текст без многоточия */
    const own = Array.from(el.childNodes).some(c => c.nodeType === 3 && c.nodeValue.trim());
    if (own) {
      const cw = Math.max(el.clientWidth, Math.round(r.width));
      if (cs.overflow !== 'visible' || cs.overflowX !== 'visible') {
        if (el.scrollWidth > cw + 2 && cs.textOverflow !== 'ellipsis' && !inScroller)
          out.clipped.push({ el: label(el), sw: el.scrollWidth, cw });
      }
      const ch = el.clientHeight || Math.round(r.height);
      if (cs.overflowY === 'hidden' && el.scrollHeight > ch + 3 && cs.webkitLineClamp === 'none')
        out.clipped.push({ el: label(el), sh: el.scrollHeight, ch, dir: 'y' });

      /* перенос посреди слова: слово шире контейнера при break-all/break-word */
      const bw = cs.wordBreak, ow = cs.overflowWrap;
      if (bw === 'break-all' && !el.classList.contains('oko-breakable'))
        out.midWordBreak.push({ el: label(el), why: 'word-break:break-all' });
      else if ((bw === 'break-word' || ow === 'break-word' || ow === 'anywhere')) {
        const txt = (el.textContent || '').trim();
        const longest = txt.split(/\\s+/).reduce((a, b) => a.length >= b.length ? a : b, '');
        if (longest.length > 3) {
          const probe = document.createElement('span');
          probe.style.cssText = 'position:absolute;left:-9999px;top:0;white-space:pre;visibility:hidden';
          probe.style.font = cs.font || (cs.fontWeight + ' ' + cs.fontSize + '/' + cs.lineHeight + ' ' + cs.fontFamily);
          probe.style.letterSpacing = cs.letterSpacing;
          probe.textContent = longest;
          document.body.appendChild(probe);
          const wpx = probe.getBoundingClientRect().width;
          probe.remove();
          const inner = Math.max(el.clientWidth, Math.round(r.width))
            - parseFloat(cs.paddingLeft || 0) - parseFloat(cs.paddingRight || 0);
          if (wpx > inner + 1)
            out.midWordBreak.push({ el: label(el), word: longest, wordPx: Math.round(wpx), inner: Math.round(inner) });
        }
      }
    }

    /* заезд под шапку TG / под нижнее меню */
    if (cs.position === 'fixed' || cs.position === 'sticky') continue;
  }

  /* нижнее меню перекрывает контент? */
  const tabs = document.getElementById('tabs');
  if (tabs) {
    const tr = tabs.getBoundingClientRect();
    if (tr.height > 0 && tr.top < VH) {
      for (const el of all) {
        if (el.ownerSVGElement || el === tabs || tabs.contains(el)) continue;
        if (el.children.length) continue;
        if (!visible(el)) continue;
        const cs = getComputedStyle(el);
        if (cs.position === 'fixed') continue;
        const txt = (el.textContent || '').trim();
        if (!txt) continue;
        const r = el.getBoundingClientRect();
        if (r.top < tr.top + tr.height - 2 && r.bottom > tr.top + 2 && r.left < tr.right && r.right > tr.left)
          out.underBottom.push({ el: label(el), top: Math.round(r.top), tabsTop: Math.round(tr.top) });
      }
    }
  }

  /* NaN / undefined / Infinity в видимом тексте */
  {
    const w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    let n;
    while ((n = w.nextNode())) {
      const v = n.nodeValue;
      if (!v) continue;
      if (!/\\b(NaN|undefined|Infinity|\\[object Object\\])\\b/.test(v)) continue;
      const el = n.parentElement;
      if (!el || !visible(el)) continue;
      out.badNum.push({ text: v.trim().slice(0, 80), at: label(el) });
    }
  }

  /* есть ли выход: нижнее меню, кнопка назад или закрытие */
  out.noExit = !(document.getElementById('tabs') && visible(document.getElementById('tabs')))
    && !Array.from(document.querySelectorAll('.back,.sheet-close,.pop-close,[onclick*="close"],[onclick*="Back"],[aria-label*="Back"],[aria-label*="азад"],#backBtn,.ovl-close'))
        .some(visible);

  /* пустой экран */
  out.empty = (document.body.innerText || '').trim().length < 12;
  out.offRight = out.offRight.slice(0, 12);
  out.clipped = out.clipped.slice(0, 12);
  out.midWordBreak = out.midWordBreak.slice(0, 12);
  out.underBottom = out.underBottom.slice(0, 12);
  return out;
})()`;

const settle = async page => {
  await page.waitForTimeout(320);
  await page.evaluate(async () => {
    for (let i = 0; i < 30; i++) {
      const a = document.getAnimations().filter(x => x.playState === 'running');
      if (!a.length) break;
      await new Promise(r => setTimeout(r, 60));
    }
    await new Promise(r => requestAnimationFrame(() => r()));
  });
};

async function run() {
  const browser = await chromium.launch({ executablePath: EXEC, args: ['--no-sandbox'] });
  const report = {
    base: BASE, at: new Date().toISOString(),
    viewports: {}, harvest: {}, jsErrors: [], totals: {}
  };
  const harvestAll = new Map();   // строка -> где встретилась

  for (const vp of VIEWPORTS) {
    const ctx = await browser.newContext({
      viewport: { width: vp.width, height: vp.height },
      deviceScaleFactor: 2, isMobile: vp.mobile, hasTouch: vp.mobile,
    });
    await ctx.addInitScript(initScript());
    const page = await ctx.newPage();
    const errors = [];
    page.on('pageerror', e => errors.push(String(e.message || e).slice(0, 200)));
    page.on('console', m => { if (m.type() === 'error') errors.push('console: ' + m.text().slice(0, 200)); });

    await page.goto(BASE, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1500);
    await page.evaluate(`window.okoSkipAuth && okoSkipAuth();`);

    const vpRes = { screens: {}, ruLeftTotal: 0 };

    for (const lang of ['ru', 'en']) {
      await page.evaluate(l => {
        try { localStorage.setItem('oko-lang', l); } catch (e) {}
        if (typeof setLang === 'function') setLang(l);
      }, lang);
      await page.waitForTimeout(400);

      for (const r of ROUTES) {
        try {
          await page.evaluate(`window.okoSkipAuth && okoSkipAuth(); try{ ${r.step} }catch(e){}`);
        } catch (e) { /* маршрут может отсутствовать в этой сборке */ }
        await page.waitForTimeout(r.wait || 300);
        await settle(page);

        if (lang === 'en') {
          const found = await page.evaluate(HARVEST);
          for (const f of found) {
            if (!harvestAll.has(f.text)) harvestAll.set(f.text, { at: f.at, screens: [] });
            const rec = harvestAll.get(f.text);
            if (!rec.screens.includes(r.id)) rec.screens.push(r.id);
          }
          const lay = HARVEST_ONLY ? null : await page.evaluate(LAYOUT);
          vpRes.screens[r.id] = { name: r.name, ruLeft: found.length, layout: lay };
          vpRes.ruLeftTotal += found.length;
        }

        /* выход с экрана — Escape не должен ломать приложение */
        try { await page.keyboard.press('Escape'); } catch (e) {}
        await page.waitForTimeout(120);
      }
    }

    report.viewports[vp.id] = vpRes;
    report.jsErrors.push(...errors.map(e => vp.id + ': ' + e));
    await ctx.close();
  }

  await browser.close();

  report.harvest = Object.fromEntries(
    [...harvestAll.entries()].sort((a, b) => b[1].screens.length - a[1].screens.length)
      .map(([k, v]) => [k, v.screens.join(',')])
  );
  report.totals = {
    ruStringsLeft: harvestAll.size,
    perViewport: Object.fromEntries(Object.entries(report.viewports).map(([k, v]) => [k, v.ruLeftTotal])),
    jsErrors: report.jsErrors.length,
    layoutIssues: Object.fromEntries(Object.entries(report.viewports).map(([k, v]) => {
      let n = 0;
      for (const s of Object.values(v.screens)) {
        const L = s.layout; if (!L) continue;
        n += (L.overflowX > 1 ? 1 : 0) + L.offRight.length + L.clipped.length +
             L.midWordBreak.length + L.underBottom.length + L.badNum.length +
             (L.noExit ? 1 : 0) + (L.empty ? 1 : 0);
      }
      return [k, n];
    })),
  };

  await fs.mkdir(path.dirname(OUTJSON), { recursive: true });
  await fs.writeFile(OUTJSON, JSON.stringify(report, null, 2), 'utf8');
  console.log(JSON.stringify(report.totals, null, 2));
  console.log('отчёт: ' + OUTJSON);
}

run().catch(e => { console.error(e); process.exit(1); });
