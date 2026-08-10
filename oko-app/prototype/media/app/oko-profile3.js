/* ============================================================================
   OKO · ПРОФИЛЬ — правки Даниэля от 09.08

   Дословно: «профиль ужасный кривой. не понятный не удобный не понятно где что
   и зачем почему», «чек лист убрать из профиля можно отдельную одну строку а не
   длинный раздел», «прогресс сборки убрать», «сертификаты академии убрать
   с профиля».

   ВАЖНО ПРО КОНТЕКСТ. До 09.08 слой полировки на прод не доезжал вообще —
   okoteam.top отдавал голое ядро. То есть Даниэль описывал профиль БЕЗ pp2 и
   без остальных слоёв. Часть его замечаний на собранном профиле уже неактуальна:
   ряда бейджей «Ранний · MAX · Партнёр · 100+ реакций · Автор» в живом DOM нет
   (pp2 заменил разметку, #profAch не создаётся), горизонтальных скроллов на
   профиле тоже нет — замер показал ноль. Поэтому здесь чинится ровно то, что
   ещё живо, и ничего не делается «на всякий случай».

   Что делает слой:
     1. Чек-лист «КАК ТЕБЯ НАЙДУТ» — пять карточек во весь экран внизу профиля —
        сворачивается в ОДНУ строку «Как тебя найдут · N из 5». Тап открывает тот
        же чек-лист как было. На других вкладках чек-лист не трогаем.
     2. Строка «Прогресс сборки» с профиля убирается.
     3. «в сети» под ником — присутствия у приложения нет, сервера присутствия
        тоже. Заменяется на факт.
     4. «Мои соцсети · 5 подключено» — вранья быть не должно: ни одна площадка
        не подключена, OAuth-ключей у приложения нет (это же честно написано
        внутри самого раздела в oko-system2.js). Подпись считается по правде.

   Слой поверх ядра: ждём, пока профиль отрисуют ядро и pp2, и правим готовый
   DOM. Профиль перерисовывается при возврате на вкладку, поэтому следим
   наблюдателем, а не разово.
   ========================================================================= */
(function () {
  'use strict';
  if (window.__okoProfile3) return;
  window.__okoProfile3 = true;

  var D = document;

  /* ---------------------------------------------------------------- стили */
  var CSS = [
    /* строка-сводка чек-листа: выглядит как обычная строка раздела профиля */
    '.p3-check{display:flex;align-items:center;gap:12px;width:100%;min-height:56px;',
    '  padding:12px 14px;margin:2px 0 10px;border:1px solid var(--border);',
    '  border-radius:16px;background:var(--card);color:var(--text);cursor:pointer;',
    '  text-align:left;font:inherit}',
    '.p3-check:active{transform:scale(.995)}',
    '.p3-check .p3-ic{width:38px;height:38px;flex:0 0 38px;border-radius:12px;',
    '  display:flex;align-items:center;justify-content:center;',
    '  background:var(--lime-dim,rgba(154,255,0,.12));color:var(--lime,#9AFF00)}',
    '.p3-check .p3-ic svg{width:18px;height:18px}',
    '.p3-check .p3-b{min-width:0;flex:1}',
    '.p3-check .p3-t{display:block;font-weight:700;font-size:14.5px;line-height:1.25}',
    '.p3-check .p3-s{display:block;margin-top:2px;color:var(--dim);font-size:12px;line-height:1.35}',
    /* полоска прогресса — единственная «цифра», и она настоящая: сколько
       пунктов чек-листа реально отмечено */
    '.p3-check .p3-bar{margin-top:6px;height:4px;border-radius:3px;background:var(--border);overflow:hidden}',
    '.p3-check .p3-bar i{display:block;height:100%;background:var(--lime,#9AFF00);border-radius:3px;',
    '  transition:width .35s ease}',
    '.p3-check .p3-chev{flex:0 0 auto;color:var(--dim)}',
    '.p3-check .p3-chev svg{width:16px;height:16px}',
    '@media(prefers-reduced-motion:reduce){.p3-check .p3-bar i{transition:none}}',
  ].join('');

  (function стили() {
    var s = D.createElement('style');
    s.id = 'oko-profile3-css';
    s.textContent = CSS;
    D.head.appendChild(s);
  })();

  /* ------------------------------------------------------------- мелочи */
  function иконка(d) {
    return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" ' +
           'stroke-linecap="round" stroke-linejoin="round">' + d + '</svg>';
  }
  var И_ЦЕЛЬ = иконка('<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="4"/>');
  var И_ШЕВРОН = иконка('<path d="M9 6l6 6-6 6"/>');

  function экранПрофиля() {
    var s = D.getElementById('screen-profile');
    return (s && s.classList.contains('active')) ? s : null;
  }

  /* ============================================================ 1. ЧЕК-ЛИСТ
     Блок чек-листа рисует слой роста (oko-growth.js). На профиле он
     разворачивается во весь экран: заголовок «КАК ТЕБЯ НАЙДУТ», счётчик
     «N из 5» и пять высоких карточек. Мы его не удаляем и не ломаем — просто
     прячем на профиле и ставим вместо него одну строку, которая открывает
     тот же самый чек-лист. */
  /* Блок чек-листа — это #okgShowcaseHost, его рисует слой роста
     (oko-growth.js). Искать по заголовку оказалось плохой идеей дважды:
     сперва слепой подъём по предкам скрыл весь профиль, потом поиск стал
     находить мою же строку-сводку («Как тебя найдут» содержит те же слова).
     Берём узел по идентификатору — он стабильный, на него уже опирается
     правило 40 в oko-v2.css. */
  function блокЧекЛиста(scr) {
    var host = scr.querySelector('#okgShowcaseHost, .okg-show');
    if (host && host.querySelector('.p3-check') === null) return host;
    return host || null;
  }

  /* Сколько пунктов отмечено — читаем из самого блока, ничего не выдумываем. */
  function прогрессЧекЛиста(блок) {
    var всего = 0, готово = 0;
    var м = (блок.textContent || '').match(/(\d+)\s*из\s*(\d+)/);
    if (м) { готово = +м[1]; всего = +м[2]; }
    if (!всего) {
      var карточки = блок.querySelectorAll('.okg-ob-item, .okg-item, li');
      всего = карточки.length;
      готово = блок.querySelectorAll('.okg-ob-item.done, .okg-item.done, li.done').length;
    }
    return { готово: готово, всего: всего || 0 };
  }

  function открытьЧекЛист(блок) {
    /* Показать блок обратно и подскроллить к нему — человек видит то же, что
       и раньше, просто по своему желанию, а не всегда. */
    блок.dataset.p3hidden = '';
    блок.style.display = '';
    try { блок.scrollIntoView({ behavior: 'smooth', block: 'start' }); } catch (e) { }
  }

  function свернутьЧекЛист(scr) {
    var блок = блокЧекЛиста(scr);
    if (!блок) return;
    /* уже свёрнут и строка на месте — ничего не делаем */
    if (блок.dataset.p3hidden === '1' && scr.querySelector('.p3-check')) return;

    var п = прогрессЧекЛиста(блок);
    if (!п.всего) return;                       /* нечего сворачивать */

    блок.dataset.p3hidden = '1';
    блок.style.display = 'none';

    var стар = scr.querySelector('.p3-check');
    if (стар) стар.remove();

    var доля = Math.max(0, Math.min(100, Math.round(п.готово / п.всего * 100)));
    var b = D.createElement('button');
    b.type = 'button';
    b.className = 'p3-check';
    b.setAttribute('aria-label', 'Как тебя найдут, выполнено ' + п.готово + ' из ' + п.всего);
    b.innerHTML =
      '<span class="p3-ic">' + И_ЦЕЛЬ + '</span>' +
      '<span class="p3-b">' +
        '<span class="p3-t">Как тебя найдут</span>' +
        '<span class="p3-s">Шаг ' + п.готово + ' из ' + п.всего + ' · открыть список</span>' +
        '<span class="p3-bar"><i style="width:' + доля + '%"></i></span>' +
      '</span>' +
      '<span class="p3-chev">' + И_ШЕВРОН + '</span>';
    b.addEventListener('click', function () {
      открытьЧекЛист(блок);
      b.remove();
    });
    блок.parentNode.insertBefore(b, блок);
  }

  /* ================================================= 2. «ПРОГРЕСС СБОРКИ»
     Строка ведёт в служебную шторку о ходе разработки. Человеку в профиле
     она не нужна — Даниэль попросил убрать. */
  function убратьПрогрессСборки(scr) {
    scr.querySelectorAll('button, .prow, a').forEach(function (el) {
      var t = (el.textContent || '').replace(/\s+/g, ' ').trim();
      if (/^Прогресс сборки/.test(t)) el.remove();
    });
  }

  /* ============================================ 3. «в сети» под ником
     Присутствия у приложения нет: сервер присутствия не подключён, а флаг
     online просто лежит в объекте профиля. Показываем факт — ник. */
  function честныйСтатус(scr) {
    var СТАТУС = /^(в сети|онлайн|был\(а\) недавно|была недавно|был недавно)$/i;
    /* Обходим текстовые узлы: статус бывает и отдельным элементом, и просто
       хвостом строки «@ktodaniel · в сети». Первый вариант мы удаляем вместе
       с точкой-разделителем, второй — обрезаем в тексте. */
    var w = D.createTreeWalker(scr, NodeFilter.SHOW_TEXT);
    var подчистить = [];
    for (var n = w.nextNode(); n; n = w.nextNode()) {
      var t = (n.nodeValue || '').trim();
      if (!t) continue;
      if (СТАТУС.test(t)) { подчистить.push({ узел: n, целиком: true }); continue; }
      if (/[·•]\s*(в сети|онлайн|был\(а\) недавно)\s*$/i.test(t)) подчистить.push({ узел: n, целиком: false });
    }
    подчистить.forEach(function (з) {
      if (з.целиком) {
        /* убираем сам статус и осиротевший разделитель перед ним */
        var el = з.узел.parentElement;
        var сосед = el && el.previousSibling;
        if (сосед && сосед.nodeType === 3 && /^\s*[·•]\s*$/.test(сосед.nodeValue || '')) сосед.remove();
        else if (сосед && сосед.nodeType === 1 && /^\s*[·•]\s*$/.test(сосед.textContent || '')) сосед.remove();
        if (el && el !== scr) el.remove(); else з.узел.remove();
      } else {
        з.узел.nodeValue = (з.узел.nodeValue || '').replace(/\s*[·•]\s*(в сети|онлайн|был\(а\) недавно)\s*$/i, '');
      }
    });
  }

  /* ======================================= 4. «Мои соцсети · 5 подключено»
     Ни одна площадка не подключена — у приложения нет ни одного OAuth-ключа,
     и раздел «Мои соцсети» честно пишет «Не подключено» по каждой сети.
     Строка в профиле при этом обещала пять подключений и автопостинг.
     Считаем по правде: сколько сетей реально отмечено подключёнными. */
  function честныеСоцсети(scr) {
    scr.querySelectorAll('.pp2-row, button, .prow').forEach(function (row) {
      var t = (row.querySelector('.pp2-row-t') || {}).textContent || '';
      if (!/^\s*Мои соцсети/.test(t)) return;
      var под = row.querySelector('.pp2-row-s, .pp2-row-sub, .sub, small');
      if (!под) return;
      var было = (под.textContent || '').trim();
      if (!/подключен/i.test(было)) return;      /* уже честно — не трогаем */
      var n = 0;
      try {
        var сохранено = JSON.parse(localStorage.getItem('oko-sy2-socials') || '{}');
        Object.keys(сохранено).forEach(function (k) {
          var v = сохранено[k];
          if (v && (v.connected || v.link || v.nick)) n++;
        });
      } catch (e) { n = 0; }
      под.textContent = n
        ? (n + (n === 1 ? ' площадка добавлена' : (n < 5 ? ' площадки добавлены' : ' площадок добавлено')))
        : 'Пока ничего не подключено';
    });
  }

  /* ------------------------------------------------------------- запуск */
  function привести() {
    var scr = экранПрофиля();
    if (!scr) return;
    try { убратьПрогрессСборки(scr); } catch (e) { }
    try { честныйСтатус(scr); } catch (e) { }
    try { честныеСоцсети(scr); } catch (e) { }
    try { свернутьЧекЛист(scr); } catch (e) { }
  }

  /* Профиль пересобирают и ядро, и pp2, и слой роста — каждый в своё время.
     Разовый вызов ничего не даст: наблюдаем за экраном и приводим в порядок
     после любой перерисовки, с небольшой задержкой, чтобы не гоняться за
     каждым узлом по отдельности. */
  var таймер = 0;
  function запланировать() {
    clearTimeout(таймер);
    таймер = setTimeout(привести, 120);
  }

  function следить() {
    var scr = D.getElementById('screen-profile');
    if (!scr) { setTimeout(следить, 400); return; }
    привести();
    try {
      new MutationObserver(запланировать).observe(scr, { childList: true, subtree: true });
    } catch (e) { }
    /* смена вкладки не всегда меняет DOM профиля — подстрахуемся */
    D.addEventListener('click', function () { setTimeout(запланировать, 250); }, true);
  }

  if (D.readyState === 'loading') D.addEventListener('DOMContentLoaded', следить, { once: true });
  else следить();
})();
