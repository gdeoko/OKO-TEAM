/* ===== АКАДЕМИЯ · КОНТЕНТ-ПАК =====================================
   Доп.уроки блоков (наполнение до ~9 уроков/блок). Грузится ПЕРЕД модулем academy,
   выставляет window.AC_PACK { <blockId>: [ {урок}, ... ] }. Уроки — строгий формат:
   { title, sub, dur, videoUrl?, c1, c2, slides:[{t,pts,svg}], quiz:[{q,o,a}], pairs:[[l,r]], task:{intro,chips,ph,verdict} }
   Инструменты в тексте слайдов — в <b>…</b> (кнопки подтянутся из AC_TOOLS academy). */
window.AC_PACK = window.AC_PACK || {};
