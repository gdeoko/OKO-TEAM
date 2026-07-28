/* ================= ОБОГАЩЕНИЕ УРОКОВ АКАДЕМИИ =================
   window.AC_ENRICH[gi] = { intro, notes:[{h,body}], lifehack, links:[{label,url,note}] }
   gi — глобальный индекс урока (== acL в плоском AC_COURSE).
   Данные наполняются воркфлоу oko-academy-enrich (по агенту на урок, без повторов).
   Пока карта пуста — UI просто не показывает блоки обогащения (грациозная деградация). */
window.AC_ENRICH = window.AC_ENRICH || {};
