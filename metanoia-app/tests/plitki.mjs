// Плитки на экране ребёнка показывают его настоящие цифры.
import { chromium } from 'playwright';
const b = await chromium.launch({ executablePath:'/opt/pw-browsers/chromium', args:['--no-sandbox','--disable-gpu'] });
const p = await b.newPage({ viewport:{width:390,height:844} });
const errs=[]; p.on('pageerror',e=>errs.push('PAGEERROR: '+e.message));
await p.route(u=>!u.href.startsWith('http://127.0.0.1'), r=>r.abort());
await p.goto('http://127.0.0.1:8777/index.html',{waitUntil:'load'});
await p.evaluate(()=>{ localStorage.clear(); localStorage.setItem('mt_onb','1'); localStorage.setItem('mt_auth','1');
  localStorage.setItem('mt_kids','[{"name":"Соня","age":8,"img":""}]'); });
await p.reload({waitUntil:'load'});
await p.waitForSelector('.splash--hide',{timeout:20000}).catch(()=>{});
await p.waitForTimeout(800);
const плитки = () => p.evaluate(()=>{ openChild(DEMO.children[0]);
  return { рейтинг: document.getElementById('ratingTile').innerText.replace(/\s+/g,' ').trim(),
    сертификаты: document.getElementById('certsTile').innerText.replace(/\s+/g,' ').trim(),
    лавка: document.getElementById('shopTileXp').innerText.replace(/\s+/g,' ').trim(),
    путь: document.getElementById('journeyTile').innerText.replace(/\s+/g,' ').trim() }; });
console.log('новый ребёнок: ' + JSON.stringify(await плитки(), null, 1));
await p.evaluate(()=>{ localStorage.setItem('mt_exam_0', JSON.stringify({pct:90,ts:Date.now()}));
  localStorage.setItem('mt_pet', JSON.stringify({вид:'lamb', зёрна:250}));
  for (let n=1;n<=25;n++) saveLessonState(n,{read:true,task:true,test:true,done:true,ts:Date.now()}); });
console.log('после главы: ' + JSON.stringify(await плитки(), null, 1));
console.log('ОШИБОК: ' + errs.length); errs.slice(0,3).forEach(e=>console.log(e));
await b.close();
