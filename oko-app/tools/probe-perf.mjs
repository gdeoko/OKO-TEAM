/* Замер скорости: сколько весит сборка, когда появляется первый кадр,
   когда приложение готово к нажатию, сколько длится переключение вкладок. */
import { chromium } from 'playwright-core';
import fs from 'node:fs/promises';
import path from 'node:path';

const DIR = 'oko-app/prototype';
const files = (await fs.readdir(DIR)).filter(f => /\.(html|css|js)$/.test(f));
const sizes = {};
let total = 0;
for (const f of files) {
  const st = await fs.stat(path.join(DIR, f));
  sizes[f] = Math.round(st.size / 1024);
  total += st.size;
}
const top = Object.entries(sizes).sort((a, b) => b[1] - a[1]).slice(0, 12);

const b = await chromium.launch({
  executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  args: ['--no-sandbox', '--use-gl=swiftshader', '--enable-unsafe-swiftshader'],
});
/* Телефон средней руки в Telegram: замедляем процессор и сеть. */
const c = await b.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
await c.addInitScript(`window.okoSkipAuth=function(){try{localStorage.setItem('oko-auth','tg')}catch(e){};var a=document.getElementById('authScreen');if(a){a.classList.add('hidden');a.style.display='none'}var s=document.getElementById('splash');if(s){s.classList.add('gone');s.style.display='none'}var o=document.getElementById('onboard');if(o){o.classList.add('hidden');o.style.display='none'}};try{localStorage.setItem('oko-onboard-done','1');localStorage.setItem('oko-stories-seen','1');localStorage.setItem('oko-tour-done','1');localStorage.setItem('oko-tour','1')}catch(e){}`);
const p = await c.newPage();
const cdp = await c.newCDPSession(p);
await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });

const t0 = Date.now();
await p.goto('http://127.0.0.1:8199/index.html', { waitUntil: 'domcontentloaded' });
const domReady = Date.now() - t0;
await p.waitForTimeout(3000);

const nav = await p.evaluate(`(() => {
  const n = performance.getEntriesByType('navigation')[0] || {};
  const paints = {};
  performance.getEntriesByType('paint').forEach(e => paints[e.name] = Math.round(e.startTime));
  const res = performance.getEntriesByType('resource')
    .map(r => ({ n: r.name.split('/').pop().split('?')[0], ms: Math.round(r.duration), kb: Math.round((r.transferSize||0)/1024) }))
    .sort((a,b) => b.ms - a.ms).slice(0, 8);
  return {
    domInteractive: Math.round(n.domInteractive || 0),
    domComplete: Math.round(n.domComplete || 0),
    firstPaint: paints['first-paint'] || null,
    firstContentfulPaint: paints['first-contentful-paint'] || null,
    ресурсов: performance.getEntriesByType('resource').length,
    самыеДолгие: res
  };
})()`);

/* Переключение вкладок под нагрузкой */
await p.evaluate(`okoSkipAuth()`);
const tabs = ['feed','chats','mini','wallet','profile','feed','chats'];
const times = [];
for (const t of tabs) {
  const s = Date.now();
  await p.evaluate(`showTab('${t}')`);
  await p.waitForTimeout(60);
  times.push(Date.now() - s);
}

/* Долгие задачи главного потока */
const longTasks = await p.evaluate(`(() => new Promise(res => {
  const out = [];
  try{
    const po = new PerformanceObserver(l => l.getEntries().forEach(e => out.push(Math.round(e.duration))));
    po.observe({ entryTypes: ['longtask'] });
  }catch(e){ return res('не поддерживается'); }
  let i = 0;
  const iv = setInterval(() => { showTab(['feed','chats','mini','wallet','profile'][i++ % 5]); }, 200);
  setTimeout(() => { clearInterval(iv); res(out); }, 2200);
}))`);

console.log(JSON.stringify({
  вес: { всегоКБ: Math.round(total / 1024), крупнейшие: top },
  загрузка: { domReadyМс: domReady, ...nav },
  переключениеВкладокМс: times,
  долгиеЗадачиМс: longTasks
}, null, 2));
await b.close();
