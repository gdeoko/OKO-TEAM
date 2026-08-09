/* ============================================================================
   OKO · ПРОЖИМАЕМ КАЖДУЮ КНОПКУ

   Даниэль просил «тесты каждой функции и клика всего приложения». Аудит
   проверяет вёрстку на статичных экранах — этот харнесс проверяет ПОВЕДЕНИЕ:
   обходит экраны, находит все видимые кликабельные элементы и нажимает каждый.

   После каждого нажатия проверяет четыре вещи:
     1. не упал ли JS (pageerror / console error);
     2. не застряли ли мы — из нового состояния есть выход (кнопка «назад»,
        крестик, Escape или видимое нижнее меню);
     3. не появилось ли горизонтальное переполнение;
     4. не обрезался ли текст и не порвался ли посреди слова.

   После каждого клика состояние восстанавливается: Escape, закрытие шторок,
   возврат на исходный экран. Так один сломанный элемент не валит весь обход.

   Запуск:
     node oko-app/tools/probe-clicks.mjs [--screens feed,chats] [--max 40]
   ============================================================================ */
import { chromium } from 'playwright-core';
import fs from 'node:fs/promises';

const args = Object.fromEntries(
  process.argv.slice(2).join(' ').split('--').filter(Boolean)
    .map(s => { const [k, ...v] = s.trim().split(/\s+/); return [k, v.join(' ') || true]; })
);
const MAX_PER_SCREEN = +(args.max || 60);
const OUT = 'oko-app/tools/clicks-out';

/* Экраны обхода: имя → как на него попасть. */
const SCREENS = [
  ['лента',        `showTab('feed')`],
  ['чаты',         `showTab('chats')`],
  ['диалог',       `showTab('chats'); (document.querySelector('#chatList .ci, #chatList > *')||{click(){}}).click()`],
  ['мини-аппы',    `showTab('mini')`],
  ['кошелёк',      `showTab('wallet')`],
  ['профиль',      `showTab('profile')`],
  ['партнёрка',    `showTab('partner')`],
  ['академия',     `showTab('academy')`],
  ['игры',         `showTab('games')`],
  ['реклама',      `showTab('ads')`],
  ['ton',          `showTab('ton')`],
  ['биржа',        `showTab('mini'); openMa('market')`],
  ['око-ai',       `showTab('mini'); openMa('helper')`],
  ['система',      `showTab('mini'); openMa('system')`],
  ['контент-завод',`showTab('mini'); openMa('factory')`],
  ['проверка',     `showTab('mini'); openMa('video')`],
  ['соцсети',      `showTab('mini'); openMa('socials')`],
  ['уведомления',  `typeof openNotifs==='function'&&openNotifs()`],
  ['поиск',        `typeof openSearch==='function'&&openSearch()`],
  ['настройки',    `showTab('profile'); typeof st2Open==='function'&&st2Open()`],
  ['каналы',       `typeof chOpen==='function'&&chOpen('list')`],
];
const only = args.screens && args.screens !== true ? String(args.screens).split(',') : null;

/* Кнопки, которые нельзя жать в автотесте: они уводят из приложения,
   стирают данные или требуют разрешений устройства. */
const SKIP_TEXT = /выйти|удалить аккаунт|очистить|сбросить|выход|оплатить|перейти к оплате|logout/i;

const probeJs = `(() => {
  const VW = innerWidth, out = { overflowX: false, clipped: [], midWord: [], exit: false };
  out.overflowX = document.documentElement.scrollWidth > VW + 1;
  /* Есть ли выход: назад, крестик, Escape-слой или видимое нижнее меню */
  const backSel = '.oko-back, .back, .ep-cancel, .ch-back, [aria-label*="азад"], [aria-label*="акрыть"], .okr-close, .soc-back';
  const vis = el => { if(!el) return false; const cs = getComputedStyle(el); if(cs.display==='none'||cs.visibility==='hidden'||+cs.opacity===0) return false; const r = el.getBoundingClientRect(); return r.width>4 && r.height>4 && r.bottom>0 && r.top<innerHeight; };
  out.exit = [...document.querySelectorAll(backSel)].some(vis) || vis(document.querySelector('nav#tabs, nav'));
  for (const el of document.querySelectorAll('body *')) {
    if (el.ownerSVGElement) continue;
    const cs = getComputedStyle(el);
    if (cs.display === 'none' || cs.visibility === 'hidden' || +cs.opacity === 0) continue;
    const r = el.getBoundingClientRect();
    if (!r.width || !r.height || r.bottom < 0 || r.top > innerHeight) continue;
    const txt = (el.textContent || '').trim();
    if (txt && el.children.length === 0) {
      const intentional = cs.textOverflow === 'ellipsis' || cs.webkitLineClamp !== 'none';
      if (!intentional && el.scrollWidth > el.clientWidth + 2 && cs.overflow !== 'visible')
        out.clipped.push(txt.slice(0, 40));
      /* Перенос посреди слова считаем ФАКТОМ, а не подозрением: берём самое
         длинное слово без пробелов, меряем его настоящую ширину тем же
         шрифтом и сравниваем с шириной ячейки. Проверка «стоит break-all и
         элемент узкий» давала ложные срабатывания на «До 3 подписок» —
         такой текст спокойно переносится по пробелу. */
      if ((cs.wordBreak === 'break-all' || cs.overflowWrap === 'anywhere') && r.width < 200) {
        const word = txt.split(/\s+/).reduce((a, w) => w.length > a.length ? w : a, '');
        if (word.length >= 6) {
          /* У строчных элементов clientWidth всегда 0 — сравнение с ним
             объявляло переносом любое слово в любом <span>. Берём реальную
             ширину прямоугольника, а clientWidth используем только когда он
             осмысленный (блочные элементы). */
          const avail = Math.max(el.clientWidth, Math.round(r.width));
          if (avail > 4) {
            out._cv = out._cv || document.createElement('canvas');
            const g = out._cv.getContext('2d');
            g.font = cs.fontWeight + ' ' + cs.fontSize + ' ' + cs.fontFamily;
            if (g.measureText(word).width > avail + 1) out.midWord.push(word.slice(0, 30));
          }
        }
      }
    }
  }
  out.clipped = [...new Set(out.clipped)].slice(0, 6);
  out.midWord = [...new Set(out.midWord)].slice(0, 6);
  delete out._cv;
  return out;
})()`;

const b = await chromium.launch({
  executablePath: process.env.OKO_CHROME || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  args: ['--no-sandbox', '--use-gl=swiftshader', '--enable-unsafe-swiftshader'],
});
const c = await b.newContext({
  viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true,
  permissions: ['clipboard-read', 'clipboard-write'],
});
await c.addInitScript(`
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
  /* confirm/alert в автотесте всегда «да», иначе обход виснет */
  window.confirm = () => true; window.alert = () => {}; window.prompt = () => '';
`);
const page = await c.newPage();
let errors = [];
page.on('pageerror', e => errors.push(String(e).split('\n')[0].slice(0, 160)));
page.on('console', m => { if (m.type() === 'error' && !/api\.php|Failed to fetch|ERR_|404/.test(m.text())) errors.push('console: ' + m.text().slice(0, 160)); });

await page.goto('http://127.0.0.1:8199/index.html', { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(1800);
await page.evaluate(`okoSkipAuth()`);

async function reset(goto) {
  await page.keyboard.press('Escape').catch(() => {});
  await page.evaluate(`(()=>{
    try{ if(window.okoRec && okoRec.isOpen()) okoRec.cancel(); }catch(e){}
    try{ if(window.okoReels && okoReels.isOpen()) okoReels.close(); }catch(e){}
    try{ if(window.okoSocial && okoSocial.isOpen()) okoSocial.close(); }catch(e){}
    try{ if(typeof closeSheet==='function') closeSheet(); }catch(e){}
    try{ if(typeof closeMsgMenu==='function') closeMsgMenu(); }catch(e){}
    try{ if(typeof closeSearch==='function') closeSearch(); }catch(e){}
    try{ if(typeof closeNotifs==='function') closeNotifs(); }catch(e){}
    try{ if(typeof closeConv==='function') closeConv(); }catch(e){}
    document.querySelectorAll('.sheet.open, .modal.open, .popup.on').forEach(function(x){ x.classList.remove('open','on'); });
  })()`).catch(() => {});
  await page.waitForTimeout(120);
  try { await page.evaluate(goto); } catch (e) { /* шаг мог не сработать — отметим выше */ }
  await page.waitForTimeout(450);
}

const report = { at: new Date().toISOString(), screens: [] };
await fs.mkdir(OUT, { recursive: true });

for (const [name, goto] of SCREENS) {
  if (only && !only.includes(name)) continue;
  await reset(goto);

  const targets = await page.evaluate(`(() => {
    const sel = 'button, [role="button"], a[href], .prow, .svc, .ci, .soc-mini, .soc-btn, .mm-act, .pp2-row, .nt-item';
    const vis = el => { const cs = getComputedStyle(el); if(cs.display==='none'||cs.visibility==='hidden'||+cs.opacity===0) return false; const r = el.getBoundingClientRect(); return r.width>8 && r.height>8 && r.top>=0 && r.bottom<=innerHeight+400; };
    const out = [];
    document.querySelectorAll(sel).forEach((el, i) => {
      if (!vis(el)) return;
      const label = (el.getAttribute('aria-label') || el.textContent || el.title || '').trim().replace(/\\s+/g,' ').slice(0, 48);
      el.setAttribute('data-oko-click', String(i));
      out.push({ i, label });
    });
    return out;
  })()`);

  const baseScreen = await page.evaluate(`(()=>{ const a=document.querySelector('main > .screen.active'); return a?a.id:''; })()`).catch(() => '');
  const res = { screen: name, total: targets.length, clicked: 0, findings: [] };
  for (const t of targets.slice(0, MAX_PER_SCREEN)) {
    if (SKIP_TEXT.test(t.label)) continue;
    errors = [];
    const before = await page.evaluate(`location.href`);
    const ok = await page.evaluate(`(() => {
      const el = document.querySelector('[data-oko-click="${t.i}"]');
      if (!el) return false;
      const r = el.getBoundingClientRect();
      if (r.width < 8 || r.height < 8) return false;
      el.click();
      return true;
    })()`).catch(() => false);
    if (!ok) continue;
    res.clicked++;
    await page.waitForTimeout(320);

    const p = await page.evaluate(probeJs).catch(() => null);
    const after = await page.evaluate(`location.href`).catch(() => before);
    const issues = [];
    if (errors.length) issues.push('ошибка JS: ' + errors[0]);
    if (p && p.overflowX) issues.push('горизонтальное переполнение');
    if (p && !p.exit) issues.push('нет выхода из состояния');
    if (p && p.clipped.length) issues.push('обрезан текст: ' + p.clipped.join(' | '));
    if (p && p.midWord.length) issues.push('перенос посреди слова: ' + p.midWord.join(' | '));
    if (after !== before) issues.push('перезагрузка страницы');
    if (issues.length) res.findings.push({ кнопка: t.label || '(без подписи)', замечания: issues });

    /* Восстанавливаемся только если состояние действительно изменилось:
       полный reset после каждого клика делал обход втрое дольше без пользы. */
    const dirty = await page.evaluate(`(()=>{
      const act = document.querySelector('main > .screen.active');
      const over = document.querySelector('.sheet.open, #msgMenu.open, #searchView.open, .okr.on, .okorec.on, [class*="soc-"][class*="open"]');
      return { screen: act ? act.id : '', over: !!over };
    })()`).catch(() => ({ screen: '', over: true }));
    if (dirty.over || dirty.screen !== baseScreen || after !== before) {
      await reset(goto);
      if (after !== before) { await page.waitForTimeout(1000); await page.evaluate(`okoSkipAuth()`).catch(()=>{}); await reset(goto); }
    }
  }
  report.screens.push(res);
  const bad = res.findings.length;
  console.log(`${name.padEnd(16)} кнопок ${String(res.clicked).padStart(3)}   замечаний ${bad}`);
  for (const f of res.findings.slice(0, 6)) console.log(`   • «${f.кнопка}» → ${f.замечания.join('; ')}`);
}

await fs.writeFile(`${OUT}/report.json`, JSON.stringify(report, null, 2));
const totalClicks = report.screens.reduce((s, x) => s + x.clicked, 0);
const totalBad = report.screens.reduce((s, x) => s + x.findings.length, 0);
console.log(`\nВСЕГО: нажато ${totalClicks} кнопок, замечаний ${totalBad}. Отчёт: ${OUT}/report.json`);
await b.close();
