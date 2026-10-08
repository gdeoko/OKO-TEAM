import { ЭКРАНЫ, браузер, страница } from "./общее.mjs";
const э = { ...ЭКРАНЫ["телефон"] };
if (process.argv[2] === "1") э.dpr = 1;
const b = await браузер();
let t = Date.now(); const шаг = (m) => { console.log(m, ((Date.now()-t)/1000).toFixed(1)); t = Date.now(); };
const { pg } = await страница(b, э); шаг("загрузка+9с");
const h = await b.newPage({ viewport: { width: 64, height: 64 } }); await h.goto("about:blank"); шаг("помощник");
for (let i=0;i<3;i++){
  await pg.evaluate((s)=>scrollBy(0,s), 80); шаг("скролл");
  await pg.waitForTimeout(1100); шаг("ждём");
  const buf = await pg.screenshot({type:"jpeg", quality:55}); шаг("снимок "+buf.length);
  await h.evaluate(async (b64)=>{const im=new Image();await new Promise(r=>{im.onload=r;im.onerror=r;im.src="data:image/jpeg;base64,"+b64;});const c=document.createElement("canvas");c.width=32;c.height=32;c.getContext("2d").drawImage(im,0,0,32,32);return 1;}, buf.toString("base64")); шаг("хэш");
  await pg.evaluate(()=>({a:window.RC_SCENE&&window.RC_SCENE.act})); шаг("числа");
}
await b.close();
