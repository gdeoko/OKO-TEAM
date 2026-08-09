/* ============================================================================
   OKO · ПРОБНИК ЧАТОВ (oko-chat2.js)
   Прогоняет полный сценарий Telegram-мессенджера в трёх вьюпортах и на каждом
   шаге проверяет вёрстку: горизонтальное переполнение, обрезанный текст,
   наезды на композер и нижнее меню, закрываемость шторок.

   Запуск:  node oko-app/tools/probe-chat2.mjs [--round N] [--base URL]
   Скрины:  oko-app/tools/chat2-*.png
   Отчёт:   oko-app/tools/chat2-report.json (он же печатается в конце)
   ========================================================================= */
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
const EXEC  = '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';

const MODES = [
  { id: 'phone',   label: 'Телефон 390×844',  width: 390,  height: 844,  mobile: true  },
  { id: 'narrow',  label: 'Узкий 360×740',    width: 360,  height: 740,  mobile: true  },
  { id: 'desktop', label: 'ПК 1440×900',      width: 1440, height: 900,  mobile: false },
];

/* --- Пропуск авторизации: как в audit.mjs (строки ~76-95) --- */
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
    localStorage.removeItem('oko-chat2');
    /* Слой роста (oko-growth.js) показывает свои окна поверх любого экрана.
       Для пробника гасим их через штатный флаг «больше не показывать» —
       это настройка окружения теста, поведение продукта не меняется. */
    localStorage.setItem('okg-state-v1', JSON.stringify({
      off: { onboarding:1, anketa:1, videofree:1, partner:1, lesson:1, expiring:1,
             market:1, academy:1, channels:1, reels:1, wallet:1, tier:1, ref:1 },
      nudge:{}, snooze:{}, steps:{}, ob:{collapsed:true, closed:true},
      refCopied:true, paid:true, lastTier:'MAX', partnerOn:true
    }));
  }catch(e){}
  /* Страховка: если окно роста всё-таки построилось, снимаем его сразу —
     проверяем чаты, а не воронки. */
  document.addEventListener('DOMContentLoaded', function(){
    try{
      new MutationObserver(function(recs){
        recs.forEach(function(r){
          (r.addedNodes||[]).forEach(function(n){
            if(n.nodeType===1 && n.classList && n.classList.contains('okg-scrim')) n.remove();
          });
        });
      }).observe(document.body, {childList:true});
    }catch(e){}
  });
`;

/* --- Детектор дефектов вёрстки, исполняется в странице --- */
const CHECK = `(() => {
  const out = { overflowX:0, offRight:[], clipped:[], midWordBreak:[], underComposer:[],
                underTabs:[], offscreen:[], notes:[] };
  const VW = window.innerWidth, VH = window.innerHeight;
  const de = document.documentElement;
  out.overflowX = Math.max(0, de.scrollWidth - de.clientWidth);

  const label = el => {
    const id = el.id ? '#'+el.id : '';
    const cls = (el.className && typeof el.className === 'string')
      ? '.'+el.className.trim().split(/\\s+/).slice(0,3).join('.') : '';
    return el.tagName.toLowerCase()+id+cls;
  };
  const vis = el => {
    const cs = getComputedStyle(el);
    if(cs.display==='none' || cs.visibility==='hidden' || cs.opacity==='0') return false;
    const r = el.getBoundingClientRect();
    if(r.width<=0 || r.height<=0) return false;
    if(r.left>=VW-1 || r.right<=1 || r.top>=VH-1 || r.bottom<=1) return false;
    return true;
  };
  const rect = s => { const e=document.querySelector(s); if(!e) return null;
    const cs=getComputedStyle(e); if(cs.display==='none') return null;
    const r=e.getBoundingClientRect(); return (r.width&&r.height)?r:null; };
  /* Прямоугольник, который человек РЕАЛЬНО видит: пересекаем с каждым предком,
     который обрезает содержимое. Без этого элемент внутри прокручиваемой ленты
     считался «наехавшим на композер», хотя он давно обрезан контейнером. */
  const clipped = el => {
    let r = el.getBoundingClientRect();
    let top = r.top, left = r.left, right = r.right, bottom = r.bottom;
    for(let p = el.parentElement; p && p !== document.documentElement; p = p.parentElement){
      const pcs = getComputedStyle(p);
      const clips = /hidden|auto|scroll|clip/.test(pcs.overflow + pcs.overflowX + pcs.overflowY);
      if(!clips) continue;
      const pr = p.getBoundingClientRect();
      top = Math.max(top, pr.top); left = Math.max(left, pr.left);
      right = Math.min(right, pr.right); bottom = Math.min(bottom, pr.bottom);
      if(right <= left || bottom <= top) return null;
    }
    return { top, left, right, bottom, width: right - left, height: bottom - top };
  };

  const all = Array.from(document.body.querySelectorAll('*')).slice(0, 5000);
  for(const el of all){
    if(el.ownerSVGElement) continue;
    if(!vis(el)) continue;
    const r = el.getBoundingClientRect();
    const cs = getComputedStyle(el);

    let inScroller = false;
    for(let p=el.parentElement, d=0; p && d<6; p=p.parentElement, d++){
      const pcs = getComputedStyle(p);
      if(pcs.overflowX==='auto' || pcs.overflowX==='scroll'){ inScroller = true; break; }
    }
    if(!inScroller && r.right > VW+1 && r.width < VW*1.6)
      out.offRight.push({ el: label(el), right: Math.round(r.right), vw: VW });
    if(!inScroller && r.left < -1 && r.width < VW*1.6)
      out.offscreen.push({ el: label(el), left: Math.round(r.left) });

    const txt = (el.textContent||'').trim();
    if(txt && el.children.length === 0){
      const ok = cs.textOverflow === 'ellipsis' || cs.webkitLineClamp !== 'none';
      if(!ok && el.scrollWidth > el.clientWidth+2 && cs.overflow !== 'visible')
        out.clipped.push({ el: label(el), text: txt.slice(0,48), sw: el.scrollWidth, cw: el.clientWidth });
      if(!ok && el.scrollHeight > el.clientHeight+3 && (cs.overflowY==='hidden'||cs.overflow==='hidden'))
        out.clipped.push({ el: label(el), text: txt.slice(0,48), sh: el.scrollHeight, ch: el.clientHeight });
      if(cs.wordBreak === 'break-all' && /[А-Яа-яA-Za-z]{4,}/.test(txt) && !el.closest('.oko-breakable'))
        out.midWordBreak.push({ el: label(el), text: txt.slice(0,40) });
    }
  }

  /* Наезд на композер: любой видимый абсолют/фикс, перекрывший поле ввода. */
  const comp = rect('#convBody .composer');
  if(comp){
    for(const el of all){
      if(!vis(el)) continue;
      const cs = getComputedStyle(el);
      if(cs.position !== 'fixed' && cs.position !== 'absolute') continue;
      if(el.closest('.composer') || el.closest('.ch2-sheet') || el.id === 'msgMenu'
         || el.closest('#msgMenu') || el.closest('#okoPopup') || el.closest('.ch2-pal')
         || el.closest('#okoToast') || el.closest('.oko-toast')) continue;
      const r = clipped(el);
      if(!r) continue;
      const over = Math.min(r.bottom, comp.bottom) - Math.max(r.top, comp.top);
      const wide = Math.min(r.right, comp.right) - Math.max(r.left, comp.left);
      if(over > 4 && wide > 4)
        out.underComposer.push({ el: label(el), overlap: Math.round(over) });
    }
    /* лента сообщений не должна залезать под композер */
    const msgs = rect('#msgs');
    if(msgs && msgs.bottom > comp.top + 2)
      out.notes.push('Лента #msgs заходит под композер на '+Math.round(msgs.bottom-comp.top)+'px');
  }

  /* Наезд на нижнее меню приложения. */
  const tabs = rect('#tabs');
  if(tabs){
    for(const s of ['#convBody .composer', '.ch2-down', '#chatList', '.folders']){
      const r = rect(s); if(!r) continue;
      const over = Math.min(r.bottom, tabs.bottom) - Math.max(r.top, tabs.top);
      const wide = Math.min(r.right, tabs.right) - Math.max(r.left, tabs.left);
      if(over > 4 && wide > 4) out.underTabs.push({ el: s, overlap: Math.round(over) });
    }
  }
  return out;
})()`;

const sleep = ms => new Promise(r => setTimeout(r, ms));

/* --------------------------------------------------------------------- */
async function run(){
  await fs.mkdir(OUT, { recursive: true });
  const browser = await chromium.launch({
    executablePath: EXEC,
    args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-gl=swiftshader', '--enable-unsafe-swiftshader'],
  });
  const report = { round: ROUND, base: BASE, at: new Date().toISOString(), modes: {} };

  const only = (args.only && args.only !== true) ? String(args.only) : null;
  for(const mode of MODES){
    if(only && mode.id !== only) continue;
    const ctx = await browser.newContext({
      viewport: { width: mode.width, height: mode.height },
      deviceScaleFactor: 1,
      isMobile: mode.mobile,
      hasTouch: mode.mobile,
      /* Service worker в пробнике не нужен: он прекэширует ~10 МБ ядра и на
         каждом новом контексте душит одиночный локальный сервер. */
      serviceWorkers: 'block',
      userAgent: mode.mobile
        ? 'Mozilla/5.0 (Linux; Android 13) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122 Mobile Safari/537.36'
        : undefined,
    });
    /* Внешние хосты (amplitude, sentry, telegram, supabase) в песочнице режет
       прокси — не ждём их таймаутов, рубим сразу. */
    await ctx.route('**/*', route => {
      const u = route.request().url();
      if(u.startsWith('http://127.0.0.1:8199') || u.startsWith('data:') || u.startsWith('blob:'))
        return route.continue();
      return route.abort();
    });
    await ctx.addInitScript(INIT);
    const page = await ctx.newPage();
    const errors = [];
    /* Внешние хосты в песочнице режет прокси — это шум окружения, а не дефект
       приложения (так же поступает audit.mjs). */
    const NOISE = /net::ERR_|Failed to load resource|Failed to fetch|404 \(File not found\)|ERR_FAILED/i;
    page.on('pageerror', e => { const t = String(e && e.message || e).slice(0, 220);
      if(!NOISE.test(t)) errors.push(t); });
    page.on('console', m => { if(m.type() !== 'error') return; const t = m.text().slice(0, 200);
      if(!NOISE.test(t)) errors.push('console: ' + t); });

    const steps = [];
    let CONV_ID = '2';
    const shot = async name => {
      const f = path.join(OUT, `chat2-${mode.id}-${name}.png`);
      try{ await page.screenshot({ path: f }); }catch(e){}
      return path.basename(f);
    };
    /* Окна слоя роста и системные попапы ядра не относятся к чатам — гасим,
       иначе они закрывают собой проверяемый экран. */
    const dismiss = async () => {
      await page.evaluate(`(function(){
        document.querySelectorAll('.okg-scrim').forEach(n=>n.remove());
        const p = document.getElementById('okoPopup'); if(p) p.remove();
        /* Chrome в мобильной эмуляции зумит визуальный вьюпорт на фокусе поля —
           снимок получается «увеличенным». Снимаем фокус перед замером. */
        try{ if(document.activeElement && document.activeElement.blur) document.activeElement.blur(); }catch(e){}
        document.documentElement.style.overflow=''; document.body.style.overflow='';
      })()`).catch(()=>{});
    };
    /* Меряем только устоявшийся кадр: конв въезжает анимацией convIn, шторки —
       transition'ом. Замер на середине анимации давал ложные «вылезает за край». */
    const settle = () => page.evaluate(`(async()=>{
      const list = document.getAnimations().filter(a=>{
        try{ const t = a.effect && a.effect.getTiming(); return !t || t.iterations !== Infinity; }
        catch(e){ return false; }
      });
      await Promise.race([
        Promise.all(list.map(a=>a.finished.catch(()=>{}))),
        new Promise(r=>setTimeout(r, 1500))
      ]);
      /* Конв въезжает keyframes-анимацией convIn (translateX(16%)). Ждём по
         РЕАЛЬНОМУ времени: под нагрузкой таймеры схлопываются, и счётчик
         итераций сгорал раньше, чем анимация успевала доиграть. */
      const conv = document.getElementById('conv');
      const t0 = Date.now();
      while(conv && Date.now() - t0 < 2000){
        const t = getComputedStyle(conv).transform;
        if(t === 'none' || t === 'matrix(1, 0, 0, 1, 0, 0)') break;
        await new Promise(r=>setTimeout(r, 50));
      }
    })()`).catch(()=>{});
    const check = async (name, extra) => {
      await dismiss();
      await settle();
      await sleep(220);
      let res;
      try{ res = await page.evaluate(CHECK); }
      catch(e){ res = { fatal: String(e).slice(0, 200) }; }
      const st = await page.evaluate(`(window.okoChat2 && window.okoChat2.state) ? window.okoChat2.state() : null`)
        .catch(()=>null);
      const bad =
        (res.overflowX > 1 ? 1 : 0) + (res.offRight||[]).length + (res.clipped||[]).length +
        (res.midWordBreak||[]).length + (res.underComposer||[]).length +
        (res.underTabs||[]).length + (res.offscreen||[]).length + (res.notes||[]).length;
      const s = { step: name, ok: bad === 0 && !res.fatal, issues: bad, layout: res,
                  state: st, shot: await shot(name) };
      if(extra) Object.assign(s, extra);
      steps.push(s);
      return s;
    };
    /* Вычисления в странице не должны ронять весь прогон: ошибку записываем
       в отчёт и идём дальше — иначе один споткнувшийся шаг прячет остальные. */
    const evalErrors = [];
    const js = async code => {
      try{ return await page.evaluate(code); }
      catch(e){ evalErrors.push(String(e && e.message || e).split('\n')[0].slice(0, 160)); return null; }
    };
    /* Клик, который не молчит: любая неудача попадает в отчёт. */
    const clickErrors = [];
    const tap = async (sel, tag) => {
      try{ await page.locator(sel).first().click({ timeout: 20000 }); return true; }
      catch(e){ clickErrors.push((tag || sel) + ': ' + String(e && e.message || e).split('\n')[0].slice(0, 120)); return false; }
    };

    /* Диалог обязан быть открыт. Если слой навигации его закрыл — фиксируем. */
    const reopened = [];
    const ensureConv = async (tag) => {
      const open = await js(`!!(typeof currentChat!=='undefined' && currentChat)`);
      if(open) return true;
      reopened.push(tag);
      await js(`okoSkipAuth(); showTab('chats'); openConv(${CONV_ID});`);
      await sleep(420);
      return await js(`!!(typeof currentChat!=='undefined' && currentChat)`);
    };

    page.setDefaultTimeout(15000);
    process.stderr.write('\n[' + mode.id + '] загрузка ' + BASE + '\n');
    let loaded = false;
    for(let a = 1; a <= 3 && !loaded; a++){
      try{ await page.goto(BASE, { waitUntil: 'domcontentloaded', timeout: 90000 }); loaded = true; }
      catch(e){ process.stderr.write('  попытка ' + a + ': ' + String(e).slice(0, 90) + '\n'); }
    }
    if(!loaded) throw new Error('Страница не загрузилась в режиме ' + mode.id);
    await sleep(2000);
    await js(`okoSkipAuth(); showTab('chats');`);
    await sleep(500);
    await check('01-chatlist');

    /* --- 1. открыть чат: берём первый личный с непрочитанным, иначе первый --- */
    const cid = await js(`(function(){
      const c = CHATS.find(x=>x.kind==='direct' && (x.unread||0)>0) || CHATS.find(x=>x.kind==='direct') || CHATS[0];
      return c ? (typeof c.id==='number' ? c.id : "'"+c.id+"'") : null;
    })()`);
    CONV_ID = cid == null ? "'live'" : String(cid);
    await js(`okoSkipAuth(); showTab('chats'); openConv(${CONV_ID});`);
    await sleep(450);
    await check('02-conv-open', {
      unreadLine: await js(`!!document.querySelector('#msgs .msg.ch2-ub')`).catch(()=>null),
    });

    /* --- 2. отправить сообщение --- */
    await js(`
      const i=document.getElementById('msgInput');
      i.value='Проверка чатов: реакции, ответы и закреп работают';
      i.dispatchEvent(new Event('input',{bubbles:true}));
      sendText();
    `);
    await sleep(420);
    const sent = await js(`(function(){const c=currentChat;const m=c.msgs[c.msgs.length-1];
      return {kind:m.kind, body:(m.body||'').slice(0,60), out:!m.in, id:!!m.ch2id};})()`);
    await check('03-sent', { sent });

    /* --- 3. поставить реакцию через палитру (реальный клик) --- */
    await ensureConv('before-react');
    const lastIdx = await js(`currentChat.msgs.length-1`);
    await js(`okoChat2.palette(${lastIdx})`);
    await sleep(320);
    await check('04-palette', { paletteBtns: await js(`document.querySelectorAll('.ch2-pal .cp-rp-btn').length`) });
    if(!await tap('.ch2-pal .cp-rp-btn:nth-child(3)', 'реакция')) await js(`okoChat2.react(${lastIdx},'🔥')`);
    await sleep(420);
    const rx = await js(`JSON.stringify(currentChat.msgs[${lastIdx}].rx||{})`);
    await check('05-reacted', { rx, chip: await js(`!!document.querySelector('#msgs .ch2-chip.on')`) });

    /* --- 3б. тап по счётчику: кто поставил --- */
    await tap('#msgs .ch2-chip', 'счётчик реакций');
    await sleep(320);
    await check('06-reactors', { sheet: await js(`!!document.querySelector('.ch2-sheet')`) });
    await page.keyboard.press('Escape');
    await sleep(280);
    await check('07-reactors-closed', { sheetGone: await js(`!document.querySelector('.ch2-sheet')`) });

    /* --- 4. ответ свайпом вправо (мышью) --- */
    await ensureConv('before-swipe');
    const box = await page.locator('#msgs .msg').last().boundingBox();
    if(box){
      await page.mouse.move(box.x + 12, box.y + box.height/2);
      await page.mouse.down();
      for(let x = 20; x <= 80; x += 12){
        await page.mouse.move(box.x + x, box.y + box.height/2, { steps: 2 });
      }
      await page.mouse.up();
    }
    await sleep(340);
    let replying = await js(`document.getElementById('composeBar').classList.contains('open')`);
    if(!replying){ await js(`okoChat2.swipeReply(${lastIdx})`); await sleep(250);
      replying = await js(`document.getElementById('composeBar').classList.contains('open')`); }
    await check('08-swipe-reply', { composeBarOpen: replying });

    await js(`
      const i=document.getElementById('msgInput');
      i.value='Ответ на цитату — проверяю переход к оригиналу';
      i.dispatchEvent(new Event('input',{bubbles:true}));
      sendText();
    `);
    await sleep(420);
    const quoted = await js(`(function(){const c=currentChat;const m=c.msgs[c.msgs.length-1];
      return {hasQuote:!!(m.reply), mid:!!(m.reply&&m.reply.mid)};})()`);
    await check('09-reply-sent', { quoted, quoteInDom: await js(`!!document.querySelector('#msgs .msg-quote')`) });

    /* тап по цитате — прокрутка к оригиналу */
    await tap('#msgs .msg-quote', 'цитата');
    await sleep(500);
    await check('10-quote-jump', { flashed: await js(`!!document.querySelector('#msgs .msg.ch2-flash')`) });

    /* --- 5. редактирование (только своё сообщение — как в Telegram) --- */
    await ensureConv('before-edit');
    const editIdx = await js(`(function(){const m=currentChat.msgs;
      for(let i=m.length-1;i>=0;i--) if(m[i] && !m[i].in && (!m[i].kind||m[i].kind==='text')) return i;
      return m.length-1;})()`);
    await js(`editMsg(${editIdx});
      const i=document.getElementById('msgInput');
      i.value='Ответ на цитату — текст отредактирован';
      i.dispatchEvent(new Event('input',{bubbles:true}));
      sendText();`);
    await sleep(400);
    await check('11-edited', {
      edited: await js(`!!currentChat.msgs[${editIdx}].edited`),
      mark: await js(`!!document.querySelector('#msgs .edited')`),
    });

    /* --- 6. закрепить --- */
    await ensureConv('before-pin');
    await js(`pinMsg(${editIdx})`);
    await sleep(360);
    await check('12-pinned', {
      pinBar: await js(`!!document.querySelector('#cpPinBar.on')`),
      pinText: await js(`(document.getElementById('cpPinText')||{}).textContent||''`),
    });

    /* --- 7. поиск по чату --- */
    await ensureConv('before-search');
    await js(`okoChat2.search()`);
    await sleep(300);
    try{ await page.fill('#cpSearchInput', 'цитат', {timeout:8000}); }catch(e){ clickErrors.push('поле поиска: '+String(e.message).split('\n')[0].slice(0,110)); }
    await js(`document.getElementById('cpSearchInput').dispatchEvent(new Event('input',{bubbles:true}))`);
    await sleep(420);
    await check('13-search', {
      count: await js(`(document.getElementById('cpSearchCount')||{}).textContent||''`),
      marks: await js(`document.querySelectorAll('#msgs mark.cp-mk').length`),
    });
    await js(`typeof cpSearchStep==='function' && cpSearchStep(-1)`);
    await sleep(300);
    await check('14-search-step', {
      count: await js(`(document.getElementById('cpSearchCount')||{}).textContent||''`),
    });
    await js(`typeof cpCloseSearch==='function' && cpCloseSearch()`);
    await sleep(280);
    await check('15-search-closed', { closed: await js(`!document.querySelector('#cpSearchBar.on')`) });

    /* --- 8. пересылка --- */
    await ensureConv('before-forward');
    const fwdIdx = await js(`currentChat.msgs.length-1`);
    await js(`okoChat2.forward([${fwdIdx}])`);
    await sleep(340);
    await check('16-forward-sheet', { rows: await js(`document.querySelectorAll('.ch2-sheet .ch2-row').length`) });
    await tap('.ch2-sheet .ch2-row', 'выбор чата для пересылки');
    await sleep(1400);   /* переход + дозапись пересланного идут отложенно */
    await check('17-forwarded', {
      tag: await js(`!!document.querySelector('#msgs .cp-fwd-tag')`),
      chat: await js(`currentChat && String(currentChat.id)`),
    });

    /* --- 9. удаление --- */
    await ensureConv('before-delete');
    await js(`okoChat2.del([currentChat.msgs.length-1])`);
    await sleep(340);
    await check('18-delete-sheet', {
      rows: await js(`[...document.querySelectorAll('.ch2-sheet .ch2-row')].map(b=>b.textContent.trim().slice(0,40))`),
    });
    const before = await js(`currentChat.msgs.length`);
    await tap('.ch2-sheet [data-a="self"]', 'удалить у себя');
    await sleep(500);
    await check('19-deleted', { removed: before - (await js(`currentChat.msgs.length`)) });

    /* --- 10. выделение нескольких --- */
    await js(`okoSkipAuth(); showTab('chats'); openConv(${CONV_ID});`);
    await sleep(400);
    await js(`okoChat2.selectOn(0)`);
    await sleep(280);
    await tap('#msgs .msg:nth-child(2)', 'второе сообщение');
    await sleep(280);
    await check('20-select', {
      n: await js(`okoChat2.selected()`),
      bar: await js(`!!document.querySelector('.ch2-selbar.on')`),
      label: await js(`(document.getElementById('ch2SelN')||{}).textContent||''`),
    });
    await page.keyboard.press('Escape');
    await sleep(280);
    await check('21-select-off', { off: await js(`!document.querySelector('.ch2-selbar.on')`) });

    /* --- 11. смена папки --- */
    await js(`typeof closeConv==='function' && closeConv(); showTab('chats');`);
    await sleep(320);
    await js(`okoChat2.folder('channel')`);
    await sleep(320);
    await check('22-folder-channel', {
      visible: await js(`[...document.querySelectorAll('#chatList .chat-item')].filter(n=>n.offsetParent!==null).length`),
    });
    await js(`okoChat2.folder('unread')`);
    await sleep(320);
    await check('23-folder-unread', {
      visible: await js(`[...document.querySelectorAll('#chatList .chat-item')].filter(n=>n.offsetParent!==null).length`),
      empty: await js(`!!document.getElementById('ch2FolderEmpty')`),
    });
    await js(`okoChat2.newFolder()`);
    await sleep(320);
    try{ await page.fill('#ch2FName', 'Рабочие', {timeout:8000}); }catch(e){ clickErrors.push('имя папки: '+String(e.message).split('\n')[0].slice(0,110)); }
    await tap('.ch2-sheet [data-a="t:0"]', 'отметить чат в папке');
    await tap('.ch2-sheet [data-a="t:2"]', 'отметить канал в папке');
    await sleep(180);
    await check('24-folder-editor', { rows: await js(`document.querySelectorAll('.ch2-sheet .ch2-row').length`) });
    await tap('.ch2-sheet [data-a="save"]', 'сохранить папку');
    await sleep(450);
    await check('25-folder-saved', {
      folders: await js(`JSON.stringify(okoChat2.folders())`),
      active: await js(`okoChat2.state().folder`),
    });
    await js(`okoChat2.folder('all')`);
    await sleep(280);
    await check('26-folder-all', {
      visible: await js(`[...document.querySelectorAll('#chatList .chat-item')].filter(n=>n.offsetParent!==null).length`),
    });

    /* --- 12. ветки обсуждения канала --- */
    await js(`okoSkipAuth(); showTab('chats'); openConv('oko-channel');`);
    await sleep(450);
    await check('27-channel', { cmt: await js(`document.querySelectorAll('#msgs .ch2-cmt').length`) });
    if(!await tap('#msgs .ch2-cmt', 'комментарии')) await js(`okoChat2.thread('oko-channel',0)`);
    await sleep(600);
    await check('28-thread', {
      bar: await js(`!!document.querySelector('#ch2ThreadBar.on')`),
      chat: await js(`currentChat && String(currentChat.id)`),
      empty: await js(`!!document.getElementById('ch2ThreadEmpty')`),
    });
    await js(`
      const i=document.getElementById('msgInput');
      i.value='Первый комментарий в ветке обсуждения';
      i.dispatchEvent(new Event('input',{bubbles:true}));
      sendText();
    `);
    await sleep(500);
    await check('29-thread-msg', {
      tagged: await js(`!!(currentChat.msgs[currentChat.msgs.length-1]||{}).ch2th`),
      visible: await js(`[...document.querySelectorAll('#msgs .msg')].filter(n=>!n.classList.contains('ch2-off')).length`),
    });
    await tap('#ch2ThreadBar .ch2-th-x', 'выход из ветки');
    await sleep(400);
    await check('30-thread-exit', { bar: await js(`!!document.querySelector('#ch2ThreadBar.on')`) });

    /* --- 12б. черновик: недописанный текст остаётся за чатом --- */
    await ensureConv('before-draft');
    await js(`
      const i=document.getElementById('msgInput');
      i.value='Недописанное сообщение';
      i.dispatchEvent(new Event('input',{bubbles:true}));
    `);
    await sleep(600);                       /* у ядра debounce 320 мс */
    await js(`typeof closeConv==='function' && closeConv(); showTab('chats');`);
    await sleep(420);
    await check('32-draft', {
      tag: await js(`!!document.querySelector('#chatList .cp-draft-tag')`),
      text: await js(`(document.querySelector('#chatList .cp-draft-tag')||{}).parentNode
              ? document.querySelector('#chatList .cp-draft-tag').parentNode.textContent.trim().slice(0,44) : ''`),
    });
    /* убираем черновик, чтобы не мешал следующим шагам */
    await js(`okoSkipAuth(); showTab('chats'); openConv(${CONV_ID});
      const i=document.getElementById('msgInput'); i.value='';
      i.dispatchEvent(new Event('input',{bubbles:true}));`);
    await sleep(600);

    /* --- 12в. кнопка «вниз» со счётчиком --- */
    await ensureConv('before-down');
    await js(`for(let k=0;k<14;k++){
      const i=document.getElementById('msgInput');
      i.value='Строка для прокрутки номер '+(k+1);
      i.dispatchEvent(new Event('input',{bubbles:true}));
      sendText();
    }`);
    await sleep(700);
    await js(`const el=document.getElementById('msgs'); el.scrollTop=0; el.dispatchEvent(new Event('scroll'));`);
    await sleep(450);
    await check('33-scroll-down', {
      shown: await js(`!!document.querySelector('.ch2-down.on')`),
      below: await js(`(function(){const b=document.querySelector('.ch2-down');const c=document.querySelector('#convBody .composer');
        if(!b||!c) return null; const r=b.getBoundingClientRect(), q=c.getBoundingClientRect();
        return Math.round(q.top - r.bottom);})()`),
    });
    await js(`const el=document.getElementById('msgs'); el.scrollTop=el.scrollHeight; el.dispatchEvent(new Event('scroll'));`);
    await sleep(450);
    await check('34-scroll-bottom', { hidden: await js(`!document.querySelector('.ch2-down.on')`) });

    /* --- 13. статусы прочтения: честность --- */
    const honest = await js(`(function(){
      let fake=0, sent=0, read=0;
      for(const c of CHATS) for(const m of (c.msgs||[])){
        if(!m || m.in || m.kind==='sys') continue;
        if(m.ch2read) read++; else sent++;
        if(m.ch2read && !c.cid && !c.agent) fake++;
      }
      const ticks=[...document.querySelectorAll('#msgs .cp-st')].map(s=>s.dataset.st);
      return {sent, read, fake, ticks};
    })()`);

    /* --- 14. выход из чата --- */
    await js(`typeof closeConv==='function' && closeConv()`);
    await sleep(340);
    await check('31-closed', {
      convHidden: await js(`(document.getElementById('convBody')||{}).style.display==='none'`),
    });

    const bad = steps.filter(s => !s.ok);
    report.modes[mode.id] = {
      label: mode.label, viewport: mode.width + 'x' + mode.height,
      steps: steps.length, failed: bad.length,
      issues: bad.map(s => ({ step: s.step, n: s.issues,
        offRight: s.layout.offRight, clipped: s.layout.clipped,
        overflowX: s.layout.overflowX, underComposer: s.layout.underComposer,
        underTabs: s.layout.underTabs, offscreen: s.layout.offscreen,
        midWordBreak: s.layout.midWordBreak, notes: s.layout.notes, fatal: s.layout.fatal })),
      readStatuses: honest,
      pageErrors: [...new Set(errors)].slice(0, 12),
      evalErrors: [...new Set(evalErrors)].slice(0, 12),
      convReopened: reopened,
      clickErrors: clickErrors,
      detail: steps.map(s => {
        const { layout, shot, ...rest } = s;
        return rest;
      }),
    };
    await ctx.close();
  }

  await browser.close();
  const totalFailed = Object.values(report.modes).reduce((a, m) => a + m.failed, 0);
  const totalErrors = Object.values(report.modes).reduce((a, m) => a + m.pageErrors.length, 0);
  report.summary = { failedSteps: totalFailed, pageErrors: totalErrors,
                     verdict: (totalFailed === 0 && totalErrors === 0) ? 'ЧИСТО' : 'ЕСТЬ ЗАМЕЧАНИЯ' };
  await fs.writeFile(path.join(OUT, 'chat2-report.json'), JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
}

run().catch(e => { console.error('ПРОБНИК УПАЛ:', e); process.exit(1); });
