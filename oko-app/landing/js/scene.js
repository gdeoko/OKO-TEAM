/* ОКО — настоящая 3D-сцена (Three.js): энергетический глаз + пролёт в тоннель, привязка к скроллу */
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';

const canvas = document.getElementById('bg');
let renderer;
try{
  renderer = new THREE.WebGLRenderer({ canvas, antialias:true, alpha:true, powerPreference:'high-performance' });
}catch(e){ document.body.classList.add('no-webgl'); window.__sceneReady=true; }

if(renderer){
  const MOB = window.innerWidth < 760;
  const reduce = matchMedia('(prefers-reduced-motion:reduce)').matches;
  let DPR = Math.min(window.devicePixelRatio||1, MOB?1.6:2);
  renderer.setPixelRatio(DPR);
  renderer.setClearColor(0x000000, 0);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 0.56;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(56, innerWidth/innerHeight, 0.1, 200);
  camera.position.set(0,0,13);

  const LIME = new THREE.Color(0x9AFF00);
  const LIME_HOT = new THREE.Color(0xd4ff7a);
  const LIME_DK = new THREE.Color(0x2f5c00);

  // ---------- particle shader (soft round glowing points) ----------
  const pointVert = `
    attribute float aSize; attribute vec3 aColor; attribute float aSeed;
    uniform float uTime; uniform float uPix;
    varying vec3 vColor; varying float vTw;
    void main(){
      vColor=aColor;
      vec3 p=position;
      float tw=0.6+0.4*sin(uTime*1.6+aSeed*20.0);
      vTw=tw;
      vec4 mv=modelViewMatrix*vec4(p,1.0);
      gl_Position=projectionMatrix*mv;
      gl_PointSize=aSize*uPix*tw*(300.0/-mv.z);
    }`;
  const pointFrag = `
    precision mediump float;
    varying vec3 vColor; varying float vTw;
    void main(){
      vec2 uv=gl_PointCoord-0.5;
      float d=length(uv);
      if(d>0.5) discard;
      float a=smoothstep(0.5,0.0,d);
      a=pow(a,2.4);
      gl_FragColor=vec4(vColor*(0.65+vTw*0.45), a*0.72);
    }`;

  function makePoints(count, builder){
    const pos=new Float32Array(count*3), col=new Float32Array(count*3), siz=new Float32Array(count), seed=new Float32Array(count);
    for(let i=0;i<count;i++) builder(i,pos,col,siz,seed);
    const g=new THREE.BufferGeometry();
    g.setAttribute('position',new THREE.BufferAttribute(pos,3));
    g.setAttribute('aColor',new THREE.BufferAttribute(col,3));
    g.setAttribute('aSize',new THREE.BufferAttribute(siz,1));
    g.setAttribute('aSeed',new THREE.BufferAttribute(seed,1));
    const m=new THREE.ShaderMaterial({
      uniforms:{ uTime:{value:0}, uPix:{value:DPR} },
      vertexShader:pointVert, fragmentShader:pointFrag,
      transparent:true, blending:THREE.AdditiveBlending, depthWrite:false, depthTest:true
    });
    return new THREE.Points(g,m);
  }
  const setC=(col,i,c,k)=>{ col[i*3]=c.r*k; col[i*3+1]=c.g*k; col[i*3+2]=c.b*k; };

  const group = new THREE.Group(); scene.add(group);

  // ---- IRIS (disc of radial fibers around a dark pupil, at z=0) ----
  const IRIS_N = MOB?7000:13000;
  const pupilR=1.5, irisR=3.6, FIBERS=68;
  const iris = makePoints(IRIS_N,(i,pos,col,siz,seed)=>{
    // cluster points onto discrete radial fibers -> dark gaps between (reads as iris)
    const fi=Math.floor(Math.random()*FIBERS);
    const jit=(Math.random()-0.5);
    const a=(fi/FIBERS)*Math.PI*2 + jit*0.05;
    let r=pupilR+(irisR-pupilR)*Math.pow(Math.random(),0.8);
    r += (Math.random()-0.5)*0.06;
    const x=Math.cos(a)*r, y=Math.sin(a)*r;
    const z=(Math.random()-0.5)*0.4;
    pos[i*3]=x; pos[i*3+1]=y; pos[i*3+2]=z;
    const t=(r-pupilR)/(irisR-pupilR);           // 0 inner ->1 outer
    const core=1.0-Math.min(1,Math.abs(jit)*2.2); // brightest at fiber center
    const c=LIME_DK.clone().lerp(LIME, Math.min(1,0.25+t*1.2));
    if(core>0.6) c.lerp(LIME_HOT, 0.35);
    const bright=(0.05+core*0.28)*(0.42+t*0.62);   // dimmer near pupil, brighter outer
    setC(col,i,c,bright);
    siz[i]=(0.9+core*0.9)*(MOB?0.9:1.0);
    seed[i]=Math.random();
  });
  group.add(iris);

  // subtle inner rim around pupil
  const rim = makePoints(MOB?900:1600,(i,pos,col,siz,seed)=>{
    const a=Math.random()*Math.PI*2; const r=pupilR+Math.random()*0.08;
    pos[i*3]=Math.cos(a)*r; pos[i*3+1]=Math.sin(a)*r; pos[i*3+2]=(Math.random()-0.5)*0.14;
    setC(col,i,LIME_HOT,0.3); siz[i]=1.3; seed[i]=Math.random();
  });
  group.add(rim);

  // ---- TUNNEL (rings of screens/points receding along -z, the "content stream") ----
  const TUN_N = MOB?7000:16000;
  const tunnel = makePoints(TUN_N,(i,pos,col,siz,seed)=>{
    const a=Math.random()*Math.PI*2;
    const rr=2.6+Math.random()*1.9;
    const z=-3 - Math.random()*46;         // from just behind iris to -49
    const wob=Math.sin(z*0.25)*0.5;
    pos[i*3]=Math.cos(a)*(rr+wob); pos[i*3+1]=Math.sin(a)*(rr+wob); pos[i*3+2]=z;
    const c=LIME.clone().lerp(LIME_HOT, Math.random()*0.5);
    setC(col,i,c, 0.28+Math.random()*0.45);
    siz[i]=(Math.random()<0.12?2.0:1.05);
    seed[i]=Math.random();
  });
  group.add(tunnel);

  // ---- ambient dust sphere ----
  const dust = makePoints(MOB?800:1600,(i,pos,col,siz,seed)=>{
    const r=6+Math.random()*20, a=Math.random()*Math.PI*2, ph=Math.acos(2*Math.random()-1);
    pos[i*3]=r*Math.sin(ph)*Math.cos(a); pos[i*3+1]=r*Math.sin(ph)*Math.sin(a); pos[i*3+2]=-Math.random()*40+5;
    setC(col,i,LIME,0.22); siz[i]=0.9; seed[i]=Math.random();
  });
  scene.add(dust);

  // ---------- bloom ----------
  const composer=new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene,camera));
  const bloom=new UnrealBloomPass(new THREE.Vector2(innerWidth,innerHeight), MOB?0.32:0.42, 0.55, 0.3);
  composer.addPass(bloom);

  function resize(){
    const w=innerWidth,h=innerHeight;
    camera.aspect=w/h; camera.updateProjectionMatrix();
    renderer.setSize(w,h); composer.setSize(w,h);
  }
  addEventListener('resize',resize); resize();

  // ---------- interaction ----------
  const mouse={x:0,y:0,tx:0,ty:0};
  addEventListener('pointermove',e=>{ mouse.tx=(e.clientX/innerWidth)*2-1; mouse.ty=-((e.clientY/innerHeight)*2-1); },{passive:true});
  addEventListener('deviceorientation',e=>{ if(e.gamma!=null){ mouse.tx=Math.max(-1,Math.min(1,e.gamma/30)); mouse.ty=Math.max(-1,Math.min(1,(e.beta-45)/30)); } },{passive:true});

  // scroll progress (native scroll)
  let prog=0, sprog=0;
  function readScroll(){
    const max=document.documentElement.scrollHeight-innerHeight;
    prog = max>0 ? Math.min(1,Math.max(0, scrollY/max)) : 0;
  }
  addEventListener('scroll',readScroll,{passive:true}); readScroll();

  // camera path: fly from z=9 (facing iris) forward through pupil into tunnel to z=-42
  const clock=new THREE.Clock();
  function frame(){
    const t=clock.getElapsedTime();
    sprog += (prog-sprog)*0.11;
    mouse.x+=(mouse.tx-mouse.x)*0.05; mouse.y+=(mouse.ty-mouse.y)*0.05;

    // ease camera along -z
    const ez = sprog<0.5 ? 2*sprog*sprog : 1-Math.pow(-2*sprog+2,2)/2; // easeInOutQuad
    camera.position.z = 13 - ez*55;                 // 13 -> -42
    camera.position.x += ((mouse.x*1.1) - camera.position.x)*0.05;
    camera.position.y += ((mouse.y*1.1) - camera.position.y)*0.05;
    camera.lookAt(0,0,camera.position.z-6);

    if(!reduce){
      group.rotation.z = t*0.03 + mouse.x*0.05;
      iris.rotation.z = -t*0.02;
      tunnel.rotation.z = t*0.05;
      dust.rotation.z = t*0.01;
    }
    // update time uniforms
    iris.material.uniforms.uTime.value=t; rim.material.uniforms.uTime.value=t;
    tunnel.material.uniforms.uTime.value=t; dust.material.uniforms.uTime.value=t;

    // fade iris out as we pass through it (so we don't see backs)
    const pass = THREE.MathUtils.clamp((camera.position.z-0.5)/6,0,1);
    iris.material.opacity=pass; rim.material.opacity=pass;
    iris.visible = camera.position.z>-1.5; rim.visible=iris.visible;

    composer.render();
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
  window.__sceneReady=true;
}
