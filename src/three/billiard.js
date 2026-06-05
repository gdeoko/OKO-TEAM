import * as THREE from 'three';

// ============================================================
// СТАНЦИЯ «БИЛЬЯРД» — БЕЗ стола: один ПРОЦЕДУРНЫЙ шар-восьмёрка по центру на космическом фоне.
// Шар в стиле бренда: чёрный глянец + золотая/красная ажурная «оплётка» + белые круги с «8»
// с ДВУХ сторон. Вращается сам (скорость как у мозга) + закрутка касанием.
// API: group, setReveal(bk), hit(raycaster), addSpin(dxPx,dyPx,vw), update(t,dt), spinSpeed().
// hooks: { onCue() } — звук кия из main.
// ============================================================

const BALL_R = 1.06;            // крупный герой по центру
const EIGHT_FACE_YAW = 0;       // круги «8» на u=0.25/0.75 текстуры → передний (u=0.25) смотрит в +Z (камера)

const _q = new THREE.Quaternion();
const _X = new THREE.Vector3(1, 0, 0);
const _Y = new THREE.Vector3(0, 1, 0);

// equirect-текстура (2:1): чёрный глянец + золотая ажурная оплётка + красные акценты +
// 2 белых круга с «8» (на экваторе → ровные на сфере), на u=0.25 и u=0.75 (перёд/зад).
function ballTexture() {
  const W = 2048, H = 1024, c = document.createElement('canvas'); c.width = W; c.height = H;
  const x = c.getContext('2d');
  x.fillStyle = '#070708'; x.fillRect(0, 0, W, H);
  const GOLD = '#d9b24a', GOLDD = 'rgba(217,178,74,0.55)', RED = 'rgba(204,0,0,0.7)';

  // ажурная оплётка: тонкие золотые меридианы + красные между ними
  for (let i = 0; i < 24; i++) {
    const px = (i / 24) * W;
    x.strokeStyle = (i % 2 === 0) ? GOLDD : RED;
    x.lineWidth = (i % 2 === 0) ? 3 : 2;
    x.beginPath(); x.moveTo(px, 0); x.lineTo(px, H); x.stroke();
  }
  // золотые параллели (горизонтальные кольца)
  x.strokeStyle = GOLDD; x.lineWidth = 3;
  [0.22, 0.78].forEach((fy) => { x.beginPath(); x.moveTo(0, fy * H); x.lineTo(W, fy * H); x.stroke(); });
  // золотой экваториальный поясок (двойная линия)
  x.strokeStyle = GOLD; x.lineWidth = 4; x.beginPath(); x.moveTo(0, H * 0.5 - 6); x.lineTo(W, H * 0.5 - 6); x.stroke();
  x.beginPath(); x.moveTo(0, H * 0.5 + 6); x.lineTo(W, H * 0.5 + 6); x.stroke();
  // мелкие золотые «звёздочки»-узелки на пересечениях экватора и меридианов
  x.fillStyle = GOLD;
  for (let i = 0; i < 24; i += 2) { const px = (i / 24) * W; x.beginPath(); x.arc(px, H * 0.5, 5, 0, Math.PI * 2); x.fill(); }

  // 2 белых круга с «8» (перёд u=0.25 → x=W/4, зад u=0.75 → x=3W/4), на экваторе y=H/2
  const r = 175, cy = H / 2;
  [W * 0.25, W * 0.75].forEach((cx) => {
    x.beginPath(); x.arc(cx, cy, r + 16, 0, Math.PI * 2); x.fillStyle = GOLD; x.fill();          // золотой кант
    x.beginPath(); x.arc(cx, cy, r + 9, 0, Math.PI * 2); x.fillStyle = '#cc0000'; x.fill();       // красное кольцо
    x.beginPath(); x.arc(cx, cy, r, 0, Math.PI * 2); x.fillStyle = '#f6f5f1'; x.fill();           // белый круг
    x.fillStyle = '#0a0a0c'; x.textAlign = 'center'; x.textBaseline = 'middle';
    x.font = '800 190px Orbitron, "Exo 2", sans-serif'; x.fillText('8', cx, cy + 10);
  });

  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return t;
}

export class BilliardStation {
  constructor(hooks = {}) {
    this.hooks = hooks;
    this.group = new THREE.Group();
    this.group.visible = false;

    // --- ШАР (узорный глянец) ---
    this.ball = new THREE.Group();
    this.group.add(this.ball);
    this.ballMesh = new THREE.Mesh(
      new THREE.SphereGeometry(BALL_R, 72, 54),
      new THREE.MeshPhysicalMaterial({ map: ballTexture(), roughness: 0.06, metalness: 0.05,
        clearcoat: 1.0, clearcoatRoughness: 0.04, transparent: true, opacity: 0 })
    );
    this.ball.add(this.ballMesh);
    this.ball.rotation.y = EIGHT_FACE_YAW;

    // --- СВЕТ на шар: тёплый spot + красный fill + холодный rim (глянцевые блики) ---
    this.spot = new THREE.SpotLight(0xfff2e2, 0, 30, Math.PI / 5, 0.5, 1.0);
    this.spot.position.set(0.6, 3.6, 2.6); this.spot.target.position.set(0, 0, 0);
    this.group.add(this.spot, this.spot.target);
    this.fill = new THREE.PointLight(0xcc2222, 0, 16); this.fill.position.set(-2.0, 0.8, 2.8);
    this.group.add(this.fill);
    this.rim = new THREE.PointLight(0xbfe0ff, 0, 14); this.rim.position.set(1.8, 1.6, 2.2);
    this.group.add(this.rim);

    this._spin = new THREE.Vector3(0, 0, 0);
    this._rev = 0;
    this._sphereW = new THREE.Sphere();
    this.IDLE_RATE = 0.6;          // авто-вращение вокруг Y — как у мозга (~0.6 рад/с)
    this.SPIN_DAMP = 1.4;
    this.SPIN_MAX = 16;
  }

  setReveal(bk) {
    this._rev = bk;
    this.group.visible = bk > 0.02;
    if (!this.group.visible) return;
    const e = THREE.MathUtils.clamp((bk - 0.12) / 0.5, 0, 1);
    const es = e * e * (3 - 2 * e);
    this.group.scale.setScalar(0.7 + 0.3 * es);
    this.spot.intensity = 42 * es;
    this.fill.intensity = 10 * es;
    this.rim.intensity = 13 * es;
    this.ballMesh.material.opacity = es;
  }

  hit(raycaster) {
    if (!this.group.visible) return false;
    this.ball.getWorldPosition(this._sphereW.center);
    this._sphereW.radius = BALL_R * this.group.scale.x * 1.1;
    return raycaster.ray.intersectsSphere(this._sphereW);
  }

  addSpin(dxPx, dyPx, vw) {
    const k = 11.0 / (vw || 1000);
    this._spin.y += dxPx * k;
    this._spin.x += dyPx * k;
    const L = this._spin.length();
    if (L > this.SPIN_MAX) this._spin.multiplyScalar(this.SPIN_MAX / L);
  }

  spinSpeed() { return this._spin.length(); }

  update(t, dt) {
    if (!this.group.visible) return;
    this._spin.multiplyScalar(Math.max(0, 1 - this.SPIN_DAMP * dt));
    const ax = this._spin.x * dt;
    const ay = (this._spin.y + this.IDLE_RATE) * dt;
    if (ax) { _q.setFromAxisAngle(_X, ax); this.ball.quaternion.premultiply(_q); }
    if (ay) { _q.setFromAxisAngle(_Y, ay); this.ball.quaternion.premultiply(_q); }
  }
}
