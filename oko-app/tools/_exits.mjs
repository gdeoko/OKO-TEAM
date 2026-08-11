/* Проверка: из каждого экрана/панели есть выход (кнопка, Escape, тап по подложке). */
import { chromium } from 'playwright-core';
import fs from 'node:fs/promises';
import { CLEAN_START, RESET_ALL } from '/home/user/OKO-TEAM/oko-app/tools/clean-start.mjs';

const BASE = 'http://127.0.0.1:8231/index.html';
const routes = JSON.parse(await fs.readFile('/home/user/OKO-TEAM/oko-app/tools/routes.json', 'utf8'));

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

/* Верхняя видимая панель + есть ли в ней видимый выход */
const EXITINFO = `(() => {
  const vis = el => { if(!el) return false; const cs = getComputedStyle(el);
    if(cs.display==='none'||cs.visibility==='hidden'||+cs.opacity===0) return false;
    const r = el.getBoundingClientRect();
    return r.width>6 && r.height>6 && r.bottom>0 && r.top<innerHeight && r.right>0 && r.left<innerWidth; };
  /* самый верхний по z-index видимый оверлей, покрывающий заметную часть экрана */
  let top = null, topz = -1;
  const cand = [...document.querySelectorAll('body *')].filter(el => {
    const cs = getComputedStyle(el);
    if(cs.position !== 'fixed' && cs.position !== 'absolute') return false;
    if(!vis(el)) return false;
    const r = el.getBoundingClientRect();
    return (r.width*r.height)/(innerWidth*innerHeight) > 0.35;
  });
  for(const el of cand){
    const z = parseInt(getComputedStyle(el).zIndex,10) || 0;
    if(el.querySelector('#tabs')) continue;
    if(z >= topz){ topz = z; top = el; }
  }
  const scope = top || document.body;
  const backSel = '.oko-back,[class*="back"],[class*="close"],[class*="-x"],[aria-label*="азад"],[aria-label*="акрыть"],[aria-label*="тмен"],[title*="азад"],[title*="акрыть"]';
  const exits = [...scope.querySelectorAll(backSel)].filter(vis).map(e => (e.className||'')+'|'+(e.getAttribute('aria-label')||'')).slice(0,6);
  const tabsVis = vis(document.querySelector('nav#tabs')) || vis(document.querySelector('#tabs'));
  return { top: top ? (top.id||top.className.toString().slice(0,60)) : '', topz, exits, tabsVis,
           nv: (typeof nvStackLabels==='function' ? nvStackLabels() : []) };
})()`;

const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
await ctx.addInitScript(CLEAN_START);
const page = await ctx.newPage();
page.on('pageerror', () => {});

const bad = [];
for (const r of routes) {
  try {
    await page.goto(BASE, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(900);
    await page.evaluate(RESET_ALL);
    for (const step of r.путь) { await page.evaluate(step); await page.waitForTimeout(320); }
    await page.waitForTimeout(420);
    const fp0 = await page.evaluate(FP);
    const info = await page.evaluate(EXITINFO);
    if (info.tabsVis || info.exits.length) continue;   // выход есть

    // Escape
    await page.keyboard.press('Escape');
    await page.waitForTimeout(420);
    const fpEsc = await page.evaluate(FP);
    if (fpEsc !== fp0) continue;

    // тап по подложке (левый верхний угол и низ)
    let changed = false;
    for (const pt of [[6, 6], [195, 830], [384, 6]]) {
      await page.mouse.click(pt[0], pt[1]);
      await page.waitForTimeout(380);
      const fp2 = await page.evaluate(FP);
      if (fp2 !== fp0) { changed = true; break; }
    }
    if (changed) continue;

    bad.push({ id: r.id, имя: r.имя, путь: r.путь, fp: fp0, info });
    console.log('НЕТ ВЫХОДА:', r.id, r.имя, JSON.stringify(info));
  } catch (e) {
    console.log('skip', r.id, e.message.slice(0, 80));
  }
}
await fs.writeFile('/tmp/claude-0/-home-user-OKO-TEAM/f2926e2e-e87a-533d-ad5f-80dfd2fdcad5/scratchpad/exits.json', JSON.stringify(bad, null, 1));
console.log('итого без выхода:', bad.length, 'из', routes.length);
await browser.close();
