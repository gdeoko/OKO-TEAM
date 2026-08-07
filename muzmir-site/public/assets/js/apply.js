/* Культурный центр «Музыкальный Мир» — умная форма заявки. Vanilla JS, без библиотек. */
(function () {
  'use strict';
  var CFG = window.APPLY_CONFIG || {};
  var form = document.getElementById('applyForm');
  if (!form) return;

  var $ = function (s, c) { return (c || form).querySelector(s); };
  var $$ = function (s, c) { return Array.prototype.slice.call((c || form).querySelectorAll(s)); };
  var DRAFT_KEY = 'muzmir_apply_draft_v1';

  // Автозаполнение промокода педагога из ссылки-приглашения (?promo=/?ref=/?code=).
  try {
    var qp = new URLSearchParams(location.search);
    var refCode = (qp.get('promo') || qp.get('ref') || qp.get('code') || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
    if (refCode) {
      try { localStorage.setItem('muzmir_ref_code', refCode); } catch (e) {}
    } else {
      try { refCode = (localStorage.getItem('muzmir_ref_code') || ''); } catch (e) {}
    }
    if (refCode) {
      var pc = document.getElementById('promo_code');
      if (pc && !pc.value) pc.value = refCode;
    }
  } catch (e) {}

  // Порядок навигационных шагов. «pay» вставляется только для платного конкурса.
  var STEP_ORDER = ['comp', 'user', 'teacher', 'number', 'contact', 'consent'];
  var panels = {};
  $$('.astep').forEach(function (el) { panels[el.getAttribute('data-step')] = el; });
  var progressNodes = {};
  Array.prototype.slice.call(document.querySelectorAll('#apProgress .ap-node')).forEach(function (n) {
    progressNodes[n.getAttribute('data-node')] = n;
  });

  var current = 'comp';
  var isPaid = false;

  // Тост: используем глобальный window.toast (app.js), c fallback на alert.
  function notify(msg, type) {
    if (typeof window.toast === 'function') window.toast(msg, type);
    else alert(msg);
  }

  /* ---------- Моушен (свой файл; CSS страницы не трогаем) ---------- */
  var RM = window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)') : null;
  function reduceMotion() { return !!(RM && RM.matches); }

  // Одноразовая инъекция стилей для степпер-заливки и пульса точки.
  function injectMotionCss() {
    if (document.getElementById('applyMotionCss')) return;
    var st = document.createElement('style');
    st.id = 'applyMotionCss';
    st.textContent =
      '.ap-fill{position:absolute;height:2px;background:var(--grad-gold);z-index:0;border-radius:2px;width:0;' +
      'transition:width .5s cubic-bezier(.2,.8,.2,1),left .5s cubic-bezier(.2,.8,.2,1)}' +
      '.ap-dot.pulse{animation:apDotPulse .55s ease}' +
      '@keyframes apDotPulse{0%{transform:scale(1)}45%{transform:scale(1.16)}100%{transform:scale(1)}}';
    (document.head || document.documentElement).appendChild(st);
  }

  // Направленный fade/slide входящей панели (transform/opacity, rAF, GPU).
  function animateIn(panel, dir) {
    if (!panel || reduceMotion()) return;
    var dx = dir === 'back' ? -26 : 26;
    panel.style.animation = 'none';            // отключаем CSS apIn, ведём вручную
    panel.style.willChange = 'opacity, transform';
    panel.style.opacity = '0';
    panel.style.transform = 'translateX(' + dx + 'px)';
    void panel.offsetWidth;                    // reflow, чтобы старт зафиксировался
    panel.style.transition = 'opacity .36s cubic-bezier(.2,.8,.2,1), transform .36s cubic-bezier(.2,.8,.2,1)';
    requestAnimationFrame(function () {
      panel.style.opacity = '1';
      panel.style.transform = 'translateX(0)';
    });
    var done = false;
    function clear() {
      if (done) return; done = true;
      panel.style.transition = ''; panel.style.transform = '';
      panel.style.opacity = ''; panel.style.willChange = ''; panel.style.animation = '';
      panel.removeEventListener('transitionend', clear);
    }
    panel.addEventListener('transitionend', clear);
    setTimeout(clear, 520);
  }

  // Заливка линии степпера + пульс активной точки. Меряем реальные центры точек.
  var prevActiveKey = null;
  function updateProgressFill() {
    var cont = document.getElementById('apProgress');
    if (!cont) return;
    var fill = cont.querySelector('.ap-fill');
    if (!fill) { fill = document.createElement('div'); fill.className = 'ap-fill'; cont.insertBefore(fill, cont.firstChild); }
    var nodes = Array.prototype.slice.call(cont.querySelectorAll('.ap-node')).filter(function (n) { return n.style.display !== 'none'; });
    if (!nodes.length) { fill.style.width = '0'; return; }
    var reached = cont.querySelector('.ap-node.active');
    if (!reached) {
      var dn = cont.querySelectorAll('.ap-node.done');
      reached = dn.length ? dn[dn.length - 1] : nodes[0];
    }
    var cRect = cont.getBoundingClientRect();
    var firstDot = nodes[0].querySelector('.ap-dot').getBoundingClientRect();
    var reachedDot = reached.querySelector('.ap-dot').getBoundingClientRect();
    var left = (firstDot.left + firstDot.width / 2) - cRect.left;
    var right = (reachedDot.left + reachedDot.width / 2) - cRect.left;
    fill.style.left = left + 'px';
    fill.style.top = ((firstDot.top + firstDot.height / 2) - cRect.top - 1) + 'px';
    fill.style.width = Math.max(0, right - left) + 'px';
  }
  function pulseActiveDot() {
    if (reduceMotion()) return;
    var cont = document.getElementById('apProgress');
    if (!cont) return;
    var activeNode = cont.querySelector('.ap-node.active');
    var key = activeNode ? activeNode.getAttribute('data-node') : null;
    if (key && key !== prevActiveKey) {
      var dot = activeNode.querySelector('.ap-dot');
      if (dot) { dot.classList.remove('pulse'); void dot.offsetWidth; dot.classList.add('pulse'); }
    }
    prevActiveKey = key;
  }

  /* ---------- Утилиты текста ---------- */
  function fixFio(v) {
    if (!v) return v;
    // Только кириллица, пробелы и дефис; каждое слово — Первая Заглавная.
    v = v.replace(/[^А-Яа-яЁё\s\-]/g, '').replace(/\s{2,}/g, ' ');
    return v.replace(/(^|[\s\-])([а-яё])/g, function (m, sep, ch) {
      return sep + ch.toUpperCase();
    }).replace(/(^|[\s\-])([А-ЯЁ])(\S*)/g, function (m, sep, first, rest) {
      return sep + first + rest.toLowerCase();
    });
  }
  function fixQuotes(v) {
    if (!v) return v;
    v = v.replace(/[«»]/g, '"');
    var open = true;
    v = v.replace(/"/g, function () { return (open = !open) ? '»' : '«'; });
    return v.replace(/—|–/g, '-');
  }
  function fixPhone(v) {
    var d = (v || '').replace(/\D/g, '');
    if (d && d[0] === '8') d = '7' + d.slice(1);
    if (d && d[0] !== '7') d = '7' + d;
    d = d.slice(0, 11);
    var out = '+7';
    if (d.length > 1) out += ' (' + d.slice(1, 4);
    if (d.length >= 4) out += ') ' + d.slice(4, 7);
    if (d.length >= 7) out += '-' + d.slice(7, 9);
    if (d.length >= 9) out += '-' + d.slice(9, 11);
    return out;
  }
  function phoneComplete(v) { return (v || '').replace(/\D/g, '').length === 11; }
  function emailValid(v) { return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v || ''); }

  /* ---------- Форматирование ФИО / коллектива / названия номера ---------- */
  function fmtFio(s) {
    s = (s || '').replace(/[«»"“”'‘’`]/g, '').replace(/\s+/g, ' ').trim();
    if (!s) return '';
    return s.split(' ').map(function (w) {
      return w.split('-').map(function (p) {
        return p ? p.charAt(0).toUpperCase() + p.slice(1).toLowerCase() : p;
      }).join('-');
    }).join(' ');
  }
  // Гео-нормализация города: «Москва»→«Россия, г. Москва», «Минск»→«Республика
  // Беларусь, г. Минск». Не-российские города несут свою страну; остальное — Россия.
  // Сервер (core/text_format.php) — источник правды; здесь только UX-подсказка.
  var CITY_GEO = {
    'минск':['Республика Беларусь','Минск'],'гомель':['Республика Беларусь','Гомель'],
    'могилев':['Республика Беларусь','Могилёв'],'витебск':['Республика Беларусь','Витебск'],
    'гродно':['Республика Беларусь','Гродно'],'брест':['Республика Беларусь','Брест'],
    'бобруйск':['Республика Беларусь','Бобруйск'],'пинск':['Республика Беларусь','Пинск'],
    'алматы':['Республика Казахстан','Алматы'],'алма-ата':['Республика Казахстан','Алматы'],
    'астана':['Республика Казахстан','Астана'],'нур-султан':['Республика Казахстан','Астана'],
    'шымкент':['Республика Казахстан','Шымкент'],'караганда':['Республика Казахстан','Караганда'],
    'павлодар':['Республика Казахстан','Павлодар'],'актобе':['Республика Казахстан','Актобе'],
    'бишкек':['Кыргызская Республика','Бишкек'],'ош':['Кыргызская Республика','Ош'],
    'ташкент':['Республика Узбекистан','Ташкент'],'самарканд':['Республика Узбекистан','Самарканд'],
    'бухара':['Республика Узбекистан','Бухара'],'душанбе':['Республика Таджикистан','Душанбе'],
    'ашхабад':['Туркменистан','Ашхабад'],'ереван':['Республика Армения','Ереван'],
    'баку':['Азербайджанская Республика','Баку'],'тбилиси':['Грузия','Тбилиси'],
    'кишинев':['Республика Молдова','Кишинёв'],'киев':['Украина','Киев'],
    'харьков':['Украина','Харьков'],'одесса':['Украина','Одесса'],
    'москва':['Россия','Москва'],'санкт-петербург':['Россия','Санкт-Петербург'],
    'петербург':['Россия','Санкт-Петербург'],'спб':['Россия','Санкт-Петербург'],
    'нижний новгород':['Россия','Нижний Новгород'],'ростов-на-дону':['Россия','Ростов-на-Дону'],
    'ростов':['Россия','Ростов-на-Дону'],'улан-удэ':['Россия','Улан-Удэ'],'йошкар-ола':['Россия','Йошкар-Ола'],
    'уфа':['Россия','Уфа'],'казань':['Россия','Казань'],'орел':['Россия','Орёл'],'королев':['Россия','Королёв']
  };
  function titleCity(s) {
    return (s || '').toLowerCase().replace(/(^|[\s\-])([а-яёa-z])/g, function (m, a, b) { return a + b.toUpperCase(); });
  }
  function formatCity(raw) {
    var s = (raw || '').replace(/\s+/g, ' ').trim();
    if (!s) return '';
    if (s.indexOf(',') !== -1) { var p = s.split(','); s = p[p.length - 1].trim(); }   // берём город из «Страна, г. Город»
    var pref = 'г.';
    var m = s.match(/^(город|гор\.?|г\.?|пгт\.?|посёлок|поселок|п\.?|село|с\.?|деревня|дер\.?|д\.?|станица|ст\.?|хутор|х\.?|аул)\s+/i);
    if (m) {
      s = s.slice(m[0].length).trim();
      var t = m[1].toLowerCase();
      if (/^(село|с)/.test(t)) pref = 'с.'; else if (/^(дерев|д)/.test(t)) pref = 'д.';
      else if (/^(посёлок|поселок|пгт|п)/.test(t)) pref = 'пгт'; else if (/^(станица|ст)/.test(t)) pref = 'ст.';
      else if (/^(хутор|х)/.test(t)) pref = 'х.'; else if (/^аул/.test(t)) pref = 'аул';
    }
    s = s.replace(/[«»"“”'‘’`]/g, '').trim();
    if (!s) return '';
    var key = s.toLowerCase().replace(/ё/g, 'е');
    if (CITY_GEO[key]) return CITY_GEO[key][0] + ', ' + pref + ' ' + CITY_GEO[key][1];
    return 'Россия, ' + pref + ' ' + titleCity(s);
  }
  function fioIsFull(s) {
    var parts = (s || '').trim().split(/\s+/).filter(function (w) { return w.length >= 2 && /^[\wа-яё\-’']+$/i.test(w); });
    return parts.length >= 3;
  }
  function smartTitle(s) {
    s = (s || '').trim(); if (!s) return '';
    var oneWord = !/\s/.test(s), allUpper = (s === s.toUpperCase());
    if (oneWord || allUpper) return s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();
    return s.charAt(0).toUpperCase() + s.slice(1);
  }
  function quoteTitle(s) {
    s = (s || '').trim(); if (!s) return '';
    if (/[«»]/.test(s)) return s;                                  // пользователь уже оформил
    s = s.replace(/^["“”'‘’`\s]+/, '').replace(/["“”'‘’`\s]+$/, '');
    return s ? '«' + smartTitle(s) + '»' : '';
  }
  var COLL_TYPES = ['вокальный ансамбль', 'танцевальный коллектив', 'хореографический коллектив', 'вокальный дуэт',
    'танцевальный дуэт', 'вокальная группа', 'вокальный коллектив', 'ансамбль', 'коллектив', 'дуэт', 'трио',
    'квартет', 'квинтет', 'хор', 'студия', 'группа', 'оркестр', 'театр', 'капелла'];
  function quoteCollective(s) {
    s = (s || '').replace(/\s+/g, ' ').trim(); if (!s) return '';
    var prefix = '', name = '', m = s.match(/^(.*?)[«"“](.+?)[»"”]\s*$/);
    if (m) { prefix = m[1].trim(); name = m[2].trim(); }
    else {
      name = s.replace(/[«»"“”'‘’`]/g, '').trim();
      var low = name.toLowerCase();
      for (var i = 0; i < COLL_TYPES.length; i++) {
        if (low.indexOf(COLL_TYPES[i]) === 0) { prefix = name.slice(0, COLL_TYPES[i].length); name = name.slice(COLL_TYPES[i].length).trim(); break; }
      }
    }
    if (!name) { name = prefix; prefix = ''; }
    var q = '«' + smartTitle(name) + '»';
    if (!prefix) return q;
    return prefix.charAt(0).toUpperCase() + prefix.slice(1).toLowerCase() + ' ' + q;
  }

  /* ---------- Платформа ссылки ---------- */
  function checkPlatform(url) {
    var host = '';
    try { host = new URL(url).hostname.replace(/^www\./, '').toLowerCase(); }
    catch (e) { return { state: 'bad', msg: 'Введите полную ссылку, начиная с https://', platform: '' }; }
    var blocked = CFG.blocked || [];
    for (var i = 0; i < blocked.length; i++) {
      if (host === blocked[i] || host.indexOf('.' + blocked[i]) !== -1 || host.indexOf(blocked[i]) !== -1) {
        return { state: 'bad', msg: 'Эта платформа не принимается. Загрузите видео на разрешённый сервис.', platform: '' };
      }
    }
    var allowed = CFG.allowed || {};
    for (var dom in allowed) {
      if (!allowed.hasOwnProperty(dom)) continue;
      if (host === dom || host.indexOf('.' + dom) !== -1) {
        return { state: 'ok', msg: 'Платформа распознана: ' + allowed[dom] + '.', platform: allowed[dom] };
      }
    }
    return { state: 'bad', msg: 'Платформа не в списке разрешённых. Проверьте ссылку.', platform: '' };
  }

  /* ---------- Возраст ↔ категория ---------- */
  function ageFromDate(iso) {
    if (!iso) return null;
    var b = new Date(iso); if (isNaN(b)) return null;
    var t = new Date(), a = t.getFullYear() - b.getFullYear();
    var m = t.getMonth() - b.getMonth();
    if (m < 0 || (m === 0 && t.getDate() < b.getDate())) a--;
    return a;
  }
  function categoryRange(label) {
    if (!label || /Смешанн|Професс/i.test(label)) return null; // без проверки
    if (/До\s*(\d+)/i.test(label)) { return [0, parseInt(RegExp.$1, 10)]; }
    if (/(\d+)\s*\+/.test(label)) { return [parseInt(RegExp.$1, 10), 200]; }
    var m = label.match(/(\d+)\s*-\s*(\d+)/);
    if (m) return [parseInt(m[1], 10), parseInt(m[2], 10)];
    return null;
  }
  function ageHint() {
    var hint = $('[data-age-hint]');
    if (!hint) return;
    var bd = $('#birth_date'); // поля может не быть в форме — работаем без него
    var age = bd ? ageFromDate(bd.value) : null;
    var cat = $('#age_category').value;
    if (age === null || !cat) { hint.textContent = ''; hint.style.color = ''; return; }
    var r = categoryRange(cat);
    if (!r) { hint.textContent = 'Возраст участника: ' + age + '.'; hint.style.color = ''; return; }
    if (age < r[0] || age > r[1]) {
      hint.textContent = 'Возраст участника (' + age + ') не совпадает с категорией. Проверьте данные.';
      hint.style.color = 'var(--error)';
    } else {
      hint.textContent = 'Возраст участника: ' + age + '. Категория подходит.';
      hint.style.color = 'var(--mint)';
    }
  }

  /* ---------- Ошибки поля ---------- */
  function fieldOf(input) { return input.closest ? input.closest('.field') : null; }
  function setErr(input, on) { var f = fieldOf(input); if (f) f.classList.toggle('error', !!on); }

  /* ---------- Номинация → подраздел ---------- */
  function fillSubgroups() {
    var nom = $('#nomination').value;
    var field = $('#subgroupField'), sel = $('#subgroup');
    var subs = (CFG.nominations && CFG.nominations[nom]) || [];
    sel.innerHTML = '<option value="">Выберите подраздел</option>';
    if (subs.length) {
      subs.forEach(function (s) {
        var o = document.createElement('option'); o.value = s; o.textContent = s; sel.appendChild(o);
      });
      field.style.display = '';
    } else {
      field.style.display = 'none';
      sel.value = '';
    }
  }

  /* ---------- Тип: солист / коллектив ---------- */
  function applyFormType() {
    var group = $('input[name="is_group"]:checked').value === '1';
    $$('#formTypeSeg label').forEach(function (l) {
      l.classList.toggle('on', l.querySelector('input').checked);
    });
    $$('[data-when="group"]').forEach(function (el) { el.style.display = group ? '' : 'none'; });
    $$('[data-when="solo"]').forEach(function (el) { el.style.display = group ? 'none' : ''; });
    $('#fnLabel').textContent = group
      ? 'ФИО контактного лица (руководителя)'
      : 'Фамилия, имя, отчество участника';
  }

  /* ---------- Навигация ---------- */
  function activeSteps() {
    var steps = STEP_ORDER.slice();
    if (isPaid) steps.push('pay');
    return steps;
  }
  function renderProgress() {
    var steps = activeSteps();
    var order = ['comp', 'user', 'teacher', 'number', 'contact', 'consent', 'pay', 'done'];
    // Панель отправки бесплатной заявки на прогресс-баре — это ещё шаг «Согласие».
    var cur = current === 'submit-free' ? 'consent' : current;
    var curIdx = steps.indexOf(cur);
    order.forEach(function (key) {
      var node = progressNodes[key]; if (!node) return;
      node.classList.remove('active', 'done');
      // Узел «Оплата» остаётся в разметке всегда (только приглушается у бесплатного) —
      // иначе прогресс-бар реф­лоу­ит и «прыгает» при каждом выборе конкурса.
      if (key === 'pay') { node.style.opacity = isPaid ? '' : '.32'; }
      node.style.display = '';
      if (current === 'done') { node.classList.add('done'); return; }
      var idx = steps.indexOf(key);
      if (key === cur) node.classList.add('active');
      else if (idx !== -1 && curIdx !== -1 && idx < curIdx) node.classList.add('done');
    });
    updateProgressFill();
    pulseActiveDot();
  }
  function show(step, dir) {
    current = step;
    // Смена шага — единый чистый CSS-fade (apFade), без ручной JS-анимации,
    // чтобы не было двойной анимации (морг) и рывков вёрстки.
    for (var k in panels) if (panels.hasOwnProperty(k)) panels[k].classList.remove('active');
    if (panels[step]) {
      // Перезапуск анимации: снять и вернуть класс в следующий кадр (иначе .active
      // остаётся и apFade не проигрывается повторно на том же узле).
      void panels[step].offsetWidth;
      panels[step].classList.add('active');
    }
    renderProgress();
    if (step === 'consent') { buildSummary(); updateConsentBtnLabel(); }
    if (step === 'pay') fillPayAmount();
    // Скроллим к форме ТОЛЬКО если её верх ушёл за пределы экрана — не дёргаем на каждом шаге.
    var r = form.getBoundingClientRect();
    if (r.top < 0 || r.top > window.innerHeight * 0.5) {
      window.scrollTo({ top: r.top + window.pageYOffset - 90, behavior: reduceMotion() ? 'auto' : 'smooth' });
    }
  }
  function goNext() {
    if (!validateStep(current)) return;
    // Шаг «Номер»: перед переходом сервер проверяет ссылку — существование,
    // открытый доступ, что это видео и что не старше 1 года.
    if (current === 'number') { verifyVideoThenAdvance(); return; }
    proceedNext();
  }
  function proceedNext() {
    var steps = activeSteps();
    var idx = steps.indexOf(current);
    // Бесплатный конкурс: шаг 6 «Проверка и согласие» — последний, кнопка сразу
    // отправляет заявку (без отдельной пустой страницы submit-free).
    if (current === 'consent' && !isPaid) { submit({ preventDefault: function () {} }); return; }
    if (idx !== -1 && idx < steps.length - 1) show(steps[idx + 1], 'next');
  }
  var videoChecking = false;
  function verifyVideoThenAdvance() {
    var vurl = $('#video_url'); var v = vurl ? vurl.value.trim() : '';
    if (!v || !CFG.videoCheck || !window.fetch) { proceedNext(); return; }
    if (videoChecking) return;
    videoChecking = true;
    var live = $('[data-plat-live]');
    var btns = $$('[data-next]'); btns.forEach(function (b) { b.disabled = true; });
    if (live) { live.className = 'plat-live'; live.textContent = 'Проверяем ссылку…'; }
    var ctrl = window.AbortController ? new AbortController() : null;
    var to = setTimeout(function () { if (ctrl) ctrl.abort(); }, 13000);
    var done = function () { clearTimeout(to); videoChecking = false; btns.forEach(function (b) { b.disabled = false; }); };
    fetch(CFG.videoCheck + '?url=' + encodeURIComponent(v), { headers: { 'X-Requested-With': 'fetch' }, signal: ctrl ? ctrl.signal : undefined })
      .then(function (r) { return r.json(); })
      .then(function (d) {
        done();
        if (d && d.ok === false) {
          setErr(vurl, true);
          if (live) { live.className = 'plat-live bad'; live.textContent = d.reason || 'Ссылка не прошла проверку.'; }
          flashFormError(d.reason || 'Проверьте ссылку на конкурсное видео.');
          var r = vurl.getBoundingClientRect();
          if (r.top < 60 || r.top > window.innerHeight) window.scrollTo({ top: r.top + window.pageYOffset - 100, behavior: reduceMotion() ? 'auto' : 'smooth' });
          return;
        }
        if (live && d && d.platform) { live.className = 'plat-live ok'; live.textContent = d.platform + ' — ссылка принята'; }
        proceedNext();
      })
      .catch(function () { done(); proceedNext(); }); // сеть недоступна/таймаут — не мешаем подаче
  }
  function goBack() {
    var steps = activeSteps();
    var idx = steps.indexOf(current);
    if (idx > 0) show(steps[idx - 1], 'back');
  }
  // Кнопка шага «Согласие»: у платного ведёт к шагу оплаты, у бесплатного отправляет.
  function updateConsentBtnLabel() {
    var btn = document.getElementById('consentNext');
    if (btn) btn.textContent = isPaid ? 'Продолжить' : 'Отправить заявку';
  }

  /* ---------- Валидация шага ---------- */
  function markRequired(input, ok) { setErr(input, !ok); return ok; }
  function validateStep(step) {
    var ok = true;
    if (step === 'comp') {
      var chosen = $$('input[name="competition_ids[]"]:checked');
      if (!chosen.length) { flashFormError('Выберите хотя бы один конкурс, чтобы продолжить.'); return false; }
      return true;
    }
    if (step === 'user') {
      // Обязательные: ФИО + возрастная категория (+ название коллектива, если коллектив).
      // Поля birth_date в форме НЕТ — обращение к нему роняло валидацию у солиста.
      // Солист ИЛИ коллектив — строго одно из двух.
      var group = $('input[name="is_group"]:checked').value === '1';
      if (group) {
        if ($('#group_name')) ok = markRequired($('#group_name'), !!$('#group_name').value.trim()) && ok;
      } else {
        var fnv = fmtFio($('#full_name').value);
        $('#full_name').value = fnv;
        ok = markRequired($('#full_name'), fioIsFull(fnv)) && ok; // требуем полное ФИО
      }
      ok = markRequired($('#age_category'), !!$('#age_category').value) && ok;
    }
    if (step === 'teacher') {
      // Педагог и учреждение — НЕобязательные. Город/населённый пункт — ОБЯЗАТЕЛЕН
      // и авто-форматируется в «Страна, г. Город».
      var cityEl = $('#city');
      if (cityEl) {
        var cf = formatCity(cityEl.value);
        if (cf) cityEl.value = cf;
        ok = markRequired(cityEl, !!cityEl.value.trim()) && ok;
      }
    }
    if (step === 'number') {
      ok = markRequired($('#nomination'), !!$('#nomination').value) && ok;
      var subF = $('#subgroupField');
      if (subF && subF.style.display !== 'none') ok = markRequired($('#subgroup'), !!$('#subgroup').value) && ok;
      ok = markRequired($('#formation'), !!$('#formation').value) && ok;
      ok = markRequired($('#work_title'), !!$('#work_title').value.trim()) && ok;
      // Ссылка на конкурсный номер ОБЯЗАТЕЛЬНА и должна пройти проверку платформы.
      var vu = $('#video_url').value.trim();
      var vr = vu ? checkPlatform(vu) : { state: 'bad' };
      ok = markRequired($('#video_url'), !!vu && vr.state === 'ok') && ok;
    }
    if (step === 'contact') {
      ok = markRequired($('#email'), emailValid($('#email').value.trim())) && ok;
      ok = markRequired($('#phone'), phoneComplete($('#phone').value)) && ok;
    }
    if (step === 'consent') {
      var arc = $('#agree_rules');
      ok = $('#agree_reg').checked && $('#agree_pd').checked && (!arc || arc.checked);
      if (!ok) flashFormError('Отметьте согласие с положением, обработкой данных и требованиями к работе.');
    }
    if (!ok && step !== 'consent') flashFormError('Проверьте выделенные поля.');
    else if (ok) flashFormError('');
    return ok;
  }
  function flashFormError(msg) {
    var box = document.getElementById('applyFormError');
    if (!box) return;
    box.textContent = msg || '';
    box.style.display = msg ? 'block' : 'none';
  }

  /* ---------- Сводка ---------- */
  function buildSummary() {
    var box = document.getElementById('applySummary');
    if (!box) return;
    var chosen = $$('input[name="competition_ids[]"]:checked');
    var names = chosen.map(function(c){return c.getAttribute('data-name');}).join(', ');
    var group = $('input[name="is_group"]:checked').value === '1';
    var rows = [
      [chosen.length > 1 ? ('Конкурсы (' + chosen.length + ')') : 'Конкурс', names || '-'],
      [group ? 'Коллектив' : 'Участник', group ? $('#group_name').value : $('#full_name').value],
      ['Возрастная категория', $('#age_category').value],
      ['Номинация', $('#nomination').value + ($('#subgroup').value ? ' · ' + $('#subgroup').value : '')],
      ['Форма исполнения', $('#formation').value],
      ['Название номера', $('#work_title').value],
      ['Электронная почта', $('#email').value],
      ['Телефон', $('#phone').value]
    ];
    box.innerHTML = rows.filter(function (r) { return r[1]; }).map(function (r) {
      return '<div class="row"><span>' + r[0] + '</span><span>' + escapeHtml(r[1]) + '</span></div>';
    }).join('');
  }
  function escapeHtml(s) {
    return String(s).replace(/[&<>"]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
    });
  }
  function fillPayAmount() {
    var chosen = $$('input[name="competition_ids[]"]:checked');
    var total = 0, paidCount = 0, freeCount = 0;
    chosen.forEach(function(c){
      var p = parseInt(c.getAttribute('data-price'), 10) || 0;
      if (c.getAttribute('data-paid') === '1') { total += p; paidCount++; } else { freeCount++; }
    });
    var el = $('[data-pay-amount]');
    if (el) {
      if (total > 0) {
        var txt = total.toLocaleString('ru-RU') + ' ₽';
        if (paidCount > 1) txt += ' <small style="color:var(--muted);font-weight:400">за ' + paidCount + ' участия</small>';
        if (freeCount > 0) txt += ' <small style="color:var(--muted);font-weight:400"> + ' + freeCount + ' бесплатн.</small>';
        el.innerHTML = txt;
      } else {
        el.textContent = 'по положению';
      }
    }
    // Обновляем счётчик в шапке шага 1
    var totBox = document.getElementById('mzApplyTotal');
    if (totBox) totBox.innerHTML = 'Выбрано: <b>' + chosen.length + '</b> · <b>' + (total>0? total.toLocaleString('ru-RU')+' ₽' : (freeCount>0?'бесплатно':'0 ₽')) + '</b>';
  }

  /* ---------- Согласие: 3 галочки сразу доступны, БЕЗ таймера ---------- */
  function setupConsent() {
    var chosen = $$('input[name="competition_ids[]"]:checked');
    var comp = chosen[0];
    var link = document.getElementById('regLink');
    if (link && comp) link.href = comp.getAttribute('data-reg') || CFG.agreement || '#';
    var reg = $('#agree_reg'), row = $('#agreeRegRow');
    if (reg) { reg.disabled = false; reg.addEventListener('change', refreshConsentBtn); }
    if (row) row.classList.remove('locked');
    $('#agree_pd').addEventListener('change', refreshConsentBtn);
    var arCb = $('#agree_rules');
    if (arCb) arCb.addEventListener('change', refreshConsentBtn);
  }
  function refreshConsentBtn() {
    var ar = $('#agree_rules');
    var ok = $('#agree_reg').checked && $('#agree_pd').checked && (!ar || ar.checked);
    var btn = document.getElementById('consentNext');
    if (btn) btn.disabled = !ok;
    // Кнопки отправки (обе панели)
    $$('[data-submit]').forEach(function (b) { b.disabled = !ok; });
    if (ok) flashFormError('');
  }

  /* ---------- Черновик ---------- */
  function saveDraft() {
    try {
      var data = {};
      $$('input, select, textarea').forEach(function (el) {
        if (!el.name || el.name === '_csrf' || el.name === 'website') return;
        if (el.type === 'radio') { if (el.checked) data[el.name] = el.value; }
        else if (el.type === 'checkbox') { data[el.name] = el.checked ? '1' : ''; }
        else data[el.name] = el.value;
      });
      localStorage.setItem(DRAFT_KEY, JSON.stringify(data));
    } catch (e) {}
  }
  function restoreDraft() {
    var raw;
    try { raw = localStorage.getItem(DRAFT_KEY); } catch (e) { return; }
    if (!raw) return;
    var data; try { data = JSON.parse(raw); } catch (e) { return; }
    var restored = 0;
    for (var name in data) {
      if (!data.hasOwnProperty(name) || !data[name]) continue;
      if (name === 'agree_reg' || name === 'agree_pd') continue; // согласие всегда заново
      var els = $$('[name="' + name + '"]');
      els.forEach(function (el) {
        if (el.type === 'radio') { if (el.value === data[name]) el.checked = true; }
        else if (el.type === 'checkbox') { el.checked = data[name] === '1'; }
        else el.value = data[name];
        restored++;
      });
    }
    // Начатая заявка не пропадает: сообщаем, что продолжаем с места остановки.
    if (restored > 2 && window.toast) {
      setTimeout(function () { window.toast('Черновик заявки восстановлен — продолжайте с места остановки.', 'success'); }, 800);
    }
  }
  function clearDraft() { try { localStorage.removeItem(DRAFT_KEY); } catch (e) {} }

  /* ---------- Отправка ---------- */
  var submitting = false;
  function submit(e) {
    e.preventDefault();
    if (submitting) return;
    if (!validateStep('consent')) { show('consent'); return; }
    // honeypot: если заполнен — тихо прерываем
    if ((form.website && form.website.value)) return;
    submitting = true;
    $$('[data-submit]').forEach(function (b) {
      b.disabled = true;
      b.classList.add('is-loading');
      if (!b.querySelector('.spinner')) {
        var sp = document.createElement('span');
        sp.className = 'spinner';
        sp.setAttribute('aria-hidden', 'true');
        b.insertBefore(sp, b.firstChild);
      }
    });
    flashFormError('');
    var fd = new FormData(form);
    fetch(CFG.apiUrl, { method: 'POST', body: fd, headers: { 'X-Requested-With': 'fetch' } })
      .then(function (r) { return r.json().catch(function () { return {}; }).then(function (d) { return { ok: r.ok, d: d }; }); })
      .then(function (res) {
        var d = res.d || {};
        if (res.ok && (d.ok !== false) && (d.number || d.application_number)) {
          var num = d.number || d.application_number;
          var el = $('[data-app-number]'); if (el) el.textContent = num;
          clearDraft();
          clearSubmitLoading();
          show('done', 'next');
          renderSuccessCheck();
          notify('Заявка отправлена. Номер: ' + num, 'success');
        } else {
          throw new Error(d.message || d.error || 'Не удалось отправить заявку.');
        }
      })
      .catch(function (err) {
        var msg = err.message || 'Сбой отправки. Попробуйте ещё раз.';
        flashFormError(msg);
        notify(msg, 'error');
        submitting = false;
        clearSubmitLoading();
      });
  }
  function clearSubmitLoading() {
    $$('[data-submit]').forEach(function (b) {
      b.disabled = false;
      b.classList.remove('is-loading');
      var sp = b.querySelector('.spinner'); if (sp) sp.parentNode.removeChild(sp);
    });
  }
  // Draw-on SVG-галочка + пружинный scale на экране «done».
  function renderSuccessCheck() {
    var panel = panels['done'];
    if (!panel) return;
    // Предпочитаем штатную иконку .done-ic — рисуем галочку прямо в ней.
    var slot = panel.querySelector('[data-check-slot]') || panel.querySelector('.done-ic') || panel.querySelector('.ap-done-icon') || panel;
    if (slot.querySelector('.check-draw')) return;
    var wrap = document.createElement('div');
    wrap.className = 'check-draw';
    wrap.setAttribute('aria-hidden', 'true');
    wrap.innerHTML =
      '<svg viewBox="0 0 52 52" width="72" height="72" aria-hidden="true">' +
      '<circle class="check-draw-circle" cx="26" cy="26" r="24" fill="none"/>' +
      '<path class="check-draw-mark" fill="none" d="M14 27 l8 8 l16 -18"/>' +
      '</svg>';
    if (slot.classList && slot.classList.contains('done-ic')) {
      // Заменяем статичную иконку анимированной галочкой того же размера.
      slot.innerHTML = '';
      wrap.style.display = 'inline-flex';
      slot.appendChild(wrap);
      var svg = wrap.querySelector('svg');
      if (svg) { svg.setAttribute('width', '48'); svg.setAttribute('height', '48'); }
    } else if (slot === panel) {
      panel.insertBefore(wrap, panel.firstChild);
    } else {
      slot.appendChild(wrap);
    }
    // Пружинный scale-in на контейнере иконки.
    if (!reduceMotion()) {
      var host = (slot.classList && slot.classList.contains('done-ic')) ? slot : wrap;
      host.style.transform = 'scale(.4)';
      host.style.opacity = '0';
      void host.offsetWidth;
      host.style.transition = 'transform .55s cubic-bezier(.2,1.5,.4,1), opacity .3s ease';
      requestAnimationFrame(function () { host.style.transform = 'scale(1)'; host.style.opacity = '1'; });
      setTimeout(function () { host.style.transition = ''; host.style.transform = ''; host.style.opacity = ''; }, 620);
    }
  }

  /* ---------- Слушатели ---------- */
  function bind() {
    $$('[data-next]').forEach(function (b) { b.addEventListener('click', goNext); });
    $$('[data-back]').forEach(function (b) { b.addEventListener('click', goBack); });
    form.addEventListener('submit', submit);

    // Выбор конкурсов → платность (isPaid = true если ЛЮБОЙ выбран платный)
    function recomputePaid(){
      var checked = $$('input[name="competition_ids[]"]:checked');
      isPaid = checked.some(function(c){return c.getAttribute('data-paid')==='1';});
      var first = checked[0];
      var link = document.getElementById('regLink');
      if (link && first) link.href = first.getAttribute('data-reg') || '#';
      renderProgress();
      updateConsentBtnLabel();
      fillPayAmount();
      saveDraft();
    }
    $$('input[name="competition_ids[]"]').forEach(function (r) {
      r.addEventListener('change', recomputePaid);
    });
    // Кнопка «Выбрать все»
    var selAll = document.getElementById('mzApplySelectAll');
    if (selAll) selAll.addEventListener('click', function(){
      var boxes = $$('input[name="competition_ids[]"]');
      var allChecked = boxes.every(function(b){return b.checked;});
      boxes.forEach(function(b){ b.checked = !allChecked; });
      selAll.textContent = allChecked ? 'Выбрать все' : 'Снять выбор';
      recomputePaid();
    });

    // Тип участника
    $$('input[name="is_group"]').forEach(function (r) {
      r.addEventListener('change', function () { applyFormType(); saveDraft(); });
    });

    // Автокоррекция ФИО
    $$('[data-fio]').forEach(function (el) {
      el.addEventListener('blur', function () { el.value = fixFio(el.value); saveDraft(); });
    });
    // Название → ёлочки
    $$('[data-title]').forEach(function (el) {
      el.addEventListener('blur', function () { el.value = fixQuotes(el.value); saveDraft(); });
    });
    // Телефон
    var phone = $('#phone');
    if (phone) {
      phone.addEventListener('input', function () { phone.value = fixPhone(phone.value); });
      phone.addEventListener('focus', function () { if (!phone.value) phone.value = '+7 ('; });
    }
    // Индекс — только цифры
    var idx = $('#postal_index');
    if (idx) idx.addEventListener('input', function () { idx.value = idx.value.replace(/\D/g, '').slice(0, 6); });

    // Номинация → подраздел
    $('#nomination').addEventListener('change', function () { fillSubgroups(); saveDraft(); });

    // Live-проверка платформы
    var vurl = $('#video_url');
    if (vurl) {
      vurl.addEventListener('input', function () {
        var live = $('[data-plat-live]');
        var v = vurl.value.trim();
        if (!v) { live.className = 'plat-live'; live.textContent = ''; $('#video_platform').value = ''; return; }
        var r = checkPlatform(v);
        live.className = 'plat-live ' + (r.state === 'ok' ? 'ok' : 'bad');
        live.textContent = r.msg;
        $('#video_platform').value = r.platform;
        setErr(vurl, r.state !== 'ok');
      });
    }

    // Автоформат + мгновенная проверка при уходе из поля («сразу проверяй»).
    var fnEl = $('#full_name');
    if (fnEl) fnEl.addEventListener('blur', function () {
      var v = fnEl.value.trim(); if (v) fnEl.value = fmtFio(fnEl.value);
      var group = $('input[name="is_group"]:checked').value === '1';
      if (!group && fnEl.value.trim()) setErr(fnEl, !fioIsFull(fnEl.value));
    });
    var gnEl = $('#group_name');
    if (gnEl) gnEl.addEventListener('blur', function () { if (gnEl.value.trim()) gnEl.value = quoteCollective(gnEl.value); });
    var wtEl = $('#work_title');
    if (wtEl) wtEl.addEventListener('blur', function () { if (wtEl.value.trim()) wtEl.value = quoteTitle(wtEl.value); });
    var emEl = $('#email');
    if (emEl) emEl.addEventListener('blur', function () { if (emEl.value.trim()) setErr(emEl, !emailValid(emEl.value.trim())); });
    var phEl = $('#phone');
    if (phEl) phEl.addEventListener('blur', function () { if (phEl.value.trim()) setErr(phEl, !phoneComplete(phEl.value)); });
    // Город: авто-форматируем в «Страна, г. Город» при уходе из поля и снимаем ошибку.
    var ctEl = $('#city');
    if (ctEl) ctEl.addEventListener('blur', function () {
      var v = ctEl.value.trim();
      if (v) { ctEl.value = formatCity(v); setErr(ctEl, !ctEl.value.trim()); saveDraft(); }
    });
    // Обязательные селекты — снимаем/ставим ошибку сразу при выборе.
    ['#age_category', '#nomination', '#formation', '#subgroup'].forEach(function (sel) {
      var el = $(sel); if (el) el.addEventListener('change', function () { setErr(el, !el.value); });
    });

    // Возраст ↔ категория (birth_date может отсутствовать в форме)
    var bdEl = $('#birth_date');
    if (bdEl) bdEl.addEventListener('change', ageHint);
    $('#age_category').addEventListener('change', ageHint);

    // Автосохранение
    $$('input, select, textarea').forEach(function (el) {
      if (el.name === '_csrf' || el.name === 'website') return;
      el.addEventListener('change', saveDraft);
    });
    // Снятие ошибки при вводе
    $$('input, select, textarea').forEach(function (el) {
      el.addEventListener('input', function () { setErr(el, false); });
    });
  }

  /* ---------- Инициализация ---------- */
  injectMotionCss();
  restoreDraft();
  bind();
  // Пересчёт заливки степпера при ресайзе/повороте (адаптив).
  var _rzT;
  window.addEventListener('resize', function () {
    clearTimeout(_rzT);
    _rzT = setTimeout(updateProgressFill, 120);
  });
  setupConsent();
  applyFormType();
  fillSubgroups();
  // Платность по восстановленным/предвыбранным конкурсам (ЛЮБОЙ платный → isPaid=true)
  var preAll = $$('input[name="competition_ids[]"]:checked');
  isPaid = preAll.some(function(c){return c.getAttribute('data-paid')==='1';});
  fillPayAmount();
  refreshConsentBtn();
  renderProgress();
})();
