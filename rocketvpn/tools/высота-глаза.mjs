import { chromium } from "playwright";
import { БРАУЗЕР } from "/home/user/OKO-TEAM/rocketvpn/tools/браузер.mjs";
const бр = await chromium.launch({ executablePath: БРАУЗЕР, args:["--use-gl=angle","--use-angle=swiftshader","--enable-unsafe-swiftshader"] });
const с = await бр.newPage({ viewport:{width:1440,height:900} });
await с.goto("http://127.0.0.1:8170/", {waitUntil:"domcontentloaded", timeout:120000});
await с.waitForFunction(()=>window.RV_WORLD&&window.RV_WORLD["вступлениеИдёт"]&&!window.RV_WORLD["вступлениеИдёт"](),null,{timeout:240000}).catch(()=>{});
await с.evaluate(()=>window.RV_MOTION["кПунктy"]("финал",0.92));
await с.waitForTimeout(9000);
console.log(JSON.stringify(await с.evaluate(()=>{
  const мир=window.RV_WORLD["мир"](), T=мир.T, cam=мир.cam;
  let салон=null; мир.scene.traverse(о=>{ if(о.name==="салон") салон=о; });
  const п=new T.Vector3(); if(салон){салон.updateMatrixWorld(true); салон.getWorldPosition(п);}
  const с2=new T.Vector3(); if(салон) салон.getWorldScale(с2);
  const dir=new T.Vector3(); cam.getWorldDirection(dir);
  return { камера:[+cam.position.x.toFixed(3),+cam.position.y.toFixed(3),+cam.position.z.toFixed(3)],
    взгляд:[+dir.x.toFixed(3),+dir.y.toFixed(3),+dir.z.toFixed(3)],
    тангаж: +(Math.asin(dir.y)*180/Math.PI).toFixed(2),
    fov: +cam.fov.toFixed(2),
    салон:{поз:[+п.x.toFixed(3),+п.y.toFixed(3),+п.z.toFixed(3)], масштаб:+с2.x.toFixed(4)},
    глазНадПолом: салон? +((cam.position.y-п.y)/(с2.x||1)).toFixed(3):null };
}),null,1));
await бр.close();
