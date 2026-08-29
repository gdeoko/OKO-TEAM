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

// ---------- ODOMETER COUNTER ----------
const DIGIT_H = 150;
const DigitStrip: React.FC<{ val: number }> = ({ val }) => {
  const shift = -(val % 10) * DIGIT_H;
  return h('div', { style: { height: DIGIT_H, width: 96, overflow: 'hidden', position: 'relative' } },
    h('div', { style: { transform: `translateY(${shift}px)` } },
      ...Array.from({ length: 11 }, (_, d) =>
        h('div', {
          key: d, style: {
            height: DIGIT_H, display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontFamily: 'MO9', fontSize: 118, color: '#fff',
            textShadow: '0 6px 30px rgba(0,0,0,.55), 0 0 26px rgba(154,248,6,.16)'
          }
        }, String(d % 10)))));
};

const Counter: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();
  const inS = spring({ frame, fps, config: { damping: 11, stiffness: 130 } });
  const prog = interpolate(frame, [4, 52], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const eased = 1 - Math.pow(1 - prog, 3.2);
  const value = 120000 * eased;
  const out = interpolate(frame, [durationInFrames - 9, durationInFrames - 1], [1, 0], { extrapolateLeft: 'clamp' });
  const done = prog >= 1;
  const pulse = done ? 1 + 0.035 * Math.sin((frame - 52) * 0.55) * Math.exp(-(frame - 52) * 0.06) : 1;
  const lblS = spring({ frame: frame - 10, fps, config: { damping: 12, stiffness: 110 } });
  // digits: 120000 -> columns for "120 000" with thin space
  const digitsVal = [
    Math.floor(value / 100000), Math.floor(value / 10000), Math.floor(value / 1000),
    -1, // gap
    Math.floor(value / 100), Math.floor(value / 10), Math.floor(value / 1),
  ];
  const fracRoll = (p: number) => value / p; // continuous value for strip
  const cols = [100000, 10000, 1000, -1, 100, 10, 1];
  return h(AbsoluteFill, { style: { justifyContent: 'center', alignItems: 'center', backgroundColor: 'transparent' } },
    h(FontStyle),
    h('div', {
      style: {
        opacity: inS * out, transform: `scale(${(0.82 + 0.18 * inS) * pulse}) translateY(-360px)`,
        display: 'flex', flexDirection: 'column', alignItems: 'center',
      }
    },
      h('div', {
        style: {
          display: 'flex', alignItems: 'center', padding: '30px 46px 22px',
          background: 'rgba(11,11,11,.62)', borderRadius: 34,
          border: '1.5px solid rgba(255,255,255,.15)',
          boxShadow: '0 24px 80px rgba(0,0,0,.55), inset 0 0 60px rgba(154,248,6,.05)'
        }
      },
        h('div', { style: { width: 0, height: 0, marginRight: 30, borderTop: '20px solid transparent', borderBottom: '20px solid transparent', borderLeft: '34px solid #9CF806', filter: 'drop-shadow(0 0 14px rgba(154,248,6,.7))' } }),
        ...cols.map((p, i) => p === -1
          ? h('div', { key: i, style: { width: 30 } })
          : h(DigitStrip, { key: i, val: fracRoll(p) }))),
      h('div', {
        style: {
          marginTop: 22, fontFamily: 'SG', fontSize: 52, color: '#fff', letterSpacing: 2,
          opacity: Math.max(0, lblS) * out, transform: `translateY(${(1 - lblS) * 40}px)`,
          textShadow: '0 4px 24px rgba(0,0,0,.6)'
        }
      }, 'просмотров за 3 дня'),
      h('div', {
        style: {
          marginTop: 14, height: 6, width: 320 * Math.max(0, lblS), borderRadius: 3,
          background: 'linear-gradient(90deg,#e8842a,#9CF806)', opacity: out,
          boxShadow: '0 0 18px rgba(154,248,6,.5)'
        }
      })));
};

// ---------- RING GAUGE x3 ----------
const Gauge: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();
  const inS = spring({ frame, fps, config: { damping: 12, stiffness: 120 } });
  const ringP = interpolate(frame, [6, 52], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const ringE = 1 - Math.pow(1 - ringP, 2.6);
  const R = 205, CIRC = 2 * Math.PI * R;
  const sweep = 0.82 * ringE; // up to 295 deg
  const xS = spring({ frame: frame - 26, fps, config: { damping: 9, stiffness: 150 } });
  const out = interpolate(frame, [durationInFrames - 9, durationInFrames - 1], [1, 0], { extrapolateLeft: 'clamp' });
  const burst = frame > 50 ? Math.min(1, (frame - 50) / 22) : 0;
  const parts = Array.from({ length: 14 }, (_, i) => {
    const a = (i / 14) * Math.PI * 2 + (i % 3) * 0.4;
    const dist = 250 + (i % 5) * 42;
    return { x: Math.cos(a) * dist * burst, y: Math.sin(a) * dist * burst - 40 * burst, c: i % 2 ? '#9CF806' : '#e8842a', s: 10 + (i % 4) * 5 };
  });
  const lblS = spring({ frame: frame - 34, fps, config: { damping: 12, stiffness: 110 } });
  return h(AbsoluteFill, { style: { justifyContent: 'center', alignItems: 'center', backgroundColor: 'transparent' } },
    h(FontStyle),
    h('div', { style: { opacity: inS * out, transform: `scale(${0.84 + 0.16 * inS}) translateY(-330px)`, position: 'relative', width: 620, height: 620, display: 'flex', justifyContent: 'center', alignItems: 'center' } },
      h('svg', { width: 620, height: 620, viewBox: '0 0 620 620', style: { position: 'absolute', inset: 0, transform: 'rotate(-90deg)' } },
        h('defs', null, h('linearGradient', { id: 'gg', x1: '0', y1: '0', x2: '1', y2: '1' },
          h('stop', { offset: '0%', stopColor: '#e8842a' }),
          h('stop', { offset: '100%', stopColor: '#9CF806' }))),
        h('circle', { cx: 310, cy: 310, r: R, fill: 'none', stroke: 'rgba(255,255,255,.10)', strokeWidth: 22 }),
        h('circle', {
          cx: 310, cy: 310, r: R, fill: 'none', stroke: 'url(#gg)', strokeWidth: 22, strokeLinecap: 'round',
          strokeDasharray: `${CIRC * sweep} ${CIRC}`,
          style: { filter: 'drop-shadow(0 0 9px rgba(154,248,6,.30))' }
        })),
      burst > 0 && burst < 1 ? parts.map((p, i) => h('div', {
        key: i, style: {
          position: 'absolute', left: 310 + p.x, top: 310 + p.y, width: p.s, height: p.s,
          borderRadius: '50%', background: p.c, opacity: (1 - burst) * out,
        }
      })) : null,
      h('div', {
        style: {
          fontFamily: 'MO9', fontSize: 230, color: '#fff', opacity: Math.max(0, Math.min(1, xS)) * out,
          transform: `scale(${0.5 + 0.5 * xS})`,
          textShadow: '0 10px 44px rgba(0,0,0,.6), 0 0 34px rgba(154,248,6,.25)'
        }
      }, 'х3')),
    h('div', {
      style: {
        position: 'absolute', top: 1275, left: 0, right: 0, textAlign: 'center',
        fontFamily: 'SG', fontSize: 56, color: '#fff', letterSpacing: 2,
        opacity: Math.max(0, lblS) * out, transform: `translateY(${(1 - lblS) * 44}px)`,
        textShadow: '0 4px 24px rgba(0,0,0,.65)'
      }
    }, 'выручка выросла втрое'));
};

const Root: React.FC = () => h(React.Fragment, null,
  h(Composition, { id: 'counter', component: Counter, durationInFrames: 84, fps: 30, width: 1080, height: 1920 }),
  h(Composition, { id: 'gauge', component: Gauge, durationInFrames: 96, fps: 30, width: 1080, height: 1920 }));
registerRoot(Root);
