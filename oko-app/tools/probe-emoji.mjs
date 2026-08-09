/* ============================================================================
   OKO · ПРОБНИК ПАНЕЛИ ЭМОДЗИ И СТИКЕРОВ  (oko-emoji.js)
   Проверяет ровно то, что просил Даниэль:
     • клавиатура и панель эмодзи НИКОГДА не открыты одновременно;
     • панель ровно в высоту системной клавиатуры (или дефолта);
     • композер при открытии/закрытии панели не «прыгает»;
     • контент настоящий: категории, поиск, недавние, стикеры, GIF-заглушка;
     • выходы: Escape, тап вне, кнопка «назад».
   Запуск: node oko-app/tools/probe-emoji.mjs
   ========================================================================= */
import { chromium } from 'playwright-core';

const BASE = process.env.OKO_BASE || 'http://127.0.0.1:8199/index.html';
const CHROME = process.env.OKO_CHROME || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';

const VIEWPORTS = [
  { id: 'phone',  label: 'Телефон 390x844',      width: 390,  height: 844,  mobile: true },
  { id: 'narrow', label: 'Узкий Android 360x740', width: 360, height: 740,  mobile: true },
  { id: 'desk',   label: 'ПК 1440x900',          width: 1440, height: 900,  mobile: false },
];

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
    /* Слой роста (oko-growth.js) любит выкидывать модалку поверх всего —
       для чистоты замеров глушим все его поводы. */
    localStorage.setItem('okg-state-v1', JSON.stringify({
      off:{onboarding:1,anketa:1,videofree:1,partner:1,lesson:1,expiring:1},
      ob:{collapsed:true,closed:true}
    }));
  }catch(e){}
`;

/* Скрин не должен ронять прогон: в облаке шрифты с CDN режет прокси и
   playwright может бесконечно ждать document.fonts.ready. */
async function shot(page, path){
  try { await page.screenshot({ path, timeout: 8000, animations: 'disabled' }); }
  catch (e) { /* скрин не критичен */ }
}

/* Страховка: если слой роста всё-таки открыл окно — снимаем его перед шагом. */
async function calm(page){
  await page.evaluate(`(()=>{
    document.querySelectorAll('.okg-scrim,.okg-pill,.okg-ob').forEach(n=>n.remove());
    try{ if(typeof closeSheet==='function') closeSheet(); }catch(e){}
  })()`);
}

const browser = await chromium.launch({ executablePath: CHROME, args: ['--no-sandbox'] });
const report = { base: BASE, viewports: {}, errors: [] };

for (const vp of VIEWPORTS) {
  const out = { label: vp.label };
  const ctx = await browser.newContext({
    viewport: { width: vp.width, height: vp.height },
    isMobile: vp.mobile, hasTouch: vp.mobile, deviceScaleFactor: vp.mobile ? 2 : 1,
  });
  await ctx.addInitScript(INIT);
  const page = await ctx.newPage();
  page.setDefaultNavigationTimeout(120000);
  page.setDefaultTimeout(45000);
  const errors = [];
  page.on('pageerror', e => errors.push(String(e).slice(0, 200)));
  /* Сетевые 404/ERR_CONNECTION_RESET — это заблокированные прокси CDN аналитики,
     к панели эмодзи отношения не имеют. Ловим только ошибки JS. */
  page.on('console', m => {
    if (m.type() !== 'error') return;
    const t = m.text();
    if (/Failed to load resource|ERR_CONNECTION|net::/i.test(t)) return;
    errors.push('console: ' + t.slice(0, 160));
  });

  let loaded = false;
  for (let a = 0; a < 3 && !loaded; a++) {
    try { await page.goto(BASE, { waitUntil: 'domcontentloaded' }); loaded = true; }
    catch (e) { await page.waitForTimeout(1500); }
  }
  if (!loaded) { out.loadFailed = true; report.viewports[vp.id] = out; await ctx.close(); continue; }
  await page.waitForTimeout(1700);
  await page.evaluate(`okoSkipAuth(); showTab('chats');`);
  await page.waitForTimeout(500);
  await page.evaluate(`const r=document.querySelector('#chatList .ci, #chatList > *'); r&&r.click();`);
  await page.waitForTimeout(700);

  await calm(page);

  /* --- базовое присутствие --- */
  out.legacyPanelGone = await page.evaluate(`!document.getElementById('cpPanel') && !document.getElementById('cpSmile')`);
  out.btnExists   = await page.evaluate(`!!document.getElementById('okoEmBtn')`);
  out.panelExists = await page.evaluate(`!!document.getElementById('okoEm')`);
  out.noEmojiInUi = await page.evaluate(`(()=>{
    const p=document.getElementById('okoEm'); if(!p) return 'нет панели';
    const chrome=[...p.querySelectorAll('.okoem-cat,.okoem-sec,.okoem-act,.okoem-empty,.okoem-mini,.okoem-add')]
      .map(n=>n.textContent||'').join(' ') + (document.getElementById('okoEmBtn')?.textContent||'');
    return !/\\p{Extended_Pictographic}/u.test(chrome);
  })()`);
  out.emojiCount   = await page.evaluate(`window.okoEmoji ? okoEmoji.count() : 0`);
  out.stickerCount = await page.evaluate(`window.okoEmoji ? okoEmoji.stickers() : 0`);

  /* --- 1. фокус в поле, затем открытие панели: фокус должен уйти --- */
  await calm(page);
  await page.click('#msgInput');
  await page.waitForTimeout(250);
  out.inputFocusedBefore = await page.evaluate(`document.activeElement === document.getElementById('msgInput')`);
  const composerBefore = await page.evaluate(`document.querySelector('#convBody .composer').getBoundingClientRect().top`);

  await page.click('#okoEmBtn');
  await page.waitForTimeout(450);
  out.panelOpen = await page.evaluate(`okoEmoji.isOpen() && document.getElementById('okoEm').classList.contains('on')`);
  out.inputBlurredOnOpen = await page.evaluate(`document.activeElement !== document.getElementById('msgInput')`);

  /* --- 2. высота панели = сохранённой высоте клавиатуры / дефолту --- */
  const h = await page.evaluate(`(()=>{
    const p=document.getElementById('okoEm');
    return { real: Math.round(p.getBoundingClientRect().height*100)/100,
             target: okoEmoji.targetHeight(), saved: okoEmoji.savedKb(),
             avail: okoEmoji.availHeight(),
             fallback: Math.round(Math.min(Math.max(260, Math.min(Math.round(innerHeight*0.46),320)), okoEmoji.availHeight())) };
  })()`);
  out.height = h;
  out.heightMatchesTarget = Math.abs(h.real - h.target) <= 2;
  out.heightMatchesDefault = h.saved ? 'использована сохранённая клавиатура' : (Math.abs(h.real - h.fallback) <= 2);
  out.heightAtLeast260 = h.real >= 260 || h.real === h.avail;

  /* --- 3. композер не прыгает --- */
  const composerOpen = await page.evaluate(`document.querySelector('#convBody .composer').getBoundingClientRect().top`);
  out.composerShiftOnOpen = Math.round(Math.abs(composerOpen - composerBefore) * 100) / 100;

  /* --- 4. геометрия: без горизонтального переполнения, не под нижним меню --- */
  out.geometry = await page.evaluate(`(()=>{
    const de=document.documentElement;
    const p=document.getElementById('okoEm').getBoundingClientRect();
    const c=document.querySelector('#convBody .composer').getBoundingClientRect();
    const nav=document.querySelector('nav#tabs');
    const navR=nav && getComputedStyle(nav).display!=='none' ? nav.getBoundingClientRect() : null;
    const cs=getComputedStyle(document.documentElement);
    const safeB=parseFloat(cs.getPropertyValue('--oko-safe-bottom'))||0;
    const cats=document.getElementById('okoEmCats').getBoundingClientRect();
    return {
      overflowX: Math.max(0, de.scrollWidth-de.clientWidth),
      panelInViewport: p.left>=-1 && p.right<=innerWidth+1 && p.top>=-1,
      panelAboveComposer: Math.round((c.top - p.bottom)*100)/100,
      panelOverNav: navR ? p.bottom > navR.top+1 : false,
      composerBottomOk: Math.round((innerHeight - c.bottom)*100)/100,
      safeBottomVar: safeB,
      catsVisible: cats.height>20 && cats.bottom<=p.bottom+1,
      bodyScrollable: document.getElementById('okoEmBody').scrollHeight > 10
    };
  })()`);
  out.noHorizontalOverflow = out.geometry.overflowX === 0;

  await shot(page, `oko-app/tools/emoji-${vp.id}-open.png`);

  /* --- 5. тап в поле ввода закрывает панель --- */
  await calm(page);
  await page.click('#msgInput');
  await page.waitForTimeout(400);
  out.closedByInputTap = await page.evaluate(`!okoEmoji.isOpen()`);
  out.inputFocusedAfterTap = await page.evaluate(`document.activeElement === document.getElementById('msgInput')`);
  const composerClosed = await page.evaluate(`document.querySelector('#convBody .composer').getBoundingClientRect().top`);
  out.composerShiftOnClose = Math.round(Math.abs(composerClosed - composerBefore) * 100) / 100;

  /* --- 6. снова открыть, выбрать эмодзи, отправить --- */
  await calm(page);
  await page.click('#okoEmBtn');
  await page.waitForTimeout(400);
  const before = await page.evaluate(`document.querySelectorAll('#msgs .msg').length`);
  const firstEmoji = await page.evaluate(`document.querySelector('#okoEmBody .okoem-e')?.getAttribute('data-e') || ''`);
  await page.click('#okoEmBody .okoem-e');
  await page.waitForTimeout(250);
  out.pickedEmoji = firstEmoji;
  out.emojiInInput = await page.evaluate(`document.getElementById('msgInput').value.length > 0`);
  out.keyboardStillClosed = await page.evaluate(`document.activeElement !== document.getElementById('msgInput')`);
  out.panelStillOpenAfterPick = await page.evaluate(`okoEmoji.isOpen()`);
  out.sendBtnVisible = await page.evaluate(`getComputedStyle(document.getElementById('sendBtn')).display !== 'none'`);

  await calm(page);
  await page.click('#sendBtn');
  await page.waitForTimeout(500);
  out.messageSent = (await page.evaluate(`document.querySelectorAll('#msgs .msg').length`)) > before;
  out.inputCleared = await page.evaluate(`document.getElementById('msgInput').value === ''`);
  out.recentSaved = await page.evaluate(`okoEmoji.recent().length > 0`);

  /* --- 7. «Недавние» реально накопились --- */
  await page.evaluate(`okoEmoji.setTab('recent')`);
  await page.waitForTimeout(200);
  out.recentTabHasItems = await page.evaluate(`
    document.querySelectorAll('#okoEmBody .okoem-grid')[0]?.children.length > 0`);

  /* --- 8. переключение категорий --- */
  const cats = ['smile', 'nature', 'food', 'act', 'travel', 'obj', 'sym', 'flag'];
  const perCat = {};
  for (const c of cats) {
    await page.evaluate(`okoEmoji.setTab('${c}')`);
    await page.waitForTimeout(120);
    perCat[c] = await page.evaluate(`document.querySelectorAll('#okoEmBody .okoem-e').length`);
  }
  out.categories = perCat;
  out.allCategoriesFilled = Object.values(perCat).every(n => n >= 40);
  out.catTabHighlighted = await page.evaluate(`!!document.querySelector('#okoEmCats .okoem-cat.on')`);

  /* --- 9. поиск --- */
  await page.fill('#okoEmQ', 'огонь');
  await page.waitForTimeout(250);
  out.searchFire = await page.evaluate(`document.querySelectorAll('#okoEmBody .okoem-e').length`);
  await page.fill('#okoEmQ', 'rocket');
  await page.waitForTimeout(250);
  out.searchRocketEn = await page.evaluate(`document.querySelectorAll('#okoEmBody .okoem-e').length`);
  await page.fill('#okoEmQ', 'ъыжэ');
  await page.waitForTimeout(250);
  out.searchEmptyState = await page.evaluate(`!!document.querySelector('#okoEmBody .okoem-empty')`);
  await page.fill('#okoEmQ', '');
  await page.waitForTimeout(200);

  /* --- 10. стикеры OKO --- */
  await page.evaluate(`okoEmoji.setTab('stk:oko')`);
  await page.waitForTimeout(300);
  out.stickersRendered = await page.evaluate(`document.querySelectorAll('#okoEmBody .okoem-stk').length`);
  out.stickersUseMasterLogo = await page.evaluate(`!!document.querySelector('#okoEmBody .okoem-stk use[href="#i-logo"]')`);
  await shot(page, `oko-app/tools/emoji-${vp.id}-stickers.png`);
  await calm(page);
  const beforeStk = await page.evaluate(`document.querySelectorAll('#msgs .msg').length`);
  await page.click('#okoEmBody .okoem-stk');
  await page.waitForTimeout(500);
  out.stickerSent = (await page.evaluate(`document.querySelectorAll('#msgs .msg').length`)) > beforeStk;
  out.stickerRenderedInChat = await page.evaluate(`!!document.querySelector('#msgs .okoem-msg .okoem-stkart')`);

  /* --- 11. свои стикеры и GIF --- */
  await page.evaluate(`okoEmoji.setTab('stk:my')`);
  await page.waitForTimeout(250);
  out.myStickersAddBtn = await page.evaluate(`!!document.querySelector('#okoEmBody [data-add]')`);
  await page.evaluate(`okoEmoji.setTab('gif')`);
  await page.waitForTimeout(250);
  out.gifHonestEmpty = await page.evaluate(`(()=>{
    const e=document.querySelector('#okoEmBody .okoem-empty');
    return !!e && /подключ/i.test(e.textContent) && !!document.querySelector('#okoEmBody [data-attach]');
  })()`);
  await page.evaluate(`okoEmoji.setTab('smile')`);
  await page.waitForTimeout(200);

  /* --- 12. тап вне панели закрывает --- */
  await page.evaluate(`if(!okoEmoji.isOpen()) okoEmoji.open()`);
  await page.waitForTimeout(350);
  await page.evaluate(`(()=>{const m=document.getElementById('msgs');const r=m.getBoundingClientRect();
    m.dispatchEvent(new PointerEvent('pointerdown',{bubbles:true,clientX:r.left+r.width/2,clientY:r.top+10}));})()`);
  await page.waitForTimeout(350);
  out.closedByOutsideTap = await page.evaluate(`!okoEmoji.isOpen()`);

  /* --- 13. Escape закрывает --- */
  await page.evaluate(`okoEmoji.open()`);
  await page.waitForTimeout(350);
  await page.keyboard.press('Escape');
  await page.waitForTimeout(450);
  out.closedByEscape = await page.evaluate(`!okoEmoji.isOpen()`);

  /* --- 14. системная «назад» закрывает --- */
  await page.evaluate(`okoEmoji.open()`);
  await page.waitForTimeout(350);
  await page.goBack().catch(() => {});
  await page.waitForTimeout(500);
  out.closedByBrowserBack = await page.evaluate(`!okoEmoji.isOpen()`);

  /* --- 15. панель ровно в измеренную клавиатуру --- */
  await page.evaluate(`okoEmoji.close(); okoEmoji.setKb(292);`);
  await page.waitForTimeout(200);
  await page.evaluate(`okoEmoji.open()`);
  await page.waitForTimeout(450);
  const h2 = await page.evaluate(`(()=>{const p=document.getElementById('okoEm');
    return {real:Math.round(p.getBoundingClientRect().height*100)/100, target:okoEmoji.targetHeight(), saved:okoEmoji.savedKb()};})()`);
  out.measuredKbApplied = h2;
  out.measuredKbMatches = Math.abs(h2.real - 292) <= 2 && h2.saved === 292;
  const composerKb = await page.evaluate(`document.querySelector('#convBody .composer').getBoundingClientRect().top`);
  out.composerShiftWithKbHeight = Math.round(Math.abs(composerKb - composerBefore) * 100) / 100;
  await shot(page, `oko-app/tools/emoji-${vp.id}-kb292.png`);

  /* --- 16. выход из чата гасит панель --- */
  await page.evaluate(`typeof closeConv==='function' && closeConv()`);
  await page.waitForTimeout(400);
  out.closedOnLeaveChat = await page.evaluate(`!okoEmoji.isOpen()`);
  out.appAlive = await page.evaluate(`(()=>{ try{ showTab('feed'); return !!document.querySelector('#screen-feed'); }catch(e){ return String(e); } })()`);

  out.errors = errors.slice(0, 6);
  report.viewports[vp.id] = out;
  await ctx.close();
}

await browser.close();

/* ---- сводка: что красное ---- */
const fails = [];
for (const [vid, o] of Object.entries(report.viewports)) {
  const must = {
    legacyPanelGone: o.legacyPanelGone === true,
    btnExists: o.btnExists === true,
    panelExists: o.panelExists === true,
    noEmojiInUi: o.noEmojiInUi === true,
    panelOpen: o.panelOpen === true,
    inputBlurredOnOpen: o.inputBlurredOnOpen === true,
    heightMatchesTarget: o.heightMatchesTarget === true,
    heightAtLeast260: o.heightAtLeast260 === true,
    composerShiftOnOpen: o.composerShiftOnOpen <= 2,
    composerShiftOnClose: o.composerShiftOnClose <= 2,
    composerShiftWithKbHeight: o.composerShiftWithKbHeight <= 2,
    noHorizontalOverflow: o.noHorizontalOverflow === true,
    panelNotOverNav: o.geometry.panelOverNav === false,
    panelAboveComposer: o.geometry.panelAboveComposer >= -1,
    closedByInputTap: o.closedByInputTap === true,
    inputFocusedAfterTap: o.inputFocusedAfterTap === true,
    emojiInInput: o.emojiInInput === true,
    keyboardStillClosed: o.keyboardStillClosed === true,
    messageSent: o.messageSent === true,
    recentSaved: o.recentSaved === true,
    recentTabHasItems: o.recentTabHasItems === true,
    allCategoriesFilled: o.allCategoriesFilled === true,
    searchFire: o.searchFire > 0,
    searchRocketEn: o.searchRocketEn > 0,
    searchEmptyState: o.searchEmptyState === true,
    stickersRendered: o.stickersRendered >= 12,
    stickersUseMasterLogo: o.stickersUseMasterLogo === true,
    stickerSent: o.stickerSent === true,
    stickerRenderedInChat: o.stickerRenderedInChat === true,
    myStickersAddBtn: o.myStickersAddBtn === true,
    gifHonestEmpty: o.gifHonestEmpty === true,
    closedByOutsideTap: o.closedByOutsideTap === true,
    closedByEscape: o.closedByEscape === true,
    closedByBrowserBack: o.closedByBrowserBack === true,
    measuredKbMatches: o.measuredKbMatches === true,
    closedOnLeaveChat: o.closedOnLeaveChat === true,
    noPageErrors: (o.errors || []).length === 0,
  };
  for (const [k, ok] of Object.entries(must)) if (!ok) fails.push(vid + '.' + k);
}
report.fails = fails;
report.verdict = fails.length ? 'ЕСТЬ ЗАМЕЧАНИЯ' : 'ЧИСТО';
console.log(JSON.stringify(report, null, 2));
process.exit(0);
