import React from "react";
import { AbsoluteFill, useCurrentFrame, interpolate, spring, useVideoConfig, staticFile, Img } from "remotion";
import { LIME, MONT, BEBAS, ParticleField, RadialGlow, LightLeak, SocialIcons, LogoHeader } from "./mograph";
import { Blob, RingBg, Karaoke, Shield, Checks, ClickPhone } from "./mograph2";
import { FONT_CSS } from "./fonts";

const CAPS = [
  { t: "Представь", s: 0, e: 0.78 },
  { t: "одно приложение,", s: 0.78, e: 2.08 },
  { t: "где есть ВСЁ", s: 2.08, e: 2.95, lime: true },
  { t: "мессенджер", s: 2.95, e: 3.82, lime: true },
  { t: "нейросети", s: 3.82, e: 4.6, lime: true },
  { t: "продвижение", s: 4.6, e: 5.55, lime: true },
  { t: "и заработок", s: 5.55, e: 6.42, lime: true },
  { t: "без ВПН", s: 6.42, e: 6.94, lime: true },
  { t: "без блокировок", s: 6.94, e: 8.07 },
  { t: "полностью безопасно", s: 8.07, e: 9.63, lime: true },
  { t: "контент", s: 9.63, e: 10.23, lime: true },
  { t: "в один клик", s: 10.23, e: 11.02, lime: true },
  { t: "без подписок", s: 11.02, e: 11.97 },
  { t: "и команд", s: 11.97, e: 12.58 },
  { t: "бесплатное обучение", s: 12.58, e: 14.14, lime: true },
  { t: "сертификат", s: 14.14, e: 15.01, lime: true },
  { t: "и доход с 1-го дня", s: 15.01, e: 16.48, lime: true },
];
const BLOBPATH = [
  { f: 0, x: 30, y: 30 }, { f: 90, x: 70, y: 25 }, { f: 195, x: 25, y: 40 },
  { f: 290, x: 75, y: 45 }, { f: 380, x: 35, y: 30 }, { f: 500, x: 50, y: 45 }, { f: 570, x: 50, y: 45 },
];

export const OkoReel: React.FC = () => {
  const f = useCurrentFrame(); const { fps } = useVideoConfig();
  const endSp = spring({ frame: f - 500, fps, config: { damping: 13 } });
  const pulse = 1 + Math.sin(f / 10) * 0.03;
  return (
    <AbsoluteFill style={{ backgroundColor: "#070707" }}>
      <style dangerouslySetInnerHTML={{ __html: FONT_CSS }} />
      <ParticleField />
      <Blob path={BLOBPATH} />
      <RadialGlow x={50} y={40} />
      {f < 500 && <RingBg />}

      {/* HERO по секциям (верхняя зона) */}
      {f >= 88 && f < 192 && <SocialIcons start={92} top={420} />}
      {f >= 192 && f < 288 && <Shield start={196} />}
      {f >= 288 && f < 380 && <ClickPhone start={292} />}
      {f >= 380 && f < 500 && <Checks start={384} items={["Бесплатное обучение", "Сертификат", "Доход с первого дня"]} />}

      {/* интро-заголовок */}
      {f < 92 && (() => {
        const sp = spring({ frame: f - 6, fps, config: { damping: 14 } });
        return <div style={{ position: "absolute", top: 430, width: "100%", textAlign: "center", opacity: interpolate(f, [78, 92], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }) }}>
          <div style={{ fontFamily: BEBAS, fontSize: 150, color: "#fff", letterSpacing: 3, opacity: sp, transform: `translateY(${(1 - sp) * 40}px)` }}>ОДНО<span style={{ color: LIME }}>.</span></div>
          <div style={{ fontFamily: BEBAS, fontSize: 96, color: LIME, letterSpacing: 6, textShadow: `0 0 40px ${LIME}66` }}>ПРИЛОЖЕНИЕ</div>
        </div>;
      })()}

      {/* КАРАОКЕ поверх */}
      {f < 500 && <Karaoke caps={CAPS} />}

      <LogoHeader />

      {/* переходы */}
      <LightLeak at={90} /><LightLeak at={192} /><LightLeak at={288} /><LightLeak at={380} /><LightLeak at={500} />

      {/* финальная карточка */}
      {f >= 500 && (
        <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", background: "rgba(7,7,7,0.4)" }}>
          <Img src={staticFile("logo.png")} style={{ width: 240, transform: `scale(${(0.6 + endSp * 0.4) * pulse})`, filter: `drop-shadow(0 0 60px ${LIME})` }} />
          <div style={{ fontFamily: BEBAS, color: "#fff", fontSize: 190, letterSpacing: 8, marginTop: 8, opacity: endSp, transform: `translateY(${(1 - endSp) * 40}px)` }}>OKO</div>
          <div style={{ fontFamily: MONT, fontWeight: 800, color: LIME, fontSize: 48, letterSpacing: 8, opacity: endSp, textShadow: `0 0 30px ${LIME}88` }}>СКОРО · ПЕРЕХОДИ ПО ССЫЛКЕ</div>
        </AbsoluteFill>
      )}

      <div style={{ position: "absolute", bottom: 0, left: 0, height: 7, width: `${interpolate(f, [0, 570], [0, 100])}%`, background: LIME, boxShadow: `0 0 16px ${LIME}` }} />
    </AbsoluteFill>
  );
};
