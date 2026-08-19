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
var k = 0, goal = 0, pub = -1, conPub = -1, srcNow = "";

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
  var sc = g.RC_SCENE;
  var a = sc && sc.act;
  if (a === "cabin" || a === "manual") return 1;        /* стоит в своём углу */
  if (a === "console" || a === "egress") return 1;
  return 0;
}

/* Доля «мы за пультом»: её ведёт камера рубки (--int-con). До конца
   оборота она ноль, дальше растёт вместе с подъездом камеры. */
function conNow() {
  var cs = getComputedStyle(root);
  var v = parseFloat(cs.getPropertyValue("--int-con"));
  if (isNaN(v)) v = 0;
  var out = parseFloat(cs.getPropertyValue("--int-out"));
  if (isNaN(out)) out = 0;
  /* В отлёте камера отходит, но кадр остаётся кабиной: держим
     единицу, иначе панель поехала бы обратно в угол на финале */
  return out > 0 ? 1 : v;
}

/* Азимут пульта в рубке. Ноль - направление входа, поэтому панель
   уводим вбок, в её собственный угол. Тем же числом довёрнут конец
   оборота в rc-interior, так что к концу круга камера смотрит
   ровно на панель, а не мимо неё. */
var TH_CON = -0.62;
function thCon() {
  var I = g.RC_INTERIOR;
  return (I && I.thCon) ? I.thCon() : TH_CON;
}

/* Кладём панель туда, где она стоит в комнате. Пока идёт оборот,
   двигается камера, а не панель: экранную точку берём у самой
   рубки (project), поэтому пульт не может «разъехаться» со стенами. */
function place(conK) {
  var stl = root.style;
  var I = g.RC_INTERIOR;
  var tx = 0, rot = 0, vis = 1;

  if (I && I.project && I.ready && I.ready()) {
    var pr = I.project(thCon());
    var off = pr.x - 0.5;                        /* отклонение от середины */
    tx = off * (1 - conK) * 120;                 /* в процентах ширины слоя */
    rot = -off * (1 - conK) * 52;                /* стоит к нам вполоборота */
    vis = pr.v;
  } else {
    /* Рубки нет (упрощённый режим): просто держим панель сбоку */
    tx = (1 - conK) * 34;
    rot = -(1 - conK) * 26;
  }

  stl.setProperty("--cab-tx", tx.toFixed(2) + "%");
  stl.setProperty("--cab-rot", rot.toFixed(2) + "deg");
  /* В салоне панель дальше и мельче, на подъезде вырастает в кадр */
  stl.setProperty("--cab-sc", (0.52 + conK * 0.62).toFixed(3));
  /* Обрезка сверху: в салоне видна только нижняя часть картинки -
     сам пульт с экранами. Остекление и потолочные балки приходят,
     когда мы уже сели за него; иначе в углу висела бы рамка. */
  stl.setProperty("--cab-top", (62 - conK * 62).toFixed(1) + "%");
  return vis;
}

/* ── Страховка сценария ──────────────────────────────────────
   Худшее, что может случиться на телефоне: корабль подошёл вплотную,
   занял собой весь кадр, а внутрь мы так и не вошли - рубка не
   поднялась (не хватило слота, сработала защита от лагов, отказал
   объёмный слой). Тогда огромный корпус просто висит поверх текста
   и закрывает разделы, которые человек пытается читать. Владелец
   увидел ровно это.

   Поэтому здесь стоит сторож: если акт уже внутренний, а внутри мы
   не оказались, корабль обязан уйти из кадра. Сценарий при этом не
   ломается - он честно упрощается: человек листает обычную
   страницу, а не воюет с картинкой поверх неё. */
function watchdog() {
  var sc = g.RC_SCENE;
  var a = sc && sc.act;
  var innerAct = (a === "cabin" || a === "manual" || a === "console" || a === "egress");
  var inside = root.classList.contains("rc-inside");
  var stuck = innerAct && !inside;
  if (stuck !== root.classList.contains("rc-ship-off")) {
    root.classList.toggle("rc-ship-off", stuck);
    /* Корабль не только прячем, но и останавливаем: невидимая сцена,
       которая продолжает считать кадры, - это ровно та нагрузка, из-за
       которой защита от лагов и погасила рубку. */
    if (stuck && g.RC_ROCKET && g.RC_ROCKET.stop) {
      try { g.RC_ROCKET.stop(); } catch (e) {}
    } else if (!stuck && g.RC_ROCKET && g.RC_ROCKET.start &&
               !root.classList.contains("rc-rocket-parked")) {
      try { g.RC_ROCKET.start(); } catch (e2) {}
    }
  }
}

function frame() {
  raf = requestAnimationFrame(frame);
  if (doc.hidden) return;
  watchdog();
  goal = want();
  if (goal <= 0 && k < 0.002) {
    if (pub !== 0) { pub = 0; root.style.setProperty("--cab-k", "0"); root.classList.remove("rc-cab-on"); }
    return;
  }
  build();
  var conK = conNow();
  var vis = place(conK);
  /* Прозрачность складывается из двух вещей: видна ли панель в
     кадре вообще (vis) и насколько мы к ней подъехали. В салоне она
     приглушена - это дальний предмет обстановки, а не интерфейс
     поверх сцены. */
  var target = goal * (0.34 + conK * 0.66) * (vis * 0.85 + 0.15);
  k += (target - k) * 0.12;
  if (Math.abs(target - k) < 0.002) k = target;
  var r = Math.round(k * 100) / 100;
  var cr = Math.round(conK * 100) / 100;
  if (r === pub && cr === conPub) return;
  pub = r; conPub = cr;
  root.style.setProperty("--cab-k", String(r));
  /* Класс «мы за пультом» ставим по подъезду, а не по прозрачности:
     содержимое садится в остекление только когда кабина уже стала
     кадром, а не пока она стоит в углу комнаты */
  root.classList.toggle("rc-cab-on", cr > 0.5);
}

function boot() {
  /* Просьба меньше движения - единственная причина не поднимать
     кабину вовсе. Ступень деградации такой причиной больше не
     является: на телефоне владельца она доходила до третьей, слой не
     строился, и финал фильма превращался в пустой экран. */
  if (reduced || root.classList.contains("rc-reduced")) return;
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
