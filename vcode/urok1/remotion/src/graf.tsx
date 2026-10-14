import React from "react";
import { interpolate, random, useCurrentFrame, useVideoConfig } from "remotion";
import { Т } from "./stage";

const цикл = (frame: number, период: number) => (frame % период) / период;
const туда_обратно = (ф: number) => (ф < 0.5 ? ф * 2 : 2 - ф * 2);

/** Три матрицы: полный кадр, кроп, Micro 4/3. Размеры живые, рамки дышат. */
export const Матрицы: React.FC<{ подсветка?: number }> = ({ подсветка = -1 }) => {
  const frame = useCurrentFrame();
  const данные = [
    { имя: "Полный кадр", ш: 36, в: 24, цвет: Т.акцент2 },
    { имя: "Кроп 1,5-1,6", ш: 23.5, в: 15.6, цвет: Т.акцент },
    { имя: "Micro 4/3", ш: 17.3, в: 13, цвет: Т.тёплый },
  ];
  const масштаб = 14;
  return (
    <div style={{ position: "relative", width: 36 * масштаб + 60, height: 24 * масштаб + 200 }}>
      {данные.map((м, i) => {
        const п = 16 + i * 22;
        const д = interpolate(frame, [п, п + 18], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
        const дых = 1 + Math.sin(frame / 34 + i) * 0.012;
        const активна = подсветка === i;
        return (
          <div key={i} style={{
            position: "absolute", left: 0, bottom: 130,
            width: м.ш * масштаб * д * дых, height: м.в * масштаб * д * дых,
            border: `3px solid ${м.цвет}`, borderRadius: 8,
            background: `linear-gradient(135deg, ${м.цвет}22, transparent 70%)`,
            boxShadow: активна ? `0 0 46px ${м.цвет}aa` : `0 0 22px ${м.цвет}44`,
            opacity: д,
          }}>

          </div>
        );
      })}
      <div style={{ position: "absolute", left: 0, bottom: 0, display: "flex",
                    gap: 28, flexWrap: "wrap" }}>
        {данные.map((м, i) => {
          const п = 20 + i * 22;
          const д = interpolate(frame, [п, п + 16], [0, 1],
                                { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
          return (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: 10,
                                  opacity: д, transform: `translateY(${(1 - д) * 18}px)` }}>
              <span style={{ width: 16, height: 16, borderRadius: 4, background: м.цвет,
                             boxShadow: `0 0 16px ${м.цвет}` }} />
              <span style={{ fontFamily: Т.корпус, fontSize: 24, color: Т.текст,
                             whiteSpace: "nowrap" }}>{м.имя}</span>
              <span style={{ fontFamily: Т.корпус, fontSize: 22, color: "rgba(244,245,247,0.6)",
                             whiteSpace: "nowrap" }}>{м.ш} × {м.в}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
};

/** Кроп-фактор: нарисованный пейзаж живёт, рамки кадра сжимаются внутрь. */
export const КропКадр: React.FC = () => {
  const frame = useCurrentFrame();
  const бег = frame * 0.6;
  const рамки = [
    { к: 1, цвет: "#FFFFFF", имя: "полный кадр" },
    { к: 1.3, цвет: Т.тревога, имя: "кроп 1,3" },
    { к: 1.5, цвет: Т.акцент, имя: "кроп 1,5" },
    { к: 1.6, цвет: Т.акцент2, имя: "кроп 1,6" },
  ];
  return (
    <div style={{ position: "relative", width: 900, height: 520, borderRadius: 18,
                  overflow: "hidden", border: `1px solid ${Т.линия}` }}>
      <div style={{ position: "absolute", inset: 0,
        background: "linear-gradient(#0d1a33 0%, #1b2f55 45%, #2b4a72 70%, #16243d 100%)" }} />
      {[0, 1, 2].map((слой) => (
        <div key={слой} style={{
          position: "absolute", left: -200 + (бег * (0.3 + слой * 0.25)) % 200 - 100,
          bottom: 60 + слой * 26, width: 1600, height: 240 - слой * 40,
          opacity: 0.55 + слой * 0.15,
          background: слой === 0
            ? "linear-gradient(180deg, transparent 0%, #4a6f9f 18%, #35557f 100%)"
            : слой === 1
            ? "linear-gradient(180deg, transparent 0%, #2f4e78 20%, #22395c 100%)"
            : "linear-gradient(180deg, transparent 0%, #1b2d4a 22%, #15233c 100%)",
          clipPath: слой === 0
            ? "polygon(0% 100%, 6% 46%, 15% 70%, 26% 28%, 38% 66%, 50% 36%, 62% 72%, 74% 40%, 86% 68%, 100% 44%, 100% 100%)"
            : слой === 1
            ? "polygon(0% 100%, 10% 58%, 22% 80%, 33% 44%, 46% 76%, 58% 50%, 70% 82%, 82% 54%, 94% 78%, 100% 60%, 100% 100%)"
            : "polygon(0% 100%, 14% 70%, 28% 88%, 42% 62%, 56% 86%, 68% 66%, 80% 90%, 92% 70%, 100% 84%, 100% 100%)",
          filter: `blur(${слой * 0.6}px)`,
        }} />
      ))}
      <div style={{ position: "absolute", left: "70%", top: "16%", width: 90, height: 90,
                    borderRadius: 90, background: "#FFE8B0",
                    boxShadow: "0 0 90px 30px rgba(255,220,150,0.35)",
                    transform: `translateY(${Math.sin(frame / 40) * 8}px)` }} />
      {рамки.map((р, i) => {
        const п = 12 + i * 16;
        const д = interpolate(frame, [п, п + 16], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
        const дых = 1 + Math.sin(frame / 30 + i) * 0.006;
        const ш = (100 / р.к) * д * дых;
        return (
          <div key={i} style={{
            position: "absolute", left: "50%", top: "50%",
            width: `${ш}%`, height: `${ш}%`, transform: "translate(-50%, -50%)",
            border: `3px solid ${р.цвет}`, opacity: д, borderRadius: 4,
          }}>
            <span style={{ position: "absolute", right: 8, top: -32, fontFamily: Т.корпус,
                           fontSize: 20, color: р.цвет }}>{р.имя}</span>
          </div>
        );
      })}
    </div>
  );
};

/** Угол обзора: конус света от камеры живёт и меняется с фокусным. */
export const УголОбзора: React.FC<{ от?: number; до?: number }> = ({ от = 10, до = 200 }) => {
  const frame = useCurrentFrame();
  const ф = туда_обратно(цикл(frame, 150));
  const фокус = Math.round(interpolate(ф, [0, 1], [от, до]));
  const угол = Math.round(interpolate(Math.log(фокус), [Math.log(10), Math.log(600)], [109, 4]));
  const полу = (угол / 2) * (Math.PI / 180);
  const длина = 520;
  const пол = Math.tan(полу) * длина;
  return (
    <div style={{ position: "relative", width: 700, height: 560 }}>
      <svg width="700" height="560" style={{ position: "absolute", inset: 0 }}>
        <defs>
          <linearGradient id="кон" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor={Т.акцент2} stopOpacity="0.55" />
            <stop offset="100%" stopColor={Т.акцент2} stopOpacity="0.02" />
          </linearGradient>
        </defs>
        <polygon points={`90,280 ${90 + длина},${280 - пол} ${90 + длина},${280 + пол}`}
                 fill="url(#кон)" />
        <line x1="90" y1="280" x2={90 + длина} y2={280 - пол} stroke={Т.акцент2} strokeWidth="2" />
        <line x1="90" y1="280" x2={90 + длина} y2={280 + пол} stroke={Т.акцент2} strokeWidth="2" />
        {[0, 1, 2, 3, 4].map((i) => {
          const д = ((frame * 3 + i * 110) % 520);
          const п = Math.tan(полу) * д;
          return <line key={i} x1={90 + д} y1={280 - п} x2={90 + д} y2={280 + п}
                       stroke={Т.акцент2} strokeWidth="1.5" opacity={0.35 - (д / 520) * 0.3} />;
        })}
        <rect x="40" y="252" width="56" height="56" rx="8" fill="#161A24" stroke={Т.акцент} strokeWidth="2" />
        <circle cx="68" cy="280" r="16" fill="#0A0C12" stroke={Т.акцент} strokeWidth="2" />
        <circle cx="68" cy="280" r={7 + Math.sin(frame / 12) * 1.5} fill={Т.акцент2} opacity="0.6" />
      </svg>
      <div style={{ position: "absolute", right: 0, top: 10, textAlign: "right" }}>
        <div style={{ fontFamily: Т.шапка, fontSize: 92, fontWeight: 800, color: Т.текст,
                      lineHeight: 1 }}>{фокус}<span style={{ fontSize: 42, color: Т.тихий }}> мм</span></div>
        <div style={{ fontFamily: Т.корпус, fontSize: 34, color: Т.акцент2, marginTop: 8 }}>
          угол обзора {угол}°
        </div>
      </div>
    </div>
  );
};

/** Диафрагма: девять лепестков реально открываются и закрываются. */
export const Диафрагма: React.FC<{ размер?: number; подпись?: boolean }> = ({
  размер = 420, подпись = true,
}) => {
  const frame = useCurrentFrame();
  const ряд = [1.4, 2, 2.8, 4, 5.6, 8, 11, 16];
  const ф = туда_обратно(цикл(frame, 160));
  const индекс = ф * (ряд.length - 1);
  const f = ряд[Math.round(индекс)];
  const открытие = interpolate(индекс, [0, ряд.length - 1], [1, 0.16]);
  const лепестки = 9;
  const R = размер / 2;
  return (
    <div style={{ position: "relative", width: размер, height: размер + (подпись ? 90 : 0) }}>
      <svg width={размер} height={размер} style={{ display: "block" }}>
        <defs>
          <linearGradient id="лепесток" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#424A66" />
            <stop offset="55%" stopColor="#262C3E" />
            <stop offset="100%" stopColor="#171B26" />
          </linearGradient>
          <radialGradient id="зрачок">
            <stop offset="0%" stopColor="#0B1220" />
            <stop offset="70%" stopColor="#060910" />
            <stop offset="100%" stopColor="#000" />
          </radialGradient>
        </defs>
        <circle cx={R} cy={R} r={R - 4} fill="#171B26" stroke="#394157" strokeWidth="6" />
        <circle cx={R} cy={R} r={R - 24} fill="url(#зрачок)" />
        <circle cx={R} cy={R} r={(R - 30) * открытие + 6} fill={Т.акцент2} opacity="0.22" />
        {new Array(лепестки).fill(0).map((_, i) => {
          const a = (360 / лепестки) * i + (1 - открытие) * 26 + frame * 0.05;
          const смещение = (R - 26) * (0.42 + (1 - открытие) * 0.52);
          return (
            <g key={i} transform={`rotate(${a} ${R} ${R})`}>
              <path d={`M ${R} ${R - смещение} q ${R * 0.55} ${R * 0.1} ${R * 0.62} ${R * 0.72}
                        q ${-R * 0.5} ${-R * 0.18} ${-R * 0.62} ${-R * 0.72} z`}
                    fill="url(#лепесток)" stroke="#5A6485" strokeWidth="1.6" opacity="0.98" />
            </g>
          );
        })}
        <circle cx={R} cy={R} r={(R - 30) * открытие} fill="#05070C" />
        <circle cx={R} cy={R} r={(R - 30) * открытие} fill="none" stroke={Т.акцент2}
                strokeWidth="2.5" opacity="0.8" />
        <circle cx={R} cy={R} r={Math.max(0, (R - 30) * открытие - 10)} fill="none"
                stroke="#FFFFFF" strokeWidth="1" opacity="0.18" />
      </svg>
      {подпись ? (
        <div style={{ textAlign: "center", marginTop: 18 }}>
          <span style={{ fontFamily: Т.шапка, fontSize: 56, fontWeight: 800, color: Т.текст }}>
            f/{f}
          </span>
          <div style={{ fontFamily: Т.корпус, fontSize: 26, color: Т.тихий, marginTop: 4 }}>
            {открытие > 0.6 ? "много света, фон размыт" : "мало света, фон резкий"}
          </div>
        </div>
      ) : null}
    </div>
  );
};

/** Глубина резкости: огни на фоне собираются в точки и расплываются в боке. */
export const Глубина: React.FC = () => {
  const frame = useCurrentFrame();
  const ф = туда_обратно(цикл(frame, 160));
  const размыв = interpolate(ф, [0, 1], [26, 1]);
  const огни = new Array(18).fill(0).map((_, i) => ({
    x: 30 + random("gx" + i) * 790, y: 30 + random("gy" + i) * 280,
    r: 16 + random("gr" + i) * 34, т: random("gt" + i),
  }));
  return (
    <div style={{ position: "relative", width: 860, height: 460, borderRadius: 18,
                  overflow: "hidden", background: "linear-gradient(#0a0f1c, #121a2c)",
                  border: `1px solid ${Т.линия}` }}>
      <div style={{ position: "absolute", inset: 0, filter: `blur(${размыв}px)` }}>
        {огни.map((о, i) => (
          <div key={i} style={{
            position: "absolute", left: о.x + Math.sin(frame / 50 + i) * 6, top: о.y,
            width: о.r * 2, height: о.r * 2, borderRadius: 999,
            background: о.т > 0.6 ? "#FFD9A0" : о.т > 0.3 ? Т.акцент2 : Т.акцент,
            opacity: 0.85, boxShadow: `0 0 ${о.r}px rgba(255,255,255,0.25)`,
          }} />
        ))}
      </div>
      <div style={{ position: "absolute", left: 90, bottom: 40, width: 200, height: 300,
                    borderRadius: "40% 40% 20% 20%",
                    background: "linear-gradient(160deg, #2b3550, #171d2c)",
                    border: `2px solid ${Т.акцент}66`,
                    transform: `translateY(${Math.sin(frame / 36) * 5}px)`,
                    boxShadow: `0 0 50px ${Т.акцент}33` }} />
      <div style={{ position: "absolute", right: 24, top: 20, fontFamily: Т.корпус,
                    fontSize: 24, color: Т.тихий }}>
        фон: {размыв > 14 ? "размыт" : размыв > 6 ? "подтянулся" : "резкий"}
      </div>
    </div>
  );
};

/** Экспозиция: три ползунка ездят, яркость кадра и гистограмма отвечают. */
export const Экспозиция: React.FC = () => {
  const frame = useCurrentFrame();
  const ф = туда_обратно(цикл(frame, 190));
  const iso = Math.round(interpolate(ф, [0, 1], [100, 6400]) / 100) * 100;
  const выдержка = [50, 60, 80, 100, 125, 200][Math.round(ф * 5)];
  const диафрагма = [1.4, 2, 2.8, 4, 5.6, 8][Math.round((1 - ф) * 5)];
  const яркость = interpolate(ф, [0, 1], [0.35, 1.15]);
  const шум = interpolate(ф, [0, 1], [0, 0.4]);
  const ползунок = (имя: string, значение: string, доля: number, тон: string, i: number) => (
    <div key={имя} style={{ marginBottom: 26 }}>
      <div style={{ display: "flex", justifyContent: "space-between", fontFamily: Т.корпус,
                    fontSize: 26, color: Т.тихий, marginBottom: 10 }}>
        <span>{имя}</span><span style={{ color: Т.текст, fontWeight: 600 }}>{значение}</span>
      </div>
      <div style={{ height: 10, borderRadius: 10, background: "rgba(255,255,255,0.08)", position: "relative" }}>
        <div style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: `${доля * 100}%`,
                      borderRadius: 10, background: `linear-gradient(90deg, ${тон}44, ${тон})` }} />
        <div style={{ position: "absolute", left: `calc(${доля * 100}% - 13px)`, top: -8,
                      width: 26, height: 26, borderRadius: 26, background: тон,
                      boxShadow: `0 0 20px ${тон}`, border: "3px solid #0A0C12" }} />
      </div>
    </div>
  );
  return (
    <div style={{ display: "flex", gap: 48, alignItems: "flex-start" }}>
      <div style={{ width: 620 }}>
        {ползунок("ISO", String(iso), interpolate(iso, [100, 6400], [0, 1]), Т.тёплый, 0)}
        {ползунок("Выдержка", "1/" + выдержка, interpolate(выдержка, [50, 200], [0, 1]), Т.акцент2, 1)}
        {ползунок("Диафрагма", "f/" + диафрагма, interpolate(диафрагма, [1.4, 8], [1, 0]), Т.акцент, 2)}
      </div>
      <div>
        <div style={{ position: "relative", width: 520, height: 280, borderRadius: 16,
                      overflow: "hidden", border: `1px solid ${Т.линия}` }}>
          <div style={{ position: "absolute", inset: 0,
            background: "linear-gradient(135deg, #24405f, #4b6c92 40%, #8aa6c4 70%, #d6e2ef)",
            filter: `brightness(${яркость})` }} />
          <div style={{ position: "absolute", inset: 0, opacity: шум,
            backgroundImage: "repeating-conic-gradient(rgba(255,255,255,0.22) 0% 25%, rgba(0,0,0,0.22) 0% 50%)",
            backgroundSize: "3px 3px", mixBlendMode: "overlay" }} />
          <div style={{ position: "absolute", left: 16, bottom: 14, fontFamily: Т.корпус,
                        fontSize: 22, color: "#0B0D13", background: "rgba(255,255,255,0.75)",
                        padding: "4px 10px", borderRadius: 8 }}>
            {яркость < 0.6 ? "недосвет" : яркость > 1.05 ? "пересвет" : "норма"}
          </div>
        </div>
        <svg width="520" height="88" style={{ marginTop: 12, display: "block" }}>
          {new Array(48).fill(0).map((_, i) => {
            const центр = interpolate(яркость, [0.35, 1.15], [8, 40]);
            const в = Math.exp(-Math.pow(i - центр, 2) / 70) * 80;
            return <rect key={i} x={i * 10.8} y={88 - в} width="8" height={в} rx="2"
                         fill={i < 6 || i > 42 ? Т.тревога : Т.акцент2} opacity="0.85" />;
          })}
        </svg>
      </div>
    </div>
  );
};

/** Выдержка: быстрая морозит каплю, длинная тянет её в полосу. */
export const Выдержка: React.FC = () => {
  const frame = useCurrentFrame();
  const ф = цикл(frame, 150);
  const быстрая = ф < 0.5;
  const капли = new Array(34).fill(0).map((_, i) => ({
    x: 30 + random("kx" + i) * 790,
    y: ((random("ky" + i) * 400 + frame * (быстрая ? 9 : 17)) % 430),
    д: быстрая ? 16 : 120, т: random("kt" + i),
  }));
  return (
    <div style={{ position: "relative", width: 860, height: 440, borderRadius: 18,
                  overflow: "hidden", background: "linear-gradient(#0a0f1c, #141c30)",
                  border: `1px solid ${Т.линия}` }}>
      {капли.map((к, i) => (
        <div key={i} style={{
          position: "absolute", left: к.x, top: к.y, width: быстрая ? 11 : 8, height: к.д,
          borderRadius: 9,
          background: `linear-gradient(${Т.акцент2}, rgba(255,255,255,0.95))`,
          opacity: 0.65 + к.т * 0.35, filter: быстрая ? "none" : "blur(1.6px)",
          boxShadow: быстрая ? "0 0 14px rgba(255,255,255,0.4)" : "none",
        }} />
      ))}
      <div style={{ position: "absolute", left: "50%", bottom: 0, width: 190, height: 210,
                    transform: "translateX(-50%)", borderRadius: "16px 16px 50% 50%",
                    background: "linear-gradient(180deg, rgba(190,220,255,0.16), rgba(120,160,220,0.30))",
                    border: "2px solid rgba(190,220,255,0.45)", backdropFilter: "blur(2px)" }} />
      <div style={{ position: "absolute", left: 28, top: 22, fontFamily: Т.шапка, fontSize: 54,
                    fontWeight: 800, color: Т.текст }}>
        {быстрая ? "1/1000" : "1/4"}
      </div>
      <div style={{ position: "absolute", left: 30, top: 92, fontFamily: Т.корпус, fontSize: 28,
                    color: быстрая ? Т.акцент2 : Т.тёплый }}>
        {быстрая ? "движение заморожено" : "движение смазано"}
      </div>
    </div>
  );
};

/** Частота кадров: четыре дорожки мигают каждая со своей скоростью. */
export const Частота: React.FC = () => {
  const frame = useCurrentFrame();
  const ряды = [10, 25, 30, 60];
  return (
    <div style={{ width: 900 }}>
      {ряды.map((fps, i) => {
        const шаг = Math.max(1, Math.round(25 / (fps / 10)));
        const фаза = Math.floor(frame / шаг);
        return (
          <div key={fps} style={{ display: "flex", alignItems: "center", gap: 24, marginBottom: 22 }}>
            <div style={{ width: 120, fontFamily: Т.шапка, fontSize: 36, fontWeight: 800,
                          color: fps === 25 ? Т.акцент2 : Т.текст }}>{fps}</div>
            <div style={{ display: "flex", gap: 6, flex: 1 }}>
              {new Array(30).fill(0).map((_, j) => (
                <div key={j} style={{
                  flex: 1, height: 58, borderRadius: 6,
                  background: (j + фаза) % 2 === 0 ? (fps === 25 ? Т.акцент2 : Т.акцент) : "rgba(255,255,255,0.07)",
                  opacity: (j + фаза) % 2 === 0 ? 0.9 : 1,
                }} />
              ))}
            </div>
            <div style={{ width: 150, fontFamily: Т.корпус, fontSize: 24, color: Т.тихий }}>
              {fps === 10 ? "рвано" : fps === 25 ? "как кино" : fps === 30 ? "ровно" : "плавно"}
            </div>
          </div>
        );
      })}
    </div>
  );
};

/** Эквивалентное фокусное: строки таблицы оживают по одной. */
export const Таблица: React.FC<{ строки: string[][]; шапка: string[] }> = ({ строки, шапка }) => {
  const frame = useCurrentFrame();
  return (
    <div style={{ width: 920 }}>
      <div style={{ display: "flex", gap: 12, marginBottom: 12 }}>
        {шапка.map((с, i) => (
          <div key={i} style={{ flex: 1, fontFamily: Т.корпус, fontSize: 24, color: Т.тихий,
                                textAlign: i ? "center" : "left" }}>{с}</div>
        ))}
      </div>
      {строки.map((р, i) => {
        const п = 10 + i * 12;
        const д = interpolate(frame, [п, п + 14], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
        return (
          <div key={i} style={{ display: "flex", gap: 12, marginBottom: 10, opacity: д,
                                transform: `translateX(${(1 - д) * 30}px)`,
                                padding: "16px 20px", borderRadius: 14,
                                background: i % 2 ? "rgba(255,255,255,0.04)" : "rgba(124,92,255,0.10)",
                                border: `1px solid ${Т.линия}` }}>
            {р.map((с, j) => (
              <div key={j} style={{ flex: 1, fontFamily: j ? Т.шапка : Т.корпус,
                                    fontWeight: j ? 700 : 500,
                                    fontSize: j ? 30 : 26,
                                    color: j === 0 ? Т.текст : j === р.length - 1 ? Т.акцент2 : Т.текст,
                                    textAlign: j ? "center" : "left" }}>{с}</div>
            ))}
          </div>
        );
      })}
    </div>
  );
};
