import React from "react";
import { AbsoluteFill, Img, interpolate, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { Т } from "./dvizh";
import { знак, сид } from "./tipo";

/** Восемь непохожих фонов. Режиссёр не ставит один и тот же два раза рядом. */
export const ФОНЫ = ["сетка", "полосы", "волны", "соты", "лучи", "искры", "дуги", "шторы"];

const Слой: React.FC<{ стиль: React.CSSProperties }> = ({ стиль }) => <AbsoluteFill style={стиль} />;

const Сетка: React.FC<{ ш: any; тон: string; ход: number; frame: number; з: number }> = ({ ш, тон, frame, з }) => (
  <AbsoluteFill style={{ perspective: 820 }}>
    <div style={{
      position: "absolute", left: "-45%", right: "-45%", bottom: "-28%", height: "150%",
      transform: `rotateX(${66 + сид(ш.id, "gx") * 12}deg) translateY(${(frame * 2.6 * з) % 160}px)`,
      transformOrigin: "50% 100%",
      backgroundImage: `linear-gradient(${тон}33 1px, transparent 1px), linear-gradient(90deg, ${тон}26 1px, transparent 1px)`,
      backgroundSize: "160px 160px",
      maskImage: "linear-gradient(to top, rgba(0,0,0,0.92) 0%, transparent 70%)",
      WebkitMaskImage: "linear-gradient(to top, rgba(0,0,0,0.92) 0%, transparent 70%)",
    }} />
  </AbsoluteFill>
);

const Полосы: React.FC<{ ш: any; тон: string; frame: number; з: number }> = ({ ш, тон, frame, з }) => {
  const угол = Math.round(сид(ш.id, "pa") * 60) + (з > 0 ? 100 : 200);
  return (
    <Слой стиль={{
      opacity: 0.2,
      backgroundImage: `repeating-linear-gradient(${угол}deg, ${тон}66 0 3px, transparent 3px 92px)`,
      translate: `${(frame * 6 * з) % 184}px ${(frame * 2) % 184}px`,
    }} />
  );
};

const Волны: React.FC<{ ш: any; тон: string; frame: number; з: number }> = ({ ш, тон, frame, з }) => (
  <AbsoluteFill style={{ opacity: 0.5 }}>
    {new Array(7).fill(0).map((_, i) => {
      const фаза = frame / (34 + i * 7);
      return (
        <div key={i} style={{
          position: "absolute", left: "-10%", right: "-10%",
          top: `${8 + i * 13 + Math.sin(фаза + i) * 4}%`, height: 2,
          background: `linear-gradient(90deg, transparent, ${i % 2 ? Т.акцент2 : тон}88, transparent)`,
          transform: `rotate(${Math.sin(фаза * 0.7 + i) * 4 * з}deg) scaleX(${1 + Math.sin(фаза) * 0.08})`,
        }} />
      );
    })}
  </AbsoluteFill>
);

const Соты: React.FC<{ ш: any; тон: string; frame: number; з: number }> = ({ ш, тон, frame, з }) => (
  <AbsoluteFill style={{ opacity: 0.26 }}>
    {new Array(30).fill(0).map((_, i) => {
      const кол = 6;
      const x = (i % кол) * 17 + (Math.floor(i / кол) % 2 ? 8 : 0);
      const y = Math.floor(i / кол) * 19;
      const п = (frame / 12 + i * 0.6) % 12;
      return (
        <div key={i} style={{
          position: "absolute", left: `${x - 4}%`, top: `${y - 6}%`, width: 150, height: 150,
          clipPath: "polygon(25% 5%, 75% 5%, 100% 50%, 75% 95%, 25% 95%, 0% 50%)",
          background: `${i % 3 === 0 ? Т.акцент2 : тон}${п < 3 ? "3A" : "12"}`,
          transform: `translateY(${Math.sin(frame / 40 + i) * 10 * з}px) scale(${0.9 + (п < 3 ? 0.12 : 0)})`,
        }} />
      );
    })}
  </AbsoluteFill>
);

const Лучи: React.FC<{ ш: any; тон: string; frame: number; з: number }> = ({ ш, тон, frame, з }) => (
  <AbsoluteFill style={{ opacity: 0.4 }}>
    {new Array(12).fill(0).map((_, i) => (
      <div key={i} style={{
        position: "absolute", left: "50%", top: "52%", width: "140%", height: 3,
        transformOrigin: "0% 50%",
        transform: `rotate(${i * 30 + frame * 0.35 * з}deg)`,
        background: `linear-gradient(90deg, ${i % 2 ? Т.акцент2 : тон}55, transparent 62%)`,
      }} />
    ))}
  </AbsoluteFill>
);

const Искры: React.FC<{ ш: any; тон: string; frame: number; з: number }> = ({ ш, тон, frame, з }) => {
  const { width, height } = useVideoConfig();
  return (
    <AbsoluteFill>
      {new Array(34).fill(0).map((_, i) => {
        const x = сид(ш.id, "ix" + i) * width;
        const ск = 0.7 + сид(ш.id, "iv" + i) * 2.6;
        const y = ((сид(ш.id, "iy" + i) * height + frame * ск * з * 2.4) % (height + 120)) - 60;
        const r = 1 + сид(ш.id, "ir" + i) * 3;
        return <div key={i} style={{
          position: "absolute", left: x, top: y, width: r * 2, height: r * 2, borderRadius: 9,
          background: i % 5 === 0 ? тон : "#D7E6FF",
          opacity: 0.14 + сид(ш.id, "io" + i) * 0.45,
          boxShadow: i % 5 === 0 ? `0 0 14px ${тон}` : "none",
        }} />;
      })}
    </AbsoluteFill>
  );
};

const Дуги: React.FC<{ ш: any; тон: string; frame: number; з: number }> = ({ ш, тон, frame, з }) => (
  <AbsoluteFill style={{ opacity: 0.55 }}>
    {new Array(5).fill(0).map((_, i) => {
      const р = 420 + i * 230;
      return (
        <div key={i} style={{
          position: "absolute", left: "50%", top: "58%", width: р, height: р, marginLeft: -р / 2,
          marginTop: -р / 2, borderRadius: 999,
          border: `1px solid ${i % 2 ? Т.акцент2 : тон}${i === 1 ? "55" : "26"}`,
          transform: `rotate(${frame * (0.2 + i * 0.05) * з}deg) scale(${1 + Math.sin(frame / 50 + i) * 0.03})`,
          borderTopColor: "transparent", borderRightColor: i % 2 ? "transparent" : undefined,
        }} />
      );
    })}
  </AbsoluteFill>
);

const Шторы: React.FC<{ ш: any; тон: string; frame: number; з: number }> = ({ ш, тон, frame, з }) => (
  <AbsoluteFill>
    {new Array(9).fill(0).map((_, i) => {
      const ход = ((frame * (1.4 + i * 0.22) * з) % 2200) / 2200;
      return (
        <div key={i} style={{
          position: "absolute", top: 0, bottom: 0, left: `${i * 11.5}%`, width: "9%",
          background: `linear-gradient(180deg, transparent, ${i % 3 === 0 ? Т.акцент2 : тон}${i % 2 ? "1F" : "12"}, transparent)`,
          transform: `translateY(${(ход - 0.5) * 420}px)`,
        }} />
      );
    })}
  </AbsoluteFill>
);

/** Ключ-арт как фактура: сильно затемнён, двоится в цвет и всегда движется. */
const Фактура: React.FC<{ ш: any; тон: string; ход: number; з: number }> = ({ ш, тон, ход, з }) => (
  <AbsoluteFill style={{ overflow: "hidden", opacity: 0.82 }}>
    <Img src={staticFile("kadr/" + ш.фактура)} style={{
      position: "absolute", width: "128%", height: "128%", objectFit: "cover",
      left: `${-14 + з * ход * 7}%`, top: `${-14 - ход * 6}%`,
      transform: `scale(${1.02 + ход * 0.07})`,
      filter: "grayscale(0.4) contrast(1.2) brightness(0.72)",
    }} />
    <AbsoluteFill style={{ background: `linear-gradient(${120 + сид(ш.id, "dg") * 120}deg, ${тон}5C, ${Т.акцент2}3D)`, mixBlendMode: "color" }} />
    <AbsoluteFill style={{ background: `radial-gradient(76% 76% at 50% 50%, ${Т.фон}55 10%, ${Т.фон}E6 100%)` }} />
  </AbsoluteFill>
);

/** Фон шота целиком: своё состояние на каждый рез, повторов рядом нет. */
export const Фон: React.FC<{ ш: any; тон?: string }> = ({ ш, тон = Т.акцент }) => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const ход = interpolate(frame, [0, durationInFrames], [0, 1]);
  const з = знак(ш.id, "fd");
  const нx = сид(ш.id, "fx") * 100;
  const нy = сид(ш.id, "fy") * 100;
  const светлый = (ш.свет ?? 0) === 1;
  const вид = ш.фон || "сетка";
  return (
    <AbsoluteFill style={{ backgroundColor: Т.фон, overflow: "hidden" }}>
      <Слой стиль={{
        background:
          `radial-gradient(${светлый ? 60 : 44}% ${светлый ? 62 : 48}% at ${нx + ход * з * 16}% ${нy + ход * 9}%, ${тон}${светлый ? "7A" : "4A"} 0%, transparent ${светлый ? 76 : 68}%),` +
          `radial-gradient(40% 44% at ${100 - нx}% ${100 - нy - ход * 12}%, ${Т.акцент2}${светлый ? "4A" : "30"} 0%, transparent 70%)`,
      }} />
      {ш.фактура ? <Фактура ш={ш} тон={тон} ход={ход} з={з} /> : null}
      {вид === "сетка" ? <Сетка ш={ш} тон={тон} ход={ход} frame={frame} з={з} /> : null}
      {вид === "полосы" ? <Полосы ш={ш} тон={тон} frame={frame} з={з} /> : null}
      {вид === "волны" ? <Волны ш={ш} тон={тон} frame={frame} з={з} /> : null}
      {вид === "соты" ? <Соты ш={ш} тон={тон} frame={frame} з={з} /> : null}
      {вид === "лучи" ? <Лучи ш={ш} тон={тон} frame={frame} з={з} /> : null}
      {вид === "искры" ? <Искры ш={ш} тон={тон} frame={frame} з={з} /> : null}
      {вид === "дуги" ? <Дуги ш={ш} тон={тон} frame={frame} з={з} /> : null}
      {вид === "шторы" ? <Шторы ш={ш} тон={тон} frame={frame} з={з} /> : null}
      <Слой стиль={{ background: "radial-gradient(80% 80% at 50% 46%, transparent 36%, rgba(0,0,0,0.8) 100%)" }} />
    </AbsoluteFill>
  );
};
