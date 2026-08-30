/* Проверка: сайт закрыт от поисковых систем.

   Проверяются ВСЕ уровни, а не один: заголовок ответа сервера, метка в
   разметке и robots.txt. Каждый по отдельности теряется при переносе
   или правке, поэтому терять их поодиночке нельзя молча. */
import { браузер, БАЗА, адрес, ПК, доложить } from "./общее.mjs";

const беды = [];
const b = await браузер();
const pg = await b.newPage({ viewport: ПК.vp });

const ответ = await pg.goto(адрес(), { waitUntil: "domcontentloaded", timeout: 60000 });
await pg.waitForTimeout(800);

/* Уровень 1: заголовок. Он действует и на то, у чего разметки нет. */
const заг = (ответ && ответ.headers()["x-robots-tag"]) || "";
if (!/noindex/i.test(заг)) {
  беды.push("нет заголовка X-Robots-Tag с noindex (получено: " + (заг || "пусто") + ")");
}

/* Уровень 2: метка в разметке. */
const метка = await pg.evaluate(() => {
  const m = document.querySelector('meta[name="robots"]');
  return m ? m.getAttribute("content") : null;
});
if (!метка || !/noindex/i.test(метка)) беды.push("нет метки robots noindex в разметке");
if (метка && !/nofollow/i.test(метка)) беды.push("метка robots без nofollow");

/* Уровень 3: robots.txt. */
const r = await pg.request.get(БАЗА + "/robots.txt");
const тело = r.ok() ? await r.text() : "";
if (!/Disallow:\s*\/\s*$/m.test(тело)) беды.push("robots.txt не запрещает весь подпуть");

/* Ссылок наружу с ключом быть не должно: ключ, уехавший в чужую
   историю посещений, перестаёт быть ключом. */
const утечка = await pg.evaluate(() => {
  const из = [];
  document.querySelectorAll("a[href]").forEach(a => {
    const h = a.getAttribute("href") || "";
    if (/[?&]k=/.test(h)) из.push(h.slice(0, 90));
  });
  return из;
});
if (утечка.length) беды.push("ключ утекает в ссылки: " + утечка.join(", "));

/* Ключ не должен оставаться в адресной строке: человек копирует адрес
   и делится им, не думая, что делится ключом. */
const вАдресе = await pg.evaluate(() => location.search);
if (/[?&]k=/.test(вАдресе)) беды.push("ключ остался в адресной строке: " + вАдресе);

await b.close();
доложить("тишина для поисковиков", беды);
