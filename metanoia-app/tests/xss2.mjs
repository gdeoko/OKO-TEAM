// Разметка в сообщении чата и в комментарии не должна выполняться.
import { chromium } from 'playwright';
const b = await chromium.launch({ executablePath:'/opt/pw-browsers/chromium', args:['--no-sandbox','--disable-gpu'] });
const p = await b.newPage({ viewport:{width:390,height:844} });
const errs=[]; p.on('pageerror',e=>errs.push('PAGEERROR: '+e.message));
let диалог = false; p.on('dialog', d=>{ диалог = true; d.dismiss(); });
await p.route(u=>!u.href.startsWith('http://127.0.0.1'), r=>r.abort());
await p.goto('http://127.0.0.1:8777/index.html',{waitUntil:'load'});
await p.evaluate(()=>{ localStorage.clear(); localStorage.setItem('mt_onb','1'); localStorage.setItem('mt_auth','1'); });
await p.reload({waitUntil:'load'});
await p.waitForSelector('.splash--hide',{timeout:20000}).catch(()=>{});
await p.waitForTimeout(800);
await p.click('.nav__tab[data-tab="chats"]'); await p.waitForTimeout(400);
await p.click('.chat-item >> nth=1'); await p.waitForTimeout(600);
await p.fill('#cvField', '<img src=y onerror="window.__взлом2=1">привет');
await p.click('#cvSend'); await p.waitForTimeout(800);
console.log('сообщение на экране: ' + await p.evaluate(()=>document.getElementById('cvMsgs').innerText.slice(-60).replace(/\s+/g,' ')));
console.log('скрипт из сообщения выполнился: ' + await p.evaluate(()=>!!window.__взлом2));
// после перезагрузки тоже
await p.reload({waitUntil:'load'});
await p.waitForSelector('.splash--hide',{timeout:20000}).catch(()=>{});
await p.waitForTimeout(700);
await p.click('.nav__tab[data-tab="chats"]'); await p.waitForTimeout(400);
await p.click('.chat-item >> nth=1'); await p.waitForTimeout(700);
console.log('после перезагрузки выполнился: ' + await p.evaluate(()=>!!window.__взлом2));
console.log('диалог: ' + диалог + ', ОШИБОК: ' + errs.length); errs.slice(0,3).forEach(e=>console.log(e));
await b.close();
