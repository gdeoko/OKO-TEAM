/* Все восемь экранов в ОДНОЙ вкладке: мир строится один раз,
   дальше только смена размера окна. Среда перегружена, каждая
   новая загрузка стоит минут. */
import { АДРЕС, ЭКРАНЫ, браузер, проём } from "./общее.mjs";
import { writeFileSync, appendFileSync, mkdirSync } from "node:fs";

const ЯЗ = process.argv[2] || "ru";
const СПИСОК = (process.argv[3] || "телефон,узкий,планшет,четыре,ноутбук,ПК,широкий,лежачий").split(",");
const ДОМ = "/home/user/OKO-TEAM/rocketcdn/tools/audit/окна";
const КАД = ДОМ + "/кадры";
mkdirSync(КАД, { recursive: true });
const ЛОГ = ДОМ + "/все-" + ЯЗ + ".txt";
const ШОТ = process.env.RC_SHOT !== "0";
function лог(...a){const s=a.map(x=>typeof x==="string"?x:JSON.stringify(x)).join(" ");try{appendFileSync(ЛОГ,s+"\n");}catch(e){}console.log(s);}
const отчёт = {};
function писать(){ try{writeFileSync(ДОМ+"/все-"+ЯЗ+".json", JSON.stringify(отчёт,null,1));}catch(e){} }

const ЗАМЕР = (корень) => {
  const R = document.querySelector(корень);
  if (!R) return { нет: true };
  const cs = getComputedStyle(R);
  const rr = R.getBoundingClientRect();
  const вид = cs.display!=="none" && cs.visibility!=="hidden" && +cs.opacity>=0.06;
  const узлы = [];
  [R, ...R.querySelectorAll("*")].forEach(э => {
    const s = getComputedStyle(э);
    if (s.display==="none"||s.visibility==="hidden"||+s.opacity<0.06) return;
    const r = э.getBoundingClientRect();
    if (r.width<3||r.height<3) return;
    узлы.push({ кл:(э.className||"").toString().split(" ").slice(0,3).join("."), тег:э.tagName,
      св:[...э.childNodes].some(n=>n.nodeType===3&&n.textContent.trim()),
      t:(э.textContent||"").replace(/\s+/g," ").trim().slice(0,50),
      r:[+r.left.toFixed(1),+r.top.toFixed(1),+r.width.toFixed(1),+r.height.toFixed(1)],
      sw:э.scrollWidth,cw:э.clientWidth,sh:э.scrollHeight,ch:э.clientHeight,
      ov:s.overflowX+"/"+s.overflowY, fs:parseFloat(s.fontSize), ws:s.whiteSpace });
  });
  return { вид, r:[+rr.left.toFixed(1),+rr.top.toFixed(1),+rr.width.toFixed(1),+rr.height.toFixed(1)],
           sh:R.scrollHeight, ch:R.clientHeight, узлы, vw:innerWidth, vh:innerHeight };
};

async function померить(pg, ключ, имя, корень, файл) {
  let d; const t0=Date.now();
  try { d = await pg.evaluate(ЗАМЕР, корень); } catch(e){ лог("  замер сорвался:", e.message.slice(0,60)); return null; }
  if (d.нет) { лог(`  [${имя}] узла нет`); return null; }
  const w = await проём(pg).catch(()=>null);
  const беды = [];
  const [x,y,ww,hh] = d.r;
  if (!d.вид) беды.push("ПАНЕЛЬ НЕ ВИДНА");
  if (x < -1) беды.push(`за экран ВЛЕВО ${Math.round(-x)}px`);
  if (x+ww > d.vw+1) беды.push(`за экран ВПРАВО ${Math.round(x+ww-d.vw)}px`);
  if (y < -1) беды.push(`за экран ВВЕРХ ${Math.round(-y)}px`);
  if (y+hh > d.vh+1) беды.push(`за экран ВНИЗ ${Math.round(y+hh-d.vh)}px`);
  if (w) {
    const л=w.л-x, п=(x+ww)-w.п, в=w.в-y, н=(y+hh)-w.н;
    if (л>2) беды.push(`за проём ВЛЕВО ${Math.round(л)}px`);
    if (п>2) беды.push(`за проём ВПРАВО ${Math.round(п)}px`);
    if (в>2) беды.push(`за проём ВВЕРХ ${Math.round(в)}px`);
    if (н>2) беды.push(`за проём ВНИЗ ${Math.round(н)}px`);
  }
  d.узлы.forEach(u => {
    const бок=u.sw-u.cw, низ=u.sh-u.ch, режет=!/visible/.test(u.ov);
    if (режет && u.св && бок>1) беды.push(`ТЕКСТ ОБРЕЗАН вбок ${бок}px: ${u.кл||u.тег} «${u.t}»`);
    if (режет && u.св && низ>1) беды.push(`ТЕКСТ ОБРЕЗАН вниз ${низ}px: ${u.кл||u.тег} «${u.t}»`);
    if (u.r[0] < x-1) беды.push(`ВЫЛЕЗ ВЛЕВО ${Math.round(x-u.r[0])}px: ${u.кл||u.тег} «${u.t}»`);
    if (u.r[0]+u.r[2] > x+ww+1) беды.push(`ВЫЛЕЗ ВПРАВО ${Math.round(u.r[0]+u.r[2]-x-ww)}px: ${u.кл||u.тег} «${u.t}»`);
    if (u.r[1]+u.r[3] > d.vh+1) беды.push(`НИЖЕ ЭКРАНА ${Math.round(u.r[1]+u.r[3]-d.vh)}px: ${u.кл||u.тег} «${u.t}»`);
    if (u.r[1] < -1) беды.push(`ВЫШЕ ЭКРАНА: ${u.кл||u.тег} «${u.t}»`);
  });
  отчёт[ключ] = отчёт[ключ] || {};
  отчёт[ключ][имя] = { r:d.r, вид:d.вид, sh:d.sh, ch:d.ch, vw:d.vw, vh:d.vh, проём:w, беды:[...new Set(беды)], узлы:d.узлы };
  лог(`  [${имя}] r=${JSON.stringify(d.r)} экран ${d.vw}x${d.vh} прокрутка ${d.sh}/${d.ch} (${((Date.now()-t0)/1000).toFixed(1)}с)`);
  [...new Set(беды)].forEach(б=>лог("     ! "+б));
  if (файл && ШОТ) { const t=Date.now(); try{ await pg.screenshot({path:`${КАД}/${файл}.jpeg`,type:"jpeg",quality:68}); лог("     кадр "+файл+" "+((Date.now()-t)/1000).toFixed(1)+"с"); }catch(e){лог("     кадра нет");} }
  писать();
  return d;
}

const b = await браузер();
const pg = await b.newPage({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1, hasTouch: true });
await pg.addInitScript((l)=>{try{localStorage.setItem("rc_lang",l);}catch(e){}}, ЯЗ);
const жсбеды=[]; pg.on("pageerror", e=>жсбеды.push(e.message.slice(0,120)));
await pg.goto(АДРЕС, { waitUntil:"domcontentloaded", timeout:300000 });
await pg.waitForTimeout(12000);
лог("язык:", await pg.evaluate(()=>document.documentElement.lang));
await pg.evaluate(()=>{ if(window.RC_FLIGHT) window.RC_FLIGHT.open(); });
await pg.waitForTimeout(16000);
лог("в игре:", JSON.stringify(await pg.evaluate(()=>window.RC_FLIGHT&&window.RC_FLIGHT.state().открыт)));

for (const имя of СПИСОК) {
  const э = ЭКРАНЫ[имя]; if (!э) continue;
  лог(`\n########## ЭКРАН ${имя} ${э.vp.width}x${э.vp.height} [${ЯЗ}] ##########`);
  await pg.setViewportSize(э.vp);
  await pg.waitForTimeout(6000);
  const тег = имя + "-" + ЯЗ;

  /* брифинг: вернуть его на экран */
  await pg.evaluate(()=>{const br=document.querySelector(".rcf-brief"); if(br) br.classList.remove("off");});
  await pg.waitForTimeout(2500);
  await померить(pg, имя, "брифинг", ".rcf-brief-card", "брифинг-"+тег);
  await pg.evaluate(()=>{const br=document.querySelector(".rcf-brief"); if(br) br.classList.add("off");});
  await pg.waitForTimeout(1500);

  /* задание */
  await померить(pg, имя, "задание", ".rcf-mis", null);

  /* список узлов */
  const кл = await pg.evaluate(()=>{const k=document.querySelector(".rcf-map-key");
    if(!k) return "узла нет"; const s=getComputedStyle(k);
    if(s.display==="none"||s.visibility==="hidden") return "КЛАВИША СЕТЬ СПРЯТАНА";
    if(!document.querySelector(".rcf-netlist").classList.contains("on")) k.click();
    return "нажал";});
  лог("  клавиша СЕТЬ:", кл);
  if (кл !== "нажал") await pg.evaluate(()=>{const n=document.querySelector(".rcf-netlist"); if(n) n.classList.add("on");});
  await pg.waitForTimeout(2000);
  await померить(pg, имя, "список-узлов", ".rcf-netlist", "узлы-"+тег);
  await pg.evaluate(()=>{const n=document.querySelector(".rcf-netlist"); if(n) n.classList.remove("on");});

  /* меню целей */
  await pg.evaluate(()=>{const m=document.querySelector(".rcf-menu"); if(m) m.classList.add("on");});
  await pg.waitForTimeout(2500);
  await померить(pg, имя, "меню", ".rcf-menu", "меню-"+тег);
  const мк = await pg.evaluate(()=>{
    const R=(э)=>{const r=э.getBoundingClientRect();return [+r.left.toFixed(1),+r.top.toFixed(1),+r.width.toFixed(1),+r.height.toFixed(1)];};
    const нав=[],уни=[],заг=[];
    document.querySelectorAll(".rcf-menu .rcf-nav button").forEach(э=>нав.push({t:(э.textContent||"").trim(),r:R(э),sw:э.scrollWidth,cw:э.clientWidth,sh:э.scrollHeight,ch:э.clientHeight,fs:parseFloat(getComputedStyle(э).fontSize)}));
    document.querySelectorAll(".rcf-menu .rcf-uni button").forEach(э=>уни.push({t:(э.textContent||"").replace(/\s+/g," ").trim().slice(0,60),r:R(э),sw:э.scrollWidth,cw:э.clientWidth,sh:э.scrollHeight,ch:э.clientHeight}));
    document.querySelectorAll(".rcf-menu-h span").forEach(э=>заг.push({t:(э.textContent||"").trim(),r:R(э),sw:э.scrollWidth,cw:э.clientWidth,ov:getComputedStyle(э).overflow,to:getComputedStyle(э).textOverflow}));
    const m=document.querySelector(".rcf-menu");
    return {нав,уни,заг,меню:{sh:m.scrollHeight,ch:m.clientHeight,маска:getComputedStyle(m).maskImage.slice(0,60)}};
  });
  отчёт[имя]["меню-кнопки"]=мк;
  if (мк.нав.length){
    const ш=мк.нав.map(k=>k.r[2]), в=мк.нав.map(k=>k.r[3]);
    лог(`  кнопки целей: ${мк.нав.length} шт, ширина ${Math.min(...ш)}..${Math.max(...ш)}, высота ${Math.min(...в)}..${Math.max(...в)}, кегль ${мк.нав[0].fs}`);
    if (Math.max(...в)-Math.min(...в) > 1) лог(`     ! КНОПКИ РАЗНОЙ ВЫСОТЫ: ${Math.min(...в)} против ${Math.max(...в)} — ${мк.нав.filter(k=>k.r[3]===Math.max(...в)).map(k=>k.t).join(", ")}`);
    if (Math.max(...ш)-Math.min(...ш) > 1) лог(`     ! КНОПКИ РАЗНОЙ ШИРИНЫ: ${Math.min(...ш)}..${Math.max(...ш)}`);
    мк.нав.forEach(k=>{ if(k.sw-k.cw>1) лог(`     ! текст в кнопке обрезан вбок ${k.sw-k.cw}px «${k.t}»`);
                        if(k.sh-k.ch>1) лог(`     ! текст в кнопке обрезан вниз ${k.sh-k.ch}px «${k.t}»`); });
  }
  мк.уни.forEach(k=>{ if(k.sw-k.cw>1) лог(`     ! рукав обрезан вбок ${k.sw-k.cw}px «${k.t}»`);
                      if(k.sh-k.ch>1) лог(`     ! рукав обрезан вниз ${k.sh-k.ch}px «${k.t}»`); });
  мк.заг.forEach(z=>{ if(z.sw-z.cw>1) лог(`     ! подзаголовок обрезан ${z.sw-z.cw}px «${z.t}» (${z.ov}/${z.to})`); });
  лог("  меню прокрутка:", мк.меню.sh+"/"+мк.меню.ch, "маска:", мк.меню.маска);
  const пр = await pg.evaluate(()=>{const m=document.querySelector(".rcf-menu"); m.scrollTop=m.scrollHeight;
    return {st:Math.round(m.scrollTop), sh:m.scrollHeight, ch:m.clientHeight};});
  лог("  докрутили меню:", JSON.stringify(пр));
  await pg.waitForTimeout(1500);
  if (ШОТ) { try{await pg.screenshot({path:`${КАД}/меню-низ-${тег}.jpeg`,type:"jpeg",quality:68});}catch(e){} }
  const хвост = await pg.evaluate(()=>{const m=document.querySelector(".rcf-menu");
    const R=(э)=>{const r=э.getBoundingClientRect();return [+r.left.toFixed(1),+r.top.toFixed(1),+r.width.toFixed(1),+r.height.toFixed(1)];};
    const мр=m.getBoundingClientRect(); const из=[];
    m.querySelectorAll(".rcf-uni button, .rcf-nav button").forEach(э=>{const r=э.getBoundingClientRect();
      if (r.bottom > мр.bottom-30) из.push({t:(э.textContent||"").replace(/\s+/g," ").trim().slice(0,30), r:R(э), низМеню:+мр.bottom.toFixed(1)});});
    return из;});
  отчёт[имя]["меню-хвост"]=хвост;
  лог("  последние строки у нижней кромки:", JSON.stringify(хвост));
  await pg.evaluate(()=>{const m=document.querySelector(".rcf-menu"); m.scrollTop=0; m.classList.remove("on");});
  await pg.waitForTimeout(1200);

  /* справка */
  await pg.evaluate(()=>{const h=document.querySelector(".rcf-help"); if(h) h.classList.add("on");});
  await pg.waitForTimeout(2500);
  await померить(pg, имя, "справка", ".rcf-help-in", "справка-"+тег);
  const сп = await pg.evaluate(()=>{
    const R=(э)=>{const r=э.getBoundingClientRect();return [+r.left.toFixed(1),+r.top.toFixed(1),+r.width.toFixed(1),+r.height.toFixed(1)];};
    const x=document.querySelector(".rcf-help-x"), in_=document.querySelector(".rcf-help-in");
    const b_=in_?in_.querySelector("b"):null;
    const li=[]; document.querySelectorAll(".rcf-help-in li").forEach(э=>li.push({t:(э.textContent||"").replace(/\s+/g," ").trim().slice(0,52),r:R(э)}));
    return {крестик:x?R(x):null, заголовок:b_?R(b_):null, li, коробка:in_?{sh:in_.scrollHeight,ch:in_.clientHeight,маска:getComputedStyle(in_).maskImage.slice(0,60)}:null, vh:innerHeight};
  });
  отчёт[имя]["справка-детали"]=сп;
  if (сп.крестик){
    const [cx,cy,cw,ch]=сп.крестик;
    лог(`  крестик справки ${cw}x${ch}`);
    if (Math.abs(cw-ch)>1) лог(`     ! КРЕСТИК НЕ КВАДРАТНЫЙ ${cw}x${ch}`);
    if (cw<32||ch<32) лог(`     ! КРЕСТИК МЕЛКИЙ ДЛЯ ПАЛЬЦА ${cw}x${ch} (надо 32+)`);
    if (сп.заголовок && cx < сп.заголовок[0]+сп.заголовок[2]+2 && cy < сп.заголовок[1]+сп.заголовок[3] && cy+ch > сп.заголовок[1])
      лог(`     ! КРЕСТИК НАЕЗЖАЕТ НА ЗАГОЛОВОК: крестик ${JSON.stringify(сп.крестик)} заголовок ${JSON.stringify(сп.заголовок)}`);
  }
  лог(`  справка: строк ${сп.li.length}, коробка ${сп.коробка.sh}/${сп.коробка.ch}, маска ${сп.коробка.маска}`);
  сп.li.forEach(l=>{ if(l.r[1]+l.r[3]>сп.vh+1) лог(`     ! строка ниже экрана: «${l.t}»`); });
  const пр2 = await pg.evaluate(()=>{const m=document.querySelector(".rcf-help-in"); m.scrollTop=m.scrollHeight;
    return {st:Math.round(m.scrollTop),sh:m.scrollHeight,ch:m.clientHeight};});
  лог("  докрутили справку:", JSON.stringify(пр2));
  await pg.waitForTimeout(1200);
  if (ШОТ) { try{await pg.screenshot({path:`${КАД}/справка-низ-${тег}.jpeg`,type:"jpeg",quality:68});}catch(e){} }
  await pg.evaluate(()=>{const m=document.querySelector(".rcf-help-in"); m.scrollTop=0; document.querySelector(".rcf-help").classList.remove("on");});
  await pg.waitForTimeout(1200);

  /* досье */
  const тела = ЯЗ==="en" ? ["ASTEROID","COMET","EARTH","SATURN"] : ["АСТЕРОИДНЫЙ","КОМЕТА","ЗЕМЛЯ","САТУРН"];
  for (const т of тела) {
    const н = await pg.evaluate((n)=>window.RC_FLIGHT._dos(n), т).catch(()=>null);
    if (!н) { лог("  досье", т, "не открылось"); continue; }
    await pg.waitForTimeout(2200);
    await померить(pg, имя, "досье:"+н, ".rcf-dos-in", "досье-"+н.replace(/[^A-Za-zА-Яа-я0-9]/g,"")+"-"+тег);
    const дх = await pg.evaluate(()=>{
      const R=(э)=>{const r=э.getBoundingClientRect();return [+r.left.toFixed(1),+r.top.toFixed(1),+r.width.toFixed(1),+r.height.toFixed(1)];};
      const x=document.querySelector(".rcf-dos-x"), h=document.querySelector(".rcf-dos-h"),
            in_=document.querySelector(".rcf-dos-in"), p=document.querySelector(".rcf-dos-p"),
            f=document.querySelector(".rcf-dos-facts"), m=document.querySelector(".rcf-dos-map");
      return {крестик:x?R(x):null, заголовок:h?{t:h.textContent,r:R(h),sw:h.scrollWidth,cw:h.clientWidth,sh:h.scrollHeight,ch:h.clientHeight}:null,
              абзац:p?{r:R(p),sh:p.scrollHeight,ch:p.clientHeight}:null,
              факты:f?{r:R(f),sh:f.scrollHeight,ch:f.clientHeight,n:f.children.length}:null,
              карта:m?R(m):null,
              коробка:in_?{sh:in_.scrollHeight,ch:in_.clientHeight,ov:getComputedStyle(in_).overflowY}:null};
    });
    отчёт[имя]["досье:"+н+"-детали"]=дх;
    if (дх.крестик){const [cx,cy,cw,ch]=дх.крестик;
      лог(`  крестик досье ${cw}x${ch}`);
      if (Math.abs(cw-ch)>1) лог(`     ! КРЕСТИК ДОСЬЕ НЕ КВАДРАТНЫЙ ${cw}x${ch}`);
      if (cw<32||ch<32) лог(`     ! КРЕСТИК ДОСЬЕ МЕЛКИЙ ${cw}x${ch}`);
      if (дх.заголовок){const [hx,hy,hw,hh2]=дх.заголовок.r;
        if (cx < hx+hw+1 && cy < hy+hh2 && cy+ch > hy) лог(`     ! КРЕСТИК НА ЗАГОЛОВКЕ ДОСЬЕ «${дх.заголовок.t}»`);}}
    if (дх.заголовок && дх.заголовок.sw-дх.заголовок.cw>1) лог(`     ! ЗАГОЛОВОК ДОСЬЕ ОБРЕЗАН ${дх.заголовок.sw-дх.заголовок.cw}px «${дх.заголовок.t}»`);
    if (дх.коробка && дх.коробка.sh-дх.коробка.ch>1) лог(`     ! ДОСЬЕ ПРОКРУЧИВАЕТСЯ ${дх.коробка.sh}/${дх.коробка.ch} (${дх.коробка.ov})`);
    лог("  досье детали:", JSON.stringify(дх));
    await pg.evaluate(()=>{const x=document.querySelector(".rcf-dos-x"); if(x) x.click();});
    await pg.waitForTimeout(1200);
  }
  писать();
}
лог("JS-беды:", JSON.stringify([...new Set(жсбеды)].slice(0,8)));
лог("ГОТОВО-ВСЁ " + ЯЗ);
await b.close();
