import React from "react";
import { AbsoluteFill, OffthreadVideo, Img, staticFile, useCurrentFrame, useVideoConfig, interpolate, Easing, Sequence, Loop } from "remotion";
import { LIME, MONT, BEBAS } from "./mograph";
import { FONT_CSS } from "./fonts";
import WORDS from "./words2.json";
import { CostCounter, Converge, FeaturePills, UnlockRow, ClickUI, IncomeGraph, PriceFree, CertBadge, CaptionBox } from "./fx";
import { ScreenFX, TransitionFX, LottieAsset, AnimBG } from "./fx2";

const E = Easing.bezier(0.16, 1, 0.3, 1);
const KEY = ["приложений","приложение","мессенджер","нейросети","продвижение","заработок","впн","блокировок","ограничений","клик","обучение","сертификат","доход","ок","ока","око","всё","все","ссылке","бесплатно","бесплатное","одном","тысяч"];
const norm = (w:string)=>w.toLowerCase().replace(/[.,!?—:]/g,"");
const isKey = (w:string)=>KEY.includes(norm(w));

// ================= один рез: живой футаж + zoom-punch + грейд =================
const Shot: React.FC<{clip:string; len:number; dir:number}> = ({clip,len,dir}) => {
  const f = useCurrentFrame();
  const punch = interpolate(f,[0,7],[1.18,1.02],{extrapolateRight:"clamp",easing:E});
  const drift = interpolate(f,[0,len],[1.0,1.08],{extrapolateRight:"clamp"});
  const px = interpolate(f,[0,len],[dir*-30,dir*30],{extrapolateRight:"clamp"});
  const py = interpolate(f,[0,len],[dir*12,dir*-12],{extrapolateRight:"clamp"});
  return (
    <AbsoluteFill style={{overflow:"hidden",backgroundColor:"#050505"}}>
      <OffthreadVideo src={staticFile(clip)} muted
        style={{width:"100%",height:"100%",objectFit:"cover",transform:`scale(${punch*drift}) translate(${px}px,${py}px)`,filter:"contrast(1.16) saturate(1.22) brightness(0.84)"}}/>
      <AbsoluteFill style={{background:LIME,mixBlendMode:"overlay",opacity:0.08}}/>
      <AbsoluteFill style={{boxShadow:"inset 0 0 320px rgba(0,0,0,.9)"}}/>
    </AbsoluteFill>
  );
};

const Grain: React.FC = () => { const f=useCurrentFrame();
  return <AbsoluteFill style={{opacity:0.045,mixBlendMode:"overlay",backgroundImage:`repeating-radial-gradient(circle at ${(f*7)%100}% ${(f*13)%100}%, #fff 0 1px, transparent 1px 3px)`}}/>;
};

const Header: React.FC = () => (<>
  <Img src={staticFile("logo.png")} style={{position:"absolute",top:56,left:52,width:70,filter:`drop-shadow(0 0 14px ${LIME})`}}/>
  <div style={{position:"absolute",top:70,left:134,fontFamily:MONT,color:"#fff",fontWeight:800,fontSize:28,letterSpacing:2}}>OKO<span style={{color:LIME}}>.</span></div>
</>);

const EndCard: React.FC = () => { const f=useCurrentFrame();
  const s=interpolate(f,[0,18],[0.62,1],{extrapolateRight:"clamp",easing:E});
  const o=interpolate(f,[2,16],[0,1],{extrapolateRight:"clamp"});
  const pulse=1+Math.sin(f/9)*0.028;
  const ctaGlow=0.6+0.4*Math.sin(f/7);
  return (
    <AbsoluteFill style={{backgroundColor:"#050505",alignItems:"center",justifyContent:"center",overflow:"hidden"}}>
      <Img src={staticFile("flux/ai.webp")} style={{position:"absolute",width:"100%",height:"100%",objectFit:"cover",filter:"brightness(0.4) saturate(1.15) blur(2px)",transform:`scale(${1.08+f*0.0009})`}}/>
      {/* реальные ассеты на финале: дым + боке + лайт-лик */}
      <Loop durationInFrames={120} layout="none"><AbsoluteFill style={{opacity:0.5,mixBlendMode:"screen"}}><OffthreadVideo src={staticFile("fx/smoke.mp4")} muted style={{width:"100%",height:"100%",objectFit:"cover"}}/></AbsoluteFill></Loop>
      <Loop durationInFrames={150} layout="none"><AbsoluteFill style={{opacity:0.4,mixBlendMode:"screen"}}><OffthreadVideo src={staticFile("fx/bokeh.mp4")} muted style={{width:"100%",height:"100%",objectFit:"cover"}}/></AbsoluteFill></Loop>
      <AbsoluteFill style={{background:`radial-gradient(circle at 50% 44%, ${LIME}26, transparent 56%)`}}/>
      <AbsoluteFill style={{background:"linear-gradient(180deg,rgba(5,5,5,.42),transparent 40%,rgba(5,5,5,.86))"}}/>
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
  ["v/c17.mp4",   0,  26, 1],["v/c03.mp4",  26,  47,-1],["v/c02.mp4",  47,  90, 1],
  ["v/c11.mp4",  90, 122,-1],["v/c01.mp4", 122, 153, 1],["v/c15.mp4", 153, 187,-1],
  ["v/c09.mp4", 187, 214, 1],["v/c04.mp4", 214, 238,-1],["v/c05.mp4", 238, 266, 1],
  ["v/c11.mp4", 266, 289,-1],["v/c14.mp4", 289, 311, 1],["v/c06.mp4", 311, 342,-1],
  ["v/c12.mp4", 342, 376, 1],["v/c13.mp4", 376, 406,-1],["v/c07.mp4", 406, 434, 1],
  ["v/c10.mp4", 434, 472,-1],["v/c16.mp4", 472, 505, 1],["v/c18.mp4", 505, 555,-1],
];
const END_START = 555;
export const REAL_TOTAL = 735;
const CUTS = SHOTS.map(s=>s[1]);

// моушен-графика поверх футажа: [компонент, старт, длит, props]
const OVER: [React.FC<any>, number, number, any][] = [
  [CostCounter,   6, 112, {}],[Converge,    120,  66, {}],
  [FeaturePills,187, 104, {step:26}],[UnlockRow,   289,  87, {step:26}],
  [ClickUI,     376,  58, {}],[PriceFree,   434,  38, {}],
  [CertBadge,   472,  33, {}],[IncomeGraph, 505,  50, {}],
];

// РЕАЛЬНЫЕ переходы-ассеты на крупных стыках: [кадр, клип]
const TRANS: [number,string,string?][] = [
  [90,"leak_warm"],[187,"glitch"],[289,"smoke"],[376,"particles_gold"],[434,"leak_warm"],[505,"glitch"],
];
// точечные акценты-ассеты: [клип, старт, длит, opacity, blend?]
const ACCENT: [string,number,number,number,string?][] = [
  ["particles_gold",434,40,0.75,"screen"], // БЕСПЛАТНО-взрыв
  ["particles_gold",505,50,0.6,"screen"],  // доход
  ["network",187,102,0.22,"screen"],        // фичи — сетка
];

export const RealReel: React.FC = () => {
  const f=useCurrentFrame();
  return (
    <AbsoluteFill style={{backgroundColor:"#050505"}}>
      <style dangerouslySetInnerHTML={{__html:FONT_CSS}}/>
      {/* базовый слой: живой футаж */}
      {SHOTS.map(([clip,st,en,dir],i)=>(
        <Sequence key={i} from={st} durationInFrames={en-st}><Shot clip={clip} len={en-st} dir={dir}/></Sequence>
      ))}
      {/* затемняющий скрим, чтобы моушен читался */}
      {f<END_START && <AbsoluteFill style={{background:"linear-gradient(180deg,rgba(5,5,5,.58),rgba(5,5,5,.38) 40%,rgba(5,5,5,.7))"}}/>}

      {/* глобальный оверлей реальных частиц (screen) — «жизнь» на всём ролике */}
      {f<END_START && <ScreenFX clip="particles_dust" opacity={0.3} loopDur={90}/>}

      {/* точечные акценты-ассеты */}
      {ACCENT.map(([clip,st,dur,op,bl],i)=>(
        <Sequence key={i} from={st} durationInFrames={dur}><ScreenFX clip={clip} opacity={op} blend={bl||"screen"} loopDur={dur}/></Sequence>
      ))}

      <Sequence from={END_START} durationInFrames={REAL_TOTAL-END_START}><EndCard/></Sequence>

      {/* === СЛОЙ МОУШЕН-ГРАФИКИ === */}
      {OVER.map(([Comp,st,dur,props],i)=>(
        <Sequence key={i} from={st} durationInFrames={dur}><Comp {...props}/></Sequence>
      ))}

      {/* Lottie-акценты (реальные ассеты) */}
      <Sequence from={505} durationInFrames={50}><LottieAsset name="coins" size={300} top={170} left={390} loop/></Sequence>
      <Sequence from={434} durationInFrames={38}><LottieAsset name="book" size={230} top={210} left={425} loop opacity={0.95}/></Sequence>

      {/* === РЕАЛЬНЫЕ ПЕРЕХОДЫ-АССЕТЫ на стыках === */}
      {TRANS.map(([c,clip],i)=>(
        <Sequence key={i} from={c-5} durationInFrames={14}><TransitionFX clip={clip}/></Sequence>
      ))}
      {/* мелкие стыки — короткая вспышка лайт-лика */}
      {CUTS.filter(c=>!TRANS.find(t=>t[0]===c)).map((c,i)=>(
        <Sequence key={i} from={c-3} durationInFrames={9}><TransitionFX clip="leak_lens"/></Sequence>
      ))}

      <Grain/>
      {/* субтитр прячем там, где карточки уже несут текст */}
      {f<END_START && !(f>=6&&f<118) && !(f>=187&&f<376) && <CaptionBox words={WORDS as any} isKey={isKey}/>}
      {f<END_START && <Header/>}
      <div style={{position:"absolute",bottom:0,left:0,height:5,width:`${interpolate(f,[0,REAL_TOTAL],[0,100],{extrapolateRight:"clamp"})}%`,background:LIME,boxShadow:`0 0 16px ${LIME}`}}/>
    </AbsoluteFill>
  );
};
