import { ЭКРАНЫ, браузер, страница, вИгру } from "./общее.mjs";
const b = await браузер();
try {
  const { pg } = await страница(b, ЭКРАНЫ["ПК"]);
  const ок = await вИгру(pg);
  await pg.waitForTimeout(9000);
  const d = await pg.evaluate(() => {
    const cv = document.querySelector(".rcf-instr");
    if (!cv) return { нет: "холста" };
    const c = cv.getContext("2d");
    const т = { "07_СЕТЬ": [1197, 775], "08_КАДР": [160, 801], "09_БЛИЖЕ": [94, 828],
                "10_ДАЛЬШЕ": [1279, 800], "11_ДУБЛЬ": [1343, 828],
                "правее_11": [1405, 830], "пусто_небо": [700, 300] };
    const из = {};
    for (const k in т) {
      const p = c.getImageData(т[k][0] - 6, т[k][1] - 6, 12, 12).data;
      let s = 0, mx = 0;
      for (let i = 0; i < p.length; i += 4) { const v = (p[i]+p[i+1]+p[i+2])/3; s += v; if (v > mx) mx = v; }
      из[k] = { средн: +(s/(p.length/4)).toFixed(1), макс: +mx.toFixed(1) };
    }
    return { вошли: true, холст: [cv.width, cv.height], яркостьХолста: из };
  });
  console.log(JSON.stringify(d, null, 1));
  await pg.close();
} catch (e) { console.log("ОШИБКА:", e.message); }
await b.close();
