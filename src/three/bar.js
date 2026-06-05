import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

// ============================================================
// СТАНЦИЯ «БАР» (станция 6) — БЕЗ движения камеры. Барная стойка ПРОЯВЛЯЕТСЯ из темноты
// космоса прямо в кадре. Реалистичный бокал (профиль-лате, толстое стекло, преломление),
// игристый напиток с ПУЗЫРЬКАМИ (как шампанское), 2 кубика льда, сзади из темноты —
// красивая бутылка. Мини-игра «глоток»: клик → бокал плавно поднимается и наклоняется к
// зрителю → уровень падает (глоток + «ах») → ставится обратно → бутылка наклоняется по дуге
// и ДОЛИВАЕТ реалистичной струёй с всплеском и рябью. Каждый «глоток» повышает `tipsy` (0..1) —
// easter egg: «перебрал» → камера слегка плывёт здесь, а в Дартсе плывёт прицел.
// Бокал строго по центру (x=0), все объекты ровные. Без алко-лексики и стоп-слов.
// API: group, setReveal(ak), update(t,dt,camera), hitGlass(raycaster), tapGlass(raycaster).
// hooks: { onClink(), onGulp(), onSip(), onPour(), onFizz(), onIce() } — звук из main.
// ============================================================

const _sphere = new THREE.Sphere();
const _wp = new THREE.Vector3(), _a = new THREE.Vector3(), _b = new THREE.Vector3(), _mid = new THREE.Vector3();
const BASE_Y = -0.45;            // высота столешницы (на ней стоят бокал и бутылка) — бокал в центре кадра
const GLASS_H = 0.62;            // высота бокала
const Y_LIQ_BOT = BASE_Y + 0.07; // дно внутреннего объёма напитка
const H_LIQ = 0.40;              // макс высота столбика напитка (не до краёв)
const R_LIQ = 0.262;             // радиус напитка

// процедурная этикетка бутылки (бренд: тёмное стекло, золото/красный акцент, утка-метка)
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
    this.level = 0.66;          // уровень напитка 0..1
    this._state = 'idle';       // idle | lift | place | pour
    this._t = 0;
    this._fizz = 0.4;           // интенсивность пузырьков (растёт при наливе, спадает)
    this._splash = 0;           // импульс всплеска при наливе
    this._mats = [];

    const reg = (m, base = 1) => { m.transparent = true; m.userData._b = base; m.opacity = 0; this._mats.push(m); return m; };

    // --- СТОЙКА (тёмная глянцевая столешница) ---
    const top = new THREE.Mesh(
      new THREE.BoxGeometry(7.2, 0.34, 5.0),
      reg(new THREE.MeshPhysicalMaterial({ color: 0x18120d, roughness: 0.3, metalness: 0.12,
        clearcoat: 0.85, clearcoatRoughness: 0.22 }))
    );
    top.position.set(0, BASE_Y - 0.17, 1.25);
    this.group.add(top);
    // тёплая мягкая «жила» по переднему канту (не неон)
    const edge = new THREE.Mesh(
      new THREE.BoxGeometry(7.24, 0.03, 0.05),
      reg(new THREE.MeshStandardMaterial({ color: 0x180605, emissive: 0x7a1c0c, emissiveIntensity: 0.4 }), 0.8)
    );
    edge.position.set(0, BASE_Y - 0.005, 3.74);
    this.group.add(edge);
    // задняя барная стенка (тёмная, чтобы бутылка читалась силуэтом)
    const back = new THREE.Mesh(
      new THREE.PlaneGeometry(7.2, 4.4),
      reg(new THREE.MeshStandardMaterial({ color: 0x0a0708, roughness: 0.92, metalness: 0.0, side: THREE.DoubleSide }), 0.92)
    );
    back.position.set(0, 0.8, -2.6);
    this.group.add(back);

    // --- БОКАЛ (риг: поднимаем/наклоняем целиком), строго по центру X=0 ---
    this.glassRig = new THREE.Group();
    this.group.add(this.glassRig);

    // реалистичное толстое стекло: профиль-лате (дно + стенки + ободок + внутренняя полость)
    const prof = [
      [0.00, 0.00], [0.300, 0.00], [0.315, 0.05], [0.312, 0.30], [0.306, 0.56],
      [0.306, 0.62], [0.276, 0.62], [0.272, 0.30], [0.268, 0.085], [0.00, 0.07],
    ].map((p) => new THREE.Vector2(p[0], p[1]));
    const glassMat = reg(new THREE.MeshPhysicalMaterial({
      color: 0xffffff, metalness: 0.0, roughness: 0.03,
      transmission: isMobile ? 0.0 : 0.96, ior: 1.46, thickness: 0.6,
      clearcoat: 1.0, clearcoatRoughness: 0.03, side: THREE.DoubleSide, envMapIntensity: 1.6,
    }), isMobile ? 0.30 : 1.0);
    this.glass = new THREE.Mesh(new THREE.LatheGeometry(prof, 56), glassMat);
    this.glass.position.y = BASE_Y;
    this.glass.renderOrder = 6;
    this.glass.material.depthWrite = false;
    this.glassRig.add(this.glass);

    // напиток (тёплый игристый янтарь; высота = level)
    this.liquid = new THREE.Mesh(
      new THREE.CylinderGeometry(R_LIQ, R_LIQ - 0.012, 1, 40),
      reg(new THREE.MeshPhysicalMaterial({ color: 0xe0a52e, roughness: 0.14, metalness: 0.0,
        clearcoat: 0.5, transmission: isMobile ? 0.0 : 0.35, ior: 1.34, thickness: 0.4,
        emissive: 0x4a2e06, emissiveIntensity: 0.4 }), 0.95)
    );
    this.liquid.renderOrder = 3;
    this.glassRig.add(this.liquid);
    // поверхность напитка (мениск-блик + рябь при наливе)
    this.surface = new THREE.Mesh(
      new THREE.CircleGeometry(R_LIQ, 40),
      reg(new THREE.MeshStandardMaterial({ color: 0xf4bd52, emissive: 0x7a4708, emissiveIntensity: 0.6,
        roughness: 0.08, metalness: 0.25, side: THREE.DoubleSide }), 0.96)
    );
    this.surface.rotation.x = -Math.PI / 2;
    this.surface.renderOrder = 4;
    this.glassRig.add(this.surface);

    // --- ПУЗЫРЬКИ (как в шампанском): поднимаются со дна к поверхности, петля ---
    const NB = isMobile ? 70 : 130; this._NB = NB;
    this._bx = new Float32Array(NB); this._bz = new Float32Array(NB);
    this._by = new Float32Array(NB); this._bspd = new Float32Array(NB); this._bph = new Float32Array(NB);
    const bpos = new Float32Array(NB * 3), bsz = new Float32Array(NB);
    for (let i = 0; i < NB; i++) {
      const r = Math.sqrt(Math.random()) * (R_LIQ - 0.03), a = Math.random() * Math.PI * 2;
      this._bx[i] = Math.cos(a) * r; this._bz[i] = Math.sin(a) * r;
      this._by[i] = Math.random();                 // 0..1 доля высоты столбика
      this._bspd[i] = 0.12 + Math.random() * 0.3;
      this._bph[i] = Math.random() * Math.PI * 2;
      bsz[i] = 1.4 + Math.random() * 2.6;
      bpos[i * 3] = this._bx[i]; bpos[i * 3 + 2] = this._bz[i];
    }
    const bg = new THREE.BufferGeometry();
    bg.setAttribute('position', new THREE.BufferAttribute(bpos, 3));
    bg.setAttribute('aSize', new THREE.BufferAttribute(bsz, 1));
    this.bubbleMat = new THREE.ShaderMaterial({
      uniforms: { uOpacity: { value: 0 }, uPix: { value: isMobile ? 60 : 90 } },
      transparent: true, depthWrite: false, depthTest: true, blending: THREE.AdditiveBlending,
      vertexShader: `attribute float aSize; uniform float uPix; varying float vY;
        void main(){ vY = position.y; vec4 mv = modelViewMatrix * vec4(position,1.0);
        gl_PointSize = aSize * uPix / max(-mv.z, 0.1); gl_Position = projectionMatrix * mv; }`,
      fragmentShader: `uniform float uOpacity; varying float vY;
        void main(){ vec2 uv = gl_PointCoord - 0.5; float d = length(uv);
        float a = smoothstep(0.5, 0.15, d);          // мягкий шарик
        a *= 0.5 + 0.5 * smoothstep(0.5, 0.18, d);   // светлый ободок
        gl_FragColor = vec4(vec3(1.0, 0.92, 0.7), a * uOpacity); }`,
    });
    this.bubbles = new THREE.Points(bg, this.bubbleMat);
    this.bubbles.renderOrder = 5; this.bubbles.frustumCulled = false;
    this.glassRig.add(this.bubbles);

    // --- 2 КУБИКА ЛЬДА (скруглённые, прозрачные, плавают у поверхности) ---
    const iceMat = () => reg(new THREE.MeshPhysicalMaterial({ color: 0xeaf6ff, roughness: 0.06, metalness: 0.0,
      transmission: isMobile ? 0.0 : 0.85, ior: 1.31, thickness: 0.3, clearcoat: 1.0,
      side: THREE.DoubleSide }), isMobile ? 0.4 : 0.85);
    this.ice = [];
    const iceGeo = new RoundedBoxGeometry(0.17, 0.17, 0.17, 3, 0.035);
    for (let i = 0; i < 2; i++) {
      const cube = new THREE.Mesh(iceGeo, iceMat());
      cube.rotation.set(Math.random(), Math.random(), Math.random());
      cube.renderOrder = 4;
      cube.userData = { ox: i === 0 ? -0.085 : 0.09, oz: i === 0 ? 0.06 : -0.07, ph: Math.random() * 6, spin: 0.2 + Math.random() * 0.3 };
      this.glassRig.add(cube); this.ice.push(cube);
    }

    this._applyLevel();

    // --- БУТЫЛКА (тёмное стекло, золотой блик, бренд-этикетка) — на оси X=0, наклоняется от основания ---
    this.bottlePivot = new THREE.Group();           // точка вращения у основания бутылки
    this.bottlePivot.position.set(0, BASE_Y, -1.45);
    this.group.add(this.bottlePivot);
    this._bottleHome = { z: -1.45, x: 0 };
    const glassB = reg(new THREE.MeshPhysicalMaterial({ color: 0x0c1f14, roughness: 0.1, metalness: 0.0,
      transmission: isMobile ? 0.0 : 0.4, ior: 1.45, thickness: 0.5,
      clearcoat: 1.0, clearcoatRoughness: 0.07, side: THREE.DoubleSide }), 0.96);
    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.185, 0.185, 0.86, 36), glassB);
    body.position.y = 0.43; this.bottlePivot.add(body);
    const shoulder = new THREE.Mesh(new THREE.CylinderGeometry(0.072, 0.185, 0.24, 36), glassB);
    shoulder.position.y = 0.98; this.bottlePivot.add(shoulder);
    const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.072, 0.34, 28), glassB);
    neck.position.y = 1.24; this.bottlePivot.add(neck);
    const cork = new THREE.Mesh(new THREE.CylinderGeometry(0.064, 0.06, 0.1, 22),
      reg(new THREE.MeshStandardMaterial({ color: 0x3a2a16, roughness: 0.85 }), 1));
    cork.position.y = 1.45; this.bottlePivot.add(cork);
    const label = new THREE.Mesh(
      new THREE.CylinderGeometry(0.187, 0.187, 0.46, 36, 1, true, -0.7, 1.4),
      reg(new THREE.MeshStandardMaterial({ map: labelTexture(), roughness: 0.5, metalness: 0.0, side: THREE.DoubleSide }), 1)
    );
    label.position.y = 0.44; this.bottlePivot.add(label);
    this.mouth = new THREE.Object3D(); this.mouth.position.set(0, 1.42, 0); this.bottlePivot.add(this.mouth);

    // струя налива (тонкая, тёплая, с блеском) — видна только в фазе pour
    this.stream = new THREE.Mesh(
      new THREE.CylinderGeometry(0.016, 0.024, 1, 10),
      new THREE.MeshStandardMaterial({ color: 0xeab44a, emissive: 0x7a4708, emissiveIntensity: 0.9,
        roughness: 0.2, transparent: true, opacity: 0, depthWrite: false })
    );
    this.stream.visible = false; this.stream.renderOrder = 6;
    this.group.add(this.stream);
    // кольцо-всплеск на поверхности
    this.splashRing = new THREE.Mesh(
      new THREE.RingGeometry(0.05, 0.12, 24),
      new THREE.MeshBasicMaterial({ color: 0xffd98a, transparent: true, opacity: 0, side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending })
    );
    this.splashRing.rotation.x = -Math.PI / 2; this.splashRing.renderOrder = 6;
    this.glassRig.add(this.splashRing);

    // --- СВЕТ: тёплый ключевой spot + красный fill + холодный rim-блик на стекле ---
    this.spot = new THREE.SpotLight(0xffdcae, 0, 18, Math.PI / 5, 0.5, 1.0);
    this.spot.position.set(0.3, 2.7, 2.4); this.spot.target.position.set(0, BASE_Y + 0.25, 0);
    this.group.add(this.spot, this.spot.target);
    this.fill = new THREE.PointLight(0xcc3318, 0, 12); this.fill.position.set(-1.7, 0.3, 2.3);
    this.group.add(this.fill);
    this.rim = new THREE.PointLight(0xbfe0ff, 0, 10); this.rim.position.set(1.7, 1.1, -0.5);
    this.group.add(this.rim);
    this.warm = new THREE.PointLight(0xffb060, 0, 9); this.warm.position.set(0, BASE_Y + 0.5, 0.6);
    this.group.add(this.warm);
    // блик-точка позади стекла (искра преломления)
    this.spark = new THREE.PointLight(0xfff0d0, 0, 4); this.spark.position.set(-0.15, BASE_Y + 0.2, -0.25);
    this.group.add(this.spark);
  }

  // уровень → высота столбика, поверхность, кубики льда плавают на поверхности
  _applyLevel() {
    const h = Math.max(0.0001, this.level) * H_LIQ;
    this.liquid.scale.y = h;
    this.liquid.position.set(0, Y_LIQ_BOT + h / 2, 0);
    this.surface.position.set(0, Y_LIQ_BOT + h, 0);
    this.surface.visible = this.level > 0.02;
    if (this.ice) for (const cube of this.ice) {
      cube.visible = this.level > 0.12;
      cube.position.x = cube.userData.ox; cube.position.z = cube.userData.oz;
      cube.position.y = Y_LIQ_BOT + Math.max(h - 0.05, 0.07);
    }
    if (this.splashRing) this.splashRing.position.y = Y_LIQ_BOT + h + 0.002;
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
    this.spot.intensity = 30 * es;
    this.fill.intensity = 7 * es;
    this.rim.intensity = 10 * es;
    this.warm.intensity = 6 * es;
    this.spark.intensity = 3.2 * es;
  }

  hitGlass(raycaster) {
    if (!this.group.visible || this._rev < 0.25) return false;
    this.glassRig.getWorldPosition(_sphere.center);
    _sphere.center.y += (BASE_Y + GLASS_H * 0.5) * this.group.scale.y;
    _sphere.radius = 0.62 * this.group.scale.y;
    return raycaster.ray.intersectsSphere(_sphere);
  }

  tapGlass(raycaster) {
    if (this._state !== 'idle' || this._rev < 0.3) return false;
    if (!this.hitGlass(raycaster)) return false;
    this._state = 'lift'; this._t = 0; this._sipFrom = this.level; this._gulped = false;
    if (this.hooks.onClink) this.hooks.onClink();
    return true;
  }

  update(t, dt, camera) {
    const decay = this._rev > 0.4 ? 0.05 : 0.5;
    this.tipsy = Math.max(0, this.tipsy - decay * dt);
    if (!this.group.visible) return;
    this._fizz = Math.max(0.4, this._fizz - dt * 0.6);   // газация спадает к спокойной базе
    this._splash = Math.max(0, this._splash - dt * 3.2);

    const rig = this.glassRig;
    this._t += dt;

    if (this._state === 'lift') {
      const k = Math.min(1, this._t / 0.7), e = k * k * (3 - 2 * k);
      rig.position.set(0, 0.42 * e, 0.62 * e);     // плавный подъём к зрителю
      rig.rotation.x = 0.5 * e;                    // умеренный наклон (напиток не «выливается»)
      if (k > 0.42) {
        if (!this._gulped) { this._gulped = true; if (this.hooks.onGulp) this.hooks.onGulp(); }
        const sip = THREE.MathUtils.smoothstep((k - 0.42) / 0.5, 0, 1);
        this.level = Math.max(0, this._sipFrom - 0.34 * sip);
        this._applyLevel();
      }
      if (k >= 1) {
        this.tipsy = Math.min(1, this.tipsy + 0.2);
        if (this.hooks.onSip) this.hooks.onSip();
        this._state = 'place'; this._t = 0;
      }
    } else if (this._state === 'place') {
      const k = Math.min(1, this._t / 0.55), e = k * k * (3 - 2 * k);
      // лёгкий доводочный «оседающий» отскок на постановке
      const settle = k > 0.85 ? Math.sin((k - 0.85) / 0.15 * Math.PI) * 0.02 : 0;
      rig.position.set(0, 0.42 * (1 - e) + settle, 0.62 * (1 - e));
      rig.rotation.x = 0.5 * (1 - e);
      if (k >= 1) {
        rig.position.set(0, 0, 0); rig.rotation.x = 0;
        if (this.level < 0.45) { this._state = 'pour'; this._t = 0; if (this.hooks.onPour) this.hooks.onPour(); }
        else this._state = 'idle';
      }
    } else if (this._state === 'pour') {
      const dur = 1.35, k = Math.min(1, this._t / dur);
      const lean = Math.sin(Math.min(k, 1) * Math.PI);             // 0→1→0
      this.bottlePivot.position.z = THREE.MathUtils.lerp(this._bottleHome.z, -0.34, lean);
      this.bottlePivot.rotation.x = 1.15 * lean;                   // наклон от основания (горлышко над бокалом)
      const pouring = k > 0.2 && k < 0.84;
      this.stream.visible = pouring;
      if (pouring) {
        this.level = Math.min(1, this.level + dt * 0.85);
        this._applyLevel();
        this._fizz = Math.min(2.2, this._fizz + dt * 4.0);         // свежий налив — сильная газация
        this._splash = 1;
        if (!this._fizzed) { this._fizzed = true; if (this.hooks.onFizz) this.hooks.onFizz(); }
        // струя горлышко → поверхность (слегка тоньше у горлышка, как реальная струйка)
        this.mouth.getWorldPosition(_wp); this.group.worldToLocal(_a.copy(_wp));
        _b.set(0, Y_LIQ_BOT + this.level * H_LIQ + 0.02, 0);
        _mid.copy(_a).add(_b).multiplyScalar(0.5);
        this.stream.position.copy(_mid);
        this.stream.scale.set(1, _a.distanceTo(_b), 1);
        this.stream.lookAt(this.group.localToWorld(_b.clone()));
        this.stream.rotateX(Math.PI / 2);
        this.stream.material.opacity = 0.9;
      } else {
        this.stream.material.opacity = 0; this._fizzed = false;
      }
      if (k >= 1) {
        this.bottlePivot.position.z = this._bottleHome.z; this.bottlePivot.rotation.x = 0;
        this.stream.visible = false; this._state = 'idle';
      }
    }

    // ПУЗЫРЬКИ: поднимаются ко поверхности и петляют; больше/быстрее при свежем наливе
    const bpos = this.bubbles.geometry.attributes.position.array;
    const topY = this.level * H_LIQ;
    const rate = 0.5 + this._fizz * 0.5;
    for (let i = 0; i < this._NB; i++) {
      this._by[i] += this._bspd[i] * rate * dt;
      if (this._by[i] * H_LIQ > topY) this._by[i] = (Math.random() * 0.05);   // достигла поверхности → лопнула, новая со дна
      const yy = this._by[i] * H_LIQ;
      const wob = Math.sin(t * 2.4 + this._bph[i]) * 0.006 * (0.5 + yy);       // лёгкое виляние вверх
      bpos[i * 3] = this._bx[i] + wob;
      bpos[i * 3 + 1] = Y_LIQ_BOT + yy;
      bpos[i * 3 + 2] = this._bz[i] + Math.cos(t * 2.1 + this._bph[i]) * 0.006;
    }
    this.bubbles.geometry.attributes.position.needsUpdate = true;
    this.bubbleMat.uniforms.uOpacity.value = (0.5 + 0.4 * Math.min(1, this._fizz)) * THREE.MathUtils.clamp((this._rev - 0.06) / 0.55, 0, 1);

    // рябь поверхности + всплеск
    if (this.surface.visible) {
      const rip = 1 + this._splash * 0.05 * Math.sin(t * 26);
      this.surface.scale.set(rip, rip, 1);
      this.surface.material.emissiveIntensity = 0.5 + Math.sin(t * 2.0) * 0.12 + this._splash * 0.5;
    }
    if (this.splashRing) {
      this.splashRing.material.opacity = this._splash * 0.7;
      const s = 1 + (1 - this._splash) * 1.6;
      this.splashRing.scale.set(s, s, s);
    }

    // лёд медленно крутится и слегка покачивается
    if (this.ice) for (const cube of this.ice) {
      cube.rotation.y += dt * cube.userData.spin;
      cube.rotation.x += dt * cube.userData.spin * 0.4;
    }
  }
}
