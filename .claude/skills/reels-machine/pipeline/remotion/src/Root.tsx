import React from "react";
import { Composition } from "remotion";
import { OkoReel } from "./OkoReel";
import { Test3D } from "./Test3D";
import { HeroScene } from "./HeroScene";
import { IntroScene, BubbleScene, StatScene } from "./scenes";
import { FluxReel } from "./FluxReel";
import { StoryReel, STORY_TOTAL } from "./StoryReel";
import { RealReel, REAL_TOTAL } from "./RealReel";
export const RemotionRoot: React.FC = () => (
  <>
    <Composition id="StoryReel" component={StoryReel} durationInFrames={STORY_TOTAL} fps={30} width={1080} height={1920} />
    <Composition id="RealReel" component={RealReel} durationInFrames={REAL_TOTAL} fps={30} width={1080} height={1920} />
    <Composition id="OkoReel" component={OkoReel} durationInFrames={570} fps={30} width={1080} height={1920} />
    <Composition id="HeroScene" component={HeroScene} durationInFrames={90} fps={30} width={1080} height={1920} />
    <Composition id="IntroScene" component={IntroScene} durationInFrames={60} fps={30} width={1080} height={1920} />
    <Composition id="BubbleScene" component={BubbleScene} durationInFrames={60} fps={30} width={1080} height={1920} />
    <Composition id="StatScene" component={StatScene} durationInFrames={60} fps={30} width={1080} height={1920} />
    <Composition id="FluxReel" component={FluxReel} durationInFrames={264} fps={30} width={1080} height={1920} />
    <Composition id="Test3D" component={Test3D} durationInFrames={60} fps={30} width={1080} height={1920} />
  </>
);
