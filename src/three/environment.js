import * as THREE from 'three';

// ============================================================
// Премиальная атмосферная 3D-среда DUCK'S.
// Без надписей. Глубина создаётся размытыми огнями (боке) уходящими
// вдаль — ощущение тёмного дорогого пространства с приглушённым светом,
// как блюр-лайты в баре. Камера летит внутри, среда движется параллаксом.
// (Когда появится реальное видео клуба — оно встанет фоном вместо этого.)
// ============================================================

function radialSprite(hex, soft = 0.5) {
  const c = document.createElement('canvas');
  c.width = 128; c.height = 128;
  const x = c.getContext('2d');
  const g = x.createRadialGradient(64, 64, 0, 64, 64, 64);
  const col = new THREE.Color(hex);
  const r = (col.r * 255) | 0, gg = (col.g * 255) | 0, b = (col.b * 255) | 0;
  g.addColorStop(0, `rgba(${r},${gg},${b},0.9)`);
  g.addColorStop(soft, `rgba(${r},${gg},${b},0.25)`);
  g.addColorStop(1, `rgba(${r},${gg},${b},0)`);
  x.fillStyle = g; x.fillRect(0, 0, 128, 128);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export class ClubEnvironment {
  constructor(scene, isMobile) {
    this.scene = scene;
    this.isMobile = isMobile;
    this.group = new THREE.Group();
    scene.add(this.group);
    this.bokeh = [];
    this.dust = null;
    this._build();
  }

  _build() {
    const g = this.group;

    // --- Фон: мягкий радиальный градиент вместо плоского чёрного ---
    const bgC = document.createElement('canvas'); bgC.width = 32; bgC.height = 512;
    const bx = bgC.getContext('2d');
    const grad = bx.createLinearGradient(0, 0, 0, 512);
    grad.addColorStop(0, '#0a0712');
    grad.addColorStop(0.45, '#0c0610');
    grad.addColorStop(0.7, '#120508');
    grad.addColorStop(1, '#040207');
    bx.fillStyle = grad; bx.fillRect(0, 0, 32, 512);
    const bgTex = new THREE.CanvasTexture(bgC); bgTex.colorSpace = THREE.SRGBColorSpace;
    this.scene.background = bgTex;

    // --- Пол: тёмный с мягким красным отражённым свечением ---
    const floorC = document.createElement('canvas'); floorC.width = 512; floorC.height = 512;
    const fx = floorC.getContext('2d');
    fx.fillStyle = '#070409'; fx.fillRect(0, 0, 512, 512);
    const fg = fx.createRadialGradient(256, 140, 20, 256, 200, 360);
    fg.addColorStop(0, 'rgba(204,0,0,0.28)');
    fg.addColorStop(0.5, 'rgba(120,0,0,0.08)');
    fg.addColorStop(1, 'rgba(0,0,0,0)');
    fx.fillStyle = fg; fx.fillRect(0, 0, 512, 512);
    const floorTex = new THREE.CanvasTexture(floorC); floorTex.colorSpace = THREE.SRGBColorSpace;
    const floor = new THREE.Mesh(
      new THREE.PlaneGeometry(120, 120),
      new THREE.MeshStandardMaterial({ map: floorTex, color: 0xffffff, metalness: 0.7, roughness: 0.35 })
    );
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = -3.2;
    g.add(floor);

    // --- Боке-огни: размытые светящиеся точки на разной глубине ---
    const texRed = radialSprite('#ff2a2a');
    const texBlue = radialSprite('#4aa8ff');
    const texWarm = radialSprite('#ff7a3a');
    const texWhite = radialSprite('#ffffff');
    const n = this.isMobile ? 26 : 46;
    for (let i = 0; i < n; i++) {
      const roll = Math.random();
      const tex = roll < 0.5 ? texRed : roll < 0.72 ? texBlue : roll < 0.9 ? texWarm : texWhite;
      const mat = new THREE.SpriteMaterial({ map: tex, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0.5 + Math.random() * 0.4 });
      const s = new THREE.Sprite(mat);
      const depth = -4 - Math.random() * 50;
      const spread = 8 + Math.abs(depth) * 0.4;
      s.position.set((Math.random() - 0.5) * spread * 2, -2 + Math.random() * 7, depth);
      const sc = 0.6 + Math.random() * 2.4 + Math.abs(depth) * 0.04;
      s.scale.setScalar(sc);
      s.userData = { baseOp: mat.opacity, seed: Math.random() * Math.PI * 2, sc };
      g.add(s);
      this.bokeh.push(s);
    }

    // --- Тонкая плавающая пыль ---
    const dn = this.isMobile ? 90 : 200;
    const dgeo = new THREE.BufferGeometry();
    const dpos = new Float32Array(dn * 3);
    this.dustSeed = new Float32Array(dn);
    for (let i = 0; i < dn; i++) {
      dpos[i * 3] = (Math.random() - 0.5) * 42;
      dpos[i * 3 + 1] = (Math.random() - 0.5) * 16;
      dpos[i * 3 + 2] = -Math.random() * 55 + 6;
      this.dustSeed[i] = Math.random() * Math.PI * 2;
    }
    dgeo.setAttribute('position', new THREE.BufferAttribute(dpos, 3));
    this.dust = new THREE.Points(dgeo, new THREE.PointsMaterial({ color: 0xffaa88, size: 0.035, transparent: true, opacity: 0.3, blending: THREE.AdditiveBlending, depthWrite: false }));
    g.add(this.dust);

    // --- Свет: красный ключ + холодная заливка, помягче и поярче ---
    this.scene.add(new THREE.AmbientLight(0x332233, 0.75));
    const key = new THREE.DirectionalLight(0xffffff, 1.25);
    key.position.set(3, 6, 6); this.scene.add(key);
    const red = new THREE.PointLight(0xcc0000, 34, 28); red.position.set(-4, 2, -2); this.scene.add(red); this.redLight = red;
    const blue = new THREE.PointLight(0x3399ff, 12, 22); blue.position.set(5, 1, 3); this.scene.add(blue);
  }

  update(t) {
    this.bokeh.forEach((s, i) => {
      const u = s.userData;
      s.material.opacity = u.baseOp * (0.7 + 0.3 * Math.sin(t * 0.5 + u.seed));
      s.scale.setScalar(u.sc * (1 + 0.05 * Math.sin(t * 0.7 + u.seed)));
    });
    if (this.dust) {
      const p = this.dust.geometry.attributes.position;
      for (let i = 0; i < this.dustSeed.length; i++) p.array[i * 3 + 1] += Math.sin(t * 0.3 + this.dustSeed[i]) * 0.0016;
      p.needsUpdate = true;
      this.dust.rotation.y = t * 0.008;
    }
    this.redLight.intensity = 30 + Math.sin(t * 1.2) * 6;
  }

  setVisibility() {
    this.group.traverse((o) => {
      if (o.material) {
        o.material.transparent = true;
        if (o.userData._baseOpacity === undefined) o.userData._baseOpacity = o.material.opacity ?? 1;
      }
    });
  }

  fade(amount) {
    this.group.traverse((o) => {
      if (o.material && o.userData._baseOpacity !== undefined) o.material.opacity = o.userData._baseOpacity * amount;
    });
  }
}
