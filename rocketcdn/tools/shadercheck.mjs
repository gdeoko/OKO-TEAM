/* Сторож кириллицы в шейдерах.
   GLSL принимает только латиницу в именах. Кириллическая переменная
   внутри строки шейдера ломает компиляцию МОЛЧА: экран становится
   чёрным, в консоли VALIDATE_STATUS false, и найти это можно только
   разглядывая кадр. За время работы над проектом это случалось трижды,
   поэтому проверка встроена в предстартовую и запускается перед
   каждой выкладкой. */
import fs from 'fs';
import path from 'path';

const КАТАЛОГ = 'assets';
/* Слова, по которым строка опознаётся как кусок шейдера. */
const ПРИЗНАК = /\b(gl_FragColor|gl_Position|gl_PointSize|gl_PointCoord|varying|attribute|uniform|precision|vec2|vec3|vec4|mat3|mat4|sampler2D|float |void main)\b/;
const КИРИЛЛИЦА = /[а-яА-ЯёЁ]/;

let плохих = 0, файлов = 0;
for (const имя of fs.readdirSync(КАТАЛОГ)) {
  if (!имя.endsWith('.js')) continue;
  const путь = path.join(КАТАЛОГ, имя);
  const строки = fs.readFileSync(путь, 'utf8').split('\n');
  файлов++;
  строки.forEach((стр, i) => {
    /* Смотрим только содержимое строковых литералов: комментарии
       по-русски это норма проекта и трогать их нельзя. */
    const литералы = стр.match(/"([^"\\]|\\.)*"|'([^'\\]|\\.)*'/g);
    if (!литералы) return;
    for (const л of литералы) {
      if (!ПРИЗНАК.test(л)) continue;
      if (!КИРИЛЛИЦА.test(л)) continue;
      плохих++;
      console.log(`КИРИЛЛИЦА В ШЕЙДЕРЕ  ${путь}:${i + 1}`);
      console.log(`   ${л.trim().slice(0, 100)}`);
    }
  });
}
if (плохих) {
  console.log(`\nнайдено ${плохих} строк. GLSL их не примет, экран станет чёрным.`);
  process.exit(1);
}
console.log(`шейдеры чисты: проверено ${файлов} файлов`);
