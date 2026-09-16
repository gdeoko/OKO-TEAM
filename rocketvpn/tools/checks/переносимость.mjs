/* Что сломается вне Chromium.

   В песочнице стоит один браузер, и это значит, что кроссбраузерность
   тут нельзя ПРОВЕРИТЬ живьём. Но её можно проверить чтением: почти
   все поломки в чужом браузере растут из короткого списка мест, где
   нужен префикс или запасной ход. Этот список и сторожим.

   1. `backdrop-filter` без `-webkit-backdrop-filter`. Safari до
      восемнадцатой версии знает только префиксную запись, и без неё
      стекло превращается в плоскую заливку. Ровно так и было найдено
      четыре места: два на CDN и два на VPN.
   2. `background-clip: text` без `-webkit-background-clip`. Без
      префикса Safari заливает прямоугольник, и текст пропадает
      целиком - буквы прозрачные, фон под ними сплошной.
   3. `requestIdleCallback` без запасного хода. Safari получил его
      только в семнадцатой; вызов без проверки роняет модуль на первой
      же строке.
   4. `structuredClone`, `Object.hasOwn`, `Array.prototype.at`,
      `String.replaceAll` - молодые ходы, которых нет в браузерах
      старше двух лет. Свои одноимённые методы не в счёт: смотрим
      только на глобальные и на строковые литералы.

   Проверка НЕ поднимает браузер: это чтение файлов, и стоит она доли
   секунды. Держать её в общем прогоне дёшево.

   Запуск: node tools/checks/переносимость.mjs
*/
import { readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const КОРЕНЬ = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const ПАПКА = join(КОРЕНЬ, "assets");

const беды = [];
const файлы = readdirSync(ПАПКА).filter((и) => /\.(css|js)$/.test(и));

let стёкол = 0, обрезок = 0;

/* Комментарии вырезаем ЦЕЛИКОМ, заменяя их пробелами и сохраняя
   переводы строк: номера строк остаются прежними, а слова внутри
   пояснений больше не читаются как правила. Без этого проверка
   доложила о `backdrop-filter` в предложении «снимаем backdrop-filter:
   он тут больше не нужен» - то есть нашла беду в объяснении, почему
   беды нет. */
function безКомментариев(текст) {
  let из = "", i = 0;
  while (i < текст.length) {
    if (текст[i] === "/" && текст[i + 1] === "*") {
      const к = текст.indexOf("*/", i + 2);
      const кусок = текст.slice(i, к < 0 ? текст.length : к + 2);
      из += кусок.replace(/[^\n]/g, " ");
      i += кусок.length;
      continue;
    }
    /* Строчный комментарий только в разметке скриптов: в стилях две
       косые это часть адреса, и вырезать их нельзя. */
    if (текст[i] === "/" && текст[i + 1] === "/") {
      const к = текст.indexOf("\n", i);
      const кусок = текст.slice(i, к < 0 ? текст.length : к);
      из += кусок.replace(/[^\n]/g, " ");
      i += кусок.length;
      continue;
    }
    из += текст[i];
    i++;
  }
  return из;
}

for (const имя of файлы) {
  const сырой = readFileSync(join(ПАПКА, имя), "utf8");
  const текст = имя.endsWith(".js") ? безКомментариев(сырой)
                                    : безКомментариев(сырой.replace(/\/\//g, "@@"));
  const строки = текст.split("\n");
  const рядом = (i, что) => строки.slice(Math.max(0, i - 3), i + 4).join("\n").includes(что);

  for (let i = 0; i < строки.length; i++) {
    const с = строки[i];

    if (/(?<!-)\bbackdrop-filter\s*:/.test(с)) {
      стёкол++;
      if (!рядом(i, "-webkit-backdrop-filter")) {
        беды.push(`${имя}:${i + 1} backdrop-filter без -webkit-: в Safari стекло станет заливкой`);
      }
    }
    if (/(?<!-)\bbackground-clip\s*:\s*text/.test(с)) {
      обрезок++;
      if (!рядом(i, "-webkit-background-clip")) {
        беды.push(`${имя}:${i + 1} background-clip: text без -webkit-: в Safari текст пропадёт`);
      }
    }
    /* Запасной ход у requestIdleCallback. Способов написать его три, и
       проверка обязана знать все три, иначе она краснеет на РАБОЧЕМ коде
       и толкает переписывать его под себя:
         · typeof g.requestIdleCallback === "function"
         · g.requestIdleCallback ? … : …
         · if (g.requestIdleCallback) … else setTimeout(…)
       Третий и ловился мимо: страховка в rv-коридор.js стояла в той же
       строке, что и вызов, и проверка честно докладывала о беде,
       которой нет. Признак страховки один - имя упомянуто ОТДЕЛЬНО от
       вызова, то есть без скобки следом. */
    if (/\brequestIdleCallback\s*\(/.test(с)) {
      const окрест = строки.slice(Math.max(0, i - 3), i + 2).join("\n");
      const естьСтраховка = окрест.includes("typeof") ||
        /\?[\s\S]*:/.test(окрест) ||
        /requestIdleCallback\s*[)&|?]/.test(окрест);
      if (!естьСтраховка) {
        беды.push(`${имя}:${i + 1} requestIdleCallback без запасного хода: в Safari до 17 модуль упадёт`);
      }
    }
    for (const ход of ["structuredClone(", "Object.hasOwn(", ".replaceAll("]) {
      if (с.includes(ход)) {
        беды.push(`${имя}:${i + 1} ${ход}: нет в браузерах старше двух лет`);
      }
    }
  }
}

console.log(`   просмотрено файлов ${файлы.length} · стёкол ${стёкол} · обрезок текста по фону ${обрезок}`);

if (беды.length) {
  console.log("ГРЯЗНО  переносимость");
  for (const б of беды.slice(0, 20)) console.log("   " + б);
  if (беды.length > 20) console.log(`   и ещё ${беды.length - 20}`);
  process.exit(1);
}
console.log("ЧИСТО  переносимость: префиксы на месте, молодых ходов без запаса нет");
