import { холо } from "./счёт.mjs";
const ЭК = { "телефон":[412,800], "узкий":[360,640], "планшет":[820,1180], "четыре":[1024,768],
             "ноутбук":[1280,720], "ПК":[1440,900], "широкий":[1920,1080], "лежачий":[900,412] };
function крайСправа(P, y, W) { for (let x = W - 1; x >= 0; x--) if (вн(P, x, y)) return x; return null; }
function крайСнизу(P, x, H) { for (let y = H - 1; y >= 0; y--) if (вн(P, x, y)) return y; return null; }
function вн(p, x, y) { let h = false;
  for (let i = 0, j = p.length - 1; i < p.length; j = i++) {
    const xi = p[i][0], yi = p[i][1], xj = p[j][0], yj = p[j][1];
    if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) h = !h; } return h; }
function коробкаОк(P, x, y, w, h, m) {
  for (let t = 0; t <= w; t += 3) { if (!вн(P, x + t, y - m) || !вн(P, x + t, y + h + m)) return false; }
  for (let t = 0; t <= h; t += 3) { if (!вн(P, x - m, y + t) || !вн(P, x + w + m, y + t)) return false; }
  return true;
}
const из = {};
for (const [имя, [W, H]] of Object.entries(ЭК)) {
  const { р, холо: hb, vpn } = холо(W, H);
  const P = р.P;
  /* клип: габарит контура в долях кадра = доли коробки элемента */
  const кл = { л: (р.стекло.л / W) * 100, п: (р.стекло.п / W) * 100,
               в: (р.стекло.в / H) * 100, н: (р.стекло.н / H) * 100 };
  const нат = 343 / 320;                 /* mark.webp */
  const карт = { ш: hb.ш, в: hb.ш / нат };  /* object-fit: contain в квадрате */
  const кy = hb.y + (hb.ш - карт.в) / 2;
  const срез = { слева: кл.л / 100 * hb.ш, справа: (100 - кл.п) / 100 * hb.ш,
                 сверху: Math.max(0, (hb.y + кл.в / 100 * hb.ш) - кy),
                 снизу: Math.max(0, (кy + карт.в) - (hb.y + кл.н / 100 * hb.ш)) };
  const углы = [[hb.x, hb.y], [hb.п, hb.y], [hb.x, hb.н], [hb.п, hb.н]].map(u => вн(P, u[0], u[1]));
  const углыV = [[vpn.x, vpn.y], [vpn.п, vpn.y], [vpn.x, vpn.н], [vpn.п, vpn.н]].map(u => вн(P, u[0], u[1]));
  const ШП = р.вписан.п - р.вписан.л, ВП = р.вписан.н - р.вписан.в;
  const ГВ = р.стекло.н - р.стекло.в;
  /* насколько ниже и правее можно уйти, зазор 8 точек до контура */
  let фронт = [];
  for (let by = Math.round(р.стекло.н); by > hb.н - 4; by -= 3) {
    let bx = null;
    for (let cx = Math.round(р.стекло.п); cx > 40; cx -= 3) if (коробкаОк(P, cx - hb.ш, by - hb.ш, hb.ш, hb.ш, 8)) { bx = cx; break; }
    if (bx) { фронт.push([by, bx]); }
    if (фронт.length > 3) break;
  }
  из[имя] = {
    экран: [W, H], кадр: р.имя,
    доли: Object.fromEntries(Object.entries(р.доли).map(([k, v]) => [k, +v.toFixed(2)])),
    вписан: Object.fromEntries(Object.entries(р.вписан).map(([k, v]) => [k, +v.toFixed(1)])),
    стекло: Object.fromEntries(Object.entries(р.стекло).map(([k, v]) => [k, +v.toFixed(1)])),
    холо: { x: +hb.x.toFixed(1), y: +hb.y.toFixed(1), ш: +hb.ш.toFixed(1), п: +hb.п.toFixed(1), н: +hb.н.toFixed(1) },
    клипДоли: Object.fromEntries(Object.entries(кл).map(([k, v]) => [k, +v.toFixed(2)])),
    срезТочек: Object.fromEntries(Object.entries(срез).map(([k, v]) => [k, +v.toFixed(1)])),
    срезДоли: { сверху: +(срез.сверху / карт.в * 100).toFixed(1), снизу: +(срез.снизу / карт.в * 100).toFixed(1),
                слева: +(срез.слева / карт.ш * 100).toFixed(1), справа: +(срез.справа / карт.ш * 100).toFixed(1) },
    углыВСтекле: углы, наРаме: углы.some(v => !v),
    доКромок: { справаВпис: +(р.вписан.п - hb.п).toFixed(1), снизуВпис: +(р.вписан.н - hb.н).toFixed(1),
                справаДоли: +((р.вписан.п - hb.п) / ШП * 100).toFixed(2),
                снизуДоли: +((р.вписан.н - hb.н) / ВП * 100).toFixed(2) },
    поСтеклу: { запасСправа: +((крайСправа(P, hb.y + hb.ш / 2, W) || 0) - hb.п).toFixed(1),
                запасСнизу: +((крайСнизу(P, hb.x + hb.ш / 2, H) || 0) - hb.н).toFixed(1),
                центрПоВысоте: +(((hb.y + hb.ш / 2) - р.стекло.в) / ГВ * 100).toFixed(1) },
    можноНиже: фронт.map(f => ({ низ: f[0], правый: f[1],
      центрПоВысоте: +((f[0] - hb.ш / 2 - р.стекло.в) / ГВ * 100).toFixed(1) })),
    vpn: { x: +vpn.x.toFixed(1), y: +vpn.y.toFixed(1), ш: +vpn.ш.toFixed(1),
           зазорДоХоло: +(hb.x - vpn.п).toFixed(1), углыВСтекле: углыV },
  };
}
console.log(JSON.stringify(из, null, 1));
