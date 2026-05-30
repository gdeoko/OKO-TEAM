import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

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
  constructor(scene, isMobile) {
    this.scene = scene;
    this.isMobile = isMobile;
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

    // мягкий нейтральный свет, чтобы тёмные материалы читались, неон светит сам
    this.scene.add(new THREE.AmbientLight(0xffffff, 0.6));
    const key = new THREE.DirectionalLight(0xffffff, 0.8); key.position.set(3, 6, 7); this.scene.add(key);
    this.red = null;
  }

  _loadClub() {
    new GLTFLoader().load('/models/scifi_bar.glb', (gltf) => {
      const club = gltf.scene;
      // нормализуем размер и ставим так, чтобы камера была внутри
      const box = new THREE.Box3().setFromObject(club);
      const size = box.getSize(new THREE.Vector3());
      const center = box.getCenter(new THREE.Vector3());
      const scale = 30 / Math.max(size.x, size.y, size.z);
      club.scale.setScalar(scale);
      club.position.sub(center.multiplyScalar(scale));
      club.position.y -= 3.0;        // пол ниже утки
      club.position.z -= 8;          // зал уходит вглубь перед камерой (видно весь интерьер)

      // НЕ трогаем материалы — модель красивая сама по себе (оригинальный неон).
      // Только собираем светящиеся материалы для лёгкой пульсации и запоминаем opacity.
      club.traverse((o) => {
        if (!o.isMesh || !o.material) return;
        const mats = Array.isArray(o.material) ? o.material : [o.material];
        mats.forEach((m) => {
          m.transparent = true;
          if (m.userData._baseOpacity === undefined) m.userData._baseOpacity = (m.opacity ?? 1);
          const eLum = m.emissive ? (m.emissive.r + m.emissive.g + m.emissive.b) / 3 : 0;
          if (eLum > 0.02 || (m.emissiveIntensity ?? 0) > 1) {
            m.userData._baseEmissive = m.emissiveIntensity ?? 1;
            this.neonMats.push(m);
          }
        });
      });

      this.club = club;
      this.group.add(club);

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
    // неон мягко пульсирует относительно ОРИГИНАЛЬНОЙ силы (не перекрашиваем)
    this.neonMats.forEach((m, i) => {
      const base = m.userData._baseEmissive || 1;
      m.emissiveIntensity = base * (0.85 + Math.sin(t * 1.6 + i * 0.5) * 0.15) * this._fade;
    });
    if (this.dust) {
      const p = this.dust.geometry.attributes.position;
      for (let i = 0; i < this.dustSeed.length; i++) p.array[i * 3 + 1] += Math.sin(t * 0.3 + this.dustSeed[i]) * 0.0015;
      p.needsUpdate = true;
      this.dust.rotation.y = t * 0.01;
      this.dust.material.opacity = 0.35 * this._fade;
    }
  }

  setVisibility() {}

  // amount 0..1 — на абстрактных секциях (мозг) приглушаем клуб
  fade(amount) {
    this._fade = amount;
    if (this.club) {
      this.club.traverse((o) => {
        if (o.isMesh && o.material) {
          const mats = Array.isArray(o.material) ? o.material : [o.material];
          mats.forEach((m) => { if (m.userData._baseOpacity !== undefined) m.opacity = m.userData._baseOpacity * (0.25 + amount * 0.75); });
        }
      });
    }
  }
}
