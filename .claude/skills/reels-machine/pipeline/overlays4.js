const { chromium } = require('playwright');
const fs = require('fs');
const soyuz = fs.readFileSync('fonts/soyuz.ttf').toString('base64');
const man8 = fs.readFileSync('fonts/manrope-v20-cyrillic_latin-800.ttf').toString('base64');

const base = (body, extra='') => `<!DOCTYPE html><html><head><meta charset="utf-8"><style>
@font-face{font-family:'SG';src:url(data:font/ttf;base64,${soyuz})}
@font-face{font-family:'M8';src:url(data:font/ttf;base64,${man8})}
*{margin:0;padding:0} body{width:1080px;height:1920px;position:relative;overflow:hidden;background:transparent}
${extra}</style></head><body>${body}</body></html>`;

function eob(x){const c1=1.70158,c3=c1+1;return 1+c3*Math.pow(x-1,3)+c1*Math.pow(x-1,2);}

(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--no-sandbox'] });
  const page = await b.newPage({ viewport: { width: 1080, height: 1920 } });

  // ---- STAMP "ПРОДАНО": slams in, 26 frames ----
  fs.mkdirSync('ov_stamp', { recursive: true });
  await page.setContent(base(`
    <div id="st" style="position:absolute;top:560px;left:50%;opacity:0;
      font-family:'SG';font-size:120px;color:#ff3b30;padding:14px 44px;border:10px solid #ff3b30;border-radius:18px;
      text-shadow:0 0 26px rgba(255,59,48,.55);box-shadow:inset 0 0 26px rgba(255,59,48,.35),0 0 40px rgba(255,59,48,.35);
      background:rgba(10,10,10,.25)">ПРОДАНО</div>`));
  for (let i = 0; i < 26; i++) {
    const t = i / 25;
    const sIn = Math.min(1, t / 0.3);
    const sc = 2.4 - 1.4 * eob(sIn);
    const op = t < 0.18 ? t / 0.18 : (t > 0.8 ? Math.max(0, (1 - t) / 0.2) : 1);
    const shake = t < 0.34 && t > 0.28 ? (Math.random() * 12 - 6) : 0;
    await page.evaluate(([sc, op, shake]) => {
      const s = document.getElementById('st');
      s.style.transform = `translateX(-50%) scale(${sc}) rotate(-11deg) translate(${shake}px,${shake/2}px)`;
      s.style.opacity = op;
    }, [sc, op, shake]);
    await page.screenshot({ path: `ov_stamp/${String(i).padStart(3,'0')}.png`, omitBackground: true });
  }
  console.log('stamp done');

  // ---- MSGS: customer chat bubbles, 70 frames ----
  fs.mkdirSync('ov_msgs', { recursive: true });
  const msgs = [
    ['А хлеб ещё остался?', '07:58'],
    ['Заберу два до работы!', '08:02'],
    ['Мы уже в очереди у входа', '08:10'],
  ];
  await page.setContent(base(`<div id="stack" style="position:absolute;left:64px;top:430px;width:660px"></div>`,
    `.msg{position:relative;margin-bottom:26px;background:rgba(18,18,18,.9);border-radius:22px 22px 22px 6px;
      padding:24px 30px;opacity:0;box-shadow:0 12px 34px rgba(0,0,0,.5);border:1px solid rgba(232,132,42,.35)}
     .msg .t{font-family:'M8';font-size:37px;color:#fff;line-height:1.25}
     .msg .d{font-family:'M8';font-size:24px;color:#9CF806;margin-top:8px}`));
  await page.evaluate((msgs) => {
    const st = document.getElementById('stack');
    msgs.forEach(([t, d], k) => {
      const m = document.createElement('div');
      m.className = 'msg'; m.id = 'm' + k;
      m.innerHTML = `<div class="t">${t}</div><div class="d">${d}</div>`;
      st.appendChild(m);
    });
  }, msgs);
  for (let i = 0; i < 70; i++) {
    const t = i / 69;
    const gOp = t > 0.87 ? Math.max(0, (1 - t) / 0.13) : 1;
    await page.evaluate(([t, gOp]) => {
      for (let k = 0; k < 3; k++) {
        const m = document.getElementById('m' + k);
        const lt = Math.max(0, Math.min(1, (t - k * 0.22) / 0.14));
        const e = 1 + 2.7 * Math.pow(lt - 1, 3) + 1.7 * Math.pow(lt - 1, 2);
        m.style.opacity = lt * gOp;
        m.style.transform = `translateY(${(1 - e) * 60}px) scale(${0.85 + 0.15 * e})`;
      }
    }, [t, gOp]);
    await page.screenshot({ path: `ov_msgs/${String(i).padStart(3,'0')}.png`, omitBackground: true });
  }
  console.log('msgs done');

  // ---- CONFETTI for endcard, 60 frames ----
  fs.mkdirSync('ov_confetti', { recursive: true });
  await page.setContent(base(`<canvas id="cv" width="1080" height="1920" style="position:absolute;inset:0"></canvas>`));
  await page.evaluate(() => {
    const P = [];
    for (let i = 0; i < 70; i++) {
      P.push({ x: Math.random() * 1080, v: 300 + Math.random() * 500, ph: Math.random() * 6,
               r: 6 + Math.random() * 10, c: Math.random() < 0.5 ? '#e8842a' : (Math.random() < 0.55 ? '#9CF806' : '#ffffff'),
               rot: Math.random() * 6, w: Math.random() < 0.5 });
    }
    window.P = P;
    window.draw = (t) => {
      const ctx = document.getElementById('cv').getContext('2d');
      ctx.clearRect(0, 0, 1080, 1920);
      const fade = t > 0.8 ? (1 - t) / 0.2 : 1;
      for (const p of window.P) {
        const y = -60 + p.v * t * 2.2;
        if (y > 1980) continue;
        const x = p.x + Math.sin(t * 7 + p.ph) * 46;
        ctx.save();
        ctx.globalAlpha = 0.9 * fade;
        ctx.translate(x, y);
        ctx.rotate(p.rot + t * 9);
        ctx.fillStyle = p.c;
        if (p.w) ctx.fillRect(-p.r, -p.r / 2.6, p.r * 2, p.r / 1.3);
        else { ctx.beginPath(); ctx.arc(0, 0, p.r / 1.6, 0, 7); ctx.fill(); }
        ctx.restore();
      }
    };
  });
  for (let i = 0; i < 60; i++) {
    await page.evaluate(t => window.draw(t), i / 59);
    await page.screenshot({ path: `ov_confetti/${String(i).padStart(3,'0')}.png`, omitBackground: true });
  }
  console.log('confetti done');
  await b.close();
})();
