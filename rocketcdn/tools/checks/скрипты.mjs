/* Встроенные скрипты страниц обязаны разбираться.
   Беда, ради которой проверка написана: правка заголовков в app.html
   вставила двойные кавычки внутрь строки в двойных кавычках. Страница
   отдавалась с кодом 200 и выглядела живой, а весь её скрипт умирал на
   разборе: три экрана из четырёх становились недостижимы, форма
   заявки не открывалась вовсе. Ни один прежний прогон этого не ловил,
   потому что смотрел на страницу, а не на её скрипт. */
import fs from "fs";
import path from "path";
const КОРЕНЬ = path.join(new URL(".", import.meta.url).pathname, "..", "..");
const СТРАНИЦЫ = ["index.html", "app.html", "admin.html", "offer.html", "privacy.html",
                  "splash.html", "splash-lk.html"];
let бед = 0;
for (const имя of СТРАНИЦЫ) {
  const п = path.join(КОРЕНЬ, имя);
  if (!fs.existsSync(п)) continue;
  const html = fs.readFileSync(п, "utf8");
  const куски = [...html.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/g)];
  let n = 0, плохих = 0;
  for (const к of куски) {
    const тело = к[1].trim();
    if (!тело) continue;
    /* Разметку для поисковика разбираем как JSON, а не как код */
    if (/type\s*=\s*["']application\/ld\+json["']/.test(к[0])) {
      n++;
      try { JSON.parse(тело); }
      catch (e) { плохих++; console.log("  БЕДА " + имя + " · разметка ld+json: " + e.message); }
      continue;
    }
    n++;
    try { new Function(тело); }
    catch (e) {
      плохих++;
      const до = html.slice(0, к.index).split("\n").length;
      console.log("  БЕДА " + имя + " · скрипт со строки " + до + ": " + e.message);
    }
  }
  бед += плохих;
  console.log("   " + имя.padEnd(16) + " скриптов " + n + (плохих ? " · битых " + плохих : " · все разбираются"));
}
console.log(бед ? "БЕДА  встроенные скрипты" : "ЧИСТО  встроенные скрипты");
process.exit(бед ? 1 : 0);
