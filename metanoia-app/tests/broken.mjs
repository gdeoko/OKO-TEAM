// Мусор в памяти браузера не должен ронять приложение.
import { chromium } from 'playwright';
const b = await chromium.launch({ executablePath:'/opt/pw-browsers/chromium', args:['--no-sandbox','--disable-background-networking','--disable-gpu'] });
const p = await b.newPage({ viewport:{width:390,height:844} });
const errs=[]; p.on('pageerror', e=>errs.push('PAGEERROR: '+e.message));
await p.route(u => !u.href.startsWith('http://127.0.0.1'), r=>r.abort());
await p.goto('http://127.0.0.1:8777/index.html',{waitUntil:'load'});
await p.evaluate(()=>{
  localStorage.clear();
  localStorage.setItem('mt_onb','1'); localStorage.setItem('mt_auth','1');
  // всё, что могло испортиться или прийти со старой версии
  localStorage.setItem('mt_pet','{"зёрна":21}');
  localStorage.setItem('mt_kids','не json вовсе');
  localStorage.setItem('mt_likes','[1,2,3]');
  localStorage.setItem('mt_msgs2','"строка вместо объекта"');
  localStorage.setItem('mt_react2','null');
  localStorage.setItem('mt_quest','{"а":1}');
  localStorage.setItem('mt_blocked','7');
  localStorage.setItem('mt_lesson_1','}{');
  localStorage.setItem('mt_plays','"нет"');
  localStorage.setItem('mt_exam_0','сломано');
  localStorage.setItem('mt_wishes','{}');
  localStorage.setItem('mt_comments','[]');
});
await p.reload({waitUntil:'load'});
await p.waitForSelector('.splash--hide',{timeout:20000}).catch(()=>{});
await p.waitForTimeout(800);
for (const t of ['home','lessons','games','chats','profile']) {
  await p.evaluate((t)=>document.querySelector(`.nav__tab[data-tab="${t}"]`)?.click(), t);
  await p.waitForTimeout(500);
}
// экраны, которые читают эти ключи
const открыли = await p.evaluate(async ()=>{
  const пауза=(м)=>new Promise(r=>setTimeout(r,м));
  const шаги=[];
  try { openCertificates(); шаги.push('сертификаты'); } catch(e) { шаги.push('сертификаты СБОЙ '+e.message.slice(0,40)); }
  await пауза(300);
  try { renderWReport(); шаги.push('отчёт'); } catch(e) { шаги.push('отчёт СБОЙ '+e.message.slice(0,40)); }
  await пауза(300);
  try { openAlbumScreen(); шаги.push('альбом'); } catch(e) { шаги.push('альбом СБОЙ '+e.message.slice(0,40)); }
  await пауза(300);
  try { openPetScreen(); шаги.push('друг'); } catch(e) { шаги.push('друг СБОЙ '+e.message.slice(0,40)); }
  await пауза(300);
  try { openShop(); шаги.push('лавка'); } catch(e) { шаги.push('лавка СБОЙ '+e.message.slice(0,40)); }
  return шаги;
});
console.log('ЭКРАНЫ: ' + открыли.join(' | '));
console.log('ОШИБОК: ' + errs.length); errs.slice(0,5).forEach(e=>console.log(e));
await b.close();
