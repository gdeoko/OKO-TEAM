// Что именно говорит Instagram про аккаунт: блокировка, срок, есть ли обжалование.
import { chromium } from "playwright";
process.env.DISPLAY = ":99";
function разобрать(с) {
  if (!с) return undefined;
  try { const у = new URL(с); const о = { server: у.protocol + "//" + у.host };
    if (у.username) { о.username = decodeURIComponent(у.username); о.password = decodeURIComponent(у.password); }
    return о; } catch { return { server: с }; }
}
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
  await p.goto("https://www.instagram.com/accounts/suspended/", { waitUntil: "domcontentloaded" });
  await p.waitForTimeout(12000);
  const д = await p.evaluate(() => ({
    url: location.href,
    текст: (document.body.innerText || "").replace(/\n{2,}/g, "\n").slice(0, 1500),
    кнопки: [...document.querySelectorAll("button,a[role=button],div[role=button]")]
      .filter(b => b.offsetParent !== null).map(b => (b.innerText || "").trim()).filter(Boolean).slice(0, 12),
    ид: (document.cookie.match(/ds_user_id=(\d+)/) || [])[1] || "(нет)",
  }));
  console.log(JSON.stringify(д, null, 1));
} catch (e) { console.log("ОШИБКА", String(e).slice(0, 200)); }
await ctx.close();
