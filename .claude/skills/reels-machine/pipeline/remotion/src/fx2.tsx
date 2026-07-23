import React from "react";
import { AbsoluteFill, OffthreadVideo, staticFile, useCurrentFrame, useVideoConfig, interpolate, Loop, Easing } from "remotion";
import { Lottie } from "@remotion/lottie";
import { LIME } from "./mograph";
import { LOTTIE } from "./lottieData";

const E = Easing.bezier(0.16,1,0.3,1);

// Lottie-ассет (статический импорт — без async, без пустых кадров)
export const LottieAsset: React.FC<{name:string; size?:number; top?:number; left?:number; loop?:boolean; opacity?:number; style?:React.CSSProperties}> =
 ({name,size=300,top,left,loop=false,opacity=1,style}) => {
  const data = LOTTIE[name];
  if(!data) return null;
  return <div style={{position:"absolute",top,left,width:size,height:size,opacity,...style}}>
    <Lottie animationData={data} loop={loop} playbackRate={1}/>
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
