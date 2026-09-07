import { chromium } from 'playwright';
const b = await chromium.launch({ executablePath:'/opt/pw-browsers/chromium', args:['--no-sandbox','--autoplay-policy=no-user-gesture-required']});
const p = await b.newPage({ viewport:{width:390,height:844} });
const мп3=[]; p.on('response', r=>{ if(/\.mp3/.test(r.url())) мп3.push(r.url().split('/').slice(-2).join('/')+' '+r.status()); });
const errs=[]; p.on('pageerror', e=>errs.push(e.message));
await p.goto('http://127.0.0.1:8777/index.html',{waitUntil:'load'});
await p.evaluate(()=>{ localStorage.setItem('mt_onb','1'); localStorage.setItem('mt_auth','1'); });
await p.reload({waitUntil:'load'});
await p.waitForSelector('.splash--hide',{timeout:20000}).catch(()=>{});
await p.waitForTimeout(600);
// следим за создаваемыми на лету плеерами
await p.evaluate(()=>{ window.__плееры=[]; const O=window.Audio; window.Audio=function(s){ const a=new O(s); window.__плееры.push(a); return a; }; });
await p.click('.nav__tab[data-tab="lessons"]'); await p.waitForTimeout(400);
await p.click('.lesson-item'); await p.waitForTimeout(800);
console.log('АДРЕС В КНОПКЕ: ' + await p.$eval('#lessonVoice', e=>e.dataset.src));
await p.click('#lessonVoice');
await p.waitForTimeout(3500);
const s = await p.evaluate(()=>({
  играет: document.getElementById('lessonVoice').classList.contains('lesson-voice--playing'),
  плееры: (window.__плееры||[]).map(a=>({ф:(a.currentSrc||'').split('/').pop(), t:+a.currentTime.toFixed(2), пауза:a.paused, длина:isFinite(a.duration)?+a.duration.toFixed(1):null})),
}));
console.log('СОСТОЯНИЕ: ' + JSON.stringify(s));
console.log('ЗАПРОСЫ MP3: ' + мп3.join(' | '));
console.log('ОШИБКИ: ' + errs.length);
await b.close();
