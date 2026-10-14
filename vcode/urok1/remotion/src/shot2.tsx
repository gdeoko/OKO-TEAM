import React from "react";
import {
  AbsoluteFill, Img, Loop, OffthreadVideo, interpolate, staticFile, useCurrentFrame, useVideoConfig,
} from "remotion";
import { Т } from "./dvizh";
import { Фон } from "./fon";
import { Глубина, Диафрагма, КропКадр, Матрицы, Таблица, УголОбзора, Частота, Экспозиция, Выдержка } from "./graf";
import { Карточка, Карусель, Коридор, Куб, Орбита, Плиты, Подпись, Предмет } from "./obyem";
import { ПОДАЧИ, ВЫХОД, РЕЗКО, Слова, Строка, знак, кегль, подача, сид, текстом } from "./tipo";

const ТОНА = [Т.акцент, Т.акцент2, Т.тёплый, "#FF5CA8"];

/** Пары подач для кадра со смешанной типографикой. */
const ПОДАЧА_ПАРЫ = [ПОДАЧИ[2], ПОДАЧИ[3], ПОДАЧИ[6], ПОДАЧИ[0], ПОДАЧИ[4], ПОДАЧИ[8]];

/** Вход кадра: шесть разных приёмов, режиссёр не ставит один подряд. */
const вход_кадра = (вид: string, frame: number, з: number): React.CSSProperties => {
  const д = (к: number) => interpolate(frame, [0, к], [0, 1], { easing: РЕЗКО, extrapolateRight: "clamp" });
  switch (вид) {
    case "сдвиг": return { transform: `translateX(${(1 - д(6)) * 120 * з}px)` };
    case "наезд": return { transform: `scale(${1.14 - д(7) * 0.14})` };
    case "отъезд": return { transform: `scale(${0.88 + д(7) * 0.12})` };
    case "разворот": return { transform: `perspective(1400px) rotateY(${(1 - д(9)) * 26 * з}deg)` };
    case "штора": return { clipPath: `inset(0 ${(1 - д(8)) * 100}% 0 0)` };
    case "вверх": return { transform: `translateY(${(1 - д(6)) * 90}px)` };
    default: return { transform: `scale(${1.06 - д(5) * 0.06})` };
  }
};

/** Камера шота: восемь ходов, внутри шота кадр не стоит. */
const камера_шота = (вид: string, ход: number, з: number): React.CSSProperties => {
  switch (вид) {
    case "влево": return { transform: `translateX(${-ход * 46 * з}px) scale(${1.03})` };
    case "вправо": return { transform: `translateX(${ход * 46 * з}px) scale(${1.03})` };
    case "вверх": return { transform: `translateY(${-ход * 34}px) scale(${1.04})` };
    case "вниз": return { transform: `translateY(${ход * 30}px) scale(${1.04})` };
    case "вглубь": return { transform: `scale(${1 + ход * 0.09})` };
    case "назад": return { transform: `scale(${1.1 - ход * 0.09})` };
    case "облёт": return { transform: `perspective(1600px) rotateY(${(ход - 0.5) * 9 * з}deg) scale(1.04)` };
    default: return { transform: `rotate(${(ход - 0.5) * 1.6 * з}deg) scale(${1.02 + ход * 0.03})` };
  }
};

const Графика: React.FC<{ ш: any }> = ({ ш }) => {
  const frame = useCurrentFrame();
  switch (ш.графика) {
    case "матрицы": return <Матрицы подсветка={Math.floor(frame / 20) % 3} />;
    case "кроп": return <КропКадр />;
    case "угол": return <УголОбзора от={ш.от_граф ?? 10} до={ш.до_граф ?? 200} />;
    case "диафрагма": return (
      <div style={{ display: "flex", gap: 34, alignItems: "center" }}>
        <Диафрагма размер={330} /><Глубина />
      </div>);
    case "экспозиция": return <Экспозиция />;
    case "выдержка": return <Выдержка />;
    case "частота": return <Частота />;
    case "таблица": return <Таблица шапка={ш.шапка || []} строки={ш.таблица || []} />;
    default: return null;
  }
};

/** Вещь-спутник у текстового кадра: пустых кадров в ролике нет. */
const Спутник: React.FC<{ ш: any; тон: string; сторона: "лево" | "право" }> = ({ ш, тон, сторона }) => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const ход = interpolate(frame, [0, durationInFrames], [0, 1]);
  const з = знак(ш.id, "sp");
  const д = interpolate(frame, [0, 12], [0, 1], { easing: ВЫХОД, extrapolateRight: "clamp" });
  if (!ш.спутник) return null;
  return (
    <div style={{
      position: "absolute", [сторона === "право" ? "right" : "left"]: 56 + ход * 26 * з,
      top: 150 + сид(ш.id, "sy") * 260, opacity: д * 0.92,
      transform: `rotate(${interpolate(frame, [0, durationInFrames], [-9 * з, 9 * з])}deg) scale(${0.9 + ход * 0.14})`,
    } as any}>
      <Предмет файл={"kadr/m/" + ш.спутник} размер={400} ш={ш} тон={тон} />
    </div>
  );
};

/** Рубрика кадра: короткая метка темы, чтобы кадр был собран, а не пуст. */
const Метка: React.FC<{ ш: any; тон: string }> = ({ ш, тон }) => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const текст = (ш.заголовок || ш.надзаголовок || "").toUpperCase().slice(0, 42);
  if (!текст) return null;
  const д = interpolate(frame, [3, 14], [0, 1], { easing: ВЫХОД, extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const ход = interpolate(frame, [0, durationInFrames], [0, 1]);
  const низ = false;   // рубрика всегда сверху справа: внизу идут подписи кадров
  return (
    <div style={{
      position: "absolute", right: 56, [низ ? "bottom" : "top"]: низ ? 92 : 96,
      display: "flex", alignItems: "center", gap: 12, opacity: д * 0.75,
      transform: `translateX(${(1 - д) * 40}px)`,
    } as any}>
      <span style={{ width: 54 + ход * 26, height: 2, background: `linear-gradient(90deg, transparent, ${тон})` }} />
      <span style={{ fontFamily: '"Inter", sans-serif', fontSize: 19, fontWeight: 600,
                     letterSpacing: "0.22em", color: "rgba(244,245,247,0.72)" }}>{текст}</span>
    </div>
  );
};

/** Видео-врезка: кадр с настоящим движением, всегда в движении и по краю. */
const Клип: React.FC<{ файл: string; стиль?: React.CSSProperties }> = ({ файл, стиль }) => (
  <Loop durationInFrames={74}>
    <OffthreadVideo src={staticFile("kadr/" + файл)} muted
                    style={{ width: "100%", height: "100%", objectFit: "cover", ...стиль }} />
  </Loop>
);

const ТЕКСТОВЫЕ = new Set([
  "титр", "крупно", "акцент", "полоса", "раскол", "лесенка", "шторка", "угол", "цифра",
  "типо_маска", "типо_обводка", "типо_вертикаль", "типо_смесь", "типо_диагональ",
  "типо_сетка", "типо_лента", "типо_карточка",
]);

export const Шот: React.FC<{ ш: any }> = ({ ш }) => {
  const frame = useCurrentFrame();
  const { durationInFrames, fps } = useVideoConfig();
  const ход = interpolate(frame, [0, durationInFrames], [0, 1]);
  const з = знак(ш.id, "k");
  const тон = ТОНА[(ш.тон ?? 0) % ТОНА.length];
  const П = Т.поле;
  const п = подача(ш);
  const текстовый = ТЕКСТОВЫЕ.has(ш.тип);

  const обёртка = (дети: React.ReactNode, спутник = true) => (
    <AbsoluteFill>
      <Фон ш={ш} тон={тон} />
      <AbsoluteFill style={камера_шота(ш.камера || "дрейф", ход, з)}>
        <AbsoluteFill style={вход_кадра(ш.вход || "удар", frame, з)}>
          {текстовый && спутник ? <Спутник ш={ш} тон={тон} сторона={з > 0 ? "право" : "лево"} /> : null}
          {дети}
        </AbsoluteFill>
      </AbsoluteFill>
      <Метка ш={ш} тон={тон} />
    </AbsoluteFill>
  );

  switch (ш.тип) {
    case "титр":
      return обёртка(
        <AbsoluteFill style={{ padding: П, display: "flex", flexDirection: "column", justifyContent: "center", gap: 24 }}>
          <Строка ш={{ ...ш, шрифт: 9 }} текст={(ш.надзаголовок || ш.заголовок || "").slice(0, 48)} размер={24}
                  цвет={Т.акцент2} стиль={{ opacity: interpolate(frame, [0, 8], [0, 1], { extrapolateRight: "clamp" }) }} />
          <Слова ш={ш} размер={кегль(ш, 94)} ширина={1180} />
          <div style={{ height: 5, width: `${interpolate(frame, [6, 26], [0, 58], { extrapolateRight: "clamp" })}%`,
                        background: `linear-gradient(90deg, ${тон}, ${Т.акцент2})`, borderRadius: 5 }} />
        </AbsoluteFill>);

    case "крупно":
      return обёртка(
        <AbsoluteFill style={{ padding: П, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <Слова ш={ш} размер={кегль(ш, 106)} ширина={1280} центр />
        </AbsoluteFill>);

    case "акцент": {
      const кл = ш.ключ || (ш.слова?.[0]?.слово ?? "");
      return обёртка(
        <AbsoluteFill style={{ padding: П, display: "flex", flexDirection: "column",
                               justifyContent: "center", alignItems: "center", gap: 24 }}>
          <Строка ш={ш} текст={кл} размер={Math.min(200, Math.round(1500 / Math.max(5, кл.length)) * 2)}
                  стиль={{ textShadow: `0 0 70px ${тон}66`,
                           scale: interpolate(frame, [0, 14], [1.28, 1], { easing: ВЫХОД, extrapolateRight: "clamp" }) }} />
          <Слова ш={ш} размер={кегль(ш, 46)} ширина={1150} центр цвет="rgba(244,245,247,0.82)" />
        </AbsoluteFill>);
    }

    case "полоса":
      return обёртка(
        <AbsoluteFill style={{ display: "flex", flexDirection: "column", justifyContent: "center" }}>
          <div style={{ width: "128%", marginLeft: "-14%", padding: "46px 90px 46px 430px",
                        background: `linear-gradient(90deg, ${тон}2E, transparent)`,
                        borderTop: `2px solid ${тон}66`, borderBottom: `2px solid ${тон}66`,
                        transform: `rotate(${-4 * з}deg) translateX(${interpolate(frame, [0, durationInFrames], [-40 * з, 40 * з])}px)` }}>
            <Слова ш={ш} размер={кегль(ш, 78)} ширина={1250} />
          </div>
        </AbsoluteFill>);

    case "раскол":
      return обёртка(
        <AbsoluteFill>
          <div style={{ position: "absolute", left: 0, right: 0, top: 0, height: "50%",
                        background: `linear-gradient(180deg, ${тон}26, transparent)`,
                        transform: `translateX(${interpolate(frame, [0, durationInFrames], [-80, 36]) * з}px)` }} />
          <div style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: "50%",
                        background: `linear-gradient(0deg, ${Т.акцент2}22, transparent)`,
                        transform: `translateX(${interpolate(frame, [0, durationInFrames], [80, -36]) * з}px)` }} />
          <AbsoluteFill style={{ padding: П, display: "flex", flexDirection: "column", justifyContent: "center" }}>
            <Слова ш={ш} размер={кегль(ш, 84)} ширина={1120} />
          </AbsoluteFill>
        </AbsoluteFill>);

    case "лесенка":
      return обёртка(
        <AbsoluteFill style={{ padding: П, display: "flex", flexDirection: "column", justifyContent: "center", gap: 4 }}>
          {(ш.слова || []).map((с: any, i: number) => {
            const t = frame / fps;
            const д = interpolate(t, [с.старт - 0.06, с.старт + 0.18], [0, 1],
                                  { easing: ВЫХОД, extrapolateLeft: "clamp", extrapolateRight: "clamp" });
            return (
              <div key={i} style={{ fontFamily: п.семья, fontWeight: п.вес, fontSize: кегль(ш, 76),
                                    letterSpacing: п.разрядка, lineHeight: п.межстрочный,
                                    color: i % 3 === 1 ? Т.акцент2 : Т.текст, opacity: д,
                                    marginLeft: Math.min(i, 4) * 56,
                                    transform: `translateX(${(1 - д) * (i % 2 ? 100 : -100)}px)` }}>
                {текстом(с.слово, п)}
              </div>
            );
          })}
        </AbsoluteFill>);

    case "шторка": {
      const откр = interpolate(frame, [0, 16], [0, 100], { easing: РЕЗКО, extrapolateRight: "clamp" });
      return обёртка(
        <AbsoluteFill style={{ padding: П, display: "flex", flexDirection: "column", justifyContent: "center",
                               clipPath: `inset(0 ${100 - откр}% 0 0)` }}>
          <div style={{ borderLeft: `6px solid ${тон}`, paddingLeft: 36 }}>
            <Слова ш={ш} размер={кегль(ш, 80)} ширина={1080} />
          </div>
        </AbsoluteFill>);
    }

    case "угол":
      return обёртка(
        <AbsoluteFill style={{ padding: П }}>
          <div style={{ position: "absolute", left: -200, top: -200, width: 900, height: 900,
                        border: `2px solid ${тон}44`, borderRadius: 40,
                        transform: `rotate(${interpolate(frame, [0, durationInFrames], [10, 26])}deg)` }} />
          <AbsoluteFill style={{ padding: П, display: "flex", flexDirection: "column", justifyContent: "center" }}>
            <Слова ш={ш} размер={кегль(ш, 74)} ширина={1060} />
          </AbsoluteFill>
        </AbsoluteFill>);

    case "цифра": {
      const ц = ш.цифра || "";
      const число = parseInt(ц.replace(/\D/g, ""), 10) || 0;
      const бег = Math.round(interpolate(frame, [0, 22], [0, число], { easing: ВЫХОД, extrapolateRight: "clamp" }));
      return обёртка(
        <AbsoluteFill style={{ padding: П, display: "flex", flexDirection: "row", alignItems: "center", gap: 60 }}>
          <Строка ш={ш} текст={String(бег)} размер={250} стиль={{ textShadow: `0 0 90px ${тон}77` }} />
          <Слова ш={ш} размер={кегль(ш, 48)} ширина={780} цвет="rgba(244,245,247,0.86)" />
        </AbsoluteFill>, false);
    }

    /* ---- типографика ---- */

    case "типо_маска": {
      const слова = (ш.слова || []).map((с: any) => с.слово).join(" ");
      const откр = interpolate(frame, [0, 14], [0, 100], { easing: РЕЗКО, extrapolateRight: "clamp" });
      return обёртка(
        <AbsoluteFill style={{ padding: П, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div style={{
            fontFamily: п.семья, fontWeight: п.вес, fontSize: кегль(ш, 104), letterSpacing: п.разрядка,
            lineHeight: 1.04, textAlign: "center", maxWidth: 1400,
            backgroundImage: `url(${staticFile("kadr/m/" + (ш.ключ_арт || "u1_s18.jpg"))})`,
            backgroundSize: "140%",
            backgroundPosition: `${40 + ход * 20}% ${45 + ход * 10}%`,
            WebkitBackgroundClip: "text", backgroundClip: "text", color: "transparent",
            WebkitTextStroke: `2px ${тон}AA`,
            clipPath: `inset(0 ${100 - откр}% 0 0)`,
            filter: "brightness(2.4) contrast(1.35) saturate(1.3)",
          }}>{текстом(слова, п)}</div>
        </AbsoluteFill>, false);
    }

    case "типо_обводка":
      return обёртка(
        <AbsoluteFill style={{ padding: П, display: "flex", flexDirection: "column", justifyContent: "center", gap: 2 }}>
          {(ш.слова || []).map((с: any, i: number) => {
            const t = frame / fps;
            const д = interpolate(t, [с.старт - 0.05, с.старт + 0.2], [0, 1],
                                  { easing: ВЫХОД, extrapolateLeft: "clamp", extrapolateRight: "clamp" });
            const пустое = i % 2 === 1;
            return (
              <span key={i} style={{
                fontFamily: п.семья, fontWeight: п.вес, fontSize: кегль(ш, 86), letterSpacing: п.разрядка,
                lineHeight: 1.0, display: "inline-block", marginRight: 18,
                color: пустое ? "transparent" : Т.текст,
                WebkitTextStroke: пустое ? `2px ${тон}` : "0px",
                opacity: д, transform: `translateY(${(1 - д) * 40}px) scale(${0.96 + д * 0.04})`,
              }}>{текстом(с.слово, п)}</span>
            );
          })}
        </AbsoluteFill>);

    case "типо_вертикаль":
      return обёртка(
        <AbsoluteFill style={{ padding: П, display: "flex", flexDirection: "row", alignItems: "center",
                               justifyContent: "center", gap: 30 }}>
          {(ш.слова || []).slice(0, 7).map((с: any, i: number) => {
            const t = frame / fps;
            const д = interpolate(t, [с.старт - 0.05, с.старт + 0.2], [0, 1],
                                  { easing: ВЫХОД, extrapolateLeft: "clamp", extrapolateRight: "clamp" });
            return (
              <div key={i} style={{
                writingMode: "vertical-rl", fontFamily: п.семья, fontWeight: п.вес,
                fontSize: Math.max(64, Math.min(кегль(ш, 104), 92)), letterSpacing: "0.02em",
                color: i % 3 === 2 ? тон : Т.текст, opacity: д,
                transform: `translateY(${(1 - д) * (i % 2 ? 80 : -80)}px) rotate(${(1 - д) * 6}deg)`,
              }}>{текстом(с.слово, п)}</div>
            );
          })}
        </AbsoluteFill>, false);

    case "типо_смесь":
      return обёртка(
        <AbsoluteFill style={{ padding: П, display: "flex", flexWrap: "wrap", alignContent: "center",
                               alignItems: "baseline", gap: "6px 18px" }}>
          {(ш.слова || []).map((с: any, i: number) => {
            const t = frame / fps;
            const д = interpolate(t, [с.старт - 0.05, с.старт + 0.2], [0, 1],
                                  { easing: ВЫХОД, extrapolateLeft: "clamp", extrapolateRight: "clamp" });
            const большой = с.слово.length > 5 && i % 3 === 0;
            const свой = ПОДАЧА_ПАРЫ[(ш.шрифт + i) % ПОДАЧА_ПАРЫ.length];
            return (
              <span key={i} style={{
                fontFamily: свой.семья, fontWeight: свой.вес,
                fontSize: кегль(ш, большой ? 104 : 58), letterSpacing: свой.разрядка,
                color: большой ? Т.текст : "rgba(244,245,247,0.78)", opacity: д,
                transform: `translateY(${(1 - д) * 36}px)`,
                textShadow: большой ? `0 0 60px ${тон}55` : "none",
              }}>{текстом(с.слово, свой)}</span>
            );
          })}
        </AbsoluteFill>);

    case "типо_диагональ":
      return обёртка(
        <AbsoluteFill style={{ display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div style={{ transform: `rotate(${-8 * з}deg)`, width: 1500 }}>
            {(ш.слова || []).map((с: any, i: number) => {
              const t = frame / fps;
              const д = interpolate(t, [с.старт - 0.05, с.старт + 0.2], [0, 1],
                                    { easing: ВЫХОД, extrapolateLeft: "clamp", extrapolateRight: "clamp" });
              return (
                <div key={i} style={{
                  fontFamily: п.семья, fontWeight: п.вес, fontSize: кегль(ш, 72), letterSpacing: п.разрядка,
                  color: i === 0 ? тон : Т.текст, opacity: д, lineHeight: 1.02,
                  marginLeft: (i % 5) * 110,
                  transform: `translateX(${(1 - д) * 120 * з}px)`,
                }}>{текстом(с.слово, п)}</div>
              );
            })}
          </div>
        </AbsoluteFill>, false);

    case "типо_сетка": {
      const слова = (ш.слова || []).slice(0, 9);
      const кол = слова.length > 6 ? 3 : 2;
      return обёртка(
        <AbsoluteFill style={{ padding: П, display: "grid", gridTemplateColumns: `repeat(${кол}, 1fr)`, gap: 18,
                               alignContent: "center" }}>
          {слова.map((с: any, i: number) => {
            const t = frame / fps;
            const д = interpolate(t, [с.старт - 0.05, с.старт + 0.22], [0, 1],
                                  { easing: ВЫХОД, extrapolateLeft: "clamp", extrapolateRight: "clamp" });
            return (
              <div key={i} style={{
                border: `1px solid ${i % 2 ? Т.акцент2 : тон}55`, borderRadius: 14, padding: "18px 22px",
                background: `linear-gradient(${40 + i * 40}deg, ${тон}1A, transparent)`,
                fontFamily: п.семья, fontWeight: п.вес, fontSize: кегль(ш, 54), letterSpacing: п.разрядка,
                color: Т.текст, display: "flex", alignItems: "center", justifyContent: "center",
                opacity: д, transform: `perspective(900px) rotateX(${(1 - д) * -80}deg)`,
                transformOrigin: "50% 0%",
              }}>{текстом(с.слово, п)}</div>
            );
          })}
        </AbsoluteFill>, false);
    }

    case "типо_лента": {
      const слово = (ш.ключ || ш.слова?.[0]?.слово || "").toUpperCase();
      const лента = new Array(8).fill(слово).join("  •  ");
      return обёртка(
        <AbsoluteFill style={{ display: "flex", flexDirection: "column", justifyContent: "center", gap: 36 }}>
          <div style={{ overflow: "hidden", padding: "16px 0", background: `${тон}1A`,
                        borderTop: `1px solid ${тон}66`, borderBottom: `1px solid ${тон}66`,
                        transform: `rotate(${-2.5 * з}deg)` }}>
            <div style={{ whiteSpace: "nowrap", fontFamily: п.семья, fontWeight: п.вес, fontSize: 86,
                          letterSpacing: "0.02em", color: Т.текст, opacity: 0.9,
                          transform: `translateX(${-(frame * 7 * з) % 1600}px)` }}>{лента + "  " + лента}</div>
          </div>
          <div style={{ padding: `0 ${П}px` }}>
            <Слова ш={ш} размер={кегль(ш, 52)} ширина={1500} цвет="rgba(244,245,247,0.88)" />
          </div>
        </AbsoluteFill>, false);
    }

    case "типо_карточка":
      return обёртка(
        <AbsoluteFill style={{ padding: П, display: "flex", flexDirection: "row", alignItems: "center", gap: 56 }}>
          <div style={{ flex: "0 0 48%" }}>
            <Слова ш={ш} размер={кегль(ш, 62)} ширина={760} />
          </div>
          <div style={{ flex: 1, display: "flex", justifyContent: "center" }}>
            <Карточка ш={ш} тон={тон} файл={ш.ключ_арт || "u1_s18.jpg"} ширина={760} высота={520} />
          </div>
        </AbsoluteFill>, false);

    /* ---- вещи ---- */

    case "предмет_пролёт":
      return обёртка(
        <AbsoluteFill style={{ padding: П, display: "flex", flexDirection: "column", justifyContent: "center" }}>
          <div style={{ position: "absolute", left: 0, right: 0, top: "34%", display: "flex", justifyContent: "center",
                        transform: `translateX(${interpolate(frame, [0, durationInFrames], [760 * з, -760 * з])}px) rotate(${interpolate(frame, [0, durationInFrames], [-14, 14]) * з}deg)` }}>
            <Предмет файл={"kadr/m/" + (ш.предмет?.файл || "u2_kamera.png")} размер={470} ш={ш} тон={тон} />
          </div>
          <Слова ш={ш} размер={кегль(ш, 66)} ширина={880} />
        </AbsoluteFill>, false);

    case "предмет_крупно":
      return обёртка(
        <AbsoluteFill style={{ padding: П, display: "flex", flexDirection: "row", alignItems: "center", gap: 50 }}>
          <div style={{ flex: "0 0 46%" }}>
            <Строка ш={ш} текст={ш.предмет?.имя || ""} размер={56}
                    стиль={{ marginBottom: 16, opacity: interpolate(frame, [0, 10], [0, 1], { extrapolateRight: "clamp" }) }} />
            <Слова ш={ш} размер={кегль(ш, 46)} ширина={660} цвет="rgba(244,245,247,0.86)" />
          </div>
          <div style={{ flex: 1, display: "flex", justifyContent: "center", transform: `scale(${1 + ход * 0.1})` }}>
            <Предмет файл={"kadr/m/" + (ш.предмет?.файл || "u2_kamera.png")} размер={520} ш={ш} тон={тон} />
          </div>
        </AbsoluteFill>, false);

    case "предмет_сетка":
      return обёртка(
        <AbsoluteFill style={{ padding: П, display: "flex", flexDirection: "column", justifyContent: "center", gap: 30 }}>
          <div style={{ display: "flex", gap: 26, justifyContent: "center" }}>
            {(ш.набор || ["u2_kamera.png"]).map((ф: string, i: number) => {
              const свой = i === Math.floor(ход * 5) % (ш.набор || [1]).length;
              return (
                <div key={i} style={{ opacity: свой ? 1 : 0.6,
                                      transform: `scale(${свой ? 1.16 : 0.92}) translateY(${свой ? -18 : 12}px)` }}>
                  <Предмет файл={"kadr/m/" + ф} размер={свой ? 330 : 260} ш={ш} ключ={"n" + i}
                           тон={i % 2 ? Т.акцент2 : тон} />
                </div>
              );
            })}
          </div>
          <div style={{ display: "flex", justifyContent: "center" }}>
            <Слова ш={ш} размер={кегль(ш, 50)} ширина={1200} центр />
          </div>
        </AbsoluteFill>, false);

    case "предмет_разбор": {
      const метки = [ш.предмет?.имя || "", ш.предмет?.текст || ""].filter(Boolean);
      return обёртка(
        <AbsoluteFill style={{ padding: П, display: "flex", flexDirection: "column",
                               alignItems: "center", justifyContent: "center" }}>
          <div style={{ position: "relative" }}>
            <Предмет файл={"kadr/m/" + (ш.предмет?.файл || "u2_obyektiv.png")} размер={540} ш={ш} тон={тон} />
            {метки.map((м, i) => {
              const д = interpolate(frame, [8 + i * 8, 22 + i * 8], [0, 1],
                                    { easing: ВЫХОД, extrapolateLeft: "clamp", extrapolateRight: "clamp" });
              return (
                <div key={i} style={{ position: "absolute", left: i % 2 ? -250 : 510, top: 70 + i * 170,
                                      opacity: д, transform: `translateX(${(1 - д) * (i % 2 ? -50 : 50)}px)`,
                                      fontFamily: Т.корпус, fontSize: 28, color: Т.текст, maxWidth: 290,
                                      borderLeft: `3px solid ${тон}`, paddingLeft: 14 }}>{м}</div>
              );
            })}
          </div>
          <div style={{ position: "absolute", left: П, right: П, bottom: П }}>
            <Слова ш={ш} размер={кегль(ш, 42)} ширина={1200} цвет="rgba(244,245,247,0.86)" />
          </div>
        </AbsoluteFill>, false);
    }

    case "предмет_орбита":
      return обёртка(
        <AbsoluteFill style={{ display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div style={{ transform: "scale(1.42)" }}>
            <Орбита ш={ш} тон={тон} файл={ш.предмет?.файл || ш.спутник || "u2_kamera.png"}
                    метки={[ш.предмет?.имя || "", ш.ключ || "", ш.предмет?.текст || ""]} />
          </div>
          <div style={{ position: "absolute", left: П, right: П, bottom: 70 }}>
            <Слова ш={ш} размер={кегль(ш, 44)} ширина={1500} центр цвет="rgba(244,245,247,0.9)" />
          </div>
        </AbsoluteFill>, false);

    case "предмет_силуэт":
      return обёртка(
        <AbsoluteFill style={{ display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div style={{ position: "absolute", opacity: 0.4, filter: "saturate(0.4)",
                        transform: `scale(${2.1 + ход * 0.25}) translateX(${(ход - 0.5) * 60 * з}px)` }}>
            <Предмет файл={"kadr/m/" + (ш.спутник || "u2_obyektiv.png")} размер={520} ш={ш} тон={тон} />
          </div>
          <AbsoluteFill style={{ padding: П, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <Слова ш={ш} размер={кегль(ш, 86)} ширина={1250} центр стиль={{ textShadow: "0 8px 40px rgba(0,0,0,0.8)" }} />
          </AbsoluteFill>
        </AbsoluteFill>, false);

    /* ---- объём ---- */

    case "объём_плиты":
      return обёртка(
        <Плиты ш={ш} тон={тон}
               дети={<Слова ш={ш} размер={кегль(ш, 74)} ширина={1050} центр />} />, false);

    case "объём_коридор":
      return обёртка(
        <AbsoluteFill>
          <Коридор ш={ш} тон={тон} слово={(ш.ключ || ш.слова?.[0]?.слово || "").toUpperCase()} />
          <div style={{ position: "absolute", left: П, right: П, bottom: 74 }}>
            <Слова ш={ш} размер={кегль(ш, 44)} ширина={1500} центр цвет="rgba(244,245,247,0.86)" />
          </div>
        </AbsoluteFill>, false);

    case "объём_куб": {
      const грани = (ш.слова || []).map((с: any) => с.слово).slice(0, 6);
      return обёртка(
        <AbsoluteFill style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 70 }}>
          <Куб ш={ш} тон={тон} грани={грани.length ? грани : [ш.ключ || ""]} />
          <div style={{ width: 620 }}>
            <Слова ш={ш} размер={кегль(ш, 50)} ширина={620} />
          </div>
        </AbsoluteFill>, false);
    }

    case "объём_карусель":
      return обёртка(
        <AbsoluteFill style={{ display: "flex", alignItems: "center", justifyContent: "center" }}>
          <Карусель ш={ш} тон={тон} файлы={ш.набор || ["u2_kamera.png", "u2_obyektiv.png", "u2_petlichka.png"]} />
          <div style={{ position: "absolute", left: П, right: П, bottom: 80 }}>
            <Слова ш={ш} размер={кегль(ш, 46)} ширина={1500} центр />
          </div>
        </AbsoluteFill>, false);

    /* ---- видео ---- */

    case "клип_полный":
      return (
        <AbsoluteFill style={{ backgroundColor: Т.фон }}>
          <AbsoluteFill style={камера_шота(ш.камера || "вглубь", ход, з)}>
            <Клип файл={ш.клип} стиль={{ filter: "contrast(1.05) saturate(1.06)" }} />
          </AbsoluteFill>
          <AbsoluteFill style={{ background: `linear-gradient(${з > 0 ? 90 : 270}deg, rgba(6,7,10,0.88) 0%, rgba(6,7,10,0.2) 55%, transparent 100%)` }} />
          <AbsoluteFill style={{ padding: П, display: "flex", flexDirection: "column", justifyContent: "flex-end" }}>
            <div style={вход_кадра(ш.вход || "вверх", frame, з)}>
              <Слова ш={ш} размер={кегль(ш, 68)} ширина={1150} />
            </div>
          </AbsoluteFill>
        </AbsoluteFill>);

    case "клип_окно":
      return обёртка(
        <AbsoluteFill style={{ padding: П, display: "flex", flexDirection: "row", alignItems: "center", gap: 54 }}>
          <div style={{ flex: "0 0 44%" }}>
            <Слова ш={ш} размер={кегль(ш, 58)} ширина={700} />
          </div>
          <div style={{ flex: 1, height: 700, borderRadius: 20, overflow: "hidden",
                        border: `1px solid ${тон}66`, boxShadow: `0 40px 90px rgba(0,0,0,0.6), 0 0 80px ${тон}33`,
                        transform: `perspective(1500px) rotateY(${з * (8 - ход * 14)}deg) scale(${0.96 + ход * 0.06})` }}>
            <Клип файл={ш.клип} />
          </div>
        </AbsoluteFill>, false);

    /* ---- графика ---- */

    case "график_общий":
      return обёртка(
        <AbsoluteFill style={{ padding: П, display: "flex", flexDirection: "column",
                               alignItems: "center", justifyContent: "center" }}>
          <div style={{ transform: `scale(${1.24 + ход * 0.07}) translate(${з * ход * -26}px, -48px)` }}>
            <Графика ш={ш} />
          </div>
          <Подпись ш={ш} текст={(ш.текст || "").length > 78 ? ш.текст.slice(0, 76) + "…" : ш.текст} />
        </AbsoluteFill>, false);

    case "график_деталь":
      return обёртка(
        <AbsoluteFill style={{ display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden" }}>
          <div style={{ transform: `scale(${1.5 + ход * 0.12}) translate(${з * (120 - ход * 90)}px, ${-120 + ход * 26}px)` }}>
            <Графика ш={ш} />
          </div>
          <div style={{ position: "absolute", left: 0, right: 0, bottom: 0, padding: `34px ${П}px 48px`,
                        background: "linear-gradient(0deg, rgba(6,7,10,0.94) 60%, transparent)" }}>
            <Слова ш={ш} размер={кегль(ш, 46)} ширина={1400} />
          </div>
        </AbsoluteFill>, false);

    case "график_сбоку":
      return обёртка(
        <AbsoluteFill style={{ padding: П, display: "flex", flexDirection: "row", alignItems: "center", gap: 46 }}>
          <div style={{ flex: "0 0 42%" }}>
            <Слова ш={ш} размер={кегль(ш, 56)} ширина={680} />
          </div>
          <div style={{ flex: 1, display: "flex", justifyContent: "center", perspective: 1200 }}>
            <div style={{ transform: `rotateY(${interpolate(frame, [0, durationInFrames], [16 * з, -8 * з])}deg) scale(${0.95 + ход * 0.08})` }}>
              <Графика ш={ш} />
            </div>
          </div>
        </AbsoluteFill>, false);

    case "график_маска": {
      const откр = interpolate(frame, [0, 18], [0, 100], { easing: РЕЗКО, extrapolateRight: "clamp" });
      const круг = сид(ш.id, "m") > 0.5;
      return обёртка(
        <AbsoluteFill style={{ display: "flex", alignItems: "center", justifyContent: "center",
                               clipPath: круг ? `circle(${откр}% at 50% 50%)` : `inset(0 0 ${100 - откр}% 0)` }}>
          <div style={{ transform: `scale(${1.3 - ход * 0.1}) translateY(-56px)` }}>
            <Графика ш={ш} />
          </div>
          <div style={{ position: "absolute", left: 0, right: 0, bottom: 0, padding: `34px ${П}px 48px`,
                        background: "linear-gradient(0deg, rgba(6,7,10,0.94) 60%, transparent)" }}>
            <Слова ш={ш} размер={кегль(ш, 44)} ширина={1400} />
          </div>
        </AbsoluteFill>, false);
    }

    default:
      return обёртка(
        <AbsoluteFill style={{ padding: П, display: "flex", alignItems: "center" }}>
          <Слова ш={ш} размер={кегль(ш, 76)} ширина={1200} />
        </AbsoluteFill>);
  }
};
