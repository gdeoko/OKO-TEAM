import React from "react";
import { AbsoluteFill, Audio, Sequence, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import монтаж from "../public/montazh.json";
import { Полоса, Субтитры, Т, Угол, шторка } from "./ui";
import {
  Карта, Миф, Определение, Против, Список, Счёт, ТитулУрока, Финал, ФотоТезис, Цитата, Цифра, Шаги,
} from "./sceny";

const выбрать = (вид: string) => {
  switch (вид) {
    case "титул_урока": return ТитулУрока;
    case "определение": return Определение;
    case "против": return Против;
    case "цитата": return Цитата;
    case "цифра": return Цифра;
    case "счёт": return Счёт;
    case "шаги": return Шаги;
    case "миф": return Миф;
    case "карта": return Карта;
    case "финал": return Финал;
    case "боль":
    case "итог":
    case "практика": return Список;
    default: return ФотоТезис;
  }
};

const Сцена: React.FC<{ с: any }> = ({ с }) => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const Компонент: any = выбрать(с.вид);
  return (
    <AbsoluteFill style={{ opacity: шторка(frame, durationInFrames) }}>
      <Компонент с={с} слова={с.слова || []} вид={с.вид} />
      <Субтитры слова={с.слова || []} />
      {с.звук ? <Audio src={staticFile(с.звук)} /> : null}
      {/* Короткий ход на входе сцены: он и склеивает монтаж, и держит темп. */}
      <Sequence durationInFrames={28}>
        <Audio src={staticFile("zvuk/whoosh.mp3")} volume={0.22} />
      </Sequence>
    </AbsoluteFill>
  );
};

export const Urok: React.FC = () => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  let курсор = 0;
  const куски = (монтаж as any).сцены.map((с: any) => {
    const от = курсор;
    курсор += с.кадров;
    return { с, от };
  });
  return (
    <AbsoluteFill style={{ backgroundColor: Т.фон }}>
      {куски.map(({ с, от }: any) => (
        <Sequence key={с.id} from={от} durationInFrames={с.кадров} name={с.id}>
          <Сцена с={с} />
        </Sequence>
      ))}
      {(монтаж as any).музыка ? (
        <Audio src={staticFile((монтаж as any).музыка)} volume={0.55} loop />
      ) : null}
      <Угол показывать={frame > 125} />
      <Полоса доля={frame / durationInFrames} />
    </AbsoluteFill>
  );
};
