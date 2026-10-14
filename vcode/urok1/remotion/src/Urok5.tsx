import React from "react";
import { AbsoluteFill, Audio, Img, Sequence, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import лист from "../public/shoty2.json";
import { Т } from "./dvizh";
import { Шот } from "./shot2";
import "./shrifty";

/** Угол кадра: метка занятия, логотип и линия прохождения. */
const Угол: React.FC<{ блок: string; доля: number }> = ({ блок, доля }) => {
  const frame = useCurrentFrame();
  return (
    <>
      <div style={{ position: "absolute", left: 52, top: 40, display: "flex", alignItems: "center",
                    gap: 10, opacity: 0.75 }}>
        <span style={{ width: 7, height: 7, borderRadius: 7, background: Т.акцент2,
                       opacity: 0.4 + Math.abs(Math.sin(frame / 16)) * 0.6 }} />
        <span style={{ fontFamily: '"Inter", sans-serif', fontSize: 20, letterSpacing: "0.2em",
                       color: Т.тихий, textTransform: "uppercase" }}>{блок}</span>
      </div>
      <div style={{ position: "absolute", right: 52, bottom: 40, display: "flex", alignItems: "center",
                    gap: 10, opacity: 0.85 }}>
        <Img src={staticFile("logo.png")} style={{ width: 34, height: 34,
             rotate: `${Math.sin(frame / 80) * 5}deg` }} />
        <span style={{ fontFamily: '"Unbounded", sans-serif', fontSize: 20, fontWeight: 700,
                       color: Т.текст, letterSpacing: "0.06em" }}>V.LIONOFF</span>
      </div>
      <div style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: 4,
                    background: "rgba(255,255,255,0.06)" }}>
        <div style={{ width: `${доля * 100}%`, height: "100%",
                      background: `linear-gradient(90deg, ${Т.акцент}, ${Т.акцент2})` }} />
      </div>
    </>
  );
};

export const Urok5: React.FC = () => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const шоты = (лист as any).шоты;
  return (
    <AbsoluteFill style={{ backgroundColor: Т.фон }}>
      {шоты.map((ш: any, i: number) => (
        <Sequence key={ш.id} from={ш.от} durationInFrames={ш.кадров} name={`${ш.id} ${ш.тип}`} premountFor={30}>
          <Шот ш={ш} />
          {/* щелчок на резе: монтаж должен быть слышен, а не только виден */}
          <Sequence durationInFrames={10}>
            <Audio src={staticFile(i % 4 === 0 ? "zvuk/swoosh.mp3" : "zvuk/tick.mp3")}
                   volume={i % 4 === 0 ? 0.3 : 0.22} />
          </Sequence>
        </Sequence>
      ))}
      <Audio src={staticFile((лист as any).звук)} />
      <Угол блок={(лист as any).блок || "Занятие 1"} доля={frame / durationInFrames} />
    </AbsoluteFill>
  );
};
