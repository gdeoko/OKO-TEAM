/* ============================================================================
 * WOW-EYE · интерактивный 3D-стеклянный глаз OKO на экране входа (#authScreen)
 * ----------------------------------------------------------------------------
 * • Canvas 2D: стеклянная сфера-зрачок с бликами, преломлением (хроматика),
 *   внутренним лаймовым свечением и ровным симметричным ореолом.
 * • Следит за пальцем/курсором (pointermove/touchmove по всему экрану) с
 *   пружинным доводом (lerp) + лёгкий 3D-параллакс (CSS rotateX/rotateY).
 * • Естественно моргает (случайно 3–6 с); при тапе — подмигивает.
 * • Уважает prefers-reduced-motion (статичный кадр, без rAF).
 * • Останавливает rAF, когда #authScreen скрыт (.hidden) или вкладка неактивна.
 * Всё в едином IIFE, без исключений на верхнем уровне, префикс we*.
 * ==========================================================================*/
(function () {
  'use strict';
  if (typeof document === 'undefined' || typeof window === 'undefined') return;

  var WRAP_ID = 'we-wrap';
  var CANVAS_ID = 'we-canvas';
  var CSS = 224;          // логический размер холста (CSS px)
  var C = CSS / 2;        // центр = 112

  function weClamp(v, a, b) { return v < a ? a : (v > b ? b : v); }
  function weEaseIn(x) { return x * x; }
  function weEaseOut(x) { return 1 - (1 - x) * (1 - x); }
  function weNow() {
    return (window.performance && performance.now) ? performance.now() : Date.now();
  }

  function weInit() {
    try {
      var auth = document.getElementById('authScreen');
      if (!auth) return;
      if (document.getElementById(WRAP_ID)) return; // уже вставлен

      var logo = auth.querySelector('.auth-logo');
      var inner = auth.querySelector('.auth-inner') || auth;

      var wrap = document.createElement('div');
      wrap.id = WRAP_ID;
      wrap.setAttribute('aria-hidden', 'true');

      var canvas = document.createElement('canvas');
      canvas.id = CANVAS_ID;
      wrap.appendChild(canvas);

      if (logo && logo.parentNode) {
        logo.parentNode.insertBefore(wrap, logo);
      } else if (inner) {
        inner.insertBefore(wrap, inner.firstChild);
      } else {
        return;
      }

      var ctx = canvas.getContext ? canvas.getContext('2d') : null;
      if (!ctx) return;

      weSetup(auth, canvas, ctx);
    } catch (e) { /* никогда не ломаем приложение */ }
  }

  function weSetup(auth, canvas, ctx) {
    var reduceMQ = (window.matchMedia && window.matchMedia('(prefers-reduced-motion:reduce)'));
    var reduce = !!(reduceMQ && reduceMQ.matches);

    var dpr = 1;
    function weSize() {
      dpr = Math.min(window.devicePixelRatio || 1, 2.5);
      canvas.width = Math.round(CSS * dpr);
      canvas.height = Math.round(CSS * dpr);
    }
    weSize();

    // --- состояние взгляда/анимации ---
    var gx = 0, gy = 0;      // текущий взгляд [-1..1]
    var tgx = 0, tgy = 0;    // целевой взгляд
    var lid = 0;             // веко: 0 открыто … 1 закрыто
    var lastMove = -99999;   // время последнего движения указателя
    var blinking = false, blinkT = 0, blinkDur = 170, nextBlink = 0, winkExtra = 0;

    function weSchedule(now) { nextBlink = now + 3000 + Math.random() * 3000; }
    function weStartBlink(now, wink) {
      if (blinking) return;
      blinking = true; blinkT = now;
      blinkDur = wink ? 240 : 170;
      winkExtra = wink ? 1 : 0;
    }

    // --- указатель ---
    function weOnPointer(e) {
      var p = (e.touches && e.touches.length) ? e.touches[0] : e;
      if (!p || typeof p.clientX !== 'number') return;
      var r = canvas.getBoundingClientRect();
      var ecx = r.left + r.width / 2, ecy = r.top + r.height / 2;
      var sx = (window.innerWidth || 360) * 0.5 || 300;
      var sy = (window.innerHeight || 640) * 0.5 || 300;
      tgx = weClamp((p.clientX - ecx) / sx, -1, 1);
      tgy = weClamp((p.clientY - ecy) / sy, -1, 1);
      lastMove = weNow();
    }
    function weOnTap() { weStartBlink(weNow(), true); }

    // --- визуализация ---
    function weDraw(now) {
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, CSS, CSS);
      ctx.globalCompositeOperation = 'source-over';

      var cx = C, cy = C;
      var R = 42;                       // радиус стеклянной сферы
      var eyeR = R * 1.14;              // раскрытие глаза (обрезка сферы)
      var pulse = 0.5 + 0.5 * Math.sin(now * 0.0016);

      // 1) РОВНЫЙ СИММЕТРИЧНЫЙ ОРЕОЛ (радиальный, центр в центре глаза)
      var halo = ctx.createRadialGradient(cx, cy, R * 0.25, cx, cy, R * 2.32);
      halo.addColorStop(0, 'rgba(154,255,0,' + (0.24 + 0.10 * pulse).toFixed(3) + ')');
      halo.addColorStop(0.42, 'rgba(154,255,0,' + (0.11 + 0.05 * pulse).toFixed(3) + ')');
      halo.addColorStop(1, 'rgba(154,255,0,0)');
      ctx.fillStyle = halo;
      ctx.beginPath(); ctx.arc(cx, cy, R * 2.32, 0, 6.2832); ctx.fill();

      // 2) РОВНОЕ КОЛЬЦО-ГАЛО (симметричное, мягко пульсирует)
      var ring = ctx.createRadialGradient(cx, cy, R * 1.30, cx, cy, R * 1.66);
      ring.addColorStop(0, 'rgba(154,255,0,0)');
      ring.addColorStop(0.5, 'rgba(190,255,96,' + (0.42 + 0.30 * pulse).toFixed(3) + ')');
      ring.addColorStop(1, 'rgba(154,255,0,0)');
      ctx.fillStyle = ring;
      ctx.beginPath(); ctx.arc(cx, cy, R * 1.66, 0, 6.2832); ctx.fill();

      // смещение сферы по взгляду (+ параллакс зрачка)
      var ox = gx * R * 0.42, oy = gy * R * 0.42;
      var sx = cx + ox, sy = cy + oy;

      // 3) СТЕКЛЯННАЯ СФЕРА-ЗРАЧОК (обрезана раскрытием глаза)
      ctx.save();
      ctx.beginPath(); ctx.arc(cx, cy, eyeR, 0, 6.2832); ctx.clip();

      // тело сферы: объёмный градиент со светом сверху-слева
      var lx = sx - R * 0.34, ly = sy - R * 0.40;
      var body = ctx.createRadialGradient(lx, ly, R * 0.12, sx, sy, R * 1.06);
      body.addColorStop(0, 'rgba(216,255,150,1)');
      body.addColorStop(0.30, 'rgba(142,232,22,1)');
      body.addColorStop(0.68, 'rgba(58,138,0,1)');
      body.addColorStop(1, 'rgba(14,32,3,1)');
      ctx.fillStyle = body;
      ctx.beginPath(); ctx.arc(sx, sy, R, 0, 6.2832); ctx.fill();

      // внутреннее лаймовое свечение
      ctx.globalCompositeOperation = 'screen';
      var inner = ctx.createRadialGradient(sx, sy, 0, sx, sy, R * 0.92);
      inner.addColorStop(0, 'rgba(154,255,0,0.50)');
      inner.addColorStop(1, 'rgba(154,255,0,0)');
      ctx.fillStyle = inner;
      ctx.beginPath(); ctx.arc(sx, sy, R, 0, 6.2832); ctx.fill();
      ctx.globalCompositeOperation = 'source-over';

      // зрачок (тёмное ядро, лёгкая пульсация-дилатация), с параллаксом
      var pupR = R * 0.34 * (1 + 0.06 * Math.sin(now * 0.002));
      var px = sx + gx * R * 0.14, py = sy + gy * R * 0.14;
      var pup = ctx.createRadialGradient(px, py, 0, px, py, pupR);
      pup.addColorStop(0, 'rgba(2,8,0,1)');
      pup.addColorStop(0.72, 'rgba(4,16,0,1)');
      pup.addColorStop(1, 'rgba(20,60,0,0.15)');
      ctx.fillStyle = pup;
      ctx.beginPath(); ctx.arc(px, py, pupR, 0, 6.2832); ctx.fill();

      // радужка: тонкое лаймовое кольцо вокруг зрачка
      ctx.globalCompositeOperation = 'screen';
      ctx.lineWidth = 2; ctx.strokeStyle = 'rgba(154,255,0,0.35)';
      ctx.beginPath(); ctx.arc(px, py, pupR + 3, 0, 6.2832); ctx.stroke();

      // ХРОМАТИКА/преломление на кромке (имитация)
      ctx.lineWidth = 2.4;
      ctx.strokeStyle = 'rgba(0,200,255,0.28)';
      ctx.beginPath(); ctx.arc(sx + 1.6, sy + 1.6, R * 0.97, 0.35, 2.45); ctx.stroke();
      ctx.strokeStyle = 'rgba(255,0,180,0.22)';
      ctx.beginPath(); ctx.arc(sx - 1.6, sy - 1.6, R * 0.97, 3.35, 5.55); ctx.stroke();

      // нижняя подсветка-полумесяц (back-light)
      ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(210,255,132,0.55)';
      ctx.beginPath(); ctx.arc(sx, sy, R * 0.94, 0.5, 2.1); ctx.stroke();

      // СТЕКЛЯННЫЕ БЛИКИ: мягкий вверху-слева + резкий кэтчлайт
      var hx = sx - R * 0.36, hy = sy - R * 0.42;
      var hi = ctx.createRadialGradient(hx, hy, 0, hx, hy, R * 0.56);
      hi.addColorStop(0, 'rgba(255,255,255,0.90)');
      hi.addColorStop(0.4, 'rgba(232,255,200,0.32)');
      hi.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = hi;
      ctx.save();
      ctx.translate(hx, hy); ctx.rotate(-0.6);
      ctx.beginPath(); ctx.ellipse(0, 0, R * 0.40, R * 0.27, 0, 0, 6.2832); ctx.fill();
      ctx.restore();
      ctx.fillStyle = 'rgba(255,255,255,0.95)';
      ctx.beginPath(); ctx.arc(sx - R * 0.12, sy - R * 0.10, R * 0.08, 0, 6.2832); ctx.fill();
      ctx.globalCompositeOperation = 'source-over';

      ctx.restore(); // снять обрезку глаза

      // 4) ОБОД ГЛАЗА + верхнее веко (бренд-дуга сверху), ровное свечение
      ctx.lineWidth = 3;
      ctx.strokeStyle = 'rgba(154,255,0,0.85)';
      ctx.shadowColor = 'rgba(154,255,0,0.75)'; ctx.shadowBlur = 12;
      ctx.beginPath(); ctx.arc(cx, cy, eyeR, 0, 6.2832); ctx.stroke();
      // верхняя дуга-веко — ярче/толще (знак OKO)
      ctx.lineWidth = 5; ctx.lineCap = 'round';
      ctx.strokeStyle = 'rgba(192,255,98,0.95)';
      ctx.shadowBlur = 16;
      ctx.beginPath(); ctx.arc(cx, cy, eyeR, Math.PI * 1.09, Math.PI * 1.91); ctx.stroke();
      ctx.shadowBlur = 0; ctx.lineCap = 'butt';

      // 5) МОРГАНИЕ: веки сходятся к центру
      if (lid > 0.001) {
        ctx.save();
        var half = eyeR + 2;
        ctx.beginPath(); ctx.arc(cx, cy, half, 0, 6.2832); ctx.clip();
        var topY = (cy - half) + half * lid;      // нижняя кромка верхнего века опускается
        var botY = (cy + half) - half * lid;      // верхняя кромка нижнего века поднимается
        ctx.fillStyle = '#000';
        ctx.fillRect(cx - half - 2, cy - half - 2, half * 2 + 4, (topY - (cy - half)) + 2);
        ctx.fillRect(cx - half - 2, botY, half * 2 + 4, (cy + half) - botY + 2);
        // лаймовые кромки век
        var edgeA = (0.6 * lid + 0.2).toFixed(3);
        ctx.strokeStyle = 'rgba(154,255,0,' + edgeA + ')';
        ctx.lineWidth = 2.5; ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(cx - half * 0.9, topY);
        ctx.quadraticCurveTo(cx, topY + 6 * lid, cx + half * 0.9, topY);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(cx - half * 0.9, botY);
        ctx.quadraticCurveTo(cx, botY - 6 * lid, cx + half * 0.9, botY);
        ctx.stroke();
        ctx.lineCap = 'butt';
        ctx.restore();
      }

      // 6) 3D-параллакс контейнера (CSS)
      canvas.style.transform =
        'translate(-50%,-50%) rotateX(' + (-gy * 7).toFixed(2) + 'deg) rotateY(' + (gx * 9).toFixed(2) + 'deg)';
    }

    // --- цикл ---
    var running = false, raf = 0;

    function weTick(now) {
      if (!running) return;

      // пружинный довод взгляда
      gx += (tgx - gx) * 0.12;
      gy += (tgy - gy) * 0.12;

      // «живой» дрейф взгляда при простое
      if (now - lastMove > 2600) {
        var a = now * 0.0006;
        tgx = Math.cos(a) * 0.55;
        tgy = Math.sin(a * 1.3) * 0.38;
      }

      // машина состояний моргания
      if (blinking) {
        var e = now - blinkT;
        var closeT = blinkDur * 0.4;
        if (e < closeT) lid = weEaseIn(e / closeT);
        else if (e < blinkDur) lid = 1 - weEaseOut((e - closeT) / (blinkDur - closeT));
        else { blinking = false; lid = 0; if (winkExtra) { winkExtra = 0; } weSchedule(now); }
      } else if (now >= nextBlink) {
        weStartBlink(now, false);
      }

      weDraw(now);
      raf = window.requestAnimationFrame(weTick);
    }

    function weVisible() {
      return !auth.classList.contains('hidden') &&
             !document.hidden &&
             auth.offsetWidth > 0;
    }
    function weStart() {
      if (reduce) { weDraw(weNow()); return; }   // статичный кадр
      if (running) return;
      running = true;
      weSchedule(weNow());
      raf = window.requestAnimationFrame(weTick);
    }
    function weStop() {
      running = false;
      if (raf) { window.cancelAnimationFrame(raf); raf = 0; }
    }

    // --- слушатели ---
    if (!reduce) {
      window.addEventListener('pointermove', weOnPointer, { passive: true });
      window.addEventListener('touchmove', weOnPointer, { passive: true });
      auth.addEventListener('pointerdown', weOnTap, { passive: true });
    }
    window.addEventListener('resize', function () {
      weSize();
      if (!running) weDraw(weNow());
    }, { passive: true });
    document.addEventListener('visibilitychange', function () {
      if (weVisible()) weStart(); else weStop();
    });

    // старт/стоп по показу/скрытию экрана входа
    try {
      var mo = new MutationObserver(function () {
        if (weVisible()) weStart(); else weStop();
      });
      mo.observe(auth, { attributes: true, attributeFilter: ['class', 'style'] });
    } catch (e) { /* MutationObserver может отсутствовать — не критично */ }

    // первичный запуск
    if (weVisible()) weStart(); else weDraw(weNow());
  }

  // --- запуск после готовности DOM ---
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', weInit);
  } else {
    weInit();
  }
  // подстраховка на случай позднего появления #authScreen
  window.setTimeout(weInit, 300);
})();
