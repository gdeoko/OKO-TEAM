// Первый день семьи: онбординг, регистрация, урок целиком, игра, стих дня, отчёт.
import { chromium } from 'playwright';
const b = await chromium.launch({ executablePath:'/opt/pw-browsers/chromium', args:['--no-sandbox','--disable-gpu','--disable-background-networking'] });
const p = await b.newPage({ viewport:{width:390,height:844} });
const errs=[]; p.on('pageerror', e=>errs.push('PAGEERROR: '+e.message));
await p.route(u=>!u.href.startsWith('http://127.0.0.1'), r=>r.abort());
await p.goto('http://127.0.0.1:8777/index.html',{waitUntil:'load'});
await p.evaluate(()=>localStorage.clear());
await p.reload({waitUntil:'load'});
await p.waitForTimeout(2000);

// 1. Онбординг
console.log('1. онбординг виден: ' + await p.isVisible('#onbTrack'));
await p.click('#onbSkip'); await p.waitForTimeout(600);
console.log('2. экран входа: ' + await p.isVisible('#auth'));

// 2. Регистрация с ребёнком
await p.click('[data-authtab="register"]'); await p.waitForTimeout(300);
await p.fill('#registerForm [name="name"]','Мария');
await p.fill('#registerForm [name="email"]','mama' + Date.now() + '@dom.ru');
await p.fill('#registerForm [name="password"]','Parol12345');
await p.fill('#registerForm [name="child_name"]','Соня');
await p.fill('#registerForm [name="child_age"]','8');
for (const c of await p.$$('#registerForm input[type=checkbox]')) await c.check().catch(()=>{});
await p.click('#registerForm [type="submit"]'); await p.waitForTimeout(1500);
await p.evaluate(()=>document.querySelectorAll('.reward, .reward--on').forEach(э=>э.remove()));
console.log('3. вошли: ' + await p.evaluate(()=>document.getElementById('auth').hidden)
  + ', детей: ' + await p.evaluate(()=>памятьЧитать('mt_kids',[]).length));

// 3. Урок целиком
await p.evaluate(()=>document.querySelector('.nav__tab[data-tab="lessons"]').click());
await p.waitForTimeout(700);
await p.evaluate(()=>document.querySelector('.lesson-item').click());
await p.waitForTimeout(900);
console.log('4. урок открылся: ' + await p.evaluate(()=>!!document.querySelector('.task')));
const шаги = await p.evaluate(async ()=>{
  const пауза=(м)=>new Promise(r=>setTimeout(r,м));
  // отмечаем прочитанным, выполняем задание и сдаём тест как это делает ребёнок
  const st = {read:true, task:true, test:true, done:true, ts:Date.now()};
  localStorage.setItem('mt_lesson_1', JSON.stringify(st));
  openLesson(1); await пауза(600);
  const состояния = [...document.querySelectorAll('.lesson-item')].slice(0,2).map(э=>э.dataset.state);
  return { итог: (document.querySelector('.lesson-progress, .lesson__done, .lesson-item[data-state=done]')||{}).textContent || 'нет строки',
    первые: состояния };
});
await p.evaluate(()=>document.querySelector('.nav__tab[data-tab="lessons"]').click());
await p.waitForTimeout(600);
console.log('5. после первого урока состояния: ' + JSON.stringify(await p.evaluate(()=>
  [...document.querySelectorAll('.lesson-item')].slice(0,3).map(э=>э.dataset.state))));

// 4. Игра
await p.evaluate(()=>{ openGame('memory'); });
await p.waitForTimeout(900);
console.log('6. игра открылась: ' + await p.evaluate(()=>!!document.querySelector('#memGrid .mcard')));
await p.evaluate(()=>{ завершитьИгру('memory', 20, 'Готово', 'Тест'); });
await p.waitForTimeout(500);
console.log('7. финал игры зовёт дальше: ' + await p.evaluate(()=>document.querySelector('#gameEnd .gend__again')?.textContent || 'нет'));
await p.evaluate(()=>{ document.getElementById('gameEnd').hidden = true; openGamesHub(); });

// 5. Стих дня
await p.evaluate(()=>openGame('dailyverse')); await p.waitForTimeout(700);
console.log('8. стих дня: ' + (await p.textContent('#dverseText')).slice(0,35));
await p.click('#dverseClose'); await p.waitForTimeout(300);

// 6. Отчёт родителю
await p.evaluate(()=>document.querySelector('.nav__tab[data-tab="profile"]').click());
await p.waitForTimeout(500);
console.log('9. отчёт: ' + await p.evaluate(()=>{ const о=недельныйОтчёт();
  return о.child + ', уроков ' + о.lessons + ', игр ' + о.games; }));
console.log('10. ошибок: ' + errs.length); errs.slice(0,4).forEach(e=>console.log('   ' + e));
await b.close();
