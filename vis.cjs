const http=require('http'),fs=require('fs'),path=require('path'),pp=require('puppeteer-core');
const ROOT=path.join(__dirname,'dist');
const M={'.html':'text/html','.js':'text/javascript','.css':'text/css','.glb':'model/gltf-binary','.wasm':'application/wasm','.svg':'image/svg+xml'};
const s=http.createServer((q,r)=>{let p=decodeURIComponent(q.url.split('?')[0]);if(p==='/')p='/index.html';const f=path.join(ROOT,p);if(!fs.existsSync(f)){r.writeHead(404);r.end();return;}r.writeHead(200,{'Content-Type':M[path.extname(f)]||'application/octet-stream'});fs.createReadStream(f).pipe(r);});
(async()=>{await new Promise(r=>s.listen(8065,r));
const b=await pp.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome',headless:'shell',args:['--no-sandbox','--enable-unsafe-swiftshader','--ignore-gpu-blocklist','--disable-background-timer-throttling','--disable-backgrounding-occluded-windows','--disable-renderer-backgrounding']});
const pg=await b.newPage(); await pg.setViewport({width:412,height:915,deviceScaleFactor:2,isMobile:true,hasTouch:true});
const errs=[]; pg.on('pageerror',e=>errs.push(e.message));
await pg.goto('http://localhost:8065/?fast',{waitUntil:'domcontentloaded'});
await pg.evaluate(()=>{(function l(){requestAnimationFrame(l);})();});
await new Promise(r=>setTimeout(r,7000));
await pg.evaluate(()=>window.__setScroll(0.99)); await new Promise(r=>setTimeout(r,2500));
await pg.screenshot({path:'/tmp/v_before.png'});
await pg.evaluate(()=>window.__openBrain());
for(let i=0;i<25;i++){await new Promise(r=>setTimeout(r,250));if((await pg.evaluate(()=>+window.__tbDbg))>0.95)break;}
await pg.screenshot({path:'/tmp/v_tunnel.png'});
await pg.evaluate(()=>window.__closeBrain());
// mid-exit (tb~0.4)
for(let i=0;i<40;i++){await new Promise(r=>setTimeout(r,150));if((await pg.evaluate(()=>+window.__tbDbg))<0.45)break;}
await pg.screenshot({path:'/tmp/v_mid.png'});
for(let i=0;i<40;i++){await new Promise(r=>setTimeout(r,200));if((await pg.evaluate(()=>+window.__tbDbg))<0.02)break;}
await new Promise(r=>setTimeout(r,1500));
await pg.screenshot({path:'/tmp/v_after.png'});
fs.writeFileSync(path.join(__dirname,'_v.txt'),'errs='+(errs.join('|')||'none'));
await new Promise(r=>setTimeout(r,200)); await b.close(); s.close();
})().catch(e=>{fs.writeFileSync(path.join(__dirname,'_v.txt'),'FATAL '+e.message);});
