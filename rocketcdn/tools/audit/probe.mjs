import { АДРЕС, ЭКРАНЫ, браузер, страница } from "./общее.mjs";
const b = await браузер();
for (const имя of ["телефон","узкий","четыре","ПК","широкий","лежачий"]) {
  const э = ЭКРАНЫ[имя];
  const { pg, беды } = await страница(b, э);
  const d = await pg.evaluate(() => {
    const ids = ["included","cases","reliability","faq","contact","epilogue"];
    const o = {};
    ids.forEach(i => { const e = document.getElementById(i); o[i] = e ? Math.round(e.getBoundingClientRect().top + scrollY) + "+" + Math.round(e.getBoundingClientRect().height) : null; });
    return { docH: document.documentElement.scrollHeight, vh: innerHeight, sec: o,
             cab: !!window.RC_INTERIOR, noCab: !!window.RC_NO_CABIN,
             st: window.RC_INTERIOR && window.RC_INTERIOR.state ? window.RC_INTERIOR.state() : null };
  });
  console.log(имя, JSON.stringify(d));
  if (беды.length) console.log("  беды:", беды.slice(0,5));
  await pg.close();
}
await b.close();
