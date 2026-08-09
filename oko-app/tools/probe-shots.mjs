/* Быстрый снимок произвольных экранов + проверка переполнений.
   Запуск: node oko-app/tools/probe-shots.mjs <id>:<js-шаг> [...] */
import { chromium } from 'playwright-core';
import fs from 'node:fs/promises';

const BASE = process.env.OKO_BASE || 'http://127.0.0.1:8199/index.html';
const W = +(process.env.OKO_W || 390), H = +(process.env.OKO_H || 844);
const OUT = process.env.OKO_OUT || 'oko-app/tools/shots';
await fs.mkdir(OUT, { recursive: true });

const jobs = process.argv.slice(2).map(s => {
  const i = s.indexOf(':');
  return { id: s.slice(0, i), step: s.slice(i + 1) };
});

const browser = await chromium.launch({
  executablePath: process.env.OKO_CHROME || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  args: ['--no-sandbox', '--use-gl=swiftshader', '--enable-unsafe-swiftshader'],
});
const ctx = await browser.newContext({ viewport: { width: W, height: H }, isMobile: W < 700, hasTouch: W < 700, deviceScaleFactor: 2 });
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
  }catch(e){}
`);
const page = await ctx.newPage();
await page.goto(BASE, { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(1500);

const PROBE = `(() => {
  const VW = innerWidth, out = { overflowX: false, offRight: [], clipped: [], noBack: null };
  out.overflowX = document.documentElement.scrollWidth > VW + 1;
  const lab = el => (el.tagName.toLowerCase() + (el.id ? '#' + el.id : '') + (el.className && typeof el.className === 'string' ? '.' + el.className.trim().split(/\\s+/).slice(0,2).join('.') : ''));
  for (const el of document.querySelectorAll('body *')) {
    if (el.ownerSVGElement) continue;
    const cs = getComputedStyle(el);
    if (cs.display === 'none' || cs.visibility === 'hidden' || +cs.opacity === 0) continue;
    const r = el.getBoundingClientRect();
    if (!r.width || !r.height || r.bottom < 0 || r.top > innerHeight) continue;
    let inScroller = false;
    for (let p = el.parentElement, d = 0; p && d < 6; p = p.parentElement, d++) {
      const o = getComputedStyle(p).overflowX;
      if (o === 'auto' || o === 'scroll') { inScroller = true; break; }
    }
    if (!inScroller && r.right > VW + 1 && r.width < VW * 1.6) out.offRight.push(lab(el) + ' right=' + Math.round(r.right));
    const txt = (el.textContent || '').trim();
    if (txt && el.children.length === 0) {
      const intentional = cs.textOverflow === 'ellipsis' || cs.webkitLineClamp !== 'none';
      if (!intentional && el.scrollWidth > el.clientWidth + 2 && cs.overflow !== 'visible')
        out.clipped.push(lab(el) + ' «' + txt.slice(0, 40) + '»');
    }
  }
  const dedupe = a => [...new Set(a)].slice(0, 10);
  out.offRight = dedupe(out.offRight); out.clipped = dedupe(out.clipped);
  return out;
})()`;

const report = {};
for (const j of jobs) {
  try { await page.evaluate(j.step); } catch (e) { report[j.id] = { stepError: String(e).slice(0, 160) }; continue; }
  await page.waitForTimeout(900);
  report[j.id] = await page.evaluate(PROBE);
  await page.screenshot({ path: `${OUT}/${j.id}.png` });
}
console.log(JSON.stringify(report, null, 2));
await browser.close();
