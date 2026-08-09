/* =============================================================================
   OKO · ПРОБНИК РАЗДЕЛА «ЗВОНКИ»  (oko-app/tools/probe-calls.mjs)
   -----------------------------------------------------------------------------
   Обходит все экраны звонков в трёх вьюпортах и проверяет автоматически:
     • нет горизонтального переполнения страницы и блоков за правым краем;
     • нет обрезанного текста без многоточия;
     • нет переносов посреди слова (ширина слова меряется по rect, не clientWidth);
     • из каждого экрана есть выход (кнопка «завершить»/«отклонить»/«назад»);
     • ничего не заезжает под нижнее меню, под композер и под шапку Telegram;
     • нет NaN / undefined / Infinity в видимом тексте;
     • нет ошибок JS и необработанных промисов;
     • нет демо-данных: выдуманных участников, «собеседник подключился», денег;
     • права: обычный участник не может звонить в общем чате OKO и в канале.

   Замер идёт ПОСЛЕ окончания анимаций (document.getAnimations() пуст).

   Запуск:  node oko-app/tools/probe-calls.mjs [--base URL] [--shots]
   Вывод:   JSON в stdout, скрины (с --shots) в oko-app/tools/probe-calls-out/
   ============================================================================= */
import { chromium } from 'playwright-core';
import fs from 'node:fs/promises';
import path from 'node:path';

const args = Object.fromEntries(
  process.argv.slice(2).join(' ').split('--').filter(Boolean)
    .map(s => { const [k, ...v] = s.trim().split(/\s+/); return [k, v.join(' ') || true]; })
);
const BASE = args.base || 'http://127.0.0.1:8199/index.html';
const SHOTS = !!args.shots;
const OUT = path.resolve('oko-app/tools/probe-calls-out');
const EXEC = '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';

const TG_HEADER = 56;
const TG_BOTTOM = 34;

const VIEWPORTS = [
  { id: 'phone',  label: 'Телефон 390×844',   width: 390,  height: 844,  mobile: true,  telegram: true },
  { id: 'narrow', label: 'Узкий Android 360', width: 360,  height: 740,  mobile: true,  telegram: false },
  { id: 'desktop',label: 'ПК 1440×900',       width: 1440, height: 900,  mobile: false, telegram: false },
];

/* ------------------------------------------------------------------ сценарии */
/* prep — что сделать до открытия экрана; open — открыть экран звонка. */
const SCENES = [
  {
    id: '01-personal-audio', name: 'Личный аудиозвонок (исходящий)',
    open: `okoCalls.personal('probe-user', false, {name:'Тестовый контакт'});`
  },
  {
    id: '02-personal-video', name: 'Личный видеозвонок (исходящий)',
    open: `okoCalls.personal('probe-user', true, {name:'Тестовый контакт'});`
  },
  {
    id: '03-incoming', name: 'Входящий видеозвонок',
    open: `okoCalls.incoming({name:'Тестовый контакт', video:true, from:'probe-user'});`
  },
  /* Созвон открывает создатель чата: подкладываем в CHATS тестовую группу
     с managed:true — обходных путей в правах у слоя нет. */
  {
    id: '04-conf', name: 'Групповой созвон (ведущий)',
    open: `okoCalls.conference('probe-chat', {chatName:'Рабочая группа', chat:okcTestChat()});`
  },
  {
    id: '05-conf-parts', name: 'Созвон · панель участников',
    open: `okoCalls.conference('probe-chat', {chatName:'Рабочая группа', chat:okcTestChat()});`,
    after: `document.querySelector('[data-okc-b="parts"]')?.click();`
  },
  {
    id: '06-conf-rules', name: 'Созвон · правила ведущего',
    open: `okoCalls.conference('probe-chat', {chatName:'Рабочая группа', chat:okcTestChat()});`,
    after: `document.getElementById('okc-gear')?.click();`
  },
  {
    id: '07-conf-menu', name: 'Созвон · меню участника',
    open: `okoCalls.conference('probe-chat', {chatName:'Рабочая группа', chat:okcTestChat()});`,
    after: `document.querySelector('#okc-stage [data-okc-p]')?.click();`
  },
  {
    id: '08-denied', name: 'Отказ в доступе к микрофону',
    open: `okoCalls.personal('probe-user', true, {name:'Тестовый контакт'});`,
    denyMedia: true
  },
  {
    id: '09-what', name: 'Честное объяснение «что нужно для звонков»',
    open: `okoCalls.personal('probe-user', false, {name:'Тестовый контакт'});`,
    after: `document.querySelector('#okc-note [data-okc-act]')?.click();`
  },
  {
    id: '10-minimized', name: 'Свёрнутый звонок · плашка над меню',
    open: `showTab('chats'); okoCalls.personal('probe-user', false, {name:'Тестовый контакт'});`,
    after: `okoCalls.minimize();`, pill: true
  },
  {
    id: '11-min-in-conv', name: 'Свёрнутый звонок поверх диалога',
    open: `showTab('chats'); const r=document.querySelector('#chatList .ci, #chatList > *'); r&&r.click();`,
    after: `okoCalls.personal('probe-user', false, {name:'Тестовый контакт'}); okoCalls.minimize();`, pill: true
  },
];

/* --------------------------------------------------------- init-script */
function initScript(vp) {
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

    /* Тестовая группа, созданная «мной»: проходит проверку прав легальным
       путём (kind:group + managed:true), а не в обход неё. */
    window.okcTestChat = function(){
      return {id:'probe-chat', ava:'РГ', name:'Рабочая группа', kind:'group', managed:true};
    };

    /* Окна слоя роста (партнёрка, тарифы) всплывают по своему таймеру и
       перекрывают экран звонка. Для замеров снимаем их сразу — это
       тестовая обвязка, приложение не трогаем. */
    /* На document_start documentElement ещё null — наблюдателя ставим позже,
       иначе исключение обрывает весь init-скрипт. */
    (function(){
      var kill = function(){
        var list = document.querySelectorAll ? document.querySelectorAll('.okg-scrim') : [];
        for (var i = 0; i < list.length; i++) list[i].remove();
      };
      setInterval(kill, 300);
      var arm = function(){
        if(window.MutationObserver && document.documentElement){
          try{ new MutationObserver(kill).observe(document.documentElement, {childList:true, subtree:true}); }catch(e){}
        }
      };
      if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', arm);
      else arm();
    })();

    /* Ловим ошибки JS для отчёта */
    window.__okcErrors = [];
    window.addEventListener('error', e=>window.__okcErrors.push(String(e.message||e)));
    window.addEventListener('unhandledrejection', e=>window.__okcErrors.push('promise: '+String((e.reason&&e.reason.message)||e.reason)));

    /* Камеру и микрофон даёт сам Chromium (--use-fake-device-for-media-stream),
       так что getUserMedia настоящий. Обёртку под ветку «доступ запрещён»
       ставим уже после загрузки страницы (okcArmMedia), потому что на
       document_start navigator.mediaDevices ещё может отсутствовать. */
    window.__okcDenyMedia = false;
    window.okcArmMedia = function(deny){
      window.__okcDenyMedia = !!deny;
      var md = navigator.mediaDevices;
      if(!md || !md.getUserMedia || md.__okcWrapped) return;
      var real = md.getUserMedia.bind(md);
      md.getUserMedia = function(c){
        if(window.__okcDenyMedia){ var e = new Error('denied'); e.name = 'NotAllowedError'; return Promise.reject(e); }
        return real(c);
      };
      md.__okcWrapped = true;
    };

    ${vp.telegram ? `
    (function(){
      var handlers = {};
      window.Telegram = { WebApp: {
        initData: 'query_id=OKOPROBE&user=%7B%22id%22%3A1%7D&auth_date=1&hash=x',
        initDataUnsafe: { user: { id: 1, first_name: 'Даниэль', username: 'ktodaniel' } },
        version: '8.0', platform: 'android', colorScheme: 'dark',
        isExpanded: true, isFullscreen: false,
        viewportHeight: ${vp.height - TG_HEADER}, viewportStableHeight: ${vp.height - TG_HEADER},
        safeAreaInset: { top: 0, bottom: ${TG_BOTTOM}, left: 0, right: 0 },
        contentSafeAreaInset: { top: 0, bottom: 0, left: 0, right: 0 },
        themeParams: {},
        ready(){}, expand(){}, close(){},
        requestFullscreen(){ window.__okoFullscreenRequested = true; },
        exitFullscreen(){}, disableVerticalSwipes(){}, enableVerticalSwipes(){},
        lockOrientation(){}, unlockOrientation(){},
        setHeaderColor(){}, setBackgroundColor(){}, setBottomBarColor(){},
        onEvent(n,f){ (handlers[n]=handlers[n]||[]).push(f); }, offEvent(){},
        HapticFeedback: { impactOccurred(){}, notificationOccurred(){}, selectionChanged(){} },
        BackButton: { isVisible:false, show(){this.isVisible=true;}, hide(){this.isVisible=false;}, onClick(){}, offClick(){} },
        MainButton: { show(){}, hide(){}, setText(){}, onClick(){} },
        CloudStorage: { getItem(k,cb){cb&&cb(null,null);}, setItem(k,v,cb){cb&&cb(null,true);} },
      }};
    })();` : ''}
  `;
}

/* ---------------------------------------------------------------- аудит DOM */
const AUDIT = `(function(cfg){
  const bad = [];
  const push = (type, node, detail) => bad.push({ type, sel: sel(node), detail });
  function sel(el){
    if(!el || !el.tagName) return '?';
    let s = el.tagName.toLowerCase();
    if(el.id) s += '#'+el.id;
    else if(el.className && typeof el.className === 'string') s += '.'+el.className.trim().split(/\\s+/).slice(0,2).join('.');
    return s;
  }
  const de = document.documentElement;
  const vw = window.innerWidth, vh = window.innerHeight;

  /* 1. Горизонтальное переполнение страницы */
  if(de.scrollWidth > vw + 1) bad.push({type:'page-overflow-x', sel:'html', detail: de.scrollWidth+' > '+vw});

  /* Что смотрим: активный экран звонка + плашка, либо всё видимое, если экрана нет */
  const scope = cfg.pill
    ? [document.getElementById('okc-pill')].filter(Boolean)
    : [document.getElementById('okc-screen')].filter(Boolean);
  const roots = scope.length ? scope : [document.body];

  const nodes = [];
  roots.forEach(r => { nodes.push(r); r.querySelectorAll('*').forEach(n => nodes.push(n)); });

  const vis = el => {
    const cs = getComputedStyle(el);
    if(cs.display === 'none' || cs.visibility === 'hidden' || cs.opacity === '0') return false;
    const r = el.getBoundingClientRect();
    return r.width > 0 && r.height > 0 && r.bottom > 0 && r.top < vh;
  };

  const seenText = [];
  for(const el of nodes){
    if(!el.tagName || el.tagName === 'SCRIPT' || el.tagName === 'STYLE' || el.tagName === 'SVG') continue;
    if(!vis(el)) continue;
    const r = el.getBoundingClientRect();
    const cs = getComputedStyle(el);

    /* 2. За правый край экрана */
    if(r.right > vw + 1.5 && r.width < vw * 2) push('out-of-screen-right', el, Math.round(r.right)+' > '+vw);
    if(r.left < -1.5 && r.width > 4) push('out-of-screen-left', el, Math.round(r.left));

    /* 3. Обрезанный текст без многоточия */
    const hasText = el.children.length === 0 && (el.textContent||'').trim().length > 1;
    if(hasText){
      const t = (el.textContent||'').trim();
      seenText.push(t);
      const clipped = el.scrollWidth > el.clientWidth + 2 && cs.overflow !== 'visible';
      if(clipped && cs.textOverflow !== 'ellipsis') push('clipped-text', el, JSON.stringify(t.slice(0,50)));
      const clippedY = el.scrollHeight > el.clientHeight + 3 && (cs.overflowY === 'hidden');
      if(clippedY) push('clipped-text-vertical', el, JSON.stringify(t.slice(0,50)));

      /* 4. Перенос посреди слова.
         ВАЖНО: у строчных элементов clientWidth === 0, меряем по rect. */
      const boxW = Math.max(el.clientWidth, r.width);
      if(cs.wordBreak === 'break-all' && !el.classList.contains('oko-breakable')){
        push('word-break-all', el, JSON.stringify(t.slice(0,40)));
      }
      const longest = t.split(/\\s+/).reduce((a,b)=> b.length>a.length?b:a, '');
      if(longest.length > 6 && boxW > 0){
        const probe = document.createElement('span');
        probe.style.cssText = 'position:absolute;left:-9999px;top:0;white-space:pre;visibility:hidden';
        probe.style.font = cs.font || (cs.fontWeight+' '+cs.fontSize+'/'+cs.lineHeight+' '+cs.fontFamily);
        probe.style.letterSpacing = cs.letterSpacing;
        probe.textContent = longest;
        document.body.appendChild(probe);
        const wordW = probe.getBoundingClientRect().width;
        probe.remove();
        if(wordW > boxW + 1 && cs.overflowWrap !== 'normal' && cs.wordBreak !== 'keep-all'){
          /* слово физически не влезает — допустимо только с переносом по дефису
             или если элемент прокручивается */
          if(cs.overflowWrap === 'break-word' || cs.overflowWrap === 'anywhere' || cs.wordBreak === 'break-all'){
            push('word-split', el, longest.slice(0,40)+' ('+Math.round(wordW)+'px в '+Math.round(boxW)+'px)');
          }
        }
      }
    }
  }

  /* 5. NaN / undefined / Infinity в видимом тексте */
  const allText = seenText.join(' | ');
  const junk = allText.match(/\\b(NaN|undefined|Infinity|\\[object Object\\]|null)\\b/g);
  if(junk) bad.push({type:'junk-number', sel:'text', detail:[...new Set(junk)].join(',')});

  /* 6. Демо-данные и ложные подтверждения */
  /* \\b в JS — ASCII-граница, с кириллицей не работает: пишем границы руками. */
  const B = '(^|[^А-Яа-яЁёA-Za-z])';
  const DEMO = [
    /собеседник подключил/i, /абонент подключил/i,
    new RegExp(B + 'в сети([^А-Яа-яЁё]|$)', 'i'),
    /гость\\s*\\d/i, /участник\\s*\\d/i,
    /отправлено\\s*\\(демо\\)/i,
    new RegExp(B + 'опубликовано', 'i'),
    new RegExp(B + 'активирован', 'i'),
    /[2-9]\\d*\\s*(участник|человек)\\w*\\s*в звонке/i
  ];
  DEMO.forEach(rx => { const m = allText.match(rx); if(m) bad.push({type:'demo-or-fake', sel:'text', detail:m[0]}); });

  /* 7. Из экрана есть выход */
  const scr = document.getElementById('okc-screen');
  if(scr && scr.classList.contains('on')){
    const exits = scr.querySelectorAll('[data-okc-b="end"],[data-okc-b="decline"],#okc-min');
    if(!exits.length) bad.push({type:'no-exit', sel:'#okc-screen', detail:'нет кнопки выхода'});
    let anyVisible = false;
    exits.forEach(e=>{ const r = e.getBoundingClientRect(); if(r.width>0 && r.height>0 && r.bottom<=vh+1) anyVisible = true; });
    if(!anyVisible) bad.push({type:'no-exit-visible', sel:'#okc-screen', detail:'кнопка выхода вне экрана'});
  }

  /* 8. Ничего не заезжает под нижнее меню / композер / шапку Telegram */
  const chromeTop = cfg.tgTop || 0;
  const tabs = document.getElementById('tabs');
  const comp = document.querySelector('#convBody .composer');
  const overlaps = (a, b) => a && b && !(a.right<=b.left || a.left>=b.right || a.bottom<=b.top || a.top>=b.bottom);

  const pill = document.getElementById('okc-pill');
  if(pill && !pill.hidden && pill.classList.contains('on')){
    const pr = pill.getBoundingClientRect();
    if(tabs && getComputedStyle(tabs).display !== 'none'){
      const tr = tabs.getBoundingClientRect();
      if(getComputedStyle(tabs).flexDirection !== 'column' && overlaps(pr, tr))
        bad.push({type:'pill-over-tabs', sel:'#okc-pill', detail:'плашка лежит на нижнем меню'});
      if(getComputedStyle(tabs).flexDirection === 'column' && overlaps(pr, tr))
        bad.push({type:'pill-over-sidebar', sel:'#okc-pill', detail:'плашка лежит на боковом меню'});
    }
    if(comp && getComputedStyle(comp).display !== 'none'){
      const cr = comp.getBoundingClientRect();
      if(overlaps(pr, cr)) bad.push({type:'pill-over-composer', sel:'#okc-pill', detail:'плашка лежит на поле ввода'});
    }
    if(pr.bottom > vh + 1) bad.push({type:'pill-below-viewport', sel:'#okc-pill', detail:Math.round(pr.bottom)+' > '+vh});
    if(pr.right > vw + 1) bad.push({type:'pill-out-right', sel:'#okc-pill', detail:Math.round(pr.right)});
  }

  if(scr && scr.classList.contains('on')){
    /* шапка Telegram: заголовок и кнопки не должны заезжать под неё */
    const top = scr.querySelector('.okc-top');
    if(top && chromeTop){
      const tr = top.getBoundingClientRect();
      if(tr.top < chromeTop - 0.5) bad.push({type:'under-tg-header', sel:'.okc-top', detail:Math.round(tr.top)+' < '+chromeTop});
    }
    /* контент не должен уходить под собственную панель кнопок */
    const bar = scr.querySelector('.okc-bar');
    const stage = scr.querySelector('.okc-stage, .okc-pers');
    if(bar && stage){
      const br = bar.getBoundingClientRect();
      const last = stage.lastElementChild;
      if(last){
        const lr = last.getBoundingClientRect();
        if(lr.height>0 && lr.bottom > br.top + 2 && stage.scrollHeight <= stage.clientHeight + 2)
          bad.push({type:'content-under-bar', sel: sel(last), detail: Math.round(lr.bottom)+' > '+Math.round(br.top)});
      }
      if(br.bottom > vh + 1) bad.push({type:'bar-below-viewport', sel:'.okc-bar', detail:Math.round(br.bottom)+' > '+vh});
    }
    /* каждая кнопка панели должна быть подписана для доступности */
    scr.querySelectorAll('.okc-bar .okc-b').forEach(b=>{
      if(!b.getAttribute('aria-label')) push('no-aria-label', b, b.textContent.trim().slice(0,30));
      const r = b.getBoundingClientRect();
      if(r.width < 40 || r.height < 40) push('tap-target-small', b, Math.round(r.width)+'x'+Math.round(r.height));
    });
    /* эмодзи в интерфейсе запрещены */
    const emo = /[\\u{1F300}-\\u{1FAFF}\\u{2600}-\\u{27BF}\\u{FE0F}]/u;
    if(emo.test(scr.innerText||'')) bad.push({type:'emoji-in-ui', sel:'#okc-screen', detail:'найден эмодзи'});
  }

  return { issues: bad, errors: (window.__okcErrors||[]).slice(0, 20) };
})`;

/* ------------------------------------------------------- ожидание анимаций */
async function settle(page) {
  await page.waitForTimeout(180);
  try {
    await page.waitForFunction(
      () => !document.getAnimations || document.getAnimations()
        .filter(a => a.playState === 'running' && a.effect &&
                     !(a.effect.getTiming && a.effect.getTiming().iterations === Infinity)).length === 0,
      { timeout: 2500 }
    );
  } catch (e) { /* бесконечные брендовые анимации — норма */ }
  await page.waitForTimeout(160);
}

/* ------------------------------------------------------------------- прогон */
async function run() {
  if (SHOTS) await fs.mkdir(OUT, { recursive: true });
  const browser = await chromium.launch({
    executablePath: EXEC,
    args: ['--no-sandbox',
           '--use-fake-ui-for-media-stream',      /* не спрашивать разрешение */
           '--use-fake-device-for-media-stream',  /* встроенные тестовые камера и микрофон */
           '--autoplay-policy=no-user-gesture-required'],
  });
  const report = { base: BASE, at: new Date().toISOString(), viewports: [], rights: null, honesty: null, totals: {} };

  for (const vp of VIEWPORTS) {
    const vres = { id: vp.id, label: vp.label, scenes: [] };
    const ctx = await browser.newContext({
      viewport: { width: vp.width, height: vp.height },
      isMobile: vp.mobile, hasTouch: vp.mobile,
      deviceScaleFactor: 1, permissions: ['camera', 'microphone'],
    });
    await ctx.addInitScript(initScript(vp));
    const page = await ctx.newPage();
    let jsErrors = [];
    page.on('pageerror', e => jsErrors.push(String(e.message || e)));
    await page.goto(BASE, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForTimeout(1800);
    await page.evaluate(`okoSkipAuth()`);
    await page.waitForFunction(() => !!window.okoCalls, { timeout: 20000 });

    for (const sc of SCENES) {
      jsErrors = [];
      try {
        /* чистое состояние перед сценой */
        await page.evaluate(`
          try{ window.okoCalls.end(); }catch(e){}
          try{ if(typeof closeConv==='function') closeConv(); }catch(e){}
          try{ window.__okcErrors.length = 0; }catch(e){}
          window.okcArmMedia(${sc.denyMedia ? 'true' : 'false'});
          try{ showTab('feed'); }catch(e){}
        `);
        await page.waitForTimeout(260);
        await page.evaluate(sc.open);
        await page.waitForTimeout(950);
        if (sc.after) { await page.evaluate(sc.after); await page.waitForTimeout(650); }
        await settle(page);

        const res = await page.evaluate(
          ([code, cfg]) => eval(code)(cfg),
          [AUDIT, { pill: !!sc.pill, tgTop: 0 }]
        );
        if (SHOTS) await page.screenshot({ path: path.join(OUT, `${vp.id}-${sc.id}.png`) });

        vres.scenes.push({
          id: sc.id, name: sc.name,
          issues: res.issues, errors: [...new Set([...jsErrors, ...res.errors])]
        });
      } catch (err) {
        vres.scenes.push({ id: sc.id, name: sc.name,
          issues: [{ type: 'scene-failed', sel: '-', detail: String(err.message || err) }], errors: jsErrors });
      }
    }
    await ctx.close();
    report.viewports.push(vres);
  }

  /* ---------- проверка прав: обычный участник не звонит в общем чате / канале ---------- */
  {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, permissions: ['camera', 'microphone'] });
    await ctx.addInitScript(initScript(VIEWPORTS[0]));
    const page = await ctx.newPage();
    await page.goto(BASE, { waitUntil: 'domcontentloaded', timeout: 90000 });
    await page.waitForTimeout(1400);
    await page.evaluate(`okoSkipAuth()`);
    await page.waitForFunction(() => !!window.okoCalls, { timeout: 15000 });
    report.rights = await page.evaluate(() => {
      const out = {};
      const asMember = () => { window.cpCanManage = () => false; };
      asMember();
      const mk = (o) => Object.assign({ id: 'x', name: 'x', kind: 'group' }, o);
      out.memberGeneralChat = window.okoCalls.canHost(mk({ id: 'oko-общий', name: 'Общий чат OKO', kind: 'group', owner: true }));
      out.memberChannel = window.okoCalls.canHost(mk({ id: 'ch-disc-4', name: 'OKO Новости', kind: 'channel', owner: true }));
      out.memberOwnGroup = window.okoCalls.canHost(mk({ id: 'g1', name: 'Моя группа', kind: 'group', managed: true }));
      out.memberDirect = window.okoCalls.canHost(mk({ id: 'd1', name: 'Человек', kind: 'direct' }));
      window.cpCanManage = () => true;
      out.ownerGeneralChat = window.okoCalls.canHost(mk({ id: 'oko-общий', name: 'Общий чат OKO', kind: 'group' }));
      window.cpCanManage = () => false;
      /* попытка обхода: вызов callStartConf напрямую участником */
      window.callStartConf('oko-общий', true, { chatName: 'Общий чат OKO' });
      out.bypassBlocked = !document.getElementById('okc-screen').classList.contains('on');
      /* попытка обхода 2: подсунуть объект чата без managed и с admin:true */
      window.callStartConf('oko-общий', true, {
        chatName: 'Общий чат OKO',
        chat: { id: 'oko-общий', name: 'Общий чат OKO', kind: 'group', owner: true }
      });
      out.bypassChatObjBlocked = !document.getElementById('okc-screen').classList.contains('on');
      /* легальный путь: своя группа — созвон должен открыться */
      window.callStartConf('probe-chat', false, {
        chatName: 'Рабочая группа', chat: window.okcTestChat()
      });
      out.legalHostOpens = document.getElementById('okc-screen').classList.contains('on');
      window.okoCalls.end();
      return out;
    });
    await ctx.close();
  }

  /* ---------- проверка честности: никаких «подключился» и таймера разговора ---------- */
  {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, permissions: ['camera', 'microphone'] });
    await ctx.addInitScript(initScript(VIEWPORTS[0]));
    const page = await ctx.newPage();
    await page.goto(BASE, { waitUntil: 'domcontentloaded', timeout: 90000 });
    await page.waitForTimeout(1400);
    await page.evaluate(`okoSkipAuth()`);
    await page.waitForFunction(() => !!window.okoCalls, { timeout: 15000 });
    await page.evaluate(`okoCalls.personal('probe-user', false, {name:'Тестовый контакт'})`);
    await page.waitForTimeout(4500); /* заведомо дольше старой «имитации соединения» 1.8 с */
    report.honesty = await page.evaluate(() => {
      const st = window.okoCalls.state();
      const txt = document.getElementById('okc-screen').innerText || '';
      return {
        phase: st.phase,
        neverConnected: st.phase !== 'connected',
        hasTransport: st.hasTransport,
        saysNoServer: /сервер связи|сигналинг/i.test(txt),
        noFakeOnline: !/(^|[^А-Яа-яЁёA-Za-z])в сети([^А-Яа-яЁё]|$)/i.test(txt),
        noFakePeerJoined: !/подключил(ся|ась|ись)/i.test(txt),
        timerLabelled: /проверка себя/i.test(txt),
        participantsInConf: null
      };
    });
    /* и то же для созвона: участник ровно один — я */
    await page.evaluate(`okoCalls.end(); okoCalls.conference('probe-chat',{chatName:'Рабочая группа', chat:okcTestChat()});`);
    await page.waitForTimeout(1800);
    report.honesty.participantsInConf = await page.evaluate(() => window.okoCalls.state().participants);
    report.honesty.confSaysAlone = await page.evaluate(() =>
      /только вы/i.test(document.getElementById('okc-screen').innerText || ''));
    await ctx.close();
  }

  await browser.close();

  /* ---------- сводка ---------- */
  let issues = 0, errors = 0;
  const byType = {};
  report.viewports.forEach(v => v.scenes.forEach(s => {
    issues += s.issues.length; errors += s.errors.length;
    s.issues.forEach(i => { byType[i.type] = (byType[i.type] || 0) + 1; });
  }));
  const r = report.rights || {};
  const h = report.honesty || {};
  report.totals = {
    scenes: report.viewports.reduce((a, v) => a + v.scenes.length, 0),
    issues, jsErrors: errors, byType,
    rightsOk: r.memberGeneralChat === false && r.memberChannel === false &&
              r.memberDirect === false && r.memberOwnGroup === true &&
              r.ownerGeneralChat === true && r.bypassBlocked === true &&
              r.bypassChatObjBlocked === true && r.legalHostOpens === true,
    honestyOk: h.neverConnected === true && h.saysNoServer === true &&
               h.noFakeOnline === true && h.noFakePeerJoined === true &&
               h.participantsInConf === 1 && h.confSaysAlone === true,
  };
  report.totals.clean = issues === 0 && errors === 0 && report.totals.rightsOk && report.totals.honestyOk;

  process.stdout.write(JSON.stringify(report, null, 2) + '\n');
  process.exit(report.totals.clean ? 0 : 1);
}

run().catch(e => { console.error(e); process.exit(2); });
