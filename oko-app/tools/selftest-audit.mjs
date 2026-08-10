/* ============================================================================
   OKO · САМОПРОВЕРКА ДЕТЕКТОРА

   Зачем. Раунд 36 отрапортовал «0 замечаний» и соврал: он мерил онбординг.
   Раунд 47 снова показал ноль — на этот раз после того, как из детектора
   убрали четыре источника вранья. Но «ноль» бесполезен, пока не доказано,
   что детектор вообще способен что-то найти. Ноль от слепого и ноль от
   зрячего выглядят одинаково.

   Поэтому здесь в живое приложение подсаживаются заведомые дефекты — по
   одному на каждую проверку — и проверяется, что детектор их видит. Если
   какая-то проверка ослепла, отчёт по всему приложению перестаёт быть
   доказательством, и это надо знать до, а не после деплоя.

   Запуск: node oko-app/tools/selftest-audit.mjs
   ============================================================================ */
import { chromium } from 'playwright-core';
import fs from 'node:fs/promises';
import { CLEAN_START, CLOSE_OVERLAYS, RESET_ALL } from './clean-start.mjs';

/* Берём ровно тот детектор, которым ходит аудит: копия здесь разошлась бы
   с оригиналом в первый же день. */
const исходник = await fs.readFile('oko-app/tools/audit-all.mjs', 'utf-8');
const начало = исходник.indexOf('const детектор = ');
const конец = исходник.indexOf('\nconst ГЕОМЕТРИЯ');
if (начало < 0 || конец < 0) { console.error('не нашёл детектор в audit-all.mjs'); process.exit(1); }
const детекторИсх = исходник.slice(начало, конец);
const детектор = new Function(детекторИсх + '\nreturn детектор;')();

const ОПЫТЫ = [
  {
    имя: 'разрыв посреди слова',
    ключ: 'разрывы',
    посадить: `(() => {
      const d = document.createElement('div');
      d.id = 'stDefect';
      d.style.cssText = 'position:fixed;left:20px;top:200px;width:44px;z-index:9;'
        + 'word-break:break-all;overflow-wrap:anywhere;font:700 14px sans-serif;'
        + 'background:#000;color:#fff';
      d.textContent = 'Ответственность';
      document.body.appendChild(d);
    })()`
  },
  {
    имя: 'эмодзи в интерфейсе',
    ключ: 'эмодзи',
    посадить: `(() => {
      const d = document.createElement('div');
      d.id = 'stDefect';
      d.style.cssText = 'position:fixed;left:20px;top:260px;z-index:9;background:#000;color:#fff';
      d.textContent = 'Готово \\u{1F680}';
      document.body.appendChild(d);
    })()`
  },
  {
    имя: 'выдуманная метрика',
    ключ: 'фейк',
    посадить: `(() => {
      const d = document.createElement('div');
      d.id = 'stDefect';
      d.style.cssText = 'position:fixed;left:20px;top:300px;z-index:9;background:#000;color:#fff';
      d.textContent = '34.2к охват за неделю';
      document.body.appendChild(d);
    })()`
  },
  {
    имя: 'кнопка полностью перекрыта',
    ключ: 'наложения',
    посадить: `(() => {
      const w = document.createElement('div');
      w.id = 'stDefect';
      w.style.cssText = 'position:fixed;left:20px;top:340px;width:200px;height:48px;z-index:9';
      w.innerHTML = '<button style="position:absolute;inset:0;background:#333;color:#fff">Оплатить</button>'
        + '<div style="position:absolute;inset:0;background:#900;z-index:2"></div>';
      document.body.appendChild(w);
    })()`
  },
  {
    /* Текст, срезанный сбоку насовсем: контейнер с overflow-x:hidden уже, чем
       строка. Человек не увидит хвост и не сможет до него доскроллить. */
    имя: 'текст срезан сбоку',
    ключ: 'переполнение',
    посадить: `(() => {
      const w = document.createElement('div');
      w.id = 'stDefect';
      w.style.cssText = 'position:fixed;left:20px;top:540px;width:120px;height:30px;'
        + 'overflow:hidden;z-index:9;background:#000';
      w.innerHTML = '<div style="white-space:nowrap;width:400px;color:#fff;font:14px sans-serif">'
        + 'Очень длинная строка, которая не помещается</div>';
      document.body.appendChild(w);
    })()`
  },
  {
    /* «Сверху обрезается»: экран открылся в нуле прокрутки, а первая строка
       наполовину за верхним краем своего контейнера. Подсаживаем ровно это —
       текст с отрицательным сдвигом внутри непрокрученного скроллера. */
    имя: 'первая строка обрезана сверху',
    ключ: 'подШапкой',
    посадить: `(() => {
      const w = document.createElement('div');
      w.id = 'stDefect';
      w.style.cssText = 'position:fixed;left:20px;top:420px;width:220px;height:90px;'
        + 'overflow:hidden;z-index:9;background:#000';
      w.innerHTML = '<div style="position:relative;top:-9px;color:#fff;font:14px sans-serif">'
        + 'Заголовок раздела</div>';
      document.body.appendChild(w);
    })()`
  }
];

const b = await chromium.launch({
  executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-gl=swiftshader', '--enable-unsafe-swiftshader'],
});
const c = await b.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
await c.addInitScript(CLEAN_START);
const p = await c.newPage();
p.on('dialog', d => d.dismiss().catch(() => {}));
await p.goto('http://127.0.0.1:8199/index.html', { waitUntil: 'domcontentloaded' });
await p.waitForTimeout(3000);
await p.evaluate('okoSkipAuth()');
await p.evaluate(RESET_ALL).catch(() => {});
await p.evaluate(CLOSE_OVERLAYS).catch(() => {});
await p.waitForTimeout(300);

/* Чистый экран без подсадок обязан быть чистым — иначе опыты недействительны. */
const чисто = await p.evaluate(детектор(true, true, 390));
const шум = ['разрывы', 'эмодзи', 'фейк', 'наложения', 'подШапкой', 'обрезано']
  .filter(k => (чисто[k] || []).length).map(k => k + '=' + чисто[k].length);

const ок = [], слепые = [];
for (const о of ОПЫТЫ) {
  await p.evaluate(`(()=>{ const d=document.getElementById('stDefect'); if(d) d.remove(); })()`);
  await p.evaluate(о.посадить).catch(() => {});
  await p.waitForTimeout(220);
  const r = await p.evaluate(детектор(true, true, 390)).catch(() => null);
  const поймал = !r ? false
    : о.ключ === 'переполнение' ? r.переполнение > 1
      : (r[о.ключ] || []).length > 0;
  (поймал ? ок : слепые).push(о.имя);
}
await p.evaluate(`(()=>{ const d=document.getElementById('stDefect'); if(d) d.remove(); })()`);

console.log('\n  ВИДИТ  ' + ок.length + ' из ' + ОПЫТЫ.length);
ок.forEach(s => console.log('    + ' + s));
if (слепые.length) { console.log('\n  СЛЕПА:'); слепые.forEach(s => console.log('    - ' + s)); }
if (шум.length) console.log('\n  шум на чистом экране: ' + шум.join(', '));
else console.log('\n  чистый экран — чисто');
await b.close();
process.exit(слепые.length || шум.length ? 1 : 0);
