import { ЭКРАНЫ, браузер, страница, вИгру, проём } from "./общее.mjs";
import fs from "fs";

const СПИСОК = (process.env.RC_SCR || "ПК").split(",");
const КАДРЫ = "/home/user/OKO-TEAM/rocketcdn/tools/audit/кадры/";

function вПолигоне(x, y, п) {
  let вн = false;
  for (let i = 0, j = п.length - 1; i < п.length; j = i++) {
    const xi = п[i][0], yi = п[i][1], xj = п[j][0], yj = п[j][1];
    if (((yi > y) !== (yj > y)) && (x < (xj - xi) * (y - yi) / (yj - yi) + xi)) вн = !вн;
  }
  return вн;
}

const b = await браузер();
for (const имя of СПИСОК) {
  const э = ЭКРАНЫ[имя];
  const { pg, беды } = await страница(b, э);
  const ок = await вИгру(pg);
  await pg.waitForTimeout(4000);
  const w = await проём(pg);

  const д = await pg.evaluate(() => {
    const о = { vw: innerWidth, vh: innerHeight };
    const wrap = document.querySelector(".rc-flight");
    о.классы = wrap ? wrap.className : null;
    const cw = wrap ? getComputedStyle(wrap) : null;
    if (cw) {
      о.перем = {};
      ["--cab-wx","--cab-wy","--cab-ww","--cab-wh","--cab-clip"].forEach(k =>
        о.перем[k] = cw.getPropertyValue(k).trim().slice(0, 400));
    }
    const снять = (сел) => {
      const э = document.querySelector(сел);
      if (!э) return null;
      const s = getComputedStyle(э), r = э.getBoundingClientRect();
      const о2 = { есть: 1, r: [+r.left.toFixed(1), +r.top.toFixed(1), +r.width.toFixed(1), +r.height.toFixed(1)],
        opacity: s.opacity, display: s.display, visibility: s.visibility,
        pe: s.pointerEvents, z: s.zIndex, right: s.right, bottom: s.bottom, top: s.top, left: s.left,
        pos: s.position, clip: s.clipPath, transform: s.transform, overflow: s.overflow,
        aspect: s.aspectRatio };
      const im = э.tagName === "IMG" ? э : э.querySelector("img");
      if (im) {
        const ir = im.getBoundingClientRect(), is = getComputedStyle(im);
        о2.img = { src: im.getAttribute("src"), nat: [im.naturalWidth, im.naturalHeight],
          r: [+ir.left.toFixed(1), +ir.top.toFixed(1), +ir.width.toFixed(1), +ir.height.toFixed(1)],
          fit: is.objectFit, clip: is.clipPath, mask: is.maskImage.slice(0,60), compl: im.complete };
      }
      return о2;
    };
    о.holo = снять(".rcf-holo");
    о.vpn  = снять(".rc-vpn-projector");
    о.vpnMark = снять(".rc-vpn-entry-mark");
    const P = window.RC_PANEL && window.RC_PANEL.last;
    if (P) { о.poly = P.poly; о.safe = P.safe; о.inner = P.inner; }
    // элемент в точке центра холо
    if (о.holo) {
      const cx = о.holo.r[0] + о.holo.r[2]/2, cy = о.holo.r[1] + о.holo.r[3]/2;
      const t = document.elementFromPoint(cx, cy);
      о.подЦентром = t ? (t.tagName + "." + (t.className||"").toString().slice(0,50)) : null;
    }
    if (о.vpn) {
      const cx = о.vpn.r[0] + о.vpn.r[2]/2, cy = о.vpn.r[1] + о.vpn.r[3]/2;
      const t = document.elementFromPoint(cx, cy);
      о.подVpn = t ? (t.tagName + "." + (t.className||"").toString().slice(0,50)) : null;
    }
    return о;
  });

  const R = { экран: имя, vp: э.vp, вошли: ок, проём: w, ...д, беды: беды.slice(0, 6) };

  // разбор clip-path холо в координатах элемента
  if (д.holo && /polygon/.test(д.holo.clip)) {
    const t = д.holo.clip.match(/-?[\d.]+%/g) || [];
    const pts = [];
    for (let i = 0; i + 1 < t.length; i += 2) pts.push([parseFloat(t[i]), parseFloat(t[i+1])]);
    const xs = pts.map(p=>p[0]), ys = pts.map(p=>p[1]);
    const bx = { l: Math.min(...xs), r: Math.max(...xs), t: Math.min(...ys), b: Math.max(...ys) };
    R.клипДоли = bx;
    const [x,y,ww,hh] = д.holo.r;
    R.клипВидно = { л: +(x + bx.l/100*ww).toFixed(1), п: +(x + bx.r/100*ww).toFixed(1),
                    в: +(y + bx.t/100*hh).toFixed(1), н: +(y + bx.b/100*hh).toFixed(1) };
    R.срез = { слева: +(bx.l/100*ww).toFixed(1), справа: +((100-bx.r)/100*ww).toFixed(1),
               сверху: +(bx.t/100*hh).toFixed(1), снизу: +((100-bx.b)/100*hh).toFixed(1) };
    R.клипТочек = pts.length;
  }

  // положение относительно проёма
  if (w && д.holo) {
    const [x,y,ww,hh] = д.holo.r;
    const шп = w.п - w.л, вп = w.н - w.в;
    R.кПроёму = {
      доПравой: +(w.п - (x+ww)).toFixed(1), доНижней: +(w.н - (y+hh)).toFixed(1),
      доЛевой: +(x - w.л).toFixed(1), доВерхней: +(y - w.в).toFixed(1),
      долиПравый: +(((w.п-(x+ww))/шп)*100).toFixed(2) + "%",
      долиНижний: +(((w.н-(y+hh))/вп)*100).toFixed(2) + "%",
      сверхуДоля: +(((y - w.в)/вп)*100).toFixed(2) + "%",
      центрСверхуДоля: +((((y+hh/2) - w.в)/вп)*100).toFixed(2) + "%",
      ширинаПроёма: +шп.toFixed(1), высотаПроёма: +вп.toFixed(1)
    };
  }

  // углы холо внутри настоящего многоугольника проёма?
  if (д.poly && д.holo) {
    const W = д.vw, H = д.vh;
    const П = д.poly.map(p => [ (1+p[0])/2*W, (1-p[1])/2*H ]);
    const xs = П.map(p=>p[0]), ys = П.map(p=>p[1]);
    R.полигонГабарит = { л:+Math.min(...xs).toFixed(1), п:+Math.max(...xs).toFixed(1),
                          в:+Math.min(...ys).toFixed(1), н:+Math.max(...ys).toFixed(1) };
    const [x,y,ww,hh] = д.holo.r;
    const углы = [[x,y],[x+ww,y],[x,y+hh],[x+ww,y+hh]];
    R.углыВПроёме = углы.map(u => вПолигоне(u[0], u[1], П));
    R.наРаме = R.углыВПроёме.some(v => !v);
    if (д.vpn) {
      const [vx,vy,vw2,vh2] = д.vpn.r;
      R.vpnУглыВПроёме = [[vx,vy],[vx+vw2,vy],[vx,vy+vh2],[vx+vw2,vy+vh2]].map(u=>вПолигоне(u[0],u[1],П));
    }
  }

  // перекрытие vpn и holo
  if (д.holo && д.vpn) {
    const a = д.holo.r, c = д.vpn.r;
    const ш = Math.min(a[0]+a[2], c[0]+c[2]) - Math.max(a[0], c[0]);
    const в = Math.min(a[1]+a[3], c[1]+c[3]) - Math.max(a[1], c[1]);
    R.vpnПерекрытие = (ш > 0 && в > 0) ? { ш:+ш.toFixed(1), в:+в.toFixed(1) } : "нет";
    R.зазорМеждуНими = +(a[0] - (c[0]+c[2])).toFixed(1);
  }

  // соотношение сторон картинки
  if (д.holo && д.holo.img) {
    const n = д.holo.img.nat, r = д.holo.img.r;
    R.аспект = { натур: +(n[0]/n[1]).toFixed(4), нарисован: +(r[2]/r[3]).toFixed(4),
                 коробка: +(д.holo.r[2]/д.holo.r[3]).toFixed(4) };
  }

  console.log("### " + имя + " ###");
  console.log(JSON.stringify(R, null, 1));
  fs.writeFileSync(КАДРЫ + "../out/лого-" + имя + ".json", JSON.stringify(R, null, 1));

  // кадры
  if (д.holo) {
    const [x,y,ww,hh] = д.holo.r;
    const поле = 34;
    const cl = { x: Math.max(0, Math.round(x-поле)), y: Math.max(0, Math.round(y-поле)),
                 width: Math.min(д.vw, Math.round(ww+поле*2)), height: Math.min(д.vh, Math.round(hh+поле*2)) };
    await pg.screenshot({ path: КАДРЫ + "холо-" + имя + ".png", clip: cl });
    // крупнее: с областью vpn
    const x2 = д.vpn ? Math.min(x, д.vpn.r[0]) : x;
    const п2 = д.vpn ? Math.max(x+ww, д.vpn.r[0]+д.vpn.r[2]) : x+ww;
    const y2 = д.vpn ? Math.min(y, д.vpn.r[1]) : y;
    const н2 = д.vpn ? Math.max(y+hh, д.vpn.r[1]+д.vpn.r[3]) : y+hh;
    await pg.screenshot({ path: КАДРЫ + "пара-" + имя + ".png",
      clip: { x: Math.max(0, Math.round(x2-40)), y: Math.max(0, Math.round(y2-40)),
              width: Math.round(п2-x2+80), height: Math.round(н2-y2+80) } });
  }
  await pg.screenshot({ path: КАДРЫ + "кадр-" + имя + ".jpeg", type: "jpeg", quality: 72 });
  await pg.close();
}
await b.close();
