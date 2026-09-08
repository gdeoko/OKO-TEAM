// Родительский лимит игр и выключаемый код родителя.
import { chromium } from 'playwright';
const b = await chromium.launch({ executablePath:'/opt/pw-browsers/chromium', args:['--no-sandbox','--disable-background-networking','--disable-gpu'] });
const p = await b.newPage({ viewport:{width:390,height:844} });
const errs=[]; p.on('pageerror', e=>errs.push('PAGEERROR: '+e.message));
await p.route(u => !u.href.startsWith('http://127.0.0.1'), r=>r.abort());
await p.goto('http://127.0.0.1:8777/index.html',{waitUntil:'load'});
await p.evaluate(()=>{ localStorage.clear(); localStorage.setItem('mt_onb','1'); localStorage.setItem('mt_auth','1'); localStorage.setItem('mt_music_off','1'); });
await p.reload({waitUntil:'load'});
await p.waitForSelector('.splash--hide',{timeout:20000}).catch(()=>{});
await p.waitForTimeout(700);
const итог = await p.evaluate(async ()=>{
  const пауза=(м)=>new Promise(r=>setTimeout(r,м));
  const открыт=()=>{ let э=''; document.querySelectorAll('[data-screen]').forEach(e=>{ if(!e.hidden && getComputedStyle(e).display!=='none') э=e.dataset.screen; }); return э; };
  const из={};
  // лимит выключен: игра открывается
  openGame('memory'); await пауза(500); из.безЛимита=открыт();
  openGamesHub(); await пауза(300);
  из.минутыСчитаются = !!localStorage.getItem('mt_playtime');
  // включаем лимит и делаем вид, что полчаса прошли
  setPut('p_time', true);
  localStorage.setItem('mt_playtime', JSON.stringify({ день: todayKey(), мс: 31*60*1000 }));
  openGame('memory'); await пауза(500);
  из.сЛимитом = открыт() + ' | ' + ((document.getElementById('toast')||{}).textContent||'').slice(0,50);
  // немного времени осталось
  localStorage.setItem('mt_playtime', JSON.stringify({ день: todayKey(), мс: 20*60*1000 }));
  openGame('memory'); await пауза(500);
  из.естьВремя = открыт();
  openGamesHub(); await пауза(300);
  // код родителя выключен настройкой
  setPut('p_pin', false);
  openChild(DEMO.children[0]); await пауза(400);
  document.getElementById('childBack').click(); await пауза(500);
  из.безКода = (document.getElementById('pinModal').hidden ? 'пустили без кода' : 'спросили код');
  setPut('p_pin', true);
  openChild(DEMO.children[0]); await пауза(400);
  document.getElementById('childBack').click(); await пауза(500);
  из.сКодом = (document.getElementById('pinModal').hidden ? 'пустили без кода' : 'спросили код');
  return из;
});
console.log(JSON.stringify(итог, null, 1));
console.log('ОШИБОК: ' + errs.length); errs.slice(0,3).forEach(e=>console.log(e));
await b.close();
