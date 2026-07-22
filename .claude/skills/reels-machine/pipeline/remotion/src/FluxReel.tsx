import React from "react";
import { AbsoluteFill, Img, staticFile, useCurrentFrame, useVideoConfig, interpolate, Easing } from "remotion";
import { TransitionSeries, springTiming } from "@remotion/transitions";
import { fade } from "@remotion/transitions/fade";
import { slide } from "@remotion/transitions/slide";
import { wipe } from "@remotion/transitions/wipe";
import { LIME, MONT, BEBAS } from "./mograph";
import { FONT_CSS } from "./fonts";
const E = Easing.bezier(0.16, 1, 0.3, 1);
const NEON = `0 0 10px ${LIME}, 0 0 26px ${LIME}, 0 0 60px ${LIME}cc, 0 0 110px ${LIME}88`;

const KenBurns: React.FC<{ img: string; dir: number; dur: number }> = ({ img, dir, dur }) => {
  const f = useCurrentFrame();
  const sc = interpolate(f, [0, dur], [1.05, 1.28], { extrapolateRight: "clamp", easing: E });
  const px = interpolate(f, [0, dur], [dir * -30, dir * 30], { extrapolateRight: "clamp" });
  return (
    <AbsoluteFill style={{ overflow: "hidden", backgroundColor: "#050505" }}>
      <Img src={staticFile(img)} style={{ width: "100%", height: "100%", objectFit: "cover", transform: `scale(${sc}) translateX(${px}px)`, filter: "saturate(1.15) contrast(1.08)" }} />
      <AbsoluteFill style={{ background: "linear-gradient(180deg,rgba(5,5,5,.45),transparent 32%,rgba(5,5,5,.35) 62%,rgba(5,5,5,.9))" }} />
    </AbsoluteFill>
  );
};
const Cap: React.FC<{ top: string; key1: string; sub?: string; big?: string }> = ({ top, key1, sub, big }) => {
  const f = useCurrentFrame(); const { fps } = useVideoConfig();
  const o = interpolate(f, [2, 12], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const r = interpolate(f, [2, 14], [40, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: E });
  return (
    <AbsoluteFill style={{ alignItems: "center", justifyContent: "flex-end", paddingBottom: 380 }}>
      {big && <div style={{ fontFamily: BEBAS, fontSize: 300, color: LIME, textShadow: NEON, opacity: o, transform: `translateY(${r}px) scale(${0.9 + o * 0.1})`, lineHeight: 0.85 }}>{big}</div>}
      <div style={{ textAlign: "center", opacity: o, transform: `translateY(${r}px)` }}>
        <div style={{ fontFamily: MONT, fontWeight: 800, fontSize: 64, color: "#fff", letterSpacing: 1, textShadow: "0 6px 24px #000d" }}>{top} <span style={{ color: LIME, textShadow: NEON }}>{key1}</span></div>
        {sub && <div style={{ fontFamily: MONT, fontWeight: 700, fontSize: 40, color: "#cfcfcf", marginTop: 8 }}>{sub}</div>}
      </div>
    </AbsoluteFill>
  );
};
const Header: React.FC = () => (<>
  <Img src={staticFile("logo.png")} style={{ position: "absolute", top: 58, left: 54, width: 80, filter: `drop-shadow(0 0 14px ${LIME})` }} />
  <div style={{ position: "absolute", top: 74, left: 146, fontFamily: MONT, color: "#fff", fontWeight: 800, fontSize: 32, letterSpacing: 2 }}>OKO<span style={{ color: LIME }}>.</span></div>
</>);

export const FluxReel: React.FC = () => {
  const f = useCurrentFrame(); const { width } = useVideoConfig();
  const SP = springTiming({ config: { damping: 200 }, durationInFrames: 12 });
  return (
    <AbsoluteFill style={{ backgroundColor: "#050505" }}>
      <style dangerouslySetInnerHTML={{ __html: FONT_CSS }} />
      <TransitionSeries>
        <TransitionSeries.Sequence durationInFrames={66}>
          <KenBurns img="flux/bg.webp" dir={1} dur={66} /><Cap top="ОДНО" key1="ПРИЛОЖЕНИЕ" sub="ГДЕ ЕСТЬ ВСЁ" />
        </TransitionSeries.Sequence>
        <TransitionSeries.Transition presentation={slide({ direction: "from-right" })} timing={SP} />
        <TransitionSeries.Sequence durationInFrames={66}>
          <KenBurns img="flux/ai.webp" dir={-1} dur={66} /><Cap top="НЕЙРОСЕТИ" key1="ВНУТРИ" sub="БЕЗ ВПН И БЛОКИРОВОК" />
        </TransitionSeries.Sequence>
        <TransitionSeries.Transition presentation={wipe({ direction: "from-bottom" })} timing={SP} />
        <TransitionSeries.Sequence durationInFrames={66}>
          <KenBurns img="flux/phone.webp" dir={1} dur={66} /><Cap top="КОНТЕНТ" key1="В 1 КЛИК" sub="БЕЗ ПОДПИСОК И КОМАНД" />
        </TransitionSeries.Sequence>
        <TransitionSeries.Transition presentation={fade()} timing={SP} />
        <TransitionSeries.Sequence durationInFrames={78}>
          <KenBurns img="flux/money.webp" dir={-1} dur={78} /><Cap top="ДОХОД" key1="С 1-ГО ДНЯ" big="×10" />
        </TransitionSeries.Sequence>
      </TransitionSeries>
      <Header />
      <div style={{ position: "absolute", bottom: 0, left: 0, height: 6, width: `${interpolate(f, [0, 264], [0, 100])}%`, background: LIME, boxShadow: `0 0 16px ${LIME}` }} />
    </AbsoluteFill>
  );
};
