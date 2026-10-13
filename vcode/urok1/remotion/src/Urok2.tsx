import React from "react";
import { AbsoluteFill, Audio, Img, Sequence, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import монтаж2 from "../public/montazh2.json";
import { Т } from "./stage";
import { Вступление, Задание, Набор, Разбор, Сравнение, Финал } from "./sceny2";

const выбрать = (вид: string) => {
  switch (вид) {
    case "вступление": return Вступление;
    case "набор": return Набор;
    case "сравнение": return Сравнение;
    case "разбор": return Разбор;
    case "задание": return Задание;
    case "финал": return Финал;
    default: return Разбор;
  }
};

/** Субтитры по словам: слово подсвечивается ровно когда звучит. */
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
    if (длина > 48 || /[.!?]$/.test(с.слово)) { строки.push(текущая); текущая = []; }
  }
  if (текущая.length) строки.push(текущая);
  const активная = строки.find((стр) => t >= стр[0].старт - 0.15 && t <= стр[стр.length - 1].конец + 0.3);
  if (!активная) return null;
  return (
    <div style={{ position: "absolute", left: 0, right: 0, bottom: 72, display: "flex",
                  justifyContent: "center", pointerEvents: "none" }}>
      <div style={{ maxWidth: 1430, padding: "14px 30px", borderRadius: 16,
                    background: "rgba(6,7,10,0.55)", border: `1px solid ${Т.линия}`,
                    fontFamily: Т.корпус, fontSize: 34, fontWeight: 500,
                    color: "rgba(244,245,247,0.68)", textAlign: "center", lineHeight: 1.28 }}>
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

const Шапка: React.FC<{ блок: string; доля: number }> = ({ блок, доля }) => {
  const frame = useCurrentFrame();
  return (
    <>
      <div style={{ position: "absolute", left: 56, top: 44, display: "flex", alignItems: "center",
                    gap: 12, opacity: 0.8 }}>
        <span style={{ width: 8, height: 8, borderRadius: 8, background: Т.акцент2,
                       opacity: 0.5 + Math.abs(Math.sin(frame / 22)) * 0.5 }} />
        <span style={{ fontFamily: Т.корпус, fontSize: 22, letterSpacing: "0.22em",
                       color: Т.тихий, textTransform: "uppercase" }}>{блок}</span>
      </div>
      <div style={{ position: "absolute", right: 56, bottom: 44, display: "flex", alignItems: "center",
                    gap: 12, opacity: 0.9 }}>
        <Img src={staticFile("logo.png")} style={{ width: 40, height: 40 }} />
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

const Кусок: React.FC<{ с: any }> = ({ с }) => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const К: any = выбрать(с.вид);
  // Сцены не режутся встык: одна уходит, следующая уже едет.
  const вх = Math.min(1, frame / 12);
  const ух = Math.min(1, (durationInFrames - frame) / 12);
  return (
    <AbsoluteFill style={{ opacity: Math.min(вх, ух),
                           transform: `scale(${1 + (1 - Math.min(вх, ух)) * 0.02})` }}>
      <К с={с} слова={с.слова || []} />
      <Субтитры слова={с.слова || []} />
      {с.звук ? <Audio src={staticFile(с.звук)} /> : null}
      <Sequence durationInFrames={26}>
        <Audio src={staticFile("zvuk/whoosh.mp3")} volume={0.2} />
      </Sequence>
    </AbsoluteFill>
  );
};

export const Urok2: React.FC = () => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  let курсор = 0;
  const куски = (монтаж2 as any).сцены.map((с: any) => {
    const от = курсор;
    курсор += с.кадров;
    return { с, от };
  });
  return (
    <AbsoluteFill style={{ backgroundColor: Т.фон }}>
      {куски.map(({ с, от }: any) => (
        <Sequence key={с.id} from={от} durationInFrames={с.кадров} name={с.id}>
          <Кусок с={с} />
        </Sequence>
      ))}
      {(монтаж2 as any).музыка ? (
        <Audio src={staticFile((монтаж2 as any).музыка)} volume={0.5} loop />
      ) : null}
      <Шапка блок={(монтаж2 as any).блок || "Занятие 1"} доля={frame / durationInFrames} />
    </AbsoluteFill>
  );
};
