import { chromium } from 'playwright-core';
import { CLEAN_START } from './clean-start.mjs';
const b = await chromium.launch({ executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args:['--no-sandbox'] });
const c = await b.newContext({ viewport:{width:390,height:844}, isMobile:true, hasTouch:true });
await c.addInitScript(CLEAN_START);
const p = await c.newPage();
p.on('console', m => { const t=m.text(); if(t.startsWith('СБРОС')||t.startsWith('ЗОВ')) console.log(t.slice(0,320)); });
await p.goto('http://127.0.0.1:8199/index.html',{waitUntil:'domcontentloaded'});
await p.waitForTimeout(2500);
await p.evaluate(`(()=>{
  okoSkipAuth(); showTab('feed');
  var ряд = document.querySelector('.feed-tabs');
  new MutationObserver(function(ms){
    ms.forEach(function(m){
      var el = m.target;
      if(el.matches && el.matches('button[data-fk="rec"]') && el.classList.contains('on'))
        console.log('СБРОС на Рекомендации: ' + (new Error().stack||'').split('\\n').slice(1,6).join(' | '));
    });
  }).observe(ряд, {attributes:true, subtree:true, attributeFilter:['class']});
  if(typeof window.renderFeed === 'function'){
    var rf = window.renderFeed;
    window.renderFeed = function(k){
      console.log('ЗОВ renderFeed(' + k + '): ' + (new Error().stack||'').split('\\n').slice(1,5).join(' | '));
      return rf.apply(this, arguments);
    };
  }
})()`);
await p.waitForTimeout(500);
await p.evaluate(`document.querySelector('.feed-tabs button[data-fk="sub"]').click()`);
await p.waitForTimeout(3000);
console.log('итог:', await p.evaluate(`(()=>{var a=document.querySelector('.feed-tabs button.on'); return a&&a.textContent.trim();})()`));
await b.close();
