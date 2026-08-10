/* ============================================================================
   OKO · КАРТА ВСЕХ ЭКРАНОВ

   Зачем. Аудит ходил по списку из 24 маршрутов, написанному руками. Даниэль
   справедливо сказал: экранов больше сотни — внутри каждого раздела ещё меню
   и ещё экраны. Руками такой список не поддержать: он устареет на следующей
   правке и будет молча пропускать половину приложения.

   Что делает. Обходит приложение сам, как человек: с каждой главной вкладки
   жмёт всё, что похоже на вход куда-то (строки разделов, плитки сервисов,
   пункты меню, вкладки), смотрит, изменился ли экран, и если да — записывает
   маршрут и заходит внутрь ещё на уровень. Возврат — «назад», Escape или
   повторный заход на вкладку.

   Экран считается новым по отпечатку: заголовок плюс первые видимые строки.
   Так один и тот же раздел, открытый двумя путями, не попадёт в карту дважды.

   На выходе — routes.json: список маршрутов вида
     { id, имя, путь: [шаги JS], глубина }
   Его читает audit-all.mjs и снимает каждый экран целиком.

   Запуск:
     node oko-app/tools/map-routes.mjs                 — обход и запись карты
     node oko-app/tools/map-routes.mjs --depth 3       — глубже (дольше)
   ============================================================================ */
import { chromium } from 'playwright-core';
import fs from 'node:fs/promises';
import { CLEAN_START, CLOSE_OVERLAYS } from './clean-start.mjs';

const args = Object.fromEntries(
  process.argv.slice(2).join(' ').split('--').filter(Boolean)
    .map(s => { const [k, ...v] = s.trim().split(/\s+/); return [k, v.join(' ') || true]; })
);
const БАЗА    = args.base || 'http://127.0.0.1:8199/index.html';
const ГЛУБИНА = +(args.depth || 2);
const ВЫХОД   = args.out || 'oko-app/tools/routes.json';

/* Точки входа: главные вкладки и экраны, до которых иначе не добраться. */
const СЕМЕНА = [
  ['лента',        `showTab('feed')`],
  ['чаты',         `showTab('chats')`],
  ['мини-аппы',    `showTab('mini')`],
  ['кошелёк',      `showTab('wallet')`],
  ['профиль',      `showTab('profile')`],
  ['академия',     `showTab('academy')`],
  ['партнёрка',    `showTab('partner')`],
  ['игры',         `showTab('games')`],
  ['реклама',      `showTab('ads')`],
  ['ton',          `showTab('ton')`],
  ['поиск',        `typeof openSearch==='function'&&openSearch()`],
  ['уведомления',  `typeof openNotifs==='function'&&openNotifs()`],
  ['настройки',    `showTab('profile'); typeof st2Open==='function'&&st2Open()`],
  ['каналы',       `typeof chOpen==='function'&&chOpen('list')`],
  ['клипы',        `typeof okoOpenClips==='function'&&okoOpenClips()`],
];

/* Что считаем «входом куда-то». Намеренно широко: лучше лишний клик, чем
   пропущенный экран. Опасное отсеиваем ниже по подписи. */
const ВХОДЫ = [
  '.prow', '.pp2-row', '.st2-row', '.svc', '.ma-tile', '.soc-mini', '.mm-act',
  '.ci', '.nt-item', '.ch-row', '.cx2-row', '.sy2-row', '.w2-row', '.ac-row',
  '.m2-row', '.tab', '[role="tab"]', '.seg', '.chip[data-tab]', '[data-my]',
  'button.card', 'a.card', '.acd-row', '.mk-cat', '.hq-row',
].join(',');

/* Никогда не жмём: уводит из приложения, стирает данные, открывает камеру
   или платёж. Обход должен быть безопасным и повторяемым. */
const ОПАСНО = /выйти|выход|удалить|очистить|сбросить|отписаться|заблокировать|оплатить|купить|пополнить|вывести|записать|камер|микрофон|позвонить|создать созвон|logout/i;

const ОТПЕЧАТОК = `(() => {
  /* Отпечаток видимого экрана: что человек реально видит сверху. */
  const части = [];
  const видим = el => {
    const cs = getComputedStyle(el);
    if (cs.display === 'none' || cs.visibility === 'hidden' || +cs.opacity === 0) return false;
    const r = el.getBoundingClientRect();
    return r.width > 4 && r.height > 4 && r.bottom > 0 && r.top < innerHeight;
  };
  /* верхняя панель поверх всего — если открыта, отпечаток берём с неё */
  const панель = [...document.querySelectorAll('.open, [class*="view"], .sheet')]
    .filter(el => { if (!видим(el)) return false;
      const r = el.getBoundingClientRect();
      return r.width * r.height > innerWidth * innerHeight * 0.5; })
    .pop();
  const корень = панель || document.querySelector('main > .screen.active') || document.body;
  const w = document.createTreeWalker(корень, NodeFilter.SHOW_TEXT);
  for (let n = w.nextNode(); n && части.length < 14; n = w.nextNode()) {
    const t = (n.nodeValue || '').trim();
    if (t.length < 2) continue;
    const el = n.parentElement;
    if (!el || !видим(el)) continue;
    части.push(t.slice(0, 34));
  }
  return части.join('|').slice(0, 320);
})()`;

const НАЙТИ_ВХОДЫ = (сел, опасно) => `(() => {
  const rx = new RegExp(${JSON.stringify(опасно.source)}, 'i');
  const видим = el => {
    const cs = getComputedStyle(el);
    if (cs.display === 'none' || cs.visibility === 'hidden' || +cs.opacity === 0) return false;
    const r = el.getBoundingClientRect();
    if (!(r.width > 8 && r.height > 8 && r.top >= 0 && r.bottom <= innerHeight + 600)) return false;
    /* закрытые шторки уезжают за край — до них пальцем не достать */
    for (let p = el.parentElement; p; p = p.parentElement) {
      const c = typeof p.className === 'string' ? p.className : '';
      if (!/\\b(sheet|modal|popup|drawer|overlay)\\b/.test(c)) continue;
      return /\\b(open|on|active|shown)\\b/.test(c);
    }
    return true;
  };
  const out = [];
  document.querySelectorAll(${JSON.stringify(сел)}).forEach((el, i) => {
    if (!видим(el)) return;
    const label = (el.getAttribute('aria-label') || el.textContent || el.title || '')
      .replace(/\\s+/g, ' ').trim().slice(0, 46);
    if (!label || rx.test(label)) return;
    el.setAttribute('data-oko-route', String(i));
    out.push({ i, label });
  });
  return out.slice(0, 14);
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
await p.waitForTimeout(2600);
await p.evaluate('okoSkipAuth()');

async function успокоить() {
  await p.evaluate(CLOSE_OVERLAYS).catch(() => {});
  await p.evaluate(`(() => new Promise(r => { let n = 0; const t = () => { n++;
    let run = 0; try { run = document.getAnimations().filter(a => a.playState === 'running').length; } catch(e){}
    if (!run || n > 8) return r(n); setTimeout(t, 30); }; t(); }))()`).catch(() => {});
}

async function пройти(путь) {
  /* Возврат в исходное состояние и повтор шагов маршрута с нуля — так обход
     не зависит от того, куда его занесло на прошлом шаге. */
  for (let i = 0; i < 4; i++) { await p.keyboard.press('Escape').catch(() => {}); await p.waitForTimeout(60); }
  await p.evaluate(`(()=>{
    try{ if(window.okoSocial && okoSocial.isOpen && okoSocial.isOpen()) okoSocial.close(); }catch(e){}
    try{ if(typeof closeConv==='function') closeConv(); }catch(e){}
    try{ if(typeof closeSheet==='function') closeSheet(); }catch(e){}
    try{ if(typeof closeMa==='function') closeMa(); }catch(e){}
  })()`).catch(() => {});
  await p.waitForTimeout(90);
  for (const шаг of путь) {
    await p.evaluate(шаг).catch(() => {});
    await p.waitForTimeout(320);
  }
  await успокоить();
  await p.waitForTimeout(120);
}

const БЮДЖЕТ = +(args.minutes || 22) * 60000;   /* сколько максимум обходить */
const СТАРТ = Date.now();
const карта = [];              /* найденные маршруты */
const виденные = new Set();    /* отпечатки, чтобы не дублировать экраны */
let очередь = [];

for (const [имя, шаг] of СЕМЕНА) очередь.push({ имя, путь: [шаг], глубина: 1 });

let обработано = 0;
while (очередь.length) {
  const узел = очередь.shift();
  obработка: {
    await пройти(узел.путь);
    const отпечаток = await p.evaluate(ОТПЕЧАТОК).catch(() => '');
    if (!отпечаток) break obработка;
    if (виденные.has(отпечаток)) break obработка;
    виденные.add(отпечаток);
    карта.push({ id: 'r' + String(карта.length + 1).padStart(3, '0'), имя: узел.имя, путь: узел.путь, глубина: узел.глубина });
    обработано++;
    process.stdout.write(`\r  найдено экранов: ${карта.length}, в очереди: ${очередь.length}   `);

    if (узел.глубина >= ГЛУБИНА) break obработка;

    const входы = await p.evaluate(НАЙТИ_ВХОДЫ(ВХОДЫ, ОПАСНО)).catch(() => []);
    for (const вх of входы) {
      очередь.push({
        имя: узел.имя + ' › ' + вх.label,
        путь: [...узел.путь, `(()=>{const e=document.querySelector('[data-oko-route="${вх.i}"]'); e&&e.click();})()`],
        глубина: узел.глубина + 1,
      });
    }
  }
  /* Пишем карту по ходу: прошлый обход убил таймаут, и всё найденное
     пропало, потому что запись была одна и в самом конце. */
  if (карта.length % 10 === 0) await fs.writeFile(ВЫХОД, JSON.stringify(карта, null, 1));
  if (карта.length > 400) break;                 /* страховка от разрастания */
  if (Date.now() - СТАРТ > БЮДЖЕТ) { console.log('\n  (бюджет времени вышел — сохраняю найденное)'); break; }
}

console.log('\n');
await fs.writeFile(ВЫХОД, JSON.stringify(карта, null, 1));
console.log(`Карта готова: ${карта.length} экранов → ${ВЫХОД}`);
const поГлубине = карта.reduce((a, r) => { a[r.глубина] = (a[r.глубина] || 0) + 1; return a; }, {});
console.log('по глубине:', JSON.stringify(поГлубине));
await b.close();
