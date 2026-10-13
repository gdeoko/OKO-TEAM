import React from "react";
import { Composition, staticFile } from "remotion";
import { Urok } from "./Urok";
import { Urok2 } from "./Urok2";
import монтаж from "../public/montazh.json";
import монтаж2 from "../public/montazh2.json";

const КАДРЫ = 25;

export const RemotionRoot: React.FC = () => {
  const всего = монтаж.сцены.reduce((с: number, х: any) => с + х.кадров, 0);
  const всего2 = (монтаж2 as any).сцены.reduce((с: number, х: any) => с + х.кадров, 0);
  return (
    <>
    <Composition
      id="Urok2"
      component={Urok2}
      durationInFrames={всего2}
      fps={КАДРЫ}
      width={1920}
      height={1080}
      defaultProps={{}}
    />
    <Composition
      id="Urok"
      component={Urok}
      durationInFrames={всего}
      fps={КАДРЫ}
      width={1920}
      height={1080}
      defaultProps={{}}
    />
    </>
  );
};
