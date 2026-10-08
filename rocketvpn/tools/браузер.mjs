/* ГДЕ ЛЕЖИТ БРАУЗЕР, СПРАШИВАЕМ У ПАПКИ, А НЕ У ПАМЯТИ.

   Сорок пять инструментов держали путь к Chromium прописанным: версия
   1234 и раскладка `chrome-linux64`. Сессия в облаке живёт в новом
   контейнере каждый раз, и там оказалась версия 1194 с раскладкой
   `chrome-linux`. Все сорок пять падали на первой строке, и падение
   выглядело как «инструменты не работают», хотя браузер стоял рядом.

   Здесь мы просто смотрим, что лежит в папке браузеров, и берём первое
   настоящее. Переменная RV_CHROME по-прежнему старше всего: ей
   перекрывают выбор, когда нужен свой браузер. */
import { existsSync, readdirSync } from "node:fs";

export function браузерПуть() {
  if (process.env.RV_CHROME) return process.env.RV_CHROME;
  var корни = [process.env.PLAYWRIGHT_BROWSERS_PATH || "/opt/pw-browsers"];
  for (var к of корни) {
    if (!existsSync(к)) continue;
    var папки = readdirSync(к).filter(function (и) { return и.indexOf("chromium-") === 0; }).sort().reverse();
    for (var п of папки) {
      for (var хвост of ["chrome-linux64/chrome", "chrome-linux/chrome"]) {
        var путь = к + "/" + п + "/" + хвост;
        if (existsSync(путь)) return путь;
      }
    }
  }
  /* Ничего не нашли - отдаём пустоту: Playwright возьмёт свой
     встроенный путь и сам скажет, чего ему не хватает. */
  return undefined;
}

export const БРАУЗЕР = браузерПуть();
