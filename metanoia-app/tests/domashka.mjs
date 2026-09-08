// Под домашним заданием честная подпись, пока школа без сервера.
import { chromium } from 'playwright';
const b = await chromium.launch({ executablePath:'/opt/pw-browsers/chromium', args:['--no-sandbox','--disable-gpu'] });
const p = await b.newPage({ viewport:{width:390,height:844} });
const errs=[]; p.on('pageerror',e=>errs.push('PAGEERROR: '+e.message));
await p.route(u=>!u.href.startsWith('http://127.0.0.1'), r=>r.abort());
await p.goto('http://127.0.0.1:8777/index.html',{waitUntil:'load'});
await p.evaluate(()=>{localStorage.clear(); localStorage.setItem('mt_onb','1'); localStorage.setItem('mt_auth','1');});
await p.reload({waitUntil:'load'});
await p.waitForSelector('.splash--hide',{timeout:20000}).catch(()=>{});
await p.waitForTimeout(800);
await p.evaluate(()=>openLesson(1)); await p.waitForTimeout(800);
console.log('подпись: ' + await p.evaluate(()=>document.querySelector('.hw-note')?.textContent?.slice(0,80) || 'нет'));
await p.setInputFiles('#hwFile', { name:'рисунок.png', mimeType:'image/png', buffer: Buffer.from('89504e470d0a1a0a','hex') });
await p.waitForTimeout(600);
console.log('сказали: ' + await p.evaluate(()=>document.querySelector('#toast,.toast')?.textContent?.slice(0,80)));
console.log('метка: ' + await p.evaluate(()=>document.getElementById('hwName')?.textContent));
console.log('ОШИБОК: ' + errs.length); errs.slice(0,3).forEach(e=>console.log(e));
await b.close();
