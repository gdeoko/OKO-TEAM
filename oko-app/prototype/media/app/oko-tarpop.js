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

  /* Живая графика в шапке карточки. У каждого тарифа своя: шестерни,
     столбики, сеть, орбита. Всё - лёгкий SVG с CSS-анимацией, никаких
     картинок и библиотек. Движение гаснет при prefers-reduced-motion. */
  function art(id) {
    var A = {
      FREE:
        '<svg class="tp-art" viewBox="0 0 240 90" aria-hidden="true">'
        + '<circle class="a-pulse" cx="52" cy="45" r="16"/>'
        + '<circle class="a-pulse d1" cx="52" cy="45" r="26"/>'
        + '<circle class="a-pulse d2" cx="52" cy="45" r="36"/>'
        + '<circle class="a-dot f1" cx="140" cy="30" r="3"/>'
        + '<circle class="a-dot f2" cx="180" cy="58" r="3"/>'
        + '<circle class="a-dot f3" cx="210" cy="26" r="3"/></svg>',
      START:
        '<svg class="tp-art" viewBox="0 0 240 90" aria-hidden="true">'
        + '<rect class="a-bar b1" x="30"  y="30" width="18" height="46" rx="4"/>'
        + '<rect class="a-bar b2" x="58"  y="30" width="18" height="46" rx="4"/>'
        + '<rect class="a-bar b3" x="86"  y="30" width="18" height="46" rx="4"/>'
        + '<rect class="a-bar b4" x="114" y="30" width="18" height="46" rx="4"/>'
        + '<path class="a-line" d="M30 58 L67 44 L95 50 L123 28 L160 34"/>'
        + '<circle class="a-run" r="3.5"><animateMotion dur="4s" repeatCount="indefinite"'
        + ' path="M30 58 L67 44 L95 50 L123 28 L160 34"/></circle></svg>',
      PRO:
        '<svg class="tp-art" viewBox="0 0 240 90" aria-hidden="true">'
        + '<g class="a-gear g1" style="transform-origin:70px 42px">' + gear(70, 42, 26) + '</g>'
        + '<g class="a-gear g2" style="transform-origin:126px 62px">' + gear(126, 62, 17) + '</g>'
        + '<g class="a-gear g3" style="transform-origin:170px 30px">' + gear(170, 30, 13) + '</g></svg>',
      BUSINESS:
        '<svg class="tp-art" viewBox="0 0 240 90" aria-hidden="true">'
        + '<path class="a-net" d="M60 46 L108 24 M60 46 L104 68 M108 24 L156 40 M104 68 L156 40 M156 40 L200 26 M156 40 L198 62"/>'
        + '<circle class="a-node n1" cx="60"  cy="46" r="7"/>'
        + '<circle class="a-node n2" cx="108" cy="24" r="5"/>'
        + '<circle class="a-node n3" cx="104" cy="68" r="5"/>'
        + '<circle class="a-node n4" cx="156" cy="40" r="6"/>'
        + '<circle class="a-node n5" cx="200" cy="26" r="4"/>'
        + '<circle class="a-node n6" cx="198" cy="62" r="4"/></svg>',
      MAX:
        '<svg class="tp-art" viewBox="0 0 240 90" aria-hidden="true">'
        + '<ellipse class="a-orb o1" cx="120" cy="45" rx="74" ry="26"/>'
        + '<ellipse class="a-orb o2" cx="120" cy="45" rx="52" ry="40"/>'
        + '<circle class="a-core" cx="120" cy="45" r="13"/>'
        + '<circle class="a-sat s1" r="4"><animateMotion dur="7s" repeatCount="indefinite"'
        + ' path="M46 45 a74 26 0 1 0 148 0 a74 26 0 1 0 -148 0"/></circle>'
        + '<circle class="a-sat s2" r="3"><animateMotion dur="5s" repeatCount="indefinite"'
        + ' path="M68 45 a52 40 0 1 1 104 0 a52 40 0 1 1 -104 0"/></circle></svg>'
    };
    return A[id] || A.FREE;
  }

  /* Шестерня: зубцы считаем, а не рисуем руками - так они ровные. */
  function gear(cx, cy, r) {
    var teeth = 9, out = '', i, a, x1, y1;
    for (i = 0; i < teeth; i++) {
      a = (Math.PI * 2 / teeth) * i;
      x1 = cx + Math.cos(a) * (r + 5);
      y1 = cy + Math.sin(a) * (r + 5);
      out += '<rect x="' + (x1 - 3.5).toFixed(1) + '" y="' + (y1 - 3.5).toFixed(1) + '" width="7" height="7" rx="1.6"'
        + ' transform="rotate(' + (a * 180 / Math.PI).toFixed(1) + ' ' + x1.toFixed(1) + ' ' + y1.toFixed(1) + ')"/>';
    }
    return out + '<circle cx="' + cx + '" cy="' + cy + '" r="' + r + '"/>'
      + '<circle class="a-hole" cx="' + cx + '" cy="' + cy + '" r="' + (r * 0.4).toFixed(1) + '"/>';
  }

  function html() {
    var T = tiers(), P = periods(), cur = curTier();
    if (!T.length) {
      return '<div class="tp-empty">Тарифы не загрузились. Обнови приложение и открой ещё раз.</div>';
    }
    if (!st.plan) st.plan = (cur !== 'FREE' && T.some(function (t) { return t.id === cur; })) ? cur : 'PRO';

    var per = P.filter(function (x) { return x.m === st.per; })[0] || P[0];
    st.per = per.m;

    var h = '';
    h += '<p class="tp-hint">Свайпни, чтобы выбрать</p>';

    /* срок оплаты */
    h += '<div class="tp-per" role="tablist" aria-label="Срок оплаты">';
    P.forEach(function (p) {
      h += '<button class="tp-per-b' + (p.m === st.per ? ' on' : '') + '" type="button" role="tab"'
        + ' aria-selected="' + (p.m === st.per ? 'true' : 'false') + '"'
        + ' onclick="okoTarPop.срок(' + p.m + ')">'
        + '<b>' + E(p.lab) + '</b>' + (p.disc ? '<i>−' + p.disc + '%</i>' : '') + '</button>';
    });
    h += '</div>';

    /* карусель карточек */
    h += '<div class="tp-rail" id="tpRail">';
    T.forEach(function (t, i) {
      var active = t.id === st.plan;
      var mine = t.id === cur;
      var full = t.price * per.m;
      var total = Math.round(full * (1 - (per.disc || 0) / 100));
      var perDay = t.price ? Math.round(total / (per.m * 30)) : 0;

      h += '<article class="tp-card' + (active ? ' on' : '') + '" data-plan="' + t.id + '" style="--i:' + i + '"'
        + ' tabindex="0" role="button" aria-pressed="' + active + '"'
        + ' onclick="okoTarPop.выбрать(\'' + t.id + '\')"'
        + ' onkeydown="if(event.key===\'Enter\'||event.key===\' \'){event.preventDefault();okoTarPop.выбрать(\'' + t.id + '\')}">';

      /* шапка с живой графикой */
      h += '<div class="tp-head">' + art(t.id)
        + '<div class="tp-flags">'
        + (mine ? '<span class="tp-flag now">сейчас</span>' : '')
        + (t.id === 'PRO' ? '<span class="tp-flag hit">хит</span>' : '')
        + (t.id === 'MAX' ? '<span class="tp-flag hit">максимум</span>' : '')
        + '</div>'
        + '<div class="tp-head-b"><b>' + E(t.name || t.id) + '</b>'
        + '<span>' + E(t.line || '') + '</span></div></div>';

      /* тело */
      h += '<div class="tp-body-c">';
      h += '<div class="tp-price-row">'
        + '<div class="tp-price">' + (t.price ? money(t.price) + '<small>/мес</small>' : 'Бесплатно') + '</div>'
        + (perDay ? '<div class="tp-day">' + perDay + ' ₽/день</div>' : '')
        + '</div>';
      if (Array.isArray(t.feats)) {
        h += '<ul class="tp-feats">' + t.feats.map(function (f, k) {
          return '<li style="--k:' + k + '">' + ico('check2') + '<span>' + E(f) + '</span></li>';
        }).join('') + '</ul>';
      }
      if (t.price && per.m > 1) {
        h += '<div class="tp-total">За ' + per.m + ' мес <b>' + money(total) + '</b>'
          + (per.disc ? '<s>' + money(full) + '</s>' : '') + '</div>';
      }
      h += mine
        ? '<div class="tp-cta mine">' + ico('check2') + ' Твой тариф</div>'
        : '<button class="tp-cta go" type="button" onclick="event.stopPropagation();okoTarPop.оплатить(\'' + t.id + '\')">'
          + (t.price ? ico('bolt') + ' Подключить' : 'Уже доступен') + '</button>';
      h += '</div></article>';
    });
    h += '</div>';

    /* точки-пагинация */
    h += '<div class="tp-dots" id="tpDots">' + T.map(function (t) {
      return '<i class="tp-dot' + (t.id === st.plan ? ' on' : '') + '" data-plan="' + t.id + '"></i>';
    }).join('') + '</div>';

    /* сравнение */
    h += '<button class="tp-cmp okv-press" type="button" onclick="okoTarPop.сравнить()">'
      + ico('target') + ' Сравнить все тарифы' + ico('chev') + '</button>';

    return h;
  }

  /* Таблица сравнения: все возможности всех тарифов рядом. */
  function cmpHtml() {
    var T = tiers();
    var all = [];
    T.forEach(function (t) { (t.feats || []).forEach(function (f) { if (all.indexOf(f) < 0) all.push(f); }); });
    var h = '<div class="tp-cmp-wrap"><table class="tp-tab"><thead><tr><th></th>'
      + T.map(function (t) { return '<th>' + E(t.name || t.id) + '</th>'; }).join('') + '</tr></thead><tbody>';
    all.forEach(function (f) {
      h += '<tr><td>' + E(f) + '</td>' + T.map(function (t) {
        var yes = (t.feats || []).indexOf(f) >= 0;
        return '<td>' + (yes ? '<i class="tp-yes">' + ico('check2') + '</i>' : '<i class="tp-no">—</i>') + '</td>';
      }).join('') + '</tr>';
    });
    h += '</tbody></table></div>'
      + '<button class="btn ghost okv-press" type="button" onclick="okoTarPop.назад()">Назад к тарифам</button>';
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
    if (!b) return;
    b.innerHTML = вид === 'cmp' ? cmpHtml() : html();
    var s = document.getElementById('tpSub');
    if (s) s.textContent = 'Активен ' + curTier();
    if (вид === 'cmp') return;
    подвестиКарусель();
    /* активный срок подъезжает в кадр: «Год −20%» стоит последним и на
       узком экране уезжал за правый край - человек не видел лучшую цену */
    var pb = b.querySelector('.tp-per-b.on');
    if (pb && pb.parentNode && pb.parentNode.scrollWidth > pb.parentNode.clientWidth) {
      pb.parentNode.scrollTo({ left: Math.max(0, pb.offsetLeft - 16), behavior: 'auto' });
    }
  }

  /* Карусель: активная карточка приезжает в центр, точки следят за пальцем.
     Слушатель прокрутки дебаунсится через rAF - на слабом телефоне иначе
     дёргается (тот же урок, что и с наблюдателями). */
  var вид = 'list';
  function подвестиКарусель() {
    var rail = document.getElementById('tpRail');
    if (!rail) return;
    var act = rail.querySelector('.tp-card.on');
    if (act) {
      var к = act.offsetLeft - (rail.clientWidth - act.offsetWidth) / 2;
      rail.scrollTo({ left: к, behavior: перваяОтрисовка ? 'auto' : 'smooth' });
    }
    перваяОтрисовка = false;
    if (rail.dataset.wired) return;
    rail.dataset.wired = '1';
    var кадр = null;
    rail.addEventListener('scroll', function () {
      if (кадр) return;
      кадр = requestAnimationFrame(function () {
        кадр = null;
        var c = rail.clientWidth / 2 + rail.scrollLeft, лучший = null, дист = 1e9;
        Array.prototype.forEach.call(rail.children, function (el) {
          var d = Math.abs(el.offsetLeft + el.offsetWidth / 2 - c);
          if (d < дист) { дист = d; лучший = el; }
        });
        if (!лучший) return;
        var id = лучший.getAttribute('data-plan');
        var dots = document.getElementById('tpDots');
        if (dots) Array.prototype.forEach.call(dots.children, function (d) {
          d.classList.toggle('on', d.getAttribute('data-plan') === id);
        });
      });
    }, { passive: true });
  }
  var перваяОтрисовка = true;

  var прошлыйФокус = null;

  function open() {
    var el = build();
    вид = 'list'; перваяОтрисовка = true;
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

  function выбрать(id) {
    st.plan = id;
    var rail = document.getElementById('tpRail');
    if (!rail) { paint(); return; }
    /* перерисовка целиком сбрасывала бы прокрутку под пальцем - меняем
       только состояние и подводим карточку к центру */
    Array.prototype.forEach.call(rail.children, function (el) {
      var on = el.getAttribute('data-plan') === id;
      el.classList.toggle('on', on);
      el.setAttribute('aria-pressed', String(on));
    });
    var dots = document.getElementById('tpDots');
    if (dots) Array.prototype.forEach.call(dots.children, function (d) {
      d.classList.toggle('on', d.getAttribute('data-plan') === id);
    });
    подвестиКарусель();
  }
  function сравнить() { вид = 'cmp'; paint(); }
  function назад() { вид = 'list'; перваяОтрисовка = true; paint(); }
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
  function оплатить(id) {
    id = id || st.plan;
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
    оплатить: оплатить, вКошелёк: вКошелёк, сравнить: сравнить, назад: назад
  };
})();
