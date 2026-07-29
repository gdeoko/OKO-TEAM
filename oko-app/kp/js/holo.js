import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { buildHand3D, poseHand } from './hand3d.js?v=101';
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
      // ОБЪЁМНЫЙ 3D-глаз: глянцевый лайм с тенями и бликом (не плоская пересвеченная заливка).
      // Базовый цвет чуть глубже бренда, чтобы освещённые участки выходили в #9AFF00, а теневые — темнее (объём).
      o.material=new THREE.MeshStandardMaterial({
        color:new THREE.Color(0x58A300), emissive:new THREE.Color(0x123000), emissiveIntensity:.32,
        metalness:.50, roughness:.34, normalMap:nm, envMap:ENVTEX, envMapIntensity:.95, side:THREE.DoubleSide });
      o.material.toneMapped=true;   // ACES мягко сжимает сильный ключевой свет → плавный градиент + глянцевый блик = объём и тень
      o.material.needsUpdate=true; } });
    const b=new THREE.Box3().setFromObject(eyeMesh);const c=b.getCenter(new THREE.Vector3());const s=b.getSize(new THREE.Vector3());const m=Math.max(s.x,s.y,s.z)||1;eyeMesh.position.sub(c);eyeMesh.userData.norm=1/m;const grp=new THREE.Group();grp.add(eyeMesh);
    // чистый глаз без лишних оболочек — только сам глаз + мягкое CSS-свечение под ним
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
  let robot=null,robotNorm=1,robotBones={},robotMats=[];const robotAnchor=document.getElementById('guarRobot');
  const BONEN=['Head','neck','Spine','Spine01','Spine02','Hips','LeftArm','RightArm','LeftForeArm','RightForeArm','LeftShoulder','RightShoulder','LeftUpLeg','RightUpLeg','LeftLeg','RightLeg'];
  if(robotAnchor){ new GLTFLoader().load('assets/robot.glb?v=4',function(g){ robot=g.scene;
    robot.traverse(function(o){ if(o.isMesh&&o.material){ const t=o.material.map||o.material.emissiveMap||null; const em=o.material.emissiveMap||null;
      // ГЛЯНЦЕВЫЙ чёрный корпус + лаймовые светящиеся акценты + отражения (чётко, без пересвета/мути)
      o.material=new THREE.MeshStandardMaterial({map:t,color:new THREE.Color(0xffffff),emissive:new THREE.Color(0x9AFF00),emissiveMap:em,emissiveIntensity:.8,metalness:.92,roughness:.15,envMap:ENVTEX,envMapIntensity:1.35});
      o.material.needsUpdate=true; o.frustumCulled=false; robotMats.push(o.material); }
      if(BONEN.indexOf(o.name)>=0){ robotBones[o.name]=o; o.userData.baseQ=o.quaternion.clone(); } });
    const b=new THREE.Box3().setFromObject(robot);const c=b.getCenter(new THREE.Vector3());const s=b.getSize(new THREE.Vector3());
    robotNorm=1/(Math.max(s.x,s.y,s.z)||1); robot.position.sub(c);
    const grp=new THREE.Group();grp.add(robot);scene.add(grp);robot.userData.grp=grp;
  },undefined,function(){}); }
  var _e=new THREE.Euler(),_tq=new THREE.Quaternion(),_rt=0,_poseAcc={};
  function addPose(name,ex,ey,ez){var p=_poseAcc[name]||(_poseAcc[name]=[0,0,0]);p[0]+=ex;p[1]+=ey;p[2]+=ez;}
  function applyPose(){for(var nm in _poseAcc){var bn=robotBones[nm];var p=_poseAcc[nm];if(bn&&bn.userData.baseQ){_e.set(p[0],p[1],p[2]);_tq.setFromEuler(_e);bn.quaternion.copy(bn.userData.baseQ).multiply(_tq);}p[0]=p[1]=p[2]=0;}}
  // ---- ЖЕСТЫ РОБОТА (живой персонаж): 5 анимаций по кругу ----
  function osc(t,spd,ph){return Math.sin(t*spd+ph);}
  // ТОЛЬКО 3 чистых жеста (реалистичная физика, без деформации): приветствие, сложение рук перед собой, шаги
  var GESTURES=[
    // 0) ПРИВЕТСТВИЕ: рука с ОТКРЫТОЙ стороны (для зрителя — правая, кость LeftArm) ПРЯМАЯ,
    //    чуть поднимается и машет ВВЕРХ-ВНИЗ (качается только угол подъёма; локоть НЕ сгибается, вперёд/назад не двигается)
    function(g,t,w){var sw=osc(t,4.6,0);
      addPose('LeftArm',(1.25+0.40*sw)*w,0,0);               // рука поднимается ВПЕРЁД к зрителю и машет ВВЕРХ-ВНИЗ (ось X, без ухода вбок/назад, без сгибания)
      addPose('Head',0,-0.03*w,0);addPose('Spine',0.02*w,0,0);},
    // 1) СКЛАДЫВАЕТ ОБЕ РУКИ ПЕРЕД СОБОЙ на грудь/пузо (вперёд к зрителю, не назад): плечи вперёд + предплечья сходятся спереди
    function(g,t,w){addPose('RightArm',0.90*w,0,0.30*w);addPose('LeftArm',0.90*w,0,-0.30*w);
      addPose('RightForeArm',0,0,1.05*w);addPose('LeftForeArm',0,0,-1.05*w);
      addPose('Head',0.05*w,0,0);addPose('Spine',0.03*w,0,0);},
    // 2) ШАГАЕТ/топает на месте + лёгкое покачивание корпуса
    function(g,t,w){var tap=osc(t,4.4,0);
      addPose('RightUpLeg',(0.20+0.16*tap)*w,0,0);addPose('RightLeg',(-0.26-0.10*tap)*w,0,0);
      addPose('LeftUpLeg',(0.20-0.16*tap)*w,0,0);addPose('LeftLeg',(-0.26+0.10*tap)*w,0,0);
      addPose('Hips',0,0.05*osc(t,2.2,0)*w,0);addPose('Head',0.03*tap*w,0,0);}
  ];
  var gi=0,gStart=0,gDur=3.4,gGap=1.2,gPhase='play';

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
        window.__eyeRotY=eyeMesh.rotation.y;}
      else grp.visible=false;}
    // РОБОТ 3D (гарантии) — живой персонаж: дыхание + чередующиеся жесты + свечение/моргание глаза
    if(robot&&robotAnchor){const r=robotAnchor.getBoundingClientRect();const P=rectPos(r);const grp=robot.userData.grp;grp.visible=P.vis;
      if(P.vis){const sc=Math.min(P.w,P.h)*robotNorm*0.82;grp.scale.setScalar(sc);
        grp.position.set(P.x, P.y+Math.sin(time*1.1)*P.h*0.012, 0);
        robot.rotation.y=ptr.x*0.35+Math.sin(time*0.5)*0.10;
        // базовое дыхание (мягкое, всегда)
        addPose('Spine',Math.sin(time*1.1)*0.03,0,0);addPose('Spine02',Math.sin(time*1.1+0.3)*0.025,0,0);
        addPose('Head',Math.sin(time*0.9)*0.03,Math.sin(time*0.6)*0.05,0);addPose('neck',Math.sin(time*0.9)*0.02,0,0);
        addPose('LeftArm',0,0,Math.sin(time*1.0)*0.04);addPose('RightArm',0,0,-Math.sin(time*1.0)*0.04);
        // планировщик жестов
        if(!gStart)gStart=time;
        var el=time-gStart, w;
        if(gPhase==='play'){ w=Math.min(1,el/0.6)*(1-Math.max(0,(el-(gDur-0.6))/0.6)); w=Math.max(0,w);
          GESTURES[gi](el/gDur,el,w);
          if(el>=gDur){gPhase='gap';gStart=time;}
        } else { if(el>=gGap){gPhase='play';gStart=time;gi=(gi+1)%GESTURES.length;} }
        applyPose();
        // свечение глаза на голове + моргание
        var blink=1.0; var bc=(time%3.4); if(bc<0.13){blink=0.18;} else if(bc<0.24){blink=0.6;}
        var eg=(0.72+0.22*Math.sin(time*1.8))*blink;
        for(var mi=0;mi<robotMats.length;mi++){robotMats[mi].emissiveIntensity=eg;}
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
        if(prog>0.9 && (window.__handOpenLast||0)<=0.9){try{window.__sfx&&window.__sfx('open');}catch(e){}}
        window.__handOpenLast=prog;
        window.__handOpen=prog;
        poseHand(handWrap.userData.hand,prog,time);
        const sc=P.w*handNorm*0.82; handWrap.scale.setScalar(sc);
        // ВЫЕЗД СЛЕВА по таймингу скролла (и обратно при скролле вверх), синхронно с раскрытием
        const slide=(1-clamp(prog*1.9,0,1))*(-P.w*0.55);
        handWrap.position.set(P.x+slide, P.y+Math.sin(time*0.8)*2.5, 0);
        handInner.rotation.y=ptr.x*0.30+Math.sin(time*0.5)*0.05; handInner.rotation.x=-ptr.y*0.16;
      }
    }
    renderer.render(scene,cam);
  }
  requestAnimationFrame(loop);
}
