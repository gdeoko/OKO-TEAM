/* Лица клавиш: настоящий кегль подписи на экране, шрифт, наложения
   зон нажатия, состояние плиты как DOM-полосы. Плюс поворот экрана. */
import { ЭКРАНЫ, браузер, страница, вИгру } from "./общее.mjs";
import fs from "node:fs";
const ВЫХ = "/home/user/OKO-TEAM/rocketcdn/tools/audit/out/pult";
fs.mkdirSync(ВЫХ, { recursive: true });

const СЕЛ = [".rcf-navkey",".rcf-scan-key",".rcf-deploy",".rcf-help-key",".rcf-auto-key",
             ".rcf-stop-key",".rcf-thr",".rcf-map-key",".rcf-shot",".rcf-zoom-in",".rcf-zoom-out"];

const ЗАМЕР = (СЕЛ) => {
  const дпр = Math.min(2.5, window.devicePixelRatio || 1);
  const cvW = Math.round(innerWidth*дпр), cvH = Math.round(innerHeight*дпр);
  const вид = window.RC_DECK["какой"](innerWidth, innerHeight);
  const meta = window.RC_CAB_FLAT[вид] || window.RC_CAB_FLAT["широкая"];
  const план = window.RC_CAB_DECK[вид] || window.RC_CAB_DECK["широкая"];
  const п = window.RC_DECK["покрытие"](meta, cvW, cvH);
  const точка=(u,v)=>({x:(п.ox+u*п.dw)/дпр, y:(п.oy+v*п.dh)/дпр});
  const ужать=(q,d)=>{const cx=(q[0][0]+q[1][0]+q[2][0]+q[3][0])/4,cy=(q[0][1]+q[1][1]+q[2][1]+q[3][1])/4;
    return q.map(p=>[cx+(p[0]-cx)*(1-d),cy+(p[1]-cy)*(1-d)]);};
  const места=(q,n,z)=>{const o=[];for(let i=0;i<n;i++){const a=i/n,b=(i+1)/n;
    o.push(ужать([[q[0][0]+(q[1][0]-q[0][0])*a,q[0][1]+(q[1][1]-q[0][1])*a],
      [q[0][0]+(q[1][0]-q[0][0])*b,q[0][1]+(q[1][1]-q[0][1])*b],
      [q[3][0]+(q[2][0]-q[3][0])*b,q[3][1]+(q[2][1]-q[3][1])*b],
      [q[3][0]+(q[2][0]-q[3][0])*a,q[3][1]+(q[2][1]-q[3][1])*a]], z==null?0.14:z));}return o;};
  const ниши=[];
  (план["полосы"]||[]).forEach(б=>места(ужать(б["угол"],0.03),б["мест"],б["зазор"]).forEach(кв=>{
    const q=кв.map(p=>точка(p[0],p[1]));
    ниши.push({ш:Math.hypot(q[1].x-q[0].x,q[1].y-q[0].y), в:Math.hypot(q[3].x-q[0].x,q[3].y-q[0].y),
      cx:(q[0].x+q[1].x+q[2].x+q[3].x)/4, cy:(q[0].y+q[1].y+q[2].y+q[3].y)/4});
  }));
  /* самоеТесное — как в rc-deck: минимальная высота ниши в точках CSS */
  const тесное = Math.min(...ниши.map(n=>n.в));
  const тесно = тесное < 46;
  const KEYS = window.RC_KEYS.KEYS, ru = document.documentElement.lang !== "en";
  const c = document.createElement("canvas").getContext("2d");
  const шрифт = (px)=>"700 "+px+"px Montserrat, system-ui, sans-serif";
  /* есть ли Montserrat вообще */
  const есть = (()=>{ try { return document.fonts.check("700 16px Montserrat"); } catch(e){ return "?"; } })();
  const мера = ниши.map((n,i)=>{
    const k = KEYS[i % KEYS.length]; const имя = ru ? k["имя"] : k.en;
    const h = n.в*дпр*1.6, w = n.ш*дпр*1.6, кД = 1.6*дпр;
    let кегль = Math.max(9.5*кД, h*(тесно?0.20:0.145));
    c.font = шрифт(кегль);
    const шир = c.measureText(имя).width, макс = w*0.86;
    if (шир > макс) кегль = кегль*макс/шир;
    const сз = Math.min(w,h)*(тесно?0.40:0.42);
    return { i, имя, нишаШ:+n.ш.toFixed(1), нишаВ:+n.в.toFixed(1),
             кегльЭкран:+(кегль/кД).toFixed(2), значокЭкран:+(сз/(дпр*1.6)).toFixed(1),
             влез: шир<=макс };
  });
  /* зоны нажатия и их пересечения */
  const кор=[];
  СЕЛ.forEach(s=>{const e=document.querySelector(s); if(!e)return;
    const cs=getComputedStyle(e); if(cs.display==="none")return;
    const r=e.getBoundingClientRect();
    кор.push({s,l:r.left,t:r.top,r:r.right,b:r.bottom,w:r.width,h:r.height,
              cx:r.left+r.width/2, cy:r.top+r.height/2,
              имяДоступ:(e.getAttribute("aria-label")||e.getAttribute("title")||
                        (e.innerText||"").trim()||"«ПУСТО»")});
  });
  const пере=[];
  for(let i=0;i<кор.length;i++)for(let j=i+1;j<кор.length;j++){
    const a=кор[i],b=кор[j];
    const ш=Math.min(a.r,b.r)-Math.max(a.l,b.l), в=Math.min(a.b,b.b)-Math.max(a.t,b.t);
    if(ш>0.5&&в>0.5)пере.push({а:a.s,б:b.s,ш:+ш.toFixed(1),в:+в.toFixed(1)});
  }
  /* зона нажатия против своей ниши */
  const промах = кор.map((k,i)=>{
    const n = ниши[СЕЛ.indexOf(k.s)];
    if (!n) return null;
    return { сел:k.s, зона:[+k.w.toFixed(1),+k.h.toFixed(1)], ниша:[+n.ш.toFixed(1),+n.в.toFixed(1)],
             сдвиг:[+(k.cx-n.cx).toFixed(1), +(k.cy-n.cy).toFixed(1)],
             навис:[+((k.w-n.ш)/2).toFixed(1), +((k.h-n.в)/2).toFixed(1)] };
  }).filter(Boolean);
  const лицо = document.querySelector(".rcf-d-face");
  const лс = лицо ? getComputedStyle(лицо) : null;
  const дек = document.querySelector(".rcf-deck");
  const дс = дек ? getComputedStyle(дек) : null;
  return { вид, экран:[innerWidth,innerHeight], дпр, тесное:+тесное.toFixed(1), тесно,
           MontserratЕсть: есть, мера, пере, промах,
           плитаDOM: дек ? { rect:[дек.getBoundingClientRect().left,дек.getBoundingClientRect().top,
                                   дек.getBoundingClientRect().width,дек.getBoundingClientRect().height],
                             фон: дс.backgroundColor, z: дс.zIndex } : null,
           лицоDOM: лицо ? { фонЦвет: лс.backgroundColor,
                             фонКартинка: (лс.backgroundImage||"").slice(0,40),
                             длинаКартинки: (лицо.style.backgroundImage||"").length,
                             transform: лс.transform, тень: лс.boxShadow.slice(0,60),
                             rect:[лицо.getBoundingClientRect().left,лицо.getBoundingClientRect().top,
                                   лицо.getBoundingClientRect().width,лицо.getBoundingClientRect().height] } : null,
           ключевые: кор.map(k=>({с:k.s, имя:k.имяДоступ})) };
};

const b = await браузер();
for (const имя of process.argv.slice(2)) {
  const э = ЭКРАНЫ[имя];
  const { pg } = await страница(b, э);
  await вИгру(pg);
  await pg.waitForTimeout(6000);
  const m = await pg.evaluate(ЗАМЕР, СЕЛ);
  /* поворот: телефон -> лежачий -> обратно */
  await pg.setViewportSize({ width: 900, height: 412 });
  await pg.waitForTimeout(7000);
  const пов = await pg.evaluate(ЗАМЕР, СЕЛ);
  await pg.setViewportSize(э.vp);
  await pg.waitForTimeout(7000);
  const наз = await pg.evaluate(ЗАМЕР, СЕЛ);
  fs.writeFileSync(`${ВЫХ}/лица-${имя}.json`, JSON.stringify({ прямо: m, повёрнут: пов, вернулись: наз }, null, 1));
  console.log(имя, "готово", m.вид, "MontserratЕсть=" + m.MontserratЕсть,
              "кегли=" + m.мера.map(x=>x.кегльЭкран).join(","),
              "пересечений=" + m.пере.length,
              "послеПоворота=" + наз.мера.length);
  await pg.close();
}
await b.close();
