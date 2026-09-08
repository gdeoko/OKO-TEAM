// Витрина одним файлом: шрифты внутри, наружу не ходим.
import { chromium } from 'playwright';
const b = await chromium.launch({ executablePath:'/opt/pw-browsers/chromium', args:['--no-sandbox'] });
const p = await b.newPage({ viewport:{width:390,height:844} });
const наружу=[]; p.on('request', r=>{ if(!r.url().startsWith('http://127.0.0.1') && !r.url().startsWith('data:')) наружу.push(r.url().slice(0,60)); });
await p.goto('http://127.0.0.1:8777/_build.html',{waitUntil:'load'});
await p.waitForTimeout(2500);
const шрифт = await p.evaluate(async ()=>{
  await document.fonts.ready;
  const h=document.querySelector('h1,.screen-title,.hero__title');
  return { заголовок: h? getComputedStyle(h).fontFamily : 'нет',
           загружено: [...document.fonts].filter(f=>f.status==='loaded').map(f=>f.family+' '+f.weight).slice(0,4) };
});
console.log('ШРИФТЫ: ' + JSON.stringify(шрифт));
console.log('ЗАПРОСОВ НАРУЖУ: ' + наружу.length + (наружу.length? ' ' + наружу.join(', ') : ''));
await b.close();
