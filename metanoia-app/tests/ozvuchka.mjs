// Озвучка: у каждого урока свой файл, он открывается и играет.
import { chromium } from 'playwright';
const b = await chromium.launch({ executablePath:'/opt/pw-browsers/chromium', args:['--no-sandbox','--disable-gpu'] });
const p = await b.newPage({ viewport:{width:390,height:844} });
const errs=[]; p.on('pageerror',e=>errs.push('PAGEERROR: '+e.message));
const плохие=[]; p.on('response', r=>{ if(r.status()>=400 && /audio/.test(r.url())) плохие.push(r.url().split('/').pop()); });
await p.route(u=>!u.href.startsWith('http://127.0.0.1'), r=>r.abort());
await p.goto('http://127.0.0.1:8777/index.html',{waitUntil:'load'});
await p.evaluate(()=>{localStorage.clear(); localStorage.setItem('mt_onb','1'); localStorage.setItem('mt_auth','1');});
await p.reload({waitUntil:'load'});
await p.waitForSelector('.splash--hide',{timeout:20000}).catch(()=>{});
await p.waitForTimeout(800);
// проверяем, что адреса разные и файлы отдаются
const итог = await p.evaluate(async ()=>{
  const адреса = new Set(); const нет = [];
  for (const n of [1, 12, 35, 36, 60, 88, 105]) {
    const у = lessonAudio(n);
    адреса.add(у);
    const r = await fetch(у, { method: 'HEAD' });
    if (!r.ok) нет.push(n + ' → ' + r.status);
  }
  return { разных: адреса.size, нет };
});
console.log('разных адресов озвучки: ' + итог.разных + ' из 7');
console.log('не отдались: ' + (итог.нет.length ? итог.нет.join(', ') : 'нет'));
// живое воспроизведение первого урока
await p.evaluate(()=>openLesson(1)); await p.waitForTimeout(700);
await p.click('#lessonVoice'); await p.waitForTimeout(2500);
// Плеер создаётся через new Audio и в дереве не лежит, поэтому смотрим
// на кнопку: она помечается классом, пока запись играет.
console.log('кнопка в состоянии «играет»: ' + await p.evaluate(()=>
  document.getElementById('lessonVoice')?.classList.contains('lesson-voice--playing')));
console.log('подпись кнопки: ' + await p.evaluate(()=>document.getElementById('lessonVoice')?.innerText.trim().slice(0,40)));
console.log('битых файлов: ' + (плохие.length ? плохие.join(',') : 'нет'));
console.log('ОШИБОК: ' + errs.length); errs.slice(0,3).forEach(e=>console.log(e));
await b.close();
