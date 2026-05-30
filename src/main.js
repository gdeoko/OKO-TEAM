import './style.css';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import Lenis from 'lenis';
import gsap from 'gsap';
import { SoundSystem } from './audio/sound-system.js';
import { ClubEnvironment } from './three/environment.js';

// ============================================================
// Устройство / конфиг
// ============================================================
const isMobile = window.matchMedia('(max-width: 768px)').matches || !window.matchMedia('(hover: hover)').matches;
const PCOUNT = isMobile ? 14000 : 26000;
const PIXEL_RATIO = Math.min(window.devicePixelRatio, 1.5);
// На ПК утка справа (текст слева). В момент распада плавно уходит в центр (влёт внутрь).
const DUCK_X = isMobile ? 0 : 2.6;
const DUCK_Y = isMobile ? 1.7 : 0.2;
const DUCK_SCALE = isMobile ? 0.6 : 1;

const sound = new SoundSystem();

// ============================================================
// Сэмплирование GLB → точки
// ============================================================
function sampleModel(scene, count) {
  const ax = [], ay = [], az = [], bx = [], by = [], bz = [], cx = [], cy = [], cz = [];
  const va = new THREE.Vector3(), vb = new THREE.Vector3(), vc = new THREE.Vector3();
  const e1 = new THREE.Vector3(), e2 = new THREE.Vector3();
  const cum = []; let total = 0;
  scene.traverse((c) => {
    if (!(c.isMesh && c.geometry)) return;
    const pos = c.geometry.attributes.position, idx = c.geometry.index;
    c.updateMatrixWorld(true); const m = c.matrixWorld;
    const n = idx ? idx.count : pos.count;
    for (let i = 0; i < n; i += 3) {
      const i0 = idx ? idx.getX(i) : i, i1 = idx ? idx.getX(i + 1) : i + 1, i2 = idx ? idx.getX(i + 2) : i + 2;
      va.fromBufferAttribute(pos, i0).applyMatrix4(m);
      vb.fromBufferAttribute(pos, i1).applyMatrix4(m);
      vc.fromBufferAttribute(pos, i2).applyMatrix4(m);
      e1.subVectors(vb, va); e2.subVectors(vc, va);
      total += e1.cross(e2).length() * 0.5; cum.push(total);
      ax.push(va.x); ay.push(va.y); az.push(va.z);
      bx.push(vb.x); by.push(vb.y); bz.push(vb.z);
      cx.push(vc.x); cy.push(vc.y); cz.push(vc.z);
    }
  });
  const nTris = cum.length, arr = new Float32Array(count * 3);
  const pick = (target) => { let lo = 0, hi = nTris - 1; while (lo < hi) { const mid = (lo + hi) >> 1; if (cum[mid] < target) lo = mid + 1; else hi = mid; } return lo; };
  let minX = Infinity, minY = Infinity, minZ = Infinity, maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;
  for (let i = 0; i < count; i++) {
    const t = pick(Math.random() * total);
    let r1 = Math.random(), r2 = Math.random(); if (r1 + r2 > 1) { r1 = 1 - r1; r2 = 1 - r2; }
    const r3 = 1 - r1 - r2;
    const x = ax[t] * r3 + bx[t] * r1 + cx[t] * r2;
    const y = ay[t] * r3 + by[t] * r1 + cy[t] * r2;
    const z = az[t] * r3 + bz[t] * r1 + cz[t] * r2;
    arr[i * 3] = x; arr[i * 3 + 1] = y; arr[i * 3 + 2] = z;
    if (x < minX) minX = x; if (x > maxX) maxX = x;
    if (y < minY) minY = y; if (y > maxY) maxY = y;
    if (z < minZ) minZ = z; if (z > maxZ) maxZ = z;
  }
  const cX = (minX + maxX) / 2, cY = (minY + maxY) / 2, cZ = (minZ + maxZ) / 2;
  const scale = 2.6 / Math.max(maxX - minX, maxY - minY, maxZ - minZ);
  for (let i = 0; i < count; i++) {
    arr[i * 3] = (arr[i * 3] - cX) * scale;
    arr[i * 3 + 1] = (arr[i * 3 + 1] - cY) * scale;
    arr[i * 3 + 2] = (arr[i * 3 + 2] - cZ) * scale;
  }
  return arr;
}
function normalize(obj, target) {
  const b = new THREE.Box3().setFromObject(obj);
  const s = b.getSize(new THREE.Vector3()), c = b.getCenter(new THREE.Vector3());
  obj.position.sub(c); obj.scale.setScalar(target / Math.max(s.x, s.y, s.z));
}

// ============================================================
// Сцена
// ============================================================
const canvas = document.getElementById('webgl');
const scene = new THREE.Scene();
scene.fog = new THREE.FogExp2(0x05030a, 0.014);
const camera = new THREE.PerspectiveCamera(42, innerWidth / innerHeight, 0.1, 120);
camera.position.set(0, 0.4, 9);
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
renderer.setSize(innerWidth, innerHeight);
renderer.setPixelRatio(PIXEL_RATIO);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
renderer.outputColorSpace = THREE.SRGBColorSpace;

const env = new ClubEnvironment(scene, isMobile);

// ============================================================
// Кубики-занавес
// ============================================================
function pipTexture(n) {
  const c = document.createElement('canvas'); c.width = 256; c.height = 256;
  const x = c.getContext('2d'); x.fillStyle = '#cc0000'; x.fillRect(0, 0, 256, 256); x.fillStyle = '#fff';
  const dot = (px, py) => { x.beginPath(); x.arc(px, py, 26, 0, Math.PI * 2); x.fill(); };
  const L = 64, M = 128, R = 192;
  ({ 1: [[M, M]], 2: [[L, L], [R, R]], 3: [[L, L], [M, M], [R, R]], 4: [[L, L], [R, L], [L, R], [R, R]], 5: [[L, L], [R, L], [M, M], [L, R], [R, R]], 6: [[L, L], [R, L], [L, M], [R, M], [L, R], [R, R]] }[n]).forEach(([px, py]) => dot(px, py));
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
function makeDie() {
  const faces = [2, 5, 3, 4, 1, 6];
  return new THREE.Mesh(new RoundedBoxGeometry(1, 1, 1, 4, 0.12),
    faces.map((n) => new THREE.MeshPhysicalMaterial({ map: pipTexture(n), roughness: 0.25, clearcoat: 1, clearcoatRoughness: 0.05 })));
}
const dice = [makeDie(), makeDie()];
dice.forEach((d) => { d.scale.setScalar(0.85); d.visible = false; scene.add(d); });

// ============================================================
// Утка + частицы
// ============================================================
const subject = new THREE.Group();
subject.position.set(DUCK_X, DUCK_Y, 0);
subject.scale.setScalar(DUCK_SCALE);
scene.add(subject);
// отдельный свет на утку (чтобы не была тёмным силуэтом)
const duckKey = new THREE.PointLight(0xffffff, 14, 12); duckKey.position.set(2, 3, 4); subject.add(duckKey);
const duckRim = new THREE.PointLight(0x88ddff, 8, 12); duckRim.position.set(-3, 1, -2); subject.add(duckRim);

const DUCK_BASE_ROT = Math.PI;
let duckMesh = null, particles = null;
let duckPos = null, brainPos = null, ctrlPos = null, vel = null, delays = null;
let morph = 0, ready = false, introDone = false;
let brainOpen = false;

const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2(-10, -10);
const pointer3D = new THREE.Vector3();
let pointerActive = false, pointerNX = 0, pointerNY = 0;
const INTERACT_RADIUS = 0.65, PUSH_FORCE = 0.03, RETURN_SPEED = 0.022, DAMPING = 0.93;

function buildParticles() {
  const N = PCOUNT;
  vel = new Float32Array(N * 3); delays = new Float32Array(N); ctrlPos = new Float32Array(N * 3);
  const cur = new Float32Array(N * 3), colors = new Float32Array(N * 3), sizes = new Float32Array(N);
  const palette = [new THREE.Color(0xffffff), new THREE.Color(0xc8e6ff), new THREE.Color(0x88ddff), new THREE.Color(0xffd700), new THREE.Color(0xcc0000)];
  for (let i = 0; i < N; i++) {
    cur[i * 3] = duckPos[i * 3]; cur[i * 3 + 1] = duckPos[i * 3 + 1]; cur[i * 3 + 2] = duckPos[i * 3 + 2];
    delays[i] = Math.random() * 0.4;
    const mx = (duckPos[i * 3] + brainPos[i * 3]) / 2, my = (duckPos[i * 3 + 1] + brainPos[i * 3 + 1]) / 2, mz = (duckPos[i * 3 + 2] + brainPos[i * 3 + 2]) / 2;
    ctrlPos[i * 3] = mx + (Math.random() - 0.5) * 3.0; ctrlPos[i * 3 + 1] = my + (Math.random() - 0.5) * 3.0; ctrlPos[i * 3 + 2] = mz + (Math.random() - 0.5) * 3.0;
    const hf = (duckPos[i * 3 + 1] + 1.3) / 2.6, r = Math.random();
    let ci; if (hf > 0.85) ci = r > 0.6 ? 3 : 0; else if (r < 0.05) ci = 4; else if (r < 0.5) ci = 0; else if (r < 0.85) ci = 1; else ci = 2;
    const col = palette[ci]; colors[i * 3] = col.r; colors[i * 3 + 1] = col.g; colors[i * 3 + 2] = col.b;
    sizes[i] = 0.08 + Math.random() * 0.18;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(cur, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geo.setAttribute('size', new THREE.BufferAttribute(sizes, 1));
  const mat = new THREE.ShaderMaterial({
    uniforms: { uPixelRatio: { value: PIXEL_RATIO }, uTime: { value: 0 }, uOpacity: { value: 0 } },
    vertexShader: `attribute float size; varying vec3 vColor; varying float vAlpha; uniform float uPixelRatio; uniform float uTime;
      void main(){ vColor=color; float tw=0.7+0.3*sin(uTime*2.0+position.x*8.0+position.y*6.0); vAlpha=tw;
      vec4 mv=modelViewMatrix*vec4(position,1.0); gl_PointSize=size*uPixelRatio*(190.0/-mv.z); gl_Position=projectionMatrix*mv; }`,
    fragmentShader: `varying vec3 vColor; varying float vAlpha; uniform float uOpacity;
      void main(){ vec2 uv=gl_PointCoord-vec2(0.5); float d=length(uv); if(d>0.5)discard;
      float a=pow(1.0-smoothstep(0.0,0.5,d),2.0); gl_FragColor=vec4(vColor,a*vAlpha*uOpacity); }`,
    vertexColors: true, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false,
  });
  particles = new THREE.Points(geo, mat);
  subject.add(particles);
  ready = true;
}

// ============================================================
// Загрузка
// ============================================================
const loader = new GLTFLoader();
const load = (url) => new Promise((res, rej) => loader.load(url, (g) => res(g.scene), null, rej));
Promise.all([load('/models/duck.glb'), load('/models/brain.glb')])
  .then(([duck, brain]) => {
    duckPos = sampleModel(duck, PCOUNT);
    brainPos = sampleModel(brain, PCOUNT);
    normalize(duck, 2.6);
    duck.traverse((c) => { if (c.material) { c.material = c.material.clone(); c.material.transparent = true; c.material.envMapIntensity = 1.2; } });
    duckMesh = duck; duckMesh.rotation.y = DUCK_BASE_ROT; duckMesh.visible = false; subject.add(duckMesh);
    buildParticles();
    document.getElementById('loader').classList.add('hidden');
    startIntro();
  })
  .catch((e) => { console.error(e); document.querySelector('.loader-txt').textContent = 'Не удалось загрузить модели. Обнови страницу.'; });

// ============================================================
// Вход-занавес
// ============================================================
function startIntro() {
  const tl = gsap.timeline();
  dice.forEach((d, i) => { d.position.set(i === 0 ? -0.9 : 0.9, 7, 0.5); d.rotation.set(Math.random() * 3, Math.random() * 3, Math.random() * 3); d.visible = true; });
  tl.fromTo(dice[0].position, { y: 7 }, { y: -8, duration: 1.7, ease: 'power1.in' }, 0.1);
  tl.fromTo(dice[1].position, { y: 7.6 }, { y: -8, duration: 1.7, ease: 'power1.in' }, 0.28);
  tl.to(dice[0].rotation, { x: '+=7', z: '+=5', duration: 1.7 }, 0.1);
  tl.to(dice[1].rotation, { x: '+=6', y: '+=7', duration: 1.7 }, 0.28);
  tl.add(() => dice.forEach((d) => (d.visible = false)), 1.85);
  tl.add(() => { if (duckMesh) { duckMesh.visible = true; sound.playFormation(); } }, 1.7);
  if (duckMesh) {
    duckMesh.position.x = isMobile ? 4 : 6; duckMesh.rotation.y = DUCK_BASE_ROT + 0.7;
    tl.to(duckMesh.position, { x: 0, duration: 1.7, ease: 'power2.out' }, 1.7);
    tl.to(duckMesh.rotation, { y: DUCK_BASE_ROT, duration: 1.5, ease: 'power2.out' }, 2.4);
  }
  tl.add(() => document.body.classList.add('hero-in'), 2.2);
  tl.add(() => { introDone = true; }, 3.8);
}

// ============================================================
// Указатель
// ============================================================
function updatePointer(x, y) {
  pointer.x = (x / innerWidth) * 2 - 1; pointer.y = -(y / innerHeight) * 2 + 1;
  pointerNX = pointer.x; pointerNY = pointer.y; pointerActive = true;
  raycaster.setFromCamera(pointer, camera);
  raycaster.ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0, 0, 1), 0), pointer3D);
  pointer3D.sub(subject.position).divideScalar(subject.scale.x);
}
addEventListener('mousemove', (e) => updatePointer(e.clientX, e.clientY));
addEventListener('touchmove', (e) => { if (e.touches[0]) updatePointer(e.touches[0].clientX, e.touches[0].clientY); }, { passive: true });
addEventListener('mouseleave', () => { pointerActive = false; });

// клик по утке = кряк; клик по мозгу = вход внутрь
function hitSubject(x, y) {
  pointer.x = (x / innerWidth) * 2 - 1; pointer.y = -(y / innerHeight) * 2 + 1;
  raycaster.setFromCamera(pointer, camera);
  // проверка попадания в область subject (по экранной близости к его центру)
  const c = subject.position.clone().project(camera);
  const dx = pointer.x - c.x, dy = pointer.y - c.y;
  return Math.sqrt(dx * dx + dy * dy) < 0.28;
}
addEventListener('click', (e) => {
  if (!introDone) return;
  if (morph < 0.3 && duckMesh && duckMesh.visible && hitSubject(e.clientX, e.clientY)) { sound.playQuack(); duckMesh.userData.poke = 0.3; }
  else if (morph > 0.7 && hitSubject(e.clientX, e.clientY)) toggleBrain();
});

// ============================================================
// Вход внутрь мозга → подробный текст
// ============================================================
const brainPanel = document.getElementById('brain-detail');
function toggleBrain() {
  brainOpen = !brainOpen;
  document.body.classList.toggle('brain-open', brainOpen);
  sound.playGlitch();
}
document.getElementById('brain-back')?.addEventListener('click', (e) => { e.stopPropagation(); brainOpen = false; document.body.classList.remove('brain-open'); });

// ============================================================
// Автостарт звука
// ============================================================
let audioStarted = false;
function startAudioOnce() { if (audioStarted) return; audioStarted = true; sound.init(); sound.ctx.resume(); sound.startMusic(); }
['pointerdown', 'touchstart', 'wheel', 'keydown'].forEach((ev) => addEventListener(ev, startAudioOnce, { once: true, passive: true }));

// ============================================================
// Скролл
// ============================================================
const lenis = new Lenis({ duration: 1.15, smoothWheel: true });
let scrollProgress = 0, lastDissolveZone = false;
lenis.on('scroll', ({ scroll, limit }) => {
  scrollProgress = limit > 0 ? scroll / limit : 0;
  document.getElementById('scroll-progress').style.width = scrollProgress * 100 + '%';
  document.getElementById('nav').classList.toggle('scrolled', scroll > 50);
  updateUIByScroll();
});
function raf(t) { lenis.raf(t); requestAnimationFrame(raf); }
requestAnimationFrame(raf);

const heroInner = document.querySelector('.hero-inner');
const aboutInner = document.querySelector('.about-inner');
const scrollHint = document.querySelector('.scroll-hint');
const counter = document.getElementById('section-counter');
function updateUIByScroll() {
  // ТЕКСТ HERO РАСТВОРЯЕТСЯ НА МЕСТЕ (не уезжает вверх): fade + лёгкий blur
  const fade = THREE.MathUtils.clamp(scrollProgress / 0.22, 0, 1);
  heroInner.style.opacity = String(1 - fade);
  heroInner.style.filter = `blur(${fade * 8}px)`;
  heroInner.style.pointerEvents = fade > 0.5 ? 'none' : 'auto';
  scrollHint.style.opacity = String(Math.max(0, 1 - scrollProgress * 5));
  // ТЕКСТ ABOUT плавно проявляется (fade + scale), когда собрался мозг
  const appear = THREE.MathUtils.clamp((scrollProgress - 0.82) / 0.16, 0, 1);
  aboutInner.style.opacity = String(appear);
  aboutInner.style.transform = `scale(${0.94 + appear * 0.06})`;
  aboutInner.style.pointerEvents = appear > 0.5 ? 'auto' : 'none';
  counter.textContent = (scrollProgress > 0.5 ? '02' : '01') + ' / 08';
  // звук растворения при входе в зону распада
  const inZone = scrollProgress > 0.12 && scrollProgress < 0.4;
  if (inZone && !lastDissolveZone) sound.playDissolve();
  lastDissolveZone = inZone;
}

// ============================================================
// Цикл
// ============================================================
const clock = new THREE.Clock();
let frame = 0;
const camTarget = new THREE.Vector3();
function animate() {
  requestAnimationFrame(animate);
  const t = clock.getElapsedTime(); frame++;
  env.update(t, camera);

  const dissolve = THREE.MathUtils.clamp(scrollProgress / 0.4, 0, 1);
  const targetMorph = THREE.MathUtils.smoothstep(scrollProgress, 0.4, 0.95);
  morph += (targetMorph - morph) * 0.06;

  // цвет фона по фазе: Hero тёплый → мозг холодный
  if (morph > 0.5) env.setColors(0x140622, 0x05030f);
  else env.setColors(0x2a0608, 0x0a0414);

  // КАМЕРА ЛЕТИТ ВНУТРЬ УТКИ и выходит сквозь облако
  const fly = Math.sin(Math.min(scrollProgress, 1) * Math.PI);
  const targetZ = brainOpen ? 2.2 : 9 - fly * 7.0;
  camera.position.z += (targetZ - camera.position.z) * 0.06;
  camera.position.x += ((pointerNX * 0.3) - camera.position.x) * 0.02;
  camera.position.y += (0.4 + (-pointerNY * 0.2) + Math.sin(t * 0.3) * 0.04 - camera.position.y) * 0.02;
  // утка в момент распада плавно смещается к центру (чтобы влетать в неё, без пустоты)
  subject.position.x += ((DUCK_X * (1 - dissolve)) - subject.position.x) * 0.05;
  camTarget.set(subject.position.x * 0.4, subject.position.y * 0.5, 0);
  camera.lookAt(camTarget);
  env.fade(1 - morph * 0.7);

  // твёрдая утка: idle + чистый распад (полностью исчезает к началу морфинга)
  if (duckMesh && duckMesh.visible) {
    const look = pointerActive ? pointerNX * 0.35 : Math.sin(t * 0.4) * 0.12;
    duckMesh.rotation.y += (DUCK_BASE_ROT + look - duckMesh.rotation.y) * 0.06;
    duckMesh.rotation.z = Math.sin(t * 0.6) * 0.02;
    let py = Math.sin(t * 0.5) * 0.04;
    if (duckMesh.userData.poke > 0) { duckMesh.userData.poke *= 0.85; py += (Math.random() - 0.5) * duckMesh.userData.poke; }
    duckMesh.position.y = py;
    const op = THREE.MathUtils.clamp(1 - dissolve * 2.2, 0, 1);
    duckMesh.traverse((c) => { if (c.material) c.material.opacity = op; });
    if (op <= 0.001) duckMesh.visible = false;
  } else if (duckMesh && !duckMesh.visible && introDone && dissolve < 0.4) duckMesh.visible = true;

  // частицы
  if (particles && ready) {
    particles.material.uniforms.uTime.value = t;
    particles.material.uniforms.uOpacity.value = THREE.MathUtils.smoothstep(dissolve, 0.06, 0.5);
    const N = PCOUNT, arr = particles.geometry.attributes.position.array;
    const interactive = dissolve > 0.3;
    const radius = morph > 0.7 ? INTERACT_RADIUS * 1.4 : INTERACT_RADIUS; // на мозге сильнее разлёт
    const force = morph > 0.7 ? PUSH_FORCE * 1.8 : PUSH_FORCE;
    let pushed = 0;
    for (let i = 0; i < N; i++) {
      const i3 = i * 3;
      const m = THREE.MathUtils.clamp((morph - delays[i]) / 0.6, 0, 1);
      const mm = m * m * (3 - 2 * m), inv = 1 - mm;
      const tx = inv * inv * duckPos[i3] + 2 * inv * mm * ctrlPos[i3] + mm * mm * brainPos[i3];
      const ty = inv * inv * duckPos[i3 + 1] + 2 * inv * mm * ctrlPos[i3 + 1] + mm * mm * brainPos[i3 + 1];
      const tz = inv * inv * duckPos[i3 + 2] + 2 * inv * mm * ctrlPos[i3 + 2] + mm * mm * brainPos[i3 + 2];
      if (pointerActive && interactive) {
        const dx = arr[i3] - pointer3D.x, dy = arr[i3 + 1] - pointer3D.y, dz = arr[i3 + 2] - pointer3D.z;
        const dsq = dx * dx + dy * dy + dz * dz;
        if (dsq < radius * radius) {
          const dist = Math.sqrt(dsq) + 0.001, f = 1 - dist / radius, s = f * f * force;
          vel[i3] += (dx / dist) * s; vel[i3 + 1] += (dy / dist) * s; vel[i3 + 2] += (dz / dist) * s; pushed++;
        }
      }
      vel[i3] += (tx - arr[i3]) * RETURN_SPEED; vel[i3 + 1] += (ty - arr[i3 + 1]) * RETURN_SPEED; vel[i3 + 2] += (tz - arr[i3 + 2]) * RETURN_SPEED;
      vel[i3] *= DAMPING; vel[i3 + 1] *= DAMPING; vel[i3 + 2] *= DAMPING;
      arr[i3] += vel[i3]; arr[i3 + 1] += vel[i3 + 1]; arr[i3 + 2] += vel[i3 + 2];
    }
    particles.geometry.attributes.position.needsUpdate = true;
    if (pushed > 50 && frame % 6 === 0) sound.playRustle(Math.min(pushed / 400, 1));
    particles.rotation.y += brainOpen ? 0.0004 : 0.0012;
    particles.scale.setScalar(1 + Math.sin(t * 1.5) * 0.012 * morph);
  }

  renderer.render(scene, camera);
}
animate();
addEventListener('resize', () => { camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); renderer.setSize(innerWidth, innerHeight); });

// ============================================================
// Mute / hover / глич текста
// ============================================================
const muteBtn = document.getElementById('mute-btn');
muteBtn.addEventListener('click', () => {
  const m = sound.toggleMute();
  document.getElementById('ic-sound-on').style.display = m ? 'none' : 'block';
  document.getElementById('ic-sound-off').style.display = m ? 'block' : 'none';
});
// текст реагирует глитчем (звук + класс для CSS-эффекта)
document.querySelectorAll('.hero-title, .about-title, .btn, .nav-cta, [data-t]').forEach((el) => {
  el.addEventListener('mouseenter', () => { sound.playGlitch(); el.classList.add('glitching'); setTimeout(() => el.classList.remove('glitching'), 400); });
});
document.querySelectorAll('a, button').forEach((el) => el.addEventListener('click', () => sound.playClick()));
document.querySelector('.btn-line').addEventListener('click', (e) => { e.preventDefault(); lenis.scrollTo('#about', { duration: 1.8 }); });
