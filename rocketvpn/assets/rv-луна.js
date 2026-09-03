/* Rocket VPN. Луна: грунт, небо, Земля, дымка свечения, лучи, пыль.

   ЗАЧЕМ ОТДЕЛЬНЫЙ ФАЙЛ. Станция (rv-act-станция.js) это предмет, Луна
   это место, где он стоит. У места свои законы: небо и туман красятся
   ОДНИМ экранным градиентом, грунт растворяет свою кромку, тень под
   предметом синяя, пыль идёт понизу. Всё это нужно и куполу, и любому
   другому предмету, который когда-нибудь встанет на этот грунт, поэтому
   Луна отдаёт фабрику и общие униформы, а не рисует сама по себе.

   РЕЦЕПТ ЧУЖОЙ, ЧИСЛА СВОИ. Устройство снято с igloo.inc разбором их
   боевого кода (docs/РАЗБОР-IGLOO.md): в их сцене ноль живых источников
   света, небо это pow((x+y)/2, 2) по экрану, туман в каждом материале
   считается тем же градиентом, контактная тень нарисована формулой и
   она синяя, дым это три перемноженные выборки одного тайлового шума,
   кромка любой плоскости уходит в smoothstep. Их моделей и текстур
   здесь нет: грунт с кратерами считается при сборке, шум рисуется в
   холст, Земля это сфера с формулой терминатора.

   ПОЧЕМУ БЕЗ ИСТОЧНИКОВ СВЕТА. У мира Rocket VPN четыре живых источника,
   и каждый пиксель каждой модели считает их заново. На Луне свет один,
   жёсткий, без рассеяния, и его дешевле и честнее записать формулой по
   нормали: верх светлый, низ синий отсвет Земли. Так же сделан весь
   igloo, и так же читается «запечённый» вид, который просил владелец. */
(function (g, d) {
  "use strict";

  var W = null, T = null;
  var М = {};
  var собрано = false;

  function зажать(v, н, в) { return v < н ? н : (v > в ? в : v); }

  /* ── Общие униформы ──────────────────────────────────────────
     Их читают ВСЕ материалы Луны и материал купола: небо и туман обязаны
     совпадать до бита, иначе предмет висит на фоне, а не стоит в
     воздухе. Наружу отдаются как RV_ЛУНА.градиент. */
  var ГРАД = {
    uColor1: { value: null },   /* зенит */
    uColor2: { value: null },   /* горизонт */
    uResolution: { value: null },
    uTime: { value: 0 },
    uDen: { value: 0 }           /* 0 ночь, 1 день */
  };

  /* Палитры. Ночью зенит чуть синий, горизонт почти чёрный: свет идёт
     СНИЗУ, от грунта, поэтому градиент перевёрнут относительно igloo.
     Днём их числа как есть: #D1D6E3 / #AFB6C7. Ни одна точка неба не
     белая ни в одной теме - это правило igloo, и оно снимает пересвет
     на корню. */
  /* Ночной реголит темнее, чем казалось по числам igloo: у них снег, у
     нас камень. Первый кадр с грунтом #7C7F87 дал светло-серую заливку
     на всю нижнюю половину, читавшуюся туманом, а не поверхностью.
     Средняя яркость кадра была 90; цель 55-70 при тех же нулях
     выбитых и чёрных точек. */
  var НОЧЬ = { зенит: 0x202A48, горизонт: 0x05070F, грунт: 0x60636C, склон: 0x716E67,
               верх: 0xB2B9C8, низ: 0x262C40, дымка: 0x7E9CFF, дымкаСила: 0.18,
               пыль: 0xB9C6FF, пыльСила: 0.55 };
  var ДЕНЬ = { зенит: 0xD1D6E3, горизонт: 0xAFB6C7, грунт: 0x9A9DA6, склон: 0xA8A49E,
               верх: 0xF1F3F8, низ: 0x6A7290, дымка: 0x5F7BD9, дымкаСила: 0.10,
               пыль: 0x2B3560, пыльСила: 0.35 };
  var ПАЛ = НОЧЬ;

  /* ── Куски GLSL, общие для всех материалов ─────────────────── */
  var ОБЩЕЕ_GLSL = [
    "uniform vec3 uColor1;",
    "uniform vec3 uColor2;",
    "uniform vec2 uResolution;",
    "uniform float uTime;",
    "uniform float uDen;",
    /* Экранный градиент неба. Их формула слово в слово. */
    "vec3 nebo(){",
    "  vec2 screenUv = gl_FragCoord.xy / uResolution;",
    "  float grad = (screenUv.x + screenUv.y) * 0.5;",
    "  grad = pow(grad, 2.0);",
    "  return mix(uColor2, uColor1, grad);",
    "}",
    /* Туман тем же градиентом: по глубине и по высоте. */
    "vec3 tuman(vec3 color, float mvz, float wy){",
    "  float distanceFog = clamp(-mvz * 0.005, 0.0, 1.0);",
    "  float heightFog = clamp(1.0 - wy * 0.35, 0.0, 1.0) * 0.25;",
    "  return mix(color, nebo(), clamp(distanceFog + heightFog, 0.0, 1.0));",
    "}",
    "float hash12(vec2 p){",
    "  vec3 p3 = fract(vec3(p.xyx) * 0.1031);",
    "  p3 += dot(p3, p3.yzx + 33.33);",
    "  return fract((p3.x + p3.y) * p3.z);",
    "}",
    /* Дизеринг против полос: их приём, 1/255 с покадровым сдвигом. */
    "vec3 dizer(vec3 c){ return c + (hash12(gl_FragCoord.xy + uTime) - 0.5) / 255.0; }",
    /* Шум без текстуры: шесть синусов, их функция дословно. */
    "#define sinlayer(fx, fy, fz) val += sin(dot(p, vec3(fx, fy, fz)));",
    "float sinenoise1(vec3 p){ float val = 0.0;",
    "  sinlayer(1.5, 3.4598, 1.234); sinlayer(3.12, -3.234, 4.221);",
    "  sinlayer(0.355, 2.3, -1.375); sinlayer(-0.156, -3.34, -0.4566);",
    "  sinlayer(-4.1235, -0.485, -1.45); sinlayer(2.54, -0.879, -2.123);",
    "  return val / 6.0; }"
  ].join("\n");

  /* ── Небо ────────────────────────────────────────────────────
     Их класс g3: сфера 800 с 12 сегментами, изнанкой наружу, чуть
     повёрнутая, чтобы шов полюса не стоял в зените. У нас радиус 300:
     сфера живёт только в акте станции, а на 800 она накрывала бы
     соседние акты и подменяла бы им небо мира. Звёзды хешем по
     направлению, без мерцания: на Луне нет воздуха, мерцать нечему. */
  var В_НЕБО = [
    "varying vec3 vDir;",
    "void main(){",
    "  vDir = normalize(position);",
    "  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);",
    "}"
  ].join("\n");
  var Ф_НЕБО = [
    ОБЩЕЕ_GLSL,
    "uniform float uAlpha;",
    "varying vec3 vDir;",
    "void main(){",
    "  vec3 c = nebo();",
    "  vec3 dn = normalize(vDir);",
    "  vec2 cell = floor(vec2(atan(dn.z, dn.x), dn.y) * vec2(140.0, 420.0));",
    "  float h = hash12(cell);",
    "  float star = step(0.9985, h) * (0.55 + 0.45 * hash12(cell + 7.1));",
    "  star *= smoothstep(-0.05, 0.25, dn.y);",
    "  c += vec3(0.86, 0.9, 1.0) * star * (1.0 - uDen);",
    "  gl_FragColor = vec4(dizer(c), uAlpha);",
    "}"
  ].join("\n");

  /* ── Грунт ───────────────────────────────────────────────────
     Их классы y3 и hF. Смещение вершин посчитано ОДИН раз при сборке в
     JS (шесть синусов плюс кратеры), нормали пересчитаны честно. В
     шейдере остаётся свет по нормали, крупа, пульс свечения, четыре
     контактные тени и растворение кромки. */
  var В_ГРУНТ = [
    "varying vec3 vPos;",
    "varying vec3 vNor;",
    "varying vec3 vWorld;",
    "varying float vMvz;",
    "void main(){",
    "  vPos = position;",
    "  vNor = normalize(normalMatrix * normal);",
    "  vec4 w = modelMatrix * vec4(position, 1.0);",
    "  vWorld = w.xyz;",
    "  vec4 mv = viewMatrix * w;",
    "  vMvz = mv.z;",
    "  gl_Position = projectionMatrix * mv;",
    "}"
  ].join("\n");
  var Ф_ГРУНТ = [
    ОБЩЕЕ_GLSL,
    "uniform vec3 uGrunt;",
    "uniform vec3 uSklon;",
    "uniform vec3 uVerh;",
    "uniform vec3 uNiz;",
    "uniform vec3 uDymka;",
    "uniform vec3 uShadows[4];",
    "uniform float uRadius;",
    "uniform sampler2D tAlb;",
    "uniform sampler2D tNor;",
    "uniform sampler2D tFoto;",
    "uniform float uFoto;",
    "varying vec3 vPos;",
    "varying vec3 vNor;",
    "varying vec3 vWorld;",
    "varying float vMvz;",
    "void main(){",
    "  vec3 n = normalize(vNor);",
    /* Фактура: карта нормалей на двух масштабах (крупный и мелкий), в
       мировых координатах, грунт почти горизонтален, поэтому нормаль
       карты кладётся на xz напрямую. Альбедо теми же выборками. */
    "  vec2 uv1 = vWorld.xz * 0.09, uv2 = vWorld.xz * 0.41;",
    "  vec3 nm = (texture2D(tNor, uv1).xyz * 2.0 - 1.0) * 0.8 + (texture2D(tNor, uv2).xyz * 2.0 - 1.0) * 0.45;",
    "  n = normalize(n + vec3(nm.x, 0.0, nm.y));",
    "  float alb = texture2D(tAlb, uv1).r * 0.6 + texture2D(tAlb, uv2).r * 0.4;",
    /* Фото реголита на двух масштабах, зеркальный повтор прячет шов.
       Средняя яркость фото около 0.5, поэтому делим на неё. */
    /* Два масштаба под разным поворотом: одинаковые следы колёс через
       каждые восемь единиц читались повтором плитки. */
    "  vec2 pv = vWorld.xz * 0.055;",
    "  vec2 pr = vec2(pv.x * 0.6 - pv.y * 0.8, pv.x * 0.8 + pv.y * 0.6) * 4.2 + 0.37;",
    "  vec3 foto = texture2D(tFoto, pv).rgb * 0.5 + texture2D(tFoto, pr).rgb * 0.5;",
    "  alb = mix(alb, (foto.r + foto.g + foto.b) / 3.0 / 0.5 * 0.5, uFoto);",
    /* Свет по нормали: верх и низ, без источников. Солнце жёсткое,
       сверху-слева: его добавка ступенькой по нормали, как на Луне без
       воздуха - тень резкая. */
    "  vec3 sun = normalize(vec3(-0.55, 0.78, 0.3));",
    "  float hemi = n.y * 0.5 + 0.5;",
    "  vec3 svet = mix(uNiz, uVerh, hemi);",
    "  float sol = smoothstep(0.1, 0.35, dot(n, sun));",
    "  vec3 base = mix(uGrunt, uSklon, sol) * (0.6 + 0.8 * alb);",
    "  vec3 color = base * svet * (0.5 + 0.65 * sol);",
    /* Крупа реголита: их hash12 по мировым координатам. */
    "  color *= 1.0 + (hash12(vWorld.xz * 40.0) - 0.5) * 0.125;",
    /* Пульс свечения от станции, их формула. */
    "  float glowStrength = sin(vPos.x - uTime * 1.0 + 3.2) * 0.5 + 0.5;",
    "  float near = 1.0 - smoothstep(0.0, 9.0, length(vPos.xz));",
    "  color += uDymka * 0.06 * glowStrength * near;",
    /* Контактные тени. Синие, не чёрные: это их приём целиком. */
    "  for (int i = 0; i < 4; i++) {",
    "    vec3 s = uShadows[i];",
    "    if (s.z <= 0.0) continue;",
    "    float shadow = min(1.0, length((vPos.xz - s.xy) / s.z * 1.5));",
    "    shadow = pow(shadow, 2.0);",
    "    shadow += sin(uTime * 3.3 + vPos.z * 5.0) * 0.1 + 0.1;",
    "    shadow += sin(uTime * 3.1 + vPos.x * 4.0) * 0.1 + 0.1;",
    "    shadow = mix(0.5, 1.0, clamp(shadow, 0.0, 1.0));",
    "    color *= mix(vec3(0.5, 0.7, 1.0) * 0.55, vec3(1.0), shadow);",
    "  }",
    "  color = tuman(color, vMvz, vWorld.y);",
    /* Растворение кромки: их smoothstep, множитель под свой радиус. */
    "  float alpha = 1.0 - smoothstep(0.8, 1.0, length(vPos.xz) / uRadius);",
    "  gl_FragColor = vec4(dizer(color), alpha);",
    "}"
  ].join("\n");

  /* ── Земля ────────────────────────────────────────────────────
     Сфера с терминатором по тому же солнцу, облака шестью синусами,
     ободок атмосферы через Френеля. */
  var В_ЗЕМЛЯ = [
    "varying vec3 vN;",
    "varying vec3 vV;",
    "varying vec3 vP;",
    "varying vec2 vUv;",
    "varying float vMvz;",
    "void main(){",
    "  vUv = uv;",
    "  vN = normalize(mat3(modelMatrix) * normal);",
    "  vec4 w = modelMatrix * vec4(position, 1.0);",
    "  vP = position;",
    "  vV = normalize(cameraPosition - w.xyz);",
    "  vec4 mv = viewMatrix * w;",
    "  vMvz = mv.z;",
    "  gl_Position = projectionMatrix * mv;",
    "}"
  ].join("\n");
  var Ф_ЗЕМЛЯ = [
    ОБЩЕЕ_GLSL,
    "uniform sampler2D tEarth;",
    "uniform float uEst;",
    "varying vec3 vN;",
    "varying vec3 vV;",
    "varying vec3 vP;",
    "varying vec2 vUv;",
    "varying float vMvz;",
    "void main(){",
    "  vec3 n = normalize(vN);",
    "  vec3 sun = normalize(vec3(-0.55, 0.78, 0.3));",
    "  float day = smoothstep(-0.15, 0.25, dot(n, sun));",
    /* Настоящая Земля: карта NASA Blue Marble (общественное достояние).
       Пока она не доехала, суша рисуется шумом, как раньше. */
    "  float land = smoothstep(0.15, 0.35, sinenoise1(vP * 0.9 + 3.0));",
    "  vec3 more = vec3(0.16, 0.36, 0.72);",
    "  vec3 susha = vec3(0.34, 0.42, 0.30);",
    "  vec3 c = mix(more, susha, land);",
    "  vec3 tex = texture2D(tEarth, vec2(vUv.x + uTime * 0.004, vUv.y)).rgb;",
    "  c = mix(c, tex * 1.15, uEst);",
    "  float cloud = smoothstep(0.32, 0.62, sinenoise1(vP * 1.7 + uTime * 0.02));",
    "  c = mix(c, vec3(0.92, 0.94, 0.98), cloud * 0.55);",
    "  c *= 0.08 + 0.92 * day;",
    "  float fres = pow(1.0 - clamp(dot(n, normalize(vV)), 0.0, 1.0), 3.0);",
    "  c += vec3(0.56, 0.76, 1.0) * fres * (0.35 + 0.5 * day);",
    "  c = mix(c, c * 0.7 + nebo() * 0.3, uDen * 0.5);",
    "  c = tuman(c, vMvz, 40.0);",
    "  gl_FragColor = vec4(dizer(c), 1.0);",
    "}"
  ].join("\n");

  /* ── Дымка свечения и лучи ────────────────────────────────────
     Их дым: три выборки ОДНОЙ тайловой текстуры на масштабах 1, 2, 3 с
     одним ходом, ПЕРЕМНОЖЕННЫЕ, поэтому в результате нет ни повтора
     плитки, ни ровной каши. Лучи: их lightshaft, две выборки и
     круговой спад. */
  var В_ПЛОСК = [
    "varying vec2 vUv;",
    "varying vec3 vPos;",
    "varying float vMvz;",
    "void main(){",
    "  vUv = uv; vPos = position;",
    "  vec4 mv = modelViewMatrix * vec4(position, 1.0);",
    "  vMvz = mv.z;",
    "  gl_Position = projectionMatrix * mv;",
    "}"
  ].join("\n");
  var Ф_ДЫМКА = [
    ОБЩЕЕ_GLSL,
    "uniform sampler2D tWind;",
    "uniform vec3 uCol;",
    "uniform float uSila;",
    "uniform float uPoryv;",
    "varying vec2 vUv;",
    "varying vec3 vPos;",
    "void main(){",
    "  float t = -uTime * 0.075 * (1.0 + uPoryv);",
    "  vec2 uv = vUv * 2.0;",
    "  float wind = texture2D(tWind, uv * 1.0 + vec2(-t, t * 0.7)).r;",
    "  wind *= texture2D(tWind, uv * 2.0 + vec2(-t, t * 0.7)).r;",
    "  wind *= texture2D(tWind, uv * 3.0 + vec2(-t, t * 0.7)).r;",
    "  float r = length(vUv - 0.5) * 2.0;",
    "  float ring = smoothstep(0.25, 0.5, r) * (1.0 - smoothstep(0.7, 1.0, r));",
    "  float a = wind * 2.6 * ring * uSila;",
    "  gl_FragColor = vec4(uCol * a, a);",
    "}"
  ].join("\n");
  var Ф_ЛУЧ = [
    ОБЩЕЕ_GLSL,
    "uniform sampler2D tMap;",
    "uniform vec3 uCol;",
    "uniform float uAlpha;",
    "varying vec2 vUv;",
    "void main(){",
    "  float t = uTime * 0.12;",
    "  float noise = texture2D(tMap, vUv * vec2(1.0, 0.46) + vec2(t, t * 0.323)).r;",
    "  noise += texture2D(tMap, vUv * vec2(0.5, 0.25) + vec2(-t * 0.77, -t * 0.414)).r;",
    "  float circularGradient = pow(1.0 - clamp(length(vUv - 0.5) * 2.0, 0.0, 1.0), 2.0);",
    "  float a = noise * circularGradient * uAlpha;",
    "  gl_FragColor = vec4(uCol * a, a);",
    "}"
  ].join("\n");

  /* ── Пыль ─────────────────────────────────────────────────────
     Низовая, по ветру вдоль x, с завихрением шестью синусами. Порыв
     раз в 6-9 секунд удваивает ветер на полторы секунды - это и есть
     «метель», какой она бывает без воздуха: пыль, поднятая и опавшая. */
  /* Вершинному шейдеру общий кусок не годится: в нём nebo() читает
     gl_FragCoord, а его в вершинах нет, и программа не собиралась
     (поймано первым же снимком: «Vertex shader is not compiled»).
     Пыли из общего нужен только шум. */
  var В_ПЫЛЬ = [
    "uniform float uTime;",
    "#define sinlayer(fx, fy, fz) val += sin(dot(p, vec3(fx, fy, fz)));",
    "float sinenoise1(vec3 p){ float val = 0.0;",
    "  sinlayer(1.5, 3.4598, 1.234); sinlayer(3.12, -3.234, 4.221);",
    "  sinlayer(0.355, 2.3, -1.375); sinlayer(-0.156, -3.34, -0.4566);",
    "  sinlayer(-4.1235, -0.485, -1.45); sinlayer(2.54, -0.879, -2.123);",
    "  return val / 6.0; }",
    "attribute float aSeed;",
    "uniform float uH;",
    "uniform float uPoryv;",
    "uniform float uRadius;",
    "varying float vA;",
    "void main(){",
    "  vec3 p = position;",
    "  float t = uTime * (0.35 + aSeed * 0.4) * (1.0 + uPoryv * 1.2);",
    "  p.x += t * 1.6;",
    "  p.x = mod(p.x + uRadius, uRadius * 2.0) - uRadius;",
    "  p.y += sin(uTime * (0.7 + aSeed) + aSeed * 40.0) * 0.12 + uPoryv * aSeed * 0.5;",
    "  p.z += sinenoise1(p * 0.35 + uTime * 0.08) * 0.35;",
    "  vec4 mv = modelViewMatrix * vec4(p, 1.0);",
    "  gl_PointSize = clamp(0.32 / max(0.5, -mv.z) * uH * 0.5, 1.0, 9.0);",
    "  vA = (1.0 - smoothstep(0.6, 1.0, length(p.xz) / uRadius)) * (0.4 + 0.6 * aSeed);",
    "  gl_Position = projectionMatrix * mv;",
    "}"
  ].join("\n");
  var Ф_ПЫЛЬ = [
    "uniform vec3 uCol;",
    "uniform float uSila;",
    "varying float vA;",
    "void main(){",
    "  vec2 c = gl_PointCoord - 0.5;",
    "  float r = dot(c, c) * 4.0;",
    "  if (r > 1.0) discard;",
    "  float a = pow(1.0 - r, 1.8) * vA * uSila;",
    "  gl_FragColor = vec4(uCol, a);",
    "}"
  ].join("\n");

  /* ── Шумовая текстура ─────────────────────────────────────────
     Рисуется в холст при сборке: сумма синусов с ЦЕЛЫМИ частотами по
     обеим осям тайлится по краям сама собой, и шов не виден. В файл
     не кладём: 256x256 считается быстрее, чем качается. */
  function шумТекстура() {
    var Р = 256;
    var х = d.createElement("canvas"); х.width = Р; х.height = Р;
    var к = х.getContext("2d");
    var img = к.createImageData(Р, Р);
    var i, j, v;
    for (j = 0; j < Р; j++) {
      for (i = 0; i < Р; i++) {
        var u = i / Р * Math.PI * 2, w = j / Р * Math.PI * 2;
        v = 0;
        v += Math.sin(u * 1 + Math.cos(w * 2)) * 0.5;
        v += Math.sin(w * 3 + Math.sin(u * 2) * 1.3) * 0.35;
        v += Math.sin(u * 5 + w * 4) * 0.2;
        v += Math.sin(u * 9 - w * 7) * 0.1;
        v = v * 0.5 + 0.5;
        v = Math.pow(зажать(v, 0, 1), 1.4);
        var б = Math.round(v * 255), o = (j * Р + i) * 4;
        img.data[o] = б; img.data[o + 1] = б; img.data[o + 2] = б; img.data[o + 3] = 255;
      }
    }
    к.putImageData(img, 0, 0);
    var тек = new T.CanvasTexture(х);
    тек.wrapS = tek(); тек.wrapT = tek();
    function tek() { return T.RepeatWrapping; }
    return тек;
  }

  /* ── Фактура реголита ─────────────────────────────────────────
     Две карты, посчитанные при сборке: альбедо и нормали. Без них грунт
     вблизи это ровная плита с крупой в один пиксель, и это было видно на
     первом кадре. Высота это пять октав ценностного шума на решётке 64
     плюс мелкие крапины камней; нормаль из разностей высот. Файлов нет,
     512x512 считается быстрее, чем качается. */
  function реголит() {
    var Р = W.ступень === 2 ? 512 : 384, С = 64;
    var семя = 17;
    function сл() { семя = (семя * 9301 + 49297) % 233280; return семя / 233280; }
    var сет = new Float32Array(С * С);
    for (var i0 = 0; i0 < сет.length; i0++) сет[i0] = сл();
    function узел(x, y) { return сет[((y % С + С) % С) * С + ((x % С + С) % С)]; }
    function шум(u, v) {
      var x0 = Math.floor(u), y0 = Math.floor(v), fx = u - x0, fy = v - y0;
      fx = fx * fx * (3 - 2 * fx); fy = fy * fy * (3 - 2 * fy);
      var a = узел(x0, y0), b = узел(x0 + 1, y0), c = узел(x0, y0 + 1), d = узел(x0 + 1, y0 + 1);
      return (a + (b - a) * fx) * (1 - fy) + (c + (d - c) * fx) * fy;
    }
    var выс = new Float32Array(Р * Р);
    var k, j, i;
    for (j = 0; j < Р; j++) {
      for (i = 0; i < Р; i++) {
        var h = 0, амп = 1, ч = 4, сум = 0;
        for (k = 0; k < 5; k++) { h += шум(i / Р * ч, j / Р * ч) * амп; сум += амп; амп *= 0.5; ч *= 2; }
        h /= сум;
        выс[j * Р + i] = h;
      }
    }
    /* Крапины камней: полторы сотни мелких бугорков. */
    for (k = 0; k < 160; k++) {
      var cx = сл() * Р, cy = сл() * Р, r = 2 + сл() * 5, g = 0.15 + сл() * 0.25;
      for (j = -r; j <= r; j++) for (i = -r; i <= r; i++) {
        var dd = Math.hypot(i, j) / r; if (dd > 1) continue;
        var xx = ((Math.round(cx + i) % Р) + Р) % Р, yy = ((Math.round(cy + j) % Р) + Р) % Р;
        выс[yy * Р + xx] += g * (1 - dd * dd);
      }
    }
    var альб = d.createElement("canvas"); альб.width = Р; альб.height = Р;
    var норм = d.createElement("canvas"); норм.width = Р; норм.height = Р;
    var ка = альб.getContext("2d"), кн = норм.getContext("2d");
    var ia = ка.createImageData(Р, Р), inn = кн.createImageData(Р, Р);
    for (j = 0; j < Р; j++) {
      for (i = 0; i < Р; i++) {
        var o = (j * Р + i) * 4;
        var hh = выс[j * Р + i];
        var hx = выс[j * Р + (i + 1) % Р] - выс[j * Р + (i - 1 + Р) % Р];
        var hy = выс[((j + 1) % Р) * Р + i] - выс[((j - 1 + Р) % Р) * Р + i];
        var сила = 6.0;
        var nx = -hx * сила, ny = -hy * сила, nz = 1;
        var L = Math.hypot(nx, ny, nz);
        inn.data[o] = Math.round((nx / L * 0.5 + 0.5) * 255);
        inn.data[o + 1] = Math.round((ny / L * 0.5 + 0.5) * 255);
        inn.data[o + 2] = Math.round((nz / L * 0.5 + 0.5) * 255);
        inn.data[o + 3] = 255;
        var a = зажать(0.55 + (hh - 0.5) * 0.9, 0, 1) * 255;
        ia.data[o] = Math.round(a); ia.data[o + 1] = Math.round(a); ia.data[o + 2] = Math.round(a * 1.03); ia.data[o + 3] = 255;
      }
    }
    ка.putImageData(ia, 0, 0); кн.putImageData(inn, 0, 0);
    var tA = new T.CanvasTexture(альб), tN = new T.CanvasTexture(норм);
    tA.wrapS = tA.wrapT = T.RepeatWrapping; tN.wrapS = tN.wrapT = T.RepeatWrapping;
    return { альбедо: tA, нормали: tN };
  }

  /* ── Грунт с кратерами ────────────────────────────────────────
     Смещение считается в JS, потому что нормали нужны честные: шейдер
     мог бы сместить вершину, но не знал бы соседей и дал бы плоский
     свет. Кратер это воронка smoothstep с валом на 0.85..1.0 радиуса.
     Ни один не под станцией: центр держим пустым на 5 единиц. */
  function грунт(радиус) {
    var сег = W.ступень === 0 ? 90 : 160;
    var гео = new T.PlaneGeometry(радиус * 2, радиус * 2, сег, сег);
    гео.rotateX(-Math.PI / 2);
    var поз = гео.attributes.position;
    var кратеры = [];
    var семя = 7;
    function сл() { семя = (семя * 9301 + 49297) % 233280; return семя / 233280; }
    for (var k = 0; k < 9; k++) {
      var уг = сл() * Math.PI * 2, дал = 7 + сл() * (радиус * 0.8 - 7);
      кратеры.push({ x: Math.cos(уг) * дал, z: Math.sin(уг) * дал, r: 1 + сл() * 5, г: 0.25 + сл() * 0.6 });
    }
    /* Мелкие кратеры ближе к камере: крупные стоят за семь единиц и в
       кадр с двенадцати попадают краем, а без рельефа вблизи грунт
       читался плоской плитой. */
    for (var k1 = 0; k1 < 6; k1++) {
      var уг1 = сл() * Math.PI * 2, дал1 = 4.2 + сл() * 3.5;
      кратеры.push({ x: Math.cos(уг1) * дал1, z: Math.sin(уг1) * дал1, r: 0.5 + сл() * 1.1, г: 0.08 + сл() * 0.18 });
    }
    function шум(x, z) {
      var p = [x * 0.13, z * 0.13, 0.4];
      var v = 0;
      var L = [[1.5, 3.4598, 1.234], [3.12, -3.234, 4.221], [0.355, 2.3, -1.375],
               [-0.156, -3.34, -0.4566], [-4.1235, -0.485, -1.45], [2.54, -0.879, -2.123]];
      for (var i = 0; i < 6; i++) v += Math.sin(p[0] * L[i][0] + p[1] * L[i][1] + p[2] * L[i][2]);
      return v / 6;
    }
    for (var i = 0; i < поз.count; i++) {
      var x = поз.getX(i), z = поз.getZ(i);
      var y = шум(x, z) * 0.55 + шум(x * 2.7 + 11, z * 2.7) * 0.18;
      /* Площадка под станцией ровная: купол стоит, а не висит. */
      var центр = Math.hypot(x, z);
      y *= зажать((центр - 3.2) / 3.0, 0, 1);
      for (var k2 = 0; k2 < кратеры.length; k2++) {
        var к = кратеры[k2];
        var р = Math.hypot(x - к.x, z - к.z) / к.r;
        if (р < 1.15) {
          var чаша = -к.г * (1 - зажать(р / 0.85, 0, 1) * зажать(р / 0.85, 0, 1));
          var вал = к.г * 0.35 * Math.max(0, 1 - Math.abs(р - 0.95) / 0.2);
          y += чаша + вал;
        }
      }
      поз.setY(i, y);
    }
    поз.needsUpdate = true;
    гео.computeVertexNormals();
    return гео;
  }

  function цвет(h) { return new T.Color(h); }

  function собрать(мир) {
    if (собрано) return М.корень;
    W = мир; T = W.T;
    if (!T) return null;
    собрано = true;

    ГРАД.uColor1.value = цвет(ПАЛ.зенит);
    ГРАД.uColor2.value = цвет(ПАЛ.горизонт);
    ГРАД.uResolution.value = new T.Vector2(1, 1);

    М.корень = new T.Group();
    М.корень.name = "луна";
    М.радиус = 45;

    var шум = шумТекстура();
    М.шум = шум;

    /* Небо. */
    М.небоМат = new T.ShaderMaterial({
      uniforms: { uColor1: ГРАД.uColor1, uColor2: ГРАД.uColor2, uResolution: ГРАД.uResolution,
                  uTime: ГРАД.uTime, uDen: ГРАД.uDen, uAlpha: { value: 1 } },
      vertexShader: В_НЕБО, fragmentShader: Ф_НЕБО,
      side: T.BackSide, depthWrite: false, transparent: true, fog: false
    });
    М.небо = new T.Mesh(new T.SphereGeometry(300, 12, 12), М.небоМат);
    М.небо.scale.x = -1;
    М.небо.rotation.x = 16 * Math.PI / 180;
    М.небо.rotation.z = -16 * Math.PI / 180;
    М.небо.renderOrder = -50;
    М.небо.frustumCulled = false;
    М.корень.add(М.небо);

    /* Грунт. */
    М.тени = [];
    var тениU = [];
    for (var i = 0; i < 4; i++) тениU.push(new T.Vector3(0, 0, 0));
    var фактура = реголит();
    М.грунтМат = new T.ShaderMaterial({
      uniforms: {
        uColor1: ГРАД.uColor1, uColor2: ГРАД.uColor2, uResolution: ГРАД.uResolution,
        uTime: ГРАД.uTime, uDen: ГРАД.uDen,
        uGrunt: { value: цвет(ПАЛ.грунт) }, uSklon: { value: цвет(ПАЛ.склон) },
        uVerh: { value: цвет(ПАЛ.верх) }, uNiz: { value: цвет(ПАЛ.низ) },
        uDymka: { value: цвет(ПАЛ.дымка) },
        uShadows: { value: тениU }, uRadius: { value: М.радиус },
        tAlb: { value: фактура.альбедо }, tNor: { value: фактура.нормали },
        tFoto: { value: фактура.альбедо }, uFoto: { value: 0 }
      },
      vertexShader: В_ГРУНТ, fragmentShader: Ф_ГРУНТ,
      transparent: true, fog: false
    });
    М.грунт = new T.Mesh(грунт(М.радиус), М.грунтМат);
    М.грунт.renderOrder = -10;
    М.корень.add(М.грунт);

    /* Земля. */
    М.земляМат = new T.ShaderMaterial({
      uniforms: { uColor1: ГРАД.uColor1, uColor2: ГРАД.uColor2, uResolution: ГРАД.uResolution,
                  uTime: ГРАД.uTime, uDen: ГРАД.uDen,
                  tEarth: { value: null }, uEst: { value: 0 } },
      vertexShader: В_ЗЕМЛЯ, fragmentShader: Ф_ЗЕМЛЯ, fog: false
    });
    /* Карты с фотографий NASA (общественное достояние): Земля Blue
       Marble 2048x1024 и реголит с кадра Apollo 17, выровненный по
       освещению и сложенный зеркально в квадрат. Едут лениво, до
       приезда работают формулы. */
    var загр = new T.TextureLoader();
    загр.load("assets/gen/земля-2k.jpg", function (тек) {
      тек.colorSpace = T.SRGBColorSpace || тек.colorSpace;
      тек.wrapS = T.RepeatWrapping;
      М.земляМат.uniforms.tEarth.value = тек;
      М.земляМат.uniforms.uEst.value = 1;
    });
    загр.load("assets/gen/реголит.jpg", function (тек) {
      тек.colorSpace = T.SRGBColorSpace || тек.colorSpace;
      тек.wrapS = tek(); тек.wrapT = tek();
      function tek() { return T.MirroredRepeatWrapping; }
      М.грунтМат.uniforms.tFoto.value = тек;
      М.грунтМат.uniforms.uFoto.value = 1;
    });
    /* Земля дальше и меньше: на первом кадре с радиусом 9 на 62 единицах
       она занимала угол и резалась кромкой. */
    М.земля = new T.Mesh(new T.SphereGeometry(6, 40, 40), М.земляМат);
    /* Ниже: камера стоит на 2.2 над грунтом и смотрит вниз на десять
       градусов, и на 21 по высоте Земля резалась шапкой. */
    М.земля.position.set(30, 12, -80);
    М.земля.renderOrder = -40;
    М.корень.add(М.земля);

    /* Дымка свечения: кольцо над грунтом вокруг станции. */
    М.дымкаМат = new T.ShaderMaterial({
      uniforms: { uColor1: ГРАД.uColor1, uColor2: ГРАД.uColor2, uResolution: ГРАД.uResolution,
                  uTime: ГРАД.uTime, uDen: ГРАД.uDen, tWind: { value: шум },
                  uCol: { value: цвет(ПАЛ.дымка) }, uSila: { value: ПАЛ.дымкаСила },
                  uPoryv: { value: 0 } },
      vertexShader: В_ПЛОСК, fragmentShader: Ф_ДЫМКА,
      transparent: true, depthWrite: false, blending: T.AdditiveBlending, fog: false
    });
    М.дымка = new T.Mesh(new T.PlaneGeometry(15, 15), М.дымкаМат);
    М.дымка.rotation.x = -Math.PI / 2;
    М.дымка.position.y = 0.18;
    М.дымка.renderOrder = 5;
    М.корень.add(М.дымка);

    /* Лучей здесь больше нет: они переехали в купол, к арке. Два квада у
       грунта, снятые с igloo как есть, у нас ложились плоской лентой
       поперёк нижней части кадра и читались полосой света без источника
       (поймано пробой: без них низ кадра гаснет с 75 до 35). У igloo
       камера смотрит на стену, у нас на грунт под собой, и один и тот же
       квад ведёт себя по-разному. */
    М.лучи = [];

    /* Пыль. */
    var число = W.ступень === 0 ? 0 : (W.ступень === 1 ? 900 : 2200);
    if (число) {
      var гео = new T.BufferGeometry();
      var поз = new Float32Array(число * 3), семя = new Float32Array(число);
      var Rп = 18;
      for (var p = 0; p < число; p++) {
        поз[p * 3] = (Math.random() * 2 - 1) * Rп;
        поз[p * 3 + 1] = Math.random() * 1.6;
        поз[p * 3 + 2] = (Math.random() * 2 - 1) * Rп;
        семя[p] = Math.random();
      }
      гео.setAttribute("position", new T.BufferAttribute(поз, 3));
      гео.setAttribute("aSeed", new T.BufferAttribute(семя, 1));
      М.пыльМат = new T.ShaderMaterial({
        uniforms: { uColor1: ГРАД.uColor1, uColor2: ГРАД.uColor2, uResolution: ГРАД.uResolution,
                    uTime: ГРАД.uTime, uDen: ГРАД.uDen, uH: { value: 800 },
                    uPoryv: { value: 0 }, uRadius: { value: Rп },
                    uCol: { value: цвет(ПАЛ.пыль) }, uSila: { value: ПАЛ.пыльСила } },
        vertexShader: В_ПЫЛЬ, fragmentShader: Ф_ПЫЛЬ,
        transparent: true, depthWrite: false, blending: T.AdditiveBlending, fog: false
      });
      М.пыль = new T.Points(гео, М.пыльМат);
      М.пыль.frustumCulled = false;
      М.пыль.renderOrder = 7;
      М.корень.add(М.пыль);
    }

    М.порыв = { сила: 0, до: 6 + Math.random() * 3, длит: 0 };
    М.разм = new T.Vector2();
    g.addEventListener("rv-тема", function (е) { тема(е && е.detail); });
    тема(d.documentElement.getAttribute("data-тема") === "светлая" ? "светлая" : "тёмная");
    return М.корень;
  }

  function тема(имя) {
    ПАЛ = имя === "светлая" ? ДЕНЬ : НОЧЬ;
    if (!собрано) return;
    ГРАД.uColor1.value.setHex(ПАЛ.зенит);
    ГРАД.uColor2.value.setHex(ПАЛ.горизонт);
    ГРАД.uDen.value = имя === "светлая" ? 1 : 0;
    var у = М.грунтМат.uniforms;
    у.uGrunt.value.setHex(ПАЛ.грунт); у.uSklon.value.setHex(ПАЛ.склон);
    у.uVerh.value.setHex(ПАЛ.верх); у.uNiz.value.setHex(ПАЛ.низ);
    у.uDymka.value.setHex(ПАЛ.дымка);
    М.дымкаМат.uniforms.uCol.value.setHex(ПАЛ.дымка);
    М.дымкаМат.uniforms.uSila.value = ПАЛ.дымкаСила;
    for (var i = 0; i < М.лучи.length; i++) М.лучи[i].material.uniforms.uCol.value.setHex(ПАЛ.дымка);
    if (М.пыльМат) {
      М.пыльМат.uniforms.uCol.value.setHex(ПАЛ.пыль);
      М.пыльМат.uniforms.uSila.value = ПАЛ.пыльСила;
      /* Днём пыль чернилами, ночью светом: тот же переключатель, что у
         роя, иначе светлая пыль на светлом небе исчезает. */
      М.пыльМат.blending = имя === "светлая" ? T.NormalBlending : T.AdditiveBlending;
      М.пыльМат.needsUpdate = true;
    }
  }

  /* Контактная тень под предметом. До четырёх пятен: больше на одной
     площадке не бывает, а цикл в шейдере на четыре шага дешевле
     текстуры теней в сотни раз. */
  function тень(x, z, радиус) {
    if (!собрано) return null;
    var сп = М.грунтМат.uniforms.uShadows.value;
    for (var i = 0; i < сп.length; i++) {
      if (сп[i].z <= 0) { сп[i].set(x, z, радиус); return сп[i]; }
    }
    сп[0].set(x, z, радиус);
    /* Отдаём сам вектор: предмет, который переставили (купол уходит
       вправо на широком кадре), двигает тень за собой без новой записи. */
    return сп[0];
  }

  function кадр(доля, dt, часы, камера) {
    if (!собрано) return;
    ГРАД.uTime.value = часы;
    if (W.r && W.r.getDrawingBufferSize) {
      W.r.getDrawingBufferSize(М.разм);
      ГРАД.uResolution.value.copy(М.разм);
      if (М.пыльМат) М.пыльМат.uniforms.uH.value = М.разм.y || 800;
    }
    /* Порыв: раз в 6-9 секунд ветер вдвое сильнее на полторы секунды. */
    var п = М.порыв;
    п.до -= dt;
    if (п.до <= 0) { п.длит = 1.5; п.до = 6 + Math.random() * 3; }
    var цель = п.длит > 0 ? 1 : 0;
    if (п.длит > 0) п.длит -= dt;
    п.сила += (цель - п.сила) * (1 - Math.exp(-dt / 0.35));
    М.дымкаМат.uniforms.uPoryv.value = п.сила;
    if (М.пыльМат) М.пыльМат.uniforms.uPoryv.value = п.сила;
    /* Небо станции гаснет к концу акта: дальше идёт небо мира, и без
       спада на границе актов был бы щелчок цвета. */
    М.небоМат.uniforms.uAlpha.value = 1 - зажать((доля - 0.7) / 0.3, 0, 1);
  }

  g.RV_ЛУНА = {
    "собрать": собрать,
    "кадр": кадр,
    "тень": тень,
    "тема": тема,
    "градиент": ГРАД,
    /* Шумовая текстура наружу: купол строит свой луч из арки той же
       текстурой, а вторая такая же в видеопамяти была бы лишней. */
    "шум": function () { return М.шум || null; }
  };
})(window, document);
