import * as THREE from 'three';

// ============================================================
// СТАНЦИЯ «БИЛЬЯРД» — ровный тёмный стол (сукно + красный неон-борт) и ПРОЦЕДУРНЫЙ глянцевый
// шар-восьмёрка в стиле бренда (чёрный глянец, чистый белый круг с «8», красный акцент-кант).
// Шар быстро вращается сам (как мозг) + закрутка касанием. БЕЗ мини-игры/счёта.
// Фон станции — космос (см. src/three/space.js), включается на переходе 4→5.
// API: group, setReveal(bk), hit(raycaster), addSpin(dxPx,dyPx,vw), update(t,dt), spinSpeed().
// hooks: { onCue() } — звук кия из main.
// ============================================================

const BALL_R = 0.9;             // радиус шара (крупный герой)
const FELT_W = 4.2, FELT_L = 7.4, RAIL = 0.18;
const EIGHT_FACE_YAW = -Math.PI / 2;   // круг с «8» (u=0.5 текстуры = +X) → разворот к камере (+Z)

const _q = new THREE.Quaternion();
const _X = new THREE.Vector3(1, 0, 0);
const _Y = new THREE.Vector3(0, 1, 0);

// equirect-текстура шара: чёрный глянец + белый круг с «8» по центру (на экваторе → круг ровный
// на сфере при текстуре 2:1) + тонкий красный кант-акцент бренда.
function ballTexture() {
  const W = 1024, H = 512, c = document.createElement('canvas'); c.width = W; c.height = H;
  const x = c.getContext('2d');
  x.fillStyle = '#070708'; x.fillRect(0, 0, W, H);
  const cx = W * 0.5, cy = H * 0.5, r = 96;
  x.beginPath(); x.arc(cx, cy, r + 9, 0, Math.PI * 2); x.fillStyle = '#cc0000'; x.fill();   // красный кант
  x.beginPath(); x.arc(cx, cy, r, 0, Math.PI * 2); x.fillStyle = '#f6f5f1'; x.fill();        // белый круг
  x.fillStyle = '#0a0a0c'; x.textAlign = 'center'; x.textBaseline = 'middle';
  x.font = '800 104px Orbitron, "Exo 2", sans-serif';
  x.fillText('8', cx, cy + 6);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return t;
}

export class BilliardStation {
  constructor(hooks = {}) {
    this.hooks = hooks;
    this.group = new THREE.Group();
    this.group.visible = false;

    // --- РОВНОЕ СУКНО (тёмное, чуть зеленоватое) ---
    this.felt = new THREE.Mesh(
      new THREE.BoxGeometry(FELT_W, 0.24, FELT_L),
      new THREE.MeshStandardMaterial({ color: 0x0c1a14, roughness: 0.95, metalness: 0.0, transparent: true, opacity: 0 })
    );
    this.felt.position.y = -BALL_R - 0.12;
    this.group.add(this.felt);

    // --- БОРТ: красный неон-рамка (4 бруска) ---
    this.railMat = new THREE.MeshStandardMaterial({ color: 0x1a0608, roughness: 0.4, metalness: 0.3,
      emissive: 0xcc0000, emissiveIntensity: 0.9, transparent: true, opacity: 0 });
    const railY = -BALL_R + 0.04;
    const hw = FELT_W / 2 + RAIL / 2, hl = FELT_L / 2 + RAIL / 2;
    const mk = (w, d, px, pz) => { const m = new THREE.Mesh(new THREE.BoxGeometry(w, 0.14, d), this.railMat); m.position.set(px, railY, pz); this.group.add(m); return m; };
    this.rails = [
      mk(FELT_W + RAIL * 2, RAIL, 0, hl), mk(FELT_W + RAIL * 2, RAIL, 0, -hl),
      mk(RAIL, FELT_L + RAIL * 2, hw, 0), mk(RAIL, FELT_L + RAIL * 2, -hw, 0),
    ];
    // лузы-намёки
    const pocketMat = new THREE.MeshStandardMaterial({ color: 0x000000, roughness: 1, transparent: true, opacity: 0 });
    this.pockets = [];
    [[hw, hl], [-hw, hl], [hw, -hl], [-hw, -hl], [hw, 0], [-hw, 0]].forEach(([px, pz]) => {
      const p = new THREE.Mesh(new THREE.CircleGeometry(0.17, 20), pocketMat);
      p.rotation.x = -Math.PI / 2; p.position.set(px, railY + 0.075, pz); this.group.add(p); this.pockets.push(p);
    });

    // --- ПРОЦЕДУРНЫЙ ШАР-8 (глянец, чистая «8») ---
    this.ball = new THREE.Group();
    this.group.add(this.ball);
    this.ballMesh = new THREE.Mesh(
      new THREE.SphereGeometry(BALL_R, 64, 48),
      new THREE.MeshPhysicalMaterial({ map: ballTexture(), roughness: 0.05, metalness: 0.0,
        clearcoat: 1.0, clearcoatRoughness: 0.04, transparent: true, opacity: 0 })
    );
    this.ball.add(this.ballMesh);
    this.ball.rotation.y = EIGHT_FACE_YAW;   // «8» лицом к камере
    this._ballReady = true;

    // --- СВЕТ: тёплый верхний spot + красный fill + холодный rim (глянцевые блики) ---
    this.spot = new THREE.SpotLight(0xfff2e2, 0, 28, Math.PI / 5, 0.5, 1.0);
    this.spot.position.set(0.5, 3.4, 2.2); this.spot.target.position.set(0, 0, 0);
    this.group.add(this.spot, this.spot.target);
    this.fill = new THREE.PointLight(0xcc2222, 0, 14); this.fill.position.set(-1.8, 0.8, 2.6);
    this.group.add(this.fill);
    this.rim = new THREE.PointLight(0xbfe0ff, 0, 12); this.rim.position.set(1.6, 1.4, 2.0);
    this.group.add(this.rim);

    this._spin = new THREE.Vector3(0, 0, 0);   // угловая скорость закрутки (вокруг экранных X/Y)
    this._rev = 0;
    this._sphereW = new THREE.Sphere();
    this.IDLE_RATE = 0.95;                     // быстрое авто-вращение вокруг Y (как мозг)
    this.SPIN_DAMP = 1.4;
    this.SPIN_MAX = 16;
  }

  setReveal(bk) {
    this._rev = bk;
    this.group.visible = bk > 0.02;
    if (!this.group.visible) return;
    const e = THREE.MathUtils.clamp((bk - 0.1) / 0.5, 0, 1);
    const es = e * e * (3 - 2 * e);
    this.group.scale.setScalar(0.78 + 0.22 * es);
    this.spot.intensity = 40 * es;
    this.fill.intensity = 9 * es;
    this.rim.intensity = 11 * es;
    this.felt.material.opacity = 0.96 * es;
    this.railMat.opacity = es;
    this.pockets.forEach((p) => { p.material.opacity = 0.9 * es; });
    this.ballMesh.material.opacity = es;
  }

  hit(raycaster) {
    if (!this.group.visible) return false;
    this.ball.getWorldPosition(this._sphereW.center);
    this._sphereW.radius = BALL_R * this.group.scale.x * 1.12;
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
    this.railMat.emissiveIntensity = 0.8 + Math.sin(t * 1.6) * 0.15;   // пульсация неон-борта
    // затухание закрутки + интеграция вращения (вокруг МИРОВЫХ X/Y) + быстрое авто-вращение вокруг Y
    this._spin.multiplyScalar(Math.max(0, 1 - this.SPIN_DAMP * dt));
    const ax = this._spin.x * dt;
    const ay = (this._spin.y + this.IDLE_RATE) * dt;
    if (ax) { _q.setFromAxisAngle(_X, ax); this.ball.quaternion.premultiply(_q); }
    if (ay) { _q.setFromAxisAngle(_Y, ay); this.ball.quaternion.premultiply(_q); }
  }
}
