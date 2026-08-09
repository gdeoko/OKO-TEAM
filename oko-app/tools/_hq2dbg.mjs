import { chromium } from 'playwright-core';
const b = await chromium.launch({ executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args:['--no-sandbox'] });
for (const vpw of [390, 1440]) {
const ctx = await b.newContext({ viewport:{width:vpw,height:844}, isMobile:vpw<800, hasTouch:vpw<800 });
await ctx.addInitScript(`
  window.okoSkipAuth=function(){try{localStorage.setItem('oko-auth','tg')}catch(e){};
    var a=document.getElementById('authScreen');if(a){a.classList.add('hidden');a.style.display='none';}
    var s=document.getElementById('splash');if(s){s.classList.add('gone');s.style.display='none';}
    var o=document.getElementById('onboard');if(o){o.classList.add('hidden');o.style.display='none';}};
  try{localStorage.setItem('oko-onboard-done','1');localStorage.setItem('oko-stories-seen','1');
      localStorage.setItem('oko-tour-done','1');localStorage.setItem('oko-tour','1');
      localStorage.setItem('oko-owner','1');
      localStorage.setItem('okg-state-v1', JSON.stringify({born:Date.now()-3600000,days:[],steps:{},
        ob:{collapsed:true,closed:true},nudge:{onboarding:Date.now(),anketa:Date.now(),videofree:Date.now(),
        partner:Date.now(),lesson:Date.now(),expiring:Date.now()},off:{},snooze:{}}));
  }catch(e){}
`);
const p = await ctx.newPage();
await p.goto('http://127.0.0.1:8299/index.html', { waitUntil:'domcontentloaded', timeout:120000 });
await p.waitForTimeout(2500);
await p.evaluate(`okoSkipAuth();`);

const DUMP = `(() => {
  const VW = innerWidth, VH = innerHeight;
  const hv = document.getElementById('h2View'), av = document.getElementById('adminView');
  const layer = (hv&&hv.classList.contains('open'))?hv:((av&&av.classList.contains('open'))?av:null);
  if(!layer) return {layer:'none'};
  const out = {id:layer.id, tr:getComputedStyle(layer).transform, off:[]};
  const vis = el => { const cs=getComputedStyle(el); if(cs.display==='none'||cs.visibility==='hidden'||cs.opacity==='0') return false;
    const r=el.getBoundingClientRect(); if(r.width<=0||r.height<=0) return false;
    if(r.left>=VW-1||r.right<=1) return false; if(r.top>=VH-1||r.bottom<=1) return false; return true; };
  const lab = el => el.tagName.toLowerCase()+(el.id?'#'+el.id:'')+(typeof el.className==='string'&&el.className?'.'+el.className.trim().split(/\\s+/).slice(0,3).join('.'):'');
  for(const el of layer.querySelectorAll('*')){
    if(el.ownerSVGElement) continue; if(!vis(el)) continue;
    const r = el.getBoundingClientRect();
    let sc=false; for(let q=el.parentElement,d=0;q&&d<6;q=q.parentElement,d++){const c=getComputedStyle(q); if(c.overflowX==='auto'||c.overflowX==='scroll'){sc=true;break;}}
    if(!sc && r.right > VW+1 && r.width < VW*1.6) out.off.push({el:lab(el), right:+r.right.toFixed(1), left:+r.left.toFixed(1), w:+r.width.toFixed(1)});
  }
  return out;
})()`;

// имитируем начало прогона: сначала вкладки, потом ПЕРВОЕ открытие агента
await p.evaluate(`openAdmin(); admGo('export');`);
await p.waitForTimeout(900);
await p.evaluate(`(()=>{try{okoHq2.closeView()}catch(e){};return 1})()`); await p.waitForTimeout(700);
await p.evaluate(`(()=>{try{closeAdmin()}catch(e){};return 1})()`); await p.waitForTimeout(700);
await p.evaluate(`openAdmin(); admGo('hq'); okoHq2.openAgent('ceo');`);
for (const ms of [100,200,300,500,800,1200,2000]) {
  await p.waitForTimeout(ms===100?100:200);
  console.log(vpw, 'первое открытие t~', ms, JSON.stringify(await p.evaluate(DUMP)));
}
await ctx.close();
}
await b.close();
