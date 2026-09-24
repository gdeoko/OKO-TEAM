// Снимки урока: помощники, словарь и финал тетради — смотрим глазами.
// node snimok-urok.mjs [номер урока]
import { chromium } from 'playwright';
const урок = Number(process.argv[2] || 1);
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--no-sandbox'] });
const p = await b.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
await p.goto('http://127.0.0.1:8777/index.html', { waitUntil: 'load' });
await p.evaluate(() => {
  localStorage.clear();
  localStorage.setItem('mt_onb', '1');
  localStorage.setItem('mt_auth', '1');
  localStorage.setItem('mt_kids', JSON.stringify([{ лид: 1, name: 'Милана', age: 8, img: 'assets/img/avatars/star.jpg' }]));
  localStorage.setItem('mt_active_kid', '1');
  for (let n = 1; n <= 4; n++) {
    localStorage.setItem('mt_lesson_' + n,
      JSON.stringify({ read: true, task: true, test: true, done: true, ts: Date.now() }));
  }
});
await p.reload({ waitUntil: 'load' });
await p.waitForTimeout(1200);
await p.evaluate((n) => openLesson(n), урок);
await p.waitForTimeout(1200);
const путь = `/tmp/claude-0/-home-user-OKO-TEAM/22db9df3-3654-5e6a-a203-b5dfa5e4c7a0/scratchpad/urok${урок}.png`;
await p.locator('[data-screen="lesson"]').screenshot({ path: путь });
console.log(путь);
await b.close();
