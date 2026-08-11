/* Самопроверка детектора «нет выхода» + повторный прогон с более строгим селектором. */
import { chromium } from 'playwright-core';
import fs from 'node:fs/promises';
import { CLEAN_START, RESET_ALL } from './clean-start.mjs';

const BASE = 'http://127.0.0.1:8231/index.html';
const routes = JSON.parse(await fs.readFile('./oko-app/tools/routes.json', 'utf8'));

const FP = `(() => {
  const vis = el => { const cs = getComputedStyle(el); if(cs.display==='none'||cs.visibility==='hidden'||+cs.opacity===0) return false;
    const r = el.getBoundingClientRect(); return r.width>2 && r.height>2; };
  const parts = [];
  const scr = document.querySelector('main > .screen.active'); if(scr) parts.push('scr:'+scr.id);
  document.querySelectorAll('.open, .on, .show').forEach(el => {
    if(!vis(el)) return;
    const r = el.getBoundingClientRect();
    if(r.width * r.height < innerWidth*innerHeight*0.12) return;
    parts.push((el.id||el.className.toString().split(/\\s+/)[0])+':'+Math.round(r.width)+'x'+Math.round(r.height));
  });
  parts.push('nv:'+(typeof nvStackLabels==='function' ? nvStackLabels().join('>') : '?'));
  return parts.sort().join('|');
})()`;

/* СТРОГИЙ детектор выхода: только то, что человек опознаёт как выход. */
const EXITINFO = `(() => {
  const vis = el => { if(!el) return false; const cs = getComputedStyle(el);
    if(cs.display==='none'||cs.visibility==='hidden'||+cs.opacity===0) return false;
    let p = el; while(p){ const c = getComputedStyle(p); if(+c.opacity===0||c.visibility==='hidden'||c.display==='none') return false; p = p.parentElement; }
    const r = el.getBoundingClientRect();
    return r.width>=16 && r.height>=16 && r.bottom>0 && r.top<innerHeight && r.right>0 && r.left<innerWidth; };

  /* верхний видимый оверлей, закрывающий заметную часть экрана.
     Прозрачные контейнеры-пустышки (#pp2Nav: pointer-events:none, без фона)
     оверлеем НЕ считаются — иначе детектор ищет выход внутри пустого div
     и врёт «нет выхода» на каждой корневой вкладке. */
  let top = null, topz = -1;
  const opaque = el => {
    const cs = getComputedStyle(el);
    if(cs.pointerEvents === 'none') return false;
    const bg = cs.backgroundColor || '';
    const hasBg = bg && bg !== 'transparent' && !/rgba\\(\\s*\\d+,\\s*\\d+,\\s*\\d+,\\s*0\\s*\\)/.test(bg);
    return hasBg || cs.backdropFilter !== 'none' || el.children.length > 0;
  };
  for(const el of document.querySelectorAll('body *')){
    const cs = getComputedStyle(el);
    if(cs.position !== 'fixed' && cs.position !== 'absolute') continue;
    if(!vis(el)) continue;
    if(el.querySelector('#tabs')) continue;
    if(!opaque(el)) continue;
    const r = el.getBoundingClientRect();
    if((r.width*r.height)/(innerWidth*innerHeight) < 0.30) continue;
    const z = parseInt(cs.zIndex,10) || 0;
    if(z >= topz){ topz = z; top = el; }
  }
  const scope = top || document.body;

  const looksExit = el => {
    const cls = String(el.className && el.className.baseVal !== undefined ? el.className.baseVal : (el.className||''));
    if(/\\boko-back\\b|\\bep-cancel\\b|-close\\b|\\bclose\\b|\\b\\w+-x\\b|\\bcls\\b|\\bback\\b/.test(cls)) return true;
    const lab = ((el.getAttribute('aria-label')||'')+' '+(el.getAttribute('title')||'')+' '+(el.textContent||'')).slice(0,60);
    if(/наза[дт]|закры|отмен|выйти|понятн|готов|к спис|позже|скрыть/i.test(lab)) return true;
    const u = el.querySelector && el.querySelector('use');
    if(u && /#i-back|#i-plus|#cl-i-min/.test(String(u.getAttribute('href')||''))) return true;
    return false;
  };
  const exits = [...scope.querySelectorAll('button,a,[role="button"]')].filter(e => vis(e) && looksExit(e))
    .map(e => String(e.className||'').slice(0,40)+'|'+(e.getAttribute('aria-label')||(e.textContent||'').trim().slice(0,24)));

  const tabs = document.querySelector('#tabs');
  const tabsVis = !!(tabs && vis(tabs) && (!top || topz < (parseInt(getComputedStyle(tabs).zIndex,10)||0) || top.contains(tabs)));
  return { top: top ? (top.id || String(top.className).slice(0,50)) : '', topz, exits: exits.slice(0,5), tabsVis };
})()`;

const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
await ctx.addInitScript(CLEAN_START);
const page = await ctx.newPage();
page.on('pageerror', () => {});

async function check(steps) {
  await page.goto(BASE, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(900);
  await page.evaluate(RESET_ALL);
  for (const s of steps) { await page.evaluate(s); await page.waitForTimeout(300); }
  await page.waitForTimeout(400);
  /* Слой удержания сам выбрасывает окно поверх экрана. Оно ЕСТЬ выход
     («Позже»), но им маскируется проверяемый экран — гасим и меряем то,
     ради чего пришли. */
  const masked = await page.evaluate(`(() => {
    var p = document.getElementById('okoPopup');
    if(!p || getComputedStyle(p).display === 'none') return false;
    try{ if(typeof closePopup==='function') closePopup(); }catch(e){}
    return true;
  })()`);
  if (masked) await page.waitForTimeout(400);
  const fp0 = await page.evaluate(FP);
  const info = await page.evaluate(EXITINFO);
  if (info.tabsVis || info.exits.length) return { ok: true, why: info.exits.length ? 'кнопка' : 'нижнее меню', info };
  await page.keyboard.press('Escape');
  await page.waitForTimeout(420);
  if (await page.evaluate(FP) !== fp0) return { ok: true, why: 'Escape', info };
  for (const pt of [[6, 6], [195, 838], [384, 6], [195, 60]]) {
    await page.mouse.click(pt[0], pt[1]);
    await page.waitForTimeout(360);
    if (await page.evaluate(FP) !== fp0) return { ok: true, why: 'тап по подложке ' + pt, info };
  }
  return { ok: false, info, fp: fp0 };
}

/* --- САМОПРОВЕРКА: заведомая ловушка без выхода --- */
const TRAP = `(() => {
  try{ if(typeof closePopup==='function') closePopup(); }catch(e){}
  var p = document.getElementById('okoPopup'); if(p) p.remove();
  var d = document.createElement('div');
  d.id = '__trap';
  d.style.cssText = 'position:fixed;inset:0;z-index:99000;background:#111;color:#fff;padding:40px';
  d.innerHTML = '<h2>Ловушка</h2><p>Тут нет выхода</p><button>Купить</button>';
  document.body.appendChild(d);
})()`;
const t = await check([TRAP]);
console.log('САМОПРОВЕРКА ловушки:', t.ok ? 'ПРОВАЛ (детектор слепой) ' + t.why : 'ок — поймал', JSON.stringify(t.info));

/* --- САМОПРОВЕРКА 2: ловушка с крестиком, который НЕ работает, но выглядит выходом --- */
const TRAP2 = `(() => {
  try{ if(typeof closePopup==='function') closePopup(); }catch(e){}
  var p = document.getElementById('okoPopup'); if(p) p.remove();
  var d = document.createElement('div');
  d.id = '__trap2';
  d.style.cssText = 'position:fixed;inset:0;z-index:99000;background:#111;color:#fff;padding:40px';
  d.innerHTML = '<h2>Ловушка 2</h2><button class="x-close" aria-label="Закрыть">X</button>';
  document.body.appendChild(d);
})()`;
const t2 = await check([TRAP2]);
console.log('САМОПРОВЕРКА кнопки-обманки:', t2.ok ? 'детектор считает выходом (' + t2.why + ')' : 'поймал как без выхода');

/* --- полный прогон --- */
const bad = [];
for (const r of routes) {
  try {
    const res = await check(r.путь);
    if (!res.ok) { bad.push({ id: r.id, имя: r.имя, путь: r.путь, info: res.info, fp: res.fp }); console.log('НЕТ ВЫХОДА:', r.id, r.имя, JSON.stringify(res.info)); }
  } catch (e) { console.log('skip', r.id, e.message.slice(0, 70)); }
}
await fs.writeFile('./oko-app/tools/_exits2.json', JSON.stringify(bad, null, 1));
console.log('итого без выхода:', bad.length, 'из', routes.length);
await browser.close();
