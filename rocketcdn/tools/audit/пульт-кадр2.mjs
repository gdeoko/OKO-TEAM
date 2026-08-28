/* Кадры плиты через CDP: Playwright-скриншот ждёт document.fonts.ready,
   а он в полёте не разрешается. Page.captureScreenshot ничего не ждёт. */
import { ЭКРАНЫ, браузер, страница, вИгру } from "./общее.mjs";
import fs from "node:fs";
const ВЫХ = "/home/user/OKO-TEAM/rocketcdn/tools/audit/out/pult";
fs.mkdirSync(ВЫХ, { recursive: true });
const b = await браузер();
for (const имя of process.argv.slice(2)) {
  const э = ЭКРАНЫ[имя];
  const { pg } = await страница(b, э);
  await вИгру(pg);
  await pg.waitForTimeout(9000);
  const cdp = await pg.context().newCDPSession(pg);
  const верх = Math.round(э.vp.height * 0.70);
  const кадр = await cdp.send("Page.captureScreenshot", {
    format: "png", fromSurface: true, captureBeyondViewport: false,
    clip: { x: 0, y: верх, width: э.vp.width, height: э.vp.height - верх, scale: 1 }
  });
  fs.writeFileSync(`${ВЫХ}/к-${имя}.png`, Buffer.from(кадр.data, "base64"));
  const весь = await cdp.send("Page.captureScreenshot", { format: "png", fromSurface: true });
  fs.writeFileSync(`${ВЫХ}/в-${имя}.png`, Buffer.from(весь.data, "base64"));
  console.log("снят", имя);
  await pg.close();
}
await b.close();
