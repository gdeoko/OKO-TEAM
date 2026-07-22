import React from "react";
import { AbsoluteFill, useCurrentFrame, interpolate, Easing, staticFile, Img } from "remotion";
import { ThreeCanvas } from "@remotion/three";
import * as d3 from "d3";
import { LIME, MONT, BEBAS } from "./mograph";
import { FONT_CSS } from "./fonts";

const E = Easing.bezier(0.16, 1, 0.3, 1);
const DATA = [8, 12, 11, 18, 26, 24, 38, 52, 70, 96, 140, 210];

export const HeroScene: React.FC = () => {
  const f = useCurrentFrame();
  const W = 1080, H = 1920;
  const cw = 900, ch = 620, cx = 90, cy = 1080;
  const x = d3.scaleLinear().domain([0, DATA.length - 1]).range([0, cw]);
  const y = d3.scaleLinear().domain([0, d3.max(DATA)!]).range([ch, 0]);
  const line = d3.line<number>().x((_, i) => x(i)).y((d) => y(d)).curve(d3.curveMonotoneX);
  const area = d3.area<number>().x((_, i) => x(i)).y0(ch).y1((d) => y(d)).curve(d3.curveMonotoneX);
  const pathLine = line(DATA)!, pathArea = area(DATA)!;
  const draw = interpolate(f, [10, 70], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: E });
  const total = 2600;
  const num = Math.round(interpolate(f, [10, 70], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: E }) * 210);
  const titleR = interpolate(f, [0, 12], [40, 0], { extrapolateRight: "clamp", easing: E });
  const titleO = interpolate(f, [0, 12], [0, 1], { extrapolateRight: "clamp" });

  return (
    <AbsoluteFill style={{ backgroundColor: "#070707" }}>
      <style dangerouslySetInnerHTML={{ __html: FONT_CSS }} />
      <AbsoluteFill style={{ background: "radial-gradient(90% 70% at 50% 42%, #14170d 0%, #0a0a0a 55%, #060606 100%)" }} />
      {/* сетка */}
      <svg width={W} height={H} style={{ position: "absolute" }}>
        {[0, 1, 2, 3, 4].map((i) => <line key={i} x1={cx} x2={cx + cw} y1={cy + (ch / 4) * i} y2={cy + (ch / 4) * i} stroke="#ffffff10" strokeWidth={1} />)}
      </svg>

      {/* 3D хром-акцент сверху */}
      <AbsoluteFill style={{ top: -520 }}>
        <ThreeCanvas width={W} height={H} style={{ background: "transparent" }}>
          <ambientLight intensity={1} />
          <directionalLight position={[4, 6, 6]} intensity={3} />
          <pointLight position={[-4, 2, 4]} intensity={3} color={LIME} />
          <mesh rotation={[f * 0.02, f * 0.03, 0.3]} scale={1.5} position={[2.4, 0, 0]}>
            <icosahedronGeometry args={[1, 0]} />
            <meshStandardMaterial color={LIME} metalness={0.9} roughness={0.15} />
          </mesh>
        </ThreeCanvas>
      </AbsoluteFill>

      {/* заголовок + неон-число */}
      <div style={{ position: "absolute", top: 300, width: "100%", textAlign: "center", opacity: titleO, transform: `translateY(${titleR}px)` }}>
        <div style={{ fontFamily: MONT, fontWeight: 800, color: "#fff", fontSize: 56, letterSpacing: 2 }}>РОСТ ОХВАТОВ</div>
        <div style={{ fontFamily: BEBAS, color: LIME, fontSize: 300, lineHeight: 0.9, letterSpacing: 2, textShadow: `0 0 12px ${LIME}, 0 0 40px ${LIME}, 0 0 90px ${LIME}aa` }}>×{num}</div>
      </div>

      {/* график */}
      <svg width={W} height={H} style={{ position: "absolute" }}>
        <defs>
          <linearGradient id="ag" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={LIME} stopOpacity="0.55" />
            <stop offset="100%" stopColor={LIME} stopOpacity="0" />
          </linearGradient>
          <filter id="gl"><feGaussianBlur stdDeviation="6" result="b" /><feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge></filter>
        </defs>
        <g transform={`translate(${cx},${cy})`}>
          <path d={pathArea} fill="url(#ag)" opacity={draw} />
          <path d={pathLine} fill="none" stroke={LIME} strokeWidth={7} filter="url(#gl)"
            strokeDasharray={total} strokeDashoffset={total * (1 - draw)} strokeLinecap="round" />
          {DATA.map((d, i) => (i / (DATA.length - 1) <= draw ?
            <circle key={i} cx={x(i)} cy={y(d)} r={i === DATA.length - 1 ? 16 : 7} fill={i === DATA.length - 1 ? "#fff" : LIME} stroke={LIME} strokeWidth={3} /> : null))}
        </g>
      </svg>

      {/* лого */}
      <Img src={staticFile("logo.png")} style={{ position: "absolute", top: 58, left: 54, width: 84, filter: `drop-shadow(0 0 14px ${LIME})` }} />
      <div style={{ position: "absolute", top: 74, left: 150, fontFamily: MONT, color: "#fff", fontWeight: 800, fontSize: 34, letterSpacing: 2 }}>OKO<span style={{ color: LIME }}>.</span></div>
    </AbsoluteFill>
  );
};
