// Прикрепить задание, пожаловаться, заблокировать: должны работать по-настоящему.
import { chromium } from 'playwright';
const b = await chromium.launch({ executablePath:'/opt/pw-browsers/chromium', args:['--no-sandbox','--disable-background-networking','--disable-gpu'] });
const p = await b.newPage({ viewport:{width:390,height:844} });
const errs=[]; p.on('pageerror', e=>errs.push('PAGEERROR: '+e.message));
await p.route(u => !u.href.startsWith('http://127.0.0.1'), r=>r.abort());
await p.goto('http://127.0.0.1:8777/index.html',{waitUntil:'load'});
await p.evaluate(()=>{ localStorage.clear(); localStorage.setItem('mt_onb','1'); localStorage.setItem('mt_auth','1'); });
await p.reload({waitUntil:'load'});
await p.waitForSelector('.splash--hide',{timeout:20000}).catch(()=>{});
await p.waitForTimeout(600);

// домашнее задание
await p.evaluate(()=>document.querySelector('.nav__tab[data-tab="lessons"]').click());
await p.waitForTimeout(500);
await p.evaluate(()=>document.querySelector('.lesson-item').click());
await p.waitForTimeout(800);
const файл = await p.$('#hwFile');
if (файл) {
  await файл.setInputFiles({ name:'домашка.png', mimeType:'image/png', buffer: Buffer.from('89504e470d0a1a0a','hex') });
  await p.waitForTimeout(700);
} else console.log('поля файла нет');
console.log('ПРИКРЕПИТЬ ЗАДАНИЕ: ' + JSON.stringify(await p.evaluate(()=>({
  память: localStorage.getItem('mt_lesson_1'),
  подпись: ((document.getElementById('hwUpload')||{}).innerText||'').trim().slice(0,40),
  метка: ((document.getElementById('hwName')||{}).textContent||'').slice(0,40),
}))));

// жалоба и блокировка в переписке
await p.evaluate(()=>document.querySelector('.nav__tab[data-tab="chats"]').click());
await p.waitForTimeout(500);
await p.evaluate(()=>document.querySelectorAll('.chat-item')[1].click());
await p.waitForTimeout(700);
// открываем меню действий долгим нажатием на чужое сообщение
const цель = await p.$('#cvMsgs .msg:not(.msg--mine)');
if (цель) { const кв = await цель.boundingBox(); await p.mouse.move(кв.x+кв.width/2, кв.y+кв.height/2); await p.mouse.down(); await p.waitForTimeout(700); await p.mouse.up(); }
await p.waitForTimeout(500);
const кнопки = await p.evaluate(()=>[...document.querySelectorAll('button, .ma__row')].filter(e=>{const r=e.getBoundingClientRect();return r.width>0;}).map(e=>(e.innerText||'').trim()).filter(t=>/жалоб|Пожалов|Заблок/i.test(t)));
console.log('КНОПКИ БЕЗОПАСНОСТИ ВИДНЫ: ' + JSON.stringify(кнопки));
await p.click('#maReport');
await p.waitForTimeout(600);
console.log('ПОСЛЕ ЖАЛОБЫ: ' + JSON.stringify(await p.evaluate(()=>({
  жалобы: localStorage.getItem('mt_reports'), блок: localStorage.getItem('mt_blocked'),
  тост: (document.getElementById('toast')||{}).textContent||'',
}))));
console.log('ОШИБОК: ' + errs.length); errs.slice(0,3).forEach(e=>console.log(e));
await b.close();
