/* ═══════════════════════════════════════════════════════════
   Rocket CDN · экран приборной панели

   Владелец описал этот эпизод дословно, и здесь он собран целиком:

   «мы зашли в корабль, экраны стоят привязанные к своим точкам...
    развернулись на 360, и перед нами без текста, без ничего
    появляется панель управления, только она немного дальше...
    приближаемся к ней, пока она не встанет в круг как в игре...
    и там уже как голограмма появляется внутри вот этой рамки, где
    в дальнейшем будет игра: сразу несколько вопросов, сверху кнопка
    перезвонить мне и кнопка отправить заявку. Нажимаем отправить
    заявку - голограмма глитчем меняется на анкету, перезвонить мне -
    на форму обратного звонка, вопрос - на ответ. Дальше скролл вниз,
    она глитчем исчезает, и глитчем появляется надпись старта игры.»

   Что было не так раньше. Вопросы и форма оставались обычными
   блоками страницы и выезжали снизу поверх кадра - изнутри салона
   снизу выехать нечему, мы стоим в комнате и смотрим по сторонам.

   Как устроено теперь. Экран - слой внутри кабины, поэтому он живёт
   ровно по той же геометрии: тот же наезд, тот же поворот, тот же
   масштаб. Отдельной анимации появления у него нет - он проявляется
   вместе с подъездом камеры (RC_INTERIOR.con) и гаснет вместе с
   отходом от пульта (RC_INTERIOR.back), уступая кадр надписи старта.

   Содержимое не дублируется: вопросы читаются из разметки раздела
   «Вопросы и ответы», а обе формы физически переезжают сюда со
   своих мест и возвращаются обратно, когда салон выключен. Из-за
   этого работает всё, что было: отправка, проверка полей, словарь,
   аналитика - формы те же самые, поменялось только место.
   ═══════════════════════════════════════════════════════════ */
(function (g) {
"use strict";

var doc = document, root = doc.documentElement;

var V = (g.RC_VAR && g.RC_VAR.set) || function (el, n, v) {
  if (el && el.style) el.style.setProperty(n, v);
};

var reduced = false;
try { reduced = matchMedia("(prefers-reduced-motion: reduce)").matches; } catch (e) {}

/* Сколько вопросов помещается на экран панели. Все восемь туда не
   войдут: остекление кабины уже кадра, а строка вопроса не имеет
   права переноситься втрое. Владелец просил «сразу несколько
   вопросов» - показываем те, что задают чаще, остальные остаются в
   разделе для тех, кто листает страницу без корабля. */
function qLimit() { return innerWidth < 760 ? 5 : 7; }

var layer = null;      /* .rc-desk - сам экран */
var body = null;       /* .dsk-body - сменное содержимое */
var slot = null;       /* .dsk-slot - место, куда переезжают формы */
var state = "menu";
var swapT = 0, glitchT = 0;
var raf = null, kPub = -1, onPub = -1;
var homeLead = null, homeCall = null;

function t(key, fallback) {
  try {
    var all = g.RC_I18N || {};
    var lang = root.getAttribute("lang") === "en" ? "en" : "ru";
    var d = all[lang] || {};
    if (d[key] != null) return d[key];
    if (all.ru && all.ru[key] != null) return all.ru[key];
  } catch (e) {}
  return fallback;
}

function snd(name) {
  try {
    var s = g.RC_SOUND;
    if (s && typeof s[name] === "function") s[name]();
  } catch (e) {}
}

/* ── Сборка ─────────────────────────────────────────────────── */
function build() {
  if (layer) return layer;

  /* Слой стоит сам по себе, а не внутри кабины, и причина простая:
     кабина лежит ПОД содержимым страницы (на ней титр финала должен
     читаться поверх переплёта), а по вопросам и кнопкам нужно
     попадать пальцем. Поэтому экран - отдельный слой выше всех, а
     постановку кадра он повторяет числами, которые отдаёт сама
     кабина: тот же сдвиг, поворот и масштаб. */
  layer = doc.createElement("div");
  layer.className = "rc-desk";
  layer.innerHTML =
    '<div class="dsk-win">' +
      '<div class="dsk-frame">' +
        '<i class="dsk-scan" aria-hidden="true"></i>' +
        '<i class="dsk-beam" aria-hidden="true"></i>' +
        '<div class="dsk-body"></div>' +
        '<div class="dsk-slot"></div>' +
      '</div>' +
    '</div>';
  doc.body.appendChild(layer);
  body = layer.querySelector(".dsk-body");
  slot = layer.querySelector(".dsk-slot");

  /* Экран ловит палец и курсор, хотя кабина вокруг него прозрачна
     для обоих: нажимать нужно по вопросам и кнопкам, а не по
     переплёту остекления */
  layer.addEventListener("click", onClick);
  return layer;
}

/* ── Смена содержимого глитчем ───────────────────────────────
   Голограмма не «переключается» и не выезжает: изображение на
   мгновение рвётся, и на её месте оказывается другое. Разрыв рисуют
   стили, отсюда идёт только момент подмены - ровно в середине
   разрыва, чтобы человек не увидел ни старого, ни нового кадра. */
function swap(next, fill) {
  if (swapT) return;
  var same = next === state;
  layer.classList.add("dsk-glitch");
  snd("uiClick");
  swapT = setTimeout(function () {
    swapT = 0;
    state = next;
    layer.setAttribute("data-state", next);
    try { fill(); } catch (e) {}
  }, 170);
  if (glitchT) clearTimeout(glitchT);
  glitchT = setTimeout(function () {
    glitchT = 0;
    layer.classList.remove("dsk-glitch");
  }, 420);
  return same;
}

/* ── Меню: вопросы и две кнопки ─────────────────────────────── */
function questions() {
  var list = doc.querySelectorAll("#faqList .faq-i");
  var out = [];
  for (var i = 0; i < list.length && out.length < qLimit(); i++) {
    var q = list[i].querySelector(".faq-q span");
    var a = list[i].querySelector(".faq-a");
    if (!q || !a) continue;
    out.push({ q: q.textContent, a: a.textContent.replace(/\s+/g, " ").trim() });
  }
  return out;
}

function esc(s) {
  return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

var qCache = [];

function fillMenu() {
  homeForms();
  qCache = questions();
  var h = '<div class="dsk-acts">' +
    '<button type="button" class="dsk-b dsk-b-call" data-go="call">' +
      esc(t("cta.callback", "Перезвоните мне")) + '</button>' +
    '<button type="button" class="dsk-b dsk-b-lead" data-go="lead">' +
      esc(t("ct.send", "Отправить заявку")) + '</button>' +
    '</div>' +
    '<div class="dsk-title">' + esc(t("faq.h", "Коротко о главном")) + '</div>' +
    '<ul class="dsk-qs">';
  for (var i = 0; i < qCache.length; i++) {
    h += '<li><button type="button" class="dsk-q" data-q="' + i + '">' +
      '<span>' + esc(qCache[i].q) + '</span></button></li>';
  }
  h += '</ul>';
  body.innerHTML = h;
  body.hidden = false;
  slot.hidden = true;
}

function fillAnswer(i) {
  var rec = qCache[i];
  if (!rec) { fillMenu(); return; }
  body.innerHTML =
    '<button type="button" class="dsk-back" data-go="menu">' +
      esc(t("ui.back", "Назад")) + '</button>' +
    '<div class="dsk-title">' + esc(rec.q) + '</div>' +
    '<div class="dsk-a">' + esc(rec.a) + '</div>';
  body.hidden = false;
  slot.hidden = true;
}

/* ── Высота раздела заявки закрепляется ──────────────────────
   Форма физически уезжает на экран панели, и раздел контактов на
   этот миг становится ниже на добрую тысячу пикселей. Страница
   укорачивается, браузер зажимает позицию прокрутки, и человека
   отбрасывает назад - прямо в акте пульта, который он в этот момент
   и смотрит. Приёмка ловила это раньше на перестройке формы.

   Поэтому перед первым переездом мы запоминаем высоту раздела и
   держим её, пока форма гостит на панели. Длина прокрутки не
   меняется - значит не меняются ни пороги сцены, ни положение
   камеры, ни то, что видит человек. */
var pinned = 0;
function pinHeight(on) {
  var c = doc.getElementById("contact");
  if (!c) return;
  if (on) {
    if (pinned) return;
    pinned = Math.round(c.getBoundingClientRect().height);
    c.style.minHeight = pinned + "px";
  } else if (pinned) {
    pinned = 0;
    c.style.minHeight = "";
  }
}

/* ── Формы: переезжают сюда со своих мест ────────────────────
   Копию делать нельзя: у форм есть проверка полей, отправка,
   словарь и аналитика, и всё это привязано к самим элементам.
   Поэтому мы их переносим, запомнив, откуда взяли. */
function moveForm(form) {
  if (!form) return;
  if (form.id === "leadForm" && !homeLead) {
    homeLead = { parent: form.parentNode, next: form.nextSibling };
  }
  if (form.id === "cbForm" && !homeCall) {
    homeCall = { parent: form.parentNode, next: form.nextSibling };
  }
  pinHeight(true);
  if (form.parentNode !== slot) slot.appendChild(form);
}

function homeForms(unpin) {
  var lead = doc.getElementById("leadForm");
  var call = doc.getElementById("cbForm");
  if (lead && homeLead && lead.parentNode === slot) {
    homeLead.parent.insertBefore(lead, homeLead.next);
  }
  if (call && homeCall && call.parentNode === slot) {
    homeCall.parent.insertBefore(call, homeCall.next);
  }
  /* Высоту отпускаем только когда экран погас совсем: между двумя
     состояниями панели форма уезжает и приезжает по нескольку раз,
     и каждое такое движение снова дёргало бы длину страницы. */
  if (unpin) pinHeight(false);
}

function fillForm(kind) {
  homeForms();
  var form = doc.getElementById(kind === "call" ? "cbForm" : "leadForm");
  body.innerHTML =
    '<button type="button" class="dsk-back" data-go="menu">' +
      esc(t("ui.back", "Назад")) + '</button>' +
    '<div class="dsk-title">' +
      esc(kind === "call" ? t("cb.h", "Перезвоните мне") : t("ct.h", "Расскажите о проекте")) +
    '</div>';
  body.hidden = false;
  slot.hidden = false;
  moveForm(form);
}

/* ── Рука человека ──────────────────────────────────────────── */
function onClick(e) {
  var tgt = e.target;
  var go = tgt.closest ? tgt.closest("[data-go]") : null;
  if (go) {
    var to = go.getAttribute("data-go");
    if (to === "menu") swap("menu", fillMenu);
    else if (to === "call") swap("call", function () { fillForm("call"); });
    else if (to === "lead") swap("lead", function () { fillForm("lead"); });
    return;
  }
  var q = tgt.closest ? tgt.closest(".dsk-q") : null;
  if (q) {
    var i = parseInt(q.getAttribute("data-q"), 10);
    swap("answer", function () { fillAnswer(i); });
    return;
  }
  /* Клик по пустому месту экрана возвращает в меню: владелец просил
     предусмотреть возврат и назвал этот способ прямо. Внутри формы
     так не делаем - человек может промахнуться мимо поля и потерять
     набранное. */
  if (state === "answer" && !tgt.closest("input, textarea, select, button, a")) {
    swap("menu", fillMenu);
  }
}

/* ── Кадр: видимость ведёт камера рубки ─────────────────────── */
function frame() {
  raf = requestAnimationFrame(frame);
  if (doc.hidden) return;

  var I = g.RC_INTERIOR;
  var con = I && I.con ? I.con() : 0;
  var back = I && I.back ? I.back() : 0;

  /* Экран разгорается вместе с подъездом к пульту и уходит, как
     только камера двинулась назад: дальше кадр принадлежит надписи
     старта. Порог подъезда не нулевой - пока панель стоит в своём
     углу комнаты, она пустая, как и просил владелец. */
  var k = Math.max(0, Math.min(1, (con - 0.34) / 0.5));
  /* Экран не растворяется постепенно: как только камера пошла назад
     от пульта, изображение рвётся и пропадает. Кадр после этого
     принадлежит титру старта, и они не имеют права быть в кадре
     вдвоём - иначе вместо смены сцены получается наложение. Титр
     начинает разгораться позже (см. --epi-k в rc-cockpit.css), в
     промежутке остекление стоит пустым. */
  var on = k > 0.02 && back < 0.16;

  if (on && !layer) {
    if (!build()) return;
    layer.setAttribute("data-state", "menu");
    fillMenu();
  }
  if (!layer) return;

  var r = Math.round(k * 100) / 100;
  if (r !== kPub) {
    kPub = r;
    V(layer, "--dsk-k", String(r));
  }

  /* Постановка кадра: те же числа, что у самой кабины */
  var C = g.RC_COCKPIT;
  var gm = C && C.geom ? C.geom() : null;
  if (gm) {
    V(layer, "--cab-tx", gm.tx.toFixed(2) + "%");
    V(layer, "--cab-rot", gm.rot.toFixed(2) + "deg");
    V(layer, "--cab-sc", gm.sc.toFixed(3));
    V(layer, "--cab-x0", (gm.x0 * 100).toFixed(2) + "%");
    V(layer, "--cab-y0", (gm.y0 * 100).toFixed(2) + "%");
    V(layer, "--cab-win-w", ((gm.x1 - gm.x0) * 100).toFixed(2) + "%");
    V(layer, "--cab-win-h", ((gm.y1 - gm.y0) * 100).toFixed(2) + "%");
  }
  /* Экран погас - кадр переходит титру старта, и переход этот тоже
     глитчем: владелец описал его одной фразой - «она глитчем
     исчезает, и глитчем появляется уже надпись старта игры». */
  var lit = back > 0.2;
  if (lit !== root.classList.contains("rc-start-on")) {
    root.classList.toggle("rc-start-on", lit);
  }

  var o = on ? 1 : 0;
  if (o !== onPub) {
    onPub = o;
    layer.classList.toggle("dsk-on", on);
    /* Уход и возврат - тоже разрыв изображения, а не затухание */
    layer.classList.add("dsk-glitch");
    if (glitchT) clearTimeout(glitchT);
    glitchT = setTimeout(function () {
      glitchT = 0;
      if (layer) layer.classList.remove("dsk-glitch");
    }, 420);
    if (!on) {
      /* Экран погас - формы возвращаются на свои места в разметке,
         иначе они уедут из кадра вместе со слоем и на обычной
         странице их не найдёт ни человек, ни поисковик */
      homeForms(true);
      state = "menu";
      layer.setAttribute("data-state", "menu");
    }
  }
}

/* ── Запуск ─────────────────────────────────────────────────── */
function boot() {
  if (reduced || root.classList.contains("rc-reduced")) return;
  if (!raf) raf = requestAnimationFrame(frame);
}

/* Кнопка «Перезвоните мне» есть и вне корабля - в шапке и в
   контактах. Она открывает модальное окно, а форма к этому моменту
   может стоять на экране панели: вернём её домой раньше, чем окно
   успеет открыться. Слушаем на перехвате, чтобы опередить
   обработчик самого окна. */
doc.addEventListener("click", function (e) {
  var b = e.target.closest ? e.target.closest(".js-callback") : null;
  if (!b) return;
  if (layer && layer.contains(b)) return;
  homeForms();
}, true);

/* Смена языка перестраивает вопросы: тексты приходят из словаря */
doc.addEventListener("rc:lang", function () {
  setTimeout(function () {
    if (layer && state === "menu") fillMenu();
  }, 140);
});

addEventListener("resize", function () {
  setTimeout(function () { if (layer && state === "menu") fillMenu(); }, 220);
}, { passive: true });

if (doc.readyState === "loading") doc.addEventListener("DOMContentLoaded", boot);
else boot();

g.RC_DESK = {
  state: function () {
    return { есть: !!layer, экран: state, доля: kPub };
  }
};

})(window);
