import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
// DOM-synced WebGL hologram system: eye(GLB) + video-holograms (hand/woman/robot)
export function initHolo(){
  const canvas=document.getElementById('holo-canvas'); if(!canvas) return;
  let renderer; try{renderer=new THREE.WebGLRenderer({canvas,alpha:true,antialias:true,powerPreference:'high-performance'});}catch(e){return;}
  const LOW=(navigator.hardwareConcurrency||4)<=4 && matchMedia('(pointer:coarse)').matches;
  renderer.setPixelRatio(Math.min(devicePixelRatio||1, LOW?1.3:2));
  const scene=new THREE.Scene();
  let W=innerWidth,H=innerHeight;
  const cam=new THREE.OrthographicCamera(0,W,0,-H,-2000,2000); cam.position.z=10;
  function resize(){W=innerWidth;H=innerHeight;renderer.setSize(W,H,false);cam.right=W;cam.bottom=-H;cam.updateProjectionMatrix();}
  resize(); addEventListener('resize',resize);
  scene.add(new THREE.AmbientLight(0xffffff,.85));
  const key=new THREE.DirectionalLight(0xffffff,1.5); key.position.set(2,3,5); scene.add(key);
  const lime=new THREE.PointLight(0x9AFF00,1.8,4000); lime.position.set(-300,-100,400); scene.add(lime);
  // pointer / gyro (correct, non-mirrored)
  const ptr={x:0,y:0,tx:0,ty:0};
  addEventListener('pointermove',e=>{ptr.tx=(e.clientX/innerWidth-.5)*2;ptr.ty=(e.clientY/innerHeight-.5)*2;});
  if(window.DeviceOrientationEvent)addEventListener('deviceorientation',e=>{if(e.gamma!=null){ptr.tx=Math.max(-1,Math.min(1,e.gamma/38));ptr.ty=Math.max(-1,Math.min(1,(e.beta-42)/38));}},true);
  function glowTex(){const cv=document.createElement('canvas');cv.width=cv.height=256;const g=cv.getContext('2d');const rg=g.createRadialGradient(128,128,6,128,128,128);rg.addColorStop(0,'rgba(154,255,0,.45)');rg.addColorStop(.5,'rgba(120,220,10,.12)');rg.addColorStop(1,'rgba(0,0,0,0)');g.fillStyle=rg;g.fillRect(0,0,256,256);return new THREE.CanvasTexture(cv);}
  const GLOW=glowTex();
  const figs=[];
  function makeVideoHolo(id,src,opt){
    opt=opt||{};
    const anchor=document.getElementById(id); if(!anchor) return null;
    const v=document.createElement('video'); v.src=src; v.muted=true; v.loop=true; v.playsInline=true; v.setAttribute('muted',''); v.setAttribute('playsinline','');
    v.style.cssText='position:fixed;width:2px;height:2px;opacity:0;pointer-events:none;left:-10px;top:-10px';
    document.body.appendChild(v);
    const tex=new THREE.VideoTexture(v); tex.minFilter=THREE.LinearFilter;
    const mat=new THREE.ShaderMaterial({transparent:true,depthWrite:false,uniforms:{map:{value:tex},uReveal:{value:opt.reveal?0:1},uGlow:{value:new THREE.Color(0x9AFF00)},uTime:{value:0},uOpacity:{value:0}},
      vertexShader:`varying vec2 vUv;uniform float uTime;void main(){vUv=uv;vec3 p=position;p.z+=sin(p.x*0.9+uTime)*4.0;gl_Position=projectionMatrix*modelViewMatrix*vec4(p,1.0);}`,
      fragmentShader:`uniform sampler2D map;uniform float uReveal,uTime,uOpacity;uniform vec3 uGlow;varying vec2 vUv;
      void main(){vec4 c=texture2D(map,vUv);float lum=dot(c.rgb,vec3(0.299,0.587,0.114));
      float a=1.0-smoothstep(0.60,0.88,lum);
      vec3 col=c.rgb*1.14;
      float circuit=smoothstep(0.24,0.55,lum)*(1.0-smoothstep(0.72,0.92,lum));
      col+=uGlow*circuit*(0.35+uReveal*1.9);
      col+=uGlow*0.05*sin(vUv.y*360.0+uTime*2.0)*a;
      if(a<0.03)discard; gl_FragColor=vec4(col,a*0.96*uOpacity);}`});
    const mesh=new THREE.Mesh(new THREE.PlaneGeometry(1,1,24,18),mat);
    const glow=new THREE.Sprite(new THREE.SpriteMaterial({map:GLOW,transparent:true,opacity:.45,blending:THREE.AdditiveBlending,depthWrite:false}));
    glow.position.z=-30;
    const grp=new THREE.Group(); grp.add(glow); grp.add(mesh); scene.add(grp);
    const f={id,anchor,v,mat,mesh,glow,grp,opt,clicked:0};
    // click reaction via anchor
    anchor.style.pointerEvents='auto';
    anchor.addEventListener('click',()=>{f.clicked=1;});
    v.play().catch(()=>{});
    figs.push(f); return f;
  }
  // EYE (GLB)
  let eyeMesh=null; const eyeAnchor=document.getElementById('holoEye');
  if(eyeAnchor){ new GLTFLoader().load('assets/oko-eye.glb',g=>{eyeMesh=g.scene;const b=new THREE.Box3().setFromObject(eyeMesh);const c=b.getCenter(new THREE.Vector3());const s=b.getSize(new THREE.Vector3());const m=Math.max(s.x,s.y,s.z)||1;eyeMesh.position.sub(c);eyeMesh.userData.norm=1/m;const grp=new THREE.Group();grp.add(eyeMesh);scene.add(grp);eyeMesh.userData.grp=grp;const fb=document.getElementById('eye-fallback');if(fb)fb.style.display='none';},undefined,()=>{}); }
  makeVideoHolo('holoHand','kp-media/ref/robohand.mp4',{reveal:false,slide:'left'});
  makeVideoHolo('holoWoman','kp-media/ref/robohead.mp4',{reveal:true});
  makeVideoHolo('holoRobot','kp-media/fig/assist.mp4',{reveal:false,face:true});
  function rectPos(r){return {x:r.left+r.width/2,y:-(r.top+r.height/2),w:r.width,h:r.height,vis:r.bottom>-80&&r.top<H+80};}
  function loop(t){requestAnimationFrame(loop);
    ptr.x+=(ptr.tx-ptr.x)*.06; ptr.y+=(ptr.ty-ptr.y)*.06;
    const time=t/1000;
    // EYE
    if(eyeMesh&&eyeAnchor){const r=eyeAnchor.getBoundingClientRect();const P=rectPos(r);const grp=eyeMesh.userData.grp;
      grp.position.set(P.x,P.y+Math.sin(time*1.1)*6,0); const sc=Math.min(P.w,P.h)*eyeMesh.userData.norm*0.9; grp.scale.setScalar(sc);
      eyeMesh.rotation.y=ptr.x*0.6+Math.sin(time/2.6)*0.12; eyeMesh.rotation.x=ptr.y*0.4+Math.cos(time/3)*0.06;
      grp.visible=P.vis;}
    // VIDEO HOLOS
    for(const f of figs){const r=f.anchor.getBoundingClientRect();const P=rectPos(r);f.grp.visible=P.vis;if(!P.vis)continue;
      // reveal by how far the anchor has entered from bottom
      const enter=Math.max(0,Math.min(1,(H*0.9 - r.top)/(H*0.6)));
      if(f.opt.reveal) f.mat.uniforms.uReveal.value=enter;
      f.mat.uniforms.uOpacity.value=Math.max(0,Math.min(1,enter*1.4));
      f.mat.uniforms.uTime.value=time;
      let x=P.x, y=P.y+Math.sin(time*0.9+figs.indexOf(f))*7;
      if(f.opt.slide){ x += (1-enter)*(-P.w*0.55); } // slide from left with scroll
      f.grp.position.set(x,y,0);
      f.mesh.scale.set(P.w,P.h,1); f.glow.scale.set(P.w*1.5,P.h*1.5,1);
      // tilt (correct direction) + click spin + face-on-scroll
      let ry=ptr.x*0.5, rx=-ptr.y*0.4;
      if(f.opt.face){ ry += (1-enter)*0.9; } // turns to face as it enters
      if(f.clicked>0){ f.clicked=Math.max(0,f.clicked-0.03); ry+=Math.sin(f.clicked*10)*0.5; f.mat.uniforms.uReveal.value=Math.max(f.mat.uniforms.uReveal.value,f.clicked); }
      f.mesh.rotation.y=ry; f.mesh.rotation.x=rx;
    }
    renderer.render(scene,cam);
  }
  requestAnimationFrame(loop);
  window.__holoClickRobot=()=>{const rob=figs.find(f=>f.id==='holoRobot');if(rob)rob.clicked=1;};
}
