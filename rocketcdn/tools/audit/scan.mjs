import fs from "node:fs";
import { ЭКРАНЫ, браузер, страница } from "./общее.mjs";

const имя = process.argv[2] || "телефон";
const э = ЭКРАНЫ[имя];
const дир = "tools/audit/out/" + имя;
fs.mkdirSync(дир, { recursive: true });

const b = await браузер();
const { pg, беды } = await страница(b, э);

/* помощник: декодирует jpeg и отдаёт 32x32 яркость */
const h = await b.newPage({ viewport: { width: 64, height: 64 } });
await h.goto("about:blank");
async function хэш(buf) {
  return h.evaluate(async (b64) => {
    const im = new Image();
    await new Promise((r) => { im.onload = r; im.onerror = r; im.src = "data:image/jpeg;base64," + b64; });
    const c = document.createElement("canvas"); c.width = 32; c.height = 32;
    const x = c.getContext("2d"); x.drawImage(im, 0, 0, 32, 32);
    const d = x.getImageData(0, 0, 32, 32).data, o = [];
    for (let i = 0; i < d.length; i += 4) o.push(Math.round(0.299*d[i]+0.587*d[i+1]+0.114*d[i+2]));
    return o;
  }, buf.toString("base64"));
}

async function числа() {
  return pg.evaluate(() => {
    const r = document.documentElement;
    const I = window.RC_INTERIOR;
    const st = I && I.state ? I.state() : {};
    const cs = getComputedStyle(r);
    return {
      y: Math.round(window.scrollY),
      акт: window.RC_SCENE && window.RC_SCENE.act,
      k: window.RC_SCENE ? +window.RC_SCENE.k.toFixed(3) : null,
      под: typeof window.RC_APPROACH === "number" ? +window.RC_APPROACH.toFixed(3) : null,
      двер: typeof window.RC_DOOR === "number" ? +window.RC_DOOR.toFixed(3) : null,
      обор: I && I.yaw ? +(I.yaw() * 57.3).toFixed(1) : null,
      con: I && I.con ? +I.con().toFixed(3) : null,
      back: I && I.back ? +I.back().toFixed(3) : null,
      вход: I && I.enter ? +I.enter().toFixed(3) : null,
      доля: st.доля, физ: st.физическая_доля, порогВх: st.порог_вход,
      видна: st.видна, постр: st.построена, проход: st.проход,
      кл: ["rc-in-hatch","rc-inside","rc-deep-inside","rc-approach","rc-door-open","rc-rocket-parked"]
            .filter(c => r.classList.contains(c)).join(","),
      оп: (function(){
        const o = {};
        [".rc-flight",".rc-gate",".rc-airlock",".rc-cabin","#reliability","#faq","#contact"].forEach(s=>{
          const e = document.querySelector(s); if (e) o[s] = +getComputedStyle(e).opacity;
        });
        return o;
      })()
    };
  });
}

const vh = э.vp.height;
/* подвод: крупными шагами, но всё равно прокруткой */
const цель = await pg.evaluate(() => {
  const e = document.getElementById("included");
  return Math.max(0, Math.round(e.getBoundingClientRect().top + scrollY - innerHeight * 1.3));
});
let y = 0;
while (y < цель) {
  const шаг = Math.min(Math.round(vh * 0.35), цель - y);
  await pg.evaluate((s) => scrollBy(0, s), шаг);
  y += шаг;
  await pg.waitForTimeout(420);
}
await pg.waitForTimeout(4000);

const шаг = Math.round(vh * 0.10);
const макс = await pg.evaluate(() => document.documentElement.scrollHeight - innerHeight);
const лог = [];
let пред = null, i = 0;
const t0 = Date.now();
while (true) {
  const n = числа_имя(i);
  const c = await числа();
  const buf = await pg.screenshot({ type: "jpeg", quality: 55 });
  fs.writeFileSync(дир + "/" + n + ".jpg", buf);
  const hh = await хэш(buf);
  let d = null;
  if (пред) { let s = 0; for (let q = 0; q < hh.length; q++) s += Math.abs(hh[q] - пред[q]); d = +(s / hh.length).toFixed(2); }
  пред = hh;
  c.n = n; c.diff = d;
  лог.push(c);
  console.log(n, JSON.stringify(c));
  if (c.y >= макс - 2) break;
  if (Date.now() - t0 > 470000) { console.log("ВРЕМЯ ВЫШЛО на шаге", i); break; }
  await pg.evaluate((s) => scrollBy(0, s), шаг);
  await pg.waitForTimeout(1150);
  i++;
}
function числа_имя(i) { return String(i).padStart(3, "0"); }

fs.writeFileSync(дир + "/лог.json", JSON.stringify(лог, null, 1));
console.log("БЕДЫ", JSON.stringify(беды.slice(0, 12)));
await b.close();
