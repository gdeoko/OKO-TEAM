import React from "react";
import { Composition, staticFile } from "remotion";
import { Urok } from "./Urok";
import монтаж from "../public/montazh.json";

const КАДРЫ = 25;

export const RemotionRoot: React.FC = () => {
  const всего = монтаж.сцены.reduce((с: number, х: any) => с + х.кадров, 0);
  return (
    <Composition
      id="Urok"
      component={Urok}
      durationInFrames={всего}
      fps={КАДРЫ}
      width={1920}
      height={1080}
      defaultProps={{}}
    />
  );
};
