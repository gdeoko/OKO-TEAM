/* СЦЕНА ТЕМЫ «ОКЕАН»: БЕСКРАЙНИЙ ОКЕАН И ГЛАВНОЕ - СОЛНЦЕ

   Слово владельца: «с водой это реалистичный океан бескрайний и главное
   солнце». Сцена собрана вокруг одной оси: солнце выглядывает из-за
   верхней кромки стеклянной кнопки, лучи расходятся вокруг неё, и от
   солнца через весь экран к зрителю идёт золотая дорожка из тысяч
   резких искр. Дорожка - позвоночник экрана, из неё выходит след замера.

   ── ОДИН ПОЛНОЭКРАННЫЙ ПРОХОД ────────────────────────────────────────
   Над водой нет ни одного предмета, только небо и солнце. Зеркальный
   проход Water.js отражал бы ровно это же небо ценой второй отрисовки
   кадра. Здесь отражение точное: луч отражается от нормали волны, и
   небо читается по его направлению той же функцией, что рисует само
   небо. Вода - пересечение луча камеры с плоскостью моря прямо в
   шейдере, поэтому океан бескрайний, а горизонт - идеально ровная линия
   без края геометрии. Два треугольника на весь мир.
   Приёмы нормалей и френеля по мотивам examples/jsm/objects/Water.js и
   Sky.js (three.js, MIT License, Copyright 2010-2023 three.js authors),
   переписаны под свою модель света.

   ── НЕБО ─────────────────────────────────────────────────────────────
   Снимок заката кладётся ОДНИМ масштабом по обеим осям: облака не
   сплюснуты и не растянуты. Прежняя шкала с ускорением к верху давила
   облака в полосы - отказались. Масштаб задан шириной: на экран идёт
   77 % ширины снимка по центру, у горизонта стоит строка снимка 0.12
   (собственное солнце снимка остаётся под горизонтом, рисуем своё).
   Выше солнца снимок сам уходит в синее небо с золотыми облаками - это
   и есть небо концепта. Поверх - грейд: к верху небо тянется в глубокий
   синий #0B2A55, золото держится возле азимута солнца, резкость облаков
   поднята локальным контрастом (снимок делится на свою размытую копию из
   мипа - выходит рисунок облаков, его и усиливаем).

   ── СОЛНЦЕ ───────────────────────────────────────────────────────────
   Маленький жёсткий диск (0.12 r кнопки, ядро 14 в HDR), плотный ореол
   и 11 тонких лучей. Лучи считаются аналитически: шум по углу вокруг
   солнца, возведённый в степень, - редкие узкие пики, гаснущие с
   расстоянием. Позади шапки (логотип) широкое свечение приглушено маской,
   чтобы «RocketVPN» читался.

   ── ДОРОЖКА ──────────────────────────────────────────────────────────
   Два слоя, как у настоящего солнца на воде:
     - золотое ядро: ровная тёплая колонна, дышит вместе с волной (блик по
       сглаженной нормали). Она светит сквозь стекло карточек;
     - искры: сетка ячеек в ТОЧКАХ ЭКРАНА, в каждой одна точка со своей
       фазой мерцания. Вероятность вспыхнуть = сила дорожки там x блик
       волны. Размер точки задан в пикселях, поэтому вблизи зрителя искра
       не раздувается в кляксу, как раньше у карты нормалей.
   Дальняя половина пути - честный острый блик по карте нормалей: там
   тексель меньше пикселя и искры сами мелкие.

   ── ВОЛНА ────────────────────────────────────────────────────────────
   Три длинные зыби 23-58 м дают катящиеся валы: светлые гребни,
   бирюзовое свечение насквозь против солнца, лёгкая пена на самых крутых
   склонах. Мелкая рябь - карта нормалей в трёх масштабах с поворотами и
   некратными шагами, координаты искривлены низкой частотой той же карты,
   поэтому повтор плитки не читается. Октавы гаснут по размеру пикселя на
   воде - вдали ничего не мерцает.

   ── КОМПОЗИЦИЯ ОТ ЯКОРЕЙ ─────────────────────────────────────────────
   Солнце: x = кнопка.x, y = max(кнопка.y - 1.10 r, низ шапки + 0.12 r).
   На высокой кнопке оно встаёт на её верхнюю кромку и «выглядывает».
   Горизонт: кнопка.y - 0.30 r, а когда солнце пришлось опустить, горизонт
   плавно уходит к кнопка.y - 0.15 r (солнце не должно сесть в воду).
   Наклон камеры: ndc горизонта = tg(наклон)/tg(fov/2) - ровный при любом
   азимуте. Источник следа: x = кнопка.x, y = кнопка.y + 1.35 r.

   Всё движение - функция t: заморозка времени даёт один и тот же кадр. */

(function () {
  "use strict";

  МИР.сцена("океан", function (о) {
    var T = о.THREE;
    var я = о.якоря;

    var ПОЛЕ_ЗРЕНИЯ = 52;       // вертикальный угол камеры, градусы
    var ВЫСОТА_ГЛАЗА = 12.0;    // метры над водой: взгляд с палубы, волны рядами до горизонта
    /* Кадр неба: доля ширины снимка на ширину экрана и строка снимка у
       горизонта (доли от низа). Файл уже обрезан под этот кадр, см. отчёт. */
    var СНИМОК = { ширина: 2048, высота: 1024, доляШирины: 1.0, строкаГоризонта: 0.0 };

    var сцена = new T.Scene();
    var камера = new T.Camera();

    /* Шейдер. Внутри строк только ASCII (кириллица роняет компиляцию).
       Всё экранное - в css-точках: uHalf = половина экрана, px() переводит
       ndc в точки от левого верхнего угла, как якоря.
       skyCol()   небо по ndc (может быть за пределами экрана - отражения);
       sun()      диск, ореол, лучи;
       swell()    три длинные зыби: высота и наклоны;
       ripples()  карта нормалей, три масштаба с поворотом и искривлением;
       sparks()   искры в сетке экранных пикселей. */
    var ВЕРШИНА = [
      "varying vec2 vNdc;",
      "void main(){ vNdc = position.xy; gl_Position = vec4(position.xy, 0.0, 1.0); }"
    ].join("\n");

    var ФРАГМЕНТ = [
      "precision highp float;",
      "uniform sampler2D tSky; uniform sampler2D tNorm;",
      "uniform vec3 uFwd, uUp, uRight; uniform vec2 uTan; uniform float uEye;",
      "uniform vec3 uSun; uniform vec2 uHalf; uniform vec2 uSunPx; uniform vec2 uSrcPx;",
      "uniform float uHorPx, uHeadPx, uBtnR, uSunRad;",
      "uniform vec4 uPlate;",   // x: plate u at sun x, y: plate u per css px, z: plate v at horizon, w: plate v per css px
      "uniform float uTime, uWarm, uFlare, uBandY, uBandAmp, uGlint, uRing, uRingAmp, uConn;",
      "varying vec2 vNdc;",
      "",
      "const vec3 LUMA = vec3(0.2126, 0.7152, 0.0722);",
      "vec3 ray(vec2 n){ return normalize(uFwd + n.x*uTan.x*uRight + n.y*uTan.y*uUp); }",
      "vec2 px(vec2 n){ return vec2((n.x + 1.0) * uHalf.x, (1.0 - n.y) * uHalf.y); }",
      "vec2 toNdc(vec3 d){ float z = max(dot(d, uFwd), 0.06); return vec2(dot(d, uRight) / (z*uTan.x), dot(d, uUp) / (z*uTan.y)); }",
      "float hash1(float x){ return fract(sin(x * 127.1) * 43758.5453); }",
      "float hash2(vec2 p){ p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }",
      "vec3 sunCol(){ return mix(vec3(1.0, 0.72, 0.40), vec3(1.0, 0.62, 0.28), uWarm); }",
      "",
      // ---- sky: uniformly scaled plate + grade ----
      "vec3 skyCol(vec2 p, float lod, float detail){",
      "  float above = uHorPx - p.y;",                         // css px above the horizon
      "  float dx = p.x - uSunPx.x;",
      "  vec2 uv = vec2(uPlate.x + dx * uPlate.y, uPlate.z + above * uPlate.w);",
      "  float fade = 1.0 - smoothstep(0.90, 1.0, uv.y);",
      "  uv = clamp(uv, vec2(0.001), vec2(0.999));",
      "  vec3 c = texture2D(tSky, uv, lod).rgb;",
      "  vec3 b = texture2D(tSky, uv, lod + 4.0).rgb;",
      "  float l = dot(c, LUMA), lb = max(dot(b, LUMA), 1e-3);",
      // local contrast: pull the cloud pattern out of the plate and amplify it
      "  float det = clamp(l / lb, 0.35, 2.6);",
      "  c = (c / max(l, 1e-4)) * lb * pow(det, 1.0 + detail);",
      "  float h = above / uHalf.y;",                          // height above horizon in half-screens
      "  float az = dx / uHalf.x;",
      "  float nearSun = exp(-az*az / 0.16);",
      // grade toward deep blue with height; the gold band hugs the horizon and the sun azimuth
      "  vec3 top = vec3(0.0034, 0.022, 0.090);",             // #0B2A55
      "  vec3 mid = vec3(0.0065, 0.048, 0.195);",             // #123E7A
      "  float hb = smoothstep(0.05 + 0.10*nearSun, 0.30 + 0.12*nearSun, h);",
      "  vec3 blue = mix(mid, top, smoothstep(0.18, 0.34, h));",
      "  float cl = dot(c, LUMA);",
      // clouds keep their light: lit edges stay warm gold, bodies take the blue
      "  vec3 lit = mix(vec3(1.0, 0.62, 0.30), vec3(1.0, 0.80, 0.55), smoothstep(0.1, 0.4, h)) * cl;",
      "  vec3 graded = mix(c, blue * (0.55 + 0.9 * pow(det, 1.4)) + lit * 0.55 * smoothstep(0.9, 1.6, det), hb);",
      "  graded = mix(graded, mix(graded, vec3(dot(graded, LUMA)) * vec3(0.55, 0.75, 1.05), 0.55), (1.0 - nearSun) * (1.0 - hb) * 0.6);",
      "  graded += vec3(1.0, 0.55, 0.22) * exp(-max(above, 0.0) / 9.0) * (0.12 + 0.55 * nearSun);",
      "  return graded;",
      "}",
      "",
      // the dome a wave facet reflects: the plate where the direction lands on screen,
      // an analytic gradient above it (facets see tens of degrees of sky)
      "vec3 domeCol(vec3 R){",
      "  vec2 rp = px(toNdc(R));",
      "  float az = (rp.x - uSunPx.x) / uHalf.x;",
      "  float cone = exp(-az*az / 0.07);",
      "  float e = R.y;",
      "  vec3 horC = mix(vec3(0.05, 0.10, 0.20), vec3(0.95, 0.52, 0.20), cone);",
      "  vec3 g = mix(horC, vec3(0.012, 0.070, 0.24), smoothstep(0.0, 0.10, e));",
      "  g = mix(g, vec3(0.004, 0.026, 0.10), smoothstep(0.10, 0.45, e));",
      "  float w = 0.45 * smoothstep(-30.0, 30.0, rp.y) * smoothstep(0.0, 0.02, e + 0.01) * cone;",
      "  if (w < 0.01) return g;",
      "  vec3 pl = skyCol(rp, 5.0, 0.0);",
      "  return mix(g, pl, w);",
      "}",
      "",
      // ---- sun: hard disc, halo, analytic god rays ----
      "float angNoise(float a, float n, float seed){",
      "  float x = a * n / 6.2831853 + seed;",
      "  float i = floor(x), f = fract(x);",
      "  float j = mod(i + 1.0, n);",
      "  float h0 = hash1(mod(i, n) + seed * 13.0), h1 = hash1(j + seed * 13.0);",
      "  return mix(h0, h1, f*f*(3.0-2.0*f));",
      "}",
      "vec3 sunLight(vec2 p, float inSky){",
      "  vec2 d = p - uSunPx;",
      "  float r = length(d);",
      "  float R = uSunRad * (1.0 + 0.20*uFlare);",
      "  vec3 s = sunCol();",
      "  float head = mix(0.10, 1.0, smoothstep(uHeadPx - 18.0, uHeadPx + 10.0, p.y));",
      "  vec3 c = vec3(0.0);",
      "  c += vec3(1.0, 0.93, 0.82) * (14.0 + 10.0*uFlare + 4.0*uConn) * (1.0 - smoothstep(R - 0.7, R + 0.7, r));",
      "  c += s * (1.4 + 1.4*uFlare) * exp(-max(r - R, 0.0) / (R * 0.45));",
      "  c += s * (0.35 + 0.4*uFlare + 0.25*uConn) * exp(-r / (R * 2.6)) * mix(0.35, 1.0, head);",
      "  c += s * (0.10 + 0.08*uConn) * exp(-r / (uBtnR * 1.1)) * head;",
      // eleven-ish thin streaks: two angular noise layers sharpened by a power
      "  if (r > uBtnR * 7.0) return c;",
      "  float a = atan(d.y, d.x);",
      "  float sw = 0.04 * sin(uTime * 0.21);",
      "  float n1 = pow(angNoise(a + sw, 11.0, 1.7), 9.0);",
      "  float n2 = pow(angNoise(a - sw * 0.7, 23.0, 5.3), 14.0);",
      "  float rays = n1 * 1.0 + n2 * 0.6;",
      "  float reach = exp(-r / (uBtnR * (1.9 + 0.8*uFlare)));",
      "  float start = smoothstep(R * 1.2, R * 3.5, r);",
      "  c += s * rays * reach * start * (1.1 + 1.0*uFlare + 0.3*uConn) * mix(0.30, 1.0, inSky) * head;",
      "  return c;",
      "}",
      "",
      // ---- swells: three long Gerstner-like trains ----
      "void swell(vec2 q, float t, float foot, out float h, out vec2 g){",
      "  h = 0.0; g = vec2(0.0);",
      "  vec2 D[4]; float L[4]; float A[4];",
      "  D[0] = normalize(vec2( 0.30, 1.0));  L[0] = 58.0; A[0] = 0.75;",
      "  D[1] = normalize(vec2(-0.62, 0.78)); L[1] = 37.0; A[1] = 0.50;",
      "  D[2] = normalize(vec2( 0.85, 0.52)); L[2] = 23.0; A[2] = 0.30;",
      "  D[3] = normalize(vec2(-0.20, 1.0));  L[3] = 8.7;  A[3] = 0.10;",
      "  for (int i = 0; i < 4; i++) {",
      "    float k = 6.2831853 / L[i];",
      "    float aa = 1.0 - smoothstep(0.08, 0.6, foot / L[i]);",
      "    float w = sqrt(9.81 * k);",
      "    float ph = k * dot(D[i], q) + w * t + float(i) * 2.1;",
      "    float s = sin(ph) * 0.5 + 0.5;",
      "    float sh = pow(s, 2.2);",                             // sharp crests, wide troughs
      "    h += aa * A[i] * (sh - 0.33) * 2.0;",
      "    float dsh = 2.2 * pow(max(s, 1e-4), 1.2) * cos(ph);",
      "    g += aa * A[i] * dsh * k * D[i];",
      "  }",
      "}",
      "",
      "vec2 rot(vec2 v, float a){ float c = cos(a), s = sin(a); return vec2(c*v.x - s*v.y, s*v.x + c*v.y); }",
      "vec2 ripples(vec2 q, float t, float foot){",
      "  vec2 w = texture2D(tNorm, q / 61.3 + vec2(t / 97.0, 0.0)).rg - 0.5;",
      "  vec2 qw = q + w * 3.1;",
      "  vec2 u0 = rot(qw, 0.37) / 11.7 + vec2(t / 23.0, t / 31.0);",
      "  vec2 u1 = rot(qw, -1.13) / 5.13 + vec2(-t / 19.0, t / 27.0);",
      "  vec2 u2 = rot(qw, 2.21) / 2.09 + vec2(t / 11.0, -t / 13.7);",
      "  vec2 u3 = rot(qw, -0.71) / 0.87 + vec2(-t / 7.3, -t / 9.1);",
      "  float f0 = 1.0 - smoothstep(0.03, 0.15, foot / 11.7);",
      "  float f1 = 1.0 - smoothstep(0.03, 0.15, foot / 5.13);",
      "  float f2 = 1.0 - smoothstep(0.03, 0.15, foot / 2.09);",
      "  float f3 = 1.0 - smoothstep(0.03, 0.15, foot / 0.87);",
      "  float nr = smoothstep(0.004, 0.0015, foot / 2.09);",
      "  vec2 n = (texture2D(tNorm, u0).rg * 2.0 - 1.0) * mix(1.0, 0.45, nr) * f0",
      "         + rot(texture2D(tNorm, u1).rg * 2.0 - 1.0, 1.13) * mix(0.75, 0.55, nr) * f1",
      "         + rot(texture2D(tNorm, u2).rg * 2.0 - 1.0, -2.21) * mix(0.55, 0.70, nr) * f2",
      "         + rot(texture2D(tNorm, u3).rg * 2.0 - 1.0, 0.71) * mix(0.45, 0.85, nr) * f3;",
      "  return n;",
      "}",
      "",
      // ---- sparkles: one point per screen cell, pin sharp in device pixels ----
      "float sparks(vec2 fc, float prob, float t, float cell){",
      "  vec2 id = floor(fc / cell);",
      "  vec2 f = fc - id * cell;",
      "  float h0 = hash2(id), h1 = hash2(id + 17.31), h2 = hash2(id + 41.7), h3 = hash2(id + 7.9);",
      "  if (h0 > prob) return 0.0;",
      "  vec2 c = (0.25 + 0.5 * vec2(h1, h2)) * cell;",
      "  float life = fract(t * (0.9 + 1.6 * h3) + h1 * 7.0);",
      "  float env = smoothstep(0.0, 0.12, life) * (1.0 - smoothstep(0.22, 0.55, life));",
      "  vec2 e = f - c;",
      "  float core = exp(-dot(e, e) / 0.55);",
      "  float star = exp(-abs(e.x) / 0.9) * exp(-abs(e.y) * 2.2) + exp(-abs(e.y) / 0.9) * exp(-abs(e.x) * 2.2);",
      "  return env * (core + 0.35 * star) * (0.6 + 0.8 * h2);",
      "}",
      "",
      "void main(){",
      "  vec3 d = ray(vNdc);",
      "  vec2 p = px(vNdc);",
      "  float wy = max(fwidth(d.y), 1e-5);",
      "  float inSky = smoothstep(-wy, wy, d.y);",
      "  vec3 sunL = sunLight(p, inSky);",
      "  vec3 col;",
      "  if (d.y > -wy) {",
      "    col = skyCol(p, 0.0, 0.35);",
      "  }",
      "  if (d.y < wy) {",
      // ---- water ----
      "    float dy = min(d.y, -wy*0.5);",
      "    float dist = min(uEye / -dy, 8000.0);",
      "    vec2 q = d.xz * dist;",
      "    float foot = max(length(dFdx(q)), length(dFdy(q)));",
      "    float far = 1.0 - exp(-dist / 500.0);",
      "    float h; vec2 g;",
      "    swell(q, uTime, foot, h, g);",
      "    vec2 rp = ripples(q, uTime, foot);",
      "    float near = smoothstep(uHorPx + 60.0, uHalf.y * 2.0, p.y);",
      "    float rs = mix(0.42, 0.40, near);",
      "    vec3 N = normalize(vec3(-g.x + rp.x*rs, 1.0, -g.y + rp.y*rs));",
      "    vec3 Ns = normalize(vec3(-g.x + rp.x*rs*0.35, 1.0, -g.y + rp.y*rs*0.35));",
      "    vec3 V = -d;",
      "    float nv = max(dot(N, V), 0.0);",
      "    float F = 0.02 + 0.98 * pow(1.0 - nv, 5.0);",
      "    vec3 R = reflect(d, N);",
      "    float rough = 0.10 * smoothstep(40.0, 600.0, dist);",
      "    R.y = sqrt(R.y*R.y + rough*rough);",
      "    R = normalize(R);",
      "    vec3 refl = domeCol(R);",
      "    float raz = (px(toNdc(R)).x - uSunPx.x) / uHalf.x;",
      "",
      "    vec2 toSun = normalize(uSun.xz);",
      "    float back = pow(max(dot(normalize(d.xz), toSun), 0.0), 3.0);",
      "    float crest = smoothstep(0.25, 1.0, h) * (0.6 + 0.8 * clamp(rp.x * 0.5 + 0.5, 0.0, 1.0));",
      "    float slope = length(g);",
      "    vec3 deep = vec3(0.0035, 0.024, 0.070);",
      "    vec3 turq = vec3(0.0, 0.075, 0.085);",
      "    float faceV = clamp(dot(N.xz, normalize(d.xz)) * -6.0 + 0.4, 0.0, 1.0);",
      "    float sunward = exp(-pow((p.x - uSunPx.x) / (uHalf.x * 0.55), 2.0));",
      "    vec3 body = deep * (0.8 + 0.4 * (1.0 - far)) + turq * crest * sunward * (0.35 + 0.65*back) * (0.4 + 0.6*faceV) * (1.0 - far);",
      "    vec3 col_w = body * (1.0 - F) + refl * F;",
      // crest lightening and faint foam on the steepest faces
      "    float fn = 0.5 + 0.35 * (rp.x - rp.y);",
      "    float foam = smoothstep(0.80, 0.98, crest * 0.5 + slope * 1.6 + (fn - 0.5) * 1.4) * (1.0 - far);",
      "    col_w += vec3(0.10, 0.16, 0.20) * foam * 0.18;",
      "",
      // ---- sun path ----
      "    float dxs = (p.x - uSunPx.x);",
      "    float below = max(p.y - uHorPx, 0.0);",
      "    float W = uHalf.x * mix(0.09, 0.17, smoothstep(0.0, 0.45*uHalf.y, below));",
      "    float lane = exp(-dxs*dxs / (W*W));",
      "    float laneWide = exp(-dxs*dxs / (W*W*2.6));",
      "    vec3 H = normalize(uSun + V);",
      "    float along = dot(H.xz, toSun);",
      "    vec2 side = H.xz - along * toSun;",
      "    float sq = mix(1.0, 0.16, smoothstep(0.0, 0.2, -d.y));",
      "    vec3 Hm = normalize(vec3(side.x + along*toSun.x*sq, H.y, side.y + along*toSun.y*sq));",
      "    float nhs = max(dot(Ns, Hm), 0.0);",
      "    float nh = max(dot(N, Hm), 0.0);",
      "    float breathe = 0.25 + 0.75 * smoothstep(0.93, 1.0, nhs);",
      "    float warmB = 1.0 + 0.35*uWarm;",
      "    vec3 gold = vec3(1.0, 0.50, 0.13);",                  // #FFC46B in linear
      "    float fadeTop = smoothstep(0.0, 14.0, below);",
      "    float hot = exp(-below / (uBtnR * 0.9));",
      "    float facet = pow(nh, 140.0);",
      "    col_w += gold * lane * (0.06 + 0.30 * breathe + 1.1 * facet) * (0.55 + 1.2 * hot) * warmB * fadeTop;",
      // strike band: head plus comet tail travelling from the horizon down past the source
      "    float by = p.y - uBandY;",
      "    float band = uBandAmp * (exp(-by*by / 50.0) + (by < 0.0 ? exp(by / 55.0) * 0.5 : 0.0));",
      "    col_w += sunCol() * band * laneWide * (0.35 + 7.0 * pow(nh, 60.0));",
      // honest sharp specular where texels are smaller than pixels (far half)
      "    float spec = pow(nh, 900.0) * (1.0 - near) * laneWide;",
      "    col_w += sunCol() * spec * (5.0 + 10.0*band) * warmB;",
      // pin sparkles everywhere along the path
      "    float waveP = smoothstep(0.80, 1.0, nhs);",
      "    float prob = laneWide * (0.015 + 0.6 * waveP * waveP) * (0.35 + 0.65*near) + band * laneWide * 0.9;",
      "    vec2 fc = gl_FragCoord.xy;",
      "    float sp = sparks(fc, prob, uTime, 5.0) + 0.6 * sparks(fc + 2.5, prob * 0.6, uTime * 1.3 + 3.0, 3.0) * (1.0 - near);",
      "    col_w += vec3(1.0, 0.86, 0.62) * sp * (2.2 + 7.0*band + 0.8*uConn) * warmB * fadeTop;",
      // ring of sparkles spreading around the source on arrival
      "    vec2 rs2 = (p - uSrcPx) * vec2(1.0, 2.6);",
      "    float rr = length(rs2);",
      "    float ringL = uRingAmp * exp(-pow((rr - uRing) / 5.0, 2.0));",
      "    col_w += sunCol() * ringL * (0.25 + 6.0 * sparks(fc, 0.9, uTime * 2.0, 4.0));",
      "",
      // haze to the horizon in the colour of the sky just above it
      "    float hazeAz = (p.x - uSunPx.x) / uHalf.x;",
      "    vec3 haze = mix(vec3(0.030, 0.075, 0.17), vec3(0.95, 0.50, 0.19), exp(-hazeAz*hazeAz / 0.05));",
      "    float fog = 1.0 - exp(-dist * 0.0016);",
      "    col_w = mix(col_w, haze * 0.95, fog * 0.92);",
      // deepen the lower screen for the glass cards, but not the glitter spine
      "    float low = smoothstep(uHorPx + uBtnR * 1.5, uHalf.y * 2.0, p.y);",
      "    col_w *= mix(1.0, 0.62, low * (1.0 - lane * 0.6));",
      // source glint
      "    vec2 sd = p - uSrcPx;",
      "    float sg = uGlint * (exp(-dot(sd, sd) / 6.0) * 10.0 + exp(-dot(sd, sd) / 90.0) * 1.2 + exp(-abs(sd.y) / 1.3) * exp(-abs(sd.x) / (uBtnR * 0.22)) * 1.1);",
      "    col_w += vec3(1.0, 0.86, 0.60) * sg;",
      "    col = d.y > -wy ? mix(col_w, col, inSky) : col_w;",
      "  }",
      "  col += sunL;",
      "  gl_FragColor = vec4(col, 1.0);",
      "}"
    ].join("\n");

    var у = {
      tSky: { value: null }, tNorm: { value: null },
      uFwd: { value: new T.Vector3(0, 0, -1) }, uUp: { value: new T.Vector3(0, 1, 0) }, uRight: { value: new T.Vector3(1, 0, 0) },
      uTan: { value: new T.Vector2(.5, .5) }, uEye: { value: ВЫСОТА_ГЛАЗА },
      uSun: { value: new T.Vector3(0, .05, -1) },
      uHalf: { value: new T.Vector2(215, 466) },
      uSunPx: { value: new T.Vector2() }, uSrcPx: { value: new T.Vector2() },
      uHorPx: { value: 124 }, uHeadPx: { value: 64 }, uBtnR: { value: 57.5 }, uSunRad: { value: 7 },
      uPlate: { value: new T.Vector4(.5, 1, .12, 1) },
      uTime: { value: 0 }, uWarm: { value: 0 }, uFlare: { value: 0 },
      uBandY: { value: -999 }, uBandAmp: { value: 0 }, uGlint: { value: 0 },
      uRing: { value: 0 }, uRingAmp: { value: 0 }, uConn: { value: 0 }
    };
    var материал = new T.ShaderMaterial({
      vertexShader: ВЕРШИНА, fragmentShader: ФРАГМЕНТ, uniforms: у,
      depthTest: false, depthWrite: false
    });
    var геометрия = new T.PlaneGeometry(2, 2);
    var полотно = new T.Mesh(геометрия, материал);
    полотно.frustumCulled = false;
    сцена.add(полотно);

    полотно.visible = false;
    var текстуры = [];
    var ждём = 2;
    var снята = false;
    function пришла() { ждём -= 1; if (ждём === 0) полотно.visible = true; }
    function взять(т) { if (снята) { т.dispose(); return false; } текстуры.push(т); return true; }
    о.загрузить("ассеты/мир/океан/небо.webp", true).then(function (т) {
      т.wrapS = T.ClampToEdgeWrapping; т.wrapT = T.ClampToEdgeWrapping;
      т.generateMipmaps = true; т.minFilter = T.LinearMipmapLinearFilter; т.needsUpdate = true;
      if (!взять(т)) return;
      if (т.image && т.image.width) { СНИМОК.ширина = т.image.width; СНИМОК.высота = т.image.height; разложить(); }
      у.tSky.value = т; пришла();
    }).catch(function () {});
    о.загрузить("ассеты/мир/океан/волны-нормали.jpg", false).then(function (т) {
      т.wrapS = T.RepeatWrapping; т.wrapT = T.RepeatWrapping;
      т.generateMipmaps = true; т.minFilter = T.LinearMipmapLinearFilter; т.needsUpdate = true;
      if (!взять(т)) return;
      у.tNorm.value = т; пришла();
    }).catch(function () {});

    о.линза([0.25, 0.88, 1.0], 1);
    о.свечение(0.75, 1.0);
    о.экспозиция(1.0);

    /* ── КОМПОЗИЦИЯ ────────────────────────────────────────────────── */

    var кадрКнопки = { x: 215, y: 146, r: 57.5, есть: false };
    var низШапки = 64, низЗнака = 57;
    var ш0 = 430, в0 = 932;
    var вперёд = new T.Vector3(), вверх = new T.Vector3(), вправо = new T.Vector3(1, 0, 0);
    var солнце = new T.Vector3();

    function кнопкаИзЯкорей() {
      var к = я.кнопка;
      if (к.видна && к.r > 4) {
        кадрКнопки.x = к.x; кадрКнопки.y = к.y; кадрКнопки.r = к.r; кадрКнопки.есть = true;
      } else if (!кадрКнопки.есть) {
        var м = (я.ширина || 430) / 430;
        кадрКнопки.x = (я.ширина || 430) / 2; кадрКнопки.y = 146 * м; кадрКнопки.r = 74 * м;
      }
    }

    /* Низ шапки меряем по живой разметке: на телефоне с вырезом шапка
       ниже на отступ безопасной зоны, и солнце должно уйти вместе с ней. */
    function мерятьШапку() {
      try {
        var ш = document.querySelector(".шапка"), т = document.getElementById("телефон");
        if (ш && т) {
          var а = ш.getBoundingClientRect(), б = т.getBoundingClientRect();
          if (а.height > 0) низШапки = а.bottom - б.top;
          var з = document.querySelector(".знак-места");
          var зк = з && з.getBoundingClientRect();
          низЗнака = зк && зк.height > 0 ? зк.bottom - б.top : низШапки - 7;
        }
      } catch (о) {}
    }

    function разложить() {
      var ш = я.ширина || ш0, в = я.высота || в0;
      ш0 = ш; в0 = в;
      кнопкаИзЯкорей();
      мерятьШапку();
      var б = кадрКнопки;
      var тY = Math.tan(ПОЛЕ_ЗРЕНИЯ * Math.PI / 360), тX = тY * ш / в;
      у.uTan.value.set(тX, тY);
      у.uHalf.value.set(ш / 2, в / 2);
      у.uBtnR.value = б.r;
      у.uHeadPx.value = низЗнака;

      var солнцеИдеал = б.y - 1.10 * б.r;
      var радиусСолнца = 0.13 * б.r;
      var солнцеY = Math.max(солнцеИдеал, низЗнака + 1.1 * радиусСолнца);
      var сдвиг = Math.min(1, Math.max(0, (солнцеY - солнцеИдеал) / (0.3 * б.r)));
      var yГоризонт = б.y - (0.30 - 0.15 * сдвиг) * б.r;
      var ndcГ = 1 - 2 * yГоризонт / в;
      var наклон = Math.atan(ndcГ * тY);
      вперёд.set(0, -Math.sin(наклон), -Math.cos(наклон));
      вверх.set(0, Math.cos(наклон), -Math.sin(наклон));
      у.uFwd.value.copy(вперёд); у.uUp.value.copy(вверх); у.uRight.value.copy(вправо);
      у.uHorPx.value = yГоризонт;

      var sx = 2 * б.x / ш - 1, sy = 1 - 2 * солнцеY / в;
      солнце.copy(вперёд).addScaledVector(вправо, sx * тX).addScaledVector(вверх, sy * тY).normalize();
      у.uSun.value.copy(солнце);
      у.uSunPx.value.set(б.x, солнцеY);
      у.uSunRad.value = радиусСолнца;

      /* Снимок одним масштабом: ширина экрана = доля ширины снимка. */
      var пикселейСнимкаНаТочку = СНИМОК.доляШирины * СНИМОК.ширина / ш;
      у.uPlate.value.set(0.5, пикселейСнимкаНаТочку / СНИМОК.ширина,
        СНИМОК.строкаГоризонта, пикселейСнимкаНаТочку / СНИМОК.высота);

      у.uSrcPx.value.set(б.x, б.y + 1.35 * б.r);
    }

    /* ── СОБЫТИЯ ───────────────────────────────────────────────────── */

    var удар = -100, конецУдара = -100, ряд = -100;
    var тепло = { из: 0, в: 0, когда: -100 };
    var сейчас = 0;
    var ПРОБЕГ = 0.5;

    function плавно(x) { x = Math.min(1, Math.max(0, x)); return x * x * (3 - 2 * x); }
    function теплоНа(t) { return тепло.из + (тепло.в - тепло.из) * плавно((t - тепло.когда) / 1.4); }

    function событие(имя, д) {
      if (имя === "удар") {
        if (д && д.фаза === "конец") конецУдара = сейчас; else удар = сейчас;
      } else if (имя === "ряд") {
        if (!д || д.живой !== false) ряд = сейчас;
      } else if (имя === "подключено" || имя === "подключаемся" || имя === "отключено") {
        var цель = имя === "подключено" ? 1 : имя === "подключаемся" ? 0.4 : 0;
        тепло.из = теплоНа(сейчас); тепло.в = цель; тепло.когда = сейчас;
      }
    }

    /* ── КАДР ──────────────────────────────────────────────────────── */

    function кадр(t) {
      сейчас = t;
      var к = я.кнопка;
      if ((к.видна && (Math.abs(к.x - кадрКнопки.x) > 2 || Math.abs(к.y - кадрКнопки.y) > 2 || Math.abs(к.r - кадрКнопки.r) > 2)) ||
          Math.abs((я.ширина || ш0) - ш0) > 2 || Math.abs((я.высота || в0) - в0) > 2) разложить();

      у.uTime.value = t;
      var тп = теплоНа(t);
      у.uWarm.value = тп;
      у.uConn.value = тп;

      /* Удар: вспышка солнца, затем светлая полоса с хвостом бежит от
         горизонта по дорожке, проходит источник и гаснет на 1.5 r ниже.
         Часть пути вне линзы - иначе пробег прятался за кнопкой. */
      var б = кадрКнопки;
      var пУ = t - удар;
      у.uFlare.value = пУ >= 0 && пУ < 1.4 ? Math.exp(-пУ / 0.30) * плавно(пУ / 0.05) : 0;
      var отY = у.uHorPx.value + 4, доY = б.y + 2.85 * б.r;
      if (пУ >= 0 && пУ < ПРОБЕГ + 0.45) {
        var доля = Math.min(1, пУ / ПРОБЕГ);
        var ход = 1 - Math.pow(1 - доля, 1.7);
        у.uBandY.value = отY + (доY - отY) * ход;
        у.uBandAmp.value = пУ < ПРОБЕГ ? плавно(пУ / 0.06) : Math.max(0, 1 - (пУ - ПРОБЕГ) / 0.45);
      } else {
        у.uBandAmp.value = 0; у.uBandY.value = -999;
      }
      /* Прибытие: волна проходит источник примерно на 70 % пробега.
         Там вспыхивает искра и по воде расходится кольцо искр (0.35 с). */
      var прибытие = ПРОБЕГ * 0.62;
      var пП = пУ - прибытие;
      if (пП >= 0 && пП < 0.5) {
        у.uRing.value = б.r * (0.1 + 1.1 * (1 - Math.pow(1 - пП / 0.5, 2)));
        у.uRingAmp.value = (1 - пП / 0.5) * плавно(пП / 0.04);
      } else { у.uRingAmp.value = 0; }
      var г = 0;
      if (пП >= 0 && пП < 2) г += Math.exp(-пП / 0.35);
      var пК = t - конецУдара;
      if (пК >= 0 && пК < 1.5) г += 0.5 * Math.exp(-пК / 0.3);
      var пР = t - ряд;
      if (пР >= 0 && пР < 1) г += 0.2 * Math.exp(-пР / 0.18);
      у.uGlint.value = г;
    }

    разложить();

    return {
      сцена: сцена,
      камера: камера,
      кадр: кадр,
      размер: function () { разложить(); },
      источник: function () {
        кнопкаИзЯкорей();
        return { x: кадрКнопки.x, y: кадрКнопки.y + 1.35 * кадрКнопки.r };
      },
      событие: событие,
      уничтожить: function () {
        снята = true;
        геометрия.dispose(); материал.dispose();
        текстуры.forEach(function (т) { т.dispose(); });
        текстуры.length = 0;
      }
    };
  });
})();
