import { chromium } from 'playwright-core';
import { CLEAN_START, CLOSE_OVERLAYS } from './clean-start.mjs';
const b = await chromium.launch({ executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args:['--no-sandbox'] });
const c = await b.newContext({ viewport:{width:390,height:844}, isMobile:true, hasTouch:true });
await c.addInitScript(CLEAN_START);
const p = await c.newPage();
await p.goto('http://127.0.0.1:8199/index.html',{waitUntil:'domcontentloaded'});
await p.waitForTimeout(2500);
await p.evaluate('okoSkipAuth()');
const ЭКР=[['профиль',`showTab('profile')`],['академия',`showTab('academy')`],['партнёрка',`showTab('partner')`],['моя страница',`showTab('profile');(()=>{const b=[...document.querySelectorAll('[data-my]')].find(x=>x.getAttribute('data-my')==='page');b&&b.click();})()`]];
for(const [имя,шаг] of ЭКР){
  await p.keyboard.press('Escape').catch(()=>{});
  await p.evaluate(шаг).catch(()=>{});
  await p.waitForTimeout(1200);
  await p.evaluate(CLOSE_OVERLAYS).catch(()=>{});
  await p.waitForTimeout(400);
  const r = await p.evaluate(`(()=>{
    const out=[];
    document.querySelectorAll('body *').forEach(el=>{
      if(el.children.length) return;
      const t=(el.textContent||'').trim();
      if(!/^(Ранний|Партнёр|Автор|100\\+ реакций)$/.test(t)) return;
      const cs=getComputedStyle(el);
      if(cs.display==='none'||cs.visibility==='hidden') return;
      let p2=el.parentElement, p3=p2&&p2.parentElement;
      out.push({текст:t, родитель:p2?p2.tagName.toLowerCase()+'.'+String(p2.className).trim().split(/\\s+/).slice(0,2).join('.'):'-',
                дед:p3?p3.tagName.toLowerCase()+(p3.id?'#'+p3.id:'')+'.'+String(p3.className).trim().split(/\\s+/).slice(0,2).join('.'):'-',
                скроллДеда: p3? (p3.scrollWidth>p3.clientWidth+2 ? 'ДА '+p3.scrollWidth+'>'+p3.clientWidth : 'нет') : '-'});
    });
    return out.slice(0,6);
  })()`);
  console.log(имя, r.length? JSON.stringify(r,null,1) : 'бейджей нет');
}
await b.close();
