/* ============================================================================
   OKO · СЛОЙ «НАСТРОЙКИ И БЕЗОПАСНОСТЬ» (oko-settings2.js)
   ----------------------------------------------------------------------------
   Грузится ПОСЛЕ app.js. Ядро не переписывает: переопределяет панели
   ST2_PANELS и часть функций st2*, добавляет свои стили инлайновым <style>.

   Что делает слой:
     1. Честная «Безопасность» владельца: пароль (только флаг «установлен»),
        двухфакторная защита, резервные коды, подтверждённые телефон и почта,
        код-пароль, биометрия, устройства и сессии, выход везде.
     2. ПАРОЛЬ НИГДЕ НЕ ХРАНИТСЯ. Ни в коде, ни в localStorage, ни в разметке.
        Поле пароля живёт только внутри обработчика и стирается сразу после.
        Код-пароль (PIN) тоже не хранится — только соль и хеш.
        TOTP-секрет 2FA не персистится вовсе: показали один раз и забыли.
     3. Ноль демо-данных: размер хранилища, сессии и контакты — только реальные
        (navigator.storage, navigator.userAgent, PROFILE).
     4. Ноль ложных подтверждений: если действие требует сервера — так и
        написано, кнопка не изображает работу.
     5. Вёрстка: безопасные зоны через var(--oko-safe-*), заголовки в две
        строки, текст не рвётся посреди слова, из любого экрана есть выход.
   ============================================================================ */
(function () {
  'use strict';

  /* Ядро ещё не готово (или файл подключили в другой сборке) — тихо выходим. */
  if (typeof ST2 === 'undefined' || typeof ST2_PANELS === 'undefined') return;

  var W = window;
  var P = (typeof PROFILE !== 'undefined') ? PROFILE : null;

  /* ==========================================================================
     0. МЕЛКИЕ УТИЛИТЫ
     ========================================================================== */

  function s2Esc(t) { return (typeof esc === 'function') ? esc(t) : String(t == null ? '' : t); }
  function s2Ico(n) { return (typeof I === 'function') ? I(n) : ''; }
  function s2Toast(t) { if (typeof toast === 'function') toast(t); }
  function s2Save() { if (typeof st2Save === 'function') st2Save(); }
  function s2Rerender() { if (typeof st2Render === 'function') st2Render(); }

  /* Переключатель. Ядро уже умеет .switch — используем его разметку. */
  function s2Sw(on) { return '<span class="switch' + (on ? ' on' : '') + '"><i></i></span>'; }

  /* Строка-статус: зелёный чип «готово» или нейтральный «нужно настроить». */
  function s2Chip(on, textOn, textOff) {
    return '<span class="chip st2-chip' + (on ? ' st2-chip-on' : '') + '">' +
      (on ? s2Ico('check') + ' ' + s2Esc(textOn) : s2Esc(textOff)) + '</span>';
  }

  /* Пояснение «что будет дальше» — честная подпись под группой. */
  function s2Note(html, kind) {
    return '<div class="s2-note' + (kind ? ' s2-note-' + kind : '') + '">' +
      s2Ico(kind === 'warn' ? 'warning' : 'info') + '<span>' + html + '</span></div>';
  }

  /* Красная кнопка в текущем попапе (ядро рисует кнопки без модификатора). */
  function s2PopDanger(idx) {
    var b = document.querySelector('#okoPopup [data-pa="' + (idx == null ? 1 : idx) + '"]');
    if (b) b.classList.add('st2-btn-danger');
  }

  /* Криптостойкая случайность там, где она есть; иначе — Math.random. */
  function s2Rand(n) {
    var out = new Uint8Array(n);
    if (W.crypto && W.crypto.getRandomValues) W.crypto.getRandomValues(out);
    else for (var i = 0; i < n; i++) out[i] = Math.floor(Math.random() * 256);
    return out;
  }
  function s2Hex(bytes) {
    var s = '';
    for (var i = 0; i < bytes.length; i++) s += ('0' + bytes[i].toString(16)).slice(-2);
    return s;
  }

  /* Хеш кода-пароля. SHA-256, если доступен; иначе — детерминированный
     запасной вариант. В обоих случаях сам код НЕ сохраняется. */
  function s2Hash(text, salt, cb) {
    var data = String(salt) + '|' + String(text);
    if (W.crypto && W.crypto.subtle && W.TextEncoder) {
      try {
        W.crypto.subtle.digest('SHA-256', new TextEncoder().encode(data))
          .then(function (buf) { cb(s2Hex(new Uint8Array(buf))); })
          .catch(function () { cb(s2FallbackHash(data)); });
        return;
      } catch (e) { /* провалимся в запасной вариант */ }
    }
    cb(s2FallbackHash(data));
  }
  function s2FallbackHash(s) {
    var h1 = 0x811c9dc5, h2 = 0x01000193;
    for (var i = 0; i < s.length; i++) {
      h1 = ((h1 ^ s.charCodeAt(i)) * 16777619) >>> 0;
      h2 = ((h2 + s.charCodeAt(i) * (i + 7)) * 2654435761) >>> 0;
    }
    return ('00000000' + h1.toString(16)).slice(-8) + ('00000000' + h2.toString(16)).slice(-8);
  }

  /* ==========================================================================
     1. СТИЛИ СЛОЯ (единственный инлайновый <style>)
     ========================================================================== */

  var CSS = [
    /* --- безопасные зоны: только через переменные OKO --- */
    '#st2View{box-sizing:border-box;padding-bottom:var(--oko-safe-bottom,0px)}',
    '#st2View .sv-head{padding-top:max(var(--oko-safe-top,0px),10px);',
    '  padding-left:max(var(--oko-safe-left,0px),14px);padding-right:max(var(--oko-safe-right,0px),14px);',
    '  gap:8px;min-height:52px}',
    /* Заголовок панели: до двух строк, кегль подстраивается, переносы по словам */
    '#st2View .sv-head>b{flex:1 1 auto;min-width:0;font-size:clamp(14px,4.1vw,18px);line-height:1.2;',
    '  white-space:normal;word-break:normal;overflow-wrap:break-word;hyphens:none;-webkit-hyphens:none;',
    '  display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;text-align:center}',
    '#st2View .sv-head>button,#st2View .sv-head>span{flex:0 0 auto}',
    '.st2-panel{padding-left:max(var(--oko-safe-left,0px),18px);',
    '  padding-right:max(var(--oko-safe-right,0px),18px);',
    '  padding-bottom:calc(40px + var(--oko-safe-bottom,0px))}',
    /* Текст в настройках не рвётся посреди слова (кроме .oko-breakable) */
    '#st2View,#st2View *{word-break:normal;overflow-wrap:break-word;hyphens:none;-webkit-hyphens:none}',
    '#st2View .oko-breakable{word-break:break-all}',
    '#okoPopup .s2-mono{word-break:normal;overflow-wrap:anywhere}',

    /* --- сводка защиты --- */
    '.s2-sec-hero{display:flex;gap:14px;align-items:center;background:var(--surface);border:1px solid var(--border);',
    '  border-radius:var(--r-lg);padding:15px 16px;margin-bottom:18px}',
    '.s2-sec-ring{width:58px;height:58px;flex:none;position:relative}',
    '.s2-sec-ring svg{width:58px;height:58px;display:block;transform:rotate(-90deg)}',
    '.s2-sec-ring circle{fill:none;stroke-width:6;stroke-linecap:round}',
    '.s2-sec-ring .bg{stroke:var(--raised)}',
    '.s2-sec-ring .fg{stroke:var(--accent);transition:stroke-dasharray .5s cubic-bezier(.3,1,.4,1)}',
    '.s2-sec-ring b{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;',
    '  font-family:var(--font-display);font-size:15px;color:var(--accent);letter-spacing:.02em}',
    '.s2-sec-hero-b{flex:1;min-width:0}',
    '.s2-sec-hero-b h4{font-family:var(--font-display);font-size:17px;letter-spacing:.04em;margin:0 0 4px;line-height:1.15}',
    '.s2-sec-hero-b p{margin:0;font-size:12px;color:var(--dim);line-height:1.5}',

    /* --- честная подпись-примечание --- */
    '.s2-note{display:flex;gap:8px;align-items:flex-start;font-size:11.5px;line-height:1.55;color:var(--dim);',
    '  background:color-mix(in srgb,var(--accent) 5%,transparent);border:1px solid var(--border);',
    '  border-radius:var(--r-md);padding:10px 12px;margin:8px 2px 0}',
    '.s2-note svg.i{width:14px;height:14px;flex:none;margin-top:1px;color:var(--accent)}',
    '.s2-note b{color:var(--text)}',
    '.s2-note-warn{background:color-mix(in srgb,var(--danger) 8%,transparent)}',
    '.s2-note-warn svg.i{color:var(--danger)}',

    /* --- строка с двумя строками текста внутри .prow --- */
    '.s2-row2{display:flex;align-items:center;gap:12px;width:100%;text-align:left}',
    '.s2-row2 .s2-row2-b{flex:1;min-width:0}',
    '.s2-row2 .s2-row2-b b{display:block;font-size:14px;font-weight:600;line-height:1.25}',
    '.s2-row2 .s2-row2-b small{display:block;color:var(--dim);font-size:11.5px;margin-top:3px;line-height:1.45;white-space:normal}',
    '.s2-row2>svg.i{flex:none;width:18px;height:18px;color:var(--accent)}',
    '.s2-row2 .switch,.s2-row2 .chev,.s2-row2 .chip{flex:none}',
    '#st2View .prow.s2-prow{align-items:flex-start;padding-top:12px;padding-bottom:12px;height:auto;min-height:0}',
    '#st2View .prow.s2-prow[disabled]{opacity:.55;cursor:default}',
    '#st2View .prow.s2-prow[disabled]:hover{background:none;transform:none}',

    /* --- карточка устройства/сессии --- */
    '.s2-dev{display:flex;gap:12px;align-items:flex-start;padding:13px 2px;border-bottom:1px solid var(--border)}',
    '.s2-dev:last-child{border-bottom:none}',
    '.s2-dev-ic{width:34px;height:34px;flex:none;border-radius:10px;background:var(--raised);border:1px solid var(--border);',
    '  display:flex;align-items:center;justify-content:center}',
    '.s2-dev-ic svg.i{width:17px;height:17px;color:var(--accent)}',
    '.s2-dev-b{flex:1;min-width:0}',
    '.s2-dev-b b{display:block;font-size:14px;font-weight:600;line-height:1.25}',
    '.s2-dev-b small{display:block;color:var(--dim);font-size:11.5px;margin-top:3px;line-height:1.5;white-space:normal}',
    '.s2-dot{display:inline-block;width:7px;height:7px;border-radius:50%;background:var(--accent);margin-right:7px;',
    '  vertical-align:1px;box-shadow:0 0 8px rgba(154,255,0,.7)}',

    /* --- резервные коды --- */
    '.s2-codes{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px;margin:4px 0 2px}',
    '.s2-code{font-family:ui-monospace,Menlo,Consolas,monospace;font-size:13px;letter-spacing:.08em;',
    '  background:var(--raised);border:1px dashed color-mix(in srgb,var(--accent) 40%,var(--border));',
    '  border-radius:10px;padding:9px 4px;text-align:center;color:var(--accent)}',
    '@media(max-width:359px){.s2-codes{grid-template-columns:1fr}}',

    /* --- индикатор надёжности пароля --- */
    '.s2-pw-bar{height:6px;border-radius:99px;background:var(--raised);overflow:hidden;margin:10px 0 6px}',
    '.s2-pw-bar i{display:block;height:100%;width:0;border-radius:99px;background:var(--danger);',
    '  transition:width .25s ease,background .25s ease}',
    '.s2-pw-hint{font-size:11.5px;color:var(--dim);line-height:1.5;text-align:left}',
    '#okoPopup .s2-pw-save{margin-top:14px;width:100%}',
    '.s2-pw-lab{display:block;font-size:11px;letter-spacing:.08em;text-transform:uppercase;color:var(--dim);',
    '  margin:12px 2px 6px;font-family:var(--font-display)}',
    '.s2-pw-lab:first-child{margin-top:0}',

    /* --- список «что работает / что на сервере» --- */
    '.s2-facts{display:flex;flex-direction:column;gap:2px;padding:4px 2px}',
    '.s2-fact{display:flex;gap:10px;align-items:flex-start;padding:9px 4px;border-bottom:1px solid var(--border);',
    '  font-size:12.5px;line-height:1.5}',
    '.s2-fact:last-child{border-bottom:none}',
    '.s2-fact svg.i{width:15px;height:15px;flex:none;margin-top:2px}',
    '.s2-fact-yes svg.i{color:var(--accent)}',
    '.s2-fact-no svg.i{color:var(--dim)}',
    '.s2-fact b{display:block;font-weight:600}',
    '.s2-fact span{color:var(--dim)}',

    /* --- строка «ключ-значение» в «О приложении» --- */
    '.s2-kv{display:flex;gap:10px;align-items:baseline;padding:9px 4px;border-bottom:1px solid var(--border);font-size:12.5px}',
    '.s2-kv:last-child{border-bottom:none}',
    '.s2-kv i{font-style:normal;color:var(--dim);flex:none}',
    '.s2-kv b{margin-left:auto;font-weight:600;text-align:right;min-width:0;overflow-wrap:anywhere}',

    /* --- экспорт --- */
    '.s2-exp{display:flex;gap:12px;align-items:flex-start;width:100%;text-align:left}',
    '.s2-exp-b{flex:1;min-width:0}',

    /* --- широкая опасная кнопка --- */
    '.s2-danger-btn{display:block;width:100%;margin:10px 0 2px;padding:13px 14px;border-radius:var(--r-md);',
    '  background:color-mix(in srgb,var(--danger) 12%,transparent);color:var(--danger);',
    '  border:1px solid color-mix(in srgb,var(--danger) 45%,var(--border));font:inherit;font-weight:700;',
    '  font-size:13.5px;cursor:pointer;transition:background .2s,transform .12s;line-height:1.35}',
    '.s2-danger-btn:hover{background:color-mix(in srgb,var(--danger) 20%,transparent)}',
    '.s2-danger-btn:active{transform:scale(.985)}',

    /* --- адаптив --- */
    '@media(max-width:379px){.s2-sec-hero{gap:11px;padding:13px 13px}',
    '  .s2-sec-hero-b h4{font-size:15.5px}.s2-sec-ring,.s2-sec-ring svg{width:50px;height:50px}}',
    '@media(min-width:1100px){.st2-panel-inner{max-width:720px}}'
  ].join('\n');

  (function injectCss() {
    if (document.getElementById('oko-settings2-css')) return;
    var st = document.createElement('style');
    st.id = 'oko-settings2-css';
    st.textContent = CSS;
    document.head.appendChild(st);
  })();

  /* ==========================================================================
     2. ЧИСТКА СЕКРЕТОВ + СИД ИЗ PROFILE
     ========================================================================== */

  /* Старые сборки клали PIN и TOTP-секрет в localStorage открытым текстом.
     Здесь их безусловно вычищаем: PIN превращаем в соль+хеш, секрет 2FA
     удаляем (он одноразовый и должен жить только на сервере). */
  function s2PurgeSecrets() {
    var dirty = false;
    var sec = ST2.sec;
    if (sec.pin != null) {
      var oldPin = String(sec.pin);
      delete sec.pin;
      dirty = true;
      if (!sec.pinHash) {
        var salt = s2Hex(s2Rand(8));
        s2Hash(oldPin, salt, function (h) {
          ST2.sec.pinSalt = salt; ST2.sec.pinHash = h; s2Save();
        });
      }
    }
    if (sec.secret != null) { delete sec.secret; dirty = true; }
    /* На всякий случай — если кто-то когда-то положил сам пароль. */
    ['password', 'pass', 'pwd'].forEach(function (k) {
      if (typeof sec[k] === 'string') { delete sec[k]; dirty = true; }
    });
    if (dirty) s2Save();
  }

  /* Контакты и флаги защиты берём из PROFILE один раз: демо-телефон
     «+7 999 123-45-67» из дефолтов ядра при этом затирается. */
  function s2SeedFromProfile() {
    var sec = ST2.sec;
    if (sec.seeded) return;
    var ps = (P && P.security) || {};
    sec.pwSet = ps.password !== false;
    sec.twofa = !!ps.twoFA;
    sec.emailVerified = !!ps.emailVerified;
    sec.phoneVerified = !!ps.phoneVerified;
    if (P && P.email) ST2.email = P.email;
    if (P && P.phone) ST2.phone = P.phone;
    sec.seeded = 1;
    s2Save();
  }

  s2PurgeSecrets();
  s2SeedFromProfile();

  /* ==========================================================================
     3. РЕАЛЬНЫЕ ДАННЫЕ: ХРАНИЛИЩЕ И ТЕКУЩЕЕ УСТРОЙСТВО
     ========================================================================== */

  /* Сколько байт занимает localStorage (UTF-16 → 2 байта на символ). */
  function s2LsBytes() {
    var n = 0;
    try {
      for (var i = 0; i < localStorage.length; i++) {
        var k = localStorage.key(i);
        n += (k.length + (localStorage.getItem(k) || '').length) * 2;
      }
    } catch (e) { }
    return n;
  }

  /* Замер реального хранилища. Никаких выдуманных «217 МБ». */
  var S2_STORE = { ls: 0, total: 0, quota: 0, exact: false, ready: false };
  function s2StorageRefresh(cb) {
    var ls = s2LsBytes();
    function done(total, quota, exact) {
      S2_STORE = { ls: ls, total: Math.max(total, ls), quota: quota || 0, exact: !!exact, ready: true };
      if (cb) cb(S2_STORE);
    }
    if (navigator.storage && navigator.storage.estimate) {
      try {
        navigator.storage.estimate().then(function (e) {
          done(e && e.usage ? e.usage : ls, e && e.quota ? e.quota : 0, true);
        }).catch(function () { done(ls, 0, false); });
        return;
      } catch (e) { }
    }
    done(ls, 0, false);
  }
  s2StorageRefresh();

  function s2Mb(bytes) { return bytes / 1048576; }
  function s2FmtSize(bytes) {
    if (bytes >= 1048576) return (bytes / 1048576).toFixed(1) + ' МБ';
    if (bytes >= 1024) return (bytes / 1024).toFixed(0) + ' КБ';
    return bytes + ' Б';
  }

  /* Размер «кэша» для сводок ядра — теперь настоящий, в мегабайтах. */
  W.st2CacheSize = function () {
    if (!S2_STORE.ready) s2StorageRefresh();
    return s2Mb(S2_STORE.total || s2LsBytes());
  };
  W.st2DataSum = function () {
    return S2_STORE.ready ? s2FmtSize(S2_STORE.total) : 'считаем…';
  };

  /* Реальные доли хранилища. Ничего не придумываем: что не смогли
     атрибутировать — так и называем «прочее хранилище браузера». */
  W.st2StorageParts = function () {
    var ls = S2_STORE.ls || s2LsBytes();
    var total = Math.max(S2_STORE.total || ls, ls);
    var rest = Math.max(0, total - ls);
    var parts = [{ v: s2Mb(ls), label: 'Настройки и данные приложения', color: '#9AFF00' }];
    if (rest > 0) parts.push({ v: s2Mb(rest), label: 'Кэш офлайн-режима и медиа', color: '#5CD3F4' });
    return parts;
  };

  /* Текущее устройство — единственная сессия, которую видно без сервера. */
  function s2AppKind() {
    var tg = W.Telegram && W.Telegram.WebApp && W.Telegram.WebApp.initData;
    if (tg) return 'OKO в Telegram';
    if (W.matchMedia && W.matchMedia('(display-mode: standalone)').matches) return 'OKO как приложение (PWA)';
    return 'OKO в браузере';
  }
  function s2CurrentSession() {
    return {
      id: 'this-device',
      cur: true,
      dev: (typeof st2Device === 'function') ? st2Device() : 'Это устройство',
      app: s2AppKind(),
      mob: /Android|iPhone|iPad|iPod/i.test(navigator.userAgent || ''),
      geo: null
    };
  }
  /* Живые сессии = текущее устройство + всё, что когда-нибудь придёт с сервера. */
  W.st2Alive = function () {
    var remote = [];
    try {
      remote = ST2_SES.filter(function (s) { return !s.cur && ST2.killed.indexOf(s.id) < 0; });
    } catch (e) { }
    return [s2CurrentSession()].concat(remote);
  };

  /* ==========================================================================
     4. ДОСТУПНОСТЬ БИОМЕТРИИ (проверяем реально, не декларативно)
     ========================================================================== */

  var S2_BIO = { checked: false, ok: false };
  function s2BioCheck() {
    if (S2_BIO.checked) return;
    S2_BIO.checked = true;
    if (!(W.PublicKeyCredential && W.PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable)) {
      S2_BIO.ok = false;
      return;
    }
    try {
      W.PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable().then(function (v) {
        S2_BIO.ok = !!v;
        var open = document.getElementById('st2View');
        if (open && open.classList.contains('open') &&
          typeof st2CurPanel === 'function' && st2CurPanel() && st2CurPanel().id === 'security') s2Rerender();
      }).catch(function () { S2_BIO.ok = false; });
    } catch (e) { S2_BIO.ok = false; }
  }
  s2BioCheck();

  /* ==========================================================================
     5. ПАНЕЛЬ «БЕЗОПАСНОСТЬ»
     ========================================================================== */

  /* Оценка защищённости: считаем ровно то, что реально включено. */
  function s2SecScore() {
    var sec = ST2.sec, n = 0, all = 5;
    if (sec.pwSet) n++;
    if (sec.twofa) n++;
    if (sec.emailVerified) n++;
    if (sec.phoneVerified) n++;
    if (sec.passcode) n++;
    return { n: n, all: all, pct: Math.round(n / all * 100) };
  }
  function s2SecHero() {
    var s = s2SecScore();
    var C = 2 * Math.PI * 25;
    var dash = (s.pct / 100 * C).toFixed(1);
    var txt = s.n === s.all
      ? 'Все базовые меры включены. Осталось держать резервные коды в надёжном месте.'
      : 'Включено ' + s.n + ' из ' + s.all + ' базовых мер защиты. Ниже видно, что ещё стоит настроить.';
    return '<div class="s2-sec-hero">' +
      '<div class="s2-sec-ring"><svg viewBox="0 0 58 58" aria-hidden="true">' +
      '<circle class="bg" cx="29" cy="29" r="25"/>' +
      '<circle class="fg" cx="29" cy="29" r="25" stroke-dasharray="' + dash + ' ' + (C - dash).toFixed(1) + '"/>' +
      '</svg><b>' + s.n + '/' + s.all + '</b></div>' +
      '<div class="s2-sec-hero-b"><h4>Защита аккаунта</h4><p>' + s2Esc(txt) + '</p></div></div>';
  }

  /* Строка на две строки текста: заголовок + честное пояснение. */
  function s2Row(o) {
    /* o: {ico,title,sub,right,onclick,disabled,chev} */
    var tag = o.onclick && !o.disabled ? 'button' : 'div';
    var attrs = 'class="prow s2-prow"' + (o.disabled ? ' disabled' : '');
    if (o.onclick && !o.disabled) attrs += ' onclick="' + o.onclick + '"';
    else if (tag === 'div') attrs += ' style="cursor:default"';
    return '<' + tag + ' ' + attrs + '><span class="s2-row2">' +
      s2Ico(o.ico) +
      '<span class="s2-row2-b"><b>' + s2Esc(o.title) + '</b>' +
      (o.sub ? '<small>' + o.sub + '</small>' : '') + '</span>' +
      (o.right || '') +
      (o.chev ? '<span class="chev">' + s2Ico('chev') + '</span>' : '') +
      '</span></' + tag + '>';
  }

  ST2_PANELS.security = {
    title: 'Безопасность',
    render: function () {
      var sec = ST2.sec;
      var alive = st2Alive();
      var lockLabels = { now: 'Сразу', '1m': '1 мин', '5m': '5 мин', '1h': '1 час' };
      var lockCur = sec.autolock || '5m';

      var pwSub = sec.pwSet
        ? 'Пароль задан. Само значение нигде в приложении не хранится и не показывается — проверяет и меняет его только сервер.'
        : 'Пароль ещё не задан. Задать его можно на стороне сервера — здесь только показываем состояние.';

      var bioSub = !S2_BIO.checked || S2_BIO.ok
        ? 'Устройство поддерживает Face ID или отпечаток. Пока это только предпочтение: ключ регистрируется на сервере, приложение биометрию при входе ещё не спрашивает.'
        : 'Это устройство не сообщает о встроенном сканере лица или отпечатка — включить нечего.';

      return '' +
        s2SecHero() +

        /* ---- пароль ---- */
        '<div class="st2-panel-sec"><div class="st2-panel-h">' + s2Ico('st2-key') + ' Пароль</div>' +
        '<div class="st2-grp">' +
        s2Row({
          ico: 'st2-key', title: 'Пароль от аккаунта', sub: s2Esc(pwSub),
          right: s2Chip(!!sec.pwSet, 'установлен', 'не задан')
        }) +
        s2Row({
          ico: 'edit', title: 'Изменить пароль',
          sub: 'Откроем форму: текущий пароль, новый и повтор. Сохранение выполняет сервер.',
          onclick: 'st2ChangePass()', chev: true
        }) +
        '</div>' +
        s2Note('<b>Как устроено.</b> Приложение не знает и не может узнать ваш пароль: он не лежит ни в коде, ни в памяти устройства, ни в этой странице. Хранится только отметка «пароль установлен».') +
        '</div>' +

        /* ---- двухфакторная защита ---- */
        '<div class="st2-panel-sec"><div class="st2-panel-h">' + s2Ico('st2-shield') + ' Двухфакторная защита</div>' +
        '<div class="st2-grp">' +
        s2Row({
          ico: 'st2-shield', title: 'Вход с одноразовым кодом',
          sub: sec.twofa
            ? 'При входе, кроме пароля, спрашивается 6-значный код из приложения-аутентификатора.'
            : 'Второй фактор выключен. Аккаунт защищён только паролем.',
          right: s2Chip(!!sec.twofa, 'включена', 'выключена'), onclick: 'st2TwoFA()', chev: true
        }) +
        s2Row({
          ico: 'file', title: 'Резервные коды',
          sub: sec.backupAt
            ? 'Последний комплект сгенерирован ' + s2Esc(new Date(sec.backupAt).toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })) + '. Сами коды нигде не сохранены.'
            : 'Десять одноразовых кодов на случай, если аутентификатор недоступен. Показываются один раз и не сохраняются.',
          onclick: 'st2BackupCodes()', chev: true
        }) +
        '</div></div>' +

        /* ---- подтверждённые контакты ---- */
        '<div class="st2-panel-sec"><div class="st2-panel-h">' + s2Ico('st2-mail') + ' Контакты для восстановления</div>' +
        '<div class="st2-grp">' +
        s2Row({
          ico: 'phone', title: 'Телефон', sub: s2Esc(ST2.phone || 'не указан'),
          right: s2Chip(!!sec.phoneVerified, 'подтверждён', 'не подтверждён'),
          onclick: 'st2EditPhone()', chev: true
        }) +
        s2Row({
          ico: 'st2-mail', title: 'Почта', sub: s2Esc(ST2.email || 'не указана'),
          right: s2Chip(!!sec.emailVerified, 'подтверждена', 'не подтверждена'),
          onclick: 'st2EditEmail()', chev: true
        }) +
        '</div>' +
        s2Note('Подтверждение контакта — письмо или SMS от сервера. Пока бэкенд не подключён, изменение сохраняется только на этом устройстве и помечается как неподтверждённое.') +
        '</div>' +

        /* ---- защита самого приложения ---- */
        '<div class="st2-panel-sec"><div class="st2-panel-h">' + s2Ico('lock') + ' Защита приложения на устройстве</div>' +
        '<div class="st2-grp">' +
        s2Row({
          ico: 'lock', title: 'Код-пароль при входе',
          sub: sec.passcode
            ? 'Код задан. В приложении хранится только соль и хеш — сам код восстановить нельзя.'
            : 'Четыре цифры перед открытием приложения на этом устройстве.',
          right: s2Sw(!!sec.passcode), onclick: 'st2Passcode()'
        }) +
        (sec.passcode ? '<div class="prow st2-prow-col" style="cursor:default">' +
          '<span class="st2-prow-lbl">' + s2Ico('st2-clock') + ' Запрашивать код</span>' +
          '<span class="st2-seg st2-seg3" id="st2LockSeg">' +
          Object.keys(lockLabels).map(function (k) {
            return '<button data-v="' + k + '" class="' + (lockCur === k ? 'on' : '') + '" onclick="st2SetAutolock(\'' + k + '\')">' + lockLabels[k] + '</button>';
          }).join('') + '</span></div>' : '') +
        s2Row({
          ico: 'fingerprint', title: 'Вход по биометрии', sub: s2Esc(bioSub),
          right: S2_BIO.ok ? s2Sw(!!sec.bio) : s2Chip(false, '', 'недоступно'),
          onclick: S2_BIO.ok ? 'st2BioTgl(this)' : null,
          disabled: !S2_BIO.ok
        }) +
        '</div></div>' +

        /* ---- устройства ---- */
        '<div class="st2-panel-sec"><div class="st2-panel-h">' + s2Ico('st2-devices') + ' Устройства</div>' +
        '<div class="st2-grp">' +
        s2Row({
          ico: 'st2-devices', title: 'Устройства и сессии',
          sub: alive.length === 1
            ? 'Видно только это устройство: список чужих сессий отдаёт сервер.'
            : 'Активных сессий: ' + alive.length + '.',
          right: '<span class="st2-val">' + alive.length + '</span>',
          onclick: 'st2Push(\'sessions\')', chev: true
        }) +
        '</div></div>';
    },
    after: function () { s2BioCheck(); }
  };

  /* --- биометрия: только предпочтение, честная подпись --- */
  W.st2BioTgl = function (btn) {
    if (!S2_BIO.ok) return;
    ST2.sec.bio = !ST2.sec.bio;
    s2Save();
    var sw = btn && btn.querySelector('.switch');
    if (sw) sw.classList.toggle('on', !!ST2.sec.bio);
    if (typeof showPopup === 'function') {
      showPopup({
        ico: 'fingerprint',
        title: ST2.sec.bio ? 'Биометрия отмечена как желаемая' : 'Биометрия отключена',
        body: ST2.sec.bio
          ? 'Настройка сохранена на этом устройстве. Приложение <b>пока не запрашивает</b> Face ID или отпечаток при входе: чтобы это заработало, ключ устройства нужно зарегистрировать на сервере OKO. Как только бэкенд подключат, вход по биометрии включится с этой отметкой.'
          : 'Предпочтение снято. Ничего больше не изменилось: приложение и раньше не спрашивало биометрию при входе.',
        actions: [{ label: 'Понятно' }]
      });
    }
  };

  /* --- резервные коды: генерируем локально, не сохраняем --- */
  W.st2BackupCodes = function () {
    var codes = [];
    for (var i = 0; i < 10; i++) {
      var b = s2Rand(5), s = '';
      for (var j = 0; j < 5; j++) s += '0123456789ABCDEFGHJKLMNPQRSTUVWXYZ'[b[j] % 34];
      codes.push(s.slice(0, 5) + '-' + s2Hex(s2Rand(2)).toUpperCase());
    }
    var html = '<div class="s2-codes">' +
      codes.map(function (c) { return '<div class="s2-code s2-mono">' + s2Esc(c) + '</div>'; }).join('') + '</div>';
    showPopup({
      ico: 'file', title: 'Резервные коды',
      body: html +
        '<div class="st2-note"><b>Честно:</b> коды сгенерированы прямо здесь, на устройстве, и <b>нигде не сохранены</b> — ни в приложении, ни на сервере. Пока бэкенд 2FA не подключён, войти по ним нельзя: это заготовка, которую сервер должен принять при регистрации второго фактора. Сохраните их только если понимаете этот статус.</div>',
      actions: [
        { label: 'Закрыть', ghost: true },
        {
          label: 'Скачать файлом', onclick: function () {
            var txt = 'OKO · резервные коды двухфакторной защиты\n' +
              'Сгенерированы: ' + new Date().toLocaleString('ru-RU') + '\n' +
              'Аккаунт: @' + (typeof st2Nick === 'function' ? st2Nick() : '') + '\n\n' +
              codes.join('\n') +
              '\n\nКоды созданы на устройстве и не зарегистрированы на сервере OKO.\n' +
              'До подключения бэкенда двухфакторной защиты они не подойдут для входа.\n';
            try {
              var url = URL.createObjectURL(new Blob([txt], { type: 'text/plain;charset=utf-8' }));
              var a = document.createElement('a');
              a.href = url; a.download = 'oko-backup-codes.txt';
              document.body.appendChild(a); a.click(); a.remove();
              setTimeout(function () { URL.revokeObjectURL(url); }, 4000);
              ST2.sec.backupAt = Date.now(); s2Save(); s2Rerender();
              s2Toast('Файл с кодами скачан');
            } catch (e) { s2Toast('Не удалось сформировать файл'); }
          }
        }
      ]
    });
  };

  /* ==========================================================================
     6. СМЕНА ПАРОЛЯ — БЕЗ ХРАНЕНИЯ ЗНАЧЕНИЯ
     ========================================================================== */

  function s2WipePw() {
    var list = document.querySelectorAll('.s2-pw-inp');
    for (var i = 0; i < list.length; i++) { try { list[i].value = ''; } catch (e) { } }
  }
  function s2PwScore(v) {
    var n = 0;
    if (v.length >= 8) n++;
    if (v.length >= 12) n++;
    if (/[a-zа-я]/.test(v) && /[A-ZА-Я]/.test(v)) n++;
    if (/\d/.test(v)) n++;
    if (/[^\w\s]/.test(v)) n++;
    return Math.min(4, n);
  }

  W.st2ChangePass = function () {
    showPopup({
      ico: 'st2-key', title: 'Изменить пароль',
      body:
        '<p style="margin-bottom:4px;font-size:12.5px;line-height:1.55;color:var(--dim)">' +
        'Форма проверяет только формат. Сверить текущий пароль и сохранить новый может исключительно сервер — ' +
        'приложение пароль не видит и не запоминает.</p>' +
        '<span class="s2-pw-lab">Текущий пароль</span>' +
        '<div class="st2-pin"><input class="s2-pw-inp" id="s2PwCur" type="password" autocomplete="current-password" placeholder="Текущий пароль" spellcheck="false"></div>' +
        '<span class="s2-pw-lab">Новый пароль</span>' +
        '<div class="st2-pin"><input class="s2-pw-inp" id="s2PwNew" type="password" autocomplete="new-password" placeholder="Минимум 8 символов" spellcheck="false"></div>' +
        '<div class="s2-pw-bar"><i id="s2PwBar"></i></div>' +
        '<div class="s2-pw-hint" id="s2PwHint">Надёжнее всего — длинная фраза из несвязанных слов.</div>' +
        '<span class="s2-pw-lab">Повторите новый пароль</span>' +
        '<div class="st2-pin"><input class="s2-pw-inp" id="s2PwRep" type="password" autocomplete="new-password" placeholder="Ещё раз" spellcheck="false"></div>' +
        '<div class="st2-perr" id="s2PwErr" style="display:none"></div>' +
        '<button class="btn s2-pw-save" id="s2PwSave" type="button">Сохранить новый пароль</button>',
      actions: [{ label: 'Отмена', ghost: true }]
    });

    var cur = document.getElementById('s2PwCur');
    var nw = document.getElementById('s2PwNew');
    var rep = document.getElementById('s2PwRep');
    var bar = document.getElementById('s2PwBar');
    var hint = document.getElementById('s2PwHint');
    var err = document.getElementById('s2PwErr');
    var save = document.getElementById('s2PwSave');
    var pop = document.getElementById('okoPopup');

    /* Индикатор надёжности читает поле, но нигде значение не оставляет. */
    if (nw && bar) {
      nw.addEventListener('input', function () {
        var sc = s2PwScore(nw.value);
        var colors = ['var(--danger)', '#F2A33C', '#F2D53C', 'var(--accent)', 'var(--accent)'];
        var words = ['Слишком просто', 'Слабый', 'Средний', 'Хороший', 'Отличный'];
        bar.style.width = (sc === 0 ? (nw.value ? 12 : 0) : sc * 25) + '%';
        bar.style.background = colors[sc];
        if (hint) hint.textContent = nw.value ? words[sc] + ' пароль' : 'Надёжнее всего — длинная фраза из несвязанных слов.';
      });
    }
    /* Любой выход из попапа стирает поля до того, как узел открепится. */
    if (pop) {
      pop.addEventListener('pointerdown', function (e) {
        if (e.target === pop || (e.target.closest && e.target.closest('[data-pa]'))) s2WipePw();
      }, true);
    }

    function fail(msg) {
      if (!err) return;
      err.textContent = msg;
      err.style.display = '';
    }
    if (save) {
      save.onclick = function () {
        /* Значения живут только внутри этого вызова. */
        var vCur = cur ? cur.value : '';
        var vNew = nw ? nw.value : '';
        var vRep = rep ? rep.value : '';
        if (!vCur) return fail('Введите текущий пароль');
        if (vNew.length < 8) return fail('Новый пароль короче 8 символов');
        if (vNew === vCur) return fail('Новый пароль совпадает с текущим');
        if (vNew !== vRep) return fail('Повтор не совпадает с новым паролем');
        if (s2PwScore(vNew) < 2) return fail('Слишком простой пароль — добавьте длину, цифры или знаки');
        /* Затираем поля и ссылки до закрытия попапа. */
        vCur = vNew = vRep = '';
        s2WipePw();
        cur = nw = rep = null;
        if (typeof closePopup === 'function') closePopup();
        showPopup({
          ico: 'info', title: 'Формат в порядке — пароль не изменён',
          body: 'Проверка формата пройдена. Но <b>сменить пароль может только сервер</b>: он один хранит его хеш и обязан сверить текущий. ' +
            'Бэкенд смены пароля в этой сборке ещё не подключён, поэтому <b>пароль остался прежним</b>. ' +
            'Введённые значения нигде не сохранены и уже стёрты из памяти формы.',
          actions: [{ label: 'Понятно' }]
        });
      };
    }
    if (rep) rep.addEventListener('keydown', function (e) { if (e.key === 'Enter' && save) save.click(); });
    if (cur) setTimeout(function () { try { cur.focus(); } catch (e) { } }, 60);
  };
  /* Старый сохранятель ядра больше не используется — обезвреживаем. */
  W.st2ChangePassSave = function () { W.st2ChangePass(); };

  /* ==========================================================================
     7. КОД-ПАРОЛЬ: ХРАНИМ СОЛЬ И ХЕШ, НЕ САМ КОД
     ========================================================================== */

  W.st2PinSet2 = function (first, err) {
    st2Prompt({
      ico: 'lock', title: 'Повторите код', err: err, mode: 'num', max: 4,
      note: 'Введите код ещё раз. Само значение не сохраняется — приложение запомнит только его хеш.',
      ph: '4 цифры', saveLabel: 'Включить',
      save: function (v) {
        if (v !== first) return W.st2PinSet2(first, 'Коды не совпадают');
        var salt = s2Hex(s2Rand(8));
        s2Hash(v, salt, function (h) {
          ST2.sec.passcode = true;
          ST2.sec.pinSalt = salt;
          ST2.sec.pinHash = h;
          delete ST2.sec.pin;
          s2Save(); s2Rerender();
          s2Toast('Код-пароль включён');
        });
      }
    });
  };
  W.st2Passcode = function () {
    if (ST2.sec.passcode) {
      showPopup({
        ico: 'lock', title: 'Отключить код-пароль?',
        body: 'Приложение перестанет спрашивать код при открытии на этом устройстве. Сохранённый хеш кода будет удалён.',
        actions: [
          { label: 'Отмена', ghost: true },
          {
            label: 'Отключить', onclick: function () {
              ST2.sec.passcode = false;
              delete ST2.sec.pin; delete ST2.sec.pinHash; delete ST2.sec.pinSalt;
              s2Save(); s2Rerender(); s2Toast('Код-пароль отключён');
            }
          }
        ]
      });
      s2PopDanger(1);
      return;
    }
    st2PinSet1();
  };

  /* --- 2FA: секрет показываем один раз и не сохраняем --- */
  W.st2TwoFA = function () {
    if (ST2.sec.twofa) {
      showPopup({
        ico: 'st2-shield', title: 'Отключить двухфакторную защиту?',
        body: 'Вход снова будет защищён только паролем. Резервные коды перестанут иметь смысл. ' +
          'Отключение фиксируется на устройстве; на сервере второй фактор снимается при следующем входе.',
        actions: [
          { label: 'Отмена', ghost: true },
          {
            label: 'Отключить', onclick: function () {
              ST2.sec.twofa = false;
              delete ST2.sec.secret;
              s2Save(); s2Rerender(); s2Toast('Двухфакторная защита выключена');
            }
          }
        ]
      });
      s2PopDanger(1);
      return;
    }
    var secret = (typeof st2GenSecret === 'function') ? st2GenSecret() : s2Hex(s2Rand(10)).toUpperCase();
    showPopup({
      ico: 'st2-shield', title: 'Двухфакторная защита',
      body: '<p style="margin-bottom:10px;font-size:12.5px;line-height:1.55">Откройте аутентификатор (Google Authenticator, 1Password, Aegis) и добавьте ключ вручную:</p>' +
        '<div class="st2-2fa-key s2-mono">' + s2Esc(secret) + '</div>' +
        '<div class="st2-note"><b>Честно:</b> ключ сгенерирован на устройстве и <b>нигде не сохраняется</b> — ни в приложении, ни в памяти браузера. ' +
        'Сверять коды умеет только сервер, а бэкенд TOTP ещё не подключён. Дальше приложение просто запомнит отметку «второй фактор включён», ' +
        'а настоящая проверка заработает вместе с сервером.',
      actions: [
        { label: 'Отмена', ghost: true },
        { label: 'Ввести код', onclick: function () { st2TwoFACode(); } }
      ]
    });
  };
  W.st2TwoFACode = function (err) {
    st2Prompt({
      ico: 'st2-shield', title: 'Код из аутентификатора', err: err, mode: 'num',
      note: 'Введите 6 цифр. В этой сборке код не сверяется с сервером — сохраняется только отметка «второй фактор включён».',
      ph: '000000', saveLabel: 'Включить',
      save: function (v) {
        if (!/^\d{6}$/.test(v)) return W.st2TwoFACode('Нужно ровно 6 цифр');
        ST2.sec.twofa = true;
        delete ST2.sec.secret;
        s2Save(); s2Rerender();
        s2Toast('Отметка «двухфакторная защита включена» сохранена');
      }
    });
  };

  /* ==========================================================================
     8. КОНТАКТЫ: ЧЕСТНАЯ СМЕНА БЕЗ ОБЕЩАНИЙ
     ========================================================================== */

  W.st2EditEmail = function (err) {
    st2Prompt({
      ico: 'st2-mail', title: 'Почта', err: err,
      note: 'Смена почты в аккаунте и письмо-подтверждение — операции сервера. Здесь адрес меняется только для показа на этом устройстве и помечается как неподтверждённый.',
      val: ST2.email, ph: 'you@example.com',
      save: function (v) {
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v)) return W.st2EditEmail('Похоже, в адресе опечатка');
        var same = v === ST2.email;
        ST2.email = v;
        if (!same) ST2.sec.emailVerified = false;
        s2Save(); s2Rerender();
        showPopup({
          ico: 'st2-mail', title: 'Адрес сохранён на устройстве',
          body: same
            ? 'Адрес не изменился.'
            : 'Новый адрес <b>' + s2Esc(v) + '</b> показывается в приложении, но <b>письмо не отправлено</b>: подтверждение и смену почты в аккаунте выполняет сервер, а бэкенд ещё не подключён. Пока адрес помечен как неподтверждённый.',
          actions: [{ label: 'Понятно' }]
        });
      }
    });
  };
  W.st2EditPhone = function (err) {
    st2Prompt({
      ico: 'phone', title: 'Телефон', err: err,
      note: 'Отправка SMS и привязка номера к аккаунту — операции сервера. Здесь номер меняется только для показа на этом устройстве.',
      val: ST2.phone, ph: '+7 900 000-00-00',
      save: function (v) {
        if (!/^\+?[\d\s()-]{10,18}$/.test(v)) return W.st2EditPhone('Проверьте номер — нужен формат +7 …');
        var same = v === ST2.phone;
        ST2.phone = v;
        if (!same) ST2.sec.phoneVerified = false;
        s2Save(); s2Rerender();
        showPopup({
          ico: 'phone', title: 'Номер сохранён на устройстве',
          body: same
            ? 'Номер не изменился.'
            : 'Номер <b>' + s2Esc(v) + '</b> показывается в приложении, но <b>SMS не отправлено</b>: код подтверждения шлёт сервер, а бэкенд ещё не подключён. Пока номер помечен как неподтверждённый.',
          actions: [{ label: 'Понятно' }]
        });
      }
    });
  };

  /* ==========================================================================
     9. ПАНЕЛЬ «АККАУНТ И ВХОД»
     ========================================================================== */

  ST2_PANELS.account = {
    title: 'Аккаунт и вход',
    render: function () {
      var sec = ST2.sec;
      return '<p class="st2-panel-desc">Контакты для входа и восстановления доступа, привязанные сервисы и состояние защиты.</p>' +

        '<div class="st2-panel-sec"><div class="st2-panel-h">' + s2Ico('st2-mail') + ' Контакты</div>' +
        '<div class="st2-grp">' +
        s2Row({
          ico: 'st2-mail', title: 'Почта', sub: s2Esc(ST2.email || 'не указана'),
          right: s2Chip(!!sec.emailVerified, 'подтверждена', 'не подтверждена'),
          onclick: 'st2EditEmail()', chev: true
        }) +
        s2Row({
          ico: 'phone', title: 'Телефон', sub: s2Esc(ST2.phone || 'не указан'),
          right: s2Chip(!!sec.phoneVerified, 'подтверждён', 'не подтверждён'),
          onclick: 'st2EditPhone()', chev: true
        }) +
        '</div></div>' +

        '<div class="st2-panel-sec"><div class="st2-panel-h">' + s2Ico('st2-link') + ' Привязанные сервисы</div>' +
        '<div class="st2-grp">' +
        s2Row({
          ico: 'send', title: 'Telegram',
          sub: ST2.tg ? s2Esc(ST2.tg) : 'не привязан — вход через @okoappbot',
          onclick: 'st2LinkTg()', chev: true
        }) +
        s2Row({ ico: 'google', title: 'Google', sub: 'не привязан', onclick: 'st2LinkStub(\'Google\')', chev: true }) +
        s2Row({ ico: 'apple', title: 'Apple ID', sub: 'не привязан', onclick: 'st2LinkStub(\'Apple\')', chev: true }) +
        '</div>' +
        s2Note('Вход через Google и Apple включается на сервере (OAuth). Кнопки честно об этом сообщают и ничего не привязывают.') +
        '</div>' +

        '<div class="st2-panel-sec"><div class="st2-panel-h">' + s2Ico('st2-shield') + ' Защита входа</div>' +
        '<div class="st2-grp">' +
        s2Row({
          ico: 'st2-shield', title: 'Безопасность',
          sub: 'Пароль, двухфакторная защита, код-пароль и биометрия.',
          right: '<span class="st2-val">' + s2SecScore().n + '/' + s2SecScore().all + '</span>',
          onclick: 'st2Push(\'security\')', chev: true
        }) +
        s2Row({
          ico: 'st2-devices', title: 'Устройства и сессии',
          sub: 'Где выполнен вход и как выйти отовсюду.',
          onclick: 'st2Push(\'sessions\')', chev: true
        }) +
        '</div></div>';
    }
  };

  /* ==========================================================================
     10. ПАНЕЛЬ «УСТРОЙСТВА И СЕССИИ»
     ========================================================================== */

  function s2DevCard(s) {
    return '<div class="s2-dev">' +
      '<span class="s2-dev-ic">' + s2Ico(s.mob ? 'phone' : 'device') + '</span>' +
      '<div class="s2-dev-b"><b>' + (s.cur ? '<span class="s2-dot"></span>' : '') + s2Esc(s.dev) + '</b>' +
      '<small>' + s2Esc(s.app) + (s.geo ? ' · ' + s2Esc(s.geo) : '') +
      (s.cur ? ' · сейчас активно' : '') + '</small></div>' +
      (s.cur ? '<span class="chip st2-chip st2-chip-on">' + s2Ico('check') + ' это устройство</span>'
        : '<button class="st2-kill" onclick="st2Kill(\'' + s.id + '\')">Завершить</button>') +
      '</div>';
  }

  ST2_PANELS.sessions = {
    title: 'Устройства и сессии',
    render: function () {
      var alive = st2Alive();
      var others = alive.filter(function (s) { return !s.cur; });
      return '<p class="st2-panel-desc">Где выполнен вход в OKO. Незнакомую сессию можно завершить — тогда на том устройстве потребуется войти заново.</p>' +

        '<div class="st2-panel-sec"><div class="st2-panel-h">' + s2Ico('st2-devices') + ' Активные сессии</div>' +
        '<div class="st2-grp">' + alive.map(s2DevCard).join('') + '</div>' +
        (others.length
          ? s2Note('Сессий, кроме текущей: ' + others.length + '.')
          : s2Note('Приложение видит только это устройство. <b>Список чужих сессий отдаёт сервер</b> — пока бэкенд не подключён, показать другие входы неоткуда, и придумывать их мы не станем.')) +
        '</div>' +

        '<div class="st2-panel-sec"><div class="st2-panel-h">' + s2Ico('logout') + ' Завершение сеансов</div>' +
        '<div class="st2-grp">' +
        s2Row({
          ico: 'logout', title: 'Выйти на этом устройстве',
          sub: 'Локальный сеанс закрывается сразу, приложение вернётся на экран входа.',
          onclick: 'st2LogoutAccount()', chev: true
        }) +
        s2Row({
          ico: 'st2-devices', title: 'Выйти со всех устройств',
          sub: 'Отзыв чужих сессий — серверная операция. Что произойдёт и что доступно сейчас — в подтверждении.',
          onclick: 'st2KillAll()', chev: true
        }) +
        '</div></div>' +

        '<div class="st2-panel-sec"><div class="st2-panel-h">' + s2Ico('info') + ' Об этом устройстве</div>' +
        '<div class="st2-grp"><div class="s2-facts">' +
        '<div class="s2-kv"><i>Платформа</i><b>' + s2Esc(navigator.platform || 'неизвестна') + '</b></div>' +
        '<div class="s2-kv"><i>Оболочка</i><b>' + s2Esc(s2AppKind()) + '</b></div>' +
        '<div class="s2-kv"><i>Язык системы</i><b>' + s2Esc(navigator.language || '—') + '</b></div>' +
        '<div class="s2-kv"><i>Сеть</i><b>' + (navigator.onLine ? 'онлайн' : 'офлайн') + '</b></div>' +
        '</div></div></div>';
    }
  };

  /* Выход везде: подтверждение с последствиями + честный итог. */
  W.st2KillAll = function () {
    showPopup({
      ico: 'st2-devices', title: 'Выйти со всех устройств?',
      body: 'Что должно произойти:<br>· все сессии, включая телефоны и веб, закрываются<br>' +
        '· на каждом устройстве потребуется войти заново<br>· push-уведомления на старых устройствах прекращаются<br><br>' +
        '<b>Сейчас доступно не всё.</b> Отзывать чужие сессии умеет только сервер, а бэкенд ещё не подключён. ' +
        'Приложение может честно закрыть <b>текущий сеанс на этом устройстве</b> — и всё.',
      actions: [
        { label: 'Отмена', ghost: true },
        { label: 'Выйти здесь', onclick: function () { if (typeof st2DoLogoutAccount === 'function') st2DoLogoutAccount(); } }
      ]
    });
    s2PopDanger(1);
  };

  /* ==========================================================================
     11. ПАНЕЛЬ «ДАННЫЕ И ПАМЯТЬ» — РЕАЛЬНЫЕ ЦИФРЫ
     ========================================================================== */

  ST2_PANELS.data = {
    title: 'Данные и память',
    render: function () {
      var parts = st2StorageParts();
      var total = S2_STORE.total || S2_STORE.ls;
      var quota = S2_STORE.quota;
      var pct = quota ? Math.min(100, total / quota * 100) : 0;
      return '<p class="st2-panel-desc">Сколько места приложение реально занимает на устройстве, как загружать медиа и когда чистить кэш.</p>' +

        '<div class="st2-storage" id="s2StoreBox">' +
        (typeof st2PieSvg === 'function' ? st2PieSvg(parts) : '') +
        '<div class="st2-pie-legend">' +
        parts.map(function (p) {
          return '<div class="st2-pie-row"><span class="st2-pie-dot" style="background:' + p.color + '"></span>' +
            s2Esc(p.label) + '<b>' + s2FmtSize(p.v * 1048576) + '</b></div>';
        }).join('') +
        (quota ? '<div class="st2-pie-row"><span class="st2-pie-dot" style="background:var(--border)"></span>Доступно браузером<b>' + s2FmtSize(quota) + '</b></div>' : '') +
        '</div></div>' +
        s2Note(S2_STORE.exact
          ? 'Цифры взяты у браузера (Storage API) — это фактический объём, занятый OKO на устройстве' + (quota ? ', занято ' + pct.toFixed(1) + '% доступной квоты' : '') + '.'
          : 'Браузер не сообщает полный объём хранилища, поэтому показан только замеренный размер локальных настроек и данных.') +

        '<div class="st2-panel-sec"><div class="st2-panel-h">' + s2Ico('trash') + ' Очистка</div>' +
        '<div class="st2-grp">' +
        s2Row({
          ico: 'trash', title: 'Очистить кэш офлайн-режима',
          sub: 'Удаляет сохранённые копии страниц и медиа. Настройки, профиль и чаты остаются на месте.',
          right: '<span class="st2-val" id="st2CacheVal">' + s2FmtSize(total) + '</span>',
          onclick: 'st2ClearCache()', chev: true
        }) +
        '<div class="prow st2-prow-col" style="cursor:default">' +
        '<div class="st2-range" style="width:100%">' +
        '<div class="st2-range-h">' + s2Ico('st2-db') + ' Желаемый предел кэша<span class="st2-range-v" id="st2CLV">' + ST2.data.cacheLimit + ' МБ</span></div>' +
        '<input type="range" min="100" max="2000" step="50" value="' + ST2.data.cacheLimit + '" oninput="st2SetCacheLim(this.value)" id="st2CLR" style="--st2-fill:' + ((ST2.data.cacheLimit - 100) / 1900 * 100) + '%">' +
        '<div class="st2-range-ticks"><span>100</span><span>500</span><span>1 ГБ</span><span>2 ГБ</span></div>' +
        '</div></div>' +
        '</div>' +
        s2Note('Предел кэша сохраняется как ваше пожелание. <b>Пока он ни на что не влияет</b>: объёмом кэша управляет сервис-воркер, ограничение подключается вместе с ним.') +
        '</div>' +

        '<div class="st2-panel-sec"><div class="st2-panel-h">' + s2Ico('st2-wifi') + ' Автозагрузка медиа</div>' +
        '<div class="st2-grp">' +
        '<div class="st2-dl-grid">' +
        '<div></div><div class="st2-dl-head">Wi-Fi</div><div class="st2-dl-head">Моб.</div>' +
        [['photos', 'Фото', 'photo'], ['videos', 'Видео', 'play'], ['files', 'Файлы', 'file']].map(function (r) {
          return '<div class="st2-dl-row-h">' + s2Ico(r[2]) + ' ' + r[1] + '</div>' +
            '<span class="switch ' + (ST2.data.autodl.wifi[r[0]] ? 'on' : '') + '" onclick="st2DlTgl(\'wifi\',\'' + r[0] + '\',this)"><i></i></span>' +
            '<span class="switch ' + (ST2.data.autodl.mobile[r[0]] ? 'on' : '') + '" onclick="st2DlTgl(\'mobile\',\'' + r[0] + '\',this)"><i></i></span>';
        }).join('') +
        '</div></div></div>' +

        '<div class="st2-panel-sec"><div class="st2-panel-h">' + s2Ico('file') + ' Загрузка документов</div>' +
        '<div class="st2-grp">' +
        [['always', 'Всегда', 'Скачивать документы сразу'],
        ['ask', 'Спрашивать', 'Показывать кнопку скачивания'],
        ['never', 'Никогда', 'Только по кнопке скачивания']].map(function (o) {
          return '<button class="prow st2-radio ' + (ST2.data.docsPolicy === o[0] ? 'on' : '') + '" onclick="st2SetDocsPolicy(\'' + o[0] + '\')">' +
            '<span class="st2-radio-mark"></span>' +
            '<div class="st2-radio-b"><b>' + o[1] + '</b><small>' + o[2] + '</small></div></button>';
        }).join('') +
        '</div></div>' +

        '<div class="st2-panel-sec"><div class="st2-panel-h">' + s2Ico('download') + ' Свои данные</div>' +
        '<div class="st2-grp">' +
        s2Row({
          ico: 'download', title: 'Экспорт своих данных',
          sub: 'Выгрузка профиля, настроек, чатов и операций в файл. Готовится на устройстве.',
          onclick: 'st2Push(\'export\')', chev: true
        }) +
        '</div></div>';
    },
    after: function () {
      /* Досчитываем реальный объём и обновляем панель, когда браузер ответит. */
      if (!S2_STORE.ready || !S2_STORE.exact) {
        s2StorageRefresh(function () {
          var top = (typeof st2CurPanel === 'function') ? st2CurPanel() : null;
          if (top && top.id === 'data') s2Rerender();
        });
      }
    }
  };

  /* Реальная очистка Cache Storage — не анимация с выдуманным числом. */
  var s2Clearing = false;
  W.st2ClearCache = function () {
    if (s2Clearing) return;
    showPopup({
      ico: 'trash', title: 'Очистить кэш офлайн-режима?',
      body: 'Будут удалены сохранённые копии страниц, скриптов и медиа. Что произойдёт:<br>' +
        '· первое открытие после очистки станет медленнее<br>' +
        '· без сети приложение временно не откроется, пока кэш не соберётся заново<br><br>' +
        '<b>Не затрагивается:</b> профиль, настройки, чаты и всё, что лежит в локальном хранилище.',
      actions: [
        { label: 'Отмена', ghost: true },
        { label: 'Очистить', onclick: s2DoClearCache }
      ]
    });
    s2PopDanger(1);
  };
  function s2DoClearCache() {
    s2Clearing = true;
    var before = S2_STORE.total || s2LsBytes();
    var chain = (W.caches && caches.keys)
      ? caches.keys().then(function (keys) {
        return Promise.all(keys.map(function (k) { return caches.delete(k); }));
      }).catch(function () { })
      : Promise.resolve();
    chain.then(function () {
      ST2.lastClear = Date.now(); s2Save();
      s2StorageRefresh(function (st) {
        s2Clearing = false;
        var freed = Math.max(0, before - st.total);
        var el = document.getElementById('st2CacheVal');
        if (el) el.textContent = s2FmtSize(st.total);
        var top = (typeof st2CurPanel === 'function') ? st2CurPanel() : null;
        if (top && top.id === 'data') s2Rerender();
        s2Toast(freed > 0 ? 'Кэш очищен · освобождено ' + s2FmtSize(freed) : 'Кэш уже был пуст');
      });
    });
  }

  /* Предел кэша — честно помечаем как пожелание. */
  W.st2SetCacheLim = function (v) {
    ST2.data.cacheLimit = +v; s2Save();
    var el = document.getElementById('st2CLV');
    var r = document.getElementById('st2CLR');
    if (el) el.textContent = v + ' МБ';
    if (r) r.style.setProperty('--st2-fill', ((v - 100) / 1900 * 100) + '%');
  };

  /* ==========================================================================
     12. ПАНЕЛЬ «ЭКСПОРТ СВОИХ ДАННЫХ»
     ========================================================================== */

  ST2_PANELS['export'] = {
    title: 'Экспорт своих данных',
    render: function () {
      return '<p class="st2-panel-desc">Копия всего, что приложение знает о вас на этом устройстве. Файл собирается прямо здесь и никуда не отправляется.</p>' +
        '<div class="st2-panel-sec"><div class="st2-panel-h">' + s2Ico('download') + ' Формат выгрузки</div>' +
        '<div class="st2-grp">' +
        s2Row({
          ico: 'file', title: 'Машиночитаемый JSON',
          sub: 'Профиль, аккаунты на устройстве, настройки, чаты, операции кошелька, сессии и чёрный список.',
          right: '<span class="st2-val">.json</span>', onclick: 'st2ExportJson()', chev: true
        }) +
        s2Row({
          ico: 'file', title: 'Читаемый текст',
          sub: 'Тот же набор, но человеческим языком — удобно проверить глазами.',
          right: '<span class="st2-val">.txt</span>', onclick: 'st2Download()', chev: true
        }) +
        '</div></div>' +
        '<div class="st2-panel-sec"><div class="st2-panel-h">' + s2Ico('lock') + ' Что в файл не попадёт</div>' +
        '<div class="st2-grp"><div class="s2-facts">' +
        '<div class="s2-fact s2-fact-no">' + s2Ico('x') + '<div><b>Пароль</b><span>Приложение его не знает: хранится только отметка «установлен».</span></div></div>' +
        '<div class="s2-fact s2-fact-no">' + s2Ico('x') + '<div><b>Код-пароль и ключ 2FA</b><span>В выгрузку идут только флаги «включено», без соли, хеша и секретов.</span></div></div>' +
        '<div class="s2-fact s2-fact-no">' + s2Ico('x') + '<div><b>Серверная история</b><span>Всё, что живёт только на сервере, выгружается по запросу в поддержку.</span></div></div>' +
        '</div></div></div>' +
        s2Note('Файл формируется в браузере и сразу отдаётся вам. Ни один байт выгрузки не уходит в сеть.');
    }
  };

  /* ==========================================================================
     13. ПАНЕЛЬ «ВНЕШНИЙ ВИД» (тема + размер шрифта)
     ========================================================================== */

  ST2_PANELS.theme = {
    title: 'Внешний вид',
    render: function () {
      var mode = ST2.theme || (document.documentElement.dataset.theme === 'light' ? 'light' : 'dark');
      var ta = ST2.themeAuto;
      var fs = ST2.a11y.fontScale;
      return '<p class="st2-panel-desc">Тема оформления, автоматическое переключение по времени и размер шрифта во всём приложении.</p>' +

        '<div class="st2-panel-sec"><div class="st2-panel-h">' + s2Ico('sun') + ' Тема</div>' +
        '<div class="st2-grp">' +
        [['dark', 'Тёмная', 'Основная ночная тема бренда', 'moon'],
        ['light', 'Светлая', 'Для яркого света и дня', 'sun'],
        ['system', 'Как в системе', 'Следовать настройке устройства', 'st2-devices']].map(function (o) {
          return '<button class="prow st2-radio ' + (mode === o[0] ? 'on' : '') + '" onclick="st2SetTheme(\'' + o[0] + '\')">' +
            '<span class="st2-radio-mark"></span>' +
            '<div class="st2-radio-b"><b>' + o[1] + '</b><small>' + o[2] + '</small></div>' +
            '<span class="st2-radio-tag">' + s2Ico(o[3]) + '</span></button>';
        }).join('') +
        '</div></div>' +

        '<div class="st2-panel-sec"><div class="st2-panel-h">' + s2Ico('st2-clock') + ' Расписание темы</div>' +
        '<div class="st2-grp">' +
        '<button class="prow" onclick="st2ThemeAutoTgl(this)">' + s2Ico('st2-clock') + ' Переключать по времени ' + s2Sw(ta.on) + '</button>' +
        '<div class="st2-quiet' + (ta.on ? ' open' : '') + '"><div class="st2-quiet-in">' +
        '<div class="st2-quiet-times">' +
        '<label class="st2-time"><span>тёмная</span><input type="time" value="' + s2Esc(ta.dark) + '" onchange="st2ThemeAutoTime(\'dark\',this.value)"></label>' +
        '<span class="st2-quiet-arrow">' + s2Ico('chev') + '</span>' +
        '<label class="st2-time"><span>светлая</span><input type="time" value="' + s2Esc(ta.light) + '" onchange="st2ThemeAutoTime(\'light\',this.value)"></label>' +
        '</div>' +
        '<p class="st2-quiet-note">' + s2Ico('moon') + ' Расписание работает, пока приложение открыто: тема меняется сразу и держится по времени устройства.</p>' +
        '</div></div></div></div>' +

        '<div class="st2-panel-sec"><div class="st2-panel-h">' + s2Ico('edit') + ' Размер шрифта</div>' +
        '<div class="st2-grp">' +
        '<div class="prow st2-prow-col" style="cursor:default">' +
        '<div class="st2-range" style="width:100%">' +
        '<div class="st2-range-h">' + s2Ico('edit') + ' Кегль интерфейса<span class="st2-range-v s2-fsv">' + fs + '%</span></div>' +
        '<input type="range" class="s2-fsr" min="85" max="135" step="5" value="' + fs + '" oninput="st2SetFont(this.value)" style="--st2-fill:' + ((fs - 85) / 50 * 100) + '%">' +
        '<div class="st2-range-ticks"><span>Мельче</span><span>Обычно</span><span>Крупнее</span></div>' +
        '</div></div>' +
        '</div>' +
        s2Note('Меняется сразу и применяется ко всему приложению. Те же ползунок и переключатели есть в разделе «Доступность».') +
        '</div>' +

        '<div class="st2-panel-sec"><div class="st2-panel-h">' + s2Ico('st2-eye') + ' Ещё</div>' +
        '<div class="st2-grp">' +
        s2Row({
          ico: 'st2-eye', title: 'Доступность',
          sub: 'Меньше анимаций, высокий контраст, большие тап-цели.',
          right: '<span class="st2-val">' + s2Esc(st2A11ySum()) + '</span>',
          onclick: 'st2Push(\'a11y\')', chev: true
        }) +
        '</div></div>';
    }
  };

  /* Ползунок шрифта живёт в двух панелях — обновляем все копии сразу. */
  W.st2SetFont = function (v) {
    ST2.a11y.fontScale = +v; s2Save();
    var vals = document.querySelectorAll('#st2FSV,.s2-fsv');
    for (var i = 0; i < vals.length; i++) vals[i].textContent = v + '%';
    var rs = document.querySelectorAll('#st2FSR,.s2-fsr');
    for (var j = 0; j < rs.length; j++) {
      rs[j].style.setProperty('--st2-fill', ((v - 85) / 50 * 100) + '%');
      if (rs[j].value !== String(v)) rs[j].value = v;
    }
    if (typeof st2ApplyA11y === 'function') st2ApplyA11y();
  };

  /* ==========================================================================
     14. ПАНЕЛЬ «О ПРИЛОЖЕНИИ»
     ========================================================================== */

  function s2Build() {
    var m = (document.body.textContent || '').match(/сборка\s+v([\d.]+)/);
    return m ? 'v' + m[1] : 'v—';
  }

  ST2_PANELS.about = {
    title: 'О приложении',
    render: function () {
      var sw = ('serviceWorker' in navigator) ? 'подключён' : 'недоступен';
      return '<p class="st2-panel-desc">Что это за сборка, где живут ваши данные и какие части уже работают без сервера.</p>' +

        '<div class="st2-panel-sec"><div class="st2-panel-h">' + s2Ico('info') + ' Сборка</div>' +
        '<div class="st2-grp"><div class="s2-facts">' +
        '<div class="s2-kv"><i>Версия</i><b>' + s2Esc(s2Build()) + '</b></div>' +
        '<div class="s2-kv"><i>Оболочка</i><b>' + s2Esc(s2AppKind()) + '</b></div>' +
        '<div class="s2-kv"><i>Офлайн-режим</i><b>' + sw + '</b></div>' +
        '<div class="s2-kv"><i>Хранилище настроек</i><b>localStorage · oko-settings2</b></div>' +
        '</div></div></div>' +

        '<div class="st2-panel-sec"><div class="st2-panel-h">' + s2Ico('check') + ' Что уже работает без сервера</div>' +
        '<div class="st2-grp"><div class="s2-facts">' +
        '<div class="s2-fact s2-fact-yes">' + s2Ico('check') + '<div><b>Все настройки этого раздела</b><span>Тема, шрифт, приватность, уведомления, язык — сохраняются на устройстве и применяются сразу.</span></div></div>' +
        '<div class="s2-fact s2-fact-yes">' + s2Ico('check') + '<div><b>Код-пароль и чёрный список</b><span>Живут локально; код хранится только как соль и хеш.</span></div></div>' +
        '<div class="s2-fact s2-fact-yes">' + s2Ico('check') + '<div><b>Экспорт данных и очистка кэша</b><span>Выполняются в браузере, реальными операциями.</span></div></div>' +
        '</div></div></div>' +

        '<div class="st2-panel-sec"><div class="st2-panel-h">' + s2Ico('warning') + ' Что появится вместе с сервером</div>' +
        '<div class="st2-grp"><div class="s2-facts">' +
        '<div class="s2-fact s2-fact-no">' + s2Ico('x') + '<div><b>Смена пароля и проверка второго фактора</b><span>Хеш пароля и секрет TOTP хранит только сервер.</span></div></div>' +
        '<div class="s2-fact s2-fact-no">' + s2Ico('x') + '<div><b>Подтверждение почты и телефона</b><span>Письмо и SMS отправляет бэкенд.</span></div></div>' +
        '<div class="s2-fact s2-fact-no">' + s2Ico('x') + '<div><b>Чужие сессии и выход отовсюду</b><span>Список устройств и отзыв токенов — серверная операция.</span></div></div>' +
        '<div class="s2-fact s2-fact-no">' + s2Ico('x') + '<div><b>Вход по биометрии и OAuth</b><span>Ключ устройства и Google/Apple регистрируются на сервере.</span></div></div>' +
        '</div></div></div>' +

        '<div class="st2-panel-sec"><div class="st2-panel-h">' + s2Ico('refresh') + ' Обслуживание</div>' +
        '<div class="st2-grp">' +
        s2Row({ ico: 'refresh', title: 'Проверить обновление', sub: 'Спросить сервис-воркер, есть ли новая сборка.', onclick: 'st2CheckUpdate()', chev: true }) +
        s2Row({ ico: 'copy', title: 'Скопировать диагностику', sub: 'Версия, устройство, тема, объём хранилища — для поддержки.', onclick: 'st2CopyDiag()', chev: true }) +
        s2Row({ ico: 'file', title: 'Юридические документы', sub: 'Оферта, политика, возвраты, лицензии.', onclick: 'st2Push(\'legal\')', chev: true }) +
        '</div></div>';
    }
  };

  W.st2CheckUpdate = function () {
    if (!('serviceWorker' in navigator)) {
      showPopup({
        ico: 'info', title: 'Офлайн-режим недоступен',
        body: 'Этот браузер не поддерживает сервис-воркер, поэтому проверять нечего — приложение всегда грузится из сети.',
        actions: [{ label: 'Понятно' }]
      });
      return;
    }
    navigator.serviceWorker.getRegistration().then(function (reg) {
      if (!reg) {
        showPopup({
          ico: 'info', title: 'Сервис-воркер ещё не установлен',
          body: 'Офлайн-режим включится после первой полной загрузки приложения. Проверять обновление пока не у чего.',
          actions: [{ label: 'Понятно' }]
        });
        return;
      }
      reg.update().then(function () {
        showPopup({
          ico: 'refresh', title: 'Проверка выполнена',
          body: reg.waiting
            ? 'Новая версия скачана и ждёт. Она применится при следующем полном перезапуске приложения.'
            : 'Сервер отдал ту же версию — обновления нет. Это результат реального запроса, а не заглушка.',
          actions: [{ label: 'Понятно' }]
        });
      }).catch(function () {
        showPopup({
          ico: 'warning', title: 'Не удалось проверить',
          body: 'Запрос к серверу не прошёл — вероятно, нет сети. Попробуйте позже.',
          actions: [{ label: 'Понятно' }]
        });
      });
    });
  };

  /* Диагностика — реальные значения, копирование через буфер обмена. */
  W.st2CopyDiag = function () {
    var lines = [
      'OKO · диагностика',
      'Версия: ' + s2Build(),
      'Оболочка: ' + s2AppKind(),
      'Тема: ' + (document.documentElement.dataset.theme || 'dark'),
      'Язык: ' + ((typeof LANG !== 'undefined') ? LANG : 'ru'),
      'Экран: ' + W.innerWidth + '×' + W.innerHeight,
      'Хранилище: ' + s2FmtSize(S2_STORE.total || s2LsBytes()),
      'Сеть: ' + (navigator.onLine ? 'онлайн' : 'офлайн'),
      'UA: ' + (navigator.userAgent || ''),
      'Время: ' + new Date().toISOString()
    ].join('\n');
    function fallback() {
      showPopup({
        ico: 'copy', title: 'Диагностика',
        body: '<div class="st2-2fa-key s2-mono" style="text-align:left;font-size:11.5px;letter-spacing:0">' +
          s2Esc(lines).replace(/\n/g, '<br>') + '</div>' +
          '<div class="st2-note">Скопировать автоматически не вышло — выделите текст вручную и пришлите в поддержку.</div>',
        actions: [{ label: 'Закрыть' }]
      });
    }
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(lines)
        .then(function () { s2Toast('Диагностика скопирована в буфер обмена'); })
        .catch(fallback);
    } else fallback();
  };

  /* ==========================================================================
     15. ЧЕСТНАЯ ПОДДЕРЖКА И БАГРЕПОРТ
     ========================================================================== */

  W.st2OpenSupport = function () {
    if (typeof openChatByName === 'function') {
      try { openChatByName('Поддержка OKO'); st2Close(); return; } catch (e) { }
      try { openChatByName('OKO Support'); st2Close(); return; } catch (e) { }
    }
    showPopup({
      ico: 'chat', title: 'Чат поддержки',
      body: 'Открыть чат отсюда не получилось. Напишите в «Сообщения» → <b>Поддержка OKO</b> — это тот же диалог.',
      actions: [{ label: 'Понятно' }]
    });
  };

  W.st2Bugreport = function () {
    showPopup({
      ico: 'flag', title: 'Сообщить о проблеме',
      body: '<p style="margin-bottom:10px;font-size:12.5px;line-height:1.55;color:var(--dim)">' +
        'Опишите, что пошло не так. Текст вместе с диагностикой ляжет в буфер обмена — останется вставить его в чат поддержки.</p>' +
        '<div class="st2-pin"><textarea id="s2Bug" placeholder="Что случилось и что вы делали до этого" ' +
        'style="width:100%;min-height:110px;background:var(--raised);border:1px solid var(--border);border-radius:var(--r-md);padding:12px;font:inherit;color:var(--text);resize:vertical;text-align:left"></textarea></div>' +
        '<div class="st2-note">Автоматической отправки нет: сервер приёма багрепортов ещё не подключён, и делать вид, что письмо ушло, мы не будем.</div>',
      actions: [
        { label: 'Отмена', ghost: true },
        {
          label: 'Скопировать', onclick: function () {
            var el = document.getElementById('s2Bug');
            var v = el ? el.value.trim() : '';
            if (v.length < 10) { s2Toast('Слишком коротко — расскажите подробнее'); return W.st2Bugreport(); }
            var txt = 'OKO · сообщение о проблеме\n\n' + v + '\n\n---\nВерсия: ' + s2Build() +
              '\nОболочка: ' + s2AppKind() + '\nЭкран: ' + W.innerWidth + '×' + W.innerHeight +
              '\nUA: ' + (navigator.userAgent || '');
            if (navigator.clipboard && navigator.clipboard.writeText) {
              navigator.clipboard.writeText(txt)
                .then(function () { s2Toast('Текст в буфере — вставьте его в чат поддержки'); })
                .catch(function () { s2Toast('Скопировать не вышло — перенесите текст вручную'); });
            } else s2Toast('Буфер обмена недоступен — перенесите текст вручную');
          }
        }
      ]
    });
    var el = document.getElementById('s2Bug');
    if (el) setTimeout(function () { try { el.focus(); } catch (e) { } }, 60);
  };

  /* ==========================================================================
     16. КОРНЕВАЯ ПАНЕЛЬ: ПОНЯТНАЯ ГРУППИРОВКА
     ========================================================================== */

  function s2SecSum() {
    var s = s2SecScore();
    return { text: s.n + '/' + s.all, on: s.n === s.all };
  }

  ST2_PANELS.root = {
    title: 'Настройки',
    render: function () {
      var nick = (typeof st2Nick === 'function') ? st2Nick() : '';
      var alive = st2Alive();
      return '' +
        '<label class="st2-search" id="st2Search">' +
        '<span class="st2-search-ic">' + s2Ico('st2-search') + '</span>' +
        '<input id="st2SearchInp" type="search" placeholder="Поиск по настройкам" autocomplete="off" enterkeyhint="search" oninput="st2Search(this.value)">' +
        '<button type="button" class="st2-search-x" onclick="st2SearchClear()" aria-label="Очистить поиск">' + s2Ico('st2-x') + '</button>' +
        '</label>' +
        '<div id="st2SearchResults"></div>' +
        '<div class="st2-grouped" id="st2Groups">' +

        '<div class="st2-grp-wrap"><div class="st2-grp-cap">' + s2Ico('user') + ' Профиль</div><div class="st2-grp">' +
        st2NavRow('user', 'Профиль', { text: '@' + nick }, 'profile') +
        st2NavRow('users', 'Аккаунты на устройстве', ST2.accounts.length + '', 'accounts') +
        '</div></div>' +

        '<div class="st2-grp-wrap"><div class="st2-grp-cap">' + s2Ico('st2-key') + ' Аккаунт и вход</div><div class="st2-grp">' +
        st2NavRow('st2-mail', 'Аккаунт и вход', ST2.email, 'account') +
        st2NavRow('st2-shield', 'Безопасность', s2SecSum(), 'security') +
        st2NavRow('st2-devices', 'Устройства и сессии', alive.length + '', 'sessions') +
        '</div></div>' +

        '<div class="st2-grp-wrap"><div class="st2-grp-cap">' + s2Ico('bell') + ' Уведомления и приватность</div><div class="st2-grp">' +
        st2NavRow('bell', 'Уведомления', (ST2.notif.msg ? 'вкл' : 'выкл'), 'notif') +
        st2NavRow('lock', 'Приватность', st2PrivSum(), 'privacy') +
        st2NavRow('st2-ban', 'Чёрный список', (ST2.blocked.length || 'пусто') + '', 'blocked') +
        '</div></div>' +

        '<div class="st2-grp-wrap"><div class="st2-grp-cap">' + s2Ico('sun') + ' Внешний вид и язык</div><div class="st2-grp">' +
        st2NavRow('sun', 'Внешний вид', st2ThemeSum(), 'theme') +
        st2NavRow('st2-eye', 'Доступность', st2A11ySum(), 'a11y') +
        st2NavRow('globe', 'Язык и формат', st2LangSum(), 'lang') +
        '</div></div>' +

        '<div class="st2-grp-wrap"><div class="st2-grp-cap">' + s2Ico('st2-db') + ' Данные и память</div><div class="st2-grp">' +
        st2NavRow('st2-db', 'Данные и память', st2DataSum(), 'data') +
        st2NavRow('download', 'Экспорт своих данных', null, 'export') +
        '</div></div>' +

        '<div class="st2-grp-wrap"><div class="st2-grp-cap">' + s2Ico('st2-life') + ' Помощь и о приложении</div><div class="st2-grp">' +
        st2NavRow('st2-life', 'Помощь и обратная связь', null, 'help') +
        st2NavRow('info', 'О приложении', s2Build(), 'about') +
        st2NavRow('file', 'Юридические документы', null, 'legal') +
        '</div></div>' +

        '<div class="st2-grp-wrap"><div class="st2-grp-cap" style="color:var(--danger)">' + s2Ico('warning') + ' Опасная зона</div><div class="st2-grp">' +
        st2NavRow('logout', 'Выйти из аккаунта', null, 'logoutAct') +
        st2NavRow('trash', 'Удаление аккаунта', st2DelSum(), 'danger', true) +
        '</div></div>' +

        '</div>' +
        '<div class="st2-search-empty" id="st2SearchEmpty">' + s2Ico('st2-search') +
        '<p>Ничего не найдено</p><span>Попробуйте другой запрос: «пароль», «тема», «кэш»</span></div>' +
        '<div class="st2-foot">OKO · настройки хранятся на этом устройстве · сборка ' + s2Esc(s2Build()) + '</div>';
    },
    after: function () {
      /* Дозамер хранилища для сводки в корне. */
      if (!S2_STORE.ready) s2StorageRefresh(function () {
        var top = (typeof st2CurPanel === 'function') ? st2CurPanel() : null;
        if (top && top.id === 'root') s2Rerender();
      });
    }
  };

  /* Обёртка группы нужна, чтобы подпись и карточка ехали как одно целое. */
  (function patchGroupWrap() {
    var st = document.getElementById('oko-settings2-css');
    if (!st) return;
    st.textContent += '\n.st2-grp-wrap{display:flex;flex-direction:column}\n' +
      '.st2-grouped{gap:20px}\n';
  })();

  /* ==========================================================================
     17. ОПАСНАЯ ЗОНА: только удаление, с объяснением последствий
     ========================================================================== */

  ST2_PANELS.danger = {
    title: 'Удаление аккаунта',
    render: function () {
      var days = (typeof st2DelDays === 'function') ? st2DelDays() : 0;
      return '<p class="st2-panel-desc">Необратимое действие с отсрочкой. Перед удалением стоит выгрузить свои данные.</p>' +
        '<div class="st2-panel-sec"><div class="st2-panel-h">' + s2Ico('download') + ' Сначала — копия</div>' +
        '<div class="st2-grp">' +
        s2Row({
          ico: 'download', title: 'Экспорт своих данных',
          sub: 'Файл с профилем, настройками, чатами и операциями. После удаления восстановить их будет неоткуда.',
          onclick: 'st2Push(\'export\')', chev: true
        }) +
        '</div></div>' +
        '<div class="st2-panel-sec"><div class="st2-panel-h" style="color:var(--danger)">' + s2Ico('trash') + ' Удаление</div>' +
        '<div class="st2-grp st2-danger">' +
        '<div class="s2-facts" style="padding-top:8px">' +
        '<div class="s2-fact s2-fact-no">' + s2Ico('x') + '<div><b>Профиль и подписчики</b><span>Имя, ник, обложка, вся аудитория.</span></div></div>' +
        '<div class="s2-fact s2-fact-no">' + s2Ico('x') + '<div><b>Чаты, каналы и истории</b><span>Переписка удаляется у вас; у собеседников остаются их копии.</span></div></div>' +
        '<div class="s2-fact s2-fact-no">' + s2Ico('x') + '<div><b>Кошелёк и операции</b><span>Остаток нужно вывести заранее — после удаления доступа к нему нет.</span></div></div>' +
        '<div class="s2-fact s2-fact-no">' + s2Ico('x') + '<div><b>Сертификаты Академии</b><span>Прогресс и выданные сертификаты аннулируются.</span></div></div>' +
        '</div>' +
        (ST2.delAt
          ? '<div class="st2-del-status"><b>' + s2Ico('st2-clock') + ' Аккаунт помечен на удаление</b>' +
          'Осталось ' + days + ' дн. — до ' + s2Esc(new Date(ST2.delAt).toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })) +
          '<button class="st2-del-cancel" onclick="st2CancelDel()">Отменить удаление</button></div>'
          : '<button class="s2-danger-btn" onclick="st2DeleteAsk()">Удалить аккаунт через 14 дней</button>') +
        '</div>' +
        s2Note('Отметка ставится на этом устройстве. <b>Само удаление выполняет сервер</b> — он же и отсчитывает 14 дней. Отменить можно в любой момент до конца отсчёта.', 'warn') +
        '</div>';
    }
  };

  /* ==========================================================================
     18. ПОИСК: расширяем индекс новыми пунктами
     ========================================================================== */

  (function extendSearch() {
    if (typeof ST2_SEARCH_INDEX === 'undefined') return;
    var add = [
      ['Пароль · сменить пароль · password', 'security', 'st2-key', 'Безопасность'],
      ['Двухфакторная защита · 2FA · TOTP · код из приложения', 'security', 'st2-shield', 'Безопасность'],
      ['Резервные коды · backup codes', 'security', 'file', 'Безопасность'],
      ['Вход по биометрии · Face ID · отпечаток', 'security', 'fingerprint', 'Безопасность'],
      ['Код-пароль · PIN · блокировка приложения', 'security', 'lock', 'Безопасность'],
      ['Подтверждение телефона', 'security', 'phone', 'Безопасность'],
      ['Подтверждение почты', 'security', 'st2-mail', 'Безопасность'],
      ['Устройства и сессии · где выполнен вход', 'sessions', 'st2-devices', 'Безопасность'],
      ['Выйти со всех устройств', 'sessions', 'logout', 'Безопасность'],
      ['Экспорт своих данных · выгрузка · JSON', 'export', 'download', 'Данные и память'],
      ['Сколько занимает приложение · память · хранилище', 'data', 'st2-db', 'Данные и память'],
      ['Очистить кэш офлайн-режима', 'data', 'trash', 'Данные и память'],
      ['Внешний вид · тема · оформление', 'theme', 'sun', 'Внешний вид'],
      ['Размер шрифта · кегль', 'theme', 'edit', 'Внешний вид'],
      ['О приложении · версия · сборка', 'about', 'info', 'О приложении'],
      ['Проверить обновление', 'about', 'refresh', 'О приложении'],
      ['Диагностика для поддержки', 'about', 'copy', 'О приложении'],
      ['Удаление аккаунта', 'danger', 'trash', 'Опасная зона']
    ];
    var have = {};
    ST2_SEARCH_INDEX.forEach(function (r) { have[r[0]] = 1; });
    add.forEach(function (r) { if (!have[r[0]]) ST2_SEARCH_INDEX.push(r); });
  })();

  /* ==========================================================================
     19. ВЫХОД ИЗ ЛЮБОГО ЭКРАНА: Escape закрывает попап, потом панель
     ========================================================================== */

  document.addEventListener('keydown', function (e) {
    if (e.key !== 'Escape') return;
    var pop = document.getElementById('okoPopup');
    if (pop) {
      s2WipePw();
      e.preventDefault();
      e.stopPropagation();
      if (typeof closePopup === 'function') closePopup();
      return;
    }
    var v = document.getElementById('st2View');
    if (v && v.classList.contains('open') && typeof nvPop !== 'function') {
      e.preventDefault();
      st2Back();
    }
  }, true);

  /* ==========================================================================
     20. ИНИЦИАЛИЗАЦИЯ
     ========================================================================== */

  /* Если раздел настроек уже открыт (горячая перезагрузка слоя) — перерисуем. */
  (function boot() {
    try {
      var v = document.getElementById('st2View');
      if (v && v.classList.contains('open')) s2Rerender();
    } catch (e) { }
  })();

  /* Отметка для пробника и отладки: слой поднялся. */
  W.OKO_SETTINGS2 = {
    version: 1,
    score: s2SecScore,
    storage: function () { return S2_STORE; },
    bio: function () { return S2_BIO; }
  };
})();
