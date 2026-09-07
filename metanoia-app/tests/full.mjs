import { chromium } from 'playwright';
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--no-sandbox'] });
const p = await b.newPage({ viewport: { width: 390, height: 844 } });
const errs = [], m404 = new Set();
p.on('console', m => { if (m.type()==='error' && !/404|Failed to load resource/.test(m.text())) errs.push('CONSOLE: '+m.text()); });
p.on('pageerror', e => errs.push('PAGEERROR: ' + e.message));
p.on('response', r => { if (r.status()===404) m404.add(r.url().split('/').slice(-2).join('/')); });
await p.goto('http://127.0.0.1:8777/index.html', { waitUntil:'domcontentloaded' });
await p.evaluate(() => { localStorage.setItem('mt_onb','1'); localStorage.setItem('mt_auth','1');
  // семья заводит ребёнка сама, для обхода добавим одного
  localStorage.setItem('mt_kids', JSON.stringify([{name:'Соня', age:8, rank:'', streak:0, img:'assets/img/avatars/star.jpg'}])); });
await p.reload({ waitUntil:'domcontentloaded' });
await p.waitForTimeout(3000);

for (const t of ['games','chats','lessons','profile','home']) {
  await p.click(`.nav__tab[data-tab="${t}"]`).catch(()=>{});
  await p.waitForTimeout(400);
}
// урок
await p.click('.nav__tab[data-tab="lessons"]'); await p.waitForTimeout(400);
await p.click('.lesson-item'); await p.waitForTimeout(900);
console.log('УРОК: задание=' + !!(await p.$('.task')) + ' картинка=' + !!(await p.$('.lesson-pic')) + ' прочитано=' + !!(await p.$('#lessonRead')) + ' итог=' + !!(await p.$('.lesson-final')));
await p.screenshot({ path:'shot-lesson.png' });
// пройти шаги урока
await p.click('#lessonRead').catch(()=>{});
await p.waitForTimeout(400);
const итог = await p.textContent('.lesson-final').catch(()=>'');
console.log('ИТОГ УРОКА: ' + (итог||'').trim().slice(0,120));
// список уроков: второй закрыт?
await p.click('#lessonBack'); await p.waitForTimeout(500);
const второй = await p.$$eval('.lesson-item', els => els.slice(0,3).map(e => e.dataset.state));
console.log('СОСТОЯНИЯ ПЕРВЫХ ТРЁХ УРОКОВ: ' + второй.join(', '));
await p.screenshot({ path:'shot-lessons.png' });
// питомец
await p.click('.nav__tab[data-tab="profile"]'); await p.waitForTimeout(400);
await p.click('.child-card'); await p.waitForTimeout(600);
await p.click('#openPet').catch(e=>errs.push('питомец: '+e.message));
await p.waitForTimeout(700);
console.log('ПИТОМЕЦ: экран=' + !!(await p.$('[data-screen="pet"].screen--active')) + ' игры внутри=' + (await p.$$('#petGames .gcard')).length);
await p.screenshot({ path:'shot-pet.png' });
// игры
await p.reload({ waitUntil:'domcontentloaded' }); await p.waitForTimeout(2800);
await p.click('.nav__tab[data-tab="games"]'); await p.waitForTimeout(600);
console.log('ИГР В ХАБЕ: ' + (await p.$$('#ghub .gcard')).length + ' вкладок(должно 0): ' + (await p.$$('.ghub-tab')).length);
await p.screenshot({ path:'shot-games.png' });
// главная
await p.click('.nav__tab[data-tab="home"]'); await p.waitForTimeout(500);
console.log('ГЛАВНАЯ: блок урока=' + !!(await p.$('#todayLesson')) + ' треугольников видео=' + (await p.$$('.feed-card__play')).length);
await p.screenshot({ path:'shot-home.png' });

console.log('--- ОШИБКИ (' + errs.length + ') ---');
errs.slice(0,15).forEach(e=>console.log(e));
console.log('--- НЕТ ФАЙЛОВ (' + m404.size + ') ---');
[...m404].slice(0,20).forEach(u=>console.log(u));
await b.close();
