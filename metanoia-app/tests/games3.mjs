// Выборочная проверка игр: открываются, отвечают на нажатие, без ошибок.
import { chromium } from 'playwright';
const b = await chromium.launch({ executablePath:'/opt/pw-browsers/chromium', args:['--no-sandbox','--disable-background-networking','--disable-gpu'] });
const p = await b.newPage({ viewport:{width:390,height:844} });
const errs=[]; p.on('pageerror', e=>errs.push('PAGEERROR: '+e.message));
await p.route(u => !u.href.startsWith('http://127.0.0.1'), r=>r.abort());
await p.goto('http://127.0.0.1:8777/index.html',{waitUntil:'load'});
await p.evaluate(()=>{ localStorage.setItem('mt_onb','1'); localStorage.setItem('mt_auth','1'); localStorage.setItem('mt_music_off','1'); });
await p.reload({waitUntil:'load'});
await p.waitForSelector('.splash--hide',{timeout:20000}).catch(()=>{});
await p.waitForTimeout(500);
await p.evaluate(()=>document.querySelector('.nav__tab[data-tab="games"]').click());
await p.waitForTimeout(500);
const ключи = await p.$$eval('[data-game]', e=>e.map(x=>x.dataset.game));
console.log('КЛЮЧЕЙ ИГР: ' + ключи.length + ' | ' + ключи.join(', '));
const сколько = Number(process.argv[2] || 4);
const начало = Number(process.argv[3] || 0);
for (const k of ключи.slice(начало, начало + сколько)) {
  const было = errs.length;
  await p.evaluate((k)=>document.querySelector(`[data-game="${k}"]`).click(), k);
  await p.waitForTimeout(700);
  const до = await p.evaluate(()=>document.body.innerText.length);
  const нажали = await p.evaluate(()=>{
    const видно=(e)=>{const r=e.getBoundingClientRect();return r.width>0&&r.height>0;};
    const кн=[...document.querySelectorAll('.q__opt, .mem__card, .ark__item, [data-screen]:not([hidden]) button')].filter(видно);
    if(кн[0]) { кн[0].click(); return (кн[0].innerText||кн[0].className).slice(0,24); }
    return 'нечего нажать';
  });
  await p.waitForTimeout(600);
  const после = await p.evaluate(()=>document.body.innerText.length);
  console.log(k + ': текста ' + до + ' → ' + после + ', нажали «' + нажали + '»' + (errs.length>было?' ОШИБКА: '+errs[было].slice(0,60):' — чисто'));
  await p.evaluate(()=>{ const t=document.querySelector('.nav__tab[data-tab="games"]'); if(t) t.click(); });
  await p.waitForTimeout(500);
}
console.log('ОШИБОК: ' + errs.length);
await b.close();
