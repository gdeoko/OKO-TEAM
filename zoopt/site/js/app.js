import * as THREE from 'three';
import { EffectComposer } from './vendor/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from './vendor/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from './vendor/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from './vendor/jsm/postprocessing/OutputPass.js';
import { RoomEnvironment } from './vendor/jsm/environments/RoomEnvironment.js';
import { GLTFLoader } from './vendor/jsm/loaders/GLTFLoader.js';
import { OrbitControls } from './vendor/jsm/controls/OrbitControls.js';

const gsap = window.gsap;
const ScrollTrigger = window.ScrollTrigger;
const Lenis = window.Lenis;
gsap.registerPlugin(ScrollTrigger);

const C = { green:0x1B8A3A, greenDark:0x0F5C24, greenLite:0x4fd97a, yellow:0xFFD500, warm:0xFFE45C, white:0xffffff, black:0x0A0A0A };

function radialTexture(stops){
  const s=256, cv=document.createElement('canvas'); cv.width=cv.height=s;
  const x=cv.getContext('2d'); const g=x.createRadialGradient(s/2,s/2,0,s/2,s/2,s/2);
  stops.forEach(([o,c])=>g.addColorStop(o,c)); x.fillStyle=g; x.fillRect(0,0,s,s);
  const t=new THREE.CanvasTexture(cv); t.needsUpdate=true; return t;
}
const rnd=(a,b)=>a+Math.random()*(b-a);

/* =====================================================================
   ИММЕРСИВНЫЙ 3D HERO — светящаяся луна + парящие объекты + bloom
   ===================================================================== */
function initHero(){
  const canvas=document.getElementById('gl');
  const renderer=new THREE.WebGLRenderer({canvas,antialias:true,powerPreference:'high-performance'});
  renderer.setPixelRatio(Math.min(devicePixelRatio,2));
  renderer.toneMapping=THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure=1.15;
  renderer.outputColorSpace=THREE.SRGBColorSpace;

  const scene=new THREE.Scene();
  scene.background=new THREE.Color(0x03110a);
  scene.fog=new THREE.FogExp2(0x041710,0.032);

  const cam=new THREE.PerspectiveCamera(52,1,.1,120);
  cam.position.set(0,1.2,17);

  // PBR environment (отражения на объектах)
  const pmrem=new THREE.PMREMGenerator(renderer);
  scene.environment=pmrem.fromScene(new RoomEnvironment(),0.04).texture;

  const world=new THREE.Group(); scene.add(world);

  // ---- свет ----
  const key=new THREE.PointLight(0xFFE7A0,140,60,2); key.position.set(6,6,2); scene.add(key);
  const fill=new THREE.DirectionalLight(0x4fd97a,1.1); fill.position.set(-8,4,6); scene.add(fill);
  scene.add(new THREE.AmbientLight(0x0c3a1e,0.6));

  // ---- ЛУНА ----
  const moonGrp=new THREE.Group(); moonGrp.position.set(4.2,2.4,-3); world.add(moonGrp);
  const moon=new THREE.Mesh(
    new THREE.IcosahedronGeometry(3.1,6),
    new THREE.MeshStandardMaterial({color:0xFFD500,emissive:0xFFC400,emissiveIntensity:1.35,roughness:.55,metalness:.1})
  );
  // лёгкий рельеф
  const pos=moon.geometry.attributes.position;
  for(let i=0;i<pos.count;i++){const v=new THREE.Vector3().fromBufferAttribute(pos,i);
    const n=Math.sin(v.x*3.1)*Math.cos(v.y*2.7)*Math.sin(v.z*3.4);
    v.multiplyScalar(1+n*0.03); pos.setXYZ(i,v.x,v.y,v.z);}
  moon.geometry.computeVertexNormals(); moonGrp.add(moon);
  // атмосферный ореол (fresnel back-side)
  const halo=new THREE.Mesh(new THREE.SphereGeometry(3.9,48,48),
    new THREE.ShaderMaterial({transparent:true,side:THREE.BackSide,blending:THREE.AdditiveBlending,depthWrite:false,
      uniforms:{uc:{value:new THREE.Color(0xFFE45C)}},
      vertexShader:`varying vec3 vN;varying vec3 vP;void main(){vN=normalize(normalMatrix*normal);vec4 mv=modelViewMatrix*vec4(position,1.);vP=mv.xyz;gl_Position=projectionMatrix*mv;}`,
      fragmentShader:`varying vec3 vN;varying vec3 vP;uniform vec3 uc;void main(){float f=pow(1.-abs(dot(normalize(vN),normalize(-vP))),2.4);gl_FragColor=vec4(uc,f*0.9);}`}));
  moonGrp.add(halo);
  // мягкое гало-спрайт
  const glow=new THREE.Sprite(new THREE.SpriteMaterial({map:radialTexture([[0,'rgba(255,228,92,.85)'],[.3,'rgba(255,205,0,.35)'],[.6,'rgba(255,190,0,.08)'],[1,'rgba(0,0,0,0)']]),blending:THREE.AdditiveBlending,depthWrite:false,transparent:true}));
  glow.scale.set(22,22,1); glow.position.copy(moonGrp.position); world.add(glow);

  // ---- отражающий пол ----
  const floor=new THREE.Mesh(new THREE.PlaneGeometry(120,120),
    new THREE.MeshStandardMaterial({color:0x061c10,metalness:.9,roughness:.42}));
  floor.rotation.x=-Math.PI/2; floor.position.y=-4.4; scene.add(floor);

  // ---- парящие 3D-объекты (кости, мячи, звёзды, «корм») ----
  const matGreen=new THREE.MeshStandardMaterial({color:0x1B8A3A,roughness:.28,metalness:.35,envMapIntensity:1.2});
  const matDark=new THREE.MeshStandardMaterial({color:0x0c1a12,roughness:.35,metalness:.6,envMapIntensity:1.1});
  const matYellow=new THREE.MeshStandardMaterial({color:0xFFD500,emissive:0xFFB800,emissiveIntensity:.5,roughness:.3,metalness:.2});
  const matWhite=new THREE.MeshStandardMaterial({color:0xEFF6EE,roughness:.4,metalness:.2});

  function bone(mat){const g=new THREE.Group();
    const shaft=new THREE.Mesh(new THREE.CapsuleGeometry(.16,.9,6,12),mat);shaft.rotation.z=Math.PI/2;g.add(shaft);
    [[-.6,.22],[-.6,-.22],[.6,.22],[.6,-.22]].forEach(([x,y])=>{const s=new THREE.Mesh(new THREE.SphereGeometry(.26,18,18),mat);s.position.set(x,y,0);g.add(s);});
    return g;}
  function ball(mat){return new THREE.Mesh(new THREE.SphereGeometry(.5,28,28),mat);}
  function star(){return new THREE.Mesh(new THREE.OctahedronGeometry(.34,0),matYellow);}
  function kibble(mat){return new THREE.Mesh(new THREE.IcosahedronGeometry(.36,0),mat);}

  const floaters=[];
  const makers=[()=>bone(matGreen),()=>bone(matWhite),()=>ball(matYellow),()=>ball(matGreen),()=>star(),()=>kibble(matDark),()=>kibble(matGreen)];
  for(let i=0;i<20;i++){
    const o=makers[i%makers.length]();
    o.position.set(rnd(-11,11),rnd(-3.5,6),rnd(-10,7));
    o.rotation.set(rnd(0,6),rnd(0,6),rnd(0,6));
    o.scale.setScalar(rnd(.7,1.5));
    o.userData={sp:rnd(.2,.7),ax:new THREE.Vector3(rnd(-1,1),rnd(-1,1),rnd(-1,1)).normalize(),ph:rnd(0,6),bob:rnd(.3,.8),y0:o.position.y};
    world.add(o); floaters.push(o);
  }

  // ---- звёздная пыль ----
  const N=3200, p=new Float32Array(N*3), col=new Float32Array(N*3), sz=new Float32Array(N);
  const cg=new THREE.Color(C.greenLite), cy=new THREE.Color(C.warm), cw=new THREE.Color(C.white);
  for(let i=0;i<N;i++){
    p[i*3]=rnd(-40,40); p[i*3+1]=rnd(-14,22); p[i*3+2]=rnd(-30,10);
    const r=Math.random(); const c=r<.6?cg.clone():r<.85?cw.clone():cy.clone();
    col[i*3]=c.r;col[i*3+1]=c.g;col[i*3+2]=c.b; sz[i]=rnd(.4,1.7);
  }
  const dg=new THREE.BufferGeometry();
  dg.setAttribute('position',new THREE.BufferAttribute(p,3));
  dg.setAttribute('color',new THREE.BufferAttribute(col,3));
  dg.setAttribute('aSize',new THREE.BufferAttribute(sz,1));
  const dust=new THREE.Points(dg,new THREE.ShaderMaterial({
    transparent:true,depthWrite:false,blending:THREE.AdditiveBlending,vertexColors:true,
    uniforms:{uTex:{value:radialTexture([[0,'rgba(255,255,255,1)'],[.4,'rgba(255,255,255,.6)'],[1,'rgba(255,255,255,0)']])}},
    vertexShader:`attribute float aSize;varying vec3 vC;void main(){vC=color;vec4 mv=modelViewMatrix*vec4(position,1.);gl_PointSize=aSize*(260./-mv.z);gl_Position=projectionMatrix*mv;}`,
    fragmentShader:`uniform sampler2D uTex;varying vec3 vC;void main(){float a=texture2D(uTex,gl_PointCoord).a;if(a<.02)discard;gl_FragColor=vec4(vC,a);}`}));
  scene.add(dust);

  // ---- постобработка: BLOOM ----
  const composer=new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene,cam));
  const bloom=new UnrealBloomPass(new THREE.Vector2(1,1),0.85,0.7,0.62);
  composer.addPass(bloom);
  composer.addPass(new OutputPass());

  function resize(){const w=innerWidth,h=document.getElementById('hero').clientHeight;
    renderer.setSize(w,h,false); composer.setSize(w,h); cam.aspect=w/h; cam.updateProjectionMatrix();}
  resize(); addEventListener('resize',resize);

  const m={x:0,y:0}, mt={x:0,y:0};
  addEventListener('pointermove',e=>{m.x=(e.clientX/innerWidth-.5);m.y=(e.clientY/innerHeight-.5);});

  const hs={v:0};
  ScrollTrigger.create({trigger:'#hero',start:'top top',end:'bottom top',scrub:true,onUpdate:s=>hs.v=s.progress});

  const clock=new THREE.Clock();
  function loop(){
    const t=clock.getElapsedTime();
    mt.x+=(m.x-mt.x)*.045; mt.y+=(m.y-mt.y)*.045;
    moon.rotation.y=t*0.06; moon.rotation.x=Math.sin(t*.15)*.1;
    halo.rotation.copy(moon.rotation);
    floaters.forEach(o=>{o.rotateOnAxis(o.userData.ax,o.userData.sp*0.01);
      o.position.y=o.userData.y0+Math.sin(t*o.userData.bob+o.userData.ph)*.4;});
    dust.rotation.y=t*0.008;
    // параллакс + полёт камеры по скроллу
    const pr=hs.v;
    const camX=mt.x*2.4, camY=1.2 - mt.y*1.6 + pr*4.5;
    cam.position.x+=(camX-cam.position.x)*.06;
    cam.position.y+=(camY-cam.position.y)*.06;
    cam.position.z=17 - pr*11;
    world.position.z=pr*6;
    cam.lookAt(1.4+mt.x*2, 1.6+pr*2.2, -3);
    glow.material.opacity=1-pr*.7;
    bloom.strength=0.85+Math.sin(t*.6)*0.06 - pr*0.3;
    composer.render();
    requestAnimationFrame(loop);
  }
  loop();
}

/* =====================================================================
   3D SHOWCASE — интерактивная модель (крути пальцем) + bloom
   ===================================================================== */
function initShowcase(){
  const canvas=document.getElementById('gl3d'); if(!canvas) return;
  const renderer=new THREE.WebGLRenderer({canvas,antialias:true,alpha:true});
  renderer.setPixelRatio(Math.min(devicePixelRatio,2));
  renderer.toneMapping=THREE.ACESFilmicToneMapping; renderer.toneMappingExposure=1.1;
  renderer.outputColorSpace=THREE.SRGBColorSpace;
  const scene=new THREE.Scene();
  const pmrem=new THREE.PMREMGenerator(renderer);
  scene.environment=pmrem.fromScene(new RoomEnvironment(),0.04).texture;
  const SX=1.6; // сдвиг вправо, чтобы модель не залезала на текст
  const cam=new THREE.PerspectiveCamera(45,1,.1,100); cam.position.set(SX+3.2,1.8,5.4);

  scene.add(new THREE.AmbientLight(0x2a5a3a,0.8));
  const k=new THREE.PointLight(0xFFE7A0,90,40,2); k.position.set(SX+4,6,4); scene.add(k);
  const f=new THREE.DirectionalLight(0x6fe89a,1.4); f.position.set(-6,3,-4); scene.add(f);

  const stage=new THREE.Group(); stage.position.x=SX; scene.add(stage);
  // пьедестал-луна
  const disc=new THREE.Mesh(new THREE.CylinderGeometry(1.8,1.9,.18,64),
    new THREE.MeshStandardMaterial({color:0x0c2416,metalness:.85,roughness:.35}));
  disc.position.y=-.09; stage.add(disc);
  const ring=new THREE.Mesh(new THREE.TorusGeometry(1.85,.05,16,80),
    new THREE.MeshStandardMaterial({color:0xFFD500,emissive:0xFFC400,emissiveIntensity:2.2,metalness:.2,roughness:.4}));
  ring.rotation.x=Math.PI/2; ring.position.y=0; stage.add(ring);
  const glowS=new THREE.Sprite(new THREE.SpriteMaterial({map:radialTexture([[0,'rgba(255,213,0,.6)'],[.4,'rgba(255,205,0,.18)'],[1,'rgba(0,0,0,0)']]),blending:THREE.AdditiveBlending,depthWrite:false,transparent:true}));
  glowS.scale.set(9,9,1); glowS.position.set(0,1,-1); stage.add(glowS);

  const controls=new OrbitControls(cam,canvas);
  controls.enableDamping=true; controls.dampingFactor=.08; controls.enablePan=false;
  controls.autoRotate=true; controls.autoRotateSpeed=1.3;
  controls.minDistance=3.2; controls.maxDistance=9; controls.minPolarAngle=.6; controls.maxPolarAngle=1.9;
  controls.target.set(SX,1.05,0);

  let mixer=null, actions=[], current=null;
  new GLTFLoader().load('assets/models/fox.glb',(g)=>{
    const model=g.scene;
    const box=new THREE.Box3().setFromObject(model); const s=2.2/box.getSize(new THREE.Vector3()).y;
    model.scale.setScalar(s);
    const b2=new THREE.Box3().setFromObject(model); const c=b2.getCenter(new THREE.Vector3());
    model.position.set(-c.x, -b2.min.y, -c.z); model.rotation.y=-0.5;
    model.traverse(o=>{if(o.isMesh){o.castShadow=true;o.material.envMapIntensity=1.1;}});
    stage.add(model);
    mixer=new THREE.AnimationMixer(model);
    actions=g.animations.map(cl=>mixer.clipAction(cl));
    if(actions[0]){current=actions[0];current.play();}
  },undefined,(e)=>console.warn('fox load fail',e));

  // кнопки анимаций
  document.querySelectorAll('.pill3d').forEach(btn=>btn.addEventListener('click',()=>{
    const idx=+btn.dataset.anim; if(!actions[idx])return;
    document.querySelectorAll('.pill3d').forEach(b=>b.classList.remove('on')); btn.classList.add('on');
    const next=actions[idx]; if(current&&current!==next){next.reset().play();next.crossFadeFrom(current,.4,false);}
    else next.reset().play(); current=next;
  }));

  const composer=new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene,cam));
  composer.addPass(new UnrealBloomPass(new THREE.Vector2(1,1),0.7,0.8,0.7));
  composer.addPass(new OutputPass());

  function resize(){const w=canvas.clientWidth||innerWidth,h=canvas.clientHeight||innerHeight;
    renderer.setSize(w,h,false); composer.setSize(w,h); cam.aspect=w/h; cam.updateProjectionMatrix();}
  resize(); addEventListener('resize',resize);

  let visible=false;
  new IntersectionObserver(es=>es.forEach(e=>visible=e.isIntersecting),{threshold:.05}).observe(canvas);
  const clock=new THREE.Clock();
  function loop(){requestAnimationFrame(loop);
    if(!visible)return;
    const dt=clock.getDelta();
    if(mixer)mixer.update(dt);
    ring.rotation.z+=dt*.3; controls.update(); composer.render();
  }
  loop();
}

/* =====================================================================
   AUDIO — мягкий эмбиент по клику (как в референсах)
   ===================================================================== */
function initAudio(){
  const btn=document.getElementById('sound'); if(!btn) return;
  let ctx,on=false,nodes=[];
  function start(){
    ctx=new (window.AudioContext||window.webkitAudioContext)();
    const master=ctx.createGain(); master.gain.value=0; master.connect(ctx.destination);
    const lp=ctx.createBiquadFilter(); lp.type='lowpass'; lp.frequency.value=680; lp.connect(master);
    [55,82.4,110,164.8].forEach((f,i)=>{
      const o=ctx.createOscillator(); o.type=i%2?'sine':'triangle'; o.frequency.value=f;
      const g=ctx.createGain(); g.gain.value=.12/(i+1); o.connect(g); g.connect(lp); o.start();
      const lfo=ctx.createOscillator(); lfo.frequency.value=.05+i*.03; const lg=ctx.createGain(); lg.gain.value=.05;
      lfo.connect(lg); lg.connect(g.gain); lfo.start(); nodes.push(o,lfo);
    });
    master.gain.linearRampToValueAtTime(.5,ctx.currentTime+1.5);
    nodes.push(master);
  }
  btn.addEventListener('click',()=>{
    on=!on; btn.classList.toggle('on',on);
    if(on){ if(!ctx)start(); else ctx.resume(); }
    else if(ctx){ ctx.suspend(); }
    btn.querySelector('.slabel').textContent=on?'звук вкл':'звук выкл';
  });
}

/* =====================================================================
   SMOOTH SCROLL + REVEALS
   ===================================================================== */
function initScroll(){
  const lenis=new Lenis({lerp:.09,wheelMultiplier:1.05});
  window.__lenis=lenis;
  lenis.on('scroll',ScrollTrigger.update);
  gsap.ticker.add(t=>lenis.raf(t*1000)); gsap.ticker.lagSmoothing(0);

  document.querySelectorAll('[data-scroll],.nav-links a,.foot-col a[href^="#"],.brand[href^="#"]').forEach(el=>{
    const target=el.getAttribute('data-scroll')||el.getAttribute('href');
    if(!target||!target.startsWith('#')||target==='#')return;
    el.addEventListener('click',e=>{e.preventDefault();const n=document.querySelector(target);if(n)lenis.scrollTo(n,{offset:-70,duration:1.3});});
  });

  const nav=document.getElementById('nav');
  ScrollTrigger.create({start:'top -80',onUpdate:s=>nav.classList.toggle('solid',s.scroll()>80)});

  gsap.timeline({delay:.15}).to('#hero .rv',{opacity:1,y:0,duration:1.1,stagger:.12,ease:'power3.out'});
  gsap.utils.toArray('.rv').forEach(el=>{
    if(el.closest('#hero'))return;
    gsap.to(el,{opacity:1,y:0,duration:1,ease:'power3.out',scrollTrigger:{trigger:el,start:'top 85%'}});
  });
  gsap.utils.toArray('.cat .an').forEach(el=>gsap.to(el,{yPercent:-14,ease:'none',scrollTrigger:{trigger:el.closest('.cat'),start:'top bottom',end:'bottom top',scrub:true}}));
  gsap.utils.toArray('.char .cimg').forEach(el=>gsap.to(el,{yPercent:-12,ease:'none',scrollTrigger:{trigger:el.closest('.char'),start:'top bottom',end:'bottom top',scrub:true}}));
  gsap.utils.toArray('[data-count]').forEach(el=>{
    const end=+el.dataset.count;
    ScrollTrigger.create({trigger:el,start:'top 90%',once:true,onEnter:()=>{
      gsap.to({v:0},{v:end,duration:1.6,ease:'power2.out',onUpdate(){el.textContent=Math.round(this.targets()[0].v);}});
    }});
  });
}

function preloader(){
  const bar=document.querySelector('.pre-bar i'), pre=document.getElementById('pre');
  gsap.to(bar,{width:'100%',duration:1.2,ease:'power2.inOut',onComplete(){
    gsap.to(pre,{delay:.2,onStart:()=>pre.classList.add('done')});
  }});
}

try{ initHero(); }catch(e){ console.warn('WebGL hero failed:',e); }
try{ initShowcase(); }catch(e){ console.warn('3D showcase failed:',e); }
initScroll(); initAudio(); preloader();
