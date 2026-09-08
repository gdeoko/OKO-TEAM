import { chromium } from 'playwright';
const b = await chromium.launch({ executablePath:'/opt/pw-browsers/chromium', args:['--no-sandbox','--disable-gpu'] });
const p = await b.newPage({ viewport:{width:390,height:844} });
await p.route(u => !u.href.startsWith('http://127.0.0.1'), r=>r.abort());
await p.goto('http://127.0.0.1:8777/index.html',{waitUntil:'load'});
await p.evaluate(()=>{ localStorage.clear(); localStorage.setItem('mt_onb','1'); localStorage.setItem('mt_auth','1');
  localStorage.setItem('mt_kids','[{"name":"Соня","age":8}]'); localStorage.setItem('mt_xp','340'); });
await p.reload({waitUntil:'load'}); await p.waitForTimeout(1500);
p.on('dialog', d=>d.accept());
await p.evaluate(()=>document.querySelector('.nav__tab[data-tab="profile"]').click());
await p.waitForTimeout(300);
await p.click('#mWipe');
await p.waitForTimeout(4000);
console.log('онбординг после удаления виден: ' + await p.isVisible('#onbTrack'));
console.log('текст: ' + await p.evaluate(()=>document.body.innerText.slice(0,80).replace(/\n/g,' | ')));
// После удаления приложение стартует заново и само заводит нового друга
// и счётчик версии. Важно не то, что ключи есть, а то, что в них нет
// прежней семьи: ни детей, ни прогресса, ни переписки, а друг новый.
const остаток = await p.evaluate(()=>{
  const ключи = Object.keys(localStorage).filter(k=>k.startsWith('mt_'));
  const питомец = JSON.parse(localStorage.getItem('mt_pet') || '{}');
  return { ключи, кличка: питомец.имя || '', зёрна: питомец.зёрна || 0,
           рост: питомец.рост || 0, дневник: (питомец.дневник||[]).length };
});
console.log('ключи: ' + JSON.stringify(остаток.ключи));
console.log('друг после удаления: ' + JSON.stringify({кличка:остаток.кличка, зёрна:остаток.зёрна, рост:остаток.рост, дневник:остаток.дневник}));
// Новый друг: кличка по умолчанию, рост 8, дневник только про новый день.
const новый = остаток.кличка === 'Заря' && остаток.рост === 8 && остаток.дневник <= 1;
const плохо = остаток.ключи.filter(k=>!['mt_pet','mt_rev'].includes(k)).length + (новый ? 0 : 1);
console.log('ОШИБОК: ' + плохо);
await b.close();
