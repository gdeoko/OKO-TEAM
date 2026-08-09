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
await p.goto('http://127.0.0.1:8199/index.html',{waitUntil:'domcontentloaded',timeout:60000});
await p.waitForTimeout(2200);
await p.evaluate(`okoSkipAuth(); showTab('feed');`);
await p.waitForTimeout(1200);
console.log(JSON.stringify(await p.evaluate(() => {
  const st = document.getElementById('oko-a11y-css');
  const out = { styleTag: !!st, len: st ? st.textContent.length : 0, rules: 0, focusRule: null, sheetErr: null };
  if (st && st.sheet) {
    out.rules = st.sheet.cssRules.length;
    for (const r of st.sheet.cssRules) if (/focus-visible/.test(r.cssText||'')) { out.focusRule = r.cssText.slice(0,240); break; }
  }
  const g = document.getElementById('galRow');
  out.galRow = g ? { tabindex: g.getAttribute('tabindex'), matchesWhere: g.matches(':where([tabindex])'),
     cls: g.className, parentInert: !!g.closest('[inert]') } : 'нет';
  return out;
}), null, 1));
/* реальный фокус клавиатурой на galRow */
await p.evaluate(`(()=>{const g=document.getElementById('galRow'); if(g) g.scrollIntoView();})()`);
for (let i=0;i<40;i++){
  await p.keyboard.press('Tab');
  const hit = await p.evaluate(()=>document.activeElement && document.activeElement.id==='galRow');
  if (hit){
    console.log('galRow в фокусе:', JSON.stringify(await p.evaluate(()=>{const cs=getComputedStyle(document.getElementById('galRow'));
      return {outline:cs.outline, ow:cs.outlineWidth, os:cs.outlineStyle, bs:cs.boxShadow.slice(0,60), fv:document.getElementById('galRow').matches(':focus-visible')};})));
    break;
  }
}
await b.close();
