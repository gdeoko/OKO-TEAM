import { chromium } from "playwright";
const бр = await chromium.launch({
  executablePath: "/opt/pw-browsers/chromium-1234/chrome-linux64/chrome",
  args: ["--use-gl=angle","--use-angle=swiftshader","--enable-unsafe-swiftshader"]});
const с = await бр.newPage({ viewport: { width: 1440, height: 900 } });
await с.goto("http://127.0.0.1:8170/", { waitUntil: "domcontentloaded", timeout: 90000 });
await с.waitForFunction(() => window.RV_WORLD && window.RV_WORLD["вступлениеИдёт"] && !window.RV_WORLD["вступлениеИдёт"](), null, { timeout: 300000 }).catch(()=>{});
await с.waitForTimeout(3000);
await с.evaluate(() => window.RV_MOTION["кПунктy"]("прокол", 0.45));
await с.waitForTimeout(4000);
console.log(await с.evaluate(() => {
  const у = window.RV_ТРУБА["узел"]();
  const стр = [];
  const обход = (о, гл) => {
    for (const р of о.children) {
      стр.push("  ".repeat(гл) + (р.name || р.type) + (р.visible ? "" : "  [скрыт]"));
      if (гл < 2) обход(р, гл + 1);
    }
  };
  обход(у, 0);
  return стр.join("\n");
}));
await бр.close();
