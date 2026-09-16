import { ЭКРАНЫ, браузер, страница, вИгру } from "../общее.mjs";

const b = await браузер();
const { pg } = await страница(b, ЭКРАНЫ["ПК"]);
await вИгру(pg);
await pg.waitForTimeout(2500);
await pg.evaluate(() => { window.RC_FLIGHT._set(0.02); });
await pg.waitForTimeout(3500);
await pg.evaluate(() => { const b = document.querySelector('.rcf-stop-key'); if (b) b.click(); });
await pg.waitForTimeout(800);
await pg.evaluate(() => { localStorage.removeItem('rcdn.explored2'); });
await pg.reload();
await пере(pg);

async function пере(pg) {}
