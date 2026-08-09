/* ============================================================================
   OKO · Пробник экрана «ОКО Ai»
   ----------------------------------------------------------------------------
   Проверяет ровно то, на что жаловался Даниэль:
     1. Нигде на экране нет слова «Помощник», зато есть «ОКО Ai».
     2. Композер прижат к низу вьюпорта (с учётом var(--oko-safe-bottom)).
     3. Композер НЕ перекрывает последнее сообщение — прямоугольники не пересекаются.
     4. Поле ввода принимает текст, отправка добавляет пузырь в ленту.
     5. Есть кнопка «назад», и клик по ней уводит с экрана.
   Плюс: вёрстка совпадает с ЛС (те же классы), нет горизонтального переполнения,
   нет ошибок в консоли, скриншот в oko-app/tools/ai-screen.png.

   Запуск:  node oko-app/tools/probe-ai.mjs
            (поднимает свой статический сервер на свободном порту — ничего запускать не нужно)
   ============================================================================ */
import { chromium } from 'playwright-core';
import http from 'node:http';
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';

const ROOT = path.resolve('oko-app/prototype');
const OUT  = process.env.OKO_SHOT || 'oko-app/tools/ai-screen.png';

/* Свой статический сервер на случайном порту: пробник не зависит от чужого
   http.server на 8199 (его делят другие прогоны) и запускается одной командой. */
const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8', '.png': 'image/png', '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml', '.webp': 'image/webp', '.glb': 'model/gltf-binary',
  '.woff2': 'font/woff2', '.ico': 'image/x-icon',
};
const SRV_LOG = !!process.env.OKO_SRV_LOG;
const server = http.createServer((req, res) => {
  if (SRV_LOG) console.error('[srv] ' + req.method + ' ' + req.url);
  const rel = decodeURIComponent((req.url || '/').split('?')[0]);
  const file = path.join(ROOT, rel === '/' ? '/index.html' : rel);
  if (!file.startsWith(ROOT)) { res.writeHead(403).end(); return; }
  fs.stat(file, (e, st) => {
    if (e || !st.isFile()) { res.writeHead(404, { 'Content-Type': 'text/plain' }).end('404'); return; }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(file).toLowerCase()] || 'application/octet-stream',
                         'Content-Length': st.size, 'Cache-Control': 'no-store' });
    if (SRV_LOG) res.on('finish', () => console.error('[srv] done ' + req.url + ' (' + st.size + ')'));
    const rs2 = fs.createReadStream(file);
    rs2.on('error', err => { if (SRV_LOG) console.error('[srv] err ' + req.url + ' ' + err.message); res.end(); });
    rs2.pipe(res);
  });
});
await new Promise(r => server.listen(0, '127.0.0.1', r));
const PORT = server.address().port;
const BASE = process.env.OKO_BASE || `http://127.0.0.1:${PORT}/index.html`;

const browser = await chromium.launch({
  executablePath: process.env.OKO_CHROME || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  args: ['--no-sandbox'],
});
const ctx = await browser.newContext({
  viewport: { width: 390, height: 844 },
  isMobile: true, hasTouch: true, deviceScaleFactor: 2,
  /* SW при обновлении перезагружает страницу и рвёт ожидание навигации — гасим */
  serviceWorkers: 'block',
});

/* Пропуск авторизации — тот же приём, что в audit.mjs */
await ctx.addInitScript(`
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
    localStorage.removeItem('oko-helper-history');
  }catch(e){}
`);

const page = await ctx.newPage();
const errors = [];      /* настоящие JS-исключения */
const badUrls = [];     /* не загрузившиеся ресурсы — отдельно, это шум окружения */
page.on('pageerror', e => errors.push('pageerror: ' + String(e)));
page.on('console', m => {
  if (m.type() !== 'error') return;
  const t = m.text();
  /* «Failed to load resource» дублирует response/requestfailed — не считаем дважды */
  if (/Failed to load resource/i.test(t)) return;
  errors.push('console: ' + t.slice(0, 200));
});
page.on('response', r => { if (r.status() >= 400) badUrls.push(r.status() + ' ' + r.url()); });
page.on('requestfailed', r => badUrls.push('FAIL ' + r.url()));

/* Бэкенд ОКО Ai в песочнице недоступен. Управляем ответом сами:
   'slow'    — отвечает через 1.2 c (видно «печатает…» и настоящий ответ);
   'offline' — соединение рвётся (проверяем честное сообщение без имитации ИИ). */
let apiMode = 'slow';
const API_REPLY = 'Ответ сервера ОКО Ai для пробника.';
await page.route('**/api.php*', async route => {
  if (apiMode === 'offline') { await route.abort('connectionreset'); return; }
  await new Promise(r => setTimeout(r, 1200));
  await route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({ ok: true, reply: API_REPLY }),
  });
});


/* Навигация без гонок: ждём фиксацию документа, затем реальную готовность
   ядра и слоя ОКО Ai. waitUntil:'domcontentloaded' тут ненадёжен — страница
   успевает переинициализироваться, и ожидание срывается. */
async function openApp(pg) {
  await pg.goto(BASE, { waitUntil: 'commit', timeout: 60000 });
  await pg.waitForFunction(
    () => document.readyState !== 'loading' && typeof window.openMa === 'function' && !!window.okoAi,
    null, { timeout: 60000 });
  await pg.waitForTimeout(900);
}

const step = m => console.error('[probe] ' + m);
const report = { base: BASE, checks: {}, fail: [], errors: [] };
const check = (name, ok, extra) => {
  report.checks[name] = extra === undefined ? ok : Object.assign({ ok }, extra);
  if (!ok) report.fail.push(name);
};

step('main: goto');
await openApp(page);

/* --- эталон: настоящий личный чат, с которым сравниваем ОКО Ai --- */
step('main: measuring real DM');
await page.evaluate(`okoSkipAuth(); showTab('chats');`);
await page.waitForTimeout(500);
await page.evaluate(`const r=document.querySelector('#chatList .chat-item'); r&&r.click();`);
await page.waitForTimeout(700);
/* В ЛС кнопка отправки появляется вместе с первым символом — чтобы сравнивать
   её с кнопкой ОКО Ai, надо сначала что-то напечатать. */
await page.fill('#msgInput', 'x');
await page.waitForTimeout(250);
const dm = await page.evaluate(() => {
  const box = el => {
    if (!el) return null;
    const cs = getComputedStyle(el), r = el.getBoundingClientRect();
    return {
      paddingTop: cs.paddingTop, paddingBottom: cs.paddingBottom,
      paddingLeft: cs.paddingLeft, paddingRight: cs.paddingRight,
      borderTopWidth: cs.borderTopWidth, background: cs.backgroundColor,
      gap: cs.columnGap, alignItems: cs.alignItems, display: cs.display,
      bottom: +r.bottom.toFixed(2),
    };
  };
  const small = el => {
    if (!el) return null;
    const cs = getComputedStyle(el), r = el.getBoundingClientRect();
    return {
      w: Math.round(r.width), h: Math.round(r.height),
      radius: cs.borderTopLeftRadius, background: cs.backgroundColor, fontSize: cs.fontSize,
    };
  };
  const conv = document.getElementById('conv');
  return {
    opened: getComputedStyle(conv).display !== 'none',
    convOpenClass: document.getElementById('app').classList.contains('conv-open'),
    innerHeight: window.innerHeight,
    composer: box(conv.querySelector('.composer')),
    input: small(conv.querySelector('#msgInput')),
    send: small(conv.querySelector('#sendBtn')),
    msgs: (() => { const cs = getComputedStyle(conv.querySelector('.msgs'));
      return { padding: cs.padding, overflowY: cs.overflowY, flexGrow: cs.flexGrow, gap: cs.rowGap }; })(),
    head: (() => { const cs = getComputedStyle(conv.querySelector('.conv-head'));
      return { paddingTop: cs.paddingTop, borderBottomWidth: cs.borderBottomWidth }; })(),
  };
});
await page.fill('#msgInput', '');
await page.evaluate(`typeof closeConv==='function' && closeConv();`);
await page.waitForTimeout(300);
check('dm_reference_captured',
  dm.opened === true && dm.convOpenClass === true && !!dm.composer && dm.send.w > 0,
  { convOpenClass: dm.convOpenClass, composerBottom: dm.composer && dm.composer.bottom,
    innerHeight: dm.innerHeight, sendW: dm.send && dm.send.w });

/* --- открываем экран ровно так, как это делает человек --- */
await page.evaluate(`okoSkipAuth(); showTab('mini'); openMa('helper');`);
await page.waitForTimeout(700);

/* 0. Экран вообще открылся и собран на классах ЛС */
const shell = await page.evaluate(() => {
  const s = document.getElementById('okoAiScreen');
  if (!s) return { present: false };
  const cs = getComputedStyle(s);
  return {
    present: true,
    open: s.classList.contains('open'),
    display: cs.display,
    head: !!s.querySelector('.conv-head'),
    msgs: !!s.querySelector('.msgs'),
    composer: !!s.querySelector('.composer'),
    // классы ЛС используются, а не копии
    reusedClasses: ['.conv-head', '.msgs', '.composer'].every(c => !!s.querySelector(c)),
    emoji: /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u.test(s.innerText || ''),
  };
});
check('screen_mounted', shell.present && shell.open && shell.display === 'flex', shell);
check('reuses_dm_classes', !!shell.reusedClasses);
check('no_emoji', shell.emoji === false);

/* 1. Нейминг */
const naming = await page.evaluate(() => {
  const t = document.body.innerText || '';
  return {
    hasPomoshnik: /Помощник|помощник|ПОМОЩНИК/.test(t),
    hasOkoAi: t.includes('ОКО Ai'),
    headName: (document.querySelector('#okoAiScreen .conv-head .who') || {}).textContent || '',
  };
});
check('no_word_pomoshnik', naming.hasPomoshnik === false, { headName: naming.headName });
check('has_oko_ai', naming.hasOkoAi === true);

/* 2. Композер прижат к низу */
const bottom = await page.evaluate(() => {
  const c = document.querySelector('#okoAiScreen .composer');
  const cs = getComputedStyle(c);
  const r = c.getBoundingClientRect();
  const raw = getComputedStyle(document.documentElement).getPropertyValue('--oko-safe-bottom').trim();
  const safeBottom = parseFloat(raw) || 0;
  const padBottom = parseFloat(cs.paddingBottom) || 0;
  return {
    composerBottom: +r.bottom.toFixed(2),
    innerHeight: window.innerHeight,
    safeBottom,
    paddingBottom: padBottom,
    /* сам блок вплотную к низу вьюпорта */
    deltaViewport: +Math.abs(r.bottom - window.innerHeight).toFixed(2),
    /* содержимое (поле, кнопки) — выше безопасной зоны */
    contentBottom: +(r.bottom - padBottom).toFixed(2),
    deltaSafe: +Math.abs((r.bottom - padBottom) - (window.innerHeight - safeBottom)).toFixed(2),
    position: cs.position,
  };
});
/* Композер стоит вплотную к низу вьюпорта, а безопасная зона живёт внутри его
   padding-bottom (ровно так же, как в ЛС: .composer{padding-bottom:max(--oko-safe-bottom,8px)}). */
check('composer_pinned_to_bottom',
  bottom.deltaViewport <= 2 && bottom.paddingBottom >= Math.max(bottom.safeBottom, 8) - 0.5, bottom);

/* Геометрия и стили композера/ленты совпадают с настоящим ЛС */
const parity = await page.evaluate(() => {
  const s = document.getElementById('okoAiScreen');
  const box = el => {
    if (!el) return null;
    const cs = getComputedStyle(el), r = el.getBoundingClientRect();
    return {
      paddingTop: cs.paddingTop, paddingBottom: cs.paddingBottom,
      paddingLeft: cs.paddingLeft, paddingRight: cs.paddingRight,
      borderTopWidth: cs.borderTopWidth, background: cs.backgroundColor,
      gap: cs.columnGap, alignItems: cs.alignItems, display: cs.display,
      bottom: +r.bottom.toFixed(2),
    };
  };
  const small = el => {
    if (!el) return null;
    const cs = getComputedStyle(el), r = el.getBoundingClientRect();
    return {
      w: Math.round(r.width), h: Math.round(r.height),
      radius: cs.borderTopLeftRadius, background: cs.backgroundColor, fontSize: cs.fontSize,
    };
  };
  return {
    composer: box(s.querySelector('.composer')),
    input: small(s.querySelector('#okoAiInput')),
    send: small(s.querySelector('#okoAiSend')),
    msgs: (() => { const cs = getComputedStyle(s.querySelector('.msgs'));
      return { padding: cs.padding, overflowY: cs.overflowY, flexGrow: cs.flexGrow, gap: cs.rowGap }; })(),
    head: (() => { const cs = getComputedStyle(s.querySelector('.conv-head'));
      return { paddingTop: cs.paddingTop, borderBottomWidth: cs.borderBottomWidth }; })(),
  };
});
const same = (a, b, keys) => keys.filter(k => String(a[k]) !== String(b[k]));
const diff = {
  composer: same(dm.composer, parity.composer,
    ['paddingTop', 'paddingBottom', 'paddingLeft', 'paddingRight', 'borderTopWidth', 'background', 'gap', 'alignItems', 'display', 'bottom']),
  input: same(dm.input, parity.input, ['h', 'radius', 'background', 'fontSize']),
  send:  same(dm.send,  parity.send,  ['w', 'h', 'radius', 'background']),
  msgs:  same(dm.msgs,  parity.msgs,  ['padding', 'overflowY', 'flexGrow', 'gap']),
  head:  same(dm.head,  parity.head,  ['paddingTop', 'borderBottomWidth']),
};
const diffCount = Object.values(diff).reduce((n, a) => n + a.length, 0);
check('matches_real_dm', diffCount === 0, { diff, dm, okoAi: parity });

/* 3. Шапка: аватар, имя, статус, «назад», меню */
const head = await page.evaluate(() => {
  const s = document.getElementById('okoAiScreen');
  const img = s.querySelector('.conv-head .oko-ai-ava img');
  return {
    back: !!s.querySelector('.conv-head .back'),
    avatar: !!img,
    avatarSrc: img ? img.getAttribute('src') : null,
    avatarLoaded: img ? (img.naturalWidth > 0) : false,
    name: (s.querySelector('.conv-head .who') || {}).textContent || '',
    status: (s.querySelector('.conv-head .status') || {}).textContent || '',
    menu: !!s.querySelector('#okoAiMenuBtn'),
  };
});
check('head_complete',
  head.back && head.avatar && head.avatarLoaded && head.name === 'ОКО Ai' && !!head.status && head.menu, head);

/* 4. Пустой экран честный (нет выдуманной переписки) */
const empty = await page.evaluate(() => {
  const s = document.getElementById('okoAiScreen');
  return {
    bubbles: s.querySelectorAll('.msgs .msg').length,
    emptyState: !!s.querySelector('.oko-ai-empty'),
  };
});
check('honest_empty_state', empty.bubbles === 0 && empty.emptyState === true, empty);
await page.screenshot({ path: OUT.replace(/\.png$/, '-empty.png') });

/* 5. Поле ввода принимает текст и отправка добавляет сообщение */
await page.fill('#okoAiInput', 'Проверка ввода из пробника');
const typed = await page.inputValue('#okoAiInput');
check('input_accepts_text', typed === 'Проверка ввода из пробника', { typed });

apiMode = 'slow';
await page.click('#okoAiSend');
await page.waitForTimeout(350);          /* окно, пока сервер «думает» */
const sent = await page.evaluate(() => {
  const s = document.getElementById('okoAiScreen');
  const out = s.querySelectorAll('.msgs .msg.out');
  const last = out[out.length - 1];
  return {
    outCount: out.length,
    lastText: last ? last.textContent.trim() : '',
    inputCleared: document.getElementById('okoAiInput').value === '',
    typingShown: !!s.querySelector('.msgs .msg.typing'),
    typingDots: s.querySelectorAll('.msgs .msg.typing .tdot').length,
    status: (s.querySelector('.conv-head .status') || {}).textContent || '',
  };
});
check('send_adds_bubble',
  sent.outCount === 1 && sent.lastText.indexOf('Проверка ввода из пробника') === 0 && sent.inputCleared, sent);
check('typing_indicator',
  sent.typingShown === true && sent.typingDots === 3 && sent.status === 'печатает…', sent);

/* Ответ сервера приходит обычным входящим пузырём ЛС */
await page.waitForTimeout(1600);
const replied = await page.evaluate(() => {
  const s = document.getElementById('okoAiScreen');
  const ins = s.querySelectorAll('.msgs .msg.in:not(.typing)');
  const last = ins[ins.length - 1];
  return {
    inCount: ins.length,
    lastIn: last ? last.textContent.trim() : '',
    typingGone: !s.querySelector('.msgs .msg.typing'),
    status: (s.querySelector('.conv-head .status') || {}).textContent || '',
  };
});
check('reply_rendered_as_in_bubble',
  replied.typingGone && replied.inCount === 1 &&
  replied.lastIn.indexOf('Ответ сервера ОКО Ai для пробника.') === 0 &&
  replied.status === 'на связи', replied);

/* Бэкенд недоступен — ждём честный текст, а не имитацию ответа нейросети */
apiMode = 'offline';
await page.fill('#okoAiInput', 'Второй вопрос без сети');
await page.click('#okoAiSend');
await page.waitForTimeout(1200);
const honest = await page.evaluate(() => {
  const s = document.getElementById('okoAiScreen');
  const ins = s.querySelectorAll('.msgs .msg.in:not(.typing)');
  const last = ins[ins.length - 1];
  return {
    inCount: ins.length,
    lastIn: last ? last.textContent.trim().slice(0, 130) : '',
    status: (s.querySelector('.conv-head .status') || {}).textContent || '',
    typingGone: !s.querySelector('.msgs .msg.typing'),
  };
});
check('honest_offline_reply',
  honest.typingGone && /Нет связи с сервером ОКО Ai/.test(honest.lastIn) && honest.status === 'нет связи', honest);

/* 6. Композер не перекрывает последнее сообщение */
const overlap = await page.evaluate(() => {
  const s = document.getElementById('okoAiScreen');
  const msgs = s.querySelectorAll('.msgs .msg');
  const last = msgs[msgs.length - 1];
  const c = s.querySelector('.composer');
  if (!last) return { skipped: true };
  const a = last.getBoundingClientRect(), b = c.getBoundingClientRect();
  const inter = !(a.bottom <= b.top + 0.5 || a.top >= b.bottom - 0.5 || a.right <= b.left || a.left >= b.right);
  return {
    msgBottom: +a.bottom.toFixed(2),
    composerTop: +b.top.toFixed(2),
    intersects: inter,
    gap: +(b.top - a.bottom).toFixed(2),
  };
});
check('composer_does_not_cover_messages', overlap.intersects === false, overlap);

/* 7. Автоскролл ленты вниз */
const scrolled = await page.evaluate(() => {
  const m = document.querySelector('#okoAiScreen .msgs');
  return {
    scrollTop: Math.round(m.scrollTop),
    max: Math.round(m.scrollHeight - m.clientHeight),
    atBottom: (m.scrollHeight - m.clientHeight - m.scrollTop) <= 4,
  };
});
check('autoscroll_bottom', scrolled.atBottom === true, scrolled);

/* 8. Нет горизонтального переполнения и текст не режется */
const layout = await page.evaluate(() => {
  const s = document.getElementById('okoAiScreen');
  const bad = [];
  s.querySelectorAll('*').forEach(n => {
    const r = n.getBoundingClientRect();
    if (r.width && (r.right > window.innerWidth + 1 || r.left < -1))
      bad.push((n.className || n.tagName) + ' → ' + Math.round(r.left) + '..' + Math.round(r.right));
  });
  return { pageScrollW: document.documentElement.scrollWidth, viewport: window.innerWidth, overflow: bad.slice(0, 5) };
});
check('no_horizontal_overflow',
  layout.pageScrollW <= layout.viewport + 1 && layout.overflow.length === 0, layout);

step('main: screenshot');
await page.screenshot({ path: OUT });

/* 9. Кнопка «назад» уводит с экрана */
await page.click('#okoAiScreen .conv-head .back');
await page.waitForTimeout(500);
const closed = await page.evaluate(() => {
  const s = document.getElementById('okoAiScreen');
  const grid = document.getElementById('maGrid');
  return {
    screenOpen: s.classList.contains('open'),
    screenDisplay: getComputedStyle(s).display,
    maGridVisible: grid ? getComputedStyle(grid).display !== 'none' : false,
    bodyHasPomoshnik: /Помощник/.test(document.body.innerText || ''),
  };
});
check('back_button_exits',
  closed.screenOpen === false && closed.screenDisplay === 'none' && closed.maGridVisible === true, closed);

/* 10. Повторный вход работает (не одноразовый экран) */
await page.evaluate(`openMa('helper');`);
await page.waitForTimeout(500);
const reopen = await page.evaluate(() => {
  const s = document.getElementById('okoAiScreen');
  return {
    open: s.classList.contains('open'),
    bubbles: s.querySelectorAll('.msgs .msg').length,     /* история сохранилась */
  };
});
check('reopen_keeps_history', reopen.open === true && reopen.bubbles >= 4, reopen);

report.errors = errors;
check('no_js_errors', errors.length === 0, { count: errors.length, first: errors.slice(0, 3) });

/* Не загрузившиеся ресурсы: внешние CDN режет egress-прокси песочницы,
   отсутствующие oko-*.js — файлы соседних агентов. Валим прогон только если
   не поднялось то, от чего зависит сам экран ОКО Ai. */
const own = badUrls.filter(u =>
  /\/(oko-ai\.js|oko-icon-192\.png|app\.js|app\.css|oko-v2\.js|oko-v2\.css|index\.html)(\?|$)/.test(u));
report.resourceIssues = [...new Set(badUrls)];
check('oko_ai_assets_ok', own.length === 0, { own });

/* ------------------------------------------------------------------------
   Второй проход: Telegram Mini App с ненулевыми инсетами (fullsize, не
   fullscreen). Проверяем, что шапка не уезжает под интерфейс Telegram, а
   содержимое композера стоит над нижней перетяжкой.
   ------------------------------------------------------------------------ */
step('main: done, starting telegram pass');
await ctx.close();
const TG_BOTTOM = 34;
const tgCtx = await browser.newContext({
  viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2,
  serviceWorkers: 'block',
});
await tgCtx.addInitScript(`
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
    localStorage.removeItem('oko-helper-history');
  }catch(e){}
  window.Telegram = { WebApp: {
    initData:'query_id=OKOPROBE&user=%7B%22id%22%3A1%7D&auth_date=1&hash=x',
    initDataUnsafe:{ user:{ id:1, first_name:'Даниэль', username:'ktodaniel' } },
    version:'8.0', platform:'android', colorScheme:'dark',
    isExpanded:true, isFullscreen:false,
    viewportHeight:788, viewportStableHeight:788,
    safeAreaInset:{ top:0, bottom:${TG_BOTTOM}, left:0, right:0 },
    contentSafeAreaInset:{ top:0, bottom:0, left:0, right:0 },
    themeParams:{}, ready(){}, expand(){}, close(){},
    requestFullscreen(){ window.__okoFullscreenRequested = true; },
    exitFullscreen(){}, disableVerticalSwipes(){}, enableVerticalSwipes(){},
    lockOrientation(){}, unlockOrientation(){},
    setHeaderColor(){}, setBackgroundColor(){}, setBottomBarColor(){},
    onEvent(){}, offEvent(){},
    HapticFeedback:{ impactOccurred(){}, notificationOccurred(){}, selectionChanged(){} },
    BackButton:{ isVisible:false, show(){this.isVisible=true;}, hide(){this.isVisible=false;}, onClick(){}, offClick(){} },
    MainButton:{ show(){}, hide(){}, setText(){}, onClick(){} }
  }};
`);
step('tg: newPage');
const tgPage = await tgCtx.newPage();
step('tg: goto');
await openApp(tgPage);
step('tg: open screen');
await tgPage.evaluate(`okoSkipAuth(); showTab('mini'); openMa('helper');`);
await tgPage.waitForTimeout(700);
/* В песочнице telegram.org режет egress-прокси, поэтому бутстрап ядра
   (app.js → applySafeArea) не срабатывает и инсеты остаются нулевыми.
   Ставим те же переменные вручную — ровно то, что делает applySafeArea
   в fullsize-режиме: top=0 (место держит Telegram), bottom=safeAreaInset.bottom. */
await tgPage.evaluate(`(function(){
  var rs = document.documentElement.style;
  var tg = window.Telegram.WebApp;
  var sa = tg.safeAreaInset || {}, ca = tg.contentSafeAreaInset || {};
  rs.setProperty('--oko-safe-top', (tg.isFullscreen ? ((sa.top||0)+(ca.top||0)) : 0) + 'px');
  rs.setProperty('--oko-safe-bottom', Math.max(sa.bottom||0, ca.bottom||0, 0) + 'px');
  rs.setProperty('--oko-safe-left', (sa.left||0) + 'px');
  rs.setProperty('--oko-safe-right', (sa.right||0) + 'px');
})();`);
await tgPage.waitForTimeout(250);
const tg = await tgPage.evaluate(() => {
  const s = document.getElementById('okoAiScreen');
  const c = s.querySelector('.composer'), h = s.querySelector('.conv-head');
  const cs = getComputedStyle(c), hs = getComputedStyle(h);
  const rc = c.getBoundingClientRect(), rh = h.getBoundingClientRect();
  const root = getComputedStyle(document.documentElement);
  const sb = parseFloat(root.getPropertyValue('--oko-safe-bottom')) || 0;
  const stp = parseFloat(root.getPropertyValue('--oko-safe-top')) || 0;
  return {
    open: s.classList.contains('open'),
    safeTop: stp, safeBottom: sb,
    headPadTop: parseFloat(hs.paddingTop) || 0,
    headTop: +rh.top.toFixed(2),
    composerBottom: +rc.bottom.toFixed(2),
    composerPadBottom: parseFloat(cs.paddingBottom) || 0,
    contentBottom: +(rc.bottom - (parseFloat(cs.paddingBottom) || 0)).toFixed(2),
    innerHeight: window.innerHeight,
    fullscreenRequested: !!window.__okoFullscreenRequested,
  };
});
check('telegram_insets_respected',
  tg.open &&
  tg.safeBottom >= TG_BOTTOM - 0.5 &&
  tg.composerPadBottom >= tg.safeBottom - 0.5 &&
  Math.abs(tg.contentBottom - (tg.innerHeight - tg.safeBottom)) <= 2 &&
  tg.headPadTop >= Math.max(10, tg.safeTop) - 0.5 &&
  tg.fullscreenRequested === false, tg);
step('tg: screenshot');
await tgPage.screenshot({ path: OUT.replace(/\.png$/, '-tg.png') });
step('tg: close ctx');
await tgCtx.close();

report.screenshot = OUT;
report.ok = report.fail.length === 0;

step('closing browser');
await browser.close();
await new Promise(r => server.close(r));
console.log(JSON.stringify(report, null, 2));
process.exit(report.ok ? 0 : 1);
