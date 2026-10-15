/* Устойчивый запуск под большой нагрузкой: без звука, длинные ожидания,
   вход в игру по факту готовности, а не по таймеру. */
const { chromium } = await import(process.env.RC_PW || "/tmp/node_modules/playwright/index.mjs");
export const АДРЕС = process.env.RC_URL || "http://127.0.0.1:8123/?rcdbg=1";

export const ЭКРАНЫ = {
  "телефон":  { vp: { width: 412,  height: 800  }, dpr: 1, mob: true  },
  "узкий":    { vp: { width: 360,  height: 640  }, dpr: 1, mob: true  },
  "планшет":  { vp: { width: 820,  height: 1180 }, dpr: 1, mob: true  },
  "четыре":   { vp: { width: 1024, height: 768  }, dpr: 1, mob: false },
  "ноутбук":  { vp: { width: 1280, height: 720  }, dpr: 1, mob: false },
  "ПК":       { vp: { width: 1440, height: 900  }, dpr: 1, mob: false },
  "широкий":  { vp: { width: 1920, height: 1080 }, dpr: 1, mob: false },
  "лежачий":  { vp: { width: 900,  height: 412  }, dpr: 1, mob: true  }
};

export async function браузер() {
  return chromium.launch({
    timeout: 180000,
    args: ["--use-gl=swiftshader", "--enable-unsafe-swiftshader",
           "--autoplay-policy=no-user-gesture-required",
           "--mute-audio", "--disable-audio-output", "--disable-dev-shm-usage"]
  });
}

export async function страница(b, э) {
  const pg = await b.newPage({ viewport: э.vp, deviceScaleFactor: э.dpr,
                               isMobile: э.mob, hasTouch: э.mob });
  pg.setDefaultTimeout(180000);
  const беды = [];
  pg.on("pageerror", (e) => беды.push("JS: " + e.message.slice(0, 200)));
  pg.on("console", (m) => {
    const t = m.text();
    if (m.type() === "error" && !/api\.php|501|favicon/.test(t)) беды.push("КОНС: " + t.slice(0, 200));
  });
  pg.on("crash", () => беды.push("СТРАНИЦА УПАЛА"));
  await pg.goto(АДРЕС, { waitUntil: "domcontentloaded", timeout: 180000 });
  /* Ждём по факту: RC_FLIGHT появился */
  await pg.waitForFunction(() => !!window.RC_FLIGHT, null, { timeout: 180000, polling: 500 });
  await pg.waitForTimeout(9000);
  return { pg, беды };
}

export async function вИгру(pg) {
  await pg.evaluate(() => { try { if (window.RC_SOUND && window.RC_SOUND.on && window.RC_SOUND.toggle) window.RC_SOUND.toggle(); } catch (e) {} });
  await pg.evaluate(() => window.RC_FLIGHT.open());
  /* Ждём готовности мира: собран + есть что подбирать */
  await pg.waitForFunction(() => {
    const s = window.RC_FLIGHT._state();
    const p = window.RC_FLIGHT._pick();
    return s && s.открыт && s.собран && p && p.всего > 5;
  }, null, { timeout: 240000, polling: 1000 });
  await pg.waitForTimeout(4000);
  await pg.evaluate(() => {
    const b = document.querySelector(".rcf-brief-btns button[data-mode='manual']");
    if (b) b.click();
    const br = document.querySelector(".rcf-brief");
    if (br) br.classList.add("off");
  });
  await pg.waitForTimeout(1500);
  return true;
}
