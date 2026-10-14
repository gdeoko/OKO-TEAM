import React from "react";
import { AbsoluteFill, Audio, Img, Sequence, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { TransitionSeries, linearTiming, springTiming } from "@remotion/transitions";
import { fade } from "@remotion/transitions/fade";
import { slide } from "@remotion/transitions/slide";
import { wipe } from "@remotion/transitions/wipe";
import { flip } from "@remotion/transitions/flip";
import { clockWipe } from "@remotion/transitions/clock-wipe";
import монтаж from "../public/montazh2.json";
import { Т } from "./dvizh";
import { Вступление, Задание, Набор, Разбор, Сравнение, Финал } from "./sceny3";

/** Перехлёст между сценами. Длительность каждой сцены увеличена ровно на него,
 *  поэтому начало каждой сцены совпадает с её озвучкой. */
export const ПЕРЕХОД = 16;

const выбрать = (вид: string) => {
  switch (вид) {
    case "вступление": return Вступление;
    case "набор": return Набор;
    case "сравнение": return Сравнение;
    case "задание": return Задание;
    case "финал": return Финал;
    default: return Разбор;
  }
};

/** Каждая склейка своя: подряд одинаковых нет. */
const ПЕРЕХОДЫ = [
  () => slide({ direction: "from-right" }),
  () => wipe({ direction: "from-bottom-right" }),
  () => flip({ direction: "from-left" }),
  () => slide({ direction: "from-bottom" }),
  () => clockWipe({ width: 1920, height: 1080 }),
  () => wipe({ direction: "from-left" }),
  () => slide({ direction: "from-top" }),
  () => fade(),
  () => flip({ direction: "from-top" }),
  () => wipe({ direction: "from-top-left" }),
  () => slide({ direction: "from-left" }),
  () => wipe({ direction: "from-right" }),
];

const Субтитры: React.FC<{ слова: any[] }> = ({ слова }) => {
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
  const активная = строки.find((стр) => t >= стр[0].старт - 0.15 && t <= стр[стр.length - 1].конец + 0.28);
  if (!активная) return null;
  const возраст = t - активная[0].старт;
  const вход = Math.min(1, Math.max(0, (возраст + 0.15) / 0.22));
  return (
    <div style={{ position: "absolute", left: 0, right: 0, bottom: 70, display: "flex",
                  justifyContent: "center", pointerEvents: "none" }}>
      <div style={{ maxWidth: 1430, padding: "14px 30px", borderRadius: 16,
                    background: "rgba(6,7,10,0.55)", border: `1px solid ${Т.линия}`,
                    fontFamily: Т.корпус, fontSize: 34, fontWeight: 500,
                    color: "rgba(244,245,247,0.68)", textAlign: "center", lineHeight: 1.28,
                    opacity: вход, translate: `0px ${(1 - вход) * 14}px` }}>
        {активная.map((с, i) => (
          <span key={i} style={{ marginRight: "0.3em",
                                 color: t >= с.старт - 0.05 ? Т.текст : "rgba(244,245,247,0.45)" }}>
            {с.слово}
          </span>
        ))}
      </div>
    </div>
  );
};

const Кусок: React.FC<{ с: any }> = ({ с }) => {
  const К: any = выбрать(с.вид);
  return (
    <AbsoluteFill>
      <К с={с} />
      <Субтитры слова={с.слова || []} />
      {с.звук ? <Audio src={staticFile(с.звук)} /> : null}
      <Sequence durationInFrames={26}>
        <Audio src={staticFile("zvuk/whoosh.mp3")} volume={0.22} />
      </Sequence>
    </AbsoluteFill>
  );
};

const Угол: React.FC<{ блок: string; доля: number }> = ({ блок, доля }) => {
  const frame = useCurrentFrame();
  return (
    <>
      <div style={{ position: "absolute", left: 56, top: 42, display: "flex", alignItems: "center",
                    gap: 12, opacity: 0.8 }}>
        <span style={{ width: 8, height: 8, borderRadius: 8, background: Т.акцент2,
                       opacity: 0.4 + Math.abs(Math.sin(frame / 20)) * 0.6 }} />
        <span style={{ fontFamily: Т.корпус, fontSize: 22, letterSpacing: "0.22em",
                       color: Т.тихий, textTransform: "uppercase" }}>{блок}</span>
      </div>
      <div style={{ position: "absolute", right: 56, bottom: 42, display: "flex", alignItems: "center",
                    gap: 12, opacity: 0.9 }}>
        <Img src={staticFile("logo.png")} style={{ width: 40, height: 40,
             rotate: `${Math.sin(frame / 90) * 4}deg` }} />
        <span style={{ fontFamily: Т.шапка, fontSize: 22, fontWeight: 700, color: Т.текст,
                       letterSpacing: "0.06em" }}>V.LIONOFF</span>
      </div>
      <div style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: 4,
                    background: "rgba(255,255,255,0.06)" }}>
        <div style={{ width: `${доля * 100}%`, height: "100%",
                      background: `linear-gradient(90deg, ${Т.акцент}, ${Т.акцент2})` }} />
      </div>
    </>
  );
};

export const Urok3: React.FC = () => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const сцены = (монтаж as any).сцены;
  return (
    <AbsoluteFill style={{ backgroundColor: Т.фон }}>
      <TransitionSeries>
        {сцены.map((с: any, i: number) => (
          <React.Fragment key={с.id}>
            {i > 0 ? (
              <TransitionSeries.Transition
                presentation={ПЕРЕХОДЫ[i % ПЕРЕХОДЫ.length]()}
                timing={i % 3 === 0
                  ? springTiming({ config: { damping: 200 }, durationInFrames: ПЕРЕХОД })
                  : linearTiming({ durationInFrames: ПЕРЕХОД })}
              />
            ) : null}
            <TransitionSeries.Sequence durationInFrames={с.кадров + ПЕРЕХОД}>
              <Кусок с={с} />
            </TransitionSeries.Sequence>
          </React.Fragment>
        ))}
      </TransitionSeries>
      {(монтаж as any).музыка ? (
        <Audio src={staticFile((монтаж as any).музыка)} volume={0.5} loop />
      ) : null}
      <Угол блок={(монтаж as any).блок || "Занятие 1"} доля={frame / durationInFrames} />
    </AbsoluteFill>
  );
};
