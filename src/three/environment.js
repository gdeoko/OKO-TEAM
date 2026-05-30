import * as THREE from 'three';

// ============================================================
// Живая 3D-среда клуба DUCK'S.
// Стилизованный тёмный зал: пол, неоновые вывески, лучи света в дымке,
// силуэты столов, плавающая пыль. Камера летит внутри — параллакс даёт
// ощущение движения сквозь пространство (как в igloo).
// Среда строится процедурно, без тяжёлых моделей.
// ============================================================

export class ClubEnvironment {
  constructor(scene, isMobile) {
    this.scene = scene;
    this.isMobile = isMobile;
    this.group = new THREE.Group();
    scene.add(this.group);
    this.beams = [];
    this.dust = null;
    this.signs = [];
    this._build();
  }

  _neonTexture(text) {
    const c = document.createElement('canvas');
    c.width = 512; c.height = 256;
    const x = c.getContext('2d');
    x.fillStyle = '#000'; x.fillRect(0, 0, 512, 256);
    x.font = '900 120px Orbitron, sans-serif';
    x.textAlign = 'center'; x.textBaseline = 'middle';
    x.shadowColor = '#ff2222'; x.shadowBlur = 40;
    x.fillStyle = '#ff5555'; x.fillText(text, 256, 128);
    x.shadowBlur = 18; x.fillStyle = '#ffffff'; x.fillText(text, 256, 128);
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  }

  _build() {
    const g = this.group;

    // --- Пол: тёмный, с лёгким отражённым градиентом ---
    const floorMat = new THREE.MeshStandardMaterial({
      color: 0x0a0a0e, metalness: 0.6, roughness: 0.35,
    });
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(80, 200), floorMat);
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = -3;
    g.add(floor);

    // тонкая сетка на полу — глубина зала
    const grid = new THREE.GridHelper(120, 60, 0x330000, 0x1a0505);
    grid.position.y = -2.98;
    grid.material.transparent = true;
    grid.material.opacity = 0.25;
    g.add(grid);

    // --- Неоновые вывески DUCK'S по сторонам, уходят в глубину ---
    const signGeo = new THREE.PlaneGeometry(4, 2);
    for (let i = 0; i < 6; i++) {
      const tex = this._neonTexture("DUCK'S");
      const mat = new THREE.MeshBasicMaterial({ map: tex, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0.8 });
      const side = i % 2 === 0 ? -1 : 1;
      const sign = new THREE.Mesh(signGeo, mat);
      sign.position.set(side * 7, 1.4 + (i % 3) * 0.6, -8 - i * 9);
      sign.rotation.y = -side * Math.PI * 0.28;
      g.add(sign);
      this.signs.push(sign);
    }

    // --- Силуэты круглых столов, уходящие вдаль ---
    const tableMat = new THREE.MeshStandardMaterial({ color: 0x0d0608, metalness: 0.3, roughness: 0.6, emissive: 0x220000, emissiveIntensity: 0.3 });
    for (let i = 0; i < 7; i++) {
      const side = i % 2 === 0 ? -1 : 1;
      const top = new THREE.Mesh(new THREE.CylinderGeometry(1.6, 1.6, 0.16, 32), tableMat);
      top.position.set(side * (3.5 + Math.random()), -2.2, -12 - i * 8);
      g.add(top);
      const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, 0.8, 12), tableMat);
      leg.position.set(top.position.x, -2.6, top.position.z);
      g.add(leg);
    }

    // --- Лучи света в дымке (вертикальные конусы) ---
    const beamMat = new THREE.MeshBasicMaterial({ color: 0xcc0000, transparent: true, opacity: 0.04, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
    const beamMatBlue = new THREE.MeshBasicMaterial({ color: 0x3388cc, transparent: true, opacity: 0.035, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
    for (let i = 0; i < 8; i++) {
      const side = i % 2 === 0 ? -1 : 1;
      const beam = new THREE.Mesh(new THREE.ConeGeometry(1.4, 8, 16, 1, true), i % 3 === 0 ? beamMatBlue : beamMat);
      beam.position.set(side * (2 + Math.random() * 4), 1.5, -6 - i * 7);
      beam.rotation.x = Math.PI;
      g.add(beam);
      this.beams.push(beam);
    }

    // --- Плавающая пыль (атмосфера) ---
    const dn = this.isMobile ? 120 : 260;
    const dgeo = new THREE.BufferGeometry();
    const dpos = new Float32Array(dn * 3);
    this.dustSeed = new Float32Array(dn);
    for (let i = 0; i < dn; i++) {
      dpos[i * 3] = (Math.random() - 0.5) * 40;
      dpos[i * 3 + 1] = (Math.random() - 0.5) * 16;
      dpos[i * 3 + 2] = -Math.random() * 60 + 6;
      this.dustSeed[i] = Math.random() * Math.PI * 2;
    }
    dgeo.setAttribute('position', new THREE.BufferAttribute(dpos, 3));
    const dmat = new THREE.PointsMaterial({ color: 0xff8866, size: 0.04, transparent: true, opacity: 0.35, blending: THREE.AdditiveBlending, depthWrite: false });
    this.dust = new THREE.Points(dgeo, dmat);
    g.add(this.dust);

    // --- Свет сцены: красный ключ + холодная заливка ---
    this.scene.add(new THREE.AmbientLight(0x221122, 0.6));
    const key = new THREE.DirectionalLight(0xffffff, 1.1);
    key.position.set(4, 6, 5);
    this.scene.add(key);
    const red = new THREE.PointLight(0xcc0000, 30, 25);
    red.position.set(-4, 2, -3);
    this.scene.add(red);
    this.redLight = red;
    const blue = new THREE.PointLight(0x3399ff, 10, 20);
    blue.position.set(5, 1, 2);
    this.scene.add(blue);
  }

  update(t, scrollProgress) {
    // дымка лучей мягко колышется
    this.beams.forEach((b, i) => {
      b.material.opacity = (i % 3 === 0 ? 0.035 : 0.04) + Math.sin(t * 0.6 + i) * 0.015;
    });
    // вывески мерцают как неон
    this.signs.forEach((s, i) => {
      s.material.opacity = 0.7 + Math.sin(t * 3 + i * 1.3) * 0.12 + (Math.random() < 0.01 ? -0.3 : 0);
    });
    // пыль медленно дрейфует
    if (this.dust) {
      const p = this.dust.geometry.attributes.position;
      for (let i = 0; i < this.dustSeed.length; i++) {
        p.array[i * 3 + 1] += Math.sin(t * 0.3 + this.dustSeed[i]) * 0.002;
      }
      p.needsUpdate = true;
      this.dust.rotation.y = t * 0.01;
    }
    // красный свет дышит
    this.redLight.intensity = 28 + Math.sin(t * 1.2) * 6;
  }

  // на абстрактных секциях (мозг) среду можно притушить
  setVisibility(v) {
    this.group.traverse((o) => {
      if (o.material) {
        o.material.transparent = true;
        if (o.userData._baseOpacity === undefined) o.userData._baseOpacity = o.material.opacity ?? 1;
      }
    });
  }

  fade(amount) {
    // amount 0..1, 1 = полностью видна
    this.group.traverse((o) => {
      if (o.material && o.userData._baseOpacity !== undefined) {
        o.material.opacity = o.userData._baseOpacity * amount;
      }
    });
  }
}
