// Скачивание сертификата и альбома, звук стиха дня.
import { chromium } from 'playwright';
const b = await chromium.launch({ executablePath:'/opt/pw-browsers/chromium', args:['--no-sandbox','--autoplay-policy=no-user-gesture-required','--disable-background-networking','--autoplay-policy=no-user-gesture-required'] });
const ctx = await b.newContext({ viewport:{width:390,height:844}, acceptDownloads:true });
const p = await ctx.newPage();
const errs=[]; p.on('pageerror', e=>errs.push('PAGEERROR: '+e.message));
await p.route(u => !u.href.startsWith('http://127.0.0.1'), r=>r.abort());
await p.goto('http://127.0.0.1:8777/index.html',{waitUntil:'load'});
await p.evaluate(()=>{ localStorage.clear(); localStorage.setItem('mt_onb','1'); localStorage.setItem('mt_auth','1'); localStorage.setItem('mt_name','Соня');
  localStorage.setItem('mt_exam_0', JSON.stringify({pct:95, ts: Date.now()})); });
await p.reload({waitUntil:'load'});
await p.waitForSelector('.splash--hide',{timeout:20000}).catch(()=>{});
await p.waitForTimeout(700);

// сертификат
await p.evaluate(()=>{ openCertificates(); });
await p.waitForTimeout(500);
await p.evaluate(()=>{ document.querySelector('#certGrid [data-cert="b1"]').click(); });
await p.waitForTimeout(800);
const кнопки = await p.evaluate(()=>[...document.querySelectorAll('[data-screen="certview"] button, #certView button, .cert-view button')].map(e=>(e.id||'')+'|'+(e.innerText||'').trim().slice(0,20)));
console.log('КНОПКИ БЛАНКА: ' + кнопки.join(' ; '));
let файл = 'скачивания не было';
try {
  const [d] = await Promise.all([
    p.waitForEvent('download', { timeout: 8000 }),
    p.evaluate(()=>{ document.getElementById('certDl').click(); }),
  ]);
  файл = d.suggestedFilename();
} catch (e) { файл = 'нет: ' + e.message.split('\n')[0].slice(0,50); }
console.log('СЕРТИФИКАТ СКАЧАЛСЯ: ' + файл);

// стих дня со звуком
await p.evaluate(()=>{ document.querySelector('.nav__tab[data-tab="home"]')?.click(); });
await p.waitForTimeout(600);
const стих = await p.evaluate(async ()=>{
  const пауза=(м)=>new Promise(r=>setTimeout(r,м));
  if(typeof openDailyVerse!=='function') return 'стиха дня в приложении нет';
  openDailyVerse(); await пауза(900);
  const a=document.getElementById('dverseAudio');
  const b=document.getElementById('dverseListen');
  if(!a||!b) return 'плеера нет';
  b.click(); await пауза(2000);
  return { адрес:(a.currentSrc||a.getAttribute('src')||'').split('/').pop(), время:+a.currentTime.toFixed(2), пауза:a.paused, ошибка: a.error ? a.error.code : 'нет' };
});
console.log('СТИХ ДНЯ: ' + JSON.stringify(стих));
console.log('ОШИБОК: ' + errs.length); errs.slice(0,3).forEach(e=>console.log(e));
await b.close();
