/* ══════════════════════════════════════════════════════════
   Общий измеритель для сплошного аудита сайта и игры.

   Правила этой песочницы, без которых любой замер врёт:
   · видеокарты нет, слой отдаёт два-три кадра в секунду.
     Любой снимок и любой замер требуют СЕКУНД выдержки;
   · прыжок по якорю ломает сцену - сайт уходит в перемотку.
     Ходить только прокруткой, шагами;
   · HTTPS_PROXY надо сбрасывать, иначе браузер не достучится
     до локального сервера.

   Сервер: php -S 127.0.0.1:8123 -t .   (обычно уже поднят)
   ══════════════════════════════════════════════════════════ */
const { chromium } = await import(process.env.RC_PW || "/tmp/node_modules/playwright/index.mjs");

export const АДРЕС = process.env.RC_URL || "http://127.0.0.1:8123/?rcdbg=1";

export const ЭКРАНЫ = {
  "телефон":  { имя: "телефон",  vp: { width: 412,  height: 800  }, dpr: 2, mob: true  },
  "узкий":    { имя: "узкий",    vp: { width: 360,  height: 640  }, dpr: 2, mob: true  },
  "планшет":  { имя: "планшет",  vp: { width: 820,  height: 1180 }, dpr: 2, mob: true  },
  "четыре":   { имя: "четыре",   vp: { width: 1024, height: 768  }, dpr: 1, mob: false },
  "ноутбук":  { имя: "ноутбук",  vp: { width: 1280, height: 720  }, dpr: 1, mob: false },
  "ПК":       { имя: "ПК",       vp: { width: 1440, height: 900  }, dpr: 1, mob: false },
  "широкий":  { имя: "широкий",  vp: { width: 1920, height: 1080 }, dpr: 1, mob: false },
  "лежачий":  { имя: "лежачий",  vp: { width: 900,  height: 412  }, dpr: 2, mob: true  }
};

export async function браузер() {
  return chromium.launch({ args: ["--use-gl=swiftshader", "--enable-unsafe-swiftshader",
                                  "--autoplay-policy=no-user-gesture-required"] });
}

/* Страница с копилкой бед: ошибки и неудачные запросы копятся сами. */
export async function страница(b, э) {
  /* Сертификат боевого домена в песочнице подписан прокси, и без
     этого флага проверка боевого сайта падает на подмене
     удостоверяющего центра. На локальный сервер флаг не влияет. */
  const pg = await b.newPage({ viewport: э.vp, deviceScaleFactor: э.dpr,
                               isMobile: э.mob, hasTouch: э.mob,
                               ignoreHTTPSErrors: true });
  const беды = [];
  pg.on("pageerror", (e) => беды.push("JS: " + e.message.slice(0, 160)));
  pg.on("console", (m) => {
    const t = m.text();
    if (m.type() === "error" && !/api\.php|501|favicon/.test(t)) беды.push("КОНС: " + t.slice(0, 160));
  });
  pg.on("response", (r) => {
    if (r.status() >= 400 && !/api\.php/.test(r.url())) беды.push(r.status() + " " + r.url().slice(-60));
  });
  pg.on("requestfailed", (r) => {
    const u = r.url();
    if (/api\.php|analytics/.test(u)) return;
    /* Фоновые видео тянутся кусками и в момент закрытия браузера
       недокачанный кусок обрывается. Это шум замера, а не беда сайта:
       отдельная проверка показала readyState 4 и ноль ошибок у обоих
       роликов. Считаем бедой только настоящий отказ, не отмену. */
    const причина = r.failure() ? r.failure().errorText : "";
    if (/\.(webm|mp4)(\?|$)/.test(u) && /ABORTED|net::ERR_ABORTED/.test(причина)) return;
    беды.push("СОРВАЛСЯ " + u.slice(-60) + (причина ? " :: " + причина : ""));
  });
  await pg.goto(АДРЕС, { waitUntil: "domcontentloaded", timeout: 120000 });
  await pg.waitForTimeout(9000);
  return { pg, беды };
}

/* Войти в игру и закрыть брифинг. Возвращает false, если не вышло. */
export async function вИгру(pg) {
  const ок = await pg.evaluate(() => {
    if (window.RC_FLIGHT && window.RC_FLIGHT.open) { window.RC_FLIGHT.open(); return true; }
    const к = document.querySelector(".js-flight");
    if (к) { к.click(); return true; }
    return false;
  });
  if (!ок) return false;
  await pg.waitForTimeout(13000);
  await pg.evaluate(() => {
    const b = document.querySelector(".rcf-brief-btns button[data-mode='manual']") ||
              document.querySelector(".rcf-brief-btns button") ||
              document.querySelector(".rcf-brief .rcf-go");
    if (b) b.click();
    const br = document.querySelector(".rcf-brief");
    if (br) br.classList.add("off");
  });
  await pg.waitForTimeout(1500);
  return true;
}

/* Прямоугольник проёма рубки в точках экрана. */
export async function проём(pg) {
  return pg.evaluate(() => {
    const h = document.querySelector(".rc-flight");
    if (!h) return null;
    const cs = getComputedStyle(h);
    const д = (k) => parseFloat(cs.getPropertyValue(k)) / 100;
    return { л: innerWidth * д("--cab-wx"),
             п: innerWidth * (д("--cab-wx") + д("--cab-ww")),
             в: innerHeight * д("--cab-wy"),
             н: innerHeight * (д("--cab-wy") + д("--cab-wh")) };
  });
}

/* ── Три главных мерила ────────────────────────────────────── */

/* Обрезанный текст: содержимое шире или выше своей коробки. */
export async function обрезки(pg, корень) {
  return pg.evaluate((к) => {
    const из = [];
    const где = к ? document.querySelectorAll(к + " *") : document.querySelectorAll("body *");
    где.forEach((э) => {
      const s = getComputedStyle(э);
      if (s.display === "none" || s.visibility === "hidden" || +s.opacity < 0.06) return;
      const r = э.getBoundingClientRect();
      if (r.width < 6 || r.height < 6) return;
      if (r.bottom < 0 || r.top > innerHeight || r.right < 0 || r.left > innerWidth) return;
      const свой = [...э.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim());
      if (!свой) return;
      const бок = э.scrollWidth - э.clientWidth;
      const низ = э.scrollHeight - э.clientHeight;
      const режет = s.overflow !== "visible" || s.overflowX !== "visible" || s.overflowY !== "visible";
      if (!режет) return;
      if (бок > 1 || низ > 1) {
        из.push({ кто: (э.className || "").toString().split(" ").slice(0, 2).join(".") || э.tagName,
                  бок: бок, низ: низ,
                  текст: (э.textContent || "").replace(/\s+/g, " ").trim().slice(0, 46),
                  рект: [Math.round(r.left), Math.round(r.top), Math.round(r.width), Math.round(r.height)] });
      }
    });
    return из;
  }, корень || null);
}

/* Что выходит за проём остекления: на раму не должно заезжать ничего. */
export async function завыход(pg, селекторы) {
  const w = await проём(pg);
  if (!w) return { проёма: "нет", вылеты: [] };
  const вылеты = await pg.evaluate(({ w, сел }) => {
    const из = [];
    сел.forEach((c) => document.querySelectorAll(c).forEach((э) => {
      const s = getComputedStyle(э);
      if (s.display === "none" || s.visibility === "hidden" || +s.opacity < 0.06) return;
      const r = э.getBoundingClientRect();
      if (r.width < 6 || r.height < 6) return;
      const л = w.л - r.left, п = r.right - w.п, в = w.в - r.top, н = r.bottom - w.н;
      const макс = Math.max(л, п, в, н);
      if (макс > 2) из.push({ кто: c, вылет: Math.round(макс),
                              сторона: макс === л ? "влево" : макс === п ? "вправо" : макс === в ? "вверх" : "вниз",
                              текст: (э.innerText || "").replace(/\s+/g, " ").trim().slice(0, 34) });
    }));
    return из;
  }, { w, сел: селекторы });
  return { проём: w, вылеты };
}

/* Попарные пересечения видимых узлов. Контейнеры исключаем. */
export async function наложения(pg, селекторы, контейнеры) {
  return pg.evaluate(({ сел, конт }) => {
    const шт = [];
    сел.forEach((c) => document.querySelectorAll(c).forEach((э) => {
      if (конт.some((k) => э.classList && э.classList.contains(k))) return;
      const s = getComputedStyle(э);
      if (s.display === "none" || s.visibility === "hidden" || +s.opacity < 0.06) return;
      const r = э.getBoundingClientRect();
      if (r.width < 6 || r.height < 6) return;
      if (r.bottom < 2 || r.top > innerHeight - 2 || r.right < 2 || r.left > innerWidth - 2) return;
      шт.push({ c, x: r.left, y: r.top, w: r.width, h: r.height,
                t: (э.innerText || "").replace(/\s+/g, " ").trim().slice(0, 30) });
    }));
    const из = [];
    for (let i = 0; i < шт.length; i++) for (let j = i + 1; j < шт.length; j++) {
      const a = шт[i], b = шт[j];
      if (a.c === b.c) continue;
      /* Вложенность не пересечение */
      const вложен = (p, c) => c.x >= p.x - 1 && c.y >= p.y - 1 &&
                                c.x + c.w <= p.x + p.w + 1 && c.y + c.h <= p.y + p.h + 1;
      if (вложен(a, b) || вложен(b, a)) continue;
      const ш = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x);
      const в = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y);
      if (ш > 2 && в > 2) из.push({ а: a.c, б: b.c, ширина: Math.round(ш), высота: Math.round(в),
                                     текстА: a.t, текстБ: b.t });
    }
    return из;
  }, { сел: селекторы, конт: контейнеры || [] });
}

export function итог(имя, беды, ошибки) {
  const плохо = беды.length || (ошибки || []).length;
  console.log((плохо ? "ПЛОХО  " : "ЧИСТО  ") + имя);
  беды.forEach((б) => console.log("   " + (typeof б === "string" ? б : JSON.stringify(б))));
  (ошибки || []).slice(0, 8).forEach((о) => console.log("   " + о));
  return плохо ? 1 : 0;
}
