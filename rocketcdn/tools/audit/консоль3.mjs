/* Есть ли в сцене вторая, трёхмерная консоль, и лезет ли она в проём */
import { ЭКРАНЫ, браузер, страница, вИгру, проём } from "./общее.mjs";
const b = await браузер();
for (const имя of process.argv.slice(2)) {
  const { pg } = await страница(b, ЭКРАНЫ[имя]);
  await вИгру(pg);
  await pg.waitForTimeout(8000);
  const w = await проём(pg);
  const d = await pg.evaluate(() => {
    const F = window.RC_FLIGHT;
    const c = F && F._cabin ? F._cabin() : null;
    return { есть: !!c, пульт3: c && c.пульт3, рама: c && c.рама,
             мешей: c && c.мешей, видимых: c && c.видимых, скрыто: c && c.скрыто,
             части: c && c.части, controls: F && F._controls ? (F._controls()||[]).length : "нет",
             кадрРубки: !!document.querySelector(".rcf-cabframe"),
             холстПриборов: !!document.querySelector(".rcf-instr") };
  });
  console.log(имя, "проём", JSON.stringify(w));
  console.log(имя, JSON.stringify(d, null, 1));
  await pg.close();
}
await b.close();
