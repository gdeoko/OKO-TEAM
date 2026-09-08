// Правка био TikTok с ожиданием живого человека на капче.
// Площадка на сохранение профиля показывает слайдер: её проходит человек через noVNC,
// скрипт держит окно открытым, ждёт и проверяет результат по ЖИВОЙ странице.
import { chromium } from "playwright";
import fs from "fs";

const ПРОФ = "/opt/oko-poster/cfg/tt_diesel_prof";
const ЖУРНАЛ = "/opt/oko-poster/logs/tt_bio.log";
const НОВОЕ = "Мототехника из Китая под ключ\nТаможня и доставка в цене\nГород в директ - расчёт";
const ЖДАТЬ_МИН = Number(process.env.TT_WAIT || 180);
process.env.DISPLAY = ":99";

const пиши = (...a) => {
  const с = "[" + new Date().toISOString().slice(11, 19) + "] " + a.join(" ");
  console.log(с); try { fs.appendFileSync(ЖУРНАЛ, с + "\n"); } catch {}
};

if (НОВОЕ.length > 80) { пиши("RESULT FAIL длиннее 80"); process.exit(2); }

const ctx = await chromium.launchPersistentContext(ПРОФ, {
  headless: false, viewport: { width: 1400, height: 1000 },
  locale: "en-US", timezoneId: "Europe/Berlin",
  userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
  proxy: { server: "socks5://127.0.0.1:" + (process.env.TT_PORT || "10850") },
  args: ["--no-sandbox", "--disable-blink-features=AutomationControlled", "--window-position=0,0"],
});
const p = ctx.pages()[0] || await ctx.newPage();
p.setDefaultTimeout(60000);
let код = 1;

const капча_видна = () => p.evaluate(() =>
  [...document.querySelectorAll("[id*=captcha],[class*=captcha]")].some(e => e.offsetParent !== null));
const био_живое = () => p.evaluate(() => document.querySelector("[data-e2e=user-bio]")?.innerText || "");
const ровно = т => (т || "").replace(/\s+/g, " ").trim();

try {
  await p.goto("https://www.tiktok.com/@diesel_kitay", { waitUntil: "domcontentloaded" });
  // страница собирается скриптом и на медленном выходе доезжает не за девять секунд:
  // ждём саму кнопку правки, а не таймер, иначе читаем пустую страницу и решаем, что био пустое
  let готова = false;
  for (let i = 0; i < 20 && !готова; i++) {
    await p.waitForTimeout(5000);
    готова = await p.evaluate(() => [...document.querySelectorAll("button")].some(x => /Edit profile|Редактировать/i.test(x.innerText)));
  }
  if (/\/login/.test(p.url())) { пиши("RESULT FAIL вход слетел"); await ctx.close(); process.exit(3); }
  if (!готова) { пиши("RESULT FAIL страница профиля не собралась за 100 секунд"); await ctx.close(); process.exit(4); }
  пиши("было:", JSON.stringify(await био_живое()));

  const открыть = async () => {
    const ok = await p.evaluate(() => {
      const b = [...document.querySelectorAll("button")].find(x => /Edit profile|Редактировать/i.test(x.innerText));
      if (b) { b.click(); return true; } return false;
    });
    await p.waitForTimeout(9000);
    return ok && (await p.evaluate(() => document.querySelectorAll("textarea").length)) > 0;
  };
  const заполнить = async () => {
    await p.evaluate(() => { const t = document.querySelector("textarea"); t.scrollIntoView({ block: "center" }); t.focus(); t.setSelectionRange(0, t.value.length); });
    await p.keyboard.press("Control+A"); await p.keyboard.press("Backspace"); await p.waitForTimeout(400);
    await p.keyboard.insertText(НОВОЕ);
    await p.waitForTimeout(1500);
    return await p.evaluate(() => document.querySelector("textarea")?.value || "");
  };
  const жать_save = () => p.locator("button", { hasText: /^Save$/ }).last().click({ force: true, timeout: 20000 });

  if (!await открыть()) { пиши("RESULT FAIL модалка правки не открылась"); throw new Error("no modal"); }
  const в_поле = await заполнить();
  if (ровно(в_поле) !== ровно(НОВОЕ)) { пиши("RESULT FAIL текст в поле не совпал"); throw new Error("mismatch"); }
  if (process.env.TT_HANDS === "1") {
    // Руками: поле заполнено, Save жмёт человек через noVNC.
    // Сохранение из кода площадка отдаёт пустым ответом при любом тексте,
    // так что этот заход отвечает и на вопрос, блок на автоматизации или на аккаунте.
    пиши("ПОЛЕ ЗАПОЛНЕНО. Нажми Save сам: https://okoteam.top/view-8811858f7234 , пароль oko1802");
  } else {
    пиши("поле заполнено, 79/80, жму Save");
    await жать_save();
    await p.waitForTimeout(6000);
  }

  if (await капча_видна()) {
    пиши("КАПЧА. Нужен человек: https://okoteam.top/view-8811858f7234 , пароль oko1802, провести слайдер.");
    пиши("Жду до " + ЖДАТЬ_МИН + " минут.");
  }

  const край = Date.now() + ЖДАТЬ_МИН * 60000;
  let повторов = 0, тикали = 0;
  while (Date.now() < край) {
    await p.waitForTimeout(15000);
    if (await капча_видна()) continue;                 // человек ещё не подошёл к слайдеру
    const модалка = (await p.evaluate(() => document.querySelectorAll("textarea").length)) > 0;

    if (process.env.TT_HANDS === "1") {
      // Руками: пока модалка открыта, страницу НЕ трогаем вовсе.
      // Перезагрузка стирала заполненное поле, и человек приходил к пустой форме.
      if (модалка) {
        if (++тикали % 20 === 0) пиши("жду, поле заполнено, модалка открыта");
        continue;
      }
      пиши("модалка закрылась, смотрю профиль");
    } else if (модалка && повторов < 8) {              // капчу прошли, сохранение надо повторить
      повторов++;
      пиши("капчи нет, повторяю Save (" + повторов + ")");
      try { await жать_save(); } catch (e) { пиши("Save не нажался:", String(e).slice(0, 80)); }
      await p.waitForTimeout(8000);
      continue;
    }

    await p.goto("https://www.tiktok.com/@diesel_kitay", { waitUntil: "domcontentloaded" });
    await p.waitForTimeout(12000);
    const стало = await био_живое();
    пиши("на странице:", JSON.stringify(стало));
    if (ровно(стало) === ровно(НОВОЕ)) { пиши("RESULT OK био встало"); код = 0; break; }
    пиши("RESULT FAIL модалка закрылась, а био прежнее");
    break;
  }
  if (код !== 0 && Date.now() >= край) пиши("RESULT WAIT человек не подошёл за " + ЖДАТЬ_МИН + " минут");
} catch (e) {
  пиши("RESULT FAIL", String(e).slice(0, 200));
} finally { await ctx.close(); }
process.exit(код);
