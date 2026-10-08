/* Минимальный и живучий замер: сколько миллисекунд главный поток
   занят НЕПРЕРЫВНО при входе в ракету, и чем именно. */
import { АДРЕС, ЭКРАНЫ, браузер } from "./общее.mjs";

const имя = process.argv[2] || "ПК";
const э = ЭКРАНЫ[имя];
const ЛОГ = [];
const п = (s) => { ЛОГ.push(s); console.log(s); };

for (let попытка = 1; попытка <= 3; попытка++) {
  let b;
  try {
    b = await браузер();
    const pg = await b.newPage({ viewport: э.vp, deviceScaleFactor: э.dpr, isMobile: э.mob, hasTouch: э.mob });
    await pg.addInitScript(() => {
      window.__ЭТАПЫ = [];
      window.__ДЛ = [];
      try { new PerformanceObserver(l => l.getEntries().forEach(e => window.__ДЛ.push(Math.round(e.duration))))
        .observe({ type: "longtask", buffered: true }); } catch (e) {}
      /* Ставим секундомер на каждое создание холста и getImageData:
         процедурные текстуры считаются именно там. */
      const gid = CanvasRenderingContext2D.prototype.getImageData;
      window.__гид = { n: 0, мс: 0, пикс: 0 };
      CanvasRenderingContext2D.prototype.getImageData = function (...a) {
        const t = performance.now(); const r = gid.apply(this, a);
        window.__гид.n++; window.__гид.мс += performance.now() - t;
        window.__гид.пикс += (a[2] || 0) * (a[3] || 0);
        return r;
      };
      const pid = CanvasRenderingContext2D.prototype.putImageData;
      window.__пид = { n: 0, мс: 0 };
      CanvasRenderingContext2D.prototype.putImageData = function (...a) {
        const t = performance.now(); const r = pid.apply(this, a);
        window.__пид.n++; window.__пид.мс += performance.now() - t; return r;
      };
      const ce = Document.prototype.createElement;
      window.__холсты = 0;
      Document.prototype.createElement = function (t, ...r) {
        if (String(t).toLowerCase() === "canvas") window.__холсты++;
        return ce.call(this, t, ...r);
      };
    });
    const cdp = await pg.context().newCDPSession(pg);
    await cdp.send("Performance.enable");
    const M = async () => Object.fromEntries((await cdp.send("Performance.getMetrics")).metrics.map(m => [m.name, m.value]));

    await pg.goto(АДРЕС, { waitUntil: "domcontentloaded", timeout: 180000 });
    await pg.waitForTimeout(9000);
    п("═══ ВХОД В РАКЕТУ · " + имя + " " + э.vp.width + "x" + э.vp.height + " dpr" + э.dpr + " (попытка " + попытка + ") ═══");

    const до = await M();
    await pg.evaluate(() => { window.__ДЛ.length = 0; window.__гид = { n: 0, мс: 0, пикс: 0 }; window.__пид = { n: 0, мс: 0 }; window.__холсты = 0; });
    const рез = await pg.evaluate(() => {
      const t0 = performance.now();
      let ок = false, ош = "";
      try {
        if (window.RC_FLIGHT && window.RC_FLIGHT.open) { window.RC_FLIGHT.open(); ок = true; }
        else { const k = document.querySelector(".js-flight"); if (k) { k.click(); ок = true; } }
      } catch (e) { ош = e.message; }
      return { ок, ош, синхронно: Math.round(performance.now() - t0) };
    });
    п("вошли: " + рез.ок + (рез.ош ? "  ошибка: " + рез.ош : ""));
    п("НЕПРЕРЫВНАЯ СИНХРОННАЯ РАБОТА RC_FLIGHT.open(): " + рез.синхронно + " мс");
    await pg.waitForTimeout(13000);
    const после = await M();
    const св = await pg.evaluate(() => ({ дл: window.__ДЛ.slice().sort((a, b) => b - a), гид: window.__гид, пид: window.__пид, холсты: window.__холсты,
      узлы: document.querySelectorAll("*").length,
      холстовВДом: document.querySelectorAll("canvas").length }));
    п("длинные задачи после входа (мс): " + JSON.stringify(св.дл.slice(0, 12)));
    п("  задач >200мс: " + св.дл.filter(x => x > 200).length + ", >1000мс: " + св.дл.filter(x => x > 1000).length + ", сумма " + св.дл.reduce((a, c) => a + c, 0));
    п("getImageData: вызовов " + св.гид.n + ", " + Math.round(св.гид.мс) + " мс, пикселей " + св.гид.пикс.toLocaleString("ru"));
    п("putImageData: вызовов " + св.пид.n + ", " + Math.round(св.пид.мс) + " мс");
    п("создано холстов за вход: " + св.холсты + ", холстов в DOM: " + св.холстовВДом);
    п("узлов в DOM после входа: " + св.узлы);
    п("CDP за вход: Layout " + ((после.LayoutDuration - до.LayoutDuration) * 1000).toFixed(0) +
      " мс, Стиль " + ((после.RecalcStyleDuration - до.RecalcStyleDuration) * 1000).toFixed(0) +
      " мс, Скрипт " + ((после.ScriptDuration - до.ScriptDuration) * 1000).toFixed(0) +
      " мс, Задачи " + ((после.TaskDuration - до.TaskDuration) * 1000).toFixed(0) + " мс");
    п("узлов " + после.Nodes + " (было " + до.Nodes + "), слушателей " + после.JSEventListeners + " (было " + до.JSEventListeners + ")," +
      " память " + (после.JSHeapUsedSize / 1048576).toFixed(1) + " МБ (было " + (до.JSHeapUsedSize / 1048576).toFixed(1) + ")");
    await b.close();
    break;
  } catch (e) {
    п("попытка " + попытка + " сорвалась: " + e.message.slice(0, 120));
    try { await b.close(); } catch (e2) {}
  }
}
