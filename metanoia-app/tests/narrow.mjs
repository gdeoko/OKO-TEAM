// Узкий экран 320px и тёмная тема: не вылезает ли содержимое за края.
import { chromium } from 'playwright';
const b = await chromium.launch({ executablePath:'/opt/pw-browsers/chromium', args:['--no-sandbox'] });
for (const тема of ['light','dark']) {
  const p = await b.newPage({ viewport:{width:320,height:640}, colorScheme: тема });
  const errs=[]; p.on('pageerror', e=>errs.push(e.message));
  await p.goto('http://127.0.0.1:8777/index.html',{waitUntil:'load'});
  await p.evaluate((t)=>{ localStorage.setItem('mt_onb','1'); localStorage.setItem('mt_auth','1'); localStorage.setItem('mt_theme', t); }, тема);
  await p.reload({waitUntil:'load'});
  await p.waitForSelector('.splash--hide',{timeout:20000}).catch(()=>{});
  await p.waitForTimeout(700);
  for (const t of ['home','lessons','games','chats','profile']) {
    await p.click(`.nav__tab[data-tab="${t}"]`).catch(()=>{});
    await p.waitForTimeout(400);
    const плохо = await p.evaluate(() => {
      const ш = document.documentElement.clientWidth;
      const из = [];
      document.querySelectorAll('body *').forEach((e)=>{
        const r = e.getBoundingClientRect();
        if (r.width === 0 || r.height === 0) return;
        if (r.right > ш + 1 || r.left < -1) {
          const прокрутка = getComputedStyle(e.parentElement||e).overflowX;
          if (прокрутка === 'auto' || прокрутка === 'scroll') return;
          из.push((e.className||e.tagName) + ' ' + Math.round(r.left) + '..' + Math.round(r.right));
        }
      });
      return { лишнее: [...new Set(из)].slice(0,4), прокруткаТела: document.body.scrollWidth > ш + 1 };
    });
    console.log(тема + ' ' + t + ': за краем ' + плохо.лишнее.length + (плохо.прокруткаТела?' | тело едет вбок':'') + (плохо.лишнее.length?' | '+плохо.лишнее.join(' ; '):''));
  }
  console.log(тема + ' ошибок: ' + errs.length);
  await p.close();
}
await b.close();
