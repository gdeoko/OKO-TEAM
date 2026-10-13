import React from "react";
import { AbsoluteFill, Easing, Img, interpolate, random, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { Т } from "./dvizh";
import { Глубина, Диафрагма, КропКадр, Матрицы, Таблица, УголОбзора, Частота, Экспозиция, Выдержка } from "./graf";

const ВЫХОД = Easing.bezier(0.16, 1, 0.3, 1);
const РЕЗКО = Easing.bezier(0.5, 0, 0.1, 1);

const сид = (s: string, k = "") => random(s + k);

/** Кегль под объём фразы: длинная фраза не должна вылезать за поля. */
const кегль = (ш: any, база: number) => {
  const зн = ш.знаков || (ш.текст || "").length;
  const к = зн <= 28 ? 1 : зн <= 50 ? 0.82 : зн <= 75 ? 0.68 : зн <= 100 ? 0.56 : 0.46;
  return Math.round(база * к);
};
const знак = (s: string, k = "") => (сид(s, k) > 0.5 ? 1 : -1);

/** Вход и выход шота: вместе дают рез, а не плавное болото. */
export const жизнь = (frame: number, всего: number) => 1;

/** Удар на входе шота: кадр влетает за три кадра и тормозит. */
export const удар = (frame: number, з: number) => ({
  scale: interpolate(frame, [0, 5], [1.08, 1], { easing: РЕЗКО, extrapolateRight: "clamp" }),
  translate: `${interpolate(frame, [0, 6], [40 * з, 0], { easing: РЕЗКО, extrapolateRight: "clamp" })}px 0px`,
});

/** Фон шота: своё состояние на каждый рез, поэтому склейка видна. */
const Фон: React.FC<{ ш: any; тон?: string }> = ({ ш, тон = Т.акцент }) => {
  const frame = useCurrentFrame();
  const светлый = (ш["№"] || 0) % 3 === 1;
  const { width, height, durationInFrames } = useVideoConfig();
  const нx = сид(ш.id, "fx") * 100;
  const нy = сид(ш.id, "fy") * 100;
  const з = знак(ш.id, "fd");
  const ход = interpolate(frame, [0, durationInFrames], [0, 1]);
  const угол = Math.round(сид(ш.id, "fa") * 180);
  return (
    <AbsoluteFill style={{ backgroundColor: Т.фон, overflow: "hidden" }}>
      <AbsoluteFill style={{
        background:
          `radial-gradient(${светлый ? 58 : 42}% ${светлый ? 60 : 46}% at ${нx + ход * з * 14}% ${нy + ход * 8}%, ${тон}${светлый ? "80" : "4D"} 0%, transparent ${светлый ? 78 : 70}%),` +
          `radial-gradient(38% 42% at ${100 - нx}% ${100 - нy - ход * 10}%, ${Т.акцент2}${светлый ? "4D" : "33"} 0%, transparent 72%)`,
      }} />
      <AbsoluteFill style={{
        opacity: 0.13,
        backgroundImage: `repeating-linear-gradient(${угол}deg, ${Т.акцент2}55 0 2px, transparent 2px 120px)`,
        translate: `${(frame * 4.5 * з) % 240}px ${(frame * 1.4) % 120}px`,
      }} />
      <AbsoluteFill style={{ perspective: 800 }}>
        <div style={{
          position: "absolute", left: "-40%", right: "-40%", bottom: "-25%", height: "140%",
          transform: `rotateX(${68 + сид(ш.id, "gx") * 10}deg) translateY(${(frame * 2.4 * з) % 150}px)`,
          transformOrigin: "50% 100%",
          backgroundImage: `linear-gradient(${тон}2A 1px, transparent 1px), linear-gradient(90deg, ${тон}1F 1px, transparent 1px)`,
          backgroundSize: "150px 150px",
          maskImage: "linear-gradient(to top, rgba(0,0,0,0.9) 0%, transparent 68%)",
          WebkitMaskImage: "linear-gradient(to top, rgba(0,0,0,0.9) 0%, transparent 68%)",
        }} />
      </AbsoluteFill>
      <AbsoluteFill>
        {new Array(26).fill(0).map((_, i) => {
          const x = сид(ш.id, "px" + i) * width;
          const ск = 0.6 + сид(ш.id, "pv" + i) * 2.2;
          const y = ((сид(ш.id, "py" + i) * height + frame * ск * з * 2) % (height + 100)) - 50;
          const r = 1 + сид(ш.id, "pr" + i) * 2.4;
          return <div key={i} style={{ position: "absolute", left: x, top: y, width: r * 2, height: r * 2,
                                       borderRadius: 9, background: "#CFE4FF",
                                       opacity: 0.12 + сид(ш.id, "po" + i) * 0.4 }} />;
        })}
      </AbsoluteFill>
      <AbsoluteFill style={{ background: "radial-gradient(78% 78% at 50% 46%, transparent 34%, rgba(0,0,0,0.82) 100%)" }} />
    </AbsoluteFill>
  );
};

/** Слова появляются ровно тогда, когда звучат. */
const Слова: React.FC<{
  ш: any; размер: number; ширина?: number; центр?: boolean; цвет?: string;
}> = ({ ш, размер, ширина = 1400, центр = false, цвет = Т.текст }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = frame / fps;
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: "0.06em 0.3em", maxWidth: ширина,
                  justifyContent: центр ? "center" : "flex-start",
                  fontFamily: Т.шапка, fontWeight: 800, fontSize: размер, lineHeight: 1.05,
                  letterSpacing: "-0.018em", color: цвет, perspective: 900 }}>
      {(ш.слова || []).map((с: any, i: number) => {
        const д = interpolate(t, [с.старт - 0.08, с.старт + 0.16], [0, 1],
                              { easing: ВЫХОД, extrapolateLeft: "clamp", extrapolateRight: "clamp" });
        const з = i % 2 === 0 ? 1 : -1;
        const свеж = interpolate(t, [с.старт, с.старт + 0.5], [1, 0],
                                 { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
        return (
          <span key={i} style={{
            display: "inline-block", opacity: д,
            translate: `${(1 - д) * 46 * з}px ${(1 - д) * 30}px`,
            rotate: `${(1 - д) * 10 * з}deg`,
            scale: 1 + свеж * 0.06,
            color: свеж > 0.6 ? Т.акцент2 : цвет,
          }}>{с.слово}</span>
        );
      })}
    </div>
  );
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

const Предмет: React.FC<{ файл: string; размер: number; ш: any; тон?: string }> = ({
  файл, размер, ш, тон = Т.акцент,
}) => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const t = frame / 25;
  const блик = ((t * 22) % 160) - 30;
  const пов = interpolate(frame, [0, durationInFrames], [-14, 14]) * знак(ш.id, "r");
  return (
    <div style={{ position: "relative", width: размер, height: размер, perspective: 1400 }}>
      <div style={{ position: "absolute", inset: "12%", borderRadius: "50%",
                    background: `radial-gradient(circle, ${тон}55 0%, transparent 68%)`,
                    filter: "blur(28px)", scale: 1 + Math.sin(t * 1.4) * 0.07 }} />
      <div style={{ position: "relative", width: размер, height: размер, rotate: `y ${пов}deg` }}>
        <Img src={staticFile(файл)} style={{ width: размер, height: размер, objectFit: "contain",
             display: "block", filter: `drop-shadow(0 24px 38px rgba(0,0,0,0.7)) drop-shadow(0 0 28px ${тон}44)` }} />
        <div style={{ position: "absolute", inset: 0, maskImage: `url(${staticFile(файл)})`,
          WebkitMaskImage: `url(${staticFile(файл)})`, maskSize: "contain", WebkitMaskSize: "contain",
          maskRepeat: "no-repeat", WebkitMaskRepeat: "no-repeat", maskPosition: "center",
          WebkitMaskPosition: "center", mixBlendMode: "screen",
          background: `linear-gradient(100deg, transparent ${блик}%, rgba(255,255,255,0.45) ${блик + 14}%, ${тон}66 ${блик + 22}%, transparent ${блик + 38}%)`,
        }} />
      </div>
    </div>
  );
};

/** Спутник кадра: вещь, которая живёт рядом с текстом и не даёт кадру опустеть. */
const Спутник: React.FC<{ ш: any; тон: string; сторона?: "лево" | "право" }> = ({
  ш, тон, сторона = "право",
}) => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const файл = ш.спутник || "u2_kamera.png";
  const ход = interpolate(frame, [0, durationInFrames], [0, 1]);
  const з = знак(ш.id, "sp");
  const д = interpolate(frame, [0, 12], [0, 1], { easing: ВЫХОД, extrapolateRight: "clamp" });
  return (
    <div style={{
      position: "absolute", [сторона === "право" ? "right" : "left"]: 10 - ход * 50 * з,
      top: 90 + сид(ш.id, "sy") * 380, opacity: д * 0.92,
      rotate: `${interpolate(frame, [0, durationInFrames], [-8 * з, 8 * з])}deg`,
      scale: 0.9 + ход * 0.12,
    } as any}>
      <Предмет файл={"kadr/" + файл} размер={330} ш={ш} тон={тон} />
    </div>
  );
};

/** Подложка под текстом: мягкая плита, которая выезжает вместе с фразой. */
const Плита: React.FC<{ ш: any; тон: string }> = ({ ш, тон }) => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const д = interpolate(frame, [0, 10], [0, 1], { easing: РЕЗКО, extrapolateRight: "clamp" });
  const ход = interpolate(frame, [0, durationInFrames], [0, 1]);
  const з = знак(ш.id, "pl");
  return (
    <div style={{
      position: "absolute", left: `${6 + сид(ш.id, "plx") * 8}%`, right: `${18 + сид(ш.id, "ply") * 10}%`,
      top: "26%", bottom: "26%", borderRadius: 28,
      background: `linear-gradient(${120 + сид(ш.id, "pg") * 100}deg, ${тон}1A, rgba(255,255,255,0.02))`,
      border: `1px solid ${тон}2E`,
      opacity: д * 0.9, scaleX: 0.9 + д * 0.1,
      translate: `${(1 - д) * 60 * з + ход * 16 * з}px 0px`,
    } as any} />
  );
};

/** Кольца и линии, которые идут через кадр: кадр не стоит никогда. */
const Контур: React.FC<{ ш: any; тон: string }> = ({ ш, тон }) => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const ход = interpolate(frame, [0, durationInFrames], [0, 1]);
  const з = знак(ш.id, "ko");
  return (
    <AbsoluteFill style={{ pointerEvents: "none" }}>
      <div style={{ position: "absolute", left: `${10 + сид(ш.id, "kx") * 60}%`, top: "-30%",
                    width: 760, height: 760, borderRadius: 999, border: `1px solid ${тон}2E`,
                    translate: `${з * ход * 90}px ${ход * 120}px`, scale: 0.8 + ход * 0.3 }} />
      <div style={{ position: "absolute", left: 0, right: 0, top: `${30 + сид(ш.id, "ky") * 40}%`,
                    height: 1, background: `linear-gradient(90deg, transparent, ${тон}66, transparent)`,
                    translate: `${-з * (1 - ход) * 600}px 0px` }} />
    </AbsoluteFill>
  );
};

const Подпись: React.FC<{ текст: string; низ?: number }> = ({ текст, низ = 92 }) => {
  const frame = useCurrentFrame();
  const д = interpolate(frame, [2, 10], [0, 1], { easing: ВЫХОД, extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  if (!текст) return null;
  return (
    <div style={{ position: "absolute", left: 0, right: 0, bottom: низ, display: "flex",
                  justifyContent: "center", opacity: д, translate: `0px ${(1 - д) * 16}px` }}>
      <div style={{ fontFamily: Т.корпус, fontSize: 30, color: "rgba(244,245,247,0.78)",
                    letterSpacing: "0.04em", padding: "8px 22px", borderRadius: 12,
                    background: "rgba(6,7,10,0.5)", border: `1px solid ${Т.линия}` }}>{текст}</div>
    </div>
  );
};

/** Один шот. Тип решает композицию, движение внутри своё у каждого. */
export const Шот: React.FC<{ ш: any }> = ({ ш }) => {
  const frame = useCurrentFrame();
  const { durationInFrames, fps } = useVideoConfig();
  const ж = жизнь(frame, durationInFrames);
  const ход = interpolate(frame, [0, durationInFrames], [0, 1]);
  const з = знак(ш.id, "k");
  const тон = ш.вид === "задание" ? Т.тёплый : сид(ш.id, "t") > 0.6 ? Т.акцент2 : Т.акцент;
  const П = Т.поле;

  const текстовый = ["титр", "крупно", "акцент", "полоса", "раскол", "лесенка", "шторка",
                     "угол", "цифра"].includes(ш.тип);
  const обёртка = (дети: React.ReactNode, камера?: React.CSSProperties) => (
    <AbsoluteFill style={{ opacity: ж }}>
      <Фон ш={ш} тон={тон} />
      {текстовый ? <Контур ш={ш} тон={тон} /> : null}
      {текстовый && сид(ш.id, "plita") > 0.45 ? <Плита ш={ш} тон={тон} /> : null}
      <AbsoluteFill style={{ ...camera_умолч(камера, ход, з), ...удар(frame, з) }}>
        {текстовый && ш.тип !== "цифра" ? (
          <Спутник ш={ш} тон={тон} сторона={з > 0 ? "право" : "лево"} />
        ) : null}
        {дети}
      </AbsoluteFill>
    </AbsoluteFill>
  );

  switch (ш.тип) {
    case "титр":
      return обёртка(
        <AbsoluteFill style={{ padding: П, display: "flex", flexDirection: "column",
                               justifyContent: "center", gap: 22 }}>
          <div style={{ fontFamily: Т.корпус, fontSize: 24, letterSpacing: "0.34em",
                        color: Т.акцент2, opacity: interpolate(frame, [0, 8], [0, 1], { extrapolateRight: "clamp" }) }}>
            {(ш.надзаголовок || ш.заголовок || "").toUpperCase().slice(0, 48)}
          </div>
          <Слова ш={ш} размер={кегль(ш, 92)} ширина={1150} />
          <div style={{ height: 5, width: `${interpolate(frame, [6, 26], [0, 60], { extrapolateRight: "clamp" })}%`,
                        background: `linear-gradient(90deg, ${Т.акцент}, ${Т.акцент2})`, borderRadius: 5 }} />
        </AbsoluteFill>, { scale: 1 + ход * 0.05 });

    case "крупно":
      return обёртка(
        <AbsoluteFill style={{ padding: П, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <Слова ш={ш} размер={кегль(ш, 104)} ширина={1250} центр />
        </AbsoluteFill>, { scale: 1.06 - ход * 0.06, translate: `${з * ход * -30}px 0px` });

    case "акцент": {
      const кл = ш.ключ || (ш.слова?.[0]?.слово ?? "");
      return обёртка(
        <AbsoluteFill style={{ padding: П, display: "flex", flexDirection: "column",
                               justifyContent: "center", alignItems: "center", gap: 26 }}>
          <div style={{ fontFamily: Т.шапка, fontSize: 190, fontWeight: 800, color: Т.текст,
                        letterSpacing: "-0.04em", textShadow: `0 0 70px ${тон}66`,
                        scale: interpolate(frame, [0, 14], [1.3, 1], { easing: ВЫХОД, extrapolateRight: "clamp" }),
                        rotate: `${(1 - ж) * 6 * з}deg` }}>{кл}</div>
          <Слова ш={ш} размер={кегль(ш, 44)} ширина={1150} центр цвет="rgba(244,245,247,0.8)" />
        </AbsoluteFill>, { translate: `0px ${ход * -20}px` });
    }

    case "полоса":
      return обёртка(
        <AbsoluteFill style={{ display: "flex", flexDirection: "column", justifyContent: "center" }}>
          <div style={{ width: "140%", marginLeft: "-20%", padding: "48px 90px",
                        background: `linear-gradient(90deg, ${тон}26, transparent)`,
                        borderTop: `2px solid ${тон}66`, borderBottom: `2px solid ${тон}66`,
                        rotate: `${-4 * з}deg`,
                        translate: `${interpolate(frame, [0, durationInFrames], [-60 * з, 60 * з])}px 0px` }}>
            <Слова ш={ш} размер={кегль(ш, 76)} ширина={1250} />
          </div>
        </AbsoluteFill>);

    case "раскол":
      return обёртка(
        <AbsoluteFill>
          <div style={{ position: "absolute", left: 0, right: 0, top: 0, height: "50%",
                        background: `linear-gradient(180deg, ${тон}1F, transparent)`,
                        translate: `${interpolate(frame, [0, durationInFrames], [-70, 30]) * з}px 0px` }} />
          <div style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: "50%",
                        background: `linear-gradient(0deg, ${Т.акцент2}1A, transparent)`,
                        translate: `${interpolate(frame, [0, durationInFrames], [70, -30]) * з}px 0px` }} />
          <AbsoluteFill style={{ padding: `${П}px`, display: "flex", flexDirection: "column",
                                 justifyContent: "center", alignItems: "flex-start" }}>
            <Слова ш={ш} размер={кегль(ш, 82)} ширина={1100} />
          </AbsoluteFill>
        </AbsoluteFill>);

    case "лесенка":
      return обёртка(
        <AbsoluteFill style={{ padding: П, display: "flex", flexDirection: "column",
                               justifyContent: "center", gap: 6 }}>
          {(ш.слова || []).map((с: any, i: number) => {
            const t = frame / fps;
            const д = interpolate(t, [с.старт - 0.06, с.старт + 0.18], [0, 1],
                                  { easing: ВЫХОД, extrapolateLeft: "clamp", extrapolateRight: "clamp" });
            return (
              <div key={i} style={{ fontFamily: Т.шапка, fontSize: кегль(ш, 72), fontWeight: 800,
                                    color: i % 3 === 1 ? Т.акцент2 : Т.текст, opacity: д,
                                    marginLeft: Math.min(i, 4) * 54, translate: `${(1 - д) * (i % 2 ? 90 : -90)}px 0px` }}>
                {с.слово}
              </div>
            );
          })}
        </AbsoluteFill>, { scale: 1 + ход * 0.04 });

    case "шторка": {
      const откр = interpolate(frame, [0, 16], [0, 100], { easing: РЕЗКО, extrapolateRight: "clamp" });
      return обёртка(
        <AbsoluteFill style={{ padding: П, display: "flex", flexDirection: "column",
                               justifyContent: "center", alignItems: "flex-start",
                               clipPath: `inset(0 ${100 - откр}% 0 0)` }}>
          <div style={{ borderLeft: `6px solid ${тон}`, paddingLeft: 36 }}>
            <Слова ш={ш} размер={кегль(ш, 78)} ширина={1050} />
          </div>
        </AbsoluteFill>, { translate: `${ход * 24 * з}px 0px` });
    }

    case "угол":
      return обёртка(
        <AbsoluteFill style={{ padding: П }}>
          <div style={{ position: "absolute", left: -200, top: -200, width: 900, height: 900,
                        border: `2px solid ${тон}44`, borderRadius: 40,
                        rotate: `${interpolate(frame, [0, durationInFrames], [10, 26])}deg` }} />
          <AbsoluteFill style={{ padding: П, display: "flex", flexDirection: "column",
                                 justifyContent: "center", alignItems: "flex-start" }}>
            <Слова ш={ш} размер={кегль(ш, 72)} ширина={1050} />
          </AbsoluteFill>
        </AbsoluteFill>, { scale: 1.04 - ход * 0.04 });

    case "цифра": {
      const ц = ш.цифра || "";
      const число = parseInt(ц.replace(/\D/g, ""), 10) || 0;
      const бег = Math.round(interpolate(frame, [0, 22], [0, число],
                                         { easing: ВЫХОД, extrapolateRight: "clamp" }));
      return обёртка(
        <AbsoluteFill style={{ padding: П, display: "flex", flexDirection: "row",
                               alignItems: "center", gap: 60 }}>
          <div style={{ fontFamily: Т.шапка, fontSize: 260, fontWeight: 800, color: Т.текст,
                        letterSpacing: "-0.05em", textShadow: `0 0 90px ${тон}77`,
                        translate: `0px ${(1 - ж) * 40}px` }}>{бег}</div>
          <Слова ш={ш} размер={кегль(ш, 46)} ширина={760} цвет="rgba(244,245,247,0.85)" />
        </AbsoluteFill>);
    }

    case "предмет_пролёт":
      return обёртка(
        <AbsoluteFill style={{ padding: П, display: "flex", flexDirection: "column",
                               justifyContent: "center" }}>
          <div style={{ position: "absolute", left: 0, right: 0, top: "38%", display: "flex",
                        justifyContent: "center",
                        translate: `${interpolate(frame, [0, durationInFrames], [700 * з, -700 * з])}px 0px`,
                        rotate: `${interpolate(frame, [0, durationInFrames], [-12, 12]) * з}deg` }}>
            <Предмет файл={"kadr/" + (ш.предмет?.файл || "u2_kamera.png")} размер={460} ш={ш} тон={тон} />
          </div>
          <Слова ш={ш} размер={кегль(ш, 66)} ширина={820} />
        </AbsoluteFill>);

    case "предмет_крупно":
      return обёртка(
        <AbsoluteFill style={{ padding: П, display: "flex", flexDirection: "row",
                               alignItems: "center", gap: 50 }}>
          <div style={{ flex: "0 0 46%" }}>
            <div style={{ fontFamily: Т.шапка, fontSize: 56, fontWeight: 800, color: Т.текст,
                          marginBottom: 16, opacity: interpolate(frame, [0, 10], [0, 1], { extrapolateRight: "clamp" }) }}>
              {ш.предмет?.имя || ""}
            </div>
            <Слова ш={ш} размер={40} ширина={640} цвет="rgba(244,245,247,0.85)" />
          </div>
          <div style={{ flex: 1, display: "flex", justifyContent: "center",
                        scale: 1 + ход * 0.1 }}>
            <Предмет файл={"kadr/" + (ш.предмет?.файл || "u2_kamera.png")} размер={520} ш={ш} тон={тон} />
          </div>
        </AbsoluteFill>);

    case "предмет_сетка":
      return обёртка(
        <AbsoluteFill style={{ padding: П, display: "flex", flexDirection: "column",
                               justifyContent: "center", gap: 30 }}>
          <div style={{ display: "flex", gap: 26, justifyContent: "center" }}>
            {["u2_kamera.png", "u2_obyektiv.png", "u2_petlichka.png", "u2_softboks.png", "u2_shtativ.png"]
              .map((ф, i) => {
                const свой = i === Math.floor(ход * 5) % 5;
                return (
                  <div key={i} style={{ opacity: свой ? 1 : 0.35, scale: свой ? 1.12 : 0.9,
                                        translate: `0px ${свой ? -14 : 10}px` }}>
                    <Предмет файл={"kadr/" + ф} размер={свой ? 230 : 190} ш={{ ...ш, id: ш.id + i }}
                             тон={i % 2 ? Т.акцент2 : Т.акцент} />
                  </div>
                );
              })}
          </div>
          <div style={{ display: "flex", justifyContent: "center" }}>
            <Слова ш={ш} размер={кегль(ш, 48)} ширина={1150} центр />
          </div>
        </AbsoluteFill>);

    case "предмет_разбор": {
      const метки = [ш.предмет?.имя || "", ш.предмет?.текст || ""].filter(Boolean);
      return обёртка(
        <AbsoluteFill style={{ padding: П, display: "flex", flexDirection: "column",
                               alignItems: "center", justifyContent: "center" }}>
          <div style={{ position: "relative" }}>
            <Предмет файл={"kadr/" + (ш.предмет?.файл || "u2_obyektiv.png")} размер={560} ш={ш} тон={тон} />
            {метки.map((м, i) => {
              const д = interpolate(frame, [8 + i * 8, 22 + i * 8], [0, 1],
                                    { easing: ВЫХОД, extrapolateLeft: "clamp", extrapolateRight: "clamp" });
              return (
                <div key={i} style={{ position: "absolute", left: i % 2 ? -260 : 520,
                                      top: 80 + i * 180, opacity: д,
                                      translate: `${(1 - д) * (i % 2 ? -40 : 40)}px 0px`,
                                      fontFamily: Т.корпус, fontSize: 28, color: Т.текст,
                                      maxWidth: 300, borderLeft: `3px solid ${тон}`, paddingLeft: 14 }}>
                  {м}
                </div>
              );
            })}
          </div>
          <div style={{ position: "absolute", left: П, right: П, bottom: П }}>
            <Слова ш={ш} размер={кегль(ш, 40)} ширина={1200} цвет="rgba(244,245,247,0.85)" />
          </div>
        </AbsoluteFill>);
    }

    case "график_общий":
      return обёртка(
        <AbsoluteFill style={{ padding: П, display: "flex", flexDirection: "column",
                               alignItems: "center", justifyContent: "center" }}>
          <div style={{ scale: 1 + ход * 0.06, translate: `${з * ход * -24}px 0px` }}>
            <Графика ш={ш} />
          </div>
          <Подпись текст={ш.текст.length > 78 ? ш.текст.slice(0, 76) + "…" : ш.текст} />
        </AbsoluteFill>);

    case "график_деталь":
      return обёртка(
        <AbsoluteFill style={{ display: "flex", flexDirection: "column", alignItems: "center",
                               justifyContent: "center", overflow: "hidden" }}>
          <div style={{ scale: 1.75 + ход * 0.12,
                        translate: `${з * (120 - ход * 90)}px ${-40 + ход * 30}px` }}>
            <Графика ш={ш} />
          </div>
          <div style={{ position: "absolute", left: П, bottom: П, right: П }}>
            <Слова ш={ш} размер={кегль(ш, 46)} ширина={1100} />
          </div>
        </AbsoluteFill>);

    case "график_сбоку":
      return обёртка(
        <AbsoluteFill style={{ padding: П, display: "flex", flexDirection: "row",
                               alignItems: "center", gap: 46 }}>
          <div style={{ flex: "0 0 42%" }}>
            <Слова ш={ш} размер={кегль(ш, 54)} ширина={660} />
          </div>
          <div style={{ flex: 1, display: "flex", justifyContent: "center",
                        perspective: 1200 }}>
            <div style={{ rotate: `y ${interpolate(frame, [0, durationInFrames], [14 * з, -6 * з])}deg`,
                          scale: 0.95 + ход * 0.08 }}>
              <Графика ш={ш} />
            </div>
          </div>
        </AbsoluteFill>);

    case "график_маска": {
      const откр = interpolate(frame, [0, 18], [0, 100], { easing: РЕЗКО, extrapolateRight: "clamp" });
      const круг = сид(ш.id, "m") > 0.5;
      return обёртка(
        <AbsoluteFill style={{ display: "flex", flexDirection: "column", alignItems: "center",
                               justifyContent: "center",
                               clipPath: круг ? `circle(${откр}% at 50% 50%)` : `inset(0 0 ${100 - откр}% 0)` }}>
          <div style={{ scale: 1.1 - ход * 0.08 }}>
            <Графика ш={ш} />
          </div>
          <div style={{ position: "absolute", left: П, bottom: П, right: П }}>
            <Слова ш={ш} размер={кегль(ш, 44)} ширина={1150} />
          </div>
        </AbsoluteFill>);
    }

    default:
      return обёртка(
        <AbsoluteFill style={{ padding: П, display: "flex", alignItems: "center" }}>
          <Слова ш={ш} размер={кегль(ш, 74)} ширина={1200} />
        </AbsoluteFill>);
  }
};

/** Камера шота: если тип не задал свою, работает общая, со своим направлением. */
function camera_умолч(своя: React.CSSProperties | undefined, ход: number, з: number): React.CSSProperties {
  if (своя) return своя;
  return { translate: `${з * ход * 26}px ${ход * -14}px`, scale: 1 + ход * 0.03 };
}
