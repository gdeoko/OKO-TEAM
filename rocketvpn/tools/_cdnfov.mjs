import { chromium } from "playwright";
import { БРАУЗЕР } from "./браузер.mjs";
const бр = await chromium.launch({ executablePath: БРАУЗЕР,
  args: ["--use-gl=angle","--use-angle=swiftshader","--enable-unsafe-swiftshader","--force-device-scale-factor=1"] });
const кон = await бр.newContext({ viewport:{width:1440,height:900}, deviceScaleFactor:1 });
const стр = await кон.newPage();
await стр.goto("http://127.0.0.1:8171/", { waitUntil:"domcontentloaded", timeout:120000 });
await стр.waitForFunction(()=>window.RC_GL&&window.RC_GL.ready3d,null,{timeout:300000});
await стр.waitForTimeout(3000);
const высота = await стр.evaluate(()=>Math.max(0,document.documentElement.scrollHeight-window.innerHeight));
for (let i=1;i<=90;i++){
  await стр.evaluate((y)=>window.scrollTo(0,y), Math.round(высота*(i/90)));
  await стр.evaluate(()=>new Promise((г)=>{let i=0;(function ш(){requestAnimationFrame(()=>(++i>=2?г():ш()));})();}));
}
const из = await стр.evaluate(()=>{
  const T=window.THREE; let cam=null;
  const кандидаты=[];
  for (const имя of ["RC_GL","RC_SCENE","RC_WORLD_API","RC_VIZ"]) {
    const м=window[имя]; if(!м) continue;
    for (const к in м) { try { const v=м[к]; if(v&&v.isCamera) кандидаты.push({путь:имя+"."+к,cam:v}); } catch(e){} }
    for (const к in м) { try { const v=м[к]; if(v&&v.isScene) v.traverse((o)=>{ if(o.isCamera) кандидаты.push({путь:имя+"."+к+"/scene",cam:o}); }); } catch(e){} }
  }
  if(!кандидаты.length) return {нет:"камеры не нашла"};
  cam=кандидаты[0].cam;
  var путь=кандидаты[0].путь;
  const п=cam.getWorldPosition(new T.Vector3());
  const в=new T.Vector3(0,0,-1).applyQuaternion(cam.getWorldQuaternion(new T.Quaternion()));
  return { путь, fov:+cam.fov.toFixed(2), позиция:[+п.x.toFixed(3),+п.y.toFixed(3),+п.z.toFixed(3)],
           взгляд:[+в.x.toFixed(3),+в.y.toFixed(3),+в.z.toFixed(3)],
           тангаж:+(Math.asin(в.y)*180/Math.PI).toFixed(2) };
});
console.log(JSON.stringify(из,null,1));
await бр.close();
