import { chromium } from 'playwright';
const b = await chromium.launch({ executablePath:'/opt/pw-browsers/chromium', args:['--no-sandbox'] });
const p = await b.newPage({ viewport:{width:390,height:844} });
const errs=[]; p.on('pageerror', e=>errs.push(e.message));
await p.goto('http://127.0.0.1:8777/index.html',{waitUntil:'domcontentloaded'});
await p.evaluate(()=>{ localStorage.setItem('mt_onb','1'); localStorage.setItem('mt_auth','1'); });
await p.reload({waitUntil:'domcontentloaded'});
await p.waitForSelector('.splash--hide',{timeout:20000}).catch(()=>{});
await p.waitForTimeout(600);
await p.click('.nav__tab[data-tab="chats"]'); await p.waitForTimeout(500);
await p.click('.chat-item >> nth=1'); await p.waitForTimeout(700); // первый чат только для чтения, объявления школы
// панель стикеров
await p.click('#cvStickerBtn'); await p.waitForTimeout(600);
const стикеров = (await p.$$('#cvStickers button, #cvStickers img, #cvStickers .cv-stickers__i')).length;
console.log('СТИКЕРОВ В ПАНЕЛИ: ' + стикеров);
await p.click('#cvStickerBtn'); await p.waitForTimeout(300);
// стоп-слово
await p.fill('#cvField', 'ты дурак');
await p.waitForTimeout(200);
await p.click('#cvSend');
await p.waitForTimeout(600);
const тост = await p.textContent('#toast').catch(()=>'');
console.log('СТОП-СЛОВО: ' + (тост||'').trim().slice(0,120));
// нормальное сообщение
await p.fill('#cvField', 'Спасибо за урок');
await p.waitForTimeout(200);
await p.click('#cvSend');
await p.waitForTimeout(600);
const мои = (await p.$$('.msg--mine, .msg.mine, .cv-msg--mine')).length;
console.log('МОИХ СООБЩЕНИЙ: ' + мои);
console.log('ПОСЛЕДНЕЕ: ' + (await p.evaluate(()=>{ const l=[...document.querySelectorAll('#cvBody *')].filter(e=>e.textContent.includes('Спасибо за урок')); return l.length ? 'есть' : 'нет'; })));
await p.screenshot({ path:'shot-chat.png' });
console.log('ОШИБКИ: ' + errs.length); errs.slice(0,4).forEach(e=>console.log(e));
await b.close();
