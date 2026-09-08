// Держатся ли действия после перезапуска: лайк, комментарий, стих дня,
// семейный квест, алтарь, уведомления.
import { chromium } from 'playwright';
const b = await chromium.launch({ executablePath:'/opt/pw-browsers/chromium', args:['--no-sandbox','--disable-background-networking','--disable-gpu'] });
const p = await b.newPage({ viewport:{width:390,height:844} });
const errs=[]; p.on('pageerror', e=>errs.push('PAGEERROR: '+e.message));
await p.route(u => !u.href.startsWith('http://127.0.0.1'), r=>r.abort());
const открыть = async () => {
  await p.goto('http://127.0.0.1:8777/index.html',{waitUntil:'load'});
  await p.waitForSelector('.splash--hide',{timeout:20000}).catch(()=>{});
  await p.waitForTimeout(700);
};
await p.goto('http://127.0.0.1:8777/index.html',{waitUntil:'load'});
await p.evaluate(()=>{ localStorage.clear(); localStorage.setItem('mt_onb','1'); localStorage.setItem('mt_auth','1'); });
await открыть();

const действия = await p.evaluate(async ()=>{
  const пауза=(м)=>new Promise(r=>setTimeout(r,м));
  const шаги={};
  // лайк на карточке ленты
  const лайк=document.querySelector('#feed [data-act="like"]');
  if (лайк) { лайк.click(); await пауза(300); шаги.лайк='нажали, стало ' + лайк.innerText.trim(); } else шаги.лайк='кнопки нет';
  // комментарий
  const комм=document.querySelector('#feed [data-act="comment"]');
  if (комм) { комм.click(); await пауза(600);
    const поле=document.querySelector('#sheetWrap input, #sheetWrap textarea');
    const отпр=[...document.querySelectorAll('#sheetWrap button')].find(e=>/отправ|послать/i.test(e.innerText||''));
    if (поле) { поле.value='Спасибо за урок'; поле.dispatchEvent(new Event('input',{bubbles:true})); await пауза(200);
      if (отпр) отпр.click(); else поле.dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',bubbles:true}));
      await пауза(600); шаги.комментарий='отправили'; } else шаги.комментарий='поля нет';
    document.querySelector('#sheetWrap [data-close], #sheetClose')?.click();
    await пауза(300);
  }
  // стих дня: получить очки
  if (typeof openDailyVerse==='function') { openDailyVerse(); await пауза(600);
    const к=document.getElementById('dverseClaim');
    if (к && !к.disabled) { к.click(); await пауза(700); шаги.стих='получили'; } else шаги.стих='уже получен';
    document.getElementById('dverseClose')?.click();
  }
  // семейный квест: отметить дело
  if (typeof openQuest==='function') { openQuest(); await пауза(500);
    const д=document.querySelector('#fqTasks [data-fq]');
    if (д) { д.click(); await пауза(500); шаги.квест='отметили'; } else шаги.квест='дел нет';
  }
  // алтарь: отметить день
  if (typeof openDevotional==='function') { openDevotional(); await пауза(600);
    const к=[...document.querySelectorAll('#devBody button')].find(e=>/прочит|готово|отмет|сделал/i.test(e.innerText||''));
    if (к) { к.click(); await пауза(500); шаги.алтарь='отметили'; } else шаги.алтарь='кнопки нет';
  }
  return шаги;
});
console.log('ДЕЙСТВИЯ: ' + JSON.stringify(действия));
const память1 = await p.evaluate(()=>({
  лайки: localStorage.getItem('mt_likes'), комменты: localStorage.getItem('mt_comments'), стих: localStorage.getItem('mt_dverse_date'),
  серия: localStorage.getItem('mt_dverse_streak'), квест: localStorage.getItem('mt_quest'),
  зёрна: (JSON.parse(localStorage.getItem('mt_pet')||'{}')||{}).зёрна,
}));
console.log('В ПАМЯТИ ДО: ' + JSON.stringify(память1));
await открыть();
const память2 = await p.evaluate(()=>({
  лайки: localStorage.getItem('mt_likes'), комменты: localStorage.getItem('mt_comments'), стих: localStorage.getItem('mt_dverse_date'),
  серия: localStorage.getItem('mt_dverse_streak'), квест: localStorage.getItem('mt_quest'),
  зёрна: (JSON.parse(localStorage.getItem('mt_pet')||'{}')||{}).зёрна,
}));
console.log('В ПАМЯТИ ПОСЛЕ: ' + JSON.stringify(память2));
console.log('СОВПАДАЕТ: ' + (JSON.stringify(память1)===JSON.stringify(память2)));
console.log('ОШИБОК: ' + errs.length); errs.slice(0,4).forEach(e=>console.log(e));
await b.close();
