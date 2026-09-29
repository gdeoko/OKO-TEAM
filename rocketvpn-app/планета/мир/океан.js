/* СЦЕНА ТЕМЫ «ОКЕАН»: БЕСКРАЙНИЙ ОКЕАН И ГЛАВНОЕ - СОЛНЦЕ

   Слово владельца: «с водой это реалистичный океан бескрайний и главное
   солнце». Поэтому сцена собрана вокруг одной оси: солнце стоит над
   стеклянной кнопкой, и от него через весь экран к зрителю бежит
   солнечная дорожка из тысяч резких бликов. Дорожка - позвоночник
   экрана, из неё же выходит след замера пинга.

   ── ПОЧЕМУ ОДИН ПОЛНОЭКРАННЫЙ ПРОХОД, А НЕ ПЛОСКОСТЬ С ЗЕРКАЛОМ ─────
   Над водой в этой сцене нет ни одного предмета, только небо и солнце.
   Зеркальный проход (как в Water.js) отражал бы ровно то же небо ценой
   второй отрисовки кадра. Здесь отражение считается точно: из каждой
   точки воды луч отражается от нормали волны, и небо читается по его
   направлению той же функцией, что рисует само небо. Выходит дешевле
   вдвое и честнее: отражение облаков и солнца совпадает с небом до
   пикселя. Вода тоже не сетка, а пересечение луча камеры с плоскостью
   моря прямо в шейдере - поэтому океан действительно бескрайний, а
   горизонт идеально ровная линия без края геометрии. Два треугольника
   на весь мир.

   Волны: карта нормалей Water.js (three.js, MIT) в четырёх масштабах с
   разным ходом, поверх неё аналитическая зыбь из пяти длинных волн -
   она даёт катящиеся валы, светлые склоны и тёмные впадины. Приёмы
   шума нормалей взяты из examples/jsm/objects/Water.js (MIT License,
   Copyright 2010-2023 three.js authors), переписаны под свою модель
   света.

   ── НЕБО ───────────────────────────────────────────────────────────
   Небо - снимок заката 3840x2160: нижний край - горизонт, солнце по
   центру на 8.5 % от низа. Направление луча переводится в координаты
   снимка: азимут в u, высота над горизонтом в v. До солнца и чуть выше
   шкала линейная и одинаковая по обеим осям, поэтому солнце круглое.
   Выше солнца шкала плавно ускоряется: на экране видно всего
   полтора десятка градусов неба, и без ускорения весь верх был бы
   оранжевым. С ускорением наверх попадает синее небо с золотыми
   облаками, как в концепте, а у горизонта облака сплюснуты - как у
   настоящих облаков у горизонта.

   ── СВЕТ ВОДЫ ──────────────────────────────────────────────────────
   Френель Шлика (вода 0.02): вблизи видна глубина, вдали - небо.
   Тело воды: глубокий сапфир, на гребнях против солнца бирюзовое
   подповерхностное свечение. Солнечная дорожка двумя слоями:
     - мягкое золото: широкий блик по сглаженной нормали;
     - искры: очень узкий блик по полной нормали. Физически при солнце
       в трёх градусах над горизонтом до зрителя блики не дошли бы -
       нужны склоны в двадцать градусов. Поэтому продольная часть
       полувектора (вдоль направления на солнце) сжата: дорожка тянется
       до низа экрана, а поперечная часть честная - ширина дорожки и
       рисунок искр остаются настоящими.
   Дымка к горизонту берёт цвет самого неба у горизонта на том же
   азимуте: дальняя вода растворяется в солнечном свете, а не в сером.

   ── КОМПОЗИЦИЯ ОТ ЯКОРЕЙ ──────────────────────────────────────────
   Горизонт на y = кнопка.y - 0.30 r, центр солнца x = кнопка.x,
   y = кнопка.y - 1.10 r. Наклон камеры считается так, чтобы горизонт
   лёг ровно туда: ndc горизонта = tg(наклон) / tg(fov/2) при любом
   азимуте, поэтому горизонт строго ровный. Направление на солнце -
   обратная проекция нужной точки экрана. Источник следа - точка
   дорожки под кнопкой: x = кнопка.x, y = кнопка.y + 1.35 r.

   Всё движение - функция t: заморозка времени даёт один и тот же кадр. */

(function () {
  "use strict";

  МИР.сцена("океан", function (о) {
    var T = о.THREE;
    var я = о.якоря;

    var ПОЛЕ_ЗРЕНИЯ = 52;       // вертикальный угол камеры, градусы
    var ВЫСОТА_ГЛАЗА = 3.2;     // метры над водой
    var СОЛНЦЕ_В_СНИМКЕ = { u: 1916 / 3840, v: (2160 - 1976) / 2160 };
    var ВЕРХ_СНИМКА = 0.90;     // какая высота снимка встаёт у верхнего края экрана

    var сцена = new T.Scene();
    var камера = new T.Camera();   // сцена рисует себя сама, камера движку для порядка

    /* Шейдер. Пояснения к нему - здесь, внутри строк только ASCII.
       ray()      луч камеры по ndc точки;
       skyAt()    небо по направлению: снимок + солнце с запасом яркости;
       swell()    аналитическая зыбь, высота и наклоны;
       ripples()  карта нормалей в четырёх масштабах;
       main       небо или вода по знаку луча, сглаженный горизонт. */
    var ВЕРШИНА = [
      "varying vec2 vNdc;",
      "void main(){ vNdc = position.xy; gl_Position = vec4(position.xy, 0.0, 1.0); }"
    ].join("\n");

    var ФРАГМЕНТ = [
      "precision highp float;",
      "uniform sampler2D tSky; uniform sampler2D tNorm;",
      "uniform vec3 uFwd, uUp, uRight; uniform vec2 uTan; uniform float uEye;",
      "uniform vec3 uSun; uniform float uSunAz, uSunEl, uSunR;",
      "uniform vec4 uSkyMap;",       // x: linear slope, y: knee elevation, z: quad coef, w: az span
      "uniform vec2 uSkySun;",       // sun position inside the plate
      "uniform float uTime, uWarm, uFlare, uBand, uBandAmp, uGlint, uHit;",
      "uniform vec2 uSunNdc, uSrcNdc; uniform float uAspect, uHorNdc;",
      "uniform vec3 uDeep, uTurq; uniform float uSkyGain, uDomeBlue, uSat; uniform float uHorW; uniform vec3 uHorBlue, uMidBlue, uSheenCol; uniform float uSunCore, uSunHalo, uRip; uniform vec3 uZenith; uniform vec2 uSig; uniform float uCorona, uFine, uSqueeze, uShiny, uSpark, uSheen, uGlit, uFog;",
      "varying vec2 vNdc;",
      "",
      "vec3 ray(vec2 n){ return normalize(uFwd + n.x*uTan.x*uRight + n.y*uTan.y*uUp); }",
      "",
      "vec2 skyUv(vec3 d){",
      "  float el = asin(clamp(d.y, -1.0, 1.0));",
      "  float az = atan(d.x, -d.z) - uSunAz;",
      "  float e = max(el, 0.0);",
      "  float k = uSkyMap.x;",
      "  float over = max(e - uSkyMap.y, 0.0);",
      "  float v = k*e + uSkyMap.z*over*over;",
      "  float u = uSkySun.x + az * k * 0.5625;",   // 2160/3840: same texel scale on both axes
      "  return vec2(u, clamp(v, 0.0015, 0.998));",
      "}",
      "",
      "vec3 sunCol(){ return mix(vec3(1.0, 0.74, 0.42), vec3(1.0, 0.60, 0.28), uWarm); }",
      "",
      "vec3 skyAt(vec3 d){",
      "  vec3 c = texture2D(tSky, skyUv(d)).rgb * uSkyGain;",
      "  float a = length(d - uSun);",
      "  float r = uSunR * (1.0 + 0.25*uFlare);",
      "  float l = dot(c, vec3(0.2126, 0.7152, 0.0722));",
      // lift only the white-hot core of the plate around the sun into HDR, clouds stay SDR and crisp
      "  c = max(mix(vec3(l), c, uSat), 0.0);",
      "  c *= 1.0 + (1.4 + 1.0*uWarm + 2.5*uFlare) * smoothstep(0.80, 1.0, l / uSkyGain) * exp(-a / (r*3.0));",
      "  vec3 s = sunCol();",
      "  c += s * (uSunCore + 30.0*uFlare + 8.0*uWarm) * smoothstep(r*1.05, r*0.80, a);",
      "  c += s * (uSunHalo + 3.0*uFlare) * exp(-a / (r*1.3));",
      "  c += s * (0.30 + 0.8*uFlare + 0.20*uWarm) * exp(-a / (r*3.2));",
      "  c += s * uCorona * exp(-a / (r*14.0));",
      "  return c;",
      "}",
      "",
      // the dome seen in reflections: the same plate with a broad elevation scale and a blur,
      // because a wave facet sees tens of degrees of sky, not the few that fit on screen
      // horizon colour as a wave facet or the haze sees it: gold under the sun, cool blue to the sides
      "vec3 horAt(float az, float u){",
      "  vec3 hor = texture2D(tSky, vec2(u, 0.004), 3.0).rgb * uSkyGain;",
      "  float w = exp(-az*az / (uHorW*uHorW));",
      "  return mix(uHorBlue, hor, w);",
      "}",
      "",
      "vec3 domeAt(vec3 d){",
      "  float el = asin(clamp(d.y, 0.0, 1.0));",
      "  float az = atan(d.x, -d.z) - uSunAz;",
      "  vec2 uv = vec2(uSkySun.x + az * 0.42, clamp(sqrt(el / 1.3) * 0.95, 0.002, 0.995));",
      "  vec3 c = texture2D(tSky, uv, 2.5).rgb * uSkyGain;",
      "  vec3 hor = horAt(az, uv.x);",
      "  vec3 grad = mix(hor, mix(uMidBlue, uZenith, smoothstep(0.15, 0.7, el)), smoothstep(0.0, 0.14, el));",
      "  c = mix(c, grad, uDomeBlue);",
      "  c = mix(c, uZenith, smoothstep(0.35, 1.0, d.y));",
      "  return c;",
      "}",
      "",
      // five long swells: direction (xy), wavelength, amplitude, speed factor
      "void swell(vec2 q, float t, float foot, out float h, out vec2 g){",
      "  h = 0.0; g = vec2(0.0);",
      "  vec2 D[5]; float L[5]; float A[5];",
      "  D[0] = normalize(vec2( 0.25, 1.0)); L[0] = 9.0;  A[0] = 0.09;",
      "  D[1] = normalize(vec2(-0.7, 0.7));  L[1] = 6.3;  A[1] = 0.06;",
      "  D[2] = normalize(vec2( 0.9, 0.45)); L[2] = 4.1;  A[2] = 0.04;",
      "  D[3] = normalize(vec2(-0.95,-0.3)); L[3] = 2.7;  A[3] = 0.025;",
      "  D[4] = normalize(vec2( 0.5,-0.85)); L[4] = 1.7;  A[4] = 0.015;",
      "  for (int i = 0; i < 5; i++) {",
      "    float k = 6.2831853 / L[i];",
      "    float aa = 1.0 - smoothstep(0.06, 0.9, foot / L[i]);",
      "    float w = sqrt(9.81 * k);",
      "    float ph = k * dot(D[i], q) + w * t * 0.62 + float(i) * 1.7;",
      // sharpened crests: trochoid-like profile via power of (sin+1)
      "    float s = sin(ph) * 0.5 + 0.5;",
      "    float sh = pow(s, 1.6);",
      "    h += aa * A[i] * (sh * 2.0 - 1.0);",
      "    float dsh = 1.6 * pow(max(s, 1e-4), 0.6) * cos(ph);",
      "    g += aa * A[i] * dsh * k * D[i];",
      "  }",
      "}",
      "",
      "vec3 ripples(vec2 q, float t, float far){",
      "  vec2 u0 = q / 9.3  + vec2(t / 21.0, t / 33.0);",
      "  vec2 u1 = q / 5.7  - vec2(t / -23.0, t / 29.0);",
      "  vec2 u2 = q / 2.3  + vec2(t / 13.0, -t / 17.0);",
      "  vec2 u3 = q / 0.83 - vec2(t / 7.0, t / 11.0);",
      "  vec3 n = (texture2D(tNorm, u0).rgb * 2.0 - 1.0) * 1.0",
      "         + (texture2D(tNorm, u1).rgb * 2.0 - 1.0) * 0.9",
      "         + (texture2D(tNorm, u2).rgb * 2.0 - 1.0) * 0.75",
      "         + (texture2D(tNorm, u3).rgb * 2.0 - 1.0) * 0.55 * (1.0 - far);",
      "  return n;",
      "}",
      "",
      "void main(){",
      "  vec3 d = ray(vNdc);",
      "  float wy = max(fwidth(d.y), 1e-5);",
      "  vec3 skyC = skyAt(d);",
      "",
      // ---- water: ray hits the sea plane, no geometry edge anywhere ----
      "  float dy = min(d.y, -wy*0.5);",
      "  float dist = min(uEye / -dy, 6000.0);",
      "  vec2 q = d.xz * dist;",
      "  float far = 1.0 - exp(-dist / 240.0);",
      "  float h; vec2 g;",
      "  float foot = length(fwidth(q));",
      "  swell(q, uTime, foot, h, g);",
      "  g *= 1.0 - 0.85*far;",
      "  vec3 rp = ripples(q, uTime, far);",
      "  float rs = mix(uRip, 0.14, far);",
      "  vec3 N = normalize(vec3(-g.x + rp.x*rs, 1.0, -g.y + rp.y*rs));",
      "  vec3 fn = texture2D(tNorm, q / 0.37 + vec2(uTime / 5.0, -uTime / 6.0)).rgb * 2.0 - 1.0;",
      "  vec3 Nr = normalize(vec3(rp.x*rs, 1.0, rp.y*rs));",
      "  vec3 Nsp = normalize(Nr + vec3(fn.x, 0.0, fn.y) * uFine * (1.0 - far));",
      "  vec3 Ns = normalize(vec3(rp.x*rs*0.3, 1.0, rp.y*rs*0.3));",
      "  vec3 V = -d;",
      "  float nv = max(dot(N, V), 0.0);",
      "  float F = 0.02 + 0.98 * pow(1.0 - nv, 5.0);",
      "  vec3 R = reflect(d, N);",
      "  R.y = abs(R.y) + 0.004;",
      "  R = normalize(R);",
      "  vec3 refl = domeAt(R);",
      "",
      // body: deep sapphire, turquoise glow in crests backlit by the sun
      "  vec2 toSun = normalize(uSun.xz);",
      "  float back = pow(max(dot(normalize(d.xz), toSun), 0.0), 4.0);",
      "  float crest = smoothstep(-0.02, 0.16, h);",
      "  float faceSun = clamp(dot(N.xz, -toSun) * 2.5 + 0.35, 0.0, 1.0);",
      "  vec3 body = uDeep * (0.75 + 0.5*N.y*N.y) + uTurq * (0.25 + 0.6*crest) * (0.4 + 0.6*back) * faceSun * faceSun * (1.0 - far);",
      "  vec3 col = body * (1.0 - F) + refl * F;",
      "",
      // sun path: halfway vector with its along-sun component compressed (see JS notes)
      "  vec3 H = normalize(uSun + V);",
      "  float along = dot(H.xz, toSun);",
      "  vec2 side = H.xz - along * toSun;",
      "  float squeeze = mix(1.0, uSqueeze, smoothstep(0.0, 0.2, -d.y));",
      "  vec3 Hm = normalize(vec3(side.x + along*toSun.x*squeeze, H.y, side.y + along*toSun.y*squeeze));",
      "  float nh = max(dot(Nsp, Hm), 0.0);",
      "  float nhs = max(dot(Ns, Hm), 0.0);",
      "  float boost = 1.0 + 0.4*uWarm;",
      "  float band = uBandAmp * exp(-pow((vNdc.y - uBand) / 0.035, 2.0));",
      "  float lane = exp(-pow((vNdc.x - uSunNdc.x) * uAspect / 0.14, 2.0));",
      "  float depthFade = mix(0.45, 1.0, smoothstep(-1.0, uHorNdc, vNdc.y));",
      "  float spark = pow(nh, mix(uShiny, 1400.0, far)) * (1.0 - 0.6*far);",
      "  vec2 sl = Hm.xz / Hm.y - Ns.xz / Ns.y;",
      "  float sa = dot(sl, toSun), ss = sl.x*toSun.y - sl.y*toSun.x;",
      "  vec2 sg2 = uSig * vec2(1.0, 1.0 + 1.5*far);",
      "  float sheen = exp(-(ss*ss / (sg2.x*sg2.x) + sa*sa / (sg2.y*sg2.y)));",
      "  vec3 sc = sunCol();",
      "  col += uGlit * sc * spark * (uSpark + 40.0*band) * boost * depthFade;",
      "  col += uGlit * uSheenCol * sheen * (uSheen * mix(0.45, 1.0, far) + 1.2*band) * boost * depthFade;",
      "  col += sc * band * lane * (0.35 + 1.2*exp(-abs(vNdc.x - uSunNdc.x) * uAspect / 0.012));",
      "",
      // haze to the horizon: colour of the sky right above the horizon at this azimuth
      "  float hazeAz = atan(d.x, -d.z) - uSunAz;",
      "  vec3 haze = horAt(hazeAz * 1.8, skyUv(normalize(vec3(d.x, 0.0, d.z))).x);",
      "  float fog = 1.0 - exp(-dist * uFog);",
      "  col = mix(col, haze * 0.9, fog * 0.9);",
      "",
      // gently deepen the lower screen so the glass cards stay legible
      "  col *= mix(0.70, 1.0, smoothstep(-1.0, uHorNdc, vNdc.y));",
      "",
      // source glint on the path below the button
      "  vec2 sd = (vNdc - uSrcNdc) * vec2(uAspect, 1.0);",
      "  float sg = uGlint * (exp(-dot(sd, sd) / 0.00003) * 8.0 + exp(-dot(sd, sd) / 0.0004) * 0.8 + exp(-abs(sd.y) / 0.0018) * exp(-abs(sd.x) / 0.12) * 1.4);",
      "  col += sc * sg;",
      "",
      "  float t = smoothstep(-wy, wy, d.y);",
      "  gl_FragColor = vec4(mix(col, skyC, t), 1.0);",
      "}"
    ].join("\n");

    var у = {
      tSky: { value: null }, tNorm: { value: null },
      uFwd: { value: new T.Vector3(0, 0, -1) }, uUp: { value: new T.Vector3(0, 1, 0) }, uRight: { value: new T.Vector3(1, 0, 0) },
      uTan: { value: new T.Vector2(.5, .5) }, uEye: { value: ВЫСОТА_ГЛАЗА },
      uSun: { value: new T.Vector3(0, .05, -1) }, uSunAz: { value: 0 }, uSunEl: { value: .05 }, uSunR: { value: .012 },
      uSkyMap: { value: new T.Vector4(1, 1, 0, 1) },
      uSkySun: { value: new T.Vector2(СОЛНЦЕ_В_СНИМКЕ.u, СОЛНЦЕ_В_СНИМКЕ.v) },
      uTime: { value: 0 }, uWarm: { value: 0 }, uFlare: { value: 0 },
      uBand: { value: 0 }, uBandAmp: { value: 0 }, uGlint: { value: 0 }, uHit: { value: 0 },
      uSunNdc: { value: new T.Vector2() }, uSrcNdc: { value: new T.Vector2() },
      uAspect: { value: .46 }, uHorNdc: { value: .7 },
      uDeep: { value: new T.Vector3(.004, .030, .075) }, uTurq: { value: new T.Vector3(0, .19, .19) },
      uZenith: { value: new T.Vector3(.012, .06, .20) }, uCorona: { value: .14 }, uSkyGain: { value: .8 }, uDomeBlue: { value: .95 }, uSat: { value: 1.2 }, uMidBlue: { value: new T.Vector3(.03, .09, .26) }, uHorBlue: { value: new T.Vector3(.055, .14, .28) }, uHorW: { value: .12 }, uSheenCol: { value: new T.Vector3(1, .52, .16) },
      uSunCore: { value: 16 }, uSunHalo: { value: 1.4 }, uRip: { value: .42 }, uSig: { value: new T.Vector2(.05, .15) },
      uFine: { value: .16 }, uSqueeze: { value: .16 }, uShiny: { value: 3000 },
      uSpark: { value: 26 }, uSheen: { value: .22 }, uGlit: { value: 1 }, uFog: { value: .0011 }
    };
    var материал = new T.ShaderMaterial({
      vertexShader: ВЕРШИНА, fragmentShader: ФРАГМЕНТ, uniforms: у,
      depthTest: false, depthWrite: false
    });
    var геометрия = new T.PlaneGeometry(2, 2);
    var полотно = new T.Mesh(геометрия, материал);
    полотно.frustumCulled = false;
    сцена.add(полотно);

    /* Пока текстуры не пришли, полотно не рисуется: чёрный кадр на
       четверть секунды лучше, чем небо из пустой текстуры. */
    полотно.visible = false;
    var текстуры = [];
    var ждём = 2;
    var снята = false;
    function пришла() { ждём -= 1; if (ждём === 0) полотно.visible = true; }
    /* текстура могла прийти, когда тема уже сменилась: сразу освобождаем */
    function взять(т) { if (снята) { т.dispose(); return false; } текстуры.push(т); return true; }
    о.загрузить("ассеты/мир/океан/небо.webp", true).then(function (т) {
      т.wrapS = T.ClampToEdgeWrapping; т.wrapT = T.ClampToEdgeWrapping;
      т.generateMipmaps = true; т.minFilter = T.LinearMipmapLinearFilter; т.needsUpdate = true;
      if (!взять(т)) return;
      у.tSky.value = т; пришла();
    }).catch(function () { /* нет неба - полотно остаётся скрытым, под ним запасной фон */ });
    о.загрузить("ассеты/мир/океан/волны-нормали.jpg", false).then(function (т) {
      т.wrapS = T.RepeatWrapping; т.wrapT = T.RepeatWrapping; т.needsUpdate = true;
      if (!взять(т)) return;
      у.tNorm.value = т; пришла();
    }).catch(function () {});

    о.линза([0.25, 0.88, 1.0], 1);
    о.свечение(0.7, 1.0);
    о.экспозиция(1.0);

    /* ── КОМПОЗИЦИЯ ────────────────────────────────────────────────── */

    var кадрКнопки = { x: 215, y: 146, r: 57.5, есть: false };
    var ш0 = 430, в0 = 932;
    var вперёд = new T.Vector3(), вверх = new T.Vector3(), вправо = new T.Vector3(1, 0, 0);
    var солнце = new T.Vector3(), верх = new T.Vector3();

    function кнопкаИзЯкорей() {
      var к = я.кнопка;
      if (к.видна && к.r > 4) {
        кадрКнопки.x = к.x; кадрКнопки.y = к.y; кадрКнопки.r = к.r; кадрКнопки.есть = true;
      } else if (!кадрКнопки.есть) {
        /* кнопку ещё ни разу не видели: берём её место на эталонном экране */
        var м = (я.ширина || 430) / 430;
        кадрКнопки.x = (я.ширина || 430) / 2; кадрКнопки.y = 146 * м; кадрКнопки.r = 57.5 * м;
      }
    }

    function разложить() {
      var ш = я.ширина || ш0, в = я.высота || в0;
      ш0 = ш; в0 = в;
      кнопкаИзЯкорей();
      var б = кадрКнопки;
      var тY = Math.tan(ПОЛЕ_ЗРЕНИЯ * Math.PI / 360), тX = тY * ш / в;
      у.uTan.value.set(тX, тY);
      у.uAspect.value = ш / в;

      // горизонт: ndc = tg(наклон)/tg(fov/2)
      var yГоризонт = б.y - 0.30 * б.r;
      var ndcГ = 1 - 2 * yГоризонт / в;
      var наклон = Math.atan(ndcГ * тY);
      вперёд.set(0, -Math.sin(наклон), -Math.cos(наклон));
      вверх.set(0, Math.cos(наклон), -Math.sin(наклон));
      у.uFwd.value.copy(вперёд); у.uUp.value.copy(вверх); у.uRight.value.copy(вправо);
      у.uHorNdc.value = ndcГ;

      // солнце: обратная проекция нужной точки экрана
      var sx = 2 * б.x / ш - 1, sy = 1 - 2 * (б.y - 1.10 * б.r) / в;
      солнце.copy(вперёд).addScaledVector(вправо, sx * тX).addScaledVector(вверх, sy * тY).normalize();
      у.uSun.value.copy(солнце);
      у.uSunNdc.value.set(sx, sy);
      var высСолнца = Math.asin(солнце.y);
      у.uSunEl.value = высСолнца;
      у.uSunAz.value = Math.atan2(солнце.x, -солнце.z);
      // видимый диск ~0.2 радиуса кнопки
      у.uSunR.value = 0.20 * б.r * 2 * тY / в;

      /* Небо: до «колена» (чуть выше солнца) линейно, выше ускоряется так,
         чтобы у верхнего края экрана стояла высота ВЕРХ_СНИМКА. */
      var k = СОЛНЦЕ_В_СНИМКЕ.v / Math.max(высСолнца, 1e-3);
      var колено = высСолнца * 1.25;
      верх.copy(вперёд).addScaledVector(вверх, тY).normalize();
      var высВерха = Math.asin(верх.y);
      var сверх = Math.max(высВерха - колено, 1e-3);
      var кв = Math.max(0, (ВЕРХ_СНИМКА - k * высВерха) / (сверх * сверх));
      у.uSkyMap.value.set(k, колено, кв, 0);

      var сy = б.y + 1.35 * б.r;
      у.uSrcNdc.value.set(sx, 1 - 2 * сy / в);
    }

    /* ── СОБЫТИЯ ───────────────────────────────────────────────────── */

    var удар = -100, конецУдара = -100, ряд = -100;
    var тепло = { из: 0, в: 0, когда: -100 };
    var сейчас = 0;
    var ПРОБЕГ = 0.45;

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
      у.uWarm.value = теплоНа(t);

      // удар: вспышка солнца и светлая волна бежит по дорожке от солнца к источнику
      var пУ = t - удар;
      у.uFlare.value = пУ >= 0 && пУ < 1.2 ? Math.exp(-пУ / 0.28) * плавно(пУ / 0.05) : 0;
      if (пУ >= 0 && пУ < ПРОБЕГ + 0.5) {
        var доля = Math.min(1, пУ / ПРОБЕГ);
        var ход = 1 - Math.pow(1 - доля, 2.2);
        у.uBand.value = у.uSunNdc.value.y + (у.uSrcNdc.value.y - у.uSunNdc.value.y) * ход;
        у.uBandAmp.value = пУ < ПРОБЕГ ? 1 : Math.max(0, 1 - (пУ - ПРОБЕГ) / 0.5);
      } else {
        у.uBandAmp.value = 0;
      }
      // искра в источнике: волна дошла, конец удара, строка откликнулась
      var г = 0;
      if (пУ >= ПРОБЕГ * 0.8 && пУ < 2) г += Math.exp(-(пУ - ПРОБЕГ * 0.8) / 0.35);
      var пК = t - конецУдара;
      if (пК >= 0 && пК < 1.5) г += 0.6 * Math.exp(-пК / 0.3);
      var пР = t - ряд;
      if (пР >= 0 && пР < 1) г += 0.35 * Math.exp(-пР / 0.18);
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
