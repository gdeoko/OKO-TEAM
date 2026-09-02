/* Пол рубки обязан читаться полом, а не планетой.

   Что ломалось. По настилу шли ДВА круга света: узкая полоса по
   периметру и рядом с ней широкий отсвет от 0.6 до 0.97 радиуса,
   сложением и на треть непрозрачности. Это метр с лишним ширины на
   трёхметровом полу. От глаз на высоте полутора метров дальняя
   половина такого круга ложится в кадр широкой дугой, выпуклой
   вверх, а поверх дуги идёт яркая кромка полосы. В кадре получался
   силуэт планеты с атмосферным ободком, настила при этом не было
   видно вовсе: сложение выбеливало и решётку, и проступь. Приёмка
   записала это как «планета проходит сквозь стену рубки».

   Что меряем. Заходим в рубку человеческим ходом (быстрый скачок
   вход в люк не защёлкивает, и снаружи остаётся площадка), встаём в
   акте «салон» и считаем в нижней полосе кадра пиксели бледной
   плиты: серо-голубые, зелёный выше красного на полсотни, синий
   рядом с зелёным. До правки такими были больше половины полосы.

   Запуск: RC_URL=http://127.0.0.1:8123/ node tools/checks/пол-рубки.mjs
*/
import { АДРЕС, ПК, ТЕЛЕФОН, браузер } from "./общее.mjs";

/* Доля бледной плиты в нижней полосе кадра. До правки было больше
   половины, после - единицы процентов. Порог с большим запасом: он
   ловит возврат плиты, а не мелкие правки света. */
const ПРЕДЕЛ = 0.22;

const беды = [];
const b = await браузер();

for (const э of [ПК, ТЕЛЕФОН]) {
  const pg = await b.newPage({
    viewport: э.vp, deviceScaleFactor: э.dpr, isMobile: э.mob, hasTouch: э.mob
  });
  await pg.goto(АДРЕС, { waitUntil: "domcontentloaded", timeout: 180000 });
  await pg.waitForTimeout(8000);

  const H = await pg.evaluate(() => document.documentElement.scrollHeight - innerHeight);
  const y0 = await pg.evaluate(() => {
    const e = document.querySelector("#reliability");
    return e ? Math.round(e.getBoundingClientRect().top + scrollY - innerHeight * 0.5) : 0;
  });

  /* Заходим ШАГАМИ. Скачок прокруткой оставляет человека снаружи:
     вход считает корабль по своей доле двери, и мгновенный переход
     он не успевает отработать - в кадре остаётся площадка, а
     страница уже стоит на разделах салона. */
  let y = 0;
  const шаг = 80;
  while (y < y0) { y += шаг * 4; await pg.evaluate(v => scrollTo(0, v), Math.min(y, y0)); await pg.waitForTimeout(40); }
  const дельта = Math.round((H - y0) / 16);
  for (let i = 0; i <= 4; i++) {
    const ц = y0 + дельта * i;
    for (let z = y; z < ц; z += шаг) { await pg.evaluate(v => scrollTo(0, v), z); await pg.waitForTimeout(30); }
    y = ц;
    await pg.evaluate(v => scrollTo(0, v), ц);
    await pg.waitForTimeout(600);
  }
  await pg.waitForTimeout(2000);

  /* ── Ждём вход по ФАКТУ, а не по секундомеру ────────────────
     Постоянная пауза врала. В одиночном прогоне её хватало, а под
     полной батареей, когда машина занята соседними браузерами, доля
     двери считается медленнее, и проверка объявляла «в рубку не
     вошли» на живом сайте. Мерялась загрузка машины, а не пол.

     Поэтому подталкиваем прокрутку короткими шагами и ждём признак
     rc-inside. Двадцать попыток по полсекунды это десять секунд
     запаса сверх обычного входа. */
  for (let п = 0; п < 20; п++) {
    if (await pg.evaluate(() => document.documentElement.classList.contains("rc-inside"))) break;
    y += шаг;
    await pg.evaluate(v => scrollTo(0, v), Math.min(y, H));
    await pg.waitForTimeout(500);
  }
  await pg.waitForTimeout(800);

  const акт = await pg.evaluate(() => document.documentElement.getAttribute("data-act"));
  const внутри = await pg.evaluate(() => document.documentElement.classList.contains("rc-inside"));
  if (!внутри) {
    беды.push(`${э.имя}: в рубку не вошли, мерить нечего (акт ${акт})`);
    await pg.close();
    continue;
  }

  const вп = э.vp.height, шп = э.vp.width;
  const полоса = { x: 0, y: Math.round(вп * 0.82), width: шп, height: Math.round(вп * 0.18) };
  const снимок = (await pg.screenshot({ clip: полоса })).toString("base64");
  const доля = await pg.evaluate(async (d) => {
    const im = new Image();
    im.src = "data:image/png;base64," + d;
    await im.decode();
    const c = document.createElement("canvas");
    c.width = im.width; c.height = im.height;
    const x = c.getContext("2d");
    x.drawImage(im, 0, 0);
    const p = x.getImageData(0, 0, c.width, c.height).data;
    let n = 0;
    for (let i = 0; i < p.length; i += 4) {
      const r = p[i], g2 = p[i + 1], b2 = p[i + 2];
      if (r > 60 && r < 200 && g2 - r > 25 && g2 - r < 80 && b2 >= g2 && b2 - g2 < 32) n++;
    }
    return n / (p.length / 4);
  }, снимок);

  console.log(`   ${э.имя.padEnd(9)} акт ${акт} · бледной плиты внизу кадра ${(доля * 100).toFixed(1)}%`);
  if (доля > ПРЕДЕЛ) {
    беды.push(`${э.имя}: низ кадра на ${(доля * 100).toFixed(0)}% залит бледной плитой, ` +
              `настила не видно (предел ${(ПРЕДЕЛ * 100).toFixed(0)}%)`);
  }
  await pg.close();
}

await b.close();

if (беды.length) {
  console.log("ГРЯЗНО  пол рубки");
  for (const б of беды) console.log("   " + б);
  process.exit(1);
}
console.log("ЧИСТО  пол рубки читается полом");
