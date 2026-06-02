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
import { PokerStation } from './three/poker.js';

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
const PCOUNT = isMobile ? 65000 : 115000;   // плотный объём — мозг забит частицами целиком
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
  const nTris = cum.length, arr = new Float32Array(count * 3), nrm = new Float32Array(count * 3);
  const pick = (target) => { let lo = 0, hi = nTris - 1; while (lo < hi) { const mid = (lo + hi) >> 1; if (cum[mid] < target) lo = mid + 1; else hi = mid; } return lo; };
  let minX = Infinity, minY = Infinity, minZ = Infinity, maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;
  for (let i = 0; i < count; i++) {
    const t = pick(Math.random() * total);
    let r1 = Math.random(), r2 = Math.random(); if (r1 + r2 > 1) { r1 = 1 - r1; r2 = 1 - r2; }
    const r3 = 1 - r1 - r2;
    arr[i * 3] = ax[t] * r3 + bx[t] * r1 + cx[t] * r2;
    arr[i * 3 + 1] = ay[t] * r3 + by[t] * r1 + cy[t] * r2;
    arr[i * 3 + 2] = az[t] * r3 + bz[t] * r1 + cz[t] * r2;
    // нормаль грани (для затенения борозд: в впадинах нормаль отклоняется от радиали → темнее)
    const e1x = bx[t]-ax[t], e1y = by[t]-ay[t], e1z = bz[t]-az[t], e2x = cx[t]-ax[t], e2y = cy[t]-ay[t], e2z = cz[t]-az[t];
    let nx = e1y*e2z - e1z*e2y, ny = e1z*e2x - e1x*e2z, nz = e1x*e2y - e1y*e2x;
    const nl = Math.hypot(nx, ny, nz) || 1; nrm[i*3] = nx/nl; nrm[i*3+1] = ny/nl; nrm[i*3+2] = nz/nl;
  }
  // нормализация (центр в 0, целевой размер)
  for (let i = 0; i < count; i++) { const x = arr[i*3], y = arr[i*3+1], z = arr[i*3+2]; if(x<minX)minX=x;if(x>maxX)maxX=x;if(y<minY)minY=y;if(y>maxY)maxY=y;if(z<minZ)minZ=z;if(z>maxZ)maxZ=z; }
  const cX = (minX+maxX)/2, cY = (minY+maxY)/2, cZ = (minZ+maxZ)/2;
  const scale = 2.6 / Math.max(maxX-minX, maxY-minY, maxZ-minZ);
  for (let i = 0; i < count; i++) {
    let x = (arr[i*3]-cX)*scale, y = (arr[i*3+1]-cY)*scale, z = (arr[i*3+2]-cZ)*scale;
    // ПОЛНОЕ заполнение — касание как песок; а РЕЛЬЕФ (извилины/борозды) проявит затенение впадин
    // по эллипсоидальному радиусу в buildParticles (гребни ярче, борозды темнее).
    const f = Math.cbrt(Math.random());
    x *= f; y *= f; z *= f;
    arr[i*3] = x; arr[i*3+1] = y; arr[i*3+2] = z;
  }
  arr.__nrm = nrm;   // нормали граней — для затенения борозд/извилин
  return arr;
}
// Подчёркиваем форму мозга: пинч срединной плоскости → продольная борозда (две доли).
// Ось «лево-право» = СРЕДНЯЯ по габаритам (у мозга длина>ширина>высота), борозда в плоскости этой оси.
function sculptBrain(P) {
  const n = P.length / 3;
  const mn = [1e9, 1e9, 1e9], mx = [-1e9, -1e9, -1e9];
  for (let i = 0; i < n; i++) for (let a = 0; a < 3; a++) { const v = P[i*3+a]; if (v < mn[a]) mn[a] = v; if (v > mx[a]) mx[a] = v; }
  const dim = [mx[0]-mn[0], mx[1]-mn[1], mx[2]-mn[2]];
  const order = [0, 1, 2].sort((a, b) => dim[b] - dim[a]);  // order[0]=длинная … order[2]=короткая
  const M = order[1];                                       // средняя ось = лево-право
  console.log('BRAIN dim', dim.map((d) => +d.toFixed(2)), 'M-axis', M);
  const wM = dim[M] * 0.16;
  for (let i = 0; i < n; i++) {
    let x = P[i*3], y = P[i*3+1], z = P[i*3+2];
    const m = (M === 0 ? x : M === 1 ? y : z);
    const d = Math.exp(-(m*m) / (wM*wM));    // близость к срединной плоскости
    const s = 1 - d * 0.34;                  // пинч внутрь → продольная борозда между полушариями
    x *= s; y *= s; z *= s;
    // ИЗВИЛИНЫ (гиры/борозды): смещение по радиали органическим 3D-шумом → морщинистая поверхность мозга
    const len = Math.sqrt(x*x + y*y + z*z) + 1e-4;
    const bump = gyriN(x, y, z) * 0.12;   // более выраженные извилины (гиры/борозды)
    P[i*3] = x + (x/len)*bump; P[i*3+1] = y + (y/len)*bump; P[i*3+2] = z + (z/len)*bump;
  }
  P.__M = M; P.__wM = wM;   // сохраняем для окраски борозды
}
// органический 3D-шум для извилин мозга (домен-варп суммой синусов — не полосы)
function gyriN(x, y, z) {
  return Math.sin(x*5.5 + Math.sin(y*3.1)*1.6) * 0.5
       + Math.sin(y*6.0 + Math.sin(z*3.4)*1.6) * 0.42
       + Math.sin(z*5.7 + Math.sin(x*3.7)*1.6) * 0.42;
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
window.__glowArr = () => glow;   // для headless-замера свечения от касания
// подбор высоты взгляда камеры через ?look=Y и высоты камеры ?camy=Y
const _qp = new URLSearchParams(location.search);
const LOOK_Y = _qp.has('look') ? parseFloat(_qp.get('look')) : 1.5;
const CAM_Y = _qp.has('camy') ? parseFloat(_qp.get('camy')) : 0.5;
const CAM_Z = _qp.has('camz') ? parseFloat(_qp.get('camz')) : 4.5;
const ROT_Y = _qp.has('roty') ? parseFloat(_qp.get('roty')) * Math.PI / 180 : 0;  // поворот зала (найти стену с окном)
// тонкая подстройка фигуры на луче взгляда: ?dx ?dy сдвиг, ?dist расстояние от камеры
const DUCK_PX = _qp.has('dx') ? parseFloat(_qp.get('dx')) : 0;
const DUCK_PY = _qp.has('dy') ? parseFloat(_qp.get('dy')) : -0.25;  // утка чуть ниже центра (приподнята)
const DUCK_DIST = _qp.has('dist') ? parseFloat(_qp.get('dist')) : (isMobile ? 6.5 : 4.6);  // на ПК ближе=крупнее
const _camDir = new THREE.Vector3();
const _zero = new THREE.Vector3(0, 0, 0);
// туннель-переход 2→3: тубус строится ВОКРУГ ОСИ ВЗГЛЯДА КАМЕРЫ (летит на зрителя даже при повороте)
const _invP = new THREE.Matrix4();
const _wp = new THREE.Vector3(), _off = new THREE.Vector3();
// переход 2→3 «мозг становится игрой»: частицы мозга пересобираются в 4 карты на столе
const _cardMats = [new THREE.Matrix4(), new THREE.Matrix4(), new THREE.Matrix4(), new THREE.Matrix4()];
const CARD_W = 0.62, CARD_H = 0.87;   // должно совпадать с poker.js
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
renderer.setSize(innerWidth, innerHeight);
renderer.setPixelRatio(PIXEL_RATIO);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 0.78;
renderer.outputColorSpace = THREE.SRGBColorSpace;

const env = new ClubEnvironment(scene, isMobile, renderer);
if (ROT_Y) env.group.rotation.y = ROT_Y;   // поворот зала для подбора ракурса

// ============================================================
// РЕЛЬСА СТАНЦИЙ (кино, единая сцена). scrollProgress 0..1 делится на сегменты:
//   0 .. HOLL_END   — ХОЛЛ (утка→мозг), tp = scrollProgress/HOLL_END (Холл выглядит как раньше)
//   HOLL_END .. 1   — ПОКЕР, pk = доля прогресса внутри сегмента
// ============================================================
const HOLL_END = 0.5;
let pk = 0;                       // прогресс станции «Покер» 0..1
// Покерный стол стоит в тёмном углу клуба (вправо-вниз от камеры конца Холла).
const poker = new PokerStation();
poker.group.position.set(0.4, -1.4, 1.8);   // стол выше — меньше пустоты под заголовком
poker.group.rotation.y = 0;   // стол смотрит на камеру (карты формируются перед зрителем, не сбоку)
scene.add(poker.group);
// Поза камеры на станции Покер (подобрана под рамку стола; тонко тюнится скриншотами).
const POKER_CAM = { x: 0.4, y: isMobile ? 1.55 : 1.05, z: isMobile ? 8.2 : 5.8 };
const POKER_LOOK = { x: 0.4, y: -1.3, z: 1.7 };
window.__pokerLift = (i) => poker.cards[i] && poker.toggleLift(poker.cards[i]);   // для проверки в браузере

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
let duckPos = null, brainPos = null, explodePos = null, tunnelPos = null, vel = null, delays = null, glow = null, disturb = null, cardSlot = null, formStart = null, scatterDir = null;
let tp = 0;            // transition progress 0..1 (равномерный распад)
let formProgress = 1;  // формирование утки из частиц на старте (0→1): частицы слетаются и собираются в утку
let introDuckReveal = 0, introPlaying = false;   // кроссфейд частицы→твёрдая утка в конце интро
let prevTpCam = 0;     // tp прошлого кадра — скорость скролла (анти-«вылет мозга сбоку» при резком скролле)
let ready = false, introDone = false, brainOpen = false;
let tunnelBlend = 0;   // 0 = мозг, 1 = туннель (плавно)
let camYaw = 0;        // поворот камеры вправо к бару
let flowZ = 0;         // фаза непрерывного потока частиц в туннеле
let brainBurst = 0;    // импульс «мозг рассыпается» в начале входа в туннель
let reform = 0;        // окно сильной пересборки мозга сразу после выхода из туннеля (чинит «дырку»)
let figureGrab = false;// палец «захватил» мозг → растекание (скролл застопорен), срабатывает в любую сторону
let tpLatch = 0;       // ЗАФИКСИРОВАННЫЙ tp на время туннеля → мозг возвращается в ТОТ ЖЕ размер/место
let brainYaw = 0;      // непрерывный угол вращения мозга (труба строится с учётом него → всегда прямая)

const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2(-10, -10);
const pointer3D = new THREE.Vector3();
let pointerActive = false, pointerNX = 0, pointerNY = 0;
let pointerStamp = 0;   // время последнего РЕАЛЬНОГО движения указателя → касание само «отпускается» в покое
// взаимодействие частиц как у igloo: касание раскидывает ШИРОКО и ДАЛЕКО, частицы
// светятся и ещё гуляют, потом МЯГКО «затягиваются» обратно (растекание песка, не пружина).
// RETURN_SHAPE — как держится форма (для морфа), RETURN_TOUCH — мягкий возврат после касания.
// касание как «палец в песке»: мягко РАЗДВИГАЕТ частицы вокруг пальца (шире), они светятся внутри,
// потом БЕЗ ПРУЖИНЫ плавно стягиваются обратно (экспоненциальное оседание, не отскок).
const HOVER_RADIUS = 1.25, HOVER_FORCE = 0.035;   // мягкая сила раздвигания (как было — не трогаем)
const RETURN_SHAPE = 0.06, RETURN_TOUCH = 0.012, TOUCH_DAMP = 0.86;   // возврат МЕДЛЕННЕЕ и ПЛАВНЕЕ (песок, не пузырь)

function buildParticles() {
  const N = PCOUNT;
  vel = new Float32Array(N * 3); delays = new Float32Array(N); explodePos = new Float32Array(N * 3);
  tunnelPos = new Float32Array(N * 3);
  cardSlot = new Float32Array(N * 3);   // [u вдоль карты, v вдоль карты, индекс карты 0..3]
  formStart = new Float32Array(N * 3);  // старт формирования: россыпь сверху (как от рассыпавшихся кубиков)
  const cur = new Float32Array(N * 3), colors = new Float32Array(N * 3), sizes = new Float32Array(N);
  glow = new Float32Array(N);   // внутреннее свечение частицы (растёт от движения)
  disturb = new Float32Array(N);   // «разворошённость» касанием: 1 = только что толкнули, мягко затухает
  const dir = new THREE.Vector3();
  const brainNrm = brainPos.__nrm;   // нормали граней мозга — для затенения борозд/извилин
  let brainMaxR = 1e-3;
  for (let i = 0; i < N; i++) { const r = Math.hypot(brainPos[i*3], brainPos[i*3+1], brainPos[i*3+2]); if (r > brainMaxR) brainMaxR = r; }
  scatterDir = new Float32Array(N * 3);   // собственное направление «рассыпания» частицы при касании (как песок, без кольца)
  for (let i = 0; i < N; i++) { let vx = Math.random()*2-1, vy = Math.random()*2-1, vz = Math.random()*2-1; const l = Math.hypot(vx,vy,vz)||1; scatterDir[i*3]=vx/l; scatterDir[i*3+1]=vy/l; scatterDir[i*3+2]=vz/l; }
  for (let i = 0; i < N; i++) {
    cur[i*3] = duckPos[i*3]; cur[i*3+1] = duckPos[i*3+1]; cur[i*3+2] = duckPos[i*3+2];
    delays[i] = Math.random() * 0.12;  // маленькая задержка — распад почти синхронный, но органичный
    // взрыв: наружу от центра + случайный разброс, заполняет экран
    dir.set(duckPos[i*3], duckPos[i*3+1], duckPos[i*3+2]);
    if (dir.lengthSq() < 0.01) dir.set(Math.random()-0.5, Math.random()-0.5, Math.random()-0.5);
    dir.normalize();
    // мягкое «облако» промежуточной формы (не резкий взрыв): уже и плотнее
    const spread = 0.8 + Math.random() * 1.0;
    explodePos[i*3] = duckPos[i*3] + dir.x * spread + (Math.random()-0.5) * 0.6;
    explodePos[i*3+1] = duckPos[i*3+1] + dir.y * spread + (Math.random()-0.5) * 0.6;
    explodePos[i*3+2] = duckPos[i*3+2] + dir.z * spread + (Math.random()-0.5) * 0.6;
    // ТУННЕЛЬ: каждая частица на кольце (угол + радиус) и со своей фазой глубины.
    // В цикле глубина едет К КАМЕРЕ → ощущение полёта сквозь трубу.
    tunnelPos[i*3] = Math.random() * Math.PI * 2;            // угол на кольце
    tunnelPos[i*3+1] = 2.4 + Math.random() * 1.0;           // радиус трубы чуть шире (виднее текст в центре)
    tunnelPos[i*3+2] = Math.random();                        // фаза глубины 0..1
    // СЛОТ КАРТЫ: точка внутри прямоугольника одной из 4 карт (для морфа мозг→карты)
    cardSlot[i*3] = (Math.random() - 0.5) * CARD_W * 0.92;
    cardSlot[i*3+1] = (Math.random() - 0.5) * CARD_H * 0.92;
    cardSlot[i*3+2] = i % 4;
    // старт формирования: широкая россыпь СВЕРХУ → частицы падают/слетаются и собираются в утку
    formStart[i*3] = duckPos[i*3] + (Math.random() - 0.5) * 3.4;
    formStart[i*3+1] = duckPos[i*3+1] + 3.2 + Math.random() * 3.5;
    formStart[i*3+2] = duckPos[i*3+2] + (Math.random() - 0.5) * 3.4;
    // РЕЛЬЕФ по НОРМАЛИ грани: гребень извилины (нормаль наружу) → ЯРКО; стенка борозды/щель → ТЕМНО.
    // + ГЛУБИНА по радиусу: нутро темнее, поверхность ярче → ОЧЕРТАНИЯ/силуэт мозга чётче.
    const bx = brainPos[i*3], by = brainPos[i*3+1], bz = brainPos[i*3+2];
    const pl = Math.sqrt(bx*bx + by*by + bz*bz) + 1e-4;
    const nDotR = (brainNrm[i*3]*bx + brainNrm[i*3+1]*by + brainNrm[i*3+2]*bz) / pl;   // 1 гребень … низкое борозда
    const fold = THREE.MathUtils.smoothstep(nDotR, 0.02, 0.7);
    const depth = THREE.MathUtils.smoothstep(pl / brainMaxR, 0.5, 0.97);              // нутро тёмное → силуэт
    const fs = (0.1 + 0.9 * fold * fold) * (0.4 + 0.6 * depth);                       // РЕЗЧЕ извилины + очертания
    const s = (0.74 + Math.random() * 0.26) * fs, w = Math.random();
    if (w < 0.05 && fold > 0.65) { colors[i*3]=s*1.25; colors[i*3+1]=s*1.12; colors[i*3+2]=s*1.0; }   // искры на гребнях
    else { colors[i*3]=s*0.48; colors[i*3+1]=s*0.79; colors[i*3+2]=s*1.14; }                          // голубой/циан (фото 2)
    sizes[i] = 0.034 + Math.random() * 0.03;  // зерно
    glow[i] = 0;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(cur, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geo.setAttribute('size', new THREE.BufferAttribute(sizes, 1));
  geo.setAttribute('aglow', new THREE.BufferAttribute(glow, 1));
  const mat = new THREE.ShaderMaterial({
    uniforms: { uPixelRatio: { value: PIXEL_RATIO }, uTime: { value: 0 }, uOpacity: { value: 0 }, uMorph: { value: 0 } },
    vertexShader: `attribute float size; attribute float aglow; varying vec3 vColor; varying float vSh; varying float vGlow; varying float vFade;
      uniform float uPixelRatio; uniform float uTime;
      void main(){ vColor=color; vGlow=aglow;
        vSh=0.85+0.15*fract(sin(position.x*12.9+position.y*78.2+position.z*37.7)*43758.5453);  // искра per-particle, БЕЗ полос
        // ЖИВАЯ МАССА как у igloo: частицы ГЛАДКО ТЕКУТ потоками по всей фигуре (снаружи и внутри),
        // в разных направлениях, БЕЗ дёрганья/джиттера и без жёсткой привязки к точке — но силуэт держится.
        vec3 p = position;
        float ph = position.x*5.3 + position.y*4.1 + position.z*6.7;
        float rnd = fract(sin(ph*1.7)*43758.5453);
        // поле течения: НИЗКИЕ частоты + домен-варп → длинные плавные струи, соседи текут согласованно
        float t1 = uTime*0.85, t2 = uTime*0.6;
        vec3 fl;
        fl.x = sin(position.y*1.6 + t1) + cos(position.z*1.2 - t2) + 0.6*sin(position.z*2.4 + position.y*1.0 + t1*1.3);
        fl.y = sin(position.z*1.6 + t1*1.1) + cos(position.x*1.2 - t2*0.9) + 0.6*sin(position.x*2.4 + position.z*1.0 + t1*1.1);
        fl.z = sin(position.x*1.6 + t1*0.9) + cos(position.y*1.2 - t2*1.1) + 0.6*sin(position.y*2.4 + position.x*1.0 + t1*1.2);
        p += fl * 0.018;                         // ОЧЕНЬ лёгкое течение ВНУТРИ формы — силуэт держится чётко,
                                                 // частицы НЕ выходят за рамки фигуры (без вылазок наружу).
        vec4 mv=modelViewMatrix*vec4(p,1.0);
        // ГЛУБИНА: дальние частицы тускнеют → в туннеле читается уходящая вглубь труба
        vFade = clamp(1.0 - (-mv.z - 3.0)/34.0, 0.06, 1.0);
        gl_PointSize=size*(1.0+vGlow*0.35)*uPixelRatio*(300.0/-mv.z); gl_Position=projectionMatrix*mv; }`,
    fragmentShader: `varying vec3 vColor; varying float vSh; varying float vGlow; varying float vFade; uniform float uOpacity;
      void main(){ vec2 uv=gl_PointCoord-vec2(0.5); float d=length(uv);
        float a = smoothstep(0.5, 0.28, d);
        float shade = 0.58 + 0.42 * (-uv.y + 0.5);
        vec3 col = vColor * vSh * shade * 1.3;                  // ярче, контраст рельефа сохранён
        col += vColor * 0.34;                                   // голубое свечение ПРОПОРЦ. яркости (гребни светятся, борозды — нет)
        col += vec3(0.45,0.68,1.05) * vGlow * 0.8;              // ЯРКОЕ свечение касания (не тёмный шар)
        gl_FragColor = vec4(col, a * uOpacity * (0.4 + 0.6*vFade)); }`,
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
// Страховка: если модели не подгрузились за 12с — считаем готовым (бар добежит, шоу стартует по кнопке)
const loaderFailSafe = setTimeout(() => { modelsLoaded = true; maybeStartShow(); }, 12000);
// относительные пути (без ведущего слеша) — надёжнее на любом хостинге
Promise.all([load('models/duck.glb'), load('models/brain.glb')])
  .then(([duck, brain]) => {
    clearTimeout(loaderFailSafe);
    duckPos = sampleModel(duck, PCOUNT);
    brainPos = sampleModel(brain, PCOUNT);   // brain.glb детальный (413k tri) — форму НЕ деформируем, берём как есть. Стоит РОВНО (без наклона).
    normalize(duck, 2.6);
    duck.traverse((c) => { if (c.material) { c.material = c.material.clone(); c.material.transparent = true; c.material.envMapIntensity = 2.2; if (c.material.emissive) { c.material.emissive.setHex(0x1a1420); c.material.emissiveIntensity = 0.35; } } });
    // оборачиваем в группу, чтобы свободно масштабировать (нормализация уже внутри)
    duckMesh = new THREE.Group();
    duckMesh.add(duck);
    duckMesh.rotation.y = DUCK_FACE;   // единый угол везде, без рассинхрона
    duckMesh.visible = false; subject.add(duckMesh);
    buildParticles();
    modelsLoaded = true;
    maybeStartShow();   // если кнопка уже нажата — бар добежит и стартуем
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
  // быстрый путь (?fast)
  if (_qp.has('fast')) {
    formProgress = 1; introDuckReveal = 1; introPlaying = false;
    if (duckMesh) { duckMesh.visible = true; duckMesh.rotation.y = DUCK_FACE; duckMesh.position.set(0, 0, 0); duckMesh.scale.set(1, 1, 1); }
    document.body.classList.add('hero-in'); introDone = true; return;
  }
  // КУБИКИ падают к центру и РАСТВОРЯЮТСЯ → ЧАСТИЦЫ собираются в утку → КРОССФЕЙД в твёрдую цветную утку.
  // Текст появляется ПЛАВНО во время формирования (не сразу).
  formProgress = 0; introDuckReveal = 0; introPlaying = true;
  const tl = gsap.timeline();
  dice.forEach((d, i) => {
    d.position.set(i === 0 ? -0.9 : 0.85, 6, 0.4);
    d.rotation.set(Math.random()*3, Math.random()*3, Math.random()*3);
    d.visible = true; diceShadows[i].visible = true;
    (Array.isArray(d.material) ? d.material : [d.material]).forEach((m) => { m.transparent = true; m.opacity = 1; });
  });
  sound.playDiceRoll();
  dice.forEach((d, i) => {
    const t0 = 0.05 + i * 0.1;
    tl.to(d.position, { keyframes: [
      { y: 0.6, duration: 0.55, ease: 'power2.in' }, { y: 1.0, duration: 0.22, ease: 'power2.out' }, { y: 0.2, duration: 0.32, ease: 'power2.in' },
    ] }, t0);
    tl.to(d.rotation, { x: `+=${4 + Math.random()*2}`, z: `+=${3 + Math.random()*2}`, duration: 1.3, ease: 'power1.out' }, t0);
    (Array.isArray(d.material) ? d.material : [d.material]).forEach((m) => tl.to(m, { opacity: 0, duration: 0.55, ease: 'power1.in' }, 0.85 + i * 0.1));
  });
  tl.add(() => { sound.playThump?.(); }, 0.5);
  tl.add(() => dice.forEach((d, i) => { d.visible = false; diceShadows[i].visible = false; }), 1.6);
  // частицы собираются в утку
  tl.add(() => sound.playFormation?.(), 0.85);
  tl.to({ v: 0 }, { v: 1, duration: 1.7, ease: 'power2.out', onUpdate: function () { formProgress = this.targets()[0].v; } }, 0.85);
  // текст/кнопки — плавно во время формирования
  tl.add(() => document.body.classList.add('hero-in'), 1.7);
  // кроссфейд: частицы-утка → твёрдая цветная утка
  tl.add(() => { if (duckMesh) { duckMesh.visible = true; duckMesh.rotation.y = DUCK_FACE; duckMesh.position.set(0, 0, 0); duckMesh.scale.set(1, 1, 1); } }, 2.45);
  tl.to({ v: 0 }, { v: 1, duration: 0.7, ease: 'power1.inOut', onUpdate: function () { introDuckReveal = this.targets()[0].v; } }, 2.45);
  tl.add(() => { introDone = true; introPlaying = false; formProgress = 1; introDuckReveal = 1; }, 3.3);
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
const _sphere = new THREE.Sphere();
const _ctr = new THREE.Vector3();
const _pn = new THREE.Vector3();
const pointerMove = new THREE.Vector3();   // накопленное движение пальца (локально), затухает в кадре
const _prevP3 = new THREE.Vector3();
const _pMove = new THREE.Vector3();
let _pHas = false;
function updatePointer(x, y) {
  pointer.x = (x / innerWidth) * 2 - 1; pointer.y = -(y / innerHeight) * 2 + 1;
  pointerNX = pointer.x; pointerNY = pointer.y; pointerActive = true;
  pointerStamp = performance.now();   // отметка «палец только что двигался»
  raycaster.setFromCamera(pointer, camera);
  subject.getWorldPosition(_ctr);
  // радиус фигуры в мире (учитывает масштаб subject и particles)
  const r = subject.scale.x * (particles ? particles.scale.x : 1) * 1.25;
  // КАСАНИЕ СПЕРЕДИ: пересекаем луч со СФЕРОЙ вокруг фигуры и берём БЛИЖНЮЮ точку (со стороны
  // зрителя) — тогда разлетается ПЕРЕДНЯЯ часть, к тебе, а не задняя.
  _sphere.set(_ctr, r);
  if (!raycaster.ray.intersectSphere(_sphere, _hitWorld)) {
    // мимо фигуры — берём ближайшую к лучу точку на передней полусфере
    raycaster.ray.closestPointToPoint(_ctr, _hitWorld);
    _pn.copy(camera.position).sub(_ctr).normalize().multiplyScalar(r * 0.7);
    _hitWorld.add(_pn);
  }
  // переводим МИРОВУЮ точку в ЛОКАЛЬНУЮ систему particles (учитывает вращение и масштаб)
  if (particles) { particles.worldToLocal(pointer3D.copy(_hitWorld)); }
  else { pointer3D.copy(_hitWorld).sub(subject.position).divideScalar(subject.scale.x); }
  // ДВИЖЕНИЕ пальца в локальных координатах → за ним «течёт» масса частиц (как igloo)
  if (_pHas) {
    _pMove.copy(pointer3D).sub(_prevP3);
    if (_pMove.length() > 0.5) _pMove.setLength(0.5);   // ограничиваем рывок
    pointerMove.add(_pMove);
  }
  _prevP3.copy(pointer3D); _pHas = true;
}
addEventListener('mousemove', (e) => updatePointer(e.clientX, e.clientY));
addEventListener('touchmove', (e) => { if (e.touches[0]) updatePointer(e.touches[0].clientX, e.touches[0].clientY); }, { passive: true });
addEventListener('mouseleave', () => { pointerActive = false; _pHas = false; });
// мышь/указатель ОТПУЩЕН → касание выключаем сразу (без этого pointerActive «залипал» в true,
// и частицы в последней точке раздвигались каждый кадр = «висящая дырка» до повторного касания)
addEventListener('mouseup', () => { pointerActive = false; _pHas = false; });
addEventListener('pointerup', () => { pointerActive = false; _pHas = false; });
addEventListener('pointercancel', () => { pointerActive = false; _pHas = false; });
// РЕАКЦИЯ НА НАКЛОН ТЕЛЕФОНА: параллакс камеры следует за наклоном (слежение за экраном)
if (isMobile) {
  addEventListener('deviceorientation', (ev) => {
    if (ev.gamma == null || ev.beta == null) return;
    pointerNX = THREE.MathUtils.clamp(ev.gamma / 28, -1, 1);
    pointerNY = THREE.MathUtils.clamp((ev.beta - 40) / 28, -1, 1);
  }, { passive: true });
}
// КРИТИЧНО: на телефоне сбрасываем указатель после касания, иначе звук частиц звучит постоянно
addEventListener('touchend', () => { pointerActive = false; _pHas = false; });
addEventListener('touchcancel', () => { pointerActive = false; _pHas = false; if (figureGrab) { figureGrab = false; lenis.start(); } });

function hitSubject(x, y, r = 0.32) {
  pointer.x = (x / innerWidth) * 2 - 1; pointer.y = -(y / innerHeight) * 2 + 1;
  const c = subject.getWorldPosition(new THREE.Vector3()).project(camera);
  const dx = pointer.x - c.x, dy = pointer.y - c.y;
  return Math.sqrt(dx * dx + dy * dy) < r;
}
addEventListener('click', (e) => {
  if (!introDone || brainOpen) return;
  if (document.body.classList.contains('signup-open')) return;   // клики внутри анкеты не трогают сцену
  if (tp < 0.2 && duckMesh && duckMesh.visible && hitSubject(e.clientX, e.clientY)) { sound.playQuack(); duckMesh.userData.poke = 0.3; }   // тап по утке — кряк
  else if (tp > 0.7 && pk < 0.05 && hitSubject(e.clientX, e.clientY, 0.55)) openBrain();   // мозг крупный — больше зона (не в Покере)
  else if (pk > 0.12) {
    // ПОКЕР: клик по карте — поднять к зрителю и перевернуть; повторный клик — вернуть на стол
    pointer.x = (e.clientX / innerWidth) * 2 - 1; pointer.y = -(e.clientY / innerHeight) * 2 + 1;
    raycaster.setFromCamera(pointer, camera);
    const card = poker.raycast(raycaster);
    if (card) { const lifted = poker.toggleLift(card); lifted ? sound.playCardSlide() : sound.playCardPlace(); }
  }
});

// ============================================================
// Вход внутрь мозга (попап с затемнением)
// ============================================================
function openBrain() {
  if (brainOpen) return;
  brainOpen = true; document.body.classList.add('brain-open');
  tpLatch = tp;    // ФИКСИРУЕМ позу мозга (размер/место/угол на этом tp) → выход вернёт ТОЧНО её
  brainBurst = 0;  // вход ведётся прямой интерполяцией дом↔труба (без импульса) — плавно и обратимо
  // КРИТИЧНО: «ОТПУСКАЕМ ПАЛЕЦ» при входе. Клик, открывающий туннель, ОДНОВРЕМЕННО раздвигал частицы
  // и ставил метку disturb в точке клика. Эта метка едет вместе с вращением мозга через туннель и на
  // выходе остаётся разреженной зоной = «дырка с разных сторон». Стираем ЛЮБОЙ след касания у ВСЕХ
  // частиц прямо сейчас → переживать туннель нечему, мозг собирается ровно везде.
  pointerActive = false; _pHas = false; pointerMove.set(0, 0, 0);
  if (vel && disturb && glow) { for (let i = 0; i < PCOUNT; i++) { vel[i*3] = vel[i*3+1] = vel[i*3+2] = 0; disturb[i] = 0; glow[i] = 0; } }
  // ЗВУК ВХОДА В ТУННЕЛЬ: всасывающий вихрь + рассыпание частиц (нарастающий)
  sound.playWhoosh(true); sound.playDissolve?.(); lenis.stop();   // блокируем скролл пока внутри
}
function closeBrain() {
  if (!brainOpen) return;
  brainOpen = false; document.body.classList.remove('brain-open');
  document.body.classList.add('tunnel-exit');   // текст улетает вдаль + затемнение гаснет ПЛАВНО (CSS 3с)
  // ВЫХОД = ИНВЕРСИЯ ВХОДА: НЕ трогаем позиции и НЕ обнуляем tunnelBlend мгновенно.
  // tunnelBlend сам плавно поедет 1→0, и частицы по той же траектории перетекут труба→мозг,
  // камера отдалится назад. reform добавляет плотности уже в самом конце сборки (без «дырки»).
  brainBurst = 0; reform = 0.9;
  // гасим остаточные скорости/свечение/«разворошённость» (но позиции оставляем — они анимируются назад)
  if (vel && disturb && glow) { for (let i = 0; i < PCOUNT; i++) { vel[i*3] = vel[i*3+1] = vel[i*3+2] = 0; disturb[i] = 0; glow[i] *= 0.5; } }
  pointerMove.set(0, 0, 0); _pHas = false;
  pointerActive = false; pointerStamp = 0;   // «отпускаем палец» на выходе → никакого залипшего касания в точке выхода
  // ЗВУК ВЫХОДА ИЗ ТУННЕЛЯ: нисходящий вихрь + сборка
  sound.playWhoosh(false); sound.playFormation?.(); lenis.start();
}
window.__openBrain = openBrain; window.__closeBrain = closeBrain;   // для проверки в браузере
// тест-хук: мгновенно выставить прогресс скролла + (опц.) телепорт частиц/камеры в цель,
// чтобы делать скриншоты УСТОЯВШЕГОСЯ кадра в headless (низкий FPS не успевает сойтись)
window.__setScroll = (v) => { scrollProgress = v; updateUIByScroll(); };
Object.defineProperty(window, '__tbDbg', { get: () => tunnelBlend });   // для headless-замера прогресса туннеля
// клик по фону попапа закрывает; клик по кнопке — тоже (с остановкой всплытия)
document.getElementById('brain-detail').addEventListener('click', (e) => { if (e.target.id === 'brain-detail') closeBrain(); });
const brainBackBtn = document.getElementById('brain-back');
brainBackBtn.addEventListener('click', (e) => { e.stopPropagation(); closeBrain(); });
brainBackBtn.addEventListener('touchend', (e) => { e.preventDefault(); e.stopPropagation(); closeBrain(); }, { passive: false });
addEventListener('keydown', (e) => { if (e.key === 'Escape') closeBrain(); });

// ============================================================
// Автостарт звука
// ============================================================
// Звук включён по умолчанию (кнопки нет). Браузер не даёт запустить аудио до первого касания —
// поэтому стартуем автоматически на ПЕРВОМ же действии пользователя (касание/скролл/клик).
let audioStarted = false;
function startAudioOnce() { if (audioStarted) return; audioStarted = true; sound.init(); sound.ctx.resume(); sound.startMusic(); }
['pointerdown', 'touchstart', 'wheel', 'keydown', 'click'].forEach((ev) => addEventListener(ev, startAudioOnce, { once: true, passive: true }));

// ВХОД НА САЙТ: кнопка под лого. Первое касание включает звук (требование браузеров) и запускает шоу,
// поэтому слышны ВСЕ звуки с самого начала — загрузка, кубики, выход утки, запуск, туннель.
let modelsLoaded = false, entered = false, showStarted = false;
function maybeStartShow() {
  if (showStarted || !modelsLoaded || !entered) return;
  showStarted = true;
  const es = document.getElementById('enter-screen');
  if (_qp.has('fast')) { if (es) es.classList.add('hidden'); startIntro(); return; }
  // даём прогресс-бару добежать (CSS .9s), затем прячем стартовый экран и запускаем интро
  setTimeout(() => { if (es) es.classList.add('hidden'); startIntro(); }, 1100);
}
function enterSite() {
  if (entered) return; entered = true;
  startAudioOnce();
  sound.playWhoosh(true);                 // звук запуска сайта
  const es = document.getElementById('enter-screen');
  if (es) es.classList.add('loading');     // прячем кнопку/подсказку, показываем прогресс-бар
  // прогресс-бар БЕЖИТ при нажатии (0→100% за .9с) — визуальный «запуск»
  if (ldBar) { ldBar.style.width = '0%'; requestAnimationFrame(() => requestAnimationFrame(() => { ldBar.style.width = '100%'; })); }
  maybeStartShow();                        // модели обычно уже готовы → стартуем после добега бара
}
{
  const eb = document.getElementById('enter-btn');
  const es = document.getElementById('enter-screen');
  if (eb) eb.addEventListener('click', enterSite);
  if (es) es.addEventListener('click', enterSite);
  // в режиме ?fast пропускаем заставку
  if (_qp.has('fast')) { entered = true; if (es) es.classList.add('hidden'); }
}
// Уход со вкладки → музыка плавно гаснет; возврат → плавно возвращается (как у igloo)
document.addEventListener('visibilitychange', () => {
  if (!audioStarted) return;
  if (document.hidden) sound.fade(0, 0.8);
  else { sound.ctx.resume(); sound.fade(0.4, 0.8); }
});

// ============================================================
// Скролл — ЖИВОЙ РУЧНОЙ + ПЛАВНАЯ ДОКАТКА ПО НАПРАВЛЕНИЮ (без паузы, без рывка).
// Страница идёт за пальцем/колесом СРАЗУ. Отпустил — БЕЗ остановки докатывается к станции в ту
// сторону, куда ты тянул: протянул > порога (≈30% сегмента) → вперёд, меньше → назад.
// Реагирует ТОЛЬКО на вертикальный жест (горизонталь игнор). Инерции после отпускания нет —
// докаткой управляем мы, поэтому не «висит» и не дёргается.
// ============================================================
const lenis = new Lenis({
  duration: 0.9, smoothWheel: true, syncTouch: true, syncTouchLerp: 0.085,
  touchInertiaMultiplier: 0,            // без «дрейфа» после отпускания — докатываем сами
  wheelMultiplier: 0.9, orientation: 'vertical', gestureOrientation: 'vertical',
});
window.__lenis = lenis;   // для проверки в браузере
let scrollProgress = 0;
// Станции (доли scrollProgress): 0 — Холл/утка, 0.5 — мозг, 1.0 — Покер.
const STATIONS = [0, 0.5, 1.0];
let settledStation = 0;
const SNAP_THRESHOLD = 0.3;   // протянул больше 30% сегмента → докатываемся вперёд
const _easeOut = (x) => 1 - Math.pow(1 - x, 3);
const _easeIO = (x) => x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
lenis.on('scroll', ({ scroll, limit }) => {
  scrollProgress = limit > 0 ? scroll / limit : 0;
  document.getElementById('scroll-progress').style.width = scrollProgress * 100 + '%';
  document.getElementById('nav').classList.toggle('scrolled', scroll > 50);
  updateUIByScroll();
});
function raf(t) { lenis.raf(t); requestAnimationFrame(raf); }
requestAnimationFrame(raf);

// плавная докатка к станции idx — длительность зависит от остатка пути (без резкого прыжка)
function glideTo(idx) {
  idx = THREE.MathUtils.clamp(idx, 0, STATIONS.length - 1);
  settledStation = idx;
  const frac = STATIONS[idx];
  const dist = Math.abs(scrollProgress - frac);
  if (dist < 0.004) return;
  const dur = THREE.MathUtils.clamp(dist * 2.4 + 1.0, 1.0, 2.1);   // +1с к докатке: медленнее, кинематографичнее
  lenis.scrollTo(frac * (lenis.limit || 1), { duration: dur, easing: _easeOut });
}
function goToStation(idx) {
  idx = THREE.MathUtils.clamp(idx, 0, STATIONS.length - 1);
  settledStation = idx;
  lenis.scrollTo(STATIONS[idx] * (lenis.limit || 1), { duration: 2.0, easing: _easeIO });
}
// докатка по НАПРАВЛЕНИЮ от станции, с которой начали жест
function settleFrom(fromStation) {
  if (window.__teleport || brainOpen || document.body.classList.contains('signup-open') || !introDone) return;
  const startFrac = STATIONS[fromStation];
  let target = fromStation;
  if (fromStation < STATIONS.length - 1 && scrollProgress > startFrac) {
    const seg = STATIONS[fromStation + 1] - startFrac;
    if ((scrollProgress - startFrac) / seg > SNAP_THRESHOLD) target = fromStation + 1;
  } else if (fromStation > 0 && scrollProgress < startFrac) {
    const seg = startFrac - STATIONS[fromStation - 1];
    if ((startFrac - scrollProgress) / seg > SNAP_THRESHOLD) target = fromStation - 1;
  }
  glideTo(target);
}
window.__goToStation = goToStation;   // для проверки в браузере

// --- жест: палец ---
let navFrom = 0, gestureActive = false, gTouchX = 0, gTouchY = 0, gHorizontal = false;
addEventListener('touchstart', (e) => {
  if (document.body.classList.contains('signup-open') || brainOpen) return;
  const t = e.touches[0]; if (!t) return;
  // КАСАНИЕ ПО МОЗГУ → ЗАХВАТ для растекания: стопим скролл (Lenis), жест = касание (в ЛЮБУЮ сторону),
  // а не прокрутка. Поэтому растекание мозга срабатывает всегда, когда палец на мозге.
  if (tp > 0.5 && pk < 0.5 && hitSubject(t.clientX, t.clientY, 0.62)) {
    figureGrab = true; lenis.stop(); updatePointer(t.clientX, t.clientY); return;
  }
  gTouchX = t.clientX; gTouchY = t.clientY; gHorizontal = false;
  navFrom = settledStation; gestureActive = true;
}, { passive: true });
addEventListener('touchmove', (e) => {
  if (!gestureActive) return;
  const t = e.touches[0]; if (!t) return;
  const dx = Math.abs(t.clientX - gTouchX), dy = Math.abs(t.clientY - gTouchY);
  if (!gHorizontal && dx > dy && dx > 14) gHorizontal = true;   // горизонтальный жест — не наша история
}, { passive: true });
addEventListener('touchend', () => {
  if (figureGrab) { figureGrab = false; lenis.start(); pointerActive = false; _pHas = false; return; }   // отпустил мозг → скролл снова доступен
  if (!gestureActive) return; gestureActive = false;
  if (gHorizontal) return;
  settleFrom(navFrom);
}, { passive: true });
// --- жест: колесо/трекпад (нет «отпускания» — ловим затихание) ---
let wheelActive = false, wheelTimer = 0;
addEventListener('wheel', () => {
  if (document.body.classList.contains('signup-open') || brainOpen) return;
  if (!wheelActive) { wheelActive = true; navFrom = settledStation; }
  clearTimeout(wheelTimer);
  wheelTimer = setTimeout(() => { wheelActive = false; settleFrom(navFrom); }, 90);
}, { passive: true });
// клавиатура: стрелки/пробел = соседняя станция (для десктопа)
addEventListener('keydown', (e) => {
  if (document.body.classList.contains('signup-open') || brainOpen) return;
  if (['ArrowDown', 'PageDown', ' ', 'Spacebar'].includes(e.key)) { e.preventDefault(); goToStation(settledStation + 1); }
  else if (['ArrowUp', 'PageUp'].includes(e.key)) { e.preventDefault(); goToStation(settledStation - 1); }
  else if (e.key === 'Home') { e.preventDefault(); goToStation(0); }
  else if (e.key === 'End') { e.preventDefault(); goToStation(STATIONS.length - 1); }
});

const heroTop = document.querySelector('.hero-top');
const heroBottom = document.querySelector('.hero-bottom');
const heroEls = [heroTop, heroBottom];
const scrollHint = document.querySelector('.scroll-hint');
const pokerTop = document.querySelector('.poker-top');
const pokerBottom = document.querySelector('.poker-bottom');
function updateUIByScroll() {
  // ХОЛЛ занимает первый сегмент скролла; дальше — станция Покер
  tp = THREE.MathUtils.clamp(scrollProgress / HOLL_END, 0, 1);
  pk = THREE.MathUtils.clamp((scrollProgress - HOLL_END) / (1 - HOLL_END), 0, 1);
  document.body.classList.toggle('poker-in', pk > 0.12);
  // Hero-текст НЕ уезжает вверх: он РАСТВОРЯЕТСЯ НА МЕСТЕ и НАЛЕТАЕТ на зрителя
  // (увеличивается + размывается + гаснет) — как будто камера входит внутрь утки
  const hf = THREE.MathUtils.clamp(tp / 0.16, 0, 1);
  const e = hf * hf * (3 - 2 * hf);                 // плавная кривая
  heroEls.forEach((el) => { if (el) {
    el.style.opacity = String(1 - e);
    el.style.filter = `blur(${e * 9}px)`;
    el.style.transform = `translateX(-50%) scale(${1 + e * 0.55})`;
    el.style.pointerEvents = e > 0.4 ? 'none' : 'auto';
  } });
  scrollHint.style.opacity = String(Math.max(0, 1 - tp * 8));
  // About: текст ПОЯВЛЯЕТСЯ НА МЕСТЕ с лёгким приближением (зум из глубины), а при уходе назад —
  // отдаляется. Никакого «выезжает снизу». Ведём opacity+scale через CSS-переменные.
  document.body.classList.toggle('about-in', tp > 0.8 && pk < 0.1);
  const av = THREE.MathUtils.smoothstep(tp, 0.82, 1.0) * (1 - THREE.MathUtils.smoothstep(pk, 0.04, 0.3));
  document.body.style.setProperty('--av', av.toFixed(3));
  document.body.style.setProperty('--avs', (0.85 + 0.15 * av).toFixed(3));
  // Покер-текст «прилетает из точки» во второй половине перехода (после туннеля частиц)
  const pe = THREE.MathUtils.clamp((pk - 0.55) / 0.4, 0, 1);
  const pez = pe * pe * (3 - 2 * pe);
  [pokerTop, pokerBottom].forEach((el) => { if (!el) return;
    el.style.opacity = String(pez);
    el.style.transform = `translateX(-50%) scale(${0.7 + 0.3 * pez})`;
    el.style.filter = `blur(${(1 - pez) * 7}px)`;
    el.style.pointerEvents = pez > 0.7 ? 'auto' : 'none';   // кнопка кликабельна ТОЛЬКО когда Покер проявлен
  });
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
  poker.setReveal(pk);
  poker.update(t, dt, camera);
  updateDiceShadows();

  // ЗВУКОВЫЕ СЛОИ по сцене (поверх фонового пэда), как у igloo
  if (audioStarted && frame % 12 === 0) {
    sound.setLayer('metel', THREE.MathUtils.clamp(1 - tp * 3, 0, 1));        // воздух/метель в Hero
    // ПОСТОЯННЫЙ шелест частиц: всплеск на распаде (tp~0.5) И ровный фон на мозге (даже без касания) — как у igloo
    const rustleBurst = THREE.MathUtils.clamp(1 - Math.abs(tp - 0.5) * 3, 0, 1);
    const rustleBrain = THREE.MathUtils.clamp((tp - 0.6) / 0.25, 0, 1) * 0.5;   // тихий ровный фон у мозга
    sound.setLayer('rustle', Math.max(rustleBurst, rustleBrain));
    sound.setLayer('hum', brainOpen ? 1 : THREE.MathUtils.clamp((tp - 0.6) / 0.4, 0, 1)); // гул у мозга/в туннеле
  }

  // (фон — 3D-клуб)

  if (!TUNE) {
    // КАМЕРА: зафиксированный ракурс (подобран клиентом). Едет ВПЕРЁД вглубь по скроллу.
    const CAM0 = { x: 0.39, y: 0.10, z: 20.69 };
    const LOOK = { x: -0.49, y: -5.52, z: -8.27 };
    // ВХОД И ВЫХОД ИЗ ТУННЕЛЯ — ОДНА ТРАЕКТОРИЯ (инверсия), всё ведётся tunnelBlend (tb):
    // tb=0 — обычная сцена (герой/мозг по скроллу), tb=1 — внутри туннеля (камера придвинута,
    // смотрит вглубь -Z, фигура в центре). На выходе tb плавно 1→0 → камера/фигура/частицы
    // возвращаются по ТОМУ ЖЕ пути назад (приближение ↔ отдаление).
    const tb = easeIO(THREE.MathUtils.clamp(tunnelBlend, 0, 1));   // сглаженная кривая туннеля (вход/выход симметрично)
    // ЭФФЕКТИВНЫЙ tp: пока туннель активен — ЗАФИКСИРОВАННЫЙ (tpLatch), иначе живой скролл.
    // Так поза мозга (размер/место/ракурс) при входе и выходе ОДНА И ТА ЖЕ → выход возвращает
    // мозг ТОЧНО таким, каким он был до входа (никакой разницы в масштабе → нет «дырки»-вида).
    const tpEff = tunnelBlend > 0.001 ? tpLatch : tp;
    // СКОРОСТЬ СКРОЛЛА: при резком скролле tp прыгает → почти мгновенная установка (snap→1).
    const scrollSpeed = Math.abs(tp - prevTpCam); prevTpCam = tp;
    const snap = THREE.MathUtils.clamp(scrollSpeed * 14, 0, 1);
    const par = Math.max(0, 1 - tpEff * 6);
    // целевая поза камеры при скролле
    const sCamX = CAM0.x + pointerNX * 0.4 * par;            // слежение за пальцем/наклоном (параллакс)
    const sCamY = CAM0.y + (-pointerNY * 0.25 * par) + Math.sin(t * 0.3) * 0.05;
    const sCamZ = CAM0.z - easeIO(tpEff) * 14;
    // смешиваем со «втянутой» позой туннеля (0,0,6) по tb
    const camEase = window.__teleport ? 1 : THREE.MathUtils.lerp(THREE.MathUtils.lerp(0.05, 1, snap), 0.18, tb);
    // ПОКЕР: всё ОДНОВРЕМЕННО и плавно — пока летим сквозь туннель, камера плавно
    // доворачивается к столу, а стол приближается издалека (поворот незаметен за приближением).
    const pkc = easeIO(THREE.MathUtils.clamp(pk / 0.5, 0, 1));   // камера доворачивается чуть раньше — карты формируются перед зрителем
    const tCamX = THREE.MathUtils.lerp(sCamX + (0 - sCamX) * tb, POKER_CAM.x, pkc);
    const tCamY = THREE.MathUtils.lerp(sCamY + (0 - sCamY) * tb, POKER_CAM.y, pkc);
    const tCamZ = THREE.MathUtils.lerp(sCamZ + (6 - sCamZ) * tb, POKER_CAM.z, pkc);
    camera.position.x += (tCamX - camera.position.x) * camEase;
    camera.position.y += (tCamY - camera.position.y) * camEase;
    camera.position.z += (tCamZ - camera.position.z) * camEase;
    // точка прицела: LOOK (скролл) ↔ вглубь -Z (туннель) ↔ стол (покер)
    const lookX = THREE.MathUtils.lerp(LOOK.x + (0 - LOOK.x) * tb, POKER_LOOK.x, pkc);
    const lookY = THREE.MathUtils.lerp(LOOK.y + (0 - LOOK.y) * tb, POKER_LOOK.y, pkc);
    const lookZ = THREE.MathUtils.lerp(LOOK.z + (-10 - LOOK.z) * tb, POKER_LOOK.z, pkc);
    camera.lookAt(lookX, lookY, lookZ);
    // ФИГУРА: на луче взгляда (скролл) ↔ центр сцены (туннель), смешиваем по tb
    _camDir.set(LOOK.x - CAM0.x, LOOK.y - CAM0.y, LOOK.z - CAM0.z).normalize();
    const dist = DUCK_DIST - easeIO(tpEff) * 2.5;
    const brainPhase = THREE.MathUtils.clamp((tpEff - 0.5) / 0.35, 0, 1);
    const bcorrX = -0.16 * brainPhase;
    const bcorrY = -0.18 * brainPhase;   // мозг ближе к заголовку (меньше пустоты)
    const heroDrop = -0.08 * (1 - THREE.MathUtils.clamp(tpEff / 0.22, 0, 1));
    const sSubX = sCamX + _camDir.x * dist + DUCK_PX + bcorrX;
    const sSubY = sCamY + _camDir.y * dist + DUCK_PY + bcorrY + heroDrop;
    const sSubZ = sCamZ + _camDir.z * dist;
    const subEase = window.__teleport ? 1 : THREE.MathUtils.lerp(THREE.MathUtils.lerp(0.1, 1, snap), 0.3, tb);
    // ПОКЕР: мозг остаётся по центру и превращается в туннель частиц (см. цикл частиц ниже)
    subject.position.x += (sSubX * (1 - tb) - subject.position.x) * subEase;
    subject.position.y += (sSubY * (1 - tb) - subject.position.y) * subEase;
    subject.position.z += (sSubZ * (1 - tb) - subject.position.z) * subEase;
  } else if (orbit) {
    orbit.update();
    updateTuneHUD();
  }
  // затемнение завязано на ПРОГРЕСС туннеля (tunnelBlend): на входе темнеет, на выходе светлеет
  // ВМЕСТЕ с откатом туннеля (темнота уходит синхронно с возвратом мозга) — симметрично.
  const tdark = easeIO(THREE.MathUtils.clamp(tunnelBlend, 0, 1));
  const sceneFade = 1 - tp * 0.9;
  env.fade(sceneFade + (0.08 - sceneFade) * tdark);   // у мозга/в туннеле клуб почти гаснет; на выходе плавно возвращается

  // твёрдая утка: видна только в самом начале (быстрый кроссфейд в частицы)
  // ТВЁРДАЯ цветная утка на старте: видна при tp≈0, плавно растворяется в частицы при скролле 1→2.
  // Слежение за пальцем (поворот к указателю). Локальный распад в месте касания — через частицы (vGlow).
  if (duckMesh) {
    const solid = THREE.MathUtils.clamp(1 - tp / 0.1, 0, 1);
    if (solid > 0.001) {
      if (!duckMesh.visible && (introDone || introPlaying)) duckMesh.visible = true;
      const look = DUCK_FACE + (pointerActive && tp < 0.06 ? pointerNX * 0.2 : 0);   // следит за пальцем
      duckMesh.rotation.y += (look - duckMesh.rotation.y) * 0.06;
      duckMesh.rotation.z = 0;
      // лёгкое покачивание + импульс от кряка (тап по утке)
      let py = Math.sin(t * 0.5) * 0.03;
      if (duckMesh.userData.poke > 0) { duckMesh.userData.poke *= 0.9; py += duckMesh.userData.poke * 0.12; }
      duckMesh.position.y = py;
      // в интро утка ПРОЯВЛЯЕТСЯ по introDuckReveal (кроссфейд из частиц); дальше — обычная непрозрачность
      const op = solid * (introPlaying ? introDuckReveal : 1);
      duckMesh.traverse((c) => { if (c.material) c.material.opacity = op; });
    } else if (duckMesh.visible) duckMesh.visible = false;
  }

  // ЧАСТИЦЫ: непрерывный РАВНОМЕРНЫЙ распад утка→взрыв→мозг по tp
  if (particles && ready) {
    particles.material.uniforms.uTime.value = t;
    // видимость частиц: на старте — ФОРМИРОВАНИЕ утки (formProgress), затем кроссфейд в твёрдую утку
    // (гаснут по introDuckReveal); далее по скроллу распад утки (tp) → мозг → гаснут к Покеру.
    const baseOp = THREE.MathUtils.smoothstep(tp, 0.02, 0.12);
    const introOp = introPlaying ? formProgress * (1 - introDuckReveal) : 0;
    particles.material.uniforms.uOpacity.value = Math.max(baseOp, introOp) * (1 - THREE.MathUtils.smoothstep(pk, 0.55, 0.92));
    const N = PCOUNT, arr = particles.geometry.attributes.position.array;
    const onBrain = tp > 0.75;
    const TELE = window.__teleport === true;   // тест-флаг кешируем ОДИН раз за кадр (не в цикле)
    // ПОКА ТУННЕЛЬ АКТИВЕН — НЕТ НИКАКОГО СЛЕДА КАСАНИЯ. Каждый кадр держим disturb/vel/glow в нуле,
    // чтобы «залипший клик входа» (метка в точке нажатия) не пережил туннель и не дал «дырку» на выходе.
    if ((brainOpen || tunnelBlend > 0.001) && disturb && vel && glow) {
      for (let i = 0; i < N; i++) { disturb[i] = 0; glow[i] = 0; vel[i*3] = vel[i*3+1] = vel[i*3+2] = 0; }
      pointerActive = false; _pHas = false;
    }
    const radius = onBrain ? HOVER_RADIUS : HOVER_RADIUS * 0.6;
    const force = onBrain ? HOVER_FORCE : HOVER_FORCE * 0.5;
    // касание действует ТОЛЬКО пока палец реально движется (последние 140мс). Если указатель замер
    // (или событие touchend/mouseleave не пришло — частая причина «залипшего клика»), касание само
    // отпускается → частицы в той точке НЕ раздвигаются вечно, дырка не «висит» до повторного касания.
    // ПРЕЖНЯЯ физика касания: касание пока палец движется (свежесть 140мс) на утке (tp<0.05) и мозге.
    // ЗАХВАТ мозга (figureGrab) держит касание активным в ЛЮБУЮ сторону, даже без движения пальца.
    const pointerFresh = (performance.now() - pointerStamp) < 140;
    const touchOn = !brainOpen && (figureGrab || (pointerActive && pointerFresh && (tp < 0.05 || onBrain)));
    // труба заранее повёрнута на -brainYaw: после вращения объекта (rotation.y=brainYaw) она
    // выходит РОВНО по оси Z (прямо на зрителя) при ЛЮБОМ угле мозга → без рывка/доворота
    const _cy = Math.cos(brainYaw), _sy = Math.sin(brainYaw);
    // ПЕРЕХОД 2→3 «МОЗГ СТАНОВИТСЯ ИГРОЙ»: частицы мозга плавно пересобираются в 4 карты на столе.
    // Глаз следит за превращением → доворот камеры незаметен. Затем частицы гаснут, а настоящие
    // карты/стол проявляются (poker.setReveal) — бесшовная передача.
    const inTrans = !brainOpen && tunnelBlend < 0.001 && pk > 0.02 && pk < 0.93;
    let transShape = 0;
    if (inTrans) {
      transShape = easeIO(THREE.MathUtils.clamp(pk / 0.55, 0, 1));   // мозг ПОСТЕПЕННО собирается в карты
      particles.updateWorldMatrix(true, false);
      _invP.copy(particles.matrixWorld).invert();
      poker.group.updateWorldMatrix(true, true);                    // актуальные матрицы карт (стол растёт)
      for (let c = 0; c < 4; c++) _cardMats[c].copy(poker.cards[c].matrixWorld);
    }
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
      // СТАРТ: формирование утки — частицы слетаются с россыпи СВЕРХУ в форму утки (formProgress 0→1)
      if (formProgress < 0.999) {
        const fp = easeIO(formProgress);
        arr[i3]   = formStart[i3]   + (tx - formStart[i3])   * fp;
        arr[i3+1] = formStart[i3+1] + (ty - formStart[i3+1]) * fp;
        arr[i3+2] = formStart[i3+2] + (tz - formStart[i3+2]) * fp;
        vel[i3] = vel[i3+1] = vel[i3+2] = 0; disturb[i] = 0;
        continue;
      }
      // ТУННЕЛЬ — ПРЯМАЯ ИНТЕРПОЛЯЦИЯ дом(мозг)↔труба по сглаженному прогрессу tbCurve.
      // КАЖДАЯ частица позиционируется ЯВНО как lerp(домашняя точка формы, точка в трубе) — без
      // пружин и инерции. Поэтому на выходе (tbCurve→0) частица математически ТОЧНО в своём «доме» в
      // мозге → дырка/вмятина невозможна в принципе. Вход и выход — одна траектория (инверсия).
      if (tunnelBlend > 0.0005) {
        const tbCurve = easeIO(tunnelBlend);
        const ang = tunnelPos[i3];                  // угол на кольце
        const rad = tunnelPos[i3+1];                // радиус трубы
        const ph = (tunnelPos[i3+2] + flowZ) % 1;
        const depth = -44 + ph * 52;                // вдали (точка схода) → мимо камеры: труба летит НА зрителя
        // желаемая (осевая) труба, затем поворот на -brainYaw, чтобы после rotation.y вышло ровно по Z
        const dX = Math.cos(ang) * rad, dY = Math.sin(ang) * rad, dZ = depth;
        const tubeX = dX * _cy - dZ * _sy;
        const tubeY = dY;
        const tubeZ = dX * _sy + dZ * _cy;
        // tx/ty/tz — «домашняя» точка (мозг/форма по скроллу). Жёстко ставим интерполяцию дом↔труба.
        arr[i3]   = tx + (tubeX - tx) * tbCurve;
        arr[i3+1] = ty + (tubeY - ty) * tbCurve;
        arr[i3+2] = tz + (tubeZ - tz) * tbCurve;
        vel[i3] = vel[i3+1] = vel[i3+2] = 0;
        disturb[i] = 0;
        // свечение в туннеле — мягкое, по скорости потока
        const gg = 0.25 * tbCurve;
        glow[i] += (gg - glow[i]) * 0.1;
        continue;   // в туннеле НЕ применяем пружину/касание — позиция уже задана явно
      }
      // ПЕРЕХОД 2→3: частица летит в свой слот на одной из 4 карт (мозг → карты)
      if (inTrans) {
        // локальная точка карты: X = u (ширина), Z = v (высота), Y чуть над лицом
        _off.set(cardSlot[i3], 0.015, cardSlot[i3 + 1]);
        _off.applyMatrix4(_cardMats[cardSlot[i3 + 2] | 0]).applyMatrix4(_invP);   // карта→мир→локаль частиц
        arr[i3]     = tx + (_off.x - tx) * transShape;
        arr[i3 + 1] = ty + (_off.y - ty) * transShape;
        arr[i3 + 2] = tz + (_off.z - tz) * transShape;
        vel[i3] = vel[i3 + 1] = vel[i3 + 2] = 0; disturb[i] = 0;
        glow[i] += (0.18 * transShape - glow[i]) * 0.1;
        continue;
      }
      // КАСАНИЕ «ПАЛЕЦ В ПЕСКЕ» (как igloo): частицы у пальца РАССЫПАЮТСЯ каждая в свою сторону
      // (scatterDir доминирует) + лёгкий выброс ОТ пальца; мягкий спад fall² → НЕТ кольца/пузыря,
      // а магическое осыпание. Подсвечиваются и плавно стекаются обратно.
      if (touchOn) {
        const dx = arr[i3] - pointer3D.x, dy = arr[i3+1] - pointer3D.y, dz = arr[i3+2] - pointer3D.z;
        const dsq = dx*dx + dy*dy + dz*dz;
        if (dsq < radius * radius) {
          const dist = Math.sqrt(dsq) + 0.001, fall = 1 - dist / radius;
          const k = fall * fall * force * 1.6;          // мягкий спад к краю → без жёсткого кольца
          vel[i3]   += (scatterDir[i3]   * 0.9 + (dx/dist) * 0.32) * k;
          vel[i3+1] += (scatterDir[i3+1] * 0.9 + (dy/dist) * 0.32) * k;
          vel[i3+2] += (scatterDir[i3+2] * 0.9 + (dz/dist) * 0.32) * k;
          if (fall > disturb[i]) disturb[i] = fall;     // свет внутри + долгий мягкий возврат
          pushed++; moveSum += k;
        }
      }
      // ИМПУЛЬС РАСПАДА: в первый момент входа в туннель мозг разлетается наружу
      if (brainBurst > 0.01) {
        const bx = arr[i3], by = arr[i3+1], bz = arr[i3+2];
        const bl = Math.sqrt(bx*bx + by*by + bz*bz) + 0.001;
        const k = brainBurst * 0.10;
        vel[i3] += (bx/bl) * k; vel[i3+1] += (by/bl) * k; vel[i3+2] += (bz/bl) * k;
      }
      if (TELE) { arr[i3] = tx; arr[i3+1] = ty; arr[i3+2] = tz; vel[i3]=vel[i3+1]=vel[i3+2]=0; glow[i]=0; disturb[i]=0; continue; }
      // БЕЗ ПРУЖИНЫ: импульс касания/распада несёт инерцию и гаснет трением, затем позиция
      // ПЛАВНО (экспоненциально, без отскока) стягивается к форме — «затягивает как песок».
      vel[i3] *= TOUCH_DAMP; vel[i3+1] *= TOUCH_DAMP; vel[i3+2] *= TOUCH_DAMP;
      arr[i3] += vel[i3]; arr[i3+1] += vel[i3+1]; arr[i3+2] += vel[i3+2];
      // УВЕРЕННО ДЕРЖИМ ФОРМУ (масса остаётся мозгом, не расплывается). Быстрое «живое» движение
      // частиц В ПРЕДЕЛАХ формы и редкие вылазки за контур делает шейдер (смещение привязано к
      // базовой точке формы → каждая частица бегает, но облако сохраняет силуэт мозга).
      // в окне reform (сразу после выхода из туннеля) тянем к форме СИЛЬНО → мозг гарантированно
      // собирается целиком, без «дырки»; в обычном состоянии — мягкое удержание формы.
      const ease = reform > 0.01 ? 0.38 : (RETURN_SHAPE - (RETURN_SHAPE - RETURN_TOUCH) * disturb[i]);
      arr[i3] += (tx - arr[i3]) * ease; arr[i3+1] += (ty - arr[i3+1]) * ease; arr[i3+2] += (tz - arr[i3+2]) * ease;
      // палец водит → держим (×0.978); отпущен → гаснет ПЛАВНО (×0.91) → след стекается как песок,
      // мягко и небыстро (не резкий «схлоп» формы).
      disturb[i] *= touchOn ? 0.978 : 0.91;
      // СВЕТ ВНУТРИ частиц: тронутые ЯРКО светятся (заметный эффект касания), пока стекаются обратно
      const sp = Math.abs(vel[i3]) + Math.abs(vel[i3+1]) + Math.abs(vel[i3+2]);
      const g = Math.max(Math.min(sp * 7, 0.6), disturb[i] * 0.75);
      if (g > glow[i]) glow[i] = g; else glow[i] += (g - glow[i]) * 0.1;
    }
    particles.geometry.attributes.position.needsUpdate = true;
    particles.geometry.attributes.aglow.needsUpdate = true;
    pointerMove.multiplyScalar(0.80);   // волна за пальцем плавно затухает, когда движение прекращается
    // ЗВУК ОТ ДВИЖЕНИЯ ЧАСТИЦ: громкость = объём смещения, тон = направление
    if (pushed > 30 && frame % 4 === 0) {
      const vol = Math.min(moveSum * 0.4, 1);
      const pitch = THREE.MathUtils.clamp(0.5 + moveDir * 6, 0.3, 1.8);
      sound.playRustle(vol, pitch);
    }
    // ВРАЩЕНИЕ: мозг крутится на 360 (быстро). В туннеле вращение СНИМАЕТСЯ через tunnelBlend —
    // труба всегда строго НА камеру по Z, как бы мозг ни был повёрнут в момент клика.
    // brainYaw заморожен, пока открыт туннель → на выходе мозг собирается в УГОЛ ВХОДА и крутится дальше.
    // Связка с tunnelBlend делает переход плавным (нет резкого скачка положения).
    // мозг крутится ТОЛЬКО когда туннель полностью закрыт (tunnelBlend≈0). Во время входа/туннеля/выхода
    // вращение ЗАМОРОЖЕНО → на выходе мозг встаёт ТОЧНО ТЕМ ЖЕ боком, что и до входа (та же раскладка,
    // тот же край) — иначе «повёрнут иначе» читается как рыхлость/дырка.
    if (onBrain && tunnelBlend < 0.001) brainYaw += 0.010;
    particles.rotation.z = 0;
    // на стадии утки частицы повёрнуты ПОД твёрдую утку (DUCK_FACE) → при распаде по скроллу облако
    // совпадает с уткой по форме/размеру; к мозгу плавно раскручиваем к brainYaw.
    const _da = ((DUCK_FACE + Math.PI) % (Math.PI * 2)) - Math.PI;   // DUCK_FACE в [-π,π] (короткий доворот)
    particles.rotation.y = brainYaw + _da * (1 - THREE.MathUtils.clamp(tp / 0.32, 0, 1));
    // МАСШТАБ: поза мозга по ЗАФИКСИРОВАННОМУ tp (tpEffS), плавно → масштаб трубы (1) по tb.
    // Значит на выходе (tb→0) масштаб возвращается ТОЧНО к доходному размеру мозга — без «уехал крупнее».
    const tpEffS = tunnelBlend > 0.001 ? tpLatch : tp;
    const tbS = easeIO(THREE.MathUtils.clamp(tunnelBlend, 0, 1));
    const brainShrink = 1 - 0.5 * THREE.MathUtils.clamp((tpEffS - 0.5) / 0.45, 0, 1);  // мозг чуть крупнее
    const brainScale = brainShrink + Math.sin(t * 1.5) * 0.012 * (tpEffS > 0.75 ? 1 : 0);
    particles.scale.setScalar(brainScale + (1 - brainScale) * tbS);   // мозг ↔ труба (масштаб 1) плавно по tb
  }
  // непрерывный поток туннеля (фаза 0..1) + плавный переход мозг↔туннель
  if (tunnelBlend > 0.001) flowZ = (flowZ + dt * 0.16) % 1;   // поток трубы — и на входе, и на выходе
  if (brainBurst > 0.001) brainBurst *= 0.90;       // импульс распада быстро затухает (~0.5с)
  if (reform > 0.001) reform *= 0.95;               // окно сильной пересборки мозга после выхода (~1.3с, чинит дырку)
  // СИММЕТРИЧНО: вход и выход с ОДНОЙ скоростью (выход = инверсия входа), чуть быстрее (~на 1с)
  // ЕДИНЫЙ ТАЙМЛАЙН ТУННЕЛЯ: линейный прогресс 0→1 (вход) / 1→0 (выход) за 3 сек, симметрично.
  // tunnelBlend — линейный 0..1; сглаженную кривую (tb) берём как easeIO(tunnelBlend) ниже.
  const TUNNEL_DUR = 2.0;   // дайв-туннель при клике на мозг быстрее (было 3.0)
  tunnelBlend = THREE.MathUtils.clamp(tunnelBlend + (brainOpen ? 1 : -1) * (dt / TUNNEL_DUR), 0, 1);
  if (!brainOpen && tunnelBlend < 0.01 && particles) particles.rotation.z *= 0.95;
  // снимаем класс выхода, когда туннель полностью схлопнулся (текст уже улетел, темнота ушла)
  if (!brainOpen && tunnelBlend < 0.001 && document.body.classList.contains('tunnel-exit')) document.body.classList.remove('tunnel-exit');

  renderer.render(scene, camera);
}
animate();
// Единый ресайз: холст, камера, высота секций и Lenis всегда = ТЕКУЩЕЙ видимой высоте.
// Это убирает чёрную полосу снизу и застревание скролла, когда у браузера прячется адресная строка.
function onResize() {
  const w = window.innerWidth;
  const h = (window.visualViewport && window.visualViewport.height) ? Math.round(window.visualViewport.height) : window.innerHeight;
  document.documentElement.style.setProperty('--app-h', h + 'px');
  camera.aspect = w / h; camera.updateProjectionMatrix();
  renderer.setSize(w, h);
  if (lenis && typeof lenis.resize === 'function') lenis.resize();
}
addEventListener('resize', onResize);
if (window.visualViewport) window.visualViewport.addEventListener('resize', onResize);
onResize();

// ============================================================
// Mute / hover / глич текста
// ============================================================
function glitchFx(el) { if (!el) return; sound.playGlitch(); el.classList.add('glitching'); setTimeout(() => el.classList.remove('glitching'), 420); }
// заголовки и подзаголовки реагируют на наведение И на касание (тап работает на мобильном)
document.querySelectorAll('.hero-title, .hero-sub, .about-title, .about-label, .poker-title, .poker-label, .poker-sub').forEach((el) => {
  el.style.cursor = 'pointer';
  el.addEventListener('mouseenter', () => glitchFx(el));
  el.addEventListener('click', () => glitchFx(el));
});
document.querySelectorAll('.btn, .nav-cta, [data-t]').forEach((el) => {
  el.addEventListener('mouseenter', () => glitchFx(el));
});
document.querySelectorAll('a, button').forEach((el) => el.addEventListener('click', () => sound.playClick()));
document.querySelector('.btn-line').addEventListener('click', (e) => { e.preventDefault(); if (!navLock) goToStation(1); });

// ============================================================
// Анкета «Записаться за стол» — модалка, валидация, маска телефона, отправка
// ============================================================
{
  const su = document.getElementById('signup');
  const form = document.getElementById('su-form');
  const nameI = document.getElementById('su-name');
  const emailI = document.getElementById('su-email');
  const phoneI = document.getElementById('su-phone');
  const submitB = document.getElementById('su-submit');
  const card = document.querySelector('.su-card');
  const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  let pickedGame = '', pickedFormat = '';
  let submitted = false;     // флаг сессии: уже записался (сбрасывается только перезагрузкой страницы)
  let savedScroll = 0;       // позиция скролла на момент открытия — вернёмся ровно сюда (остаёмся в Покере)

  const openSignup = (presetFormat) => {
    savedScroll = (lenis && typeof lenis.scroll === 'number') ? lenis.scroll : window.scrollY;
    document.body.classList.add('signup-open');
    try { lenis.stop(); } catch (e) {}
    sound.playWhoosh?.(true);
    // уже записан в этой сессии → сразу показываем «спасибо», форму не показываем
    card.classList.toggle('done', submitted);
    if (presetFormat) {
      document.querySelectorAll('#su-format .su-chip').forEach((c) => {
        const on = c.dataset.v.toLowerCase().includes(presetFormat);
        c.classList.toggle('on', on); if (on) pickedFormat = c.dataset.v;
      });
    }
    if (!submitted) setTimeout(() => nameI && nameI.focus({ preventScroll: true }), 350);
  };
  const closeSignup = () => {
    document.body.classList.remove('signup-open');
    try { lenis.start(); lenis.scrollTo(savedScroll, { immediate: true, force: true }); } catch (e) {}
  };
  window.__openSignup = openSignup;   // для проверки в браузере

  // кнопки, открывающие анкету: на столе, в шапке, в hero
  document.getElementById('poker-signup')?.addEventListener('click', () => openSignup());
  document.querySelectorAll('.nav-cta, .hero-btns .btn-fill').forEach((b) => {
    b.addEventListener('click', (e) => { e.preventDefault(); openSignup(); });
  });
  document.getElementById('su-close')?.addEventListener('click', closeSignup);
  su?.addEventListener('click', (e) => { if (e.target === su) closeSignup(); });
  addEventListener('keydown', (e) => { if (e.key === 'Escape' && document.body.classList.contains('signup-open')) closeSignup(); });

  // выбор «фишек» (одна активная в группе)
  document.querySelectorAll('#su-game .su-chip').forEach((c) => c.addEventListener('click', () => {
    document.querySelectorAll('#su-game .su-chip').forEach((o) => o.classList.remove('on'));
    c.classList.add('on'); pickedGame = c.dataset.v; sound.playClick?.();
  }));
  document.querySelectorAll('#su-format .su-chip').forEach((c) => c.addEventListener('click', () => {
    document.querySelectorAll('#su-format .su-chip').forEach((o) => o.classList.remove('on'));
    c.classList.add('on'); pickedFormat = c.dataset.v; sound.playClick?.();
  }));

  // маска телефона +7 (9XX) XXX-XX-XX
  phoneI?.addEventListener('input', () => {
    let d = phoneI.value.replace(/\D/g, '');
    if (d.startsWith('8')) d = '7' + d.slice(1);
    if (d.startsWith('9')) d = '7' + d;
    if (!d.startsWith('7')) d = '7' + d;
    d = d.slice(0, 11);
    let out = '+7';
    if (d.length > 1) out += ' (' + d.slice(1, 4);
    if (d.length >= 4) out += ')';
    if (d.length >= 5) out += ' ' + d.slice(4, 7);
    if (d.length >= 8) out += '-' + d.slice(7, 9);
    if (d.length >= 10) out += '-' + d.slice(9, 11);
    phoneI.value = out;
  });

  // валидация на лету
  const validEmail = () => EMAIL_RE.test(emailI.value.trim());
  const validName = () => nameI.value.trim().length > 0;
  emailI?.addEventListener('input', () => {
    emailI.classList.toggle('valid', validEmail());
    emailI.classList.toggle('invalid', emailI.value.length > 0 && !validEmail());
  });
  nameI?.addEventListener('input', () => nameI.classList.remove('invalid'));

  form?.addEventListener('submit', async (e) => {
    e.preventDefault();
    let ok = true;
    if (!validName()) { nameI.classList.add('invalid'); ok = false; }
    if (!validEmail()) { emailI.classList.add('invalid'); ok = false; }
    if (!ok) { sound.playGlitch?.(); return; }
    submitB.disabled = true;
    const payload = {
      name: nameI.value.trim(), email: emailI.value.trim(), phone: phoneI.value.trim(),
      game: pickedGame, format: pickedFormat, source: 'site:poker',
    };
    // Этап 1: отправка письма через mail.php (на хостинге). Если бэкенд ещё не залит —
    // всё равно показываем успех (заявка не теряется визуально), на этапе 2 добавим БД + ТГ-бот.
    try { await fetch('mail.php', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) }); } catch (err) {}
    submitted = true;
    card.classList.add('done');                 // показываем красивое окно «спасибо»
    sound.playSuccess?.();   // без кряка
    setTimeout(closeSignup, 3400);               // само закрывается, остаёмся в Покере
  });
}

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
