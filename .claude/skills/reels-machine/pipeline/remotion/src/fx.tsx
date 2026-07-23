import React from "react";
import { AbsoluteFill, useCurrentFrame, useVideoConfig, interpolate, spring, Easing } from "remotion";
import { LIME, MONT, BEBAS } from "./mograph";

const E = Easing.bezier(0.16, 1, 0.3, 1);
export const GLOW = `0 0 10px ${LIME}, 0 0 30px ${LIME}aa, 0 0 70px ${LIME}66`;
const card = (op=1): React.CSSProperties => ({background:"linear-gradient(155deg,#141414ee,#0a0a0aee)",border:`1.5px solid ${LIME}55`,borderRadius:26,boxShadow:`0 26px 70px #000c, 0 0 50px ${LIME}22`,backdropFilter:"blur(3px)"});

// ---------- SVG-иконки (лайм, рисуются) ----------
const paths: Record<string,string> = {
  chat: "M20 62 V30 a8 8 0 0 1 8-8 h44 a8 8 0 0 1 8 8 v28 a8 8 0 0 1-8 8 H40 L20 82 Z",
  ai:   "M50 18 a14 14 0 0 1 14 14 a14 14 0 0 1 8 12 a13 13 0 0 1-8 22 a14 14 0 0 1-14 8 a14 14 0 0 1-14-8 a13 13 0 0 1-8-22 a14 14 0 0 1 8-12 a14 14 0 0 1 14-14 Z M50 20 V80 M28 44 H72 M32 66 H68",
  chart:"M22 78 H82 M22 78 V22 M34 66 L48 50 L60 58 L80 30 M80 30 H66 M80 30 V44",
  coin: "M50 20 a30 30 0 1 0 0 60 a30 30 0 0 0 0-60 M50 34 v32 M42 42 h12 a6 6 0 0 1 0 12 h-12 M42 54 h14",
  shield:"M50 16 L80 28 V52 c0 18-14 28-30 34 c-16-6-30-16-30-34 V28 Z M38 50 l9 9 l18-20",
  rocket:"M50 14 c14 10 20 26 20 42 l-10 10 h-20 l-10-10 c0-16 6-32 20-42 Z M50 40 a6 6 0 1 0 0.1 0 M40 66 l-10 16 M60 66 l10 16 M45 82 h10",
  click:"M40 30 V64 M40 30 a6 6 0 0 1 12 0 v22 M52 46 a6 6 0 0 1 12 0 v10 M64 50 a6 6 0 0 1 12 0 v14 c0 14-10 22-24 22 h-6 c-8 0-12-4-18-12 l-10-14 a7 7 0 0 1 11-8 l6 6",
  cert: "M50 20 a24 24 0 1 0 0.1 0 M50 32 l5 10 l11 1 l-8 8 l2 11 l-10-6 l-10 6 l2-11 l-8-8 l11-1 Z M38 66 l-4 20 l16-8 l16 8 l-4-20",
  play: "M20 24 h60 a6 6 0 0 1 6 6 v40 a6 6 0 0 1-6 6 H20 a6 6 0 0 1-6-6 V30 a6 6 0 0 1 6-6 Z M42 40 v20 l18-10 Z",
};
export const Icon: React.FC<{name:string; size?:number; delay?:number; color?:string; sw?:number}> = ({name,size=64,delay=0,color=LIME,sw=4}) => {
  const f=useCurrentFrame();
  const p=interpolate(f-delay,[0,16],[0,1],{extrapolateLeft:"clamp",extrapolateRight:"clamp",easing:E});
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" style={{filter:`drop-shadow(0 0 10px ${color}aa)`}}>
      <path d={paths[name]} fill="none" stroke={color} strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round"
        pathLength={1} strokeDasharray={1} strokeDashoffset={1-p}/>
    </svg>
  );
};

// ---------- счётчик денег (тикает вверх) ----------
export const CostCounter: React.FC = () => {
  const f=useCurrentFrame(); const {fps}=useVideoConfig();
  const sp=spring({frame:f,fps,config:{damping:200,mass:0.6}});
  const val=Math.round(interpolate(sp,[0,1],[0,247000]));
  const enter=interpolate(f,[0,10],[0,1],{extrapolateRight:"clamp",easing:E});
  const out=interpolate(f,[120,140],[1,0],{extrapolateLeft:"clamp",extrapolateRight:"clamp"});
  const shake=Math.sin(f/2)*interpolate(f,[20,60],[3,0],{extrapolateLeft:"clamp",extrapolateRight:"clamp"});
  return (
    <AbsoluteFill style={{alignItems:"center",justifyContent:"flex-start",paddingTop:430,opacity:enter*out}}>
      <div style={{...card(),padding:"30px 46px",textAlign:"center",transform:`translateX(${shake}px) scale(${0.9+enter*0.1})`}}>
        <div style={{fontFamily:MONT,fontWeight:800,color:"#ff5964",fontSize:30,letterSpacing:4}}>ТЫ ПЛАТИШЬ КАЖДЫЙ МЕСЯЦ</div>
        <div style={{fontFamily:BEBAS,color:"#fff",fontSize:150,lineHeight:0.9,marginTop:6,textShadow:"0 0 30px #ff596488"}}>{val.toLocaleString("ru-RU")} <span style={{color:"#ff5964"}}>₽</span></div>
        <div style={{display:"flex",gap:14,justifyContent:"center",marginTop:14}}>
          {[0,1,2,3,4].map(i=>{const s=spring({frame:f-14-i*4,fps,config:{damping:12,stiffness:170}});
            return <div key={i} style={{width:64,height:64,borderRadius:16,background:"#1c1c1c",border:"1px solid #ffffff22",opacity:s,transform:`translateY(${(1-s)*30}px) scale(${0.6+s*0.4})`,display:"flex",alignItems:"center",justifyContent:"center"}}>
              <div style={{width:30,height:30,borderRadius:8,background:`hsl(${i*60},70%,55%)`}}/></div>;})}
          <div style={{fontFamily:BEBAS,color:LIME,fontSize:60,alignSelf:"center",marginLeft:4}}>×5</div>
        </div>
      </div>
    </AbsoluteFill>
  );
};

// ---------- «всё в одном»: 5 точек сходятся в лого-карту ----------
export const Converge: React.FC = () => {
  const f=useCurrentFrame(); const {fps}=useVideoConfig();
  const merge=interpolate(f,[0,26],[1,0],{extrapolateRight:"clamp",easing:E});
  const pop=spring({frame:f-24,fps,config:{damping:11,stiffness:150}});
  return (
    <AbsoluteFill style={{alignItems:"center",justifyContent:"center"}}>
      {[0,1,2,3,4].map(i=>{const a=(i/5)*Math.PI*2; const R=300*merge;
        return <div key={i} style={{position:"absolute",width:34,height:34,borderRadius:10,background:`hsl(${i*60},70%,55%)`,transform:`translate(${Math.cos(a)*R}px,${Math.sin(a)*R}px)`,opacity:merge,boxShadow:`0 0 20px hsl(${i*60},70%,55%)`}}/>;})}
      <div style={{transform:`scale(${pop})`,opacity:pop}}>
        <div style={{...card(),width:220,height:220,borderRadius:52,display:"flex",alignItems:"center",justifyContent:"center",border:`2px solid ${LIME}`,boxShadow:GLOW}}>
          <div style={{fontFamily:MONT,fontWeight:900,color:"#fff",fontSize:60}}>OKO<span style={{color:LIME}}>.</span></div>
        </div>
      </div>
    </AbsoluteFill>
  );
};

// ---------- стакающиеся чипы-фичи ----------
const FEAT=[{n:"chat",t:"МЕССЕНДЖЕР"},{n:"ai",t:"НЕЙРОСЕТИ"},{n:"chart",t:"ПРОДВИЖЕНИЕ"},{n:"coin",t:"ЗАРАБОТОК"}];
export const FeaturePills: React.FC<{step:number}> = ({step}) => {
  const f=useCurrentFrame(); const {fps}=useVideoConfig();
  return (
    <AbsoluteFill style={{alignItems:"center",justifyContent:"center",paddingBottom:120}}>
      <div style={{display:"flex",flexDirection:"column",gap:20}}>
        {FEAT.map((ft,i)=>{const s=spring({frame:f-i*step,fps,config:{damping:13,stiffness:150}});
          if(f<i*step) return <div key={i} style={{height:110,opacity:0}}/>;
          return <div key={i} style={{...card(),display:"flex",alignItems:"center",gap:26,padding:"0 40px",height:110,width:640,opacity:s,transform:`translateX(${(1-s)*-120}px) scale(${0.8+s*0.2})`}}>
            <div style={{width:74,height:74,borderRadius:18,background:"#0f0f0f",border:`1px solid ${LIME}44`,display:"flex",alignItems:"center",justifyContent:"center"}}><Icon name={ft.n} size={50} delay={i*step+4}/></div>
            <div style={{fontFamily:MONT,fontWeight:800,color:"#fff",fontSize:52,letterSpacing:1}}>{ft.t}</div>
            <div style={{marginLeft:"auto",fontFamily:BEBAS,color:LIME,fontSize:44,textShadow:GLOW}}>✓</div>
          </div>;})}
      </div>
    </AbsoluteFill>
  );
};

// ---------- разблокировка: ВПН/блокировки/ограничения → сняты ----------
const LOCKS=["БЕЗ ВПН","БЕЗ БЛОКИРОВОК","БЕЗ ОГРАНИЧЕНИЙ"];
export const UnlockRow: React.FC<{step:number}> = ({step}) => {
  const f=useCurrentFrame(); const {fps}=useVideoConfig();
  return (
    <AbsoluteFill style={{alignItems:"center",justifyContent:"center"}}>
      <div style={{display:"flex",flexDirection:"column",gap:24,alignItems:"center"}}>
        {LOCKS.map((t,i)=>{const s=spring({frame:f-i*step,fps,config:{damping:13,stiffness:150}});
          if(f<i*step) return <div key={i} style={{height:96,opacity:0}}/>;
          const chk=interpolate(f-i*step,[6,18],[0,1],{extrapolateLeft:"clamp",extrapolateRight:"clamp",easing:E});
          return <div key={i} style={{...card(),display:"flex",alignItems:"center",gap:22,padding:"0 36px",height:96,width:760,opacity:s,transform:`translateY(${(1-s)*40}px) scale(${0.85+s*0.15})`}}>
            <Icon name="shield" size={54} delay={i*step+2}/>
            <div style={{fontFamily:MONT,fontWeight:800,color:"#fff",fontSize:44,letterSpacing:1,whiteSpace:"nowrap"}}>{t}</div>
            <div style={{marginLeft:"auto",width:56,height:56,borderRadius:"50%",background:LIME,display:"flex",alignItems:"center",justifyContent:"center",boxShadow:GLOW,transform:`scale(${chk})`}}>
              <svg width="34" height="34" viewBox="0 0 34 34"><path d="M8 18 l6 6 l12-14" fill="none" stroke="#050505" strokeWidth={5} strokeLinecap="round" strokeLinejoin="round"/></svg>
            </div>
          </div>;})}
      </div>
    </AbsoluteFill>
  );
};

// ---------- «1 клик»: кнопка нажимается, тайлы вылетают ----------
export const ClickUI: React.FC = () => {
  const f=useCurrentFrame(); const {fps}=useVideoConfig();
  const press=Math.max(0, Math.sin(interpolate(f,[10,34],[0,Math.PI],{extrapolateRight:"clamp"})));
  const enter=spring({frame:f,fps,config:{damping:14}});
  return (
    <AbsoluteFill style={{alignItems:"center",justifyContent:"center"}}>
      <div style={{opacity:enter,transform:`translateY(${(1-enter)*60}px)`,textAlign:"center"}}>
        <div style={{position:"relative",height:220}}>
          {[0,1,2,3,4,5].map(i=>{const t=interpolate(f,[24,60],[0,1],{extrapolateLeft:"clamp",extrapolateRight:"clamp",easing:E});
            const a=(i/6)*Math.PI*2; const R=t*260;
            return <div key={i} style={{position:"absolute",left:"50%",top:80,width:70,height:96,marginLeft:-35,borderRadius:14,background:"linear-gradient(160deg,#1a1a1a,#0d0d0d)",border:`1px solid ${LIME}55`,opacity:t*(1-t*0.3),transform:`translate(${Math.cos(a)*R}px,${Math.sin(a)*R-40}px) rotate(${a}rad) scale(${0.6+t*0.4})`,boxShadow:`0 0 20px ${LIME}33`}}><div style={{position:"absolute",inset:0,background:`radial-gradient(circle at 40% 30%,${LIME}22,transparent 60%)`}}/></div>;})}
        </div>
        <div style={{display:"inline-flex",alignItems:"center",gap:20,padding:"26px 56px",borderRadius:70,background:LIME,color:"#050505",fontFamily:MONT,fontWeight:900,fontSize:56,letterSpacing:2,boxShadow:GLOW,transform:`scale(${1-press*0.06})`}}>
          <Icon name="click" size={54} color="#050505" sw={5}/> В 1 КЛИК
        </div>
      </div>
    </AbsoluteFill>
  );
};

// ---------- рисующийся график дохода + счётчик ----------
export const IncomeGraph: React.FC = () => {
  const f=useCurrentFrame(); const {fps}=useVideoConfig();
  const draw=interpolate(f,[6,54],[0,1],{extrapolateLeft:"clamp",extrapolateRight:"clamp",easing:E});
  const enter=spring({frame:f,fps,config:{damping:16}});
  const pts=[[40,300],[130,270],[220,250],[310,200],[400,150],[500,90],[600,30]];
  const d=`M ${pts.map(p=>p.join(" ")).join(" L ")}`;
  const area=`${d} L 600 340 L 40 340 Z`;
  const val=Math.round(interpolate(draw,[0,1],[0,50000]));
  const headX=interpolate(draw,[0,1],[40,600]); const headY=interpolate(draw,[0,1],[300,30]);
  return (
    <AbsoluteFill style={{alignItems:"center",justifyContent:"center"}}>
      <div style={{...card(),padding:"32px 36px",opacity:enter,transform:`translateY(${(1-enter)*50}px)`}}>
        <div style={{display:"flex",alignItems:"baseline",gap:14,marginBottom:8}}>
          <div style={{fontFamily:MONT,fontWeight:800,color:"#fff",fontSize:34}}>ДОХОД</div>
          <div style={{fontFamily:BEBAS,color:LIME,fontSize:88,textShadow:GLOW}}>+{val.toLocaleString("ru-RU")} ₽</div>
        </div>
        <svg width={640} height={360} viewBox="0 0 640 360">
          <defs><linearGradient id="ag" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor={LIME} stopOpacity="0.5"/><stop offset="1" stopColor={LIME} stopOpacity="0"/></linearGradient></defs>
          <path d={area} fill="url(#ag)" opacity={draw}/>
          <path d={d} fill="none" stroke={LIME} strokeWidth={6} strokeLinecap="round" strokeLinejoin="round" pathLength={1} strokeDasharray={1} strokeDashoffset={1-draw} style={{filter:`drop-shadow(0 0 10px ${LIME})`}}/>
          <circle cx={headX} cy={headY} r={10} fill="#fff" style={{filter:`drop-shadow(0 0 12px ${LIME})`}}/>
        </svg>
      </div>
    </AbsoluteFill>
  );
};

// ---------- цена 0₽ / БЕСПЛАТНО штамп ----------
export const PriceFree: React.FC = () => {
  const f=useCurrentFrame(); const {fps}=useVideoConfig();
  const s1=spring({frame:f,fps,config:{damping:14}});
  const strike=interpolate(f,[16,30],[0,1],{extrapolateLeft:"clamp",extrapolateRight:"clamp",easing:E});
  const stamp=spring({frame:f-26,fps,config:{damping:8,stiffness:130}});
  return (
    <AbsoluteFill style={{alignItems:"center",justifyContent:"center"}}>
      <div style={{textAlign:"center",opacity:s1}}>
        <div style={{position:"relative",display:"inline-block"}}>
          <div style={{fontFamily:BEBAS,color:"#9a9a9a",fontSize:120}}>19 990 ₽</div>
          <div style={{position:"absolute",top:"52%",left:0,height:8,background:"#ff5964",width:`${strike*100}%`,borderRadius:4,boxShadow:"0 0 12px #ff5964"}}/>
        </div>
        <div style={{marginTop:10,fontFamily:MONT,fontWeight:900,color:"#050505",background:LIME,display:"inline-block",padding:"16px 44px",borderRadius:20,fontSize:70,letterSpacing:3,transform:`scale(${stamp}) rotate(${interpolate(stamp,[0,1],[-8,-3])}deg)`,boxShadow:GLOW}}>БЕСПЛАТНО</div>
      </div>
    </AbsoluteFill>
  );
};

// ---------- сертификат-печать ----------
export const CertBadge: React.FC = () => {
  const f=useCurrentFrame(); const {fps}=useVideoConfig();
  const pop=spring({frame:f,fps,config:{damping:10,stiffness:140}});
  const ring=interpolate(f,[4,42],[0,1],{extrapolateLeft:"clamp",extrapolateRight:"clamp",easing:E});
  const star=interpolate(f,[14,34],[0,1],{extrapolateLeft:"clamp",extrapolateRight:"clamp",easing:E});
  return (
    <AbsoluteFill style={{alignItems:"center",justifyContent:"center"}}>
      <div style={{display:"flex",flexDirection:"column",alignItems:"center",gap:26,transform:`scale(${pop})`,opacity:pop}}>
        <svg width={280} height={280} viewBox="0 0 100 100">
          <circle cx="50" cy="50" r="38" fill="#0d0d0dcc" stroke={LIME} strokeWidth={3} pathLength={1} strokeDasharray={1} strokeDashoffset={1-ring} style={{filter:`drop-shadow(0 0 14px ${LIME})`}}/>
          <circle cx="50" cy="50" r="30" fill="none" stroke={`${LIME}55`} strokeWidth={1.4}/>
          <path d="M50 30 l6 12 l13 2 l-9.5 9 l2.5 13 l-12-7 l-12 7 l2.5-13 l-9.5-9 l13-2 Z" fill={LIME} opacity={star} style={{filter:`drop-shadow(0 0 10px ${LIME})`,transformOrigin:"50px 50px",transform:`scale(${star})`}}/>
        </svg>
        <div style={{textAlign:"center"}}>
          <div style={{fontFamily:BEBAS,color:LIME,fontSize:70,letterSpacing:3,textShadow:GLOW,lineHeight:0.9}}>СЕРТИФИКАТ</div>
          <div style={{fontFamily:MONT,fontWeight:800,color:"#fff",fontSize:32,opacity:0.85,marginTop:6}}>официальный документ</div>
        </div>
      </div>
    </AbsoluteFill>
  );
};

// ---------- субтитры: маркер-вайп по ключевым словам ----------
export const CaptionBox: React.FC<{words:{t:string;s:number;e:number}[]; isKey:(w:string)=>boolean; bottom?:number}> = ({words,isKey,bottom=356}) => {
  const f=useCurrentFrame(); const {fps}=useVideoConfig(); const t=f/fps;
  const idx=words.findIndex(w=>t>=w.s-0.04 && t<w.e+0.12);
  if(idx<0) return null;
  const cur=words[idx];
  const local=f-(cur.s-0.04)*fps;
  const blur=interpolate(local,[0,4],[10,0],{extrapolateRight:"clamp",easing:E});
  const pop=interpolate(local,[0,5],[0.82,1],{extrapolateRight:"clamp",easing:E});
  const key=isKey(cur.t);
  const wipe=interpolate(local,[1,7],[0,1],{extrapolateLeft:"clamp",extrapolateRight:"clamp",easing:E});
  const txt=cur.t.replace(/[—]/g,"").toUpperCase();
  const fs=Math.min(78,Math.floor(880/(txt.length*0.58)));
  return (
    <div style={{position:"absolute",bottom,width:"100%",textAlign:"center",padding:"0 70px"}}>
      <div style={{position:"relative",display:"inline-block",transform:`scale(${pop})`,filter:`blur(${blur}px)`}}>
        {/* лаймовый маркер-хайлайт (вайпается слева-направо) под ключевым словом */}
        {key && <div style={{position:"absolute",left:-14,top:"14%",height:"74%",width:`calc(${wipe*100}% + 28px)`,background:LIME,borderRadius:8,boxShadow:`0 0 24px ${LIME}88`,zIndex:0}}/>}
        <span style={{position:"relative",zIndex:1,fontFamily:MONT,fontWeight:900,fontSize:fs,letterSpacing:0.5,lineHeight:1.05,
          color:key?"#050505":"#fff",textShadow:key?"none":"0 4px 16px #000f, 0 1px 3px #000",WebkitTextStroke:key?"0":"0"}}>{txt}</span>
      </div>
    </div>
  );
};
