import { chromium } from 'playwright';
import { execSync } from 'child_process';
import fs from 'fs';
const WD="/tmp/claude-0/-home-user-OKO-TEAM/f6f2aa4f-e22a-54d1-83e7-29eece9e291a/scratchpad/reel02";
const F="/home/user/OKO-TEAM/.claude/skills/reels-machine/fonts";
const b64=p=>fs.readFileSync(p).toString('base64');
const SG=b64(`${F}/SoyuzGrotesk-Bold.ttf`), M7=b64(`${F}/montserrat-v31-cyrillic_latin-700.ttf`), PF=b64(`${F}/PlayfairDisplay-Bold.ttf`);
const logo=b64(`${WD}/work/logo_t.png`);
const FPS=30, DUR=4.2, frames=Math.round(DUR*FPS);
const NAVY="#1A3A52", GOLD="#D4A574", CREAM="#FAF8F5";
// частицы — детерминированно (без Math.random в рендере: заданы координаты)
let parts=""; const P=26;
for(let i=0;i<P;i++){const x=(i*137)%1080, ph=(i*0.37)%1, sz=3+(i%4);
  parts+=`<div class="pt" style="left:${x}px;--ph:${ph};--sz:${sz}px;--sp:${6+(i%5)}"></div>`;}
const HTML=`<!DOCTYPE html><html><head><meta charset="utf-8"><style>
@font-face{font-family:'SG';src:url(data:font/ttf;base64,${SG})}
@font-face{font-family:'M7';src:url(data:font/ttf;base64,${M7})}
@font-face{font-family:'PF';src:url(data:font/ttf;base64,${PF})}
*{margin:0;padding:0;box-sizing:border-box}
html,body{width:1080px;height:1920px;overflow:hidden}
body{background:radial-gradient(120% 90% at 50% 34%, #24506e 0%, ${NAVY} 42%, #0e2233 100%);font-family:'SG';position:relative}
#beam{position:absolute;top:-260px;left:540px;width:1400px;height:1700px;transform-origin:top center;
 background:conic-gradient(from 180deg at 50% 0%, transparent 0deg, rgba(212,165,116,.00) 6deg, rgba(212,165,116,.16) 11deg, rgba(212,165,116,.28) 13deg, rgba(212,165,116,.10) 15deg, transparent 20deg);
 filter:blur(6px);margin-left:-700px}
#glow{position:absolute;top:520px;left:50%;transform:translateX(-50%);width:760px;height:760px;border-radius:50%;
 background:radial-gradient(circle, rgba(212,165,116,.22), transparent 62%);filter:blur(20px)}
.pt{position:absolute;bottom:-10px;width:var(--sz);height:var(--sz);border-radius:50%;background:rgba(212,165,116,.7);opacity:0}
#wrap{position:absolute;top:0;left:0;width:1080px;height:1920px;display:flex;flex-direction:column;align-items:center;justify-content:center}
#lg{width:210px;height:210px;filter:drop-shadow(0 10px 40px rgba(0,0,0,.5));opacity:0}
#name{font-family:'PF';font-size:112px;color:${GOLD};letter-spacing:4px;margin-top:22px;opacity:0;text-shadow:0 6px 30px rgba(0,0,0,.5)}
#sub{font-family:'M7';font-size:42px;color:${CREAM};letter-spacing:2px;margin-top:6px;opacity:0}
#pill{margin-top:70px;position:relative;overflow:hidden;font-family:'SG';font-size:52px;color:${NAVY};background:${GOLD};
 padding:30px 62px;border-radius:50px;opacity:0;box-shadow:0 14px 44px rgba(0,0,0,.4)}
#pill #shine{position:absolute;top:0;left:-40%;width:40%;height:100%;background:linear-gradient(100deg,transparent,rgba(255,255,255,.55),transparent);transform:skewX(-18deg)}
#hint{font-family:'M7';font-size:36px;color:rgba(250,248,245,.8);margin-top:34px;letter-spacing:1px;opacity:0}
</style></head><body>
<div id="beam"></div><div id="glow"></div>${parts}
<div id="wrap"><img id="lg" src="data:image/png;base64,${logo}"><div id="name">МЕТАНОЙА</div>
<div id="sub">школа для детей · с опорой на веру</div>
<div id="pill"><span>Сохраните на вечер</span><div id="shine"></div></div>
<div id="hint">полный урок — в приложении</div></div>
</body></html>`;
const E=`function eoc(x){return 1-Math.pow(1-x,3)} function eox(x){return x>=1?1:1-Math.pow(2,-10*x)} function eob(x){const c=1.70158,c3=c+1;return 1+c3*Math.pow(x-1,3)+c*Math.pow(x-1,2)} function cl(a,b,x){return Math.max(a,Math.min(b,x))} function seg(t,a,b){return cl(0,1,(t-a)/(b-a))}`;
const R=`function(t){
 document.getElementById('beam').style.transform='rotate('+(-8+6*Math.sin(t*0.7))+'deg)';
 document.getElementById('glow').style.opacity=0.7+0.3*Math.sin(t*1.6);
 var pts=document.querySelectorAll('.pt');
 pts.forEach(function(p){var sp=parseFloat(p.style.getPropertyValue('--sp'));var ph=parseFloat(p.style.getPropertyValue('--ph'));
   var y=((t/sp+ph)%1);p.style.transform='translateY('+(-y*1500)+'px)';p.style.opacity=Math.sin(y*Math.PI)*0.7;});
 var lg=document.getElementById('lg');var p=eob(seg(t,0.1,0.8));lg.style.opacity=seg(t,0.1,0.6);lg.style.transform='scale('+(0.6+0.4*p)+')';
 var nm=document.getElementById('name');nm.style.opacity=seg(t,0.6,1.1);nm.style.transform='translateY('+(1-eoc(seg(t,0.6,1.1)))*30+'px)';
 var sb=document.getElementById('sub');sb.style.opacity=seg(t,0.9,1.4);
 var pl=document.getElementById('pill');var pp=eob(seg(t,1.3,1.8));pl.style.opacity=seg(t,1.3,1.7);pl.style.transform='scale('+(0.8+0.2*pp)+')';
 var sh=document.getElementById('shine');var sc=((t-1.9)/1.3);if(sc>=0&&sc<=1){sh.style.left=(-40+180*sc)+'%';sh.style.opacity=1;}else sh.style.opacity=0;
 var pg=0.5+0.5*Math.sin(t*4);pl.style.boxShadow='0 14px 44px rgba(0,0,0,.4),0 0 '+(pg*34)+'px rgba(212,165,116,.6)';
 document.getElementById('hint').style.opacity=seg(t,1.8,2.3);
}`;
const browser=await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome',args:['--no-sandbox','--force-color-profile=srgb']});
const page=await browser.newPage({viewport:{width:1080,height:1920},deviceScaleFactor:1});
await page.setContent(HTML); await page.addScriptTag({content:`${E}\nwindow.renderT=${R}`});
const fdir=`${WD}/ov/_outro`; fs.mkdirSync(fdir,{recursive:true});
for(let i=0;i<frames;i++){ await page.evaluate(t=>window.renderT(t), i/FPS); await page.screenshot({path:`${fdir}/${String(i).padStart(4,'0')}.png`}); }
execSync(`ffmpeg -v error -y -framerate ${FPS} -i ${fdir}/%04d.png -c:v libx264 -preset medium -crf 18 -pix_fmt yuv420p ${WD}/work/outro2.mp4`);
fs.rmSync(fdir,{recursive:true,force:true});
await browser.close(); console.log('OUTRO DONE', frames+'f');
