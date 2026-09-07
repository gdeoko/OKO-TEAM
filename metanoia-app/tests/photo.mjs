// Тяжёлый снимок в чате: должен ужиматься и сохраняться, не ломая память.
import { chromium } from 'playwright';
const b = await chromium.launch({ executablePath:'/opt/pw-browsers/chromium', args:['--no-sandbox','--disable-background-networking','--disable-gpu'] });
const p = await b.newPage({ viewport:{width:390,height:844} });
const errs=[]; p.on('pageerror', e=>errs.push('PAGEERROR: '+e.message));
await p.route(u => !u.href.startsWith('http://127.0.0.1'), r=>r.abort());
await p.goto('http://127.0.0.1:8777/index.html',{waitUntil:'load'});
await p.evaluate(()=>{ localStorage.clear(); localStorage.setItem('mt_onb','1'); localStorage.setItem('mt_auth','1'); });
await p.reload({waitUntil:'load'});
await p.waitForSelector('.splash--hide',{timeout:20000}).catch(()=>{});
await p.waitForTimeout(600);
await p.evaluate(()=>document.querySelector('.nav__tab[data-tab="chats"]').click());
await p.waitForTimeout(500);
await p.evaluate(()=>document.querySelectorAll('.chat-item')[1].click());
await p.waitForTimeout(700);

// большой снимок 3000x2000, как с телефона
const байты = await p.evaluate(async ()=>{
  const c=document.createElement('canvas'); c.width=3000; c.height=2000;
  const g=c.getContext('2d');
  const gr=g.createLinearGradient(0,0,3000,2000); gr.addColorStop(0,'#1A3A52'); gr.addColorStop(1,'#C97064');
  g.fillStyle=gr; g.fillRect(0,0,3000,2000);
  for(let i=0;i<400;i++){ g.fillStyle='rgba(212,165,116,'+Math.random()+')'; g.fillRect(Math.random()*3000, Math.random()*2000, 40, 40); }
  const d=c.toDataURL('image/jpeg',0.95);
  window.__большой=d;
  return d.length;
});
console.log('ИСХОДНЫЙ СНИМОК: ' + Math.round(байты/1024) + ' КБ в base64');

const итог = await p.evaluate(async ()=>{
  const пауза=(м)=>new Promise(r=>setTimeout(r,м));
  const дв = await (await fetch(window.__большой)).blob();
  const файл = new File([дв], 'снимок.jpg', {type:'image/jpeg'});
  const дт = new DataTransfer(); дт.items.add(файл);
  const поле = document.getElementById('cvPhotoInput');
  поле.files = дт.files;
  поле.dispatchEvent(new Event('change', {bubbles:true}));
  await пауза(2500);
  const сохранено = localStorage.getItem('mt_msgs2') || '';
  const снимки = (document.querySelectorAll('#cvMsgs img') || []).length;
  return { вПамяти: Math.round(сохранено.length/1024) + ' КБ', снимковНаЭкране: снимки };
});
console.log('ПОСЛЕ ОТПРАВКИ: ' + JSON.stringify(итог));
console.log('ОШИБОК: ' + errs.length); errs.slice(0,3).forEach(e=>console.log(e));
await b.close();
