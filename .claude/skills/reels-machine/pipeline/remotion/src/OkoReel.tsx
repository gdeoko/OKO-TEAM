import React from "react";
import { AbsoluteFill, useCurrentFrame, useVideoConfig, interpolate, Easing, staticFile, Img, OffthreadVideo } from "remotion";
import { TransitionSeries, springTiming } from "@remotion/transitions";
import { fade } from "@remotion/transitions/fade";
import { slide } from "@remotion/transitions/slide";
import { wipe } from "@remotion/transitions/wipe";
import { clockWipe } from "@remotion/transitions/clock-wipe";
import { LIME, MONT, BEBAS } from "./mograph";
import { Shot, Grain, ProKaraoke, Header } from "./mograph3";
import { FONT_CSS } from "./fonts";

const CAPS = [
  { t: "Представь", s: 0, e: 0.78 }, { t: "одно приложение,", s: 0.78, e: 2.08 },
  { t: "где есть всё", s: 2.08, e: 2.95, lime: true }, { t: "мессенджер", s: 2.95, e: 3.82, lime: true },
  { t: "нейросети", s: 3.82, e: 4.6, lime: true }, { t: "продвижение", s: 4.6, e: 5.55, lime: true },
  { t: "и заработок", s: 5.55, e: 6.42, lime: true }, { t: "без ВПН", s: 6.42, e: 6.94, lime: true },
  { t: "без блокировок", s: 6.94, e: 8.07 }, { t: "безопасно", s: 8.07, e: 9.63, lime: true },
  { t: "контент", s: 9.63, e: 10.23, lime: true }, { t: "в один клик", s: 10.23, e: 11.02, lime: true },
  { t: "без подписок", s: 11.02, e: 11.97 }, { t: "и команд", s: 11.97, e: 12.58 },
  { t: "бесплатное обучение", s: 12.58, e: 14.14, lime: true }, { t: "сертификат", s: 14.14, e: 15.01, lime: true },
  { t: "доход с 1-го дня", s: 15.01, e: 16.48, lime: true },
];
const SP = springTiming({ config: { damping: 200 }, durationInFrames: 12 });
const shots: [string, number, number][] = [
  ["clips/c01.mp4", 60, 1], ["clips/c02.mp4", 60, -1], ["clips/c03.mp4", 66, 1],
  ["clips/c04.mp4", 60, -1], ["clips/c09.mp4", 54, 1], ["clips/c05.mp4", 54, -1],
  ["clips/c06.mp4", 54, 1], ["clips/c07.mp4", 66, -1], ["clips/c08.mp4", 60, 1],
];

const EndCard: React.FC = () => {
  const f = useCurrentFrame(); const { fps, width, height } = useVideoConfig();
  const E = Easing.bezier(0.16, 1, 0.3, 1);
  const s = interpolate(f, [0, 16], [0.7, 1], { extrapolateRight: "clamp", easing: E });
  const o = interpolate(f, [4, 18], [0, 1], { extrapolateRight: "clamp" });
  const pulse = 1 + Math.sin(f / 9) * 0.03;
  return (
    <AbsoluteFill style={{ backgroundColor: "#070707", alignItems: "center", justifyContent: "center", overflow: "hidden" }}>
      <OffthreadVideo src={staticFile("clips/c10.mp4")} muted style={{ position: "absolute", width: "100%", height: "100%", objectFit: "cover", filter: "brightness(0.35) saturate(1.2) blur(3px)", transform: `scale(${1.1 + f * 0.001})` }} />
      <AbsoluteFill style={{ background: `radial-gradient(circle at 50% 45%, ${LIME}22, transparent 55%)` }} />
      <div style={{ textAlign: "center", transform: `scale(${s * pulse})`, opacity: o }}>
        <Img src={staticFile("logo.png")} style={{ width: 220, filter: `drop-shadow(0 0 60px ${LIME})` }} />
        <div style={{ fontFamily: BEBAS, color: "#fff", fontSize: 190, letterSpacing: 8, marginTop: 6 }}>OKO</div>
        <div style={{ fontFamily: MONT, fontWeight: 800, color: LIME, fontSize: 46, letterSpacing: 6, textShadow: `0 0 30px ${LIME}88` }}>СКОРО · ПЕРЕХОДИ ПО ССЫЛКЕ</div>
      </div>
    </AbsoluteFill>
  );
};

export const OkoReel: React.FC = () => {
  const f = useCurrentFrame(); const { width, height } = useVideoConfig();
  const trans = [
    slide({ direction: "from-right" }), fade(), wipe({ direction: "from-bottom" }),
    clockWipe({ width, height }), slide({ direction: "from-left" }), fade(),
    wipe({ direction: "from-right" }), slide({ direction: "from-bottom" }), fade(),
  ];
  return (
    <AbsoluteFill style={{ backgroundColor: "#070707" }}>
      <style dangerouslySetInnerHTML={{ __html: FONT_CSS }} />
      {/* ФУТАЖ нарезкой с профи-переходами */}
      <TransitionSeries>
        {shots.map(([clip, dur, dir], i) => (
          <React.Fragment key={i}>
            <TransitionSeries.Sequence durationInFrames={dur}>
              <Shot clip={clip} dur={dur} dir={dir} />
            </TransitionSeries.Sequence>
            <TransitionSeries.Transition presentation={trans[i]} timing={SP} />
          </React.Fragment>
        ))}
        <TransitionSeries.Sequence durationInFrames={144}>
          <EndCard />
        </TransitionSeries.Sequence>
      </TransitionSeries>

      {/* Глобальные слои поверх футажа */}
      <Grain />
      {f < 500 && <ProKaraoke caps={CAPS} />}
      <Header />
      <div style={{ position: "absolute", bottom: 0, left: 0, height: 6, width: `${interpolate(f, [0, 570], [0, 100])}%`, background: LIME, boxShadow: `0 0 16px ${LIME}` }} />
    </AbsoluteFill>
  );
};
