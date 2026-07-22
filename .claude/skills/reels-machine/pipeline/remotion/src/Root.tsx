import React from "react";
import { Composition } from "remotion";
import { OkoReel } from "./OkoReel";
import { Test3D } from "./Test3D";
export const RemotionRoot: React.FC = () => (
  <>
    <Composition id="OkoReel" component={OkoReel} durationInFrames={570} fps={30} width={1080} height={1920} />
    <Composition id="Test3D" component={Test3D} durationInFrames={60} fps={30} width={1080} height={1920} />
  </>
);
