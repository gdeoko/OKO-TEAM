/* ============================================================================
   OKO · ОБЛЕГЧЁННОЕ ЯДРО ДЛЯ ПРОДА

   Зачем. okoteam.top отдаёт app.js и app.css БЕЗ сжатия — 4 050 821 и
   1 135 409 байт. Правильное лекарство одно: включить gzip в nginx, готовый
   скрипт лежит в oko-app/deploy/enable-gzip.sh. Пока доступа к серверу нет,
   снимаем то, что можно снять со своей стороны: комментарии и отступы.
   Их тут много — код написан подробно, и все эти строки едут на телефон
   вместе с логикой.

   Куда пишем и почему именно туда. Cron копирует на прод только index.html,
   app.js, app.css и всё содержимое site/media/**. Файл в корне prototype/
   с новым именем на сервер не доедет, поэтому облегчённое ядро кладётся в
   prototype/media/app/ — тот единственный путь, который доезжает. Оттуда
   sync-deploy.mjs разложит его в site/, а index.html уже на него ссылается.

   Чего здесь НЕТ и не будет: переименования идентификаторов. Разметка зовёт
   глобальные функции по именам прямо из onclick, слои цепляются друг за друга
   через `typeof recStream !== 'undefined'` и `window.okoSocial`. Любое
   переименование это разорвёт. Поэтому minifyIdentifiers и minifySyntax
   выключены: esbuild только перепечатывает разобранный код без пробелов.

   Ещё одна ловушка, на которую уже наступили: charset. По умолчанию esbuild
   экранирует всё за пределами ASCII в \\uXXXX — кириллица раздувается вшестеро,
   и «облегчённый» app.js получился в полтора раза ТЯЖЕЛЕЕ исходного. Нужен
   charset:'utf8'.

   Исходники не трогаются: править по-прежнему app.js и app.css, а эта сборка
   гоняется перед деплоем (её зовёт sync-deploy.mjs).

   Запуск:
     node oko-app/tools/build-min.mjs
     node oko-app/tools/build-min.mjs --check    — посчитать, ничего не писать
   ============================================================================ */
import fs from 'node:fs/promises';
import path from 'node:path';
import zlib from 'node:zlib';
import { promisify } from 'node:util';
import esbuild from 'esbuild';

const gzip = promisify(zlib.gzip);
const DIR = 'oko-app/prototype';
const ВЫХОД = path.join(DIR, 'media', 'app');
const CHECK = process.argv.includes('--check');

const ЦЕЛИ = [
  { из: 'app.js', в: 'app.min.js', loader: 'js' },
  { из: 'app.css', в: 'app.min.css', loader: 'css' },
];

const kb = n => (n / 1024).toFixed(0) + ' КБ';
const B = s => Buffer.byteLength(s, 'utf8');

await fs.mkdir(ВЫХОД, { recursive: true });

let было = 0, стало = 0, былоGz = 0, сталоGz = 0;
const строки = [];
let сломалось = false;

for (const ц of ЦЕЛИ) {
  const src = await fs.readFile(path.join(DIR, ц.из), 'utf-8');
  let код;
  try {
    код = esbuild.transformSync(src, {
      loader: ц.loader,
      minifyWhitespace: true,
      minifySyntax: false,
      minifyIdentifiers: false,
      legalComments: 'none',
      charset: 'utf8',
    }).code;
  } catch (e) {
    строки.push(`  ${ц.из.padEnd(10)} ОШИБКА разбора: ${String(e).split('\n')[0].slice(0, 90)}`);
    сломалось = true;
    continue;
  }

  /* Страховка от тихой поломки: результат меньше пятой части исходника или
     больше самого исходника — значит что-то пошло не так, и такой файл на
     прод отправлять нельзя. */
  if (B(код) < B(src) * 0.2 || B(код) > B(src)) {
    строки.push(`  ${ц.из.padEnd(10)} ПРОПУЩЕН: ${kb(B(src))} → ${kb(B(код))}, похоже на ошибку`);
    сломалось = true;
    continue;
  }

  const gzA = (await gzip(src)).length, gzB = (await gzip(код)).length;
  было += B(src); стало += B(код); былоGz += gzA; сталоGz += gzB;
  if (!CHECK) await fs.writeFile(path.join(ВЫХОД, ц.в), код);
  строки.push(`  ${ц.из.padEnd(10)} ${kb(B(src)).padStart(9)} → ${kb(B(код)).padStart(9)}   (под gzip было бы ${kb(gzB)})`);
}

console.log(строки.join('\n'));
if (было) {
  console.log(`\n  ВСЕГО: ${kb(было)} → ${kb(стало)}  (минус ${(100 - стало / было * 100).toFixed(0)}%)`);
  console.log(`  Для сравнения, если включить gzip на сервере: ${kb(сталоGz)} — минус ${(100 - сталоGz / былоGz * 100).toFixed(0)}%.`);
  console.log('  Минификация не заменяет сжатие, а лишь смягчает его отсутствие.');
}
console.log(CHECK ? '\n(--check: файлы не записаны)' : '\nОблегчённое ядро в prototype/media/app/.');
process.exit(сломалось ? 1 : 0);
