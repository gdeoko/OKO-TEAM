import React from "react";
import { AbsoluteFill, Easing, Img, interpolate, random, staticFile, useCurrentFrame, useVideoConfig } from "remotion";

export const Т = {
  фон: "#06070A",
  акцент: "#7C5CFF",
  акцент2: "#22D3EE",
  тёплый: "#FFB457",
  тревога: "#FF6B6B",
  текст: "#F4F5F7",
  тихий: "#8A90A0",
  линия: "rgba(255,255,255,0.10)",
  шапка: '"Unbounded", system-ui, sans-serif',
  корпус: '"Inter", system-ui, sans-serif',
  поле: 104,
};

const ВЫХОД = Easing.bezier(0.16, 1, 0.3, 1);
const ВХОД_ВЫХОД = Easing.bezier(0.45, 0, 0.2, 1);

/** Такт: каждые 2,2 секунды в кадре обязано что-то смениться. */
export const ТАКТ = 55;

export const тактов = (кадров: number) => Math.max(1, Math.floor(кадров / ТАКТ));

/** Номер текущего такта и доля внутри него. */
export const такт = (frame: number) => ({
  номер: Math.floor(frame / ТАКТ),
  доля: (frame % ТАКТ) / ТАКТ,
});

/** Направление, которое не повторяется два такта подряд. */
const СТОРОНЫ = [
  { x: 1, y: 0 }, { x: -1, y: 0 }, { x: 0, y: 1 }, { x: 0, y: -1 },
  { x: 0.7, y: 0.7 }, { x: -0.7, y: 0.7 }, { x: 0.7, y: -0.7 }, { x: -0.7, y: -0.7 },
];

export const сторона = (сид: number, шаг: number) => {
  const i = Math.floor(random(`с${сид}-${шаг}`) * СТОРОНЫ.length);
  const j = Math.floor(random(`с${сид}-${шаг - 1}`) * СТОРОНЫ.length);
  return СТОРОНЫ[i === j ? (i + 3) % СТОРОНЫ.length : i];
};

/**
 * Камера сцены. Между тактами она идёт к новой точке, внутри такта не стоит:
 * поверх цели всегда работает медленный дрейф. Направления берутся сидом,
 * поэтому две сцены подряд не повторяют друг друга.
 */
export const камера = (frame: number, сид: number) => {
  const т = Math.floor(frame / ТАКТ);
  const доля = (frame % ТАКТ) / ТАКТ;
  const цель = (шаг: number) => {
    const с = сторона(сид, шаг);
    const сила = 26 + random(`сила${сид}${шаг}`) * 42;
    return {
      x: с.x * сила,
      y: с.y * сила * 0.6,
      s: 1 + random(`зум${сид}${шаг}`) * 0.07,
      r: (random(`пов${сид}${шаг}`) - 0.5) * 1.8,
    };
  };
  const a = цель(т);
  const b = цель(т + 1);
  const k = interpolate(доля, [0, 1], [0, 1], { easing: ВХОД_ВЫХОД });
  const t = frame / 25;
  return {
    x: a.x + (b.x - a.x) * k + Math.sin(t * 0.33 + сид) * 9,
    y: a.y + (b.y - a.y) * k + Math.cos(t * 0.27 + сид) * 7,
    s: a.s + (b.s - a.s) * k + Math.sin(t * 0.21) * 0.006,
    r: a.r + (b.r - a.r) * k + Math.sin(t * 0.18 + сид) * 0.25,
  };
};

/** Появление с заданной стороны, с перелётом и уходом. */
export const въезд = (
  frame: number, от: number, сид: number, шаг: number, длина = 14,
) => {
  const с = сторона(сид, шаг);
  const д = interpolate(frame, [от, от + длина], [0, 1],
                        { easing: ВЫХОД, extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  return {
    opacity: д,
    translate: `${(1 - д) * с.x * -90}px ${(1 - д) * с.y * -70}px`,
    scale: 0.94 + д * 0.06,
  };
};

/** Фон: четыре слоя, у каждого своя скорость и своё направление. */
export const Фон: React.FC<{ сид?: number; тон?: string }> = ({ сид = 1, тон = Т.акцент }) => {
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();
  const t = frame / 25;
  const знак = сид % 2 === 0 ? 1 : -1;
  const сетка = (frame * 1.9 * знак) % 170;
  const полосы = (frame * 3.4 * -знак) % 320;
  const x1 = 24 + Math.sin(t * 0.17 + сид) * 16;
  const y1 = 32 + Math.cos(t * 0.13 + сид) * 13;
  const x2 = 76 + Math.cos(t * 0.11 + сид * 2) * 15;
  const y2 = 68 + Math.sin(t * 0.15 + сид) * 12;
  const пыль = new Array(52).fill(0).map((_, i) => {
    const ск = 0.4 + random(`v${сид}${i}`) * 1.5;
    const вверх = i % 3 === 0;
    const x = (random(`x${сид}${i}`) * 1.15 - 0.07) * width + Math.sin(frame / (30 + i)) * 46;
    const y0 = random(`y${сид}${i}`) * height;
    const y = вверх
      ? ((y0 - frame * ск * 1.6) % (height + 140) + height + 140) % (height + 140) - 70
      : ((y0 + frame * ск * 1.6) % (height + 140)) - 70;
    return { x, y, r: 1 + random(`r${сид}${i}`) * 2.8, o: 0.1 + random(`o${сид}${i}`) * 0.45, i };
  });
  return (
    <AbsoluteFill style={{ backgroundColor: Т.фон, overflow: "hidden" }}>
      <AbsoluteFill style={{
        background:
          `radial-gradient(44% 48% at ${x1}% ${y1}%, ${тон}44 0%, transparent 70%),` +
          `radial-gradient(40% 44% at ${x2}% ${y2}%, ${Т.акцент2}2E 0%, transparent 72%)`,
      }} />
      <AbsoluteFill style={{ perspective: 900 }}>
        <div style={{
          position: "absolute", left: "-35%", right: "-35%", bottom: "-20%", height: "130%",
          transform: `rotateX(72deg) translateY(${сетка}px)`, transformOrigin: "50% 100%",
          backgroundImage:
            `linear-gradient(${тон}2E 1px, transparent 1px),` +
            `linear-gradient(90deg, ${тон}22 1px, transparent 1px)`,
          backgroundSize: "170px 170px",
          maskImage: "linear-gradient(to top, rgba(0,0,0,0.95) 0%, transparent 70%)",
          WebkitMaskImage: "linear-gradient(to top, rgba(0,0,0,0.95) 0%, transparent 70%)",
        }} />
      </AbsoluteFill>
      <AbsoluteFill style={{
        opacity: 0.1,
        backgroundImage: `repeating-linear-gradient(${знак > 0 ? 100 : 80}deg, ${Т.акцент2}66 0 2px, transparent 2px 160px)`,
        translate: `${полосы}px 0px`,
      }} />
      <AbsoluteFill>
        {пыль.map((п) => (
          <div key={п.i} style={{
            position: "absolute", left: п.x, top: п.y, width: п.r * 2, height: п.r * 2,
            borderRadius: 999, background: "#CFE4FF", opacity: п.o, filter: "blur(0.4px)",
          }} />
        ))}
      </AbsoluteFill>
      <AbsoluteFill style={{
        background: "radial-gradient(76% 76% at 50% 46%, transparent 36%, rgba(0,0,0,0.80) 100%)" }} />
    </AbsoluteFill>
  );
};

/** Вспышка на такте: короткая световая волна поперёк кадра. */
export const Вспышка: React.FC<{ сид?: number }> = ({ сид = 1 }) => {
  const frame = useCurrentFrame();
  const { номер, доля } = такт(frame);
  const сила = interpolate(доля, [0, 0.12, 0.3], [0, 0.5, 0], { extrapolateRight: "clamp" });
  const с = сторона(сид, номер);
  if (сила <= 0.001) return null;
  return (
    <AbsoluteFill style={{
      background: `linear-gradient(${с.x >= 0 ? 100 : 260}deg, transparent 35%, ${Т.акцент2}${Math.round(сила * 90).toString(16).padStart(2, "0")} 50%, transparent 65%)`,
      mixBlendMode: "screen", pointerEvents: "none",
    }} />
  );
};

/** Кинетический заголовок: слова влетают с разных сторон и дышат. */
export const Шапка: React.FC<{
  текст: string; размер?: number; от?: number; сид?: number; ширина?: number; цвет?: string;
}> = ({ текст, размер = 72, от = 0, сид = 1, ширина = 860, цвет = Т.текст }) => {
  const frame = useCurrentFrame();
  const слова = текст.split(" ");
  return (
    <div style={{ fontFamily: Т.шапка, fontSize: размер, fontWeight: 800, color: цвет,
                  lineHeight: 1.06, maxWidth: ширина, letterSpacing: "-0.018em",
                  display: "flex", flexWrap: "wrap", gap: "0 0.28em", perspective: 1000 }}>
      {слова.map((с, i) => {
        const п = от + i * 3;
        const д = interpolate(frame, [п, п + 13], [0, 1],
                              { easing: ВЫХОД, extrapolateLeft: "clamp", extrapolateRight: "clamp" });
        const ст = сторона(сид + i, i);
        const дых = Math.sin((frame - п) / 46 + i) * 2.5;
        return (
          <span key={i} style={{
            display: "inline-block", opacity: д,
            translate: `${(1 - д) * ст.x * -70}px ${(1 - д) * ст.y * -46 + дых}px`,
            rotate: `${(1 - д) * ст.y * 8}deg`,
          }}>{с}</span>
        );
      })}
    </div>
  );
};

/** Строка списка: приезжает на своём такте, потом живёт и уезжает. */
export const Строка: React.FC<{
  текст: string; номер: number; от: number; до?: number; сид?: number; тон?: string;
}> = ({ текст, номер, от, до, сид = 1, тон = Т.акцент }) => {
  const frame = useCurrentFrame();
  const вх = interpolate(frame, [от, от + 13], [0, 1],
                         { easing: ВЫХОД, extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const ух = до === undefined ? 1
    : interpolate(frame, [до, до + 11], [1, 0], { easing: ВХОД_ВЫХОД, extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const ст = сторона(сид, номер);
  const д = Math.min(вх, ух);
  if (д <= 0.001) return null;
  const плыв = Math.sin((frame - от) / 40 + номер) * 3;
  return (
    <div style={{
      display: "flex", gap: 18, alignItems: "flex-start", marginBottom: 18,
      opacity: д, translate: `${(1 - вх) * ст.x * -60 + (1 - ух) * 40}px ${(1 - вх) * ст.y * -30 + плыв}px`,
      fontFamily: Т.корпус, fontSize: 34, color: Т.текст, lineHeight: 1.32,
    }}>
      <span style={{
        marginTop: 13, width: 12, height: 12, borderRadius: 12, flex: "0 0 auto",
        background: тон, boxShadow: `0 0 ${10 + Math.abs(Math.sin(frame / 15 + номер)) * 14}px ${тон}`,
      }} />
      <span>{текст}</span>
    </div>
  );
};

/** Предмет с вырезом: вращается, дышит, по силуэту бежит блик. */
export const Предмет: React.FC<{
  файл: string; размер?: number; сид?: number; тон?: string; от?: number;
}> = ({ файл, размер = 560, сид = 1, тон = Т.акцент, от = 0 }) => {
  const frame = useCurrentFrame();
  const t = (frame - от) / 25;
  const д = interpolate(frame, [от, от + 18], [0, 1],
                        { easing: ВЫХОД, extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const к = камера(frame, сид + 40);
  const блик = ((t * 15) % 180) - 30;
  return (
    <div style={{ position: "relative", width: размер, height: размер, perspective: 1500,
                  opacity: д, translate: `${к.x * 0.5}px ${к.y * 0.6 + Math.sin(t * 0.8) * 12}px` }}>
      <div style={{
        position: "absolute", inset: "10%", borderRadius: "50%",
        background: `radial-gradient(circle, ${тон}55 0%, transparent 68%)`, filter: "blur(30px)",
        scale: 1 + Math.sin(t) * 0.08,
      }} />
      <div style={{
        position: "relative", width: размер, height: размер,
        rotate: `y ${Math.sin(t * 0.42 + сид) * 20}deg`,
        scale: 0.95 + д * 0.05 + Math.sin(t * 0.5) * 0.015,
      }}>
        <Img src={staticFile(файл)} style={{
          width: размер, height: размер, objectFit: "contain", display: "block",
          filter: `drop-shadow(0 26px 40px rgba(0,0,0,0.7)) drop-shadow(0 0 30px ${тон}44)`,
        }} />
        <div style={{
          position: "absolute", inset: 0, pointerEvents: "none",
          maskImage: `url(${staticFile(файл)})`, WebkitMaskImage: `url(${staticFile(файл)})`,
          maskSize: "contain", WebkitMaskSize: "contain",
          maskRepeat: "no-repeat", WebkitMaskRepeat: "no-repeat",
          maskPosition: "center", WebkitMaskPosition: "center",
          background: `linear-gradient(${100 + Math.sin(t * 0.4) * 22}deg, transparent ${блик}%,
            rgba(255,255,255,0.42) ${блик + 16}%, ${тон}66 ${блик + 24}%, transparent ${блик + 40}%)`,
          mixBlendMode: "screen",
        }} />
      </div>
    </div>
  );
};
