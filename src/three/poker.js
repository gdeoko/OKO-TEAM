import * as THREE from 'three';

// ============================================================
// СТАНЦИЯ «ПОКЕР» — овальный стол DUCK'S + 4 карты-формата турниров.
// Сукно нарисовано под реальный стол клуба (бордо, узор мастей, золотой кант, лого DUCK'S,
// 4 окошка под карты, подпись «наши турниры»). Лица карт — бренд-арты с вписанным названием
// турнира; рубашка — арт «утка DUCK'S». Камера смотрит фронтально, карты лежат рядом над окошками.
// API: group, update(t,dt,camera), setReveal(pk), raycast(ray), toggleLift(card), cards[].
// ============================================================

const FORMATS = [
  { key: 'bounty',  name: 'BOUNTY SNIPER', img: 'cards/bounty.webp',  accent: '#E50000' },
  { key: 'joker',   name: 'JOKER',         img: 'cards/joker.webp',   accent: '#8B00FF' },
  { key: 'ladies',  name: 'LADIES NIGHT',  img: 'cards/ladies.webp',  accent: '#FF1744' },
  { key: 'strange', name: 'STRANGE',       img: 'cards/strange.webp', accent: '#FFD600' },
];

const CARD_W = 0.62, CARD_H = 0.87, CARD_T = 0.016;   // должно совпадать с main.js

function roundRect(ctx, X, Y, W, H, R) { ctx.beginPath(); ctx.moveTo(X + R, Y); ctx.arcTo(X + W, Y, X + W, Y + H, R); ctx.arcTo(X + W, Y + H, X, Y + H, R); ctx.arcTo(X, Y + H, X, Y, R); ctx.arcTo(X, Y, X + W, Y, R); ctx.closePath(); }

// текстура из картинки с дорисовкой поверх (картинка грузится асинхронно)
function imageTexture(url, draw, W = 512, H = 716) {
  const c = document.createElement('canvas'); c.width = W; c.height = H;
  const x = c.getContext('2d'); x.fillStyle = '#0a0a0c'; x.fillRect(0, 0, W, H);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
  const img = new Image();
  img.onload = () => { try { draw(x, img, W, H); } catch (e) {} t.needsUpdate = true; };
  img.src = url;
  return t;
}
// вписать картинку «по заполнению» (cover) с лёгким зумом (срезает белые поля по краям арта)
function coverDraw(x, img, W, H, zoom = 1.06) {
  const s = Math.max(W / img.width, H / img.height) * zoom;
  const w = img.width * s, h = img.height * s;
  x.drawImage(img, (W - w) / 2, (H - h) / 2, w, h);
}

// ЛИЦО карты: бренд-арт + название турнира снизу (часть карты)
function cardFaceTexture(fmt) {
  return imageTexture(fmt.img, (x, img, W, H) => {
    coverDraw(x, img, W, H, 1.26);   // сильнее зум — срезает белые поля исходного арта
    // затемнение снизу под текст
    const g = x.createLinearGradient(0, H, 0, H - 250); g.addColorStop(0, 'rgba(0,0,0,.92)'); g.addColorStop(1, 'rgba(0,0,0,0)');
    x.fillStyle = g; x.fillRect(0, H - 250, W, 250);
    // акцентная черта
    x.strokeStyle = fmt.accent; x.lineWidth = 4; x.shadowColor = fmt.accent; x.shadowBlur = 14;
    x.beginPath(); x.moveTo(W / 2 - 78, H - 168); x.lineTo(W / 2 + 78, H - 168); x.stroke();
    // название
    x.shadowColor = fmt.accent; x.shadowBlur = 22; x.fillStyle = '#fff';
    x.textAlign = 'center'; x.textBaseline = 'middle'; x.font = '900 50px Orbitron, "Exo 2", sans-serif';
    const parts = fmt.name.split(' ');
    if (parts.length > 1) { x.fillText(parts[0], W / 2, H - 116); x.fillText(parts.slice(1).join(' '), W / 2, H - 62); }
    else x.fillText(parts[0], W / 2, H - 90);
    x.shadowBlur = 0;
  });
}

let _backTex = null;
function cardBackTexture() {
  if (_backTex) return _backTex;
  _backTex = imageTexture('cards/back.webp', (x, img, W, H) => {
    coverDraw(x, img, W, H, 1.02);
    x.strokeStyle = 'rgba(229,0,0,.95)'; x.lineWidth = 11; roundRect(x, 16, 16, W - 32, H - 32, 30); x.stroke();
    x.strokeStyle = 'rgba(255,255,255,.6)'; x.lineWidth = 3; roundRect(x, 27, 27, W - 54, H - 54, 24); x.stroke();
  });
  return _backTex;
}

// СУКНО овального стола DUCK'S (вид сверху). fullL/fullW — полные размеры стола (для раскладки окошек)
function feltTexture(cardXs, fullL, fullW) {
  const W = 1024, H = Math.round(W * fullW / fullL);
  const c = document.createElement('canvas'); c.width = W; c.height = H;
  const x = c.getContext('2d');
  // бордовое поле
  const g = x.createRadialGradient(W / 2, H / 2, 80, W / 2, H / 2, W * 0.6);
  g.addColorStop(0, '#7c1422'); g.addColorStop(1, '#470a12');
  x.fillStyle = g; x.fillRect(0, 0, W, H);
  // узор мастей
  x.fillStyle = 'rgba(0,0,0,0.14)'; x.font = '26px Georgia, serif'; x.textAlign = 'center'; x.textBaseline = 'middle';
  const suits = ['♠', '♥', '♦', '♣'];
  let row = 0;
  for (let yy = 36; yy < H; yy += 46, row++) for (let xx = 36, i = 0; xx < W; xx += 46, i++) x.fillText(suits[(i + row) % 4], xx, yy);
  // золотой кант (внешний стадион) + беговая линия
  x.strokeStyle = 'rgba(212,175,55,0.85)'; x.lineWidth = 6; roundRect(x, 44, 44, W - 88, H - 88, (H - 88) / 2); x.stroke();
  x.strokeStyle = 'rgba(212,175,55,0.5)'; x.lineWidth = 3; roundRect(x, 150, 96, W - 300, H - 192, (H - 192) / 2); x.stroke();
  // 4 окошка под карты (ровно под картами) — золотой контур
  const bw = (CARD_W / fullL) * W * 1.1, bh = (CARD_H / fullW) * H * 1.1;
  x.strokeStyle = 'rgba(212,175,55,0.9)'; x.lineWidth = 3;
  cardXs.forEach((wx) => { const cx = (wx / fullL + 0.5) * W; roundRect(x, cx - bw / 2, H / 2 - bh / 2, bw, bh, 10); x.stroke(); });
  // лого DUCK'S (красная плашка) — дальний край
  const lw = 210, lh = 66, lx = W / 2 - lw / 2, ly = 46;
  x.fillStyle = '#cc0000'; x.shadowColor = 'rgba(204,0,0,.6)'; x.shadowBlur = 18; roundRect(x, lx, ly, lw, lh, 8); x.fill(); x.shadowBlur = 0;
  x.fillStyle = '#fff'; x.font = '900 42px Orbitron, "Exo 2", sans-serif'; x.textBaseline = 'middle'; x.fillText("DUCK'S", W / 2, ly + lh / 2 + 2);
  // подпись «наши турниры · нажми на карту» — ПОД картами, ближе к зрителю, ярко и крупно
  x.fillStyle = 'rgba(252,232,170,0.96)'; x.font = '700 26px Orbitron, "Exo 2", sans-serif';
  x.shadowColor = 'rgba(0,0,0,.55)'; x.shadowBlur = 6;
  const phrase = 'Н А Ш И   Т У Р Н И Р Ы   ·   Н А Ж М И   Н А   К А Р Т У';
  const maxW = W * 0.46, pm = x.measureText(phrase).width;
  x.save(); x.translate(W / 2, H * 0.7); if (pm > maxW) x.scale(maxW / pm, 1);
  x.fillText(phrase, 0, 0); x.restore(); x.shadowBlur = 0;
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return t;
}

// одна карта
function buildCard(fmt) {
  const geo = new THREE.BoxGeometry(CARD_W, CARD_T, CARD_H);   // лежит плашмя (толщина по Y)
  const edge = new THREE.MeshStandardMaterial({ color: 0x140a0e, roughness: 0.7 });   // тёмный торец карты (не белый)
  const faceMat = new THREE.MeshStandardMaterial({ map: cardFaceTexture(fmt), roughness: 0.42, metalness: 0.0, emissive: new THREE.Color(fmt.accent), emissiveIntensity: 0.0 });
  const backMat = new THREE.MeshStandardMaterial({ map: cardBackTexture(), roughness: 0.5, metalness: 0.0 });
  // группы BoxGeometry: 0 +x,1 -x,2 +y(верх),3 -y(низ),4 +z,5 -z. Лежит рубашкой вверх: верх=рубашка, низ=лицо
  const mats = [edge, edge, backMat, faceMat, edge, edge];
  const card = new THREE.Mesh(geo, mats);
  card.userData = { fmt, faceMat, lifted: false };
  return card;
}

// стадион-овал (скруглённый прямоугольник, торцы — полукруги)
function stadiumShape(halfL, halfW) {
  const s = new THREE.Shape(); const r = halfW;
  s.moveTo(-halfL + r, -halfW);
  s.lineTo(halfL - r, -halfW);
  s.absarc(halfL - r, 0, r, -Math.PI / 2, Math.PI / 2, false);
  s.lineTo(-halfL + r, halfW);
  s.absarc(-halfL + r, 0, r, Math.PI / 2, Math.PI * 1.5, false);
  return s;
}

export class PokerStation {
  constructor() {
    this.group = new THREE.Group();
    this.group.visible = false;

    // свет над столом
    this.spot = new THREE.SpotLight(0xffd9b0, 0, 16, Math.PI / 5, 0.5, 1.2);
    this.spot.position.set(0, 6, 1.5); this.spot.target.position.set(0, 0, 0.2);
    this.group.add(this.spot, this.spot.target);
    this.fill = new THREE.PointLight(0xcc2222, 0, 12); this.fill.position.set(-2, 1.6, 3); this.group.add(this.fill);

    // позиции 4 карт в ряд (над окошками)
    const N = FORMATS.length;
    const cardXs = FORMATS.map((_, i) => (i - (N - 1) / 2) * 0.82);

    // СУКНО — овальная плоскость (стадион), текстура сверху. Овал шире/менее вытянут.
    const HALF_L = 2.4, HALF_W = 1.7;
    const shape = stadiumShape(HALF_L, HALF_W);
    const felt = new THREE.ShapeGeometry(shape, 48);
    // нормализуем UV по габаритам (в плоскости XY), затем кладём плашмя
    felt.computeBoundingBox(); const bb = felt.boundingBox; const sx = bb.max.x - bb.min.x, sy = bb.max.y - bb.min.y;
    const pos = felt.attributes.position, uv = [];
    for (let i = 0; i < pos.count; i++) uv.push((pos.getX(i) - bb.min.x) / sx, (pos.getY(i) - bb.min.y) / sy);
    felt.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    felt.rotateX(-Math.PI / 2);
    const feltMesh = new THREE.Mesh(felt, new THREE.MeshStandardMaterial({ map: feltTexture(cardXs, HALF_L * 2, HALF_W * 2), roughness: 0.95, metalness: 0.0 }));
    feltMesh.position.y = 0; this.group.add(feltMesh);

    // РАЙ (борт) — труба по контуру стадиона (чуть больше сукна)
    const railPts2d = stadiumShape(HALF_L + 0.06, HALF_W + 0.06).getPoints(80);
    const railPts = railPts2d.map((p) => new THREE.Vector3(p.x, 0.04, -p.y));
    const railCurve = new THREE.CatmullRomCurve3(railPts, true);
    const rail = new THREE.Mesh(
      new THREE.TubeGeometry(railCurve, 160, 0.16, 14, true),
      new THREE.MeshStandardMaterial({ color: 0x1c0a0c, roughness: 0.35, metalness: 0.3, emissive: 0x2a0000, emissiveIntensity: 0.5 })
    );
    this.group.add(rail);

    // 4 карты в ряд, рубашкой вверх
    this.cards = [];
    FORMATS.forEach((fmt, i) => {
      const card = buildCard(fmt);
      card.position.set(cardXs[i], 0.03, 0.0);   // ровно над окошками (z=0), идеальный ряд
      card.rotation.set(0, 0, 0);
      card.userData.home = card.position.clone();
      card.userData.homeQuat = card.quaternion.clone();
      this.group.add(card);
      this.cards.push(card);
    });
  }

  setReveal(pk) {
    this.group.visible = pk > 0.2;
    const s = 0.32 + 0.68 * THREE.MathUtils.smoothstep(pk, 0.3, 1);   // стол растёт/приближается
    this.group.scale.setScalar(s);
    const eTable = THREE.MathUtils.clamp((pk - 0.3) / 0.4, 0, 1);
    const eCards = THREE.MathUtils.clamp((pk - 0.5) / 0.35, 0, 1);   // карты позже — эстафета у частиц
    this.spot.intensity = 28 * eTable;
    this.fill.intensity = 9 * eTable;
    this.group.traverse((o) => {
      if (o.isMesh && o.material) {
        const op = o.userData && o.userData.fmt ? eCards : eTable;
        const mm = Array.isArray(o.material) ? o.material : [o.material];
        mm.forEach((m) => { m.transparent = true; m.opacity = op; });
      }
    });
  }

  raycast(raycaster) { const h = raycaster.intersectObjects(this.cards, false); return h.length ? h[0].object : null; }

  toggleLift(card) {
    const was = card.userData.lifted;
    this.cards.forEach((c) => { c.userData.lifted = false; });
    card.userData.lifted = !was;
    return card.userData.lifted;
  }

  update(t, dt, camera) {
    if (!this.group.visible) return;
    const k = Math.min(1, dt * 6);
    this.cards.forEach((card) => {
      const u = card.userData;
      if (u.lifted && camera) {
        camera.getWorldPosition(_camPos); camera.matrixWorld.extractBasis(_right, _camUp, _tmp);
        camera.getWorldDirection(_n);
        _v.copy(_camPos).addScaledVector(_n, 2.15).addScaledVector(_camUp, -0.08);
        this.group.worldToLocal(_targetLocal.copy(_v));
        card.position.lerp(_targetLocal, k);
        card.getWorldPosition(_v); _n.copy(_camPos).sub(_v).normalize();
        _yAxis.copy(_n).multiplyScalar(-1);
        _right.crossVectors(_yAxis, _camUp).normalize();
        _zAxis.crossVectors(_right, _yAxis).normalize();
        _m.makeBasis(_right, _yAxis, _zAxis); _q.setFromRotationMatrix(_m);
        this.group.getWorldQuaternion(_qg); _q.premultiply(_qg.invert());
        card.quaternion.slerp(_q, k);
        u.faceMat.emissiveIntensity += (0.4 - u.faceMat.emissiveIntensity) * k;
        return;
      }
      card.position.lerp(u.home, k);
      card.quaternion.slerp(u.homeQuat, k);
      u.faceMat.emissiveIntensity += (0 - u.faceMat.emissiveIntensity) * k;
    });
  }
}

// временные объекты
const _v = new THREE.Vector3(), _camPos = new THREE.Vector3(), _n = new THREE.Vector3();
const _camUp = new THREE.Vector3(), _right = new THREE.Vector3(), _tmp = new THREE.Vector3();
const _yAxis = new THREE.Vector3(), _zAxis = new THREE.Vector3(), _targetLocal = new THREE.Vector3();
const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _qg = new THREE.Quaternion();
