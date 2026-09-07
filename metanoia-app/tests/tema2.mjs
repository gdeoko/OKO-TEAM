// Контраст в тёмной теме на остальных экранах.
import { chromium } from 'playwright';
const b = await chromium.launch({ executablePath:'/opt/pw-browsers/chromium', args:['--no-sandbox','--disable-gpu'] });
const p = await b.newPage({ viewport:{width:390,height:844} });
const errs=[]; p.on('pageerror',e=>errs.push('PAGEERROR: '+e.message));
await p.route(u=>!u.href.startsWith('http://127.0.0.1'), r=>r.abort());
await p.goto('http://127.0.0.1:8777/index.html',{waitUntil:'load'});
await p.evaluate(()=>{ localStorage.clear(); localStorage.setItem('mt_onb','1'); localStorage.setItem('mt_auth','1');
  localStorage.setItem('mt_theme','dark'); localStorage.setItem('mt_music_off','1');
  localStorage.setItem('mt_kids','[{"name":"Соня","age":8,"img":"","лид":"k1"}]');
  localStorage.setItem('mt_active_kid','k1');
  for (let n=1;n<=35;n++) localStorage.setItem('mt_lesson_'+n, JSON.stringify({read:true,task:true,test:true,done:true,ts:Date.now()}));
  localStorage.setItem('mt_exam_0', JSON.stringify({pct:90, ts:Date.now()})); });
await p.reload({waitUntil:'load'});
await p.waitForSelector('.splash--hide',{timeout:20000}).catch(()=>{});
await p.waitForTimeout(1000);
const проверить = async (имя, действие) => {
  await p.evaluate(действие).catch(()=>{});
  await p.waitForTimeout(700);
  const плохие = await p.evaluate(()=>{
    const я = (c) => { const m = c.match(/[\d.]+/g); if(!m) return null;
      if (m.length > 3 && Number(m[3]) < 0.5) return null;   // прозрачное не считаем
      return (0.299*m[0] + 0.587*m[1] + 0.114*m[2]) / 255; };
    const плохо = [];
    document.querySelectorAll('.screen--active *, .modal:not([hidden]) *').forEach(э=>{
      if (!э.offsetParent || !э.textContent.trim() || э.children.length) return;
      const s = getComputedStyle(э); const т = я(s.color);
      let фон = null, у = э;
      while (у && фон === null) { фон = я(getComputedStyle(у).backgroundColor); у = у.parentElement; }
      if (т === null || фон === null) return;
      if (Math.abs(т - фон) < 0.15) плохо.push((э.className||э.tagName).toString().slice(0,26) + ': ' + э.textContent.trim().slice(0,26));
    });
    return [...new Set(плохо)].slice(0,3);
  });
  console.log(имя + ': ' + (плохие.length ? плохие.join(' | ') : 'в порядке'));
};
await проверить('книга', ()=>openBook());
await проверить('читалка', ()=>openReader(1));
await проверить('лавка', ()=>openShop());
await проверить('сертификаты', ()=>openCertificates());
await проверить('альбом', ()=>openAlbumScreen());
await проверить('квест', ()=>openQuest());
await проверить('проверка знаний', ()=>openExam(0));
await проверить('друг', ()=>openPetScreen());
await проверить('рейтинг', ()=>openRatingScreen());
console.log('ОШИБОК: ' + errs.length); errs.slice(0,3).forEach(e=>console.log(e));
await b.close();
