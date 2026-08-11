/* ╔══════════════════════════════════════════════════════════════╗
   ║  OKO · МОСТ В CLAUDE CODE ПОД КАЖДЫЙ MINI-APP                   ║
   ║  window.okoBridge — единая точка для ЛЮБОГО мини-аппа, чтобы    ║
   ║  положить тяжёлую задачу (картинка / видео / клип / обложка /   ║
   ║  сайт / пост / письмо) в очередь и дождаться результата.        ║
   ║                                                                ║
   ║  Сервер: api.php actions oko_task (submit) / oko_task_status    ║
   ║  (poll) / oko_task_mine (список). Обрабатывает очередь сессия   ║
   ║  Claude Code («сливщик»): забирает oko_task_pull, делает работу ║
   ║  и кладёт результат через oko_task_result (нужен админ-токен —  ║
   ║  живёт только на VPS, в приложение не попадает).                ║
   ║                                                                ║
   ║  ЧЕСТНО: задача выполнится, КОГДА работает сессия-сливщик.      ║
   ║  Мгновенный ИИ-чат идёт отдельно (action=assistant) и работает  ║
   ║  всегда. Мост НЕ подделывает результат и НЕ показывает          ║
   ║  «готово», пока сервер не вернул реальный статус done.          ║
   ╚══════════════════════════════════════════════════════════════╝ */
(function () {
  'use strict';
  if (window.okoBridge) return;

  function base() {
    if (typeof window.OKO_API === 'string' && window.OKO_API) return window.OKO_API;
    try { if (location && /(^|\.)okoteam\.top$/.test(location.hostname)) return '/api.php'; } catch (e) {}
    return 'https://okoteam.top/api.php';
  }

  /* Кто автор задачи — для экрана «Очередь» и защиты от заваливания.
     Берём ник/almail из состояния приложения, если он там есть. */
  function who() {
    try {
      var u = (window.state && (window.state.user || window.state.me)) ||
              window.currentUser || window.me || null;
      if (u) return String(u.nick || u.username || u.login || u.email || u.id || '').slice(0, 80);
    } catch (e) {}
    try { return String(localStorage.getItem('oko-nick') || localStorage.getItem('oko-user') || '').slice(0, 80); }
    catch (e) { return ''; }
  }

  function post(action, data) {
    return fetch(base() + '?action=' + action, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data || {})
    }).then(function (r) { return r.json().catch(function () { return { ok: false, error: 'bad json' }; }); });
  }
  function get(action, qs) {
    return fetch(base() + '?action=' + action + (qs ? '&' + qs : ''))
      .then(function (r) { return r.json().catch(function () { return { ok: false, error: 'bad json' }; }); });
  }

  var KINDS = ['image', 'video', 'clip', 'cover', 'site', 'post', 'email', 'content', 'other'];

  var Bridge = {
    /* Положить задачу в очередь.
       kind    — image|video|clip|cover|site|post|email|content|other
       payload — что генерировать (строка-промпт или объект)
       opts    — { title, source }
       → Promise<{ ok, uid, id, status }> */
    submit: function (kind, payload, opts) {
      opts = opts || {};
      if (KINDS.indexOf(kind) < 0) kind = 'other';
      return post('oko_task', {
        kind: kind,
        payload: payload,
        title: opts.title || '',
        source: opts.source || '',
        user: opts.user || who()
      });
    },

    status: function (uid) { return get('oko_task_status', 'uid=' + encodeURIComponent(uid)); },

    mine: function (user) { return get('oko_task_mine', 'user=' + encodeURIComponent(user || who())); },

    /* Опрос до готовности. onUpdate(statusObj) зовётся на каждый тик.
       Возвращает Promise, который резолвится финальным статусом
       (done / failed) либо реджектится по таймауту. Никакого фейка:
       ждём реальный ответ сервера. */
    watch: function (uid, onUpdate, opts) {
      opts = opts || {};
      var every = opts.every || 4000;           // как часто спрашивать
      var timeout = opts.timeout || 20 * 60 * 1000; // сколько всего ждём
      var t0 = Date.now();
      return new Promise(function (resolve, reject) {
        var timer = null, stopped = false;
        function stop() { stopped = true; if (timer) clearTimeout(timer); }
        function tick() {
          if (stopped) return;
          Bridge.status(uid).then(function (s) {
            if (stopped) return;
            if (typeof onUpdate === 'function') { try { onUpdate(s); } catch (e) {} }
            if (s && (s.status === 'done' || s.status === 'failed')) { stop(); resolve(s); return; }
            if (Date.now() - t0 > timeout) { stop(); reject(new Error('timeout')); return; }
            timer = setTimeout(tick, every);
          }).catch(function () {
            if (stopped) return;
            if (Date.now() - t0 > timeout) { stop(); reject(new Error('timeout')); return; }
            timer = setTimeout(tick, every);
          });
        }
        tick();
        Bridge._stop = stop;
      });
    },

    /* Удобный сквозной вызов: submit + watch.
       → Promise<финальный статус>. onUpdate — опционально. */
    run: function (kind, payload, opts) {
      opts = opts || {};
      return Bridge.submit(kind, payload, opts).then(function (r) {
        if (!r || !r.ok || !r.uid) throw new Error((r && r.error) || 'не удалось поставить задачу');
        if (typeof opts.onQueued === 'function') { try { opts.onQueued(r); } catch (e) {} }
        return Bridge.watch(r.uid, opts.onUpdate, opts);
      });
    },

    who: who,
    KINDS: KINDS
  };

  window.okoBridge = Bridge;
})();
