/* ДВА ФИНАЛА РЯДОМ. Владелец требует, чтобы финал VPN был тем же кадром,
   что финал CDN: «камера ближе к панели доходит как в игре 1:1 ракурс
   должен быть это не новое это все в одном мире».

   Глазом два снимка не сложить: они похожи, и разница в пять процентов
   высоты читается как «вроде то же самое». Здесь она считается числом.

   Что меряется на каждом кадре, по средней трети ширины:
     · профиль яркости по строкам - где стекло, где рама, где пульт;
     · НИЗ ПРОЁМА: последняя сверху строка, где ещё видно космос
       (яркость выше порога) перед тёмной полосой рамы;
     · ВЕРХ КЛАВИШ: первая строка снизу, где начинается яркая полоса
       подсвеченных клавиш;
     · НИЗ КАДРА: средняя яркость последних трёх процентов высоты -
       у CDN там тьма, у VPN светилась палуба зала.
   Все числа в долях высоты кадра, поэтому сравнимы на любом экране.

   Оба сайта поднимаются на своих стендах: VPN на 8170, CDN на 8171.
   VPN идёт по акту финала (RV_MOTION), CDN по доле ленты.

   Запуск: node tools/два-финала.mjs [пк|тел] [доля-vpn] [доля-cdn] */
import { chromium } from "playwright";
import { БРАУЗЕР } from "./браузер.mjs";

const КТО = process.argv[2] || "пк";
const ДОЛЯ_VPN = +(process.argv[3] || 0.99);
const ДОЛЯ_CDN = +(process.argv[4] || 1.0);
const VPN = process.env.RV_URL || "http://127.0.0.1:8170";
const CDN = process.env.RC_URL || "http://127.0.0.1:8171";
const экран = КТО === "тел" ? { width: 390, height: 844 } : { width: 1440, height: 900 };

const бр = await chromium.launch({
  executablePath: БРАУЗЕР,
  args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader",
         "--force-device-scale-factor=1"]
});

async function кадры(стр, n) {
  await стр.evaluate((к) => new Promise((г) => {
    let i = 0; (function ш() { requestAnimationFrame(() => (++i >= к ? г() : ш())); })();
  }), n);
}

/* Профиль яркости считаем В САМОЙ СТРАНИЦЕ: снимок холста рисуем на
   плоский холст и читаем пиксели. Так не нужен ни файл, ни разбор PNG,
   и число приходит из того же кадра, что человек видит. */
async function профиль(стр) {
  return await стр.evaluate(() => new Promise((готово) => {
    const W = innerWidth, H = innerHeight;
    const c = document.createElement("canvas");
    c.width = W; c.height = H;
    const x = c.getContext("2d");
    /* Холст WebGL отдаёт пиксели только внутри своего кадра: буфер не
       сохраняется, и чтение следующей задачей вернёт пустоту. */
    /* Собираем все холсты страницы по порядку слоёв: у VPN кадр рисует
       один холст мира, у CDN - холст полёта поверх страницы. */
    const холсты = [].slice.call(document.querySelectorAll("canvas")).filter((cv) => {
      const к = cv.getBoundingClientRect();
      return к.width > W * 0.8 && к.height > H * 0.8 && getComputedStyle(cv).visibility !== "hidden";
    });
    requestAnimationFrame(() => {
      for (const cv of холсты) {
        try { x.drawImage(cv, 0, 0, W, H); } catch (e) {}
      }
      const д = x.getImageData(0, 0, W, H).data;
      const x0 = Math.round(W * 0.33), x1 = Math.round(W * 0.67);
      const строки = [];
      for (let y = 0; y < H; y++) {
        let s = 0, n = 0;
        for (let px = x0; px < x1; px += 3) {
          const i = (y * W + px) * 4;
          s += д[i] * 0.2126 + д[i + 1] * 0.7152 + д[i + 2] * 0.0722;
          n++;
        }
        строки.push(s / n);
      }
      готово({ W, H, строки, холстов: холсты.length });
    });
  }));
}

function разбор(п) {
  const { H, строки } = п;
  /* Низ проёма: идём сверху вниз по нижней половине и ищем начало
     ТЁМНОЙ полосы рамы - первую строку, где яркость держится ниже
     порога подряд десять строк. Порог берём от самого кадра: четверть
     средней яркости верхней трети (там всегда стекло). */
  let верхСр = 0, n = 0;
  for (let y = Math.round(H * 0.10); y < Math.round(H * 0.40); y++) { верхСр += строки[y]; n++; }
  верхСр /= Math.max(1, n);
  const порогТьмы = Math.max(3, верхСр * 0.35);
  let низПроёма = null;
  for (let y = Math.round(H * 0.40); y < H - 12; y++) {
    let темно = true;
    for (let k = 0; k < 10; k++) if (строки[y + k] > порогТьмы) { темно = false; break; }
    if (темно) { низПроёма = y; break; }
  }
  /* Верх клавиш: ниже проёма ищем первую строку, где яркость снова
     поднимается выше порога и держится пять строк. */
  let верхКлавиш = null;
  if (низПроёма !== null) {
    for (let y = низПроёма + 4; y < H - 6; y++) {
      let светло = true;
      for (let k = 0; k < 5; k++) if (строки[y + k] < порогТьмы * 1.6) { светло = false; break; }
      if (светло) { верхКлавиш = y; break; }
    }
  }
  let низ = 0, m = 0;
  for (let y = Math.round(H * 0.97); y < H; y++) { низ += строки[y]; m++; }
  низ /= Math.max(1, m);
  return {
    верхняяЯркость: +верхСр.toFixed(1),
    низПроёма: низПроёма === null ? null : +(низПроёма / H).toFixed(3),
    верхКлавиш: верхКлавиш === null ? null : +(верхКлавиш / H).toFixed(3),
    яркостьНиза: +низ.toFixed(1),
  };
}

async function снять(адрес, готовность, поставить, файл) {
  const кон = await бр.newContext({
    viewport: экран, deviceScaleFactor: 1, isMobile: КТО === "тел", hasTouch: КТО === "тел"
  });
  const стр = await кон.newPage();
  const беды = [];
  стр.on("pageerror", (e) => беды.push(e.message.slice(0, 120)));
  await стр.goto(адрес + "/", { waitUntil: "domcontentloaded", timeout: 120000 });
  await стр.waitForFunction(готовность, null, { timeout: 300000 }).catch(() => {});
  await стр.waitForTimeout(4000);
  await поставить(стр);
  await кадры(стр, 60);
  await стр.waitForTimeout(2000);
  await кадры(стр, 20);
  const п = разбор(await профиль(стр));
  await стр.screenshot({ path: файл });
  await кон.close();
  return { ...п, беды: беды.slice(0, 2), файл };
}

const впн = await снять(
  VPN,
  () => window.RV_WORLD && window.RV_WORLD["мир"] && window.RV_WORLD["мир"](),
  async (стр) => { await стр.evaluate((д) => window.RV_MOTION["кПунктy"]("финал", д), ДОЛЯ_VPN); },
  `/tmp/два-финала-vpn-${КТО}.png`
);

const кдн = await снять(
  CDN,
  () => window.RC_GL && window.RC_GL.ready3d,
  async (стр) => {
    const высота = await стр.evaluate(() =>
      Math.max(0, document.documentElement.scrollHeight - window.innerHeight));
    for (let i = 1; i <= 90; i++) {
      await стр.evaluate((y) => window.scrollTo(0, y), Math.round(высота * ДОЛЯ_CDN * (i / 90)));
      await кадры(стр, 2);
    }
  },
  `/tmp/два-финала-cdn-${КТО}.png`
);

function строка(имя, а, б) {
  const раз = (а === null || б === null) ? "-" : (а - б >= 0 ? "+" : "") + (а - б).toFixed(3);
  return `  ${имя.padEnd(16)} VPN ${String(а).padEnd(8)} CDN ${String(б).padEnd(8)} разница ${раз}`;
}
console.log(`ФИНАЛЫ РЯДОМ, ${КТО} ${экран.width}x${экран.height}, VPN доля ${ДОЛЯ_VPN}, CDN доля ${ДОЛЯ_CDN}`);
console.log(строка("низ проёма", впн.низПроёма, кдн.низПроёма));
console.log(строка("верх клавиш", впн.верхКлавиш, кдн.верхКлавиш));
console.log(строка("яркость низа", впн.яркостьНиза, кдн.яркостьНиза));
console.log(строка("яркость стекла", впн.верхняяЯркость, кдн.верхняяЯркость));
console.log(`  снимки: ${впн.файл}  ${кдн.файл}`);
if (впн.беды.length) console.log("  беды VPN: " + впн.беды.join(" | "));
if (кдн.беды.length) console.log("  беды CDN: " + кдн.беды.join(" | "));

/* Вердикт: кадры считаются сошедшимися, если проём и клавиши стоят
   на одной строке с точностью до полутора процентов высоты, а низ
   кадра не светится у одного и не светится у другого. */
const беды = [];
function близко(имя, а, б, порог) {
  if (а === null || б === null) { беды.push(`${имя}: не найден (VPN ${а}, CDN ${б})`); return; }
  if (Math.abs(а - б) > порог) беды.push(`${имя}: ${а} против ${б}, разница ${(а - б).toFixed(3)} при пороге ${порог}`);
}
близко("низ проёма", впн.низПроёма, кдн.низПроёма, 0.015);
близко("верх клавиш", впн.верхКлавиш, кдн.верхКлавиш, 0.02);
if (впн.яркостьНиза > кдн.яркостьНиза * 2 + 8) {
  беды.push(`низ кадра VPN светится ${впн.яркостьНиза} против ${кдн.яркостьНиза} у CDN`);
}
if (беды.length) {
  console.log("ГРЯЗНО  финалы разошлись");
  for (const б of беды) console.log("   " + б);
  process.exit(1);
}
console.log("ЧИСТО  финал VPN и финал CDN это один кадр");
