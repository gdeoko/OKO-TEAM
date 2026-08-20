/* RocketCDN · сборка блоков, которые зависят от языка и данных сети.
   Слушает событие rc:lang и перерисовывается вместе с остальным сайтом. */
(function () {
"use strict";

var $  = function (s, r) { return (r || document).querySelector(s); };
var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };

function esc(s) {
  return String(s == null ? "" : s).replace(/[&<>"]/g, function (c) {
    return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c];
  });
}

function fill(t, blocks) {
  var svg = window.RC_ICO, GEO = window.RC_GEO;
  var lang = document.documentElement.lang === "en" ? "en" : "ru";

  /* Иконки в статичной разметке */
  $$("[data-ico]").forEach(function (el) {
    var name = el.getAttribute("data-ico");
    /* Проверяем именно первого ребёнка, а не «есть ли где-то внутри
       svg»: в строке контакта теперь живёт кнопка копирования со
       своим знаком, и по старой проверке иконка самой строки не
       рисовалась вовсе - у половины пунктов её просто не было. */
    var first = el.firstElementChild;
    if (first && first.tagName.toLowerCase() === "svg") return;
    el.insertAdjacentHTML("afterbegin", svg(name));
  });

  /* Строчки-галочки в герое */
  var hm = $("#heroMarks");
  if (hm) hm.innerHTML = ["hero.mark1", "hero.mark2", "hero.mark3"].map(function (k) {
    return '<span class="hero-mark">' + svg("check") + "<span>" + esc(t(k)) + "</span></span>";
  }).join("");

  var wm = $("#whatMarks");
  if (wm) wm.innerHTML = ["what.b1", "what.b2", "what.b3"].map(function (k) {
    return '<span class="hero-mark">' + svg("bolt") + "<span>" + esc(t(k)) + "</span></span>";
  }).join("");

  /* Собственные дата-центры */
  /* Снимки залов лежат рядом с реестром: первый ЦОД - Москва,
     второй - Алматы, третий - Прага. Порядок совпадает с GEO.DC,
     если он изменится, картинку подставит запасной вариант. */
  var DC_SHOT = ["dc-moscow", "dc-almaty", "dc-prague"];
  var dc = $("#dcGrid");
  if (dc && GEO) dc.innerHTML = GEO.DC.map(function (d, i) {
    /* Снимок зала записываем в data-атрибут: подставим его в
       переменную, только когда секция подойдёт к экрану - двести
       килобайт фотографий не должны ехать раньше первого экрана */
    var shot = DC_SHOT[i] ? ' data-shot="/assets/gen/' + DC_SHOT[i] + '.webp"' : "";
    return '<article class="dc float-3d rv rv-d' + (i + 1) + '"' + shot + '>' +
      '<div class="lbl">' + esc(t("infra.dc")) + "</div>" +
      "<h4>" + esc(d.name[lang] || d.name.ru) + "</h4>" +
      '<p style="color:var(--tx-3);font-size:12.5px;margin-bottom:10px">' + esc(d.cc[lang] || d.cc.ru) + "</p>" +
      "<p>" + esc(t("dc" + (i + 1) + "p")) + "</p></article>";
  }).join("");

  /* Ленивая подстановка снимков ЦОД: за полтора экрана до секции */
  if (dc && "IntersectionObserver" in window) {
    var dcIo = new IntersectionObserver(function (es) {
      es.forEach(function (e) {
        if (!e.isIntersecting) return;
        [].forEach.call(dc.querySelectorAll("[data-shot]"), function (el) {
          el.style.setProperty("--shot", "url(" + el.getAttribute("data-shot") + ")");
          el.removeAttribute("data-shot");
        });
        dcIo.disconnect();
      });
    }, { rootMargin: "1400px 0px" });
    dcIo.observe(dc);
  } else if (dc) {
    [].forEach.call(dc.querySelectorAll("[data-shot]"), function (el) {
      el.style.setProperty("--shot", "url(" + el.getAttribute("data-shot") + ")");
    });
  }

  /* Путь запроса: горизонтальный маршрут с отсечками времени */
  var how = $("#howGrid");
  var howMs = ["0", "3", "9", "18", "31", "40"];
  if (how) how.innerHTML = [1, 2, 3, 4, 5, 6].map(function (n) {
    return '<article class="card case step rv rv-d' + n + '">' +
      '<span class="num">' + n + "</span>" +
      '<span class="step-ms"><b>' + howMs[n - 1] + "</b> " + esc(t("how.ms")) + "</span>" +
      "<h3>" + esc(t("how.s" + n + "h")) + "</h3>" +
      "<p>" + esc(t("how.s" + n + "p")) + "</p>" +
      '<i class="step-line" aria-hidden="true"></i></article>';
  }).join("");

  /* Надёжность */
  var rel = $("#relGrid");
  var relIco = ["check", "support", "shield", "load"];
  if (rel) rel.innerHTML = [1, 2, 3, 4].map(function (n) {
    return '<article class="card rv rv-d' + n + '">' +
      '<div class="card-ico">' + svg(relIco[n - 1]) + "</div>" +
      "<h3>" + esc(t("rel." + n + "h")) + "</h3>" +
      "<p>" + esc(t("rel." + n + "p")) + "</p></article>";
  }).join("");

  /* Состав подключения */
  var inc = $("#incGrid");
  if (inc) inc.innerHTML = [1,2,3,4,5,6,7,8,9].map(function (n) {
    return '<div class="inc-item">' + svg("check") + "<span>" + esc(t("inc." + n)) + "</span></div>";
  }).join("");

  var y = $("#year");
  if (y) y.textContent = new Date().getFullYear();
}

document.addEventListener("rc:lang", function (e) {
  /* Без словаря собирать блоки нельзя: заголовки и описания вышли бы
     пустыми, и человек увидел бы ряд пустых карточек. Лучше подождать:
     как только словарь доедет, rc-app позовёт нас ещё раз. */
  if (!window.RC_I18N) return;
  fill(e.detail.t, e.detail.blocks);
});
})();
