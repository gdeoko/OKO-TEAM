import * as THREE from 'three';

// ============================================================
// СТАНЦИЯ «FAQ» (станция 7, финал + петля). Сукно стола с покерными ФИШКАМИ-вопросами.
// На каждой фишке — короткий вопрос + штамп-силуэт утки DUCKS (бренд живёт как лого, БЕЗ 3D-утки,
// чтобы стык петли FAQ→Холл не дублировал утку). Клик по фишке → она ЗАКРУЧИВАЕТСЯ, вылетает в
// центр и встаёт лицом к зрителю → main показывает ОТВЕТ (HTML-панель). Золотая фишка «ЗАПИСАТЬСЯ»
// → переход в ТГ-бота. burst() рассыпает фишки в петле (FAQ→начало).
// API: group, baseScale, setReveal(fk), update(t,dt,camera), raycast(ray)→idx|null,
//      select(idx), deselect(), reset(), burst(), chips[], data[]
// ============================================================

const _wp = new THREE.Vector3();
const _camLocal = new THREE.Vector3();
const _v = new THREE.Vector3();
const _n = new THREE.Vector3(), _right = new THREE.Vector3(), _up2 = new THREE.Vector3(), _negUp = new THREE.Vector3();
const _mat4 = new THREE.Matrix4();
const _qHome = new THREE.Quaternion(), _qShow = new THREE.Quaternion(), _qSpin = new THREE.Quaternion();
const _eHome = new THREE.Euler();
const TWO_PI = Math.PI * 2;

// ---- данные вопросов (голос бренда, без стоп-слов) ----
const QA = [
  { q: 'Как попасть\nв клуб?', a: 'Оставь заявку в нашем боте — позовём на ближайший вечер.', bot: true, short: 'ПОПАСТЬ' },
  { q: 'Сколько\nстоит вечер?', a: 'От 1000 ₽ за участие в турнире.', short: 'ЦЕНА' },
  { q: 'На что\nиграем?', a: 'На интерес и место в рейтинге клуба. Без денежного риска.', short: 'СТАВКИ' },
  { q: 'Бар?\nКальяны?', a: 'Бар есть. Кальянов нет — чистый воздух, живое общение.', short: 'БАР' },
  { q: 'Какие\nигры?', a: 'Покер, дартс, бильярд, бар. Скоро — мафия и квиз.', short: 'ИГРЫ' },
  { q: 'Новичок\nили один?', a: 'Конечно. Тебя примут и научат.', short: 'НОВИЧОК' },
];
const CTA = { q: 'ЗАПИСАТЬСЯ', a: '', cta: true, bot: true, short: 'CTA' };

const R = 0.66;          // радиус фишки
const TH = 0.14;         // толщина фишки

// раскладка фишек на сукне (локальные коорд: x — вправо, z — К зрителю = +z)
// десктоп — широкая сетка 3×2; мобайл (портрет) — узкая 2×3, чтобы фишки не обрезались по краям.
const LAYOUT_D = [
  [-1.62, -1.30], [0, -1.30], [1.62, -1.30],
  [-1.62,  0.18], [0,  0.18], [1.62,  0.18],
];
const LAYOUT_M = [
  [-1.02, -1.85], [1.02, -1.85],
  [-1.02, -0.30], [1.02, -0.30],
  [-1.02,  1.25], [1.02,  1.25],
];
const CTA_POS_D = [0, 1.75];
const CTA_POS_M = [0, 2.75];

// ---- текстура лица фишки (фирменный стиль DUCK'S, по референсу) ----
function chipFace(item, gold) {
  const S = 512, c = document.createElement('canvas'); c.width = c.height = S;
  const x = c.getContext('2d');
  const cx = S / 2, cy = S / 2, Rp = S / 2 - 6;
  // 1) тело фишки — радиальный градиент
  const base = gold ? ['#ffe07a', '#e6ad28', '#9c6f12'] : ['#ef4646', '#c91f1f', '#8a0f0f'];
  const g = x.createRadialGradient(cx, cy - 50, 30, cx, cy, Rp);
  g.addColorStop(0, base[0]); g.addColorStop(0.55, base[1]); g.addColorStop(1, base[2]);
  x.beginPath(); x.arc(cx, cy, Rp, 0, TWO_PI); x.fillStyle = g; x.fill();
  // 2) концентрические бороздки тела
  x.lineWidth = 2;
  for (let r = Rp - 8; r > Rp - 70; r -= 7) {
    x.beginPath(); x.arc(cx, cy, r, 0, TWO_PI);
    x.strokeStyle = 'rgba(0,0,0,0.12)'; x.stroke();
  }
  // 3) «споты» по ободу — чёрные сегменты с белой окантовкой (классика, как на референсе)
  const NSPOT = 6, spotW = 0.42;   // ширина сегмента в радианах
  for (let i = 0; i < NSPOT; i++) {
    const a0 = (i / NSPOT) * TWO_PI - spotW / 2, a1 = a0 + spotW;
    // белая подложка
    x.beginPath(); x.arc(cx, cy, Rp - 2, a0 - 0.04, a1 + 0.04); x.arc(cx, cy, Rp - 76, a1 + 0.04, a0 - 0.04, true); x.closePath();
    x.fillStyle = '#f4f0ea'; x.fill();
    // чёрный сегмент
    x.beginPath(); x.arc(cx, cy, Rp - 8, a0, a1); x.arc(cx, cy, Rp - 70, a1, a0, true); x.closePath();
    x.fillStyle = gold ? '#2a1c02' : '#161013'; x.fill();
  }
  // 4) обводки обода
  x.lineWidth = 6; x.strokeStyle = gold ? '#7a560c' : '#5e0808';
  x.beginPath(); x.arc(cx, cy, Rp - 3, 0, TWO_PI); x.stroke();
  // 5) центральный белый диск
  const Ri = S * 0.34;
  const inner = x.createRadialGradient(cx, cy - 24, 16, cx, cy, Ri);
  if (gold) { inner.addColorStop(0, '#fffaf0'); inner.addColorStop(1, '#f3e6c2'); }
  else { inner.addColorStop(0, '#fff6f6'); inner.addColorStop(1, '#ffe7e7'); }
  x.beginPath(); x.arc(cx, cy, Ri, 0, TWO_PI); x.fillStyle = inner; x.fill();
  x.lineWidth = 7; x.strokeStyle = gold ? '#caa233' : '#c91f1f';
  x.beginPath(); x.arc(cx, cy, Ri, 0, TWO_PI); x.stroke();
  x.lineWidth = 2; x.strokeStyle = gold ? 'rgba(180,140,30,.5)' : 'rgba(180,20,20,.5)';
  x.beginPath(); x.arc(cx, cy, Ri - 12, 0, TWO_PI); x.stroke();
  // фоновый «сакральный» ромб (как на референсе) — едва заметный
  x.save(); x.translate(cx, cy); x.strokeStyle = gold ? 'rgba(180,140,30,.22)' : 'rgba(180,20,20,.22)'; x.lineWidth = 2;
  for (const rot of [0, Math.PI / 4]) { x.save(); x.rotate(rot); x.strokeRect(-Ri * 0.5, -Ri * 0.5, Ri, Ri); x.restore(); }
  x.beginPath(); x.arc(0, 0, Ri * 0.62, 0, TWO_PI); x.stroke(); x.restore();

  const ink = gold ? '#6a4a06' : '#a51616';
  x.textAlign = 'center';
  if (item.cta) {
    // золотая фишка-CTA
    x.fillStyle = ink; x.font = '900 40px Orbitron, "Exo 2", sans-serif';
    x.fillText("DUCK'S", cx, cy - 52);
    x.font = '900 46px Orbitron, "Exo 2", sans-serif'; x.fillStyle = '#7a1010';
    x.fillText('ЗАПИСАТЬСЯ', cx, cy + 14);
    x.font = '700 26px Orbitron, "Exo 2", sans-serif'; x.fillStyle = '#9c6f12';
    x.fillText('→ ТЕЛЕГРАМ', cx, cy + 64);
  } else {
    // вордмарк-штамп сверху + вопрос
    x.fillStyle = ink; x.font = '900 34px Orbitron, "Exo 2", sans-serif';
    x.fillText("DUCK'S", cx, cy - 74);
    x.fillStyle = '#7a1010'; x.font = '900 48px Orbitron, "Exo 2", sans-serif';
    const lines = item.q.split('\n');
    const ly = cy - 8, lh = 56;
    lines.forEach((ln, i) => x.fillText(ln, cx, ly + i * lh));
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
  return t;
}

function shadowTexture() {
  const S = 128, c = document.createElement('canvas'); c.width = c.height = S;
  const x = c.getContext('2d'); const g = x.createRadialGradient(S / 2, S / 2, 2, S / 2, S / 2, S / 2);
  g.addColorStop(0, 'rgba(0,0,0,0.6)'); g.addColorStop(0.55, 'rgba(0,0,0,0.32)'); g.addColorStop(1, 'rgba(0,0,0,0)');
  x.fillStyle = g; x.fillRect(0, 0, S, S);
  return new THREE.CanvasTexture(c);
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
    this.data = QA.concat([CTA]);
    this.chips = [];

    const reg = (m, base = 1) => { m.transparent = true; m.userData._b = base; m.opacity = 0; this._mats.push(m); return m; };

    // ----- сукно стола (тёмное, с красным свечением по краю) -----
    const feltTex = (() => {
      const S = 512, c = document.createElement('canvas'); c.width = c.height = S;
      const x = c.getContext('2d');
      const g = x.createRadialGradient(S / 2, S / 2, 30, S / 2, S / 2, S / 2);
      g.addColorStop(0, '#1c0a10'); g.addColorStop(0.7, '#120308'); g.addColorStop(1, '#070205');
      x.fillStyle = g; x.fillRect(0, 0, S, S);
      // лёгкое лого по центру
      x.globalAlpha = 0.06; x.fillStyle = '#ff6a6a'; x.textAlign = 'center';
      x.font = '900 120px Orbitron, sans-serif'; x.fillText("DUCK'S", S / 2, S / 2 + 36);
      x.globalAlpha = 1;
      const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
    })();
    this.felt = new THREE.Mesh(
      new THREE.CircleGeometry(4.6, 64),
      reg(new THREE.MeshStandardMaterial({ map: feltTex, roughness: 0.95, metalness: 0.0, side: THREE.DoubleSide }), 1)
    );
    this.felt.rotation.x = -Math.PI / 2; this.felt.position.y = -0.02; this.felt.renderOrder = 0;
    this.group.add(this.felt);
    // светящийся обод сукна
    this.feltRing = new THREE.Mesh(
      new THREE.RingGeometry(4.0, 4.5, 80),
      reg(new THREE.MeshBasicMaterial({ color: 0xcc0000, transparent: true, opacity: 0, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, depthWrite: false }), 0.5)
    );
    this.feltRing.rotation.x = -Math.PI / 2; this.feltRing.position.y = 0.0; this.feltRing.renderOrder = 1;
    this.group.add(this.feltRing);

    const shTex = shadowTexture();
    const chipBodyGeo = new THREE.CylinderGeometry(R, R, TH, 48);
    const faceGeo = new THREE.CircleGeometry(R - 0.015, 48);

    this.data.forEach((item, i) => {
      const gold = !!item.cta;
      const pivot = new THREE.Group();
      const LAYOUT = isMobile ? LAYOUT_M : LAYOUT_D;
      const pos = item.cta ? (isMobile ? CTA_POS_M : CTA_POS_D) : LAYOUT[i];
      pivot.position.set(pos[0], 0, pos[1]);
      pivot.userData = {
        home: new THREE.Vector3(pos[0], 0, pos[1]),
        homeRotY: (Math.random() - 0.5) * 0.4,
        sel: 0,            // 0 дом … 1 в центре
        spin: 0,           // накопленный угол закрутки
        idx: i, gold,
        bvx: 0, bvy: 0, bvz: 0, brot: 0,   // для burst
      };
      pivot.rotation.y = pivot.userData.homeRotY;

      // тело фишки
      const bodyMat = reg(new THREE.MeshStandardMaterial({
        color: gold ? 0xdda23a : 0xc11f1f, roughness: 0.5, metalness: 0.15,
        emissive: gold ? 0x3a2600 : 0x300000, emissiveIntensity: 0.4,
      }), 1);
      const body = new THREE.Mesh(chipBodyGeo, bodyMat);
      body.renderOrder = 3; pivot.add(body);
      // лицо (текстура с вопросом)
      const faceMat = reg(new THREE.MeshStandardMaterial({
        map: chipFace(item, gold), roughness: 0.45, metalness: 0.05,
        emissive: 0xffffff, emissiveMap: chipFace(item, gold), emissiveIntensity: 0.25,
      }), 1);
      const face = new THREE.Mesh(faceGeo, faceMat);
      face.rotation.x = -Math.PI / 2; face.position.y = TH / 2 + 0.002; face.renderOrder = 4;
      pivot.add(face);
      // контактная тень
      const shadow = new THREE.Mesh(
        new THREE.PlaneGeometry(R * 2.5, R * 2.5),
        reg(new THREE.MeshBasicMaterial({ map: shTex, transparent: true, opacity: 0, depthWrite: false }), 0.6)
      );
      shadow.rotation.x = -Math.PI / 2; shadow.position.y = 0.001; shadow.renderOrder = 1;
      pivot.add(shadow);
      pivot.userData.shadow = shadow;
      pivot.userData.body = body;

      this.group.add(pivot);
      this.chips.push(pivot);
    });

    // ----- свет -----
    this.spot = new THREE.SpotLight(0xffe6c0, 0, 26, Math.PI / 4, 0.5, 1.0);
    this.spot.position.set(0.4, 5.2, 1.5); this.spot.target.position.set(0, 0, 0);
    this.group.add(this.spot, this.spot.target);
    this.warm = new THREE.PointLight(0xff7040, 0, 14); this.warm.position.set(-1.5, 1.6, 2.2);
    this.group.add(this.warm);
    this.rim = new THREE.PointLight(0x88ddff, 0, 12); this.rim.position.set(2.2, 1.4, -1.5);
    this.group.add(this.rim);
    this.key = new THREE.PointLight(0xffffff, 0, 10); this.key.position.set(0.4, 3.0, 2.6);
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
    this.feltRing.material.opacity = 0.5 * es * (0.6 + 0.4 * Math.sin(performance.now() * 0.002));
    this.spot.intensity = 40 * es; this.warm.intensity = 12 * es;
    this.rim.intensity = 10 * es; this.key.intensity = 8 * es;
    // входная «раскрутка»: пока станция проявляется — фишки чуть приподняты и докручиваются
    this._enter = es;
  }

  // луч → индекс фишки (ближайшая) или null
  raycast(raycaster) {
    if (!this.group.visible || this._rev < 0.2) return null;
    let best = null, bestD = Infinity;
    for (const pivot of this.chips) {
      pivot.getWorldPosition(_wp);
      const rad = (pivot.userData.gold ? R * 1.1 : R) * this.group.scale.x * (1 + pivot.userData.sel * 0.6);
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
    this.selected = idx;
    return this.data[idx];
  }
  deselect() { this.selected = -1; }
  reset() {
    this.selected = -1; this.bursting = 0;
    for (const p of this.chips) {
      const u = p.userData;
      u.sel = 0; u.spin = 0; u.bvx = u.bvy = u.bvz = u.brot = 0;
      p.position.copy(u.home); p.rotation.set(0, u.homeRotY, 0);
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

    // позиция камеры в локальной системе группы (для разворота фишки лицом к зрителю)
    this.group.updateWorldMatrix(true, false);
    _camLocal.copy(camera.position);
    this.group.worldToLocal(_camLocal);

    for (const pivot of this.chips) {
      const u = pivot.userData;

      if (this.bursting > 0) {
        // разлёт в петле
        u.bvy -= 9.0 * dt;
        pivot.position.x += u.bvx * dt;
        pivot.position.y += u.bvy * dt;
        pivot.position.z += u.bvz * dt;
        pivot.rotation.x += u.brot * dt;
        pivot.rotation.y += u.brot * 0.7 * dt;
        const s = THREE.MathUtils.clamp(pivot.scale.x - dt * 1.4, 0.0, 1);
        pivot.scale.setScalar(s);
        continue;
      }

      const target = (this.selected === pivot.userData.idx) ? 1 : 0;
      u.sel += (target - u.sel) * Math.min(1, dt * 7);
      const sel = u.sel;

      // закрутка при выезде в центр (несколько оборотов)
      if (sel > 0.001 && sel < 0.999 && target === 1) u.spin += dt * 9;

      // целевая поза: дом ↔ «витрина» (центр, приподнята, лицом к зрителю)
      const showY = this.isMobile ? 1.5 : 1.35;
      const showZ = 0.55;
      pivot.position.x = u.home.x * (1 - sel);
      pivot.position.y = u.home.y + (showY - u.home.y) * sel + Math.sin(t * 1.6 + u.idx) * 0.02 * (1 - sel);
      pivot.position.z = u.home.z + (showZ - u.home.z) * sel;
      pivot.scale.setScalar(1 + sel * (this.isMobile ? 0.55 : 0.75));

      // ОРИЕНТАЦИЯ: в доме фишка лежит плашмя (face +Y вверх, текст читается сверху). В витрине —
      // встаёт ЛИЦОМ к камере с верхом текста ВВЕРХ (билборд через базис), + закрутка вокруг лица.
      if (sel < 0.002) {
        pivot.quaternion.setFromEuler(_eHome.set(0, u.homeRotY, 0));
      } else {
        _n.copy(_camLocal).sub(pivot.position).normalize();        // куда смотрит лицо (+Y)
        _right.set(0, 1, 0).cross(_n);
        if (_right.lengthSq() < 1e-4) _right.set(1, 0, 0);
        _right.normalize();
        _up2.copy(_n).cross(_right).normalize();                   // экранный «верх» текста
        _negUp.copy(_up2).negate();                                // local +Z → -up2 (текст-верх = -Z)
        _mat4.makeBasis(_right, _n, _negUp);
        _qShow.setFromRotationMatrix(_mat4);
        const spinAng = u.spin * (1 - THREE.MathUtils.smoothstep(sel, 0.8, 1));
        _qSpin.setFromAxisAngle(_n, spinAng);
        _qShow.premultiply(_qSpin);
        _qHome.setFromEuler(_eHome.set(0, u.homeRotY, 0));
        pivot.quaternion.slerpQuaternions(_qHome, _qShow, THREE.MathUtils.smoothstep(sel, 0, 1));
      }
      // лёгкое «дыхание» свечения выбранной фишки
      if (u.body) u.body.material.emissiveIntensity = 0.4 + sel * 0.5;
      // тень прячется когда фишка в воздухе
      if (u.shadow) u.shadow.material.opacity = (u.shadow.material.userData._b || 0.6) * this._mats_op() * (1 - sel);
    }
  }

  _mats_op() {
    // текущая общая прозрачность (по reveal) — для тени
    const e = THREE.MathUtils.clamp((this._rev - 0.05) / 0.5, 0, 1);
    return e * e * (3 - 2 * e);
  }
}
