/* Сколько раз boot() вешает свои слушатели. Считаем по факту:
   подменяем addEventListener и смотрим, сколько раз пришли те же
   подписки rc-interior. */
import { браузер, ЭКРАНЫ } from "./общее.mjs";
const b = await браузер();
const pg = await b.newPage({ viewport: ЭКРАНЫ["ПК"].vp });
await pg.addInitScript(() => {
  window.__счёт = {};
  const ориг = window.addEventListener.bind(window);
  window.addEventListener = function (t, f, o) { window.__счёт[t] = (window.__счёт[t] || 0) + 1; return ориг(t, f, o); };
  const оригД = document.addEventListener.bind(document);
  document.addEventListener = function (t, f, o) { window.__счёт["doc:" + t] = (window.__счёт["doc:" + t] || 0) + 1; return оригД(t, f, o); };
});
await pg.goto("http://127.0.0.1:8123/?rcdbg=1", { waitUntil: "domcontentloaded", timeout: 120000 });
await pg.waitForTimeout(14000);
const с = await pg.evaluate(() => ({
  hatch: window.__счёт["rc:hatch"] || 0,
  pageshow: window.__счёт["pageshow"] || 0,
  вид: window.__счёт["doc:visibilitychange"] || 0,
  язык: window.__счёт["doc:rc:lang"] || 0,
  тремер: window.RC_MOTION && window.RC_MOTION.__n
}));
console.log("подписок после загрузки:", JSON.stringify(с));
await b.close();
