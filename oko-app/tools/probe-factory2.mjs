/* ============================================================================
   probe-factory2.mjs — пробник слоя oko-factory2.js
   ----------------------------------------------------------------------------
   Проверяет два мини-аппа: КОНТЕНТ-ЗАВОД (openMa('factory')) и
   ПРОВЕРКА ВИДЕО (openMa('video')).

   Что делает на каждом шаге каждого сценария:
     • ждёт окончания всех анимаций (иначе ловится промежуточная геометрия);
     • ищет горизонтальное переполнение страницы и отдельных элементов;
     • ищет обрезанный текст без многоточия;
     • ищет переносы посреди слова (ширину слова сравнивает с
       Math.max(el.clientWidth, rect.width) — у строчных clientWidth всегда 0);
     • проверяет, что контент не заезжает под нижнее меню и под шапку;
     • ищет NaN / undefined / Infinity в видимом тексте;
     • собирает ошибки JS и заваленные запросы.

   Отдельно проверяет честность: на экранах не должно остаться фальшивых
   стадий «Опубликовано», «В эфире», зашитых баллов виральности и
   «вероятности рекомендаций».

   Запуск:
     node oko-app/tools/probe-factory2.mjs
   ============================================================================ */

import { chromium } from 'playwright-core';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROTO = path.resolve(__dirname, '..', 'prototype');
const OUT = path.resolve(__dirname, 'factory2-out');
/* Свой порт: общий 8199 в этой сессии делят несколько пробников сразу,
   и одиночный python-сервер начинает рвать соединения. */
const BASE = process.env.OKO_BASE || 'http://127.0.0.1:8213';
const EXEC = '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
/* настоящий видеофайл из репозитория — им кормим проверку видео */
const SAMPLE = path.join(PROTO, 'media', 'paywall', 'paywallVid.webm');

const VIEWPORTS = [
  { id: 'phone',   w: 390,  h: 844  },
  { id: 'narrow',  w: 360,  h: 740  },
  { id: 'desktop', w: 1440, h: 900  }
];

fs.mkdirSync(OUT, { recursive: true });

/* -------------------------------------------------------------------------
   Скрипт инициализации: пропуск авторизации (как в audit.mjs)
   ------------------------------------------------------------------------- */
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

/* -------------------------------------------------------------------------
   Детектор вёрсточных проблем — выполняется в странице
   ------------------------------------------------------------------------- */
const DETECT = `(() => {
  const out = { overflowX:0, wideEls:[], clipped:[], midWord:[], underNav:[], badNum:[], blocked:[], noExit:false };
  const doc = document.documentElement;

  /* 1. горизонтальное переполнение страницы */
  out.overflowX = Math.max(0, doc.scrollWidth - doc.clientWidth);

  const vw = doc.clientWidth;
  /* Смотрим весь видимый контент экрана, а не только текущий кадр: длинные
     страницы иначе проверяются только сверху. */
  const inView = el => {
    const r = el.getBoundingClientRect();
    return r.width > 0 && r.height > 0;
  };
  const label = el => {
    const t = (el.textContent||'').trim().replace(/\\s+/g,' ').slice(0,60);
    return el.tagName.toLowerCase() + (el.id?'#'+el.id:'') + (el.className && typeof el.className==='string' ? '.'+el.className.trim().split(/\\s+/).slice(0,2).join('.') : '') + (t?' « '+t+' »':'');
  };

  /* Область проверки — только ОТКРЫТЫЙ мини-апп (или сетка сервисов).
     Брать весь #screen-mini нельзя: в нём висят скрытые биржа, анкета и
     помощник с десятками тысяч узлов, и обход занимает минуты. */
  const scope = Array.from(document.querySelectorAll('.ma-view')).find(v => v.style.display !== 'none' && v.offsetParent !== null)
             || (document.getElementById('maGrid') && document.getElementById('maGrid').style.display !== 'none' ? document.getElementById('maGrid') : null)
             || document.querySelector('#screen-mini')
             || document.body;
  const els = Array.from(scope.querySelectorAll('*')).filter(inView).slice(0, 4000);

  /* измеритель ширины слова с кэшем: без него каждый замер — новый reflow */
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

  for(const el of els){
    const r = el.getBoundingClientRect();
    const cs = getComputedStyle(el);

    /* 2. элемент вылезает за правый край окна */
    if(r.right > vw + 1.5 || r.left < -1.5){
      if(cs.position !== 'fixed' && cs.overflowX !== 'auto' && cs.overflowX !== 'scroll'){
        out.wideEls.push({ el: label(el), right: Math.round(r.right), left: Math.round(r.left), vw });
      }
    }

    /* 3. обрезанный текст без многоточия */
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

    /* 4. перенос посреди слова.
       У строчных элементов clientWidth === 0 — берём максимум из clientWidth
       и ширины прямоугольника, иначе детектор врёт сотнями срабатываний. */
    if(el.children.length === 0){
      const txt = (el.textContent||'').trim();
      if(txt && !el.classList.contains('oko-breakable') && !el.closest('.oko-breakable')){
        const wb = cs.wordBreak;
        /* Проблема — только жёсткий break-all вне .oko-breakable: он рвёт
           обычные слова. overflow-wrap:break-word ломает слово лишь когда
           оно физически не влезает, это допустимо. */
        if(wb === 'break-all'){
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

  /* 5. контент под нижним меню и под шапкой.
     Проверяем корректно: страница уже прокручена в самый низ, поэтому если
     последний блок контента всё ещё уходит под панель — это настоящая
     ошибка, а не «просто ниже сгиба». */
  const nav = document.querySelector('.tabbar, #tabbar, .bottom-nav, nav.tabs');
  if(nav){
    const nr = nav.getBoundingClientRect();
    if(nr.height > 0 && nr.top < window.innerHeight){
      const leafs = els.filter(el => !el.children.length && (el.textContent||'').trim()
        && getComputedStyle(el).position !== 'fixed'
        && !nav.contains(el));
      /* самый нижний по документу видимый кусок текста */
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
  /* 6. кнопка перекрыта чем-то сверху: в точке её центра лежит чужой элемент.
     Это ловит и «панель осталась в кадре», и наезжающие плашки. */
  for(const el of els){
    if(!(el.tagName === 'BUTTON' || el.getAttribute('role') === 'button')) continue;
    const r = el.getBoundingClientRect();
    if(r.width < 8 || r.height < 8) continue;
    if(r.top < 0 || r.bottom > window.innerHeight) continue;   /* вне кадра — проверять нечего */
    const cx = Math.round(r.left + r.width / 2), cy = Math.round(r.top + r.height / 2);
    const top = document.elementFromPoint(cx, cy);
    /* Считаем проблемой только перекрытие СВОИМ же содержимым экрана.
       Тосты, подсказки удержания и модалки живут вне мини-аппа, всплывают
       на секунду и гаснут — записывать их в вёрсточные ошибки нечестно. */
    if(top && top !== el && !el.contains(top) && !top.contains(el) && scope.contains(top)){
      out.blocked.push({ el: label(el), by: label(top) });
    }
  }

  /* 7. мусорные числа в видимом тексте */
  const vis = (scope.innerText || '');
  const m = vis.match(/\\bNaN\\b|\\bundefined\\b|\\bInfinity\\b|\\[object Object\\]/g);
  if(m) out.badNum = Array.from(new Set(m));

  /* 8. есть ли выход с экрана */
  const view = Array.from(document.querySelectorAll('.ma-view')).find(v => v.style.display !== 'none' && v.offsetParent !== null);
  if(view){
    const back = view.querySelector('button[onclick*="closeMa"], [data-fx="back"], .sv-back');
    out.noExit = !back;
  }

  /* дедупликация */
  const dedup = a => { const s = new Set(), r = []; for(const x of a){ const k = JSON.stringify(x); if(!s.has(k)){ s.add(k); r.push(x); } } return r; };
  out.wideEls  = dedup(out.wideEls).slice(0, 12);
  out.clipped  = dedup(out.clipped).slice(0, 12);
  out.midWord  = dedup(out.midWord).slice(0, 12);
  out.underNav = dedup(out.underNav).slice(0, 12);
  out.blocked  = dedup(out.blocked).slice(0, 12);
  return out;
})()`;

/* Проверка честности: остатки фальшивых обещаний на экране */
const HONEST = `(() => {
  const scope = document.querySelector('#screen-mini') || document.body;
  const txt = (scope.innerText || '');
  const bans = [
    'В эфире',
    'вероятность рекомендаций',
    'Вероятность рекомендаций',
    'Исправить одним кликом',
    'готовность 91',
    'фитнес для мам',
    'Ariana',
    'опубликовано:',
    '60-90к',
    '28 000 ₽'
  ];
  const hits = bans.filter(b => txt.includes(b));
  return hits;
})()`;

/* Слой удержания (oko-growth) сам открывает всплывающие окна-подсказки поверх
   любого экрана. Для пробника они шум: снимаем их перед каждым действием. */
const DROP_NUDGE = `(() => {
  var n = 0;
  document.querySelectorAll('.okg-scrim').forEach(function(e){ e.remove(); n++; });
  document.querySelectorAll('.okg-toast, .okg-bubble').forEach(function(e){ e.remove(); });
  return n;
})()`;

/* Ждём окончания анимаций — иначе замеряется промежуточная геометрия.
   Бесконечные анимации (пульс логотипа, свечение кнопок, спиннеры) не
   заканчиваются никогда, их из ожидания исключаем, иначе каждый шаг
   упирается в потолок ожидания и прогон растягивается на десятки минут. */
/* Отдельная проверка шапки: экран прокручен в самый ВЕРХ, и первый видимый
   кусок текста мини-аппа не должен оказаться под шапкой приложения (в
   Telegram она рисуется поверх вебвью). Внизу страницы такую проверку делать
   бессмысленно — там контент законно уезжает под шапку при прокрутке. */
const HEADCHECK = `(() => {
  const scope = Array.from(document.querySelectorAll('.ma-view')).find(v => v.style.display !== 'none' && v.offsetParent !== null)
             || document.getElementById('maGrid');
  if(!scope) return null;
  const head = document.querySelector('.topbar') || document.querySelector('header');
  if(!head) return null;
  const hr = head.getBoundingClientRect();
  if(hr.height <= 0 || getComputedStyle(head).display === 'none') return null;
  const leafs = Array.from(scope.querySelectorAll('*')).filter(el => {
    if(el.children.length) return false;
    if(!(el.textContent || '').trim()) return false;
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

/* -------------------------------------------------------------------------
   Сценарий обхода
   ------------------------------------------------------------------------- */
async function runViewport(browser, vp, theme, report){
  const ctx = await browser.newContext({
    viewport: { width: vp.w, height: vp.h },
    deviceScaleFactor: 1,
    hasTouch: vp.w < 900
  });
  await ctx.addInitScript(INIT);
  const page = await ctx.newPage();

  const errors = [];   /* настоящие ошибки JS */
  const netNoise = []; /* заваленные запросы: к слою отношения не имеют */
  const isNet = t => /Failed to load resource|ERR_CONNECTION|ERR_NAME_NOT|net::/i.test(t);
  page.on('pageerror', e => errors.push(String(e && e.message || e)));
  page.on('console', m => {
    if(m.type() !== 'error') return;
    const t = m.text();
    (isNet(t) ? netNoise : errors).push('console: ' + t);
  });

  /* локальный статик-сервер иногда рвёт соединение под нагрузкой — повторяем */
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
  await page.evaluate(t => {
    try{ document.documentElement.setAttribute('data-theme', t); }catch(e){}
  }, theme);
  await page.waitForTimeout(300);

  const steps = [];

  /* Клик по элементу через DOM, а не по координатам.
     Экраны слоя перерисовываются целиком после каждого действия, и клик по
     координатам после перерисовки попадает в соседнюю кнопку — прогон
     становится случайным. Перекрытие кнопок проверяется отдельно, в
     детекторе (elementFromPoint), поэтому здесь достаточно точного клика. */
  const tap = async (sel, optional) => {
    await page.evaluate(DROP_NUDGE);
    const hit = await page.evaluate(s => {
      const n = document.querySelector(s);
      if(!n) return false;
      n.scrollIntoView({block:'center'});
      n.click();
      return true;
    }, sel);
    if(!hit && !optional) steps.push({ step: 'click ' + sel, problems: ['элемент не найден'] });
    await page.waitForTimeout(120);
    return hit;
  };
  const fill = async (sel, val) => {
    await page.evaluate(DROP_NUDGE);
    await page.evaluate(([s, v]) => {
      const n = document.querySelector(s);
      if(n){ n.value = v; n.dispatchEvent(new Event('input', {bubbles:true})); }
    }, [sel, val]);
  };
  /* раскрыть шаг задачи, если он ещё закрыт (сохранение брифа уже открывает
     следующий шаг само — повторный клик его бы схлопнул) */
  const openStep = async (n) => {
    await page.evaluate(DROP_NUDGE);
    const open = await page.evaluate(i => {
      const b = document.querySelector(`[data-fx="step"][data-n="${i}"]`);
      return !!(b && b.parentElement && b.parentElement.classList.contains('open'));
    }, n);
    if(!open) await tap(`[data-fx="step"][data-n="${n}"]`);
    await page.waitForTimeout(250);
  };

  /* Закрыть модальное окно. Разные слои рисуют его по-разному, поэтому
     пробуем по очереди: кнопка действия popup-а ядра, Escape, и в крайнем
     случае снимаем оверлей руками, чтобы он не мешал следующим шагам. */
  const popupBtn = async (idx) => {
    const i = idx || 0;
    await page.evaluate(n => {
      const p = document.getElementById('okoPopup');
      if(p){
        const byIdx = p.querySelector('[data-pa="' + n + '"]');
        const b = byIdx || p.querySelectorAll('button')[n];
        if(b){ b.click(); return; }
      }
      const any = document.querySelector('[data-pa="' + n + '"]');
      if(any) any.click();
    }, i);
    await page.waitForTimeout(250);
    await page.keyboard.press('Escape').catch(() => {});
    await page.waitForTimeout(200);
    await page.evaluate(`(function(){
      document.querySelectorAll('#okoPopup, .okg-scrim').forEach(function(n){ n.remove(); });
    })()`);
    await page.waitForTimeout(150);
  };

  /* Скриншот кадра, а не всей страницы: fullPage тянет всю высоту документа
     вместе со скрытыми мини-аппами и на этом проекте попросту вешает прогон. */
  const shot = async (name) => {
    const f = path.join(OUT, `${vp.id}-${theme}-${name}.png`);
    try{ await page.screenshot({ path: f, timeout: 15000 }); }catch(e){}
  };

  /* прокрутка активного экрана в самый верх — для проверки шапки */
  const scrollTopOfScreen = async () => {
    await page.evaluate(`(function(){
      var v = Array.from(document.querySelectorAll('.screen')).find(function(s){
        return s.offsetParent !== null && getComputedStyle(s).display !== 'none';
      }) || document.scrollingElement;
      var t = v;
      while(t && t.scrollHeight <= t.clientHeight + 2 && t !== document.scrollingElement){ t = t.parentElement; }
      if(t) t.scrollTop = 0;
      window.scrollTo(0, 0);
    })()`);
    await page.waitForTimeout(250);
  };

  /* прокрутка активного экрана в самый низ — иначе проверка «под нижним меню»
     смотрит на пустоту, а не на последний блок контента */
  const scrollBottom = async () => {
    await page.evaluate(`(function(){
      var v = Array.from(document.querySelectorAll('.screen')).find(function(s){
        return s.offsetParent !== null && getComputedStyle(s).display !== 'none';
      }) || document.scrollingElement;
      var t = v;
      while(t && t.scrollHeight <= t.clientHeight + 2 && t !== document.scrollingElement){ t = t.parentElement; }
      if(t) t.scrollTop = t.scrollHeight;
      window.scrollTo(0, document.body.scrollHeight);
    })()`);
    await page.waitForTimeout(250);
  };

  /* какой мини-апп сейчас обходим — чтобы заметить, если экран закрылся сам */
  let curMa = 'factory';

  const check = async (name, opt) => {
    /* Модалка предыдущего шага не должна тянуться в следующие кадры —
       иначе проверка «кнопка перекрыта» ловит её вместо реальных проблем. */
    if(!(opt && opt.keepPopup)){
      await page.evaluate(`(function(){
        document.querySelectorAll('#okoPopup, .okg-scrim').forEach(function(n){ n.remove(); });
      })()`);
    }
    await page.evaluate(DROP_NUDGE);
    /* Экран мини-аппа не должен закрываться сам между шагами. Если закрылся —
       это замечание, и дальше обход возвращаем на место, иначе все следующие
       шаги проверяют пустоту. */
    const maOk = await page.evaluate(id => {
      const v = document.getElementById('ma-' + id);
      return !!(v && v.style.display !== 'none' && v.offsetParent !== null);
    }, (opt && opt.ma) || curMa);
    if(!maOk){
      await page.evaluate(id => {
        try{ if(typeof showTab === 'function') showTab('mini'); }catch(e){}
        try{ if(typeof openMa === 'function') openMa(id); }catch(e){}
      }, (opt && opt.ma) || curMa);
      await page.waitForTimeout(400);
    }
    await page.evaluate(SETTLE);
    await scrollTopOfScreen();        /* сначала верх: проверяем шапку */
    const headHit = await page.evaluate(HEADCHECK);
    await shot(name);                 /* кадр «как видит человек», сверху экрана */
    await scrollBottom();             /* и только потом проверка низа страницы */
    await page.evaluate(SETTLE);
    const d = await page.evaluate(DETECT);
    if(headHit) d.underNav.push(Object.assign({ underHeader: true }, headHit));
    const honest = await page.evaluate(HONEST);
    const problems = [];
    if(d.overflowX > 1) problems.push(`горизонтальное переполнение ${d.overflowX}px`);
    if(d.wideEls.length) problems.push(`элементов за краем: ${d.wideEls.length}`);
    if(d.clipped.length) problems.push(`обрезанный текст без многоточия: ${d.clipped.length}`);
    if(d.midWord.length) problems.push(`перенос посреди слова: ${d.midWord.length}`);
    if(d.underNav.length) problems.push(`текст под нижним меню: ${d.underNav.length}`);
    if(d.badNum.length) problems.push(`мусорные значения: ${d.badNum.join(', ')}`);
    if(!maOk) problems.push('экран мини-аппа закрылся сам между шагами');
    /* на шагах, где модалка открыта намеренно, она законно перекрывает экран */
    if(d.blocked.length && !(opt && opt.keepPopup)) problems.push(`кнопка перекрыта другим элементом: ${d.blocked.length}`);
    if(d.noExit) problems.push('нет кнопки выхода с экрана');
    if(honest.length) problems.push(`фальшивые формулировки: ${honest.join(' | ')}`);
    steps.push({ step: name, problems, detail: problems.length ? d : undefined, honestHits: honest });
    if(process.env.OKO_VERBOSE) console.log('   ·', name, problems.length ? 'ЗАМЕЧАНИЯ' : 'чисто');
    return problems;
  };

  /* ---------- КОНТЕНТ-ЗАВОД ---------- */
  await page.evaluate(`showTab('mini'); openMa('factory');`);
  await page.waitForTimeout(400);
  await check('fx-01-empty');

  /* новая задача */
  await tap('[data-fx="new"]');
  await page.waitForTimeout(250);
  await check('fx-02-brief');

  /* заполняем бриф по-настоящему */
  await fill('#fx2Title', 'Почему заявки есть, а продаж нет');
  await fill('#fx2Goal', 'записаться на разбор');
  await fill('#fx2Aud', 'мастера, которые ведут запись в тетради');
  await fill('#fx2Cta', 'напиши слово РАЗБОР в личные сообщения');
  await fill('#fx2Avoid', 'без обещаний дохода и без слова гарантия');
  await tap('[data-fx="ch"][data-k="vk"]');
  await page.waitForTimeout(200);
  await tap('[data-fx="tone"][data-k="Экспертный"]');
  await page.waitForTimeout(200);
  await tap('[data-fx="savebrief"]');
  await page.waitForTimeout(350);
  await check('fx-03-brief-saved');

  /* шаг сценария: очередь и ручной текст */
  await openStep(2);
  await check('fx-04-script');

  if(await tap('[data-fx="queue"]', true)){
    await page.waitForTimeout(400);
    await check('fx-05-queued', {keepPopup:true});
    await popupBtn(0);
  }

  await fill('#fx2Script', 'Хук: три причины, почему заявки не превращаются в деньги.\nСуть: разбираем каждую на примере записи в тетради.\nПризыв: напиши слово РАЗБОР.');
  await tap('[data-fx="savescript"]');
  await page.waitForTimeout(350);
  await check('fx-06-script-saved');

  /* производство: ставим все галочки */
  await openStep(3);
  await check('fx-07-prod');
  for(const k of ['script','shoot','voice','edit','subs','cover']){
    await tap(`[data-fx="prod"][data-k="${k}"]`, true);
    await page.waitForTimeout(160);
  }
  await check('fx-08-prod-done');

  /* готовый материал */
  await openStep(4);
  await fill('#fx2Link', 'https://okoteam.top/example');
  await tap('[data-fx="savelink"]');
  await page.waitForTimeout(350);
  await check('fx-09-material');

  /* назад к списку — задача должна лежать в «Готовых материалах» */
  await tap('[data-fx="back"]');
  await page.waitForTimeout(350);
  await check('fx-10-list');

  /* отмена и восстановление */
  await tap('[data-fx="open"]');
  await page.waitForTimeout(300);
  await tap('[data-fx="cancel"]');
  await page.waitForTimeout(300);
  await check('fx-11-cancelled');
  await tap('[data-fx="restore"]');
  await page.waitForTimeout(300);

  /* повтор задачи */
  await tap('[data-fx="dup"]');
  await page.waitForTimeout(350);
  await check('fx-12-duplicated');

  /* удаление копии */
  await tap('[data-fx="del"]');
  await page.waitForTimeout(350);
  await popupBtn(0);
  await check('fx-13-deleted');

  /* выход из мини-аппа */
  await page.evaluate(`closeMa()`);
  await page.waitForTimeout(300);
  const gridVisible = await page.evaluate(`(function(){
    var g=document.getElementById('maGrid');
    return !!(g && g.style.display !== 'none');
  })()`);
  if(!gridVisible) steps.push({ step:'fx-14-exit', problems:['closeMa() не вернул на список сервисов'] });
  else steps.push({ step:'fx-14-exit', problems: [] });

  /* ---------- ПРОВЕРКА ВИДЕО ---------- */
  curMa = 'video';
  await page.evaluate(`showTab('mini'); openMa('video');`);
  await page.waitForTimeout(400);
  await check('vc-01-start');

  /* смена площадки */
  await tap('[data-vc="tgt"][data-k="shorts"]');
  await page.waitForTimeout(300);
  await check('vc-02-target');
  await tap('[data-vc="tgt"][data-k="clip"]');
  await page.waitForTimeout(300);

  /* НАСТОЯЩИЙ файл в настоящий input */
  if(fs.existsSync(SAMPLE)){
    await page.evaluate(DROP_NUDGE);
    await page.setInputFiles('#vc2File', SAMPLE);
    /* ждём окончания разбора: отчёт появляется, когда есть блок проверок */
    await page.waitForFunction(`(function(){
      var r=document.getElementById('vc2Root');
      return !!(r && (r.querySelector('.vc2-row') || r.textContent.indexOf('Файл не открылся')>=0));
    })()`, null, { timeout: 40000 }).catch(()=>{});
    await page.waitForTimeout(600);
    const probs = await check('vc-03-report');

    /* убеждаемся, что числа настоящие, а не заглушки */
    const facts = await page.evaluate(`(function(){
      var r=document.getElementById('vc2Root');
      if(!r) return null;
      var out={};
      r.querySelectorAll('.vc2-fact').forEach(function(f){
        var k=f.querySelector('span'), v=f.querySelector('b');
        if(k&&v) out[k.textContent.trim()]=v.textContent.trim();
      });
      out.__rows = r.querySelectorAll('.vc2-row').length;
      out.__hist = r.querySelectorAll('.vc2-hi').length;
      return out;
    })()`);
    report.videoFacts = report.videoFacts || facts;
    if(!facts || !facts.__rows) steps.push({ step:'vc-03-facts', problems:['отчёт не построился'] });
    else if(!facts.__hist) steps.push({ step:'vc-03-hist', problems:['проверка не попала в историю'] });
    else steps.push({ step:'vc-03-facts', problems: [], facts });

    /* отчёт в буфер и файл — просто проверяем, что не падает */
    await tap('[data-vc="copyrep"]', true);
    await page.waitForTimeout(250);

    /* новая проверка */
    await tap('[data-vc="again"]');
    await page.waitForTimeout(400);
    await check('vc-04-history');

    /* очистка истории */
    if(await tap('[data-vc="clearhist"]', true)){
      await page.waitForTimeout(300);
      await popupBtn(0);
      await check('vc-05-history-cleared');
    }
  } else {
    steps.push({ step:'vc-03-report', problems:['нет тестового видеофайла ' + SAMPLE] });
  }

  /* старая кнопка «Пример вердикта» и vcStart из ядра не должны врать */
  await page.evaluate(`try{ vcOpenSample(); }catch(e){}`);
  await page.waitForTimeout(400);
  await check('vc-06-sample-popup', {keepPopup:true});
  await popupBtn(0);

  /* выход */
  await page.evaluate(`closeMa()`);
  await page.waitForTimeout(300);

  await ctx.close();

  return {
    viewport: vp.id, theme, steps,
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
      const r = await runViewport(browser, vp, theme, report);
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
  console.log('\n' + JSON.stringify({ totals, clean: report.clean, videoFacts: report.videoFacts }, null, 2));
  console.log('отчёт:', path.join(OUT, 'report.json'));
})();
