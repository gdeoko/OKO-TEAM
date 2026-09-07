import { chromium } from 'playwright';
const b = await chromium.launch({ executablePath:'/opt/pw-browsers/chromium', args:['--no-sandbox','--disable-background-networking','--disable-gpu'] });
const p = await b.newPage({ viewport:{width:390,height:844} });
const errs=[]; p.on('pageerror', e=>errs.push('PAGEERROR: '+e.message));
await p.route(u => !u.href.startsWith('http://127.0.0.1'), r=>r.abort());
await p.goto('http://127.0.0.1:8777/index.html',{waitUntil:'load'});
await p.evaluate(()=>{ localStorage.clear(); localStorage.setItem('mt_onb','1'); localStorage.setItem('mt_auth','1'); });
await p.reload({waitUntil:'load'});
await p.waitForSelector('.splash--hide',{timeout:20000}).catch(()=>{});
await p.waitForTimeout(700);
const снять = ()=>p.evaluate(()=>({
  карточек: document.querySelectorAll('#children .child-card').length,
  первая: (document.querySelector('#children .child-card')||{innerText:''}).innerText.replace(/\s+/g,' ').slice(0,55),
  примечание: !document.getElementById('childrenNote').hidden,
}));
await p.evaluate(()=>{ document.querySelector('.nav__tab[data-tab="profile"]').click(); renderChildren(); });
await p.waitForTimeout(400);
console.log('ОДИН РЕБЁНОК: ' + JSON.stringify(await снять()));
await p.evaluate(()=>{ petState.зёрна=120; savePet(); localStorage.setItem('mt_dverse_streak','6');
  DEMO.children.push({name:'Пётр', age:6, rank:'', streak:0, img: initialAvatar('Пётр','#7AAED4')}); renderChildren(); });
await p.waitForTimeout(400);
console.log('ДВОЕ ДЕТЕЙ: ' + JSON.stringify(await снять()));
console.log('ОШИБОК: ' + errs.length); errs.slice(0,3).forEach(e=>console.log(e));
await b.close();
