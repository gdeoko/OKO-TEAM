/* Карточка ссылки 1200x630. Рисуем браузером: тот же шрифт, тот же
   неон и та же марка, что на сайте, - карточка обязана быть кадром
   сайта, а не отдельной картинкой про него. */
const { chromium } = await import("/tmp/node_modules/playwright/index.mjs");
import { readFileSync } from "node:fs";
const б = await chromium.launch({
  executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome",
  args: ["--no-sandbox"]
});
const pg = await б.newPage({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 1 });
const б64 = (п) => readFileSync(п).toString("base64");
await pg.setContent(`<!doctype html><html><head><meta charset="utf-8"><style>
@font-face{font-family:U;font-weight:900;src:url(data:font/woff2;base64,${б64("assets/fonts/unbounded-cyr-900.woff2")}) format('woff2');unicode-range:U+0301,U+0400-045F,U+0490-0491,U+04B0-04B1,U+2116}
@font-face{font-family:U;font-weight:900;src:url(data:font/woff2;base64,${б64("assets/fonts/unbounded-lat-900.woff2")}) format('woff2');unicode-range:U+0000-00FF}
@font-face{font-family:U;font-weight:700;src:url(data:font/woff2;base64,${б64("assets/fonts/unbounded-cyr-700.woff2")}) format('woff2');unicode-range:U+0301,U+0400-045F,U+0490-0491,U+04B0-04B1,U+2116}
@font-face{font-family:U;font-weight:700;src:url(data:font/woff2;base64,${б64("assets/fonts/unbounded-lat-700.woff2")}) format('woff2');unicode-range:U+0000-00FF}
@font-face{font-family:G;font-weight:400 800;src:url(data:font/woff2;base64,${б64("assets/fonts/golos-cyr.woff2")}) format('woff2')}
*{margin:0;box-sizing:border-box}
body{width:1200px;height:630px;background:#05060C;font-family:G,sans-serif;overflow:hidden;position:relative}
.сеть{position:absolute;inset:0;opacity:.55}
.свет{position:absolute;right:-160px;top:-140px;width:820px;height:820px;border-radius:50%;
  background:radial-gradient(circle,rgba(96,120,216,.55) 0%,rgba(48,72,168,.28) 38%,rgba(5,6,12,0) 70%)}
.тень{position:absolute;inset:0;background:linear-gradient(100deg,rgba(5,6,12,.94) 0%,rgba(5,6,12,.86) 38%,rgba(5,6,12,.3) 62%,rgba(5,6,12,0) 82%)}
.в{position:absolute;inset:0;padding:70px 84px 118px;display:flex;flex-direction:column;justify-content:center;gap:26px}
.марка{display:flex;align-items:center;gap:18px}
.марка img{width:78px;height:78px;display:block}
.слейт{display:flex;align-items:center;gap:16px;font:700 17px/1 U;letter-spacing:.2em;color:#8FA2EC;
  text-shadow:0 0 10px rgba(150,170,255,.9),0 0 28px rgba(96,120,216,.7)}
.слейт s{display:block;width:120px;height:1px;background:linear-gradient(90deg,rgba(96,120,216,.9),rgba(96,120,216,0));text-decoration:none}
h1{font:900 58px/1.14 U;letter-spacing:-.012em;color:#F4F6FF;max-width:16ch;
  text-shadow:0 0 12px rgba(150,170,255,.95),0 0 34px rgba(96,120,216,.75),0 0 78px rgba(48,72,168,.55)}
h1 em{font-style:normal;color:#A8B8FF;
  text-shadow:0 0 10px rgba(190,205,255,.98),0 0 30px rgba(120,145,255,.9),0 0 80px rgba(60,90,220,.8)}
p{font:500 24px/1.5 G;color:rgba(232,234,246,.76);max-width:31ch;padding-left:20px;position:relative}
p::before{content:"";position:absolute;left:0;top:.35em;bottom:.35em;width:3px;border-radius:3px;
  background:linear-gradient(180deg,rgba(96,120,216,.85),rgba(96,120,216,.08))}
.низ{position:absolute;left:84px;bottom:48px;font:700 19px/1 U;letter-spacing:.12em;color:#C6D0F7;
  text-shadow:0 0 12px rgba(150,170,255,.8)}
</style></head><body>
<svg class="сеть" viewBox="0 0 1200 630" preserveAspectRatio="none">${(function(){
  let s="",r=(n)=>{const x=Math.sin(n*127.1)*43758.5;return x-Math.floor(x)};
  const т=[];for(let i=0;i<70;i++)т.push([r(i)*1200,r(i+99)*630]);
  for(let i=0;i<т.length;i++)for(let j=i+1;j<т.length;j++){
    const d=Math.hypot(т[i][0]-т[j][0],т[i][1]-т[j][1]);
    if(d<190)s+=`<line x1="${т[i][0].toFixed(1)}" y1="${т[i][1].toFixed(1)}" x2="${т[j][0].toFixed(1)}" y2="${т[j][1].toFixed(1)}" stroke="rgba(120,145,235,${(0.30*(1-d/190)).toFixed(2)})" stroke-width="1"/>`;}
  for(const[x,y]of т)s+=`<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="2.1" fill="rgba(170,190,255,.65)"/>`;
  return s;})()}</svg>
<div class="свет"></div><div class="тень"></div>
<div class="в">
  <div class="марка"><img src="data:image/webp;base64,${б64("assets/rv-mark.webp")}"></div>
  <div class="слейт">ROCKET VPN<s></s></div>
  <h1>Не в обход. <em>Насквозь</em></h1>
  <p>Канал сквозь белые списки. Без выбора сервера, без счётчика трафика, три дня бесплатно.</p>
</div>
<div class="низ">ROCKETVPN.TOP</div>
</body></html>`, { waitUntil: "load" });
await pg.waitForTimeout(1200);
await pg.screenshot({ path: "assets/rv-og.png" });
await б.close();
console.log("снято");
