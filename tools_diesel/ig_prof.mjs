// Что видит человек в профиле: аватар, имя, описание, ссылка, счётчики.
import { chromium } from "playwright";
process.env.DISPLAY = ":99";
function разобрать(с) {
  if (!с) return undefined;
  try { const у = new URL(с); const о = { server: у.protocol + "//" + у.host };
    if (у.username) { о.username = decodeURIComponent(у.username); о.password = decodeURIComponent(у.password); }
    return о; } catch { return { server: с }; }
}
const НИК = process.env.IG_NICK || "diesel_cargo_top";
const ctx = await chromium.launchPersistentContext("/opt/oko-poster/" + (process.env.IG_PROF || "browser/ig_dsnew"), {
  headless: false, viewport: { width: 1400, height: 1000 },
  locale: "ru-RU", timezoneId: "Asia/Almaty",
  proxy: разобрать(process.env.IG_PROXY_HTTP),
  userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
  args: ["--no-sandbox", "--disable-blink-features=AutomationControlled"],
});
const p = ctx.pages()[0] || await ctx.newPage();
p.setDefaultTimeout(90000);
try {
  await p.goto("https://www.instagram.com/" + НИК + "/", { waitUntil: "domcontentloaded" });
  await p.waitForTimeout(14000);
  const д = await p.evaluate(() => {
    const шапка = document.querySelector("header") || document.body;
    const ава = [...шапка.querySelectorAll("img")].map(i => ({
      alt: (i.alt || "").slice(0, 60), w: i.naturalWidth, h: i.naturalHeight,
      свой: /profile picture|фото профиля/i.test(i.alt || ""),
    })).slice(0, 4);
    const ссылки = [...шапка.querySelectorAll("a")].map(a => a.href)
      .filter(h => h && !/instagram\.com/.test(h)).slice(0, 4);
    return {
      url: location.href,
      текст: (шапка.innerText || "").split("\n").filter(Boolean).slice(0, 14).join(" | "),
      аватары: ава,
      внешние_ссылки: ссылки,
    };
  });
  console.log(JSON.stringify(д, null, 1));
} catch (e) { console.log("ОШИБКА", String(e).slice(0, 200)); }
await ctx.close();
