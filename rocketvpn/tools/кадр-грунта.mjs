/* Снимок грунта Луны на заданной прокрутке. Нужен для сверки «до и
   после» при перепаковке фотоскановых карт: вес карты можно уронить
   вдвое, а поверхность в кадре обязана остаться той же. */
import { браузер, открыть, ПК } from "./checks/общее.mjs";
const куда = process.argv[2] || "/tmp/грунт.png";
const b = await браузер();
const { pg } = await открыть(b, ПК, {});
await pg.waitForFunction(() => window.RV_WORLD && !RV_WORLD.вступлениеИдёт(), null, { timeout: 60000 });
await pg.evaluate(() => { scrollTo(0, innerHeight * 1.4); });
await pg.waitForTimeout(6000);
await pg.screenshot({ path: куда });
console.log("снято", куда);
await b.close();
