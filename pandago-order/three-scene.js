/* ═══════════════════════════════════════════════════════════════
   PandaGo Cargo · 3D-фон hero-секции (Three.js через importmap)

   Три слоя:
   1. GLSL-шейдер: текучая сине-электрик аврора со световыми лентами.
   2. Поле светящихся точек-координат.
   3. Реальная 3D-модель мотоцикла: перекрашена в матовый чёрный с
      циан-фарой, студийное окружение для отражений, медленное
      авто-вращение и вращение пальцем (drag / touch).

   Модель: Motorcycle by Zsky (CC BY), poly.pizza. Кредит в футере.

   Бюджет: DPR ограничен, пауза при скрытой вкладке и вне экрана,
   30fps и упрощение на мобильных. При prefers-reduced-motion модуль
   не загружается (см. app.js), остаётся статичный градиент.
   ═══════════════════════════════════════════════════════════════ */

import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';

const VERT = `
  varying vec2 vUv;
  void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }
`;

const FRAG = `
  precision highp float;
  varying vec2 vUv;
  uniform float uTime;
  uniform vec2  uRes;
  uniform vec2  uPointer;
  const vec3 NAVY_DEEP = vec3(0.031, 0.094, 0.200);
  const vec3 NAVY      = vec3(0.039, 0.118, 0.259);
  const vec3 ROYAL     = vec3(0.102, 0.227, 0.478);
  const vec3 ELECTRIC  = vec3(0.102, 0.420, 0.878);
  const vec3 CYAN      = vec3(0.231, 0.620, 1.000);
  float hash(vec2 p){ p=fract(p*vec2(123.34,456.21)); p+=dot(p,p+45.32); return fract(p.x*p.y); }
  float noise(vec2 p){ vec2 i=floor(p),f=fract(p); vec2 u=f*f*(3.0-2.0*f);
    return mix(mix(hash(i),hash(i+vec2(1,0)),u.x),mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),u.x),u.y); }
  float fbm(vec2 p){ float v=0.0,a=0.5; for(int i=0;i<5;i++){ v+=a*noise(p); p=p*2.02+vec2(37.1,11.7); a*=0.5; } return v; }
  void main(){
    vec2 uv=vUv;
    vec2 p=(gl_FragCoord.xy-0.5*uRes)/uRes.y;
    float t=uTime*0.05;
    p+=uPointer*0.06;
    vec2 q=vec2(fbm(p*1.6+vec2(0.0,t)),fbm(p*1.6+vec2(5.2,-t)));
    float flow=fbm(p*2.2+q*1.8+vec2(t*0.6,t*0.4));
    vec3 col=mix(NAVY_DEEP,NAVY,uv.y);
    col=mix(col,ROYAL,smoothstep(0.35,1.0,flow)*0.7);
    float glow=smoothstep(0.55,0.95,flow)*smoothstep(0.0,1.0,uv.x*0.6+uv.y*0.6);
    col+=ELECTRIC*glow*0.45;
    float lanes=0.0;
    for(int i=0;i<3;i++){ float fi=float(i);
      float y=p.y+0.12*fi-0.15;
      float wave=sin((p.x*2.0)+t*3.0+fi*2.1)*0.10;
      float d=abs(y-wave-(fbm(p*1.2+fi)-0.5)*0.3);
      lanes+=smoothstep(0.035,0.0,d)*(0.5+0.5*sin(p.x*3.0-t*4.0+fi)); }
    col+=CYAN*lanes*0.35;
    float vig=smoothstep(1.25,0.25,length(p));
    col*=0.55+0.55*vig;
    col+=(hash(gl_FragCoord.xy+uTime)-0.5)*0.035;
    gl_FragColor=vec4(col,1.0);
  }
`;

export function initScene(container) {
  const isMobile = window.innerWidth < 768 ||
    (navigator.hardwareConcurrency && navigator.hardwareConcurrency <= 4);

  const renderer = new THREE.WebGLRenderer({ antialias: !isMobile, alpha: false, powerPreference: 'low-power' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, isMobile ? 1 : 1.6));
  renderer.setSize(container.clientWidth, container.clientHeight);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.1;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.autoClear = false;
  container.appendChild(renderer.domElement);

  /* ── Слой 1: шейдер-аврора ── */
  const scene = new THREE.Scene();
  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  const uniforms = {
    uTime: { value: 0 },
    uRes: { value: new THREE.Vector2(1, 1) },
    uPointer: { value: new THREE.Vector2(0, 0) },
  };
  const quad = new THREE.Mesh(
    new THREE.PlaneGeometry(2, 2),
    new THREE.ShaderMaterial({ vertexShader: VERT, fragmentShader: FRAG, uniforms, depthTest: false })
  );
  scene.add(quad);

  /* ── Слой 2 + 3: точки и мотоцикл ── */
  const world = new THREE.Scene();
  const cam = new THREE.PerspectiveCamera(48, 1, 0.1, 100);
  cam.position.set(0, 0.6, 26);

  const pmrem = new THREE.PMREMGenerator(renderer);
  world.environment = pmrem.fromScene(new RoomEnvironment(), 0.03).texture;

  /* холодный студийный свет */
  const key = new THREE.DirectionalLight(0xffffff, 2.0); key.position.set(6, 9, 8); world.add(key);
  const rimC = new THREE.DirectionalLight(0x3B9EFF, 3.2); rimC.position.set(-7, 3, -3); world.add(rimC);
  const rimE = new THREE.DirectionalLight(0x1A6BE0, 2.0); rimE.position.set(5, 1, -7); world.add(rimE);
  world.add(new THREE.AmbientLight(0x22406e, 0.5));

  /* точки-координаты */
  let seed = 20260706;
  const rnd = () => { seed = (seed * 1664525 + 1013904223) % 4294967296; return seed / 4294967296; };
  const ptCount = isMobile ? 130 : 320;
  const ppos = new Float32Array(ptCount * 3);
  const psz = new Float32Array(ptCount);
  for (let i = 0; i < ptCount; i++) {
    ppos[i * 3] = (rnd() - 0.5) * 70;
    ppos[i * 3 + 1] = (rnd() - 0.5) * 40;
    ppos[i * 3 + 2] = -6 - rnd() * 34;
    psz[i] = rnd() > 0.85 ? 2.4 : 1.0;
  }
  const ptGeo = new THREE.BufferGeometry();
  ptGeo.setAttribute('position', new THREE.BufferAttribute(ppos, 3));
  ptGeo.setAttribute('aScale', new THREE.BufferAttribute(psz, 1));
  const ptMat = new THREE.ShaderMaterial({
    transparent: true, depthTest: false, blending: THREE.AdditiveBlending,
    uniforms: { uTime: { value: 0 } },
    vertexShader: `attribute float aScale; uniform float uTime; varying float vA;
      void main(){ vec3 p=position; p.y+=sin(uTime*0.5+position.x*0.3)*0.4;
        vec4 mv=modelViewMatrix*vec4(p,1.0); gl_PointSize=aScale*2.2*(300.0/-mv.z);
        gl_Position=projectionMatrix*mv; vA=0.32+0.4*aScale; }`,
    fragmentShader: `varying float vA; void main(){ vec2 c=gl_PointCoord-0.5;
      float d=smoothstep(0.5,0.0,length(c)); gl_FragColor=vec4(0.66,0.82,1.0,d*vA); }`,
  });
  const points = new THREE.Points(ptGeo, ptMat);
  world.add(points);

  /* ── Мотоцикл ── */
  const bike = new THREE.Group();
  world.add(bike);
  const spin = { vel: 0, base: 1.57, drag: false, lastX: 0 };
  let bikeReady = false;

  const placeBike = () => {
    /* десктоп: справа от текста; мобилка: ниже по центру, мельче */
    const mob = window.innerWidth < 768;
    if (mob) { bike.position.set(0.6, -4.0, 1); bike.scale.setScalar(0.66); }
    else { bike.position.set(4.5, -0.4, 2); bike.scale.setScalar(1.08); }
  };

  new GLTFLoader().load('assets/models/moto.glb', (gltf) => {
    const obj = gltf.scene;
    const paint = new THREE.MeshStandardMaterial({ color: 0x0d1420, metalness: 0.85, roughness: 0.34 });
    const rubber = new THREE.MeshStandardMaterial({ color: 0x05080e, metalness: 0.2, roughness: 0.7 });
    const glow = new THREE.MeshStandardMaterial({ color: 0x0a2a4a, emissive: 0x3B9EFF, emissiveIntensity: 2.6, metalness: 0.4, roughness: 0.3 });
    obj.traverse((n) => {
      if (!n.isMesh) return;
      const c = n.material && n.material.color ? n.material.color : null;
      const lum = c ? (c.r * 0.3 + c.g * 0.59 + c.b * 0.11) : 0.2;
      if (c && lum > 0.6 && c.r >= c.b) n.material = glow;
      else if (lum < 0.12) n.material = rubber;
      else n.material = paint;
    });
    const box = new THREE.Box3().setFromObject(obj);
    const size = box.getSize(new THREE.Vector3());
    const center = box.getCenter(new THREE.Vector3());
    const scale = 6.4 / Math.max(size.x, size.y, size.z);
    obj.scale.setScalar(scale);
    obj.position.sub(center.multiplyScalar(scale));
    bike.add(obj);
    bike.rotation.y = spin.base;
    placeBike();
    bikeReady = true;
  }, undefined, () => { /* нет модели или сети: hero остаётся с авророй */ });

  /* drag / touch вращение мотоцикла */
  const canvas = renderer.domElement;
  canvas.style.touchAction = 'pan-y';
  canvas.addEventListener('pointerdown', (e) => { spin.drag = true; spin.lastX = e.clientX; spin.vel = 0; });
  window.addEventListener('pointerup', () => { spin.drag = false; });
  window.addEventListener('pointermove', (e) => {
    if (spin.drag) { const dx = e.clientX - spin.lastX; spin.lastX = e.clientX; spin.vel = dx * 0.01; bike.rotation.y += spin.vel; }
  }, { passive: true });

  /* ── Указатель для параллакса шейдера ── */
  const pointer = { x: 0, y: 0, tx: 0, ty: 0 };
  const onMove = (e) => {
    const tt = e.touches ? e.touches[0] : e;
    pointer.tx = (tt.clientX / window.innerWidth - 0.5) * 2;
    pointer.ty = (tt.clientY / window.innerHeight - 0.5) * 2;
  };
  if (!isMobile) window.addEventListener('pointermove', onMove, { passive: true });

  /* ── Ресайз ── */
  const onResize = () => {
    const w = container.clientWidth, h = container.clientHeight;
    renderer.setSize(w, h);
    uniforms.uRes.value.set(w * renderer.getPixelRatio(), h * renderer.getPixelRatio());
    cam.aspect = w / h; cam.updateProjectionMatrix();
    if (bikeReady) placeBike();
  };
  window.addEventListener('resize', onResize, { passive: true });
  onResize();

  /* ── Пауза ── */
  let running = true, inView = true;
  document.addEventListener('visibilitychange', () => { running = document.visibilityState === 'visible'; });
  const io = new IntersectionObserver((es) => { inView = es[0].isIntersecting; }, { threshold: 0 });
  io.observe(container);

  const frameGap = isMobile ? 1000 / 30 : 0;
  let last = 0, t = 0;

  function frame(now) {
    requestAnimationFrame(frame);
    if (!running || !inView) { last = now; return; }
    if (frameGap && now - last < frameGap) return;
    const dt = Math.min((now - last) / 1000 || 0.016, 0.05);
    last = now; t += dt;

    pointer.x += (pointer.tx - pointer.x) * 0.04;
    pointer.y += (pointer.ty - pointer.y) * 0.04;
    uniforms.uTime.value = t;
    uniforms.uPointer.value.set(pointer.x, -pointer.y);
    ptMat.uniforms.uTime.value = t;
    points.rotation.y = t * 0.02;

    if (bikeReady && !spin.drag) {
      bike.rotation.y += 0.12 * dt + spin.vel;   // авто-вращение + инерция
      spin.vel *= 0.94;
    }

    cam.position.x = pointer.x * 1.6;
    cam.position.y = 0.6 - pointer.y * 1.0;
    cam.lookAt(0, 0, 0);

    renderer.clear();
    renderer.render(scene, camera);
    renderer.render(world, cam);
  }
  requestAnimationFrame(frame);

  return () => {
    io.disconnect();
    window.removeEventListener('resize', onResize);
    if (!isMobile) window.removeEventListener('pointermove', onMove);
    quad.geometry.dispose(); quad.material.dispose();
    ptGeo.dispose(); ptMat.dispose();
    renderer.dispose(); renderer.domElement.remove();
  };
}
