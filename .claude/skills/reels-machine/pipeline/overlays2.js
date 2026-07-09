const { chromium } = require('playwright');
const fs = require('fs');
const base = (body, extra='') => `<!DOCTYPE html><html><head><meta charset="utf-8"><style>
*{margin:0;padding:0} body{width:1080px;height:1920px;position:relative;overflow:hidden;background:transparent}
${extra}</style></head><body>${body}</body></html>`;

(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--no-sandbox'] });
  const page = await b.newPage({ viewport: { width: 1080, height: 1920 } });

  // ---- WIPE: diagonal branded band sweep, 14 frames ----
  fs.mkdirSync('ov_wipe', { recursive: true });
  await page.setContent(base(`<div id="band" style="position:absolute;top:-800px;left:0;width:3400px;height:3600px;
    background:linear-gradient(90deg,transparent 0%,#e8842a 6%,#141414 16%,#0d0d0d 84%,#e8842a 94%,transparent 100%);
    transform-origin:center;"></div>`));
  for (let i = 0; i < 14; i++) {
    const t = i / 13;
    const x = -3600 + t * 7300;
    await page.evaluate(x => { document.getElementById('band').style.transform = `translateX(${x}px) rotate(-12deg)`; }, x);
    await page.screenshot({ path: `ov_wipe/${String(i).padStart(3,'0')}.png`, omitBackground: true });
  }
  console.log('wipe done');

  // ---- LIGHT LEAK blob (single PNG, black bg for screen blend) ----
  await page.setContent(`<!DOCTYPE html><html><head><style>*{margin:0}body{width:1400px;height:1400px;background:#000}
  .b1{position:absolute;left:200px;top:200px;width:1000px;height:1000px;border-radius:50%;
    background:radial-gradient(circle,rgba(255,150,60,.85),rgba(232,132,42,.35) 45%,rgba(0,0,0,0) 70%);filter:blur(40px)}
  .b2{position:absolute;left:600px;top:100px;width:500px;height:500px;border-radius:50%;
    background:radial-gradient(circle,rgba(255,220,170,.7),rgba(0,0,0,0) 65%);filter:blur(30px)}
  </style></head><body><div class="b1"></div><div class="b2"></div></body></html>`);
  await page.setViewportSize({ width: 1400, height: 1400 });
  await page.screenshot({ path: 'leak.png' });
  console.log('leak done');

  // ---- VIEWFINDER UI ----
  await page.setViewportSize({ width: 1080, height: 1920 });
  await page.setContent(base(`
    <div style="position:absolute;inset:70px 40px 70px 40px;opacity:.75">
      <div style="position:absolute;left:0;top:0;width:90px;height:90px;border-left:6px solid #fff;border-top:6px solid #fff;border-radius:4px"></div>
      <div style="position:absolute;right:0;top:0;width:90px;height:90px;border-right:6px solid #fff;border-top:6px solid #fff;border-radius:4px"></div>
      <div style="position:absolute;left:0;bottom:0;width:90px;height:90px;border-left:6px solid #fff;border-bottom:6px solid #fff;border-radius:4px"></div>
      <div style="position:absolute;right:0;bottom:0;width:90px;height:90px;border-right:6px solid #fff;border-bottom:6px solid #fff;border-radius:4px"></div>
      <div style="position:absolute;left:34px;top:34px;font:700 34px monospace;color:#fff;letter-spacing:3px">REC</div>
      <div style="position:absolute;left:34px;bottom:30px;font:700 30px monospace;color:#fff;letter-spacing:2px">4K · 30FPS</div>
      <div style="position:absolute;right:34px;bottom:30px;font:700 30px monospace;color:#fff">AF·ON</div>
    </div>`));
  await page.screenshot({ path: 'viewfinder.png', omitBackground: true });
  await page.setContent(base(`<div style="position:absolute;left:150px;top:100px;width:26px;height:26px;border-radius:50%;background:#ff2b2b;box-shadow:0 0 18px #ff2b2b"></div>`));
  await page.screenshot({ path: 'recdot.png', omitBackground: true });
  console.log('viewfinder done');
  await b.close();
})();
