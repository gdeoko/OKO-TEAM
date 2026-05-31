import './style.css';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import Lenis from 'lenis';
import gsap from 'gsap';
import { SoundSystem } from './audio/sound-system.js';
import { ClubEnvironment } from './three/environment.js';

// Режим настройки камеры: ducks.games/?tune — двигаешь сцену пальцем, в углу цифры + копировать
const TUNE = new URLSearchParams(location.search).has('tune');

// Декодер Draco — ЛОКАЛЬНЫЙ (в папке draco/ на хостинге), не зависит от внешних CDN/VPN
const dracoLoader = new DRACOLoader();
dracoLoader.setDecoderPath('draco/');

let orbit = null;   // OrbitControls в режиме настройки (?tune); объявлен до animate()

// ============================================================
// Устройство / конфиг
// ============================================================
const isMobile = window.matchMedia('(max-width: 768px)').matches || !window.matchMedia('(hover: hover)').matches;
const PCOUNT = isMobile ? 24000 : 42000;   // плотно, но без подвисаний при сэмплинге
const PIXEL_RATIO = Math.min(window.devicePixelRatio, 1.5);
// Утка/мозг ВСЕГДА по центру по X. На телефоне чуть выше (текст сверху+снизу).
const HERO_X = 0;
const HERO_Y = isMobile ? 0.35 : 0.25;
const SUBJ_SCALE = isMobile ? 0.92 : 1.6;   // ровный размер, не залезает на текст
// Угол поворота утки (клювом в камеру). Подбор: добавь ?duck=ГРАДУСЫ к адресу
// (например ducks.games/?duck=90), покрути, найди фронтальный — скажи число, зафиксирую.
const _duckDeg = new URLSearchParams(location.search).get('duck');
const DUCK_FACE = _duckDeg !== null ? (parseFloat(_duckDeg) * Math.PI / 180) : (270 * Math.PI / 180);

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
    // ПЛОТНОЕ ЗАПОЛНЕНИЕ ОБЪЁМА (как igloo): большинство точек тянем внутрь —
    // фигура читается как объём, а не просвечивающая оболочка
    if (Math.random() < 0.7) { const f = Math.pow(Math.random(), 0.5); x *= f; y *= f; z *= f; }
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
// отладка камеры/сцены из консоли и для проверки в браузере
window.__scene = scene; window.__camera = camera;
// подбор высоты взгляда камеры через ?look=Y и высоты камеры ?camy=Y
const _qp = new URLSearchParams(location.search);
const LOOK_Y = _qp.has('look') ? parseFloat(_qp.get('look')) : 1.5;
const CAM_Y = _qp.has('camy') ? parseFloat(_qp.get('camy')) : 0.5;
const CAM_Z = _qp.has('camz') ? parseFloat(_qp.get('camz')) : 4.5;
const ROT_Y = _qp.has('roty') ? parseFloat(_qp.get('roty')) * Math.PI / 180 : 0;  // поворот зала (найти стену с окном)
// тонкая подстройка фигуры на луче взгляда: ?dx ?dy сдвиг, ?dist расстояние от камеры
const DUCK_PX = _qp.has('dx') ? parseFloat(_qp.get('dx')) : 0;
const DUCK_PY = _qp.has('dy') ? parseFloat(_qp.get('dy')) : 0;
const DUCK_DIST = _qp.has('dist') ? parseFloat(_qp.get('dist')) : (isMobile ? 6.5 : 4.6);  // на ПК ближе=крупнее
const _camDir = new THREE.Vector3();
const _zero = new THREE.Vector3(0, 0, 0);
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
renderer.setSize(innerWidth, innerHeight);
renderer.setPixelRatio(PIXEL_RATIO);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 0.78;
renderer.outputColorSpace = THREE.SRGBColorSpace;

const env = new ClubEnvironment(scene, isMobile, renderer);
if (ROT_Y) env.group.rotation.y = ROT_Y;   // поворот зала для подбора ракурса

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

// мягкая тень-пятно под каждым кубиком (реализм «летят по столу»)
function shadowTexture() {
  const c = document.createElement('canvas'); c.width = 128; c.height = 128;
  const x = c.getContext('2d'); const g = x.createRadialGradient(64, 64, 2, 64, 64, 64);
  g.addColorStop(0, 'rgba(0,0,0,0.55)'); g.addColorStop(1, 'rgba(0,0,0,0)');
  x.fillStyle = g; x.fillRect(0, 0, 128, 128);
  return new THREE.CanvasTexture(c);
}
const shadowTex = shadowTexture();
const diceShadows = dice.map(() => {
  const s = new THREE.Mesh(new THREE.PlaneGeometry(2.2, 2.2), new THREE.MeshBasicMaterial({ map: shadowTex, transparent: true, depthWrite: false, opacity: 0 }));
  s.rotation.x = -Math.PI / 2; s.position.y = -2.6; s.visible = false; scene.add(s); return s;
});
const FLOOR_Y = -2.6;   // «стол»

// ============================================================
// Утка + частицы
// ============================================================
const subject = new THREE.Group();
subject.position.set(HERO_X, HERO_Y, 0);
subject.scale.setScalar(SUBJ_SCALE);
scene.add(subject);
// свет на утку: тёплый ключевой спереди + неоновый контровой, чтобы не была тёмной
const duckKey = new THREE.PointLight(0xfff2e8, 40, 18); duckKey.position.set(2.5, 3, 5); subject.add(duckKey);
const duckRim = new THREE.PointLight(0xff44aa, 14, 16); duckRim.position.set(-3, 1.5, -1); subject.add(duckRim);
const duckFill = new THREE.PointLight(0x88ccff, 16, 18); duckFill.position.set(0, 0.5, 6); subject.add(duckFill);

let duckMesh = null, particles = null;
let duckPos = null, brainPos = null, explodePos = null, tunnelPos = null, vel = null, delays = null;
let tp = 0;            // transition progress 0..1 (равномерный распад)
let ready = false, introDone = false, brainOpen = false;
let tunnelBlend = 0;   // 0 = мозг, 1 = туннель (плавно)
let camYaw = 0;        // поворот камеры вправо к бару
let flowZ = 0;         // фаза непрерывного потока частиц в туннеле

const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2(-10, -10);
const pointer3D = new THREE.Vector3();
let pointerActive = false, pointerNX = 0, pointerNY = 0;
// взаимодействие частиц: больше радиус, дальше уезжают, плавный возврат
const HOVER_RADIUS = 0.8, HOVER_FORCE = 0.05, RETURN = 0.045, DAMP = 0.86;

function buildParticles() {
  const N = PCOUNT;
  vel = new Float32Array(N * 3); delays = new Float32Array(N); explodePos = new Float32Array(N * 3);
  tunnelPos = new Float32Array(N * 3);
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
    const spread = 2.2 + Math.random() * 2.2;
    explodePos[i*3] = duckPos[i*3] + dir.x * spread + (Math.random()-0.5) * 1.2;
    explodePos[i*3+1] = duckPos[i*3+1] + dir.y * spread + (Math.random()-0.5) * 1.2;
    explodePos[i*3+2] = duckPos[i*3+2] + dir.z * spread + (Math.random()-0.5) * 1.2;
    // ТУННЕЛЬ: каждая частица на кольце (угол + радиус) и со своей фазой глубины.
    // В цикле глубина едет К КАМЕРЕ → ощущение полёта сквозь трубу.
    tunnelPos[i*3] = Math.random() * Math.PI * 2;            // угол на кольце
    tunnelPos[i*3+1] = 2.3 + Math.random() * 1.1;           // радиус трубы (полые, видна стенка)
    tunnelPos[i*3+2] = Math.random();                        // фаза глубины 0..1
    const hf = (duckPos[i*3+1] + 1.3) / 2.6, r = Math.random();
    let ci; if (hf > 0.85) ci = r > 0.6 ? 3 : 0; else if (r < 0.06) ci = 4; else if (r < 0.5) ci = 0; else if (r < 0.85) ci = 1; else ci = 2;
    const col = palette[ci]; colors[i*3]=col.r; colors[i*3+1]=col.g; colors[i*3+2]=col.b;
    sizes[i] = 0.035 + Math.random() * 0.05;  // мелкие плотные зёрна (igloo)
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(cur, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geo.setAttribute('size', new THREE.BufferAttribute(sizes, 1));
  const mat = new THREE.ShaderMaterial({
    uniforms: { uPixelRatio: { value: PIXEL_RATIO }, uTime: { value: 0 }, uOpacity: { value: 0 } },
    vertexShader: `attribute float size; varying vec3 vColor; varying float vSh; uniform float uPixelRatio; uniform float uTime;
      void main(){ vColor=color;
        // лёгкая разница яркости по позиции — объём как у песчинок igloo
        vSh=0.78+0.22*sin(position.y*9.0+position.x*7.0);
        vec4 mv=modelViewMatrix*vec4(position,1.0);
        gl_PointSize=size*uPixelRatio*(300.0/-mv.z); gl_Position=projectionMatrix*mv; }`,
    fragmentShader: `varying vec3 vColor; varying float vSh; uniform float uOpacity;
      void main(){ vec2 uv=gl_PointCoord-vec2(0.5); float d=length(uv); if(d>0.5)discard;
        // плотное зерно: яркая верхушка (свет сверху), тёмный низ — объём, не плоская точка
        float shade=0.55+0.45*(-uv.y+0.5);
        float core=smoothstep(0.5,0.30,d);
        gl_FragColor=vec4(vColor*vSh*shade, core*uOpacity); }`,
    vertexColors: true, transparent: true, blending: THREE.NormalBlending, depthWrite: true, depthTest: true,
  });
  particles = new THREE.Points(geo, mat);
  particles.renderOrder = 2;
  subject.add(particles);
  ready = true;
}

// ============================================================
// Загрузка с прогрессом
// ============================================================
const ldBar = document.querySelector('.ld-bar i');
const mgr = new THREE.LoadingManager();
mgr.onProgress = (url, loaded, total) => { if (ldBar) ldBar.style.width = Math.round((loaded / total) * 100) + '%'; };
const loader = new GLTFLoader(mgr);
loader.setDRACOLoader(dracoLoader);
const load = (url) => new Promise((res, rej) => loader.load(url, (g) => res(g.scene), null, rej));
// Страховка: прелоадер не висит вечно — максимум 12 сек, потом скрываем в любом случае
const loaderFailSafe = setTimeout(() => {
  const l = document.getElementById('loader'); if (l) l.classList.add('hidden');
}, 12000);
// относительные пути (без ведущего слеша) — надёжнее на любом хостинге
Promise.all([load('models/duck.glb'), load('models/brain.glb')])
  .then(([duck, brain]) => {
    clearTimeout(loaderFailSafe);
    duckPos = sampleModel(duck, PCOUNT);
    brainPos = sampleModel(brain, PCOUNT);
    normalize(duck, 2.6);
    duck.traverse((c) => { if (c.material) { c.material = c.material.clone(); c.material.transparent = true; c.material.envMapIntensity = 2.2; if (c.material.emissive) { c.material.emissive.setHex(0x1a1420); c.material.emissiveIntensity = 0.35; } } });
    // оборачиваем в группу, чтобы свободно масштабировать (нормализация уже внутри)
    duckMesh = new THREE.Group();
    duckMesh.add(duck);
    duckMesh.rotation.y = DUCK_FACE;   // единый угол везде, без рассинхрона
    duckMesh.visible = false; subject.add(duckMesh);
    buildParticles();
    if (ldBar) ldBar.style.width = '100%';
    setTimeout(() => document.getElementById('loader').classList.add('hidden'), 350);
    // интро (кубики→утка) запускаем ПОСЛЕ исчезновения прелоадера, чтобы кубики были видны
    setTimeout(startIntro, 1200);
  })
  .catch((e) => {
    console.error('Ошибка загрузки моделей:', e);
    const tg = document.querySelector('.ld-tag');
    // показываем КАКОЙ файл не нашёлся — диагностика прямо на экране
    const url = (e && (e.target && e.target.responseURL || e.message)) || 'models/*.glb';
    if (tg) { tg.textContent = 'не найдены модели: ' + url; tg.style.color = '#ff5555'; tg.style.maxWidth = '90%'; tg.style.textAlign = 'center'; }
  });

// ============================================================
// Вход-занавес: кубики → утка выходит справа → поворот клювом → текст
// ============================================================
function startIntro() {
  // быстрый путь (?fast) — для проверки финальной композиции без ожидания интро
  if (_qp.has('fast')) {
    if (duckMesh) { duckMesh.visible = true; duckMesh.rotation.y = DUCK_FACE; duckMesh.position.set(0, HERO_Y, 0); duckMesh.scale.set(1, 1, 1); }
    document.body.classList.add('hero-in'); introDone = true; return;
  }
  const tl = gsap.timeline();
  // тени включаем, кубики стартуют сверху и летят с отскоками по «столу»
  dice.forEach((d, i) => {
    d.position.set(i === 0 ? -1.4 : 1.2, 6, 0.6);
    d.rotation.set(Math.random()*3, Math.random()*3, Math.random()*3);
    d.visible = true; diceShadows[i].visible = true;
  });
  sound.playDiceRoll();   // звук броска по столу

  dice.forEach((d, i) => {
    const startX = d.position.x;
    const endX = startX + (i === 0 ? -2.2 : 2.4);   // укатываются в стороны
    // падение + 2 отскока (имитация физики), затем уход за край
    tl.to(d.position, { keyframes: [
      { y: FLOOR_Y, duration: 0.55, ease: 'power2.in' },
      { y: FLOOR_Y + 1.0, duration: 0.3, ease: 'power2.out' },
      { y: FLOOR_Y, duration: 0.25, ease: 'power2.in' },
      { y: FLOOR_Y + 0.4, duration: 0.18, ease: 'power2.out' },
      { y: FLOOR_Y, duration: 0.15, ease: 'power2.in' },
      { y: -9, duration: 0.7, ease: 'power1.in' },
    ] }, 0.05 + i * 0.12);
    tl.to(d.position, { x: endX, duration: 2.1, ease: 'power1.out' }, 0.05 + i * 0.12);
    tl.to(d.rotation, { x: `+=${6 + Math.random()*3}`, z: `+=${4 + Math.random()*3}`, duration: 2.1, ease: 'power1.out' }, 0.05 + i * 0.12);
  });
  tl.add(() => { sound.playThump?.(); }, 0.6);
  tl.add(() => dice.forEach((d, i) => { d.visible = false; diceShadows[i].visible = false; }), 2.2);

  // утка ПРИХОДИТ ИЗ ГЛУБИНЫ по центру: маленькая вдали → растёт → встаёт на позицию, смотрит в камеру
  tl.add(() => { if (duckMesh) { duckMesh.visible = true; sound.playFormation(); } }, 1.9);
  if (duckMesh) {
    duckMesh.position.set(0, HERO_Y - 0.3, -16);   // далеко в глубине
    duckMesh.rotation.y = DUCK_FACE;                 // лицом к камере
    duckMesh.scale.setScalar(0.15);
    tl.to(duckMesh.position, { z: 0, y: HERO_Y, duration: 2.0, ease: 'power2.out' }, 1.9);
    tl.to(duckMesh.scale, { x: 1, y: 1, z: 1, duration: 2.0, ease: 'power2.out' }, 1.9);
  }
  tl.add(() => document.body.classList.add('hero-in'), 2.4);
  tl.add(() => { introDone = true; }, 4.2);
}

// тени кубиков в цикле (масштаб/непрозрачность зависят от высоты)
function updateDiceShadows() {
  dice.forEach((d, i) => {
    const s = diceShadows[i];
    if (!d.visible) { s.visible = false; return; }
    s.visible = true; s.position.x = d.position.x; s.position.z = d.position.z;
    const h = THREE.MathUtils.clamp((d.position.y - FLOOR_Y) / 6, 0, 1);
    const sc = 0.8 + h * 1.6; s.scale.setScalar(sc);
    s.material.opacity = (1 - h) * 0.6;
  });
}

// ============================================================
// Указатель
// ============================================================
const _hitWorld = new THREE.Vector3();
function updatePointer(x, y) {
  pointer.x = (x / innerWidth) * 2 - 1; pointer.y = -(y / innerHeight) * 2 + 1;
  pointerNX = pointer.x; pointerNY = pointer.y; pointerActive = true;
  raycaster.setFromCamera(pointer, camera);
  // точка на плоскости, проходящей через центр subject и обращённой к камере —
  // это убирает смещение по глубине, любая часть фигуры реагирует точно
  const planeNormal = camera.getWorldDirection(new THREE.Vector3()).negate();
  const plane = new THREE.Plane().setFromNormalAndCoplanarPoint(planeNormal, subject.getWorldPosition(new THREE.Vector3()));
  raycaster.ray.intersectPlane(plane, _hitWorld);
  // переводим МИРОВУЮ точку в ЛОКАЛЬНУЮ систему particles (учитывает вращение и масштаб)
  if (particles) { particles.worldToLocal(pointer3D.copy(_hitWorld)); }
  else { pointer3D.copy(_hitWorld).sub(subject.position).divideScalar(subject.scale.x); }
}
addEventListener('mousemove', (e) => updatePointer(e.clientX, e.clientY));
addEventListener('touchmove', (e) => { if (e.touches[0]) updatePointer(e.touches[0].clientX, e.touches[0].clientY); }, { passive: true });
addEventListener('mouseleave', () => { pointerActive = false; });
// КРИТИЧНО: на телефоне сбрасываем указатель после касания, иначе звук частиц звучит постоянно
addEventListener('touchend', () => { pointerActive = false; });
addEventListener('touchcancel', () => { pointerActive = false; });

function hitSubject(x, y, r = 0.32) {
  pointer.x = (x / innerWidth) * 2 - 1; pointer.y = -(y / innerHeight) * 2 + 1;
  const c = subject.getWorldPosition(new THREE.Vector3()).project(camera);
  const dx = pointer.x - c.x, dy = pointer.y - c.y;
  return Math.sqrt(dx * dx + dy * dy) < r;
}
addEventListener('click', (e) => {
  if (!introDone || brainOpen) return;
  if (tp < 0.2 && duckMesh && duckMesh.visible && hitSubject(e.clientX, e.clientY)) { sound.playQuack(); duckMesh.userData.poke = 0.3; }
  else if (tp > 0.7 && hitSubject(e.clientX, e.clientY, 0.55)) openBrain();   // мозг крупный — больше зона
});

// ============================================================
// Вход внутрь мозга (попап с затемнением)
// ============================================================
function openBrain() {
  if (brainOpen) return;
  brainOpen = true; document.body.classList.add('brain-open');
  sound.playWhoosh(true); lenis.stop();   // блокируем скролл пока внутри
}
function closeBrain() {
  if (!brainOpen) return;
  brainOpen = false; document.body.classList.remove('brain-open');
  sound.playWhoosh(false); lenis.start();
}
window.__openBrain = openBrain; window.__closeBrain = closeBrain;   // для проверки в браузере
// клик по фону попапа закрывает; клик по кнопке — тоже (с остановкой всплытия)
document.getElementById('brain-detail').addEventListener('click', (e) => { if (e.target.id === 'brain-detail') closeBrain(); });
const brainBackBtn = document.getElementById('brain-back');
brainBackBtn.addEventListener('click', (e) => { e.stopPropagation(); closeBrain(); });
brainBackBtn.addEventListener('touchend', (e) => { e.preventDefault(); e.stopPropagation(); closeBrain(); }, { passive: false });
addEventListener('keydown', (e) => { if (e.key === 'Escape') closeBrain(); });

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

const heroTop = document.querySelector('.hero-top');
const heroBottom = document.querySelector('.hero-bottom');
const heroEls = [heroTop, heroBottom];
const scrollHint = document.querySelector('.scroll-hint');
const counter = document.getElementById('section-counter');
function updateUIByScroll() {
  tp = THREE.MathUtils.clamp(scrollProgress / 0.95, 0, 1);
  // Hero-текст растворяется НА МЕСТЕ в начале (fade + blur)
  const hf = THREE.MathUtils.clamp(tp / 0.14, 0, 1);
  heroEls.forEach((el) => { if (el) { el.style.opacity = String(1 - hf); el.style.filter = `blur(${hf * 7}px)`; el.style.pointerEvents = hf > 0.5 ? 'none' : 'auto'; } });
  scrollHint.style.opacity = String(Math.max(0, 1 - tp * 6));
  // About проявляется в самом конце (мозг собран) — класс включает все элементы About
  document.body.classList.toggle('about-in', tp > 0.82);
  counter.textContent = (tp > 0.5 ? '02' : '01') + ' / 08';
}

// ============================================================
// Цикл
// ============================================================
const clock = new THREE.Clock();
let frame = 0, elapsed = 0;
const easeIO = (a) => a * a * (3 - 2 * a);
function animate() {
  requestAnimationFrame(animate);
  const dt = Math.min(clock.getDelta(), 0.05); elapsed += dt; const t = elapsed; frame++;
  env.update(t, camera, tp, dt);
  updateDiceShadows();

  // ЗВУКОВЫЕ СЛОИ по сцене (поверх фонового пэда), как у igloo
  if (audioStarted && frame % 12 === 0) {
    sound.setLayer('metel', THREE.MathUtils.clamp(1 - tp * 3, 0, 1));        // воздух/метель в Hero
    sound.setLayer('rustle', THREE.MathUtils.clamp(1 - Math.abs(tp - 0.5) * 3, 0, 1)); // шелест при распаде
    sound.setLayer('hum', brainOpen ? 1 : THREE.MathUtils.clamp((tp - 0.6) / 0.4, 0, 1)); // гул у мозга/в туннеле
  }

  // (фон — 3D-клуб)

  if (!TUNE) {
    // КАМЕРА: зафиксированный ракурс (подобран клиентом). Едет ВПЕРЁД вглубь по скроллу.
    const CAM0 = { x: 0.39, y: 0.10, z: 20.69 };
    const LOOK = { x: -0.49, y: -5.52, z: -8.27 };
    if (brainOpen) {
      // ВНУТРИ ТУННЕЛЯ: subject в начало координат, камера у входа трубы смотрит вглубь (-Z),
      // труба летит на камеру (см. логику частиц). Ровный полёт вперёд, без перекосов.
      subject.position.lerp(_zero, 0.1);
      camera.position.x += (0 - camera.position.x) * 0.08;
      camera.position.y += (0 - camera.position.y) * 0.08;
      camera.position.z += (6 - camera.position.z) * 0.08;
      camera.lookAt(0, 0, -10);
    } else {
      const zPos = CAM0.z - easeIO(tp) * 14;
      const par = Math.max(0, 1 - tp * 6);
      camera.position.x += ((CAM0.x + pointerNX * 0.4 * par) - camera.position.x) * 0.04;
      camera.position.y += ((CAM0.y + (-pointerNY * 0.25 * par) + Math.sin(t * 0.3) * 0.05) - camera.position.y) * 0.04;
      camera.position.z += (zPos - camera.position.z) * 0.05;
      camera.lookAt(LOOK.x, LOOK.y, LOOK.z);
      // ФИГУРА на луче взгляда камеры, фикс. расстояние → ровно по центру кадра
      _camDir.set(LOOK.x - CAM0.x, LOOK.y - CAM0.y, LOOK.z - CAM0.z).normalize();
      const dist = DUCK_DIST - easeIO(tp) * 2.5;
      subject.position.x += ((camera.position.x + _camDir.x * dist + DUCK_PX) - subject.position.x) * 0.1;
      subject.position.y += ((camera.position.y + _camDir.y * dist + DUCK_PY) - subject.position.y) * 0.1;
      subject.position.z += ((camera.position.z + _camDir.z * dist) - subject.position.z) * 0.1;
    }
  } else if (orbit) {
    orbit.update();
    updateTuneHUD();
  }
  env.fade(1 - tp * 0.5);

  // твёрдая утка: видна только в самом начале (быстрый кроссфейд в частицы)
  if (duckMesh) {
    const solid = THREE.MathUtils.clamp(1 - tp / 0.1, 0, 1);
    if (solid > 0.001) {
      if (!duckMesh.visible && introDone) duckMesh.visible = true;
      // утка СТРОГО ровно в камеру; чуть провожает курсор, без наклона и рысканья
      const look = DUCK_FACE + (pointerActive && tp < 0.05 ? pointerNX * 0.1 : 0);
      duckMesh.rotation.y += (look - duckMesh.rotation.y) * 0.05;
      duckMesh.rotation.z = 0;            // никакого наклона — стоит ровно
      // лёгкое покачивание (локально внутри subject, от нуля)
      let py = Math.sin(t * 0.5) * 0.03;
      if (duckMesh.userData.poke > 0) { duckMesh.userData.poke *= 0.9; py += duckMesh.userData.poke * 0.12; }
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
    let pushed = 0, moveSum = 0, moveDir = 0;
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
      // ТУННЕЛЬ: труба из колец, ЛЕТЯЩАЯ на камеру (полёт сквозь). Частицы по кругу,
      // глубина из фазы непрерывно едет к зрителю и зацикливается.
      if (tunnelBlend > 0.001) {
        const ang = tunnelPos[i3];                  // угол на кольце
        const rad = tunnelPos[i3+1];                // радиус трубы
        // фаза 0..1 → глубина: дальняя -26, у камеры +6, циклично; flowZ гонит поток
        const ph = (tunnelPos[i3+2] + flowZ) % 1;
        const depth = -26 + ph * 32;                // -26 (вдали) → +6 (мимо камеры)
        const tubeX = Math.cos(ang) * rad;
        const tubeY = Math.sin(ang) * rad;
        tx = tx + (tubeX - tx) * tunnelBlend;
        ty = ty + (tubeY - ty) * tunnelBlend;
        tz = tz + (depth - tz) * tunnelBlend;
        // в полном туннеле ставим жёстко (без инерции — частицы не разлетаются/не пропадают)
        if (tunnelBlend > 0.9) {
          arr[i3] = tubeX; arr[i3+1] = tubeY; arr[i3+2] = depth;
          vel[i3] = vel[i3+1] = vel[i3+2] = 0;
          continue;
        }
      }
      // взаимодействие с курсором (дальше уезжают, плавно возвращаются)
      if (pointerActive && (tp < 0.05 || onBrain) && !brainOpen) {
        const dx = arr[i3] - pointer3D.x, dy = arr[i3+1] - pointer3D.y, dz = arr[i3+2] - pointer3D.z;
        const dsq = dx*dx + dy*dy + dz*dz;
        if (dsq < radius * radius) {
          const dist = Math.sqrt(dsq) + 0.001, f = 1 - dist / radius, s = f * f * force;
          const ax = (dx/dist)*s, ay = (dy/dist)*s, az = (dz/dist)*s;
          vel[i3] += ax; vel[i3+1] += ay; vel[i3+2] += az; pushed++;
          moveSum += Math.abs(ax) + Math.abs(ay) + Math.abs(az);
          moveDir += ay; // вертикальная составляющая → тон звука
        }
      }
      vel[i3] += (tx - arr[i3]) * RETURN; vel[i3+1] += (ty - arr[i3+1]) * RETURN; vel[i3+2] += (tz - arr[i3+2]) * RETURN;
      vel[i3] *= DAMP; vel[i3+1] *= DAMP; vel[i3+2] *= DAMP;
      arr[i3] += vel[i3]; arr[i3+1] += vel[i3+1]; arr[i3+2] += vel[i3+2];
    }
    particles.geometry.attributes.position.needsUpdate = true;
    // ЗВУК ОТ ДВИЖЕНИЯ ЧАСТИЦ: громкость = объём смещения, тон = направление
    if (pushed > 30 && frame % 4 === 0) {
      const vol = Math.min(moveSum * 0.4, 1);
      const pitch = THREE.MathUtils.clamp(0.5 + moveDir * 6, 0.3, 1.8);
      sound.playRustle(vol, pitch);
    }
    // лёгкое вращение трубы для динамики; обычное вращение мозга когда не в туннеле
    particles.rotation.z = brainOpen ? particles.rotation.z + 0.002 : 0;
    particles.rotation.y += brainOpen ? 0 : (onBrain ? 0.0011 : 0.0006);
    // мозг меньше утки; в туннеле масштаб 1 (труба в мировом масштабе)
    if (tunnelBlend > 0.5) {
      particles.scale.setScalar(1);
    } else {
      const brainShrink = 1 - 0.48 * THREE.MathUtils.clamp((tp - 0.5) / 0.45, 0, 1);  // мозг заметно меньше
      particles.scale.setScalar(brainShrink + Math.sin(t * 1.5) * 0.012 * (tp > 0.75 ? 1 : 0));
    }
  }
  // непрерывный поток туннеля (фаза 0..1) + плавный переход мозг↔туннель
  if (brainOpen) flowZ = (flowZ + dt * 0.18) % 1;   // спокойный полёт сквозь трубу
  tunnelBlend += ((brainOpen ? 1 : 0) - tunnelBlend) * 0.03;
  if (!brainOpen && tunnelBlend < 0.01 && particles) particles.rotation.z *= 0.95;

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

// ============================================================
// РЕЖИМ НАСТРОЙКИ КАМЕРЫ (?tune): двигаешь сцену пальцем + окошко с цифрами
// ============================================================

function updateTuneHUD() {
  const hud = document.getElementById('tune-hud'); if (!hud) return;
  const c = camera.position, t = orbit.target;
  hud.querySelector('.tv').textContent =
    `камера: ${c.x.toFixed(2)}, ${c.y.toFixed(2)}, ${c.z.toFixed(2)}\nсмотрит: ${t.x.toFixed(2)}, ${t.y.toFixed(2)}, ${t.z.toFixed(2)}\nfov: ${camera.fov}`;
}
if (TUNE) {
  // отключаем смуз-скролл, включаем управление мышью/пальцем
  try { lenis.destroy(); } catch (e) {}
  canvas.style.pointerEvents = 'auto';
  canvas.style.zIndex = '50';                 // canvas поверх контента в режиме настройки
  const _c = document.getElementById('content'); if (_c) _c.style.pointerEvents = 'none';
  document.body.classList.add('hero-in');     // скрываем интро-задержку при настройке
  orbit = new OrbitControls(camera, canvas);
  orbit.enableDamping = true; orbit.dampingFactor = 0.1;
  orbit.target.set(0, 0, -10);
  camera.position.set(0, 0, 6);
  orbit.update();
  // окошко
  const hud = document.createElement('div'); hud.id = 'tune-hud';
  hud.innerHTML = `<div class="tv" style="white-space:pre;font:12px monospace;color:#fff"></div>
    <button id="tune-copy" style="margin-top:8px;width:100%;padding:8px;border:0;border-radius:8px;background:#cc0000;color:#fff;font:600 12px sans-serif">Копировать</button>
    <div id="tune-msg" style="font:11px sans-serif;color:#8f8;margin-top:6px;min-height:14px"></div>`;
  Object.assign(hud.style, { position: 'fixed', top: '70px', left: '12px', zIndex: 4000, background: 'rgba(8,8,12,.85)', padding: '12px', borderRadius: '12px', border: '1px solid #cc0000', backdropFilter: 'blur(8px)', width: '210px' });
  document.body.appendChild(hud);
  document.getElementById('tune-copy').addEventListener('click', () => {
    const c = camera.position, t = orbit.target;
    const txt = `КАМЕРА ${c.x.toFixed(2)} ${c.y.toFixed(2)} ${c.z.toFixed(2)} | ВЗГЛЯД ${t.x.toFixed(2)} ${t.y.toFixed(2)} ${t.z.toFixed(2)}`;
    navigator.clipboard?.writeText(txt).then(() => {
      document.getElementById('tune-msg').textContent = 'Скопировано! Пришли мне.';
    }).catch(() => {
      document.getElementById('tune-msg').textContent = txt;
    });
  });
}
