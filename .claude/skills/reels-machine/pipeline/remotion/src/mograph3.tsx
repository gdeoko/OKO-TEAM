import React from "react";
import { AbsoluteFill, OffthreadVideo, staticFile, useCurrentFrame, useVideoConfig, interpolate, Easing, Img, random } from "remotion";
import { LIME, MONT, BEBAS } from "./mograph";

const EASE = Easing.bezier(0.16, 1, 0.3, 1);

// ---- шот: футаж с грейдом + zoom-панч + бренд-тинт + виньетка ----
export const Shot: React.FC<{ clip: string; dur: number; dir?: number }> = ({ clip, dur, dir = 1 }) => {
  const f = useCurrentFrame();
  const scale = interpolate(f, [0, dur], [1.18, 1.02], { extrapolateRight: "clamp", easing: EASE });
  const px = interpolate(f, [0, dur], [dir * -20, dir * 20], { extrapolateRight: "clamp" });
  return (
    <AbsoluteFill style={{ overflow: "hidden", backgroundColor: "#070707" }}>
      <OffthreadVideo src={staticFile(clip)} muted
        style={{ width: "100%", height: "100%", objectFit: "cover", transform: `scale(${scale}) translateX(${px}px)`, filter: "contrast(1.18) saturate(1.15) brightness(0.82)" }} />
      {/* бренд-тинт */}
      <AbsoluteFill style={{ background: LIME, mixBlendMode: "overlay", opacity: 0.12 }} />
      {/* контраст под текст */}
      <AbsoluteFill style={{ background: "linear-gradient(180deg, rgba(7,7,7,0.6) 0%, rgba(7,7,7,0.05) 30%, rgba(7,7,7,0.35) 62%, rgba(7,7,7,0.92) 100%)" }} />
      {/* виньетка */}
      <AbsoluteFill style={{ boxShadow: "inset 0 0 300px rgba(0,0,0,0.85)" }} />
    </AbsoluteFill>
  );
};

// ---- зерно ----
export const Grain: React.FC = () => {
  const f = useCurrentFrame();
  return <AbsoluteFill style={{ opacity: 0.05, mixBlendMode: "overlay", backgroundImage:
    `repeating-radial-gradient(circle at ${(f*7)%100}% ${(f*11)%100}%, #fff 0 1px, transparent 1px 3px)` }} />;
};

// ---- DOM-вспышка на стыке ----
export const Flash: React.FC = () => {
  const f = useCurrentFrame(); const { durationInFrames } = useVideoConfig();
  const o = interpolate(f, [0, durationInFrames / 2, durationInFrames], [0, 0.85, 0]);
  const streak = interpolate(f, [0, durationInFrames], [-20, 20]);
  return (
    <AbsoluteFill>
      <AbsoluteFill style={{ background: "radial-gradient(circle at 50% 45%, #fff 0%, transparent 55%)", opacity: o, mixBlendMode: "screen" }} />
      <AbsoluteFill style={{ background: `linear-gradient(${100 + streak}deg, transparent 42%, ${LIME} 50%, transparent 58%)`, opacity: o * 0.7, mixBlendMode: "screen" }} />
    </AbsoluteFill>
  );
};

// ---- ПРО-караоке: посимвольный ревил + подсветка ключевого + motion pop ----
export const ProKaraoke: React.FC<{ caps: { t: string; s: number; e: number; lime?: boolean }[] }> = ({ caps }) => {
  const f = useCurrentFrame(); const { fps } = useVideoConfig();
  const t = f / fps;
  const cur = caps.find((c) => t >= c.s && t < c.e);
  if (!cur) return null;
  const local = f - cur.s * fps;
  const dur = (cur.e - cur.s) * fps;
  // посимвольный ревил
  const chars = Math.ceil(interpolate(local, [0, Math.min(dur * 0.45, 10)], [0, cur.t.length], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }));
  const shown = cur.t.slice(0, chars);
  const pop = interpolate(local, [0, 6], [0.86, 1], { extrapolateRight: "clamp", easing: EASE });
  const rise = interpolate(local, [0, 6], [26, 0], { extrapolateRight: "clamp", easing: EASE });
  const outO = interpolate(local, [dur - 4, dur], [1, 0.85], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  return (
    <div style={{ position: "absolute", bottom: 470, width: "100%", textAlign: "center", padding: "0 70px" }}>
      {/* бэкплейт */}
      <div style={{ display: "inline-block", background: "rgba(7,7,7,0.34)", backdropFilter: "blur(4px)", borderRadius: 22, padding: "14px 34px", transform: `translateY(${rise}px) scale(${pop})`, opacity: outO, boxShadow: cur.lime ? `0 0 40px ${LIME}30` : "none" }}>
        <span style={{ fontFamily: MONT, fontWeight: 800, fontSize: 92, letterSpacing: 1, color: cur.lime ? LIME : "#fff", lineHeight: 1.02, textShadow: cur.lime ? `0 0 40px ${LIME}, 0 0 14px ${LIME}88` : "0 6px 24px #000c" }}>
          {shown.toUpperCase()}<span style={{ opacity: chars < cur.t.length ? 1 : 0, color: LIME }}>|</span>
        </span>
      </div>
    </div>
  );
};

// ---- бренд-хедер + прогресс ----
export const Header: React.FC = () => (
  <>
    <Img src={staticFile("logo.png")} style={{ position: "absolute", top: 58, left: 52, width: 78, filter: `drop-shadow(0 0 14px ${LIME})` }} />
    <div style={{ position: "absolute", top: 72, left: 148, fontFamily: MONT, color: "#fff", fontWeight: 800, fontSize: 32, letterSpacing: 2 }}>OKO<span style={{ color: LIME }}>.</span></div>
  </>
);
