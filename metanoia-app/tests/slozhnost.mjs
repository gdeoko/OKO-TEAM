// Обещание «следующий заход будет сложнее» должно менять сами игры.
import { chromium } from 'playwright';
const b = await chromium.launch({ executablePath:'/opt/pw-browsers/chromium', args:['--no-sandbox','--disable-gpu'] });
const p = await b.newPage({ viewport:{width:390,height:844} });
const errs=[]; p.on('pageerror',e=>errs.push('PAGEERROR: '+e.message));
await p.route(u=>!u.href.startsWith('http://127.0.0.1'), r=>r.abort());
await p.goto('http://127.0.0.1:8777/index.html',{waitUntil:'load'});
await p.evaluate(()=>{localStorage.clear(); localStorage.setItem('mt_onb','1'); localStorage.setItem('mt_auth','1');});
await p.reload({waitUntil:'load'});
await p.waitForSelector('.splash--hide',{timeout:20000}).catch(()=>{});
await p.waitForTimeout(700);

const снять = () => p.evaluate(()=>{
  openMemory(); const пар = memState.cards.length/2;
  openExodus(); const исход = {время: exodus.time, цель: exodus.goal};
  openArk(); const ковчег = ark.всего;
  openDavid(); const давид = {камней: david.stones, зона: david.zoneW};
  openMatch3(); const ходов = m3.moves;
  const стих = (уровеньИгры('verse') >= 5 ? 'hard' : уровеньИгры('verse') >= 3 ? 'medium' : 'easy');
  return {пар, исход, ковчег, давид, ходов, стих};
});
console.log('УРОВЕНЬ 1: ' + JSON.stringify(await снять()));
await p.evaluate(()=>{ ['memory','exodus','ark','david','match3','verse'].forEach(k=>localStorage.setItem('mt_lvl_'+k,'6')); });
console.log('УРОВЕНЬ 6: ' + JSON.stringify(await снять()));
await p.evaluate(()=>{ ['memory','exodus','ark','david','match3','verse'].forEach(k=>localStorage.setItem('mt_lvl_'+k,'15')); });
console.log('УРОВЕНЬ 15: ' + JSON.stringify(await снять()));
// партии считаются
await p.evaluate(()=>{ завершитьИгру('memory', 20, 'Тест', 'Тест'); });
await p.waitForTimeout(300);
console.log('ПАРТИЙ ЗАПИСАНО: ' + await p.evaluate(()=>JSON.parse(localStorage.getItem('mt_plays')||'[]').length)
  + ', уровень мемори стал ' + await p.evaluate(()=>уровеньИгры('memory')));
console.log('ОШИБОК: ' + errs.length); errs.slice(0,4).forEach(e=>console.log(e));
await b.close();
