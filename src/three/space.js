import * as THREE from 'three';

// ============================================================
// КОСМИЧЕСКИЙ ФОН в стиле MindOS — «созвездие/плексус»: точки, соединённые тонкими линиями,
// медленный дрейф, бренд-палитра (cyan/синий + редкий красный) на чёрном. Плотно, явно видно.
// Рисуется в 3D как слой-плита перед камерой (за шаром). Линии строятся каждый кадр по близости.
// API: group, setReveal(v 0..1), update(t, dt, pointerNX, pointerNY).
// ============================================================

// мягкая круглая точка (радиальный градиент)
function dotTexture() {
  const S = 64, c = document.createElement('canvas'); c.width = c.height = S;
  const x = c.getContext('2d');
  const g = x.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2);
  g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.4, 'rgba(255,255,255,0.8)');
  g.addColorStop(0.75, 'rgba(255,255,255,0.15)'); g.addColorStop(1, 'rgba(255,255,255,0)');
  x.fillStyle = g; x.fillRect(0, 0, S, S);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}

// палитра узлов (как MindOS): преимущественно cyan/синий, немного белого, редкий красный
const NODE_COLORS = [
  [0.0, 0.85, 1.0], [0.0, 0.85, 1.0], [0.0, 0.85, 1.0],   // cyan
  [0.36, 0.62, 0.84], [0.36, 0.62, 0.84],                  // синий
  [0.85, 0.92, 1.0],                                       // бело-голубой
  [0.85, 0.1, 0.12],                                       // красный (редко, бренд)
];
const LINE_RGB = [0.0, 0.78, 1.0];   // цвет линий — cyan

export class SpaceField {
  constructor(isMobile = false) {
    this.group = new THREE.Group();
    this.group.visible = false;
    this._op = 0;

    // зона узлов (плита перед камерой). Покрывает обзор на дистанции ~ |z поля − z камеры|.
    this.AREA_X = isMobile ? 16 : 24;
    this.AREA_Y = isMobile ? 22 : 16;
    this.AREA_Z = 6;                 // лёгкая глубина
    this.CONNECT = isMobile ? 3.0 : 2.7;   // дистанция связи
    const N = isMobile ? 120 : 170;
    this.N = N;

    this.px = new Float32Array(N); this.py = new Float32Array(N); this.pz = new Float32Array(N);
    this.vx = new Float32Array(N); this.vy = new Float32Array(N);
    const npos = new Float32Array(N * 3), ncol = new Float32Array(N * 3), nsiz = new Float32Array(N);
    for (let i = 0; i < N; i++) {
      this.px[i] = (Math.random() - 0.5) * this.AREA_X;
      this.py[i] = (Math.random() - 0.5) * this.AREA_Y;
      this.pz[i] = (Math.random() - 0.5) * this.AREA_Z;
      const sp = 0.18 + Math.random() * 0.22, ang = Math.random() * Math.PI * 2;
      this.vx[i] = Math.cos(ang) * sp; this.vy[i] = Math.sin(ang) * sp;
      const cc = NODE_COLORS[(Math.random() * NODE_COLORS.length) | 0];
      ncol[i * 3] = cc[0]; ncol[i * 3 + 1] = cc[1]; ncol[i * 3 + 2] = cc[2];
      nsiz[i] = (cc[0] > 0.8 && cc[1] < 0.3) ? 5 : 3 + Math.random() * 4;   // красные чуть крупнее
      npos[i * 3] = this.px[i]; npos[i * 3 + 1] = this.py[i]; npos[i * 3 + 2] = this.pz[i];
    }
    const ng = new THREE.BufferGeometry();
    ng.setAttribute('position', new THREE.BufferAttribute(npos, 3));
    ng.setAttribute('color', new THREE.BufferAttribute(ncol, 3));
    ng.setAttribute('aSize', new THREE.BufferAttribute(nsiz, 1));
    this.nodes = new THREE.Points(ng, new THREE.ShaderMaterial({
      uniforms: { uOpacity: { value: 0 }, uPix: { value: isMobile ? 60 : 90 }, uMap: { value: dotTexture() } },
      transparent: true, depthWrite: false, depthTest: false, blending: THREE.AdditiveBlending,
      vertexShader: `attribute vec3 color; attribute float aSize; varying vec3 vC;
        uniform float uPix; void main(){ vC = color; vec4 mv = modelViewMatrix * vec4(position,1.0);
        gl_PointSize = aSize * uPix / max(-mv.z, 0.1); gl_Position = projectionMatrix * mv; }`,
      fragmentShader: `uniform sampler2D uMap; uniform float uOpacity; varying vec3 vC;
        void main(){ float a = texture2D(uMap, gl_PointCoord).a; gl_FragColor = vec4(vC, a * uOpacity); }`,
    }));
    this.nodes.renderOrder = -2; this.nodes.frustumCulled = false;
    this.group.add(this.nodes);

    // линии (плексус) — преаллокация буфера, заполняем диапазон каждый кадр
    this.MAXE = N * 6;
    const lpos = new Float32Array(this.MAXE * 2 * 3), lcol = new Float32Array(this.MAXE * 2 * 3);
    const lg = new THREE.BufferGeometry();
    lg.setAttribute('position', new THREE.BufferAttribute(lpos, 3));
    lg.setAttribute('color', new THREE.BufferAttribute(lcol, 3));
    lg.setDrawRange(0, 0);
    this.lines = new THREE.LineSegments(lg, new THREE.LineBasicMaterial({
      vertexColors: true, transparent: true, opacity: 0, depthWrite: false, depthTest: false, blending: THREE.AdditiveBlending,
    }));
    this.lines.renderOrder = -2; this.lines.frustumCulled = false;
    this.group.add(this.lines);
  }

  setReveal(v) {
    this._op = THREE.MathUtils.clamp(v, 0, 1);
    this.group.visible = this._op > 0.01;
    if (!this.group.visible) return;
    this.nodes.material.uniforms.uOpacity.value = this._op;
    this.lines.material.opacity = this._op;
  }

  update(t, dt, pnx = 0, pny = 0) {
    if (!this.group.visible) return;
    const N = this.N, hx = this.AREA_X / 2, hy = this.AREA_Y / 2;
    const np = this.nodes.geometry.attributes.position.array;
    for (let i = 0; i < N; i++) {
      this.px[i] += this.vx[i] * dt; this.py[i] += this.vy[i] * dt;
      if (this.px[i] > hx) this.px[i] -= this.AREA_X; else if (this.px[i] < -hx) this.px[i] += this.AREA_X;
      if (this.py[i] > hy) this.py[i] -= this.AREA_Y; else if (this.py[i] < -hy) this.py[i] += this.AREA_Y;
      np[i * 3] = this.px[i]; np[i * 3 + 1] = this.py[i];
    }
    this.nodes.geometry.attributes.position.needsUpdate = true;

    // строим линии между близкими узлами
    const lp = this.lines.geometry.attributes.position.array;
    const lc = this.lines.geometry.attributes.color.array;
    const D = this.CONNECT, D2 = D * D; let e = 0; const maxE = this.MAXE;
    for (let i = 0; i < N && e < maxE; i++) {
      const xi = this.px[i], yi = this.py[i], zi = this.pz[i];
      for (let j = i + 1; j < N && e < maxE; j++) {
        const dx = xi - this.px[j], dy = yi - this.py[j];
        const d2 = dx * dx + dy * dy;
        if (d2 < D2) {
          const a = (1 - Math.sqrt(d2) / D) * 0.55;   // ярче когда ближе (alpha «вшит» в цвет, additive)
          const o = e * 6;
          lp[o] = xi; lp[o + 1] = yi; lp[o + 2] = zi;
          lp[o + 3] = this.px[j]; lp[o + 4] = this.py[j]; lp[o + 5] = this.pz[j];
          lc[o] = LINE_RGB[0] * a; lc[o + 1] = LINE_RGB[1] * a; lc[o + 2] = LINE_RGB[2] * a;
          lc[o + 3] = LINE_RGB[0] * a; lc[o + 4] = LINE_RGB[1] * a; lc[o + 5] = LINE_RGB[2] * a;
          e++;
        }
      }
    }
    this.lines.geometry.setDrawRange(0, e * 2);
    this.lines.geometry.attributes.position.needsUpdate = true;
    this.lines.geometry.attributes.color.needsUpdate = true;
  }
}
