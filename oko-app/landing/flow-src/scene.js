import * as THREE from 'three/webgpu';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { LineSegments2 } from 'three/examples/jsm/lines/LineSegments2.js';
import { LineSegmentsGeometry } from 'three/examples/jsm/lines/LineSegmentsGeometry.js';
import { LineMaterial } from 'three/examples/jsm/lines/LineMaterial.js';
import {
  Fn, compute, instanceIndex, instancedArray, uniform, float, int, vec2, vec3, vec4,
  sin, cos, abs, floor, fract, mix, step, smoothstep, dot, normalize,
  hash, storage, If, attribute, Loop,
  pass, mrt, output, emissive,
} from 'three/tsl';
import { bloom } from 'three/examples/jsm/tsl/display/BloomNode.js';

// --- Config ---
const LINE_COUNT = 4096;
const TRAIL_LENGTH = 64;
const TOTAL_POINTS = LINE_COUNT * TRAIL_LENGTH;
const BOUNDS = 6.0;

// --- Scene setup ---
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x060706);
const camera = new THREE.PerspectiveCamera(60, innerWidth / innerHeight, 0.1, 200);
camera.position.set(0, 6, 18);
const renderer = new THREE.WebGPURenderer({ antialias: true });
renderer.setSize(innerWidth, innerHeight);
renderer.setPixelRatio(devicePixelRatio);
const root = document.getElementById('root') ?? document.body;
root.appendChild(renderer.domElement);
await renderer.init();

// --- OKO: scroll + pointer driven camera (no OrbitControls) ---
let scrollP = 0, curP = 0, ppx = 0, ppy = 0, tpx = 0, tpy = 0;
function readScroll(){ const max = document.documentElement.scrollHeight - innerHeight; scrollP = max > 0 ? Math.min(1, Math.max(0, scrollY / max)) : 0; }
addEventListener('scroll', readScroll, { passive: true }); readScroll();
addEventListener('pointermove', e => { if (matchMedia('(hover:hover)').matches) { tpx = e.clientX / innerWidth - 0.5; tpy = e.clientY / innerHeight - 0.5; } }, { passive: true });
addEventListener('deviceorientation', e => { if (e.gamma != null) { tpx = Math.max(-0.5, Math.min(0.5, e.gamma / 40)); tpy = Math.max(-0.5, Math.min(0.5, (e.beta - 45) / 40)); } }, { passive: true });

// --- GPU Storage Buffers ---
const particlePos = instancedArray(LINE_COUNT, 'vec3');
const particleLife = instancedArray(LINE_COUNT, 'vec4'); // life, maxLife, speed, phase
const trailPositions = instancedArray(TOTAL_POINTS, 'vec4'); // xyz + alpha

// --- Uniforms ---
const uBounds = uniform(float(BOUNDS));
const uTrailLength = uniform(float(TRAIL_LENGTH));
const uNoiseScale = uniform(float(0.09));
const uTimeSpeed = uniform(float(0.4));
const uParticleSpeed = uniform(float(4.0));
const uBrightness = uniform(float(1.2));
const uCurlOctaves = uniform(float(2.0));
const uSpawnRadius = uniform(float(0.8));
const uTipIntensity = uniform(float(1.0));
const uTime = uniform(float(0.0));
const uDeltaTime = uniform(float(1.0 / 60.0));

// --- Color Palette Uniforms ---
// Each palette has 3 color pairs (6 vec3s): axisA_lo, axisA_hi, axisB_lo, axisB_hi, axisC_lo, axisC_hi
const palettes = {
  Cosmic: {
    aLo: [0.04, 0.06, 0.3],  aHi: [0.45, 0.08, 0.18],
    bLo: [0.03, 0.2, 0.1],   bHi: [0.35, 0.22, 0.5],
    cLo: [0.03, 0.25, 0.3],  cHi: [0.5, 0.25, 0.08],
  },
  Ocean: {
    aLo: [0.01, 0.06, 0.18], aHi: [0.05, 0.25, 0.45],
    bLo: [0.0, 0.12, 0.22],  bHi: [0.12, 0.4, 0.35],
    cLo: [0.02, 0.08, 0.15], cHi: [0.18, 0.38, 0.5],
  },
  Fire: {
    aLo: [0.2, 0.02, 0.0],   aHi: [0.5, 0.35, 0.03],
    bLo: [0.25, 0.04, 0.0],  bHi: [0.5, 0.15, 0.02],
    cLo: [0.12, 0.0, 0.0],   cHi: [0.5, 0.25, 0.0],
  },
  Neon: {
    aLo: [0.35, 0.0, 0.22],  aHi: [0.0, 0.4, 0.15],
    bLo: [0.0, 0.07, 0.4],   bHi: [0.4, 0.4, 0.0],
    cLo: [0.22, 0.0, 0.4],   cHi: [0.0, 0.4, 0.4],
  },
  Aurora: {
    aLo: [0.0, 0.28, 0.1],   aHi: [0.12, 0.04, 0.38],
    bLo: [0.0, 0.18, 0.18],  bHi: [0.04, 0.38, 0.15],
    cLo: [0.02, 0.22, 0.25], cHi: [0.25, 0.08, 0.32],
  },
  Ember: {
    aLo: [0.06, 0.0, 0.0],   aHi: [0.4, 0.06, 0.0],
    bLo: [0.12, 0.02, 0.0],  bHi: [0.45, 0.2, 0.04],
    cLo: [0.04, 0.0, 0.0],   cHi: [0.3, 0.08, 0.02],
  },
  OKO: {
    aLo: [0.02, 0.10, 0.0],  aHi: [0.55, 1.0, 0.0],
    bLo: [0.0, 0.14, 0.03],  bHi: [0.30, 0.80, 0.05],
    cLo: [0.01, 0.08, 0.02], cHi: [0.42, 0.95, 0.10],
  },
};

const uPalALo = uniform(vec3(...palettes.Cosmic.aLo));
const uPalAHi = uniform(vec3(...palettes.Cosmic.aHi));
const uPalBLo = uniform(vec3(...palettes.Cosmic.bLo));
const uPalBHi = uniform(vec3(...palettes.Cosmic.bHi));
const uPalCLo = uniform(vec3(...palettes.Cosmic.cLo));
const uPalCHi = uniform(vec3(...palettes.Cosmic.cHi));

// --- Per-line color variation: 5 sub-schemes per palette ---
// Each line gets a random scheme index (0-4) stored in a GPU buffer
// The scheme offsets the base palette with hue/tone shifts
const NUM_SCHEMES = 5;
const lineSchemeData = new Float32Array(LINE_COUNT);
for (let i = 0; i < LINE_COUNT; i++) {
  lineSchemeData[i] = Math.floor(Math.random() * NUM_SCHEMES);
}
const lineSchemeAttr = new THREE.StorageBufferAttribute(lineSchemeData, 1);
const lineSchemeStorage = storage(lineSchemeAttr, 'float', LINE_COUNT);

// Scheme color shift table — each scheme rotates/shifts the palette differently
// Stored as 5 x 3 vec3 offsets for lo, and 5 x 3 vec3 offsets for hi
const schemeShiftsLo = instancedArray(NUM_SCHEMES, 'vec3'); // hue-shift for lo colors
const schemeShiftsHi = instancedArray(NUM_SCHEMES, 'vec3'); // hue-shift for hi colors
const schemeBrightness = instancedArray(NUM_SCHEMES, 'float'); // brightness multiplier

// CPU-side scheme definitions: [loShift, hiShift, brightnessMul]
const schemeDefinitions = [
  { loShift: [0.0, 0.0, 0.0],    hiShift: [0.0, 0.0, 0.0],    bright: 1.0  },  // Original
  { loShift: [0.15, -0.05, 0.1],  hiShift: [-0.1, 0.2, -0.05], bright: 1.15 },  // Warm shift
  { loShift: [-0.05, 0.15, 0.05], hiShift: [0.1, -0.1, 0.2],   bright: 0.9  },  // Cool shift
  { loShift: [0.1, 0.1, -0.15],   hiShift: [0.15, 0.05, -0.1],  bright: 1.25 },  // Gold tint
  { loShift: [-0.1, 0.0, 0.2],    hiShift: [-0.15, 0.15, 0.1],  bright: 1.05 },  // Cyan tint
];

// Upload scheme data to GPU via init compute
const initSchemes = Fn(() => {
  const i = instanceIndex;
  // We'll encode the 5 schemes as constants using conditional assignment
})();

// Instead, we'll write scheme data from CPU each time palette changes
const schemeLoCPU = new Float32Array(NUM_SCHEMES * 3);
const schemeHiCPU = new Float32Array(NUM_SCHEMES * 3);
const schemeBrCPU = new Float32Array(NUM_SCHEMES);

function setPalette(name) {
  const p = palettes[name];
  uPalALo.value.set(...p.aLo);
  uPalAHi.value.set(...p.aHi);
  uPalBLo.value.set(...p.bLo);
  uPalBHi.value.set(...p.bHi);
  uPalCLo.value.set(...p.cLo);
  uPalCHi.value.set(...p.cHi);
}
// OKO brand palette by default
setPalette('OKO');

// --- Smooth 3D value noise for coherent flow ---
// Hash function: lattice point -> vec3 in [-1, 1]
const hash3 = Fn(([p_immutable]) => {
  const p = vec3(p_immutable).toVar();
  const px = fract(sin(dot(p, vec3(127.1, 311.7, 74.7))).mul(43758.5453));
  const py = fract(sin(dot(p, vec3(269.5, 183.3, 246.1))).mul(22578.1459));
  const pz = fract(sin(dot(p, vec3(113.5, 271.9, 124.6))).mul(31572.2973));
  return vec3(px, py, pz).mul(2.0).sub(1.0);
});

// Quintic smoothstep for C2-continuous interpolation
const quintic = Fn(([t_immutable]) => {
  const t = vec3(t_immutable).toVar();
  return t.mul(t).mul(t).mul(t.mul(t.mul(6.0).sub(15.0)).add(10.0));
});

// Smooth 3D noise: trilinear interpolation of hashed lattice values
const smoothNoise3 = Fn(([p_immutable]) => {
  const p = vec3(p_immutable).toVar();
  const i = floor(p).toVar();
  const f = fract(p).toVar();
  const u = quintic(f);

  // 8 corners of the unit cube
  const c000 = hash3(i);
  const c100 = hash3(i.add(vec3(1, 0, 0)));
  const c010 = hash3(i.add(vec3(0, 1, 0)));
  const c110 = hash3(i.add(vec3(1, 1, 0)));
  const c001 = hash3(i.add(vec3(0, 0, 1)));
  const c101 = hash3(i.add(vec3(1, 0, 1)));
  const c011 = hash3(i.add(vec3(0, 1, 1)));
  const c111 = hash3(i.add(vec3(1, 1, 1)));

  // Trilinear interpolation
  const x0 = mix(c000, c100, u.x);
  const x1 = mix(c010, c110, u.x);
  const x2 = mix(c001, c101, u.x);
  const x3 = mix(c011, c111, u.x);
  const y0 = mix(x0, x1, u.y);
  const y1 = mix(x2, x3, u.y);
  return mix(y0, y1, u.z);
});

// Curl of the smooth noise field via finite differences
const curlNoise = Fn(([p_immutable]) => {
  const p = vec3(p_immutable).toVar();
  const e = float(0.05);
  const dxp = smoothNoise3(p.add(vec3(e, 0, 0)));
  const dxn = smoothNoise3(p.sub(vec3(e, 0, 0)));
  const dyp = smoothNoise3(p.add(vec3(0, e, 0)));
  const dyn = smoothNoise3(p.sub(vec3(0, e, 0)));
  const dzp = smoothNoise3(p.add(vec3(0, 0, e)));
  const dzn = smoothNoise3(p.sub(vec3(0, 0, e)));
  const inv = float(1.0).div(e.mul(2.0));
  const x = dyp.z.sub(dyn.z).sub(dzp.y.sub(dzn.y)).mul(inv);
  const y = dzp.x.sub(dzn.x).sub(dxp.z.sub(dxn.z)).mul(inv);
  const z = dxp.y.sub(dxn.y).sub(dyp.x.sub(dyn.x)).mul(inv);
  const curl = vec3(x, y, z).toVar();
  const len = curl.length().max(0.0001);
  return curl.div(len);
});

// --- Init Compute: seed particles + trails ---
const initCompute = Fn(() => {
  const i = instanceIndex;
  // Use widely spaced seeds per particle so positions are uncorrelated
  const fi = float(i);
  const s1 = fract(sin(fi.mul(127.1)).mul(43758.5453));
  const s2 = fract(sin(fi.mul(269.5)).mul(22578.1459));
  const s3 = fract(sin(fi.mul(419.2)).mul(31572.2973));
  // Uniform distribution inside a sphere using cube-root for radius
  const theta = s1.mul(6.283185);
  const phi = s2.mul(2.0).sub(1.0).acos();
  const r = s3.pow(float(1.0 / 3.0)).mul(uBounds.mul(uSpawnRadius));
  const sinPhi = sin(phi);
  const pos = vec3(
    r.mul(sinPhi).mul(cos(theta)),
    r.mul(sinPhi).mul(sin(theta)),
    r.mul(cos(phi))
  );
  particlePos.element(i).assign(pos);
  const phase = fract(sin(fi.mul(631.7)).mul(9758.1234)).mul(6.283);
  const speed = mix(float(0.5), float(2.0), fract(sin(fi.mul(347.3)).mul(15823.7891)));
  particleLife.element(i).assign(vec4(phase, speed, float(0.0), float(0.0)));
})().compute(LINE_COUNT);

const initTrails = Fn(() => {
  const idx = instanceIndex;
  const lineIdx = int(floor(float(idx).div(uTrailLength)));
  const pos = particlePos.element(lineIdx);
  trailPositions.element(idx).assign(vec4(pos, float(0.0)));
})().compute(TOTAL_POINTS);

// --- Shift trails: shift from tail toward head (reverse order avoids overwrite) ---
// We process each line separately: copy point[j] = point[j-1] for j from TRAIL_LENGTH-1 down to 1
const shiftTrails = Fn(() => {
  const lineIdx = instanceIndex;
  const tl = int(uTrailLength);
  const baseIdx = lineIdx.mul(tl);

  // Simply shift positions down the trail — copy xyz+w as-is
  Loop({ start: tl.sub(1), end: int(0), type: 'int', condition: '>' }, ({ i }) => {
    const dst = baseIdx.add(i);
    const src = baseIdx.add(i.sub(1));
    trailPositions.element(dst).assign(trailPositions.element(src));
  });
})().compute(LINE_COUNT);

// --- Update particles: move with curl noise, manage life ---
const updateParticles = Fn(() => {
  const i = instanceIndex;
  const pos = particlePos.element(i).toVar();
  const lifeData = particleLife.element(i).toVar();
  const phase = lifeData.x;
  const speed = lifeData.y;

  const timeOffset = uTime.mul(uTimeSpeed).add(phase);
  const samplePos = pos.mul(uNoiseScale).add(vec3(timeOffset, float(0.0), timeOffset.mul(0.7)));

  // Layer multiple octaves of curl noise for richer flow
  const totalCurl = vec3(0.0, 0.0, 0.0).toVar();
  const amplitude = float(1.0).toVar();
  const freq = float(1.0).toVar();
  const ampSum = float(0.0).toVar();
  const octaves = int(uCurlOctaves);

  Loop({ start: int(0), end: octaves, type: 'int' }, () => {
    totalCurl.addAssign(curlNoise(samplePos.mul(freq)).mul(amplitude));
    ampSum.addAssign(amplitude);
    freq.mulAssign(2.1);
    amplitude.mulAssign(0.45);
  });
  totalCurl.divAssign(ampSum);

  const vel = totalCurl.mul(uParticleSpeed).mul(speed).mul(uDeltaTime);
  const newPos = pos.add(vel).toVar();

  // Random seed for respawn
  const s3Rand = fract(sin(float(i).mul(419.2).add(uTime.mul(0.1))).mul(31572.2973));

  // Soft wrap: spherical boundary — push particles back toward center when near radius
  const bounds = uBounds;
  const dist = newPos.length();

  // Respawn particles that escape far beyond bounds back into spawn radius
  const escaped = step(bounds.mul(1.2), dist);
  const respawnR = s3Rand.pow(float(1.0 / 3.0)).mul(uBounds.mul(uSpawnRadius));
  const respawnPos = normalize(newPos).mul(respawnR);
  newPos.assign(mix(newPos, respawnPos, escaped));

  const pushStrength = smoothstep(bounds.mul(0.6), bounds, dist).mul(uDeltaTime).mul(10.0);
  const pushDir = newPos.normalize().negate();
  newPos.addAssign(pushDir.mul(pushStrength));

  particlePos.element(i).assign(newPos);

  // Write head of trail — always full alpha (immortal particles)
  const baseIdx = i.mul(int(uTrailLength));
  trailPositions.element(baseIdx).assign(vec4(newPos, float(1.0)));
})().compute(LINE_COUNT);

// --- Build geometry for line rendering ---
// Use StorageBufferAttribute to bind GPU trail data directly to geometry

const posArray = new Float32Array(TOTAL_POINTS * 3);
const alphaArray = new Float32Array(TOTAL_POINTS);
const posAttr = new THREE.StorageBufferAttribute(posArray, 3);
const alphaAttr = new THREE.StorageBufferAttribute(alphaArray, 1);

// Build index buffer: line segments connecting consecutive trail points
const indices = [];
for (let l = 0; l < LINE_COUNT; l++) {
  const base = l * TRAIL_LENGTH;
  for (let p = 0; p < TRAIL_LENGTH - 1; p++) {
    indices.push(base + p, base + p + 1);
  }
}

const geometry = new THREE.BufferGeometry();
geometry.setAttribute('position', posAttr);
geometry.setAttribute('aAlpha', alphaAttr);
geometry.setIndex(indices);

// Storage references for compute → geometry writeback
const posStorage = storage(posAttr, 'vec3', TOTAL_POINTS);
const alphaStorage = storage(alphaAttr, 'float', TOTAL_POINTS);

const writeToGeometry = Fn(() => {
  const idx = instanceIndex;
  const data = trailPositions.element(idx);
  posStorage.element(idx).assign(data.xyz);

  // Compute linear fade along trail: head=1, tail=0, then multiply by head alpha
  const lineIdx = int(floor(float(idx).div(uTrailLength)));
  const localIdx = idx.sub(lineIdx.mul(int(uTrailLength)));
  const trailFade = float(1.0).sub(float(localIdx).div(uTrailLength.sub(1.0)));
  alphaStorage.element(idx).assign(data.w.mul(trailFade));
})().compute(TOTAL_POINTS);

// --- Run init ---
await renderer.computeAsync(initCompute);
await renderer.computeAsync(initTrails);

// --- Pre-warm: simulate ~3 seconds of flow so trails start beautiful ---
const PREWARM_STEPS = 360;
const PREWARM_DT = 1.0 / 60.0;
uDeltaTime.value = PREWARM_DT;
for (let i = 0; i < PREWARM_STEPS; i++) {
  uTime.value = i * PREWARM_DT;
  await renderer.computeAsync(shiftTrails);
  await renderer.computeAsync(updateParticles);
}
await renderer.computeAsync(writeToGeometry);



// --- Line Material (fat lines with simulated lighting) ---
const uLineWidth = uniform(float(3.0));
const lineMaterial = new THREE.LineBasicNodeMaterial({
  transparent: true,
  depthWrite: false,
});
lineMaterial.linewidthNode = uLineWidth;

// Per-vertex line index attribute for color variation
const lineIndexArray = new Float32Array(TOTAL_POINTS);
for (let l = 0; l < LINE_COUNT; l++) {
  const base = l * TRAIL_LENGTH;
  for (let p = 0; p < TRAIL_LENGTH; p++) {
    lineIndexArray[base + p] = l;
  }
}
const lineIndexAttr = new THREE.StorageBufferAttribute(lineIndexArray, 1);
geometry.setAttribute('aLineIdx', lineIndexAttr);

const trailColor = Fn(() => {
  const a = attribute('aAlpha', 'float');
  const lineIdx = attribute('aLineIdx', 'float');

  // Trail-based gradient: a=1 at head, a=0 at tail
  const t = a.pow(0.6);

  // Blend palette colors along the trail: head = hi colors, tail = lo colors
  const colA = mix(uPalALo, uPalAHi, t);
  const colB = mix(uPalBLo, uPalBHi, t);
  const colC = mix(uPalCLo, uPalCHi, t);

  // Mix the three palette channels together
  const baseCol = colA.mul(0.4).add(colB.mul(0.35)).add(colC.mul(0.25));

  // Per-line color variation using deterministic hash from line index
  // Generate 5 distinct scheme types based on line index
  const schemeHash = fract(sin(lineIdx.mul(127.1)).mul(43758.5453));
  const schemeId = floor(schemeHash.mul(float(NUM_SCHEMES)));

  // Scheme 0: original (no shift)
  // Scheme 1: warm — boost red/yellow, reduce blue
  // Scheme 2: cool — boost blue/cyan, reduce red
  // Scheme 3: gold — boost red+green, reduce blue
  // Scheme 4: mint — boost green+blue, reduce red

  const hueShift = fract(sin(lineIdx.mul(311.7)).mul(22578.1459)).mul(0.3).sub(0.15);
  
  // Rotate color channels based on scheme
  const r = baseCol.x.toVar();
  const g = baseCol.y.toVar();
  const b = baseCol.z.toVar();

  // Scheme 1: warm shift
  const isWarm = step(0.5, schemeId).mul(step(schemeId, float(1.5)));
  r.addAssign(isWarm.mul(0.12));
  g.addAssign(isWarm.mul(0.04));
  b.mulAssign(mix(float(1.0), float(0.5), isWarm));

  // Scheme 2: cool/cyan shift
  const isCool = step(1.5, schemeId).mul(step(schemeId, float(2.5)));
  r.mulAssign(mix(float(1.0), float(0.45), isCool));
  g.addAssign(isCool.mul(0.08));
  b.addAssign(isCool.mul(0.15));

  // Scheme 3: gold shift
  const isGold = step(2.5, schemeId).mul(step(schemeId, float(3.5)));
  r.addAssign(isGold.mul(0.15));
  g.addAssign(isGold.mul(0.1));
  b.mulAssign(mix(float(1.0), float(0.35), isGold));

  // Scheme 4: mint/teal shift
  const isMint = step(3.5, schemeId).mul(step(schemeId, float(4.5)));
  r.mulAssign(mix(float(1.0), float(0.4), isMint));
  g.addAssign(isMint.mul(0.12));
  b.addAssign(isMint.mul(0.08));

  // Apply subtle per-line hue variation on top
  r.addAssign(hueShift.mul(0.1));
  g.addAssign(hueShift.mul(0.05));

  const variedCol = vec3(r, g, b).max(vec3(0.0));

  // Brighten the tip
  const tipBoost = a.pow(0.3).mul(uTipIntensity).add(0.2);

  return variedCol.mul(a).mul(uBrightness).mul(tipBoost);
});

lineMaterial.colorNode = trailColor();
// Emissive heavily weighted toward the tip for bloom punch
lineMaterial.emissiveNode = trailColor().mul(0.9);

lineMaterial.opacityNode = attribute('aAlpha', 'float');

const linesMesh = new THREE.LineSegments(geometry, lineMaterial);
linesMesh.frustumCulled = false;
linesMesh.name = 'trailLines';
scene.add(linesMesh);

// --- Fog ---
scene.fog = new THREE.FogExp2(0x060706, 0.018);

// --- Post-processing: Bloom ---
const postProcessing = new THREE.PostProcessing(renderer);
const scenePass = pass(scene, camera);
scenePass.setMRT(mrt({ output, emissive }));

const scenePassColor = scenePass.getTextureNode('output');
const scenePassEmissive = scenePass.getTextureNode('emissive');

const bloomPass = bloom(scenePassEmissive, 2.2, 0.75, 0.15);

postProcessing.outputNode = scenePassColor.add(bloomPass);

// --- HUD ---
const link = document.createElement('link');
link.href = 'https://fonts.googleapis.com/css2?family=Inter:wght@400;500&display=swap';
link.rel = 'stylesheet';
document.head.appendChild(link);

// --- Control Panel ---
const panel = document.createElement('div');
panel.style.cssText = `
  position:fixed; top:16px; right:16px;
  font-family:'Inter',system-ui,sans-serif;
  font-size:11px; color:rgba(180,200,255,0.75);
  background:rgba(10,12,30,0.85);
  border:1px solid rgba(100,130,255,0.15);
  border-radius:8px; padding:14px 16px;
  min-width:200px; user-select:none;
  backdrop-filter:blur(8px);
  z-index:10;
`;

function makeSlider(label, min, max, step, value, onChange) {
  const row = document.createElement('div');
  row.style.cssText = 'margin-bottom:10px;';
  const lbl = document.createElement('div');
  lbl.style.cssText = 'display:flex;justify-content:space-between;margin-bottom:3px;';
  const nameSpan = document.createElement('span');
  nameSpan.textContent = label;
  const valSpan = document.createElement('span');
  valSpan.style.color = 'rgba(140,180,255,0.9)';
  valSpan.textContent = value.toFixed(2);
  lbl.appendChild(nameSpan);
  lbl.appendChild(valSpan);
  const input = document.createElement('input');
  input.type = 'range';
  input.min = min; input.max = max; input.step = step; input.value = value;
  input.style.cssText = 'width:100%;height:3px;accent-color:#6688ff;cursor:pointer;';
  input.addEventListener('input', () => {
    const v = parseFloat(input.value);
    valSpan.textContent = v.toFixed(2);
    onChange(v);
  });
  row.appendChild(lbl);
  row.appendChild(input);
  return row;
}

const title = document.createElement('div');
title.style.cssText = 'font-size:12px;color:rgba(180,200,255,0.9);margin-bottom:12px;letter-spacing:0.8px;';
title.textContent = 'CURL NOISE TRAILS';
panel.appendChild(title);

const info = document.createElement('div');
info.style.cssText = 'font-size:10px;color:rgba(140,170,255,0.5);margin-bottom:14px;';
info.textContent = `${LINE_COUNT.toLocaleString()} lines · ${TRAIL_LENGTH} seg · WebGPU`;
panel.appendChild(info);

panel.appendChild(makeSlider('Noise Scale', 0.01, 1.0, 0.01, 0.09, v => uNoiseScale.value = v));
panel.appendChild(makeSlider('Time Speed', 0.05, 1.0, 0.01, 0.4, v => uTimeSpeed.value = v));
panel.appendChild(makeSlider('Particle Speed', 0.5, 10.0, 0.1, 4.0, v => uParticleSpeed.value = v));
panel.appendChild(makeSlider('Brightness', 0.3, 4.0, 0.05, 1.2, v => uBrightness.value = v));
panel.appendChild(makeSlider('Curl Octaves', 1.0, 4.0, 1.0, 2.0, v => uCurlOctaves.value = v));
panel.appendChild(makeSlider('Tip Intensity', 0.1, 1.0, 0.01, 1.0, v => uTipIntensity.value = v));
panel.appendChild(makeSlider('Bloom Intensity', 0.0, 6.0, 0.1, 2.2, v => { bloomPass.strength.value = v; }));
panel.appendChild(makeSlider('Bloom Threshold', 0.0, 1.0, 0.01, 0.15, v => { bloomPass.threshold.value = v; }));



document.body.appendChild(panel);
panel.style.display = 'none'; // OKO: hide dev panel on the brand page

// --- FPS Counter ---
const fpsDiv = document.createElement('div');
fpsDiv.style.cssText = `
  position:fixed; top:16px; left:16px;
  font-family:'Inter',system-ui,sans-serif;
  font-size:12px; color:rgba(140,180,255,0.8);
  background:rgba(10,12,30,0.85);
  border:1px solid rgba(100,130,255,0.15);
  border-radius:6px; padding:6px 10px;
  backdrop-filter:blur(8px); z-index:10;
  letter-spacing:0.5px;
`;
document.body.appendChild(fpsDiv);
fpsDiv.style.display = 'none'; // OKO: hide FPS on the brand page
let fpsFrames = 0, fpsTime = performance.now();

// --- Animate ---
const clock = new THREE.Clock();
function animate() {
  const dt = clock.getDelta();
  uTime.value += dt;
  uDeltaTime.value = dt;
  // OKO: scroll drives a fly-in through the flow; pointer adds parallax
  curP += (scrollP - curP) * 0.06;
  ppx += (tpx - ppx) * 0.05; ppy += (tpy - ppy) * 0.05;
  const ang = curP * Math.PI * 1.15 + ppx * 0.7;
  const radius = 21 - curP * 13.5;
  camera.position.set(Math.sin(ang) * radius, 6 - curP * 3.2 + ppy * 4.0, Math.cos(ang) * radius);
  camera.lookAt(0, 0, 0);
  uTimeSpeed.value = 0.30 + curP * 0.55;
  uTipIntensity.value = 0.85 + curP * 0.15;
  fpsFrames++;
  const now = performance.now();
  if (now - fpsTime >= 500) {
    const fps = (fpsFrames / ((now - fpsTime) / 1000)).toFixed(0);
    fpsDiv.textContent = `${fps} FPS`;
    fpsFrames = 0;
    fpsTime = now;
  }
  renderer.compute(shiftTrails);
  renderer.compute(updateParticles);
  renderer.compute(writeToGeometry);
  postProcessing.render();
}
renderer.setAnimationLoop(animate);

window.addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});