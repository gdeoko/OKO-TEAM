// Картинка внутри текста: книга школы собирается из пройденных уроков,
// и в каждой главе своя иллюстрация по ходу рассказа.
import { chromium } from 'playwright';
const b = await chromium.launch({ executablePath:'/opt/pw-browsers/chromium', args:['--no-sandbox'] });
const p = await b.newPage({ viewport:{width:390,height:844} });
const errs=[]; p.on('pageerror', e=>errs.push(e.message));
const битые=[]; p.on('response', r=>{ if(r.status()>=400 && /-a\.jpg/.test(r.url())) битые.push(r.url().split('/').pop()); });
await p.goto('http://127.0.0.1:8777/index.html',{waitUntil:'load'});
await p.evaluate(()=>{ localStorage.clear(); localStorage.setItem('mt_onb','1'); localStorage.setItem('mt_auth','1');
  for (let n=1;n<=105;n++) localStorage.setItem('mt_lesson_'+n, JSON.stringify({read:true,task:true,test:true,done:true,ts:Date.now()})); });
await p.reload({waitUntil:'load'}); await p.waitForTimeout(1600);
const итог=[];
for (const n of [3, 40, 75, 104]) {
  const r = await p.evaluate(async (n)=>{
    openReader(n); await new Promise(r=>setTimeout(r,1200));
    const кар = document.querySelector('#readerBody .lesson-pic img');
    if (!кар) return { урок:n, картинка:'нет', видна:0, вТексте:false };
    if (!кар.complete) await new Promise(r=>{ кар.onload=r; кар.onerror=r; setTimeout(r,2500); });
    const абзацы = [...document.querySelectorAll('#readerBody p')];
    const до = абзацы.filter(a=>a.compareDocumentPosition(кар.closest('figure')) & Node.DOCUMENT_POSITION_FOLLOWING).length;
    return { урок:n, картинка:(кар.currentSrc||кар.src).split('/').pop(), видна:кар.naturalWidth,
             вТексте: до > 0 && до < абзацы.length };
  }, n);
  итог.push(r);
}
итог.forEach(r=>console.log(JSON.stringify(r)));
const плохо = итог.filter(r=>r.картинка==='нет' || r.видна<400 || !r.вТексте).length + битые.length;
console.log('битых файлов: ' + (битые.length? битые.join(', ') : 'нет'));
console.log('ОШИБОК: ' + (плохо + errs.length));
errs.slice(0,3).forEach(e=>console.log(e));
await b.close();
