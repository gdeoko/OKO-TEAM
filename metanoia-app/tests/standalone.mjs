import { chromium } from 'playwright';
const b = await chromium.launch({ executablePath:'/opt/pw-browsers/chromium', args:['--no-sandbox','--disable-background-networking','--disable-component-update','--no-first-run','--disable-sync','--disable-features=OptimizationHints,Translate'] });
const p = await b.newPage({ viewport:{width:390,height:844} });
const errs=[]; p.on('pageerror', e=>errs.push(e.message));
p.on('console', m=>{ if(m.type()==='error') errs.push('CONSOLE: '+m.text()); });
await p.route(url => !url.href.startsWith('http://127.0.0.1'), r=>r.abort());
await p.goto('http://127.0.0.1:8777/_build.html',{waitUntil:'domcontentloaded'});
await p.waitForSelector(".splash--hide", { timeout: 20000 }).catch(()=>{}); await p.waitForTimeout(800);
for (const t of ['games','chats','lessons','profile','home']) { await p.click(`.nav__tab[data-tab="${t}"]`).catch(()=>{}); await p.waitForTimeout(350); }
await p.click('.nav__tab[data-tab="lessons"]'); await p.waitForTimeout(400);
await p.click('.lesson-item'); await p.waitForTimeout(800);
console.log('УРОК В ОДНОМ ФАЙЛЕ: задание=' + !!(await p.$('.task')) + ' обложка=' + await p.$eval('.lesson-cover img', e=>e.src.slice(0,20)).catch(()=>'нет'));
const аудио = await p.$eval('#lessonVoice', e=>e.dataset.src.slice(0,25)).catch(()=>'нет');
console.log('АУДИО УРОКА: ' + аудио);
await p.screenshot({ path:'shot-standalone.png' });

// Всё, что рисуется по путям, собранным в коде, в одном файле легко теряется:
// сборщик про такой путь не знает и оставляет ссылку на несуществующий файл.
// Ловили на этом: shkola.js с героями и словарём в витрину вовсе не попадал.
const собранныеПути = await p.evaluate(async () => {
  openLesson(1);
  await new Promise((r) => setTimeout(r, 900));
  const э = document.querySelector('[data-screen="lesson"]');
  const адрес = (сел) => { const и = э.querySelector(сел); return и ? и.getAttribute('src') : ''; };
  const итог = {
    помощников: э.querySelectorAll('.pomosh').length,
    портрет: адрес('.pomosh__face'),
    групповое: адрес('.znak__photo'),
    словарь: э.querySelectorAll('.slovar__w').length,
    кроссворд: э.querySelectorAll('[data-word-in]').length,
  };
  openGame('quiz');
  await new Promise((r) => setTimeout(r, 800));
  const игра = document.querySelector('.screen--active .game-art img');
  итог.картинкаИгры = игра ? игра.getAttribute('src') : '';
  return итог;
});
const вшито = (s) => typeof s === 'string' && s.startsWith('data:');
console.log('ВИТРИНА, УРОК 1: помощников=' + собранныеПути.помощников
  + ', словарь=' + собранныеПути.словарь + ', кроссворд=' + собранныеПути.кроссворд);
if (собранныеПути.помощников !== 3) errs.push('помощников не трое: ' + собранныеПути.помощников);
if (собранныеПути.словарь !== 6) errs.push('словарь урока 1 потерялся');
if (собранныеПути.кроссворд !== 4) errs.push('кроссворд урока 1 потерялся');
for (const [имя, адрес] of [['портрет помощника', собранныеПути.портрет],
  ['общий кадр героев', собранныеПути.групповое], ['картинка в игре', собранныеПути.картинкаИгры]]) {
  if (!вшито(адрес)) errs.push(имя + ' не вшит в файл: ' + String(адрес).slice(0, 60));
}

console.log('ОШИБКИ: ' + errs.length); errs.slice(0,6).forEach(e=>console.log(e));
await b.close();
process.exit(errs.length ? 1 : 0);
