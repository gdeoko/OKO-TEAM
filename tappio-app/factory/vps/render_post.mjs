// Render a clean on-brand Tappio image for the proof post (1080x1350, no emoji).
import { chromium } from 'patchright';
const html=`<!doctype html><html><head><meta charset=utf8>
<style>
@import url('https://fonts.googleapis.com/css2?family=Orbitron:wght@600;800&family=Syne:wght@600;800&display=swap');
*{margin:0;box-sizing:border-box}
body{width:1080px;height:1350px;background:radial-gradient(120% 90% at 50% 0%,#0b0e12 0%,#050709 60%);color:#fff;
 display:flex;flex-direction:column;justify-content:center;align-items:center;font-family:Syne,sans-serif;overflow:hidden;position:relative}
.grid{position:absolute;inset:0;background-image:linear-gradient(#12161c 1px,transparent 1px),linear-gradient(90deg,#12161c 1px,transparent 1px);background-size:60px 60px;opacity:.5;mask:radial-gradient(70% 60% at 50% 45%,#000,transparent)}
.dot{position:absolute;width:520px;height:520px;border-radius:50%;filter:blur(80px);opacity:.22}
.d1{background:#00D9FF;top:-120px;left:-120px}.d2{background:#9B5DE5;bottom:-160px;right:-120px}.d3{background:#F4C430;bottom:120px;left:-160px;opacity:.14}
.mark{font-family:Orbitron;font-weight:800;font-size:126px;letter-spacing:10px;background:linear-gradient(90deg,#fff,#cfe9ff);-webkit-background-clip:text;background-clip:text;color:transparent;z-index:2}
.tag{margin-top:26px;font-family:Syne;font-weight:600;font-size:40px;letter-spacing:2px;color:#9fb0bf;z-index:2}
.line{margin-top:60px;width:120px;height:4px;border-radius:4px;background:linear-gradient(90deg,#00D9FF,#9B5DE5,#F4C430);z-index:2}
.soon{margin-top:60px;font-family:Orbitron;font-weight:600;font-size:30px;letter-spacing:14px;color:#e7f6ff;z-index:2}
</style></head><body>
<div class=grid></div><div class="dot d1"></div><div class="dot d2"></div><div class="dot d3"></div>
<div class=mark>TAPPIO</div>
<div class=tag>three tools. one standard.</div>
<div class=line></div>
<div class=soon>COMING&nbsp;SOON</div>
</body></html>`;
const b=await chromium.launch({headless:true,channel:'chromium'});
const pg=await (await b.newContext({viewport:{width:1080,height:1350},deviceScaleFactor:1})).newPage();
await pg.setContent(html,{waitUntil:'networkidle'});
await pg.waitForTimeout(1200);
await pg.screenshot({path:'/opt/oko-poster/cfg/tappio_post.png'});
console.log('rendered /opt/oko-poster/cfg/tappio_post.png');
await b.close();
