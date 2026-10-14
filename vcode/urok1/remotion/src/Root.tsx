import React from "react";
import { Composition, staticFile } from "remotion";
import { Urok } from "./Urok";
import { Urok2 } from "./Urok2";
import { ПЕРЕХОД, Urok3 } from "./Urok3";
import { Urok4 } from "./Urok4";
import { Urok5 } from "./Urok5";
import { Urok6 } from "./Urok6";
import лист from "../public/shoty.json";
import лист5 from "../public/shoty2.json";
import лист6 from "../public/shoty3.json";
import монтаж from "../public/montazh.json";
import монтаж2 from "../public/montazh2.json";

const КАДРЫ = 25;

export const RemotionRoot: React.FC = () => {
  const всего = монтаж.сцены.reduce((с: number, х: any) => с + х.кадров, 0);
  const всего2 = (монтаж2 as any).сцены.reduce((с: number, х: any) => с + х.кадров, 0);
  return (
    <>
    <Composition
      id="Urok6"
      component={Urok6}
      durationInFrames={(лист6 as any).всего}
      fps={КАДРЫ}
      width={1920}
      height={1080}
      defaultProps={{}}
    />
    <Composition
      id="Urok5"
      component={Urok5}
      durationInFrames={(лист5 as any).всего}
      fps={КАДРЫ}
      width={1920}
      height={1080}
      defaultProps={{}}
    />
    <Composition
      id="Urok4"
      component={Urok4}
      durationInFrames={(лист as any).всего}
      fps={КАДРЫ}
      width={1920}
      height={1080}
      defaultProps={{}}
    />
    <Composition
      id="Urok3"
      component={Urok3}
      durationInFrames={всего2 + ПЕРЕХОД}
      fps={КАДРЫ}
      width={1920}
      height={1080}
      defaultProps={{}}
    />
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
