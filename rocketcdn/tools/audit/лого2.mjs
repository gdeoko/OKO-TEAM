import { ЭКРАНЫ, браузер, страница, вИгру, проём } from "./общее.mjs";
import fs from "fs";
const СПИСОК = (process.env.RC_SCR || "ПК").split(",");
const К = "/home/user/OKO-TEAM/rocketcdn/tools/audit/кадры/";
const O = "/home/user/OKO-TEAM/rocketcdn/tools/audit/out/";

function вП(x, y, п) { let v=false; for (let i=0,j=п.length-1;i<п.length;j=i++){const xi=п[i][0],yi=п[i][1],xj=п[j][0],yj=п[j][1];
  if (((yi>y)!==(yj>y)) && (x < (xj-xi)*(y-yi)/(yj-yi)+xi)) v=!v;} return v; }
/* Крайняя правая точка контура на строке y */
function праваяНа(y, п, W) { let m=null; for (let x=W-1;x>=0;x-=1) if (вП(x,y,п)) { m=x; break; } return m; }
function нижняяНа(x, п, H) { let m=null; for (let y=H-1;y>=0;y-=1) if (вП(x,y,п)) { m=y; break; } return m; }

const b = await браузер();
for (const имя of СПИСОК) {
  const э = ЭКРАНЫ[имя];
  let pg, беды;
  try { ({ pg, беды } = await страница(b, э)); } catch (e) { console.log(имя, "страница не открылась", e.message.slice(0,80)); continue; }
  const ок = await вИгру(pg);
  await pg.waitForTimeout(4000);
  const w = await проём(pg);
  const д = await pg.evaluate(() => {
    const о = { vw: innerWidth, vh: innerHeight };
    const wrap = document.querySelector(".rc-flight");
    о.классы = wrap ? wrap.className : null;
    if (wrap) { const cw = getComputedStyle(wrap); о.перем = {};
      ["--cab-wx","--cab-wy","--cab-ww","--cab-wh"].forEach(k => о.перем[k]=cw.getPropertyValue(k).trim()); }
    const сн = (c) => { const e = document.querySelector(c); if (!e) return null;
      const s = getComputedStyle(e), r = e.getBoundingClientRect();
      const o2 = { r:[+r.left.toFixed(1),+r.top.toFixed(1),+r.width.toFixed(1),+r.height.toFixed(1)],
        op:s.opacity, disp:s.display, vis:s.visibility, pe:s.pointerEvents, z:s.zIndex,
        right:s.right, bottom:s.bottom, w:s.width, h:s.height, клип: s.clipPath==="none"?"нет":"есть" };
      const im = e.tagName==="IMG"?e:e.querySelector("img");
      if (im) { const ir=im.getBoundingClientRect(), is=getComputedStyle(im);
        o2.img={ src:im.getAttribute("src"), nat:[im.naturalWidth,im.naturalHeight],
          r:[+ir.left.toFixed(1),+ir.top.toFixed(1),+ir.width.toFixed(1),+ir.height.toFixed(1)], fit:is.objectFit }; }
      if (s.clipPath && s.clipPath !== "none") o2.clipRaw = s.clipPath;
      return o2; };
    о.holo=сн(".rcf-holo"); о.vpn=сн(".rc-vpn-projector"); о.deck=сн(".rcf-deck"); о.hud=сн(".rcf-hud");
    const P = window.RC_PANEL && window.RC_PANEL.last;
    if (P) { о.poly=P.poly; о.inner=P.inner; о.safe=P.safe; }
    if (о.holo) { const c=о.holo.r; const t=document.elementFromPoint(c[0]+c[2]/2,c[1]+c[3]/2);
      о.подХоло = t?(t.tagName+"."+(t.className||"").toString().slice(0,40)):null; }
    if (о.vpn) { const c=о.vpn.r; const t=document.elementFromPoint(c[0]+c[2]/2,c[1]+c[3]/2);
      о.подVpn = t?(t.tagName+"."+(t.className||"").toString().slice(0,40)):null; }
    return о; });

  const R = { экран: имя, vp: э.vp, вошли: ок, проём: w, ...д, беды: (беды||[]).slice(0,5) };
  delete R.poly;

  if (д.holo && д.holo.clipRaw) {
    const t = д.holo.clipRaw.match(/-?[\d.]+%/g)||[]; const pts=[];
    for (let i=0;i+1<t.length;i+=2) pts.push([parseFloat(t[i]),parseFloat(t[i+1])]);
    const xs=pts.map(p=>p[0]), ys=pts.map(p=>p[1]);
    const bx={l:Math.min(...xs),r:Math.max(...xs),t:Math.min(...ys),b:Math.max(...ys)};
    const [x,y,ww,hh]=д.holo.r;
    R.клипДоли=bx;
    R.срезКоробки={слева:+(bx.l/100*ww).toFixed(1),справа:+((100-bx.r)/100*ww).toFixed(1),
                   сверху:+(bx.t/100*hh).toFixed(1),снизу:+((100-bx.b)/100*hh).toFixed(1)};
    R.видимаяЧасть={л:+(x+bx.l/100*ww).toFixed(1),п:+(x+bx.r/100*ww).toFixed(1),
                    в:+(y+bx.t/100*hh).toFixed(1),н:+(y+bx.b/100*hh).toFixed(1)};
    if (д.holo.img) { const ir=д.holo.img.r;
      R.срезКартинки={ слева:+Math.max(0,(x+bx.l/100*ww)-ir[0]).toFixed(1),
        справа:+Math.max(0,(ir[0]+ir[2])-(x+bx.r/100*ww)).toFixed(1),
        сверху:+Math.max(0,(y+bx.t/100*hh)-ir[1]).toFixed(1),
        снизу:+Math.max(0,(ir[1]+ir[3])-(y+bx.b/100*hh)).toFixed(1) };
      R.срезДоли={ слева:+(R.срезКартинки.слева/ir[2]*100).toFixed(1)+"%", справа:+(R.срезКартинки.справа/ir[2]*100).toFixed(1)+"%",
        сверху:+(R.срезКартинки.сверху/ir[3]*100).toFixed(1)+"%", снизу:+(R.срезКартинки.снизу/ir[3]*100).toFixed(1)+"%" };
      R.аспект={натур:+(д.holo.img.nat[0]/д.holo.img.nat[1]).toFixed(4),
                картинка:+(ir[2]/ir[3]).toFixed(4), коробка:+(д.holo.r[2]/д.holo.r[3]).toFixed(4)};
    }
  }
  if (w && д.holo) { const [x,y,ww,hh]=д.holo.r; const шп=w.п-w.л, вп=w.н-w.в;
    R.кВписанному={ доПравой:+(w.п-(x+ww)).toFixed(1), доНижней:+(w.н-(y+hh)).toFixed(1),
      правыйДоля:+((w.п-(x+ww))/шп*100).toFixed(2), нижнийДоля:+((w.н-(y+hh))/вп*100).toFixed(2),
      верхДоля:+((y-w.в)/вп*100).toFixed(2), ширинаВпис:+шп.toFixed(1), высотаВпис:+вп.toFixed(1) }; }

  if (д.poly && д.holo) {
    const W=д.vw, H=д.vh;
    const П=д.poly.map(p=>[(1+p[0])/2*W,(1-p[1])/2*H]);
    const xs=П.map(p=>p[0]), ys=П.map(p=>p[1]);
    R.стеклоГабарит={л:+Math.min(...xs).toFixed(1),п:+Math.max(...xs).toFixed(1),в:+Math.min(...ys).toFixed(1),н:+Math.max(...ys).toFixed(1)};
    const [x,y,ww,hh]=д.holo.r;
    const углы=[[x,y],[x+ww,y],[x,y+hh],[x+ww,y+hh]];
    R.углыВСтекле=углы.map(u=>вП(u[0],u[1],П));
    R.наРаме=R.углыВСтекле.some(v=>!v);
    R.стеклоСправаОтЛого = { поВерхуЛого: праваяНа(y+1,П,W), поНизуЛого: праваяНа(y+hh-1,П,W),
                              поЦентруЛого: праваяНа(y+hh/2,П,W) };
    R.стеклоПодЛого = { поЛевомуКраю: нижняяНа(x+1,П,H), поПравомуКраю: нижняяНа(x+ww-1,П,H),
                         поЦентру: нижняяНа(x+ww/2,П,H) };
    const пр = R.стеклоСправаОтЛого.поЦентруЛого, нз = R.стеклоПодЛого.поЦентру;
    if (пр!=null) R.запасСправа=+(пр-(x+ww)).toFixed(1);
    if (нз!=null) R.запасСнизу=+(нз-(y+hh)).toFixed(1);
    const вст=R.стеклоГабарит;
    R.долиВСтекле={ центрПоВысоте:+(((y+hh/2)-вст.в)/(вст.н-вст.в)*100).toFixed(1),
                    верхПоВысоте:+((y-вст.в)/(вст.н-вст.в)*100).toFixed(1) };
    if (д.vpn) { const v=д.vpn.r;
      R.vpnУглыВСтекле=[[v[0],v[1]],[v[0]+v[2],v[1]],[v[0],v[1]+v[3]],[v[0]+v[2],v[1]+v[3]]].map(u=>вП(u[0],u[1],П)); }
  }
  if (д.holo && д.vpn) { const a=д.holo.r, c=д.vpn.r;
    const ш=Math.min(a[0]+a[2],c[0]+c[2])-Math.max(a[0],c[0]);
    const в=Math.min(a[1]+a[3],c[1]+c[3])-Math.max(a[1],c[1]);
    R.vpnПерекрытие=(ш>0&&в>0)?{ш:+ш.toFixed(1),в:+в.toFixed(1)}:"нет";
    R.vpnЗазор=+(a[0]-(c[0]+c[2])).toFixed(1); }

  console.log("### "+имя+" ###\n"+JSON.stringify(R,null,1));
  fs.writeFileSync(O+"лого2-"+имя+".json", JSON.stringify(R,null,1));

  /* Кадры через CDP: playwright ждёт покоя, а сцена рисуется вечно */
  try {
    const cdp = await pg.context().newCDPSession(pg);
    const снимок = async (файл, clip) => {
      const r = await cdp.send("Page.captureScreenshot", { format: "png", captureBeyondViewport: false,
        clip: { x: clip.x, y: clip.y, width: clip.width, height: clip.height, scale: clip.scale || 1 } });
      fs.writeFileSync(К + файл, Buffer.from(r.data, "base64"));
    };
    if (д.holo) { const [x,y,ww,hh]=д.holo.r; const п=30;
      await снимок("холо-"+имя+".png", { x:Math.max(0,x-п), y:Math.max(0,y-п), width:ww+п*2, height:hh+п*2, scale: 3 });
      const vx = д.vpn ? д.vpn.r[0] : x, vy = д.vpn ? д.vpn.r[1] : y;
      const л=Math.max(0,Math.min(x,vx)-30), в=Math.max(0,Math.min(y,vy)-30);
      const пр=Math.max(x+ww, д.vpn?д.vpn.r[0]+д.vpn.r[2]:x+ww)+30, нз=Math.max(y+hh, д.vpn?д.vpn.r[1]+д.vpn.r[3]:y+hh)+30;
      await снимок("пара-"+имя+".png", { x:л, y:в, width:пр-л, height:нз-в, scale: 2 });
    }
    await снимок("общий-"+имя+".png", { x:0, y:0, width:д.vw, height:д.vh, scale: 0.6 });
  } catch (e) { console.log("кадры не вышли:", e.message.slice(0,90)); }
  await pg.close();
}
await b.close();
