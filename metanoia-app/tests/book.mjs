// Книга: наполняется пройденными уроками, с картинками и без озвучки.
import { chromium } from 'playwright';
const b = await chromium.launch({ executablePath:'/opt/pw-browsers/chromium', args:['--no-sandbox','--disable-background-networking','--disable-gpu'] });
const p = await b.newPage({ viewport:{width:390,height:844} });
const errs=[]; p.on('pageerror', e=>errs.push('PAGEERROR: '+e.message));
await p.route(u => !u.href.startsWith('http://127.0.0.1'), r=>r.abort());
await p.goto('http://127.0.0.1:8777/index.html',{waitUntil:'load'});
await p.evaluate(()=>{ localStorage.clear(); localStorage.setItem('mt_onb','1'); localStorage.setItem('mt_auth','1'); });
await p.reload({waitUntil:'load'});
await p.waitForSelector('.splash--hide',{timeout:20000}).catch(()=>{});
await p.waitForTimeout(800);
const пусто = await p.evaluate(async ()=>{ const п=(м)=>new Promise(r=>setTimeout(r,м));
  openBook(); await п(500);
  return (document.getElementById('bookToc').innerText||'').replace(/\s+/g,' ').slice(0,80); });
console.log('КНИГА БЕЗ ПРОЙДЕННЫХ: ' + пусто);
const полно = await p.evaluate(async ()=>{ const п=(м)=>new Promise(r=>setTimeout(r,м));
  [1,2,3].forEach(n=>localStorage.setItem('mt_lesson_'+n, JSON.stringify({read:true,task:true,test:true,done:true,ts:Date.now()})));
  openBook(); await п(500);
  const глав = document.querySelectorAll('#bookToc [data-chapter]').length;
  document.querySelector('#bookToc [data-chapter]').click(); await п(700);
  const тело = document.getElementById('readerBody');
  return { глав, картинок: тело.querySelectorAll('img').length,
    звука: tело_звук(), текста: (тело.innerText||'').length };
  function tело_звук(){ return document.querySelectorAll('[data-screen="reader"] audio, #readerBody audio').length; }
});
console.log('КНИГА С ТРЕМЯ УРОКАМИ: ' + JSON.stringify(полно));
console.log('ОШИБОК: ' + errs.length); errs.slice(0,3).forEach(e=>console.log(e));
await b.close();
