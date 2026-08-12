/* ╔══════════════════════════════════════════════════════════════╗
   ║  OKO · ТАРИФЫ ПОПАПОМ ИЗ ПРОФИЛЯ                                ║
   ║                                                                ║
   ║  Было: строка «Тарифы ОКО» в профиле уводила человека в раздел  ║
   ║  Кошелька - профиль пропадал, сверху появлялась чужая шапка.    ║
   ║  Стало: тарифы открываются отдельным окном поверх профиля,      ║
   ║  с анимацией, и закрываются обратно в профиль.                  ║
   ║                                                                ║
   ║  Цены берутся из ЕДИНСТВЕННОГО источника - RG2_TIERS и          ║
   ║  RG2_PERIODS в ядре. Свой прайс здесь не заводится: три разных  ║
   ║  таблицы цен в одном приложении - это гарантированное враньё в  ║
   ║  одном из мест. Верхнеуровневый const в window не попадает,     ║
   ║  поэтому читаем по голому имени (урок 15).                      ║
   ╚══════════════════════════════════════════════════════════════╝ */
(function () {
  'use strict';
  if (window.okoTarPop) return;

  function E(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function ico(n) {
    try { if (typeof window.I === 'function') return window.I(n); } catch (e) {}
    return '<svg class="i" aria-hidden="true"><use href="#i-' + n + '"></use></svg>';
  }
  function money(n) {
    return Math.round(n).toLocaleString('ru-RU').replace(/,/g, ' ') + ' ₽';
  }
  function tiers() {
    try { if (typeof RG2_TIERS !== 'undefined' && Array.isArray(RG2_TIERS)) return RG2_TIERS; } catch (e) {}
    return [];
  }
  function periods() {
    try { if (typeof RG2_PERIODS !== 'undefined' && Array.isArray(RG2_PERIODS)) return RG2_PERIODS; } catch (e) {}
    return [{ m: 1, lab: '1 мес', disc: 0 }];
  }
  function curTier() {
    try { if (typeof PROFILE !== 'undefined' && PROFILE && PROFILE.tier) return String(PROFILE.tier).toUpperCase(); } catch (e) {}
    return 'FREE';
  }

  var st = { plan: null, per: 12 };

  /* ------------------------------------------------------------ разметка */

  function html() {
    var T = tiers(), P = periods(), cur = curTier();
    if (!T.length) {
      return '<div class="tp-empty">Тарифы не загрузились. Обнови приложение и открой ещё раз.</div>';
    }
    if (!st.plan) st.plan = (cur !== 'FREE' && T.some(function (t) { return t.id === cur; })) ? cur : 'PRO';

    var per = P.filter(function (x) { return x.m === st.per; })[0] || P[0];
    st.per = per.m;

    var h = '';

    /* переключатель срока: скидка видна сразу, без мелкого шрифта */
    h += '<div class="tp-per" role="tablist" aria-label="Срок оплаты">';
    P.forEach(function (p) {
      h += '<button class="tp-per-b' + (p.m === st.per ? ' on' : '') + '" type="button" role="tab"'
        + ' aria-selected="' + (p.m === st.per ? 'true' : 'false') + '"'
        + ' onclick="okoTarPop.срок(' + p.m + ')">'
        + '<b>' + E(p.lab) + '</b>'
        + (p.disc ? '<i>−' + p.disc + '%</i>' : '<i>—</i>')
        + '</button>';
    });
    h += '</div>';

    /* карточки тарифов */
    h += '<div class="tp-list">';
    T.forEach(function (t, i) {
      var active = t.id === st.plan;
      var mine = t.id === cur;
      var full = t.price * per.m;
      var total = Math.round(full * (1 - (per.disc || 0) / 100));
      h += '<article class="tp-card' + (active ? ' on' : '') + (mine ? ' mine' : '') + '"'
        + ' style="--i:' + i + '" tabindex="0" role="button" aria-pressed="' + active + '"'
        + ' onclick="okoTarPop.выбрать(\'' + t.id + '\')"'
        + ' onkeydown="if(event.key===\'Enter\'||event.key===\' \'){event.preventDefault();okoTarPop.выбрать(\'' + t.id + '\')}">';
      h += '<div class="tp-card-h">'
        + '<div class="tp-name">' + E(t.name || t.id) + (mine ? '<span class="tp-mine">' + ico('check') + ' твой</span>' : '') + '</div>'
        + '<div class="tp-price">' + (t.price ? money(t.price) + '<small>/мес</small>' : 'Бесплатно') + '</div>'
        + '</div>';
      if (t.line) h += '<div class="tp-line">' + E(t.line) + '</div>';
      if (Array.isArray(t.feats) && t.feats.length) {
        h += '<ul class="tp-feats">' + t.feats.map(function (f) {
          return '<li>' + ico('check') + '<span>' + E(f) + '</span></li>';
        }).join('') + '</ul>';
      }
      if (t.price && per.m > 1) {
        h += '<div class="tp-total">За ' + per.m + ' мес: <b>' + money(total) + '</b>'
          + (per.disc ? ' <s>' + money(full) + '</s>' : '') + '</div>';
      }
      h += '</article>';
    });
    h += '</div>';

    /* действие */
    var sel = T.filter(function (t) { return t.id === st.plan; })[0];
    if (sel) {
      var full2 = sel.price * per.m;
      var total2 = Math.round(full2 * (1 - (per.disc || 0) / 100));
      h += '<div class="tp-foot">';
      if (!sel.price) {
        h += '<p class="tp-note">FREE уже доступен - платить не нужно.</p>';
      } else if (sel.id === cur) {
        h += '<p class="tp-note">' + E(sel.name) + ' у тебя активен. Управлять подпиской - в Кошельке.</p>'
          + '<button class="btn ghost okv-press" type="button" onclick="okoTarPop.вКошелёк()">' + ico('card') + ' Управлять подпиской</button>';
      } else {
        h += '<button class="btn okv-press okv-shine" type="button" onclick="okoTarPop.оплатить()">'
          + ico('bolt') + ' Оплатить ' + money(total2) + ' за ' + per.m + ' мес</button>'
          + '<p class="tp-note">Оплата проходит на защищённой странице шлюза. Тариф включится, '
          + 'когда шлюз подтвердит платёж - приложение само себе тариф не выдаёт.</p>';
      }
      h += '</div>';
    }
    return h;
  }

  /* ------------------------------------------------------------- окно */

  function build() {
    var el = document.getElementById('okoTarPop');
    if (el) return el;
    el = document.createElement('div');
    el.id = 'okoTarPop';
    el.setAttribute('role', 'dialog');
    el.setAttribute('aria-modal', 'true');
    el.setAttribute('aria-label', 'Тарифы OKO');
    el.innerHTML =
      '<div class="tp-back" onclick="okoTarPop.закрыть()"></div>'
      + '<div class="tp-win">'
      + '<div class="tp-bar">'
      + '<div class="tp-bar-t"><b>Тарифы OKO</b><small id="tpSub"></small></div>'
      + '<button class="tp-x" type="button" aria-label="Закрыть" onclick="okoTarPop.закрыть()">' + ico('x') + '</button>'
      + '</div>'
      + '<div class="tp-body" id="tpBody"></div>'
      + '</div>';
    document.body.appendChild(el);
    return el;
  }

  function paint() {
    var b = document.getElementById('tpBody');
    if (b) b.innerHTML = html();
    var s = document.getElementById('tpSub');
    if (s) s.textContent = 'Активен ' + curTier();
  }

  var прошлыйФокус = null;

  function open() {
    var el = build();
    прошлыйФокус = document.activeElement;
    paint();
    el.classList.add('on');
    try { document.documentElement.style.overflow = 'hidden'; } catch (e) {}
    /* фокус внутрь окна, чтобы клавиатура и скринридер не остались снаружи */
    setTimeout(function () {
      var f = el.querySelector('.tp-x');
      if (f) f.focus();
    }, 60);
    document.addEventListener('keydown', esc);
  }

  function close() {
    var el = document.getElementById('okoTarPop');
    if (!el) return;
    el.classList.remove('on');
    try { document.documentElement.style.overflow = ''; } catch (e) {}
    document.removeEventListener('keydown', esc);
    try { if (прошлыйФокус && прошлыйФокус.focus) прошлыйФокус.focus(); } catch (e) {}
  }

  function esc(e) {
    if (e.key === 'Escape') { e.preventDefault(); close(); }
  }

  /* --------------------------------------------------------- действия */

  function выбрать(id) { st.plan = id; paint(); }
  function срок(m) { st.per = m; paint(); }

  function вКошелёк() {
    close();
    try {
      if (typeof showTab === 'function') showTab('wallet');
      setTimeout(function () { if (window.okoW2 && window.okoW2.open) window.okoW2.open('autopay'); }, 320);
    } catch (e) {}
  }

  /* Оплата идёт по УЖЕ существующему пути приложения: своего платёжного
     контура здесь не появляется. Нет пути - честно говорим, а не молчим. */
  function оплатить() {
    var id = st.plan;
    close();
    setTimeout(function () {
      try {
        if (typeof window.openPay === 'function') { window.openPay(id); return; }
        if (window.okoW2 && typeof window.okoW2.tarPick === 'function') {
          if (typeof showTab === 'function') showTab('wallet');
          setTimeout(function () { window.okoW2.tarPick(id); }, 320);
          return;
        }
        if (typeof window.toast === 'function') window.toast('Оплата тарифа сейчас недоступна - напиши в поддержку');
      } catch (e) {}
    }, 260);
  }

  /* --------------------------------- перехват строки «Тарифы» в профиле */

  function rewire() {
    var rows = document.querySelectorAll('#screen-profile [onclick*="pp2OpenTiers"], [onclick*="pp2OpenTiers"]');
    Array.prototype.forEach.call(rows, function (r) {
      if (r.dataset.tpWired) return;
      r.dataset.tpWired = '1';
      r.setAttribute('onclick', 'okoTarPop.открыть()');
    });
  }

  function start() {
    /* профиль перерисовывается - подцепляемся несколько раз, потом успокаиваемся */
    var n = 0;
    var t = setInterval(function () { n++; rewire(); if (n > 30) clearInterval(t); }, 700);
    /* и на всякий случай перехватываем саму функцию */
    setTimeout(function () {
      if (typeof window.pp2OpenTiers === 'function' && !window.pp2OpenTiers.__tp) {
        var w = function () { open(); };
        w.__tp = 1;
        window.pp2OpenTiers = w;
      }
    }, 1500);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start, { once: true });
  } else { start(); }

  window.okoTarPop = {
    открыть: open, закрыть: close, выбрать: выбрать, срок: срок,
    оплатить: оплатить, вКошелёк: вКошелёк
  };
})();
