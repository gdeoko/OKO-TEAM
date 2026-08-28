/* Кадры панелей. Снимок в этой песочнице идёт десятки секунд,
   поэтому выдержка на снимок - три минуты. */
import { АДРЕС, ЭКРАНЫ, браузер } from "./общее.mjs";
import { appendFileSync, mkdirSync } from "node:fs";
const ЯЗ = process.argv[2] || "ru";
const СПИСОК = (process.argv[3] || "телефон,ПК").split(",");
const ДОМ = "/home/user/OKO-TEAM/rocketcdn/tools/audit/окна";
const КАД = ДОМ + "/кадры"; mkdirSync(КАД, { recursive: true });
const ЛОГ = ДОМ + "/снимки-" + ЯЗ + ".txt";
function лог(...a){const s=a.map(x=>typeof x==="string"?x:JSON.stringify(x)).join(" ");try{appendFileSync(ЛОГ,s+"\n");}catch(e){}console.log(s);}

const b = await браузер();
const pg = await b.newPage({ viewport:{width:1280,height:800}, deviceScaleFactor:1, hasTouch:true });
pg.setDefaultTimeout(200000);
await pg.addInitScript((l)=>{try{localStorage.setItem("rc_lang",l);}catch(e){}}, ЯЗ);
await pg.addInitScript(() => {
  let ждём=false, очередь=[];
  window.requestAnimationFrame = function (cb) { очередь.push(cb);
    if (!ждём) { ждём=true; setTimeout(()=>{ждём=false;const q=очередь;очередь=[];const t=performance.now();q.forEach(f=>{try{f(t)}catch(e){}});},300); }
    return 1; };
  window.cancelAnimationFrame = function(){};
});
await pg.goto(АДРЕС, { waitUntil:"domcontentloaded", timeout:300000 });
await pg.waitForTimeout(12000);
await pg.evaluate(()=>{ if(window.RC_FLIGHT) window.RC_FLIGHT.open(); });
await pg.waitForTimeout(16000);
лог("в игре:", JSON.stringify(await pg.evaluate(()=>window.RC_FLIGHT&&window.RC_FLIGHT.state().открыт)));

async function снять(имя){
  const t=Date.now();
  try { await pg.screenshot({ path:`${КАД}/${имя}.jpeg`, type:"jpeg", quality:72, timeout:200000 });
        лог("кадр", имя, ((Date.now()-t)/1000).toFixed(1)+"с"); }
  catch(e){ лог("НЕТ КАДРА", имя, e.message.slice(0,70)); }
}

for (const э of СПИСОК) {
  const s = ЭКРАНЫ[э]; if (!s) continue;
  const тег = э+"-"+ЯЗ;
  лог("### экран", э, JSON.stringify(s.vp));
  await pg.setViewportSize(s.vp);
  await pg.waitForTimeout(7000);

  await pg.evaluate(()=>{const br=document.querySelector(".rcf-brief"); if(br) br.classList.remove("off");});
  await pg.waitForTimeout(2500); await снять("к-брифинг-"+тег);
  await pg.evaluate(()=>{const br=document.querySelector(".rcf-brief"); if(br) br.classList.add("off");});
  await pg.waitForTimeout(1500);

  await pg.evaluate(()=>{const k=document.querySelector(".rcf-map-key"); if(k) k.click(); const n=document.querySelector(".rcf-netlist"); if(n) n.classList.add("on");});
  await pg.waitForTimeout(2500); await снять("к-хад-"+тег);
  await pg.evaluate(()=>{const n=document.querySelector(".rcf-netlist"); if(n) n.classList.remove("on");});

  await pg.evaluate(()=>{const m=document.querySelector(".rcf-menu"); m.classList.add("on"); m.scrollTop=0;});
  await pg.waitForTimeout(2500); await снять("к-меню-верх-"+тег);
  await pg.evaluate(()=>{const m=document.querySelector(".rcf-menu"); m.scrollTop=m.scrollHeight;});
  await pg.waitForTimeout(2000); await снять("к-меню-низ-"+тег);
  await pg.evaluate(()=>{const m=document.querySelector(".rcf-menu"); m.scrollTop=0; m.classList.remove("on");});
  await pg.waitForTimeout(1500);

  await pg.evaluate(()=>{document.querySelector(".rcf-help").classList.add("on");});
  await pg.waitForTimeout(2500); await снять("к-справка-верх-"+тег);
  const кр1 = await pg.evaluate(()=>{const m=document.querySelector(".rcf-help-in"); m.scrollTop=m.scrollHeight;
    const x=document.querySelector(".rcf-help-x").getBoundingClientRect();
    const p=m.getBoundingClientRect();
    return {крестик:[+x.left.toFixed(1),+x.top.toFixed(1),+x.width.toFixed(1),+x.height.toFixed(1)],
            панель:[+p.left.toFixed(1),+p.top.toFixed(1),+p.width.toFixed(1),+p.height.toFixed(1)],
            прокрутка:Math.round(m.scrollTop)};});
  await pg.waitForTimeout(2000);
  лог("справка прокручена донизу, крестик:", JSON.stringify(кр1));
  if (кр1.крестик[1] + кр1.крестик[3] < кр1.панель[1]) лог("!!! КРЕСТИК СПРАВКИ УЕХАЛ ВВЕРХ ЗА ПАНЕЛЬ при прокрутке");
  await снять("к-справка-низ-"+тег);
  await pg.evaluate(()=>{const m=document.querySelector(".rcf-help-in"); m.scrollTop=0; document.querySelector(".rcf-help").classList.remove("on");});
  await pg.waitForTimeout(1500);

  for (const т of (ЯЗ==="en"?["ASTEROID","EARTH"]:["АСТЕРОИДНЫЙ","ЗЕМЛЯ"])) {
    const н = await pg.evaluate((n)=>window.RC_FLIGHT._dos(n), т).catch(()=>null);
    if (!н) { лог("досье", т, "нет"); continue; }
    await pg.waitForTimeout(2500);
    await снять("к-досье-"+н.replace(/[^A-Za-zА-Яа-я0-9]/g,"")+"-"+тег);
    const кр2 = await pg.evaluate(()=>{const m=document.querySelector(".rcf-dos-in"); m.scrollTop=m.scrollHeight;
      const x=document.querySelector(".rcf-dos-x").getBoundingClientRect(); const p=m.getBoundingClientRect();
      return {крестик:[+x.left.toFixed(1),+x.top.toFixed(1),+x.width.toFixed(1),+x.height.toFixed(1)],
              панель:[+p.left.toFixed(1),+p.top.toFixed(1),+p.width.toFixed(1),+p.height.toFixed(1)],
              прокрутка:Math.round(m.scrollTop), sh:m.scrollHeight, ch:m.clientHeight};});
    лог("досье", н, "прокручено:", JSON.stringify(кр2));
    if (кр2.прокрутка > 2 && кр2.крестик[1] + кр2.крестик[3] < кр2.панель[1]) лог("!!! КРЕСТИК ДОСЬЕ УЕХАЛ ЗА ПАНЕЛЬ при прокрутке");
    await pg.waitForTimeout(1500);
    if (кр2.прокрутка > 2) await снять("к-досье-низ-"+н.replace(/[^A-Za-zА-Яа-я0-9]/g,"")+"-"+тег);
    await pg.evaluate(()=>{const x=document.querySelector(".rcf-dos-x"); if(x) x.click();});
    await pg.waitForTimeout(1500);
  }
}
лог("ГОТОВО-СНИМКИ " + ЯЗ);
await b.close();
