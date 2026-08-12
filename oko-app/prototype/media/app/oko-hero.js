/* ╔══════════════════════════════════════════════════════════════╗
   ║  OKO · HERO-КАДРЫ РАЗДЕЛОВ                                      ║
   ║  У ключевых экранов появляется кинематографичная шапка: свой    ║
   ║  кадр под каждый раздел, сгенерированный в бренде и сжатый до   ║
   ║  7-13 КБ. Кадр не мешает тексту - поверх лежит градиент, а      ║
   ║  снизу он растворяется в фон экрана.                            ║
   ║                                                                ║
   ║  Кадры только на ТЁМНЫХ поверхностях. В светлой теме свечение   ║
   ║  на белом превращается в серую кашу (проверено), поэтому там    ║
   ║  кадр гасится до тонкой подложки.                               ║
   ╚══════════════════════════════════════════════════════════════╝ */
(function () {
  'use strict';
  if (window.okoHero) return;

  /* экран → кадр. Ключ - id экрана приложения. */
  var HERO = {
    'screen-academy': { img: 'hero-academy', t: 'Академия', s: 'Учись и применяй' },
    'screen-ads':     { img: 'hero-ads',     t: 'Реклама',  s: 'Продвижение внутри OKO' },
    'screen-partner': { img: 'hero-partner', t: 'Партнёрка', s: 'Приводи и зарабатывай' },
    'screen-games':   { img: 'hero-market',  t: 'Биржа',    s: 'Заказы и исполнители' }
  };

  function mount(id) {
    var conf = HERO[id];
    if (!conf) return;
    var scr = document.getElementById(id);
    if (!scr || scr.querySelector('.okh')) return;

    var d = document.createElement('div');
    d.className = 'okh';
    d.setAttribute('aria-hidden', 'true');
    d.innerHTML =
      '<img class="okh-img" src="media/img/' + conf.img + '.webp" alt="" loading="lazy" decoding="async">'
      + '<div class="okh-veil"></div>'
      + '<div class="okh-t"><b>' + conf.t + '</b><span>' + conf.s + '</span></div>';

    /* вставляем первым в экран, но НЕ внутрь скроллера с фиксированной шапкой */
    var first = scr.firstElementChild;
    if (first && /head|top|bar/i.test(first.className || '')) {
      scr.insertBefore(d, first.nextSibling);
    } else {
      scr.insertBefore(d, first);
    }
  }

  function scan() {
    Object.keys(HERO).forEach(mount);
  }

  var кадр = null;
  function schedule() {
    if (кадр) return;
    кадр = requestAnimationFrame(function () { кадр = null; scan(); });
  }

  function start() {
    scan();
    /* экраны рисуются лениво - ловим появление, но дёшево: только
       добавленные узлы и только через rAF (урок про тормоза наблюдателей) */
    try {
      var mo = new MutationObserver(function (m) {
        for (var i = 0; i < m.length; i++) {
          if (m[i].addedNodes && m[i].addedNodes.length) { schedule(); return; }
        }
      });
      mo.observe(document.body, { childList: true, subtree: true });
    } catch (e) {}
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start, { once: true });
  } else { start(); }

  window.okoHero = { обнови: scan, карта: HERO };
})();
