/* ═══════════════════════════════════════════════════════════════
   PandaGo Cargo · 3D-фон hero-секции
   Медленное поле каркасных контейнеров, точки-координаты и дуги
   маршрута в холодной синей палитре. Three.js через CDN.

   Бюджет: лёгкая геометрия без текстур, DPR не выше 2 на десктопе
   и 1 на мобильных, пауза при скрытой вкладке, 30fps на слабых
   устройствах. При prefers-reduced-motion модуль вообще не
   загружается (см. app.js), остаётся статичный градиент.
   ═══════════════════════════════════════════════════════════════ */

import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js';

const COL = {
  bg:       0x081833,
  electric: 0x1A6BE0,
  cyan:     0x3B9EFF,
  soft:     0xA8D0FF,
  royal:    0x1A3A7A,
};

export function initScene(container) {
  const isMobile = window.innerWidth < 768 ||
    (navigator.hardwareConcurrency && navigator.hardwareConcurrency <= 4);

  const renderer = new THREE.WebGLRenderer({
    antialias: !isMobile,
    alpha: true,
    powerPreference: 'low-power',
  });
  renderer.setPixelRatio(isMobile ? 1 : Math.min(window.devicePixelRatio, 2));
  renderer.setSize(container.clientWidth, container.clientHeight);
  container.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog(COL.bg, 26, 78);

  const camera = new THREE.PerspectiveCamera(
    50, container.clientWidth / container.clientHeight, 0.1, 120
  );
  camera.position.set(0, 2.5, 30);

  /* ── Поле контейнеров: каркасные боксы разного вытяжения ── */
  const containers = new THREE.Group();
  const boxCount = isMobile ? 16 : 34;
  const edgeMatFar  = new THREE.LineBasicMaterial({ color: COL.royal, transparent: true, opacity: 0.55 });
  const edgeMatNear = new THREE.LineBasicMaterial({ color: COL.electric, transparent: true, opacity: 0.8 });
  const edgeMatHot  = new THREE.LineBasicMaterial({ color: COL.cyan, transparent: true, opacity: 0.9 });

  /* Детерминированный псевдослучайный ряд, чтобы сцена всегда собиралась одинаково */
  let seed = 20260705;
  const rnd = () => {
    seed = (seed * 1664525 + 1013904223) % 4294967296;
    return seed / 4294967296;
  };

  const boxGeoms = [];
  for (let i = 0; i < boxCount; i++) {
    const w = 1.6 + rnd() * 2.6;
    const h = 1.0 + rnd() * 1.2;
    const d = 1.0 + rnd() * 1.4;
    const geo = new THREE.BoxGeometry(w, h, d);
    const edges = new THREE.EdgesGeometry(geo);
    boxGeoms.push(geo, edges);
    const pick = rnd();
    const mat = pick > 0.82 ? edgeMatHot : (pick > 0.45 ? edgeMatNear : edgeMatFar);
    const box = new THREE.LineSegments(edges, mat);
    box.position.set(
      (rnd() - 0.5) * 56,
      (rnd() - 0.5) * 22,
      -8 - rnd() * 46
    );
    box.rotation.set(rnd() * 0.3, rnd() * Math.PI, 0);
    box.userData = {
      vx: 0.14 + rnd() * 0.3,
      ry: (rnd() - 0.5) * 0.1,
      bob: rnd() * Math.PI * 2,
    };
    containers.add(box);
  }
  scene.add(containers);

  /* ── Точки-координаты: разреженное звёздное поле данных ── */
  const ptCount = isMobile ? 220 : 520;
  const ptPos = new Float32Array(ptCount * 3);
  for (let i = 0; i < ptCount; i++) {
    ptPos[i * 3]     = (rnd() - 0.5) * 90;
    ptPos[i * 3 + 1] = (rnd() - 0.5) * 46;
    ptPos[i * 3 + 2] = -4 - rnd() * 70;
  }
  const ptGeo = new THREE.BufferGeometry();
  ptGeo.setAttribute('position', new THREE.BufferAttribute(ptPos, 3));
  const ptMat = new THREE.PointsMaterial({
    color: COL.soft,
    size: 0.09,
    transparent: true,
    opacity: 0.6,
    sizeAttenuation: true,
  });
  const points = new THREE.Points(ptGeo, ptMat);
  scene.add(points);

  /* ── Дуги маршрута: три светящиеся кривые через сцену ── */
  const arcs = new THREE.Group();
  const arcSpecs = [
    { from: [-30, -7, -30], mid: [-4, 9, -26], to: [26, 4, -18], c: COL.cyan },
    { from: [-26, 2, -44],  mid: [2, 13, -38], to: [30, 8, -30], c: COL.electric },
    { from: [-34, -3, -18], mid: [-6, 6, -14], to: [22, 1, -8],  c: COL.royal },
  ];
  for (const s of arcSpecs) {
    const curve = new THREE.QuadraticBezierCurve3(
      new THREE.Vector3(...s.from),
      new THREE.Vector3(...s.mid),
      new THREE.Vector3(...s.to)
    );
    const geo = new THREE.BufferGeometry().setFromPoints(curve.getPoints(60));
    const mat = new THREE.LineDashedMaterial({
      color: s.c,
      transparent: true,
      opacity: 0.5,
      dashSize: 0.9,
      gapSize: 0.7,
    });
    const line = new THREE.Line(geo, mat);
    line.computeLineDistances();
    arcs.add(line);
    boxGeoms.push(geo);
  }
  scene.add(arcs);

  /* ── Взаимодействие: лёгкий параллакс от указателя ── */
  const pointer = { x: 0, y: 0 };
  const onMove = (e) => {
    const t = e.touches ? e.touches[0] : e;
    pointer.x = (t.clientX / window.innerWidth - 0.5) * 2;
    pointer.y = (t.clientY / window.innerHeight - 0.5) * 2;
  };
  if (!isMobile) window.addEventListener('pointermove', onMove, { passive: true });

  /* ── Ресайз ── */
  const onResize = () => {
    const w = container.clientWidth;
    const h = container.clientHeight;
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h);
  };
  window.addEventListener('resize', onResize, { passive: true });

  /* ── Пауза, когда вкладка скрыта или hero вне экрана ── */
  let running = true;
  let inView = true;
  document.addEventListener('visibilitychange', () => {
    running = document.visibilityState === 'visible';
  });
  const io = new IntersectionObserver((entries) => {
    inView = entries[0].isIntersecting;
  }, { threshold: 0 });
  io.observe(container);

  /* ── Цикл: 60fps на десктопе, 30fps на мобильных ── */
  const frameGap = isMobile ? 1000 / 30 : 0;
  let last = 0;
  let t = 0;

  function frame(now) {
    requestAnimationFrame(frame);
    if (!running || !inView) { last = now; return; }
    if (frameGap && now - last < frameGap) return;
    const dt = Math.min((now - last) / 1000 || 0.016, 0.05);
    last = now;
    t += dt;

    /* дрейф контейнеров слева направо, как поток груза */
    for (const box of containers.children) {
      box.position.x += box.userData.vx * dt;
      box.rotation.y += box.userData.ry * dt;
      box.position.y += Math.sin(t * 0.6 + box.userData.bob) * 0.0018;
      if (box.position.x > 32) box.position.x = -32;
    }

    /* дыхание пунктира дуг: пульс масштаба штриха и лёгкое покачивание группы */
    for (const line of arcs.children) {
      line.material.scale = 1 + Math.sin(t * 0.9) * 0.15;
    }
    arcs.rotation.y = Math.sin(t * 0.05) * 0.04;

    points.rotation.y = t * 0.008;

    /* медленный орбитальный дрейф камеры + параллакс */
    const camX = Math.sin(t * 0.05) * 1.6 + pointer.x * 1.4;
    const camY = 2.5 + Math.cos(t * 0.04) * 0.8 - pointer.y * 1.0;
    camera.position.x += (camX - camera.position.x) * 0.03;
    camera.position.y += (camY - camera.position.y) * 0.03;
    camera.lookAt(0, 1.5, -20);

    renderer.render(scene, camera);
  }
  requestAnimationFrame(frame);

  /* ── Уборка (на случай SPA-переходов в будущем) ── */
  return () => {
    io.disconnect();
    window.removeEventListener('resize', onResize);
    if (!isMobile) window.removeEventListener('pointermove', onMove);
    for (const g of boxGeoms) g.dispose();
    ptGeo.dispose();
    ptMat.dispose();
    edgeMatFar.dispose();
    edgeMatNear.dispose();
    edgeMatHot.dispose();
    renderer.dispose();
    renderer.domElement.remove();
  };
}
