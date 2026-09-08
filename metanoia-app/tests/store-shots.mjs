// Снимки экранов для магазинов приложений и плитка для Play Market.
// Снимаем настоящее приложение в нужных размерах, потом подписываем.
import { chromium } from 'playwright';
import fs from 'fs';

const ВЫХОД = '/home/user/OKO-TEAM/metanoia-app/store/screens/';
fs.mkdirSync(ВЫХОД, { recursive: true });

const РАЗМЕРЫ = [
  { имя: 'android', ширина: 1080, высота: 1920, масштаб: 2.77 },   // Play и RuStore
  { имя: 'ios', ширина: 1290, высота: 2796, масштаб: 3.31 },       // App Store 6.7"
];

const ЭКРАНЫ = [
  { файл: 'home', подпись: 'Урок дня, стих и живой друг', как: async (p) => {
      await p.evaluate(() => document.querySelector('.nav__tab[data-tab="home"]').click());
    } },
  { файл: 'lessons', подпись: '105 уроков в трёх главах', как: async (p) => {
      await p.evaluate(() => document.querySelector('.nav__tab[data-tab="lessons"]').click());
    } },
  { файл: 'lesson', подпись: 'Читаем, слушаем голосом Екатерины', как: async (p) => {
      await p.evaluate(() => document.querySelector('.nav__tab[data-tab="lessons"]').click());
      await p.waitForTimeout(400);
      await p.evaluate(() => document.querySelector('.lesson-item').click());
    } },
  { файл: 'games', подпись: '17 добрых игр без замков', как: async (p) => {
      await p.evaluate(() => document.querySelector('.nav__tab[data-tab="games"]').click());
    } },
  { файл: 'pet', подпись: 'Друг растёт вместе с ребёнком', как: async (p) => {
      await p.evaluate(() => { if (typeof openPetScreen === 'function') openPetScreen(); });
    } },
  { файл: 'chats', подпись: 'Чаты школы с защитой для детей', как: async (p) => {
      await p.evaluate(() => document.querySelector('.nav__tab[data-tab="chats"]').click());
      await p.waitForTimeout(400);
      await p.evaluate(() => document.querySelectorAll('.chat-item')[1].click());
    } },
];

const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--no-sandbox', '--disable-background-networking', '--disable-gpu'] });

for (const р of РАЗМЕРЫ) {
  const p = await b.newPage({
    viewport: { width: Math.round(р.ширина / р.масштаб), height: Math.round(р.высота / р.масштаб) },
    deviceScaleFactor: р.масштаб,
  });
  await p.route((u) => !u.href.startsWith('http://127.0.0.1'), (r) => r.abort());
  await p.goto('http://127.0.0.1:8777/index.html', { waitUntil: 'load' });
  await p.evaluate(() => {
    localStorage.clear();
    localStorage.setItem('mt_onb', '1'); localStorage.setItem('mt_auth', '1');
    localStorage.setItem('mt_name', 'Мария'); localStorage.setItem('mt_music_off', '1');
    localStorage.setItem('mt_kids', JSON.stringify([{ name: 'Соня', age: 8, rank: '', streak: 0, img: 'assets/img/avatars/star.jpg' }]));
    localStorage.setItem('mt_dverse_streak', '6');
    // Снимок показывает обычный день семьи, а не пустой экран.
    localStorage.setItem('mt_seeds_today', JSON.stringify({ день: (() => { const d = new Date(); return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`; })(), сколько: 15 }));
    localStorage.setItem('mt_plays', JSON.stringify([Date.now() - 3600e3, Date.now() - 1800e3]));
    localStorage.setItem('mt_pet', JSON.stringify({ вид: 'lamb', имя: 'Заря', зёрна: 42, сытость: 80, радость: 85, рост: 34, день: '', дневник: [] }));
    [1, 2, 3].forEach((n) => localStorage.setItem('mt_lesson_' + n, JSON.stringify({ read: true, task: true, test: true, done: true, ts: Date.now() })));
  });
  await p.reload({ waitUntil: 'load' });
  await p.waitForSelector('.splash--hide', { timeout: 20000 }).catch(() => {});
  await p.waitForTimeout(1200);

  for (const э of ЭКРАНЫ) {
    await э.как(p);
    await p.waitForTimeout(900);
    await p.screenshot({ path: `${ВЫХОД}${р.имя}-${э.файл}.png` });
  }
  await p.close();
  console.log('сняты экраны для ' + р.имя);
}

// Плитка Play Market: делаем в браузере, чтобы взять наши шрифты и палитру.
const t = await b.newPage({ viewport: { width: 1024, height: 500 }, deviceScaleFactor: 1 });
const обложка = fs.readFileSync('/home/user/OKO-TEAM/metanoia-app/public_html/assets/img/chapters/ch1.jpg').toString('base64');
const лого = fs.readFileSync('/home/user/OKO-TEAM/metanoia-app/public_html/assets/img/logo.png').toString('base64');
const шрифты = fs.readFileSync('/home/user/OKO-TEAM/metanoia-app/public_html/assets/css/fonts.css', 'utf8')
  .replace(/url\('\.\.\/fonts\/([^']+)'\)/g, (_, ф) => {
    const b64 = fs.readFileSync('/home/user/OKO-TEAM/metanoia-app/public_html/assets/fonts/' + ф).toString('base64');
    return `url(data:font/woff2;base64,${b64})`;
  });
await t.setContent(`<html><head><style>${шрифты}
body{margin:0;width:1024px;height:500px;background:#FAF8F5;font-family:Montserrat,sans-serif;overflow:hidden}
.фон{position:absolute;inset:0;background:url(data:image/jpeg;base64,${обложка}) center/cover;opacity:.30}
.тень{position:absolute;inset:0;background:linear-gradient(90deg,#FAF8F5 42%,rgba(250,248,245,.55) 78%,rgba(250,248,245,.25))}
.строй{position:relative;display:flex;align-items:center;gap:34px;height:100%;padding:0 74px}
img{width:170px;height:170px}
h1{font-family:'Playfair Display',Georgia,serif;font-size:64px;color:#1A3A52;margin:0 0 10px;letter-spacing:.5px}
p{font-size:25px;color:#3C4658;margin:0;line-height:1.4;max-width:560px}
</style></head><body>
<div class="фон"></div><div class="тень"></div>
<div class="строй"><img src="data:image/png;base64,${лого}">
<div><h1>МЕТАНОЙЯ</h1><p>Христианская школа для детей 5–14 лет.<br>105 уроков, добрые игры и живой друг.</p></div></div>
</body></html>`);
await t.waitForTimeout(1200);
await t.screenshot({ path: '/home/user/OKO-TEAM/metanoia-app/store/icons/play-feature-1024x500.png' });
console.log('плитка Play готова');
await b.close();
