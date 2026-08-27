/* Каждая клавиша пульта нажатием.

   Так нашлась мёртвая клавиша СЕТЬ: она переключала класс, на
   который не было ни одного правила, поэтому загоралась и не делала
   ничего. Проверка смотрит не на код, а на последствия: изменилось
   ли хоть что-то в состоянии полёта или на экране. */
import { браузер, вПолёт, ТЕЛЕФОН, итог } from "./общее.mjs";

const КЛАВИШИ = ["rcf-navkey", "rcf-scan-key", "rcf-deploy", "rcf-help-key",
                 "rcf-auto-key", "rcf-stop-key", "rcf-map-key", "rcf-shot",
                 "rcf-zoom-in", "rcf-zoom-out"];

const b = await браузер();
const { pg, ошибки } = await вПолёт(b, ТЕЛЕФОН);
const беды = [];

const слепок = () => pg.evaluate(() => {
  const s = window.RC_FLIGHT.state();
  /* Раньше здесь шёл обход ВСЕХ элементов слоя с чтением стилей: на
     песочнице без видеокарты это минуты на один прогон, а точности
     не добавляло - фон шевелится сам по себе и любое нажатие
     выглядело осмысленным. Берём то, что действительно меняют
     клавиши: раскрытые панели, тумблеры, зум, тягу и счётчики. */
  const открыта = сел => {
    const e = document.querySelector(сел);
    if (!e) return false;
    const cs = getComputedStyle(e);
    return cs.display !== "none" && cs.visibility !== "hidden" && +cs.opacity > 0.06;
  };
  const и = window.RC_FLIGHT._interaction ? window.RC_FLIGHT._interaction() : null;
  return JSON.stringify({
    p: s.p, цель: s["цель"], рукав: s["вселенная"], и: и,
    панели: [".rcf-menu.on", ".rcf-help.on", ".rcf-dos.on", ".rcf-netlist.on"].map(открыта),
    сеть: (document.querySelector(".rcf-net") || {}).textContent,
    подпись: (document.querySelector(".rcf-cap") || {}).textContent
  });
});

/* Некоторым клавишам нужно состояние, в котором их работа вообще
   заметна. СТОП гасит ход и снимает цель: на неподвижном корабле без
   цели он честно ничего не меняет, и проверка соврала бы, что
   клавиша мёртвая. Даём ход и цель заранее. */
const ПОДГОТОВКА = {
  "rcf-stop-key": async () => {
    await pg.evaluate(() => { window.RC_FLIGHT._go("mars"); window.RC_FLIGHT.seek(0.10, 0.06); });
    await pg.waitForTimeout(2000);
  }
};

for (const к of КЛАВИШИ) {
  if (ПОДГОТОВКА[к]) await ПОДГОТОВКА[к]();
  const до = await слепок();
  const есть = await pg.evaluate(s => {
    const e = document.querySelector("." + s);
    if (!e) return false;
    e.click();
    return true;
  }, к);
  if (!есть) { беды.push(к + ": нет в разметке"); continue; }
  await pg.waitForTimeout(1700);
  const после = await слепок();
  const немая = до === после;
  console.log("  ", к.padEnd(14), немая ? "НИЧЕГО НЕ ПРОИЗОШЛО" : "отзывается");
  if (немая) беды.push(к + ": нажатие ничего не меняет");
  /* Переключатель возвращаем в исходное, иначе следующая клавиша
     меряется в чужом состоянии. */
  await pg.evaluate(s => {
    const e = document.querySelector("." + s);
    if (e && e.classList.contains("cur")) e.click();
  }, к);
  await pg.waitForTimeout(900);
}

await b.close();
process.exit(итог("клавиши пульта", беды, ошибки));
