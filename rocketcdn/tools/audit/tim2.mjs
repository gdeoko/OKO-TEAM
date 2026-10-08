import { ЭКРАНЫ, браузер, страница } from "./общее.mjs";
const э = { ...ЭКРАНЫ["телефон"] };
const b = await браузер();
let t = Date.now(); const шаг = (m) => { console.log(m, ((Date.now()-t)/1000).toFixed(1)); t = Date.now(); };
const { pg } = await страница(b, э); шаг("загрузка+9с");
for (let i=0;i<6;i++){ await pg.evaluate(()=>1); шаг("пустой evaluate "+i); }
await pg.waitForTimeout(20000); шаг("отстой 20с");
for (let i=0;i<6;i++){ await pg.evaluate(()=>1); шаг("пустой evaluate после "+i); }
for (let i=0;i<3;i++){ await pg.mouse.wheel(0,80); шаг("колесо"); await pg.waitForTimeout(1100); шаг("ждём"); const y = await pg.evaluate(()=>Math.round(scrollY)); шаг("y="+y); }
const buf = await pg.screenshot({type:"jpeg",quality:55}); шаг("снимок "+buf.length);
await b.close();
