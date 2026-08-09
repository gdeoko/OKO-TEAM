import { chromium } from 'playwright-core';
const b = await chromium.launch({ executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args:['--no-sandbox'] });
const ctx = await b.newContext({ viewport:{width:390,height:844}, isMobile:true, hasTouch:true, acceptDownloads:true });
await ctx.addInitScript(`
  window.okoSkipAuth=function(){try{localStorage.setItem('oko-auth','tg')}catch(e){};
    var a=document.getElementById('authScreen');if(a){a.classList.add('hidden');a.style.display='none';}
    var s=document.getElementById('splash');if(s){s.classList.add('gone');s.style.display='none';}
    var o=document.getElementById('onboard');if(o){o.classList.add('hidden');o.style.display='none';}};
  try{localStorage.setItem('oko-onboard-done','1');localStorage.setItem('oko-stories-seen','1');
      localStorage.setItem('oko-tour-done','1');localStorage.setItem('oko-tour','1');
      localStorage.setItem('oko-owner','1');
      localStorage.setItem('okg-state-v1', JSON.stringify({born:Date.now()-3600000,days:[],steps:{},
        ob:{collapsed:true,closed:true},nudge:{onboarding:Date.now(),anketa:Date.now(),videofree:Date.now(),
        partner:Date.now(),lesson:Date.now(),expiring:Date.now()},off:{},snooze:{}}));
  }catch(e){}
`);
const p = await ctx.newPage();
const errs = [];
p.on('pageerror', e => errs.push('PAGEERROR ' + String(e).slice(0,160)));
p.on('console', m => { if(m.type()==='error'){ const t=m.text(); if(!/404|net::|Failed to load resource/i.test(t)) errs.push('CONSOLE '+t.slice(0,160)); } });
for (let i=0;i<4;i++){ try { await p.goto('http://127.0.0.1:8299/index.html',{waitUntil:'domcontentloaded',timeout:120000}); break; } catch(e){ await p.waitForTimeout(2000); } }
await p.waitForTimeout(2500);
await p.evaluate(`okoSkipAuth();`);
await p.addStyleTag({content:'#h2View,#adminView,#h2View *,#adminView *{transition:none !important}'});

const R = async (name, js) => { const v = await p.evaluate(js); console.log(name, JSON.stringify(v)); return v; };

await p.evaluate(`openAdmin(); admGo('hq');`); await p.waitForTimeout(600);

// 1. проверка подключений — реальный запрос
await p.evaluate(`document.querySelector('[data-h2act="check"]').click();`);
await p.waitForTimeout(3000);
await R('check-note', `document.getElementById('h2CheckOut') ? document.getElementById('h2CheckOut').textContent.slice(0,120) : 'нет'`);
await R('log-after-check', `okoHq2.state().log.length`);

// 2. фича-флаг
await p.evaluate(`admGo('flags');`); await p.waitForTimeout(400);
await p.evaluate(`document.querySelector('[data-h2act="flag"]').click();`); await p.waitForTimeout(400);
await R('flag-state', `JSON.stringify(okoHq2.state().flags)`);
await R('flag-persist', `!!JSON.parse(localStorage.getItem('oko-hq2')).flags`);

// 3. экспорт .txt — реальная загрузка файла
await p.evaluate(`admGo('export');`); await p.waitForTimeout(400);
const [dl] = await Promise.all([
  p.waitForEvent('download', {timeout: 15000}).catch(()=>null),
  p.evaluate(`document.querySelector('[data-h2act="exp-txt"]').click();`)
]);
console.log('download-txt', dl ? dl.suggestedFilename() : 'НЕ СКАЧАЛСЯ');

// 4. экспорт json
const [dl2] = await Promise.all([
  p.waitForEvent('download', {timeout: 15000}).catch(()=>null),
  p.evaluate(`document.querySelector('[data-h2act="exp-json"]').click();`)
]);
console.log('download-json', dl2 ? dl2.suggestedFilename() : 'НЕ СКАЧАЛСЯ');

// 5. кнопка тарифа открывает оплату
await p.evaluate(`admGo('plans');`); await p.waitForTimeout(400);
await p.evaluate(`document.querySelector('[data-h2act="plan-open"]').click();`); await p.waitForTimeout(900);
await R('pay-sheet-open', `!!document.querySelector('#payView') && !!document.querySelector('.sheet.open, #sheet.open, .sheet-wrap.open') ? 'открыт' : (document.getElementById('payView') ? document.getElementById('payView').textContent.slice(0,40) : 'нет payView')`);
await R('admin-closed', `!document.getElementById('adminView').classList.contains('open')`);

// 6. переход по контенту
await p.evaluate(`(()=>{try{closeSheet&&closeSheet()}catch(e){}; openAdmin(); admGo('content'); return 1})()`); await p.waitForTimeout(600);
await p.evaluate(`document.querySelectorAll('[data-h2act="content-go"]')[3].click();`); await p.waitForTimeout(800);
await R('content-go-chats', `document.querySelector('main > .screen.active') ? document.querySelector('main > .screen.active').id : 'нет'`);

console.log('ERRORS', JSON.stringify(errs));
await b.close();
