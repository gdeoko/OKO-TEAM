/* ============================================================================
   OKO — ЗАПИСЬ ГОЛОСОВЫХ И ВИДЕОКРУЖКОВ (слой полировки, грузится после ядра)

   Правка Даниэля 09.08, дословно:
     «я всё ещё не понятно и не удобно как остановить и отправить запись
      голосового и видео кружка, там снизу тень и пропадает кнопка отправки —
      и если нажал запись то можно всем приложением тыкать пользоваться а
      запись остановить не возможно оно как глюк по верх всех вкладок с тенью
      и видео кружок тоже.»

   Что было сломано (нашёл в коде, а не на глаз):
     1. ДВЕ конкурирующие записи-шторки. Ядро рисовало таймер прямо в композере,
        а модуль chats-plus сверху вешал `#cpRec` — полупрозрачный градиент на
        весь низ экрана с `pointer-events:none`. Это и есть «тень снизу»:
        кнопка отправки оказывалась ПОД затемнением и переставала читаться.
     2. `#cpRec` жил в `document.body`, поэтому переживал переключение вкладок:
        уходишь в ленту — запись висит поверх всего приложения.
     3. Остановить было нечем. Кнопка «отправить» в `#cpRec` показывалась
        ТОЛЬКО после свайпа вверх (`.cp-rec-locked`), а про свайп никто не знал.
     4. Худшее: пока запись «закреплена», chats-plus вешал глобальный
        `document.addEventListener('pointerup', e => e.stopImmediatePropagation(), true)`.
        Это глушило pointerup во ВСЁМ приложении — отсюда ощущение
        «тыкать можно, а толку ноль».

   Как сделано теперь (одна шторка, ноль догадок):
     • Тап по микрофону — запись стартует СРАЗУ и держать палец не нужно.
     • Открывается модальная панель поверх всего: живая волна (или круглое
       превью камеры), таймер, лимит тарифа и две большие подписанные кнопки —
       «Отменить» и «Отправить». Никакой тени поверх них: панель сама сверху.
     • Фон закрыт скримом — случайные тапы по приложению во время записи
       не проходят, вкладки не переключаются. Выход всегда есть: Escape,
       системная «назад» и кнопка «Отменить».
     • Классика тоже жива: удержание микрофона пишет, отпускание отправляет,
       смахивание влево отменяет.
     • Режим (голосовое / кружок) переключается чипами прямо в панели и
       запоминается между сессиями.
     • Сторож: если запись оборвалась снаружи (отказ в доступе, ошибка,
       лимит) — панель закрывается сама. Зависнуть она не может.
   ============================================================================ */
(function(){
  'use strict';
  if(window.__okoRecV1) return;
  window.__okoRecV1 = 1;

  var BARS = 32;
  var MODE_KEY = 'oko-rec-mode';

  var panel = null, scrim = null, wrap = null;
  var vidEl = null, waveEl = null, timeEl = null, hintEl = null, limitEl = null;
  var open = false, held = false, sending = false;
  var tickInt = null, watchInt = null, pvInt = null;
  var ac = null, analyser = null, srcNode = null, rafId = null, dataArr = null;

  /* ---------- вспомогательное ---------- */
  function svg(id, cls){
    return '<svg class="i' + (cls ? ' ' + cls : '') + '" aria-hidden="true"><use href="#' + id + '"/></svg>';
  }
  function recording(){
    /* recStart / recArmed объявлены через let в инлайн-скрипте ядра:
       на window их нет, но лексически из этого файла они видны. */
    try{ return recStart !== null || recArmed === true; }catch(e){ return false; }
  }
  function mode(){
    try{ return recMode === 'vnote' ? 'vnote' : 'voice'; }catch(e){ return 'voice'; }
  }
  function setMode(m){
    try{ recMode = m; }catch(e){}
    try{ localStorage.setItem(MODE_KEY, m); }catch(e){}
    try{ if(typeof syncComposer === 'function') syncComposer(); }catch(e){}
  }
  function haptic(k){ if(window.okoHaptic) try{ window.okoHaptic(k); }catch(e){} }

  /* ---------- 1. Глушим старую шторку chats-plus ----------
     Функции ядра объявлены как function-declaration -> они свойства window,
     поэтому подменяются снаружи. cpRecLocked после этого навсегда false,
     и глобальный перехватчик pointerup больше никогда не срабатывает. */
  function killLegacy(){
    var noop = function(){};
    ['cpRecShow','cpRecHide','cpRecLock','cpRecSendLocked','cpRecWaveStart','cpRecWaveStop'].forEach(function(n){
      try{ if(typeof window[n] === 'function') window[n] = noop; }catch(e){}
    });
    /* cpCancelRec оставляем рабочим — на него завязаны другие кнопки,
       но приводим к нашему честному пути отмены. */
    try{ window.cpCancelRec = function(){ cancel(); }; }catch(e){}
    var old = document.getElementById('cpRec');
    if(old) old.remove();
  }

  /* ---------- 2. Разметка панели ---------- */
  function build(){
    if(wrap) return wrap;
    wrap = document.createElement('div');
    wrap.className = 'okorec';
    wrap.id = 'okoRec';
    wrap.setAttribute('aria-hidden', 'true');
    wrap.innerHTML =
      '<div class="okorec-scrim" id="okoRecScrim"></div>' +
      '<div class="okorec-panel" role="dialog" aria-modal="true" aria-label="Запись сообщения">' +
        '<div class="okorec-modes" id="okoRecModes">' +
          '<button type="button" class="okorec-mode" data-m="voice">' + svg('i-mic') + '<span>Голосовое</span></button>' +
          '<button type="button" class="okorec-mode" data-m="vnote">' + svg('i-video-note') + '<span>Кружок</span></button>' +
        '</div>' +
        '<div class="okorec-stage">' +
          '<div class="okorec-round"><video id="okoRecVid" playsinline muted></video></div>' +
          '<div class="okorec-wave" id="okoRecWave">' + new Array(BARS + 1).join('<i></i>') + '</div>' +
        '</div>' +
        '<div class="okorec-meter">' +
          '<span class="okorec-dot"></span>' +
          '<span class="okorec-time" id="okoRecTime">0:00</span>' +
          '<span class="okorec-limit" id="okoRecLimit"></span>' +
        '</div>' +
        '<div class="okorec-hint" id="okoRecHint">Идёт запись. Нажми «Отправить», когда закончишь.</div>' +
        '<div class="okorec-actions">' +
          '<button type="button" class="okorec-btn okorec-cancel" id="okoRecCancel">' + svg('i-trash') + '<span>Отменить</span></button>' +
          '<button type="button" class="okorec-btn okorec-send" id="okoRecSend">' + svg('i-send', 'fill') + '<span>Отправить</span></button>' +
        '</div>' +
      '</div>';
    document.body.appendChild(wrap);

    scrim  = wrap.querySelector('#okoRecScrim');
    panel  = wrap.querySelector('.okorec-panel');
    vidEl  = wrap.querySelector('#okoRecVid');
    waveEl = wrap.querySelector('#okoRecWave');
    timeEl = wrap.querySelector('#okoRecTime');
    hintEl = wrap.querySelector('#okoRecHint');
    limitEl= wrap.querySelector('#okoRecLimit');

    wrap.querySelector('#okoRecCancel').addEventListener('click', function(e){ e.preventDefault(); cancel(); });
    wrap.querySelector('#okoRecSend').addEventListener('click', function(e){ e.preventDefault(); send(); });

    /* Тап по фону во время записи ничего не ломает, но и не молчит:
       подсказываем, что делать (правило «никаких тупиков»). */
    scrim.addEventListener('click', function(){
      panel.classList.remove('nudge'); void panel.offsetWidth; panel.classList.add('nudge');
      setHint('Запись идёт. «Отправить» — отправит, «Отменить» — сотрёт.');
    });

    wrap.querySelector('#okoRecModes').addEventListener('click', function(e){
      var b = e.target.closest('.okorec-mode');
      if(!b) return;
      var m = b.getAttribute('data-m');
      if(m === mode()) return;
      switchMode(m);
    });
    return wrap;
  }

  function setHint(t){ if(hintEl) hintEl.textContent = t; }

  function paintModes(){
    if(!wrap) return;
    var m = mode();
    wrap.querySelectorAll('.okorec-mode').forEach(function(b){
      b.classList.toggle('on', b.getAttribute('data-m') === m);
    });
    wrap.classList.toggle('is-vnote', m === 'vnote');
  }

  /* Переключение режима на лету: аккуратно гасим текущую запись и стартуем
     новую. Обрывок не отправляем — человек явно передумал. */
  function switchMode(m){
    var wasOpen = open;
    silentStop();
    setMode(m);
    paintModes();
    if(wasOpen){
      held = false;
      setTimeout(function(){ try{ startRec(); }catch(e){} }, 60);
      setHint(m === 'vnote' ? 'Кружок записывается. Смотри в камеру.' : 'Идёт запись. Нажми «Отправить», когда закончишь.');
    }
  }

  /* ---------- 3. Волна и превью ---------- */
  function waveStart(stream){
    waveStop();
    if(!stream || !window.AudioContext && !window.webkitAudioContext) return;
    try{
      ac = new (window.AudioContext || window.webkitAudioContext)();
      srcNode = ac.createMediaStreamSource(stream);
      analyser = ac.createAnalyser();
      analyser.fftSize = 128;
      analyser.smoothingTimeConstant = .72;
      srcNode.connect(analyser);
      dataArr = new Uint8Array(analyser.frequencyBinCount);
      waveEl && waveEl.classList.add('live');
      var bars = waveEl ? waveEl.querySelectorAll('i') : [];
      var loop = function(){
        if(!analyser) return;
        analyser.getByteFrequencyData(dataArr);
        for(var i = 0; i < bars.length; i++){
          var idx = Math.floor(i / bars.length * (dataArr.length * .7));
          var v = dataArr[idx] / 255;
          bars[i].style.transform = 'scaleY(' + Math.max(.10, Math.min(1, v * 1.7)).toFixed(3) + ')';
        }
        rafId = requestAnimationFrame(loop);
      };
      loop();
    }catch(e){ waveStop(); }
  }
  function waveStop(){
    if(rafId){ cancelAnimationFrame(rafId); rafId = null; }
    try{ srcNode && srcNode.disconnect(); }catch(e){}
    try{ analyser && analyser.disconnect(); }catch(e){}
    try{ ac && ac.state !== 'closed' && ac.close(); }catch(e){}
    ac = analyser = srcNode = dataArr = null;
    if(waveEl){
      waveEl.classList.remove('live');
      waveEl.querySelectorAll('i').forEach(function(b){ b.style.transform = ''; });
    }
  }

  /* recStream появляется асинхронно после getUserMedia — ждём его. */
  function attachStream(){
    clearInterval(pvInt);
    var tries = 0;
    pvInt = setInterval(function(){
      tries++;
      var s = null;
      try{ s = recStream; }catch(e){}
      if(s){
        clearInterval(pvInt); pvInt = null;
        if(mode() === 'vnote' && vidEl){
          try{ vidEl.srcObject = s; vidEl.play && vidEl.play().catch(function(){}); }catch(e){}
        } else {
          waveStart(s);
        }
      }
      if(tries > 60){ clearInterval(pvInt); pvInt = null; }
    }, 60);
  }

  /* ---------- 4. Таймер и лимит ---------- */
  function tick(){
    var st = null;
    try{ st = recStart; }catch(e){}
    if(st === null){ if(timeEl) timeEl.textContent = 'подключаем…'; return; }
    var sec = Math.floor((Date.now() - st) / 1000);
    if(timeEl) timeEl.textContent = Math.floor(sec / 60) + ':' + String(sec % 60).padStart(2, '0');
    if(limitEl){
      var lim = 0;
      try{ lim = (typeof okoLimits === 'function' && mode() === 'voice') ? (okoLimits().voiceSec || 0) : 0; }catch(e){}
      /* На платных тарифах voiceSec = 1e9, то есть «без ограничений».
         Показывать «осталось 16666666:39» — глупость, поэтому всё, что
         длиннее часа, считаем безлимитом и молчим. Обратный отсчёт
         включаем за минуту до конца, чтобы не мозолил глаза всю запись. */
      var left = (lim > 0 && lim < 3600) ? Math.max(0, lim - sec) : -1;
      if(left >= 0 && left <= 60){
        limitEl.textContent = 'осталось ' + Math.floor(left / 60) + ':' + String(left % 60).padStart(2, '0');
        limitEl.classList.toggle('warn', left <= 10);
      } else {
        limitEl.textContent = '';
        limitEl.classList.remove('warn');
      }
    }
  }

  /* ---------- 5. Открытие / закрытие ---------- */
  function show(){
    build();
    paintModes();
    open = true; sending = false;
    wrap.classList.add('on');
    wrap.setAttribute('aria-hidden', 'false');
    document.documentElement.classList.add('oko-recording');
    if(vidEl){ vidEl.srcObject = null; }
    if(timeEl) timeEl.textContent = 'подключаем…';
    setHint(held
      ? 'Отпусти — отправлю. Смахни влево — отменю.'
      : (mode() === 'vnote' ? 'Кружок записывается. Смотри в камеру.' : 'Идёт запись. Нажми «Отправить», когда закончишь.'));
    attachStream();
    clearInterval(tickInt); tickInt = setInterval(tick, 200); tick();
    /* Сторож: запись могла оборваться снаружи (отказ в доступе, ошибка
       MediaRecorder, лимит тарифа). Панель обязана закрыться сама. */
    clearInterval(watchInt);
    watchInt = setInterval(function(){
      if(!recording() && !sending) hide();
    }, 300);
  }

  function hide(){
    open = false; held = false;
    clearInterval(tickInt); tickInt = null;
    clearInterval(watchInt); watchInt = null;
    clearInterval(pvInt); pvInt = null;
    waveStop();
    if(vidEl){ try{ vidEl.pause(); }catch(e){} vidEl.srcObject = null; }
    if(wrap){
      wrap.classList.remove('on');
      wrap.setAttribute('aria-hidden', 'true');
      panel && panel.classList.remove('nudge');
    }
    document.documentElement.classList.remove('oko-recording');
  }

  /* ---------- 6. Действия ---------- */
  function send(){
    if(sending) return;
    sending = true;
    haptic('success');
    try{ if(typeof stopRec === 'function') stopRec(); }catch(e){}
    hide();
  }
  function cancel(){
    if(sending) return;
    sending = true;
    haptic('warning');
    try{ if(typeof cancelRec === 'function') cancelRec(); }catch(e){}
    hide();
  }
  /* Тихая остановка без отправки и без тоста — для смены режима. */
  function silentStop(){
    sending = true;
    try{
      if(typeof recInt !== 'undefined' && recInt){ clearInterval(recInt); recInt = null; }
    }catch(e){}
    try{
      if(typeof mediaRec !== 'undefined' && mediaRec && mediaRec.state && mediaRec.state !== 'inactive'){
        mediaRec.onstop = function(){}; mediaRec.stop();
      }
    }catch(e){}
    try{ if(typeof recStream !== 'undefined' && recStream){ recStream.getTracks().forEach(function(t){ t.stop(); }); recStream = null; } }catch(e){}
    try{ mediaRec = null; }catch(e){}
    try{ recStart = null; recArmed = false; recCancelled = true; }catch(e){}
    try{ if(typeof recUiOff === 'function') recUiOff(); }catch(e){}
    waveStop();
    clearInterval(pvInt); pvInt = null;
    sending = false;
  }

  /* ---------- 7. Перехват ядровых функций ---------- */
  function hook(){
    if(typeof window.startRec === 'function'){
      var prevStart = window.startRec;
      window.startRec = function(){
        var r = prevStart.apply(this, arguments);
        show();
        return r;
      };
    }
    if(typeof window.stopRec === 'function'){
      var prevStop = window.stopRec;
      window.stopRec = function(){
        var r = prevStop.apply(this, arguments);
        hide();
        return r;
      };
    }
    if(typeof window.cancelRec === 'function'){
      var prevCancel = window.cancelRec;
      window.cancelRec = function(){
        var r = prevCancel.apply(this, arguments);
        hide();
        return r;
      };
    }
  }

  /* ---------- 8. Кнопка микрофона: свои жесты вместо ядровых ----------
     Клонируем узел — это снимает ВСЕ слушатели ядра и chats-plus разом,
     чтобы два набора жестов не спорили друг с другом. */
  function rewireMic(){
    var old = document.getElementById('micBtn');
    if(!old || old.dataset.okorec) return;
    var mic = old.cloneNode(true);
    mic.dataset.okorec = '1';
    old.parentNode.replaceChild(mic, old);

    var HOLD_MS = 300, MOVE_TOL = 12, CANCEL_DX = 70;
    var holdT = null, holdStarted = false, sx = 0, sy = 0, pid = null;

    function clearHold(){ if(holdT){ clearTimeout(holdT); holdT = null; } }

    mic.addEventListener('pointerdown', function(e){
      if(recording()) return;
      holdStarted = false; sx = e.clientX; sy = e.clientY;
      try{ mic.setPointerCapture(e.pointerId); pid = e.pointerId; }catch(err){}
      clearHold();
      holdT = setTimeout(function(){
        holdStarted = true; held = true;
        try{ startRec(); }catch(err){}
      }, HOLD_MS);
    });

    mic.addEventListener('pointermove', function(e){
      if(!holdStarted){
        if(holdT && (Math.abs(e.clientX - sx) > MOVE_TOL || Math.abs(e.clientY - sy) > MOVE_TOL)) clearHold();
        return;
      }
      if(!recording()) return;
      var dx = sx - e.clientX;
      if(dx > 20){
        var t = Math.min(1, dx / CANCEL_DX);
        panel && panel.classList.toggle('arm-cancel', t >= 1);
        setHint(t >= 1 ? 'Отпусти — сотру запись' : 'Тяни влево — отмена');
      } else {
        panel && panel.classList.remove('arm-cancel');
        setHint('Отпусти — отправлю. Смахни влево — отменю.');
      }
    });

    function finish(e){
      clearHold();
      if(pid !== null){ try{ mic.releasePointerCapture(pid); }catch(err){} pid = null; }
      if(holdStarted){
        holdStarted = false;
        var armed = panel && panel.classList.contains('arm-cancel');
        panel && panel.classList.remove('arm-cancel');
        held = false;
        if(!recording()) return;
        if(armed || (e && (sx - e.clientX) > CANCEL_DX)) cancel();
        else send();
        return;
      }
      /* Короткий тап — старт записи БЕЗ удержания. Панель сама всё объяснит. */
      if(!recording()){
        held = false;
        try{ startRec(); }catch(err){}
      }
    }
    mic.addEventListener('pointerup', finish);
    mic.addEventListener('pointercancel', function(){
      clearHold();
      if(holdStarted){ holdStarted = false; held = false; if(recording()) cancel(); }
    });
    /* Клавиатура: Space/Enter на микрофоне — старт/стоп. */
    mic.addEventListener('keydown', function(e){
      if(e.key !== ' ' && e.key !== 'Enter') return;
      e.preventDefault();
      if(recording()) send(); else { held = false; try{ startRec(); }catch(err){} }
    });
  }

  /* ---------- 9. Выход всегда есть ---------- */
  document.addEventListener('keydown', function(e){
    if(!open) return;
    if(e.key === 'Escape'){ e.preventDefault(); e.stopImmediatePropagation(); cancel(); }
    if(e.key === 'Enter'){ e.preventDefault(); e.stopImmediatePropagation(); send(); }
  }, true);

  window.addEventListener('popstate', function(){ if(open) cancel(); });
  /* Уход со страницы/сворачивание — не оставляем микрофон включённым. */
  document.addEventListener('visibilitychange', function(){
    if(document.hidden && open && mode() === 'vnote') cancel();
  });

  /* ---------- 10. Публичное API ---------- */
  window.okoRecActive = function(){ return open || recording(); };
  window.okoRec = { open: show, close: hide, send: send, cancel: cancel, isOpen: function(){ return open; } };

  /* ---------- запуск ---------- */
  function init(){
    try{
      var saved = localStorage.getItem(MODE_KEY);
      if(saved === 'voice' || saved === 'vnote') setMode(saved);
    }catch(e){}
    killLegacy();
    hook();
    rewireMic();
    /* Если композер когда-нибудь пересоберут — кнопка снова станет нашей.
       Наблюдаем только за прямыми детьми контейнера: без subtree, чтобы
       каждое новое сообщение в чате не дёргало обработчик. */
    var host = document.querySelector('.composer');
    if(host && host.parentNode){
      try{ new MutationObserver(function(){ rewireMic(); }).observe(host.parentNode, {childList:true}); }catch(e){}
    }
  }

  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', function(){ setTimeout(init, 0); });
  else setTimeout(init, 0);
})();
