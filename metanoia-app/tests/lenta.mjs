// Лента главной идёт за настоящим местом ребёнка в программе.
// Раньше карточки были прибиты к урокам 1 и 2: ребёнок доходил до тридцатого,
// а его всё звали в «Новый урок 1». И текущий урок не повторяем дважды:
// он уже стоит выше, в блоке «Сегодня».
import { chromium } from 'playwright';
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--no-sandbox'] });
const p = await b.newPage({ viewport: { width: 390, height: 844 } });
const errs = []; p.on('pageerror', (e) => errs.push(e.message));
await p.route((u) => !u.href.startsWith('http://127.0.0.1'), (r) => r.abort());
await p.goto('http://127.0.0.1:8777/index.html', { waitUntil: 'load' });
let плохо = 0;

const завести = (пройдено) => p.evaluate((до) => {
  localStorage.clear();
  localStorage.setItem('mt_onb', '1'); localStorage.setItem('mt_auth', '1');
  localStorage.setItem('mt_kids', JSON.stringify([{ лид: 1, name: 'Соня', age: 8, img: 'assets/img/avatars/star.jpg' }]));
  localStorage.setItem('mt_active_kid', '1');
  for (let n = 1; n <= до; n++) {
    localStorage.setItem('mt_lesson_' + n, JSON.stringify({ read: true, task: true, test: true, done: true, ts: Date.now() }));
  }
}, пройдено);

const снять = () => p.evaluate(() => {
  const сег = document.getElementById('todayLessonTitle');
  const карточки = [...document.querySelectorAll('#feed .feed-card')]
    .filter((к) => к.querySelector('[data-act="watch"]'))
    .map((к) => ({
      метка: (к.querySelector('.feed-card__type') || {}).textContent || '',
      имя: (к.querySelector('.feed-card__title') || {}).textContent || '',
      номер: (к.querySelector('[data-act="watch"]') || {}).dataset.n,
    }));
  return { сегодня: сег ? сег.textContent.trim() : '', карточки };
});

for (const [пройдено, ждём] of [[0, 1], [3, 4], [29, 30]]) {
  await завести(пройдено);
  await p.reload({ waitUntil: 'load' });
  await p.waitForTimeout(1100);
  const было = await снять();
  console.log('пройдено ' + пройдено + ':', JSON.stringify(было));
  if (!было.сегодня) { console.log('ОЙ: блок «Сегодня» пуст'); плохо++; }
  if (было.карточки.length !== 2) { console.log('ОЙ: карточек урока не две'); плохо++; }
  const номера = было.карточки.map((к) => Number(к.номер));
  if (номера[0] !== ждём + 1 || номера[1] !== ждём + 2) {
    console.log('ОЙ: в ленте уроки ' + номера.join(',') + ', а ждали ' + (ждём + 1) + ',' + (ждём + 2)); плохо++;
  }
  if (номера.includes(ждём)) { console.log('ОЙ: текущий урок задвоен в ленте'); плохо++; }
  if (было.карточки[0].метка.trim() !== 'Следующий урок') {
    console.log('ОЙ: не та метка: ' + было.карточки[0].метка); плохо++;
  }
  // Название в карточке совпадает с оглавлением, а не с прошитым текстом.
  const верно = await p.evaluate((н) => {
    const м = lessonMeta(н); return 'Урок ' + (м.l.cn || н) + '. ' + м.l.title;
  }, номера[0]);
  if (было.карточки[0].имя.trim() !== верно) {
    console.log('ОЙ: имя урока в ленте ' + JSON.stringify(было.карточки[0].имя) + ', в оглавлении ' + JSON.stringify(верно)); плохо++;
  }
}

// Конец программы: вторая карточка просто уходит, а не показывает пустоту.
await завести(105);
await p.reload({ waitUntil: 'load' });
await p.waitForTimeout(1100);
const конец = await снять();
console.log('пройдено всё:', JSON.stringify(конец));
if (конец.карточки.length) { console.log('ОЙ: после последнего урока в ленте остались карточки'); плохо++; }

if (errs.length) { console.log('ОШИБКИ СТРАНИЦЫ:', errs.slice(0, 3)); плохо++; }
console.log('ОШИБОК: ' + плохо);
await b.close();
process.exit(плохо ? 1 : 0);
