import { ЭКРАНЫ, браузер, страница } from "./общее.mjs";
const э = { ...ЭКРАНЫ["телефон"] };
const b = await браузер();
let t0 = Date.now(); const от = () => ((Date.now()-t0)/1000).toFixed(1);
const { pg } = await страница(b, э); console.log("загрузка готова", от());
for (let i=0;i<25;i++){ const a=Date.now(); await pg.evaluate(()=>1); console.log("evaluate", i, "занял", ((Date.now()-a)/1000).toFixed(1), "от старта", от()); }
const a2=Date.now(); const buf = await pg.screenshot({type:"jpeg",quality:55}); console.log("снимок", ((Date.now()-a2)/1000).toFixed(1), buf.length);
await b.close();
