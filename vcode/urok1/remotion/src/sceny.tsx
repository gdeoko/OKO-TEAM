import React from "react";
import { AbsoluteFill, Img, interpolate, spring, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { Кадр, Пилюля, ПоСловам, Т, Фон, вход, кадрПоСлову } from "./ui";

type Св = { с: any; слова: any[] };
const Поле: React.FC<{ children: React.ReactNode; низ?: boolean }> = ({ children, низ }) => (
  <AbsoluteFill style={{ padding: `${Т.поле}px ${Т.поле}px 170px`, display: "flex",
                         flexDirection: "column", justifyContent: низ ? "flex-end" : "center" }}>
    {children}
  </AbsoluteFill>
);

/** Титульная карточка урока. */
export const ТитулУрока: React.FC<Св> = ({ с }) => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();
  const s = spring({ frame, fps, config: { damping: 200, mass: 0.8 } });
  const линия = interpolate(frame, [12, 34], [0, 1], { extrapolateRight: "clamp" });
  return (
    <AbsoluteFill>
      <Фон />
      <AbsoluteFill style={{ alignItems: "center", justifyContent: "center" }}>
        <div style={{ textAlign: "center", maxWidth: 1500 }}>
          <div style={{ ...вход(frame, fps, 0, 18), fontFamily: Т.корпус, fontSize: 30,
                        letterSpacing: "0.34em", color: Т.акцент2, marginBottom: 26 }}>
            {с.номер || "УРОК 1"}
          </div>
          <div style={{ fontFamily: Т.шапка, fontSize: 104, fontWeight: 800, lineHeight: 1.03,
                        color: Т.текст, transform: `scale(${0.96 + s * 0.04})`, opacity: s,
                        letterSpacing: "-0.02em" }}>
            {с.титул}
          </div>
          <div style={{ height: 4, width: `${линия * 420}px`, margin: "40px auto 0",
                        background: `linear-gradient(90deg, ${Т.акцент}, ${Т.акцент2})`,
                        borderRadius: 4 }} />
          <div style={{ ...вход(frame, fps, 22, 16), fontFamily: Т.корпус, fontSize: 32,
                        color: Т.тихий, marginTop: 34 }}>
            {с.блок} · {с.курс}
          </div>
        </div>
      </AbsoluteFill>
      <AbsoluteFill style={{ opacity: interpolate(frame, [durationInFrames - 14, durationInFrames], [0, 1],
                                                  { extrapolateLeft: "clamp" }),
                             background: Т.фон }} />
    </AbsoluteFill>
  );
};

/** Кадр с фотографией и крупной мыслью. */
export const ФотоТезис: React.FC<Св> = ({ с, слова }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const естьЗаголовок = Boolean(с.заголовок);
  return (
    <AbsoluteFill>
      <Фон />
      <Кадр картинка={с.картинка} видео={с.видео} сторона={с.сторона || "право"} затемнение={0.16} />
      <Поле низ>
        {с.надзаголовок ? (
          <div style={{ ...вход(frame, fps, 0, 14), fontFamily: Т.корпус, fontSize: 26,
                        letterSpacing: "0.3em", color: Т.акцент2, marginBottom: 20 }}>
            {с.надзаголовок}
          </div>
        ) : null}
        {естьЗаголовок ? (
          <ПоСловам текст={с.заголовок} размер={92} задержка={4} максШирина={1150} />
        ) : null}
        {с.подпись ? (
          <div style={{ ...вход(frame, fps, 26, 18), fontFamily: Т.корпус, fontSize: 36,
                        color: "rgba(244,245,247,0.78)", marginTop: 26, maxWidth: 980 }}>
            {с.подпись}
          </div>
        ) : null}
      </Поле>
    </AbsoluteFill>
  );
};

/** Определение: слово крупно и три метки. */
export const Определение: React.FC<Св> = ({ с, слова }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  return (
    <AbsoluteFill>
      <Фон />
      <Поле>
        <div style={{ ...вход(frame, fps, 0, 14), fontFamily: Т.корпус, fontSize: 28,
                      letterSpacing: "0.3em", color: Т.акцент2, marginBottom: 24 }}>
          ОПРЕДЕЛЕНИЕ
        </div>
        <ПоСловам текст={с.заголовок} размер={120} шаг={3} максШирина={1500} />
        <div style={{ marginTop: 56, display: "flex", flexWrap: "wrap" }}>
          {(с.подписи || []).map((п: string, i: number) => (
            <Пилюля key={i} текст={п}
                    задержка={кадрПоСлову(слова, п, 40 + i * 26, fps)}
                    тон={i === (с.подписи || []).length - 1 ? Т.акцент : Т.тихий} />
          ))}
        </div>
      </Поле>
    </AbsoluteFill>
  );
};

/** Две колонки: было и стало. */
export const Против: React.FC<Св> = ({ с, слова }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const колонка = (данные: any, сдвиг: number, активная: boolean) => (
    <div style={{ flex: 1, padding: 44, borderRadius: 28,
                  border: `1px solid ${активная ? Т.акцент + "66" : Т.линия}`,
                  background: активная ? `${Т.акцент}14` : "rgba(255,255,255,0.03)",
                  ...вход(frame, fps, сдвиг, 26) }}>
      <div style={{ fontFamily: Т.шапка, fontSize: 40, fontWeight: 700,
                    color: активная ? Т.текст : Т.тихий, marginBottom: 30 }}>
        {данные.титул}
      </div>
      {данные.строки.map((стр: string, i: number) => (
        <div key={i} style={{ ...вход(frame, fps, сдвиг + 12 + i * 8, 14), display: "flex",
                              alignItems: "center", gap: 16, marginBottom: 22,
                              fontFamily: Т.корпус, fontSize: 34,
                              color: активная ? Т.текст : "rgba(244,245,247,0.6)" }}>
          <span style={{ width: 10, height: 10, borderRadius: 10,
                         background: активная ? Т.акцент : Т.тихий }} />
          {стр}
        </div>
      ))}
    </div>
  );
  return (
    <AbsoluteFill>
      <Фон />
      <Поле>
        <div style={{ ...вход(frame, fps, 0, 14), fontFamily: Т.шапка, fontSize: 56,
                      fontWeight: 800, color: Т.текст, marginBottom: 44 }}>
          Три рынка, и вы на третьем
        </div>
        <div style={{ display: "flex", gap: 40, alignItems: "stretch" }}>
          {колонка(с.слева, 10, false)}
          {колонка(с.справа, 30, true)}
        </div>
      </Поле>
    </AbsoluteFill>
  );
};

/** Цитата крупно. */
export const Цитата: React.FC<Св> = ({ с }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const линия = interpolate(frame, [20, 48], [0, 1], { extrapolateRight: "clamp" });
  return (
    <AbsoluteFill>
      <Фон тон={Т.акцент2} />
      <Поле>
        <div style={{ ...вход(frame, fps, 0, 10), fontFamily: Т.шапка, fontSize: 180,
                      color: `${Т.акцент}55`, lineHeight: 0.6, marginBottom: 18 }}>«</div>
        <ПоСловам текст={с.цитата} размер={96} шаг={2.6} максШирина={1500} />
        <div style={{ height: 4, width: `${линия * 620}px`, marginTop: 44,
                      background: `linear-gradient(90deg, ${Т.акцент}, transparent)` }} />
      </Поле>
    </AbsoluteFill>
  );
};

/** Крупное число, которое накручивается. */
export const Цифра: React.FC<Св> = ({ с, слова }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const s = spring({ frame: frame - 6, fps, config: { damping: 200, mass: 0.9 } });
  const числа = String(с.число).split("-").map((х) => parseInt(х, 10) || 0);
  const бегущее = числа.map((н) => Math.round(interpolate(s, [0, 1], [0, н]))).join("-");
  return (
    <AbsoluteFill>
      <Фон />
      <AbsoluteFill style={{ padding: `${Т.поле}px`, display: "flex", flexDirection: "row",
                             alignItems: "center", gap: 80 }}>
        <div style={{ flex: "0 0 52%" }}>
          <div style={{ ...вход(frame, fps, 0, 14), fontFamily: Т.корпус, fontSize: 30,
                        letterSpacing: "0.3em", color: Т.акцент2, marginBottom: 10 }}>
            {(с.подпись || "").toUpperCase()}
          </div>
          <div style={{ fontFamily: Т.шапка, fontSize: 230, fontWeight: 800, lineHeight: 1,
                        color: Т.текст, letterSpacing: "-0.04em", opacity: s,
                        textShadow: `0 0 90px ${Т.акцент}66` }}>
            {с.число === "0" ? "0" : бегущее}
          </div>
          <div style={{ ...вход(frame, fps, 18, 14), fontFamily: Т.корпус, fontSize: 40,
                        color: Т.тихий, marginTop: 6 }}>
            {с.валюта}
          </div>
        </div>
        <div style={{ flex: 1 }}>
          {(с.строки || []).map((стр: string, i: number) => (
            <div key={i} style={{ ...вход(frame, fps, кадрПоСлову(слова, стр, 34 + i * 22, fps), 24),
                                  display: "flex", gap: 20, alignItems: "flex-start",
                                  padding: "26px 30px", marginBottom: 18, borderRadius: 20,
                                  background: "rgba(255,255,255,0.04)",
                                  border: `1px solid ${Т.линия}`, fontFamily: Т.корпус,
                                  fontSize: 36, color: Т.текст }}>
              <span style={{ color: Т.акцент, fontWeight: 700 }}>{String(i + 1).padStart(2, "0")}</span>
              {стр}
            </div>
          ))}
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

/** Арифметика месяца строками с итогом. */
export const Счёт: React.FC<Св> = ({ с, слова }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  return (
    <AbsoluteFill>
      <Фон />
      <Поле>
        <ПоСловам текст={с.заголовок} размер={72} максШирина={1300} />
        <div style={{ marginTop: 50 }}>
          {(с.строки || []).map((пара: string[], i: number) => {
            const итог = i === (с.строки || []).length - 1;
            const зад = 24 + i * 26;
            return (
              <div key={i} style={{ ...вход(frame, fps, зад, 22), display: "flex",
                                    justifyContent: "space-between", alignItems: "center",
                                    padding: "30px 38px", marginBottom: 16, borderRadius: 22,
                                    background: итог ? `${Т.акцент}1F` : "rgba(255,255,255,0.035)",
                                    border: `1px solid ${итог ? Т.акцент + "66" : Т.линия}`,
                                    fontFamily: Т.корпус, fontSize: итог ? 46 : 38,
                                    color: Т.текст }}>
                <span style={{ color: итог ? Т.текст : "rgba(244,245,247,0.8)" }}>{пара[0]}</span>
                <span style={{ fontFamily: Т.шапка, fontWeight: 800,
                               fontSize: итог ? 60 : 44,
                               color: итог ? Т.акцент2 : Т.текст }}>{пара[1]}</span>
              </div>
            );
          })}
        </div>
      </Поле>
    </AbsoluteFill>
  );
};

/** Список с отметками: боль, итог, практика. */
export const Список: React.FC<Св & { вид: string }> = ({ с, слова, вид }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const тон = вид === "боль" ? "#FF6B6B" : вид === "практика" ? Т.акцент2 : Т.акцент;
  return (
    <AbsoluteFill>
      <Фон тон={вид === "боль" ? "#FF6B6B" : Т.акцент} />
      {с.картинка ? <Кадр картинка={с.картинка} видео={с.видео} сторона="право" затемнение={0.22} /> : null}
      <Поле>
        {с.заголовок ? <ПоСловам текст={с.заголовок} размер={78} максШирина={1150} /> : null}
        {!с.заголовок ? (
          <div style={{ ...вход(frame, fps, 0, 14), fontFamily: Т.корпус, fontSize: 30,
                        letterSpacing: "0.3em", color: тон, marginBottom: 18 }}>
            ЧТО У НЕГО БОЛИТ
          </div>
        ) : null}
        <div style={{ marginTop: 42, maxWidth: 1180 }}>
          {(с.строки || []).map((стр: string, i: number) => (
            <div key={i} style={{ ...вход(frame, fps, кадрПоСлову(слова, стр, 28 + i * 26, fps), 24),
                                  display: "flex", gap: 22, alignItems: "center",
                                  padding: "28px 34px", marginBottom: 18, borderRadius: 22,
                                  background: "rgba(255,255,255,0.04)",
                                  border: `1px solid ${Т.линия}`,
                                  fontFamily: Т.корпус, fontSize: 40, color: Т.текст }}>
              <span style={{ width: 14, height: 14, borderRadius: 14, background: тон,
                             boxShadow: `0 0 26px ${тон}` }} />
              {стр}
            </div>
          ))}
        </div>
      </Поле>
    </AbsoluteFill>
  );
};

/** Шаги по горизонтали с соединительной линией. */
export const Шаги: React.FC<Св> = ({ с, слова }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const шаги = с.шаги || [];
  return (
    <AbsoluteFill>
      <Фон />
      <Поле>
        <ПоСловам текст={с.заголовок} размер={74} максШирина={1300} />
        <div style={{ position: "relative", marginTop: 90, display: "flex", gap: 24 }}>
          <div style={{ position: "absolute", top: 46, left: 40, right: 40, height: 2,
                        background: Т.линия }} />
          <div style={{ position: "absolute", top: 46, left: 40, height: 2,
                        width: `${interpolate(frame, [20, 20 + шаги.length * 20], [0, 100],
                                { extrapolateRight: "clamp" })}%`,
                        maxWidth: "calc(100% - 80px)",
                        background: `linear-gradient(90deg, ${Т.акцент}, ${Т.акцент2})` }} />
          {шаги.map((ш: string, i: number) => {
            const зад = кадрПоСлову(слова, ш, 22 + i * 20, fps);
            const st = вход(frame, fps, зад, 20);
            return (
              <div key={i} style={{ flex: 1, textAlign: "center", ...st }}>
                <div style={{ width: 92, height: 92, borderRadius: 92, margin: "0 auto 26px",
                              display: "flex", alignItems: "center", justifyContent: "center",
                              background: Т.фон, border: `2px solid ${Т.акцент}`,
                              boxShadow: `0 0 40px ${Т.акцент}55`,
                              fontFamily: Т.шапка, fontSize: 38, fontWeight: 800, color: Т.текст }}>
                  {i + 1}
                </div>
                <div style={{ fontFamily: Т.корпус, fontSize: 32, color: Т.текст, lineHeight: 1.25 }}>
                  {ш}
                </div>
              </div>
            );
          })}
        </div>
      </Поле>
    </AbsoluteFill>
  );
};

/** Миф: зачёркнутая фраза и правда под ней. */
export const Миф: React.FC<Св> = ({ с, слова }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const черта = interpolate(frame, [26, 44], [0, 1], { extrapolateRight: "clamp" });
  return (
    <AbsoluteFill>
      <Фон />
      {с.картинка ? <Кадр картинка={с.картинка} видео={с.видео} сторона="право" затемнение={0.2} /> : null}
      <Поле>
        <div style={{ ...вход(frame, fps, 0, 16), display: "flex", alignItems: "center", gap: 20,
                      marginBottom: 30 }}>
          <span style={{ fontFamily: Т.шапка, fontSize: 30, fontWeight: 800, color: Т.фон,
                         background: "#FF6B6B", borderRadius: 10, padding: "8px 18px" }}>
            МИФ {с.номер}
          </span>
        </div>
        <div style={{ position: "relative", display: "inline-block", maxWidth: 1250 }}>
          <ПоСловам текст={`«${с.миф}»`} размер={86} шаг={2.4} цвет="rgba(244,245,247,0.62)" />
          <div style={{ position: "absolute", top: "52%", left: 0, height: 6,
                        width: `${черта * 100}%`, background: "#FF6B6B", borderRadius: 6,
                        boxShadow: "0 0 30px #FF6B6B99" }} />
        </div>
        <div style={{ ...вход(frame, fps, 48, 24), marginTop: 56, display: "flex",
                      alignItems: "center", gap: 22 }}>
          <span style={{ width: 54, height: 54, borderRadius: 54, background: Т.акцент,
                         display: "flex", alignItems: "center", justifyContent: "center",
                         fontSize: 30, color: Т.фон, fontWeight: 800 }}>✓</span>
          <span style={{ fontFamily: Т.шапка, fontSize: 56, fontWeight: 700, color: Т.текст }}>
            {с.правда}
          </span>
        </div>
      </Поле>
    </AbsoluteFill>
  );
};

/** Карта курса: пять блоков, первый подсвечен. */
export const Карта: React.FC<Св> = ({ с, слова }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  return (
    <AbsoluteFill>
      <Фон />
      <Поле>
        <ПоСловам текст={с.заголовок} размер={74} максШирина={1300} />
        <div style={{ display: "flex", gap: 20, marginTop: 70 }}>
          {(с.блоки || []).map((б: string, i: number) => {
            const зад = 22 + i * 18;
            const свой = i === 0;
            return (
              <div key={i} style={{ ...вход(frame, fps, зад, 26), flex: 1, padding: "34px 26px",
                                    borderRadius: 24, minHeight: 280,
                                    background: свой ? `${Т.акцент}1F` : "rgba(255,255,255,0.035)",
                                    border: `1px solid ${свой ? Т.акцент + "88" : Т.линия}`,
                                    display: "flex", flexDirection: "column", gap: 18 }}>
                <div style={{ fontFamily: Т.шапка, fontSize: 54, fontWeight: 800,
                              color: свой ? Т.акцент2 : Т.тихий }}>
                  {String(i + 1).padStart(2, "0")}
                </div>
                <div style={{ fontFamily: Т.корпус, fontSize: 34, color: Т.текст, lineHeight: 1.3 }}>
                  {б}
                </div>
                {свой ? (
                  <div style={{ marginTop: "auto", fontFamily: Т.корпус, fontSize: 26,
                                color: Т.акцент2 }}>вы здесь</div>
                ) : null}
              </div>
            );
          })}
        </div>
      </Поле>
    </AbsoluteFill>
  );
};

/** Финал: логотип, следующий урок. */
export const Финал: React.FC<Св> = ({ с }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const s = spring({ frame, fps, config: { damping: 200 } });
  return (
    <AbsoluteFill>
      <Фон />
      <AbsoluteFill style={{ alignItems: "center", justifyContent: "center" }}>
        <Img src={staticFile("logo.png")}
             style={{ width: 150, height: 150, opacity: s,
                      transform: `scale(${0.9 + s * 0.1})`,
                      filter: `drop-shadow(0 0 60px ${Т.акцент}88)` }} />
        <div style={{ ...вход(frame, fps, 16, 20), fontFamily: Т.шапка, fontSize: 64,
                      fontWeight: 800, color: Т.текст, marginTop: 44, textAlign: "center" }}>
          {с.заголовок}
        </div>
        <div style={{ ...вход(frame, fps, 30, 18), fontFamily: Т.корпус, fontSize: 36,
                      color: Т.акцент2, marginTop: 20 }}>
          {с.подпись}
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
