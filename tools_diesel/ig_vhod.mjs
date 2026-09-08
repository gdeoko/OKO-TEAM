// Вход в Instagram по логину, паролю и одноразовому коду. Профиль браузера свой
// на каждый аккаунт, выход только мобильный: с обычного адреса вход у нас
// заканчивается проверкой личности.
//   IG_ACC=TOP|ZA node ig_vhod.mjs
import { chromium } from "playwright";
import crypto from "crypto";

const АКК = (process.env.IG_ACC || "ZA").toUpperCase();
const П = н => process.env[`IG_DS_${АКК}_${н}`] || "";
const НИК = П("USERNAME"), ПАРОЛЬ = П("PASS"), СЕКРЕТ = (П("TOTP") || "").replace(/\s/g, "");
const ПРОФИЛЬ = "/opt/oko-poster/" + (П("PROFILE") || `browser/ig_${АКК.toLowerCase()}`);
process.env.DISPLAY = ":99";

if (!НИК || !ПАРОЛЬ) { console.log("RESULT FAIL нет логина или пароля для", АКК); process.exit(2); }

// Одноразовый код по RFC 6238. Ставить библиотеку ради тридцати строк незачем.
function код(секрет, сдвиг = 0) {
  const алф = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  let биты = "";
  for (const с of секрет.toUpperCase().replace(/=+$/, "")) {
    const i = алф.indexOf(с);
    if (i < 0) continue;
    биты += i.toString(2).padStart(5, "0");
  }
  const байты = Buffer.from((биты.match(/.{8}/g) || []).map(b => parseInt(b, 2)));
  const шаг = Math.floor(Date.now() / 30000) + сдвиг;
  const счёт = Buffer.alloc(8);
  счёт.writeUInt32BE(Math.floor(шаг / 2 ** 32), 0);
  счёт.writeUInt32BE(шаг >>> 0, 4);
  const h = crypto.createHmac("sha1", байты).update(счёт).digest();
  const о = h[h.length - 1] & 0xf;
  const ч = ((h[о] & 0x7f) << 24 | h[о + 1] << 16 | h[о + 2] << 8 | h[о + 3]) % 1e6;
  return String(ч).padStart(6, "0");
}

function разобрать(с) {
  if (!с) return undefined;
  try { const у = new URL(с); const о = { server: у.protocol + "//" + у.host };
    if (у.username) { о.username = decodeURIComponent(у.username); о.password = decodeURIComponent(у.password); }
    return о; } catch { return { server: с }; }
}

const ctx = await chromium.launchPersistentContext(ПРОФИЛЬ, {
  headless: false, viewport: { width: 1400, height: 1000 },
  locale: "ru-RU", timezoneId: "Asia/Almaty",
  proxy: разобрать(process.env.IG_PROXY_HTTP),
  userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
  args: ["--no-sandbox", "--disable-blink-features=AutomationControlled"],
});
const p = ctx.pages()[0] || await ctx.newPage();
p.setDefaultTimeout(90000);
const лог = (...a) => console.log("[вход " + АКК + "]", ...a);
let код_выхода = 1;

const свой = () => p.evaluate(() => ({
  ид: (document.cookie.match(/ds_user_id=(\d+)/) || [])[1] || "",
  url: location.href,
  текст: (document.body.innerText || "").slice(0, 300),
}));

try {
  await p.goto("https://www.instagram.com/", { waitUntil: "domcontentloaded" });
  await p.waitForTimeout(10000);
  let с = await свой();
  лог("на входе:", с.url, "| ds_user_id", с.ид || "нет");

  if (/accounts\/suspended/.test(с.url)) { лог("RESULT SUSPENDED аккаунт приостановлен"); await ctx.close(); process.exit(3); }

  if (!с.ид) {
    await p.goto("https://www.instagram.com/accounts/login/", { waitUntil: "domcontentloaded" });
    await p.waitForTimeout(9000);
    // куки-баннер закрывает форму
    await p.evaluate(() => {
      for (const b of document.querySelectorAll("button")) {
        const t = (b.innerText || "").trim();
        if (/Разрешить все|Allow all|Принять|Accept/i.test(t) && b.offsetParent !== null) { b.click(); return; }
      }
    }).catch(() => {});
    await p.waitForTimeout(3000);
    await p.fill('input[name="username"]', НИК);
    await p.fill('input[name="password"]', ПАРОЛЬ);
    await p.waitForTimeout(800);
    await p.click('button[type="submit"]');
    лог("логин отправлен, жду");
    await p.waitForTimeout(15000);
    с = await свой();
    лог("после логина:", с.url);

    if (/two_factor|challenge/.test(с.url) || /код|code/i.test(с.текст)) {
      if (!СЕКРЕТ) { лог("RESULT FAIL просит код, а секрета нет"); throw new Error("нет TOTP"); }
      const поле = await p.$('input[name="verificationCode"]') || await p.$('input[type="text"]');
      if (!поле) { лог("RESULT FAIL поля кода нет:", с.текст.slice(0, 120)); throw new Error("нет поля"); }
      // код живёт тридцать секунд, поэтому берём свежий прямо перед вводом
      const шифр = код(СЕКРЕТ);
      await поле.fill(шифр);
      лог("ввожу одноразовый код");
      await p.waitForTimeout(1000);
      const кн = await p.$('button[type="submit"]') ||
                 (await p.$$("button")).find(async () => true);
      if (кн) await кн.click().catch(() => {});
      await p.waitForTimeout(15000);
      с = await свой();
      лог("после кода:", с.url, "| ds_user_id", с.ид || "нет");
    }
  }

  // Проверяем по ЖИВОМУ профилю, а не по факту, что форма ушла
  await p.goto("https://www.instagram.com/" + НИК + "/", { waitUntil: "domcontentloaded" });
  await p.waitForTimeout(12000);
  const и = await p.evaluate(() => ({
    ид: (document.cookie.match(/ds_user_id=(\d+)/) || [])[1] || "",
    свой: /Редактировать профиль|Edit profile/i.test(document.body.innerText || ""),
    url: location.href,
    шапка: (document.body.innerText || "").split("\n").filter(Boolean).slice(0, 6).join(" | ").slice(0, 160),
  }));
  лог("итог:", JSON.stringify(и));
  if (/accounts\/suspended/.test(и.url)) { лог("RESULT SUSPENDED аккаунт приостановлен"); код_выхода = 3; }
  else if (и.ид && и.свой) { лог("RESULT OK вошли"); код_выхода = 0; }
  else лог("RESULT FAIL не вошли");
} catch (e) {
  лог("RESULT FAIL", String(e).slice(0, 200));
} finally { await ctx.close(); }
process.exit(код_выхода);
