/**
 * Подсказки адреса — единый компонент для всех форм сайта.
 *
 * Подключается к любому полю с data-address-suggest. Ходит на серверный прокси
 * /api/v1/address_suggest (ключ DaData остаётся на сервере). Если подсказок нет
 * или сеть недоступна — поле продолжает работать как обычное текстовое,
 * ввод руками никогда не блокируется.
 *
 * Разметка:
 *   <input data-address-suggest data-postal="#ord_postal">
 * Индекс (если у поля указан data-postal) подставляется автоматически.
 */
(function () {
  'use strict';

  var API = (window.MM_ADDRESS_API || '/api/v1/address_suggest');

  function attach(input) {
    if (!input || input.__addrBound) return;
    input.__addrBound = true;
    input.setAttribute('autocomplete', 'off');

    // Контейнер списка — позиционируется относительно обёртки поля.
    var wrap = input.closest('.field') || input.parentNode;
    if (wrap && getComputedStyle(wrap).position === 'static') wrap.style.position = 'relative';
    var box = document.createElement('div');
    box.className = 'addr-suggest';
    box.hidden = true;
    wrap.appendChild(box);

    var timer = null, items = [], active = -1, lastQuery = '';

    function hide() { box.hidden = true; box.innerHTML = ''; items = []; active = -1; }

    function render(list) {
      items = list || [];
      if (!items.length) { hide(); return; }
      box.innerHTML = items.map(function (s, i) {
        var pc = s.postal_code ? '<small>Индекс: ' + s.postal_code + '</small>' : '';
        return '<div class="addr-item" data-i="' + i + '">' +
               String(s.value).replace(/</g, '&lt;') + pc + '</div>';
      }).join('');
      box.hidden = false;
      active = -1;
    }

    function choose(i) {
      var s = items[i];
      if (!s) return;
      input.value = s.value;
      var sel = input.getAttribute('data-postal');
      if (sel) {
        var pf = document.querySelector(sel);
        if (pf && s.postal_code) pf.value = s.postal_code;
      }
      hide();
      input.dispatchEvent(new Event('change', { bubbles: true }));
    }

    function query(q) {
      if (q === lastQuery) return;
      lastQuery = q;
      fetch(API + '?q=' + encodeURIComponent(q), { credentials: 'same-origin' })
        .then(function (r) { return r.json(); })
        .then(function (d) { render((d && d.suggestions) || []); })
        .catch(function () { hide(); });   // тихо: поле остаётся рабочим
    }

    input.addEventListener('input', function () {
      var q = input.value.trim();
      if (q.length < 3) { hide(); return; }
      clearTimeout(timer);
      timer = setTimeout(function () { query(q); }, 200);
    });
    // Возврат в поле с уже введённым адресом — снова показываем подсказки.
    input.addEventListener('focus', function () {
      var q = input.value.trim();
      if (q.length >= 3 && !items.length) { lastQuery = ''; query(q); }
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

  function scan() {
    document.querySelectorAll('[data-address-suggest]').forEach(attach);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', scan);
  else scan();
  // Поля могут появляться динамически (шаги формы, модалки).
  window.MM_bindAddress = scan;
})();
