/**
 * Подсказки адреса — единый компонент для всех форм сайта.
 *
 * Подключается к любому полю с data-address-suggest. Ходит на серверный прокси
 * /api/v1/address_suggest (ключ DaData остаётся на сервере). Если подсказок нет
 * или сеть недоступна — поле продолжает работать как обычное текстовое,
 * ввод руками никогда не блокируется.
 *
 * Разметка:
 *   <input data-address-suggest data-postal="#ord_postal" data-city="#city">
 *   Индекс (data-postal) и город (data-city) подставляются автоматически,
 *   если у подсказки есть соответствующие поля.
 *
 * Модификаторы:
 *   data-suggest-mode="city"    — искать только город (не улицу),
 *   data-country="#country"     — куда положить страну ("Россия" и т.п.).
 *
 * Автопривязка НОВЫХ полей: подключаем MutationObserver + focusin, чтобы поля,
 * появившиеся динамически (шаги формы, модалка корзины, details-раскрытие),
 * получали подсказки сразу — без ручного вызова MM_bindAddress.
 */
(function () {
  'use strict';

  var API = (window.MM_ADDRESS_API || '/api/v1/address_suggest');

  function attach(input) {
    if (!input || input.__addrBound) return;
    input.__addrBound = true;
    input.setAttribute('autocomplete', 'off');

    var wrap = input.closest('.field') || input.parentNode;
    if (wrap && getComputedStyle(wrap).position === 'static') wrap.style.position = 'relative';
    var box = document.createElement('div');
    box.className = 'addr-suggest';
    box.hidden = true;
    wrap.appendChild(box);

    var mode = (input.getAttribute('data-suggest-mode') || '').toLowerCase();

    var timer = null, items = [], active = -1, lastQuery = '';

    function hide() { box.hidden = true; box.innerHTML = ''; items = []; active = -1; }

    function render(list) {
      items = list || [];
      if (!items.length) { hide(); return; }
      box.innerHTML = items.map(function (s, i) {
        var label = mode === 'city' ? (s.city ? (s.region ? s.region + ', г. ' + s.city : 'г. ' + s.city) : s.value) : s.value;
        var pc = s.postal_code ? '<small>Индекс: ' + s.postal_code + '</small>' : '';
        return '<div class="addr-item" data-i="' + i + '">' +
               String(label).replace(/</g, '&lt;') + pc + '</div>';
      }).join('');
      box.hidden = false;
      active = -1;
    }

    function choose(i) {
      var s = items[i];
      if (!s) return;
      // Режим «только город»: подставляем короткое «г. Название», а не полный
      // адрес — иначе в поле «Город» окажется «Россия, обл ..., г. ...».
      input.value = mode === 'city'
        ? (s.city ? s.city : s.value)
        : s.value;

      var sel = input.getAttribute('data-postal');
      if (sel) {
        var pf = document.querySelector(sel);
        if (pf && s.postal_code) pf.value = s.postal_code;
      }
      var citySel = input.getAttribute('data-city');
      if (citySel) {
        var cf = document.querySelector(citySel);
        if (cf && s.city) cf.value = s.city;
      }
      var countrySel = input.getAttribute('data-country');
      if (countrySel) {
        var cnt = document.querySelector(countrySel);
        if (cnt) cnt.value = 'Россия';   // DaData отдаёт только адреса РФ
      }
      hide();
      input.dispatchEvent(new Event('change', { bubbles: true }));
    }

    function query(q) {
      if (q === lastQuery) return;
      lastQuery = q;
      var url = API + '?q=' + encodeURIComponent(q) + (mode ? '&mode=' + mode : '');
      fetch(url, { credentials: 'same-origin' })
        .then(function (r) { return r.json(); })
        .then(function (d) { render((d && d.suggestions) || []); })
        .catch(function () { hide(); });
    }

    input.addEventListener('input', function () {
      var q = input.value.trim();
      if (q.length < (mode === 'city' ? 2 : 3)) { hide(); return; }
      clearTimeout(timer);
      timer = setTimeout(function () { query(q); }, 200);
    });
    input.addEventListener('focus', function () {
      var q = input.value.trim();
      if (q.length >= (mode === 'city' ? 2 : 3) && !items.length) { lastQuery = ''; query(q); }
    });
    box.addEventListener('mousedown', function (e) {
      var it = e.target.closest('.addr-item');
      if (!it) return;
      e.preventDefault();
      choose(parseInt(it.getAttribute('data-i'), 10));
    });
    input.addEventListener('keydown', function (e) {
      if (box.hidden) return;
      if (e.key === 'ArrowDown') { e.preventDefault(); active = Math.min(active + 1, items.length - 1); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); active = Math.max(active - 1, 0); }
      else if (e.key === 'Enter' && active >= 0) { e.preventDefault(); choose(active); return; }
      else if (e.key === 'Escape') { hide(); return; }
      else return;
      Array.prototype.forEach.call(box.children, function (c, i) {
        c.classList.toggle('active', i === active);
      });
    });
    document.addEventListener('click', function (e) {
      if (!wrap.contains(e.target)) hide();
    });
  }

  function scan(root) {
    (root || document).querySelectorAll('[data-address-suggest]').forEach(attach);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', function () { scan(); });
  else scan();

  // Дополнительный страховочный проход: любое всплывающее фокусирование —
  // повод убедиться, что поле, попавшее в фокус, привязано (защита от того,
  // что новый узел уже в DOM, но MutationObserver ещё не дошёл до scan()).
  document.addEventListener('focusin', function (e) {
    var t = e.target;
    if (t && t.matches && t.matches('[data-address-suggest]')) attach(t);
  }, true);

  // Автопривязка динамически добавленных полей: элементы, вставленные позже
  // (открытие модалки корзины, раскрытие <details> в кабинете, шаги формы) —
  // тоже получают подсказки без ручного MM_bindAddress().
  if (typeof MutationObserver === 'function') {
    var mo = new MutationObserver(function (muts) {
      for (var i = 0; i < muts.length; i++) {
        var added = muts[i].addedNodes;
        for (var j = 0; j < added.length; j++) {
          var n = added[j];
          if (n && n.nodeType === 1) {
            if (n.matches && n.matches('[data-address-suggest]')) attach(n);
            if (n.querySelectorAll) scan(n);
          }
        }
      }
    });
    mo.observe(document.documentElement, { childList: true, subtree: true });
  }

  window.MM_bindAddress = scan;
})();
