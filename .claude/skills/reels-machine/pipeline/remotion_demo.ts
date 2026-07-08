import { registerRoot } from 'remotion';
import React from 'react';
import { Composition, AbsoluteFill, useCurrentFrame, spring, useVideoConfig, interpolate } from 'remotion';

const Demo: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const s = spring({ frame, fps, config: { damping: 9, stiffness: 120 } });
  const x = interpolate(s, [0, 1], [-400, 0]);
  return React.createElement(AbsoluteFill, { style: { backgroundColor: 'transparent', justifyContent: 'center', alignItems: 'center' } },
    React.createElement('div', { style: {
      transform: `translateX(${x}px) scale(${0.6 + 0.4 * s})`,
      fontSize: 120, fontWeight: 900, color: '#e8842a', fontFamily: 'sans-serif',
      textShadow: '0 10px 40px rgba(0,0,0,.6)' } }, 'V.CODE'));
};

const Root: React.FC = () => React.createElement(Composition, {
  id: 'demo', component: Demo, durationInFrames: 20, fps: 30, width: 1080, height: 1920 });
registerRoot(Root);
