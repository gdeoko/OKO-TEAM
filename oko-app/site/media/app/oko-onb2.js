/* ============================================================================
   OKO · oko-onb2.js — ПЕРВЫЙ ВХОД, ПОИСК И УВЕДОМЛЕНИЯ
   ----------------------------------------------------------------------------
   Первые тридцать секунд человека в приложении. Файл грузится ПОСЛЕ ядра и
   после всех слоёв: ничего в них не переписывает, только достраивает.

   1. ВХОД. Экран запуска и его 3D-знак не трогаем (oko-eye3d.js / v2eye3d).
      Наша часть — сам сценарий: какая кнопка что реально делает.
        • Telegram    — входим только если под нами настоящий Telegram Mini App
                        (есть initDataUnsafe.user). В обычном браузере честно
                        объясняем, почему нельзя, и даём рабочий путь.
        • Google/Apple— провайдеры НЕ подключены. Кнопка больше не «входит»
                        молча: честная карточка «подключается» + альтернатива.
        • Телефон/почта — рабочая регистрация ядра (rg2). Код пока не уходит
                        ни в SMS, ни в письмо — говорим это прямо на экране,
                        а не всплывающей подсказкой «(демо)».
        • Нет сети    — отдельная ветка с «Повторить», без ложного входа.
        • Повторный вход — помним последний способ и подписываем его.

   2. ЗНАКОМСТВО. Сразу после регистрации — три коротких вопроса (кто ты, что
      интересно, чего ждёшь) и понятный первый шаг из них. Пропускается в один
      тап на любом шаге, ничего не навязывает. Чек-лист «Старт в OKO» из
      oko-growth.js не дублируем — на финале даём на него ссылку.

   3. ПОИСК. Глобальный поиск по тому, что реально есть в состоянии: люди,
      каналы, клубы, курсы, чаты и сообщения, уроки Академии, объявления
      Биржи, посты и разделы приложения. Пустой запрос — недавние запросы и
      быстрый доступ. Ничего не выдумываем: нет данных — нет строки.

   4. УВЕДОМЛЕНИЯ. Поверх notifs-plus: группировка по реальным дням, включение
      и отключение категорий, честные действия в строке (никаких «Заявка
      принята» без заявки), «Прочитать всё» с числом, честный пустой экран.

   Правила: ноль демо-данных, ноль ложных подтверждений, только SVG-иконки из
   спрайта index.html, безопасные зоны только через var(--oko-safe-*), текст не
   рвётся посреди слова, из любого экрана есть выход.
   ============================================================================ */
(function okoOnb2(){
'use strict';

if(window.__okoOnb2Ready) return;
window.__okoOnb2Ready = true;

/* ===========================================================================
   0 · УТИЛИТЫ
   =========================================================================== */

function E(s){
  return String(s == null ? '' : s)
    .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
    .replace(/"/g,'&quot;').replace(/'/g,'&#39;');
}
/* Иконка из общего спрайта. Никаких эмодзи в интерфейсе — только #i-*. */
function ic(name, cls){
  return '<svg class="i' + (cls ? ' ' + cls : '') + '" aria-hidden="true"><use href="#i-' + name + '"/></svg>';
}
function say(msg){ try{ if(typeof toast === 'function') toast(msg); }catch(e){} }
function haptic(kind){ try{ if(typeof window.okoHaptic === 'function') window.okoHaptic(kind || 'impact'); }catch(e){} }
function fn(name){ try{ return typeof window[name] === 'function' ? window[name] : null; }catch(e){ return null; } }
function lsGet(k, d){
  try{ var v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); }catch(e){ return d; }
}
function lsSet(k, v){ try{ localStorage.setItem(k, JSON.stringify(v)); }catch(e){} }
function online(){ try{ return navigator.onLine !== false; }catch(e){ return true; } }

/* Настоящий Telegram Mini App под нами или обычный браузер? */
function tgUser(){
  try{
    var w = window.Telegram && window.Telegram.WebApp;
    var u = w && w.initDataUnsafe && w.initDataUnsafe.user;
    return (u && (u.id || u.username)) ? u : null;
  }catch(e){ return null; }
}

/* Нормализация строки для поиска: регистр, ё, лишние пробелы. */
function norm(s){
  return String(s == null ? '' : s).toLowerCase().replace(/ё/g,'е').replace(/\s+/g,' ').trim();
}

/* Русское склонение числительных: plural(3,'урок','урока','уроков') */
function plural(n, one, few, many){
  var a = Math.abs(n) % 100, b = a % 10;
  if(a > 10 && a < 20) return many;
  if(b > 1 && b < 5) return few;
  if(b === 1) return one;
  return many;
}

/* Регистрация слоя в общем стеке навигации: «назад», Escape, системная
   кнопка и Telegram BackButton начинают работать сами. */
function navPush(label, close){ try{ if(fn('nvPush')) window.nvPush(label, close); }catch(e){} }
function navPop(label){ try{ if(fn('nvPop')) window.nvPop(label); }catch(e){} }

/* ===========================================================================
   1 · СТИЛИ (один тег, обе темы, безопасные зоны только через переменные)
   =========================================================================== */

var CSS = [
/* ---------- общее ---------- */
'.onb2-nowrap-safe{overflow-wrap:break-word;word-break:normal;hyphens:auto}',

/* ---------- ЭКРАН ВХОДА: честные подписи ---------- */
'.onb2-auth-note{margin-top:2px;font-size:11.5px;line-height:1.5;color:#8b8b8b;text-align:center;',
'  overflow-wrap:break-word;word-break:normal}',
'.onb2-auth-note b{color:#c9d9b4;font-weight:600}',
'.onb2-auth-last{display:flex;align-items:center;justify-content:center;gap:7px;margin-bottom:2px;',
'  font-size:11.5px;color:#9AFF00;line-height:1.4;text-align:center}',
'.onb2-auth-last svg.i{width:14px;height:14px;flex:0 0 auto}',
'.onb2-auth-off{display:flex;align-items:center;gap:9px;margin:0 0 12px;padding:10px 13px;border-radius:12px;',
'  background:rgba(255,77,77,.12);border:1px solid rgba(255,77,77,.35);color:#ffb3b3;font-size:12px;line-height:1.45}',
'.onb2-auth-off svg.i{width:17px;height:17px;flex:0 0 auto;color:#ff8a8a}',
/* пометка «не подключён» на кнопке провайдера */
'.onb2-soon{position:absolute;top:-7px;right:8px;font-size:9px;font-weight:700;letter-spacing:.06em;',
'  text-transform:uppercase;padding:2px 7px;border-radius:99px;background:#1c1c1c;border:1px solid #333;color:#9b9b9b}',
'.auth-row .auth-btn{position:relative;overflow:visible}',

/* ---------- КАРТОЧКА-ОБЪЯСНЕНИЕ (вход) ---------- */
'.onb2-scrim{position:fixed;inset:0;z-index:9880;display:flex;align-items:flex-end;justify-content:center;',
'  background:rgba(0,0,0,.62);-webkit-backdrop-filter:blur(6px);backdrop-filter:blur(6px);',
'  opacity:0;transition:opacity .22s ease;padding:0}',
'.onb2-scrim.on{opacity:1}',
'.onb2-sheet{width:100%;max-width:520px;box-sizing:border-box;background:var(--bg);color:var(--text);',
'  border:1px solid var(--border);border-bottom:0;border-radius:22px 22px 0 0;',
'  padding:18px 20px max(calc(20px + var(--oko-safe-bottom)),calc(20px + var(--oko-sab,0px)));',
'  padding-left:max(20px,var(--oko-safe-left),var(--oko-sal,0px));padding-right:max(20px,var(--oko-safe-right),var(--oko-sar,0px));',
'  transform:translateY(16px);transition:transform .24s cubic-bezier(.3,1,.4,1);max-height:86vh;overflow-y:auto}',
'.onb2-scrim.on .onb2-sheet{transform:none}',
'@media(min-width:760px){.onb2-scrim{align-items:center}',
'  .onb2-sheet{border-radius:22px;border-bottom:1px solid var(--border);',
'   padding-bottom:20px;margin:0 16px}}',
'.onb2-sheet-top{display:flex;align-items:flex-start;gap:12px;margin-bottom:12px}',
'.onb2-sheet-ic{width:42px;height:42px;flex:0 0 auto;border-radius:13px;background:var(--lime-dim);',
'  border:1px solid var(--border);color:var(--accent);display:flex;align-items:center;justify-content:center}',
'.onb2-sheet-ic svg.i{width:21px;height:21px}',
/* h1–h3 в ядре идут дисплейным шрифтом, а в нём нет кириллицы нужного
   начертания — латиница и кириллица начинали рисоваться разными шрифтами
   в одной строке. Заголовку карточки задаём основной шрифт явно. */
'.onb2-sheet h3{font-family:var(--font-body);font-size:17px;font-weight:700;line-height:1.3;margin:2px 0 0;',
'  letter-spacing:0;overflow-wrap:break-word;word-break:normal;hyphens:auto}',
'.onb2-sheet p{font-size:13.5px;line-height:1.55;color:var(--dim);margin:10px 0 0;',
'  overflow-wrap:break-word;word-break:normal;hyphens:auto}',
'.onb2-sheet-x{width:34px;height:34px;flex:0 0 auto;margin-left:auto;border-radius:50%;color:var(--dim);',
'  display:flex;align-items:center;justify-content:center;background:none;border:0;cursor:pointer}',
'.onb2-sheet-x svg.i{width:16px;height:16px}',
'.onb2-acts{display:flex;flex-direction:column;gap:9px;margin-top:16px}',
'.onb2-btn{display:flex;align-items:center;justify-content:center;gap:9px;width:100%;box-sizing:border-box;',
'  padding:13px 16px;border-radius:14px;font-size:14px;font-weight:600;border:1px solid var(--border);',
'  background:var(--surface);color:var(--text);cursor:pointer;line-height:1.3;text-align:center;',
'  overflow-wrap:break-word;word-break:normal}',
'.onb2-btn svg.i{width:18px;height:18px;flex:0 0 auto}',
'.onb2-btn.pri{background:linear-gradient(135deg,#B9FF4D,#9AFF00 55%,#7ACC00);color:#000;border-color:transparent;font-weight:700}',
'.onb2-btn.ghost{background:none;border-color:transparent;color:var(--dim);font-weight:500}',
'.onb2-btn:active{transform:scale(.985)}',

/* ---------- честная подсказка про код в регистрации ---------- */
'.onb2-codehint{margin:12px auto 0;max-width:340px;box-sizing:border-box;padding:11px 13px;border-radius:13px;',
'  background:var(--lime-dim);border:1px solid var(--border);color:var(--text);font-size:12px;line-height:1.5;',
'  text-align:left;overflow-wrap:break-word;word-break:normal}',
'.onb2-codehint b{display:block;font-family:var(--font-display);font-size:24px;letter-spacing:.28em;',
'  color:var(--accent);margin-top:6px;text-indent:.28em}',

/* ---------- ЗНАКОМСТВО ---------- */
'#onb2Intro{position:fixed;inset:0;z-index:9885;background:var(--bg);color:var(--text);display:none;',
'  flex-direction:column;opacity:0;transition:opacity .26s ease}',
'#onb2Intro.on{display:flex;opacity:1}',
'.onb2-in-head{display:flex;align-items:center;gap:10px;flex:0 0 auto;',
'  padding:12px 16px;padding-top:max(12px,var(--oko-safe-top),var(--oko-sat,0px));',
'  padding-left:max(16px,var(--oko-safe-left),var(--oko-sal,0px));padding-right:max(16px,var(--oko-safe-right),var(--oko-sar,0px));',
'  border-bottom:1px solid var(--border)}',
'.onb2-in-dots{display:flex;gap:6px;flex:1;justify-content:center}',
'.onb2-in-dots i{width:7px;height:7px;border-radius:50%;background:var(--border);transition:.2s}',
'.onb2-in-dots i.on{background:var(--accent);width:20px;border-radius:99px}',
'.onb2-skip{flex:0 0 auto;background:none;border:0;color:var(--dim);font-size:12.5px;font-weight:600;',
'  padding:8px 4px;cursor:pointer;white-space:nowrap}',
'.onb2-in-body{flex:1;overflow-y:auto;-webkit-overflow-scrolling:touch;display:flex;flex-direction:column;',
'  padding:22px 18px 12px;padding-left:max(18px,var(--oko-safe-left),var(--oko-sal,0px));padding-right:max(18px,var(--oko-safe-right),var(--oko-sar,0px))}',
'.onb2-in-wrap{width:100%;max-width:560px;margin-left:auto;margin-right:auto}',
/* на широком экране вопрос стоит по центру, а не жмётся к верхнему краю;
   auto-поля, а не justify-content — длинный список тогда не обрезается сверху */
'@media(min-width:760px){.onb2-in-body>.onb2-in-wrap{margin-top:auto;margin-bottom:auto}}',
'.onb2-kick{font-size:11px;font-weight:700;letter-spacing:.09em;text-transform:uppercase;color:var(--accent)}',
'.onb2-h{font-family:var(--font-display);font-size:32px;line-height:1.04;letter-spacing:.03em;margin:8px 0 0;',
'  overflow-wrap:break-word;word-break:normal;hyphens:auto}',
'@media(max-width:365px){.onb2-h{font-size:28px}}',
'.onb2-sub{font-size:13.5px;line-height:1.55;color:var(--dim);margin:9px 0 0;',
'  overflow-wrap:break-word;word-break:normal;hyphens:auto}',
'.onb2-opts{display:flex;flex-direction:column;gap:9px;margin-top:18px}',
'.onb2-opt{display:flex;align-items:center;gap:12px;width:100%;box-sizing:border-box;text-align:left;',
'  padding:13px 14px;border-radius:15px;background:var(--surface);border:1px solid var(--border);',
'  color:var(--text);cursor:pointer;transition:border-color .16s,background .16s}',
/* значок варианта — самостоятельный класс: он же используется в карточке
   первого шага, где родителя .onb2-opt нет */
'.onb2-oi{width:38px;height:38px;flex:0 0 auto;border-radius:12px;background:var(--raised);',
'  border:1px solid var(--border);color:var(--accent);display:flex;align-items:center;justify-content:center}',
'.onb2-oi svg.i{width:19px;height:19px}',
'.onb2-ot{flex:1;min-width:0}',
'.onb2-ot b{display:block;font-size:14px;font-weight:600;line-height:1.35;',
'  overflow-wrap:break-word;word-break:normal;hyphens:auto}',
'.onb2-ot small{display:block;font-size:11.5px;color:var(--dim);line-height:1.45;margin-top:3px;',
'  overflow-wrap:break-word;word-break:normal;hyphens:auto}',
'.onb2-ck{width:22px;height:22px;flex:0 0 auto;border-radius:50%;border:1.5px solid var(--border);',
'  display:flex;align-items:center;justify-content:center;color:transparent}',
'.onb2-ck svg.i{width:12px;height:12px}',
'.onb2-opt.on{border-color:var(--accent);background:var(--lime-dim)}',
'.onb2-opt.on .onb2-ck{background:var(--accent);border-color:var(--accent);color:#0a0a0a}',
/* шеврон «перейти» — не пустой кружок выбора */
'.onb2-ck.onb2-go{border:0;background:none;color:var(--dim)}',
'.onb2-ck.onb2-go svg.i{width:15px;height:15px}',
'.onb2-in-foot{flex:0 0 auto;border-top:1px solid var(--border);background:var(--bg);',
'  padding:12px 18px max(calc(12px + var(--oko-safe-bottom)),calc(12px + var(--oko-sab,0px)));',
'  padding-left:max(18px,var(--oko-safe-left),var(--oko-sal,0px));padding-right:max(18px,var(--oko-safe-right),var(--oko-sar,0px))}',
'.onb2-in-foot .onb2-in-wrap{display:flex;flex-direction:column;gap:8px}',
'.onb2-plan{margin-top:18px;display:flex;flex-direction:column;gap:10px}',
'.onb2-plan-main{display:flex;align-items:flex-start;gap:13px;width:100%;box-sizing:border-box;text-align:left;',
'  padding:16px;border-radius:18px;cursor:pointer;color:#06120a;border:0;',
'  background:linear-gradient(135deg,#B9FF4D,#9AFF00 55%,#7ACC00)}',
'.onb2-plan-main .onb2-oi{background:rgba(0,0,0,.16);border-color:transparent;color:#06120a}',
'.onb2-plan-main b{display:block;font-size:15.5px;font-weight:700;line-height:1.3;',
'  overflow-wrap:break-word;word-break:normal;hyphens:auto}',
'.onb2-plan-main small{display:block;font-size:12px;line-height:1.45;margin-top:4px;color:rgba(6,18,10,.72);',
'  overflow-wrap:break-word;word-break:normal;hyphens:auto}',
'.onb2-why{margin-top:14px;font-size:12px;line-height:1.55;color:var(--dim);',
'  overflow-wrap:break-word;word-break:normal;hyphens:auto}',

/* ---------- ПОИСК ---------- */
/* Закрытые поиск и уведомления «отъезжают» на свою ширину (translateX(100%)),
   а ширина ограничена 1280px и центрируется. На мониторе шире 1280 полоса
   шапки выглядывала из правого края экрана. Уводим ровно за вьюпорт. */
'@media(min-width:1281px){#searchView:not(.open),#notifsView:not(.open){transform:translateX(100vw)}}',
'.onb2-sf-clear{width:26px;height:26px;flex:0 0 auto;border:0;background:var(--raised);border-radius:50%;',
'  color:var(--dim);display:none;align-items:center;justify-content:center;cursor:pointer}',
'.onb2-sf-clear svg.i{width:11px;height:11px}',
'#searchView.onb2-has-q .onb2-sf-clear{display:flex}',
'.onb2-chips{display:flex;gap:7px;overflow-x:auto;flex:0 0 auto;padding:10px 16px;',
'  padding-left:max(16px,var(--oko-safe-left),var(--oko-sal,0px));padding-right:max(16px,var(--oko-safe-right),var(--oko-sar,0px));',
'  border-bottom:1px solid var(--border);scrollbar-width:none;-webkit-overflow-scrolling:touch}',
'.onb2-chips::-webkit-scrollbar{display:none}',
'.onb2-chip{flex:0 0 auto;font-size:12.5px;font-weight:600;padding:7px 13px;border-radius:99px;',
'  border:1px solid var(--border);background:var(--raised);color:var(--dim);white-space:nowrap;cursor:pointer}',
'.onb2-chip.on{background:var(--accent);border-color:var(--accent);color:#0a0a0a}',
'.onb2-chip .onb2-chip-n{margin-left:6px;font-size:11px;opacity:.8}',
'@media(min-width:900px){.onb2-chips{padding-left:max(18px,calc((100% - 640px)/2));',
'  padding-right:max(18px,calc((100% - 640px)/2))}}',
'.onb2-sec{display:flex;align-items:baseline;gap:8px;margin:16px 2px 8px}',
'.onb2-sec b{font-size:11.5px;font-weight:700;color:var(--dim);text-transform:uppercase;letter-spacing:.04em}',
'.onb2-sec span{font-size:11px;color:var(--dim);opacity:.7}',
'.onb2-sec:first-child{margin-top:2px}',
'.onb2-hit{cursor:pointer;border:0;background:none}',
'.onb2-hit .nt-b b{font-weight:700}',
'.onb2-hit mark{background:var(--lime-dim);color:var(--accent);border-radius:3px;padding:0 1px}',
'.onb2-hit .nt-b span,.onb2-hit .nt-b small{overflow-wrap:break-word;word-break:normal;hyphens:auto}',
'.onb2-hit .nt-b span{display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}',
'.onb2-tagx{flex:0 0 auto;font-size:9.5px;font-weight:700;letter-spacing:.05em;text-transform:uppercase;',
'  padding:3px 8px;border-radius:99px;background:var(--raised);border:1px solid var(--border);color:var(--dim)}',
'.onb2-recent{display:flex;flex-wrap:wrap;gap:7px;margin-top:2px}',
'.onb2-rq{display:inline-flex;align-items:center;gap:7px;max-width:100%;padding:7px 8px 7px 12px;',
'  border-radius:99px;background:var(--surface);border:1px solid var(--border);color:var(--text);',
'  font-size:12.5px;cursor:pointer}',
'.onb2-rq span{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:150px}',
'.onb2-rq i{width:18px;height:18px;border-radius:50%;background:var(--raised);color:var(--dim);',
'  display:flex;align-items:center;justify-content:center;flex:0 0 auto}',
'.onb2-rq i svg.i{width:9px;height:9px}',
'.onb2-note{margin:16px 2px 0;font-size:11.5px;line-height:1.55;color:var(--dim);',
'  overflow-wrap:break-word;word-break:normal;hyphens:auto}',
'.onb2-empty{display:flex;flex-direction:column;align-items:center;text-align:center;gap:6px;padding:34px 16px 12px}',
'.onb2-empty .onb2-ei{width:58px;height:58px;border-radius:19px;background:var(--surface);',
'  border:1px solid var(--border);color:var(--dim);display:flex;align-items:center;justify-content:center;margin-bottom:8px}',
'.onb2-empty .onb2-ei svg.i{width:27px;height:27px}',
'.onb2-empty b{font-size:15px;font-weight:700;line-height:1.35;max-width:100%;',
'  overflow-wrap:break-word;word-break:break-word;hyphens:auto}',
'.onb2-empty p{font-size:12.5px;line-height:1.55;color:var(--dim);max-width:340px;',
'  overflow-wrap:break-word;word-break:normal;hyphens:auto}',
'.onb2-empty .onb2-btn{max-width:300px;margin-top:12px}',

/* ---------- УВЕДОМЛЕНИЯ ---------- */
'.onb2-np-cats{width:100%;box-sizing:border-box;margin-top:4px}',
'.onb2-np-cats .onb2-np-row{display:flex;align-items:center;gap:11px;padding:10px 2px;',
'  border-bottom:1px solid var(--border)}',
'.onb2-np-cats .onb2-np-row:last-child{border-bottom:0}',
'.onb2-np-cats .onb2-np-ic{width:32px;height:32px;flex:0 0 auto;border-radius:10px;background:var(--raised);',
'  border:1px solid var(--border);color:var(--accent);display:flex;align-items:center;justify-content:center}',
'.onb2-np-cats .onb2-np-ic svg.i{width:16px;height:16px}',
'.onb2-np-cats .onb2-np-t{flex:1;min-width:0}',
'.onb2-np-cats .onb2-np-t b{display:block;font-size:13px;font-weight:600;line-height:1.35;',
'  overflow-wrap:break-word;word-break:normal}',
'.onb2-np-cats .onb2-np-t small{display:block;font-size:11px;color:var(--dim);line-height:1.4;margin-top:2px;',
'  overflow-wrap:break-word;word-break:normal;hyphens:auto}',
'.onb2-sw{width:44px;height:26px;flex:0 0 auto;border-radius:99px;background:var(--raised);',
'  border:1px solid var(--border);position:relative;cursor:pointer;transition:background .18s}',
'.onb2-sw::after{content:"";position:absolute;top:2px;left:2px;width:20px;height:20px;border-radius:50%;',
'  background:var(--dim);transition:transform .18s,background .18s}',
'.onb2-sw.on{background:var(--lime-dim);border-color:var(--accent)}',
'.onb2-sw.on::after{transform:translateX(18px);background:var(--accent)}',
'.onb2-np-muted{margin:14px 2px 0;padding:12px 14px;border-radius:14px;background:var(--surface);',
'  border:1px solid var(--border);font-size:12px;line-height:1.5;color:var(--dim);',
'  overflow-wrap:break-word;word-break:normal;hyphens:auto}',
'.onb2-np-muted button{margin-top:8px;background:none;border:0;color:var(--accent);font-size:12px;',
'  font-weight:700;cursor:pointer;padding:0}',
'.onb2-sec-t{font-size:11.5px;font-weight:700;color:var(--dim);text-transform:uppercase;',
'  letter-spacing:.05em;margin:16px 0 4px}',
/* Шапка центра уведомлений: заголовок и «Прочитать всё» не рвутся посреди
   слова. На узком экране (360) «Уведомления» ломалось на «Уведомлен/ия». */
'#notifsView .sv-head{gap:8px}',
'#notifsView .sv-head > b{white-space:nowrap;overflow-wrap:normal;word-break:keep-all;',
'  flex:0 1 auto;min-width:0;overflow:hidden;text-overflow:ellipsis}',
'#notifsView .ep-done{white-space:nowrap;font-size:12.5px;overflow-wrap:normal;word-break:keep-all}',
'@media(max-width:370px){#notifsView .sv-head > b{font-size:15px}',
'  #notifsView .ep-done{font-size:11.5px}}',

/* ---------- слои поверх наших экранов ---------- */
/* Чек-лист и пилюля системы роста живут на z-index 9300 и ложатся поверх
   поиска (74) и центра уведомлений (73), закрывая половину списка. Их файл
   не трогаем — просто прячем их на время, пока открыт наш полноэкранный
   слой. Две записи: через :has() и через соседний комбинатор, потому что
   порядок появления элементов в body заранее не известен. */
'body:has(#searchView.open) .okg-ob, body:has(#searchView.open) .okg-pill,',
'body:has(#notifsView.open) .okg-ob, body:has(#notifsView.open) .okg-pill,',
'body:has(#onb2Intro.on) .okg-ob, body:has(#onb2Intro.on) .okg-pill,',
'body:has(.onb2-scrim.on) .okg-ob, body:has(.onb2-scrim.on) .okg-pill{display:none !important}',
'#searchView.open ~ .okg-ob, #searchView.open ~ .okg-pill,',
'#notifsView.open ~ .okg-ob, #notifsView.open ~ .okg-pill,',
'#onb2Intro.on ~ .okg-ob, #onb2Intro.on ~ .okg-pill{display:none !important}',

'@media(prefers-reduced-motion:reduce){#onb2Intro,.onb2-scrim,.onb2-sheet{transition:none}}'
].join('\n');

(function injectCss(){
  try{
    if(document.getElementById('okoOnb2Css')) return;
    var st = document.createElement('style');
    st.id = 'okoOnb2Css';
    st.textContent = CSS;
    (document.head || document.documentElement).appendChild(st);
  }catch(e){}
})();

/* ===========================================================================
   2 · ОБЩАЯ КАРТОЧКА-ОБЪЯСНЕНИЕ
   Закрывается крестиком, тапом вне, Escape и системной «назад».
   =========================================================================== */

var sheetEl = null;

function sheetClose(){
  if(!sheetEl) return;
  var el = sheetEl; sheetEl = null;
  el.classList.remove('on');
  navPop('onb2:sheet');
  setTimeout(function(){ try{ el.remove(); }catch(e){} }, 240);
}

/* o = {ico, title, text, actions:[{label, ico, kind:'pri'|'ghost'|'', onclick}]} */
function sheetOpen(o){
  sheetClose();
  o = o || {};
  var el = document.createElement('div');
  el.className = 'onb2-scrim';
  el.setAttribute('role','dialog');
  el.setAttribute('aria-modal','true');
  el.setAttribute('aria-label', String(o.title || 'Сообщение'));

  var acts = (o.actions || []).map(function(a, i){
    return '<button type="button" class="onb2-btn ' + (a.kind || '') + '" data-a="' + i + '">' +
      (a.ico ? ic(a.ico) : '') + '<span>' + E(a.label) + '</span></button>';
  }).join('');

  el.innerHTML =
    '<div class="onb2-sheet">' +
      '<div class="onb2-sheet-top">' +
        '<span class="onb2-sheet-ic">' + ic(o.ico || 'info') + '</span>' +
        '<h3>' + E(o.title || '') + '</h3>' +
        '<button type="button" class="onb2-sheet-x" data-close="1" aria-label="Закрыть">' + ic('x') + '</button>' +
      '</div>' +
      (o.text ? '<p>' + o.text + '</p>' : '') +
      '<div class="onb2-acts">' + acts + '</div>' +
    '</div>';

  el.addEventListener('click', function(ev){
    if(ev.target === el){ sheetClose(); return; }
    var x = ev.target.closest && ev.target.closest('[data-close]');
    if(x){ sheetClose(); return; }
    var b = ev.target.closest && ev.target.closest('[data-a]');
    if(!b) return;
    var a = (o.actions || [])[+b.dataset.a];
    if(!a) return;
    haptic('impact');
    if(a.keepOpen){ if(a.onclick) a.onclick(el); return; }
    sheetClose();
    if(a.onclick) setTimeout(function(){ try{ a.onclick(); }catch(e){} }, 120);
  });

  document.body.appendChild(el);
  sheetEl = el;
  requestAnimationFrame(function(){ el.classList.add('on'); });
  navPush('onb2:sheet', sheetClose);
}

/* ===========================================================================
   3 · ВХОД: честные провайдеры
   =========================================================================== */

var LAST_METHOD = 'oko-onb2-last-method';
var BOT_URL = 'https://t.me/okoappbot';

var METHOD_LABEL = {
  telegram: 'Telegram', google: 'Google', apple: 'Apple',
  phone: 'телефон или почту', owner: 'почту владельца', email: 'почту'
};

function rememberMethod(m){ try{ localStorage.setItem(LAST_METHOD, String(m)); }catch(e){} }
function lastMethod(){ try{ return localStorage.getItem(LAST_METHOD) || ''; }catch(e){ return ''; } }

/* Рабочая альтернатива, которая есть всегда: регистрация ядра по телефону/почте */
function goPhone(){
  var open = fn('rg2Open');
  if(open){ open(); return true; }
  /* rg2 не поднялся — не молчим и не делаем вид, что вошли */
  sheetOpen({
    ico:'warning', title:'Регистрация не открылась',
    text:'Форма входа по телефону и почте не загрузилась. Перезагрузи страницу — она подтянется вместе с остальным приложением.',
    actions:[{label:'Перезагрузить', kind:'pri', ico:'refresh', onclick:function(){ location.reload(); }},
             {label:'Закрыть', kind:'ghost'}]
  });
  return false;
}

function openBot(){
  try{ window.open(BOT_URL, '_blank', 'noopener'); }catch(e){}
  try{
    var w = window.Telegram && window.Telegram.WebApp;
    if(w && typeof w.openTelegramLink === 'function') w.openTelegramLink(BOT_URL);
  }catch(e){}
}

/* Кнопка провайдера, который ещё не подключён */
function noteProviderSoon(method){
  var name = METHOD_LABEL[method] || method;
  var inTg = !!tgUser();
  var acts = [];
  if(inTg) acts.push({label:'Продолжить в Telegram', kind:'pri', ico:'send', onclick:function(){ window.doLogin('telegram'); }});
  acts.push({label:'Телефон или почта', kind: inTg ? '' : 'pri', ico:'phone', onclick:goPhone});
  if(!inTg) acts.push({label:'Открыть OKO в Telegram', ico:'send', onclick:openBot});
  acts.push({label:'Закрыть', kind:'ghost'});

  sheetOpen({
    ico: method === 'apple' ? 'apple' : 'google',
    title: 'Вход через ' + E(name) + ' пока не подключён',
    text: 'Мы включим его вместе с серверной частью OKO — пока кнопка ничего не подпишет и аккаунт не создаст, ' +
          'поэтому и не делаем вид, что вход прошёл.<br><br>Сейчас работают два способа: ' +
          (inTg ? 'вход через Telegram' : 'открыть OKO внутри Telegram') +
          ' и обычная регистрация по телефону или почте.',
    actions: acts
  });
}

/* Telegram нет под нами (обычный браузер) */
function noteNoTelegram(){
  sheetOpen({
    ico:'send', title:'Telegram здесь не найден',
    text:'OKO открыт в обычном браузере, а не внутри Telegram, поэтому взять твой Telegram-аккаунт неоткуда — ' +
         'вход через него сейчас не пройдёт.<br><br>Открой OKO через бот <b>@okoappbot</b> — там вход будет в один тап. ' +
         'Или заведи вход по телефону либо почте прямо здесь.',
    actions:[
      {label:'Открыть @okoappbot', kind:'pri', ico:'send', onclick:openBot},
      {label:'Телефон или почта', ico:'phone', onclick:goPhone},
      {label:'Закрыть', kind:'ghost'}
    ]
  });
}

/* Нет сети */
function noteOffline(method){
  sheetOpen({
    ico:'warning', title:'Нет соединения',
    text:'Сеть недоступна, поэтому вход сейчас не пройдёт: приложению некуда отправить запрос. ' +
         'Проверь интернет и повтори — данные никуда не потерялись.',
    actions:[
      {label:'Повторить', kind:'pri', ico:'refresh', onclick:function(){
        /* через window.doLogin — чтобы отработала вся цепочка входа, включая знакомство */
        if(online()) window.doLogin(method);
        else setTimeout(function(){ noteOffline(method); }, 60);
      }},
      {label:'Закрыть', kind:'ghost'}
    ]
  });
}

/* Настоящий вход — то, что было в ядре и слоях до нас */
var prevDoLogin = window.doLogin;
function doLoginReal(method){
  rememberMethod(method);
  try{ if(typeof prevDoLogin === 'function') prevDoLogin(method); }catch(e){}
}

window.doLogin = function(method){
  try{
    if(method === 'telegram'){
      if(!online()) return noteOffline('telegram');
      if(!tgUser()) return noteNoTelegram();
      return doLoginReal('telegram');
    }
    if(method === 'google' || method === 'apple') return noteProviderSoon(method);
    if(method === 'phone'){ rememberMethod('phone'); }
  }catch(e){}
  return doLoginReal(method);
};

/* ---------- честные подписи прямо на экране входа ---------- */
function decorateAuthScreen(){
  try{
    var scr = document.getElementById('authScreen');
    if(!scr) return;
    var btns = scr.querySelector('.auth-btns');
    if(!btns) return;

    /* «скоро» на Google и Apple — видно до нажатия, а не после */
    scr.querySelectorAll('.auth-row .auth-btn').forEach(function(b){
      var oc = b.getAttribute('onclick') || '';
      if(!/google|apple/.test(oc)) return;
      if(b.querySelector('.onb2-soon')) return;
      var tag = document.createElement('span');
      tag.className = 'onb2-soon';
      tag.textContent = 'скоро';
      b.appendChild(tag);
    });

    /* строка-объяснение под способами входа */
    if(!btns.querySelector('.onb2-auth-note')){
      var p = document.createElement('p');
      p.className = 'onb2-auth-note';
      p.innerHTML = 'Google и Apple пока не подключены. Работают <b>Telegram</b> и вход по <b>телефону или почте</b>.';
      btns.appendChild(p);
    }

    /* последний использованный способ — своя же история, не выдумка */
    var lm = lastMethod();
    if(lm && METHOD_LABEL[lm] && !btns.querySelector('.onb2-auth-last')){
      var s = document.createElement('div');
      s.className = 'onb2-auth-last';
      s.innerHTML = ic('clock') + '<span>В прошлый раз ты входил через ' + E(METHOD_LABEL[lm]) + '</span>';
      btns.insertBefore(s, btns.firstChild);
    }

    syncAuthOffline();
  }catch(e){}
}

/* Полоса «нет сети» на экране входа — появляется и уходит сама */
function syncAuthOffline(){
  try{
    var scr = document.getElementById('authScreen');
    if(!scr) return;
    var inner = scr.querySelector('.auth-inner');
    if(!inner) return;
    var bar = inner.querySelector('.onb2-auth-off');
    if(online()){ if(bar) bar.remove(); return; }
    /* ядро уже показывает свою полосу «ты офлайн» — вторую не рисуем */
    var core = document.getElementById('pwa-offline');
    if(core && getComputedStyle(core).display !== 'none'){ if(bar) bar.remove(); return; }
    if(bar) return;
    bar = document.createElement('div');
    bar.className = 'onb2-auth-off';
    bar.innerHTML = ic('warning') + '<span>Нет соединения. Вход подождёт, пока не появится сеть.</span>';
    var btns = inner.querySelector('.auth-btns');
    if(btns) inner.insertBefore(bar, btns); else inner.appendChild(bar);
  }catch(e){}
}
window.addEventListener('online', syncAuthOffline);
window.addEventListener('offline', syncAuthOffline);

/* ---------- честный код подтверждения в регистрации ----------
   Ядро показывало код всплывашкой «Код: 123456 (демо)» — она пропадала через
   пару секунд, и человек оставался с пустыми полями. Пишем прямо под полями,
   что SMS и письма ещё не подключены, и держим код на экране. */
(function honestCode(){
  var prev = window.rg2SendCode;
  if(typeof prev !== 'function') return;
  window.rg2SendCode = function(){
    var r = prev.apply(this, arguments);
    setTimeout(function(){
      try{
        var step = document.getElementById('rg2Step2');
        if(!step) return;
        var box = step.querySelector('.onb2-codehint');
        if(!box){
          box = document.createElement('div');
          box.className = 'onb2-codehint';
          var row = step.querySelector('#rg2Code');
          if(row && row.parentNode) row.parentNode.insertBefore(box, row.nextSibling);
          else step.appendChild(box);
        }
        var code = '';
        try{ code = (typeof RG2 !== 'undefined' && RG2 && RG2.code) ? String(RG2.code) : ''; }catch(e){}
        box.innerHTML = 'SMS и письма ещё не подключены — код не уйдёт ни в сообщение, ни на почту. ' +
          'Вот он, введи его в поля выше:' + (code ? '<b class="oko-breakable">' + E(code) + '</b>' : '');

        /* «Отправили на …» — тоже неправда, пока отправлять некуда */
        var sub = step.querySelector('.rg2-sub');
        var to = step.querySelector('#rg2CodeTo');
        if(sub && to){
          var masked = (to.textContent || '').trim();
          sub.innerHTML = 'Аккаунт <b id="rg2CodeTo">' + E(masked) + '</b>';
        }
      }catch(e){}
    }, 40);
    return r;
  };
})();

/* ===========================================================================
   4 · ЗНАКОМСТВО (онбординг первого дня)
   =========================================================================== */

var INTRO_LS = 'oko-onb2-intro';

var ROLES = [
  {id:'newbie',  ico:'compass',   t:'Только начинаю',        s:'Аккаунта и контента почти нет — хочу разобраться с нуля'},
  {id:'author',  ico:'camera',    t:'Веду блог или канал',   s:'Контент уже есть, нужен рост и порядок'},
  {id:'expert',  ico:'star',      t:'Эксперт или наставник', s:'Есть знания и услуги, нужны клиенты и площадка'},
  {id:'business',ico:'briefcase', t:'У меня бизнес',         s:'Нужны заявки, продажи и продвижение'},
  {id:'look',    ico:'eye',       t:'Просто смотрю',         s:'Пока осматриваюсь, без задачи'}
];

/* Интересы совпадают с темами умной ленты (FA_TOPICS), поэтому ответы реально
   влияют на рекомендации, а не остаются красивой анкетой. */
var INTERESTS = [
  {id:'content',   ico:'camera',    t:'Контент и Reels'},
  {id:'ai',        ico:'bolt',      t:'Нейросети'},
  {id:'marketing', ico:'megaphone', t:'Маркетинг и продажи'},
  {id:'business',  ico:'briefcase', t:'Бизнес и деньги'},
  {id:'games',     ico:'play',      t:'Игры и развлечения'},
  {id:'crypto',    ico:'money',     t:'Крипта и TON'}
];

var GOALS = [
  {id:'earn',   ico:'money',     t:'Заработать на своих навыках', s:'Биржа услуг, заказы, эскроу'},
  {id:'learn',  ico:'star',      t:'Научиться и получить сертификат', s:'Академия OKO: уроки, тесты, практика'},
  {id:'grow',   ico:'fa-up',     t:'Вырастить блог или канал',    s:'Лента, клипы, продвижение'},
  {id:'clients',ico:'target',    t:'Найти клиентов для бизнеса',  s:'Реклама и рекламный кабинет'},
  {id:'people', ico:'users',     t:'Найти людей и общение',       s:'Чаты, каналы, клубы'},
  {id:'partner',ico:'pp-share',  t:'Зарабатывать на партнёрке',   s:'Своя ссылка и проценты'}
];

/* Первый шаг по ответам. Каждое действие ведёт в реально существующий раздел. */
var FIRST_STEPS = {
  earn:    {ico:'briefcase', t:'Разместить первую услугу на Бирже',
            s:'Свободная категория, цена и описание — заявки приходят в чат',
            go:function(){ tab('mini'); later(function(){ if(fn('openMa')) window.openMa('market'); }); }},
  learn:   {ico:'star',      t:'Открыть Академию и начать первый урок',
            s:'Видео, слайды и тест — за курс выдают сертификат',
            go:function(){ tab('academy'); }},
  grow:    {ico:'camera',    t:'Проверить своё видео перед публикацией',
            s:'Покажет, где ролик теряет зрителя',
            go:function(){ tab('mini'); later(function(){ if(fn('openMa')) window.openMa('video'); }); }},
  clients: {ico:'megaphone', t:'Открыть рекламный кабинет',
            s:'Кампании, аудитории и бюджет в приложении',
            go:function(){ tab('ads'); }},
  people:  {ico:'chat',      t:'Заглянуть в общий чат OKO',
            s:'Там команда и участники — можно спросить что угодно',
            go:function(){ tab('chats'); later(function(){ if(fn('openConv')) window.openConv('live'); }); }},
  partner: {ico:'pp-share',  t:'Забрать партнёрскую ссылку',
            s:'Проценты с оплат тех, кого приведёшь',
            go:function(){ tab('partner'); }},
  profile: {ico:'user',      t:'Заполнить профиль',
            s:'Имя, ник и пара строк о себе — по ним тебя находят',
            go:function(){ tab('profile'); later(function(){ if(fn('openEdit')) window.openEdit(); }); }},
  feed:    {ico:'feed',      t:'Посмотреть ленту',
            s:'Рекомендации подстроятся под то, что ты выбрал',
            go:function(){ tab('feed'); }}
};

function tab(t){ try{ if(fn('showTab')) window.showTab(t); }catch(e){} }
function later(f){ setTimeout(function(){ try{ f(); }catch(e){} }, 260); }

var IN = { step:0, role:'', interests:[], goal:'', open:false };

function introState(){ return lsGet(INTRO_LS, null) || null; }
function introDone(){ var s = introState(); return !!(s && (s.done || s.skipped)); }

function introSave(extra){
  var s = {
    done: !!(extra && extra.done),
    skipped: !!(extra && extra.skipped),
    role: IN.role, interests: IN.interests.slice(), goal: IN.goal, at: Date.now()
  };
  lsSet(INTRO_LS, s);
  applyAnswers();
  return s;
}

/* Ответы должны что-то менять, иначе это опрос ради опроса. */
function applyAnswers(){
  /* 1) темы ленты */
  try{
    if(fn('faSignal')) IN.interests.forEach(function(t){ window.faSignal(t, 8); });
  }catch(e){}
  /* 2) те же интересы кладём туда, откуда их читает ядро */
  try{
    var reg = lsGet('oko-registration', null) || {};
    var set = {};
    (reg.interests || []).forEach(function(x){ set[x] = 1; });
    IN.interests.forEach(function(x){ set[x] = 1; });
    reg.interests = Object.keys(set);
    if(!reg.at) reg.at = Date.now();
    lsSet('oko-registration', reg);
  }catch(e){}
}

function firstStepFor(){
  if(IN.goal && FIRST_STEPS[IN.goal]) return IN.goal;
  if(IN.role === 'business') return 'clients';
  if(IN.role === 'expert')   return 'earn';
  if(IN.role === 'author')   return 'grow';
  if(IN.role === 'newbie')   return 'learn';
  return 'feed';
}
/* Два запасных шага — не повторяют главный */
function altSteps(main){
  var order = ['learn','grow','earn','people','partner','profile'];
  var out = [];
  for(var i = 0; i < order.length && out.length < 2; i++){
    if(order[i] !== main) out.push(order[i]);
  }
  return out;
}

function introEl(){ return document.getElementById('onb2Intro'); }

function introBuild(){
  var el = introEl();
  if(el) return el;
  el = document.createElement('div');
  el.id = 'onb2Intro';
  el.setAttribute('role','dialog');
  el.setAttribute('aria-modal','true');
  el.setAttribute('aria-label','Знакомство с OKO');
  el.innerHTML =
    '<div class="onb2-in-head sv-head" style="justify-content:flex-start">' +
      '<button type="button" class="ep-cancel" data-in="back" aria-label="Назад">' + ic('back') + '</button>' +
      '<div class="onb2-in-dots" id="onb2Dots"></div>' +
      '<button type="button" class="onb2-skip" data-in="skip">Пропустить</button>' +
    '</div>' +
    '<div class="onb2-in-body"><div class="onb2-in-wrap" id="onb2Stage"></div></div>' +
    '<div class="onb2-in-foot"><div class="onb2-in-wrap" id="onb2Foot"></div></div>';
  document.body.appendChild(el);

  el.addEventListener('click', function(ev){
    var t = ev.target.closest && ev.target.closest('[data-in]');
    if(!t) return;
    ev.preventDefault();
    var a = t.dataset.in;
    if(a === 'skip'){ haptic('impact'); introFinish(true); return; }
    if(a === 'back'){ haptic('impact'); introBack(); return; }
    if(a === 'next'){ haptic('impact'); introNext(); return; }
    if(a === 'role'){ IN.role = t.dataset.v; introRender(); haptic('select'); return; }
    if(a === 'goal'){ IN.goal = t.dataset.v; introRender(); haptic('select'); return; }
    if(a === 'int'){
      var v = t.dataset.v, k = IN.interests.indexOf(v);
      if(k > -1) IN.interests.splice(k, 1); else IN.interests.push(v);
      introRender(); haptic('select'); return;
    }
    if(a === 'go'){
      var step = FIRST_STEPS[t.dataset.v];
      introFinish(false);
      if(step) later(step.go);
      return;
    }
    if(a === 'check'){ introFinish(false); later(function(){ if(fn('okgOnboardOpen')) window.okgOnboardOpen(); }); return; }
    if(a === 'done'){ introFinish(false); return; }
  });
  return el;
}

function optRow(kind, v, o, on, multi){
  return '<button type="button" class="onb2-opt' + (on ? ' on' : '') + '" data-in="' + kind + '" data-v="' + E(v) + '"' +
    ' aria-pressed="' + (on ? 'true' : 'false') + '">' +
    '<span class="onb2-oi">' + ic(o.ico) + '</span>' +
    '<span class="onb2-ot"><b>' + E(o.t) + '</b>' + (o.s ? '<small>' + E(o.s) + '</small>' : '') + '</span>' +
    '<span class="onb2-ck">' + ic(multi ? 'check' : 'check2') + '</span>' +
  '</button>';
}

function introRender(){
  var el = introBuild();
  var stage = el.querySelector('#onb2Stage');
  var foot  = el.querySelector('#onb2Foot');
  var dots  = el.querySelector('#onb2Dots');
  var skip  = el.querySelector('[data-in="skip"]');
  var back  = el.querySelector('[data-in="back"]');
  if(!stage || !foot) return;

  dots.innerHTML = [0,1,2,3].map(function(i){ return '<i class="' + (i === IN.step ? 'on' : '') + '"></i>'; }).join('');
  back.style.visibility = IN.step === 0 ? 'hidden' : 'visible';
  skip.textContent = IN.step === 3 ? 'Закрыть' : 'Пропустить';

  if(IN.step === 0){
    stage.innerHTML =
      '<div class="onb2-kick">Знакомство · 1 из 3</div>' +
      '<h1 class="onb2-h">КТО ТЫ СЕЙЧАС</h1>' +
      '<p class="onb2-sub">Один ответ — чтобы не показывать тебе чужие задачи. Можно пропустить, ничего не сломается.</p>' +
      '<div class="onb2-opts">' + ROLES.map(function(r){ return optRow('role', r.id, r, IN.role === r.id, false); }).join('') + '</div>';
    foot.innerHTML = '<button type="button" class="onb2-btn pri" data-in="next">' +
      (IN.role ? 'Далее' : 'Пропустить вопрос') + ic('chev') + '</button>';
  }
  else if(IN.step === 1){
    var n = IN.interests.length;
    stage.innerHTML =
      '<div class="onb2-kick">Знакомство · 2 из 3</div>' +
      '<h1 class="onb2-h">ЧТО ТЕБЕ ИНТЕРЕСНО</h1>' +
      '<p class="onb2-sub">Отметь сколько хочешь. По этим темам подстроится лента рекомендаций — это единственное, на что они влияют.</p>' +
      '<div class="onb2-opts">' + INTERESTS.map(function(o){
        return optRow('int', o.id, o, IN.interests.indexOf(o.id) > -1, true);
      }).join('') + '</div>';
    foot.innerHTML = '<button type="button" class="onb2-btn pri" data-in="next">' +
      (n ? 'Далее · выбрано ' + n : 'Пропустить вопрос') + ic('chev') + '</button>';
  }
  else if(IN.step === 2){
    stage.innerHTML =
      '<div class="onb2-kick">Знакомство · 3 из 3</div>' +
      '<h1 class="onb2-h">ЧЕГО ЖДЁШЬ ОТ OKO</h1>' +
      '<p class="onb2-sub">Главное на ближайшее время. Из ответа соберём первый шаг — конкретный, а не «изучите приложение».</p>' +
      '<div class="onb2-opts">' + GOALS.map(function(g){ return optRow('goal', g.id, g, IN.goal === g.id, false); }).join('') + '</div>';
    foot.innerHTML = '<button type="button" class="onb2-btn pri" data-in="next">' +
      (IN.goal ? 'Показать первый шаг' : 'Пропустить вопрос') + ic('chev') + '</button>';
  }
  else {
    var mainKey = firstStepFor();
    var main = FIRST_STEPS[mainKey];
    var alts = altSteps(mainKey);
    var why = IN.goal || IN.role || IN.interests.length
      ? 'Выбрали по твоим ответам. Передумал — рядом ещё два входа, а полный список шагов всегда в чек-листе «Старт в OKO».'
      : 'Ты пропустил вопросы, поэтому шаг общий. Ответы можно дать позже — знакомство откроется из профиля.';
    stage.innerHTML =
      '<div class="onb2-kick">Готово</div>' +
      '<h1 class="onb2-h">С ЧЕГО НАЧАТЬ</h1>' +
      '<p class="onb2-sub">Один шаг, который даст результат уже сегодня.</p>' +
      '<div class="onb2-plan">' +
        '<button type="button" class="onb2-plan-main" data-in="go" data-v="' + E(mainKey) + '">' +
          '<span class="onb2-oi">' + ic(main.ico) + '</span>' +
          '<span class="onb2-ot"><b>' + E(main.t) + '</b><small>' + E(main.s) + '</small></span>' +
        '</button>' +
        alts.map(function(k){
          var s = FIRST_STEPS[k];
          return '<button type="button" class="onb2-opt" data-in="go" data-v="' + E(k) + '">' +
            '<span class="onb2-oi">' + ic(s.ico) + '</span>' +
            '<span class="onb2-ot"><b>' + E(s.t) + '</b><small>' + E(s.s) + '</small></span>' +
            '<span class="onb2-ck onb2-go">' + ic('chev') + '</span></button>';
        }).join('') +
      '</div>' +
      '<p class="onb2-why">' + E(why) + '</p>';
    foot.innerHTML =
      (fn('okgOnboardOpen') ? '<button type="button" class="onb2-btn" data-in="check">' + ic('check') + '<span>Открыть чек-лист «Старт в OKO»</span></button>' : '') +
      '<button type="button" class="onb2-btn ghost" data-in="done">Позже, сначала осмотрюсь</button>';
  }
  var body = el.querySelector('.onb2-in-body');
  if(body) body.scrollTop = 0;
}

function introNext(){
  if(IN.step < 3){ IN.step++; introRender(); }
  else introFinish(false);
}
function introBack(){
  if(IN.step > 0){ IN.step--; introRender(); }
  else introFinish(true);
}

function introOpen(reopen){
  if(IN.open) return;
  var saved = introState();
  if(saved && reopen){
    IN.role = saved.role || '';
    IN.interests = (saved.interests || []).slice();
    IN.goal = saved.goal || '';
  }
  IN.step = 0;
  IN.open = true;
  var el = introBuild();
  introRender();
  requestAnimationFrame(function(){ el.classList.add('on'); });
  navPush('onb2:intro', function(){ introFinish(true); });
  try{ if(fn('okoTrack')) window.okoTrack('onb2_intro_open', {}); }catch(e){}
}

function introFinish(skipped){
  if(!IN.open) return;
  IN.open = false;
  introSave({done: !skipped, skipped: !!skipped});
  var el = introEl();
  if(el) el.classList.remove('on');
  navPop('onb2:intro');
}
window.okoIntroOpen = function(){ introOpen(true); };

/* Пока знакомство или окно системы роста открыто — тур и сторис ждут.
   Иначе первые тридцать секунд превращаются в стопку из трёх онбордингов:
   сторис основателя ложатся поверх воронки, и человек видит кашу. Слой роста
   сам уступает любому полноэкранному оверлею (coreOverlayUp), а вот тур про
   него не знал — эту половину и закрываем здесь. */
var autoTourUntil = 0;   /* тур запущен автоматически, а не рукой человека */
function growthUp(){ try{ return !!document.querySelector('.okg-scrim'); }catch(e){ return false; } }

(function holdTour(){
  var prev = window.trMaybeAuto;
  if(typeof prev === 'function'){
    window.trMaybeAuto = function(){
      if(IN.open || growthUp() || sheetEl){
        setTimeout(function(){ try{ window.trMaybeAuto(); }catch(e){} }, 2200);
        return;
      }
      autoTourUntil = Date.now() + 2500;   /* дальше пойдёт отложенный запуск */
      return prev.apply(this, arguments);
    };
  }
  /* Сам запуск сторис и тура ядро откладывает ещё на 650 мс — за это время
     окно системы роста успевает открыться, и сторис уезжают под него.
     Ручной запуск из профиля не трогаем: он всегда идёт немедленно. */
  ['trStoriesStart', 'trStart'].forEach(function(name){
    var orig = window[name];
    if(typeof orig !== 'function') return;
    window[name] = function(){
      var self = this, args = arguments;
      var auto = Date.now() < autoTourUntil;
      if(auto && (IN.open || growthUp() || sheetEl)){
        setTimeout(function(){
          autoTourUntil = Date.now() + 2500;
          try{ window[name].apply(self, args); }catch(e){}
        }, 2000);
        return;
      }
      return orig.apply(self, args);
    };
  });
})();

/* Точки запуска: конец онбординга ядра и сам вход. */
/* Что-то уже занимает экран целиком — знакомству туда лезть нельзя */
function screenBusy(){
  try{
    var ob = document.getElementById('onboard');
    if(ob && !ob.classList.contains('hidden')) return true;      /* онбординг ядра */
    var auth = document.getElementById('authScreen');
    if(auth && !auth.classList.contains('hidden')) return true;
    var reg = document.getElementById('regView');
    if(reg && reg.classList.contains('open')) return true;
    if(document.getElementById('okoPopup')) return true;
    if(document.querySelector('.okg-scrim')) return true;        /* окно системы роста */
    if(document.querySelector('#trStories.ts-on')) return true;  /* сторис основателя */
    if(document.querySelector('#storyViewer.open')) return true;
    if(document.querySelector('.sheet.open')) return true;
    if(sheetEl) return true;
  }catch(e){}
  return false;
}

var introTries = 0;
function maybeIntro(delay){
  if(introDone() || IN.open) return;
  setTimeout(function(){
    try{
      if(introDone() || IN.open) return;
      if(typeof authed === 'function' && !authed()) return;
      if(screenBusy()){
        /* занято — подождём и попробуем ещё, но не бесконечно */
        if(introTries++ < 20) maybeIntro(2400);
        return;
      }
      introTries = 0;
      introOpen(false);
    }catch(e){}
  }, delay || 500);
}

(function hookIntro(){
  var prevFinish = window.obFinish;
  if(typeof prevFinish === 'function'){
    window.obFinish = function(){
      var r = prevFinish.apply(this, arguments);
      maybeIntro(620);
      return r;
    };
  }
  var prevLogin2 = window.doLogin;
  window.doLogin = function(m){
    var r = prevLogin2.apply(this, arguments);
    /* онбординг ядра сам вызовет obFinish; если его уже видели — идём сразу */
    var seen = false;
    try{ seen = !!localStorage.getItem('oko-onboarded'); }catch(e){}
    if(seen) maybeIntro(900);
    return r;
  };
  /* Регистрация по телефону или почте заканчивается своим потоком и doLogin
     не зовёт — знакомство подхватываем отдельно, иначе половина новых людей
     его вообще не увидит. */
  ['rg2FinishFlow', 'rg2FinishOwner'].forEach(function(name){
    var orig = window[name];
    if(typeof orig !== 'function') return;
    window[name] = function(){
      var r = orig.apply(this, arguments);
      maybeIntro(1400);
      return r;
    };
  });
})();

/* ===========================================================================
   5 · ПОИСК
   =========================================================================== */

var RECENT_LS = 'oko-onb2-recent';
var S = { q:'', filter:'all', hits:[], groups:[], bound:false };

var TYPES = [
  {k:'all',      t:'Всё'},
  {k:'people',   t:'Люди'},
  {k:'channel',  t:'Каналы и клубы'},
  {k:'chat',     t:'Чаты'},
  {k:'academy',  t:'Академия'},
  {k:'market',   t:'Биржа'},
  {k:'post',     t:'Посты'},
  {k:'section',  t:'Разделы'}
];
var TYPE_TITLE = {
  people:'Люди', channel:'Каналы и клубы', chat:'Чаты и сообщения',
  academy:'Академия', market:'Биржа', post:'Посты и клипы', section:'Разделы приложения'
};
var TYPE_ORDER = ['people','channel','chat','academy','market','post','section'];

function recentGet(){ var a = lsGet(RECENT_LS, []); return Array.isArray(a) ? a.slice(0, 8) : []; }
function recentAdd(q){
  q = String(q || '').trim();
  if(q.length < 2) return;
  var a = recentGet().filter(function(x){ return norm(x) !== norm(q); });
  a.unshift(q);
  lsSet(RECENT_LS, a.slice(0, 8));
}
function recentDel(q){
  lsSet(RECENT_LS, recentGet().filter(function(x){ return norm(x) !== norm(q); }));
}

/* ---------- сбор индекса из реального состояния ---------- */

function socKind(c){
  try{
    if(!c || !c.socId) return null;
    var own = window.okoSocial && window.okoSocial.state && window.okoSocial.state.own;
    var rec = own && own[c.socId];
    return rec ? rec.kind : null;
  }catch(e){ return null; }
}

function openChat(id){
  if(fn('closeSearch')) window.closeSearch();
  tab('chats');
  later(function(){ if(fn('openConv')) window.openConv(id); });
}
function openPersonProfile(name, chatId){
  if(fn('closeSearch')) window.closeSearch();
  if(fn('psOpenProfile')){ later(function(){ window.psOpenProfile(name); }); return; }
  if(chatId != null) openChat(chatId);
}

function collect(){
  var out = [];
  var push = function(o){ if(o && o.title) out.push(o); };

  /* --- люди, чаты, каналы, клубы и курсы: список чатов ядра --- */
  try{
    if(typeof CHATS !== 'undefined' && Array.isArray(CHATS)){
      CHATS.forEach(function(c){
        if(!c || !c.name) return;
        var sk = socKind(c);
        var isPerson = c.kind === 'direct';
        var isSaved  = c.kind === 'saved';
        var isPlace  = c.kind === 'channel' || c.kind === 'group' || sk === 'club' || sk === 'course';
        var type = isPerson ? 'people' : (isPlace ? 'channel' : 'chat');
        var tag  = isPerson ? 'Человек'
                 : sk === 'club' ? 'Клуб'
                 : sk === 'course' ? 'Курс'
                 : c.kind === 'channel' ? 'Канал'
                 : c.kind === 'group' ? 'Группа'
                 : isSaved ? 'Избранное' : 'Чат';
        var sub = c.nick ? '@' + c.nick : (c.preview || '');
        if(isPlace && c.subs) sub = c.subs + ' ' + plural(c.subs, 'подписчик', 'подписчика', 'подписчиков');
        push({
          type: type, tag: tag,
          title: c.name, sub: sub,
          hay: c.name + ' ' + (c.nick || '') + ' ' + (c.preview || ''),
          icon: c.avaIcon || c.kindIcon || (isPerson ? 'user' : isSaved ? 'bookmark' : 'chat'),
          go: isPerson ? (function(nm, id){ return function(){ openPersonProfile(nm, id); }; })(c.name, c.id)
                       : (function(id){ return function(){ openChat(id); }; })(c.id)
        });

        /* --- сообщения внутри переписок: ищем по тому, что реально написано --- */
        if(Array.isArray(c.msgs)){
          c.msgs.forEach(function(m){
            if(!m || !m.body || m.kind === 'sys') return;
            var body = String(m.body);
            if(body.length < 3) return;
            push({
              type:'chat', tag:'Сообщение',
              title: body.length > 90 ? body.slice(0, 90) + '…' : body,
              sub: c.name, hay: body, icon:'comment', weight:-40,
              go: (function(id){ return function(){ openChat(id); }; })(c.id)
            });
          });
        }
      });
    }
  }catch(e){}

  /* --- каналы модуля channels: витрина и свои --- */
  try{
    var st = lsGet('oko-channels', null);
    var seen = {};
    ['disc','mine'].forEach(function(key){
      var list = st && Array.isArray(st[key]) ? st[key] : [];
      list.forEach(function(ch){
        if(!ch || !ch.name || ch.archived || seen[ch.id]) return;
        seen[ch.id] = 1;
        var kindTag = ch.kind === 'course' ? 'Курс' : ch.kind === 'club' ? 'Клуб' : 'Канал';
        push({
          type:'channel', tag: kindTag,
          title: ch.name,
          sub: (ch.desc || '').slice(0, 90) || (ch.ownerNick ? '@' + ch.ownerNick : ''),
          hay: ch.name + ' ' + (ch.desc || '') + ' ' + (ch.ownerNick || ''),
          icon: ch.icon || 'megaphone',
          go: (function(id){ return function(){
            if(fn('closeSearch')) window.closeSearch();
            later(function(){
              if(fn('chOpen')) window.chOpen('channel', id);
              else tab('chats');
            });
          }; })(ch.id)
        });
      });
    });
  }catch(e){}

  /* --- Академия: направления и уроки --- */
  try{
    if(typeof AC_COURSES !== 'undefined' && Array.isArray(AC_COURSES)){
      AC_COURSES.forEach(function(c){
        if(!c || !c.title) return;
        push({
          type:'academy', tag:'Курс',
          title: c.title,
          sub: (c.tag || '') + (c.count ? ' · ' + c.count + ' ' + plural(c.count, 'урок', 'урока', 'уроков') : ''),
          hay: c.title + ' ' + (c.tag || '') + ' ' + (c.author || '') + ' ' + (c.outcomes || []).join(' '),
          icon:'star',
          go: function(){
            if(fn('closeSearch')) window.closeSearch();
            tab('academy');
          }
        });
      });
    }
  }catch(e){}
  try{
    if(typeof AC_COURSE !== 'undefined' && Array.isArray(AC_COURSE)){
      AC_COURSE.forEach(function(l, i){
        if(!l || !l.title) return;
        push({
          type:'academy', tag:'Урок',
          title: l.title, sub: l.sub || l.dur || 'Урок Академии',
          hay: l.title + ' ' + (l.sub || ''), icon:'play', weight:-10,
          go: (function(idx){ return function(){
            if(fn('closeSearch')) window.closeSearch();
            tab('academy');
            later(function(){ if(fn('acOpenLesson')) window.acOpenLesson(idx); });
          }; })(i)
        });
      });
    }
  }catch(e){}

  /* --- Биржа: объявления --- */
  try{
    if(typeof LISTINGS !== 'undefined' && Array.isArray(LISTINGS)){
      LISTINGS.forEach(function(l){
        if(!l || !l.t) return;
        var cat = fn('catName') ? window.catName(l.cat) : '';
        push({
          type:'market', tag: l.my ? 'Моё объявление' : 'Объявление',
          title: l.t, sub: [l.pt, l.n, cat].filter(Boolean).join(' · '),
          hay: l.t + ' ' + (l.n || '') + ' ' + cat + ' ' + (l.d || ''),
          icon: fn('catIco') ? window.catIco(l.cat) : 'briefcase',
          go: (function(id){ return function(){
            if(fn('closeSearch')) window.closeSearch();
            tab('mini');
            later(function(){
              if(fn('openMa')) window.openMa('market');
              later(function(){ if(fn('openListing')) window.openListing(id); });
            });
          }; })(l.id)
        });
      });
    }
  }catch(e){}

  /* --- посты и клипы ленты --- */
  try{
    if(typeof POSTS !== 'undefined' && POSTS){
      var all = (POSTS.rec || []).concat(POSTS.sub || []);
      var seenP = {};
      all.forEach(function(p){
        if(!p || seenP[p.id]) return;
        seenP[p.id] = 1;
        var body = String(p.body || '').trim();
        if(!body && !p.name) return;
        push({
          type:'post', tag: p.clip || p.video ? 'Клип' : 'Пост',
          title: body ? (body.length > 90 ? body.slice(0, 90) + '…' : body) : ('Запись · ' + p.name),
          sub: p.name || '', hay: body + ' ' + (p.name || ''), icon:'feed',
          go: function(){ if(fn('closeSearch')) window.closeSearch(); tab('feed'); }
        });
        /* автор поста как человек — если его нет в чатах */
        if(p.name){
          push({
            type:'people', tag:'Автор', title: p.name,
            sub: p.sub || 'Автор в OKO', hay: p.name, icon:'user', weight:-20,
            go: (function(nm){ return function(){ openPersonProfile(nm, null); }; })(p.name)
          });
        }
      });
    }
  }catch(e){}

  /* --- разделы приложения: берём прямо из живого меню и сетки мини-аппов --- */
  try{
    document.querySelectorAll('nav button[onclick], .tabbar button[onclick]').forEach(function(b){
      var oc = b.getAttribute('onclick') || '';
      var m = oc.match(/showTab\('([a-z0-9-]+)'\)/i);
      if(!m) return;
      var name = (b.textContent || '').trim();
      if(!name) return;
      push({
        type:'section', tag:'Раздел', title: name, sub:'Раздел приложения',
        hay: name, icon:'compass', weight:-30,
        go: (function(t){ return function(){ if(fn('closeSearch')) window.closeSearch(); tab(t); }; })(m[1])
      });
    });
    document.querySelectorAll('#maGrid .svc').forEach(function(b){
      var name = (b.textContent || '').trim();
      if(!name) return;
      var oc = b.getAttribute('onclick') || '';
      var ma = oc.match(/openMa\('([a-z0-9-]+)'\)/i);
      var tb = oc.match(/showTab\('([a-z0-9-]+)'\)/i);
      var svg = b.querySelector('.svc-ic use');
      var iconId = svg ? String(svg.getAttribute('href') || '').replace('#i-','') : 'compass';
      push({
        type:'section', tag:'Мини-апп', title: name, sub:'Мини-приложение OKO',
        hay: name, icon: iconId || 'compass', weight:-25,
        go: (function(el, maKey, tabKey){ return function(){
          if(fn('closeSearch')) window.closeSearch();
          later(function(){
            if(maKey && fn('openMa')){ tab('mini'); later(function(){ window.openMa(maKey); }); return; }
            if(tabKey){ tab(tabKey); return; }
            try{ el.click(); }catch(e){}
          });
        }; })(b, ma && ma[1], tb && tb[1])
      });
    });
  }catch(e){}

  return out;
}

/* ---------- ранжирование ---------- */
function score(item, q){
  var h = norm(item.hay || item.title);
  var t = norm(item.title);
  if(h.indexOf(q) < 0) return -1;
  var s = 0;
  if(t === q) s = 1000;
  else if(t.indexOf(q) === 0) s = 700;
  else if((' ' + t).indexOf(' ' + q) > -1) s = 500;
  else if(t.indexOf(q) > -1) s = 300;
  else s = 120;
  s += (item.weight || 0);
  if(item.type === 'people' || item.type === 'channel') s += 25;
  if(item.type === 'section') s += 10;
  return s;
}

function highlight(text, q){
  var src = String(text == null ? '' : text);
  if(!q) return E(src);
  var i = norm(src).indexOf(q);
  if(i < 0) return E(src);
  return E(src.slice(0, i)) + '<mark>' + E(src.slice(i, i + q.length)) + '</mark>' + E(src.slice(i + q.length));
}

/* ---------- разметка ---------- */

function hitHtml(h, i, q){
  return '<button type="button" class="nt-item onb2-hit" data-h="' + i + '">' +
    '<span class="nt-ic">' + ic(h.icon || 'search') + '</span>' +
    '<span class="nt-b"><span>' + highlight(h.title, q) + '</span>' +
      (h.sub ? '<small>' + highlight(h.sub, q) + '</small>' : '') + '</span>' +
    (h.tag ? '<span class="onb2-tagx">' + E(h.tag) + '</span>' : '') +
  '</button>';
}

function quickHtml(){
  var quick = S.index.filter(function(x){ return x.type === 'section'; }).slice(0, 8);
  if(!quick.length) return '';
  return '<div class="onb2-sec"><b>Быстрый доступ</b></div>' +
    quick.map(function(h){ return hitHtml(h, S.hits.push(h) - 1, ''); }).join('');
}

function renderEmptyQuery(){
  var body = document.getElementById('searchBody');
  if(!body) return;
  S.hits = [];
  var html = '';

  var rec = recentGet();
  if(rec.length){
    html += '<div class="onb2-sec"><b>Недавние запросы</b>' +
      '<span><button type="button" class="onb2-chip" data-rq-clear="1" style="padding:3px 10px;font-size:11px">Очистить</button></span></div>' +
      '<div class="onb2-recent">' + rec.map(function(q){
        return '<span class="onb2-rq" data-rq="' + E(q) + '"><span>' + E(q) + '</span>' +
          '<i data-rq-del="' + E(q) + '" role="button" aria-label="Убрать запрос">' + ic('x') + '</i></span>';
      }).join('') + '</div>';
  }

  html += quickHtml();
  html += '<p class="onb2-note">Поиск ищет по людям, каналам и клубам, чатам и сообщениям, курсам и урокам Академии, ' +
          'объявлениям Биржи, постам и разделам приложения — по тому, что уже загружено в приложение.</p>';
  body.innerHTML = html;
  syncChipCounts(null);
}

function renderResults(q){
  var body = document.getElementById('searchBody');
  if(!body) return;

  var scored = [];
  for(var i = 0; i < S.index.length; i++){
    var s = score(S.index[i], q);
    if(s < 0) continue;
    scored.push({ h: S.index[i], s: s });
  }
  scored.sort(function(a, b){ return b.s - a.s; });

  /* счётчики по типам — для чипов */
  var counts = { all: 0 };
  scored.forEach(function(x){
    counts.all++;
    counts[x.h.type] = (counts[x.h.type] || 0) + 1;
  });

  var list = S.filter === 'all' ? scored : scored.filter(function(x){ return x.h.type === S.filter; });

  S.hits = [];
  if(!list.length){
    body.innerHTML = emptyResultHtml(q, counts);
    syncChipCounts(counts);
    return;
  }

  /* группировка по типам, порядок фиксированный */
  var byType = {};
  list.forEach(function(x){ (byType[x.h.type] = byType[x.h.type] || []).push(x.h); });

  var html = '';
  TYPE_ORDER.forEach(function(tp){
    var arr = byType[tp];
    if(!arr || !arr.length) return;
    var shown = arr.slice(0, 8);
    html += '<div class="onb2-sec"><b>' + E(TYPE_TITLE[tp]) + '</b>' +
      '<span>' + arr.length + '</span></div>';
    html += shown.map(function(h){ return hitHtml(h, S.hits.push(h) - 1, q); }).join('');
    if(arr.length > shown.length){
      html += '<p class="onb2-note">Показаны первые ' + shown.length + ' из ' + arr.length +
        '. Уточни запрос, чтобы увидеть остальное.</p>';
    }
  });
  body.innerHTML = html;
  syncChipCounts(counts);
}

function emptyResultHtml(q, counts){
  var hidden = counts && counts.all ? counts.all : 0;
  var inOther = S.filter !== 'all' && hidden > 0;
  return '<div class="onb2-empty">' +
    '<span class="onb2-ei">' + ic('search') + '</span>' +
    '<b>Ничего не нашлось по «' + E(q) + '»</b>' +
    (inOther
      ? '<p>В фильтре «' + E(typeTitle(S.filter)) + '» пусто, зато в других разделах есть ' + hidden + '. ' +
        'Сними фильтр — покажем всё.</p>' +
        '<button type="button" class="onb2-btn pri" data-flt="all">' + ic('search') + '<span>Искать во всём</span></button>'
      : '<p>Поиск смотрит только по тому, что уже есть в приложении: твои чаты и каналы, курсы и уроки Академии, ' +
        'объявления Биржи, посты ленты и разделы. Если это чужой профиль или свежая запись — они появятся, ' +
        'когда подгрузятся.</p>' +
        '<button type="button" class="onb2-btn" data-clear="1">' + ic('x') + '<span>Очистить запрос</span></button>') +
  '</div>';
}
function typeTitle(k){
  for(var i = 0; i < TYPES.length; i++) if(TYPES[i].k === k) return TYPES[i].t;
  return k;
}

/* ---------- чипы типов ---------- */
function ensureChips(){
  var view = document.getElementById('searchView');
  if(!view || view.querySelector('.onb2-chips')) return;
  var body = document.getElementById('searchBody');
  if(!body) return;
  var bar = document.createElement('div');
  bar.className = 'onb2-chips';
  bar.setAttribute('role','tablist');
  bar.innerHTML = TYPES.map(function(t){
    return '<button type="button" class="onb2-chip' + (S.filter === t.k ? ' on' : '') + '" data-flt="' + t.k + '">' +
      E(t.t) + '<span class="onb2-chip-n" data-cn="' + t.k + '"></span></button>';
  }).join('');
  view.insertBefore(bar, body);
}
function syncChipCounts(counts){
  var view = document.getElementById('searchView');
  if(!view) return;
  view.querySelectorAll('.onb2-chip[data-flt]').forEach(function(b){
    b.classList.toggle('on', b.dataset.flt === S.filter);
  });
  view.querySelectorAll('[data-cn]').forEach(function(el){
    var k = el.dataset.cn;
    var n = counts ? (k === 'all' ? counts.all : (counts[k] || 0)) : 0;
    el.textContent = (counts && n) ? String(n) : '';
  });
  var bar = view.querySelector('.onb2-chips');
  if(bar) bar.style.display = counts ? '' : 'none';
}

/* ---------- кнопка очистки поля ---------- */
function ensureClearBtn(){
  var field = document.querySelector('#searchView .search-field');
  if(!field) return;
  /* подсказка в поле должна отражать реальный охват поиска */
  var inp = field.querySelector('#gSearchInput');
  if(inp && inp.placeholder.indexOf('уроки') < 0){
    inp.placeholder = 'Люди, каналы, чаты, уроки, объявления';
  }
  if(field.querySelector('.onb2-sf-clear')) return;
  var b = document.createElement('button');
  b.type = 'button';
  b.className = 'onb2-sf-clear';
  b.setAttribute('aria-label','Очистить запрос');
  b.innerHTML = ic('x');
  b.addEventListener('click', function(ev){
    ev.preventDefault();
    clearQuery();
  });
  field.appendChild(b);
}
function clearQuery(){
  var inp = document.getElementById('gSearchInput');
  if(inp){ inp.value = ''; try{ inp.focus(); }catch(e){} }
  S.filter = 'all';
  window.renderSearch();
}

/* ---------- главный рендер ---------- */
window.renderSearch = function(){
  try{
    var inp = document.getElementById('gSearchInput');
    var view = document.getElementById('searchView');
    var raw = (inp && inp.value) || '';
    var q = norm(raw);
    S.q = q;
    if(!S.index || S.reindex){ S.index = collect(); S.reindex = false; }
    ensureChips();
    ensureClearBtn();
    bindSearchOnce();
    if(view) view.classList.toggle('onb2-has-q', !!raw.trim());
    if(!q){ renderEmptyQuery(); }
    else { renderResults(q); }
  }catch(e){
    /* поиск не имеет права уронить экран: показываем честную ошибку */
    var body = document.getElementById('searchBody');
    if(body) body.innerHTML = '<div class="onb2-empty"><span class="onb2-ei">' + ic('warning') + '</span>' +
      '<b>Поиск сломался</b><p>Попробуй закрыть и открыть поиск заново.</p></div>';
  }
};

var recentTimer = null;
function bindSearchOnce(){
  if(S.bound) return;
  var body = document.getElementById('searchBody');
  var inp  = document.getElementById('gSearchInput');
  var view = document.getElementById('searchView');
  if(!body || !view) return;
  S.bound = true;

  body.addEventListener('click', function(ev){
    var del = ev.target.closest && ev.target.closest('[data-rq-del]');
    if(del){ ev.preventDefault(); ev.stopPropagation(); recentDel(del.dataset.rqDel); window.renderSearch(); return; }
    var clr = ev.target.closest && ev.target.closest('[data-rq-clear]');
    if(clr){ ev.preventDefault(); lsSet(RECENT_LS, []); window.renderSearch(); return; }
    var rq = ev.target.closest && ev.target.closest('[data-rq]');
    if(rq){
      ev.preventDefault();
      if(inp){ inp.value = rq.dataset.rq; }
      window.renderSearch();
      return;
    }
    var clear = ev.target.closest && ev.target.closest('[data-clear]');
    if(clear){ ev.preventDefault(); clearQuery(); return; }
    var flt = ev.target.closest && ev.target.closest('[data-flt]');
    if(flt){ ev.preventDefault(); S.filter = flt.dataset.flt; window.renderSearch(); return; }
    var hit = ev.target.closest && ev.target.closest('[data-h]');
    if(!hit) return;
    ev.preventDefault();
    var h = S.hits[+hit.dataset.h];
    if(!h) return;
    haptic('impact');
    if(S.q) recentAdd((inp && inp.value) || '');
    try{ h.go(); }catch(e){}
  });

  view.addEventListener('click', function(ev){
    var flt = ev.target.closest && ev.target.closest('.onb2-chips [data-flt]');
    if(!flt) return;
    ev.preventDefault();
    S.filter = flt.dataset.flt;
    window.renderSearch();
  });

  if(inp){
    inp.addEventListener('input', function(){
      clearTimeout(recentTimer);
      var v = inp.value;
      recentTimer = setTimeout(function(){ if(norm(v).length >= 2) recentAdd(v); }, 1400);
    });
    inp.addEventListener('keydown', function(ev){
      if(ev.key === 'Enter'){
        ev.preventDefault();
        recentAdd(inp.value);
        var first = document.querySelector('#searchBody [data-h]');
        if(first) first.click();
      }
    });
  }
}

/* openSearch ядра открывает вьюху и фокусит поле — сохраняем, добавляем сброс */
(function patchOpenSearch(){
  var prev = window.openSearch;
  window.openSearch = function(q){
    S.filter = 'all';
    S.reindex = true;                       /* состояние могло измениться */
    try{ if(typeof prev === 'function') prev(); }catch(e){}
    var inp = document.getElementById('gSearchInput');
    if(inp && typeof q === 'string' && q){ inp.value = q; }
    window.renderSearch();
  };
  window.okoSearchOpen = function(q){ window.openSearch(q); };
})();

/* ===========================================================================
   6 · УВЕДОМЛЕНИЯ
   =========================================================================== */

var NCAT_LS = 'oko-onb2-notif-cats';
var NCATS = [
  {k:'chats',   ico:'chat',      t:'Чаты и сообщения', s:'Ответы, упоминания, голосовые'},
  {k:'partner', ico:'money',     t:'Партнёрка и деньги', s:'Начисления, счета, выплаты'},
  {k:'games',   ico:'play',      t:'Игры',              s:'Рулетка, бонусы, турниры'},
  {k:'academy', ico:'star',      t:'Академия',          s:'Новые уроки, сертификаты, дедлайны'},
  {k:'system',  ico:'bell',      t:'Система OKO',       s:'Заявки, модерация, обновления'}
];
var NCAT_TAB = { chats:'chats', partner:'partner', games:'games', academy:'academy', system:'profile' };

function ncats(){
  var v = lsGet(NCAT_LS, null);
  var out = {};
  NCATS.forEach(function(c){ out[c.k] = !v || v[c.k] !== false; });
  return out;
}
function ncatSet(k, on){
  var v = ncats(); v[k] = !!on; lsSet(NCAT_LS, v);
}

/* Категория уведомления — тем же способом, что и в notifs-plus. */
function catOfN(n){
  if(!n) return 'system';
  if(n.cat) return n.cat;
  var who = String(n.who || '').toLowerCase();
  var i = n.ic || '';
  if(i === 'money' || /партн|referral|вывод|выплат/i.test(who)) return 'partner';
  if(/академ|курс|урок|academy|lesson/i.test(who)) return 'academy';
  if(/игр|рулетк|game|дорог/i.test(who)) return 'games';
  if(i === 'chat' || i === 'mic' || /чат|сообщ/i.test(who)) return 'chats';
  if(i === 'heart' || i === 'comment' || i === 'star') return 'chats';
  return 'system';
}

/* «5 мин» / «вчера» → миллисекунды назад. Нужно, чтобы разложить старые
   уведомления по реальным дням, а не по строке «Сегодня». */
function ageMs(t){
  t = String(t || '').trim().toLowerCase();
  if(!t) return 0;
  if(/только что|сейчас/.test(t)) return 0;
  var m = t.match(/(\d+)\s*мин/); if(m) return +m[1] * 60000;
  var h = t.match(/(\d+)\s*ч/);   if(h) return +h[1] * 3600000;
  var d = t.match(/(\d+)\s*д/);   if(d) return +d[1] * 86400000;
  if(/вчера/.test(t)) return 86400000;
  if(/недел/.test(t)) return 604800000;
  return 0;
}
var MONTHS = ['января','февраля','марта','апреля','мая','июня','июля','августа','сентября','октября','ноября','декабря'];
function dayLabel(ts){
  var d = new Date(ts), now = new Date();
  var d0 = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  var n0 = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  var diff = Math.round((n0 - d0) / 86400000);
  if(diff <= 0) return 'Сегодня';
  if(diff === 1) return 'Вчера';
  if(diff < 7) return 'На этой неделе';
  return d.getDate() + ' ' + MONTHS[d.getMonth()] + (d.getFullYear() !== now.getFullYear() ? ' ' + d.getFullYear() : '');
}
function relTime(ts){
  var s = Math.max(0, Date.now() - ts);
  if(s < 60000) return 'только что';
  var m = Math.floor(s / 60000);
  if(m < 60) return m + ' мин';
  var h = Math.floor(m / 60);
  if(h < 24) return h + ' ч';
  var d = Math.floor(h / 24);
  if(d === 1) return 'вчера';
  if(d < 8) return d + ' д';
  return new Date(ts).toLocaleDateString('ru-RU', {day:'2-digit', month:'2-digit'});
}

/* Перед каждым рендером: реальная дата, честное относительное время,
   категория и переход к источнику — чтобы тап всегда куда-то вёл. */
function prepNotifs(){
  if(typeof NOTIFS === 'undefined' || !Array.isArray(NOTIFS)) return;
  NOTIFS.forEach(function(n){
    if(!n) return;
    if(!n.at) n.at = Date.now() - ageMs(n.time);
    n.cat = catOfN(n);
    n.g = dayLabel(n.at);
    n.time = relTime(n.at);
    if(typeof n.act !== 'function'){
      var target = NCAT_TAB[n.cat] || 'feed';
      n.act = (function(t){ return function(){ tab(t); }; })(target);
    }
  });
}

/* Панель настроек по категориям — внутрь существующей .np-settings */
function ensureCatSettings(){
  var box = document.querySelector('#notifsView .np-settings');
  if(!box || box.querySelector('.onb2-np-cats')) return;
  var st = ncats();
  var wrap = document.createElement('div');
  wrap.className = 'onb2-np-cats';
  wrap.innerHTML =
    '<div class="onb2-sec-t">Категории уведомлений</div>' +
    NCATS.map(function(c){
      return '<div class="onb2-np-row">' +
        '<span class="onb2-np-ic">' + ic(c.ico) + '</span>' +
        '<span class="onb2-np-t"><b>' + E(c.t) + '</b><small>' + E(c.s) + '</small></span>' +
        '<span class="onb2-sw' + (st[c.k] ? ' on' : '') + '" data-ncat="' + c.k + '" role="switch" ' +
          'aria-checked="' + (st[c.k] ? 'true' : 'false') + '" tabindex="0" aria-label="' + E(c.t) + '"></span>' +
      '</div>';
    }).join('');
  wrap.addEventListener('click', function(ev){
    var sw = ev.target.closest && ev.target.closest('[data-ncat]');
    if(!sw) return;
    var k = sw.dataset.ncat;
    var on = !sw.classList.contains('on');
    ncatSet(k, on);
    sw.classList.toggle('on', on);
    sw.setAttribute('aria-checked', on ? 'true' : 'false');
    haptic('select');
    if(fn('renderNotifs')) window.renderNotifs();
  });
  box.appendChild(wrap);
}

/* После рендера: убрать отключённые категории, честные действия, «Прочитать всё» */
function decorateNotifs(){
  var view = document.getElementById('notifsView');
  if(!view) return;
  ensureCatSettings();

  var st = ncats();
  var body = document.getElementById('notifsBody');
  if(!body) return;

  /* 1) скрыть строки отключённых категорий */
  var hidden = 0, offCats = [];
  NCATS.forEach(function(c){ if(!st[c.k]) offCats.push(c.t); });
  body.querySelectorAll('.np-row[data-cat]').forEach(function(row){
    var off = st[row.dataset.cat] === false;
    row.style.display = off ? 'none' : '';
    if(off) hidden++;
  });
  /* заголовок дня без единой видимой строки под ним — тоже прячем */
  var kids = [].slice.call(body.children);
  kids.forEach(function(el, i){
    if(!el.classList || !el.classList.contains('nt-group')) return;
    var any = false;
    for(var j = i + 1; j < kids.length; j++){
      if(kids[j].classList && kids[j].classList.contains('nt-group')) break;
      if(kids[j].style.display !== 'none'){ any = true; break; }
    }
    el.style.display = any ? '' : 'none';
  });

  /* 2) честные действия в строке: только то, что реально произойдёт */
  body.querySelectorAll('.np-row .np-quick').forEach(function(q){
    if(q.dataset.onb2 === '1') return;
    q.dataset.onb2 = '1';
    q.innerHTML = '<span class="np-q ghost" data-a="open">' +
      '<svg class="i" style="transform:rotate(180deg)"><use href="#i-back"/></svg> Открыть</span>';
  });
  body.querySelectorAll('.np-row .np-reply').forEach(function(r){ r.remove(); });

  /* 3) плашка про отключённые категории — честно объясняем, куда всё делось */
  var note = body.querySelector('.onb2-np-muted');
  if(hidden && offCats.length){
    if(!note){
      note = document.createElement('div');
      note.className = 'onb2-np-muted';
      note.addEventListener('click', function(ev){
        if(!(ev.target.closest && ev.target.closest('button'))) return;
        NCATS.forEach(function(c){ ncatSet(c.k, true); });
        if(fn('renderNotifs')) window.renderNotifs();
      });
      body.appendChild(note);
    }
    note.innerHTML = 'Скрыто ' + hidden + ' ' + plural(hidden, 'уведомление', 'уведомления', 'уведомлений') +
      ': выключены категории «' + E(offCats.join('», «')) + '».<br>' +
      '<button type="button">Включить все категории</button>';
  } else if(note){
    note.remove();
  }

  /* 4) если всё скрыто фильтрами — не оставляем человека с пустотой без объяснения */
  var visible = body.querySelectorAll('.np-row:not([style*="display: none"])').length;
  var emptyBox = body.querySelector('.np-empty');
  if(!visible && !emptyBox && hidden){
    var e2 = document.createElement('div');
    e2.className = 'onb2-empty';
    e2.innerHTML = '<span class="onb2-ei">' + ic('bell') + '</span>' +
      '<b>Всё скрыто настройками</b>' +
      '<p>Уведомления есть, но их категории выключены. Включи нужные ниже — и они вернутся.</p>';
    body.insertBefore(e2, body.firstChild);
  }

  /* 5) «Прочитать всё» с числом; когда читать нечего — кнопки нет */
  try{
    var done = view.querySelector('.ep-done');
    if(done){
      var unread = 0;
      if(typeof NOTIFS !== 'undefined' && Array.isArray(NOTIFS)){
        NOTIFS.forEach(function(n){ if(n && n.unread && st[catOfN(n)] !== false) unread++; });
      }
      /* число непрочитанных уже стоит на чипе «Всё» — в кнопке оно лишнее:
         на 390 px из-за него заголовок «Уведомления» уезжал в многоточие */
      done.textContent = 'Прочитать всё';
      done.title = unread ? 'Непрочитанных: ' + unread : '';
      done.style.display = unread ? '' : 'none';
    }
  }catch(e){}
}

(function patchNotifs(){
  var prev = window.renderNotifs;
  if(typeof prev !== 'function') return;
  window.renderNotifs = function(){
    try{ prepNotifs(); }catch(e){}
    var r;
    try{ r = prev.apply(this, arguments); }catch(e){}
    try{ decorateNotifs(); }catch(e){}
    return r;
  };
  var prevOpen = window.openNotifs;
  if(typeof prevOpen === 'function'){
    window.openNotifs = function(){
      var r = prevOpen.apply(this, arguments);
      try{ decorateNotifs(); }catch(e){}
      return r;
    };
  }
  /* «Прочитать» ядра метит всё разом — оставляем поведение, но обновляем вид */
  var prevAll = window.markAllRead;
  if(typeof prevAll === 'function'){
    window.markAllRead = function(){
      var had = 0;
      try{ if(Array.isArray(NOTIFS)) NOTIFS.forEach(function(n){ if(n && n.unread) had++; }); }catch(e){}
      var r = prevAll.apply(this, arguments);
      if(had) say('Отмечено прочитанным: ' + had);
      return r;
    };
  }
})();

/* ===========================================================================
   7 · СТАРТ
   =========================================================================== */

/* Строка в профиле: знакомство можно пройти или переписать в любой момент.
   Без неё обещание «ответы можно дать позже» было бы пустым. */
function addProfileRow(){
  try{
    var rows = document.querySelectorAll('#screen-profile .prow');
    var logout = null;
    Array.prototype.forEach.call(rows, function(r){
      if((r.getAttribute('onclick') || '').indexOf('doLogout') > -1) logout = r;
    });
    if(!logout || document.getElementById('onb2ProwIntro')) return;
    var b = document.createElement('button');
    b.className = 'prow';
    b.id = 'onb2ProwIntro';
    b.innerHTML = ic('compass') + ' <span>Знакомство с OKO</span> <span class="chev">' + ic('chev') + '</span>';
    b.onclick = function(){ introOpen(true); };
    logout.parentNode.insertBefore(b, logout);
  }catch(e){}
}

function boot(){
  decorateAuthScreen();
  addProfileRow();
  try{
    var prof = document.getElementById('screen-profile');
    if(prof && 'MutationObserver' in window){
      new MutationObserver(function(){ addProfileRow(); }).observe(prof, {childList:true, subtree:true});
    }
  }catch(e){}
  /* экран входа появляется не сразу (сначала splash) — дожидаемся */
  try{
    var scr = document.getElementById('authScreen');
    if(scr && 'MutationObserver' in window){
      new MutationObserver(function(){ decorateAuthScreen(); })
        .observe(scr, {attributes:true, attributeFilter:['class'], childList:true});
    }
  }catch(e){}
  /* уже вошёл раньше, знакомство не проходил — покажем, когда всё уляжется */
  try{ if(typeof authed === 'function' && authed()) maybeIntro(2600); }catch(e){}
}

if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, {once:true});
else boot();

try{ console.log('[oko-onb2] готов'); }catch(e){}

})();
