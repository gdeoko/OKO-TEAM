const { chromium } = require('playwright');
const fs = require('fs');

const logo = fs.readFileSync('logo_hd.png').toString('base64');
const mont9 = fs.readFileSync('fonts/montserrat-v31-cyrillic_latin-900.ttf').toString('base64');
const mont7 = fs.readFileSync('fonts/montserrat-v31-cyrillic_latin-700.ttf').toString('base64');

const base = (body, extra) => `<!DOCTYPE html><html><head><meta charset="utf-8"><style>
@font-face{font-family:'M9';src:url(data:font/ttf;base64,${mont9})}
@font-face{font-family:'M7';src:url(data:font/ttf;base64,${mont7})}
*{margin:0;padding:0} body{width:1080px;height:1920px;position:relative;overflow:hidden;background:transparent}
${extra}</style></head><body>${body}
<script>window.setP = p => { document.body.style.setProperty('--p', p); };</script></body></html>`;

// easing helpers computed in JS per frame
function easeOutBack(x){ const c1=1.70158, c3=c1+1; return 1 + c3*Math.pow(x-1,3) + c1*Math.pow(x-1,2); }
function easeOutCubic(x){ return 1-Math.pow(1-x,3); }

(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--no-sandbox'] });
  const page = await b.newPage({ viewport: { width: 1080, height: 1920 } });

  // ---------- STING: logo fly-in, 39 frames ----------
  fs.mkdirSync('ov_sting', { recursive: true });
  await page.setContent(base(`
    <div id="wrap" style="position:absolute;top:36%;left:50%;width:560px;transform:translate(-50%,-50%)">
      <img id="lg" src="data:image/png;base64,${logo}" style="width:100%;filter:drop-shadow(0 0 60px rgba(232,132,42,.9))">
    </div>
    <div id="l1" style="position:absolute;top:47%;left:0;width:100%;height:6px;background:linear-gradient(90deg,transparent,#e8842a,transparent)"></div>
  `, ''));
  for (let i = 0; i < 39; i++) {
    const t = i / 38;
    const sIn = Math.min(1, t / 0.45);
    const sc = 0.55 + 0.45 * easeOutBack(Math.min(1, sIn));
    const op = t < 0.12 ? t / 0.12 : (t > 0.82 ? Math.max(0, (1 - t) / 0.18) : 1);
    const glow = 40 + 50 * Math.sin(t * Math.PI);
    const lineX = (t - 0.5) * 2200;
    await page.evaluate(([sc, op, glow, lineX]) => {
      const w = document.getElementById('wrap');
      w.style.transform = `translate(-50%,-50%) scale(${sc})`;
      w.style.opacity = op;
      document.getElementById('lg').style.filter = `drop-shadow(0 0 ${glow}px rgba(232,132,42,.9))`;
      const l = document.getElementById('l1');
      l.style.transform = `translateX(${lineX}px)`;
      l.style.opacity = op * 0.9;
    }, [sc, op, glow, lineX]);
    await page.screenshot({ path: `ov_sting/${String(i).padStart(3,'0')}.png`, omitBackground: true });
  }
  console.log('sting done');

  // ---------- COUNTER: views count-up, 66 frames ----------
  fs.mkdirSync('ov_counter', { recursive: true });
  await page.setContent(base(`
    <div id="box" style="position:absolute;top:430px;left:50%;transform:translateX(-50%);text-align:center">
      <div id="num" style="font-family:'M9';font-size:150px;color:#fff;text-shadow:0 8px 40px rgba(0,0,0,.9),0 0 70px rgba(232,132,42,.45);letter-spacing:2px">0</div>
      <div id="lbl" style="font-family:'M7';font-size:46px;color:#e8842a;margin-top:6px;text-shadow:0 4px 22px rgba(0,0,0,.9)">просмотров за два дня</div>
    </div>
    <div id="hearts"></div>
  `, `.h{position:absolute;font-size:64px;opacity:0}`));
  await page.evaluate(() => {
    const hs = document.getElementById('hearts');
    for (let k = 0; k < 7; k++) {
      const d = document.createElement('div');
      d.className = 'h'; d.id = 'h' + k;
      d.textContent = k % 2 ? '❤️' : '🧡';
      d.style.left = (240 + k * 92) + 'px';
      hs.appendChild(d);
    }
  });
  for (let i = 0; i < 66; i++) {
    const t = i / 65;
    const val = Math.round(80000 * (1 - Math.pow(1 - Math.min(1, t / 0.72), 3)));
    const op = t < 0.08 ? t / 0.08 : (t > 0.85 ? Math.max(0, (1 - t) / 0.15) : 1);
    const sc = 0.92 + 0.08 * Math.min(1, t / 0.15);
    await page.evaluate(([val, op, sc, t]) => {
      const box = document.getElementById('box');
      box.style.opacity = op;
      box.style.transform = `translateX(-50%) scale(${sc})`;
      document.getElementById('num').textContent = val.toLocaleString('ru-RU');
      for (let k = 0; k < 7; k++) {
        const h = document.getElementById('h' + k);
        const ht = (t * 1.4 + k * 0.13) % 1;
        h.style.top = (760 - ht * 420) + 'px';
        h.style.opacity = Math.max(0, Math.min(op, 1 - ht)) * 0.9;
        h.style.transform = `translateX(${Math.sin(ht * 6 + k) * 26}px) scale(${0.7 + 0.4 * ht})`;
      }
    }, [val, op, sc, t]);
    await page.screenshot({ path: `ov_counter/${String(i).padStart(3,'0')}.png`, omitBackground: true });
  }
  console.log('counter done');

  // ---------- LOWER THIRDS: 2 static plates ----------
  const plate = (txt) => base(`
    <div style="position:absolute;left:44px;top:1520px;display:flex;align-items:center;gap:20px;background:rgba(10,10,10,.78);border-left:8px solid #e8842a;border-radius:14px;padding:20px 34px 20px 24px;box-shadow:0 10px 40px rgba(0,0,0,.55)">
      <img src="data:image/png;base64,${logo}" style="width:74px">
      <div style="font-family:'M9';font-size:40px;color:#fff;letter-spacing:1px">${txt}</div>
    </div>`, '');
  await page.setContent(plate('СНЯТО НА ТЕЛЕФОН'));
  await page.screenshot({ path: 'lt_phone.png', omitBackground: true });
  await page.setContent(plate('СНЯТО НА <span style="color:#e8842a">ПРОФКАМЕРУ</span>'));
  await page.screenshot({ path: 'lt_cam.png', omitBackground: true });
  console.log('plates done');

  await b.close();
})();
