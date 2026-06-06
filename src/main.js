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
import { DartsStation } from './three/darts.js';
import { BilliardStation } from './three/billiard.js';
import { SpaceField } from './three/space.js';
import { BarStation } from './three/bar.js';
import { FaqStation } from './three/faq.js';

// Метка сборки — проверить в консоли, что загрузилась НОВАЯ версия (а не старая из кэша)
console.log('%c DUCK\'S build v55 — FAQ: ЧЁРНЫЕ глянцевые фишки (вопрос/ответ на гранях), тап→переворот в центре с ответом на фишке, золотая фишка=CTA→бот; БЕСКОНЕЧНАЯ петля в ОБЕ стороны (камера-дайв в темноту, утка из частиц) ', 'background:#cc0000;color:#fff;padding:3px;border-radius:3px');

// Режим настройки камеры: ducks.games/?tune — двигаешь сцену пальцем, в углу цифры + копировать
const TUNE = new URLSearchParams(location.search).has('tune');

// ============================================================
// Аналитика: лёгкий трекер визитов/кликов/конверсий → api.php (admin-панель строит графики).
// Не падает, если бэкенда нет (sendBeacon/fetch в try). Глобально: window.__ducksTrack(type,label).
// ============================================================
window.__ducksTrack = (type, label, meta) => {
  try {
    const body = JSON.stringify({ type, label: label || '', meta: meta || '' });
    if (navigator.sendBeacon) navigator.sendBeacon('api.php?action=track', new Blob([body], { type: 'application/json' }));
    else fetch('api.php?action=track', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body, keepalive: true });
  } catch (e) {}
};
// визит — один раз за загрузку
window.__ducksTrack('visit', location.pathname);

// ============================================================
// Контент из админки: api.php?action=getContent → применяем к [data-edit]/[data-edit-html].
// Ключи вида "hero.title". Если бэкенда/значения нет — остаётся текст по умолчанию из HTML.
// FAQ-фишки и станции тоже читают window.__ducksContent (если заданы).
// ============================================================
window.__ducksContent = {};
function applyContent(c) {
  const get = (k) => k.split('.').reduce((o, p) => (o && o[p] != null ? o[p] : undefined), c);
  document.querySelectorAll('[data-edit]').forEach((el) => {
    const v = get(el.getAttribute('data-edit'));
    if (typeof v === 'string' && v.length) el.textContent = v;
  });
  document.querySelectorAll('[data-edit-html]').forEach((el) => {
    const v = get(el.getAttribute('data-edit-html'));
    if (typeof v === 'string' && v.length) el.innerHTML = v;
  });
}
try {
  fetch('api.php?action=getContent').then((r) => r.json()).then((res) => {
    if (res && res.content && typeof res.content === 'object') {
      window.__ducksContent = res.content;
      applyContent(res.content);
      window.dispatchEvent(new CustomEvent('ducks:content', { detail: res.content }));
    }
  }).catch(() => {});
} catch (e) {}
// клики по любым кнопкам/CTA с data-track или классом .btn — для воронки в админке
addEventListener('click', (e) => {
  const el = e.target.closest('[data-track], .btn, a.btn-fill, a.btn-line');
  if (!el) return;
  const label = el.dataset.track || el.id || (el.textContent || '').trim().slice(0, 40);
  if (label) window.__ducksTrack('click', label);
}, { capture: true, passive: true });

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
function sampleModel(scene, count, shellMin = 0) {
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
    // shellMin=0 → полное заполнение (утка); shellMin≈0.9 → ТОЛЬКО ПОВЕРХНОСТЬ (мозг — оболочка по
    // форме, без заливки, видны извилины/борозды/силуэт как на референсе).
    const f = shellMin + (1 - shellMin) * Math.cbrt(Math.random());
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
window.__velMax = () => { let m = 0; if (vel) for (let i = 0; i < vel.length; i++) { const v = Math.abs(vel[i]); if (v > m) m = v; } return +m.toFixed(4); };   // макс смещение/скорость = ДВИЖЕНИЕ частиц
// хуки проверки интро/скролла (headless): реальные значения состояния
window.__introState = () => ({
  fp: +formProgress.toFixed(3), dr: +introDuckReveal.toFixed(3), playing: introPlaying,
  heroIn: document.body.classList.contains('hero-in'),
  textOp: +parseFloat(getComputedStyle(document.querySelector('.hero-top') || document.body).opacity).toFixed(2),
  duckVis: !!(duckMesh && duckMesh.visible), uReveal: +uDuckReveal.value.toFixed(2),
  diceVis: (typeof dice !== 'undefined' && dice[0]) ? dice[0].visible : false, introDone,
  ml: (typeof modelsLoaded !== 'undefined') ? modelsLoaded : false,
});
window.__scrollState = () => ({ sp: +scrollProgress.toFixed(3), brainOpen, settled: settledStation, tp: +tp.toFixed(3), pk: +pk.toFixed(3) });
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
const _loopDir = new THREE.Vector3();   // дайв-вектор петли (камера летит вперёд в темноту)
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
const baseBg = scene.background;   // базовый фон-градиент (env его поставил) — для возврата после FAQ
if (ROT_Y) env.group.rotation.y = ROT_Y;   // поворот зала для подбора ракурса

// ============================================================
// РЕЛЬСА СТАНЦИЙ (кино, единая сцена). scrollProgress 0..1 делится на сегменты (5 секций контента):
//   0 .. HOLL_END      — ХОЛЛ (утка→мозг), tp = scrollProgress/HOLL_END
//   HOLL_END..POKER_END  — ПОКЕР, pk = доля прогресса внутри сегмента
//   POKER_END..DARTS_END — ДАРТС, dk = доля прогресса внутри сегмента
//   DARTS_END .. 1     — БИЛЬЯРД, bk = доля прогресса внутри сегмента
// границы = верх соответствующей секции (5 секций по 100vh → k/(N-1)); пейсинг каждой станции = 1 секция.
// ============================================================
// 7 секций (Холл, Покер, Дартс, Бильярд, Бар, FAQ): равные шестые доли скролла.
// Границы = верх соответствующей секции (7 секций по 100vh → k/6).
const HOLL_END = 1 / 6;
const POKER_END = 2 / 6;
const DARTS_END = 3 / 6;
const BILLIARD_END = 4 / 6;
const BAR_END = 5 / 6;
let pk = 0;                       // прогресс станции «Покер» 0..1
let dk = 0;                       // прогресс станции «Дартс» 0..1
let bk = 0;                       // прогресс станции «Бильярд» 0..1
let ak = 0;                       // прогресс станции «Бар» 0..1
let fk = 0;                       // прогресс станции «FAQ» (фишки) 0..1
// Покерный стол стоит в тёмном углу клуба (вправо-вниз от камеры конца Холла).
const poker = new PokerStation();
poker.group.position.set(0.4, -1.4, 1.8);   // стол выше — меньше пустоты под заголовком
poker.group.rotation.y = 0;   // стол смотрит на камеру (карты формируются перед зрителем, не сбоку)
scene.add(poker.group);
// Поза камеры на станции Покер (подобрана под рамку стола; тонко тюнится скриншотами).
const POKER_CAM = { x: 0.4, y: isMobile ? 1.55 : 1.05, z: isMobile ? 8.2 : 5.8 };
const POKER_LOOK = { x: 0.4, y: -1.3, z: 1.7 };
window.__pokerLift = (i) => poker.cards[i] && poker.toggleLift(poker.cards[i]);   // для проверки в браузере

// ДАРТС: процедурная мишень в пустоте впереди-вглубь. Камера «наезжает вперёд» сквозь темноту.
const darts = new DartsStation({
  onThrow: () => { sound.playDartThrow(); updateDartsHud(); },   // обновляем пипсы/счёт сразу при броске (виден сброс новой серии)
  onHit: (pts, label) => {
    const zone = label.indexOf('ЯБЛОЧКО') === 0 ? 'bull'
      : (label.indexOf('ТРИПЛ') === 0 || label.indexOf('ДАБЛ') === 0 || label === 'БУЛЛ') ? 'wire' : 'wood';
    sound.playDartHit(zone);
    dartResult(pts, label);
  },
  onMiss: () => { sound.playDartHit('wood'); dartResult(0, 'мимо'); },
});
darts.group.position.set(0.4, 0.0, -5.4);   // мишень по центру кадра, глубже (заголовок не налезает)
scene.add(darts.group);
// камера отодвинута → мишень меньше в кадре, сверху место под заголовок, снизу под табло
const DARTS_CAM = { x: 0.4, y: 0.3, z: isMobile ? 2.3 : 0.9 };
const DARTS_LOOK = { x: 0.4, y: 0.0, z: -5.4 };
window.__darts = darts;
window.__setTipsy = (v) => { darts.tipsy = THREE.MathUtils.clamp(+v || 0, 0, 1); };   // связь с баром (позже)

// БИЛЬЯРД: тёмное сукно + красный неон-борт, по центру вращается шар-8 (GLB). Камера низко
// проезжает над сукном с лёгким креном. Интерактив — закрутка шара касанием (без счёта).
const billiard = new BilliardStation({ onCue: () => sound.playDartHit && sound.playDartHit('wood') });
billiard.group.position.set(0.4, 0.2, -3.0);   // ШАР по центру кадра (стол убран)
scene.add(billiard.group);
// поза камеры: ПРЯМО перед шаром; взгляд строго вперёд (-Z), БЕЗ поворотов и крена.
// Переход 4→5 = камера едет РОВНО НАЗАД (z растёт) от Дартса к этой позе.
const BILLIARD_CAM = { x: 0.4, y: 0.2, z: isMobile ? 5.4 : 4.6 };
const BILLIARD_LOOK = { x: 0.4, y: 0.2, z: -3.0 };
const BILLIARD_ROLL = 0;       // крена нет
window.__billiard = billiard;

// КОСМИЧЕСКИЙ ФОН (сеть-плексус как у MindOS). Включается на переходе Дартс→Бильярд (по bk),
// полностью заменяет фон клуба. Стоит ЗА шаром (renderOrder<0 → шар поверх).
const space = new SpaceField(isMobile);
space.group.position.set(0.4, 0.2, -16);
scene.add(space.group);

// БАР (станция 6): барная стойка проявляется из темноты космоса ПРЯМО в кадре — камера НЕ движется.
// Стоит там же, где был шар Бильярда (перед статичной камерой). Клик по бокалу → мини-игра «глоток».
const bar = new BarStation(isMobile, {
  onClink: () => sound.playGlassClink?.(),
  onGulp:  () => sound.playGulp?.(),
  onSip:   () => sound.playSip?.(),
  onPour:  () => sound.playPour?.(1.15),
  onFizz:  () => sound.playFizz?.(1.4),
});
// Бар стоит на РЕАЛЬНОЙ барной стойке клуба (ракурс подобран клиентом через ?tune).
bar.group.position.set(2.35, -5.7, -12.3);     // бокал ПЛОТНО на розовой барной стойке клуба (высота выверена по рендеру)
bar.baseScale = isMobile ? 0.62 : 0.92;
scene.add(bar.group);
// Поза камеры Бара (отодвинута/чуть ниже: бокал не огромный, бутылка при наливе не задевает заголовок).
// На мобиле камера чуть больше наклонена вниз → композиция выше в кадре, бутылка/бокал НЕ перекрываются
// нижними карточками (на десктопе карточки по бокам — наклон не нужен).
const BAR_CAM = { x: -2.78, y: -4.32, z: -12.40 };
const BAR_LOOK = { x: 3.30, y: isMobile ? -5.5 : -5.03, z: -12.35 };
window.__bar = bar;
window.__barSip = () => bar.tapGlass({ ray: { intersectsSphere: () => true } });   // тест в браузере
window.__barPose = (k = 0.5) => bar.debugPour(k);   // статичная поза налива для скриншота
window.__setBarLookY = (v) => { BAR_LOOK.y = v; };  // живой подбор наклона камеры Бара

// FAQ (станция 7): стол с покерными фишками-вопросами. Камера из Бара отъезжает/доворачивается
// сверху-спереди к сукну. Фишки лежат лицом вверх; клик → фишка крутится, вылетает в центр,
// встаёт к зрителю, main показывает ОТВЕТ. Золотая фишка «ЗАПИСАТЬСЯ» → ТГ-бот. Дальше — петля.
const faq = new FaqStation(isMobile, { onSelect: () => sound.playCardSlide?.(), onCta: () => sound.playQuack?.() });
faq.group.position.set(0.4, -0.4, -3.2);            // стол ПЛАШМЯ (вид сверху, как на фото 2)
faq.baseScale = isMobile ? 0.78 : 1.0;
scene.add(faq.group);
// ДВУХПРОХОДНЫЙ РЕНДЕР FAQ:
//  • ФОН — зал клуба с КАМЕРЫ КЛИЕНТА (main rail доводит камеру в эту позу: бар→FAQ→петля плавно);
//  • СТОЛ — сверху, с ОТДЕЛЬНОЙ камеры faqTableCam (ровно как фото 2), поверх фона.
const FAQ_CAM = { x: 2.31, y: -1.49, z: 1.10 };     // камера ФОНА (зал клуба) — как указал клиент
const FAQ_LOOK = { x: 1.55, y: -3.22, z: -12.11 };
// отдельная камера для СТОЛА — строго сверху-спереди (3/4, лёгкий наклон), как фото 2
const faqTableCam = new THREE.PerspectiveCamera(44, innerWidth / innerHeight, 0.1, 60);
const FAQ_TCAM = { x: 0.4, y: isMobile ? 4.7 : 3.9, z: isMobile ? 1.6 : 1.0 };
const FAQ_TLOOK = { x: 0.4, y: -0.5, z: -3.5 };
function updateFaqTableCam() {
  faqTableCam.aspect = camera.aspect; faqTableCam.fov = camera.fov; faqTableCam.updateProjectionMatrix();
  faqTableCam.position.set(FAQ_TCAM.x, FAQ_TCAM.y, FAQ_TCAM.z); faqTableCam.up.set(0, 1, 0);
  faqTableCam.lookAt(FAQ_TLOOK.x, FAQ_TLOOK.y, FAQ_TLOOK.z);
}
window.__faq = faq;
window.__faqPick = (i) => faq.select(i);   // тест выбора фишки в браузере

let faqBg = 0;   // степень «FAQ-режима» (двухпроходный рендер активен)
// диагностика: высота реальной барной стойки клуба под бокалом и по лучу взгляда
window.__probeBar = (x, z) => {
  const vis = bar.group.visible; bar.group.visible = false;
  x = (x === undefined) ? bar.group.position.x : x;
  z = (z === undefined) ? bar.group.position.z : z;
  raycaster.set(new THREE.Vector3(x, 0, z), new THREE.Vector3(0, -1, 0));
  const down = raycaster.intersectObjects(scene.children, true).map((h) => +h.point.y.toFixed(3));
  bar.group.visible = vis; return { x, z, down };
};
window.__dartTap = (sx, sy) => {   // headless: бросок в экранные координаты
  pointer.x = (sx / innerWidth) * 2 - 1; pointer.y = -(sy / innerHeight) * 2 + 1;
  raycaster.setFromCamera(pointer, camera); return darts.tap(raycaster, camera);
};

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
// проявление твёрдой утки СНИЗУ ВВЕРХ на старте: видны только верт. точки ниже порога (порог растёт)
const uDuckReveal = { value: 5 };
let duckPos = null, brainPos = null, explodePos = null, tunnelPos = null, vel = null, delays = null, glow = null, disturb = null, cardSlot = null, formStart = null, scatterDir = null;
let tp = 0;            // transition progress 0..1 (равномерный распад)
let formProgress = 1;  // формирование утки из частиц на старте (0→1): частицы слетаются и собираются в утку
let introDuckReveal = 0, introPlaying = false;   // кроссфейд частицы→твёрдая утка в конце интро
let duckYmin = -1.3, duckYmax = 1.3;             // границы утки по высоте — для сборки СНИЗУ ВВЕРХ
let heroReveal = 0;                              // проявление hero-текста (0 в начале → 1 во время интро); гасит inline-opacity
let prevTpCam = 0;     // tp прошлого кадра — скорость скролла (анти-«вылет мозга сбоку» при резком скролле)
let ready = false, introDone = false, brainOpen = false;
let tunnelBlend = 0;   // 0 = мозг, 1 = туннель (плавно)
let camYaw = 0;        // поворот камеры вправо к бару
let flowZ = 0;         // фаза непрерывного потока частиц в туннеле
let brainBurst = 0;    // импульс «мозг рассыпается» в начале входа в туннель
let reform = 0;        // окно сильной пересборки мозга сразу после выхода из туннеля (чинит «дырку»)
let brainGrab = false; // ЗАЩЁЛКА: палец коснулся мозга → анимация касания ВКЛ на весь жест (любой свайп/сторона), скролл НЕ трогаем
let billiardGrab = false, _bLastX = 0, _bLastY = 0;   // ЗАЩЁЛКА закрутки шара-8 (свайп по шару)
let _glowMax = 0, _prevTpP = -1, _prevPkP = -1;   // для idle-оптимизации (в покое не грузим частицы в GPU)
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
const RETURN_SHAPE = 0.075, RETURN_TOUCH = 0.01, TOUCH_DAMP = 0.90;   // тронутые частицы дольше «текут» и МЕДЛЕННО, плавно возвращаются в форму

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
  duckYmin = 1e9; duckYmax = -1e9;
  for (let i = 0; i < N; i++) { const y = duckPos[i*3+1]; if (y < duckYmin) duckYmin = y; if (y > duckYmax) duckYmax = y; }
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
    // ПРОДОЛЬНАЯ БОРОЗДА (главный признак мозга): тёмный жёлоб по центру (|x|≈0) на верхней половине
    const fissure = Math.exp(-(bx*bx) / 0.03) * THREE.MathUtils.smoothstep(by, -0.3, 0.7);
    const fs = (0.06 + 0.94 * fold * fold) * (0.34 + 0.66 * depth) * (1 - fissure * 0.6);   // борозды/щель тёмные, очертания чёткие
    const s = (0.74 + Math.random() * 0.26) * fs, w = Math.random();
    if (w < 0.05 && fold > 0.65) { colors[i*3]=s*1.25; colors[i*3+1]=s*1.12; colors[i*3+2]=s*1.0; }   // искры на гребнях
    else { colors[i*3]=s*0.48; colors[i*3+1]=s*0.79; colors[i*3+2]=s*1.14; }                          // голубой/циан (фото 2)
    sizes[i] = 0.017 + Math.random() * 0.015;  // зерно В 2 РАЗА МЕЛЬЧЕ → чёткая форма, частицы не торчат
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
        p += fl * 0.006;                         // МИНИМАЛЬНОЕ течение — частицы НЕ выходят за форму мозга,
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
    brainPos = sampleModel(brain, PCOUNT, 0.9);   // МОЗГ — только ПОВЕРХНОСТЬ (оболочка по форме, без заливки).
    // УСИЛИВАЕМ РЕЛЬЕФ: гребни извилин выдвигаем наружу по нормали, борозды/стенки утапливаем внутрь →
    // бугристый силуэт, форма мозга читается с ЛЮБОГО угла (а не только спереди).
    { const nr = brainPos.__nrm;
      for (let i = 0; i < PCOUNT; i++) {
        const px = brainPos[i*3], py = brainPos[i*3+1], pz = brainPos[i*3+2];
        const pl = Math.hypot(px, py, pz) || 1;
        const nDotR = (nr[i*3]*px + nr[i*3+1]*py + nr[i*3+2]*pz) / pl;
        const disp = Math.min(0, (nDotR - 0.5) * 0.14);   // ТОЛЬКО ВНУТРЬ: борозды углубляем, гребни НЕ торчат наружу
        brainPos[i*3] += nr[i*3]*disp; brainPos[i*3+1] += nr[i*3+1]*disp; brainPos[i*3+2] += nr[i*3+2]*disp;
      }
      // мозг чуть МЕНЬШЕ (на 2%), строго вокруг центра — не сдвигая вверх/вниз
      for (let i = 0; i < PCOUNT * 3; i++) brainPos[i] *= 0.98;
    }
    normalize(duck, 2.6);
    duck.traverse((c) => { if (c.material) {
      c.material = c.material.clone(); c.material.transparent = true; c.material.envMapIntensity = 2.2;
      if (c.material.emissive) { c.material.emissive.setHex(0x1a1420); c.material.emissiveIntensity = 0.35; }
      // СБОРКА СНИЗУ ВВЕРХ: показываем только точки НИЖЕ мирового порога uDuckReveal (порог растёт от лап к голове)
      c.material.onBeforeCompile = (sh) => {
        sh.uniforms.uDuckReveal = uDuckReveal;
        sh.vertexShader = 'varying float vWY;\n' + sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\n  vWY = (modelMatrix * vec4(transformed, 1.0)).y;');
        sh.fragmentShader = 'uniform float uDuckReveal; varying float vWY;\n' + sh.fragmentShader.replace('void main() {', 'void main() {\n  if (vWY > uDuckReveal) discard;');
      };
    } });
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

// GLB-дротик (бренд) — грузим отдельно, НЕ блокируя интро. Сжат Draco+WebP (~0.45 МБ).
// Пока не загрузился — станция использует запасной процедурный дротик.
load('models/dart.glb')
  .then((s) => { darts.setDartModel(s); })
  .catch((e) => console.warn('Дротик GLB не загрузился, останется процедурный:', e));
// (шар-8 теперь рисуется процедурно в billiard.js — GLB больше не грузим)

// ============================================================
// Вход-занавес: кубики → утка выходит справа → поворот клювом → текст
// ============================================================
function startIntro() {
  // быстрый путь (?fast)
  if (_qp.has('fast')) {
    formProgress = 1; introDuckReveal = 1; introPlaying = false; uDuckReveal.value = 999; heroReveal = 1;
    if (duckMesh) { duckMesh.visible = true; duckMesh.rotation.y = DUCK_FACE; duckMesh.position.set(0, 0, 0); duckMesh.scale.set(1, 1, 1); }
    document.body.classList.add('hero-in'); introDone = true; return;
  }
  // СЦЕНАРИЙ: только фон → кубики падают СВЕРХУ ДО НИЗА, по пути растворяются → когда упали и стали
  // частицами, частицы собираются в утку СНИЗУ ВВЕРХ → цветные очертания проявляются снизу вверх.
  // Текст (заголовок/кнопки) скрыт в начале, проявляется ПЛАВНО только когда кубики уже стали частицами.
  formProgress = 0; introDuckReveal = 0; introPlaying = true; heroReveal = 0; uDuckReveal.value = -999;
  const tl = gsap.timeline();
  dice.forEach((d, i) => {
    d.position.set(i === 0 ? -0.8 : 0.75, 6, 0.4);
    d.rotation.set(Math.random()*3, Math.random()*3, Math.random()*3);
    d.visible = true; diceShadows[i].visible = true;
    (Array.isArray(d.material) ? d.material : [d.material]).forEach((m) => { m.transparent = true; m.opacity = 1; });
  });
  sound.playDiceRoll();
  // КУБИКИ падают до самого низа (к лапкам утки), отскок, и РАСТВОРЯЮТСЯ по пути
  dice.forEach((d, i) => {
    const t0 = 0.05 + i * 0.1;
    tl.to(d.position, { keyframes: [
      { y: -0.9, duration: 0.7, ease: 'power2.in' }, { y: -0.4, duration: 0.24, ease: 'power2.out' }, { y: -1.0, duration: 0.34, ease: 'power2.in' },
    ] }, t0);
    tl.to(d.rotation, { x: `+=${4 + Math.random()*2}`, z: `+=${3 + Math.random()*2}`, duration: 1.3, ease: 'power1.out' }, t0);
    (Array.isArray(d.material) ? d.material : [d.material]).forEach((m) => tl.to(m, { opacity: 0, duration: 0.55, ease: 'power1.in' }, 0.9 + i * 0.1));
  });
  tl.add(() => { sound.playThump?.(); }, 0.75);
  tl.add(() => dice.forEach((d, i) => { d.visible = false; diceShadows[i].visible = false; }), 1.6);   // кубиков больше нет
  // ТОЛЬКО ТЕПЕРЬ (кубики стали частицами) — частицы собираются в утку СНИЗУ ВВЕРХ
  tl.add(() => sound.playFormation?.(), 1.7);
  tl.to({ v: 0 }, { v: 1, duration: 1.4, ease: 'power2.out', onUpdate: function () { formProgress = this.targets()[0].v; } }, 1.7);
  // текст/кнопки — проявляются ПЛАВНО (1с) ровно когда частицы начали собираться
  tl.add(() => document.body.classList.add('hero-in'), 1.7);
  tl.to({ v: 0 }, { v: 1, duration: 1.0, ease: 'power1.inOut', onUpdate: function () { heroReveal = this.targets()[0].v; } }, 1.7);
  // ЦВЕТНЫЕ ОЧЕРТАНИЯ утки проявляются СНИЗУ ВВЕРХ (Y-обрезка по uDuckReveal) — после сборки частиц
  tl.add(() => { if (duckMesh) { duckMesh.visible = true; duckMesh.rotation.y = DUCK_FACE; duckMesh.position.set(0, 0, 0); duckMesh.scale.set(1, 1, 1); } }, 2.9);
  tl.to({ v: 0 }, { v: 1, duration: 1.0, ease: 'power1.inOut', onUpdate: function () { introDuckReveal = this.targets()[0].v; } }, 2.9);
  tl.add(() => { introDone = true; introPlaying = false; formProgress = 1; introDuckReveal = 1; uDuckReveal.value = 999; heroReveal = 1; }, 4.0);
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
addEventListener('touchend', () => { pointerActive = false; _pHas = false; brainGrab = false; });
addEventListener('touchcancel', () => { pointerActive = false; _pHas = false; brainGrab = false; });

function hitSubject(x, y, r = 0.32) {
  pointer.x = (x / innerWidth) * 2 - 1; pointer.y = -(y / innerHeight) * 2 + 1;
  const c = subject.getWorldPosition(new THREE.Vector3()).project(camera);
  const dx = pointer.x - c.x, dy = pointer.y - c.y;
  return Math.sqrt(dx * dx + dy * dy) < r;
}
addEventListener('click', (e) => {
  if (!introDone || brainOpen || looping) return;
  if (document.body.classList.contains('signup-open') || document.body.classList.contains('coupon-open')) return;   // клики внутри модалок не трогают сцену
  if (e.target.closest && e.target.closest('a, button, .btn')) return;   // клик по кнопке/ссылке — НЕ трогаем 3D (утка не дёргается, кнопка срабатывает)
  if (_dragged) return;   // это был СКРОЛЛ/драг, а не тап → НЕ открываем мозг/не крякаем (иначе скролл «не работал»)
  if (tp < 0.2 && duckMesh && duckMesh.visible && hitSubject(e.clientX, e.clientY)) { sound.playQuack(); duckMesh.userData.poke = 0.3; }   // тап по утке — кряк
  else if (tp > 0.7 && pk < 0.05 && hitSubject(e.clientX, e.clientY, 0.55)) openBrain();   // мозг крупный — больше зона (не в Покере)
  else if (dk > 0.4 && bk < 0.15) {
    // ДАРТС: тап по мишени → бросок дротика в эту точку (только пока не ушли в Бильярд)
    pointer.x = (e.clientX / innerWidth) * 2 - 1; pointer.y = -(e.clientY / innerHeight) * 2 + 1;
    raycaster.setFromCamera(pointer, camera);
    darts.tap(raycaster, camera);
  }
  else if (fk > 0.2) {
    // FAQ: тап по фишке-вопросу → она крутится, выезжает в центр, показываем ответ.
    // Золотая фишка «ЗАПИСАТЬСЯ» → переход в ТГ-бота. Тап мимо фишек → закрыть ответ.
    pointer.x = (e.clientX / innerWidth) * 2 - 1; pointer.y = -(e.clientY / innerHeight) * 2 + 1;
    updateFaqTableCam(); raycaster.setFromCamera(pointer, faqTableCam);   // фишки рисуются камерой стола
    const idx = faq.raycast(raycaster);
    if (idx != null) onFaqPick(idx);
    else closeFaqAnswer();
  }
  else if (ak > 0.25 && fk < 0.1) {
    // БАР: тап по бокалу → мини-игра «глоток»
    pointer.x = (e.clientX / innerWidth) * 2 - 1; pointer.y = -(e.clientY / innerHeight) * 2 + 1;
    raycaster.setFromCamera(pointer, camera);
    if (bar.tapGlass(raycaster, camera)) document.body.classList.add('bar-tasted');   // подсказка гаснет после первого глотка
  }
  else if (pk > 0.12 && ak < 0.05) {
    // ПОКЕР: клик по карте — поднять к зрителю и перевернуть; повторный клик — вернуть на стол
    pointer.x = (e.clientX / innerWidth) * 2 - 1; pointer.y = -(e.clientY / innerHeight) * 2 + 1;
    raycaster.setFromCamera(pointer, camera);
    const card = poker.raycast(raycaster);
    if (card) { const lifted = poker.toggleLift(card); lifted ? sound.playCardSlide() : sound.playCardPlace(); }
  }
});
// ДАРТС: на ПК прицел следует за курсором (наведение без броска)
addEventListener('mousemove', (e) => {
  if (dk < 0.5 || isMobile || bk > 0.15) return;
  pointer.x = (e.clientX / innerWidth) * 2 - 1; pointer.y = -(e.clientY / innerHeight) * 2 + 1;
  raycaster.setFromCamera(pointer, camera); darts.aim(raycaster);
});

// ============================================================
// БИЛЬЯРД: закрутка шара-8 касанием/мышью. Свайп по шару → вращение в сторону пальца,
// потом плавно замедляется до лёгкого авто-вращения. Скролл не блокируем (как у мозга).
// ============================================================
function raycastBilliard(x, y) {
  pointer.x = (x / innerWidth) * 2 - 1; pointer.y = -(y / innerHeight) * 2 + 1;
  raycaster.setFromCamera(pointer, camera); return billiard.hit(raycaster);
}
function billiardStart(x, y) {
  if (bk < 0.35 || ak > 0.2 || brainOpen || document.body.classList.contains('signup-open') || document.body.classList.contains('coupon-open')) return;
  if (!raycastBilliard(x, y)) return;
  billiardGrab = true; _bLastX = x; _bLastY = y;
  if (billiard.hooks.onCue) billiard.hooks.onCue();   // щелчок кия по шару
}
function billiardMove(x, y) {
  if (!billiardGrab) return;
  billiard.addSpin(x - _bLastX, y - _bLastY, innerWidth); _bLastX = x; _bLastY = y;
}
function billiardEnd() { billiardGrab = false; }
addEventListener('touchstart', (e) => { if (e.touches[0]) billiardStart(e.touches[0].clientX, e.touches[0].clientY); }, { passive: true });
addEventListener('touchmove', (e) => { if (e.touches[0]) billiardMove(e.touches[0].clientX, e.touches[0].clientY); }, { passive: true });
addEventListener('touchend', billiardEnd); addEventListener('touchcancel', billiardEnd);
addEventListener('mousedown', (e) => billiardStart(e.clientX, e.clientY));
addEventListener('mousemove', (e) => billiardMove(e.clientX, e.clientY));
addEventListener('mouseup', billiardEnd);
window.__billiardSpin = (dx, dy) => billiard.addSpin(dx || 80, dy || 0, innerWidth);   // для проверки в браузере

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
  document.body.classList.add('tunnel-exit');         // текст ТУННЕЛЯ улетает вдаль (CSS ~3с)
  document.body.classList.add('exit-textwait');       // текст 2 страницы держим скрытым ТОЛЬКО до начала сборки мозга
  clearTimeout(_textWaitTimer);
  _textWaitTimer = setTimeout(() => document.body.classList.remove('exit-textwait'), 700);   // → текст 2 стр. появляется ВО ВРЕМЯ сборки мозга
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
  // класс tunnel-exit держим ПОКА текст улетает вдаль (≈3.2с) — НЕ снимаем при закрытии туннеля (2с),
  // иначе текст обрывается. Текст 2 страницы появится ТОЛЬКО после снятия класса (когда туннель закрылся).
  clearTimeout(_exitTimer); _exitTimer = setTimeout(() => document.body.classList.remove('tunnel-exit'), 2200);
}
let _exitTimer = 0, _textWaitTimer = 0;
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
let _lastStIdx = 0;   // индекс станции для звука перехода
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
// СОСТОЯНИЕ ПЕТЛИ (объявлено рано — animate()/updateLoop читают его уже в первом кадре)
let looping = 0;             // 0 | +1 (FAQ→Холл) | -1 (Холл→FAQ)
let loopT = 0, loopSwapped = false, loopClub = 0;   // loopClub — проявление клуба при отъезде к Холлу
let loopFaqRev = -1;        // -1 = вне петли (брать fk); ≥0 = ручная видимость фишек-оверлея во время петли
let loopDragging = false, loopSnap = -1, loopHeroness = 0;   // палец ведёт прогресс; снап при отпускании
const LOOP_DUR = 1.7;
const loopFadeEl = document.getElementById('loop-fade');
// Станции (доли scrollProgress): 0 — Холл/утка, мозг, Покер, Дартс.
const STATIONS = [0, HOLL_END, POKER_END, DARTS_END, BILLIARD_END, BAR_END, 1.0];
let settledStation = 0;
window.__setStation = (i) => { settledStation = i; };   // для headless-теста скролла
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
  if (window.__teleport || brainOpen || looping || document.body.classList.contains('signup-open') || document.body.classList.contains('coupon-open') || !introDone) return;
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
let navFrom = 0, gestureActive = false, gTouchX = 0, gTouchY = 0, gHorizontal = false, _dragged = false;
addEventListener('touchstart', (e) => {
  if (document.body.classList.contains('signup-open') || document.body.classList.contains('coupon-open') || brainOpen) return;
  const t = e.touches[0]; if (!t) return;
  // КАСАНИЕ ПО МОЗГУ → ЗАЩЁЛКА анимации на весь жест (любой свайп/сторона). Скролл НЕ блокируем.
  if (tp > 0.4 && pk < 0.55 && hitSubject(t.clientX, t.clientY, 0.7)) { brainGrab = true; updatePointer(t.clientX, t.clientY); }
  gTouchX = t.clientX; gTouchY = t.clientY; gLastY = t.clientY; gHorizontal = false; _dragged = false;
  navFrom = settledStation; gestureActive = true;
}, { passive: true });
let gLastY = 0;
addEventListener('touchmove', (e) => {
  if (!gestureActive) return;
  const t = e.touches[0]; if (!t) return;
  const moveDelta = gLastY - t.clientY;   // >0 палец движется ВВЕРХ (контент листается вниз)
  gLastY = t.clientY;
  const dx = Math.abs(t.clientX - gTouchX), dy = Math.abs(t.clientY - gTouchY);
  if (!gHorizontal && dx > dy && dx > 14) gHorizontal = true;   // горизонтальный жест — не наша история
  if (dx > 8 || dy > 8) _dragged = true;                        // палец двигался (скролл/драг) → это НЕ клик
  if (gHorizontal) return;
  // ПЕТЛЯ ВЕДЁТСЯ ПАЛЬЦЕМ В РЕАЛЬНОМ ВРЕМЕНИ (как все переходы): у низа FAQ тянем вверх → вперёд;
  // у верха Холла тянем вниз → назад. Прогресс идёт одновременно с пальцем.
  if (!looping) {
    if (moveDelta > 0 && scrollProgress > 0.985 && fk > 0.85) beginLoop(1);
    else if (moveDelta < 0 && scrollProgress < 0.015 && tp < 0.05) beginLoop(-1);
  }
  if (looping && loopDragging) driveLoop((looping > 0 ? moveDelta : -moveDelta) / (innerHeight * 0.72));
}, { passive: true });
addEventListener('touchend', () => {
  if (!gestureActive) return; gestureActive = false;
  if (looping) { releaseLoop(); return; }   // петля: авто-докрутка к 0/1
  if (gHorizontal) return;
  settleFrom(navFrom);
}, { passive: true });
// --- жест: колесо/трекпад (нет «отпускания» — ловим затихание) ---
let wheelActive = false, wheelTimer = 0;
addEventListener('wheel', () => {
  if (document.body.classList.contains('signup-open') || document.body.classList.contains('coupon-open') || brainOpen) return;
  if (!wheelActive) { wheelActive = true; navFrom = settledStation; }
  clearTimeout(wheelTimer);
  wheelTimer = setTimeout(() => { wheelActive = false; settleFrom(navFrom); }, 90);
}, { passive: true });
// клавиатура: стрелки/пробел = соседняя станция (для десктопа)
addEventListener('keydown', (e) => {
  if (document.body.classList.contains('signup-open') || document.body.classList.contains('coupon-open') || brainOpen) return;
  if (['ArrowDown', 'PageDown', ' ', 'Spacebar'].includes(e.key)) { e.preventDefault(); if (settledStation >= STATIONS.length - 1 && fk > 0.6) { beginLoop(1); loopDragging = false; loopSnap = 1; } else goToStation(settledStation + 1); }
  else if (['ArrowUp', 'PageUp'].includes(e.key)) { e.preventDefault(); if (settledStation <= 0 && tp < 0.05) { beginLoop(-1); loopDragging = false; loopSnap = 1; } else goToStation(settledStation - 1); }
  else if (e.key === 'Home') { e.preventDefault(); goToStation(0); }
  else if (e.key === 'End') { e.preventDefault(); goToStation(STATIONS.length - 1); }
});

const heroTop = document.querySelector('.hero-top');
const heroBottom = document.querySelector('.hero-bottom');
const heroEls = [heroTop, heroBottom];
const scrollHint = document.querySelector('.scroll-hint');
const pokerTop = document.querySelector('.poker-top');
const pokerBottom = document.querySelector('.poker-bottom');
const dartsTop = document.querySelector('.darts-top');
const dartsBottom = document.querySelector('.darts-bottom');
const billiardTop = document.querySelector('.billiard-top');
const billiardBottom = document.querySelector('.billiard-bottom');
const barTop = document.querySelector('.bar-top');
const faqTop = document.querySelector('.faq-top');
// Всплывающие очки за один бросок: «+60 / ТРИПЛ 20», гаснет через ~1.4с
const dartsScoreEl = document.getElementById('darts-score');
let _dsHideT = 0;
function showDartScore(pts, label) {
  if (!dartsScoreEl) return;
  dartsScoreEl.querySelector('.ds-pts').textContent = pts > 0 ? '+' + pts : '—';
  dartsScoreEl.querySelector('.ds-zone').textContent = label;
  dartsScoreEl.classList.remove('flash'); void dartsScoreEl.offsetWidth; dartsScoreEl.classList.add('flash');
  dartsScoreEl.style.opacity = '1';
  _dsHideT = performance.now() + 1400;
}
// ===== Неоновое табло Дартса: очки серии · дротики · личный рекорд (localStorage) =====
const DARTS_BEST_KEY = 'ducks_darts_best';
let dartsBest = 0;
try { dartsBest = parseInt(localStorage.getItem(DARTS_BEST_KEY) || '0', 10) || 0; } catch (e) {}
const dhScoreEl = document.getElementById('dh-score');
const dhBestEl = document.getElementById('dh-best');
const dhPipsEl = document.getElementById('dh-pips');
const dartsWinEl = document.getElementById('darts-win');
const dwScoreEl = document.getElementById('dw-score');
let _winHideT = 0;
function _bump(el) { if (!el) return; el.classList.remove('bump'); void el.offsetWidth; el.classList.add('bump'); }
function renderDartsPips(left) {
  if (!dhPipsEl) return;
  dhPipsEl.querySelectorAll('i').forEach((p, i) => { p.classList.toggle('live', i < left); p.classList.toggle('used', i >= left); });
}
function updateDartsHud() {
  if (dhScoreEl) dhScoreEl.textContent = String(darts.seriesTotal);
  if (dhBestEl) dhBestEl.textContent = String(dartsBest);
  renderDartsPips(darts.dartsLeft);
}
function playDartsWin(score) {
  if (!dartsWinEl) return;
  if (dwScoreEl) dwScoreEl.textContent = String(score);
  dartsWinEl.classList.remove('show'); void dartsWinEl.offsetWidth; dartsWinEl.classList.add('show');
  sound.playSuccess?.();
  clearTimeout(_winHideT); _winHideT = setTimeout(() => dartsWinEl.classList.remove('show'), 2900);
}
// порог скидочного купона: набрал столько очков за серию → анкета купона (клиент: 150, позже можно 180)
const COUPON_GOAL = 150;
let couponShown = false;
// результат броска: всплывающие очки + табло + личный рекорд серии + (150+) купон-анкета
function dartResult(pts, label) {
  showDartScore(pts, label);
  updateDartsHud();
  _bump(dhScoreEl);
  const newBest = darts.dartsLeft === 0 && darts.seriesTotal > dartsBest;   // серия завершена и побит рекорд
  if (newBest) {
    dartsBest = darts.seriesTotal;
    try { localStorage.setItem(DARTS_BEST_KEY, String(dartsBest)); } catch (e) {}
    if (dhBestEl) { dhBestEl.textContent = String(dartsBest); _bump(dhBestEl); }
  }
  // КУПОН: набрал 150+ за серию → плавно открывается анкета купона (один раз за сессию).
  // Имеет приоритет над полноэкранным окном рекорда (чтобы не было двух оверлеев разом).
  if (darts.seriesTotal >= COUPON_GOAL && !couponShown) {
    couponShown = true;
    window.__openCoupon?.(darts.seriesTotal);
  } else if (newBest) {
    playDartsWin(darts.seriesTotal);
  }
}
window.__dartsWin = () => playDartsWin(darts.seriesTotal || 123);   // для проверки анимации в браузере
updateDartsHud();   // стартовое состояние табло (0 · 3 дротика · рекорд)
function updateUIByScroll() {
  // ХОЛЛ занимает первый сегмент скролла; дальше — Покер, затем Дартс
  tp = THREE.MathUtils.clamp(scrollProgress / HOLL_END, 0, 1);
  pk = THREE.MathUtils.clamp((scrollProgress - HOLL_END) / (POKER_END - HOLL_END), 0, 1);
  dk = THREE.MathUtils.clamp((scrollProgress - POKER_END) / (DARTS_END - POKER_END), 0, 1);
  bk = THREE.MathUtils.clamp((scrollProgress - DARTS_END) / (BILLIARD_END - DARTS_END), 0, 1);
  ak = THREE.MathUtils.clamp((scrollProgress - BILLIARD_END) / (BAR_END - BILLIARD_END), 0, 1);
  fk = THREE.MathUtils.clamp((scrollProgress - BAR_END) / (1 - BAR_END), 0, 1);
  document.body.classList.toggle('poker-in', pk > 0.12 && dk < 0.1);
  document.body.classList.toggle('darts-in', dk > 0.12 && bk < 0.1);
  document.body.classList.toggle('darts-hud-on', dk > 0.35 && bk < 0.2);   // неоновое табло — только на Дартсе
  document.body.classList.toggle('billiard-in', bk > 0.12 && ak < 0.1);
  document.body.classList.toggle('bar-in', ak > 0.12 && fk < 0.1);
  document.body.classList.toggle('faq-in', fk > 0.12);
  // Hero-текст НЕ уезжает вверх: он РАСТВОРЯЕТСЯ НА МЕСТЕ и НАЛЕТАЕТ на зрителя
  // (увеличивается + размывается + гаснет) — как будто камера входит внутрь утки
  const hf = THREE.MathUtils.clamp(tp / 0.16, 0, 1);
  const e = hf * hf * (3 - 2 * hf);                 // плавная кривая
  heroEls.forEach((el) => { if (el) {
    el.style.opacity = String((1 - e) * heroReveal);   // heroReveal=0 в начале → текст СКРЫТ, пока интро не проявит его
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
  // Покер-текст «прилетает из точки» во второй половине перехода (после туннеля частиц).
  // При уходе в Дартс (dk↑) — гаснет, чтобы не висеть поверх мишени.
  const pe = THREE.MathUtils.clamp((pk - 0.55) / 0.4, 0, 1);
  const pez = pe * pe * (3 - 2 * pe) * (1 - THREE.MathUtils.smoothstep(dk, 0.02, 0.22));
  [pokerTop, pokerBottom].forEach((el) => { if (!el) return;
    el.style.opacity = String(pez);
    el.style.transform = `translateX(-50%) scale(${0.7 + 0.3 * pez})`;
    el.style.filter = `blur(${(1 - pez) * 7}px)`;
    el.style.pointerEvents = pez > 0.7 ? 'auto' : 'none';   // кнопка кликабельна ТОЛЬКО когда Покер проявлен
  });
  // Дартс-текст «прилетает из точки» во второй половине перехода Покер→Дартс; гаснет при уходе в Бильярд
  const de = THREE.MathUtils.clamp((dk - 0.45) / 0.4, 0, 1);
  const dez = de * de * (3 - 2 * de) * (1 - THREE.MathUtils.smoothstep(bk, 0.02, 0.22));
  [dartsTop, dartsBottom].forEach((el) => { if (!el) return;
    el.style.opacity = String(dez);
    el.style.transform = `translateX(-50%) scale(${0.7 + 0.3 * dez})`;
    el.style.filter = `blur(${(1 - dez) * 7}px)`;
    el.style.pointerEvents = 'none';
  });
  // БИЛЬЯРД: элементы ПРИЛЕТАЮТ по скроллу — заголовок сверху, карточки с боков (слева/справа)
  const be = THREE.MathUtils.clamp((bk - 0.4) / 0.45, 0, 1);
  const bez = be * be * (3 - 2 * be) * (1 - THREE.MathUtils.smoothstep(ak, 0.02, 0.32));   // гаснет при уходе в Бар
  if (billiardTop) {
    billiardTop.style.opacity = String(bez);
    billiardTop.style.transform = `translateX(-50%) translateY(${(bez - 1) * 70}px) scale(${0.9 + 0.1 * bez})`;
    billiardTop.style.filter = `blur(${(1 - bez) * 6}px)`;
    billiardTop.style.pointerEvents = 'none';
  }
  document.body.style.setProperty('--bv', bez.toFixed(3));               // прозрачность карточек
  document.body.style.setProperty('--bvs', (0.9 + 0.1 * bez).toFixed(3));
  document.body.style.setProperty('--bx', (1 - bez).toFixed(3));         // боковой вылет: 1=за экраном, 0=на месте
  // БАР: заголовок «БАР» прилетает сверху, 3 карточки — с боков (как Бильярд). Порядок: БАР → подзаголовок → бокал → карточки.
  // Гаснет при уходе в FAQ (fk↑), чтобы не висеть поверх стола с фишками.
  const ae = THREE.MathUtils.clamp((ak - 0.35) / 0.45, 0, 1);
  const aez = ae * ae * (3 - 2 * ae) * (1 - THREE.MathUtils.smoothstep(fk, 0.02, 0.3));
  if (barTop) {
    barTop.style.opacity = String(aez);
    barTop.style.transform = `translateX(-50%) translateY(${(aez - 1) * 70}px) scale(${0.9 + 0.1 * aez})`;
    barTop.style.filter = `blur(${(1 - aez) * 6}px)`;
    barTop.style.pointerEvents = 'none';
  }
  document.body.style.setProperty('--av2', aez.toFixed(3));              // прозрачность карточек бара
  document.body.style.setProperty('--av2s', (0.9 + 0.1 * aez).toFixed(3));
  document.body.style.setProperty('--ax2', (1 - aez).toFixed(3));        // боковой вылет карточек бара
  // FAQ: заголовок «СПРОСИ У СВОИХ» прилетает сверху, подсказка снизу. CTA-фишка — в 3D.
  const fe = THREE.MathUtils.clamp((fk - 0.3) / 0.45, 0, 1);
  const fez = fe * fe * (3 - 2 * fe);
  if (faqTop) {
    faqTop.style.opacity = String(fez);
    faqTop.style.transform = `translateX(-50%) translateY(${(fez - 1) * 70}px) scale(${0.9 + 0.1 * fez})`;
    faqTop.style.filter = `blur(${(1 - fez) * 6}px)`;
    faqTop.style.pointerEvents = 'none';
  }
  document.body.style.setProperty('--fv', fez.toFixed(3));               // прозрачность подсказки/CTA FAQ
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
  updateLoop(dt);   // бесконечная петля (свап координат в темноте) — до обновления станций/камеры
  env.update(t, camera, tp, dt);
  // Покер виден на своём сегменте; при уходе в Дартс — плавно убирается (не маячит за мишенью)
  poker.setReveal(pk * (1 - THREE.MathUtils.smoothstep(dk, 0.02, 0.3)));
  poker.update(t, dt, camera);
  darts.setReveal(dk * (1 - THREE.MathUtils.smoothstep(bk, 0.02, 0.3)));   // Дартс гаснет при уходе в Бильярд
  darts.update(t, dt, camera);
  billiard.setReveal(bk * (1 - THREE.MathUtils.smoothstep(ak, 0.02, 0.4)));   // Бильярд гаснет при уходе в Бар
  billiard.update(t, dt);
  // космо-фон проявляется на переходе 4→5; на переходе 5→6 РАСТВОРЯЕТСЯ (стойка проступает из темноты)
  space.setReveal(THREE.MathUtils.smoothstep(bk, 0.04, 0.6) * (1 - THREE.MathUtils.smoothstep(ak, 0.08, 0.6)));
  space.update(t, dt);
  // БАР: стойка проявляется из темноты, мини-игра «глоток». tipsy связан с Дартсом (easter egg).
  // Гаснет при уходе в FAQ (fk↑) — стол с фишками занимает кадр.
  bar.setReveal(ak * (1 - THREE.MathUtils.smoothstep(fk, 0.04, 0.45)));
  bar.update(t, dt, camera);
  darts.tipsy = bar.tipsy;
  // FAQ: стол с фишками-вопросами. Во время ПЕТЛИ держим фишки оверлеем (loopFaqRev), иначе по fk.
  faq.setReveal(loopFaqRev >= 0 ? loopFaqRev : fk);
  // фишки видны/наводятся с ОТДЕЛЬНОЙ камеры стола (вид сверху), когда активен FAQ-режим
  if (faqBg > 0.02) { updateFaqTableCam(); faq.update(t, dt, faqTableCam); } else faq.update(t, dt, camera);
  if (_dsHideT && performance.now() > _dsHideT) { dartsScoreEl.style.opacity = '0'; _dsHideT = 0; }
  updateDiceShadows();

  // ЗВУКОВЫЕ СЛОИ — ПО СТАНЦИЯМ (каждая тема своя атмосфера; не тянем шум частиц на все страницы)
  if (audioStarted && frame % 12 === 0) {
    const sm = THREE.MathUtils.smoothstep;
    const zHall = 1 - sm(pk, 0.0, 0.25);                                   // Холл (утка→мозг→туннель)
    const zPoker = sm(pk, 0.15, 0.5) * (1 - sm(dk, 0.15, 0.5));            // Покер
    const zDarts = sm(dk, 0.15, 0.5) * (1 - sm(bk, 0.15, 0.5));            // Дартс
    const zBilliard = sm(bk, 0.15, 0.5) * (1 - sm(ak, 0.15, 0.5));         // Бильярд (космос)
    const zBar = sm(ak, 0.15, 0.5) * (1 - sm(fk, 0.1, 0.5));               // Бар (гаснет к FAQ)
    const zFaq = sm(fk, 0.15, 0.5);                                        // FAQ (стол с фишками)
    // ФОНОВАЯ МУЗЫКА ПО СТРАНИЦАМ (кроссфейд один в другой):
    //  Холл(1) и Мозг(2) — оригинальный магический ПЭД (+частицы на 2);
    //  Покер(3) — КЛАССИКА (струнно-фортепианный бэд);
    //  Дартс(4) — снова ПЭД (как 1 стр);
    //  Бильярд(5) — КОСМОС (дрон + мерцание);
    //  Бар(6) — тёплый ЛАУНЖ + гомон зала; FAQ(7) — лаунж тихо.
    // воздух (metel): Hero + чуть на Дартсе/FAQ
    sound.setLayer('metel', Math.max(zHall * THREE.MathUtils.clamp(1 - tp * 2, 0, 1), zDarts * 0.45, zFaq * 0.25));
    // шелест ЧАСТИЦ — ТОЛЬКО в Холле (распад утки→мозг) и в туннеле; в Покере/Баре/FAQ его НЕТ
    const rustleBurst = THREE.MathUtils.clamp(1 - Math.abs(tp - 0.5) * 3, 0, 1);
    const rustleBrain = THREE.MathUtils.clamp((tp - 0.6) / 0.25, 0, 1) * 0.5;
    sound.setLayer('rustle', zHall * Math.max(rustleBurst, rustleBrain));
    sound.setLayer('hum', Math.max(brainOpen ? 1 : zHall * THREE.MathUtils.clamp((tp - 0.6) / 0.4, 0, 1), zBilliard * 0.4));
    sound.setLayer('classical', zPoker);                                   // классика на Покере
    sound.setLayer('space', 0);                                            // БЕЗ шумового «радио» в космосе
    sound.setLayer('cosmic', zBilliard * 0.7);                             // мягкий космо-пэд (бед под флейту)
    sound.setLayer('bar', zBar * 0.6);                                     // тихий гомон зала (бед под фортепиано)
    sound.setLayer('lounge', Math.max(zBar * 0.45, zFaq * 0.4));           // тёплый бед, тихо
    // ЖИВЫЕ МЕЛОДИИ: космическая флейта на Бильярде, фортепиано в Баре
    sound.setMusicZones?.(zBilliard, zBar);
    // ОСНОВНОЙ пэд держим на Холле/Мозге/Дартсе; уводим там, где играет своя музыка
    sound.setPadDuck?.(THREE.MathUtils.clamp(1 - 0.85 * zPoker - 0.92 * zBilliard - 0.9 * zBar - 0.55 * zFaq, 0, 1));
  }
  // КИНЕМАТОГРАФИЧЕСКИЙ звук СМЕНЫ станции (приближение/отдаление + акцент под тему)
  if (audioStarted) {
    const stIdx = Math.round(THREE.MathUtils.clamp(scrollProgress, 0, 1) * (STATIONS.length - 1));
    if (stIdx !== _lastStIdx) { sound.playStationCue?.(stIdx, stIdx > _lastStIdx); _lastStIdx = stIdx; }
    // звон стекла — ТОЛЬКО при клике по бокалу (амбиентный звон убран: раздражал)
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
    let camEase = window.__teleport ? 1 : THREE.MathUtils.lerp(THREE.MathUtils.lerp(0.05, 1, snap), 0.18, tb);
    // БАР↔БИЛЬЯРД: камера должна ТОЧНО следовать траектории (без лага) → переход обратимый,
    // назад идёт ровно «задним ходом» по той же дуге (а не срезает угол из-за инерции сглаживания).
    camEase = Math.max(camEase, THREE.MathUtils.smoothstep(ak, 0.0, 0.35) * 0.5, THREE.MathUtils.smoothstep(fk, 0.0, 0.35) * 0.5);
    // ПОКЕР: всё ОДНОВРЕМЕННО и плавно — пока летим сквозь туннель, камера плавно
    // доворачивается к столу, а стол приближается издалека (поворот незаметен за приближением).
    const pkc = easeIO(THREE.MathUtils.clamp(pk / 0.5, 0, 1));   // камера доворачивается чуть раньше — карты формируются перед зрителем
    const tCamX = THREE.MathUtils.lerp(sCamX + (0 - sCamX) * tb, POKER_CAM.x, pkc);
    const tCamY = THREE.MathUtils.lerp(sCamY + (0 - sCamY) * tb, POKER_CAM.y, pkc);
    const tCamZ = THREE.MathUtils.lerp(sCamZ + (6 - sCamZ) * tb, POKER_CAM.z, pkc);
    // ДАРТС: от позы Покера камера «наезжает вперёд» сквозь темноту к мишени в глубине
    const dkc = easeIO(THREE.MathUtils.clamp(dk / 0.6, 0, 1));
    const fCamX = THREE.MathUtils.lerp(tCamX, DARTS_CAM.x, dkc);
    const fCamY = THREE.MathUtils.lerp(tCamY, DARTS_CAM.y, dkc);
    const fCamZ = THREE.MathUtils.lerp(tCamZ, DARTS_CAM.z, dkc);
    // БИЛЬЯРД: от позы Дартса камера опускается к сукну и низко проезжает к шару (с лёгким креном)
    const bkc = easeIO(THREE.MathUtils.clamp(bk / 0.6, 0, 1));
    const gCamX = THREE.MathUtils.lerp(fCamX, BILLIARD_CAM.x, bkc);
    const gCamY = THREE.MathUtils.lerp(fCamY, BILLIARD_CAM.y, bkc);
    const gCamZ = THREE.MathUtils.lerp(fCamZ, BILLIARD_CAM.z, bkc);
    // БАР: камера доворачивается из космоса к РЕАЛЬНОЙ барной стойке клуба (ракурс задан клиентом через ?tune)
    const akc = easeIO(THREE.MathUtils.clamp(ak / 0.75, 0, 1));
    const hCamX = THREE.MathUtils.lerp(gCamX, BAR_CAM.x, akc);
    const hCamY = THREE.MathUtils.lerp(gCamY, BAR_CAM.y, akc);
    const hCamZ = THREE.MathUtils.lerp(gCamZ, BAR_CAM.z, akc);
    // FAQ: камера отъезжает от стойки и доворачивается сверху-спереди к столу с фишками
    const fkc = easeIO(THREE.MathUtils.clamp(fk / 0.7, 0, 1));
    const iCamX = THREE.MathUtils.lerp(hCamX, FAQ_CAM.x, fkc);
    const iCamY = THREE.MathUtils.lerp(hCamY, FAQ_CAM.y, fkc);
    const iCamZ = THREE.MathUtils.lerp(hCamZ, FAQ_CAM.z, fkc);
    camera.position.x += (iCamX - camera.position.x) * camEase;
    camera.position.y += (iCamY - camera.position.y) * camEase;
    camera.position.z += (iCamZ - camera.position.z) * camEase;
    // EASTER EGG «перебрал»: в Баре камера слегка ПЛЫВЁТ (tipsy), не двигаясь по рельсе. Затухает с tipsy.
    const woo = bar.tipsy * THREE.MathUtils.clamp(ak, 0, 1);
    if (woo > 0.001) {
      camera.position.x += Math.sin(t * 1.3) * 0.05 * woo;
      camera.position.y += Math.sin(t * 0.9 + 1.7) * 0.035 * woo;
    }
    // КРЕН (банк) камеры на входе в Бильярд: наклоняем «верх» камеры (ДО lookAt). На других станциях roll=0.
    const roll = BILLIARD_ROLL * bkc;
    camera.up.set(Math.sin(roll), Math.cos(roll), 0);
    // точка прицела: LOOK (скролл) ↔ туннель ↔ стол (покер) ↔ мишень (дартс) ↔ шар (бильярд)
    const lookX = THREE.MathUtils.lerp(THREE.MathUtils.lerp(THREE.MathUtils.lerp(THREE.MathUtils.lerp(THREE.MathUtils.lerp(LOOK.x + (0 - LOOK.x) * tb, POKER_LOOK.x, pkc), DARTS_LOOK.x, dkc), BILLIARD_LOOK.x, bkc), BAR_LOOK.x, akc), FAQ_LOOK.x, fkc);
    const lookY = THREE.MathUtils.lerp(THREE.MathUtils.lerp(THREE.MathUtils.lerp(THREE.MathUtils.lerp(THREE.MathUtils.lerp(LOOK.y + (0 - LOOK.y) * tb, POKER_LOOK.y, pkc), DARTS_LOOK.y, dkc), BILLIARD_LOOK.y, bkc), BAR_LOOK.y, akc), FAQ_LOOK.y, fkc);
    const lookZ = THREE.MathUtils.lerp(THREE.MathUtils.lerp(THREE.MathUtils.lerp(THREE.MathUtils.lerp(THREE.MathUtils.lerp(LOOK.z + (-10 - LOOK.z) * tb, POKER_LOOK.z, pkc), DARTS_LOOK.z, dkc), BILLIARD_LOOK.z, bkc), BAR_LOOK.z, akc), FAQ_LOOK.z, fkc);
    // ПЕТЛЯ: камера НЕПРЕРЫВНО зумит между позой FAQ и позой Холла (один ракурс, без поворотов,
    // без черноты). f: 0 = поза FAQ (близко к столу), 1 = поза Холла (CAM0). Свап координат уже
    // случился в начале петли, departing-контент растворяется оверлеем → стык не виден.
    let loopLX = lookX, loopLY = lookY, loopLZ = lookZ;
    if (looping) {
      const f = easeIO(THREE.MathUtils.clamp(loopHeroness, 0, 1));   // 0 = поза FAQ, 1 = поза Холла
      camera.position.set(
        THREE.MathUtils.lerp(FAQ_CAM.x, CAM0.x, f),
        THREE.MathUtils.lerp(FAQ_CAM.y, CAM0.y, f),
        THREE.MathUtils.lerp(FAQ_CAM.z, CAM0.z, f));
      loopLX = THREE.MathUtils.lerp(FAQ_LOOK.x, LOOK.x, f);
      loopLY = THREE.MathUtils.lerp(FAQ_LOOK.y, LOOK.y, f);
      loopLZ = THREE.MathUtils.lerp(FAQ_LOOK.z, LOOK.z, f);
      camera.up.set(0, 1, 0);
    }
    camera.lookAt(loopLX, loopLY, loopLZ);
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
  // у мозга/в туннеле клуб почти гаснет; на Дартсе уходим в «пустоту» (ещё темнее), скрывая бар-геометрию
  const envBase = sceneFade + (0.08 - sceneFade) * tdark;
  // клуб гаснет на Дартсе (≈×0.25), на переходе в Бильярд исчезает ПОЛНОСТЬЮ (космос), а на БАРЕ
  // ВОЗВРАЩАЕТСЯ (реальная барная стойка клуба — фон станции Бар).
  // на БАРЕ клуб ВОЗВРАЩАЕТСЯ; на FAQ зал ВИДЕН (камера клиента), но ПРИГЛУШЁН, чтобы стол-прожектор
  // и фишки были СОЧНЫМИ (глубоко-чёрные, как на фото). В ПЕТЛЕ к стороне Холла зал → полная яркость.
  // faqBg — активность FAQ-режима (двухпроходный рендер). На FAQ зал ЯРКИЙ (проход 1 = фон зала),
  // затемнение для глубоко-чёрных фишек применяется ОТДЕЛЬНО в проходе 2 (стол).
  faqBg = looping ? (1 - THREE.MathUtils.smoothstep(loopHeroness, 0.55, 1.0)) : THREE.MathUtils.smoothstep(fk, 0.06, 0.5);
  const barBack = THREE.MathUtils.smoothstep(ak, 0.08, 0.6);
  const billiardDark = (1 - 0.75 * easeIO(THREE.MathUtils.clamp(dk / 0.5, 0, 1))) * (1 - easeIO(THREE.MathUtils.clamp(bk / 0.5, 0, 1)));
  env.fade(Math.max(envBase * billiardDark, barBack * 0.95));
  env.hideExtra(THREE.MathUtils.smoothstep(bk, 0.05, 0.7) * (1 - THREE.MathUtils.smoothstep(ak, 0.08, 0.6)));
  env.ambientMul = 1;   // по умолчанию полный (в проходе 2 для стола временно глушим)
  // hero-текст: каждый кадр держим opacity = (1-e)*heroReveal → в начале СКРЫТ (heroReveal=0), плавно
  // проявляется в интро, растворяется при скролле в утку. (без этого inline-opacity показывал текст сразу)
  if (!looping) { const he = THREE.MathUtils.clamp(tp / 0.16, 0, 1), ee = he * he * (3 - 2 * he); for (const el of heroEls) if (el) el.style.opacity = String((1 - ee) * heroReveal); }

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
      duckMesh.traverse((c) => { if (c.material) c.material.opacity = solid; });
      // СБОРКА СНИЗУ ВВЕРХ в интро: мировой порог Y растёт от лап к голове (точки выше порога скрыты)
      uDuckReveal.value = introPlaying ? (subject.position.y - 1.5 * SUBJ_SCALE + introDuckReveal * 3.0 * SUBJ_SCALE) : 999;
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
    // Касание пока палец движется (свежесть 140мс) на утке (tp<0.05) и мозге (tp>0.55 — широкий диапазон,
    // чтобы растекание НЕ пропадало, когда при скролле tp немного меняется). Скролл Lenis НЕ блокируем —
    // вертикальный жест по мозгу даёт И листание страницы, И анимацию растекания (оба одновременно).
    const pointerFresh = (performance.now() - pointerStamp) < 140;
    // АНИМАЦИЯ КАСАНИЯ ВСЕГДА: пока палец на мозге (brainGrab) — растекание ВКЛ на весь жест в ЛЮБУЮ сторону,
    // независимо от tp/pk/свежести. Плюс обычный путь (движение пальца) на утке/мозге. Скролл не блокируется.
    const touchOn = !brainOpen && tunnelBlend < 0.001 &&
      ((brainGrab && pk < 0.6) || (pointerActive && pointerFresh && (tp < 0.05 || tp > 0.5) && pk < 0.45));
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
    // ОПТИМИЗАЦИЯ (легче, без изменения картинки): когда фигура в ПОКОЕ (станция устоялась, не трогают,
    // нет морфа/туннеля/интро, свечение угасло) — позиции частиц = домашним и постоянны. НЕ пересчитываем
    // и НЕ грузим 65k точек в GPU каждый кадр. Шейдер сам «течёт» (uTime) и объект крутится (transform) —
    // визуально идентично, но CPU/шина разгружены → меньше лагов.
    const scrollStill = Math.abs(tp - _prevTpP) < 0.0004 && Math.abs(pk - _prevPkP) < 0.0004;
    _prevTpP = tp; _prevPkP = pk;
    const idle = introDone && !introPlaying && tunnelBlend < 0.001 && !brainOpen && !inTrans && !TELE
      && !pointerActive && !brainGrab && scrollStill && _glowMax < 0.012;
    let pushed = 0, moveSum = 0, moveDir = 0;
    if (!idle) {
    _glowMax = 0;
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
      // СТАРТ: формирование утки СНИЗУ ВВЕРХ — частицы с россыпи сверху собираются в утку, нижние
      // (лапки) встают первыми, затем выше (formProgress 0→1).
      if (formProgress < 0.999) {
        const hN = (ty - duckYmin) / (duckYmax - duckYmin + 1e-4);            // 0 низ (лапки) … 1 верх
        const fp = easeIO(THREE.MathUtils.clamp(formProgress * 1.7 - hN * 0.7, 0, 1));   // снизу вверх
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
        const mx = tx + (_off.x - tx) * transShape;   // БАЗОВАЯ позиция морфа (мозг→карта)
        const my = ty + (_off.y - ty) * transShape;
        const mz = tz + (_off.z - tz) * transShape;
        // ПЕРСИСТЕНТНОЕ РАСТЕКАНИЕ ВНИЗ К ПОКЕРУ: vel хранит СМЕЩЕНИЕ касания (копится от пальца, ПЛАВНО
        // затухает) → частицы РЕАЛЬНО ДВИГАЮТСЯ поверх морфа и медленно возвращаются (а не сброс каждый кадр).
        if (touchOn && transShape < 0.75) {
          const dx = mx - pointer3D.x, dy = my - pointer3D.y, dz = mz - pointer3D.z;
          const dsq = dx*dx + dy*dy + dz*dz;
          if (dsq < radius * radius) {
            const dist = Math.sqrt(dsq) + 0.001, fall = 1 - dist / radius;
            const sw = fall * fall * force * 1.0;   // вихрь + поток за пальцем (как на мозге), без дыры
            const rx = dx / dist, ry = dy / dist;
            vel[i3]   += (-ry) * sw + pointerMove.x * fall * 0.38;
            vel[i3+1] += ( rx) * sw + pointerMove.y * fall * 0.38;
            vel[i3+2] += pointerMove.z * fall * 0.38;
            if (fall > disturb[i]) disturb[i] = fall;
            pushed++; moveSum += sw;
          }
        }
        vel[i3] *= TOUCH_DAMP; vel[i3+1] *= TOUCH_DAMP; vel[i3+2] *= TOUCH_DAMP;   // затухание смещения (как в обычном касании)
        arr[i3] = mx + vel[i3]; arr[i3+1] = my + vel[i3+1]; arr[i3+2] = mz + vel[i3+2];
        disturb[i] *= 0.95;
        const gB = Math.max(0.18 * transShape, disturb[i] * 0.75);
        glow[i] += (gB - glow[i]) * 0.2;
        if (glow[i] > _glowMax) _glowMax = glow[i];
        continue;
      }
      // КАСАНИЕ как у igloo: частицы у пальца ЗАКРУЧИВАЮТСЯ вокруг него (вихрь) и ТЕКУТ ЗА движением пальца.
      // БЕЗ радиального выброса → НЕТ дыры/круга/пузыря. Светятся и ПЛАВНО, медленно возвращаются.
      if (touchOn) {
        const dx = arr[i3] - pointer3D.x, dy = arr[i3+1] - pointer3D.y, dz = arr[i3+2] - pointer3D.z;
        const dsq = dx*dx + dy*dy + dz*dz;
        if (dsq < radius * radius) {
          const dist = Math.sqrt(dsq) + 0.001, fall = 1 - dist / radius;
          const sw = fall * fall * force * 1.0;     // сила вихря (мягко, без выброса наружу)
          const rx = dx / dist, ry = dy / dist;     // радиаль в плоскости экрана
          // тангенциальная закрутка (перпендикуляр радиали) + поток за пальцем (pointerMove)
          vel[i3]   += (-ry) * sw + pointerMove.x * fall * 0.38;
          vel[i3+1] += ( rx) * sw + pointerMove.y * fall * 0.38;
          vel[i3+2] += pointerMove.z * fall * 0.38;
          if (fall > disturb[i]) disturb[i] = fall;
          pushed++; moveSum += sw; moveDir += rx * sw;
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
      // палец водит → держим (×0.975); отпущен → гаснет ПЛАВНО и небыстро (×0.95) → спокойный возврат.
      disturb[i] *= touchOn ? 0.975 : 0.95;
      // СВЕТ ВНУТРИ частиц: тронутые ЯРКО светятся (заметный эффект касания), пока стекаются обратно
      const sp = Math.abs(vel[i3]) + Math.abs(vel[i3+1]) + Math.abs(vel[i3+2]);
      const g = Math.max(Math.min(sp * 7, 0.6), disturb[i] * 0.75);
      if (g > glow[i]) glow[i] = g; else glow[i] += (g - glow[i]) * 0.1;
      if (glow[i] > _glowMax) _glowMax = glow[i];   // макс свечение → для idle-оптимизации
    }
    particles.geometry.attributes.position.needsUpdate = true;
    particles.geometry.attributes.aglow.needsUpdate = true;
    }   // конец if(!idle) — в покое цикл и загрузка в GPU пропущены (легче)
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
  const TUNNEL_DUR = 1.3;   // дайв-туннель ЕЩЁ быстрее (−~1с от общей сцены)
  tunnelBlend = THREE.MathUtils.clamp(tunnelBlend + (brainOpen ? 1 : -1) * (dt / TUNNEL_DUR), 0, 1);
  if (!brainOpen && tunnelBlend < 0.01 && particles) particles.rotation.z *= 0.95;
  // класс tunnel-exit снимается ТОЛЬКО по таймеру в closeBrain (когда текст улетел), а не при tunnelBlend≈0,
  // — иначе текст обрывался (туннель закрывается за 2с, а текст улетает 3.2с).

  // ====== РЕНДЕР ======
  if (faqBg > 0.02 && env.ready) {
    updateFaqTableCam();
    // ПРОХОД 1 — ФОН: зал клуба с КАМЕРЫ КЛИЕНТА (main). Стол скрыт (он отдельным проходом).
    const tableVis = faq.group.visible; faq.group.visible = false;
    renderer.render(scene, camera);
    // ПРОХОД 2 — СТОЛ сверху (как фото 2), ПОВЕРХ фона. Прячем всё кроме стола; глушим общий свет/
    // env-map (фишки глубоко-чёрные); фон/фог off; очищаем глубину (зал не перекрывает стол).
    const hides = [poker.group, darts.group, billiard.group, bar.group, space.group, subject, env.group];
    const hv = hides.map((g) => g && g.visible); hides.forEach((g) => { if (g) g.visible = false; });
    const dv = dice.map((d) => d.visible); dice.forEach((d) => d.visible = false);
    faq.group.visible = true;
    const aInt = env.ambient ? env.ambient.intensity : 0, kInt = env.key ? env.key.intensity : 0;
    if (env.ambient) env.ambient.intensity = 0.06; if (env.key) env.key.intensity = 0.05;
    const eInt = scene.environmentIntensity; scene.environmentIntensity = 0.12;
    const pf = scene.fog, pbg = scene.background; scene.fog = null; scene.background = null;
    renderer.autoClear = false; renderer.clearDepth();
    renderer.render(scene, faqTableCam);
    renderer.autoClear = true;
    if (env.ambient) env.ambient.intensity = aInt; if (env.key) env.key.intensity = kInt;
    scene.environmentIntensity = eInt; scene.fog = pf; scene.background = pbg;
    hides.forEach((g, i) => { if (g) g.visible = hv[i]; }); dice.forEach((d, i) => d.visible = dv[i]);
    faq.group.visible = tableVis;
  } else {
    renderer.render(scene, camera);
  }
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
function glitchFx(el) { if (!el || el.classList.contains('glitching')) return; sound.playGlitch(); el.classList.add('glitching'); setTimeout(() => el.classList.remove('glitching'), 420); }
// ПРАВИЛО: ВЕСЬ текст на страницах реагирует на наведение И касание визуальной + звуковой глитч-анимацией.
const TEXT_SEL = '.hero-title,.hero-sub,.hero-desc,.about-label,.about-title,.about-note,.thesis,.poker-title,.poker-sub,.darts-title,.darts-sub,.darts-promo,.billiard-title,.billiard-sub,.bar-title,.bar-sub,.faq-title,.faq-sub,.faq-hint-label,.dh-key,.ds-zone,.nav-logo,.nav-cta,.bh-label,.bd-label,#brain-detail h3,#brain-detail p,.su-head h3,.su-head p,.cp-head h3,.cp-head p';
document.querySelectorAll(TEXT_SEL).forEach((el) => { el.addEventListener('mouseenter', () => glitchFx(el)); });
// КАСАНИЕ: текст-оверлеи имеют pointer-events:none, поэтому ловим тап ГЛОБАЛЬНО и бьём по тексту под
// пальцем по геометрии bounding-box (не мешает 3D-взаимодействию и скроллу). Учитываем видимость предков.
function _vis(el) { let n = el; while (n && n !== document.body) { const cs = getComputedStyle(n); if (parseFloat(cs.opacity) < 0.06 || cs.visibility === 'hidden' || cs.display === 'none') return false; n = n.parentElement; } return true; }
let _lastGlitch = 0;
function glitchAtPoint(x, y) {
  const now = performance.now(); if (now - _lastGlitch < 110) return;
  let pick = null, area = Infinity;
  document.querySelectorAll(TEXT_SEL).forEach((el) => {
    const r = el.getBoundingClientRect();
    if (!r.width || !r.height || x < r.left || x > r.right || y < r.top || y > r.bottom) return;
    if (!_vis(el)) return;
    const a = r.width * r.height; if (a < area) { area = a; pick = el; }
  });
  if (pick) { _lastGlitch = now; glitchFx(pick); }
}
addEventListener('pointerdown', (e) => glitchAtPoint(e.clientX, e.clientY), { passive: true });
document.querySelectorAll('.btn, [data-t]').forEach((el) => { el.addEventListener('mouseenter', () => glitchFx(el)); });
document.querySelectorAll('a, button').forEach((el) => el.addEventListener('click', () => sound.playClick()));
// Кнопки-ссылки в Telegram (бот/канал) на 1 стр и FAQ — НАДЁЖНЫЙ клик: открываем ссылку сами,
// чтобы тап не перехватывался сценой/жестами (раньше клик уходил в 3D → утка дёргалась, кнопка молчала).
document.querySelectorAll('a.btn[href*="t.me"], a.nav-cta[href*="t.me"]').forEach((a) => {
  const href = a.getAttribute('href');
  const go = (e) => { e.preventDefault(); e.stopPropagation(); sound.playClick?.(); window.open(href, '_blank', 'noopener'); };
  a.addEventListener('click', go);
  a.addEventListener('touchend', (e) => { e.stopPropagation(); }, { passive: true });
});

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
  // Кнопка у покерного стола открывает анкету. Кнопки «Записаться» в шапке/герое/FAQ — это
  // <a href="…ТГ-бот"> и ведут В БОТА (не перехватываем их клик).
  document.getElementById('poker-signup')?.addEventListener('click', () => openSignup());
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
    // Бэкенд: api.php?action=saveLead → БД + welcome-письмо + лид-магнит + ТГ/почта руководителям,
    // авто-приглашение через 15 мин (cron). Экран успеха показываем СРАЗУ, не дожидаясь ответа.
    try { fetch('api.php?action=saveLead', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) }); } catch (err) {}
    try { window.__ducksTrack?.('conversion', 'lead'); } catch (e) {}
    submitted = true;
    card.classList.add('done');                 // показываем красивое окно «спасибо»
    sound.playSuccess?.();   // без кряка
    setTimeout(closeSignup, 3400);               // само закрывается, остаёмся в Покере
  });
}

// ============================================================
// КУПОН ДАРТСА — модалка «скидка 15% за 150 очков». ВИЗУАЛ/ФРОНТ (этап 1).
// Купон приходит ТОЛЬКО на почту после заполнения анкеты (фарм базы подписчиков) — на экране
// купон НЕ показываем и НЕ даём скачать. Бэкенд (PHP/SQLite/PHPMailer, уникальный именной номер,
// письмо игроку + организаторам ducks.game.space@gmail.com, админка, статус «использован»,
// антифрод 1-купон-на-почту, cron) подключается ПОЗЖЕ — здесь только отправка-заглушка на coupon.php.
// ============================================================
{
  const cp = document.getElementById('coupon');
  const form = document.getElementById('cp-form');
  const nameI = document.getElementById('cp-name');
  const emailI = document.getElementById('cp-email');
  const phoneI = document.getElementById('cp-phone');
  const consentI = document.getElementById('cp-consent');
  const submitB = document.getElementById('cp-submit');
  const card = document.querySelector('.cp-card');
  const scoreEl = document.getElementById('cp-score');
  const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  let submitted = false, savedScroll = 0;

  const openCoupon = (score) => {
    if (scoreEl && score) scoreEl.textContent = String(score);
    savedScroll = (lenis && typeof lenis.scroll === 'number') ? lenis.scroll : window.scrollY;
    document.body.classList.add('coupon-open');
    try { lenis.stop(); } catch (e) {}
    sound.playSuccess?.();
    card.classList.toggle('done', submitted);
    if (!submitted) setTimeout(() => nameI && nameI.focus({ preventScroll: true }), 420);
  };
  const closeCoupon = () => {
    document.body.classList.remove('coupon-open');
    try { lenis.start(); lenis.scrollTo(savedScroll, { immediate: true, force: true }); } catch (e) {}
  };
  window.__openCoupon = openCoupon;

  document.getElementById('cp-close')?.addEventListener('click', closeCoupon);
  document.getElementById('cp-done')?.addEventListener('click', closeCoupon);
  cp?.addEventListener('click', (e) => { if (e.target === cp) closeCoupon(); });
  addEventListener('keydown', (e) => { if (e.key === 'Escape' && document.body.classList.contains('coupon-open')) closeCoupon(); });

  // маска телефона +7 (9XX) XXX-XX-XX (как в анкете)
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
    phoneI.classList.remove('invalid');
  });

  const validEmail = () => EMAIL_RE.test(emailI.value.trim());
  const validName = () => nameI.value.trim().length > 0;
  const validPhone = () => phoneI.value.replace(/\D/g, '').length >= 11;
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
    if (!validPhone()) { phoneI.classList.add('invalid'); ok = false; }
    if (consentI && !consentI.checked) {
      const wrap = consentI.closest('.cp-consent');
      if (wrap) { wrap.classList.add('shake'); setTimeout(() => wrap.classList.remove('shake'), 500); }
      ok = false;
    }
    if (!ok) { sound.playGlitch?.(); return; }
    submitB.disabled = true;
    const payload = {
      name: nameI.value.trim(), email: emailI.value.trim(), phone: phoneI.value.trim(),
      score: scoreEl ? scoreEl.textContent : '', discount: 15, source: 'site:darts-coupon',
    };
    // Бэкенд: api.php?action=saveCoupon → именной купон в БД, письмо игроку с купоном-вложением,
    // уведомление руководителям. Экран успеха показываем СРАЗУ. Если вернётся ссылка на скачивание —
    // добавляем кнопку «Скачать купон» в окно благодарности.
    try {
      fetch('api.php?action=saveCoupon', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
        .then((r) => r.json()).then((res) => {
          if (res && res.download) {
            const dl = document.getElementById('cp-download');
            if (dl) { dl.href = res.download; dl.style.display = ''; }
          }
        }).catch(() => {});
    } catch (err) {}
    try { window.__ducksTrack?.('conversion', 'coupon'); } catch (e) {}
    submitted = true;
    card.classList.add('done');
    sound.playSuccess?.();
  });
}

// ============================================================
// FAQ (станция 7): тап по фишке → она крутится, взлетает и ПЕРЕВОРАЧИВАЕТСЯ в центре, показывая
// ОТВЕТ прямо на фишке (без всплывающих окон). Золотая фишка = CTA → ТГ-бот.
// ============================================================
const TG_BOT = 'https://t.me/ducks_gameclub_bot';
function onFaqPick(idx) {
  const item = faq.data[idx];
  if (!item) return;
  const wasSel = faq.selected === idx;
  faq.select(idx);                       // toggle: тот же → вернуть на стол
  if (wasSel) {
    sound.playChipPlace?.();             // фишка ложится обратно на сукно
  } else {
    sound.playChipLift?.();              // поднимаем фишку
    setTimeout(() => sound.playChipFlip?.(), 220);   // и переворот в полёте
  }
}
function closeFaqAnswer() {
  if (faq.selected >= 0) sound.playChipPlace?.();
  faq.deselect();
}
window.__onFaqPick = onFaqPick; window.__closeFaqAnswer = closeFaqAnswer;   // для проверки в браузере

// ============================================================
// БЕСКОНЕЧНАЯ ПЕТЛЯ (обе стороны), плавный переход КАМЕРОЙ в темноту вдали стола:
//   • с последней (FAQ) доскролл вниз → камера улетает вперёд в темноту → возвращаемся к Холлу,
//     где утка собирается ЧАСТИЦАМИ (без кубиков);
//   • с первой (Холл) скролл вверх → так же уходим в темноту → попадаем на FAQ.
// Свап координат — в самой темноте (середина), поэтому стык незаметен: ощущение бесконечности.
// ============================================================
// ПЕТЛЯ УПРАВЛЯЕТСЯ ЖЕСТОМ В РЕАЛЬНОМ ВРЕМЕНИ (как все переходы): прогресс loopT ведём пальцем/
// колесом, при отпускании — авто-докрутка (снап) к 0 или 1. heroness: 0=сторона FAQ, 1=сторона Холла.
function beginLoop(dir) {
  if (looping || !introDone || brainOpen) return;
  if (document.body.classList.contains('signup-open') || document.body.classList.contains('coupon-open')) return;
  looping = dir; loopT = 0; loopSwapped = false; loopDragging = true; loopSnap = -1;
  closeFaqAnswer();
  sound.playWhoosh?.(true);
  try { lenis.stop(); } catch (e) {}
}
function driveLoop(dn) { if (looping && loopDragging) loopT = THREE.MathUtils.clamp(loopT + dn, 0, 1); }
function releaseLoop() { if (looping && loopDragging) { loopDragging = false; loopSnap = (loopT > 0.32) ? 1 : 0; sound.playFormation?.(); } }
window.__startLoop = (d) => { beginLoop(d); loopDragging = false; loopSnap = 1; };   // для headless-проверки
window.__driveLoop = (v) => { if (looping) loopT = THREE.MathUtils.clamp(v, 0, 1); };
window.__loopHold = (d, v) => { if (!looping) beginLoop(d); loopDragging = true; loopSnap = -1; loopT = THREE.MathUtils.clamp(v, 0, 1); };   // держать прогресс

// текст: заголовок/подзаголовок Холла ПРИЛЕТАЮТ ИЗДАЛЕКА (маленькие+размытые → большие+чёткие),
// текст FAQ улетает вдаль; кнопки снизу НЕ трогаем (статичны). h = heroness 0..1.
function driveLoopText(h) {
  const heroIn = THREE.MathUtils.smoothstep(h, 0.45, 1.0);
  [heroTop].forEach((el) => { if (!el) return;
    el.style.opacity = String(heroIn);
    el.style.transform = `translateX(-50%) scale(${0.55 + 0.45 * heroIn})`;
    el.style.filter = `blur(${(1 - heroIn) * 10}px)`;
    el.style.pointerEvents = 'none';
  });
  const faqOut = 1 - THREE.MathUtils.smoothstep(h, 0.0, 0.5);
  if (faqTop) {
    faqTop.style.opacity = String(faqOut);
    faqTop.style.transform = `translateX(-50%) scale(${1 + (1 - faqOut) * 0.5})`;
    faqTop.style.filter = `blur(${(1 - faqOut) * 8}px)`;
  }
  // кнопки обеих страниц держим видимыми и на месте (бесшовный стык)
  if (heroBottom) { heroBottom.style.opacity = '1'; heroBottom.style.transform = 'translateX(-50%) scale(1)'; heroBottom.style.filter = 'none'; }
}
function clearLoopText() {
  [heroTop, heroBottom, faqTop].forEach((el) => { if (el) { el.style.transform = ''; el.style.filter = ''; } });
}

// финал петли: completed=true (докрутили) → на целевую страницу; false → откат на исходную
function finishLoop(completed) {
  const dir = looping;
  const toHero = completed ? (dir > 0) : (dir < 0);
  looping = 0; loopDragging = false; loopSnap = -1; loopFaqRev = -1; loopHeroness = toHero ? 1 : 0;
  if (toHero) {
    scrollProgress = 0; settledStation = 0; _lastStIdx = 0;
    try { lenis.scrollTo(0, { immediate: true, force: true }); } catch (e) {}
    introPlaying = false; formProgress = 1; introDuckReveal = 1; uDuckReveal.value = 999; heroReveal = 1;
    if (duckMesh) { duckMesh.visible = true; duckMesh.rotation.y = DUCK_FACE; duckMesh.position.set(0, 0, 0); duckMesh.scale.set(1, 1, 1); }
    document.body.classList.add('hero-in');
  } else {
    scrollProgress = 1; settledStation = STATIONS.length - 1; _lastStIdx = STATIONS.length - 1;
    try { lenis.scrollTo(lenis.limit || 0, { immediate: true, force: true }); } catch (e) {}
    introPlaying = false; formProgress = 1; introDuckReveal = 1; uDuckReveal.value = 999;
    if (duckMesh) duckMesh.visible = false;
    faq.reset();
    document.body.classList.remove('hero-in');
  }
  clearLoopText();
  updateUIByScroll();
  document.getElementById('scroll-progress').style.width = (scrollProgress * 100) + '%';
  try { lenis.start(); } catch (e) {}
}

// прогресс петли (каждый кадр из animate). Морф ведётся ЗНАЧЕНИЕМ loopT (палец/снап), БЕЗ ЧЕРНОТЫ:
// стол и фишки растворяются в частицы НА МЕСТЕ → собираются в утку; камера фона клуба отъезжает.
function updateLoop(dt) {
  if (!looping) return;
  if (loopFadeEl) loopFadeEl.style.opacity = '0';
  if (!loopDragging && loopSnap >= 0) {            // авто-докрутка после отпускания
    loopT += (loopSnap - loopT) * Math.min(1, dt * 9);
    if (Math.abs(loopT - loopSnap) < 0.012) loopT = loopSnap;
  }
  if (!loopSwapped) {                              // свап координат — один раз, в начале
    loopSwapped = true;
    if (looping > 0) { scrollProgress = 0; settledStation = 0; _lastStIdx = 0; try { lenis.scrollTo(0, { immediate: true, force: true }); } catch (e) {} }
    else { scrollProgress = 1; settledStation = STATIONS.length - 1; _lastStIdx = STATIONS.length - 1; try { lenis.scrollTo(lenis.limit || 0, { immediate: true, force: true }); } catch (e) {} }
    updateUIByScroll();
    document.getElementById('scroll-progress').style.width = (scrollProgress * 100) + '%';
  }
  loopHeroness = (looping > 0) ? loopT : (1 - loopT);   // 0 = FAQ, 1 = Холл
  const h = loopHeroness;
  loopClub = THREE.MathUtils.smoothstep(h, 0.12, 0.85);                 // клуб проявляется к стороне Холла
  loopFaqRev = 1 - THREE.MathUtils.smoothstep(h, 0.0, 0.6);             // фишки растворяются
  // УТКА собирается из частиц по мере heroness (снизу вверх цветом, как интро)
  introPlaying = true;
  formProgress = THREE.MathUtils.smoothstep(h, 0.05, 0.82);
  heroReveal = THREE.MathUtils.smoothstep(h, 0.25, 0.95);
  introDuckReveal = THREE.MathUtils.smoothstep(h, 0.55, 1.0);
  if (duckMesh) duckMesh.visible = introDuckReveal > 0.01;
  document.body.classList.toggle('hero-in', h > 0.15);
  driveLoopText(h);
  if (loopSnap >= 0 && loopT === loopSnap) finishLoop(loopSnap === 1);
}

// КОЛЕСО/ТРЕКПАД: на краю FAQ (низ) крутим вниз → петля вперёд; на Холле (верх) вверх → петля назад.
// Прогресс идёт сразу с колесом; докрутка — по затиханию (как на других станциях).
let _loopWheelTimer = 0;
addEventListener('wheel', (e) => {
  if (document.body.classList.contains('signup-open') || document.body.classList.contains('coupon-open') || brainOpen) return;
  if (!looping) {
    if (e.deltaY > 4 && scrollProgress > 0.985 && fk > 0.85) beginLoop(1);
    else if (e.deltaY < -4 && scrollProgress < 0.015 && tp < 0.05) beginLoop(-1);
  }
  if (looping && loopDragging) {
    driveLoop((looping > 0 ? e.deltaY : -e.deltaY) / 900);
    clearTimeout(_loopWheelTimer);
    _loopWheelTimer = setTimeout(releaseLoop, 110);
  }
}, { passive: true });

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
