/* =============================================================================
   OKO · ЗВОНКИ (слой okc-)
   -----------------------------------------------------------------------------
   Личный аудио/видеозвонок, входящий звонок и групповой созвон (конференция).

   ЧЕСТНОСТЬ — ГЛАВНОЕ ПРАВИЛО ЭТОГО ФАЙЛА.
   Сигнального сервера WebRTC у приложения сейчас нет. Значит:
     • никто «не подключается» сам собой, таймер разговора не запускается,
       статус «В сети» не появляется;
     • экран честно пишет, что дозвониться нельзя и чего именно не хватает;
     • всё, что работает по-настоящему (свой микрофон, своя камера, реальный
       уровень громкости своего голоса, демонстрация своего экрана, выбор
       устройства вывода), работает по-настоящему и помечено как локальное.

   Транспорт подключается снаружи одной точкой:
       window.okoCallsTransport = {
         connect(session) -> Promise<{remoteStream, participants}>,
         hangup(session), on(event, cb)
       }
   Пока его нет — состояние 'nolink' с честным объяснением.

   Заменяет собой прежний движок звонков из ядра (cl-*) и легаси #callScreen:
   старые оверлеи гасятся, глобальные точки входа перехватываются.

   Точки входа (глобальные, их зовёт ядро и другие слои):
     window.startCall(video)                    — из шапки личного чата
     window.callStartPersonal(userId, isVideo)  — личный звонок
     window.callStartConf(chatId, admin, opts)  — групповой созвон
     window.endCall()                           — завершить что идёт
   Публичный API слоя: window.okoCalls
     .personal(userId, isVideo, opts)  .conference(chatId, opts)
     .incoming({name, video, ava, from})  — зовёт ТОЛЬКО сигнальный сервер
     .end()  .minimize()  .restore()  .state()
   ============================================================================= */
(function () {
'use strict';

/* ------------------------------------------------------------------ утилиты */
var $ = function (id) { return document.getElementById(id); };
var ICON = function (name, cls) {
  return '<svg class="okc-i' + (cls ? ' ' + cls : '') + '" aria-hidden="true" focusable="false"><use href="#cl-i-' + name + '"/></svg>';
};
function okcEsc(s) {
  if (typeof window.esc === 'function') { try { return window.esc(s); } catch (e) {} }
  return String(s == null ? '' : s).replace(/[&<>"']/g, function (ch) {
    return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch];
  });
}
/* MM:SS, а после часа — H:MM:SS. Никогда не отдаёт NaN. */
function okcTime(sec) {
  var n = Math.max(0, Math.floor(Number(sec) || 0));
  var h = Math.floor(n / 3600), m = Math.floor((n % 3600) / 60), s = n % 60;
  var mm = String(m).padStart(2, '0'), ss = String(s).padStart(2, '0');
  return h > 0 ? (h + ':' + mm + ':' + ss) : (mm + ':' + ss);
}
function okcToast(text) {
  var d = document.createElement('div');
  d.className = 'okc-toast';
  d.setAttribute('role', 'status');
  d.textContent = text;
  document.body.appendChild(d);
  setTimeout(function () { d.remove(); }, 3600);
}
function okcFirstLetter(name) {
  var t = String(name == null ? '' : name).trim();
  return (t[0] || 'O').toUpperCase();
}

/* ------------------------------------------------------- состояние сессии */
/* phase:
     'ringing'    — входящий, ждём решения человека
     'calling'    — исходящий, набираем
     'connecting' — реально берём микрофон/камеру и спрашиваем транспорт
     'connected'  — есть настоящий удалённый поток (сегодня недостижимо)
     'nolink'     — транспорта нет: честный тупик + локальная проверка себя
     'denied'     — человек или система запретили микрофон/камеру
*/
var S = null;              /* активная сессия или null */
var stream = null;         /* MediaStream своих устройств */
var displayStream = null;  /* MediaStream демонстрации экрана */
var tickTimer = null;      /* секундный тик */
var meter = null;          /* {ctx, analyser, raf, data} — реальный уровень своего голоса */
var built = false;         /* DOM собран */
var camPausedByHide = false;

var TRANSPORT_NOTE =
  'Сервер связи (WebRTC-сигналинг) ещё не подключён к приложению. ' +
  'Поэтому дозвониться до человека нельзя: некому передать приглашение и обменяться потоками. ' +
  'Ваш микрофон и камера при этом работают — можно проверить себя перед разговором.';

function okcTransport() {
  var t = window.okoCallsTransport;
  return (t && typeof t.connect === 'function') ? t : null;
}

/* ================================================================== СТИЛИ */
function okcStyles() {
  if ($('okc-css')) return;
  var css = document.createElement('style');
  css.id = 'okc-css';
  css.textContent = [
/* Экран звонка кинематографично тёмный в обеих темах (как в Telegram/Zoom),
   а выезжающие панели и шторки следуют теме приложения. */
':root{--okc-lime:#9AFF00;--okc-red:#ff3b30;--okc-glow:0 0 0 4px rgba(154,255,0,.16),0 8px 26px rgba(154,255,0,.28);',
'  --okc-panel-d:rgba(14,17,11,.94);--okc-panel-l:rgba(248,252,242,.97);--okc-btn:rgba(255,255,255,.12);}',

/* легаси-движки звонков выключены этим слоем */
'#cl-conf,#cl-personal,#cl-pill,#callScreen,#cpCallPill{display:none!important}',

'.okc-i{width:24px;height:24px;display:block;pointer-events:none;fill:none;stroke:currentColor;stroke-width:5;stroke-linecap:round;stroke-linejoin:round}',
'#okc-screen use{color:inherit}',

/* ---------- полноэкранный слой ---------- */
/* z-index 9500: разговор должен перекрывать любые панели приложения
   (у слоёв встречается до 9200), но остаться ниже сплэша и онбординга (99997+). */
'.okc-screen{position:fixed;inset:0;z-index:9500;display:none;flex-direction:column;color:#fff;overflow:hidden;',
'  background:radial-gradient(130% 85% at 50% -8%,#16290b,#000 72%),#000;',
'  padding:calc(var(--oko-safe-top,0px)) var(--oko-safe-right,0px) var(--oko-safe-bottom,0px) var(--oko-safe-left,0px)}',
'.okc-screen.on{display:flex;animation:okc-in .24s ease-out}',
'@keyframes okc-in{from{opacity:0;transform:scale(.985)}to{opacity:1;transform:none}}',
'html.okc-lock,html.okc-lock body{overflow:hidden}',

/* шапка */
'.okc-top{position:relative;z-index:6;display:flex;align-items:center;gap:10px;padding:12px 14px 8px;flex-shrink:0}',
'.okc-ttl{flex:1;min-width:0;text-align:center;line-height:1.2}',
'.okc-ttl b{display:block;font-family:var(--font-display,"Bebas Neue"),sans-serif;font-size:21px;letter-spacing:.07em;',
'  white-space:nowrap;overflow:hidden;text-overflow:ellipsis}',
/* display:block (не flex) — иначе text-overflow:ellipsis не работает и длинное
   имя собеседника просто вылезает за край шапки. */
'.okc-ttl small{display:block;font-size:11.5px;color:#c6d1b6;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}',
'.okc-live{display:inline-block;vertical-align:middle;width:7px;height:7px;border-radius:50%;margin-right:5px;',
'  background:var(--okc-lime);box-shadow:0 0 6px var(--okc-lime);animation:okc-blink 1.5s infinite}',
'@keyframes okc-blink{0%,100%{opacity:1}50%{opacity:.32}}',
'.okc-sep{display:inline-block;vertical-align:middle;width:3px;height:3px;border-radius:50%;background:currentColor;opacity:.5;margin:0 6px}',
'.okc-tbtn{width:40px;height:40px;border-radius:50%;flex-shrink:0;display:flex;align-items:center;justify-content:center;',
'  background:rgba(255,255,255,.09);color:#fff;-webkit-tap-highlight-color:transparent;transition:transform .1s,background .18s}',
'.okc-tbtn:active{transform:scale(.9)}',
'.okc-tbtn .okc-i{width:20px;height:20px}',
'.okc-tbtn[hidden]{display:none}',

/* --------- личный / входящий --------- */
/* Панель кнопок стоит в потоке (flex-shrink:0), поэтому запас снизу нужен
   небольшой — только чтобы контент не липнул к кнопкам. */
'.okc-pers{position:relative;z-index:3;flex:1;min-height:0;display:none;flex-direction:column;align-items:center;',
'  gap:14px;padding:6px 18px 16px;overflow-y:auto;text-align:center}',
'.okc-screen.m-pers .okc-pers,.okc-screen.m-in .okc-pers{display:flex}',
'.okc-halo{position:relative;width:min(168px,42vw);height:min(168px,42vw);flex-shrink:0;display:flex;align-items:center;justify-content:center;margin-top:8px}',
'.okc-ring{position:absolute;inset:0;border-radius:50%;border:2px solid var(--okc-lime);opacity:0}',
'.okc-screen.ringing .okc-ring{animation:okc-ripple 2.4s cubic-bezier(.2,.7,.3,1) infinite}',
'.okc-screen.ringing .okc-ring:nth-child(2){animation-delay:.8s}',
'.okc-screen.ringing .okc-ring:nth-child(3){animation-delay:1.6s}',
'@keyframes okc-ripple{0%{transform:scale(.62);opacity:.75}100%{transform:scale(1.14);opacity:0}}',
'.okc-ava{width:78%;height:78%;border-radius:50%;display:flex;align-items:center;justify-content:center;overflow:hidden;',
'  background:linear-gradient(160deg,#25400f,#0a1104);color:var(--okc-lime);border:1px solid rgba(154,255,0,.3);',
'  font-family:var(--font-display,"Bebas Neue"),sans-serif;font-size:clamp(34px,11vw,52px);letter-spacing:.04em;line-height:1}',
'.okc-ava img{width:100%;height:100%;object-fit:cover}',
'.okc-nm{font-family:var(--font-display,"Bebas Neue"),sans-serif;font-size:clamp(24px,7vw,32px);letter-spacing:.05em;',
'  line-height:1.1;max-width:100%;overflow-wrap:break-word}',
'.okc-st{font-size:13.5px;letter-spacing:.02em;color:#c6d1b6;min-height:18px;max-width:100%;overflow-wrap:break-word}',
'.okc-screen.connected .okc-st{color:var(--okc-lime)}',

/* честная карточка-объяснение */
'.okc-note{width:min(460px,100%);text-align:left;border-radius:16px;padding:13px 14px;',
'  background:rgba(255,255,255,.07);border:1px solid rgba(255,255,255,.12);color:#e7eede;font-size:12.8px;line-height:1.5}',
'.okc-note[hidden]{display:none}',
'.okc-note.warn{background:rgba(255,59,48,.13);border-color:rgba(255,59,48,.4)}',
'.okc-note-hd{display:flex;align-items:center;gap:8px;font-weight:700;font-size:13.5px;color:#fff;margin-bottom:6px}',
'.okc-note-hd .okc-i{width:17px;height:17px;flex-shrink:0;color:var(--okc-lime)}',
'.okc-note.warn .okc-note-hd .okc-i{color:var(--okc-red)}',
'.okc-note p{margin:0 0 8px}',
'.okc-note p:last-child{margin-bottom:0}',
'.okc-note b{color:#fff}',
'.okc-note-acts{display:flex;flex-wrap:wrap;gap:8px;margin-top:10px}',
'.okc-mini{display:inline-flex;align-items:center;gap:6px;padding:7px 13px;border-radius:99px;font-size:12px;font-weight:700;',
'  background:rgba(255,255,255,.13);color:#fff;-webkit-tap-highlight-color:transparent;transition:transform .1s,background .16s}',
'.okc-mini:active{transform:scale(.95)}',
'.okc-mini.pri{background:var(--okc-lime);color:#000}',
'.okc-mini .okc-i{width:15px;height:15px;stroke-width:6}',
'.okc-chip{display:inline-flex;align-items:center;gap:7px;padding:6px 12px;border-radius:99px;font-size:11.5px;font-weight:700;',
'  background:rgba(154,255,0,.16);color:var(--okc-lime);border:1px solid rgba(154,255,0,.3)}',
'.okc-chip[hidden]{display:none}',

/* локальный уровень голоса (реальный) */
'.okc-lvl{display:flex;align-items:flex-end;gap:3px;height:16px}',
'.okc-lvl i{display:block;width:3px;border-radius:2px;background:currentColor;height:20%;transition:height .09s linear}',

/* PIP собственного видео */
'.okc-pip{position:absolute;right:12px;z-index:5;width:min(112px,30vw);aspect-ratio:3/4;border-radius:16px;overflow:hidden;',
'  background:#0a0d07;border:1px solid rgba(255,255,255,.16);box-shadow:0 10px 26px rgba(0,0,0,.5);',
'  bottom:calc(var(--okc-barh,150px) + var(--oko-safe-bottom,0px) + 14px)}',
'.okc-pip[hidden]{display:none}',
'.okc-pip video{width:100%;height:100%;object-fit:cover;transform:scaleX(-1);display:none}',
'.okc-pip.live video{display:block}',
'.okc-pip-fb{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;text-align:center;padding:8px;',
'  font-size:10.5px;line-height:1.3;color:#c6d1b6}',
'.okc-pip.live .okc-pip-fb{display:none}',

/* --------- конференция --------- */
'.okc-stage{position:relative;z-index:3;flex:1;min-height:0;display:none;overflow-y:auto;',
'  grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:8px;align-content:start;',
'  padding:4px 12px 16px}',
'.okc-screen.m-conf .okc-stage{display:grid}',
'.okc-tile{position:relative;aspect-ratio:3/4;border-radius:16px;overflow:hidden;background:linear-gradient(165deg,#151a10,#05070300);',
'  border:1px solid rgba(255,255,255,.1);display:flex;align-items:center;justify-content:center;transition:border-color .18s,box-shadow .18s}',
'.okc-tile.speaking{border-color:var(--okc-lime);box-shadow:0 0 0 2px rgba(154,255,0,.3),0 0 20px rgba(154,255,0,.22)}',
'.okc-tile video{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;background:#000}',
'.okc-tile.self video{transform:scaleX(-1)}',
'.okc-tile.share video{transform:none;object-fit:contain;background:#000}',
'.okc-tile-ava{width:58px;height:58px;border-radius:50%;display:flex;align-items:center;justify-content:center;overflow:hidden;',
'  background:linear-gradient(160deg,#25400f,#0a1104);color:var(--okc-lime);',
'  font-family:var(--font-display,"Bebas Neue"),sans-serif;font-size:22px;letter-spacing:.04em}',
'.okc-tile-nm{position:absolute;left:7px;right:7px;bottom:7px;display:flex;align-items:center;gap:5px;',
'  padding:4px 8px;border-radius:99px;background:rgba(0,0,0,.6);font-size:11.5px;font-weight:600;',
'  white-space:nowrap;overflow:hidden;text-overflow:ellipsis}',
'.okc-tile-nm .okc-i{width:12px;height:12px;flex-shrink:0;color:var(--okc-lime);stroke-width:6}',
'.okc-tile-nm span{overflow:hidden;text-overflow:ellipsis}',
'.okc-tile-fl{position:absolute;top:7px;right:7px;display:flex;gap:4px}',
'.okc-tile-fl i{width:22px;height:22px;border-radius:50%;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,.6)}',
'.okc-tile-fl i.mut{background:var(--okc-red)}',
'.okc-tile-fl i.hand{background:var(--okc-lime);color:#000}',
'.okc-tile-fl .okc-i{width:12px;height:12px;stroke-width:6}',
'.okc-empty{grid-column:1/-1;border-radius:16px;padding:14px;background:rgba(255,255,255,.06);',
'  border:1px dashed rgba(255,255,255,.18);color:#d3dcc7;font-size:12.8px;line-height:1.5}',
'.okc-empty b{color:#fff;display:block;margin-bottom:5px;font-size:13.5px}',

/* --------- нижняя панель --------- */
/* 62px кнопка + 6px зазор: пять штук помещаются в ряд даже на 360px. */
'.okc-bar{position:relative;z-index:6;flex-shrink:0;display:flex;flex-wrap:wrap;justify-content:center;align-items:flex-start;',
'  gap:10px 6px;padding:10px 10px 14px;background:linear-gradient(0deg,rgba(0,0,0,.72),rgba(0,0,0,0))}',
'.okc-b{display:flex;flex-direction:column;align-items:center;gap:5px;width:62px;-webkit-tap-highlight-color:transparent}',
'.okc-b>i{width:54px;height:54px;border-radius:50%;display:flex;align-items:center;justify-content:center;position:relative;',
'  background:var(--okc-btn);color:#fff;transition:transform .1s,background .18s,color .18s,box-shadow .2s}',
'.okc-b:active>i{transform:scale(.91)}',
/* Подпись переносится только по пробелу: слово посреди рвать нельзя. */
'.okc-b>span{font-size:9.5px;line-height:1.2;text-align:center;color:#c6d1b6;width:62px;',
'  overflow-wrap:normal;word-break:normal;hyphens:none}',
'.okc-b.on>i{background:var(--okc-lime);color:#000;box-shadow:var(--okc-glow)}',
'.okc-b.on>span{color:var(--okc-lime)}',
'.okc-b.danger>i{background:var(--okc-red);color:#fff;box-shadow:0 6px 20px rgba(255,59,48,.5)}',
'.okc-b.accept>i{background:var(--okc-lime);color:#000;box-shadow:var(--okc-glow)}',
'.okc-b.accept .okc-i{transform:rotate(135deg)}',
'.okc-b.big>i{width:66px;height:66px}',
'.okc-b[disabled]{opacity:.42}',
'.okc-b .okc-i{width:24px;height:24px}',
'.okc-b .okc-badge{position:absolute;top:-2px;right:-2px;min-width:19px;height:19px;padding:0 5px;border-radius:10px;',
'  background:var(--okc-lime);color:#000;font-size:10.5px;font-weight:800;display:flex;align-items:center;justify-content:center;',
'  border:2px solid #05070a;line-height:1}',

/* --------- правая панель участников --------- */
'.okc-side{position:absolute;top:0;right:0;bottom:0;width:min(340px,88vw);z-index:8;display:flex;flex-direction:column;',
'  transform:translateX(100%);visibility:hidden;transition:transform .26s cubic-bezier(.3,1,.4,1),visibility .26s;',
'  background:var(--okc-panel-d);backdrop-filter:blur(18px);border-left:1px solid rgba(255,255,255,.09);color:#fff;',
'  padding-top:var(--oko-safe-top,0px);padding-bottom:var(--oko-safe-bottom,0px)}',
':root[data-theme="light"] .okc-side{background:var(--okc-panel-l);color:#0f1a02;border-left-color:rgba(20,30,5,.12)}',
'.okc-side.on{transform:none;visibility:visible}',
'.okc-hd{display:flex;align-items:center;gap:10px;padding:14px 14px 10px;flex-shrink:0}',
'.okc-hd b{flex:1;min-width:0;font-family:var(--font-display,"Bebas Neue"),sans-serif;font-size:19px;letter-spacing:.07em;',
'  white-space:nowrap;overflow:hidden;text-overflow:ellipsis}',
':root[data-theme="light"] .okc-side .okc-tbtn,:root[data-theme="light"] .okc-sheet .okc-tbtn{background:rgba(20,30,5,.09);color:#0f1a02}',
'.okc-body{flex:1;min-height:0;overflow-y:auto;padding:2px 12px 16px;font-size:13px;line-height:1.5}',
'.okc-row{display:flex;align-items:center;gap:10px;width:100%;padding:9px 8px;border-radius:12px;text-align:left;color:inherit}',
'.okc-row:active{background:rgba(154,255,0,.12)}',
'.okc-row .okc-pa{width:38px;height:38px;border-radius:50%;flex-shrink:0;display:flex;align-items:center;justify-content:center;',
'  background:linear-gradient(160deg,#25400f,#0a1104);color:var(--okc-lime);font-family:var(--font-display,"Bebas Neue"),sans-serif;font-size:16px}',
'.okc-row .okc-pb{flex:1;min-width:0}',
'.okc-row .okc-pb b{display:block;font-size:13.5px;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}',
'.okc-row .okc-pb small{display:block;font-size:11px;color:#9fac90;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}',
':root[data-theme="light"] .okc-row .okc-pb small{color:#55603f}',
'.okc-row .okc-pf{display:flex;gap:5px;flex-shrink:0}',
'.okc-row .okc-pf i{width:26px;height:26px;border-radius:50%;display:flex;align-items:center;justify-content:center;background:rgba(255,255,255,.1)}',
':root[data-theme="light"] .okc-row .okc-pf i{background:rgba(20,30,5,.09)}',
'.okc-row .okc-pf i.mut{background:var(--okc-red);color:#fff}',
'.okc-row .okc-pf .okc-i{width:13px;height:13px;stroke-width:6}',
'.okc-hint{border-radius:14px;padding:12px;margin:6px 0;background:rgba(154,255,0,.1);border:1px solid rgba(154,255,0,.24);',
'  font-size:12.5px;line-height:1.5;color:#dbe7cd}',
':root[data-theme="light"] .okc-hint{color:#28380c}',
'.okc-hint b{display:block;margin-bottom:4px}',

/* --------- нижняя шторка --------- */
'.okc-sheet{position:absolute;left:0;right:0;bottom:0;z-index:9;max-height:82%;display:flex;flex-direction:column;',
'  transform:translateY(100%);visibility:hidden;transition:transform .26s cubic-bezier(.3,1,.4,1),visibility .26s;',
'  background:var(--okc-panel-d);backdrop-filter:blur(18px);color:#fff;border-radius:20px 20px 0 0;',
'  border-top:1px solid rgba(255,255,255,.09);padding-bottom:var(--oko-safe-bottom,0px)}',
':root[data-theme="light"] .okc-sheet{background:var(--okc-panel-l);color:#0f1a02;border-top-color:rgba(20,30,5,.12)}',
'.okc-sheet.on{transform:none;visibility:visible}',
'.okc-sheet::before{content:"";display:block;width:40px;height:4px;border-radius:2px;background:rgba(255,255,255,.22);margin:8px auto 2px;flex-shrink:0}',
':root[data-theme="light"] .okc-sheet::before{background:rgba(20,30,5,.2)}',
'.okc-scrim{position:absolute;inset:0;z-index:7;background:rgba(0,0,0,.5);opacity:0;visibility:hidden;transition:opacity .22s,visibility .22s}',
'.okc-scrim.on{opacity:1;visibility:visible}',
'.okc-tg{display:flex;align-items:center;gap:12px;width:100%;padding:12px 4px;text-align:left;color:inherit;',
'  border-bottom:1px solid rgba(255,255,255,.07)}',
':root[data-theme="light"] .okc-tg{border-bottom-color:rgba(20,30,5,.09)}',
'.okc-tg:last-child{border-bottom:0}',
/* Только первый span тянется. Иначе flex:1 прилетал и переключателю,
   и он растягивался на всю строку вместо своих 44px. */
'.okc-tg>span:first-child{flex:1;min-width:0}',
'.okc-tg b{display:block;font-size:13.5px;font-weight:600}',
'.okc-tg small{display:block;font-size:11.5px;color:#9fac90;margin-top:2px;line-height:1.4}',
':root[data-theme="light"] .okc-tg small{color:#55603f}',
'.okc-sw{width:44px;height:25px;border-radius:13px;background:rgba(255,255,255,.16);position:relative;flex-shrink:0;transition:background .18s}',
':root[data-theme="light"] .okc-sw{background:rgba(20,30,5,.16)}',
'.okc-sw i{position:absolute;left:3px;top:3px;width:19px;height:19px;border-radius:50%;background:#fff;transition:left .18s}',
'.okc-sw.on{background:var(--okc-lime)}',
'.okc-sw.on i{left:22px;background:#000}',

/* --------- меню по участнику --------- */
'.okc-menu{position:absolute;z-index:10;min-width:224px;max-width:min(280px,92vw);display:none;overflow:hidden;',
'  background:var(--okc-panel-d);backdrop-filter:blur(18px);border:1px solid rgba(255,255,255,.1);',
'  border-radius:14px;box-shadow:0 20px 50px rgba(0,0,0,.55);color:#fff}',
':root[data-theme="light"] .okc-menu{background:var(--okc-panel-l);color:#0f1a02;border-color:rgba(20,30,5,.12)}',
'.okc-menu.on{display:block;animation:okc-in .15s ease-out}',
'.okc-menu-hd{padding:10px 14px 6px;font-size:10.5px;letter-spacing:.06em;text-transform:uppercase;color:#9fac90;font-weight:700;',
'  white-space:nowrap;overflow:hidden;text-overflow:ellipsis}',
'.okc-mi{display:flex;align-items:center;gap:10px;width:100%;padding:11px 14px;font-size:13.5px;text-align:left;color:inherit}',
'.okc-mi:active{background:rgba(154,255,0,.14)}',
'.okc-mi.danger{color:var(--okc-red)}',
'.okc-mi .okc-i{width:18px;height:18px;flex-shrink:0}',
'.okc-mi span{flex:1;min-width:0}',

/* --------- свёрнутая плашка --------- */
/* left и bottom считает okcMeasure() по реальной мебели: на телефоне это
   нижнее меню или композер, на ПК — боковая колонка навигации. */
'.okc-pill{position:fixed;z-index:78;display:none;align-items:center;gap:10px;padding:8px 15px 8px 11px;',
'  left:var(--okc-pilll,12px);bottom:calc(var(--okc-pillb,12px) + var(--okc-pills,0px));',
'  background:var(--okc-lime);color:#000;border-radius:99px;max-width:calc(100vw - var(--okc-pilll,12px) - 12px);',
'  box-shadow:0 8px 24px rgba(0,0,0,.4),var(--okc-glow);-webkit-tap-highlight-color:transparent}',
'.okc-pill.on{display:inline-flex;animation:okc-in .2s ease-out}',
'.okc-pill:active{transform:scale(.97)}',
'.okc-pill-dot{width:8px;height:8px;border-radius:50%;background:#000;flex-shrink:0;animation:okc-blink 1.5s infinite}',
'.okc-pill-tx{display:flex;flex-direction:column;line-height:1.15;text-align:left;min-width:0}',
'.okc-pill-tx b{font-size:13px;font-weight:800;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}',
'.okc-pill-tx small{font-size:10.5px;font-weight:700;opacity:.72;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}',

/* --------- тост --------- */
'.okc-toast{position:fixed;left:50%;transform:translateX(-50%);z-index:9600;max-width:min(420px,92vw);',
'  bottom:calc(var(--okc-pillb,12px) + var(--okc-pills,0px) + 58px);',
'  padding:11px 16px;border-radius:16px;background:rgba(10,13,8,.95);color:#fff;font-size:13px;line-height:1.45;',
'  border:1px solid rgba(154,255,0,.28);box-shadow:0 10px 26px rgba(0,0,0,.5);pointer-events:none;',
'  animation:okc-toast 3.6s ease-out forwards}',
'@keyframes okc-toast{0%{opacity:0;transform:translate(-50%,10px)}8%,86%{opacity:1;transform:translate(-50%,0)}100%{opacity:0;transform:translate(-50%,-8px)}}',

'@media(prefers-reduced-motion:reduce){.okc-ring,.okc-live,.okc-pill-dot{animation:none!important}}',
/* Широкий экран: не растягиваем плитки конференции в полосы */
'@media(min-width:760px){.okc-stage{grid-template-columns:repeat(auto-fit,minmax(200px,220px));justify-content:center}}'
  ].join('\n');
  document.head.appendChild(css);
}

/* ================================================================== РАЗМЕТКА */
function okcBuild() {
  if (built) return;
  okcStyles();

  var scr = document.createElement('div');
  scr.id = 'okc-screen';
  scr.className = 'okc-screen';
  scr.setAttribute('role', 'dialog');
  scr.setAttribute('aria-modal', 'true');
  scr.setAttribute('aria-hidden', 'true');
  scr.setAttribute('aria-labelledby', 'okc-title');
  scr.innerHTML = [
    '<div class="okc-top">',
      '<button type="button" class="okc-tbtn" id="okc-min" aria-label="Свернуть звонок и вернуться в приложение" title="Свернуть">' + ICON('min') + '</button>',
      '<div class="okc-ttl"><b id="okc-title">Звонок</b><small id="okc-sub"></small></div>',
      '<button type="button" class="okc-tbtn" id="okc-gear" aria-label="Настройки созвона" title="Настройки" hidden>' + ICON('gear') + '</button>',
    '</div>',

    '<div class="okc-pers" id="okc-pers">',
      '<div class="okc-halo"><span class="okc-ring"></span><span class="okc-ring"></span><span class="okc-ring"></span>',
        '<div class="okc-ava" id="okc-ava">O</div></div>',
      '<div class="okc-nm" id="okc-name">Звонок</div>',
      '<div class="okc-st" id="okc-status"></div>',
      '<div class="okc-chip" id="okc-chip" hidden></div>',
      '<div class="okc-note" id="okc-note" hidden></div>',
    '</div>',

    '<div class="okc-stage" id="okc-stage"></div>',

    '<div class="okc-pip" id="okc-pip" hidden>',
      '<video id="okc-self" playsinline autoplay muted></video>',
      '<div class="okc-pip-fb" id="okc-pipfb">Камера выключена</div>',
    '</div>',

    '<div class="okc-bar" id="okc-bar"></div>',

    '<div class="okc-scrim" id="okc-scrim"></div>',

    '<div class="okc-side" id="okc-side" aria-hidden="true" role="dialog" aria-label="Участники созвона">',
      '<div class="okc-hd"><b>Участники</b>',
        '<button type="button" class="okc-tbtn" id="okc-side-x" aria-label="Закрыть список участников">' + ICON('x') + '</button></div>',
      '<div class="okc-body" id="okc-side-body"></div>',
    '</div>',

    '<div class="okc-sheet" id="okc-sheet" aria-hidden="true" role="dialog" aria-label="Шторка звонка">',
      '<div class="okc-hd"><b id="okc-sheet-ttl">Настройки</b>',
        '<button type="button" class="okc-tbtn" id="okc-sheet-x" aria-label="Закрыть шторку">' + ICON('x') + '</button></div>',
      '<div class="okc-body" id="okc-sheet-body"></div>',
    '</div>',

    '<div class="okc-menu" id="okc-menu" role="menu" aria-hidden="true"></div>'
  ].join('');
  document.body.appendChild(scr);

  var pill = document.createElement('button');
  pill.type = 'button';
  pill.id = 'okc-pill';
  pill.className = 'okc-pill';
  pill.hidden = true;
  pill.setAttribute('aria-label', 'Вернуться в звонок');
  pill.innerHTML = '<span class="okc-pill-dot"></span><span class="okc-pill-tx">' +
    '<b id="okc-pill-nm">Звонок</b><small id="okc-pill-tm">00:00</small></span>';
  document.body.appendChild(pill);

  built = true;
  okcWire();
  okcMeasure();
}

/* ============================================================ ИЗМЕРЕНИЯ */
/* Плашка свёрнутого звонка не должна лежать на нижнем меню и на композере
   чата. Меряем реальную нижнюю мебель и отдаём высоту в CSS-переменную. */
function okcMeasure() {
  if (!built) return;
  var root = document.documentElement;

  var bar = $('okc-bar');
  if (bar) {
    var bh = Math.round(bar.getBoundingClientRect().height) || 0;
    root.style.setProperty('--okc-barh', (bh > 0 ? bh : 150) + 'px');
  }

  var vh = window.innerHeight || 0;
  var vw = window.innerWidth || 0;
  var bottom = 0;
  var left = 12;

  var tabs = document.getElementById('tabs');
  if (tabs && tabs.offsetParent !== null) {
    var cs = getComputedStyle(tabs);
    var rt = tabs.getBoundingClientRect();
    if (rt.width > 0 && rt.height > 0) {
      if (cs.flexDirection === 'column' && rt.width < vw * 0.5) {
        /* ПК: навигация стоит колонкой сбоку — плашку сдвигаем правее неё */
        if (rt.left < vw * 0.5) left = Math.round(rt.right) + 12;
      } else if (rt.bottom > vh - 4) {
        /* телефон: навигация лежит полосой внизу */
        bottom = Math.max(bottom, rt.height);
      }
    }
  }
  root.style.setProperty('--okc-pilll', left + 'px');
  var comp = document.querySelector('#convBody .composer');
  if (comp && comp.offsetParent !== null) {
    var rc = comp.getBoundingClientRect();
    if (rc.height > 0 && rc.bottom > vh - 200) bottom = Math.max(bottom, vh - rc.top);
  }

  if (bottom > 0) {
    /* высота мебели уже включает её собственный safe-inset */
    root.style.setProperty('--okc-pillb', Math.round(bottom + 10) + 'px');
    root.style.setProperty('--okc-pills', '0px');
  } else {
    root.style.setProperty('--okc-pillb', '12px');
    root.style.setProperty('--okc-pills', 'var(--oko-safe-bottom, 0px)');
  }
}

/* ==================================================== МЕДИА (по-настоящему) */
function okcMediaError(err) {
  var n = (err && err.name) || '';
  if (n === 'NotAllowedError' || n === 'SecurityError') {
    return { code: 'denied', title: 'Доступ к микрофону и камере запрещён',
      text: 'Браузер не дал приложению микрофон и камеру. Разрешите доступ в настройках сайта (значок замка в адресной строке) и нажмите «Повторить». Без микрофона звонок физически невозможен.' };
  }
  if (n === 'NotFoundError' || n === 'OverconstrainedError' || n === 'DevicesNotFoundError') {
    return { code: 'nodev', title: 'Устройство не найдено',
      text: 'На этом устройстве нет доступного микрофона или камеры. Подключите гарнитуру или откройте приложение на телефоне.' };
  }
  if (n === 'NotReadableError' || n === 'TrackStartError' || n === 'AbortError') {
    return { code: 'busy', title: 'Микрофон занят другой программой',
      text: 'Камеру или микрофон уже использует другое приложение или вкладка. Закройте её и нажмите «Повторить».' };
  }
  return { code: 'fail', title: 'Не удалось включить микрофон',
    text: 'Браузер вернул ошибку' + (n ? ' «' + n + '»' : '') + '. Проверьте, что страница открыта по HTTPS, и нажмите «Повторить».' };
}

function okcStopStream() {
  if (stream) { try { stream.getTracks().forEach(function (t) { t.stop(); }); } catch (e) {} stream = null; }
  if (displayStream) { try { displayStream.getTracks().forEach(function (t) { t.stop(); }); } catch (e) {} displayStream = null; }
  okcMeterStop();
  var v = $('okc-self'); if (v) { try { v.srcObject = null; } catch (e) {} }
  /* Окошко своего видео гасим целиком: иначе чёрный прямоугольник от прошлого
     звонка остаётся висеть на следующем экране. */
  var pip = $('okc-pip'); if (pip) { pip.classList.remove('live'); pip.hidden = true; }
}

/* Запросить свои устройства. Возвращает {ok:true} или {ok:false, ...ошибка}. */
function okcGetMedia(wantVideo) {
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    return Promise.resolve({ ok: false, code: 'nosupport',
      title: 'Браузер не умеет звонить',
      text: 'В этом браузере нет getUserMedia — доступа к микрофону и камере. Откройте приложение в Telegram или в свежем Chrome/Safari.' });
  }
  okcStopStream();
  var constraints = { audio: true, video: wantVideo ? { facingMode: (S && S.facing) || 'user' } : false };
  return navigator.mediaDevices.getUserMedia(constraints).then(function (st) {
    if (!S) { st.getTracks().forEach(function (t) { t.stop(); }); return { ok: false, code: 'aborted' }; }
    stream = st;
    /* устройство могло отвалиться прямо во время разговора — честно ловим */
    st.getTracks().forEach(function (t) {
      t.addEventListener('ended', function () {
        if (!S) return;
        okcSetNote({ warn: true, title: 'Устройство отключилось',
          text: 'Микрофон или камера перестали отдавать сигнал — устройство отключили или доступ отозвали.',
          acts: [{ label: 'Повторить', icon: 'refresh', pri: true, fn: okcRetryMedia }] });
        okcRenderBar(); okcRenderStage();
      });
    });
    okcApplyStreamToUi();
    okcMeterStart();
    return { ok: true };
  }).catch(function (err) {
    var e = okcMediaError(err);
    e.ok = false;
    return e;
  });
}

function okcApplyStreamToUi() {
  var pip = $('okc-pip'), v = $('okc-self'), fb = $('okc-pipfb');
  if (!pip || !v) return;
  var vt = stream ? stream.getVideoTracks()[0] : null;
  var hasVideo = !!(vt && vt.enabled && vt.readyState === 'live');
  if (S && S.mode === 'personal' && S.video) {
    pip.hidden = false;
    if (stream) { try { v.srcObject = stream; v.play && v.play().catch(function () {}); } catch (e) {} }
    pip.classList.toggle('live', hasVideo);
    if (fb) fb.textContent = vt ? 'Камера выключена' : 'Камера недоступна';
  } else {
    pip.hidden = true;
    pip.classList.remove('live');
  }
}

function okcRetryMedia() {
  if (!S) return;
  S.err = null;
  okcSetNote(null);
  okcRenderStage();
  okcSetStatus('Запрашиваем микрофон…');
  okcGetMedia(!!S.video).then(function (r) {
    if (!S) return;
    if (!r.ok) { okcFailMedia(r); return; }
    okcAfterMedia();
  });
}

/* ------- реальный уровень собственного голоса (не имитация) ------- */
function okcMeterStart() {
  okcMeterStop();
  var AC = window.AudioContext || window.webkitAudioContext;
  if (!AC || !stream || !stream.getAudioTracks().length) return;
  try {
    var ctx = new AC();
    var src = ctx.createMediaStreamSource(stream);
    var an = ctx.createAnalyser();
    an.fftSize = 512; an.smoothingTimeConstant = .7;
    src.connect(an);
    meter = { ctx: ctx, analyser: an, data: new Uint8Array(an.frequencyBinCount), raf: 0, level: 0 };
    if (ctx.state === 'suspended') ctx.resume().catch(function () {});
    var loop = function () {
      if (!meter) return;
      meter.analyser.getByteTimeDomainData(meter.data);
      var sum = 0;
      for (var i = 0; i < meter.data.length; i++) { var d = (meter.data[i] - 128) / 128; sum += d * d; }
      var rms = Math.sqrt(sum / meter.data.length);
      meter.level = Math.min(1, rms * 4.5);
      okcPaintLevel();
      meter.raf = requestAnimationFrame(loop);
    };
    meter.raf = requestAnimationFrame(loop);
  } catch (e) { meter = null; }
}
function okcMeterStop() {
  if (!meter) return;
  try { cancelAnimationFrame(meter.raf); } catch (e) {}
  try { meter.ctx.close(); } catch (e) {}
  meter = null;
  okcPaintLevel();
}
function okcPaintLevel() {
  var lvl = meter ? meter.level : 0;
  var micOn = !!(S && S.mic && stream && stream.getAudioTracks().some(function (t) { return t.enabled; }));
  var v = micOn ? lvl : 0;
  var box = $('okc-lvl');
  if (box) {
    var bars = box.children;
    for (var i = 0; i < bars.length; i++) {
      var k = [0.55, 0.85, 1, 0.85, 0.55][i] || 0.6;
      bars[i].style.height = Math.round(20 + v * k * 80) + '%';
    }
  }
  var tile = document.querySelector('#okc-stage .okc-tile.self');
  if (tile) tile.classList.toggle('speaking', micOn && v > 0.12);
}

/* ================================================== ЭКРАН: ОБЩИЕ ХЕЛПЕРЫ */
function okcSetStatus(text) { var el = $('okc-status'); if (el) el.textContent = text || ''; }
/* Чип строим один раз, дальше меняем только текст: иначе полоски уровня
   голоса пересоздавались бы каждую секунду и дёргались. */
function okcSetChip(text) {
  var el = $('okc-chip'); if (!el) return;
  if (!text) { if (!el.hidden) { el.hidden = true; el.innerHTML = ''; } return; }
  if (el.hidden || !$('okc-lvl')) {
    el.hidden = false;
    el.innerHTML = '<span class="okc-lvl" id="okc-lvl"><i></i><i></i><i></i><i></i><i></i></span><span id="okc-chip-tx"></span>';
  }
  var tx = $('okc-chip-tx');
  if (tx && tx.textContent !== text) tx.textContent = text;
}
/* Честная карточка: {title, text, warn, acts:[{label,icon,pri,fn}]} либо null */
var noteActs = [];
function okcSetNote(cfg) {
  var el = $('okc-note'); if (!el) return;
  noteActs = [];
  if (!cfg) { el.hidden = true; el.innerHTML = ''; return; }
  var acts = (cfg.acts || []).map(function (a, i) {
    noteActs[i] = a.fn;
    return '<button type="button" class="okc-mini' + (a.pri ? ' pri' : '') + '" data-okc-act="' + i + '">' +
      (a.icon ? ICON(a.icon) : '') + '<span>' + okcEsc(a.label) + '</span></button>';
  }).join('');
  el.className = 'okc-note' + (cfg.warn ? ' warn' : '');
  el.hidden = false;
  el.innerHTML =
    '<div class="okc-note-hd">' + ICON(cfg.warn ? 'x' : 'info') + '<span>' + okcEsc(cfg.title) + '</span></div>' +
    '<p>' + okcEsc(cfg.text) + '</p>' +
    (acts ? '<div class="okc-note-acts">' + acts + '</div>' : '');
}

/* ==================================================== НИЖНЯЯ ПАНЕЛЬ КНОПОК */
var barActs = {};
function okcBtn(key, opts) {
  barActs[key] = opts.fn;
  return '<button type="button" class="okc-b' + (opts.cls ? ' ' + opts.cls : '') + '"' +
    (opts.disabled ? ' disabled aria-disabled="true"' : '') +
    ' data-okc-b="' + key + '"' +
    ' aria-pressed="' + (opts.pressed ? 'true' : 'false') + '"' +
    ' aria-label="' + okcEsc(opts.aria || opts.label) + '"' +
    ' title="' + okcEsc(opts.aria || opts.label) + '">' +
    '<i>' + ICON(opts.icon) + (opts.badge ? '<span class="okc-badge">' + okcEsc(opts.badge) + '</span>' : '') + '</i>' +
    '<span>' + okcEsc(opts.label) + '</span></button>';
}
function okcRenderBar() {
  var bar = $('okc-bar'); if (!bar || !S) return;
  barActs = {};
  var h = [];

  if (S.phase === 'ringing') {
    h.push(okcBtn('decline', { icon: 'hangup', label: 'Отклонить', cls: 'danger big',
      aria: 'Отклонить входящий звонок', fn: function () { okcEnd('declined'); } }));
    h.push(okcBtn('accept', { icon: 'hangup', label: 'Принять', cls: 'accept big',
      aria: 'Принять входящий звонок', fn: okcAccept }));
    bar.innerHTML = h.join('');
    okcMeasure();
    return;
  }

  var hasMic = !!(stream && stream.getAudioTracks().length);
  var hasCam = !!(stream && stream.getVideoTracks().length);

  h.push(okcBtn('mic', {
    icon: S.mic && hasMic ? 'mic' : 'mic-off',
    label: S.mic && hasMic ? 'Микрофон' : 'Микрофон выкл.',
    cls: S.mic && hasMic ? 'on' : '', pressed: S.mic && hasMic, disabled: !hasMic,
    aria: !hasMic ? 'Микрофон недоступен' : (S.mic ? 'Выключить микрофон' : 'Включить микрофон'),
    fn: okcToggleMic
  }));

  if (S.mode === 'personal') {
    h.push(okcBtn('spk', {
      icon: S.spk ? 'spk' : 'spk-off', label: S.spk ? 'Динамик' : 'В наушник',
      cls: S.spk ? 'on' : '', pressed: S.spk,
      aria: S.spk ? 'Переключить звук на наушник' : 'Переключить звук на громкую связь',
      fn: okcToggleSpeaker
    }));
  }

  h.push(okcBtn('cam', {
    icon: S.cam && hasCam ? 'cam' : 'cam-off',
    label: S.cam && hasCam ? 'Камера' : 'Камера выкл.',
    cls: S.cam && hasCam ? 'on' : '', pressed: S.cam && hasCam,
    aria: S.cam && hasCam ? 'Выключить камеру' : 'Включить камеру',
    fn: okcToggleCam
  }));

  if (S.mode === 'personal') {
    h.push(okcBtn('flip', {
      icon: 'flip', label: 'Сменить', disabled: !(S.cam && hasCam),
      aria: 'Переключиться на другую камеру', fn: okcFlipCam
    }));
  } else {
    h.push(okcBtn('share', {
      icon: 'share', label: S.share ? 'Стоп показ' : 'Показ экрана',
      cls: S.share ? 'on' : '', pressed: S.share,
      aria: S.share ? 'Остановить демонстрацию экрана' : 'Показать свой экран',
      fn: okcToggleShare
    }));
    h.push(okcBtn('hand', {
      icon: 'hand', label: S.hand ? 'Руку вниз' : 'Поднять руку',
      cls: S.hand ? 'on' : '', pressed: S.hand,
      aria: S.hand ? 'Опустить руку' : 'Поднять руку — попросить слово',
      fn: okcToggleHand
    }));
    h.push(okcBtn('parts', {
      icon: 'users', label: 'Участники', badge: String(S.parts.length),
      aria: 'Список участников, сейчас в созвоне: ' + S.parts.length,
      fn: function () { okcSideOpen(); }
    }));
    h.push(okcBtn('chat', { icon: 'chat', label: 'Чат', aria: 'Чат созвона', fn: okcConfChat }));
  }

  h.push(okcBtn('end', {
    icon: 'hangup', label: S.mode === 'conf' ? 'Покинуть' : 'Завершить', cls: 'danger',
    aria: S.mode === 'conf' ? 'Покинуть созвон' : 'Завершить звонок',
    fn: function () { okcEnd('user'); }
  }));

  bar.innerHTML = h.join('');
  okcMeasure();
}

/* ================================================== ПЕРЕКЛЮЧАТЕЛИ УСТРОЙСТВ */
function okcToggleMic() {
  if (!S || !stream) return;
  var tracks = stream.getAudioTracks();
  if (!tracks.length) { okcToast('Микрофон недоступен: устройство не выдало аудиодорожку.'); return; }
  S.mic = !S.mic;
  tracks.forEach(function (t) { t.enabled = S.mic; });
  okcRenderBar(); okcRenderStage(); okcPaintLevel();
}
function okcToggleCam() {
  if (!S) return;
  var tracks = stream ? stream.getVideoTracks() : [];
  if (!tracks.length) {
    /* камеры в потоке нет — просим её по-настоящему */
    S.video = true;
    okcSetStatus('Запрашиваем камеру…');
    okcGetMedia(true).then(function (r) {
      if (!S) return;
      if (!r.ok) { okcFailMedia(r); return; }
      S.cam = true;
      okcAfterMedia();
    });
    return;
  }
  S.cam = !S.cam;
  tracks.forEach(function (t) { t.enabled = S.cam; });
  okcApplyStreamToUi();
  okcRenderBar(); okcRenderStage();
}
/* Смена камеры — по-настоящему: смотрим список устройств. */
function okcFlipCam() {
  if (!S || !stream) return;
  if (!navigator.mediaDevices || !navigator.mediaDevices.enumerateDevices) {
    okcToast('Браузер не отдаёт список камер — переключить нечем.');
    return;
  }
  navigator.mediaDevices.enumerateDevices().then(function (list) {
    var cams = list.filter(function (d) { return d.kind === 'videoinput'; });
    if (cams.length < 2) {
      okcToast('Вторая камера не найдена: на этом устройстве доступна только одна.');
      return;
    }
    S.facing = (S.facing === 'environment') ? 'user' : 'environment';
    okcSetStatus('Переключаем камеру…');
    okcGetMedia(true).then(function (r) {
      if (!S) return;
      if (!r.ok) { okcFailMedia(r); return; }
      S.cam = true;
      okcAfterMedia();
      okcToast(S.facing === 'environment' ? 'Задняя камера' : 'Фронтальная камера');
    });
  }).catch(function () { okcToast('Не удалось прочитать список камер.'); });
}
/* Динамик/наушник — реально только там, где браузер даёт setSinkId. */
function okcToggleSpeaker() {
  if (!S) return;
  var el = $('okc-remote-audio');
  var canSink = typeof HTMLMediaElement !== 'undefined' &&
                typeof HTMLMediaElement.prototype.setSinkId === 'function';
  if (!canSink) {
    okcToast('Выбор динамика этому браузеру недоступен — звук идёт туда, куда его направляет система.');
    return;
  }
  if (!el) {
    okcToast('Переключать нечего: удалённого звука нет, пока не подключён сервер связи.');
    return;
  }
  S.spk = !S.spk;
  okcRenderBar();
}
/* Демонстрация экрана — настоящий getDisplayMedia, видна пока только вам. */
function okcToggleShare() {
  if (!S) return;
  if (S.share) {
    if (displayStream) { try { displayStream.getTracks().forEach(function (t) { t.stop(); }); } catch (e) {} displayStream = null; }
    S.share = false; okcRenderBar(); okcRenderStage();
    return;
  }
  if (!navigator.mediaDevices || !navigator.mediaDevices.getDisplayMedia) {
    okcToast('Показ экрана в этом браузере недоступен.');
    return;
  }
  navigator.mediaDevices.getDisplayMedia({ video: true, audio: false }).then(function (st) {
    if (!S) { st.getTracks().forEach(function (t) { t.stop(); }); return; }
    displayStream = st;
    S.share = true;
    st.getVideoTracks().forEach(function (t) {
      t.addEventListener('ended', function () { if (S) { S.share = false; displayStream = null; okcRenderBar(); okcRenderStage(); } });
    });
    okcRenderBar(); okcRenderStage();
    okcToast('Экран захвачен. Пока нет сервера связи, его видите только вы.');
  }).catch(function (err) {
    if (err && err.name === 'NotAllowedError') okcToast('Показ экрана отменён.');
    else okcToast('Показ экрана не запустился.');
  });
}
function okcToggleHand() {
  if (!S) return;
  S.hand = !S.hand;
  okcRenderBar(); okcRenderStage(); okcSideRender();
}

/* ================================================== ЛИЧНЫЙ / ВХОДЯЩИЙ ЗВОНОК */
function okcChatById(id) {
  try {
    if (typeof window.CHATS === 'undefined' || !Array.isArray(window.CHATS)) return null;
    return window.CHATS.find(function (c) { return String(c.id) === String(id); }) || null;
  } catch (e) { return null; }
}
function okcIsOwner() {
  try { return typeof window.cpCanManage === 'function' ? !!window.cpCanManage() : false; } catch (e) { return false; }
}
/* Право начинать созвон: только создатель чата (managed) или владелец приложения.
   Правило Даниэля: обычный участник НЕ звонит в общем чате OKO и в канале OKO. */
function okcCanHostConf(chat) {
  if (!chat) return false;
  var kind = chat.kind || 'direct';
  if (kind !== 'group' && kind !== 'channel' && kind !== 'super') return false;
  if (okcIsOwner()) return true;
  return !!chat.managed;
}
/* Куда звонить нельзя вообще: избранное, системные заметки, ИИ-бот. */
function okcIsCallableDirect(chat) {
  if (!chat) return false;
  var kind = chat.kind || 'direct';
  if (chat.cpSaved || kind === 'saved') return false;
  if (chat.bot || chat.ai) return false;
  return kind === 'direct';
}

function okcOpenScreen(mode) {
  okcBuild();
  var scr = $('okc-screen');
  var pip = $('okc-pip'); if (pip) { pip.classList.remove('live'); pip.hidden = true; }
  var stage = $('okc-stage'); if (stage && mode !== 'conf') stage.innerHTML = '';
  scr.classList.remove('m-pers', 'm-conf', 'm-in', 'ringing', 'connected');
  scr.classList.add('on', mode === 'conf' ? 'm-conf' : (mode === 'in' ? 'm-in' : 'm-pers'));
  scr.setAttribute('aria-hidden', 'false');
  document.documentElement.classList.add('okc-lock');
  okcPillHide();
  okcNavPush();
  requestAnimationFrame(okcMeasure);
}
function okcNavPush() {
  try { if (typeof window.nvPush === 'function') window.nvPush('okc:call', function () { okcMinimize(); }); } catch (e) {}
}
function okcNavPop() {
  try { if (typeof window.nvPop === 'function') window.nvPop('okc:call'); } catch (e) {}
}

function okcStartPersonal(userId, isVideo, opts) {
  opts = opts || {};
  okcBuild();
  if (S && S.mode === 'conf') { okcToast('Сначала выйдите из созвона.'); return; }
  if (S) okcEnd('replaced', true);

  var chat = okcChatById(userId);
  var name = opts.name || (chat && chat.name) ||
    ((typeof window.currentChat !== 'undefined' && window.currentChat) ? window.currentChat.name : '') || 'Собеседник';

  S = {
    mode: 'personal', dir: 'out', phase: 'calling', id: userId, name: name,
    ava: opts.ava || (chat && chat.ava) || okcFirstLetter(name),
    video: !!isVideo, mic: true, cam: !!isVideo, spk: true, share: false, hand: false,
    facing: 'user', sec: 0, startedAt: 0, parts: []
  };

  $('okc-title').textContent = isVideo ? 'Видеозвонок' : 'Аудиозвонок';
  $('okc-sub').textContent = name;
  $('okc-name').textContent = name;
  $('okc-ava').textContent = okcFirstLetter(S.ava === name ? name : S.ava);
  okcSetChip(null);
  okcSetNote(null);
  $('okc-gear').hidden = true;

  okcOpenScreen('pers');
  $('okc-screen').classList.add('ringing');
  okcSetStatus('Вызов…');
  okcRenderBar();
  okcConnect();
}

/* Входящий звонок. Зовёт ТОЛЬКО сигнальный сервер — приложение само себе
   входящих не придумывает. */
function okcIncoming(cfg) {
  cfg = cfg || {};
  okcBuild();
  if (S) { okcToast('Уже идёт другой звонок.'); return false; }
  var name = cfg.name || 'Неизвестный номер';
  S = {
    mode: 'personal', dir: 'in', phase: 'ringing', id: cfg.from || null, name: name,
    ava: cfg.ava || okcFirstLetter(name),
    video: !!cfg.video, mic: true, cam: !!cfg.video, spk: true, share: false, hand: false,
    facing: 'user', sec: 0, startedAt: 0, parts: []
  };
  $('okc-title').textContent = cfg.video ? 'Входящий видеозвонок' : 'Входящий звонок';
  $('okc-sub').textContent = name;
  $('okc-name').textContent = name;
  $('okc-ava').textContent = okcFirstLetter(S.ava);
  okcSetChip(null);
  okcSetNote(null);
  $('okc-gear').hidden = true;
  okcOpenScreen('in');
  $('okc-screen').classList.add('ringing');
  okcSetStatus(cfg.video ? 'Вас зовут на видеозвонок' : 'Вас зовут на разговор');
  okcRenderBar();
  return true;
}
function okcAccept() {
  if (!S || S.phase !== 'ringing') return;
  S.phase = 'connecting';
  $('okc-screen').classList.remove('m-in');
  $('okc-screen').classList.add('m-pers');
  $('okc-title').textContent = S.video ? 'Видеозвонок' : 'Аудиозвонок';
  okcSetStatus('Соединение…');
  okcRenderBar();
  okcConnect();
}

/* Единый честный путь соединения: сначала реальные устройства, потом транспорт. */
function okcConnect() {
  if (!S) return;
  S.phase = 'connecting';
  okcSetStatus('Соединение…');
  okcGetMedia(!!S.video).then(function (r) {
    if (!S) return;
    if (!r.ok) { okcFailMedia(r); return; }
    okcAfterMedia();
  });
}
function okcFailMedia(err) {
  if (!S) return;
  S.phase = 'denied';
  S.err = { title: err.title || 'Микрофон недоступен', text: err.text || '' };
  $('okc-screen').classList.remove('ringing', 'connected');
  okcSetStatus(err.title || 'Микрофон недоступен');
  okcSetChip(null);
  okcSetNote({
    warn: true, title: err.title || 'Микрофон недоступен', text: err.text || '',
    acts: [
      { label: 'Повторить', icon: 'refresh', pri: true, fn: okcRetryMedia },
      { label: 'Закрыть звонок', icon: 'x', fn: function () { okcEnd('user'); } }
    ]
  });
  okcRenderBar();
  okcRenderStage();
}
/* Устройства получены. Дальше — транспорт: либо настоящий, либо честный тупик. */
function okcAfterMedia() {
  if (!S) return;
  okcApplyStreamToUi();
  var tr = okcTransport();
  if (!tr) { okcNoLink(); return; }
  okcSetStatus('Соединение…');
  var res;
  try { res = tr.connect({ mode: S.mode, id: S.id, video: S.video, stream: stream }); }
  catch (e) { res = Promise.reject(e); }
  Promise.resolve(res).then(function (out) {
    if (!S) return;
    S.phase = 'connected';
    S.startedAt = Date.now();
    $('okc-screen').classList.remove('ringing');
    $('okc-screen').classList.add('connected');
    if (out && out.participants && S.mode === 'conf') S.parts = okcNormalizeParts(out.participants);
    okcTickStart();
    okcRenderBar(); okcRenderStage(); okcSideRender();
  }).catch(function () {
    if (!S) return;
    okcNoLink('Сервер связи ответил ошибкой — соединение не установлено.');
  });
}
/* Честный тупик: транспорта нет. */
function okcNoLink(extra) {
  if (!S) return;
  S.phase = 'nolink';
  S.err = null;
  S.startedAt = Date.now();
  $('okc-screen').classList.remove('ringing', 'connected');
  okcSetStatus(S.mode === 'conf' ? 'Созвон открыт только у вас' : 'Дозвониться нельзя: нет сервера связи');
  okcTickStart();
  okcSetNote({
    title: 'Почему разговор не начинается',
    text: (extra ? extra + ' ' : '') + TRANSPORT_NOTE,
    acts: [{ label: 'Что нужно для звонков', icon: 'info', fn: okcOpenWhat }]
  });
  okcRenderBar();
  okcRenderStage();
  okcSideRender();
}
function okcOpenWhat() {
  okcSheet('Что нужно для звонков', [
    '<div class="okc-hint"><b>Уже работает на вашем устройстве</b>',
    'Микрофон и камера, реальный уровень своего голоса, выключение и включение дорожек, ',
    'переключение между камерами, захват своего экрана, свёрнутая плашка с таймером, права на созвон.</div>',
    '<div class="okc-hint"><b>Чего не хватает</b>',
    'Сигнального сервера WebRTC: он передаёт приглашение второму человеку, обменивает SDP и ICE-кандидатов ',
    'и держит комнату созвона. Без него браузеру некуда отправить ваш поток и неоткуда взять чужой.</div>',
    '<div class="okc-hint"><b>Как это включится</b>',
    'Когда сервер подключат, приложение зарегистрирует транспорт, и эти же экраны начнут соединять по-настоящему: ',
    'появятся статусы «вызов», «соединение», «в разговоре» и таймер разговора. Ничего переустанавливать не нужно.</div>'
  ].join(''));
}

/* ================================================== КОНФЕРЕНЦИЯ */
function okcNormalizeParts(list) {
  return (Array.isArray(list) ? list : []).map(function (p, i) {
    var nm = String(p && p.name || '').trim() || ('Участник ' + (i + 1));
    return {
      id: String(p && p.id != null ? p.id : 'p' + i), name: nm,
      ava: (p && p.ava) || okcFirstLetter(nm),
      role: (p && p.role) || '', mic: !!(p && p.mic), cam: !!(p && p.cam),
      hand: !!(p && p.hand), muted: !!(p && p.muted), self: false
    };
  });
}
function okcSelfPart() {
  var me = 'Вы';
  try { if (window.PROFILE && window.PROFILE.name) me = 'Вы'; } catch (e) {}
  return {
    id: 'me', name: me, ava: 'Я', role: S && S.isAdmin ? 'host' : '',
    mic: !!(S && S.mic), cam: !!(S && S.cam), hand: !!(S && S.hand), muted: false, self: true
  };
}

function okcStartConf(chatId, opts) {
  opts = opts || {};
  okcBuild();
  /* Чат ищем в CHATS; если вызывающий уже держит объект чата (openConv,
     каналы), можно передать его в opts.chat — права всё равно считаются
     по нему же, обойти проверку этим нельзя. */
  var chat = okcChatById(chatId) ||
    (opts.chat && typeof opts.chat === 'object' ? opts.chat : null);
  var name = opts.chatName || (chat && chat.name) || 'Созвон';

  /* Единственная проверка права — здесь. Обходных путей нет: аргумент admin
     из старого API игнорируется, «вход по ссылке» тоже проходит через неё. */
  if (!okcCanHostConf(chat)) {
    okcToast('Созвон здесь может начать только создатель чата или владелец приложения.');
    return;
  }
  if (S && S.mode === 'personal') okcEnd('replaced', true);
  if (S) okcEnd('replaced', true);

  S = {
    mode: 'conf', dir: 'out', phase: 'connecting', id: chatId, name: name,
    ava: okcFirstLetter(name), isAdmin: okcCanHostConf(chat),
    video: false, mic: true, cam: false, spk: true, share: false, hand: false,
    facing: 'user', sec: 0, startedAt: 0, parts: [], policy: okcPolicy(chatId)
  };
  S.parts = [okcSelfPart()];

  $('okc-title').textContent = name;
  $('okc-sub').innerHTML = '<i class="okc-live"></i><span id="okc-cnt">1</span> в звонке<span class="okc-sep"></span><span id="okc-clock">00:00</span>';
  $('okc-gear').hidden = !S.isAdmin;
  okcSetNote(null);
  okcSetChip(null);

  okcOpenScreen('conf');
  okcSetStatus('');
  okcRenderStage();
  okcRenderBar();
  okcConnect();
}

/* политика созвона (кому можно микрофон/камеру/показ/чат) — персист локально */
var POL_LS = 'oko-calls-policy-v2';
function okcPolicyAll() { try { return JSON.parse(localStorage.getItem(POL_LS)) || {}; } catch (e) { return {}; } }
function okcPolicy(chatId) {
  var p = okcPolicyAll()[String(chatId)] || {};
  return { mic: p.mic !== 0, cam: p.cam !== 0, share: p.share !== 0, chat: p.chat !== 0 };
}
function okcPolicySet(chatId, key, val) {
  var all = okcPolicyAll();
  var p = all[String(chatId)] = all[String(chatId)] || {};
  p[key] = val ? 1 : 0;
  try { localStorage.setItem(POL_LS, JSON.stringify(all)); } catch (e) {}
}

function okcRenderStage() {
  var stage = $('okc-stage');
  if (!stage || !S || S.mode !== 'conf') return;

  /* моё состояние всегда синхронно с реальными дорожками */
  var me = S.parts.find(function (p) { return p.self; });
  if (me) { me.mic = !!S.mic; me.cam = !!S.cam; me.hand = !!S.hand; me.role = S.isAdmin ? 'host' : ''; }

  var tiles = S.parts.map(function (p) {
    var flags = [];
    if (!p.mic || p.muted) flags.push('<i class="mut" title="Микрофон выключен">' + ICON('mic-off') + '</i>');
    if (!p.cam) flags.push('<i title="Камера выключена">' + ICON('cam-off') + '</i>');
    if (p.hand) flags.push('<i class="hand" title="Просит слово">' + ICON('hand') + '</i>');
    var role = p.role === 'host' ? ICON('crown') : (p.role === 'co' ? ICON('shield') : '');
    var showSelfVideo = p.self && S.cam && stream && stream.getVideoTracks().some(function (t) { return t.enabled; });
    return '<div class="okc-tile' + (p.self ? ' self' : '') + '" data-okc-p="' + okcEsc(p.id) + '" tabindex="0" role="button"' +
      ' aria-label="' + okcEsc(p.name) + (p.self ? ', это вы' : '') + '">' +
      (showSelfVideo ? '<video id="okc-tile-self" playsinline autoplay muted></video>' :
        '<div class="okc-tile-ava">' + okcEsc(p.ava || '?') + '</div>') +
      '<div class="okc-tile-nm">' + role + '<span>' + okcEsc(p.name) + '</span></div>' +
      (flags.length ? '<div class="okc-tile-fl">' + flags.join('') + '</div>' : '') +
      '</div>';
  });

  if (S.share && displayStream) {
    tiles.unshift('<div class="okc-tile share" data-okc-p="share" aria-label="Ваш экран">' +
      '<video id="okc-tile-share" playsinline autoplay muted></video>' +
      '<div class="okc-tile-nm">' + ICON('share') + '<span>Ваш экран</span></div></div>');
  }

  /* Честный блок в сетке. В режиме созвона экран .okc-pers скрыт, поэтому
     объяснение и ошибки устройств показываем прямо здесь. */
  if (S.err) {
    tiles.push('<div class="okc-empty"><b>' + okcEsc(S.err.title) + '</b>' + okcEsc(S.err.text) +
      '<div class="okc-note-acts"><button type="button" class="okc-mini pri" data-okc-stage="retry">' +
      ICON('refresh') + '<span>Повторить</span></button></div></div>');
  } else if (S.parts.length <= 1) {
    tiles.push('<div class="okc-empty"><b>Пока в созвоне только вы</b>' +
      'Комната открыта, но пригласить в неё некого: сервер связи (WebRTC-сигналинг) не подключён, ' +
      'и вход по ссылке ещё не работает. Сетка участников, счётчик, права и модерация уже готовы — ' +
      'они наполнятся, как только появится сигналинг.' +
      '<div class="okc-note-acts">' +
      '<button type="button" class="okc-mini pri" data-okc-stage="what">' + ICON('info') + '<span>Что нужно для звонков</span></button>' +
      '<button type="button" class="okc-mini" data-okc-stage="copy">' + ICON('link') + '<span>Скопировать ссылку</span></button>' +
      '</div></div>');
  }

  stage.innerHTML = tiles.join('');

  var sv = $('okc-tile-self');
  if (sv && stream) { try { sv.srcObject = stream; sv.play && sv.play().catch(function () {}); } catch (e) {} }
  var dv = $('okc-tile-share');
  if (dv && displayStream) { try { dv.srcObject = displayStream; dv.play && dv.play().catch(function () {}); } catch (e) {} }

  var cnt = $('okc-cnt'); if (cnt) cnt.textContent = String(S.parts.length);
}

/* ---------- панель участников ---------- */
function okcSideOpen() { var s = $('okc-side'); if (!s) return; okcSideRender(); s.classList.add('on'); s.setAttribute('aria-hidden', 'false'); $('okc-scrim').classList.add('on'); }
function okcSideClose() { var s = $('okc-side'); if (!s) return; s.classList.remove('on'); s.setAttribute('aria-hidden', 'true'); okcScrimSync(); }
function okcSideRender() {
  var body = $('okc-side-body'); if (!body || !S || S.mode !== 'conf') return;
  var rows = S.parts.map(function (p) {
    var sub = p.self ? (S.isAdmin ? 'вы · ведущий' : 'вы') : (p.role === 'host' ? 'ведущий' : (p.role === 'co' ? 'модератор' : 'в созвоне'));
    return '<button type="button" class="okc-row" data-okc-p="' + okcEsc(p.id) + '" aria-label="Меню участника ' + okcEsc(p.name) + '">' +
      '<span class="okc-pa">' + okcEsc(p.ava || '?') + '</span>' +
      '<span class="okc-pb"><b>' + okcEsc(p.name) + '</b><small>' + okcEsc(sub) + (p.hand ? ' · просит слово' : '') + '</small></span>' +
      '<span class="okc-pf"><i class="' + (p.mic && !p.muted ? '' : 'mut') + '">' + ICON(p.mic && !p.muted ? 'mic' : 'mic-off') + '</i>' +
      '<i>' + ICON(p.cam ? 'cam' : 'cam-off') + '</i></span></button>';
  }).join('');
  var hint = S.parts.length <= 1
    ? '<div class="okc-hint"><b>Модерировать пока некого</b>Замьютить, опустить руку и исключить участника можно будет, когда в созвон войдут люди. Права уже проверяются: эти команды видит только ' + (S.isAdmin ? 'вы как ведущий' : 'ведущий созвона') + '.</div>'
    : '';
  var invite = '<div class="okc-hint"><b>Ссылка-приглашение</b>Ссылку можно скопировать уже сейчас, но вход по ней заработает вместе с сервером связи.' +
    '<div class="okc-note-acts"><button type="button" class="okc-mini pri" id="okc-copy">' + ICON('link') + '<span>Скопировать ссылку</span></button></div></div>';
  body.innerHTML = rows + hint + invite;
}
function okcInviteLink() {
  var base = location.origin + location.pathname;
  return base + '?call=' + encodeURIComponent(String(S && S.id || ''));
}
function okcCopyInvite() {
  var link = okcInviteLink();
  var done = function () { okcToast('Ссылка скопирована. Войти по ней можно будет после подключения сервера связи.'); };
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(link).then(done).catch(function () { okcSheetLink(link); });
  } else okcSheetLink(link);
}
function okcSheetLink(link) {
  okcSheet('Ссылка-приглашение', '<div class="okc-hint"><b>Скопируйте вручную</b>Буфер обмена браузер не отдал.' +
    '<p class="oko-breakable" style="word-break:break-all;margin:8px 0 0">' + okcEsc(link) + '</p></div>');
}

/* ---------- меню по участнику (модерация только у ведущего) ---------- */
var menuActs = {};
function okcMenuOpen(pid, x, y) {
  if (!S || S.mode !== 'conf') return;
  var p = S.parts.find(function (q) { return String(q.id) === String(pid); });
  if (!p) return;
  var menu = $('okc-menu'); if (!menu) return;
  menuActs = {};
  var h = ['<div class="okc-menu-hd">' + okcEsc(p.name) + '</div>'];

  if (p.self) {
    menuActs.hand = okcToggleHand;
    h.push('<button type="button" class="okc-mi" data-okc-m="hand">' + ICON('hand') +
      '<span>' + (S.hand ? 'Опустить руку' : 'Поднять руку') + '</span></button>');
  } else if (S.isAdmin) {
    menuActs.mute = function () { p.muted = !p.muted; p.mic = !p.muted; okcMenuClose(); okcRenderStage(); okcSideRender(); };
    menuActs.kick = function () {
      S.parts = S.parts.filter(function (q) { return q.id !== p.id; });
      okcMenuClose(); okcRenderStage(); okcSideRender(); okcRenderBar();
    };
    h.push('<button type="button" class="okc-mi" data-okc-m="mute">' + ICON(p.muted ? 'mic' : 'mic-off') +
      '<span>' + (p.muted ? 'Вернуть микрофон' : 'Выключить микрофон') + '</span></button>');
    h.push('<button type="button" class="okc-mi danger" data-okc-m="kick">' + ICON('x') + '<span>Исключить из созвона</span></button>');
  } else {
    h.push('<div class="okc-menu-hd" style="text-transform:none;font-weight:400">Модерация доступна только ведущему созвона.</div>');
  }

  menu.innerHTML = h.join('');
  menu.classList.add('on');
  menu.setAttribute('aria-hidden', 'false');
  var r = menu.getBoundingClientRect();
  var vw = window.innerWidth, vh = window.innerHeight;
  menu.style.left = Math.max(8, Math.min(x, vw - r.width - 8)) + 'px';
  menu.style.top = Math.max(8, Math.min(y, vh - r.height - 8)) + 'px';
  setTimeout(function () { document.addEventListener('pointerdown', okcMenuOutside, true); }, 0);
}
function okcMenuOutside(e) {
  var menu = $('okc-menu');
  if (menu && menu.contains(e.target)) return;
  okcMenuClose();
}
function okcMenuClose() {
  var menu = $('okc-menu'); if (!menu) return;
  menu.classList.remove('on'); menu.setAttribute('aria-hidden', 'true');
  document.removeEventListener('pointerdown', okcMenuOutside, true);
}

/* ---------- шторка ---------- */
function okcSheet(title, html) {
  okcBuild();
  $('okc-sheet-ttl').textContent = title;
  $('okc-sheet-body').innerHTML = html;
  var sh = $('okc-sheet');
  sh.classList.add('on'); sh.setAttribute('aria-hidden', 'false');
  $('okc-scrim').classList.add('on');
}
function okcSheetClose() {
  var sh = $('okc-sheet'); if (!sh) return;
  sh.classList.remove('on'); sh.setAttribute('aria-hidden', 'true');
  okcScrimSync();
}
function okcScrimSync() {
  var open = ($('okc-sheet') && $('okc-sheet').classList.contains('on')) ||
             ($('okc-side') && $('okc-side').classList.contains('on'));
  $('okc-scrim').classList.toggle('on', !!open);
}
function okcConfSettings() {
  if (!S || S.mode !== 'conf' || !S.isAdmin) { okcToast('Настройки созвона доступны только ведущему.'); return; }
  var p = S.policy;
  var row = function (k, t, s) {
    return '<button type="button" class="okc-tg" data-okc-pol="' + k + '" role="switch" aria-checked="' + (p[k] ? 'true' : 'false') + '">' +
      '<span><b>' + t + '</b><small>' + s + '</small></span>' +
      '<span class="okc-sw' + (p[k] ? ' on' : '') + '"><i></i></span></button>';
  };
  okcSheet('Правила созвона', [
    '<div class="okc-hint">Правила сохраняются на этом устройстве и применятся к участникам, как только они смогут войти.</div>',
    row('mic', 'Микрофон всем', 'Иначе говорить смогут только ведущий и модераторы'),
    row('cam', 'Камера всем', 'Участники смогут включать видео'),
    row('share', 'Показ экрана всем', 'Иначе экран показывает только ведущий'),
    row('chat', 'Чат внутри созвона', 'Иначе писать сможет только ведущий')
  ].join(''));
}
function okcConfChat() {
  if (!S) return;
  if (!S.isAdmin && !S.policy.chat) { okcToast('Чат созвона выключен ведущим.'); return; }
  okcSheet('Чат созвона', '<div class="okc-hint"><b>Отдельного чата созвона ещё нет</b>' +
    'Он появится вместе с сервером связи — тогда сообщения будут жить внутри комнаты. ' +
    'Пока сверните звонок кнопкой «Свернуть»: обычный чат остаётся открытым, плашка звонка держит таймер и возвращает обратно одним касанием.</div>');
}

/* ================================================== ТАЙМЕР */
function okcTickStart() {
  clearInterval(tickTimer);
  okcTick();
  tickTimer = setInterval(okcTick, 1000);
}
function okcTick() {
  if (!S) { clearInterval(tickTimer); tickTimer = null; return; }
  if (S.startedAt) S.sec = Math.max(0, Math.floor((Date.now() - S.startedAt) / 1000));
  var t = okcTime(S.sec);
  var real = S.phase === 'connected';
  var clock = $('okc-clock'); if (clock) clock.textContent = t;
  if (S.mode === 'personal') {
    if (real) okcSetStatus(t);
    else okcSetChip('Проверка себя · ' + t);
  } else if (!real) {
    okcSetChip(null);
  }
  var pt = $('okc-pill-tm');
  if (pt) pt.textContent = (real ? '' : 'проверка · ') + t;
}

/* ================================================== СВЕРНУТЬ / ВЕРНУТЬ */
function okcMinimize() {
  if (!S) return;
  var scr = $('okc-screen');
  scr.classList.remove('on');
  scr.setAttribute('aria-hidden', 'true');
  document.documentElement.classList.remove('okc-lock');
  okcSideClose(); okcSheetClose(); okcMenuClose();
  okcPillShow();
  okcNavPop();
}
function okcRestore() {
  if (!S) return;
  var scr = $('okc-screen');
  scr.classList.add('on');
  scr.setAttribute('aria-hidden', 'false');
  document.documentElement.classList.add('okc-lock');
  okcPillHide();
  okcNavPush();
  requestAnimationFrame(okcMeasure);
}
function okcPillShow() {
  okcMeasure();
  var pill = $('okc-pill'); if (!pill) return;
  $('okc-pill-nm').textContent = S ? S.name : 'Звонок';
  okcTick();
  pill.hidden = false;
  pill.classList.add('on');
  pill.setAttribute('aria-hidden', 'false');
}
function okcPillHide() {
  var pill = $('okc-pill'); if (!pill) return;
  pill.classList.remove('on');
  pill.hidden = true;
  pill.setAttribute('aria-hidden', 'true');
}

/* ================================================== ЗАВЕРШЕНИЕ */
function okcEnd(reason, silent) {
  if (!S) return;
  var was = S;
  clearInterval(tickTimer); tickTimer = null;
  var tr = okcTransport();
  if (tr && typeof tr.hangup === 'function') { try { tr.hangup(was); } catch (e) {} }
  okcStopStream();
  S = null;

  var scr = $('okc-screen');
  if (scr) {
    scr.classList.remove('on', 'm-pers', 'm-conf', 'm-in', 'ringing', 'connected');
    scr.setAttribute('aria-hidden', 'true');
  }
  document.documentElement.classList.remove('okc-lock');
  okcSideClose(); okcSheetClose(); okcMenuClose();
  okcPillHide();
  okcNavPop();

  if (silent) return;

  /* Системную запись в чат оставляем ТОЛЬКО за настоящий разговор.
     Записать «звонок 00:12», когда соединения не было, — ложь в ленте. */
  if (was.phase === 'connected' && was.mode === 'personal' && was.sec > 0) {
    try {
      if (window.currentChat && typeof window.pushMsg === 'function') {
        window.pushMsg({ in: 0, t: (typeof window.nowT === 'function' ? window.nowT() : ''), kind: 'sys',
          body: (was.video ? 'Видеозвонок' : 'Аудиозвонок') + ' · ' + okcTime(was.sec) });
      }
    } catch (e) {}
  }
  if (reason === 'declined') okcToast('Звонок отклонён.');
}

/* ================================================== СОБЫТИЯ */
function okcWire() {
  var scr = $('okc-screen');

  $('okc-min').addEventListener('click', okcMinimize);
  $('okc-gear').addEventListener('click', okcConfSettings);
  $('okc-side-x').addEventListener('click', okcSideClose);
  $('okc-sheet-x').addEventListener('click', okcSheetClose);
  $('okc-scrim').addEventListener('click', function () { okcSideClose(); okcSheetClose(); });
  $('okc-pill').addEventListener('click', okcRestore);

  /* нижняя панель */
  $('okc-bar').addEventListener('click', function (e) {
    var b = e.target.closest && e.target.closest('[data-okc-b]');
    if (!b || b.hasAttribute('disabled')) return;
    var fn = barActs[b.getAttribute('data-okc-b')];
    if (typeof fn === 'function') fn();
  });

  /* кнопки внутри честной карточки */
  $('okc-note').addEventListener('click', function (e) {
    var b = e.target.closest && e.target.closest('[data-okc-act]');
    if (!b) return;
    var fn = noteActs[Number(b.getAttribute('data-okc-act'))];
    if (typeof fn === 'function') fn();
  });

  /* плитки участников → меню */
  $('okc-stage').addEventListener('click', function (e) {
    var act = e.target.closest && e.target.closest('[data-okc-stage]');
    if (act) {
      var a = act.getAttribute('data-okc-stage');
      if (a === 'what') okcOpenWhat();
      else if (a === 'copy') okcCopyInvite();
      else if (a === 'retry') okcRetryMedia();
      return;
    }
    var t = e.target.closest && e.target.closest('[data-okc-p]');
    if (!t || t.getAttribute('data-okc-p') === 'share') return;
    var r = t.getBoundingClientRect();
    okcMenuOpen(t.getAttribute('data-okc-p'), r.left + 12, r.top + 12);
  });
  $('okc-stage').addEventListener('keydown', function (e) {
    if (e.key !== 'Enter' && e.key !== ' ') return;
    var t = e.target.closest && e.target.closest('[data-okc-p]');
    if (!t) return;
    e.preventDefault();
    var r = t.getBoundingClientRect();
    okcMenuOpen(t.getAttribute('data-okc-p'), r.left + 12, r.top + 12);
  });

  /* строки в панели участников + копирование ссылки */
  $('okc-side-body').addEventListener('click', function (e) {
    if (e.target.closest && e.target.closest('#okc-copy')) { okcCopyInvite(); return; }
    var row = e.target.closest && e.target.closest('[data-okc-p]');
    if (!row) return;
    var r = row.getBoundingClientRect();
    okcMenuOpen(row.getAttribute('data-okc-p'), Math.max(8, r.left - 40), r.top);
  });

  /* меню */
  $('okc-menu').addEventListener('click', function (e) {
    var b = e.target.closest && e.target.closest('[data-okc-m]');
    if (!b) return;
    var fn = menuActs[b.getAttribute('data-okc-m')];
    if (typeof fn === 'function') fn();
  });

  /* переключатели правил созвона */
  $('okc-sheet-body').addEventListener('click', function (e) {
    var b = e.target.closest && e.target.closest('[data-okc-pol]');
    if (!b || !S || !S.isAdmin) return;
    var k = b.getAttribute('data-okc-pol');
    S.policy[k] = !S.policy[k];
    okcPolicySet(S.id, k, S.policy[k]);
    okcConfSettings();
  });

  /* Escape: сперва закрываем верхний слой, потом сворачиваем звонок.
     Входящий звонок Escape отклоняет — иначе он остался бы висеть. */
  document.addEventListener('keydown', function (e) {
    if (e.key !== 'Escape' || !S) return;
    if (!scr.classList.contains('on')) return;
    if ($('okc-menu').classList.contains('on')) { okcMenuClose(); e.stopPropagation(); return; }
    if ($('okc-sheet').classList.contains('on')) { okcSheetClose(); e.stopPropagation(); return; }
    if ($('okc-side').classList.contains('on')) { okcSideClose(); e.stopPropagation(); return; }
    if (S.phase === 'ringing') { okcEnd('declined'); e.stopPropagation(); return; }
    okcMinimize();
    e.stopPropagation();
  }, true);

  /* Уход со страницы — глушим устройства, не оставляем горящую камеру. */
  window.addEventListener('pagehide', function () { if (S) okcEnd('pagehide', true); });
  window.addEventListener('beforeunload', function () { okcStopStream(); });

  /* Блокировка экрана / сворачивание приложения. Камеру ставим на паузу,
     таймер продолжает идти по часам, а не по тикам. Возврат — честная плашка. */
  document.addEventListener('visibilitychange', function () {
    if (!S) return;
    if (document.hidden) {
      if (stream) {
        var vt = stream.getVideoTracks().filter(function (t) { return t.enabled; });
        if (vt.length) { camPausedByHide = true; vt.forEach(function (t) { t.enabled = false; }); }
      }
      if (meter && meter.ctx && meter.ctx.state === 'running') { try { meter.ctx.suspend(); } catch (e) {} }
    } else {
      if (camPausedByHide && stream && S.cam) {
        stream.getVideoTracks().forEach(function (t) { t.enabled = true; });
        okcToast('Камера снова включена — она была на паузе, пока приложение было свёрнуто.');
      }
      camPausedByHide = false;
      if (meter && meter.ctx && meter.ctx.state === 'suspended') { try { meter.ctx.resume(); } catch (e) {} }
      okcTick(); okcMeasure();
    }
  });

  window.addEventListener('resize', okcMeasure);
  window.addEventListener('orientationchange', function () { setTimeout(okcMeasure, 240); });
  if (window.ResizeObserver) {
    try {
      var ro = new ResizeObserver(okcMeasure);
      var tabs = document.getElementById('tabs'); if (tabs) ro.observe(tabs);
      var bar = $('okc-bar'); if (bar) ro.observe(bar);
    } catch (e) {}
  }
}

/* ================================================== ГЛОБАЛЬНЫЕ ТОЧКИ ВХОДА */
function okcInstall() {
  /* Личный звонок из шапки чата. */
  window.startCall = function (video) {
    var c = (typeof window.currentChat !== 'undefined') ? window.currentChat : null;
    if (!c) { okcToast('Сначала откройте чат.'); return; }
    var kind = c.kind || 'direct';
    if (kind === 'group' || kind === 'channel' || kind === 'super') {
      if (okcCanHostConf(c)) { okcStartConf(c.id, { chatName: c.name }); return; }
      okcToast('В группах и каналах личных звонков нет, а созвон здесь начинает только создатель чата.');
      return;
    }
    if (!okcIsCallableDirect(c)) { okcToast('Сюда позвонить нельзя — это не переписка с человеком.'); return; }
    okcStartPersonal(c.id, !!video);
  };
  window.callStartPersonal = function (userId, isVideo, opts) { okcStartPersonal(userId, isVideo, opts); };
  /* admin из аргумента намеренно игнорируем: право пересчитываем сами. */
  window.callStartConf = function (chatId, admin, opts) { okcStartConf(chatId, opts || {}); };
  window.endCall = function () { okcEnd('user'); };

  /* Старый движок больше не должен просыпаться. */
  try {
    var legacy = ['cl-conf', 'cl-personal', 'cl-pill', 'callScreen', 'cpCallPill'];
    legacy.forEach(function (id) {
      var el = document.getElementById(id);
      if (el) { el.classList.remove('on', 'open'); el.setAttribute('aria-hidden', 'true'); }
    });
  } catch (e) {}
}

/* Шапка чата: снимаем кнопку созвона у того, кому созвон не положен.
   Ядро уже проверяет права, это второй рубеж — на случай гонки слоёв. */
function okcAuditConvHead() {
  var head = document.querySelector('#convBody .conv-head');
  if (!head) return;
  var c = (typeof window.currentChat !== 'undefined') ? window.currentChat : null;
  var allowed = okcCanHostConf(c);

  head.querySelectorAll('.cl-conv-start, .cp-call-host').forEach(function (b) {
    if (!allowed) { b.remove(); return; }
    /* Старая кнопка вела в попап ядра с обещаниями «до 20 участников» и
       «запись на PRO». Обещать нечего, пока нет сервера: ведём прямо в созвон. */
    b.onclick = function () { okcStartConf(c && c.id, { chatName: c && c.name }); };
  });
  /* Две одинаковые кнопки созвона съедают ширину шапки — оставляем одну. */
  var all = head.querySelectorAll('.cl-conv-start, .cp-call-host');
  for (var i = 1; i < all.length; i++) all[i].remove();
}
function okcHookConv() {
  if (typeof window.openConv === 'function' && !window.openConv._okc) {
    var prev = window.openConv;
    window.openConv = function () { var r = prev.apply(this, arguments); try { setTimeout(okcAuditConvHead, 0); okcMeasure(); } catch (e) {} return r; };
    window.openConv._okc = true;
  }
  if (typeof window.closeConv === 'function' && !window.closeConv._okc) {
    var prevC = window.closeConv;
    window.closeConv = function () { var r = prevC.apply(this, arguments); try { okcMeasure(); } catch (e) {} return r; };
    window.closeConv._okc = true;
  }
}

/* Вход по ссылке ?call=... — честно объясняем, что вход ещё не работает. */
function okcCheckInviteParam() {
  var m = /[?&]call=([^&]+)/.exec(location.search);
  if (!m) return;
  okcBuild();
  var id = decodeURIComponent(m[1]);
  var chat = okcChatById(id);
  var body = 'Ссылка ведёт в созвон' + (chat ? ' «' + okcEsc(chat.name) + '»' : '') +
    ', но войти по ней пока нельзя: комнату держать некому — сервер связи (WebRTC-сигналинг) ещё не подключён. ' +
    'Как только он появится, эта же ссылка будет открывать созвон сразу.';
  /* Шторка живёт внутри экрана звонка, а он сейчас закрыт — показываем
     объяснение через попап ядра, иначе человек ничего не увидит. */
  if (typeof window.showPopup === 'function') {
    try { window.showPopup({ ico: 'phone', title: 'Приглашение в созвон', body: body, actions: [{ label: 'Понятно' }] }); return; }
    catch (e) {}
  }
  okcToast('Войти в созвон по ссылке пока нельзя: сервер связи не подключён.');
}

/* ================================================== ПУБЛИЧНЫЙ API */
window.okoCalls = {
  personal: function (userId, isVideo, opts) { okcStartPersonal(userId, isVideo, opts); },
  conference: function (chatId, opts) { okcStartConf(chatId, opts || {}); },
  /* Входящий звонок показывает только настоящий сигнальный сервер. */
  incoming: okcIncoming,
  end: function () { okcEnd('api'); },
  minimize: okcMinimize,
  restore: okcRestore,
  canHost: function (chat) { return okcCanHostConf(chat || (typeof window.currentChat !== 'undefined' ? window.currentChat : null)); },
  state: function () {
    if (!S) return { active: false, hasTransport: !!okcTransport() };
    return { active: true, mode: S.mode, dir: S.dir, phase: S.phase, sec: S.sec,
             mic: !!S.mic, cam: !!S.cam, share: !!S.share, hand: !!S.hand,
             participants: S.parts.length, hasTransport: !!okcTransport() };
  }
};

/* ================================================== ЗАПУСК */
function okcBoot() {
  okcBuild();
  okcInstall();
  okcHookConv();
  okcAuditConvHead();
  okcMeasure();
}
okcStyles();
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', okcBoot);
else okcBoot();
/* Ядро перепатчивает startCall на DOMContentLoaded и на своих таймерах —
   возвращаем свои точки входа несколько раз, последнее слово за этим слоем. */
window.addEventListener('load', function () { okcBoot(); okcCheckInviteParam(); });
[0, 400, 1500, 3000].forEach(function (d) { setTimeout(function () { try { okcInstall(); okcHookConv(); } catch (e) {} }, d); });

})();
