import React from "react";
import { AbsoluteFill, Img, interpolate, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { Т } from "./dvizh";
import { Строка, ВЫХОД, знак, подача, сид, текстом } from "./tipo";

/** Вещь с родной альфой: качается, поворачивается и ловит блик по силуэту. */
export const Предмет: React.FC<{ файл: string; размер: number; ш: any; тон?: string; ключ?: string }> = ({
  файл, размер, ш, тон = Т.акцент, ключ = "",
}) => {
  const frame = useCurrentFrame();
  const { durationInFrames, fps } = useVideoConfig();
  const t = frame / fps;
  const блик = ((t * 24) % 170) - 34;
  const пов = interpolate(frame, [0, durationInFrames], [-16, 16]) * знак(ш.id + ключ, "r");
  const путь = staticFile(файл);
  return (
    <div style={{ position: "relative", width: размер, height: размер, perspective: 1400 }}>
      <div style={{ position: "absolute", inset: "-6%", borderRadius: "50%",
                    background: `radial-gradient(circle, ${тон}4D 0%, ${тон}1A 42%, transparent 70%)`,
                    scale: 1 + Math.sin(t * 1.5) * 0.08 }} />
      <div style={{ position: "relative", width: размер, height: размер,
                    transform: `rotateY(${пов}deg) translateY(${Math.sin(t * 1.1) * 10}px)` }}>
        <Img src={путь} style={{ width: размер, height: размер, objectFit: "contain", display: "block",
             filter: `drop-shadow(0 20px 26px rgba(0,0,0,0.7))` }} />
        <div style={{ position: "absolute", inset: 0, maskImage: `url(${путь})`,
          WebkitMaskImage: `url(${путь})`, maskSize: "contain", WebkitMaskSize: "contain",
          maskRepeat: "no-repeat", WebkitMaskRepeat: "no-repeat", maskPosition: "center",
          WebkitMaskPosition: "center", mixBlendMode: "screen",
          background: `linear-gradient(100deg, transparent ${блик}%, rgba(255,255,255,0.45) ${блик + 14}%, ${тон}66 ${блик + 22}%, transparent ${блик + 38}%)`,
        }} />
      </div>
    </div>
  );
};

/** Плиты: камера летит сквозь параллельные планы, текст живёт на среднем. */
export const Плиты: React.FC<{ ш: any; тон: string; дети: React.ReactNode }> = ({ ш, тон, дети }) => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const ход = interpolate(frame, [0, durationInFrames], [0, 1]);
  const з = знак(ш.id, "pl");
  return (
    <AbsoluteFill style={{ perspective: 1200, perspectiveOrigin: `${50 + з * 10}% 50%` }}>
      <AbsoluteFill style={{ transformStyle: "preserve-3d",
                             transform: `translateZ(${-900 + ход * 1500}px) rotateY(${з * (10 - ход * 16)}deg)` }}>
        {new Array(6).fill(0).map((_, i) => {
          const z = -1500 + i * 420;
          const яркая = i === 3;
          return (
            <div key={i} style={{
              position: "absolute", left: "8%", right: "8%", top: "18%", bottom: "18%",
              transform: `translateZ(${z}px) translateX(${(i - 3) * 130 * з}px) rotateY(${(i - 3) * 2 * з}deg)`,
              border: `2px solid ${i % 2 ? Т.акцент2 : тон}${яркая ? "AA" : "4D"}`,
              borderRadius: 18,
              background: яркая
                ? `linear-gradient(${120 + i * 30}deg, ${тон}3D, rgba(255,255,255,0.05))`
                : `linear-gradient(${120 + i * 30}deg, ${тон}10, transparent)`,
              boxShadow: яркая ? `0 0 90px ${тон}44` : "none",
              display: "flex", alignItems: "center", justifyContent: "center", padding: 60,
            }}>{яркая ? дети : null}</div>
          );
        })}
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

/** Коридор: рамки несутся на зрителя, в конце стоит слово. */
export const Коридор: React.FC<{ ш: any; тон: string; слово: string; файл?: string }> = ({
  ш, тон, слово, файл,
}) => {
  const frame = useCurrentFrame();
  const п = подача(ш);
  const шт = 16;
  return (
    <AbsoluteFill style={{ perspective: 760, overflow: "hidden" }}>
      <AbsoluteFill style={{ background: `radial-gradient(42% 42% at 50% 50%, ${тон}3D, transparent 72%)` }} />
      <AbsoluteFill style={{ transformStyle: "preserve-3d" }}>
        {new Array(шт).fill(0).map((_, i) => {
          const z = ((frame * 26 + i * 240) % (шт * 240)) - 2600;
          const д = interpolate(z, [-2600, -200], [0, 1], { extrapolateRight: "clamp" });
          return (
            <div key={i} style={{
              position: "absolute", left: "50%", top: "50%", width: 1000, height: 600,
              marginLeft: -500, marginTop: -300, borderRadius: 24,
              border: `3px solid ${i % 3 === 0 ? Т.акцент2 : тон}${i % 2 ? "AA" : "66"}`,
              boxShadow: `0 0 40px ${i % 3 === 0 ? Т.акцент2 : тон}33`,
              transform: `translateZ(${z}px) rotate(${i * 7 + frame * 0.2}deg)`,
              opacity: д,
            }} />
          );
        })}
      </AbsoluteFill>
      <AbsoluteFill style={{ display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{
          fontFamily: п.семья, fontWeight: п.вес, fontSize: 150, letterSpacing: п.разрядка,
          color: Т.текст, textShadow: `0 0 80px ${тон}99`,
          scale: interpolate(frame, [0, 16], [1.5, 1], { easing: ВЫХОД, extrapolateRight: "clamp" }),
        }}>{текстом(слово, п)}</div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

/** Куб: на гранях слова фразы, крутится всё время шота. */
export const Куб: React.FC<{ ш: any; тон: string; грани: string[]; ребро?: number }> = ({
  ш, тон, грани, ребро = 420,
}) => {
  const frame = useCurrentFrame();
  const п = подача(ш);
  const п2 = ребро / 2;
  const стороны = [
    { t: `translateZ(${п2}px)` }, { t: `rotateY(90deg) translateZ(${п2}px)` },
    { t: `rotateY(180deg) translateZ(${п2}px)` }, { t: `rotateY(-90deg) translateZ(${п2}px)` },
    { t: `rotateX(90deg) translateZ(${п2}px)` }, { t: `rotateX(-90deg) translateZ(${п2}px)` },
  ];
  return (
    <div style={{ perspective: 1400, width: ребро, height: ребро }}>
      <div style={{
        width: ребро, height: ребро, position: "relative", transformStyle: "preserve-3d",
        transform: `rotateX(${-18 + Math.sin(frame / 60) * 8}deg) rotateY(${frame * 1.25}deg)`,
      }}>
        {стороны.map((с, i) => (
          <div key={i} style={{
            position: "absolute", inset: 0, transform: с.t, backfaceVisibility: "hidden",
            border: `1px solid ${i % 2 ? Т.акцент2 : тон}55`,
            background: `linear-gradient(${40 + i * 50}deg, ${тон}1F, rgba(255,255,255,0.03))`,
            display: "flex", alignItems: "center", justifyContent: "center", padding: 20,
            fontFamily: п.семья, fontWeight: п.вес, fontSize: 52, letterSpacing: п.разрядка,
            color: Т.текст, textAlign: "center",
          }}>{текстом(грани[i % грани.length] || "", п)}</div>
        ))}
      </div>
    </div>
  );
};

/** Карусель: вещи стоят по кругу и едут мимо камеры. */
export const Карусель: React.FC<{ ш: any; тон: string; файлы: string[] }> = ({ ш, тон, файлы }) => {
  const frame = useCurrentFrame();
  const n = файлы.length;
  const R = 470;
  return (
    <div style={{ perspective: 1500, width: 1500, height: 520 }}>
      <div style={{
        position: "relative", width: "100%", height: "100%", transformStyle: "preserve-3d",
        transform: `translateZ(-${R - 120}px) rotateX(-6deg) rotateY(${frame * 0.7}deg)`,
      }}>
        {файлы.map((ф, i) => (
          <div key={i} style={{
            position: "absolute", left: "50%", top: "50%", width: 340, height: 340,
            marginLeft: -170, marginTop: -170,
            transform: `rotateY(${(360 / n) * i}deg) translateZ(${R}px)`,
            backfaceVisibility: "hidden",
          }}>
            <Предмет файл={"kadr/m/" + ф} размер={340} ш={ш} тон={i % 2 ? Т.акцент2 : тон} ключ={"k" + i} />
          </div>
        ))}
      </div>
    </div>
  );
};

/** Орбита: вещь в центре, вокруг неё идут кольца и подписи. */
export const Орбита: React.FC<{ ш: any; тон: string; файл: string; метки: string[] }> = ({
  ш, тон, файл, метки,
}) => {
  const frame = useCurrentFrame();
  const п = подача(ш);
  return (
    <div style={{ position: "relative", width: 900, height: 640, perspective: 1200 }}>
      {new Array(3).fill(0).map((_, i) => (
        <div key={i} style={{
          position: "absolute", left: "50%", top: "50%", width: 520 + i * 150, height: 520 + i * 150,
          marginLeft: -(260 + i * 75), marginTop: -(260 + i * 75), borderRadius: 999,
          border: `1px solid ${i % 2 ? Т.акцент2 : тон}44`,
          transform: `rotateX(72deg) rotateZ(${frame * (0.6 - i * 0.14)}deg)`,
        }} />
      ))}
      <div style={{ position: "absolute", left: "50%", top: "50%", marginLeft: -170, marginTop: -170 }}>
        <Предмет файл={"kadr/m/" + файл} размер={340} ш={ш} тон={тон} />
      </div>
      {метки.filter(Boolean).slice(0, 3).map((м, i) => {
        const угол = frame * 0.9 + i * 120;
        const r = 390;
        const x = Math.cos((угол * Math.PI) / 180) * r;
        const y = Math.sin((угол * Math.PI) / 180) * r * 0.32;
        return (
          <div key={i} style={{
            position: "absolute", left: 450 + x, top: 320 + y, transform: "translate(-50%, -50%)",
            fontFamily: п.семья, fontWeight: п.вес, fontSize: 26, letterSpacing: "0.08em",
            color: Т.текст, background: "rgba(6,7,10,0.68)", border: `1px solid ${тон}55`,
            padding: "8px 16px", borderRadius: 10, whiteSpace: "nowrap",
            maxWidth: 260, overflow: "hidden", textOverflow: "ellipsis",
          }}>{текстом(м, п)}</div>
        );
      })}
    </div>
  );
};

/** Карточка ключ-арта: живое фото в рамке, которое всегда едет. */
export const Карточка: React.FC<{ ш: any; тон: string; файл: string; ширина?: number; высота?: number }> = ({
  ш, тон, файл, ширина = 760, высота = 520,
}) => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const ход = interpolate(frame, [0, durationInFrames], [0, 1]);
  const з = знак(ш.id, "kk");
  return (
    <div style={{
      width: ширина, height: высота, overflow: "hidden", borderRadius: 20, position: "relative",
      border: `1px solid ${тон}55`, boxShadow: `0 40px 90px rgba(0,0,0,0.6), 0 0 70px ${тон}22`,
      transform: `perspective(1400px) rotateY(${з * (7 - ход * 12)}deg) rotateX(${2 - ход * 4}deg)`,
    }}>
      <Img src={staticFile("kadr/m/" + файл)} style={{
        position: "absolute", width: "120%", height: "120%", objectFit: "cover",
        left: `${-10 + з * ход * 8}%`, top: `${-10 + ход * 5}%`,
        transform: `scale(${1 + ход * 0.08})`, filter: "contrast(1.1) saturate(1.08) brightness(1.3)",
      }} />
      <div style={{ position: "absolute", inset: 0,
                    background: `linear-gradient(180deg, transparent 40%, rgba(6,7,10,0.85))` }} />
    </div>
  );
};

/** Подпись под кадром: одна строка, своя подача. */
export const Подпись: React.FC<{ ш: any; текст: string; низ?: number }> = ({ ш, текст, низ = 86 }) => {
  const frame = useCurrentFrame();
  const д = interpolate(frame, [2, 11], [0, 1], { easing: ВЫХОД, extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  if (!текст) return null;
  return (
    <div style={{ position: "absolute", left: 0, right: 0, bottom: низ, display: "flex",
                  justifyContent: "center", opacity: д, translate: `0px ${(1 - д) * 18}px` }}>
      <Строка ш={ш} текст={текст} размер={30} цвет="rgba(244,245,247,0.82)" стиль={{
        padding: "10px 24px", borderRadius: 12, background: "rgba(6,7,10,0.55)",
        border: `1px solid ${Т.линия}`, letterSpacing: "0.05em",
      }} />
    </div>
  );
};
