import * as THREE from 'three';
import { EffectComposer } from './vendor/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from './vendor/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from './vendor/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from './vendor/jsm/postprocessing/OutputPass.js';
import { RoomEnvironment } from './vendor/jsm/environments/RoomEnvironment.js';

const gsap = window.gsap, ScrollTrigger = window.ScrollTrigger, Lenis = window.Lenis;
gsap.registerPlugin(ScrollTrigger);

const RM = matchMedia('(prefers-reduced-motion: reduce)').matches;
const MOBILE = matchMedia('(max-width: 760px)').matches;
const V = () => innerHeight;

function radialTexture(stops){
  const s=256, cv=document.createElement('canvas'); cv.width=cv.height=s;
  const x=cv.getContext('2d'); const g=x.createRadialGradient(s/2,s/2,0,s/2,s/2,s/2);
  stops.forEach(([o,c])=>g.addColorStop(o,c)); x.fillStyle=g; x.fillRect(0,0,s,s);
  const t=new THREE.CanvasTexture(cv); t.needsUpdate=true; return t;
}
const rnd=(a,b)=>a+Math.random()*(b-a);
const smooth=(a,b,x)=>{const t=Math.min(1,Math.max(0,(x-a)/(b-a)));return t*t*(3-2*t);};

/* ═════════════════════════════════════════════════════════════════════
   НОЧНОЙ РЕЙС — единый 3D-мир, камера летит по сплайну на скролле
   ═════════════════════════════════════════════════════════════════════ */
let pulse=()=>{}, whoosh=()=>{};

function initJourney(){
  const canvas=document.getElementById('glj');
  const renderer=new THREE.WebGLRenderer({canvas,antialias:true,powerPreference:'high-performance'});
  renderer.setPixelRatio(Math.min(devicePixelRatio, MOBILE?1.5:1.8));
  renderer.toneMapping=THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure=1.02;
  renderer.outputColorSpace=THREE.SRGBColorSpace;

  const scene=new THREE.Scene();
  scene.background=new THREE.Color(0x03100a);
  scene.fog=new THREE.FogExp2(0x041710,0.026);

  const cam=new THREE.PerspectiveCamera(MOBILE?63:55,1,.1,140);
  const pmrem=new THREE.PMREMGenerator(renderer);
  scene.environment=pmrem.fromScene(new RoomEnvironment(),0.04).texture;

  /* --- свет --- */
  scene.add(new THREE.AmbientLight(0x0d3a1f,.7));
  const moonLight=new THREE.PointLight(0xFFE7A0,230,120,1.8); moonLight.position.set(3.5,9,-42); scene.add(moonLight);
  const rim=new THREE.DirectionalLight(0x4fd97a,.9); rim.position.set(-10,6,10); scene.add(rim);

  /* --- луна-маяк --- */
  const moon=new THREE.Mesh(new THREE.IcosahedronGeometry(4.6,5),
    new THREE.MeshStandardMaterial({color:0xFFD500,emissive:0xFFC400,emissiveIntensity:.9,roughness:.55}));
  const mp=moon.geometry.attributes.position;
  for(let i=0;i<mp.count;i++){const v=new THREE.Vector3().fromBufferAttribute(mp,i);
    v.multiplyScalar(1+Math.sin(v.x*2.8)*Math.cos(v.y*2.4)*Math.sin(v.z*3.1)*.03); mp.setXYZ(i,v.x,v.y,v.z);}
  moon.geometry.computeVertexNormals();
  moon.position.set(4,7.5,-46); scene.add(moon);
  const moonGlow=new THREE.Sprite(new THREE.SpriteMaterial({map:radialTexture([[0,'rgba(255,228,92,.9)'],[.3,'rgba(255,205,0,.4)'],[.62,'rgba(255,190,0,.1)'],[1,'rgba(0,0,0,0)']]),blending:THREE.AdditiveBlending,depthWrite:false,transparent:true}));
  moonGlow.scale.set(10.5,10.5,1); moonGlow.position.copy(moon.position); scene.add(moonGlow);

  /* --- зеркальный пол --- */
  const floor=new THREE.Mesh(new THREE.PlaneGeometry(240,240),
    new THREE.MeshStandardMaterial({color:0x05170d,metalness:.92,roughness:.4}));
  floor.rotation.x=-Math.PI/2; floor.position.y=-3; scene.add(floor);

  /* --- станции-главы: платформа + жёлтая луна-диск + живой силуэт --- */
  const texLoader=new THREE.TextureLoader();
  const discTex=radialTexture([[0,'#FFE45C'],[.5,'#FFD500'],[.92,'#E8BD00'],[1,'rgba(232,189,0,0)']]);
  const stations=[];
  function station(x,y,z,silhouettes){
    const g=new THREE.Group(); g.position.set(x,y,z);
    const base=new THREE.Mesh(new THREE.CylinderGeometry(2.35,2.5,.18,56),
      new THREE.MeshStandardMaterial({color:0x0b2114,metalness:.85,roughness:.34}));
    base.position.y=-2.9; g.add(base);
    const ring=new THREE.Mesh(new THREE.TorusGeometry(2.42,.045,14,72),
      new THREE.MeshStandardMaterial({color:0xFFD500,emissive:0xFFC400,emissiveIntensity:2.4,roughness:.4}));
    ring.rotation.x=Math.PI/2; ring.position.y=-2.78; g.add(ring);
    const disc=new THREE.Mesh(new THREE.CircleGeometry(1.62,56),
      new THREE.MeshBasicMaterial({map:discTex,transparent:true,depthWrite:false}));
    disc.position.set(0,-0.55,-0.06); disc.renderOrder=1; g.add(disc);
    silhouettes.forEach(([file,h,dx])=>{
      texLoader.load(`assets/${file}`,(t)=>{
        t.colorSpace=THREE.SRGBColorSpace;
        const aspect=t.image.width/t.image.height;
        const sp=new THREE.Sprite(new THREE.SpriteMaterial({map:t,transparent:true,depthWrite:false}));
        sp.scale.set(h*aspect,h,1); sp.position.set(dx,-2.8+h/2+.12,.06); sp.renderOrder=2; g.add(sp);
      });
    });
    const lamp=new THREE.PointLight(0xFFD500,7,11,2); lamp.position.set(0,.6,1.4); g.add(lamp);
    scene.add(g); stations.push(g); return g;
  }
  station(-6.5,0, 3.5, [['ph_dog.png',2.7,0]]).rotation.y=0.59;
  station( 6.5,0,-3.5, [['ph_cat.png',2.55,0]]).rotation.y=-0.56;
  station(-6.0,0,-10.5,[['ph_parrot.png',1.9,-0.95],['ph_fish.png',1.5,1.05]]).rotation.y=0.58;

  /* --- портал ОПТ --- */
  const portal=new THREE.Group(); portal.position.set(0,2.3,-19); scene.add(portal);
  const pring=new THREE.Mesh(new THREE.TorusGeometry(3.5,.14,18,90),
    new THREE.MeshStandardMaterial({color:0xFFD500,emissive:0xFFC400,emissiveIntensity:1.15,roughness:.35}));
  portal.add(pring);
  const pring2=new THREE.Mesh(new THREE.TorusGeometry(3.95,.05,12,90),
    new THREE.MeshStandardMaterial({color:0x4FD97A,emissive:0x2fae5a,emissiveIntensity:0.9,roughness:.4}));
  portal.add(pring2);
  const plight=new THREE.PointLight(0xFFD500,11,20,2); portal.add(plight);

  /* --- парящие товары --- */
  const matGreen=new THREE.MeshStandardMaterial({color:0x1B8A3A,roughness:.28,metalness:.35});
  const matDark=new THREE.MeshStandardMaterial({color:0x0c1a12,roughness:.35,metalness:.6});
  const matYellow=new THREE.MeshStandardMaterial({color:0xFFD500,emissive:0xFFB800,emissiveIntensity:.5,roughness:.3});
  const matIvory=new THREE.MeshStandardMaterial({color:0xEFF6EE,roughness:.4,metalness:.2});
  function bone(mat){const g=new THREE.Group();
    const s=new THREE.Mesh(new THREE.CapsuleGeometry(.15,.85,6,12),mat);s.rotation.z=Math.PI/2;g.add(s);
    [[-.56,.2],[-.56,-.2],[.56,.2],[.56,-.2]].forEach(([x,y])=>{const b=new THREE.Mesh(new THREE.SphereGeometry(.24,16,16),mat);b.position.set(x,y,0);g.add(b);});return g;}
  const makers=[()=>bone(matGreen),()=>bone(matIvory),
    ()=>new THREE.Mesh(new THREE.SphereGeometry(.42,24,24),matYellow),
    ()=>new THREE.Mesh(new THREE.SphereGeometry(.46,24,24),matGreen),
    ()=>new THREE.Mesh(new THREE.TorusGeometry(.34,.13,14,28),matGreen)];
  const floaters=[];
  const COUNT=MOBILE?12:20;
  for(let i=0;i<COUNT;i++){
    const o=makers[i%makers.length]();
    let x=rnd(-11,11); if(Math.abs(x)<5.2) x+=Math.sign(x||1)*5.2;
    o.position.set(x,rnd(2.4,6.4),rnd(-16,8));
    o.rotation.set(rnd(0,6),rnd(0,6),rnd(0,6)); o.scale.setScalar(rnd(.5,.95));
    o.userData={sp:rnd(.15,.6),ax:new THREE.Vector3(rnd(-1,1),rnd(-1,1),rnd(-1,1)).normalize(),ph:rnd(0,6),bob:rnd(.3,.8),y0:o.position.y};
    scene.add(o); floaters.push(o);
  }

  /* --- звёздная пыль --- */
  const N=MOBILE?1400:3000, pp=new Float32Array(N*3), cc=new Float32Array(N*3), ss=new Float32Array(N);
  const cg=new THREE.Color(0x4FD97A), cy=new THREE.Color(0xFFE45C), cw=new THREE.Color(0xffffff);
  for(let i=0;i<N;i++){
    pp[i*3]=rnd(-45,45); pp[i*3+1]=rnd(-6,26); pp[i*3+2]=rnd(-45,18);
    const r=Math.random(), c=r<.55?cg.clone():r<.85?cw.clone():cy.clone();
    cc[i*3]=c.r;cc[i*3+1]=c.g;cc[i*3+2]=c.b; ss[i]=rnd(.4,1.6);
  }
  const dg=new THREE.BufferGeometry();
  dg.setAttribute('position',new THREE.BufferAttribute(pp,3));
  dg.setAttribute('color',new THREE.BufferAttribute(cc,3));
  dg.setAttribute('aSize',new THREE.BufferAttribute(ss,1));
  const dust=new THREE.Points(dg,new THREE.ShaderMaterial({
    transparent:true,depthWrite:false,blending:THREE.AdditiveBlending,vertexColors:true,
    uniforms:{uTex:{value:radialTexture([[0,'rgba(255,255,255,1)'],[.4,'rgba(255,255,255,.6)'],[1,'rgba(255,255,255,0)']])}},
    vertexShader:`attribute float aSize;varying vec3 vC;void main(){vC=color;vec4 mv=modelViewMatrix*vec4(position,1.);gl_PointSize=aSize*(240./-mv.z);gl_Position=projectionMatrix*mv;}`,
    fragmentShader:`uniform sampler2D uTex;varying vec3 vC;void main(){float a=texture2D(uTex,gl_PointCoord).a;if(a<.02)discard;gl_FragColor=vec4(vC,a);}`}));
  scene.add(dust);

  /* --- маршрут камеры (главы жёстко привязаны к контрольным точкам) --- */
  const camPts=[
    new THREE.Vector3(0,1.5,15.5),
    new THREE.Vector3(-2.4,1.1,9.6),
    new THREE.Vector3(3.2,1.0,1.9),
    new THREE.Vector3(-2.6,1.0,-5.4),
    new THREE.Vector3(0,2.1,-13.5),
    new THREE.Vector3(0,2.3,-20.6),
  ];
  const lookPts=[
    new THREE.Vector3(3.2,4.2,-18),
    new THREE.Vector3(-6.6,-.8,3.2),
    new THREE.Vector3(6.6,-1.0,-3.8),
    new THREE.Vector3(-6.1,-1.0,-10.8),
    new THREE.Vector3(0,2.3,-19),
    new THREE.Vector3(2.2,4.2,-38),
  ];
  const camCurve=new THREE.CatmullRomCurve3(camPts,false,'centripetal');
  const lookCurve=new THREE.CatmullRomCurve3(lookPts,false,'centripetal');
  // прекомпьют: параметр кривой у каждой контрольной точки
  function anchorsOf(curve,pts){
    const S=800, us=pts.map(()=>0), best=pts.map(()=>1e9);
    for(let i=0;i<=S;i++){const u=i/S, q=curve.getPoint(u);
      pts.forEach((p,k)=>{const d=q.distanceToSquared(p); if(d<best[k]){best[k]=d;us[k]=u;}});}
    us[0]=0; us[us.length-1]=1; return us;
  }
  const camU=anchorsOf(camCurve,camPts), lookU=anchorsOf(lookCurve,lookPts);
  const KEYS=[0,.2,.4,.6,.8,1];
  function remap(p,us){
    let i=1; while(i<KEYS.length-1&&p>KEYS[i])i++;
    const t=(p-KEYS[i-1])/(KEYS[i]-KEYS[i-1]);
    return us[i-1]+(us[i]-us[i-1])*t;
  }

  /* --- bloom --- */
  const composer=new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene,cam));
  const bloom=new UnrealBloomPass(new THREE.Vector2(1,1),0.45,0.55,0.8);
  composer.addPass(bloom); composer.addPass(new OutputPass());
  pulse=()=>{ if(RM) return; gsap.fromTo(bloom,{strength:1.15},{strength:.5,duration:1.1,ease:'power2.out'}); };

  function resize(){renderer.setSize(innerWidth,innerHeight,false);composer.setSize(innerWidth,innerHeight);
    cam.aspect=innerWidth/innerHeight;cam.updateProjectionMatrix();}
  resize(); addEventListener('resize',resize);

  /* --- параллакс мыши --- */
  const m={x:0,y:0}, mt={x:0,y:0};
  addEventListener('pointermove',e=>{m.x=e.clientX/innerWidth-.5;m.y=e.clientY/innerHeight-.5;});

  /* --- прогресс путешествия --- */
  const prog={v:0};
  ScrollTrigger.create({trigger:'#journey',start:'top top',end:'bottom bottom',scrub:true,
    onUpdate:s=>{prog.v=s.progress; hud(s.progress);}});
  ScrollTrigger.create({trigger:'#journey',start:'top bottom',end:'bottom top',
    onToggle:s=>document.body.classList.toggle('in-journey',s.isActive)});

  /* --- главы: окна видимости --- */
  const CHW=[[0,.11],[.13,.29],[.33,.49],[.53,.69],[.73,.91]];
  const chs=[...document.querySelectorAll('.ch')];
  const railNodes=[...document.querySelectorAll('#rail .node')];
  const hudCh=document.getElementById('hud-ch'), hudBar=document.getElementById('hud-bar'), hudPct=document.getElementById('hud-pct');
  const CHNAMES=['зооопт · главная','собакам','кошкам','птицам · рыбкам','оптовикам'];
  let lastCh=0;
  function hud(p){
    let active=0;
    chs.forEach((el,i)=>{
      const [a,b]=CHW[i];
      const al=(i===0? 1-smooth(a+.02,b,p) : smooth(a,a+.05,p)*(1-smooth(b-.05,b,p)));
      el.style.opacity=al.toFixed(3);
      el.style.transform=`translateY(${(1-al)*34}px)`;
      el.style.pointerEvents = al>.5 ? 'auto':'none';
      if(al>.45) active=i;
    });
    railNodes.forEach((n,i)=>n.classList.toggle('on',i===active));
    hudCh.textContent=CHNAMES[active];
    hudBar.style.width=(p*100).toFixed(1)+'%';
    hudPct.textContent=Math.round(p*100)+'%';
    if(active!==lastCh){lastCh=active; pulse(); whoosh();}
  }
  hud(0);

  /* --- рейл: клик = перелёт --- */
  const journeyEl=document.getElementById('journey');
  railNodes.forEach(n=>n.addEventListener('click',()=>{
    const t=+n.dataset.t;
    const y=journeyEl.offsetTop + t*(journeyEl.offsetHeight - V());
    (window.__lenis?window.__lenis.scrollTo(y,{duration:1.6}):scrollTo(0,y));
  }));

  /* --- рендер-цикл --- */
  const clock=new THREE.Clock();
  const camPos=new THREE.Vector3(), lookPos=new THREE.Vector3();
  function loop(){
    requestAnimationFrame(loop);
    if(!document.body.classList.contains('in-journey')) return;
    const t=clock.getElapsedTime(), p=prog.v;
    mt.x+=(m.x-mt.x)*.05; mt.y+=(m.y-mt.y)*.05;
    camCurve.getPoint(remap(p,camU),camPos); lookCurve.getPoint(remap(p,lookU),lookPos);
    cam.position.set(camPos.x+mt.x*.9, camPos.y-mt.y*.7+Math.sin(t*.7)*.07, camPos.z);
    cam.lookAt(lookPos.x+mt.x*2.2, lookPos.y-mt.y*1.6+(MOBILE?-1.05:0), lookPos.z);
    moon.rotation.y=t*.05;
    portal.rotation.z=t*.12; pring2.rotation.z=-t*.3;
    stations.forEach((s,i)=>{s.children[1].rotation.z=t*(.25+i*.07);});
    floaters.forEach(o=>{o.rotateOnAxis?.(o.userData.ax,o.userData.sp*.01);
      o.position.y=o.userData.y0+Math.sin(t*o.userData.bob+o.userData.ph)*.35;});
    dust.rotation.y=t*.006;
    composer.render();
  }
  loop();
}

/* ═════════════════════════════════════════════════════════════════════
   НАШ МАРКЕТ — фото с мягким параллаксом на скролле
   ═════════════════════════════════════════════════════════════════════ */
function initShowcase(){
  const bg=document.querySelector('.show-bg'); if(!bg||RM) return;
  gsap.fromTo(bg,{yPercent:-7},{yPercent:7,ease:'none',
    scrollTrigger:{trigger:'#show',start:'top bottom',end:'bottom top',scrub:.4}});
}

/* ═════════════════════════════════════════════════════════════════════
   ЗВУК — эмбиент + whoosh на перелётах
   ═════════════════════════════════════════════════════════════════════ */
function initAudio(){
  const btn=document.getElementById('sound'); if(!btn) return;
  let ctx=null,on=false;
  function boot(){
    ctx=new (window.AudioContext||window.webkitAudioContext)();
    const master=ctx.createGain(); master.gain.value=0; master.connect(ctx.destination);
    const lp=ctx.createBiquadFilter(); lp.type='lowpass'; lp.frequency.value=680; lp.connect(master);
    [55,82.4,110,164.8].forEach((fq,i)=>{
      const o=ctx.createOscillator(); o.type=i%2?'sine':'triangle'; o.frequency.value=fq;
      const g=ctx.createGain(); g.gain.value=.12/(i+1); o.connect(g); g.connect(lp); o.start();
      const l=ctx.createOscillator(); l.frequency.value=.05+i*.03; const lg=ctx.createGain(); lg.gain.value=.05;
      l.connect(lg); lg.connect(g.gain); l.start();
    });
    master.gain.linearRampToValueAtTime(.5,ctx.currentTime+1.5);
    ctx._master=master;
    // whoosh-буфер
    const len=ctx.sampleRate*.5, buf=ctx.createBuffer(1,len,ctx.sampleRate), d=buf.getChannelData(0);
    for(let i=0;i<len;i++)d[i]=(Math.random()*2-1)*(1-i/len);
    whoosh=()=>{ if(!on||RM)return;
      const src=ctx.createBufferSource(); src.buffer=buf;
      const bp=ctx.createBiquadFilter(); bp.type='bandpass'; bp.Q.value=1.1;
      bp.frequency.setValueAtTime(700,ctx.currentTime);
      bp.frequency.exponentialRampToValueAtTime(160,ctx.currentTime+.45);
      const g=ctx.createGain(); g.gain.setValueAtTime(.4,ctx.currentTime);
      g.gain.exponentialRampToValueAtTime(.001,ctx.currentTime+.5);
      src.connect(bp); bp.connect(g); g.connect(ctx.destination); src.start();
    };
  }
  btn.addEventListener('click',()=>{
    on=!on; btn.classList.toggle('on',on);
    if(on){ if(!ctx)boot(); else ctx.resume(); } else ctx&&ctx.suspend();
    btn.querySelector('.slabel').textContent=on?'звук вкл':'звук выкл';
  });
}

/* ═════════════════════════════════════════════════════════════════════
   КУРСОР + СКРОЛЛ + ОБЩИЙ UI
   ═════════════════════════════════════════════════════════════════════ */
function initCursor(){
  if(RM||matchMedia('(hover:none)').matches) return;
  const cur=document.getElementById('cursor');
  const pos={x:innerWidth/2,y:innerHeight/2}, tgt={...pos};
  let seen=false;
  addEventListener('pointermove',e=>{tgt.x=e.clientX;tgt.y=e.clientY;
    if(!seen){seen=true;cur.classList.add('on');}});
  gsap.ticker.add(()=>{pos.x+=(tgt.x-pos.x)*.2;pos.y+=(tgt.y-pos.y)*.2;
    cur.style.left=pos.x+'px';cur.style.top=pos.y+'px';});
  document.querySelectorAll('[data-cursor],a,button').forEach(el=>{
    el.addEventListener('pointerenter',()=>cur.classList.add('hot'));
    el.addEventListener('pointerleave',()=>cur.classList.remove('hot'));
  });
}

function initScroll(){
  const lenis=new Lenis({lerp:RM?1:.09,wheelMultiplier:1.05});
  window.__lenis=lenis;
  lenis.on('scroll',ScrollTrigger.update);
  gsap.ticker.add(t=>lenis.raf(t*1000)); gsap.ticker.lagSmoothing(0);

  document.querySelectorAll('[data-scroll],.nav-links a,.foot-col a[href^="#"],.brand[href^="#"]').forEach(el=>{
    const target=el.getAttribute('data-scroll')||el.getAttribute('href');
    if(!target||!target.startsWith('#')||target==='#')return;
    el.addEventListener('click',e=>{e.preventDefault();const n=document.querySelector(target);
      if(n)lenis.scrollTo(n,{offset:-70,duration:1.4});});
  });

  const nav=document.getElementById('nav');
  const showEl=document.getElementById('show');
  const navCheck=()=>nav.classList.toggle('solid', scrollY > showEl.offsetTop - 90);
  lenis.on('scroll',navCheck); addEventListener('resize',navCheck); navCheck();

  gsap.utils.toArray('.rv').forEach(el=>{
    gsap.to(el,{opacity:1,y:0,duration:1,ease:'power3.out',scrollTrigger:{trigger:el,start:'top 88%'}});
  });
  gsap.utils.toArray('[data-count]').forEach(el=>{
    const end=+el.dataset.count;
    ScrollTrigger.create({trigger:el,start:'top 90%',once:true,onEnter:()=>{
      gsap.to({v:0},{v:end,duration:1.6,ease:'power2.out',onUpdate(){el.textContent=Math.round(this.targets()[0].v);}});
    }});
  });
}

function preloader(){
  const pre=document.getElementById('pre');
  gsap.delayedCall(1.15,()=>pre.classList.add('done'));
}

try{ initJourney(); }catch(e){ console.warn('journey failed:',e); }
try{ initShowcase(); }catch(e){ console.warn('showcase failed:',e); }
initScroll(); initAudio(); initCursor(); preloader();
