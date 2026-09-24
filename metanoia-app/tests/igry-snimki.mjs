// Снимки всех игр изнутри: смотрим, что видит ребёнок в самой игре.
// node igry-snimki.mjs
import { chromium } from 'playwright';
import fs from 'fs';

const куда = '/tmp/claude-0/-home-user-OKO-TEAM/22db9df3-3654-5e6a-a203-b5dfa5e4c7a0/scratchpad/igry';
fs.mkdirSync(куда, { recursive: true });

const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--no-sandbox'] });
const p = await b.newPage({ viewport: { width: 390, height: 844 } });
await p.goto('http://127.0.0.1:8777/index.html', { waitUntil: 'load' });
await p.evaluate(() => {
  localStorage.clear();
  localStorage.setItem('mt_onb', '1');
  localStorage.setItem('mt_auth', '1');
  localStorage.setItem('mt_music_off', '1');
  localStorage.setItem('mt_kids', JSON.stringify([{ лид: 1, name: 'Милана', age: 8, img: 'assets/img/avatars/star.jpg' }]));
  localStorage.setItem('mt_active_kid', '1');
});
await p.reload({ waitUntil: 'load' });
await p.waitForSelector('.splash--hide', { timeout: 20000 }).catch(() => {});
await p.waitForTimeout(1000);

const ключи = await p.evaluate(() => GAMES.map((g) => g.key));
for (const к of ключи) {
  try {
    await p.evaluate((к) => openGame(к), к);
  } catch (e) {
    console.log(к, 'не открылась:', String(e).slice(0, 60));
    continue;
  }
  await p.waitForTimeout(1100);
  await p.screenshot({ path: `${куда}/${к}.png` });
  // Считаем, сколько настоящих картинок внутри активного экрана игры.
  const внутри = await p.evaluate(() => {
    const экран = document.querySelector('.screen--active');
    if (!экран) return { экран: 'нет' };
    const кадры = [...экран.querySelectorAll('img')].filter((и) => и.naturalWidth > 0);
    return {
      экран: экран.dataset.screen,
      картинок: кадры.length,
      битых: [...экран.querySelectorAll('img')].filter((и) => и.complete && и.naturalWidth === 0).length,
      холст: экран.querySelectorAll('canvas').length,
      текста: (экран.innerText || '').replace(/\s+/g, ' ').length,
    };
  });
  console.log('%-12s %s', к, JSON.stringify(внутри));
}
console.log('снимки в', куда);
await b.close();
