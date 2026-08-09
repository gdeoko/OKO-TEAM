import { chromium } from 'playwright-core';

const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args:['--no-sandbox'] });
const ctx = await b.newContext({ viewport:{width:390,height:844} });
const p = await ctx.newPage();
p.on('pageerror', e => console.log('PAGEERR', String(e).slice(0,200)));
await p.addInitScript(`
  window.okoSkipAuth = function(){
    try{ localStorage.setItem('oko-auth','tg'); }catch(e){}
    var a=document.getElementById('authScreen'); if(a){a.classList.add('hidden'); a.style.display='none';}
    var s=document.getElementById('splash'); if(s){s.classList.add('gone'); s.style.display='none';}
  };
  try{ localStorage.setItem('oko-onboarded','1'); localStorage.setItem('oko-stories-seen','1'); localStorage.setItem('oko-tour-done','1'); localStorage.setItem('oko-tour','1'); }catch(e){}
`);
await p.goto('http://127.0.0.1:8199/index.html', { waitUntil:'load' });
await p.waitForTimeout(2500);
const out = await p.evaluate(() => {
  const res = {};
  const g = n => { try { return eval(n); } catch(e){ return '__ERR__'+e.message; } };
  res.AC_COURSES = (g('AC_COURSES')||[]).map ? g('AC_COURSES').map(c=>Object.keys(c).join(',')+' | '+JSON.stringify(c).slice(0,300)) : 'n/a';
  const blocks = g('AC_BLOCKS');
  res.AC_BLOCKS0 = Array.isArray(blocks) ? JSON.stringify(blocks[0]).slice(0,400) : 'n/a';
  res.AC_BLOCKS_n = Array.isArray(blocks) ? blocks.length : 0;
  const pack = window.AC_PACK||{};
  const k0 = Object.keys(pack)[0];
  res.AC_PACK_keys = Object.keys(pack).slice(0,20);
  res.AC_PACK_sample = k0 ? JSON.stringify(pack[k0]).slice(0,500) : 'n/a';
  try { res.channels = JSON.parse(localStorage.getItem('oko-channels')||'null'); } catch(e){ res.channels='err'; }
  res.chanStr = String(localStorage.getItem('oko-channels')||'').slice(0,600);
  // ищем клубы
  res.hasClubs = ['CLUBS','SOC_CLUBS','socClubs','clubs'].map(n=>n+'='+typeof g(n));
  res.acLessonCount = (()=>{ try { return AC_COURSE.length; } catch(e){ return 'n/a'; } })();
  res.acCourseSample = (()=>{ try { return JSON.stringify(AC_COURSE[0]).slice(0,400); } catch(e){ return 'n/a'; } })();
  res.miniApps = (()=>{ try { return [...document.querySelectorAll('#maGrid .svc')].map(b=>b.textContent.trim()); } catch(e){ return 'n/a'; } })();
  res.tabs = (()=>{ try { return [...document.querySelectorAll('.tabbar button, .tabbar .tb')].map(b=>b.textContent.trim()); } catch(e){ return 'n/a'; } })();
  return res;
});
console.log(JSON.stringify(out, null, 1).slice(0, 14000));
await b.close();
