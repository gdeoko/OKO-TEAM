// Полный круг в Телеграме: вход, заведение ребёнка, перенос прогресса.
import { chromium } from 'playwright';
import fs from 'fs';
const initData = fs.readFileSync('/tmp/initdata.txt','utf8').trim();
const b = await chromium.launch({ executablePath:'/opt/pw-browsers/chromium', args:['--no-sandbox','--disable-background-networking','--disable-gpu'] });
const подделка = (init) => {
  window.Telegram = { WebApp: {
    initData: init,
    initDataUnsafe: { user: { id: 7788, first_name: 'Соня', language_code: 'ru' } },
    viewportHeight: 640, viewportStableHeight: 600,
    ready(){}, expand(){}, close(){}, disableVerticalSwipes(){}, enableClosingConfirmation(){},
    setHeaderColor(){}, setBackgroundColor(){}, onEvent(){},
    HapticFeedback:{impactOccurred(){}},
    BackButton:{ show(){}, hide(){}, onClick(){} },
  } };
};
// первое устройство
const p1 = await b.newPage({ viewport:{width:390,height:720} });
await p1.addInitScript(подделка, initData);
const errs=[]; p1.on('pageerror', e=>errs.push('PAGEERROR: '+e.message));
await p1.route(u => !u.href.startsWith('http://127.0.0.1'), r=>r.abort());
await p1.goto('http://127.0.0.1:8099/_t.html',{waitUntil:'load'});
await p1.evaluate(()=>{ localStorage.clear(); localStorage.setItem('mt_onb','1'); });
await p1.reload({waitUntil:'load'});
await p1.waitForSelector('.splash--hide',{timeout:20000}).catch(()=>{});
await p1.waitForTimeout(1500);
// заводим ребёнка
await p1.evaluate(async ()=>{
  const пауза=(м)=>new Promise(r=>setTimeout(r,м));
  openAddChild(); await пауза(300);
  document.getElementById('addkName').value='Пётр';
  document.getElementById('addkName').dispatchEvent(new Event('input',{bubbles:true}));
  await пауза(200); saveChild(); await пауза(1500);
});
await p1.waitForTimeout(1500);
console.log('ПЕРВОЕ УСТРОЙСТВО: ' + JSON.stringify(await p1.evaluate(()=>({
  ребёнокНаСервере: localStorage.getItem('mt_child_id'),
  слой: !!(window.MT_SYNC && MT_SYNC.включён()),
}))));
// проходим урок и ждём отправки
await p1.evaluate(()=>{ localStorage.setItem('mt_lesson_1', JSON.stringify({read:true,task:true,test:true,done:true,ts:Date.now()})); });
await p1.waitForTimeout(4500);
console.log('ОТПРАВЛЕНО: ревизия ' + await p1.evaluate(()=>localStorage.getItem('mt_rev')) + ', время ' + await p1.evaluate(()=>!!localStorage.getItem('mt_sync_at')));
// второе устройство: тот же телеграм-пользователь, чистая память
const p2 = await b.newPage({ viewport:{width:390,height:720} });
await p2.addInitScript(подделка, initData);
p2.on('pageerror', e=>errs.push('PAGEERROR2: '+e.message));
await p2.route(u => !u.href.startsWith('http://127.0.0.1'), r=>r.abort());
await p2.goto('http://127.0.0.1:8099/_t.html',{waitUntil:'load'});
await p2.evaluate(()=>{ localStorage.clear(); localStorage.setItem('mt_onb','1'); });
await p2.reload({waitUntil:'load'});
await p2.waitForTimeout(15000);
console.log('ВТОРОЕ УСТРОЙСТВО: ' + JSON.stringify(await p2.evaluate(()=>({
  ребёнок: localStorage.getItem('mt_child_id'),
  урок: localStorage.getItem('mt_lesson_1'),
}))));
console.log('ОШИБОК: ' + errs.length); errs.slice(0,4).forEach(e=>console.log(e));
await b.close();
