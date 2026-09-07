// Тёмная тема на всех главных экранах: ничего не пропадает и не сливается.
import { chromium } from 'playwright';
const b = await chromium.launch({ executablePath:'/opt/pw-browsers/chromium', args:['--no-sandbox','--disable-gpu'] });
const p = await b.newPage({ viewport:{width:390,height:844}, deviceScaleFactor:2 });
const errs=[]; p.on('pageerror',e=>errs.push('PAGEERROR: '+e.message));
await p.route(u=>!u.href.startsWith('http://127.0.0.1'), r=>r.abort());
await p.goto('http://127.0.0.1:8777/index.html',{waitUntil:'load'});
await p.evaluate(()=>{ localStorage.clear(); localStorage.setItem('mt_onb','1'); localStorage.setItem('mt_auth','1');
  localStorage.setItem('mt_theme','dark'); localStorage.setItem('mt_music_off','1');
  localStorage.setItem('mt_kids','[{"name":"Соня","age":8,"img":"assets/img/avatars/star.jpg"}]');
  [1,2].forEach(n=>localStorage.setItem('mt_lesson_'+n, JSON.stringify({read:true,task:true,test:true,done:true,ts:Date.now()}))); });
await p.reload({waitUntil:'load'});
await p.waitForSelector('.splash--hide',{timeout:20000}).catch(()=>{});
await p.waitForTimeout(1000);
const низкийКонтраст = async (имя) => {
  const плохие = await p.evaluate(()=>{
    const яркость = (c) => { const m = c.match(/\d+/g); if(!m) return null;
      return (0.299*m[0] + 0.587*m[1] + 0.114*m[2]) / 255; };
    const плохо = [];
    document.querySelectorAll('.screen--active *').forEach(э=>{
      if (!э.offsetParent || !э.textContent.trim() || э.children.length) return;
      const s = getComputedStyle(э);
      const т = яркость(s.color);
      let фон = null, у = э;
      while (у && !фон) { const b = getComputedStyle(у).backgroundColor;
        if (b && !/rgba\(0, 0, 0, 0\)/.test(b)) фон = яркость(b); у = у.parentElement; }
      if (т === null || фон === null) return;
      if (Math.abs(т - фон) < 0.16) плохо.push((э.className||э.tagName) + ': ' + э.textContent.trim().slice(0,28));
    });
    return плохо.slice(0,4);
  });
  console.log(имя + ': ' + (плохие.length ? плохие.join(' | ') : 'контраст в порядке'));
};
for (const т of ['home','lessons','games','chats','profile']) {
  await p.evaluate((т)=>document.querySelector(`.nav__tab[data-tab="${т}"]`).click(), т);
  await p.waitForTimeout(500);
  await низкийКонтраст(т);
}
await p.evaluate(()=>document.querySelector('.nav__tab[data-tab="home"]').click());
await p.waitForTimeout(500);
await p.screenshot({path:'tema-home.png'});
await p.evaluate(()=>openChild(DEMO.children[0]));
await p.waitForTimeout(600);
await низкийКонтраст('ребёнок');
await p.screenshot({path:'tema-child.png'});
console.log('ОШИБОК: ' + errs.length); errs.slice(0,3).forEach(e=>console.log(e));
await b.close();
