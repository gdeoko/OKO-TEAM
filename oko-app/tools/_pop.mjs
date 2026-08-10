import { chromium } from 'playwright-core';
import { CLEAN_START } from './clean-start.mjs';
const b = await chromium.launch({ executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args:['--no-sandbox'] });
const c = await b.newContext({ viewport:{width:390,height:844}, isMobile:true, hasTouch:true });
await c.addInitScript(CLEAN_START);
const p = await c.newPage();
await p.goto('http://127.0.0.1:8199/index.html',{waitUntil:'domcontentloaded'});
await p.waitForTimeout(2600);
await p.evaluate('okoSkipAuth()');
/* 1. окно с одной кнопкой, открытое ПО НАЖАТИЮ */
await p.evaluate(`(()=>{ const b=document.createElement('button'); b.id='_probe'; b.textContent='проба';
  b.onclick=()=>showPopup({title:'ПРОБА',body:'одна кнопка',actions:[{label:'Понятно'}]});
  document.body.appendChild(b); })()`);
await p.evaluate(`document.getElementById('_probe').click()`);
await p.waitForTimeout(500);
console.log('по нажатию, одна кнопка:', await p.evaluate(`!!document.getElementById('okoPopup')`) ? 'ПОКАЗАНО' : 'проглочено');
await p.evaluate(`closePopup&&closePopup()`).catch(()=>{});
/* 2. окно без нажатия (фоновое уведомление) — должно уйти в очередь при занятости */
await p.waitForTimeout(1600);
await p.evaluate(`showPopup({title:'ФОН',body:'без нажатия',actions:[{label:'Понятно'}]})`);
await p.waitForTimeout(400);
console.log('без нажатия, одна кнопка:', await p.evaluate(`!!document.getElementById('okoPopup')`) ? 'показано (приложение свободно)' : 'отложено');
/* 3. z-index поверх панели */
await p.evaluate(`closePopup&&closePopup(); showTab('wallet')`).catch(()=>{});
await p.waitForTimeout(900);
await p.evaluate(`showPopup({now:true,title:'ПОВЕРХ',body:'x',actions:[{label:'Отмена',ghost:true},{label:'Да'}]})`);
await p.waitForTimeout(400);
console.log('z-index окна:', await p.evaluate(`(()=>{const e=document.getElementById('okoPopup'); if(!e) return 'нет окна';
  const z=getComputedStyle(e).zIndex; const r=e.getBoundingClientRect();
  const сверху=document.elementFromPoint(Math.round(r.width/2), Math.round(r.height/2));
  return z+' , в центре: '+(сверху? сверху.tagName+'.'+String(сверху.className).split(' ')[0] : '?');})()`));
await b.close();
