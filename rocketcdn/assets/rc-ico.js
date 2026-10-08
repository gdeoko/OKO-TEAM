/* RocketCDN - набор контурных иконок, один на сайт и на админку.
   Раньше набор жил внутри rc-app.js, и в панели управления имя
   иконки карточки приходилось вписывать наугад. Теперь тот же
   объект читают обе страницы, и в админке иконка выбирается
   списком с показом самой картинки.

   Контур рисуется через currentColor, поэтому иконка берёт цвет
   родителя и одинаково живёт в тёмной и светлой теме. */
(function (g) {
"use strict";

var ICO = {
  cdn:    '<path d="M3 6.5A2.5 2.5 0 0 1 5.5 4h13A2.5 2.5 0 0 1 21 6.5v1A2.5 2.5 0 0 1 18.5 10h-13A2.5 2.5 0 0 1 3 7.5v-1ZM3 16.5A2.5 2.5 0 0 1 5.5 14h13a2.5 2.5 0 0 1 2.5 2.5v1a2.5 2.5 0 0 1-2.5 2.5h-13A2.5 2.5 0 0 1 3 17.5v-1Z"/><path d="M7 7h.01M7 17h.01"/>',
  stream: '<rect x="2" y="4" width="20" height="14" rx="2.5"/><path d="M8 21h8M12 18v3"/><path d="m10.5 8.8 4 2.2-4 2.2V8.8Z"/>',
  storage:'<path d="M3 7.5 12 3l9 4.5-9 4.5-9-4.5Z"/><path d="m3 12 9 4.5L21 12M3 16.5 12 21l9-4.5"/>',
  player: '<circle cx="12" cy="12" r="9"/><path d="m10.2 8.6 5.3 3.4-5.3 3.4V8.6Z"/>',
  cloud:  '<path d="M17.5 19a4.5 4.5 0 0 0 .3-9 6.5 6.5 0 0 0-12.4 2A4 4 0 0 0 6 19h11.5Z"/>',
  shield: '<path d="M12 3 5 6v5.5c0 4.3 2.9 8.2 7 9.5 4.1-1.3 7-5.2 7-9.5V6l-7-3Z"/><path d="m9.2 12 2 2 3.6-3.8"/>',
  voice:  '<rect x="9" y="3" width="6" height="10" rx="3"/><path d="M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V21M8.5 21h7"/>',
  cpu:    '<rect x="7" y="7" width="10" height="10" rx="2"/><path d="M4 10h3M4 14h3M17 10h3M17 14h3M10 4v3M14 4v3M10 17v3M14 17v3"/>',
  gpu:    '<rect x="2.5" y="6" width="19" height="12" rx="2.5"/><path d="M7 10.5h3.5M7 13.5h3.5"/><circle cx="16" cy="12" r="2.6"/>',
  support:'<path d="M4 13a8 8 0 0 1 16 0"/><rect x="2.5" y="13" width="4" height="6" rx="2"/><rect x="17.5" y="13" width="4" height="6" rx="2"/><path d="M20 19a3 3 0 0 1-3 3h-2"/>',
  load:   '<path d="M4 19h16"/><path d="M6.5 19V9.5M11 19V4.5M15.5 19v-7M20 19V7"/>',
  speed:  '<path d="M12 20a8 8 0 1 1 8-8"/><path d="m12 12 5-3.5"/><circle cx="12" cy="12" r="1.6"/>',
  bolt:   '<path d="M13 2 4.5 13.5H11L10.5 22 19.5 10H13l0-8Z"/>',
  globe:  '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c2.5 2.6 3.8 5.7 3.8 9S14.5 18.4 12 21c-2.5-2.6-3.8-5.7-3.8-9S9.5 5.6 12 3Z"/>',
  dc:     '<rect x="3" y="4" width="18" height="6" rx="2"/><rect x="3" y="14" width="18" height="6" rx="2"/><path d="M7 7h.01M7 17h.01"/>',
  check:  '<path d="m4.5 12.5 5 5 10-11"/>',
  mail:   '<rect x="2.5" y="5" width="19" height="14" rx="2.5"/><path d="m3 7 9 6 9-6"/>',
  tg:     '<path d="m21 4-3 16-6-4.5-3 3-.6-4.8L19 6.5 7.5 12.8 3 11.2 21 4Z"/>',
  clock:  '<circle cx="12" cy="12" r="9"/><path d="M12 7v5.2l3.4 2"/>',
  phone:  '<path d="M6.5 3.5h3l1.5 4-2 1.4a12 12 0 0 0 6.1 6.1l1.4-2 4 1.5v3a2 2 0 0 1-2.2 2A16.5 16.5 0 0 1 4.5 5.7a2 2 0 0 1 2-2.2Z"/>',
  user:   '<circle cx="12" cy="8" r="4"/><path d="M4.5 20a7.5 7.5 0 0 1 15 0"/>',
  up:     '<path d="M12 19V5M6 11l6-6 6 6"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.6-3.6"/>',
  sun:    '<circle cx="12" cy="12" r="4.2"/><path d="M12 2v2.4M12 19.6V22M2 12h2.4M19.6 12H22M4.9 4.9l1.7 1.7M17.4 17.4l1.7 1.7M19.1 4.9l-1.7 1.7M6.6 17.4l-1.7 1.7"/>',
  moon:   '<path d="M20 14.5A8.5 8.5 0 0 1 9.5 4a8.5 8.5 0 1 0 10.5 10.5Z"/>',
  burger: '<path d="M4 7h16M4 12h16M4 17h16"/>',
  close:  '<path d="M6 6l12 12M18 6 6 18"/>',
  arrow:  '<path d="M5 12h14M13 6l6 6-6 6"/>'
};

g.RC_ICONS = ICO;

/* Готовая разметка иконки по имени. Имени нет в наборе - вернётся
   пустая svg нужного размера, а не разорванная строка. */
g.RC_ICO = function (name, cls) {
  return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" ' +
    'stroke-linecap="round" stroke-linejoin="round"' + (cls ? ' class="' + cls + '"' : "") + ">" +
    (ICO[name] || "") + "</svg>";
};

})(window);
