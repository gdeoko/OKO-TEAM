/* Нижнее меню: не прыгает, не дёргается, не перезагружает страницу.
   Главная претензия Даниэля, повторённая дважды. Меряем после того, как в
   приложение добавились полтора десятка новых слоёв. */
import { chromium } from 'playwright-core';

const b = await chromium.launch({
  executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  args: ['--no-sandbox', '--use-gl=swiftshader', '--enable-unsafe-swiftshader'],
});
const c = await b.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
await c.addInitScript(`
  window.okoSkipAuth=function(){try{localStorage.setItem('oko-auth','tg')}catch(e){};var a=document.getElementById('authScreen');if(a){a.classList.add('hidden');a.style.display='none'}var s=document.getElementById('splash');if(s){s.classList.add('gone');s.style.display='none'}var o=document.getElementById('onboard');if(o){o.classList.add('hidden');o.style.display='none'}};
  try{localStorage.setItem('oko-onboard-done','1');localStorage.setItem('oko-stories-seen','1');localStorage.setItem('oko-tour-done','1');localStorage.setItem('oko-tour','1')}catch(e){}
`);
const p = await c.newPage();
let reloads = 0;
p.on('framenavigated', f => { if (f === p.mainFrame()) reloads++; });
const errs = [];
p.on('pageerror', e => errs.push(String(e).split('\n')[0].slice(0, 140)));

await p.goto('http://127.0.0.1:8199/index.html', { waitUntil: 'domcontentloaded' });
await p.waitForTimeout(2000);
await p.evaluate('okoSkipAuth()');
reloads = 0;

const tabs = ['feed', 'chats', 'mini', 'wallet', 'profile', 'feed', 'chats', 'mini', 'wallet', 'profile'];
const tops = [], times = [], clones = [];
for (const t of tabs) {
  const t0 = Date.now();
  await p.evaluate(`(() => { const b = document.querySelector('nav [data-t="${t}"]'); if (b) b.click(); else showTab('${t}'); })()`);
  await p.waitForTimeout(180);
  times.push(Date.now() - t0);
  const m = await p.evaluate(`(() => {
    const nav = document.querySelector('nav#tabs, nav');
    const r = nav ? nav.getBoundingClientRect() : null;
    return {
      top: r ? Math.round(r.top) : null,
      /* «двоение»: клон активного экрана поверх нового */
      clones: document.querySelectorAll('.wm-tab-overlay, .screen-clone, [data-screen-clone]').length,
      active: (document.querySelector('main > .screen.active') || {}).id || ''
    };
  })()`);
  tops.push(m.top);
  clones.push(m.clones);
}

const uniqueTops = [...new Set(tops)];
console.log(JSON.stringify({
  перезагрузокСтраницы: reloads,
  верхМенюПоКадрам: tops,
  менюНеПрыгает: uniqueTops.length === 1,
  клоновЭкрана: clones.reduce((a, x) => a + x, 0),
  времяПереключенияМс: times,
  максМс: Math.max(...times),
  ошибки: [...new Set(errs)]
}, null, 2));
await b.close();
