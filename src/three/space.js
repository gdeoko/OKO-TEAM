import * as THREE from 'three';

// ============================================================
// КОСМИЧЕСКИЙ ФОН — звёздное поле с плавным движением + мягкие туманности (в духе MindOS,
// в бренд-палитре DUCK'S: холодный бело-голубой + красные/фиолетовые акценты на чёрном).
// Включается на переходе Дартс→Бильярд (по bk), служит фоном «перезагруженного» мира.
// API: group, setReveal(v 0..1), update(t, dt). Центрируется в мире, камера летит внутри поля.
// ============================================================

// мягкая круглая «частица» (радиальный градиент) — общая текстура для звёзд
function dotTexture() {
  const S = 64, c = document.createElement('canvas'); c.width = c.height = S;
  const x = c.getContext('2d');
  const g = x.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2);
  g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.35, 'rgba(255,255,255,0.85)');
  g.addColorStop(0.7, 'rgba(255,255,255,0.18)'); g.addColorStop(1, 'rgba(255,255,255,0)');
  x.fillStyle = g; x.fillRect(0, 0, S, S);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}

// мягкая туманность (большое размытое пятно цвета)
function nebulaTexture(rgb) {
  const S = 256, c = document.createElement('canvas'); c.width = c.height = S;
  const x = c.getContext('2d');
  const g = x.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2);
  g.addColorStop(0, `rgba(${rgb},0.55)`); g.addColorStop(0.5, `rgba(${rgb},0.18)`); g.addColorStop(1, `rgba(${rgb},0)`);
  x.fillStyle = g; x.fillRect(0, 0, S, S);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}

// палитра звёзд: преимущественно холодный бело-голубой, с редкими бренд-акцентами
const STAR_COLORS = [
  [0.82, 0.92, 1.0], [0.82, 0.92, 1.0], [0.82, 0.92, 1.0],   // бело-голубой (часто)
  [0.36, 0.62, 0.84], [0.36, 0.62, 0.84],                    // синий
  [0.9, 0.2, 0.18],                                          // красный (бренд)
  [0.6, 0.36, 0.9],                                          // фиолетовый
  [0.83, 0.66, 0.13],                                        // золотой (редко)
];

export class SpaceField {
  constructor() {
    this.group = new THREE.Group();
    this.group.visible = false;
    this._op = 0;

    // --- ЗВЁЗДЫ (шейдерные точки: мягкие, с мерцанием, общая прозрачность по uOpacity) ---
    const N = 1500;
    const pos = new Float32Array(N * 3), col = new Float32Array(N * 3), siz = new Float32Array(N), pha = new Float32Array(N);
    for (let i = 0; i < N; i++) {
      // распределяем в сферической оболочке вокруг центра (камера летит внутри полой зоны)
      const r = 6.5 + Math.pow(Math.random(), 0.6) * 34;
      const u = Math.random() * Math.PI * 2, v = Math.acos(2 * Math.random() - 1);
      pos[i * 3] = r * Math.sin(v) * Math.cos(u);
      pos[i * 3 + 1] = r * Math.sin(v) * Math.sin(u) * 0.7;   // чуть сплюснуто по Y
      pos[i * 3 + 2] = r * Math.cos(v);
      const cc = STAR_COLORS[(Math.random() * STAR_COLORS.length) | 0];
      col[i * 3] = cc[0]; col[i * 3 + 1] = cc[1]; col[i * 3 + 2] = cc[2];
      siz[i] = 0.9 + Math.random() * 3.0;
      pha[i] = Math.random() * Math.PI * 2;
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('aColor', new THREE.BufferAttribute(col, 3));
    g.setAttribute('aSize', new THREE.BufferAttribute(siz, 1));
    g.setAttribute('aPhase', new THREE.BufferAttribute(pha, 1));
    this.stars = new THREE.Points(g, new THREE.ShaderMaterial({
      uniforms: { uTime: { value: 0 }, uOpacity: { value: 0 }, uPix: { value: 140 }, uMap: { value: dotTexture() } },
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
      vertexShader: `
        attribute vec3 aColor; attribute float aSize; attribute float aPhase;
        uniform float uTime, uPix; varying vec3 vC; varying float vTw;
        void main(){
          vC = aColor;
          vTw = 0.7 + 0.3 * sin(uTime * 1.6 + aPhase);   // мерцание
          vec4 mv = modelViewMatrix * vec4(position, 1.0);
          gl_PointSize = aSize * uPix * vTw / max(-mv.z, 0.1);
          gl_Position = projectionMatrix * mv;
        }`,
      fragmentShader: `
        uniform sampler2D uMap; uniform float uOpacity; varying vec3 vC; varying float vTw;
        void main(){
          float a = texture2D(uMap, gl_PointCoord).a;
          gl_FragColor = vec4(vC, a * uOpacity * vTw);
        }`,
    }));
    this.group.add(this.stars);

    // --- ТУМАННОСТИ: несколько больших мягких пятен для глубины (бренд-цвета) ---
    this.nebulae = [];
    const NEB = [
      { rgb: '150,12,18', s: 26, p: [-12, 4, -22] },     // красная
      { rgb: '70,30,120', s: 30, p: [16, -6, -26] },     // фиолетовая
      { rgb: '20,60,110', s: 24, p: [4, 10, -30] },      // синяя
    ];
    NEB.forEach((n) => {
      const m = new THREE.Mesh(
        new THREE.PlaneGeometry(n.s, n.s),
        new THREE.MeshBasicMaterial({ map: nebulaTexture(n.rgb), transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending })
      );
      m.position.set(n.p[0], n.p[1], n.p[2]);
      this.group.add(m); this.nebulae.push(m);
    });
  }

  setReveal(v) {
    this._op = THREE.MathUtils.clamp(v, 0, 1);
    this.group.visible = this._op > 0.01;
    if (!this.group.visible) return;
    this.stars.material.uniforms.uOpacity.value = this._op;
    this.nebulae.forEach((m) => { m.material.opacity = 0.62 * this._op; });
  }

  update(t, dt) {
    if (!this.group.visible) return;
    this.stars.material.uniforms.uTime.value = t;
    // очень плавный дрейф всего поля (параллакс/«дыхание» космоса)
    this.group.rotation.y += dt * 0.012;
    this.group.rotation.x = Math.sin(t * 0.05) * 0.04;
    this.nebulae.forEach((m) => m.lookAt(0, 0, 100));   // туманности «лицом» примерно к камере
  }
}
