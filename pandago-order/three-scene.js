/* ═══════════════════════════════════════════════════════════════
   PandaGo Cargo · 3D-фон hero-секции (Three.js через CDN)

   Два слоя:
   1. Полноэкранный GLSL-шейдер: текучая сине-электрик аврора с
      световыми лентами маршрута и лёгким зерном. Считается на
      низком разрешении, поэтому дёшев даже на слабых телефонах.
   2. Разреженное поле светящихся точек-координат с параллаксом.

   Бюджет: без текстур, DPR ограничен, пауза при скрытой вкладке и
   когда hero вне экрана, 30fps и меньше точек на мобильных. При
   prefers-reduced-motion модуль не загружается (см. app.js), остаётся
   статичный градиент.
   ═══════════════════════════════════════════════════════════════ */

import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js';

const VERT = `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = vec4(position.xy, 0.0, 1.0);
  }
`;

/* Фрагментный шейдер: доменно-искажённый поток (FBM) в холодной палитре
   плюс диагональные световые ленты, имитирующие траекторию доставки. */
const FRAG = `
  precision highp float;
  varying vec2 vUv;
  uniform float uTime;
  uniform vec2  uRes;
  uniform vec2  uPointer;

  const vec3 NAVY_DEEP = vec3(0.031, 0.094, 0.200);
  const vec3 NAVY      = vec3(0.039, 0.118, 0.259);
  const vec3 ROYAL     = vec3(0.102, 0.227, 0.478);
  const vec3 ELECTRIC  = vec3(0.102, 0.420, 0.878);
  const vec3 CYAN      = vec3(0.231, 0.620, 1.000);

  float hash(vec2 p) {
    p = fract(p * vec2(123.34, 456.21));
    p += dot(p, p + 45.32);
    return fract(p.x * p.y);
  }
  float noise(vec2 p) {
    vec2 i = floor(p), f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash(i + vec2(0.0, 0.0)), hash(i + vec2(1.0, 0.0)), u.x),
               mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y);
  }
  float fbm(vec2 p) {
    float v = 0.0, a = 0.5;
    for (int i = 0; i < 5; i++) {
      v += a * noise(p);
      p = p * 2.02 + vec2(37.1, 11.7);
      a *= 0.5;
    }
    return v;
  }

  void main() {
    vec2 uv = vUv;
    vec2 p = (gl_FragCoord.xy - 0.5 * uRes) / uRes.y;
    float t = uTime * 0.05;

    /* мягкий параллакс от указателя */
    p += uPointer * 0.06;

    /* доменное искажение: два слоя FBM */
    vec2 q = vec2(fbm(p * 1.6 + vec2(0.0, t)), fbm(p * 1.6 + vec2(5.2, -t)));
    float flow = fbm(p * 2.2 + q * 1.8 + vec2(t * 0.6, t * 0.4));

    /* базовый вертикальный градиент */
    vec3 col = mix(NAVY_DEEP, NAVY, uv.y);
    col = mix(col, ROYAL, smoothstep(0.35, 1.0, flow) * 0.7);

    /* электрик-подсветка в верхней правой зоне */
    float glow = smoothstep(0.55, 0.95, flow) * smoothstep(0.0, 1.0, uv.x * 0.6 + uv.y * 0.6);
    col += ELECTRIC * glow * 0.45;

    /* световые ленты маршрута: диагональные синусы */
    float lanes = 0.0;
    for (int i = 0; i < 3; i++) {
      float fi = float(i);
      float y = p.y + 0.12 * fi - 0.15;
      float wave = sin((p.x * 2.0) + t * 3.0 + fi * 2.1) * 0.10;
      float d = abs(y - wave - (fbm(p * 1.2 + fi) - 0.5) * 0.3);
      lanes += smoothstep(0.035, 0.0, d) * (0.5 + 0.5 * sin(p.x * 3.0 - t * 4.0 + fi));
    }
    col += CYAN * lanes * 0.35;

    /* виньетка и лёгкое зерно */
    float vig = smoothstep(1.25, 0.25, length(p));
    col *= 0.55 + 0.55 * vig;
    float grain = (hash(gl_FragCoord.xy + uTime) - 0.5) * 0.035;
    col += grain;

    gl_FragColor = vec4(col, 1.0);
  }
`;

export function initScene(container) {
  const isMobile = window.innerWidth < 768 ||
    (navigator.hardwareConcurrency && navigator.hardwareConcurrency <= 4);

  const renderer = new THREE.WebGLRenderer({
    antialias: false,
    alpha: false,
    powerPreference: 'low-power',
  });
  /* шейдер-фон намеренно рендерим ниже нативного DPR: он мягкий, экономим GPU */
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, isMobile ? 1 : 1.5));
  renderer.setSize(container.clientWidth, container.clientHeight);
  container.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

  /* ── Слой 1: полноэкранный шейдер ── */
  const uniforms = {
    uTime:    { value: 0 },
    uRes:     { value: new THREE.Vector2(container.clientWidth, container.clientHeight) },
    uPointer: { value: new THREE.Vector2(0, 0) },
  };
  const quad = new THREE.Mesh(
    new THREE.PlaneGeometry(2, 2),
    new THREE.ShaderMaterial({ vertexShader: VERT, fragmentShader: FRAG, uniforms, depthTest: false })
  );
  scene.add(quad);

  /* ── Слой 2: точки-координаты поверх шейдера ── */
  const sceneP = new THREE.Scene();
  const camP = new THREE.PerspectiveCamera(52, container.clientWidth / container.clientHeight, 0.1, 100);
  camP.position.z = 26;

  let seed = 20260706;
  const rnd = () => { seed = (seed * 1664525 + 1013904223) % 4294967296; return seed / 4294967296; };

  const ptCount = isMobile ? 160 : 380;
  const pos = new Float32Array(ptCount * 3);
  const sizes = new Float32Array(ptCount);
  for (let i = 0; i < ptCount; i++) {
    pos[i * 3]     = (rnd() - 0.5) * 70;
    pos[i * 3 + 1] = (rnd() - 0.5) * 40;
    pos[i * 3 + 2] = -rnd() * 40;
    sizes[i] = rnd() > 0.85 ? 2.4 : 1.0;
  }
  const ptGeo = new THREE.BufferGeometry();
  ptGeo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  ptGeo.setAttribute('aScale', new THREE.BufferAttribute(sizes, 1));

  const ptMat = new THREE.ShaderMaterial({
    transparent: true,
    depthTest: false,
    blending: THREE.AdditiveBlending,
    uniforms: { uTime: { value: 0 } },
    vertexShader: `
      attribute float aScale;
      uniform float uTime;
      varying float vA;
      void main() {
        vec3 p = position;
        p.y += sin(uTime * 0.5 + position.x * 0.3) * 0.4;
        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        gl_PointSize = aScale * 2.2 * (300.0 / -mv.z);
        gl_Position = projectionMatrix * mv;
        vA = 0.35 + 0.4 * aScale;
      }
    `,
    fragmentShader: `
      varying float vA;
      void main() {
        vec2 c = gl_PointCoord - 0.5;
        float d = smoothstep(0.5, 0.0, length(c));
        gl_FragColor = vec4(0.66, 0.82, 1.0, d * vA);
      }
    `,
  });
  const points = new THREE.Points(ptGeo, ptMat);
  sceneP.add(points);

  /* ── Указатель ── */
  const pointer = { x: 0, y: 0, tx: 0, ty: 0 };
  const onMove = (e) => {
    const tt = e.touches ? e.touches[0] : e;
    pointer.tx = (tt.clientX / window.innerWidth - 0.5) * 2;
    pointer.ty = (tt.clientY / window.innerHeight - 0.5) * 2;
  };
  if (!isMobile) window.addEventListener('pointermove', onMove, { passive: true });

  /* ── Ресайз ── */
  const onResize = () => {
    const w = container.clientWidth, h = container.clientHeight;
    renderer.setSize(w, h);
    uniforms.uRes.value.set(w * renderer.getPixelRatio(), h * renderer.getPixelRatio());
    camP.aspect = w / h;
    camP.updateProjectionMatrix();
  };
  window.addEventListener('resize', onResize, { passive: true });
  onResize();

  /* ── Пауза ── */
  let running = true, inView = true;
  document.addEventListener('visibilitychange', () => { running = document.visibilityState === 'visible'; });
  const io = new IntersectionObserver((es) => { inView = es[0].isIntersecting; }, { threshold: 0 });
  io.observe(container);

  const frameGap = isMobile ? 1000 / 30 : 0;
  let last = 0, t = 0;
  renderer.autoClear = false;

  function frame(now) {
    requestAnimationFrame(frame);
    if (!running || !inView) { last = now; return; }
    if (frameGap && now - last < frameGap) return;
    const dt = Math.min((now - last) / 1000 || 0.016, 0.05);
    last = now; t += dt;

    pointer.x += (pointer.tx - pointer.x) * 0.04;
    pointer.y += (pointer.ty - pointer.y) * 0.04;

    uniforms.uTime.value = t;
    uniforms.uPointer.value.set(pointer.x, -pointer.y);
    ptMat.uniforms.uTime.value = t;

    points.rotation.y = t * 0.02;
    camP.position.x = pointer.x * 2.2;
    camP.position.y = -pointer.y * 1.4;
    camP.lookAt(0, 0, -10);

    renderer.clear();
    renderer.render(scene, camera);
    renderer.render(sceneP, camP);
  }
  requestAnimationFrame(frame);

  return () => {
    io.disconnect();
    window.removeEventListener('resize', onResize);
    if (!isMobile) window.removeEventListener('pointermove', onMove);
    quad.geometry.dispose();
    quad.material.dispose();
    ptGeo.dispose();
    ptMat.dispose();
    renderer.dispose();
    renderer.domElement.remove();
  };
}
