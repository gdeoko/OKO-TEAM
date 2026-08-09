/* =============================================================================
   OKO · ACADEMY 2 — слой доводки Академии до состояния «готово к запуску».

   Грузится ПОСЛЕ app.js (модули academy / academy-plus) и правит их поверх,
   ничего не переписывая в ядре. Префикс всего своего: ac2- (CSS) / ac2 (JS).

   Что делает:
     1. Навигация. Публикует состояние Академии наружу, чтобы единая кнопка
        «назад» шагала урок → уроки курса → каталог, а Escape и системная
        «назад» закрывали слои. Из любого экрана есть выход.
     2. Честность. Убирает ложные подтверждения: «проверяется куратором» без
        куратора, «опубликовано» без публикации, синтетические «повторные
        просмотры» в аналитике. Проценты за этап считаются от реального числа
        этапов урока, а не жёстко по 20%.
     3. Обучение по эталонам. Оглавление урока с прогрессом, закладки,
        конспект-заметки, поиск по курсам и урокам, оценка времени урока с
        учётом скорости чтения, офлайн-конспекты уже пройденного, переход
        «следующий урок» без возврата в каталог, мягкий стрик без давления.
     4. Вёрстка. Заголовки помещаются, длинные слова не рвутся посреди слова,
        плавающие кнопки не наезжают друг на друга, ничего не уходит под
        нижний бар и под шапку, обе темы, адаптив 360/390/820/1440.

   Безопасные зоны — только через var(--oko-safe-*). Иконки — только из
   спрайта index.html. Никаких эмодзи.
   ============================================================================= */
(function(){
'use strict';
if(window.__okoAcademy2) return;
window.__okoAcademy2 = true;

var D = document;
function $(s, r){ return (r || D).querySelector(s); }
function $$(s, r){ return Array.prototype.slice.call((r || D).querySelectorAll(s)); }

/* Своё экранирование: глобальный esc() из ядра не трогает кавычки, а мы
   подставляем текст уроков в title / aria-label / placeholder — там кавычка
   рвёт атрибут. */
function esc(s){
  return String(s == null ? '' : s).replace(/[&<>"']/g, function(c){
    return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];
  });
}
function ico(n){
  if(typeof window.I === 'function') return window.I(n);
  return '<svg class="i"><use href="#i-' + n + '"/></svg>';
}
function say(t){ if(typeof window.toast === 'function') window.toast(t); }
function plural(n, f){
  var a = Math.abs(n) % 100, b = a % 10;
  if(a > 10 && a < 20) return f[2];
  if(b > 1 && b < 5) return f[1];
  if(b === 1) return f[0];
  return f[2];
}
function strip(h){ return String(h == null ? '' : h).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim(); }
function minTxt(m){
  m = Math.max(1, Math.round(m));
  if(m < 60) return m + ' мин';
  var h = Math.floor(m / 60), r = m % 60;
  return h + ' ч' + (r ? ' ' + r + ' мин' : '');
}

/* ---------------------------------------------------------------------------
   1. СВОЁ ХРАНИЛИЩЕ (отдельный ключ — состояние ядра не трогаем)
   --------------------------------------------------------------------------- */
var KEY = 'oko-academy2';
var S = (function load(){
  var s = null;
  try{ s = JSON.parse(localStorage.getItem(KEY)); }catch(e){}
  if(!s || typeof s !== 'object') s = {};
  if(!s.marks)   s.marks = {};    // закладки: {индекс урока: метка времени}
  if(!s.offline) s.offline = {};  // офлайн-конспекты: {индекс: {t,c,no,txt,ts}}
  if(!s.time)    s.time = {};     // реально проведённое в уроке время, секунды
  if(typeof s.wpm !== 'number' || !s.wpm) s.wpm = 150;   // скорость чтения, слов/мин
  if(typeof s.remind !== 'boolean') s.remind = true;      // мягкие напоминания
  if(!s.reviews) s.reviews = {};  // черновики отзывов (локально, никуда не уходят)
  return s;
})();
function save(){ try{ localStorage.setItem(KEY, JSON.stringify(S)); }catch(e){} }

/* ---------------------------------------------------------------------------
   2. ДОСТУП К ДАННЫМ АКАДЕМИИ
   --------------------------------------------------------------------------- */
function COURSES(){ return window.AC_COURSES || []; }
function LESSONS(){ return window.AC_COURSE  || []; }
function BLOCKS(){  return window.AC_BLOCKS  || []; }
function view(){ return window.acView || 'home'; }
function curIdx(){ return (typeof window.acL === 'number') ? window.acL : 0; }
function curCourse(){ return (typeof window.acCourse === 'number') ? window.acCourse : 0; }
function blockOf(i){
  var b = BLOCKS();
  for(var k = 0; k < b.length; k++) if(i >= b[k].from && i < b[k].from + b[k].count) return b[k];
  return null;
}
function courseOf(i){ return (typeof window.acCourseOf === 'function') ? window.acCourseOf(i) : 0; }
function localNo(i){ return (typeof window.acLocalNo === 'function') ? window.acLocalNo(i) : i + 1; }
function lessonPct(i){ return (typeof window.acLessonPct === 'function') ? window.acLessonPct(i) : 0; }
function lessonDone(i){ return (typeof window.acLessonDone === 'function') ? window.acLessonDone(i) : false; }
function lessonItems(i){ return (typeof window.acItems === 'function') ? window.acItems(i) : []; }
function courseOpen(ci){ return (typeof window.acCourseAccessible === 'function') ? window.acCourseAccessible(ci) : true; }

/* Текст урока целиком — для поиска, счётчика слов и офлайн-конспекта. */
var _txt = {};
function lessonText(i){
  if(_txt[i] != null) return _txt[i];
  var L = LESSONS()[i];
  if(!L){ _txt[i] = ''; return ''; }
  var out = strip(L.title) + ' ';
  (L.slides || []).forEach(function(s){
    out += strip(s.t) + ' ' + (s.pts || []).map(strip).join(' ') + ' ';
  });
  var e = (window.AC_ENRICH || {})[i];
  if(e){
    out += strip(e.intro || '') + ' ';
    (e.notes || []).forEach(function(n){ out += strip(n.h) + ' ' + strip(n.body) + ' '; });
    out += strip(e.lifehack || '') + ' ';
  }
  (L.quiz || []).forEach(function(q){ out += strip(q.q) + ' '; });
  _txt[i] = out.replace(/\s+/g, ' ').trim();
  return _txt[i];
}
function lessonWords(i){ var t = lessonText(i); return t ? t.split(' ').length : 0; }
/* Оценка времени урока: чтение по личной скорости + тест + практика + игра. */
function lessonMins(i){
  var L = LESSONS()[i]; if(!L) return 0;
  var read = lessonWords(i) / Math.max(80, S.wpm);
  var quiz = (L.quiz || []).length * 0.4;
  var task = L.task ? 4 : 0;
  var game = 2;
  return Math.max(2, Math.round(read + quiz + task + game));
}
function courseMinsLeft(ci){
  var idx = (typeof window.acCourseIdx === 'function') ? window.acCourseIdx(ci) : [];
  var m = 0;
  idx.forEach(function(i){ if(!lessonDone(i)) m += lessonMins(i) * (1 - lessonPct(i) / 100); });
  return Math.round(m);
}
function spentMins(i){ return Math.round((S.time[i] || 0) / 60); }
function spentTotalMins(){
  var s = 0; for(var k in S.time) s += S.time[k] || 0;
  return Math.round(s / 60);
}

/* ---------------------------------------------------------------------------
   3. СТИЛИ
   --------------------------------------------------------------------------- */
var CSS = [
/* --- общая типографика Академии: слова не рвутся посреди слова --- */
'#screen-academy, .ac2-full, .acd-full, .acd-notes-panel{ hyphens:auto; -webkit-hyphens:auto; }',
'#screen-academy, #screen-academy *, .ac2-full, .ac2-full *{ word-break:normal; overflow-wrap:break-word; }',
'#screen-academy .oko-breakable, .ac2-full .oko-breakable{ word-break:break-all; hyphens:none; }',
'#screen-academy code, .ac2-full code{ font-family:ui-monospace,SFMono-Regular,Menlo,monospace; font-size:.9em;',
'  background:var(--raised); border:1px solid var(--border); border-radius:6px; padding:1px 5px; word-break:break-word; }',
'#screen-academy pre, .ac2-full pre{ overflow-x:auto; -webkit-overflow-scrolling:touch; max-width:100%;',
'  background:var(--raised); border:1px solid var(--border); border-radius:var(--r-sm); padding:10px 12px; }',
'#screen-academy blockquote, .ac2-full blockquote{ border-left:3px solid var(--accent); padding:2px 0 2px 12px;',
'  margin:8px 0; color:var(--dim); font-style:normal; }',
'#screen-academy table, .ac2-full table{ display:block; overflow-x:auto; max-width:100%; }',

/* заголовки не обрезаются: до двух строк с подстройкой кегля делает JS,
   а тут гарантируем перенос и отсутствие клипа */
'#acRoot h2, #acRoot h3, #acRoot h4, .ac2-full h2, .ac2-full h3{ overflow:visible; text-overflow:clip; }',
'.ac-lesson-head h2, .ac-continue-title, .ac-cc-body h3{ overflow-wrap:break-word; }',

/* плавающая кнопка заметок из academy-plus наезжала на пилюлю роста —
   заметки живут в панели урока и внизу страницы, кнопка больше не нужна */
'#acdNotesFab{ display:none !important; }',

/* Свой прогресс-рельс урока считает реальные этапы (видео выключено — их 4),
   а рельс academy-plus всегда рисовал пять и давал на экране два разных
   знаменателя сразу. Оставляем один, честный. */
'#acdStepRail{ display:none !important; }',

/* Подсказка «сделай Reels из урока» приезжала поверх общей шапки и закрывала
   единую кнопку «назад». Сдвигаем её под шапку: подсказка видна, выход открыт. */
'.vr-nudge.on{ transform:translate(-50%, calc(var(--oko-safe-top) + 64px)) !important; }',

/* --- ПАНЕЛЬ УРОКА: крошки, метрики, действия, оглавление --- */
'.ac2-bar{ margin:0 0 14px; padding:12px 13px 11px; }',
'.ac2-bar-top{ display:flex; justify-content:space-between; align-items:center; gap:8px; margin-bottom:8px;',
'  font-size:11px; font-weight:800; letter-spacing:.05em; text-transform:uppercase; color:var(--dim); }',
'.ac2-bar-top b{ color:var(--accent); }',
'.ac2-xp{ display:inline-flex; align-items:center; gap:5px; background:var(--lime-dim); color:var(--accent);',
'  border-radius:99px; padding:4px 9px; font-size:10.5px; font-weight:800; flex:0 0 auto; }',
'.ac2-xp svg.i{ width:11px; height:11px; }',
'.ac2-steps{ display:flex; align-items:flex-start; gap:2px; margin:0 0 8px; }',
'.ac2-step{ flex:1 1 0; min-width:0; display:flex; flex-direction:column; align-items:center; gap:5px;',
'  cursor:pointer; padding:2px 0; background:none; border:none; }',
'.ac2-step .d{ width:26px; height:26px; border-radius:50%; border:1.5px solid var(--border); display:flex;',
'  align-items:center; justify-content:center; font-size:11px; font-weight:800; color:var(--dim);',
'  background:var(--surface); flex:0 0 auto; }',
'.ac2-step .d svg.i{ width:12px; height:12px; }',
'.ac2-step.done .d{ background:var(--lime); border-color:var(--lime); color:#000; }',
'.ac2-step.cur .d{ border-color:var(--accent); color:var(--accent); box-shadow:0 0 0 3px var(--lime-dim); }',
'.ac2-step .l{ font-size:10px; font-weight:700; color:var(--dim); text-align:center; line-height:1.2; }',
'.ac2-step.done .l, .ac2-step.cur .l{ color:var(--text); }',
'.ac2-track{ height:5px; border-radius:99px; background:var(--raised); overflow:hidden; margin:0 0 10px; }',
'.ac2-track i{ display:block; height:100%; background:var(--lime); border-radius:99px; transition:width .4s ease; }',
'.ac2-crumbs{ display:flex; flex-wrap:wrap; align-items:center; gap:6px; font-size:11px; font-weight:700;',
'  letter-spacing:.04em; text-transform:uppercase; color:var(--dim); margin-bottom:8px; }',
'.ac2-crumbs b{ color:var(--accent); font-weight:800; }',
'.ac2-crumbs .sep{ opacity:.45 }',
'.ac2-meta{ display:flex; flex-wrap:wrap; gap:6px; margin-bottom:10px; }',
'.ac2-mchip{ display:inline-flex; align-items:center; gap:5px; font-size:11.5px; font-weight:700; color:var(--dim);',
'  background:var(--raised); border:1px solid var(--border); border-radius:99px; padding:5px 10px; }',
'.ac2-mchip svg.i{ width:12px; height:12px; flex:0 0 auto; }',
'.ac2-mchip.on{ color:var(--accent); border-color:rgba(154,255,0,.35); background:var(--lime-dim); }',
'.ac2-acts{ display:flex; flex-wrap:wrap; gap:8px; }',
'.ac2-act{ display:inline-flex; align-items:center; gap:6px; font-size:12px; font-weight:700; color:var(--text);',
'  background:var(--raised); border:1px solid var(--border); border-radius:99px; padding:8px 12px; cursor:pointer;',
'  transition:border-color .18s, color .18s, background .18s; min-height:36px; }',
'.ac2-act:hover{ border-color:var(--accent); color:var(--accent); }',
'.ac2-act svg.i{ width:14px; height:14px; flex:0 0 auto; }',
'.ac2-act.on{ background:var(--lime); border-color:var(--lime); color:#000; }',
'.ac2-act.on svg.i{ color:#000; }',

'.ac2-toc{ margin-top:12px; border-top:1px solid var(--border); padding-top:10px; display:none; }',
'.ac2-bar.toc-open .ac2-toc{ display:block; animation:ac2Fade .22s ease both; }',
'.ac2-toc-h{ font-size:11px; font-weight:800; letter-spacing:.08em; text-transform:uppercase; color:var(--dim); margin:0 0 8px; }',
'.ac2-toc-row{ display:flex; align-items:center; gap:9px; width:100%; text-align:left; padding:8px 4px;',
'  border-radius:9px; cursor:pointer; transition:background .16s; min-height:38px; }',
'.ac2-toc-row:hover{ background:var(--raised); }',
'.ac2-toc-row .tk{ width:20px; height:20px; border-radius:50%; border:1.5px solid var(--border); flex:0 0 auto;',
'  display:flex; align-items:center; justify-content:center; color:var(--dim); }',
'.ac2-toc-row .tk svg.i{ width:11px; height:11px; opacity:0; }',
'.ac2-toc-row.done .tk{ background:var(--lime); border-color:var(--lime); color:#000; }',
'.ac2-toc-row.done .tk svg.i{ opacity:1; }',
'.ac2-toc-row .tt{ flex:1; min-width:0; font-size:13px; font-weight:600; color:var(--text); line-height:1.35; }',
'.ac2-toc-row .ts{ font-size:11px; color:var(--dim); font-weight:600; flex:0 0 auto; }',
'.ac2-toc-slides{ display:flex; flex-wrap:wrap; gap:6px; padding:4px 4px 6px 33px; }',
'.ac2-sdot{ font-size:11px; font-weight:800; min-width:26px; height:26px; padding:0 6px; border-radius:8px;',
'  border:1px solid var(--border); background:var(--surface); color:var(--dim); cursor:pointer; }',
'.ac2-sdot.seen{ color:var(--accent); border-color:rgba(154,255,0,.35); }',
'.ac2-sdot.cur{ background:var(--lime); border-color:var(--lime); color:#000; }',
'.ac2-wpm{ display:flex; align-items:center; gap:8px; flex-wrap:wrap; margin-top:10px; padding-top:10px;',
'  border-top:1px solid var(--border); }',
'.ac2-wpm > span{ font-size:11px; font-weight:800; letter-spacing:.06em; text-transform:uppercase; color:var(--dim); }',
'.ac2-wpm button{ font-size:11.5px; font-weight:700; color:var(--dim); background:var(--surface);',
'  border:1px solid var(--border); border-radius:99px; padding:6px 11px; cursor:pointer; min-height:32px; }',
'.ac2-wpm button.on{ background:var(--lime-dim); border-color:rgba(154,255,0,.4); color:var(--accent); }',

/* --- НИЗ УРОКА: предыдущий / следующий / к списку --- */
'.ac2-nav{ display:grid; grid-template-columns:1fr 1fr; gap:10px; margin:16px 0 calc(10px + var(--oko-safe-bottom)); }',
'.ac2-nav .wide{ grid-column:1 / -1; }',
'.ac2-nav-btn{ display:flex; align-items:center; gap:10px; text-align:left; padding:12px 13px; border-radius:var(--r-md);',
'  border:1px solid var(--border); background:var(--surface); cursor:pointer; min-height:62px;',
'  transition:border-color .18s, transform .14s; }',
'.ac2-nav-btn:hover{ border-color:var(--accent); }',
'.ac2-nav-btn:active{ transform:scale(.99); }',
'.ac2-nav-btn.next{ background:linear-gradient(135deg, var(--lime-dim), transparent 70%); border-color:rgba(154,255,0,.3); }',
'.ac2-nav-btn svg.i{ width:15px; height:15px; flex:0 0 auto; color:var(--accent); }',
'.ac2-nav-btn .m{ min-width:0; flex:1; display:flex; flex-direction:column; gap:2px; }',
'.ac2-nav-btn .m span{ font-size:10.5px; font-weight:800; letter-spacing:.07em; text-transform:uppercase; color:var(--dim); }',
'.ac2-nav-btn .m b{ font-size:13px; font-weight:700; color:var(--text); line-height:1.3;',
'  display:-webkit-box; -webkit-line-clamp:2; -webkit-box-orient:vertical; overflow:hidden; }',
'.ac2-nav-btn.rev{ flex-direction:row-reverse; text-align:right; }',
'.ac2-nav-btn.rev .m{ align-items:flex-end; }',
'.ac2-nav-done{ grid-column:1 / -1; display:flex; align-items:center; gap:10px; padding:13px 14px; border-radius:var(--r-md);',
'  border:1px dashed var(--border); color:var(--dim); font-size:12.5px; line-height:1.45; }',
'.ac2-nav-done svg.i{ width:16px; height:16px; color:var(--accent); flex:0 0 auto; }',

/* --- ГЛАВНАЯ: поиск, моя учёба, библиотека, напоминания --- */
'.ac2-searchbar{ display:flex; align-items:center; gap:10px; width:100%; padding:12px 14px; margin:0 0 12px;',
'  border-radius:var(--r-md); border:1px solid var(--border); background:var(--surface); cursor:pointer;',
'  color:var(--dim); font-size:13.5px; font-weight:600; text-align:left; min-height:46px; transition:border-color .18s; }',
'.ac2-searchbar:hover{ border-color:var(--accent); }',
'.ac2-searchbar svg.i{ width:16px; height:16px; color:var(--accent); flex:0 0 auto; }',
'.ac2-searchbar span{ flex:1; min-width:0; }',
'.ac2-stats{ display:grid; grid-template-columns:repeat(3,1fr); gap:8px; margin:0 0 12px; }',
'.ac2-stat{ padding:11px 10px; border-radius:var(--r-md); border:1px solid var(--border); background:var(--surface);',
'  display:flex; flex-direction:column; gap:3px; min-width:0; }',
'.ac2-stat b{ font-family:var(--font-display); font-size:24px; line-height:1; color:var(--accent); letter-spacing:.02em; }',
'.ac2-stat span{ font-size:10.5px; font-weight:700; letter-spacing:.04em; text-transform:uppercase; color:var(--dim); line-height:1.3; }',
'.ac2-lib{ display:flex; align-items:center; gap:11px; width:100%; padding:13px 14px; margin:0 0 12px;',
'  border-radius:var(--r-md); border:1px solid var(--border); background:var(--surface); cursor:pointer; text-align:left;',
'  min-height:56px; transition:border-color .18s; }',
'.ac2-lib:hover{ border-color:var(--accent); }',
'.ac2-lib .ic{ width:36px; height:36px; border-radius:11px; background:var(--lime-dim); color:var(--accent);',
'  display:flex; align-items:center; justify-content:center; flex:0 0 auto; }',
'.ac2-lib .ic svg.i{ width:17px; height:17px; }',
'.ac2-lib .m{ flex:1; min-width:0; display:flex; flex-direction:column; gap:2px; }',
'.ac2-lib .m b{ font-size:13.5px; font-weight:700; color:var(--text); }',
'.ac2-lib .m span{ font-size:11.5px; color:var(--dim); font-weight:600; line-height:1.4; }',
'.ac2-lib > svg.i{ width:14px; height:14px; color:var(--dim); flex:0 0 auto; }',
'.ac2-remind{ display:flex; align-items:center; gap:11px; padding:11px 14px; margin:-4px 0 12px;',
'  border-radius:var(--r-md); border:1px solid var(--border); background:var(--surface); }',
'.ac2-remind .m{ flex:1; min-width:0; }',
'.ac2-remind .m b{ display:block; font-size:12.5px; font-weight:700; }',
'.ac2-remind .m span{ display:block; font-size:11px; color:var(--dim); line-height:1.4; margin-top:2px; }',
'.ac2-sw{ position:relative; width:44px; height:26px; flex:0 0 auto; cursor:pointer; }',
'.ac2-sw input{ position:absolute; opacity:0; width:100%; height:100%; margin:0; cursor:pointer; }',
'.ac2-sw i{ position:absolute; inset:0; border-radius:99px; background:var(--raised); border:1px solid var(--border); transition:.2s; }',
'.ac2-sw i::after{ content:""; position:absolute; left:3px; top:3px; width:18px; height:18px; border-radius:50%;',
'  background:var(--dim); transition:.2s; }',
'.ac2-sw input:checked + i{ background:var(--lime-dim); border-color:rgba(154,255,0,.45); }',
'.ac2-sw input:checked + i::after{ left:23px; background:var(--lime); }',

/* --- ПОЛНОЭКРАННЫЙ СЛОЙ: поиск / библиотека / читалка --- */
/* Слой Академии выше плавающих подсказок роста и «сделай Reels» (z 2200-9300):
   иначе они ложатся на шапку слоя и прячут кнопку «назад». */
'.ac2-full{ position:fixed; inset:0; z-index:2400; background:var(--bg); display:flex; flex-direction:column;',
'  transform:translateX(100%); transition:transform .26s cubic-bezier(.3,1,.4,1); visibility:hidden; }',
'.ac2-full.open{ transform:none; visibility:visible; }',
'.ac2-full-top{ display:flex; align-items:center; gap:11px; flex:0 0 auto;',
'  padding:calc(var(--oko-safe-top) + 10px) max(var(--oko-safe-right),14px) 10px max(var(--oko-safe-left),12px);',
'  border-bottom:1px solid var(--border); background:var(--surface); }',
'.ac2-full-close{ width:38px; height:38px; border-radius:50%; background:var(--raised); border:1px solid var(--border);',
'  display:flex; align-items:center; justify-content:center; color:var(--text); flex:0 0 auto; cursor:pointer; }',
'.ac2-full-close svg.i{ width:15px; height:15px; }',
'.ac2-full-title{ min-width:0; flex:1; }',
'.ac2-full-title b{ display:block; font-family:var(--font-display); font-size:23px; line-height:1.05; letter-spacing:.04em;',
'  overflow-wrap:break-word; }',
'.ac2-full-title span{ display:block; font-size:11.5px; color:var(--dim); font-weight:600; line-height:1.35; margin-top:2px; }',
'.ac2-full-body{ flex:1; min-height:0; overflow-y:auto; -webkit-overflow-scrolling:touch;',
'  padding:14px max(var(--oko-safe-right),14px) calc(28px + var(--oko-safe-bottom)) max(var(--oko-safe-left),14px); }',
'@media (min-width:820px){ .ac2-full-body{ max-width:820px; margin-inline:auto; width:100%; } }',

'.ac2-input{ width:100%; background:var(--raised); border:1px solid var(--border); border-radius:var(--r-md);',
'  color:var(--text); padding:12px 14px; font-size:14px; font-family:var(--font-body); min-height:46px; }',
'.ac2-input:focus{ outline:none; border-color:var(--accent); }',
'.ac2-chips{ display:flex; gap:8px; flex-wrap:wrap; margin:12px 0 4px; }',
'.ac2-chip{ font-size:12px; font-weight:700; color:var(--dim); background:var(--raised); border:1px solid var(--border);',
'  border-radius:99px; padding:7px 12px; cursor:pointer; min-height:34px; }',
'.ac2-chip.on{ background:var(--lime); border-color:var(--lime); color:#000; }',
'.ac2-sec{ font-size:11px; font-weight:800; letter-spacing:.09em; text-transform:uppercase; color:var(--dim);',
'  margin:18px 0 8px; }',
'.ac2-res{ display:flex; align-items:flex-start; gap:11px; width:100%; text-align:left; padding:12px 13px; margin-bottom:8px;',
'  border-radius:var(--r-md); border:1px solid var(--border); background:var(--surface); cursor:pointer;',
'  transition:border-color .18s; }',
'.ac2-res:hover{ border-color:var(--accent); }',
'.ac2-res .n{ font-family:var(--font-display); font-size:16px; color:var(--accent); min-width:26px; text-align:center;',
'  flex:0 0 auto; padding-top:2px; letter-spacing:.03em; }',
'.ac2-res .m{ flex:1; min-width:0; }',
'.ac2-res .m b{ display:block; font-size:13.5px; font-weight:700; line-height:1.35; margin-bottom:3px; }',
'.ac2-res .m .w{ display:block; font-size:11px; color:var(--dim); font-weight:700; letter-spacing:.03em;',
'  text-transform:uppercase; margin-bottom:4px; }',
'.ac2-res .m p{ font-size:12px; color:var(--dim); line-height:1.5; margin:0; }',
'.ac2-res mark{ background:rgba(154,255,0,.22); color:var(--accent); border-radius:3px; padding:0 2px; }',
'.ac2-res .go{ width:13px; height:13px; color:var(--dim); flex:0 0 auto; margin-top:4px; }',
'.ac2-empty{ padding:26px 16px; text-align:center; color:var(--dim); font-size:13px; line-height:1.6;',
'  border:1px dashed var(--border); border-radius:var(--r-md); }',
'.ac2-empty svg.i{ width:22px; height:22px; color:var(--dim); display:block; margin:0 auto 10px; opacity:.7; }',
'.ac2-note{ font-size:11.5px; color:var(--dim); line-height:1.55; margin:8px 0 0; }',
/* Обложка курса в каталоге рисуется в поле 320×190, а плитка была 16:7 и резала
   SVG по высоте: «АКАДЕМИЯ OKO» под названием курса просто не помещалась.
   Даём плитке пропорции самой обложки — текст на ней читается целиком. */
'.ac-cc-cover{ aspect-ratio:320/190; }',

/* Строки сертификатов резались в одну строку с многоточием — «Направлен…»
   и обрубленный номер документа. Даём две строки и перенос номера. */
'.ac-cert-item .t, .ac-cert-item .meta .t, .ac-pcert-row .t{ white-space:normal !important;',
'  display:-webkit-box !important; -webkit-line-clamp:2; -webkit-box-orient:vertical; overflow:hidden; }',
'.ac-cert-item .s, .ac-pcert-row .s{ white-space:normal !important; overflow-wrap:anywhere; }',
/* на узком экране название и две кнопки в один ряд не влезали и «Направление»
   сжималось до «Направлени…» — кнопки переносим на вторую строку */
'.ac-cert-item, .ac-pcert-row{ align-items:flex-start; flex-wrap:wrap; row-gap:8px; }',
'.ac-cert-item .meta, .ac-pcert-row .meta{ flex:1 1 150px; min-width:150px; }',
'.ac-cert-item .btn.sm, .ac-pcert-row .btn.sm{ align-self:center; }',
'.ac-cert-item .ac-ico-btn, .ac-pcert-row .ac-ico-btn{ margin-left:auto; }',
/* подписи наград «Завершить направление…» тоже обрывались */
'.ac-badge .d{ -webkit-line-clamp:3; }',

/* Кнопки под сертификатом в полноэкранном просмотре не помещались в ряд:
   «Скачать PNG» уезжала за левый край, «Поделиться» — за правый */
'.ac-cert-full-actions{ flex-wrap:wrap; justify-content:center; max-width:100%;',
'  padding:0 max(var(--oko-safe-right),10px) 0 max(var(--oko-safe-left),10px); }',
'.ac-cert-full-actions .btn{ flex:0 1 auto; }',
'#acCertFull{ padding-top:calc(var(--oko-safe-top) + 16px); padding-bottom:calc(var(--oko-safe-bottom) + 16px); }',

/* Чипы формулы практики обрезались многоточием прямо посреди подсказки —
   пусть переносятся и читаются целиком */
'.ac-task-formula{ flex-wrap:wrap; }',
'.ac-task-formula span{ white-space:normal !important; overflow:visible !important; text-overflow:clip !important;',
'  max-width:100% !important; }',
'.ac-task-ta{ min-height:120px; }',
/* строка действий под полем «вопросы по уроку»: кнопка не должна ужиматься */
'.acd-comment-actions{ flex-wrap:wrap; gap:8px; }',
'.acd-comment-actions > span{ flex:1 1 150px; min-width:0; line-height:1.35; }',
'.acd-comment-actions .btn{ flex:0 0 auto; white-space:nowrap; }',
'.acd-comment-ta{ min-height:92px; }',
/* Подписи карточек аналитики обрезались многоточием — читаем целиком */
'.acd-a-card .lbl{ white-space:normal !important; overflow:visible !important; text-overflow:clip !important; line-height:1.25; }',
'.acd-a-bar .t{ white-space:normal !important; overflow:hidden; display:-webkit-box; -webkit-line-clamp:2; -webkit-box-orient:vertical; }',

'.ac2-reader{ font-size:14px; line-height:1.7; }',
'.ac2-reader h4{ font-family:var(--font-display); font-size:19px; letter-spacing:.03em; margin:18px 0 6px; }',
'.ac2-reader p{ margin:0 0 10px; color:var(--text); }',
'.ac2-row-acts{ display:flex; gap:8px; flex-wrap:wrap; margin-top:8px; }',

/* --- честная практика --- */
'.ac2-selfcheck{ font-size:11.5px; color:var(--dim); line-height:1.55; margin-top:10px;',
'  padding-top:10px; border-top:1px solid var(--border); }',
'.ac2-ref{ border:1px solid rgba(154,255,0,.32); background:var(--lime-dim); border-radius:var(--r-md);',
'  padding:12px 13px; margin-top:10px; }',
'.ac2-ref .h{ display:flex; align-items:center; gap:7px; font-size:11px; font-weight:800; letter-spacing:.08em;',
'  text-transform:uppercase; color:var(--accent); margin-bottom:6px; }',
'.ac2-ref .h svg.i{ width:13px; height:13px; }',
'.ac2-ref p{ font-size:13px; line-height:1.6; color:var(--text); margin:0; }',
'.ac2-mine{ font-size:12.5px; line-height:1.6; color:var(--dim); margin-top:10px; white-space:pre-wrap;',
'  overflow-wrap:break-word; }',

/* Пока открыт полноэкранный слой Академии (поиск, библиотека, карточка курса,
   админ-панель): плавающие подсказки других модулей не перекрывают шапку слоя,
   а модальный попап поднимается над слоем — иначе диалог остаётся невидимым. */
'body.ac2-over .okg-pill, body.ac2-over .vr-nudge{ display:none !important; }',
'body.ac2-over #okoPopup{ z-index:2600; }',

'@keyframes ac2Fade{ from{ opacity:0; transform:translateY(-4px);} to{ opacity:1; transform:none;} }',

/* --- адаптив --- */
'@media (min-width:680px){',
'  .ac-catalog{ display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:12px; }',
'  .ac2-nav{ grid-template-columns:1fr 1fr; }',
'}',
'@media (max-width:380px){',
'  .ac2-stats{ grid-template-columns:repeat(3,1fr); gap:6px; }',
'  .ac2-stat{ padding:9px 7px; }',
'  .ac2-stat b{ font-size:20px; }',
'  .ac2-stat span{ font-size:9.5px; letter-spacing:.02em; }',
'  .ac2-nav{ grid-template-columns:1fr; }',
'  .ac2-nav-btn.rev{ flex-direction:row; text-align:left; }',
'  .ac2-nav-btn.rev .m{ align-items:flex-start; }',
'}',
'@media (prefers-reduced-motion:reduce){ .ac2-full{ transition:none; } }'
].join('\n');

try{
  var st = D.createElement('style');
  st.id = 'oko-academy2-style';
  st.textContent = CSS;
  (D.head || D.documentElement).appendChild(st);
}catch(e){}

/* ---------------------------------------------------------------------------
   4. ЗАГОЛОВКИ: не обрезаются, помещаются в две строки
   --------------------------------------------------------------------------- */
function fitTitle(el, maxLines, minPx){
  if(!el) return;
  try{
    var base = parseFloat(el.getAttribute('data-ac2-base') || '');
    if(!base){
      base = parseFloat(getComputedStyle(el).fontSize) || 24;
      el.setAttribute('data-ac2-base', String(base));
    }
    var size = base, guard = 0;
    el.style.fontSize = size + 'px';
    while(guard++ < 20){
      var cs = getComputedStyle(el);
      var lh = parseFloat(cs.lineHeight);
      if(!lh || isNaN(lh)) lh = size * 1.1;
      if(el.scrollHeight <= lh * maxLines + 1) break;
      size -= Math.max(1, size * 0.06);
      if(size <= minPx){ size = minPx; el.style.fontSize = size + 'px'; break; }
      el.style.fontSize = size + 'px';
    }
  }catch(e){}
}
function fitAll(){
  $$('#acRoot .ac-lesson-head h2').forEach(function(el){ fitTitle(el, 2, 20); });
  $$('#acRoot .ac-course-hero-cap h2').forEach(function(el){ fitTitle(el, 2, 20); });
  $$('#acRoot .ac-continue-title').forEach(function(el){ fitTitle(el, 2, 17); });
  $$('#acRoot .ac-cc-body h3').forEach(function(el){ fitTitle(el, 2, 16); });
  $$('.ac2-full.open .ac2-full-title b').forEach(function(el){ fitTitle(el, 2, 15); });
  $$('.acd-full.open .acd-full-title b').forEach(function(el){ fitTitle(el, 2, 15); });
}

/* ---------------------------------------------------------------------------
   5. ВРЕМЯ В УРОКЕ (реальное, без выдумок)
   --------------------------------------------------------------------------- */
var tickL = -1, tickAt = 0;
function timeStart(i){
  timeStop();
  tickL = i; tickAt = Date.now();
}
function timeStop(){
  if(tickL < 0) return;
  var d = Math.round((Date.now() - tickAt) / 1000);
  if(d > 2 && d < 5400){ S.time[tickL] = (S.time[tickL] || 0) + d; save(); }
  tickL = -1;
}
D.addEventListener('visibilitychange', function(){ if(D.hidden) timeStop(); else if(view() === 'lesson') timeStart(curIdx()); });
window.addEventListener('pagehide', timeStop);

/* ---------------------------------------------------------------------------
   6. ЗАКЛАДКИ И ОФЛАЙН-КОНСПЕКТЫ
   --------------------------------------------------------------------------- */
function marked(i){ return !!S.marks[i]; }
window.ac2Mark = function(i){
  i = +i;
  if(S.marks[i]){ delete S.marks[i]; say('Закладка снята'); }
  else { S.marks[i] = Date.now(); say('В закладках · открыть можно из Академии'); }
  save();
  if(view() === 'lesson') renderLessonBar();
};
function offlineTxt(i){
  var L = LESSONS()[i]; if(!L) return '';
  var ci = courseOf(i), c = COURSES()[ci] || {title:'Академия OKO'};
  var out = 'АКАДЕМИЯ OKO · НАПРАВЛЕНИЕ «' + String(c.title).toUpperCase() + '»\r\n'
          + 'УРОК ' + localNo(i) + ' — ' + String(L.title).toUpperCase() + '\r\n'
          + new Array(47).join('=') + '\r\n\r\n';
  var e = (window.AC_ENRICH || {})[i];
  if(e && e.intro) out += strip(e.intro) + '\r\n\r\n';
  (L.slides || []).forEach(function(s, k){
    out += (k + 1) + '. ' + strip(s.t).toUpperCase() + '\r\n';
    (s.pts || []).forEach(function(p){ out += '   — ' + strip(p) + '\r\n'; });
    out += '\r\n';
  });
  if(e && e.notes && e.notes.length){
    out += 'ГЛУБОКИЙ РАЗБОР\r\n';
    e.notes.forEach(function(n){ out += '• ' + strip(n.h) + '\r\n  ' + strip(n.body) + '\r\n\r\n'; });
  }
  if(e && e.lifehack) out += 'ЛАЙФХАК\r\n' + strip(e.lifehack) + '\r\n\r\n';
  out += new Array(47).join('-') + '\r\nАкадемия OKO · https://okoteam.top\r\n';
  return out;
}
function offlineSave(i, quiet){
  var L = LESSONS()[i]; if(!L) return false;
  var ci = courseOf(i);
  S.offline[i] = {
    t: L.title,
    c: (COURSES()[ci] || {}).title || '',
    no: localNo(i),
    txt: offlineTxt(i),
    ts: Date.now()
  };
  save();
  if(!quiet) say('Конспект сохранён на устройстве — открывается без сети');
  return true;
}
window.ac2Offline = function(i){
  i = +i;
  if(S.offline[i]){ delete S.offline[i]; save(); say('Офлайн-копия удалена'); }
  else offlineSave(i);
  if(view() === 'lesson') renderLessonBar();
};

/* ---------------------------------------------------------------------------
   7. ПОЛНОЭКРАННЫЙ СЛОЙ (поиск, библиотека, читалка)
   --------------------------------------------------------------------------- */
var fullHist = [];   // функции возврата на предыдущую страницу слоя
function fullEl(){
  var f = D.getElementById('ac2Full');
  if(f) return f;
  f = D.createElement('div');
  f.id = 'ac2Full';
  f.className = 'ac2-full';
  f.setAttribute('role', 'dialog');
  f.setAttribute('aria-modal', 'true');
  D.body.appendChild(f);
  return f;
}
function fullOpen(title, sub, body){
  var f = fullEl();
  var wasOpen = f.classList.contains('open');
  f.innerHTML =
    '<div class="ac2-full-top">' +
      '<button class="ac2-full-close" onclick="ac2FullBack()" aria-label="Назад">' + ico('back') + '</button>' +
      '<div class="ac2-full-title"><b>' + esc(title) + '</b><span>' + esc(sub || '') + '</span></div>' +
    '</div>' +
    '<div class="ac2-full-body" id="ac2FullBody">' + body + '</div>';
  fullHist = [];                       // это корневая страница слоя
  D.body.classList.add('ac2-over');
  requestAnimationFrame(function(){ f.classList.add('open'); fitAll(); });
  if(!wasOpen){
    try{ if(typeof window.nvPush === 'function') window.nvPush('ac2:full', fullCloseAll); }catch(e){}
  }
}
/* подстраница внутри слоя: restorePrev вернёт на ту, с которой ушли */
function fullSet(title, sub, body, restorePrev){
  var f = D.getElementById('ac2Full');
  if(!f || !f.classList.contains('open')){ fullOpen(title, sub, body); return; }
  var t = f.querySelector('.ac2-full-title');
  if(t) t.innerHTML = '<b>' + esc(title) + '</b><span>' + esc(sub || '') + '</span>';
  var b = D.getElementById('ac2FullBody');
  if(b){ b.innerHTML = body; b.scrollTop = 0; }
  if(typeof restorePrev === 'function') fullHist.push(restorePrev);
  fitAll();
}
function fullCloseAll(){
  var f = D.getElementById('ac2Full');
  fullHist = [];
  if(f) f.classList.remove('open');
  if(!D.querySelector('.acd-full.open')) D.body.classList.remove('ac2-over');
  try{ if(typeof window.nvPop === 'function') window.nvPop('ac2:full'); }catch(e){}
}
window.ac2FullBack = function(){
  if(fullHist.length){ var back = fullHist.pop(); back(); return; }
  fullCloseAll();
};
D.addEventListener('keydown', function(e){
  if(e.key !== 'Escape') return;
  var f = D.getElementById('ac2Full');
  if(f && f.classList.contains('open')){ e.stopPropagation(); window.ac2FullBack(); }
});

/* ---------------------------------------------------------------------------
   8. ПОИСК ПО КУРСАМ И УРОКАМ
   --------------------------------------------------------------------------- */
var Q = { q: '', scope: 'all' };
function snippet(text, q){
  text = String(text || '');
  q = (typeof q === 'string') ? q.trim() : '';
  var plain = function(){ return esc(text.slice(0, 130)) + (text.length > 130 ? '…' : ''); };
  if(!q) return plain();
  var k = text.toLowerCase().indexOf(q.toLowerCase());
  if(k < 0) return plain();
  var from = Math.max(0, k - 48), to = Math.min(text.length, k + q.length + 90);
  var cut = (from > 0 ? '…' : '') + text.slice(from, to) + (to < text.length ? '…' : '');
  var needle = esc(q).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return esc(cut).replace(new RegExp('(' + needle + ')', 'gi'), '<mark>$1</mark>');
}
function searchBody(){
  var q = (Q.q || '').trim();
  var cs = COURSES(), ls = LESSONS();
  var head =
    '<input class="ac2-input" id="ac2Q" type="search" autocomplete="off" placeholder="Название курса, тема урока, слово из материала…" value="' + esc(q) + '" oninput="ac2SearchType(this.value)">' +
    '<div class="ac2-chips">' +
      ['all,Везде', 'courses,Курсы', 'lessons,Уроки', 'marks,Закладки'].map(function(p){
        var k = p.split(',')[0], l = p.split(',')[1];
        return '<button class="ac2-chip ' + (Q.scope === k ? 'on' : '') + '" onclick="ac2SearchScope(\'' + k + '\')">' + l + '</button>';
      }).join('') +
    '</div><div id="ac2Res"></div>';
  return head;
}
function searchResults(){
  var q = (Q.q || '').trim().toLowerCase();
  var cs = COURSES(), ls = LESSONS(), out = '';

  if(Q.scope === 'marks'){
    var keys = Object.keys(S.marks).map(Number).sort(function(a, b){ return S.marks[b] - S.marks[a]; });
    if(!keys.length) return emptyBox('bookmark', 'Закладок пока нет. Открой урок и нажми «В закладки» — он появится здесь.');
    return '<div class="ac2-sec">Закладки · ' + keys.length + '</div>' +
      keys.map(function(i){ return lessonRowHtml(i, q); }).join('');
  }

  if(Q.scope !== 'lessons'){
    var cHits = [];
    for(var ci = 0; ci < cs.length; ci++){
      var c = cs[ci];
      var hay = (c.title + ' ' + c.sub + ' ' + (c.author || '') + ' ' + (c.outcomes || []).join(' ')).toLowerCase();
      if(!q || hay.indexOf(q) >= 0) cHits.push(ci);
    }
    if(cHits.length){
      out += '<div class="ac2-sec">Курсы · ' + cHits.length + '</div>';
      out += cHits.map(function(ci){
        var c = cs[ci], pct = (typeof window.acCoursePctOf === 'function') ? window.acCoursePctOf(ci) : 0;
        var open = courseOpen(ci);
        return '<button class="ac2-res" onclick="ac2GoCourse(' + ci + ')">' +
          '<span class="n">' + ico(open ? 'compass' : 'lock') + '</span>' +
          '<span class="m"><span class="w">' + esc(c.tag || 'Направление') + ' · ' + c.count + ' ' + plural(c.count, ['урок', 'урока', 'уроков']) + (pct ? ' · пройдено ' + pct + '%' : '') + '</span>' +
          '<b>' + esc(c.title) + '</b><p>' + snippet(strip(c.sub + '. ' + (c.outcomes || []).join('. ')), q) + '</p></span>' +
          '<svg class="i go"><use href="#i-chev"/></svg></button>';
      }).join('');
    }
  }

  if(Q.scope !== 'courses'){
    var lHits = [];
    for(var i = 0; i < ls.length && lHits.length < 60; i++){
      if(!q){ if(lHits.length < 12) lHits.push(i); continue; }
      if(lessonText(i).toLowerCase().indexOf(q) >= 0) lHits.push(i);
    }
    if(lHits.length){
      out += '<div class="ac2-sec">Уроки · ' + lHits.length + (lHits.length >= 60 ? '+' : '') + '</div>';
      out += lHits.map(function(i){ return lessonRowHtml(i, q); }).join('');
    } else if(q){
      out += emptyBox('search', 'По запросу «' + esc(q) + '» в уроках ничего не нашлось. Попробуй другое слово — поиск идёт по заголовкам, слайдам и разборам.');
    }
  }
  if(!out) out = emptyBox('search', 'Ничего не нашлось. Сбрось фильтр или измени запрос.');
  return out;
}
function lessonRowHtml(i, q){
  var L = LESSONS()[i]; if(!L) return '';
  var ci = courseOf(i), c = COURSES()[ci] || {title:''}, b = blockOf(i);
  var pct = lessonPct(i);
  var open = courseOpen(ci);
  return '<button class="ac2-res" onclick="ac2GoLesson(' + i + ')">' +
    '<span class="n">' + localNo(i) + '</span>' +
    '<span class="m"><span class="w">' + esc(c.title) + (b ? ' · ' + esc(b.title) : '') +
      ' · ' + minTxt(lessonMins(i)) + (pct ? ' · ' + pct + '%' : '') + (open ? '' : ' · закрыт') + '</span>' +
    '<b>' + esc(L.title) + '</b><p>' + snippet(lessonText(i), q || '') + '</p></span>' +
    '<svg class="i go"><use href="#i-chev"/></svg></button>';
}
function emptyBox(icon, text){
  return '<div class="ac2-empty">' + ico(icon) + text + '</div>';
}
var _qt = null;
window.ac2SearchType = function(v){
  Q.q = v;
  clearTimeout(_qt);
  _qt = setTimeout(function(){
    var r = D.getElementById('ac2Res');
    if(r) r.innerHTML = searchResults();
  }, 170);
};
window.ac2SearchScope = function(k){
  Q.scope = k;
  $$('#ac2FullBody .ac2-chip').forEach(function(el){ el.classList.remove('on'); });
  var idx = ['all', 'courses', 'lessons', 'marks'].indexOf(k);
  var chips = $$('#ac2FullBody .ac2-chip');
  if(chips[idx]) chips[idx].classList.add('on');
  var r = D.getElementById('ac2Res');
  if(r) r.innerHTML = searchResults();
};
window.ac2GoLesson = function(i){
  fullCloseAll();
  setTimeout(function(){
    if(typeof window.showTab === 'function') window.showTab('academy');
    if(typeof window.acOpenLesson === 'function') window.acOpenLesson(+i);
  }, 60);
};
window.ac2GoCourse = function(ci){
  fullCloseAll();
  setTimeout(function(){
    if(typeof window.showTab === 'function') window.showTab('academy');
    if(typeof window.acOpenCourse === 'function') window.acOpenCourse(+ci);
  }, 60);
};
window.ac2Search = {
  open: function(q){
    Q.q = q || '';
    Q.scope = 'all';
    fullOpen('Поиск по Академии',
      COURSES().length + ' ' + plural(COURSES().length, ['направление', 'направления', 'направлений']) + ' · ' + LESSONS().length + ' ' + plural(LESSONS().length, ['урок', 'урока', 'уроков']),
      searchBody());
    var r = D.getElementById('ac2Res');
    if(r) r.innerHTML = searchResults();
    var inp = D.getElementById('ac2Q');
    if(inp && !q) setTimeout(function(){ try{ inp.focus(); }catch(e){} }, 220);
  },
  close: fullCloseAll
};

/* ---------------------------------------------------------------------------
   9. БИБЛИОТЕКА: закладки · офлайн · заметки
   --------------------------------------------------------------------------- */
var LIB = 'marks';
function notesMap(){
  try{ return (window.acS && window.acS.notes) || {}; }catch(e){ return {}; }
}
function libBody(){
  var tabs = [['marks', 'Закладки', 'bookmark'], ['offline', 'Офлайн', 'download'], ['notes', 'Заметки', 'edit']];
  var head = '<div class="ac2-chips">' + tabs.map(function(t){
    var n = t[0] === 'marks' ? Object.keys(S.marks).length
          : t[0] === 'offline' ? Object.keys(S.offline).length
          : Object.keys(notesMap()).filter(function(k){ return String(notesMap()[k] || '').trim(); }).length;
    return '<button class="ac2-chip ' + (LIB === t[0] ? 'on' : '') + '" onclick="ac2LibTab(\'' + t[0] + '\')">' + t[1] + ' · ' + n + '</button>';
  }).join('') + '</div><div id="ac2LibPane">' + libPane() + '</div>';
  return head;
}
function libPane(){
  if(LIB === 'marks'){
    var keys = Object.keys(S.marks).map(Number).sort(function(a, b){ return S.marks[b] - S.marks[a]; });
    if(!keys.length) return emptyBox('bookmark', 'Закладок пока нет.<br>Открой урок и нажми «В закладки» — он окажется здесь, чтобы вернуться в один тап.');
    return keys.map(function(i){
      return lessonRowHtml(i) +
        '<div class="ac2-row-acts"><button class="ac2-act" onclick="ac2Mark(' + i + ');ac2LibTab(\'marks\')">' + ico('trash') + ' Убрать из закладок</button></div>';
    }).join('');
  }
  if(LIB === 'offline'){
    var ok = Object.keys(S.offline).map(Number).sort(function(a, b){ return S.offline[b].ts - S.offline[a].ts; });
    var intro = '<p class="ac2-note">Сохранённые конспекты лежат на этом устройстве и открываются без сети. ' +
                'Сохранить можно любой урок — кнопка «Офлайн» на странице урока. Уроки, пройденные на 100%, сохраняются сами.</p>';
    if(!ok.length) return intro + emptyBox('download', 'Офлайн-конспектов пока нет.<br>Пройди урок или нажми «Офлайн» на его странице.');
    var sz = 0; ok.forEach(function(i){ sz += (S.offline[i].txt || '').length; });
    return intro + '<div class="ac2-sec">Сохранено ' + ok.length + ' ' + plural(ok.length, ['конспект', 'конспекта', 'конспектов']) + ' · ' + Math.max(1, Math.round(sz / 1024)) + ' КБ</div>' +
      ok.map(function(i){
        var o = S.offline[i];
        return '<button class="ac2-res" onclick="ac2Read(' + i + ')">' +
          '<span class="n">' + ico('file') + '</span>' +
          '<span class="m"><span class="w">' + esc(o.c) + ' · урок ' + o.no + ' · ' + new Date(o.ts).toLocaleDateString('ru-RU') + '</span>' +
          '<b>' + esc(o.t) + '</b><p>' + esc(String(o.txt || '').slice(0, 120).replace(/\s+/g, ' ')) + '…</p></span>' +
          '<svg class="i go"><use href="#i-chev"/></svg></button>' +
          '<div class="ac2-row-acts">' +
            '<button class="ac2-act" onclick="event.stopPropagation();ac2Read(' + i + ')">' + ico('eye') + ' Читать</button>' +
            '<button class="ac2-act" onclick="event.stopPropagation();ac2Offline(' + i + ');ac2LibTab(\'offline\')">' + ico('trash') + ' Удалить копию</button>' +
          '</div>';
      }).join('');
  }
  var nm = notesMap();
  var nk = Object.keys(nm).map(Number).filter(function(k){ return String(nm[k] || '').trim(); });
  if(!nk.length) return emptyBox('edit', 'Заметок пока нет.<br>На странице урока есть кнопка «Заметки» — всё, что напишешь, останется на этом устройстве.');
  return nk.map(function(i){
    var L = LESSONS()[i] || {title: 'Урок ' + (i + 1)};
    var ci = courseOf(i), c = COURSES()[ci] || {title: ''};
    return '<button class="ac2-res" onclick="ac2GoLesson(' + i + ')">' +
      '<span class="n">' + localNo(i) + '</span>' +
      '<span class="m"><span class="w">' + esc(c.title) + ' · заметка</span><b>' + esc(L.title) + '</b>' +
      '<p>' + esc(String(nm[i]).slice(0, 160)) + (String(nm[i]).length > 160 ? '…' : '') + '</p></span>' +
      '<svg class="i go"><use href="#i-chev"/></svg></button>';
  }).join('');
}
window.ac2LibTab = function(k){
  LIB = k;
  var body = D.getElementById('ac2FullBody');
  if(body) body.innerHTML = libBody();
};
window.ac2OpenLibrary = function(tab){
  LIB = tab || 'marks';
  fullOpen('Моя библиотека', 'Закладки, конспекты офлайн и заметки', libBody());
};
window.ac2Read = function(i){
  i = +i;
  var o = S.offline[i];
  if(!o){ say('Конспект не сохранён'); return; }
  var html = '<div class="ac2-reader">' + String(o.txt).split(/\r?\n\r?\n/).map(function(par){
    var t = par.trim(); if(!t) return '';
    if(/^[0-9]+\. [А-ЯЁA-Z ,«»\-–—]+$/.test(t) || /^[А-ЯЁ ]{4,}$/.test(t)) return '<h4>' + esc(t) + '</h4>';
    return '<p>' + esc(t).replace(/\r?\n/g, '<br>') + '</p>';
  }).join('') + '</div>';
  fullSet(o.t, (o.c || '') + ' · урок ' + o.no + ' · офлайн-копия, открывается без сети', html,
    function(){ window.ac2OpenLibrary('offline'); });
};

/* ---------------------------------------------------------------------------
   10. ПАНЕЛЬ УРОКА: крошки, метрики, оглавление, действия
   --------------------------------------------------------------------------- */
var tocOpen = false;
function lessonBarHtml(){
  var i = curIdx(), L = LESSONS()[i];
  if(!L) return '';
  var ci = courseOf(i), c = COURSES()[ci] || {title: '', count: 0}, b = blockOf(i);
  var items = lessonItems(i);
  var doneN = items.filter(function(x){ return x[1]; }).length;
  var pct = lessonPct(i);
  var spent = spentMins(i);

  var crumbs = '<div class="ac2-crumbs">' +
    '<span>' + esc(c.title) + '</span>' +
    (b ? '<span class="sep">·</span><span>' + esc(b.title) + '</span>' : '') +
    '<span class="sep">·</span><span>урок <b>' + localNo(i) + '</b> из ' + c.count + '</span></div>';

  var curStep = 0;
  for(curStep = 0; curStep < items.length; curStep++) if(!items[curStep][1]) break;
  if(curStep >= items.length) curStep = items.length - 1;
  var top = '<div class="ac2-bar-top"><span>Этап <b>' + Math.min(curStep + 1, items.length) + '</b> из ' +
    items.length + ' · <b>' + pct + '%</b></span>' +
    '<span class="ac2-xp">' + ico('bolt') + '+30 XP за урок</span></div>';

  var meta = '<div class="ac2-meta">' +
    '<span class="ac2-mchip">' + ico('clock') + '~' + minTxt(lessonMins(i)) + '</span>' +
    '<span class="ac2-mchip">' + ico('file') + lessonWords(i) + ' ' + plural(lessonWords(i), ['слово', 'слова', 'слов']) + '</span>' +
    (spent >= 1 ? '<span class="ac2-mchip on">' + ico('target') + 'в уроке ' + minTxt(spent) + '</span>' : '') +
    '</div>';

  var acts = '<div class="ac2-acts">' +
    '<button class="ac2-act' + (tocOpen ? ' on' : '') + '" onclick="ac2Toc()">' + ico('poll') + 'Оглавление</button>' +
    '<button class="ac2-act" onclick="apdNotesOpen && apdNotesOpen()">' + ico('edit') + 'Заметки</button>' +
    '<button class="ac2-act' + (marked(i) ? ' on' : '') + '" onclick="ac2Mark(' + i + ')">' + ico('bookmark') + (marked(i) ? 'В закладках' : 'В закладки') + '</button>' +
    '<button class="ac2-act' + (S.offline[i] ? ' on' : '') + '" onclick="ac2Offline(' + i + ')">' + ico('download') + (S.offline[i] ? 'Есть офлайн' : 'Офлайн') + '</button>' +
    '</div>';

  return '<div class="card ac2-bar' + (tocOpen ? ' toc-open' : '') + '" id="ac2Bar">' +
    crumbs + top + stepsHtml(items, curStep) +
    '<div class="ac2-track"><i style="width:' + pct + '%"></i></div>' +
    meta + acts + tocHtml(i) + '</div>';
}
/* Этапы урока — ровно те, что реально есть (видео сейчас выключено). */
var STEP_MAP = [
  {re: /видео/i,   ic: 'circle-play', l: 'Видео',    a: '#acVideoBox'},
  {re: /слайд/i,   ic: 'file',        l: 'Слайды',   a: '#acSlidesBox'},
  {re: /тест/i,    ic: 'poll',        l: 'Тест',     a: '#acTestBox'},
  {re: /практик/i, ic: 'edit',        l: 'Практика', a: '#acTaskBox'},
  {re: /игра/i,    ic: 'bolt',        l: 'Игра',     a: '#acGameBox'}
];
function stepsHtml(items, curStep){
  return '<div class="ac2-steps">' + items.map(function(it, k){
    var m = null;
    for(var j = 0; j < STEP_MAP.length; j++) if(STEP_MAP[j].re.test(it[0])){ m = STEP_MAP[j]; break; }
    if(!m) m = {ic: 'flag', l: String(it[0]).split(' ')[0], a: '#acProgressBox'};
    var cls = it[1] ? ' done' : (k === curStep ? ' cur' : '');
    return '<button class="ac2-step' + cls + '" onclick="ac2Go(\'' + m.a + '\')" aria-label="' + esc(m.l) + '">' +
      '<span class="d">' + (it[1] ? ico('check2') : String(k + 1)) + '</span>' +
      '<span class="l">' + esc(m.l) + '</span></button>';
  }).join('') + '</div>';
}
function tocHtml(i){
  var L = LESSONS()[i]; if(!L) return '';
  var ls = (typeof window.acLS === 'function') ? window.acLS(i) : {};
  var e = (window.AC_ENRICH || {})[i];
  var slideMax = ls.slideMax || 0;
  var rows = [];
  function row(done, title, sub, anchor){
    return '<button class="ac2-toc-row' + (done ? ' done' : '') + '" onclick="ac2Go(\'' + anchor + '\')">' +
      '<span class="tk">' + ico('check2') + '</span>' +
      '<span class="tt">' + esc(title) + '</span>' +
      '<span class="ts">' + esc(sub) + '</span></button>';
  }
  var nS = (L.slides || []).length, nQ = (L.quiz || []).length;
  rows.push(row(!!ls.slides, 'Слайды урока', nS + ' ' + plural(nS, ['слайд', 'слайда', 'слайдов']), '#acSlidesBox'));
  rows.push('<div class="ac2-toc-slides">' + (L.slides || []).map(function(s, k){
    return '<button class="ac2-sdot' + (k <= slideMax ? ' seen' : '') + '" title="' + esc(strip(s.t)) + '" onclick="ac2Slide(' + k + ')">' + (k + 1) + '</button>';
  }).join('') + '</div>');
  if(e && e.notes && e.notes.length)
    rows.push(row(false, 'Глубокий разбор', e.notes.length + ' ' + plural(e.notes.length, ['раздел', 'раздела', 'разделов']), '.ac-deep'));
  rows.push(row(false, 'Конспект урока', '~' + minTxt(Math.max(2, Math.round(lessonWords(i) / Math.max(80, S.wpm)))), '#acNotes'));
  rows.push(row(!!ls.test, 'Тест по материалу', nQ + ' ' + plural(nQ, ['вопрос', 'вопроса', 'вопросов']), '#acTestBox'));
  rows.push(row(!!ls.task, 'Практика', 'самопроверка', '#acTaskBox'));
  rows.push(row(!!ls.game, 'Мини-игра', 'закрепление', '#acGameBox'));
  rows.push(row(lessonDone(i), 'Прогресс урока', lessonPct(i) + '%', '#acProgressBox'));
  rows.push(row(false, 'Сертификат направления', 'за весь курс', '#acCertBox'));

  var wpm = [[120, 'Спокойно'], [150, 'Обычно'], [200, 'Быстро']].map(function(w){
    return '<button class="' + (S.wpm === w[0] ? 'on' : '') + '" onclick="ac2Wpm(' + w[0] + ')">' + w[1] + '</button>';
  }).join('');

  return '<div class="ac2-toc">' +
    '<p class="ac2-toc-h">Оглавление урока</p>' + rows.join('') +
    '<div class="ac2-wpm"><span>Скорость чтения</span>' + wpm +
      '<span style="text-transform:none;letter-spacing:0;font-weight:600;color:var(--dim)">' + S.wpm + ' слов/мин</span></div>' +
    '</div>';
}
window.ac2Toc = function(){
  tocOpen = !tocOpen;
  var b = D.getElementById('ac2Bar');
  if(b){ b.classList.toggle('toc-open', tocOpen); var a = b.querySelector('.ac2-acts .ac2-act'); if(a) a.classList.toggle('on', tocOpen); }
};
window.ac2Wpm = function(v){
  S.wpm = +v; save();
  renderLessonBar();
  var b = D.getElementById('ac2Bar');
  if(b) b.classList.add('toc-open');
  tocOpen = true;
};
/* Настоящий скроллер экрана — это <section class="screen">, а не <main>:
   правило `main > .screen{overflow-x:hidden}` делает секцию контейнером
   прокрутки. Переходы по якорям и сброс прокрутки при открытии урока целились
   в <main> и молча не работали — кнопки «Оглавление» и рельса этапов
   выглядели сломанными. */
function scrollBox(){
  var el = D.getElementById('acRoot');
  for(var p = el && el.parentElement; p; p = p.parentElement){
    var cs = getComputedStyle(p);
    if((cs.overflowY === 'auto' || cs.overflowY === 'scroll') && p.scrollHeight > p.clientHeight + 4) return p;
    if(p.tagName === 'MAIN') return p;
  }
  return D.querySelector('main > .screen.active') || D.querySelector('main');
}
window.ac2Go = function(sel){
  var el = D.querySelector(sel);
  if(!el) return;
  var box = scrollBox();
  if(box){
    var r = el.getBoundingClientRect(), br = box.getBoundingClientRect();
    box.scrollTo({ top: Math.max(0, box.scrollTop + (r.top - br.top) - 14), behavior: 'smooth' });
  } else el.scrollIntoView({ behavior: 'smooth', block: 'start' });
};
/* та же беда была у рельсы шагов из academy-plus — чиним её же функцией */
window.apdStepGo = function(anchor){ window.ac2Go(anchor); };
/* и у переходов между экранами Академии: новая страница открывалась
   прокрученной на позицию предыдущей */
(function patchScrollReset(){
  ['acOpenLesson', 'acOpenCourse', 'acBackHome', 'acCourseCardClick'].forEach(function(k){
    var prev = window[k];
    if(typeof prev !== 'function') return;
    window[k] = function(){
      var r = prev.apply(this, arguments);
      try{ var box = scrollBox(); if(box) box.scrollTop = 0; }catch(e){}
      return r;
    };
  });
})();
window.ac2Slide = function(k){
  var box = D.getElementById('acSlides');
  if(!box || !box.children.length) return;
  var step = box.children[0].offsetWidth + 12;
  box.scrollTo({ left: k * step, behavior: 'smooth' });
  window.ac2Go('#acSlidesBox');
};
function renderLessonBar(){
  var old = D.getElementById('ac2Bar');
  if(!old) return;
  var wrap = D.createElement('div');
  wrap.innerHTML = lessonBarHtml();
  var node = wrap.firstElementChild;
  if(node) old.parentNode.replaceChild(node, old);
}

/* ---------------------------------------------------------------------------
   11. НИЗ УРОКА: следующий урок без возврата в каталог
   --------------------------------------------------------------------------- */
function lessonNavHtml(){
  var i = curIdx(), ci = courseOf(i);
  var c = COURSES()[ci] || {count: 0, from: 0};
  var first = (typeof window.acCourseFirst === 'function') ? window.acCourseFirst(ci) : 0;
  var last = first + c.count - 1;
  var prev = i > first ? i - 1 : -1;
  var next = i < last ? i + 1 : -1;
  var html = '<div class="ac2-nav">';
  if(prev >= 0){
    html += '<button class="ac2-nav-btn" onclick="acOpenLesson(' + prev + ')">' + ico('back') +
      '<span class="m"><span>Предыдущий урок</span><b>' + esc(LESSONS()[prev].title) + '</b></span></button>';
  }
  if(next >= 0){
    html += '<button class="ac2-nav-btn next rev' + (prev < 0 ? ' wide' : '') + '" onclick="acOpenLesson(' + next + ')">' + ico('forward') +
      '<span class="m"><span>Следующий урок · ~' + minTxt(lessonMins(next)) + '</span><b>' + esc(LESSONS()[next].title) + '</b></span></button>';
  }
  if(next < 0){
    html += '<div class="ac2-nav-done">' + ico('flag') +
      '<span>Это последний урок направления «' + esc(c.title || '') + '». Сертификат откроется, когда все уроки будут пройдены.</span></div>';
  }
  html += '<button class="ac2-nav-btn wide" onclick="acBackHome()">' + ico('compass') +
    '<span class="m"><span>Все уроки направления</span><b>' + esc(c.title || 'Курс') + ' · ' + c.count + ' ' + plural(c.count, ['урок', 'урока', 'уроков']) + '</b></span></button>';
  html += '</div>';
  return html;
}

/* ---------------------------------------------------------------------------
   12. ГЛАВНАЯ АКАДЕМИИ: поиск, статистика, библиотека, мягкий стрик
   --------------------------------------------------------------------------- */
function homeStatsHtml(){
  var doneN = (typeof window.acLessonsDoneCount === 'function') ? window.acLessonsDoneCount() : 0;
  var mins = spentTotalMins();
  var st = (typeof window.acStreak === 'function') ? window.acStreak() : {days: 0};
  var big = mins >= 60 ? Math.round(mins / 60) : mins;
  var lbl = mins >= 60 ? plural(big, ['час в учёбе', 'часа в учёбе', 'часов в учёбе'])
                       : plural(big, ['минута в учёбе', 'минуты в учёбе', 'минут в учёбе']);
  return '<div class="ac2-stats" id="ac2Stats">' +
    '<div class="ac2-stat"><b>' + doneN + '</b><span>' + plural(doneN, ['урок пройден', 'урока пройдено', 'уроков пройдено']) + '</span></div>' +
    '<div class="ac2-stat"><b>' + big + '</b><span>' + lbl + '</span></div>' +
    '<div class="ac2-stat"><b>' + (st.days || 0) + '</b><span>' + plural(st.days || 0, ['день подряд', 'дня подряд', 'дней подряд']) + '</span></div>' +
    '</div>';
}
function homeLibHtml(){
  var m = Object.keys(S.marks).length, o = Object.keys(S.offline).length;
  var nm = notesMap();
  var n = Object.keys(nm).filter(function(k){ return String(nm[k] || '').trim(); }).length;
  var sub = (m || o || n)
    ? [m ? m + ' ' + plural(m, ['закладка', 'закладки', 'закладок']) : '',
       o ? o + ' ' + plural(o, ['конспект офлайн', 'конспекта офлайн', 'конспектов офлайн']) : '',
       n ? n + ' ' + plural(n, ['заметка', 'заметки', 'заметок']) : ''].filter(Boolean).join(' · ')
    : 'Пока пусто — закладки, офлайн-конспекты и заметки появятся здесь';
  return '<button class="ac2-lib" onclick="ac2OpenLibrary()">' +
    '<span class="ic">' + ico('bookmark') + '</span>' +
    '<span class="m"><b>Моя библиотека</b><span>' + esc(sub) + '</span></span>' +
    '<svg class="i"><use href="#i-chev"/></svg></button>';
}
function softStreak(){
  var card = $('#acRoot .ac-streak');
  if(!card) return;
  var st = (typeof window.acStreak === 'function') ? window.acStreak() : {days: 0, best: 0};
  var d = st.days || 0, best = st.best || 0;
  var line = d >= 3
    ? 'Серия идёт ' + d + ' ' + plural(d, ['день', 'дня', 'дней']) + '. Пауза ничего не ломает — вернёшься, и счёт пойдёт заново.'
    : 'Серия — просто счётчик дней, а не обязательство. Пропустишь — ничего не сгорит.';
  if(best > 1) line += ' Личный рекорд: ' + best + '.';
  var meta = card.querySelector('.meta span');
  if(meta) meta.textContent = line;
  var mb = card.querySelector('.meta b');
  if(mb) mb.textContent = d ? ('Дней подряд в учёбе: ' + d) : 'Учёба в своём темпе';
  if(!$('#ac2Remind')){
    var row = D.createElement('div');
    row.id = 'ac2Remind';
    row.className = 'ac2-remind';
    row.innerHTML =
      '<div class="m"><b>Напоминать про учёбу</b><span>Не чаще раза в сутки и только на Ленте или в Академии. Выключишь — не напомним совсем.</span></div>' +
      '<label class="ac2-sw"><input type="checkbox" ' + (S.remind ? 'checked' : '') + ' onchange="ac2Remind(this.checked)" aria-label="Напоминать про учёбу"><i></i></label>';
    card.parentNode.insertBefore(row, card.nextSibling);
  }
}
window.ac2Remind = function(on){
  S.remind = !!on; save();
  say(on ? 'Напоминания включены' : 'Напоминания выключены');
};

/* ---------------------------------------------------------------------------
   13. СТРАНИЦА КУРСА: сколько осталось, поиск по урокам курса
   --------------------------------------------------------------------------- */
function courseExtraHtml(ci){
  var c = COURSES()[ci] || {count: 0};
  var idx = (typeof window.acCourseIdx === 'function') ? window.acCourseIdx(ci) : [];
  var doneN = idx.filter(lessonDone).length;
  var left = c.count - doneN;
  var total = 0; idx.forEach(function(i){ total += lessonMins(i); });
  var m = left ? courseMinsLeft(ci) : total;
  var big = m >= 60 ? Math.round(m / 60) : Math.max(0, m);
  var unit = m >= 60 ? plural(big, ['час', 'часа', 'часов']) : plural(big, ['минута', 'минуты', 'минут']);
  return '<div class="ac2-stats">' +
    '<div class="ac2-stat"><b>' + doneN + '</b><span>' + plural(doneN, ['урок пройден', 'урока пройдено', 'уроков пройдено']) + '</span></div>' +
    '<div class="ac2-stat"><b>' + left + '</b><span>' + plural(left, ['урок остался', 'урока осталось', 'уроков осталось']) + '</span></div>' +
    '<div class="ac2-stat"><b>' + big + '</b><span>' + unit + (left ? ' примерно осталось' : ' весь курс') + '</span></div>' +
    '</div>' +
    '<button class="ac2-searchbar" onclick="ac2Search.open(\'\')">' + ico('search') +
      '<span>Найти урок в Академии</span><svg class="i"><use href="#i-chev"/></svg></button>';
}

/* ---------------------------------------------------------------------------
   14. ЧЕСТНОСТЬ: практика без выдуманного куратора
   --------------------------------------------------------------------------- */
function stepPct(){
  var n = lessonItems(curIdx()).length;
  return n ? Math.round(100 / n) : 0;
}
window.acRenderTaskBox = function(){
  var box = D.getElementById('acTaskBox');
  if(!box) return;
  var L = (typeof window.acCur === 'function') ? window.acCur() : null;
  if(!L) return;
  var T = L.task || {};
  var ls = (typeof window.acLS === 'function') ? window.acLS() : {};
  if(ls.task){
    box.innerHTML =
      '<div class="ac2-ref"><div class="h">' + ico('star') + 'Эталонный разбор</div><p>' + esc(T.verdict || 'Сверь свой ответ с материалом урока.') + '</p></div>' +
      '<div class="ac2-mine"><b style="color:var(--text)">Твой ответ:</b>\n' + esc(ls.taskText || '') + '</div>' +
      '<div style="height:12px"></div>' +
      '<button class="btn ghost" onclick="ac2TaskEdit()">' + ico('edit') + ' Переписать ответ</button>' +
      '<p class="ac2-selfcheck">Практика засчитана как самопроверка: ответ сохранён на этом устройстве и сверяется с эталоном выше. Живой проверки куратором пока нет — когда появится, ты увидишь его комментарий здесь.</p>';
    return;
  }
  var chips = (T.chips || []).map(function(c, k){ return (k ? ico('chev') : '') + '<span>' + esc(c) + '</span>'; }).join('');
  box.innerHTML =
    '<p style="font-size:13.5px;line-height:1.55">' + esc(T.intro || 'Примени материал урока к своей задаче — своими словами.') + '</p>' +
    (chips ? '<div class="ac-task-formula">' + chips + '</div>' : '') +
    '<textarea class="ac-task-ta" id="acTaskTa" placeholder="' + esc(T.ph || 'Твой ответ…') + '">' + esc(ls.taskText || '') + '</textarea>' +
    '<div style="height:10px"></div>' +
    '<button class="btn" onclick="acTaskSend()">' + ico('check2') + ' Сохранить ответ и открыть эталон</button>' +
    '<p class="ac2-selfcheck">Это самопроверка: ответ остаётся на твоём устройстве, после сохранения откроется эталонный разбор — сравнишь сам. Никто из кураторов его сейчас не читает, обещать обратное было бы нечестно.</p>';
};
window.acTaskSend = function(){
  var ta = D.getElementById('acTaskTa');
  var v = (ta && ta.value || '').trim();
  if(v.length < 40){ say('Раскрой подробнее — минимум 40 символов'); return; }
  var ls = (typeof window.acLS === 'function') ? window.acLS() : null;
  if(!ls) return;
  var was = !!ls.task;
  ls.taskText = v;
  ls.task = true;
  if(typeof window.acSave === 'function') window.acSave();
  if(!was) say('Ответ сохранён · +' + stepPct() + '% к уроку');
  window.acRenderTaskBox();
  if(typeof window.acRenderProgressBox === 'function') window.acRenderProgressBox();
  if(typeof window.acRenderCertBox === 'function') window.acRenderCertBox();
  if(typeof window.acBadgeSync === 'function') window.acBadgeSync();
  if(typeof window.acAfterCheckpoint === 'function') window.acAfterCheckpoint();
  renderLessonBar();
};
window.ac2TaskEdit = function(){
  var ls = (typeof window.acLS === 'function') ? window.acLS() : null;
  if(!ls) return;
  ls.task = false;
  if(typeof window.acSave === 'function') window.acSave();
  window.acRenderTaskBox();
  if(typeof window.acRenderProgressBox === 'function') window.acRenderProgressBox();
  renderLessonBar();
  window.ac2Go('#acTaskBox');
};

/* Проценты за этап — от реального числа этапов, а не «+20%» намертво. */
function fixProgressBox(){
  var box = D.getElementById('acProgressBox');
  if(!box) return;
  var p = stepPct();
  $$('.ac-check-row .pct', box).forEach(function(el){
    if(el.textContent.indexOf('+') === 0) el.textContent = '+' + p + '%';
  });
}

/* ---------------------------------------------------------------------------
   15. ЧЕСТНОСТЬ: тосты, конспект, ссылки, «урок освоен»
   --------------------------------------------------------------------------- */
(function patchToast(){
  var prev = window.toast;
  if(typeof prev !== 'function') return;
  window.toast = function(t){
    try{
      if(typeof t === 'string' && t.indexOf('+20% к уроку') >= 0 && view() === 'lesson')
        t = t.replace('+20%', '+' + stepPct() + '%');
    }catch(e){}
    return prev.call(this, t);
  };
})();

window.acNotesTxt = function(){
  return offlineTxt(curIdx());
};
window.acNotesDownload = function(){
  var i = curIdx();
  var ci = courseOf(i), c = COURSES()[ci] || {title: 'kurs'};
  var name = 'OKO-' + String(c.title).replace(/\s+/g, '-') + '-урок-' + localNo(i) + '-конспект.txt';
  try{
    var blob = new Blob(['﻿' + offlineTxt(i)], {type: 'text/plain;charset=utf-8'});
    var a = D.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = name;
    D.body.appendChild(a); a.click();
    setTimeout(function(){ try{ URL.revokeObjectURL(a.href); }catch(e){} a.remove(); }, 800);
    say('Конспект сохранён: ' + name);
  }catch(e){
    if(typeof window.acCopyText === 'function') window.acCopyText(offlineTxt(i), 'Скачивание недоступно — конспект скопирован в буфер');
  }
};
/* Подпись сертификата была длиннее строки («Направление «X» · сертификат») и
   в списках обрывалась на «Направлен…». Короче — и читается целиком. */
window.acCertLabel = function(c){
  return 'Направление «' + ((c && c.courseTitle) || 'Академия OKO') + '»';
};
window.acCertShare = function(i){
  var certs = (window.acS && window.acS.certs) || [];
  var c = (typeof i === 'number') ? certs[i] : (typeof window.acCertRec === 'function' ? window.acCertRec() : certs[0]);
  if(!c){ say('Сертификат ещё не выдан'); return; }
  var label = (typeof window.acCertLabel === 'function') ? window.acCertLabel(c) : ('Направление «' + (c.courseTitle || '') + '»');
  var text = 'Официальный сертификат Академии OKO ' + c.no + ' — ' + label +
             ' пройден, тест ' + c.score + '%. Учись со мной в OKO: https://okoteam.top';
  if(navigator.share){ navigator.share({title: 'Сертификат Академии OKO', text: text}).catch(function(){}); }
  else if(typeof window.acCopyText === 'function') window.acCopyText(text, 'Текст сертификата скопирован — вставь в любой чат');
};

/* «Урок освоен»: плашки этапов — по реальным этапам урока (видео выключено). */
(function patchMaster(){
  var prev = window.acLessonMaster;
  if(typeof prev !== 'function') return;
  window.acLessonMaster = function(){
    try{ prev.apply(this, arguments); }catch(e){}
    try{
      var pills = $('#acMaster .ac-master-pills');
      if(!pills) return;
      var names = lessonItems(curIdx()).map(function(x){
        return String(x[0]).replace(/ (просмотрено|пролистаны|сдан.*|зачтена|пройдена)$/i, '');
      });
      pills.innerHTML = names.map(function(t, k){
        return '<span class="ac-master-pill" style="--pd:' + (k * 0.06).toFixed(2) + 's">' + ico('check2') + esc(t) + '</span>';
      }).join('');
    }catch(e){}
  };
})();

/* Мягкие напоминания: выключил — значит выключил.
   Первую проверку ядро успевает поставить в setTimeout до загрузки этого файла,
   поэтому страхуемся ещё и на самом попапе. */
(function patchRemind(){
  var prev = window.acRemindCheck;
  if(typeof prev === 'function'){
    window.acRemindCheck = function(){
      if(!S.remind) return;
      return prev.apply(this, arguments);
    };
  }
  var pop = window.showPopup;
  if(typeof pop === 'function'){
    window.showPopup = function(o){
      try{ if(!S.remind && o && o.title === 'Академия OKO') return; }catch(e){}
      return pop.apply(this, arguments);
    };
  }
})();

/* ---------------------------------------------------------------------------
   16. ЧЕСТНОСТЬ: обсуждение урока и отзывы — локальные, так и подписаны
   --------------------------------------------------------------------------- */
function fixComments(){
  var box = D.getElementById('acdComments');
  if(!box) return;
  var b = box.querySelector('.acd-comments-head b');
  if(b) b.textContent = 'Мои вопросы и мысли по уроку';
  var n = box.querySelector('.acd-comments-head .n');
  if(n){
    var cnt = box.querySelectorAll('.acd-comment').length;
    n.textContent = cnt
      ? cnt + ' ' + plural(cnt, ['запись', 'записи', 'записей']) + ' · хранятся только на этом устройстве'
      : 'Пока пусто · записи хранятся только на этом устройстве';
  }
  var hint = box.querySelector('.acd-comment-actions > span');
  if(hint) hint.textContent = 'Видно только тебе · общий чат курса появится вместе с сервером';
  var ta = box.querySelector('.acd-comment-ta');
  if(ta) ta.setAttribute('placeholder', 'Вопрос автору или мысль по уроку…');
  var empty = box.querySelector('.acd-comment-empty');
  if(empty) empty.textContent = 'Пока пусто. Запиши вопрос, который хочешь задать автору, — не потеряется.';
  var send = box.querySelector('.acd-comment-actions .btn');
  if(send) send.innerHTML = ico('check2') + ' Сохранить';
}
(function patchComments(){
  ['apdCommSend', 'apdCommLike', 'apdCommDel'].forEach(function(k){
    var prev = window[k];
    if(typeof prev !== 'function') return;
    window[k] = function(){
      var origToast = window.toast;
      window.toast = function(t){
        if(t === 'Опубликовано') t = 'Сохранено на этом устройстве';
        return origToast.call(this, t);
      };
      try{ return prev.apply(this, arguments); }
      finally{ window.toast = origToast; setTimeout(fixComments, 0); }
    };
  });
})();

window.apdCourseReviewAdd = function(ci){
  ci = +ci;
  var c = COURSES()[ci];
  if(!c) return;
  if(typeof window.showPopup !== 'function'){ say('Оценка пока недоступна'); return; }
  window.showPopup({
    ico: 'edit', title: 'Отзыв о курсе «' + c.title + '»',
    body: '<div style="text-align:left">' +
      '<p style="font-size:12.5px;color:var(--dim);line-height:1.55;margin-bottom:10px">Публичных отзывов в Академии пока нет — их некуда отправить, сервер отзывов ещё не включён. Твой текст сохранится черновиком на этом устройстве, и когда отправка заработает, ты сможешь опубликовать его в один тап.</p>' +
      '<label style="font-size:11px;font-weight:800;letter-spacing:.08em;text-transform:uppercase;color:var(--dim);display:block;margin-bottom:6px">Оценка</label>' +
      '<select id="ac2RevStars" style="width:100%;background:var(--raised);border:1px solid var(--border);border-radius:9px;color:var(--text);padding:9px 11px;font-size:13px;margin-bottom:10px">' +
        [5, 4, 3, 2, 1].map(function(n){ return '<option value="' + n + '"' + (n === 5 ? ' selected' : '') + '>' + n + ' из 5</option>'; }).join('') +
      '</select>' +
      '<textarea id="ac2RevTxt" placeholder="Что понравилось, что вынес из курса…" style="width:100%;background:var(--raised);border:1px solid var(--border);border-radius:9px;color:var(--text);padding:9px 11px;font-size:13px;min-height:80px;resize:vertical">' +
        esc((S.reviews[c.id] || {}).text || '') + '</textarea></div>',
    actions: [
      {label: 'Сохранить черновик', onclick: function(){
        var t = (D.getElementById('ac2RevTxt') || {}).value || '';
        var s = parseInt((D.getElementById('ac2RevStars') || {}).value, 10) || 5;
        t = t.trim();
        if(t.length < 12){ say('Отзыв слишком короткий'); return; }
        S.reviews[c.id] = {text: t.slice(0, 800), stars: s, ts: Date.now()};
        save();
        say('Черновик отзыва сохранён на этом устройстве');
      }},
      {label: 'Отмена', ghost: true}
    ]
  });
};

/* Карточка курса: отзывы честно подписаны как черновики этого устройства. */
(function patchCourseFull(){
  var prev = window.apdCourseFullOpen;
  if(typeof prev !== 'function') return;
  window.apdCourseFullOpen = function(ci){
    try{ prev.apply(this, arguments); }catch(e){}
    setTimeout(function(){ fixCourseFull(+ci); }, 30);
  };
})();
function fixCourseFull(ci){
  var body = D.getElementById('apdFullBody');
  if(!body) return;
  var c = COURSES()[ci] || {};
  var revBox = body.querySelector('.acd-cp-reviews');
  if(revBox){
    var mine = S.reviews[c.id];
    revBox.innerHTML = mine
      ? '<div class="acd-cp-review"><div class="acd-cp-review-h"><span class="ava">' + ico('edit') + '</span>' +
        '<b>Твой черновик</b><span class="ts">' + new Date(mine.ts).toLocaleDateString('ru-RU') + ' · ' + mine.stars + ' из 5</span></div>' +
        '<p>' + esc(mine.text) + '</p></div>'
      : '<div class="ac2-empty">' + ico('comment') + 'Отзывов пока нет. Их не пишет никто, кроме учеников, — и мы не станем придумывать их за них.</div>';
    var h = revBox.previousElementSibling;
    if(h && h.tagName === 'H2') h.innerHTML = 'Отзывы <span style="font-size:12px;color:var(--dim);font-weight:600">· пока нет</span>';
    var note = D.createElement('p');
    note.className = 'ac2-note';
    note.textContent = 'Отзывы появятся, когда их напишут ученики. Твой текст сохранится черновиком на этом устройстве.';
    revBox.parentNode.insertBefore(note, revBox.nextSibling);
  }
  var addBtn = body.querySelector('.acd-cp-review-add');
  if(addBtn) addBtn.innerHTML = ico('edit') + ' Написать отзыв (черновик)';
  fitAll();
}

/* ---------------------------------------------------------------------------
   17. АДМИН-ПАНЕЛЬ КУРСА: только правда
   --------------------------------------------------------------------------- */
function fixAdmin(){
  var body = D.getElementById('apdFullBody');
  if(!body) return;
  /* «Повторные просмотры» считались случайным числом от номера курса — убираем.
     Остальные цифры — это прохождение владельца, а не «всех учеников»: пока
     сервера нет, других прохождений просто не существует. Подписи честные. */
  $$('.acd-a-card', body).forEach(function(card){
    var lbl = (card.querySelector('.lbl') || {}).textContent || '';
    var val = (card.querySelector('.val') || {}).textContent || '';
    var sub = card.querySelector('.sub');
    if(/Повторные/i.test(lbl)){ card.remove(); return; }
    if(/Рейтинг|Учеников/i.test(lbl) && (val === '—' || val === '0')){
      if(sub) sub.textContent = 'данных пока нет';
    }
    if(sub && /по всем ученикам/i.test(sub.textContent)) sub.textContent = 'по твоему прохождению';
    if(sub && /из \d+ сдавших/i.test(sub.textContent)) sub.textContent = 'по твоим попыткам';
  });
  /* Участники и экспорт: честный пустой стейт вместо пустых списков. */
  var memList = body.querySelector('.acd-mem-list');
  if(memList && !memList.children.length){
    var p = memList.previousElementSibling;
    if(p && p.classList.contains('dim')) p.remove();
    memList.outerHTML = '<div class="ac2-empty">' + ico('users') +
      'Учеников на курсе пока нет. Список появится, когда включим сервер и курс кто-то купит — выдумывать людей мы не станем.</div>';
  }
  /* Кнопка экспорта пустого CSV — не кнопка, а обещание. */
  var pane = body.querySelector('.acd-admin-pane');
  if(pane && /Скачать CSV · 0/.test(pane.textContent || '')){
    pane.innerHTML = '<div class="ac2-empty">' + ico('file') +
      'Экспортировать пока нечего: учеников на курсе нет. Кнопка появится вместе с первыми записями.</div>';
  }
  /* Настройки курса — честно про то, где сохраняется. */
  $$('.acd-set-row .m span', body).forEach(function(el){
    if(/Основная цена/.test(el.textContent)) el.textContent = 'Основная цена (₽). Пока сохраняется только на этом устройстве';
  });
  fitAll();
}
(function patchAdmin(){
  ['apdAdminOpen', 'apdAdminTab'].forEach(function(k){
    var prev = window[k];
    if(typeof prev !== 'function') return;
    window[k] = function(){
      var r;
      try{ r = prev.apply(this, arguments); }catch(e){}
      setTimeout(fixAdmin, 20);
      return r;
    };
  });
  var prevSet = window.apdSetSet;
  if(typeof prevSet === 'function'){
    window.apdSetSet = function(ci, k, v){
      var origToast = window.toast;
      window.toast = function(t){
        if(typeof t === 'string' && t.indexOf('Сохранено: ') === 0) t = 'Сохранено на этом устройстве';
        return origToast.call(this, t);
      };
      try{ return prevSet.apply(this, arguments); }
      finally{ window.toast = origToast; }
    };
  }
})();

/* ---------------------------------------------------------------------------
   18. КАТАЛОГ «ВСЕ КУРСЫ»: без сортировок по несуществующим рейтингам
   --------------------------------------------------------------------------- */
window.apdCatalogOpen = function(){
  Q.q = ''; Q.scope = 'courses';
  fullOpen('Все курсы Академии',
    COURSES().length + ' ' + plural(COURSES().length, ['направление', 'направления', 'направлений']) + ' · поиск по урокам и материалам',
    searchBody());
  var r = D.getElementById('ac2Res');
  if(r) r.innerHTML = searchResults();
};

/* Полноэкранные слои academy-plus (карточка курса, каталог, админ-панель) живут
   на z-index 920, а модальный попап — на 70: диалог «Написать отзыв» или
   «Возврат средств» открывался ПОД слоем и выглядел как «кнопка не работает».
   Пока такой слой открыт, помечаем body — попап поднимается над ним. */
(function patchAcdFull(){
  /* apdFullClose чистит содержимое слоя отложенно (через 260 мс, под анимацию).
     Если за это время слой открыли заново — новая разметка стиралась, и человек
     видел пустой экран. Подстраховываем содержимое. */
  function guardContent(){
    var f = D.getElementById('apdFull');
    if(!f) return;
    var html = f.innerHTML;
    setTimeout(function(){
      var g = D.getElementById('apdFull');
      if(g && g.classList.contains('open') && !g.innerHTML.trim()) g.innerHTML = html;
    }, 320);
  }
  ['apdCourseFullOpen', 'apdAdminOpen', 'apdCatalogOpen'].forEach(function(k){
    var prev = window[k];
    if(typeof prev !== 'function') return;
    window[k] = function(){
      var r;
      try{ r = prev.apply(this, arguments); }catch(e){}
      D.body.classList.add('ac2-over');
      guardContent();
      return r;
    };
  });
  var prevClose = window.apdFullClose;
  if(typeof prevClose === 'function'){
    window.apdFullClose = function(){
      try{ prevClose.apply(this, arguments); }catch(e){}
      var mine = D.getElementById('ac2Full');
      if(!mine || !mine.classList.contains('open')) D.body.classList.remove('ac2-over');
    };
  }
})();

/* Заметки к уроку: закрываются системной «назад» и Escape. */
(function patchNotes(){
  var prev = window.apdNotesOpen;
  if(typeof prev !== 'function') return;
  window.apdNotesOpen = function(){
    try{ prev.apply(this, arguments); }catch(e){}
    try{ if(typeof window.nvPush === 'function') window.nvPush('ac2:notes', function(){ if(window.apdNotesClose) window.apdNotesClose(); }); }catch(e){}
  };
  var prevC = window.apdNotesClose;
  if(typeof prevC === 'function'){
    window.apdNotesClose = function(){
      try{ prevC.apply(this, arguments); }catch(e){}
      try{ if(typeof window.nvPop === 'function') window.nvPop('ac2:notes'); }catch(e){}
    };
  }
  D.addEventListener('keydown', function(e){
    if(e.key !== 'Escape') return;
    var p = D.getElementById('acdNotesPanel');
    if(p && p.classList.contains('open')){ e.stopPropagation(); if(window.apdNotesClose) window.apdNotesClose(); }
  });
})();

/* ---------------------------------------------------------------------------
   19. ГЛАВНЫЙ ХУК РЕНДЕРА
   --------------------------------------------------------------------------- */
function enhanceHome(){
  var root = D.getElementById('acRoot');
  if(!root) return;
  var hero = root.querySelector('.ac-hero');
  if(hero && !root.querySelector('#ac2SearchBar')){
    var sb = D.createElement('button');
    sb.id = 'ac2SearchBar';
    sb.className = 'ac2-searchbar';
    sb.innerHTML = ico('search') + '<span>Поиск по курсам, урокам и материалам</span>' + ico('chev');
    sb.onclick = function(){ window.ac2Search.open(''); };
    hero.parentNode.insertBefore(sb, hero.nextSibling);
  }
  softStreak();
  var remind = D.getElementById('ac2Remind');
  if(remind && !root.querySelector('#ac2Stats')){
    var stats = D.createElement('div');
    stats.innerHTML = homeStatsHtml();
    if(stats.firstElementChild) remind.parentNode.insertBefore(stats.firstElementChild, remind.nextSibling);
  }
  if(!root.querySelector('#ac2LibRow')){
    /* «Мои сертификаты» — последняя секция; библиотеку ставим перед ней */
    var hs = $$('#acRoot .section-h').filter(function(h){ return /сертификат/i.test(h.textContent); });
    var lib = D.createElement('div');
    lib.id = 'ac2LibRow';
    lib.innerHTML = homeLibHtml();
    if(hs.length) hs[0].parentNode.insertBefore(lib, hs[0]);
    else root.appendChild(lib);
  }
}
function enhanceCourse(){
  var root = D.getElementById('acRoot');
  if(!root) return;
  /* «Практика — проверка куратором» обещала живого проверяющего, которого нет */
  $$('#acRoot .ac-inside-cell').forEach(function(cell){
    var b = cell.querySelector('b'), s = cell.querySelectorAll('span');
    if(b && /Практика/i.test(b.textContent) && s.length)
      s[s.length - 1].textContent = 'самопроверка с эталоном';
  });
  if(root.querySelector('#ac2CourseExtra')) return;
  var inside = root.querySelector('.ac-inside');
  var wrap = D.createElement('div');
  wrap.id = 'ac2CourseExtra';
  wrap.innerHTML = courseExtraHtml(curCourse());
  if(inside) inside.parentNode.insertBefore(wrap, inside);
  else root.appendChild(wrap);
}
function enhanceLesson(){
  var root = D.getElementById('acRoot');
  if(!root) return;
  var i = curIdx();
  if(!root.querySelector('#ac2Bar')){
    var anchor = D.getElementById('acdStepRail') || root.querySelector('.ac-back');
    var wrap = D.createElement('div');
    wrap.innerHTML = lessonBarHtml();
    var node = wrap.firstElementChild;
    if(node){
      if(anchor) anchor.insertAdjacentElement('afterend', node);
      else root.insertBefore(node, root.firstChild);
    }
  }
  if(!root.querySelector('#ac2Nav')){
    var nav = D.createElement('div');
    nav.id = 'ac2Nav';
    nav.innerHTML = lessonNavHtml();
    root.appendChild(nav);
  }
  fixProgressBox();
  fixComments();
  timeStart(i);
  /* пройденный урок автоматически доступен офлайн */
  if(lessonDone(i) && !S.offline[i]) offlineSave(i, true);
}

(function hookRender(){
  function install(){
    if(typeof window.acRender !== 'function'){ setTimeout(install, 120); return; }
    if(window.__ac2Hooked) return;
    window.__ac2Hooked = true;
    var prev = window.acRender;
    window.acRender = function(){
      try{ prev.apply(this, arguments); }catch(e){}
      try{
        var v = view();
        if(v !== 'lesson') timeStop();   // ушли из урока — досчитали время
        if(v === 'home') enhanceHome();
        else if(v === 'course') enhanceCourse();
        else if(v === 'lesson') enhanceLesson();
        fitAll();
      }catch(e){}
    };
    /* проценты этапа и оглавление обновляются вместе с чек-пойнтами */
    ['acRenderProgressBox', 'acRenderTestBox', 'acRenderGameBox', 'acRenderCertBox'].forEach(function(k){
      var p = window[k];
      if(typeof p !== 'function') return;
      window[k] = function(){
        try{ p.apply(this, arguments); }catch(e){}
        try{ fixProgressBox(); if(view() === 'lesson') renderLessonBar(); }catch(e){}
      };
    });
    var pAfter = window.acAfterCheckpoint;
    if(typeof pAfter === 'function'){
      window.acAfterCheckpoint = function(){
        try{ pAfter.apply(this, arguments); }catch(e){}
        try{
          var i = curIdx();
          if(lessonDone(i) && !S.offline[i]) offlineSave(i, true);
          renderLessonBar();
        }catch(e){}
      };
    }
    /* ушли с вкладки Академии — время урока перестаём считать */
    if(typeof window.showTab === 'function'){
      var pTab = window.showTab;
      window.showTab = function(t){
        if(t !== 'academy') timeStop();
        return pTab.apply(this, arguments);
      };
    }
    /* если Академия уже открыта — перерисуем сразу */
    var scr = D.getElementById('screen-academy');
    if(scr && scr.classList.contains('active')) window.acRender();
  }
  if(D.readyState === 'loading') D.addEventListener('DOMContentLoaded', function(){ setTimeout(install, 60); });
  else setTimeout(install, 60);
})();

window.addEventListener('resize', function(){ clearTimeout(window.__ac2FitT); window.__ac2FitT = setTimeout(fitAll, 160); });

})();
