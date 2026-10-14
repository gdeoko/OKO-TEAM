import React from "react";
import { Easing, interpolate, random, useCurrentFrame, useVideoConfig } from "remotion";
import { Т } from "./dvizh";

export const ВЫХОД = Easing.bezier(0.16, 1, 0.3, 1);
export const РЕЗКО = Easing.bezier(0.5, 0, 0.1, 1);
export const сид = (s: string, k = "") => random(s + k);
export const знак = (s: string, k = "") => (сид(s, k) > 0.5 ? 1 : -1);

/** Набор подач текста: своё семейство, вес, разрядка и регистр у каждой. */
export type Подача = {
  имя: string; семья: string; вес: number; разрядка: string;
  регистр?: "upper" | "none"; к: number; межстрочный: number;
};

export const ПОДАЧИ: Подача[] = [
  { имя: "гео", семья: '"Unbounded", sans-serif', вес: 800, разрядка: "-0.02em", к: 1.0, межстрочный: 1.05 },
  { имя: "гео_разряд", семья: '"Unbounded", sans-serif', вес: 400, разрядка: "0.1em", регистр: "upper", к: 0.72, межстрочный: 1.25 },
  { имя: "гротеск", семья: '"Montserrat", sans-serif', вес: 900, разрядка: "-0.03em", регистр: "upper", к: 1.06, межстрочный: 0.98 },
  { имя: "узкий", семья: '"Oswald", sans-serif', вес: 700, разрядка: "0.02em", регистр: "upper", к: 1.3, межстрочный: 0.96 },
  { имя: "техно", семья: '"Russo One", sans-serif', вес: 400, разрядка: "0.01em", регистр: "upper", к: 0.98, межстрочный: 1.08 },
  { имя: "плотный", семья: '"Rubik", sans-serif', вес: 900, разрядка: "-0.025em", к: 1.04, межстрочный: 1.02 },
  { имя: "антиква", семья: '"Playfair Display", serif', вес: 900, разрядка: "-0.01em", к: 1.02, межстрочный: 1.04 },
  { имя: "антиква2", семья: '"Yeseva One", serif', вес: 400, разрядка: "0em", к: 1.0, межстрочный: 1.06 },
  { имя: "мягкий", семья: '"Manrope", sans-serif', вес: 800, разрядка: "-0.015em", к: 1.02, межстрочный: 1.06 },
  { имя: "подпись", семья: '"Inter", sans-serif', вес: 700, разрядка: "0.16em", регистр: "upper", к: 0.66, межстрочный: 1.3 },
];

export const подача = (ш: any): Подача => ПОДАЧИ[(ш.шрифт ?? 0) % ПОДАЧИ.length];

/** Кегль под объём фразы и под ширину самой подачи. */
export const кегль = (ш: any, база: number) => {
  const зн = ш.знаков || (ш.текст || "").length;
  const к = зн <= 24 ? 1.16 : зн <= 40 ? 1.0 : зн <= 60 ? 0.86 : зн <= 85 ? 0.72 : зн <= 110 ? 0.6 : 0.5;
  return Math.max(44, Math.round(база * к * подача(ш).к));
};

export const текстом = (с: string, п: Подача) => (п.регистр === "upper" ? с.toUpperCase() : с);

/** Шесть разных входов слова: подряд один и тот же не ставится режиссёром. */
export const вход_слова = (вид: string, д: number, i: number): React.CSSProperties => {
  const з = i % 2 === 0 ? 1 : -1;
  switch (вид) {
    case "снизу":
      return { opacity: д, translate: `0px ${(1 - д) * 54}px`, scale: 0.94 + д * 0.06 };
    case "сбоку":
      return { opacity: д, translate: `${(1 - д) * 70 * з}px 0px` };
    case "поворот":
      return { opacity: д, transform: `perspective(900px) rotateX(${(1 - д) * -72}deg)`, transformOrigin: "50% 0%" };
    case "удар":
      return { opacity: д, scale: 1 + (1 - д) * 0.5, filter: `blur(${(1 - д) * 10}px)` };
    case "качели":
      return { opacity: д, rotate: `${(1 - д) * 14 * з}deg`, translate: `0px ${(1 - д) * 30 * з}px` };
    default:
      return { opacity: д, clipPath: `inset(0 ${Math.round((1 - д) * 100)}% 0 0)` };
  }
};

/** Слова встают ровно тогда, когда звучат, и входят приёмом этого шота. */
export const Слова: React.FC<{
  ш: any; размер: number; ширина?: number; центр?: boolean; цвет?: string;
  акцентное?: string; стиль?: React.CSSProperties;
}> = ({ ш, размер, ширина = 1400, центр = false, цвет = Т.текст, акцентное, стиль }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = frame / fps;
  const п = подача(ш);
  const вид = ш.вход_слов || "снизу";
  const ак = акцентное || Т.акцент2;
  return (
    <div style={{
      display: "flex", flexWrap: "wrap", gap: `${(п.межстрочный - 0.9) * размер}px 0.3em`,
      maxWidth: ширина, justifyContent: центр ? "center" : "flex-start",
      fontFamily: п.семья, fontWeight: п.вес, fontSize: размер, lineHeight: п.межстрочный,
      letterSpacing: п.разрядка, color: цвет, perspective: 1000, ...стиль,
    }}>
      {(ш.слова || []).map((с: any, i: number) => {
        const д = interpolate(t, [с.старт - 0.08, с.старт + 0.17], [0, 1],
                              { easing: ВЫХОД, extrapolateLeft: "clamp", extrapolateRight: "clamp" });
        const свеж = interpolate(t, [с.старт, с.старт + 0.45], [1, 0],
                                 { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
        return (
          <span key={i} style={{
            display: "inline-block", color: свеж > 0.55 ? ак : цвет,
            ...вход_слова(вид, д, i),
          }}>{текстом(с.слово, п)}</span>
        );
      })}
    </div>
  );
};

/** Строка одной краской: заголовок, ключевое слово, цифра. */
export const Строка: React.FC<{
  ш: any; текст: string; размер: number; цвет?: string; стиль?: React.CSSProperties;
}> = ({ ш, текст, размер, цвет = Т.текст, стиль }) => {
  const п = подача(ш);
  return (
    <div style={{
      fontFamily: п.семья, fontWeight: п.вес, fontSize: размер, letterSpacing: п.разрядка,
      lineHeight: п.межстрочный, color: цвет, ...стиль,
    }}>{текстом(текст, п)}</div>
  );
};
