import { registerRoot } from 'remotion';
import React from 'react';
import { Composition, AbsoluteFill, useCurrentFrame, spring, useVideoConfig, interpolate } from 'remotion';
// @ts-ignore
import { soyuzB64, montB64 } from './fonts_b64';

const h = React.createElement;
const FontStyle = () => h('style', null, `
@font-face{font-family:'SG';src:url(data:font/ttf;base64,${soyuzB64})}
@font-face{font-family:'MO9';src:url(data:font/ttf;base64,${montB64})}
`);

const WORDS = [
  { tx: 'БУКЕТ', at: 4, color: '#ffffff', fs: 128 },
  { tx: 'РЕКЛАМА', at: 26, color: '#e8842a', fs: 128 },
  { tx: 'КЛИЕНТЫ', at: 48, color: '#9CF806', fs: 128 },
];

const Slam: React.FC<{ w: typeof WORDS[0]; frame: number; fps: number; out: number }> = ({ w, frame, fps, out }) => {
  const f = frame - w.at;
  const sp = spring({ frame: f, fps, config: { damping: 10, stiffness: 190, mass: 0.8 } });
  if (f < 0) return null;
  const sc = 2.6 - 1.6 * sp;
  const bl = Math.max(0, (1 - sp) * 16);
  const ringP = Math.min(1, f / 16);
  return h('div', { style: { position: 'relative', height: 168, display: 'flex', justifyContent: 'center', alignItems: 'center' } },
    ringP < 1 && f > 2 ? h('div', {
      style: {
        position: 'absolute', width: 340 + ringP * 620, height: 120 + ringP * 240,
        border: `3px solid ${w.color}`, borderRadius: '50%', opacity: (1 - ringP) * 0.7,
      }
    }) : null,
    h('div', {
      style: {
        fontFamily: 'SG', fontSize: w.fs, color: w.color, letterSpacing: 4,
        transform: `scale(${sc}) rotate(${(1 - sp) * -4}deg)`,
        filter: `blur(${bl}px)`, opacity: Math.min(1, sp * 1.6) * out,
        textShadow: `0 10px 44px rgba(0,0,0,.7), 0 0 40px ${w.color}44`,
      }
    }, w.tx));
};

const Kinetic: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();
  const out = interpolate(frame, [durationInFrames - 10, durationInFrames - 1], [1, 0], { extrapolateLeft: 'clamp' });
  const allIn = frame > 66;
  const pulse = allIn ? 1 + 0.02 * Math.sin((frame - 66) * 0.5) : 1;
  const arrowOp = (at: number) => interpolate(frame, [at + 14, at + 22], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  return h(AbsoluteFill, { style: { backgroundColor: 'transparent', alignItems: 'center' } },
    h(FontStyle),
    h('div', { style: { marginTop: 430, display: 'flex', flexDirection: 'column', alignItems: 'center', opacity: out, transform: `scale(${pulse})` } },
      h(Slam, { w: WORDS[0], frame, fps, out }),
      h('div', { style: { fontFamily: 'MO9', fontSize: 54, color: '#fff', opacity: arrowOp(26) * out, margin: '2px 0' } }, '↓'),
      h(Slam, { w: WORDS[1], frame, fps, out }),
      h('div', { style: { fontFamily: 'MO9', fontSize: 54, color: '#fff', opacity: arrowOp(48) * out, margin: '2px 0' } }, '↓'),
      h(Slam, { w: WORDS[2], frame, fps, out })));
};

const Root: React.FC = () => h(Composition, {
  id: 'kinetic', component: Kinetic, durationInFrames: 100, fps: 30, width: 1080, height: 1920 });
registerRoot(Root);
