import * as THREE from 'three';
import { RGBELoader } from 'three/addons/loaders/RGBELoader.js';

// ============================================================
// 360° сферическая среда из equirectangular HDR.
// HDR натягивается как фон сцены (камера крутится внутри сферы 360)
// и одновременно даёт освещение/отражения на утке, кубиках, бокале.
// Файл /hdr/space.hdr — временный космос, легко заменить на панораму
// реального клуба (просто другой .hdr 2:1).
// API: update(t), fade(amount 0..1), setVisibility().
// ============================================================

export class ClubEnvironment {
  constructor(scene, isMobile, renderer) {
    this.scene = scene;
    this.isMobile = isMobile;
    this.renderer = renderer;
    this.group = new THREE.Group();
    scene.add(this.group);
    this.dust = null;
    this._fade = 1;
    this._baseBgIntensity = 1.0;
    this._build();
    this._loadHDR();
  }

  _loadHDR() {
    const pmrem = new THREE.PMREMGenerator(this.renderer);
    pmrem.compileEquirectangularShader();
    new RGBELoader().load('/hdr/space.hdr', (tex) => {
      tex.mapping = THREE.EquirectangularReflectionMapping;
      // фон сцены = сама панорама (360 вокруг камеры)
      this.scene.background = tex;
      this.scene.backgroundBlurriness = 0.0;   // можно поднять до 0.2 если хотим мягче
      this.scene.backgroundIntensity = this._baseBgIntensity;
      // освещение/отражения на объектах
      this.scene.environment = pmrem.fromEquirectangular(tex).texture;
      this.scene.environmentIntensity = 0.7;
    }, undefined, (e) => {
      console.warn('HDR не загрузился, фон-заглушка', e);
      this.scene.background = new THREE.Color(0x05030a);
    });
  }

  _build() {
    const g = this.group;

    // мягкий красный «пол-свет» под уткой, чтобы она не висела в пустоте
    const floorC = document.createElement('canvas'); floorC.width = 256; floorC.height = 256;
    const fx = floorC.getContext('2d');
    const fg = fx.createRadialGradient(128, 128, 4, 128, 128, 128);
    fg.addColorStop(0, 'rgba(204,0,0,0.5)');
    fg.addColorStop(0.4, 'rgba(150,0,0,0.18)');
    fg.addColorStop(1, 'rgba(0,0,0,0)');
    fx.fillStyle = fg; fx.fillRect(0, 0, 256, 256);
    const floorTex = new THREE.CanvasTexture(floorC); floorTex.colorSpace = THREE.SRGBColorSpace;
    const glow = new THREE.Mesh(
      new THREE.PlaneGeometry(9, 9),
      new THREE.MeshBasicMaterial({ map: floorTex, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0.7 })
    );
    glow.rotation.x = -Math.PI / 2;
    glow.position.y = -1.6;
    g.add(glow);
    this.glow = glow;

    // плавающая пыль для глубины
    const dn = this.isMobile ? 90 : 200;
    const dgeo = new THREE.BufferGeometry();
    const dpos = new Float32Array(dn * 3);
    this.dustSeed = new Float32Array(dn);
    for (let i = 0; i < dn; i++) {
      dpos[i * 3] = (Math.random() - 0.5) * 40;
      dpos[i * 3 + 1] = (Math.random() - 0.5) * 18;
      dpos[i * 3 + 2] = -Math.random() * 45 + 8;
      this.dustSeed[i] = Math.random() * Math.PI * 2;
    }
    dgeo.setAttribute('position', new THREE.BufferAttribute(dpos, 3));
    this.dust = new THREE.Points(dgeo, new THREE.PointsMaterial({ color: 0xc8e6ff, size: 0.03, transparent: true, opacity: 0.4, blending: THREE.AdditiveBlending, depthWrite: false }));
    g.add(this.dust);

    // мягкий свет (HDR-окружение даёт основное, это добивает акценты)
    this.scene.add(new THREE.AmbientLight(0x223344, 0.4));
    const key = new THREE.DirectionalLight(0xffffff, 0.9);
    key.position.set(3, 5, 6); this.scene.add(key);
    const red = new THREE.PointLight(0xcc0000, 18, 26); red.position.set(-4, 1.5, -2); this.scene.add(red); this.redLight = red;
    const blue = new THREE.PointLight(0x88ddff, 8, 22); blue.position.set(5, 1, 3); this.scene.add(blue);
  }

  update(t) {
    if (this.dust) {
      const p = this.dust.geometry.attributes.position;
      for (let i = 0; i < this.dustSeed.length; i++) p.array[i * 3 + 1] += Math.sin(t * 0.3 + this.dustSeed[i]) * 0.0014;
      p.needsUpdate = true;
      this.dust.rotation.y = t * 0.006;
    }
    if (this.redLight) this.redLight.intensity = (16 + Math.sin(t * 1.2) * 4) * this._fade;
    if (this.glow) this.glow.material.opacity = 0.7 * this._fade + Math.sin(t * 0.8) * 0.05;
  }

  setVisibility() { /* фон управляется через fade() */ }

  // amount 0..1 — на абстрактных секциях (мозг) приглушаем фон/пыль
  fade(amount) {
    this._fade = amount;
    if (this.scene.background && 'backgroundIntensity' in this.scene) {
      this.scene.backgroundIntensity = this._baseBgIntensity * (0.25 + amount * 0.75);
    }
    if (this.dust) this.dust.material.opacity = 0.4 * amount;
  }
}
