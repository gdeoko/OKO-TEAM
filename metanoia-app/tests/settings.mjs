// Настройки, уведомления, истории: переключается ли и держится ли.
import { chromium } from 'playwright';
const b = await chromium.launch({ executablePath:'/opt/pw-browsers/chromium', args:['--no-sandbox','--disable-background-networking','--disable-gpu'] });
const p = await b.newPage({ viewport:{width:390,height:844} });
const errs=[]; p.on('pageerror', e=>errs.push('PAGEERROR: '+e.message));
await p.route(u => !u.href.startsWith('http://127.0.0.1'), r=>r.abort());
await p.goto('http://127.0.0.1:8777/index.html',{waitUntil:'load'});
await p.evaluate(()=>{ localStorage.clear(); localStorage.setItem('mt_onb','1'); localStorage.setItem('mt_auth','1'); });
await p.reload({waitUntil:'load'});
await p.waitForSelector('.splash--hide',{timeout:20000}).catch(()=>{});
await p.waitForTimeout(700);

const шаги = await p.evaluate(async ()=>{
  const пауза=(м)=>new Promise(r=>setTimeout(r,м));
  const из={};
  // настройки
  openSettingsScreen(); await пауза(700);
  const тумблеры=[...document.querySelectorAll('[data-screen="settings"] input[type=checkbox], [data-screen="settings"] [data-set], [data-screen="settings"] .switch')];
  из.тумблеров=тумблеры.length;
  if (тумблеры[0]) { тумблеры[0].click(); await пауза(400); }
  из.после=Object.keys(localStorage).filter(k=>k.startsWith('mt_set_')).map(k=>k+'='+localStorage.getItem(k)).join(', ') || 'ничего не записалось';
  // тема
  const тема=[...document.querySelectorAll('[data-screen="settings"] *')].find(e=>/тёмн|темн/i.test((e.innerText||'').slice(0,40)) && (e.tagName==='BUTTON'||e.tagName==='LABEL'));
  if (тема) { тема.click(); await пауза(500); из.тема=localStorage.getItem('mt_theme')||'не записалась'; } else из.тема='переключателя нет';
  // уведомления
  const колокол=document.querySelector('#notifBtn, [aria-label*="ведомлен"]');
  if (колокол) { колокол.click(); await пауза(600);
    const п=document.getElementById('notifPanel');
    из.уведомления=(п && !п.hidden ? 'открылись, штук ' + document.querySelectorAll('#notifList > *').length : 'не открылись');
    document.getElementById('notifBack')?.click(); await пауза(300);
  } else из.уведомления='колокола нет';
  // истории
  const история=document.querySelector('.story');
  if (история) { история.click(); await пауза(800);
    const в=document.getElementById('storyViewer');
    из.истории=(в && !в.hidden ? 'открылась' : 'не открылась');
    document.querySelector('#storyClose, #storyViewer [data-close]')?.click(); await пауза(300);
  } else из.истории='историй нет';
  return из;
});
console.log('ПРОВЕРКА: ' + JSON.stringify(шаги, null, 1));
await p.reload({waitUntil:'load'});
await p.waitForTimeout(1500);
console.log('ПОСЛЕ ПЕРЕЗАПУСКА: ' + JSON.stringify(await p.evaluate(()=>({
  настройки: Object.keys(localStorage).filter(k=>k.startsWith('mt_set_')).length,
  тема: localStorage.getItem('mt_theme'),
  вид: getComputedStyle(document.body).backgroundColor,
}))));
console.log('ОШИБОК: ' + errs.length); errs.slice(0,3).forEach(e=>console.log(e));
await b.close();
