/* ============================================================================
   OKO · КАРТА ЭКРАНОВ ИЗ ТОЧЕК ВХОДА САМОГО ПРИЛОЖЕНИЯ

   Обход вслепую (map-routes.mjs) оказался слишком медленным: он переигрывает
   путь с нуля для каждого кандидата и за сорок минут не выбрался с первого
   уровня. Здесь подход другой — спросить у приложения, какие точки входа у
   него есть, и пройти по ним.

   Приложение держит навигацию в глобальных функциях: openMa, w2Open, chOpen,
   pp2Open*, vsOpen*, gmOpen*, mpOpen*, hq*, ps*, ac*, st2* и так далее —
   около двухсот штук. Берём те, что зовутся без аргументов, плюс известные
   с параметрами: мини-аппы, страницы кошелька, разделы каналов.

   Экран засчитывается, только если он ДЕЙСТВИТЕЛЬНО открылся: отпечаток
   после вызова должен отличаться от того, что был до. Так в карту не попадут
   функции, которые ничего не показали, и не появятся дубли одного экрана.

   Карта пишется по ходу: прошлый прогон умер до финальной записи и всё
   найденное пропало.

   Запуск: node oko-app/tools/gen-routes.mjs
   ============================================================================ */
import { chromium } from 'playwright-core';
import fs from 'node:fs/promises';
import { CLEAN_START, CLOSE_OVERLAYS } from './clean-start.mjs';

const args = Object.fromEntries(process.argv.slice(2).join(' ').split('--').filter(Boolean)
  .map(s => { const [k, ...v] = s.trim().split(/\s+/); return [k, v.join(' ') || true]; }));
const БАЗА  = args.base || 'http://127.0.0.1:8199/index.html';
const ВЫХОД = args.out || 'oko-app/tools/routes.json';

/* Главные вкладки — основа карты. */
const ВКЛАДКИ = ['feed', 'chats', 'mini', 'wallet', 'profile', 'academy', 'partner', 'games', 'ads', 'ton'];

/* Точки входа с параметрами — вытащены из кода. */
const С_ПАРАМЕТРОМ = [
  ...['academy', 'factory', 'helper', 'market', 'socials', 'system', 'video']
      .map(id => [`мини-апп ${id}`, `showTab('mini'); openMa('${id}')`]),
  ...['topup', 'withdraw', 'tx', 'statement', 'templates', 'limits', 'autopay', 'paypick', 'receive', 'receipt', 'tariffs']
      .map(id => [`кошелёк ${id}`, `showTab('wallet'); typeof w2Open==='function'&&w2Open('${id}')`]),
  ...['list', 'catalog', 'create']
      .map(id => [`каналы ${id}`, `typeof chOpen==='function'&&chOpen('${id}')`]),
  ['диалог', `showTab('chats'); (document.querySelector('#chatList .ci, #chatList > *')||{click(){}}).click()`],
  ['клипы', `typeof okoOpenClips==='function'&&okoOpenClips()`],
  ['поиск', `typeof openSearch==='function'&&openSearch('')`],
  ['настройки', `showTab('profile'); typeof st2Open==='function'&&st2Open()`],
];

/* Опасное не зовём никогда: уводит из приложения, стирает данные, просит
   камеру или деньги. Обход обязан быть безопасным и повторяемым. */
const ОПАСНО = /logout|delete|remove|clear|reset|wipe|pay|buy|topup|withdraw|record|call|camera|mic|close|hide|destroy|send|submit|confirm/i;

const ОТПЕЧАТОК = `(() => {
  const видим = el => { const cs = getComputedStyle(el);
    if (cs.display==='none'||cs.visibility==='hidden'||+cs.opacity===0) return false;
    const r = el.getBoundingClientRect();
    return r.width>4 && r.height>4 && r.bottom>0 && r.top<innerHeight; };
  /* если поверх открыта крупная панель — отпечаток берём с неё */
  const панель = [...document.querySelectorAll('.open, .sheet, [class*="view" i]')]
    .filter(el => { if(!видим(el)) return false; const r = el.getBoundingClientRect();
      return r.width*r.height > innerWidth*innerHeight*0.45; }).pop();
  const корень = панель || document.querySelector('main > .screen.active') || document.body;
  const ч = []; const w = document.createTreeWalker(корень, NodeFilter.SHOW_TEXT);
  for (let n = w.nextNode(); n && ч.length < 12; n = w.nextNode()) {
    const t = (n.nodeValue||'').trim(); if (t.length < 2) continue;
    if (!n.parentElement || !видим(n.parentElement)) continue;
    ч.push(t.slice(0,30));
  }
  return ч.join('|').slice(0,300);
})()`;

const b = await chromium.launch({
  executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-gl=swiftshader', '--enable-unsafe-swiftshader'],
});
const c = await b.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
await c.addInitScript(CLEAN_START);
const p = await c.newPage();
p.on('dialog', d => d.dismiss().catch(() => {}));
await p.goto(БАЗА, { waitUntil: 'domcontentloaded' });
await p.waitForTimeout(3000);
await p.evaluate('okoSkipAuth()');

/* Спрашиваем у приложения его собственные точки входа. */
const безАргументов = await p.evaluate(`(()=>{
  const rx = ${ОПАСНО.toString()};
  return Object.getOwnPropertyNames(window).filter(k=>{
    try{
      if(typeof window[k] !== 'function' || window[k].length !== 0) return false;
      if(!/^[a-z_]/.test(k)) return false;                 /* не конструкторы браузера */
      if(!/(Open|Show|View|Goto|Page|Tab)/.test(k)) return false;
      if(rx.test(k)) return false;
      return true;
    }catch(e){ return false; }
  }).sort();
})()`);
console.log('точек входа без аргументов:', безАргументов.length);

const кандидаты = [
  ...ВКЛАДКИ.map(t => [`вкладка ${t}`, `showTab('${t}')`]),
  ...С_ПАРАМЕТРОМ,
  ...безАргументов.map(f => [f, `typeof ${f}==='function' && ${f}()`]),
];
console.log('всего кандидатов:', кандидаты.length, '\n');

async function сброс() {
  for (let i = 0; i < 3; i++) { await p.keyboard.press('Escape').catch(() => {}); await p.waitForTimeout(40); }
  await p.evaluate(`(()=>{
    try{ if(window.okoSocial&&okoSocial.isOpen&&okoSocial.isOpen()) okoSocial.close(); }catch(e){}
    try{ if(typeof closeConv==='function') closeConv(); }catch(e){}
    try{ if(typeof closeSheet==='function') closeSheet(); }catch(e){}
    try{ if(typeof closeMa==='function') closeMa(); }catch(e){}
    try{ if(typeof closePopup==='function') closePopup(); }catch(e){}
    try{ showTab('profile'); }catch(e){}
  })()`).catch(() => {});
  await p.evaluate(CLOSE_OVERLAYS).catch(() => {});
  await p.waitForTimeout(180);
}

const карта = [];
const виденные = new Set();
for (const [имя, шаг] of кандидаты) {
  await сброс();
  const до = await p.evaluate(ОТПЕЧАТОК).catch(() => '');
  await p.evaluate(шаг).catch(() => {});
  await p.waitForTimeout(400);
  await p.evaluate(CLOSE_OVERLAYS).catch(() => {});
  await p.waitForTimeout(110);
  const после = await p.evaluate(ОТПЕЧАТОК).catch(() => '');
  if (!после || после === до) continue;    /* ничего не открылось */
  if (виденные.has(после)) continue;       /* такой экран уже в карте */
  виденные.add(после);
  карта.push({ id: 'r' + String(карта.length + 1).padStart(3, '0'), имя, путь: [шаг], глубина: 1 });
  await fs.writeFile(ВЫХОД, JSON.stringify(карта, null, 1));
  console.log('  ' + String(карта.length).padStart(3) + '  ' + имя);
}

console.log(`\nКарта: ${карта.length} экранов → ${ВЫХОД}`);
await b.close();
