// Школа внутри Телеграма: подделываем окружение мессенджера и смотрим,
// что приложение разворачивается, красит окно, слушает системное «назад»
// и меняет вход на телеграмный.
import { chromium } from 'playwright';
import fs from 'fs';
const initData = fs.readFileSync('/tmp/initdata.txt', 'utf8').trim();
const b = await chromium.launch({ executablePath:'/opt/pw-browsers/chromium', args:['--no-sandbox','--disable-background-networking','--disable-gpu'] });
const p = await b.newPage({ viewport:{width:390,height:720} });
const errs=[]; p.on('pageerror', e=>errs.push('PAGEERROR: '+e.message));
// поддельный Telegram.WebApp до загрузки страницы
await p.addInitScript((init) => {
  const вызовы = [];
  window.__вызовы = вызовы;
  const события = {};
  window.Telegram = { WebApp: {
    initData: init,
    initDataUnsafe: { user: { id: 7788, first_name: 'Соня', language_code: 'ru' }, auth_date: 1 },
    version: '7.10', platform: 'android',
    viewportHeight: 640, viewportStableHeight: 600,
    ready: () => вызовы.push('ready'),
    expand: () => вызовы.push('expand'),
    close: () => вызовы.push('close'),
    disableVerticalSwipes: () => вызовы.push('disableVerticalSwipes'),
    enableClosingConfirmation: () => вызовы.push('enableClosingConfirmation'),
    setHeaderColor: (c) => вызовы.push('header:' + c),
    setBackgroundColor: (c) => вызовы.push('bg:' + c),
    onEvent: (имя, ф) => { события[имя] = ф; },
    HapticFeedback: { impactOccurred: () => {} },
    BackButton: {
      видна: false,
      show() { this.видна = true; вызовы.push('back:show'); },
      hide() { this.видна = false; },
      onClick(ф) { window.__назад = ф; },
    },
  } };
}, initData);
await p.route(u => !u.href.startsWith('http://127.0.0.1'), r => r.abort());
await p.goto('http://127.0.0.1:8099/_t.html', { waitUntil:'load' });
await p.evaluate(()=>{ localStorage.clear(); localStorage.setItem('mt_onb','1'); });
await p.reload({ waitUntil:'load' });
await p.waitForSelector('.splash--hide',{timeout:20000}).catch(()=>{});
await p.waitForTimeout(1200);

console.log('ВЫЗВАНО В ТЕЛЕГРАМЕ: ' + JSON.stringify(await p.evaluate(()=>window.__вызовы)));
console.log('СОСТОЯНИЕ: ' + JSON.stringify(await p.evaluate(()=>({
  метка: document.documentElement.className,
  высота: getComputedStyle(document.documentElement).getPropertyValue('--tg-height').trim(),
  имя: localStorage.getItem('mt_name'),
  подпись: (localStorage.getItem('mt_tg_init')||'').slice(0,18),
}))));

// откроем урок и проверим системную стрелку назад
await p.evaluate(()=>document.querySelector('.nav__tab[data-tab="lessons"]').click());
await p.waitForTimeout(500);
await p.evaluate(()=>document.querySelector('.lesson-item').click());
await p.waitForTimeout(900);
console.log('В УРОКЕ: стрелка Телеграма видна = ' + await p.evaluate(()=>window.Telegram.WebApp.BackButton.видна));
await p.evaluate(()=>window.__назад && window.__назад());
await p.waitForTimeout(700);
console.log('ПОСЛЕ СИСТЕМНОГО НАЗАД: экран = ' + await p.evaluate(()=>{
  let э=''; document.querySelectorAll('[data-screen]').forEach(e=>{ if(!e.hidden && getComputedStyle(e).display!=='none') э=e.dataset.screen; }); return э;
}));
console.log('ВХОД ЧЕРЕЗ ТЕЛЕГРАМ: ' + JSON.stringify(await p.evaluate(()=>({
  токен: (localStorage.getItem('mt_token')||'').slice(0,12),
  вошли: localStorage.getItem('mt_auth'),
  ребёнок: localStorage.getItem('mt_child_id'),
  слой: !!(window.MT_SYNC && MT_SYNC.включён()),
}))));
console.log('ОШИБОК: ' + errs.length); errs.slice(0,4).forEach(e=>console.log(e));
await p.screenshot({path:'shot-tg.png'});
await b.close();
