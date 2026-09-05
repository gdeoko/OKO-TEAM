/* Rocket VPN. Шахта: светлый туман, разбитые кольца, снег - по igloo.inc.

   ЗАЧЕМ ПЕРЕПИСАНА СТЕНКА И КОЛЬЦА. Владелец: «тунелл никак не похож на
   igloo ... сделай 1:1 как там и движение камеры и модели туннеля и
   кольца тунелья и свет и туман и эффекты и освещение и визуальный фон и
   частицы и все 1:1 без малейшего изменения».

   Разбор снят с их живого сайта, кадры 012-016 лежат в /tmp/игло.
   Смотреть их надо целиком, потому что они опровергают сразу три вещи,
   которые здесь стояли раньше:

     · КАМЕННОЙ СТЕНЫ У НИХ НЕТ. Ни борозд от бура, ни зерна, ни
       затенения вглубь. На кадре 012 весь кадр это ровный светлый туман
       около #A8ACB4, и в нём висят кольца. Борозды были нашей
       отсебятиной, и они же делали из светлого тоннеля пещеру;
     · СВЕТ НАРАСТАЕТ ПО ХОДУ. Кадр 012 ровно серый; на 013 и 014
       внутренняя кромка ближнего кольца горит ослепительно белым; на
       015 весь кадр почти белый, а в середине белое ядро с искрами.
       Это не постоянная подсветка, а разгон от начала к концу;
     · КОЛЬЦО РАЗБИТО НА 6-8 ДУГ С ЯСНЫМИ ЗАЗОРАМИ. На кадре 012
       считается восемь дуг во внешнем кольце и шесть во внутреннем.
       Тридцать четыре мелких осколка, что стояли здесь, читались
       крошкой и превращали кольцо в зубчатую шестерёнку.

   ГАБАРИТ КОЛЬЦА ИЗМЕРЕН. `shattered_ring.drc` это 0.80 × 0.80 × 0.13,
   то есть радиус 0.4 при толщине 0.13 - треть радиуса. Замер бруса на
   кадре 012 даёт внутренний радиус в 0.75 внешнего. Обе их модели,
   `shattered_ring` и `shattered_ring2`, одного габарита и отличаются
   только рисунком разлома, поэтому и у нас два вида кольца одного
   размера: восемь дуг с узкой щелью и шесть с провалами.

   ИХ ЕДИНИЦЫ. Всё внутри собрано в ИХ масштабе: кольца на -1.65, -4.15,
   -6.65 с шагом 2.5. Наш мир крупнее, поэтому корень масштабируется, а
   шейдеры делят расстояние до камеры на тот же множитель (`uScale`) -
   иначе пороги разлёта, считанные в их единицах, сработали бы не там.

   ЧЕГО ЗДЕСЬ НЕТ. У них кольца это модели с картами цвета и затенения.
   Своих таких моделей у нас нет, и качать чужие нельзя. Кольцо
   собирается здесь же: дуга гнётся по окружности со скруглённым
   профилем, у каждой дуги своя середина (`centr`) и свой случайный
   набор (`rand`) - ровно те атрибуты, которых ждёт их шейдер. Их
   вершинный и фрагментный шейдер кольца перенесены дословно, цвет и
   затенение считаются вместо карт.

   API (его зовёт assets/rv-act-fold.js):
     RV_ТРУБА.собрать(мир, родитель) -> Group
     RV_ТРУБА.масштаб(k, вдоль) - множитель их единиц в наши
     RV_ТРУБА.кадр(доля, dt, часы, поворотВерха)
     RV_ТРУБА.видно(да) · RV_ТРУБА.узел() · RV_ТРУБА.замер() */
(function (g, d) {
  "use strict";

  var W = null, T = null;
  var М = {};
  var собрано = false;
  var _камЛок = null;

  var КОЛЕЦ = 3;            /* их число */
  var ШАГ = 2.5;            /* их шаг между кольцами */
  var ПЕРВОЕ = 1.65;        /* их высота первого кольца, вниз от нуля */
  var СНЕГА = 200;          /* их число точек снега */

  /* ДЛИНА ТУМАННОГО РУКАВА. Была девять, ровно по пути камеры, и на
     середине хода впереди оставалось меньше двух единиц: дальше
     открывался зал, и кадр показывал пустоту вместо тоннеля.
     Одиннадцать держат туман впереди до самого выхода. */
  var ДЛИНА = 11;
  /* ПОПЕРЕЧНИК РУКАВА. Раньше стенка шла в 1.42, то есть ВНУТРИ колец,
     и обрезала им внешний край. Кольца кончаются на двух единицах,
     значит туман обязан висеть дальше. */
  var РАДИУС = 3.4;

  /* Кольцо в их числах: 0.80 в поперечнике при толщине 0.13. В наших
     единицах те же пропорции - внутренний радиус в 0.75 внешнего,
     толщина в 0.325 внешнего радиуса. */
  var К_ВНЕШ = 2.00;
  var К_ВНУТР = 1.50;
  var К_ПОЛУТОЛЩ = 0.325;
  var ДУГ_ШИРОКИХ = 8;      /* их shattered_ring: восемь дуг, щель узкая */
  var ДУГ_РЕДКИХ = 6;       /* их shattered_ring2: шесть дуг с провалами */

  function зажать(v, a, b) { return v < a ? a : (v > b ? b : v); }
  function мягко(a, b, x) {
    var t = зажать((x - a) / (b - a), 0, 1);
    return t * t * (3 - 2 * t);
  }

  /* ── Общие куски GLSL, слово в слово их ────────────────────────
     falloff/falloffsmooth это их способ гасить по расстоянию: точка
     перехода едет от start к end по `progress`, ширина перехода
     `margin`. Без них пороги разлёта осколков не воспроизвести. */
  var ИХ_ФУНКЦИИ = [
    "float _linstep(float a, float b, float x){ return clamp((x - a) / (b - a), 0.0, 1.0); }",
    "float falloff(float x, float start, float end, float margin, float progress){",
    "  float m = margin * sign(end - start);",
    "  float p = mix(start - m, end, progress);",
    "  return _linstep(p + m, p, x);",
    "}",
    "float falloffsmooth(float x, float start, float end, float margin, float progress){",
    "  float m = margin * sign(end - start);",
    "  float p = mix(start - m, end, progress);",
    "  return smoothstep(p + m, p, x);",
    "}",
    "float fitl(float x, float a1, float a2, float b1, float b2){",
    "  float v = b1 + ((x - a1) * (b2 - b1)) / (a2 - a1);",
    "  return clamp(v, min(b1, b2), max(b1, b2));",
    "}",
    "vec2 rot2(vec2 v, float a){ float s = sin(a), c = cos(a); return mat2(c, s, -s, c) * v; }",
    "vec3 rot3(vec3 v, vec3 axis, float angle){",
    "  axis = normalize(axis);",
    "  float s = sin(angle), c = cos(angle), oc = 1.0 - c;",
    "  return vec3(",
    "    (oc * axis.x * axis.x + c)          * v.x + (oc * axis.x * axis.y - axis.z * s) * v.y + (oc * axis.z * axis.x + axis.y * s) * v.z,",
    "    (oc * axis.x * axis.y + axis.z * s) * v.x + (oc * axis.y * axis.y + c)          * v.y + (oc * axis.y * axis.z - axis.x * s) * v.z,",
    "    (oc * axis.z * axis.x - axis.y * s) * v.x + (oc * axis.y * axis.z + axis.x * s) * v.y + (oc * axis.z * axis.z + c)          * v.z);",
    "}",
    /* Их sinenoise1: шесть слоёв синусов на несоизмеримых частотах.
       Дешевле шумовой карты и не требует текстуры. */
    "float sinenoise1(vec3 p){",
    "  float val = 0.0;",
    "  val += sin(dot(p, vec3(1.5, 3.4598, 1.234)));",
    "  val += sin(dot(p, vec3(3.12, -3.234, 4.221)));",
    "  val += sin(dot(p, vec3(0.355, 2.3, -1.375)));",
    "  val += sin(dot(p, vec3(-0.156, -3.34, -0.4566)));",
    "  val += sin(dot(p, vec3(-4.1235, -0.485, -1.45)));",
    "  val += sin(dot(p, vec3(2.54, -0.879, -2.123)));",
    "  return val / 6.0;",
    "}",
    "float hash12(vec2 p){",
    "  vec3 p3 = fract(vec3(p.xyx) * 0.1031);",
    "  p3 += dot(p3, p3.yzx + 33.33);",
    "  return fract((p3.x + p3.y) * p3.z);",
    "}"
  ].join("\n");

  /* ══ ТУМАННЫЙ РУКАВ ══════════════════════════════════════════════
     ТО, ЧТО РАНЬШЕ БЫЛО КАМЕННОЙ СТЕНКОЙ. На кадрах 012-016 у igloo нет
     ни борозд, ни зерна, ни намёка на поверхность: тоннель это ровный
     светлый туман, в котором висят кольца. Стенка с бороздами делала из
     него пещеру, а владелец просил обратного.

     Что рукав обязан делать вместо стены. Первое - НЕ ПУСКАТЬ ЧЁРНОЕ:
     у igloo на всех 71 кадрах чёрного нет вовсе, самое тёмное место
     #6D7380, и наш тоннель должен быть светлее, а не темнее. Второе -
     НАБИРАТЬ СВЕТ ПО ГЛУБИНЕ: на кадре 012 туман ровно серый, на 015
     почти белый. Разгон идёт двумя слагаемыми - собственная глубина
     точки вдоль рукава (дальний конец всегда светлее ближнего) и общий
     ход `uSvet`, который растёт, пока человек летит.

     Цвет базы тот же экранный градиент #6a6f7d -> #e1e6f1, что у них
     во всём подземном объёме: так тоннель и зал за ним держат один
     свет. */
  var В_ТУМАН = [
    "varying vec2 vUv;",
    "varying vec3 vPos;",
    "void main(){",
    "  vUv = uv; vPos = position;",
    "  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);",
    "}"
  ].join("\n");

  var Ф_ТУМАН = [
    ИХ_ФУНКЦИИ,
    "uniform float uTime;",
    "uniform vec2 uRes;",
    "uniform vec3 uC1;",
    "uniform vec3 uC2;",
    "uniform float uAlpha;",
    "uniform float uSvet;",
    "uniform float uLen;",
    "varying vec2 vUv;",
    "varying vec3 vPos;",
    "void main(){",
    /* Их диагональный экранный градиент, слово в слово. */
    "  vec2 screenUv = gl_FragCoord.xy / uRes;",
    "  float ramp = (screenUv.x + screenUv.y) * 0.5;",
    "  ramp *= sinenoise1(vec3(screenUv, uTime * 0.614)) * 0.5 + 0.5;",
    "  ramp *= sinenoise1(vec3(screenUv * 2.0, uTime * 0.17)) * 0.5 + 0.5;",
    "  vec3 color = mix(uC1, uC2, clamp(ramp, 0.0, 1.0)) * 1.1;",
    /* Разгон света вглубь. Ось рукава идёт по местному минус Y, поэтому
       глубина это -vPos.y, приведённый к длине. Показатель 1.5 держит
       ближнюю половину ещё серой, а последнюю треть выбивает в белое -
       ровно так свет распределён между кадрами 012 и 015. */
    "  float glub = clamp(-vPos.y / uLen, 0.0, 1.0);",
    "  float razgon = pow(glub, 1.5) * (0.34 + 0.56 * uSvet);",
    "  color = mix(color, vec3(1.0), clamp(razgon, 0.0, 1.0));",
    /* И общий подъём по ходу: к концу тоннеля светлеет весь кадр, а не
       только его середина. Восемнадцать процентов - разница средней
       яркости между их кадрами 012 и 014. */
    "  color = mix(color, vec3(1.0), clamp(uSvet, 0.0, 1.0) * 0.18);",
    /* Медленные разводы: туман без них читается ровной заливкой. Взяты
       мягкими, три процента туда-сюда, чтобы не вернуть поверхность. */
    "  float dymka = sinenoise1(vec3(vUv * 4.0, vPos.y * 0.35 + uTime * 0.05)) * 0.5 + 0.5;",
    "  color *= mix(0.97, 1.03, dymka);",
    /* Последняя четверть рукава полупрозрачна. Туман не имеет дна: за
       ним стоит зал, и он обязан проступать заранее, а не открываться
       обрывом. Половина непрозрачности на самом конце - столько же
       света зала просвечивает у них на кадре 015. */
    "  float alpha = uAlpha * (1.0 - smoothstep(0.72, 1.0, glub) * 0.55);",
    "  gl_FragColor = vec4(color, alpha);",
    "}"
  ].join("\n");

  /* ══ БЕЛОЕ ЯДРО НА ВЫХОДЕ ════════════════════════════════════════
     Кадры 013, 014 и 015: в самой середине колец стоит белый сгусток с
     искрами, и он растёт от кадра к кадру, пока не заливает выход
     вспышкой. По разбору именно из него на следующем кадре собирается
     фигура в зале, так что переход идёт сквозь свет, а не склейкой.

     Держится отдельным диском в конце рукава: складывающий режим, без
     проверки глубины - сгусток обязан просвечивать сквозь дальние
     кольца, как у них. */
  var В_ЯДРО = [
    "varying vec2 vUv;",
    "void main(){",
    "  vUv = uv;",
    "  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);",
    "}"
  ].join("\n");

  var Ф_ЯДРО = [
    ИХ_ФУНКЦИИ,
    "uniform float uTime;",
    "uniform float uAlpha;",
    "uniform float uSvet;",
    "varying vec2 vUv;",
    "void main(){",
    "  float s = smoothstep(0.10, 1.0, clamp(uSvet, 0.0, 1.0));",
    "  float r = length(vUv - 0.5) * 2.0;",
    "  float core = pow(1.0 - clamp(r, 0.0, 1.0), 2.6);",
    /* Искры: сгусток на их кадрах зернистый, из отдельных белых точек, а
       не гладкое пятно. Сетка 90 на 90 и смена по времени дают ту же
       мерцающую крупу. */
    "  float iskra = hash12(floor(vUv * 90.0) + floor(uTime * 9.0));",
    "  iskra = smoothstep(0.74, 1.0, iskra) * (1.0 - smoothstep(0.20, 0.90, r));",
    "  float a = (core * 1.15 + iskra * 0.6) * s * uAlpha;",
    "  if (a < 0.004) discard;",
    "  gl_FragColor = vec4(vec3(1.0), clamp(a, 0.0, 1.0));",
    "}"
  ].join("\n");

  /* ══ ТРУБА ═══════════════════════════════════════════════════════
     Их шейдер дословно. Разница одна: карту ветра мы берём у луны, она
     там уже посчитана и лежит одна на весь сайт. */
  var В_ТРУБА = [
    "varying vec2 vUv;",
    "void main(){",
    "  vUv = uv;",
    "  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);",
    "}"
  ].join("\n");

  var Ф_ТРУБА = [
    "uniform sampler2D tWind;",
    "uniform float uTime;",
    "uniform float uAlpha;",
    "varying vec2 vUv;",
    "void main(){",
    "  vec2 uv = vUv * vec2(1.0, 0.25);",
    "  uv.x += uv.y;",
    "  float t = uTime * 0.05;",
    "  float value = texture2D(tWind, uv * 3.0 + vec2(-t, t * 0.7)).r;",
    "  value *= texture2D(tWind, uv * 4.0 + vec2(-t, t * 0.7)).r;",
    "  value *= texture2D(tWind, uv * 6.0 + vec2(-t, t * 0.7)).r;",
    "  float fade = smoothstep(0.0, 0.2, vUv.y) * smoothstep(1.0, 0.9, vUv.y);",
    "  value *= fade;",
    "  float alpha = pow(value, 3.0) * 3.0;",
    "  vec3 color = vec3(0.85, 0.9, 1.0);",
    "  gl_FragColor = vec4(color, clamp(alpha, 0.0, 1.0) * uAlpha);",
    "}"
  ].join("\n");

  /* ══ КОЛЬЦО ══════════════════════════════════════════════════════
     Вершинный шейдер их, до последнего слагаемого. Отличий два, и оба
     вынуждены масштабом: расстояние до камеры делится на uScale (их
     пороги считаны в их единицах), и `translation.y` берётся тоже в их
     единицах, иначе маска первого кольца ловила бы не то кольцо. */
  var В_КОЛЬЦО = [
    ИХ_ФУНКЦИИ,
    "attribute vec3 centr;",
    "attribute vec3 rand;",
    "uniform float uTime;",
    "uniform float uScale;",
    "uniform float uCamZ;",
    "varying vec2 vUv;",
    "varying vec3 vPos;",
    "varying vec3 vLocal;",
    "varying vec3 vRand;",
    "varying float vFalloff;",
    "varying float vFade;",
    "void main(){",
    "  vUv = uv;",
    "  vRand = rand;",
    "  vLocal = position;",
    "  vPos = (modelViewMatrix * vec4(position, 1.0)).xyz;",
    "  vec3 pos = position;",
    /* Середина кольца в мире и его высота в ИХ единицах. */
    "  vec3 translation = vec3(modelMatrix[3]);",
    "  float yIgloo = translation.y / uScale;",
    "  float firstRingMask = falloff(yIgloo, -1.66, -1.661, 0.01, 0.5);",
    "  float camFactor = 1.0 - (1.0 - clamp(uCamZ * 0.8, 0.0, 1.0));",
    "  float dist = distance(cameraPosition, translation) / uScale;",
    "  vFalloff = falloffsmooth(dist, 14.0, 2.0, 13.0, 0.75);",
    "  float glowFalloff = 1.0 - smoothstep(0.2, 0.4, 1.0 - vFalloff);",
    /* Осколок поворачивается вокруг своей середины. */
    "  vec3 scaledCentr = centr * 0.3;",
    "  vec3 axis = normalize(rand * 2.0 - 1.0);",
    "  float angle = 0.5 * smoothstep(1.5, 12.0, -vPos.z / uScale) + firstRingMask * camFactor * 0.5;",
    "  pos -= scaledCentr;",
    "  pos = rot3(pos, axis, angle);",
    "  pos += scaledCentr;",
    /* И разлетается наружу от середины кольца. */
    "  pos += centr * glowFalloff * mix(0.075, 0.15, rand.z);",
    "  pos += rand.y * centr * glowFalloff * sin(rand.x * 5.0 + uTime * 0.5 + (centr.x + centr.y + centr.z) * 15.0) * 0.05;",
    "  pos += centr * camFactor * 0.15 * firstRingMask;",
    /* И всё кольцо закручивается двумя разными оборотами. */
    "  float spinFalloff  = falloffsmooth(dist,  8.0, 2.0, 5.0, 0.5);",
    "  float spinFalloff2 = falloffsmooth(dist, 10.0, 2.0, 8.0, 0.5);",
    "  pos.xz = rot2(pos.xz, spinFalloff * 3.14159 * 0.3);",
    "  pos.xy = rot2(pos.xy, spinFalloff2 * 3.14159 * 0.3 + yIgloo * 0.25 + 1.5);",
    /* Проявление по мере подлёта. */
    "  vFade = min(1.0, falloffsmooth(dist, 2.0, 16.0, 9.0, 0.5));",
    "  gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);",
    "}"
  ].join("\n");

  /* Фрагментный: их же, только карты цвета и затенения заменены счётом.
     tMap у них это фотограмметрия камня; мы берём тот же диапазон серого
     и ломаем его шумом по местной координате осколка - на расстоянии,
     где кольцо и живёт, разница между картой и счётом не читается, а
     СПОСОБ смешивания с фоном сохранён дословно, и он тут главный. */
  var Ф_КОЛЬЦО = [
    ИХ_ФУНКЦИИ,
    "uniform float uTime;",
    "uniform vec2 uRes;",
    "uniform vec3 uColor1;",
    "uniform vec3 uColor2;",
    "uniform float uCamZ;",
    "uniform float uAlpha;",
    "uniform float uSvet;",
    "varying vec2 vUv;",
    "varying vec3 vPos;",
    "varying vec3 vLocal;",
    "varying vec3 vRand;",
    "varying float vFalloff;",
    "varying float vFade;",
    "void main(){",
    /* Камень: крупная слоистость плюс мелкое зерно. НИЖНИЙ КРАЙ ПОДНЯТ.
       Он стоял на #4c5262, и дуга у нижнего края читалась почти чёрной
       полосой; на их кадре 012 самая тёмная точка дуги около #8f98a4, а
       чёрного у igloo нет нигде вообще. Теперь диапазон от #707887 до
       #cfd6e4 - тот же светлый камень, что у них. */
    "  float sl = sinenoise1(vLocal * 6.0 + vRand * 3.0) * 0.5 + 0.5;",
    "  float zerno = hash12(vUv * 260.0 + vRand.xy * 40.0);",
    "  float kamen = mix(0.30, 0.82, sl) + (zerno - 0.5) * 0.10;",
    "  vec3 color = mix(vec3(0.44, 0.47, 0.53), vec3(0.81, 0.84, 0.895), kamen);",
    /* Экранный диагональный градиент - их фон подземелья. */
    "  vec2 screenUv = gl_FragCoord.xy / uRes;",
    "  float diagonalGradient = (screenUv.x + screenUv.y) * 0.5;",
    "  diagonalGradient *= sinenoise1(vec3(screenUv, uTime * 0.614)) * 0.5 + 0.5;",
    "  diagonalGradient *= sinenoise1(vec3(screenUv * 2.0, uTime * 0.17)) * 0.5 + 0.5;",
    "  vec3 bg = mix(uColor1, uColor2, clamp(diagonalGradient, 0.0, 1.0)) * 1.1;",
    "  color = mix(bg, color, vFade * 0.95);",
    /* Свечение из «карты затенения»: у них tGlow это запечённое
       затенение, светятся ЩЕЛИ между осколками. Считаем то же самое -
       край осколка светится, середина нет. */
    "  float falloffV = 1.0 - vFalloff;",
    "  float glowFalloff = smoothstep(0.2, 0.4, falloffV);",
    "  float n1 = sinenoise1(vLocal * 3.0 + uTime * 0.5 + kamen * 5.0) * 0.5 + 0.5;",
    "  n1 = n1 * 0.5 + 0.5;",
    /* СВЕТИТСЯ ВНУТРЕННЯЯ КРОМКА, А НЕ СЕРЕДИНА БРУСА. Раньше полоса
       шла по середине дуги (`1 - abs(vUv.y*2-1)`), и кольцо получало
       светлый поясок посередине. На кадрах 013 и 014 горит именно край
       со стороны просвета: там свет из глубины бьёт по кромке. Развёртка
       теперь идёт поперёк профиля, единица это внутренний край, поэтому
       достаточно взять её степенью. */
    "  float kraj = pow(smoothstep(0.30, 1.0, vUv.y), 2.0);",
    "  float camFactor = pow(1.0 - clamp(uCamZ, 0.0, 1.0), 4.0);",
    /* И кромка разгорается по ходу: у них кольца ближе к выходу горят
       заметно ярче первых. Ход добавляет к силе свечения ещё девять
       десятых сверх базовых пяти с половиной. */
    "  float sila = 0.55 + 0.9 * clamp(uSvet, 0.0, 1.0);",
    "  color += kraj * vec3(0.5, 0.7, 1.0) * n1 * glowFalloff * 0.8 * camFactor * sila;",
    "  gl_FragColor = vec4(color, uAlpha);",
    "}"
  ].join("\n");

  /* ══ ДЫМ У КОЛЬЦА (их plasma) ════════════════════════════════════ */
  var В_ДЫМ = [
    "varying vec2 vUv;",
    "varying float vRad;",
    "varying float vFalloff;",
    "uniform float uScale;",
    "uniform vec2 uRing2;",
    "void main(){",
    "  vUv = uv;",
    /* РАДИУС СЧИТАЕТСЯ ОТ МЕСТА, А НЕ ИЗ UV.
       У них дым это модель со своей развёрткой, где uv.x идёт поперёк
       кольца. У THREE.RingGeometry развёртка КВАДРАТНАЯ: uv.x это x
       вершины, приведённый к диаметру. Полоса, посчитанная по такому
       uv.x, легла поперёк всего кадра светлым лучом - на снимке шахты
       он шёл по диагонали через полэкрана. */
    "  vRad = (length(position.xy) - uRing2.x) / max(0.0001, uRing2.y - uRing2.x);",
    "  float depth = -(modelViewMatrix * vec4(position, 1.0)).z / uScale;",
    "  vFalloff = 1.0 - smoothstep(2.0, 4.0, depth);",
    "  vFalloff *= smoothstep(0.4, 1.0, depth);",
    "  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);",
    "}"
  ].join("\n");

  var Ф_ДЫМ = [
    "uniform sampler2D tWind;",
    "uniform float uTime;",
    "uniform float uAlpha;",
    "varying vec2 vUv;",
    "varying float vRad;",
    "varying float vFalloff;",
    "void main(){",
    "  vec2 uv = vec2(vRad, vUv.y) * vec2(0.25, 0.5);",
    "  uv.x += uv.y;",
    "  float t = -uTime * 0.075;",
    "  float wind = texture2D(tWind, uv * 3.0 + vec2(-t, t * 0.7)).r;",
    "  wind *= texture2D(tWind, uv * 4.0 + vec2(-t, t * 0.7)).r;",
    "  wind *= texture2D(tWind, uv * 6.0 + vec2(-t, t * 0.7)).r;",
    /* Полоса дыма идёт вдоль самого кольца: гаснет к внутреннему краю и
       к внешнему, ярче всего над камнем. */
    "  float fade = smoothstep(0.05, 0.35, vRad) * smoothstep(0.95, 0.65, vRad);",
    "  float value = wind * fade * vFalloff;",
    "  float alpha = min(1.0, pow(value * 2.75, 3.0));",
    "  gl_FragColor = vec4(vec3(0.85, 0.9, 1.0), alpha * uAlpha);",
    "}"
  ].join("\n");

  /* ══ СВЕТЯЩИЙСЯ ОБОДОК КОЛЬЦА (их ringforcefield) ════════════════
     Плоское кольцо, лежащее в плоскости камня. Рисунок их: решётка
     треугольников, размытая шумом, плюс радиальный набор яркости к
     краю. Складывающий режим и без проверки глубины - полоса светит
     сквозь камень, как у них. */
  var В_ОБОД = [
    "varying vec2 vUv;",
    "varying float vRad;",
    "varying float vBliz;",
    "uniform float uScale;",
    "uniform vec2 uRing2;",
    "void main(){",
    "  vUv = uv;",
    "  vRad = (length(position.xy) - uRing2.x) / max(0.0001, uRing2.y - uRing2.x);",
    "  vec4 mv = modelViewMatrix * vec4(position, 1.0);",
    /* Ободок разгорается ТОЛЬКО вблизи: у них это camFactor и glowFalloff.
       Дальние кольца обязаны оставаться камнем в тумане. */
    "  float dIgloo = length(mv.xyz) / uScale;",
    "  vBliz = 1.0 - smoothstep(2.0, 11.0, dIgloo);",
    "  gl_Position = projectionMatrix * mv;",
    "}"
  ].join("\n");

  var Ф_ОБОД = [
    ИХ_ФУНКЦИИ,
    "uniform float uTime;",
    "uniform float uAlpha;",
    "uniform float uSvet;",
    "varying vec2 vUv;",
    "varying float vRad;",
    "varying float vBliz;",
    "void main(){",
    "  float ug = atan(vUv.y - 0.5, vUv.x - 0.5);",
    /* Решётка треугольников: две косые волны, сложенные крест-накрест. */
    "  float n = sinenoise1(vec3(ug * 3.0, vRad * 4.0, uTime * 0.35)) * 0.5 + 0.5;",
    "  float t1 = abs(fract(ug * 9.0 + vRad * 3.0 + n * 0.6) - 0.5) * 2.0;",
    "  float t2 = abs(fract(ug * 9.0 - vRad * 3.0 - n * 0.6) - 0.5) * 2.0;",
    "  float setka = smoothstep(0.86, 1.0, max(t1, t2));",
    /* Радиальный набор к внешнему краю и мягкие концы полосы. */
    "  float kray = smoothstep(0.35, 1.0, vRad);",
    "  float konec = smoothstep(0.0, 0.16, vRad) * smoothstep(1.0, 0.82, vRad);",
    "  float a = (setka * 0.20 + kray * 0.42 + 0.26) * konec;",
    /* Ободок разгорается по ходу. На кадре 012 его почти не видно, на
       014 внутренняя кромка ближнего кольца выжжена в белое. Половина
       силы на входе и полторы на выходе дают тот же разгон. */
    "  a *= vBliz * uAlpha * (0.5 + 1.0 * clamp(uSvet, 0.0, 1.0));",
    "  if (a < 0.004) discard;",
    "  gl_FragColor = vec4(vec3(0.7, 0.8, 1.0), clamp(a, 0.0, 1.0));",
    "}"
  ].join("\n");

  /* ══ СНЕГ В ШАХТЕ (их snowparticles) ═════════════════════════════ */
  var В_СНЕГ = [
    ИХ_ФУНКЦИИ,
    "attribute vec3 random;",
    "uniform float uTime;",
    "uniform float uScale;",
    "uniform vec2 uRes;",
    "varying vec3 vRandom;",
    "varying float vAngle;",
    "varying float vAlpha;",
    /* Их treadmill: точка, ушедшая за коробку, возвращается с другой
       стороны. Так двести точек хватает на всю шахту. */
    "vec3 treadmill(vec3 p, vec3 box){",
    "  return mod(p + box * 0.5, box) - box * 0.5;",
    "}",
    "void main(){",
    "  vRandom = random;",
    "  vAngle = random.y * 3.14 * 2.0 + mix(0.5, 0.2, random.x);",
    "  vAngle -= uTime * mix(0.5, 1.0, random.x * 1.3);",
    "  vec3 pos = position;",
    "  float t = uTime * mix(0.2, 1.0, random.x);",
    "  pos.y -= mix(0.4, 0.7, fract(random.x + random.z + random.y)) * uTime;",
    "  float angle = t * 0.5 + pos.y;",
    "  pos.x += sin(angle) * 0.4;",
    "  pos.z += cos(angle) * 0.4;",
    "  pos.xz = rot2(pos.xz, t * 0.5);",
    "  pos = treadmill(pos, vec3(3.0, 4.0, 3.0));",
    "  vec3 world = (modelMatrix * vec4(pos, 1.0)).xyz;",
    "  vec4 mvPos = modelViewMatrix * vec4(pos, 1.0);",
    "  float yIgloo = world.y / uScale;",
    "  float dIgloo = -mvPos.z / uScale;",
    "  vAlpha = 1.0;",
    "  vAlpha *= smoothstep(8.0, 0.0, -yIgloo);",
    "  vAlpha *= smoothstep(0.0, 2.0, -yIgloo);",
    "  vAlpha *= 1.0 - min(1.0, length(pos.xz) * 0.5);",
    "  vAlpha *= smoothstep(0.5, 1.0, dIgloo);",
    "  vAlpha *= smoothstep(0.0, 2.0, dIgloo);",
    "  vAlpha *= sin(uTime + random.x + random.z * 13.0) * 0.5 + 0.5;",
    "  vAlpha *= 0.3;",
    "  gl_Position = projectionMatrix * mvPos;",
    "  gl_PointSize = 50.0 * uScale / length(mvPos.xyz) * (uRes.y / 1300.0);",
    "}"
  ].join("\n");

  var Ф_СНЕГ = [
    ИХ_ФУНКЦИИ,
    "uniform float uAlpha;",
    "varying vec3 vRandom;",
    "varying float vAngle;",
    "varying float vAlpha;",
    "void main(){",
    "  vec2 uv = gl_PointCoord.xy;",
    "  float alpha = vAlpha;",
    "  alpha *= 1.0 - length(uv - 0.5) * 2.0;",
    "  uv -= 0.5;",
    "  uv = rot2(uv, vAngle);",
    "  uv += 0.5;",
    /* Сжатие вдоль оси поворота: точка становится чёрточкой, и снег
       читается движением, а не крошкой. */
    "  alpha *= pow(1.0 - abs(uv.x - 0.5), floor(vRandom.y * 3.0 + 2.0));",
    "  alpha = clamp(alpha, 0.0, 1.0) * uAlpha;",
    "  if (alpha < 0.004) discard;",
    "  gl_FragColor = vec4(vec3(1.0), alpha);",
    "}"
  ].join("\n");

  /* ── Разбитое кольцо: 6-8 дуг с зазорами ──────────────────────
     У них это модель. Здесь дуга гнётся по окружности, у каждой свои
     `centr` и `rand` - те самые атрибуты, на которых держится весь их
     разлёт.

     ШЕСТЬ-ВОСЕМЬ ДУГ, А НЕ ТРИДЦАТЬ ЧЕТЫРЕ ОСКОЛКА. На кадре 012 у
     igloo внешнее кольцо считается по дугам: восемь длинных кусков с
     узкими зазорами. Внутреннее - шесть кусков, между ними провалы
     шириной с треть дуги. Здесь стояло одиннадцать и восемь кусков при
     старых, вдвое более широких брусьях, и кольцо читалось крошкой:
     мелкие одинаковые зубчики по окружности вместо разлома. */
  /* ПЛОСКОСТЬ КОЛЬЦА - XY, А НЕ XZ.

     Их модель `shattered_ring.drc` лежит в плоскости XY (кольцо смотрит
     в плюс Z), и меш потом кладут плашмя поворотом на минус девяносто по
     X. Первый заход строил кольцо сразу плашмя, в XZ, и поворот меша
     ставил его НА РЕБРО: на снимке шахты вместо колец стояли огромные
     белые плиты поперёк кадра.

     Вторая причина держать XY - их же шейдер. Он крутит осколок внутри
     плоскости кольца строкой `pos.xy = rotate(pos.xy, ...)`, и там есть
     постоянное слагаемое 1.5 радиана, работающее всегда. В плоскости XZ
     этот поворот уводил бы осколки из кольца вбок. */
  /* ДВА ВИДА КОЛЬЦА ОДНОГО ГАБАРИТА. Здесь виды отличались размером:
     толстый тор 2.30 в радиусе и вдвое меньшее кольцо 1.34. Замер их
     файлов это опровергает - `shattered_ring.drc` и `shattered_ring2.drc`
     оба 0.80 × 0.80 × 0.13, то есть один размер до сотой. Отличаются они
     ТОЛЬКО рисунком разлома, и на кадре 012 это видно: два кольца в
     кадре одного поперечника, у ближнего восемь дуг, у дальнего шесть.
     Разные размеры давали в кадре мигание кольца туда-сюда. */
  /* СКРУГЛЁННЫЙ ПРОФИЛЬ ВМЕСТО КОРОБКИ. Брус был коробкой из четырёх
     граней, и на кадре он разваливался на четыре ровные заливки. У них
     вдоль дуги идёт длинный мягкий блик (кадры 012 и 014), а такой блик
     даёт только скруглённое сечение. Восьмиугольник по эллипсу стоит
     дёшево и читается круглым. */
  function профильДуги() {
    var т = [];
    for (var i = 0; i < 8; i++) {
      var a = (i + 0.5) / 8 * Math.PI * 2;
      т.push([Math.cos(a), Math.sin(a)]);
    }
    return т;
  }

  function кольцоГеометрия(T, вид) {
    var широкий = вид === 0;
    var штук = широкий ? ДУГ_ШИРОКИХ : ДУГ_РЕДКИХ;
    /* Делений вдоль дуги. На слабой ступени их меньше: дуга длинная, и
       семь делений это семь восьмиугольных колец точек на кусок. Свет
       от этого не меняется, а владелец отдельно просил не темнить
       телефон в обмен на скорость. */
    var сегм = (W && W.ступень === 0) ? 4 : 7;
    var поз = [], нор = [], уф = [], цен = [], рнд = [], инд = [];
    var шагУгла = Math.PI * 2 / штук;
    var база = 0;
    var П = профильДуги();
    /* Развёртка поперёк профиля: ноль на внешнем краю бруса, единица на
       внутреннем. По ней в шейдере горит кромка со стороны просвета -
       ровно та, что выжжена в белое на их кадрах 013 и 014. */
    var вПроф = [];
    for (var j = 0; j < 8; j++) вПроф.push(0.5 - 0.5 * (П[j][0] / 0.92388));

    for (var к = 0; к < штук; к++) {
      /* Своё зерно на дугу: ширина зазора, перекос, случайный набор.
         Смещение на вид разводит два кольца - иначе оба ломались бы в
         одних и тех же местах, и разлом читался бы повтором. */
      var s1 = псевдо(к * 1.13 + 0.7 + вид * 17.3);
      var s2 = псевдо(к * 2.71 + 3.1 + вид * 17.3);
      var s3 = псевдо(к * 5.37 + 9.4 + вид * 17.3);
      /* Зазор в долях шага по углу. У восьмидуговой сборки узкий, куски
         почти смыкаются; у шестидуговой провал в треть-половину дуги -
         на кадре 012 сквозь него насквозь виден туман. */
      var щель = широкий ? (0.10 + 0.12 * s1) : (0.34 + 0.24 * s1);
      var у0 = к * шагУгла + щель * шагУгла * 0.5;
      var у1 = (к + 1) * шагУгла - щель * шагУгла * 0.5;
      /* Середина бруса и его полуразмеры. Разброс мелкий: дуги обязаны
         читаться кусками ОДНОГО кольца, а не набором разных колец. */
      var rЦ = (К_ВНУТР + К_ВНЕШ) * 0.5 + (s2 - 0.5) * 0.09;
      var пШ = (К_ВНЕШ - К_ВНУТР) * 0.5 * (0.86 + 0.28 * s3);
      var пТ = К_ПОЛУТОЛЩ * (0.80 + 0.40 * s1);
      var цx = Math.cos((у0 + у1) * 0.5) * rЦ;
      var цy = Math.sin((у0 + у1) * 0.5) * rЦ;

      /* Кольца точек вдоль дуги: восьмиугольник в каждом делении. */
      var ряды = [];
      for (var i = 0; i <= сегм; i++) {
        var у = у0 + (у1 - у0) * (i / сегм);
        /* Излом по дуге: край куска не гладкий. */
        var изл = (псевдо(к * 7.7 + i * 3.3 + вид * 5.1) - 0.5) * 0.05;
        var ко = Math.cos(у), си = Math.sin(у);
        var ряд = [];
        for (j = 0; j < 8; j++) {
          /* Кольцо в плоскости XY, толщина по Z. */
          var r = rЦ + изл + П[j][0] * пШ;
          ряд.push([ко * r, си * r, П[j][1] * пТ]);
        }
        ряды.push(ряд);
      }

      /* Боковая поверхность: восемь полос вдоль дуги. */
      for (i = 0; i < сегм; i++) {
        var u0 = i / сегм, u1 = (i + 1) / сегм;
        for (j = 0; j < 8; j++) {
          var j2 = (j + 1) % 8;
          полоса(ряды[i][j], ряды[i][j2], ряды[i + 1][j2], ряды[i + 1][j],
                 u0, u1, вПроф[j], вПроф[j2]);
        }
      }
      /* Торцы разлома. Свежий скол у них светлее самой дуги, и он такой
         же участник свечения кромки, поэтому развёртка на нём та же. */
      крышка(ряды[0], 0, true);
      крышка(ряды[сегм], 1, false);

      function точка(p, u, v, н) {
        поз.push(p[0], p[1], p[2]);
        нор.push(н[0], н[1], н[2]);
        уф.push(u, v);
        цен.push(цx, цy, 0);
        рнд.push(s1, s2, s3);
      }

      function полоса(a, b, c2, d2, u0, u1, v0, v1) {
        var н = нормаль(a, b, c2);
        точка(a, u0, v0, н); точка(b, u0, v1, н);
        точка(c2, u1, v1, н); точка(d2, u1, v0, н);
        инд.push(база, база + 1, база + 2, база, база + 2, база + 3);
        база += 4;
      }

      function крышка(ряд, u, наружу) {
        var цx2 = 0, цy2 = 0, цz2 = 0;
        for (var т = 0; т < 8; т++) { цx2 += ряд[т][0]; цy2 += ряд[т][1]; цz2 += ряд[т][2]; }
        var ц = [цx2 / 8, цy2 / 8, цz2 / 8];
        for (т = 0; т < 8; т++) {
          var a = ряд[наружу ? (т + 1) % 8 : т];
          var b = ряд[наружу ? т : (т + 1) % 8];
          var н = нормаль(ц, a, b);
          точка(ц, u, 0.5, н); точка(a, u, вПроф[наружу ? (т + 1) % 8 : т], н);
          точка(b, u, вПроф[наружу ? т : (т + 1) % 8], н);
          инд.push(база, база + 1, база + 2);
          база += 3;
        }
      }
    }

    var гео = new T.BufferGeometry();
    гео.setAttribute("position", new T.Float32BufferAttribute(поз, 3));
    гео.setAttribute("normal", new T.Float32BufferAttribute(нор, 3));
    гео.setAttribute("uv", new T.Float32BufferAttribute(уф, 2));
    гео.setAttribute("centr", new T.Float32BufferAttribute(цен, 3));
    гео.setAttribute("rand", new T.Float32BufferAttribute(рнд, 3));
    гео.setIndex(инд);
    return гео;
  }

  function нормаль(a, b, c) {
    var ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2];
    var vx = c[0] - a[0], vy = c[1] - a[1], vz = c[2] - a[2];
    var nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
    var l = Math.sqrt(nx * nx + ny * ny + nz * nz) || 1;
    return [nx / l, ny / l, nz / l];
  }

  /* Без Math.random: осколки обязаны быть одними и теми же при каждой
     загрузке, иначе снимки не сравнить между собой. */
  function псевдо(x) {
    var s = Math.sin(x * 127.1 + 311.7) * 43758.5453;
    return s - Math.floor(s);
  }

  function ветер() {
    if (g.RV_ЛУНА && g.RV_ЛУНА["шум"]) {
      var ш = g.RV_ЛУНА["шум"]();
      if (ш) return ш;
    }
    return null;
  }

  function собрать(мир, родитель) {
    if (собрано) return М.корень;
    W = мир || W;
    if (!W || !W.T) return null;
    T = W.T;

    М.корень = new T.Group();
    М.корень.name = "шахта";
    М.корень.visible = false;
    _камЛок = new T.Vector3();
    М.uTime = { value: 0 };
    М.uScale = { value: 1 };
    М.uRes = { value: new T.Vector2(g.innerWidth || 1, g.innerHeight || 1) };
    М.uCamZ = { value: 0 };
    М.uАльфаТруба = { value: 1 };
    М.uАльфаКольцо = { value: 1 };
    М.uАльфаДым = { value: 1 };
    М.uАльфаОбод = { value: 1 };
    М.uАльфаСнег = { value: 1 };
    М.uСвет = { value: 0 };
    М.кольца = [];
    М.дымы = [];
    М.ободы = [];

    var ветр = ветер();

    /* ── Туманный рукав вместо каменной стенки ─────────────────
       Радиус 3.4 при кольцах в 2.0: туман обязан висеть ЗА кольцами.
       Пока стенка шла в 1.42, она резала кольцам внешний край, и на
       кадре у дуг были обрублены концы.

       Длина 11 при пути в 9: конец рукава всегда впереди камеры, и
       выход не открывается раньше времени. */
    var гТуман = new T.CylinderGeometry(РАДИУС, РАДИУС, ДЛИНА, 48, 16, true);
    гТуман.translate(0, -ДЛИНА * 0.5, 0);
    гТуман.scale(-1, 1, 1);
    М.мСтенка = new T.ShaderMaterial({
      uniforms: {
        uTime: М.uTime, uRes: М.uRes, uAlpha: М.uАльфаТруба, uSvet: М.uСвет,
        uLen: { value: ДЛИНА },
        uC1: { value: new T.Color(0x6a6f7d) },
        uC2: { value: new T.Color(0xe1e6f1) }
      },
      vertexShader: В_ТУМАН, fragmentShader: Ф_ТУМАН,
      transparent: true, depthWrite: true, side: T.FrontSide, fog: false
    });
    М.стенка = new T.Mesh(гТуман, М.мСтенка);
    М.стенка.name = "туман шахты";
    М.стенка.position.y = 1;
    М.стенка.renderOrder = 0;
    М.стенка.frustumCulled = false;
    М.корень.add(М.стенка);

    /* ── Дымные струи по рукаву: их цилиндр, вывернутый внутрь ──
       Их шейдер оставлен как был, но цилиндр теперь идёт по новому
       поперечнику и новой длине: иначе дым висел бы отдельным кольцом
       посреди тумана. */
    if (ветр) {
      var гТруба = new T.CylinderGeometry(РАДИУС * 0.92, РАДИУС * 0.92, ДЛИНА, 48, 24, true);
      гТруба.translate(0, -ДЛИНА * 0.5, 0);
      гТруба.scale(-1, 1, 1);
      М.мТруба = new T.ShaderMaterial({
        uniforms: { tWind: { value: ветр }, uTime: М.uTime, uAlpha: М.uАльфаТруба },
        vertexShader: В_ТРУБА, fragmentShader: Ф_ТРУБА,
        transparent: true, depthWrite: false, blending: T.AdditiveBlending, fog: false
      });
      М.труба = new T.Mesh(гТруба, М.мТруба);
      М.труба.name = "труба шахты";
      М.труба.position.y = 1;
      М.труба.renderOrder = 1;
      М.труба.frustumCulled = false;
      М.корень.add(М.труба);
    }

    /* ── Три разбитых кольца плашмя ───────────────────────────── */
    var гКольца = [кольцоГеометрия(T, 0), кольцоГеометрия(T, 1)];
    М.мКольцо = new T.ShaderMaterial({
      uniforms: {
        uTime: М.uTime, uScale: М.uScale, uRes: М.uRes, uCamZ: М.uCamZ,
        uAlpha: М.uАльфаКольцо, uSvet: М.uСвет,
        uColor1: { value: new T.Color(0x6a6f7d) },
        uColor2: { value: new T.Color(0xe1e6f1) }
      },
      vertexShader: В_КОЛЬЦО, fragmentShader: Ф_КОЛЬЦО,
      side: T.DoubleSide, transparent: false, depthWrite: true, fog: false
    });
    /* СВЕТЯЩИЙСЯ ОБОДОК. На кадрах владельца это самое заметное в
       тоннеле: между камнем и провалом идёт ослепительно белая полоса,
       и она же раздувается ореолом плёнки. У них она получается сама -
       кольцо светится из карты затенения, а блум с нулевым порогом
       выжигает свечение в белое. У нас порог ореола выше, поэтому
       полоса объявлена отдельным кольцом: тот же цвет (0.7, 0.8, 1.0),
       складывающий режим и решётка из треугольников, как в их
       `ringforcefield`. */
    /* Полоса едет вместе с внутренним краем дуг: те стоят на 1.50, и
       ободок 1.30..1.58 ложится ровно на кромку и пускает свет внутрь
       просвета, как на кадрах 013 и 014. */
    М.мОбод = new T.ShaderMaterial({
      uniforms: { uTime: М.uTime, uScale: М.uScale, uAlpha: М.uАльфаОбод,
                  uSvet: М.uСвет,
                  uRing2: { value: new T.Vector2(1.30, 1.58) } },
      vertexShader: В_ОБОД, fragmentShader: Ф_ОБОД,
      transparent: true, depthWrite: false, depthTest: false,
      side: T.DoubleSide, blending: T.AdditiveBlending, fog: false
    });

    var y = ПЕРВОЕ;
    for (var к = 0; к < КОЛЕЦ; к++) {
      /* Виды чередуются, как у них: восемь дуг, шесть дуг, восемь дуг.
         У них это `shattered_ring` и `shattered_ring2` по остатку от
         деления номера кольца, размер один и тот же. */
      var м = new T.Mesh(гКольца[к % 2], М.мКольцо);
      м.name = "кольцо " + к;
      м.position.y = -y;
      м.rotation.x = -Math.PI * 0.5;
      м.renderOrder = КОЛЕЦ;
      м.frustumCulled = false;
      М.корень.add(м);
      М.кольца.push(м);

      var мО = new T.Mesh(new T.RingGeometry(1.30, 1.58, 96, 1), М.мОбод);
      мО.name = "обод кольца " + к;
      мО.position.y = -y;
      мО.rotation.x = -Math.PI * 0.5;
      мО.renderOrder = КОЛЕЦ + 1;
      мО.frustumCulled = false;
      М.корень.add(мО);
      М.ободы.push(мО);

      /* Дым у кольца: плоский диск чуть шире самого кольца. На слабой
         ступени его нет - это чистая надбавка поверх и без него кадр не
         темнеет ни на тон. */
      if (ветр && W.ступень !== 0) {
        var мД = new T.Mesh(
          new T.RingGeometry(1.05, 2.15, 48, 1),
          new T.ShaderMaterial({
            uniforms: { tWind: { value: ветр }, uTime: М.uTime, uScale: М.uScale, uAlpha: М.uАльфаДым,
                        uRing2: { value: new T.Vector2(1.05, 2.15) } },
            vertexShader: В_ДЫМ, fragmentShader: Ф_ДЫМ,
            transparent: true, depthWrite: false, depthTest: false,
            side: T.DoubleSide, blending: T.AdditiveBlending, fog: false
          }));
        мД.name = "дым кольца " + к;
        мД.position.y = -y + 0.05;
        мД.rotation.x = -Math.PI * 0.5;
        мД.renderOrder = КОЛЕЦ - к;
        мД.frustumCulled = false;
        М.корень.add(мД);
        М.дымы.push(мД);
      }
      y += ШАГ;
    }

    /* ── Снег ─────────────────────────────────────────────────── */
    var сколько = W.ступень === 0 ? 80 : (W.ступень === 1 ? 140 : СНЕГА);
    var поз = [], рнд = [];
    for (var i = 0; i < сколько; i++) {
      поз.push(псевдо(i * 1.7) * 3 - 1.5, псевдо(i * 3.1 + 5) * 8 - 4, псевдо(i * 5.9 + 11) * 3 - 1.5);
      рнд.push(псевдо(i * 7.3 + 2), псевдо(i * 11.7 + 4), псевдо(i * 13.1 + 6));
    }
    var гСнег = new T.BufferGeometry();
    гСнег.setAttribute("position", new T.Float32BufferAttribute(поз, 3));
    гСнег.setAttribute("random", new T.Float32BufferAttribute(рнд, 3));
    М.мСнег = new T.ShaderMaterial({
      uniforms: { uTime: М.uTime, uScale: М.uScale, uRes: М.uRes, uAlpha: М.uАльфаСнег },
      vertexShader: В_СНЕГ, fragmentShader: Ф_СНЕГ,
      transparent: true, depthWrite: false, depthTest: false,
      blending: T.AdditiveBlending, fog: false
    });
    М.снег = new T.Points(гСнег, М.мСнег);
    М.снег.name = "снег шахты";
    М.снег.position.y = -3.5;
    М.снег.renderOrder = 1;
    М.снег.frustumCulled = false;
    М.корень.add(М.снег);
    М.снега = сколько;

    /* ── Белое ядро в конце рукава ────────────────────────────
       Диск стоит на 10.2 из одиннадцати, то есть почти в самом конце:
       на их кадрах сгусток виден сквозь ВСЕ кольца, значит он дальше
       последнего (оно на 6.65). Поворот тот же, что у колец, - диск
       лежит поперёк оси и смотрит в камеру.

       Радиус 0.45 при просвете кольца 1.50 даёт на подлёте ту же
       мелкую крупинку, что на кадре 013; дальше диск раздувается из
       кадра, и это их вспышка на 016. */
    М.ядро = new T.Mesh(
      new T.CircleGeometry(0.45, 32),
      new T.ShaderMaterial({
        uniforms: { uTime: М.uTime, uAlpha: { value: 1 }, uSvet: М.uСвет },
        vertexShader: В_ЯДРО, fragmentShader: Ф_ЯДРО,
        transparent: true, depthWrite: false, depthTest: false,
        side: T.DoubleSide, blending: T.AdditiveBlending, fog: false
      }));
    М.ядро.name = "ядро выхода";
    М.ядро.position.y = -(ДЛИНА - 0.8);
    М.ядро.rotation.x = -Math.PI * 0.5;
    М.ядро.renderOrder = КОЛЕЦ + 2;
    М.ядро.frustumCulled = false;
    М.корень.add(М.ядро);

    (родитель || W.scene).add(М.корень);
    собрано = true;
    return М.корень;
  }

  /* Множитель их единиц в наши. Ставит и масштаб корня, и число, по
     которому шейдеры пересчитывают расстояния обратно в их единицы. */
  function масштаб(k, вдоль) {
    if (!собрано) return;
    var м = k > 0 ? k : 1;
    /* ── ДЛИНА ТЯНЕТСЯ ОТДЕЛЬНО ОТ ТОЛЩИНЫ ──────────────────────
       Труба обязана быть ДЛИННЕЕ пути камеры: пока её конец совпадал с
       концом пути, на середине хода впереди оставалось меньше двух её
       единиц стенки, дальше открывался светлый зал, и снимок показывал
       ровный туман вместо тоннеля.

       Тянуть за это один общий масштаб нельзя. Он растит и радиус, и
       стенка отъезжает от камеры: на пробе с общим множителем 5.5 труба
       раздулась до восьми единиц в радиусе, ушла за кромку кадра и
       читалась ещё хуже - у igloo тоннель ТЕСНЫЙ, стенка идёт в
       полутора их радиусах от глаза.

       Поэтому вдоль оси свой множитель. Ось внутри модуля это местный
       Y, значит тянется только он: кольца разъезжаются по глубине,
       стенка становится длиннее, а поперечник остаётся igloo'вским.

       uScale остаётся поперечным: им шейдеры переводят расстояние до
       камеры обратно в их единицы, и радиус там главный. */
    var д = вдоль > 0 ? вдоль : 1;
    М.корень.scale.set(м, м * д, м);
    М.uScale.value = м;
  }

  /* Кадр. `доля` это ход падения от нуля до единицы, `поворотВерха` -
     их upRotation в радианах: труба крутится на 0.65 от него, кольца на
     0.4, ровно как у них. */
  function кадр(доля, dt, часы, поворотВерха) {
    if (!собрано) return;
    var д = зажать(доля || 0, 0, 1);
    М.uTime.value = часы || 0;
    var ш = g.innerWidth || 1, в = g.innerHeight || 1;
    if (М.uRes.value.x !== ш || М.uRes.value.y !== в) М.uRes.value.set(ш, в);
    if (W.cam) {
      /* Их camFactor считается от -cameraPosition.z, потому что их
         шахта стоит в нуле и камера подходит по минус Z. У нас шахта
         живёт в своём гнезде, поэтому передаём МЕСТНУЮ глубину камеры
         в единицах igloo: смысл тот же, число то же. */
      М.корень.updateMatrixWorld();
      _камЛок.copy(W.cam.position);
      М.корень.worldToLocal(_камЛок);
      /* ГЛУБИНА СЧИТАЕТСЯ ПО ОСИ ШАХТЫ, А НЕ ПО МЕСТНОМУ Z. Ось трубы
         внутри модуля идёт по местному минус Y (кольца стоят на -1.65,
         -4.15, -6.65), и брать местное z означало отдавать шейдеру ноль
         на всём ходу: пороги разлёта осколков не срабатывали никогда, и
         кольца проходили мимо целыми. Теперь число говорит ровно то, что
         обещает имя, - сколько их единиц камера прошла от устья, - и
         кольцо распадается на подлёте, как у них. */
      М.uCamZ.value = зажать(-_камЛок.y, 0, 4);
    }

    /* ── РАЗГОН СВЕТА ПО ХОДУ ────────────────────────────────────
       Кадры 012-016 у igloo это ровно одно движение: серый туман на
       входе, горящие кромки колец в середине, белое ядро и вспышка на
       выходе. Держится всё одним числом, и его читают четверо - туман,
       камень колец, ободок и ядро.

       Считается по двум источникам сразу, и это не перестраховка. Доля
       акта знает, где человек по ленте, но ничего не знает о месте
       камеры; глубина знает место, но обнуляется, пока камера ещё не
       вошла в устье. Берём больший из двух: свет тогда не проваливается
       ни на входе, ни если акт перемотали колесом сразу в середину.

       Три четверти рукава на разгон, дальше ровно единица: последняя
       четверть это уже вспышка, и гасить её нечем. */
    var поХоду = д;
    var поМесту = _камЛок ? зажать(-_камЛок.y / (ДЛИНА * 0.75), 0, 1) : 0;
    М.uСвет.value = поХоду > поМесту ? поХоду : поМесту;

    var пов = поворотВерха || 0;
    if (М.труба) М.труба.rotation.y = пов * 0.65;
    for (var к = 0; к < М.кольца.length; к++) М.кольца[к].rotation.z = пов * 0.4;
    for (к = 0; к < М.дымы.length; к++) М.дымы[к].rotation.z = пов * 0.5;

    /* ── КОЛЬЦО ГАСНЕТ, КОГДА ЕГО ПРОШЛИ, А НЕ ПО РАСПИСАНИЮ ─────
       Здесь стояли три числа, снятые с ленты igloo: 0.34, 0.43, 0.52
       доли сцены. Они верны ровно для той раскладки, из которой сняты, и
       врут для любой другой: стоит поменять длину трубы, скорость акта
       или место станции - и кольцо гаснет в двух шагах перед носом или,
       наоборот, висит уже за спиной.

       Теперь то же самое считается по МЕСТУ КАМЕРЫ. Глубина `глуб` это
       сколько их единиц камера прошла от устья вдоль оси; кольца стоят
       на 1.65, 4.15 и 6.65. Прошли кольцо - оно гаснет, и никакой ленте
       для этого знать о себе не нужно.

       Полторы единицы запаса на гашение: кольцо снимается уже за
       кромкой кадра, а не растворяется прямо в глазу. */
    var глуб = -_камЛок.y;
    for (к = 0; к < М.кольца.length; к++) {
      var своё = ПЕРВОЕ + к * ШАГ;
      var прошли = глуб > своё + 1.5;
      /* Дальнее кольцо появляется не сразу: у них дальний камень
         растворяется в тумане, и три кольца разом в кадре не стоят
         никогда. Пять единиц до кольца это их же дистанция. */
      var близко = глуб > своё - 5.0;
      М.кольца[к].visible = !прошли;
      if (М.дымы[к]) М.дымы[к].visible = близко && !прошли;
      /* Ободок это их силовое поле: загорается, когда кольцо уже рядом,
         и гаснет вместе с ним. */
      if (М.ободы[к]) {
        М.ободы[к].visible = глуб > своё - 3.2 && !прошли;
        М.ободы[к].rotation.z = пов * 0.4;
      }
    }
    /* Туман, дым и снег живут, пока камера внутри рукава. Полторы
       единицы за его концом хватает, чтобы выход не обрубался
       кромкой. */
    var внутри = глуб < ДЛИНА + 1.5;
    if (М.труба) М.труба.visible = внутри;
    if (М.стенка) М.стенка.visible = внутри;
    if (М.снег) М.снег.visible = внутри;

    /* ── ЯДРО РАСТЁТ И ПРЕВРАЩАЕТСЯ ВО ВСПЫШКУ ──────────────────
       На кадре 013 сгусток мелкий, на 014 крупнее, на 015 занимает
       середину кадра целиком. Двигать его к камере нельзя - он обязан
       стоять в конце, за всеми кольцами, - поэтому растёт он сам.
       Показатель 2.5 держит его крупинкой почти весь ход и раздувает
       только в последней четверти, ровно как у них. */
    if (М.ядро) {
      var с = М.uСвет.value;
      var р = 0.5 + 2.6 * Math.pow(с, 2.5);
      М.ядро.scale.set(р, р, 1);
      М.ядро.visible = внутри && с > 0.08;
    }
  }

  function видно(да) {
    if (!собрано) return;
    М.корень.visible = !!да;
  }

  function узел() { return собрано ? М.корень : null; }

  g.RV_ТРУБА = {
    "собрать": собрать,
    "масштаб": масштаб,
    "кадр": кадр,
    "видно": видно,
    "узел": узел,
    "замер": function () {
      if (!собрано) return { "собрано": false };
      return {
        "собрано": true,
        "видно": !!М.корень.visible,
        "масштаб": +М.корень.scale.x.toFixed(2),
        "колец": М.кольца.length,
        /* Дуги, а не осколки: проверке надо видеть, что кольцо разбито
           на шесть-восемь кусков, а не на крошку. */
        "дуг": [ДУГ_ШИРОКИХ, ДУГ_РЕДКИХ],
        "радиусКольца": [К_ВНУТР, К_ВНЕШ],
        "труба": !!(М.труба && М.труба.visible),
        "дымов": М.дымы.length,
        "снега": М.снега || 0,
        /* Разгон света: по нему видно, что тоннель светлеет к выходу, а
           не стоит ровным серым. */
        "свет": +М.uСвет.value.toFixed(2),
        "ядро": !!(М.ядро && М.ядро.visible),
        "ядроРазмер": М.ядро ? +М.ядро.scale.x.toFixed(2) : null,
        "камZ": +М.uCamZ.value.toFixed(2),
        /* Глубина камеры по оси шахты в их единицах: по ней теперь
           гаснут кольца, и без неё проверке не отличить «кольцо
           рассыпалось» от «кольцо не показали». */
        "глуб": _камЛок ? +(-_камЛок.y).toFixed(2) : null,
        "туман": !!(М.стенка && М.стенка.visible),
        "стенка": !!(М.стенка && М.стенка.visible),
        "кольцаВидны": М.кольца.map(function (м) { return !!м.visible; })
      };
    }
  };
})(window, document);
