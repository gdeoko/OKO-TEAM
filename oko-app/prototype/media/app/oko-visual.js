/* ╔══════════════════════════════════════════════════════════════╗
   ║  OKO · ВИЗУАЛЬНЫЙ СЛОЙ (логика)                                 ║
   ║                                                                ║
   ║  Что делает:                                                   ║
   ║  1. Оживляет пустые состояния во ВСЁМ приложении. Классов у них ║
   ║     девять (w2-blank, ch-empty, cx2-empty, m2-empty, soc-empty, ║
   ║     ps-empty, okoem-empty, ac2-empty, wal-empty) и разбросаны   ║
   ║     они по десяткам мест - поэтому не правим каждое место, а    ║
   ║     дооформляем по факту появления.                            ║
   ║  2. Поднимает карточки и строки при прокрутке (IntersectionObserver).
   ║  3. Даёт физический отклик на нажатие.                         ║
   ║                                                                ║
   ║  ПРО ТОРМОЗА (урок 22-23, стоил сессии):                        ║
   ║  Наблюдатель за DOM никогда не работает синхронно. Обработчик   ║
   ║  только через requestAnimationFrame-дебаунс, внутри - никакого  ║
   ║  getComputedStyle. Проход помечает элементы своим флагом, чтобы ║
   ║  не будить сам себя бесконечно.                                ║
   ╚══════════════════════════════════════════════════════════════╝ */
(function () {
  'use strict';
  if (window.okoVisual) return;

  /* Классы-иконки пустых состояний, которые уже есть в приложении.
     Их дооформляем ореолом. */
  /* Собрано обходом разметки: index.html + app.js + все слои. `.es-ico` -
     самый частый, он в «Чатах», поиске и уведомлениях, то есть его человек
     видит в первые секунды. */
  var ICON_SEL = [
    '.es-ico',
    '.w2-blank-ic', '.cx2-empty-ic', '.m2-empty-ic', '.ch-empty-ic',
    '.soc-empty-ic', '.ps-empty-ic', '.okoem-empty-ic', '.ac2-empty-ic',
    '.wal-empty-ic', '.w2-empty-ic', '.okr-empty-ic', '.mk2-empty-ic',
    '.h2-empty-ic'
  ].join(',');

  /* Пустые состояния без отдельной иконки: там ищем svg внутри. */
  var EMPTY_SEL = [
    '.empty-state',
    '.w2-blank', '.cx2-empty', '.m2-empty', '.ch-empty', '.soc-empty',
    '.ps-empty', '.okoem-empty', '.ac2-empty', '.wal-empty', '.w2-recent-empty',
    '.mk-empty', '.onb2-empty', '.okc-empty', '.gm-empty'
  ].join(',');

  /* Что поднимать при прокрутке. Узкий список: чем меньше целей, тем
     дешевле проход и тем меньше шансов задеть чужую анимацию. */
  var RISE_SEL = [
    '.mk-card', '.m2-card', '.soc-card', '.ac2-card', '.ac2-lesson',
    '.cx2-row', '.w2-op', '.hq-card', '.sys-card'
  ].join(',');

  var MARK = 'okvSeen';           // помечаем обработанное — второй раз не трогаем
  var reduce = false;
  try {
    reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion:reduce)').matches;
  } catch (e) {}

  /* ------------------------------------------------- появление в кадре */
  var io = null;
  function observer() {
    if (io || reduce || !window.IntersectionObserver) return io;
    io = new IntersectionObserver(function (entries) {
      for (var i = 0; i < entries.length; i++) {
        var e = entries[i];
        if (!e.isIntersecting) continue;
        var el = e.target;
        io.unobserve(el);                       // один раз — и забыли
        el.classList.add('okv-on');
        setTimeout(function (n) {
          return function () { n.classList.add('okv-done'); };
        }(el), 500);
      }
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.04 });
    return io;
  }

  /* ------------------------------------------------------- один проход */
  function decorate(root) {
    root = root || document;
    var i, el, list;

    /* 1. Ореол вокруг иконок пустых состояний */
    try {
      list = root.querySelectorAll ? root.querySelectorAll(ICON_SEL) : [];
      for (i = 0; i < list.length; i++) {
        el = list[i];
        if (el.dataset[MARK]) continue;
        el.dataset[MARK] = '1';
        el.classList.add('okv-halo');
        if (!reduce && !el.querySelector('.okv-orbit')) {
          var orb = document.createElement('i');
          orb.className = 'okv-orbit';
          orb.setAttribute('aria-hidden', 'true');
          el.appendChild(orb);
        }
      }
    } catch (e) {}

    /* 2. Пустые состояния, где иконка не в своём контейнере: берём первый svg */
    try {
      list = root.querySelectorAll ? root.querySelectorAll(EMPTY_SEL) : [];
      for (i = 0; i < list.length; i++) {
        el = list[i];
        if (el.dataset[MARK]) continue;
        el.dataset[MARK] = '1';
        var svg = el.querySelector('svg');
        /* если svg лежит голым в блоке — заворачиваем, чтобы было к чему
           крепить свечение (обёртка инлайн-блок, вёрстку не ломает) */
        if (svg && svg.parentNode === el && !svg.closest('.okv-halo')) {
          var wrap = document.createElement('span');
          wrap.className = 'okv-halo';
          wrap.style.cssText = 'display:inline-flex;align-items:center;justify-content:center';
          svg.parentNode.insertBefore(wrap, svg);
          wrap.appendChild(svg);
          if (!reduce) {
            var o2 = document.createElement('i');
            o2.className = 'okv-orbit';
            o2.setAttribute('aria-hidden', 'true');
            wrap.appendChild(o2);
          }
        }
      }
    } catch (e) {}

    /* 3. Появление карточек при прокрутке */
    if (!reduce) {
      try {
        var ob = observer();
        if (ob) {
          list = root.querySelectorAll ? root.querySelectorAll(RISE_SEL) : [];
          /* больше 40 за раз не берём: длинный список и так виден целиком
             только частично, а лишние наблюдатели дороги */
          var n = Math.min(list.length, 40);
          for (i = 0; i < n; i++) {
            el = list[i];
            if (el.dataset.okvRise) continue;
            el.dataset.okvRise = '1';
            el.classList.add('okv-rise');
            ob.observe(el);
          }
        }
      } catch (e) {}
    }
  }

  /* --------------------------------------------- наблюдатель с дебаунсом */
  /* Три ограничителя разом (урок 23): флаг «идёт проход», схлопывание
     очереди через clearTimeout и rAF, флаг «есть что смотреть». */
  var идёт = false, грязно = false, таймер = null, кадр = null;

  function schedule() {
    if (идёт) { грязно = true; return; }
    if (таймер) clearTimeout(таймер);
    таймер = setTimeout(function () {
      таймер = null;
      if (кадр) cancelAnimationFrame(кадр);
      кадр = requestAnimationFrame(function () {
        кадр = null;
        идёт = true;
        try { decorate(document); } catch (e) {}
        идёт = false;
        if (грязно) { грязно = false; schedule(); }
      });
    }, 140);
  }

  function start() {
    decorate(document);
    try {
      var mo = new MutationObserver(function (muts) {
        /* дешёвая проверка: интересуют только добавленные узлы */
        for (var i = 0; i < muts.length; i++) {
          if (muts[i].addedNodes && muts[i].addedNodes.length) { schedule(); return; }
        }
      });
      mo.observe(document.body, { childList: true, subtree: true });
    } catch (e) {}
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start, { once: true });
  } else {
    start();
  }

  window.okoVisual = {
    обнови: function () { decorate(document); },
    decorate: decorate
  };
})();
