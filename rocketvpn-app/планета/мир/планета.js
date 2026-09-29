/* СЦЕНА ТЕМЫ «ПЛАНЕТА»: ночная Земля с орбиты и гроза на лимбе.

   Эталон кадра - концепт «планета-1-гроза»: золото городов под самым
   лимбом, бритвенно-тонкая синяя кромка атмосферы, Млечный Путь над ней
   и тёмная грозовая башня справа от кнопки, которая вспыхивает изнутри.

   ── ПОЧЕМУ ЗЕМЛЯ ЛУЧЕВАЯ ───────────────────────────────────────────
   Земля это настоящая сфера, но считается она лучом в каждом пикселе
   одного полноэкранного прохода: луч из камеры, пересечение со сферой,
   широта и долгота. Кромка у луча аналитическая: сглаживается ровно по
   доле пикселя, и линия атмосферы толщиной в полтора пикселя выходит
   чистой дугой на любой плотности экрана. Сетка дала бы ломаную. Цена -
   один проход и три-четыре выборки текстур, треугольников в сцене
   четыре.

   ── КОМПОЗИЦИЯ ИЗ ЯКОРЕЙ ───────────────────────────────────────────
   Прошлая дуга сходила к краям экрана на кнопка.y + 1.8r, то есть под
   карточку «Подписка» (её верх на кнопка.y + 1.12r): кромку атмосферы
   было видно только за кнопкой и в двух полосках у краёв. Теперь дуга
   поднята в открытую полосу между шапкой и карточкой: вершина за
   кнопкой на кнопка.y + 0.15r, у краёв кнопка.y + 0.75r (и не ниже
   чем за 22 точки до верха карточки). Кромка выходит из-под стекла на
   нижней трети кнопки, как в концепте, и видна по всей ширине.
   Камера смотрит ровно в горизонт с наклоном δ; прогиб дуги к краям
   растёт с δ монотонно, поэтому δ ищется делением пополам.

   ── ГЕОГРАФИЯ ───────────────────────────────────────────────────────
   Точка под камерой 5° с. ш. 40° в. д., курс 10°. Подобрано перебором
   по снимку Black Marble: под лимбом в открытой полосе встают Турция,
   Левант, Ирак и Иран, в середине Нил, Залив и Аравия, а под списком
   Сомали и Индийский океан - почти темнота, строки читаются.

   ── ГРОЗА ───────────────────────────────────────────────────────────
   Кучево-дождевое облако запечено объёмным рендером (сетка 416 на 352
   на 224, сглаженное объединение эллипсоидов, цветная капуста из шума
   Уорли, волокна наковальни, лунный свет с тенями, многократное
   рассеяние, девять точечных источников вдоль каждого канала молнии).
   Каналы молний фрактальные (смещение середины в 3D с ветвями) и
   закрыты толщей облака по-настоящему: видимость канала это пропускание
   от его точки до зрителя, поэтому канал светит в основном сквозь
   облако, а наружу выходят короткие куски. Слои линейны по свету, и в
   кадре они просто складываются с весами. */
(function () {
  "use strict";

  МИР.сцена("планета", function (о) {
    var T = о.THREE;
    var я = о.якоря;
    var ПУТЬ = "ассеты/мир/планета/";
    var РАД = Math.PI / 180;

    /* Вырезка ночных огней: долгота 8..88, широта -6..58. Это всё, что
       видно на любом из четырёх телефонов с запасом на качание Земли
       ±7°. Плотность родная для снимка: 37.5 точки на градус. */
    var ВЫРЕЗКА = [8, 88, -6, 58].map(function (г) { return г * РАД; });
    var ШИРОТА = 5 * РАД, ДОЛГОТА = 40 * РАД, КУРС = 10 * РАД;
    var ОБЗОР = 70 * РАД;

    /* Гроза в единицах запекания: x -1..1.6, y -0.2..2.0, основание в
       нуле. Точка главной вспышки A (центроид её слоя) и крайние точки
       облака сняты с запекания. */
    var ГРОЗА = { X0: -1.0, X1: 1.6, Y0: -0.2, Y1: 2.0, лево: -0.87, верх: 1.9, право: 1.12 };
    var ВСПЫШКА_А = { x: -0.28, y: 0.68 };
    /* основание грозы ниже кромки на 0.3 ед.: башня стоит по нашу
       сторону горизонта, подошва ложится на облачную палубу планеты */
    var ОСНОВАНИЕ = .30;

    var сцена = new T.Scene();
    var камера = new T.OrthographicCamera(0, 1, 0, -1, -10, 10);

    /* ── ШЕЙДЕРЫ (внутри строк только ASCII) ─────────────────────────
       EARTH - всё, что за грозой.
         space: полоса Млечного Пути, вырезанная и повёрнутая так, чтобы
           ядро светило из-за лимба слева от кнопки, а рукав уходил вверх
           к шапке. Мерцают только звёзды: снимок берётся резко и с
           размытием мипа, фазу получает лишь их разница.
         огни: в текстуре упакованы два сигнала. До 0.012 (линейно) -
           подложка суши из того же снимка (раскрашивается лунным синим),
           выше - сами города, отделённые от подложки морфологическим
           открытием. Город красится от оранжевого к тёплому белому, к
           нему прибавлено маленькое гало из мипа той же карты - это
           фотографическое свечение, которого у голой карты нет.
           Лимб больше не топит огни в дымке: в концепте под самой
           кромкой густое золото.
         облака гасят огни под собой, снизу подсвечены городами, сверху
           чуть луной; при подключении их верхушки слегка зеленеют.
         палуба: под основанием грозы облачный покров сгущается по шуму
           и освещается вспышками - гроза вырастает из облаков, а не
           висит наклейкой над пустым местом.
         отсвет: вспышка грозы освещает облака, лимб и атмосферу в
           радиусе около 2r, при ударе очень сильно.
         линия атмосферы: гаусс шириной около пикселя на высоте пикселя
           над кромкой, ореол в 4, 18 и 60 точек. При подключении линия
           ярче в 2.6 раза, ореол шире, над ней встаёт занавес сияния
           высотой 25-45 точек с вертикальными лучами.
         низ: ниже верха списка планета темнеет, яркость срезана ниже
           единицы - свечение не полезет под строки. */
    var VERT = [
      "varying vec2 vUv;",
      "void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }"
    ].join("\n");

    var EARTH = [
      "precision highp float;",
      "varying vec2 vUv;",
      "uniform vec2 uRes; uniform float uDpr;",
      "uniform vec3 uCam; uniform vec3 uF; uniform vec3 uR; uniform vec3 uU;",
      "uniform float uFocal; uniform vec2 uPP;",
      "uniform float uRot; uniform float uCloudRot; uniform float uTime; uniform float uConnect; uniform float uListY;",
      "uniform vec4 uCrop; uniform vec3 uMoon;",
      "uniform sampler2D tNight; uniform sampler2D tCloud; uniform sampler2D tSky;",
      "uniform vec4 uSkyTf;",
      "uniform vec4 uSpill; uniform vec4 uDeck;",
      "float hash12(vec2 p){ vec3 p3 = fract(vec3(p.xyx) * .1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }",
      "float vnoise(vec2 p){ vec2 i = floor(p), f = fract(p); f = f*f*(3.0-2.0*f);",
      "  float a = hash12(i), b = hash12(i+vec2(1.0,0.0)), c = hash12(i+vec2(0.0,1.0)), d = hash12(i+vec2(1.0,1.0));",
      "  return mix(mix(a,b,f.x), mix(c,d,f.x), f.y); }",
      "vec2 geoUV(vec3 n, float rot){",
      "  float lat = asin(clamp(n.y, -1.0, 1.0));",
      "  float lon = atan(-n.z, n.x) - rot;",
      "  return vec2((lon - uCrop.x) / (uCrop.y - uCrop.x), (lat - uCrop.z) / (uCrop.w - uCrop.z));",
      "}",
      "float inCrop(vec2 uv){ vec2 e = smoothstep(vec2(0.0), vec2(.02,.03), uv) * smoothstep(vec2(0.0), vec2(.02,.03), 1.0 - uv); return e.x * e.y; }",
      "vec3 space(vec2 px){",
      "  vec2 su = vec2(px.x / uRes.x * uSkyTf.x + uSkyTf.z, 1.0 - (px.y * uSkyTf.y + uSkyTf.w));",
      "  float fade = smoothstep(-.02, .06, su.y);",
      "  su = clamp(su, vec2(.001), vec2(.999));",
      "  vec3 cs = texture2D(tSky, su).rgb;",
      "  vec3 cb = texture2D(tSky, su, 1.6).rgb;",
      "  vec2 cell = floor(su * vec2(700.0, 547.0));",
      "  float tw = .72 + .55 * sin(uTime * (1.1 + 2.3 * hash12(cell)) + 6.283 * hash12(cell + 7.0));",
      "  vec3 c = cb + max(cs - cb, 0.0) * tw;",
      "  float g = dot(c, vec3(.3333));",
      "  c = mix(vec3(g), c, 1.18);",
      "  return max(c, 0.0) * .95 * fade;",
      "}",
      "void main(){",
      "  vec2 px = vec2(vUv.x * uRes.x, (1.0 - vUv.y) * uRes.y);",
      "  vec3 d = normalize(uF + uR * (px.x - uPP.x) / uFocal + uU * (uPP.y - px.y) / uFocal);",
      "  vec3 o = uCam;",
      "  float b = dot(o, d);",
      "  float c0 = dot(o, o) - 1.0;",
      "  float disc = b*b - c0;",
      "  float pxW = sqrt(max(c0, 1e-6)) / uFocal;",
      "  float hImp = sqrt(max(dot(o, o) - b*b, 0.0));",
      "  float hp = (hImp - 1.0) / pxW;",
      "  if (b > 0.0) hp = 1e4;",
      "  float cover = clamp(.5 - hp * uDpr, 0.0, 1.0);",
      "  vec3 col = space(px);",
      "  vec2 dS = (px - uSpill.xy) / uSpill.w;",
      "  float sp2 = dot(dS, dS);",
      "  float spill = uSpill.z * exp(-sp2);",
      "  float spillW = uSpill.z * exp(-sp2 * .2);",
      "  vec3 flashC = vec3(.62, .50, 1.0);",
      "  if (cover > 0.0) {",
      "    float tt = -b - sqrt(max(disc, 0.0));",
      "    vec3 n = normalize(o + d * tt);",
      "    float mu = clamp(dot(n, -d), 0.0, 1.0);",
      "    vec2 uv = geoUV(n, uRot);",
      "    float m = inCrop(uv);",
      "    float r0 = texture2D(tNight, uv).r;",
      "    float r1 = texture2D(tNight, uv, 2.2).r;",
      "    float v = pow(r0, 2.2) * m;",
      "    float vb = pow(r1, 2.2) * m;",
      "    float terr = min(v, .012) / .012;",
      "    float city = max(v - .012, 0.0);",
      "    float cityB = max(vb - .012, 0.0);",
      "    vec2 cuv = geoUV(n, uCloudRot);",
      "    float cl = texture2D(tCloud, cuv).r * inCrop(cuv);",
      /* deck of cloud under the storm base */
      "    vec2 dq = (px - uDeck.xy) / uDeck.zw;",
      "    float fp = exp(-dot(dq, dq));",
      "    float dn = vnoise(px * .09 + vec2(uTime * .02, 0.0)) * .6 + vnoise(px * .23 - vec2(0.0, uTime * .015)) * .4;",
      "    float deck = fp * smoothstep(.45, .8, dn + fp * .25);",
      "    float clD = max(cl, deck);",
      "    float moonL = max(dot(n, uMoon), 0.0) * .8 + .2;",
      "    float limbK = smoothstep(.0, .25, mu);",
      "    vec3 cityCol = mix(vec3(1.0, .34, .06), vec3(1.0, .78, .50), smoothstep(.04, .55, city));",
      "    float lit = pow(city, .8) * 2.9 + cityB * 2.2;",
      "    vec3 s = cityCol * lit * (1.0 - .86 * clD) * mix(.55, 1.0, limbK);",
      "    s += vec3(.006, .010, .024) * terr * moonL * (1.0 - clD);",
      "    s += vec3(.0010, .0022, .0068) * moonL;",
      "    vec3 top = mix(vec3(.018, .022, .040), vec3(.020, .050, .040), uConnect);",
      "    s += cl * (top * moonL + vec3(1.0, .50, .20) * cityB * 3.0);",
      "    s += flashC * (spill * (.015 + .55 * clD * clD) + spillW * .012 * (.3 + clD));",
      "    vec3 haze = vec3(.020, .070, .30) * pow(1.0 - mu, 6.0) * (.7 + .5 * uConnect) + vec3(.03, .10, .42) * pow(1.0 - mu, 18.0);",
      "    s = s + haze * (1.0 + spill * 2.0);",
      "    float low = smoothstep(uListY - 70.0, uRes.y, px.y);",
      "    s *= mix(1.0, .42, low);",
      "    float cap = mix(8.0, .8, smoothstep(uListY - 60.0, uListY + 30.0, px.y));",
      "    s = min(s, vec3(cap));",
      "    col = mix(col, s, cover);",
      "  }",
      /* atmosphere line, halo, aurora */
      "  float hpo = max(hp, 0.0);",
      "  float shim = .9 + .1 * vnoise(vec2(px.x * .025 + uTime * .12, uTime * .07));",
      "  float line = exp(-pow((hp - 1.0) / .8, 2.0));",
      "  float inner = hp < 0.0 ? exp(hp / 3.0) : 1.0;",
      "  float wide = 1.0 + 1.2 * uConnect;",
      "  float halo = exp(-hpo / (4.0 * wide)) * .45 + exp(-hpo / (18.0 * wide)) * .18 + exp(-hpo / 60.0) * .06;",
      "  float sk = 1.0 + spill * 3.0 + spillW * .5;",
      "  float atmK = (line * 2.0 * (1.0 + 1.6 * uConnect) + halo * (1.0 + .6 * uConnect)) * inner * shim * sk;",
      "  col += vec3(.16, .42, 1.25) * atmK;",
      "  col += vec3(.60, .78, 1.3) * line * inner * .35 * (1.0 + uConnect);",
      "  col += flashC * spill * exp(-hpo / 10.0) * inner * .6;",
      "  if (uConnect > .001 && hp > 0.0) {",
      "    float ax = px.x;",
      "    float band = vnoise(vec2(ax * .018 + uTime * .09, uTime * .05)) * .6 + vnoise(vec2(ax * .05 - uTime * .14, 3.0)) * .4;",
      "    float rays = .45 + .55 * pow(vnoise(vec2(ax * .35 + band * 4.0, uTime * .35)), 1.5);",
      "    float hgt = 25.0 + 20.0 * band;",
      "    float a = smoothstep(1.5, 5.0, hp) * exp(-max(hp - 4.0, 0.0) / (hgt * .45)) * (.35 + .65 * band) * rays;",
      "    vec3 ac = mix(vec3(.12, 1.0, .62), vec3(.55, .26, 1.0), smoothstep(4.0, hgt, hp));",
      "    col += ac * a * uConnect * 1.1;",
      "  }",
      "  gl_FragColor = vec4(col, 1.0);",
      "}"
    ].join("\n");

    /* STORM: слой грозы с премультиплицированной альфой. Атлас 3x3
       серых плиток (одна текстура, один канал):
         0 альфа (линейно)   1 луна   2 небо
         3 вспышка A   4 вспышка B   5 вспышка C
         6 канал A     7 канал B     8 канал C
       Все, кроме альфы, хранятся корнем из доли своего максимума: в
       восьми битах так больше ступеней в тенях; шейдер возводит в
       квадрат. Лунный цвет подобран в тёмный индиго (#1a1830 в тени,
       #3a3560 на верхушках после тонмаппинга): облако в покое тёмное,
       и вспышка изнутри получает запас яркости в десятки раз.
       Лёгкое «кипение» - сдвиг выборки шумом, 0.3% размера. */
    var STORM = [
      "precision highp float;",
      "varying vec2 vUv;",
      "uniform sampler2D tStorm;",
      "uniform float uAmb; uniform vec3 uFl; uniform vec3 uBo; uniform float uTime; uniform float uConnect;",
      "float hash12(vec2 p){ vec3 p3 = fract(vec3(p.xyx) * .1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }",
      "float vnoise(vec2 p){ vec2 i = floor(p), f = fract(p); f = f*f*(3.0-2.0*f);",
      "  float a = hash12(i), b = hash12(i+vec2(1.0,0.0)), c = hash12(i+vec2(0.0,1.0)), d = hash12(i+vec2(1.0,1.0));",
      "  return mix(mix(a,b,f.x), mix(c,d,f.x), f.y); }",
      "float tile(float i, vec2 uv){",
      "  float cx = mod(i, 3.0); float ry = floor(i / 3.0);",
      "  vec2 q = vec2((cx + uv.x) / 3.0, (2.0 - ry + uv.y) / 3.0);",
      "  return texture2D(tStorm, q).r;",
      "}",
      "void main(){",
      "  vec2 w = vec2(vnoise(vUv * 7.0 + vec2(uTime * .05, 0.0)), vnoise(vUv * 7.0 + vec2(3.1, -uTime * .04))) - .5;",
      "  vec2 uv = clamp(vUv + w * .006 * smoothstep(.1, .4, vUv.y), vec2(.003), vec2(.997));",
      "  float a = tile(0.0, uv);",
      "  float mo = tile(1.0, uv); mo *= mo;",
      "  float sk = tile(2.0, uv); sk *= sk;",
      "  float hy = smoothstep(.10, .55, vUv.y);",
      "  vec3 c = (mo * mo * vec3(.20, .12, .56) + sk * vec3(.008, .008, .022) * (.3 + .7 * hy)) * uAmb;",
      "  c += a * vec3(1.0, .45, .16) * .012 * (1.0 - smoothstep(.10, .30, vUv.y));",
      "  c += mo * vec3(.02, .06, .04) * uConnect * .5;",
      "  vec3 f = vec3(tile(3.0, uv), tile(4.0, uv), tile(5.0, uv)); f *= f;",
      "  float rel = .30 + 1.5 * sk * (.6 + .4 * mo);",
      "  c += dot(f, uFl) * vec3(.62, .42, 1.0) * rel;",
      "  vec3 bo = vec3(tile(6.0, uv), tile(7.0, uv), tile(8.0, uv)); bo *= bo;",
      "  c += dot(bo, uBo) * vec3(.82, .84, 1.0);",
      "  float e = smoothstep(0.0, .06, vUv.x) * smoothstep(0.0, .08, 1.0 - vUv.x) * smoothstep(0.0, .03, vUv.y) * smoothstep(0.0, .05, 1.0 - vUv.y);",
      "  gl_FragColor = vec4(c * e, a * e);",
      "}"
    ].join("\n");

    /* ── ТЕКСТУРЫ ────────────────────────────────────────────────────
       Серые карты (огни, облака, гроза) грузятся одноканальными
       (RedFormat, R8): в RGBA они занимали вчетверо больше. Итог в
       видеопамяти с мипами: огни 3000x2400 - 9.6 МБ, облака 1500x1200 -
       2.4 МБ, гроза 2496x2112 - 7 МБ, небо 1400x1093 RGBA - 8.1 МБ.
       Всего около 27 МБ вместо прежних 125. */
    var пустышка = new T.DataTexture(new Uint8Array([0, 0, 0, 255]), 1, 1);
    пустышка.needsUpdate = true;
    var текстуры = [];
    var уничтожена = false;
    function взять(имя, серая, мат, ключ, готово) {
      о.загрузить(ПУТЬ + имя, !серая).then(function (т) {
        if (уничтожена) { т.dispose(); return; }
        т.wrapS = т.wrapT = T.ClampToEdgeWrapping;
        if (серая) { т.format = T.RedFormat; т.needsUpdate = true; }
        текстуры.push(т);
        мат.uniforms[ключ].value = т;
        if (готово) готово(т);
      }).catch(function () {});
    }

    var землиМат = new T.ShaderMaterial({
      vertexShader: VERT, fragmentShader: EARTH,
      depthTest: false, depthWrite: false,
      uniforms: {
        uRes: { value: new T.Vector2(1, 1) }, uDpr: { value: 1 },
        uCam: { value: new T.Vector3() }, uF: { value: new T.Vector3() },
        uR: { value: new T.Vector3() }, uU: { value: new T.Vector3() },
        uFocal: { value: 1 }, uPP: { value: new T.Vector2() },
        uRot: { value: 0 }, uCloudRot: { value: 0 }, uTime: { value: 0 },
        uConnect: { value: 0 }, uListY: { value: 400 },
        uCrop: { value: new T.Vector4(ВЫРЕЗКА[0], ВЫРЕЗКА[1], ВЫРЕЗКА[2], ВЫРЕЗКА[3]) },
        uMoon: { value: new T.Vector3() },
        tNight: { value: пустышка }, tCloud: { value: пустышка }, tSky: { value: пустышка },
        uSkyTf: { value: new T.Vector4(1, 1, 0, 0) },
        uSpill: { value: new T.Vector4(0, 0, 0, 100) },
        uDeck: { value: new T.Vector4(0, 0, 60, 12) }
      }
    });
    var земля = new T.Mesh(new T.PlaneGeometry(1, 1), землиМат);
    земля.frustumCulled = false;
    сцена.add(земля);

    var грозыМат = new T.ShaderMaterial({
      vertexShader: VERT, fragmentShader: STORM,
      depthTest: false, depthWrite: false, transparent: true, side: T.DoubleSide,
      blending: T.CustomBlending, blendEquation: T.AddEquation,
      blendSrc: T.OneFactor, blendDst: T.OneMinusSrcAlphaFactor,
      uniforms: {
        tStorm: { value: пустышка },
        uAmb: { value: 1 }, uConnect: { value: 0 },
        uFl: { value: new T.Vector3() }, uBo: { value: new T.Vector3() },
        uTime: { value: 0 }
      }
    });
    var гроза = new T.Mesh(new T.PlaneGeometry(1, 1), грозыМат);
    гроза.frustumCulled = false;
    гроза.visible = false;
    сцена.add(гроза);

    взять("небо.webp", false, землиМат, "tSky", function (т) { небо.ш = т.image.width; небо.в = т.image.height; разложитьНебо(); });
    взять("огни.webp", true, землиМат, "tNight");
    взять("облака.webp", true, землиМат, "tCloud");
    взять("гроза.webp", true, грозыМат, "tStorm", function () { гроза.visible = true; });

    /* ── КАМЕРА ПО ЯКОРЯМ ────────────────────────────────────────────
       В координатах объектива (x вправо, y вверх, фокус 1) камера
       наклонена вниз на δ и смотрит ровно в горизонт. Точка горизонта при
       смещении X удовлетворяет
         y cos δ - sin δ + sin δ sqrt(X² + y² + 1) = 0,  y < 0,
       корень ищется делением. Прогиб в точках: -y f. */
    function горизонтY(X, δ) {
      var с = Math.cos(δ), s = Math.sin(δ);
      var lo = -3, hi = 0;
      for (var i = 0; i < 40; i++) {
        var m = (lo + hi) / 2;
        var g = m * с - s + s * Math.sqrt(X * X + m * m + 1);
        if (g > 0) hi = m; else lo = m;
      }
      return (lo + hi) / 2;
    }

    var вид = {
      ш: 1, в: 1, f: 1, δ: .8, cx: 0, ya: 0,
      списокY: 400, исток: { x: 0, y: 0 },
      база: { x: 0, y: 0 }, наклон: 0, sc: 1
    };
    var небо = { ш: 0, в: 0 };
    var век = {
      s: new T.Vector3(), N: new T.Vector3(), E: new T.Vector3(), H: new T.Vector3(),
      F: new T.Vector3(), R: new T.Vector3(), U: new T.Vector3(), P: new T.Vector3()
    };
    var главные = null;

    function лимбY(x) { return вид.ya - вид.f * горизонтY((x - вид.cx) / вид.f, вид.δ); }

    /* точка грозы (единицы запекания) -> css-точки экрана */
    function вЭкран(X, Y, куда) {
      var c = Math.cos(вид.наклон), s = Math.sin(вид.наклон);
      var vx = X * вид.sc, vy = -Y * вид.sc;
      куда.x = вид.база.x + vx * c - vy * s;
      куда.y = вид.база.y + vx * s + vy * c;
      return куда;
    }

    function разложить() {
      var W = вид.ш, H = вид.в;
      var к = главные || { x: W / 2, y: H * .157, r: H * .0794, ly: H * .455 };
      вид.списокY = к.ly;

      var ya = к.y + .15 * к.r;
      /* край дуги выше верха карточки «Подписка» (кнопка.y + 1.12r) */
      var край = Math.min(к.y + .75 * к.r, к.y + 1.12 * к.r - 22);
      var прогиб = Math.max(.25 * к.r, край - ya);
      var f = (H / 2) / Math.tan(ОБЗОР / 2);
      f = Math.min(f, W * 1.45);
      var X = Math.max(к.x, W - к.x) / f;
      var lo = .05, hi = 1.4;
      for (var i = 0; i < 44; i++) {
        var m = (lo + hi) / 2;
        if (-горизонтY(X, m) * f > прогиб) hi = m; else lo = m;
      }
      var δ = (lo + hi) / 2;
      вид.f = f; вид.δ = δ; вид.cx = к.x; вид.ya = ya;

      var s = век.s.set(Math.cos(ШИРОТА) * Math.cos(ДОЛГОТА), Math.sin(ШИРОТА), -Math.cos(ШИРОТА) * Math.sin(ДОЛГОТА));
      var N = век.N.set(0, 1, 0).addScaledVector(s, -s.y).normalize();
      var E = век.E.crossVectors(N, s).normalize();
      var Hd = век.H.copy(N).multiplyScalar(Math.cos(КУРС)).addScaledVector(E, Math.sin(КУРС));
      var F = век.F.copy(Hd).multiplyScalar(Math.cos(δ)).addScaledVector(s, -Math.sin(δ)).normalize();
      var R = век.R.crossVectors(F, s).normalize();
      var U = век.U.crossVectors(R, F).normalize();
      var P = век.P.copy(s).multiplyScalar(1 / Math.cos(δ));

      var у = землиМат.uniforms;
      у.uRes.value.set(W, H);
      у.uDpr.value = я.dpr || 1;
      у.uCam.value.copy(P); у.uF.value.copy(F); у.uR.value.copy(R); у.uU.value.copy(U);
      у.uFocal.value = f; у.uPP.value.set(к.x, ya);
      у.uListY.value = вид.списокY;
      у.uMoon.value.copy(s).multiplyScalar(.55).addScaledVector(E, -.55).addScaledVector(N, .35).normalize();

      земля.scale.set(W, H, 1);
      земля.position.set(W / 2, -H / 2, 0);

      /* ГРОЗА. Масштаб: верх наковальни (1.9 ед.) не выше 60 точек от
         верха экрана - шапку не задевает. Левый край облака (-0.87 ед.)
         не ближе кнопка.x + 1.05r: наковальня не лезет за стекло. Правый
         край башен (+1.12 ед.) внутри экрана с запасом 4 точки;
         наковальня уходит за правый край и там растворяется. Если на
         узком экране условия не сходятся, облако уменьшается. */
      var левыйПредел = к.x + 1.05 * к.r;
      var x0 = к.x + 1.85 * к.r;
      var sc = .95 * к.r;
      for (var k2 = 0; k2 < 30; k2++) {
        var правыйПредел = W - 4 - ГРОЗА.право * sc;
        var мин = левыйПредел - ГРОЗА.лево * sc;
        var верхЛимба = лимбY(Math.min(Math.max(x0, мин), правыйПредел));
        var scV = (верхЛимба - 52) / (ГРОЗА.верх - ОСНОВАНИЕ);
        if (мин <= правыйПредел && sc <= scV) break;
        sc *= .96;
      }
      x0 = Math.min(Math.max(x0, левыйПредел - ГРОЗА.лево * sc), W - 4 - ГРОЗА.право * sc);
      var y1 = лимбY(x0 - 4), y2 = лимбY(x0 + 4);
      var θ = Math.atan2(y2 - y1, 8) * .85;
      /* Основание на 0.1 ед. ниже кромки: башня стоит по нашу сторону
         горизонта, её подошва ложится на облачную палубу планеты, и
         кромка атмосферы уходит за облако. */
      вид.sc = sc; вид.наклон = θ;
      вид.база.x = x0; вид.база.y = лимбY(x0) + ОСНОВАНИЕ * sc;
      вЭкран(ВСПЫШКА_А.x, ВСПЫШКА_А.y, вид.исток);

      var cxU = (ГРОЗА.X0 + ГРОЗА.X1) / 2, cyU = (ГРОЗА.Y0 + ГРОЗА.Y1) / 2;
      var ц = вЭкран(cxU, cyU, { x: 0, y: 0 });
      гроза.position.set(ц.x, -ц.y, 1);
      гроза.rotation.z = -θ;
      гроза.scale.set((ГРОЗА.X1 - ГРОЗА.X0) * sc, (ГРОЗА.Y1 - ГРОЗА.Y0) * sc, 1);

      у.uSpill.value.set(вид.исток.x + .1 * sc, вид.исток.y + .15 * sc, 0, .85 * к.r);
      у.uDeck.value.set(x0 + .15 * sc, вид.база.y + .02 * sc, 1.0 * sc, .20 * sc);

      камера.left = 0; камера.right = W; камера.top = 0; камера.bottom = -H;
      камера.updateProjectionMatrix();
      разложитьНебо();
    }

    /* Небо: вырезка шириной в экран с запасом 6% на дрейф, сверху от
       края экрана; её низ ниже любого лимба. Смещение вверх на 17% её
       высоты ставит ядро Млечного Пути сразу над кромкой слева от
       кнопки, как в концепте. */
    function разложитьНебо() {
      if (!небо.ш) return;
      вид.небоВ = вид.ш / .94 * небо.в / небо.ш;
    }

    /* ── ВСПЫШКИ ─────────────────────────────────────────────────────
       Хэш без состояния: один и тот же t даёт одну и ту же вспышку.
       Ячейка 4.6 с, в ней удар с вероятностью 85% в случайный момент,
       в одной из трёх точек, с двумя-четырьмя повторными разрядами в
       том же канале - так бьёт настоящая молния. Промежутки выходят
       3-7 с, неровные. Сила задаётся в единицах HDR у самого яркого
       места слоя: покой около 0.1, фоновая вспышка 2-4, удар 12. */
    function хэш(n) { var x = Math.sin(n * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); }
    var вспышка = [0, 0, 0], молния = [0, 0, 0];
    var ЯЧЕЙКА = 4.6;
    function разряды(t) {
      вспышка[0] = вспышка[1] = вспышка[2] = 0;
      молния[0] = молния[1] = молния[2] = 0;
      var k0 = Math.floor(t / ЯЧЕЙКА);
      for (var k = k0 - 1; k <= k0; k++) {
        if (хэш(k + .13) > .85) continue;
        var нач = k * ЯЧЕЙКА + хэш(k) * 3.2;
        if (t < нач) continue;
        var к = Math.floor(хэш(k + .31) * 3) % 3;
        var сила = 1.6 + хэш(k + .57) * 2.2;
        var видно = хэш(k + .91) > .45 ? 1 : .25;
        var штрихов = 2 + Math.floor(хэш(k + .77) * 3);
        var шт = нач;
        for (var j = 0; j < штрихов; j++) {
          if (t >= шт) {
            var e = Math.exp(-(t - шт) / .06) * (j === 0 ? 1 : .7);
            вспышка[к] += сила * e;
            молния[к] += сила * e * 1.6 * видно;
          }
          шт += .05 + хэш(k * 3.1 + j) * .12;
        }
        вспышка[к] += сила * .22 * Math.exp(-(t - нач) / .45);
        /* соседняя ячейка облака вторит слабее */
        вспышка[(к + 1) % 3] += сила * .18 * Math.exp(-Math.max(0, t - нач - .05) / .3);
      }
    }

    /* ── СОБЫТИЯ ─────────────────────────────────────────────────────
       Время события запоминается по t последнего кадра, реакция
       считается от него: заморозка и тут даёт повторяемый кадр. */
    var сейчас = 0;
    var удар = -1e9;
    var ряды = [-1e9, -1e9, -1e9, -1e9], рядыЖивые = [1, 1, 1, 1], рядКуда = 0;
    var связь = { цель: 0, было: 0, с: -1e9, заряд: -1e9 };

    function уровеньСвязи(t) {
      var k = Math.min(1, Math.max(0, (t - связь.с) / 1.4));
      k = k * k * (3 - 2 * k);
      return связь.было + (связь.цель - связь.было) * k;
    }
    function задатьСвязь(цель, t) {
      связь.было = уровеньСвязи(t);
      связь.цель = цель; связь.с = t;
    }

    /* Удар замера. Первые 70 мс - бело-фиолетовый пик до 12 HDR в ядре
       вспышки A и открытый канал A на 16: свечение (порог 1.0) выжигает
       ядро, и сквозь облако видно, откуда пошёл след. Затем каскад по
       облаку: паук-разряд по наковальне (B) и повторный в правой башне
       (C), послесвечение гаснет за 0.8 с. */
    var строб = { в: [0, 0, 0], м: [0, 0, 0] };
    function стробУдара(q) {
      var r = строб.в, м = строб.м;
      r[0] = r[1] = r[2] = м[0] = м[1] = м[2] = 0;
      if (q < 0 || q > 2.5) return строб;
      var шА = [0, .07, .17, .33];
      for (var i = 0; i < шА.length; i++) {
        var z = q - шА[i];
        if (z >= 0) { var e = Math.exp(-z / .06); r[0] += e * (i ? 4 : 7.5); м[0] += e * (i ? 7 : 12); }
      }
      r[0] += 1.6 * Math.exp(-q / .4);
      var qB = q - .09;
      if (qB >= 0) { var eB = Math.exp(-qB / .08); r[1] += eB * 6 + 1.2 * Math.exp(-qB / .4); м[1] += eB * 9; }
      var qC = q - .24;
      if (qC >= 0) { var eC = Math.exp(-qC / .07); r[2] += eC * 5 + .8 * Math.exp(-qC / .35); м[2] += eC * 6; }
      return строб;
    }

    /* Якоря главного экрана. Кнопка при нажатии сжимается, а при смене
       раздела исчезает: новая раскладка принимается, только когда якоря
       простояли на новом месте полсекунды (30 кадров), а на экранах без
       кнопки держится последняя главная. */
    var кандидат = null, стабильно = 0;
    function снятьГлавные() {
      var к = я.кнопка;
      if (!(к.видна && к.r > 4)) return null;
      var ly = (я.список.видна && я.список.в > 0) ? я.список.y : (главные ? главные.ly : к.y + 3.8 * к.r);
      return { x: к.x, y: к.y, r: к.r, ly: ly };
    }
    function отличаются(а, б) {
      if (!а || !б) return true;
      return Math.abs(а.x - б.x) > 2 || Math.abs(а.y - б.y) > 2 || Math.abs(а.r - б.r) > 2 || Math.abs(а.ly - б.ly) > 2;
    }
    function следитьЗаЯкорями() {
      if (Math.abs((я.ширина || вид.ш) - вид.ш) > 2 || Math.abs((я.высота || вид.в) - вид.в) > 2) {
        вид.ш = я.ширина; вид.в = я.высота;
        главные = снятьГлавные() || главные;
        разложить();
        return;
      }
      var сейчасЯ = снятьГлавные();
      if (!сейчасЯ || !отличаются(сейчасЯ, главные)) { кандидат = null; стабильно = 0; return; }
      if (кандидат && !отличаются(сейчасЯ, кандидат)) стабильно += 1;
      else { кандидат = сейчасЯ; стабильно = 0; }
      if (стабильно >= 30 || !главные) {
        главные = сейчасЯ; кандидат = null; стабильно = 0;
        разложить();
      }
    }

    о.линза([.35, .55, 1.0], 1);
    о.свечение(.85, 1.0);
    о.экспозиция(1.0);

    return {
      сцена: сцена, камера: камера,

      кадр: function (t) {
        сейчас = t;
        следитьЗаЯкорями();
        var у = землиМат.uniforms;
        у.uTime.value = t;
        /* Земля качается ±7° за 25 минут: у лимба города ползут на
           несколько десятков точек в минуту, и вырезка огней никогда не
           кончается в кадре. */
        var маятник = 7 * РАД * Math.sin(2 * Math.PI * t / 1500);
        у.uRot.value = маятник;
        у.uCloudRot.value = маятник * 1.1 + t * .00005;
        var св = уровеньСвязи(t);
        у.uConnect.value = св;
        if (вид.небоВ) {
          var др = .025 * Math.sin(t * .011), др2 = .02 * Math.cos(t * .008);
          /* u: экран занимает 94% ширины вырезки; v: css-точка -> доля */
          у.uSkyTf.value.set(.94, 1 / вид.небоВ, .03 + др * .03, .17 + др2 * .02);
        }

        разряды(t);
        var су = стробУдара(t - удар);
        var fA = вспышка[0] + су.в[0], fB = вспышка[1] + су.в[1], fC = вспышка[2] + су.в[2];
        var bA = молния[0] + су.м[0], bB = молния[1] + су.м[1], bC = молния[2] + су.м[2];
        for (var i = 0; i < 4; i++) {
          var q = t - ряды[i];
          if (q >= 0 && q < 1.2) {
            var e = Math.exp(-q / .07) * (рядыЖивые[i] ? 1 : .4);
            if (i % 2) { fB += e * 2.2; bB += e * 2.5; } else { fC += e * 2.2; bC += e * 2.5; }
          }
        }
        /* подключаемся: гроза заряжается - частая мелкая дрожь */
        var зq = t - связь.заряд;
        if (зq >= 0 && зq < 6 && связь.цель < .5) {
          var др3 = Math.max(0, Math.sin(t * 23.0) * Math.sin(t * 7.3 + 1.0));
          fA += др3 * 1.2; fB += др3 * .6;
        }
        /* тлеющие карманы: гроза изнутри чуть светится и между ударами */
        var тлеет = 1.25 + .40 * Math.sin(t * 1.7) * Math.sin(t * .63 + 2.0) + .4 * св;
        var гу = грозыМат.uniforms;
        гу.uFl.value.set(тлеет + fA, тлеет * .8 + fB, тлеет * .6 + fC);
        гу.uBo.value.set(bA, bB, bC);
        гу.uAmb.value = 1 + .25 * св;
        гу.uConnect.value = св;
        гу.uTime.value = t;
        у.uSpill.value.z = Math.min(3.5, fA * .22 + (fB + fC) * .10 + тлеет * .15);
        /* при ударе весь кадр на 100 мс чуть поднимается - как от
           близкой вспышки */
        var qУ = t - удар;
        о.экспозиция(1 + (qУ >= 0 && qУ < 1 ? .045 * Math.exp(-qУ / .1) : 0));
      },

      размер: function (ш, в) {
        вид.ш = ш; вид.в = в;
        главные = снятьГлавные() || главные;
        разложить();
      },

      источник: function () { return { x: вид.исток.x, y: вид.исток.y }; },

      событие: function (имя, д) {
        д = д || {};
        if (имя === "удар" && д.фаза === "начало") удар = сейчас;
        else if (имя === "ряд") {
          ряды[рядКуда] = сейчас; рядыЖивые[рядКуда] = д.живой === false ? 0 : 1;
          рядКуда = (рядКуда + 1) % 4;
        }
        else if (имя === "подключаемся") связь.заряд = сейчас;
        else if (имя === "подключено") { задатьСвязь(1, сейчас); связь.заряд = -1e9; удар = Math.max(удар, сейчас - .02); }
        else if (имя === "отключено") { задатьСвязь(0, сейчас); связь.заряд = -1e9; }
      },

      уничтожить: function () {
        уничтожена = true;
        земля.geometry.dispose(); землиМат.dispose();
        гроза.geometry.dispose(); грозыМат.dispose();
        текстуры.forEach(function (т) { т.dispose(); });
        пустышка.dispose();
        о.экспозиция(1.0);
      }
    };
  });
})();
