/* ═══════════════════════════════════════════════════════════
   Rocket CDN - навигация горизонтальных лент
   ───────────────────────────────────────────────────────────
   Ленты «Как работает» и «Сценарии» едут вбок: на большом
   экране их тянет прокрутка страницы, на телефоне - палец.
   В обоих случаях человеку не видно, сколько карточек всего и
   где он сейчас. Полоса прогресса это показывала только на ПК,
   и то намёком.

   Здесь считаем активную карточку одинаково для всех устройств
   (ближайшая к центру кадра) и рисуем один и тот же прибор:
   счётчик «2 / 6» и точки-переключатели. Разница только в
   размерах, как и требует приёмка.
   ═══════════════════════════════════════════════════════════ */
(function (g, d) {
  "use strict";

  var rails = [];
  var raf = 0;

  function $(s, r) { return (r || d).querySelector(s); }
  function $$(s, r) { return Array.prototype.slice.call((r || d).querySelectorAll(s)); }

  /* Подпись «из скольких» переводится вместе со страницей: берём
     готовый словарь, если он уже поднялся, иначе русский текст */
  function t(key, def) {
    try {
      if (g.RC_I18N && g.RC_I18N.t) return g.RC_I18N.t(key, def);
    } catch (e) {}
    return def;
  }

  function build(sec) {
    var view = $(".hs-view", sec);
    var track = $(".hs-track", sec);
    var bar = $(".hs-bar", sec);
    if (!view || !track || !bar) return null;

    var nav = $(".rail-nav", bar);
    if (!nav) {
      nav = d.createElement("div");
      nav.className = "rail-nav";
      nav.innerHTML = '<div class="rail-dots" role="tablist"></div><div class="rail-cnt"><b>1</b><s></s><em>1</em></div>';
      bar.appendChild(nav);
    }

    return {
      sec: sec, view: view, track: track, bar: bar, nav: nav,
      dots: $(".rail-dots", nav), cnt: $(".rail-cnt", nav),
      cards: [], idx: -1, touched: false
    };
  }

  /* Карточки в ленту приходят из JS уже после загрузки, поэтому
     список пересобираем, а не запоминаем один раз навсегда */
  function sync(r) {
    var cards = $$(":scope > *", r.track).filter(function (el) {
      return el.nodeType === 1;
    });
    if (cards.length === r.cards.length && r.dots.children.length === cards.length) {
      r.cards = cards;
      return;
    }
    r.cards = cards;

    var html = "";
    for (var i = 0; i < cards.length; i++) {
      html += '<button type="button" class="rail-dot" role="tab" aria-label="' +
        (i + 1) + '" data-i="' + i + '"><i></i></button>';
    }
    r.dots.innerHTML = html;
    var em = $("em", r.cnt);
    if (em) em.textContent = String(cards.length);
    r.idx = -1;
  }

  /* Активная карточка - та, чей центр ближе к центру кадра.
     Одна формула на оба устройства: на ПК карточки едут
     transform'ом, на телефоне - прокруткой ленты, а центр
     кадра в обоих случаях на месте. */
  function active(r) {
    var mid = g.innerWidth / 2;
    var best = 0, bestD = 1e9;
    for (var i = 0; i < r.cards.length; i++) {
      var b = r.cards[i].getBoundingClientRect();
      var dist = Math.abs(b.left + b.width / 2 - mid);
      if (dist < bestD) { bestD = dist; best = i; }
    }
    return best;
  }

  function paint(r) {
    var i = active(r);
    if (i === r.idx) return;
    r.idx = i;
    var b = $("b", r.cnt);
    if (b) b.textContent = String(i + 1);
    var dots = $$(".rail-dot", r.dots);
    for (var k = 0; k < dots.length; k++) {
      dots[k].classList.toggle("on", k === i);
      dots[k].setAttribute("aria-selected", k === i ? "true" : "false");
    }
    /* Подсказку «листайте вбок» гасим, как только человек
       доехал до второй карточки: дальше она только мешает */
    if (i > 0 && !r.touched) { r.touched = true; r.sec.classList.add("rail-used"); }
  }

  function tick() {
    raf = 0;
    for (var i = 0; i < rails.length; i++) {
      var r = rails[i];
      /* Список карточек сверяем всегда, даже когда лента за кадром:
         содержимое приходит из словаря уже после загрузки, и если
         пропустить этот момент, счётчик так и останется на единице.
         А вот отмечать активную точку есть смысл только в кадре. */
      sync(r);
      if (!r.cards.length) continue;
      var box = r.sec.getBoundingClientRect();
      if (box.bottom < -80 || box.top > g.innerHeight + 80) continue;
      paint(r);
    }
  }

  function schedule() {
    if (!raf) raf = g.requestAnimationFrame(tick);
  }

  /* Переход по точке: на телефоне это прокрутка самой ленты,
     на ПК лентой правит страница, поэтому листаем страницу */
  function goto(r, i) {
    var card = r.cards[i];
    if (!card) return;
    if (g.innerWidth <= 900) {
      var left = card.offsetLeft - (r.view.clientWidth - card.offsetWidth) / 2;
      try { r.view.scrollTo({ left: left, behavior: "smooth" }); }
      catch (e) { r.view.scrollLeft = left; }
      return;
    }
    var span = Math.max(0, r.track.scrollWidth - g.innerWidth);
    if (!span) return;
    var part = Math.min(1, Math.max(0, (card.offsetLeft - (g.innerWidth - card.offsetWidth) / 2) / span));
    var total = r.sec.offsetHeight - g.innerHeight;
    var top = r.sec.offsetTop + total * part;
    try { g.scrollTo({ top: top, behavior: "smooth" }); }
    catch (e2) { g.scrollTo(0, top); }
  }

  function wire(r) {
    r.nav.addEventListener("click", function (e) {
      var btn = e.target.closest ? e.target.closest(".rail-dot") : null;
      if (!btn) return;
      var i = parseInt(btn.dataset.i, 10);
      if (isNaN(i)) return;
      goto(r, i);
      /* Короткий тактильный ответ там, где он есть: палец
         должен чувствовать, что переключение состоялось */
      try { if (g.navigator && g.navigator.vibrate) g.navigator.vibrate(8); } catch (e3) {}
    });
    r.view.addEventListener("scroll", schedule, { passive: true });
  }

  function init() {
    rails = $$(".hs").map(build).filter(Boolean);
    if (!rails.length) return;
    rails.forEach(function (r) { sync(r); wire(r); });
    g.addEventListener("scroll", schedule, { passive: true });
    g.addEventListener("resize", function () {
      rails.forEach(function (r) { r.idx = -1; });
      schedule();
    }, { passive: true });
    /* Карточки в ленты досыпаются из словаря и из админки:
       пока это происходит, держим счётчик в курсе */
    g.addEventListener("rc:content", schedule);
    d.addEventListener("rc:lang", schedule);
    /* Ленты наполняются и переписываются из словаря, из админки и при
       смене языка. Следим за самим содержимым, а не за моментами,
       когда его меняют: иначе счётчик рано или поздно отстанет. */
    if (g.MutationObserver) {
      try {
        var mo = new g.MutationObserver(schedule);
        rails.forEach(function (r) { mo.observe(r.track, { childList: true }); });
      } catch (e) {}
    }
    schedule();
    g.setTimeout(schedule, 400);
    g.setTimeout(schedule, 1600);
  }

  if (d.readyState === "loading") d.addEventListener("DOMContentLoaded", init);
  else init();

  g.RC_RAIL = { refresh: schedule };
})(window, document);
