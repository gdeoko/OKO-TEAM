import React from 'react';
import {registerRoot, Composition, AbsoluteFill, useCurrentFrame, useVideoConfig, interpolate, spring, Easing} from 'remotion';
// @ts-ignore
import {soyuzB64, montB64} from './fonts_b64';

const h = React.createElement;
const Fonts: React.FC = () => (
  <style>{`
@font-face{font-family:'SG';src:url(data:font/ttf;base64,${soyuzB64})}
@font-face{font-family:'MO9';src:url(data:font/ttf;base64,${montB64})}
`}</style>
);
const LIME = '#9CF806', ORNG = '#e8842a';

const Panel: React.FC<{children: React.ReactNode; op: number; sc: number; w?: number; mt?: number}> = ({children, op, sc, w = 880, mt = 380}) => (
  <AbsoluteFill style={{backgroundColor: 'transparent', alignItems: 'center'}}>
    <div style={{
      marginTop: mt, width: w, padding: '40px 44px 34px',
      background: 'rgba(11,11,11,.68)', borderRadius: 36,
      border: '1.5px solid rgba(255,255,255,.15)',
      boxShadow: '0 26px 90px rgba(0,0,0,.55)',
      opacity: op, scale: String(sc),
    }}>{children}</div>
  </AbsoluteFill>
);

// ---------- LINE CHART: views growth ----------
const LineChart: React.FC = () => {
  const frame = useCurrentFrame();
  const {fps, durationInFrames} = useVideoConfig();
  const inS = spring({frame, fps, config: {damping: 12, stiffness: 120}});
  const out = interpolate(frame, [durationInFrames - 9, durationInFrames - 1], [1, 0], {extrapolateLeft: 'clamp'});
  const CW = 780, CH = 460;
  const pts = [8, 14, 11, 26, 22, 48, 92, 160, 300, 452];
  const maxV = 460;
  const drawP = interpolate(frame, [8, 66], [0, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: Easing.inOut(Easing.cubic)});
  const path = pts.map((v, i) => {
    const x = (i / (pts.length - 1)) * CW;
    const y = CH - (v / maxV) * CH;
    return `${i === 0 ? 'M' : 'L'}${x},${y}`;
  }).join(' ');
  const totalLen = 1300;
  const endIdx = Math.min(pts.length - 1, drawP * (pts.length - 1));
  const ex = (endIdx / (pts.length - 1)) * CW;
  const ey = CH - (pts[Math.round(endIdx)] / maxV) * CH;
  const val = Math.round(interpolate(drawP, [0, 1], [8, 452]));
  return (
    <Panel op={inS * out} sc={0.88 + 0.12 * inS}>
      <Fonts />
      <div style={{fontFamily: 'SG', fontSize: 44, color: '#fff', letterSpacing: 2, marginBottom: 26}}>просмотры за 10 дней</div>
      <svg width={CW} height={CH + 20} style={{overflow: 'visible'}}>
        <defs>
          <linearGradient id="lg" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={LIME} stopOpacity="0.35" />
            <stop offset="100%" stopColor={LIME} stopOpacity="0" />
          </linearGradient>
        </defs>
        {[0.25, 0.5, 0.75].map((g) => (
          <line key={g} x1={0} x2={CW} y1={CH * g} y2={CH * g} stroke="rgba(255,255,255,.09)" strokeWidth={2} />
        ))}
        <path d={`${path} L${CW},${CH} L0,${CH} Z`} fill="url(#lg)" opacity={drawP} />
        <path d={path} fill="none" stroke={LIME} strokeWidth={7} strokeLinecap="round"
          strokeDasharray={totalLen} strokeDashoffset={totalLen * (1 - drawP)}
          style={{filter: `drop-shadow(0 0 10px ${LIME}66)`}} />
        <circle cx={ex} cy={ey} r={13} fill="#fff" stroke={LIME} strokeWidth={5} />
      </svg>
      <div style={{display: 'flex', alignItems: 'baseline', gap: 18, marginTop: 18}}>
        <div style={{fontFamily: 'MO9', fontSize: 76, color: '#fff'}}>{val}К</div>
        <div style={{fontFamily: 'MO9', fontSize: 34, color: LIME}}>▲ рост каждый день</div>
      </div>
    </Panel>
  );
};

// ---------- DONUT: заявки из коротких видео ----------
const Donut: React.FC = () => {
  const frame = useCurrentFrame();
  const {fps, durationInFrames} = useVideoConfig();
  const inS = spring({frame, fps, config: {damping: 12, stiffness: 120}});
  const out = interpolate(frame, [durationInFrames - 9, durationInFrames - 1], [1, 0], {extrapolateLeft: 'clamp'});
  const p = interpolate(frame, [8, 56], [0, 0.68], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: Easing.out(Easing.cubic)});
  const R = 190, C = 2 * Math.PI * R;
  return (
    <Panel op={inS * out} sc={0.88 + 0.12 * inS} w={760}>
      <Fonts />
      <div style={{display: 'flex', alignItems: 'center', gap: 44}}>
        <div style={{position: 'relative', width: 440, height: 440}}>
          <svg width={440} height={440} style={{transform: 'rotate(-90deg)'}}>
            <circle cx={220} cy={220} r={R} fill="none" stroke="rgba(255,255,255,.1)" strokeWidth={44} />
            <circle cx={220} cy={220} r={R} fill="none" stroke={LIME} strokeWidth={44} strokeLinecap="round"
              strokeDasharray={`${C * p} ${C}`} style={{filter: `drop-shadow(0 0 12px ${LIME}55)`}} />
          </svg>
          <div style={{position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center'}}>
            <div style={{fontFamily: 'MO9', fontSize: 92, color: '#fff'}}>{Math.round(p * 100)}%</div>
          </div>
        </div>
        <div style={{flex: 1, fontFamily: 'SG', fontSize: 44, color: '#fff', lineHeight: 1.35}}>
          заявок приходит из коротких видео
        </div>
      </div>
    </Panel>
  );
};

// ---------- COUNTER ROW: 3 stats ----------
const Stats: React.FC = () => {
  const frame = useCurrentFrame();
  const {fps, durationInFrames} = useVideoConfig();
  const out = interpolate(frame, [durationInFrames - 9, durationInFrames - 1], [1, 0], {extrapolateLeft: 'clamp'});
  const items = [
    {v: 3, suf: ' дня', label: 'до готового ролика', c: '#fff'},
    {v: 40, suf: '+', label: 'ниш и форматов', c: ORNG},
    {v: 1, suf: ' команда', label: 'съёмка и монтаж', c: LIME},
  ];
  return (
    <AbsoluteFill style={{backgroundColor: 'transparent', alignItems: 'center'}}>
      <Fonts />
      <div style={{marginTop: 430, display: 'flex', flexDirection: 'column', gap: 30}}>
        {items.map((it, i) => {
          const s = spring({frame: frame - 4 - i * 9, fps, config: {damping: 11, stiffness: 140}});
          const cnt = Math.round(it.v * Math.min(1, Math.max(0, (frame - 4 - i * 9) / 20)));
          return (
            <div key={i} style={{
              display: 'flex', alignItems: 'center', gap: 30, width: 820,
              background: 'rgba(11,11,11,.68)', borderRadius: 28, padding: '26px 40px',
              border: '1.5px solid rgba(255,255,255,.14)',
              opacity: Math.min(1, s * 1.4) * out,
              translate: `${(1 - s) * 420}px 0px`,
            }}>
              <div style={{fontFamily: 'MO9', fontSize: 74, color: it.c, minWidth: 300}}>{cnt}{it.suf}</div>
              <div style={{fontFamily: 'SG', fontSize: 42, color: '#ddd'}}>{it.label}</div>
            </div>
          );
        })}
      </div>
    </AbsoluteFill>
  );
};

// ---------- BEFORE/AFTER slider ----------
const BeforeAfter: React.FC = () => {
  const frame = useCurrentFrame();
  const {fps, durationInFrames} = useVideoConfig();
  const inS = spring({frame, fps, config: {damping: 12, stiffness: 120}});
  const out = interpolate(frame, [durationInFrames - 9, durationInFrames - 1], [1, 0], {extrapolateLeft: 'clamp'});
  const slide = interpolate(frame, [12, 58], [0.12, 0.88], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: Easing.inOut(Easing.cubic)});
  const W = 860, H = 560;
  return (
    <Panel op={inS * out} sc={0.88 + 0.12 * inS} w={W + 88} mt={420}>
      <Fonts />
      <div style={{fontFamily: 'SG', fontSize: 44, color: '#fff', letterSpacing: 2, marginBottom: 24}}>охваты клиента</div>
      <div style={{position: 'relative', width: W, height: H, borderRadius: 24, overflow: 'hidden', background: '#1a1a1c'}}>
        <div style={{position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', justifyContent: 'center', paddingLeft: 60}}>
          <div style={{fontFamily: 'MO9', fontSize: 40, color: '#888'}}>ДО</div>
          <div style={{fontFamily: 'MO9', fontSize: 86, color: '#aaa'}}>900</div>
          <div style={{fontFamily: 'SG', fontSize: 34, color: '#777'}}>просмотров в месяц</div>
        </div>
        <div style={{position: 'absolute', inset: 0, clipPath: `inset(0 0 0 ${slide * 100}%)`,
          background: `linear-gradient(135deg, #1d2607, #0d0d0d)`, display: 'flex', flexDirection: 'column', justifyContent: 'center', paddingLeft: `${slide * W + 60}px`}}>
          <div style={{fontFamily: 'MO9', fontSize: 40, color: LIME}}>ПОСЛЕ</div>
          <div style={{fontFamily: 'MO9', fontSize: 86, color: '#fff', textShadow: `0 0 26px ${LIME}44`}}>450 000</div>
          <div style={{fontFamily: 'SG', fontSize: 34, color: '#cfe9a8'}}>просмотров в месяц</div>
        </div>
        <div style={{position: 'absolute', top: 0, bottom: 0, left: `${slide * 100}%`, width: 6, background: LIME, boxShadow: `0 0 18px ${LIME}`}} />
        <div style={{position: 'absolute', top: '50%', left: `${slide * 100}%`, translate: '-50% -50%',
          width: 64, height: 64, borderRadius: '50%', background: LIME, display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontFamily: 'MO9', fontSize: 30, color: '#0d0d0d'}}>⇄</div>
      </div>
    </Panel>
  );
};

const Root: React.FC = () => (
  <>
    <Composition id="linechart" component={LineChart} durationInFrames={100} fps={30} width={1080} height={1920} />
    <Composition id="donut" component={Donut} durationInFrames={92} fps={30} width={1080} height={1920} />
    <Composition id="stats" component={Stats} durationInFrames={96} fps={30} width={1080} height={1920} />
    <Composition id="beforeafter" component={BeforeAfter} durationInFrames={100} fps={30} width={1080} height={1920} />
  </>
);
registerRoot(Root);
