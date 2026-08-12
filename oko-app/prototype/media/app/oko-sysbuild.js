/* ╔══════════════════════════════════════════════════════════════╗
   ║  OKO · СБОРКА СИСТЕМЫ РОСТА (мини-апп «Система роста»)          ║
   ║                                                                ║
   ║  Было: анкета считала план на устройстве и честно писала, что   ║
   ║  никуда его не отправляет - серверной части не было.            ║
   ║  Стало: анкета уходит через мост в отдельную сессию Claude Code ║
   ║  («❇️ СИСТЕМЫ ОКО»), там идёт полный анализ ниши, бренда,        ║
   ║  конкурентов и сборка персональной Системы Роста. Готовая       ║
   ║  система возвращается и открывается прямо здесь, в приложении.  ║
   ║                                                                ║
   ║  ЧЕСТНОСТЬ (иначе смысла нет):                                  ║
   ║  · никакого поддельного прогресса. Статус берётся с сервера;    ║
   ║  · «готово» показывается ТОЛЬКО когда система реально пришла;   ║
   ║  · срок 3-6 часов назван ориентиром, а не обещанием;            ║
   ║  · сорвалось - показываем настоящую причину с сервера.          ║
   ╚══════════════════════════════════════════════════════════════╝ */
(function () {
  'use strict';
  if (window.okoSysBuild) return;

  var LS_TASK = 'oko-sys-task';       // текущая задача на сборку
  var LS_LIST = 'oko-sys-ready';      // собранные системы (кэш карточек)
  var POLL_MS = 60000;                // раз в минуту — сборка идёт часами

  function E(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function ls(k, d) { try { var v = JSON.parse(localStorage.getItem(k)); return v == null ? d : v; } catch (e) { return d; } }
  function lsSet(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }
  function say(t) { try { if (typeof window.toast === 'function') window.toast(t); } catch (e) {} }
  function ico(n) {
    try { if (typeof window.I === 'function') return window.I(n); } catch (e) {}
    return '<svg class="i" aria-hidden="true"><use href="#i-' + n + '"></use></svg>';
  }
  function who() {
    try { if (window.okoBridge && window.okoBridge.who) return window.okoBridge.who(); } catch (e) {}
    return '';
  }

  /* ---------------------------------------------------- отправка в сборку */

  /* Собрать всё, что знаем о человеке: ответы анкеты + профиль + соцсети.
     Чем больше контекста уйдёт в сборку, тем меньше система будет угадывать. */
  function payload() {
    var a = {}, mode = 'full';
    try { if (typeof aState !== 'undefined' && aState) { a = aState.answers || {}; mode = aState.mode || 'full'; } } catch (e) {}

    var profile = {};
    try {
      if (typeof PROFILE !== 'undefined' && PROFILE) {
        profile = { nick: PROFILE.nick || '', name: PROFILE.name || '', tier: PROFILE.tier || 'FREE', email: PROFILE.email || '' };
      }
    } catch (e) {}

    var socials = [];
    try {
      if (typeof SOCIALS !== 'undefined' && Array.isArray(SOCIALS)) {
        socials = SOCIALS.filter(function (s) { return s && s.linked; })
          .map(function (s) { return { id: s.id, name: s.name, handle: s.handle || '', subs: s.subs || null }; });
      }
    } catch (e) {}

    var period = 30;
    try { period = parseInt(a.period, 10) || 30; } catch (e) {}

    return {
      anketa: a, mode: mode, profile: profile, socials: socials, period: period,
      requested_at: new Date().toISOString()
    };
  }

  function answered(a) {
    return Object.keys(a || {}).filter(function (k) {
      var v = a[k];
      if (Array.isArray(v)) return v.length > 0;
      return v !== null && v !== undefined && String(v).trim() !== '';
    }).length;
  }

  /* Отправить анкету в сборку. Возвращает промис с uid задачи. */
  function send() {
    if (!window.okoBridge) {
      say('Мост сборки не загрузился. Обнови приложение и попробуй ещё раз.');
      return Promise.reject(new Error('no bridge'));
    }
    var p = payload();
    var n = answered(p.anketa);
    if (n < 5) {
      say('Слишком мало ответов для сборки — заполни анкету.');
      return Promise.reject(new Error('too few answers'));
    }
    var name = (p.anketa.who || p.profile.name || p.profile.nick || '').toString().slice(0, 60);
    var niche = (p.anketa.niche || '').toString().slice(0, 60);

    return window.okoBridge.submit('system', p, {
      source: 'mini-system',
      title: 'Система Роста' + (name ? ' · ' + name : '') + (niche ? ' · ' + niche : '')
    }).then(function (r) {
      if (!r || !r.ok || !r.uid) throw new Error((r && r.error) || 'сервер не принял заявку');
      var rec = {
        uid: r.uid, at: Date.now(), status: 'pending',
        title: 'Система Роста' + (niche ? ' · ' + niche : ''),
        niche: niche, answers: n
      };
      lsSet(LS_TASK, rec);
      watch();
      return rec;
    });
  }

  /* ------------------------------------------------------ слежение за статусом */

  var timer = null;

  function watch() {
    if (timer) clearTimeout(timer);
    var rec = ls(LS_TASK, null);
    if (!rec || !rec.uid) return;
    if (rec.status === 'done' || rec.status === 'failed') return;

    tick();
    function tick() {
      window.okoBridge.status(rec.uid).then(function (s) {
        if (!s || !s.ok) return schedule();
        var cur = ls(LS_TASK, null);
        if (!cur || cur.uid !== rec.uid) return;      // задачу сменили
        cur.status = s.status;
        cur.error = s.error || '';
        if (s.status === 'done') {
          cur.result = s.result || null;
          lsSet(LS_TASK, cur);
          onReady(cur);
          return;
        }
        lsSet(LS_TASK, cur);
        paint();
        schedule();
      }).catch(schedule);
    }
    function schedule() { timer = setTimeout(tick, POLL_MS); }
  }

  /* Система пришла: сохранить карточку, уведомить, завести рабочий чат. */
  function onReady(rec) {
    var res = rec.result || {};
    var sysUid = res.system_uid || '';
    var url = res.url || '';
    if (!sysUid && !url) return;                       // без ссылки праздновать нечего

    var list = ls(LS_LIST, []);
    if (!Array.isArray(list)) list = [];
    if (!list.some(function (x) { return x.system_uid === sysUid; })) {
      list.unshift({
        system_uid: sysUid, url: url, title: res.title || rec.title || 'Система Роста',
        niche: rec.niche || '', at: Date.now(), bytes: res.bytes || 0
      });
      lsSet(LS_LIST, list.slice(0, 20));
    }

    notify(res.title || 'Система Роста');
    managerChat(res.title || 'Система Роста');
    paint();
    say('Система готова — открой раздел «Система роста»');
  }

  /* Уведомление в ленте уведомлений приложения (без выдумок: только факт). */
  function notify(title) {
    try {
      if (typeof NOTIFS !== 'undefined' && Array.isArray(NOTIFS)) {
        NOTIFS.unshift({
          ic: 'compass', who: 'Система Роста',
          t: 'готова: ' + title + '. Открой, чтобы посмотреть.',
          at: Date.now(),
          act: function () { open(); }
        });
        if (typeof updateNotifDot === 'function') updateNotifDot();
      }
    } catch (e) {}
  }

  /* Рабочий чат с менеджером. Создаём ОДИН раз и без поддельных сообщений:
     менеджер напишет сам, приложение за него не говорит. */
  function managerChat(title) {
    try {
      if (typeof CHATS === 'undefined' || !Array.isArray(CHATS)) return;
      var id = 'sys-work';
      if (CHATS.some(function (c) { return c.id === id; })) return;
      CHATS.unshift({
        id: id, name: 'Система Роста · рабочий чат', avaIcon: 'compass',
        verified: true, sub: title, msgs: [], pinned: true
      });
      if (typeof renderChatList === 'function') renderChatList();
    } catch (e) {}
  }

  /* ------------------------------------------------------------- экраны */

  function card() {
    var rec = ls(LS_TASK, null);
    var list = ls(LS_LIST, []);
    var h = '';

    if (Array.isArray(list) && list.length) {
      h += '<div class="sb-ready">';
      h += '<div class="sb-ready-h">' + ico('check2') + '<b>Твои системы</b></div>';
      list.forEach(function (s) {
        h += '<button class="sb-item okv-press" type="button" onclick="okoSysBuild.open(\'' + E(s.system_uid) + '\')">'
          + '<span class="sb-item-ic">' + ico('compass') + '</span>'
          + '<span class="sb-item-b"><b>' + E(s.title) + '</b>'
          + '<small>' + (s.niche ? E(s.niche) + ' · ' : '') + new Date(s.at).toLocaleDateString('ru-RU') + '</small></span>'
          + ico('chev') + '</button>';
      });
      h += '</div>';
    }

    if (rec && rec.uid && rec.status !== 'done') {
      var failed = rec.status === 'failed';
      h += '<div class="sb-status' + (failed ? ' bad' : '') + '">';
      h += '<div class="sb-status-h">'
        + '<span class="sb-status-ic okv-halo">' + ico(failed ? 'alert' : 'clock') + '</span>'
        + '<div><b>' + (failed ? 'Сборка не прошла' : 'Система в сборке') + '</b>'
        + '<small>' + (failed
          ? E(rec.error || 'Причина не указана. Напиши в поддержку — разберёмся.')
          : 'Заявка принята ' + new Date(rec.at).toLocaleString('ru-RU')
            + '. Ориентир по времени - 3-6 часов: идёт разбор ниши, конкурентов и сборка разделов. '
            + 'Приложение не рисует поддельный прогресс - как только система будет готова, она появится здесь и придёт уведомление.')
        + '</small></div></div>';
      if (failed) {
        h += '<div class="sb-btns"><button class="btn ghost okv-press" type="button" onclick="okoSysBuild.retry()">'
          + ico('refresh') + ' Отправить заново</button></div>';
      }
      h += '</div>';
    }
    return h;
  }

  /* Дорисовать карточку статуса в экран Системы роста, если он открыт. */
  function paint() {
    var host = document.getElementById('okoSysBuildBox');
    if (!host) return;
    host.innerHTML = card();
  }

  /* Открыть готовую систему прямо в приложении. Система - самодостаточный
     HTML, поэтому показываем её в изолированном фрейме поверх приложения. */
  function open(sysUid) {
    var list = ls(LS_LIST, []);
    var s = sysUid ? list.filter(function (x) { return x.system_uid === sysUid; })[0] : list[0];
    if (!s) { say('Системы пока нет'); return; }

    var v = document.getElementById('okoSysView');
    if (!v) {
      v = document.createElement('div');
      v.id = 'okoSysView';
      v.innerHTML =
        '<div class="sv-bar">'
        + '<button class="sv-x oko-back" type="button" aria-label="Закрыть" onclick="okoSysBuild.close()">' + ico('chev') + '</button>'
        + '<b id="okoSysTitle"></b>'
        + '<a class="sv-out" id="okoSysOut" target="_blank" rel="noopener" aria-label="Открыть в браузере">' + ico('share') + '</a>'
        + '</div>'
        + '<iframe id="okoSysFrame" title="Система Роста" referrerpolicy="no-referrer"></iframe>';
      document.body.appendChild(v);
    }
    document.getElementById('okoSysTitle').textContent = s.title || 'Система Роста';
    var out = document.getElementById('okoSysOut'); if (out) out.href = s.url;
    document.getElementById('okoSysFrame').src = s.url;
    v.classList.add('on');
    try { document.documentElement.style.overflow = 'hidden'; } catch (e) {}
  }

  function close() {
    var v = document.getElementById('okoSysView');
    if (!v) return;
    v.classList.remove('on');
    var f = document.getElementById('okoSysFrame'); if (f) f.src = 'about:blank';
    try { document.documentElement.style.overflow = ''; } catch (e) {}
  }

  function retry() {
    var rec = ls(LS_TASK, null);
    if (!rec) return;
    send().then(function () { paint(); say('Заявка отправлена заново'); })
          .catch(function (e) { say('Не удалось отправить: ' + (e.message || 'ошибка')); });
  }

  /* --------------------------------------------------- встраивание в экран */

  /* Кнопка «Собрать систему» на финальном экране анкеты. Слой system2 рисует
     финал сам, поэтому дописываемся к нему, а не переписываем его. */
  function hookFinish() {
    if (typeof window.anketaFinish !== 'function') return false;
    if (window.anketaFinish.__sb) return true;
    var prev = window.anketaFinish;
    var wrapped = function () {
      var r = prev.apply(this, arguments);
      setTimeout(addSubmit, 30);
      return r;
    };
    wrapped.__sb = 1;
    window.anketaFinish = wrapped;
    return true;
  }

  function addSubmit() {
    var box = document.querySelector('#anketaCard .sy2-btns');
    if (!box || box.querySelector('.sb-go')) return;
    var b = document.createElement('button');
    b.className = 'btn sb-go okv-press okv-shine';
    b.type = 'button';
    b.innerHTML = ico('rocket') + ' Собрать систему';
    b.addEventListener('click', function () {
      b.disabled = true;
      b.innerHTML = '<span class="spin" style="width:18px;height:18px"></span> Отправляю…';
      send().then(function () {
        b.innerHTML = ico('check2') + ' Заявка принята';
        var host = document.getElementById('okoSysBuildBox');
        if (!host) {
          host = document.createElement('div');
          host.id = 'okoSysBuildBox';
          box.parentNode.insertBefore(host, box);
        }
        paint();
        say('Система ушла в сборку');
      }).catch(function (e) {
        b.disabled = false;
        b.innerHTML = ico('rocket') + ' Собрать систему';
        say('Не отправилось: ' + (e.message || 'ошибка сети'));
      });
    });
    box.insertBefore(b, box.firstChild);

    if (!document.getElementById('okoSysBuildBox')) {
      var host = document.createElement('div');
      host.id = 'okoSysBuildBox';
      box.parentNode.insertBefore(host, box);
      paint();
    }
  }

  /* Карточка статуса на самом экране «Система роста» (не только после анкеты). */
  function mountOnScreen() {
    var rec = ls(LS_TASK, null);
    var list = ls(LS_LIST, []);
    if (!rec && (!list || !list.length)) return;
    var scr = document.getElementById('screen-mini') || document.querySelector('.screen.active');
    if (!scr) return;
    var host = document.getElementById('okoSysBuildBox');
    if (!host) {
      host = document.createElement('div');
      host.id = 'okoSysBuildBox';
      host.style.cssText = 'padding:0 16px';
      var anchor = scr.querySelector('.ma-grid, .mini-grid, .ma-list') || scr.firstElementChild;
      if (anchor && anchor.parentNode) anchor.parentNode.insertBefore(host, anchor);
      else scr.insertBefore(host, scr.firstChild);
    }
    paint();
  }

  function start() {
    /* window.anketaFinish появляется не сразу: слой system2 ставит свои имена
       после DOMContentLoaded и ПЕРЕУСТАНАВЛИВАЕТ их ещё раз после load.
       Одной попытки мало, поэтому пробуем несколько раз и останавливаемся,
       как только зацепились. Заодно ловим сам блок кнопок финала - если
       человек дошёл до конца анкеты раньше, чем мы обернули функцию,
       кнопка «Собрать систему» всё равно появится. */
    var попыток = 0;
    var t = setInterval(function () {
      попыток++;
      var зацепились = hookFinish();
      /* блок кнопок финала уже на экране - дорисовать кнопку сразу */
      if (document.querySelector('#anketaCard .sy2-btns')) addSubmit();
      if ((зацепились && попыток > 6) || попыток > 40) clearInterval(t);
    }, 500);

    setTimeout(mountOnScreen, 1200);
    watch();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start, { once: true });
  } else { start(); }

  window.okoSysBuild = {
    send: send, open: open, close: close, retry: retry,
    статус: function () { return ls(LS_TASK, null); },
    системы: function () { return ls(LS_LIST, []); },
    обнови: paint
  };
})();
