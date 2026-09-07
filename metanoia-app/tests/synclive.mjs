// Живая проверка переноса прогресса: приложение и настоящий сервер с базой.
import { chromium } from 'playwright';
const токен = process.argv[2];
const B = 'http://127.0.0.1:8099';
const b = await chromium.launch({ executablePath:'/opt/pw-browsers/chromium', args:['--no-sandbox','--disable-background-networking','--disable-gpu'] });

// первое устройство: проходит урок, состояние должно уехать на сервер
const у1 = await b.newPage({ viewport:{width:390,height:844} });
const errs=[]; у1.on('pageerror', e=>errs.push('PAGEERROR: '+e.message));
await у1.goto(B + '/_t.html',{waitUntil:'load'});
await у1.evaluate(([t])=>{ localStorage.clear(); localStorage.setItem('mt_onb','1'); localStorage.setItem('mt_auth','1'); localStorage.setItem('mt_token', t); localStorage.setItem('mt_child_id','5'); }, [токен]);
await у1.reload({waitUntil:'load'});
await у1.waitForSelector('.splash--hide',{timeout:20000}).catch(()=>{});
await у1.waitForTimeout(800);
console.log('СЛОЙ ВКЛЮЧЁН: ' + await у1.evaluate(()=>!!(window.MT_SYNC && MT_SYNC.включён())));
await у1.evaluate(()=>{
  localStorage.setItem('mt_lesson_1', JSON.stringify({read:true,task:true,test:true,done:true,ts:Date.now()}));
  localStorage.setItem('mt_name','Соня');
});
await у1.waitForTimeout(4500);
const ушло = await у1.evaluate(()=>({rev: Number(localStorage.getItem('mt_rev')||0), когда: localStorage.getItem('mt_sync_at')}));
console.log('ПЕРВОЕ УСТРОЙСТВО: ' + JSON.stringify(ушло));

// второе устройство: чистое, должно забрать прогресс с сервера
const у2 = await b.newPage({ viewport:{width:390,height:844} });
у2.on('pageerror', e=>errs.push('PAGEERROR2: '+e.message));
await у2.goto(B + '/_t.html',{waitUntil:'load'});
await у2.evaluate(([t])=>{ localStorage.clear(); localStorage.setItem('mt_onb','1'); localStorage.setItem('mt_auth','1'); localStorage.setItem('mt_token', t); localStorage.setItem('mt_child_id','5'); }, [токен]);
await у2.reload({waitUntil:'load'});
await у2.waitForTimeout(4000);
const пришло = await у2.evaluate(()=>({
  урок: localStorage.getItem('mt_lesson_1'),
  имя: localStorage.getItem('mt_name'),
  rev: Number(localStorage.getItem('mt_rev')||0),
}));
console.log('ВТОРОЕ УСТРОЙСТВО: ' + JSON.stringify(пришло));
console.log('ОШИБОК: ' + errs.length); errs.slice(0,4).forEach(e=>console.log(e));
await b.close();
