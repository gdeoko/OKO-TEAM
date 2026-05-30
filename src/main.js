import './style.css';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import Lenis from 'lenis';
import { SoundSystem } from './audio/sound-system.js';

// ============================================================
// Конфиг / устройство
// ============================================================
const isMobile = window.matchMedia('(max-width: 768px)').matches || !window.matchMedia('(hover: hover)').matches;
const PCOUNT = isMobile ? 12000 : 25000;
const PIXEL_RATIO = Math.min(window.devicePixelRatio, 1.5);

const sound = new SoundSystem();

// ============================================================
// Сэмплирование GLB → точки (взвешенно по площади треугольников)
// ============================================================
function sampleModel(scene, count) {
  const tris = [];
  scene.traverse((c) => {
    if (c.isMesh && c.geometry) {
      const pos = c.geometry.attributes.position;
      const idx = c.geometry.index;
      c.updateMatrixWorld(true);
      const m = c.matrixWorld;
      const get = (i) => new THREE.Vector3().fromBufferAttribute(pos, i).applyMatrix4(m);
      if (idx) {
        for (let i = 0; i < idx.count; i += 3) {
          const a = get(idx.getX(i)), b = get(idx.getX(i + 1)), cc = get(idx.getX(i + 2));
          const area = b.clone().sub(a).cross(cc.clone().sub(a)).length() * 0.5;
          tris.push({ a, b, c: cc, area });
        }
      } else {
        for (let i = 0; i < pos.count; i += 3) {
          const a = get(i), b = get(i + 1), cc = get(i + 2);
          const area = b.clone().sub(a).cross(cc.clone().sub(a)).length() * 0.5;
          tris.push({ a, b, c: cc, area });
        }
      }
    }
  });
  const total = tris.reduce((s, t) => s + t.area, 0);
  const raw = [];
  for (let i = 0; i < count; i++) {
    let r = Math.random() * total, chosen = tris[0];
    for (const t of tris) { r -= t.area; if (r <= 0) { chosen = t; break; } }
    let r1 = Math.random(), r2 = Math.random();
    if (r1 + r2 > 1) { r1 = 1 - r1; r2 = 1 - r2; }
    const r3 = 1 - r1 - r2;
    raw.push(new THREE.Vector3(
      chosen.a.x * r1 + chosen.b.x * r2 + chosen.c.x * r3,
      chosen.a.y * r1 + chosen.b.y * r2 + chosen.c.y * r3,
      chosen.a.z * r1 + chosen.b.z * r2 + chosen.c.z * r3,
    ));
  }
  // нормализация: центр в 0, размер к целевому
  const bbox = new THREE.Box3();
  raw.forEach((p) => bbox.expandByPoint(p));
  const center = bbox.getCenter(new THREE.Vector3());
  const size = bbox.getSize(new THREE.Vector3());
  const scale = 2.6 / Math.max(size.x, size.y, size.z);
  const arr = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    arr[i * 3] = (raw[i].x - center.x) * scale;
    arr[i * 3 + 1] = (raw[i].y - center.y) * scale;
    arr[i * 3 + 2] = (raw[i].z - center.z) * scale;
  }
  return arr;
}

// ============================================================
// Сцена
// ============================================================
const canvas = document.getElementById('webgl');
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x030308);
scene.fog = new THREE.Fog(0x030308, 10, 30);

const camera = new THREE.PerspectiveCamera(38, innerWidth / innerHeight, 0.1, 100);
camera.position.set(0, 0.4, 8);

const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
renderer.setSize(innerWidth, innerHeight);
renderer.setPixelRatio(PIXEL_RATIO);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 0.9;
renderer.outputColorSpace = THREE.SRGBColorSpace;

// Фоновые звёзды
(() => {
  const n = isMobile ? 25 : 50;
  const g = new THREE.BufferGeometry();
  const p = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    p[i * 3] = (Math.random() - 0.5) * 34;
    p[i * 3 + 1] = (Math.random() - 0.5) * 22;
    p[i * 3 + 2] = (Math.random() - 0.5) * 30 - 6;
  }
  g.setAttribute('position', new THREE.BufferAttribute(p, 3));
  const m = new THREE.PointsMaterial({ color: 0xaaccff, size: 0.02, transparent: true, opacity: 0.55, blending: THREE.AdditiveBlending, depthWrite: false });
  scene.add(new THREE.Points(g, m));
})();

// ============================================================
// Система частиц с морфингом утка → мозг
// ============================================================
const INTERACT_RADIUS = 0.5, PUSH_FORCE = 0.025, RETURN_SPEED = 0.025, DAMPING = 0.94;

let particles = null;
let duckPos = null, brainPos = null, ctrlPos = null;
let curPos = null, vel = null, delays = null;
let morph = 0;        // 0 = утка, 1 = мозг
let targetReady = false;

function buildParticles() {
  const N = PCOUNT;
  curPos = new Float32Array(N * 3);
  vel = new Float32Array(N * 3);
  delays = new Float32Array(N);
  ctrlPos = new Float32Array(N * 3);
  const colors = new Float32Array(N * 3);
  const sizes = new Float32Array(N);

  const palette = [
    new THREE.Color(0xffffff), new THREE.Color(0xc8e6ff),
    new THREE.Color(0x88ddff), new THREE.Color(0xffd700), new THREE.Color(0xcc0000),
  ];

  for (let i = 0; i < N; i++) {
    // стартовая позиция = утка, разлёт из пыли
    curPos[i * 3] = duckPos[i * 3] + (Math.random() - 0.5) * 9;
    curPos[i * 3 + 1] = duckPos[i * 3 + 1] + (Math.random() - 0.5) * 9;
    curPos[i * 3 + 2] = duckPos[i * 3 + 2] + (Math.random() - 0.5) * 9;

    delays[i] = Math.random() * 0.4;

    // контрольная точка дуги для морфинга (перпендикулярный разброс)
    const mx = (duckPos[i * 3] + brainPos[i * 3]) / 2;
    const my = (duckPos[i * 3 + 1] + brainPos[i * 3 + 1]) / 2;
    const mz = (duckPos[i * 3 + 2] + brainPos[i * 3 + 2]) / 2;
    ctrlPos[i * 3] = mx + (Math.random() - 0.5) * 2.5;
    ctrlPos[i * 3 + 1] = my + (Math.random() - 0.5) * 2.5;
    ctrlPos[i * 3 + 2] = mz + (Math.random() - 0.5) * 2.5;

    // цвет: холодная палитра, золото на клюве (верх утки)
    const hf = (duckPos[i * 3 + 1] + 1.3) / 2.6;
    const r = Math.random();
    let ci;
    if (hf > 0.85) ci = r > 0.6 ? 3 : 0;
    else if (r < 0.05) ci = 4;
    else if (r < 0.5) ci = 0;
    else if (r < 0.85) ci = 1;
    else ci = 2;
    const col = palette[ci];
    colors[i * 3] = col.r; colors[i * 3 + 1] = col.g; colors[i * 3 + 2] = col.b;
    sizes[i] = 0.08 + Math.random() * 0.18;
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(curPos, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geo.setAttribute('size', new THREE.BufferAttribute(sizes, 1));

  const mat = new THREE.ShaderMaterial({
    uniforms: { uPixelRatio: { value: PIXEL_RATIO }, uTime: { value: 0 } },
    vertexShader: `
      attribute float size; varying vec3 vColor; varying float vAlpha;
      uniform float uPixelRatio; uniform float uTime;
      void main() {
        vColor = color;
        float tw = 0.7 + 0.3 * sin(uTime * 2.0 + position.x * 8.0 + position.y * 6.0);
        vAlpha = tw;
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        gl_PointSize = size * uPixelRatio * (180.0 / -mv.z);
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: `
      varying vec3 vColor; varying float vAlpha;
      void main() {
        vec2 uv = gl_PointCoord - vec2(0.5);
        float d = length(uv);
        if (d > 0.5) discard;
        float a = pow(1.0 - smoothstep(0.0, 0.5, d), 2.0);
        gl_FragColor = vec4(vColor, a * vAlpha);
      }`,
    vertexColors: true, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false,
  });

  particles = new THREE.Points(geo, mat);
  scene.add(particles);
  targetReady = true;
}

// ============================================================
// Загрузка моделей
// ============================================================
const loader = new GLTFLoader();
function load(url) {
  return new Promise((res, rej) => loader.load(url, (g) => res(g.scene), null, rej));
}

Promise.all([load('/models/duck.glb'), load('/models/brain.glb')])
  .then(([duck, brain]) => {
    duckPos = sampleModel(duck, PCOUNT);
    brainPos = sampleModel(brain, PCOUNT);
    buildParticles();
    document.getElementById('loader').classList.add('hidden');
    sound.playFormation();
  })
  .catch((e) => {
    console.error('Ошибка загрузки моделей', e);
    document.querySelector('.loader-txt').textContent = 'Не удалось загрузить модели. Обнови страницу.';
  });

// ============================================================
// Указатель / взаимодействие
// ============================================================
const pointer = new THREE.Vector2(-10, -10);
const raycaster = new THREE.Raycaster();
const pointer3D = new THREE.Vector3();
let pointerActive = false;

function updatePointer(x, y) {
  pointer.x = (x / innerWidth) * 2 - 1;
  pointer.y = -(y / innerHeight) * 2 + 1;
  pointerActive = true;
  raycaster.setFromCamera(pointer, camera);
  raycaster.ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0, 0, 1), 0), pointer3D);
}
addEventListener('mousemove', (e) => updatePointer(e.clientX, e.clientY));
addEventListener('touchmove', (e) => { if (e.touches[0]) updatePointer(e.touches[0].clientX, e.touches[0].clientY); }, { passive: true });
addEventListener('mouseleave', () => { pointerActive = false; });

// ============================================================
// Скролл (Lenis) → прогресс фильма
// ============================================================
const lenis = new Lenis({ duration: 1.1, smoothWheel: true });
let scrollProgress = 0;
lenis.on('scroll', ({ scroll, limit }) => {
  scrollProgress = limit > 0 ? scroll / limit : 0;
  document.getElementById('scroll-progress').style.width = scrollProgress * 100 + '%';
  document.getElementById('nav').classList.toggle('scrolled', scroll > 50);
  updateUIByScroll();
});
function raf(t) { lenis.raf(t); requestAnimationFrame(raf); }
requestAnimationFrame(raf);

// ============================================================
// UI по скроллу: счётчик, hero-параллакс, тезисы
// ============================================================
const heroInner = document.querySelector('.hero-inner');
const scrollHint = document.querySelector('.scroll-hint');
const counter = document.getElementById('section-counter');
const theses = [...document.querySelectorAll('[data-t]')];

function updateUIByScroll() {
  // hero уходит в глубину
  const h = Math.min(1, scrollProgress * 2);
  heroInner.style.transform = `perspective(1200px) translateZ(${-h * 120}px) translateY(${-h * 40}px) rotateX(${h * 3}deg)`;
  heroInner.style.opacity = String(Math.max(0, 1 - h * 1.4));
  scrollHint.style.opacity = String(Math.max(0, 1 - scrollProgress * 4));

  // счётчик секций
  counter.textContent = (scrollProgress > 0.5 ? '02' : '01') + ' / 08';

  // тезисы появляются ближе к мозгу
  const show = scrollProgress > 0.78;
  theses.forEach((t, i) => setTimeout(() => t.classList.toggle('vis', show), i * 90));
}

// ============================================================
// Анимационный цикл
// ============================================================
const clock = new THREE.Clock();
let frame = 0;

function animate() {
  requestAnimationFrame(animate);
  const t = clock.getElapsedTime();
  frame++;

  // целевой морфинг от скролла, плавно догоняем
  const targetMorph = THREE.MathUtils.smoothstep(scrollProgress, 0.05, 0.95);
  morph += (targetMorph - morph) * 0.06;

  // камера "влетает и вылетает" сквозь облако
  const fly = Math.sin(Math.min(scrollProgress, 1) * Math.PI);
  camera.position.z = 8 - fly * 6.2;
  camera.position.y = 0.4 + Math.sin(t * 0.3) * 0.05;
  camera.lookAt(0, 0, 0);

  if (particles && targetReady) {
    particles.material.uniforms.uTime.value = t;
    const N = PCOUNT;
    const arr = particles.geometry.attributes.position.array;
    let pushed = 0;

    for (let i = 0; i < N; i++) {
      const i3 = i * 3;
      // целевая позиция по дуге утка→мозг с задержкой
      const m = THREE.MathUtils.clamp((morph - delays[i]) / (1 - 0.4), 0, 1);
      const mm = m * m * (3 - 2 * m); // smoothstep
      const inv = 1 - mm;
      // квадратичная кривая Безье через контрольную точку
      const tx = inv * inv * duckPos[i3] + 2 * inv * mm * ctrlPos[i3] + mm * mm * brainPos[i3];
      const ty = inv * inv * duckPos[i3 + 1] + 2 * inv * mm * ctrlPos[i3 + 1] + mm * mm * brainPos[i3 + 1];
      const tz = inv * inv * duckPos[i3 + 2] + 2 * inv * mm * ctrlPos[i3 + 2] + mm * mm * brainPos[i3 + 2];

      // отталкивание от указателя
      if (pointerActive) {
        const dx = arr[i3] - pointer3D.x, dy = arr[i3 + 1] - pointer3D.y, dz = arr[i3 + 2] - pointer3D.z;
        const dsq = dx * dx + dy * dy + dz * dz;
        if (dsq < INTERACT_RADIUS * INTERACT_RADIUS) {
          const dist = Math.sqrt(dsq) + 0.001;
          const f = (1 - dist / INTERACT_RADIUS); const s = f * f * PUSH_FORCE;
          vel[i3] += (dx / dist) * s; vel[i3 + 1] += (dy / dist) * s; vel[i3 + 2] += (dz / dist) * s;
          pushed++;
        }
      }

      // возврат к цели + затухание
      vel[i3] += (tx - arr[i3]) * RETURN_SPEED;
      vel[i3 + 1] += (ty - arr[i3 + 1]) * RETURN_SPEED;
      vel[i3 + 2] += (tz - arr[i3 + 2]) * RETURN_SPEED;
      vel[i3] *= DAMPING; vel[i3 + 1] *= DAMPING; vel[i3 + 2] *= DAMPING;
      arr[i3] += vel[i3]; arr[i3 + 1] += vel[i3 + 1]; arr[i3 + 2] += vel[i3 + 2];
    }
    particles.geometry.attributes.position.needsUpdate = true;

    if (pushed > 80 && frame % 8 === 0) sound.playBell(Math.min(pushed / 500, 0.8));

    // медленное вращение; мозг пульсирует
    particles.rotation.y += 0.0015;
    const pulse = 1 + Math.sin(t * 1.5) * 0.015 * morph;
    particles.scale.setScalar(pulse);
  }

  renderer.render(scene, camera);
}
animate();

addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});

// ============================================================
// Стартовый оверлей / mute / курсор / hover-звуки
// ============================================================
const overlay = document.getElementById('start-overlay');
function enter(withSound) {
  if (withSound) { sound.init(); sound.ctx.resume(); sound.startMusic(); }
  overlay.classList.add('hidden');
}
overlay.addEventListener('click', (e) => { if (e.target.id !== 'skip-sound') enter(true); });
document.getElementById('skip-sound').addEventListener('click', (e) => { e.stopPropagation(); enter(false); });

const muteBtn = document.getElementById('mute-btn');
muteBtn.addEventListener('click', () => {
  const m = sound.toggleMute();
  document.getElementById('ic-sound-on').style.display = m ? 'none' : 'block';
  document.getElementById('ic-sound-off').style.display = m ? 'block' : 'none';
});

// hover-звуки + курсор-реакция на интерактиве
document.querySelectorAll('a, button, [data-t]').forEach((el) => {
  el.addEventListener('mouseenter', () => { sound.playHover(); document.body.classList.add('cursor-hover'); });
  el.addEventListener('mouseleave', () => document.body.classList.remove('cursor-hover'));
  el.addEventListener('click', () => sound.playClick());
});

// кастомный курсор
if (window.matchMedia('(hover: hover)').matches) {
  const dot = document.createElement('div'); dot.id = 'cursor-dot';
  const ring = document.createElement('div'); ring.id = 'cursor-ring';
  document.body.append(dot, ring);
  let rx = 0, ry = 0, dx = 0, dy = 0;
  addEventListener('mousemove', (e) => { dx = e.clientX; dy = e.clientY; dot.style.left = dx + 'px'; dot.style.top = dy + 'px'; });
  (function curLoop() { rx += (dx - rx) * 0.18; ry += (dy - ry) * 0.18; ring.style.left = rx + 'px'; ring.style.top = ry + 'px'; requestAnimationFrame(curLoop); })();
}

// якорная прокрутка для "Узнать больше"
document.querySelector('.btn-line').addEventListener('click', (e) => {
  e.preventDefault(); lenis.scrollTo('#about', { duration: 1.6 });
});
