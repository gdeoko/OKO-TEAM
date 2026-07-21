/* КЦ «Музыкальный Мир» — умная форма заявки. Vanilla JS, без библиотек. */
(function () {
  'use strict';
  var CFG = window.APPLY_CONFIG || {};
  var form = document.getElementById('applyForm');
  if (!form) return;

  var $ = function (s, c) { return (c || form).querySelector(s); };
  var $$ = function (s, c) { return Array.prototype.slice.call((c || form).querySelectorAll(s)); };
  var DRAFT_KEY = 'muzmir_apply_draft_v1';

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
    var age = ageFromDate($('#birth_date').value);
    var cat = $('#age_category').value;
    if (age === null || !cat) { hint.textContent = ''; hint.style.color = ''; return; }
    var r = categoryRange(cat);
    if (!r) { hint.textContent = 'Возраст участника: ' + age + '.'; hint.style.color = ''; return; }
    if (age < r[0] || age > r[1]) {
      hint.textContent = 'Возраст участника (' + age + ') не совпадает с категорией. Проверьте данные.';
      hint.style.color = 'var(--error)';
    } else {
      hint.textContent = 'Возраст участника: ' + age + '. Категория подходит.';
      hint.style.color = '#3f7a4a';
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
      if (key === 'pay' && !isPaid) { node.style.display = 'none'; return; }
      node.style.display = '';
      if (current === 'done') { node.classList.add('done'); return; }
      var idx = steps.indexOf(key);
      if (key === cur) node.classList.add('active');
      else if (idx !== -1 && curIdx !== -1 && idx < curIdx) node.classList.add('done');
    });
  }
  function show(step) {
    current = step;
    for (var k in panels) if (panels.hasOwnProperty(k)) panels[k].classList.remove('active');
    if (panels[step]) panels[step].classList.add('active');
    // Кнопка отправки для бесплатного конкурса живёт в отдельной панели.
    if (step === 'consent' && !isPaid) {
      // после согласия у бесплатного — сразу submit-free
    }
    renderProgress();
    if (step === 'consent') buildSummary();
    if (step === 'pay') fillPayAmount();
    var top = form.getBoundingClientRect().top + window.pageYOffset - 90;
    window.scrollTo({ top: top, behavior: 'smooth' });
  }
  function goNext() {
    if (!validateStep(current)) return;
    var steps = activeSteps();
    var idx = steps.indexOf(current);
    if (current === 'consent' && !isPaid) { show('submit-free'); return; }
    if (idx !== -1 && idx < steps.length - 1) show(steps[idx + 1]);
  }
  function goBack() {
    if (current === 'submit-free') { show('consent'); return; }
    var steps = activeSteps();
    var idx = steps.indexOf(current);
    if (idx > 0) show(steps[idx - 1]);
  }

  /* ---------- Валидация шага ---------- */
  function markRequired(input, ok) { setErr(input, !ok); return ok; }
  function validateStep(step) {
    var ok = true;
    if (step === 'comp') {
      var chosen = $('input[name="competition_id"]:checked');
      if (!chosen) { flashFormError('Выберите конкурс, чтобы продолжить.'); return false; }
      return true;
    }
    if (step === 'user') {
      var group = $('input[name="is_group"]:checked').value === '1';
      if (group) ok = markRequired($('#group_name'), !!$('#group_name').value.trim()) && ok;
      ok = markRequired($('#full_name'), !!$('#full_name').value.trim()) && ok;
      if (!group) ok = markRequired($('#birth_date'), !!$('#birth_date').value) && ok;
      ok = markRequired($('#age_category'), !!$('#age_category').value) && ok;
    }
    if (step === 'teacher') {
      ok = markRequired($('#city'), !!$('#city').value.trim()) && ok;
    }
    if (step === 'number') {
      ok = markRequired($('#nomination'), !!$('#nomination').value) && ok;
      var subF = $('#subgroupField');
      if (subF.style.display !== 'none') ok = markRequired($('#subgroup'), !!$('#subgroup').value) && ok;
      ok = markRequired($('#formation'), !!$('#formation').value) && ok;
      ok = markRequired($('#work_title'), !!$('#work_title').value.trim()) && ok;
      var vu = $('#video_url').value.trim();
      if (vu) {
        var r = checkPlatform(vu);
        ok = markRequired($('#video_url'), r.state === 'ok') && ok;
      }
    }
    if (step === 'contact') {
      ok = markRequired($('#email'), emailValid($('#email').value.trim())) && ok;
      ok = markRequired($('#phone'), phoneComplete($('#phone').value)) && ok;
    }
    if (step === 'consent') {
      ok = $('#agree_reg').checked && $('#agree_pd').checked;
      if (!ok) flashFormError('Отметьте согласие с положением и обработкой персональных данных.');
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
    var comp = $('input[name="competition_id"]:checked');
    var group = $('input[name="is_group"]:checked').value === '1';
    var rows = [
      ['Конкурс', comp ? comp.getAttribute('data-name') : '-'],
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
    var comp = $('input[name="competition_id"]:checked');
    var price = comp ? parseInt(comp.getAttribute('data-price'), 10) || 0 : 0;
    var el = $('[data-pay-amount]');
    if (el) el.textContent = price ? price.toLocaleString('ru-RU') + ' ₽' : 'по положению';
  }

  /* ---------- Согласие: положение + таймер 15 сек ---------- */
  var timerStarted = false;
  function setupConsent() {
    var comp = $('input[name="competition_id"]:checked');
    var link = document.getElementById('regLink');
    if (link && comp) link.href = comp.getAttribute('data-reg') || CFG.agreement || '#';
    if (link) link.addEventListener('click', startConsentTimer);
    $('#agree_reg').addEventListener('change', refreshConsentBtn);
    $('#agree_pd').addEventListener('change', refreshConsentBtn);
  }
  function startConsentTimer() {
    if (timerStarted) return;
    timerStarted = true;
    var left = (CFG.consentDelay || 15);
    var badge = $('[data-timer]');
    var cb = $('#agree_reg'), row = $('#agreeRegRow');
    var iv = setInterval(function () {
      left--;
      if (badge) badge.textContent = left;
      if (left <= 0) {
        clearInterval(iv);
        cb.disabled = false;
        row.classList.remove('locked');
        if (badge) badge.textContent = '0';
        var note = document.querySelector('.consent-note');
        if (note) note.innerHTML = 'Спасибо. Теперь отметьте согласие с условиями положения.';
      }
    }, 1000);
  }
  function refreshConsentBtn() {
    var ok = $('#agree_reg').checked && $('#agree_pd').checked;
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
    for (var name in data) {
      if (!data.hasOwnProperty(name) || !data[name]) continue;
      if (name === 'agree_reg' || name === 'agree_pd') continue; // согласие всегда заново
      var els = $$('[name="' + name + '"]');
      els.forEach(function (el) {
        if (el.type === 'radio') { if (el.value === data[name]) el.checked = true; }
        else if (el.type === 'checkbox') { el.checked = data[name] === '1'; }
        else el.value = data[name];
      });
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
    $$('[data-submit]').forEach(function (b) { b.disabled = true; b.textContent = 'Отправляем...'; });
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
          show('done');
        } else {
          throw new Error(d.message || d.error || 'Не удалось отправить заявку.');
        }
      })
      .catch(function (err) {
        flashFormError(err.message || 'Сбой отправки. Попробуйте ещё раз.');
        submitting = false;
        $$('[data-submit]').forEach(function (b) { b.disabled = false; b.textContent = 'Отправить заявку'; });
      });
  }

  /* ---------- Слушатели ---------- */
  function bind() {
    $$('[data-next]').forEach(function (b) { b.addEventListener('click', goNext); });
    $$('[data-back]').forEach(function (b) { b.addEventListener('click', goBack); });
    form.addEventListener('submit', submit);

    // Выбор конкурса → платность
    $$('input[name="competition_id"]').forEach(function (r) {
      r.addEventListener('change', function () {
        isPaid = r.getAttribute('data-paid') === '1';
        var link = document.getElementById('regLink');
        if (link) link.href = r.getAttribute('data-reg') || '#';
        renderProgress();
        saveDraft();
      });
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

    // Возраст ↔ категория
    $('#birth_date').addEventListener('change', ageHint);
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
  restoreDraft();
  bind();
  setupConsent();
  applyFormType();
  fillSubgroups();
  // платность по восстановленному/предвыбранному конкурсу
  var pre = $('input[name="competition_id"]:checked');
  if (pre) isPaid = pre.getAttribute('data-paid') === '1';
  refreshConsentBtn();
  renderProgress();
})();
