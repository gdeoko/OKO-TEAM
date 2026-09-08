// Все игры: своя картинка, музыка на время игры, продолжение после конца.
import { chromium } from 'playwright';
const b = await chromium.launch({ executablePath:'/opt/pw-browsers/chromium', args:['--no-sandbox','--autoplay-policy=no-user-gesture-required'] });
const p = await b.newPage({ viewport:{width:390,height:844} });
const errs=[]; p.on('pageerror', e=>errs.push(e.message));
await p.goto('http://127.0.0.1:8777/index.html',{waitUntil:'load'});
await p.evaluate(()=>{ localStorage.clear(); localStorage.setItem('mt_onb','1'); localStorage.setItem('mt_auth','1'); });
await p.reload({waitUntil:'load'}); await p.waitForTimeout(1500);
const свод = await p.evaluate(()=>{
  const список = (typeof GAMES!=='undefined' ? GAMES : []);
  const без = список.filter(g=>!g.img && !g.cover && !g.icon).map(g=>g.id||g.key||g.name);
  return { всего: список.length, безКартинки: без };
});
console.log('ИГР: ' + свод.всего + ' | без картинки: ' + (свод.безКартинки.length? свод.безКартинки.join(', ') : 'нет'));
await p.evaluate(()=>document.querySelector('.nav__tab[data-tab="games"]').click());
await p.waitForTimeout(600);
const плитки = await p.evaluate(()=>{
  const к=[...document.querySelectorAll('.gcard')];
  return { плиток: к.length, безФона: к.filter(e=>{
    const s=getComputedStyle(e); const есть = /url\(/.test(s.backgroundImage) || e.querySelector('img');
    return !есть; }).length };
});
console.log('ПЛИТОК ИГР: ' + JSON.stringify(плитки));
console.log('ОШИБОК: ' + (errs.length + свод.безКартинки.length + плитки.безФона));
errs.slice(0,3).forEach(e=>console.log(e));
await b.close();
