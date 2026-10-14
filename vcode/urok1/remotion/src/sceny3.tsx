import React from "react";
import { AbsoluteFill, Easing, interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import { Вспышка, Предмет, Строка, ТАКТ, Т, Фон, Шапка, въезд, камера, сторона, такт } from "./dvizh";
import { Глубина, Диафрагма, КропКадр, Матрицы, Таблица, УголОбзора, Частота, Экспозиция, Выдержка } from "./graf";

type Св = { с: any };
const ВЫХОД = Easing.bezier(0.16, 1, 0.3, 1);

/** Общая рама: живой фон, ход камеры на всю сцену, вспышка на такте. */
const Рама: React.FC<{ дети: React.ReactNode; сид: number; тон?: string }> = ({ дети, сид, тон }) => {
  const frame = useCurrentFrame();
  const к = камера(frame, сид);
  return (
    <AbsoluteFill>
      <Фон сид={сид} тон={тон} />
      <AbsoluteFill style={{
        translate: `${к.x * 0.35}px ${к.y * 0.35}px`,
        scale: 1 + (к.s - 1) * 0.5,
        rotate: `${к.r * 0.3}deg`,
      }}>
        {дети}
      </AbsoluteFill>
      <Вспышка сид={сид} />
    </AbsoluteFill>
  );
};

/** Графика получает свой ход: на каждом такте новый наезд и сдвиг. */
const Ход: React.FC<{ дети: React.ReactNode; сид: number }> = ({ дети, сид }) => {
  const frame = useCurrentFrame();
  const к = камера(frame + 17, сид + 7);
  return (
    <div style={{
      translate: `${-к.x * 0.5}px ${-к.y * 0.45}px`,
      scale: 1 + (к.s - 1) * 1.4,
      rotate: `${-к.r * 0.5}deg`,
    }}>{дети}</div>
  );
};

/** Полоса тактов: тонкая линия сверху, которая тикает каждый такт. */
const Пульс: React.FC<{ сид: number }> = ({ сид }) => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const { доля } = такт(frame);
  return (
    <div style={{ position: "absolute", left: Т.поле, right: Т.поле, top: 78, height: 2,
                  background: "rgba(255,255,255,0.07)" }}>
      <div style={{ height: "100%", width: `${доля * 100}%`,
                    background: `linear-gradient(90deg, ${Т.акцент}, ${Т.акцент2})`,
                    opacity: 0.55 }} />
    </div>
  );
};

/** Вступление: три такта, в каждом своё событие. */
export const Вступление: React.FC<Св> = ({ с }) => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const метки = с.строки || [];
  return (
    <Рама сид={3} дети={
      <AbsoluteFill style={{ padding: `${Т.поле}px`, display: "flex", flexDirection: "row",
                             alignItems: "center", gap: 40 }}>
        <div style={{ flex: "0 0 50%", display: "flex", flexDirection: "column", gap: 26 }}>
          <div style={{ ...въезд(frame, 2, 3, 0), fontFamily: Т.корпус, fontSize: 26,
                        letterSpacing: "0.34em", color: Т.акцент2 }}>
            {с.надзаголовок || "ЗАНЯТИЕ 1"}
          </div>
          <Шапка текст={с.заголовок} размер={100} от={6} сид={3} ширина={900} />
          <div style={{ display: "flex", flexWrap: "wrap", gap: 12, marginTop: 6 }}>
            {метки.map((м: string, i: number) => {
              const от = ТАКТ + i * 9;
              const ст = въезд(frame, от, 5, i);
              return (
                <span key={i} style={{
                  ...ст, display: "inline-flex", alignItems: "center", gap: 10,
                  padding: "12px 22px", borderRadius: 999,
                  border: `1px solid ${i % 2 ? Т.акцент2 : Т.акцент}66`,
                  background: `${i % 2 ? Т.акцент2 : Т.акцент}18`,
                  fontFamily: Т.корпус, fontSize: 26, color: Т.текст,
                }}>
                  <span style={{ width: 8, height: 8, borderRadius: 8,
                                 background: i % 2 ? Т.акцент2 : Т.акцент }} />{м}
                </span>
              );
            })}
          </div>
        </div>
        <div style={{ flex: 1, display: "flex", justifyContent: "center" }}>
          <Предмет файл={с.предмет || "kadr/u2_kamera.png"} размер={760} сид={2} от={10} />
        </div>
      </AbsoluteFill>
    } />
  );
};

/** Набор: предметы идут по очереди через всю сцену, снизу лента пройденных. */
export const Набор: React.FC<Св> = ({ с }) => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const предметы = с.предметы || [];
  const старт = 18;
  const шаг = Math.max(ТАКТ, Math.floor((durationInFrames - старт - 20) / Math.max(1, предметы.length)));
  const текущий = Math.max(0, Math.min(предметы.length - 1, Math.floor((frame - старт) / шаг)));
  const п = предметы[текущий] || {};
  const от = старт + текущий * шаг;
  return (
    <Рама сид={5} дети={
      <AbsoluteFill style={{ padding: `${Т.поле}px ${Т.поле}px 150px`, display: "flex",
                             flexDirection: "column" }}>
        <Шапка текст={с.заголовок} размер={62} от={0} сид={5} ширина={1100} />
        <div style={{ flex: 1, display: "flex", alignItems: "center", gap: 50, marginTop: 10 }}>
          <div style={{ flex: "0 0 46%" }}>
            <div key={"имя" + текущий} style={{ ...въезд(frame, от + 6, 9, текущий),
                                                fontFamily: Т.шапка, fontSize: 58, fontWeight: 800,
                                                color: Т.текст }}>
              {п.имя}
            </div>
            <div key={"опис" + текущий} style={{ ...въезд(frame, от + 12, 10, текущий),
                                                 fontFamily: Т.корпус, fontSize: 32,
                                                 color: Т.тихий, marginTop: 14, maxWidth: 560,
                                                 lineHeight: 1.35 }}>
              {п.текст}
            </div>
            <div style={{ display: "flex", gap: 10, marginTop: 34 }}>
              {предметы.map((_: any, i: number) => (
                <span key={i} style={{
                  width: i === текущий ? 44 : 14, height: 6, borderRadius: 6,
                  background: i === текущий ? Т.акцент2 : "rgba(255,255,255,0.18)",
                }} />
              ))}
            </div>
          </div>
          <div style={{ flex: 1, display: "flex", justifyContent: "center", alignItems: "center" }}>
            <div key={"пр" + текущий}>
              <Предмет файл={"kadr/" + (п.файл || "u2_kamera.png")} размер={460}
                       сид={11 + текущий} тон={текущий % 2 ? Т.акцент2 : Т.акцент} от={от} />
            </div>
          </div>
        </div>
        <div style={{ display: "flex", gap: 18, alignItems: "flex-end", height: 120 }}>
          {предметы.map((х: any, i: number) => {
            if (i >= текущий) return null;
            return (
              <div key={i} style={{ ...въезд(frame, старт + (i + 1) * шаг, 12, i), opacity: 0.45 }}>
                <Предмет файл={"kadr/" + х.файл} размер={100} сид={31 + i}
                         тон={i % 2 ? Т.акцент2 : Т.акцент} от={старт + (i + 1) * шаг} />
              </div>
            );
          })}
        </div>
      </AbsoluteFill>
    } />
  );
};

/** Сравнение: сначала одна сторона, потом другая, потом вывод. */
export const Сравнение: React.FC<Св> = ({ с }) => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const шаг = Math.max(ТАКТ, Math.floor((durationInFrames - 60) / 3));
  const колонка = (д: any, i: number) => {
    const от = 14 + i * шаг;
    const ст = въезд(frame, от, 7 + i, i);
    const активна = Math.min(1, Math.floor((frame - 14) / шаг)) === i;
    return (
      <div style={{
        ...ст, flex: активна ? 1.25 : 1, padding: "34px 32px", borderRadius: 28, minHeight: 520,
        background: активна ? `${i ? Т.акцент : Т.акцент2}18` : "rgba(255,255,255,0.03)",
        border: `1px solid ${активна ? (i ? Т.акцент : Т.акцент2) + "77" : Т.линия}`,
        display: "flex", flexDirection: "column", gap: 14, position: "relative", overflow: "hidden",
      }}>
        <div style={{ position: "absolute", right: -40, top: -30, opacity: активна ? 1 : 0.5 }}>
          <Предмет файл={"kadr/" + д.файл} размер={активна ? 300 : 220} сид={i + 21}
                   тон={i ? Т.акцент : Т.акцент2} от={от} />
        </div>
        <div style={{ fontFamily: Т.шапка, fontSize: 36, fontWeight: 700, color: Т.текст,
                      marginTop: 210 }}>{д.титул}</div>
        {д.строки.map((стр: string, j: number) => (
          <Строка key={j} текст={стр} номер={j} от={от + 12 + j * 9} сид={30 + i}
                  тон={i ? Т.акцент : Т.акцент2} />
        ))}
      </div>
    );
  };
  return (
    <Рама сид={7} тон={Т.акцент2} дети={
      <AbsoluteFill style={{ padding: `${Т.поле}px ${Т.поле}px 150px`, display: "flex",
                             flexDirection: "column" }}>
        <Шапка текст={с.заголовок} размер={62} от={0} сид={7} ширина={1200} />
        <div style={{ display: "flex", gap: 32, marginTop: 34, alignItems: "stretch" }}>
          {колонка(с.слева, 0)}
          {колонка(с.справа, 1)}
        </div>
      </AbsoluteFill>
    } />
  );
};

/** Разбор: графика живёт и ездит, строки приходят по одной на такт. */
export const Разбор: React.FC<Св> = ({ с }) => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const карта: any = {
    матрицы: <Матрицы подсветка={Math.min(2, Math.floor(frame / ТАКТ))} />,
    кроп: <КропКадр />,
    угол: <УголОбзора от={с.от ?? 10} до={с.до ?? 200} />,
    диафрагма: (
      <div style={{ display: "flex", gap: 36, alignItems: "center" }}>
        <Диафрагма размер={340} /><Глубина />
      </div>
    ),
    экспозиция: <Экспозиция />,
    выдержка: <Выдержка />,
    частота: <Частота />,
    таблица: <Таблица шапка={с.шапка || []} строки={с.таблица || []} />,
  };
  const строки = с.строки || [];
  const низ = с.графика === "диафрагма" || с.графика === "экспозиция" || с.графика === "частота";
  const текст = (
    <div style={{ maxWidth: низ ? 1500 : 760 }}>
      {с.надзаголовок ? (
        <div style={{ ...въезд(frame, 2, 13, 0), fontFamily: Т.корпус, fontSize: 24,
                      letterSpacing: "0.3em", color: Т.акцент2, marginBottom: 14 }}>
          {с.надзаголовок}
        </div>
      ) : null}
      <Шапка текст={с.заголовок} размер={низ ? 60 : 64} от={5} сид={13} ширина={низ ? 1400 : 760} />
      <div style={{ marginTop: 26 }}>
        {строки.map((стр: string, i: number) => {
          const шаг = Math.max(34, Math.floor((durationInFrames - 90) / Math.max(1, строки.length)));
          const от = 26 + i * шаг;
          const до = undefined;
          return <Строка key={i} текст={стр} номер={i} от={от} до={до} сид={13 + i}
                         тон={i % 2 ? Т.акцент2 : Т.акцент} />;
        })}
      </div>
    </div>
  );
  if (низ) {
    return (
      <Рама сид={9} дети={
        <AbsoluteFill style={{ padding: `${Т.поле}px ${Т.поле}px 140px`, display: "flex",
                               flexDirection: "column", justifyContent: "center", gap: 28 }}>
          {текст}
          <div style={{ display: "flex", justifyContent: "center" }}>
            <Ход сид={9} дети={карта[с.графика]} />
          </div>
        </AbsoluteFill>
      } />
    );
  }
  return (
    <Рама сид={11} дети={
      <AbsoluteFill style={{ padding: `${Т.поле}px ${Т.поле}px 150px`, display: "flex",
                             flexDirection: "row", alignItems: "center", gap: 48 }}>
        <div style={{ flex: "0 0 44%" }}>{текст}</div>
        <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <Ход сид={11} дети={карта[с.графика]} />
        </div>
      </AbsoluteFill>
    } />
  );
};

/** Задание: пункты выезжают по одному и остаются списком. */
export const Задание: React.FC<Св> = ({ с }) => {
  const frame = useCurrentFrame();
  return (
    <Рама сид={15} тон={Т.тёплый} дети={
      <AbsoluteFill style={{ padding: `${Т.поле}px`, display: "flex", flexDirection: "column",
                             justifyContent: "center" }}>
        <Шапка текст={с.заголовок} размер={72} от={0} сид={15} ширина={1000} />
        <div style={{ marginTop: 40, maxWidth: 1250 }}>
          {(с.строки || []).map((стр: string, i: number) => (
            <div key={i} style={{ ...въезд(frame, 20 + i * Math.round(ТАКТ * 0.8), 17, i),
                                  display: "flex", gap: 22, alignItems: "center",
                                  padding: "24px 30px", marginBottom: 16, borderRadius: 20,
                                  background: "rgba(255,255,255,0.045)",
                                  border: `1px solid ${Т.линия}` }}>
              <span style={{ fontFamily: Т.шапка, fontSize: 34, fontWeight: 800, color: Т.тёплый }}>
                {String(i + 1).padStart(2, "0")}
              </span>
              <span style={{ fontFamily: Т.корпус, fontSize: 34, color: Т.текст }}>{стр}</span>
            </div>
          ))}
        </div>
      </AbsoluteFill>
    } />
  );
};

/** Финал: предмет уезжает, остаётся итог. */
export const Финал: React.FC<Св> = ({ с }) => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const уход = interpolate(frame, [durationInFrames - 40, durationInFrames], [1, 1.14],
                           { extrapolateLeft: "clamp" });
  return (
    <Рама сид={19} дети={
      <AbsoluteFill style={{ padding: `${Т.поле}px`, display: "flex", flexDirection: "row",
                             alignItems: "center", gap: 40, scale: уход }}>
        <div style={{ flex: "0 0 52%" }}>
          <Шапка текст={с.заголовок} размер={78} от={2} сид={19} ширина={880} />
          <div style={{ marginTop: 28, display: "flex", flexWrap: "wrap", gap: 12 }}>
            {(с.строки || []).map((стр: string, i: number) => (
              <span key={i} style={{ ...въезд(frame, 24 + i * 12, 21, i),
                                     padding: "12px 22px", borderRadius: 999,
                                     border: `1px solid ${Т.акцент2}66`, background: `${Т.акцент2}18`,
                                     fontFamily: Т.корпус, fontSize: 26, color: Т.текст }}>{стр}</span>
            ))}
          </div>
        </div>
        <div style={{ flex: 1, display: "flex", justifyContent: "center" }}>
          <Предмет файл="kadr/u2_kamera.png" размер={620} сид={23} от={8} />
        </div>
      </AbsoluteFill>
    } />
  );
};
