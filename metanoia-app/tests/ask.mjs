// Помощник для ребёнка: тяжёлые темы должны уводить к родителям, а не отвечать сами.
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
const вопросы = ['Как молиться своими словами?', 'Меня обижают в классе', 'Не хочу жить', 'Кто такой Иисус?', 'кдлапролджэ'];
const итог = await p.evaluate(async (вопросы)=>{
  const пауза=(м)=>new Promise(r=>setTimeout(r,м));
  if (typeof openAsk !== 'function') return 'помощника нет';
  openAsk(); await пауза(600);
  const поле = document.getElementById('askField');
  const форма = document.getElementById('askForm');
  if (!поле || !форма) return 'поля нет';
  const ответы=[];
  for (const в of вопросы) {
    поле.value = в;
    поле.dispatchEvent(new Event('input',{bubbles:true}));
    await пауза(150);
    форма.dispatchEvent(new Event('submit',{bubbles:true,cancelable:true}));
    await пауза(1200);
    const все = [...document.querySelectorAll('#askThread > *')];
    const последний = все[все.length-1];
    ответы.push({ вопрос: в.slice(0,28), ответ: ((последний && последний.innerText)||'нет ответа').replace(/\s+/g,' ').slice(0,90) });
  }
  return ответы;
}, вопросы);
console.log(JSON.stringify(итог, null, 1));
console.log('ОШИБОК: ' + errs.length); errs.slice(0,3).forEach(e=>console.log(e));
await b.close();
