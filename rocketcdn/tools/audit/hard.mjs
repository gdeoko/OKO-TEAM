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
    timeout: 600000,
    args: ["--use-gl=swiftshader", "--enable-unsafe-swiftshader",
           "--autoplay-policy=no-user-gesture-required",
           "--mute-audio", "--disable-dev-shm-usage"]
  });
}

export async function страница(b, э) {
  const pg = await b.newPage({ viewport: э.vp, deviceScaleFactor: э.dpr,
                               isMobile: э.mob, hasTouch: э.mob });
  pg.setDefaultTimeout(600000);
  const беды = [];
  pg.on("pageerror", (e) => беды.push("JS: " + e.message.slice(0, 200)));
  pg.on("console", (m) => {
    const t = m.text();
    if (m.type() === "error" && !/api\.php|501|favicon/.test(t)) беды.push("КОНС: " + t.slice(0, 200));
  });
  pg.on("crash", () => беды.push("СТРАНИЦА УПАЛА"));
  await pg.goto(АДРЕС, { waitUntil: "domcontentloaded", timeout: 600000 });
  /* Ждём по факту: RC_FLIGHT появился */
  await pg.waitForFunction(() => !!window.RC_FLIGHT, null, { timeout: 600000, polling: 500 });
  await pg.waitForTimeout(9000);
  return { pg, беды };
}

export async function вИгру(pg) {
  await pg.evaluate(() => { try { if (window.RC_SOUND && window.RC_SOUND.on && window.RC_SOUND.toggle) window.RC_SOUND.toggle(); } catch (e) {} });
  await pg.evaluate(() => { try { window.RC_FLIGHT.open(); } catch (e) { console.error("open() упал: " + e.message); } });
  /* Ждём готовности, но не молча: каждые 15 секунд печатаем, чего не хватает */
  for (let i = 0; i < 60; i++) {
    const d = await pg.evaluate(() => {
      const s = window.RC_FLIGHT.state();
      const p = window.RC_FLIGHT._pick();
      return { открыт: s.открыт, собран: s.собран, сцена: s.сцена, салон: s.салон,
               pick: p ? p.всего : null, three: !!window.THREE, cabin: !!window.RC_CABIN,
               gl: !!window.RC_GL, want3d: window.RC_GL ? !!window.RC_GL.want3d : null,
               deck: !!window.RC_DECK, panel: !!window.RC_PANEL, holo: !!window.RC_HOLO };
    });
    if (d.открыт && d.собран && d.pick > 5) { console.log("готов на шаге " + i + ": " + JSON.stringify(d)); break; }
    if (i % 4 === 0) console.log("жду игру, шаг " + i + ": " + JSON.stringify(d));
    if (i === 8 && !d.открыт) await pg.evaluate(() => { try { window.RC_FLIGHT.open(); } catch (e) {} });
    await pg.waitForTimeout(15000);
  }
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
