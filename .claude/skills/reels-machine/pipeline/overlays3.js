const { chromium } = require('playwright');
const fs = require('fs');
const logo = fs.readFileSync('logo_hd.png').toString('base64');
const man8 = fs.readFileSync('fonts/manrope-v20-cyrillic_latin-800.ttf').toString('base64');
const mont9 = fs.readFileSync('fonts/montserrat-v31-cyrillic_latin-900.ttf').toString('base64');

const base = (body, extra='') => `<!DOCTYPE html><html><head><meta charset="utf-8"><style>
@font-face{font-family:'M8';src:url(data:font/ttf;base64,${man8})}
@font-face{font-family:'MO9';src:url(data:font/ttf;base64,${mont9})}
*{margin:0;padding:0} body{width:1080px;height:1920px;position:relative;overflow:hidden;background:transparent}
${extra}</style></head><body>${body}</body></html>`;

function eob(x){const c1=1.70158,c3=c1+1;return 1+c3*Math.pow(x-1,3)+c1*Math.pow(x-1,2);}

(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--no-sandbox'] });
  const page = await b.newPage({ viewport: { width: 1080, height: 1920 } });

  // ========== STING2: logo + particle burst ==========
  fs.mkdirSync('ov_sting2', { recursive: true });
  await page.setContent(base(`
    <canvas id="cv" width="1080" height="1920" style="position:absolute;inset:0"></canvas>
    <div id="wrap" style="position:absolute;top:36%;left:50%;width:560px;transform:translate(-50%,-50%)">
      <img id="lg" src="data:image/png;base64,${logo}" style="width:100%;filter:drop-shadow(0 0 60px rgba(232,132,42,.9))">
    </div>`));
  await page.evaluate(() => {
    const N = 90, P = [];
    for (let i = 0; i < N; i++) {
      const a = Math.random() * Math.PI * 2, v = 12 + Math.random() * 26;
      P.push({ a, v, r: 3 + Math.random() * 7, c: Math.random() < 0.55 ? '#e8842a' : (Math.random() < 0.5 ? '#9CF806' : '#ffffff') });
    }
    window.P = P;
    window.drawP = (t) => {
      const cv = document.getElementById('cv'), ctx = cv.getContext('2d');
      ctx.clearRect(0, 0, 1080, 1920);
      const cx = 540, cy = 0.36 * 1920;
      for (const p of window.P) {
        const d = p.v * 60 * Math.min(t, 1) * (1 - 0.45 * t);
        const x = cx + Math.cos(p.a) * d, y = cy + Math.sin(p.a) * d * 0.9 + 180 * t * t;
        const al = Math.max(0, 1 - t * 1.25);
        ctx.globalAlpha = al;
        ctx.fillStyle = p.c;
        ctx.shadowColor = p.c; ctx.shadowBlur = 14;
        ctx.beginPath(); ctx.arc(x, y, p.r * (1 - 0.5 * t), 0, 7); ctx.fill();
      }
      ctx.globalAlpha = 1;
    };
  });
  for (let i = 0; i < 45; i++) {
    const t = i / 44;
    const sIn = Math.min(1, t / 0.4);
    const sc = 0.5 + 0.5 * eob(sIn);
    const op = t < 0.1 ? t / 0.1 : (t > 0.82 ? Math.max(0, (1 - t) / 0.18) : 1);
    await page.evaluate(([sc, op, t]) => {
      const w = document.getElementById('wrap');
      w.style.transform = `translate(-50%,-50%) scale(${sc}) rotate(${(1-sc)*8}deg)`;
      w.style.opacity = op;
      window.drawP(t);
    }, [sc, op, t]);
    await page.screenshot({ path: `ov_sting2/${String(i).padStart(3,'0')}.png`, omitBackground: true });
  }
  console.log('sting2 done');

  // ========== NUM3D: extruded gold 80 000 + icons ==========
  fs.mkdirSync('ov_num3d', { recursive: true });
  const depth = 16;
  let sh = [];
  for (let d = 1; d <= depth; d++) sh.push(`${d}px ${d}px 0 rgba(120,60,8,${1 - d/(depth+6)})`);
  await page.setContent(base(`
    <div id="persp" style="position:absolute;top:400px;left:0;width:100%;perspective:900px">
      <div id="numwrap" style="text-align:center;transform-style:preserve-3d">
        <div id="num" style="display:inline-block;font-family:'MO9';font-size:190px;letter-spacing:4px;
          background:linear-gradient(180deg,#ffe9a8 0%,#f7b733 45%,#e8842a 100%);-webkit-background-clip:text;color:transparent;
          text-shadow:${sh.join(',')};filter:drop-shadow(0 18px 40px rgba(0,0,0,.75))">0</div>
        <div id="lbl" style="font-family:'M8';font-size:48px;color:#9CF806;margin-top:10px;
          text-shadow:0 4px 20px rgba(0,0,0,.8),0 0 26px rgba(156,248,6,.5)">просмотров за два дня</div>
      </div>
    </div>
    <div id="icons"></div>`, `.ic{position:absolute;font-size:70px;opacity:0;filter:drop-shadow(0 6px 14px rgba(0,0,0,.6))}`));
  await page.evaluate(() => {
    const icons = ['\u{1F441}️','\u{1F525}','❤️','\u{1F4AC}','\u{1F680}','\u{1F9E1}','\u{1F440}','\u{1F4C8}'];
    const box = document.getElementById('icons');
    icons.forEach((e, k) => {
      const d = document.createElement('div');
      d.className = 'ic'; d.id = 'ic' + k; d.textContent = e;
      d.style.left = (90 + k * 122) + 'px';
      box.appendChild(d);
    });
  });
  for (let i = 0; i < 72; i++) {
    const t = i / 71;
    const val = Math.round(80000 * (1 - Math.pow(1 - Math.min(1, t / 0.65), 3)));
    const op = t < 0.08 ? t / 0.08 : (t > 0.86 ? Math.max(0, (1 - t) / 0.14) : 1);
    const rotY = 55 * (1 - Math.min(1, eob(Math.min(1, t / 0.5))));
    const rotX = 12 * (1 - Math.min(1, t / 0.5));
    await page.evaluate(([val, op, rotY, rotX, t]) => {
      const w = document.getElementById('numwrap');
      w.style.transform = `rotateY(${rotY}deg) rotateX(${rotX}deg)`;
      w.style.opacity = op;
      document.getElementById('num').textContent = val.toLocaleString('ru-RU');
      for (let k = 0; k < 8; k++) {
        const ic = document.getElementById('ic' + k);
        const it = (t * 1.5 + k * 0.125) % 1;
        ic.style.top = (900 - it * 520) + 'px';
        ic.style.opacity = Math.max(0, Math.min(op, 1.2 - it)) * 0.95;
        ic.style.transform = `translateX(${Math.sin(it * 5 + k * 1.3) * 34}px) scale(${0.6 + 0.5 * it}) rotate(${Math.sin(it*4+k)*14}deg)`;
      }
    }, [val, op, rotY, rotX, t]);
    await page.screenshot({ path: `ov_num3d/${String(i).padStart(3,'0')}.png`, omitBackground: true });
  }
  console.log('num3d done');

  // ========== CHART: rising glow line + x3 label ==========
  fs.mkdirSync('ov_chart', { recursive: true });
  await page.setContent(base(`
    <div id="panel" style="position:absolute;left:70px;top:520px;width:640px;height:430px;opacity:0;
      background:rgba(10,10,10,.72);border:1px solid rgba(232,132,42,.5);border-radius:22px;box-shadow:0 16px 60px rgba(0,0,0,.6);backdrop-filter:blur(2px)">
      <div style="font-family:'M8';font-size:34px;color:#fff;padding:24px 28px 0">заказы после ролика</div>
      <svg width="640" height="330" viewBox="0 0 640 330" style="position:absolute;bottom:0;left:0">
        <defs>
          <linearGradient id="gf" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stop-color="rgba(156,248,6,.35)"/><stop offset="1" stop-color="rgba(156,248,6,0)"/>
          </linearGradient>
        </defs>
        <g stroke="rgba(255,255,255,.12)" stroke-width="1">
          <line x1="40" y1="70" x2="600" y2="70"/><line x1="40" y1="150" x2="600" y2="150"/><line x1="40" y1="230" x2="600" y2="230"/>
        </g>
        <path id="fill" d="" fill="url(#gf)"/>
        <path id="line" d="" fill="none" stroke="#9CF806" stroke-width="7" stroke-linecap="round"
          style="filter:drop-shadow(0 0 12px rgba(156,248,6,.8))"/>
        <circle id="dot" r="12" fill="#9CF806" style="filter:drop-shadow(0 0 16px #9CF806)"/>
      </svg>
      <div id="mult" style="position:absolute;right:26px;top:20px;font-family:'MO9';font-size:64px;color:#e8842a;opacity:0;
        text-shadow:0 4px 18px rgba(0,0,0,.8)">x3</div>
    </div>`));
  await page.evaluate(() => {
    const pts = [[40,290],[130,270],[220,278],[310,215],[400,160],[490,120],[600,52]];
    window.chart = (t) => {
      const n = pts.length - 1;
      const prog = Math.min(1, t) * n;
      const seg = Math.min(n - 1, Math.floor(prog));
      const frac = prog - seg;
      const cur = [];
      for (let i = 0; i <= seg; i++) cur.push(pts[i]);
      const last = [pts[seg][0] + (pts[seg+1][0]-pts[seg][0])*frac, pts[seg][1] + (pts[seg+1][1]-pts[seg][1])*frac];
      cur.push(last);
      const d = 'M' + cur.map(p => p[0]+','+p[1]).join(' L');
      document.getElementById('line').setAttribute('d', d);
      document.getElementById('fill').setAttribute('d', d + ` L${last[0]},330 L40,330 Z`);
      const dot = document.getElementById('dot');
      dot.setAttribute('cx', last[0]); dot.setAttribute('cy', last[1]);
    };
  });
  for (let i = 0; i < 60; i++) {
    const t = i / 59;
    const op = t < 0.12 ? t / 0.12 : (t > 0.85 ? Math.max(0, (1 - t) / 0.15) : 1);
    const lineT = Math.min(1, Math.max(0, (t - 0.12) / 0.6));
    const multOp = t > 0.66 ? Math.min(1, (t - 0.66) / 0.12) : 0;
    const multSc = t > 0.66 ? 0.5 + 0.5 * eob(Math.min(1, (t - 0.66) / 0.2)) : 0.5;
    await page.evaluate(([op, lineT, multOp, multSc]) => {
      const p = document.getElementById('panel');
      p.style.opacity = op;
      p.style.transform = `translateY(${(1-Math.min(1,op))*40}px)`;
      window.chart(lineT);
      const m = document.getElementById('mult');
      m.style.opacity = multOp;
      m.style.transform = `scale(${multSc})`;
    }, [op, lineT, multOp, multSc]);
    await page.screenshot({ path: `ov_chart/${String(i).padStart(3,'0')}.png`, omitBackground: true });
  }
  console.log('chart done');
  await b.close();
})();
