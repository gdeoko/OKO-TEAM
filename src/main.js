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
const PCOUNT = isMobile ? 16000 : 30000;
const PIXEL_RATIO = Math.min(window.devicePixelRatio, 1.5);
// Hero idle: на ПК утка справа от текста; на телефоне сверху по центру.
const HERO_X = isMobile ? 0 : 2.3;
const HERO_Y = isMobile ? 2.2 : 0.1;
const SUBJ_SCALE = isMobile ? 0.7 : 1.25;   // крупнее, чтобы убрать пустоту

const sound = new SoundSystem();

// ============================================================
// Сэмплирование GLB → точки + заполнение ОБЪЁМА
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
      ax.push(va.x); ay.push(va.y); az.push(va.z); bx.push(vb.x); by.push(vb.y); bz.push(vb.z); cx.push(vc.x); cy.push(vc.y); cz.push(vc.z);
    }
  });
  const nTris = cum.length, arr = new Float32Array(count * 3);
  const pick = (target) => { let lo = 0, hi = nTris - 1; while (lo < hi) { const mid = (lo + hi) >> 1; if (cum[mid] < target) lo = mid + 1; else hi = mid; } return lo; };
  let minX = Infinity, minY = Infinity, minZ = Infinity, maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;
  for (let i = 0; i < count; i++) {
    const t = pick(Math.random() * total);
    let r1 = Math.random(), r2 = Math.random(); if (r1 + r2 > 1) { r1 = 1 - r1; r2 = 1 - r2; }
    const r3 = 1 - r1 - r2;
    arr[i * 3] = ax[t] * r3 + bx[t] * r1 + cx[t] * r2;
    arr[i * 3 + 1] = ay[t] * r3 + by[t] * r1 + cy[t] * r2;
    arr[i * 3 + 2] = az[t] * r3 + bz[t] * r1 + cz[t] * r2;
  }
  // нормализация (центр в 0, целевой размер)
  for (let i = 0; i < count; i++) { const x = arr[i*3], y = arr[i*3+1], z = arr[i*3+2]; if(x<minX)minX=x;if(x>maxX)maxX=x;if(y<minY)minY=y;if(y>maxY)maxY=y;if(z<minZ)minZ=z;if(z>maxZ)maxZ=z; }
  const cX = (minX+maxX)/2, cY = (minY+maxY)/2, cZ = (minZ+maxZ)/2;
  const scale = 2.6 / Math.max(maxX-minX, maxY-minY, maxZ-minZ);
  for (let i = 0; i < count; i++) {
    let x = (arr[i*3]-cX)*scale, y = (arr[i*3+1]-cY)*scale, z = (arr[i*3+2]-cZ)*scale;
    // ЗАПОЛНЕНИЕ ОБЪЁМА: ~45% точек утягиваем внутрь к центру (объём, а не оболочка)
    if (Math.random() < 0.45) { const f = 0.25 + Math.random() * 0.7; x *= f; y *= f; z *= f; }
    arr[i*3] = x; arr[i*3+1] = y; arr[i*3+2] = z;
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
scene.fog = new THREE.FogExp2(0x05030a, 0.01);
const camera = new THREE.PerspectiveCamera(44, innerWidth / innerHeight, 0.1, 120);
camera.position.set(0, 0.3, 9);
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
renderer.setSize(innerWidth, innerHeight);
renderer.setPixelRatio(PIXEL_RATIO);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.1;
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
dice.forEach((d) => { d.scale.setScalar(0.9); d.visible = false; scene.add(d); });

// ============================================================
// Утка + частицы
// ============================================================
const subject = new THREE.Group();
subject.position.set(HERO_X, HERO_Y, 0);
subject.scale.setScalar(SUBJ_SCALE);
scene.add(subject);
const duckKey = new THREE.PointLight(0xffffff, 16, 14); duckKey.position.set(2, 3, 4); subject.add(duckKey);
const duckRim = new THREE.PointLight(0x88ddff, 9, 14); duckRim.position.set(-3, 1, -2); subject.add(duckRim);

let duckMesh = null, particles = null;
let duckPos = null, brainPos = null, explodePos = null, vel = null, delays = null;
let tp = 0;            // transition progress 0..1 (равномерный распад)
let ready = false, introDone = false, brainOpen = false;

const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2(-10, -10);
const pointer3D = new THREE.Vector3();
let pointerActive = false, pointerNX = 0, pointerNY = 0;
// взаимодействие частиц: больше радиус, дальше уезжают, плавный возврат
const HOVER_RADIUS = 0.95, HOVER_FORCE = 0.045, RETURN = 0.018, DAMP = 0.9;

function buildParticles() {
  const N = PCOUNT;
  vel = new Float32Array(N * 3); delays = new Float32Array(N); explodePos = new Float32Array(N * 3);
  const cur = new Float32Array(N * 3), colors = new Float32Array(N * 3), sizes = new Float32Array(N);
  const palette = [new THREE.Color(0xffffff), new THREE.Color(0xc8e6ff), new THREE.Color(0x88ddff), new THREE.Color(0xffd700), new THREE.Color(0xcc0000)];
  const dir = new THREE.Vector3();
  for (let i = 0; i < N; i++) {
    cur[i*3] = duckPos[i*3]; cur[i*3+1] = duckPos[i*3+1]; cur[i*3+2] = duckPos[i*3+2];
    delays[i] = Math.random() * 0.12;  // маленькая задержка — распад почти синхронный, но органичный
    // взрыв: наружу от центра + случайный разброс, заполняет экран
    dir.set(duckPos[i*3], duckPos[i*3+1], duckPos[i*3+2]);
    if (dir.lengthSq() < 0.01) dir.set(Math.random()-0.5, Math.random()-0.5, Math.random()-0.5);
    dir.normalize();
    const spread = 3.5 + Math.random() * 3.0;
    explodePos[i*3] = duckPos[i*3] + dir.x * spread + (Math.random()-0.5) * 1.5;
    explodePos[i*3+1] = duckPos[i*3+1] + dir.y * spread + (Math.random()-0.5) * 1.5;
    explodePos[i*3+2] = duckPos[i*3+2] + dir.z * spread + (Math.random()-0.5) * 1.5;
    const hf = (duckPos[i*3+1] + 1.3) / 2.6, r = Math.random();
    let ci; if (hf > 0.85) ci = r > 0.6 ? 3 : 0; else if (r < 0.06) ci = 4; else if (r < 0.5) ci = 0; else if (r < 0.85) ci = 1; else ci = 2;
    const col = palette[ci]; colors[i*3]=col.r; colors[i*3+1]=col.g; colors[i*3+2]=col.b;
    sizes[i] = 0.09 + Math.random() * 0.16;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(cur, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geo.setAttribute('size', new THREE.BufferAttribute(sizes, 1));
  const mat = new THREE.ShaderMaterial({
    uniforms: { uPixelRatio: { value: PIXEL_RATIO }, uTime: { value: 0 }, uOpacity: { value: 0 } },
    vertexShader: `attribute float size; varying vec3 vColor; varying float vAlpha; uniform float uPixelRatio; uniform float uTime;
      void main(){ vColor=color; float tw=0.72+0.28*sin(uTime*2.2+position.x*7.0+position.y*5.0); vAlpha=tw;
      vec4 mv=modelViewMatrix*vec4(position,1.0); gl_PointSize=size*uPixelRatio*(200.0/-mv.z); gl_Position=projectionMatrix*mv; }`,
    fragmentShader: `varying vec3 vColor; varying float vAlpha; uniform float uOpacity;
      void main(){ vec2 uv=gl_PointCoord-vec2(0.5); float d=length(uv); if(d>0.5)discard;
      float a=pow(1.0-smoothstep(0.0,0.5,d),1.8); gl_FragColor=vec4(vColor,a*vAlpha*uOpacity); }`,
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
    duck.traverse((c) => { if (c.material) { c.material = c.material.clone(); c.material.transparent = true; c.material.envMapIntensity = 1.3; } });
    duckMesh = duck;
    duckMesh.rotation.y = 0;     // лицо утки = +Z = к камере (НЕ поворачиваем)
    duckMesh.visible = false; subject.add(duckMesh);
    buildParticles();
    document.getElementById('loader').classList.add('hidden');
    startIntro();
  })
  .catch((e) => { console.error(e); document.querySelector('.loader-txt').textContent = 'Не удалось загрузить модели. Обнови страницу.'; });

// ============================================================
// Вход-занавес: кубики → утка выходит справа → поворот клювом → текст
// ============================================================
function startIntro() {
  const tl = gsap.timeline();
  dice.forEach((d, i) => { d.position.set(i === 0 ? -0.9 : 0.9, 7, 0.5); d.rotation.set(Math.random()*3, Math.random()*3, Math.random()*3); d.visible = true; });
  tl.fromTo(dice[0].position, { y: 7 }, { y: -8, duration: 1.7, ease: 'power1.in' }, 0.1);
  tl.fromTo(dice[1].position, { y: 7.6 }, { y: -8, duration: 1.7, ease: 'power1.in' }, 0.28);
  tl.to(dice[0].rotation, { x: '+=7', z: '+=5', duration: 1.7 }, 0.1);
  tl.to(dice[1].rotation, { x: '+=6', y: '+=7', duration: 1.7 }, 0.28);
  tl.add(() => dice.forEach((d) => (d.visible = false)), 1.85);
  tl.add(() => { if (duckMesh) { duckMesh.visible = true; sound.playFormation(); } }, 1.7);
  if (duckMesh) {
    duckMesh.position.x = isMobile ? 4 : 6; duckMesh.rotation.y = 0.8;  // выходит справа, вполоборота
    tl.to(duckMesh.position, { x: 0, duration: 1.7, ease: 'power2.out' }, 1.7);
    tl.to(duckMesh.rotation, { y: 0, duration: 1.4, ease: 'power2.out' }, 2.5); // поворот клювом ровно к зрителю
  }
  tl.add(() => document.body.classList.add('hero-in'), 2.4);
  tl.add(() => { introDone = true; }, 4.0);
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

function hitSubject(x, y) {
  pointer.x = (x / innerWidth) * 2 - 1; pointer.y = -(y / innerHeight) * 2 + 1;
  const c = subject.position.clone().project(camera);
  const dx = pointer.x - c.x, dy = pointer.y - c.y;
  return Math.sqrt(dx * dx + dy * dy) < 0.32;
}
addEventListener('click', (e) => {
  if (!introDone || brainOpen) return;
  if (tp < 0.2 && duckMesh && duckMesh.visible && hitSubject(e.clientX, e.clientY)) { sound.playQuack(); duckMesh.userData.poke = 0.3; }
  else if (tp > 0.75 && hitSubject(e.clientX, e.clientY)) openBrain();
});

// ============================================================
// Вход внутрь мозга (попап с затемнением)
// ============================================================
function openBrain() { brainOpen = true; document.body.classList.add('brain-open'); sound.playWhoosh(true); }
function closeBrain() { brainOpen = false; document.body.classList.remove('brain-open'); sound.playWhoosh(false); }
document.getElementById('brain-detail').addEventListener('click', (e) => { if (e.target.id === 'brain-detail' || e.target.id === 'brain-back') closeBrain(); });

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
let scrollProgress = 0;
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
  // tp — равномерный прогресс перехода на весь скролл (0..1)
  tp = THREE.MathUtils.clamp(scrollProgress / 0.95, 0, 1);
  // Hero-текст растворяется НА МЕСТЕ в самом начале
  const hf = THREE.MathUtils.clamp(tp / 0.14, 0, 1);
  heroInner.style.opacity = String(1 - hf);
  heroInner.style.filter = `blur(${hf * 7}px)`;
  heroInner.style.pointerEvents = hf > 0.5 ? 'none' : 'auto';
  scrollHint.style.opacity = String(Math.max(0, 1 - tp * 6));
  // About-текст проявляется в самом конце (мозг собран)
  const af = THREE.MathUtils.clamp((tp - 0.8) / 0.2, 0, 1);
  aboutInner.style.opacity = String(af);
  aboutInner.style.transform = `scale(${0.95 + af * 0.05})`;
  aboutInner.style.pointerEvents = af > 0.5 ? 'auto' : 'none';
  counter.textContent = (tp > 0.5 ? '02' : '01') + ' / 08';
}

// ============================================================
// Цикл
// ============================================================
const clock = new THREE.Clock();
let frame = 0;
const easeIO = (a) => a * a * (3 - 2 * a);
function animate() {
  requestAnimationFrame(animate);
  const t = clock.getElapsedTime(); frame++;
  env.update(t, camera, tp);

  // цвет фона по фазе
  if (tp > 0.55) env.setColors(0x140626, 0x05030f);
  else env.setColors(0x2a0608, 0x0a0414);

  // КАМЕРА СТРОГО ВПЕРЁД: влетаем внутрь облака (z↓), затем выходим к мозгу (z↑)
  let targetZ;
  if (brainOpen) targetZ = 2.0;
  else if (tp < 0.5) targetZ = 9 - easeIO(tp / 0.5) * 8.2;     // 9 → 0.8 (внутрь)
  else targetZ = 0.8 + easeIO((tp - 0.5) / 0.5) * 5.7;          // 0.8 → 6.5 (к мозгу)
  camera.position.z += (targetZ - camera.position.z) * 0.07;
  // параллакс мыши только в Hero (когда не в переходе)
  const par = Math.max(0, 1 - tp * 6);
  camera.position.x += ((pointerNX * 0.3 * par) - camera.position.x) * 0.03;
  camera.position.y += ((0.3 + (-pointerNY * 0.18 * par) + Math.sin(t * 0.3) * 0.04) - camera.position.y) * 0.03;
  // subject уезжает в центр в самом начале распада → камера летит прямо в него
  const toCenter = THREE.MathUtils.clamp(tp / 0.12, 0, 1);
  subject.position.x += ((HERO_X * (1 - toCenter)) - subject.position.x) * 0.08;
  subject.position.y += ((HERO_Y * (1 - toCenter) + 0.1 * toCenter) - subject.position.y) * 0.08;
  camera.lookAt(subject.position.x, subject.position.y * 0.6, 0);
  env.fade(1 - tp * 0.55);

  // твёрдая утка: видна только в самом начале (быстрый кроссфейд в частицы)
  if (duckMesh) {
    const solid = THREE.MathUtils.clamp(1 - tp / 0.1, 0, 1);
    if (solid > 0.001) {
      if (!duckMesh.visible && introDone) duckMesh.visible = true;
      const look = pointerActive && tp < 0.05 ? pointerNX * 0.3 : Math.sin(t * 0.4) * 0.1;
      duckMesh.rotation.y += (look - duckMesh.rotation.y) * 0.06;
      duckMesh.rotation.z = Math.sin(t * 0.6) * 0.02;
      let py = Math.sin(t * 0.5) * 0.04;
      if (duckMesh.userData.poke > 0) { duckMesh.userData.poke *= 0.85; py += (Math.random() - 0.5) * duckMesh.userData.poke; }
      duckMesh.position.y = py;
      duckMesh.traverse((c) => { if (c.material) c.material.opacity = solid; });
    } else if (duckMesh.visible) duckMesh.visible = false;
  }

  // ЧАСТИЦЫ: непрерывный РАВНОМЕРНЫЙ распад утка→взрыв→мозг по tp
  if (particles && ready) {
    particles.material.uniforms.uTime.value = t;
    particles.material.uniforms.uOpacity.value = THREE.MathUtils.smoothstep(tp, 0.02, 0.12);
    const N = PCOUNT, arr = particles.geometry.attributes.position.array;
    const onBrain = tp > 0.75;
    const radius = onBrain ? HOVER_RADIUS : HOVER_RADIUS * 0.6;
    const force = onBrain ? HOVER_FORCE : HOVER_FORCE * 0.5;
    let pushed = 0;
    for (let i = 0; i < N; i++) {
      const i3 = i * 3;
      // равномерный путь: duck →(0..0.5)→ explode →(0.5..1)→ brain, с лёгкой задержкой
      const lp = THREE.MathUtils.clamp((tp - delays[i]) / (1 - 0.12), 0, 1);
      let tx, ty, tz;
      if (lp < 0.5) { const a = easeIO(lp / 0.5);
        tx = duckPos[i3] + (explodePos[i3] - duckPos[i3]) * a;
        ty = duckPos[i3+1] + (explodePos[i3+1] - duckPos[i3+1]) * a;
        tz = duckPos[i3+2] + (explodePos[i3+2] - duckPos[i3+2]) * a;
      } else { const a = easeIO((lp - 0.5) / 0.5);
        tx = explodePos[i3] + (brainPos[i3] - explodePos[i3]) * a;
        ty = explodePos[i3+1] + (brainPos[i3+1] - explodePos[i3+1]) * a;
        tz = explodePos[i3+2] + (brainPos[i3+2] - explodePos[i3+2]) * a;
      }
      // взаимодействие с курсором (дальше уезжают, плавно возвращаются)
      if (pointerActive && (tp < 0.05 || onBrain)) {
        const dx = arr[i3] - pointer3D.x, dy = arr[i3+1] - pointer3D.y, dz = arr[i3+2] - pointer3D.z;
        const dsq = dx*dx + dy*dy + dz*dz;
        if (dsq < radius * radius) {
          const dist = Math.sqrt(dsq) + 0.001, f = 1 - dist / radius, s = f * f * force;
          vel[i3] += (dx/dist)*s; vel[i3+1] += (dy/dist)*s; vel[i3+2] += (dz/dist)*s; pushed++;
        }
      }
      vel[i3] += (tx - arr[i3]) * RETURN; vel[i3+1] += (ty - arr[i3+1]) * RETURN; vel[i3+2] += (tz - arr[i3+2]) * RETURN;
      vel[i3] *= DAMP; vel[i3+1] *= DAMP; vel[i3+2] *= DAMP;
      arr[i3] += vel[i3]; arr[i3+1] += vel[i3+1]; arr[i3+2] += vel[i3+2];
    }
    particles.geometry.attributes.position.needsUpdate = true;
    if (pushed > 40 && frame % 5 === 0) sound.playRustle(Math.min(pushed / 350, 1));
    particles.rotation.y += brainOpen ? 0.0003 : (onBrain ? 0.0011 : 0.0006);
    particles.scale.setScalar(1 + Math.sin(t * 1.5) * 0.012 * (tp > 0.75 ? 1 : 0));
  }

  renderer.render(scene, camera);
}
animate();
addEventListener('resize', () => { camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); renderer.setSize(innerWidth, innerHeight); });

// ============================================================
// Mute / hover / глич текста
// ============================================================
document.getElementById('mute-btn').addEventListener('click', () => {
  const m = sound.toggleMute();
  document.getElementById('ic-sound-on').style.display = m ? 'none' : 'block';
  document.getElementById('ic-sound-off').style.display = m ? 'block' : 'none';
});
document.querySelectorAll('.hero-title, .about-title, .btn, .nav-cta, [data-t]').forEach((el) => {
  el.addEventListener('mouseenter', () => { sound.playGlitch(); el.classList.add('glitching'); setTimeout(() => el.classList.remove('glitching'), 400); });
});
document.querySelectorAll('a, button').forEach((el) => el.addEventListener('click', () => sound.playClick()));
document.querySelector('.btn-line').addEventListener('click', (e) => { e.preventDefault(); lenis.scrollTo('#about', { duration: 1.8 }); });
