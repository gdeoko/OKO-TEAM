import { ЭКРАНЫ, браузер, страница, вИгру } from "./общее.mjs";
const b = await браузер();
const э = ЭКРАНЫ["ПК"];
const { pg, беды } = await страница(b, э);
const ок = await вИгру(pg);
console.log("вошли:", ок);
await pg.waitForTimeout(4000);
const d = await pg.evaluate(() => {
  const w = document.querySelector(".rc-flight");
  const o = {
    классы: w ? w.className : null,
    RC_DECK: !!window.RC_DECK, RC_CAB_DECK: !!window.RC_CAB_DECK, RC_CAB_FLAT: !!window.RC_CAB_FLAT,
    RC_KEYS: !!window.RC_KEYS,
    вид: window.RC_DECK ? window.RC_DECK["какой"](innerWidth, innerHeight) : null,
    controls: window.RC_FLIGHT && window.RC_FLIGHT._controls ? window.RC_FLIGHT._controls() : "нет",
    instr: !!document.querySelector(".rcf-instr"),
    deckRect: (()=>{const e=document.querySelector(".rcf-deck"); if(!e)return null; const r=e.getBoundingClientRect(); return [r.left,r.top,r.width,r.height];})()
  };
  return o;
});
console.log(JSON.stringify(d, null, 1).slice(0, 3000));
console.log("беды:", беды.slice(0,6));
await pg.close(); await b.close();
