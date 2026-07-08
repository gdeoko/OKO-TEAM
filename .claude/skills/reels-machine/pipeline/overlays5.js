const { chromium } = require('playwright');
const fs = require('fs');
const soyuz = fs.readFileSync('fonts/soyuz.ttf').toString('base64');
const man8 = fs.readFileSync('fonts/manrope-v20-cyrillic_latin-800.ttf').toString('base64');
const mont9 = fs.readFileSync('fonts/montserrat-v31-cyrillic_latin-900.ttf').toString('base64');

const base = (body, extra='') => `<!DOCTYPE html><html><head><meta charset="utf-8"><style>
@font-face{font-family:'SG';src:url(data:font/ttf;base64,${soyuz})}
@font-face{font-family:'M8';src:url(data:font/ttf;base64,${man8})}
@font-face{font-family:'MO9';src:url(data:font/ttf;base64,${mont9})}
*{margin:0;padding:0} body{width:1080px;height:1920px;position:relative;overflow:hidden;background:transparent}
${extra}</style></head><body>${body}</body></html>`;
function eob(x){const c1=1.70158,c3=c1+1;return 1+c3*Math.pow(x-1,3)+c1*Math.pow(x-1,2);}

(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--no-sandbox'] });
  const page = await b.newPage({ viewport: { width: 1080, height: 1920 } });

  // ---- CLOCK: digital flip 06:00 -> 09:00, 55 frames ----
  fs.mkdirSync('ov_clock', { recursive: true });
  await page.setContent(base(`
    <div id="cl" style="position:absolute;top:500px;left:50%;transform:translateX(-50%);opacity:0;text-align:center">
      <div style="background:rgba(10,10,10,.82);border:2px solid rgba(232,132,42,.6);border-radius:24px;padding:26px 52px;box-shadow:0 16px 60px rgba(0,0,0,.6),0 0 40px rgba(232,132,42,.25)">
        <div id="tm" style="font-family:'MO9';font-size:130px;color:#fff;letter-spacing:6px;text-shadow:0 0 30px rgba(232,132,42,.7)">06:00</div>
        <div id="lb" style="font-family:'M8';font-size:34px;color:#e8842a;margin-top:4px">хлеба уже нет</div>
      </div>
    </div>`));
  for (let i = 0; i < 55; i++) {
    const t = i / 54;
    const op = t < 0.12 ? t / 0.12 : (t > 0.84 ? Math.max(0, (1 - t) / 0.16) : 1);
    const prog = Math.min(1, Math.max(0, (t - 0.1) / 0.55));
    const mins = Math.round(180 * (1 - Math.pow(1 - prog, 2.5)));
    const hh = 6 + Math.floor(mins / 60), mm = mins % 60;
    const sc = 0.85 + 0.15 * Math.min(1, t / 0.15);
    const pulse = prog >= 1 ? 1 + 0.05 * Math.sin((t - 0.65) * 22) : 1;
    await page.evaluate(([hh, mm, op, sc, pulse, prog]) => {
      const c = document.getElementById('cl');
      c.style.opacity = op;
      c.style.transform = `translateX(-50%) scale(${sc * pulse})`;
      document.getElementById('tm').textContent = `${String(hh).padStart(2,'0')}:${String(mm).padStart(2,'0')}`;
      document.getElementById('tm').style.color = prog >= 1 ? '#9CF806' : '#fff';
      document.getElementById('lb').style.opacity = prog >= 1 ? 1 : 0.25;
    }, [hh, mm, op, sc, pulse, prog]);
    await page.screenshot({ path: `ov_clock/${String(i).padStart(3,'0')}.png`, omitBackground: true });
  }
  console.log('clock done');

  // ---- PIN: location drop + pulse rings + city label, 50 frames ----
  fs.mkdirSync('ov_pin', { recursive: true });
  await page.setContent(base(`
    <div id="wrap" style="position:absolute;top:430px;left:50%;transform:translateX(-50%)">
      <svg id="rings" width="420" height="420" viewBox="0 0 420 420" style="position:absolute;left:50%;top:120px;transform:translate(-50%,-50%)">
        <circle id="r1" cx="210" cy="210" r="30" fill="none" stroke="#e8842a" stroke-width="5"/>
        <circle id="r2" cx="210" cy="210" r="30" fill="none" stroke="#9CF806" stroke-width="4"/>
      </svg>
      <div id="pin" style="position:relative;width:130px;height:130px;margin:0 auto;opacity:0">
        <svg width="130" height="150" viewBox="0 0 24 28">
          <path d="M12 0C6 0 1.5 4.6 1.5 10.4 1.5 18 12 27 12 27s10.5-9 10.5-16.6C22.5 4.6 18 0 12 0z" fill="#e8842a" style="filter:drop-shadow(0 8px 16px rgba(0,0,0,.6))"/>
          <circle cx="12" cy="10.4" r="4.6" fill="#0d0d0d"/>
        </svg>
      </div>
      <div id="city" style="margin-top:36px;text-align:center;opacity:0;font-family:'SG';font-size:58px;color:#fff;
        background:rgba(10,10,10,.8);border-radius:16px;padding:14px 34px;border-left:8px solid #e8842a;box-shadow:0 12px 40px rgba(0,0,0,.55)">РОСТОВ</div>
    </div>`));
  for (let i = 0; i < 50; i++) {
    const t = i / 49;
    const gOp = t > 0.85 ? Math.max(0, (1 - t) / 0.15) : 1;
    const dropT = Math.min(1, t / 0.28);
    const y = -300 * (1 - eob(dropT));
    const cityOp = Math.min(1, Math.max(0, (t - 0.3) / 0.14));
    const ring = (t - 0.28 + 1) % 0.55 / 0.55;
    await page.evaluate(([y, gOp, cityOp, ring, dropT, t]) => {
      const pin = document.getElementById('pin');
      pin.style.opacity = Math.min(1, dropT * 2) * gOp;
      pin.style.transform = `translateY(${y}px)`;
      const city = document.getElementById('city');
      city.style.opacity = cityOp * gOp;
      city.style.transform = `translateY(${(1-cityOp)*24}px)`;
      const show = t > 0.28;
      const r1 = document.getElementById('r1'), r2 = document.getElementById('r2');
      const rr = 30 + ring * 150;
      r1.setAttribute('r', rr); r1.setAttribute('stroke-opacity', show ? (1 - ring) * 0.9 * gOp : 0);
      const ring2 = (ring + 0.5) % 1, rr2 = 30 + ring2 * 150;
      r2.setAttribute('r', rr2); r2.setAttribute('stroke-opacity', show ? (1 - ring2) * 0.7 * gOp : 0);
    }, [y, gOp, cityOp, ring, dropT, t]);
    await page.screenshot({ path: `ov_pin/${String(i).padStart(3,'0')}.png`, omitBackground: true });
  }
  console.log('pin done');

  // ---- SCROLL: feed scrolls fast then stops on bakery card, 75 frames ----
  fs.mkdirSync('ov_scroll', { recursive: true });
  const cards = [];
  for (let k = 0; k < 9; k++) {
    const hot = k === 6;
    cards.push(`<div style="height:300px;margin:18px 22px;border-radius:22px;position:relative;overflow:hidden;
      background:${hot ? 'linear-gradient(135deg,#3a2510,#171310)' : 'linear-gradient(135deg,#1d1d1f,#141416)'};
      border:${hot ? '3px solid #e8842a' : '1px solid rgba(255,255,255,.08)'}">
      <div style="position:absolute;left:22px;top:22px;width:56px;height:56px;border-radius:50%;background:${hot ? '#e8842a' : '#2c2c2e'}"></div>
      <div style="position:absolute;left:96px;top:26px;width:${hot?200:150}px;height:18px;border-radius:9px;background:${hot ? 'rgba(232,132,42,.85)' : '#2c2c2e'}"></div>
      <div style="position:absolute;left:96px;top:54px;width:100px;height:14px;border-radius:7px;background:#2c2c2e"></div>
      ${hot ? `<div style="position:absolute;left:22px;bottom:26px;font-family:'SG';font-size:40px;color:#fff">Пекарня \u{1F35E}</div>
      <div style="position:absolute;right:22px;bottom:26px;font-family:'M8';font-size:30px;color:#9CF806">▶ 80 000</div>` :
      `<div style="position:absolute;left:22px;bottom:30px;width:70%;height:16px;border-radius:8px;background:#242426"></div>`}
    </div>`);
  }
  await page.setContent(base(`
    <div id="phone" style="position:absolute;left:50%;top:330px;transform:translateX(-50%);width:560px;height:1050px;opacity:0;
      background:#0a0a0a;border-radius:56px;border:5px solid #2a2a2c;box-shadow:0 30px 90px rgba(0,0,0,.75);overflow:hidden">
      <div style="position:absolute;top:18px;left:50%;transform:translateX(-50%);width:160px;height:30px;background:#000;border-radius:16px;z-index:5"></div>
      <div id="feed" style="position:absolute;top:60px;left:0;width:100%">${cards.join('')}</div>
    </div>
    <div id="fing" style="position:absolute;left:calc(50% + 180px);top:1180px;font-size:110px;opacity:0;filter:drop-shadow(0 8px 18px rgba(0,0,0,.6))">\u{1F446}</div>`));
  for (let i = 0; i < 75; i++) {
    const t = i / 74;
    const op = t < 0.1 ? t / 0.1 : (t > 0.86 ? Math.max(0, (1 - t) / 0.14) : 1);
    // scroll: fast then decelerate, stopping with card 6 centered (offset ~ -6*318 + 320)
    const target = 6 * 318 - 330;
    const prog = 1 - Math.pow(1 - Math.min(1, t / 0.62), 3);
    const off = -target * prog;
    const stopped = t > 0.62;
    const fy = 1180 - 240 * Math.min(1, t / 0.5) + (stopped ? 0 : Math.sin(t * 40) * 8);
    await page.evaluate(([off, op, fy, stopped, t]) => {
      document.getElementById('phone').style.opacity = op;
      document.getElementById('feed').style.transform = `translateY(${off}px)`;
      const f = document.getElementById('fing');
      f.style.opacity = op * (t < 0.7 ? 1 : Math.max(0, (0.86 - t) / 0.16));
      f.style.top = fy + 'px';
    }, [off, op, fy, stopped, t]);
    await page.screenshot({ path: `ov_scroll/${String(i).padStart(3,'0')}.png`, omitBackground: true });
  }
  console.log('scroll done');
  await b.close();
})();
