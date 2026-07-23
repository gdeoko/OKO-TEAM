// Красивая иллюстрированная обложка МЕТАНОЙА (эталон бренда): FLUX-фон + заголовок Playfair + лого + мягкий зум-интро.
// usage: node cover_ill.mjs <configJson>   config: {wd, rubric, title(html с <b>), accent}
import { chromium } from 'playwright';
import { execSync } from 'child_process';
import fs from 'fs';
const cfg=JSON.parse(fs.readFileSync(process.argv[2],'utf8'));
const WD=cfg.wd;
const F="/home/user/OKO-TEAM/.claude/skills/reels-machine/fonts";
const b64=p=>fs.readFileSync(p).toString('base64');
const SG=b64(`${F}/SoyuzGrotesk-Bold.ttf`), M7=b64(`${F}/montserrat-v31-cyrillic_latin-700.ttf`), PF=b64(`${F}/PlayfairDisplay-Bold.ttf`);
const bg=b64(`${WD}/work/cover_base.png`);
const logo=b64("/home/user/OKO-TEAM/brand/metanoia/png/metanoia-logo-1024.png");
const ACC=cfg.accent||"#C99A54", CREAM="#FBF6EE", DARK="#3A2A1C";
const HTML=`<!DOCTYPE html><html><head><meta charset="utf-8"><style>
@font-face{font-family:'SG';src:url(data:font/ttf;base64,${SG})}@font-face{font-family:'M7';src:url(data:font/ttf;base64,${M7})}@font-face{font-family:'PF';src:url(data:font/ttf;base64,${PF})}
*{margin:0;padding:0;box-sizing:border-box}html,body{width:1080px;height:1920px;overflow:hidden}
#bg{position:absolute;inset:0;background:url(data:image/png;base64,${bg}) center/cover}
#top{position:absolute;top:120px;left:0;width:1080px;display:flex;justify-content:center}
#rub{font-family:'M7';font-size:36px;letter-spacing:6px;color:${DARK};background:rgba(251,246,238,.82);padding:14px 40px;border-radius:40px;box-shadow:0 8px 24px rgba(58,42,28,.18)}
#shade{position:absolute;left:0;bottom:0;width:1080px;height:900px;background:linear-gradient(180deg,transparent 0%,rgba(251,246,238,.0) 30%,rgba(251,246,238,.72) 62%,rgba(251,246,238,.96) 100%)}
#mid{position:absolute;bottom:360px;left:70px;width:940px;text-align:center}
#ttl{font-family:'PF';font-size:92px;line-height:1.08;color:${DARK};text-shadow:0 2px 18px rgba(251,246,238,.6)}
#ttl b{color:${ACC}}
#bar{width:170px;height:10px;background:${ACC};border-radius:8px;margin:30px auto 0}
#foot{position:absolute;bottom:170px;left:0;width:1080px;display:flex;flex-direction:column;align-items:center;gap:12px}
#lg{width:118px;filter:drop-shadow(0 6px 18px rgba(58,42,28,.25))}
#nm{font-family:'M7';font-size:36px;letter-spacing:6px;color:${DARK}}
</style></head><body>
<div id="bg"></div><div id="shade"></div>
<div id="top"><div id="rub">${cfg.rubric}</div></div>
<div id="mid"><div id="ttl">${cfg.title}</div><div id="bar"></div></div>
<div id="foot"><img id="lg" src="data:image/png;base64,${logo}"><div id="nm">МЕТАНОЙА</div></div>
</body></html>`;
const browser=await chromium.launch({executablePath:'/opt/pw-browsers/chromium',args:['--no-sandbox','--force-color-profile=srgb']});
const page=await browser.newPage({viewport:{width:1080,height:1920},deviceScaleFactor:1});
await page.setContent(HTML);
await page.screenshot({path:`${WD}/work/cover.jpg`,type:'jpeg',quality:93});
await browser.close();
// мягкий зум-интро 2.2с (ken burns) на обложке
execSync(`ffmpeg -v error -y -loop 1 -i ${WD}/work/cover.jpg -t 2.2 -r 30 -vf "scale=4320:7680,zoompan=z='1.0+0.06*on/66':d=66:x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':s=1080x1920:fps=30,format=yuv420p" -c:v libx264 -preset medium -crf 19 ${WD}/work/intro.mp4`);
console.log('ILL COVER+INTRO DONE:', WD);
