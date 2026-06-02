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
  await new Promise(r => setTimeout(r, 8500));

  const shoot = async (name) => { await page.screenshot({ path: `/home/user/duck/_v_${name}.png` }); console.log('shot', name); };

  await shoot('hero');

  // проба: один жест (всплеск wheel) должен докатить ровно на соседнюю станцию и не застрять
  // (NAV-проба отключена временно — реальный морф крашит software-рендер headless)

  // scroll positions
  // settled frame at given scroll progress (sync DOM scroll + teleport particles/camera to target)
  const settle = async (v) => {
    await page.evaluate((vv) => {
      if (window.__lenis) window.__lenis.scrollTo((window.__lenis.limit || 0) * vv, { immediate: true });
      window.__teleport = true; window.__setScroll(vv);
    }, v);
    await new Promise(r => setTimeout(r, 500));
    await page.evaluate((vv) => { window.__setScroll(vv); }, v);
    await new Promise(r => setTimeout(r, 500));
    await page.evaluate(() => { window.__teleport = false; });
  };

  // НОВАЯ РЕЛЬСА: Холл занимает 0..0.5 (мозг собран к 0.5), Покер 0.5..1.0
  await settle(0.04); await shoot('hero_dissolve');
  await settle(0.22); await shoot('explode');
  await settle(0.50); await shoot('brain');
  // ТЕСТ КАСАНИЯ: перетаскиваем «палец» по мозгу — должно дать яркое свечение + сдвиг частиц
  const touchGlow = await page.evaluate(async () => {
    const cx = window.innerWidth / 2, cy = window.innerHeight * 0.45;
    window.dispatchEvent(new MouseEvent('mousedown', { clientX: cx, clientY: cy, bubbles: true }));
    for (let i = 0; i < 10; i++) { window.dispatchEvent(new MouseEvent('mousemove', { clientX: cx + Math.cos(i) * 70, clientY: cy + Math.sin(i) * 70, bubbles: true })); await new Promise(r => setTimeout(r, 35)); }
    let m = 0; const a = window.__scene && window.__glowArr && window.__glowArr(); if (a) for (let i = 0; i < a.length; i++) if (a[i] > m) m = a[i];
    return +m.toFixed(3);
  });
  console.log('TOUCH max glow on brain:', touchGlow);   // >0 = касание работает (есть свечение)
  await new Promise(r => setTimeout(r, 150)); await shoot('brain_touch');
  await settle(0.58); await shoot('poker_t1');           // туннель образовался, летим сквозь (камера ещё прямо)
  await settle(0.72); await shoot('poker_t2');           // камера доворачивается, стол приближается издалека
  await settle(0.99); await shoot('poker');              // стол прилетел, частицы погасли, текст на месте
  const btn = await page.evaluate(() => { const b = document.getElementById('poker-signup').getBoundingClientRect(); return { w: Math.round(b.width), h: Math.round(b.height), vw: window.innerWidth }; });
  console.log('BUTTON poker-signup:', JSON.stringify(btn));   // пилюля ~280×56, НЕ полоса во всю ширину
  // клик по карте → выезжает в центр лицом
  await page.evaluate(() => window.__pokerLift && window.__pokerLift(1));
  await new Promise(r => setTimeout(r, 1400)); await shoot('poker_card');
  await page.evaluate(() => window.__pokerLift && window.__pokerLift(1));
  await new Promise(r => setTimeout(r, 800));
  // анкета «Записаться за стол»
  await page.evaluate(() => window.__openSignup && window.__openSignup());
  await new Promise(r => setTimeout(r, 600)); await shoot('signup');
  await page.evaluate(() => document.querySelector('.su-card').classList.add('done'));
  await new Promise(r => setTimeout(r, 700)); await shoot('signup_thanks');
  await page.evaluate(() => { document.querySelector('.su-card').classList.remove('done'); document.body.classList.remove('signup-open'); });

  // open brain tunnel из позы мозга (pk=0)
  await settle(0.50);
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
