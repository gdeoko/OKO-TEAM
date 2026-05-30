import * as THREE from 'three';

// ============================================================
// Живой шейдерный фон-кино DUCK'S.
// Большая сфера вокруг камеры с процедурным «туманом/туманностью»
// (fbm-шум), который течёт во времени и двигается с камерой.
// Цвет плавно меняется по секциям (Hero=тёплый красный → мозг=холодный
// сине-фиолетовый). Плюс слои плавающей пыли для глубины (параллакс).
// API: update(t, camera), setColors(aHex,bHex), fade(amount), setVisibility().
// ============================================================

export class ClubEnvironment {
  constructor(scene, isMobile) {
    this.scene = scene;
    this.isMobile = isMobile;
    this.group = new THREE.Group();
    scene.add(this.group);
    this._fade = 1;
    this.colA = new THREE.Color(0x2a0608);   // тёплый тёмно-красный
    this.colB = new THREE.Color(0x0a0414);   // глубокий фиолетово-чёрный
    this.colAtarget = this.colA.clone();
    this.colBtarget = this.colB.clone();
    this._build();
  }

  _build() {
    // --- Шейдерная сфера-фон ---
    const geo = new THREE.SphereGeometry(60, 48, 32);
    this.mat = new THREE.ShaderMaterial({
      side: THREE.BackSide, depthWrite: false, fog: false,
      uniforms: {
        uTime: { value: 0 },
        uColA: { value: this.colA },
        uColB: { value: this.colB },
        uGlow: { value: new THREE.Color(0xff2a2a) },
        uFade: { value: 1 },
      },
      vertexShader: `
        varying vec3 vDir;
        void main(){
          vDir = normalize(position);
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0);
        }`,
      fragmentShader: `
        precision highp float;
        varying vec3 vDir;
        uniform float uTime; uniform vec3 uColA; uniform vec3 uColB; uniform vec3 uGlow; uniform float uFade;
        // hash/noise/fbm
        float hash(vec3 p){ p=fract(p*0.3183099+0.1); p*=17.0; return fract(p.x*p.y*p.z*(p.x+p.y+p.z)); }
        float noise(vec3 x){ vec3 i=floor(x), f=fract(x); f=f*f*(3.0-2.0*f);
          return mix(mix(mix(hash(i+vec3(0,0,0)),hash(i+vec3(1,0,0)),f.x),
                         mix(hash(i+vec3(0,1,0)),hash(i+vec3(1,1,0)),f.x),f.y),
                     mix(mix(hash(i+vec3(0,0,1)),hash(i+vec3(1,0,1)),f.x),
                         mix(hash(i+vec3(0,1,1)),hash(i+vec3(1,1,1)),f.x),f.y),f.z); }
        float fbm(vec3 p){ float v=0.0,a=0.5; for(int i=0;i<5;i++){ v+=a*noise(p); p*=2.0; a*=0.5; } return v; }
        void main(){
          vec3 d = normalize(vDir);
          float t = uTime*0.04;
          // текучий туман
          float n = fbm(d*2.2 + vec3(t, t*0.6, -t*0.4));
          n += 0.5*fbm(d*5.0 - vec3(t*0.7, 0.0, t*0.3));
          n = clamp(n*0.75, 0.0, 1.0);
          // вертикальный градиент (низ темнее)
          float grad = smoothstep(-0.6, 0.7, d.y);
          vec3 base = mix(uColB, uColA, n);
          base = mix(base, uColB*0.5, grad*0.4);
          // мягкие «свечения-туманности»
          float glow = pow(n, 2.5);
          base += uGlow * glow * 0.35;
          // звёздная крошка
          float st = step(0.997, hash(floor(d*420.0)));
          base += vec3(st)*0.6;
          base *= uFade;
          gl_FragColor = vec4(base, 1.0);
        }`,
    });
    this.sphere = new THREE.Mesh(geo, this.mat);
    this.sphere.frustumCulled = false;
    this.group.add(this.sphere);

    // --- Слои плавающей пыли (глубина/параллакс) ---
    const dn = this.isMobile ? 120 : 280;
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
    this.dust = new THREE.Points(dgeo, new THREE.PointsMaterial({ color: 0xc8e6ff, size: 0.04, transparent: true, opacity: 0.45, blending: THREE.AdditiveBlending, depthWrite: false }));
    this.group.add(this.dust);

    // --- Свет (HDR нет, поэтому свет даём вручную) ---
    this.scene.add(new THREE.AmbientLight(0x334455, 0.55));
    const key = new THREE.DirectionalLight(0xfff2e6, 1.5); key.position.set(3, 5, 7); this.scene.add(key);
    this.rim = new THREE.DirectionalLight(0x88ddff, 1.1); this.rim.position.set(-4, 2, -5); this.scene.add(this.rim);
    this.red = new THREE.PointLight(0xcc0000, 22, 28); this.red.position.set(-4, 1.5, -2); this.scene.add(this.red);
  }

  setColors(aHex, bHex) {
    this.colAtarget.set(aHex);
    this.colBtarget.set(bHex);
  }

  update(t, camera) {
    this.mat.uniforms.uTime.value = t;
    // плавный переход цветов
    this.colA.lerp(this.colAtarget, 0.03); this.colB.lerp(this.colBtarget, 0.03);
    this.mat.uniforms.uColA.value.copy(this.colA);
    this.mat.uniforms.uColB.value.copy(this.colB);
    this.mat.uniforms.uFade.value = 0.4 + this._fade * 0.6;
    if (camera) this.sphere.position.copy(camera.position);

    if (this.dust) {
      const p = this.dust.geometry.attributes.position;
      for (let i = 0; i < this.dustSeed.length; i++) p.array[i * 3 + 1] += Math.sin(t * 0.3 + this.dustSeed[i]) * 0.0015;
      p.needsUpdate = true;
      this.dust.rotation.y = t * 0.005;
      this.dust.material.opacity = 0.45 * this._fade;
    }
    if (this.red) this.red.intensity = (18 + Math.sin(t * 1.2) * 5) * this._fade;
  }

  setVisibility() {}
  fade(amount) { this._fade = amount; }
}
