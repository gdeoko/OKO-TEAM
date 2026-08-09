import { chromium } from 'playwright-core';
import { CLEAN_START, CLOSE_OVERLAYS } from './clean-start.mjs';
const b = await chromium.launch({ executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args:['--no-sandbox'] });
const c = await b.newContext({ viewport:{width:390,height:800}, isMobile:true, hasTouch:true });
await c.addInitScript(CLEAN_START);
const p = await c.newPage();
await p.goto('http://127.0.0.1:8199/index.html',{waitUntil:'domcontentloaded'});
await p.waitForTimeout(2500);
await p.evaluate(`okoSkipAuth(); showTab('profile')`);
await p.waitForTimeout(1500);
await p.evaluate(CLOSE_OVERLAYS).catch(()=>{});
await p.waitForTimeout(600);
console.log(await p.evaluate(`(()=>{
  var scr = document.querySelector('main > .screen.active');
  var main = document.querySelector('main');
  return {
    классНаHtml: document.documentElement.className.split(/\\s+/).filter(function(c){return c.indexOf('okg')>-1||c.indexOf('panel')>-1;}),
    отступСнизу: scr ? getComputedStyle(scr).paddingBottom : '(нет экрана)',
    можноЛиПролистать: scr ? (scr.scrollHeight - scr.clientHeight) : 0,
    ктоСкроллит: scr ? 'section.screen' : '-'
  };
})()`));
/* пролистываем вниз и смотрим, ушла ли кнопка из-под плашки */
await p.evaluate(`(()=>{var m=document.querySelector('main > .screen.active'); if(m) m.scrollTop = m.scrollHeight;})()`);
await p.waitForTimeout(700);
console.log('после прокрутки вниз:', await p.evaluate(`(()=>{
  var pill=document.querySelector('.okg-pill'); if(!pill) return 'плашки нет';
  var pr=pill.getBoundingClientRect(); var задет=[];
  document.querySelectorAll('button,[role="button"]').forEach(function(el){
    if(pill.contains(el)) return;
    var cs=getComputedStyle(el); if(cs.display==='none'||cs.visibility==='hidden') return;
    var r=el.getBoundingClientRect(); if(r.width<8||r.height<8) return;
    if(!(r.right<pr.left||r.left>pr.right||r.bottom<pr.top||r.top>pr.bottom)) задет.push((el.textContent||'').trim().slice(0,22));
  });
  return задет;
})()`));
await b.close();
