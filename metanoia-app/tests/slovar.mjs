// Словарь «НЕТ» Екатерины: чего в текстах школы быть не должно.
//
// Её анкета и ТЗ на айдентику запрещают три вещи разом: страх и наказание
// как рычаг, обесценивание родительского труда и давление продажами.
// Проверка читает текст, который видит семья, и ищет эти обороты.
// Слова из библейских рассказов не в счёт: там «грех» и «наказание» —
// часть истории, а не обращение к ребёнку.
import { chromium } from 'playwright';

const ЗАПРЕТЫ = [
  { имя: 'страх и наказание как рычаг', re: /(бог|господь)\s+(теб[яе]\s+)?накаж|божьего наказания|накажет теб/i },
  { имя: 'долженствование', re: /\bты (должен|должна|обязан|обязана)\b/i },
  { имя: 'обесценивание', re: /\b(это (совсем )?просто|проще простого|это легко|элементарно)\b/i },
  { имя: 'драма', re: /\b(катастроф|беда с|ужас как)/i },
  { имя: 'давление продажами', re: /\b(срочно|успей|торопись|последний шанс|не упусти|гарантиру[юе])\b/i },
  { имя: 'сравнение с другими', re: /а вот (другие|те) (дети|родители)/i },
];

const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--no-sandbox'] });
const p = await b.newPage({ viewport: { width: 390, height: 844 } });
await p.goto('http://127.0.0.1:8777/index.html', { waitUntil: 'load' });
await p.evaluate(() => {
  localStorage.clear();
  localStorage.setItem('mt_onb', '1');
  localStorage.setItem('mt_auth', '1');
  localStorage.setItem('mt_kids', JSON.stringify([{ лид: 1, name: 'Милана', age: 8, img: 'assets/img/avatars/star.jpg' }]));
  localStorage.setItem('mt_active_kid', '1');
});
await p.reload({ waitUntil: 'load' });
await p.waitForTimeout(1200);

let плохо = 0;

// Собираем весь текст интерфейса: подписи экранов, кнопки, карточки.
// Рассказы уроков сюда не берём — это пересказ Писания, а не наш голос.
const тексты = await p.evaluate(() => {
  const куски = [];
  document.querySelectorAll('.screen').forEach((э) => {
    const копия = э.cloneNode(true);
    копия.querySelectorAll('.lesson-story, .lesson-pager, .slovar__t').forEach((x) => x.remove());
    куски.push({ экран: э.dataset.screen, текст: копия.innerText.replace(/\s+/g, ' ') });
  });
  return куски;
});
console.log('экранов осмотрено:', тексты.length);

for (const { экран, текст } of тексты) {
  for (const з of ЗАПРЕТЫ) {
    const м = текст.match(з.re);
    if (м) {
      const i = Math.max(0, текст.indexOf(м[0]) - 60);
      console.log(`ОЙ: ${экран} — ${з.имя}: …${текст.slice(i, i + 160)}…`);
      плохо++;
    }
  }
}

// Отдельно смотрим экран «О школе» и документы: там говорит сама школа.
for (const экран of ['about', 'privacy', 'donate', 'partner']) {
  const есть = await p.evaluate((э) => !!document.querySelector(`[data-screen="${э}"]`), экран);
  if (!есть) continue;
  const текст = await p.evaluate((э) =>
    (document.querySelector(`[data-screen="${э}"]`).innerText || '').replace(/\s+/g, ' '), экран);
  for (const з of ЗАПРЕТЫ) {
    if (з.re.test(текст)) { console.log(`ОЙ: ${экран} — ${з.имя}`); плохо++; }
  }
}

// Её правка возраста: школа про начальную школу, а не про 5-14.
const возраст = await p.evaluate(() => document.body.innerHTML);
if (/5\s*[–-]\s*14/.test(возраст)) { console.log('ОЙ: где-то остался возраст 5-14'); плохо++; }

console.log('ОШИБОК: ' + плохо);
await b.close();
process.exit(плохо ? 1 : 0);
