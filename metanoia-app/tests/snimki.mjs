// Снимки всех основных экранов для просмотра глазами.
// node snimki.mjs [ширина]   по умолчанию 390
import { chromium } from 'playwright';
import fs from 'fs';

const ширина = Number(process.argv[2] || 390);
const куда = `/tmp/claude-0/-home-user-OKO-TEAM/22db9df3-3654-5e6a-a203-b5dfa5e4c7a0/scratchpad/ekrany${ширина}`;
fs.mkdirSync(куда, { recursive: true });

const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--no-sandbox'] });
const p = await b.newPage({ viewport: { width: ширина, height: 844 }, deviceScaleFactor: 1 });
await p.goto('http://127.0.0.1:8777/index.html', { waitUntil: 'load' });
await p.evaluate(() => {
  localStorage.clear();
  localStorage.setItem('mt_onb', '1');
  localStorage.setItem('mt_auth', '1');
  localStorage.setItem('mt_kids', JSON.stringify([{ лид: 1, name: 'Милана', age: 8, img: 'assets/img/avatars/star.jpg' }]));
  localStorage.setItem('mt_active_kid', '1');
  for (let n = 1; n <= 3; n++) {
    localStorage.setItem('mt_lesson_' + n,
      JSON.stringify({ read: true, task: true, test: true, done: true, ts: Date.now() }));
  }
  localStorage.setItem('mt_lvl_memory', '3');
});
await p.reload({ waitUntil: 'load' });
// Заставка уходит сама: без ожидания снимок ловит её полупрозрачной поверх экрана.
await p.waitForSelector('.splash--hide', { timeout: 20000 }).catch(() => {});
await p.waitForTimeout(1200);

const шаги = [
  ['home', () => switchTab('home')],
  ['search', () => switchTab('search')],
  ['chats', () => switchTab('chats')],
  ['lessons', () => switchTab('lessons')],
  ['profile', () => switchTab('profile')],
  ['games', () => openGamesHub()],
  ['about', () => openAbout()],
  ['child', () => (typeof openChild === 'function'
    ? openChild(памятьЧитать('mt_kids', [])[0]) : switchTab('profile'))],
  ['rating', () => openRatingScreen()],
  ['book', () => openBook()],
  ['shop', () => openShop()],
  ['pet', () => openPetScreen()],
  ['journey', () => (typeof openJourneyScreen === 'function' ? openJourneyScreen() : switchTab('profile'))],
  ['settings', () => (typeof openSettingsScreen === 'function' ? openSettingsScreen() : switchTab('profile'))],
];

for (const [имя, шаг] of шаги) {
  try {
    await p.evaluate(шаг);
  } catch (e) {
    console.log(имя, 'не открылся:', String(e).slice(0, 80));
    continue;
  }
  await p.waitForTimeout(900);
  await p.screenshot({ path: `${куда}/${имя}.png` });
  console.log(имя);
}
console.log('снимки в', куда);
await b.close();
