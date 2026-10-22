/*
 * ПОКАЗ ЭКРАНА УЧАСТНИКА АДМИНИСТРАТОРУ (core/ls_access.php).
 *
 * Подключается только тому, кто сам дал согласие и у кого доступ открыт
 * (templates/site/layout.php). Запись rrweb включается, лишь пока
 * администратор держит открытым окно просмотра, и выключается, как только он
 * его закрыл. Пароли закрыты точками. Указка администратора — метка
 * «Нажмите сюда» на месте, куда он показал.
 */
(function () {
  var C = window.LS_WATCH;
  if (!C || !window.rrweb || window.__lsWatch) return;
  window.__lsWatch = true;

  var id = 0, stopRec = null, buf = [], hasFull = false, sending = false, lastPoint = 0, timer = null, bar = null;

  function req(method, data) {
    var o = { method: method, credentials: 'same-origin' };
    if (data) {
      data._csrf = C.csrf;
      o.headers = { 'Content-Type': 'application/x-www-form-urlencoded' };
      o.body = new URLSearchParams(data);
    }
    return fetch(C.api, o).then(function (r) { return r.json(); });
  }

  /* ---------- Полоса у участника ---------- */
  function renderBar(d) {
    if (!bar) {
      bar = document.createElement('div');
      bar.style.cssText = 'position:sticky;top:0;z-index:10000;display:flex;flex-wrap:wrap;gap:8px 14px;align-items:center;' +
        'justify-content:center;padding:9px 16px;background:#17307A;color:#fff;font:600 13px/1.35 Montserrat,system-ui,sans-serif;text-align:center';
      bar.innerHTML = '<span data-t></span><button type="button" style="background:#fff;color:#17307A;border:0;border-radius:8px;' +
        'padding:5px 12px;font:inherit;cursor:pointer">Закрыть доступ</button>';
      bar.querySelector('button').addEventListener('click', function () {
        var b = this; b.disabled = true;
        fetch(C.close, { method: 'POST', credentials: 'same-origin',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({ action: 'close', id: id, _csrf: C.csrf }) })
          .finally(function () { teardown(); });
      });
      document.body.insertBefore(bar, document.body.firstChild);
    }
    bar.querySelector('[data-t]').textContent = 'Доступ к кабинету открыт администратору до ' + d.until +
      (d.watching ? ' · администратор видит Ваш экран' : '');
    bar.style.background = d.watching ? '#B3261E' : '#17307A';
  }

  /* ---------- Указка ---------- */
  function showPoint(p) {
    if (!p || p.path !== location.pathname) return;
    var m = document.createElement('div');
    m.setAttribute('aria-hidden', 'true');
    m.style.cssText = 'position:absolute;z-index:10002;left:' + (p.x - 22) + 'px;top:' + (p.y - 22) + 'px;width:44px;height:44px;' +
      'border-radius:50%;border:4px solid #E53935;box-shadow:0 0 0 6px rgba(229,57,53,.25);pointer-events:none;animation:lsPulse 1s ease-in-out infinite';
    var t = document.createElement('div');
    t.textContent = 'Нажмите сюда';
    t.style.cssText = 'position:absolute;left:50%;top:50px;transform:translateX(-50%);white-space:nowrap;background:#E53935;color:#fff;' +
      'font:700 13px/1 Montserrat,system-ui,sans-serif;padding:6px 10px;border-radius:8px';
    m.appendChild(t);
    if (!document.getElementById('lsPulseCss')) {
      var st = document.createElement('style'); st.id = 'lsPulseCss';
      st.textContent = '@keyframes lsPulse{0%,100%{transform:scale(1)}50%{transform:scale(1.25)}}';
      document.head.appendChild(st);
    }
    document.body.appendChild(m);
    var vy = p.y - window.scrollY;
    if (vy < 40 || vy > window.innerHeight - 80) window.scrollTo({ top: Math.max(0, p.y - window.innerHeight / 2), behavior: 'smooth' });
    setTimeout(function () { m.remove(); }, 7000);
  }

  /* ---------- Запись ---------- */
  function startRec() {
    if (stopRec) return;
    buf = []; hasFull = false;
    stopRec = rrweb.record({
      // Пакуем сами, ПОСЛЕ проверки типа: с packFn сюда приходит уже строка, и
      // полный снимок (type 2) не отличить — окно просмотра ждало бы его вечно.
      emit: function (e) { if (e.type === 2) hasFull = true; buf.push(rrweb.pack(e)); },
      maskInputOptions: { password: true },
      checkoutEveryNms: 60000,          // свежий полный снимок раз в минуту — окно просмотра можно открыть заново
      sampling: { mousemove: 60, scroll: 150, input: 'last' }
    });
  }
  function stopRecording() { if (stopRec) { try { stopRec(); } catch (e) {} } stopRec = null; buf = []; hasFull = false; }

  function teardown() {
    stopRecording();
    if (timer) clearTimeout(timer);
    timer = null;
    if (bar) { bar.remove(); bar = null; }
  }

  function onState(d) {
    if (!d || !d.active) { teardown(); return false; }
    id = d.id;
    renderBar(d);
    if (d.watching) startRec(); else stopRecording();
    if (d.point && d.point.t > lastPoint) {
      var fresh = lastPoint !== 0 || (d.point.age !== undefined && d.point.age < 6000);
      lastPoint = d.point.t;
      if (fresh) showPoint(d.point);
    }
    return true;
  }

  function tick() {
    if (sending) { timer = setTimeout(tick, 500); return; }
    var p;
    if (stopRec && buf.length) {
      var batch = buf, full = hasFull;
      buf = []; hasFull = false; sending = true;
      p = req('POST', { action: 'push', id: id, full: full ? '1' : '0', data: JSON.stringify(batch) })
        .catch(function () { buf = batch.concat(buf); hasFull = hasFull || full; return null; });
    } else {
      sending = true;
      p = req('GET').catch(function () { return null; });
    }
    p.then(function (d) {
      sending = false;
      if (d === null) { timer = setTimeout(tick, 3000); return; }
      if (onState(d)) timer = setTimeout(tick, stopRec ? 1000 : 2500);
    });
  }
  tick();
})();
