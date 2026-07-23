import React from "react";
import { AbsoluteFill, OffthreadVideo, Img, staticFile, useCurrentFrame, useVideoConfig, interpolate, Easing, Sequence, Loop } from "remotion";
import { LIME, MONT, BEBAS } from "./mograph";
import { FONT_CSS } from "./fonts";
import WORDS from "./words4.json";
import { CostCounter, Converge, FeaturePills, UnlockRow, ClickUI, IncomeGraph, PriceFree, CertBadge, CaptionBox } from "./fx";
import { ScreenFX, TransitionFX, LottieAsset } from "./fx2";

const E = Easing.bezier(0.16, 1, 0.3, 1);
const KEY = ["приложений","приложение","мессенджер","нейросети","продвижение","заработок","впн","блокировок","ограничений","клик","обучение","сертификат","доход","око","всё","ссылке","бесплатное","одном","тысяч"];
const norm = (w:string)=>w.toLowerCase().replace(/[.,!?—:]/g,"");
const isKey = (w:string)=>KEY.includes(norm(w));

// ================= один рез: живой футаж + zoom-punch + грейд (чистый хард-кат) =================
const Shot: React.FC<{clip:string; len:number; dir:number}> = ({clip,len,dir}) => {
  const f = useCurrentFrame();
  const punch = interpolate(f,[0,8],[1.15,1.03],{extrapolateRight:"clamp",easing:E});
  const drift = interpolate(f,[0,len],[1.0,1.07],{extrapolateRight:"clamp"});
  const px = interpolate(f,[0,len],[dir*-24,dir*24],{extrapolateRight:"clamp"});
  const py = interpolate(f,[0,len],[dir*10,dir*-10],{extrapolateRight:"clamp"});
  return (
    <AbsoluteFill style={{overflow:"hidden",backgroundColor:"#050505"}}>
      <OffthreadVideo src={staticFile(clip)} muted
        style={{width:"100%",height:"100%",objectFit:"cover",transform:`scale(${punch*drift}) translate(${px}px,${py}px)`,filter:"contrast(1.15) saturate(1.2) brightness(0.86)"}}/>
      <AbsoluteFill style={{background:LIME,mixBlendMode:"overlay",opacity:0.06}}/>
      <AbsoluteFill style={{boxShadow:"inset 0 0 300px rgba(0,0,0,.85)"}}/>
    </AbsoluteFill>
  );
};

const Grain: React.FC = () => { const f=useCurrentFrame();
  return <AbsoluteFill style={{opacity:0.04,mixBlendMode:"overlay",backgroundImage:`repeating-radial-gradient(circle at ${(f*7)%100}% ${(f*13)%100}%, #fff 0 1px, transparent 1px 3px)`}}/>;
};

const Header: React.FC = () => (<>
  <Img src={staticFile("logo.png")} style={{position:"absolute",top:56,left:52,width:68,filter:`drop-shadow(0 0 14px ${LIME})`}}/>
  <div style={{position:"absolute",top:69,left:132,fontFamily:MONT,color:"#fff",fontWeight:800,fontSize:28,letterSpacing:2}}>OKO<span style={{color:LIME}}>.</span></div>
</>);

const EndCard: React.FC = () => { const f=useCurrentFrame();
  const s=interpolate(f,[0,18],[0.64,1],{extrapolateRight:"clamp",easing:E});
  const o=interpolate(f,[2,16],[0,1],{extrapolateRight:"clamp"});
  const pulse=1+Math.sin(f/9)*0.026;
  const ctaGlow=0.6+0.4*Math.sin(f/7);
  return (
    <AbsoluteFill style={{backgroundColor:"#050505",alignItems:"center",justifyContent:"center",overflow:"hidden"}}>
      <Img src={staticFile("flux/ai.webp")} style={{position:"absolute",width:"100%",height:"100%",objectFit:"cover",filter:"brightness(0.4) saturate(1.15) blur(2px)",transform:`scale(${1.08+f*0.0008})`}}/>
      <Loop durationInFrames={150} layout="none"><AbsoluteFill style={{opacity:0.32,mixBlendMode:"screen"}}><OffthreadVideo src={staticFile("fx/bokeh.mp4")} muted style={{width:"100%",height:"100%",objectFit:"cover"}}/></AbsoluteFill></Loop>
      <AbsoluteFill style={{background:`radial-gradient(circle at 50% 44%, ${LIME}24, transparent 56%)`}}/>
      <AbsoluteFill style={{background:"linear-gradient(180deg,rgba(5,5,5,.42),transparent 40%,rgba(5,5,5,.86))"}}/>
      <div style={{textAlign:"center",transform:`scale(${s*pulse})`,opacity:o}}>
        <Img src={staticFile("logo.png")} style={{width:206,filter:`drop-shadow(0 0 60px ${LIME})`}}/>
        <div style={{fontFamily:BEBAS,color:"#fff",fontSize:194,letterSpacing:10,marginTop:4,textShadow:`0 0 40px ${LIME}55`}}>OKO</div>
        <div style={{fontFamily:MONT,fontWeight:800,color:"#fff",fontSize:37,letterSpacing:3,opacity:0.85,marginTop:-6}}>ПЕРВОЕ ПРИЛОЖЕНИЕ, ГДЕ ЕСТЬ <span style={{color:LIME}}>ВСЁ</span></div>
        <div style={{marginTop:34,display:"inline-block",padding:"20px 52px",borderRadius:60,background:LIME,color:"#050505",fontFamily:MONT,fontWeight:900,fontSize:44,letterSpacing:2,boxShadow:`0 0 ${40*ctaGlow}px ${LIME}, 0 20px 50px #000a`}}>ПЕРЕХОДИ ПО ССЫЛКЕ</div>
      </div>
    </AbsoluteFill>
  );
};

// ================= шот-лист, синхрон по битам голоса vo4 (fps=30) =================
const SHOTS:[string,number,number,number][] = [
  ["v/c17.mp4",   0,  22, 1],  // платишь
  ["v/c01.mp4",  22,  45,-1],  // пять приложений
  ["v/c02.mp4",  45,  71, 1],  // и команду
  ["v/c11.mp4",  71,  92,-1],  // сотни тысяч
  ["v/c15.mp4",  92, 136, 1],  // всё в одном
  ["v/c09.mp4", 136, 157,-1],  // Мессенджер
  ["v/c04.mp4", 157, 183, 1],  // нейросети
  ["v/c05.mp4", 183, 209,-1],  // продвижение
  ["v/c11.mp4", 209, 229, 1],  // заработок
  ["v/c14.mp4", 229, 253,-1],  // без ВПН
  ["v/c06.mp4", 253, 283, 1],  // без блокировок
  ["v/c12.mp4", 283, 314,-1],  // без ограничений
  ["v/c13.mp4", 314, 329, 1],  // запускаешь (ракета)
  ["v/c07.mp4", 329, 365,-1],  // контент
  ["v/c10.mp4", 365, 397, 1],  // бесплатное обучение
  ["v/c16.mp4", 397, 429,-1],  // сертификат
  ["v/c18.mp4", 429, 476, 1],  // доход (золотой взрыв)
];
const END_START = 476;
export const REAL_TOTAL = 700;

// моушен-графика поверх футажа: [компонент, старт, длит, props]
const OVER: [React.FC<any>, number, number, any][] = [
  [CostCounter,   6,  84, {}],
  [Converge,     94,  42, {}],
  [FeaturePills,136,  93, {step:24}],
  [UnlockRow,   229,  85, {step:25}],
  [ClickUI,     314,  51, {}],
  [PriceFree,   365,  32, {}],
  [CertBadge,   397,  32, {}],
  [IncomeGraph, 429,  47, {}],
];

export const RealReel: React.FC = () => {
  const f=useCurrentFrame();
  return (
    <AbsoluteFill style={{backgroundColor:"#050505"}}>
      <style dangerouslySetInnerHTML={{__html:FONT_CSS}}/>
      {/* базовый слой: живой футаж, ЧИСТЫЕ хард-каты на бит */}
      {SHOTS.map(([clip,st,en,dir],i)=>(
        <Sequence key={i} from={st} durationInFrames={en-st}><Shot clip={clip} len={en-st} dir={dir}/></Sequence>
      ))}
      {/* лёгкий скрим, чтобы моушен читался (мягче, не топит футаж) */}
      {f<END_START && <AbsoluteFill style={{background:"linear-gradient(180deg,rgba(5,5,5,.5),rgba(5,5,5,.32) 42%,rgba(5,5,5,.64))"}}/>}

      {/* === ТОЧЕЧНЫЕ акценты-ассеты (без «вша», по смыслу) === */}
      {/* золотые частицы только на деньгах: заработок и доход */}
      <Sequence from={209} durationInFrames={20}><ScreenFX clip="particles_gold" opacity={0.4} loopDur={20}/></Sequence>
      <Sequence from={429} durationInFrames={47}><ScreenFX clip="particles_gold" opacity={0.55} loopDur={47}/></Sequence>
      <Sequence from={END_START} durationInFrames={REAL_TOTAL-END_START}><EndCard/></Sequence>

      {/* === СЛОЙ МОУШЕН-ГРАФИКИ === */}
      {OVER.map(([Comp,st,dur,props],i)=>(
        <Sequence key={i} from={st} durationInFrames={dur}><Comp {...props}/></Sequence>
      ))}
      {/* Lottie-акценты, по одному на смысл */}
      <Sequence from={429} durationInFrames={47}><LottieAsset name="coins" size={290} top={170} left={395} loop/></Sequence>
      <Sequence from={365} durationInFrames={32}><LottieAsset name="book" size={220} top={215} left={430} loop opacity={0.95}/></Sequence>

      <Grain/>
      {/* субтитр прячем там, где карточки уже несут текст */}
      {f<END_START && !(f>=6&&f<92) && !(f>=136&&f<314) && <CaptionBox words={WORDS as any} isKey={isKey}/>}
      {f<END_START && <Header/>}
      <div style={{position:"absolute",bottom:0,left:0,height:5,width:`${interpolate(f,[0,REAL_TOTAL],[0,100],{extrapolateRight:"clamp"})}%`,background:LIME,boxShadow:`0 0 16px ${LIME}`}}/>
    </AbsoluteFill>
  );
};
