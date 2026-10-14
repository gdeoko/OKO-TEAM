import React from "react";
import { interpolate, useCurrentFrame } from "remotion";
import { Т } from "./dvizh";

const цикл = (frame: number, период: number) => (frame % период) / период;
const туда_обратно = (ф: number) => (ф < 0.5 ? ф * 2 : 2 - ф * 2);
const шапка = '"Unbounded", sans-serif';
const корпус = '"Inter", sans-serif';

/** Набор видеографа: шесть частей собираются в одну схему. */
export const НаборСхема: React.FC = () => {
  const frame = useCurrentFrame();
  const части = ["камера", "оптика", "звук", "свет", "опора", "хранение"];
  return (
    <div style={{ width: 860, height: 520, position: "relative" }}>
      <div style={{ position: "absolute", left: "50%", top: "50%", width: 230, height: 230,
                    marginLeft: -115, marginTop: -115, borderRadius: 999,
                    border: `2px solid ${Т.акцент}`, display: "flex", alignItems: "center",
                    justifyContent: "center", fontFamily: шапка, fontSize: 30, color: Т.текст,
                    background: `radial-gradient(circle, ${Т.акцент}26, transparent 70%)`,
                    transform: `scale(${1 + Math.sin(frame / 30) * 0.03})` }}>
        набор
      </div>
      {части.map((ч, i) => {
        const д = interpolate(frame, [6 + i * 7, 22 + i * 7], [0, 1],
                              { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
        const угол = (360 / части.length) * i - 90 + frame * 0.25;
        const r = 215;
        const x = Math.cos((угол * Math.PI) / 180) * r;
        const y = Math.sin((угол * Math.PI) / 180) * r * 0.78;
        return (
          <div key={ч}>
            <div style={{ position: "absolute", left: 430, top: 260, width: r, height: 2,
                          transformOrigin: "0% 50%", transform: `rotate(${угол}deg) scaleX(${д})`,
                          background: `linear-gradient(90deg, ${Т.акцент}88, transparent)` }} />
            <div style={{ position: "absolute", left: 430 + x, top: 260 + y,
                          transform: `translate(-50%, -50%) scale(${0.8 + д * 0.2})`, opacity: д,
                          padding: "12px 20px", borderRadius: 12,
                          border: `1px solid ${i % 2 ? Т.акцент2 : Т.акцент}66`,
                          background: "rgba(8,10,16,0.78)", fontFamily: корпус, fontSize: 26,
                          color: Т.текст, whiteSpace: "nowrap" }}>{ч}</div>
          </div>
        );
      })}
    </div>
  );
};

/** Видеокамера или фотоаппарат: две колонки, сильные стороны загораются. */
export const Сравнение: React.FC = () => {
  const frame = useCurrentFrame();
  const слева = ["длинная запись", "звуковые входы", "удобный зум"];
  const справа = ["компактнее", "лучше по свету", "резче картинка"];
  const стол = (имя: string, пункты: string[], цвет: string, сдвиг: number) => (
    <div style={{ flex: 1 }}>
      <div style={{ fontFamily: шапка, fontSize: 34, color: цвет, marginBottom: 18 }}>{имя}</div>
      {пункты.map((п, i) => {
        const д = interpolate(frame, [10 + сдвиг + i * 12, 26 + сдвиг + i * 12], [0, 1],
                              { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
        return (
          <div key={п} style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 16,
                                opacity: д, transform: `translateX(${(1 - д) * 40 * (сдвиг ? 1 : -1)}px)` }}>
            <span style={{ width: 12, height: 12, borderRadius: 3, background: цвет }} />
            <span style={{ fontFamily: корпус, fontSize: 28, color: Т.текст }}>{п}</span>
          </div>
        );
      })}
    </div>
  );
  return (
    <div style={{ width: 880, height: 420, display: "flex", gap: 46, alignItems: "flex-start" }}>
      {стол("видеокамера", слева, Т.акцент2, 0)}
      <div style={{ width: 2, alignSelf: "stretch",
                    background: `linear-gradient(180deg, transparent, ${Т.линия}, transparent)` }} />
      {стол("фотоаппарат", справа, Т.акцент, 6)}
    </div>
  );
};

/** Звук: живая волна и столбик уровня с рабочей отметкой. */
export const ЗвукУровень: React.FC = () => {
  const frame = useCurrentFrame();
  const полос = 46;
  const уровень = 0.55 + Math.sin(frame / 18) * 0.12 + Math.sin(frame / 7) * 0.05;
  return (
    <div style={{ width: 860, height: 420, display: "flex", gap: 40, alignItems: "flex-end" }}>
      <div style={{ flex: 1, height: 300, display: "flex", alignItems: "center", gap: 6 }}>
        {new Array(полос).fill(0).map((_, i) => {
          const в = 24 + Math.abs(Math.sin(i * 0.6 + frame / 9)) * (120 + (i % 5) * 26);
          return <div key={i} style={{ flex: 1, height: в, borderRadius: 4,
                                       background: `linear-gradient(180deg, ${Т.акцент2}, ${Т.акцент}99)` }} />;
        })}
      </div>
      <div style={{ width: 92, height: 300, position: "relative", borderRadius: 10,
                    border: `1px solid ${Т.линия}`, background: "rgba(255,255,255,0.03)" }}>
        <div style={{ position: "absolute", left: 6, right: 6, bottom: 6, borderRadius: 8,
                      height: `${уровень * 92}%`,
                      background: `linear-gradient(0deg, ${Т.акцент2}, ${уровень > 0.82 ? Т.тревога : Т.тёплый})` }} />
        <div style={{ position: "absolute", left: -10, right: -10, bottom: "62%", height: 2,
                      background: Т.тревога }} />
        <div style={{ position: "absolute", left: 100, bottom: "60%", fontFamily: корпус,
                      fontSize: 22, color: Т.тревога, whiteSpace: "nowrap" }}>-12 дБ</div>
      </div>
    </div>
  );
};

/** Направленность: петличка берёт всё вокруг, пушка — узкий сектор. */
export const Направленность: React.FC = () => {
  const frame = useCurrentFrame();
  const волна = цикл(frame, 60);
  const карточка = (имя: string, узкая: boolean, цвет: string) => (
    <div style={{ width: 380, height: 380, position: "relative" }}>
      <div style={{ position: "absolute", inset: 0, borderRadius: 999, border: `1px solid ${Т.линия}` }} />
      {узкая ? (
        <div style={{ position: "absolute", left: "50%", top: "50%", width: 170, height: 300,
                      marginLeft: -85, marginTop: -210,
                      clipPath: "polygon(50% 100%, 0% 0%, 100% 0%)",
                      background: `linear-gradient(0deg, ${цвет}88, transparent)` }} />
      ) : (
        <div style={{ position: "absolute", left: "50%", top: "50%", width: 300, height: 300,
                      marginLeft: -150, marginTop: -150, borderRadius: 999,
                      background: `radial-gradient(circle, ${цвет}66, transparent 72%)` }} />
      )}
      <div style={{ position: "absolute", left: "50%", top: "50%", width: 300 * волна,
                    height: 300 * волна, marginLeft: -150 * волна, marginTop: -150 * волна,
                    borderRadius: 999, border: `1px solid ${цвет}`, opacity: 1 - волна }} />
      <div style={{ position: "absolute", left: "50%", top: "50%", width: 26, height: 26,
                    marginLeft: -13, marginTop: -13, borderRadius: 999, background: цвет }} />
      <div style={{ position: "absolute", left: 0, right: 0, bottom: -6, textAlign: "center",
                    fontFamily: корпус, fontSize: 26, color: Т.текст }}>{имя}</div>
    </div>
  );
  return (
    <div style={{ width: 840, height: 420, display: "flex", gap: 60, justifyContent: "center" }}>
      {карточка("петличка: вокруг", false, Т.акцент)}
      {карточка("пушка: узко вперёд", true, Т.акцент2)}
    </div>
  );
};

/** Схема света: рисующий, заполняющий и контровой вокруг героя. */
export const СхемаСвета: React.FC = () => {
  const frame = useCurrentFrame();
  const точки = [
    { имя: "рисующий", x: 180, y: 120, цвет: Т.тёплый, сила: 1 },
    { имя: "заполняющий", x: 660, y: 190, цвет: Т.акцент2, сила: 0.5 },
    { имя: "контровой", x: 420, y: 40, цвет: Т.акцент, сила: 0.75 },
  ];
  return (
    <div style={{ width: 860, height: 460, position: "relative" }}>
      <div style={{ position: "absolute", left: 390, top: 250, width: 90, height: 90,
                    borderRadius: 999, background: "rgba(255,255,255,0.1)",
                    border: `2px solid ${Т.линия}` }} />
      <div style={{ position: "absolute", left: 406, top: 340, width: 58, height: 92,
                    borderRadius: 18, background: "rgba(255,255,255,0.07)",
                    border: `2px solid ${Т.линия}` }} />
      {точки.map((т, i) => {
        const д = interpolate(frame, [8 + i * 14, 26 + i * 14], [0, 1],
                              { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
        const пульс = 1 + Math.sin(frame / 24 + i) * 0.06;
        return (
          <div key={т.имя}>
            <div style={{ position: "absolute", left: т.x, top: т.y, width: 300 * т.сила * д * пульс,
                          height: 2, transformOrigin: "0% 50%",
                          transform: `rotate(${Math.atan2(295 - т.y, 435 - т.x) * 180 / Math.PI}deg)`,
                          background: `linear-gradient(90deg, ${т.цвет}, transparent)` }} />
            <div style={{ position: "absolute", left: т.x - 34, top: т.y - 34, width: 68, height: 68,
                          borderRadius: 14, border: `2px solid ${т.цвет}`, opacity: д,
                          background: `radial-gradient(circle, ${т.цвет}44, transparent 70%)`,
                          transform: `scale(${пульс})` }} />
            <div style={{ position: "absolute", left: т.x - 60, top: т.y + 44, width: 180,
                          textAlign: "center", fontFamily: корпус, fontSize: 22, color: т.цвет,
                          opacity: д }}>{т.имя}</div>
          </div>
        );
      })}
    </div>
  );
};

/** Мягкий и жёсткий свет: тень от одного и того же предмета. */
export const Мягкость: React.FC = () => {
  const frame = useCurrentFrame();
  const ф = туда_обратно(цикл(frame, 110));
  const блок = (имя: string, мягко: boolean) => (
    <div style={{ width: 380, height: 360, position: "relative", borderRadius: 18,
                  border: `1px solid ${Т.линия}`, overflow: "hidden",
                  background: "linear-gradient(180deg, rgba(255,255,255,0.05), transparent)" }}>
      <div style={{ position: "absolute", left: 150, top: 90, width: 80, height: 80, borderRadius: 16,
                    background: "#D9DEE8" }} />
      <div style={{ position: "absolute", left: 150, top: 176, width: 80,
                    height: мягко ? 120 : 150, borderRadius: мягко ? 40 : 6,
                    background: `rgba(0,0,0,${мягко ? 0.45 : 0.82})`,
                    filter: `blur(${мягко ? 22 + ф * 6 : 2}px)`, transformOrigin: "50% 0%",
                    transform: `scaleY(${1 + ф * 0.08})` }} />
      <div style={{ position: "absolute", left: 0, right: 0, bottom: 14, textAlign: "center",
                    fontFamily: корпус, fontSize: 24, color: Т.текст }}>{имя}</div>
    </div>
  );
  return (
    <div style={{ width: 820, height: 380, display: "flex", gap: 50, justifyContent: "center" }}>
      {блок("мягкий: тень размыта", true)}
      {блок("жёсткий: край резкий", false)}
    </div>
  );
};

/** Скорость карты: битрейт против запаса по записи. */
export const КартаСкорость: React.FC = () => {
  const frame = useCurrentFrame();
  const строки = [
    { имя: "видео 100 Мбит", доля: 0.3, цвет: Т.акцент2 },
    { имя: "видео 400 Мбит", доля: 0.62, цвет: Т.акцент },
    { имя: "запас карты", доля: 0.95, цвет: Т.тёплый },
  ];
  return (
    <div style={{ width: 860, height: 360, display: "flex", flexDirection: "column", gap: 26 }}>
      {строки.map((с, i) => {
        const д = interpolate(frame, [8 + i * 12, 34 + i * 12], [0, 1],
                              { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
        return (
          <div key={с.имя}>
            <div style={{ fontFamily: корпус, fontSize: 24, color: Т.тихий, marginBottom: 8 }}>{с.имя}</div>
            <div style={{ height: 34, borderRadius: 10, background: "rgba(255,255,255,0.05)",
                          border: `1px solid ${Т.линия}`, overflow: "hidden" }}>
              <div style={{ width: `${с.доля * д * 100}%`, height: "100%",
                            background: `linear-gradient(90deg, ${с.цвет}, ${с.цвет}55)`,
                            boxShadow: `0 0 26px ${с.цвет}66` }} />
            </div>
          </div>
        );
      })}
    </div>
  );
};

/** Домашнее задание: пункты отмечаются сами. */
export const Чеклист: React.FC<{ пункты?: string[] }> = ({ пункты }) => {
  const frame = useCurrentFrame();
  const список = пункты && пункты.length ? пункты
    : ["снять один план", "поставить свет", "записать звук", "проверить кадр"];
  return (
    <div style={{ width: 780, display: "flex", flexDirection: "column", gap: 20 }}>
      {список.slice(0, 5).map((п, i) => {
        const т = 14 + i * 18;
        const д = interpolate(frame, [т, т + 14], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
        const галка = interpolate(frame, [т + 10, т + 22], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
        return (
          <div key={i} style={{ display: "flex", alignItems: "center", gap: 20, opacity: д,
                                transform: `translateX(${(1 - д) * 50}px)` }}>
            <div style={{ width: 44, height: 44, borderRadius: 10, border: `2px solid ${Т.акцент2}`,
                          position: "relative", background: `${Т.акцент2}${галка > 0.5 ? "33" : "0D"}` }}>
              <div style={{ position: "absolute", left: 12, top: 20, width: 12, height: 3,
                            background: Т.акцент2, transform: "rotate(45deg)", transformOrigin: "0% 50%",
                            scale: `${галка} 1` }} />
              <div style={{ position: "absolute", left: 20, top: 25, width: 20, height: 3,
                            background: Т.акцент2, transform: "rotate(-52deg)", transformOrigin: "0% 50%",
                            scale: `${галка} 1` }} />
            </div>
            <div style={{ fontFamily: корпус, fontSize: 30, color: Т.текст }}>{п}</div>
          </div>
        );
      })}
    </div>
  );
};

/** Путь занятия: от камеры к настройкам и съёмке. */
export const Путь: React.FC = () => {
  const frame = useCurrentFrame();
  const шаги = ["камера", "оптика", "настройки", "звук и свет", "съёмка"];
  return (
    <div style={{ width: 920, height: 260, position: "relative" }}>
      <div style={{ position: "absolute", left: 0, right: 0, top: 118, height: 3,
                    background: "rgba(255,255,255,0.08)" }}>
        <div style={{ height: "100%", width: `${interpolate(frame, [8, 60], [0, 100], { extrapolateRight: "clamp", extrapolateLeft: "clamp" })}%`,
                      background: `linear-gradient(90deg, ${Т.акцент}, ${Т.акцент2})` }} />
      </div>
      {шаги.map((ш, i) => {
        const т = 10 + i * 11;
        const д = interpolate(frame, [т, т + 14], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
        return (
          <div key={ш} style={{ position: "absolute", left: `${i * 23}%`, top: 92, opacity: д,
                                transform: `translateY(${(1 - д) * 20}px)` }}>
            <div style={{ width: 54, height: 54, borderRadius: 999, margin: "0 auto",
                          border: `2px solid ${i % 2 ? Т.акцент2 : Т.акцент}`,
                          background: "rgba(8,10,16,0.9)", display: "flex", alignItems: "center",
                          justifyContent: "center", fontFamily: шапка, fontSize: 22,
                          color: Т.текст }}>{i + 1}</div>
            <div style={{ marginTop: 14, textAlign: "center", fontFamily: корпус, fontSize: 24,
                          color: Т.тихий, width: 180, marginLeft: -63 }}>{ш}</div>
          </div>
        );
      })}
    </div>
  );
};

/** Шум и ISO: зерно растёт вместе с числом. */
export const Шум: React.FC = () => {
  const frame = useCurrentFrame();
  const ф = туда_обратно(цикл(frame, 120));
  const iso = Math.round(interpolate(ф, [0, 1], [100, 12800]));
  const зерно = interpolate(ф, [0, 1], [0.02, 0.5]);
  return (
    <div style={{ width: 760, height: 460, position: "relative" }}>
      <div style={{ position: "absolute", inset: 0, borderRadius: 18, overflow: "hidden",
                    border: `1px solid ${Т.линия}`,
                    background: `linear-gradient(135deg, ${Т.акцент}33, ${Т.акцент2}22 60%, rgba(0,0,0,0.6))` }}>
        {new Array(150).fill(0).map((_, i) => {
          const x = ((i * 97 + frame * 3) % 760);
          const y = ((i * 53 + frame * 5) % 400);
          return <div key={i} style={{ position: "absolute", left: x, top: y, width: 3, height: 3,
                                       background: i % 2 ? "#fff" : "#000", opacity: зерно }} />;
        })}
      </div>
      <div style={{ position: "absolute", left: 24, bottom: 20, fontFamily: шапка, fontSize: 64,
                    fontWeight: 800, color: Т.текст }}>
        ISO {iso}
      </div>
    </div>
  );
};

/** Правило третей: сетка кадра и герой, который встаёт на пересечение. */
export const Третей: React.FC = () => {
  const frame = useCurrentFrame();
  const ф = туда_обратно(цикл(frame, 130));
  const x = interpolate(ф, [0, 1], [0.5, 0.333]);
  const y = interpolate(ф, [0, 1], [0.62, 0.333]);
  return (
    <div style={{ width: 880, height: 500, position: "relative", borderRadius: 16,
                  border: `2px solid ${Т.акцент2}55`, overflow: "hidden",
                  boxShadow: `0 0 60px ${Т.акцент}22`,
                  background: `linear-gradient(160deg, ${Т.акцент}3D, ${Т.акцент2}1A 55%, rgba(10,12,18,0.85))` }}>
      {[1, 2].map((i) => (
        <div key={"v" + i} style={{ position: "absolute", left: `${(i * 100) / 3}%`, top: 0, bottom: 0,
                                    width: 2, background: "rgba(255,255,255,0.45)" }} />
      ))}
      {[1, 2].map((i) => (
        <div key={"h" + i} style={{ position: "absolute", top: `${(i * 100) / 3}%`, left: 0, right: 0,
                                    height: 2, background: "rgba(255,255,255,0.45)" }} />
      ))}
      <div style={{ position: "absolute", left: `${x * 100}%`, top: `${y * 100}%`,
                    width: 110, height: 110, marginLeft: -55, marginTop: -55, borderRadius: 999,
                    background: `radial-gradient(circle, ${Т.акцент2}CC, ${Т.акцент2}22 60%, transparent 72%)`,
                    border: `2px solid ${Т.акцент2}` }} />
      <div style={{ position: "absolute", left: 24, bottom: 18, fontFamily: корпус, fontSize: 24,
                    color: Т.текст, opacity: 0.85 }}>
        {ф > 0.6 ? "герой на пересечении" : "герой по центру"}
      </div>
    </div>
  );
};

/** Баланс белого: шкала кельвинов и как уезжает цвет кадра. */
export const Кельвины: React.FC = () => {
  const frame = useCurrentFrame();
  const ф = туда_обратно(цикл(frame, 150));
  const k = Math.round(interpolate(ф, [0, 1], [2700, 8000]));
  const цвет = ф < 0.5 ? `rgba(255, ${170 + ф * 80}, 110, 0.5)` : `rgba(${190 - ф * 60}, 220, 255, 0.5)`;
  return (
    <div style={{ width: 880, height: 420, display: "flex", flexDirection: "column", gap: 22 }}>
      <div style={{ height: 230, borderRadius: 16, border: `1px solid ${Т.линия}`, position: "relative",
                    overflow: "hidden", background: "#1A1D26" }}>
        <div style={{ position: "absolute", inset: 0, background: цвет }} />
        <div style={{ position: "absolute", left: 60, top: 50, width: 150, height: 130, borderRadius: 12,
                      background: "rgba(245,245,248,0.9)" }} />
        <div style={{ position: "absolute", left: 250, top: 70, width: 110, height: 110,
                      borderRadius: 999, background: "rgba(120,130,150,0.9)" }} />
        <div style={{ position: "absolute", right: 28, top: 24, fontFamily: шапка, fontSize: 54,
                      fontWeight: 800, color: Т.текст }}>{k} K</div>
      </div>
      <div style={{ height: 26, borderRadius: 8, position: "relative",
                    background: "linear-gradient(90deg, #FF9A4D, #FFD9A6, #FFFFFF, #BFE0FF, #7FB6FF)" }}>
        <div style={{ position: "absolute", top: -8, left: `${interpolate(ф, [0, 1], [2, 96])}%`,
                      width: 6, height: 42, borderRadius: 4, background: Т.текст,
                      boxShadow: "0 0 18px rgba(255,255,255,0.8)" }} />
      </div>
    </div>
  );
};

/** Стабилизация: одна и та же проводка с рук и на стабилизаторе. */
export const Стабилизация: React.FC = () => {
  const frame = useCurrentFrame();
  const точки = 60;
  const линия = (дрожь: number) => new Array(точки).fill(0).map((_, i) => {
    const x = (i / (точки - 1)) * 820;
    const y = 60 + Math.sin(i / 7 + frame / 12) * 10 * дрожь
      + (дрожь > 0.5 ? Math.sin(i * 2.3 + frame / 3) * 16 : 0);
    return `${x},${y}`;
  }).join(" ");
  return (
    <div style={{ width: 860, height: 380, display: "flex", flexDirection: "column", gap: 28 }}>
      {[{ имя: "с рук", др: 1, цвет: Т.тревога }, { имя: "на стабилизаторе", др: 0.2, цвет: Т.акцент2 }].map((р) => (
        <div key={р.имя} style={{ borderRadius: 14, border: `1px solid ${Т.линия}`, padding: "12px 18px",
                                  background: "rgba(255,255,255,0.03)" }}>
          <div style={{ fontFamily: корпус, fontSize: 24, color: р.цвет, marginBottom: 6 }}>{р.имя}</div>
          <svg width="820" height="120">
            <polyline points={линия(р.др)} fill="none" stroke={р.цвет} strokeWidth="3" />
          </svg>
        </div>
      ))}
    </div>
  );
};

/** Кодеки и битрейт: сколько весит минута у разных режимов записи. */
export const Кодеки: React.FC = () => {
  const frame = useCurrentFrame();
  const строки = [
    { имя: "H.264 100 Мбит", доля: 0.32, вес: "0,7 ГБ / мин", цвет: Т.акцент2 },
    { имя: "H.265 150 Мбит", доля: 0.48, вес: "1,1 ГБ / мин", цвет: Т.акцент },
    { имя: "ProRes 880 Мбит", доля: 1.0, вес: "6,6 ГБ / мин", цвет: Т.тёплый },
  ];
  return (
    <div style={{ width: 880, height: 400, display: "flex", flexDirection: "column", gap: 26 }}>
      {строки.map((с, i) => {
        const д = interpolate(frame, [8 + i * 12, 36 + i * 12], [0, 1],
                              { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
        return (
          <div key={с.имя}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
              <span style={{ fontFamily: корпус, fontSize: 24, color: Т.тихий }}>{с.имя}</span>
              <span style={{ fontFamily: корпус, fontSize: 24, color: с.цвет, opacity: д }}>{с.вес}</span>
            </div>
            <div style={{ height: 32, borderRadius: 10, background: "rgba(255,255,255,0.05)",
                          border: `1px solid ${Т.линия}`, overflow: "hidden" }}>
              <div style={{ width: `${с.доля * д * 100}%`, height: "100%",
                            background: `linear-gradient(90deg, ${с.цвет}, ${с.цвет}44)` }} />
            </div>
          </div>
        );
      })}
    </div>
  );
};

/** Автофокус: точки ведут героя по кадру и цепляются за него. */
export const Автофокус: React.FC = () => {
  const frame = useCurrentFrame();
  const ф = цикл(frame, 120);
  const x = 0.25 + Math.sin(ф * Math.PI * 2) * 0.22;
  const y = 0.45 + Math.cos(ф * Math.PI * 2) * 0.12;
  return (
    <div style={{ width: 880, height: 480, position: "relative", borderRadius: 16,
                  border: `1px solid ${Т.линия}`, overflow: "hidden",
                  background: `linear-gradient(140deg, ${Т.акцент}14, rgba(0,0,0,0.55))` }}>
      {new Array(35).fill(0).map((_, i) => {
        const кx = (i % 7) / 6, кy = Math.floor(i / 7) / 4;
        const близко = Math.hypot(кx - x, кy - y) < 0.16;
        return (
          <div key={i} style={{ position: "absolute", left: `${8 + кx * 84}%`, top: `${12 + кy * 74}%`,
                                width: 40, height: 30, marginLeft: -20, marginTop: -15, borderRadius: 5,
                                border: `2px solid ${близко ? Т.акцент2 : "rgba(255,255,255,0.18)"}`,
                                background: близко ? `${Т.акцент2}22` : "transparent" }} />
        );
      })}
      <div style={{ position: "absolute", left: `${8 + x * 84}%`, top: `${12 + y * 74}%`,
                    width: 130, height: 130, marginLeft: -65, marginTop: -65, borderRadius: 999,
                    background: `radial-gradient(circle, rgba(240,245,255,0.5), transparent 68%)` }} />
    </div>
  );
};

/** Монтажный стол: дорожки видео, звука и титров идут по таймлайну. */
export const Дорожки: React.FC = () => {
  const frame = useCurrentFrame();
  const бег = (frame * 2.2) % 820;
  const дорожки = [
    { имя: "видео", куски: [[0, 240], [260, 420], [450, 820]], цвет: Т.акцент },
    { имя: "звук", куски: [[0, 500], [520, 820]], цвет: Т.акцент2 },
    { имя: "титры", куски: [[120, 300], [540, 700]], цвет: Т.тёплый },
  ];
  return (
    <div style={{ width: 880, height: 380, position: "relative" }}>
      {дорожки.map((д, i) => (
        <div key={д.имя} style={{ marginBottom: 20 }}>
          <div style={{ fontFamily: корпус, fontSize: 22, color: Т.тихий, marginBottom: 6 }}>{д.имя}</div>
          <div style={{ position: "relative", height: 62, borderRadius: 10,
                        background: "rgba(255,255,255,0.04)", border: `1px solid ${Т.линия}` }}>
            {д.куски.map(([a, b], j) => {
              const п = interpolate(frame, [6 + i * 8 + j * 6, 24 + i * 8 + j * 6], [0, 1],
                                    { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
              return (
                <div key={j} style={{ position: "absolute", left: a, width: (b - a) * п, top: 6, bottom: 6,
                                      borderRadius: 8, background: `linear-gradient(90deg, ${д.цвет}99, ${д.цвет}44)`,
                                      border: `1px solid ${д.цвет}` }} />
              );
            })}
          </div>
        </div>
      ))}
      <div style={{ position: "absolute", left: бег, top: 24, bottom: 0, width: 2,
                    background: Т.текст, boxShadow: `0 0 14px ${Т.текст}` }} />
    </div>
  );
};
