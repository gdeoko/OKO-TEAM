import * as THREE from 'three';

// ============================================================
// СТАНЦИЯ «БАР» (станция 6) — БЕЗ движения камеры. Барная стойка ПРОЯВЛЯЕТСЯ из темноты
// космоса прямо в кадре (камера статична): тёплый свет, бокал на стойке, сзади из темноты —
// красивая бутылка. Мини-игра «глоток»: клик по бокалу → бокал поднимается к зрителю и
// наклоняется → уровень напитка падает → бутылка наклоняется и доливает (струя + рябь) →
// бокал возвращается. Каждый «глоток» повышает `tipsy` (0..1) — easter egg: «перебрал» →
// камера слегка плывёт здесь, а в Дартсе плывёт прицел. Без алко-лексики и стоп-слов.
// Тексты — в HTML/CSS. Здесь только 3D + звуковые хуки.
// API: group, setReveal(ak), update(t,dt,camera), hitGlass(raycaster), tapGlass(raycaster,camera).
// hooks: { onClink(), onLift(), onPour(), onSip() } — звук из main.
// ============================================================

const _sphere = new THREE.Sphere();
const _wp = new THREE.Vector3();

// процедурная этикетка бутылки (бренд: тёмное стекло, золото/красный акцент, утка-метка)
function labelTexture() {
  const W = 256, H = 320, c = document.createElement('canvas'); c.width = W; c.height = H;
  const x = c.getContext('2d');
  // фон этикетки — кремовый с золотой рамкой
  x.fillStyle = '#efe4c8'; x.fillRect(0, 0, W, H);
  x.strokeStyle = '#b8932f'; x.lineWidth = 8; x.strokeRect(10, 10, W - 20, H - 20);
  x.strokeStyle = 'rgba(204,0,0,0.85)'; x.lineWidth = 3; x.strokeRect(20, 20, W - 40, H - 40);
  // верхний красный поясок
  x.fillStyle = '#cc0000'; x.fillRect(20, 36, W - 40, 34);
  x.fillStyle = '#f6efd8'; x.textAlign = 'center'; x.font = '700 22px Orbitron, "Exo 2", sans-serif';
  x.fillText("DUCK'S", W / 2, 60);
  // утка-метка
  x.font = '54px serif'; x.fillText('🦆', W / 2, 150);
  // подпись
  x.fillStyle = '#1a1208'; x.font = '700 18px Orbitron, "Exo 2", sans-serif';
  x.fillText('RESERVE', W / 2, 196);
  x.fillStyle = '#7a5f22'; x.font = '400 12px "Exo 2", sans-serif';
  x.fillText('клуб для своих', W / 2, 224);
  x.fillStyle = '#b8932f'; x.fillRect(W / 2 - 40, 244, 80, 3);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
  return t;
}

export class BarStation {
  constructor(hooks = {}) {
    this.hooks = hooks;
    this.group = new THREE.Group();
    this.group.visible = false;

    this._rev = 0;
    this.tipsy = 0;              // 0..1, повышается за «глоток», медленно гаснет (связь с Дартсом)
    this.level = 0.72;          // уровень напитка в бокале 0..1
    this._state = 'idle';       // idle | lift | place | pour
    this._t = 0;                // таймер текущей фазы
    this._mats = [];            // материалы для проявления (opacity = base * reveal)

    this._H_LIQ = 0.46;         // макс высота столбика напитка
    this._Y_BOT = -0.74;        // дно внутреннего объёма бокала (локально в group)

    // регистрация материала для проявления из темноты
    const reg = (m, base = 1) => { m.transparent = true; m.userData._b = base; m.opacity = 0; this._mats.push(m); return m; };

    // --- СТОЙКА (тёмная глянцевая столешница, тёплый кант спереди) ---
    const top = new THREE.Mesh(
      new THREE.BoxGeometry(7.2, 0.34, 5.0),
      reg(new THREE.MeshPhysicalMaterial({ color: 0x18120d, roughness: 0.32, metalness: 0.1,
        clearcoat: 0.8, clearcoatRoughness: 0.25 }))
    );
    top.position.set(0, -0.95, 1.25);
    this.group.add(top);
    // тёплая «жила» по переднему канту стойки (бренд-акцент) — мягкая, не неоновая полоса
    const edge = new THREE.Mesh(
      new THREE.BoxGeometry(7.24, 0.035, 0.05),
      reg(new THREE.MeshStandardMaterial({ color: 0x180605, emissive: 0x7a1c0c, emissiveIntensity: 0.45 }), 0.85)
    );
    edge.position.set(0, -0.79, 3.74);
    this.group.add(edge);
    // задняя барная стенка (тёмная, чтобы бутылка читалась силуэтом из темноты)
    const back = new THREE.Mesh(
      new THREE.PlaneGeometry(7.2, 4.2),
      reg(new THREE.MeshStandardMaterial({ color: 0x0a0708, roughness: 0.9, metalness: 0.0, side: THREE.DoubleSide }), 0.9)
    );
    back.position.set(0, 0.7, -2.4);
    this.group.add(back);

    // --- БОКАЛ (old fashioned): риг, чтобы поднимать/наклонять целиком ---
    this.glassRig = new THREE.Group();
    this.group.add(this.glassRig);

    // стекло (фейк-стекло: прозрачное, clearcoat, двусторонне — видно «заднюю стенку»)
    this.glass = new THREE.Mesh(
      new THREE.CylinderGeometry(0.30, 0.245, 0.62, 40, 1, true),
      reg(new THREE.MeshPhysicalMaterial({ color: 0xcfe0e8, roughness: 0.04, metalness: 0.0,
        clearcoat: 1.0, clearcoatRoughness: 0.04, side: THREE.DoubleSide, opacity: 0, transparent: true }), 0.42)
    );
    this.glass.position.set(0, -0.45, 0);
    this.glass.renderOrder = 5;
    this.glass.material.depthWrite = false;
    this.glassRig.add(this.glass);
    // дно бокала (толстое стекло)
    const base = new THREE.Mesh(
      new THREE.CylinderGeometry(0.245, 0.245, 0.06, 40),
      reg(new THREE.MeshPhysicalMaterial({ color: 0xcfe0e8, roughness: 0.05, clearcoat: 1.0,
        clearcoatRoughness: 0.05, side: THREE.DoubleSide }), 0.5)
    );
    base.position.set(0, this._Y_BOT - 0.01, 0);
    base.renderOrder = 4;
    this.glassRig.add(base);

    // напиток (тёплый янтарный столбик; высота/уровень = this.level)
    this.liquid = new THREE.Mesh(
      new THREE.CylinderGeometry(0.235, 0.235, 1, 36),
      reg(new THREE.MeshPhysicalMaterial({ color: 0xcf8f2a, roughness: 0.18, metalness: 0.0,
        clearcoat: 0.6, transmission: 0.0, emissive: 0x3a2406, emissiveIntensity: 0.35 }), 0.92)
    );
    this.liquid.renderOrder = 3;
    this.glassRig.add(this.liquid);
    // поверхность напитка (мениск-блик, ловит свет; следует за уровнем)
    this.surface = new THREE.Mesh(
      new THREE.CircleGeometry(0.232, 36),
      reg(new THREE.MeshStandardMaterial({ color: 0xf0b54a, emissive: 0x6a3c08, emissiveIntensity: 0.6,
        roughness: 0.1, metalness: 0.2, side: THREE.DoubleSide }), 0.95)
    );
    this.surface.rotation.x = -Math.PI / 2;
    this.surface.renderOrder = 4;
    this.glassRig.add(this.surface);
    // кубик льда (немного жизни)
    this.ice = new THREE.Mesh(
      new THREE.IcosahedronGeometry(0.11, 0),
      reg(new THREE.MeshPhysicalMaterial({ color: 0xdff0ff, roughness: 0.05, metalness: 0.0,
        clearcoat: 1.0, side: THREE.DoubleSide }), 0.5)
    );
    this.ice.renderOrder = 4;
    this.glassRig.add(this.ice);

    this._applyLevel();

    // --- БУТЫЛКА (тёмное стекло, золотой блик, бренд-этикетка) — сзади из темноты ---
    this.bottle = new THREE.Group();
    this.bottle.position.set(0.04, 0, -1.55);
    this.group.add(this.bottle);
    const glassMat = reg(new THREE.MeshPhysicalMaterial({ color: 0x0c1f14, roughness: 0.12, metalness: 0.0,
      clearcoat: 1.0, clearcoatRoughness: 0.08, side: THREE.DoubleSide }), 0.96);
    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.19, 0.19, 0.92, 32), glassMat);
    body.position.y = -0.18; this.bottle.add(body);
    const shoulder = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.19, 0.24, 32), glassMat);
    shoulder.position.y = 0.4; this.bottle.add(shoulder);
    const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.062, 0.075, 0.34, 24), glassMat);
    neck.position.y = 0.66; this.bottle.add(neck);
    const cork = new THREE.Mesh(new THREE.CylinderGeometry(0.066, 0.062, 0.1, 20),
      reg(new THREE.MeshStandardMaterial({ color: 0x3a2a16, roughness: 0.8 }), 1));
    cork.position.y = 0.86; this.bottle.add(cork);
    // этикетка (слегка изогнутая полоса по телу)
    const label = new THREE.Mesh(
      new THREE.CylinderGeometry(0.192, 0.192, 0.46, 32, 1, true, -0.7, 1.4),
      reg(new THREE.MeshStandardMaterial({ map: labelTexture(), roughness: 0.5, metalness: 0.0, side: THREE.DoubleSide }), 1)
    );
    label.position.y = -0.16; this.bottle.add(label);
    this._bottleHome = { y: 0, z: -1.55, rz: 0 };
    this.bottleMouth = new THREE.Object3D(); this.bottleMouth.position.set(0, 0.92, 0); this.bottle.add(this.bottleMouth);

    // струя налива (тонкий цилиндр бутылка→бокал, видна только в фазе pour)
    this.stream = new THREE.Mesh(
      new THREE.CylinderGeometry(0.012, 0.018, 1, 8),
      new THREE.MeshStandardMaterial({ color: 0xe0a23a, emissive: 0x6a3c08, emissiveIntensity: 0.7,
        transparent: true, opacity: 0, depthWrite: false })
    );
    this.stream.visible = false;
    this.group.add(this.stream);

    // --- СВЕТ: тёплый ключевой spot на бокал + красный fill + холодный rim-блик ---
    this.spot = new THREE.SpotLight(0xffd9a8, 0, 18, Math.PI / 5, 0.55, 1.0);
    this.spot.position.set(0.4, 2.6, 2.2); this.spot.target.position.set(0, -0.4, 0);
    this.group.add(this.spot, this.spot.target);
    this.fill = new THREE.PointLight(0xcc3318, 0, 12); this.fill.position.set(-1.6, 0.4, 2.4);
    this.group.add(this.fill);
    this.rim = new THREE.PointLight(0xbfe0ff, 0, 10); this.rim.position.set(1.6, 1.2, -0.6);
    this.group.add(this.rim);
    this.warm = new THREE.PointLight(0xffb060, 0, 8); this.warm.position.set(0, 0.2, 0.4);
    this.group.add(this.warm);
  }

  // уровень напитка → высота столбика, позиция поверхности, кубик льда плавает на поверхности
  _applyLevel() {
    const h = Math.max(0.0001, this.level) * this._H_LIQ;
    this.liquid.scale.y = h;
    this.liquid.position.set(0, this._Y_BOT + h / 2, 0);
    this.surface.position.set(0, this._Y_BOT + h, 0);
    this.surface.visible = this.level > 0.02;
    this.ice.position.set(0.04, this._Y_BOT + Math.max(h - 0.06, 0.05), 0.02);
    this.ice.visible = this.level > 0.08;
  }

  // ak — прогресс станции 0..1. Стойка/бокал/бутылка проявляются из темноты, свет нарастает.
  setReveal(ak) {
    this._rev = ak;
    this.group.visible = ak > 0.02;
    if (!this.group.visible) return;
    const e = THREE.MathUtils.clamp((ak - 0.06) / 0.55, 0, 1);
    const es = e * e * (3 - 2 * e);
    this.group.scale.setScalar(0.94 + 0.06 * es);
    for (const m of this._mats) m.opacity = (m.userData._b || 1) * es;
    this.spot.intensity = 26 * es;
    this.fill.intensity = 7 * es;
    this.rim.intensity = 9 * es;
    this.warm.intensity = 5 * es;
  }

  // мировой луч пересекает сферу вокруг бокала?
  hitGlass(raycaster) {
    if (!this.group.visible || this._rev < 0.25) return false;
    this.glassRig.getWorldPosition(_sphere.center);
    _sphere.center.y -= 0.4 * this.group.scale.y;   // центр бокала (риг в нуле, бокал ниже)
    _sphere.radius = 0.6 * this.group.scale.y;
    return raycaster.ray.intersectsSphere(_sphere);
  }

  // ТАП по бокалу → запустить «глоток» (если свободен и проявлен)
  tapGlass(raycaster) {
    if (this._state !== 'idle' || this._rev < 0.3) return false;
    if (!this.hitGlass(raycaster)) return false;
    this._state = 'lift'; this._t = 0; this._sipFrom = this.level;
    if (this.hooks.onClink) this.hooks.onClink();
    if (this.hooks.onLift) this.hooks.onLift();
    return true;
  }

  update(t, dt, camera) {
    // tipsy медленно гаснет всегда; быстрее — когда станция не в фокусе (камера «выравнивается»)
    const decay = this._rev > 0.4 ? 0.05 : 0.5;
    this.tipsy = Math.max(0, this.tipsy - decay * dt);
    if (!this.group.visible) return;

    const rig = this.glassRig;
    this._t += dt;

    if (this._state === 'lift') {
      // бокал поднимается к зрителю и наклоняется (как будто подносишь и пьёшь)
      const k = Math.min(1, this._t / 0.62), e = k * k * (3 - 2 * k);
      rig.position.set(0, 0.34 * e, 0.5 * e);
      rig.rotation.x = 0.62 * e;                 // верх кренится к зрителю
      // в верхней фазе наклона напиток убывает (глоток)
      if (k > 0.45) {
        const sip = THREE.MathUtils.smoothstep((k - 0.45) / 0.55, 0, 1);
        this.level = Math.max(0, this._sipFrom - 0.34 * sip);
        this._applyLevel();
      }
      if (k >= 1) {
        this.tipsy = Math.min(1, this.tipsy + 0.2);
        if (this.hooks.onSip) this.hooks.onSip();
        this._state = 'place'; this._t = 0;
      }
    } else if (this._state === 'place') {
      // бокал опускается обратно на стойку
      const k = Math.min(1, this._t / 0.5), e = k * k * (3 - 2 * k);
      rig.position.set(0, 0.34 * (1 - e), 0.5 * (1 - e));
      rig.rotation.x = 0.62 * (1 - e);
      if (k >= 1) {
        rig.position.set(0, 0, 0); rig.rotation.x = 0;
        // если бокал ополовинен — бутылка доливает
        if (this.level < 0.42) { this._state = 'pour'; this._t = 0; if (this.hooks.onPour) this.hooks.onPour(); }
        else this._state = 'idle';
      }
    } else if (this._state === 'pour') {
      // бутылка наклоняется к бокалу, появляется струя, уровень доливается до полного
      const dur = 1.25, k = Math.min(1, this._t / dur);
      const lean = Math.sin(Math.min(k, 1) * Math.PI);        // 0→1→0: наклон и возврат
      this.bottle.position.z = THREE.MathUtils.lerp(this._bottleHome.z, -0.62, lean);
      this.bottle.position.y = THREE.MathUtils.lerp(0, 0.5, lean);
      this.bottle.rotation.z = -1.15 * lean;
      // струя видна в середине наклона; доливаем уровень
      const pouring = k > 0.22 && k < 0.86;
      this.stream.visible = pouring;
      if (pouring) {
        this.level = Math.min(1, this.level + dt * 0.9);
        this._applyLevel();
        // струя от горлышка бутылки до поверхности напитка
        this.bottleMouth.getWorldPosition(_wp);
        const a = this.group.worldToLocal(_wp.clone());
        const b = new THREE.Vector3(0, this._Y_BOT + this.level * this._H_LIQ + 0.05, 0);
        const mid = a.clone().add(b).multiplyScalar(0.5);
        this.stream.position.copy(mid);
        this.stream.scale.y = a.distanceTo(b);
        this.stream.lookAt(this.group.localToWorld(b.clone()));
        this.stream.rotateX(Math.PI / 2);
        this.stream.material.opacity = 0.85;
      } else {
        this.stream.material.opacity = 0;
      }
      if (k >= 1) {
        this.bottle.position.set(0.04, 0, this._bottleHome.z); this.bottle.rotation.z = 0;
        this.stream.visible = false; this._state = 'idle';
      }
    }

    // лёгкое «дыхание» бликов + мерцание поверхности
    if (this.surface.visible) this.surface.material.emissiveIntensity = 0.5 + Math.sin(t * 2.0) * 0.12;
    this.ice.rotation.y += dt * 0.4;
  }
}
