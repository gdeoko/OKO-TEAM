/* Точечно: спрашивает ли «Выйти из аккаунта» и переживает ли отказ. */
import { chromium } from 'playwright-core';
const b = await chromium.launch({ executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args:['--no-sandbox'] });
const c = await b.newContext({ viewport:{width:390,height:844}, isMobile:true, hasTouch:true });
await c.addInitScript(`window.okoSkipAuth=function(){try{localStorage.setItem('oko-auth','tg')}catch(e){};var a=document.getElementById('authScreen');if(a){a.classList.add('hidden');a.style.display='none'}var s=document.getElementById('splash');if(s){s.classList.add('gone');s.style.display='none'}var o=document.getElementById('onboard');if(o){o.classList.add('hidden');o.style.display='none'}};try{localStorage.setItem('oko-onboard-done','1');localStorage.setItem('oko-tour-done','1')}catch(e){}`);
const p = await c.newPage();
await p.goto('http://127.0.0.1:8199/index.html',{waitUntil:'domcontentloaded'});
await p.waitForTimeout(2000);
await p.evaluate('okoSkipAuth()');

/* 1. Прямой вызов doLogout() — должен показать вопрос, а не выкинуть. */
await p.evaluate('doLogout()').catch(e => console.log('doLogout упал:', String(e).slice(0,80)));
await p.waitForTimeout(400);
console.log('1) прямой doLogout():', await p.evaluate(`(()=>{
  const d=document.getElementById('okoPopup');
  return { вопросПоказан: !!d, текст: d ? (d.innerText||'').replace(/\\s+/g,' ').trim().slice(0,120) : '',
           входНаМесте: localStorage.getItem('oko-auth') };
})()`));

/* 2. «Отмена» — вход должен остаться. */
await p.evaluate(`(()=>{const b=document.querySelector('#okoPopup [data-pa="0"]'); b&&b.click();})()`);
await p.waitForTimeout(400);
console.log('2) после «Отмена»:', await p.evaluate(`(()=>({ окноЗакрыто: !document.getElementById('okoPopup'), входНаМесте: localStorage.getItem('oko-auth') }))()`));

/* 3. Кнопка на экране профиля — тоже через вопрос. */
await p.evaluate(`showTab('profile')`);
await p.waitForTimeout(800);
const нашлась = await p.evaluate(`(()=>{
  const els=[...document.querySelectorAll('button,[role="button"],.prow')].filter(e=>{
    const cs=getComputedStyle(e); if(cs.display==='none'||cs.visibility==='hidden') return false;
    const r=e.getBoundingClientRect(); if(r.width<8||r.height<8) return false;
    return /^(выйти|выйти из аккаунта)$/i.test((e.textContent||'').replace(/\\s+/g,' ').trim());
  });
  if(!els.length) return null;
  els[0].click();
  return els[0].className + ' | onclick=' + (els[0].getAttribute('onclick')||'[js]');
})()`);
await p.waitForTimeout(600);
console.log('3) кнопка профиля:', нашлась, await p.evaluate(`(()=>({ вопросПоказан: !!document.getElementById('okoPopup'), входНаМесте: localStorage.getItem('oko-auth') }))()`));

/* 4. «Выйти» подтверждено — только теперь выход. */
await p.evaluate(`(()=>{const b=document.querySelector('#okoPopup [data-pa="1"]'); b&&b.click();})()`).catch(()=>{});
await p.waitForLoadState('domcontentloaded').catch(()=>{});
await p.waitForTimeout(1200);
console.log('4) после подтверждения:', await p.evaluate(`(()=>({ входСнят: !localStorage.getItem('oko-auth') }))()`).catch(()=>'страница перезагрузилась'));
await b.close();
