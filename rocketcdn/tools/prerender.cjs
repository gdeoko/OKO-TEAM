/* ═══════════════════════════════════════════════════════════
   Rocket CDN - засев контента в разметку
   ───────────────────────────────────────────────────────────
   Продукты, преимущества, сценарии и вопросы живут в словаре и
   попадают на страницу только через JS. Google это исполняет,
   Яндекс - заметно хуже: на приёмке оказалось, что 72% текста
   страницы поисковик увидеть не может.

   Скрипт кладёт русский текст этих блоков прямо в index.html, в
   те же контейнеры. При загрузке страницы JS перерисует их
   полностью - разметка здесь нужна поисковику и тому, у кого JS
   не поднялся вовсе.

   Запуск после правки словаря:  node tools/prerender.cjs
   ═══════════════════════════════════════════════════════════ */
"use strict";

var fs = require("fs");
var path = require("path");

var ROOT = path.join(__dirname, "..");
var HTML = path.join(ROOT, "index.html");

global.window = {};
require(path.join(ROOT, "assets", "rc-i18n.js"));
var B = global.window.RC_BLOCKS.ru;

function esc(s) {
  return String(s == null ? "" : s).replace(/[&<>"]/g, function (c) {
    return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c];
  });
}

/* Разметка нарочно простая: у неё одна задача - донести текст до
   поисковика. Живой вид карточкам придаёт rc-app.js, он же ставит
   иконки и раскладку. */
function cards(list, cls) {
  return list.map(function (x) {
    var li = x.li && x.li.length
      ? "<ul>" + x.li.map(function (v) { return "<li>" + esc(v) + "</li>"; }).join("") + "</ul>"
      : "";
    return '<div class="' + cls + '"><h3>' + esc(x.h) + "</h3><p>" + esc(x.p) + "</p>" + li + "</div>";
  }).join("");
}

function faq(list) {
  return list.map(function (x, i) {
    return '<div class="faq-i"><button class="faq-q" aria-expanded="false" ' +
      'aria-controls="faqA' + i + '" id="faqQ' + i + '" data-faq="' + i + '">' +
      "<span>" + esc(x.q) + "</span><i></i></button>" +
      '<div class="faq-a" id="faqA' + i + '" role="region" aria-labelledby="faqQ' + i +
      '" inert><p>' + esc(x.a) + "</p></div></div>";
  }).join("");
}

var SEED = {
  gridProducts: cards(B.products, "card"),
  gridAdv: cards(B.advantages, "card"),
  gridCases: cards(B.cases, "case-card"),
  faqList: faq(B.faq)
};

var html = fs.readFileSync(HTML, "utf8");
var done = 0;

Object.keys(SEED).forEach(function (id) {
  /* Ищем контейнер по идентификатору и заменяем ровно его нутро -
     что бы там ни лежало от прошлого запуска */
  var re = new RegExp('(<div class="[^"]*" id="' + id + '">)([\\s\\S]*?)(</div>\\n)', "");
  var m = html.match(new RegExp('<div class="[^"]*" id="' + id + '">'));
  if (!m) { console.log("контейнер не найден:", id); return; }

  var start = html.indexOf(m[0]);
  var open = start + m[0].length;
  /* Считаем вложенность вручную: внутри уже могут быть свои div */
  var depth = 1, i = open;
  while (i < html.length && depth > 0) {
    var nx = html.indexOf("<div", i);
    var cl = html.indexOf("</div>", i);
    if (cl < 0) break;
    if (nx >= 0 && nx < cl) { depth++; i = nx + 4; }
    else { depth--; i = cl + 6; }
  }
  var close = i - 6;
  html = html.slice(0, open) + SEED[id] + html.slice(close);
  done++;
});

fs.writeFileSync(HTML, html);
console.log("засеяно контейнеров:", done,
  "| символов текста:", Object.keys(SEED).reduce(function (a, k) {
    return a + SEED[k].replace(/<[^>]+>/g, "").length;
  }, 0));
