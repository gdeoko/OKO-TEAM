/* ============================================================================
   OKO · ЖИВОЙ 3D-ЗНАК (тот же глаз, что в КП okoteam.top/kp)
   ES-модуль. Грузится лениво — только когда нужен экран запуска или входа.

   Материал, свет и тон-маппинг повторяют KP/js/holo.js один в один:
   MeshStandardMaterial поверх PMREM-окружения RoomEnvironment + ACES.
   Никакого ручного рисования знака — только мастер-модель oko-eye.glb.

   Публичный API:
     mountEye(container, opts) -> Promise<{ dispose, setIntensity }>
       container — DOM-узел, в который встраивается canvas (растягивается на 100%)
       opts.size        логический размер сцены в px (по умолчанию по контейнеру)
       opts.parallax    реакция на палец/гироскоп, 0..1 (по умолчанию 1)
       opts.spin        постоянное вращение, рад/с (по умолчанию 0.18)
       opts.onReady     колбэк, когда первый кадр отрисован
   ============================================================================ */
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

const GLB_URL = 'oko-eye.glb';

export async function mountEye(container, opts = {}) {
  if (!container) throw new Error('no container');

  const parallaxAmount = opts.parallax == null ? 1 : opts.parallax;
  const spin           = opts.spin == null ? 0.18 : opts.spin;

  /* ---------- renderer ---------- */
  const canvas = document.createElement('canvas');
  canvas.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;display:block;opacity:0;transition:opacity .55s ease';
  container.appendChild(canvas);

  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true, powerPreference: 'high-performance' });
  } catch (e) {
    canvas.remove();
    throw e;
  }

  /* На слабых телефонах не разгоняем pixelRatio — иначе просадка на старте. */
  const weak = (navigator.hardwareConcurrency || 4) <= 4 && matchMedia('(pointer:coarse)').matches;
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, weak ? 1.5 : 2));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.12;

  const scene = new THREE.Scene();
  const cam = new THREE.PerspectiveCamera(32, 1, 0.1, 100);
  cam.position.set(0, 0, 3.35);

  /* ---------- свет: ключ + заливка бренда + лаймовый контровой ---------- */
  scene.add(new THREE.AmbientLight(0xffffff, 1.25));
  const key = new THREE.DirectionalLight(0xffffff, 2.0);
  key.position.set(2, 3, 5);
  scene.add(key);
  const fill = new THREE.DirectionalLight(0xBFFF6A, 0.85);
  fill.position.set(-3, -1, 2);
  scene.add(fill);
  const rim = new THREE.PointLight(0x9AFF00, 2.2, 40);
  rim.position.set(-2.2, -0.6, 2.6);
  scene.add(rim);

  /* ---------- глянцевое окружение для отражений ---------- */
  let envTex = null;
  try {
    const pm = new THREE.PMREMGenerator(renderer);
    envTex = pm.fromScene(new RoomEnvironment(), 0.04).texture;
  } catch (e) { /* без отражений тоже смотрится нормально */ }

  /* ---------- модель ---------- */
  const root = new THREE.Group();
  scene.add(root);

  const gltf = await new Promise((res, rej) => {
    new GLTFLoader().load(GLB_URL, res, undefined, rej);
  });

  const eye = gltf.scene;
  eye.traverse(o => {
    if (!o.isMesh || !o.material) return;
    /* Тот же материал, что на КП: чистая гладкая поверхность без normalMap —
       она давала царапины и вмятины на радужке. */
    o.material = new THREE.MeshStandardMaterial({
      color: new THREE.Color(0x58A300),
      emissive: new THREE.Color(0x123000),
      emissiveIntensity: 0.30,
      metalness: 0.55,
      roughness: 0.22,
      envMap: envTex,
      envMapIntensity: 1.15,
      side: THREE.DoubleSide
    });
    o.material.toneMapped = true;
    o.material.needsUpdate = true;
    if (o.geometry) { try { o.geometry.computeVertexNormals(); } catch (e) {} }
  });

  /* Центрируем и нормируем в единичный размер — модель занимает кадр целиком,
     знак НЕ обрезается ни по одной стороне (правка Даниэля: «узкое лого»). */
  const box = new THREE.Box3().setFromObject(eye);
  const center = box.getCenter(new THREE.Vector3());
  const size = box.getSize(new THREE.Vector3());
  const maxAxis = Math.max(size.x, size.y, size.z) || 1;
  eye.position.sub(center);
  eye.scale.setScalar(1.55 / maxAxis);
  root.add(eye);

  /* ---------- параллакс от пальца и гироскопа ---------- */
  const ptr = { x: 0, y: 0, tx: 0, ty: 0 };
  const onPointer = e => {
    ptr.tx = (e.clientX / innerWidth - 0.5) * 2;
    ptr.ty = (e.clientY / innerHeight - 0.5) * 2;
  };
  const onTouch = e => {
    const t = e.touches && e.touches[0];
    if (!t) return;
    ptr.tx = (t.clientX / innerWidth - 0.5) * 2;
    ptr.ty = (t.clientY / innerHeight - 0.5) * 2;
  };
  const onGyro = e => {
    if (e.gamma == null) return;
    ptr.tx = Math.max(-1, Math.min(1, e.gamma / 40));
    ptr.ty = Math.max(-1, Math.min(1, (e.beta - 42) / 40));
  };
  if (parallaxAmount > 0) {
    addEventListener('pointermove', onPointer, { passive: true });
    addEventListener('touchmove', onTouch, { passive: true });
    addEventListener('deviceorientation', onGyro, true);
  }

  /* ---------- размер ---------- */
  function resize() {
    const r = container.getBoundingClientRect();
    const w = Math.max(1, Math.round(r.width));
    const h = Math.max(1, Math.round(r.height));
    renderer.setSize(w, h, false);
    cam.aspect = w / h;
    cam.updateProjectionMatrix();
  }
  resize();
  const ro = ('ResizeObserver' in window) ? new ResizeObserver(resize) : null;
  if (ro) ro.observe(container); else addEventListener('resize', resize);

  /* ---------- цикл ---------- */
  const clock = new THREE.Clock();
  let raf = 0, alive = true, firstFrame = true, intensity = 1;

  function frame() {
    if (!alive) return;
    raf = requestAnimationFrame(frame);
    const dt = Math.min(clock.getDelta(), 0.05);
    const t = clock.getElapsedTime();

    /* плавное догоняние указателя — без рывков */
    ptr.x += (ptr.tx - ptr.x) * Math.min(1, dt * 4.5);
    ptr.y += (ptr.ty - ptr.y) * Math.min(1, dt * 4.5);

    /* знак смотрит на палец + мягко дышит + медленно вращается */
    root.rotation.y = spin * t + ptr.x * 0.42 * parallaxAmount;
    root.rotation.x = -ptr.y * 0.28 * parallaxAmount + Math.sin(t * 0.7) * 0.035;
    root.position.y = Math.sin(t * 0.9) * 0.035;

    /* пульс свечения зрачка — «живой» знак, а не статичная картинка */
    const pulse = 0.30 + Math.sin(t * 1.6) * 0.10;
    eye.traverse(o => { if (o.isMesh && o.material) o.material.emissiveIntensity = pulse * intensity; });
    rim.intensity = (2.0 + Math.sin(t * 1.6) * 0.5) * intensity;

    renderer.render(scene, cam);

    if (firstFrame) {
      firstFrame = false;
      canvas.style.opacity = '1';
      if (typeof opts.onReady === 'function') { try { opts.onReady(); } catch (e) {} }
    }
  }
  frame();

  /* Не жжём батарею, когда вкладка/мини-апп в фоне */
  const onVis = () => {
    if (document.hidden) { alive = false; cancelAnimationFrame(raf); }
    else if (!alive) { alive = true; clock.getDelta(); frame(); }
  };
  document.addEventListener('visibilitychange', onVis);

  return {
    setIntensity(v) { intensity = v; },
    dispose() {
      alive = false;
      cancelAnimationFrame(raf);
      document.removeEventListener('visibilitychange', onVis);
      removeEventListener('pointermove', onPointer);
      removeEventListener('touchmove', onTouch);
      removeEventListener('deviceorientation', onGyro, true);
      if (ro) ro.disconnect(); else removeEventListener('resize', resize);
      try {
        scene.traverse(o => {
          if (o.geometry) o.geometry.dispose();
          if (o.material) {
            const mats = Array.isArray(o.material) ? o.material : [o.material];
            mats.forEach(m => m.dispose());
          }
        });
        if (envTex) envTex.dispose();
        renderer.dispose();
      } catch (e) {}
      canvas.remove();
    }
  };
}
