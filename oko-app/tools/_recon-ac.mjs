import { chromium } from 'playwright-core';
const B = 'http://127.0.0.1:8199/index.html';
const OUT = '/tmp/claude-0/-home-user-OKO-TEAM/f2926e2e-e87a-533d-ad5f-80dfd2fdcad5/scratchpad/';
const br = await chromium.launch({ executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args:['--no-sandbox','--disable-dev-shm-usage','--use-gl=swiftshader'] });
const ctx = await br.newContext({ viewport:{width:390,height:844}, deviceScaleFactor:1, isMobile:true, hasTouch:true });
await ctx.addInitScript(`
  window.okoSkipAuth = function(){
    try{ localStorage.setItem('oko-auth','tg'); }catch(e){}
    var a=document.getElementById('authScreen'); if(a){a.classList.add('hidden'); a.style.display='none';}
    var s=document.getElementById('splash'); if(s){s.classList.add('gone'); s.style.display='none';}
    var o=document.getElementById('onboard'); if(o){o.classList.add('hidden'); o.style.display='none';}
  };
  try{
    localStorage.setItem('oko-onboard-done','1'); localStorage.setItem('oko-stories-seen','1');
    localStorage.setItem('oko-tour-done','1'); localStorage.setItem('oko-tour','1');
    localStorage.setItem('oko-owner','1'); localStorage.setItem('oko-onboarded','1'); localStorage.setItem('oko-onb2-intro', JSON.stringify({done:true,skipped:true}));
    var L={}; for(var i=0;i<45;i++) L[i]={video:true,slides:true,test:true,testScore:90,task:true,taskText:'Ответ ученика.',game:true,gameWrong:0,slideMax:99,cert:null,mastered:true};
    localStorage.setItem('oko-academy', JSON.stringify({lessons:L,certs:[],owned:{media:true,marketing:true,ai:true},streak:{last:'',days:4,best:6}}));
  }catch(e){}
`);
const p = await ctx.newPage();
await p.route('**/oko-eye.glb', r=>r.abort());
await p.route('**/vendor/**', r=>r.abort());
p.on('pageerror', e=>console.log('PAGEERR', String(e).slice(0,300)));
p.on('console', m=>{ if(m.type()==='error'){ const t=m.text(); if(!/api\.php|404|net::ERR/i.test(t)) console.log('CONSOLE', t.slice(0,200)); }});

async function shot(name, step, wait, post){
  await p.goto(B, {waitUntil:"domcontentloaded", timeout:120000});
  await p.waitForTimeout(1400);
  try{ await p.evaluate(step); }catch(e){ console.log('STEP-ERR', name, String(e).slice(0,160)); }
  await p.waitForTimeout(wait||900);
  if(post){ try{ await p.evaluate(post); }catch(e){ console.log('POST-ERR', name, String(e).slice(0,160)); } await p.waitForTimeout(600); }
  await p.screenshot({path: OUT + name + '.png'});
}
await shot('v-home',  `okoSkipAuth(); showTab('academy');`);
await shot('v-lesson',`okoSkipAuth(); showTab('academy'); acOpenLesson(50);`);
await shot('v-toc',   `okoSkipAuth(); showTab('academy'); acOpenLesson(50); ac2Toc();`);
await shot('v-search',`okoSkipAuth(); showTab('academy'); ac2Search.open('хук');`);
await shot('v-lib',   `okoSkipAuth(); showTab('academy'); ac2OpenLibrary();`);
await shot('v-course',`okoSkipAuth(); showTab('academy'); acOpenCourse(1);`);
await shot('v-navend',`okoSkipAuth(); showTab('academy'); acOpenLesson(50);`, 900, `const s=document.querySelector('main > .screen.active')||document.querySelector('main'); if(s) s.scrollTop=s.scrollHeight;`);
await shot('v-task',  `okoSkipAuth(); showTab('academy'); acOpenLesson(50);`, 900, `const b=document.getElementById('acTaskBox'); const s=document.querySelector('main > .screen.active')||document.querySelector('main'); if(b&&s) s.scrollTop = s.scrollTop + b.getBoundingClientRect().top - 90;`);
await shot('v-admin', `okoSkipAuth(); showTab('academy'); apdAdminOpen(0);`, 1000);
await br.close();
console.log('done');
