/* ============================================================================
 * WOW-EYE · РЕАЛЬНЫЙ 3D-глаз OKO (three.js + GLB) на экране входа (#authScreen)
 * ----------------------------------------------------------------------------
 * Порт эталона hero-страницы сайта 1:1 (PMREM RoomEnvironment, ACESFilmic,
 * key/rim/eyeLight, halo-sprite, MeshPhysicalMaterial с emissive/iridescence,
 * frame() со слежением за pointer + idle-дрейф + emissive-пульс).
 *
 *  • three + аддоны грузятся ДИНАМИЧЕСКИ с esm.sh (приложение — один инлайн-файл,
 *    importmap невозможен).
 *  • GLB: '/oko-eye.glb' (тот же домен), фолбэк-URL при 404.
 *  • ГРАЦИОЗНЫЙ ФОЛБЭК: пока/если three или GLB не загрузились (нет сети,
 *    ошибка, таймаут 6с) — работает встроенный красивый canvas-глаз. Приложение
 *    НИКОГДА не остаётся пустым и не падает (весь three-код в try/catch).
 *  • rAF стоп, когда #authScreen скрыт (.hidden) / вкладка неактивна.
 *  • prefers-reduced-motion → статичный кадр, без циклов и слежения.
 * Всё в едином IIFE, префикс we*.
 * ==========================================================================*/
(function () {
  'use strict';
  if (typeof document === 'undefined' || typeof window === 'undefined') return;

  var WRAP_ID = 'we-wrap';
  var CANVAS_ID = 'we-canvas';
  var CSS = 224;                 // размер canvas-фолбэка (CSS px)
  var C = CSS / 2;               // 112
  var GLB_PRIMARY = '/oko-eye.glb';
  var GLB_FALLBACK = 'https://true-journey-418.higgsfield.app/assets/oko-eye.glb';
  var THREE_URL = 'https://esm.sh/three@0.160.0';
  var GLTF_URL = 'https://esm.sh/three@0.160.0/examples/jsm/loaders/GLTFLoader.js';
  var ROOMENV_URL = 'https://esm.sh/three@0.160.0/examples/jsm/environments/RoomEnvironment.js';
  var LOAD_TIMEOUT = 6000;       // мс до срабатывания фолбэка
  var BOX = 236;                 // размер three-контейнера (CSS px), место под halo

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

      weSetup(auth, wrap, canvas, ctx);
    } catch (e) { /* никогда не ломаем приложение */ }
  }

  /* ------------------------------------------------------------------ */
  /* Оркестратор: canvas-фолбэк сразу, апгрейд до three.js при загрузке  */
  /* ------------------------------------------------------------------ */
  function weSetup(auth, wrap, canvas, ctx) {
    var reduceMQ = (window.matchMedia && window.matchMedia('(prefers-reduced-motion:reduce)'));
    var reduce = !!(reduceMQ && reduceMQ.matches);

    function weVisible() {
      return !auth.classList.contains('hidden') &&
             !document.hidden &&
             auth.offsetWidth > 0;
    }

    var fb = weMake2D(auth, canvas, ctx, reduce);   // контроллер-фолбэк
    var three = null;                               // контроллер three (позже)
    var current = fb;

    function start() { if (current && current.start) current.start(); }
    function stop() { if (fb && fb.stop) fb.stop(); if (three && three.stop) three.stop(); }

    // единые слушатели показа/скрытия экрана входа
    window.addEventListener('resize', function () {
      if (fb && fb.resize) fb.resize();
      if (three && three.resize) three.resize();
      if (current && current.redrawIfIdle) current.redrawIfIdle();
    }, { passive: true });

    document.addEventListener('visibilitychange', function () {
      if (weVisible()) start(); else stop();
    });

    try {
      var mo = new MutationObserver(function () {
        if (weVisible()) start(); else stop();
      });
      mo.observe(auth, { attributes: true, attributeFilter: ['class', 'style'] });
    } catch (e) { /* MutationObserver необязателен */ }

    // первичный запуск фолбэка
    if (weVisible()) start(); else if (current.drawStatic) current.drawStatic();

    // апгрейд до реального 3D-глаза
    weTryThree(auth, wrap, reduce, weVisible).then(function (threeCtl) {
      if (!threeCtl) return; // остаёмся на фолбэке
      three = threeCtl;
      if (fb && fb.stop) fb.stop();
      canvas.style.display = 'none';   // прячем 2D-глаз
      current = three;
      if (weVisible()) three.start(); else if (three.drawStatic) three.drawStatic();
    }).catch(function () { /* фолбэк уже работает */ });
  }

  /* ================================================================== */
  /*  THREE.JS · порт эталона hero-глаза                                 */
  /* ================================================================== */
  function weTryThree(auth, wrap, reduce, visibleFn) {
    return new Promise(function (resolve) {
      var settled = false;
      var timer = window.setTimeout(function () {
        if (!settled) { settled = true; resolve(null); }   // таймаут → фолбэк
      }, LOAD_TIMEOUT);

      // dynamic import допустим в classic-скрипте; всё под try/catch
      Promise.all([
        import(THREE_URL),
        import(GLTF_URL),
        import(ROOMENV_URL)
      ]).then(function (mods) {
        if (settled) return;
        try {
          var THREE = mods[0];
          if (!THREE.WebGLRenderer && THREE.default) THREE = THREE.default;
          var GLTFLoader = mods[1].GLTFLoader;
          var RoomEnvironment = mods[2].RoomEnvironment;
          if (!THREE || !THREE.WebGLRenderer || !GLTFLoader || !RoomEnvironment) {
            throw new Error('three exports missing');
          }
          weBuildThree(THREE, GLTFLoader, RoomEnvironment, auth, wrap, reduce, visibleFn,
            function (ctl) {
              if (settled) { if (ctl && ctl.dispose) ctl.dispose(); return; }
              settled = true; window.clearTimeout(timer); resolve(ctl);
            },
            function () { // ошибка GLB
              if (settled) return;
              settled = true; window.clearTimeout(timer); resolve(null);
            });
        } catch (e) {
          if (!settled) { settled = true; window.clearTimeout(timer); resolve(null); }
        }
      }).catch(function () {
        if (!settled) { settled = true; window.clearTimeout(timer); resolve(null); }
      });
    });
  }

  function weBuildThree(THREE, GLTFLoader, RoomEnvironment, auth, wrap, reduce, visibleFn, onReady, onFail) {
    var renderer, scene, camera, pmrem, eyeLight, halo, eye = null;
    var eyeGroup, eyeMats = [];
    var eyeW0 = 1.9, eyeH0 = 1.32;
    var DIST = 16, FOV = 24;
    var target = { scale: 1, x: 0, y: 0 };
    var pointer, pulse = 0, lastMove = -99, released = true;
    var clock, running = false, raf = 0, disposed = false;

    try {
      var dpr = Math.min(window.devicePixelRatio || 1, 2.5);
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
      renderer.setPixelRatio(dpr);
      renderer.setSize(BOX, BOX);
      renderer.setClearColor(0x000000, 0);
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      renderer.toneMappingExposure = 0.98;
      if ('outputColorSpace' in renderer) renderer.outputColorSpace = THREE.SRGBColorSpace;

      var el = renderer.domElement;
      el.id = 'we-gl';
      el.style.position = 'absolute';
      el.style.left = '50%';
      el.style.top = '50%';
      el.style.width = BOX + 'px';
      el.style.height = BOX + 'px';
      el.style.transform = 'translate(-50%,-50%)';
      el.style.pointerEvents = 'none';
      wrap.appendChild(el);

      scene = new THREE.Scene();
      camera = new THREE.PerspectiveCamera(FOV, 1, 0.1, 100);
      camera.position.set(0, 0, DIST);

      pmrem = new THREE.PMREMGenerator(renderer);
      scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.03).texture;
      scene.add(new THREE.AmbientLight(0x556655, 0.7));
      var key = new THREE.DirectionalLight(0xecfff0, 1.0); key.position.set(4, 6, 6); scene.add(key);
      var rim = new THREE.DirectionalLight(0x22DD00, 0.55); rim.position.set(-4, -2, 3); scene.add(rim);
      eyeLight = new THREE.PointLight(0xd6ffcf, 4.5, 24, 2); scene.add(eyeLight);

      // halo-sprite (ровное симметричное свечение — как в эталоне)
      var haloTex = (function () {
        var cv = document.createElement('canvas'); cv.width = cv.height = 256;
        var g = cv.getContext('2d');
        var rg = g.createRadialGradient(128, 128, 0, 128, 128, 128);
        rg.addColorStop(0, 'rgba(60,230,20,.8)');
        rg.addColorStop(.35, 'rgba(34,221,0,.4)');
        rg.addColorStop(1, 'rgba(34,221,0,0)');
        g.fillStyle = rg; g.fillRect(0, 0, 256, 256);
        return new THREE.CanvasTexture(cv);
      })();
      halo = new THREE.Sprite(new THREE.SpriteMaterial({
        map: haloTex, color: 0x22DD00, blending: THREE.AdditiveBlending,
        transparent: true, opacity: .38, depthWrite: false, depthTest: false
      }));

      eyeGroup = new THREE.Group(); scene.add(eyeGroup);
      pointer = new THREE.Vector2(0, 0);
      clock = new THREE.Clock();
    } catch (e) {
      try { if (renderer) renderer.dispose(); } catch (e2) {}
      onFail(); return;
    }

    function viewSize() {
      var vH = 2 * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * DIST;
      return { vW: vH * camera.aspect, vH: vH };
    }
    function layout() {
      var vs = viewSize();
      var maxW = vs.vW * 0.46, maxH = vs.vH * 0.46;   // центрируем, оставляя место под halo
      target = { scale: Math.min(maxW / eyeW0, maxH / eyeH0), x: 0, y: 0 };
    }

    function doResize() {
      if (disposed) return;
      try {
        var d = Math.min(window.devicePixelRatio || 1, 2.5);
        renderer.setPixelRatio(d);
        renderer.setSize(BOX, BOX);
        camera.aspect = 1; camera.updateProjectionMatrix();
        layout();
      } catch (e) {}
    }

    // указатель (глобально по всему окну — как в эталоне)
    function setPtr(e) {
      var p = (e.touches && e.touches.length) ? e.touches[0] : e;
      if (!p || typeof p.clientX !== 'number') return;
      pointer.x = (p.clientX / (window.innerWidth || 1)) * 2 - 1;
      pointer.y = -(p.clientY / (window.innerHeight || 1)) * 2 + 1;
      lastMove = clock.getElapsedTime();
      released = false;
    }
    if (!reduce) {
      window.addEventListener('pointermove', setPtr, { passive: true });
      window.addEventListener('touchmove', setPtr, { passive: true });
      window.addEventListener('pointerdown', function (e) { setPtr(e); pulse = 1; }, { passive: true });
      window.addEventListener('pointerup', function () { released = true; }, { passive: true });
      window.addEventListener('pointercancel', function () { released = true; }, { passive: true });
      window.addEventListener('pointerleave', function () { released = true; }, { passive: true });
      window.addEventListener('blur', function () { released = true; });
    }

    function renderOnce() {
      if (disposed) return;
      var t = clock.getElapsedTime();
      if (eye) {
        var br = 1 + Math.sin(t * 0.9) * 0.03;
        eyeGroup.scale.lerp(new THREE.Vector3(target.scale * br, target.scale * br, target.scale * br), 0.1);
        eyeGroup.position.x += (target.x - eyeGroup.position.x) * 0.1;
        eyeGroup.position.y += ((target.y + Math.sin(t * 0.8) * 0.12) - eyeGroup.position.y) * 0.1;
        var idle = released || (t - lastMove > 1.1);
        var lx = idle ? 0 : pointer.x, ly = idle ? 0 : pointer.y;
        eyeGroup.rotation.y += (lx * 0.46 - eyeGroup.rotation.y) * 0.06;
        eyeGroup.rotation.x += (-ly * 0.36 + Math.sin(t * 0.6) * 0.012 - eyeGroup.rotation.x) * 0.06;
        eyeGroup.rotation.z += (0 - eyeGroup.rotation.z) * 0.05;
        eyeLight.position.set(
          eyeGroup.position.x + Math.cos(t * 0.55) * 3.2,
          eyeGroup.position.y + Math.sin(t * 0.5) * 2.2 + 0.6, 4.2);
        halo.material.opacity += ((0.5 + pulse * 0.5) - halo.material.opacity) * 0.1;
        for (var i = 0; i < eyeMats.length; i++) {
          eyeMats[i].emissiveIntensity = 0.5 + Math.sin(t * 1.4) * 0.1 + pulse * 0.35;
        }
      }
      renderer.render(scene, camera);
    }

    function frame() {
      if (!running || disposed) return;
      pulse *= 0.92;
      renderOnce();
      raf = window.requestAnimationFrame(frame);
    }

    function start() {
      if (disposed || running) return;
      if (reduce) { renderOnce(); return; }      // статичный кадр
      running = true;
      raf = window.requestAnimationFrame(frame);
    }
    function stop() {
      running = false;
      if (raf) { window.cancelAnimationFrame(raf); raf = 0; }
    }
    function drawStatic() { renderOnce(); }
    function dispose() {
      disposed = true; stop();
      try { renderer.dispose(); } catch (e) {}
      try { if (pmrem) pmrem.dispose(); } catch (e) {}
      try {
        if (renderer && renderer.domElement && renderer.domElement.parentNode) {
          renderer.domElement.parentNode.removeChild(renderer.domElement);
        }
      } catch (e) {}
    }

    window.addEventListener('resize', doResize, { passive: true });

    // ---- загрузка GLB с фолбэком URL ----
    function applyEye(gltf) {
      try {
        eye = gltf.scene;
        var box = new THREE.Box3().setFromObject(eye);
        var size = box.getSize(new THREE.Vector3());
        var cen = box.getCenter(new THREE.Vector3());
        eye.position.sub(cen);
        eyeW0 = size.x || 1.9; eyeH0 = size.y || 1.32;
        eye.traverse(function (n) {
          if (n.isMesh) {
            var old = n.material || {};
            var m = new THREE.MeshPhysicalMaterial({
              map: old.map || null, color: 0x0c110c, roughness: 0.09, metalness: 0.0,
              clearcoat: 1.0, clearcoatRoughness: 0.04, envMapIntensity: 2.2, ior: 1.5,
              emissive: 0x22DD00, emissiveMap: old.map || null, emissiveIntensity: 0.55,
              iridescence: 0.3, iridescenceIOR: 1.3, iridescenceThicknessRange: [220, 540]
            });
            n.material = m; eyeMats.push(m);
          }
        });
        halo.position.set(0, 0, -0.25); halo.scale.set(3.6, 3.6, 1); eyeGroup.add(halo);
        eyeGroup.add(eye);
        layout();
        onReady({
          start: start, stop: stop, resize: doResize, drawStatic: drawStatic, dispose: dispose,
          redrawIfIdle: function () { if (!running) drawStatic(); }
        });
      } catch (e) { onFail(); dispose(); }
    }

    try {
      var loader = new GLTFLoader();
      loader.load(GLB_PRIMARY, applyEye, undefined, function () {
        // 404/ошибка первого URL → пробуем фолбэк-URL
        try {
          loader.load(GLB_FALLBACK, applyEye, undefined, function () { onFail(); dispose(); });
        } catch (e) { onFail(); dispose(); }
      });
    } catch (e) { onFail(); dispose(); }
  }

  /* ================================================================== */
  /*  CANVAS-ФОЛБЭК · красивый стеклянный глаз (если three/GLB недоступны) */
  /* ================================================================== */
  function weMake2D(auth, canvas, ctx, reduce) {
    var dpr = 1;
    function size() {
      dpr = Math.min(window.devicePixelRatio || 1, 2.5);
      canvas.width = Math.round(CSS * dpr);
      canvas.height = Math.round(CSS * dpr);
    }
    size();

    var gx = 0, gy = 0, tgx = 0, tgy = 0, lid = 0;
    var lastMove = -99999;
    var blinking = false, blinkT = 0, blinkDur = 170, nextBlink = 0;
    var running = false, raf = 0;

    function schedule(now) { nextBlink = now + 3000 + Math.random() * 3000; }
    function startBlink(now, wink) { if (blinking) return; blinking = true; blinkT = now; blinkDur = wink ? 240 : 170; }

    function onPointer(e) {
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
    function onTap() { startBlink(weNow(), true); }

    if (!reduce) {
      window.addEventListener('pointermove', onPointer, { passive: true });
      window.addEventListener('touchmove', onPointer, { passive: true });
      auth.addEventListener('pointerdown', onTap, { passive: true });
    }

    function draw(now) {
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, CSS, CSS);
      ctx.globalCompositeOperation = 'source-over';

      var cx = C, cy = C, R = 42, eyeR = R * 1.14;
      var pulse = 0.5 + 0.5 * Math.sin(now * 0.0016);

      var halo = ctx.createRadialGradient(cx, cy, R * 0.25, cx, cy, R * 2.32);
      halo.addColorStop(0, 'rgba(154,255,0,' + (0.24 + 0.10 * pulse).toFixed(3) + ')');
      halo.addColorStop(0.42, 'rgba(154,255,0,' + (0.11 + 0.05 * pulse).toFixed(3) + ')');
      halo.addColorStop(1, 'rgba(154,255,0,0)');
      ctx.fillStyle = halo;
      ctx.beginPath(); ctx.arc(cx, cy, R * 2.32, 0, 6.2832); ctx.fill();

      var ring = ctx.createRadialGradient(cx, cy, R * 1.30, cx, cy, R * 1.66);
      ring.addColorStop(0, 'rgba(154,255,0,0)');
      ring.addColorStop(0.5, 'rgba(190,255,96,' + (0.42 + 0.30 * pulse).toFixed(3) + ')');
      ring.addColorStop(1, 'rgba(154,255,0,0)');
      ctx.fillStyle = ring;
      ctx.beginPath(); ctx.arc(cx, cy, R * 1.66, 0, 6.2832); ctx.fill();

      var ox = gx * R * 0.42, oy = gy * R * 0.42;
      var sx = cx + ox, sy = cy + oy;

      ctx.save();
      ctx.beginPath(); ctx.arc(cx, cy, eyeR, 0, 6.2832); ctx.clip();

      var lx = sx - R * 0.34, ly = sy - R * 0.40;
      var body = ctx.createRadialGradient(lx, ly, R * 0.12, sx, sy, R * 1.06);
      body.addColorStop(0, 'rgba(216,255,150,1)');
      body.addColorStop(0.30, 'rgba(142,232,22,1)');
      body.addColorStop(0.68, 'rgba(58,138,0,1)');
      body.addColorStop(1, 'rgba(14,32,3,1)');
      ctx.fillStyle = body;
      ctx.beginPath(); ctx.arc(sx, sy, R, 0, 6.2832); ctx.fill();

      ctx.globalCompositeOperation = 'screen';
      var inner = ctx.createRadialGradient(sx, sy, 0, sx, sy, R * 0.92);
      inner.addColorStop(0, 'rgba(154,255,0,0.50)');
      inner.addColorStop(1, 'rgba(154,255,0,0)');
      ctx.fillStyle = inner;
      ctx.beginPath(); ctx.arc(sx, sy, R, 0, 6.2832); ctx.fill();
      ctx.globalCompositeOperation = 'source-over';

      var pupR = R * 0.34 * (1 + 0.06 * Math.sin(now * 0.002));
      var px = sx + gx * R * 0.14, py = sy + gy * R * 0.14;
      var pup = ctx.createRadialGradient(px, py, 0, px, py, pupR);
      pup.addColorStop(0, 'rgba(2,8,0,1)');
      pup.addColorStop(0.72, 'rgba(4,16,0,1)');
      pup.addColorStop(1, 'rgba(20,60,0,0.15)');
      ctx.fillStyle = pup;
      ctx.beginPath(); ctx.arc(px, py, pupR, 0, 6.2832); ctx.fill();

      ctx.globalCompositeOperation = 'screen';
      ctx.lineWidth = 2; ctx.strokeStyle = 'rgba(154,255,0,0.35)';
      ctx.beginPath(); ctx.arc(px, py, pupR + 3, 0, 6.2832); ctx.stroke();
      ctx.lineWidth = 2.4;
      ctx.strokeStyle = 'rgba(0,200,255,0.28)';
      ctx.beginPath(); ctx.arc(sx + 1.6, sy + 1.6, R * 0.97, 0.35, 2.45); ctx.stroke();
      ctx.strokeStyle = 'rgba(255,0,180,0.22)';
      ctx.beginPath(); ctx.arc(sx - 1.6, sy - 1.6, R * 0.97, 3.35, 5.55); ctx.stroke();
      ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(210,255,132,0.55)';
      ctx.beginPath(); ctx.arc(sx, sy, R * 0.94, 0.5, 2.1); ctx.stroke();

      var hx = sx - R * 0.36, hy = sy - R * 0.42;
      var hi = ctx.createRadialGradient(hx, hy, 0, hx, hy, R * 0.56);
      hi.addColorStop(0, 'rgba(255,255,255,0.90)');
      hi.addColorStop(0.4, 'rgba(232,255,200,0.32)');
      hi.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = hi;
      ctx.save(); ctx.translate(hx, hy); ctx.rotate(-0.6);
      ctx.beginPath(); ctx.ellipse(0, 0, R * 0.40, R * 0.27, 0, 0, 6.2832); ctx.fill();
      ctx.restore();
      ctx.fillStyle = 'rgba(255,255,255,0.95)';
      ctx.beginPath(); ctx.arc(sx - R * 0.12, sy - R * 0.10, R * 0.08, 0, 6.2832); ctx.fill();
      ctx.globalCompositeOperation = 'source-over';
      ctx.restore();

      ctx.lineWidth = 3;
      ctx.strokeStyle = 'rgba(154,255,0,0.85)';
      ctx.shadowColor = 'rgba(154,255,0,0.75)'; ctx.shadowBlur = 12;
      ctx.beginPath(); ctx.arc(cx, cy, eyeR, 0, 6.2832); ctx.stroke();
      ctx.lineWidth = 5; ctx.lineCap = 'round';
      ctx.strokeStyle = 'rgba(192,255,98,0.95)';
      ctx.shadowBlur = 16;
      ctx.beginPath(); ctx.arc(cx, cy, eyeR, Math.PI * 1.09, Math.PI * 1.91); ctx.stroke();
      ctx.shadowBlur = 0; ctx.lineCap = 'butt';

      if (lid > 0.001) {
        ctx.save();
        var half = eyeR + 2;
        ctx.beginPath(); ctx.arc(cx, cy, half, 0, 6.2832); ctx.clip();
        var topY = (cy - half) + half * lid;
        var botY = (cy + half) - half * lid;
        ctx.fillStyle = '#000';
        ctx.fillRect(cx - half - 2, cy - half - 2, half * 2 + 4, (topY - (cy - half)) + 2);
        ctx.fillRect(cx - half - 2, botY, half * 2 + 4, (cy + half) - botY + 2);
        var edgeA = (0.6 * lid + 0.2).toFixed(3);
        ctx.strokeStyle = 'rgba(154,255,0,' + edgeA + ')';
        ctx.lineWidth = 2.5; ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo(cx - half * 0.9, topY);
        ctx.quadraticCurveTo(cx, topY + 6 * lid, cx + half * 0.9, topY); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(cx - half * 0.9, botY);
        ctx.quadraticCurveTo(cx, botY - 6 * lid, cx + half * 0.9, botY); ctx.stroke();
        ctx.lineCap = 'butt';
        ctx.restore();
      }

      canvas.style.transform =
        'translate(-50%,-50%) rotateX(' + (-gy * 7).toFixed(2) + 'deg) rotateY(' + (gx * 9).toFixed(2) + 'deg)';
    }

    function tick(now) {
      if (!running) return;
      gx += (tgx - gx) * 0.12; gy += (tgy - gy) * 0.12;
      if (now - lastMove > 2600) {
        var a = now * 0.0006; tgx = Math.cos(a) * 0.55; tgy = Math.sin(a * 1.3) * 0.38;
      }
      if (blinking) {
        var e = now - blinkT, closeT = blinkDur * 0.4;
        if (e < closeT) lid = weEaseIn(e / closeT);
        else if (e < blinkDur) lid = 1 - weEaseOut((e - closeT) / (blinkDur - closeT));
        else { blinking = false; lid = 0; schedule(now); }
      } else if (now >= nextBlink) { startBlink(now, false); }
      draw(now);
      raf = window.requestAnimationFrame(tick);
    }

    function start() {
      if (reduce) { draw(weNow()); return; }
      if (running) return;
      running = true; schedule(weNow());
      raf = window.requestAnimationFrame(tick);
    }
    function stop() { running = false; if (raf) { window.cancelAnimationFrame(raf); raf = 0; } }

    return {
      start: start, stop: stop,
      drawStatic: function () { draw(weNow()); },
      resize: function () { size(); },
      redrawIfIdle: function () { if (!running) draw(weNow()); }
    };
  }

  /* --- запуск после готовности DOM --- */
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', weInit);
  } else {
    weInit();
  }
  window.setTimeout(weInit, 300);   // подстраховка на позднее появление #authScreen
})();
