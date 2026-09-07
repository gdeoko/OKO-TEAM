import { chromium } from 'playwright';
const b = await chromium.launch({ executablePath:'/opt/pw-browsers/chromium', args:['--no-sandbox','--disable-background-networking','--disable-component-update','--no-first-run','--disable-sync','--disable-features=OptimizationHints,Translate'] });
const p = await b.newPage({ viewport:{width:390,height:844} });
const errs=[]; p.on('pageerror', e=>errs.push(e.message));
p.on('console', m=>{ if(m.type()==='error') errs.push('CONSOLE: '+m.text()); });
await p.route(url => !url.href.startsWith('http://127.0.0.1'), r=>r.abort());
await p.goto('http://127.0.0.1:8777/_build.html',{waitUntil:'domcontentloaded'});
await p.waitForSelector(".splash--hide", { timeout: 20000 }).catch(()=>{}); await p.waitForTimeout(800);
for (const t of ['games','chats','lessons','profile','home']) { await p.click(`.nav__tab[data-tab="${t}"]`).catch(()=>{}); await p.waitForTimeout(350); }
await p.click('.nav__tab[data-tab="lessons"]'); await p.waitForTimeout(400);
await p.click('.lesson-item'); await p.waitForTimeout(800);
console.log('УРОК В ОДНОМ ФАЙЛЕ: задание=' + !!(await p.$('.task')) + ' обложка=' + await p.$eval('.lesson-cover img', e=>e.src.slice(0,20)).catch(()=>'нет'));
const аудио = await p.$eval('#lessonVoice', e=>e.dataset.src.slice(0,25)).catch(()=>'нет');
console.log('АУДИО УРОКА: ' + аудио);
await p.screenshot({ path:'shot-standalone.png' });
console.log('ОШИБКИ: ' + errs.length); errs.slice(0,6).forEach(e=>console.log(e));
await b.close();
