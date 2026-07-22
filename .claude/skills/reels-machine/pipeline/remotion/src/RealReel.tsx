import React from "react";
import { AbsoluteFill, OffthreadVideo, Img, staticFile, useCurrentFrame, useVideoConfig, interpolate, Easing, Sequence } from "remotion";
import { LIME, MONT, BEBAS } from "./mograph";
import { FONT_CSS } from "./fonts";
import WORDS from "./words2.json";

const E = Easing.bezier(0.16, 1, 0.3, 1);
const NEON = `0 0 8px ${LIME}, 0 0 22px ${LIME}, 0 0 50px ${LIME}cc, 0 0 100px ${LIME}88`;
const KEY = ["приложений","приложение","мессенджер","нейросети","продвижение","заработок","впн","блокировок","ограничений","клик","обучение","сертификат","доход","ок","ока","око","всё","все","ссылке","бесплатно","бесплатное","одном","тысяч"];
const norm = (w:string)=>w.toLowerCase().replace(/[.,!?—:]/g,"");
const isKey = (w:string)=>KEY.includes(norm(w));

// ================= один рез: живой футаж + zoom-punch + грейд =================
const Shot: React.FC<{clip:string; len:number; dir:number}> = ({clip,len,dir}) => {
  const f = useCurrentFrame();
  const punch = interpolate(f,[0,7],[1.16,1.0],{extrapolateRight:"clamp",easing:E});
  const drift = interpolate(f,[0,len],[1.0,1.07],{extrapolateRight:"clamp"});
  const px = interpolate(f,[0,len],[dir*-26,dir*26],{extrapolateRight:"clamp"});
  const py = interpolate(f,[0,len],[dir*10,dir*-10],{extrapolateRight:"clamp"});
  return (
    <AbsoluteFill style={{overflow:"hidden",backgroundColor:"#050505"}}>
      <OffthreadVideo src={staticFile(clip)} muted
        style={{width:"100%",height:"100%",objectFit:"cover",transform:`scale(${punch*drift}) translate(${px}px,${py}px)`,filter:"contrast(1.15) saturate(1.2) brightness(0.9)"}}/>
      <AbsoluteFill style={{background:LIME,mixBlendMode:"overlay",opacity:0.08}}/>
      <AbsoluteFill style={{background:"linear-gradient(180deg,rgba(5,5,5,.5),transparent 26%,transparent 52%,rgba(5,5,5,.55) 78%,rgba(5,5,5,.95))"}}/>
      <AbsoluteFill style={{boxShadow:"inset 0 0 300px rgba(0,0,0,.85)"}}/>
    </AbsoluteFill>
  );
};

const Flash: React.FC = () => { const f=useCurrentFrame();
  const o=interpolate(f,[0,2,6],[0,0.5,0],{extrapolateRight:"clamp"});
  return <AbsoluteFill style={{background:`radial-gradient(circle at 50% 45%, #fff, ${LIME}00 60%)`,opacity:o,mixBlendMode:"screen"}}/>;
};

const Leak: React.FC<{clip:string}> = ({clip}) => {
  const f=useCurrentFrame(); const {durationInFrames}=useVideoConfig();
  const o=interpolate(f,[0,durationInFrames/2,durationInFrames],[0,0.55,0]);
  return <AbsoluteFill style={{opacity:o,mixBlendMode:"screen"}}><OffthreadVideo src={staticFile(clip)} muted style={{width:"100%",height:"100%",objectFit:"cover"}}/></AbsoluteFill>;
};

const Grain: React.FC = () => { const f=useCurrentFrame();
  return <AbsoluteFill style={{opacity:0.05,mixBlendMode:"overlay",backgroundImage:`repeating-radial-gradient(circle at ${(f*7)%100}% ${(f*13)%100}%, #fff 0 1px, transparent 1px 3px)`}}/>;
};

const Karaoke: React.FC = () => {
  const f=useCurrentFrame(); const {fps}=useVideoConfig(); const t=f/fps;
  const cur=(WORDS as any[]).find(w=>t>=w.s-0.04 && t<w.e+0.12);
  if(!cur) return null;
  const local=f-(cur.s-0.04)*fps;
  const pop=interpolate(local,[0,4],[0.68,1],{extrapolateRight:"clamp",easing:E});
  const rise=interpolate(local,[0,5],[26,0],{extrapolateRight:"clamp",easing:E});
  const key=isKey(cur.t);
  const txt=cur.t.replace(/[—]/g,"").toUpperCase();
  const fs=key?Math.min(126,Math.floor(980/(txt.length*0.64))):Math.min(92,Math.floor(940/(txt.length*0.56)));
  return (
    <div style={{position:"absolute",bottom:452,width:"100%",textAlign:"center",padding:"0 46px"}}>
      <div style={{display:"inline-block",whiteSpace:"nowrap",fontFamily:key?BEBAS:MONT,fontWeight:key?400:800,fontSize:fs,color:key?LIME:"#fff",letterSpacing:key?2:0.5,lineHeight:0.92,transform:`translateY(${rise}px) scale(${pop})`,textShadow:key?NEON:"0 6px 24px #000e, 0 2px 5px #000",WebkitTextStroke:key?`1.5px ${LIME}`:"0"}}>{txt}</div>
    </div>
  );
};

const Header: React.FC = () => (<>
  <Img src={staticFile("logo.png")} style={{position:"absolute",top:56,left:52,width:74,filter:`drop-shadow(0 0 14px ${LIME})`}}/>
  <div style={{position:"absolute",top:71,left:140,fontFamily:MONT,color:"#fff",fontWeight:800,fontSize:30,letterSpacing:2}}>OKO<span style={{color:LIME}}>.</span></div>
</>);

const EndCard: React.FC = () => { const f=useCurrentFrame();
  const s=interpolate(f,[0,18],[0.62,1],{extrapolateRight:"clamp",easing:E});
  const o=interpolate(f,[2,16],[0,1],{extrapolateRight:"clamp"});
  const pulse=1+Math.sin(f/9)*0.028;
  const ctaGlow=0.6+0.4*Math.sin(f/7);
  return (
    <AbsoluteFill style={{backgroundColor:"#050505",alignItems:"center",justifyContent:"center",overflow:"hidden"}}>
      <Img src={staticFile("flux/ai.webp")} style={{position:"absolute",width:"100%",height:"100%",objectFit:"cover",filter:"brightness(0.42) saturate(1.15) blur(2px)",transform:`scale(${1.08+f*0.0009})`}}/>
      <AbsoluteFill style={{background:`radial-gradient(circle at 50% 44%, ${LIME}26, transparent 56%)`}}/>
      <AbsoluteFill style={{background:"linear-gradient(180deg,rgba(5,5,5,.4),transparent 40%,rgba(5,5,5,.85))"}}/>
      <div style={{textAlign:"center",transform:`scale(${s*pulse})`,opacity:o}}>
        <Img src={staticFile("logo.png")} style={{width:210,filter:`drop-shadow(0 0 60px ${LIME})`}}/>
        <div style={{fontFamily:BEBAS,color:"#fff",fontSize:196,letterSpacing:10,marginTop:4,textShadow:`0 0 40px ${LIME}55`}}>OKO</div>
        <div style={{fontFamily:MONT,fontWeight:800,color:"#fff",fontSize:38,letterSpacing:3,opacity:0.85,marginTop:-6}}>ПЕРВОЕ ПРИЛОЖЕНИЕ, ГДЕ ЕСТЬ <span style={{color:LIME}}>ВСЁ</span></div>
        <div style={{marginTop:34,display:"inline-block",padding:"20px 52px",borderRadius:60,background:LIME,color:"#050505",fontFamily:MONT,fontWeight:900,fontSize:44,letterSpacing:2,boxShadow:`0 0 ${40*ctaGlow}px ${LIME}, 0 20px 50px #000a`}}>ПЕРЕХОДИ ПО ССЫЛКЕ</div>
      </div>
    </AbsoluteFill>
  );
};

// ================= шот-лист, синхрон по битам голоса (fps=30) =================
const SHOTS:[string,number,number,number][] = [
  ["v/c17.mp4",   0,  26, 1],
  ["v/c03.mp4",  26,  47,-1],
  ["v/c02.mp4",  47,  90, 1],
  ["v/c11.mp4",  90, 122,-1],
  ["v/c01.mp4", 122, 153, 1],
  ["v/c15.mp4", 153, 187,-1],
  ["v/c09.mp4", 187, 214, 1],
  ["v/c04.mp4", 214, 238,-1],
  ["v/c05.mp4", 238, 266, 1],
  ["v/c11.mp4", 266, 289,-1],
  ["v/c14.mp4", 289, 311, 1],
  ["v/c06.mp4", 311, 342,-1],
  ["v/c12.mp4", 342, 376, 1],
  ["v/c13.mp4", 376, 406,-1],
  ["v/c07.mp4", 406, 434, 1],
  ["v/c10.mp4", 434, 472,-1],
  ["v/c16.mp4", 472, 505, 1],
  ["v/c18.mp4", 505, 555,-1],
];
const END_START = 555;
export const REAL_TOTAL = 735;
const CUTS = SHOTS.map(s=>s[1]);
const LEAK_CUTS = [187, 342, 505];

export const RealReel: React.FC = () => {
  const f=useCurrentFrame();
  return (
    <AbsoluteFill style={{backgroundColor:"#050505"}}>
      <style dangerouslySetInnerHTML={{__html:FONT_CSS}}/>
      {SHOTS.map(([clip,st,en,dir],i)=>(
        <Sequence key={i} from={st} durationInFrames={en-st}>
          <Shot clip={clip} len={en-st} dir={dir}/>
        </Sequence>
      ))}
      <Sequence from={END_START} durationInFrames={REAL_TOTAL-END_START}><EndCard/></Sequence>

      {LEAK_CUTS.map((c,i)=><Sequence key={i} from={c-6} durationInFrames={16}><Leak clip={`ov/o${(i%3)+1}.mp4`}/></Sequence>)}
      {CUTS.concat([END_START]).map((c,i)=><Sequence key={i} from={c-1} durationInFrames={7}><Flash/></Sequence>)}

      <Grain/>
      {f<END_START && <Karaoke/>}
      {f<END_START && <Header/>}
      <div style={{position:"absolute",bottom:0,left:0,height:5,width:`${interpolate(f,[0,REAL_TOTAL],[0,100],{extrapolateRight:"clamp"})}%`,background:LIME,boxShadow:`0 0 16px ${LIME}`}}/>
    </AbsoluteFill>
  );
};
