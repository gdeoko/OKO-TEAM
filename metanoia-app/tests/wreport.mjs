// Родительский отчёт должен считать настоящее, а не показывать образец.
import { chromium } from 'playwright';
const b = await chromium.launch({ executablePath:'/opt/pw-browsers/chromium', args:['--no-sandbox','--disable-background-networking','--disable-gpu'] });
const p = await b.newPage({ viewport:{width:390,height:844} });
const errs=[]; p.on('pageerror', e=>errs.push('PAGEERROR: '+e.message));
await p.route(u => !u.href.startsWith('http://127.0.0.1'), r=>r.abort());
await p.goto('http://127.0.0.1:8777/index.html',{waitUntil:'load'});
await p.evaluate(()=>{ localStorage.clear(); localStorage.setItem('mt_onb','1'); localStorage.setItem('mt_auth','1'); localStorage.setItem('mt_name','Соня'); });
await p.reload({waitUntil:'load'});
await p.waitForSelector('.splash--hide',{timeout:20000}).catch(()=>{});
await p.waitForTimeout(600);
const пусто = await p.evaluate(()=>{ const o=недельныйОтчёт(); return {имя:o.child, уроков:o.lessons, игр:o.games, серия:o.streak, советов:o.tips.length, первый:(o.tips[0]||'').slice(0,60)}; });
console.log('ПУСТАЯ НЕДЕЛЯ: ' + JSON.stringify(пусто));
const полно = await p.evaluate(()=>{
  const сейчас = Date.now();
  [1,2,3].forEach(n=>localStorage.setItem('mt_lesson_'+n, JSON.stringify({read:true,task:true,test:true,done:true,ts:сейчас-864e5})));
  localStorage.setItem('mt_lesson_4', JSON.stringify({read:true,task:true,test:true,done:true,ts:сейчас-30*864e5}));
  localStorage.setItem('mt_plays', JSON.stringify([сейчас-1e5, сейчас-2e5, сейчас-20*864e5]));
  localStorage.setItem('mt_dverse_streak','5');
  localStorage.setItem('mt_lvl_verse','2');
  const o=недельныйОтчёт();
  return {имя:o.child, уроков:o.lessons, игр:o.games, серия:o.streak, период:o.range, итог:o.rankNote.replace(/<[^>]+>/g,''), советы:o.tips.map(t=>t.slice(0,50))};
});
console.log('ЖИВАЯ НЕДЕЛЯ: ' + JSON.stringify(полно, null, 1));
// и отрисовка
await p.evaluate(()=>{ renderWReport(); });
await p.waitForTimeout(300);
console.log('НА ЭКРАНЕ: ' + (await p.evaluate(()=>(document.getElementById('wreport').innerText||'').replace(/\s+/g,' ').slice(0,160))));
console.log('ОШИБОК: ' + errs.length); errs.slice(0,3).forEach(e=>console.log(e));
await b.close();
