/* Только кадры плиты: минимум работы, максимум картинок. */
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
  const верх = Math.round(э.vp.height * 0.72);
  await pg.screenshot({ path: `${ВЫХ}/к-${имя}.png`,
    clip: { x: 0, y: верх, width: э.vp.width, height: э.vp.height - верх }, timeout: 240000, animations: "allow" });
  console.log("снят", имя);
  await pg.close();
}
await b.close();
