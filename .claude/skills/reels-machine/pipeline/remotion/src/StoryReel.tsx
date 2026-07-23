import React from "react";
import { AbsoluteFill, OffthreadVideo, Img, staticFile, useCurrentFrame, useVideoConfig, interpolate, spring, Easing, Sequence, Loop } from "remotion";
import { LIME, MONT, BEBAS } from "./mograph";
import { FONT_CSS } from "./fonts";
import WORDS from "./words_s.json";
import { CostCounter, Converge, IncomeGraph } from "./fx";
import { ScreenFX, LottieAsset } from "./fx2";

const E = Easing.bezier(0.16,1,0.3,1);
const GLOW = `0 0 10px ${LIME}, 0 0 34px ${LIME}aa`;
// ключевые story-слова → лайм
const KEY = new Set(["19","телефон","приложение","приложений","всё","все","мессенджер","нейросети","продвижение","заработок","клик","обучение","сертификат","деньги","око","шанс","бесплатное","первые","первый","контент"]);
const norm=(w:string)=>w.toLowerCase().replace(/[.,!?—:;"«»]/g,"");
const isKey=(w:string)=>KEY.has(norm(w));

// ===== когезивный кино-грейд + панч =====
const Shot: React.FC<{clip:string; len:number; dir:number; z?:number}> = ({clip,len,dir,z=1}) => {
  const f=useCurrentFrame();
  const punch=interpolate(f,[0,9],[1.12,1.03],{extrapolateRight:"clamp",easing:E});
  const drift=interpolate(f,[0,len],[1.0,1.06*z],{extrapolateRight:"clamp"});
  const px=interpolate(f,[0,len],[dir*-22,dir*22],{extrapolateRight:"clamp"});
  const py=interpolate(f,[0,len],[dir*8,dir*-8],{extrapolateRight:"clamp"});
  return (
    <AbsoluteFill style={{overflow:"hidden",backgroundColor:"#050505"}}>
      <OffthreadVideo src={staticFile(clip)} muted
        style={{width:"100%",height:"100%",objectFit:"cover",transform:`scale(${punch*drift}) translate(${px}px,${py}px)`,filter:"contrast(1.12) saturate(1.16) brightness(0.9)"}}/>
      {/* когезивный тон: тёплый верх, лайм-холод низ + виньетка */}
      <AbsoluteFill style={{background:"linear-gradient(180deg,rgba(20,12,4,.25),transparent 30%,transparent 62%,rgba(4,8,2,.4))",mixBlendMode:"soft-light"}}/>
      <AbsoluteFill style={{background:LIME,mixBlendMode:"overlay",opacity:0.05}}/>
      <AbsoluteFill style={{boxShadow:"inset 0 0 300px rgba(0,0,0,.82)"}}/>
    </AbsoluteFill>
  );
};

const Grain: React.FC = () => { const f=useCurrentFrame();
  return <AbsoluteFill style={{opacity:0.04,mixBlendMode:"overlay",backgroundImage:`repeating-radial-gradient(circle at ${(f*7)%100}% ${(f*13)%100}%, #fff 0 1px, transparent 1px 3px)`}}/>;
};

// ===== ЧИСТЫЙ story-субтитр (кинетический, без коробок) =====
const StoryCaption: React.FC<{bottom?:number}> = ({bottom=300}) => {
  const f=useCurrentFrame(); const {fps}=useVideoConfig(); const t=f/fps;
  const cur=(WORDS as any[]).find(w=>t>=w.s-0.04 && t<w.e+0.10);
  if(!cur) return null;
  const local=f-(cur.s-0.04)*fps;
  const blur=interpolate(local,[0,4],[9,0],{extrapolateRight:"clamp",easing:E});
  const rise=interpolate(local,[0,6],[26,0],{extrapolateRight:"clamp",easing:E});
  const sc=interpolate(local,[0,6],[0.9,1],{extrapolateRight:"clamp",easing:E});
  const key=isKey(cur.t);
  const txt=cur.t.replace(/[.,!?—:;"«»]/g,"").toUpperCase();
  const fs=key?Math.min(112,Math.floor(1000/(txt.length*0.6))):Math.min(74,Math.floor(900/(txt.length*0.56)));
  return (
    <div style={{position:"absolute",bottom,width:"100%",textAlign:"center",padding:"0 70px"}}>
      <span style={{display:"inline-block",transform:`translateY(${rise}px) scale(${sc})`,filter:`blur(${blur}px)`,
        fontFamily:key?BEBAS:MONT,fontWeight:key?400:800,fontSize:fs,letterSpacing:key?2:0.5,lineHeight:1,
        color:key?LIME:"#fff",textShadow:key?GLOW:"0 4px 18px #000f, 0 1px 4px #000",
        WebkitTextStroke:key?`1px ${LIME}`:"0"}}>{txt}</span>
    </div>
  );
};

// ===== иконка-штамп фичи (лайм-контур рисуется) — чистый, по одному =====
const IcPaths:Record<string,string>={
  chat:"M20 62 V30 a8 8 0 0 1 8-8 h44 a8 8 0 0 1 8 8 v28 a8 8 0 0 1-8 8 H40 L20 82 Z",
  ai:"M50 20 V80 M28 44 H72 M32 66 H68 M50 18 a14 14 0 0 1 14 14 a14 14 0 0 1 8 12 a13 13 0 0 1-8 22 a14 14 0 0 1-14 8 a14 14 0 0 1-14-8 a13 13 0 0 1-8-22 a14 14 0 0 1 8-12 a14 14 0 0 1 14-14 Z",
  chart:"M22 78 H82 M22 78 V22 M34 66 L48 50 L60 58 L80 30 M80 30 H66 M80 30 V44",
  coin:"M50 20 a30 30 0 1 0 0 60 a30 30 0 0 0 0-60 M50 34 v32 M42 42 h12 a6 6 0 0 1 0 12 h-12 M42 54 h14",
};
const FeatureStamp: React.FC<{icon:string; word:string}> = ({icon,word}) => {
  const f=useCurrentFrame(); const {fps}=useVideoConfig();
  const p=interpolate(f,[0,14],[0,1],{extrapolateRight:"clamp",easing:E});
  const sp=spring({frame:f,fps,config:{damping:13,stiffness:150}});
  const out=interpolate(f,[16,22],[1,1],{extrapolateRight:"clamp"});
  return (
    <AbsoluteFill style={{alignItems:"center",justifyContent:"center",paddingBottom:150}}>
      <div style={{textAlign:"center",transform:`scale(${0.8+sp*0.2})`,opacity:out}}>
        <svg width={150} height={150} viewBox="0 0 100 100" style={{filter:`drop-shadow(0 0 14px ${LIME})`}}>
          <path d={IcPaths[icon]} fill="none" stroke={LIME} strokeWidth={4} strokeLinecap="round" strokeLinejoin="round" pathLength={1} strokeDasharray={1} strokeDashoffset={1-p}/>
        </svg>
      </div>
    </AbsoluteFill>
  );
};

const Header: React.FC = () => (<>
  <Img src={staticFile("logo.png")} style={{position:"absolute",top:54,left:50,width:64,filter:`drop-shadow(0 0 14px ${LIME})`}}/>
  <div style={{position:"absolute",top:66,left:126,fontFamily:MONT,color:"#fff",fontWeight:800,fontSize:26,letterSpacing:2}}>OKO<span style={{color:LIME}}>.</span></div>
</>);

const EndCard: React.FC = () => { const f=useCurrentFrame();
  const s=interpolate(f,[0,20],[0.66,1],{extrapolateRight:"clamp",easing:E});
  const o=interpolate(f,[2,18],[0,1],{extrapolateRight:"clamp"});
  const pulse=1+Math.sin(f/9)*0.026;
  const ctaGlow=0.6+0.4*Math.sin(f/7);
  return (
    <AbsoluteFill style={{backgroundColor:"#050505",alignItems:"center",justifyContent:"center",overflow:"hidden"}}>
      <Img src={staticFile("flux/ai.webp")} style={{position:"absolute",width:"100%",height:"100%",objectFit:"cover",filter:"brightness(0.4) saturate(1.15) blur(2px)",transform:`scale(${1.08+f*0.0008})`}}/>
      <Loop durationInFrames={150} layout="none"><AbsoluteFill style={{opacity:0.3,mixBlendMode:"screen"}}><OffthreadVideo src={staticFile("fx/bokeh.mp4")} muted style={{width:"100%",height:"100%",objectFit:"cover"}}/></AbsoluteFill></Loop>
      <AbsoluteFill style={{background:`radial-gradient(circle at 50% 44%, ${LIME}24, transparent 56%)`}}/>
      <AbsoluteFill style={{background:"linear-gradient(180deg,rgba(5,5,5,.42),transparent 40%,rgba(5,5,5,.86))"}}/>
      <div style={{textAlign:"center",transform:`scale(${s*pulse})`,opacity:o}}>
        <Img src={staticFile("logo.png")} style={{width:200,filter:`drop-shadow(0 0 60px ${LIME})`}}/>
        <div style={{fontFamily:BEBAS,color:"#fff",fontSize:190,letterSpacing:10,marginTop:4,textShadow:`0 0 40px ${LIME}55`}}>OKO</div>
        <div style={{fontFamily:MONT,fontWeight:800,color:"#fff",fontSize:36,letterSpacing:2,opacity:0.85,marginTop:-4}}>ТВОЙ ШАНС НАЧАТЬ <span style={{color:LIME}}>С НУЛЯ</span></div>
        <div style={{marginTop:32,display:"inline-block",padding:"20px 52px",borderRadius:60,background:LIME,color:"#050505",fontFamily:MONT,fontWeight:900,fontSize:44,letterSpacing:2,boxShadow:`0 0 ${40*ctaGlow}px ${LIME}, 0 20px 50px #000a`}}>ПЕРЕХОДИ, ПОКА ОТКРЫТО</div>
      </div>
    </AbsoluteFill>
  );
};

// ===== шот-лист под story-тайминг (fps=30) =====
const SHOTS:[string,number,number,number][] = [
  ["s2/notif.mp4",       0,  45, 1],   // Мне было 19 (тёмный телефон)
  ["s2/struggle.mp4",   45, 126,-1],   // ни денег, ни связей, только телефон
  ["v/c17.mp4",        126, 171, 1],   // я платил за 5 приложений
  ["s2/money.mp4",     171, 240,-1],   // и команду, которой не мог платить
  ["s2/phone_disc.mp4",240, 348, 1],   // открыл приложение / где оказалось всё (TURN)
  ["v/c09.mp4",        348, 369,-1],   // мессенджер
  ["v/c04.mp4",        369, 400, 1],   // нейросети
  ["v/c05.mp4",        400, 430,-1],   // продвижение
  ["v/c11.mp4",        430, 479, 1],   // заработок в одном месте
  ["s2/content.mp4",   479, 509,-1],   // свой первый контент
  ["v/c13.mp4",        509, 537, 1],   // запустил в один клик (ракета)
  ["s2/typing.mp4",    537, 586,-1],   // без вложений
  ["v/c14.mp4",        586, 616, 1],   // без блокировок
  ["s2/study.mp4",     616, 672,-1],   // бесплатное обучение
  ["v/c16.mp4",        672, 716, 1],   // сертификат
  ["s2/money.mp4",     716, 782,-1],   // первые деньги
  ["v/c18.mp4",        782, 838, 1],   // мои честные (золотой взрыв)
  ["s2/city_walk.mp4", 838, 908,-1],   // сегодня око кормит меня и тысячи
  ["s2/sunrise.mp4",   908, 945, 1],   // таких же как я
];
const END_START=945;
export const STORY_TOTAL=1080;

export const StoryReel: React.FC = () => {
  const f=useCurrentFrame();
  return (
    <AbsoluteFill style={{backgroundColor:"#050505"}}>
      <style dangerouslySetInnerHTML={{__html:FONT_CSS}}/>
      {SHOTS.map(([clip,st,en,dir],i)=>(
        <Sequence key={i} from={st} durationInFrames={en-st}><Shot clip={clip} len={en-st} dir={dir}/></Sequence>
      ))}
      {f<END_START && <AbsoluteFill style={{background:"linear-gradient(180deg,rgba(5,5,5,.42),rgba(5,5,5,.26) 42%,rgba(5,5,5,.6))"}}/>}

      {/* ТОЧЕЧНЫЕ ассеты по смыслу */}
      <Sequence from={0} durationInFrames={126}><ScreenFX clip="particles_dust" opacity={0.22} loopDur={90}/></Sequence>{/* хук — пылинки */}
      <Sequence from={716} durationInFrames={122}><ScreenFX clip="particles_gold" opacity={0.5} loopDur={60}/></Sequence>{/* деньги — золото */}

      <Sequence from={END_START} durationInFrames={STORY_TOTAL-END_START}><EndCard/></Sequence>

      {/* HERO-мограф (по одному, чисто) */}
      <Sequence from={128} durationInFrames={110}><CostCounter/></Sequence>
      <Sequence from={300} durationInFrames={48}><Converge/></Sequence>
      <Sequence from={348} durationInFrames={21}><FeatureStamp icon="chat" word="МЕССЕНДЖЕР"/></Sequence>
      <Sequence from={369} durationInFrames={31}><FeatureStamp icon="ai" word="НЕЙРОСЕТИ"/></Sequence>
      <Sequence from={400} durationInFrames={30}><FeatureStamp icon="chart" word="ПРОДВИЖЕНИЕ"/></Sequence>
      <Sequence from={430} durationInFrames={49}><FeatureStamp icon="coin" word="ЗАРАБОТОК"/></Sequence>
      <Sequence from={716} durationInFrames={66}><IncomeGraph/></Sequence>
      <Sequence from={716} durationInFrames={66}><LottieAsset name="coins" size={240} top={150} left={420} loop/></Sequence>

      <Grain/>
      {/* субтитр прячем там, где HERO-мограф несёт текст (счётчик/фичи/доход) */}
      {f<END_START && !(f>=128&&f<238) && !(f>=716&&f<782) && <StoryCaption/>}
      {f<END_START && <Header/>}
      <div style={{position:"absolute",bottom:0,left:0,height:5,width:`${interpolate(f,[0,STORY_TOTAL],[0,100],{extrapolateRight:"clamp"})}%`,background:LIME,boxShadow:`0 0 16px ${LIME}`}}/>
    </AbsoluteFill>
  );
};
