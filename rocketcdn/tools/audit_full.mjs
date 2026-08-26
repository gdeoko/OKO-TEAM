/* ═══════════════════════════════════════════════════════════
   Полная приёмка Rocket CDN

   Заказчик просил не отчёт, а проверку по фактам: пройти весь
   сценарий на четырёх экранах, снять кадры и померить то, что
   записано в реестре дефектов PLAN.md.

   Здесь проверяется механически всё, что вообще можно проверить
   счётом: перекрытия, размеры, доли рамы, попадание пальцем,
   ошибки в консоли, потери кадров. Остальное уходит снимками, их
   смотрит человек.

   Запуск: node tools/audit_full.mjs [адрес]
   ═══════════════════════════════════════════════════════════ */
import { chromium } from "/tmp/node_modules/playwright/index.mjs";
import { mkdirSync, writeFileSync } from "node:fs";

const BASE = process.argv[2] || "http://127.0.0.1:8123/";
const CH = process.env.CHROME_PATH || "/opt/pw-browsers/chromium-1194/chrome-linux/chrome";
const ПАПКА = "/tmp/cab/аудит";
mkdirSync(ПАПКА, { recursive: true });

const ЭКРАНЫ = [
  { имя: "1920", w: 1920, h: 1080, dpr: 1 },
  { имя: "1440", w: 1440, h: 900, dpr: 1 },
  { имя: "планшет", w: 1024, h: 768, dpr: 2 },
  { имя: "телефон", w: 390, h: 844, dpr: 3 }
];

const b = await chromium.launch({
  executablePath: CH,
  args: ["--no-sandbox", "--use-gl=angle", "--use-angle=swiftshader",
         "--enable-unsafe-swiftshader", "--disable-dev-shm-usage"]
});

const отчёт = {};

for (const э of ЭКРАНЫ) {
  const ctx = await b.newContext({ viewport: { width: э.w, height: э.h }, deviceScaleFactor: э.dpr });
  const p = await ctx.newPage();
  const беды = [];
  p.on("pageerror", e => беды.push("ошибка: " + String(e).slice(0, 130)));
  p.on("console", m => { if (m.type() === "error") беды.push("консоль: " + m.text().slice(0, 130)); });
  p.on("response", r => { if (r.status() >= 400) беды.push("не отдалось " + r.status() + " " + r.url().slice(-50)); });

  const итог = { беды: беды };
  await p.goto(BASE + "?rcdbg=1", { waitUntil: "load", timeout: 90000 });
  await p.waitForTimeout(4500);

  /* ── Б4: ракета в герое поверх заголовка ──
     Меряем не «пересекается ли», а есть ли РАКЕТА поверх букв: у
     холста ракеты свой слой, и вопрос только в порядке слоёв. */
  итог.Б4 = await p.evaluate(() => {
    const cv = document.querySelector("canvas.rc-rocket, .rc-rocket canvas, #rocket canvas, canvas[data-rc=\"rocket\"]")
      || [...document.querySelectorAll("canvas")].find(c => /rocket/i.test(c.className + c.id));
    const h1 = document.querySelector("h1, .hero h1, .hero .sec-h");
    if (!cv || !h1) return { нет: !cv ? "холста нет" : "заголовка нет" };
    const zc = +getComputedStyle(cv).zIndex || 0;
    const zh = +getComputedStyle(h1.closest("section, header, div") || h1).zIndex || 0;
    const rc = cv.getBoundingClientRect(), rh = h1.getBoundingClientRect();
    const пересек = !(rc.right < rh.left || rc.left > rh.right || rc.bottom < rh.top || rc.top > rh.bottom);
    return { zРакеты: zc, zЗаголовка: zh, пересекаются: пересек, ракетаВыше: zc > zh };
  });

  /* ── Б5: ракета идёт с самого начала прокрутки ── */
  const ход = [];
  for (const доля of [0, 0.02, 0.05, 0.09, 0.14, 0.2]) {
    await p.evaluate(d => scrollTo(0, d * (document.documentElement.scrollHeight - innerHeight)), доля);
    await p.waitForTimeout(420);
    ход.push(await p.evaluate(() => {
      const R = window.RC_ROCKET_STATE || null;
      const st = window.RC_FLIGHT && window.RC_FLIGHT.state ? window.RC_FLIGHT.state() : null;
      return { акт: document.documentElement.getAttribute("data-act") || "",
               p: st ? +(st.p || 0).toFixed(3) : null,
               ракета: R ? { s: +(R.s || 0).toFixed(3), y: +(R.y || 0).toFixed(3) } : null };
    }));
  }
  итог.Б5_ход = ход;

  /* ── Проход по всей странице: акты, потери кадров, ошибки ── */
  await p.evaluate(() => { window.__к = []; let t = performance.now();
    (function f(n){ window.__к.push((n - t) / 1000); t = n; requestAnimationFrame(f); })(t); });
  const акты = [];
  const H = await p.evaluate(() => document.documentElement.scrollHeight - innerHeight);
  for (let i = 0; i <= 22; i++) {
    await p.evaluate(y => scrollTo(0, y), Math.round(H * i / 22));
    await p.waitForTimeout(320);
    const a = await p.evaluate(() => document.documentElement.getAttribute("data-act") || "-");
    if (!акты.length || акты[акты.length - 1].акт !== a) акты.push({ акт: a, доля: 0 });
    акты[акты.length - 1].доля++;
    if (i % 4 === 0) await p.screenshot({ path: `${ПАПКА}/${э.имя}-${String(i).padStart(2, "0")}-${a}.jpg`, type: "jpeg", quality: 62 });
  }
  итог.акты = акты.map(a => a.акт + "×" + a.доля);
  итог.кадр = await p.evaluate(() => {
    const d = window.__к.slice(5).sort((a, b) => a - b);
    return { средний: +(d.reduce((a, b) => a + b, 0) / d.length * 1000).toFixed(1),
             p95: +((d[Math.floor(d.length * 0.95)] || 0) * 1000).toFixed(1),
             ступень: document.documentElement.getAttribute("data-degrade") || "0" };
  });

  /* ── Б7: посадка поверх заголовков последнего блока ── */
  await p.evaluate(() => scrollTo(0, document.documentElement.scrollHeight));
  await p.waitForTimeout(1500);
  итог.Б7 = await p.evaluate(() => {
    const низ = [...document.querySelectorAll("h2, .sec-h")].filter(el => {
      const r = el.getBoundingClientRect();
      return r.top < innerHeight && r.bottom > 0;
    }).map(el => ({ т: el.textContent.trim().slice(0, 28),
                    видно: +getComputedStyle(el).opacity }));
    return { заголовки: низ, чистка: document.documentElement.getAttribute("data-clear") || "0" };
  });

  /* ── Полёт: рубка, клавиши, голограмма, вылезшее ── */
  await p.evaluate(() => scrollTo(0, 0));
  await p.waitForTimeout(600);
  await p.evaluate(() => { try { window.RC_FLIGHT.open(); } catch (e) {} });
  await p.waitForTimeout(3500);
  await p.evaluate(() => { const b = document.querySelector('.rc-flight [data-mode="auto"]'); if (b) b.click(); });
  await p.waitForTimeout(1500);
  await p.evaluate(() => { try { window.RC_FLIGHT._set(0.35); } catch (e) {} });
  await p.waitForTimeout(3500);
  await p.screenshot({ path: `${ПАПКА}/${э.имя}-полёт.jpg`, type: "jpeg", quality: 70 });
  итог.полёт = await p.evaluate(() => {
    const C = window.RC_PANEL, L = C && C.last;
    const cv = document.querySelector(".rcf-instr");
    const hit = [...document.querySelectorAll(".rcf-phys-hit")];
    const s = L ? L.safe : null;
    const окно = s ? { x: (1 + s.l) / 2 * innerWidth, y: (1 - s.t) / 2 * innerHeight,
                       w: (s.r - s.l) / 2 * innerWidth, h: (s.t - s.b) / 2 * innerHeight } : null;
    const вылезло = [];
    if (окно) document.querySelectorAll(".rc-flight *").forEach(el => {
      const cs = getComputedStyle(el);
      if (cs.display === "none" || cs.visibility === "hidden" || +cs.opacity === 0) return;
      if (el.classList.contains("rcf-cabframe") || el.classList.contains("rcf-instr") ||
          el.classList.contains("rcf-cv") || el.classList.contains("rcf-phys-hit")) return;
      /* Метки тел живут в слое rc-holo, а он режется контуром стекла
         (clip-path из --cab-clip). Обрезка меняет отрисовку, но НЕ
         меняет getBoundingClientRect: коробка ореола по-прежнему
         торчит за окно, хотя на экране за ним ничего не нарисовано.
         Приёмка на этом кричала про rch-halo и rch-glow три прогона
         подряд, и один раз я по её крику добавила на сайт правило,
         которое чинило то, что и так было починено. Считаем такие
         элементы обрезанными, а проверяем сам слой ниже. */
      if (el.closest(".rc-holo")) return;
      const r = el.getBoundingClientRect();
      if (r.width < 30 || r.height < 16) return;
      if (el.children.length) return;
      if (r.left < окно.x - 2 || r.top < окно.y - 2 ||
          r.right > окно.x + окно.w + 2 || r.bottom > окно.y + окно.h + 2)
        вылезло.push((el.className || el.tagName).toString().split(" ")[0]);
    });
    const доли = L ? {
      слева: +((1 + L.inner.l) / 2 * 100).toFixed(1),
      справа: +((1 - L.inner.r) / 2 * 100).toFixed(1),
      сверху: +((1 - L.inner.t) / 2 * 100).toFixed(1),
      снизу: +((1 + L.inner.b) / 2 * 100).toFixed(1)
    } : null;
    return {
      рамаЕсть: !!L, доли: доли,
      холст: cv ? cv.width + "x" + cv.height : "НЕТ",
      клавиш: hit.length,
      мелкая: hit.length ? Math.min.apply(null, hit.map(el => {
        const r = el.getBoundingClientRect(); return Math.round(Math.min(r.width, r.height)); })) : 0,
      заКадром: hit.filter(el => { const r = el.getBoundingClientRect();
        return r.right < 0 || r.bottom < 0 || r.left > innerWidth || r.top > innerHeight; }).length,
      голограмма: !!document.querySelector(".rcf-holo"),
      вылезло: [...new Set(вылезло)].slice(0, 8),
      /* Слой меток обязан быть обрезан по стеклу. Если контур не
         доехал, метки светят на железо рубки - и вот это уже дефект. */
      меткиОбрезаны: (function () {
        const л = document.querySelector(".rc-holo");
        if (!л) return "слоя нет";
        const c = getComputedStyle(л).clipPath;
        return c && c !== "none" ? "по контуру" : "НЕ ОБРЕЗАН";
      })()
    };
  });

  итог.беды = [...new Set(беды)].slice(0, 6);
  отчёт[э.имя] = итог;
  console.log("═══", э.имя, "═══");
  console.log(JSON.stringify(итог, null, 1));
  await ctx.close();
}
writeFileSync(ПАПКА + "/отчёт.json", JSON.stringify(отчёт, null, 1));
console.log("снимки и отчёт:", ПАПКА);
await b.close();
