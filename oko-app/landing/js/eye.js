/* ОКО — живой глаз на raw WebGL (fullscreen fragment shader) */
(function(){
  const canvas = document.getElementById('eye');
  const gl = canvas.getContext('webgl', {antialias:false, alpha:true, premultipliedAlpha:false});
  if(!gl){ canvas.style.display='none'; window.__eyeReady=true; return; }

  const VERT = `attribute vec2 p; void main(){ gl_Position=vec4(p,0.,1.); }`;

  const FRAG = `
  precision highp float;
  uniform vec2  uRes;
  uniform float uTime;
  uniform vec2  uMouse;   // -1..1 look direction
  uniform float uOpen;    // 0..1 eyelid open
  uniform float uZoom;    // 0..1 dive into pupil
  uniform float uScale;   // >1 shrinks eye (mobile)
  uniform float uDpr;

  // hash / noise
  float hash(vec2 p){ p=fract(p*vec2(123.34,456.21)); p+=dot(p,p+45.32); return fract(p.x*p.y); }
  float noise(vec2 p){
    vec2 i=floor(p), f=fract(p);
    float a=hash(i), b=hash(i+vec2(1,0)), c=hash(i+vec2(0,1)), d=hash(i+vec2(1,1));
    vec2 u=f*f*(3.-2.*f);
    return mix(a,b,u.x)+(c-a)*u.y*(1.-u.x)+(d-b)*u.x*u.y;
  }
  float fbm(vec2 p){
    float v=0., a=.5;
    for(int i=0;i<5;i++){ v+=a*noise(p); p*=2.02; a*=.5; }
    return v;
  }

  void main(){
    vec2 uv=(gl_FragCoord.xy - .5*uRes)/uRes.y;   // aspect-correct, center 0
    float dive = smoothstep(0.0,1.0,uZoom);

    // camera dive into pupil: scale space up as we zoom
    float sc = mix(uScale, 0.06, dive);
    vec2 look = uMouse*0.045*(1.0-dive);
    vec2 p = (uv)*sc - look;

    float r = length(p);
    float ang = atan(p.y,p.x);

    // ---- iris ----
    float irisR = 0.42;
    float pupilR = 0.15;

    // organic fibers: angular ridges warped by fbm
    float warp = fbm(vec2(ang*3.0, r*6.0) + uTime*0.05);
    float fibers = sin(ang*70.0 + warp*7.0 + r*10.0);
    fibers = 0.5+0.5*fibers;
    float grain = fbm(p*7.0 + uTime*0.03);

    // radial gradient of iris brightness
    float irisMask = smoothstep(irisR, irisR-0.02, r) * smoothstep(pupilR-0.01, pupilR+0.03, r);
    float toPupil = smoothstep(pupilR, irisR, r);      // 0 near pupil -> 1 outer

    vec3 limeDark = vec3(0.10,0.20,0.0);
    vec3 lime     = vec3(0.60,1.0,0.0);
    vec3 limeHot  = vec3(0.80,1.0,0.35);
    vec3 iris = mix(limeDark, lime, toPupil);
    iris = mix(iris, limeHot, fibers*toPupil*0.55);
    iris *= (0.55 + 0.7*grain);
    // inner glow ring around pupil
    iris += lime * smoothstep(pupilR+0.10, pupilR, r) * 0.6;

    // limbal ring (dark outer edge of iris)
    float limbal = smoothstep(irisR, irisR-0.05, r) - smoothstep(irisR-0.05, irisR-0.11, r);
    iris *= (1.0 - limbal*0.75);
    // bright outer rim
    iris += limeHot * (smoothstep(irisR-0.015,irisR,r)-smoothstep(irisR,irisR+0.02,r)) * 1.4;

    vec3 col = iris * irisMask;

    // pupil (deep, with faint inner life)
    float pupil = smoothstep(pupilR, pupilR-0.02, r);
    float pupCore = fbm(p*9.0 - uTime*0.06);
    col = mix(col, vec3(0.01,0.02,0.0)+lime*pupCore*0.06, pupil);

    // specular catchlight (offset by mouse)
    vec2 sp = p - vec2(-0.12,0.14) - uMouse*0.03;
    float spec = smoothstep(0.06,0.0,length(sp));
    col += vec3(0.85,1.0,0.6)*spec*0.9*(1.0-dive*0.6);

    // sclera / outer glow bloom around the eye on black
    float glow = smoothstep(irisR+0.5, irisR, r);
    col += vec3(0.18,0.42,0.0) * pow(glow,2.0) * 0.5 * (1.0-dive);

    // radiating light rays
    float rays = 0.5+0.5*sin(ang*14.0 + uTime*0.2);
    col += lime * rays * smoothstep(irisR+0.35,irisR,r)*smoothstep(irisR,irisR+0.02,r)*0.0;
    col += lime * pow(max(0.0,rays),3.0) * smoothstep(0.9,irisR,r) * 0.04 * (1.0-dive);

    // floating soft dust motes (outside iris, on black)
    float outside = smoothstep(irisR+0.02, irisR+0.12, r);
    vec2 cell = p*6.0;
    vec2 id = floor(cell), fp = fract(cell)-0.5;
    float rnd = hash(id);
    vec2 off = (vec2(hash(id+1.3), hash(id+7.1))-0.5)*0.7;
    off += 0.12*vec2(sin(uTime*0.6+rnd*30.0), cos(uTime*0.5+rnd*20.0));
    float mote = smoothstep(0.16, 0.0, length(fp-off)) * step(0.86, rnd);
    col += lime * mote * 0.5 * outside * (1.0-dive);

    // eyelid open (vertical): closes top & bottom when uOpen<1
    float lid = (1.0-uOpen);
    float lidMask = smoothstep(0.0,0.06, (0.85 - lid*0.9) - abs(uv.y*mix(1.0,3.0,dive)) );
    // during dive, lid fully open
    lidMask = mix(lidMask, 1.0, dive);
    col *= lidMask;

    // fade to black at full dive (handoff to next section)
    col *= (1.0 - smoothstep(0.75,1.0,dive));

    float alpha = clamp(max(max(col.r,col.g),col.b)*1.6 + irisMask*0.5, 0.0, 1.0);
    alpha *= lidMask;
    gl_FragColor = vec4(col, alpha);
  }`;

  function sh(type,src){ const s=gl.createShader(type); gl.shaderSource(s,src); gl.compileShader(s);
    if(!gl.getShaderParameter(s,gl.COMPILE_STATUS)){ console.error(gl.getShaderInfoLog(s)); } return s; }
  const prog=gl.createProgram();
  gl.attachShader(prog, sh(gl.VERTEX_SHADER,VERT));
  gl.attachShader(prog, sh(gl.FRAGMENT_SHADER,FRAG));
  gl.linkProgram(prog); gl.useProgram(prog);

  const buf=gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER,buf);
  gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([-1,-1, 3,-1, -1,3]),gl.STATIC_DRAW);
  const loc=gl.getAttribLocation(prog,'p'); gl.enableVertexAttribArray(loc);
  gl.vertexAttribPointer(loc,2,gl.FLOAT,false,0,0);
  gl.enable(gl.BLEND); gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

  const U={ res:gl.getUniformLocation(prog,'uRes'), time:gl.getUniformLocation(prog,'uTime'),
    mouse:gl.getUniformLocation(prog,'uMouse'), open:gl.getUniformLocation(prog,'uOpen'),
    zoom:gl.getUniformLocation(prog,'uZoom'), scale:gl.getUniformLocation(prog,'uScale'), dpr:gl.getUniformLocation(prog,'uDpr') };
  function eyeScale(){ return window.innerWidth<=640 ? 1.55 : (window.innerWidth<=900 ? 1.15 : 1.0); }

  let DPR=Math.min(window.devicePixelRatio||1, 1.8);
  if(window.innerWidth<720) DPR=Math.min(DPR,1.5);
  function resize(){
    const w=canvas.clientWidth||window.innerWidth, h=canvas.clientHeight||window.innerHeight;
    canvas.width=Math.floor(w*DPR); canvas.height=Math.floor(h*DPR);
    gl.viewport(0,0,canvas.width,canvas.height);
  }
  new ResizeObserver(resize).observe(canvas); resize();

  const mouse={x:0,y:0,tx:0,ty:0};
  window.addEventListener('pointermove',e=>{ mouse.tx=(e.clientX/window.innerWidth)*2-1; mouse.ty=-((e.clientY/window.innerHeight)*2-1); });
  window.addEventListener('deviceorientation',e=>{ if(e.gamma!=null){ mouse.tx=Math.max(-1,Math.min(1,e.gamma/35)); mouse.ty=Math.max(-1,Math.min(1,(e.beta-45)/35)); } });

  // exposed state (driven by main.js scroll)
  window.OKOeye={ open:0, zoom:0 };
  const reduce = matchMedia('(prefers-reduced-motion:reduce)').matches;

  // open animation on start
  let t0=performance.now();
  function frame(now){
    const t=(now-t0)/1000;
    mouse.x += (mouse.tx-mouse.x)*0.06; mouse.y += (mouse.ty-mouse.y)*0.06;
    // auto-open first ~1.2s
    if(window.OKOeye.open<1) window.OKOeye.open=Math.min(1, t/1.2);
    gl.uniform2f(U.res, canvas.width, canvas.height);
    gl.uniform1f(U.time, reduce?0.0:t);
    gl.uniform2f(U.mouse, mouse.x, mouse.y);
    gl.uniform1f(U.open, window.OKOeye.open);
    gl.uniform1f(U.zoom, window.OKOeye.zoom);
    gl.uniform1f(U.scale, eyeScale());
    gl.uniform1f(U.dpr, DPR);
    gl.drawArrays(gl.TRIANGLES,0,3);
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
  window.__eyeReady=true;
})();
