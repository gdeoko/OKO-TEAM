// Голосовое сообщение должно оставаться в переписке после перезапуска.
import { chromium } from 'playwright';
const b = await chromium.launch({ executablePath:'/opt/pw-browsers/chromium',
  args:['--no-sandbox','--disable-background-networking','--disable-gpu','--use-fake-ui-for-media-stream','--use-fake-device-for-media-stream','--autoplay-policy=no-user-gesture-required'] });
const ctx = await b.newContext({ viewport:{width:390,height:844}, permissions:['microphone'] });
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

// зажимаем кнопку голосового на пару секунд
const кн = await p.$('#cvVoice');
const кв = await кн.boundingBox();
await p.mouse.move(кв.x+кв.width/2, кв.y+кв.height/2);
await p.mouse.down();
await p.waitForTimeout(2500);
await p.mouse.up();
await p.waitForTimeout(2500);

const до = await p.evaluate(()=>{
  const м = JSON.parse(localStorage.getItem('mt_msgs2')||'{}');
  const все = Object.values(м).flat().filter(x=>x && x.voice);
  return { записей: все.length, начало: (все[0] && все[0].voice.url || '').slice(0,20), вПамятиКБ: Math.round((localStorage.getItem('mt_msgs2')||'').length/1024) };
});
console.log('ПОСЛЕ ЗАПИСИ: ' + JSON.stringify(до));

await p.reload({waitUntil:'load'});
await p.waitForSelector('.splash--hide',{timeout:20000}).catch(()=>{});
await p.waitForTimeout(700);
await p.evaluate(()=>document.querySelector('.nav__tab[data-tab="chats"]').click());
await p.waitForTimeout(500);
await p.evaluate(()=>document.querySelectorAll('.chat-item')[1].click());
await p.waitForTimeout(900);
await p.evaluate(()=>{ window.__п=[]; const O=window.Audio; window.Audio=function(s){ const a=new O(s); window.__п.push(a); return a; }; });
await p.evaluate(()=>{ const b=document.querySelector('#cvMsgs .msg--mine .msg__voice-play'); if(b) b.click(); });
await p.waitForTimeout(2500);
const после = await p.evaluate(()=>({
  плееров: (window.__п||[]).length,
  начало: ((window.__п||[])[0] && ((window.__п[0].currentSrc||window.__п[0].src)||'')).slice(0,24),
  время: (window.__п||[])[0] ? +window.__п[0].currentTime.toFixed(2) : null,
  пауза: (window.__п||[])[0] ? window.__п[0].paused : null,
  тост: (document.getElementById('toast')||{}).textContent||'',
}));
console.log('ПОСЛЕ ПЕРЕЗАПУСКА: ' + JSON.stringify(после));
console.log('ОШИБОК: ' + errs.length); errs.slice(0,3).forEach(e=>console.log(e));
await b.close();
