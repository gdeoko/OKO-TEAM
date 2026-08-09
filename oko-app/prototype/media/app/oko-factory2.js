/* ============================================================================
   OKO · oko-factory2.js — КОНТЕНТ-ЗАВОД и ПРОВЕРКА ВИДЕО «готово к запуску»
   ----------------------------------------------------------------------------
   Задача волны: довести два мини-аппа до состояния, когда их не стыдно
   показать человеку, который платит деньги.

   ЧТО БЫЛО СЛОМАНО В ЯДРЕ (index.html) И ЗАЧЕМ НУЖЕН ЭТОТ СЛОЙ
   ------------------------------------------------------------
   Контент-завод (префикс fx):
     • fxBuild() показывал «Наши сценаристы собирают контент-план…», ждал
       полторы секунды по setTimeout и выдавал 7 строк, склеенных из шаблона
       fxIdeas() — никакой генерации не было;
     • fxTick() каждые 900 мс двигал задачи по стадиям Сценарий → Озвучка →
       Монтаж → Субтитры → Готово → ОПУБЛИКОВАНО. Приложение писало
       «В эфире» и «опубликовано: N» — при том, что ни один ролик не был
       ни собран, ни куда-либо отправлен. Это прямая ложь интерфейса;
     • блок «Что получишь через 3 часа» обещал 30 роликов в месяц и охват
       60–90 тысяч на ролик — выдуманные метрики;
     • «ПРИМЕР РОЛИКА №1, ниша фитнес для мам» — выдуманный клиент;
     • сравнение «28 000 ₽ за ролик против 990 ₽» — выдуманный прайс.

   Проверка видео (префикс vc):
     • кнопка «Загрузить ролик» вообще не открывала выбор файла — vcStart()
       сразу крутил фальшивый прогресс-бар четырьмя фразами;
     • VC_METRICS/VC_RISKS/VC_RECS — жёстко зашитые числа (81, 64, 88, 72,
       79, 58) и «обнаружена авторская музыка», которые печатались для
       ЛЮБОГО файла, включая случай, когда файла не было вовсе;
     • «Вероятность рекомендаций 62%» и кольцо «готовность 78%» —
       арифметика по выдуманным числам, то есть тоже выдумка;
     • кнопка «Исправить одним кликом» показывала тост «Обложка, субтитры и
       трек пересобраны — готовность 91%» и не делала ничего;
     • vcHistAdd() записывал эту выдумку в localStorage как «твою историю
       проверок», и дальше человек видел свою же ложь как факт;
     • vcOpenSample() открывал «пример вердикта» с выдуманным клиентом и
       выдуманным треком Ariana Grande.

   ЧТО ДЕЛАЕТ ЭТОТ СЛОЙ
   --------------------
   КОНТЕНТ-ЗАВОД — честный трекер производства, а не имитация фабрики:
     1) Постановка задачи — бриф из полей, которые реально нужны сценаристу.
        Сохраняется локально, ничего никуда не уходит.
     2) Сценарий — либо пишется руками прямо здесь (это работает и
        сохраняется), либо отправляется на генерацию. Генерация возможна
        только когда у приложения есть адрес сервера OKO и на сервере лежат
        ключи моделей. Сейчас адреса нет — приложение прямо называет, какой
        переменной окружения не хватает и где её взять, и предлагает
        поставить задачу в локальную очередь. Прогресс-баров «идёт
        генерация» нет и не будет.
     3) Производство — чек-лист из шести шагов, галочки ставит человек.
        Ни одна галочка не ставится сама.
     4) Готовые материалы — только те задачи, где человек сам отметил
        готовность и вставил ссылку. Экспорт брифа и сценария в файл и в
        буфер обмена — настоящий.
     Очередь, статусы, отмена, повтор, удаление, журнал событий — всё из
     реального состояния в localStorage, ничего не придумывается.

   ПРОВЕРКА ВИДЕО — настоящий разбор файла в браузере:
     • файл выбирается настоящим <input type="file">;
     • реально измеряются: имя, размер, MIME-тип, длительность, ширина,
       высота, соотношение сторон, средний битрейт, оценка частоты кадров
       (по requestVideoFrameCallback), наличие звуковой дорожки, средняя
       яркость и межкадровое отличие по пяти снятым кадрам;
     • измеренное сверяется с техтребованиями выбранной площадки —
       получается список «подходит / не подходит / не удалось проверить»;
     • никаких баллов виральности, готовности и «вероятности
       рекомендаций»: их нельзя посчитать в браузере, и в отчёте прямо
       написано, что для этого нужен сервер;
     • история проверок — только настоящие замеры; старый ключ с выдуманными
       баллами очищается при первом запуске слоя.

   ПРИНЦИПЫ (правила проекта, действуют всегда):
     • Ноль демо-данных. Пусто — значит empty-state с объяснением.
     • Никаких ложных подтверждений.
     • Никаких ключей и реквизитов в коде: ключи живут только в переменных
       окружения сервера, приложение их не видит и видеть не должно.
     • Только SVG из общего спрайта index.html, эмодзи запрещены.
     • Безопасные зоны только через var(--oko-safe-*).
     • Текст не обрезается и не рвётся посреди слова; технические строки
       (имена файлов) помечены классом .oko-breakable.

   Слой самодостаточный: грузится ПОСЛЕ ядра, стили кладёт одним <style>
   в <head>, ядро не переписывает — подменяет глобальные функции и
   перерисовывает только свои два экрана.
   ============================================================================ */
(function okoFactory2(){
'use strict';

if(window.__okoFactory2Ready) return;
window.__okoFactory2Ready = true;

/* ===========================================================================
   0. УТИЛИТЫ
   =========================================================================== */

function q(sel, root){ return (root || document).querySelector(sel); }
function qa(sel, root){ return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }

/* иконка из общего спрайта index.html (эмодзи в интерфейсе запрещены) */
function ic(name, cls){
  return '<svg class="i ' + (cls || '') + '" aria-hidden="true"><use href="#i-' + name + '"/></svg>';
}

function E(t){
  return String(t == null ? '' : t).replace(/[&<>"']/g, function(c){
    return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];
  });
}

/* число с неразрывными узкими пробелами — «1 080» не переносится */
function num(n){
  n = Math.round(+n || 0);
  return n.toLocaleString('ru-RU').replace(/,/g, ' ').replace(/ /g, ' ');
}

function say(m){ try{ if(typeof toast === 'function') toast(m); }catch(e){} }

function popup(o){
  try{
    if(typeof showPopup === 'function'){ showPopup(o); return true; }
  }catch(e){}
  say(o && o.title ? o.title : '');
  return false;
}

function uid(){ return 't' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }

function nowIso(){ return new Date().toISOString(); }

/* дата человеком: «9 авг, 14:05» */
function human(iso){
  try{
    var d = new Date(iso);
    if(isNaN(d.getTime())) return '—';
    return d.toLocaleString('ru-RU', {day:'2-digit', month:'short', hour:'2-digit', minute:'2-digit'});
  }catch(e){ return '—'; }
}

function readJson(key, fallback){
  try{
    var raw = localStorage.getItem(key);
    if(!raw) return fallback;
    var v = JSON.parse(raw);
    return (v == null) ? fallback : v;
  }catch(e){ return fallback; }
}

function writeJson(key, value){
  try{ localStorage.setItem(key, JSON.stringify(value)); return true; }
  catch(e){ return false; }
}

/* настоящее копирование в буфер; false — если браузер не дал */
function copyText(text){
  try{
    if(navigator.clipboard && navigator.clipboard.writeText){
      navigator.clipboard.writeText(text);
      return true;
    }
  }catch(e){}
  try{
    var ta = document.createElement('textarea');
    ta.value = text;
    ta.setAttribute('readonly', 'readonly');
    ta.style.position = 'fixed';
    ta.style.left = '-9999px';
    document.body.appendChild(ta);
    ta.select();
    var ok = document.execCommand('copy');
    document.body.removeChild(ta);
    return !!ok;
  }catch(e){ return false; }
}

/* настоящее скачивание файла из строки */
function downloadText(filename, text){
  try{
    var blob = new Blob([text], {type:'text/plain;charset=utf-8'});
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url; a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(function(){ try{ URL.revokeObjectURL(url); }catch(e){} }, 4000);
    return true;
  }catch(e){ return false; }
}

function bytes(n){
  n = +n || 0;
  if(n < 1024) return num(n) + ' Б';
  if(n < 1024 * 1024) return (n / 1024).toFixed(0).replace('.', ',') + ' КБ';
  if(n < 1024 * 1024 * 1024) return (n / 1024 / 1024).toFixed(1).replace('.', ',') + ' МБ';
  return (n / 1024 / 1024 / 1024).toFixed(2).replace('.', ',') + ' ГБ';
}

function secs(s){
  s = +s || 0;
  if(!isFinite(s) || s <= 0) return '—';
  var m = Math.floor(s / 60), r = s - m * 60;
  if(m) return m + ' мин ' + (Math.round(r)) + ' сек';
  return (s < 10 ? s.toFixed(1).replace('.', ',') : Math.round(s)) + ' сек';
}

function gcd(a, b){ a = Math.abs(a); b = Math.abs(b); while(b){ var t = b; b = a % b; a = t; } return a || 1; }

/* «1080×1920» → «9:16» */
function ratioOf(w, h){
  if(!w || !h) return '—';
  var g = gcd(w, h);
  var rw = Math.round(w / g), rh = Math.round(h / g);
  /* длинные дроби вида 427:240 человеку не нужны — округляем до знакомых */
  if(rw > 40 || rh > 40){
    var known = [[9,16],[16,9],[1,1],[4,5],[5,4],[3,4],[4,3],[2,3],[3,2],[21,9]];
    var r = w / h, best = null, bestD = 1e9;
    known.forEach(function(k){
      var d = Math.abs(k[0] / k[1] - r);
      if(d < bestD){ bestD = d; best = k; }
    });
    if(best && bestD < 0.04) return '≈' + best[0] + ':' + best[1];
    return (r).toFixed(2).replace('.', ',') + ':1';
  }
  return rw + ':' + rh;
}

/* ===========================================================================
   1. СТИЛИ СЛОЯ (один <style> в head, ничего внешнего)
   =========================================================================== */

(function injectStyles(){
  if(document.getElementById('okoFactory2Style')) return;
  var st = document.createElement('style');
  st.id = 'okoFactory2Style';
  st.textContent = [
    /* --- общие блоки обоих мини-аппов --- */
    '.fx2-wrap,.vc2-wrap{display:block}',
    '.fx2-card,.vc2-card{background:var(--card,var(--surface));border:1px solid var(--border);border-radius:var(--r-md,14px);padding:16px;margin-bottom:12px}',
    '.fx2-card+.fx2-card,.vc2-card+.vc2-card{margin-top:0}',
    '.fx2-h,.vc2-h{font-weight:800;font-size:14.5px;line-height:1.35;margin:0 0 8px;color:var(--text);overflow-wrap:break-word}',
    '.fx2-p,.vc2-p{font-size:12.8px;line-height:1.6;color:var(--dim);margin:0 0 10px;overflow-wrap:break-word}',
    '.fx2-p:last-child,.vc2-p:last-child{margin-bottom:0}',
    '.fx2-lab{font-size:11px;font-weight:800;letter-spacing:.07em;text-transform:uppercase;color:var(--dim);margin:0 0 7px;display:block}',

    /* honest-плашка «чего не хватает» */
    '.fx2-need{border:1px dashed var(--border);border-radius:var(--r-md,14px);padding:13px 14px;background:var(--raised);margin:0 0 12px}',
    '.fx2-need-h{display:flex;align-items:flex-start;gap:9px;font-weight:800;font-size:13px;line-height:1.4;color:var(--text);margin-bottom:8px}',
    '.fx2-need-h .i{width:17px;height:17px;flex:0 0 17px;margin-top:1px;stroke:var(--lime)}',
    '.fx2-need ul{list-style:none;margin:0;padding:0}',
    '.fx2-need li{font-size:12.3px;line-height:1.6;color:var(--dim);padding:5px 0 5px 14px;position:relative;overflow-wrap:break-word}',
    '.fx2-need li::before{content:"";position:absolute;left:0;top:11px;width:5px;height:5px;border-radius:50%;background:var(--lime);opacity:.75}',
    '.fx2-need code{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:11.6px;color:var(--text);background:var(--surface);border:1px solid var(--border);border-radius:5px;padding:1px 5px}',

    /* поля ввода */
    '.fx2-field{margin-bottom:14px}',
    '.fx2-field:last-child{margin-bottom:0}',
    '.fx2-field>label{display:block;font-weight:700;font-size:13px;color:var(--text);margin-bottom:5px;line-height:1.4}',
    '.fx2-field>small{display:block;font-size:11.5px;line-height:1.5;color:var(--dim);margin:-2px 0 6px}',
    '.fx2-in,.fx2-ta{width:100%;background:var(--raised);border:1px solid var(--border);border-radius:10px;color:var(--text);font-family:var(--font-body);font-size:14px;line-height:1.5;padding:11px 12px;outline:none}',
    '.fx2-in:focus,.fx2-ta:focus{border-color:var(--lime);box-shadow:0 0 0 3px var(--lime-dim)}',
    '.fx2-ta{resize:vertical;min-height:104px}',
    '.fx2-ta.tall{min-height:200px}',

    /* пилюли выбора */
    '.fx2-pills{display:flex;flex-wrap:wrap;gap:7px}',
    '.fx2-pill{background:var(--raised);border:1px solid var(--border);color:var(--dim);border-radius:99px;padding:8px 13px;font-size:12.5px;font-weight:700;font-family:var(--font-body);cursor:pointer;line-height:1.25;max-width:100%;overflow-wrap:break-word;text-align:left}',
    '.fx2-pill.on{background:var(--lime-dim);border-color:var(--lime);color:var(--accent)}',

    /* кнопки слоя */
    '.fx2-btns{display:flex;flex-wrap:wrap;gap:8px;margin-top:14px}',
    '.fx2-btn{flex:1 1 auto;min-width:130px;display:inline-flex;align-items:center;justify-content:center;gap:8px;background:var(--lime);color:#07130a;border:1px solid var(--lime);border-radius:11px;font-family:var(--font-body);font-weight:800;font-size:13.5px;line-height:1.3;padding:12px 14px;cursor:pointer;text-align:center}',
    '.fx2-btn .i{width:17px;height:17px;flex:0 0 17px;stroke:currentColor}',
    '.fx2-btn.ghost{background:transparent;color:var(--text);border-color:var(--border)}',
    '.fx2-btn.warn{background:transparent;color:var(--danger);border-color:var(--danger)}',
    '.fx2-btn.sm{min-width:0;flex:0 0 auto;padding:9px 12px;font-size:12.5px}',
    '.fx2-btn[disabled]{opacity:.45;cursor:default}',

    /* список задач */
    '.fx2-task{display:block;width:100%;text-align:left;background:var(--raised);border:1px solid var(--border);border-radius:12px;padding:13px 14px;margin-bottom:9px;cursor:pointer;font-family:var(--font-body)}',
    '.fx2-task:last-child{margin-bottom:0}',
    '.fx2-task-top{display:flex;align-items:flex-start;gap:9px}',
    '.fx2-task-t{flex:1;min-width:0;font-weight:800;font-size:13.6px;line-height:1.4;color:var(--text);overflow-wrap:break-word}',
    '.fx2-task-m{display:block;font-weight:600;font-size:11.6px;line-height:1.5;color:var(--dim);margin-top:4px;overflow-wrap:break-word}',
    '.fx2-st{display:inline-flex;align-items:center;gap:5px;flex:0 0 auto;border-radius:99px;padding:4px 9px;font-size:11px;font-weight:800;line-height:1.3;white-space:nowrap}',
    '.fx2-st.draft{background:var(--raised);border:1px solid var(--border);color:var(--dim)}',
    '.fx2-st.queued{background:var(--lime-dim);border:1px solid var(--lime);color:var(--accent)}',
    /* палитра бренда — чёрный и лайм; для «в работе» берём нейтральную
       обводку, а не жёлтый: посторонних цветов в интерфейсе нет */
    '.fx2-st.work{background:var(--raised);border:1px solid var(--text);color:var(--text)}',
    '.fx2-st.done{background:var(--lime-dim);border:1px solid var(--lime);color:var(--accent)}',
    '.fx2-st.off{background:transparent;border:1px dashed var(--border);color:var(--dim)}',

    /* шаги задачи */
    '.fx2-step{border:1px solid var(--border);border-radius:12px;margin-bottom:10px;overflow:hidden;background:var(--raised)}',
    '.fx2-step:last-child{margin-bottom:0}',
    '.fx2-step-h{display:flex;align-items:center;gap:10px;width:100%;background:transparent;border:0;padding:13px 14px;cursor:pointer;font-family:var(--font-body);text-align:left}',
    '.fx2-step-n{flex:0 0 24px;width:24px;height:24px;border-radius:50%;border:1px solid var(--border);display:flex;align-items:center;justify-content:center;font-size:11.5px;font-weight:800;color:var(--dim)}',
    '.fx2-step.ok .fx2-step-n{background:var(--lime);border-color:var(--lime);color:#07130a}',
    '.fx2-step-t{flex:1;min-width:0;font-weight:800;font-size:13.4px;line-height:1.4;color:var(--text);overflow-wrap:break-word}',
    '.fx2-step-t small{display:block;font-weight:600;font-size:11.4px;line-height:1.5;color:var(--dim);margin-top:3px}',
    '.fx2-step-ch{flex:0 0 16px;width:16px;height:16px;stroke:var(--dim);transition:transform .18s ease}',
    '.fx2-step.open .fx2-step-ch{transform:rotate(90deg)}',
    '.fx2-step-b{padding:0 14px 14px;display:none}',
    '.fx2-step.open .fx2-step-b{display:block}',

    /* чек-лист производства */
    '.fx2-check{display:flex;align-items:flex-start;gap:10px;width:100%;background:transparent;border:0;border-top:1px solid var(--border);padding:11px 0;cursor:pointer;font-family:var(--font-body);text-align:left}',
    '.fx2-check:first-child{border-top:0}',
    '.fx2-box{flex:0 0 20px;width:20px;height:20px;border-radius:6px;border:1px solid var(--border);display:flex;align-items:center;justify-content:center;margin-top:1px}',
    '.fx2-box .i{width:12px;height:12px;stroke:#07130a;opacity:0}',
    '.fx2-check.on .fx2-box{background:var(--lime);border-color:var(--lime)}',
    '.fx2-check.on .fx2-box .i{opacity:1}',
    '.fx2-check-t{flex:1;min-width:0;font-size:13px;font-weight:700;line-height:1.45;color:var(--text);overflow-wrap:break-word}',
    '.fx2-check-t small{display:block;font-weight:500;font-size:11.4px;line-height:1.5;color:var(--dim);margin-top:3px}',

    /* журнал */
    '.fx2-log{border-top:1px solid var(--border);margin-top:12px;padding-top:10px}',
    '.fx2-log-i{display:flex;gap:9px;font-size:11.8px;line-height:1.55;color:var(--dim);padding:4px 0;overflow-wrap:break-word}',
    '.fx2-log-i b{flex:0 0 auto;color:var(--text);font-weight:700;white-space:nowrap}',

    /* пустой экран */
    '.fx2-empty{text-align:center;padding:26px 14px}',
    '.fx2-empty .i{width:38px;height:38px;stroke:var(--dim);opacity:.55;margin-bottom:10px}',
    '.fx2-empty b{display:block;font-size:14px;font-weight:800;color:var(--text);margin-bottom:6px;line-height:1.4}',
    '.fx2-empty p{font-size:12.5px;line-height:1.6;color:var(--dim);margin:0 auto;max-width:34em}',

    /* сводка очереди */
    '.fx2-sum{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:7px;margin-top:12px}',
    '.fx2-sum div{background:var(--raised);border:1px solid var(--border);border-radius:10px;padding:9px 6px;text-align:center;min-width:0}',
    '.fx2-sum b{display:block;font-family:var(--font-display);font-size:21px;line-height:1.05;color:var(--text);letter-spacing:.02em}',
    '.fx2-sum small{display:block;font-size:10.3px;line-height:1.35;color:var(--dim);margin-top:3px;overflow-wrap:break-word;hyphens:none}',
    '@media(max-width:340px){.fx2-sum{grid-template-columns:repeat(2,minmax(0,1fr))}}',

    /* --- проверка видео --- */
    '.vc2-drop{border:1px dashed var(--border);border-radius:var(--r-md,14px);background:var(--raised);padding:20px 16px;text-align:center}',
    '.vc2-drop .i{width:34px;height:34px;stroke:var(--lime);margin-bottom:10px}',
    '.vc2-drop b{display:block;font-size:14.5px;font-weight:800;color:var(--text);line-height:1.4;margin-bottom:6px}',
    '.vc2-drop p{font-size:12.4px;line-height:1.6;color:var(--dim);margin:0 auto 14px;max-width:34em}',
    '.vc2-file{display:none}',
    '.vc2-stage{display:flex;align-items:center;gap:9px;font-size:12.8px;font-weight:700;color:var(--text);line-height:1.45;margin-bottom:9px;overflow-wrap:break-word}',
    '.vc2-prog{height:6px;border-radius:99px;background:var(--raised);border:1px solid var(--border);overflow:hidden}',
    '.vc2-prog i{display:block;height:100%;background:var(--lime);width:0;transition:width .25s ease}',

    /* факты */
    '.vc2-facts{display:grid;grid-template-columns:repeat(auto-fit,minmax(126px,1fr));gap:8px}',
    '.vc2-fact{background:var(--raised);border:1px solid var(--border);border-radius:10px;padding:10px 11px;min-width:0}',
    '.vc2-fact span{display:block;font-size:10.6px;font-weight:800;letter-spacing:.05em;text-transform:uppercase;color:var(--dim);line-height:1.35;margin-bottom:4px;overflow-wrap:break-word}',
    '.vc2-fact b{display:block;font-size:14px;font-weight:800;color:var(--text);line-height:1.4;overflow-wrap:break-word}',
    '.vc2-fact small{display:block;font-size:11px;line-height:1.5;color:var(--dim);margin-top:3px;overflow-wrap:break-word}',

    /* строки проверок */
    '.vc2-row{display:flex;align-items:flex-start;gap:10px;border-top:1px solid var(--border);padding:11px 0}',
    '.vc2-row:first-child{border-top:0}',
    '.vc2-ic{flex:0 0 22px;width:22px;height:22px;border-radius:50%;display:flex;align-items:center;justify-content:center;margin-top:1px}',
    '.vc2-ic .i{width:12px;height:12px}',
    '.vc2-ic.ok{background:var(--lime-dim)} .vc2-ic.ok .i{stroke:var(--accent)}',
    '.vc2-ic.bad{background:rgba(255,77,77,.14)} .vc2-ic.bad .i{stroke:var(--danger)}',
    '.vc2-ic.unk{background:var(--raised);border:1px solid var(--border)} .vc2-ic.unk .i{stroke:var(--dim)}',
    '.vc2-row-b{flex:1;min-width:0}',
    '.vc2-row-b b{display:block;font-size:13px;font-weight:800;color:var(--text);line-height:1.45;overflow-wrap:break-word}',
    '.vc2-row-b small{display:block;font-size:11.6px;line-height:1.55;color:var(--dim);margin-top:3px;overflow-wrap:break-word}',

    /* итог проверок */
    '.vc2-tot{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px;margin-bottom:12px}',
    '.vc2-tot div{border:1px solid var(--border);border-radius:11px;padding:11px 8px;text-align:center;min-width:0;background:var(--raised)}',
    '.vc2-tot b{display:block;font-family:var(--font-display);font-size:26px;line-height:1;color:var(--text)}',
    '.vc2-tot small{display:block;font-size:10.6px;line-height:1.4;color:var(--dim);margin-top:5px;overflow-wrap:break-word}',
    '.vc2-tot .g b{color:var(--accent)}',

    /* история */
    '.vc2-hi{display:flex;align-items:flex-start;gap:10px;background:var(--raised);border:1px solid var(--border);border-radius:11px;padding:11px 12px;margin-bottom:8px}',
    '.vc2-hi:last-child{margin-bottom:0}',
    '.vc2-hi-b{flex:1;min-width:0}',
    '.vc2-hi-b b{display:block;font-size:13px;font-weight:800;color:var(--text);line-height:1.4;overflow-wrap:break-word}',
    '.vc2-hi-b small{display:block;font-size:11.3px;line-height:1.55;color:var(--dim);margin-top:3px;overflow-wrap:break-word}',
    '.vc2-hi-x{flex:0 0 auto;background:transparent;border:0;padding:4px;cursor:pointer;line-height:0}',
    '.vc2-hi-x .i{width:15px;height:15px;stroke:var(--dim)}',

    /* превью выбранного файла */
    '.vc2-prev{width:100%;max-width:220px;border-radius:12px;border:1px solid var(--border);background:#000;display:block;margin:0 auto 12px}',

    /* ссылки в тексте */
    '.fx2-a{color:var(--accent);text-decoration:underline;text-underline-offset:2px;overflow-wrap:break-word}'
  ].join('\n');
  (document.head || document.documentElement).appendChild(st);
})();

/* ===========================================================================
   2. КОНТЕНТ-ЗАВОД
   =========================================================================== */

var FX_KEY = 'oko-fx2-v1';

/* Форматы материала — то, что завод реально умеет описывать заданием. */
var FX_FORMATS = [
  {k:'clip',     n:'Клип 9:16',        d:'вертикальное видео до 90 секунд'},
  {k:'tgpost',   n:'Пост в Telegram',  d:'текст с картинкой в канал'},
  {k:'carousel', n:'Карусель',         d:'серия кадров 4:5 с текстом'},
  {k:'long',     n:'Длинное видео',    d:'горизонталь 16:9 от 3 минут'}
];

var FX_CHANNELS2 = [
  {k:'tg', n:'Telegram'},
  {k:'vk', n:'VK Клипы'},
  {k:'yt', n:'YouTube Shorts'},
  {k:'ig', n:'Instagram'},
  {k:'tt', n:'TikTok'}
];

var FX_TONES = ['Дружеский', 'Экспертный', 'Дерзкий', 'Спокойный', 'Вдохновляющий'];

/* Шаги производства. server:true — шаг физически нельзя выполнить в браузере,
   об этом написано прямо в подписи. Галочку в любом случае ставит человек. */
var FX_PROD = [
  {k:'script',  n:'Сценарий утверждён',   d:'текст перечитан вслух, тайминг сходится'},
  {k:'shoot',   n:'Материал снят',        d:'исходники сняты или собраны из стоков'},
  {k:'voice',   n:'Озвучка записана',     d:'голос записан или синтезирован локально (Silero/XTTS)', server:true},
  {k:'edit',    n:'Монтаж собран',        d:'склейки, музыка, ритм'},
  {k:'subs',    n:'Субтитры вшиты',       d:'караоке-подписи, читаемые без звука'},
  {k:'cover',   n:'Обложка готова',       d:'первый кадр и превью для ленты'}
];

function fxStore(){
  var s = readJson(FX_KEY, null);
  if(!s || typeof s !== 'object') s = {};
  if(!Array.isArray(s.tasks)) s.tasks = [];
  if(!s.ui || typeof s.ui !== 'object') s.ui = {};
  return s;
}
function fxSave(s){ writeJson(FX_KEY, s); }

/* Адрес сервера OKO. Пока в сборке его нет — генерация честно недоступна.
   Когда сервер появится, достаточно объявить window.OKO_API_BASE, и кнопка
   «Отправить на генерацию» начнёт реально отправлять задачу. */
function fxApiBase(){
  var b = window.OKO_API_BASE || window.OKO_API || null;
  return (typeof b === 'string' && /^https?:\/\//i.test(b)) ? b.replace(/\/+$/, '') : null;
}

function fxNewTask(preset){
  preset = preset || {};
  return {
    id: uid(),
    createdAt: nowIso(),
    updatedAt: nowIso(),
    title: preset.title || '',
    format: preset.format || 'clip',
    channels: Array.isArray(preset.channels) ? preset.channels.slice() : ['tg'],
    goal: preset.goal || '',
    audience: preset.audience || '',
    cta: preset.cta || '',
    tone: preset.tone || '',
    avoid: preset.avoid || '',
    deadline: preset.deadline || '',
    script: '',
    scriptBy: '',          /* '' | 'manual' | 'server' — кто написал сценарий */
    queued: false,         /* стоит в локальной очереди на генерацию */
    cancelled: false,
    prod: {},              /* галочки чек-листа производства */
    link: '',              /* ссылка на опубликованный материал */
    log: [{at: nowIso(), t: 'Задача создана'}]
  };
}

function fxLog(task, text){
  if(!task.log) task.log = [];
  task.log.unshift({at: nowIso(), t: text});
  task.log = task.log.slice(0, 24);
  task.updatedAt = nowIso();
}

/* Статус выводится из данных, а не хранится отдельно — врать нечему. */
function fxStatus(t){
  if(t.cancelled)                 return {k:'off',    n:'Отменена'};
  if(t.link && fxProdDone(t))     return {k:'done',   n:'Готово'};
  if(t.script)                    return {k:'work',   n:'В работе'};
  if(t.queued)                    return {k:'queued', n:'В очереди'};
  return {k:'draft', n:'Черновик'};
}

function fxProdDone(t){
  return FX_PROD.every(function(p){ return t.prod && t.prod[p.k]; });
}
function fxProdCount(t){
  return FX_PROD.filter(function(p){ return t.prod && t.prod[p.k]; }).length;
}

function fxFormatName(k){
  var f = FX_FORMATS.filter(function(x){ return x.k === k; })[0];
  return f ? f.n : '—';
}
function fxChannelNames(list){
  if(!Array.isArray(list) || !list.length) return 'площадки не выбраны';
  return list.map(function(k){
    var c = FX_CHANNELS2.filter(function(x){ return x.k === k; })[0];
    return c ? c.n : k;
  }).join(' · ');
}

/* --- блок «чего не хватает для генерации» — один текст на всё приложение --- */
function fxNeedBlock(){
  var base = fxApiBase();
  if(base){
    return '<div class="fx2-need">' +
      '<div class="fx2-need-h">' + ic('info') + '<span>Сервер генерации подключён</span></div>' +
      '<ul><li>Адрес: <code class="oko-breakable">' + E(base) + '</code>. Задача уйдёт на него; ключи моделей лежат на сервере, приложение их не видит.</li></ul>' +
      '</div>';
  }
  return '<div class="fx2-need">' +
    '<div class="fx2-need-h">' + ic('warning') + '<span>Генерация сценария сейчас недоступна — и вот почему</span></div>' +
    '<ul>' +
      '<li>Приложение — это статика в вебвью. Оно не имеет права держать ключи моделей у себя: любой человек вытащит их из исходников. Поэтому генерация идёт только через сервер OKO.</li>' +
      '<li>В сборке нет адреса сервера: не объявлена <code>OKO_API_BASE</code>. Пока её нет, приложению просто некуда отправить задание.</li>' +
      '<li>Серверу нужен хотя бы один ключ модели в переменных окружения. Это <code>GEMINI_API_KEY</code> — берётся в Google AI Studio, раздел API keys; либо <code>ANTHROPIC_API_KEY</code> — берётся в консоли Anthropic, раздел API keys. Код сервера лежит в <code class="oko-breakable">oko-app/server</code>.</li>' +
      '<li>Озвучка сервером не оплачивается: она делается локальными движками Silero и XTTS, ключи для неё не нужны.</li>' +
      '<li>До подключения сервера завод работает как трекер: бриф, ручной сценарий, чек-лист и экспорт — всё это уже действует и хранится на этом устройстве.</li>' +
    '</ul>' +
    '</div>';
}

/* --- экспорт задачи в текст (настоящий, из полей задачи) --- */
function fxTaskText(t){
  var L = [];
  L.push('ЗАДАЧА КОНТЕНТ-ЗАВОДА OKO');
  L.push('Создана: ' + human(t.createdAt));
  L.push('Обновлена: ' + human(t.updatedAt));
  L.push('Статус: ' + fxStatus(t).n);
  L.push('');
  L.push('— ПОСТАНОВКА ЗАДАЧИ —');
  L.push('Тема: ' + (t.title || '(не заполнено)'));
  L.push('Формат: ' + fxFormatName(t.format));
  L.push('Площадки: ' + fxChannelNames(t.channels));
  L.push('Цель: ' + (t.goal || '(не заполнено)'));
  L.push('Для кого: ' + (t.audience || '(не заполнено)'));
  L.push('Призыв: ' + (t.cta || '(не заполнено)'));
  L.push('Тон: ' + (t.tone || '(не выбран)'));
  L.push('Не говорить: ' + (t.avoid || '(ограничений нет)'));
  L.push('Срок: ' + (t.deadline || '(не задан)'));
  L.push('');
  L.push('— СЦЕНАРИЙ —');
  L.push(t.script ? t.script : '(сценарий не написан)');
  L.push('');
  L.push('— ПРОИЗВОДСТВО —');
  FX_PROD.forEach(function(p){
    L.push((t.prod && t.prod[p.k] ? '[x] ' : '[ ] ') + p.n);
  });
  L.push('');
  L.push('— МАТЕРИАЛ —');
  L.push(t.link ? t.link : '(ссылка не добавлена)');
  return L.join('\n');
}

/* ---------------------------------------------------------------------------
   Рендер контент-завода
   --------------------------------------------------------------------------- */

function fxRoot(){ return document.getElementById('factoryRoot'); }

function fxRender(){
  var r = fxRoot();
  if(!r) return;
  var s = fxStore();
  var view = s.ui.view || 'list';
  var t = view === 'task' ? fxFind(s, s.ui.taskId) : null;
  if(view === 'task' && !t){ view = 'list'; s.ui.view = 'list'; fxSave(s); }
  r.className = 'fx2-wrap';
  if(view === 'task') r.innerHTML = fxTaskHtml(s, t);
  else                r.innerHTML = fxListHtml(s);
  fxBind(r);
}

function fxFind(s, id){
  var out = null;
  (s.tasks || []).forEach(function(x){ if(x.id === id) out = x; });
  return out;
}

function fxListHtml(s){
  var tasks = s.tasks.slice().sort(function(a, b){
    return String(b.updatedAt).localeCompare(String(a.updatedAt));
  });
  var active = tasks.filter(function(t){ return !t.cancelled && !(t.link && fxProdDone(t)); });
  var ready  = tasks.filter(function(t){ return !t.cancelled && t.link && fxProdDone(t); });
  var off    = tasks.filter(function(t){ return t.cancelled; });

  var h = '';

  /* Что это такое — без обещаний охватов и сроков */
  h += '<div class="fx2-card">' +
    '<p class="fx2-h">Как работает завод</p>' +
    '<p class="fx2-p">Четыре шага на каждую единицу контента: постановка задачи, сценарий, производство, готовый материал. ' +
      'Завод ведёт задачи и хранит их на этом устройстве. Он не публикует за тебя и не отмечает шаги сам — ' +
      'каждая галочка ставится руками, поэтому статус всегда правда.</p>' +
    fxNeedBlock() +
    '<div class="fx2-btns">' +
      '<button class="fx2-btn" data-fx="new">' + ic('plus') + ' Новая задача</button>' +
      (tasks.length ? '<button class="fx2-btn ghost" data-fx="exportall">' + ic('download') + ' Выгрузить все</button>' : '') +
    '</div>' +
    '<div class="fx2-sum">' +
      '<div><b>' + num(active.length) + '</b><small>в работе</small></div>' +
      '<div><b>' + num(tasks.filter(function(t){ return t.queued && !t.script && !t.cancelled; }).length) + '</b><small>в очереди</small></div>' +
      '<div><b>' + num(ready.length) + '</b><small>материалов</small></div>' +
      '<div><b>' + num(off.length) + '</b><small>отменено</small></div>' +
    '</div>' +
  '</div>';

  if(!tasks.length){
    h += '<div class="fx2-card"><div class="fx2-empty">' + ic('bolt') +
      '<b>Задач пока нет</b>' +
      '<p>Это нормально для нового аккаунта: завод ничего не придумывает за тебя. ' +
         'Нажми «Новая задача» и опиши, какой материал нужен — дальше он поведёт тебя по шагам.</p>' +
      '</div></div>';
    return h;
  }

  if(active.length){
    h += '<div class="fx2-card"><p class="fx2-lab">В производстве</p>' + active.map(fxTaskRow).join('') + '</div>';
  }
  if(ready.length){
    h += '<div class="fx2-card"><p class="fx2-lab">Готовые материалы</p>' +
      '<p class="fx2-p">Сюда попадают только задачи, где пройден весь чек-лист и добавлена ссылка на опубликованный материал.</p>' +
      ready.map(fxTaskRow).join('') + '</div>';
  }
  if(off.length){
    h += '<div class="fx2-card"><p class="fx2-lab">Отменённые</p>' + off.map(fxTaskRow).join('') + '</div>';
  }
  return h;
}

function fxTaskRow(t){
  var st = fxStatus(t);
  var meta = fxFormatName(t.format) + ' · ' + fxChannelNames(t.channels) +
             ' · шагов ' + fxProdCount(t) + ' из ' + FX_PROD.length;
  return '<button class="fx2-task" data-fx="open" data-id="' + E(t.id) + '">' +
    '<span class="fx2-task-top">' +
      '<span class="fx2-task-t">' + E(t.title || 'Без темы') +
        '<small class="fx2-task-m">' + E(meta) + '</small>' +
        '<small class="fx2-task-m">обновлена ' + E(human(t.updatedAt)) + '</small>' +
      '</span>' +
      '<span class="fx2-st ' + st.k + '">' + E(st.n) + '</span>' +
    '</span>' +
  '</button>';
}

function fxOpenStep(s, n){
  var open = s.ui.step;
  return open === n ? ' open' : '';
}

function fxTaskHtml(s, t){
  var st = fxStatus(t);
  var base = fxApiBase();
  var h = '';

  h += '<div class="fx2-card">' +
    '<div class="fx2-btns" style="margin-top:0">' +
      '<button class="fx2-btn ghost sm" data-fx="back">' + ic('back') + ' К списку задач</button>' +
      '<span class="fx2-st ' + st.k + '" style="align-self:center">' + E(st.n) + '</span>' +
    '</div>' +
    '<p class="fx2-h" style="margin-top:12px">' + E(t.title || 'Без темы') + '</p>' +
    '<p class="fx2-p">' + E(fxFormatName(t.format)) + ' · ' + E(fxChannelNames(t.channels)) + '</p>' +
  '</div>';

  /* --- Шаг 1. Постановка задачи --- */
  h += '<div class="fx2-step' + (t.title ? ' ok' : '') + fxOpenStep(s, 1) + '">' +
    '<button class="fx2-step-h" data-fx="step" data-n="1">' +
      '<span class="fx2-step-n">1</span>' +
      '<span class="fx2-step-t">Постановка задачи<small>' +
        (t.title ? 'Бриф заполнен, сохранён на этом устройстве' : 'Опиши, что за материал нужен') +
      '</small></span>' + ic('chev', 'fx2-step-ch') +
    '</button>' +
    '<div class="fx2-step-b">' + fxBriefHtml(t) + '</div>' +
  '</div>';

  /* --- Шаг 2. Сценарий --- */
  var scriptSub = t.script
    ? ('Сценарий есть, ' + num(t.script.length) + ' знаков' + (t.scriptBy === 'server' ? ', собран сервером' : ', написан вручную'))
    : (t.queued ? 'Стоит в очереди — ждёт сервер генерации' : 'Пока пусто');
  h += '<div class="fx2-step' + (t.script ? ' ok' : '') + fxOpenStep(s, 2) + '">' +
    '<button class="fx2-step-h" data-fx="step" data-n="2">' +
      '<span class="fx2-step-n">2</span>' +
      '<span class="fx2-step-t">Сценарий<small>' + E(scriptSub) + '</small></span>' +
      ic('chev', 'fx2-step-ch') +
    '</button>' +
    '<div class="fx2-step-b">' +
      (t.queued && !t.script
        ? '<p class="fx2-p">' + ic('clock') + ' Задача стоит в локальной очереди с ' + E(human(t.updatedAt)) +
          '. Очередь не движется: отправлять её пока некуда. Как только у приложения появится адрес сервера, ' +
          'очередь уйдёт на генерацию — а до тех пор сценарий можно написать руками, это не заблокировано.</p>'
        : '') +
      fxNeedBlock() +
      '<div class="fx2-field">' +
        '<label for="fx2Script">Сценарий</label>' +
        '<small>Пиши как говоришь: хук, суть, призыв. Текст сохраняется по кнопке ниже и попадает в экспорт.</small>' +
        '<textarea class="fx2-ta tall" id="fx2Script" placeholder="Хук (0–3 сек): …&#10;Суть: …&#10;Призыв: …">' + E(t.script) + '</textarea>' +
      '</div>' +
      '<div class="fx2-btns">' +
        '<button class="fx2-btn" data-fx="savescript">' + ic('check') + ' Сохранить сценарий</button>' +
        (base
          ? '<button class="fx2-btn ghost" data-fx="gen">' + ic('bolt') + ' Отправить на генерацию</button>'
          : (t.queued
              ? '<button class="fx2-btn ghost" data-fx="unqueue">' + ic('x') + ' Убрать из очереди</button>'
              : '<button class="fx2-btn ghost" data-fx="queue">' + ic('clock') + ' Поставить в очередь</button>')) +
      '</div>' +
    '</div>' +
  '</div>';

  /* --- Шаг 3. Производство --- */
  var done = fxProdCount(t);
  h += '<div class="fx2-step' + (fxProdDone(t) ? ' ok' : '') + fxOpenStep(s, 3) + '">' +
    '<button class="fx2-step-h" data-fx="step" data-n="3">' +
      '<span class="fx2-step-n">3</span>' +
      '<span class="fx2-step-t">Производство<small>' + done + ' из ' + FX_PROD.length + ' шагов отмечено</small></span>' +
      ic('chev', 'fx2-step-ch') +
    '</button>' +
    '<div class="fx2-step-b">' +
      '<p class="fx2-p">Ни одна галочка не встаёт сама. Отмечай шаг, когда он действительно сделан — тогда статус задачи не соврёт ни тебе, ни команде.</p>' +
      FX_PROD.map(function(p){
        var on = !!(t.prod && t.prod[p.k]);
        return '<button class="fx2-check' + (on ? ' on' : '') + '" data-fx="prod" data-k="' + p.k + '" aria-pressed="' + (on ? 'true' : 'false') + '">' +
          '<span class="fx2-box">' + ic('check') + '</span>' +
          '<span class="fx2-check-t">' + E(p.n) + '<small>' + E(p.d) + '</small></span>' +
        '</button>';
      }).join('') +
    '</div>' +
  '</div>';

  /* --- Шаг 4. Готовый материал --- */
  h += '<div class="fx2-step' + (t.link ? ' ok' : '') + fxOpenStep(s, 4) + '">' +
    '<button class="fx2-step-h" data-fx="step" data-n="4">' +
      '<span class="fx2-step-n">4</span>' +
      '<span class="fx2-step-t">Готовый материал<small>' +
        (t.link ? 'Ссылка добавлена' : 'Ссылки пока нет') + '</small></span>' +
      ic('chev', 'fx2-step-ch') +
    '</button>' +
    '<div class="fx2-step-b">' +
      '<p class="fx2-p">Публикацией завод не занимается: аккаунты площадок подключаются в разделе «Мои соцсети», ' +
        'а здесь остаётся ссылка на то, что уже вышло. Так очередь и архив совпадают с реальностью.</p>' +
      '<div class="fx2-field">' +
        '<label for="fx2Link">Ссылка на опубликованный материал</label>' +
        '<input class="fx2-in oko-breakable" id="fx2Link" type="url" inputmode="url" placeholder="https://…" value="' + E(t.link) + '">' +
      '</div>' +
      '<div class="fx2-btns">' +
        '<button class="fx2-btn" data-fx="savelink">' + ic('check') + ' Сохранить ссылку</button>' +
        '<button class="fx2-btn ghost" data-fx="copy">' + ic('copy') + ' Скопировать задачу</button>' +
        '<button class="fx2-btn ghost" data-fx="export">' + ic('download') + ' Скачать .txt</button>' +
      '</div>' +
    '</div>' +
  '</div>';

  /* --- Управление задачей --- */
  h += '<div class="fx2-card">' +
    '<p class="fx2-lab">Управление задачей</p>' +
    '<div class="fx2-btns" style="margin-top:0">' +
      (t.cancelled
        ? '<button class="fx2-btn ghost" data-fx="restore">' + ic('refresh') + ' Вернуть в работу</button>'
        : '<button class="fx2-btn ghost" data-fx="cancel">' + ic('x') + ' Отменить задачу</button>') +
      '<button class="fx2-btn ghost" data-fx="dup">' + ic('copy') + ' Повторить задачу</button>' +
      '<button class="fx2-btn warn" data-fx="del">' + ic('trash') + ' Удалить</button>' +
    '</div>' +
    '<div class="fx2-log">' +
      '<p class="fx2-lab">Журнал</p>' +
      (t.log || []).map(function(l){
        return '<div class="fx2-log-i"><b>' + E(human(l.at)) + '</b><span>' + E(l.t) + '</span></div>';
      }).join('') +
    '</div>' +
  '</div>';

  return h;
}

function fxBriefHtml(t){
  var h = '';
  h += '<div class="fx2-field">' +
    '<label for="fx2Title">Тема материала</label>' +
    '<small>Одной строкой, по-человечески. Это заголовок задачи в очереди.</small>' +
    '<input class="fx2-in" id="fx2Title" placeholder="Например: почему заявки есть, а продаж нет" value="' + E(t.title) + '">' +
  '</div>';

  h += '<div class="fx2-field"><label>Формат</label><div class="fx2-pills">' +
    FX_FORMATS.map(function(f){
      return '<button class="fx2-pill' + (t.format === f.k ? ' on' : '') + '" data-fx="fmt" data-k="' + f.k + '">' + E(f.n) + '</button>';
    }).join('') +
  '</div></div>';

  h += '<div class="fx2-field"><label>Площадки</label>' +
    '<small>Куда пойдёт материал. От этого зависят требования к формату при проверке видео.</small>' +
    '<div class="fx2-pills">' +
    FX_CHANNELS2.map(function(c){
      var on = (t.channels || []).indexOf(c.k) >= 0;
      return '<button class="fx2-pill' + (on ? ' on' : '') + '" data-fx="ch" data-k="' + c.k + '" aria-pressed="' + (on ? 'true' : 'false') + '">' + E(c.n) + '</button>';
    }).join('') +
  '</div></div>';

  h += '<div class="fx2-field">' +
    '<label for="fx2Goal">Зачем этот материал</label>' +
    '<small>Что человек должен сделать после просмотра. Без цели сценарий получается ни о чём.</small>' +
    '<input class="fx2-in" id="fx2Goal" placeholder="Например: записаться на разбор" value="' + E(t.goal) + '">' +
  '</div>';

  h += '<div class="fx2-field">' +
    '<label for="fx2Aud">Для кого</label>' +
    '<input class="fx2-in" id="fx2Aud" placeholder="Например: мастера, которые ведут запись в тетради" value="' + E(t.audience) + '">' +
  '</div>';

  h += '<div class="fx2-field">' +
    '<label for="fx2Cta">Призыв в конце</label>' +
    '<input class="fx2-in" id="fx2Cta" placeholder="Например: напиши слово РАЗБОР в личные сообщения" value="' + E(t.cta) + '">' +
  '</div>';

  h += '<div class="fx2-field"><label>Тон</label><div class="fx2-pills">' +
    FX_TONES.map(function(x){
      return '<button class="fx2-pill' + (t.tone === x ? ' on' : '') + '" data-fx="tone" data-k="' + E(x) + '">' + E(x) + '</button>';
    }).join('') +
  '</div></div>';

  h += '<div class="fx2-field">' +
    '<label for="fx2Avoid">Чего в материале быть не должно</label>' +
    '<small>Стоп-слова, темы, обещания. Пойдёт в задание сценаристу и в промпт модели.</small>' +
    '<textarea class="fx2-ta" id="fx2Avoid" placeholder="Например: без обещаний дохода и без слова «гарантия»">' + E(t.avoid) + '</textarea>' +
  '</div>';

  h += '<div class="fx2-field">' +
    '<label for="fx2Dl">Срок</label>' +
    '<input class="fx2-in" id="fx2Dl" type="date" value="' + E(t.deadline) + '">' +
  '</div>';

  h += '<div class="fx2-btns">' +
    '<button class="fx2-btn" data-fx="savebrief">' + ic('check') + ' Сохранить бриф</button>' +
  '</div>';
  return h;
}

/* --- сбор значений формы брифа из DOM (только если поля на экране) --- */
function fxCollect(t){
  var g = function(id){ var el = document.getElementById(id); return el ? el.value : null; };
  var v;
  v = g('fx2Title');  if(v !== null) t.title    = v.trim();
  v = g('fx2Goal');   if(v !== null) t.goal     = v.trim();
  v = g('fx2Aud');    if(v !== null) t.audience = v.trim();
  v = g('fx2Cta');    if(v !== null) t.cta      = v.trim();
  v = g('fx2Avoid');  if(v !== null) t.avoid    = v.trim();
  v = g('fx2Dl');     if(v !== null) t.deadline = v.trim();
}

/* --- обработчики контент-завода --- */
function fxBind(root){
  qa('[data-fx]', root).forEach(function(el){
    if(el.__fxBound) return;
    el.__fxBound = true;
    el.addEventListener('click', function(ev){
      ev.preventDefault();
      fxAction(el.getAttribute('data-fx'), el);
    });
  });
}

function fxAction(act, el){
  var s = fxStore();
  var t = fxFind(s, s.ui.taskId);

  if(act === 'new'){
    var nt = fxNewTask();
    s.tasks.unshift(nt);
    s.ui.view = 'task'; s.ui.taskId = nt.id; s.ui.step = 1;
    fxSave(s); fxRender();
    var f = document.getElementById('fx2Title'); if(f) f.focus();
    return;
  }
  if(act === 'open'){
    s.ui.view = 'task'; s.ui.taskId = el.getAttribute('data-id'); s.ui.step = 1;
    fxSave(s); fxRender();
    try{ var rt = fxRoot(); if(rt && rt.scrollIntoView) rt.scrollIntoView({block:'start'}); }catch(e){}
    return;
  }
  if(act === 'back'){
    if(t) fxCollect(t);
    s.ui.view = 'list'; s.ui.taskId = null;
    fxSave(s); fxRender();
    return;
  }
  if(act === 'exportall'){
    var all = s.tasks.map(fxTaskText).join('\n\n' + '='.repeat(52) + '\n\n');
    if(!all){ say('Задач нет — выгружать нечего'); return; }
    downloadText('oko-factory-tasks.txt', all)
      ? say('Файл со всеми задачами сохранён')
      : say('Браузер не дал сохранить файл');
    return;
  }

  if(!t) return;

  if(act === 'step'){
    fxCollect(t);
    var n = +el.getAttribute('data-n');
    s.ui.step = (s.ui.step === n) ? 0 : n;
    fxSave(s); fxRender();
    return;
  }
  if(act === 'fmt'){ fxCollect(t); t.format = el.getAttribute('data-k'); t.updatedAt = nowIso(); fxSave(s); fxRender(); return; }
  if(act === 'tone'){ fxCollect(t); t.tone = el.getAttribute('data-k'); t.updatedAt = nowIso(); fxSave(s); fxRender(); return; }
  if(act === 'ch'){
    fxCollect(t);
    var k = el.getAttribute('data-k');
    if(!Array.isArray(t.channels)) t.channels = [];
    var i = t.channels.indexOf(k);
    if(i >= 0) t.channels.splice(i, 1); else t.channels.push(k);
    t.updatedAt = nowIso();
    fxSave(s); fxRender();
    return;
  }
  if(act === 'savebrief'){
    fxCollect(t);
    if(!t.title){ say('Впиши тему — без неё задачу не отличить от других'); return; }
    fxLog(t, 'Бриф сохранён');
    fxSave(s);
    say('Бриф сохранён на этом устройстве');
    s.ui.step = 2; fxSave(s); fxRender();
    return;
  }
  if(act === 'savescript'){
    var ta = document.getElementById('fx2Script');
    var val = ta ? ta.value.trim() : '';
    if(!val){ say('Поле сценария пустое'); return; }
    var isNew = !t.script;
    t.script = val;
    t.scriptBy = 'manual';
    t.queued = false;
    fxLog(t, isNew ? 'Сценарий написан вручную' : 'Сценарий обновлён');
    fxSave(s); fxRender();
    say('Сценарий сохранён');
    return;
  }
  if(act === 'queue'){
    fxCollect(t);
    if(!t.title){ say('Сначала впиши тему в шаге 1'); return; }
    t.queued = true;
    fxLog(t, 'Поставлена в локальную очередь на генерацию');
    fxSave(s); fxRender();
    popup({
      ico: 'clock',
      title: 'Задача в очереди — но очередь стоит',
      body: 'Задание сохранено на этом устройстве и уйдёт на генерацию, как только у приложения появится адрес сервера OKO (переменная OKO_API_BASE) и на сервере будет ключ модели (GEMINI_API_KEY или ANTHROPIC_API_KEY). Пока этого нет, ничего не генерируется и никаких «готово» не появится. Сценарий можно написать руками прямо сейчас.',
      actions: [{label:'Понятно'}]
    });
    return;
  }
  if(act === 'unqueue'){
    t.queued = false;
    fxLog(t, 'Убрана из очереди');
    fxSave(s); fxRender();
    say('Задача убрана из очереди');
    return;
  }
  if(act === 'gen'){ fxGenerate(t); return; }
  if(act === 'prod'){
    var pk = el.getAttribute('data-k');
    if(!t.prod) t.prod = {};
    t.prod[pk] = !t.prod[pk];
    var pn = FX_PROD.filter(function(p){ return p.k === pk; })[0];
    fxLog(t, (t.prod[pk] ? 'Отмечено: ' : 'Снята отметка: ') + (pn ? pn.n : pk));
    fxSave(s); fxRender();
    return;
  }
  if(act === 'savelink'){
    var li = document.getElementById('fx2Link');
    var lv = li ? li.value.trim() : '';
    if(lv && !/^https?:\/\//i.test(lv)){ say('Ссылка должна начинаться с http:// или https://'); return; }
    t.link = lv;
    fxLog(t, lv ? 'Добавлена ссылка на материал' : 'Ссылка убрана');
    fxSave(s); fxRender();
    say(lv ? 'Ссылка сохранена' : 'Ссылка убрана');
    return;
  }
  if(act === 'copy'){
    copyText(fxTaskText(t)) ? say('Задача целиком скопирована') : say('Браузер не дал доступ к буферу обмена');
    return;
  }
  if(act === 'export'){
    var fn = 'oko-task-' + (t.title ? t.title.replace(/[^\wа-яё\- ]+/gi, '').trim().slice(0, 40).replace(/\s+/g, '-') : t.id) + '.txt';
    downloadText(fn, fxTaskText(t)) ? say('Файл сохранён') : say('Браузер не дал сохранить файл');
    return;
  }
  if(act === 'cancel'){
    t.cancelled = true; t.queued = false;
    fxLog(t, 'Задача отменена');
    fxSave(s); fxRender();
    say('Задача отменена — её можно вернуть в работу');
    return;
  }
  if(act === 'restore'){
    t.cancelled = false;
    fxLog(t, 'Возвращена в работу');
    fxSave(s); fxRender();
    say('Задача снова в работе');
    return;
  }
  if(act === 'dup'){
    var copy = fxNewTask({
      title: t.title ? t.title + ' — повтор' : '',
      format: t.format, channels: t.channels, goal: t.goal,
      audience: t.audience, cta: t.cta, tone: t.tone,
      avoid: t.avoid
    });
    fxLog(copy, 'Создана повтором задачи «' + (t.title || 'без темы') + '»');
    s.tasks.unshift(copy);
    s.ui.taskId = copy.id; s.ui.step = 1;
    fxSave(s); fxRender();
    say('Создана копия брифа — сценарий и галочки не копировались');
    return;
  }
  if(act === 'del'){
    var id = t.id, title = t.title || 'Без темы';
    var go = function(){
      var st2 = fxStore();
      st2.tasks = st2.tasks.filter(function(x){ return x.id !== id; });
      st2.ui.view = 'list'; st2.ui.taskId = null;
      fxSave(st2); fxRender();
      say('Задача удалена');
    };
    var shown = popup({
      ico: 'trash',
      title: 'Удалить задачу?',
      body: 'Задача «' + E(title) + '» вместе со сценарием и журналом исчезнет с этого устройства. Отменить удаление будет нельзя.',
      actions: [{label:'Удалить', onclick: go}, {label:'Оставить', ghost:true}]
    });
    if(!shown && confirm('Удалить задачу «' + title + '»?')) go();
    return;
  }
}

/* Настоящая отправка на сервер. Вызывается только когда адрес объявлен;
   любой отказ показывается как есть, без «успешно отправлено». */
function fxGenerate(t){
  var base = fxApiBase();
  if(!base){ say('Адрес сервера не задан — отправлять некуда'); return; }
  var s = fxStore();
  fxLog(t, 'Задание отправлено на ' + base);
  t.queued = true;
  fxSave(s); fxRender();
  var body = {
    title: t.title, format: t.format, channels: t.channels,
    goal: t.goal, audience: t.audience, cta: t.cta, tone: t.tone, avoid: t.avoid
  };
  fetch(base + '/factory/script', {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify(body)
  }).then(function(r){
    if(!r.ok) throw new Error('сервер ответил ' + r.status);
    return r.json();
  }).then(function(data){
    var st2 = fxStore(), t2 = fxFind(st2, t.id);
    if(!t2) return;
    if(data && typeof data.script === 'string' && data.script.trim()){
      t2.script = data.script.trim();
      t2.scriptBy = 'server';
      t2.queued = false;
      fxLog(t2, 'Сценарий получен с сервера');
      say('Сценарий пришёл с сервера');
    } else {
      fxLog(t2, 'Сервер ответил без сценария — текст не получен');
      say('Сервер ответил, но сценария в ответе не было');
    }
    fxSave(st2); fxRender();
  }).catch(function(err){
    var st3 = fxStore(), t3 = fxFind(st3, t.id);
    if(t3){ fxLog(t3, 'Генерация не удалась: ' + (err && err.message ? err.message : 'нет связи')); fxSave(st3); }
    fxRender();
    say('Генерация не удалась: ' + (err && err.message ? err.message : 'нет связи с сервером'));
  });
}

/* --- подмена функций ядра --- */
window.fxReset = function(){
  /* глушим фальшивый конвейер ядра, если он успел запуститься */
  try{ if(typeof fxTimer !== 'undefined' && fxTimer){ clearInterval(fxTimer); } }catch(e){}
  try{ window.fxTimer = null; }catch(e){}
  var s = fxStore();
  if(!s.ui) s.ui = {};
  /* при повторном входе возвращаемся к списку, но задачи не трогаем */
  s.ui.view = 'list'; s.ui.taskId = null; s.ui.step = 1;
  fxSave(s);
};
window.renderFactory = fxRender;
window.fxToggle = function(){ /* устарело: площадки выбираются в брифе задачи */ };
window.fxBuild  = function(){ fxRender(); };
window.fxTick   = function(){ /* фальшивый конвейер отключён навсегда */ };
window.fxIdeas  = function(){ return []; };

/* Точка входа из «Системы роста»: кнопка «В производство» теперь реально
   заводит задачу-черновик вместо тоста «День N добавлен». */
window.fxImportDay = function(n, topic){
  var s = fxStore();
  var title = (topic && String(topic).trim()) || ('День ' + n + ' из системы роста');
  var t = fxNewTask({title: title, format: 'clip'});
  fxLog(t, 'Заведена из системы роста, день ' + n);
  s.tasks.unshift(t);
  s.ui.view = 'task'; s.ui.taskId = t.id; s.ui.step = 1;
  fxSave(s);
  fxRender();
  say('День ' + n + ' заведён черновиком задачи — проверь бриф');
};

/* ===========================================================================
   3. ПРОВЕРКА ВИДЕО
   =========================================================================== */

var VC_KEY = 'oko-vc2-v1';
var VC_OLD_KEY = 'oko-vc-history';   /* старая история с выдуманными баллами */

/* Требования площадок. Записаны в сборке и МОГУТ УСТАРЕТЬ — об этом честно
   сказано в интерфейсе. Ноль в поле означает «площадка не ограничивает или
   ограничение нам неизвестно», и такая проверка не выполняется. */
var VC_TARGETS = [
  {k:'clip', n:'Вертикальный клип',  ratio:[9,16], minW:720,  minH:1280, minSec:3, maxSec:180, maxMB:512,
   note:'Общая рамка для Клипов OKO, Reels, TikTok и VK Клипов.'},
  {k:'shorts', n:'YouTube Shorts',   ratio:[9,16], minW:720,  minH:1280, minSec:1, maxSec:180, maxMB:1024,
   note:'Вертикаль до трёх минут, иначе ролик уходит в обычные видео.'},
  {k:'tg', n:'Видео в Telegram',     ratio:null,   minW:0,    minH:0,    minSec:0, maxSec:0,   maxMB:2048,
   note:'Ограничение по весу — 2 ГБ на файл для обычного аккаунта.'},
  {k:'wide', n:'Горизонталь 16:9',   ratio:[16,9], minW:1280, minH:720,  minSec:0, maxSec:0,   maxMB:0,
   note:'Обычное видео на YouTube и в ленте: FullHD и выше.'}
];

function vcStore(){
  var s = readJson(VC_KEY, null);
  if(!s || typeof s !== 'object') s = {};
  if(!Array.isArray(s.history)) s.history = [];
  if(!s.target) s.target = 'clip';
  return s;
}
function vcSave(s){ writeJson(VC_KEY, s); }

/* Одноразовая чистка: старый ключ хранил только выдуманные баллы. */
(function purgeFakeHistory(){
  try{
    if(localStorage.getItem(VC_OLD_KEY) != null) localStorage.removeItem(VC_OLD_KEY);
  }catch(e){}
})();

var vcCurrent = null;   /* результат последнего разбора */
var vcBusy = false;

function vcTarget(k){
  var t = VC_TARGETS.filter(function(x){ return x.k === k; })[0];
  return t || VC_TARGETS[0];
}

/* ---------------------------------------------------------------------------
   Разбор файла — всё измеряется по-настоящему
   --------------------------------------------------------------------------- */

function vcAnalyze(file, onStage){
  return new Promise(function(resolve){
    var res = {
      name: file.name, size: file.size, mime: file.type || '',
      duration: 0, w: 0, h: 0, fps: 0, audio: null,
      luma: null, motion: null, frames: 0, error: ''
    };
    var url;
    try{ url = URL.createObjectURL(file); }
    catch(e){ res.error = 'Браузер не смог прочитать файл'; resolve(res); return; }

    var v = document.createElement('video');
    v.preload = 'auto';
    v.muted = true;
    v.playsInline = true;
    v.setAttribute('playsinline', '');
    v.src = url;

    var finished = false;
    function done(){
      if(finished) return;
      finished = true;
      try{ v.pause(); }catch(e){}
      try{ v.removeAttribute('src'); v.load(); }catch(e){}
      setTimeout(function(){ try{ URL.revokeObjectURL(url); }catch(e){} }, 500);
      resolve(res);
    }

    var hardStop = setTimeout(function(){
      if(!res.duration) res.error = res.error || 'Разбор занял слишком долго — файл не открылся';
      done();
    }, 25000);

    v.addEventListener('error', function(){
      res.error = 'Браузер не смог декодировать этот файл. Обычно так бывает с редкими кодеками — пересохрани в MP4 (H.264 + AAC).';
      clearTimeout(hardStop);
      done();
    });

    v.addEventListener('loadedmetadata', function(){
      res.duration = isFinite(v.duration) ? v.duration : 0;
      res.w = v.videoWidth || 0;
      res.h = v.videoHeight || 0;
      if(!res.w || !res.h){
        res.error = 'В файле нет видеодорожки или браузер её не увидел';
        clearTimeout(hardStop);
        done();
        return;
      }
      onStage && onStage('Метаданные прочитаны, снимаю кадры…', 35);
      vcMeasureFrames(v, res, onStage).then(function(){
        return vcMeasureFps(v, res);
      }).then(function(){
        vcDetectAudio(v, res);
        clearTimeout(hardStop);
        onStage && onStage('Готово', 100);
        done();
      }).catch(function(){
        clearTimeout(hardStop);
        done();
      });
    });
  });
}

/* Снимаем пять кадров и честно считаем по ним два числа:
   среднюю яркость и среднее отличие соседних снятых кадров. */
function vcMeasureFrames(v, res, onStage){
  var N = 5;
  var canvas = document.createElement('canvas');
  canvas.width = 64; canvas.height = 36;
  var ctx = canvas.getContext('2d', {willReadFrequently: true});
  var lumas = [], diffs = [], prev = null;

  function seekTo(i){
    return new Promise(function(resolve){
      if(i >= N || !res.duration){ resolve(); return; }
      var t = res.duration * (i + 1) / (N + 1);
      var to = setTimeout(function(){ resolve(); }, 3500);
      var onSeek = function(){
        clearTimeout(to);
        v.removeEventListener('seeked', onSeek);
        try{
          ctx.drawImage(v, 0, 0, canvas.width, canvas.height);
          var d = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
          var sum = 0, gray = new Array(d.length / 4);
          for(var p = 0, gi = 0; p < d.length; p += 4, gi++){
            var g = 0.2126 * d[p] + 0.7152 * d[p + 1] + 0.0722 * d[p + 2];
            gray[gi] = g; sum += g;
          }
          lumas.push(sum / gray.length);
          if(prev){
            var ds = 0;
            for(var j = 0; j < gray.length; j++) ds += Math.abs(gray[j] - prev[j]);
            diffs.push(ds / gray.length);
          }
          prev = gray;
          res.frames = lumas.length;
        }catch(e){ /* кадр не снялся — просто пропускаем, врать не будем */ }
        resolve();
      };
      v.addEventListener('seeked', onSeek);
      try{ v.currentTime = t; }catch(e){ clearTimeout(to); v.removeEventListener('seeked', onSeek); resolve(); }
    });
  }

  var chain = Promise.resolve();
  for(var i = 0; i < N; i++){
    (function(i){
      chain = chain.then(function(){
        onStage && onStage('Снимаю кадр ' + (i + 1) + ' из ' + N + '…', 35 + i * 9);
        return seekTo(i);
      });
    })(i);
  }
  return chain.then(function(){
    if(lumas.length){
      res.luma = lumas.reduce(function(a, b){ return a + b; }, 0) / lumas.length;
    }
    if(diffs.length){
      res.motion = diffs.reduce(function(a, b){ return a + b; }, 0) / diffs.length;
    }
  });
}

/* Оценка частоты кадров: считаем настоящие кадры за реальный отрезок
   воспроизведения. Если API нет — оставляем «не измерено», а не выдумываем. */
function vcMeasureFps(v, res){
  return new Promise(function(resolve){
    if(typeof v.requestVideoFrameCallback !== 'function'){ resolve(); return; }
    var count = 0, t0 = 0, stopped = false;
    var stop = function(){
      if(stopped) return;
      stopped = true;
      try{ v.pause(); }catch(e){}
      var dt = (performance.now() - t0) / 1000;
      if(dt > 0.25 && count > 2) res.fps = Math.round(count / dt);
      resolve();
    };
    try{ v.currentTime = 0; }catch(e){}
    var tick = function(){
      count++;
      if(!stopped) try{ v.requestVideoFrameCallback(tick); }catch(e){}
    };
    var p;
    try{ p = v.play(); }catch(e){ resolve(); return; }
    Promise.resolve(p).then(function(){
      t0 = performance.now();
      try{ v.requestVideoFrameCallback(tick); }catch(e){}
      setTimeout(stop, 900);
    }).catch(function(){ resolve(); });
    setTimeout(stop, 2500);
  });
}

/* Звуковая дорожка: у браузеров разные способы, и ни один не универсален.
   Если ни один не сработал — пишем «не определяется», а не «звука нет». */
function vcDetectAudio(v, res){
  try{
    if(typeof v.mozHasAudio === 'boolean'){ res.audio = v.mozHasAudio; return; }
    if(v.audioTracks && typeof v.audioTracks.length === 'number'){ res.audio = v.audioTracks.length > 0; return; }
    if(typeof v.webkitAudioDecodedByteCount === 'number' && v.webkitAudioDecodedByteCount > 0){ res.audio = true; return; }
  }catch(e){}
  res.audio = null;
}

/* ---------------------------------------------------------------------------
   Сверка измеренного с требованиями площадки
   --------------------------------------------------------------------------- */

function vcChecks(res, tgt){
  var out = [];
  var add = function(v, title, note){ out.push({v: v, t: title, n: note}); };

  /* контейнер */
  var mime = (res.mime || '').toLowerCase();
  if(!mime) add('unk', 'Тип файла', 'Браузер не сообщил MIME-тип. Ориентируйся на расширение: надёжнее всего MP4 (H.264 + AAC).');
  else if(mime.indexOf('mp4') >= 0) add('ok', 'Тип файла', mime + ' — самый совместимый контейнер, принимают все площадки.');
  else if(mime.indexOf('quicktime') >= 0) add('ok', 'Тип файла', mime + ' — MOV принимают, но при загрузке с телефона MP4 быстрее.');
  else add('bad', 'Тип файла', mime + ' — площадки такое чаще всего перекодируют или отклоняют. Пересохрани в MP4 (H.264 + AAC).');

  /* соотношение сторон */
  var r = ratioOf(res.w, res.h);
  if(!tgt.ratio){
    add('ok', 'Соотношение сторон', r + ' (' + num(res.w) + '×' + num(res.h) + '). Для выбранной площадки ограничения нет.');
  } else {
    var want = tgt.ratio[0] / tgt.ratio[1];
    var have = res.w && res.h ? res.w / res.h : 0;
    var okr = have && Math.abs(have - want) / want < 0.06;
    add(okr ? 'ok' : 'bad', 'Соотношение сторон',
      r + ' (' + num(res.w) + '×' + num(res.h) + '), нужно ' + tgt.ratio[0] + ':' + tgt.ratio[1] +
      (okr ? '' : '. Площадка обрежет или добавит полосы — пересобери кадр под нужный формат.'));
  }

  /* разрешение */
  if(tgt.minW && tgt.minH){
    var okres = res.w >= tgt.minW && res.h >= tgt.minH;
    add(okres ? 'ok' : 'bad', 'Разрешение',
      num(res.w) + '×' + num(res.h) + ', минимум для площадки ' + num(tgt.minW) + '×' + num(tgt.minH) +
      (okres ? '' : '. Ниже минимума картинка заметно мылится после перекодирования.'));
  }

  /* длительность */
  if(!res.duration){
    add('unk', 'Длительность', 'Не удалось прочитать длительность из файла.');
  } else if(tgt.maxSec || tgt.minSec){
    var okd = (!tgt.maxSec || res.duration <= tgt.maxSec) && (!tgt.minSec || res.duration >= tgt.minSec);
    var lim = [];
    if(tgt.minSec) lim.push('не короче ' + secs(tgt.minSec));
    if(tgt.maxSec) lim.push('не длиннее ' + secs(tgt.maxSec));
    add(okd ? 'ok' : 'bad', 'Длительность', secs(res.duration) + ', требуется ' + lim.join(' и ') + '.');
  } else {
    add('ok', 'Длительность', secs(res.duration) + '. Для выбранной площадки жёсткого лимита нет.');
  }

  /* вес */
  if(tgt.maxMB){
    var mb = res.size / 1024 / 1024;
    var okm = mb <= tgt.maxMB;
    add(okm ? 'ok' : 'bad', 'Вес файла',
      bytes(res.size) + ', лимит площадки ' + num(tgt.maxMB) + ' МБ' + (okm ? '' : '. Файл придётся пережать.'));
  } else {
    add('ok', 'Вес файла', bytes(res.size) + '. Лимит для этой площадки нам неизвестен, проверь в её справке.');
  }

  /* битрейт */
  if(res.duration > 0){
    var mbps = (res.size * 8) / res.duration / 1e6;
    var v2 = mbps < 1.2 ? 'bad' : 'ok';
    add(v2, 'Средний битрейт',
      mbps.toFixed(1).replace('.', ',') + ' Мбит/с (вес поделили на длительность). ' +
      (v2 === 'bad'
        ? 'Меньше 1,2 Мбит/с — на движении полезут квадраты. Пережми с более высоким битрейтом.'
        : 'Достаточно, чтобы площадка не развалила картинку при перекодировании.'));
  }

  /* частота кадров */
  if(res.fps) add('ok', 'Частота кадров', '≈' + res.fps + ' кадров в секунду (посчитано по реальным кадрам за секунду воспроизведения).');
  else add('unk', 'Частота кадров', 'Этот браузер не даёт считать кадры — измерение пропущено.');

  /* звук */
  if(res.audio === true) add('ok', 'Звуковая дорожка', 'Звук в файле есть.');
  else if(res.audio === false) add('bad', 'Звуковая дорожка', 'Звука в файле нет. Немой ролик площадки продвигают заметно хуже.');
  else add('unk', 'Звуковая дорожка', 'Этот браузер не позволяет проверить наличие звука без сервера.');

  /* яркость */
  if(res.luma != null){
    var lv = res.luma < 42 ? 'bad' : 'ok';
    add(lv, 'Яркость кадра',
      'Средняя яркость ' + Math.round(res.luma) + ' из 255 по ' + res.frames + ' снятым кадрам. ' +
      (lv === 'bad' ? 'Темновато: на телефоне при солнце такое почти не видно.' : 'Картинка читается на телефоне.'));
  } else {
    add('unk', 'Яркость кадра', 'Кадры снять не удалось — измерение пропущено.');
  }

  /* межкадровое отличие */
  if(res.motion != null){
    add('ok', 'Изменчивость картинки',
      'Соседние снятые кадры отличаются в среднем на ' + Math.round(res.motion) + ' из 255. ' +
      'Это грубый замер по ' + res.frames + ' кадрам: он показывает, меняется ли картинка вообще, и не заменяет оценку монтажа.');
  }

  return out;
}

/* ---------------------------------------------------------------------------
   Разметка мини-аппа «Проверка видео»
   --------------------------------------------------------------------------- */

function vcMount(){
  var view = document.getElementById('ma-video');
  if(!view) return null;
  var root = document.getElementById('vc2Root');
  if(root) return root;

  /* убираем фальшивые блоки ядра: загрузку без файла, прогресс и отчёт */
  ['vcUpload', 'vcProgress', 'vcResult'].forEach(function(id){
    var el = document.getElementById(id);
    if(el && el.parentNode) el.parentNode.removeChild(el);
  });
  root = document.createElement('div');
  root.id = 'vc2Root';
  root.className = 'vc2-wrap';
  view.appendChild(root);
  return root;
}

function vcRender(){
  var root = vcMount();
  if(!root) return;
  var s = vcStore();
  var tgt = vcTarget(s.target);
  var h = '';

  /* что умеем и чего не умеем — без обещаний */
  h += '<div class="vc2-card">' +
    '<p class="vc2-h">Что здесь происходит на самом деле</p>' +
    '<p class="vc2-p">Ролик никуда не загружается. Он открывается прямо в этом приложении, ' +
      'и все замеры делает браузер на твоём устройстве. Файл не уходит ни на сервер, ни в сеть.</p>' +
    '<p class="fx2-lab">Считается здесь, без интернета</p>' +
    '<div class="fx2-need" style="border-style:solid">' +
      '<ul>' +
        '<li>Длительность, ширина, высота, соотношение сторон.</li>' +
        '<li>Вес файла, MIME-тип контейнера, средний битрейт.</li>' +
        '<li>Частота кадров — подсчётом настоящих кадров за секунду воспроизведения.</li>' +
        '<li>Наличие звуковой дорожки — если браузер даёт это увидеть.</li>' +
        '<li>Средняя яркость и изменчивость картинки — по пяти снятым кадрам.</li>' +
      '</ul>' +
    '</div>' +
    '<p class="fx2-lab">Нужен сервер, поэтому здесь этого нет</p>' +
    '<div class="fx2-need">' +
      '<div class="fx2-need-h">' + ic('warning') + '<span>Оценки хука, удержания и виральности не будет</span></div>' +
      '<ul>' +
        '<li>Распознавание речи и поиск стоп-слов: нужна модель на сервере. Приложению не хватает переменной <code>OKO_API_BASE</code>, а серверу — ключа модели в его окружении.</li>' +
        '<li>Определение музыки и авторских прав: нужен внешний сервис аудиоотпечатков, в приложении его нет.</li>' +
        '<li>Прогноз досмотров и охвата: считается только по статистике твоих же прошлых публикаций, а её ещё нет.</li>' +
        '<li>Поэтому никаких процентов «готовности» и «вероятности рекомендаций» этот экран не показывает. Такое число можно только выдумать, а выдумывать мы не будем.</li>' +
      '</ul>' +
    '</div>' +
  '</div>';

  /* выбор площадки */
  h += '<div class="vc2-card">' +
    '<p class="fx2-lab">Подо что проверяем</p>' +
    '<div class="fx2-pills">' +
      VC_TARGETS.map(function(t){
        return '<button class="fx2-pill' + (s.target === t.k ? ' on' : '') + '" data-vc="tgt" data-k="' + t.k + '">' + E(t.n) + '</button>';
      }).join('') +
    '</div>' +
    '<p class="vc2-p" style="margin-top:10px">' + E(tgt.note) + ' Требования записаны в сборке приложения и со временем меняются — перед публикацией сверься со справкой площадки.</p>' +
  '</div>';

  /* загрузка */
  if(!vcCurrent){
    h += '<div class="vc2-card">' +
      '<div class="vc2-drop">' + ic('camera') +
        '<b>Выбери ролик с устройства</b>' +
        '<p>Файл остаётся у тебя. Разбор занимает несколько секунд и зависит от длины ролика.</p>' +
        '<input type="file" accept="video/*" class="vc2-file" id="vc2File">' +
        '<button class="fx2-btn" data-vc="pick" style="max-width:280px;margin:0 auto">' + ic('file') + ' Выбрать файл</button>' +
      '</div>' +
      '<div id="vc2Busy" style="display:none;margin-top:14px">' +
        '<div class="vc2-stage">' + ic('clock') + '<span id="vc2Stage">Открываю файл…</span></div>' +
        '<div class="vc2-prog"><i id="vc2Bar"></i></div>' +
      '</div>' +
    '</div>';
  } else {
    h += vcReportHtml(vcCurrent, tgt);
  }

  /* история */
  h += vcHistoryHtml(s);

  root.innerHTML = h;
  vcBind(root);
}

function vcReportHtml(res, tgt){
  var h = '';
  if(res.error){
    return '<div class="vc2-card">' +
      '<p class="vc2-h">Файл не открылся</p>' +
      '<p class="vc2-p oko-breakable">' + E(res.name) + '</p>' +
      '<p class="vc2-p">' + E(res.error) + '</p>' +
      '<div class="fx2-btns"><button class="fx2-btn" data-vc="again">' + ic('refresh') + ' Выбрать другой файл</button></div>' +
    '</div>';
  }

  var checks = vcChecks(res, tgt);
  var ok = checks.filter(function(c){ return c.v === 'ok'; }).length;
  var bad = checks.filter(function(c){ return c.v === 'bad'; }).length;
  var unk = checks.filter(function(c){ return c.v === 'unk'; }).length;

  h += '<div class="vc2-card">' +
    '<p class="vc2-h oko-breakable">' + E(res.name) + '</p>' +
    '<p class="vc2-p">Разобрано на этом устройстве ' + E(human(nowIso())) + '. Проверка идёт под «' + E(tgt.n) + '».</p>' +
    '<div class="vc2-tot">' +
      '<div class="g"><b>' + num(ok) + '</b><small>подходит</small></div>' +
      '<div><b>' + num(bad) + '</b><small>не подходит</small></div>' +
      '<div><b>' + num(unk) + '</b><small>не проверить</small></div>' +
    '</div>' +
    '<div class="vc2-facts">' +
      '<div class="vc2-fact"><span>длительность</span><b>' + E(secs(res.duration)) + '</b></div>' +
      '<div class="vc2-fact"><span>кадр</span><b>' + num(res.w) + '×' + num(res.h) + '</b><small>' + E(ratioOf(res.w, res.h)) + '</small></div>' +
      '<div class="vc2-fact"><span>вес</span><b>' + E(bytes(res.size)) + '</b></div>' +
      '<div class="vc2-fact"><span>тип</span><b class="oko-breakable">' + E(res.mime || 'не сообщён') + '</b></div>' +
    '</div>' +
  '</div>';

  h += '<div class="vc2-card">' +
    '<p class="fx2-lab">Проверка по пунктам</p>' +
    checks.map(function(c){
      var icn = c.v === 'ok' ? 'check' : (c.v === 'bad' ? 'warning' : 'info');
      return '<div class="vc2-row">' +
        '<span class="vc2-ic ' + c.v + '">' + ic(icn) + '</span>' +
        '<span class="vc2-row-b"><b>' + E(c.t) + '</b><small>' + E(c.n) + '</small></span>' +
      '</div>';
    }).join('') +
    '<div class="fx2-btns">' +
      '<button class="fx2-btn" data-vc="again">' + ic('refresh') + ' Проверить другой ролик</button>' +
      '<button class="fx2-btn ghost" data-vc="copyrep">' + ic('copy') + ' Скопировать отчёт</button>' +
      '<button class="fx2-btn ghost" data-vc="saverep">' + ic('download') + ' Скачать .txt</button>' +
    '</div>' +
  '</div>';

  return h;
}

function vcHistoryHtml(s){
  var h = '<div class="vc2-card"><p class="fx2-lab">История проверок</p>';
  if(!s.history.length){
    h += '<div class="fx2-empty">' + ic('clock') +
      '<b>Проверок ещё не было</b>' +
      '<p>Здесь появятся только настоящие разборы твоих файлов — с теми числами, которые браузер реально измерил. ' +
         'История хранится на этом устройстве и никуда не отправляется.</p>' +
      '</div></div>';
    return h;
  }
  h += s.history.map(function(x){
    return '<div class="vc2-hi">' +
      '<span class="vc2-hi-b"><b class="oko-breakable">' + E(x.name) + '</b>' +
        '<small>' + E(human(x.at)) + ' · ' + E(secs(x.duration)) + ' · ' + num(x.w) + '×' + num(x.h) + ' · ' + E(bytes(x.size)) + '</small>' +
        '<small>подходит ' + num(x.ok) + ', не подходит ' + num(x.bad) + ', не проверить ' + num(x.unk) + ' · под «' + E(x.target) + '»</small>' +
      '</span>' +
      '<button class="vc2-hi-x" data-vc="delhist" data-id="' + E(x.id) + '" aria-label="Убрать из истории">' + ic('x') + '</button>' +
    '</div>';
  }).join('');
  h += '<div class="fx2-btns"><button class="fx2-btn ghost sm" data-vc="clearhist">' + ic('trash') + ' Очистить историю</button></div>';
  h += '</div>';
  return h;
}

function vcReportText(res, tgt){
  var checks = vcChecks(res, tgt);
  var L = [];
  L.push('ПРОВЕРКА ВИДЕО · OKO');
  L.push('Файл: ' + res.name);
  L.push('Разобрано: ' + human(nowIso()) + ' (в браузере, без отправки файла)');
  L.push('Площадка: ' + tgt.n);
  L.push('');
  L.push('ИЗМЕРЕНО');
  L.push('Длительность: ' + secs(res.duration));
  L.push('Кадр: ' + res.w + '×' + res.h + ' (' + ratioOf(res.w, res.h) + ')');
  L.push('Вес: ' + bytes(res.size));
  L.push('MIME-тип: ' + (res.mime || 'не сообщён'));
  L.push('Частота кадров: ' + (res.fps ? '≈' + res.fps : 'не измерено'));
  L.push('Звук: ' + (res.audio === true ? 'есть' : res.audio === false ? 'нет' : 'не определяется'));
  L.push('Яркость: ' + (res.luma != null ? Math.round(res.luma) + ' из 255' : 'не измерена'));
  L.push('');
  L.push('ПРОВЕРКА');
  checks.forEach(function(c){
    var m = c.v === 'ok' ? '[подходит]' : (c.v === 'bad' ? '[не подходит]' : '[не проверить]');
    L.push(m + ' ' + c.t + ': ' + c.n);
  });
  L.push('');
  L.push('Оценок хука, удержания и виральности в отчёте нет: их нельзя посчитать в браузере,');
  L.push('а придумывать числа приложение не будет.');
  return L.join('\n');
}

function vcBind(root){
  qa('[data-vc]', root).forEach(function(el){
    if(el.__vcBound) return;
    el.__vcBound = true;
    el.addEventListener('click', function(ev){
      ev.preventDefault();
      vcAction(el.getAttribute('data-vc'), el);
    });
  });
  var inp = document.getElementById('vc2File');
  if(inp && !inp.__vcBound){
    inp.__vcBound = true;
    inp.addEventListener('change', function(){
      var f = inp.files && inp.files[0];
      if(f) vcRun(f);
    });
  }
}

function vcAction(act, el){
  var s = vcStore();
  if(act === 'tgt'){
    s.target = el.getAttribute('data-k');
    vcSave(s);
    vcRender();
    return;
  }
  if(act === 'pick'){
    if(vcBusy){ say('Идёт разбор предыдущего файла'); return; }
    var inp = document.getElementById('vc2File');
    if(inp) inp.click();
    return;
  }
  if(act === 'again'){ vcCurrent = null; vcRender(); return; }
  if(act === 'copyrep'){
    if(!vcCurrent) return;
    copyText(vcReportText(vcCurrent, vcTarget(s.target)))
      ? say('Отчёт скопирован')
      : say('Браузер не дал доступ к буферу обмена');
    return;
  }
  if(act === 'saverep'){
    if(!vcCurrent) return;
    downloadText('oko-video-check.txt', vcReportText(vcCurrent, vcTarget(s.target)))
      ? say('Отчёт сохранён файлом')
      : say('Браузер не дал сохранить файл');
    return;
  }
  if(act === 'delhist'){
    var id = el.getAttribute('data-id');
    s.history = s.history.filter(function(x){ return x.id !== id; });
    vcSave(s); vcRender();
    return;
  }
  if(act === 'clearhist'){
    var go = function(){
      var s2 = vcStore(); s2.history = []; vcSave(s2); vcRender();
      say('История проверок очищена');
    };
    var shown = popup({
      ico: 'trash',
      title: 'Очистить историю проверок?',
      body: 'Записи о разобранных файлах исчезнут с этого устройства. Сами ролики это не затронет — они и так никуда не загружались.',
      actions: [{label:'Очистить', onclick: go}, {label:'Оставить', ghost:true}]
    });
    if(!shown && confirm('Очистить историю проверок?')) go();
    return;
  }
}

function vcRun(file){
  if(vcBusy) return;
  vcBusy = true;
  vcCurrent = null;
  var busy = document.getElementById('vc2Busy');
  var stage = document.getElementById('vc2Stage');
  var bar = document.getElementById('vc2Bar');
  if(busy) busy.style.display = '';
  var onStage = function(text, pct){
    if(stage) stage.textContent = text;
    if(bar) bar.style.width = Math.max(0, Math.min(100, pct)) + '%';
  };
  onStage('Открываю файл…', 12);

  vcAnalyze(file, onStage).then(function(res){
    vcBusy = false;
    vcCurrent = res;
    if(!res.error){
      var s = vcStore();
      var tgt = vcTarget(s.target);
      var checks = vcChecks(res, tgt);
      s.history.unshift({
        id: uid(),
        at: nowIso(),
        name: res.name,
        size: res.size,
        duration: res.duration,
        w: res.w, h: res.h,
        target: tgt.n,
        ok: checks.filter(function(c){ return c.v === 'ok'; }).length,
        bad: checks.filter(function(c){ return c.v === 'bad'; }).length,
        unk: checks.filter(function(c){ return c.v === 'unk'; }).length
      });
      s.history = s.history.slice(0, 20);
      vcSave(s);
    }
    vcRender();
    try{ var rr = document.getElementById('vc2Root'); if(rr && rr.scrollIntoView) rr.scrollIntoView({block:'start'}); }catch(e){}
  }).catch(function(){
    vcBusy = false;
    vcCurrent = {name: file.name, size: file.size, mime: file.type || '', error: 'Разбор прервался с ошибкой браузера'};
    vcRender();
  });
}

/* --- подмена функций ядра --- */
window.vcHistRender = function(){ vcCurrent = null; vcRender(); };
window.vcStart = function(){
  /* старая кнопка ядра запускала фальшивый прогресс без файла */
  vcRender();
  var inp = document.getElementById('vc2File');
  if(inp) inp.click();
};
window.vcReset = function(){ vcCurrent = null; vcRender(); };
window.renderVcReport = function(){ vcRender(); };
window.vcOpenSample = function(){
  popup({
    ico: 'info',
    title: 'Примера вердикта больше нет',
    body: 'Раньше здесь показывали разбор выдуманного ролика выдуманного клиента с выдуманными процентами. Это вводило в заблуждение, поэтому пример убран. Выбери свой файл — приложение измерит его по-настоящему и покажет только те числа, которые действительно посчитало.',
    actions: [{label:'Понятно'}]
  });
};
window.vcHistAdd = function(){ /* выдуманные записи в историю больше не пишутся */ };
window.vcHistory = function(){ return vcStore().history; };

/* ===========================================================================
   4. ПОДКЛЮЧЕНИЕ К ЖИЗНЕННОМУ ЦИКЛУ ЭКРАНОВ
   =========================================================================== */

/* openMa ядра вызывает fxReset()+renderFactory() и vcHistRender() — они уже
   подменены. На случай, если экран открыт другим путём (глубокая ссылка,
   восстановление вкладки), подстраховываемся наблюдателем видимости. */
function vcVisible(){
  var v = document.getElementById('ma-video');
  return !!(v && v.style.display !== 'none' && v.offsetParent !== null);
}
function fxVisible(){
  var v = document.getElementById('ma-factory');
  return !!(v && v.style.display !== 'none' && v.offsetParent !== null);
}

function boot(){
  /* первичная сборка разметки видео-экрана, чтобы фальшивые блоки ядра
     исчезли даже до первого открытия */
  vcMount();
  if(vcVisible()) vcRender();
  if(fxVisible()) fxRender();
}

if(document.readyState === 'loading'){
  document.addEventListener('DOMContentLoaded', boot);
} else {
  boot();
}
/* повторная попытка: другие слои могут дорисовывать мини-аппы позже */
setTimeout(boot, 600);
setTimeout(boot, 1800);

})();
