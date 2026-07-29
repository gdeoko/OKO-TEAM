import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { buildHand3D, poseHand } from './hand3d.js?v=99';
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
  scene.add(new THREE.AmbientLight(0xffffff,1.35));
  const key=new THREE.DirectionalLight(0xffffff,2.1); key.position.set(2,3,5); scene.add(key);
  const fill=new THREE.DirectionalLight(0xBFFF6A,.9); fill.position.set(-3,-1,2); scene.add(fill);
  const lime=new THREE.PointLight(0x9AFF00,1.8,4000); lime.position.set(-300,-100,400); scene.add(lime);
  const clock=new THREE.Clock();
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
  // ГЛЯНЦЕВЫЕ ОТРАЖЕНИЯ: PMREM-окружение (для чёткого глянца робота)
  let ENVTEX=null; try{ renderer.toneMapping=THREE.ACESFilmicToneMapping; renderer.toneMappingExposure=1.12;
    const pm=new THREE.PMREMGenerator(renderer); ENVTEX=pm.fromScene(new RoomEnvironment(),0.04).texture; }catch(e){}
  const clamp=(v,a,b)=>v<a?a:v>b?b:v;
  function glowTex(){const cv=document.createElement('canvas');cv.width=cv.height=256;const g=cv.getContext('2d');const rg=g.createRadialGradient(128,128,6,128,128,128);rg.addColorStop(0,'rgba(154,255,0,.34)');rg.addColorStop(.5,'rgba(120,220,10,.1)');rg.addColorStop(1,'rgba(0,0,0,0)');g.fillStyle=rg;g.fillRect(0,0,256,256);return new THREE.CanvasTexture(cv);}
  const GLOW=glowTex();
  const figs=[];

  // ---- SPRITE-SHEET FIGURE (scroll-scrubbed frames) ----
  function makeSprite(id,src,cols,rows,N,aspect,opt){
    opt=opt||{};
    const anchor=document.getElementById(id); if(!anchor) return null;
    const tex=new THREE.TextureLoader().load(src);
    tex.wrapS=tex.wrapT=THREE.ClampToEdgeWrapping; tex.minFilter=THREE.LinearFilter; tex.magFilter=THREE.LinearFilter; tex.generateMipmaps=false;
    tex.repeat.set(1/cols,1/rows);
    const mat=new THREE.MeshBasicMaterial({map:tex,transparent:true,depthWrite:false,opacity:0});
    const mesh=new THREE.Mesh(new THREE.PlaneGeometry(1,1),mat);
    const glow=new THREE.Sprite(new THREE.SpriteMaterial({map:GLOW,transparent:true,opacity:.16,blending:THREE.AdditiveBlending,depthWrite:false})); glow.position.z=-30;
    const grp=new THREE.Group(); grp.add(glow); grp.add(mesh); scene.add(grp);
    const f={id,anchor,tex,mat,mesh,glow,grp,cols,rows,N,aspect,opt,frame:-1};
    figs.push(f); return f;
  }
  function setFrame(f,i){ i=clamp(Math.round(i),0,f.N-1); if(i===f.frame) return; f.frame=i;
    const c=i%f.cols, r=Math.floor(i/f.cols); f.tex.offset.set(c/f.cols, 1-(r+1)/f.rows); }

  // EYE (GLB) — one mesh serves hero + clone anchors
  let eyeMesh=null; const eyeAnchors=['holoEye','holoEye2'].map(id=>document.getElementById(id)).filter(Boolean);
  function eyeReady(){ window.__eyeReady=true; try{dispatchEvent(new Event('eye-ready'));}catch(e){} }
  if(eyeAnchors.length){ new GLTFLoader().load('assets/oko-eye.glb?v=92',g=>{eyeMesh=g.scene;
    // ЧИСТЫЙ ЛАЙМ без запечённой чёрной обводки: заменяем baseColor на брендовый цвет, оставляем normalMap
    eyeMesh.traverse(function(o){ if(o.isMesh&&o.material){
      const nm=o.material.normalMap||null;
      o.material=new THREE.MeshStandardMaterial({
        color:new THREE.Color(0x9AFF00), emissive:new THREE.Color(0x5FBF00), emissiveIntensity:.55,
        metalness:.28, roughness:.34, normalMap:nm, side:THREE.DoubleSide });
      o.material.needsUpdate=true; } });
    const b=new THREE.Box3().setFromObject(eyeMesh);const c=b.getCenter(new THREE.Vector3());const s=b.getSize(new THREE.Vector3());const m=Math.max(s.x,s.y,s.z)||1;eyeMesh.position.sub(c);eyeMesh.userData.norm=1/m;const grp=new THREE.Group();grp.add(eyeMesh);
    // ЧИСТАЯ СТЕКЛЯННАЯ ОБВОДКА ПО КОНТУРУ: Fresnel — светится только по силуэту фигуры, ровно и красиво
    const fresMat=new THREE.ShaderMaterial({transparent:true,depthWrite:false,blending:THREE.AdditiveBlending,side:THREE.DoubleSide,
      uniforms:{uC:{value:new THREE.Color(0xEAFFC2)},uP:{value:3.4},uI:{value:1.15}},
      vertexShader:'varying vec3 vN;varying vec3 vE;void main(){vec4 mv=modelViewMatrix*vec4(position,1.0);vE=normalize(-mv.xyz);vN=normalize(normalMatrix*normal);gl_Position=projectionMatrix*mv;}',
      fragmentShader:'uniform vec3 uC;uniform float uP;uniform float uI;varying vec3 vN;varying vec3 vE;void main(){float f=pow(1.0-abs(dot(normalize(vN),normalize(vE))),uP);gl_FragColor=vec4(uC*uI*f,f*0.9);}'});
    const eyeRim=eyeMesh.clone(true); eyeRim.traverse(function(o){if(o.isMesh)o.material=fresMat;}); eyeRim.scale.multiplyScalar(1.02); grp.add(eyeRim);
    eyeMesh.userData.rim=fresMat;
    scene.add(grp);eyeMesh.userData.grp=grp;eyeReady();},undefined,()=>{eyeReady();}); }
  else eyeReady();

  // ---- КИСТЬ: настоящая 3D-геометрия (никаких спрайтов/видео) ----
  let handWrap=null,handInner=null,handAnchor=null,handNorm=1,handAspect=1.9,handMax=0;
  (function(){ const a=document.getElementById('holoHand'); if(!a) return;
    const h=buildHand3D(); poseHand(h,1,0); h.rotation.set(0.34,-0.30,0.05);
    const b=new THREE.Box3().setFromObject(h); const c=b.getCenter(new THREE.Vector3()); const sz=b.getSize(new THREE.Vector3());
    handNorm=1/(sz.x||1); handAspect=(sz.x||1)/(sz.y||1);
    h.position.sub(c);
    handInner=new THREE.Group(); handInner.add(h);
    handWrap=new THREE.Group(); handWrap.add(handInner); scene.add(handWrap);
    handWrap.userData.hand=h; handAnchor=a; window.__handAspect=+handAspect.toFixed(3);
  })();
  makeSprite('holoWoman','kp-media/fig/woman_sheet.webp?v=92',6,6,36,340/316,{progType:'woman',fit:'contain'});

  // ---- РОБОТ ГАРАНТИЙ: настоящий 3D GLB, полный скелет + процедурное «дыхание» (руки/ноги/голова) ----
  let robot=null,robotNorm=1,robotBones={};const robotAnchor=document.getElementById('guarRobot');
  const BONEN=['Head','neck','Spine','Spine01','Spine02','Hips','LeftArm','RightArm','LeftForeArm','RightForeArm','LeftShoulder','RightShoulder','LeftUpLeg','RightUpLeg','LeftLeg','RightLeg'];
  if(robotAnchor){ new GLTFLoader().load('assets/robot.glb?v=4',function(g){ robot=g.scene;
    robot.traverse(function(o){ if(o.isMesh&&o.material){ const t=o.material.map||o.material.emissiveMap||null; const em=o.material.emissiveMap||null;
      // ГЛЯНЦЕВЫЙ чёрный корпус + лаймовые светящиеся акценты + отражения (чётко, без пересвета/мути)
      o.material=new THREE.MeshStandardMaterial({map:t,color:new THREE.Color(0xffffff),emissive:new THREE.Color(0x9AFF00),emissiveMap:em,emissiveIntensity:.8,metalness:.92,roughness:.15,envMap:ENVTEX,envMapIntensity:1.35});
      o.material.needsUpdate=true; o.frustumCulled=false; }
      if(BONEN.indexOf(o.name)>=0){ robotBones[o.name]=o; o.userData.baseQ=o.quaternion.clone(); } });
    const b=new THREE.Box3().setFromObject(robot);const c=b.getCenter(new THREE.Vector3());const s=b.getSize(new THREE.Vector3());
    robotNorm=1/(Math.max(s.x,s.y,s.z)||1); robot.position.sub(c);
    const grp=new THREE.Group();grp.add(robot);scene.add(grp);robot.userData.grp=grp;
  },undefined,function(){}); }
  var _e=new THREE.Euler();
  function boneIdle(name,ax,amp,spd,ph){var bn=robotBones[name];if(!bn||!bn.userData.baseQ)return;
    _e.setFromQuaternion(bn.userData.baseQ);_e[ax]+=Math.sin(_rt*spd+ph)*amp;bn.quaternion.setFromEuler(_e);}
  var _rt=0;

  function rectPos(r){return {x:r.left+r.width/2,y:-(r.top+r.height/2),w:r.width,h:r.height,vis:r.bottom>-160&&r.top<H+160};}
  function handProg(r){return clamp((H*0.86 - r.top)/(H*0.62),0,1);}
  function pinProg(){const el=document.getElementById('adtPin');if(!el)return 0;const r=el.getBoundingClientRect();return clamp(-r.top/Math.max(1,(r.height-H)),0,1);}

  function loop(t){requestAnimationFrame(loop);
    ptr.x+=(ptr.tx-ptr.x)*.05; ptr.y+=(ptr.ty-ptr.y)*.05;
    const time=t/1000; const dt=clock.getDelta(); _rt=time;
    // EYE (interactive hero centrepiece)
    if(eyeMesh&&eyeAnchors.length){const grp=eyeMesh.userData.grp;let best=null,bd=1e9;
      for(const an of eyeAnchors){const r=an.getBoundingClientRect();if(r.bottom>-120&&r.top<H+120){const cy=r.top+r.height/2;const d=Math.abs(cy-H/2);if(d<bd){bd=d;best=r;}}}
      if(best){const P=rectPos(best);grp.visible=true;
        // ИНТРО: глаз красиво появляется в 3D (масштаб + доворот), затем живёт
        const bt=Math.min(1,(t-(window.__t0||(window.__t0=t)))/1200); const be=1-Math.pow(1-bt,3);
        // глаз ВЕДЁТСЯ за пальцем: и поворот, и лёгкое смещение к курсору
        grp.position.set(P.x+ptr.x*P.w*0.06, P.y+Math.sin(time*1.0)*4 - ptr.y*P.h*0.05, 0);
        const sc=Math.min(P.w,P.h)*eyeMesh.userData.norm*0.9*(0.42+0.58*be);grp.scale.setScalar(sc);
        eyeMesh.rotation.y=ptr.x*1.05+Math.sin(time/2.8)*0.08+(1-be)*1.4;eyeMesh.rotation.x=ptr.y*0.75+Math.cos(time/3.2)*0.04;
        if(eyeMesh.userData.rim&&eyeMesh.userData.rim.uniforms){eyeMesh.userData.rim.uniforms.uI.value=1.05+Math.sin(time*1.4)*0.28;}
        window.__eyeRotY=eyeMesh.rotation.y;}
      else grp.visible=false;}
    // РОБОТ 3D (гарантии)
    if(robot&&robotAnchor){const r=robotAnchor.getBoundingClientRect();const P=rectPos(r);const grp=robot.userData.grp;grp.visible=P.vis;
      if(P.vis){const sc=Math.min(P.w,P.h)*robotNorm*0.82;grp.scale.setScalar(sc);
        // ПРИВЯЗАН к позиции: без дрейфа. Заметное живое движение на месте (шаг+дыхание)
        grp.position.set(P.x, P.y+Math.abs(Math.sin(time*1.3))*P.h*0.022, 0);
        robot.rotation.y=ptr.x*0.45+Math.sin(time*0.6)*0.16;
        // живой idle: корпус дышит/шагает, голова вертится, руки-ноги качаются
        boneIdle('Spine','x',0.05,1.3,0);   boneIdle('Spine02','x',0.045,1.3,0.3);
        boneIdle('Head','x',0.09,1.0,0.4);  boneIdle('Head','y',0.13,0.7,1.2);
        boneIdle('neck','x',0.05,1.0,0.4);
        boneIdle('LeftArm','z',0.16,1.3,0);   boneIdle('RightArm','z',0.16,1.3,Math.PI);
        boneIdle('LeftForeArm','z',0.11,1.35,0.6); boneIdle('RightForeArm','z',0.11,1.35,Math.PI+0.6);
        boneIdle('LeftUpLeg','x',0.10,1.3,0);  boneIdle('RightUpLeg','x',0.10,1.3,Math.PI);
        boneIdle('LeftLeg','x',0.07,1.3,0.5);  boneIdle('RightLeg','x',0.07,1.3,Math.PI+0.5);
      }}
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
      f.mesh.scale.set(w,h,1); f.glow.scale.set(w*1.15,h*1.15,1);
      f.mesh.rotation.z = f.opt.rotZ || 0;
      // хук для DOM: раскрытие руки в % (0..1) — используется для показа заголовка
      if(f.opt.progType==='hand') window.__handOpen = prog;
    }
    // КИСТЬ 3D
    if(handWrap&&handAnchor){
      const r=handAnchor.getBoundingClientRect(); const P=rectPos(r);
      handWrap.visible=P.vis;
      if(P.vis){
        const prog=handProg(r);   // симметрично: открывается вниз, закрывается обратно вверх
        window.__handOpen=prog;
        poseHand(handWrap.userData.hand,prog,time);
        const sc=P.w*handNorm*0.82; handWrap.scale.setScalar(sc);
        // ЗАКРЕПЛЕНА в своей позиции: без дрейфа от скролла, только дыхание + наклон/слежение
        handWrap.position.set(P.x, P.y+Math.sin(time*0.8)*2.5, 0);
        handInner.rotation.y=ptr.x*0.30+Math.sin(time*0.5)*0.05; handInner.rotation.x=-ptr.y*0.16;
      }
    }
    renderer.render(scene,cam);
  }
  requestAnimationFrame(loop);
}
