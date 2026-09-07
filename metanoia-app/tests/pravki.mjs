// Сверка по списку правок Екатерины: каждый пункт проверяем в живом приложении.
import { chromium } from 'playwright';
const b = await chromium.launch({ executablePath:'/opt/pw-browsers/chromium', args:['--no-sandbox','--disable-background-networking','--disable-gpu'] });
const p = await b.newPage({ viewport:{width:390,height:844} });
const errs=[]; p.on('pageerror', e=>errs.push('PAGEERROR: '+e.message));
await p.route(u => !u.href.startsWith('http://127.0.0.1'), r=>r.abort());
await p.goto('http://127.0.0.1:8777/index.html',{waitUntil:'load'});
await p.evaluate(()=>{ localStorage.clear(); localStorage.setItem('mt_onb','1'); localStorage.setItem('mt_auth','1'); localStorage.setItem('mt_music_off','0');
  localStorage.setItem('mt_kids', JSON.stringify([{name:'Соня', age:8, rank:'', streak:0, img:'assets/img/avatars/star.jpg'}])); });
await p.reload({waitUntil:'load'});
await p.waitForSelector('.splash--hide',{timeout:20000}).catch(()=>{});
await p.waitForTimeout(900);

const итог = await p.evaluate(async ()=>{
  const пауза=(м)=>new Promise(r=>setTimeout(r,м));
  const текст = () => document.body.innerText;
  const из = {};

  // 1. Главная
  document.querySelector('.nav__tab[data-tab="home"]').click(); await пауза(500);
  из['1. созвонов на главной нет'] = !/созвон/i.test(текст());
  из['1. блок «Сегодня» про урок'] = /Сегодня/.test(текст()) && !!document.querySelector('.today');
  из['1. кнопка перехода'] = /Перейти|Продолжить|Пройти ещё раз/.test(текст());
  из['1. треугольников видео нет'] = document.querySelectorAll('.feed-card__play, .play-triangle').length === 0;

  // 2. Игры
  document.querySelector('.nav__tab[data-tab="games"]').click(); await пауза(500);
  из['2. полок «Бесплатные/Метанойя+» нет'] = !/Бесплатн|Метанойя\+/i.test(текст());
  из['2. храма нет'] = !/храм/i.test(текст());
  из['2. у всех игр картинки'] = [...document.querySelectorAll('[data-game]')].every(э => !!э.querySelector('img'));
  из['2. игр'] = document.querySelectorAll('[data-game]').length;
  из['2. XP в подписях нет'] = !/\bXP\b/.test(текст());
  из['2. музыка в играх есть'] = typeof startGameMusic === 'function';

  // 3. Чаты
  document.querySelector('.nav__tab[data-tab="chats"]').click(); await пауза(500);
  из['3. стикеров'] = (typeof STICKERS !== 'undefined') ? STICKERS.length : 0;
  из['3. защита чатов'] = typeof проверитьСообщение === 'function' && typeof blockPerson === 'function';

  // 4. Уроки
  document.querySelector('.nav__tab[data-tab="lessons"]').click(); await пауза(600);
  из['4. созвонов и «Записаться» нет'] = !/созвон|Записаться/i.test(текст());
  из['4. «Программы года» нет'] = !/Программа года/i.test(текст());
  из['4. у каждого урока картинка и номер'] = [...document.querySelectorAll('.lesson-item')].every(э =>
    !!э.querySelector('img') && !!э.querySelector('.lesson-item__badge'));
  const сост = [...document.querySelectorAll('.lesson-item')].slice(0,3).map(э=>э.dataset.state);
  из['4. первый открыт, дальше закрыты'] = сост[0]==='open' && сост[1]==='locked';
  document.querySelector('.lesson-item').click(); await пауза(700);
  из['4. задание в уроке'] = !!document.querySelector('.task');
  из['4. «Прикрепить задание»'] = /Прикрепить задание|Заменить файл/.test(текст());
  из['4. картинка в проверке знаний'] = (typeof lessonCover === 'function');
  document.getElementById('lessonBack').click(); await пауза(400);

  // 5. Профиль
  document.querySelector('.nav__tab[data-tab="profile"]').click(); await пауза(500);
  из['5. мини-игр в профиле нет'] = !/Мини-игры/i.test(текст());
  из['5. «Презентаций» нет'] = !/Презентац/i.test(текст());
  из['5. «Метанойя+» нет'] = !/Метанойя\+/i.test(текст());

  // 6. Дети
  из['6. сертификатов'] = (typeof CERTIFICATES !== 'undefined') ? CERTIFICATES.length : 0;
  из['6. годового сертификата нет'] = (typeof CERTIFICATES !== 'undefined') && !CERTIFICATES.some(c=>c.key==='year');
  из['6. рейтинг у ребёнка'] = !!document.getElementById('openRating');

  // 7. Детали
  из['7. активный таб выделен'] = !!document.querySelector('.nav__tab--active[aria-current]');
  из['7. испанский переключатель'] = !!document.getElementById('mLang');
  из['7. политика в меню'] = !!document.getElementById('mPrivacy');
  из['7. согласия при регистрации'] = document.querySelectorAll('#registerForm input[type=checkbox]').length;
  return из;
});
Object.entries(итог).forEach(([k,v])=>console.log((v===true?'✔':v===false?'✘':'·') + ' ' + k + ': ' + v));
console.log('ОШИБОК: ' + errs.length); errs.slice(0,3).forEach(e=>console.log(e));
await b.close();
