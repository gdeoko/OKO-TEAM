import { ЭКРАНЫ, браузер, страница, вИгру } from "./общее.mjs";
import fs from "node:fs";

const ВЫХ = "/home/user/OKO-TEAM/rocketcdn/tools/audit/out/pult";
fs.mkdirSync(ВЫХ, { recursive: true });

const СЕЛ = [
  [".rcf-navkey", "КУРС"], [".rcf-scan-key", "СКАН"], [".rcf-deploy", "УЗЕЛ"],
  [".rcf-help-key", "СПРАВКА"], [".rcf-auto-key", "АВТО"], [".rcf-stop-key", "СТОП"],
  [".rcf-thr", "ТЯГА"], [".rcf-map-key", "СЕТЬ"], [".rcf-shot", "КАДР"],
  [".rcf-zoom-in", "БЛИЖЕ"], [".rcf-zoom-out", "ДАЛЬШЕ"],
  [".rcf-fire-key", "(вне списка)"]
];

function мера(pg, сел) {
  return pg.evaluate((СЕЛ) => {
    /* ── повтор арифметики rc-deck.js ───────────────────── */
    const дпр = Math.min(2.5, window.devicePixelRatio || 1);
    const cvW = Math.round(innerWidth * дпр), cvH = Math.round(innerHeight * дпр);
    const вид = window.RC_DECK["какой"](innerWidth, innerHeight);
    const meta = window.RC_CAB_FLAT[вид] || window.RC_CAB_FLAT["широкая"];
    const план = window.RC_CAB_DECK[вид] || window.RC_CAB_DECK["широкая"];
    const п = window.RC_DECK["покрытие"](meta, cvW, cvH);
    const точка = (u, v) => ({ x: (п.ox + u * п.dw) / дпр, y: (п.oy + v * п.dh) / дпр });
    const ужать = (q, d) => {
      const cx = (q[0][0]+q[1][0]+q[2][0]+q[3][0])/4, cy = (q[0][1]+q[1][1]+q[2][1]+q[3][1])/4;
      return q.map(p => [cx + (p[0]-cx)*(1-d), cy + (p[1]-cy)*(1-d)]);
    };
    const места = (q, n, зазор) => {
      const out = [];
      for (let i = 0; i < n; i++) {
        const a = i/n, b = (i+1)/n;
        out.push(ужать([
          [q[0][0]+(q[1][0]-q[0][0])*a, q[0][1]+(q[1][1]-q[0][1])*a],
          [q[0][0]+(q[1][0]-q[0][0])*b, q[0][1]+(q[1][1]-q[0][1])*b],
          [q[3][0]+(q[2][0]-q[3][0])*b, q[3][1]+(q[2][1]-q[3][1])*b],
          [q[3][0]+(q[2][0]-q[3][0])*a, q[3][1]+(q[2][1]-q[3][1])*a]
        ], зазор == null ? 0.14 : зазор));
      }
      return out;
    };
    const ниши = [];
    (план["полосы"] || []).forEach((пол) => {
      места(ужать(пол["угол"], 0.03), пол["мест"], пол["зазор"]).forEach((кв, j) => {
        const q = кв.map(p => точка(p[0], p[1]));
        const cx = (q[0].x+q[1].x+q[2].x+q[3].x)/4, cy = (q[0].y+q[1].y+q[2].y+q[3].y)/4;
        ниши.push({
          cx: +cx.toFixed(1), cy: +cy.toFixed(1),
          ш: +Math.hypot(q[1].x-q[0].x, q[1].y-q[0].y).toFixed(1),
          в: +Math.hypot(q[3].x-q[0].x, q[3].y-q[0].y).toFixed(1),
          вЛев: +Math.hypot(q[3].x-q[0].x, q[3].y-q[0].y).toFixed(1),
          вПрав: +Math.hypot(q[2].x-q[1].x, q[2].y-q[1].y).toFixed(1),
          шВерх: +Math.hypot(q[1].x-q[0].x, q[1].y-q[0].y).toFixed(1),
          шНиз: +Math.hypot(q[2].x-q[3].x, q[2].y-q[3].y).toFixed(1),
          q: q.map(p => [+p.x.toFixed(1), +p.y.toFixed(1)])
        });
      });
    });
    const экраны = (план["экраны"] || []).map((э) => {
      const q = ужать(э["угол"], 0.05).map(p => точка(p[0], p[1]));
      return { ид: э["ид"],
               л: +Math.min(...q.map(p=>p.x)).toFixed(1), п: +Math.max(...q.map(p=>p.x)).toFixed(1),
               в: +Math.min(...q.map(p=>p.y)).toFixed(1), н: +Math.max(...q.map(p=>p.y)).toFixed(1) };
    });

    /* ── клавиши ─────────────────────────────────────────── */
    const клав = СЕЛ.map(([c, имя]) => {
      const e = document.querySelector(c);
      if (!e) return { сел: c, ожид: имя, нет: true };
      const s = getComputedStyle(e);
      const r = e.getBoundingClientRect();
      const b = e.querySelector("b");
      return { сел: c, ожид: имя,
        display: s.display, visibility: s.visibility, opacity: +s.opacity,
        phys: e.classList.contains("rcf-phys-hit"),
        x: +(r.left + r.width/2).toFixed(1), y: +(r.top + r.height/2).toFixed(1),
        w: +r.width.toFixed(1), h: +r.height.toFixed(1),
        l: +r.left.toFixed(1), t: +r.top.toFixed(1),
        подпись: b ? (b.textContent||"").trim() : null,
        кегльDOM: b ? +parseFloat(getComputedStyle(b).fontSize).toFixed(1) : null,
        видимБукв: b ? (getComputedStyle(b).display !== "none" && +getComputedStyle(b).opacity > 0.05) : null,
        title: e.getAttribute("title") || e.getAttribute("aria-label") || ""
      };
    });

    /* ── приборы табло ───────────────────────────────────── */
    const прибор = (c) => { const e = document.querySelector(c); if (!e) return null;
      const s = getComputedStyle(e); const r = e.getBoundingClientRect();
      return { есть: 1, display: s.display, x: +r.left.toFixed(1), y: +r.top.toFixed(1),
               w: +r.width.toFixed(1), h: +r.height.toFixed(1),
               текст: (e.textContent||"").replace(/\s+/g," ").trim().slice(0,40) }; };

    const кан = document.querySelector(".rcf-instr");
    let холст = null;
    if (кан) { const r = кан.getBoundingClientRect();
      холст = { w: кан.width, h: кан.height, cssW: +r.width.toFixed(1), cssH: +r.height.toFixed(1) }; }

    return {
      вид, экран: [innerWidth, innerHeight], дпр,
      покрытие: { k: +п.k.toFixed(4), dw: +(п.dw/дпр).toFixed(1), dh: +(п.dh/дпр).toFixed(1),
                  ox: +(п.ox/дпр).toFixed(1), oy: +(п.oy/дпр).toFixed(1), доля: +п.доля.toFixed(3) },
      мест: ниши.length, ниши, экраныПлиты: экраны, клав, холст,
      имена: window.RC_KEYS ? window.RC_KEYS.KEYS.map(k => k["имя"]) : [],
      табло: {
        deck: прибор(".rcf-deck"), top: прибор(".rcf-d-top"), main: прибор(".rcf-d-main"),
        bars: прибор(".rcf-bars"), en: прибор(".rcf-bar-en"), hull: прибор(".rcf-bar-hull"),
        radar: прибор(".rcf-radar"), thr: прибор(".rcf-thr"), speed: прибор(".rcf-speed"),
        net: прибор(".rcf-net"), prog: прибор(".rcf-prog"), course: прибор(".rcf-d-course")
      },
      живое: {
        enW: (document.querySelector(".rcf-bar-en s i")||{}).style ? document.querySelector(".rcf-bar-en s i").getBoundingClientRect().width : null,
        hullW: document.querySelector(".rcf-bar-hull s i") ? document.querySelector(".rcf-bar-hull s i").getBoundingClientRect().width : null,
        enТ: (document.querySelector(".rcf-bar-en u")||{}).textContent,
        hullТ: (document.querySelector(".rcf-bar-hull u")||{}).textContent,
        скорость: (document.querySelector(".rcf-d-spd .rcf-speed b")||{}).textContent,
        thrFill: document.querySelector(".rcf-thr-fill") ? document.querySelector(".rcf-thr-fill").getBoundingClientRect().height : null,
        холстХеш: (() => { const cv = document.querySelector(".rcf-instr"); if (!cv) return null;
          try { const c = cv.getContext("2d"); const d = c.getImageData(0, Math.max(0,cv.height-Math.round(cv.height*0.22)), cv.width, Math.round(cv.height*0.2)).data;
            let s = 0; for (let i = 0; i < d.length; i += 97) s = (s * 31 + d[i]) >>> 0; return s; } catch (e) { return "нельзя:" + e.message; } })()
      }
    };
  }, сел);
}

const b = await браузер();
const итоги = {};
const СПИСОК = process.argv.slice(2);
for (const имя of СПИСОК) {
  const э = ЭКРАНЫ[имя];
  const { pg, беды } = await страница(b, э);
  const вошли = await вИгру(pg);
  await pg.waitForTimeout(6000);
  const m1 = await мера(pg, СЕЛ);
  await pg.waitForTimeout(3500);
  const m2 = await мера(pg, СЕЛ);
  m1.вошли = вошли; m1.беды = беды.slice(0, 6);
  m1.второй = { живое: m2.живое, клавЦентры: m2.клав.map(k => [k.x, k.y]) };
  итоги[имя] = m1;
  fs.writeFileSync(`${ВЫХ}/data-${имя}.json`, JSON.stringify(m1, null, 1));
  /* кадр плиты крупно */
  const пл = m1.табло.deck;
  const низ = Math.min(э.vp.height, (пл ? пл.y + пл.h : э.vp.height));
  const верх = Math.max(0, Math.round(э.vp.height * (m1.вид === "высокая" ? 0.78 : 0.76)));
  await pg.screenshot({ path: `${ВЫХ}/пульт-${имя}.png`,
    clip: { x: 0, y: верх, width: э.vp.width, height: Math.max(40, Math.round(э.vp.height - верх)) } });
  await pg.screenshot({ path: `${ВЫХ}/весь-${имя}.png` });
  console.log(имя, "вид=" + m1.вид, "мест=" + m1.мест, "вошли=" + вошли, "клавПоказано=" + m1.клав.filter(k=>k.display!=="none"&&!k.нет).length);
  await pg.close();
}
fs.writeFileSync(`${ВЫХ}/пульт-${СПИСОК.join('_')}.json`, JSON.stringify(итоги, null, 1));
await b.close();
console.log("готово");
