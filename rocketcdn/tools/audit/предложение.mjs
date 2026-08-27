import { рубка } from "./счёт.mjs";
const ЭК = { "телефон":[412,800], "узкий":[360,640], "планшет":[820,1180], "четыре":[1024,768],
             "ноутбук":[1280,720], "ПК":[1440,900], "широкий":[1920,1080], "лежачий":[900,412] };
const clamp=(a,b,c)=>Math.min(Math.max(b,a),c);
function вн(p,x,y){let h=false;for(let i=0,j=p.length-1;i<p.length;j=i++){const xi=p[i][0],yi=p[i][1],xj=p[j][0],yj=p[j][1];
 if((yi>y)!==(yj>y)&&x<(xj-xi)*(y-yi)/(yj-yi)+xi)h=!h;}return h;}
function ок(P,x,y,w,h,m){for(let t=0;t<=w;t+=3){if(!вн(P,x+t,y-m)||!вн(P,x+t,y+h+m))return false;}
 for(let t=0;t<=h;t+=3){if(!вн(P,x-m,y+t)||!вн(P,x+w+m,y+t))return false;}return true;}
const ПРАВ = +(process.env.PRAV || 2.6);   /* % ширины кадра к --cab-wx */
for (const M of [1.5, 2.0, 2.5, 3.0, 4.0]) {
  console.log("\n== низ = 100% - --cab-dy + " + M + "%  ·  право = --cab-wx + " + ПРАВ + "% ==");
  for (const [имя,[W,H]] of Object.entries(ЭК)) {
    const р = рубка(W,H), P = р.P;
    const ш = W <= 760 ? 44 : clamp(0.07*W, 54, 92);
    const прав = (р.доли.wx/100)*W + ПРАВ/100*W;
    const низ = (1 - р.доли.dy/100)*H + M/100*H;
    const x = W - прав - ш, y = H - низ - ш, п = x+ш, н = y+ш;
    const ГВ = р.стекло.н - р.стекло.в;
    const зазор = [4,8,12].map(m => ок(P,x,y,ш,ш,m) ? m : null).filter(Boolean).pop() || 0;
    console.log("%s W=%d H=%d  коробка %d..%d x %d..%d  центр по высоте стекла %s%%  зазор до контура >= %d %s",
      имя.padEnd(9), W, H, Math.round(x), Math.round(п), Math.round(y), Math.round(н),
      (((y+ш/2)-р.стекло.в)/ГВ*100).toFixed(1), зазор, зазор ? "" : "  << ЗАЕЗЖАЕТ НА РАМУ");
  }
}
