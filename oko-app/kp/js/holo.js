import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
// DOM-synced WebGL: eye(GLB) + hand/woman as scroll-scrubbed sprite sheets.
// Figures are treated as part of the background: precise scroll-tied position + tiny breathing only.
export function initHolo(){
  const canvas=document.getElementById('holo-canvas'); if(!canvas) return;
  let renderer; try{renderer=new THREE.WebGLRenderer({canvas,alpha:true,antialias:true,powerPreference:'high-performance'});}catch(e){return;}
  const LOW=(navigator.hardwareConcurrency||4)<=4 && matchMedia('(pointer:coarse)').matches;
  renderer.setPixelRatio(Math.min(devicePixelRatio||1, LOW?1.5:2));
  const scene=new THREE.Scene();
  let W=innerWidth,H=innerHeight;
  const cam=new THREE.OrthographicCamera(0,W,0,-H,-2000,2000); cam.position.z=10;
  function resize(){W=innerWidth;H=innerHeight;renderer.setSize(W,H,false);cam.right=W;cam.bottom=-H;cam.updateProjectionMatrix();}
  resize(); addEventListener('resize',resize);
  scene.add(new THREE.AmbientLight(0xffffff,.95));
  const key=new THREE.DirectionalLight(0xffffff,1.4); key.position.set(2,3,5); scene.add(key);
  const lime=new THREE.PointLight(0x9AFF00,1.6,4000); lime.position.set(-300,-100,400); scene.add(lime);
  const ptr={x:0,y:0,tx:0,ty:0};
  function upd(cx,cy){ptr.tx=(cx/innerWidth-.5)*2;ptr.ty=(cy/innerHeight-.5)*2;}
  addEventListener('pointermove',e=>upd(e.clientX,e.clientY),{passive:true});
  addEventListener('touchmove',e=>{if(e.touches&&e.touches[0])upd(e.touches[0].clientX,e.touches[0].clientY);},{passive:true});
  addEventListener('touchstart',e=>{if(e.touches&&e.touches[0])upd(e.touches[0].clientX,e.touches[0].clientY);},{passive:true});
  function bindGyro(){if(!window.DeviceOrientationEvent)return;
    addEventListener('deviceorientation',e=>{if(e.gamma!=null){ptr.tx=Math.max(-1,Math.min(1,e.gamma/40));ptr.ty=Math.max(-1,Math.min(1,(e.beta-42)/40));}},true);
  }
  // iOS: разрешение по первому тапу
  if(typeof DeviceOrientationEvent!=='undefined' && DeviceOrientationEvent.requestPermission){
    document.addEventListener('click',function req(){DeviceOrientationEvent.requestPermission().then(function(p){if(p==='granted')bindGyro();}).catch(function(){});document.removeEventListener('click',req);},{once:true});
  } else bindGyro();
  const clamp=(v,a,b)=>v<a?a:v>b?b:v;
  function glowTex(){const cv=document.createElement('canvas');cv.width=cv.height=256;const g=cv.getContext('2d');const rg=g.createRadialGradient(128,128,6,128,128,128);rg.addColorStop(0,'rgba(154,255,0,.34)');rg.addColorStop(.5,'rgba(120,220,10,.1)');rg.addColorStop(1,'rgba(0,0,0,0)');g.fillStyle=rg;g.fillRect(0,0,256,256);return new THREE.CanvasTexture(cv);}
  const GLOW=glowTex();
  const figs=[];

  // ---- SPRITE-SHEET FIGURE (scroll-scrubbed frames) ----
  function makeSprite(id,src,cols,rows,N,aspect,opt){
    opt=opt||{};
    const anchor=document.getElementById(id); if(!anchor) return null;
    const tex=new THREE.TextureLoader().load(src);
    tex.wrapS=tex.wrapT=THREE.ClampToEdgeWrapping; tex.minFilter=THREE.LinearFilter; tex.magFilter=THREE.LinearFilter;
    tex.repeat.set(1/cols,1/rows);
    const mat=new THREE.MeshBasicMaterial({map:tex,transparent:true,depthWrite:false,opacity:0});
    const mesh=new THREE.Mesh(new THREE.PlaneGeometry(1,1),mat);
    const glow=new THREE.Sprite(new THREE.SpriteMaterial({map:GLOW,transparent:true,opacity:.35,blending:THREE.AdditiveBlending,depthWrite:false})); glow.position.z=-30;
    const grp=new THREE.Group(); grp.add(glow); grp.add(mesh); scene.add(grp);
    const f={id,anchor,tex,mat,mesh,glow,grp,cols,rows,N,aspect,opt,frame:-1};
    figs.push(f); return f;
  }
  function setFrame(f,i){ i=clamp(Math.round(i),0,f.N-1); if(i===f.frame) return; f.frame=i;
    const c=i%f.cols, r=Math.floor(i/f.cols); f.tex.offset.set(c/f.cols, 1-(r+1)/f.rows); }

  // EYE (GLB) — one mesh serves hero + clone anchors
  let eyeMesh=null; const eyeAnchors=['holoEye','holoEye2'].map(id=>document.getElementById(id)).filter(Boolean);
  function eyeReady(){ window.__eyeReady=true; try{dispatchEvent(new Event('eye-ready'));}catch(e){} }
  if(eyeAnchors.length){ new GLTFLoader().load('assets/oko-eye.glb',g=>{eyeMesh=g.scene;
    // ЧИСТЫЙ ЛАЙМ без запечённой чёрной обводки: заменяем baseColor на брендовый цвет, оставляем normalMap
    eyeMesh.traverse(function(o){ if(o.isMesh&&o.material){
      const nm=o.material.normalMap||null;
      o.material=new THREE.MeshStandardMaterial({
        color:new THREE.Color(0x9AFF00), emissive:new THREE.Color(0x5FBF00), emissiveIntensity:.55,
        metalness:.28, roughness:.34, normalMap:nm, side:THREE.DoubleSide });
      o.material.needsUpdate=true; } });
    const b=new THREE.Box3().setFromObject(eyeMesh);const c=b.getCenter(new THREE.Vector3());const s=b.getSize(new THREE.Vector3());const m=Math.max(s.x,s.y,s.z)||1;eyeMesh.position.sub(c);eyeMesh.userData.norm=1/m;const grp=new THREE.Group();grp.add(eyeMesh);scene.add(grp);eyeMesh.userData.grp=grp;eyeReady();},undefined,()=>{eyeReady();}); }
  else eyeReady();

  // рука уже повернута в самом спрайте (запястье слева, ладонь вверх, пальцы вправо) — 440x243
  makeSprite('holoHand','kp-media/fig/hand_sheet.webp',6,6,36,440/243,{progType:'hand',fit:'width',slide:true});
  makeSprite('holoWoman','kp-media/fig/woman_sheet.webp',6,6,36,340/316,{progType:'woman',fit:'contain'});

  function rectPos(r){return {x:r.left+r.width/2,y:-(r.top+r.height/2),w:r.width,h:r.height,vis:r.bottom>-160&&r.top<H+160};}
  function handProg(r){return clamp((H*0.86 - r.top)/(H*0.62),0,1);}
  function pinProg(){const el=document.getElementById('adtPin');if(!el)return 0;const r=el.getBoundingClientRect();return clamp(-r.top/Math.max(1,(r.height-H)),0,1);}

  function loop(t){requestAnimationFrame(loop);
    ptr.x+=(ptr.tx-ptr.x)*.05; ptr.y+=(ptr.ty-ptr.y)*.05;
    const time=t/1000;
    // EYE (interactive hero centrepiece)
    if(eyeMesh&&eyeAnchors.length){const grp=eyeMesh.userData.grp;let best=null,bd=1e9;
      for(const an of eyeAnchors){const r=an.getBoundingClientRect();if(r.bottom>-120&&r.top<H+120){const cy=r.top+r.height/2;const d=Math.abs(cy-H/2);if(d<bd){bd=d;best=r;}}}
      if(best){const P=rectPos(best);grp.visible=true;
        // глаз ВЕДЁТСЯ за пальцем: и поворот, и лёгкое смещение к курсору
        grp.position.set(P.x+ptr.x*P.w*0.06, P.y+Math.sin(time*1.0)*4 - ptr.y*P.h*0.05, 0);
        const sc=Math.min(P.w,P.h)*eyeMesh.userData.norm*0.9;grp.scale.setScalar(sc);
        eyeMesh.rotation.y=ptr.x*1.05+Math.sin(time/2.8)*0.08;eyeMesh.rotation.x=ptr.y*0.75+Math.cos(time/3.2)*0.04;
        window.__eyeRotY=eyeMesh.rotation.y;}
      else grp.visible=false;}
    // SPRITE FIGURES — part of background: scroll-tied frame + position, tiny breath, no springy motion
    for(const f of figs){const r=f.anchor.getBoundingClientRect();const P=rectPos(r);f.grp.visible=P.vis;if(!P.vis)continue;
      let prog = f.opt.progType==='hand' ? handProg(r) : pinProg();
      if(f.opt.progType==='hand'){ f.maxProg = Math.max(f.maxProg||0, prog); prog = f.maxProg; }  // рука не закрывается обратно
      setFrame(f, prog*(f.N-1));
      f.mat.opacity=(f.opt.progType==='hand'&&(f.maxProg||0)>0.99)?1:clamp(((H*0.94-r.top)/(H*0.5))*1.5,0,1);
      const asp=f.aspect; let w,h;
      if(f.opt.fit==='contain'){ w=P.w; h=w/asp; if(h>P.h){h=P.h;w=h*asp;} } else { w=P.w; h=w/asp; }
      let x=P.x, y=P.y+Math.sin(time*0.6+figs.indexOf(f))*2;      // tiny breath only (±2px)
      if(f.opt.slide){ x += (1-clamp(prog*2.5,0,1))*(-P.w*0.55); } // enters from left, settles early
      f.grp.position.set(x,y,0);
      f.mesh.scale.set(w,h,1); f.glow.scale.set(w*1.3,h*1.3,1);
      f.mesh.rotation.z = f.opt.rotZ || 0;
      // хук для DOM: раскрытие руки в % (0..1) — используется для показа заголовка
      if(f.opt.progType==='hand') window.__handOpen = prog;
    }
    renderer.render(scene,cam);
  }
  requestAnimationFrame(loop);
}
