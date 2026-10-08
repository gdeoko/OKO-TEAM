/* Формы: доходит ли отправка и с какими полями. Перехватываем запрос,
   ничего никуда реально не шлём. */
import { браузер, страница, ЭКРАНЫ } from "./общее.mjs";
const b = await браузер();
const { pg } = await страница(b, ЭКРАНЫ["ПК"]);
const ушло = [];
await pg.route("**/api.php*", async (route) => {
  const r = route.request();
  ушло.push({ url: r.url().slice(-40), метод: r.method(), тело: (r.postData() || "").slice(0, 300) });
  await route.fulfill({ status: 200, contentType: "application/json", body: '{"ok":true}' });
});
async function заполни(форма, поля) {
  return pg.evaluate(({ ф, п }) => {
    const el = document.querySelector(ф);
    if (!el) return "нет формы " + ф;
    for (const [сел, зн] of Object.entries(п)) {
      const e = el.querySelector(сел);
      if (!e) return "нет поля " + сел + " в " + ф;
      if (e.type === "checkbox") e.checked = true;
      else { e.value = зн; e.dispatchEvent(new Event("input", { bubbles: true })); }
    }
    const кн = el.querySelector('button[type="submit"], button:not([type])');
    if (!кн) return "нет кнопки отправки в " + ф;
    кн.click();
    return "ок";
  }, { ф: форма, п: поля });
}
console.log("заявка:", await заполни("#leadForm", { "#lfName": "Проверка", "#lfContact": "test@example.com", "#lfTask": "тест", ".consent input": "1" }));
await pg.waitForTimeout(2500);
console.log("звонок:", await заполни("#cbForm", { "#cbName": "Проверка", "#cbPhone": "+70000000000", ".consent input": "1" }));
await pg.waitForTimeout(2500);
console.log("ушло запросов:", ушло.length);
ушло.forEach((з) => console.log("  ", JSON.stringify(з)));
const видно = await pg.evaluate(() => {
  const н = [...document.querySelectorAll(".note, .form-note, [role='status']")].map((e) => (e.textContent || "").trim()).filter(Boolean);
  return н.slice(0, 4);
});
console.log("что показали человеку:", JSON.stringify(видно));
await b.close();
