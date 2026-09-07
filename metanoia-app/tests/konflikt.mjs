// Конфликт ревизий: то, что ребёнок прошёл без связи, не должно пропадать.
import { chromium } from 'playwright';
const B='http://127.0.0.1:8099';
const почта = 'konflikt' + Date.now() + '@test.ru';
const b = await chromium.launch({ executablePath:'/opt/pw-browsers/chromium', args:['--no-sandbox','--disable-gpu'] });
const errs=[];
const стр = async () => { const p=await b.newPage({viewport:{width:390,height:844}});
  p.on('pageerror',e=>errs.push('PAGEERROR: '+e.message));
  await p.route(u=>!u.href.startsWith('http://127.0.0.1'), r=>r.abort()); return p; };

// заводим семью с ребёнком
const p1 = await стр();
await p1.goto(B+'/_t.html',{waitUntil:'load'});
await p1.evaluate(()=>{localStorage.clear(); localStorage.setItem('mt_onb','1');});
await p1.reload({waitUntil:'load'}); await p1.waitForTimeout(1200);
await p1.click('[data-authtab="register"]');
await p1.fill('#registerForm [name="name"]','Мария');
await p1.fill('#registerForm [name="email"]',почта);
await p1.fill('#registerForm [name="password"]','Parol12345');
await p1.fill('#registerForm [name="child_name"]','Соня');
for (const c of await p1.$$('#registerForm input[type=checkbox]')) await c.check().catch(()=>{});
await p1.click('#registerForm [type="submit"]'); await p1.waitForTimeout(4000);
// первое устройство проходит урок 1 и уходит на сервер
await p1.evaluate(()=>localStorage.setItem('mt_lesson_1', JSON.stringify({read:true,task:true,test:true,done:true,ts:Date.now()})));
await p1.waitForTimeout(4500);
const токен = await p1.evaluate(()=>localStorage.getItem('mt_token'));
const ребёнок = await p1.evaluate(()=>localStorage.getItem('mt_child_id'));
console.log('первое устройство: ревизия ' + await p1.evaluate(()=>localStorage.getItem('mt_rev')));

// второе устройство: тот же ребёнок, но ревизия сбита (как после долгой работы без связи)
const p2 = await стр();
await p2.goto(B+'/_t.html',{waitUntil:'load'});
await p2.evaluate(([т,р])=>{ localStorage.clear(); localStorage.setItem('mt_onb','1'); localStorage.setItem('mt_auth','1');
  localStorage.setItem('mt_token', т); localStorage.setItem('mt_child_id', р);
  localStorage.setItem('mt_rev','1');   // устарела
  localStorage.setItem('mt_lesson_9', JSON.stringify({read:true,task:true,test:true,done:true,ts:Date.now()})); }, [токен, ребёнок]);
await p2.evaluate(()=>{ /* без перезагрузки, чтобы не сработало забрать() */ });
await p2.evaluate(()=>{ localStorage.setItem('mt_pet', JSON.stringify({вид:'lamb', зёрна:77})); }); // правка → отправка
await p2.waitForTimeout(6000);
console.log('второе устройство после конфликта: ' + JSON.stringify(await p2.evaluate(()=>({
  урок1: !!localStorage.getItem('mt_lesson_1'), урок9: !!localStorage.getItem('mt_lesson_9'),
  ревизия: localStorage.getItem('mt_rev'), ушло: !!localStorage.getItem('mt_sync_at') }))));
// что теперь на сервере
const r = await fetch(B+'/api/v1/progress/'+ребёнок, { headers:{ Authorization:'Bearer '+токен } });
const d = await r.json();
console.log('на сервере: ревизия ' + d.data.rev + ', урок1=' + !!d.data.state.keys.mt_lesson_1 + ', урок9=' + !!d.data.state.keys.mt_lesson_9);
console.log('ОШИБОК: ' + errs.length); errs.slice(0,3).forEach(e=>console.log(e));
await b.close();
