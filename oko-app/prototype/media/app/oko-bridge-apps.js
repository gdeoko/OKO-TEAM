/* ╔══════════════════════════════════════════════════════════════╗
   ║  OKO · МОСТ ДЛЯ КОНТЕНТ-ЗАВОДА И ПРОВЕРКИ ВИДЕО                 ║
   ║                                                                ║
   ║  Оба мини-аппа честно упирались в одно и то же: «нужен сервер». ║
   ║  Контент-завод не мог отправить бриф на генерацию, проверка     ║
   ║  видео меряла файл в браузере, но не могла разобрать содержание.║
   ║  Сервер теперь есть - это мост в сессии Claude Code:            ║
   ║  «🎬 КОНТЕНТ-ЗАВОД ОКО» и «🎥 ПРОВЕРКА ВИДЕО ОКО».               ║
   ║                                                                ║
   ║  Слой не переписывает мини-аппы, а дописывается к ним: ловит их ║
   ║  же функции отрисовки и добавляет кнопку отправки плюс карточку ║
   ║  статуса. Никакого поддельного прогресса - статус только с      ║
   ║  сервера, «готово» только когда результат реально пришёл.       ║
   ╚══════════════════════════════════════════════════════════════╝ */
(function () {
  'use strict';
  if (window.okoBridgeApps) return;

  var LS = 'oko-bridge-apps-v1';     // { fx:{taskId:rec}, vc:{id:rec} }
  var POLL_MS = 30000;

  function E(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function read(k, d) { try { var v = JSON.parse(localStorage.getItem(k)); return v == null ? d : v; } catch (e) { return d; } }
  function write(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }
  function state() { var s = read(LS, null); if (!s || typeof s !== 'object') s = {}; if (!s.fx) s.fx = {}; if (!s.vc) s.vc = {}; return s; }
  function save(s) { write(LS, s); }
  function say(t) { try { if (typeof window.toast === 'function') window.toast(t); } catch (e) {} }
  function ico(n) {
    try { if (typeof window.I === 'function') return window.I(n); } catch (e) {}
    return '<svg class="i" aria-hidden="true"><use href="#i-' + n + '"></use></svg>';
  }
  function bridge() { return window.okoBridge || null; }

  /* ─────────────────────────────────────── общая карточка статуса */

  /* Одна карточка на оба мини-аппа: что отправлено, что происходит, что
     пришло. Врать нечем - показываем ровно то, что вернул сервер. */
  function statusHtml(rec, kindWord) {
    if (!rec) return '';
    var res = rec.result;
    if (rec.status === 'done') {
      var url = (res && (res.url || res.link)) || '';
      var text = (res && (res.text || res.verdict)) || (typeof res === 'string' ? res : '');
      var h = '<div class="ba-res"><div class="ba-res-h">' + ico('check2') + '<b>Готово</b></div>';
      if (text) h += '<p class="ba-res-t">' + E(String(text).slice(0, 1200)) + '</p>';
      if (Array.isArray(res && res.fixes) && res.fixes.length) {
        h += '<ul class="ba-fixes">' + res.fixes.slice(0, 12).map(function (f) {
          return '<li>' + E(typeof f === 'string' ? f : (f.what || JSON.stringify(f))) + '</li>';
        }).join('') + '</ul>';
      }
      if (url) h += '<a class="btn ghost okv-press" href="' + E(url) + '" target="_blank" rel="noopener">' + ico('share') + ' Открыть результат</a>';
      h += '</div>';
      return h;
    }
    if (rec.status === 'failed') {
      return '<div class="ba-st bad"><span class="ba-st-ic">' + ico('warning') + '</span>'
        + '<div><b>Не получилось</b><small>' + E(rec.error || 'Причина не указана. Попробуй ещё раз или напиши в поддержку.') + '</small></div></div>';
    }
    return '<div class="ba-st"><span class="ba-st-ic okv-halo">' + ico('clock') + '</span>'
      + '<div><b>' + E(kindWord) + ' в работе</b><small>Задача принята '
      + new Date(rec.at).toLocaleString('ru-RU')
      + '. Результат придёт сюда, как только освободится исполнитель. Поддельного прогресса здесь нет: '
      + 'пока сервер не ответит, ничего не меняется.</small></div></div>';
  }

  /* ───────────────────────────────────────────── слежение */

  var timers = {};

  function watch(group, key) {
    var id = group + ':' + key;
    if (timers[id]) clearTimeout(timers[id]);
    var s = state(), rec = s[group][key];
    if (!rec || !rec.uid || rec.status === 'done' || rec.status === 'failed') return;
    if (!bridge()) return;

    (function tick() {
      bridge().status(rec.uid).then(function (r) {
        var st = state(), cur = st[group][key];
        if (!cur || cur.uid !== rec.uid) return;
        if (r && r.ok) {
          cur.status = r.status;
          cur.error = r.error || '';
          if (r.status === 'done') cur.result = r.result;
          st[group][key] = cur; save(st);
          repaint();
          if (r.status === 'done') { say(group === 'fx' ? 'Материал готов' : 'Разбор готов'); return; }
          if (r.status === 'failed') return;
        }
        timers[id] = setTimeout(tick, POLL_MS);
      }).catch(function () { timers[id] = setTimeout(tick, POLL_MS); });
    })();
  }

  function watchAll() {
    var s = state();
    Object.keys(s.fx).forEach(function (k) { watch('fx', k); });
    Object.keys(s.vc).forEach(function (k) { watch('vc', k); });
  }

  /* ─────────────────────────────────── КОНТЕНТ-ЗАВОД */

  function fxTasks() {
    var s = read('oko-fx2-v1', null);
    return (s && Array.isArray(s.tasks)) ? s.tasks : [];
  }

  function fxSend(taskId) {
    var t = fxTasks().filter(function (x) { return x.id === taskId; })[0];
    if (!t) { say('Задача не найдена'); return Promise.reject(new Error('no task')); }
    if (!bridge()) { say('Мост не загрузился, обнови приложение'); return Promise.reject(new Error('no bridge')); }

    /* Отправляем ровно бриф, который человек заполнил: ничего не додумываем. */
    var payload = {
      brief: {
        title: t.title || '', format: t.format || 'clip',
        channels: t.channels || [], goal: t.goal || '', audience: t.audience || '',
        cta: t.cta || '', tone: t.tone || '', avoid: t.avoid || '',
        deadline: t.deadline || '', script: t.script || ''
      },
      want: t.script ? 'production' : 'script_and_production'
    };
    return bridge().submit('content', payload, {
      source: 'mini-factory',
      title: (t.title || 'Материал') + ' · ' + (t.format || 'clip')
    }).then(function (r) {
      if (!r || !r.ok || !r.uid) throw new Error((r && r.error) || 'сервер не принял');
      var s = state();
      s.fx[taskId] = { uid: r.uid, at: Date.now(), status: 'pending' };
      save(s); watch('fx', taskId); repaint();
      return r;
    });
  }

  /* Дорисовать кнопку и статус к карточкам задач завода. */
  function fxDecorate() {
    var s = state();
    var cards = document.querySelectorAll('.fx2-card[data-task], .fx2-card');
    Array.prototype.forEach.call(cards, function (card) {
      var id = card.getAttribute('data-task');
      if (!id) {
        /* слой не проставляет data-task - опознаём задачу по заголовку */
        var t = card.querySelector('.fx2-step-t, b, h4');
        var name = t ? t.textContent.trim() : '';
        var m = fxTasks().filter(function (x) { return (x.title || '').trim() === name; })[0];
        if (!m) return;
        id = m.id; card.setAttribute('data-task', id);
      }
      var box = card.querySelector('.fx2-btns');
      if (!box) return;
      var rec = s.fx[id];

      var host = card.querySelector('.ba-host');
      if (!host) {
        host = document.createElement('div');
        host.className = 'ba-host';
        box.parentNode.insertBefore(host, box.nextSibling);
      }
      host.innerHTML = statusHtml(rec, 'Производство');

      if (!rec && !box.querySelector('.ba-go')) {
        var b = document.createElement('button');
        b.className = 'fx2-btn ba-go okv-press';
        b.type = 'button';
        b.innerHTML = ico('rocket') + ' В производство';
        b.addEventListener('click', function () {
          b.disabled = true; b.textContent = 'Отправляю…';
          fxSend(id).then(function () { say('Задача ушла в производство'); })
            .catch(function (e) { b.disabled = false; b.innerHTML = ico('rocket') + ' В производство'; say('Не отправилось: ' + (e.message || 'ошибка')); });
        });
        box.appendChild(b);
      }
    });
  }

  /* ─────────────────────────────── ПРОВЕРКА ВИДЕО */

  function vcLast() {
    var s = read('oko-vc2-v1', null);
    if (!s) return null;
    if (Array.isArray(s.history) && s.history.length) return s.history[0];
    if (s.last) return s.last;
    return null;
  }

  function vcSend() {
    var r = vcLast();
    if (!r) { say('Сначала проверь ролик — нужны замеры'); return Promise.reject(new Error('no report')); }
    if (!bridge()) { say('Мост не загрузился'); return Promise.reject(new Error('no bridge')); }

    /* Отправляем ИЗМЕРЕННОЕ, а не выдуманное: то, что браузер реально снял
       с файла. Сам файл не уходит - его в браузере не выгрузить, и обещать
       разбор картинки мы не будем. */
    var payload = {
      measured: {
        name: r.name || '', size: r.size || null, mime: r.mime || '',
        duration: r.duration || null, w: r.w || null, h: r.h || null,
        fps: r.fps || null, audio: r.audio, luma: r.luma, motion: r.motion,
        platform: r.platform || r.target || ''
      },
      checks: r.checks || null,
      want: 'deep_review'
    };
    return bridge().submit('video_check', payload, {
      source: 'mini-videocheck',
      title: 'Разбор ролика' + (r.name ? ' · ' + String(r.name).slice(0, 40) : '')
    }).then(function (res) {
      if (!res || !res.ok || !res.uid) throw new Error((res && res.error) || 'сервер не принял');
      var s = state();
      var key = r.id || r.name || 'last';
      s.vc[key] = { uid: res.uid, at: Date.now(), status: 'pending' };
      save(s); watch('vc', key); repaint();
      return res;
    });
  }

  function vcDecorate() {
    var report = document.querySelector('.vc2-card');
    if (!report) return;
    var wrap = report.parentNode;
    if (!wrap) return;

    var host = wrap.querySelector('.ba-host-vc');
    if (!host) {
      host = document.createElement('div');
      host.className = 'ba-host-vc';
      wrap.appendChild(host);
    }
    var r = vcLast();
    var key = r ? (r.id || r.name || 'last') : null;
    var rec = key ? state().vc[key] : null;

    var h = '';
    if (!rec) {
      h += '<div class="ba-offer">'
        + '<div class="ba-offer-h">' + ico('bolt') + '<b>Глубокий разбор</b></div>'
        + '<p>Замеры выше сняты прямо в браузере. Смысловой разбор - хук первых секунд, темп, '
        + 'где зритель уходит, что переснять - делает специалист OKO по этим замерам. '
        + 'Сам файл никуда не уходит.</p>'
        + '<button class="btn ba-vc-go okv-press okv-shine" type="button">' + ico('rocket') + ' Отправить на разбор</button>'
        + '</div>';
    }
    h += statusHtml(rec, 'Разбор');
    host.innerHTML = h;

    var b = host.querySelector('.ba-vc-go');
    if (b) b.addEventListener('click', function () {
      b.disabled = true; b.textContent = 'Отправляю…';
      vcSend().then(function () { say('Ролик ушёл на разбор'); })
        .catch(function (e) { b.disabled = false; b.innerHTML = ico('rocket') + ' Отправить на разбор'; say('Не отправилось: ' + (e.message || 'ошибка')); });
    });
  }

  /* ──────────────────────────────────── перерисовка */

  var кадр = null;
  function repaint() {
    if (кадр) cancelAnimationFrame(кадр);
    кадр = requestAnimationFrame(function () {
      кадр = null;
      try { fxDecorate(); } catch (e) {}
      try { vcDecorate(); } catch (e) {}
    });
  }

  /* Ловим отрисовку самих мини-аппов - дописываемся после них. */
  function hook(name) {
    if (typeof window[name] !== 'function' || window[name].__ba) return false;
    var prev = window[name];
    var w = function () { var r = prev.apply(this, arguments); setTimeout(repaint, 40); return r; };
    w.__ba = 1;
    window[name] = w;
    return true;
  }

  function start() {
    var n = 0;
    var t = setInterval(function () {
      n++;
      var a = hook('renderFactory'), b = hook('renderVcReport');
      if ((a || b) && n > 6) clearInterval(t);
      if (n > 40) clearInterval(t);
    }, 500);
    watchAll();
    setTimeout(repaint, 1500);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start, { once: true });
  } else { start(); }

  window.okoBridgeApps = {
    отправитьМатериал: fxSend,
    отправитьРолик: vcSend,
    состояние: state,
    обнови: repaint
  };
})();
