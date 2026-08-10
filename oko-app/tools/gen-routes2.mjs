/* ============================================================================
   OKO · КАРТА ЭКРАНОВ ИЗ НАСТОЯЩИХ ТОЧЕК ВХОДА

   Прошлые две попытки упирались в одно и то же.

   map-routes.mjs жал всё подряд вслепую и за сорок минут не выбрался с
   первого уровня. gen-routes.mjs спрашивал у окна функции без аргументов —
   нашёл 49 экранов, но мимо прошло всё, что открывается с параметром:
   w2Open('limits'), openMa('factory'), chOpen('catalog'), gmOpen('vip').
   А таких в приложении большинство.

   Здесь источник другой и точный: сам код. Каждый onclick в разметке — это
   переход, который человек реально может совершить пальцем. Их и собираем
   регуляркой из index.html, app.js и всех слоёв, а потом проверяем в живом
   браузере: вызвали — изменился ли экран, и не видели ли мы такой раньше.

   Что не зовём никогда: выход, удаление, оплата, отправка, запись, камера,
   микрофон, звонок. Обход обязан быть безопасным и повторяемым.

   Экран засчитывается только если отпечаток ПОСЛЕ вызова отличается от
   отпечатка ДО и такого отпечатка ещё не было. Отпечаток снимается дважды
   с паузой: анимация открытия успевает закончиться, и в карту не попадают
   «экраны», которые через полсекунды закрылись сами.

   Запуск: node oko-app/tools/gen-routes2.mjs --minutes 40
   ============================================================================ */
import { chromium } from 'playwright-core';
import fs from 'node:fs/promises';
import { CLEAN_START, CLOSE_OVERLAYS, RESET_ALL } from './clean-start.mjs';

const args = Object.fromEntries(process.argv.slice(2).join(' ').split('--').filter(Boolean)
  .map(s => { const [k, ...v] = s.trim().split(/\s+/); return [k, v.join(' ') || true]; }));
const БАЗА   = args.base || 'http://127.0.0.1:8199/index.html';
const ВЫХОД  = args.out || 'oko-app/tools/routes.json';
const БЮДЖЕТ = +(args.minutes || 40) * 60000;

const ФАЙЛЫ = [
  'oko-app/prototype/index.html',
  'oko-app/prototype/app.js',
  ...(await fs.readdir('oko-app/prototype/media/app'))
    .filter(f => f.endsWith('.js')).map(f => 'oko-app/prototype/media/app/' + f),
];

const ОПАСНО = /logout|выйти|выход|delete|remove|удал|clear|очист|reset|сброс|wipe|pay|оплат|buy|куп|topup|пополн|withdraw|вывест|record|запис|call|звон|camera|камер|mic|микрофон|send|отправ|submit|confirm|подтверд|block|заблок|report|жалоб|unsubscribe|отпис|leave|покинуть|reload|location|href|open\(|window\./i;

/* Что считаем переходом: вызов функции, чьё имя намекает на показ экрана. */
const ПОХОЖЕ = /(open|show|goto|view|page|tab|panel|sheet|screen|render)/i;

const найдено = new Map();          /* строка вызова → откуда */
for (const f of ФАЙЛЫ) {
  const t = await fs.readFile(f, 'utf-8');
  /* onclick="fn('a')" и onclick='fn("a")' — вместе с необязательным event */
  const rx = /on(?:click|change)\s*=\s*(["'])(.*?)\1/gs;
  let m;
  while ((m = rx.exec(t))) {
    const тело = m[2].replace(/&quot;/g, '"').replace(/&#39;/g, "'").trim();
    /* берём только один простой вызов: цепочки из двух-трёх действий чаще
       всего что-то меняют по дороге, и повторить их безопасно нельзя */
    const вызов = /^([a-zA-Z_$][\w$]*)\s*\(([^()]*)\)\s*;?$/.exec(тело);
    if (!вызов) continue;
    const [, имя, арг] = вызов;
    if (!ПОХОЖЕ.test(имя) || ОПАСНО.test(имя)) continue;
    /* аргументы допускаем только литеральные: event, this и переменные
       вне разметки не существуют */
    const а = арг.trim();
    if (а && !/^(['"][^'"]*['"])(\s*,\s*['"][^'"]*['"])*$/.test(а)) continue;
    /* Разметка слоёв собирается шаблонными строками, и в исходник попадают
       куски вида openMarketCat('${c.k}'). Кавычки на месте, литералом это
       не является: в браузере откроется категория с именем «${c.k}». */
    if (а.includes('${') || а.includes('&&') || а.includes('+')) continue;
    if (ОПАСНО.test(а)) continue;
    const строка = имя + '(' + а + ')';
    if (!найдено.has(строка)) найдено.set(строка, f.split('/').pop());
  }
}
console.log('вызовов из кода:', найдено.size);

/* Вкладки — основа карты, они в разметке заданы иначе. */
const ВКЛАДКИ = ['feed', 'chats', 'mini', 'wallet', 'profile', 'academy', 'partner', 'games', 'ads', 'ton'];


const ОТПЕЧАТОК = `(() => {
  const прозрачен = el => { for (let q=el; q && q!==document.documentElement; q=q.parentElement){
    const cs=getComputedStyle(q);
    if(cs.display==='none'||cs.visibility==='hidden'||+cs.opacity<0.05) return true; } return false; };
  const видим = el => { if(прозрачен(el)) return false; const r=el.getBoundingClientRect();
    return r.width>4 && r.height>4 && r.bottom>0 && r.top<innerHeight; };
  const активный = document.querySelector('main > .screen.active');
  let панель = null, макс = -1;
  document.querySelectorAll('body *').forEach(el => {
    const cs = getComputedStyle(el);
    if (cs.position !== 'fixed' && cs.position !== 'absolute') return;
    if (активный && (el === активный || el.contains(активный) || активный.contains(el))) return;
    if (!видим(el) || !(el.textContent||'').trim()) return;
    const r = el.getBoundingClientRect();
    if (r.width * r.height < innerWidth * innerHeight * 0.4) return;
    const z = parseInt(cs.zIndex, 10) || 0;
    if (z >= макс) { макс = z; панель = el; }
  });
  const корень = панель || активный || document.body;
  const ч = []; const w = document.createTreeWalker(корень, NodeFilter.SHOW_TEXT);
  for (let n = w.nextNode(); n && ч.length < 16; n = w.nextNode()) {
    const t = (n.nodeValue||'').trim(); if (t.length < 2) continue;
    if (!n.parentElement || !видим(n.parentElement)) continue;
    ч.push(t.slice(0,26));
  }
  return (панель ? (панель.id || 'панель') + '|' : '') + ч.join('|').slice(0,320);
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

/* Второй источник — сами глобальные функции без аргументов. Разметка знает
   не всё: часть переходов вешается через .onclick = fn уже из кода слоя,
   и в onclick-атрибутах их нет. */
const безАргументов = await p.evaluate(`(()=>{
  const опасно = ${ОПАСНО.toString()};
  const похоже = ${ПОХОЖЕ.toString()};
  return Object.getOwnPropertyNames(window).filter(k=>{
    try{
      if(typeof window[k] !== 'function' || window[k].length !== 0) return false;
      if(!/^[a-z_]/.test(k)) return false;
      if(!похоже.test(k) || опасно.test(k)) return false;
      return true;
    }catch(e){ return false; }
  }).sort();
})()`);
console.log('глобальных функций без аргументов:', безАргументов.length);

const кандидаты = [
  ...ВКЛАДКИ.map(t => [`вкладка ${t}`, `showTab('${t}')`]),
  ...[...найдено.keys()].sort().map(в => [в, `try{ ${в} }catch(e){}`]),
  ...безАргументов.filter(f => !найдено.has(f + '()'))
    .map(f => [f + '()', `try{ ${f}() }catch(e){}`]),
];
console.log('всего кандидатов:', кандидаты.length, '\n');

async function сброс() {
  for (let i = 0; i < 3; i++) { await p.keyboard.press('Escape').catch(() => {}); await p.waitForTimeout(30); }
  await p.evaluate(RESET_ALL).catch(() => {});
  await p.evaluate(`(()=>{ try{ showTab('profile'); }catch(e){} })()`).catch(() => {});
  await p.evaluate(CLOSE_OVERLAYS).catch(() => {});
  await p.waitForTimeout(180);
}

const карта = [];
const виденные = new Set();
const СТАРТ = Date.now();
let пропущено = 0;

for (const [имя, шаг] of кандидаты) {
  if (Date.now() - СТАРТ > БЮДЖЕТ) { console.log('  (бюджет времени вышел, осталось проверить ' + (кандидаты.length - карта.length - пропущено) + ')'); break; }
  await сброс();
  const до = await p.evaluate(ОТПЕЧАТОК).catch(() => '');
  await p.evaluate(шаг).catch(() => {});
  await p.waitForTimeout(420);
  await p.evaluate(CLOSE_OVERLAYS).catch(() => {});
  const после1 = await p.evaluate(ОТПЕЧАТОК).catch(() => '');
  await p.waitForTimeout(420);
  const после = await p.evaluate(ОТПЕЧАТОК).catch(() => '');
  /* экран, который сам закрылся за полсекунды, экраном не считается */
  if (!после || после === до || после !== после1) { пропущено++; continue; }
  if (виденные.has(после)) { пропущено++; continue; }
  виденные.add(после);
  карта.push({ id: 'r' + String(карта.length + 1).padStart(3, '0'), имя, путь: [шаг], глубина: 1 });
  await fs.writeFile(ВЫХОД, JSON.stringify(карта, null, 1));
  console.log('  ' + String(карта.length).padStart(3) + '  ' + имя);
}

console.log(`\nКарта: ${карта.length} экранов (пропущено ${пропущено}) → ${ВЫХОД}`);
await b.close();
