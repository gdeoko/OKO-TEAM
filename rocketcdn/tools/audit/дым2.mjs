const { chromium } = await import(process.env.RC_PW || "/tmp/node_modules/playwright/index.mjs");
const АДРЕС = "http://127.0.0.1:8123/?rcdbg=1";
const b = await chromium.launch({ args: ["--use-gl=swiftshader", "--enable-unsafe-swiftshader",
  "--autoplay-policy=no-user-gesture-required", "--disable-dev-shm-usage"] });
const pg = await b.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
pg.on("crash", () => console.log("!!! CRASH"));
pg.on("close", () => console.log("!!! CLOSE"));
pg.on("pageerror", e => console.log("JS:", e.message.slice(0,200)));
pg.on("console", m => { if (m.type()==="error") console.log("CONS:", m.text().slice(0,200)); });
await pg.goto(АДРЕС, { waitUntil: "domcontentloaded", timeout: 120000 });
await pg.waitForTimeout(9000);
console.log("загружено", await pg.evaluate(() => !!window.RC_FLIGHT));
await pg.evaluate(() => window.RC_FLIGHT.open());
for (let i = 0; i < 14; i++) {
  await pg.waitForTimeout(1000);
  try {
    const s = await pg.evaluate(() => { const st = window.RC_FLIGHT._state(); return st.открыт + "/" + st.собран + "/p" + st.p; });
    console.log(i, s);
  } catch (e) { console.log(i, "УПАЛА:", e.message.slice(0, 80)); break; }
}
await b.close();
