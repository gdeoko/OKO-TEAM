/* Логотип бренда ВНЕ игры: шапка, первый экран, заявка, мини-апп. */
import { ЭКРАНЫ, браузер, страница } from "./общее.mjs";
import fs from "fs";
const O = "/home/user/OKO-TEAM/rocketcdn/tools/audit/out/";
const К = "/home/user/OKO-TEAM/rocketcdn/tools/audit/кадры/";
const СПИСОК = (process.env.RC_SCR || "телефон,ПК").split(",");

const мера = () => {
  const из = [];
  document.querySelectorAll("img").forEach((im) => {
    const s = getComputedStyle(im), r = im.getBoundingClientRect();
    const src = im.getAttribute("src") || "";
    if (!/logo|mark|rocketvpn/i.test(src)) return;
    const п = im.closest("a,div,span,header,section");
    из.push({ src: src, кто: (п && п.className || "").toString().slice(0, 40),
      disp: s.display, vis: s.visibility, op: s.opacity,
      r: [+r.left.toFixed(1), +r.top.toFixed(1), +r.width.toFixed(1), +r.height.toFixed(1)],
      nat: [im.naturalWidth, im.naturalHeight],
      аспектНатур: im.naturalHeight ? +(im.naturalWidth / im.naturalHeight).toFixed(4) : null,
      аспектЭкран: r.height ? +(r.width / r.height).toFixed(4) : null,
      fit: s.objectFit, cssW: s.width, cssH: s.height, clip: s.clipPath,
      overflowРодителя: п ? getComputedStyle(п).overflow : null,
      родительR: п ? (() => { const q = п.getBoundingClientRect();
        return [+q.left.toFixed(1), +q.top.toFixed(1), +q.width.toFixed(1), +q.height.toFixed(1)]; })() : null,
      загружен: im.complete && im.naturalWidth > 0 });
  });
  return из;
};

const b = await браузер();
for (const имя of СПИСОК) {
  const э = ЭКРАНЫ[имя];
  const { pg, беды } = await страница(b, э);
  const шапка = await pg.evaluate(мера);
  console.log("### САЙТ " + имя + " (верх страницы)");
  console.log(JSON.stringify(шапка, null, 1));
  /* до заявки шагами прокрутки */
  await pg.evaluate(() => { const c = document.getElementById("contact"); if (c) c.scrollIntoView({ block: "center" }); });
  await pg.waitForTimeout(4000);
  const узаявки = await pg.evaluate(мера);
  console.log("### САЙТ " + имя + " (у заявки)");
  console.log(JSON.stringify(узаявки, null, 1));
  fs.writeFileSync(O + "сайт-лого-" + имя + ".json", JSON.stringify({ шапка, узаявки, беды: беды.slice(0,5) }, null, 1));
  try { const cdp = await pg.context().newCDPSession(pg);
    const h = шапка[0];
    if (h) { const [x,y,w2,h2] = h.r;
      const r = await cdp.send("Page.captureScreenshot", { format:"png",
        clip:{ x:Math.max(0,x-16), y:Math.max(0,y-16), width:w2+32, height:h2+32, scale:4 } });
      fs.writeFileSync(К + "сайт-шапка-" + имя + ".png", Buffer.from(r.data,"base64")); }
  } catch(e) { console.log("кадр шапки не вышел", e.message.slice(0,60)); }
  await pg.close();
}
/* мини-приложение */
for (const имя of ["телефон"]) {
  const э = ЭКРАНЫ[имя];
  const pg = await b.newPage({ viewport: э.vp, deviceScaleFactor: э.dpr, isMobile: э.mob, hasTouch: э.mob });
  await pg.goto("http://127.0.0.1:8123/app.html", { waitUntil: "domcontentloaded", timeout: 120000 });
  await pg.waitForTimeout(9000);
  const д = await pg.evaluate(мера);
  console.log("### APP.HTML " + имя);
  console.log(JSON.stringify(д, null, 1));
  fs.writeFileSync(O + "app-лого-" + имя + ".json", JSON.stringify(д, null, 1));
  try { const cdp = await pg.context().newCDPSession(pg);
    const h = д.find(x=>x.disp!=="none");
    if (h) { const [x,y,w2,h2] = h.r;
      const r = await cdp.send("Page.captureScreenshot", { format:"png",
        clip:{ x:Math.max(0,x-16), y:Math.max(0,y-16), width:w2+32, height:h2+32, scale:4 } });
      fs.writeFileSync(К + "app-лого-" + имя + ".png", Buffer.from(r.data,"base64")); }
  } catch(e) { console.log("кадр app не вышел", e.message.slice(0,60)); }
  await pg.close();
}
await b.close();
