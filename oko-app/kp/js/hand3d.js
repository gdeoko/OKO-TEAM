import * as THREE from 'three';
/* Роботизированная кисть — настоящая 3D-геометрия (без видео и спрайтов).
   X: запястье → кончики пальцев, Y: вверх, Z: поперёк ладони. */
export function buildHand3D(){
  const HAND=new THREE.Group();

  const SKIN=new THREE.MeshStandardMaterial({
    color:new THREE.Color(0xA6FF1F), emissive:new THREE.Color(0x3C7A00), emissiveIntensity:.42,
    metalness:.62, roughness:.26});
  const JOINT=new THREE.MeshStandardMaterial({
    color:new THREE.Color(0x1E3606), emissive:new THREE.Color(0x0B1600), emissiveIntensity:.5,
    metalness:.85, roughness:.3});
  const PLATE=new THREE.MeshStandardMaterial({
    color:new THREE.Color(0xD8FF8A), emissive:new THREE.Color(0x5FA800), emissiveIntensity:.5,
    metalness:.5, roughness:.2});

  const cap=(len,r,mat)=>{const m=new THREE.Mesh(new THREE.CapsuleGeometry(r,len,8,20),mat||SKIN);
    m.rotation.z=-Math.PI/2; m.position.x=len/2; return m;};
  const ball=(r,mat)=>new THREE.Mesh(new THREE.SphereGeometry(r,18,14),mat||JOINT);

  // ---- ЛАДОНЬ ----
  const palm=new THREE.Mesh(new THREE.SphereGeometry(1,32,24),SKIN);
  palm.scale.set(.45,.125,.30); palm.position.set(.04,0,0); HAND.add(palm);

  // тех-детали ладони: шов по контуру + светящееся ядро
  const seam=new THREE.Mesh(new THREE.TorusGeometry(.30,.016,10,44),JOINT);
  seam.rotation.x=Math.PI/2; seam.scale.set(1.48,1,1); seam.position.set(.04,.005,0); HAND.add(seam);
  const CORE=new THREE.MeshStandardMaterial({color:new THREE.Color(0xE9FFC2),emissive:new THREE.Color(0x9AFF00),emissiveIntensity:2.2,metalness:.2,roughness:.35});
  const core=new THREE.Mesh(new THREE.CylinderGeometry(.075,.075,.028,26),CORE);
  core.position.set(.04,.118,0); HAND.add(core);
  const coreRing=new THREE.Mesh(new THREE.TorusGeometry(.098,.017,10,28),JOINT);
  coreRing.rotation.x=Math.PI/2; coreRing.position.set(.04,.121,0); HAND.add(coreRing);
  const CG=new THREE.Mesh(new THREE.SphereGeometry(.19,18,14),new THREE.MeshBasicMaterial({color:0x9AFF00,transparent:true,opacity:.14,blending:THREE.AdditiveBlending,depthWrite:false}));
  CG.scale.set(1,.5,1); CG.position.set(.04,.13,0); HAND.add(CG);
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
  const thumb=finger([.245,.195,.145],[.070,.061,.051],[.05,-.045,-.245],-.62,-1.05);
  HAND.userData.thumbIdx=4;

  HAND.userData={fingers,thumb,SKIN,JOINT,PLATE};
  return HAND;
}
/* open: 0 — кулак, 1 — раскрытая ладонь */
export function poseHand(hand,open,t){
  const e=Math.max(0,Math.min(1,open));
  const s=e*e*(3-2*e);
  const FIST=[1.32,1.48,1.15], OPEN=[-0.16,-0.10,-0.05];
  hand.userData.fingers.forEach((f,idx)=>{
    const ph=idx*0.55;
    const wob=Math.sin(t*1.1+ph)*0.02*s;          // живое микродвижение
    f.userData.chain.forEach((g,i)=>{
      g.rotation.z=FIST[i]+(OPEN[i]-FIST[i])*s+wob*(i===0?1:.5);
    });
    f.rotation.z=f.userData.fanZ*s;
    f.rotation.y=f.userData.fanY*s;
  });
}
