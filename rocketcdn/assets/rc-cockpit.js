/* ═══════════════════════════════════════════════════════════
   Rocket CDN · кабина: одна и та же на сайте и в игре

   Клиент сформулировал требование прямо: «когда мы заходим в
   ракету, мы уже должны видеть ту панель управления, которая
   будет в игре; на этой же панели экран, к которому приближаемся
   и от которого отдаляемся; отдалились - и вот эта рамка из
   панели и космос вдалеке, и уже здесь голограммой появляется
   кнопка старта игры. Это всё бесшовно, это та же самая ракета».

   Раньше на сайте была своя панель (снимок пульта), а в игре -
   своя рамка кабины, и на стыке кадр подменялся: человек видел
   два разных корабля. Здесь этой подмены нет. Слой берёт ровно
   тот же файл, что показывает игра (assets/gen/cockpit-*.webp,
   портретная и ландшафтная версии), и держит его в кадре весь
   финал: салон - пульт - отлёт. Нажатие «Начать полёт» ничего не
   переключает визуально: рамка на экране уже стоит, дальше её
   просто ведёт игра.

   Слой ничего не перехватывает: он прозрачен для мыши и пальца,
   а окно кабины публикует в переменных (--cab-*), чтобы текст,
   форма и финальный титр вставали внутрь остекления, а не за
   его переплётом.
   ═══════════════════════════════════════════════════════════ */
(function (g) {
"use strict";

var doc = document, root = doc.documentElement;
var reduced = false;
try { reduced = matchMedia("(prefers-reduced-motion: reduce)").matches; } catch (e) {}

var layer = null, img = null, raf = null;
var k = 0, goal = 0, pub = -1, srcNow = "";

/* Окно остекления в долях кадра. Числа сняты с самих файлов:
   у портретной кабины переплёт шире, у ландшафтной стойки уходят
   к самым краям. Внутрь этих границ садится весь текст финала. */
var WIN_TALL = { x0: 0.15, x1: 0.85, y0: 0.13, y1: 0.78 };
var WIN_WIDE = { x0: 0.08, x1: 0.92, y0: 0.10, y1: 0.74 };

/* Экран центральной панели: место, где живёт анкета, а после
   отъезда - надпись старта. Тоже сняты с картинок. */
var SCR_TALL = { x: 0.5, y: 0.845, w: 0.17, h: 0.055 };
var SCR_WIDE = { x: 0.5, y: 0.845, w: 0.10, h: 0.075 };

function tall() { return innerHeight > innerWidth; }

function build() {
  if (layer) return;
  layer = doc.createElement("div");
  layer.className = "rc-cockpit";
  layer.setAttribute("aria-hidden", "true");
  /* Блик стекла и обод остекления рисуем сами: на картинке их нет,
     а без них космос за окном выглядит вырезанным по контуру, а не
     увиденным сквозь стекло */
  /* Порядок слоёв: за стеклом глубина космоса, поверх неё сама
     кабина, сверху блик стекла. Космос рисует холст звёзд, но в
     финале одних точек мало - за окном должна читаться даль, а не
     чёрный прямоугольник, поэтому под кабиной лежит своя дымка. */
  layer.innerHTML = '<i class="cab-void"></i><img class="cab-img" alt="" decoding="async">' +
                    '<i class="cab-beam"></i><i class="cab-glass"></i>';
  doc.body.appendChild(layer);
  img = layer.querySelector(".cab-img");
  src();
}

function src() {
  if (!img) return;
  var want = tall() ? "assets/gen/cockpit-tall.webp" : "assets/gen/cockpit-wide.webp";
  if (want !== srcNow) { srcNow = want; img.setAttribute("src", want); }
  var w = tall() ? WIN_TALL : WIN_WIDE, s = tall() ? SCR_TALL : SCR_WIDE;
  var st = root.style;
  /* Границы остекления отдаём в проценты окна: вёрстка ставит по ним
     свои отступы и не заезжает под переплёт кабины */
  st.setProperty("--cab-x0", (w.x0 * 100).toFixed(2) + "%");
  st.setProperty("--cab-x1", (w.x1 * 100).toFixed(2) + "%");
  st.setProperty("--cab-y0", (w.y0 * 100).toFixed(2) + "%");
  st.setProperty("--cab-y1", (w.y1 * 100).toFixed(2) + "%");
  st.setProperty("--cab-win-w", ((w.x1 - w.x0) * 100).toFixed(2) + "%");
  st.setProperty("--cab-win-h", ((w.y1 - w.y0) * 100).toFixed(2) + "%");
  st.setProperty("--cab-scr-x", (s.x * 100).toFixed(2) + "%");
  st.setProperty("--cab-scr-y", (s.y * 100).toFixed(2) + "%");
  st.setProperty("--cab-scr-w", (s.w * 100).toFixed(2) + "%");
  st.setProperty("--cab-scr-h", (s.h * 100).toFixed(2) + "%");
}

/* Сколько кабины в кадре сейчас. Это не выключатель, а наезд:
   войдя в салон, мы видим её вдали и вполсилы, у пульта она
   занимает кадр целиком, в отлёте остаётся стоять - именно её
   рамку человек унесёт с собой в игру. */
function want() {
  if (root.classList.contains("rc-flying")) return 0;   /* в игре кабина своя */
  if (root.getAttribute("data-degrade") === "3") return 0;
  var sc = g.RC_SCENE;
  var a = sc && sc.act, kk = sc ? (sc.k || 0) : 0;
  if (a === "cabin")   return 0.30 + kk * 0.16;
  if (a === "manual")  return 0.46 + kk * 0.22;
  if (a === "console") return 0.68 + kk * 0.32;
  if (a === "egress")  return 1;
  return 0;
}

function frame() {
  raf = requestAnimationFrame(frame);
  if (doc.hidden) return;
  goal = want();
  if (goal <= 0 && k < 0.002) {
    if (pub !== 0) { pub = 0; root.style.setProperty("--cab-k", "0"); root.classList.remove("rc-cab-on"); }
    return;
  }
  build();
  k += (goal - k) * 0.12;
  if (Math.abs(goal - k) < 0.002) k = goal;
  var r = Math.round(k * 100) / 100;
  if (r === pub) return;
  pub = r;
  root.style.setProperty("--cab-k", String(r));
  /* Порог, после которого вёрстка считает себя «внутри кабины» и
     садится в остекление: раньше половины кабина ещё далеко */
  root.classList.toggle("rc-cab-on", r > 0.45);
}

function boot() {
  if (reduced || root.classList.contains("rc-reduced")) return;
  if (root.getAttribute("data-degrade") === "3") return;
  src();
  if (!raf) raf = requestAnimationFrame(frame);
}

addEventListener("resize", function () { src(); }, { passive: true });
addEventListener("orientationchange", function () { setTimeout(src, 260); }, { passive: true });

if (doc.readyState === "loading") doc.addEventListener("DOMContentLoaded", boot);
else boot();

g.RC_COCKPIT = {
  state: function () { return { доля: +k.toFixed(2), есть: !!layer, файл: srcNow }; }
};

})(window);
