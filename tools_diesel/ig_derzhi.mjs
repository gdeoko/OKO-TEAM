// Держать окно Instagram открытым, пока человек проходит проверку через noVNC.
// Проверку «подтвердите, что вы человек» проходит человек, а не скрипт.
//   IG_PROF=browser/ig_dsnew IG_NICK=diesel_cargo_top IG_WAIT=180 node ig_derzhi.mjs
import { chromium } from "playwright";
import fs from "fs";

const ПРОФ = "/opt/oko-poster/" + (process.env.IG_PROF || "browser/ig_dsnew");
const НИК = process.env.IG_NICK || "diesel_cargo_top";
const ЖУРНАЛ = "/opt/oko-poster/logs/ig_derzhi.log";
const ЖДАТЬ = Number(process.env.IG_WAIT || 180);
process.env.DISPLAY = ":99";
const пиши = (...a) => {
  const с = "[" + new Date().toISOString().slice(11, 19) + "] " + a.join(" ");
  console.log(с); try { fs.appendFileSync(ЖУРНАЛ, с + "\n"); } catch {}
};
function разобрать(с) {
  if (!с) return undefined;
  try { const у = new URL(с); const о = { server: у.protocol + "//" + у.host };
    if (у.username) { о.username = decodeURIComponent(у.username); о.password = decodeURIComponent(у.password); }
    return о; } catch { return { server: с }; }
}
const ctx = await chromium.launchPersistentContext(ПРОФ, {
  headless: false, viewport: { width: 1400, height: 1000 },
  locale: "ru-RU", timezoneId: "Asia/Almaty",
  proxy: разобрать(process.env.IG_PROXY_HTTP),
  userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
  args: ["--no-sandbox", "--disable-blink-features=AutomationControlled", "--window-position=0,0"],
});
const p = ctx.pages()[0] || await ctx.newPage();
p.setDefaultTimeout(90000);
try {
  await p.goto("https://www.instagram.com/accounts/suspended/", { waitUntil: "domcontentloaded" });
  await p.waitForTimeout(12000);
  пиши(НИК + ": окно открыто. Пройди проверку сам:");
  пиши("https://okoteam.top/view-8811858f7234 , пароль VNC oko1802");
  const край = Date.now() + ЖДАТЬ * 60000;
  let тик = 0;
  while (Date.now() < край) {
    await p.waitForTimeout(20000);
    const у = await p.evaluate(() => location.href).catch(() => "");
    if (у && !/accounts\/suspended/.test(у)) {
      пиши("блокировка снята, адрес:", у);
      await p.goto("https://www.instagram.com/" + НИК + "/", { waitUntil: "domcontentloaded" });
      await p.waitForTimeout(12000);
      const и = await p.evaluate(() => ({
        url: location.href,
        свой: /Редактировать профиль|Edit profile/i.test(document.body.innerText || ""),
      }));
      пиши(и.свой ? "RESULT OK аккаунт открылся" : "RESULT ЖДЁМ, профиль ещё не свой: " + и.url);
      if (и.свой) break;
    } else if (++тик % 15 === 0) пиши("жду, окно на блокировке");
  }
  пиши("время вышло или готово, окно закрываю");
} catch (e) { пиши("RESULT FAIL", String(e).slice(0, 200)); }
finally { await ctx.close(); }
