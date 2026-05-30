import * as THREE from 'three';

// ============================================================
// Временная, но НАСТОЯЩАЯ 3D-среда клуба DUCK'S.
// Это реальная геометрия зала (пол, потолок, стены, столы, бар, дартс,
// неон, подвесные лампы, лучи в дымке) — камера двигается внутри с
// параллаксом, есть честная глубина 360°. Заменится Gaussian-сканом
// реального клуба, когда он будет готов. API: update(t), fade(a), setVisibility().
// ============================================================

function radialSprite(hex, soft = 0.5) {
  const c = document.createElement('canvas'); c.width = 128; c.height = 128;
  const x = c.getContext('2d');
  const g = x.createRadialGradient(64, 64, 0, 64, 64, 64);
  const col = new THREE.Color(hex);
  const r = (col.r * 255) | 0, gg = (col.g * 255) | 0, b = (col.b * 255) | 0;
  g.addColorStop(0, `rgba(${r},${gg},${b},0.95)`);
  g.addColorStop(soft, `rgba(${r},${gg},${b},0.3)`);
  g.addColorStop(1, `rgba(${r},${gg},${b},0)`);
  x.fillStyle = g; x.fillRect(0, 0, 128, 128);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}

export class ClubEnvironment {
  constructor(scene, isMobile) {
    this.scene = scene;
    this.isMobile = isMobile;
    this.group = new THREE.Group();
    scene.add(this.group);
    this.pulsing = [];   // объекты с мерцанием неона
    this.beams = [];
    this.dust = null;
    this._build();
  }

  _build() {
    const g = this.group;

    // фон-градиент
    const bgC = document.createElement('canvas'); bgC.width = 16; bgC.height = 256;
    const bx = bgC.getContext('2d');
    const grad = bx.createLinearGradient(0, 0, 0, 256);
    grad.addColorStop(0, '#0a0712'); grad.addColorStop(0.55, '#0a0610'); grad.addColorStop(1, '#050208');
    bx.fillStyle = grad; bx.fillRect(0, 0, 16, 256);
    const bgTex = new THREE.CanvasTexture(bgC); bgTex.colorSpace = THREE.SRGBColorSpace;
    this.scene.background = bgTex;

    const ROOM_W = 22, ROOM_H = 9, FLOOR_Y = -3.2, CEIL_Y = -3.2 + ROOM_H, Z_FAR = -46, Z_NEAR = 12;
    const depth = Z_NEAR - Z_FAR;
    const midZ = (Z_NEAR + Z_FAR) / 2;

    // --- ПОЛ: тёмный глянец с красным отражённым пятном ---
    const floorC = document.createElement('canvas'); floorC.width = 512; floorC.height = 512;
    const fx = floorC.getContext('2d');
    fx.fillStyle = '#080509'; fx.fillRect(0, 0, 512, 512);
    const fg = fx.createRadialGradient(256, 120, 10, 256, 220, 380);
    fg.addColorStop(0, 'rgba(204,0,0,0.22)'); fg.addColorStop(0.55, 'rgba(120,0,0,0.06)'); fg.addColorStop(1, 'rgba(0,0,0,0)');
    fx.fillStyle = fg; fx.fillRect(0, 0, 512, 512);
    const floorTex = new THREE.CanvasTexture(floorC); floorTex.colorSpace = THREE.SRGBColorSpace;
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(ROOM_W, depth),
      new THREE.MeshStandardMaterial({ map: floorTex, color: 0xffffff, metalness: 0.75, roughness: 0.32 }));
    floor.rotation.x = -Math.PI / 2; floor.position.set(0, FLOOR_Y, midZ); g.add(floor);

    // --- ПОТОЛОК ---
    const ceil = new THREE.Mesh(new THREE.PlaneGeometry(ROOM_W, depth),
      new THREE.MeshStandardMaterial({ color: 0x0a0810, metalness: 0.2, roughness: 0.9 }));
    ceil.rotation.x = Math.PI / 2; ceil.position.set(0, CEIL_Y, midZ); g.add(ceil);

    // --- СТЕНЫ ---
    const wallMat = new THREE.MeshStandardMaterial({ color: 0x0c080e, metalness: 0.3, roughness: 0.75 });
    const wallGeo = new THREE.PlaneGeometry(depth, ROOM_H);
    const lWall = new THREE.Mesh(wallGeo, wallMat); lWall.rotation.y = Math.PI / 2; lWall.position.set(-ROOM_W / 2, FLOOR_Y + ROOM_H / 2, midZ); g.add(lWall);
    const rWall = new THREE.Mesh(wallGeo, wallMat); rWall.rotation.y = -Math.PI / 2; rWall.position.set(ROOM_W / 2, FLOOR_Y + ROOM_H / 2, midZ); g.add(rWall);
    const backWall = new THREE.Mesh(new THREE.PlaneGeometry(ROOM_W, ROOM_H), wallMat);
    backWall.position.set(0, FLOOR_Y + ROOM_H / 2, Z_FAR); g.add(backWall);

    // --- НЕОНОВЫЕ ПОЛОСЫ вдоль стен (красные, светятся) ---
    const neonMat = () => new THREE.MeshBasicMaterial({ color: 0xff1a1a, transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending });
    for (const sx of [-1, 1]) {
      const strip = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.08, depth * 0.95), neonMat());
      strip.position.set(sx * (ROOM_W / 2 - 0.15), FLOOR_Y + 2.2, midZ); g.add(strip); this.pulsing.push(strip);
    }
    // неон на дальней стене — круг (как вывеска)
    const ring = new THREE.Mesh(new THREE.TorusGeometry(1.6, 0.06, 12, 48), neonMat());
    ring.position.set(0, FLOOR_Y + ROOM_H / 2 + 0.4, Z_FAR + 0.3); g.add(ring); this.pulsing.push(ring);

    // --- ПОДВЕСНЫЕ ЛАМПЫ, уходящие вглубь (создают ритм и глубину) ---
    const bulbTex = radialSprite('#ffd9a0', 0.45);
    const lampN = this.isMobile ? 5 : 8;
    for (let i = 0; i < lampN; i++) {
      const z = Z_NEAR - 4 - i * (depth / (lampN + 1));
      const bulb = new THREE.Sprite(new THREE.SpriteMaterial({ map: bulbTex, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0.85 }));
      bulb.position.set((i % 2 ? 1 : -1) * 2.2, CEIL_Y - 1.1, z); bulb.scale.setScalar(2.2);
      g.add(bulb); this.pulsing.push(bulb);
      // тонкий подвес
      const wire = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 0.01, 1.1, 4), new THREE.MeshBasicMaterial({ color: 0x222222 }));
      wire.position.set(bulb.position.x, CEIL_Y - 0.55, z); g.add(wire);
    }

    // --- СТОЛЫ (силуэты) по сторонам в глубину ---
    const tableMat = new THREE.MeshStandardMaterial({ color: 0x120a0c, metalness: 0.35, roughness: 0.55, emissive: 0x330000, emissiveIntensity: 0.35 });
    const tableN = this.isMobile ? 4 : 6;
    for (let i = 0; i < tableN; i++) {
      const side = i % 2 === 0 ? -1 : 1;
      const z = -6 - i * 6.5;
      const top = new THREE.Mesh(new THREE.CylinderGeometry(1.7, 1.7, 0.18, 28), tableMat);
      top.position.set(side * 5.2, FLOOR_Y + 0.95, z); g.add(top);
      const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.25, 0.95, 10), tableMat);
      leg.position.set(side * 5.2, FLOOR_Y + 0.45, z); g.add(leg);
      // тёплый блик над столом
      const spot = new THREE.Sprite(new THREE.SpriteMaterial({ map: bulbTex, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0.35, color: 0xff6633 }));
      spot.position.set(side * 5.2, FLOOR_Y + 1.4, z); spot.scale.setScalar(2.4); g.add(spot);
    }

    // --- БАР: длинная стойка справа спереди с бутылками-силуэтами ---
    const bar = new THREE.Mesh(new THREE.BoxGeometry(0.9, 1.2, 7), new THREE.MeshStandardMaterial({ color: 0x14090b, metalness: 0.4, roughness: 0.5, emissive: 0x220000, emissiveIntensity: 0.3 }));
    bar.position.set(ROOM_W / 2 - 1.4, FLOOR_Y + 0.6, -3); g.add(bar);
    const bottleTex = radialSprite('#66ccff', 0.5);
    for (let i = 0; i < 6; i++) {
      const b = new THREE.Sprite(new THREE.SpriteMaterial({ map: bottleTex, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0.5 + Math.random() * 0.3 }));
      b.position.set(ROOM_W / 2 - 1.4, FLOOR_Y + 1.5, -5.5 + i * 1.0); b.scale.setScalar(0.5 + Math.random() * 0.3);
      g.add(b); this.pulsing.push(b);
    }

    // --- ДАРТС на левой стене ---
    const dartC = document.createElement('canvas'); dartC.width = 256; dartC.height = 256;
    const dx = dartC.getContext('2d');
    for (let r = 120; r > 0; r -= 20) { dx.beginPath(); dx.arc(128, 128, r, 0, Math.PI * 2); dx.fillStyle = (r / 20) % 2 ? '#1a1a1a' : '#2a0808'; dx.fill(); }
    dx.beginPath(); dx.arc(128, 128, 16, 0, Math.PI * 2); dx.fillStyle = '#cc0000'; dx.fill();
    const dartTex = new THREE.CanvasTexture(dartC); dartTex.colorSpace = THREE.SRGBColorSpace;
    const dart = new THREE.Mesh(new THREE.CircleGeometry(1.1, 32), new THREE.MeshStandardMaterial({ map: dartTex, emissive: 0x330000, emissiveIntensity: 0.4, roughness: 0.7 }));
    dart.position.set(-ROOM_W / 2 + 0.2, FLOOR_Y + 3, -10); dart.rotation.y = Math.PI / 2; g.add(dart);

    // --- ЛУЧИ СВЕТА в дымке (объёмные конусы) ---
    const beamN = this.isMobile ? 4 : 7;
    for (let i = 0; i < beamN; i++) {
      const side = i % 2 === 0 ? -1 : 1;
      const mat = new THREE.MeshBasicMaterial({ color: i % 3 === 0 ? 0x3388cc : 0xcc2200, transparent: true, opacity: 0.04, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
      const beam = new THREE.Mesh(new THREE.ConeGeometry(1.5, ROOM_H, 14, 1, true), mat);
      beam.position.set(side * (1.5 + Math.random() * 4), CEIL_Y - ROOM_H / 2, -4 - i * 6);
      g.add(beam); this.beams.push(beam);
    }

    // --- ПЫЛЬ ---
    const dn = this.isMobile ? 110 : 240;
    const dgeo = new THREE.BufferGeometry(); const dpos = new Float32Array(dn * 3);
    this.dustSeed = new Float32Array(dn);
    for (let i = 0; i < dn; i++) {
      dpos[i * 3] = (Math.random() - 0.5) * ROOM_W; dpos[i * 3 + 1] = FLOOR_Y + Math.random() * ROOM_H; dpos[i * 3 + 2] = Z_FAR + Math.random() * depth;
      this.dustSeed[i] = Math.random() * Math.PI * 2;
    }
    dgeo.setAttribute('position', new THREE.BufferAttribute(dpos, 3));
    this.dust = new THREE.Points(dgeo, new THREE.PointsMaterial({ color: 0xffaa88, size: 0.035, transparent: true, opacity: 0.3, blending: THREE.AdditiveBlending, depthWrite: false }));
    g.add(this.dust);

    // --- СВЕТ ---
    this.scene.add(new THREE.AmbientLight(0x332233, 0.7));
    const key = new THREE.DirectionalLight(0xffffff, 1.15); key.position.set(3, 6, 6); this.scene.add(key);
    const red = new THREE.PointLight(0xcc0000, 32, 30); red.position.set(-4, 2, -2); this.scene.add(red); this.redLight = red;
    const blue = new THREE.PointLight(0x3399ff, 12, 24); blue.position.set(5, 1, 3); this.scene.add(blue);
  }

  update(t) {
    this.pulsing.forEach((o, i) => {
      const base = o.userData._baseOpacity !== undefined ? o.userData._baseOpacity : (o.material.opacity ?? 1);
      const flick = Math.random() < 0.012 ? -0.35 : 0;
      o.material.opacity = Math.max(0, base * (0.78 + 0.18 * Math.sin(t * 2 + i)) + flick) * (this._fade ?? 1);
    });
    this.beams.forEach((b, i) => { b.material.opacity = (0.035 + Math.sin(t * 0.6 + i) * 0.015) * (this._fade ?? 1); });
    if (this.dust) {
      const p = this.dust.geometry.attributes.position;
      for (let i = 0; i < this.dustSeed.length; i++) p.array[i * 3 + 1] += Math.sin(t * 0.3 + this.dustSeed[i]) * 0.0015;
      p.needsUpdate = true;
    }
    this.redLight.intensity = (30 + Math.sin(t * 1.2) * 6) * (this._fade ?? 1);
  }

  setVisibility() {
    this.group.traverse((o) => {
      if (o.material) {
        o.material.transparent = true;
        if (o.userData._baseOpacity === undefined) o.userData._baseOpacity = o.material.opacity ?? 1;
      }
    });
  }

  // amount 0..1 (1 = полностью видна). На абстрактных секциях среду притушиваем.
  fade(amount) {
    this._fade = amount;
    this.group.traverse((o) => {
      if (o.material && o.userData._baseOpacity !== undefined && !this.pulsing.includes(o) && !this.beams.includes(o)) {
        o.material.opacity = o.userData._baseOpacity * amount;
      }
    });
  }
}
