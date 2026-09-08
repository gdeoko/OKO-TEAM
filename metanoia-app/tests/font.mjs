// Шрифты свои, из папки проекта: наружу приложение не ходит.
import { chromium } from 'playwright';
const b = await chromium.launch({ executablePath:'/opt/pw-browsers/chromium', args:['--no-sandbox'] });
const p = await b.newPage({ viewport:{width:390,height:844} });
const шрифты=[]; p.on('response', r=>{ if(r.url().includes('.woff2')) шрифты.push(r.url().split('/').pop()+' '+r.status()); });
const внешние=[]; p.on('request', r=>{ if(!r.url().startsWith('http://127.0.0.1') && !r.url().startsWith('data:')) внешние.push(r.url().slice(0,70)); });
await p.goto('http://127.0.0.1:8777/index.html',{waitUntil:'load'});
await p.evaluate(()=>{ localStorage.setItem('mt_onb','1'); localStorage.setItem('mt_auth','1'); });
await p.reload({waitUntil:'load'});
await p.waitForTimeout(3000);
console.log('ЗАГРУЖЕНО ШРИФТОВ: ' + шрифты.length + ' | ' + шрифты.slice(0,4).join(', '));
console.log(await p.evaluate(()=>{
  const t=document.querySelector('.hd__title,h1,h2');
  return 'ЗАГОЛОВОК РИСУЕТСЯ: ' + (t?getComputedStyle(t).fontFamily:'нет') + ' | готовых начертаний: ' + document.fonts.size;
}));
// Наружу школа ходит только за скриптом мини-приложения Телеграма, всё
// остальное своё. Если сюда попадёт что-то ещё, проверка это покажет.
const чужие = внешние.filter(u=>!u.startsWith('https://telegram.org/'));
console.log('ЛИШНИХ ЗАПРОСОВ НАРУЖУ: ' + чужие.length + (чужие.length? ' ' + чужие.join(', '):''));
console.log('ОШИБОК: ' + чужие.length);
await b.close();
