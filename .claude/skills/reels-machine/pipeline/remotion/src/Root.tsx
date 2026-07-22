import React from "react";
import { Composition } from "remotion";
import { OkoReel } from "./OkoReel";
export const RemotionRoot: React.FC = () => (
  <Composition
    id="OkoReel"
    component={OkoReel}
    durationInFrames={285}
    fps={30}
    width={1080}
    height={1920}
  />
);
