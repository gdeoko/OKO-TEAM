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
