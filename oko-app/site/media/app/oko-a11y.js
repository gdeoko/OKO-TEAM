/* ============================================================================
   OKO · СЛОЙ ДОСТУПНОСТИ (a11y)
   ----------------------------------------------------------------------------
   Задача слоя — сделать приложение пригодным для работы с клавиатуры, со
   скринридером и для людей со слабым зрением, НЕ переписывая ядро и не трогая
   чужие слои. Всё, что делает файл, — добавляет атрибуты, стили и обработчики
   поверх уже готовой разметки.

   Что внутри:
     1. Стили: видимый фокус-ринг в фирменном стиле, поднятый контраст в
        светлой теме, скрытый класс для текста «только для скринридера»,
        уважение к prefers-reduced-motion и prefers-contrast.
     2. Именователь: интерактивные элементы без доступного имени получают
        осмысленный русский aria-label (по иконке из спрайта, по соседнему
        тексту, по placeholder). Декоративные <svg> закрываются от озвучки.
     3. Шторки: крупные оверлеи получают role="dialog" + aria-modal + имя,
        ловушку фокуса по Tab, возврат фокуса на открывшую кнопку и inert
        для фона.
     4. Состояния: aria-pressed у переключателей, aria-selected у вкладок,
        aria-current у нижнего меню, aria-expanded у раскрывашек,
        role="status" + aria-live у тостов и счётчиков.
     5. Цели нажатия: всё, что меньше 44×44, получает невидимый расширитель
        области нажатия — вид не меняется, палец попадает.

   Ничего не выдумывает и ничего не подтверждает от имени человека: слой
   только описывает то, что уже есть на экране.
   ========================================================================= */
(function () {
  'use strict';
  if (window.__okoA11yLoaded) return;
  window.__okoA11yLoaded = true;

  var MIN_TARGET = 44;      /* минимальная цель нажатия, CSS-пиксели */
  var HIT_CAP    = 10;      /* насколько максимум расширяем область нажатия */
  var DLG_AREA   = 0.55;    /* доля вьюпорта, с которой оверлей считаем модальным */

  /* ==========================================================================
     1. СТИЛИ
     ========================================================================== */

  var CSS = [
    /* ---- фирменный фокус-ринг -------------------------------------------
       Лаймовое кольцо + контрастный ореол: кольцо видно и на чёрном фоне,
       и поверх лаймовой кнопки. В светлой теме кольцо тёмно-зелёное с белым
       ореолом — контраст ≥ 9:1 к обеим подложкам бренда. */
    ':root{--oko-focus:#9AFF00;--oko-focus-halo:rgba(0,0,0,.92);--oko-accent-fill:var(--lime,#9AFF00)}',
    ':root[data-theme="light"]{--oko-focus:#1d3d00;--oko-focus-halo:rgba(255,255,255,.95);--oko-accent-fill:#53a800}',

    /* Селектор универсальный: клавиатурный фокус ловят и прокручиваемые
       контейнеры, которые Chrome делает фокусируемыми сам, без tabindex. */
    ':focus-visible,.oko-a11y-ring:focus{' +
      'outline:3px solid var(--oko-focus)!important;outline-offset:2px!important;' +
      'box-shadow:0 0 0 6px var(--oko-focus-halo)!important' +
    '}',
    /* Шторка, получившая фокус как контейнер, обводкой не мигает: человек и так
       понимает, где он, а рамка вокруг всего экрана выглядит поломкой. */
    '[role="dialog"]:focus,[role="alertdialog"]:focus{outline:none!important;box-shadow:none!important}',

    /* ---- текст только для скринридера ---- */
    '.oko-sr{position:absolute!important;width:1px;height:1px;margin:-1px;padding:0;' +
      'overflow:hidden;clip:rect(0 0 0 0);clip-path:inset(50%);white-space:nowrap;border:0}',
    /* Ссылка «к содержимому» — прячется, пока её не поймали клавиатурой. */
    '#okoSkipLink{position:fixed;left:50%;transform:translate(-50%,-140%);z-index:2147483000;' +
      'top:calc(var(--oko-safe-top,0px) + 8px);padding:11px 18px;border-radius:99px;' +
      'background:var(--lime,#9AFF00);color:#000;font:700 14px/1 var(--font-body,sans-serif);' +
      'text-decoration:none;box-shadow:0 8px 26px rgba(0,0,0,.5);transition:transform .18s}',
    '#okoSkipLink:focus{transform:translate(-50%,0)}',

    /* ---- расширители области нажатия -------------------------------------
       Псевдоэлемент лежит поверх кнопки и добирает недостающие пиксели.
       Вид не меняется: он полностью прозрачный. */
    /* position:relative выставляет JS и только там, где элемент был static —
       иначе можно случайно перебить чужой absolute и развалить раскладку. */
    '.oko-hit-a::after,.oko-hit-b::before{content:"";position:absolute;' +
      'top:calc(-1 * var(--oko-hit-y,0px));bottom:calc(-1 * var(--oko-hit-y,0px));' +
      'left:calc(-1 * var(--oko-hit-x,0px));right:calc(-1 * var(--oko-hit-x,0px));' +
      'border-radius:inherit;background:transparent;pointer-events:auto}',
    '.oko-hitpad{position:absolute;top:calc(-1 * var(--oko-hit-y,0px));' +
      'bottom:calc(-1 * var(--oko-hit-y,0px));left:calc(-1 * var(--oko-hit-x,0px));' +
      'right:calc(-1 * var(--oko-hit-x,0px));border-radius:inherit;background:transparent}',

    /* ---- контраст: светлая тема -------------------------------------------
       Считано по формуле WCAG. Прежний --accent #53a800 давал 3.01:1 на белом
       и 2.7:1 на лаймовой подложке — обычный текст читался плохо. Новый
       #3a7600 даёт ≥ 4.7:1 на всех светлых подложках бренда.
       Заливки, где по акценту идёт чёрный текст, остаются светлыми:
       на них работает отдельный токен --oko-accent-fill. */
    ':root[data-theme="light"]{--accent:#3a7600}',
    'html:root[data-theme="light"] .ac-block-n,' +
    'html:root[data-theme="light"] .ac-ord-step .n,' +
    'html:root[data-theme="light"] .ac-lifehack .ic,' +
    'html:root[data-theme="light"] .lg-actions .lg-btn-pdf:hover,' +
    'html:root[data-theme="light"] .ps-follow-mini,' +
    'html:root[data-theme="light"] .ps-acc-check,' +
    'html:root[data-theme="light"] .mp-pick-ok,' +
    'html:root[data-theme="light"] .ps-soc-best-badge,' +
    'html:root[data-theme="light"] .ps-soc-mk-btn,' +
    'html:root[data-theme="light"] .ps-soc-auto-h button,' +
    'html:root[data-theme="light"] .notif-dot.np-count.np-only-imp,' +
    'html:root[data-theme="light"] .pp-lb-row.you::after,' +
    'html:root[data-theme="light"] .vr-native-btn,' +
    'html:root[data-theme="light"] .vr-nudge-cta,' +
    'html:root[data-theme="light"] .vr-pu-actions .primary,' +
    'html:root[data-theme="light"] .vr-pu-cta .btn-primary,' +
    'html:root[data-theme="light"] .vr-pu-soc a .ico,' +
    'html:root[data-theme="light"] .vr-pu-ref .ico,' +
    'html:root[data-theme="light"] .vr-refsq-goal.done .badge,' +
    'html:root[data-theme="light"] .vr-lb-share,' +
    'html:root[data-theme="light"] .sys-chk-item.on .sys-chk-mark,' +
    'html:root[data-theme="light"] .sys-tl-item:first-child .sys-tl-dot,' +
    'html:root[data-theme="light"] .anketa-mode-badge,' +
    'html:root[data-theme="light"] .onb2-opt.on .onb2-ck,' +
    'html:root[data-theme="light"] .onb2-chip.on,' +
    'html:root[data-theme="light"] .w2-acts button.prim' +
      '{background:var(--oko-accent-fill);border-color:var(--oko-accent-fill)}',

    /* Кнопка «Найти каналы»: подпись внутри лаймовой кнопки наследовала
       серый .fa-empty span и давала 2.2:1 по чёрному тексту кнопки. */
    '.fa-empty-cta span,.fa-empty-cta small{color:inherit}',
    /* «в сети» — зелёный #3ddc5a на белом даёт 1.8:1. В тёмной теме он в норме. */
    ':root[data-theme="light"] .pp2-nick .pp2-online,' +
    ':root[data-theme="light"] .status .pp2-online{color:#1a7d33}',
    /* Мелкий юридический текст на экране входа: #5c5c5c по чёрному — 3.1:1.
       Поднимаем до штатного --dim (7.4:1), кегль и вид не меняются. */
    '.auth-legal{color:var(--dim)}',

    /* ---- уважение к системным настройкам --------------------------------- */
    '@media (prefers-reduced-motion:reduce){' +
      'html{scroll-behavior:auto!important}' +
      '*,*::before,*::after{animation-duration:.01ms!important;animation-delay:0s!important;' +
        'animation-iteration-count:1!important;transition-duration:.01ms!important;' +
        'transition-delay:0s!important;scroll-behavior:auto!important}' +
      '[class*="parallax"],[class*="marquee"],[class*="ticker"]{transform:none!important}' +
    '}',
    /* prefers-contrast: more — те же усиления, что даёт ручной тумблер
       «Высокий контраст» в настройках, но без спроса, по системной настройке. */
    '@media (prefers-contrast:more){' +
      ':root{--dim:#d6ddE6;--border:#48525f}' +
      ':root[data-theme="light"]{--dim:#1b2230;--border:#6f7d90;--text:#000;--accent:#2f6100}' +
      ':where(button,a[href],[role="button"]):focus-visible{outline-width:4px!important}' +
    '}',

    /* ---- крупный системный шрифт ------------------------------------------
       При кегле 120–135 % подписи в нижнем меню и в шапках раньше упирались
       в фиксированную высоту. Высоты становятся минимальными, а не жёсткими. */
    '#tabs button{height:auto;min-height:46px}',
    '#tabs button span,#tabs button{overflow:visible}',
    '.oko-a11y-fit{min-height:0;height:auto}',
  ].join('\n');

  function injectCSS() {
    var s = document.getElementById('oko-a11y-css');
    if (!s) {
      s = document.createElement('style');
      s.id = 'oko-a11y-css';
      s.textContent = CSS;
    }
    /* Слои полировки вставляют свои стили в head во время работы. Чтобы наши
       правила не проиграли по порядку, держим тег последним. */
    (document.head || document.documentElement).appendChild(s);
  }
  injectCSS();

  /* ==========================================================================
     2. СЛОВАРЬ ИКОНОК → РУССКОЕ ИМЯ ДЕЙСТВИЯ
     Спрайт лежит в index.html как <symbol id="i-…">. Кнопка-иконка без текста
     получает имя отсюда. Имена — глаголы/существительные действия, как их
     назовёт человек вслух.
     ========================================================================== */
  var ICON_NAME = {
    'logo': 'OKO', 'chev': 'Раскрыть', 'back': 'Назад',
    'arrow-up': 'Вверх', 'arrow-down': 'Вниз', 'fa-up': 'Наверх', 'pp-up': 'Наверх',
    'x': 'Закрыть', 'plus': 'Добавить', 'check': 'Готово', 'check2': 'Готово',
    'more': 'Ещё', 'dots-h': 'Ещё', 'search': 'Поиск', 'refresh': 'Обновить',
    'gear': 'Настройки', 'info': 'Подробнее', 'warning': 'Предупреждение',
    'shield': 'Безопасность', 'mpshield': 'Безопасная сделка', 'target': 'Цель',
    'link': 'Ссылка', 'download': 'Скачать', 'dl': 'Скачать', 'share': 'Поделиться',
    'pp-share': 'Поделиться', 'copy': 'Копировать', 'edit': 'Редактировать',
    'trash': 'Удалить', 'bookmark': 'В закладки', 'pin': 'Закрепить',
    'flag': 'Пожаловаться', 'star': 'В избранное', 'heart': 'Нравится',
    'eye': 'Показать', 'lock': 'Защищено', 'fingerprint': 'Вход по отпечатку',
    'globe': 'Язык', 'clock': 'Время', 'bell': 'Уведомления', 'sun': 'Светлая тема',
    'moon': 'Тёмная тема', 'logout': 'Выйти', 'folder': 'Папка', 'file': 'Файл',
    'chat': 'Чаты', 'comment': 'Комментарии', 'send': 'Отправить',
    'mic': 'Голосовое сообщение', 'mic-off': 'Выключить микрофон',
    'clip': 'Прикрепить', 'photo': 'Фото', 'attach-photo': 'Прикрепить фото',
    'camera': 'Камера', 'cam-off': 'Выключить камеру', 'video-note': 'Кружок',
    'sticker': 'Стикеры', 'poll': 'Опрос', 'reply': 'Ответить',
    'forward': 'Переслать', 'clips': 'Клипы', 'ratio-916': 'Вертикальный формат',
    'ratio-169': 'Горизонтальный формат', 'play': 'Воспроизвести',
    'circle-play': 'Воспроизвести', 'pause': 'Пауза',
    'phone': 'Позвонить', 'call-in': 'Входящий звонок', 'call-end': 'Завершить звонок',
    'speaker': 'Звук включён', 'speaker-off': 'Звук выключен',
    'megaphone': 'Каналы', 'user': 'Профиль', 'users': 'Участники', 'feed': 'Лента',
    'bolt': 'Мини-аппы', 'fire': 'В огне', 'gm-flame': 'Серия',
    'thumb': 'Нравится', 'laugh': 'Смешно', 'wow': 'Удивительно', 'sad': 'Грустно',
    'pos': 'Реакция', 'briefcase': 'Работа', 'compass': 'Обзор', 'rocket': 'Продвижение',
    'crown': 'Премиум', 'vr-crown': 'Премиум', 'device': 'Устройство',
    'chart': 'Статистика', 'gm-chart': 'Статистика', 'gm-scales': 'Шансы',
    'gm-ticket': 'Билет', 'xp': 'Опыт', 'gift': 'Подарок', 'pp-gift': 'Подарок',
    'card': 'Карта', 'money': 'Кошелёк', 'wallet': 'Кошелёк', 'swap': 'Обмен',
    'ton': 'TON', 'qr': 'QR-код', 'pp-qr': 'QR-код', 'vr-qr': 'QR-код',
    'pp-calc': 'Калькулятор', 'apple': 'Apple', 'google': 'Google',
    'verified': 'Подтверждённый аккаунт', 'vr-badge': 'Значок',
    'pp-badge-check': 'Подтверждено', 'vr-story': 'История',
    'vr-tg': 'Telegram', 'vr-tt': 'TikTok', 'vr-vk': 'ВКонтакте', 'vr-wa': 'WhatsApp',
    'vr-fire': 'В огне', 'vs-recv': 'Получено', 'mk-filter': 'Фильтры',
    'mk-sort': 'Сортировка', 'mk-archive': 'В архив', 'mk-tag': 'Метка',
    'sp-al': 'По левому краю', 'sp-ac': 'По центру', 'sp-ar': 'По правому краю',
    'em-smile': 'Смайлы', 'em-paw': 'Животные', 'em-food': 'Еда', 'em-ball': 'Спорт',
    'em-plane': 'Путешествия', 'em-bulb': 'Предметы', 'em-sym': 'Символы',
    'em-gif': 'GIF', 'em-bksp': 'Стереть', 'em-add': 'Добавить'
  };

  /* Точечные имена для элементов ядра, у которых иконки нет вовсе. */
  var ID_NAME = {
    'sheetOverlay': 'Закрыть шторку',
    'okoEmClose': 'Закрыть панель эмодзи',
    'okoEmBksp': 'Стереть символ',
    'walEye': 'Показать или скрыть баланс',
    'cpMoreBtn': 'Ещё действия'
  };

  /* ==========================================================================
     3. ВСПОМОГАТЕЛЬНОЕ
     ========================================================================== */

  function txt(el) { return (el && el.textContent || '').replace(/\s+/g, ' ').trim(); }

  function isVisible(el) {
    if (!el || !el.getBoundingClientRect) return false;
    var cs = getComputedStyle(el);
    if (cs.display === 'none' || cs.visibility === 'hidden') return false;
    if (parseFloat(cs.opacity) < 0.05) return false;
    var r = el.getBoundingClientRect();
    if (r.width <= 0 || r.height <= 0) return false;
    if (r.left >= innerWidth - 1 || r.right <= 1) return false;
    if (r.top >= innerHeight - 1 || r.bottom <= 1) return false;
    return true;
  }

  /* Доступное имя по упрощённой спецификации accname. */
  function accName(el) {
    var v = (el.getAttribute('aria-label') || '').trim();
    if (v) return v;
    var lb = el.getAttribute('aria-labelledby');
    if (lb) {
      var s = lb.split(/\s+/).map(function (id) {
        var t = document.getElementById(id);
        return t ? ((t.getAttribute('aria-label') || txt(t))) : '';
      }).join(' ').trim();
      if (s) return s;
    }
    if (el.matches('input,textarea,select')) {
      if (el.id) {
        var l = document.querySelector('label[for="' + (window.CSS && CSS.escape ? CSS.escape(el.id) : el.id) + '"]');
        if (l && txt(l)) return txt(l);
      }
      var wrap = el.closest('label');
      if (wrap && txt(wrap)) return txt(wrap);
      var ph = (el.getAttribute('placeholder') || '').trim();
      if (ph) return ph;
      if (el.type === 'submit' || el.type === 'button') {
        var val = (el.value || '').trim(); if (val) return val;
      }
    }
    var own = txt(el);
    if (own) return own;
    var img = el.querySelector('img[alt]');
    if (img && img.alt.trim()) return img.alt.trim();
    var t2 = (el.getAttribute('title') || '').trim();
    if (t2) return t2;
    var st = el.querySelector('svg > title');
    if (st && txt(st)) return txt(st);
    return '';
  }

  var INTERACTIVE = 'button, a[href], input:not([type="hidden"]), select, textarea,' +
    ' [role="button"], [role="link"], [role="tab"], [role="switch"], [role="checkbox"],' +
    ' [role="menuitem"], [role="option"], [tabindex]:not([tabindex="-1"])';

  function interactives(root) {
    var list = [];
    var nodes = (root || document).querySelectorAll(INTERACTIVE);
    for (var i = 0; i < nodes.length; i++) {
      var el = nodes[i];
      if (el.disabled) continue;
      if (el.id === 'okoSkipLink') continue;
      if (el.getAttribute('aria-hidden') === 'true') continue;
      list.push(el);
    }
    return list;
  }

  /* ==========================================================================
     4. ИМЕНОВАТЕЛЬ
     Кнопкам-иконкам, безымянным ссылкам и полям без подписи выдаём имя.
     Порядок поиска: словарь по id элемента → иконка спрайта → текст рядом →
     data-атрибуты. Если имени не нашлось — элемент попадает в отчёт, а не
     получает выдуманную подпись.
     ========================================================================== */

  function iconIdOf(el) {
    var use = el.querySelector('svg use, use');
    if (!use) return '';
    var href = use.getAttribute('href') || use.getAttribute('xlink:href') || '';
    var m = /#i-([a-z0-9-]+)/i.exec(href);
    return m ? m[1] : '';
  }

  /* Соседний текст: подпись строки, заголовок карточки, значение чипа. */
  function contextName(el) {
    var d = el.getAttribute('data-title') || el.getAttribute('data-name') ||
            el.getAttribute('data-label') || el.getAttribute('data-t');
    if (d && d.trim()) return d.trim();
    var p = el.parentElement;
    if (p) {
      var t = txt(p);
      if (t && t.length <= 60) return t;
    }
    return '';
  }

  function nameOne(el) {
    if (accName(el)) return true;
    var name = '';

    if (el.id && ID_NAME[el.id]) name = ID_NAME[el.id];

    if (!name) {
      var ico = iconIdOf(el);
      if (ico && ICON_NAME[ico]) name = ICON_NAME[ico];
    }
    if (!name && el.matches('input,textarea,select')) {
      /* Поле без подписи: берём заголовок обёртки-строки настроек. */
      var row = el.closest('label,.prow,.st2-row,.field,.form-row');
      if (row) {
        var clone = row.cloneNode(true);
        var ins = clone.querySelectorAll('input,textarea,select');
        for (var i = 0; i < ins.length; i++) ins[i].remove();
        var t = txt(clone);
        if (t && t.length <= 70) name = t;
      }
      if (!name && el.type) {
        var byType = { search: 'Поиск', tel: 'Телефон', email: 'Электронная почта',
                       password: 'Пароль', date: 'Дата', time: 'Время',
                       range: 'Ползунок', file: 'Выбрать файл', number: 'Число' };
        if (byType[el.type]) name = byType[el.type];
      }
    }
    if (!name) name = contextName(el);

    if (name) { el.setAttribute('aria-label', name); return true; }
    return false;
  }

  /* Декоративная графика не должна читаться вслух: скринридер иначе диктует
     содержимое <svg> вместо подписи кнопки. */
  function hideDecorativeSvg(root) {
    var svgs = (root || document).querySelectorAll('svg:not([aria-hidden]):not([role="img"])');
    for (var i = 0; i < svgs.length; i++) {
      var s = svgs[i];
      if (s.querySelector('title')) { s.setAttribute('role', 'img'); continue; }
      s.setAttribute('aria-hidden', 'true');
      s.setAttribute('focusable', 'false');
    }
  }

  function runNaming(root) {
    var left = 0;
    var els = interactives(root);
    for (var i = 0; i < els.length; i++) if (!nameOne(els[i])) left++;
    hideDecorativeSvg(root);
    return left;
  }

  /* ==========================================================================
     5. СОСТОЯНИЯ: aria-pressed / aria-selected / aria-current / aria-expanded
     ========================================================================== */

  var ON_RE = /(^|\s)(on|active|sel|selected|checked)(\s|$)/;

  function syncStates(root) {
    var scope = root || document;

    /* Нижнее меню — это навигация, а не тумблеры: активная вкладка помечается
       aria-current, иначе скринридер читает «нажато» про переход по разделам. */
    var nav = document.getElementById('tabs');
    if (nav) {
      var nb = nav.querySelectorAll('button');
      for (var i = 0; i < nb.length; i++) {
        if (nb[i].classList.contains('active')) nb[i].setAttribute('aria-current', 'page');
        else nb[i].removeAttribute('aria-current');
      }
    }

    /* Группы чипов и вкладок: две и больше однотипных кнопок, у одной из них
       состояние «включено». */
    var groups = scope.querySelectorAll('.feed-tabs, .ps-tabs, .st2-tabs, [role="tablist"],' +
      '.m2-tabs, .np-chips, .acd-chips, .mk-tabs, .w2-tabs, .ch-tabs, .pp-deep-tabs');
    for (var g = 0; g < groups.length; g++) {
      var btns = groups[g].querySelectorAll('button,[role="tab"]');
      if (btns.length < 2) continue;
      var isTablist = groups[g].getAttribute('role') === 'tablist' ||
                      (btns[0].getAttribute('role') === 'tab');
      for (var b = 0; b < btns.length; b++) {
        var on = ON_RE.test(btns[b].className || '');
        if (isTablist) btns[b].setAttribute('aria-selected', on ? 'true' : 'false');
        else btns[b].setAttribute('aria-pressed', on ? 'true' : 'false');
      }
    }

    /* Одиночные чипы-фильтры вне известных групп. */
    var chips = scope.querySelectorAll('button.chip, button.m2-chip, button.np-chip,' +
      ' button.acd-chip, button.st2-chip, button.mk-chip, button.ch-chip');
    for (var c = 0; c < chips.length; c++) {
      if (chips[c].hasAttribute('aria-selected')) continue;
      chips[c].setAttribute('aria-pressed', ON_RE.test(chips[c].className || '') ? 'true' : 'false');
    }

    /* Тумблеры: визуальный переключатель внутри строки настроек. */
    var rows = scope.querySelectorAll('button.prow, .st2-row button, button.s2-row');
    for (var r = 0; r < rows.length; r++) {
      var sw = rows[r].querySelector('.switch,.s2-sw,.onb2-sw,.st2-sw,.sw');
      if (!sw) continue;
      rows[r].setAttribute('role', 'switch');
      rows[r].setAttribute('aria-checked', ON_RE.test(sw.className || '') ? 'true' : 'false');
    }

    /* Раскрывашки: кнопка, за которой идёт панель, получающая класс «open». */
    var btnsAll = scope.querySelectorAll('button');
    for (var k = 0; k < btnsAll.length; k++) {
      var btn = btnsAll[k], next = btn.nextElementSibling;
      if (!next) continue;
      var cn = ' ' + (next.className || '') + ' ';
      if (!/\b(quiet|acc|accordion|collapse|drop|foldable|expand)/.test(cn)) continue;
      if (!next.id) next.id = 'okoA11yExp' + (k + 1);
      btn.setAttribute('aria-controls', next.id);
      btn.setAttribute('aria-expanded', /\b(open|on|show|expanded)\b/.test(cn) ? 'true' : 'false');
    }
  }

  /* ==========================================================================
     6. ЖИВЫЕ ОБЛАСТИ: тосты и счётчики
     ========================================================================== */

  function syncLive() {
    var t = document.getElementById('toast');
    if (t && !t.hasAttribute('aria-live')) {
      t.setAttribute('role', 'status');
      t.setAttribute('aria-live', 'polite');
      t.setAttribute('aria-atomic', 'true');
    }
    /* Счётчики непрочитанного: цифра сама по себе непонятна на слух. */
    var badges = document.querySelectorAll('.badge, .unread, .notif-dot, .np-count, .ci-badge');
    for (var i = 0; i < badges.length; i++) {
      var b = badges[i], n = txt(b);
      if (!/^\d+\+?$/.test(n)) continue;
      var label = 'непрочитанных: ' + n;
      if (b.getAttribute('aria-label') !== label) b.setAttribute('aria-label', label);
      if (!b.hasAttribute('aria-live')) b.setAttribute('aria-live', 'polite');
    }
  }

  /* ==========================================================================
     7. ЦЕЛИ НАЖАТИЯ ≥ 44×44
     Область нажатия добираем невидимым псевдоэлементом — вид не меняется.
     По горизонтали расширяемся не больше чем на половину промежутка до
     соседа, иначе кнопка начнёт перехватывать чужие нажатия.
     ========================================================================== */

  function freeSpaceX(el, r) {
    var free = HIT_CAP;
    var p = el.parentElement;
    if (!p) return free;
    var sibs = p.children;
    for (var i = 0; i < sibs.length; i++) {
      var s = sibs[i];
      if (s === el || !s.getBoundingClientRect) continue;
      var sr = s.getBoundingClientRect();
      if (sr.width <= 0 || sr.height <= 0) continue;
      if (sr.bottom <= r.top + 1 || sr.top >= r.bottom - 1) continue;  /* другая строка */
      var gap = sr.left >= r.right ? sr.left - r.right : (sr.right <= r.left ? r.left - sr.right : 0);
      if (gap === 0) return 0;
      free = Math.min(free, gap / 2);
    }
    return Math.max(0, free);
  }

  /* Иконочные кнопки в плотных рядах шапки расширителем до 44 не дотягиваются:
     соседи в двух пикселях, и невидимая область начала бы воровать чужие
     нажатия. Тогда честнее вырастить саму кнопку — но только если строка это
     переживает без переполнения. Не пережила — откатываемся, вид дороже. */
  function growIfRoom(el) {
    var p = el.parentElement;
    if (!p) return;
    var pcs = getComputedStyle(p);
    var scroller = pcs.overflowX === 'auto' || pcs.overflowX === 'scroll';

    /* В ряду, который листается вбок, расти НЕЛЬЗЯ.
       Прежнее правило считало наоборот: раз родитель и так прокручивается,
       переполнение не страшно — и оставляло рост. На деле это делало ленту
       длиннее, и то, что было за краем, уезжало ещё дальше. В панели эмодзи
       из-за этого лента категорий требовала 396 px при 374 доступных, и
       стикеры с ГИФ прятались за правым краем — та самая беда, из-за которой
       Даниэль и просил переделать панель.
       Правило OKO: ничего не прячем за краем. Область нажатия таким кнопкам
       расширит невидимый расширитель ниже — палец попадёт, вид не поедет. */
    if (scroller) return;

    var prevW = el.style.minWidth, prevH = el.style.minHeight;
    var before = p.scrollWidth - p.clientWidth;
    el.style.minWidth = MIN_TARGET + 'px';
    el.style.minHeight = MIN_TARGET + 'px';
    var after = p.scrollWidth - p.clientWidth;
    var de = document.documentElement;
    var rootOverflow = de.scrollWidth - de.clientWidth;
    if (after > Math.max(1, before) || rootOverflow > 1) {
      el.style.minWidth = prevW;
      el.style.minHeight = prevH;
    }
  }

  function padTarget(el) {
    if (el.dataset.okoHit === '1') return true;
    var r = el.getBoundingClientRect();
    if (r.width <= 0 || r.height <= 0) return false;
    var needY = Math.max(0, (MIN_TARGET - r.height) / 2);
    var needX = Math.max(0, (MIN_TARGET - r.width) / 2);
    if (!needY && !needX) { el.dataset.okoHit = '1'; return true; }

    /* Узкая кнопка — сперва пробуем вырасти по-настоящему. */
    if (needX > 0 && !el.matches('input,textarea,select')) {
      growIfRoom(el);
      r = el.getBoundingClientRect();
      needY = Math.max(0, (MIN_TARGET - r.height) / 2);
      needX = Math.max(0, (MIN_TARGET - r.width) / 2);
      if (!needY && !needX) { el.dataset.okoHit = '1'; return true; }
    }

    /* Поля ввода псевдоэлементов не имеют: им растим саму высоту и, если надо,
       высоту визуальной обёртки-пилюли. */
    if (el.matches('input,textarea,select')) {
      var p = el.parentElement;
      if (p) {
        var pr = p.getBoundingClientRect();
        var pcs = getComputedStyle(p);
        if (pcs.display.indexOf('flex') >= 0) el.style.alignSelf = 'stretch';
        if (pr.height < MIN_TARGET && pr.height > 0 && pr.height < 90) {
          p.style.minHeight = MIN_TARGET + 'px';
          if (pcs.display.indexOf('flex') >= 0 && !pcs.alignItems) p.style.alignItems = 'center';
        }
      }
      if (r.height < MIN_TARGET) el.style.minHeight = Math.min(MIN_TARGET, 44) + 'px';
      el.dataset.okoHit = '1';
      return true;
    }

    needX = Math.min(needX, freeSpaceX(el, r), HIT_CAP);
    needY = Math.min(needY, HIT_CAP);
    if (!needX && !needY) { el.dataset.okoHit = 'capped'; return false; }

    /* Расширитель позиционируется от самого элемента, поэтому статичным
       элементам нужен relative. Уже позиционированные не трогаем. */
    if (getComputedStyle(el).position === 'static') el.style.position = 'relative';
    el.style.setProperty('--oko-hit-x', needX.toFixed(1) + 'px');
    el.style.setProperty('--oko-hit-y', needY.toFixed(1) + 'px');

    /* Свободен ли ::after, ::before — или нужен настоящий дочерний слой. */
    var afterFree = getComputedStyle(el, '::after').content === 'none';
    var beforeFree = getComputedStyle(el, '::before').content === 'none';
    if (afterFree) el.classList.add('oko-hit-a');
    else if (beforeFree) el.classList.add('oko-hit-b');
    else if (!el.matches('input,textarea,select,img,svg')) {
      var pad = document.createElement('span');
      pad.className = 'oko-hitpad';
      pad.setAttribute('aria-hidden', 'true');
      el.classList.add('oko-hit-c');
      el.appendChild(pad);
    } else return false;

    el.dataset.okoHit = '1';
    return true;
  }

  function runTargets(root) {
    var els = interactives(root);
    for (var i = 0; i < els.length; i++) {
      /* Уже обработанные пропускаем до дорогих замеров — иначе тик каждые
         900 мс перемеряет сотни элементов и приложение начинает подтормаживать. */
      if (els[i].dataset.okoHit === '1') continue;
      if (!isVisible(els[i])) continue;
      padTarget(els[i]);
    }
  }

  /* ==========================================================================
     8. ШТОРКИ: role=dialog, aria-modal, ловушка фокуса, возврат фокуса
     ========================================================================== */

  /* Экраны-состояния приложения — не диалоги: заставка, вход, знакомство. */
  var NOT_DIALOG = { splash: 1, authScreen: 1, onboard: 1, 'wm-splash': 1,
                     'pwa-offline': 1, tabs: 1, app: 1, okoTgChrome: 1, okoSkipLink: 1 };

  var stack = [];        /* открытые шторки: {el, opener, wasRole, wasModal, wasTab} */

  /* Крупный полупрозрачный фон под шторкой: если он есть, модальной считается
     и невысокая нижняя шторка — человек всё равно заперт в ней. */
  function backdropPresent() {
    var pts = [[8, 8], [innerWidth - 8, 8], [8, innerHeight - 8]];
    for (var i = 0; i < pts.length; i++) {
      var st = document.elementsFromPoint(pts[i][0], pts[i][1]);
      for (var j = 0; j < st.length && j < 4; j++) {
        var e = st[j];
        if (e === document.body || e === document.documentElement) break;
        var cs = getComputedStyle(e);
        if (cs.position !== 'fixed') continue;
        var r = e.getBoundingClientRect();
        if ((r.width * r.height) / (innerWidth * innerHeight) < 0.9) continue;
        var z = parseInt(cs.zIndex, 10);
        if (isNaN(z) || z < 30) continue;
        if (e.querySelector('#tabs')) continue;
        /* Подложка — это именно затемнение: пустой слой без своих кнопок.
           Полноэкранный раздел (настройки, поиск) кнопки внутри имеет и
           подложкой считаться не должен, иначе его же и не распознаем. */
        if (interactives(e).some(isVisible)) continue;
        return e;
      }
    }
    return null;
  }

  function looksModal(el, hasBackdrop) {
    if (!el || el.nodeType !== 1) return false;
    if (el.id && NOT_DIALOG[el.id]) return false;
    if (el === document.body || el === document.documentElement) return false;
    var cs = getComputedStyle(el);
    if (cs.position !== 'fixed' && cs.position !== 'absolute') return false;
    if (!isVisible(el)) return false;
    var r = el.getBoundingClientRect();
    var cover = (r.width * r.height) / (innerWidth * innerHeight);
    var wide = r.width >= innerWidth * 0.88;
    /* Либо оверлей сам занимает экран, либо это нижняя шторка на затемнении. */
    if (cover < DLG_AREA && !(hasBackdrop && wide && cover >= 0.18)) return false;
    var z = parseInt(cs.zIndex, 10);
    if (isNaN(z) || z < 40) return false;
    if (el.querySelector('#tabs')) return false;            /* это оболочка приложения */
    return interactives(el).some(isVisible);
  }

  /* Имена полноэкранных разделов, у которых заголовок рисуется картинкой или
     собирается из нескольких кусков. Взяты из самих экранов, не выдуманы. */
  var VIEW_NAME = {
    st2View: 'Настройки', searchView: 'Поиск', notifsView: 'Уведомления',
    chView: 'Каналы', adminView: 'Панель владельца', callScreen: 'Звонок',
    systemView: 'Система роста', editProfile: 'Редактирование профиля',
    legalView: 'Документы', regView: 'Регистрация', storyViewer: 'Истории',
    msgMenu: 'Действия с сообщением', psView: 'Профиль', psSocView: 'Мои соцсети',
    spEditor: 'Редактор', spVwWrap: 'Просмотр', trStories: 'Истории основателя',
    faReels: 'Клипы', vrPublic: 'Публичный профиль', okoPopup: 'Сообщение'
  };

  function dialogName(el) {
    var a = (el.getAttribute('aria-label') || '').trim();
    if (a) return a;
    if (el.getAttribute('aria-labelledby')) return accName(el);
    if (el.id && VIEW_NAME[el.id]) return VIEW_NAME[el.id];
    var h = el.querySelector('h1,h2,h3,h4');
    var t = h ? txt(h) : '';
    if (!t) {
      var t2 = el.querySelector('[class*="title"],[class*="-h"],header b');
      t = t2 ? txt(t2) : '';
    }
    if (!t) {
      /* Экран поиска: честнее назвать его подсказкой поля, чем «Диалогом». */
      var inp = el.querySelector('input[placeholder]');
      if (inp) t = (inp.getAttribute('placeholder') || '').trim();
    }
    t = t.split('\n')[0].trim();
    if (t && t.length <= 60) return t;
    return '';
  }

  function focusablesIn(el) {
    return interactives(el).filter(isVisible);
  }

  function openDialog(el) {
    for (var i = 0; i < stack.length; i++) if (stack[i].el === el) return;
    var rec = {
      el: el,
      opener: (document.activeElement && document.activeElement !== document.body)
        ? document.activeElement : null,
      hadRole: el.hasAttribute('role') ? el.getAttribute('role') : null,
      hadModal: el.hasAttribute('aria-modal') ? el.getAttribute('aria-modal') : null,
      hadTab: el.hasAttribute('tabindex') ? el.getAttribute('tabindex') : null,
      hadLabel: el.hasAttribute('aria-label') ? el.getAttribute('aria-label') : null
    };
    if (!rec.hadRole) el.setAttribute('role', 'dialog');
    el.setAttribute('aria-modal', 'true');
    if (!rec.hadLabel) {
      var n = dialogName(el);
      /* Без честного заголовка не выдумываем название экрана — оставляем
         нейтральное «Диалог», чтобы скринридер хотя бы объявил тип. */
      el.setAttribute('aria-label', n || 'Диалог');
    }
    if (rec.hadTab === null) el.setAttribute('tabindex', '-1');
    el.removeAttribute('aria-hidden');
    stack.push(rec);
    applyInert(el);

    /* Фокус — на сам контейнер, не на первую кнопку: так меньше прыжков
       прокрутки и человек слышит имя экрана целиком. */
    if (!el.contains(document.activeElement)) {
      try { el.focus({ preventScroll: true }); } catch (e) { }
    }
  }

  function closeDialog(rec) {
    var el = rec.el;
    if (rec.hadRole === null) el.removeAttribute('role'); else el.setAttribute('role', rec.hadRole);
    if (rec.hadModal === null) el.removeAttribute('aria-modal'); else el.setAttribute('aria-modal', rec.hadModal);
    if (rec.hadTab === null) el.removeAttribute('tabindex'); else el.setAttribute('tabindex', rec.hadTab);
    if (rec.hadLabel === null) el.removeAttribute('aria-label');
    /* Возврат фокуса: человек продолжает с той же кнопки, откуда ушёл. */
    var back = rec.opener;
    if (back && document.contains(back) && isVisible(back)) {
      try { back.focus({ preventScroll: true }); } catch (e) { }
    }
  }

  /* Фон под верхней шторкой уводим из обхода целиком: под ней ничего не
     нажимается и ничего не читается вслух. Считаем от ТЕКУЩЕЙ верхней шторки,
     а не по событиям открытия — иначе при двух шторках подряд нижняя остаётся
     запертой навсегда. */
  var inertTop = null;
  function applyInert(el) {
    var top = null;
    if (el) { top = el; while (top.parentElement && top.parentElement !== document.body) top = top.parentElement; }
    if (top === inertTop) return;
    inertTop = top;
    var kids = document.body.children;
    for (var i = 0; i < kids.length; i++) {
      var k = kids[i];
      var keep = !top || k === top || k.id === 'okoSkipLink' || k.id === 'toast' ||
                 k.tagName === 'STYLE' || k.tagName === 'SCRIPT' || (el && k.contains(el));
      if (keep) {
        if (k.getAttribute('data-oko-inert') === '1') {
          k.removeAttribute('inert');
          k.removeAttribute('data-oko-inert');
        }
      } else if (!k.hasAttribute('inert')) {
        k.setAttribute('inert', '');
        k.setAttribute('data-oko-inert', '1');
      }
    }
  }

  /* Раз в кадр сверяем, какие шторки открыты, какие закрылись. */
  function syncDialogs() {
    /* Закрывшиеся.

       Порядок здесь важнее, чем кажется. closeDialog возвращает фокус на
       кнопку, с которой шторку открыли, — но пока шторка была открыта, фон
       (вместе с этой кнопкой) лежал под inert, а inert пересчитывался в самом
       конце функции. Браузер отказывает в фокусе элементу внутри inert, так
       что focus() молча не срабатывал и фокус улетал на body: после Escape
       человек с клавиатурой оказывался в начале страницы вместо той кнопки,
       откуда ушёл. Пробник ловил это как focusReturned=false во всех трёх
       случаях подряд. Поэтому сначала снимаем инертность, и только потом
       отдаём фокус. */
    var закрылись = [];
    for (var i = stack.length - 1; i >= 0; i--) {
      var rec = stack[i];
      if (!document.contains(rec.el) || !isVisible(rec.el)) {
        stack.splice(i, 1);
        закрылись.push(rec);
      }
    }
    if (закрылись.length) {
      applyInert(stack.length ? stack[stack.length - 1].el : null);
      for (var z2 = 0; z2 < закрылись.length; z2++) closeDialog(закрылись[z2]);
    }
    /* Открывшиеся ищем не обходом всего DOM (это тысячи getComputedStyle на
       каждый тик), а попаданием в точку: что реально лежит поверх экрана.
       Берём верхний элемент под несколькими точками и поднимаемся по предкам
       до контейнера, который выглядит как модальная шторка. */
    var bd = backdropPresent();
    var probes = [[innerWidth / 2, innerHeight / 2],
                  [innerWidth / 2, innerHeight * 0.16],
                  [innerWidth / 2, innerHeight - 12]];
    var best = null, bestZ = -1;
    for (var p = 0; p < probes.length; p++) {
      var st = document.elementsFromPoint(probes[p][0], probes[p][1]);
      for (var i = 0; i < st.length && i < 12; i++) {
        var el = st[i];
        if (el === document.body || el === document.documentElement) break;
        if (!looksModal(el, !!bd)) continue;
        if (el === bd) continue;                  /* сама подложка — не диалог */
        var z = parseInt(getComputedStyle(el).zIndex, 10) || 0;
        if (z >= bestZ) { best = el; bestZ = z; }
        break;
      }
    }
    if (best) openDialog(best);
    /* Инертность всегда считаем от текущей верхней шторки. */
    applyInert(stack.length ? stack[stack.length - 1].el : null);
  }

  /* Ловушка фокуса по Tab: пока шторка открыта, фокус не уходит наружу. */
  document.addEventListener('keydown', function (e) {
    if (e.key !== 'Tab' || !stack.length) return;
    var el = stack[stack.length - 1].el;
    if (!document.contains(el) || !isVisible(el)) return;
    var f = focusablesIn(el);
    if (!f.length) { e.preventDefault(); try { el.focus({ preventScroll: true }); } catch (x) { } return; }
    var first = f[0], last = f[f.length - 1];
    var cur = document.activeElement;
    if (!el.contains(cur)) {
      e.preventDefault();
      (e.shiftKey ? last : first).focus({ preventScroll: true });
      return;
    }
    if (e.shiftKey && cur === first) { e.preventDefault(); last.focus({ preventScroll: true }); }
    else if (!e.shiftKey && cur === last) { e.preventDefault(); first.focus({ preventScroll: true }); }
  }, true);

  /* ==========================================================================
     9. СИСТЕМНЫЕ НАСТРОЙКИ
     ========================================================================== */

  function honourMedia() {
    try {
      var rm = matchMedia('(prefers-reduced-motion: reduce)');
      var apply = function () {
        document.documentElement.classList.toggle('oko-a-motion', rm.matches);
        if (rm.matches) killEndlessAnimations();
      };
      apply();
      rm.addEventListener ? rm.addEventListener('change', apply) : rm.addListener(apply);
    } catch (e) { }
    try {
      var pc = matchMedia('(prefers-contrast: more)');
      var ap2 = function () { document.documentElement.classList.toggle('oko-a-contrast', pc.matches); };
      ap2();
      pc.addEventListener ? pc.addEventListener('change', ap2) : pc.addListener(ap2);
    } catch (e) { }
  }

  /* CSS гасит только те анимации, что описаны в стилях. Бесконечные анимации,
     созданные из JS через Web Animations API, приходится останавливать руками. */
  function killEndlessAnimations() {
    if (!document.getAnimations) return;
    var list = document.getAnimations();
    for (var i = 0; i < list.length; i++) {
      var a = list[i];
      try {
        var t = a.effect && a.effect.getTiming ? a.effect.getTiming() : null;
        if (t && t.iterations === Infinity) a.cancel();
      } catch (e) { }
    }
  }

  /* ==========================================================================
     10. ССЫЛКА «К СОДЕРЖИМОМУ» И ОРИЕНТИРЫ
     ========================================================================== */

  function landmarks() {
    if (!document.getElementById('okoSkipLink')) {
      var main = document.querySelector('main');
      if (main) {
        if (!main.id) main.id = 'okoMain';
        if (!main.hasAttribute('tabindex')) main.setAttribute('tabindex', '-1');
        var a = document.createElement('a');
        a.id = 'okoSkipLink';
        a.href = '#' + main.id;
        a.textContent = 'Перейти к содержимому';
        a.addEventListener('click', function (e) {
          e.preventDefault();
          try { main.focus({ preventScroll: false }); } catch (x) { }
        });
        document.body.insertBefore(a, document.body.firstChild);
      }
    }
    var nav = document.getElementById('tabs');
    if (nav && !nav.getAttribute('aria-label')) nav.setAttribute('aria-label', 'Основные разделы');
    if (!document.documentElement.getAttribute('lang')) document.documentElement.setAttribute('lang', 'ru');
  }

  /* ==========================================================================
     11. ЗАПУСК И НАБЛЮДЕНИЕ
     ========================================================================== */

  /* Проход сам меняет DOM (aria-label, min-width у мелких кнопок), а наблюдатель
     смотрит на style и class — то есть каждый проход будит следующий. Раньше это
     гасил только флаг pending, который снимался в начале прохода: за одно
     переключение вкладки набегало по восемь пар отложенных проходов, а каждый
     проход — это обход всех 5700 узлов документа. Замер: 379 мс занятого потока
     после каждого тапа по нижнему меню (до 779 мс на кошельке).

     Теперь три ограничителя:
       • дебаунс с отменой — пачка мутаций схлопывается в один отложенный
         проход после ПОСЛЕДНЕЙ из них, а не копится парами;
       • грязно — фоновый тик молчит, пока в документе ничего не менялось;
       • сканирую — защита от повторного входа (тик и okoA11y.scan() могут
         совпасть). Петлю «проход → мутация → проход» он НЕ разрывает:
         колбэк наблюдателя приходит микрозадачей уже после того, как проход
         снял флаг. Петля затухает сама, потому что второй проход ничего не
         меняет — aria-label и data-oko-hit уже проставлены. Замер
         tools/probe-a11y-cost.mjs: 1–3 прохода на переключение вместо ~16.

     Голодания при этом нет, хотя дебаунс с отменой к нему располагает: пока
     мутации идут потоком, отложенный проход откладывается снова и снова.
     Полом служит фоновый тик — раз в 900 мс он вызывает scan(), если в
     документе что-то менялось. То есть максимальная задержка прохода
     ограничена не дебаунсом, а тиком. */
  var сканирую = false, грязно = true, т1 = 0, т2 = 0;

  /* Счётчик времени по частям прохода: включается из пробника
     (okoA11y.часы = {}), в обычной работе не стоит ничего. */
  var часы = null;
  function шаг(имя, fn) {
    if (!часы) { try { fn(); } catch (e) { } return; }
    var t = performance.now();
    try { fn(); } catch (e) { }
    часы[имя] = (часы[имя] || 0) + (performance.now() - t);
  }

  function scan() {
    if (сканирую) return;
    сканирую = true;
    грязно = false;
    if (часы) часы.проходов = (часы.проходов || 0) + 1;
    шаг('landmarks', function () { landmarks(); });
    шаг('runNaming', function () { runNaming(document); });
    шаг('syncStates', function () { syncStates(document); });
    шаг('syncLive', function () { syncLive(); });
    шаг('syncDialogs', function () { syncDialogs(); });
    шаг('runTargets', function () { runTargets(document); });
    if (document.documentElement.classList.contains('oko-a-motion')) killEndlessAnimations();
    сканирую = false;
  }

  function schedule() {
    if (сканирую) return;
    грязно = true;
    clearTimeout(т1); clearTimeout(т2);
    т1 = setTimeout(scan, 200);
    /* Шторки выезжают анимацией: на первом проходе их ещё не видно.
       Добираем состояние, когда движение закончилось. */
    т2 = setTimeout(scan, 700);
  }

  function boot() {
    injectCSS();
    honourMedia();
    scan();
    new MutationObserver(schedule).observe(document.documentElement, {
      childList: true, subtree: true, attributes: true,
      attributeFilter: ['class', 'style', 'hidden', 'aria-hidden', 'placeholder']
    });
    /* Переходы между экранами и анимации шторок происходят без мутаций DOM —
       короткий тик добирает то, что наблюдатель не видит. Когда документ не
       менялся, добирать нечего: пустой обход всего дерева каждые 0,9 с — это
       ровно тот фон, из-за которого приложение «нагревалось» к концу сессии. */
    setInterval(function () { if (грязно) scan(); }, 900);
    addEventListener('resize', schedule);
    addEventListener('transitionend', schedule, true);
    addEventListener('animationend', schedule, true);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();

  /* Публичное API — им пользуется пробник oko-app/tools/probe-a11y.mjs. */
  window.okoA11y = {
    scan: scan,
    accName: accName,
    /* Секундомер по частям прохода: okoA11y.часы(true) включает,
       okoA11y.часы() отдаёт накопленное и обнуляет. */
    часы: function (вкл) {
      if (вкл) { часы = {}; return null; }
      var с = часы; часы = null;
      if (!с) return null;
      var о = {}; Object.keys(с).forEach(function (k) { о[k] = Math.round(с[k]); });
      return о;
    },
    /* Живая сводка нарушений на текущем экране. */
    /* Отладка распознавания шторок — нужна пробнику, чтобы объяснить,
       почему конкретный оверлей не считается модальным. */
    why: function (el) {
      el = el || document.querySelector('[class*="open"]');
      if (!el) return 'элемент не найден';
      var cs = getComputedStyle(el), r = el.getBoundingClientRect();
      return {
        id: el.id, pos: cs.position, z: cs.zIndex,
        cover: +((r.width * r.height) / (innerWidth * innerHeight)).toFixed(2),
        visible: isVisible(el), inNotDialog: !!(el.id && NOT_DIALOG[el.id]),
        hasTabs: !!el.querySelector('#tabs'),
        focusables: interactives(el).filter(isVisible).length,
        modal: looksModal(el, !!backdropPresent()),
        backdrop: (function () { var b = backdropPresent(); return b ? (b.id || b.className) : null; })(),
        stackSize: stack.length
      };
    },
    audit: function () {
      var els = interactives(document).filter(isVisible);
      var noName = [], small = [];
      for (var i = 0; i < els.length; i++) {
        if (!accName(els[i])) noName.push(els[i]);
        var r = els[i].getBoundingClientRect();
        var hx = parseFloat(els[i].style.getPropertyValue('--oko-hit-x')) || 0;
        var hy = parseFloat(els[i].style.getPropertyValue('--oko-hit-y')) || 0;
        if (r.width + hx * 2 < MIN_TARGET - 0.5 || r.height + hy * 2 < MIN_TARGET - 0.5) small.push(els[i]);
      }
      return { interactive: els.length, noName: noName.length, small: small.length,
               dialogs: stack.length };
    }
  };
})();
