import React from "react";
import {
  AbsoluteFill, Img, OffthreadVideo, useCurrentFrame, useVideoConfig,
  interpolate, spring, staticFile, random, delayRender, continueRender, Easing,
} from "remotion";

export const LIME = "#9AFF00";
export const MONT = "MontLocal", BEBAS = "BebasLocal", CAVEAT = "CaveatLocal", OSWALD = "OswaldLocal";
// шрифты встроены base64 (src/fonts.ts) и подключаются <style> в композиции

// ---- анимированное тёмное поле частиц (× и +) ----
export const ParticleField: React.FC<{ tint?: string }> = ({ tint = LIME }) => {
  const f = useCurrentFrame();
  const cells = 48;
  return (
    <AbsoluteFill style={{ background: "radial-gradient(120% 90% at 50% 30%, #16160f 0%, #0b0b0b 60%, #060606 100%)" }}>
      {new Array(cells).fill(0).map((_, i) => {
        const x = random(`x${i}`) * 1080, y = random(`y${i}`) * 1920;
        const drift = Math.sin((f + i * 12) / 40) * 8;
        const tw = 0.15 + 0.35 * (0.5 + 0.5 * Math.sin((f + i * 20) / 22));
        const ch = random(`c${i}`) > 0.5 ? "×" : "+";
        return <div key={i} style={{ position: "absolute", left: x, top: y + drift, color: tint, opacity: tw, fontSize: 26, fontWeight: 700 }}>{ch}</div>;
      })}
    </AbsoluteFill>
  );
};

// ---- дышащий радиальный глоу ----
export const RadialGlow: React.FC<{ x?: number; y?: number; color?: string }> = ({ x = 50, y = 40, color = LIME }) => {
  const f = useCurrentFrame();
  const r = 40 + Math.sin(f / 18) * 8;
  return <AbsoluteFill style={{ background: `radial-gradient(circle at ${x}% ${y}%, ${color}22 0%, transparent ${r}%)` }} />;
};

// ---- лайт-лик / блум-вспышка (переход) ----
export const LightLeak: React.FC<{ at: number; color?: string }> = ({ at, color = "#ffffff" }) => {
  const f = useCurrentFrame();
  const o = interpolate(f, [at - 6, at, at + 10], [0, 0.9, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const streak = interpolate(f, [at - 6, at + 10], [-30, 30]);
  return (
    <>
      <AbsoluteFill style={{ background: `radial-gradient(circle at 50% 45%, ${color} 0%, transparent 55%)`, opacity: o, mixBlendMode: "screen" }} />
      <AbsoluteFill style={{ background: `linear-gradient(${streak + 100}deg, transparent 40%, ${LIME}88 50%, transparent 60%)`, opacity: o * 0.8, mixBlendMode: "screen" }} />
    </>
  );
};

// ---- кинетические слова (влетают по одному) ----
export const KineticWords: React.FC<{ words: { t: string; lime?: boolean }[]; start: number; step?: number; size?: number; font?: string; top?: number }> =
  ({ words, start, step = 8, size = 120, font = BEBAS, top = 760 }) => {
    const f = useCurrentFrame(); const { fps } = useVideoConfig();
    return (
      <div style={{ position: "absolute", top, width: "100%", textAlign: "center", lineHeight: 0.98 }}>
        {words.map((w, i) => {
          const s = start + i * step;
          const sp = spring({ frame: f - s, fps, config: { damping: 13, stiffness: 160 } });
          const blur = interpolate(sp, [0, 1], [12, 0]);
          return <span key={i} style={{ display: "inline-block", margin: "0 14px", fontFamily: font, fontSize: size, color: w.lime ? LIME : "#fff", opacity: sp, transform: `translateY(${(1 - sp) * 40}px) scale(${0.8 + sp * 0.2})`, filter: `blur(${blur}px)`, textShadow: w.lime ? `0 0 40px ${LIME}88` : "0 6px 30px #000a" }}>{w.t}</span>;
        })}
      </div>
    );
  };

// ---- скрипт-акцент (рукописный, лайм, «прорисовывается») ----
export const ScriptAccent: React.FC<{ text: string; start: number; top: number }> = ({ text, start, top }) => {
  const f = useCurrentFrame(); const { fps } = useVideoConfig();
  const sp = spring({ frame: f - start, fps, config: { damping: 16 } });
  const rot = interpolate(sp, [0, 1], [-6, -3]);
  return <div style={{ position: "absolute", top, width: "100%", textAlign: "center", fontFamily: CAVEAT, fontSize: 130, color: LIME, opacity: sp, transform: `rotate(${rot}deg) scale(${0.7 + sp * 0.3})`, textShadow: `0 0 44px ${LIME}, 0 0 12px ${LIME}` }}>{text}</div>;
};

// ---- парящая 3D-карточка статистики ----
export const StatCard: React.FC<{ start: number; value: string; label: string; thumb?: string }> = ({ start, value, label, thumb }) => {
  const f = useCurrentFrame(); const { fps } = useVideoConfig();
  const sp = spring({ frame: f - start, fps, config: { damping: 14 } });
  const tilt = Math.sin(f / 26) * 6;
  const num = Math.round(interpolate(spring({ frame: f - start - 6, fps, config: { damping: 20 } }), [0, 1], [0, parseFloat(value.replace(/\D/g, "")) || 0]));
  return (
    <div style={{ position: "absolute", top: 560, left: 130, width: 820, opacity: sp, transform: `perspective(1200px) rotateY(${tilt}deg) rotateX(${(1 - sp) * 20}deg) translateY(${(1 - sp) * 80}px)`, transformStyle: "preserve-3d" }}>
      <div style={{ background: "linear-gradient(160deg,#141414,#0c0c0c)", borderRadius: 34, border: `1.5px solid ${LIME}55`, boxShadow: `0 30px 90px #000b, 0 0 60px ${LIME}22`, padding: 40, overflow: "hidden" }}>
        {thumb && <div style={{ height: 300, borderRadius: 22, overflow: "hidden", marginBottom: 26, position: "relative" }}>
          <OffthreadVideo src={staticFile(thumb)} muted style={{ width: "100%", height: "100%", objectFit: "cover" }} />
          <AbsoluteFill style={{ background: "linear-gradient(180deg,transparent,#0c0c0ccc)" }} />
        </div>}
        <div style={{ fontFamily: BEBAS, fontSize: 150, color: LIME, lineHeight: 0.9, textShadow: `0 0 40px ${LIME}66` }}>{num.toLocaleString("ru-RU")}</div>
        <div style={{ fontFamily: MONT, fontWeight: 700, fontSize: 40, color: "#fff", marginTop: 6 }}>{label}</div>
      </div>
    </div>
  );
};

// ---- растущая инфографика (бары) ----
export const BarChart: React.FC<{ start: number; bars: { l: string; v: number }[] }> = ({ start, bars }) => {
  const f = useCurrentFrame(); const { fps } = useVideoConfig();
  const max = Math.max(...bars.map((b) => b.v));
  return (
    <div style={{ position: "absolute", bottom: 620, left: 120, width: 840, height: 620, display: "flex", alignItems: "flex-end", gap: 40 }}>
      {bars.map((b, i) => {
        const sp = spring({ frame: f - start - i * 6, fps, config: { damping: 15 } });
        const h = (b.v / max) * 520 * sp;
        const hot = i === bars.length - 1;
        return (
          <div key={i} style={{ flex: 1, textAlign: "center" }}>
            <div style={{ fontFamily: BEBAS, fontSize: 54, color: hot ? LIME : "#fff", opacity: sp }}>{Math.round(b.v * sp)}%</div>
            <div style={{ height: h, borderRadius: 16, background: hot ? `linear-gradient(${LIME},#5fbf00)` : "linear-gradient(#2a2a2a,#181818)", boxShadow: hot ? `0 0 40px ${LIME}88` : "none", border: hot ? "none" : `1px solid #ffffff18`, marginTop: 8 }} />
            <div style={{ fontFamily: MONT, fontWeight: 700, fontSize: 30, color: "#bbb", marginTop: 14 }}>{b.l}</div>
          </div>
        );
      })}
    </div>
  );
};

// ---- светящиеся иконки соцсетей (влетают) ----
const ICONS = [
  { bg: "linear-gradient(135deg,#FF0050,#FF4d4d)", label: "TT", glow: "#FF0050" },
  { bg: "linear-gradient(135deg,#0088cc,#33bbff)", label: "TG", glow: "#33bbff" },
  { bg: "linear-gradient(135deg,#FF0000,#ff5252)", label: "YT", glow: "#FF0000" },
  { bg: "linear-gradient(135deg,#C13584,#F56040)", label: "IG", glow: "#F56040" },
];
export const SocialIcons: React.FC<{ start: number; top?: number }> = ({ start, top = 640 }) => {
  const f = useCurrentFrame(); const { fps } = useVideoConfig();
  return (
    <div style={{ position: "absolute", top, width: "100%", display: "flex", justifyContent: "center", gap: 40 }}>
      {ICONS.map((ic, i) => {
        const sp = spring({ frame: f - start - i * 7, fps, config: { damping: 11, stiffness: 150 } });
        const float = Math.sin((f + i * 30) / 20) * 12;
        return <div key={i} style={{ width: 150, height: 150, borderRadius: 36, background: ic.bg, opacity: sp, transform: `translateY(${(1 - sp) * 120 + float}px) scale(${0.5 + sp * 0.5})`, boxShadow: `0 0 50px ${ic.glow}aa, 0 20px 50px #000a`, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: BEBAS, fontSize: 64, color: "#fff" }}>{ic.label}</div>;
      })}
    </div>
  );
};

// ---- бренд-лого-хедер ----
export const LogoHeader: React.FC = () => (
  <>
    <Img src={staticFile("logo.png")} style={{ position: "absolute", top: 60, left: 54, width: 84, filter: `drop-shadow(0 0 14px ${LIME}88)` }} />
    <div style={{ position: "absolute", top: 74, left: 156, fontFamily: MONT, color: "#fff", fontWeight: 800, fontSize: 34, letterSpacing: 2 }}>OKO<span style={{ color: LIME }}>.</span></div>
  </>
);
