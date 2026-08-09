/* Профиль на узком экране: обрезанные подписи и перекрытия кнопок.
   Обрезание ищем сравнением scrollWidth с clientWidth, перекрытие —
   пересечением прямоугольников с проверкой, кто реально сверху. */
import { chromium } from 'playwright-core';
import { CLEAN_START, CLOSE_OVERLAYS } from './clean-start.mjs';

const ПРОВЕРКА = `(() => {
  const видим = el => { const cs = getComputedStyle(el);
    if (cs.display==='none'||cs.visibility==='hidden'||+cs.opacity===0) return false;
    const r = el.getBoundingClientRect();
    return r.width>4 && r.height>4 && r.bottom>0 && r.top<innerHeight; };

  const обрезано = [];
  for (const el of document.querySelectorAll('body *')) {
    if (el.ownerSVGElement || el.children.length) continue;
    const t = (el.textContent||'').trim();
    if (!t || !видим(el)) continue;
    const cs = getComputedStyle(el);
    if (cs.textOverflow === 'ellipsis' || cs.webkitLineClamp !== 'none') continue;
    if (el.scrollWidth > el.clientWidth + 1 && cs.overflow !== 'visible')
      обрезано.push({ текст: t.slice(0,32), надо: el.scrollWidth, есть: el.clientWidth,
                      узел: el.tagName.toLowerCase()+'.'+String(el.className).trim().split(/\\s+/).join('.') });
  }

  /* перекрытия: берём кнопки и смотрим, не накрыт ли их центр чужим узлом */
  const перекрыто = [];
  document.querySelectorAll('button, [role="button"], .prow, .pp2-row').forEach(el => {
    if (!видим(el)) return;
    const r = el.getBoundingClientRect();
    const cx = r.left + r.width/2, cy = r.top + r.height/2;
    if (cx < 0 || cy < 0 || cx > innerWidth || cy > innerHeight) return;
    const сверху = document.elementFromPoint(cx, cy);
    if (!сверху || сверху === el || el.contains(сверху) || сверху.contains(el)) return;
    перекрыто.push({ кнопка: (el.textContent||el.getAttribute('aria-label')||'').trim().slice(0,28),
                     накрытаЧем: сверху.tagName.toLowerCase()+'.'+String(сверху.className).trim().split(/\\s+/).slice(0,2).join('.') });
  });

  return { обрезано: обрезано.slice(0,10), перекрыто: перекрыто.slice(0,10) };
})()`;

const b = await chromium.launch({ executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args:['--no-sandbox'] });
for (const w of [320, 360, 390]) {
  const c = await b.newContext({ viewport:{width:w, height:800}, isMobile:true, hasTouch:true });
  await c.addInitScript(CLEAN_START);
  const p = await c.newPage();
  await p.goto('http://127.0.0.1:8199/index.html',{waitUntil:'domcontentloaded'});
  await p.waitForTimeout(2500);
  await p.evaluate(`okoSkipAuth(); showTab('profile')`);
  await p.waitForTimeout(1200);
  await p.evaluate(CLOSE_OVERLAYS).catch(()=>{});
  await p.waitForTimeout(400);
  const r = await p.evaluate(ПРОВЕРКА);
  console.log(`\n=== ${w} px ===`);
  console.log('обрезано:', r.обрезано.length ? JSON.stringify(r.обрезано, null, 1) : 'нет');
  console.log('перекрыто:', r.перекрыто.length ? JSON.stringify(r.перекрыто, null, 1) : 'нет');
  await c.close();
}
await b.close();
