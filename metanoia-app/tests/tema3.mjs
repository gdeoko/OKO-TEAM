// Тёмная тема в играх: каждая игра открывается и текст читается.
import { chromium } from 'playwright';
const b = await chromium.launch({ executablePath:'/opt/pw-browsers/chromium', args:['--no-sandbox','--disable-gpu'] });
const p = await b.newPage({ viewport:{width:390,height:844} });
const errs=[]; p.on('pageerror',e=>errs.push('PAGEERROR: '+e.message));
await p.route(u=>!u.href.startsWith('http://127.0.0.1'), r=>r.abort());
await p.goto('http://127.0.0.1:8777/index.html',{waitUntil:'load'});
await p.evaluate(()=>{ localStorage.clear(); localStorage.setItem('mt_onb','1'); localStorage.setItem('mt_auth','1');
  localStorage.setItem('mt_theme','dark'); localStorage.setItem('mt_music_off','1'); });
await p.reload({waitUntil:'load'});
await p.waitForSelector('.splash--hide',{timeout:20000}).catch(()=>{});
await p.waitForTimeout(900);
const ключи = await p.evaluate(()=>GAMES.map(g=>g.key));
for (const k of ключи) {
  await p.evaluate((k)=>{ document.getElementById('gameEnd')?.setAttribute('hidden','');
    document.querySelectorAll('.reward, .dverse').forEach(э=>э.hidden=true); openGame(k); }, k);
  await p.waitForTimeout(600);
  const плохие = await p.evaluate(()=>{
    const я = (c) => { const m = c.match(/[\d.]+/g); if(!m) return null;
      if (m.length > 3 && Number(m[3]) < 0.5) return null;
      return (0.299*m[0] + 0.587*m[1] + 0.114*m[2]) / 255; };
    const плохо = [];
    document.querySelectorAll('.screen--active *').forEach(э=>{
      if (!э.offsetParent || !э.textContent.trim() || э.children.length) return;
      const s = getComputedStyle(э); const т = я(s.color);
      let фон=null, у=э; while (у && фон===null) { фон = я(getComputedStyle(у).backgroundColor); у=у.parentElement; }
      if (т===null || фон===null) return;
      if (Math.abs(т-фон) < 0.15) плохо.push((э.className||э.tagName).toString().slice(0,22)+': '+э.textContent.trim().slice(0,22));
    });
    return [...new Set(плохо)].slice(0,3);
  });
  if (плохие.length) console.log(k + ': ' + плохие.join(' | '));
}
console.log('проверено игр: ' + ключи.length);
console.log('ОШИБОК: ' + errs.length); errs.slice(0,3).forEach(e=>console.log(e));
await b.close();
