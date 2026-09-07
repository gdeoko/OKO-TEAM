// Видеокружочек: снимается, сохраняется, показывается видео после перезапуска.
import { chromium } from 'playwright';
const b = await chromium.launch({ executablePath:'/opt/pw-browsers/chromium',
  args:['--no-sandbox','--disable-background-networking','--use-fake-ui-for-media-stream','--use-fake-device-for-media-stream','--autoplay-policy=no-user-gesture-required'] });
const ctx = await b.newContext({ viewport:{width:390,height:844}, permissions:['microphone','camera'] });
const p = await ctx.newPage();
const errs=[]; p.on('pageerror', e=>errs.push('PAGEERROR: '+e.message));
await p.route(u => !u.href.startsWith('http://127.0.0.1'), r=>r.abort());
await p.goto('http://127.0.0.1:8777/index.html',{waitUntil:'load'});
await p.evaluate(()=>{ localStorage.clear(); localStorage.setItem('mt_onb','1'); localStorage.setItem('mt_auth','1'); });
await p.reload({waitUntil:'load'});
await p.waitForSelector('.splash--hide',{timeout:20000}).catch(()=>{});
await p.waitForTimeout(600);
await p.evaluate(()=>document.querySelector('.nav__tab[data-tab="chats"]').click());
await p.waitForTimeout(500);
await p.evaluate(()=>document.querySelectorAll('.chat-item')[1].click());
await p.waitForTimeout(700);
// короткий тап переключает режим на кружочек
await p.click('#cvVoice');
await p.waitForTimeout(400);
console.log('РЕЖИМ: ' + (await p.evaluate(()=>(document.getElementById('toast')||{}).textContent||'')));
const кн = await p.$('#cvVoice'); const кв = await кн.boundingBox();
await p.mouse.move(кв.x+кв.width/2, кв.y+кв.height/2);
await p.mouse.down(); await p.waitForTimeout(2500); await p.mouse.up();
await p.waitForTimeout(3000);
console.log('ПОСЛЕ СЪЁМКИ: ' + JSON.stringify(await p.evaluate(()=>{
  const м = JSON.parse(localStorage.getItem('mt_msgs2')||'{}');
  const все = Object.values(м).flat().filter(x=>x && x.circle);
  return { кружочков: все.length, тип: (все[0] && все[0].circle.url || '').slice(0,22) };
})));
await p.reload({waitUntil:'load'});
await p.waitForSelector('.splash--hide',{timeout:20000}).catch(()=>{});
await p.waitForTimeout(700);
await p.evaluate(()=>document.querySelector('.nav__tab[data-tab="chats"]').click());
await p.waitForTimeout(500);
await p.evaluate(()=>document.querySelectorAll('.chat-item')[1].click());
await p.waitForTimeout(900);
const круг = await p.$('#cvMsgs .msg__circle');
if (круг) { await круг.scrollIntoViewIfNeeded(); await круг.click(); }
await p.waitForTimeout(3500);
console.log('ПОСЛЕ ПЕРЕЗАПУСКА: ' + JSON.stringify(await p.evaluate(()=>{
  const v = document.querySelector('#cvMsgs .msg__circle-v');
  if (!v) return { есть:false };
  return { есть:true, адрес:(v.currentSrc||v.src||'').slice(0,22), длина: (v.src||'').length,
    время:+v.currentTime.toFixed(2), ширинаКадра: v.videoWidth, готовность: v.readyState,
    сеть: v.networkState, пауза: v.paused, ошибка: v.error ? v.error.code + ' ' + (v.error.message||'') : 'нет' };
})));
await p.screenshot({path:'shot-circle.png'});
console.log('ОШИБОК: ' + errs.length); errs.slice(0,3).forEach(e=>console.log(e));
await b.close();
