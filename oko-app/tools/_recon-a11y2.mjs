import { chromium } from 'playwright-core';
const b = await chromium.launch({ executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args:['--no-sandbox','--disable-dev-shm-usage','--use-gl=swiftshader','--enable-unsafe-swiftshader'] });
const ctx = await b.newContext({ viewport:{width:390,height:844}, isMobile:true, hasTouch:true, colorScheme:'dark' });
await ctx.addInitScript(`
  window.okoSkipAuth=function(){try{localStorage.setItem('oko-auth','tg')}catch(e){}
    var a=document.getElementById('authScreen');if(a){a.classList.add('hidden');a.style.display='none'}
    var s=document.getElementById('splash');if(s){s.classList.add('gone');s.style.display='none'}
    var o=document.getElementById('onboard');if(o){o.classList.add('hidden');o.style.display='none'}};
  try{localStorage.setItem('oko-onboard-done','1');localStorage.setItem('oko-stories-seen','1');localStorage.setItem('oko-tour-done','1');localStorage.setItem('oko-tour','1');}catch(e){}
`);
const p = await ctx.newPage();
const errs=[];
p.on('pageerror',e=>errs.push('PAGEERROR: '+String(e.stack||e).slice(0,300)));
await p.goto('http://127.0.0.1:8199/index.html',{waitUntil:'domcontentloaded',timeout:60000});
await p.waitForTimeout(2200);
const steps=[['feed',`showTab('feed')`],['chats',`showTab('chats')`],['conv',`showTab('chats'); const r=document.querySelector('#chatList .ci, #chatList > *'); r&&r.click();`],['settings',`typeof st2Open==='function'&&st2Open()`],['notifs',`typeof openNotifs==='function'&&openNotifs()`],['search',`typeof openSearch==='function'&&openSearch()`]];
for (const [id,step] of steps){
  await p.evaluate(`okoSkipAuth(); `+step);
  await p.waitForTimeout(1200);
  const r = await p.evaluate(() => {
    const q='button, a[href], input:not([type=hidden]), select, textarea, [role=button], [role=tab], [role=switch], [tabindex]:not([tabindex="-1"])';
    const vis=el=>{const c=getComputedStyle(el);if(c.display==='none'||c.visibility==='hidden'||parseFloat(c.opacity)<0.05)return false;const b=el.getBoundingClientRect();if(!(b.width>0&&b.height>0&&b.left<innerWidth-1&&b.right>1&&b.top<innerHeight-1&&b.bottom>1))return false;for(let x=el.parentElement;x;x=x.parentElement){const pc=getComputedStyle(x);if(pc.display==='none'||pc.visibility==='hidden'||parseFloat(pc.opacity)<0.05)return false;}return true;};
    const lab=el=>{const id=el.id?'#'+el.id:'';const cls=(typeof el.className==='string'&&el.className)?'.'+el.className.trim().split(/\s+/).slice(0,3).join('.'):'';return el.tagName.toLowerCase()+id+cls;};
    const out=[];
    for(const el of Array.from(document.querySelectorAll(q)).filter(vis)){
      const b=el.getBoundingClientRect();
      const hx=parseFloat(el.style.getPropertyValue('--oko-hit-x'))||0;
      const hy=parseFloat(el.style.getPropertyValue('--oko-hit-y'))||0;
      const pa=getComputedStyle(el,'::after');
      if(b.width+hx*2<43.5||b.height+hy*2<43.5)
        out.push(lab(el)+' '+Math.round(b.width)+'x'+Math.round(b.height)+' hit='+hx+','+hy+' state='+el.dataset.okoHit+' afterBox='+pa.width+'/'+pa.height);
    }
    const dlg=Array.from(document.querySelectorAll('[role=dialog],[role=alertdialog]')).filter(vis).map(d=>lab(d)+' modal='+d.getAttribute('aria-modal')+' name="'+(d.getAttribute('aria-label')||'')+'"');
    return {small:out, dlg, inert: document.querySelectorAll('[data-oko-inert]').length};
  });
  console.log('== '+id+' | диалоги: '+JSON.stringify(r.dlg)+' | inert='+r.inert);
  r.small.forEach(s=>console.log('   '+s));
}
console.log(errs.join('\n')||'JS-ошибок нет');
await b.close();
