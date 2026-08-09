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
  }catch(e){}
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
      const r = el.getBoundingClientRect();
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
  const browser = await chromium.launch({ executablePath: EXEC, args: ['--no-sandbox'] });
  const report = { round: ROUND, base: BASE, at: new Date().toISOString(), modes: {} };

  for(const mode of MODES){
    const ctx = await browser.newContext({
      viewport: { width: mode.width, height: mode.height },
      deviceScaleFactor: 1,
      isMobile: mode.mobile,
      hasTouch: mode.mobile,
      userAgent: mode.mobile
        ? 'Mozilla/5.0 (Linux; Android 13) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122 Mobile Safari/537.36'
        : undefined,
    });
    await ctx.addInitScript(INIT);
    const page = await ctx.newPage();
    const errors = [];
    page.on('pageerror', e => errors.push(String(e && e.message || e).slice(0, 220)));
    page.on('console', m => { if(m.type() === 'error') errors.push('console: ' + m.text().slice(0, 200)); });

    const steps = [];
    const shot = async name => {
      const f = path.join(OUT, `chat2-${mode.id}-${name}.png`);
      try{ await page.screenshot({ path: f }); }catch(e){}
      return path.basename(f);
    };
    const check = async (name, extra) => {
      await sleep(190);
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
    const js = code => page.evaluate(code);

    await page.goto(BASE, { waitUntil: 'domcontentloaded' });
    await sleep(1600);
    await js(`okoSkipAuth(); showTab('chats');`);
    await sleep(500);
    await check('01-chatlist');

    /* --- 1. открыть чат (личка основателя, у неё есть непрочитанное) --- */
    await js(`okoSkipAuth(); showTab('chats'); openConv(2);`);
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
    const lastIdx = await js(`currentChat.msgs.length-1`);
    await js(`okoChat2.palette(${lastIdx})`);
    await sleep(320);
    await check('04-palette', { paletteBtns: await js(`document.querySelectorAll('.ch2-pal .cp-rp-btn').length`) });
    await page.click('.ch2-pal .cp-rp-btn:nth-child(3)').catch(async()=>{ await js(`okoChat2.react(${lastIdx},'🔥')`); });
    await sleep(420);
    const rx = await js(`JSON.stringify(currentChat.msgs[${lastIdx}].rx||{})`);
    await check('05-reacted', { rx, chip: await js(`!!document.querySelector('#msgs .ch2-chip.on')`) });

    /* --- 3б. тап по счётчику: кто поставил --- */
    await page.click('#msgs .ch2-chip').catch(()=>{});
    await sleep(320);
    await check('06-reactors', { sheet: await js(`!!document.querySelector('.ch2-sheet')`) });
    await page.keyboard.press('Escape');
    await sleep(280);
    await check('07-reactors-closed', { sheetGone: await js(`!document.querySelector('.ch2-sheet')`) });

    /* --- 4. ответ свайпом вправо (мышью) --- */
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
    await page.click('#msgs .msg-quote').catch(()=>{});
    await sleep(500);
    await check('10-quote-jump', { flashed: await js(`!!document.querySelector('#msgs .msg.ch2-flash')`) });

    /* --- 5. редактирование --- */
    const editIdx = await js(`currentChat.msgs.length-1`);
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
    await js(`pinMsg(${editIdx})`);
    await sleep(360);
    await check('12-pinned', {
      pinBar: await js(`!!document.querySelector('#cpPinBar.on')`),
      pinText: await js(`(document.getElementById('cpPinText')||{}).textContent||''`),
    });

    /* --- 7. поиск по чату --- */
    await js(`okoChat2.search()`);
    await sleep(300);
    await page.fill('#cpSearchInput', 'цитат').catch(()=>{});
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
    const fwdIdx = await js(`currentChat.msgs.length-1`);
    await js(`okoChat2.forward([${fwdIdx}])`);
    await sleep(340);
    await check('16-forward-sheet', { rows: await js(`document.querySelectorAll('.ch2-sheet .ch2-row').length`) });
    await page.click('.ch2-sheet .ch2-row').catch(()=>{});
    await sleep(700);
    await check('17-forwarded', {
      tag: await js(`!!document.querySelector('#msgs .cp-fwd-tag')`),
      chat: await js(`currentChat && String(currentChat.id)`),
    });

    /* --- 9. удаление --- */
    await js(`okoChat2.del([currentChat.msgs.length-1])`);
    await sleep(340);
    await check('18-delete-sheet', {
      rows: await js(`[...document.querySelectorAll('.ch2-sheet .ch2-row')].map(b=>b.textContent.trim().slice(0,40))`),
    });
    const before = await js(`currentChat.msgs.length`);
    await page.click('.ch2-sheet .ch2-row[data-a="self"]').catch(()=>{});
    await sleep(500);
    await check('19-deleted', { removed: before - (await js(`currentChat.msgs.length`)) });

    /* --- 10. выделение нескольких --- */
    await js(`okoSkipAuth(); showTab('chats'); openConv(2);`);
    await sleep(400);
    await js(`okoChat2.selectOn(0)`);
    await sleep(280);
    await page.click('#msgs .msg:nth-child(2)').catch(()=>{});
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
    await page.fill('#ch2FName', 'Рабочие').catch(()=>{});
    await page.click('.ch2-sheet .ch2-row').catch(()=>{});
    await sleep(180);
    await check('24-folder-editor', { rows: await js(`document.querySelectorAll('.ch2-sheet .ch2-row').length`) });
    await page.click('.ch2-sheet [data-a="save"]').catch(()=>{});
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
    await page.click('#msgs .ch2-cmt').catch(async()=>{ await js(`okoChat2.thread('oko-channel',0)`); });
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
    await page.click('#ch2ThreadBar .ch2-th-x').catch(()=>{});
    await sleep(400);
    await check('30-thread-exit', { bar: await js(`!!document.querySelector('#ch2ThreadBar.on')`) });

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
