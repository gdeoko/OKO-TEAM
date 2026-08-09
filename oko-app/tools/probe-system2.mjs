/* ============================================================================
   probe-system2.mjs — пробник слоя oko-system2.js
   ----------------------------------------------------------------------------
   Проверяет два мини-аппа: СИСТЕМА РОСТА (openMa('system')) и
   МОИ СОЦСЕТИ (openMa('socials')).

   На каждом шаге:
     • ждёт окончания конечных анимаций (иначе ловится промежуточная геометрия);
     • ищет горизонтальное переполнение страницы и элементов за краем окна;
     • ищет обрезанный текст без многоточия;
     • ищет переносы посреди слова — ширина слова сравнивается с
       Math.max(el.clientWidth, rect.width), потому что у строчных элементов
       clientWidth всегда равен нулю;
     • проверяет, что текст не уходит под нижнее меню и под шапку;
     • ищет NaN / undefined / Infinity / [object Object] в видимом тексте;
     • проверяет, что с экрана есть выход;
     • собирает ошибки JS.

   Отдельно проверяет честность интерфейса: на экранах не должно остаться
   «команда OKO приступила», «готовность 4–6 часов», выдуманной ссылки
   okoteam.top/s/, статуса «подключено» у соцсетей, эмодзи и выдуманных
   кейсов вида «+438%» и «47 клиентах».

   Запуск:
     node oko-app/tools/probe-system2.mjs
   ============================================================================ */

import { chromium } from 'playwright-core';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.resolve(__dirname, 'system2-out');
/* Свой порт: общий 8199 в этой волне делят несколько пробников сразу. */
const BASE = process.env.OKO_BASE || 'http://127.0.0.1:8221';
const EXEC = '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';

const VIEWPORTS = [
  { id: 'phone',   w: 390,  h: 844  },
  { id: 'narrow',  w: 360,  h: 740  },
  { id: 'desktop', w: 1440, h: 900  }
];

fs.mkdirSync(OUT, { recursive: true });

/* ------------------------------------------------------------------------- */
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
  }catch(e){}
`;

/* ------------------------------------------------------------------------- */
const DETECT = `(() => {
  const out = { overflowX:0, wideEls:[], clipped:[], midWord:[], underNav:[], badNum:[], blocked:[], noExit:false };
  const doc = document.documentElement;
  out.overflowX = Math.max(0, doc.scrollWidth - doc.clientWidth);
  const vw = doc.clientWidth;

  const inView = el => { const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0; };
  const label = el => {
    const t = (el.textContent||'').trim().replace(/\\s+/g,' ').slice(0,60);
    return el.tagName.toLowerCase() + (el.id?'#'+el.id:'')
      + (el.className && typeof el.className==='string' ? '.'+el.className.trim().split(/\\s+/).slice(0,2).join('.') : '')
      + (t?' « '+t+' »':'');
  };

  /* Область проверки — открытая модалка плана, иначе открытый мини-апп.
     Весь #screen-mini брать нельзя: в нём висят скрытые биржа и помощник
     с десятками тысяч узлов. */
  const modal = document.getElementById('sysBlockModal') || document.getElementById('sysDayModal');
  const sv = document.getElementById('systemView');
  const scope = modal
    || (sv && sv.classList.contains('open') ? sv : null)
    || Array.from(document.querySelectorAll('.ma-view')).find(v => v.style.display !== 'none' && v.offsetParent !== null)
    || (document.getElementById('maGrid') && document.getElementById('maGrid').style.display !== 'none' ? document.getElementById('maGrid') : null)
    || document.body;

  const els = Array.from(scope.querySelectorAll('*')).filter(inView).slice(0, 4000);

  const wordCache = new Map();
  const measureWord = (word, font) => {
    const key = font + '|' + word;
    if(wordCache.has(key)) return wordCache.get(key);
    const probe = document.createElement('span');
    probe.textContent = word;
    probe.style.cssText = 'position:absolute;left:-9999px;top:0;white-space:pre;';
    probe.style.font = font;
    document.body.appendChild(probe);
    const w = probe.getBoundingClientRect().width;
    probe.remove();
    wordCache.set(key, w);
    return w;
  };

  /* Широкая таблица, лежащая внутри своего контейнера с overflow-x:auto —
     это разрешённый способ показать её на узком экране, а не переполнение
     страницы. Такие элементы из проверки исключаем. */
  const inScroller = el => {
    let p = el.parentElement;
    while(p && p !== document.body){
      const o = getComputedStyle(p).overflowX;
      if(o === 'auto' || o === 'scroll') return true;
      p = p.parentElement;
    }
    return false;
  };

  for(const el of els){
    const r = el.getBoundingClientRect();
    const cs = getComputedStyle(el);

    if(r.right > vw + 1.5 || r.left < -1.5){
      if(cs.position !== 'fixed' && cs.overflowX !== 'auto' && cs.overflowX !== 'scroll' && !inScroller(el)){
        out.wideEls.push({ el: label(el), right: Math.round(r.right), left: Math.round(r.left), vw });
      }
    }

    const ov = cs.overflowX + ' ' + cs.overflowY;
    if(el.children.length === 0 && (el.textContent||'').trim()){
      const clipW = el.scrollWidth - el.clientWidth;
      const clipH = el.scrollHeight - el.clientHeight;
      const hidden = ov.includes('hidden') || ov.includes('clip');
      const ellips = cs.textOverflow === 'ellipsis' || cs.webkitLineClamp !== 'none';
      if(hidden && !ellips && (clipW > 2 || clipH > 2)){
        out.clipped.push({ el: label(el), clipW, clipH });
      }
    }

    /* Перенос посреди слова. Проблема — только жёсткий break-all вне
       .oko-breakable: overflow-wrap:break-word ломает слово лишь когда оно
       физически не влезает, это допустимо. */
    if(el.children.length === 0){
      const txt = (el.textContent||'').trim();
      if(txt && !el.classList.contains('oko-breakable') && !el.closest('.oko-breakable')){
        if(cs.wordBreak === 'break-all'){
          const box = Math.max(el.clientWidth, r.width);
          const longest = txt.split(/\\s+/).reduce((a,b)=> b.length>a.length?b:a, '');
          const font = cs.font || (cs.fontWeight+' '+cs.fontSize+'/'+cs.lineHeight+' '+cs.fontFamily);
          const wordW = measureWord(longest, font);
          if(wordW > 0 && box > 0 && wordW <= box - 2){
            out.midWord.push({ el: label(el), word: longest, wordW: Math.round(wordW), box: Math.round(box) });
          }
        }
      }
    }
  }

  /* Контент под нижним меню: страница уже прокручена вниз. */
  const nav = document.querySelector('.tabbar, #tabbar, .bottom-nav, nav.tabs');
  if(nav && !modal && !(sv && sv.classList.contains('open'))){
    const nr = nav.getBoundingClientRect();
    if(nr.height > 0 && nr.top < window.innerHeight){
      const leafs = els.filter(el => !el.children.length && (el.textContent||'').trim()
        && getComputedStyle(el).position !== 'fixed' && !nav.contains(el));
      let last = null, lastB = -1e9;
      for(const el of leafs){
        const r = el.getBoundingClientRect();
        if(r.bottom > lastB){ lastB = r.bottom; last = el; }
      }
      if(last && lastB > nr.top + 4 && lastB < window.innerHeight + 4){
        out.underNav.push({ el: label(last), bottom: Math.round(lastB), navTop: Math.round(nr.top) });
      }
    }
  }

  /* Кнопка перекрыта своим же содержимым экрана. */
  for(const el of els){
    if(!(el.tagName === 'BUTTON' || el.getAttribute('role') === 'button')) continue;
    const r = el.getBoundingClientRect();
    if(r.width < 8 || r.height < 8) continue;
    if(r.top < 0 || r.bottom > window.innerHeight) continue;
    const cx = Math.round(r.left + r.width / 2), cy = Math.round(r.top + r.height / 2);
    const top = document.elementFromPoint(cx, cy);
    if(!top || top === el || el.contains(top) || top.contains(el) || !scope.contains(top)) continue;
    /* Проверка идёт при прокрутке в самый низ, поэтому верхние кнопки
       законно уезжают под шапку окна, а нижние — под панель действий.
       Настоящее наползание шапки на контент ловит отдельная проверка
       HEADCHECK при прокрутке в самый верх. */
    const chrome = top.closest('.sv-head, .topbar, header, .sys-day-head, .sys-day-foot, .tabbar');
    if(chrome) continue;
    out.blocked.push({ el: label(el), by: label(top) });
  }

  const vis = (scope.innerText || '');
  const m = vis.match(/\\bNaN\\b|\\bundefined\\b|\\bInfinity\\b|\\[object Object\\]/g);
  if(m) out.badNum = Array.from(new Set(m));

  /* Выход с экрана: у мини-аппа кнопка «назад», у модалок — своя. */
  if(modal){
    out.noExit = !modal.querySelector('.sys-day-close, [aria-label="Закрыть"]');
  } else if(sv && sv.classList.contains('open')){
    out.noExit = !sv.querySelector('.ep-cancel, .sv-back');
  } else {
    const view = Array.from(document.querySelectorAll('.ma-view')).find(v => v.style.display !== 'none' && v.offsetParent !== null);
    if(view) out.noExit = !view.querySelector('button[onclick*="closeMa"], .sv-back');
  }

  const dedup = a => { const s = new Set(), r = []; for(const x of a){ const k = JSON.stringify(x); if(!s.has(k)){ s.add(k); r.push(x); } } return r; };
  out.wideEls  = dedup(out.wideEls).slice(0, 12);
  out.clipped  = dedup(out.clipped).slice(0, 12);
  out.midWord  = dedup(out.midWord).slice(0, 12);
  out.underNav = dedup(out.underNav).slice(0, 12);
  out.blocked  = dedup(out.blocked).slice(0, 12);
  return out;
})()`;

/* Честность интерфейса: остатки фальшивых обещаний и выдуманных данных. */
const HONEST = `(() => {
  const modal = document.getElementById('sysBlockModal') || document.getElementById('sysDayModal');
  const sv = document.getElementById('systemView');
  const scope = modal || (sv && sv.classList.contains('open') ? sv : null)
    || Array.from(document.querySelectorAll('.ma-view')).find(v => v.style.display !== 'none' && v.offsetParent !== null)
    || document.querySelector('#screen-mini') || document.body;
  /* «Не подключено», «не подключена», «не подключено к площадкам» — честные
     формулировки. Убираем их перед проверкой, иначе бан «подключено» ловит
     собственную правду. innerText отдаёт текст уже с учётом text-transform,
     поэтому сравнение регистронезависимое. */
  const txt = (scope.innerText || '').replace(/не\\s+подключен[аоыё]?/gi, '');
  const bans = [
    'команда OKO приступила',
    'Готовность: 4',
    '4–6 часов',
    '4-6 часов',
    'Аналитик изучает',
    'Копирайтер пишет',
    'okoteam.top/s/',
    'Скачать PDF',
    'подключено',
    'привязан',
    'Автопостинг: ВКЛ',
    'активируется 1 августа',
    'Ключи храним зашифрованными',
    '+438',
    '47 клиентах',
    '250 000 ₽ за 21 день',
    '372 500',
    '870 000',
    'Проверено на',
    'мы проанализировали'
  ];
  const hits = bans.filter(b => txt.indexOf(b) >= 0);
  /* эмодзи в интерфейсе запрещены */
  const emo = txt.match(/[\\u{1F300}-\\u{1FAFF}\\u{2600}-\\u{27BF}\\u{FE0F}\\u{20E3}]/gu);
  if(emo) hits.push('эмодзи: ' + Array.from(new Set(emo)).slice(0,6).join(' '));
  return hits;
})()`;

const DROP_NUDGE = `(() => {
  var n = 0;
  document.querySelectorAll('.okg-scrim').forEach(function(e){ e.remove(); n++; });
  document.querySelectorAll('.okg-toast, .okg-bubble').forEach(function(e){ e.remove(); });
  return n;
})()`;

const HEADCHECK = `(() => {
  const modal = document.getElementById('sysBlockModal') || document.getElementById('sysDayModal');
  if(modal) return null;                    /* у модалок своя шапка */
  const sv = document.getElementById('systemView');
  const scope = (sv && sv.classList.contains('open')) ? sv
    : (Array.from(document.querySelectorAll('.ma-view')).find(v => v.style.display !== 'none' && v.offsetParent !== null)
       || document.getElementById('maGrid'));
  if(!scope) return null;
  const head = (sv && sv.classList.contains('open'))
    ? scope.querySelector('.sv-head')
    : (document.querySelector('.topbar') || document.querySelector('header'));
  if(!head) return null;
  const hr = head.getBoundingClientRect();
  if(hr.height <= 0 || getComputedStyle(head).display === 'none') return null;
  const leafs = Array.from(scope.querySelectorAll('*')).filter(el => {
    if(el.children.length) return false;
    if(!(el.textContent || '').trim()) return false;
    if(head.contains(el)) return false;
    const r = el.getBoundingClientRect();
    return r.width > 0 && r.height > 0 && r.top > -200 && r.top < window.innerHeight;
  });
  let worst = null;
  for(const el of leafs){
    const r = el.getBoundingClientRect();
    if(r.top < hr.bottom - 2 && r.bottom > hr.top + 2){
      if(!worst || r.top < worst.top){
        worst = { top: Math.round(r.top), headBottom: Math.round(hr.bottom),
                  el: el.tagName.toLowerCase() + ' « ' + (el.textContent || '').trim().slice(0, 40) + ' »' };
      }
    }
  }
  return worst;
})()`;

const SETTLE = `(async () => {
  const finite = () => {
    if(!document.getAnimations) return [];
    return document.getAnimations().filter(a => {
      if(a.playState !== 'running') return false;
      try{
        const t = a.effect && a.effect.getTiming ? a.effect.getTiming() : null;
        if(t && (t.iterations === Infinity || t.iterations > 100)) return false;
      }catch(e){}
      return true;
    });
  };
  const t0 = Date.now();
  while(Date.now() - t0 < 2500){
    if(!finite().length) break;
    await new Promise(r => setTimeout(r, 80));
  }
  await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
  return true;
})()`;

/* ------------------------------------------------------------------------- */
async function runViewport(browser, vp, theme){
  const ctx = await browser.newContext({
    viewport: { width: vp.w, height: vp.h },
    deviceScaleFactor: 1,
    hasTouch: vp.w < 900
  });
  await ctx.addInitScript(INIT);
  const page = await ctx.newPage();

  const errors = [], netNoise = [];
  const isNet = t => /Failed to load resource|ERR_CONNECTION|ERR_NAME_NOT|net::/i.test(t);
  page.on('pageerror', e => errors.push(String(e && e.message || e)));
  page.on('console', m => {
    if(m.type() !== 'error') return;
    const t = m.text();
    (isNet(t) ? netNoise : errors).push('console: ' + t);
  });

  let opened = false;
  for(let attempt = 0; attempt < 3 && !opened; attempt++){
    try{
      await page.goto(BASE + '/index.html', { waitUntil: 'domcontentloaded', timeout: 45000 });
      opened = true;
    }catch(e){
      if(attempt === 2) throw e;
      await page.waitForTimeout(2000);
    }
  }
  await page.waitForTimeout(2200);
  await page.evaluate(`okoSkipAuth()`);
  await page.evaluate(t => { try{ document.documentElement.setAttribute('data-theme', t); }catch(e){} }, theme);
  await page.waitForTimeout(300);

  const steps = [];
  const facts = {};

  const tap = async (sel, optional) => {
    await page.evaluate(DROP_NUDGE);
    const hit = await page.evaluate(s => {
      const n = document.querySelector(s);
      if(!n) return false;
      n.scrollIntoView({ block: 'center' });
      n.click();
      return true;
    }, sel);
    if(!hit && !optional) steps.push({ step: 'click ' + sel, problems: ['элемент не найден'] });
    await page.waitForTimeout(160);
    return hit;
  };
  /* клик по кнопке с точным текстом внутри области */
  const tapText = async (scopeSel, text, optional) => {
    await page.evaluate(DROP_NUDGE);
    const hit = await page.evaluate(([s, t]) => {
      const root = document.querySelector(s) || document;
      const btns = Array.from(root.querySelectorAll('button'));
      const n = btns.find(b => (b.textContent || '').trim().indexOf(t) >= 0
        && b.getBoundingClientRect().width > 0);
      if(!n) return false;
      n.scrollIntoView({ block: 'center' });
      n.click();
      return true;
    }, [scopeSel, text]);
    if(!hit && !optional) steps.push({ step: 'click «' + text + '»', problems: ['кнопка не найдена'] });
    await page.waitForTimeout(180);
    return hit;
  };
  const fill = async (sel, val) => {
    await page.evaluate(DROP_NUDGE);
    return page.evaluate(([s, v]) => {
      const n = document.querySelector(s);
      if(!n) return false;
      n.value = v;
      n.dispatchEvent(new Event('input', { bubbles: true }));
      return true;
    }, [sel, val]);
  };

  const shot = async (name) => {
    const f = path.join(OUT, `${vp.id}-${theme}-${name}.png`);
    try{ await page.screenshot({ path: f, timeout: 15000 }); }catch(e){}
  };

  const scrollTopOfScreen = async () => {
    await page.evaluate(`(function(){
      var m = document.getElementById('sysBlockModal') || document.getElementById('sysDayModal');
      if(m){ var c = m.querySelector('.sys-day-content'); if(c) c.scrollTop = 0; return; }
      var sv = document.getElementById('systemView');
      if(sv && sv.classList.contains('open')){ var b = sv.querySelector('.sv-body'); if(b) b.scrollTop = 0; return; }
      var v = Array.from(document.querySelectorAll('.screen')).find(function(s){
        return s.offsetParent !== null && getComputedStyle(s).display !== 'none';
      }) || document.scrollingElement;
      var t = v;
      while(t && t.scrollHeight <= t.clientHeight + 2 && t !== document.scrollingElement){ t = t.parentElement; }
      if(t) t.scrollTop = 0;
      window.scrollTo(0, 0);
    })()`);
    await page.waitForTimeout(220);
  };
  const scrollBottom = async () => {
    await page.evaluate(`(function(){
      var m = document.getElementById('sysBlockModal') || document.getElementById('sysDayModal');
      if(m){ var c = m.querySelector('.sys-day-content'); if(c) c.scrollTop = c.scrollHeight; return; }
      var sv = document.getElementById('systemView');
      if(sv && sv.classList.contains('open')){ var b = sv.querySelector('.sv-body'); if(b) b.scrollTop = b.scrollHeight; return; }
      var v = Array.from(document.querySelectorAll('.screen')).find(function(s){
        return s.offsetParent !== null && getComputedStyle(s).display !== 'none';
      }) || document.scrollingElement;
      var t = v;
      while(t && t.scrollHeight <= t.clientHeight + 2 && t !== document.scrollingElement){ t = t.parentElement; }
      if(t) t.scrollTop = t.scrollHeight;
      window.scrollTo(0, document.body.scrollHeight);
    })()`);
    await page.waitForTimeout(220);
  };

  const check = async (name) => {
    await page.evaluate(`(function(){
      document.querySelectorAll('#okoPopup, .okg-scrim').forEach(function(n){ n.remove(); });
    })()`);
    await page.evaluate(DROP_NUDGE);
    await page.evaluate(SETTLE);
    await scrollTopOfScreen();
    const headHit = await page.evaluate(HEADCHECK);
    await shot(name);
    await scrollBottom();
    await page.evaluate(SETTLE);
    const d = await page.evaluate(DETECT);
    if(headHit) d.underNav.push(Object.assign({ underHeader: true }, headHit));
    const honest = await page.evaluate(HONEST);
    const problems = [];
    if(d.overflowX > 1) problems.push(`горизонтальное переполнение ${d.overflowX}px`);
    if(d.wideEls.length) problems.push(`элементов за краем: ${d.wideEls.length}`);
    if(d.clipped.length) problems.push(`обрезанный текст без многоточия: ${d.clipped.length}`);
    if(d.midWord.length) problems.push(`перенос посреди слова: ${d.midWord.length}`);
    if(d.underNav.length) problems.push(`текст под меню или шапкой: ${d.underNav.length}`);
    if(d.badNum.length) problems.push(`мусорные значения: ${d.badNum.join(', ')}`);
    if(d.blocked.length) problems.push(`кнопка перекрыта другим элементом: ${d.blocked.length}`);
    if(d.noExit) problems.push('нет кнопки выхода с экрана');
    if(honest.length) problems.push(`фальшивые формулировки: ${honest.join(' | ')}`);
    steps.push({ step: name, problems, detail: problems.length ? d : undefined });
    if(process.env.OKO_VERBOSE) console.log('   ·', name, problems.length ? 'ЗАМЕЧАНИЯ' : 'чисто');
    return problems;
  };

  /* ================= СИСТЕМА РОСТА ================= */
  await page.evaluate(`showTab('mini'); openMa('system');`);
  await page.waitForTimeout(500);
  await check('sys-01-pick');

  /* быстрая анкета целиком, с настоящими ответами */
  await tapText('#ma-system', 'Быстрая');
  await page.waitForTimeout(300);
  await check('sys-02-q1');

  /* проверка валидации: жмём «Далее» на обязательном вопросе без ответа */
  await tapText('#ma-system', 'Далее');
  await page.waitForTimeout(250);
  facts.validationShown = await page.evaluate(`(function(){
    var e = document.getElementById('aErr');
    return !!(e && !e.hidden && (e.textContent||'').trim().length > 0);
  })()`);
  await check('sys-03-validation');

  /* Проходим быструю анкету до конца. Тип поля определяем на лету. */
  const ANSWERS = {
    who: 0,
    niche: 'ремонт квартир под ключ',
    products: 'Ремонт под ключ от 900 000 ₽. Дизайн-проект 90 000 ₽.',
    audience: 'семьи 30-45 лет, купили квартиру в новостройке',
    goal_income: '1200000',
    budget: 1,
    platforms: [0, 3],
    reels_per_day: 2,
    on_camera: 0,
    competitors: '@remont_msk, @studio_zorina',
    code_words: 'РЕМОНТ',
    avg_check: '900000',
    revenue: '600000'
  };

  let guard = 0;
  let lastQ = '';
  while(guard++ < 60){
    const state = await page.evaluate(`(function(){
      var card = document.getElementById('anketaCard');
      if(!card) return null;
      var q = card.querySelector('.sy2-q');
      if(!q) return { done: true, html: card.innerHTML.slice(0, 80) };
      var inp = card.querySelector('#aInput');
      var opts = card.querySelectorAll('.opt');
      var range = card.querySelector('input[type=range]');
      var count = card.querySelector('.sy2-qcount');
      return {
        done: false,
        q: (q.textContent||'').trim(),
        count: count ? count.textContent.trim() : '',
        type: inp ? (inp.tagName.toLowerCase() === 'textarea' ? 'textarea' : inp.type)
             : (range ? 'range' : (opts.length ? 'opts' : 'none')),
        opts: opts.length,
        multi: !!card.querySelector('.opts-multi')
      };
    })()`);
    if(!state || state.done) break;
    if(state.q === lastQ && guard > 2){ break; }
    lastQ = state.q;

    /* ключ вопроса берём из состояния анкеты */
    const key = await page.evaluate(`(function(){
      try{ return aState.order[aState.step].k; }catch(e){ return ''; }
    })()`);
    const want = ANSWERS[key];

    if(state.type === 'opts'){
      const idxs = Array.isArray(want) ? want : [typeof want === 'number' ? want : 0];
      for(const i of idxs){
        await page.evaluate(i2 => {
          const b = document.querySelectorAll('#anketaCard .opt')[i2];
          if(b) b.click();
        }, i);
        await page.waitForTimeout(90);
      }
    } else if(state.type === 'range'){
      const v = typeof want === 'number' ? want : 1;
      await page.evaluate(v2 => {
        const r = document.querySelector('#anketaCard input[type=range]');
        if(r){ r.value = String(v2); r.dispatchEvent(new Event('input', { bubbles: true })); }
      }, v);
      await page.waitForTimeout(90);
    } else if(state.type === 'none'){
      /* файловый вопрос — пропускаем, он не обязателен */
    } else {
      await fill('#anketaCard #aInput', typeof want === 'string' ? want : (want != null ? String(want) : 'тест'));
      await page.waitForTimeout(90);
    }

    const moved = await tapText('#ma-system', 'Далее', true) || await tapText('#ma-system', 'Собрать план', true);
    if(!moved) break;
    await page.waitForTimeout(220);
  }
  facts.anketaSteps = guard;
  await check('sys-04-finish');

  facts.finishHonest = await page.evaluate(`(function(){
    var t = (document.getElementById('anketaCard')||{}).innerText || '';
    return t.indexOf('Никуда не отправлено') >= 0 || t.indexOf('никуда не отправлено') >= 0;
  })()`);

  /* черновик: возвращаемся в анкету и проверяем, что план есть */
  await tapText('#ma-system', 'Открыть план');
  await page.waitForTimeout(500);
  await check('sys-05-plan-home');

  facts.planNoFakeLink = await page.evaluate(`(function(){
    var t = (document.getElementById('systemBody')||{}).innerText || '';
    return t.indexOf('okoteam.top/s/') < 0;
  })()`);

  /* бизнес-план: карточки и один блок */
  await page.evaluate(`try{ sysGoto('biz'); }catch(e){}`);
  await page.waitForTimeout(400);
  await check('sys-06-biz-list');

  await page.evaluate(`try{ sysBlockOpen('biz', 1); }catch(e){}`);
  await page.waitForTimeout(400);
  await check('sys-07-biz-gap');

  /* Цель 1 200 000 ₽ введена в анкете — она обязана оказаться в блоке
     «Цель и разрыв». Если её там нет, значит блок не из ответов. */
  facts.gapFromAnswers = await page.evaluate(`(function(){
    var m = document.getElementById('sysBlockModal');
    /* разряды в суммах разделены неразрывным пробелом — нормализуем */
    var t = (m ? m.innerText : '').replace(/\\u00a0/g, ' ');
    return t.indexOf('1 200 000') >= 0;
  })()`);

  /* выход из модалки по Escape */
  await page.keyboard.press('Escape');
  await page.waitForTimeout(300);
  facts.escapeClosesBlock = await page.evaluate(`!document.getElementById('sysBlockModal')`);

  /* перспективы */
  await page.evaluate(`try{ sysGoto('future'); }catch(e){}`);
  await page.waitForTimeout(400);
  await check('sys-08-future');

  await page.evaluate(`try{ sysBlockOpen('future', 0); }catch(e){}`);
  await page.waitForTimeout(400);
  await check('sys-09-future-block');
  await page.keyboard.press('Escape');
  await page.waitForTimeout(250);

  /* контент-план и модалка дня */
  await page.evaluate(`try{ sysGoto('plan'); }catch(e){}`);
  await page.waitForTimeout(400);
  await check('sys-10-plan-cal');

  await page.evaluate(`try{ sysDayOpen(1); }catch(e){}`);
  await page.waitForTimeout(450);
  await check('sys-11-day');
  await page.keyboard.press('Escape');
  await page.waitForTimeout(250);
  facts.escapeClosesDay = await page.evaluate(`!document.getElementById('sysDayModal')`);

  /* закрыть план */
  await page.evaluate(`try{ closeSystemView(); }catch(e){}`);
  await page.waitForTimeout(300);

  /* черновик: начать полную анкету, ответить, выйти и вернуться */
  await page.evaluate(`try{ sys2Restart(); }catch(e){}`);
  await page.waitForTimeout(300);
  await tapText('#ma-system', 'Полная');
  await page.waitForTimeout(300);
  await page.evaluate(`(function(){
    var i = document.querySelector('#anketaCard #aInput');
    if(i){ i.value = 'проверка черновика'; i.dispatchEvent(new Event('input', {bubbles:true})); }
    var o = document.querySelector('#anketaCard .opt');
    if(o) o.click();
  })()`);
  await page.waitForTimeout(200);
  await tapText('#ma-system', 'Далее', true);
  await page.waitForTimeout(250);
  await tapText('#ma-system', 'Сохранить черновик и выйти', true);
  await page.waitForTimeout(350);
  await page.evaluate(`showTab('mini'); openMa('system');`);
  await page.waitForTimeout(400);
  facts.draftOffered = await page.evaluate(`(function(){
    var t = (document.getElementById('anketaCard')||{}).innerText || '';
    return t.indexOf('черновик') >= 0 || t.indexOf('Черновик') >= 0;
  })()`);
  await check('sys-12-draft');

  await tapText('#ma-system', 'Продолжить', true);
  await page.waitForTimeout(350);
  facts.draftRestored = await page.evaluate(`(function(){
    try{ return !!(aState && aState.answers && Object.keys(aState.answers).length > 0); }catch(e){ return false; }
  })()`);
  await check('sys-13-draft-resumed');

  /* выход из мини-аппа */
  await page.evaluate(`try{ closeMa(); }catch(e){}`);
  await page.waitForTimeout(300);

  /* ================= МОИ СОЦСЕТИ ================= */
  await page.evaluate(`showTab('mini'); openMa('socials');`);
  await page.waitForTimeout(500);
  await check('soc-01-main');

  /* Ни одна карточка не должна утверждать, что площадка подключена.
     innerText учитывает text-transform, поэтому сравниваем в нижнем регистре. */
  facts.socNoConnected = await page.evaluate(`(function(){
    var t = ((document.getElementById('socialsRoot')||{}).innerText || '').toLowerCase();
    var hasHonest = t.indexOf('не подключено') >= 0;
    var rest = t.replace(/не\\s+подключен[аоыё]?/g, '');
    return hasHonest && rest.indexOf('подключено') < 0;
  })()`);
  facts.socCardsCount = await page.evaluate(`document.querySelectorAll('#socialsRoot .sy2-card').length`);
  facts.socHasNeeds = await page.evaluate(`document.querySelectorAll('#socialsRoot .sy2-kv').length`);

  /* Сохранение ссылки — реальное действие. Кнопку жмём ту, что стоит рядом
     с нужным полем: кнопок «Сохранить» на экране пять, по одной на сеть. */
  const saveLink = async (k) => {
    await page.evaluate(DROP_NUDGE);
    return page.evaluate(key => {
      const inp = document.getElementById('sy2Link_' + key);
      if(!inp) return false;
      const row = inp.closest('.sy2-link-row');
      const btn = row && row.querySelector('button');
      if(!btn) return false;
      btn.scrollIntoView({ block: 'center' });
      btn.click();
      return true;
    }, k);
  };

  await fill('#sy2Link_ig', 'instagram.com/oko.test.profile');
  await page.waitForTimeout(150);
  facts.saveClicked = await saveLink('ig');
  await page.waitForTimeout(350);
  await check('soc-02-link-saved');

  facts.linkStored = await page.evaluate(`(function(){
    try{
      var s = JSON.parse(localStorage.getItem('oko-socials2')||'{}');
      return !!(s.links && s.links.ig && s.links.ig.indexOf('instagram.com') >= 0);
    }catch(e){ return false; }
  })()`);
  facts.linkInVisitka = await page.evaluate(`(function(){
    try{
      var s = JSON.parse(localStorage.getItem('oko-ps-socials')||'{}');
      return Array.isArray(s.links) && s.links.some(function(l){ return l && l.id === 'sy2-ig'; });
    }catch(e){ return false; }
  })()`);

  /* мусорная ссылка не сохраняется */
  await fill('#sy2Link_yt', 'не ссылка вовсе');
  await page.waitForTimeout(120);
  await saveLink('yt');
  await page.waitForTimeout(300);
  facts.badLinkRejected = await page.evaluate(`(function(){
    try{
      var s = JSON.parse(localStorage.getItem('oko-socials2')||'{}');
      return !(s.links && s.links.yt);
    }catch(e){ return true; }
  })()`);
  await check('soc-03-bad-link');

  /* удаление ссылки */
  await page.evaluate(`try{ sys2LinkDrop('ig'); }catch(e){}`);
  await page.waitForTimeout(300);
  facts.linkRemoved = await page.evaluate(`(function(){
    try{
      var s = JSON.parse(localStorage.getItem('oko-socials2')||'{}');
      return !(s.links && s.links.ig);
    }catch(e){ return true; }
  })()`);
  await check('soc-04-link-removed');

  /* второй вход в «Мои соцсети» из профиля ведёт на честный экран */
  await page.evaluate(`try{ psSocOpen(); }catch(e){}`);
  await page.waitForTimeout(450);
  facts.psSocRedirected = await page.evaluate(`(function(){
    var v = document.getElementById('ma-socials');
    var old = document.getElementById('psSocView');
    var oldOpen = !!(old && old.classList.contains('open'));
    return !!(v && v.style.display === 'block') && !oldOpen;
  })()`);
  await check('soc-05-from-profile');

  /* выход */
  await page.evaluate(`try{ closeMa(); }catch(e){}`);
  await page.waitForTimeout(250);

  await ctx.close();
  return {
    viewport: vp.id, theme, steps, facts,
    errors: Array.from(new Set(errors)),
    netNoise: Array.from(new Set(netNoise))
  };
}

/* ------------------------------------------------------------------------- */
(async () => {
  const browser = await chromium.launch({ executablePath: EXEC, args: ['--no-sandbox'] });
  const report = { base: BASE, at: new Date().toISOString(), runs: [] };

  for(const vp of VIEWPORTS){
    for(const theme of (vp.id === 'phone' ? ['dark', 'light'] : ['dark'])){
      const r = await runViewport(browser, vp, theme);
      report.runs.push(r);
      const bad = r.steps.filter(s => s.problems.length);
      console.log(`[${vp.id}/${theme}] шагов ${r.steps.length}, с замечаниями ${bad.length}, ошибок JS ${r.errors.length}`);
      bad.forEach(s => console.log('   -', s.step, '→', s.problems.join('; ')));
      r.errors.forEach(e => console.log('   JS:', e));
    }
  }

  await browser.close();

  const totals = report.runs.reduce((a, r) => {
    a.steps += r.steps.length;
    a.problemSteps += r.steps.filter(s => s.problems.length).length;
    a.problems += r.steps.reduce((n, s) => n + s.problems.length, 0);
    a.jsErrors += r.errors.length;
    return a;
  }, { steps: 0, problemSteps: 0, problems: 0, jsErrors: 0 });
  report.totals = totals;
  report.clean = totals.problems === 0 && totals.jsErrors === 0;

  fs.writeFileSync(path.join(OUT, 'report.json'), JSON.stringify(report, null, 2));
  console.log('\n' + JSON.stringify({
    totals, clean: report.clean,
    facts: report.runs.map(r => ({ vp: r.viewport + '/' + r.theme, ...r.facts }))
  }, null, 2));
  console.log('отчёт:', path.join(OUT, 'report.json'));
})();
