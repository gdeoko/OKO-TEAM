/* ============================================================================
   OKO · oko-mini2.js — ЧЕТЫРЕ РАЗДЕЛА «ГОТОВО К ЗАПУСКУ»
   ----------------------------------------------------------------------------
   Задача Даниэля 09.08: довести до состояния запуска
     1) ИГРЫ И РУЛЕТКА ОКО   — понятные правила, честная таблица лидеров,
                               достижения по реальным действиям, честный бонус;
     2) ПАРТНЁРКА            — ссылка и QR, промо, калькулятор с открытой
                               формулой, условия, история начислений и выплат;
     3) РЕКЛАМА              — кабинет без вранья: черновик кампании хранится
                               локально, ничего не «крутится», деньги не
                               списываются до появления бэкенда;
     4) ДОКУМЕНТЫ            — одинаковая кнопка «назад», ничего не обрезано,
                               длинные ссылки и реквизиты переносятся;
     5) TON ПОДАРКИ          — кошелёк с нуля, честная подпись про TON Connect,
                               никакого выдуманного адреса и никаких «отправлено».

   ПРИНЦИПЫ (правила проекта, действуют навсегда):
     • Ноль демо-данных. Пусто — значит empty-state, а не выдуманные люди.
     • Никаких ложных подтверждений. Кнопка либо делает дело, либо честно
       говорит, что произойдёт после запуска бэкенда.
     • Только SVG из общего спрайта index.html. Никаких эмодзи.
     • Безопасные зоны только через var(--oko-safe-*).
     • Текст не обрезается и не рвётся посреди слова.

   Слой самодостаточный: грузится ПОСЛЕ ядра и остальных слоёв, стили кладёт
   одним <style> в <head>, ядро не переписывает — только подменяет глобальные
   функции и точечно перерисовывает свои блоки.
   ============================================================================ */
(function okoMini2(){
'use strict';

if(window.__okoMini2Ready) return;
window.__okoMini2Ready = true;

/* ===========================================================================
   0. УТИЛИТЫ
   =========================================================================== */

function q(sel, root){ return (root || document).querySelector(sel); }
function qa(sel, root){ return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }

/* иконка из общего спрайта index.html (эмодзи в интерфейсе запрещены) */
function ic(name, cls){ return '<svg class="i ' + (cls || '') + '" aria-hidden="true"><use href="#i-' + name + '"/></svg>'; }

function E(t){
  return String(t == null ? '' : t).replace(/[&<>"']/g, function(c){
    return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];
  });
}

/* число с неразрывными тонкими пробелами — чтобы «10 780 ₽» не рвалось */
function num(n){
  n = Math.round(+n || 0);
  return n.toLocaleString('ru-RU').replace(/,/g, ' ').replace(/ /g, ' ');
}
/* неразрывный узкий пробел перед знаком рубля: «1 000 ₽» не разъезжается */
function rub(n){ return num(n) + ' ₽'; }

function say(m){ try{ if(typeof toast === 'function') toast(m); }catch(e){} }

var LSP = 'oko-m2-';
function load(k, d){
  try{ var v = JSON.parse(localStorage.getItem(LSP + k)); return v == null ? d : v; }
  catch(e){ return d; }
}
function save(k, v){ try{ localStorage.setItem(LSP + k, JSON.stringify(v)); }catch(e){} }

/* безопасное число: NaN / Infinity никогда не должны доехать до экрана */
function fin(n, d){ n = +n; return (isFinite(n) && !isNaN(n)) ? n : (d || 0); }

function plural(n, one, few, many){
  var a = Math.abs(n) % 100, b = a % 10;
  if(a > 10 && a < 20) return many;
  if(b === 1) return one;
  if(b > 1 && b < 5) return few;
  return many;
}

function debounce(fn, ms){
  var t = 0;
  return function(){ clearTimeout(t); t = setTimeout(fn, ms || 120); };
}

/* Пишем разметку только когда она реально изменилась. Иначе MutationObserver,
   который следит за экраном, ловил бы собственную же запись и слой уходил в
   бесконечную перерисовку. */
function setHtml(el, html){
  if(!el) return false;
  if(el.__m2html === html) return false;
  el.__m2html = html;
  el.innerHTML = html;
  return true;
}
/* то же для точечных стилевых правок */
function setStyle(el, prop, val){
  if(!el) return;
  if(el.style[prop] === val) return;
  el.style[prop] = val;
}

/* Наблюдаем за экраном: модули ядра перерисовывают его на каждом заходе,
   поэтому наши правки надо применять заново. Все патчи идемпотентны —
   помечают узел data-m2 и второй раз ничего не делают. */
function watch(sel, apply){
  var run = debounce(function(){
    var host = q(sel);
    if(!host) return;
    try{ apply(host); }catch(e){ /* один сломанный блок не должен ронять слой */ }
  }, 90);
  function attach(){
    var host = q(sel);
    if(!host){ setTimeout(attach, 400); return; }
    try{ apply(host); }catch(e){}
    new MutationObserver(run).observe(host, {childList:true, subtree:true});
  }
  attach();
  return run;
}

/* хук на смену вкладки: ядро оборачивает showTab много раз, берём верхнюю */
var tabHooks = [];
function onTab(fn){ tabHooks.push(fn); }
(function hookShowTab(){
  var tries = 0;
  function tick(){
    if(typeof window.showTab !== 'function'){
      if(++tries < 80) return setTimeout(tick, 120);
      return;
    }
    var prev = window.showTab;
    /* Повторы через 80 и 420 мс нужны потому, что часть содержимого экрана
       дорисовывают другие слои уже после showTab. Но если человек листает
       меню быстро, догоняющие проходы от предыдущей вкладки бессмысленны —
       они считают то, чего уже нет на экране. Отменяем их при новом переходе. */
    var догон = [];
    window.showTab = function(t){
      var r = prev.apply(this, arguments);
      догон.forEach(clearTimeout);
      догон.length = 0;
      tabHooks.forEach(function(f){
        try{ f(t); }catch(e){}
        догон.push(setTimeout(function(){ try{ f(t); }catch(e){} }, 80));
        догон.push(setTimeout(function(){ try{ f(t); }catch(e){} }, 420));
      });
      return r;
    };
    window.showTab.__m2 = true;
  }
  tick();
})();

/* ===========================================================================
   1. СТИЛИ (одним инлайновым <style>, обе темы, брендовые токены)
   =========================================================================== */

var CSS = [
/* --- общие карточки слоя --- */
'.m2-card{',
'  background:var(--surface); border:1px solid var(--border); border-radius:var(--r-lg);',
'  padding:14px; margin-top:12px; overflow:hidden;',
'}',
'.m2-card + .m2-card{margin-top:10px}',
'.m2-h{',
'  display:flex; align-items:center; gap:9px; margin-bottom:8px;',
'  font-family:var(--font-display); font-size:19px; letter-spacing:.05em;',
'  line-height:1.1; color:var(--text); text-transform:uppercase;',
'}',
'.m2-h > svg.i{width:18px;height:18px;flex:0 0 auto;color:var(--accent)}',
'.m2-h > span{min-width:0; overflow-wrap:anywhere; hyphens:none}',
'.m2-sub{font-size:12.5px;line-height:1.5;color:var(--dim);overflow-wrap:break-word;hyphens:none}',
'.m2-sub b{color:var(--text);font-weight:700}',
'.m2-note{',
'  display:flex; gap:9px; align-items:flex-start; margin-top:10px; padding:10px 12px;',
'  border-radius:var(--r-md); background:var(--raised); border:1px solid var(--border);',
'  font-size:12px; line-height:1.55; color:var(--dim);',
'}',
'.m2-note > svg.i{width:15px;height:15px;flex:0 0 auto;margin-top:1px;color:var(--accent)}',
'.m2-note p{min-width:0;overflow-wrap:break-word}',
'.m2-note b{color:var(--text)}',

/* --- честное пустое состояние --- */
'.m2-empty{',
'  display:flex; flex-direction:column; align-items:center; text-align:center;',
'  gap:7px; padding:24px 16px;',
'}',
'.m2-empty-ic{',
'  width:52px;height:52px;border-radius:50%;display:flex;align-items:center;justify-content:center;',
'  background:var(--lime-dim); color:var(--accent); margin-bottom:2px;',
'}',
'.m2-empty-ic svg.i{width:24px;height:24px}',
'.m2-empty b{font-size:15px;font-weight:800;color:var(--text);line-height:1.3;overflow-wrap:break-word}',
'.m2-empty span{font-size:12.5px;line-height:1.55;color:var(--dim);max-width:34em;overflow-wrap:break-word}',

/* --- список правил / шагов --- */
'.m2-steps{display:flex;flex-direction:column;gap:9px;margin-top:4px;counter-reset:m2s}',
'.m2-step{display:flex;gap:10px;align-items:flex-start;min-width:0}',
'.m2-step-n{',
'  counter-increment:m2s; flex:0 0 auto; width:22px;height:22px;border-radius:7px;',
'  background:var(--lime-dim); color:var(--accent); font-size:11px; font-weight:800;',
'  display:flex;align-items:center;justify-content:center; margin-top:1px;',
'}',
'.m2-step-n::before{content:counter(m2s)}',
'.m2-step-b{min-width:0;flex:1 1 auto}',
'.m2-step-b b{display:block;font-size:13px;font-weight:700;color:var(--text);line-height:1.35;overflow-wrap:break-word}',
'.m2-step-b span{display:block;font-size:12px;line-height:1.5;color:var(--dim);margin-top:2px;overflow-wrap:break-word}',

/* --- строки «параметр — значение» --- */
'.m2-rows{display:flex;flex-direction:column;gap:1px;margin-top:8px;border-radius:var(--r-md);overflow:hidden}',
'.m2-row{',
'  display:flex; align-items:baseline; gap:10px; justify-content:space-between;',
'  padding:9px 11px; background:var(--raised); min-width:0;',
/* значение не рвём посреди числа: не влезло рядом с подписью — уходит
   целиком на следующую строку. «60 000 ₽» не станет «60 / 000 ₽». */
'  flex-wrap:wrap;',
'}',
'.m2-row > span{font-size:12.5px;line-height:1.45;color:var(--dim);min-width:0;overflow-wrap:break-word}',
'.m2-row > b{font-size:13px;font-weight:800;color:var(--text);flex:0 0 auto;',
'  margin-left:auto;text-align:right;white-space:nowrap;hyphens:none}',
'.m2-row.total{background:var(--lime-dim)}',
'.m2-row.total > span{color:var(--text);font-weight:700}',
'.m2-row.total > b{color:var(--accent);font-size:15px}',

/* --- кнопки слоя: подпись всегда влезает --- */
'.m2-btn{',
'  -webkit-appearance:none; appearance:none; box-sizing:border-box;',
'  display:inline-flex; align-items:center; justify-content:center; gap:7px;',
'  min-height:44px; padding:10px 14px; width:100%;',
'  border-radius:var(--r-md); border:1px solid var(--accent);',
'  background:var(--accent); color:#0a0a0a;',
'  font-family:var(--font-body); font-size:13.5px; font-weight:800; line-height:1.25;',
'  text-align:center; white-space:normal; overflow-wrap:break-word; hyphens:none;',
'  cursor:pointer; transition:filter .16s, transform .1s;',
'}',
'.m2-btn:active{transform:scale(.985)}',
'.m2-btn:hover{filter:brightness(1.06)}',
'.m2-btn > svg.i{width:16px;height:16px;flex:0 0 auto}',
'.m2-btn.ghost{background:transparent;color:var(--accent)}',
'.m2-btn.mute{background:var(--raised);border-color:var(--border);color:var(--text)}',
'.m2-btn[disabled],.m2-btn.off{opacity:.45;pointer-events:none}',
'.m2-btn-row{display:flex;gap:8px;margin-top:10px;flex-wrap:wrap}',
'.m2-btn-row > .m2-btn{flex:1 1 150px;width:auto}',

/* --- чипы-переключатели --- */
'.m2-chips{display:flex;flex-wrap:wrap;gap:7px;margin:8px 0 2px}',
'.m2-chip{',
'  -webkit-appearance:none;appearance:none;box-sizing:border-box;',
'  padding:7px 12px; border-radius:99px; border:1px solid var(--border);',
'  background:var(--raised); color:var(--dim);',
'  font-family:var(--font-body); font-size:12px; font-weight:700; line-height:1.2;',
'  white-space:normal; overflow-wrap:break-word; cursor:pointer; max-width:100%;',
'}',
'.m2-chip.on{background:var(--lime-dim);border-color:var(--accent);color:var(--accent)}',

/* --- поля ввода --- */
'.m2-field{display:block;margin-top:10px;min-width:0}',
'.m2-field > span{display:block;font-size:11.5px;font-weight:700;letter-spacing:.05em;',
'  text-transform:uppercase;color:var(--dim);margin-bottom:5px}',
'.m2-field input,.m2-field textarea,.m2-field select{',
'  -webkit-appearance:none; appearance:none; box-sizing:border-box; width:100%;',
'  padding:11px 12px; border-radius:var(--r-md);',
'  border:1px solid var(--border); background:var(--raised); color:var(--text);',
'  font-family:var(--font-body); font-size:14px; line-height:1.4;',
'}',
'.m2-field textarea{min-height:88px;resize:vertical}',
'.m2-field input:focus,.m2-field textarea:focus{outline:none;border-color:var(--accent)}',
'.m2-err{display:block;font-size:11.5px;color:var(--danger);margin-top:5px;line-height:1.4}',

/* --- технические строки: ссылки, адреса, ИНН --- */
'.m2-mono{',
'  font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;',
'  font-size:12px; line-height:1.55; color:var(--text);',
'  overflow-wrap:anywhere; word-break:break-all;',
'}',

/* --- бейджи статусов --- */
'.m2-badge{',
'  display:inline-flex;align-items:center;gap:4px;',
'  font-size:10px;font-weight:800;letter-spacing:.05em;text-transform:uppercase;',
'  padding:3px 8px;border-radius:99px;background:var(--raised);color:var(--dim);',
'  border:1px solid var(--border); white-space:nowrap;',
'}',
'.m2-badge.ok{background:var(--lime-dim);color:var(--accent);border-color:transparent}',
'.m2-badge.wait{color:#f0b429;border-color:rgba(240,180,41,.35);background:rgba(240,180,41,.10)}',
'.m2-badge.no{color:var(--danger);border-color:rgba(255,77,77,.35);background:rgba(255,77,77,.10)}',

/* --- список записей (заявки, черновики) --- */
'.m2-list{display:flex;flex-direction:column;gap:8px;margin-top:10px}',
'.m2-item{',
'  display:flex;gap:10px;align-items:flex-start;justify-content:space-between;',
'  padding:11px 12px;border-radius:var(--r-md);',
'  background:var(--raised);border:1px solid var(--border);min-width:0;',
'}',
'.m2-item-b{min-width:0;flex:1 1 auto}',
'.m2-item-b > b{display:block;font-size:13.5px;font-weight:700;color:var(--text);line-height:1.35;overflow-wrap:break-word;hyphens:none}',
'.m2-item-m{display:flex;flex-wrap:wrap;gap:6px;align-items:center;margin-top:5px}',
'.m2-item-m > small{font-size:11px;color:var(--dim);line-height:1.4;overflow-wrap:break-word}',
'.m2-item-x{flex:0 0 auto;display:flex;flex-direction:column;align-items:flex-end;gap:6px}',
'.m2-item-sum{font-size:13.5px;font-weight:800;color:var(--text);white-space:nowrap}',

/* --- таблица лидеров (общий вид для игр и партнёрки) --- */
'.m2-lb-head{',
'  display:flex;align-items:center;justify-content:space-between;gap:10px;',
'  padding:10px 2px 8px;min-width:0;',
'}',
'.m2-lb-head > span{display:flex;align-items:center;gap:7px;font-size:12.5px;font-weight:800;',
'  color:var(--text);min-width:0;overflow-wrap:break-word}',
'.m2-lb-head > span > svg.i{width:15px;height:15px;flex:0 0 auto;color:var(--accent)}',
'.m2-lb-head > small{font-size:11px;color:var(--dim);white-space:nowrap;flex:0 0 auto}',
'.m2-lb-solo{',
'  display:flex;gap:10px;align-items:center;padding:11px 12px;border-radius:var(--r-md);',
'  background:var(--lime-dim);border:1px solid var(--accent);min-width:0;',
'}',
'.m2-lb-solo .ava{width:34px;height:34px;font-size:14px}',
'.m2-lb-solo-b{min-width:0;flex:1 1 auto}',
'.m2-lb-solo-b > b{display:block;font-size:13.5px;font-weight:800;color:var(--text);',
'  line-height:1.3;overflow-wrap:break-word;hyphens:none}',
'.m2-lb-solo-b > small{display:block;font-size:11px;color:var(--dim);margin-top:2px}',
'.m2-lb-solo-s{flex:0 0 auto;font-size:14px;font-weight:800;color:var(--accent);white-space:nowrap}',

/* --- калькулятор --- */
'.m2-calc-out{margin-top:10px}',
'.m2-calc-stepper{display:flex;align-items:center;gap:8px;flex:0 0 auto}',
'.m2-calc-stepper button{',
'  width:34px;height:34px;border-radius:10px;border:1px solid var(--border);',
'  background:var(--raised);color:var(--text);font-size:18px;font-weight:700;line-height:1;',
'  display:flex;align-items:center;justify-content:center;flex:0 0 auto;cursor:pointer;',
'}',
'.m2-calc-stepper .v{min-width:44px;text-align:center;font-size:16px;font-weight:800;color:var(--text)}',
'.m2-calc-line{display:flex;align-items:center;gap:12px;margin-top:10px;flex-wrap:wrap}',
'.m2-calc-line > .m2-calc-lbl{flex:1 1 140px;min-width:0;font-size:12.5px;color:var(--dim);line-height:1.4}',
'.m2-range{',
'  -webkit-appearance:none;appearance:none;width:100%;height:4px;border-radius:99px;',
'  background:var(--border);outline:none;margin-top:8px;',
'}',
'.m2-range::-webkit-slider-thumb{-webkit-appearance:none;width:20px;height:20px;border-radius:50%;',
'  background:var(--accent);border:3px solid var(--bg);cursor:pointer}',
'.m2-range::-moz-range-thumb{width:20px;height:20px;border-radius:50%;background:var(--accent);',
'  border:3px solid var(--bg);cursor:pointer}',

/* --- реф-ссылка и QR --- */
'.m2-link-box{display:flex;gap:8px;align-items:stretch;margin-top:8px;flex-wrap:wrap}',
'.m2-link-val{',
'  flex:1 1 190px;min-width:0;padding:10px 12px;border-radius:var(--r-md);',
'  background:var(--raised);border:1px solid var(--border);',
'  font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;font-size:12px;',
'  line-height:1.5;color:var(--text);overflow-wrap:anywhere;word-break:break-all;',
'}',
'.m2-link-box .m2-btn{flex:0 1 auto;width:auto;min-width:118px}',
'.m2-qr{display:flex;justify-content:center;padding:14px 0 4px}',
'.m2-qr-in{background:#fff;border-radius:16px;padding:12px;line-height:0}',
'.m2-qr-in svg{width:180px;height:180px;max-width:60vw;display:block;color:#0a0a0a}',

/* --- сетка мелких показателей --- */
/* 104px — три коротких подписи в ряд на 390px помещаются целиком;
   у сводки рекламного кабинета подписи длиннее, ей задан свой размер */
'.m2-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(104px,1fr));gap:8px;margin-top:10px}',
'.m2-cell{',
'  padding:10px 8px;border-radius:var(--r-md);background:var(--raised);',
'  border:1px solid var(--border);text-align:center;min-width:0;',
'}',
'.m2-cell b{display:block;font-size:17px;font-weight:800;color:var(--text);line-height:1.15;',
'  overflow-wrap:anywhere}',
'.m2-cell span{display:block;font-size:10.5px;font-weight:700;letter-spacing:.04em;',
'  text-transform:uppercase;color:var(--dim);margin-top:3px;line-height:1.3;',
/* подпись переносится только по пробелу: «ЧЕРНОВИ|КОВ» — недопустимо */
'  overflow-wrap:normal;word-break:keep-all;hyphens:none}',
'.m2-cell.hi b{color:var(--accent)}',

/* --- документы: реквизиты, длинные ссылки --- */
'#legalView .lg-req, #legalView .lg-hub-op{overflow-wrap:anywhere}',
'#legalView .lg-doc a, #legalView .lg-req, #legalView .lg-hub-op{word-break:normal}',
'#legalView .lg-doc p, #legalView .lg-doc li, #legalView .lg-doc h1, #legalView .lg-doc h2{',
'  overflow-wrap:break-word; hyphens:none;',
'}',
'#legalView .lg-card-t, #legalView .lg-card-s{',
'  white-space:normal; overflow:visible; text-overflow:clip;',
'  display:block; -webkit-line-clamp:none; hyphens:none;',
/* «Пользовательско|е» и «конфиденциальн|ости» — перенос посреди слова.
   Рвём только по пробелу, а место под длинные слова даёт колонка ниже. */
'  overflow-wrap:normal; word-break:keep-all;',
'}',
'#legalView .lg-card{overflow:visible}',
/* на телефоне карточки документов в одну колонку: «конфиденциальности»
   в две колонки не помещается ни при каком кегле */
'@media (max-width:460px){ #legalView .lg-hub-grid{grid-template-columns:1fr !important} }',
'#legalView .sv-head > b{min-width:0;overflow-wrap:break-word;hyphens:none}',
/* «к списку» — эту работу делает единая круглая кнопка «назад» из oko-back.js */
'#legalView .lg-back{display:none !important}',

/* --- TON: честная шапка кошелька --- */
'.m2-ton-conn{',
'  display:flex;gap:10px;align-items:center;justify-content:center;flex-wrap:wrap;',
'  margin:10px 0 2px;padding:10px 12px;border-radius:99px;',
'  background:var(--raised);border:1px dashed var(--border);',
'  font-size:12px;font-weight:700;color:var(--dim);line-height:1.4;text-align:center;',
'}',
'.m2-ton-conn svg.i{width:15px;height:15px;flex:0 0 auto;color:var(--accent)}',
/* чип «черновики» в шапке рекламы: одной строкой, слово не рвём */
'#adsLive{white-space:nowrap !important;font-size:10px;letter-spacing:.03em;',
'  display:inline-flex;align-items:center;gap:5px;max-width:none}',
'#adsLive svg.i{width:12px;height:12px;flex:0 0 auto}',
/* подпись «TON Connect не подключён» вместо выдуманного адреса — длиннее
   исходной строки, поэтому разрешаем перенос и снимаем моноширинность */
'.vs-ton-addr.m2-ton-addr-off{',
'  white-space:normal !important; overflow:visible !important; text-overflow:clip !important;',
'  max-width:100% !important; line-height:1.35 !important; text-align:center;',
'  font-family:var(--font-body) !important; letter-spacing:.01em !important;',
'  overflow-wrap:break-word; word-break:normal;',
'}',

/* ===== находки пробника: подписи, которые не влезали ===== */
/* Область правки — четыре раздела и их шторки. Правило одно и то же:
   текст не обрезаем, а переносим; кнопка растёт в высоту, а не режет слово. */
'#screen-games .btn, #screen-partner .btn, #screen-ads .btn, #screen-ton .btn,',
'.sheet[id^="sheet-pp-"] .btn, .sheet[id^="sheet-ads-"] .btn,',
'.sheet[id^="sheet-vs-"] .btn, .sheet[id^="sheet-gm"] .btn{',
'  white-space:normal; overflow:visible; text-overflow:clip;',
'  height:auto; min-height:44px; line-height:1.25;',
'  overflow-wrap:break-word; word-break:normal; hyphens:none;',
/* «Скопировать» и «Отмена» вылезали на 3 px: боковым полям хватает 12 px,
   и одно слово перестаёт упираться в край */
'  padding-left:12px; padding-right:12px;',
'}',
/* мелкие подписи под цифрами в шапке партнёрки («регистрации», «к выплате») */
'#screen-partner .pp-microstat .l, #screen-partner .pp-hero .l{',
'  white-space:normal; overflow:visible; text-overflow:clip; line-height:1.25;',
/* «регистрации» рвалось как «регистра|ции»: переносим только по пробелу,
   а чтобы слово влезло целиком — чуть меньше кегль */
'  overflow-wrap:normal; word-break:keep-all; hyphens:none; font-size:9.5px;',
'}',
/* быстрые кнопки рекламного кабинета («Boost поста») */
'#screen-ads .ads-quick-b span, #screen-ads .ads-quick-b em{',
'  white-space:normal; overflow:visible; text-overflow:clip; line-height:1.25;',
'}',
/* карточка подарка TON: «ЛЕГЕНДАРНЫЙ» шире карточки на 3 px */
'#screen-ton .vs-gcard .vs-rar-chip, .sheet[id^="sheet-vs-"] .vs-rar-chip{',
'  font-size:7.6px; letter-spacing:.2px; padding:2px 5px;',
'  max-width:calc(100% - 8px); white-space:nowrap;',
'}',
/* Кнопка вишлиста стояла right:6px при width:26px и на узкой карточке
   вылезала за её внутреннее поле — карточка получала горизонтальную
   прокрутку в 3 px. Сдвигаем внутрь и чуть уменьшаем. */
'#screen-ton .vs-gcard .vs-wish-tog, .sheet .vs-gcard .vs-wish-tog{',
'  right:9px; top:8px; width:22px; height:22px;',
'}',
'#screen-ton .vs-gcard .vs-wish-tog svg{width:12px;height:12px}',
'#screen-ton .vs-gcard{overflow:visible}',
/* длинные названия достижений на 360 px обрезались по правому краю */
'#screen-games .gm-ach b, #screen-games .gm-ach small,',
'#screen-games .gm-ach-grid b, #screen-games .gm-ach-grid small{',
'  white-space:normal !important; overflow:visible !important;',
'  text-overflow:clip !important; line-height:1.25;',
'  overflow-wrap:break-word; word-break:normal; hyphens:none;',
'}',
/* реф-ссылка в шторке QR — техническая строка, перенос по символам разрешён */
'.pp-qr-url{overflow-wrap:anywhere}',

/* --- ничего не заезжает под шапку и нижний бар --- */
'#screen-games .pad, #screen-partner .pad, #screen-ads .pad, #screen-ton .pad{',
'  padding-bottom:calc(96px + var(--oko-safe-bottom,0px));',
'}',
'#legalView .sv-body{padding-bottom:calc(40px + var(--oko-safe-bottom,0px))}',

/* --- нигде не рвём слова посреди --- */
'#screen-games, #screen-partner, #screen-ads, #screen-ton, #legalView{hyphens:none}',
'#screen-games .gm-mpill b, #screen-games .gm-mpill small,',
'#screen-games .gm-spin, #screen-ads .m2-btn, #screen-partner .m2-btn{',
'  overflow-wrap:break-word; word-break:normal;',
'}',
/* технические строки, которым перенос по символам разрешён явно */
'.oko-breakable, .m2-mono, .m2-link-val{word-break:break-all;overflow-wrap:anywhere}',

/* --- узкий экран 360: подписи в кнопках не должны выпирать --- */
'@media (max-width:379px){',
'  .m2-btn{font-size:12.5px;padding:10px 11px;gap:6px}',
'  .m2-h{font-size:17px}',
'  .m2-cell b{font-size:15px}',
'  .m2-link-box .m2-btn{min-width:104px}',
'}',
/* --- планшет и ПК: колонка по центру, как у остальных экранов --- */
'@media (min-width:760px){',
'  .m2-card{padding:18px}',
'  .m2-qr-in svg{width:200px;height:200px}',
'}'
].join('\n');

(function injectCss(){
  var s = document.getElementById('oko-mini2-css');
  if(s) return;
  s = document.createElement('style');
  s.id = 'oko-mini2-css';
  s.textContent = CSS;
  (document.head || document.documentElement).appendChild(s);
})();

/* ===========================================================================
   2. ОБЩЕЕ: честный QR (настоящий, сканируемый) для реф-ссылки и адресов
   Минимальный кодировщик QR (байтовый режим, версии 1–10, ECC-L).
   Нужен, чтобы «QR» в партнёрке был настоящим кодом, а не украшением.
   =========================================================================== */

var QR = (function(){
  var EXP = new Array(512), LOG = new Array(256);
  (function(){ var x = 1; for(var i = 0; i < 255; i++){ EXP[i] = x; LOG[x] = i;
    x <<= 1; if(x & 0x100) x ^= 0x11D; }
    for(var j = 255; j < 512; j++) EXP[j] = EXP[j - 255]; })();
  function mul(a, b){ return (a === 0 || b === 0) ? 0 : EXP[LOG[a] + LOG[b]]; }
  function genPoly(n){
    var p = [1];
    for(var i = 0; i < n; i++){
      var np = new Array(p.length + 1).fill(0);
      for(var j = 0; j < p.length; j++){
        np[j] ^= mul(p[j], 1);
        np[j + 1] ^= mul(p[j], EXP[i]);
      }
      p = np;
    }
    return p;
  }
  /* версия -> [총 кодовых слов данных для ECC-L, ecc-слов на блок] */
  var CAP = { 1:[19,7], 2:[34,10], 3:[55,15], 4:[80,20], 5:[108,26],
              6:[136,18], 7:[156,20], 8:[194,24], 9:[232,30], 10:[274,18] };
  var BLOCKS = { 1:1, 2:1, 3:1, 4:1, 5:1, 6:2, 7:2, 8:2, 9:2, 10:4 };
  var ALIGN = { 1:[], 2:[6,18], 3:[6,22], 4:[6,26], 5:[6,30], 6:[6,34],
                7:[6,22,38], 8:[6,24,42], 9:[6,26,46], 10:[6,28,50] };

  function pickVersion(len){
    for(var v = 1; v <= 10; v++){
      var hdr = 4 + (v < 10 ? 8 : 16);
      if(CAP[v][0] * 8 >= hdr + len * 8) return v;
    }
    return 0;
  }

  function encode(text){
    var bytes = [];
    for(var i = 0; i < text.length; i++){
      var c = text.charCodeAt(i);
      if(c < 0x80) bytes.push(c);
      else if(c < 0x800){ bytes.push(0xC0 | (c >> 6), 0x80 | (c & 63)); }
      else { bytes.push(0xE0 | (c >> 12), 0x80 | ((c >> 6) & 63), 0x80 | (c & 63)); }
    }
    var v = pickVersion(bytes.length);
    if(!v) return null;
    var total = CAP[v][0], eccPer = CAP[v][1], nb = BLOCKS[v];
    var bits = [];
    function put(val, n){ for(var k = n - 1; k >= 0; k--) bits.push((val >> k) & 1); }
    put(4, 4);
    put(bytes.length, v < 10 ? 8 : 16);
    bytes.forEach(function(b){ put(b, 8); });
    var cap = total * 8;
    for(var t = 0; t < 4 && bits.length < cap; t++) bits.push(0);
    while(bits.length % 8) bits.push(0);
    var pad = [0xEC, 0x11], pi = 0;
    while(bits.length < cap){ put(pad[pi++ % 2], 8); }
    var data = [];
    for(var b2 = 0; b2 < bits.length; b2 += 8){
      var byte = 0; for(var k2 = 0; k2 < 8; k2++) byte = (byte << 1) | bits[b2 + k2];
      data.push(byte);
    }
    /* разбивка на блоки */
    var short = Math.floor(total / nb), extra = total % nb;
    var blocks = [], eccs = [], off = 0, gp = genPoly(eccPer);
    for(var bi = 0; bi < nb; bi++){
      var size = short + (bi >= nb - extra ? 1 : 0);
      var blk = data.slice(off, off + size); off += size;
      blocks.push(blk);
      var rem = blk.concat(new Array(eccPer).fill(0));
      for(var d = 0; d < blk.length; d++){
        var f = rem[d]; if(!f) continue;
        for(var g = 1; g < gp.length; g++) rem[d + g] ^= mul(gp[g], f);
      }
      eccs.push(rem.slice(blk.length));
    }
    var out = [], maxLen = Math.max.apply(null, blocks.map(function(x){ return x.length; }));
    for(var i2 = 0; i2 < maxLen; i2++) blocks.forEach(function(bl){ if(i2 < bl.length) out.push(bl[i2]); });
    for(var i3 = 0; i3 < eccPer; i3++) eccs.forEach(function(ec){ out.push(ec[i3]); });
    return { v:v, codes:out };
  }

  function build(text){
    var enc = encode(text);
    if(!enc) return null;
    var v = enc.v, n = v * 4 + 17;
    var m = [], res = [];
    for(var y = 0; y < n; y++){ m.push(new Array(n).fill(0)); res.push(new Array(n).fill(0)); }
    function set(x, y, val){ m[y][x] = val ? 1 : 0; res[y][x] = 1; }
    function finder(cx, cy){
      for(var dy = -1; dy <= 7; dy++) for(var dx = -1; dx <= 7; dx++){
        var x = cx + dx, y = cy + dy;
        if(x < 0 || y < 0 || x >= n || y >= n) continue;
        var on = (dx >= 0 && dx <= 6 && (dy === 0 || dy === 6)) ||
                 (dy >= 0 && dy <= 6 && (dx === 0 || dx === 6)) ||
                 (dx >= 2 && dx <= 4 && dy >= 2 && dy <= 4);
        set(x, y, on);
      }
    }
    finder(0, 0); finder(n - 7, 0); finder(0, n - 7);
    for(var i = 8; i < n - 8; i++){ set(i, 6, i % 2 === 0); set(6, i, i % 2 === 0); }
    var al = ALIGN[v];
    al.forEach(function(ax){ al.forEach(function(ay){
      if((ax <= 8 && ay <= 8) || (ax >= n - 9 && ay <= 8) || (ax <= 8 && ay >= n - 9)) return;
      for(var dy = -2; dy <= 2; dy++) for(var dx = -2; dx <= 2; dx++)
        set(ax + dx, ay + dy, Math.max(Math.abs(dx), Math.abs(dy)) !== 1);
    }); });
    set(8, n - 8, 1);
    /* резерв под формат */
    for(var k = 0; k < 9; k++){ if(k !== 6){ res[8][k] = 1; res[k][8] = 1; } }
    for(var k2 = 0; k2 < 8; k2++){ res[8][n - 1 - k2] = 1; res[n - 1 - k2][8] = 1; }

    /* укладка данных змейкой + маска 0 */
    var codes = enc.codes, bitIdx = 0, dir = -1, row = n - 1;
    for(var col = n - 1; col > 0; col -= 2){
      if(col === 6) col--;
      for(;;){
        for(var c2 = 0; c2 < 2; c2++){
          var x = col - c2;
          if(!res[row][x]){
            var bit = 0;
            if(bitIdx < codes.length * 8) bit = (codes[bitIdx >> 3] >> (7 - (bitIdx & 7))) & 1;
            bitIdx++;
            if((row + x) % 2 === 0) bit ^= 1;   /* маска 0 */
            m[row][x] = bit;
          }
        }
        row += dir;
        if(row < 0 || row >= n){ row -= dir; dir = -dir; break; }
      }
    }
    /* формат: ECC-L (01) + маска 000 */
    var fmt = 0x77C4;
    for(var i4 = 0; i4 < 15; i4++){
      var b = (fmt >> i4) & 1;
      if(i4 < 6) m[i4][8] = b;
      else if(i4 < 8) m[i4 + 1][8] = b;
      else if(i4 === 8) m[8][7] = b;
      else m[8][14 - i4] = b;
      if(i4 < 8) m[8][n - 1 - i4] = b;
      else m[n - 15 + i4][8] = b;
    }
    return m;
  }

  return {
    svg: function(text){
      var m;
      try{ m = build(String(text || '')); }catch(e){ m = null; }
      if(!m) return '';
      var n = m.length, pad = 4, size = n + pad * 2, path = '';
      for(var y = 0; y < n; y++) for(var x = 0; x < n; x++)
        if(m[y][x]) path += 'M' + (x + pad) + ' ' + (y + pad) + 'h1v1h-1z';
      return '<svg viewBox="0 0 ' + size + ' ' + size + '" role="img" aria-label="QR-код">' +
             '<rect width="' + size + '" height="' + size + '" fill="#fff"/>' +
             '<path d="' + path + '" fill="currentColor"/></svg>';
    }
  };
})();

/* ===========================================================================
   3. ИГРЫ И РУЛЕТКА ОКО
   =========================================================================== */

var GAMES = (function(){

  /* --- 3.1 честная таблица лидеров ------------------------------------- */
  function meName(){
    try{ if(typeof PROFILE !== 'undefined' && PROFILE && PROFILE.name) return String(PROFILE.name); }catch(e){}
    return 'Ты';
  }
  function leagueLabel(){
    /* GM_LB_LEAGUE объявлена через let — на window её нет, только в общей
       лексической области классических скриптов. Читаем по имени. */
    var id = 'friends';
    try{ if(typeof GM_LB_LEAGUE !== 'undefined' && GM_LB_LEAGUE) id = GM_LB_LEAGUE; }catch(e){}
    try{
      if(typeof GM_LB_LEAGUES !== 'undefined' && GM_LB_LEAGUES && GM_LB_LEAGUES.find){
        var l = GM_LB_LEAGUES.find(function(x){ return x.id === id; });
        if(l) return l.n;
      }
    }catch(e){}
    return {friends:'Друзья', city:'Твой город', world:'Мир'}[id] || 'Друзья';
  }
  function daysLeft(){
    var d = 7 - ((new Date().getDay() + 6) % 7);
    return d + ' ' + plural(d, 'день', 'дня', 'дней');
  }

  function renderLb(){
    var host = document.getElementById('gmLb');
    if(!host) return;

    var rows = [];
    try{ if(typeof gmLbRank === 'function') rows = gmLbRank() || []; }catch(e){ rows = []; }

    var me = null, others = [];
    rows.forEach(function(r){
      if(r && r.me) me = r; else if(r) others.push(r);
    });
    var myScore = fin(me && me.s, 0);
    var myWins  = fin(me && me.w, 0);

    var head = '<div class="m2-lb-head">' +
      '<span>' + ic('gm-cup') + 'Призы за неделю · ' + E(leagueLabel()) + '</span>' +
      '<small>сброс через ' + daysLeft() + '</small></div>';

    /* никто ещё не играл — честно говорим об этом, а не рисуем «#1 из одного» */
    if(!others.length && myWins <= 0){
      setHtml(host, head +
        '<div class="m2-empty">' +
          '<span class="m2-empty-ic">' + ic('gm-cup') + '</span>' +
          '<b>Пока никто не играл</b>' +
          '<span>Неделя только началась. Таблица заполняется реальными игроками OKO — ' +
          'выдуманных соперников здесь нет и не будет. Крутани колесо, и первая строка станет твоей.</span>' +
        '</div>' +
        '<div class="m2-note">' + ic('info') +
          '<p>В зачёт идёт <b>сумма выигранных призов</b> за неделю: деньги, билеты, ' +
          'скидки и подарки по их номиналу. Рейтинг обнуляется каждый понедельник.</p></div>');
      return;
    }

    /* играю только я — показываем свою строку, но без ложного «первое место» */
    if(!others.length){
      var av = E((meName()[0] || '?').toUpperCase());
      setHtml(host, head +
        '<div class="m2-lb-solo">' +
          '<span class="ava">' + av + '</span>' +
          '<div class="m2-lb-solo-b"><b>' + E(meName()) + '</b>' +
          '<small>' + myWins + ' ' + plural(myWins, 'приз', 'приза', 'призов') + ' за неделю</small></div>' +
          '<span class="m2-lb-solo-s">' + rub(myScore) + '</span>' +
        '</div>' +
        '<div class="m2-note">' + ic('info') +
          '<p>Ты пока единственный участник этой недели — <b>это не первое место</b>, ' +
          'а просто пустой рейтинг. Как только начнут играть другие, здесь появится ' +
          'настоящая таблица, и позицией будет чем похвастаться.</p></div>');
      return;
    }

    /* реальный рейтинг: стандартные строки ядра + честная кнопка «поделиться» */
    var html = head;
    rows.slice(0, 10).forEach(function(r, i){
      try{ html += gmLbRow(r, i + 1); }catch(e){}
    });
    var myIdx = rows.findIndex(function(r){ return r && r.me; });
    if(myIdx >= 10){
      html += '<div class="gm-lb-gap">···</div>';
      try{ html += gmLbRow(rows[myIdx], myIdx + 1); }catch(e){}
    }
    if(!setHtml(host, html)) return;
    if(myIdx >= 0 && typeof window.viralOpenShare === 'function'){
      var b = document.createElement('button');
      b.className = 'vr-lb-share';
      b.type = 'button';
      b.innerHTML = ic('share') + 'Поделиться позицией · #' + (myIdx + 1) + ' ' + E(leagueLabel());
      b.onclick = function(){
        window.viralOpenShare('leaderboard', {
          rank: myIdx + 1, league: leagueLabel(), score: Math.round(fin(rows[myIdx].s, 0))
        });
      };
      host.appendChild(b);
    }
  }

  /* --- 3.2 карточка «Как устроена рулетка» ------------------------------ */
  function stakeInfo(){
    var mode = 'free';
    try{ if(typeof gmMode !== 'undefined') mode = gmMode || 'free'; }catch(e){}
    var cost = 0;
    try{ if(typeof GM_STAKES !== 'undefined' && GM_STAKES[mode]) cost = fin(GM_STAKES[mode].cost, 0); }catch(e){}
    return {mode:mode, cost:cost};
  }
  function balance(){
    try{ if(typeof WALLET !== 'undefined' && WALLET && typeof WALLET.balance === 'number') return fin(WALLET.balance, 0); }catch(e){}
    try{
      var t = (document.getElementById('gmBalance') || {}).textContent || '';
      return fin(parseInt(t.replace(/[^\d]/g, ''), 10), 0);
    }catch(e){ return 0; }
  }

  function rulesHtml(){
    var st = stakeInfo();
    var bal = balance();
    var stakeTxt = st.cost > 0
      ? 'Выбранная ставка — <b>' + rub(st.cost) + '</b>. Она списывается с лицевого счёта OKO, ' +
        'на нём сейчас ' + rub(bal) + '.'
      : 'Сейчас выбрана <b>бесплатная крутка</b> — она не стоит ничего и доступна раз в сутки.';

    return '<div class="m2-h">' + ic('gm-scales') + '<span>Как устроена рулетка</span></div>' +
      '<div class="m2-steps">' +
        '<div class="m2-step"><span class="m2-step-n"></span><div class="m2-step-b">' +
          '<b>Ставка — это реальные деньги кошелька</b>' +
          '<span>' + stakeTxt + ' Ставку можно оплатить билетами: их дают за крутки и задания, ' +
          'тогда с кошелька не спишется ничего.</span></div></div>' +
        '<div class="m2-step"><span class="m2-step-n"></span><div class="m2-step-b">' +
          '<b>Пустых секторов нет</b>' +
          '<span>Каждая крутка обязательно даёт приз: деньги, билеты, скидку на тариф, ' +
          'проверку видео, буст или тариф. Ставка не «сгорает».</span></div></div>' +
        '<div class="m2-step"><span class="m2-step-n"></span><div class="m2-step-b">' +
          '<b>Шансы открыты заранее</b>' +
          '<span>Вероятность каждого сектора и средний приз крутки видно до запуска — ' +
          'в таблице шансов. Результат разыгрывается в момент нажатия, повлиять на него нельзя.</span></div></div>' +
        '<div class="m2-step"><span class="m2-step-n"></span><div class="m2-step-b">' +
          '<b>Выигрыш идёт туда, где им можно пользоваться</b>' +
          '<span>Деньги — сразу на лицевой счёт, скидки и услуги — в «Мои призы» с кодом, ' +
          'билеты — в счётчик наверху экрана.</span></div></div>' +
      '</div>' +
      '<div class="m2-btn-row">' +
        '<button class="m2-btn ghost" type="button" onclick="if(typeof gmOddsOpen===\'function\')gmOddsOpen()">' +
          ic('gm-scales') + 'Таблица шансов</button>' +
        '<button class="m2-btn mute" type="button" onclick="if(typeof gmStatsOpen===\'function\')gmStatsOpen()">' +
          ic('gm-chart') + 'Моя статистика</button>' +
      '</div>' +
      '<div class="m2-note">' + ic('lock') +
        '<p>Средний приз считается по тем же весам, что и розыгрыш, — это не рекламное ' +
        'обещание, а математика конкретного пула. На дистанции платные крутки приносят ' +
        'OKO маржу, поэтому <b>играй на то, что не жалко</b>.</p></div>';
  }

  /* --- 3.3 достижения: честная подпись ---------------------------------- */
  function achNoteHtml(){
    return '<div class="m2-note">' + ic('check') +
      '<p>Достижения открываются <b>только реальными действиями</b>: крутками, ' +
      'выполненными заданиями, купленными и отправленными подарками, уровнями пропуска. ' +
      'Ничего нельзя «получить авансом» — прогресс считается на этом устройстве и ' +
      'переедет в аккаунт после запуска бэкенда.</p></div>';
  }

  /* --- 3.4 ежедневный бонус: честная подпись ---------------------------- */
  function bonusNoteHtml(){
    var extra = 0;
    try{ if(typeof gmExtraFreeGet === 'function') extra = fin(gmExtraFreeGet(), 0); }catch(e){}
    var stash = extra > 0
      ? ' В копилке ' + extra + ' ' + plural(extra, 'бесплатная крутка', 'бесплатные крутки', 'бесплатных круток') + ' — их можно потратить в любой день.'
      : '';
    return '<div class="m2-note">' + ic('clock') +
      '<p><b>Бесплатная крутка — одна в сутки.</b> Сутки считаются от момента, когда ты ' +
      'забрал прошлую, а не от полуночи: таймер на кнопке показывает точное время. ' +
      'Серия заходов копит дополнительные бесплатные крутки на вехах 3, 7, 14 и 30 дней.' + stash + '</p></div>';
  }

  /* --- 3.5 сборка блоков на экране -------------------------------------- */
  function apply(pad){
    if(!pad) return;

    /* карточка правил — сразу после блока выбора крутки */
    var modes = document.getElementById('gmModes');
    if(modes && !document.getElementById('m2GmRules')){
      var card = document.createElement('div');
      card.className = 'm2-card';
      card.id = 'm2GmRules';
      modes.parentNode.insertBefore(card, modes.nextSibling);
    }
    setHtml(document.getElementById('m2GmRules'), rulesHtml());

    /* честная подпись к ежедневному бонусу — после карточки заданий дня */
    var daily = document.getElementById('gmDailyBlock');
    if(daily && !document.getElementById('m2GmBonus')){
      var b = document.createElement('div');
      b.id = 'm2GmBonus';
      daily.parentNode.insertBefore(b, daily.nextSibling);
    }
    setHtml(document.getElementById('m2GmBonus'), bonusNoteHtml());

    /* подпись к достижениям */
    var ach = document.getElementById('gmAch');
    if(ach && !document.getElementById('m2GmAch')){
      var a = document.createElement('div');
      a.id = 'm2GmAch';
      ach.parentNode.insertBefore(a, ach.nextSibling);
    }
    setHtml(document.getElementById('m2GmAch'), achNoteHtml());

    /* базовая карточка «честная механика» дублирует нашу — прячем, чтобы
       человек не читал одно и то же дважды */
    setStyle(pad.querySelector('.gm-resp'), 'display', 'none');

    renderLb();
  }

  function init(){
    /* забираем рендер таблицы лидеров себе — наша версия честная в пустом состоянии */
    var tries = 0;
    (function grab(){
      if(typeof window.gmLbRender !== 'function'){
        if(++tries < 80) return setTimeout(grab, 150);
        return;
      }
      window.gmLbRender = renderLb;
      try{ if(document.getElementById('gmLb')) renderLb(); }catch(e){}
    })();

    watch('#screen-games .pad', apply);
    onTab(function(t){ if(t === 'games'){ var p = q('#screen-games .pad'); if(p) apply(p); } });
  }

  return {init:init, renderLb:renderLb};
})();

/* ===========================================================================
   4. ПАРТНЁРКА
   =========================================================================== */

var PARTNER = (function(){

  /* Ставки программы. Константы REF_PCT_* лежат в замыкании модуля
     partner-plus, снаружи их не видно, поэтому читаем те же числа с экрана:
     чип в шапке кабинета («15% · 5% сверху») и процент текущего уровня в
     лестнице. Так калькулятор не разъедется с тем, что человек видит. */
  function pct(){
    var first = 15, repeat = 5, l2 = 5, bonus = 0;
    try{
      var chip = q('#ppRoot .section-h .chip');
      var m = chip && (chip.textContent || '').match(/(\d+)\s*%[^\d]+(\d+)\s*%/);
      if(m){ first = fin(+m[1], 15); repeat = fin(+m[2], 5); }
    }catch(e){}
    try{
      var tp = q('#ppLadder .pp-tier-percent');
      var cur = tp && (tp.textContent || '').match(/(\d+)/);
      if(cur) bonus = Math.max(0, fin(+cur[1], first) - first);
    }catch(e){}
    return {first:first, repeat:repeat, l2:l2, bonus:bonus};
  }

  function nick(){
    try{ if(typeof PP !== 'undefined' && PP.nick) return String(PP.nick).replace(/^@/, ''); }catch(e){}
    try{ if(typeof PROFILE !== 'undefined' && PROFILE.nick) return String(PROFILE.nick).replace(/^@/, ''); }catch(e){}
    return '';
  }

  /* дип-ссылки на конкретный продукт: /r/<ник>/<продукт> */
  var LINK_PROD = load('pp-link-prod', 'all');
  /* Справочник продуктов живёт в замыкании модуля partner-plus (const PP),
     снаружи он не виден. Берём его из разметки блока дип-ссылок #ppDeepTabs —
     это тот же список, из одного источника. Если блока ещё нет, работаем
     с общей ссылкой: показать «Все продукты» честнее, чем выдумать список. */
  function products(){
    var out = [];
    try{
      qa('#ppDeepTabs button[data-p]').forEach(function(b){
        var k = b.getAttribute('data-p');
        var label = (b.textContent || '').trim();
        if(k && label) out.push({k:k, label:label});
      });
    }catch(e){}
    if(out.length) return out;
    return [{k:'all', label:'Все продукты'}];
  }
  function refUrl(){
    var n = nick();
    if(!n) return '';
    var u = 'https://okoteam.top/r/' + n;
    if(LINK_PROD && LINK_PROD !== 'all') u += '/' + LINK_PROD;
    return u;
  }
  window.okoM2LinkProd = function(k){
    LINK_PROD = k || 'all';
    save('pp-link-prod', LINK_PROD);
    var host = document.getElementById('m2PpLink');
    if(host){ host.__m2html = null; setHtml(host, linkHtml()); }
  };

  /* --- 4.1 ссылка + настоящий QR ---------------------------------------- */
  function linkHtml(){
    var url = refUrl();
    if(!url){
      return '<div class="m2-h">' + ic('link') + '<span>Партнёрская ссылка</span></div>' +
        '<div class="m2-empty">' +
          '<span class="m2-empty-ic">' + ic('user') + '</span>' +
          '<b>Сначала нужен ник</b>' +
          '<span>Партнёрская ссылка строится из твоего ника: <span class="m2-mono">okoteam.top/r/ник</span>. ' +
          'Задай ник в профиле — ссылка и QR появятся здесь сразу.</span>' +
        '</div>';
    }
    var chips = products().map(function(p){
      var k = p.k || 'all';
      return '<button class="m2-chip ' + (k === LINK_PROD ? 'on' : '') + '" type="button" ' +
        'onclick="okoM2LinkProd(\'' + E(k) + '\')">' + E(p.label || k) + '</button>';
    }).join('');
    var qr = QR.svg(url);
    var sub = LINK_PROD === 'all'
      ? 'Общий адрес ведёт на главную OKO. Кто перейдёт по нему и оплатит — закрепится за тобой.'
      : 'Дип-ссылка ведёт сразу на нужный продукт: человек попадает на оффер, а не ищет его сам.';

    return '<div class="m2-h">' + ic('link') + '<span>Ссылка и QR-код</span></div>' +
      '<p class="m2-sub">' + sub + '</p>' +
      '<div class="m2-chips">' + chips + '</div>' +
      '<div class="m2-link-box">' +
        '<div class="m2-link-val oko-breakable" id="m2RefUrl">' + E(url) + '</div>' +
        '<button class="m2-btn" type="button" onclick="okoM2CopyRef()">' + ic('copy') + 'Копировать</button>' +
      '</div>' +
      (qr ? '<div class="m2-qr"><div class="m2-qr-in">' + qr + '</div></div>' : '') +
      '<p class="m2-sub" style="text-align:center">Настоящий сканируемый QR — наведи камеру и проверь. ' +
      'Подходит для визитки, стенда и слайда.</p>' +
      '<div class="m2-btn-row">' +
        '<button class="m2-btn mute" type="button" onclick="okoM2ShareRef()">' + ic('share') + 'Поделиться</button>' +
        '<button class="m2-btn mute" type="button" onclick="okoM2SaveQr()">' + ic('download') + 'Сохранить QR</button>' +
      '</div>' +
      '<div class="m2-note">' + ic('info') +
        '<p>Переходы и оплаты по ссылке начнут считаться, когда включится партнёрский ' +
        'бэкенд. Сейчас в статистике честные нули — <b>ссылка уже рабочая</b>, ' +
        'её можно раздавать заранее.</p></div>';
  }

  window.okoM2CopyRef = function(){
    var url = refUrl();
    if(!url) return say('Сначала задай ник в профиле');
    try{
      if(navigator.clipboard && navigator.clipboard.writeText){
        navigator.clipboard.writeText(url).then(function(){ say('Ссылка скопирована'); },
          function(){ say('Скопируй вручную: ' + url); });
        return;
      }
    }catch(e){}
    say('Скопируй вручную: ' + url);
  };
  window.okoM2ShareRef = function(){
    var url = refUrl();
    if(!url) return say('Сначала задай ник в профиле');
    var txt = 'OKO — мессенджер, кошелёк и контент-завод в одном приложении. Заходи по моей ссылке: ' + url;
    try{
      if(navigator.share){ navigator.share({title:'OKO', text:txt, url:url}).catch(function(){}); return; }
    }catch(e){}
    window.okoM2CopyRef();
  };
  /* Кнопки ядра «скопировать/поделиться» отдавали адрес без схемы
     (okoteam.top/r/ник), а QR и наш блок — с https. Один адрес на всё. */
  window.ppCopyRef  = function(){ window.okoM2CopyRef(); };
  window.ppShareRef = function(){ window.okoM2ShareRef(); };

  /* Базовая шторка QR рисовала «бренд-матрицу» из случайных квадратов и
     предлагала наклеить её на визитку. Такой код не сканируется — это
     обещание, которое не выполняется. Отдаём настоящий QR. */
  window.ppOpenQR = function(){
    var url = refUrl();
    var view = document.getElementById('ppQrView');
    if(!view) return say(url ? url : 'Сначала задай ник в профиле');
    if(!url){
      view.innerHTML = '<h3>QR-код ссылки</h3>' +
        '<div class="m2-empty"><span class="m2-empty-ic">' + ic('user') + '</span>' +
        '<b>Сначала нужен ник</b><span>Ссылка и QR строятся из ника — задай его в профиле.</span></div>';
    } else {
      view.innerHTML = '<h3>QR-код твоей ссылки</h3>' +
        '<div class="m2-qr"><div class="m2-qr-in">' + QR.svg(url) + '</div></div>' +
        '<div class="m2-link-val oko-breakable" style="margin-top:4px">' + E(url) + '</div>' +
        '<p class="m2-sub" style="text-align:center;margin-top:8px">Настоящий сканируемый код. ' +
        'Проверь камерой телефона перед тем, как печатать на визитке.</p>' +
        '<div class="m2-btn-row">' +
          '<button class="m2-btn" type="button" onclick="okoM2CopyRef()">' + ic('copy') + 'Копировать ссылку</button>' +
        '</div>';
    }
    if(typeof openSheet === 'function') openSheet('pp-qr');
  };

  window.okoM2SaveQr = function(){
    var svg = q('#m2PpLink .m2-qr-in svg');
    if(!svg) return say('QR ещё не построен');
    try{
      var s = new XMLSerializer().serializeToString(svg);
      var blob = new Blob([s], {type:'image/svg+xml'});
      var a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = 'oko-ref-qr.svg';
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(function(){ URL.revokeObjectURL(a.href); }, 500);
      say('QR сохранён файлом SVG');
    }catch(e){ say('Не удалось сохранить — сделай скриншот'); }
  };

  /* --- 4.2 калькулятор с открытой формулой ------------------------------ */
  var CALC2 = load('pp-calc', {clients: 5, price: 4900, months: 12});

  function calcHtml(){
    var p = pct();
    var c = Math.max(1, Math.min(500, fin(CALC2.clients, 5)));
    var price = Math.max(100, Math.min(500000, fin(CALC2.price, 4900)));
    CALC2.clients = c; CALC2.price = price;

    var firstPct = p.first + p.bonus;
    var turnover = c * price;
    var first  = turnover * firstPct / 100;
    var repeat = turnover * p.repeat / 100;

    var presets = [1900, 2900, 4900, 30000];
    var chips = presets.map(function(v){
      return '<button class="m2-chip ' + (v === price ? 'on' : '') + '" type="button" ' +
             'onclick="okoM2CalcPrice(' + v + ')">' + rub(v) + '</button>';
    }).join('');

    return '<div class="m2-h">' + ic('pp-calc') + '<span>Калькулятор дохода</span></div>' +
      '<p class="m2-sub">Считает по действующим ставкам программы. Это <b>арифметика, а не прогноз</b>: ' +
      'сколько человек реально оплатит — зависит только от тебя.</p>' +

      '<div class="m2-chips">' + chips + '</div>' +
      '<label class="m2-field"><span>Средний чек клиента, ₽</span>' +
        '<input type="number" inputmode="numeric" min="100" max="500000" step="100" value="' + price + '" ' +
        'id="m2CalcPrice" oninput="okoM2CalcPrice(this.value)"></label>' +

      '<div class="m2-calc-line">' +
        '<span class="m2-calc-lbl">Оплативших клиентов в месяц</span>' +
        '<span class="m2-calc-stepper">' +
          '<button type="button" aria-label="меньше" onclick="okoM2CalcStep(-1)">−</button>' +
          '<span class="v" id="m2CalcN">' + c + '</span>' +
          '<button type="button" aria-label="больше" onclick="okoM2CalcStep(1)">+</button>' +
        '</span>' +
      '</div>' +
      '<input type="range" class="m2-range" min="1" max="100" value="' + Math.min(100, c) + '" ' +
        'id="m2CalcRange" oninput="okoM2CalcSet(this.value)">' +

      '<div class="m2-calc-out" id="m2CalcOut">' + calcOutHtml() + '</div>' +

      '<div class="m2-note">' + ic('info') +
        '<p><b>Как считается.</b> Оборот = клиенты × чек. С него ты получаешь ' +
        firstPct + '% с первой оплаты' + (p.bonus ? ' (' + p.first + '% базовых + ' + p.bonus + '% за уровень)' : '') +
        ' и ' + p.repeat + '% с каждого следующего продления того же клиента. ' +
        'Вторая линия (' + p.l2 + '%) идёт с оплат тех, кого приведут <b>твои</b> партнёры — ' +
        'заранее её знать нельзя, поэтому она вынесена отдельной строкой с прямо ' +
        'указанным допущением, а не спрятана внутрь итога.</p></div>';
  }

  function calcOutHtml(){
    var p = pct();
    var c = fin(CALC2.clients, 1), price = fin(CALC2.price, 4900);
    var firstPct = p.first + p.bonus;
    var turnover = c * price;
    var first  = turnover * firstPct / 100;
    var repeat = turnover * p.repeat / 100;
    /* Допущение по 2-й линии ровно то же, что в подсказках слоя роста:
       каждый пятый приведённый сам становится партнёром и приводит двоих.
       Держим его отдельной строкой и подписываем словом «допущение». */
    var n2 = c * 0.2 * 2;
    var l2 = n2 * price * p.l2 / 100;
    return '<div class="m2-rows">' +
      '<div class="m2-row"><span>Оборот · ' + c + ' × ' + rub(price) + '</span><b>' + rub(turnover) + '</b></div>' +
      '<div class="m2-row"><span>Первая оплата · ' + firstPct + '%</span><b>' + rub(first) + '</b></div>' +
      '<div class="m2-row total"><span>Точно твоё в первый месяц</span><b>' + rub(first) + '</b></div>' +
      '<div class="m2-row"><span>Если все продлятся · ' + p.repeat + '% со второго месяца</span><b>' + rub(repeat) + '</b></div>' +
      '<div class="m2-row"><span>Допущение: 2-я линия · ' + Math.round(n2) + ' ' +
        plural(Math.round(n2), 'клиент', 'клиента', 'клиентов') + ' × ' + p.l2 + '%</span><b>' + rub(l2) + '</b></div>' +
      '</div>';
  }

  function syncCalc(){
    var out = document.getElementById('m2CalcOut');
    if(out) out.innerHTML = calcOutHtml();
    var n = document.getElementById('m2CalcN');
    if(n) n.textContent = fin(CALC2.clients, 1);
    var r = document.getElementById('m2CalcRange');
    if(r && +r.value !== Math.min(100, fin(CALC2.clients, 1))) r.value = Math.min(100, fin(CALC2.clients, 1));
    save('pp-calc', CALC2);
  }
  window.okoM2CalcSet = function(v){
    CALC2.clients = Math.max(1, Math.min(500, parseInt(v, 10) || 1));
    syncCalc();
  };
  window.okoM2CalcStep = function(d){ window.okoM2CalcSet(fin(CALC2.clients, 1) + d); };
  window.okoM2CalcPrice = function(v){
    CALC2.price = Math.max(100, Math.min(500000, parseInt(v, 10) || 100));
    var inp = document.getElementById('m2CalcPrice');
    if(inp && String(inp.value) !== String(CALC2.price) && document.activeElement !== inp) inp.value = CALC2.price;
    qa('#m2PpCalc .m2-chip').forEach(function(b){
      var oc = b.getAttribute('onclick') || '';
      var m = oc.match(/okoM2CalcPrice\((\d+)\)/);
      b.classList.toggle('on', !!m && +m[1] === CALC2.price);
    });
    syncCalc();
  };

  /* --- 4.3 условия программы -------------------------------------------- */
  function termsHtml(){
    var p = pct();
    var minPay = payoutFacts().minPay;
    return '<div class="m2-h">' + ic('file') + '<span>Условия программы</span></div>' +
      '<div class="m2-rows">' +
        '<div class="m2-row"><span>С первой оплаты клиента</span><b>' + p.first + '%</b></div>' +
        '<div class="m2-row"><span>Со всех повторных оплат</span><b>' + p.repeat + '%</b></div>' +
        '<div class="m2-row"><span>Со второй линии</span><b>' + p.l2 + '%</b></div>' +
        '<div class="m2-row"><span>Надбавка за уровень оборота</span><b>до +20%</b></div>' +
        '<div class="m2-row"><span>Минимальная выплата</span><b>' + rub(minPay) + '</b></div>' +
        '<div class="m2-row"><span>Холд перед выплатой</span><b>14 дней</b></div>' +
      '</div>' +
      '<div class="m2-steps" style="margin-top:12px">' +
        '<div class="m2-step"><span class="m2-step-n"></span><div class="m2-step-b">' +
          '<b>Клиент закрепляется на 90 дней</b>' +
          '<span>Метка перехода живёт в браузере 90 дней. Если человек оплатит в этот срок — ' +
          'начисление твоё, даже если пришёл он не сразу.</span></div></div>' +
        '<div class="m2-step"><span class="m2-step-n"></span><div class="m2-step-b">' +
          '<b>Холд 14 дней</b>' +
          '<span>Начисление лежит в статусе «ожидает», пока не пройдёт срок возврата по оферте. ' +
          'Вернули оплату — начисление отменяется, и это видно в истории.</span></div></div>' +
        '<div class="m2-step"><span class="m2-step-n"></span><div class="m2-step-b">' +
          '<b>Что не оплачивается</b>' +
          '<span>Собственные покупки, самореференс, накрутка регистраций, спам и реклама ' +
          'от имени OKO. Такие начисления снимаются, аккаунт может быть отключён от программы.</span></div></div>' +
        '<div class="m2-step"><span class="m2-step-n"></span><div class="m2-step-b">' +
          '<b>Налоги — на стороне партнёра</b>' +
          '<span>Выплата приходит целиком; отчитаться по своему статусу (самозанятый, ИП) ' +
          'нужно самостоятельно.</span></div></div>' +
      '</div>' +
      '<button class="m2-btn ghost" type="button" style="margin-top:12px" ' +
        'onclick="if(typeof openLegalDoc===\'function\')openLegalDoc(\'offer\');else if(typeof openLegalHub===\'function\')openLegalHub()">' +
        ic('file') + 'Полные условия в оферте</button>';
  }

  /* --- 4.4 история начислений (честно пустая) --------------------------- */
  function historyHtml(){
    return '<div class="m2-h">' + ic('clock') + '<span>История начислений</span></div>' +
      '<div class="m2-empty">' +
        '<span class="m2-empty-ic">' + ic('money') + '</span>' +
        '<b>Начислений пока нет</b>' +
        '<span>Здесь появится каждая оплата твоего клиента: продукт, дата, сумма и статус. ' +
        'Пока строк нет — значит по твоей ссылке ещё никто не оплатил.</span>' +
      '</div>' +
      '<div class="m2-rows">' +
        '<div class="m2-row"><span>' + '<span class="m2-badge wait">Ожидает</span>' +
          ' — оплата прошла, идёт холд 14 дней</span></div>' +
        '<div class="m2-row"><span>' + '<span class="m2-badge ok">Выплачено</span>' +
          ' — сумма ушла в заявку на вывод</span></div>' +
        '<div class="m2-row"><span>' + '<span class="m2-badge no">Отменено</span>' +
          ' — клиент вернул деньги по оферте</span></div>' +
      '</div>';
  }

  /* --- 4.5 заявки на выплату (локально, без вранья) --------------------- */
  function payouts(){ return load('pp-payouts', []) || []; }

  /* Доступная сумма и порог — тоже из замыкания модуля. Читаем их с экрана
     (карточка «Доступно к выводу» ядра), чтобы числа совпадали до рубля. */
  function payoutFacts(){
    var avail = 0, minPay = 1000;
    try{
      var sum = q('#ppPayoutTop .pp-payout-hero .sum b');
      if(sum) avail = fin(parseInt(String(sum.textContent).replace(/[^\d]/g, ''), 10), 0);
      var btn = q('#ppPayoutTop .pp-payout-hero .cta button');
      var m = btn && (btn.textContent || '').match(/от\s+([\d\s ]+)/);
      if(m) minPay = fin(parseInt(m[1].replace(/[^\d]/g, ''), 10), 1000);
    }catch(e){}
    return {avail:avail, minPay:minPay};
  }

  function payoutHtml(){
    var list = payouts();
    var f = payoutFacts();
    var avail = f.avail, minPay = f.minPay;
    var can = avail >= minPay && avail > 0;

    var body = list.length
      ? '<div class="m2-list">' + list.map(function(r, i){
          var st = r.status === 'sent' ? '<span class="m2-badge ok">Отправлена</span>'
                 : '<span class="m2-badge wait">Черновик</span>';
          return '<div class="m2-item"><div class="m2-item-b">' +
            '<b>' + rub(fin(r.sum, 0)) + ' · ' + E(r.method || '') + '</b>' +
            '<div class="m2-item-m">' + st +
              '<small>' + E(new Date(fin(r.at, Date.now())).toLocaleString('ru-RU',
                {day:'2-digit', month:'short', hour:'2-digit', minute:'2-digit'})) + '</small>' +
              '<small class="oko-breakable">' + E(r.req || '') + '</small>' +
            '</div></div>' +
            '<div class="m2-item-x"><button class="m2-btn mute" style="min-height:32px;padding:6px 10px;font-size:11.5px" ' +
              'type="button" onclick="okoM2PayoutDrop(' + i + ')">' + ic('trash') + 'Удалить</button></div>' +
            '</div>';
        }).join('') + '</div>'
      : '<div class="m2-empty">' +
          '<span class="m2-empty-ic">' + ic('card') + '</span>' +
          '<b>Заявок ещё не было</b>' +
          '<span>Заявка становится доступной, когда на балансе набирается ' + rub(minPay) +
          ' после холда. Сейчас доступно ' + rub(avail) + '.</span>' +
        '</div>';

    return '<div class="m2-h">' + ic('card') + '<span>Выплаты</span></div>' +
      '<div class="m2-grid">' +
        '<div class="m2-cell hi"><b>' + rub(avail) + '</b><span>доступно</span></div>' +
        '<div class="m2-cell"><b>' + rub(minPay) + '</b><span>минимум</span></div>' +
        '<div class="m2-cell"><b>' + list.length + '</b><span>заявок</span></div>' +
      '</div>' +
      body +
      '<button class="m2-btn ' + (can ? '' : 'off') + '" type="button" style="margin-top:10px" ' +
        (can ? 'onclick="okoM2PayoutOpen()"' : 'disabled aria-disabled="true"') + '>' +
        ic('card') + (can ? 'Запросить выплату' : 'Доступно от ' + rub(minPay)) + '</button>' +
      '<div class="m2-note">' + ic('info') +
        '<p>Способы вывода: карта РФ, USDT (TRC-20), Lava.top. Пока партнёрский бэкенд не ' +
        'подключён, заявка <b>сохраняется на этом устройстве</b> и отправится в обработку ' +
        'первым же запросом после запуска — денег с баланса она не снимает и не «уходит» ' +
        'никуда сама.</p></div>';
  }

  window.okoM2PayoutDrop = function(i){
    var l = payouts();
    l.splice(i, 1);
    save('pp-payouts', l);
    var host = document.getElementById('m2PpPayout');
    setHtml(host, payoutHtml());
    say('Заявка удалена');
  };

  window.okoM2PayoutOpen = function(){
    var avail = payoutFacts().avail;
    if(typeof showPopup !== 'function'){ say('Не удалось открыть форму'); return; }
    showPopup({
      ico: 'card',
      title: 'Заявка на выплату',
      body: '<div style="text-align:left">' +
        '<p style="font-size:13px;line-height:1.55;color:var(--dim)">Сумма к выводу: <b style="color:var(--text)">' +
        rub(avail) + '</b>. Укажи реквизиты — заявка ляжет в список ниже и уйдёт в обработку ' +
        'после подключения партнёрского бэкенда.</p>' +
        '<label class="m2-field"><span>Куда вывести</span>' +
        '<select id="m2PayMethod"><option>Карта РФ</option><option>USDT · TRC-20</option>' +
        '<option>Lava.top</option></select></label>' +
        '<label class="m2-field"><span>Реквизиты</span>' +
        '<input id="m2PayReq" placeholder="Номер карты, кошелька или e-mail"></label></div>',
      actions: [
        {label:'Отмена', ghost:true},
        {label:'Сохранить заявку', onclick:function(){}}
      ]
    });
    /* перехватываем «Сохранить», чтобы прочитать поля до закрытия попапа */
    setTimeout(function(){
      var pop = document.getElementById('okoPopup');
      if(!pop) return;
      var btns = qa('.pop-actions .btn', pop);
      var ok = btns[btns.length - 1];
      if(!ok) return;
      ok.onclick = function(){
        var m = (document.getElementById('m2PayMethod') || {}).value || 'Карта РФ';
        var r = ((document.getElementById('m2PayReq') || {}).value || '').trim();
        if(!r){ say('Укажи реквизиты'); return; }
        var l = payouts();
        l.unshift({sum:avail, method:m, req:r, at:Date.now(), status:'draft'});
        save('pp-payouts', l.slice(0, 30));
        if(typeof closePopup === 'function') closePopup();
        var host = document.getElementById('m2PpPayout');
        setHtml(host, payoutHtml());
        say('Заявка сохранена на устройстве — уйдёт в обработку после запуска выплат');
      };
    }, 0);
  };

  /* честная замена базовой формы выплаты (та рисовала «Заявка принята») */
  window.ppDoPayout = function(){
    var inp = document.getElementById('ppPayReq');
    var req = ((inp && inp.value) || '').trim();
    if(!req){ say('Укажи реквизиты'); if(inp) inp.focus(); return; }
    var avail = payoutFacts().avail;
    var l = payouts();
    l.unshift({sum:avail, method:'Реквизиты из формы', req:req, at:Date.now(), status:'draft'});
    save('pp-payouts', l.slice(0, 30));
    var view = document.getElementById('ppPayoutView');
    if(view){
      view.innerHTML = '<div class="m2-empty">' +
        '<span class="m2-empty-ic">' + ic('clock') + '</span>' +
        '<b>Заявка сохранена</b>' +
        '<span>Реквизиты записаны на этом устройстве. Партнёрские выплаты включатся вместе ' +
        'с бэкендом — тогда заявка уйдёт в обработку, и здесь появится её статус. ' +
        'Никто пока никуда деньги не отправлял.</span>' +
        '<button class="m2-btn" type="button" style="margin-top:12px" onclick="closeSheet()">Понятно</button>' +
        '</div>';
    }
    setHtml(document.getElementById('m2PpPayout'), payoutHtml());
  };

  /* --- 4.6 доска лидеров партнёров -------------------------------------- */
  function lbHtml(){
    /* Список партнёров живёт в замыкании модуля. Смотрим на его разметку:
       есть хоть одна строка рейтинга — значит появились реальные партнёры,
       и мешать ядру не нужно; пусто — рисуем честное пустое состояние. */
    var rows = qa('#ppLb .pp-lb-row');
    if(rows.length) return null;
    return '<div class="m2-h">' + ic('users') + '<span>Рейтинг партнёров</span></div>' +
      '<div class="m2-empty">' +
        '<span class="m2-empty-ic">' + ic('users') + '</span>' +
        '<b>Рейтинг пока пуст</b>' +
        '<span>Сюда попадают партнёры с реальным оборотом за неделю. Выдуманных имён ' +
        'и чужих сумм здесь не будет — таблица включится вместе с первыми оплатами.</span>' +
      '</div>';
  }

  /* --- 4.7 сборка ------------------------------------------------------- */
  function ensure(host, id, before){
    var el = document.getElementById(id);
    if(el) return el;
    el = document.createElement('div');
    el.id = id;
    el.className = 'm2-card';
    if(before && before.parentNode) before.parentNode.insertBefore(el, before);
    else host.appendChild(el);
    return el;
  }

  function apply(){
    var root = document.getElementById('ppRoot');
    if(!root) return;

    /* ОДНА ссылка, ОДИН калькулятор, ОДИН набор промо на экране.
       До правки кабинет показывал их по три раза подряд: карточка ядра
       (#ppDeep), виджет слоя роста (#okgPartnerHost) и наш блок — три поля
       с одним и тем же адресом и три разных числа в калькуляторе.
       Дубликаты прячем (не удаляем: отключат наш слой — они вернутся). */
    var ladder = document.getElementById('ppLadder');
    setStyle(document.getElementById('ppDeep'), 'display', 'none');
    setStyle(document.getElementById('okgPartnerHost'), 'display', 'none');
    /* «Referral squared» и «Реферальные цели» — две лестницы одних и тех же
       целей. Оставляем полную (3 / 10 / 30 клиентов), вторую прячем. */
    setStyle(document.getElementById('vrRefSquaredCard'), 'display', 'none');
    setHtml(ensure(root, 'm2PpLink', ladder || null), linkHtml());

    /* калькулятор: базовый прячем, ставим свой с открытой формулой */
    var oldCalc = document.getElementById('ppCalc');
    setStyle(oldCalc, 'display', 'none');
    setHtml(ensure(root, 'm2PpCalc', oldCalc || null), calcHtml());

    /* доска лидеров */
    var oldLb = document.getElementById('ppLb');
    var lb = lbHtml();
    if(oldLb){
      if(lb){ setStyle(oldLb, 'display', 'none'); setHtml(ensure(root, 'm2PpLb', oldLb), lb); }
      else { setStyle(oldLb, 'display', ''); var m = document.getElementById('m2PpLb'); if(m) m.remove(); }
    }

    /* выплаты */
    var oldPayTop = document.getElementById('ppPayoutTop');
    setStyle(oldPayTop, 'display', 'none');
    setHtml(ensure(root, 'm2PpPayout', oldPayTop || null), payoutHtml());

    /* история начислений */
    var oldHist = document.getElementById('ppHistory');
    setStyle(oldHist, 'display', 'none');
    setHtml(ensure(root, 'm2PpHist', oldHist || null), historyHtml());

    /* условия программы — перед гайдом «как начать» */
    var guide = document.getElementById('ppGuide');
    setHtml(ensure(root, 'm2PpTerms', guide || null), termsHtml());
  }

  function init(){
    watch('#screen-partner', apply);
    onTab(function(t){ if(t === 'partner') apply(); });
  }

  return {init:init};
})();

/* ===========================================================================
   5. РЕКЛАМА
   =========================================================================== */

var ADSM = (function(){

  /* Кабинет без бэкенда не может ни показывать объявления, ни списывать
     деньги «за показы». Поэтому: кампания сохраняется черновиком, кошелёк не
     трогаем, метрики не выдумываем. */

  var MIGR = 'ads-honest-v1';

  function stopSimulation(){
    /* ядро зовёт setInterval(function(){ (window.adsTick||adsTick)(); }) —
       подменяем adsTick на пустышку, симуляция показов останавливается */
    window.adsTick = function(){};
  }

  function migrate(){
    if(load(MIGR, 0) === 1) return;
    try{
      if(typeof ADS !== 'undefined' && ADS && Array.isArray(ADS.camps)){
        ADS.camps.forEach(function(c){
          if(!c) return;
          /* накрученные показы/клики/расход — это не данные, а симуляция */
          c.imps = 0; c.clicks = 0; c.spent = 0; c.spentToday = 0;
          c.hist = []; c.days = [];
          if(c.ab){ c.ab.a = {i:0, c:0}; c.ab.b = {i:0, c:0}; }
          c.status = 'draft';
          if(typeof adsPullFromFeed === 'function'){ try{ adsPullFromFeed(c); }catch(e){} }
        });
        if(typeof adsSave === 'function') adsSave();
      }
    }catch(e){}
    save(MIGR, 1);
  }

  function camps(){
    try{ return (typeof ADS !== 'undefined' && ADS && Array.isArray(ADS.camps)) ? ADS.camps : []; }
    catch(e){ return []; }
  }

  /* --- 5.1 честная шапка ------------------------------------------------- */
  function head(){
    var chip = document.getElementById('adsLive');
    if(chip){
      setHtml(chip, ic('lock') + 'черновики');
      chip.setAttribute('title', 'Показов пока нет: рекламная сеть включится вместе с бэкендом');
      setStyle(chip, 'color', 'var(--dim)');
    }
    var sum = document.getElementById('adsSummary');
    if(sum){
      var n = camps().length;
      setHtml(sum,
        '<div class="m2-cell"><b>' + n + '</b><span>' + plural(n, 'черновик', 'черновика', 'черновиков') + '</span></div>' +
        '<div class="m2-cell"><b>0</b><span>показов</span></div>' +
        '<div class="m2-cell"><b>0</b><span>кликов</span></div>' +
        '<div class="m2-cell"><b>' + rub(0) + '</b><span>потрачено</span></div>');
      setStyle(sum, 'display', 'grid');
      setStyle(sum, 'gridTemplateColumns', 'repeat(auto-fit,minmax(132px,1fr))');
      setStyle(sum, 'gap', '8px');
    }
  }

  /* --- 5.2 что произойдёт после запуска ---------------------------------- */
  function statusHtml(){
    return '<div class="m2-h">' + ic('megaphone') + '<span>Кабинет в режиме черновиков</span></div>' +
      '<p class="m2-sub">Рекламная сеть OKO ещё не запущена: объявления никому не ' +
      'показываются, деньги за них не списываются, статистика не начисляется. ' +
      'Всё, что ты соберёшь здесь сейчас, сохранится и будет готово к первому дню.</p>' +
      '<div class="m2-steps" style="margin-top:10px">' +
        '<div class="m2-step"><span class="m2-step-n"></span><div class="m2-step-b">' +
          '<b>Сейчас: собираешь кампанию</b>' +
          '<span>Формат, креатив, аудитория, бюджет и ставка. Черновик лежит на этом устройстве, ' +
          'его можно править и дублировать сколько угодно.</span></div></div>' +
        '<div class="m2-step"><span class="m2-step-n"></span><div class="m2-step-b">' +
          '<b>На запуске: модерация</b>' +
          '<span>Черновики уедут на проверку командой OKO — тематика, обещания, ссылки. ' +
          'Отклонённые вернутся с причиной, править можно тут же.</span></div></div>' +
        '<div class="m2-step"><span class="m2-step-n"></span><div class="m2-step-b">' +
          '<b>Потом: списание и показы</b>' +
          '<span>Бюджет спишется с лицевого счёта <b>в момент старта</b>, а не сейчас. ' +
          'Открутка идёт по факту показов, остаток всегда возвращается на счёт.</span></div></div>' +
        '<div class="m2-step"><span class="m2-step-n"></span><div class="m2-step-b">' +
          '<b>И дальше: статистика</b>' +
          '<span>Показы, клики, CTR и расход — только настоящие, из рекламной сети. ' +
          'До этого момента здесь честные нули.</span></div></div>' +
      '</div>';
  }

  /* --- 5.3 честный расчёт бюджета ---------------------------------------- */
  var BUD = load('ads-budget', 3000);

  /* Вилка, а не одно число: CPM берём из прайса размещения, CTR — из
     диапазона, в который укладывается живая лента. Регистрации и продажи
     не считаем принципиально — они зависят от оффера, а не от рекламы. */
  var CPM_LO = 22, CPM_HI = 38, CTR_LO = 0.8, CTR_HI = 3.0;

  /* прикидка — не бухгалтерия: округляем, чтобы «78 947» не выглядело
     точным расчётом там, где точности нет и быть не может */
  function round2(n){
    n = Math.max(0, Math.round(n));
    if(n >= 10000) return Math.round(n / 1000) * 1000;
    if(n >= 1000)  return Math.round(n / 100) * 100;
    if(n >= 100)   return Math.round(n / 10) * 10;
    return n;
  }
  function calcOut(b){
    var impsHi = round2(b / CPM_LO * 1000);
    var impsLo = round2(b / CPM_HI * 1000);
    var clicksLo = round2(impsLo * CTR_LO / 100);
    var clicksHi = round2(impsHi * CTR_HI / 100);
    var cpcLo = clicksHi ? Math.max(1, Math.round(b / clicksHi)) : 0;
    var cpcHi = clicksLo ? Math.max(1, Math.round(b / clicksLo)) : 0;
    return '<div class="m2-row"><span>Показы при CPM ' + CPM_LO + '–' + CPM_HI + ' ₽</span>' +
        '<b>' + num(impsLo) + '–' + num(impsHi) + '</b></div>' +
      '<div class="m2-row"><span>Клики при CTR ' + CTR_LO + '–' + CTR_HI + '%</span>' +
        '<b>' + num(clicksLo) + '–' + num(clicksHi) + '</b></div>' +
      '<div class="m2-row"><span>Цена клика</span><b>' + num(cpcLo) + '–' + rub(cpcHi) + '</b></div>';
  }

  function calcHtml(){
    var b = Math.max(300, Math.min(20000, fin(BUD, 3000)));
    BUD = b;
    return '<div class="m2-h">' + ic('poll') + '<span>Сколько это даст</span></div>' +
      '<p class="m2-sub">Прикидка по прайсу размещения, а не прогноз по твоей аудитории. ' +
      'Никто не знает заранее, как сработает конкретный креатив, — поэтому здесь вилка, ' +
      'а не одно красивое число.</p>' +
      '<div class="m2-calc-line"><span class="m2-calc-lbl">Бюджет кампании</span>' +
        '<b style="font-size:17px;font-weight:800;color:var(--accent);white-space:nowrap" id="m2AdsB">' + rub(b) + '</b></div>' +
      '<input type="range" class="m2-range" min="300" max="20000" step="100" value="' + b + '" ' +
        'id="m2AdsRange" oninput="okoM2AdsBudget(this.value)">' +
      '<div class="m2-rows" id="m2AdsOut">' + calcOut(b) + '</div>' +
      '<div class="m2-note">' + ic('info') +
        '<p>Регистрации и продажи мы намеренно <b>не считаем</b>: они зависят от твоего ' +
        'оффера и посадочной, а не от рекламы. Обещать их числом было бы враньём.</p></div>' +
      '<button class="m2-btn" type="button" style="margin-top:10px" onclick="okoM2AdsCreate()">' +
        ic('plus') + '<span id="m2AdsGo">Собрать кампанию на ' + rub(b) + '</span></button>';
  }

  /* обновляем только числа — перерисовка целиком рвала бы перетаскивание */
  window.okoM2AdsBudget = function(v){
    BUD = Math.max(300, Math.min(20000, parseInt(v, 10) || 300));
    save('ads-budget', BUD);
    var b = document.getElementById('m2AdsB');
    if(b) b.textContent = rub(BUD);
    var out = document.getElementById('m2AdsOut');
    if(out) out.innerHTML = calcOut(BUD);
    var go = document.getElementById('m2AdsGo');
    if(go) go.textContent = 'Собрать кампанию на ' + rub(BUD);
    /* запоминаем актуальную разметку, чтобы наблюдатель не перерисовал
       карточку целиком и не сбросил положение ползунка под пальцем */
    var host = document.getElementById('m2AdsCalc');
    if(host) host.__m2html = calcHtml();
  };
  window.okoM2AdsCreate = function(){
    if(typeof adsOpenCreate === 'function'){
      adsOpenCreate();
      setTimeout(function(){
        var bi = document.getElementById('adsInpBudget');
        if(bi) bi.value = BUD;
        var bs = document.getElementById('adsBudgetSlider');
        if(bs) bs.value = Math.min(100000, BUD);
      }, 40);
    } else say('Мастер кампаний ещё загружается');
  };

  /* --- 5.4 черновик вместо «запуска» -------------------------------------- */
  function saveDraft(){
    var g = function(id){ var e = document.getElementById(id); return e ? String(e.value || '').trim() : ''; };
    var name = g('adsInpTitle'), text = g('adsInpText');
    var link = g('adsInpLink');
    var budget = Math.max(0, parseInt(g('adsInpBudget'), 10) || 0);
    var bid = Math.max(1, parseInt(g('adsInpBid'), 10) || 1);

    if(!name || !text){
      if(typeof adsStep === 'function') adsStep(2);
      say('Заполни заголовок и текст объявления');
      return;
    }
    if(budget < 100){ say('Минимальный бюджет — 100 ₽'); return; }
    if(link && !/^https?:\/\//i.test(link)) link = 'https://' + link;

    var d = (typeof adsDraft !== 'undefined' && adsDraft) ? adsDraft : {};
    var camp = {
      id: (typeof ADS !== 'undefined' && ADS.seq) ? ADS.seq++ : Date.now(),
      name:name, text:text, link:link, cta:d.cta, goal:d.goal || 'sales',
      fmt:d.fmt, model:d.model, bid:bid, budget:budget,
      sex:d.sex, geo:d.geo, cities:(d.cities || []).slice(),
      interests:(typeof adsPicked === 'function' ? adsPicked('adsIntChips') : []),
      ageMin:d.ageMin || 18, ageMax:d.ageMax || 45,
      devs:(typeof adsPicked === 'function' ? adsPicked('adsDevChips') : []),
      weekdays:Array.isArray(d.weekdays) ? d.weekdays.slice() : [1,2,3,4,5,6,0],
      hourFrom:d.hourFrom || 0, hourTo:d.hourTo || 24,
      media:d.media ? Object.assign({}, d.media) : null,
      spent:0, imps:0, clicks:0, hist:[], days:[],
      status:'draft', created:Date.now()
    };
    try{
      if(typeof ADS !== 'undefined' && ADS && Array.isArray(ADS.camps)){
        var editId = (typeof adsEditId !== 'undefined') ? adsEditId : 0;
        if(editId){
          var idx = ADS.camps.findIndex(function(c){ return c && c.id === editId; });
          if(idx >= 0){ camp.id = editId; ADS.camps[idx] = Object.assign(ADS.camps[idx], camp); }
          else ADS.camps.unshift(camp);
          try{ adsEditId = 0; }catch(e){}
        } else ADS.camps.unshift(camp);
        if(typeof adsSave === 'function') adsSave();
      }
    }catch(e){}
    if(typeof d === 'object') d.media = null;
    if(typeof closeSheet === 'function') closeSheet();
    render();
    if(typeof showPopup === 'function'){
      showPopup({
        ico:'check',
        title:'Черновик сохранён',
        body:'«' + E(name) + '» лежит в кабинете с бюджетом ' + rub(budget) + '. ' +
             '<b>Деньги не списаны</b> и показов не будет: рекламная сеть OKO ещё не запущена. ' +
             'На старте черновик уйдёт на модерацию, и только после неё бюджет спишется ' +
             'с лицевого счёта.',
        actions:[{label:'Понятно'}]
      });
    } else say('Черновик сохранён — деньги не списаны');
  }

  function patchWizard(){
    window.adsLaunch = saveDraft;
    window.adsSaveEdit = saveDraft;
    /* «Запустить» в мастере называем тем, чем оно является */
    if(typeof window.adsLaunchLabel === 'function' && !window.adsLaunchLabel.__m2){
      window.adsLaunchLabel = function(){ return 'Сохранить черновик'; };
      window.adsLaunchLabel.__m2 = true;
    }
    qa('.ads-launch, #adsLaunchBtn').forEach(function(b){
      if(b.dataset.m2) return;
      if(!/запуст|оплат/i.test(b.textContent || '')) return;
      b.dataset.m2 = '1';
      b.innerHTML = ic('check') + 'Сохранить черновик';
    });
    /* модерация без бэкенда невозможна — глушим, чтобы не «одобряла» сама */
    window.adsModerate = function(){};

    /* «Прогноз охвата» в мастере считался от 11,8 млн жителей России — это
       размер страны, а не аудитории OKO. Показывать такое число рекламодателю
       нельзя. Сохраняем сам таргетинг, но подпись делаем честной. */
    if(typeof window.adsCalcReach === 'function' && !window.adsCalcReach.__m2){
      var prevReach = window.adsCalcReach;
      window.adsCalcReach = function(){
        var r = prevReach.apply(this, arguments);
        try{
          var v = document.getElementById('adsReachV');
          if(v){ v.textContent = '—'; v.style.fontSize = '30px'; }
          var s = document.getElementById('adsReachS');
          if(s){
            var bits = s.textContent || '';
            s.innerHTML = '<b style="color:var(--text)">' + E(bits) + '</b><br>' +
              'Охват появится, когда в ленте будут живые люди. Пока сеть не запущена, ' +
              'честного числа нет — прежнее считалось от населения страны, а не от аудитории OKO.';
            s.style.lineHeight = '1.5';
            s.style.whiteSpace = 'normal';
          }
          var bar = document.getElementById('adsReachBar');
          if(bar) bar.style.width = '0%';
        }catch(e){}
        return r;
      };
      window.adsCalcReach.__m2 = true;
    }

    /* Прогноз кампании на шаге бюджета. Цена клика и цена тысячи показов —
       это прайс, их оставляем. Показы и клики считались от несуществующей
       аудитории — ставим прочерк. Списание сейчас равно нулю. */
    if(typeof window.adsCalcForecast === 'function' && !window.adsCalcForecast.__m2){
      var prevFc = window.adsCalcForecast;
      window.adsCalcForecast = function(){
        var r = prevFc.apply(this, arguments);
        try{
          ['adsFImps', 'adsFClicks'].forEach(function(id){
            var el = document.getElementById(id);
            if(el && el.textContent !== '—') el.textContent = '—';
          });
          var ch = document.getElementById('adsFCharge');
          if(ch && ch.textContent !== 'сейчас 0 ₽'){
            ch.textContent = 'сейчас 0 ₽';
            ch.style.whiteSpace = 'normal';
          }
          var box = document.querySelector('#adsStep4 .ads-forecast');
          if(box && !box.dataset.m2){
            box.dataset.m2 = '1';
            var n = document.createElement('div');
            n.className = 'm2-note';
            n.innerHTML = ic('info') +
              '<p>Показы и клики появятся, когда рекламная сеть заработает. Считать их ' +
              'сейчас не от чего, поэтому — прочерк. Цена клика и тысячи показов взяты ' +
              'из прайса размещения. <b>Бюджет спишется в день старта, не раньше.</b></p>';
            box.appendChild(n);
          }
        }catch(e){}
        return r;
      };
      window.adsCalcForecast.__m2 = true;
    }

    /* Boost поста: раньше списывал деньги и обещал «показ через несколько
       секунд». Показывать пост некому — сохраняем черновик продвижения. */
    if(typeof window.adsBoostConfirm === 'function' && !window.adsBoostConfirm.__m2){
      window.adsBoostConfirm = function(){
        var daily = 0, days = 1, postId = 0;
        try{ daily = fin(ADS_BOOST.budget, 0); days = fin(ADS_BOOST.days, 1); postId = ADS_BOOST.postId; }catch(e){}
        var budget = Math.max(0, daily * days);
        try{
          if(typeof ADS !== 'undefined' && ADS && Array.isArray(ADS.camps)){
            ADS.camps.unshift({
              id: ADS.seq ? ADS.seq++ : Date.now(),
              name: 'Продвижение поста', text: 'Пост из ленты OKO.',
              cta:'Открыть', link:'', fmt:'post', model:'CPM', bid:28,
              budget:budget, spent:0, imps:0, clicks:0, hist:[], days:[],
              cities:[], interests:[], devs:[], ageMin:18, ageMax:45,
              status:'draft', created:Date.now(), boostedPostId:postId
            });
            if(typeof adsSave === 'function') adsSave();
          }
        }catch(e){}
        if(typeof closePopup === 'function') closePopup();
        render();
        if(typeof showPopup === 'function'){
          showPopup({ico:'check', title:'Продвижение сохранено черновиком',
            body:'Пост записан в кабинет с бюджетом ' + rub(budget) + '. <b>Деньги не списаны</b>: ' +
                 'рекламная сеть OKO ещё не запущена, показывать объявление пока некому. ' +
                 'Черновик уйдёт на модерацию в день старта.',
            actions:[{label:'Понятно'}]});
        }
      };
      window.adsBoostConfirm.__m2 = true;
    }

    /* пополнение бюджета черновика — тоже без списания */
    if(typeof window.adsTopupDo === 'function' && !window.adsTopupDo.__m2){
      window.adsTopupDo = function(id, sum){
        try{
          var c = camps().find(function(x){ return x && x.id === id; });
          if(c) c.budget = fin(c.budget, 0) + fin(sum, 0);
          if(typeof adsSave === 'function') adsSave();
        }catch(e){}
        if(typeof closePopup === 'function') closePopup();
        render();
        say('Бюджет черновика увеличен на ' + rub(sum) + ' — списания не было');
      };
      window.adsTopupDo.__m2 = true;
    }
  }

  /* --- 5.5 список кампаний ------------------------------------------------ */
  function listHtml(){
    var list = camps();
    if(!list.length){
      return '<div class="m2-empty">' +
        '<span class="m2-empty-ic">' + ic('megaphone') + '</span>' +
        '<b>Черновиков пока нет</b>' +
        '<span>Собери первую кампанию — она сохранится здесь и будет готова уйти ' +
        'на модерацию в день запуска рекламной сети.</span>' +
        '<button class="m2-btn" type="button" style="margin-top:12px;max-width:280px" ' +
        'onclick="okoM2AdsCreate()">' + ic('plus') + 'Собрать кампанию</button>' +
        '</div>';
    }
    var fmtLbl = function(k){
      try{ return (ADS_FORMATS[k] || {}).l || k || 'формат не выбран'; }catch(e){ return k || ''; }
    };
    return '<div class="m2-list">' + list.map(function(c){
      var geo = (c.cities && c.cities.length) ? c.cities.join(', ') : 'вся Россия';
      return '<div class="m2-item"><div class="m2-item-b">' +
        '<b>' + E(c.name || 'Без названия') + '</b>' +
        '<div class="m2-item-m">' +
          '<span class="m2-badge wait">Черновик</span>' +
          '<small>' + E(fmtLbl(c.fmt)) + '</small>' +
          '<small>' + E(c.model || 'CPM') + ' · ставка ' + rub(fin(c.bid, 0)) + '</small>' +
          '<small>' + E(geo) + ' · ' + fin(c.ageMin, 18) + '–' + fin(c.ageMax, 45) + ' лет</small>' +
        '</div></div>' +
        '<div class="m2-item-x"><span class="m2-item-sum">' + rub(fin(c.budget, 0)) + '</span>' +
        '<button class="m2-btn mute" type="button" style="min-height:32px;padding:6px 10px;font-size:11.5px" ' +
          'onclick="okoM2AdsEdit(' + c.id + ')">' + ic('edit') + 'Править</button>' +
        '<button class="m2-btn mute" type="button" style="min-height:32px;padding:6px 10px;font-size:11.5px" ' +
          'onclick="okoM2AdsDel(' + c.id + ')">' + ic('trash') + 'Удалить</button></div>' +
        '</div>';
    }).join('') + '</div>';
  }

  window.okoM2AdsEdit = function(id){
    /* adsEdit() ядра открывает мастер и заполняет поля кампанией */
    try{ if(typeof adsEdit === 'function'){ adsEdit(id); return; } }catch(e){}
    try{ if(typeof adsOpenCreate === 'function'){ adsOpenCreate(); return; } }catch(e){}
    say('Редактор кампании недоступен');
  };
  window.okoM2AdsDel = function(id){
    try{
      if(typeof ADS !== 'undefined' && ADS && Array.isArray(ADS.camps)){
        var i = ADS.camps.findIndex(function(c){ return c && c.id === id; });
        if(i >= 0) ADS.camps.splice(i, 1);
        if(typeof adsSave === 'function') adsSave();
      }
    }catch(e){}
    render();
    say('Черновик удалён');
  };

  /* --- 5.6 сборка экрана --------------------------------------------------- */
  function ensure(pad, id, before){
    var el = document.getElementById(id);
    if(el) return el;
    el = document.createElement('div');
    el.id = id;
    el.className = 'm2-card';
    if(before && before.parentNode) before.parentNode.insertBefore(el, before);
    else pad.appendChild(el);
    return el;
  }

  function render(){
    var pad = q('#screen-ads .pad');
    if(!pad) return;

    head();

    /* блоки ядра, которые без бэкенда показывают выдуманные числа:
       «скидка тарифа уже применяется» (списаний нет), живые подсказки по
       кампаниям, рекомендации по постам и топ-3 креатива по CTR (метрик нет). */
    ['adsTier', 'adsCalc', 'adsLiveTip', 'adsPromoRecs', 'adsTop3'].forEach(function(id){
      setStyle(document.getElementById(id), 'display', 'none');
    });
    /* Шаблоны кампаний оставляем: это прайс и заготовки текстов, а не
       обещание результата. Уточняем подпись, чтобы ставку не приняли за факт. */
    var presets = document.getElementById('adsPresetsWrap');
    if(presets){
      var ph = presets.querySelector('.ads-presets-h small');
      if(ph && ph.textContent !== 'клик заполняет мастер · ставки ориентировочные') {
        ph.textContent = 'клик заполняет мастер · ставки ориентировочные';
      }
    }
    setStyle(pad.querySelector('.ads-ai-note'), 'display', 'none');
    var quickSpent = document.getElementById('adsQuickSpent');
    if(quickSpent && quickSpent.textContent !== rub(0)) quickSpent.textContent = rub(0);

    var createBtn = pad.querySelector('.ads-create-btn');
    if(createBtn && !createBtn.dataset.m2){
      createBtn.dataset.m2 = '1';
      createBtn.innerHTML = ic('plus') + 'Собрать кампанию';
    }

    /* статус кабинета — сразу под сводкой */
    var anchor = document.getElementById('adsSummary');
    setHtml(ensure(pad, 'm2AdsStatus', anchor ? anchor.nextSibling : null), statusHtml());

    /* честная прикидка бюджета — на месте старого калькулятора */
    var oldCalc = document.getElementById('adsCalc');
    setHtml(ensure(pad, 'm2AdsCalc', oldCalc || null), calcHtml());

    /* список черновиков вместо «Кампании» */
    var oldList = document.getElementById('adsList');
    if(oldList){
      setStyle(oldList, 'display', 'none');
      setHtml(ensure(pad, 'm2AdsList', oldList), listHtml());
    }

    patchWizard();
  }

  function init(){
    stopSimulation();
    migrate();
    /* Сводку и список кабинет ядра перерисовывает на каждом заходе с
       анимацией счётчиков. Отдаём эти два рендера себе — иначе на секунду
       мелькают старые «живые метрики», которых на самом деле нет. */
    window.adsRenderSummary = head;
    window.adsRenderList = function(){
      var oldList = document.getElementById('adsList');
      if(oldList) setStyle(oldList, 'display', 'none');
    };
    watch('#screen-ads .pad', function(){ render(); });
    onTab(function(t){ if(t === 'ads') render(); });
    /* мастер живёт в шторке — ловим её открытие */
    watch('#sheet-ads-create', function(){ patchWizard(); });
    render();
  }

  return {init:init, render:render};
})();

/* ===========================================================================
   6. ДОКУМЕНТЫ
   =========================================================================== */

var DOCS = (function(){

  function apply(view){
    if(!view) return;

    /* Кнопка «назад» одна и та же на всё приложение: круглая .oko-back из
       oko-back.js. Она же делает шаг «документ → список» — свой обработчик
       вешать нельзя, иначе шаг выполнится дважды. Здесь только следим, что
       кнопка на месте и подписана, а пилюля «к списку» скрыта стилем. */
    var back = view.querySelector('.sv-head .ep-cancel');
    if(back && !back.dataset.m2){
      back.dataset.m2 = '1';
      back.setAttribute('aria-label', 'Назад');
      back.setAttribute('title', 'Назад');
      if(!back.classList.contains('oko-back')) back.classList.add('oko-back');
    }

    /* заголовок раздела не должен обрезаться */
    var b = view.querySelector('.sv-head > b');
    if(b && !b.dataset.m2){
      b.dataset.m2 = '1';
      b.style.whiteSpace = 'normal';
      b.style.overflow = 'visible';
      b.style.textOverflow = 'clip';
      b.style.lineHeight = '1.15';
    }

    /* длинные ссылки, ИНН и адреса — переносим по символам явным классом */
    qa('.lg-req, .lg-hub-op, .lg-doc a[href]', view).forEach(function(e){
      if(!e.classList.contains('oko-breakable')) e.classList.add('oko-breakable');
    });

    /* реквизиты внутри документа — отдельной читаемой карточкой */
    var req = view.querySelector('.lg-doc .lg-req');
    if(req && !req.dataset.m2){
      req.dataset.m2 = '1';
      req.style.overflowWrap = 'anywhere';
      req.style.lineHeight = '1.7';
    }
  }

  function init(){
    watch('#legalView', apply);
    /* модуль открывается не через showTab — ловим сам факт открытия */
    var tries = 0;
    (function grab(){
      if(typeof window.openLegalHub !== 'function' && typeof window.openLegalDoc !== 'function'){
        if(++tries < 80) return setTimeout(grab, 200);
        return;
      }
      ['openLegalHub', 'openLegalDoc', 'lgBackToHub', 'lgSetLang'].forEach(function(fn){
        if(typeof window[fn] !== 'function') return;
        var prev = window[fn];
        window[fn] = function(){
          var r = prev.apply(this, arguments);
          setTimeout(function(){ apply(document.getElementById('legalView')); }, 30);
          setTimeout(function(){ apply(document.getElementById('legalView')); }, 260);
          return r;
        };
      });
    })();
  }

  return {init:init};
})();

/* ===========================================================================
   7. TON ПОДАРКИ
   =========================================================================== */

var TON = (function(){

  function connected(){
    try{ return !!(typeof VS_TON !== 'undefined' && VS_TON && VS_TON.connected); }catch(e){ return false; }
  }

  /* --- 7.1 шапка кошелька: без выдуманного адреса ------------------------ */
  function apply(root){
    if(!root) return;

    /* Строка «UQT26j…sC6r» выглядела как настоящий адрес TON, хотя это
       случайные символы: перевести на неё нельзя. Подпись честная — сам
       текст даёт vsTonAddrShort(), подменённый ниже. */
    var addr = root.querySelector('.vs-ton-addr');
    if(addr && !connected() && !addr.dataset.m2){
      addr.dataset.m2 = '1';
      addr.classList.add('m2-ton-addr-off');
    }

    /* кнопка «Биржа» ведёт на прайс: торгов между людьми пока нет */
    var mk = root.querySelector('.vs-ton-act-market span');
    if(mk && mk.textContent !== 'Прайс') mk.textContent = 'Прайс';

    /* бейдж «TON · прототип» оставляем, но делаем формулировку однозначной */
    var badge = root.querySelector('.vs-ton-badge');
    if(badge && !badge.dataset.m2){
      badge.dataset.m2 = '1';
      badge.setAttribute('title', 'Баланс и подарки хранятся на этом устройстве');
    }

    /* нижняя подпись — самое важное про раздел, поднимаем её выше витрины */
    var foot = root.querySelector('.vs-ton-foot');
    if(foot && !foot.dataset.m2){
      foot.dataset.m2 = '1';
      foot.innerHTML = ic('lock') +
        ' Раздел работает как честный прототип: баланс TON, покупки и коллекция ' +
        'хранятся только на этом устройстве. Настоящих переводов в сети TON ' +
        'и NFT-подарков пока нет — они включатся в релизе через TON Connect.';
    }

    /* карточка «что здесь работает, а что нет» */
    var tabs = root.querySelector('.vs-ton-tabs');
    if(tabs && !document.getElementById('m2TonWhat')){
      var card = document.createElement('div');
      card.className = 'm2-card';
      card.id = 'm2TonWhat';
      tabs.parentNode.insertBefore(card, tabs);
    }
    var what = document.getElementById('m2TonWhat');
    setHtml(what, whatHtml());
  }

  function whatHtml(){
    var bal = 0, owned = 0, tx = 0;
    try{ bal = fin(VS_TON.balance, 0); }catch(e){}
    try{ owned = (typeof vsOwnedTotal === 'function') ? fin(vsOwnedTotal(), 0) : 0; }catch(e){}
    try{ tx = (VS_TON.tx || []).length; }catch(e){}

    return '<div class="m2-h">' + ic('ton') + '<span>Что уже работает</span></div>' +
      '<div class="m2-grid">' +
        '<div class="m2-cell hi"><b>' + (Math.round(bal * 100) / 100) + '</b><span>TON на балансе</span></div>' +
        '<div class="m2-cell"><b>' + owned + '</b><span>подарков</span></div>' +
        '<div class="m2-cell"><b>' + tx + '</b><span>операций</span></div>' +
      '</div>' +
      '<div class="m2-rows">' +
        '<div class="m2-row"><span>Витрина подарков и цены</span><b>работает</b></div>' +
        '<div class="m2-row"><span>Покупка за TON с кошелька OKO</span><b>работает</b></div>' +
        '<div class="m2-row"><span>Подарок другу в чат</span><b>работает</b></div>' +
        '<div class="m2-row"><span>Пополнение с лицевого счёта</span><b>работает</b></div>' +
        '<div class="m2-row"><span>Перевод в сеть TON</span><b>после TON Connect</b></div>' +
        '<div class="m2-row"><span>Приём TON извне</span><b>после TON Connect</b></div>' +
        '<div class="m2-row"><span>NFT-подарки на блокчейне</span><b>после TON Connect</b></div>' +
      '</div>' +
      '<div class="m2-note">' + ic('info') +
        '<p>Курс <b>1 TON ≈ ' + rub(rate()) + '</b> зафиксирован в прототипе. В релизе он станет ' +
        'живым, а баланс переедет в подключённый кошелёк — покупать заново ничего не придётся.</p></div>';
  }
  function rate(){
    try{ if(typeof VS_TON_RATE !== 'undefined') return fin(VS_TON_RATE, 320); }catch(e){}
    return 320;
  }

  /* --- 7.2 честные шторки: получить / отправить -------------------------- */
  function patchSheets(){
    /* подпись адреса в шапке кошелька */
    if(typeof window.vsTonAddrShort === 'function' && !window.vsTonAddrShort.__m2){
      var prevAddr = window.vsTonAddrShort;
      window.vsTonAddrShort = function(){
        if(connected()) return prevAddr.apply(this, arguments);
        return 'TON Connect не подключён';
      };
      window.vsTonAddrShort.__m2 = true;
    }

    /* «Получить»: вместо QR с выдуманным адресом — объяснение */
    if(typeof window.vsRenderRecv === 'function' && !window.vsRenderRecv.__m2){
      window.vsRenderRecv = function(){
        var v = document.getElementById('vsRecvView');
        if(!v) return;
        v.innerHTML = '<div class="m2-empty">' +
          '<span class="m2-empty-ic">' + ic('vs-recv') + '</span>' +
          '<b>Адреса для приёма пока нет</b>' +
          '<span>Свой адрес в сети TON появится, когда подключишь кошелёк через TON Connect — ' +
          'Tonkeeper или Wallet, в один тап. Показывать сейчас случайную строку вида «UQ…» ' +
          'мы не будем: по ней ничего не придёт.</span>' +
          '</div>' +
          '<div class="m2-note">' + ic('plus') +
            '<p>Пополнить баланс прототипа можно с лицевого счёта OKO — кнопка ' +
            '<b>«Пополнить»</b> на карточке кошелька.</p></div>' +
          '<button class="m2-btn" type="button" style="margin-top:10px" ' +
            'onclick="closeSheet();if(typeof vsOpenTopup===\'function\')vsOpenTopup()">' +
            ic('plus') + 'Пополнить с кошелька OKO</button>';
      };
      window.vsRenderRecv.__m2 = true;
    }

    /* «Отправить»: не пишем «Отправлено» — этого не произошло */
    if(typeof window.vsDoSendTon === 'function' && !window.vsDoSendTon.__m2){
      var prev = window.vsDoSendTon;
      window.vsDoSendTon = function(){
        var amt = 0;
        try{ amt = fin(VS_SEND_AMT, 0); }catch(e){}
        var r = prev.apply(this, arguments);
        setTimeout(function(){
          if(typeof showPopup === 'function'){
            showPopup({
              ico:'lock',
              title:'Списано в прототипе',
              body:(Math.round(amt * 100) / 100) + ' TON сняты с локального баланса и записаны в историю ' +
                   'этого устройства. <b>В сеть TON перевод не ушёл</b> — настоящие транзакции ' +
                   'включатся в релизе вместе с TON Connect.',
              actions:[{label:'Понятно'}]
            });
          }
        }, 60);
        return r;
      };
      window.vsDoSendTon.__m2 = true;
    }

    /* ------- Биржа подарков: ноль выдуманных ордеров -------
       Раньше здесь были «живые ордера покупки/продажи между пользователями»:
       флор-цены, проценты за сутки, спарклайны и офферы от людей, которых не
       существует (список владельцев пуст — имена вообще приходили как
       undefined и роняли шторку). Показываем настоящий прайс каталога. */
    if(typeof window.vsPriceHistory === 'function' && !window.vsPriceHistory.__m2){
      window.vsPriceHistory = function(){ return []; };
      window.vsPriceHistory.__m2 = true;
    }
    if(typeof window.vsSparklineSvg === 'function' && !window.vsSparklineSvg.__m2){
      window.vsSparklineSvg = function(){ return ''; };   /* графика цен нет — рисовать нечего */
      window.vsSparklineSvg.__m2 = true;
    }

    if(typeof window.vsOpenMarket === 'function' && !window.vsOpenMarket.__m2){
      window.vsOpenMarket = function(){
        var v = document.getElementById('vsMarketView');
        if(!v) return say('Биржа подарков откроется в релизе');
        var list = [];
        try{ list = (typeof VS_GIFTS !== 'undefined' && VS_GIFTS) ? VS_GIFTS.slice() : []; }catch(e){}
        list.sort(function(a, b){ return fin(a.price, 0) - fin(b.price, 0); });
        var rows = list.map(function(g){
          var art = '';
          try{ art = vsGiftSvg(g.art, 40); }catch(e){}
          return '<div class="m2-item"><div class="m2-item-b" style="display:flex;gap:10px;align-items:center">' +
            art + '<div style="min-width:0"><b>' + E(g.name) + '</b>' +
            '<div class="m2-item-m"><small>тираж ' + num(fin(g.supply, 0)) + ' · продано ' + num(fin(g.sold, 0)) + '</small></div>' +
            '</div></div>' +
            '<div class="m2-item-x"><span class="m2-item-sum">' + (Math.round(fin(g.price, 0) * 100) / 100) + ' TON</span>' +
            '<small style="font-size:11px;color:var(--dim)">' + rub(Math.round(fin(g.price, 0) * rate())) + '</small></div>' +
            '</div>';
        }).join('');
        v.innerHTML = '<div class="m2-h">' + ic('mk-tag') + '<span>Прайс подарков</span></div>' +
          '<p class="m2-sub">Это цены выпуска — по ним подарок покупается в магазине. ' +
          '<b>Вторичного рынка пока нет:</b> ни ордеров, ни сделок между людьми, ' +
          'ни истории цен. Раньше здесь показывались выдуманные ордера — мы их убрали.</p>' +
          '<div class="m2-list">' + rows + '</div>' +
          '<div class="m2-note">' + ic('lock') +
            '<p>P2P-биржа с эскроу в сети TON включится в релизе вместе с TON Connect. ' +
            'Тогда флор, объём и история сделок будут настоящими.</p></div>';
        /* шторка называлась «Биржа подарков», хотя биржи ещё нет */
        var h = q('#sheet-vs-market > h3');
        if(h && h.textContent !== 'Прайс подарков') h.textContent = 'Прайс подарков';
        if(typeof openSheet === 'function') openSheet('vs-market');
      };
      window.vsOpenMarket.__m2 = true;
    }

    if(typeof window.vsOpenOffers === 'function' && !window.vsOpenOffers.__m2){
      window.vsOpenOffers = function(giftId){
        var v = document.getElementById('vsOffersView');
        if(!v) return;
        var g = null;
        try{ g = vsGiftById(giftId); }catch(e){}
        v.innerHTML = '<div class="m2-empty">' +
          '<span class="m2-empty-ic">' + ic('mk-tag') + '</span>' +
          '<b>Ордеров нет</b>' +
          '<span>' + (g ? '«' + E(g.name) + '» ещё' : 'Подарки ещё') + ' никто не выставлял на продажу — ' +
          'вторичный рынок откроется вместе с P2P-биржей в релизе. Купить по цене выпуска ' +
          'можно прямо сейчас в магазине.</span>' +
          '</div>';
        if(typeof openSheet === 'function') openSheet('vs-offers');
      };
      window.vsOpenOffers.__m2 = true;
    }
    ['vsAcceptOffer', 'vsBuyFromOrder'].forEach(function(fn){
      if(typeof window[fn] === 'function' && !window[fn].__m2){
        window[fn] = function(){ say('Сделок между пользователями пока нет — биржа откроется в релизе'); };
        window[fn].__m2 = true;
      }
    });

    /* карточка подарка: блок «последние продажи» строился на выдуманной
       истории цен — заменяем честной строкой */
    if(typeof window.vsOpenBuy === 'function' && !window.vsOpenBuy.__m2){
      var prevBuy = window.vsOpenBuy;
      window.vsOpenBuy = function(){
        var r = prevBuy.apply(this, arguments);
        setTimeout(function(){
          try{
            var box = q('#vsBuyView .vs-price-hist');
            if(box && !box.dataset.m2){
              box.dataset.m2 = '1';
              box.innerHTML = '<div class="m2-note">' + ic('clock') +
                '<p><b>Сделок ещё не было.</b> История цен появится, когда подарки начнут ' +
                'перепродавать между собой — после запуска биржи. Сейчас доступна только ' +
                'покупка по цене выпуска.</p></div>';
            }
          }catch(e){}
        }, 0);
        return r;
      };
      window.vsOpenBuy.__m2 = true;
    }

    /* карточка NFT: «TON Mainnet» и ссылка в обозреватель по адресу-заглушке */
    if(typeof window.vsOpenNft === 'function' && !window.vsOpenNft.__m2){
      var prevNft = window.vsOpenNft;
      window.vsOpenNft = function(){
        var r = prevNft.apply(this, arguments);
        setTimeout(function(){
          try{
            var v = document.getElementById('vsNftView');
            if(!v || v.dataset.m2) return;
            v.dataset.m2 = '1';
            qa('.vs-nft-row', v).forEach(function(row){
              var k = (row.querySelector('span') || {}).textContent || '';
              var b = row.querySelector('b');
              if(!b) return;
              if(/chain/i.test(k)){ b.textContent = 'сеть не подключена'; b.classList.remove('ok'); }
              if(/владелец/i.test(k) && !/ты/i.test(b.textContent)) b.textContent = '—';
              if(/минт/i.test(k)) b.textContent = '—';
            });
            var link = v.querySelector('.vs-explorer-btn');
            if(link){
              var span = document.createElement('div');
              span.className = 'm2-note';
              span.innerHTML = ic('lock') +
                '<p>Адрес контракта — <b>заглушка прототипа</b>, в обозревателе его нет. ' +
                'Ссылка появится, когда подарки станут настоящими TIP-4-токенами в сети TON.</p>';
              link.parentNode.replaceChild(span, link);
            }
          }catch(e){}
        }, 0);
        return r;
      };
      window.vsOpenNft.__m2 = true;
    }

    /* «Кошелёк» в шапке — честный текст про TON Connect */
    if(typeof window.vsConnectWallet === 'function' && !window.vsConnectWallet.__m2){
      window.vsConnectWallet = function(){
        if(typeof showPopup !== 'function') return say('TON Connect подключается в релизе');
        showPopup({
          ico:'lock',
          title:'TON Connect',
          body:'Подключение внешнего кошелька (Tonkeeper, Wallet) появится в релизе. ' +
               'Тогда подарки станут настоящими NFT в сети TON, а баланс переедет в твой кошелёк. ' +
               'Сейчас всё, что здесь есть, живёт локально на устройстве — <b>это не имитация ' +
               'подключения, а честная заглушка</b>: ни ключей, ни адреса у приложения нет.',
          actions:[{label:'Понятно'}]
        });
      };
      window.vsConnectWallet.__m2 = true;
    }

    /* копирование несуществующего адреса */
    if(typeof window.vsCopyAddr === 'function' && !window.vsCopyAddr.__m2){
      window.vsCopyAddr = function(){
        if(connected()) return say('Адрес скопирован');
        say('Адреса ещё нет — он появится после подключения TON Connect');
      };
      window.vsCopyAddr.__m2 = true;
    }
    if(typeof window.vsShareAddr === 'function' && !window.vsShareAddr.__m2){
      window.vsShareAddr = function(){
        say('Адреса ещё нет — он появится после подключения TON Connect');
      };
      window.vsShareAddr.__m2 = true;
    }
  }

  function init(){
    patchSheets();
    watch('#vsTonRoot', apply);
    onTab(function(t){
      if(t === 'ton'){
        patchSheets();
        var r = document.getElementById('vsTonRoot');
        if(r) apply(r);
      }
    });
  }

  return {init:init};
})();

/* ===========================================================================
   8. СКВОЗНОЙ СЛОЙ: кнопка «назад», безопасные зоны, читаемость
   =========================================================================== */

var COMMON = (function(){

  var SCREENS = ['games', 'partner', 'ads', 'ton'];

  /* Кнопку «назад» на этих экранах ставит oko-back.js. Если по какой-то
     причине её нет (модуль не загрузился) — ставим свою, тем же классом,
     чтобы визуал совпадал до пикселя. */
  function ensureBack(){
    var scr = document.querySelector('.screen.active');
    if(!scr) return;
    var id = String(scr.id || '').replace('screen-', '');
    if(SCREENS.indexOf(id) < 0) return;
    if(document.querySelector('header button.oko-back, #app > button.oko-back, .screen.active button.oko-back')) return;

    var host = document.querySelector('header') || scr;
    var b = document.createElement('button');
    b.type = 'button';
    b.className = 'oko-back m2-back';
    b.setAttribute('aria-label', 'Назад');
    b.innerHTML = ic('back');
    b.onclick = function(){
      if(typeof window.okoBackTo === 'function') return window.okoBackTo();
      var back = {partner:'profile', games:'mini', ads:'mini', ton:'wallet'}[id] || 'mini';
      if(typeof showTab === 'function') showTab(back);
    };
    host.insertBefore(b, host.firstChild);
  }

  /* Заголовки подстраниц: до двух строк с подстройкой кегля, но без обрезания */
  function fitTitles(){
    qa('#screen-games .section-h, #screen-partner .section-h, #screen-ads .section-h').forEach(function(h){
      if(h.dataset.m2fit) return;
      h.dataset.m2fit = '1';
      h.style.whiteSpace = 'normal';
      h.style.overflow = 'visible';
      h.style.textOverflow = 'clip';
      h.style.overflowWrap = 'break-word';
      h.style.hyphens = 'none';
    });
  }

  function init(){
    onTab(function(){ ensureBack(); fitTitles(); });
    setTimeout(function(){ ensureBack(); fitTitles(); }, 800);
    window.addEventListener('resize', debounce(fitTitles, 200));
  }

  return {init:init};
})();

/* ===========================================================================
   9. СТАРТ
   =========================================================================== */

function boot(){
  try{ GAMES.init();   }catch(e){}
  try{ PARTNER.init(); }catch(e){}
  try{ ADSM.init();    }catch(e){}
  try{ DOCS.init();    }catch(e){}
  try{ TON.init();     }catch(e){}
  try{ COMMON.init();  }catch(e){}
}

if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
else boot();

})();
