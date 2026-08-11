/* ============================================================================
   OKO · ПРОБНИК ДОСТУПНОСТИ (a11y)

   Считает нарушения ЧИСЛЕННО, а не «на глаз»:
     • интерактивные элементы без доступного имени (кнопки-иконки, ссылки, поля)
     • контраст текста ниже нормы WCAG 2.1 AA (4.5:1 обычный, 3:1 крупный)
       в ОБЕИХ темах, с указанием пары цветов и посчитанного значения
     • цели нажатия меньше 44×44 CSS-пикселей
     • ловушка фокуса в модальных шторках: не выпускает Tab, закрывается Escape,
       возвращает фокус на элемент-открыватель
     • видимый фокус-ринг (в фокусе меняется outline/box-shadow)
     • роли и состояния: role=dialog + aria-modal у шторок, aria-live у тостов
     • prefers-reduced-motion: сколько анимаций продолжает крутиться

   Запуск: node oko-app/tools/probe-a11y.mjs [--round N] [--shots] [--base URL]
   ============================================================================ */
import { chromium } from 'playwright-core';
import fs from 'node:fs/promises';
import path from 'node:path';
import { CLEAN_START, CLOSE_OVERLAYS, RESET_ALL } from './clean-start.mjs';

const args = Object.fromEntries(
  process.argv.slice(2).join(' ').split('--').filter(Boolean)
    .map(s => { const [k, ...v] = s.trim().split(/\s+/); return [k, v.join(' ') || true]; })
);

const BASE  = args.base || 'http://127.0.0.1:8199/index.html';
const ROUND = String(args.round || '1');
const OUT   = path.resolve('oko-app/tools/a11y-out', `round-${ROUND}`);
const SHOTS = !!args.shots;

const TG_HEADER = 56;
const TG_BOTTOM = 34;

const VIEWPORTS = [
  { id: 'phone',   width: 390, height: 844,  mobile: true  },
  { id: 'narrow',  width: 360, height: 740,  mobile: true  },
  { id: 'desktop', width: 1440, height: 900, mobile: false },
];

/* Экраны обхода. step — что выполнить, чтобы туда попасть. */
const ROUTES = [
  { id: '01-auth',      name: 'Вход и регистрация', wait: 1200,
    step: `document.getElementById('splash')?.classList.add('gone'); document.getElementById('authScreen')?.classList.remove('hidden');` },
  { id: '02-feed',      name: 'Лента',            step: `okoSkipAuth(); showTab('feed');` },
  { id: '03-chats',     name: 'Список чатов',     step: `okoSkipAuth(); showTab('chats');` },
  { id: '04-conv',      name: 'Диалог',           step: `okoSkipAuth(); showTab('chats'); const r=document.querySelector('#chatList .ci, #chatList > *'); r&&r.click();` },
  { id: '05-mini',      name: 'Мини-аппы',        step: `okoSkipAuth(); showTab('mini');` },
  { id: '06-wallet',    name: 'Кошелёк',          step: `okoSkipAuth(); showTab('wallet');` },
  { id: '07-profile',   name: 'Профиль',          step: `okoSkipAuth(); showTab('profile');` },
  { id: '08-partner',   name: 'Партнёрка',        step: `okoSkipAuth(); showTab('partner');` },
  { id: '09-academy',   name: 'Академия',         step: `okoSkipAuth(); showTab('academy');` },
  { id: '10-games',     name: 'Игры',             step: `okoSkipAuth(); showTab('games');` },
  { id: '11-ads',       name: 'Реклама',          step: `okoSkipAuth(); showTab('ads');` },
  { id: '12-notifs',    name: 'Уведомления',      step: `okoSkipAuth(); typeof openNotifs==='function'&&openNotifs();` },
  { id: '13-search',    name: 'Поиск',            step: `okoSkipAuth(); typeof openSearch==='function'&&openSearch();` },
  { id: '14-settings',  name: 'Настройки',        step: `okoSkipAuth(); showTab('profile'); typeof st2Open==='function'?st2Open():(typeof openSettingsRoot==='function'&&openSettingsRoot());` },
  { id: '15-wallet-hist', name: 'История операций', step: `okoSkipAuth(); showTab('wallet'); typeof w2Open==='function'&&w2Open('statement');` },
  { id: '16-wallet-sec',  name: 'Безопасность',     step: `okoSkipAuth(); showTab('wallet'); typeof w2Open==='function'&&w2Open('security');` },
  { id: '17-clips',     name: 'Клипы',            wait: 1400, step: `okoSkipAuth(); showTab('feed'); typeof okoOpenClips==='function'&&okoOpenClips();` },
  { id: '18-channels',  name: 'Каналы',           step: `okoSkipAuth(); typeof chOpen==='function'&&chOpen('list');` },
  { id: '19-pubprofile',name: 'Публичный профиль',step: `okoSkipAuth(); typeof psOpenProfile==='function'&&psOpenProfile('Поддержка OKO');` },
];

/* Скрипт до загрузки страницы (совпадает с audit.mjs). */
/* Чистый старт берём общий, а не свой.

   Свой был стар: он гасил splash, authScreen и старый #onboard, но не знал
   про слой onb2 и про подсказки роста. Из-за этого пробник обходил экраны с
   открытым окном «Знакомство с OKO» и мерил ЕГО: три «провала ловушки
   фокуса» относились к окну знакомства, а самой частой мелкой целью с
   29 попаданиями оказалась кнопка «Пропустить» из онбординга. Тот же урок,
   что и в аудите (памятка, пункты 18 и 20): список экранов и список ключей
   тишины руками не поддерживаются — они живут в clean-start.mjs. */
function initScript(theme) {
  return CLEAN_START + `
    ;try{ localStorage.setItem('oko-theme','${theme}'); }catch(e){}
    document.addEventListener('DOMContentLoaded', function(){
      try{ document.documentElement.setAttribute('data-theme','${theme}'); }catch(e){}
    });
  `;
}

/* ------------------------------------------------------------------ */
/* Общий кусок кода, который живёт в странице: разбор цветов, контраст */
/* ------------------------------------------------------------------ */
const HELPERS = `
  const VW = window.innerWidth, VH = window.innerHeight;

  function labelOf(el){
    const id = el.id ? '#'+el.id : '';
    let cls = '';
    if (el.className && typeof el.className === 'string')
      cls = '.' + el.className.trim().split(/\\s+/).slice(0,3).join('.');
    return el.tagName.toLowerCase() + id + cls;
  }

  /* Виден ли элемент человеку. Закрытые шторки уезжают за край — не считаем. */
  function visible(el){
    const cs = getComputedStyle(el);
    if (cs.display === 'none' || cs.visibility === 'hidden') return false;
    if (parseFloat(cs.opacity) < 0.05) return false;
    const r = el.getBoundingClientRect();
    if (r.width <= 0 || r.height <= 0) return false;
    if (r.left >= VW - 1 || r.right <= 1) return false;
    if (r.top >= VH - 1 || r.bottom <= 1) return false;
    /* Предок с opacity:0 / visibility:hidden / display:none */
    for (let p = el.parentElement; p; p = p.parentElement){
      const pc = getComputedStyle(p);
      if (pc.display === 'none' || pc.visibility === 'hidden') return false;
      if (parseFloat(pc.opacity) < 0.05) return false;
    }
    return true;
  }

  /* ---- цвет ---- */
  function parseColor(s){
    if (!s) return null;
    if (s === 'transparent') return [0,0,0,0];
    const m = s.match(/rgba?\\(([^)]+)\\)/);
    if (!m) return null;
    const p = m[1].split(/[,\\s\\/]+/).filter(Boolean).map(Number);
    return [p[0], p[1], p[2], p.length > 3 ? p[3] : 1];
  }
  function over(fg, bg){ /* fg поверх bg с учётом альфы */
    const a = fg[3];
    return [ fg[0]*a + bg[0]*(1-a), fg[1]*a + bg[1]*(1-a), fg[2]*a + bg[2]*(1-a), 1 ];
  }
  function lum(c){
    const f = v => { v /= 255; return v <= 0.03928 ? v/12.92 : Math.pow((v+0.055)/1.055, 2.4); };
    return 0.2126*f(c[0]) + 0.7152*f(c[1]) + 0.0722*f(c[2]);
  }
  function contrast(a, b){
    const l1 = lum(a), l2 = lum(b);
    const hi = Math.max(l1,l2), lo = Math.min(l1,l2);
    return (hi + 0.05) / (lo + 0.05);
  }
  function hex(c){
    const h = v => Math.round(v).toString(16).padStart(2,'0');
    return '#' + h(c[0]) + h(c[1]) + h(c[2]);
  }
  /* Итоговый фон под элементом: собираем стек непрозрачных слоёв. */
  function bgUnder(el){
    let acc = null;
    for (let p = el; p; p = p.parentElement){
      const cs = getComputedStyle(p);
      /* градиент/картинка — цвет посчитать честно нельзя, помечаем */
      const bi = cs.backgroundImage;
      const c = parseColor(cs.backgroundColor);
      if (bi && bi !== 'none') return { color: acc || [0,0,0,1], unknown: true };
      if (c && c[3] > 0){
        acc = acc ? over(acc, c) : (c[3] >= 0.999 ? c : c);
        if (c[3] >= 0.999) return { color: acc[3] >= 0.999 ? acc : over(acc,[255,255,255,1]), unknown: false };
      }
    }
    const html = parseColor(getComputedStyle(document.documentElement).backgroundColor) || [255,255,255,1];
    const base = html[3] > 0 ? html : [255,255,255,1];
    return { color: acc ? over(acc, base) : base, unknown: false };
  }

  /* ---- доступное имя (упрощённый расчёт по спецификации accname) ---- */
  function accName(el){
    const aria = (el.getAttribute('aria-label') || '').trim();
    if (aria) return aria;
    const lb = el.getAttribute('aria-labelledby');
    if (lb){
      const txt = lb.split(/\\s+/).map(id => {
        const t = document.getElementById(id);
        return t ? (t.getAttribute('aria-label') || t.textContent || '').trim() : '';
      }).join(' ').trim();
      if (txt) return txt;
    }
    if (el.matches('input,textarea,select')){
      if (el.id){
        const l = document.querySelector('label[for="' + CSS.escape(el.id) + '"]');
        if (l && l.textContent.trim()) return l.textContent.trim();
      }
      const wrap = el.closest('label');
      if (wrap && wrap.textContent.trim()) return wrap.textContent.trim();
      const ph = (el.getAttribute('placeholder') || '').trim();
      if (ph) return ph;
      if (el.type === 'submit' || el.type === 'button'){
        const v = (el.value || '').trim(); if (v) return v;
      }
    }
    const own = (el.textContent || '').replace(/\\s+/g,' ').trim();
    if (own) return own;
    const img = el.querySelector('img[alt]');
    if (img && img.alt.trim()) return img.alt.trim();
    const t = (el.getAttribute('title') || '').trim();
    if (t) return t;
    const svgTitle = el.querySelector('svg > title');
    if (svgTitle && svgTitle.textContent.trim()) return svgTitle.textContent.trim();
    return '';
  }

  const INTERACTIVE = 'button, a[href], input:not([type="hidden"]), select, textarea,' +
    ' [role="button"], [role="link"], [role="tab"], [role="switch"], [role="checkbox"],' +
    ' [role="menuitem"], [role="option"], [tabindex]:not([tabindex="-1"])';

  function interactiveEls(){
    const set = new Set(Array.from(document.querySelectorAll(INTERACTIVE)));
    return Array.from(set).filter(el => {
      if (el.closest('#okoTgChrome')) return false;
      if (el.disabled) return false;
      if (el.getAttribute('aria-hidden') === 'true') return false;
      if (el.closest('[aria-hidden="true"]')) return false;
      if (el.closest('[inert]')) return false;
      return visible(el);
    });
  }
`;

/* ---- Основной замер на экране ---- */
const PROBE = `(() => {
  ${HELPERS}
  const out = { noName: [], lowContrast: [], smallTarget: [], noFocusRing: [],
                counts: {}, roles: {}, jsErrors: [] };

  /* --- 1. доступные имена --- */
  const inter = interactiveEls();
  out.counts.interactive = inter.length;
  for (const el of inter){
    const n = accName(el);
    if (!n){
      out.noName.push({ el: labelOf(el), html: el.outerHTML.slice(0,110).replace(/\\s+/g,' ') });
    }
  }

  /* --- 2. контраст текста --- */
  const seen = new Set();
  const textEls = Array.from(document.body.querySelectorAll('*')).slice(0, 6000);
  for (const el of textEls){
    if (el.ownerSVGElement) continue;
    if (el.closest('#okoTgChrome')) continue;
    if (el.getAttribute('aria-hidden') === 'true') continue;
    /* Берём только «листья» с собственным текстом */
    let own = '';
    for (const n of el.childNodes) if (n.nodeType === 3) own += n.nodeValue;
    own = own.replace(/\\s+/g,' ').trim();
    if (!own || own.length < 2) continue;
    if (!visible(el)) continue;
    const cs = getComputedStyle(el);
    const fg0 = parseColor(cs.color); if (!fg0) continue;
    if (fg0[3] < 0.05) continue;
    /* Текст, залитый градиентом (background-clip:text) — цвет прозрачный */
    if (cs.webkitTextFillColor === 'rgba(0, 0, 0, 0)') continue;
    const bgi = bgUnder(el);
    if (bgi.unknown) continue;           /* поверх картинки/градиента честно не посчитать */
    const fg = fg0[3] < 0.999 ? over(fg0, bgi.color) : fg0;
    const ratio = contrast(fg, bgi.color);
    const size = parseFloat(cs.fontSize);
    const w = cs.fontWeight === 'bold' ? 700 : (parseInt(cs.fontWeight,10) || 400);
    const large = size >= 24 || (size >= 18.66 && w >= 700);
    const need = large ? 3 : 4.5;
    if (ratio + 0.005 < need){
      const key = hex(fg) + '|' + hex(bgi.color) + '|' + Math.round(size);
      if (seen.has(key)) continue;
      seen.add(key);
      out.lowContrast.push({ el: labelOf(el), text: own.slice(0,40),
        fg: hex(fg), bg: hex(bgi.color), ratio: +ratio.toFixed(2), need, size: Math.round(size) });
    }
  }

  /* --- 3. цель нажатия 44×44 --- */
  for (const el of inter){
    if (el.matches('a') && !el.matches('[role="button"]')){
      /* Ссылка внутри абзаца текста — исключение WCAG 2.5.5 (inline) */
      const cs = getComputedStyle(el);
      if (cs.display === 'inline') continue;
    }
    if (el.dataset.a11yTargetOk === '1') continue;   /* явное освобождение */
    const r = el.getBoundingClientRect();
    /* Учитываем невидимые расширители области нажатия: псевдоэлемент
       ::before/::after с отрицательными отступами и дочерний .oko-hitpad.
       Меряем по реальным геометриям, а не по названиям классов. */
    let w = r.width, h = r.height;
    for (const pe of ['::before','::after']){
      const p = getComputedStyle(el, pe);
      if (p.content === 'none') continue;
      if (p.position !== 'absolute' && p.position !== 'fixed') continue;
      const pw = parseFloat(p.width), ph = parseFloat(p.height);
      if (!isNaN(pw) && pw > w) w = pw;
      if (!isNaN(ph) && ph > h) h = ph;
      const t = parseFloat(p.top), l = parseFloat(p.left);
      if (!isNaN(t) && t < 0) h = Math.max(h, r.height + Math.abs(t)*2);
      if (!isNaN(l) && l < 0) w = Math.max(w, r.width + Math.abs(l)*2);
    }
    const pad = el.querySelector(':scope > .oko-hitpad');
    if (pad){
      const pr = pad.getBoundingClientRect();
      if (pr.width > w) w = pr.width;
      if (pr.height > h) h = pr.height;
    }
    if (w < 43.5 || h < 43.5){
      out.smallTarget.push({ el: labelOf(el), w: Math.round(w), h: Math.round(h),
        raw: Math.round(r.width) + 'x' + Math.round(r.height),
        name: accName(el).slice(0,30) });
    }
  }

  /* --- 4. роли и состояния --- */
  const dialogs = Array.from(document.querySelectorAll('[role="dialog"],[role="alertdialog"]'))
    .filter(visible);
  out.roles.openDialogs = dialogs.length;
  out.roles.dialogsWithoutModal = dialogs.filter(d => d.getAttribute('aria-modal') !== 'true').length;
  out.roles.dialogsWithoutName = dialogs.filter(d => !accName(d) && !d.getAttribute('aria-label') && !d.getAttribute('aria-labelledby')).length;
  out.roles.liveRegions = document.querySelectorAll('[aria-live]').length;

  const dedupe = a => { const s = new Set(); return a.filter(x => {
    const k = x.el + '|' + (x.fg||'') + (x.w||'') + (x.text||'');
    if (s.has(k)) return false; s.add(k); return true; }); };
  out.noName = dedupe(out.noName).slice(0, 40);
  out.lowContrast = dedupe(out.lowContrast).slice(0, 40);
  out.smallTarget = dedupe(out.smallTarget).slice(0, 40);
  out.counts.noName = out.noName.length;
  out.counts.lowContrast = out.lowContrast.length;
  out.counts.smallTarget = out.smallTarget.length;
  return out;
})()`;

/* ---- Проверка видимого фокус-ринга ------------------------------------------
   :focus-visible в Chrome НЕ включается от el.focus() из скрипта — только от
   настоящей клавиатуры. Поэтому жмём Tab по-честному и смотрим на элемент,
   который получил фокус: видно ли на нём кольцо. */
const RING_AT_FOCUS = `(() => {
  ${HELPERS}
  const el = document.activeElement;
  if (!el || el === document.body || el === document.documentElement) return null;
  const cs = getComputedStyle(el);
  const ring = (cs.outlineStyle !== 'none' && parseFloat(cs.outlineWidth) >= 1.5) ||
               (cs.boxShadow && cs.boxShadow !== 'none');
  return { el: labelOf(el), ring: !!ring,
           outline: cs.outlineStyle + ' ' + cs.outlineWidth + ' ' + cs.outlineColor,
           name: (accName(el) || '').slice(0, 40) };
})()`;

async function checkFocusRing(page, steps) {
  const bad = [], seen = new Set();
  let checked = 0;
  await page.evaluate(`(() => { const m = document.querySelector('main'); m && m.focus && m.focus(); })()`);
  for (let i = 0; i < steps; i++) {
    await page.keyboard.press('Tab');
    const r = await page.evaluate(RING_AT_FOCUS);
    if (!r) continue;
    if (seen.has(r.el)) continue;
    seen.add(r.el);
    checked++;
    if (!r.ring) bad.push(r.el + ' [' + r.outline + ']');
  }
  return { checked, noRing: bad.slice(0, 20), noRingCount: bad.length };
}

/* ---- reduced motion: сколько анимаций всё ещё крутится ---- */
const MOTION = `(() => {
  const anims = document.getAnimations().filter(a => {
    if (a.playState !== 'running') return false;
    const t = a.effect && a.effect.getTiming ? a.effect.getTiming() : null;
    const d = t ? (typeof t.duration === 'number' ? t.duration : 0) : 0;
    /* мгновенные и однократные короткие переходы не мешают */
    return (t && (t.iterations === Infinity || d > 400));
  });
  return { running: anims.length,
           names: anims.slice(0,10).map(a => (a.animationName || (a.effect&&a.effect.target&&a.effect.target.className) || 'transition') + '') };
})()`;

/* ---- Ловушка фокуса в шторках ---- */
const TRAP_CASES = [
  { id: 'settings', name: 'Настройки',
    open: `okoSkipAuth(); showTab('profile'); typeof st2Open==='function'?st2Open():(typeof openSettingsRoot==='function'&&openSettingsRoot());` },
  { id: 'notifs', name: 'Уведомления', open: `okoSkipAuth(); typeof openNotifs==='function'&&openNotifs();` },
  { id: 'search', name: 'Поиск', open: `okoSkipAuth(); typeof openSearch==='function'&&openSearch();` },
];

/* Одна и та же выборка «открытой шторки» для всех проверок ловушки.

   Раньше каждая проверка искала шторку по-своему, и две из трёх брали
   `getComputedStyle(x).position === 'fixed'` — а у скрытого через display:none
   элемента position всё равно возвращается 'fixed'. Плюс `.pop()` берёт
   ПОСЛЕДНЮЮ в разметке. В итоге проверки мерили не открытую панель, а
   скрытый #cl-personal в конце документа, и рапортовали «фокус не внутри,
   30 утечек Tab». Живой опыт показал обратное: фокус в панели и после
   шести Tab остаётся в ней. */
const ОТКРЫТАЯ_ШТОРКА = `(() => {
  const годится = e => {
    if (e.closest('[inert]')) return false;
    const cs = getComputedStyle(e);
    if (cs.display === 'none' || cs.visibility === 'hidden' || +cs.opacity === 0) return false;
    const r = e.getBoundingClientRect();
    return r.width > 2 && r.height > 2;
  };
  return Array.from(document.querySelectorAll('[role="dialog"],[role="alertdialog"]')).filter(годится).pop() || null;
})()`;

function trapScript() {
  return `(() => {
    ${HELPERS}
    /* Ищем видимую модальную шторку */
    const dlg = ${ОТКРЫТАЯ_ШТОРКА};
    if (!dlg) return { found: false };
    const inside = interactiveEls().filter(el => dlg.contains(el));
    return { found: true, el: labelOf(dlg), ariaModal: dlg.getAttribute('aria-modal'),
             name: (dlg.getAttribute('aria-label')||'').slice(0,40), focusables: inside.length };
  })()`;
}

async function main() {
  await fs.mkdir(OUT, { recursive: true });
  const browser = await chromium.launch({
    executablePath: process.env.OKO_CHROME || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-gl=swiftshader', '--enable-unsafe-swiftshader'],
  });

  const report = {
    round: ROUND, at: new Date().toISOString(),
    total: { noName: 0, lowContrast: 0, smallTarget: 0, noFocusRing: 0, jsErrors: 0,
             dialogsWithoutModal: 0, motionRunning: 0, trapFailures: 0 },
    runs: [], contrastPairs: [], nameSamples: [], targetSamples: [], traps: [],
  };

  const THEMES = ['dark', 'light'];

  for (const vp of VIEWPORTS) {
    for (const theme of THEMES) {
      /* Контраст проверяем в обеих темах на всех вьюпортах; имена и цели —
         достаточно один раз на тему, но дешевле мерить всё разом. */
      const ctx = await browser.newContext({
        viewport: { width: vp.width, height: vp.height },
        deviceScaleFactor: 1,
        isMobile: vp.mobile, hasTouch: vp.mobile,
        colorScheme: theme,
        userAgent: vp.mobile
          ? 'Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126 Mobile Safari/537.36'
          : undefined,
      });
      await ctx.addInitScript(initScript(theme));
      const page = await ctx.newPage();
      const jsErrors = [];
      /* Шум песочницы, а не дефект приложения: внешние CDN режет прокси, а
         локальная статика не отдаёт api.php — бэкенда тут просто нет. */
      const NOISE = /ERR_CONNECTION_RESET|ERR_NAME_NOT_RESOLVED|ERR_BLOCKED|net::ERR_|api\.php|404 \(File not found\)|Failed to load resource/i;
      /* Недоступная сеть — состояние песочницы, а не поломка кода. */
      const СЕТЕВОЕ = /Failed to fetch|NetworkError|Load failed|ERR_CONNECTION|ERR_NETWORK|ERR_INTERNET/i;

      page.on('console', m => {
        const т = m.text();
        /* Библиотека Supabase логирует отказ сети через console.error сама —
           текст «TypeError: Failed to fetch» приходил сюда, а не в pageerror,
           и NOISE его не ловил. */
        if (m.type() === 'error' && !NOISE.test(т) && !СЕТЕВОЕ.test(т)) jsErrors.push(т.slice(0,160));
      });
      /* Тот же фильтр шума обязан работать и здесь.

         Раньше pageerror писался без разбора, и отчёт показывал 108 «ошибок
         приложения» — все до одной «TypeError: Failed to fetch» из библиотеки
         Supabase, которой прокси песочницы режет выход наружу. Проверено
         слушателями внутри страницы: ни unhandledrejection, ни window.onerror
         НЕ срабатывают — библиотека обрабатывает отказ сама, а Playwright
         считает промис, который был необработан лишь на мгновение
         (exceptionRevoked он не слушает). То есть это не дефект приложения
         и даже не его ошибка. */
      page.on('pageerror', e => {
        const т = String(e);
        if (СЕТЕВОЕ.test(т)) return;
        jsErrors.push('PAGEERROR: ' + т.slice(0,160));
      });

      for (const route of ROUTES) {
        const rep = { vp: vp.id, theme, route: route.id, name: route.name };
        try {
          jsErrors.length = 0;
          await page.goto(BASE, { waitUntil: 'domcontentloaded', timeout: 40000 });
          await page.waitForTimeout(route.wait || 900);
          /* Гасим всё, что успело всплыть само: подсказки роста, приветствия,
             оставшиеся открытыми подстраницы. Иначе следующий маршрут мерится
             по чужому экрану. */
          await page.evaluate(RESET_ALL).catch(() => {});
          await page.evaluate(CLOSE_OVERLAYS).catch(() => {});
          await page.waitForTimeout(200);
          if (route.step) {
            try { await page.evaluate(route.step); } catch (e) { rep.stepError = String(e).slice(0,140); }
            await page.waitForTimeout(700);
          }
          /* Замеряем после того, как анимации отыграли, иначе поймаем
             промежуточную геометрию (урок сессии 09.08). */
          await page.evaluate(`(async () => {
            for (let i = 0; i < 20; i++){
              const a = document.getAnimations().filter(x => x.playState === 'running' &&
                x.effect && x.effect.getTiming && x.effect.getTiming().iterations !== Infinity);
              if (!a.length) break;
              await new Promise(r => setTimeout(r, 100));
            }
          })()`);

          const probe = await page.evaluate(PROBE);
          Object.assign(rep, probe);
          rep.jsErrors = jsErrors.slice(0, 5);

          /* Фокус-ринг проверяем один раз на вьюпорт+тему на ключевых экранах */
          if (['02-feed','03-chats','06-wallet','14-settings'].includes(route.id)) {
            rep.focusRing = await checkFocusRing(page, 25);
          }

          if (SHOTS) {
            const f = path.join(OUT, `${vp.id}-${theme}__${route.id}.png`);
            try { await page.screenshot({ path: f, timeout: 15000 }); rep.shot = path.relative(process.cwd(), f); } catch {}
          }
        } catch (e) {
          rep.fatal = String(e).slice(0, 200);
        }

        report.total.noName += rep.counts?.noName || 0;
        report.total.lowContrast += rep.counts?.lowContrast || 0;
        report.total.smallTarget += rep.counts?.smallTarget || 0;
        report.total.noFocusRing += rep.focusRing?.noRingCount || 0;
        report.total.jsErrors += (rep.jsErrors || []).length;
        report.total.dialogsWithoutModal += rep.roles?.dialogsWithoutModal || 0;
        for (const c of rep.lowContrast || []) report.contrastPairs.push({ ...c, vp: vp.id, theme, route: route.id });
        for (const n of rep.noName || []) report.nameSamples.push({ ...n, vp: vp.id, theme, route: route.id });
        for (const t of rep.smallTarget || []) report.targetSamples.push({ ...t, vp: vp.id, theme, route: route.id });

        report.runs.push({
          vp: vp.id, theme, route: route.id, name: route.name,
          interactive: rep.counts?.interactive || 0,
          noName: rep.counts?.noName || 0,
          lowContrast: rep.counts?.lowContrast || 0,
          smallTarget: rep.counts?.smallTarget || 0,
          noFocusRing: rep.focusRing?.noRingCount ?? null,
          jsErrors: (rep.jsErrors || []).length,
          /* Тексты, а не только счёт: по числу «JS=1» чинить нечего, а без
             сообщения непонятно даже, одна это ошибка на всех экранах или
             девяносто шесть разных. */
          jsErrorTexts: (rep.jsErrors || []).slice(0, 5),
          smallTargetList: (rep.targets || rep.smallTargets || []).slice(0, 8),
          fatal: rep.fatal || undefined, stepError: rep.stepError || undefined,
        });

        const flags = [
          rep.counts?.noName ? `имён нет=${rep.counts.noName}` : '',
          rep.counts?.lowContrast ? `контраст=${rep.counts.lowContrast}` : '',
          rep.counts?.smallTarget ? `цели<44=${rep.counts.smallTarget}` : '',
          rep.focusRing?.noRingCount ? `без ринга=${rep.focusRing.noRingCount}` : '',
          (rep.jsErrors||[]).length ? `JS=${rep.jsErrors.length}` : '',
          rep.fatal ? 'FATAL' : '',
        ].filter(Boolean).join(' ');
        console.log(`  ${vp.id}/${theme} ${route.id} ${route.name} ${flags || 'чисто'}`);
      }

      /* ---- prefers-reduced-motion ---- */
      if (vp.id === 'phone' && theme === 'dark') {
        const rmCtx = await browser.newContext({
          viewport: { width: vp.width, height: vp.height }, isMobile: true, hasTouch: true,
          reducedMotion: 'reduce', colorScheme: 'dark',
        });
        await rmCtx.addInitScript(initScript('dark'));
        const rmPage = await rmCtx.newPage();
        await rmPage.goto(BASE, { waitUntil: 'domcontentloaded', timeout: 40000 });
        await rmPage.waitForTimeout(1500);
        await rmPage.evaluate(`okoSkipAuth(); showTab('feed');`);
        await rmPage.waitForTimeout(1200);
        report.reducedMotion = await rmPage.evaluate(MOTION);
        report.total.motionRunning = report.reducedMotion.running;
        console.log(`  reduced-motion: анимаций крутится ${report.reducedMotion.running}`);
        await rmCtx.close();
      }

      /* ---- ловушка фокуса + возврат фокуса + Escape ---- */
      if (theme === 'dark' && vp.id === 'phone') {
        for (const tc of TRAP_CASES) {
          const t = { case: tc.id, name: tc.name };
          try {
            await page.goto(BASE, { waitUntil: 'domcontentloaded', timeout: 40000 });
            await page.waitForTimeout(1200);
            /* создаём «открыватель» и запоминаем его — так проверяем возврат фокуса */
            await page.evaluate(`okoSkipAuth();`);
            await page.waitForTimeout(300);
            await page.evaluate(`(() => {
              let b = document.getElementById('a11yTrapOpener');
              if (!b){
                b = document.createElement('button');
                b.id = 'a11yTrapOpener'; b.textContent = 'открыть';
                b.style.cssText = 'position:fixed;left:4px;top:4px;z-index:5;width:60px;height:44px';
                document.body.appendChild(b);
              }
              b.focus();
            })()`);
            await page.evaluate(tc.open);
            await page.waitForTimeout(900);

            const info = await page.evaluate(trapScript());
            t.dialogFound = info.found;
            t.ariaModal = info.ariaModal;
            t.dialogName = info.name;
            t.focusables = info.focusables;

            if (info.found) {
              /* фокус должен уехать внутрь шторки */
              t.focusMovedInside = await page.evaluate(`(() => {
                const d = ${ОТКРЫТАЯ_ШТОРКА};
                return !!(d && d.contains(document.activeElement));
              })()`);
              /* 30 нажатий Tab — фокус обязан остаться внутри */
              let escaped = 0;
              for (let i = 0; i < 30; i++) {
                await page.keyboard.press('Tab');
                const inside = await page.evaluate(`(() => {
                  const d = ${ОТКРЫТАЯ_ШТОРКА};
                  if (!d) return true;
                  return d.contains(document.activeElement);
                })()`);
                if (!inside) escaped++;
              }
              t.tabEscapes = escaped;
              /* Escape закрывает и возвращает фокус */
              await page.keyboard.press('Escape');
              await page.waitForTimeout(700);
              t.closedByEscape = await page.evaluate(trapScript()).then(r => !r.found);
              t.focusReturned = await page.evaluate(`document.activeElement && document.activeElement.id === 'a11yTrapOpener'`);
              if (escaped > 0 || !t.focusMovedInside || !t.closedByEscape || !t.focusReturned)
                report.total.trapFailures++;
            } else {
              report.total.trapFailures++;
            }
          } catch (e) { t.error = String(e).slice(0,160); report.total.trapFailures++; }
          report.traps.push(t);
          console.log(`  ловушка ${tc.id}: dialog=${t.dialogFound} modal=${t.ariaModal} внутрь=${t.focusMovedInside} утечекTab=${t.tabEscapes} Esc=${t.closedByEscape} возврат=${t.focusReturned}`);
        }
      }

      await ctx.close();
    }
  }

  await browser.close();

  /* Сводка уникальных пар цветов — чтобы чинить причину, а не симптом */
  const uniq = new Map();
  for (const c of report.contrastPairs) {
    const k = `${c.fg}|${c.bg}|${c.need}`;
    const e = uniq.get(k) || { fg: c.fg, bg: c.bg, need: c.need, ratio: c.ratio, hits: 0, themes: new Set(), samples: [] };
    e.hits++; e.themes.add(c.theme); e.ratio = Math.min(e.ratio, c.ratio);
    if (e.samples.length < 3) e.samples.push(`${c.route}:${c.el} «${c.text}»`);
    uniq.set(k, e);
  }
  report.contrastUnique = Array.from(uniq.values())
    .map(e => ({ ...e, themes: Array.from(e.themes) }))
    .sort((a,b) => a.ratio - b.ratio);

  const un = new Map();
  for (const n of report.nameSamples) { const k = n.el; if (!un.has(k)) un.set(k, { ...n, hits: 0 }); un.get(k).hits++; }
  report.nameUnique = Array.from(un.values()).sort((a,b) => b.hits - a.hits).slice(0, 60);

  const ut = new Map();
  for (const t of report.targetSamples) { const k = t.el + t.w + 'x' + t.h; if (!ut.has(k)) ut.set(k, { ...t, hits: 0 }); ut.get(k).hits++; }
  report.targetUnique = Array.from(ut.values()).sort((a,b) => b.hits - a.hits).slice(0, 60);

  delete report.contrastPairs; delete report.nameSamples; delete report.targetSamples;

  const file = path.join(OUT, 'report.json');
  await fs.writeFile(file, JSON.stringify(report, null, 2), 'utf8');
  console.log('\n=== ИТОГ ===');
  console.log(JSON.stringify(report.total, null, 2));
  console.log('уникальных пар цветов ниже нормы:', report.contrastUnique.length);
  console.log('уникальных элементов без имени:', report.nameUnique.length);
  console.log('уникальных мелких целей:', report.targetUnique.length);
  console.log('отчёт:', file);
}

main().catch(e => { console.error(e); process.exit(1); });
