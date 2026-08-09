/* Дым: не сломал ли слой доступности вёрстку (переполнения, обрезания). */
import { chromium } from 'playwright-core';
const b = await chromium.launch({ executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args:['--no-sandbox','--disable-dev-shm-usage','--use-gl=swiftshader','--enable-unsafe-swiftshader'] });
for (const vp of [{w:390,h:844,id:'phone'},{w:360,h:740,id:'narrow'},{w:1440,h:900,id:'desk'}]){
const ctx = await b.newContext({ viewport:{width:vp.w,height:vp.h}, isMobile:vp.w<800, hasTouch:vp.w<800, colorScheme:'dark' });
await ctx.addInitScript(`
  window.okoSkipAuth=function(){try{localStorage.setItem('oko-auth','tg')}catch(e){}
    var a=document.getElementById('authScreen');if(a){a.classList.add('hidden');a.style.display='none'}
    var s=document.getElementById('splash');if(s){s.classList.add('gone');s.style.display='none'}
    var o=document.getElementById('onboard');if(o){o.classList.add('hidden');o.style.display='none'}};
  try{localStorage.setItem('oko-onboard-done','1');localStorage.setItem('oko-stories-seen','1');localStorage.setItem('oko-tour-done','1');localStorage.setItem('oko-tour','1');}catch(e){}
`);
const p = await ctx.newPage();
await p.goto('http://127.0.0.1:8199/index.html',{waitUntil:'domcontentloaded',timeout:60000});
await p.waitForTimeout(2200);
const steps=[['feed',`showTab('feed')`],['chats',`showTab('chats')`],['conv',`showTab('chats'); const r=document.querySelector('#chatList .ci, #chatList > *'); r&&r.click();`],['mini',`showTab('mini')`],['wallet',`showTab('wallet')`],['profile',`showTab('profile')`],['academy',`showTab('academy')`],['settings',`typeof st2Open==='function'&&st2Open()`]];
for (const [id,step] of steps){
  await p.evaluate(`okoSkipAuth(); `+step);
  await p.waitForTimeout(1400);
  const r = await p.evaluate(() => {
    const de=document.documentElement;
    const lab=el=>{const i=el.id?'#'+el.id:'';const c=(typeof el.className==='string'&&el.className)?'.'+el.className.trim().split(/\s+/).slice(0,3).join('.'):'';return el.tagName.toLowerCase()+i+c;};
    const VW=innerWidth,VH=innerHeight;
    const vis=el=>{const cs=getComputedStyle(el);if(cs.display==='none'||cs.visibility==='hidden'||parseFloat(cs.opacity)===0)return false;const b=el.getBoundingClientRect();return b.width>0&&b.height>0&&b.left<VW-1&&b.right>1&&b.top<VH-1&&b.bottom>1;};
    const off=[],clip=[];
    for(const el of Array.from(document.body.querySelectorAll('*')).slice(0,4000)){
      if(el.ownerSVGElement||!vis(el))continue;
      const b=el.getBoundingClientRect(),cs=getComputedStyle(el);
      let sc=false;for(let x=el.parentElement,d=0;x&&d<6;x=x.parentElement,d++){const c=getComputedStyle(x);if(c.overflowX==='auto'||c.overflowX==='scroll'){sc=true;break;}}
      if(!sc&&b.right>VW+1&&b.width<VW*1.6) off.push(lab(el)+' right='+Math.round(b.right));
      const t=(el.textContent||'').trim();
      if(t&&el.children.length===0){
        const intentional=cs.textOverflow==='ellipsis'||cs.webkitLineClamp!=='none';
        if(!intentional&&el.scrollWidth>el.clientWidth+2&&cs.overflow!=='visible') clip.push(lab(el)+' «'+t.slice(0,30)+'»');
      }
    }
    return {overflowX:Math.max(0,de.scrollWidth-de.clientWidth), off:[...new Set(off)].slice(0,8), clip:[...new Set(clip)].slice(0,8)};
  });
  const flags=[r.overflowX?'overflowX='+r.overflowX:'',r.off.length?'offRight='+r.off.length:'',r.clip.length?'clipped='+r.clip.length:''].filter(Boolean).join(' ');
  console.log(vp.id+'/'+id+' '+(flags||'чисто'));
  r.off.forEach(s=>console.log('    off: '+s));
  r.clip.forEach(s=>console.log('    clip: '+s));
}
await ctx.close();
}
await b.close();
