import React from "react";
import { AbsoluteFill, OffthreadVideo, staticFile, useCurrentFrame, useVideoConfig, interpolate, spring, Loop, Easing } from "remotion";
import { Lottie } from "@remotion/lottie";
import { Gif } from "@remotion/gif";
import { LIME } from "./mograph";
import { LOTTIE } from "./lottieData";
import { LIB } from "./lottieLib";
import { CRYPTO } from "./cryptoLottie";

const E = Easing.bezier(0.16,1,0.3,1);
const ALL:Record<string,any> = {...LOTTIE, ...LIB, ...CRYPTO}; // LottieFiles + локальные + Telegram-крипто

// Премиум-стикер: живой анимированный Noto-эмодзи (prem/noto_*.gif) с пружинным влётом+флоатом
export const PremSticker: React.FC<{name:string; size:number; top:number; left:number; delay?:number; spin?:boolean}> =
 ({name,size,top,left,delay=0,spin=false}) => {
  const f=useCurrentFrame(); const {fps}=useVideoConfig();
  const sp=spring({frame:f-delay,fps,config:{damping:10,stiffness:140}});
  const float=Math.sin((f-delay)/15)*10;
  const rot=spin?Math.sin((f-delay)/22)*8:0;
  return <div style={{position:"absolute",top:top+float,left,width:size,height:size,transform:`scale(${0.3+sp*0.7}) rotate(${rot}deg)`,opacity:Math.min(1,sp*1.3),filter:"drop-shadow(0 10px 26px #000b)"}}>
    <Gif src={staticFile(`prem/${name}.gif`)} width={size} height={size} fit="contain"/>
  </div>;
};

// Lottie-ассет из библиотеки (статический импорт — без async, без пустых кадров)
export const LottieAsset: React.FC<{name:string; size?:number; top?:number; left?:number; loop?:boolean; opacity?:number; filter?:string; style?:React.CSSProperties}> =
 ({name,size=300,top,left,loop=false,opacity=1,filter,style}) => {
  const data = ALL[name];
  if(!data) return null;
  return <div style={{position:"absolute",top,left,width:size,height:size,opacity,filter,...style}}>
    <Lottie animationData={data} loop={loop} playbackRate={1}/>
  </div>;
};

// GIPHY-стикер (та же библиотека, что в CapCut) — прозрачный анимированный .gif с пружинным влётом
export const GiphySticker: React.FC<{name:string; size:number; top:number; left:number; delay?:number; loopIn?:boolean}> =
 ({name,size,top,left,delay=0,loopIn=true}) => {
  const f=useCurrentFrame(); const {fps}=useVideoConfig();
  const sp=spring({frame:f-delay,fps,config:{damping:11,stiffness:150}});
  const float=Math.sin((f-delay)/16)*8;
  return <div style={{position:"absolute",top:top+float,left,width:size,height:size,transform:`scale(${0.4+sp*0.6})`,opacity:Math.min(1,sp*1.2),filter:"drop-shadow(0 8px 24px #000a)"}}>
    <Gif src={staticFile(`giphy/${name}.gif`)} width={size} height={size} fit="contain"/>
  </div>;
};

// оверлей-футаж (screen-блендинг), зациклен
export const ScreenFX: React.FC<{clip:string; opacity?:number; blend?:any; loopDur?:number; grade?:string}> =
 ({clip,opacity=0.6,blend="screen",loopDur=90,grade}) => (
  <Loop durationInFrames={loopDur} layout="none">
    <AbsoluteFill style={{opacity,mixBlendMode:blend as any,pointerEvents:"none"}}>
      <OffthreadVideo src={staticFile(`fx/${clip}.mp4`)} muted style={{width:"100%",height:"100%",objectFit:"cover",filter:grade}}/>
    </AbsoluteFill>
  </Loop>
);

// РЕАЛЬНЫЙ переход: клип-ассет накрывает стык (glitch/smoke/leak), screen
export const TransitionFX: React.FC<{clip:string; grade?:string}> = ({clip,grade}) => {
  const f=useCurrentFrame(); const {durationInFrames:d}=useVideoConfig();
  const o=interpolate(f,[0,d*0.4,d],[0,0.9,0],{extrapolateRight:"clamp"});
  return <AbsoluteFill style={{opacity:o,mixBlendMode:"screen",pointerEvents:"none"}}>
    <OffthreadVideo src={staticFile(`fx/${clip}.mp4`)} muted style={{width:"100%",height:"100%",objectFit:"cover",filter:grade}}/>
  </AbsoluteFill>;
};

// анимированный фон-ассет (полный кадр, притемнён) — для мограф-сцен
export const AnimBG: React.FC<{clip:string; dark?:number; hue?:number}> = ({clip,dark=0.55,hue=0}) => (
  <AbsoluteFill style={{overflow:"hidden",backgroundColor:"#050505"}}>
    <Loop durationInFrames={150} layout="none">
      <OffthreadVideo src={staticFile(`fx/${clip}.mp4`)} muted style={{width:"100%",height:"100%",objectFit:"cover",filter:`brightness(${1-dark}) saturate(1.2) hue-rotate(${hue}deg)`}}/>
    </Loop>
    <AbsoluteFill style={{background:`radial-gradient(circle at 50% 40%, ${LIME}14, transparent 60%)`}}/>
  </AbsoluteFill>
);
