// Снимки всех экранов на трёх ширинах в двух темах: смотрим глазами.
import { chromium } from 'playwright';
import fs from 'fs';
const ВЫХОД = '/tmp/mt_shots/';
fs.mkdirSync(ВЫХОД, { recursive: true });
const b = await chromium.launch({ executablePath:'/opt/pw-browsers/chromium', args:['--no-sandbox'] });

const ЭКРАНЫ = [
  ['home', async (p)=>p.evaluate(()=>document.querySelector('.nav__tab[data-tab="home"]').click())],
  ['lessons', async (p)=>p.evaluate(()=>document.querySelector('.nav__tab[data-tab="lessons"]').click())],
  ['lesson1', async (p)=>p.evaluate(()=>openLesson(1))],
  ['lesson1task', async (p)=>p.evaluate(()=>{ openLesson(1); setTimeout(()=>document.getElementById('lessonTask')?.scrollIntoView(),300); })],
  ['games', async (p)=>p.evaluate(()=>document.querySelector('.nav__tab[data-tab="games"]').click())],
  ['chats', async (p)=>p.evaluate(()=>document.querySelector('.nav__tab[data-tab="chats"]').click())],
  ['profile', async (p)=>p.evaluate(()=>document.querySelector('.nav__tab[data-tab="profile"]').click())],
  ['pet', async (p)=>p.evaluate(()=>{ if(typeof openPetScreen==='function') openPetScreen(); })],
  ['book', async (p)=>p.evaluate(()=>{ if(typeof openBook==='function') openBook(); })],
  ['reader', async (p)=>p.evaluate(()=>{ if(typeof openReader==='function') openReader(1); })],
];

for (const [ширина, тема] of [[320,'light'],[390,'light'],[430,'light'],[390,'dark']]) {
  const ctx = await b.newContext({ viewport:{width:ширина,height:900}, colorScheme: тема });
  const p = await ctx.newPage();
  await p.route(u=>!u.href.startsWith('http://127.0.0.1'), r=>r.abort());
  await p.goto('http://127.0.0.1:8777/index.html',{waitUntil:'load'});
  await p.evaluate(()=>{ localStorage.clear(); localStorage.setItem('mt_onb','1'); localStorage.setItem('mt_auth','1');
    localStorage.setItem('mt_name','Мария');
    localStorage.setItem('mt_kids', JSON.stringify([{name:'Соня',age:8,rank:'',streak:0,img:'assets/img/avatars/star.jpg'}]));
    for (let n=1;n<=3;n++) localStorage.setItem('mt_lesson_'+n, JSON.stringify({read:true,task:true,test:true,done:true,ts:Date.now()})); });
  await p.reload({waitUntil:'load'});
  await p.waitForSelector('.splash--hide',{timeout:20000}).catch(()=>{});
  await p.waitForTimeout(1200);
  for (const [имя, как] of ЭКРАНЫ) {
    await как(p).catch(()=>{});
    await p.waitForTimeout(700);
    const переполнение = await p.evaluate(()=>({
      шире: document.documentElement.scrollWidth > window.innerWidth + 1,
      страница: document.documentElement.scrollWidth, окно: window.innerWidth }));
    if (переполнение.шире) console.log(`ШИРЕ ОКНА: ${имя} ${ширина}px ${тема} -> ${переполнение.страница}`);
    await p.screenshot({ path: `${ВЫХОД}${ширина}-${тема}-${имя}.png`, fullPage: false });
  }
  await ctx.close();
}
console.log('снимков: ' + fs.readdirSync(ВЫХОД).length);
await b.close();
