import { chromium } from 'playwright-core';
const b = await chromium.launch({ executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args:['--no-sandbox','--use-gl=swiftshader','--enable-unsafe-swiftshader'] });
const p = await (await b.newContext({viewport:{width:390,height:844}, isMobile:true, hasTouch:true})).newPage();
const bad = [];
p.on('response', r => { if(r.status() >= 400) bad.push(r.status()+' '+r.url().replace('http://127.0.0.1:8200','')); });
p.on('pageerror', e => bad.push('JS: '+String(e).split('\n')[0].slice(0,120)));
await p.goto('http://127.0.0.1:8200/index.html', {waitUntil:'domcontentloaded'});
await p.waitForTimeout(6000);
console.log(await p.evaluate(`({
  тегов_слоёв: document.querySelectorAll('script[src*="media/app/"]').length,
  запись:      typeof window.okoRec,
  соцслой:     typeof window.okoSocial,
  доступность: !!window.__okoA11yLoaded,
  клипы:       typeof window.okoReels,
  сборка:      ((document.querySelector('[data-build]')||{}).textContent||'(нет)').trim(),
  вопросы_сразу: typeof showPopup === 'function',
  выход_спрашивает: typeof doLogoutNow === 'function'
})`));
console.log('проблемы:', bad.length ? bad.slice(0,10) : 'нет');
await b.close();
