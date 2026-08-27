import { ЭКРАНЫ, браузер, страница } from "./общее.mjs";
const э = { ...ЭКРАНЫ["телефон"], dpr: 1 };
const b = await браузер();
const t0=Date.now(); const от=()=>((Date.now()-t0)/1000).toFixed(0);
const { pg } = await страница(b, э); console.log("загрузка", от());
await pg.exposeFunction("м", (o) => console.log(от() + "с " + JSON.stringify(o)));
try {
await pg.evaluate(async () => {
  const сон = (ms) => new Promise(r => setTimeout(r, ms));
  let n = 0, t = performance.now();
  const rr = (ts) => { n++; requestAnimationFrame(rr); };
  requestAnimationFrame(rr);
  await сон(10000);
  await window.м({ кадров_за_10с: n, fps: +(n / 10).toFixed(2), y: Math.round(scrollY) });
  for (let i = 0; i < 12; i++) {
    const a = performance.now(); const n0 = n;
    scrollBy(0, Math.round(innerHeight * 0.9));
    await сон(200);
    await window.м({ шаг: i, y: Math.round(scrollY), мс: Math.round(performance.now() - a), кадров: n - n0, акт: window.RC_SCENE && window.RC_SCENE.act });
  }
});
} catch(e) { console.log("ОБРЫВ", (e.message||"").slice(0,80)); }
await b.close();
