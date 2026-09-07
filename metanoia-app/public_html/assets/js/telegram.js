/* ══════════════════════════════════════════════════════════════
   МЕТАНОЙЯ · telegram.js · школа внутри Телеграма

   Приложение открывается тремя способами: как сайт, как установленное
   приложение с домашнего экрана и как мини-приложение внутри Телеграма.
   Этот файл нужен только для третьего случая: вне Телеграма он молчит.

   Что делает:
   - разворачивает окно на всю высоту и не даёт закрыть его случайным
     свайпом посреди урока;
   - подставляет цвета шапки и фона под наше оформление;
   - системная кнопка «назад» Телеграма работает как наша стрелка назад;
   - имя ребёнка и язык берутся из Телеграма, если семья их не вводила;
   - данные входа (initData) кладёт в память для сервера: подпись проверяет
     сервер ключом бота, приложение ей на слово не верит.
   ══════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  const TG = window.Telegram && window.Telegram.WebApp;
  if (!TG || !TG.initData && !TG.initDataUnsafe) { window.MT_TG = { внутри: false }; return; }

  const внутри = !!(TG.initData || (TG.initDataUnsafe && TG.initDataUnsafe.user));
  const КРЕМ = '#FAF8F5';
  const НОЧЬ = '#0E1B25';

  function тёмная() {
    return document.documentElement.getAttribute('data-theme') === 'dark';
  }

  function покраситьОкно() {
    const фон = тёмная() ? НОЧЬ : КРЕМ;
    try { TG.setHeaderColor(фон); } catch (e) { /* старый Телеграм */ }
    try { TG.setBackgroundColor(фон); } catch (e) { /* старый Телеграм */ }
  }

  /* Высота окна Телеграма меняется, когда открывается клавиатура или
     сворачивается шапка. Отдаём её в CSS, чтобы экраны не прыгали. */
  function высота() {
    const h = TG.viewportStableHeight || TG.viewportHeight;
    if (h) document.documentElement.style.setProperty('--tg-height', h + 'px');
  }

  /* Системная стрелка «назад» Телеграма ведёт себя как наша: закрывает
     открытый экран, а на главной прячется. */
  const НАЗАД = ['#lessonBack', '#examBack', '#gameBack', '#certClose', '#albumBack',
    '#questBack', '#devBack', '#shopBack', '#ratingBack', '#askBack', '#petBack',
    '#childBack', '#cvBack', '#searchBack', '#docBack'];

  function видимая(эл) {
    if (!эл) return false;
    const r = эл.getBoundingClientRect();
    return r.width > 0 && r.height > 0;
  }

  function ктоНазад() {
    for (const sel of НАЗАД) {
      const эл = document.querySelector(sel);
      if (видимая(эл)) return эл;
    }
    return null;
  }

  function следитьЗаНазад() {
    const кнопка = ктоНазад();
    try {
      if (кнопка) TG.BackButton.show(); else TG.BackButton.hide();
    } catch (e) { /* старый Телеграм */ }
  }

  /* Имя и язык от Телеграма: только если семья ещё ничего не вводила. */
  function подставитьИмя() {
    const u = TG.initDataUnsafe && TG.initDataUnsafe.user;
    if (!u) return;
    if (!localStorage.getItem('mt_name') && u.first_name) {
      localStorage.setItem('mt_name', String(u.first_name).slice(0, 40));
    }
    if (!localStorage.getItem('mt_lang') && u.language_code === 'es') {
      localStorage.setItem('mt_lang', 'es');
    }
    // Подпись входа отдаём серверу как есть, он проверит её ключом бота.
    if (TG.initData) localStorage.setItem('mt_tg_init', TG.initData);
  }

  try { TG.ready(); } catch (e) { /* старый Телеграм */ }
  try { TG.expand(); } catch (e) { /* старый Телеграм */ }
  try { TG.disableVerticalSwipes(); } catch (e) { /* появилось в Bot API 7.7 */ }
  try { TG.enableClosingConfirmation(); } catch (e) { /* старый Телеграм */ }

  подставитьИмя();
  покраситьОкно();
  высота();
  document.documentElement.classList.add('в-телеграме');

  try {
    TG.onEvent('viewportChanged', высота);
    TG.onEvent('themeChanged', покраситьОкно);
    TG.BackButton.onClick(() => {
      const кнопка = ктоНазад();
      if (кнопка) кнопка.click(); else TG.close();
    });
  } catch (e) { /* старый Телеграм */ }

  // Экраны переключаются без перезагрузки, поэтому следим за разметкой.
  window.addEventListener('load', () => {
    следитьЗаНазад();
    try {
      new MutationObserver(следитьЗаНазад).observe(document.body, {
        subtree: true, attributes: true, attributeFilter: ['class', 'hidden', 'style'],
      });
    } catch (e) { /* разметки ещё нет */ }
  });

  window.MT_TG = {
    внутри: внутри,
    пользователь: (TG.initDataUnsafe && TG.initDataUnsafe.user) || null,
    подписьВхода: TG.initData || '',
    закрыть: () => { try { TG.close(); } catch (e) {} },
    отклик: (вид) => { try { TG.HapticFeedback.impactOccurred(вид || 'light'); } catch (e) {} },
  };
})();
