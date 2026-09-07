import { chromium } from 'playwright';
const b = await chromium.launch({ executablePath:'/opt/pw-browsers/chromium', args:['--no-sandbox','--disable-background-networking','--disable-gpu'] });
const p = await b.newPage({ viewport:{width:390,height:844} });
const errs=[]; p.on('pageerror', e=>errs.push('PAGEERROR: '+e.message));
await p.route(u => !u.href.startsWith('http://127.0.0.1'), r=>r.abort());
await p.goto('http://127.0.0.1:8777/index.html',{waitUntil:'load'});
await p.evaluate(()=>{ localStorage.clear(); localStorage.setItem('mt_onb','1'); localStorage.setItem('mt_auth','1');
  localStorage.setItem('mt_kids','[{"name":"Соня","age":8,"img":""}]'); });
await p.reload({waitUntil:'load'});
await p.waitForSelector('.splash--hide',{timeout:20000}).catch(()=>{});
await p.waitForTimeout(700);
const снять = () => p.evaluate(async ()=>{
  const пауза=(м)=>new Promise(r=>setTimeout(r,м));
  openChild(DEMO.children[0]); await пауза(400);
  return { ранг: (document.getElementById('childRank').textContent||'').trim(),
    серия: (document.getElementById('childStreak').textContent||'').trim(),
    текущийРанг: (document.querySelector('#ranksLadder .rank--current .rank__name')||{}).textContent||'' };
});
console.log('НОВЫЙ: ' + JSON.stringify(await снять()));
await p.evaluate(()=>{ petState.зёрна = 260; savePet(); localStorage.setItem('mt_dverse_streak','12'); });
console.log('ПОСЛЕ РОСТА: ' + JSON.stringify(await снять()));
console.log('ОШИБОК: ' + errs.length); errs.slice(0,3).forEach(e=>console.log(e));
await b.close();
