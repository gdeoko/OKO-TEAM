import { chromium } from 'playwright-core';
const THEME = process.argv[2] || 'dark';
const b = await chromium.launch({ executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args:['--no-sandbox','--disable-dev-shm-usage','--use-gl=swiftshader','--enable-unsafe-swiftshader'] });
const ctx = await b.newContext({ viewport:{width:390,height:844}, isMobile:true, hasTouch:true, colorScheme:THEME });
await ctx.addInitScript(`
  window.okoSkipAuth=function(){try{localStorage.setItem('oko-auth','tg')}catch(e){}
    var a=document.getElementById('authScreen');if(a){a.classList.add('hidden');a.style.display='none'}
    var s=document.getElementById('splash');if(s){s.classList.add('gone');s.style.display='none'}
    var o=document.getElementById('onboard');if(o){o.classList.add('hidden');o.style.display='none'}};
  try{localStorage.setItem('oko-onboard-done','1');localStorage.setItem('oko-stories-seen','1');localStorage.setItem('oko-tour-done','1');localStorage.setItem('oko-tour','1');localStorage.setItem('oko-theme','${THEME}');}catch(e){}
  document.addEventListener('DOMContentLoaded',function(){try{document.documentElement.setAttribute('data-theme','${THEME}')}catch(e){}});
`);
const p = await ctx.newPage();
await p.goto('http://127.0.0.1:8199/index.html',{waitUntil:'domcontentloaded',timeout:60000});
await p.waitForTimeout(1600);
await p.evaluate(`okoSkipAuth();`);
const steps = [
 ['feed',`showTab('feed')`],['chats',`showTab('chats')`],
 ['conv',`showTab('chats'); const r=document.querySelector('#chatList .ci, #chatList > *'); r&&r.click();`],
 ['mini',`showTab('mini')`],['wallet',`showTab('wallet')`],['profile',`showTab('profile')`],
 ['academy',`showTab('academy')`],['partner',`showTab('partner')`],['games',`showTab('games')`],['ads',`showTab('ads')`],
 ['settings',`typeof st2Open==='function'&&st2Open()`],['notifs',`typeof openNotifs==='function'&&openNotifs()`],
 ['search',`typeof openSearch==='function'&&openSearch()`],
];
const CODE = `(() => {
  const vis = el => { const c=getComputedStyle(el); if(c.display==='none'||c.visibility==='hidden'||parseFloat(c.opacity)<0.05) return false; const b=el.getBoundingClientRect(); if(!(b.width>0&&b.height>0&&b.left<innerWidth-1&&b.right>1&&b.top<innerHeight-1&&b.bottom>1))return false;
    for(let x=el.parentElement;x;x=x.parentElement){const pc=getComputedStyle(x); if(pc.display==='none'||pc.visibility==='hidden'||parseFloat(pc.opacity)<0.05)return false;} return true; };
  const lab = el => { const id=el.id?'#'+el.id:''; const cls=(typeof el.className==='string'&&el.className)?'.'+el.className.trim().split(/\\s+/).slice(0,3).join('.'):''; return el.tagName.toLowerCase()+id+cls; };
  function pc(s){ if(!s||s==='transparent')return [0,0,0,0]; const m=s.match(/rgba?\\(([^)]+)\\)/); if(!m)return null; const a=m[1].split(/[,\\s\\/]+/).filter(Boolean).map(Number); return [a[0],a[1],a[2],a.length>3?a[3]:1]; }
  function over(f,b){const a=f[3];return [f[0]*a+b[0]*(1-a),f[1]*a+b[1]*(1-a),f[2]*a+b[2]*(1-a),1];}
  function lum(c){const f=v=>{v/=255;return v<=0.03928?v/12.92:Math.pow((v+0.055)/1.055,2.4)};return 0.2126*f(c[0])+0.7152*f(c[1])+0.0722*f(c[2]);}
  function cr(a,b){const l1=lum(a),l2=lum(b);const h=Math.max(l1,l2),o=Math.min(l1,l2);return (h+0.05)/(o+0.05);}
  function hex(c){const h=v=>Math.round(v).toString(16).padStart(2,'0');return '#'+h(c[0])+h(c[1])+h(c[2]);}
  function bgU(el){ let acc=null;
    for(let x=el;x;x=x.parentElement){ const cs=getComputedStyle(x);
      if(cs.backgroundImage&&cs.backgroundImage!=='none') return {c:acc||[0,0,0,1],unknown:true};
      const c=pc(cs.backgroundColor); if(c&&c[3]>0){ acc=acc?over(acc,c):c; if(c[3]>=0.999) return {c:acc[3]>=0.999?acc:over(acc,[0,0,0,1]),unknown:false}; } }
    const h=pc(getComputedStyle(document.documentElement).backgroundColor)||[255,255,255,1];
    return {c:acc?over(acc,h[3]>0?h:[255,255,255,1]):(h[3]>0?h:[255,255,255,1]),unknown:false}; }
  const bad=[];
  for(const el of Array.from(document.body.querySelectorAll('*')).slice(0,7000)){
    if(el.ownerSVGElement) continue;
    let own=''; for(const n of el.childNodes) if(n.nodeType===3) own+=n.nodeValue;
    own=own.replace(/\\s+/g,' ').trim(); if(own.length<2) continue;
    if(!vis(el)) continue;
    const cs=getComputedStyle(el); const f0=pc(cs.color); if(!f0||f0[3]<0.05) continue;
    if(cs.webkitTextFillColor==='rgba(0, 0, 0, 0)') continue;
    const bi=bgU(el); if(bi.unknown) continue;
    const f=f0[3]<0.999?over(f0,bi.c):f0;
    const r=cr(f,bi.c); const sz=parseFloat(cs.fontSize); const w=cs.fontWeight==='bold'?700:(parseInt(cs.fontWeight,10)||400);
    const large=sz>=24||(sz>=18.66&&w>=700); const need=large?3:4.5;
    if(r+0.005<need) bad.push({el:lab(el),t:own.slice(0,30),fg:hex(f),bg:hex(bi.c),r:+r.toFixed(2),need,sz:Math.round(sz)});
  }
  /* иконочные кнопки без aria-label */
  const iconOnly = Array.from(document.querySelectorAll('button,[role=button],a[href]')).filter(vis).filter(el=>{
    const txt=(el.textContent||'').replace(/\\s+/g,' ').trim(); return !txt && el.querySelector('svg,img');
  });
  const iconNoLabel = iconOnly.filter(el=>!(el.getAttribute('aria-label')||'').trim() && !el.getAttribute('aria-labelledby') && !(el.getAttribute('title')||'').trim());
  /* dialogs */
  const dlg = Array.from(document.querySelectorAll('[role=dialog],[role=alertdialog]')).filter(vis);
  return { bad, iconOnly: iconOnly.length, iconNoLabel: iconNoLabel.map(e=>lab(e)+' :: '+e.outerHTML.slice(0,80).replace(/\\s+/g,' ')),
    dlg: dlg.map(d=>lab(d)+' modal='+d.getAttribute('aria-modal')+' name='+((d.getAttribute('aria-label')||'').slice(0,20)||(d.getAttribute('aria-labelledby')||'-')) ) };
})()`;
const agg={}, icons={}, dlgs={};
for (const [id,step] of steps){
  try{ await p.evaluate(step); }catch(e){}
  await p.waitForTimeout(800);
  const r = await p.evaluate(CODE);
  console.log(id,'lowContrast='+r.bad.length,'iconOnly='+r.iconOnly,'iconNoLabel='+r.iconNoLabel.length,'dialogs='+r.dlg.length);
  for(const x of r.bad){ const k=x.fg+'|'+x.bg+'|'+x.need; agg[k]=agg[k]||{...x,hits:0,ex:[]}; agg[k].hits++; if(agg[k].ex.length<3)agg[k].ex.push(id+':'+x.el+' «'+x.t+'»'); }
  for(const s of r.iconNoLabel) icons[s]=1;
  for(const s of r.dlg) dlgs[s]=1;
}
console.log('\n=== КОНТРАСТ ('+THEME+') уникальные пары ===');
Object.values(agg).sort((a,b)=>a.r-b.r).forEach(x=>console.log(`${x.r} (нужно ${x.need}) fg=${x.fg} bg=${x.bg} ${x.sz}px hits=${x.hits} | ${x.ex.join(' ; ')}`));
console.log('\n=== ИКОНКИ БЕЗ ИМЕНИ ==='); Object.keys(icons).forEach(k=>console.log(k));
console.log('\n=== DIALOGS ==='); Object.keys(dlgs).forEach(k=>console.log(k));
await b.close();
