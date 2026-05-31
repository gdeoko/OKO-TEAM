const http = require('http');
const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer-core');

const ROOT = path.join(__dirname, 'dist');
const MIME = { '.html':'text/html', '.js':'text/javascript', '.css':'text/css', '.glb':'model/gltf-binary', '.wasm':'application/wasm', '.webp':'image/webp', '.json':'application/json', '.svg':'image/svg+xml' };

const server = http.createServer((req, res) => {
  let p = decodeURIComponent(req.url.split('?')[0]);
  if (p === '/') p = '/index.html';
  const fp = path.join(ROOT, p);
  if (!fp.startsWith(ROOT) || !fs.existsSync(fp)) { res.writeHead(404); res.end('nf'); return; }
  res.writeHead(200, { 'Content-Type': MIME[path.extname(fp)] || 'application/octet-stream' });
  fs.createReadStream(fp).pipe(res);
});

(async () => {
  await new Promise(r => server.listen(8099, r));
  const browser = await puppeteer.launch({
    executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    headless: 'shell',
    args: ['--no-sandbox', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--window-size=1440,900'],
  });
  const page = await browser.newPage();
  const MOBILE = process.argv.includes('mobile');
  if (MOBILE) {
    await page.setViewport({ width: 412, height: 915, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
    await page.setUserAgent('Mozilla/5.0 (Linux; Android 13) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Mobile Safari/537.36');
  } else {
    await page.setViewport({ width: 1440, height: 900 });
  }
  page.on('console', m => { const t = m.text(); if (/error|Error|fail|Ошибка/.test(t)) console.log('PAGE:', t); });
  page.on('pageerror', e => console.log('PAGEERR:', e.message));

  await page.goto('http://localhost:8099/?fast', { waitUntil: 'domcontentloaded', timeout: 30000 });
  await new Promise(r => setTimeout(r, 6500));

  const shoot = async (name) => { await page.screenshot({ path: `/home/user/duck/_v_${name}.png` }); console.log('shot', name); };

  await shoot('hero');

  // scroll positions
  // settled frame at given scroll progress (sync DOM scroll + teleport particles/camera to target)
  const settle = async (v) => {
    await page.evaluate((vv) => {
      if (window.__lenis) window.__lenis.scrollTo(99999 * vv, { immediate: true });
      window.__teleport = true; window.__setScroll(vv);
    }, v);
    await new Promise(r => setTimeout(r, 500));
    await page.evaluate((vv) => { window.__setScroll(vv); }, v);
    await new Promise(r => setTimeout(r, 500));
    await page.evaluate(() => { window.__teleport = false; });
  };

  await settle(0.08); await shoot('hero_dissolve');
  await settle(0.45); await shoot('explode');
  await settle(0.99); await shoot('brain');

  // open brain tunnel (let physics run a little; tunnel uses continuous flow so motion is fine)
  await page.evaluate(() => window.__openBrain && window.__openBrain());
  await new Promise(r => setTimeout(r, 1500)); await shoot('tunnel_burst');
  await page.evaluate(() => { window.__teleport = true; });
  await new Promise(r => setTimeout(r, 1200));
  await page.evaluate(() => { window.__teleport = false; });
  await shoot('tunnel_form');
  await new Promise(r => setTimeout(r, 2500)); await shoot('tunnel_text');

  await browser.close();
  server.close();
  console.log('DONE');
})().catch(e => { console.error(e); process.exit(1); });
