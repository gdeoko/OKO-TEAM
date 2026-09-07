// Код родителя: задаётся семьёй, старый общий 1234 не пускает.
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

const набрать = async (код) => {
  for (const ц of код) { await p.click(`#pinPad button[data-key="${ц}"]`); await p.waitForTimeout(90); }
  await p.waitForTimeout(400);
};
const состояние = () => p.evaluate(()=>({
  окно: !document.getElementById('pinModal').hidden,
  заголовок: (document.getElementById('pinTitle')||{}).textContent||'',
  код: localStorage.getItem('mt_pin'),
  тост: ((document.getElementById('toast')||{}).textContent||'').slice(0,60),
}));

// заходим в детский профиль и жмём «назад» — тут и спрашивают код
await p.evaluate(()=>{ if (typeof openChild === 'function') openChild(DEMO.children[0]); });
await p.waitForTimeout(600);
await p.evaluate(()=>document.getElementById('childBack').click());
await p.waitForTimeout(500);
console.log('ПЕРВЫЙ РАЗ: ' + JSON.stringify(await состояние()));
await набрать('2580');
console.log('ПОСЛЕ ПЕРВОГО ВВОДА: ' + JSON.stringify(await состояние()));
await набрать('2581');
console.log('НЕ СОВПАЛИ: ' + JSON.stringify(await состояние()));
await набрать('2580'); await набрать('2580');
console.log('СОЗДАН: ' + JSON.stringify(await состояние()));

// снова в детский профиль и обратно: теперь спрашивает
await p.evaluate(()=>{ if (typeof openChild === 'function') openChild(DEMO.children[0]); });
await p.waitForTimeout(500);
await p.evaluate(()=>document.getElementById('childBack').click());
await p.waitForTimeout(400);
await набрать('1234');
console.log('СТАРЫЙ ОБЩИЙ 1234: ' + JSON.stringify(await состояние()));
await набрать('2580');
console.log('СВОЙ КОД: ' + JSON.stringify(await состояние()));
console.log('ОШИБОК: ' + errs.length); errs.slice(0,3).forEach(e=>console.log(e));
await b.close();
