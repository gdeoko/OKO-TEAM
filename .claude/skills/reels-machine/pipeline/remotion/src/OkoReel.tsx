import React from "react";
import {
  AbsoluteFill, OffthreadVideo, Img, useCurrentFrame, useVideoConfig,
  interpolate, spring, staticFile, Sequence, delayRender, continueRender,
} from "remotion";

// ---- офлайн-загрузка бренд-шрифтов (без сети) ----
const MONT = "MontserratLocal";
const BEBAS = "BebasLocal";
if (typeof window !== "undefined" && typeof (window as any).FontFace !== "undefined") {
  const h = delayRender("fonts", { timeoutInMilliseconds: 60000 });
  const timeout = new Promise((res) => setTimeout(res, 8000));
  const loadAll = (async () => {
    try {
      const m = new FontFace(MONT, `url(${staticFile("fonts/Montserrat.ttf")})`);
      const b = new FontFace(BEBAS, `url(${staticFile("fonts/Bebas.ttf")})`);
      const [mf, bf] = await Promise.all([m.load(), b.load()]);
      (document as any).fonts.add(mf); (document as any).fonts.add(bf);
    } catch (e) { /* fallback шрифт */ }
  })();
  Promise.race([loadAll, timeout]).finally(() => continueRender(h));
}
const LIME = "#9AFF00";

// ---- караоке-слова (кадр появления) ----
const WORDS: { t: string; s: number; lime?: boolean }[] = [
  { t: "Мы", s: 24 },
  { t: "собираем", s: 44 },
  { t: "контент", s: 76, lime: true },
  { t: "дизайн", s: 106, lime: true },
  { t: "и продвижение", s: 160, lime: true },
  { t: "под ключ", s: 214 },
];

const Zoom: React.FC<{ src: string; from: number; dur: number }> = ({ src, from, dur }) => {
  const f = useCurrentFrame();
  const scale = interpolate(f, [from, from + dur], [1.08, 1.22], { extrapolateRight: "clamp" });
  return (
    <AbsoluteFill style={{ overflow: "hidden" }}>
      <OffthreadVideo src={staticFile(src)} muted style={{ width: "100%", height: "100%", objectFit: "cover", transform: `scale(${scale})` }} />
    </AbsoluteFill>
  );
};

export const OkoReel: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // активное слово
  let idx = -1;
  for (let i = 0; i < WORDS.length; i++) if (frame >= WORDS[i].s) idx = i;
  const cur = idx >= 0 ? WORDS[idx] : null;
  const wStart = cur ? cur.s : 0;
  const pop = cur ? spring({ frame: frame - wStart, fps, config: { damping: 12, stiffness: 180 } }) : 0;

  // вспышка-переход на 150
  const flash = interpolate(frame, [143, 150, 162], [0, 0.85, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  // заголовок
  const hIn = spring({ frame: frame - 8, fps, config: { damping: 14 } });
  const hOut = interpolate(frame, [64, 78], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  // финальная карточка
  const end = spring({ frame: frame - 246, fps, config: { damping: 13 } });
  // прогресс-бар
  const prog = interpolate(frame, [0, 285], [0, 1]);

  return (
    <AbsoluteFill style={{ backgroundColor: "#0d0d0d", fontFamily: MONT }}>
      {/* фон-сток с зумом + переход */}
      <Sequence from={0} durationInFrames={152}><Zoom src="stock1.mp4" from={0} dur={152} /></Sequence>
      <Sequence from={152}><Zoom src="stock2.mp4" from={152} dur={140} /></Sequence>

      {/* затемнение + лайм-виньетка */}
      <AbsoluteFill style={{ background: "linear-gradient(180deg, rgba(13,13,13,0.55) 0%, rgba(13,13,13,0.05) 35%, rgba(13,13,13,0.15) 60%, rgba(13,13,13,0.85) 100%)" }} />
      <AbsoluteFill style={{ boxShadow: `inset 0 0 320px rgba(154,255,0,0.10)` }} />

      {/* вспышка перехода */}
      <AbsoluteFill style={{ background: `radial-gradient(circle at 50% 45%, rgba(255,255,255,${flash}) 0%, rgba(255,255,255,0) 60%)`, opacity: 1 }} />

      {/* лого-водяной знак */}
      <Img src={staticFile("logo.png")} style={{ position: "absolute", top: 60, left: 54, width: 92, filter: "drop-shadow(0 0 14px rgba(154,255,0,0.5))" }} />
      <div style={{ position: "absolute", top: 78, left: 168, color: "#fff", fontWeight: 800, fontSize: 34, letterSpacing: 2 }}>OKO<span style={{ color: LIME }}>.</span></div>

      {/* заголовок */}
      {frame < 80 && (
        <div style={{ position: "absolute", top: 470, width: "100%", textAlign: "center", opacity: hOut, transform: `translateY(${(1 - hIn) * 60}px)` }}>
          <div style={{ fontFamily: BEBAS, color: "#fff", fontSize: 128, lineHeight: 0.95, letterSpacing: 2, textShadow: "0 6px 30px rgba(0,0,0,0.6)" }}>КОНТЕНТ</div>
          <div style={{ fontFamily: BEBAS, color: LIME, fontSize: 128, lineHeight: 0.95, letterSpacing: 2, textShadow: `0 0 40px rgba(154,255,0,0.5)` }}>ПОД КЛЮЧ</div>
        </div>
      )}

      {/* караоке-слово */}
      {cur && frame < 250 && (
        <div style={{ position: "absolute", bottom: 360, width: "100%", textAlign: "center" }}>
          <span style={{
            display: "inline-block", transform: `scale(${0.7 + pop * 0.3})`,
            fontWeight: 800, fontSize: 92, color: cur.lime ? LIME : "#fff",
            padding: "10px 30px", letterSpacing: 1,
            textShadow: cur.lime ? `0 0 34px rgba(154,255,0,0.6)` : "0 6px 26px rgba(0,0,0,0.7)",
          }}>{cur.t}</span>
        </div>
      )}

      {/* финальная карточка */}
      {frame >= 246 && (
        <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", background: "rgba(13,13,13,0.35)" }}>
          <Img src={staticFile("logo.png")} style={{ width: 200 + end * 40, filter: `drop-shadow(0 0 40px rgba(154,255,0,${0.4 + end * 0.4}))`, transform: `scale(${0.6 + end * 0.4})` }} />
          <div style={{ fontFamily: BEBAS, color: "#fff", fontSize: 150, marginTop: 20, letterSpacing: 4, transform: `translateY(${(1 - end) * 40}px)`, opacity: end }}>OKO</div>
          <div style={{ color: LIME, fontWeight: 700, fontSize: 44, letterSpacing: 6, opacity: end }}>СКОРО ПРИЛОЖЕНИЕ</div>
        </AbsoluteFill>
      )}

      {/* прогресс-бар */}
      <div style={{ position: "absolute", bottom: 0, left: 0, height: 8, width: `${prog * 100}%`, background: LIME, boxShadow: `0 0 16px ${LIME}` }} />
    </AbsoluteFill>
  );
};
