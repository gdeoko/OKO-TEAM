// Первый запуск: онбординг, регистрация с согласиями, добавление ребёнка.
import { chromium } from 'playwright';
const b = await chromium.launch({ executablePath:'/opt/pw-browsers/chromium', args:['--no-sandbox','--disable-background-networking','--disable-gpu'] });
const p = await b.newPage({ viewport:{width:390,height:844} });
const errs=[]; p.on('pageerror', e=>errs.push('PAGEERROR: '+e.message));
await p.route(u => !u.href.startsWith('http://127.0.0.1'), r=>r.abort());
await p.goto('http://127.0.0.1:8777/index.html',{waitUntil:'load'});
await p.evaluate(()=>localStorage.clear());
await p.reload({waitUntil:'load'});
await p.waitForSelector('.splash--hide',{timeout:20000}).catch(()=>{});
await p.waitForTimeout(800);
console.log('ПОКАЗАН ЭКРАН: ' + await p.evaluate(()=>{
  const о=document.getElementById('onboarding'), а=document.getElementById('auth');
  return (о && !о.hidden ? 'онбординг' : '') + (а && !а.hidden ? ' вход' : '') || 'приложение сразу';
}));
// проходим онбординг до конца
for (let i=0;i<6;i++) {
  const дальше = await p.evaluate(()=>{
    const видно=(e)=>{const r=e.getBoundingClientRect();return r.width>0&&r.height>0;};
    const к=[...document.querySelectorAll('#onboarding button')].filter(видно)
      .find(e=>/дал|начать|поехали|продолж/i.test(e.innerText||''));
    if (к) { к.click(); return (к.innerText||'').trim().slice(0,20); }
    return null;
  });
  if (!дальше) break;
  await p.waitForTimeout(450);
}
await p.waitForTimeout(600);
console.log('ПОСЛЕ ОНБОРДИНГА: ' + await p.evaluate(()=>{
  const а=document.getElementById('auth');
  return а && !а.hidden ? 'экран входа' : 'вход не показан';
}));
// регистрация
const поля = await p.evaluate(()=>[...document.querySelectorAll('#auth input')].map(i=>i.id+':'+i.type));
console.log('ПОЛЯ ВХОДА: ' + поля.join(', '));
const итог = await p.evaluate(async ()=>{
  const пауза=(м)=>new Promise(r=>setTimeout(r,м));
  const вкл=[...document.querySelectorAll('#auth button, #auth [data-tab]')].find(e=>/регистр|создать/i.test(e.innerText||''));
  if (вкл) { вкл.click(); await пауза(400); }
  const набрать=(id,знач)=>{ const э=document.getElementById(id); if(!э) return false; э.value=знач; э.dispatchEvent(new Event('input',{bubbles:true})); return true; };
  набрать('regName','Мария'); набрать('regEmail','mama@example.ru'); набрать('regPass','Prover12345');
  набрать('authName','Мария'); набрать('authEmail','mama@example.ru'); набрать('authPass','Prover12345');
  await пауза(300);
  // пробуем отправить без согласий
  const кнопки=[...document.querySelectorAll('#auth button')].filter(e=>{const r=e.getBoundingClientRect();return r.width>0;});
  const отправить=кнопки.find(e=>/создать|зарегистр|войти/i.test(e.innerText||''));
  if (отправить) otправить_click(отправить);
  function otправить_click(э){ э.click(); }
  await пауза(700);
  const тост1=(document.getElementById('toast')||{}).textContent||'';
  // ставим согласия и пробуем снова
  const флажки=[...document.querySelectorAll('#auth input[type=checkbox]')];
  флажки.forEach(ф=>{ if(!ф.checked){ ф.click(); } });
  await пауза(300);
  if (отправить) отправить.click();
  await пауза(1200);
  return { флажков: флажки.length, безСогласий: тост1.slice(0,80),
    вошли: localStorage.getItem('mt_auth'), тост2: ((document.getElementById('toast')||{}).textContent||'').slice(0,80) };
});
console.log('РЕГИСТРАЦИЯ: ' + JSON.stringify(итог));
console.log('ОШИБОК: ' + errs.length); errs.slice(0,4).forEach(e=>console.log(e));
await p.screenshot({path:'shot-auth.png'});
await b.close();
