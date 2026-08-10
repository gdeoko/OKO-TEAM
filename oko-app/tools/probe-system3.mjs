/* Дымовой тест разделов 07 «Трекеры» и 08 «Эталон КП».
   Проверяем не «скрипт загрузился», а что человек реально видит: разделы
   появились в сетке, вкладки трекеров переключаются, день отмечается,
   шаги КП открываются и черновик доживает до документа. */
import { chromium } from 'playwright-core';
import { CLEAN_START, CLOSE_OVERLAYS } from './clean-start.mjs';

const b = await chromium.launch({
  executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-gl=swiftshader', '--enable-unsafe-swiftshader'],
});
const c = await b.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
await c.addInitScript(CLEAN_START);
const p = await c.newPage();
const ошибки = [];
p.on('pageerror', e => ошибки.push(String(e).slice(0, 160)));
p.on('dialog', d => d.dismiss().catch(() => {}));
await p.goto('http://127.0.0.1:8199/index.html', { waitUntil: 'domcontentloaded' });
await p.waitForTimeout(3200);
await p.evaluate('okoSkipAuth()');
await p.evaluate(CLOSE_OVERLAYS).catch(() => {});

const ок = [], плохо = [];
const проверь = (имя, усл) => (усл ? ок : плохо).push(имя);

проверь('слой поднялся', await p.evaluate('typeof window.okoSy3 === "object"'));

/* Разделы в справочнике */
const секции = await p.evaluate('(SYS_SECTIONS||[]).map(s=>s.k).join(",")');
проверь('раздел track есть', секции.includes('track'));
проверь('раздел kp есть', секции.includes('kp'));

/* Сначала — путь нового человека: анкеты нет, план закрыт воротами.
   Трекеры и КП от анкеты не зависят, значит с этого экрана в них должен
   быть вход. Если его нет — два рабочих инструмента недостижимы. */
await p.evaluate(`(()=>{ showTab('mini'); openMa('system'); })()`).catch(() => {});
await p.waitForTimeout(700);
await p.evaluate(`(()=>{ try{ openSystemPreview(false); }catch(e){} })()`).catch(() => {});
await p.waitForTimeout(500);
проверь('ворота показывают вход в трекеры и КП',
  await p.evaluate(`!!document.querySelector('#systemBody .sy3-gate')`));
await p.evaluate(`sysGoto('track')`).catch(() => {});
await p.waitForTimeout(400);
проверь('трекеры открываются без анкеты',
  await p.evaluate(`!!document.querySelector('#systemBody .sy3-grid30')`));

/* Теперь заполняем анкету по минимуму — дальше проверяем обычный план. */
await p.evaluate(`(()=>{ aState.answers.who='Эксперт'; aState.answers.niche='керамика';
  aState.answers.platforms=['Instagram']; })()`).catch(() => {});
await p.evaluate(`(()=>{ try{ openSystemPreview(false); }catch(e){} })()`).catch(() => {});
await p.waitForTimeout(500);

const карточки = await p.evaluate(`[...document.querySelectorAll('#systemBody .sys-card b')].map(e=>e.textContent.trim())`);
проверь('карточка «Трекеры» видна', карточки.includes('Трекеры'));
проверь('карточка «Эталон КП» видна', карточки.includes('Эталон КП'));

/* --- Трекеры --- */
await p.evaluate(`sysGoto('track')`).catch(() => {});
await p.waitForTimeout(400);
проверь('трекеры отрисовались', await p.evaluate(`!!document.querySelector('#systemBody .sy3-grid30')`));
проверь('30 клеток календаря', await p.evaluate(`document.querySelectorAll('#systemBody .sy3-day').length`) === 30);

/* отметить сегодняшний день */
await p.evaluate(`document.querySelector('#systemBody .sy3-day.now').click()`).catch(() => {});
await p.waitForTimeout(450);
проверь('окно выбора формата открылось', await p.evaluate(`!!document.querySelector('.sy3-pk')`));
await p.evaluate(`document.querySelector('.sy3-pk').click()`).catch(() => {});
await p.evaluate(`(()=>{ const b=[...document.querySelectorAll('#okoPopup button')].find(x=>/Сохранить/.test(x.textContent)); b&&b.click(); })()`).catch(() => {});
await p.waitForTimeout(500);
проверь('день отметился', await p.evaluate(`document.querySelectorAll('#systemBody .sy3-day.on').length > 0`));
проверь('серия посчиталась', /1/.test(await p.evaluate(`[...document.querySelectorAll('#systemBody .sy3-st b')].map(e=>e.textContent).join('|')`)));

for (const вк of ['деньги', 'воронка', 'привычки', 'учёба']) {
  await p.evaluate(`okoSy3.вкладка('${вк}')`).catch(() => {});
  await p.waitForTimeout(300);
  const текст = await p.evaluate(`(document.querySelector('#systemBody .sy3-pane')||{}).textContent||''`);
  проверь(`вкладка ${вк} рисуется`, текст.trim().length > 40);
}

/* Ввод недели через модалку: окно ядра сначала закрывается и только потом
   зовёт обработчик, поэтому важно проверить, что значения действительно
   доехали, а не потерялись вместе с DOM. */
const заполни = async (значения) => {
  const поля = await p.$$('#okoPopup .sy3-f input');
  for (let i = 0; i < поля.length && i < значения.length; i++) {
    await поля[i].fill(String(значения[i]));
  }
  await p.evaluate(`(()=>{ const b=[...document.querySelectorAll('#okoPopup button')]
    .find(x=>/Сохранить/.test(x.textContent)); b&&b.click(); })()`);
  await p.waitForTimeout(400);
};

await p.evaluate(`okoSy3.вкладка('деньги')`); await p.waitForTimeout(300);
await p.evaluate(`okoSy3.деньгиДобавить()`); await p.waitForTimeout(400);
await заполни(['Неделя 1', '20', '5', '150000']);
const дтекст = await p.evaluate(`(document.querySelector('#systemBody .sy3-pane')||{}).textContent||''`);
проверь('неделя денег сохранилась', /150\s?000/.test(дтекст.replace(/ /g, ' ')));
проверь('конверсия посчиталась', дтекст.includes('25%'));
проверь('средний чек посчитался', /30\s?000/.test(дтекст.replace(/ /g, ' ')));

await p.evaluate(`okoSy3.вкладка('воронка')`); await p.waitForTimeout(300);
await p.evaluate(`okoSy3.воронкаДобавить()`); await p.waitForTimeout(400);
await заполни(['Неделя 1', '10000', '500', '40', '25', '5']);
проверь('воронка нарисовалась', await p.evaluate(`document.querySelectorAll('#systemBody .sy3-fn-row').length`) === 5);
проверь('узкое место найдено',
  (await p.evaluate(`(document.querySelector('#systemBody .sy3-pane')||{}).textContent||''`)).includes('Где теряется больше всего'));

await p.evaluate(`okoSy3.вкладка('привычки')`); await p.waitForTimeout(300);
await p.evaluate(`okoSy3.привычкаДобавить()`); await p.waitForTimeout(400);
await заполни(['Снять один кадр']);
проверь('привычка добавилась', await p.evaluate(`document.querySelectorAll('#systemBody .sy3-hab-row').length`) === 1);
await p.evaluate(`document.querySelectorAll('#systemBody .sy3-hab-c')[0].click()`).catch(() => {});
await p.waitForTimeout(350);
проверь('клетка привычки отмечается', await p.evaluate(`document.querySelectorAll('#systemBody .sy3-hab-c.on').length`) === 1);

/* --- КП --- */
await p.evaluate(`okoSy3.вкладка('контент')`).catch(() => {});
await p.evaluate(`sysGoto('kp')`).catch(() => {});
await p.waitForTimeout(400);
проверь('обзор КП: девять шагов', await p.evaluate(`document.querySelectorAll('#systemBody .sys-mat-card').length`) === 9);
проверь('сборка выключена на пустом', await p.evaluate(`!!document.querySelector('#systemBody .sys-cta .btn[disabled]')`));

await p.evaluate(`okoSy3.кпШаг('client')`).catch(() => {});
await p.waitForTimeout(350);
проверь('шаг 01 открылся', await p.evaluate(`document.querySelectorAll('#systemBody .sy3-f textarea').length`) === 4);
await p.evaluate(`(()=>{ const t=document.querySelector('#systemBody .sy3-f textarea');
  t.value='Студия керамики, продажи через профиль'; t.dispatchEvent(new Event('input',{bubbles:true})); })()`).catch(() => {});
await p.waitForTimeout(200);
проверь('черновик записался', (await p.evaluate(`localStorage.getItem('oko-sy3-kp')||''`)).includes('керамики'));

await p.evaluate(`okoSy3.кпСобрать()`).catch(() => {});
await p.waitForTimeout(400);
const док = await p.evaluate(`(document.querySelector('#systemBody .sy3-doc')||{}).textContent||''`);
проверь('документ собрался', док.includes('КОММЕРЧЕСКОЕ ПРЕДЛОЖЕНИЕ') && док.includes('керамики'));
проверь('незаполненное названо честно', док.includes('ЕЩЁ НЕ ЗАПОЛНЕНО'));

/* Возврат из обоих разделов */
await p.evaluate(`okoSy3.кпШаг('обзор')`).catch(() => {});
await p.waitForTimeout(300);
await p.evaluate(`sysGoto('home')`).catch(() => {});
await p.waitForTimeout(350);
проверь('выход к разделам работает', await p.evaluate(`!!document.querySelector('#systemBody .sys-hero')`));

/* Эмодзи в новом слое быть не должно */
const эм = await p.evaluate(`(()=>{
  const rx = /[\\u2190-\\u21FF\\u2300-\\u27BF\\u2B00-\\u2BFF\\uFE0F\\u{1F000}-\\u{1FAFF}]/u;
  const плохие = [];
  document.querySelectorAll('#systemBody *').forEach(el=>{
    for (const n of el.childNodes) if (n.nodeType===3 && rx.test(n.nodeValue||'')) плохие.push((n.nodeValue||'').trim().slice(0,30));
  });
  return [...new Set(плохие)].slice(0,5);
})()`);
проверь('эмодзи в разделах нет', эм.length === 0);

console.log('\n  OK   ' + ок.length);
ок.forEach(s => console.log('    + ' + s));
if (плохо.length) { console.log('\n  ПЛОХО ' + плохо.length); плохо.forEach(s => console.log('    - ' + s)); }
if (эм.length) console.log('  эмодзи:', эм);
if (ошибки.length) { console.log('\n  ОШИБКИ JS:'); [...new Set(ошибки)].forEach(e => console.log('    ! ' + e)); }
await b.close();
process.exit(плохо.length || ошибки.length ? 1 : 0);
