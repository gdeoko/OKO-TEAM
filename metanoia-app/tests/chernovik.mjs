// Ответы в проверке знаний не пропадают, если ребёнка отвлекли.
import { chromium } from 'playwright';
const b = await chromium.launch({ executablePath:'/opt/pw-browsers/chromium', args:['--no-sandbox','--disable-gpu'] });
const p = await b.newPage({ viewport:{width:390,height:844} });
const errs=[]; p.on('pageerror',e=>errs.push('PAGEERROR: '+e.message));
await p.route(u=>!u.href.startsWith('http://127.0.0.1'), r=>r.abort());
await p.goto('http://127.0.0.1:8777/index.html',{waitUntil:'load'});
await p.evaluate(()=>{ localStorage.clear(); localStorage.setItem('mt_onb','1'); localStorage.setItem('mt_auth','1');
  for (let n=1;n<=35;n++) localStorage.setItem('mt_lesson_'+n, JSON.stringify({read:true,task:true,test:true,done:true,ts:Date.now()})); });
await p.reload({waitUntil:'load'});
await p.waitForSelector('.splash--hide',{timeout:20000}).catch(()=>{});
await p.waitForTimeout(900);
await p.evaluate(()=>openExam(0)); await p.waitForTimeout(800);
console.log('вопросов: ' + await p.evaluate(()=>document.querySelectorAll('#examQuiz .q').length));
// отвечаем на первые пять
await p.evaluate(()=>{ for (let i=0;i<5;i++){ const п=document.querySelector(`input[name="ex${i}"]`); if(п){ п.checked=true; п.dispatchEvent(new Event('change',{bubbles:true})); } } });
await p.waitForTimeout(400);
console.log('черновик: ' + await p.evaluate(()=>localStorage.getItem('mt_exam_draft_0')?.slice(0,60)));
// уходим и возвращаемся через перезагрузку
await p.reload({waitUntil:'load'});
await p.waitForSelector('.splash--hide',{timeout:20000}).catch(()=>{});
await p.waitForTimeout(900);
await p.evaluate(()=>openExam(0)); await p.waitForTimeout(900);
console.log('отмечено после возврата: ' + await p.evaluate(()=>document.querySelectorAll('#examQuiz input:checked').length));
console.log('подсказка: ' + await p.evaluate(()=>document.querySelector('.toast, #toast')?.textContent?.slice(0,60) || 'нет'));
// досдаём и проверяем, что черновик убран
await p.evaluate(()=>{ document.querySelectorAll('#examQuiz .q').forEach((q,i)=>{ const п=q.querySelector('input'); if(п && !q.querySelector('input:checked')){ п.checked=true; п.dispatchEvent(new Event('change',{bubbles:true})); } }); });
await p.evaluate(()=>document.getElementById('examCheck').click());
await p.waitForTimeout(900);
console.log('после сдачи черновик: ' + await p.evaluate(()=>localStorage.getItem('mt_exam_draft_0') || 'убран'));
console.log('результат: ' + await p.evaluate(()=>document.getElementById('examResult')?.textContent?.slice(0,60)));
console.log('ОШИБОК: ' + errs.length); errs.slice(0,3).forEach(e=>console.log(e));
await b.close();
