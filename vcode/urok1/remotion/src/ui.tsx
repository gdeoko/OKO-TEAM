import React from "react";
import {
  AbsoluteFill, Img, OffthreadVideo, interpolate, spring, staticFile,
  useCurrentFrame, useVideoConfig,
} from "remotion";

export const Т = {
  фон: "#08090C",
  поверхность: "#11141C",
  акцент: "#7C5CFF",
  акцент2: "#22D3EE",
  текст: "#F4F5F7",
  тихий: "#8A90A0",
  линия: "rgba(255,255,255,0.10)",
  шапка: '"Unbounded", system-ui, sans-serif',
  корпус: '"Inter", system-ui, sans-serif',
  поле: 112,
};

/** Мягкое появление: сдвиг вверх и прозрачность, пружиной. */
export const вход = (frame: number, fps: number, задержка = 0, сдвиг = 34) => {
  const s = spring({ frame: frame - задержка, fps, config: { damping: 200, mass: 0.6 } });
  return { opacity: s, transform: `translateY(${(1 - s) * сдвиг}px)` };
};

/** Плавный въезд и уход сцены целиком. */
export const шторка = (frame: number, всего: number) => {
  const вх = interpolate(frame, [0, 10], [0, 1], { extrapolateRight: "clamp" });
  const ух = interpolate(frame, [всего - 10, всего], [1, 0], { extrapolateLeft: "clamp" });
  return Math.min(вх, ух);
};

/** Секунда, на которой произносится слово. Нужна, чтобы анимация шла по речи. */
const норм = (с: string) => с.toLowerCase().replace(/[^а-яёa-z0-9]/g, "");
export const когда = (слова: any[], фраза: string, запас = 0): number | null => {
  if (!слова || !слова.length || !фраза) return null;
  const цель = норм(фраза.split(/[\s,.:;]+/)[0] || "");
  if (цель.length < 3) return null;
  for (const с of слова) {
    const н = норм(с.слово);
    if (н === цель || (н.length > 3 && цель.startsWith(н.slice(0, 5)))) {
      return Math.max(0, с.старт - запас);
    }
  }
  return null;
};

/** Кадр появления: по слову из речи, иначе ровной раскладкой. */
export const кадрПоСлову = (
  слова: any[], фраза: string, запасной: number, fps: number,
): number => {
  const т = когда(слова, фраза, 0.25);
  return т === null ? запасной : Math.round(т * fps);
};

/** Живой фон: два цветных пятна, медленный дрейф, сетка и виньетка. */
export const Фон: React.FC<{ тон?: string }> = ({ тон = Т.акцент }) => {
  const frame = useCurrentFrame();
  const t = frame / 25;
  const x1 = 18 + Math.sin(t * 0.14) * 7;
  const y1 = 26 + Math.cos(t * 0.11) * 6;
  const x2 = 82 + Math.cos(t * 0.09) * 6;
  const y2 = 74 + Math.sin(t * 0.13) * 7;
  return (
    <AbsoluteFill style={{ backgroundColor: Т.фон }}>
      <AbsoluteFill
        style={{
          background:
            `radial-gradient(42% 46% at ${x1}% ${y1}%, ${тон}3D 0%, transparent 70%),` +
            `radial-gradient(38% 42% at ${x2}% ${y2}%, ${Т.акцент2}29 0%, transparent 72%)`,
        }}
      />
      <AbsoluteFill
        style={{
          backgroundImage:
            "linear-gradient(rgba(255,255,255,0.028) 1px, transparent 1px)," +
            "linear-gradient(90deg, rgba(255,255,255,0.028) 1px, transparent 1px)",
          backgroundSize: "96px 96px",
          transform: `translate(${(frame * 0.14) % 96}px, ${(frame * 0.07) % 96}px)`,
          opacity: 0.5,
        }}
      />
      <AbsoluteFill
        style={{ background: "radial-gradient(70% 70% at 50% 45%, transparent 40%, rgba(0,0,0,0.75) 100%)" }}
      />
    </AbsoluteFill>
  );
};

/** Фотография или оживлённый кадр с медленным наездом. */
export const Кадр: React.FC<{
  картинка?: string; видео?: string; затемнение?: number; сторона?: "вся" | "право" | "лево";
}> = ({ картинка, видео, затемнение = 0.18, сторона = "вся" }) => {
  const frame = useCurrentFrame();
  const { durationInFrames, fps } = useVideoConfig();
  const масштаб = interpolate(frame, [0, durationInFrames], [1.03, 1.12]);
  const сдвиг = interpolate(frame, [0, durationInFrames], [0, -18]);
  const видеоКадров = Math.round(2.9 * fps);
  const переход = картинка && видео
    ? interpolate(frame, [видеоКадров - 10, видеоКадров], [0, 1], {
        extrapolateLeft: "clamp", extrapolateRight: "clamp" })
    : видео ? 0 : 1;
  // Маска нужна только под текст: раньше она гасила ещё и сам кадр, и кофейня
  // уходила в чёрное пятно. Теперь затемняется край, а снимок остаётся виден.
  const маска =
    сторона === "вся"
      ? `linear-gradient(180deg, ${Т.фон}B3 0%, ${Т.фон}4D 38%, ${Т.фон}E6 100%)`
      : сторона === "право"
      ? `linear-gradient(90deg, ${Т.фон}F2 0%, ${Т.фон}D9 30%, ${Т.фон}4D 62%, transparent 86%)`
      : `linear-gradient(270deg, ${Т.фон}F2 0%, ${Т.фон}D9 30%, ${Т.фон}4D 62%, transparent 86%)`;
  return (
    <AbsoluteFill>
      {видео ? (
        <AbsoluteFill style={{ opacity: 1 - переход }}>
          <OffthreadVideo
            src={staticFile(видео)}
            muted
            style={{ width: "100%", height: "100%", objectFit: "cover",
                     filter: "brightness(1.3) contrast(1.05) saturate(1.06)",
                     transform: `scale(${масштаб})` }}
          />
        </AbsoluteFill>
      ) : null}
      {картинка ? (
        <AbsoluteFill style={{ opacity: переход }}>
          <Img
            src={staticFile(картинка)}
            style={{ width: "100%", height: "100%", objectFit: "cover",
                     filter: "brightness(1.35) contrast(1.06) saturate(1.08)",
                     transform: `scale(${масштаб}) translateY(${сдвиг}px)` }}
          />
        </AbsoluteFill>
      ) : null}
      <AbsoluteFill style={{ background: маска }} />
      <AbsoluteFill style={{ background: `rgba(8,9,12,${затемнение})` }} />
    </AbsoluteFill>
  );
};

/** Заголовок, который выходит по словам. */
export const ПоСловам: React.FC<{
  текст: string; размер?: number; вес?: number; цвет?: string; задержка?: number;
  шаг?: number; максШирина?: number; шрифт?: string; межстрочный?: number;
  подсветка?: string;
}> = ({ текст, размер = 76, вес = 800, цвет = Т.текст, задержка = 0, шаг = 2.2,
        максШирина = 1200, шрифт = Т.шапка, межстрочный = 1.08, подсветка }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const слова = текст.split(" ");
  return (
    <div style={{ fontFamily: шрифт, fontSize: размер, fontWeight: вес, color: цвет,
                  lineHeight: межстрочный, maxWidth: максШирина, letterSpacing: "-0.015em" }}>
      {слова.map((с, i) => {
        const st = вход(frame, fps, задержка + i * шаг, 22);
        const выделено = подсветка && с.toLowerCase().includes(подсветка.toLowerCase());
        return (
          <span key={i} style={{ display: "inline-block", marginRight: "0.28em", ...st,
                                 color: выделено ? Т.акцент : цвет }}>
            {с}
          </span>
        );
      })}
    </div>
  );
};

/** Маленькая метка-пилюля. */
export const Пилюля: React.FC<{ текст: string; задержка?: number; тон?: string }> = ({
  текст, задержка = 0, тон = Т.акцент,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  return (
    <div style={{
      ...вход(frame, fps, задержка, 16),
      display: "inline-flex", alignItems: "center", gap: 12,
      padding: "12px 22px", borderRadius: 999, border: `1px solid ${тон}59`,
      background: `${тон}1A`, color: Т.текст, fontFamily: Т.корпус, fontSize: 28,
      fontWeight: 500, marginRight: 14, marginBottom: 14,
    }}>
      <span style={{ width: 9, height: 9, borderRadius: 9, background: тон }} />
      {текст}
    </div>
  );
};

/** Логотип и адрес в углу, как постоянный элемент кадра. */
export const Угол: React.FC<{ показывать: boolean }> = ({ показывать }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  if (!показывать) return null;
  const s = spring({ frame: frame - 6, fps, config: { damping: 200 } });
  return (
    <div style={{ position: "absolute", right: 56, bottom: 48, display: "flex",
                  alignItems: "center", gap: 14, opacity: s * 0.92 }}>
      <Img src={staticFile("logo.png")} style={{ width: 44, height: 44 }} />
      <span style={{ fontFamily: Т.шапка, fontSize: 24, fontWeight: 700,
                     color: Т.текст, letterSpacing: "0.06em" }}>V.LIONOFF</span>
    </div>
  );
};

/** Полоса прохождения урока внизу кадра. */
export const Полоса: React.FC<{ доля: number }> = ({ доля }) => (
  <div style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: 5,
                background: "rgba(255,255,255,0.07)" }}>
    <div style={{ width: `${доля * 100}%`, height: "100%",
                  background: `linear-gradient(90deg, ${Т.акцент}, ${Т.акцент2})` }} />
  </div>
);

/** Субтитры по словам: текущее слово подсвечено. */
export const Субтитры: React.FC<{ слова: any[] }> = ({ слова }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  if (!слова || !слова.length) return null;
  const t = frame / fps;
  const строки: any[][] = [];
  let текущая: any[] = [];
  for (const с of слова) {
    текущая.push(с);
    const длина = текущая.reduce((н, х) => н + х.слово.length + 1, 0);
    if (длина > 46 || /[.!?]$/.test(с.слово)) { строки.push(текущая); текущая = []; }
  }
  if (текущая.length) строки.push(текущая);
  const активная = строки.find((стр) => t >= стр[0].старт - 0.15 && t <= стр[стр.length - 1].конец + 0.35);
  if (!активная) return null;
  return (
    <div style={{ position: "absolute", left: 0, right: 0, bottom: 86,
                  display: "flex", justifyContent: "center", pointerEvents: "none" }}>
      <div style={{ maxWidth: 1420, padding: "16px 32px", borderRadius: 18,
                    background: "rgba(8,9,12,0.62)", border: `1px solid ${Т.линия}`,
                    fontFamily: Т.корпус, fontSize: 38, fontWeight: 500,
                    color: "rgba(244,245,247,0.72)", textAlign: "center", lineHeight: 1.3 }}>
        {активная.map((с, i) => (
          <span key={i} style={{ marginRight: "0.3em",
                                 color: t >= с.старт - 0.05 ? Т.текст : "rgba(244,245,247,0.5)" }}>
            {с.слово}
          </span>
        ))}
      </div>
    </div>
  );
};
