import React from "react";
import { AbsoluteFill, Img, OffthreadVideo, interpolate, random, staticFile, useCurrentFrame, useVideoConfig } from "remotion";

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

/** Общий ход камеры: сцена едет всегда, даже когда «ничего не происходит». */
export const ходКамеры = (frame: number, сид = 1) => {
  const t = frame / 25;
  return {
    x: Math.sin(t * 0.21 + сид) * 26 + Math.sin(t * 0.07) * 14,
    y: Math.cos(t * 0.17 + сид * 1.7) * 18,
    z: Math.sin(t * 0.09 + сид) * 40,
    пов: Math.sin(t * 0.12 + сид) * 1.6,
  };
};

/** Глубина: сетка уходит вдаль и постоянно едет на зрителя. */
const Сетка: React.FC<{ тон: string }> = ({ тон }) => {
  const frame = useCurrentFrame();
  const бег = (frame * 1.6) % 160;
  return (
    <AbsoluteFill style={{ perspective: 900, overflow: "hidden" }}>
      <div style={{
        position: "absolute", left: "-30%", right: "-30%", bottom: "-18%", height: "120%",
        transform: `rotateX(74deg) translateZ(0px) translateY(${бег}px)`,
        transformOrigin: "50% 100%",
        backgroundImage:
          `linear-gradient(${тон}33 1px, transparent 1px),` +
          `linear-gradient(90deg, ${тон}26 1px, transparent 1px)`,
        backgroundSize: "160px 160px",
        maskImage: "linear-gradient(to top, rgba(0,0,0,0.9) 0%, transparent 72%)",
        WebkitMaskImage: "linear-gradient(to top, rgba(0,0,0,0.9) 0%, transparent 72%)",
      }} />
    </AbsoluteFill>
  );
};

/** Пыль в воздухе: сорок частиц, у каждой свой путь и своя скорость. */
const Пыль: React.FC<{ сколько?: number }> = ({ сколько = 46 }) => {
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();
  const точки = new Array(сколько).fill(0).map((_, i) => {
    const скорость = 0.25 + random("v" + i) * 0.8;
    const x = (random("x" + i) * 1.2 - 0.1) * width + Math.sin(frame / (40 + i)) * 40;
    const y = ((random("y" + i) * height + frame * скорость * 1.4) % (height + 120)) - 60;
    const р = 1 + random("r" + i) * 2.6;
    const я = 0.12 + random("o" + i) * 0.4;
    return { x, y, р, я, i };
  });
  return (
    <AbsoluteFill>
      {точки.map((т) => (
        <div key={т.i} style={{
          position: "absolute", left: т.x, top: т.y, width: т.р * 2, height: т.р * 2,
          borderRadius: 999, background: "#CFE4FF", opacity: т.я,
          filter: "blur(0.4px)",
        }} />
      ))}
    </AbsoluteFill>
  );
};

/** Живой фон: два цветных пятна в движении, сетка, пыль, виньетка. */
export const Сцена: React.FC<{ тон?: string; сид?: number }> = ({ тон = Т.акцент, сид = 1 }) => {
  const frame = useCurrentFrame();
  const t = frame / 25;
  const x1 = 22 + Math.sin(t * 0.13 + сид) * 12;
  const y1 = 30 + Math.cos(t * 0.1 + сид) * 10;
  const x2 = 78 + Math.cos(t * 0.08 + сид) * 11;
  const y2 = 70 + Math.sin(t * 0.12 + сид) * 9;
  const к = ходКамеры(frame, сид);
  return (
    <AbsoluteFill style={{ backgroundColor: Т.фон, overflow: "hidden" }}>
      <AbsoluteFill style={{ transform: `translate(${к.x * 0.4}px, ${к.y * 0.4}px) scale(1.06)` }}>
        <AbsoluteFill style={{
          background:
            `radial-gradient(46% 50% at ${x1}% ${y1}%, ${тон}40 0%, transparent 70%),` +
            `radial-gradient(42% 46% at ${x2}% ${y2}%, ${Т.акцент2}2E 0%, transparent 72%)`,
        }} />
        <Сетка тон={тон} />
        <Пыль />
      </AbsoluteFill>
      <AbsoluteFill style={{
        background: "radial-gradient(74% 74% at 50% 46%, transparent 38%, rgba(0,0,0,0.78) 100%)" }} />
    </AbsoluteFill>
  );
};

/**
 * Предмет с вырезом, который живёт в кадре: качается, поворачивается,
 * подсвечен снизу. Плоская картинка, но ведёт себя как объём.
 */
export const Предмет: React.FC<{
  файл: string; размер?: number; сид?: number; x?: number; y?: number;
  поворот?: number; задержка?: number; тон?: string;
}> = ({ файл, размер = 560, сид = 1, x = 0, y = 0, поворот = 16, задержка = 0, тон = Т.акцент }) => {
  const frame = useCurrentFrame();
  const t = (frame - задержка) / 25;
  const вход = interpolate(frame, [задержка, задержка + 18], [0, 1],
                           { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const качание = Math.sin(t * 0.9 + сид) * 10;
  const кивок = Math.cos(t * 0.7 + сид) * 5;
  const всплытие = Math.sin(t * 0.8 + сид * 2) * 14;
  const масштаб = 0.94 + вход * 0.06 + Math.sin(t * 0.5) * 0.012;
  return (
    <div style={{
      position: "absolute", left: x, top: y, perspective: 1400,
      opacity: вход, transform: `translateY(${(1 - вход) * 40 + всплытие}px)`,
    }}>
      <div style={{
        position: "absolute", inset: "12%", borderRadius: "50%",
        background: `radial-gradient(circle, ${тон}55 0%, transparent 68%)`,
        filter: "blur(28px)", transform: `scale(${1 + Math.sin(t) * 0.06})`,
      }} />
      <div style={{
        position: "relative", width: размер, height: размер,
        transform: `rotateY(${качание + поворот * Math.sin(t * 0.33)}deg) rotateX(${кивок}deg) scale(${масштаб})`,
      }}>
        <Img src={staticFile(файл)} style={{
          width: размер, height: размер, objectFit: "contain", display: "block",
          filter: `drop-shadow(0 26px 40px rgba(0,0,0,0.7)) drop-shadow(0 0 30px ${тон}44)`,
        }} />
        {/* Блик идёт по силуэту предмета: маска это он сам, поэтому свет
            остаётся на корпусе и никогда не вылезает прямоугольником. */}
        <div style={{
          position: "absolute", inset: 0, pointerEvents: "none",
          maskImage: `url(${staticFile(файл)})`,
          WebkitMaskImage: `url(${staticFile(файл)})`,
          maskSize: "contain", WebkitMaskSize: "contain",
          maskRepeat: "no-repeat", WebkitMaskRepeat: "no-repeat",
          maskPosition: "center", WebkitMaskPosition: "center",
          background: `linear-gradient(${105 + Math.sin(t * 0.4) * 20}deg,
            transparent ${((t * 16) % 170) - 30}%,
            rgba(255,255,255,0.40) ${((t * 16) % 170) - 12}%,
            ${тон}55 ${((t * 16) % 170) - 4}%,
            transparent ${((t * 16) % 170) + 14}%)`,
          mixBlendMode: "screen",
        }} />
      </div>
    </div>
  );
};

/** Заголовок, выходящий по словам, с лёгким пролётом. */
export const Строка: React.FC<{
  текст: string; размер?: number; вес?: number; цвет?: string; задержка?: number;
  шаг?: number; ширина?: number; шрифт?: string; интер?: number;
}> = ({ текст, размер = 76, вес = 800, цвет = Т.текст, задержка = 0, шаг = 2,
        ширина = 1180, шрифт = Т.шапка, интер = 1.07 }) => {
  const frame = useCurrentFrame();
  const слова = текст.split(" ");
  return (
    <div style={{ fontFamily: шрифт, fontSize: размер, fontWeight: вес, color: цвет,
                  lineHeight: интер, maxWidth: ширина, letterSpacing: "-0.016em",
                  perspective: 900 }}>
      {слова.map((с, i) => {
        const п = задержка + i * шаг;
        const д = interpolate(frame, [п, п + 12], [0, 1],
                              { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
        return (
          <span key={i} style={{
            display: "inline-block", marginRight: "0.28em", opacity: д,
            transform: `translateY(${(1 - д) * 26}px) rotateX(${(1 - д) * -40}deg)`,
          }}>{с}</span>
        );
      })}
    </div>
  );
};

/** Метка-пилюля с живым пульсом. */
export const Метка: React.FC<{ текст: string; задержка?: number; тон?: string }> = ({
  текст, задержка = 0, тон = Т.акцент,
}) => {
  const frame = useCurrentFrame();
  const д = interpolate(frame, [задержка, задержка + 12], [0, 1],
                        { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const пульс = 0.6 + Math.abs(Math.sin((frame - задержка) / 18)) * 0.4;
  return (
    <div style={{
      display: "inline-flex", alignItems: "center", gap: 12, opacity: д,
      transform: `translateX(${(1 - д) * -24}px)`,
      padding: "12px 22px", borderRadius: 999, border: `1px solid ${тон}59`,
      background: `${тон}1A`, color: Т.текст, fontFamily: Т.корпус, fontSize: 28,
      fontWeight: 500, marginRight: 14, marginBottom: 14,
    }}>
      <span style={{ width: 9, height: 9, borderRadius: 9, background: тон, opacity: пульс,
                     boxShadow: `0 0 ${10 * пульс}px ${тон}` }} />
      {текст}
    </div>
  );
};


/**
 * Оживший предмет: клип снят на чистом чёрном, поэтому режим `screen`
 * убирает фон сам, без вырезания по маске. Клип короткий, он идёт петлёй
 * вперёд и назад, чтобы на стыке не было скачка.
 */
export const Оживший: React.FC<{
  файл: string; ширина?: number; x?: number; y?: number; тон?: string; длина?: number;
}> = ({ файл, ширина = 820, x = 0, y = 0, тон = Т.акцент, длина = 3 }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const появление = Math.min(1, frame / 14);
  return (
    <div style={{ position: "absolute", left: x, top: y, width: ширина,
                  height: ширина * 9 / 16 }}>
      <div style={{ position: "absolute", inset: "8%", borderRadius: "50%",
                    background: `radial-gradient(circle, ${тон}44 0%, transparent 70%)`,
                    filter: "blur(30px)" }} />
      <OffthreadVideo
        src={staticFile(файл)}
        muted
        loop
        playbackRate={0.5}
        style={{
          width: "100%", height: "100%", objectFit: "contain", opacity: появление,
          // Фон клипа почти чёрный, но не идеально: поджимаем тени контрастом,
          // режим screen убирает остаток, а мягкая маска прячет границу кадра.
          mixBlendMode: "screen",
          filter: "contrast(1.42) brightness(1.06) saturate(1.08)",
          maskImage: "radial-gradient(68% 68% at 50% 50%, #000 58%, transparent 100%)",
          WebkitMaskImage: "radial-gradient(68% 68% at 50% 50%, #000 58%, transparent 100%)",
        }}
      />
    </div>
  );
};
