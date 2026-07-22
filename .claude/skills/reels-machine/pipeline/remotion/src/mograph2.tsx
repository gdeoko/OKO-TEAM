import React from "react";
import { AbsoluteFill, useCurrentFrame, useVideoConfig, interpolate, spring, random } from "remotion";
import { LIME, MONT, BEBAS } from "./mograph";

// большой дышащий лайм-блоб, дрейфует по секциям
export const Blob: React.FC<{ path: { f: number; x: number; y: number }[] }> = ({ path }) => {
  const f = useCurrentFrame();
  let x = path[0].x, y = path[0].y;
  for (let i = 0; i < path.length - 1; i++) {
    if (f >= path[i].f && f <= path[i + 1].f) {
      const t = interpolate(f, [path[i].f, path[i + 1].f], [0, 1]);
      x = interpolate(t, [0, 1], [path[i].x, path[i + 1].x]);
      y = interpolate(t, [0, 1], [path[i].y, path[i + 1].y]);
    }
  }
  return <AbsoluteFill style={{ background: `radial-gradient(circle at ${x}% ${y}%, ${LIME}33 0%, transparent 32%)`, filter: "blur(30px)" }} />;
};

// вращающееся кольцо-контур за субтитрами
export const RingBg: React.FC = () => {
  const f = useCurrentFrame();
  return (
    <AbsoluteFill style={{ alignItems: "center", justifyContent: "center" }}>
      <div style={{ width: 900, height: 900, borderRadius: "50%", border: `2px solid ${LIME}22`, transform: `rotate(${f * 0.4}deg)`, boxShadow: `0 0 80px ${LIME}11 inset` }} />
      <div style={{ position: "absolute", width: 640, height: 640, borderRadius: "50%", border: `1px dashed ${LIME}30`, transform: `rotate(${-f * 0.6}deg)` }} />
    </AbsoluteFill>
  );
};

// караоке-субтитр: большое слово по центру, ключевые — лайм, поп-анимация
export const Karaoke: React.FC<{ caps: { t: string; s: number; e: number; lime?: boolean }[] }> = ({ caps }) => {
  const f = useCurrentFrame(); const { fps } = useVideoConfig();
  const cur = caps.find((c) => f / fps >= c.s && f / fps < c.e);
  if (!cur) return null;
  const local = f - cur.s * fps;
  const pop = spring({ frame: local, fps, config: { damping: 12, stiffness: 200 } });
  return (
    <div style={{ position: "absolute", top: 820, width: "100%", textAlign: "center", padding: "0 60px" }}>
      <span style={{
        display: "inline-block", fontFamily: MONT, fontWeight: 800, fontSize: 96,
        color: cur.lime ? LIME : "#fff", letterSpacing: 1, lineHeight: 1.05,
        transform: `translateY(${(1 - pop) * 30}px) scale(${0.86 + pop * 0.14})`,
        textShadow: cur.lime ? `0 0 46px ${LIME}, 0 0 16px ${LIME}88` : "0 8px 34px #000c",
      }}>{cur.t.toUpperCase()}</span>
    </div>
  );
};

// щит (безопасность)
export const Shield: React.FC<{ start: number }> = ({ start }) => {
  const f = useCurrentFrame(); const { fps } = useVideoConfig();
  const sp = spring({ frame: f - start, fps, config: { damping: 12 } });
  const pulse = 1 + Math.sin(f / 9) * 0.04;
  return (
    <div style={{ position: "absolute", top: 380, width: "100%", textAlign: "center", opacity: sp, transform: `scale(${(0.5 + sp * 0.5) * pulse})` }}>
      <svg width="260" height="300" viewBox="0 0 100 116" style={{ filter: `drop-shadow(0 0 40px ${LIME})` }}>
        <path d="M50 4 L92 20 V56 C92 84 72 104 50 112 C28 104 8 84 8 56 V20 Z" fill="#0e0e0e" stroke={LIME} strokeWidth="3" />
        <path d="M32 58 L45 72 L70 40" fill="none" stroke={LIME} strokeWidth="7" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </div>
  );
};

// чекмарки-список (оффер)
export const Checks: React.FC<{ start: number; items: string[] }> = ({ start, items }) => {
  const f = useCurrentFrame(); const { fps } = useVideoConfig();
  return (
    <div style={{ position: "absolute", top: 360, width: "100%", display: "flex", flexDirection: "column", alignItems: "center", gap: 26 }}>
      {items.map((it, i) => {
        const sp = spring({ frame: f - start - i * 8, fps, config: { damping: 14 } });
        return (
          <div key={i} style={{ display: "flex", alignItems: "center", gap: 20, opacity: sp, transform: `translateX(${(1 - sp) * -60}px)` }}>
            <div style={{ width: 64, height: 64, borderRadius: 18, background: LIME, display: "flex", alignItems: "center", justifyContent: "center", boxShadow: `0 0 30px ${LIME}88` }}>
              <svg width="34" height="34" viewBox="0 0 24 24"><path d="M4 12 l5 6 L20 5" fill="none" stroke="#0a0a0a" strokeWidth="3.4" strokeLinecap="round" strokeLinejoin="round" /></svg>
            </div>
            <div style={{ fontFamily: MONT, fontWeight: 700, fontSize: 46, color: "#fff" }}>{it}</div>
          </div>
        );
      })}
    </div>
  );
};

// телефон + клик-волна (один клик)
export const ClickPhone: React.FC<{ start: number }> = ({ start }) => {
  const f = useCurrentFrame(); const { fps } = useVideoConfig();
  const sp = spring({ frame: f - start, fps, config: { damping: 13 } });
  const clickT = ((f - start) % 45) / 45;
  const ring = interpolate(clickT, [0, 1], [0, 1]);
  return (
    <div style={{ position: "absolute", top: 340, width: "100%", display: "flex", justifyContent: "center", opacity: sp, transform: `translateY(${(1 - sp) * 60}px)` }}>
      <div style={{ width: 300, height: 400, borderRadius: 40, background: "linear-gradient(160deg,#141414,#0b0b0b)", border: `2px solid ${LIME}55`, boxShadow: `0 0 60px ${LIME}22`, position: "relative", overflow: "hidden" }}>
        <div style={{ position: "absolute", inset: 0, background: `radial-gradient(circle at 50% 55%, ${LIME}18, transparent 60%)` }} />
        <div style={{ position: "absolute", top: "48%", left: "50%", width: 90, height: 90, marginLeft: -45, marginTop: -45, borderRadius: "50%", border: `3px solid ${LIME}`, opacity: 1 - ring, transform: `scale(${0.6 + ring * 1.4})` }} />
        <div style={{ position: "absolute", top: "48%", left: "50%", width: 46, height: 46, marginLeft: -23, marginTop: -23, borderRadius: "50%", background: LIME, boxShadow: `0 0 24px ${LIME}` }} />
      </div>
    </div>
  );
};
