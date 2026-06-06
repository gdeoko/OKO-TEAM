import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';

const _draco = new DRACOLoader();
_draco.setDecoderPath('draco/');

// ============================================================
// 3D-окружение клуба DUCK'S на базе модели "Sci-fi bar" (onerockett, CC-BY-4.0).
// Реальная 3D-геометрия бара: камера летает внутри, есть глубина/параллакс.
// Неон перекрашивается из фиолетового в красный бренд DUCK'S.
// Анимация модели (вентиляторы) запускается через AnimationMixer.
// Сверху — лёгкая дымка/пыль и god-rays для кино.
// API: update(t, camera, tp), setColors(), fade(amount), setVisibility().
// Кредит: "Sci-fi bar" by onerockett, CC-BY-4.0 (sketchfab.com/onerockett)
// ============================================================

export class ClubEnvironment {
  constructor(scene, isMobile, renderer) {
    this.scene = scene;
    this.isMobile = isMobile;
    this.renderer = renderer;
    this.group = new THREE.Group();
    scene.add(this.group);
    this._fade = 1;
    this.mixer = null;
    this.neonMats = [];
    this.ready = false;
    this._buildAtmosphere();
    this._loadClub();
  }

  _buildAtmosphere() {
    // фон-градиент позади всего
    const bgC = document.createElement('canvas'); bgC.width = 16; bgC.height = 256;
    const bx = bgC.getContext('2d');
    const grad = bx.createLinearGradient(0, 0, 0, 256);
    grad.addColorStop(0, '#0a0410'); grad.addColorStop(0.6, '#070308'); grad.addColorStop(1, '#030206');
    bx.fillStyle = grad; bx.fillRect(0, 0, 16, 256);
    const bgTex = new THREE.CanvasTexture(bgC); bgTex.colorSpace = THREE.SRGBColorSpace;
    this.scene.background = bgTex;

    // плавающая пыль для глубины
    const dn = this.isMobile ? 120 : 260;
    const dgeo = new THREE.BufferGeometry();
    const dpos = new Float32Array(dn * 3);
    this.dustSeed = new Float32Array(dn);
    for (let i = 0; i < dn; i++) {
      dpos[i * 3] = (Math.random() - 0.5) * 44;
      dpos[i * 3 + 1] = (Math.random() - 0.5) * 22;
      dpos[i * 3 + 2] = -Math.random() * 50 + 10;
      this.dustSeed[i] = Math.random() * Math.PI * 2;
    }
    dgeo.setAttribute('position', new THREE.BufferAttribute(dpos, 3));
    this.dust = new THREE.Points(dgeo, new THREE.PointsMaterial({ color: 0xaabbff, size: 0.03, transparent: true, opacity: 0.28, blending: THREE.AdditiveBlending, depthWrite: false }));
    this.group.add(this.dust);

    // слабый общий свет + цветные источники-«отблески» неона на полу/стенах
    this.ambient = new THREE.AmbientLight(0x4455bb, 0.35); this.scene.add(this.ambient);
    this.key = new THREE.DirectionalLight(0x99aaff, 0.45); this.key.position.set(2, 6, 4); this.scene.add(this.key);
    this._ambientBase = 0.35; this._keyBase = 0.45;
    // неоновые отблески в пространстве (взаимодействие неона с залом, как на референсе)
    const mkLight = (color, intensity, dist, x, y, z) => { const l = new THREE.PointLight(color, intensity, dist); l.position.set(x, y, z); return l; };
    this.glowLights = [
      mkLight(0xff2aff, 6, 20, -6, 1, -6),
      mkLight(0x3aa0ff, 6, 22, 5, 1.5, -10),
      mkLight(0xff1466, 4, 16, 0, 0.5, -3),
    ];
    this.glowLights.forEach((l) => this.scene.add(l));
    this.red = null;
  }

  _loadClub() {
    const _gl = new GLTFLoader(); _gl.setDRACOLoader(_draco);
    _gl.load('models/scifi_bar.glb', (gltf) => {
      const club = gltf.scene;
      // нормализуем размер и ставим так, чтобы камера была внутри
      const box = new THREE.Box3().setFromObject(club);
      const size = box.getSize(new THREE.Vector3());
      const center = box.getCenter(new THREE.Vector3());
      const scale = 30 / Math.max(size.x, size.y, size.z);
      club.scale.setScalar(scale);
      club.position.sub(center.multiplyScalar(scale));
      club.position.y -= 3.0;        // как было
      club.position.z -= 8;

      // Тёмный зал + ЯРКИЙ неон (как на референсе): не-неон затемняем,
      // неон оставляем родным цветом (синий/фиолет) и усиливаем свечение.
      club.traverse((o) => {
        if (!o.isMesh || !o.material) return;
        const mats = Array.isArray(o.material) ? o.material : [o.material];
        mats.forEach((m) => {
          m.transparent = true;
          if (m.userData._baseOpacity === undefined) m.userData._baseOpacity = (m.opacity ?? 1);
          const eLum = m.emissive ? (m.emissive.r + m.emissive.g + m.emissive.b) / 3 : 0;
          const isNeon = eLum > 0.02 || (m.emissiveIntensity ?? 0) > 1;
          if (isNeon) {
            // неон ЯРЧЕ и насыщеннее (как на фото)
            const h = {}; m.emissive.getHSL(h); m.emissive.setHSL(h.h, Math.min(1, h.s + 0.25), Math.min(0.62, h.l + 0.1));
            m.emissiveIntensity = Math.max(m.emissiveIntensity ?? 1, 9);
            m.userData._baseEmissive = m.emissiveIntensity;
            this.neonMats.push(m);
          } else {
            // зал ТЕМНЕЕ (свет даёт только неон)
            if (m.color) { const h = {}; m.color.getHSL(h); m.color.setHSL(h.h, h.s * 0.55, Math.min(h.l * 0.22, 0.07)); }
            if (m.roughness !== undefined) m.roughness = Math.max(m.roughness ?? 0.5, 0.7);
          }
        });
      });

      this.club = club;
      this.group.add(club);
      // убираем ОДИН дальний вентилятор (узел «Fan», z меньше → у задней стены/окна); ближний «Fan3» оставляем
      club.traverse((o) => { if (o.name === 'Fan') o.visible = false; });

      // ENVIRONMENT MAP из сцены клуба → неон отражается/подсвечивает утку и объекты
      if (this.renderer) {
        try {
          const pmrem = new THREE.PMREMGenerator(this.renderer);
          const envRT = pmrem.fromScene(this.scene, 0.04);
          this.scene.environment = envRT.texture;
          this.scene.environmentIntensity = 1.2;
          if (this.onEnvReady) this.onEnvReady(envRT.texture);
          pmrem.dispose();
        } catch (e) { console.warn('PMREM env fail', e); }
      }

      // анимация (вентиляторы и т.д.)
      if (gltf.animations && gltf.animations.length) {
        this.mixer = new THREE.AnimationMixer(club);
        gltf.animations.forEach((clip) => this.mixer.clipAction(clip).play());
      }
      this.ready = true;
    }, undefined, (e) => {
      console.warn('Клуб не загрузился, фон-заглушка', e);
      this.scene.background = new THREE.Color(0x05030a);
    });
  }

  setColors() {}   // совместимость со старым вызовом

  update(t, camera, tp = 0, dt = 0.016) {
    if (this.mixer) this.mixer.update(dt);
    // неон мягко пульсирует относительно своей яркой базовой силы
    this.neonMats.forEach((m, i) => {
      const base = m.userData._baseEmissive || 6;
      m.emissiveIntensity = base * (0.9 + Math.sin(t * 1.6 + i * 0.5) * 0.1) * this._fade;
    });
    // отблески неона мягко дышат
    if (this.glowLights) this.glowLights.forEach((l, i) => { l.intensity = (5 + Math.sin(t * 1.4 + i) * 1.5) * this._fade; });
    // общий свет зала: множитель ambientMul задаётся из main (на FAQ сильно тише → фишки чёрные,
    // при этом стены/неон зала остаются видимыми) — иначе по _fade.
    const am = this.ambientMul !== undefined ? this.ambientMul : 1;
    if (this.ambient) this.ambient.intensity = this._ambientBase * am;
    if (this.key) this.key.intensity = this._keyBase * am;
    if (this.dust) {
      const p = this.dust.geometry.attributes.position;
      for (let i = 0; i < this.dustSeed.length; i++) p.array[i * 3 + 1] += Math.sin(t * 0.3 + this.dustSeed[i]) * 0.0015;
      p.needsUpdate = true;
      this.dust.rotation.y = t * 0.01;
      this.dust.material.opacity = 0.35 * this._fade;
    }
  }

  setVisibility() {}

  // amount 0..1 — на абстрактных секциях (мозг) приглушаем клуб. «Пол» видимости = this._floor
  // (обычно 0.25; для перехода в космос hideExtra опускает его до 0 → клуб исчезает на 100%).
  fade(amount) {
    this._fade = amount;
    const f0 = this._floor !== undefined ? this._floor : 0.25;
    if (this.club) {
      this.club.traverse((o) => {
        if (o.isMesh && o.material) {
          const mats = Array.isArray(o.material) ? o.material : [o.material];
          mats.forEach((m) => { if (m.userData._baseOpacity !== undefined) { m.transparent = true; m.opacity = m.userData._baseOpacity * (f0 + amount * (1 - f0)); } });
        }
      });
    }
  }

  // k 0..1 — снимает «пол» видимости клуба к нулю (полное исчезновение для перехода в космос) и
  // гасит группу целиком на пике. Обратимо: значения пересчитываются из базы каждый кадр в fade().
  hideExtra(k) {
    k = Math.max(0, Math.min(1, k));
    this._floor = 0.25 * (1 - k);
    if (this.group) this.group.visible = k < 0.992;
    this._fade *= (1 - k);   // неон/отблески тоже гаснут полностью (emissiveIntensity в update домножен на _fade)
  }
}
