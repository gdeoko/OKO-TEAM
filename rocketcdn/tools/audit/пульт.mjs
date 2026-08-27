/* Экран вопросов на пульте в финале страницы. */
import { АДРЕС, ЭКРАНЫ, браузер } from "./общее.mjs";
import { writeFileSync, appendFileSync, mkdirSync } from "node:fs";
const ЭКР = process.argv[2] || "ПК", ЯЗ = process.argv[3] || "ru";
const э = ЭКРАНЫ[ЭКР]; const тег = ЭКР + "-" + ЯЗ;
const КАД = "/home/user/OKO-TEAM/rocketcdn/tools/audit/окна/кадры";
mkdirSync(КАД, { recursive: true });
const ЛОГ = "/home/user/OKO-TEAM/rocketcdn/tools/audit/окна/пульт-" + тег + ".txt";
function лог(...a){const s=a.map(x=>typeof x==="string"?x:JSON.stringify(x)).join(" ");try{appendFileSync(ЛОГ,s+"\n");}catch(e){}console.log(s);}

const b = await браузер();
const pg = await b.newPage({ viewport: э.vp, deviceScaleFactor: э.dpr, isMobile: э.mob, hasTouch: э.mob });
await pg.addInitScript((l)=>{try{localStorage.setItem("rc_lang",l);}catch(e){}}, ЯЗ);
pg.setDefaultTimeout(200000);
await pg.addInitScript(() => {
  let ждём=false, очередь=[];
  window.requestAnimationFrame = function (cb) { очередь.push(cb);
    if (!ждём) { ждём=true; setTimeout(()=>{ждём=false;const q=очередь;очередь=[];const t=performance.now();q.forEach(f=>{try{f(t)}catch(e){}});},200); }
    return 1; };
  window.cancelAnimationFrame = function(){};
});
await pg.goto(АДРЕС, { waitUntil: "domcontentloaded", timeout: 180000 });
await pg.waitForTimeout(10000);
лог("язык:", await pg.evaluate(()=>document.documentElement.lang));
let прошл=-1;
for (let i=0;i<70;i++){
  const y = await pg.evaluate(()=>{ scrollBy(0, innerHeight*0.7); return Math.round(scrollY); });
  if (y === прошл) break; прошл = y;
  await pg.waitForTimeout(500);
  const го = await pg.evaluate(()=>{const l=document.querySelector(".rc-desk"); return !!(l&&l.classList.contains("dsk-on"));});
  if (го) { лог("пульт зажёгся на sy=", y, "шаг", i); break; }
}
лог("докрутили до", await pg.evaluate(()=>Math.round(scrollY)), "из", await pg.evaluate(()=>document.documentElement.scrollHeight));
await pg.waitForTimeout(9000);
const st = await pg.evaluate(()=>{const l=document.querySelector(".rc-desk");
  return {есть:!!l, on:l?l.classList.contains("dsk-on"):false, sy:Math.round(scrollY), dh:document.documentElement.scrollHeight};});
лог("состояние:", st);
if (!st.есть || !st.on) {
  for (let i=0;i<8;i++){ await pg.evaluate(()=>scrollBy(0, -innerHeight*0.2)); await pg.waitForTimeout(900);
    const s2 = await pg.evaluate(()=>{const l=document.querySelector(".rc-desk");return l&&l.classList.contains("dsk-on");});
    if (s2) { лог("зажёгся на sy=", await pg.evaluate(()=>Math.round(scrollY))); break; }
  }
}
await pg.waitForTimeout(3000);
const д = await pg.evaluate(()=>{
  const win=document.querySelector(".dsk-win"), fr=document.querySelector(".dsk-frame");
  if(!win) return {нет:true};
  const R=(э)=>{const r=э.getBoundingClientRect();return [+r.left.toFixed(1),+r.top.toFixed(1),+r.width.toFixed(1),+r.height.toFixed(1)];};
  const кн=[]; document.querySelectorAll(".dsk-q,.dsk-b").forEach(э=>{
    кн.push({к:э.className,t:(э.textContent||"").replace(/\s+/g," ").trim().slice(0,46),r:R(э),
      sw:э.scrollWidth,cw:э.clientWidth,sh:э.scrollHeight,ch:э.clientHeight});});
  const ul=document.querySelector(".dsk-qs");
  const ti=document.querySelector(".dsk-title");
  return {нет:false, win:R(win), frame:fr?R(fr):null,
    frameScroll: fr?{sh:fr.scrollHeight,ch:fr.clientHeight,ov:getComputedStyle(fr).overflow}:null,
    список: ul?{r:R(ul),sh:ul.scrollHeight,ch:ul.clientHeight,n:ul.children.length}:null,
    заголовок: ti?{t:ti.textContent,r:R(ti),sw:ti.scrollWidth,cw:ti.clientWidth}:null,
    кн, vw:innerWidth, vh:innerHeight,
    on: document.querySelector(".rc-desk").classList.contains("dsk-on")};
});
лог("ПУЛЬТ:", д);
if (!д.нет) {
  const [x,y,w,h]=д.frame||д.win;
  д.кн.forEach(k=>{
    if (k.r[1]+k.r[3] > y+h+1) лог("   КНОПКА НИЖЕ РАМКИ на", Math.round(k.r[1]+k.r[3]-(y+h)), "px:", k.к, k.t);
    if (k.r[0] < x-1 || k.r[0]+k.r[2] > x+w+1) лог("   КНОПКА ВЫЛЕЗЛА ВБОК:", k.к, k.t, k.r);
    if (k.sw-k.cw>1) лог("   ТЕКСТ КНОПКИ ОБРЕЗАН вбок", k.sw-k.cw, k.t);
    if (k.sh-k.ch>1) лог("   ТЕКСТ КНОПКИ ОБРЕЗАН вниз", k.sh-k.ch, k.t);
  });
  if (д.список && д.список.sh - д.список.ch > 1) лог("   СПИСОК ВОПРОСОВ ПРОКРУЧИВАЕТСЯ:", д.список.sh, "/", д.список.ch);
}
try{await pg.screenshot({path:`${КАД}/пульт-${тег}.jpeg`,type:"jpeg",quality:72,timeout:200000});лог("кадр пульта снят");}catch(e){лог("НЕТ КАДРА пульта");}
// открыть ответ на первый вопрос
await pg.evaluate(()=>{const q=document.querySelector(".dsk-q"); if(q) q.click();});
await pg.waitForTimeout(2500);
const отв = await pg.evaluate(()=>{const a=document.querySelector(".dsk-a"), fr=document.querySelector(".dsk-frame");
  const R=(э)=>{const r=э.getBoundingClientRect();return [+r.left.toFixed(1),+r.top.toFixed(1),+r.width.toFixed(1),+r.height.toFixed(1)];};
  return a?{r:R(a),sh:a.scrollHeight,ch:a.clientHeight,t:(a.textContent||"").slice(0,60),рамка:fr?R(fr):null}:null;});
лог("ОТВЕТ:", отв);
try{await pg.screenshot({path:`${КАД}/пульт-ответ-${тег}.jpeg`,type:"jpeg",quality:72,timeout:200000});лог("кадр ответа снят");}catch(e){лог("НЕТ КАДРА ответа");}
writeFileSync(`/home/user/OKO-TEAM/rocketcdn/tools/audit/окна/пульт-${тег}.json`, JSON.stringify({д,отв},null,1));
лог("ГОТОВО-ПУЛЬТ " + тег);
await b.close();
