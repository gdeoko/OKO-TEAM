/* Быстрая проверка: фокус-ринг по Tab, контраст экрана входа, reduced-motion,
   ловушка фокуса и возврат фокуса, крупный системный шрифт. */
import { chromium } from 'playwright-core';
const CH='/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const INIT = t => `
  window.okoSkipAuth=function(){try{localStorage.setItem('oko-auth','tg')}catch(e){}
    var a=document.getElementById('authScreen');if(a){a.classList.add('hidden');a.style.display='none'}
    var s=document.getElementById('splash');if(s){s.classList.add('gone');s.style.display='none'}
    var o=document.getElementById('onboard');if(o){o.classList.add('hidden');o.style.display='none'}};
  try{localStorage.setItem('oko-onboard-done','1');localStorage.setItem('oko-stories-seen','1');localStorage.setItem('oko-tour-done','1');localStorage.setItem('oko-tour','1');localStorage.setItem('oko-theme','${t}');}catch(e){}
  document.addEventListener('DOMContentLoaded',function(){try{document.documentElement.setAttribute('data-theme','${t}')}catch(e){}});
`;
const b = await chromium.launch({ executablePath:CH, args:['--no-sandbox','--disable-dev-shm-usage','--use-gl=swiftshader','--enable-unsafe-swiftshader'] });

/* --- 1. фокус-ринг по настоящему Tab --- */
{
  const ctx = await b.newContext({ viewport:{width:390,height:844}, isMobile:true, hasTouch:true, colorScheme:'dark' });
  await ctx.addInitScript(INIT('dark'));
  const p = await ctx.newPage();
  await p.goto('http://127.0.0.1:8199/index.html',{waitUntil:'domcontentloaded',timeout:60000});
  await p.waitForTimeout(2200);
  await p.evaluate(`okoSkipAuth(); showTab('feed');`);
  await p.waitForTimeout(1400);
  const seen=new Set(); const bad=[];
  for (let i=0;i<25;i++){
    await p.keyboard.press('Tab');
    const r = await p.evaluate(()=>{ const el=document.activeElement;
      if(!el||el===document.body||el===document.documentElement) return null;
      const cs=getComputedStyle(el);
      const id=el.id?'#'+el.id:''; const cl=(typeof el.className==='string'&&el.className)?'.'+el.className.trim().split(/\s+/).slice(0,2).join('.'):'';
      return {el:el.tagName.toLowerCase()+id+cl, ring:(cs.outlineStyle!=='none'&&parseFloat(cs.outlineWidth)>=1.5)||(cs.boxShadow&&cs.boxShadow!=='none'),
        out:cs.outlineStyle+' '+cs.outlineWidth+' '+cs.outlineColor, name:(el.getAttribute('aria-label')||el.textContent||'').trim().slice(0,25)}; });
    if(!r||seen.has(r.el))continue; seen.add(r.el);
    if(!r.ring) bad.push(r.el+' ['+r.out+']');
  }
  console.log('ФОКУС-РИНГ: проверено '+seen.size+', без кольца '+bad.length);
  bad.forEach(s=>console.log('   '+s));
  console.log('первая остановка Tab:', [...seen][0]);
  await ctx.close();
}

/* --- 2. контраст экрана входа (тёмная) --- */
{
  const ctx = await b.newContext({ viewport:{width:390,height:844}, isMobile:true, hasTouch:true, colorScheme:'dark' });
  await ctx.addInitScript(INIT('dark'));
  const p = await ctx.newPage();
  await p.goto('http://127.0.0.1:8199/index.html',{waitUntil:'domcontentloaded',timeout:60000});
  await p.waitForTimeout(1400);
  await p.evaluate(`document.getElementById('splash')?.classList.add('gone'); document.getElementById('authScreen')?.classList.remove('hidden');`);
  await p.waitForTimeout(1600);
  const bad = await p.evaluate(() => {
    function pc(s){if(!s||s==='transparent')return[0,0,0,0];const m=s.match(/rgba?\(([^)]+)\)/);if(!m)return null;const a=m[1].split(/[,\s\/]+/).filter(Boolean).map(Number);return[a[0],a[1],a[2],a.length>3?a[3]:1];}
    function over(f,b){const a=f[3];return[f[0]*a+b[0]*(1-a),f[1]*a+b[1]*(1-a),f[2]*a+b[2]*(1-a),1];}
    function lum(c){const f=v=>{v/=255;return v<=0.03928?v/12.92:Math.pow((v+0.055)/1.055,2.4)};return .2126*f(c[0])+.7152*f(c[1])+.0722*f(c[2]);}
    function cr(a,b){const l1=lum(a),l2=lum(b),h=Math.max(l1,l2),o=Math.min(l1,l2);return (h+.05)/(o+.05);}
    function hex(c){const h=v=>Math.round(v).toString(16).padStart(2,'0');return '#'+h(c[0])+h(c[1])+h(c[2]);}
    function bgU(el){let acc=null;for(let x=el;x;x=x.parentElement){const cs=getComputedStyle(x);if(cs.backgroundImage&&cs.backgroundImage!=='none')return{c:acc||[0,0,0,1],u:true};const c=pc(cs.backgroundColor);if(c&&c[3]>0){acc=acc?over(acc,c):c;if(c[3]>=.999)return{c:acc,u:false};}}return{c:acc||[0,0,0,1],u:false};}
    const vis=el=>{const c=getComputedStyle(el);if(c.display==='none'||c.visibility==='hidden'||parseFloat(c.opacity)<.05)return false;const b=el.getBoundingClientRect();return b.width>0&&b.height>0&&b.left<innerWidth-1&&b.right>1&&b.top<innerHeight-1&&b.bottom>1;};
    const out=[];
    for(const el of document.body.querySelectorAll('*')){
      if(el.ownerSVGElement)continue;
      let own='';for(const n of el.childNodes)if(n.nodeType===3)own+=n.nodeValue;
      own=own.replace(/\s+/g,' ').trim(); if(own.length<2||!vis(el))continue;
      const cs=getComputedStyle(el);const f0=pc(cs.color);if(!f0||f0[3]<.05)continue;
      if(cs.webkitTextFillColor==='rgba(0, 0, 0, 0)')continue;
      const bi=bgU(el);if(bi.u)continue;
      const f=f0[3]<.999?over(f0,bi.c):f0;const r=cr(f,bi.c);
      const sz=parseFloat(cs.fontSize),w=cs.fontWeight==='bold'?700:(parseInt(cs.fontWeight,10)||400);
      const need=(sz>=24||(sz>=18.66&&w>=700))?3:4.5;
      if(r+.005<need)out.push(r.toFixed(2)+' нужно '+need+' fg='+hex(f)+' bg='+hex(bi.c)+' '+Math.round(sz)+'px «'+own.slice(0,30)+'»');
    }
    return [...new Set(out)];
  });
  console.log('\nКОНТРАСТ экрана входа (тёмная):', bad.length?'\n   '+bad.join('\n   '):'чисто');
  await ctx.close();
}

/* --- 3. reduced motion --- */
{
  const ctx = await b.newContext({ viewport:{width:390,height:844}, isMobile:true, hasTouch:true, colorScheme:'dark', reducedMotion:'reduce' });
  await ctx.addInitScript(INIT('dark'));
  const p = await ctx.newPage();
  await p.goto('http://127.0.0.1:8199/index.html',{waitUntil:'domcontentloaded',timeout:60000});
  await p.waitForTimeout(2500);
  await p.evaluate(`okoSkipAuth(); showTab('feed');`);
  await p.waitForTimeout(1800);
  const m = await p.evaluate(()=>{const a=document.getAnimations().filter(x=>{if(x.playState!=='running')return false;const t=x.effect&&x.effect.getTiming?x.effect.getTiming():null;return t&&(t.iterations===Infinity||(typeof t.duration==='number'&&t.duration>400));});
    return {running:a.length, names:a.slice(0,8).map(x=>(x.animationName||'transition')+'')};});
  console.log('\nREDUCED-MOTION: крутится анимаций', m.running, JSON.stringify(m.names));
  await ctx.close();
}

/* --- 4. ловушка фокуса + возврат --- */
{
  const ctx = await b.newContext({ viewport:{width:390,height:844}, isMobile:true, hasTouch:true, colorScheme:'dark' });
  await ctx.addInitScript(INIT('dark'));
  const p = await ctx.newPage();
  await p.goto('http://127.0.0.1:8199/index.html',{waitUntil:'domcontentloaded',timeout:60000});
  await p.waitForTimeout(2200);
  for (const [id,open] of [['settings',`typeof st2Open==='function'&&st2Open()`],['notifs',`typeof openNotifs==='function'&&openNotifs()`],['search',`typeof openSearch==='function'&&openSearch()`]]){
    await p.evaluate(`okoSkipAuth();`);
    await p.evaluate(`(()=>{let b=document.getElementById('a11yTrapOpener');if(!b){b=document.createElement('button');b.id='a11yTrapOpener';b.textContent='открыть';b.style.cssText='position:fixed;left:4px;top:4px;z-index:5;width:60px;height:44px';document.body.appendChild(b);}b.focus();})()`);
    await p.evaluate(open);
    await p.waitForTimeout(1600);
    const info = await p.evaluate(()=>{const d=Array.from(document.querySelectorAll('[role=dialog],[role=alertdialog]')).filter(x=>{const c=getComputedStyle(x);return c.display!=='none'&&c.visibility!=='hidden'&&x.getBoundingClientRect().width>0;}).pop();
      return d?{found:true,el:(d.id?'#'+d.id:d.tagName),modal:d.getAttribute('aria-modal'),name:d.getAttribute('aria-label'),inside:d.contains(document.activeElement)}:{found:false};});
    let esc=0;
    if(info.found){ for(let i=0;i<30;i++){ await p.keyboard.press('Tab');
      const inside=await p.evaluate(()=>{const d=Array.from(document.querySelectorAll('[role=dialog],[role=alertdialog]')).filter(x=>getComputedStyle(x).display!=='none'&&x.getBoundingClientRect().width>0).pop();return d?d.contains(document.activeElement):true;});
      if(!inside)esc++; } }
    await p.keyboard.press('Escape'); await p.waitForTimeout(1200);
    const closed = await p.evaluate(()=>!Array.from(document.querySelectorAll('[role=dialog],[role=alertdialog]')).some(x=>getComputedStyle(x).display!=='none'&&getComputedStyle(x).visibility!=='hidden'&&x.getBoundingClientRect().width>0&&x.getAttribute('aria-modal')==='true'));
    const back = await p.evaluate(()=>document.activeElement&&document.activeElement.id==='a11yTrapOpener');
    console.log(`\nЛОВУШКА ${id}: dialog=${info.found} modal=${info.modal} имя="${info.name}" фокус внутрь=${info.inside} утечек Tab=${esc} Esc закрыл=${closed} возврат фокуса=${back}`);
  }
  await ctx.close();
}

/* --- 5. крупный шрифт 135% --- */
{
  const ctx = await b.newContext({ viewport:{width:360,height:740}, isMobile:true, hasTouch:true, colorScheme:'dark' });
  await ctx.addInitScript(INIT('dark'));
  const p = await ctx.newPage();
  await p.goto('http://127.0.0.1:8199/index.html',{waitUntil:'domcontentloaded',timeout:60000});
  await p.waitForTimeout(2200);
  await p.evaluate(`okoSkipAuth(); showTab('feed'); if(typeof st2SetFont==='function') st2SetFont(135);`);
  await p.waitForTimeout(1600);
  for (const [id,step] of [['feed',`showTab('feed')`],['chats',`showTab('chats')`],['wallet',`showTab('wallet')`],['profile',`showTab('profile')`]]){
    await p.evaluate(step); await p.waitForTimeout(1200);
    const r = await p.evaluate(()=>{const de=document.documentElement;
      const lab=el=>{const i=el.id?'#'+el.id:'';const c=(typeof el.className==='string'&&el.className)?'.'+el.className.trim().split(/\s+/).slice(0,2).join('.'):'';return el.tagName.toLowerCase()+i+c;};
      const vis=el=>{const cs=getComputedStyle(el);if(cs.display==='none'||cs.visibility==='hidden')return false;const b=el.getBoundingClientRect();return b.width>0&&b.height>0&&b.left<innerWidth-1&&b.right>1&&b.top<innerHeight-1&&b.bottom>1;};
      const clip=[];
      for(const el of Array.from(document.body.querySelectorAll('*')).slice(0,4000)){
        if(el.ownerSVGElement||!vis(el)||el.children.length)continue;
        const t=(el.textContent||'').trim(); if(!t)continue;
        const cs=getComputedStyle(el);
        if(cs.textOverflow==='ellipsis'||cs.webkitLineClamp!=='none')continue;
        if(el.scrollWidth>el.clientWidth+2&&cs.overflow!=='visible')clip.push(lab(el)+' «'+t.slice(0,26)+'»');
        if(el.scrollHeight>el.clientHeight+3&&cs.overflow==='hidden')clip.push('верт '+lab(el)+' «'+t.slice(0,26)+'»');
      }
      return {ox:Math.max(0,de.scrollWidth-de.clientWidth), clip:[...new Set(clip)].slice(0,6)};});
    console.log(`ШРИФТ 135% ${id}: overflowX=${r.ox} обрезано=${r.clip.length} ${r.clip.join(' | ')}`);
  }
  await ctx.close();
}
await b.close();
