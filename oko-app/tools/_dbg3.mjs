import { chromium } from 'playwright-core';
import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path';
const ROOT = path.resolve('oko-app/prototype');
const MIME={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json','.png':'image/png','.svg':'image/svg+xml','.glb':'model/gltf-binary','.webp':'image/webp'};
const server=http.createServer((rq,rs)=>{const rel=decodeURIComponent((rq.url||'/').split('?')[0]);const f=path.join(ROOT, rel==='/'?'/index.html':rel);fs.stat(f,(e,st)=>{if(e||!st.isFile()){rs.writeHead(404).end('404');return;}rs.writeHead(200,{'Content-Type':MIME[path.extname(f).toLowerCase()]||'application/octet-stream','Content-Length':st.size});fs.createReadStream(f).pipe(rs);});});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const PORT=server.address().port;
const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome',args:['--no-sandbox']});
const c=await b.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true,serviceWorkers:'block'});
await c.addInitScript(`window.okoSkipAuth=function(){try{localStorage.setItem('oko-auth','tg');}catch(e){}var a=document.getElementById('authScreen');if(a){a.classList.add('hidden');a.style.display='none';}var s=document.getElementById('splash');if(s){s.classList.add('gone');s.style.display='none';}var o=document.getElementById('onboard');if(o){o.classList.add('hidden');o.style.display='none';}};try{localStorage.setItem('oko-onboard-done','1');localStorage.setItem('oko-stories-seen','1');localStorage.setItem('oko-tour-done','1');localStorage.setItem('oko-tour','1');}catch(e){}`);
const p=await c.newPage();
const cdp = await c.newCDPSession(p);
await cdp.send('DOM.enable'); await cdp.send('CSS.enable');
await p.goto(`http://127.0.0.1:${PORT}/index.html`,{waitUntil:'commit'});
await p.waitForFunction(()=>document.readyState!=='loading'&&typeof window.openMa==='function'&&!!window.okoAi);
await p.waitForTimeout(900);
await p.evaluate(`okoSkipAuth(); showTab('chats');`); await p.waitForTimeout(500);
await p.evaluate(`document.querySelector('#chatList .chat-item').click();`); await p.waitForTimeout(700);
await p.fill('#msgInput','x'); await p.waitForTimeout(300);
const {root} = await cdp.send('DOM.getDocument',{depth:-1});
const {nodeId} = await cdp.send('DOM.querySelector',{nodeId:root.nodeId, selector:'#msgInput'});
const m = await cdp.send('CSS.getMatchedStylesForNode',{nodeId});
for (const r of (m.matchedCSSRules||[])) {
  const txt = (r.rule.style.cssProperties||[]).filter(x=>/border.*radius/i.test(x.name));
  if (txt.length) console.log(r.rule.selectorList.text, '=>', txt.map(x=>x.name+':'+x.value).join(';'), '| origin', r.rule.origin, '| sheet', (r.rule.styleSheetId||''));
}
await b.close(); await new Promise(r=>server.close(r));
