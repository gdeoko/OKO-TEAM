import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

// ============================================================
// СТАНЦИЯ «БАР» (станция 6). Крупный реалистичный бокал по центру стойки. Игристый напиток с
// пузырьками (как шампанское) + 2 кубика льда. Бутылка СТОИТ НА СТОЙКЕ СПРАВА с реально видимым
// напитком внутри. Мини-игра «глоток»: клик → бокал плавно поднимается и наклоняется к зрителю →
// уровень падает (глоток + «ах») → ставится обратно → бутылка ПОДНИМАЕТСЯ СПРАВА, наклоняется НАД
// краем бокала (НЕ сквозь него) и доливает струёй: уровень в бутылке падает, в бокале растёт.
// tipsy 0..1 — easter egg (камера плывёт здесь, прицел в Дартсе). Без алко-лексики и стоп-слов.
// API: group, setReveal(ak), update(t,dt,camera), hitGlass(raycaster), tapGlass(raycaster).
// hooks: { onClink(), onGulp(), onSip(), onPour(), onFizz() } — звук из main.
// ============================================================

const _sphere = new THREE.Sphere();
const _wp = new THREE.Vector3(), _a = new THREE.Vector3(), _b = new THREE.Vector3(), _mid = new THREE.Vector3();
const BASE_Y = -0.5;             // высота столешницы (на ней стоят бокал и бутылка)
const GLASS_H = 0.92;            // высота бокала (крупный)
const Y_LIQ_BOT = BASE_Y + 0.12; // дно внутреннего объёма напитка
const H_LIQ = 0.60;              // макс высота столбика напитка
const R_LIQ = 0.40;              // радиус напитка
const BOTTLE_X = 1.25;           // место бутылки на стойке (справа)
const DRINK_COL = 0xe0a52e;      // цвет напитка (тёплый янтарь)

function labelTexture() {
  const W = 256, H = 320, c = document.createElement('canvas'); c.width = W; c.height = H;
  const x = c.getContext('2d');
  x.fillStyle = '#efe4c8'; x.fillRect(0, 0, W, H);
  x.strokeStyle = '#b8932f'; x.lineWidth = 8; x.strokeRect(10, 10, W - 20, H - 20);
  x.strokeStyle = 'rgba(204,0,0,0.85)'; x.lineWidth = 3; x.strokeRect(20, 20, W - 40, H - 40);
  x.fillStyle = '#cc0000'; x.fillRect(20, 36, W - 40, 34);
  x.fillStyle = '#f6efd8'; x.textAlign = 'center'; x.font = '700 22px Orbitron, "Exo 2", sans-serif';
  x.fillText("DUCK'S", W / 2, 60);
  x.font = '54px serif'; x.fillText('🦆', W / 2, 150);
  x.fillStyle = '#1a1208'; x.font = '700 18px Orbitron, "Exo 2", sans-serif';
  x.fillText('RESERVE', W / 2, 196);
  x.fillStyle = '#7a5f22'; x.font = '400 12px "Exo 2", sans-serif';
  x.fillText('клуб для своих', W / 2, 224);
  x.fillStyle = '#b8932f'; x.fillRect(W / 2 - 40, 244, 80, 3);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
  return t;
}

export class BarStation {
  constructor(isMobile = false, hooks = {}) {
    this.hooks = hooks;
    this.isMobile = isMobile;
    this.group = new THREE.Group();
    this.group.visible = false;

    this._rev = 0;
    this.tipsy = 0;
    this.level = 0.62;           // уровень в бокале 0..1
    this.bottleLevel = 0.82;     // уровень напитка В БУТЫЛКЕ 0..1
    this._state = 'idle';        // idle | lift | place | pour
    this._t = 0;
    this._fizz = 0.4;
    this._splash = 0;
    this._mats = [];

    const reg = (m, base = 1) => { m.transparent = true; m.userData._b = base; m.opacity = 0; this._mats.push(m); return m; };

    // --- СТОЙКА ---
    const top = new THREE.Mesh(
      new THREE.BoxGeometry(8.0, 0.4, 5.4),
      reg(new THREE.MeshPhysicalMaterial({ color: 0x18120d, roughness: 0.3, metalness: 0.12,
        clearcoat: 0.85, clearcoatRoughness: 0.22 }))
    );
    top.position.set(0, BASE_Y - 0.2, 1.4);
    this.group.add(top);
    const edge = new THREE.Mesh(
      new THREE.BoxGeometry(8.04, 0.035, 0.05),
      reg(new THREE.MeshStandardMaterial({ color: 0x180605, emissive: 0x7a1c0c, emissiveIntensity: 0.4 }), 0.8)
    );
    edge.position.set(0, BASE_Y - 0.005, 4.08);
    this.group.add(edge);
    const back = new THREE.Mesh(
      new THREE.PlaneGeometry(8.0, 5.0),
      reg(new THREE.MeshStandardMaterial({ color: 0x0a0708, roughness: 0.92, metalness: 0.0, side: THREE.DoubleSide }), 0.92)
    );
    back.position.set(0, 0.9, -2.8);
    this.group.add(back);

    // --- БОКАЛ (риг: поднимаем/наклоняем целиком), строго по центру X=0 ---
    this.glassRig = new THREE.Group();
    this.group.add(this.glassRig);
    const prof = [
      [0.00, 0.00], [0.450, 0.00], [0.470, 0.07], [0.466, 0.45], [0.458, 0.84],
      [0.458, 0.92], [0.412, 0.92], [0.406, 0.45], [0.400, 0.12], [0.00, 0.10],
    ].map((p) => new THREE.Vector2(p[0], p[1]));
    const glassMat = reg(new THREE.MeshPhysicalMaterial({
      color: 0xffffff, metalness: 0.0, roughness: 0.03,
      transmission: isMobile ? 0.0 : 0.96, ior: 1.46, thickness: 0.7,
      clearcoat: 1.0, clearcoatRoughness: 0.03, side: THREE.DoubleSide, envMapIntensity: 1.6,
    }), isMobile ? 0.3 : 1.0);
    this.glass = new THREE.Mesh(new THREE.LatheGeometry(prof, 64), glassMat);
    this.glass.position.y = BASE_Y;
    this.glass.renderOrder = 6; this.glass.material.depthWrite = false;
    this.glassRig.add(this.glass);

    this.liquid = new THREE.Mesh(
      new THREE.CylinderGeometry(R_LIQ, R_LIQ - 0.02, 1, 48),
      reg(new THREE.MeshPhysicalMaterial({ color: DRINK_COL, roughness: 0.14, metalness: 0.0,
        clearcoat: 0.5, transmission: isMobile ? 0.0 : 0.35, ior: 1.34, thickness: 0.5,
        emissive: 0x4a2e06, emissiveIntensity: 0.4 }), 0.95)
    );
    this.liquid.renderOrder = 3; this.glassRig.add(this.liquid);
    this.surface = new THREE.Mesh(
      new THREE.CircleGeometry(R_LIQ, 48),
      reg(new THREE.MeshStandardMaterial({ color: 0xf4bd52, emissive: 0x7a4708, emissiveIntensity: 0.6,
        roughness: 0.08, metalness: 0.25, side: THREE.DoubleSide }), 0.96)
    );
    this.surface.rotation.x = -Math.PI / 2; this.surface.renderOrder = 4; this.glassRig.add(this.surface);

    // --- ПУЗЫРЬКИ ---
    const NB = isMobile ? 80 : 150; this._NB = NB;
    this._bx = new Float32Array(NB); this._bz = new Float32Array(NB);
    this._by = new Float32Array(NB); this._bspd = new Float32Array(NB); this._bph = new Float32Array(NB);
    const bpos = new Float32Array(NB * 3), bsz = new Float32Array(NB);
    for (let i = 0; i < NB; i++) {
      const r = Math.sqrt(Math.random()) * (R_LIQ - 0.04), a = Math.random() * Math.PI * 2;
      this._bx[i] = Math.cos(a) * r; this._bz[i] = Math.sin(a) * r;
      this._by[i] = Math.random();
      this._bspd[i] = 0.12 + Math.random() * 0.3;
      this._bph[i] = Math.random() * Math.PI * 2;
      bsz[i] = 1.6 + Math.random() * 3.0;
      bpos[i * 3] = this._bx[i]; bpos[i * 3 + 2] = this._bz[i];
    }
    const bg = new THREE.BufferGeometry();
    bg.setAttribute('position', new THREE.BufferAttribute(bpos, 3));
    bg.setAttribute('aSize', new THREE.BufferAttribute(bsz, 1));
    this.bubbleMat = new THREE.ShaderMaterial({
      uniforms: { uOpacity: { value: 0 }, uPix: { value: isMobile ? 70 : 100 } },
      transparent: true, depthWrite: false, depthTest: true, blending: THREE.AdditiveBlending,
      vertexShader: `attribute float aSize; uniform float uPix;
        void main(){ vec4 mv = modelViewMatrix * vec4(position,1.0);
        gl_PointSize = aSize * uPix / max(-mv.z, 0.1); gl_Position = projectionMatrix * mv; }`,
      fragmentShader: `uniform float uOpacity;
        void main(){ vec2 uv = gl_PointCoord - 0.5; float d = length(uv);
        float a = smoothstep(0.5, 0.15, d); a *= 0.5 + 0.5 * smoothstep(0.5, 0.18, d);
        gl_FragColor = vec4(vec3(1.0, 0.92, 0.7), a * uOpacity); }`,
    });
    this.bubbles = new THREE.Points(bg, this.bubbleMat);
    this.bubbles.renderOrder = 5; this.bubbles.frustumCulled = false; this.glassRig.add(this.bubbles);

    // --- 2 КУБИКА ЛЬДА ---
    const iceMat = () => reg(new THREE.MeshPhysicalMaterial({ color: 0xeaf6ff, roughness: 0.06, metalness: 0.0,
      transmission: isMobile ? 0.0 : 0.85, ior: 1.31, thickness: 0.3, clearcoat: 1.0, side: THREE.DoubleSide }), isMobile ? 0.4 : 0.85);
    this.ice = []; const iceGeo = new RoundedBoxGeometry(0.24, 0.24, 0.24, 3, 0.05);
    for (let i = 0; i < 2; i++) {
      const cube = new THREE.Mesh(iceGeo, iceMat());
      cube.rotation.set(Math.random(), Math.random(), Math.random()); cube.renderOrder = 4;
      cube.userData = { ox: i === 0 ? -0.12 : 0.13, oz: i === 0 ? 0.09 : -0.1, spin: 0.2 + Math.random() * 0.3 };
      this.glassRig.add(cube); this.ice.push(cube);
    }

    this._applyLevel();

    // --- БУТЫЛКА на стойке СПРАВА (реально виден напиток внутри) ---
    this.bottlePivot = new THREE.Group();          // вращаем/двигаем от ОСНОВАНИЯ
    this.bottlePivot.position.set(BOTTLE_X, BASE_Y, 0.2);
    this.group.add(this.bottlePivot);
    // прозрачноватое стекло — чтобы был виден столбик напитка
    const bottleGlass = reg(new THREE.MeshPhysicalMaterial({ color: 0x16352a, roughness: 0.08, metalness: 0.0,
      transmission: isMobile ? 0.0 : 0.72, ior: 1.45, thickness: 0.4,
      clearcoat: 1.0, clearcoatRoughness: 0.06, side: THREE.DoubleSide }), isMobile ? 0.5 : 0.95);
    bottleGlass.depthWrite = false;
    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.95, 40), bottleGlass);
    body.position.y = 0.47; body.renderOrder = 7; this.bottlePivot.add(body);
    const shoulder = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.2, 0.26, 40), bottleGlass);
    shoulder.position.y = 1.07; shoulder.renderOrder = 7; this.bottlePivot.add(shoulder);
    const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.062, 0.075, 0.4, 28), bottleGlass);
    neck.position.y = 1.38; neck.renderOrder = 7; this.bottlePivot.add(neck);
    const cork = new THREE.Mesh(new THREE.CylinderGeometry(0.066, 0.062, 0.12, 22),
      reg(new THREE.MeshStandardMaterial({ color: 0x3a2a16, roughness: 0.85 }), 1));
    cork.position.y = 1.62; this.bottlePivot.add(cork);
    const label = new THREE.Mesh(
      new THREE.CylinderGeometry(0.202, 0.202, 0.5, 40, 1, true, -0.7, 1.4),
      reg(new THREE.MeshStandardMaterial({ map: labelTexture(), roughness: 0.5, metalness: 0.0, side: THREE.DoubleSide }), 1)
    );
    label.position.y = 0.48; this.bottlePivot.add(label);
    // НАПИТОК ВНУТРИ БУТЫЛКИ (виден сквозь стекло, убывает при наливе)
    this._bBot = 0.05; this._bTop = 0.9;            // диапазон столбика внутри тела бутылки
    this.bottleLiquid = new THREE.Mesh(
      new THREE.CylinderGeometry(0.17, 0.17, 1, 32),
      reg(new THREE.MeshStandardMaterial({ color: DRINK_COL, roughness: 0.25, metalness: 0.0,
        emissive: 0x3a2406, emissiveIntensity: 0.35 }), 0.98)
    );
    this.bottleLiquid.renderOrder = 6; this.bottlePivot.add(this.bottleLiquid);
    this.mouth = new THREE.Object3D(); this.mouth.position.set(0, 1.58, 0); this.bottlePivot.add(this.mouth);
    this._applyBottleLevel();

    // струя налива (тонкая, тёплая)
    this.stream = new THREE.Mesh(
      new THREE.CylinderGeometry(0.018, 0.03, 1, 12),
      new THREE.MeshStandardMaterial({ color: 0xeab44a, emissive: 0x7a4708, emissiveIntensity: 0.9,
        roughness: 0.2, transparent: true, opacity: 0, depthWrite: false })
    );
    this.stream.visible = false; this.stream.renderOrder = 7; this.group.add(this.stream);
    this.splashRing = new THREE.Mesh(
      new THREE.RingGeometry(0.07, 0.16, 28),
      new THREE.MeshBasicMaterial({ color: 0xffd98a, transparent: true, opacity: 0, side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending })
    );
    this.splashRing.rotation.x = -Math.PI / 2; this.splashRing.renderOrder = 6; this.glassRig.add(this.splashRing);

    // --- СВЕТ ---
    this.spot = new THREE.SpotLight(0xffdcae, 0, 22, Math.PI / 5, 0.5, 1.0);
    this.spot.position.set(0.2, 3.0, 2.6); this.spot.target.position.set(0, BASE_Y + 0.3, 0);
    this.group.add(this.spot, this.spot.target);
    this.fill = new THREE.PointLight(0xcc3318, 0, 14); this.fill.position.set(-2.0, 0.4, 2.6);
    this.group.add(this.fill);
    this.rim = new THREE.PointLight(0xbfe0ff, 0, 12); this.rim.position.set(2.0, 1.3, -0.5);
    this.group.add(this.rim);
    this.warm = new THREE.PointLight(0xffb060, 0, 11); this.warm.position.set(0, BASE_Y + 0.6, 0.8);
    this.group.add(this.warm);
    this.spark = new THREE.PointLight(0xfff0d0, 0, 5); this.spark.position.set(-0.2, BASE_Y + 0.3, -0.3);
    this.group.add(this.spark);
  }

  _applyLevel() {
    const h = Math.max(0.0001, this.level) * H_LIQ;
    this.liquid.scale.y = h;
    this.liquid.position.set(0, Y_LIQ_BOT + h / 2, 0);
    this.surface.position.set(0, Y_LIQ_BOT + h, 0);
    this.surface.visible = this.level > 0.02;
    if (this.ice) for (const cube of this.ice) {
      cube.visible = this.level > 0.12;
      cube.position.set(cube.userData.ox, Y_LIQ_BOT + Math.max(h - 0.08, 0.1), cube.userData.oz);
    }
    if (this.splashRing) this.splashRing.position.y = Y_LIQ_BOT + h + 0.002;
  }

  _applyBottleLevel() {
    const h = Math.max(0.0001, this.bottleLevel) * (this._bTop - this._bBot);
    this.bottleLiquid.scale.y = h;
    this.bottleLiquid.position.set(0, this._bBot + h / 2, 0);
    this.bottleLiquid.visible = this.bottleLevel > 0.02;
  }

  setReveal(ak) {
    this._rev = ak;
    this.group.visible = ak > 0.02;
    if (!this.group.visible) return;
    const e = THREE.MathUtils.clamp((ak - 0.06) / 0.55, 0, 1);
    const es = e * e * (3 - 2 * e);
    this.group.scale.setScalar(0.95 + 0.05 * es);
    for (const m of this._mats) m.opacity = (m.userData._b || 1) * es;
    this.bubbleMat.uniforms.uOpacity.value = 0.85 * es;
    this.spot.intensity = 34 * es; this.fill.intensity = 8 * es;
    this.rim.intensity = 11 * es; this.warm.intensity = 7 * es; this.spark.intensity = 4 * es;
  }

  hitGlass(raycaster) {
    if (!this.group.visible || this._rev < 0.25) return false;
    this.glassRig.getWorldPosition(_sphere.center);
    _sphere.center.y += (BASE_Y + GLASS_H * 0.5) * this.group.scale.y;
    _sphere.radius = 0.85 * this.group.scale.y;
    return raycaster.ray.intersectsSphere(_sphere);
  }

  tapGlass(raycaster) {
    if (this._state !== 'idle' || this._rev < 0.3) return false;
    if (!this.hitGlass(raycaster)) return false;
    this._state = 'lift'; this._t = 0; this._sipFrom = this.level; this._gulped = false;
    if (this.hooks.onClink) this.hooks.onClink();
    return true;
  }

  // поза бутылки при наливе (k 0..1). Бутылка поднимается СПРАВА, наклоняется НАД краем бокала,
  // горлышко оказывается над поверхностью напитка. Возвращает true, если в этот момент льётся.
  _pourPose(k) {
    const up = THREE.MathUtils.smoothstep(k, 0.0, 0.28);
    const down = 1 - THREE.MathUtils.smoothstep(k, 0.72, 1.0);
    const env = Math.min(up, down);                       // трапеция 0→1→1→0
    const e = env * env * (3 - 2 * env);
    // основание уходит вправо-вверх, горлышко (длинное плечо) наклоняется НАД центром бокала
    this.bottlePivot.position.x = THREE.MathUtils.lerp(BOTTLE_X, 1.5, e);
    this.bottlePivot.position.y = BASE_Y + 0.85 * e;
    this.bottlePivot.position.z = THREE.MathUtils.lerp(0.2, 0.0, e);
    this.bottlePivot.rotation.z = 1.15 * e;                                  // наклон горлышком к бокалу (влево-вниз)
    return env > 0.92 && k > 0.34 && k < 0.74;
  }

  // статичная поза налива (для скриншота/проверки): ставит бутылку и струю на прогрессе k
  debugPour(k = 0.5) {
    this.level = 0.45; this.bottleLevel = 0.5; this._applyLevel(); this._applyBottleLevel();
    const pouring = this._pourPose(k);
    if (pouring) {
      this.mouth.getWorldPosition(_wp); this.group.worldToLocal(_a.copy(_wp));
      _b.set(0, Y_LIQ_BOT + this.level * H_LIQ + 0.02, 0);
      _mid.copy(_a).add(_b).multiplyScalar(0.5);
      this.stream.position.copy(_mid); this.stream.scale.set(1, _a.distanceTo(_b), 1);
      this.stream.lookAt(this.group.localToWorld(_b.clone())); this.stream.rotateX(Math.PI / 2);
      this.stream.material.opacity = 0.9; this.stream.visible = true;
    }
    return pouring;
  }

  update(t, dt, camera) {
    const decay = this._rev > 0.4 ? 0.05 : 0.5;
    this.tipsy = Math.max(0, this.tipsy - decay * dt);
    if (!this.group.visible) return;
    this._fizz = Math.max(0.4, this._fizz - dt * 0.6);
    this._splash = Math.max(0, this._splash - dt * 3.2);

    const rig = this.glassRig; this._t += dt;

    if (this._state === 'lift') {
      const k = Math.min(1, this._t / 0.72), e = k * k * (3 - 2 * k);
      rig.position.set(0, 0.5 * e, 0.78 * e);
      rig.rotation.x = 0.5 * e;
      if (k > 0.42) {
        if (!this._gulped) { this._gulped = true; if (this.hooks.onGulp) this.hooks.onGulp(); }
        const sip = THREE.MathUtils.smoothstep((k - 0.42) / 0.5, 0, 1);
        this.level = Math.max(0, this._sipFrom - 0.34 * sip); this._applyLevel();
      }
      if (k >= 1) {
        this.tipsy = Math.min(1, this.tipsy + 0.2);
        if (this.hooks.onSip) this.hooks.onSip();
        this._state = 'place'; this._t = 0;
      }
    } else if (this._state === 'place') {
      const k = Math.min(1, this._t / 0.55), e = k * k * (3 - 2 * k);
      const settle = k > 0.85 ? Math.sin((k - 0.85) / 0.15 * Math.PI) * 0.025 : 0;
      rig.position.set(0, 0.5 * (1 - e) + settle, 0.78 * (1 - e));
      rig.rotation.x = 0.5 * (1 - e);
      if (k >= 1) {
        rig.position.set(0, 0, 0); rig.rotation.x = 0;
        if (this.level < 0.5 && this.bottleLevel > 0.06) { this._state = 'pour'; this._t = 0; this._fizzed = false; if (this.hooks.onPour) this.hooks.onPour(); }
        else this._state = 'idle';
      }
    } else if (this._state === 'pour') {
      const dur = 1.5, k = Math.min(1, this._t / dur);
      const pouring = this._pourPose(k);
      this.stream.visible = pouring;
      if (pouring) {
        this.level = Math.min(1, this.level + dt * 0.7);
        this.bottleLevel = Math.max(0, this.bottleLevel - dt * 0.5);   // напиток В БУТЫЛКЕ убывает
        this._applyLevel(); this._applyBottleLevel();
        this._fizz = Math.min(2.2, this._fizz + dt * 4.0); this._splash = 1;
        if (!this._fizzed) { this._fizzed = true; if (this.hooks.onFizz) this.hooks.onFizz(); }
        // струя: горлышко бутылки → поверхность напитка в бокале
        this.mouth.getWorldPosition(_wp); this.group.worldToLocal(_a.copy(_wp));
        _b.set(0, Y_LIQ_BOT + this.level * H_LIQ + 0.02, 0);
        _mid.copy(_a).add(_b).multiplyScalar(0.5);
        this.stream.position.copy(_mid);
        this.stream.scale.set(1, _a.distanceTo(_b), 1);
        this.stream.lookAt(this.group.localToWorld(_b.clone()));
        this.stream.rotateX(Math.PI / 2);
        this.stream.material.opacity = 0.9;
      } else { this.stream.material.opacity = 0; }
      if (k >= 1) {
        this._pourPose(1);   // вернуть бутылку на стойку справа (env=0 на k=1)
        this.bottlePivot.rotation.z = 0; this.bottlePivot.position.set(BOTTLE_X, BASE_Y, 0.2);
        this.stream.visible = false; this._state = 'idle';
      }
    }

    // ПУЗЫРЬКИ
    const bpos = this.bubbles.geometry.attributes.position.array;
    const topY = this.level * H_LIQ; const rate = 0.5 + this._fizz * 0.5;
    for (let i = 0; i < this._NB; i++) {
      this._by[i] += this._bspd[i] * rate * dt;
      if (this._by[i] * H_LIQ > topY) this._by[i] = Math.random() * 0.05;
      const yy = this._by[i] * H_LIQ;
      bpos[i * 3] = this._bx[i] + Math.sin(t * 2.4 + this._bph[i]) * 0.006 * (0.5 + yy);
      bpos[i * 3 + 1] = Y_LIQ_BOT + yy;
      bpos[i * 3 + 2] = this._bz[i] + Math.cos(t * 2.1 + this._bph[i]) * 0.006;
    }
    this.bubbles.geometry.attributes.position.needsUpdate = true;
    this.bubbleMat.uniforms.uOpacity.value = (0.5 + 0.4 * Math.min(1, this._fizz)) * THREE.MathUtils.clamp((this._rev - 0.06) / 0.55, 0, 1);

    if (this.surface.visible) {
      const rip = 1 + this._splash * 0.05 * Math.sin(t * 26);
      this.surface.scale.set(rip, rip, 1);
      this.surface.material.emissiveIntensity = 0.5 + Math.sin(t * 2.0) * 0.12 + this._splash * 0.5;
    }
    if (this.splashRing) {
      this.splashRing.material.opacity = this._splash * 0.7;
      const s = 1 + (1 - this._splash) * 1.6; this.splashRing.scale.set(s, s, s);
    }
    if (this.ice) for (const cube of this.ice) { cube.rotation.y += dt * cube.userData.spin; cube.rotation.x += dt * cube.userData.spin * 0.4; }
  }
}
