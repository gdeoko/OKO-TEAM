/* ═══════════════════════════════════════════════════════════
   Приёмка рубки: замеры живьём, а не на глаз.

   Открывает игру на двух устройствах, ждёт, пока рама соберётся, и
   меряет то, о чём договорились с заказчиком:

     доли кадра, отданные раме, с каждой стороны
     растяжение снимка
     число клавиш и их размер под палец
     ни один слой разметки не заезжает на раму
     число треугольников и кадров в секунду

   Запуск:  node tools/audit_cab.mjs [адрес]
   ═══════════════════════════════════════════════════════════ */
import { chromium } from "/tmp/node_modules/playwright/index.mjs";

const BASE = process.argv[2] || "http://127.0.0.1:8123/";
const CHROME = process.env.CHROME_PATH || "/opt/pw-browsers/chromium/chrome-linux/chrome";

const DEVICES = [
  { имя: "телефон", w: 390, h: 844, dpr: 3 },
  { имя: "монитор", w: 1600, h: 900, dpr: 1 },
  { имя: "широкий", w: 2560, h: 1080, dpr: 1 }
];

const b = await chromium.launch({
  executablePath: CHROME,
  args: ["--no-sandbox", "--use-gl=angle", "--use-angle=swiftshader",
         "--enable-unsafe-swiftshader", "--disable-dev-shm-usage"],
  proxy: undefined
});

for (const d of DEVICES) {
  const ctx = await b.newContext({ viewport: { width: d.w, height: d.h }, deviceScaleFactor: d.dpr });
  const p = await ctx.newPage();
  const беды = [];
  p.on("pageerror", e => беды.push("ошибка: " + String(e).slice(0, 140)));
  p.on("console", m => { if (m.type() === "error") беды.push("консоль: " + m.text().slice(0, 140)); });
  p.on("response", r => { if (r.status() >= 400) беды.push("не отдалось " + r.status() + " " + r.url().slice(-70)); });
  p.on("requestfailed", r => беды.push("запрос сорвался " + r.url().slice(-70)));
  await p.goto(BASE + "?rcdbg=1", { waitUntil: "domcontentloaded", timeout: 60000 });

  /* Ждём объёмный слой и открываем полёт: рама живёт внутри него */
  await p.waitForFunction(() => window.RC_FLIGHT && window.RC_FLIGHT.open, null, { timeout: 45000 })
    .catch(() => беды.push("объёмный слой не поднялся за 45 с"));
  await p.evaluate(() => { try { window.RC_FLIGHT.open(); } catch (e) {} });
  await p.waitForFunction(() => window.RC_PANEL && window.RC_PANEL.last, null, { timeout: 45000 })
    .catch(() => беды.push("рама не собралась за 45 с"));
  /* Пока стоит карточка старта, камера ещё не в кресле. Рама живёт в
     полёте, поэтому запускаем автополёт и отматываем маршрут к
     середине - там и салон, и космос за окном. */
  await p.evaluate(() => {
    const b = document.querySelector(".rc-flight [data-mode=\"auto\"]");
    if (b) b.click();
  });
  await p.waitForTimeout(1500);
  await p.evaluate(() => { try { window.RC_FLIGHT._set(0.35); } catch (e) {} });
  await p.waitForTimeout(4000);

  const итог = await p.evaluate(() => {
    const C = window.RC_PANEL, L = C && C.last;
    if (!L) return { нет: true };
    const inner = L.inner;
    const доли = {
      слева: +((1 + inner.l) / 2 * 100).toFixed(1),
      справа: +((1 - inner.r) / 2 * 100).toFixed(1),
      сверху: +((1 - inner.t) / 2 * 100).toFixed(1),
      снизу: +((1 + inner.b) / 2 * 100).toFixed(1)
    };
    const s = L.safe;
    const окно = {
      x: Math.round((1 + s.l) / 2 * innerWidth),
      y: Math.round((1 - s.t) / 2 * innerHeight),
      w: Math.round((s.r - s.l) / 2 * innerWidth),
      h: Math.round((s.t - s.b) / 2 * innerHeight)
    };
    /* Всё видимое, что вылезло за проём */
    const вылезло = [];
    document.querySelectorAll(".rc-flight *").forEach(el => {
      const cs = getComputedStyle(el);
      if (cs.display === "none" || cs.visibility === "hidden" || +cs.opacity === 0) return;
      const r = el.getBoundingClientRect();
      if (r.width < 24 || r.height < 12) return;
      if (r.left < окно.x - 2 || r.top < окно.y - 2 ||
          r.right > окно.x + окно.w + 2 || r.bottom > окно.y + окно.h + 2) {
        if (el.children.length && el.querySelector(":scope > *")) return;
        вылезло.push((el.className || el.tagName).toString().split(" ")[0] +
          " " + Math.round(r.left) + "," + Math.round(r.top) + " " +
          Math.round(r.width) + "x" + Math.round(r.height));
      }
    });
    const F = window.RC_FLIGHT && window.RC_FLIGHT.state ? window.RC_FLIGHT.state() : null;
    return {
      доли: доли,
      окно: окно,
      вылезло: вылезло.slice(0, 8),
      рамаЖивьём: F ? F["рама"] : null,
      салон: F ? F["салон"] : null,
      кадр: { w: innerWidth, h: innerHeight }
    };
  });

  /* Клавиши и треугольники берём у самой рамы */
  /* Клавиши теперь не объёмные крышки, а места на плите: свет в её
     нишах. Меряем то, что есть на самом деле, иначе приёмка отчитается
     о нуле клавиш при живом пульте. */
  const пульт = await p.evaluate(() => {
    const cv = document.querySelector(".rcf-instr");
    const hit = [...document.querySelectorAll(".rcf-phys-hit")];
    if (!cv) return { нет: true };
    const р = hit.map(el => {
      const b = el.getBoundingClientRect();
      return Math.round(Math.min(b.width, b.height));
    });
    return {
      холст: cv.width + "x" + cv.height,
      клавиш: hit.length,
      мелкая: р.length ? Math.min.apply(null, р) : 0,
      подПалец: р.filter(v => v >= 40).length,
      заКадром: hit.filter(el => {
        const b = el.getBoundingClientRect();
        return b.right < 0 || b.bottom < 0 || b.left > innerWidth || b.top > innerHeight;
      }).length
    };
  });
  console.log("пульт:", JSON.stringify(пульт));

  const железо = await p.evaluate(() => {
    const c = window.RC_PANEL_LAST_API || null;
    if (!c) return null;
    const caps = c.caps || [];
    return {
      клавиш: caps.length,
      треугольников: c.tris || 0,
      растяжение: c.fit ? +c.fit.skew.toFixed(3) : null,
      оболочка: c.shell ? {
        вСцене: !!c.shell.parent,
        видна: c.shell.visible,
        картаЕсть: !!(c.shell.material && c.shell.material.map),
        картаГотова: !!(c.shell.material && c.shell.material.map && c.shell.material.map.image &&
                        c.shell.material.map.image.width > 0),
        размерКарты: (c.shell.material && c.shell.material.map && c.shell.material.map.image)
          ? c.shell.material.map.image.width + "x" + c.shell.material.map.image.height : "нет"
      } : null,
      подпись: caps.map(k => k.userData["имя"]).filter(Boolean).slice(0, 12),
      /* Где рама на самом деле в кадре. Три раза уже случалось, что
         геометрия собрана верно, а в кадр не попадает: салон не
         подвешен к камере, и рама уезжает в сторону. */
      наЭкране: (function () {
        const T = window.THREE, cam = window.RC_FLIGHT && window.RC_FLIGHT._cam
          ? window.RC_FLIGHT._cam() : null;
        if (!T || !cam || !c.shell) return "камеры нет";
        cam.updateMatrixWorld();
        cam.matrixWorldInverse.copy(cam.matrixWorld).invert();
        c.inner3.updateWorldMatrix(true, false);
        const v = new T.Vector3(), out = [];
        for (const pr of c.probe) {
          v.copy(pr); c.inner3.localToWorld(v); v.project(cam);
          out.push(+v.x.toFixed(2) + "," + +v.y.toFixed(2) + "," + +v.z.toFixed(2));
        }
        const wp = new T.Vector3();
        c.shell.getWorldPosition(wp);
        /* Цепочка от оболочки вверх: где именно заводится NaN */
        const цепь = [];
        let o = c.shell;
        while (o) {
          const bad = [o.position, o.scale].some(v => !isFinite(v.x + v.y + v.z)) ||
                      !isFinite(o.rotation.x + o.rotation.y + o.rotation.z);
          цепь.push((o.name || o.type) +
            " п=" + o.position.toArray().map(x => +x.toFixed(2)).join("/") +
            " м=" + o.scale.toArray().map(x => +x.toFixed(2)).join("/") +
            (bad ? " ПЛОХО" : ""));
          o = o.parent;
        }
        return { кромки: out, оболочкаМир: wp.toArray().map(x => +x.toFixed(2)),
                 камераМир: cam.position.toArray().map(x => +x.toFixed(2)),
                 цепь: цепь };
      })()
    };
  });

  await p.screenshot({ path: "/tmp/cab-" + d.имя + ".jpg", type: "jpeg", quality: 70 });
  console.log("═══", d.имя, d.w + "x" + d.h, "═══");
  console.log(JSON.stringify(итог, null, 1));
  console.log("железо:", JSON.stringify(железо));
  if (беды.length) console.log("БЕДЫ:", беды.slice(0, 6).join(" | "));
  await ctx.close();
}
await b.close();
