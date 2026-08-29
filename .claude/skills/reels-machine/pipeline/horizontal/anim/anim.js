// deterministic time-driven animation lib. renderT(t) sets all styles for time t.
const S=document.getElementById('stage');
const TRACKS=[];
let DUR=(window.PARAMS&&window.PARAMS.dur)||4;
const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
const E={
  outCubic:x=>1-Math.pow(1-x,3),
  outQuint:x=>1-Math.pow(1-x,5),
  outExpo:x=>x>=1?1:1-Math.pow(2,-10*x),
  inOut:x=>x<.5?4*x*x*x:1-Math.pow(-2*x+2,3)/2,
  outBack:x=>{const c1=1.70158,c3=c1+1;return 1+c3*Math.pow(x-1,3)+c1*Math.pow(x-1,2);},
};
// track: fn(t) that mutates el. helper builds a normalized 0..1 progress
function tw(start,dur,ease,cb){ TRACKS.push(t=>{let p=clamp((t-start)/dur,0,1);cb(ease?ease(p):p,t);}); }
function el(tag,cls,css){const e=document.createElement(tag);if(cls)e.className=cls;if(css)Object.assign(e.style,css);return e;}
function px(n){return n+'px';}

// global container fade in/out
function autoFade(node,inD=0.35,outD=0.4){
  TRACKS.push(t=>{
    let a=1;
    if(t<inD)a=E.outCubic(clamp(t/inD,0,1));
    if(t>DUR-outD)a=1-E.outCubic(clamp((t-(DUR-outD))/outD,0,1));
    node.style.opacity=a;
  });
}

// ===== LIVING BACKGROUND SYSTEM — 6 distinct animated styles, chosen by seed so no two repeat =====
function seedRnd(s){ // deterministic pseudo-random from integer seed
  let x=Math.sin(s*127.1+311.7)*43758.5453; return x-Math.floor(x);
}
function bgCanvas(draw){ // canvas whose frame is (re)painted by renderT via TRACKS
  const cv=el('canvas',null,{position:'absolute',inset:0,width:'1920px',height:'1080px'});
  cv.width=1920; cv.height=1080; S.append(cv);
  const ctx=cv.getContext('2d');
  TRACKS.push(t=>{ctx.clearRect(0,0,1920,1080);draw(ctx,t);});
  return cv;
}
function bg(kind,accent){ // now delegates to a varied living background (backward-compatible: returns col)
  if(window.__NOBG) return accent==='red'?'#FF2D2D':'#9AFF00'; // over-video mode: skip fullscreen bg
  const col=accent==='red'?'#FF2D2D':'#9AFF00';
  const rgb=accent==='red'?[255,45,45]:[154,255,0];
  const seed=(window.PARAMS&&window.PARAMS.seed)||0;
  const variant=(window.PARAMS&&window.PARAMS.bgv!=null)?window.PARAMS.bgv:(seed%6);
  const base=el('div',null,{position:'absolute',inset:0,background:'radial-gradient(120% 100% at 50% 0%,#0d1410,#060806 70%)',overflow:'hidden'});
  S.append(base); autoFade(base,0.3,0.4);
  base.style.transformOrigin='50% 45%';
  TRACKS.push(t=>{const p=clamp(t/DUR,0,1);base.style.transform=`scale(${1.0+0.14*p})`;}); // parallax: bg pushes faster than foreground
  const rc=(a)=>`rgba(${rgb[0]},${rgb[1]},${rgb[2]},${a})`;
  if(variant===0){ // AURORA drift + soft grid
    const a1=el('div',null,{position:'absolute',width:'1500px',height:'1500px',left:'10%',top:'-35%',borderRadius:'50%',background:`radial-gradient(circle,${rc(.16)},transparent 60%)`,filter:'blur(50px)'});
    const a2=el('div',null,{position:'absolute',width:'1300px',height:'1300px',right:'2%',bottom:'-35%',borderRadius:'50%',background:`radial-gradient(circle,${rc(.13)},transparent 60%)`,filter:'blur(60px)'});
    base.append(a1,a2);
    TRACKS.push(t=>{a1.style.transform=`translate(${Math.sin(t*.5)*60}px,${Math.cos(t*.4)*40}px)`;a2.style.transform=`translate(${Math.cos(t*.45)*60}px,${Math.sin(t*.5)*40}px)`;});
  } else if(variant===1){ // PARTICLE FIELD rising
    const N=70,ps=Array.from({length:N},(_,i)=>({x:seedRnd(seed*7+i)*1920,y:seedRnd(seed*13+i)*1080,r:1+seedRnd(seed+i)*3,sp:20+seedRnd(seed*3+i)*40}));
    bgCanvas((ctx,t)=>{for(const p of ps){const y=(p.y-t*p.sp)%1080,yy=y<0?y+1080:y;ctx.beginPath();ctx.fillStyle=rc(0.12+0.25*seedRnd(p.x));ctx.arc(p.x,yy,p.r,0,6.28);ctx.fill();}});
  } else if(variant===2){ // WARPED GRID / perspective lines
    bgCanvas((ctx,t)=>{ctx.strokeStyle=rc(.10);ctx.lineWidth=2;const off=(t*40)%120;
      for(let x=-120;x<2040;x+=120){ctx.beginPath();ctx.moveTo(x+off,0);ctx.lineTo(x+off+Math.sin(t*.6)*40,1080);ctx.stroke();}
      for(let y=-120;y<1200;y+=120){const yy=y+off;ctx.beginPath();ctx.moveTo(0,yy);ctx.lineTo(1920,yy);ctx.globalAlpha=0.5;ctx.stroke();ctx.globalAlpha=1;}});
  } else if(variant===3){ // DIAGONAL LIGHT SWEEP + bokeh
    const N=22,ps=Array.from({length:N},(_,i)=>({x:seedRnd(seed*5+i)*1920,y:seedRnd(seed*9+i)*1080,r:20+seedRnd(seed+i*3)*90}));
    bgCanvas((ctx,t)=>{for(const p of ps){ctx.beginPath();const g=ctx.createRadialGradient(p.x,p.y,0,p.x,p.y,p.r);g.addColorStop(0,rc(.10));g.addColorStop(1,rc(0));ctx.fillStyle=g;ctx.arc(p.x+Math.sin(t*.3+p.y)*20,p.y+Math.cos(t*.3+p.x)*16,p.r,0,6.28);ctx.fill();}
      const sx=((t*300)%2600)-400;ctx.save();ctx.translate(sx,0);ctx.rotate(-0.35);const lg=ctx.createLinearGradient(0,0,260,0);lg.addColorStop(0,rc(0));lg.addColorStop(.5,rc(.06));lg.addColorStop(1,rc(0));ctx.fillStyle=lg;ctx.fillRect(0,-400,260,1900);ctx.restore();});
  } else if(variant===4){ // SINE WAVES
    bgCanvas((ctx,t)=>{for(let k=0;k<4;k++){ctx.beginPath();ctx.strokeStyle=rc(.08+k*.03);ctx.lineWidth=3;for(let x=0;x<=1920;x+=16){const y=540+Math.sin(x*.004+t*(1+k*.4)+k)*(80+k*40)+k*30;x===0?ctx.moveTo(x,y):ctx.lineTo(x,y);}ctx.stroke();}});
  } else { // CONCENTRIC PULSE rings
    bgCanvas((ctx,t)=>{const cx=960,cy=520;for(let k=0;k<7;k++){const r=((t*90+k*140)%1000);ctx.beginPath();ctx.strokeStyle=rc(0.16*(1-r/1000));ctx.lineWidth=2.5;ctx.arc(cx,cy,r,0,6.28);ctx.stroke();}});
  }
  // UNIVERSAL life layer on top of every variant: drifting sparks + moving light sweep
  const N2=38, sp=Array.from({length:N2},(_,i)=>({x:seedRnd(seed*11+i)*1920,y:seedRnd(seed*17+i)*1080,r:0.6+seedRnd(seed+i*2)*2.4,sp:14+seedRnd(seed*3+i)*46,ph:seedRnd(i)*6.28}));
  bgCanvas((ctx,t)=>{
    for(const p of sp){const y=(p.y-t*p.sp)%1080,yy=y<0?y+1080:y;const a=0.10+0.22*Math.abs(Math.sin(t*1.5+p.ph));ctx.beginPath();ctx.fillStyle=rc(a);ctx.arc(p.x+Math.sin(t*.6+p.ph)*14,yy,p.r,0,6.28);ctx.fill();}
    const sx=((t*260)%2800)-500;ctx.save();ctx.translate(sx,0);ctx.rotate(-0.3);const lg=ctx.createLinearGradient(0,0,340,0);lg.addColorStop(0,rc(0));lg.addColorStop(.5,rc(.05));lg.addColorStop(1,rc(0));ctx.fillStyle=lg;ctx.fillRect(0,-500,340,2100);ctx.restore();
  });
  // subtle vignette
  const vig=el('div',null,{position:'absolute',inset:0,background:'radial-gradient(120% 100% at 50% 45%,transparent 52%,rgba(0,0,0,.6))'});S.append(vig);
  // corner accents (thin, animated draw-in) — skip on some variants for variety
  if(variant%2===0){['tl','br'].forEach(k=>{const c=el('div',null,{position:'absolute',width:'70px',height:'70px',borderColor:col,[k==='tl'?'top':'bottom']:'56px',[k==='tl'?'left':'right']:'56px',borderStyle:'solid',borderWidth:k==='tl'?'4px 0 0 4px':'0 4px 4px 0',opacity:0});S.append(c);tw(0.2,0.5,E.outCubic,p=>c.style.opacity=p*0.9);});}
  return col;
}
// continuous "alive" motion for any node (float + breathe + slight rotate), never static
function alive(node,seed,amp){
  const a=amp||1, s=seed||1, fx=0.9+seedRnd(s)*0.6, fy=0.8+seedRnd(s*2)*0.6, fr=0.5+seedRnd(s*3)*0.5;
  const base=node.style.transform||'';
  TRACKS.push(t=>{const dx=Math.sin(t*fx+s)*6*a, dy=Math.cos(t*fy+s)*7*a, rot=Math.sin(t*fr+s)*0.6*a;
    node.style.transform=`${node.__base||''} translate(${dx}px,${dy}px) rotate(${rot}deg)`;});
}

function splitReveal(container,text,font,size,color,start,stagger){
  const wrap=el('div',null,{display:'flex',justifyContent:'center',flexWrap:'wrap',gap:'0'});
  [...text].forEach((ch,i)=>{
    const s=el('span',null,{fontFamily:font,fontSize:px(size),color,display:'inline-block',
      whiteSpace:'pre',lineHeight:1.02});
    s.textContent=ch;
    tw(start+i*stagger,0.5,E.outBack,(p)=>{s.style.opacity=p;s.style.transform=`translateY(${(1-p)*70}px)`;});
    wrap.append(s);
  });
  container.append(wrap); return wrap;
}

function countUp(node,to,start,dur,prefix='',suffix='',dec=0){
  tw(start,dur,E.outExpo,(p)=>{let v=to*p;node.textContent=prefix+(dec?v.toFixed(dec):Math.round(v))+suffix;});
}

function C(){return (window.PARAMS&&window.PARAMS.accent==='red')?'#FF2D2D':'#9AFF00';}

// ---------- COMPONENTS ----------
function comp_stat(P){
  const acc=P.accent==='red'?'red':'lime'; bg(P.kind==='statfull'?acc:'lime',acc);
  const box=el('div',null,{position:'absolute',left:0,right:0,top:'50%',transform:'translateY(-50%)',textAlign:'center'});
  S.append(box);
  const lines=(P.big||'').split('\n');
  // count-up ONLY for a single clean integer like "42", "+15", "2026" (no range dash)
  const pure=/^[+\-]?\d{1,4}%?$/.test((lines[0]||'').trim());
  lines.forEach((ln,li)=>{
    const gcol=acc==='red'?'rgba(255,45,45,':'rgba(154,255,0,';
    const h=el('div','osw',{fontSize:'210px',color:acc==='red'?'#FF2D2D':'#9AFF00',lineHeight:1.04,
      textShadow:`0 0 24px ${gcol}.55),0 0 60px ${gcol}.4),0 0 110px ${gcol}.25)`});
    if(li===0&&pure){
      const suffix=ln.includes('%')?'%':''; const val=parseInt(ln.replace(/[^\d]/g,''))||0;
      const pre=ln.trim().startsWith('+')?'+':'';
      tw(0.2,1.1,E.outExpo,(p)=>{h.textContent=pre+Math.round(val*p)+suffix;});
      tw(0,0.5,E.outBack,(p)=>{h.style.transform=`scale(${0.7+0.3*p})`;h.style.opacity=p;});
    } else { splitReveal(h,ln,'Oswald',160,acc==='red'?'#FF2D2D':'#9AFF00',0.15+li*0.22,0.035); }
    box.append(h);
  });
  const bar=el('div',null,{width:'0px',height:'10px',background:acc==='red'?'#FF2D2D':'#9AFF00',margin:'34px auto 0',borderRadius:'6px'});
  tw(0.5,0.6,E.outCubic,(p)=>{bar.style.width=px(320*p);}); box.append(bar);
  if(P.small){const sm=el('div','mont wht',{fontSize:'50px',marginTop:'30px',opacity:0});
    tw(0.7,0.6,E.outCubic,(p)=>{sm.style.opacity=p;sm.style.transform=`translateY(${(1-p)*20}px)`;});
    sm.textContent=P.small; box.append(sm);}
  // RISK ZONE climax: glitch bursts — RGB split, slice-shake (Gemini note)
  if(acc==='red'){
    TRACKS.push(t=>{
      const burst=(Math.sin(t*7.3)>0.72)||(Math.sin(t*11.1+1)>0.82)||(t<0.25);
      if(burst){const jx=Math.sin(t*143)*10, jy=Math.sin(t*97)*4;
        box.style.transform=`translateY(-50%) translate(${jx}px,${jy}px)`;
        box.style.filter='drop-shadow(4px 0 rgba(255,0,64,.8)) drop-shadow(-4px 0 rgba(0,225,255,.75))';
      } else {box.style.transform='translateY(-50%)';box.style.filter='none';}
    });
    // scanline flashes
    const scan=el('div',null,{position:'absolute',left:0,right:0,height:'3px',background:'rgba(255,45,45,.5)',mixBlendMode:'screen'});S.append(scan);
    TRACKS.push(t=>{scan.style.top=px(((t*900)%1080));scan.style.opacity=(Math.sin(t*9)>0.5)?0.6:0;});
  }
}

function comp_statcard(P){ // partial framed card (side)
  const acc=P.accent==='red'?'#FF2D2D':'#9AFF00';
  const w=760,h=440;
  const card=el('div','panel'+(P.accent==='red'?' red':''),{width:px(w),height:px(h),left:px((1920-w)/2),top:px((1080-h)/2),
    display:'flex',flexDirection:'column',justifyContent:'center',alignItems:'center',padding:'40px'});
  const top=el('div',null,{position:'absolute',top:0,left:0,right:0,height:'10px',background:acc,borderRadius:'26px 26px 0 0'});
  card.append(top); S.append(card); autoFade(card,0.01,0.4);
  tw(0,0.6,E.outBack,(p)=>{card.style.transform=`scale(${0.8+0.2*p})`;});
  const lines=(P.big||'').split('\n');
  lines.forEach((ln,li)=>{const h1=el('div','osw',{fontSize:'130px',color:acc,lineHeight:1.05,opacity:0});
    tw(0.2+li*0.12,0.5,E.outBack,(p)=>{h1.style.opacity=p;h1.style.transform=`translateY(${(1-p)*30}px)`;});
    const num=ln.match(/\d/); if(li===0&&num&&/^[+\-]?\d/.test(ln.trim())){const val=parseFloat(ln.replace(/[^\d.]/g,''))||0;const suf=ln.replace(/[+\-\d.\s]/g,'');const pre=ln.trim()[0]==='+'?'+':'';tw(0.25,1,E.outExpo,p=>h1.textContent=pre+Math.round(val*p)+suf);}else h1.textContent=ln;
    card.append(h1);});
  const bar=el('div',null,{width:'0px',height:'8px',background:acc,margin:'24px 0',borderRadius:'4px'});
  tw(0.5,0.5,E.outCubic,p=>bar.style.width=px(160*p)); card.append(bar);
  if(P.small){const sm=el('div','mont wht',{fontSize:'38px',opacity:0,textAlign:'center'});tw(0.6,0.5,E.outCubic,p=>{sm.style.opacity=p;});sm.textContent=P.small;card.append(sm);}
}

function comp_list(P){
  const red=P.accent==='red'; const acc=red?'#FF2D2D':'#9AFF00'; bg(red?'red':'lime',red?'red':'lime');
  const box=el('div',null,{position:'absolute',left:'200px',top:'50%',transform:'translateY(-50%)',width:'1520px'});
  S.append(box);
  if(P.title){const ttl=el('div','osw',{fontSize:'88px',marginBottom:'40px',opacity:0,color:acc});
    tw(0.1,0.5,E.outCubic,p=>{ttl.style.opacity=p;ttl.style.transform=`translateX(${(1-p)*-40}px)`;});
    ttl.textContent=P.title; box.append(ttl);}
  (P.items||[]).forEach((it,i)=>{
    const row=el('div',null,{display:'flex',alignItems:'center',gap:'40px',background:'rgba(18,18,22,.92)',
      borderRadius:'18px',padding:'24px 40px',marginBottom:'24px',borderLeft:'14px solid '+acc,opacity:0});
    const num=el('div',red?'mont':'osw',{minWidth:red?'128px':'80px',height:'76px',border:'4px solid '+acc,borderRadius:red?'38px':'50%',
      color:acc,fontSize:red?'32px':'44px',display:'flex',alignItems:'center',justifyContent:'center'});
    num.textContent=red?'FAKE?':(i+1);
    const tx=el('div','mont wht',{fontSize:'50px'}); tx.textContent=it;
    row.append(num,tx); box.append(row);
    tw(0.35+i*0.24,0.55,E.outBack,(p)=>{row.style.opacity=p;row.style.transform=`translateX(${(1-p)*80}px)`;});
  });
}

function comp_name(P){
  const w=880,h=150;
  const bar=el('div','panel',{width:px(w),height:px(h),left:'70px',top:'70px',border:'none',
    background:'rgba(13,13,16,.94)',borderLeft:'14px solid #9AFF00',display:'flex',flexDirection:'column',
    justifyContent:'center',paddingLeft:'40px',borderRadius:'16px'});
  const nm=el('div','osw wht',{fontSize:'58px',lineHeight:1}); nm.textContent=P.text||'';
  const sub=el('div','mont lime',{fontSize:'24px',marginTop:'8px'}); sub.textContent=P.sub||'';
  bar.append(nm,sub); S.append(bar);
  tw(0,0.5,E.outBack,(p)=>{bar.style.opacity=p;bar.style.transform=`translateX(${(1-p)*-120}px)`;});
  TRACKS.push(t=>{if(t>DUR-0.4)bar.style.opacity=1-E.outCubic(clamp((t-(DUR-0.4))/0.4,0,1));});
}

function comp_subscribe(P){
  const box=el('div',null,{position:'absolute',left:'50%',top:'860px',transform:'translateX(-50%)',display:'flex',gap:'24px'});
  S.append(box);
  const sub=el('div',null,{display:'flex',alignItems:'center',gap:'16px',background:'#FF2D2D',color:'#fff',
    fontFamily:'Mont',fontSize:'44px',borderRadius:'60px',padding:'22px 48px',boxShadow:'0 0 40px rgba(255,45,45,.5)'});
  sub.textContent='SUBSCRIBE';
  const like=el('div','osw',{background:'rgba(20,20,24,.95)',color:'#9AFF00',border:'3px solid #9AFF00',
    fontSize:'54px',borderRadius:'24px',padding:'12px 40px'}); like.textContent='ЛАЙК';
  box.append(sub,like);
  tw(0,0.5,E.outBack,(p)=>{box.style.opacity=p;box.style.transform=`translate(-50%,${(1-p)*80}px)`;});
  TRACKS.push(t=>{const s=1+0.05*Math.sin(t*6);sub.style.transform=`scale(${s})`;});
}

function comp_title(P){
  const acc=bg('lime');
  const box=el('div',null,{position:'absolute',left:0,right:0,top:'50%',transform:'translateY(-50%)',textAlign:'center'});
  S.append(box);
  const big=el('div',null,{}); box.append(big);
  splitReveal(big,P.big||'',' Oswald'.trim(),190,'#9AFF00',0.15,0.045);
  const bar=el('div',null,{width:'0',height:'10px',background:'#9AFF00',margin:'36px auto',borderRadius:'6px'});
  tw(0.6,0.6,E.outCubic,p=>bar.style.width=px(300*p)); box.append(bar);
  if(P.sub){const s=el('div','mont wht',{fontSize:'56px',opacity:0});tw(0.8,0.6,E.outCubic,p=>{s.style.opacity=p;s.style.filter=`blur(${(1-p)*10}px)`;});s.textContent=P.sub;box.append(s);}
}

function comp_compare(P){
  bg('lime');
  const mk=(txt,col,cx,dir)=>{
    const w=700,h=480;const pan=el('div','panel'+(col==='red'?' red':''),{width:px(w),height:px(h),left:px(cx-w/2),top:'300px',
      display:'flex',flexDirection:'column',justifyContent:'center',alignItems:'center',textAlign:'center',padding:'40px'});
    S.append(pan);
    tw(0.15,0.6,E.outBack,(p)=>{pan.style.opacity=p;pan.style.transform=`translateX(${(1-p)*dir*120}px)`;});
    (txt||'').split('\n').forEach((ln,i)=>{const h1=el('div','osw',{fontSize:'96px',color:i===0?(col==='red'?'#FF2D2D':'#9AFF00'):'#F2F2F4',lineHeight:1.08});h1.textContent=ln;pan.append(h1);});
  };
  mk(P.left,'red',1920*0.27,-1); mk(P.right,'lime',1920*0.73,1);
  const vs=el('div','osw',{position:'absolute',left:'50%',top:'540px',transform:'translate(-50%,-50%) scale(0)',
    width:'170px',height:'170px',borderRadius:'50%',background:'#0d0d10',border:'6px solid #9AFF00',color:'#9AFF00',
    fontSize:'86px',display:'flex',alignItems:'center',justifyContent:'center',boxShadow:'0 0 50px rgba(154,255,0,.4)'});
  vs.textContent='VS'; S.append(vs);
  tw(0.55,0.6,E.outBack,(p)=>{vs.style.transform=`translate(-50%,-50%) scale(${p})`;});
}

function comp_kinetic(P){
  const box=el('div',null,{position:'absolute',left:0,right:0,top:'50%',transform:'translateY(-50%)',textAlign:'center'});
  S.append(box); autoFade(box,0.2,0.35);
  (P.text||'').split('\n').forEach((ln,i)=>{
    const slab=el('div',null,{display:'inline-block',background:'#9AFF00',color:'#0b0b0b',fontFamily:'Oswald',
      fontSize:'150px',lineHeight:1.05,padding:'2px 26px',borderRadius:'10px',margin:'6px 0',transform:'scale(0)'});
    slab.textContent=ln;
    tw(0.05+i*0.18,0.5,E.outBack,(p)=>{slab.style.transform=`scale(${p})`;});
    box.append(el('div',null,{}).appendChild(slab).parentNode);
  });
}

function comp_pill(P){
  const pill=el('div','panel',{display:'inline-flex',alignItems:'center',gap:'22px',padding:'26px 46px',
    borderRadius:'18px',left:'50%',top:'900px',transform:'translateX(-50%)',border:'none',
    background:'rgba(13,13,16,.94)',borderTop:'8px solid #9AFF00'});
  const dot=el('div',null,{width:'22px',height:'22px',borderRadius:'50%',background:'#9AFF00',boxShadow:'0 0 16px #9AFF00'});
  const tx=el('div','mont wht',{fontSize:'46px'}); tx.textContent=P.text||'';
  pill.append(dot,tx); S.append(pill);
  tw(0,0.5,E.outBack,(p)=>{pill.style.opacity=p;pill.style.transform=`translate(-50%,${(1-p)*80}px)`;});
  TRACKS.push(t=>{if(t>DUR-0.4){pill.style.opacity=1-E.outCubic(clamp((t-(DUR-0.4))/0.4,0,1));}});
  TRACKS.push(t=>{dot.style.opacity=0.5+0.5*Math.abs(Math.sin(t*4));});
}

function comp_bars(P){ // animated bar chart infographic
  bg('lime');
  const data=P.data||[{l:'Apple',v:60,c:'#FF2D2D'},{l:'Android',v:95,c:'#9AFF00'},{l:'Прочее',v:40,c:'#6ad'}];
  if(P.title){const t=el('div','osw lime',{position:'absolute',left:'200px',top:'150px',fontSize:'80px',opacity:0});tw(0.1,0.5,E.outCubic,p=>t.style.opacity=p);t.textContent=P.title;S.append(t);}
  const base=760, W=260, gap=90, x0=(1920-(data.length*W+(data.length-1)*gap))/2;
  data.forEach((d,i)=>{
    const bx=x0+i*(W+gap);
    const bar=el('div',null,{position:'absolute',left:px(bx),bottom:'240px',width:px(W),height:'0px',
      background:d.c,borderRadius:'14px 14px 0 0',boxShadow:`0 0 40px ${d.c}55`});
    const val=el('div','osw',{position:'absolute',left:px(bx),width:px(W),textAlign:'center',bottom:'240px',color:d.c,fontSize:'70px'});
    const lab=el('div','mont wht',{position:'absolute',left:px(bx),width:px(W),textAlign:'center',bottom:'160px',fontSize:'42px'});
    lab.textContent=d.l;
    const maxh=560, hh=maxh*d.v/100;
    tw(0.3+i*0.15,0.9,E.outExpo,(p)=>{bar.style.height=px(hh*p);val.style.bottom=px(240+hh*p+16);val.textContent=Math.round(d.v*p)+'%';});
    S.append(bar,val,lab);
  });
}

function comp_orb(P){ // glass orb image with float + ring draw
  const size=560; const cx=P.pos==='L'?440:1480; const cy=400;
  const holder=el('div',null,{position:'absolute',left:px(cx-size/2),top:px(cy-size/2),width:px(size),height:px(size)});
  S.append(holder);
  const img=el('div',null,{position:'absolute',inset:'0',borderRadius:'50%',backgroundImage:`url(${P.img})`,
    backgroundSize:'cover',backgroundPosition:'center',boxShadow:'inset 0 0 60px rgba(0,0,0,.6),0 30px 60px rgba(0,0,0,.5)'});
  const ring=el('div',null,{position:'absolute',inset:'-6px',borderRadius:'50%',border:'3px solid rgba(255,255,255,.5)'});
  const glare=el('div',null,{position:'absolute',left:'8%',top:'6%',width:'50%',height:'40%',borderRadius:'50%',
    background:'radial-gradient(ellipse at 35% 30%,rgba(255,255,255,.28),transparent 55%)',pointerEvents:'none'});
  holder.append(img,ring,glare);
  if(P.pill){const pl=el('div','chip',{position:'absolute',left:'50%',top:'-40px',transform:'translateX(-50%)',fontSize:'30px',whiteSpace:'nowrap'});pl.textContent=P.pill;holder.append(pl);
    tw(0.25,0.5,E.outBack,p=>{pl.style.opacity=p;pl.style.transform=`translate(-50%,${(1-p)*-20}px)`;});}
  tw(0,0.6,E.outBack,(p)=>{holder.style.opacity=p;holder.style.transform=`scale(${0.6+0.4*p}) translateX(${(1-p)*(P.pos==='L'?-120:120)}px)`;});
  TRACKS.push(t=>{img.style.transform=`translateY(${Math.sin(t*1.6)*10}px)`;});
  TRACKS.push(t=>{if(t>DUR-0.4)holder.style.opacity=1-E.outCubic(clamp((t-(DUR-0.4))/0.4,0,1));});
}

// ---- checkmark svg helper ----
function checkSVG(col){const s=document.createElementNS('http://www.w3.org/2000/svg','svg');s.setAttribute('viewBox','0 0 24 24');s.setAttribute('width','54');s.setAttribute('height','54');const p=document.createElementNS('http://www.w3.org/2000/svg','path');p.setAttribute('d','M4 12.5l5 5L20 6');p.setAttribute('fill','none');p.setAttribute('stroke',col);p.setAttribute('stroke-width','3');p.setAttribute('stroke-linecap','round');p.setAttribute('stroke-linejoin','round');s.appendChild(p);return s;}

function comp_info_headlines(P){
  bg('red','red');
  const heads=P.items||['APPLE ЗАБЛОКИРУЕТ iPhone В РФ?','СЕРЫЙ ИМПОРТ — ВНЕ ЗАКОНА','ЧТО БУДЕТ С РЫНКОМ ГАДЖЕТОВ','ПАНИКА СРЕДИ ПРОДАВЦОВ'];
  const box=el('div',null,{position:'absolute',left:'160px',right:'160px',top:'50%',transform:'translateY(-50%)'});
  S.append(box);
  const ttl=el('div','osw',{fontSize:'62px',color:'#FF2D2D',marginBottom:'34px',letterSpacing:'2px',opacity:0});
  ttl.textContent='СРОЧНО · НОВОСТИ';
  tw(0.1,0.5,E.outCubic,p=>ttl.style.opacity=p); box.append(ttl);
  heads.forEach((h,i)=>{
    const row=el('div',null,{display:'flex',alignItems:'center',gap:'30px',marginBottom:'26px',opacity:0,
      background:'rgba(15,15,18,.94)',borderLeft:'12px solid #FF2D2D',borderRadius:'14px',padding:'26px 36px'});
    const tag=el('div','mont',{background:'#FF2D2D',color:'#fff',fontSize:'26px',padding:'8px 20px',borderRadius:'8px',whiteSpace:'nowrap'});
    tag.textContent='LIVE';
    const tx=el('div','mont wht',{fontSize:'50px',lineHeight:1.05}); tx.textContent=h;
    row.append(tag,tx); box.append(row);
    tw(0.4+i*0.28,0.55,E.outBack,p=>{row.style.opacity=p;row.style.transform=`translateX(${(1-p)*90}px)`;});
    TRACKS.push(t=>{if(t>0.5)tag.style.opacity=0.4+0.6*Math.abs(Math.sin(t*5+i));});
  });
}

function comp_rule(P){
  bg('lime');
  const wrap=el('div',null,{position:'absolute',inset:0,display:'flex',flexDirection:'column',justifyContent:'center',alignItems:'center',textAlign:'center'});
  S.append(wrap);
  const kick=el('div','mont',{color:'#9AFF00',fontSize:'44px',letterSpacing:'8px',opacity:0,marginBottom:'10px'});
  kick.textContent='ПРАВИЛО'; tw(0.1,0.5,E.outCubic,p=>{kick.style.opacity=p;kick.style.letterSpacing=px(8+(1-p)*30);}); wrap.append(kick);
  const num=el('div','osw',{fontSize:'340px',color:'#9AFF00',lineHeight:0.9,textShadow:'0 0 60px rgba(154,255,0,.4)',transform:'scale(0)'});
  num.textContent=P.n||'1'; tw(0.2,0.7,E.outBack,p=>{num.style.transform=`scale(${p})`;}); wrap.append(num);
  const bar=el('div',null,{width:'0',height:'8px',background:'#9AFF00',margin:'20px auto 30px',borderRadius:'4px'});
  tw(0.6,0.5,E.outCubic,p=>bar.style.width=px(240*p)); wrap.append(bar);
  const box=el('div',null,{}); wrap.append(box);
  (P.title||'').split('\n').forEach((ln,i)=>{const h=el('div','osw wht',{fontSize:'92px',lineHeight:1.08,opacity:0});
    tw(0.75+i*0.14,0.5,E.outCubic,p=>{h.style.opacity=p;h.style.transform=`translateY(${(1-p)*24}px)`;});h.textContent=ln;box.append(h);});
}

function comp_list2num(P){
  bg('lime');
  const w=1180,h=440;
  const card=el('div','panel',{width:px(w),height:px(h),left:px((1920-w)/2),top:px((1080-h)/2),
    display:'flex',alignItems:'center',gap:'56px',padding:'0 70px'});
  S.append(card); autoFade(card,0.01,0.4);
  tw(0,0.6,E.outBack,p=>card.style.transform=`scale(${0.85+0.15*p})`);
  const num=el('div','osw',{fontSize:'260px',color:'#9AFF00',lineHeight:0.9,minWidth:'320px',textAlign:'center',opacity:0});
  num.textContent=P.n||'01'; tw(0.2,0.6,E.outBack,p=>{num.style.opacity=p;num.style.transform=`translateX(${(1-p)*-40}px)`;});
  const col=el('div',null,{display:'flex',flexDirection:'column',gap:'18px'});
  const t=el('div','osw wht',{fontSize:'78px',lineHeight:1.05,opacity:0}); t.textContent=P.title||'';
  tw(0.35,0.5,E.outCubic,p=>{t.style.opacity=p;t.style.transform=`translateX(${(1-p)*40}px)`;});
  const s=el('div','mont lime',{fontSize:'42px',opacity:0}); s.textContent=P.sub||'';
  tw(0.5,0.5,E.outCubic,p=>s.style.opacity=p);
  col.append(t,s); card.append(num,col);
}

function comp_list3b(P){ // checkmark rows
  bg('lime');
  const box=el('div',null,{position:'absolute',left:'260px',top:'50%',transform:'translateY(-50%)',width:'1400px'});
  S.append(box);
  if(P.title){const ttl=el('div','osw lime',{fontSize:'84px',marginBottom:'44px',opacity:0});tw(0.1,0.5,E.outCubic,p=>{ttl.style.opacity=p;ttl.style.transform=`translateY(${(1-p)*-20}px)`;});ttl.textContent=P.title;box.append(ttl);}
  (P.items||[]).forEach((it,i)=>{
    const row=el('div',null,{display:'flex',alignItems:'center',gap:'34px',background:'rgba(16,16,20,.92)',
      borderRadius:'16px',padding:'26px 40px',marginBottom:'24px',opacity:0});
    const badge=el('div',null,{minWidth:'86px',height:'86px',borderRadius:'50%',border:'4px solid #9AFF00',
      display:'flex',alignItems:'center',justifyContent:'center',background:'rgba(154,255,0,.08)'});
    badge.append(checkSVG('#9AFF00'));
    const tx=el('div','mont wht',{fontSize:'54px'}); tx.textContent=it;
    row.append(badge,tx); box.append(row);
    tw(0.35+i*0.24,0.55,E.outBack,p=>{row.style.opacity=p;row.style.transform=`translateX(${(1-p)*-80}px)`;});
  });
}

function comp_list3c(P){ // big number blocks
  bg('lime');
  const box=el('div',null,{position:'absolute',left:'220px',top:'50%',transform:'translateY(-50%)',width:'1480px'});
  S.append(box);
  if(P.title){const ttl=el('div','osw lime',{fontSize:'84px',marginBottom:'44px',opacity:0});tw(0.1,0.5,E.outCubic,p=>ttl.style.opacity=p);ttl.textContent=P.title;box.append(ttl);}
  (P.items||[]).forEach((it,i)=>{
    const row=el('div',null,{display:'flex',alignItems:'center',gap:'40px',marginBottom:'28px',opacity:0});
    const n=el('div','osw',{fontSize:'110px',color:'#0b0b0b',background:'#9AFF00',minWidth:'120px',height:'120px',
      borderRadius:'20px',display:'flex',alignItems:'center',justifyContent:'center',lineHeight:1});
    n.textContent=(i+1);
    const tx=el('div','mont wht',{fontSize:'58px'}); tx.textContent=it;
    row.append(n,tx); box.append(row);
    tw(0.35+i*0.22,0.55,E.outBack,p=>{row.style.opacity=p;row.style.transform=`translateX(${(1-p)*90}px)`;});
  });
}

function comp_list_brands(P){
  bg('lime');
  const brands=P.brands||['HUAWEI','XIAOMI','SAMSUNG'];
  const box=el('div',null,{position:'absolute',left:0,right:0,top:'50%',transform:'translateY(-50%)',
    display:'flex',justifyContent:'center',gap:'50px'});
  S.append(box);
  brands.forEach((b,i)=>{
    const chip=el('div','osw',{fontSize:'86px',color:'#0b0b0b',background:'#9AFF00',padding:'34px 60px',
      borderRadius:'22px',boxShadow:'0 20px 50px rgba(154,255,0,.25)',opacity:0});
    chip.textContent=b; box.append(chip);
    tw(0.15+i*0.2,0.6,E.outBack,p=>{chip.style.opacity=p;chip.style.transform=`translateY(${(1-p)*80}px) scale(${0.8+0.2*p})`;});
    TRACKS.push(t=>{chip.style.transform=`translateY(${Math.sin(t*1.5+i)*8}px)`;});
  });
}

function comp_cta_title(P){
  const acc=bg('lime');
  const wrap=el('div',null,{position:'absolute',inset:0,display:'flex',flexDirection:'column',justifyContent:'center',alignItems:'center',textAlign:'center'});
  S.append(wrap);
  const badge=el('div','mont',{background:'#9AFF00',color:'#0b0b0b',fontSize:'40px',letterSpacing:'6px',
    padding:'14px 40px',borderRadius:'40px',opacity:0,marginBottom:'28px'});
  badge.textContent='MASTERMIND'; tw(0.1,0.5,E.outBack,p=>{badge.style.opacity=p;badge.style.transform=`scale(${0.7+0.3*p})`;}); wrap.append(badge);
  const big=el('div',null,{}); wrap.append(big);
  splitReveal(big,P.big||'VOLTRIX','Oswald',230,'#9AFF00',0.25,0.05);
  if(P.sub){const s=el('div','mont wht',{fontSize:'52px',opacity:0,marginTop:'30px'});
    tw(0.9,0.6,E.outCubic,p=>{s.style.opacity=p;s.style.filter=`blur(${(1-p)*8}px)`;});s.textContent=P.sub;wrap.append(s);}
}

function buildComponent(P){
  DUR=P.dur||DUR;
  const map={stat:comp_stat,statfull:comp_stat,statcard:comp_statcard,list:comp_list,list3:comp_list,
    list3b:comp_list3b,list3c:comp_list3c,list2num:comp_list2num,list_brands:comp_list_brands,
    title:comp_title,cta_title:comp_cta_title,rule:comp_rule,info_headlines:comp_info_headlines,
    compare:comp_compare,kinetic:comp_kinetic,pill:comp_pill,bars:comp_bars,orb:comp_orb,
    name:comp_name,subscribe:comp_subscribe,
    card:comp_card,device:comp_device,hex:comp_hex,split:comp_split,grid3:comp_grid3,billboard:comp_billboard,
    linechart:comp_linechart,gauge:comp_gauge,donut:comp_donut,map_routes:comp_map_routes,
    glassticker:comp_glassticker,glassquote:comp_glassquote,flowtree:comp_flowtree,timeline:comp_timeline,arrows:comp_arrows,photo3d:comp_photo3d};
  window.__NOBG = !!P.over;
  // NO scrim card — it read as a glitchy grey box. Legibility comes from the COMPOSITOR darkening/blurring
  // the video behind the graphic zone. Graphics stay clean transparent overlays.
  (map[P.kind]||comp_stat)(P);
  const bs=(P.seed||1);
  if(P.over){
    // OVER-VIDEO: shrink the graphic into a side zone (off-face), transparent, over the live talking-head
    S.style.transformOrigin='0 0';
    const sc=P.oscale||0.46;
    const sx = P.opos==='L' ? 30 : (P.opos==='C' ? (960 - 960*sc) : (1920 - 1920*sc - 30));   // left / center / right
    const sy = P.oy!==undefined ? P.oy : (540 - 540*sc);      // vertically centered by default
    TRACKS.push(t=>{const p=clamp(t/0.5,0,1);const fy=Math.sin(t*0.9+bs)*10;const io=1-Math.pow(1-p,3);
      S.style.opacity=(t>DUR-0.4?1-clamp((t-(DUR-0.4))/0.4,0,1):1);
      S.style.transform=`translate(${sx + (P.opos==='L'?-1:1)*(1-io)*80}px,${sy+fy}px) scale(${sc})`;});
  } else {
    // FULLSCREEN: bold continuous camera push-in (Z) + drift so nothing ever freezes
    S.style.transformOrigin='50% 45%';
    const dir=(bs%2)?1:-1;
    TRACKS.push(t=>{const p=clamp(t/DUR,0,1);
      const zoom = dir>0 ? (1.0+0.07*p) : (1.07-0.07*p);
      const dx=Math.sin(t*0.6+bs)*8, dy=Math.cos(t*0.5+bs)*6;
      S.style.transform=`translate(${dx}px,${dy}px) scale(${zoom})`;});
  }
}
window.renderT=(t)=>{ TRACKS.forEach(fn=>fn(t)); };
window.__ready=true;

// ===== VARIED IMAGE INSERTS (no repeats) =====
function kb(imgEl,seed){ // ken burns inside a container
  const zs=1.04+0.02*(seed%3), ze=1.16+0.02*(seed%2);
  const dx=(seed%2?1:-1)*20, dy=(seed%3-1)*16;
  TRACKS.push(t=>{const p=clamp(t/DUR,0,1);const z=zs+(ze-zs)*p;
    imgEl.style.transform=`scale(${z}) translate(${dx*p}px,${dy*p}px)`;});
}
function pillLabel(host,text,cx,y,col){
  if(!text)return; const pl=el('div',null,{position:'absolute',left:px(cx),top:px(y),transform:'translateX(-50%) scale(0)',
    background:col||'#9AFF00',color:'#0b0b0b',fontFamily:'Mont',fontSize:'30px',borderRadius:'40px',padding:'10px 28px',whiteSpace:'nowrap'});
  pl.textContent=text; host.append(pl);
  tw(0.3,0.5,E.outBack,p=>pl.style.transform=`translateX(-50%) scale(${p})`);
}
function outFade(node){ TRACKS.push(t=>{if(t>DUR-0.4)node.style.opacity=1-E.outCubic(clamp((t-(DUR-0.4))/0.4,0,1));}); }

// floating wrapper: host keeps its own entrance transform, wrapper adds perpetual life
function mount(host,seed,amp){
  const wrap=el('div',null,{position:'absolute',inset:0,pointerEvents:'none'});
  wrap.append(host); S.append(wrap);
  const s=seed||1,fx=0.7+seedRnd(s)*0.5,fy=0.6+seedRnd(s*2)*0.5,fr=0.4+seedRnd(s*3)*0.4,a=amp==null?1:amp;
  TRACKS.push(t=>{wrap.style.transform=`translate(${Math.sin(t*fx+s)*7*a}px,${Math.cos(t*fy+s)*8*a}px) rotate(${Math.sin(t*fr+s)*0.5*a}deg)`;});
  return wrap;
}
function comp_card(P){ // rounded rectangular photo card, tilt+slide, ken-burns + perpetual float
  const w=720,h=560; const cx=P.pos==='L'?470:1450, cy=470;
  const host=el('div',null,{position:'absolute',left:px(cx-w/2),top:px(cy-h/2),width:px(w),height:px(h),
    borderRadius:'28px',overflow:'hidden',boxShadow:'0 30px 70px rgba(0,0,0,.6)',border:'4px solid #9AFF00'});
  const img=el('div',null,{position:'absolute',inset:'-10%',backgroundImage:`url(${P.img})`,backgroundSize:'cover',backgroundPosition:'center'});
  const gloss=el('div',null,{position:'absolute',inset:0,background:'linear-gradient(120deg,rgba(255,255,255,.18),transparent 40%)'});
  host.append(img,gloss); mount(host,(P.seed||3)+1); kb(img,3); outFade(host);
  const dir=P.pos==='L'?-1:1;
  tw(0,0.6,E.outBack,p=>{host.style.opacity=p;host.style.transform=`translateX(${(1-p)*dir*160}px) rotate(${(1-p)*dir*4}deg)`;});
  TRACKS.push(t=>{gloss.style.transform=`translateX(${(Math.sin(t*1.2)*0.5+0.5)*w-w/2}px)`;});
  pillLabel(S,P.pill,cx,cy-h/2-20,'#9AFF00');
}
function comp_device(P){ // phone mockup with a designed lime UI screen (never an empty black plate)
  const red = P.accent==='red';
  const AC = red?'#FF2D2D':'#9AFF00';
  const w=372,h=744; const cx=P.pos==='L'?430:(P.pos==='C'?960:1490), cy=500;
  const host=el('div',null,{position:'absolute',left:px(cx-w/2),top:px(cy-h/2),width:px(w),height:px(h),
    borderRadius:'52px',background:'linear-gradient(160deg,#20222a,#0d0e12)',border:'8px solid #23252c',
    boxShadow:`0 34px 80px rgba(0,0,0,.5),0 0 46px ${red?'rgba(255,45,45,.22)':'rgba(154,255,0,.20)'}`,overflow:'hidden'});
  const scr=el('div',null,{position:'absolute',inset:'12px',borderRadius:'42px',overflow:'hidden',
    background:`radial-gradient(120% 80% at 50% 18%,${red?'#2a0d0d':'#12240f'},#07100a 62%,#050705)`});
  // faint grid + glow orb
  const grid=el('div',null,{position:'absolute',inset:0,opacity:.5,
    backgroundImage:`linear-gradient(${AC}22 1px,transparent 1px),linear-gradient(90deg,${AC}22 1px,transparent 1px)`,
    backgroundSize:'34px 34px'});
  const orb=el('div',null,{position:'absolute',left:'50%',top:'34%',transform:'translate(-50%,-50%)',width:'220px',height:'220px',
    borderRadius:'50%',background:`radial-gradient(circle,${AC}55,transparent 65%)`,filter:'blur(6px)'});
  // big glyph: lock (block) — SVG, brand style
  const gl=svgEl('svg',{width:150,height:150,viewBox:'0 0 24 24',style:'position:absolute;left:50%;top:33%;transform:translate(-50%,-50%);filter:drop-shadow(0 0 14px '+AC+'aa)'});
  gl.appendChild(svgEl('path',{d:'M6 10V8a6 6 0 1112 0v2',fill:'none',stroke:AC,'stroke-width':1.5,'stroke-linecap':'round'}));
  gl.appendChild(svgEl('rect',{x:4,y:10,width:16,height:11,rx:2.4,fill:'none',stroke:AC,'stroke-width':1.5}));
  gl.appendChild(svgEl('circle',{cx:12,cy:15.4,r:1.5,fill:AC}));
  // caption on screen
  const cap=el('div',null,{position:'absolute',left:'8%',right:'8%',top:'62%',textAlign:'center',
    fontFamily:'Oswald',fontWeight:700,fontSize:'40px',lineHeight:1.05,color:'#F2F2F4',letterSpacing:'.5px'});
  cap.textContent=(P.pill||'').replace(/[?!]+$/,'');
  const bar=el('div',null,{position:'absolute',left:'22%',right:'22%',top:'80%',height:'8px',borderRadius:'6px',
    background:`linear-gradient(90deg,${AC},${AC}44)`,boxShadow:`0 0 16px ${AC}88`});
  const notch=el('div',null,{position:'absolute',left:'50%',top:'18px',transform:'translateX(-50%)',width:'116px',height:'24px',background:'#000',borderRadius:'14px',zIndex:5});
  const shine=el('div',null,{position:'absolute',inset:0,background:'linear-gradient(115deg,rgba(255,255,255,.18),transparent 42%)',pointerEvents:'none'});
  scr.append(grid,orb,gl,cap,bar,shine); host.append(scr,notch); mount(host,(P.seed||2)+2); outFade(host);
  tw(0,0.6,E.outBack,p=>{host.style.opacity=p;host.style.transform=`translateY(${(1-p)*120}px) scale(${0.9+0.1*p})`;});
  tw(0.25,0.5,E.outCubic,p=>{bar.style.transform=`scaleX(${p})`;bar.style.transformOrigin='left';});
  TRACKS.push(t=>{orb.style.opacity=(0.6+0.4*Math.sin(t*1.6)).toFixed(2);host.style.setProperty('--f',t);});
  pillLabel(S,P.pill,cx,cy-h/2-16,AC);
}
function comp_hex(P){
  const s=560; const cx=P.pos==='L'?450:1470, cy=440;
  const host=el('div',null,{position:'absolute',left:px(cx-s/2),top:px(cy-s/2),width:px(s),height:px(s),
    clipPath:'polygon(25% 3%,75% 3%,100% 50%,75% 97%,25% 97%,0% 50%)',overflow:'hidden',
    filter:'drop-shadow(0 20px 40px rgba(0,0,0,.6))'});
  const img=el('div',null,{position:'absolute',inset:'-8%',backgroundImage:`url(${P.img})`,backgroundSize:'cover',backgroundPosition:'center'});
  const brd=el('div',null,{position:'absolute',inset:0,clipPath:'polygon(25% 3%,75% 3%,100% 50%,75% 97%,25% 97%,0% 50%)',
    boxShadow:'inset 0 0 0 5px #9AFF00'});
  host.append(img,brd); mount(host,(P.seed||1)+3); kb(img,1); outFade(host);
  tw(0,0.6,E.outBack,p=>{host.style.opacity=p;host.style.transform=`scale(${0.6+0.4*p}) rotate(${(1-p)*30}deg)`;});
  pillLabel(S,P.pill,cx,cy-s/2+30,'#9AFF00');
}
function comp_split(P){ // full-height diagonal image panel one side + optional text
  const left=P.pos==='L';
  const host=el('div',null,{position:'absolute',top:0,bottom:0,width:'56%',[left?'left':'right']:0,overflow:'hidden',
    clipPath:left?'polygon(0 0,100% 0,80% 100%,0 100%)':'polygon(20% 0,100% 0,100% 100%,0 100%)'});
  const img=el('div',null,{position:'absolute',inset:'-6%',backgroundImage:`url(${P.img})`,backgroundSize:'cover',backgroundPosition:'center'});
  const tint=el('div',null,{position:'absolute',inset:0,background:'linear-gradient(rgba(8,8,10,.15),rgba(8,8,10,.5))'});
  const edge=el('div',null,{position:'absolute',top:0,bottom:0,[left?'right':'left']:'18%',width:'6px',background:'#9AFF00',boxShadow:'0 0 24px #9AFF00'});
  host.append(img,tint); S.append(host); S.append(edge); kb(img,4); outFade(host); outFade(edge);
  tw(0,0.6,E.outQuint,p=>{host.style.opacity=1;host.style.transform=`translateX(${(1-p)*(left?-1:1)*900}px)`;edge.style.opacity=p;});
  if(P.pill){const t=el('div','osw wht',{position:'absolute',top:'46%',[left?'right':'left']:'8%',width:'34%',fontSize:'84px',lineHeight:1.05});
    t.textContent=P.pill;S.append(t);tw(0.4,0.6,E.outCubic,p=>{t.style.opacity=p;t.style.transform=`translateY(${(1-p)*30}px)`;});outFade(t);}
}
function comp_grid3(P){ // three photos stagger in (fullscreen dark bg)
  bg('lime');
  const imgs=P.imgs||[P.img,P.img,P.img]; const W=520,H=620,gap=40;
  const total=3*W+2*gap; const x0=(1920-total)/2, y0=(1080-H)/2+20;
  imgs.slice(0,3).forEach((src,i)=>{
    const host=el('div',null,{position:'absolute',left:px(x0+i*(W+gap)),top:px(y0),width:px(W),height:px(H),
      borderRadius:'22px',overflow:'hidden',border:'4px solid #9AFF00',boxShadow:'0 20px 50px rgba(0,0,0,.6)'});
    const img=el('div',null,{position:'absolute',inset:'-8%',backgroundImage:`url(${src})`,backgroundSize:'cover',backgroundPosition:'center'});
    host.append(img); S.append(host); kb(img,i); outFade(host);
    tw(0.1+i*0.18,0.6,E.outBack,p=>{host.style.opacity=p;host.style.transform=`translateY(${(1-p)*100}px) scale(${0.85+0.15*p})`;});
    if(P.labels&&P.labels[i]){const l=el('div','mont',{position:'absolute',left:'0',right:'0',bottom:'0',background:'rgba(11,11,13,.85)',color:'#9AFF00',fontSize:'30px',padding:'14px',textAlign:'center'});l.textContent=P.labels[i];host.append(l);}
  });
}
function comp_billboard(P){ // big tilted card center, dramatic — fullscreen dark bg (never over face)
  bg('lime');
  const w=1240,h=700;
  const host=el('div',null,{position:'absolute',left:px((1920-w)/2),top:px((1080-h)/2+10),width:px(w),height:px(h),
    borderRadius:'26px',overflow:'hidden',border:'5px solid #9AFF00',boxShadow:'0 40px 90px rgba(0,0,0,.7)'});
  const img=el('div',null,{position:'absolute',inset:'-6%',backgroundImage:`url(${P.img})`,backgroundSize:'cover',backgroundPosition:'center'});
  host.append(img); mount(host,(P.seed||5)+4,0.7); kb(img,5); outFade(host);
  tw(0,0.7,E.outBack,p=>{host.style.opacity=p;host.style.transform=`perspective(1400px) rotateY(${(1-p)*22}deg) scale(${0.85+0.15*p})`;});
  TRACKS.push(t=>{if(t>0.7)host.style.transform=`perspective(1400px) rotateY(${Math.sin(t*0.6)*5}deg) rotateX(${Math.cos(t*0.5)*2}deg) scale(1)`;}); // gentle 3D sway after entrance
  pillLabel(S,P.pill,960,(1080-h)/2-16,'#9AFF00');
}

// ================= INFOGRAPHIC / GLASS / MAP LIBRARY (scenario v2) =================
function svgEl(t,a){const e=document.createElementNS('http://www.w3.org/2000/svg',t);for(const k in a)e.setAttribute(k,a[k]);return e;}
function glassCard(x,y,w,h,r){ // frosted glass panel element
  const c=el('div',null,{position:'absolute',left:px(x),top:px(y),width:px(w),height:px(h),borderRadius:px(r||24),
    background:'linear-gradient(135deg,rgba(255,255,255,.10),rgba(255,255,255,.03))',
    border:'1.5px solid rgba(255,255,255,.22)',backdropFilter:'blur(18px)',
    boxShadow:'0 20px 60px rgba(0,0,0,.5), inset 0 1px 0 rgba(255,255,255,.25)'});
  return c;
}

// LINE CHART climbing, optional ceiling break + arrow up
function comp_linechart(P){ bg('lime');
  const X0=260,Y0=820,W=1400,H=560; const acc='#9AFF00';
  if(P.title){const t=el('div','osw lime',{position:'absolute',left:px(X0),top:'120px',fontSize:'72px',opacity:0});tw(0.1,0.5,E.outCubic,p=>t.style.opacity=p);t.textContent=P.title;S.append(t);}
  const svg=svgEl('svg',{width:1920,height:1080,style:'position:absolute;inset:0'}); S.append(svg);
  // axes
  const ax=svgEl('line',{x1:X0,y1:Y0,x2:X0+W,y2:Y0,stroke:'rgba(255,255,255,.25)','stroke-width':3}); svg.append(ax);
  const ay=svgEl('line',{x1:X0,y1:Y0,x2:X0,y2:Y0-H,stroke:'rgba(255,255,255,.25)','stroke-width':3}); svg.append(ay);
  // ceiling
  const ceilY=Y0-H*0.62;
  const ceil=svgEl('line',{x1:X0,y1:ceilY,x2:X0+W,y2:ceilY,stroke:'#FF2D2D','stroke-width':4,'stroke-dasharray':'18 12',opacity:0.0}); svg.append(ceil);
  tw(0.3,0.5,null,p=>ceil.setAttribute('opacity',0.7*p));
  // path points: rise, flatten at ceiling, then break up
  const pts=[[X0,Y0],[X0+W*0.22,Y0-H*0.25],[X0+W*0.44,Y0-H*0.5],[X0+W*0.6,ceilY],[X0+W*0.72,ceilY+6],[X0+W*0.82,ceilY-H*0.12],[X0+W*0.92,Y0-H*0.95]];
  const path=svgEl('path',{fill:'none',stroke:acc,'stroke-width':7,'stroke-linecap':'round','stroke-linejoin':'round',filter:'drop-shadow(0 0 10px rgba(154,255,0,.6))'}); svg.append(path);
  const d='M'+pts.map(p=>p.join(',')).join(' L'); path.setAttribute('d',d);
  const len=path.getTotalLength(); path.setAttribute('stroke-dasharray',len); path.setAttribute('stroke-dashoffset',len);
  tw(0.4,1.6,E.outCubic,p=>path.setAttribute('stroke-dashoffset',len*(1-p)));
  // moving dot + arrow head at end
  const dot=svgEl('circle',{r:12,fill:'#fff',filter:'drop-shadow(0 0 12px #9AFF00)'}); svg.append(dot);
  TRACKS.push(t=>{const p=clamp((t-0.4)/1.6,0,1);const pt=path.getPointAtLength(len*p);dot.setAttribute('cx',pt.x);dot.setAttribute('cy',pt.y);dot.setAttribute('opacity',p>0&&p<1?1:0);});
  // burst at ceiling break
  const burst=el('div',null,{position:'absolute',left:px(X0+W*0.62),top:px(ceilY-30),width:'60px',height:'60px',borderRadius:'50%',background:'radial-gradient(circle,#9AFF00,transparent 70%)',opacity:0});S.append(burst);
  tw(1.35,0.4,E.outCubic,p=>{burst.style.opacity=(1-p)*0.9;burst.style.transform=`scale(${1+p*3})`;});
}

// GAUGE arc dial sweeping to value
function comp_gauge(P){ bg('lime');
  const cx=960,cy=620,R=300; const val=P.val!==undefined?P.val:0; const label=P.label||''; const big=P.big||('≈ '+val+'%');
  const acc=P.accent==='red'?'#FF2D2D':'#9AFF00';
  const svg=svgEl('svg',{width:1920,height:1080,style:'position:absolute;inset:0'}); S.append(svg);
  const a0=Math.PI*0.8, a1=Math.PI*2.2; // 216deg..396deg sweep
  function arc(frac,color,wdt){const a=a0+(a1-a0)*frac;const x0=cx+R*Math.cos(a0),y0=cy+R*Math.sin(a0),x=cx+R*Math.cos(a),y=cy+R*Math.sin(a);const large=(a-a0)>Math.PI?1:0;return svgEl('path',{d:`M${x0},${y0} A${R},${R} 0 ${large} 1 ${x},${y}`,fill:'none',stroke:color,'stroke-width':wdt,'stroke-linecap':'round'});}
  svg.append(arc(1,'rgba(255,255,255,.12)',26));
  const fg=arc(0.0001,acc,26); fg.setAttribute('filter','drop-shadow(0 0 12px '+acc+')'); svg.append(fg);
  const needle=svgEl('line',{x1:cx,y1:cy,x2:cx,y2:cy,stroke:'#fff','stroke-width':6,'stroke-linecap':'round'});svg.append(needle);
  svg.append(svgEl('circle',{cx:cx,cy:cy,r:16,fill:acc}));
  const num=el('div','osw',{position:'absolute',left:0,right:0,top:px(cy-110),textAlign:'center',fontSize:'150px',color:acc,textShadow:'0 0 30px '+acc+'55'});S.append(num);
  const lab=el('div','mont wht',{position:'absolute',left:0,right:0,top:px(cy+R-30),textAlign:'center',fontSize:'46px',opacity:0});lab.textContent=label;S.append(lab);
  tw(0.6,0.5,E.outCubic,p=>lab.style.opacity=p);
  TRACKS.push(t=>{const p=clamp((t-0.2)/1.3,0,1);const frac=p*(val/100);
    fg.setAttribute('d',arc(Math.max(0.0001,frac),acc,26).getAttribute('d'));
    const a=a0+(a1-a0)*frac; needle.setAttribute('x2',cx+(R-30)*Math.cos(a)); needle.setAttribute('y2',cy+(R-30)*Math.sin(a));
    num.textContent = P.big?P.big:('≈ '+Math.round(val*p)+'%');});
}

// DONUT chart filling to pct
function comp_donut(P){ bg('lime');
  const cx=960,cy=560,R=250,wdt=54; const pct=P.pct!==undefined?P.pct:40; const acc='#9AFF00';
  const svg=svgEl('svg',{width:1920,height:1080,style:'position:absolute;inset:0'}); S.append(svg);
  svg.append(svgEl('circle',{cx,cy,r:R,fill:'none',stroke:'rgba(255,255,255,.12)','stroke-width':wdt}));
  const C=2*Math.PI*R; const fg=svgEl('circle',{cx,cy,r:R,fill:'none',stroke:acc,'stroke-width':wdt,'stroke-linecap':'round',transform:`rotate(-90 ${cx} ${cy})`,'stroke-dasharray':C,'stroke-dashoffset':C,filter:'drop-shadow(0 0 10px '+acc+')'});svg.append(fg);
  const num=el('div','osw',{position:'absolute',left:0,right:0,top:px(cy-90),textAlign:'center',fontSize:'150px',color:acc});S.append(num);
  const lab=el('div','mont wht',{position:'absolute',left:0,right:0,top:px(cy+R+40),textAlign:'center',fontSize:'46px',opacity:0});lab.textContent=P.label||'';S.append(lab);tw(0.6,0.5,E.outCubic,p=>lab.style.opacity=p);
  TRACKS.push(t=>{const p=clamp((t-0.2)/1.3,0,1);const f=p*(pct/100);fg.setAttribute('stroke-dashoffset',C*(1-f));num.textContent='+'+Math.round(pct*p)+'%';});
}

// SUPPLY-ROUTE map: labeled city nodes + animated dashed arcs
function comp_map_routes(P){ bg('lime');
  const svg=svgEl('svg',{width:1920,height:1080,style:'position:absolute;inset:0'}); S.append(svg);
  // faint grid globe feel
  for(let i=0;i<6;i++){svg.append(svgEl('ellipse',{cx:960,cy:560,rx:200+i*120,ry:80+i*48,fill:'none',stroke:'rgba(154,255,0,.06)','stroke-width':2}));}
  const nodes=P.nodes||[{x:480,y:640,t:'КИТАЙ'},{x:760,y:760,t:'ДУБАЙ'},{x:1350,y:420,t:'РОССИЯ'}];
  const dst=nodes[nodes.length-1];
  nodes.slice(0,-1).forEach((n,i)=>{
    const mx=(n.x+dst.x)/2, my=Math.min(n.y,dst.y)-160;
    const path=svgEl('path',{d:`M${n.x},${n.y} Q${mx},${my} ${dst.x},${dst.y}`,fill:'none',stroke:'#9AFF00','stroke-width':4,'stroke-dasharray':'14 12',filter:'drop-shadow(0 0 8px #9AFF00)'});svg.append(path);
    const L=path.getTotalLength();path.setAttribute('stroke-dashoffset',L);tw(0.3+i*0.25,0.9,E.outCubic,p=>path.setAttribute('stroke-dashoffset',L*(1-p)));
    TRACKS.push(t=>{path.setAttribute('stroke-dashoffset',(-(t*40)%26));});
  });
  nodes.forEach((n,i)=>{
    const c=svgEl('circle',{cx:n.x,cy:n.y,r:0,fill:i===nodes.length-1?'#FF2D2D':'#9AFF00',filter:'drop-shadow(0 0 12px #9AFF00)'});svg.append(c);
    tw(0.15+i*0.2,0.5,E.outBack,p=>c.setAttribute('r',14*p));
    const lb=el('div','mont',{position:'absolute',left:px(n.x-60),top:px(n.y-70),width:'120px',textAlign:'center',color:'#0b0b0b',background:'#9AFF00',borderRadius:'20px',fontSize:'26px',padding:'6px 4px',opacity:0});lb.textContent=n.t;S.append(lb);
    tw(0.3+i*0.2,0.5,E.outCubic,p=>{lb.style.opacity=p;lb.style.transform=`translateY(${(1-p)*-14}px)`;});
  });
}

// GLASS news ticker with scrolling headlines
function comp_glassticker(P){ bg('red','red');
  const heads=P.items||['APPLE ЗАБЛОКИРУЕТ iPhone В РФ?','СЕРЫЙ ИМПОРТ — ВНЕ ЗАКОНА','ВСЁ ПРЕВРАТИТСЯ В КИРПИЧИ','ПАНИКА СРЕДИ ПРОДАВЦОВ'];
  const y0=340;
  heads.forEach((h,i)=>{
    const card=glassCard(200,y0+i*130,1520,100,18); S.append(card);
    const tag=el('div','mont',{position:'absolute',left:'24px',top:'50%',transform:'translateY(-50%)',background:'#FF2D2D',color:'#fff',fontSize:'26px',padding:'8px 18px',borderRadius:'8px'});tag.textContent='LIVE';
    const tx=el('div','mont wht',{position:'absolute',left:'150px',top:'50%',transform:'translateY(-50%)',fontSize:'46px'});tx.textContent=h;
    card.append(tag,tx);
    tw(0.2+i*0.22,0.55,E.outBack,p=>{card.style.opacity=p;card.style.transform=`translateX(${(1-p)*120}px)`;});
    TRACKS.push(t=>{if(t>0.4)tag.style.opacity=0.4+0.6*Math.abs(Math.sin(t*5+i));});
  });
}

// GLASS quote card
function comp_glassquote(P){ bg('lime');
  const w=1200,h=420; const card=glassCard((1920-w)/2,(1080-h)/2,w,h,28); S.append(card); autoFade(card,0.01,0.4);
  tw(0,0.6,E.outBack,p=>card.style.transform=`scale(${0.85+0.15*p})`);
  const q=el('div','osw',{position:'absolute',left:'70px',top:'40px',fontSize:'130px',color:'#9AFF00',lineHeight:0.8});q.textContent='“';card.append(q);
  const tx=el('div','osw wht',{position:'absolute',left:'80px',right:'80px',top:'130px',fontSize:'62px',lineHeight:1.15,opacity:0});tx.textContent=P.text||'';card.append(tx);
  tw(0.3,0.6,E.outCubic,p=>{tx.style.opacity=p;tx.style.transform=`translateY(${(1-p)*20}px)`;});
}

// FLOW TREE: root -> children nodes appearing connected
function comp_flowtree(P){ bg('lime');
  const items=P.items||['Apple ID','Перенос данных','Банк. приложения','Карты iCloud'];
  const rootT=P.root||'СЕРВИС ПОД КЛЮЧ';
  const svg=svgEl('svg',{width:1920,height:1080,style:'position:absolute;inset:0'}); S.append(svg);
  const rx=960,ry=250;
  const root=el('div','osw',{position:'absolute',left:px(rx-260),top:px(ry-50),width:'520px',textAlign:'center',color:'#0b0b0b',background:'#9AFF00',borderRadius:'18px',fontSize:'46px',padding:'20px',opacity:0});root.textContent=rootT;S.append(root);
  tw(0.1,0.5,E.outBack,p=>{root.style.opacity=p;root.style.transform=`scale(${0.8+0.2*p})`;});
  const n=items.length, gap=1500/n, x0=(1920-1500)/2+gap/2;
  items.forEach((it,i)=>{
    const nx=x0+i*gap, ny=640;
    const ln=svgEl('path',{d:`M${rx},${ry+60} C${rx},${ry+200} ${nx},${ny-180} ${nx},${ny-70}`,fill:'none',stroke:'#9AFF00','stroke-width':3,opacity:0});svg.append(ln);
    const L=ln.getTotalLength();ln.setAttribute('stroke-dasharray',L);ln.setAttribute('stroke-dashoffset',L);
    tw(0.4+i*0.2,0.5,E.outCubic,p=>{ln.setAttribute('stroke-dashoffset',L*(1-p));ln.setAttribute('opacity',0.8);});
    const card=el('div','mont wht',{position:'absolute',left:px(nx-140),top:px(ny-60),width:'280px',minHeight:'120px',textAlign:'center',
      background:'rgba(16,16,20,.92)',border:'2px solid #9AFF00',borderRadius:'16px',fontSize:'34px',padding:'24px 12px',display:'flex',alignItems:'center',justifyContent:'center',opacity:0});
    card.textContent=it;S.append(card);
    tw(0.55+i*0.2,0.5,E.outBack,p=>{card.style.opacity=p;card.style.transform=`translateY(${(1-p)*40}px)`;});
  });
}

// TIMELINE: 3 nodes on a line, sequential
function comp_timeline(P){ bg('lime');
  const steps=P.steps||['Apple Pay','Блок через оператора','Тёрки: RuStore'];
  const svg=svgEl('svg',{width:1920,height:1080,style:'position:absolute;inset:0'}); S.append(svg);
  const y=560,x0=340,x1=1580;
  const base=svgEl('line',{x1:x0,y1:y,x2:x1,y2:y,stroke:'rgba(255,255,255,.2)','stroke-width':4});svg.append(base);
  const prog=svgEl('line',{x1:x0,y1:y,x2:x0,y2:y,stroke:'#9AFF00','stroke-width':6,filter:'drop-shadow(0 0 8px #9AFF00)'});svg.append(prog);
  tw(0.2,1.4,E.outCubic,p=>prog.setAttribute('x2',x0+(x1-x0)*p));
  steps.forEach((s,i)=>{
    const nx=x0+(x1-x0)*(i/(steps.length-1));
    const c=svgEl('circle',{cx:nx,cy:y,r:0,fill:'#0b0b0b',stroke:'#9AFF00','stroke-width':5});svg.append(c);
    tw(0.3+i*0.45,0.4,E.outBack,p=>c.setAttribute('r',20*p));
    const lb=el('div','mont wht',{position:'absolute',left:px(nx-160),top:px(y+ (i%2?60:-150)),width:'320px',textAlign:'center',fontSize:'40px',opacity:0});lb.textContent=s;S.append(lb);
    tw(0.4+i*0.45,0.5,E.outCubic,p=>{lb.style.opacity=p;});
    const num=el('div','osw',{position:'absolute',left:px(nx-24),top:px(y-16),width:'48px',textAlign:'center',color:'#9AFF00',fontSize:'32px',opacity:0});num.textContent=i+1;S.append(num);tw(0.35+i*0.45,0.4,null,p=>num.style.opacity=p);
  });
}

// ARROWS bank — big animated directional arrows / annotation
function comp_arrows(P){ bg(P.accent==='red'?'red':'lime',P.accent);
  const acc=P.accent==='red'?'#FF2D2D':'#9AFF00'; const dir=P.dir||'down';
  const svg=svgEl('svg',{width:1920,height:1080,style:'position:absolute;inset:0'}); S.append(svg);
  const n=3;
  for(let i=0;i<n;i++){
    const ar=svgEl('path',{d:'M-60,-40 L0,40 L60,-40',fill:'none',stroke:acc,'stroke-width':22,'stroke-linecap':'round','stroke-linejoin':'round',filter:'drop-shadow(0 0 12px '+acc+')',opacity:0});
    svg.append(ar);
    TRACKS.push(t=>{const ph=(t*1.4 - i*0.28)%1.6; const yy=300+ph*260; const op=ph<0?0:(ph>1?Math.max(0,1.6-ph):1);
      ar.setAttribute('transform',`translate(960,${yy}) scale(1.4)`); ar.setAttribute('opacity',clamp(op,0,1)*0.85);});
  }
  if(P.text){const t=el('div','osw',{position:'absolute',left:0,right:0,top:'720px',textAlign:'center',fontSize:'92px',color:acc,textShadow:'0 0 30px '+acc+'55',opacity:0});t.textContent=P.text;S.append(t);tw(0.4,0.6,E.outBack,p=>{t.style.opacity=p;t.style.transform=`scale(${0.8+0.2*p})`;});}
}

// PHOTO 2.5D — premium object photo, floats + fake-3D rotateY sweep + light sweep + pill. Reads as 3D.
function comp_photo3d(P){
  const w=P.w||720,h=P.h||720; const cx=P.pos==='L'?520:1400, cy=500;
  const wrap=el('div',null,{position:'absolute',left:px(cx-w/2),top:px(cy-h/2),width:px(w),height:px(h),
    transformStyle:'preserve-3d',perspective:'1600px'});
  const card=el('div',null,{position:'absolute',inset:0,transformStyle:'preserve-3d'});
  const img=el('div',null,{position:'absolute',inset:0,backgroundImage:`url(${P.img})`,backgroundSize:'contain',
    backgroundRepeat:'no-repeat',backgroundPosition:'center',filter:'drop-shadow(0 30px 50px rgba(0,0,0,.6))'});
  const glow=el('div',null,{position:'absolute',left:'15%',top:'20%',width:'70%',height:'60%',borderRadius:'50%',
    background:'radial-gradient(circle,rgba(154,255,0,.18),transparent 70%)',filter:'blur(30px)',zIndex:-1});
  const sweep=el('div',null,{position:'absolute',inset:0,background:'linear-gradient(115deg,transparent 40%,rgba(255,255,255,.22) 50%,transparent 60%)',mixBlendMode:'screen',pointerEvents:'none'});
  card.append(glow,img,sweep); wrap.append(card); S.append(wrap);
  const dir=P.pos==='L'?-1:1;
  tw(0,0.7,E.outBack,p=>{wrap.style.opacity=p;});
  TRACKS.push(t=>{
    const ry=Math.sin(t*0.7)*16; const rx=Math.cos(t*0.5)*5;
    const fy=Math.sin(t*1.1)*10; const p=clamp(t/0.7,0,1);
    card.style.transform=`translateY(${fy + (1-p)*60}px) rotateY(${ry* (0.3+0.7*p)}deg) rotateX(${rx}deg) scale(${0.85+0.15*p})`;
    sweep.style.transform=`translateX(${(Math.sin(t*0.9)*0.5+0.5)*w-w/2}px)`;
  });
  outFade(wrap);
  if(P.pill){pillLabel(S,P.pill,cx,cy-h/2+20,'#9AFF00');}
}
