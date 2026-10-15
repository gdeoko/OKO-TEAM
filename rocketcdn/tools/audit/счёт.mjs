/* Считаем геометрию рубки без браузера: та же арифметика, что в
   rc-deck.какой/покрытие, rc-panel.flatBuild и rc-panel.inscribed. */
import fs from "fs";
const src = fs.readFileSync("/home/user/OKO-TEAM/rocketcdn/assets/gen/cab/flat.js", "utf8");
const FLAT = JSON.parse(src.slice(src.indexOf("{", src.indexOf("RC_CAB_FLAT"))).replace(/;\s*$/, "").trim());
const ДНО = 0.978;
const какой = (W, H) => H > W ? "высокая" : (W / H < 1.55 ? "средняя" : "широкая");
function покрытие(meta, W, H) {
  const k = Math.max(W / meta.w, H / meta.h);
  const dw = meta.w * k, dh = meta.h * k;
  let д = 0.5;
  if (dh > H) { д = (H - ДНО * dh) / (H - dh); if (д < 0.5) д = 0.5; if (д > 1) д = 1; }
  return { k, dw, dh, ox: (W - dw) / 2, oy: (H - dh) * д };
}
function inPoly(p, x, y) { let h = false;
  for (let i = 0, j = p.length - 1; i < p.length; j = i++) {
    const xi = p[i][0], yi = p[i][1], xj = p[j][0], yj = p[j][1];
    if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) h = !h; } return h; }
function inscribed(poly) {
  const ys = poly.map(p => p[1]).slice().sort((a, b) => a - b);
  let best = null, bestA = -1;
  for (let i = 0; i < ys.length; i++) for (let k = i + 1; k < ys.length; k++) {
    const b = ys[i], t = ys[k]; if (t - b < 1e-3) continue;
    let l = -1e9, r = 1e9, есЛ = false, есП = false;
    for (let e = 0, p = poly.length - 1; e < poly.length; p = e++) {
      const x1 = poly[p][0], y1 = poly[p][1], x2 = poly[e][0], y2 = poly[e][1];
      if (Math.max(y1, y2) < b - 1e-9) continue;
      if (Math.min(y1, y2) > t + 1e-9) continue;
      const cy0 = Math.max(b, Math.min(y1, y2)), cy1 = Math.min(t, Math.max(y1, y2));
      let xa, xb;
      if (Math.abs(y2 - y1) < 1e-9) { xa = x1; xb = x2; }
      else { xa = x1 + (x2 - x1) * (cy0 - y1) / (y2 - y1); xb = x1 + (x2 - x1) * (cy1 - y1) / (y2 - y1); }
      const xmin = Math.min(xa, xb), xmax = Math.max(xa, xb), mid = (x1 + x2) / 2;
      if (mid < 0) { есЛ = true; if (xmax > l) l = xmax; } else { есП = true; if (xmin < r) r = xmin; }
    }
    if (!есЛ || !есП || r - l < 1e-3) continue;
    const a = (r - l) * (t - b); if (a > bestA) { bestA = a; best = { l, r, b, t }; }
  } return best;
}
const clamp = (a, b, c) => Math.min(Math.max(b, a), c);

export function рубка(W, H) {
  const meta = FLAT[какой(W, H)];
  const п = покрытие(meta, W, H);
  const sx = (u) => (п.ox + u * п.dw) / W * 2 - 1;
  const sy = (v) => 1 - (п.oy + v * п.dh) / H * 2;
  const poly = meta["контур"].map(q => [sx(q[0]), sy(q[1])]);
  const box = meta["коробка"];
  const inner = { l: sx(box.l), r: sx(box.r), t: sy(box.t), b: sy(box.b) };
  const raw = inscribed(poly), pad = 0.012;
  const safe = { l: raw.l + pad, r: raw.r - pad, b: raw.b + pad, t: raw.t - pad };
  const wx = (1 + safe.l) / 2 + pad, ww = (safe.r - safe.l) / 2 - pad * 2;
  const wy = (1 - safe.t) / 2 + pad, wh = (safe.t - safe.b) / 2 - pad * 2;
  const dy = (1 - inner.b) / 2;
  const P = poly.map(p => [(1 + p[0]) / 2 * W, (1 - p[1]) / 2 * H]);
  return { имя: какой(W, H), W, H, poly, P, inner, safe,
    вписан: { л: wx * W, п: (wx + ww) * W, в: wy * H, н: (wy + wh) * H },
    доли: { wx: wx * 100, wy: wy * 100, ww: ww * 100, wh: wh * 100, dy: dy * 100 },
    стекло: { л: Math.min(...P.map(p => p[0])), п: Math.max(...P.map(p => p[0])),
              в: Math.min(...P.map(p => p[1])), н: Math.max(...P.map(p => p[1])) },
    внутри: (x, y) => inPoly(P, x, y) };
}

export function холо(W, H) {
  const р = рубка(W, H);
  const мал = W <= 760;
  const ш = мал ? 44 : clamp(0.07 * W, 54, 92);
  const прав = (р.доли.wx / 100) * W + 0.026 * W;
  const низ = (1 - р.доли.wy / 100 - р.доли.wh / 100) * H + 0.022 * H;
  const x = W - прав - ш, y = H - низ - ш;
  const шv = мал ? 34 : clamp(0.06 * W, 46, 78);
  const правV = (р.доли.wx / 100) * W + 0.026 * W +
                (мал ? 44 + 10 : clamp(0.07 * W, 54, 92) + clamp(0.022 * W, 12, 26));
  const низV = (1 - р.доли.wy / 100 - р.доли.wh / 100) * H + 0.026 * H;
  return { р, холо: { x, y, ш, п: x + ш, н: y + ш },
           vpn: { x: W - правV - шv, y: H - низV - шv, ш: шv, п: W - правV, н: H - низV } };
}
