/* ЗооОпт — WebGL «товар оживает»: пачка → гранулы → миска на скролле.
   Real-time Three.js + UnrealBloom + PBR-отражения (RoomEnvironment). GSAP+Lenis скраб.
   0 кредитов, грузится мгновенно, камера летит, чётко на любом экране. */
import * as THREE from 'three';
import {EffectComposer} from './vendor/jsm/postprocessing/EffectComposer.js';
import {RenderPass} from './vendor/jsm/postprocessing/RenderPass.js';
import {UnrealBloomPass} from './vendor/jsm/postprocessing/UnrealBloomPass.js';
import {OutputPass} from './vendor/jsm/postprocessing/OutputPass.js';
import {RoomEnvironment} from './vendor/jsm/environments/RoomEnvironment.js';

const gsap=window.gsap, ScrollTrigger=window.ScrollTrigger, Lenis=window.Lenis;
gsap.registerPlugin(ScrollTrigger);
const RM=matchMedia('(prefers-reduced-motion: reduce)').matches;
const MOB=Math.min(innerWidth,innerHeight)<640;
const clamp=(x,a=0,b=1)=>Math.min(b,Math.max(a,x));
const smoot=(a,b,x)=>{const t=clamp((x-a)/(b-a));return t*t*(3-2*t);};
const smoother=(a,b,x)=>{const t=clamp((x-a)/(b-a));return t*t*t*(t*(t*6-15)+10);};
const lerp=(a,b,t)=>a+(b-a)*t;

const canvas=document.getElementById('gl');
const renderer=new THREE.WebGLRenderer({canvas,antialias:!MOB,alpha:false,powerPreference:'high-performance'});
renderer.setPixelRatio(Math.min(devicePixelRatio,MOB?2:1.75));
renderer.setSize(innerWidth,innerHeight);
renderer.toneMapping=THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure=1.12;
renderer.outputColorSpace=THREE.SRGBColorSpace;

const scene=new THREE.Scene();
scene.background=new THREE.Color(0x03120b);
scene.fog=new THREE.FogExp2(0x03120b, 0.05);

const camera=new THREE.PerspectiveCamera(42, innerWidth/innerHeight, 0.1, 100);
camera.position.set(0,1.2,8.4);

/* PBR-окружение для реалистичных отражений металла/пачки */
const pmrem=new THREE.PMREMGenerator(renderer);
scene.environment=pmrem.fromScene(new RoomEnvironment(), 0.04).texture;

/* ─── свет: тёплый ключ + изумрудный контровой + заполнение ─── */
scene.add(new THREE.AmbientLight(0x3a5a48, 0.55));
const key=new THREE.SpotLight(0xffe8b0, 55, 30, Math.PI/6, 0.4, 1.4);
key.position.set(4.5,8,5.5); scene.add(key); scene.add(key.target);
const rim=new THREE.SpotLight(0x2effa0, 26, 30, Math.PI/5, 0.6, 1.5);
rim.position.set(-6,3.5,-3); scene.add(rim); scene.add(rim.target);
const fill=new THREE.PointLight(0xffd34d, 8, 20, 2); fill.position.set(-2,1.5,4); scene.add(fill);

/* ─── пол: тёмный, лёгкий отблеск ─── */
const floor=new THREE.Mesh(
  new THREE.CircleGeometry(26,64),
  new THREE.MeshStandardMaterial({color:0x061c11, roughness:0.42, metalness:0.5})
);
floor.rotation.x=-Math.PI/2; floor.position.y=-1.65; scene.add(floor);

/* ─── пьедестал ─── */
const ped=new THREE.Group();
const pedTop=new THREE.Mesh(new THREE.CylinderGeometry(1.55,1.55,0.22,64),
  new THREE.MeshStandardMaterial({color:0x0c2a1a, roughness:0.3, metalness:0.7}));
pedTop.position.y=-1.42;
const pedBody=new THREE.Mesh(new THREE.CylinderGeometry(1.35,1.55,1.0,64),
  new THREE.MeshStandardMaterial({color:0x081f13, roughness:0.55, metalness:0.4}));
pedBody.position.y=-2.02;
ped.add(pedTop,pedBody); scene.add(ped);

/* ─── этикетка пачки (canvas-текстура, бренд) ─── */
function packTexture(){
  const c=document.createElement('canvas'); c.width=512; c.height=680; const x=c.getContext('2d');
  const g=x.createLinearGradient(0,0,0,680); g.addColorStop(0,'#0f5c24'); g.addColorStop(1,'#0a3d18');
  x.fillStyle=g; x.fillRect(0,0,512,680);
  x.fillStyle='rgba(255,213,0,.14)'; x.fillRect(0,0,512,150);
  // луна-эмблема
  x.beginPath(); x.arc(256,150,66,0,7); x.fillStyle='#FFD500'; x.fill();
  x.beginPath(); x.arc(232,150,52,0,7); x.fillStyle='#0a3d18'; x.fill();
  x.fillStyle='#F5F1E8'; x.font='800 62px Unbounded, sans-serif'; x.textAlign='center';
  x.fillText('ЗооОпт', 256, 300);
  x.fillStyle='#FFD500'; x.font='700 26px JetBrains Mono, monospace';
  x.fillText('ПРЕМИУМ КОРМ', 256, 350);
  x.strokeStyle='rgba(255,255,255,.25)'; x.lineWidth=3; x.strokeRect(40,400,432,230);
  x.fillStyle='rgba(245,241,232,.85)'; x.font='500 24px Onest, sans-serif';
  x.fillText('мясо · злаки · витамины', 256, 470);
  x.fillText('для собак и кошек', 256, 512);
  const t=new THREE.CanvasTexture(c); t.colorSpace=THREE.SRGBColorSpace; t.anisotropy=4; return t;
}
const packMat=new THREE.MeshStandardMaterial({map:packTexture(), roughness:0.55, metalness:0.12});
const packSideMat=new THREE.MeshStandardMaterial({color:0x0c4a1e, roughness:0.6, metalness:0.12});
const pack=new THREE.Mesh(new THREE.BoxGeometry(1.7,2.3,0.62,1,1,1),
  [packSideMat,packSideMat,packSideMat,packSideMat,packMat,packSideMat]);
pack.position.y=0.05; scene.add(pack);
// материалы пачки прозрачные (для растворения)
[packMat,packSideMat].forEach(m=>{m.transparent=true;});

/* ─── миска (металл, LatheGeometry) — появляется в финале ─── */
function bowlGeo(){
  const pts=[]; const R=1.75, H=0.95;
  for(let i=0;i<=14;i++){const t=i/14; const r=R*Math.sin(t*Math.PI*0.5); const y=-H*Math.cos(t*Math.PI*0.5)+H*0.15; pts.push(new THREE.Vector2(r*0.62+0.02, y));}
  // внешняя стенка обратно
  for(let i=14;i>=0;i--){const t=i/14; const r=(R*Math.sin(t*Math.PI*0.5))*0.62+0.14; const y=-H*Math.cos(t*Math.PI*0.5)+H*0.15+0.02; pts.push(new THREE.Vector2(r, y));}
  return new THREE.LatheGeometry(pts, 96);
}
const bowl=new THREE.Mesh(bowlGeo(),
  new THREE.MeshStandardMaterial({color:0xcdd3da, roughness:0.18, metalness:0.95, transparent:true, opacity:0}));
bowl.position.y=-1.28; scene.add(bowl);

/* ─── гранулы: InstancedMesh ─── */
const COUNT=MOB?900:1700;
const kGeo=new THREE.IcosahedronGeometry(0.058, 0);
const kMat=new THREE.MeshStandardMaterial({roughness:0.5, metalness:0.05, vertexColors:false});
const kib=new THREE.InstancedMesh(kGeo, kMat, COUNT);
kib.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
scene.add(kib);
// цвет по инстансу (оттенки корма)
const palette=[new THREE.Color(0x7a4a22),new THREE.Color(0x9c6a2f),new THREE.Color(0xb98a45),new THREE.Color(0x5f3617),new THREE.Color(0xcaa15a)];
for(let i=0;i<COUNT;i++) kib.setColorAt(i, palette[i%palette.length]);
kib.instanceColor.needsUpdate=true;

/* позиции трёх состояний на инстанс */
const P0=new Float32Array(COUNT*3); // внутри пачки
const P1=new Float32Array(COUNT*3); // взрыв (облако)
const P2=new Float32Array(COUNT*3); // в миске
const SPIN=new Float32Array(COUNT*3); // ось вращения фаза
const rand=(a,b)=>a+Math.random()*(b-a);
for(let i=0;i<COUNT;i++){
  const i3=i*3;
  // старт — в объёме пачки
  P0[i3]=rand(-0.7,0.7); P0[i3+1]=0.05+rand(-1.0,1.0); P0[i3+2]=rand(-0.22,0.22);
  // взрыв — сфера-облако с вытянутостью вверх
  const u=Math.random(), v=Math.random(); const th=u*Math.PI*2, ph=Math.acos(2*v-1);
  const rr=rand(2.4,4.4);
  P1[i3]=Math.sin(ph)*Math.cos(th)*rr; P1[i3+1]=Math.cos(ph)*rr*0.7+0.6; P1[i3+2]=Math.sin(ph)*Math.sin(th)*rr*0.8;
  // миска — насыпь-горка в чаше (в центре выше, по краям ниже)
  const rq=Math.sqrt(Math.random())*0.96; const ta=Math.random()*Math.PI*2;
  P2[i3]=Math.cos(ta)*rq; P2[i3+2]=Math.sin(ta)*rq;
  P2[i3+1]=-1.04 + (1-rq*rq)*0.5 + rand(0,0.1);
  SPIN[i3]=rand(0,6.28); SPIN[i3+1]=rand(0.5,2); SPIN[i3+2]=rand(0,6.28);
}
const dummy=new THREE.Object3D();

/* ─── прогресс скролла ─── */
let P=0, PT=0;               // target / smoothed
const mouse={x:0,y:0,tx:0,ty:0};
if(!RM && !MOB) addEventListener('pointermove',e=>{mouse.tx=(e.clientX/innerWidth-0.5); mouse.ty=(e.clientY/innerHeight-0.5);});

const caps=[document.getElementById('cap0'),document.getElementById('cap1'),document.getElementById('cap2')];
const pbar=document.getElementById('pbar'), hint=document.getElementById('hint');

function updateCaps(p){
  // окна: cap0 .0-.3, cap1 .34-.66, cap2 .74-1
  const a0=(1-smoot(.22,.34,p));
  const a1=smoot(.34,.44,p)*(1-smoot(.62,.72,p));
  const a2=smoot(.76,.86,p);
  const set=(el,a,dir)=>{el.style.opacity=a.toFixed(3); el.style.transform=`translateY(${(1-a)*dir}px)`;};
  set(caps[0],a0,-26); set(caps[1],a1,30); set(caps[2],a2,30);
  pbar.style.width=(p*100).toFixed(1)+'%';
  if(hint) hint.style.opacity=(1-smoot(.02,.1,p)).toFixed(3);
}

/* ─── главный рендер ─── */
const _m=new THREE.Matrix4(), _q=new THREE.Quaternion(), _e=new THREE.Euler(), _v=new THREE.Vector3();
let tPrev=0;
function frame(t){
  const dt=Math.min(0.05,(t-tPrev)/1000||0.016); tPrev=t;
  PT+=(P-PT)*(RM?1:0.12);
  const p=PT;

  // фазы: A) пачка стоит .0-.32  B) растворяется+взрыв .30-.66  C) сбор в миску .64-1
  const burst=smoother(.28,.6,p);      // 0..1 пачка→облако
  const settle=smoother(.58,.9,p);     // 0..1 облако→миска (готово к .9 — есть запас)
  const packFade=1-smoot(.28,.46,p);

  // пачка
  pack.visible=packFade>0.02;
  packMat.opacity=packFade; packSideMat.opacity=packFade;
  pack.rotation.y=lerp(0,0.5,smoot(0,.32,p))+p*0.15;
  pack.scale.setScalar(lerp(1,1.05,burst));
  pack.position.y=0.05+burst*0.4;

  // гранулы: интерполяция P0→P1→P2 + свирл
  const swirl=Math.sin(p*6.28)*0.0;
  for(let i=0;i<COUNT;i++){
    const i3=i*3;
    // сначала пачка→взрыв, потом взрыв→миска
    let x=lerp(P0[i3],P1[i3],burst),   y=lerp(P0[i3+1],P1[i3+1],burst),   z=lerp(P0[i3+2],P1[i3+2],burst);
    x=lerp(x,P2[i3],settle);           y=lerp(y,P2[i3+1],settle);         z=lerp(z,P2[i3+2],settle);
    // лёгкий вихрь в фазе взрыва
    const w=(burst*(1-settle));
    if(w>0.001){const a=SPIN[i3]+t*0.0004*SPIN[i3+1]; const cr=Math.cos(a),sr=Math.sin(a); const nx=x*cr-z*sr, nz=x*sr+z*cr; x=lerp(x,nx,w*0.5); z=lerp(z,nz,w*0.5); y+=Math.sin(a*2)*0.12*w;}
    dummy.position.set(x,y,z);
    const s=lerp(0.0,1,smoot(.30,.42,p)) * lerp(1,0.92,settle);
    dummy.scale.setScalar(Math.max(0.02,s));
    dummy.rotation.set(SPIN[i3]+t*0.001*SPIN[i3+1], SPIN[i3+2]+t*0.0008, SPIN[i3]*0.5);
    dummy.updateMatrix();
    kib.setMatrixAt(i, dummy.matrix);
  }
  kib.instanceMatrix.needsUpdate=true;

  // миска — появляется чуть раньше, чтобы гранулы «падали» в неё
  const bowlFade=smoot(.5,.72,p);
  bowl.material.opacity=bowlFade;
  bowl.visible=bowlFade>0.02;
  bowl.scale.setScalar(lerp(0.8,1,bowlFade));

  // камера: облёт + наезд, в финале — отъезд для «полной миски»
  mouse.x+=(mouse.tx-mouse.x)*0.05; mouse.y+=(mouse.ty-mouse.y)*0.05;
  const pull=smoot(.82,1,p);                 // финальный отъезд
  const orbit=lerp(-0.5,0.5,smoot(0,.85,p)) + mouse.x*0.5;
  const rad=lerp(8.4,5.0,smoot(0,.6,p)) + pull*2.6;
  const camY=lerp(1.2,2.15,smoot(.45,.82,p)) - pull*0.7 - mouse.y*0.6;
  camera.position.set(Math.sin(orbit)*rad, camY, Math.cos(orbit)*rad);
  camera.lookAt(0, lerp(0.1,-0.95,Math.max(settle,bowlFade)), 0);

  // дыхание света
  key.intensity=52+Math.sin(t*0.001)*6;

  composer.render();
  requestAnimationFrame(frame);
  updateCaps(p);
}

/* ─── post: bloom ─── */
const composer=new EffectComposer(renderer);
composer.addPass(new RenderPass(scene,camera));
const bloom=new UnrealBloomPass(new THREE.Vector2(innerWidth,innerHeight), MOB?0.62:0.85, 0.5, 0.82);
composer.addPass(bloom);
composer.addPass(new OutputPass());

/* ─── скролл ─── */
const lenis=new Lenis({lerp:RM?1:0.1, wheelMultiplier:1.0, smoothTouch:false});
window.__lenis=lenis;
lenis.on('scroll',ScrollTrigger.update);
gsap.ticker.add(t=>lenis.raf(t*1000)); gsap.ticker.lagSmoothing(0);
ScrollTrigger.create({trigger:'#scroll',start:'top top',end:'bottom bottom',scrub:0.5,
  onUpdate:s=>{P=s.progress;}});

addEventListener('resize',()=>{
  camera.aspect=innerWidth/innerHeight; camera.updateProjectionMatrix();
  renderer.setSize(innerWidth,innerHeight); composer.setSize(innerWidth,innerHeight);
});

/* старт */
requestAnimationFrame(frame);
updateCaps(0);
gsap.delayedCall(0.6,()=>document.getElementById('pre').classList.add('done'));
