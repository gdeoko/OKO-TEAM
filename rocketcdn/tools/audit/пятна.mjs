/* Сколько всего световых пятен рисует плита и где они */
import { ЭКРАНЫ, браузер, страница, вИгру } from "./общее.mjs";
const b = await браузер();
try {
  const { pg } = await страница(b, ЭКРАНЫ["ПК"]);
  await вИгру(pg);
  await pg.waitForTimeout(9000);
  const d = await pg.evaluate(() => {
    const cv = document.querySelector(".rcf-instr");
    const c = cv.getContext("2d");
    const W = cv.width, H = cv.height;
    const p = c.getImageData(0, 0, W, H).data;
    const яр = new Uint8Array(W * H);
    for (let i = 0, j = 0; i < p.length; i += 4, j++) {
      яр[j] = ((p[i] + p[i+1] + p[i+2]) / 3) > 26 ? 1 : 0;
    }
    const был = new Uint8Array(W * H), пятна = [];
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const s = y * W + x;
      if (!яр[s] || был[s]) continue;
      let st = [s], n = 0, x0 = x, x1 = x, y0 = y, y1 = y;
      был[s] = 1;
      while (st.length) {
        const q = st.pop(), qx = q % W, qy = (q / W) | 0;
        n++;
        if (qx < x0) x0 = qx; if (qx > x1) x1 = qx;
        if (qy < y0) y0 = qy; if (qy > y1) y1 = qy;
        const сос = [q-1, q+1, q-W, q+W];
        for (let k = 0; k < 4; k++) {
          const t = сос[k];
          if (t < 0 || t >= W*H) continue;
          if (k < 2 && Math.abs((t % W) - qx) !== 1) continue;
          if (яр[t] && !был[t]) { был[t] = 1; st.push(t); }
        }
      }
      if (n > 260) пятна.push({ x: Math.round((x0+x1)/2), y: Math.round((y0+y1)/2),
                                ш: x1-x0, в: y1-y0, точек: n });
    }
    пятна.sort((a,b) => a.x - b.x);
    return { холст: [W,H], пятен: пятна.length, пятна };
  });
  console.log(JSON.stringify(d, null, 1));
  await pg.close();
} catch (e) { console.log("ОШИБКА:", e.message); }
await b.close();
