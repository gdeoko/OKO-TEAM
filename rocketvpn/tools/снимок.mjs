/* Снимок мира Rocket VPN по актам и долям.

   ЗАЧЕМ. Проверки в tools/checks отвечают на вопрос «сломано или нет»
   числом. Этот файл отвечает на другой вопрос: КАК ЭТО ВЫГЛЯДИТ. Когда
   правится реализм материалов, света и объёма, число не помогает вовсе,
   смотреть надо глазами.

   Ход акта берётся у самой плёнки, а не прокруткой на глазок: у каждого
   акта своя высота в экранах, и «прокрутить на 2000 точек» означает в
   разных актах разное. RV_MOTION.кПунктy ставит камеру ровно на долю
   акта и досчитывает подтяжки одним махом.

   Запуск:
     node tools/снимок.mjs                        все акты по середине
     node tools/снимок.mjs станция 0.0,0.5,1.0    один акт по долям
   Кадры ложатся в /tmp/кадры. */
import { chromium } from "playwright";
import fs from "node:fs";

const АДРЕС = process.env.RV_URL || "http://127.0.0.1:8170";
const КУДА = process.env.RV_SHOTS || "/tmp/кадры";
const ПК = { width: 1440, height: 900 };
const ТЕЛ = { width: 390, height: 844 };

const актАрг = process.argv[2] || null;
const долиАрг = (process.argv[3] || "0.45").split(",").map(Number);

fs.mkdirSync(КУДА, { recursive: true });

const бр = await chromium.launch({
  args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader",
         "--disable-lcd-text", "--force-device-scale-factor=1"]
});

async function снять(вьюпорт, метка) {
  const стр = await бр.newPage({ viewport: вьюпорт, deviceScaleFactor: 1 });
  const беды = [];
  стр.on("pageerror", (e) => беды.push("ИСКЛ " + e.message.slice(0, 160)));
  стр.on("console", (m) => { if (m.type() === "error") беды.push("КОНС " + m.text().slice(0, 160)); });
  стр.on("requestfailed", (r) => беды.push("СЕТЬ " + r.url().split("/").pop() + " " + (r.failure()?.errorText || "")));

  await стр.goto(АДРЕС + "/", { waitUntil: "domcontentloaded", timeout: 90000 });
  /* Мир поднимается секундами: сцена собирается, карты едут, шрифты
     доезжают. Без этой паузы снимок ловит пустой холст. */
  await стр.waitForTimeout(9000);

  const акты = актАрг ? [актАрг] : await стр.evaluate(() =>
    Array.from(document.querySelectorAll(".rv-акт")).map((э) => э.getAttribute("data-акт")));

  for (const акт of акты) {
    for (const доля of долиАрг) {
      const встал = await стр.evaluate(([а, д]) => {
        if (window.RV_MOTION && window.RV_MOTION["кПунктy"]) return window.RV_MOTION["кПунктy"](а, д);
        return false;
      }, [акт, доля]);
      /* Дать миру доехать. Секунды тут не с потолка: камера идёт по
         кривой с подтяжкой, карты материалов могли подставиться только
         что, а проявление кладки на станции длится 2.4 секунды и
         начинает считаться лишь когда акт стал видимым. Снимок на 1.4
         секунды ловил её на середине, и купол выходил в кадре
         светящейся решёткой, которой в покое нет вовсе. */
      await стр.waitForTimeout(3400);
      const имя = `${КУДА}/${метка}-${акт}-${String(доля).replace(".", "")}.png`;
      await стр.screenshot({ path: имя });
      console.log(`${встал ? "снят " : "МИМО "} ${имя}`);
    }
  }

  /* Средняя яркость и доля выбитых точек: по ним видно пересвет и
     черноту, которых на глаз в маленьком кадре можно не заметить. */
  const свет = await стр.evaluate(() => {
    const c = document.querySelector("canvas");
    if (!c) return null;
    const t = document.createElement("canvas");
    t.width = 160; t.height = 100;
    const x = t.getContext("2d");
    try { x.drawImage(c, 0, 0, 160, 100); } catch (e) { return null; }
    const d = x.getImageData(0, 0, 160, 100).data;
    let s = 0, чёрн = 0, бел = 0, n = 0;
    for (let i = 0; i < d.length; i += 4) {
      const l = d[i] * 0.2126 + d[i + 1] * 0.7152 + d[i + 2] * 0.0722;
      s += l; n++;
      if (l < 4) чёрн++;
      if (l > 250) бел++;
    }
    return { средн: +(s / n).toFixed(1), чёрных: +(чёрн / n * 100).toFixed(2), выбитых: +(бел / n * 100).toFixed(2) };
  });
  if (свет) console.log(`  свет ${метка}: средняя ${свет.средн}, чёрных ${свет.чёрных}%, выбитых ${свет.выбитых}%`);
  if (беды.length) {
    console.log("  БЕДЫ:");
    for (const б of [...new Set(беды)].slice(0, 12)) console.log("   " + б);
  } else {
    console.log("  ошибок нет");
  }
  await стр.close();
}

await снять(ПК, "пк");
if (process.env.RV_PHONE !== "0") await снять(ТЕЛ, "тел");
await бр.close();
