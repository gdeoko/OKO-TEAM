import * as THREE from 'three';

// ============================================================
// СТАНЦИЯ «FAQ» (станция 7, финал + петля). Стол с покерными ФИШКАМИ-вопросами в фирменном
// стиле DUCK'S. ЧЁРНЫЕ ГЛЯНЦЕВЫЕ фишки: на ВЕРХНЕЙ грани (лежит на столе) — ВОПРОС, на НИЖНЕЙ —
// ОТВЕТ. Тап → фишка взлетает КРУТЯСЬ, ПЕРЕВОРАЧИВАЕТСЯ в центре экрана лицом-ответом к зрителю
// (ответ прямо на фишке, без всплывающих окон). Золотая фишка «ЗАПИСАТЬСЯ» = CTA → ТГ-бот.
// burst() рассыпает фишки в петле (FAQ↔Холл).
// API: group, baseScale, setReveal(fk), update(t,dt,camera), raycast(ray)→idx|null,
//      select(idx), deselect(), reset(), burst(), chips[], data[]
// ============================================================

const _wp = new THREE.Vector3();
const _camLocal = new THREE.Vector3();
const _v = new THREE.Vector3();
const _camRight = new THREE.Vector3(), _camUp = new THREE.Vector3(), _camFwd = new THREE.Vector3();
const _mat4 = new THREE.Matrix4();
const _qHome = new THREE.Quaternion(), _qShow = new THREE.Quaternion(), _qSpin = new THREE.Quaternion(), _qGroup = new THREE.Quaternion(), _qWorld = new THREE.Quaternion();
const _eHome = new THREE.Euler();
const _Y = new THREE.Vector3(0, 1, 0);
const TWO_PI = Math.PI * 2;

// ---- данные вопросов (голос бренда, без стоп-слов) ----
const QA = [
  { q: 'Как попасть\nв клуб?', a: 'Оставь заявку в нашем боте — позовём на ближайший вечер.' },
  { q: 'Сколько\nстоит вечер?', a: 'От 1000 ₽ за участие в турнире.' },
  { q: 'На что\nиграем?', a: 'На интерес и место в рейтинге клуба. Без денежного риска.' },
  { q: 'Бар?\nКальяны?', a: 'Бар есть. Кальянов нет — чистый воздух, живое общение.' },
  { q: 'Какие\nигры?', a: 'Покер, дартс, бильярд, бар. Скоро — мафия и квиз.' },
  { q: 'Новичок\nили один?', a: 'Конечно. Тебя примут и научат.' },
];
const CTA = { q: 'ЗАПИСАТЬСЯ', a: '', cta: true, bot: true };   // (больше не выводится фишкой — CTA вынесен в HTML-кнопки)

const R = 0.7;           // радиус фишки
const TH = 0.16;         // толщина фишки

// раскладка фишек на сукне (локальные коорд: x — вправо, z — К зрителю = +z)
// десктоп — широкая сетка 3×2; мобайл (портрет) — узкая 2×3, чтобы фишки не обрезались по краям.
const LAYOUT_D = [
  [-1.7, -1.35], [0, -1.35], [1.7, -1.35],
  [-1.7,  0.25], [0,  0.25], [1.7,  0.25],
];
const LAYOUT_M = [
  [-1.05, -1.95], [1.05, -1.95],
  [-1.05, -0.35], [1.05, -0.35],
  [-1.05,  1.25], [1.05,  1.25],
];
const CTA_POS_D = [0, 1.9];
const CTA_POS_M = [0, 2.8];

// перенос длинного текста по словам (для лица-ответа)
function wrapLines(ctx, text, maxW) {
  const words = text.split(' ');
  const lines = []; let cur = '';
  for (const w of words) {
    const test = cur ? cur + ' ' + w : w;
    if (ctx.measureText(test).width > maxW && cur) { lines.push(cur); cur = w; }
    else cur = test;
  }
  if (cur) lines.push(cur);
  return lines;
}

// ---- текстура лица фишки. kind: 'q' вопрос | 'a' ответ | 'cta' ----
function chipFace(item, kind) {
  const gold = kind === 'cta';
  // РЕНДЕР В 2× (1024) для резкости текста (full-HD/«8k» ощущение), логические координаты = 512
  const SL = 512, K = 2, S = SL * K;
  const c = document.createElement('canvas'); c.width = c.height = S;
  const x = c.getContext('2d');
  x.scale(K, K);
  x.textAlign = 'center';
  const cx = SL / 2, cy = SL / 2, Rp = SL / 2 - 6;
  // 1) тело фишки — ЧЁРНОЕ (или золотое для CTA), радиальный градиент с бликом
  const base = gold ? ['#ffe9a0', '#e6ad28', '#8a5f0e'] : ['#3a3a44', '#17171d', '#070709'];
  const g = x.createRadialGradient(cx, cy - 60, 24, cx, cy, Rp);
  g.addColorStop(0, base[0]); g.addColorStop(0.5, base[1]); g.addColorStop(1, base[2]);
  x.beginPath(); x.arc(cx, cy, Rp, 0, TWO_PI); x.fillStyle = g; x.fill();
  // 2) концентрические бороздки
  x.lineWidth = 2;
  for (let r = Rp - 8; r > Rp - 78; r -= 7) {
    x.beginPath(); x.arc(cx, cy, r, 0, TWO_PI);
    x.strokeStyle = gold ? 'rgba(120,80,0,0.18)' : 'rgba(255,255,255,0.05)'; x.stroke();
  }
  // 3) «споты» по ободу — чередуем КРАСНЫЙ и БЕЛЫЙ (как на референсе чёрной фишки)
  const NSPOT = 8, spotW = 0.30;
  for (let i = 0; i < NSPOT; i++) {
    const a0 = (i / NSPOT) * TWO_PI - spotW / 2, a1 = a0 + spotW;
    const col = gold ? '#fff4d0' : (i % 2 === 0 ? '#d11f1f' : '#f2efe9');
    // белая/светлая окантовка
    x.beginPath(); x.arc(cx, cy, Rp - 2, a0 - 0.045, a1 + 0.045); x.arc(cx, cy, Rp - 84, a1 + 0.045, a0 - 0.045, true); x.closePath();
    x.fillStyle = gold ? '#7a560c' : '#0c0c0f'; x.fill();
    x.beginPath(); x.arc(cx, cy, Rp - 7, a0, a1); x.arc(cx, cy, Rp - 79, a1, a0, true); x.closePath();
    x.fillStyle = col; x.fill();
  }
  // 4) обводки обода
  x.lineWidth = 5; x.strokeStyle = gold ? '#5a3f06' : '#000';
  x.beginPath(); x.arc(cx, cy, Rp - 3, 0, TWO_PI); x.stroke();
  // 5) центральный диск
  const Ri = S * 0.355;
  const inner = x.createRadialGradient(cx, cy - 24, 14, cx, cy, Ri);
  if (gold) { inner.addColorStop(0, '#fff6da'); inner.addColorStop(1, '#e7c86c'); }
  else { inner.addColorStop(0, '#22222a'); inner.addColorStop(1, '#0c0c10'); }
  x.beginPath(); x.arc(cx, cy, Ri, 0, TWO_PI); x.fillStyle = inner; x.fill();
  // двойное кольцо: красное + светлое
  x.lineWidth = 6; x.strokeStyle = gold ? '#b8902a' : '#d11f1f';
  x.beginPath(); x.arc(cx, cy, Ri, 0, TWO_PI); x.stroke();
  x.lineWidth = 2; x.strokeStyle = gold ? 'rgba(255,240,200,.7)' : 'rgba(255,255,255,.45)';
  x.beginPath(); x.arc(cx, cy, Ri - 11, 0, TWO_PI); x.stroke();

  x.textAlign = 'center';
  if (kind === 'cta') {
    x.fillStyle = '#5a3f06'; x.font = '900 38px Orbitron, "Exo 2", sans-serif';
    x.fillText("DUCK'S", cx, cy - 50);
    x.fillStyle = '#7a1010'; x.font = '900 46px Orbitron, "Exo 2", sans-serif';
    x.fillText('ЗАПИСАТЬСЯ', cx, cy + 12);
    x.fillStyle = '#8a5f0e'; x.font = '700 24px Orbitron, "Exo 2", sans-serif';
    x.fillText('→ ТЕЛЕГРАМ', cx, cy + 60);
  } else if (kind === 'q') {
    // ВЕРХНЯЯ грань: вордмарк + вопрос (белый текст на чёрном)
    x.fillStyle = '#d11f1f'; x.font = '900 30px Orbitron, "Exo 2", sans-serif';
    x.fillText("DUCK'S", cx, cy - 78);
    x.fillStyle = '#ffffff'; x.font = '900 46px Orbitron, "Exo 2", sans-serif';
    const lines = item.q.split('\n');
    const ly = cy - 8, lh = 54;
    lines.forEach((ln, i) => x.fillText(ln, cx, ly + i * lh));
    // маленькая подсказка «переверни»
    x.fillStyle = 'rgba(255,255,255,.4)'; x.font = '600 18px "Exo 2", sans-serif';
    x.fillText('тапни →', cx, cy + 96);
  } else {
    // НИЖНЯЯ грань: ОТВЕТ — крупный белый текст по центру, БЕЗ ярлыка (чтобы ничего не налазило).
    // подбираем размер под длину ответа, чтобы умещался ровно в центральном диске
    let fs = 38;
    let lines;
    do {
      x.font = `700 ${fs}px "Exo 2", Inter, sans-serif`;
      lines = wrapLines(x, item.a, Ri * 1.66);
      if (lines.length * (fs + 8) <= Ri * 1.9) break;
      fs -= 2;
    } while (fs > 24);
    x.fillStyle = '#ffffff';
    const lh = fs + 8, ly = cy - (lines.length - 1) * lh / 2;
    lines.forEach((ln, i) => x.fillText(ln, cx, ly + i * lh));
    // маленький вордмарк снизу
    x.fillStyle = 'rgba(209,31,31,.75)'; x.font = '700 18px Orbitron, "Exo 2", sans-serif';
    x.fillText("DUCK'S", cx, cy + Ri * 0.78);
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 16; t.generateMipmaps = true;
  t.minFilter = THREE.LinearMipmapLinearFilter; t.magFilter = THREE.LinearFilter;
  return t;
}

function shadowTexture() {
  const S = 128, c = document.createElement('canvas'); c.width = c.height = S;
  const x = c.getContext('2d'); const g = x.createRadialGradient(S / 2, S / 2, 2, S / 2, S / 2, S / 2);
  g.addColorStop(0, 'rgba(0,0,0,0.66)'); g.addColorStop(0.55, 'rgba(0,0,0,0.34)'); g.addColorStop(1, 'rgba(0,0,0,0)');
  x.fillStyle = g; x.fillRect(0, 0, S, S);
  return new THREE.CanvasTexture(c);
}

function feltTexture() {
  const S = 512, c = document.createElement('canvas'); c.width = c.height = S;
  const x = c.getContext('2d');
  const g = x.createRadialGradient(S / 2, S / 2, 30, S / 2, S / 2, S / 2);
  g.addColorStop(0, '#1f0c12'); g.addColorStop(0.62, '#140509'); g.addColorStop(1, '#0a0306');
  x.fillStyle = g; x.fillRect(0, 0, S, S);
  // тонкое сукно-зерно
  for (let i = 0; i < 2600; i++) {
    x.fillStyle = `rgba(255,${40 + Math.random() * 30 | 0},${60 + Math.random() * 30 | 0},${Math.random() * 0.03})`;
    x.fillRect(Math.random() * S, Math.random() * S, 1, 1);
  }
  // двойной круг разметки + лого
  x.strokeStyle = 'rgba(210,40,40,.18)'; x.lineWidth = 4;
  x.beginPath(); x.arc(S / 2, S / 2, S * 0.42, 0, TWO_PI); x.stroke();
  x.lineWidth = 2; x.beginPath(); x.arc(S / 2, S / 2, S * 0.40, 0, TWO_PI); x.stroke();
  x.globalAlpha = 0.028; x.fillStyle = '#ff7a7a'; x.textAlign = 'center';
  x.font = '900 96px Orbitron, sans-serif'; x.fillText("DUCK'S", S / 2, S / 2 + 30);
  x.globalAlpha = 1;
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}

export class FaqStation {
  constructor(isMobile = false, hooks = {}) {
    this.isMobile = isMobile;
    this.hooks = hooks;
    this.group = new THREE.Group();
    this.group.visible = false;
    this.baseScale = 1;
    this._rev = 0;
    this.selected = -1;
    this.bursting = 0;
    this._mats = [];
    this.data = QA.slice();   // 6 фишек-вопросов (CTA вынесен в HTML-кнопки «ЗАПИСАТЬСЯ/ПОДРОБНЕЕ»)
    this.chips = [];

    const reg = (m, base = 1) => { m.transparent = true; m.userData._b = base; m.opacity = 0; this._mats.push(m); return m; };

    // ----- СТОЛ: сукно + глянцевый борт (компактнее — вокруг виден зал клуба) -----
    const FELT_R = 2.75;
    this.felt = new THREE.Mesh(
      new THREE.CircleGeometry(FELT_R, 72),
      reg(new THREE.MeshStandardMaterial({ map: feltTexture(), roughness: 0.92, metalness: 0.0, side: THREE.DoubleSide }), 1)
    );
    this.felt.rotation.x = -Math.PI / 2; this.felt.position.y = -0.02; this.felt.renderOrder = 0;
    this.group.add(this.felt);
    // глянцевый борт-рейл вокруг сукна (тёмное дерево с красным лаком)
    this.rail = new THREE.Mesh(
      new THREE.TorusGeometry(FELT_R + 0.1, 0.32, 24, 96),
      reg(new THREE.MeshPhysicalMaterial({ color: 0x2a0a0c, roughness: 0.25, metalness: 0.2,
        clearcoat: 1.0, clearcoatRoughness: 0.12, emissive: 0x3a0608, emissiveIntensity: 0.5 }), 1)
    );
    this.rail.rotation.x = -Math.PI / 2; this.rail.position.y = 0.06; this.rail.renderOrder = 2;
    this.group.add(this.rail);
    // светящийся обод-неон под рейлом
    this.feltRing = new THREE.Mesh(
      new THREE.RingGeometry(FELT_R - 0.25, FELT_R - 0.08, 96),
      reg(new THREE.MeshBasicMaterial({ color: 0xff1a1a, transparent: true, opacity: 0, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, depthWrite: false }), 0.55)
    );
    this.feltRing.rotation.x = -Math.PI / 2; this.feltRing.position.y = 0.005; this.feltRing.renderOrder = 1;
    this.group.add(this.feltRing);

    const shTex = shadowTexture();
    const chipBodyGeo = new THREE.CylinderGeometry(R, R, TH, 56);
    const faceGeo = new THREE.CircleGeometry(R - 0.02, 56);

    this.data.forEach((item, i) => {
      const gold = !!item.cta;
      const pivot = new THREE.Group();
      const LAYOUT = isMobile ? LAYOUT_M : LAYOUT_D;
      const pos = item.cta ? (isMobile ? CTA_POS_M : CTA_POS_D) : LAYOUT[i];
      pivot.position.set(pos[0], 0, pos[1]);
      pivot.userData = {
        home: new THREE.Vector3(pos[0], 0, pos[1]),
        homeRotY: (Math.random() - 0.5) * 0.4,
        sel: 0, spin: 0, idx: i, gold,
        bvx: 0, bvy: 0, bvz: 0, brot: 0,
      };
      pivot.rotation.y = pivot.userData.homeRotY;

      // ТЕЛО — глянцевое чёрное, сильный clearcoat + отражения окружения (реалистичная фишка)
      const bodyMat = reg(new THREE.MeshPhysicalMaterial({
        color: 0x121216, roughness: 0.26, metalness: 0.15,
        clearcoat: 1.0, clearcoatRoughness: 0.06, envMapIntensity: 1.6,
        emissive: 0x090909, emissiveIntensity: 0.25,
      }), 1);
      const body = new THREE.Mesh(chipBodyGeo, bodyMat);
      body.renderOrder = 3; pivot.add(body);

      // ВЕРХНЯЯ грань — ВОПРОС. Лицо ГЛЯНЦЕВОЕ (сочное), но блик МЯГКИЙ (широкий clearcoat) → не
      // даёт резкого пятна на тексте; текст слегка самосветится (emissiveMap) для читаемости.
      const qTex = chipFace(item, 'q');
      const qMat = reg(new THREE.MeshPhysicalMaterial({
        map: qTex, emissive: 0xffffff, emissiveMap: qTex, emissiveIntensity: 0.32,
        roughness: 0.42, metalness: 0.0, clearcoat: 0.4, clearcoatRoughness: 0.35, envMapIntensity: 0.45,
      }), 1);
      const qFace = new THREE.Mesh(faceGeo, qMat);
      qFace.rotation.x = -Math.PI / 2; qFace.position.y = TH / 2 + 0.003; qFace.renderOrder = 4;
      pivot.add(qFace);

      // НИЖНЯЯ грань — ОТВЕТ
      const aTex = chipFace(item, 'a');
      const aMat = reg(new THREE.MeshPhysicalMaterial({
        map: aTex, emissive: 0xffffff, emissiveMap: aTex, emissiveIntensity: 0.32,
        roughness: 0.42, metalness: 0.0, clearcoat: 0.4, clearcoatRoughness: 0.35, envMapIntensity: 0.45,
      }), 1);
      const aFace = new THREE.Mesh(faceGeo, aMat);
      aFace.rotation.x = Math.PI / 2; aFace.position.y = -TH / 2 - 0.003; aFace.renderOrder = 4;
      pivot.add(aFace);

      // контактная тень
      const shadow = new THREE.Mesh(
        new THREE.PlaneGeometry(R * 2.6, R * 2.6),
        reg(new THREE.MeshBasicMaterial({ map: shTex, transparent: true, opacity: 0, depthWrite: false }), 0.65)
      );
      shadow.rotation.x = -Math.PI / 2; shadow.position.y = 0.002; shadow.renderOrder = 1;
      pivot.add(shadow);
      pivot.userData.shadow = shadow;
      pivot.userData.body = body;

      this.group.add(pivot);
      this.chips.push(pivot);
    });

    // ----- свет: тёплый прожектор СВЕРХУ (вид сверху), фишки сочные, не «вымытые» -----
    this.spot = new THREE.SpotLight(0xfff0d8, 0, 30, Math.PI / 3.8, 0.6, 1.0);
    this.spot.position.set(0.2, 6.2, 1.2); this.spot.target.position.set(0, 0, 0);
    this.group.add(this.spot, this.spot.target);
    this.warm = new THREE.PointLight(0xff8a4a, 0, 22); this.warm.position.set(-2.0, 3.0, 2.6);
    this.group.add(this.warm);
    this.rim = new THREE.PointLight(0xff2848, 0, 18); this.rim.position.set(2.6, 2.2, -1.6);
    this.group.add(this.rim);
    this.key = new THREE.PointLight(0xffffff, 0, 18); this.key.position.set(0.2, 4.2, 3.2);
    this.group.add(this.key);
  }

  setReveal(fk) {
    this._rev = fk;
    this.group.visible = fk > 0.02;
    if (!this.group.visible) return;
    const e = THREE.MathUtils.clamp((fk - 0.05) / 0.5, 0, 1);
    const es = e * e * (3 - 2 * e);
    this.group.scale.setScalar(this.baseScale);
    for (const m of this._mats) m.opacity = (m.userData._b || 1) * es;
    this.feltRing.material.opacity = 0.55 * es * (0.6 + 0.4 * Math.sin(performance.now() * 0.002));
    this.spot.intensity = 120 * es; this.warm.intensity = 32 * es;
    this.rim.intensity = 22 * es; this.key.intensity = 26 * es;
  }

  // луч → индекс фишки (ближайшая) или null
  raycast(raycaster) {
    if (!this.group.visible || this._rev < 0.2) return null;
    let best = null, bestD = Infinity;
    for (const pivot of this.chips) {
      pivot.getWorldPosition(_wp);
      const rad = (pivot.userData.gold ? R * 1.15 : R) * this.group.scale.x * (1 + pivot.userData.sel * 0.6);
      _v.copy(_wp).sub(raycaster.ray.origin);
      const proj = _v.dot(raycaster.ray.direction);
      if (proj < 0) continue;
      _v.copy(raycaster.ray.direction).multiplyScalar(proj).add(raycaster.ray.origin);
      const d = _v.distanceTo(_wp);
      if (d < rad && proj < bestD) { bestD = proj; best = pivot.userData.idx; }
    }
    return best;
  }

  select(idx) {
    if (idx == null || idx < 0 || idx >= this.chips.length) return null;
    this.selected = (this.selected === idx) ? -1 : idx;   // повторный тап — вернуть на стол
    return this.data[idx];
  }
  deselect() { this.selected = -1; }
  reset() {
    this.selected = -1; this.bursting = 0;
    for (const p of this.chips) {
      const u = p.userData;
      u.sel = 0; u.spin = 0; u.bvx = u.bvy = u.bvz = u.brot = 0;
      p.position.copy(u.home); p.quaternion.setFromEuler(_eHome.set(0, u.homeRotY, 0));
      p.scale.setScalar(1);
    }
  }
  // петля: фишки взлетают и рассыпаются
  burst() {
    this.bursting = 1; this.selected = -1;
    for (const p of this.chips) {
      const u = p.userData;
      const a = Math.random() * TWO_PI;
      u.bvx = Math.cos(a) * (1.2 + Math.random() * 1.4);
      u.bvz = Math.sin(a) * (1.2 + Math.random() * 1.4);
      u.bvy = 3.0 + Math.random() * 2.2;
      u.brot = (Math.random() - 0.5) * 16;
    }
  }

  update(t, dt, camera) {
    if (!this.group.visible) return;
    this.group.updateWorldMatrix(true, false);
    _camLocal.copy(camera.position);
    this.group.worldToLocal(_camLocal);

    for (const pivot of this.chips) {
      const u = pivot.userData;

      if (this.bursting > 0) {
        u.bvy -= 9.0 * dt;
        pivot.position.x += u.bvx * dt;
        pivot.position.y += u.bvy * dt;
        pivot.position.z += u.bvz * dt;
        pivot.rotation.x += u.brot * dt;
        pivot.rotation.y += u.brot * 0.7 * dt;
        pivot.scale.setScalar(THREE.MathUtils.clamp(pivot.scale.x - dt * 1.4, 0, 1));
        continue;
      }

      const target = (this.selected === u.idx) ? 1 : 0;
      u.sel += (target - u.sel) * Math.min(1, dt * 6.5);
      const sel = u.sel;

      // ЗАКРУТКА: набираем угол в начале выезда, затем ВСЕГДА гасим к нулю → в покое остаточного
      // поворота НЕТ (иначе ответ «косит» по-разному на разных fps/устройствах).
      if (target === 1 && sel < 0.55) u.spin += dt * 11;
      u.spin *= (1 - Math.min(1, dt * 4.5));

      // поза: дом ↔ витрина (центр, приподнята). showZ ближе к зрителю — крупнее и читаемее.
      const showY = this.isMobile ? 1.35 : 1.15;
      const showZ = this.isMobile ? 0.9 : 1.0;
      pivot.position.x = u.home.x * (1 - sel);
      pivot.position.y = u.home.y + (showY - u.home.y) * sel + Math.sin(t * 1.6 + u.idx) * 0.02 * (1 - sel);
      pivot.position.z = u.home.z + (showZ - u.home.z) * sel;
      pivot.scale.setScalar(1 + sel * (this.isMobile ? 0.85 : 1.05));

      // ОРИЕНТАЦИЯ: дом — плашмя (ВОПРОС +Y вверх). Витрина — ПЕРЕВОРОТ: фишка встаёт ПАРАЛЛЕЛЬНО
      // экрану нижней гранью (ОТВЕТ) к зрителю, текст ровно по экрану. Берём оси КАМЕРЫ напрямую
      // (не worldUp), поэтому разворот не «косит» в зависимости от позиции фишки. Слёрп = переворот.
      if (sel < 0.002) {
        pivot.quaternion.setFromEuler(_eHome.set(0, u.homeRotY, 0));
      } else {
        _camRight.setFromMatrixColumn(camera.matrixWorld, 0);
        _camUp.setFromMatrixColumn(camera.matrixWorld, 1);
        _camFwd.setFromMatrixColumn(camera.matrixWorld, 2).negate();   // -Z камеры = взгляд В сцену
        // хотим (world): local +Y → ВГЛУБЬ (от зрителя) ⇒ нижняя грань (ОТВЕТ, -Y) К зрителю;
        // local +X → camRight, local +Z (текст-верх) → camUp.
        _mat4.makeBasis(_camRight, _camFwd, _camUp);
        _qWorld.setFromRotationMatrix(_mat4);
        this.group.getWorldQuaternion(_qGroup);
        _qShow.copy(_qGroup).invert().multiply(_qWorld);          // мир → локаль группы
        _qSpin.setFromAxisAngle(_Y, u.spin);                      // закрутка (в покое = 0 → текст ровный)
        _qShow.multiply(_qSpin);
        _qHome.setFromEuler(_eHome.set(0, u.homeRotY, 0));
        pivot.quaternion.slerpQuaternions(_qHome, _qShow, THREE.MathUtils.smoothstep(sel, 0, 1));
      }
      if (u.body) u.body.material.emissiveIntensity = (u.gold ? 0.3 : 0.1) + sel * 0.5;
      if (u.shadow) u.shadow.material.opacity = (u.shadow.material.userData._b || 0.65) * this._mats_op() * (1 - sel);
    }
  }

  _mats_op() {
    const e = THREE.MathUtils.clamp((this._rev - 0.05) / 0.5, 0, 1);
    return e * e * (3 - 2 * e);
  }
}
