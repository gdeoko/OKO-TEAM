/* Экран вопросов на пульте: доводим сцену до подъезда напрямую,
   прокрутка в песочнице упирается в затвор и дальше не идёт. */
import { АДРЕС, ЭКРАНЫ, браузер } from "./общее.mjs";
import { writeFileSync, appendFileSync, mkdirSync } from "node:fs";
const ЭКР = process.argv[2] || "ПК", ЯЗ = process.argv[3] || "ru";
const э = ЭКРАНЫ[ЭКР], тег = ЭКР + "-" + ЯЗ;
const ДОМ = "/home/user/OKO-TEAM/rocketcdn/tools/audit/окна", КАД = ДОМ + "/кадры";
mkdirSync(КАД, { recursive: true });
const ЛОГ = ДОМ + "/пульт2-" + тег + ".txt";
function лог(...a){const s=a.map(x=>typeof x==="string"?x:JSON.stringify(x)).join(" ");try{appendFileSync(ЛОГ,s+"\n");}catch(e){}console.log(s);}

const b = await браузер();
const pg = await b.newPage({ viewport: э.vp, deviceScaleFactor: э.dpr, isMobile: э.mob, hasTouch: э.mob });
pg.setDefaultTimeout(200000);
await pg.addInitScript((l)=>{try{localStorage.setItem("rc_lang",l);}catch(e){}}, ЯЗ);
await pg.addInitScript(() => {
  let ждём=false, очередь=[];
  window.requestAnimationFrame = function (cb) { очередь.push(cb);
    if (!ждём) { ждём=true; setTimeout(()=>{ждём=false;const q=очередь;очередь=[];const t=performance.now();q.forEach(f=>{try{f(t)}catch(e){}});},200); }
    return 1; };
  window.cancelAnimationFrame = function(){};
});
await pg.goto(АДРЕС, { waitUntil:"domcontentloaded", timeout:300000 });
await pg.waitForTimeout(12000);
лог("язык:", await pg.evaluate(()=>document.documentElement.lang));
/* Прокрутка шагами, сколько дадут */
let пр=-1;
for (let i=0;i<40;i++){ const y = await pg.evaluate(()=>{scrollBy(0, innerHeight*0.7); return Math.round(scrollY);});
  if (y===пр) break; пр=y; await pg.waitForTimeout(400); }
лог("прокрутка встала на", пр);
/* Подводим камеру к пульту напрямую */
await pg.evaluate(()=>{ try{ if(window.RC_FLIGHT&&window.RC_FLIGHT.stage) window.RC_FLIGHT.stage(0.95); }catch(e){}
  try{ const I=window.RC_INTERIOR; if(I){ I.con=()=>1; I.back=()=>0.8; } }catch(e){} });
await pg.waitForTimeout(9000);
const ст = await pg.evaluate(()=>{const l=document.querySelector(".rc-desk");
  return {есть:!!l, on:l?l.classList.contains("dsk-on"):false, состояние:l?l.getAttribute("data-state"):null};});
лог("слой пульта:", ст);
if (!ст.есть) { лог("ПУЛЬТ ТАК И НЕ ПОЯВИЛСЯ"); await b.close(); process.exit(0); }
await pg.waitForTimeout(3000);
const д = await pg.evaluate(()=>{
  const R=(э)=>{const r=э.getBoundingClientRect();return [+r.left.toFixed(1),+r.top.toFixed(1),+r.width.toFixed(1),+r.height.toFixed(1)];};
  const win=document.querySelector(".dsk-win"), fr=document.querySelector(".dsk-frame");
  if(!win) return {нет:true};
  const кн=[]; document.querySelectorAll(".dsk-q,.dsk-b").forEach(э=>кн.push({к:э.className,
    t:(э.textContent||"").replace(/\s+/g," ").trim().slice(0,46), r:R(э),
    sw:э.scrollWidth,cw:э.clientWidth,sh:э.scrollHeight,ch:э.clientHeight,
    fs:parseFloat(getComputedStyle(э).fontSize)}));
  const ul=document.querySelector(".dsk-qs"), ti=document.querySelector(".dsk-title");
  return {win:R(win), frame:fr?R(fr):null,
    рамкаПрокрутка: fr?{sh:fr.scrollHeight,ch:fr.clientHeight,ov:getComputedStyle(fr).overflow}:null,
    список: ul?{r:R(ul),sh:ul.scrollHeight,ch:ul.clientHeight,n:ul.children.length,маска:getComputedStyle(ul).maskImage.slice(0,50)}:null,
    заголовок: ti?{t:ti.textContent,r:R(ti),fs:parseFloat(getComputedStyle(ti).fontSize),ls:getComputedStyle(ti).letterSpacing,tt:getComputedStyle(ti).textTransform,sw:ti.scrollWidth,cw:ti.clientWidth}:null,
    кн, vw:innerWidth, vh:innerHeight, on:document.querySelector(".rc-desk").classList.contains("dsk-on")};
});
лог("ПУЛЬТ:", д);
if (!д.нет && д.frame) { const [x,y,w,h]=д.frame;
  д.кн.forEach(k=>{
    if (k.r[1]+k.r[3] > y+h+1) лог("  ! КНОПКА НИЖЕ РАМКИ на", Math.round(k.r[1]+k.r[3]-(y+h)), "px:", k.к, k.t);
    if (k.r[0] < x-1 || k.r[0]+k.r[2] > x+w+1) лог("  ! КНОПКА ВЫЛЕЗЛА ВБОК:", k.к, k.t, JSON.stringify(k.r));
    if (k.sw-k.cw>1) лог("  ! ТЕКСТ КНОПКИ ОБРЕЗАН вбок", k.sw-k.cw, k.t);
    if (k.sh-k.ch>1) лог("  ! ТЕКСТ КНОПКИ ОБРЕЗАН вниз", k.sh-k.ch, k.t); });
  if (д.список && д.список.sh-д.список.ch>1) лог("  ! СПИСОК ВОПРОСОВ ПРОКРУЧИВАЕТСЯ", д.список.sh+"/"+д.список.ch);
  лог("  вопросов в списке:", д.список?д.список.n:0);
}
try{ await pg.screenshot({path:`${КАД}/п2-меню-${тег}.jpeg`,type:"jpeg",quality:72,timeout:200000}); лог("кадр меню пульта снят"); }catch(e){ лог("НЕТ КАДРА меню"); }
await pg.evaluate(()=>{const q=document.querySelector(".dsk-q"); if(q) q.click();});
await pg.waitForTimeout(3000);
const отв = await pg.evaluate(()=>{
  const R=(э)=>{const r=э.getBoundingClientRect();return [+r.left.toFixed(1),+r.top.toFixed(1),+r.width.toFixed(1),+r.height.toFixed(1)];};
  const a=document.querySelector(".dsk-a"), ti=document.querySelector(".dsk-title"), bk=document.querySelector(".dsk-back"), fr=document.querySelector(".dsk-frame");
  return {ответ:a?{r:R(a),sh:a.scrollHeight,ch:a.clientHeight,t:(a.textContent||"").slice(0,70)}:null,
          заголовок:ti?{t:ti.textContent,r:R(ti),fs:parseFloat(getComputedStyle(ti).fontSize),ls:getComputedStyle(ti).letterSpacing,tt:getComputedStyle(ti).textTransform,sh:ti.scrollHeight,ch:ti.clientHeight}:null,
          назад:bk?R(bk):null, рамка:fr?R(fr):null};});
лог("ОТВЕТ:", отв);
if (отв.ответ && отв.рамка && отв.ответ.r[1]+отв.ответ.r[3] > отв.рамка[1]+отв.рамка[3]+1)
  лог("  ! ТЕКСТ ОТВЕТА ВЫХОДИТ ЗА РАМКУ на", Math.round(отв.ответ.r[1]+отв.ответ.r[3]-отв.рамка[1]-отв.рамка[3]), "px");
if (отв.ответ && отв.ответ.sh-отв.ответ.ch>1) лог("  ! ОТВЕТ ПРОКРУЧИВАЕТСЯ", отв.ответ.sh+"/"+отв.ответ.ch);
try{ await pg.screenshot({path:`${КАД}/п2-ответ-${тег}.jpeg`,type:"jpeg",quality:72,timeout:200000}); лог("кадр ответа снят"); }catch(e){ лог("НЕТ КАДРА ответа"); }
writeFileSync(`${ДОМ}/пульт2-${тег}.json`, JSON.stringify({д,отв},null,1));
лог("ГОТОВО-ПУЛЬТ2 " + тег);
await b.close();
