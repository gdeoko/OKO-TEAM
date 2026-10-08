/* Полоса яркости igloo по всей их ленте.

   ЗАЧЕМ. Сверять с соседями по одному кадру бессмысленно: у любого
   фильма есть тёмные места и светлые, и попасть в чужое среднее можно
   случайно. Сверять надо ПОЛОСУ - какие числа их фильм держит от начала
   до конца, и не вылезаем ли мы за неё.

   Что меряется на каждом кадре:
     ярк    средняя яркость (0..255)
     чёрн   доля точек ниже 24
     ярких  доля точек выше 230
     размах разница между самым светлым и самым тёмным каналом в среднем

   Зеркало их сайта снято заранее в /tmp/игло (плёнка-ПК-NNN.png).
   Инструмент браузера не поднимает и считает секунды.

   Запуск: node tools/полоса-игло.mjs [папка] */
import fs from "node:fs";
import path from "node:path";
import { PNG } from "pngjs";

const ПАПКА = process.argv[2] || "/tmp/игло";
if (!fs.existsSync(ПАПКА)) {
  console.log("нет зеркала igloo в", ПАПКА);
  process.exit(2);
}
const кадры = fs.readdirSync(ПАПКА)
  .filter((и) => /^плёнка-ПК-\d+\.png$/.test(и))
  .sort();
if (!кадры.length) {
  console.log("в", ПАПКА, "нет кадров плёнки");
  process.exit(2);
}

function мерка(файл) {
  const п = PNG.sync.read(fs.readFileSync(файл));
  const д = п.data;
  let сумма = 0, чёрн = 0, ярк = 0, всего = 0, разм = 0;
  /* Шапку сайта не считаем: она чёрная у всех и к фильму отношения не
     имеет. Отрезаем верхние восемь процентов кадра. */
  const с0 = Math.round(п.height * 0.08) * п.width * 4;
  for (let i = с0; i < д.length; i += 4) {
    const r = д[i], g = д[i + 1], b = д[i + 2];
    const я = (r * 299 + g * 587 + b * 114) / 1000;
    сумма += я;
    if (я < 24) чёрн++;
    if (я > 230) ярк++;
    разм += Math.max(r, g, b) - Math.min(r, g, b);
    всего++;
  }
  return {
    ярк: сумма / всего,
    чёрн: чёрн / всего * 100,
    ярких: ярк / всего * 100,
    размах: разм / всего
  };
}

const строки = [];
for (const и of кадры) {
  try { строки.push([и, мерка(path.join(ПАПКА, и))]); }
  catch (e) { console.log("не прочёлся", и, String(e).slice(0, 80)); }
}

console.log("кадров", строки.length);
console.log("кадр                 ярк   чёрн%  ярких%  размах");
for (const [и, м] of строки) {
  console.log(и.padEnd(20), м.ярк.toFixed(0).padStart(4),
              м.чёрн.toFixed(2).padStart(6), м.ярких.toFixed(2).padStart(7),
              м.размах.toFixed(1).padStart(7));
}

function полоса(ключ) {
  const в = строки.map(([, м]) => м[ключ]).sort((a, b) => a - b);
  const кв = (p) => в[Math.min(в.length - 1, Math.round((в.length - 1) * p))];
  return { мин: в[0], п10: кв(0.1), сред: кв(0.5), п90: кв(0.9), макс: в[в.length - 1] };
}
console.log("\nПОЛОСА IGLOO по всей ленте (мин / 10% / середина / 90% / макс)");
for (const к of ["ярк", "чёрн", "ярких", "размах"]) {
  const п = полоса(к);
  console.log(к.padEnd(7),
    п.мин.toFixed(2).padStart(8), п.п10.toFixed(2).padStart(8),
    п.сред.toFixed(2).padStart(8), п.п90.toFixed(2).padStart(8),
    п.макс.toFixed(2).padStart(8));
}
