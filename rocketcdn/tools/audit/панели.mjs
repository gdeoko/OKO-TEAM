/* Аудит всплывающих панелей игры.
   Запуск: node tools/audit/панели.mjs <экран> <язык>          */
import { АДРЕС, ЭКРАНЫ, браузер, страница, проём, обрезки, наложения } from "./общее.mjs";
import { writeFileSync, mkdirSync } from "node:fs";

const ЭКР = process.argv[2] || "ПК";
const ЯЗ  = process.argv[3] || "ru";
const э   = ЭКРАНЫ[ЭКР];
const КАД = "/home/user/OKO-TEAM/rocketcdn/tools/audit/окна/кадры";
mkdirSync(КАД, { recursive: true });
const тег = ЭКР + "-" + ЯЗ;
const отчёт = { экран: ЭКР, яз: ЯЗ, vp: э.vp, панели: {}, беды: [] };

import { appendFileSync } from "node:fs";
const ЛОГ = "/home/user/OKO-TEAM/rocketcdn/tools/audit/окна/ход-" + тег + ".txt";
function лог(...a) { const s = a.map(x=>typeof x==="string"?x:JSON.stringify(x)).join(" "); try{appendFileSync(ЛОГ, s+"\n");}catch(e){} console.log(s); }

/* Полный замер поддерева панели */
const ЗАМЕР = `(корень) => {
  const R = document.querySelector(корень);
  if (!R) return { нет: true };
  const cs = getComputedStyle(R);
  const rr = R.getBoundingClientRect();
  const вид = cs.display!=="none" && cs.visibility!=="hidden" && +cs.opacity>=0.06;
  const узлы = [];
  const все = [R, ...R.querySelectorAll("*")];
  все.forEach(э => {
    const s = getComputedStyle(э);
    if (s.display==="none"||s.visibility==="hidden"||+s.opacity<0.06) return;
    const r = э.getBoundingClientRect();
    if (r.width<3||r.height<3) return;
    const свой = [...э.childNodes].some(n=>n.nodeType===3&&n.textContent.trim());
    узлы.push({
      кл: (э.className||"").toString().split(" ").slice(0,3).join("."),
      тег: э.tagName,
      св: свой,
      t: (э.textContent||"").replace(/\\s+/g," ").trim().slice(0,44),
      r: [+r.left.toFixed(1), +r.top.toFixed(1), +r.width.toFixed(1), +r.height.toFixed(1)],
      sw: э.scrollWidth, cw: э.clientWidth, sh: э.scrollHeight, ch: э.clientHeight,
      ov: s.overflowX + "/" + s.overflowY,
      fs: parseFloat(s.fontSize), lh: s.lineHeight,
      ws: s.whiteSpace, to: s.textOverflow
    });
  });
  return { вид, r:[+rr.left.toFixed(1),+rr.top.toFixed(1),+rr.width.toFixed(1),+rr.height.toFixed(1)],
           sh: R.scrollHeight, ch: R.clientHeight, узлы,
           vw: innerWidth, vh: innerHeight };
}`;

async function померить(pg, имя, корень, файл) {
  const t9=Date.now();
  const d = await pg.evaluate(eval(ЗАМЕР), корень);
  лог("   замер " + имя + " за " + ((Date.now()-t9)/1000).toFixed(1) + "с");
  if (d.нет) { отчёт.панели[имя] = { нет: true }; return null; }
  const w = await проём(pg);
  const беды = [];
  const [x,y,ww,hh] = d.r;
  // за экран
  if (x < -1) беды.push(`ПАНЕЛЬ УХОДИТ ВЛЕВО за экран на ${Math.round(-x)}px`);
  if (x+ww > d.vw+1) беды.push(`ПАНЕЛЬ УХОДИТ ВПРАВО за экран на ${Math.round(x+ww-d.vw)}px`);
  if (y < -1) беды.push(`ПАНЕЛЬ УХОДИТ ВВЕРХ за экран на ${Math.round(-y)}px`);
  if (y+hh > d.vh+1) беды.push(`ПАНЕЛЬ УХОДИТ ВНИЗ за экран на ${Math.round(y+hh-d.vh)}px`);
  // за проём
  if (w) {
    const л = w.л - x, п = (x+ww) - w.п, в = w.в - y, н = (y+hh) - w.н;
    if (л>2) беды.push(`за проём ВЛЕВО на ${Math.round(л)}px`);
    if (п>2) беды.push(`за проём ВПРАВО на ${Math.round(п)}px`);
    if (в>2) беды.push(`за проём ВВЕРХ на ${Math.round(в)}px`);
    if (н>2) беды.push(`за проём ВНИЗ на ${Math.round(н)}px`);
  }
  // внутренние обрезания
  d.узлы.forEach(u => {
    const бок = u.sw - u.cw, низ = u.sh - u.ch;
    const режет = !/visible/.test(u.ov);
    if (режет && u.св && (бок>1)) беды.push(`ОБРЕЗАНО ВБОК ${бок}px: ${u.кл||u.тег} «${u.t}»`);
    if (режет && u.св && (низ>1)) беды.push(`ОБРЕЗАНО ВНИЗ ${низ}px: ${u.кл||u.тег} «${u.t}»`);
    // узел вылез из панели
    if (u.r[0] < x-1 || u.r[0]+u.r[2] > x+ww+1)
      беды.push(`ВЫЛЕЗ ИЗ ПАНЕЛИ вбок: ${u.кл||u.тег} «${u.t}» [${u.r}] панель [${d.r}]`);
    if (u.r[1]+u.r[3] > y+hh+1)
      беды.push(`ВЫЛЕЗ ИЗ ПАНЕЛИ вниз на ${Math.round(u.r[1]+u.r[3]-(y+hh))}px: ${u.кл||u.тег} «${u.t}»`);
    // за экран
    if (u.r[1]+u.r[3] > d.vh+1 || u.r[1] < -1)
      беды.push(`УЗЕЛ ЗА ЭКРАНОМ по вертикали: ${u.кл||u.тег} «${u.t}» [${u.r}] vh=${d.vh}`);
  });
  отчёт.панели[имя] = { r: d.r, sh: d.sh, ch: d.ch, vw: d.vw, vh: d.vh, проём: w, беды, узлы: d.узлы };
  if (файл && process.env.RC_SHOT !== "0") { const t0=Date.now(); try { await pg.screenshot({ path: `${КАД}/${файл}.jpeg`, type:"jpeg", quality:70 }); } catch(e){ лог("кадр не вышел: "+e.message.slice(0,60)); } лог("   кадр " + файл + " за " + ((Date.now()-t0)/1000).toFixed(1) + "с"); }
  лог(`\n=== ${имя} [${тег}] r=${JSON.stringify(d.r)} прокрутка ${d.sh}/${d.ch}`);
  if (!беды.length) лог("   чисто");
  [...new Set(беды)].forEach(б => лог("   " + б));
  try { писать(); } catch(e) {}
  return d;
}

/* ── Ход ──────────────────────────────────────────────────── */
const b = await браузер();
const pg0 = await b.newPage({ viewport: э.vp, deviceScaleFactor: э.dpr, isMobile: э.mob, hasTouch: э.mob });
await pg0.addInitScript((l) => { try { localStorage.setItem("rc_lang", l); } catch(e){} }, ЯЗ);
const беды = [];
pg0.on("pageerror", e => беды.push("JS: " + e.message.slice(0,140)));
await pg0.goto(АДРЕС, { waitUntil: "domcontentloaded", timeout: 180000 });
await pg0.waitForTimeout(11000);
const pg = pg0;
лог("язык html:", await pg.evaluate(()=>document.documentElement.lang));

/* --- вход в игру --- */
const вошли = await pg.evaluate(() => { if (window.RC_FLIGHT&&window.RC_FLIGHT.open){window.RC_FLIGHT.open();return true;} const k=document.querySelector(".js-flight"); if(k){k.click();return true;} return false; });
лог("вошли:", вошли);
await pg.waitForTimeout(15000);

/* брифинг ДО закрытия */
await померить(pg, "брифинг", ".rcf-brief-card", `брифинг-${тег}`);
await pg.evaluate(()=>{const b=document.querySelector(".rcf-brief-btns button[data-mode='manual']")||document.querySelector(".rcf-brief-btns button");if(b)b.click();const br=document.querySelector(".rcf-brief");if(br)br.classList.add("off");});
await pg.waitForTimeout(2500);

/* HUD: задание и список узлов */
await померить(pg, "задание", ".rcf-mis", null);
const естьКлюч = await pg.evaluate(()=>{const k=document.querySelector(".rcf-map-key");
  if(!k) return "нет узла";
  const s=getComputedStyle(k); if(s.display==="none"||s.visibility==="hidden") return "СПРЯТАН";
  k.click(); return "нажал";});
лог("клавиша СЕТЬ:", естьКлюч);
if (естьКлюч === "СПРЯТАН") await pg.evaluate(()=>{const n=document.querySelector(".rcf-netlist"); if(n) n.classList.add("on");});
await pg.waitForTimeout(1800);
await померить(pg, "список-узлов", ".rcf-netlist", `хад-${тег}`);

/* --- меню целей --- */
await pg.evaluate(()=>{const k=document.querySelector(".rcf-navkey");if(k)k.click();});
await pg.waitForTimeout(2500);
await померить(pg, "меню", ".rcf-menu", `меню-${тег}`);
const мк = await pg.evaluate(()=>{
  const из=[];
  document.querySelectorAll(".rcf-menu .rcf-nav button").forEach(э=>{const r=э.getBoundingClientRect();const s=getComputedStyle(э);
    из.push({t:(э.textContent||"").replace(/\s+/g," ").trim(),r:[+r.left.toFixed(1),+r.top.toFixed(1),+r.width.toFixed(1),+r.height.toFixed(1)],
      sw:э.scrollWidth,cw:э.clientWidth,sh:э.scrollHeight,ch:э.clientHeight,fs:parseFloat(s.fontSize),ov:s.overflowX+"/"+s.overflowY});});
  const у=[];
  document.querySelectorAll(".rcf-menu .rcf-uni button").forEach(э=>{const r=э.getBoundingClientRect();
    у.push({t:(э.textContent||"").replace(/\s+/g," ").trim().slice(0,50),r:[+r.left.toFixed(1),+r.top.toFixed(1),+r.width.toFixed(1),+r.height.toFixed(1)],
      sw:э.scrollWidth,cw:э.clientWidth,sh:э.scrollHeight,ch:э.clientHeight});});
  const m=document.querySelector(".rcf-menu");
  return {nav:из, uni:у, меню:{sh:m.scrollHeight,ch:m.clientHeight,st:m.scrollTop}};
});
отчёт.панели["меню-кнопки"]=мк;
лог("nav кнопок:", мк.nav.length, "uni:", мк.uni.length, "прокрутка меню:", мк.меню.sh+"/"+мк.меню.ch);
// разброс размеров
if (мк.nav.length) {
  const ш=мк.nav.map(k=>k.r[2]), в=мк.nav.map(k=>k.r[3]);
  лог("nav ширина", Math.min(...ш).toFixed(1), "..", Math.max(...ш).toFixed(1), " высота", Math.min(...в).toFixed(1), "..", Math.max(...в).toFixed(1));
  мк.nav.forEach(k=>{ if(k.sw-k.cw>1) лог("   КНОПКА ОБРЕЗАЕТ ТЕКСТ вбок", k.sw-k.cw, "«"+k.t+"»");
                      if(k.sh-k.ch>1) лог("   КНОПКА ОБРЕЗАЕТ ТЕКСТ вниз", k.sh-k.ch, "«"+k.t+"»"); });
}
// докрутить меню вниз
const прок = await pg.evaluate(()=>{const m=document.querySelector(".rcf-menu");m.scrollTop=m.scrollHeight;return {st:m.scrollTop,sh:m.scrollHeight,ch:m.clientHeight};});
лог("докрутка меню:", JSON.stringify(прок));
await pg.waitForTimeout(1500);
if (process.env.RC_SHOT!=="0") await pg.screenshot({path:`${КАД}/меню-низ-${тег}.jpeg`,type:"jpeg",quality:70});
await померить(pg, "меню-докручено", ".rcf-menu", null);
await pg.evaluate(()=>{const m=document.querySelector(".rcf-menu");m.scrollTop=0;const k=document.querySelector(".rcf-navkey");if(k)k.click();});
await pg.waitForTimeout(1500);

/* --- справка --- */
await pg.evaluate(()=>{const k=document.querySelector(".rcf-help-key");if(k)k.click();});
await pg.waitForTimeout(2500);
await померить(pg, "справка", ".rcf-help-in", `справка-${тег}`);
const сп = await pg.evaluate(()=>{
  const in_=document.querySelector(".rcf-help-in");
  const x=document.querySelector(".rcf-help-x"); const rx=x?x.getBoundingClientRect():null;
  const li=[]; document.querySelectorAll(".rcf-help-in li").forEach(э=>{const r=э.getBoundingClientRect();
    li.push({t:(э.textContent||"").replace(/\s+/g," ").trim().slice(0,60),r:[+r.left.toFixed(1),+r.top.toFixed(1),+r.width.toFixed(1),+r.height.toFixed(1)]});});
  return {крестик:rx?{r:[+rx.left.toFixed(1),+rx.top.toFixed(1),+rx.width.toFixed(1),+rx.height.toFixed(1)]}:null,
          строк:li.length, li, коробка: in_?{sh:in_.scrollHeight,ch:in_.clientHeight}:null, vh:innerHeight};
});
отчёт.панели["справка-детали"]=сп;
лог("справка: строк", сп.строк, "крестик", JSON.stringify(сп.крестик), "коробка", JSON.stringify(сп.коробка));
сп.li.forEach(l=>{ if(l.r[1]+l.r[3]>сп.vh+1) лог("   СТРОКА НИЖЕ ЭКРАНА:", l.t, JSON.stringify(l.r)); });
// докрутить справку
const прок2 = await pg.evaluate(()=>{const m=document.querySelector(".rcf-help-in");if(!m)return null;m.scrollTop=m.scrollHeight;return {st:m.scrollTop,sh:m.scrollHeight,ch:m.clientHeight};});
лог("докрутка справки:", JSON.stringify(прок2));
await pg.waitForTimeout(1200);
if (process.env.RC_SHOT!=="0") await pg.screenshot({path:`${КАД}/справка-низ-${тег}.jpeg`,type:"jpeg",quality:70});
await pg.evaluate(()=>{const x=document.querySelector(".rcf-help-x");if(x)x.click();});
await pg.waitForTimeout(1500);

/* --- досье --- */
const тела = ["АСТЕРОИДНЫЙ","ASTEROID","КОМЕТА","COMET","ЗЕМЛЯ","EARTH","САТУРН","SATURN","ЮПИТЕР","JUPITER","МЕРКУРИЙ","MERCURY"];
let сделано = 0;
for (const т of тела) {
  if (сделано >= 4) break;
  const имя = await pg.evaluate((n)=>window.RC_FLIGHT._dos(n), т);
  if (!имя) continue;
  сделано++;
  await pg.waitForTimeout(2500);
  await померить(pg, "досье-"+имя, ".rcf-dos-in", `досье-${имя.replace(/[^A-Za-zА-Яа-я0-9]/g,"")}-${тег}`);
  const дх = await pg.evaluate(()=>{
    const x=document.querySelector(".rcf-dos-x"); const r=x?x.getBoundingClientRect():null;
    const h=document.querySelector(".rcf-dos-h"); const rh=h?h.getBoundingClientRect():null;
    const in_=document.querySelector(".rcf-dos-in");
    return {крестик:r?[+r.left.toFixed(1),+r.top.toFixed(1),+r.width.toFixed(1),+r.height.toFixed(1)]:null,
            заголовок:rh?{t:h.textContent,r:[+rh.left.toFixed(1),+rh.top.toFixed(1),+rh.width.toFixed(1),+rh.height.toFixed(1)],sw:h.scrollWidth,cw:h.clientWidth,sh:h.scrollHeight,ch:h.clientHeight}:null,
            коробка:in_?{sh:in_.scrollHeight,ch:in_.clientHeight}:null};
  });
  отчёт.панели["досье-"+имя+"-детали"]=дх;
  лог("   крестик:", JSON.stringify(дх.крестик), " заголовок:", JSON.stringify(дх.заголовок), " коробка:", JSON.stringify(дх.коробка));
  await pg.evaluate(()=>{const x=document.querySelector(".rcf-dos-x");if(x)x.click();});
  await pg.waitForTimeout(1200);
}

/* наложения панелей с надписями кадра */
await pg.evaluate(()=>{const k=document.querySelector(".rcf-navkey");if(k)k.click();});
await pg.waitForTimeout(2000);
const нал = await наложения(pg, [".rcf-menu",".rcf-mis",".rcf-netlist",".rcf-hint",".rcf-info",".rcf-deck",".rcf-keys",".rcf-goal",".rcf-toast",".rcf-fail"], []);
отчёт.наложения = нал;
лог("НАЛОЖЕНИЯ при открытом меню:", JSON.stringify(нал));

отчёт.беды = беды;
писать();
function писать(){ writeFileSync(`/home/user/OKO-TEAM/rocketcdn/tools/audit/окна/панели-${тег}.json`, JSON.stringify(отчёт,null,1)); }
лог("JS-беды:", JSON.stringify(беды.slice(0,6)));
await b.close();
лог("ГОТОВО " + тег);
