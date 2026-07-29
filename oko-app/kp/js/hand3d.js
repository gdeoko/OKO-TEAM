import * as THREE from 'three';
/* Роботизированная кисть — настоящая 3D-геометрия (без видео и спрайтов).
   X: запястье → кончики пальцев, Y: вверх, Z: поперёк ладони. */
export function buildHand3D(){
  const HAND=new THREE.Group();

  const SKIN=new THREE.MeshStandardMaterial({
    color:new THREE.Color(0xC2FF4A), emissive:new THREE.Color(0x6FC400), emissiveIntensity:.72,
    metalness:.55, roughness:.22});
  const JOINT=new THREE.MeshStandardMaterial({
    color:new THREE.Color(0x27470A), emissive:new THREE.Color(0x152A00), emissiveIntensity:.55,
    metalness:.85, roughness:.3});
  const PLATE=new THREE.MeshStandardMaterial({
    color:new THREE.Color(0xEAFFB0), emissive:new THREE.Color(0x86D400), emissiveIntensity:.7,
    metalness:.5, roughness:.18});

  const cap=(len,r,mat)=>{const m=new THREE.Mesh(new THREE.CapsuleGeometry(r,len,8,20),mat||SKIN);
    m.rotation.z=-Math.PI/2; m.position.x=len/2; return m;};
  const ball=(r,mat)=>new THREE.Mesh(new THREE.SphereGeometry(r,18,14),mat||JOINT);

  // ---- ЛАДОНЬ ----
  const palm=new THREE.Mesh(new THREE.SphereGeometry(1,32,24),SKIN);
  palm.scale.set(.45,.125,.30); palm.position.set(.04,0,0); HAND.add(palm);

  // тех-детали ладони: шов по контуру + светящееся ядро
  const seam=new THREE.Mesh(new THREE.TorusGeometry(.30,.016,10,44),JOINT);
  seam.rotation.x=Math.PI/2; seam.scale.set(1.48,1,1); seam.position.set(.04,.005,0); HAND.add(seam);
  const CORE=new THREE.MeshStandardMaterial({color:new THREE.Color(0xF2FFDA),emissive:new THREE.Color(0xB6FF3A),emissiveIntensity:3.4,metalness:.2,roughness:.3});
  const core=new THREE.Mesh(new THREE.CylinderGeometry(.082,.082,.03,28),CORE);
  core.position.set(.04,.120,0); HAND.add(core);
  const coreRing=new THREE.Mesh(new THREE.TorusGeometry(.105,.018,10,30),PLATE);
  coreRing.rotation.x=Math.PI/2; coreRing.position.set(.04,.123,0); HAND.add(coreRing);
  // РАССЕЯННЫЙ свет как от лампочки, ровно по ЦЕНТРУ ладони + мягкая дымка (радиальные спрайты — всегда к камере, круглые и мягкие)
  function radialTex(inner){var cv=document.createElement('canvas');cv.width=cv.height=128;var g=cv.getContext('2d');
    var rg=g.createRadialGradient(64,64,0,64,64,64);
    rg.addColorStop(0,'rgba(226,255,150,'+inner+')');rg.addColorStop(.32,'rgba(154,255,0,'+(inner*0.55).toFixed(2)+')');rg.addColorStop(1,'rgba(154,255,0,0)');
    g.fillStyle=rg;g.fillRect(0,0,128,128);return new THREE.CanvasTexture(cv);}
  function glowSprite(size,op,tex){var sp=new THREE.Sprite(new THREE.SpriteMaterial({map:tex,transparent:true,opacity:op,blending:THREE.AdditiveBlending,depthWrite:false}));sp.scale.set(size,size,1);return sp;}
  var CG=glowSprite(.62,.5,radialTex(1.0)); CG.position.set(.04,.15,.06); HAND.add(CG);          // лампочка
  var CG2=glowSprite(1.35,.14,radialTex(0.6)); CG2.position.set(.04,.24,.05); HAND.add(CG2);       // дымка/туман
  HAND.userData.coreGlow=CG; HAND.userData.fog=CG2;
  // костяшки-гребень
  const ridge=new THREE.Mesh(new THREE.CapsuleGeometry(.075,.40,8,18),JOINT);
  ridge.rotation.x=Math.PI/2; ridge.position.set(.44,.02,0); HAND.add(ridge);
  // запястье
  const wrist=new THREE.Mesh(new THREE.CylinderGeometry(.135,.16,.30,26),SKIN);
  wrist.rotation.z=Math.PI/2; wrist.position.set(-.54,-.01,0); HAND.add(wrist);
  [-0.42,-0.54,-0.66].forEach(function(x,i){
    const rr=new THREE.Mesh(new THREE.TorusGeometry(.148-i*.006,.022,10,26),i===1?PLATE:JOINT);
    rr.rotation.y=Math.PI/2; rr.position.set(x,-.01,0); HAND.add(rr);});
  const cuff=new THREE.Mesh(new THREE.CylinderGeometry(.168,.168,.075,26),JOINT);
  cuff.rotation.z=Math.PI/2; cuff.position.set(-.36,-.005,0); HAND.add(cuff);

  // ---- ПАЛЬЦЫ ----
  const fingers=[];
  function finger(lens,rads,pos,fanZ,fanY){
    const root=new THREE.Group(); root.position.set(pos[0],pos[1],pos[2]);
    const chain=[]; let parent=root;
    for(let i=0;i<3;i++){
      const g=new THREE.Group();
      if(i>0) g.position.x=lens[i-1]+rads[i-1]*0.10;
      g.add(cap(lens[i],rads[i]));
      g.add(ball(rads[i]*1.18));
      const band=new THREE.Mesh(new THREE.TorusGeometry(rads[i]*1.03,rads[i]*.20,8,18),PLATE);
      band.rotation.y=Math.PI/2; band.position.x=lens[i]*0.62; g.add(band);
      parent.add(g); parent=g; chain.push(g);
    }
    const tip=ball(rads[2]*1.0,PLATE); tip.position.x=lens[2]; parent.add(tip);
    root.userData={chain,fanZ:fanZ,fanY:fanY};
    HAND.add(root); fingers.push(root); return root;
  }
  const R=[.062,.054,.046];
  finger([.30,.235,.175],R,[.46,.055,-.185],  .44, -.10);   // указательный
  finger([.325,.255,.185],R,[.47,.065,-.062], .20, -.03);   // средний
  finger([.305,.240,.178],R,[.47,.055,.062], -.02,  .03);   // безымянный
  finger([.245,.190,.150],[.056,.049,.042],[.44,.035,.185],-.24,.10); // мизинец
  // большой палец
  const thumb=finger([.235,.185,.140],[.072,.063,.053],[-.02,-.06,-.235],-.30,0);
  // большой палец ВСЕГДА сбоку у основания ладони — задаём стабильную базовую ориентацию (без переброса)
  thumb.rotation.set(0,-0.60,-0.55);
  thumb.userData.isThumb=true;

  HAND.userData={fingers,thumb,SKIN,JOINT,PLATE,coreGlow:CG,fog:CG2};
  return HAND;
}
/* open: 0 — кулак, 1 — раскрытая ладонь */
export function poseHand(hand,open,t){
  const e=Math.max(0,Math.min(1,open));
  const s=e*e*(3-2*e);
  // 🫴 РАСКРЫТАЯ ЛАДОНЬ ВВЕРХ: пальцы мягко подогнуты вверх, естественный каскад раскрытия
  const FIST=[1.30,1.46,1.16], OPEN=[0.16,0.22,0.28];
  hand.userData.fingers.forEach((f,idx)=>{
    if(f.userData.isThumb){
      // большой палец: только слегка отгибается, НЕ перебрасывается на другую сторону
      var ts=s;
      f.userData.chain.forEach((g,i)=>{ g.rotation.z=(0.95-i*0.06)-(0.45)*ts; });
      f.rotation.set(0,-0.60-0.18*ts,-0.55+0.10*ts);
      return;
    }
    const ph=idx*0.6;
    const stagger=Math.max(0,Math.min(1,(s-idx*0.05)/0.9));   // пальцы раскрываются каскадом
    const ss=stagger*stagger*(3-2*stagger);
    const wob=Math.sin(t*1.05+ph)*0.016*ss;                   // живое микродвижение
    f.userData.chain.forEach((g,i)=>{
      g.rotation.z=FIST[i]+(OPEN[i]-FIST[i])*ss+wob*(i===0?1:.5);
    });
    f.rotation.z=f.userData.fanZ*ss*0.62;                     // умеренный веер
    f.rotation.y=f.userData.fanY*ss*0.6;
  });
  // рассеянное свечение/туман ярче по мере раскрытия
  if(hand.userData.coreGlow){var g=hand.userData.coreGlow;g.material.opacity=0.08+0.20*s+Math.sin(t*2.0)*0.02*s;}
  if(hand.userData.fog){hand.userData.fog.material.opacity=0.02+0.09*s;}
}
