// Обрезанный текст: ищем места, где слово не влезло и его срезало.
// Такое ловится только измерением: на глаз это видно не на каждом экране.
import { chromium } from 'playwright';
const b = await chromium.launch({ executablePath:'/opt/pw-browsers/chromium', args:['--no-sandbox'] });
const ЭКРАНЫ = [
  ['главная', ()=>document.querySelector('.nav__tab[data-tab="home"]').click()],
  ['уроки', ()=>document.querySelector('.nav__tab[data-tab="lessons"]').click()],
  ['урок 1', ()=>openLesson(1)],
  ['урок 4', ()=>openLesson(4)],
  ['игры', ()=>document.querySelector('.nav__tab[data-tab="games"]').click()],
  ['чаты', ()=>document.querySelector('.nav__tab[data-tab="chats"]').click()],
  ['профиль', ()=>document.querySelector('.nav__tab[data-tab="profile"]').click()],
  ['книга', ()=>{ if(typeof openBook==='function') openBook(); }],
  ['читалка', ()=>{ if(typeof openReader==='function') openReader(1); }],
  ['рейтинг', ()=>{ if(typeof openRatingScreen==='function') openRatingScreen(); }],
  ['сертификаты', ()=>{ if(typeof openCertificates==='function') openCertificates(); }],
];
let всего = 0;
for (const ширина of [320, 390, 430]) {
  const ctx = await b.newContext({ viewport:{width:ширина,height:900} });
  const p = await ctx.newPage();
  await p.route(u=>!u.href.startsWith('http://127.0.0.1'), r=>r.abort());
  await p.goto('http://127.0.0.1:8777/index.html',{waitUntil:'load'});
  await p.evaluate(()=>{ localStorage.clear(); localStorage.setItem('mt_onb','1'); localStorage.setItem('mt_auth','1');
    localStorage.setItem('mt_name','Мария');
    localStorage.setItem('mt_kids', JSON.stringify([{name:'Соня',age:8,rank:'',streak:0,img:'assets/img/avatars/star.jpg'}]));
    for (let n=1;n<=4;n++) localStorage.setItem('mt_lesson_'+n, JSON.stringify({read:true,task:true,test:true,done:true,ts:Date.now()})); });
  await p.reload({waitUntil:'load'});
  await p.waitForSelector('.splash--hide',{timeout:20000}).catch(()=>{});
  await p.waitForTimeout(1000);
  for (const [имя, как] of ЭКРАНЫ) {
    await p.evaluate(как).catch(()=>{});
    await p.waitForTimeout(500);
    const срезано = await p.evaluate(()=>{
      const плохие = [];
      for (const э of document.querySelectorAll('.screen--active *, .screen--active')) {
        const s = getComputedStyle(э);
        if (s.display === 'none' || s.visibility === 'hidden') continue;
        const прячет = s.overflowX === 'hidden' || s.overflow === 'hidden';
        const клампит = s.webkitLineClamp && s.webkitLineClamp !== 'none';
        if (!прячет || клампит) continue;          // многоточие в две строки это норма
        // Многоточие это осознанный приём: строку обрезали красиво.
        // Ищем только жёсткий срез, когда слово обрывается без знака.
        if (s.textOverflow === 'ellipsis') continue;
        if (э.scrollWidth > э.clientWidth + 2 && э.clientWidth > 0) {
          const т = (э.textContent || '').trim().slice(0, 40);
          if (т) плохие.push(`${э.className || э.tagName}: «${т}» (${э.scrollWidth} в ${э.clientWidth})`);
        }
      }
      return [...new Set(плохие)];
    });
    if (срезано.length) {
      всего += срезано.length;
      console.log(`--- ${имя} @${ширина}px`);
      срезано.slice(0, 5).forEach((с)=>console.log('    ' + с));
    }
  }
  await ctx.close();
}
console.log('ОШИБОК: ' + всего);
await b.close();
