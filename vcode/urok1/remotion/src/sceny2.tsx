import React from "react";
import { AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import { Метка, Предмет, Сцена, Строка, Т, ходКамеры } from "./stage";
import { Глубина, Диафрагма, КропКадр, Матрицы, Таблица, УголОбзора, Частота, Экспозиция, Выдержка } from "./graf";

type Св = { с: any; слова: any[] };

/** Общая рамка: живой фон, лёгкий ход всей сцены, место под текст слева. */
const Рама: React.FC<{ children: React.ReactNode; тон?: string; сид?: number }> = ({
  children, тон = Т.акцент, сид = 1,
}) => {
  const frame = useCurrentFrame();
  const к = ходКамеры(frame, сид);
  return (
    <AbsoluteFill>
      <Сцена тон={тон} сид={сид} />
      <AbsoluteFill style={{
        transform: `translate(${к.x * 0.25}px, ${к.y * 0.25}px) rotate(${к.пов * 0.12}deg) scale(1.01)`,
      }}>
        {children}
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

const Текст: React.FC<{ с: any; задержка?: number }> = ({ с, задержка = 0 }) => {
  const frame = useCurrentFrame();
  return (
    <div style={{ maxWidth: 820 }}>
      {с.надзаголовок ? (
        <div style={{
          fontFamily: Т.корпус, fontSize: 25, letterSpacing: "0.3em", color: Т.акцент2,
          marginBottom: 18,
          opacity: interpolate(frame, [задержка, задержка + 10], [0, 1], { extrapolateRight: "clamp" }),
        }}>{с.надзаголовок}</div>
      ) : null}
      {с.заголовок ? <Строка текст={с.заголовок} размер={с.крупно ? 90 : 68} задержка={задержка + 4} ширина={820} /> : null}
      {с.строки ? (
        <div style={{ marginTop: 34 }}>
          {с.строки.map((стр: string, i: number) => {
            const п = задержка + 26 + i * 16;
            const д = interpolate(frame, [п, п + 14], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
            return (
              <div key={i} style={{
                display: "flex", gap: 16, alignItems: "flex-start", marginBottom: 16,
                opacity: д, transform: `translateX(${(1 - д) * -26}px)`,
                fontFamily: Т.корпус, fontSize: 32, color: Т.текст, lineHeight: 1.35,
              }}>
                <span style={{ marginTop: 12, width: 10, height: 10, borderRadius: 10,
                               background: Т.акцент, boxShadow: `0 0 14px ${Т.акцент}`, flex: "0 0 auto" }} />
                <span>{стр}</span>
              </div>
            );
          })}
        </div>
      ) : null}
      {с.метки ? (
        <div style={{ marginTop: 26, display: "flex", flexWrap: "wrap" }}>
          {с.метки.map((м: string, i: number) => (
            <Метка key={i} текст={м} задержка={задержка + 30 + i * 10}
                   тон={i % 2 ? Т.акцент2 : Т.акцент} />
          ))}
        </div>
      ) : null}
    </div>
  );
};

const Слева: React.FC<{ с: any; правое: React.ReactNode; тон?: string; сид?: number }> = ({
  с, правое, тон, сид,
}) => (
  <Рама тон={тон} сид={сид}>
    <AbsoluteFill style={{ display: "flex", flexDirection: "row", alignItems: "center",
                           padding: `${Т.поле}px ${Т.поле}px 150px`, gap: 56 }}>
      <div style={{ flex: "0 0 44%" }}><Текст с={с} /></div>
      <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center" }}>
        {правое}
      </div>
    </AbsoluteFill>
  </Рама>
);

/** Вступление: предмет летит в кадре, название урока собирается. */
export const Вступление: React.FC<Св> = ({ с }) => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const наезд = interpolate(frame, [0, durationInFrames], [1.14, 1.0]);
  return (
    <Рама тон={Т.акцент} сид={3}>
      <AbsoluteFill style={{ transform: `scale(${наезд})` }}>
        <Предмет файл={с.предмет || "kadr/u2_kamera.png"} размер={820} x={1000} y={130}
                 сид={2} поворот={22} />
      </AbsoluteFill>
      <AbsoluteFill style={{ padding: `${Т.поле}px`, display: "flex", flexDirection: "column",
                             justifyContent: "center" }}>
        <div style={{ fontFamily: Т.корпус, fontSize: 26, letterSpacing: "0.34em",
                      color: Т.акцент2, marginBottom: 20,
                      opacity: interpolate(frame, [0, 12], [0, 1], { extrapolateRight: "clamp" }) }}>
          {с.надзаголовок || "ЗАНЯТИЕ 1"}
        </div>
        <Строка текст={с.заголовок} размер={104} задержка={6} ширина={1000} />
        {с.строки ? (
          <div style={{ marginTop: 36 }}>
            {с.строки.map((стр: string, i: number) => (
              <Метка key={i} текст={стр} задержка={34 + i * 12} тон={i % 2 ? Т.акцент2 : Т.акцент} />
            ))}
          </div>
        ) : null}
      </AbsoluteFill>
    </Рама>
  );
};

/** Набор предметов: карточки оборудования, каждая со своим вырезом. */
export const Набор: React.FC<Св> = ({ с }) => {
  const frame = useCurrentFrame();
  const предметы = с.предметы || [];
  return (
    <Рама тон={Т.акцент} сид={5}>
      <AbsoluteFill style={{ padding: `${Т.поле}px ${Т.поле}px 150px`, display: "flex",
                             flexDirection: "column", justifyContent: "center" }}>
        <Строка текст={с.заголовок} размер={66} ширина={1300} />
        <div style={{ display: "flex", gap: 26, marginTop: 56 }}>
          {предметы.map((п: any, i: number) => {
            const зад = 18 + i * 14;
            const д = interpolate(frame, [зад, зад + 16], [0, 1],
                                  { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
            return (
              <div key={i} style={{
                flex: 1, height: 460, borderRadius: 26, position: "relative",
                background: "rgba(255,255,255,0.035)", border: `1px solid ${Т.линия}`,
                opacity: д, transform: `translateY(${(1 - д) * 40}px)`, overflow: "hidden",
              }}>
                <Предмет файл={"kadr/" + п.файл} размер={300} x={-20} y={10} сид={i + 1}
                         задержка={зад} тон={i % 2 ? Т.акцент2 : Т.акцент} />
                <div style={{ position: "absolute", left: 24, right: 20, bottom: 26 }}>
                  <div style={{ fontFamily: Т.шапка, fontSize: 30, fontWeight: 700, color: Т.текст }}>
                    {п.имя}
                  </div>
                  <div style={{ fontFamily: Т.корпус, fontSize: 24, color: Т.тихий, marginTop: 8,
                                lineHeight: 1.3 }}>{п.текст}</div>
                </div>
              </div>
            );
          })}
        </div>
      </AbsoluteFill>
    </Рама>
  );
};

/** Сравнение двух вариантов с предметами. */
export const Сравнение: React.FC<Св> = ({ с }) => {
  const frame = useCurrentFrame();
  const колонка = (д: any, i: number) => {
    const зад = 16 + i * 18;
    const появ = interpolate(frame, [зад, зад + 16], [0, 1],
                             { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
    return (
      <div key={i} style={{
        flex: 1, padding: "36px 34px 34px", borderRadius: 28, minHeight: 540, position: "relative",
        background: i ? `${Т.акцент}14` : "rgba(255,255,255,0.035)",
        border: `1px solid ${i ? Т.акцент + "66" : Т.линия}`,
        opacity: появ, transform: `translateY(${(1 - появ) * 36}px)`,
      }}>
        <Предмет файл={"kadr/" + д.файл} размер={260} x={240} y={-30} сид={i + 4} задержка={зад}
                 тон={i ? Т.акцент : Т.акцент2} />
        <div style={{ fontFamily: Т.шапка, fontSize: 38, fontWeight: 700, color: Т.текст,
                      marginTop: 200 }}>{д.титул}</div>
        <div style={{ marginTop: 22 }}>
          {д.строки.map((стр: string, j: number) => {
            const п = зад + 20 + j * 10;
            const dd = interpolate(frame, [п, п + 12], [0, 1],
                                   { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
            return (
              <div key={j} style={{ display: "flex", gap: 14, marginBottom: 16, opacity: dd,
                                    transform: `translateX(${(1 - dd) * -18}px)`,
                                    fontFamily: Т.корпус, fontSize: 28, color: Т.текст }}>
                <span style={{ color: i ? Т.акцент : Т.акцент2 }}>•</span>{стр}
              </div>
            );
          })}
        </div>
      </div>
    );
  };
  return (
    <Рама тон={Т.акцент2} сид={7}>
      <AbsoluteFill style={{ padding: `${Т.поле}px ${Т.поле}px 150px`, display: "flex",
                             flexDirection: "column", justifyContent: "center" }}>
        <Строка текст={с.заголовок} размер={64} ширина={1300} />
        <div style={{ display: "flex", gap: 36, marginTop: 44 }}>
          {колонка(с.слева, 0)}
          {колонка(с.справа, 1)}
        </div>
      </AbsoluteFill>
    </Рама>
  );
};

/** Разборы с живой графикой справа. */
export const Разбор: React.FC<Св> = ({ с }) => {
  const карта: any = {
    матрицы: <Матрицы подсветка={с.подсветка ?? -1} />,
    кроп: <КропКадр />,
    угол: <УголОбзора от={с.от ?? 10} до={с.до ?? 200} />,
    диафрагма: (
      <div style={{ display: "flex", gap: 36, alignItems: "center", position: "relative" }}>
        <Диафрагма размер={360} />
        <Глубина />
        <Предмет файл="kadr/u2_obyektiv.png" размер={330} x={760} y={-330} сид={8}
                 поворот={26} тон={Т.акцент2} />
      </div>
    ),
    экспозиция: <Экспозиция />,
    выдержка: <Выдержка />,
    частота: <Частота />,
    таблица: <Таблица шапка={с.шапка || []} строки={с.таблица || []} />,
  };
  const узкий = с.графика === "диафрагма" || с.графика === "экспозиция" || с.графика === "частота";
  if (узкий) {
    return (
      <Рама тон={Т.акцент} сид={9}>
        <AbsoluteFill style={{ padding: `${Т.поле}px ${Т.поле}px 150px`, display: "flex",
                               flexDirection: "column", justifyContent: "center", gap: 40 }}>
          <Текст с={с} />
          <div style={{ display: "flex", justifyContent: "center" }}>{карта[с.графика]}</div>
        </AbsoluteFill>
      </Рама>
    );
  }
  return <Слева с={с} правое={карта[с.графика]} тон={Т.акцент} сид={11} />;
};

/** Задание и финал. */
export const Задание: React.FC<Св> = ({ с }) => (
  <Рама тон={Т.тёплый} сид={13}>
    <AbsoluteFill style={{ padding: `${Т.поле}px`, display: "flex", flexDirection: "column",
                           justifyContent: "center" }}>
      <Текст с={с} />
    </AbsoluteFill>
  </Рама>
);

export const Финал: React.FC<Св> = ({ с }) => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const уход = interpolate(frame, [durationInFrames - 30, durationInFrames], [1, 1.12],
                           { extrapolateLeft: "clamp" });
  return (
    <Рама тон={Т.акцент} сид={17}>
      <AbsoluteFill style={{ transform: `scale(${уход})` }}>
        <Предмет файл="kadr/u2_kamera.png" размер={700} x={1080} y={200} сид={6} поворот={20} />
      </AbsoluteFill>
      <AbsoluteFill style={{ padding: `${Т.поле}px`, display: "flex", flexDirection: "column",
                             justifyContent: "center" }}>
        <Строка текст={с.заголовок} размер={82} ширина={900} />
        <div style={{ marginTop: 30 }}>
          {(с.строки || []).map((стр: string, i: number) => (
            <Метка key={i} текст={стр} задержка={24 + i * 12} тон={i % 2 ? Т.акцент2 : Т.акцент} />
          ))}
        </div>
      </AbsoluteFill>
    </Рама>
  );
};
