/* ═══════════════════════════════════════════════════════════
   Rocket CDN - запись переменных оформления без лишней работы
   ───────────────────────────────────────────────────────────
   Сцены публикуют своё состояние через переменные CSS на корне
   документа: положение корабля, дрожь, палитра рубки, стёкла.
   Так вёрстка и объём живут одной картиной, и это правильно.

   Но запись свойства на :root помечает устаревшим стиль всего
   дерева - а в нём под три тысячи узлов. Раньше сцены делали это
   каждый кадр и каждой переменной, даже когда значение не менялось:
   на приёмке набежало 53,7 секунды пересчёта стилей за один проход
   страницы, около 98 мс на кадр. Отсюда и «подтормаживает».

   Здесь одна дисциплина на все сцены: пишем только тогда, когда
   строка значения действительно другая. Кадры, где корабль стоит
   или величина округлилась в ту же цифру, не стоят браузеру ничего.
   ═══════════════════════════════════════════════════════════ */
(function (g) {
  "use strict";

  var store = "__rcVars";

  function set(el, name, value) {
    if (!el || !el.style) return;
    var map = el[store] || (el[store] = {});
    var v = value == null ? "" : String(value);
    if (map[name] === v) return;
    map[name] = v;
    if (v === "") el.style.removeProperty(name);
    else el.style.setProperty(name, v);
  }

  function del(el, name) {
    if (!el || !el.style) return;
    var map = el[store] || (el[store] = {});
    if (map[name] === "") return;
    map[name] = "";
    el.style.removeProperty(name);
  }

  /* Сброс кэша нужен там, где стиль элемента переписали мимо нас:
     например, целиком заменили атрибут style */
  function forget(el) {
    if (el) el[store] = {};
  }

  g.RC_VAR = { set: set, del: del, forget: forget };
})(window);

/* ═══════════════════════════════════════════════════════════
   Координаты элементов без пересчёта вёрстки
   ───────────────────────────────────────────────────────────
   Модули сцены каждый кадр спрашивали у браузера, где сейчас
   находится тот или иной блок. Спросить об этом после того, как
   что-то записал в стиль, значит заставить браузер немедленно
   пересчитать всю вёрстку - трассировка на телефоне показала, что
   на такие принудительные пересчёты уходило столько же времени,
   сколько на всю остальную работу кадра.

   Но при прокрутке блоки не двигаются: меняется только положение
   окна. Значит достаточно один раз узнать место блока в документе
   и дальше вычитать прокрутку. Пересчитываем, только когда меняются
   размеры окна или высота документа - то есть когда место блока
   действительно могло измениться.

   Как узнать, что высота изменилась, не спрашивая браузер. Первая
   редакция кэша проверяла scrollHeight на каждом обращении - и это
   было хуже болезни: чтение scrollHeight само по себе заставляет
   браузер досчитать вёрстку, а обращений в кадре под сотню. Здесь
   об изменениях сообщает наблюдатель за размерами: он срабатывает
   после кадра и ничего не пересчитывает досрочно. Плюс сторож на
   спокойных кадрах - на случай, если блок переехал, не поменяв
   собственный размер.
   ═══════════════════════════════════════════════════════════ */
(function (g) {
  "use strict";

  var doc = document;
  var cache = [];
  var stamp = 0;
  var lastMove = 0;

  /* Наблюдатель за размерами: высота документа или самого блока
     изменилась - его мерка устарела */
  var ro = null;
  if (g.ResizeObserver) {
    ro = new ResizeObserver(function (list) {
      for (var i = 0; i < list.length; i++) {
        var t = list[i].target;
        if (t === doc.documentElement || t === doc.body) { drop(); return; }
        if (t.__rcBox) t.__rcBox = null;
      }
    });
    try {
      ro.observe(doc.documentElement);
      if (doc.body) ro.observe(doc.body);
      else doc.addEventListener("DOMContentLoaded", function () { ro.observe(doc.body); });
    } catch (e) { ro = null; }
  }

  /* Сторож: раз в секунду, но только когда страница стоит. Пересбор
     мерок в спокойном кадре ничего не стоит, а во время прокрутки
     обошёлся бы заметным рывком. */
  addEventListener("scroll", function () { lastMove = Date.now(); }, { passive: true });
  setInterval(function () {
    if (doc.hidden) return;
    if (Date.now() - lastMove < 500) return;
    drop();
  }, 1000);

  /* Место блока в кадре: как getBoundingClientRect, но без вопроса
     к браузеру, если ничего не менялось */
  function box(el) {
    if (!el) return null;
    var rec = el.__rcBox;
    if (!rec || rec.stamp !== stamp) {
      var r = el.getBoundingClientRect();
      var y = g.pageYOffset || doc.documentElement.scrollTop || 0;
      rec = el.__rcBox = {
        stamp: stamp,
        top: r.top + y,
        left: r.left,
        width: r.width,
        height: r.height
      };
      if (!el.__rcWatch) {
        el.__rcWatch = 1;
        if (ro) { try { ro.observe(el); } catch (e) {} }
      }
      cache.push(el);
    }
    var sy = g.pageYOffset || doc.documentElement.scrollTop || 0;
    return {
      top: rec.top - sy,
      bottom: rec.top - sy + rec.height,
      left: rec.left,
      right: rec.left + rec.width,
      width: rec.width,
      height: rec.height
    };
  }

  /* Принудительный сброс: зовут те, кто сам переставил разметку */
  function drop() { stamp++; cache.length = 0; docStamp = -1; }

  /* Высота документа. Её спрашивают пять модулей в каждом кадре -
     чтобы посчитать долю прокрутки. Вопрос не бесплатный: браузер
     обязан досчитать вёрстку, прежде чем ответить. Пока разметка не
     менялась, ответ один и тот же - держим его при себе. */
  var docStamp = -1, docVal = 1;
  function docH() {
    if (docStamp !== stamp) {
      docStamp = stamp;
      var de = doc.documentElement;
      docVal = (de.scrollHeight || (doc.body ? doc.body.scrollHeight : 0)) || 1;
    }
    return docVal;
  }

  addEventListener("resize", drop, { passive: true });
  doc.addEventListener("rc:lang", drop);
  addEventListener("rc:content", drop);

  g.RC_BOX = { box: box, drop: drop, docH: docH };
})(window);
