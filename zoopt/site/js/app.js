import * as THREE from 'three';
const gsap = window.gsap;
const ScrollTrigger = window.ScrollTrigger;
const Lenis = window.Lenis;

gsap.registerPlugin(ScrollTrigger);

/* ---------- brand colors ---------- */
const C = { green:0x1B8A3A, greenLite:0x4fd97a, yellow:0xFFD500, warm:0xFFE45C, white:0xffffff };

/* =====================================================================
   WEBGL HERO — сияющая жёлтая луна + галактика частиц (в стиле лого)
   ===================================================================== */
function radialTexture(stops){
  const s=256, cv=document.createElement('canvas'); cv.width=cv.height=s;
  const ctx=cv.getContext('2d'); const g=ctx.createRadialGradient(s/2,s/2,0,s/2,s/2,s/2);
  stops.forEach(([o,c])=>g.addColorStop(o,c)); ctx.fillStyle=g; ctx.fillRect(0,0,s,s);
  const t=new THREE.CanvasTexture(cv); t.needsUpdate=true; return t;
}

function initHero(){
  const canvas=document.getElementById('gl');
  const renderer=new THREE.WebGLRenderer({canvas,alpha:true,antialias:true});
  renderer.setPixelRatio(Math.min(devicePixelRatio,2));
  const scene=new THREE.Scene();
  const cam=new THREE.PerspectiveCamera(55,1,.1,100); cam.position.set(0,0,15);
  const world=new THREE.Group(); scene.add(world);

  /* --- glow halo behind moon --- */
  const glowTex=radialTexture([[0,'rgba(255,228,92,.95)'],[.25,'rgba(255,213,0,.55)'],[.55,'rgba(255,190,0,.16)'],[1,'rgba(255,190,0,0)']]);
  const glow=new THREE.Sprite(new THREE.SpriteMaterial({map:glowTex,blending:THREE.AdditiveBlending,depthWrite:false,transparent:true}));
  glow.scale.set(20,20,1); glow.position.set(0,.4,-2); world.add(glow);

  /* --- moon core (flat disc, on-brand) --- */
  const moonTex=radialTexture([[0,'#FFF0A8'],[.35,'#FFE45C'],[.72,'#FFD500'],[.93,'#F4C400'],[1,'rgba(244,196,0,0)']]);
  const moon=new THREE.Sprite(new THREE.SpriteMaterial({map:moonTex,depthWrite:false,transparent:true}));
  moon.scale.set(7.4,7.4,1); moon.position.set(0,.4,0); world.add(moon);

  /* --- particle galaxy --- */
  const N=6500, pos=new Float32Array(N*3), col=new Float32Array(N*3), siz=new Float32Array(N);
  const rnd=(a,b)=>a+Math.random()*(b-a);
  const cGreen=new THREE.Color(C.green), cLite=new THREE.Color(C.greenLite), cY=new THREE.Color(C.warm), cW=new THREE.Color(C.white);
  for(let i=0;i<N;i++){
    const arm=Math.floor(Math.random()*3), t=Math.pow(Math.random(),.6);
    const rad=1.6+t*13, ang=arm*(Math.PI*2/3)+t*4.2+rnd(-.35,.35);
    const x=Math.cos(ang)*rad + rnd(-.6,.6);
    const y=Math.sin(ang)*rad*.42 + rnd(-.6,.6) + Math.sin(t*6)*.3;
    const z=rnd(-2.2,2.2) - t*1.2;
    pos[i*3]=x; pos[i*3+1]=y; pos[i*3+2]=z;
    let c; const r=Math.random();
    if(r<.5) c=cGreen.clone().lerp(cLite,Math.random());
    else if(r<.8) c=cLite.clone().lerp(cW,Math.random()*.5);
    else c=cY.clone().lerp(cW,Math.random()*.4);
    // near the moon → warmer
    if(rad<4) c.lerp(cY,(4-rad)/4*.6);
    col[i*3]=c.r; col[i*3+1]=c.g; col[i*3+2]=c.b;
    siz[i]=rnd(.05,.28)*(rad<4?1.5:1);
  }
  const geo=new THREE.BufferGeometry();
  geo.setAttribute('position',new THREE.BufferAttribute(pos,3));
  geo.setAttribute('color',new THREE.BufferAttribute(col,3));
  geo.setAttribute('aSize',new THREE.BufferAttribute(siz,1));
  const dotTex=radialTexture([[0,'rgba(255,255,255,1)'],[.4,'rgba(255,255,255,.7)'],[1,'rgba(255,255,255,0)']]);
  const mat=new THREE.ShaderMaterial({
    uniforms:{uTex:{value:dotTex},uT:{value:0}},
    transparent:true,depthWrite:false,blending:THREE.AdditiveBlending,vertexColors:true,
    vertexShader:`attribute float aSize;varying vec3 vC;uniform float uT;
      void main(){vC=color;vec3 p=position;
        float a=uT*.06; float s=sin(a),c=cos(a); p.xy=mat2(c,-s,s,c)*p.xy;
        vec4 mv=modelViewMatrix*vec4(p,1.);
        gl_PointSize=aSize*(300./-mv.z);gl_Position=projectionMatrix*mv;}`,
    fragmentShader:`uniform sampler2D uTex;varying vec3 vC;
      void main(){float a=texture2D(uTex,gl_PointCoord).a;if(a<.02)discard;gl_FragColor=vec4(vC,a);}`
  });
  const pts=new THREE.Points(geo,mat); world.add(pts);

  /* --- dust: far tiny stars --- */
  const M=1200, dp=new Float32Array(M*3);
  for(let i=0;i<M;i++){dp[i*3]=rnd(-26,26);dp[i*3+1]=rnd(-16,16);dp[i*3+2]=rnd(-14,-4);}
  const dg=new THREE.BufferGeometry(); dg.setAttribute('position',new THREE.BufferAttribute(dp,3));
  const dust=new THREE.Points(dg,new THREE.PointsMaterial({size:.06,color:0xbfe9c9,transparent:true,opacity:.5,depthWrite:false,blending:THREE.AdditiveBlending}));
  scene.add(dust);

  /* --- resize --- */
  function resize(){const w=innerWidth,h=document.getElementById('hero').clientHeight;
    renderer.setSize(w,h,false); cam.aspect=w/h; cam.updateProjectionMatrix();}
  resize(); addEventListener('resize',resize);

  /* --- mouse parallax --- */
  const m={x:0,y:0}, mt={x:0,y:0};
  addEventListener('pointermove',e=>{m.x=(e.clientX/innerWidth-.5);m.y=(e.clientY/innerHeight-.5);});

  /* --- scroll drives camera dolly on hero --- */
  const heroScroll={v:0};
  ScrollTrigger.create({trigger:'#hero',start:'top top',end:'bottom top',scrub:true,
    onUpdate:s=>heroScroll.v=s.progress});

  const clock=new THREE.Clock();
  function loop(){
    const t=clock.getElapsedTime();
    mt.x+=(m.x-mt.x)*.05; mt.y+=(m.y-mt.y)*.05;
    mat.uniforms.uT.value=t;
    world.rotation.y=mt.x*.5; world.rotation.x=mt.y*.35;
    world.rotation.z=t*0.012;
    dust.rotation.y=t*0.02;
    const p=heroScroll.v;
    cam.position.z=15+p*10; cam.position.y=p*3;
    world.position.y=p*2; glow.material.opacity=1-p*.8; moon.material.opacity=1-p*.5;
    renderer.render(scene,cam);
    requestAnimationFrame(loop);
  }
  loop();
  return renderer;
}

/* =====================================================================
   SMOOTH SCROLL + REVEALS + UI
   ===================================================================== */
function initScroll(){
  const lenis=new Lenis({lerp:.09,wheelMultiplier:1.05});
  window.__lenis=lenis;
  lenis.on('scroll',ScrollTrigger.update);
  gsap.ticker.add(t=>lenis.raf(t*1000)); gsap.ticker.lagSmoothing(0);

  // anchor buttons / links
  document.querySelectorAll('[data-scroll],.nav-links a,.foot-col a[href^="#"],.brand[href^="#"]').forEach(el=>{
    const target=el.getAttribute('data-scroll')||el.getAttribute('href');
    if(!target||!target.startsWith('#')||target==='#')return;
    el.addEventListener('click',e=>{e.preventDefault();const n=document.querySelector(target);if(n)lenis.scrollTo(n,{offset:-70,duration:1.3});});
  });

  // nav solid
  const nav=document.getElementById('nav');
  ScrollTrigger.create({start:'top -80',onUpdate:s=>nav.classList.toggle('solid',s.scroll()>80)});

  // hero intro
  gsap.timeline({delay:.15}).to('#hero .rv',{opacity:1,y:0,duration:1.1,stagger:.12,ease:'power3.out'});

  // generic reveals
  gsap.utils.toArray('.rv').forEach(el=>{
    if(el.closest('#hero'))return;
    gsap.to(el,{opacity:1,y:0,duration:1,ease:'power3.out',
      scrollTrigger:{trigger:el,start:'top 85%'}});
  });

  // parallax category animals & character images
  gsap.utils.toArray('.cat .an').forEach(el=>gsap.to(el,{yPercent:-14,ease:'none',scrollTrigger:{trigger:el.closest('.cat'),start:'top bottom',end:'bottom top',scrub:true}}));
  gsap.utils.toArray('.char .cimg').forEach(el=>gsap.to(el,{yPercent:-12,ease:'none',scrollTrigger:{trigger:el.closest('.char'),start:'top bottom',end:'bottom top',scrub:true}}));

  // counters
  gsap.utils.toArray('[data-count]').forEach(el=>{
    const end=+el.dataset.count;
    ScrollTrigger.create({trigger:el,start:'top 90%',once:true,onEnter:()=>{
      gsap.to({v:0},{v:end,duration:1.6,ease:'power2.out',onUpdate(){el.textContent=Math.round(this.targets()[0].v);}});
    }});
  });
}

/* ---------- preloader ---------- */
function preloader(done){
  const bar=document.querySelector('.pre-bar i'), pre=document.getElementById('pre');
  gsap.to(bar,{width:'100%',duration:1.1,ease:'power2.inOut',onComplete(){
    gsap.to(pre,{delay:.15,onStart:()=>pre.classList.add('done'),onComplete:done});
  }});
}

/* ---------- boot ---------- */
try{ initHero(); }catch(e){ console.warn('WebGL hero failed:',e); }
initScroll();
preloader(()=>{});
