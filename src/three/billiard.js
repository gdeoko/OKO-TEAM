import * as THREE from 'three';

// ============================================================
// СТАНЦИЯ «БИЛЬЯРД» — минимальная премиум-сцена: тёмное сукно + красный неон-борт,
// по центру вращается шар-восьмёрка (GLB). БЕЗ мини-игры/счёта (решение клиента).
// Интерактив: касание/свайп по шару ЗАКРУЧИВАЕТ его в сторону пальца, потом плавно
// замедляется до лёгкого авто-вращения. Камера на входе кренится и низко проезжает над сукном.
// API: group, setReveal(bk), setBallModel(scene), hit(raycaster), addSpin(dxPx,dyPx,vw),
//      update(t,dt,camera), spinSpeed(). hooks: { onCue() } — звук кия из main.
// ============================================================

const BALL_R = 0.42;            // радиус шара в мировых единицах
const EIGHT_FACE_YAW = Math.PI / 2;   // поворот шара, при котором «8» смотрит в камеру (+Z) — под эту GLB
const FELT_W = 3.4, FELT_L = 6.2;   // сукно (X × Z)
const RAIL = 0.16;              // толщина борта

const _q = new THREE.Quaternion();
const _X = new THREE.Vector3(1, 0, 0);
const _Y = new THREE.Vector3(0, 1, 0);

// запасной шар, если GLB не загрузился: чёрная сфера с белым кругом и «8» (canvas-текстура)
function fallbackBallTexture() {
  const S = 512, c = document.createElement('canvas'); c.width = c.height = S;
  const x = c.getContext('2d');
  x.fillStyle = '#0a0a0c'; x.fillRect(0, 0, S, S);
  x.beginPath(); x.arc(S / 2, S * 0.42, S * 0.17, 0, Math.PI * 2); x.fillStyle = '#f4f4f4'; x.fill();
  x.fillStyle = '#0a0a0c'; x.font = '700 150px Orbitron, sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle';
  x.fillText('8', S / 2, S * 0.42);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}

export class BilliardStation {
  constructor(hooks = {}) {
    this.hooks = hooks;
    this.group = new THREE.Group();
    this.group.visible = false;

    // --- СУКНО (тёмное, чуть зеленоватое) ---
    this.felt = new THREE.Mesh(
      new THREE.BoxGeometry(FELT_W, 0.22, FELT_L),
      new THREE.MeshStandardMaterial({ color: 0x0c1a14, roughness: 0.96, metalness: 0.0, transparent: true, opacity: 0 })
    );
    this.felt.position.y = -BALL_R - 0.11;
    this.group.add(this.felt);

    // --- БОРТ: красный неон-рамка вокруг сукна (4 бруска) ---
    this.railMat = new THREE.MeshStandardMaterial({ color: 0x1a0608, roughness: 0.4, metalness: 0.3,
      emissive: 0xcc0000, emissiveIntensity: 0.9, transparent: true, opacity: 0 });
    const railY = -BALL_R + 0.02;
    const mk = (w, d, x, z) => { const m = new THREE.Mesh(new THREE.BoxGeometry(w, 0.12, d), this.railMat); m.position.set(x, railY, z); this.group.add(m); return m; };
    const hw = FELT_W / 2 + RAIL / 2, hl = FELT_L / 2 + RAIL / 2;
    this.rails = [
      mk(FELT_W + RAIL * 2, RAIL, 0, hl), mk(FELT_W + RAIL * 2, RAIL, 0, -hl),
      mk(RAIL, FELT_L + RAIL * 2, hw, 0), mk(RAIL, FELT_L + RAIL * 2, -hw, 0),
    ];
    // лузы-намёки: тёмные кружки в углах
    const pocketMat = new THREE.MeshStandardMaterial({ color: 0x000000, roughness: 1, transparent: true, opacity: 0 });
    this.pockets = [];
    [[hw, hl], [-hw, hl], [hw, -hl], [-hw, -hl], [hw, 0], [-hw, 0]].forEach(([px, pz]) => {
      const p = new THREE.Mesh(new THREE.CircleGeometry(0.16, 20), pocketMat);
      p.rotation.x = -Math.PI / 2; p.position.set(px, railY + 0.065, pz); this.group.add(p); this.pockets.push(p);
    });

    // --- ШАР (контейнер; модель добавится в setBallModel, иначе запасная сфера) ---
    this.ball = new THREE.Group();
    this.group.add(this.ball);
    this._ballReady = false;

    // --- СВЕТ: тёплый верхний на шар + красный заполняющий + холодный рим (глянцевые блики) ---
    this.spot = new THREE.SpotLight(0xfff2e2, 0, 26, Math.PI / 5, 0.5, 1.0);
    this.spot.position.set(0.4, 3.2, 1.6); this.spot.target.position.set(0, 0, 0);
    this.group.add(this.spot, this.spot.target);
    this.fill = new THREE.PointLight(0xcc2222, 0, 12); this.fill.position.set(-1.6, 0.6, 2.2);
    this.group.add(this.fill);
    this.rim = new THREE.PointLight(0xbfe0ff, 0, 10); this.rim.position.set(1.4, 1.2, 1.8);   // холодный блик на чёрном глянце
    this.group.add(this.rim);

    // --- «пустотная» атмосфера: редкие искры (как на дартсе) ---
    const N = 200, pos = new Float32Array(N * 3), spd = new Float32Array(N);
    for (let i = 0; i < N; i++) {
      pos[i * 3] = (Math.random() - 0.5) * 16; pos[i * 3 + 1] = (Math.random() - 0.5) * 8; pos[i * 3 + 2] = -2 - Math.random() * 12;
      spd[i] = 0.08 + Math.random() * 0.26;
    }
    const dg = new THREE.BufferGeometry(); dg.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    this._dustSpd = spd;
    this.dust = new THREE.Points(dg, new THREE.PointsMaterial({ color: 0x9fb4cc, size: 0.03, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, sizeAttenuation: true }));
    this.group.add(this.dust);

    this._spin = new THREE.Vector3(0, 0, 0);   // угловая скорость (рад/с) вокруг экранных X (верт.драг) и Y (гориз.драг)
    this._rev = 0;
    this._sphereW = new THREE.Sphere();        // мировая сфера шара для рейкаста
    this.IDLE_RATE = 0.14;                     // медленное авто-вращение вокруг Y (8 подольше смотрит вперёд)
    this.SPIN_DAMP = 1.7;                      // затухание закрутки
    this.SPIN_MAX = 13;
  }

  setBallModel(scene) {
    const inner = scene.clone(true);
    const box = new THREE.Box3().setFromObject(inner);
    const c = box.getCenter(new THREE.Vector3());
    const size = box.getSize(new THREE.Vector3());
    inner.position.sub(c);
    const dia = Math.max(size.x, size.y, size.z) || 1;
    inner.scale.setScalar((BALL_R * 2) / dia);
    inner.traverse((o) => { if (o.isMesh && o.material) {
      o.material = o.material.clone();
      o.material.transparent = true;
      o.material.roughness = Math.min(o.material.roughness ?? 0.2, 0.12);   // глянец: яркие блики на чёрном
      o.material.metalness = 0.0;
      if ('envMapIntensity' in o.material) o.material.envMapIntensity = 1.4;
      o.castShadow = false; o.receiveShadow = false;
    } });
    this.ball.clear();
    this.ball.add(inner);
    this._ballReady = true;
    // «8» лицом к камере: у этой модели белый круг с восьмёркой выходит вперёд (+Z) поворотом
    // на +90° вокруг Y (подобрано рендером). Авто-вращение медленное → 8 подольше смотрит на зрителя.
    this.ball.rotation.set(0, EIGHT_FACE_YAW, 0);
  }

  _ensureFallbackBall() {
    if (this._ballReady) return;
    const m = new THREE.Mesh(
      new THREE.SphereGeometry(BALL_R, 48, 32),
      new THREE.MeshStandardMaterial({ map: fallbackBallTexture(), roughness: 0.18, metalness: 0.0, transparent: true, opacity: 0 })
    );
    this.ball.add(m); this._ballReady = true;
  }

  // bk — прогресс станции 0..1
  setReveal(bk) {
    this._rev = bk;
    this.group.visible = bk > 0.02;
    if (!this.group.visible) return;
    this._ensureFallbackBall();
    const e = THREE.MathUtils.clamp((bk - 0.1) / 0.5, 0, 1);
    const es = e * e * (3 - 2 * e);
    this.group.scale.setScalar(0.7 + 0.3 * es);
    this.spot.intensity = 38 * es;
    this.fill.intensity = 8 * es;
    this.rim.intensity = 9 * es;
    this.felt.material.opacity = 0.96 * es;
    this.railMat.opacity = es;
    this.pockets.forEach((p) => { p.material.opacity = 0.9 * es; });
    this.dust.material.opacity = 0.45 * es;
    this.ball.traverse((o) => { if (o.isMesh && o.material) { o.material.transparent = true; o.material.opacity = es; } });
  }

  // мировая сфера шара → пересечение с лучом (для «захвата» под закрутку)
  hit(raycaster) {
    if (!this.group.visible || !this._ballReady) return false;
    this.ball.getWorldPosition(this._sphereW.center);
    this._sphereW.radius = BALL_R * this.group.scale.x * 1.15;
    return raycaster.ray.intersectsSphere(this._sphereW);
  }

  // экранный сдвиг пальца → угловая скорость закрутки (гориз. → вокруг Y, верт. → вокруг X)
  addSpin(dxPx, dyPx, vw) {
    const k = 9.0 / (vw || 1000);             // нормируем по ширине экрана
    this._spin.y += dxPx * k;
    this._spin.x += dyPx * k;
    const L = this._spin.length();
    if (L > this.SPIN_MAX) this._spin.multiplyScalar(this.SPIN_MAX / L);
  }

  spinSpeed() { return this._spin.length(); }

  update(t, dt, camera) {
    if (!this.group.visible) return;
    // дрейф искр к камере
    const arr = this.dust.geometry.attributes.position.array;
    for (let i = 0; i < this._dustSpd.length; i++) {
      arr[i * 3 + 2] += this._dustSpd[i] * dt;
      if (arr[i * 3 + 2] > 6) { arr[i * 3 + 2] = -12; arr[i * 3] = (Math.random() - 0.5) * 16; arr[i * 3 + 1] = (Math.random() - 0.5) * 8; }
    }
    this.dust.geometry.attributes.position.needsUpdate = true;

    // лёгкая пульсация неон-борта
    this.railMat.emissiveIntensity = 0.8 + Math.sin(t * 1.6) * 0.15;

    if (!this._ballReady) return;
    // затухание закрутки + интеграция вращения (вокруг МИРОВЫХ X/Y) + авто-вращение вокруг Y
    this._spin.multiplyScalar(Math.max(0, 1 - this.SPIN_DAMP * dt));
    const ax = this._spin.x * dt;
    const ay = (this._spin.y + this.IDLE_RATE) * dt;
    if (ax) { _q.setFromAxisAngle(_X, ax); this.ball.quaternion.premultiply(_q); }
    if (ay) { _q.setFromAxisAngle(_Y, ay); this.ball.quaternion.premultiply(_q); }
  }
}
