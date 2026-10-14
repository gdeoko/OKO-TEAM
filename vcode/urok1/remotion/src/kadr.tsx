import React from "react";
import {
  AbsoluteFill, Easing, Img, Loop, OffthreadVideo, interpolate, staticFile,
  useCurrentFrame, useVideoConfig,
} from "remotion";
import { Т } from "./dvizh";
import { Фон } from "./fon";
import { Глубина, Диафрагма, КропКадр, Матрицы, Таблица, УголОбзора, Частота, Экспозиция, Выдержка } from "./graf";
import {
  ЗвукУровень, КартаСкорость, Мягкость, НаборСхема, Направленность, Путь, Сравнение,
  СхемаСвета, Чеклист, Шум,
} from "./graf2";
import { Карточка, Карусель, Коридор, Куб, Орбита, Плиты, Предмет } from "./obyem";
import { ПОДАЧИ, ВЫХОД, РЕЗКО, Слова, Строка, знак, подача, сид, текстом } from "./tipo";

const ТОНА = [Т.акцент, Т.акцент2, Т.тёплый, "#FF5CA8"];
const ПОДАЧА_ПАРЫ = [ПОДАЧИ[2], ПОДАЧИ[3], ПОДАЧИ[6], ПОДАЧИ[0], ПОДАЧИ[4], ПОДАЧИ[8]];

type Короб = { x: number; y: number; w: number; h: number; центр?: boolean };

/**
 * Макеты кадра. Текст и картинка стоят в РАЗНЫХ коробах, которые не
 * пересекаются: надпись поверх фотографии читается как брак, а места в кадре
 * хватает на обоих. Больше половины макетов держат текст на центральной оси.
 */
export const МАКЕТЫ: Record<string, { текст?: Короб; медиа?: Короб }> = {
  центр:        { текст: { x: 230, y: 210, w: 1460, h: 660, центр: true } },
  центр_сверху: { медиа: { x: 380, y: 80, w: 1160, h: 470 },
                  текст: { x: 230, y: 600, w: 1460, h: 360, центр: true } },
  центр_снизу:  { текст: { x: 230, y: 110, w: 1460, h: 330, центр: true },
                  медиа: { x: 380, y: 480, w: 1160, h: 500 } },
  лево:         { текст: { x: 110, y: 180, w: 780, h: 720 },
                  медиа: { x: 950, y: 110, w: 870, h: 860 } },
  право:        { медиа: { x: 100, y: 110, w: 870, h: 860 },
                  текст: { x: 1030, y: 180, w: 780, h: 720 } },
  низ:          { медиа: { x: 40, y: 50, w: 1840, h: 610 },
                  текст: { x: 150, y: 715, w: 1620, h: 260, центр: true } },
  верх:         { текст: { x: 150, y: 110, w: 1620, h: 250 },
                  медиа: { x: 40, y: 410, w: 1840, h: 600 } },
  полный:       { медиа: { x: 0, y: 0, w: 1920, h: 1080 } },
};

/** Вход кадра: шесть приёмов, режиссёр не ставит один подряд. */
const вход_кадра = (вид: string, frame: number, з: number): React.CSSProperties => {
  const д = (к: number) => interpolate(frame, [0, к], [0, 1], { easing: РЕЗКО, extrapolateRight: "clamp" });
  switch (вид) {
    case "сдвиг": return { transform: `translateX(${(1 - д(6)) * 110 * з}px)` };
    case "наезд": return { transform: `scale(${1.12 - д(7) * 0.12})` };
    case "отъезд": return { transform: `scale(${0.9 + д(7) * 0.1})` };
    case "разворот": return { transform: `perspective(1600px) rotateY(${(1 - д(9)) * 22 * з}deg)` };
    case "штора": return { clipPath: `inset(0 ${(1 - д(8)) * 100}% 0 0)` };
    case "вверх": return { transform: `translateY(${(1 - д(6)) * 80}px)` };
    default: return { transform: `scale(${1.05 - д(5) * 0.05})` };
  }
};

/** Камера шота: ход небольшой, чтобы короба не выезжали за поля. */
const камера_шота = (вид: string, ход: number, з: number): React.CSSProperties => {
  switch (вид) {
    case "влево": return { transform: `translateX(${-ход * 34 * з}px) scale(1.02)` };
    case "вправо": return { transform: `translateX(${ход * 34 * з}px) scale(1.02)` };
    case "вверх": return { transform: `translateY(${-ход * 26}px) scale(1.03)` };
    case "вниз": return { transform: `translateY(${ход * 24}px) scale(1.03)` };
    case "вглубь": return { transform: `scale(${1 + ход * 0.07})` };
    case "назад": return { transform: `scale(${1.08 - ход * 0.07})` };
    case "облёт": return { transform: `perspective(1800px) rotateY(${(ход - 0.5) * 7 * з}deg) scale(1.03)` };
    default: return { transform: `rotate(${(ход - 0.5) * 1.2 * з}deg) scale(${1.02 + ход * 0.02})` };
  }
};

/** Кегль подбирается под короб: строка не вылезет и не повиснет мелочью. */
const под_короб = (знаков: number, к: Короб, п: any, макс: number) => {
  for (let s = макс; s > 30; s -= 2) {
    const в_строке = Math.max(1, Math.floor(к.w / (s * (п.ш || 0.62))));
    const строк = Math.ceil(Math.max(1, знаков) / в_строке);
    if (строк * s * п.межстрочный * 1.2 <= к.h) return s;
  }
  return 30;
};

const Короб: React.FC<{ к: Короб; стиль?: React.CSSProperties; дети: React.ReactNode }> = ({
  к, стиль, дети,
}) => (
  <div style={{ position: "absolute", left: к.x, top: к.y, width: к.w, height: к.h,
                display: "flex", alignItems: "center",
                justifyContent: к.центр ? "center" : "flex-start", ...стиль }}>
    {дети}
  </div>
);

/* ------------------------------ медиа ------------------------------ */

const ЕСТЕСТВЕННЫЕ: Record<string, [number, number]> = {
  матрицы: [570, 560], кроп: [900, 520], угол: [700, 560], диафрагма: [760, 470],
  экспозиция: [860, 470], выдержка: [860, 440], частота: [900, 420], таблица: [920, 430],
  набор: [860, 520], сравнение: [880, 420], звук: [860, 420], направленность: [840, 430],
  свет: [860, 470], мягкость: [820, 390], карта: [860, 360], чеклист: [780, 390],
  путь: [920, 270], шум: [760, 460], глубина: [860, 460],
};

const Графика: React.FC<{ вид: string; ш: any }> = ({ вид, ш }) => {
  const frame = useCurrentFrame();
  switch (вид) {
    case "матрицы": return <Матрицы подсветка={Math.floor(frame / 20) % 3} />;
    case "кроп": return <КропКадр />;
    case "угол": return <УголОбзора от={ш.от_граф ?? 10} до={ш.до_граф ?? 200} />;
    case "диафрагма": return <Диафрагма размер={420} />;
    case "глубина": return <Глубина />;
    case "экспозиция": return <Экспозиция />;
    case "выдержка": return <Выдержка />;
    case "частота": return <Частота />;
    case "таблица": return <Таблица шапка={ш.шапка || []} строки={ш.таблица || []} />;
    case "набор": return <НаборСхема />;
    case "сравнение": return <Сравнение />;
    case "звук": return <ЗвукУровень />;
    case "направленность": return <Направленность />;
    case "свет": return <СхемаСвета />;
    case "мягкость": return <Мягкость />;
    case "карта": return <КартаСкорость />;
    case "чеклист": return <Чеклист пункты={ш.пункты} />;
    case "путь": return <Путь />;
    case "шум": return <Шум />;
    default: return null;
  }
};

const Клип: React.FC<{ файл: string; радиус?: number }> = ({ файл, радиус = 0 }) => (
  <Loop durationInFrames={74}>
    <OffthreadVideo src={staticFile("kadr/" + файл)} muted
                    style={{ width: "100%", height: "100%", objectFit: "cover",
                             borderRadius: радиус }} />
  </Loop>
);

const Медиа: React.FC<{ ш: any; к: Короб; тон: string }> = ({ ш, к, тон }) => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const ход = interpolate(frame, [0, durationInFrames], [0, 1]);
  const з = знак(ш.id, "m");
  const вид = ш.медиа || "пусто";
  const бок = Math.min(к.w, к.h);

  if (вид === "пусто") return null;

  if (вид === "график") {
    const [нw, нh] = ЕСТЕСТВЕННЫЕ[ш.графика] || [880, 480];
    const масштаб = Math.min((к.w - 40) / нw, (к.h - 40) / нh, 1.65);
    return (
      <Короб к={к} стиль={{ justifyContent: "center" }} дети={
        <div style={{ transform: `scale(${масштаб * (1 + ход * 0.03)})` }}>
          <Графика вид={ш.графика} ш={ш} />
        </div>} />
    );
  }

  if (вид === "клип") {
    const полный = к.w > 1800 && к.h > 1000;
    const ш16 = Math.min(к.w, к.h * (16 / 9));
    const в16 = ш16 * (9 / 16);
    return (
      <Короб к={к} стиль={{ justifyContent: "center" }} дети={
        <div style={{ width: полный ? к.w : ш16, height: полный ? к.h : в16,
                      overflow: "hidden", borderRadius: полный ? 0 : 20,
                      border: полный ? "none" : `1px solid ${тон}66`,
                      boxShadow: полный ? "none" : `0 40px 90px rgba(0,0,0,0.6), 0 0 70px ${тон}22`,
                      transform: `perspective(1600px) rotateY(${полный ? 0 : з * (6 - ход * 10)}deg) scale(${1 + ход * 0.03})` }}>
          <Клип файл={ш.клип} />
        </div>} />
    );
  }

  if (вид === "карточка") {
    return (
      <Короб к={к} стиль={{ justifyContent: "center" }} дети={
        <Карточка ш={ш} тон={тон} файл={ш.ключ_арт || "u1_s18.jpg"}
                  ширина={Math.min(к.w - 20, (к.h - 20) * 1.6, 1180)}
                  высота={Math.min(к.h - 20, (к.w - 20) / 1.6, 740)} />} />
    );
  }

  if (вид === "вещи") {
    const вещи = (ш.набор || []).slice(0, 3);
    const размер = Math.min(бок * 0.86, (к.w - 60) / 3);
    return (
      <Короб к={к} стиль={{ justifyContent: "center", gap: 24 }} дети={<>
        {вещи.map((ф: string, i: number) => {
          const свой = i === Math.floor(ход * 3) % 3;
          return (
            <div key={i} style={{ opacity: свой ? 1 : 0.62,
                                  transform: `scale(${свой ? 1.08 : 0.9}) translateY(${свой ? -14 : 10}px)` }}>
              <Предмет файл={"kadr/m/" + ф} размер={размер} ш={ш} ключ={"v" + i}
                       тон={i % 2 ? Т.акцент2 : тон} />
            </div>
          );
        })}
      </>} />
    );
  }

  if (вид === "карусель") {
    const масштаб = Math.min(к.w / 1500, к.h / 560, 1);
    return (
      <Короб к={к} стиль={{ justifyContent: "center" }} дети={
        <div style={{ transform: `scale(${масштаб})` }}>
          <Карусель ш={ш} тон={тон} файлы={(ш.набор || []).slice(0, 5)} />
        </div>} />
    );
  }

  if (вид === "орбита") {
    const масштаб = Math.min(к.w / 900, к.h / 650, 1.35);
    return (
      <Короб к={к} стиль={{ justifyContent: "center" }} дети={
        <div style={{ transform: `scale(${масштаб})` }}>
          <Орбита ш={ш} тон={тон} файл={ш.вещь || "u2_kamera.png"}
                  метки={[ш.предмет?.имя || "", ш.ключ || ""]} />
        </div>} />
    );
  }

  if (вид === "плиты") {
    return (
      <div style={{ position: "absolute", left: к.x, top: к.y, width: к.w, height: к.h }}>
        <Плиты ш={ш} тон={тон} дети={
          <Предмет файл={"kadr/m/" + (ш.вещь || "u2_kamera.png")} размер={Math.min(бок * 0.5, 320)}
                   ш={ш} тон={тон} />} />
      </div>
    );
  }

  if (вид === "коридор") {
    return (
      <div style={{ position: "absolute", left: к.x, top: к.y, width: к.w, height: к.h,
                    overflow: "hidden" }}>
        <Коридор ш={ш} тон={тон} слово="" />
      </div>
    );
  }

  if (вид === "куб") {
    const грани = (ш.слова || []).map((с: any) => с.слово).slice(0, 6);
    return (
      <Короб к={к} стиль={{ justifyContent: "center" }} дети={
        <Куб ш={ш} тон={тон} грани={грани.length ? грани : [ш.ключ || ""]}
             ребро={Math.min(бок * 0.62, 420)} />} />
    );
  }

  // одна вещь крупно
  return (
    <Короб к={к} стиль={{ justifyContent: "center" }} дети={
      <div style={{ transform: `translateX(${з * ход * 22}px) rotate(${(ход - 0.5) * 4 * з}deg)` }}>
        <Предмет файл={"kadr/m/" + (ш.вещь || "u2_kamera.png")} размер={Math.min(бок * 0.98, 620)}
                 ш={ш} тон={тон} />
      </div>} />
  );
};

/* ------------------------------ текст ------------------------------ */

const Текст: React.FC<{ ш: any; к: Короб; тон: string }> = ({ ш, к, тон }) => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();
  const ход = interpolate(frame, [0, durationInFrames], [0, 1]);
  const п = подача(ш);
  const з = знак(ш.id, "t");
  const знаков = ш.знаков || (ш.текст || "").length;
  const вид = ш.текст_вид || "обычный";
  const слова = ш.слова || [];
  if (!слова.length) return null;

  const размер = под_короб(знаков, к, п, к.w > 1200 ? 118 : 86);

  switch (вид) {
    case "титр":
      return (
        <Короб к={к} стиль={{ flexDirection: "column", alignItems: к.центр ? "center" : "flex-start",
                              justifyContent: "center", gap: 22 }} дети={<>
          <Строка ш={{ ...ш, шрифт: 9 }} текст={(ш.надзаголовок || ш.заголовок || "").slice(0, 46)}
                  размер={24} цвет={Т.акцент2}
                  стиль={{ opacity: interpolate(frame, [0, 8], [0, 1], { extrapolateRight: "clamp" }) }} />
          <Слова ш={ш} размер={размер} ширина={к.w} центр={к.центр} />
          <div style={{ height: 5, width: `${interpolate(frame, [6, 26], [0, 46], { extrapolateRight: "clamp" })}%`,
                        background: `linear-gradient(90deg, ${тон}, ${Т.акцент2})`, borderRadius: 5 }} />
        </>} />
      );

    case "акцент": {
      const кл = ш.ключ || слова[0]?.слово || "";
      const кегль_ключа = Math.min(к.h * 0.46, (к.w / Math.max(4, кл.length)) * 1.55);
      return (
        <Короб к={к} стиль={{ flexDirection: "column", alignItems: к.центр ? "center" : "flex-start",
                              justifyContent: "center", gap: 18 }} дети={<>
          <Строка ш={ш} текст={кл} размер={кегль_ключа}
                  стиль={{ textShadow: `0 0 70px ${тон}66`,
                           scale: interpolate(frame, [0, 14], [1.22, 1], { easing: ВЫХОД, extrapolateRight: "clamp" }) }} />
          <Слова ш={ш} размер={Math.min(размер * 0.52, 44)} ширина={к.w} центр={к.центр}
                 цвет="rgba(244,245,247,0.82)" />
        </>} />
      );
    }

    case "цифра": {
      const ц = ш.цифра || "";
      const число = parseInt(ц.replace(/\D/g, ""), 10) || 0;
      const бег = Math.round(interpolate(frame, [0, 22], [0, число], { easing: ВЫХОД, extrapolateRight: "clamp" }));
      return (
        <Короб к={к} стиль={{ flexDirection: к.w > 1000 ? "row" : "column", gap: 44,
                              alignItems: "center", justifyContent: к.центр ? "center" : "flex-start" }} дети={<>
          <Строка ш={ш} текст={String(бег)} размер={Math.min(к.h * 0.62, 230)}
                  стиль={{ textShadow: `0 0 90px ${тон}77` }} />
          <Слова ш={ш} размер={Math.min(размер * 0.5, 46)} ширина={к.w * 0.5} />
        </>} />
      );
    }

    case "лесенка":
      return (
        <Короб к={к} стиль={{ flexDirection: "column", justifyContent: "center",
                              alignItems: к.центр ? "center" : "flex-start", gap: 2 }} дети={<>
          {слова.map((с: any, i: number) => {
            const t = frame / fps;
            const д = interpolate(t, [с.старт - 0.06, с.старт + 0.18], [0, 1],
                                  { easing: ВЫХОД, extrapolateLeft: "clamp", extrapolateRight: "clamp" });
            const кегль = Math.min(размер * 1.1, (к.h - 20) / Math.max(3, слова.length) / п.межстрочный);
            return (
              <div key={i} style={{ fontFamily: п.семья, fontWeight: п.вес, fontSize: кегль,
                                    letterSpacing: п.разрядка, lineHeight: п.межстрочный,
                                    color: i % 3 === 1 ? Т.акцент2 : Т.текст, opacity: д,
                                    marginLeft: к.центр ? 0 : Math.min(i, 4) * 48,
                                    transform: `translateX(${(1 - д) * (i % 2 ? 90 : -90)}px)` }}>
                {текстом(с.слово, п)}
              </div>
            );
          })}
        </>} />
      );

    case "обводка":
      return (
        <Короб к={к} стиль={{ flexWrap: "wrap", alignContent: "center",
                              justifyContent: к.центр ? "center" : "flex-start", gap: "4px 16px" }} дети={<>
          {слова.map((с: any, i: number) => {
            const t = frame / fps;
            const д = interpolate(t, [с.старт - 0.05, с.старт + 0.2], [0, 1],
                                  { easing: ВЫХОД, extrapolateLeft: "clamp", extrapolateRight: "clamp" });
            const пустое = i % 2 === 1;
            return (
              <span key={i} style={{
                fontFamily: п.семья, fontWeight: п.вес, fontSize: размер, letterSpacing: п.разрядка,
                lineHeight: п.межстрочный, display: "inline-block",
                color: пустое ? "transparent" : Т.текст,
                WebkitTextStroke: пустое ? `2px ${тон}` : "0px",
                opacity: д, transform: `translateY(${(1 - д) * 36}px)`,
              }}>{текстом(с.слово, п)}</span>
            );
          })}
        </>} />
      );

    case "вертикаль": {
      const кегль = Math.min(к.h * 0.52, (к.w / Math.max(2, слова.length)) * 1.1, 96);
      return (
        <Короб к={к} стиль={{ justifyContent: "center", gap: 26, alignItems: "center" }} дети={<>
          {слова.slice(0, 7).map((с: any, i: number) => {
            const t = frame / fps;
            const д = interpolate(t, [с.старт - 0.05, с.старт + 0.2], [0, 1],
                                  { easing: ВЫХОД, extrapolateLeft: "clamp", extrapolateRight: "clamp" });
            return (
              <div key={i} style={{ writingMode: "vertical-rl", fontFamily: п.семья, fontWeight: п.вес,
                                    fontSize: кегль, letterSpacing: "0.02em", opacity: д,
                                    color: i % 3 === 2 ? тон : Т.текст,
                                    transform: `translateY(${(1 - д) * (i % 2 ? 70 : -70)}px)` }}>
                {текстом(с.слово, п)}
              </div>
            );
          })}
        </>} />
      );
    }

    case "смесь":
      return (
        <Короб к={к} стиль={{ flexWrap: "wrap", alignContent: "center", alignItems: "baseline",
                              justifyContent: к.центр ? "center" : "flex-start", gap: "4px 16px" }} дети={<>
          {слова.map((с: any, i: number) => {
            const t = frame / fps;
            const д = interpolate(t, [с.старт - 0.05, с.старт + 0.2], [0, 1],
                                  { easing: ВЫХОД, extrapolateLeft: "clamp", extrapolateRight: "clamp" });
            const большой = с.слово.length > 5 && i % 3 === 0;
            const свой = ПОДАЧА_ПАРЫ[(ш.шрифт + i) % ПОДАЧА_ПАРЫ.length];
            return (
              <span key={i} style={{
                fontFamily: свой.семья, fontWeight: свой.вес,
                fontSize: большой ? размер : размер * 0.62, letterSpacing: свой.разрядка,
                color: большой ? Т.текст : "rgba(244,245,247,0.78)", opacity: д,
                transform: `translateY(${(1 - д) * 30}px)`,
                textShadow: большой ? `0 0 60px ${тон}55` : "none",
              }}>{текстом(с.слово, свой)}</span>
            );
          })}
        </>} />
      );

    case "диагональ":
      return (
        <Короб к={к} стиль={{ justifyContent: "center" }} дети={
          <div style={{ transform: `rotate(${-7 * з}deg)`, width: к.w * 0.92 }}>
            {слова.map((с: any, i: number) => {
              const t = frame / fps;
              const д = interpolate(t, [с.старт - 0.05, с.старт + 0.2], [0, 1],
                                    { easing: ВЫХОД, extrapolateLeft: "clamp", extrapolateRight: "clamp" });
              const кегль = Math.min(размер, (к.h - 40) / Math.max(3, слова.length) / п.межстрочный);
              return (
                <div key={i} style={{ fontFamily: п.семья, fontWeight: п.вес, fontSize: кегль,
                                      letterSpacing: п.разрядка, lineHeight: 1.04, opacity: д,
                                      color: i === 0 ? тон : Т.текст,
                                      marginLeft: (i % 4) * (к.w * 0.08),
                                      transform: `translateX(${(1 - д) * 90 * з}px)` }}>
                  {текстом(с.слово, п)}
                </div>
              );
            })}
          </div>} />
      );

    case "сетка": {
      const кол = к.w > 1100 ? (слова.length > 6 ? 3 : 2) : 2;
      const длинное = Math.max(...слова.map((с: any) => с.слово.length), 3);
      const кегль_ячейки = Math.min(размер * 0.62,
                                    (к.w / кол - 56) / (длинное * (п.ш || 0.62)),
                                    (к.h / Math.ceil(слова.length / кол)) * 0.5);
      return (
        <Короб к={к} стиль={{ display: "grid", gridTemplateColumns: `repeat(${кол}, 1fr)`, gap: 16,
                              alignContent: "center", width: к.w }} дети={<>
          {слова.slice(0, 9).map((с: any, i: number) => {
            const t = frame / fps;
            const д = interpolate(t, [с.старт - 0.05, с.старт + 0.22], [0, 1],
                                  { easing: ВЫХОД, extrapolateLeft: "clamp", extrapolateRight: "clamp" });
            return (
              <div key={i} style={{
                border: `1px solid ${i % 2 ? Т.акцент2 : тон}55`, borderRadius: 14, padding: "14px 18px",
                background: `linear-gradient(${40 + i * 40}deg, ${тон}1A, transparent)`,
                fontFamily: п.семья, fontWeight: п.вес, fontSize: кегль_ячейки,
                letterSpacing: п.разрядка, color: Т.текст, display: "flex",
                alignItems: "center", justifyContent: "center", opacity: д,
                transform: `perspective(900px) rotateX(${(1 - д) * -80}deg)`, transformOrigin: "50% 0%",
              }}>{текстом(с.слово, п)}</div>
            );
          })}
        </>} />
      );
    }

    case "лента": {
      const слово = (ш.ключ || слова[0]?.слово || "").toUpperCase();
      const лента = new Array(8).fill(слово).join("  •  ");
      return (
        <Короб к={к} стиль={{ flexDirection: "column", justifyContent: "center", gap: 26,
                              alignItems: "stretch" }} дети={<>
          <div style={{ overflow: "hidden", padding: "10px 0", background: `${тон}1A`,
                        borderTop: `1px solid ${тон}66`, borderBottom: `1px solid ${тон}66`,
                        transform: `rotate(${-2 * з}deg)` }}>
            <div style={{ whiteSpace: "nowrap", fontFamily: п.семья, fontWeight: п.вес,
                          fontSize: Math.min(размер * 0.8, 76), letterSpacing: "0.02em",
                          color: Т.текст, opacity: 0.92,
                          transform: `translateX(${-(frame * 7 * з) % 1600}px)` }}>{лента + "  " + лента}</div>
          </div>
          <Слова ш={ш} размер={Math.min(размер * 0.52, 52)} ширина={к.w} центр={к.центр}
                 цвет="rgba(244,245,247,0.9)" />
        </>} />
      );
    }

    case "маска": {
      const текст = слова.map((с: any) => с.слово).join(" ");
      const откр = interpolate(frame, [0, 14], [0, 100], { easing: РЕЗКО, extrapolateRight: "clamp" });
      return (
        <Короб к={к} стиль={{ justifyContent: "center" }} дети={
          <div style={{
            fontFamily: п.семья, fontWeight: п.вес, fontSize: размер, letterSpacing: п.разрядка,
            lineHeight: 1.04, textAlign: "center", maxWidth: к.w,
            backgroundImage: `url(${staticFile("kadr/m/" + (ш.ключ_арт || "u1_s18.jpg"))})`,
            backgroundSize: "150%", backgroundPosition: `${40 + ход * 20}% ${45 + ход * 10}%`,
            WebkitBackgroundClip: "text", backgroundClip: "text", color: "transparent",
            WebkitTextStroke: `2px ${тон}AA`, clipPath: `inset(0 ${100 - откр}% 0 0)`,
            filter: "brightness(2.4) contrast(1.35) saturate(1.3)",
          }}>{текстом(текст, п)}</div>} />
      );
    }

    default:
      return (
        <Короб к={к} стиль={{ justifyContent: к.центр ? "center" : "flex-start" }} дети={
          <Слова ш={ш} размер={размер} ширина={к.w} центр={к.центр} />} />
      );
  }
};

/** Рубрика кадра: нижний левый угол, в короба не лезет. */
const Метка: React.FC<{ ш: any; тон: string }> = ({ ш, тон }) => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const текст = (ш.заголовок || ш.надзаголовок || "").toUpperCase().slice(0, 42);
  if (!текст) return null;
  const д = interpolate(frame, [3, 14], [0, 1], { easing: ВЫХОД, extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const ход = interpolate(frame, [0, durationInFrames], [0, 1]);
  return (
    <div style={{ position: "absolute", left: 54, bottom: 42, display: "flex", alignItems: "center",
                  gap: 12, opacity: д * 0.72, transform: `translateX(${(1 - д) * -30}px)` }}>
      <span style={{ width: 40 + ход * 22, height: 2,
                     background: `linear-gradient(90deg, ${тон}, transparent)` }} />
      <span style={{ fontFamily: '"Inter", sans-serif', fontSize: 18, fontWeight: 600,
                     letterSpacing: "0.22em", color: "rgba(244,245,247,0.7)" }}>{текст}</span>
    </div>
  );
};

/** Рез: короткий росчерк на стыке шотов. Длится полсекунды и уходит. */
const Рез: React.FC<{ вид: string; тон: string; з: number }> = ({ вид, тон, з }) => {
  const frame = useCurrentFrame();
  if (!вид || вид === "нет" || frame > 14) return null;
  const д = interpolate(frame, [0, 12], [0, 1], { easing: РЕЗКО, extrapolateRight: "clamp" });
  if (вид === "вспышка") {
    return <AbsoluteFill style={{ background: `radial-gradient(60% 60% at 50% 50%, ${тон}66, transparent 70%)`,
                                  opacity: 1 - д, mixBlendMode: "screen" }} />;
  }
  if (вид === "штора") {
    return <AbsoluteFill style={{ background: `linear-gradient(${з > 0 ? 90 : 270}deg, ${тон}DD, ${тон}00)`,
                                  transform: `translateX(${д * 100 * з}%)`, opacity: 0.9 - д * 0.9 }} />;
  }
  if (вид === "полосы") {
    return (
      <AbsoluteFill style={{ opacity: 1 - д }}>
        {new Array(5).fill(0).map((_, i) => (
          <div key={i} style={{ position: "absolute", left: 0, right: 0, top: `${i * 20}%`, height: "20%",
                                background: i % 2 ? `${тон}55` : "transparent",
                                transform: `translateX(${(i % 2 ? 1 : -1) * д * 110}%)` }} />
        ))}
      </AbsoluteFill>
    );
  }
  // «блик»: световая полоса проходит кадр насквозь
  return (
    <AbsoluteFill style={{ mixBlendMode: "screen", opacity: 1 - д,
      background: `linear-gradient(${74 + з * 20}deg, transparent ${д * 100 - 18}%, rgba(255,255,255,0.5) ${д * 100 - 6}%, ${тон}88 ${д * 100}%, transparent ${д * 100 + 16}%)` }} />
  );
};

/** Один шот: фон, короб медиа, короб текста. Они не пересекаются никогда. */
export const Шот: React.FC<{ ш: any }> = ({ ш }) => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const ход = interpolate(frame, [0, durationInFrames], [0, 1]);
  const з = знак(ш.id, "k");
  const тон = ТОНА[(ш.тон ?? 0) % ТОНА.length];
  const макет = МАКЕТЫ[ш.макет] || МАКЕТЫ.центр;
  return (
    <AbsoluteFill>
      <Фон ш={ш} тон={тон} />
      <AbsoluteFill style={камера_шота(ш.камера || "дрейф", ход, з)}>
        <AbsoluteFill style={вход_кадра(ш.вход || "удар", frame, з)}>
          {макет.медиа ? <Медиа ш={ш} к={макет.медиа} тон={тон} /> : null}
          {макет.текст ? <Текст ш={ш} к={макет.текст} тон={тон} /> : null}
        </AbsoluteFill>
      </AbsoluteFill>
      <Рез вид={ш.рез} тон={тон} з={з} />
      <Метка ш={ш} тон={тон} />
    </AbsoluteFill>
  );
};
