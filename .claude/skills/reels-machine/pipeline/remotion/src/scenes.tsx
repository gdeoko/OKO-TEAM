import React from "react";
import { AbsoluteFill, useCurrentFrame, interpolate, Easing, staticFile, Img, OffthreadVideo, random } from "remotion";
import { ThreeCanvas } from "@remotion/three";
import { LIME, MONT, BEBAS } from "./mograph";
const E = Easing.bezier(0.16, 1, 0.3, 1);
const NEON = `0 0 10px ${LIME}, 0 0 26px ${LIME}, 0 0 60px ${LIME}cc, 0 0 110px ${LIME}88`;

const Particles: React.FC = () => {
  const f = useCurrentFrame();
  return <AbsoluteFill>{new Array(40).fill(0).map((_, i) => {
    const x = random(`x${i}`) * 1080, y = random(`y${i}`) * 1920;
    const tw = 0.1 + 0.3 * (0.5 + 0.5 * Math.sin((f + i * 20) / 20));
    return <div key={i} style={{ position: "absolute", left: x, top: y + Math.sin((f + i * 12) / 40) * 8, color: LIME, opacity: tw, fontSize: 24, fontWeight: 700 }}>{random(`c${i}`) > 0.5 ? "×" : "+"}</div>;
  })}</AbsoluteFill>;
};

const Chrome3D: React.FC<{ pos?: [number, number, number]; scale?: number }> = ({ pos = [0, 0, 0], scale = 1.6 }) => {
  const f = useCurrentFrame();
  return <ThreeCanvas width={1080} height={1920} style={{ background: "transparent" }}>
    <ambientLight intensity={1} />
    <directionalLight position={[4, 6, 6]} intensity={3.2} />
    <pointLight position={[-4, 2, 5]} intensity={3} color={LIME} />
    <pointLight position={[4, -3, 3]} intensity={2} color="#ffffff" />
    <mesh rotation={[f * 0.02, f * 0.03, 0.2]} scale={scale} position={pos}>
      <torusKnotGeometry args={[1, 0.34, 180, 44]} />
      <meshStandardMaterial color={LIME} metalness={0.92} roughness={0.12} />
    </mesh>
  </ThreeCanvas>;
};

export const IntroScene: React.FC = () => {
  const f = useCurrentFrame();
  const s = interpolate(f, [0, 16], [0.6, 1], { extrapolateRight: "clamp", easing: E });
  const o = interpolate(f, [0, 14], [0, 1], { extrapolateRight: "clamp" });
  const sub = interpolate(f, [18, 34], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: E });
  return (
    <AbsoluteFill style={{ background: "radial-gradient(80% 60% at 50% 40%, #14170d, #080808 60%, #050505)" }}>
      <Particles />
      <AbsoluteFill style={{ top: -120 }}><Chrome3D scale={1.7} /></AbsoluteFill>
      <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", top: 260 }}>
        <div style={{ fontFamily: BEBAS, fontSize: 360, color: LIME, letterSpacing: 6, textShadow: NEON, transform: `scale(${s})`, opacity: o }}>OKO</div>
        <div style={{ fontFamily: MONT, fontWeight: 800, fontSize: 48, color: "#fff", letterSpacing: 8, marginTop: -30, opacity: sub, transform: `translateY(${(1 - sub) * 30}px)` }}>ОДНО ПРИЛОЖЕНИЕ · ВСЁ</div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

export const BubbleScene: React.FC = () => {
  const f = useCurrentFrame();
  const bs = interpolate(f, [4, 22], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: E });
  const float = Math.sin(f / 22) * 16;
  return (
    <AbsoluteFill style={{ backgroundColor: "#070707" }}>
      <OffthreadVideo src={staticFile("clips/c05.mp4")} muted style={{ width: "100%", height: "100%", objectFit: "cover", filter: "contrast(1.15) saturate(1.1) brightness(0.7)" }} />
      <AbsoluteFill style={{ background: "linear-gradient(180deg,rgba(7,7,7,.5),transparent 40%,rgba(7,7,7,.9))" }} />
      {/* круглый b-roll пузырь с глоу-кольцом */}
      <div style={{ position: "absolute", top: 300 + float, left: "50%", marginLeft: -280, width: 560, height: 560, borderRadius: "50%", overflow: "hidden", border: `5px solid ${LIME}`, boxShadow: `0 0 70px ${LIME}88, 0 30px 80px #000a`, transform: `scale(${bs})` }}>
        <OffthreadVideo src={staticFile("clips/c03.mp4")} muted style={{ width: "100%", height: "100%", objectFit: "cover" }} />
      </div>
      <div style={{ position: "absolute", top: 200, left: "50%", marginLeft: 150, transform: `scale(${bs})`, fontFamily: BEBAS, fontSize: 150, color: LIME, textShadow: NEON }}>+300%</div>
      <div style={{ position: "absolute", bottom: 470, width: "100%", textAlign: "center", fontFamily: MONT, fontWeight: 800, fontSize: 84, color: "#fff", textShadow: "0 6px 26px #000d" }}>РЕАЛЬНЫЙ <span style={{ color: LIME }}>РОСТ</span></div>
    </AbsoluteFill>
  );
};

export const StatScene: React.FC = () => {
  const f = useCurrentFrame();
  const num = Math.round(interpolate(f, [8, 46], [0, 150], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: E }));
  const o = interpolate(f, [0, 12], [0, 1], { extrapolateRight: "clamp" });
  return (
    <AbsoluteFill style={{ background: "radial-gradient(70% 60% at 50% 45%, #14170d, #070707 65%)" }}>
      <Particles />
      <AbsoluteFill style={{ top: 300 }}><Chrome3D scale={1.1} pos={[2.6, 0, 0]} /></AbsoluteFill>
      <AbsoluteFill style={{ alignItems: "center", justifyContent: "center" }}>
        <div style={{ fontFamily: MONT, fontWeight: 800, fontSize: 50, color: "#fff", letterSpacing: 3, opacity: o }}>УЖЕ БОЛЕЕ</div>
        <div style={{ fontFamily: BEBAS, fontSize: 460, color: LIME, lineHeight: 0.85, textShadow: NEON }}>{num}+</div>
        <div style={{ fontFamily: MONT, fontWeight: 800, fontSize: 64, color: "#fff", letterSpacing: 6, opacity: o }}>КЛИЕНТОВ</div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
