// Баллы школы и зёрна друга — два разных счёта.
//
// Ловили на этом: счётчик был один, и ребёнок, покормивший ягнёнка,
// терял ранг, место в рейтинге и деньги в лавке.
import { chromium } from 'playwright';
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--no-sandbox'] });
const p = await b.newPage({ viewport: { width: 390, height: 844 } });
const errs = []; p.on('pageerror', (e) => errs.push(e.message));
await p.goto('http://127.0.0.1:8777/index.html', { waitUntil: 'load' });
await p.evaluate(() => {
  localStorage.clear();
  localStorage.setItem('mt_onb', '1');
  localStorage.setItem('mt_auth', '1');
  localStorage.setItem('mt_kids', JSON.stringify([{ лид: 1, name: 'Милана', age: 8, img: 'assets/img/avatars/star.jpg' }]));
  localStorage.setItem('mt_active_kid', '1');
});
await p.reload({ waitUntil: 'load' });
await p.waitForSelector('.splash--hide', { timeout: 20000 }).catch(() => {});
await p.waitForTimeout(900);
let плохо = 0;

const счёт = () => p.evaluate(() => ({
  баллы: petState.баллы,
  зёрна: petState.зёрна,
  ранг: (RANKS[rankIndex(баллыШколы())] || {}).name,
  лавка: shopXp(),
  вРейтинге: рейтингСоСвоей().find((x) => x.me).xp,
}));

// Набираем баллы за уроки.
await p.evaluate(() => { for (let k = 0; k < 20; k++) addSeeds(10, 'за проверку'); });
await p.waitForTimeout(400);
const после = await счёт();
console.log('после уроков:', JSON.stringify(после));
if (после.баллы !== после.зёрна) { console.log('ОЙ: баллы и зёрна начислились по-разному'); плохо++; }
if (после.лавка !== после.баллы) { console.log('ОЙ: лавка считает не по баллам'); плохо++; }
if (после.вРейтинге !== после.баллы) { console.log('ОЙ: рейтинг считает не по баллам'); плохо++; }
if (после.ранг !== 'Росточек') { console.log('ОЙ: ранг не вырос, а должен: ' + после.ранг); плохо++; }

// Кормим друга: зёрна тратятся, баллы школы остаются.
await p.evaluate(() => openPetScreen());
await p.waitForTimeout(600);
for (let k = 0; k < 12; k++) {
  await p.evaluate(() => document.getElementById('petFeed').click());
  await p.waitForTimeout(60);
}
const послеКормёжки = await счёт();
console.log('после кормёжки:', JSON.stringify(послеКормёжки));
if (послеКормёжки.баллы !== после.баллы) {
  console.log('ОЙ: кормёжка съела баллы школы'); плохо++;
}
if (послеКормёжки.зёрна >= после.зёрна) {
  console.log('ОЙ: зёрна не потратились, кормёжка ничего не стоит'); плохо++;
}
if (послеКормёжки.ранг !== после.ранг) { console.log('ОЙ: ранг упал от кормёжки'); плохо++; }
if (послеКормёжки.лавка !== после.лавка) { console.log('ОЙ: в лавке стало меньше денег'); плохо++; }

// Баллы держатся после перезагрузки и не подменяются зёрнами.
await p.reload({ waitUntil: 'load' });
await p.waitForSelector('.splash--hide', { timeout: 20000 }).catch(() => {});
await p.waitForTimeout(900);
const послеПерезагрузки = await счёт();
console.log('после перезагрузки:', JSON.stringify(послеПерезагрузки));
if (послеПерезагрузки.баллы < после.баллы) { console.log('ОЙ: баллы потерялись'); плохо++; }

// Старая запись без баллов не обнуляет ребёнка.
await p.evaluate(() => {
  const с = JSON.parse(localStorage.getItem('mt_pet'));
  delete с.баллы;
  с.зёрна = 250;
  localStorage.setItem('mt_pet', JSON.stringify(с));
});
await p.reload({ waitUntil: 'load' });
await p.waitForSelector('.splash--hide', { timeout: 20000 }).catch(() => {});
await p.waitForTimeout(900);
const староеОбновление = await счёт();
console.log('запись со старой версии:', JSON.stringify(староеОбновление));
if (староеОбновление.баллы !== 250) { console.log('ОЙ: старые зёрна не стали баллами'); плохо++; }

// На экране ребёнка счёт подписан баллами, а не зёрнами.
const подпись = await p.evaluate(() => {
  const дети = JSON.parse(localStorage.getItem('mt_kids'));
  openChild(дети[0]);
  return new Promise((r) => setTimeout(() => r({
    ранг: (document.getElementById('childRank') || {}).textContent || '',
    лесенка: (document.querySelector('.rank__xp') || {}).textContent || '',
  }), 600));
});
console.log('подписи:', JSON.stringify(подпись));
if (!/балл/.test(подпись.ранг)) { console.log('ОЙ: счёт у ребёнка подписан не баллами'); плохо++; }
if (!/балл/.test(подпись.лесенка)) { console.log('ОЙ: лесенка рангов подписана не баллами'); плохо++; }

// Счёт школы подписан одним словом везде: в лавке, рейтинге и на ребёнке.
// «Очки» остаются только за партию в игре — так просила Екатерина.
const экраныСчёта = await p.evaluate(async () => {
  const ж = (м) => new Promise((r) => setTimeout(r, м));
  const текст = async (открыть, имя) => {
    открыть();
    await ж(600);
    const э = document.querySelector(`[data-screen="${имя}"]`);
    return э ? (э.innerText || '').replace(/\s+/g, ' ') : '';
  };
  const дети = JSON.parse(localStorage.getItem('mt_kids'));
  return {
    лавка: await текст(() => openShop(), 'shop'),
    рейтинг: await текст(() => openRatingScreen(), 'rating'),
    главная: await текст(() => switchTab('home'), 'home'),
    ребёнок: await текст(() => openChild(дети[0]), 'child'),
  };
});
for (const [имя, текст] of Object.entries(экраныСчёта)) {
  if (!текст) { console.log('ОЙ: экран «' + имя + '» пуст'); плохо++; continue; }
  // Границу слова пишем сами: \b устроен по латинице и внутри кириллицы
  // не срабатывает — на этом проверка один раз уже промолчала.
  const очки = /(^|[^а-яёА-ЯЁ])очк(ов|и|а|ами)([^а-яёА-ЯЁ]|$)/i;
  if (очки.test(текст)) {
    const м = текст.match(/.{0,50}очк(ов|и|а|ами).{0,30}/i);
    console.log('ОЙ: на экране «' + имя + '» счёт назван очками: …' + м[0] + '…');
    плохо++;
  }
  if (!/балл/i.test(текст)) { console.log('ОЙ: на экране «' + имя + '» нет баллов'); плохо++; }
}

if (errs.length) { console.log('ОШИБКИ СТРАНИЦЫ:', errs.slice(0, 3)); плохо++; }
console.log('ОШИБОК: ' + плохо);
await b.close();
process.exit(плохо ? 1 : 0);
