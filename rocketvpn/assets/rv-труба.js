/* Rocket VPN. Шахта: труба, разбитые кольца, дым и снег - по igloo.inc.

   ЗАЧЕМ ПЕРЕПИСАНО ЦЕЛИКОМ. Владелец: «тунелл никак не похож на igloo
   ... открой ещё раз igloo.inc на разделе туннеля и сделай 1:1 как там
   и движение камеры и модели туннеля и кольца тунелья и свет и туман и
   эффекты и освещение и визуальный фон и частицы и все 1:1 без
   малейшего изменения».

   Прежняя труба была НЕОНОВОЙ: светящиеся кольца, плазма, снег, всё
   складывающим режимом поверх чёрного. У igloo шахта устроена
   наоборот, и это видно в их сборке (числа сняты в
   docs/РАЗБОР-IGLOO-ТОННЕЛЬ.md):

     · стенка шахты это ДЫМ, а не стена: вывернутый внутрь цилиндр с
       тремя слоями шумовой карты, цвет (0.85, 0.9, 1.0);
     · кольца КАМЕННЫЕ и РАЗБИТЫЕ на осколки, лежат ПЛАШМЯ, и мы падаем
       сквозь них;
     · осколок разлетается и крутится ОТ РАССТОЯНИЯ ДО КАМЕРЫ, а не от
       времени: подлетаешь - кольцо распадается на глазах;
     · вдали камень РАСТВОРЯЕТСЯ В ЭКРАННОМ ГРАДИЕНТЕ #6a6f7d ->
       #e1e6f1, поэтому дальние кольца читаются туманом, а не силуэтом;
     · свечение приходит только из карты затенения, синим (0.5,0.7,1.0),
       и только когда кольцо близко.

   ИХ ЕДИНИЦЫ. Всё внутри собрано в ИХ масштабе: радиус трубы 1.3,
   высота 9, кольца на -1.65, -4.15, -6.65. Наш мир крупнее, поэтому
   корень масштабируется одним числом, а шейдеры делят расстояние до
   камеры на тот же множитель (`uScale`) - иначе пороги разлёта,
   считанные в их единицах, сработали бы не там.

   ЧЕГО ЗДЕСЬ НЕТ. У них кольца это модели `shattered_ring.drc` с
   картами цвета и затенения. Своих таких моделей у нас нет, и качать
   чужие нельзя. Кольцо собирается здесь же из осколков: тор режется на
   куски, у каждого куска своя середина (`centr`) и свой случайный набор
   (`rand`) - ровно те атрибуты, которых ждёт их шейдер. Цвет и
   затенение считаются, а не берутся из карт.

   API:
     RV_ТРУБА.собрать(мир, родитель) -> Group
     RV_ТРУБА.масштаб(k)      - множитель их единиц в наши
     RV_ТРУБА.кадр(доля, dt, часы, поворотВерха)
     RV_ТРУБА.замер() */
(function (g, d) {
  "use strict";

  var W = null, T = null;
  var М = {};
  var собрано = false;
  var _камЛок = null;

  var КОЛЕЦ = 3;            /* их число */
  var ШАГ = 2.5;            /* их шаг между кольцами */
  var ПЕРВОЕ = 1.65;        /* их высота первого кольца, вниз от нуля */
  var ОСКОЛКОВ = 34;        /* на кольцо: у них модель, у нас нарезка */
  var СНЕГА = 200;          /* их число точек снега */

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

  /* ══ СТЕНКА ШАХТЫ ════════════════════════════════════════════════
     У igloo шахта это ПРОБУРЕННАЯ ДЫРА в светлом камне: на их кадрах
     видны концентрические кольцевые борозды от бура и мягкая
     затенённость вглубь. Дымный цилиндр (класс SF) лежит поверх этой
     стенки, а не вместо неё - он один давал у нас пустоту, потому что
     складывающий дым поверх ничего это и есть ничего.

     Стенка красится тем же экранным градиентом, что и вся комната
     (#6a6f7d -> #e1e6f1): у них весь подземный объём один материал, и
     труба отличается от оболочки только тем, что на ней есть борозды и
     затенение вглубь. */
  var В_СТЕНКА = [
    "varying vec2 vUv;",
    "varying vec3 vPos;",
    "varying float vDepth;",
    "void main(){",
    "  vUv = uv; vPos = position;",
    "  vec4 mv = modelViewMatrix * vec4(position, 1.0);",
    "  vDepth = -mv.z;",
    "  gl_Position = projectionMatrix * mv;",
    "}"
  ].join("\n");

  var Ф_СТЕНКА = [
    ИХ_ФУНКЦИИ,
    "uniform float uTime;",
    "uniform vec2 uRes;",
    "uniform vec3 uC1;",
    "uniform vec3 uC2;",
    "uniform float uAlpha;",
    "uniform float uScale;",
    "varying vec2 vUv;",
    "varying vec3 vPos;",
    "varying float vDepth;",
    "void main(){",
    /* Тот же диагональный экранный градиент, что у оболочки комнаты. */
    "  vec2 screenUv = gl_FragCoord.xy / uRes;",
    "  float ramp = (screenUv.x + screenUv.y) * 0.5;",
    "  ramp *= sinenoise1(vec3(screenUv, uTime * 0.614)) * 0.5 + 0.5;",
    "  ramp *= sinenoise1(vec3(screenUv * 2.0, uTime * 0.17)) * 0.5 + 0.5;",
    "  vec3 color = mix(uC1, uC2, clamp(ramp, 0.0, 1.0)) * 1.1;",
    /* Борозды бура: кольца поперёк оси, шаг мелкий, глубина малая.
       Плюс крупная волна - стенка не идеальный цилиндр. */
    "  float y = vPos.y;",
    "  float borozda = sin(y * 17.0) * 0.5 + 0.5;",
    "  borozda = pow(borozda, 2.0);",
    "  float volna = sinenoise1(vec3(vUv * 6.0, y * 0.7)) * 0.5 + 0.5;",
    "  color *= mix(0.94, 1.04, borozda) * mix(0.96, 1.03, volna);",
    /* Камень зернистый: без зерна светлая стенка читается пластиком. */
    "  color += (hash12(vUv * 900.0) - 0.5) * 0.035;",
    /* Вглубь темнее. Свет падает сверху, из проёма, и низ шахты обязан
       уходить в тень, иначе труба не имеет длины. */
    "  color *= mix(0.74, 1.0, clamp(y / 9.0 + 1.0, 0.0, 1.0));",
    /* И дальний край растворяется, чтобы у трубы не читалось дно. */
    "  float dIgloo = vDepth / uScale;",
    "  float dal = 1.0 - smoothstep(6.0, 13.0, dIgloo);",
    "  gl_FragColor = vec4(color, uAlpha * mix(0.55, 1.0, dal));",
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
    "varying vec2 vUv;",
    "varying vec3 vPos;",
    "varying vec3 vLocal;",
    "varying vec3 vRand;",
    "varying float vFalloff;",
    "varying float vFade;",
    "void main(){",
    /* Камень: крупная слоистость плюс мелкое зерно. Диапазон тот же,
       что у их карты - от #4c5262 до #cfd6e4. */
    "  float sl = sinenoise1(vLocal * 6.0 + vRand * 3.0) * 0.5 + 0.5;",
    "  float zerno = hash12(vUv * 260.0 + vRand.xy * 40.0);",
    "  float kamen = mix(0.30, 0.82, sl) + (zerno - 0.5) * 0.10;",
    "  vec3 color = mix(vec3(0.30, 0.32, 0.385), vec3(0.81, 0.84, 0.895), kamen);",
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
    "  float shchel = pow(1.0 - abs(vUv.y * 2.0 - 1.0), 2.5);",
    "  float camFactor = pow(1.0 - clamp(uCamZ, 0.0, 1.0), 4.0);",
    "  color += shchel * vec3(0.5, 0.7, 1.0) * n1 * glowFalloff * 0.8 * camFactor;",
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
    "  a *= vBliz * uAlpha;",
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

  /* ── Разбитое кольцо из осколков ──────────────────────────────
     У них это модель. Здесь тор режется на куски по окружности, каждый
     кусок слегка неровный, и у каждого свои `centr` и `rand` - те самые
     атрибуты, на которых держится весь их разлёт.

     Куски НЕ соприкасаются: между ними щель, и щель эта видна как
     свечение (см. `shchel` в шейдере). Кольцо целиком выглядит
     разломанным ещё до того, как начнёт разлетаться. */
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
  /* ДВА ВИДА КОЛЬЦА, КАК У НИХ. В их коде две модели, и они чередуются
     по номеру кольца: `shattered_ring` и `shattered_ring2`. На кадрах
     владельца видно, чем они отличаются - одно это ТОЛСТЫЙ ВНЕШНИЙ ТОР,
     разломанный на десяток крупных плит, второе КОЛЬЦО ДУГ поменьше и
     потоньше, с широкими провалами между ними. Одно у нас кольцо давало
     ровный частокол одинаковых кусков, и шахта читалась зубчатой
     шестерёнкой вместо разлома. */
  function кольцоГеометрия(T, вид) {
    var толстое = вид === 0;
    var Rвн = толстое ? 1.44 : 1.02;
    var Rнар = толстое ? 2.30 : 1.34;
    var толщ = толстое ? 0.40 : 0.19;
    var сегм = 5;                  /* делений по дуге внутри осколка */
    var поз = [], нор = [], уф = [], цен = [], рнд = [], инд = [];
    var штук = толстое ? 11 : 8;
    var шагУгла = Math.PI * 2 / штук;
    var база = 0;

    for (var к = 0; к < штук; к++) {
      /* Своё зерно на осколок: размер щели, перекос, случайный набор. */
      var s1 = псевдо(к * 1.13 + 0.7), s2 = псевдо(к * 2.71 + 3.1), s3 = псевдо(к * 5.37 + 9.4);
      /* Щель у толстого тора узкая (плиты почти смыкаются), у кольца
         дуг широкая - там между кусками провал в полдуги. */
      var щель = толстое ? (0.07 + 0.10 * s1) : (0.30 + 0.34 * s1);
      var у0 = к * шагУгла + щель * шагУгла * 0.5;
      var у1 = (к + 1) * шагУгла - щель * шагУгла * 0.5;
      var rвн = Rвн - 0.05 * s2, rнар = Rнар + 0.07 * s3;
      var hв = толщ * (0.6 + 0.8 * s1), hн = -толщ * (0.6 + 0.8 * s2);
      var цx = Math.cos((у0 + у1) * 0.5) * (rвн + rнар) * 0.5;
      var цy = Math.sin((у0 + у1) * 0.5) * (rвн + rнар) * 0.5;

      /* Восемь колец точек: верх и низ по внутреннему и внешнему краю.
         Кладём как коробку, свёрнутую по дуге. */
      var кольцоТочек = [];
      for (var i = 0; i <= сегм; i++) {
        var f = i / сегм;
        var у = у0 + (у1 - у0) * f;
        /* Излом по дуге: край осколка не гладкий. */
        var изл = (псевдо(к * 7.7 + i * 3.3) - 0.5) * 0.035;
        var ко = Math.cos(у), си = Math.sin(у);
        /* Кольцо в плоскости XY, толщина по Z. */
        кольцоТочек.push([
          [ко * (rвн + изл), си * (rвн + изл), hв],
          [ко * (rнар + изл), си * (rнар + изл), hв],
          [ко * (rнар + изл), си * (rнар + изл), hн],
          [ко * (rвн + изл), си * (rвн + изл), hн]
        ]);
      }

      /* Четыре боковые полосы плюс две крышки: обычная развёртка
         коробки, только изогнутой. uv.y идёт поперёк осколка - на нём
         держится свечение щели. */
      for (i = 0; i < сегм; i++) {
        for (var с = 0; с < 4; с++) {
          var a = кольцоТочек[i][с], b = кольцоТочек[i][(с + 1) % 4];
          var c2 = кольцоТочек[i + 1][(с + 1) % 4], d2 = кольцоТочек[i + 1][с];
          четырёх(a, b, c2, d2, i / сегм, с / 4);
        }
      }
      /* Крышки на торцах разлома. */
      четырёх(кольцоТочек[0][3], кольцоТочек[0][2], кольцоТочек[0][1], кольцоТочек[0][0], 0, 0.5);
      var п = кольцоТочек[сегм];
      четырёх(п[0], п[1], п[2], п[3], 1, 0.5);

      function четырёх(a, b, c2, d2, u, v) {
        var н = нормаль(a, b, c2);
        var точки = [a, b, c2, d2];
        var уфы = [[u, v], [u, v + 0.25], [u + 0.2, v + 0.25], [u + 0.2, v]];
        for (var т = 0; т < 4; т++) {
          поз.push(точки[т][0], точки[т][1], точки[т][2]);
          нор.push(н[0], н[1], н[2]);
          уф.push(уфы[т][0], уфы[т][1]);
          цен.push(цx, цy, 0);
          рнд.push(s1, s2, s3);
        }
        инд.push(база, база + 1, база + 2, база, база + 2, база + 3);
        база += 4;
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
    М.кольца = [];
    М.дымы = [];
    М.ободы = [];

    var ветр = ветер();

    /* ── Стенка шахты: настоящая поверхность ───────────────────
       Та же геометрия, что у дымного цилиндра, но чуть шире: дым обязан
       лежать ВНУТРИ стенки, а не совпадать с ней в точности, иначе два
       слоя дерутся за глубину и по трубе идёт рябь. */
    var гСтенка = new T.CylinderGeometry(1.42, 1.42, 9, 64, 24, true);
    гСтенка.translate(0, -9 * 0.5, 0);
    гСтенка.scale(-1, 1, 1);
    М.мСтенка = new T.ShaderMaterial({
      uniforms: {
        uTime: М.uTime, uRes: М.uRes, uScale: М.uScale, uAlpha: М.uАльфаТруба,
        uC1: { value: new T.Color(0x6a6f7d) },
        uC2: { value: new T.Color(0xe1e6f1) }
      },
      vertexShader: В_СТЕНКА, fragmentShader: Ф_СТЕНКА,
      transparent: true, depthWrite: true, side: T.FrontSide, fog: false
    });
    М.стенка = new T.Mesh(гСтенка, М.мСтенка);
    М.стенка.name = "стенка шахты";
    М.стенка.position.y = 1;
    М.стенка.renderOrder = 0;
    М.стенка.frustumCulled = false;
    М.корень.add(М.стенка);

    /* ── Труба: их цилиндр, вывернутый внутрь ─────────────────── */
    if (ветр) {
      var гТруба = new T.CylinderGeometry(1.3, 1.3, 9, 64, 32, true);
      гТруба.translate(0, -9 * 0.5, 0);
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
        uAlpha: М.uАльфаКольцо,
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
    М.мОбод = new T.ShaderMaterial({
      uniforms: { uTime: М.uTime, uScale: М.uScale, uAlpha: М.uАльфаОбод,
                  uRing2: { value: new T.Vector2(1.30, 1.52) } },
      vertexShader: В_ОБОД, fragmentShader: Ф_ОБОД,
      transparent: true, depthWrite: false, depthTest: false,
      side: T.DoubleSide, blending: T.AdditiveBlending, fog: false
    });

    var y = ПЕРВОЕ;
    for (var к = 0; к < КОЛЕЦ; к++) {
      /* Виды чередуются, как у них: толстый тор, кольцо дуг, толстый тор. */
      var м = new T.Mesh(гКольца[к % 2], М.мКольцо);
      м.name = "кольцо " + к;
      м.position.y = -y;
      м.rotation.x = -Math.PI * 0.5;
      м.renderOrder = КОЛЕЦ;
      м.frustumCulled = false;
      М.корень.add(м);
      М.кольца.push(м);

      var мО = new T.Mesh(new T.RingGeometry(1.30, 1.52, 96, 1), М.мОбод);
      мО.name = "обод кольца " + к;
      мО.position.y = -y;
      мО.rotation.x = -Math.PI * 0.5;
      мО.renderOrder = КОЛЕЦ + 1;
      мО.frustumCulled = false;
      М.корень.add(мО);
      М.ободы.push(мО);

      /* Дым у кольца: плоский диск чуть шире самого кольца. */
      if (ветр) {
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
    var поз = [], рнд = [];
    for (var i = 0; i < СНЕГА; i++) {
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

    (родитель || W.scene).add(М.корень);
    собрано = true;
    return М.корень;
  }

  /* Множитель их единиц в наши. Ставит и масштаб корня, и число, по
     которому шейдеры пересчитывают расстояния обратно в их единицы. */
  function масштаб(k) {
    if (!собрано) return;
    var м = k > 0 ? k : 1;
    М.корень.scale.setScalar(м);
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
      М.uCamZ.value = зажать(-_камЛок.z, 0, 4);
    }

    var пов = поворотВерха || 0;
    if (М.труба) М.труба.rotation.y = пов * 0.65;
    for (var к = 0; к < М.кольца.length; к++) М.кольца[к].rotation.z = пов * 0.4;
    for (к = 0; к < М.дымы.length; к++) М.дымы[к].rotation.z = пов * 0.5;

    /* Их гашение по ходу ленты. Кольца уходят по очереди: ближнее
       первым, дальнее последним - мы пролетаем их сверху вниз. */
    var пороги = [0.34, 0.43, 0.52];
    for (к = 0; к < М.кольца.length; к++) {
      М.кольца[к].visible = д < пороги[к];
      if (М.дымы[к]) М.дымы[к].visible = д > (0.06 + к * 0.15) && д < пороги[к];
      /* Ободок живёт в их окне силового поля: 0.10-0.34, 0.25-0.43,
         0.36-0.52 - загорается, когда кольцо уже близко, и гаснет
         вместе с ним. */
      if (М.ободы[к]) {
        М.ободы[к].visible = д > (0.10 + к * 0.13) && д < пороги[к];
        М.ободы[к].rotation.z = пов * 0.4;
      }
    }
    if (М.труба) М.труба.visible = д < 0.52;
    if (М.стенка) М.стенка.visible = д < 0.60;
    if (М.снег) М.снег.visible = д < 0.52;
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
        "осколков": ОСКОЛКОВ,
        "труба": !!(М.труба && М.труба.visible),
        "дымов": М.дымы.length,
        "снега": СНЕГА,
        "камZ": +М.uCamZ.value.toFixed(2),
        "кольцаВидны": М.кольца.map(function (м) { return !!м.visible; })
      };
    }
  };
})(window, document);
