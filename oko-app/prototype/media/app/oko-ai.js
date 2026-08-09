/* ============================================================================
   OKO · ОКО Ai — экран нейросети в виде обычного личного чата
   ----------------------------------------------------------------------------
   Правка Даниэля 09.08:
     «в помощнике око поле ввода поверх чата криво стоит не как в чатах ЛС и тд
      некрасиво неудобно криво точно такое же чат должен быть и назови его
      не помощник око, а ОКО Ai»

   Что делает файл:
     • Полностью подменяет старый экран «Помощник OKO» (#helperRoot, классы .hp-*)
       на полноэкранный диалог, собранный на РОДНЫХ классах личных сообщений:
       .conv-head / .msgs / .msg.in / .msg.out / .composer / .msg.typing.
       Никаких копий стилей — те же самые правила из index.html + oko-v2.css,
       поэтому пузыри, отступы, шрифты и композер совпадают с ЛС попиксельно.
     • Композер прижат к низу флексом (.msgs{flex:1} + .composer{flex-shrink:0}),
       а не «поверх чата»: перекрыть последнее сообщение он физически не может.
     • Безопасные зоны — только через var(--oko-safe-*) (голый env() запрещён).
     • Клавиатура: высота экрана подстраивается под visualViewport, композер
       не уезжает под клавиатуру и не отрывается от неё.
     • Выход есть всегда: кнопка «назад» в шапке, Escape, системная «назад»
       и Telegram BackButton (через navstack ядра — closeMa уже в стеке).

   Правила проекта, соблюдённые здесь:
     • Ноль эмодзи — только SVG-символы из спрайта index.html (#i-*).
     • Ноль демо-данных — пустой чат показывает честный empty-state, а не
       выдуманную переписку.
     • Ноль ложных подтверждений — если бэкенд ОКО Ai недоступен, так и
       написано: запрос не ушёл. Никакой имитации «ответа нейросети».

   Загружается ПОСЛЕ ядра (index.html, app.js) и после остальных oko-*.js.
   Ядро (гигантские index.html / app.js / app.css) не переписывается.
   ============================================================================ */
(function () {
  'use strict';

  var HIST_KEY = 'oko-helper-history';   /* ключ ядра — история не теряется */
  var AVATAR   = 'oko-icon-192.png';     /* знак OKO из oko-app/brand (не рисуем руками) */
  var MAX_HIST = 40;

  /* ---------------------------------------------------------------- утилиты */
  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }
  /* Простой markdown ядра: **жирный** и переносы строк. Текст не режем. */
  function md(s) {
    return esc(s).replace(/\*\*([^*]+)\*\*/g, '<b>$1</b>').replace(/\n/g, '<br>');
  }
  function now() {
    try { return new Date().toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' }); }
    catch (e) { return ''; }
  }
  function ic(name, cls) {
    return '<svg class="i' + (cls ? ' ' + cls : '') + '"><use href="#i-' + name + '"/></svg>';
  }
  function say(t) { try { if (typeof window.toast === 'function') window.toast(t); } catch (e) {} }

  function readHist() {
    try { var a = JSON.parse(localStorage.getItem(HIST_KEY) || '[]'); return Array.isArray(a) ? a : []; }
    catch (e) { return []; }
  }
  function writeHist(h) {
    try { localStorage.setItem(HIST_KEY, JSON.stringify(h.slice(-MAX_HIST))); } catch (e) {}
  }

  /* ------------------------------------------------------------------ стили
     Только то, чего нет в ядре: сам контейнер-экран, аватар-картинка,
     empty-state и всплывающее меню. Пузыри/композер/шапку не переопределяем. */
  var CSS = [
    '.oko-ai-screen{position:fixed;left:0;right:0;top:0;bottom:0;z-index:38;',
      'display:none;flex-direction:column;background:var(--bg);color:var(--text);overflow:hidden}',
    '.oko-ai-screen.open{display:flex}',
    /* шапка: .conv-head уже несёт safe-top/left/right из oko-v2.css */
    '.oko-ai-screen .conv-head{background:var(--bg)}',
    '.oko-ai-who{display:flex;align-items:center;gap:11px;flex:1;min-width:0;cursor:default}',
    '.oko-ai-ava{overflow:hidden;padding:0;background:var(--lime-dim);border-color:transparent}',
    '.oko-ai-ava img{width:100%;height:100%;object-fit:cover;display:block;border-radius:50%}',
    '.oko-ai-nm{min-width:0;flex:1}',
    /* лента: .msgs из ядра (flex:1, overflow-y:auto) — композер физически ниже */
    '.oko-ai-screen .msgs{background:var(--bg)}',
    /* пустой экран — честный, без выдуманной переписки */
    '.oko-ai-empty{margin:auto;width:100%;max-width:420px;display:flex;flex-direction:column;',
      'align-items:center;text-align:center;gap:10px;padding:14px 4px 6px}',
    '.oko-ai-empty-ava{width:74px;height:74px;border-radius:50%;overflow:hidden;',
      'box-shadow:0 8px 26px rgba(0,0,0,.34);border:1px solid var(--border)}',
    '.oko-ai-empty-ava img{width:100%;height:100%;object-fit:cover;display:block}',
    '.oko-ai-empty h3{margin:2px 0 0;font-family:var(--font-body);font-size:21px;font-weight:800;',
      'letter-spacing:.01em;line-height:1.15;color:var(--text)}',
    '.oko-ai-empty p{margin:0;font-size:13px;line-height:1.55;color:var(--dim);',
      'overflow-wrap:break-word;word-break:normal;-webkit-hyphens:none;hyphens:none}',
    '.oko-ai-chips{display:grid;grid-template-columns:1fr;gap:8px;width:100%;margin-top:6px}',
    '@media(min-width:420px){.oko-ai-chips{grid-template-columns:1fr 1fr}}',
    '.oko-ai-chip{display:flex;align-items:center;gap:9px;padding:11px 12px;border-radius:12px;',
      'background:var(--surface);border:1px solid var(--border);color:var(--text);text-align:left;',
      'font-size:12.5px;font-weight:600;line-height:1.3;min-width:0;',
      'overflow-wrap:break-word;word-break:normal}',
    '.oko-ai-chip:hover,.oko-ai-chip:active{border-color:var(--accent);background:var(--lime-dim)}',
    '.oko-ai-chip-ic{flex:0 0 auto;width:28px;height:28px;border-radius:9px;background:var(--lime-dim);',
      'color:var(--accent);display:flex;align-items:center;justify-content:center}',
    '.oko-ai-chip-ic svg.i{width:14px;height:14px}',
    /* меню шапки */
    '.oko-ai-menu{position:absolute;z-index:2;min-width:214px;background:var(--surface);',
      'border:1px solid var(--border);border-radius:12px;padding:6px;display:none;',
      'box-shadow:0 14px 34px rgba(0,0,0,.42)}',
    '.oko-ai-menu.open{display:block}',
    '.oko-ai-menu button{display:flex;align-items:center;gap:10px;width:100%;padding:10px 10px;',
      'border-radius:9px;background:none;border:0;color:var(--text);font-size:13.5px;',
      'font-weight:600;text-align:left;line-height:1.35}',
    '.oko-ai-menu button:hover{background:var(--raised)}',
    '.oko-ai-menu button svg.i{width:17px;height:17px;color:var(--dim);flex:0 0 auto}',
    '.oko-ai-menu button.danger,.oko-ai-menu button.danger svg.i{color:#ff5c5c}',
    /* подпись под композером про хранение истории */
    '.oko-ai-note{font-size:11px;line-height:1.45;color:var(--dim);text-align:center;',
      'padding:0 16px 6px;margin:0}'
  ].join('');

  function injectCss() {
    if (document.getElementById('oko-ai-css')) return;
    var st = document.createElement('style');
    st.id = 'oko-ai-css';
    st.textContent = CSS;
    (document.head || document.documentElement).appendChild(st);
  }

  /* --------------------------------------------------------- быстрые запросы
     Это подсказки-заготовки для ввода, а не выдуманная переписка. */
  var CHIPS = [
    { i: 'file',      t: 'Разобрать мой пост',   m: 'Разбери мой последний пост: хук, структура, CTA — что улучшить' },
    { i: 'photo',     t: 'Промпт для картинки',  m: 'Собери промпт для картинки под мою нишу' },
    { i: 'briefcase', t: 'Идеи услуг',           m: 'Дай 5 идей услуг по моей нише, которые можно продавать уже сейчас' },
    { i: 'megaphone', t: 'Сценарий клипа',      m: 'Собери сценарий ролика 30-45 секунд: хук, боль, решение, CTA' },
    { i: 'money',     t: 'Расчёт цены',          m: 'Помоги посчитать цену продукта с маржой 60% и сравнить с конкурентами' },
    { i: 'send',      t: 'Холодное сообщение',   m: 'Напиши шаблон холодного сообщения в директ для моей ниши' }
  ];

  /* ------------------------------------------------------------------- DOM */
  var el = null;   /* корневой .oko-ai-screen */
  var refs = {};

  function build() {
    if (el) return el;
    injectCss();

    el = document.createElement('div');
    el.className = 'oko-ai-screen';
    el.id = 'okoAiScreen';
    el.setAttribute('role', 'dialog');
    el.setAttribute('aria-label', 'ОКО Ai');
    el.innerHTML =
      '<div class="conv-head">' +
        '<button class="back" id="okoAiBack" type="button" title="Назад" aria-label="Назад">' + ic('back') + '</button>' +
        '<div class="oko-ai-who">' +
          '<div class="ava oko-ai-ava"><img src="' + AVATAR + '" alt="" width="36" height="36"></div>' +
          '<div class="oko-ai-nm">' +
            '<div class="who">ОКО Ai</div>' +
            '<div class="status" id="okoAiStatus">на связи</div>' +
          '</div>' +
        '</div>' +
        '<button class="ch-call" id="okoAiMenuBtn" type="button" title="Меню" aria-label="Меню чата" aria-haspopup="true" aria-expanded="false">' + ic('dots-h') + '</button>' +
        '<div class="oko-ai-menu" id="okoAiMenu" role="menu">' +
          '<button type="button" id="okoAiClear" class="danger" role="menuitem">' + ic('trash') + '<span>Очистить переписку</span></button>' +
          '<button type="button" id="okoAiAbout" role="menuitem">' + ic('info') + '<span>Что умеет ОКО Ai</span></button>' +
        '</div>' +
      '</div>' +
      '<div class="msgs" id="okoAiMsgs"></div>' +
      '<div class="composer">' +
        '<input id="okoAiInput" placeholder="Сообщение" autocomplete="off" enterkeyhint="send" aria-label="Сообщение для ОКО Ai">' +
        '<button class="tool tool-clip" id="okoAiClip" type="button" title="Прикрепить" aria-label="Прикрепить">' + ic('clip') + '</button>' +
        '<button class="send" id="okoAiSend" type="button" title="Отправить" aria-label="Отправить">' + ic('send', 'fill') + '</button>' +
      '</div>';

    document.body.appendChild(el);

    refs.msgs   = el.querySelector('#okoAiMsgs');
    refs.input  = el.querySelector('#okoAiInput');
    refs.status = el.querySelector('#okoAiStatus');
    refs.menu   = el.querySelector('#okoAiMenu');
    refs.menuBtn = el.querySelector('#okoAiMenuBtn');

    el.querySelector('#okoAiBack').addEventListener('click', function (e) {
      e.preventDefault();
      closeScreen();
    });
    el.querySelector('#okoAiSend').addEventListener('click', function (e) {
      e.preventDefault();
      sendFromInput();
    });
    el.querySelector('#okoAiClip').addEventListener('click', function (e) {
      e.preventDefault();
      /* Честно: файлы бэкенд ОКО Ai пока не принимает — ничего не «отправляем». */
      say('ОКО Ai пока читает только текст. Файлы подключим позже — опиши задачу словами.');
    });
    refs.input.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendFromInput(); }
    });

    refs.menuBtn.addEventListener('click', function (e) {
      e.preventDefault(); e.stopPropagation();
      toggleMenu();
    });
    el.querySelector('#okoAiClear').addEventListener('click', function (e) {
      e.preventDefault();
      closeMenu();
      clearHistory();
    });
    el.querySelector('#okoAiAbout').addEventListener('click', function (e) {
      e.preventDefault();
      closeMenu();
      say('ОКО Ai — нейросеть OKO: контент, продажи, цены, стратегия. Переписка хранится на этом устройстве.');
    });
    el.addEventListener('click', function (e) {
      if (refs.menu.classList.contains('open') && !refs.menu.contains(e.target)) closeMenu();
    });

    return el;
  }

  function toggleMenu() {
    if (refs.menu.classList.contains('open')) { closeMenu(); return; }
    var hb = refs.menuBtn.getBoundingClientRect();
    var sb = el.getBoundingClientRect();
    refs.menu.style.top = (hb.bottom - sb.top + 6) + 'px';
    refs.menu.style.right = Math.max(8, sb.right - hb.right) + 'px';
    refs.menu.classList.add('open');
    refs.menuBtn.setAttribute('aria-expanded', 'true');
  }
  function closeMenu() {
    if (!refs.menu) return;
    refs.menu.classList.remove('open');
    refs.menuBtn.setAttribute('aria-expanded', 'false');
  }

  /* ------------------------------------------------------------- отрисовка */
  function bubbleHtml(m) {
    var out = m.who === 'user';
    var body = out ? esc(m.text).replace(/\n/g, '<br>') : md(m.text);
    var time = '<span class="t">' + esc(m.at || '') + (out ? ic('check2') : '') + '</span>';
    return '<div class="msg ' + (out ? 'out' : 'in') + '">' + body + time + '</div>';
  }

  function emptyHtml() {
    var chips = CHIPS.map(function (c, i) {
      return '<button class="oko-ai-chip" type="button" data-chip="' + i + '">' +
               '<span class="oko-ai-chip-ic">' + ic(c.i) + '</span>' +
               '<span>' + esc(c.t) + '</span>' +
             '</button>';
    }).join('');
    return '<div class="oko-ai-empty">' +
             '<div class="oko-ai-empty-ava"><img src="' + AVATAR + '" alt=""></div>' +
             '<h3>ОКО Ai</h3>' +
             '<p>Нейросеть OKO прямо в приложении. Спроси про контент, продажи, цены или стратегию — отвечу здесь, в переписке.</p>' +
             '<p>Переписка пустая. Напиши первое сообщение или начни с готового запроса.</p>' +
             '<div class="oko-ai-chips">' + chips + '</div>' +
           '</div>';
  }

  function render() {
    build();
    var h = readHist();
    refs.msgs.innerHTML = h.length ? h.map(bubbleHtml).join('') : emptyHtml();
    if (!h.length) {
      var btns = refs.msgs.querySelectorAll('.oko-ai-chip');
      Array.prototype.forEach.call(btns, function (b) {
        b.addEventListener('click', function () {
          var c = CHIPS[parseInt(b.getAttribute('data-chip'), 10)];
          if (c) send(c.m);
        });
      });
    }
    scrollDown();
  }

  function scrollDown() {
    if (!refs.msgs) return;
    refs.msgs.scrollTop = refs.msgs.scrollHeight;
    /* второй проход после раскладки картинок/шрифтов */
    requestAnimationFrame(function () {
      if (refs.msgs) refs.msgs.scrollTop = refs.msgs.scrollHeight;
    });
  }

  function setStatus(t) { if (refs.status) refs.status.textContent = t; }

  function showTyping() {
    hideTyping();
    var d = document.createElement('div');
    d.className = 'msg in typing';
    d.id = 'okoAiTyping';
    d.innerHTML = '<span class="tdot"></span><span class="tdot"></span><span class="tdot"></span>';
    refs.msgs.appendChild(d);
    setStatus('печатает…');
    scrollDown();
  }
  function hideTyping() {
    var t = el && el.querySelector('#okoAiTyping');
    if (t && t.parentNode) t.parentNode.removeChild(t);
  }

  /* ------------------------------------------------------------- отправка */
  var busy = false;

  function push(who, text) {
    var h = readHist();
    h.push({ who: who, text: text, at: now() });
    writeHist(h);
    return h;
  }

  function appendBubble(who, text) {
    if (!refs.msgs) return;
    if (refs.msgs.querySelector('.oko-ai-empty')) refs.msgs.innerHTML = '';
    var wrap = document.createElement('div');
    wrap.innerHTML = bubbleHtml({ who: who, text: text, at: now() });
    var node = wrap.firstChild;
    node.classList.add('msg-enter');
    refs.msgs.appendChild(node);
    scrollDown();
  }

  function sendFromInput() {
    if (!refs.input) return;
    var t = refs.input.value.trim();
    if (!t) return;
    refs.input.value = '';
    send(t);
  }

  function send(text) {
    text = String(text || '').trim();
    if (!text || busy) return;
    build();
    busy = true;

    push('user', text);
    appendBubble('user', text);
    showTyping();

    var api = (typeof window.OKO_API === 'string' && window.OKO_API) ? window.OKO_API : '/api.php';
    var hist = readHist().slice(-9, -1).map(function (m) {
      return { role: m.who === 'user' ? 'user' : 'assistant', text: m.text };
    });
    var ctx = '';
    try {
      if (typeof window.aState !== 'undefined' && window.aState && window.aState.answers)
        ctx = JSON.stringify(window.aState.answers);
    } catch (e) {}
    var email = '';
    try { if (typeof window.PROFILE !== 'undefined' && window.PROFILE && window.PROFILE.email) email = window.PROFILE.email; } catch (e) {}

    var done = false;
    var timer = setTimeout(function () { if (!done) finish(null, 'timeout'); }, 45000);

    function finish(reply, err) {
      if (done) return;
      done = true;
      clearTimeout(timer);
      busy = false;
      hideTyping();
      if (reply) {
        push('ai', reply);
        appendBubble('ai', reply);
        setStatus('на связи');
      } else {
        /* Никаких имитаций ответа: говорим ровно то, что произошло.
           И «что произошло» — это причина сервера, если он ответил. Писать
           «нет связи», когда связь была и сервер прямо назвал причину, —
           такая же неправда, только помельче: человек полезет чинить
           интернет вместо настоящей причины. */
        var honest;
        if (err === 'timeout') {
          honest = 'Сервер ОКО Ai не ответил за 45 секунд — ответа нет. Твоё сообщение осталось в переписке, повтори отправку чуть позже.';
        } else if (err === 'net' || !err) {
          honest = 'Нет связи с сервером ОКО Ai — ответ не получен. Твоё сообщение осталось в переписке, повтори отправку, когда сеть вернётся.';
        } else if (/credit balance|too low|insufficient/i.test(err)) {
          honest = 'ОКО Ai сейчас не отвечает: у сервиса закончился оплаченный лимит. Это не твой баланс и не твоя подписка — вернётся, как только лимит пополнят.';
        } else if (/no anthropic key|no key/i.test(err)) {
          honest = 'ОКО Ai ещё не подключён на сервере — отвечать пока нечем. Твоё сообщение осталось в переписке.';
        } else if (/rate|429|слишком/i.test(err)) {
          honest = 'Слишком много сообщений подряд. Подожди минуту и отправь ещё раз.';
        } else {
          honest = 'ОКО Ai не смог ответить. Сервер сказал так: ' + String(err).slice(0, 160);
        }
        push('ai', honest);
        appendBubble('ai', honest);
        setStatus('нет связи');
      }
    }

    var req;
    try {
      req = fetch(api + '?action=assistant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ msg: text, history: hist, context: ctx, email: email })
      });
    } catch (e) {
      finish(null, 'net');
      return;
    }
    req.then(function (r) { return r.json(); })
      .then(function (d) {
        if (d && d.ok && d.reply) finish(String(d.reply));
        /* сервер ответил и назвал причину — передаём её, а не выдумываем «нет связи» */
        else if (d && d.ok === false && d.error) finish(null, String(d.error));
        else finish(null, 'net');
      })
      .catch(function () { finish(null, 'net'); });
  }

  function clearHistory() {
    if (!window.confirm('Очистить переписку с ОКО Ai? Сообщения удалятся с этого устройства.')) return;
    try { localStorage.removeItem(HIST_KEY); } catch (e) {}
    render();
    setStatus('на связи');
    say('Переписка очищена');
  }

  /* --------------------------------------------------- показ / скрытие экрана */
  function openScreen() {
    build();
    el.classList.add('open');
    document.documentElement.classList.add('oko-ai-open');
    fitViewport();
    render();
    setStatus(busy ? 'печатает…' : 'на связи');
  }

  function hideScreen() {
    if (!el) return;
    closeMenu();
    el.classList.remove('open');
    document.documentElement.classList.remove('oko-ai-open');
  }

  function isOpen() { return !!(el && el.classList.contains('open')); }

  /* Выход по кнопке «назад»: уходим через closeMa(), чтобы navstack ядра
     (Escape, системная «назад», Telegram BackButton) остался согласованным. */
  function closeScreen() {
    hideScreen();
    try {
      if (typeof window.closeMa === 'function') window.closeMa();
    } catch (e) {}
  }

  /* ------------------------------------------------- клавиатура и вьюпорт
     Экран — position:fixed. На мобильных клавиатура не уменьшает layout-вьюпорт,
     поэтому композер уехал бы под неё. Подгоняем высоту по visualViewport. */
  function fitViewport() {
    if (!el) return;
    var vv = window.visualViewport;
    if (!vv) { el.style.top = '0px'; el.style.height = ''; el.style.bottom = '0px'; return; }
    var kb = window.innerHeight - vv.height;
    if (kb > 90) {                      /* клавиатура открыта */
      el.style.top = Math.max(0, vv.offsetTop) + 'px';
      el.style.bottom = 'auto';
      el.style.height = vv.height + 'px';
    } else {                            /* обычное состояние — во весь экран */
      el.style.top = '0px';
      el.style.bottom = '0px';
      el.style.height = '';
    }
    scrollDown();
  }

  if (window.visualViewport) {
    window.visualViewport.addEventListener('resize', function () { if (isOpen()) fitViewport(); });
    window.visualViewport.addEventListener('scroll', function () { if (isOpen()) fitViewport(); });
  }
  window.addEventListener('resize', function () { if (isOpen()) fitViewport(); });
  window.addEventListener('orientationchange', function () { if (isOpen()) setTimeout(fitViewport, 250); });

  /* ------------------------------------------------------ перехват экрана
     openMa('helper') ядра открывает .ma-view#ma-helper со старой вёрсткой .hp-*.
     Прячем его и показываем наш ЛС-экран. closeMa() гасит наш экран. */
  function patch() {
    if (typeof window.openMa === 'function' && !window.openMa.__okoAi) {
      var prevOpen = window.openMa;
      var openWrap = function (id) {
        prevOpen(id);
        if (id === 'helper') {
          var v = document.getElementById('ma-helper');
          if (v) v.style.display = 'none';     /* старую вёрстку не показываем */
          openScreen();
        } else {
          hideScreen();
        }
      };
      openWrap.__okoAi = true;
      window.openMa = openWrap;
    }

    if (typeof window.closeMa === 'function' && !window.closeMa.__okoAi) {
      var prevClose = window.closeMa;
      var closeWrap = function () {
        hideScreen();
        prevClose();
      };
      closeWrap.__okoAi = true;
      window.closeMa = closeWrap;
    }

    /* Переход на другую вкладку гасит экран (страховка от «зависшего» оверлея). */
    if (typeof window.showTab === 'function' && !window.showTab.__okoAi) {
      var prevTab = window.showTab;
      var tabWrap = function (t) {
        hideScreen();
        return prevTab.apply(this, arguments);
      };
      tabWrap.__okoAi = true;
      window.showTab = tabWrap;
    }

    /* Старые точки входа ядра ведут в новый экран (в т.ч. кнопки .hp-q). */
    window.helperRender = function () { if (isOpen()) render(); };
    window.helperSend = function (t) { openScreen(); send(t); };
    window.helperSendFromInput = function () { sendFromInput(); };
    window.helperReset = function () { clearHistory(); };
    window.helperReceive = function (t) {
      push('ai', String(t || ''));
      if (isOpen()) appendBubble('ai', String(t || ''));
    };
  }

  /* Публичное API — на случай вызова из других модулей и из пробника. */
  window.okoAi = {
    open: function () {
      if (typeof window.showTab === 'function') window.showTab('mini');
      if (typeof window.openMa === 'function') window.openMa('helper');
      else openScreen();
    },
    close: closeScreen,
    send: send,
    render: render,
    isOpen: isOpen,
    el: function () { return el; }
  };

  if (document.readyState === 'loading')
    document.addEventListener('DOMContentLoaded', function () { setTimeout(patch, 0); });
  else setTimeout(patch, 0);
})();
