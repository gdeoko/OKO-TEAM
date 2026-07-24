import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
// DOM-synced WebGL: eye(GLB) + hand/woman video-holograms (scroll-scrubbed) + robot(cutout)
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
  scene.add(new THREE.AmbientLight(0xffffff,.9));
  const key=new THREE.DirectionalLight(0xffffff,1.5); key.position.set(2,3,5); scene.add(key);
  const lime=new THREE.PointLight(0x9AFF00,1.8,4000); lime.position.set(-300,-100,400); scene.add(lime);
  // pointer / gyro (correct, non-mirrored)
  const ptr={x:0,y:0,tx:0,ty:0};
  addEventListener('pointermove',e=>{ptr.tx=(e.clientX/innerWidth-.5)*2;ptr.ty=(e.clientY/innerHeight-.5)*2;});
  if(window.DeviceOrientationEvent)addEventListener('deviceorientation',e=>{if(e.gamma!=null){ptr.tx=Math.max(-1,Math.min(1,e.gamma/38));ptr.ty=Math.max(-1,Math.min(1,(e.beta-42)/38));}},true);
  // scroll activity (for hybrid scrub)
  let scrollAt=-9999; addEventListener('scroll',()=>{scrollAt=performance.now();},{passive:true});
  const clamp=(v,a,b)=>v<a?a:v>b?b:v;
  function glowTex(){const cv=document.createElement('canvas');cv.width=cv.height=256;const g=cv.getContext('2d');const rg=g.createRadialGradient(128,128,6,128,128,128);rg.addColorStop(0,'rgba(154,255,0,.42)');rg.addColorStop(.5,'rgba(120,220,10,.12)');rg.addColorStop(1,'rgba(0,0,0,0)');g.fillStyle=rg;g.fillRect(0,0,256,256);return new THREE.CanvasTexture(cv);}
  const GLOW=glowTex();
  const figs=[];

  // ---- VIDEO HOLOGRAM (hand / woman) ----
  function makeVideoHolo(id,src,opt){
    opt=opt||{};
    const anchor=document.getElementById(id); if(!anchor) return null;
    const v=document.createElement('video'); v.src=src; v.muted=true; v.loop=true; v.playsInline=true; v.setAttribute('muted',''); v.setAttribute('playsinline','');
    v.style.cssText='position:fixed;width:2px;height:2px;opacity:0;pointer-events:none;left:-10px;top:-10px';
    document.body.appendChild(v);
    const tex=new THREE.VideoTexture(v); tex.minFilter=THREE.LinearFilter;
    // orig=1 -> keep original colours (woman). orig=0 -> green holo (hand)
    const orig=opt.orig?1:0;
    const mat=new THREE.ShaderMaterial({transparent:true,depthWrite:false,uniforms:{map:{value:tex},uReveal:{value:0},uGlow:{value:new THREE.Color(0x9AFF00)},uTime:{value:0},uOpacity:{value:0},uOrig:{value:orig}},
      vertexShader:`varying vec2 vUv;uniform float uTime;void main(){vUv=uv;vec3 p=position;p.z+=sin(p.x*0.9+uTime)*3.0;gl_Position=projectionMatrix*modelViewMatrix*vec4(p,1.0);}`,
      fragmentShader:`uniform sampler2D map;uniform float uReveal,uTime,uOpacity,uOrig;uniform vec3 uGlow;varying vec2 vUv;
      void main(){vec4 c=texture2D(map,vUv);float lum=dot(c.rgb,vec3(0.299,0.587,0.114));
      float a=1.0-smoothstep(0.62,0.90,lum);           /* remove white bg */
      vec3 col;
      if(uOrig>0.5){
        /* WOMAN: original colour + recolour bright brain traces to green/white by scroll */
        col=c.rgb*1.05;
        float neuron=smoothstep(0.34,0.78,lum);        /* bright neuron/circuit traces */
        vec3 neon=mix(uGlow, vec3(1.0), 0.45);
        col=mix(col, neon*1.12, clamp(neuron*uReveal*0.95,0.0,1.0));
        col+=uGlow*neuron*uReveal*0.4;
      } else {
        /* HAND: green hologram */
        float circuit=smoothstep(0.30,0.58,lum)*(1.0-smoothstep(0.72,0.94,lum));
        col=c.rgb*1.14 + uGlow*circuit*(0.35+uReveal*1.7);
        col += mix(uGlow,vec3(1.0),0.35)*circuit*uReveal*0.9;
        col += uGlow*0.05*sin(vUv.y*360.0+uTime*2.0)*a;
      }
      if(a<0.03)discard; gl_FragColor=vec4(col,a*(0.94+0.06*uOrig)*uOpacity);}`});
    const mesh=new THREE.Mesh(new THREE.PlaneGeometry(1,1,24,18),mat);
    const glow=new THREE.Sprite(new THREE.SpriteMaterial({map:GLOW,transparent:true,opacity:.4,blending:THREE.AdditiveBlending,depthWrite:false}));
    glow.position.z=-30;
    const grp=new THREE.Group(); grp.add(glow); grp.add(mesh); scene.add(grp);
    const f={id,type:'video',anchor,v,mat,mesh,glow,grp,opt,clicked:0,dur:8,aspect:1.2};
    v.addEventListener('loadedmetadata',()=>{f.dur=v.duration||8;if(v.videoWidth)f.aspect=v.videoWidth/v.videoHeight;});
    anchor.style.pointerEvents='auto';
    anchor.addEventListener('click',()=>{f.clicked=1;});
    if(opt.mode==='scrub'){ v.pause(); } else { v.play().catch(()=>{}); }
    figs.push(f); return f;
  }

  // ---- IMAGE HOLOGRAM (robot cutout, solid) ----
  function makeImageHolo(id,src,opt){
    opt=opt||{};
    const anchor=document.getElementById(id); if(!anchor) return null;
    const tex=new THREE.TextureLoader().load(src); tex.minFilter=THREE.LinearMipmapLinearFilter; tex.magFilter=THREE.LinearFilter; tex.anisotropy=4;
    const mat=new THREE.ShaderMaterial({transparent:true,depthWrite:false,uniforms:{map:{value:tex},uTime:{value:0},uOpacity:{value:0},uBlink:{value:0}},
      vertexShader:`varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}`,
      fragmentShader:`uniform sampler2D map;uniform float uTime,uOpacity,uBlink;varying vec2 vUv;
      void main(){vec4 c=texture2D(map,vUv);
      /* gentle alive breathing on brightness + faint lime rim */
      float b=0.97+0.05*sin(uTime*1.6);
      vec3 col=c.rgb*b;
      if(c.a<0.02)discard; gl_FragColor=vec4(col,c.a*uOpacity);}`});
    const mesh=new THREE.Mesh(new THREE.PlaneGeometry(1,1,2,2),mat);
    const glow=new THREE.Sprite(new THREE.SpriteMaterial({map:GLOW,transparent:true,opacity:.5,blending:THREE.AdditiveBlending,depthWrite:false}));
    glow.position.z=-30;
    const grp=new THREE.Group(); grp.add(glow); grp.add(mesh); scene.add(grp);
    // native aspect from image
    const f={id,type:'image',anchor,mat,mesh,glow,grp,opt,clicked:0,aspect:0.575};
    const img=new Image(); img.onload=()=>{f.aspect=img.naturalWidth/img.naturalHeight;}; img.src=src;
    anchor.style.pointerEvents='auto';
    anchor.addEventListener('click',()=>{f.clicked=1;});
    figs.push(f); return f;
  }

  // EYE (GLB) — one mesh serves hero + clone anchors
  let eyeMesh=null; const eyeAnchors=['holoEye','holoEye2'].map(id=>document.getElementById(id)).filter(Boolean);
  function eyeReady(){ window.__eyeReady=true; try{dispatchEvent(new Event('eye-ready'));}catch(e){} }
  if(eyeAnchors.length){ new GLTFLoader().load('assets/oko-eye.glb',g=>{eyeMesh=g.scene;const b=new THREE.Box3().setFromObject(eyeMesh);const c=b.getCenter(new THREE.Vector3());const s=b.getSize(new THREE.Vector3());const m=Math.max(s.x,s.y,s.z)||1;eyeMesh.position.sub(c);eyeMesh.userData.norm=1/m;const grp=new THREE.Group();grp.add(eyeMesh);scene.add(grp);eyeMesh.userData.grp=grp;eyeReady();},undefined,()=>{eyeReady();}); }
  else eyeReady();

  makeVideoHolo('holoHand','kp-media/ref/robohand.mp4',{mode:'scrub',slide:'left',orig:false,progType:'hand',fit:'width'});
  makeVideoHolo('holoWoman','kp-media/ref/robohead.mp4',{mode:'hybrid',orig:true,progType:'woman',fit:'contain'});
  makeImageHolo('holoRobot','kp-media/fig/robot.webp',{face:true});

  function rectPos(r){return {x:r.left+r.width/2,y:-(r.top+r.height/2),w:r.width,h:r.height,vis:r.bottom>-120&&r.top<H+120};}
  function handProg(r){return clamp((H*0.9 - r.top)/(H*0.78),0,1);}
  function pinProg(){const el=document.getElementById('adtPin');if(!el)return 0;const r=el.getBoundingClientRect();return clamp(-r.top/Math.max(1,(r.height-H)),0,1);}

  function loop(t){requestAnimationFrame(loop);
    ptr.x+=(ptr.tx-ptr.x)*.06; ptr.y+=(ptr.ty-ptr.y)*.06;
    const time=t/1000; const scrolling=(performance.now()-scrollAt)<150;
    // EYE — render at whichever anchor (hero or clone) is on screen
    if(eyeMesh&&eyeAnchors.length){const grp=eyeMesh.userData.grp;let best=null,bd=1e9;
      for(const an of eyeAnchors){const r=an.getBoundingClientRect();if(r.bottom>-120&&r.top<H+120){const cy=r.top+r.height/2;const d=Math.abs(cy-H/2);if(d<bd){bd=d;best=r;}}}
      if(best){const P=rectPos(best);grp.visible=true;grp.position.set(P.x,P.y+Math.sin(time*1.1)*6,0);const sc=Math.min(P.w,P.h)*eyeMesh.userData.norm*0.9;grp.scale.setScalar(sc);
        eyeMesh.rotation.y=ptr.x*0.6+Math.sin(time/2.6)*0.12;eyeMesh.rotation.x=ptr.y*0.4+Math.cos(time/3)*0.06;}
      else grp.visible=false;}
    for(const f of figs){const r=f.anchor.getBoundingClientRect();const P=rectPos(r);f.grp.visible=P.vis;if(!P.vis)continue;
      if(f.type==='image'){
        // ROBOT: solid cutout, fit to anchor keeping aspect
        f.mat.uniforms.uTime.value=time;
        const enter=clamp((H*0.92 - r.top)/(H*0.5),0,1);
        f.mat.uniforms.uOpacity.value=clamp(enter*1.6,0,1);
        let w=P.w, h=w/f.aspect; if(h>P.h){h=P.h;w=h*f.aspect;}
        f.mesh.scale.set(w,h,1); f.glow.scale.set(w*1.35,h*1.15,1); f.glow.position.y=0;
        f.grp.position.set(P.x, P.y+Math.sin(time*0.8)*7, 0);
        let ry=ptr.x*0.4, rx=-ptr.y*0.28;
        if(f.opt.face) ry += (1-enter)*0.8;            // turns to face as it enters
        if(f.clicked>0){f.clicked=Math.max(0,f.clicked-0.03);ry+=Math.sin(f.clicked*12)*0.55;}
        f.mesh.rotation.set(rx,ry,0);
        continue;
      }
      // VIDEO figures
      f.mat.uniforms.uTime.value=time;
      let prog=0;
      if(f.opt.progType==='hand') prog=handProg(r);
      else if(f.opt.progType==='woman') prog=pinProg();
      // playback: scrub (hand) / hybrid (woman)
      if(f.opt.mode==='scrub'){ if(f.dur) f.v.currentTime=prog*(f.dur-0.05); }
      else if(f.opt.mode==='hybrid'){
        if(scrolling){ if(!f.v.paused)f.v.pause(); if(f.dur) f.v.currentTime=prog*(f.dur-0.05); }
        else { if(f.v.paused) f.v.play().catch(()=>{}); }
      }
      f.mat.uniforms.uReveal.value=f.opt.orig?clamp(prog*1.6,0,1):clamp(handProg(r)*1.3,0,1);
      f.mat.uniforms.uOpacity.value=clamp(((H*0.92-r.top)/(H*0.5))*1.5,0,1);
      // aspect-fit: contain (woman, no crop) / width-fit (hand, transparent margins overflow)
      const asp=f.aspect||1.2; let w,h;
      if(f.opt.fit==='contain'){ w=P.w; h=w/asp; if(h>P.h){h=P.h;w=h*asp;} }
      else { w=P.w; h=w/asp; }
      let x=P.x, y=P.y+Math.sin(time*0.9+figs.indexOf(f))*6;
      if(f.opt.slide){ x += (1-clamp(prog*2,0,1))*(-P.w*0.6); }   // slide in from left w/ scroll
      f.grp.position.set(x,y,0);
      f.mesh.scale.set(w,h,1); f.glow.scale.set(w*1.4,h*1.4,1);
      let ry=ptr.x*0.45, rx=-ptr.y*0.34;
      if(f.clicked>0){ f.clicked=Math.max(0,f.clicked-0.03); ry+=Math.sin(f.clicked*10)*0.5; }
      f.mesh.rotation.set(rx,ry,0);
    }
    renderer.render(scene,cam);
  }
  requestAnimationFrame(loop);
  window.__holoClickRobot=()=>{const rob=figs.find(f=>f.id==='holoRobot');if(rob)rob.clicked=1;};
}
