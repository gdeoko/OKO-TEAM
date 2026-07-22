import React from "react";
import { AbsoluteFill, OffthreadVideo, Sequence, staticFile, useCurrentFrame, interpolate, spring, useVideoConfig, Img } from "remotion";
import {
  LIME, MONT, BEBAS, ParticleField, RadialGlow, LightLeak, KineticWords,
  ScriptAccent, StatCard, BarChart, SocialIcons, LogoHeader,
} from "./mograph";

const Scene: React.FC<{ from: number; dur: number; children: React.ReactNode }> = ({ from, dur, children }) => {
  const f = useCurrentFrame();
  const local = f - from;
  const inn = interpolate(local, [0, 10], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const out = interpolate(local, [dur - 8, dur], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  return <Sequence from={from} durationInFrames={dur}><AbsoluteFill style={{ opacity: Math.min(inn, out) }}>{children}</AbsoluteFill></Sequence>;
};

export const OkoReel: React.FC = () => {
  const f = useCurrentFrame();
  return (
    <AbsoluteFill style={{ backgroundColor: "#080808" }}>
      {/* Постоянный анимированный фон */}
      <ParticleField />
      <RadialGlow x={50} y={38} />

      {/* Сцена A — интро (кинетика + скрипт) */}
      <Scene from={0} dur={82}>
        <KineticWords words={[{ t: "ТВОЙ" }, { t: "КОНТЕНТ", lime: true }]} start={8} step={7} size={150} top={640} />
        <ScriptAccent text="под ключ" start={40} top={900} />
        <div style={{ position: "absolute", top: 1120, width: "100%", textAlign: "center", fontFamily: MONT, fontWeight: 700, fontSize: 40, color: "#cfcfcf", letterSpacing: 1 }}>дизайн · продвижение · нейросети</div>
      </Scene>

      {/* Сцена B — стата (3D-карточка + мини-сток) */}
      <Scene from={82} dur={92}>
        <KineticWords words={[{ t: "РЕЗУЛЬТАТ," }, { t: "КОТОРЫЙ", lime: true }, { t: "ВИДНО" }]} start={6} step={5} size={70} font={MONT} top={360} />
        <StatCard start={14} value="1200000" label="просмотров за месяц" thumb="stock1.mp4" />
      </Scene>

      {/* Сцена C — инфографика (сток-текстура + бары) */}
      <Scene from={174} dur={92}>
        <AbsoluteFill style={{ opacity: 0.28 }}>
          <OffthreadVideo src={staticFile("stock2.mp4")} muted style={{ width: "100%", height: "100%", objectFit: "cover", filter: "blur(6px) saturate(0.6)" }} />
        </AbsoluteFill>
        <AbsoluteFill style={{ background: "linear-gradient(180deg,#080808cc,#08080899,#080808ee)" }} />
        <KineticWords words={[{ t: "РОСТ" }, { t: "ПО ВСЕМ" }, { t: "СЕТЯМ", lime: true }]} start={6} step={5} size={78} top={360} />
        <BarChart start={16} bars={[{ l: "охваты", v: 42 }, { l: "вовлечение", v: 68 }, { l: "продажи", v: 94 }]} />
      </Scene>

      {/* Сцена D — соцсети (иконки + скрипт) */}
      <Scene from={266} dur={92}>
        <KineticWords words={[{ t: "ВЕЗДЕ," }, { t: "ГДЕ ТВОЯ" }, { t: "АУДИТОРИЯ", lime: true }]} start={6} step={5} size={72} font={MONT} top={380} />
        <SocialIcons start={16} top={860} />
        <ScriptAccent text="в соцсетях" start={40} top={1120} />
      </Scene>

      {/* Сцена E — финал (лого + CTA) */}
      <Scene from={358} dur={82}>
        <RadialGlow x={50} y={44} />
        <AbsoluteFill style={{ alignItems: "center", justifyContent: "center" }}>
          <EndCard />
        </AbsoluteFill>
      </Scene>

      {/* Хедер поверх всего */}
      <LogoHeader />

      {/* Лайт-лик переходы на стыках сцен */}
      <LightLeak at={82} />
      <LightLeak at={174} />
      <LightLeak at={266} />
      <LightLeak at={358} />

      {/* Прогресс-бар */}
      <div style={{ position: "absolute", bottom: 0, left: 0, height: 7, width: `${interpolate(f, [0, 440], [0, 100])}%`, background: LIME, boxShadow: `0 0 16px ${LIME}` }} />
    </AbsoluteFill>
  );
};

const EndCard: React.FC = () => {
  const f = useCurrentFrame(); const { fps } = useVideoConfig();
  const sp = spring({ frame: f - 4, fps, config: { damping: 13 } });
  const pulse = 1 + Math.sin(f / 10) * 0.03;
  return (
    <div style={{ textAlign: "center" }}>
      <Img src={staticFile("logo.png")} style={{ width: 230, transform: `scale(${(0.6 + sp * 0.4) * pulse})`, filter: `drop-shadow(0 0 50px ${LIME})` }} />
      <div style={{ fontFamily: BEBAS, color: "#fff", fontSize: 180, letterSpacing: 6, marginTop: 10, opacity: sp, transform: `translateY(${(1 - sp) * 40}px)` }}>OKO</div>
      <div style={{ fontFamily: MONT, fontWeight: 800, color: LIME, fontSize: 46, letterSpacing: 8, opacity: sp, textShadow: `0 0 30px ${LIME}88` }}>СКОРО ПРИЛОЖЕНИЕ</div>
    </div>
  );
};
