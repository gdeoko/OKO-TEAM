/* ============================================================================
   OKO · ВТОРОЙ УРОВЕНЬ КАРТЫ

   gen-routes.mjs нашёл 49 экранов — всё, до чего есть глобальная функция:
   вкладки, мини-аппы, страницы кошелька, каналы, игры, биржа, штаб. Но внутри
   каждого раздела есть ещё меню и подстраницы, до которых добираются только
   пальцем. Их и добираем.

   Почему это быстро, а слепой обход был медленным: путь до экрана здесь —
   ровно один шаг из готовой карты плюс один клик. Переигрывать длинную
   цепочку не нужно.

   Экран засчитывается, только если отпечаток изменился и такого ещё не было.
   Опасное не жмём: выход, удаление, оплата, запись, звонок.

   Запуск: node oko-app/tools/deep-routes.mjs
           node oko-app/tools/deep-routes.mjs --in routes-49.json --out routes.json
   ============================================================================ */
import { chromium } from 'playwright-core';
import fs from 'node:fs/promises';
import { CLEAN_START, CLOSE_OVERLAYS } from './clean-start.mjs';

const args = Object.fromEntries(process.argv.slice(2).join(' ').split('--').filter(Boolean)
  .map(s => { const [k, ...v] = s.trim().split(/\s+/); return [k, v.join(' ') || true]; }));
const БАЗА   = args.base || 'http://127.0.0.1:8199/index.html';
const ВХОД   = args.in  || 'oko-app/tools/routes-49.json';
const ВЫХОД  = args.out || 'oko-app/tools/routes-deep.json';
const БЮДЖЕТ = +(args.minutes || 30) * 60000;

const ВХОДЫ = [
  '.prow', '.pp2-row', '.st2-row', '.svc', '.ma-tile', '.soc-mini', '.mm-act',
  '.nt-item', '.ch-row', '.cx2-row', '.sy2-row', '.w2-row', '.ac-row', '.m2-row',
  '.tab', '[role="tab"]', '.seg', '[data-my]', '.mk-cat', '.hq-row', '.acd-row',
  '.gm-row', '.vs-row', '.mp-row', '.fx-row', '.chip[data-tab]',
].join(',');

const ОПАСНО = /выйти|выход|удалить|очистить|сбросить|отписаться|заблокировать|оплатит|купить|пополнить|вывести|записать|камер|микрофон|позвонить|отправить|подтвердить|logout/i;

const ОТПЕЧАТОК = `(() => {
  const видим = el => { const cs = getComputedStyle(el);
    if (cs.display==='none'||cs.visibility==='hidden'||+cs.opacity===0) return false;
    const r = el.getBoundingClientRect();
    return r.width>4 && r.height>4 && r.bottom>0 && r.top<innerHeight; };
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

const НАЙТИ = `(() => {
  const rx = ${ОПАСНО.toString()};
  const видим = el => {
    const cs = getComputedStyle(el);
    if (cs.display==='none'||cs.visibility==='hidden'||+cs.opacity===0) return false;
    const r = el.getBoundingClientRect();
    if (!(r.width>8 && r.height>8 && r.top>=0 && r.bottom<=innerHeight+700)) return false;
    for (let p = el.parentElement; p; p = p.parentElement) {
      const c = typeof p.className === 'string' ? p.className : '';
      if (!/\\b(sheet|modal|popup|drawer|overlay)\\b/.test(c)) continue;
      return /\\b(open|on|active|shown)\\b/.test(c);
    }
    return true;
  };
  const out = [];
  document.querySelectorAll(${JSON.stringify(ВХОДЫ)}).forEach((el, i) => {
    if (!видим(el)) return;
    const label = (el.getAttribute('aria-label') || el.textContent || el.title || '')
      .replace(/\\s+/g,' ').trim().slice(0,42);
    if (!label || rx.test(label)) return;
    el.setAttribute('data-oko-deep', String(i));
    out.push({ i, label });
  });
  return out.slice(0, 16);
})()`;

const исходная = JSON.parse(await fs.readFile(ВХОД, 'utf-8'));

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

async function сброс() {
  for (let i = 0; i < 3; i++) { await p.keyboard.press('Escape').catch(() => {}); await p.waitForTimeout(35); }
  await p.evaluate(`(()=>{
    try{ if(window.okoSocial&&okoSocial.isOpen&&okoSocial.isOpen()) okoSocial.close(); }catch(e){}
    try{ if(typeof closeConv==='function') closeConv(); }catch(e){}
    try{ if(typeof closeSheet==='function') closeSheet(); }catch(e){}
    try{ if(typeof closeMa==='function') closeMa(); }catch(e){}
    try{ if(typeof closePopup==='function') closePopup(); }catch(e){}
    try{ showTab('profile'); }catch(e){}
  })()`).catch(() => {});
  await p.evaluate(CLOSE_OVERLAYS).catch(() => {});
  await p.waitForTimeout(150);
}

/* Отпечатки уже известных экранов, чтобы не записывать их снова. */
const виденные = new Set();
for (const r of исходная) {
  await сброс();
  for (const ш of r.путь) { await p.evaluate(ш).catch(() => {}); await p.waitForTimeout(330); }
  await p.evaluate(CLOSE_OVERLAYS).catch(() => {});
  await p.waitForTimeout(100);
  виденные.add(await p.evaluate(ОТПЕЧАТОК).catch(() => ''));
}
console.log('известных отпечатков:', виденные.size);

const карта = [...исходная];
const СТАРТ = Date.now();
let добавлено = 0;

for (const r of исходная) {
  if (Date.now() - СТАРТ > БЮДЖЕТ) { console.log('  (бюджет времени вышел)'); break; }
  await сброс();
  for (const ш of r.путь) { await p.evaluate(ш).catch(() => {}); await p.waitForTimeout(330); }
  await p.evaluate(CLOSE_OVERLAYS).catch(() => {});
  await p.waitForTimeout(100);
  const входы = await p.evaluate(НАЙТИ).catch(() => []);
  if (!входы.length) continue;

  for (const вх of входы) {
    if (Date.now() - СТАРТ > БЮДЖЕТ) break;
    /* заново проходим до родителя — клик мог увести куда угодно */
    await сброс();
    for (const ш of r.путь) { await p.evaluate(ш).catch(() => {}); await p.waitForTimeout(300); }
    await p.evaluate(CLOSE_OVERLAYS).catch(() => {});
    await p.waitForTimeout(80);
    await p.evaluate(НАЙТИ).catch(() => []);          /* пометить заново */
    const клик = `(()=>{const e=document.querySelector('[data-oko-deep="${вх.i}"]'); e&&e.click();})()`;
    await p.evaluate(клик).catch(() => {});
    await p.waitForTimeout(430);
    await p.evaluate(CLOSE_OVERLAYS).catch(() => {});
    await p.waitForTimeout(90);
    const отп = await p.evaluate(ОТПЕЧАТОК).catch(() => '');
    if (!отп || виденные.has(отп)) continue;
    виденные.add(отп);
    карта.push({
      id: 'r' + String(карта.length + 1).padStart(3, '0'),
      имя: r.имя + ' › ' + вх.label,
      путь: [...r.путь, клик],
      глубина: 2,
    });
    добавлено++;
    await fs.writeFile(ВЫХОД, JSON.stringify(карта, null, 1));
    console.log('  +' + String(добавлено).padStart(3) + '  ' + r.имя + ' › ' + вх.label);
  }
}

await fs.writeFile(ВЫХОД, JSON.stringify(карта, null, 1));
console.log(`\nБыло ${исходная.length}, добавлено ${добавлено}, всего ${карта.length} → ${ВЫХОД}`);
await b.close();
