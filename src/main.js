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
    // ПОЛНОЕ ОБЪЁМНОЕ ЗАПОЛНЕНИЕ: КАЖДАЯ частица уезжает внутрь на свою глубину
    // (cbrt = равномерно по всему объёму). Мозг забит частицами ЦЕЛИКОМ, внутри не пустой,
    // не просвечивает — сплошная живая масса, а не оболочка.
    const f = 0.10 + 0.90 * Math.cbrt(Math.random());
    x *= f; y *= f; z *= f;
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
const DUCK_PY = _qp.has('dy') ? parseFloat(_qp.get('dy')) : -0.25;  // утка чуть ниже центра (приподнята)
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
// РЕЛЬСА СТАНЦИЙ (кино, единая сцена). scrollProgress 0..1 делится на сегменты:
//   0 .. HOLL_END   — ХОЛЛ (утка→мозг), tp = scrollProgress/HOLL_END (Холл выглядит как раньше)
//   HOLL_END .. 1   — ПОКЕР, pk = доля прогресса внутри сегмента
// ============================================================
const HOLL_END = 0.5;
let pk = 0;                       // прогресс станции «Покер» 0..1
// Покерный стол стоит в тёмном углу клуба (вправо-вниз от камеры конца Холла).
const poker = new PokerStation();
poker.group.position.set(1.4, -1.55, 2.6);
poker.group.rotation.y = -0.28;
scene.add(poker.group);
// Поза камеры на станции Покер (подобрана под рамку стола; тонко тюнится скриншотами).
const POKER_CAM = { x: 0.5, y: isMobile ? 1.05 : 0.9, z: isMobile ? 8.8 : 7.4 };
const POKER_LOOK = { x: 1.35, y: -1.2, z: 2.6 };

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
let duckPos = null, brainPos = null, explodePos = null, tunnelPos = null, vel = null, delays = null, glow = null, disturb = null;
let tp = 0;            // transition progress 0..1 (равномерный распад)
let prevTpCam = 0;     // tp прошлого кадра — скорость скролла (анти-«вылет мозга сбоку» при резком скролле)
let ready = false, introDone = false, brainOpen = false;
let tunnelBlend = 0;   // 0 = мозг, 1 = туннель (плавно)
let camYaw = 0;        // поворот камеры вправо к бару
let flowZ = 0;         // фаза непрерывного потока частиц в туннеле
let brainBurst = 0;    // импульс «мозг рассыпается» в начале входа в туннель
let reform = 0;        // окно сильной пересборки мозга сразу после выхода из туннеля (чинит «дырку»)
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
const HOVER_RADIUS = 1.25, HOVER_FORCE = 0.035;   // мягкая сила раздвигания
const RETURN_SHAPE = 0.075, RETURN_TOUCH = 0.02, TOUCH_DAMP = 0.80;

function buildParticles() {
  const N = PCOUNT;
  vel = new Float32Array(N * 3); delays = new Float32Array(N); explodePos = new Float32Array(N * 3);
  tunnelPos = new Float32Array(N * 3);
  const cur = new Float32Array(N * 3), colors = new Float32Array(N * 3), sizes = new Float32Array(N);
  glow = new Float32Array(N);   // внутреннее свечение частицы (растёт от движения)
  disturb = new Float32Array(N);   // «разворошённость» касанием: 1 = только что толкнули, мягко затухает
  const dir = new THREE.Vector3();
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
    // ОДИН ЦВЕТ как igloo — ледяной белый с лёгким разбросом яркости (монохром)
    const shade = 0.82 + Math.random() * 0.18;
    colors[i*3] = shade; colors[i*3+1] = shade * 1.02; colors[i*3+2] = shade * 1.06; // чуть холоднее
    sizes[i] = 0.032 + Math.random() * 0.034;  // зёрна перекрываются → сплошная поверхность
    glow[i] = 0;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(cur, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geo.setAttribute('size', new THREE.BufferAttribute(sizes, 1));
  geo.setAttribute('aglow', new THREE.BufferAttribute(glow, 1));
  const mat = new THREE.ShaderMaterial({
    uniforms: { uPixelRatio: { value: PIXEL_RATIO }, uTime: { value: 0 }, uOpacity: { value: 0 } },
    vertexShader: `attribute float size; attribute float aglow; varying vec3 vColor; varying float vSh; varying float vGlow; varying float vFade;
      uniform float uPixelRatio; uniform float uTime;
      void main(){ vColor=color; vGlow=aglow;
        vSh=0.82+0.18*sin(position.y*9.0+position.x*7.0);
        // ЖИВАЯ МАССА: каждая частица БЫСТРО и ПЛАВНО движется В ПРЕДЕЛАХ формы (смещение привязано
        // к её точке формы → силуэт мозга сохраняется), соседи текут согласованно (поле течения).
        vec3 p = position;
        float ph = position.x*5.3 + position.y*4.1 + position.z*6.7;
        float rnd = fract(sin(ph*1.7)*43758.5453);
        // согласованное поле течения (вихри), скорость ~×2; амплитуда умеренная → форма держится
        vec3 fl;
        fl.x = sin(position.y*2.6 + uTime*1.5) + cos(position.z*2.1 + uTime*1.1);
        fl.y = sin(position.z*2.6 + uTime*1.7) + cos(position.x*2.1 + uTime*1.3);
        fl.z = sin(position.x*2.6 + uTime*1.3) + cos(position.y*2.1 + uTime*1.9);
        p += fl * 0.05;
        // быстрая мелкая «жизнь» у каждой частицы (бегает, но плавно)
        p.x += sin(uTime*3.0 + ph)*0.012; p.y += cos(uTime*3.3 + ph*1.3)*0.012; p.z += sin(uTime*2.7 + ph*0.8)*0.012;
        // ВЫЛАЗКИ за контур: ~22% частиц плавно выходят наружу и возвращаются (масса «дышит»)
        float ex = smoothstep(0.78, 1.0, rnd) * 0.09;
        p += normalize(position + vec3(0.0001)) * sin(uTime*1.6 + ph*2.0) * ex;
        vec4 mv=modelViewMatrix*vec4(p,1.0);
        // ГЛУБИНА: дальние частицы тускнеют → в туннеле читается уходящая вглубь труба
        vFade = clamp(1.0 - (-mv.z - 3.0)/34.0, 0.06, 1.0);
        gl_PointSize=size*(1.0+vGlow*0.35)*uPixelRatio*(300.0/-mv.z); gl_Position=projectionMatrix*mv; }`,
    fragmentShader: `varying vec3 vColor; varying float vSh; varying float vGlow; varying float vFade; uniform float uOpacity;
      void main(){ vec2 uv=gl_PointCoord-vec2(0.5); float d=length(uv);
        // ПЛОТНЫЙ НЕПРОЗРАЧНЫЙ диск с мягким краем: зёрна перекрываются и образуют
        // СПЛОШНУЮ матовую поверхность (как песок у igloo) — фон не просвечивает
        float a = smoothstep(0.5, 0.28, d);
        // объёмная подсветка сверху + лёгкое ледяное свечение в движении (мягко, без вспышки)
        float shade = 0.58 + 0.42 * (-uv.y + 0.5);
        vec3 col = vColor * vSh * shade + vec3(0.40,0.6,1.0) * vGlow * 0.55;
        gl_FragColor = vec4(col, a * uOpacity * (0.35 + 0.65*vFade)); }`,
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
    brainPos = sampleModel(brain, PCOUNT);
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
  // быстрый путь (?fast) — для проверки финальной композиции без ожидания интро
  if (_qp.has('fast')) {
    if (duckMesh) { duckMesh.visible = true; duckMesh.rotation.y = DUCK_FACE; duckMesh.position.set(0, HERO_Y, 0); duckMesh.scale.set(1, 1, 1); }
    document.body.classList.add('hero-in'); introDone = true; return;
  }
  // ТЕКСТ 1 экрана появляется ПОСЛЕ кубиков (вместе с выходом утки), не сразу
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
  // ТЕКСТ появляется ТОЛЬКО ПОСЛЕ выхода утки (утка приходит к ~3.9с) — не до кубиков
  tl.add(() => document.body.classList.add('hero-in'), 3.9);
  tl.add(() => { introDone = true; }, 4.4);
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
// РЕАКЦИЯ НА НАКЛОН ТЕЛЕФОНА: параллакс камеры следует за наклоном (не трогает частицы)
if (isMobile) {
  addEventListener('deviceorientation', (ev) => {
    if (ev.gamma == null || ev.beta == null) return;
    pointerNX = THREE.MathUtils.clamp(ev.gamma / 28, -1, 1);
    pointerNY = THREE.MathUtils.clamp((ev.beta - 40) / 28, -1, 1);
  }, { passive: true });
}
// КРИТИЧНО: на телефоне сбрасываем указатель после касания, иначе звук частиц звучит постоянно
addEventListener('touchend', () => { pointerActive = false; _pHas = false; });
addEventListener('touchcancel', () => { pointerActive = false; _pHas = false; });

function hitSubject(x, y, r = 0.32) {
  pointer.x = (x / innerWidth) * 2 - 1; pointer.y = -(y / innerHeight) * 2 + 1;
  const c = subject.getWorldPosition(new THREE.Vector3()).project(camera);
  const dx = pointer.x - c.x, dy = pointer.y - c.y;
  return Math.sqrt(dx * dx + dy * dy) < r;
}
addEventListener('click', (e) => {
  if (!introDone || brainOpen) return;
  if (tp < 0.2 && duckMesh && duckMesh.visible && hitSubject(e.clientX, e.clientY)) { sound.playQuack(); duckMesh.userData.poke = 0.3; }
  else if (tp > 0.7 && pk < 0.05 && hitSubject(e.clientX, e.clientY, 0.55)) openBrain();   // мозг крупный — больше зона (не в Покере)
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
// Скролл
// ============================================================
const lenis = new Lenis({ duration: 1.15, smoothWheel: true });
window.__lenis = lenis;   // для проверки в браузере
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
  // About проявляется к концу (мозг собран). Плавно, без рывка.
  document.body.classList.toggle('about-in', tp > 0.8 && pk < 0.1);
  const secNo = pk > 0.12 ? '03' : (tp > 0.5 ? '02' : '01');
  counter.textContent = secNo + ' / 08';
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
  poker.update(t, dt);
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
    const sCamX = CAM0.x + pointerNX * 0.4 * par;
    const sCamY = CAM0.y + (-pointerNY * 0.25 * par) + Math.sin(t * 0.3) * 0.05;
    const sCamZ = CAM0.z - easeIO(tpEff) * 14;
    // смешиваем со «втянутой» позой туннеля (0,0,6) по tb
    const camEase = window.__teleport ? 1 : THREE.MathUtils.lerp(THREE.MathUtils.lerp(0.05, 1, snap), 0.18, tb);
    // ПОКЕР: камера поворачивается вправо к столу (плавно по pk). Во время Покера tb=0,
    // поэтому туннельные слагаемые обнуляются, и поза честно смешивается Холл↔Стол.
    const pkc = easeIO(THREE.MathUtils.clamp(pk, 0, 1));
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
    const bcorrY = -0.12 * brainPhase;   // мозг чуть выше — ровно по центру между заголовком и карточками
    const heroDrop = -0.08 * (1 - THREE.MathUtils.clamp(tpEff / 0.22, 0, 1));
    const sSubX = sCamX + _camDir.x * dist + DUCK_PX + bcorrX;
    const sSubY = sCamY + _camDir.y * dist + DUCK_PY + bcorrY + heroDrop;
    const sSubZ = sCamZ + _camDir.z * dist;
    const subEase = window.__teleport ? 1 : THREE.MathUtils.lerp(THREE.MathUtils.lerp(0.1, 1, snap), 0.3, tb);
    // ПОКЕР: мозг сворачивается и улетает вправо-вниз («закатывается под стол»)
    const pkOffX = pkc * 5.5, pkOffY = -pkc * 3.0;
    subject.position.x += ((sSubX + pkOffX) * (1 - tb) - subject.position.x) * subEase;
    subject.position.y += ((sSubY + pkOffY) * (1 - tb) - subject.position.y) * subEase;
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
    // частицы появляются в Холле и ГАСНУТ при уходе в Покер (мозг улетает)
    particles.material.uniforms.uOpacity.value = THREE.MathUtils.smoothstep(tp, 0.02, 0.12) * (1 - THREE.MathUtils.smoothstep(pk, 0.05, 0.45));
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
    const pointerFresh = (performance.now() - pointerStamp) < 140;
    const touchOn = pointerActive && pointerFresh && (tp < 0.05 || onBrain) && !brainOpen;
    // труба заранее повёрнута на -brainYaw: после вращения объекта (rotation.y=brainYaw) она
    // выходит РОВНО по оси Z (прямо на зрителя) при ЛЮБОМ угле мозга → без рывка/доворота
    const _cy = Math.cos(brainYaw), _sy = Math.sin(brainYaw);
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
      // КАСАНИЕ «палец в песке»: мягко РАЗДВИГАЕМ частицы в стороны от пальца (шире, плавно),
      // они подсвечиваются изнутри; затем без пружины стекаются обратно.
      if (touchOn) {
        const dx = arr[i3] - pointer3D.x, dy = arr[i3+1] - pointer3D.y, dz = arr[i3+2] - pointer3D.z;
        const dsq = dx*dx + dy*dy + dz*dz;
        if (dsq < radius * radius) {
          const dist = Math.sqrt(dsq) + 0.001, fall = 1 - dist / radius;
          const push = fall * force;                   // мягко, шире (не взрыв)
          vel[i3] += (dx/dist) * push; vel[i3+1] += (dy/dist) * push; vel[i3+2] += (dz/dist) * push;
          if (fall > disturb[i]) disturb[i] = fall;     // помечаем → свет внутри + долгий мягкий возврат
          pushed++;
          moveSum += push; moveDir += (dy/dist) * push;
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
      // палец активно водит → гаснет мягко (×0.972); отпущен/замер → гаснет БЫСТРО (×0.82),
      // чтобы вмятина от касания НЕ «висела» секундами (исток «залипшей дырки»).
      disturb[i] *= touchOn ? 0.972 : 0.82;
      // СВЕТ ВНУТРИ частиц: от скорости И от касания (тронутые светятся, пока стекаются)
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
    particles.rotation.y = brainYaw;  // НИКАКОГО рывка/доворота на входе-выходе: труба заранее повёрнута на -brainYaw
    // МАСШТАБ: поза мозга по ЗАФИКСИРОВАННОМУ tp (tpEffS), плавно → масштаб трубы (1) по tb.
    // Значит на выходе (tb→0) масштаб возвращается ТОЧНО к доходному размеру мозга — без «уехал крупнее».
    const tpEffS = tunnelBlend > 0.001 ? tpLatch : tp;
    const tbS = easeIO(THREE.MathUtils.clamp(tunnelBlend, 0, 1));
    const brainShrink = 1 - 0.52 * THREE.MathUtils.clamp((tpEffS - 0.5) / 0.45, 0, 1);  // мозг компактнее → влезает между заголовком и карточками
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
  const TUNNEL_DUR = 3.0;
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
