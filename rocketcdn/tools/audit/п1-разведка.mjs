import { ЭКРАНЫ, браузер, страница, вИгру, проём } from "./общее.mjs";

const b = await браузер();
const { pg, беды } = await страница(b, ЭКРАНЫ["ПК"]);
pg.on("close",()=>console.log("!!! СТРАНИЦА ЗАКРЫЛАСЬ"));
pg.on("crash",()=>console.log("!!! КРАШ"));
b.on("disconnected",()=>console.log("!!! БРАУЗЕР ОТВАЛИЛСЯ"));
console.log("вошли:", await вИгру(pg));
await pg.waitForTimeout(2000);

async function гео(sel) {
  return pg.evaluate((s) => {
    const из = [];
    document.querySelectorAll(s).forEach(э => {
      const st = getComputedStyle(э);
      const r = э.getBoundingClientRect();
      из.push({ c: (э.className||"").toString().slice(0,40),
        vis: st.display!=="none" && st.visibility!=="hidden" && +st.opacity>=0.06,
        r:[Math.round(r.left),Math.round(r.top),Math.round(r.width),Math.round(r.height)],
        scroll:[э.scrollWidth, э.clientWidth, э.scrollHeight, э.clientHeight] });
    });
    return из;
  }, sel);
}

// открыть меню
await pg.evaluate(() => { const k=document.querySelector(".rcf-navkey"); if(k) k.click(); });
await pg.waitForTimeout(1800);
console.log("МЕНЮ:", JSON.stringify(await гео(".rcf-menu")));
console.log("кнопок nav:", (await гео(".rcf-menu .rcf-nav button")).length);
console.log("кнопок uni:", (await гео(".rcf-menu .rcf-uni button")).length);
await pg.screenshot({path:"tools/audit/кадры/р-меню-пк.jpeg", type:"jpeg", quality:82});

await pg.evaluate(() => { const k=document.querySelector(".rcf-navkey"); if(k) k.click(); });
await pg.waitForTimeout(1000);
// справка
await pg.evaluate(() => { const k=document.querySelector(".rcf-help-key"); if(k) k.click(); });
await pg.waitForTimeout(1800);
console.log("СПРАВКА:", JSON.stringify(await гео(".rcf-help, .rcf-help-in")));
await pg.screenshot({path:"tools/audit/кадры/р-справка-пк.jpeg", type:"jpeg", quality:82});
await pg.evaluate(() => { const k=document.querySelector(".rcf-help-x"); if(k) k.click(); });
await pg.waitForTimeout(800);

// досье
const имя = await pg.evaluate(() => window.RC_FLIGHT._dos("ЮПИТЕР"));
console.log("досье:", имя);
await pg.waitForTimeout(1800);
console.log("ДОСЬЕ:", JSON.stringify(await гео(".rcf-dos, .rcf-dos-in")));
await pg.screenshot({path:"tools/audit/кадры/р-досье-пк.jpeg", type:"jpeg", quality:82});

// список тел доступных
console.log("тела:", JSON.stringify((await pg.evaluate(()=>window.RC_FLIGHT._pick())).тела.map(t=>t.имя)));
console.log("беды:", JSON.stringify(беды.slice(0,10)));
await b.close();
