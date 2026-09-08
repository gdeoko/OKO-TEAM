// Оформление тремя вариантами: светлая, тёмная и как в системе.
// С прежним выключателем «как в системе» терялось навсегда.
import { chromium } from 'playwright';
const b = await chromium.launch({ executablePath:'/opt/pw-browsers/chromium', args:['--no-sandbox'] });
const errs=[];
const открыть = async (тёмнаяСистема) => {
  const ctx = await b.newContext({ viewport:{width:390,height:844}, colorScheme: тёмнаяСистема ? 'dark' : 'light' });
  const p = await ctx.newPage();
  p.on('pageerror', e=>errs.push(e.message));
  await p.route(u=>!u.href.startsWith('http://127.0.0.1'), r=>r.abort());
  await p.goto('http://127.0.0.1:8777/index.html',{waitUntil:'load'});
  await p.evaluate(()=>{ localStorage.setItem('mt_onb','1'); localStorage.setItem('mt_auth','1'); });
  await p.reload({waitUntil:'load'}); await p.waitForTimeout(1400);
  return p;
};
const тема = (p) => p.evaluate(()=>document.documentElement.getAttribute('data-theme'));
const нажать = async (p, что) => { await p.evaluate(()=>openSettingsScreen()); await p.waitForTimeout(400);
  await p.click(`[data-theme-pick="${что}"]`); await p.waitForTimeout(400); };

let p = await открыть(true);
console.log('система тёмная, свой выбор не сделан: ' + await тема(p));
await нажать(p, 'light');
console.log('выбрали светлую: ' + await тема(p) + ' | в памяти: ' + await p.evaluate(()=>localStorage.getItem('mt_theme')));
await нажать(p, 'auto');
console.log('вернули «как в системе»: ' + await тема(p) + ' | в памяти: ' + await p.evaluate(()=>localStorage.getItem('mt_theme')));
const светлаяПослеАвто = await тема(p);
await p.reload({waitUntil:'load'}); await p.waitForTimeout(1200);
console.log('после перезапуска: ' + await тема(p));
const держится = (await тема(p)) === 'dark';
await p.context().close();

const плохо = (светлаяПослеАвто === 'dark' ? 0 : 1) + (держится ? 0 : 1);
console.log('ОШИБОК: ' + (плохо + errs.length));
errs.slice(0,3).forEach(e=>console.log(e));
await b.close();
