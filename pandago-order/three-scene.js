/* ═══════════════════════════════════════════════════════════════
   PandaGo Cargo · Скролл-путешествие (Three.js через importmap)

   Одна постоянная 3D-сцена на весь сайт. Скролл двигает камеру
   вперёд по светящемуся маршруту, впереди едет байк-проводник.
   Этапы мира по ходу полёта:
     0  подиум и байк (hero, Гуанчжоу)
     1  коридор грузовых контейнеров (порт)
     2  тихая зона с дугой маршрута (калькулятор, читаемость)
     3  горные хребты (Монголия)
     4  башни и ворота-кольцо (Москва)
     5  затухание (форма заявки)

   Слои: GLSL-аврора на фоне + мир с туманом + поле точек.
   Модель: Motorcycle by Zsky (CC BY), poly.pizza, перекрашена в коде.

   Бюджет: низкополигональная процедурная геометрия без текстур,
   DPR ограничен, 30fps на мобильных, пауза при скрытой вкладке.
   При prefers-reduced-motion модуль не загружается вовсе.
   ═══════════════════════════════════════════════════════════════ */

import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';

/* ── Палитра ── */
const C = {
  navyDeep: 0x081833,
  navy: 0x0A1E42,
  royal: 0x1A3A7A,
  electric: 0x1A6BE0,
  cyan: 0x3B9EFF,
  soft: 0xA8D0FF,
};

/* ── Аврора-фон ── */
const VERT = `varying vec2 vUv; void main(){ vUv=uv; gl_Position=vec4(position.xy,0.,1.); }`;
const FRAG = `
  precision highp float;
  varying vec2 vUv;
  uniform float uTime; uniform vec2 uRes; uniform vec2 uPointer; uniform float uProg;
  const vec3 NAVY_DEEP=vec3(.031,.094,.200); const vec3 NAVY=vec3(.039,.118,.259);
  const vec3 ROYAL=vec3(.102,.227,.478); const vec3 ELECTRIC=vec3(.102,.420,.878);
  const vec3 CYAN=vec3(.231,.620,1.);
  float hash(vec2 p){ p=fract(p*vec2(123.34,456.21)); p+=dot(p,p+45.32); return fract(p.x*p.y); }
  float noise(vec2 p){ vec2 i=floor(p),f=fract(p); vec2 u=f*f*(3.-2.*f);
    return mix(mix(hash(i),hash(i+vec2(1,0)),u.x),mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),u.x),u.y); }
  float fbm(vec2 p){ float v=0.,a=.5; for(int i=0;i<5;i++){ v+=a*noise(p); p=p*2.02+vec2(37.1,11.7); a*=.5; } return v; }
  void main(){
    vec2 uv=vUv;
    vec2 p=(gl_FragCoord.xy-.5*uRes)/uRes.y;
    float t=uTime*.05 + uProg*4.0;          /* скролл гонит поток вперёд */
    p+=uPointer*.05;
    vec2 q=vec2(fbm(p*1.6+vec2(0.,t)),fbm(p*1.6+vec2(5.2,-t)));
    float flow=fbm(p*2.2+q*1.8+vec2(t*.6,t*.4));
    vec3 col=mix(NAVY_DEEP,NAVY,uv.y);
    col=mix(col,ROYAL,smoothstep(.35,1.,flow)*.7);
    float glow=smoothstep(.55,.95,flow)*smoothstep(0.,1.,uv.x*.6+uv.y*.6);
    /* к финалу аврора теплеет в электрик: город ближе */
    col+=mix(ELECTRIC,CYAN,uProg)*glow*(.35+uProg*.3);
    float lanes=0.;
    for(int i=0;i<3;i++){ float fi=float(i);
      float y=p.y+.12*fi-.15;
      float wave=sin((p.x*2.)+t*3.+fi*2.1)*.10;
      float d=abs(y-wave-(fbm(p*1.2+fi)-.5)*.3);
      lanes+=smoothstep(.035,0.,d)*(.5+.5*sin(p.x*3.-t*4.+fi)); }
    col+=CYAN*lanes*.3;
    float vig=smoothstep(1.25,.25,length(p));
    col*=.55+.55*vig;
    col+=(hash(gl_FragCoord.xy+uTime)-.5)*.03;
    gl_FragColor=vec4(col,1.);
  }`;

/* Детерминированный ряд, чтобы мир собирался одинаково */
let seed = 20260707;
const rnd = () => { seed = (seed * 1664525 + 1013904223) % 4294967296; return seed / 4294967296; };

const WORLD_LEN = 180;           /* длина полёта по z */

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

  /* ── Слой 1: аврора ── */
  const bgScene = new THREE.Scene();
  const bgCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  const uni = {
    uTime: { value: 0 },
    uRes: { value: new THREE.Vector2(1, 1) },
    uPointer: { value: new THREE.Vector2(0, 0) },
    uProg: { value: 0 },
  };
  bgScene.add(new THREE.Mesh(
    new THREE.PlaneGeometry(2, 2),
    new THREE.ShaderMaterial({ vertexShader: VERT, fragmentShader: FRAG, uniforms: uni, depthTest: false })
  ));

  /* ── Слой 2: мир ── */
  const world = new THREE.Scene();
  world.fog = new THREE.Fog(C.navyDeep, 12, isMobile ? 46 : 60);
  const cam = new THREE.PerspectiveCamera(50, 1, 0.1, 220);

  const pmrem = new THREE.PMREMGenerator(renderer);
  world.environment = pmrem.fromScene(new RoomEnvironment(), 0.03).texture;

  /* Десктоп: подменяем окружение реальной ночной HDRI (Poly Haven, CC0)
     для фотореалистичных отражений. Мобилка и офлайн остаются на Room. */
  if (!isMobile) {
    import('three/examples/jsm/loaders/RGBELoader.js').then(({ RGBELoader }) => {
      new RGBELoader().load(
        'https://dl.polyhaven.org/file/ph-assets/HDRIs/hdr/1k/dikhololo_night_1k.hdr',
        (tex) => { world.environment = pmrem.fromEquirectangular(tex).texture; tex.dispose(); },
        undefined,
        () => {} /* нет сети до polyhaven: остаёмся на RoomEnvironment */
      );
    }).catch(() => {});
  }

  const key = new THREE.DirectionalLight(0xffffff, 1.8); key.position.set(6, 10, 8); world.add(key);
  const rimC = new THREE.DirectionalLight(C.cyan, 2.8); rimC.position.set(-7, 4, -3); world.add(rimC);
  const rimE = new THREE.DirectionalLight(C.electric, 1.8); rimE.position.set(5, 2, -7); world.add(rimE);
  world.add(new THREE.AmbientLight(0x22406e, 0.55));

  /* ── Маршрут: змейка через весь мир ── */
  const routePts = [];
  for (let i = 0; i <= 18; i++) {
    const z = -(i / 18) * WORLD_LEN;
    routePts.push(new THREE.Vector3(Math.sin(i * 0.7) * 4.5, -1.1, z));
  }
  const route = new THREE.CatmullRomCurve3(routePts);
  const routeGeo = new THREE.BufferGeometry().setFromPoints(route.getPoints(isMobile ? 200 : 420));
  const routeMat = new THREE.LineDashedMaterial({
    color: C.cyan, transparent: true, opacity: 0.85, dashSize: 0.8, gapSize: 0.55,
  });
  const routeLine = new THREE.Line(routeGeo, routeMat);
  routeLine.computeLineDistances();
  world.add(routeLine);

  /* мягкая световая полоса под маршрутом */
  const glowGeo = new THREE.PlaneGeometry(3.2, WORLD_LEN + 20);
  const glowMat = new THREE.MeshBasicMaterial({
    color: C.electric, transparent: true, opacity: 0.10,
    blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide,
  });
  const roadGlow = new THREE.Mesh(glowGeo, glowMat);
  roadGlow.rotation.x = -Math.PI / 2;
  roadGlow.position.set(0, -1.35, -WORLD_LEN / 2);
  world.add(roadGlow);

  /* ── Поле точек по всей длине ── */
  const ptCount = isMobile ? 380 : 900;
  const ppos = new Float32Array(ptCount * 3);
  const psz = new Float32Array(ptCount);
  for (let i = 0; i < ptCount; i++) {
    ppos[i * 3] = (rnd() - 0.5) * 90;
    ppos[i * 3 + 1] = (rnd() - 0.5) * 44 + 6;
    ppos[i * 3 + 2] = -rnd() * (WORLD_LEN + 40) + 10;
    psz[i] = rnd() > 0.85 ? 2.4 : 1.0;
  }
  const ptGeo = new THREE.BufferGeometry();
  ptGeo.setAttribute('position', new THREE.BufferAttribute(ppos, 3));
  ptGeo.setAttribute('aScale', new THREE.BufferAttribute(psz, 1));
  const ptMat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    uniforms: { uTime: { value: 0 } },
    vertexShader: `attribute float aScale; uniform float uTime; varying float vA;
      void main(){ vec3 p=position; p.y+=sin(uTime*.5+position.x*.3)*.4;
        vec4 mv=modelViewMatrix*vec4(p,1.); gl_PointSize=aScale*2.2*(300./-mv.z);
        gl_Position=projectionMatrix*mv; vA=.3+.4*aScale; }`,
    fragmentShader: `varying float vA; void main(){ vec2 c=gl_PointCoord-.5;
      float d=smoothstep(.5,0.,length(c)); gl_FragColor=vec4(.66,.82,1.,d*vA); }`,
  });
  world.add(new THREE.Points(ptGeo, ptMat));

  /* ── Этап 1: коридор контейнеров (порт), z -28..-62 ── */
  const port = new THREE.Group();
  const edgeNear = new THREE.LineBasicMaterial({ color: C.electric, transparent: true, opacity: 0.8 });
  const edgeFar = new THREE.LineBasicMaterial({ color: C.royal, transparent: true, opacity: 0.6 });
  const edgeHot = new THREE.LineBasicMaterial({ color: C.cyan, transparent: true, opacity: 0.9 });
  const boxCount = isMobile ? 22 : 46;
  const disposables = [];
  for (let i = 0; i < boxCount; i++) {
    const w = 2.2 + rnd() * 2.6, h = 1.2 + rnd() * 1.6, d = 1.2 + rnd() * 1.6;
    const geo = new THREE.BoxGeometry(w, h, d);
    const edges = new THREE.EdgesGeometry(geo);
    disposables.push(geo, edges);
    const pick = rnd();
    const box = new THREE.LineSegments(edges, pick > 0.85 ? edgeHot : (pick > 0.45 ? edgeNear : edgeFar));
    const side = rnd() > 0.5 ? 1 : -1;
    box.position.set(side * (6 + rnd() * 9), -1.4 + Math.floor(rnd() * 3) * (h + 0.1) + h / 2, -28 - rnd() * 34);
    box.rotation.y = (rnd() - 0.5) * 0.2;
    port.add(box);
  }
  world.add(port);

  /* ── Этап 3: террейн-хребты по бокам коридора (Монголия), z -92..-138 ── */
  function ridge(sideX, zCenter) {
    const geo = new THREE.PlaneGeometry(46, 30, isMobile ? 30 : 60, isMobile ? 10 : 18);
    const pos = geo.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i), y = pos.getY(i); /* x вдоль трассы, y поперёк */
      const away = Math.abs(sideX) / 18 + Math.abs(y) / 30;   /* выше вдали от трассы */
      const n = Math.sin(x * 0.32 + zCenter * 0.15) * 2.4
        + Math.sin(x * 0.85 + y * 0.6) * 1.2
        + Math.sin(x * 2.1 + 1.3) * 0.5;
      pos.setZ(i, Math.max(0, (n + 2.6)) * (0.5 + away) * 1.15);
    }
    geo.computeVertexNormals();
    disposables.push(geo);
    const mesh = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({
      color: C.navyDeep, roughness: 1, metalness: 0.05, flatShading: true, envMapIntensity: 0.25,
    }));
    mesh.rotation.x = -Math.PI / 2;                            /* лежит как земля */
    mesh.rotation.z = Math.PI / 2;                             /* длинной стороной вдоль z */
    mesh.position.set(sideX, -1.7, zCenter);
    return mesh;
  }
  world.add(ridge(-21, -98), ridge(20, -108), ridge(-20, -122), ridge(22, -134));

  /* ── Этап 4: башни и ворота (Москва), z -142..-168, с зазором от трассы ── */
  const city = new THREE.Group();
  const towerMat = new THREE.MeshStandardMaterial({ color: 0x081833, roughness: 0.85, metalness: 0.15, envMapIntensity: 0.3 });
  const towerCount = isMobile ? 10 : 18;
  for (let i = 0; i < towerCount; i++) {
    const w = 1.4 + rnd() * 1.6, h = 5 + rnd() * 12;
    const geo = new THREE.BoxGeometry(w, h, w);
    const edges = new THREE.EdgesGeometry(geo);
    disposables.push(geo, edges);
    const side = rnd() > 0.5 ? 1 : -1;
    const z = -142 - rnd() * 26;
    const routeX = route.getPointAt(Math.min(-z / WORLD_LEN, 1)).x;
    const x = routeX + side * (7.5 + rnd() * 9);              /* всегда в стороне от пути камеры */
    const tower = new THREE.Mesh(geo, towerMat);
    tower.position.set(x, h / 2 - 1.6, z);
    const line = new THREE.LineSegments(edges, rnd() > 0.6 ? edgeHot : edgeNear);
    line.position.copy(tower.position);
    city.add(tower, line);
  }
  /* ворота-кольцо на финише маршрута */
  const gateGeo = new THREE.TorusGeometry(4.6, 0.1, 12, 60);
  disposables.push(gateGeo);
  const gate = new THREE.Mesh(gateGeo, new THREE.MeshStandardMaterial({
    color: 0x0a2a4a, emissive: C.cyan, emissiveIntensity: 2.2, roughness: 0.3, metalness: 0.5,
  }));
  const gateP = route.getPointAt(0.965);
  gate.position.set(gateP.x, 2.4, gateP.z);
  city.add(gate);
  world.add(city);

  /* ── Подиум под байком (hero) ── */
  const ringGeo = new THREE.TorusGeometry(3.1, 0.05, 10, 70);
  disposables.push(ringGeo);
  const ring = new THREE.Mesh(ringGeo, new THREE.MeshStandardMaterial({
    color: 0x0a2a4a, emissive: C.cyan, emissiveIntensity: 1.6, roughness: 0.35, metalness: 0.5,
  }));
  ring.rotation.x = Math.PI / 2;
  world.add(ring);

  /* ── Байк-проводник ── */
  const bike = new THREE.Group();
  world.add(bike);
  let bikeReady = false;
  const spin = { vel: 0, extra: 0, drag: false, lastX: 0 };

  new GLTFLoader().load('assets/models/moto.glb', (gltf) => {
    const obj = gltf.scene;
    const paint = new THREE.MeshStandardMaterial({ color: 0x0d1420, metalness: 0.85, roughness: 0.34 });
    const rubber = new THREE.MeshStandardMaterial({ color: 0x05080e, metalness: 0.2, roughness: 0.7 });
    const glowM = new THREE.MeshStandardMaterial({ color: 0x0a2a4a, emissive: C.cyan, emissiveIntensity: 2.6, metalness: 0.4, roughness: 0.3 });
    obj.traverse((n) => {
      if (!n.isMesh) return;
      const c0 = n.material && n.material.color ? n.material.color : null;
      const lum = c0 ? (c0.r * 0.3 + c0.g * 0.59 + c0.b * 0.11) : 0.2;
      if (c0 && lum > 0.6 && c0.r >= c0.b) n.material = glowM;
      else if (lum < 0.12) n.material = rubber;
      else n.material = paint;
    });
    const box = new THREE.Box3().setFromObject(obj);
    const size = box.getSize(new THREE.Vector3());
    const center = box.getCenter(new THREE.Vector3());
    const s = 5.4 / Math.max(size.x, size.y, size.z);
    obj.scale.setScalar(s);
    obj.position.sub(center.multiplyScalar(s));
    obj.position.y += (size.y * s) / 2 - 0.55;
    bike.add(obj);
    bikeReady = true;
  }, undefined, () => {});

  /* вращение байка пальцем/мышью в hero-зоне */
  const canvas = renderer.domElement;
  canvas.style.touchAction = 'pan-y';
  canvas.addEventListener('pointerdown', (e) => { spin.drag = true; spin.lastX = e.clientX; spin.vel = 0; });
  window.addEventListener('pointerup', () => { spin.drag = false; });
  window.addEventListener('pointermove', (e) => {
    if (spin.drag) {
      const dx = e.clientX - spin.lastX;
      spin.lastX = e.clientX;
      spin.vel = dx * 0.008;
      spin.extra += spin.vel;
    }
  }, { passive: true });

  /* ── Указатель ── */
  const pointer = { x: 0, y: 0, tx: 0, ty: 0 };
  const onMove = (e) => {
    const t = e.touches ? e.touches[0] : e;
    pointer.tx = (t.clientX / window.innerWidth - 0.5) * 2;
    pointer.ty = (t.clientY / window.innerHeight - 0.5) * 2;
  };
  if (!isMobile) window.addEventListener('pointermove', onMove, { passive: true });

  /* ── Прогресс скролла ── */
  const prog = { raw: 0, s: 0 };
  const readScroll = () => {
    const max = document.documentElement.scrollHeight - window.innerHeight;
    prog.raw = max > 0 ? Math.min(1, Math.max(0, window.scrollY / max)) : 0;
  };
  window.addEventListener('scroll', readScroll, { passive: true });
  readScroll();

  /* ── Ресайз ── */
  const onResize = () => {
    const w = container.clientWidth, h = container.clientHeight;
    renderer.setSize(w, h);
    uni.uRes.value.set(w * renderer.getPixelRatio(), h * renderer.getPixelRatio());
    cam.aspect = w / h;
    cam.updateProjectionMatrix();
  };
  window.addEventListener('resize', onResize, { passive: true });
  onResize();

  /* ── Пауза ── */
  let running = true;
  document.addEventListener('visibilitychange', () => { running = document.visibilityState === 'visible'; });

  const frameGap = isMobile ? 1000 / 30 : 0;
  let last = 0, t = 0;
  /* «мобильная» раскладка = узкий ИЛИ портретный вьюпорт (планшеты,
     полная версия на телефоне): байк уходит вниз и мельче, не наезжая
     на заголовок и кнопки */
  const mob = () => window.innerWidth < 768 || window.innerWidth < window.innerHeight * 0.95;
  const tmpA = new THREE.Vector3(), tmpB = new THREE.Vector3(), tmpT = new THREE.Vector3();

  function frame(now) {
    requestAnimationFrame(frame);
    if (!running) { last = now; return; }
    if (frameGap && now - last < frameGap) return;
    const dt = Math.min((now - last) / 1000 || 0.016, 0.05);
    last = now; t += dt;

    /* сглаженный прогресс */
    prog.s += (prog.raw - prog.s) * 0.09;
    const p = prog.s;

    pointer.x += (pointer.tx - pointer.x) * 0.04;
    pointer.y += (pointer.ty - pointer.y) * 0.04;
    uni.uTime.value = t;
    uni.uPointer.value.set(pointer.x, -pointer.y);
    uni.uProg.value = p;
    ptMat.uniforms.uTime.value = t;

    /* камера летит вдоль маршрута */
    const camT = Math.min(p * 0.94, 0.94);
    route.getPointAt(camT, tmpA);
    const heroLift = 1 - Math.min(p / 0.06, 1);     /* в hero камера чуть выше и правее */
    cam.position.set(
      tmpA.x + pointer.x * 1.4 + heroLift * 0.6,
      1.9 + heroLift * 0.4 - pointer.y * 0.8,
      tmpA.z + 7.5
    );

    /* байк едет впереди камеры */
    const bikeT = Math.min(camT + 0.035, 0.985);
    route.getPointAt(bikeT, tmpB);
    route.getTangentAt(bikeT, tmpT);
    if (bikeReady) {
      const sideOff = mob() ? 1.4 : 3.8;            /* смещение вправо, чтобы не спорил с текстом */
      const heroX = mob() ? 0.8 : 4.4;
      const blend = Math.min(p / 0.05, 1);          /* hero-поза -> путь */
      bike.position.set(
        tmpB.x + (1 - blend) * heroX + blend * sideOff,
        tmpB.y + 0.1 + Math.sin(t * 2.1) * 0.03,    /* дыхание подвески */
        tmpB.z
      );
      const heading = Math.atan2(tmpT.x, tmpT.z) + Math.PI;
      const heroYaw = 1.57 + spin.extra;
      bike.rotation.y = (1 - blend) * heroYaw + blend * (heading + spin.extra * 0.3);
      bike.rotation.z = Math.sin(t * 1.4) * 0.015 - tmpT.x * 0.18;  /* лёгкий крен в поворотах */
      if (!spin.drag) { spin.extra *= 0.96; spin.vel *= 0.9; }
      /* подиум следует под байком в hero, затем остаётся на старте */
      ring.position.set(bike.position.x, -1.32, (1 - blend) * bike.position.z + blend * -0.5);
      ring.material.opacity = 1;
      ring.visible = p < 0.12;
    }

    /* камера смотрит на точку чуть дальше байка, в hero смещаемся к байку справа */
    route.getPointAt(Math.min(camT + 0.05, 1), tmpT);
    const lookX = tmpT.x + (1 - Math.min(p / 0.06, 1)) * (mob() ? 0.6 : 2.6);
    cam.lookAt(lookX, 0.4, tmpT.z);

    /* пульс ворот и бегущий пунктир */
    gate.material.emissiveIntensity = 1.8 + Math.sin(t * 2.4) * 0.6;
    routeMat.scale = 1 + Math.sin(t * 1.1) * 0.12;

    renderer.clear();
    renderer.render(bgScene, bgCam);
    renderer.render(world, cam);
  }
  requestAnimationFrame(frame);

  return () => {
    window.removeEventListener('resize', onResize);
    window.removeEventListener('scroll', readScroll);
    if (!isMobile) window.removeEventListener('pointermove', onMove);
    for (const g of disposables) g.dispose();
    routeGeo.dispose(); ptGeo.dispose(); ptMat.dispose(); glowGeo.dispose();
    renderer.dispose(); renderer.domElement.remove();
  };
}
