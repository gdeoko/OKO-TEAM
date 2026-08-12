/* Проба адаптива: ищем горизонтальное переполнение и обрезанный текст на 9 ширинах. */
import { chromium } from 'playwright-core';
import { CLEAN_START } from '/home/user/OKO-TEAM/oko-app/tools/clean-start.mjs';

const WIDTHS = [
  {w:320,h:640,m:1},{w:360,h:740,m:1},{w:390,h:844,m:1},{w:430,h:932,m:1},
  {w:768,h:1024,m:0},{w:1024,h:768,m:0},{w:1280,h:800,m:0},{w:1440,h:900,m:0},{w:1920,h:1080,m:0}
];
const TABS = ['feed','chats','mini','wallet','profile','partner','academy','games','ads','ton'];
const MAS  = ['system','factory','video','market','helper','socials'];

const DETECT = `(() => {
  const out = {over:[], narrow:[], clipped:[]};
  const seen = new Set();
  const vis = el => {
    let n = el;
    while (n && n.nodeType === 1) {
      const cs = getComputedStyle(n);
      if (cs.display==='none' || cs.visibility==='hidden' || parseFloat(cs.opacity)===0) return false;
      n = n.parentElement;
    }
    return true;
  };
  const sel = el => {
    if (el.id) return '#'+el.id;
    const c = (el.className && typeof el.className==='string') ? '.'+el.className.trim().split(/\\s+/).slice(0,3).join('.') : '';
    return el.tagName.toLowerCase()+c;
  };
  // 1. горизонтальное переполнение: любой скроллер, у которого scrollWidth заметно > clientWidth
  document.querySelectorAll('*').forEach(el => {
    if (!vis(el)) return;
    const cs = getComputedStyle(el);
    const ox = cs.overflowX;
    const sw = el.scrollWidth, cw = el.clientWidth;
    if (cw > 0 && sw - cw > 2) {
      if (ox === 'auto' || ox === 'scroll') return; // намеренная карусель
      const k = 'O'+sel(el);
      if (seen.has(k)) return; seen.add(k);
      out.over.push({sel:sel(el), sw, cw, ox});
    }
  });
  // 2. цели нажатия уже/ниже 44
  document.querySelectorAll('button,a,[onclick],[role="button"],input[type=checkbox],input[type=radio]').forEach(el => {
    if (!vis(el)) return;
    if (el.hasAttribute('data-oko-hit')) return;
    const r = el.getBoundingClientRect();
    if (r.width === 0 || r.height === 0) return;
    if (r.width < 40 || r.height < 40) {
      const k = 'N'+sel(el);
      if (seen.has(k)) return; seen.add(k);
      out.narrow.push({sel:sel(el), w:+r.width.toFixed(1), h:+r.height.toFixed(1), t:(el.textContent||'').trim().slice(0,24)});
    }
  });
  // 3. обрезанный однострочный текст (nowrap + ellipsis/hidden и реально не влезает)
  document.querySelectorAll('*').forEach(el => {
    if (el.children.length) return;
    if (!vis(el)) return;
    const cs = getComputedStyle(el);
    if (cs.whiteSpace !== 'nowrap') return;
    if (cs.overflow === 'visible') return;
    if (el.scrollWidth - el.clientWidth > 4 && el.clientWidth > 0) {
      const k = 'C'+sel(el);
      if (seen.has(k)) return; seen.add(k);
      out.clipped.push({sel:sel(el), sw:el.scrollWidth, cw:el.clientWidth, t:(el.textContent||'').trim().slice(0,30)});
    }
  });
  return out;
})()`;

const b = await chromium.launch({ executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args:['--no-sandbox','--use-gl=swiftshader','--enable-unsafe-swiftshader'] });
const report = {};
for (const V of WIDTHS) {
  const c = await b.newContext({ viewport:{width:V.w,height:V.h}, isMobile:!!V.m, hasTouch:!!V.m, deviceScaleFactor:1 });
  await c.addInitScript(CLEAN_START);
  const p = await c.newPage();
  await p.goto('http://127.0.0.1:8199/index.html',{waitUntil:'domcontentloaded'});
  await p.waitForTimeout(2500);
  await p.evaluate(`try{var s=document.getElementById('splash');if(s){s.classList.add('gone');s.style.display='none'}var a=document.getElementById('authScreen');if(a){a.classList.add('hidden');a.style.display='none'}}catch(e){}`);
  await p.waitForTimeout(400);
  const per = {};
  for (const t of TABS) {
    await p.evaluate(`try{showTab('${t}')}catch(e){}`).catch(()=>{});
    await p.waitForTimeout(500);
    const r = await p.evaluate(DETECT).catch(()=>null);
    if (r && (r.over.length||r.narrow.length||r.clipped.length)) per['tab:'+t] = r;
  }
  for (const m of MAS) {
    await p.evaluate(`try{showTab('mini');openMa('${m}')}catch(e){}`).catch(()=>{});
    await p.waitForTimeout(650);
    const r = await p.evaluate(DETECT).catch(()=>null);
    if (r && (r.over.length||r.narrow.length||r.clipped.length)) per['ma:'+m] = r;
  }
  report[V.w] = per;
  await c.close();
}
console.log(JSON.stringify(report));
await b.close();
