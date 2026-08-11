import { chromium } from 'playwright-core';
import http from 'node:http'; import fss from 'node:fs'; import path from 'node:path';
const ROOT = '/home/user/OKO-TEAM/oko-app/prototype';
const MIME={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json','.png':'image/png','.jpg':'image/jpeg','.svg':'image/svg+xml','.glb':'model/gltf-binary','.webp':'image/webp','.woff2':'font/woff2'};
const server=http.createServer((rq,rs)=>{const rel=decodeURIComponent((rq.url||'/').split('?')[0]);const f=path.join(ROOT,rel==='/'?'/index.html':rel);if(!f.startsWith(ROOT)){rs.writeHead(403).end();return;}fss.stat(f,(e,st)=>{if(e||!st.isFile()){rs.writeHead(404).end('404');return;}rs.writeHead(200,{'Content-Type':MIME[path.extname(f).toLowerCase()]||'application/octet-stream','Content-Length':st.size});fss.createReadStream(f).pipe(rs);});});
await new Promise(r=>server.listen(0,r));
const port=server.address().port;
const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome',args:['--no-sandbox']});
const ctx=await b.newContext({viewport:{width:390,height:844}});
const errs=[];
await ctx.addInitScript(`try{localStorage.setItem('oko-auth','tg');localStorage.setItem('oko-onboard-done','1');localStorage.setItem('oko-tour-done','1');localStorage.setItem('okg-state-v1',JSON.stringify({off:{expiring:true,onboarding:true,partner:true,anketa:true,videofree:true,lesson:true,video:true,autopost:true,factory:true,analytics:true,market:true},refCopied:true}));}catch(e){}`);
const p=await ctx.newPage();
p.on('pageerror',e=>errs.push('PAGEERROR: '+e.message));
p.on('console',m=>{if(m.type()==='error')errs.push('CONSOLE: '+m.text().slice(0,200));});
await p.goto('http://127.0.0.1:'+port+'/',{waitUntil:'load'});
await p.waitForTimeout(3500);
const r1 = await p.evaluate(()=>({
  demoKey: localStorage.getItem('oko-demo'),
  mp: localStorage.getItem('oko-market-pro'),
  mpIsDemo: (typeof mpIsDemo==='function')?mpIsDemo():'n/a',
  dcExtra: (typeof dcExtraAllowed==='function')?dcExtraAllowed():'n/a',
  isOwner: (typeof isOwner==='function')?isOwner():'n/a',
  gross: (typeof MP!=='undefined')?MP.gross:'n/a',
  deals: (typeof MP!=='undefined')?(MP.deals===undefined?'UNDEFINED':JSON.stringify(MP.deals)):'n/a',
  bal: (typeof mpBal==='function')?mpBal():'n/a',
}));
console.log('BOOT', JSON.stringify(r1,null,1));
// open market
await p.evaluate(()=>{ try{ okoSkipAuth&&okoSkipAuth(); }catch(e){}; try{ showTab('mini'); openMa('market'); }catch(e){ console.log('nav fail '+e.message); } });
await p.waitForTimeout(2500);
const txt = await p.evaluate(()=>(document.getElementById('ma-market')?document.getElementById('ma-market').innerText:document.body.innerText));
console.log('HAS "К выводу":', txt.includes('К выводу'));
console.log('HAS "Кабинет продавца":', txt.includes('Кабинет продавца'));
const m = txt.match(/.{0,60}К выводу.{0,60}/s); if(m) console.log('CTX:', m[0].replace(/\n/g,' | '));
console.log('MARKET TEXT HEAD:', txt.slice(0,600).replace(/\n+/g,' | '));
console.log('ERRS', errs.slice(0,15));
await b.close(); server.close();
