// Озвучка урока: настоящий mp3 запрашивается и играет, а не молчит.
//
// Раньше проверка ждала, что у уроков 1-14 кнопки озвучки нет: их тексты
// прислала Екатерина, а записи ещё не было. Теперь все четырнадцать
// озвучены её голосом, поэтому кнопка должна быть и там, и в наших уроках.
import { chromium } from 'playwright';
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--no-sandbox', '--autoplay-policy=no-user-gesture-required'] });
const p = await b.newPage({ viewport: { width: 390, height: 844 } });
const запросы = []; p.on('request', r => { if (/\.mp3/.test(r.url())) запросы.push(r.url().split('/').slice(-2).join('/')); });
const провалы = []; p.on('response', r => { if (/\.mp3/.test(r.url()) && r.status() >= 400) провалы.push(r.url().split('/').pop() + ' → ' + r.status()); });
const errs = []; p.on('pageerror', e => errs.push(e.message));
await p.goto('http://127.0.0.1:8777/index.html', { waitUntil: 'domcontentloaded' });
await p.evaluate(() => { localStorage.setItem('mt_onb', '1'); localStorage.setItem('mt_auth', '1'); });
await p.reload({ waitUntil: 'domcontentloaded' });
await p.waitForTimeout(2800);

let плохо = 0;

// Урок Екатерины и наш урок — оба со звучащей кнопкой.
for (const n of [1, 20]) {
  await p.evaluate((n) => openLesson(n), n);
  await p.waitForTimeout(700);
  const кнопка = await p.$('#lessonVoice');
  if (!кнопка) {
    console.log('урок ' + n + ': кнопки озвучки нет');
    плохо++;
    continue;
  }
  const адрес = await p.$eval('#lessonVoice', (e) => e.dataset.src);
  await p.click('#lessonVoice');
  await p.waitForTimeout(2500);
  const играет = await p.$eval('#lessonVoice', e => e.classList.contains('lesson-voice--playing')).catch(() => false);
  console.log('урок ' + n + ': файл ' + адрес + ', играет=' + играет);
  if (!играет) { console.log('ОЙ: урок ' + n + ' молчит'); плохо++; }
  // Останавливаем, иначе следующий урок запустится поверх этого.
  await p.click('#lessonVoice').catch(() => {});
  await p.waitForTimeout(400);
}

console.log('ЗАПРОШЕНО АУДИО: ' + [...new Set(запросы)].join(', '));
if (провалы.length) { console.log('ОЙ: не отдались файлы: ' + провалы.join(', ')); плохо++; }
if (errs.length) { console.log('ОШИБКИ СТРАНИЦЫ: ' + errs.slice(0, 3).join(' | ')); плохо++; }
console.log('ОШИБОК: ' + плохо);
await b.close();
process.exit(плохо ? 1 : 0);
