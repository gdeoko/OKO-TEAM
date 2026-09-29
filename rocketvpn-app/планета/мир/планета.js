/* СЦЕНА ТЕМЫ «ПЛАНЕТА»: ночная Земля с низкой орбиты и гроза на лимбе.

   Слово владельца: «профессиональный крутой премиум 3D моушен дизайн с
   реальным реализмом, объёмом ... идеи с молнией, огнём и водой
   хорошие». Эталон кадра - концепт «планета-1-гроза»: золото городов,
   бритвенно-тонкая синяя кромка атмосферы, Млечный Путь над ней и
   фиолетово-белая грозовая башня справа от кнопки, которая вспыхивает
   изнутри.

   ── ПОЧЕМУ ЗЕМЛЯ ЛУЧЕВАЯ, А НЕ ШАР ИЗ ТРЕУГОЛЬНИКОВ ─────────────────
   Земля это настоящая сфера, но считается она лучом в каждом пикселе
   одного полноэкранного прохода: луч из камеры, пересечение со сферой,
   точка поверхности, широта и долгота. Причины три.
     1. Кромка. Кромка сетки из треугольников - это ломаная, и на
        лимбе, где глаз ждёт идеальной дуги толщиной в пиксель, её
        видно сразу. У луча кромка аналитическая: край сглаживается
        ровно по доле пикселя, дуга чистая на любой плотности экрана.
     2. Атмосфера. Высота луча над поверхностью в точке наибольшего
        сближения считается одной формулой, и из неё рисуется линия
        свечения шириной в полтора пикселя. Сетка так не умеет.
     3. Цена. Один проход по экрану с тремя-четырьмя выборками текстур
        дешевле сферы в сотню тысяч треугольников, а треугольников в
        сцене всего шесть.

   ── КОМПОЗИЦИЯ ИЗ ЯКОРЕЙ ───────────────────────────────────────────
   Камера ставится так, чтобы горизонт прошёл там, где велит интерфейс:
   вершина дуги за кнопкой на кнопка.y + 0.35r, у краёв экрана на
   кнопка.y + 1.3r. Для этого решается уравнение горизонта: камера на
   высоте h смотрит ровно на горизонт (наклон вниз на угол его
   понижения δ), а главная точка объектива сдвинута в вершину дуги.
   Прогиб дуги к краям растёт с δ монотонно, поэтому δ находится
   делением пополам. Так дуга на любом телефоне стоит на своём месте,
   а не угадана под один размер.

   Прогиб взят 0.95r, а не 1.45r из первого наброска. Проверено
   расчётом: чтобы при большем прогибе планета ещё закрывала низ
   экрана, объективу нужен угол под сто градусов, а это рыбий глаз,
   города у краёв растягиваются. Концепт стоит ещё положе.

   ── ГРОЗА ──────────────────────────────────────────────────────────
   Грозовая башня запечена заранее объёмным рендером (сетка 256 на 256
   на 133 вокселя, многократное рассеяние, три точки молнии внутри).
   Свет разложен по слоям: лунный, тёплый снизу от городов, три
   вспышки и три канала молний. Слои линейны по свету, поэтому здесь
   они просто складываются с весами, и облако честно освещается
   изнутри той вспышкой, которая сейчас бьёт, - за копейки на кадр.
   Башня стоит на лимбе и наклонена по нормали к дуге: у края диска
   местная вертикаль уже не вертикальна экрану.

   ── ДВИЖЕНИЕ ───────────────────────────────────────────────────────
   Всё считается от t, без накопления: заморозка времени даёт один и
   тот же кадр. Земля поворачивается медленным маятником (±26° за два
   часа) - за минуту города уходят на десяток точек, но Европа
   никогда не уезжает за край снимка ночных огней. Облака идут чуть
   быстрее земли. Вспышки грозы расписаны хэшем по ячейкам времени:
   каждые 2-8 секунд удар в одной из трёх точек, два-четыре повторных
   разряда в одном канале, как у настоящей молнии. */
(function () {
  "use strict";

  МИР.сцена("планета", function (о) {
    var T = о.THREE;
    var я = о.якоря;
    var ПУТЬ = "ассеты/мир/планета/";

    /* Снимок ночных огней вырезан по долготе -60..130 и широте -25..80:
       это всё, что может попасть в кадр при качании Земли. Вырезка в
       4096 точек держит плотность 21 точка на градус. */
    var ВЫРЕЗКА = [-60, 130, -25, 80].map(function (г) { return г * Math.PI / 180; });
    /* Точка под камерой и курс: Ливия, взгляд на северо-северо-восток.
       Под списком тогда Сахара, то есть темнота, и строки читаются, а
       огни Европы, Нила и Ближнего Востока ложатся под кнопку. */
    var ШИРОТА = 21 * Math.PI / 180, ДОЛГОТА = 22 * Math.PI / 180, КУРС = 14 * Math.PI / 180;
    var ОБЗОР = 70 * Math.PI / 180;

    /* Слои грозы хранятся как корень из доли СВОЕГО максимума: в восьми
       битах так больше ступеней в тенях. Шейдер возводит в квадрат и
       получает линейный свет от нуля до единицы. Общие множители тут
       единицы, потому что яркость каждого слоя задаётся весами в
       кадре: вспышки в точках A, B, C запечены с разной силой, и
       физическое соотношение между ними всё равно переписывается
       режиссурой вспышек. Массив оставлен, чтобы перезапечь грозу и
       подстроить слой, не трогая шейдер. */
    var МАСШТАБ_ГРОЗЫ = [1, 1, 1, 1, 1, 1, 1, 1, 1];
    var ГРОЗА = { X0: -1.3, X1: 1.4, Y0: -0.3, Y1: 2.4, ax: -0.05, ay: 0.86 };

    var сцена = new T.Scene();
    var камера = new T.OrthographicCamera(0, 1, 0, -1, -10, 10);

    /* ── ШЕЙДЕРЫ ────────────────────────────────────────────────────
       VERT_SCREEN  квадрат на весь экран, uv от левого нижнего угла.
       EARTH        всё, что за грозой: космос, Земля, облака, атмосфера,
                    полярное сияние при подключении, отсвет вспышек.
         - space(): снимок Млечного Пути заполняет экран без искажения
           (как background-size: cover) и едва дрейфует. Мерцают только
           звёзды: снимок берётся дважды, резко и с размытием мипа, и
           фазу мерцания получает лишь их разница - острые точки. Первая
           версия мерцала всей яркостью по ячейкам, и светлые облака
           Млечного Пути рассыпались мозаикой из квадратов.
         - Лимб: hp - высота луча над кромкой в css-точках. Кромка
           сглаживается по доле пикселя экрана (uDpr), линия атмосферы
           это гаусс шириной около пикселя на высоте пикселя над
           поверхностью, под ней мягкий ореол в пять и в двадцать шесть
           точек. Так линия бритвенная и при этом светится.
         - Огни: снимок Black Marble в линейном свете. Всё ниже 0.03 это
           подсвеченная луной суша, выше - города. Города красятся от
           оранжевого (слабые) к тёплому белому (центры).
         - Облака гасят огни под собой и сами подсвечены снизу: размытая
           выборка той же карты огней (texture2D со смещением мипа)
           даёт тёплое зарево на нижней кромке облаков над городами.
         - У горизонта огни тонут в толще воздуха, поверхность синеет.
         - Ниже верха списка планета темнеет, и яркость там срезана ниже
           единицы - свечение не полезет под строки.
       STORM        слой грозы с премультиплицированной альфой.
         - Свет вспышки умножается на рельеф лунного слоя: вспышка из
           запекания гладкая (свет рассеян в толще), и без этого облако
           светилось ровной подушкой без клубов.
         - Кромка облака поджата smoothstep по альфе, эмиссия
           пересчитана под новую альфу: край резкий, без серой бахромы. */
    var VERT_SCREEN = [
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
      "uniform sampler2D tNight; uniform sampler2D tCloud; uniform sampler2D tSpace;",
      "uniform vec4 uSpaceTf;",
      "uniform vec4 uSpill;",
      "float hash12(vec2 p){ vec3 p3 = fract(vec3(p.xyx) * .1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }",
      "float vnoise(vec2 p){ vec2 i = floor(p), f = fract(p); f = f*f*(3.0-2.0*f);",
      "  float a = hash12(i), b = hash12(i+vec2(1.0,0.0)), c = hash12(i+vec2(0.0,1.0)), d = hash12(i+vec2(1.0,1.0));",
      "  return mix(mix(a,b,f.x), mix(c,d,f.x), f.y); }",
      "vec2 geoUV(vec3 n, float rot){",
      "  float lat = asin(clamp(n.y, -1.0, 1.0));",
      "  float lon = atan(-n.z, n.x) - rot;",
      "  return vec2((lon - uCrop.x) / (uCrop.y - uCrop.x), (lat - uCrop.z) / (uCrop.w - uCrop.z));",
      "}",
      "float inCrop(vec2 uv){ vec2 e = smoothstep(vec2(0.0), vec2(.03,.05), uv) * smoothstep(vec2(0.0), vec2(.03,.05), 1.0 - uv); return e.x * e.y; }",
      "vec3 space(vec2 px){",
      "  vec2 uv = vec2(px.x / uRes.x, 1.0 - px.y / uRes.y);",
      "  vec2 su = uv * uSpaceTf.xy + uSpaceTf.zw;",
      "  vec3 cs = texture2D(tSpace, su).rgb;",
      "  vec3 cb = texture2D(tSpace, su, 1.2).rgb;",
      "  vec2 cell = floor(su * vec2(540.0, 960.0));",
      "  float tw = .70 + .6 * sin(uTime * (1.1 + 2.3 * hash12(cell)) + 6.283 * hash12(cell + 7.0));",
      "  vec3 c = cb + max(cs - cb, 0.0) * tw;",
      "  float g = dot(c, vec3(.3333));",
      "  c = mix(vec3(g), c, 1.25);",
      "  return max(c, 0.0) * 1.7;",
      "}",
      "void main(){",
      "  vec2 px = vec2(vUv.x * uRes.x, (1.0 - vUv.y) * uRes.y);",
      "  vec3 d = normalize(uF + uR * (px.x - uPP.x) / uFocal + uU * (uPP.y - px.y) / uFocal);",
      "  vec3 o = uCam;",
      "  float b = dot(o, d);",
      "  float c0 = dot(o, o) - 1.0;",
      "  float disc = b*b - c0;",
      "  float Ld = sqrt(max(c0, 1e-6));",
      "  float pxW = Ld / uFocal;",
      "  float hImp = sqrt(max(dot(o, o) - b*b, 0.0));",
      "  float hp = (hImp - 1.0) / pxW;",
      "  if (b > 0.0) hp = 1e4;",
      "  float cover = clamp(.5 - hp * uDpr, 0.0, 1.0);",
      "  vec3 col = space(px);",
      "  vec2 dS = (px - uSpill.xy) / uSpill.w;",
      "  float spill = uSpill.z * exp(-dot(dS, dS));",
      "  float spillWide = uSpill.z * exp(-dot(dS, dS) * .18);",
      /* surface */
      "  if (cover > 0.0) {",
      "    float tt = -b - sqrt(max(disc, 0.0));",
      "    vec3 n = normalize(o + d * tt);",
      "    float mu = clamp(dot(n, -d), 0.0, 1.0);",
      "    vec2 uv = geoUV(n, uRot);",
      "    float m = inCrop(uv);",
      "    float L = texture2D(tNight, uv).r * m;",
      "    float Lb = texture2D(tNight, uv, 4.5).r * m;",
      "    vec2 cuv = geoUV(n, uCloudRot);",
      "    float cl = texture2D(tCloud, cuv).r * inCrop(cuv);",
      "    float moonL = max(dot(n, uMoon), 0.0) * .85 + .15;",
      "    float city = max(L - .028, 0.0);",
      "    float ter = min(L, .03);",
      "    float air = smoothstep(0.0, .42, mu);",
      "    vec3 cityCol = mix(vec3(1.0, .30, .045), vec3(1.0, .74, .42), smoothstep(.02, .5, city));",
      "    vec3 s = cityCol * pow(city, .82) * 3.4 * (1.0 - .88 * cl) * mix(.25, 1.0, air);",
      "    s += vec3(.30, .42, .70) * ter * 1.6 * moonL * (1.0 - cl);",
      "    s += vec3(.0022, .0045, .0120) * moonL;",
      "    s += cl * (vec3(.030, .040, .066) * moonL + vec3(1.0, .52, .22) * Lb * 3.2);",
      "    s += vec3(.55, .45, 1.0) * spill * (.03 + .32 * cl) + vec3(.4, .35, 1.0) * spillWide * .01;",
      "    vec3 haze = vec3(.035, .10, .36) * pow(1.0 - mu, 4.0) * .7 + vec3(.04, .12, .45) * pow(1.0 - mu, 14.0);",
      "    s = s * mix(.55, 1.0, air) + haze;",
      "    float low = smoothstep(uListY - 80.0, uRes.y, px.y);",
      "    s *= mix(1.0, .38, low);",
      "    float cap = mix(6.0, .85, smoothstep(uListY - 60.0, uListY + 30.0, px.y));",
      "    s = min(s, vec3(cap));",
      "    col = mix(col, s, cover);",
      "  }",
      /* atmosphere line, halo, aurora */
      "  float hpo = max(hp, 0.0);",
      "  float shim = .88 + .12 * vnoise(vec2(px.x * .025 + uTime * .12, uTime * .07));",
      "  float line = exp(-pow((hp - 1.1) / .85, 2.0));",
      "  float inner = hp < 0.0 ? exp(hp / 2.4) : 1.0;",
      "  float halo = exp(-hpo / 4.5) * .5 + exp(-hpo / 20.0) * .22 + exp(-hpo / 60.0) * .07;",
      "  float atmK = (line * 2.2 * (1.0 + .9 * uConnect) + halo * (1.0 + .5 * uConnect)) * inner * shim;",
      "  atmK *= 1.0 + spill * 1.2;",
      "  col += vec3(.16, .42, 1.25) * atmK;",
      "  col += vec3(.55, .75, 1.3) * line * inner * .35;",
      "  if (uConnect > .001 && hp > 0.0) {",
      "    float ax = px.x * .03;",
      "    float band = vnoise(vec2(ax + uTime * .11, uTime * .05)) * .6 + vnoise(vec2(ax * 2.3 - uTime * .17, 3.0)) * .4;",
      "    float rays = .55 + .45 * sin(px.x * .11 + uTime * .6 + band * 7.0);",
      "    float hgt = 18.0 + 26.0 * band;",
      "    float a = smoothstep(1.5, 6.0, hp) * (1.0 - smoothstep(45.0, 95.0, hp)) * exp(-max(hp - 4.0, 0.0) / hgt) * band * rays;",
      "    vec3 ac = mix(vec3(.10, 1.0, .72), vec3(.55, .28, 1.0), smoothstep(6.0, 40.0, hp));",
      "    col += ac * a * uConnect * .9;",
      "  }",
      "  gl_FragColor = vec4(col, 1.0);",
      "}"
    ].join("\n");

    /* Слой грозы. Девять плиток в одной картинке 3x3:
         0 альфа  1 луна  2 города снизу
         3 вспышка A  4 вспышка B  5 вспышка C
         6 молния A   7 молния B   8 молния C
       Облако внизу растворяется в облачном покрове планеты по шумной
       границе - прямой срез выдал бы плиту. Молнии этой маске не
       подчиняются: канал B уходит ниже основания к земле. */
    var STORM = [
      "precision highp float;",
      "varying vec2 vUv;",
      "uniform sampler2D tStorm;",
      "uniform vec2 uAmb; uniform vec3 uFl; uniform vec3 uBo;",
      "uniform vec4 uExt;",
      "uniform float uSc[9];",
      "uniform float uTime;",
      "float hash12(vec2 p){ vec3 p3 = fract(vec3(p.xyx) * .1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }",
      "float vnoise(vec2 p){ vec2 i = floor(p), f = fract(p); f = f*f*(3.0-2.0*f);",
      "  float a = hash12(i), b = hash12(i+vec2(1.0,0.0)), c = hash12(i+vec2(0.0,1.0)), d = hash12(i+vec2(1.0,1.0));",
      "  return mix(mix(a,b,f.x), mix(c,d,f.x), f.y); }",
      "float tile(float i, vec2 uv){",
      "  float col = mod(i, 3.0); float row = floor(i / 3.0);",
      "  vec2 q = vec2((col + uv.x) / 3.0, 1.0 - (row + 1.0 - uv.y) / 3.0);",
      "  float v = texture2D(tStorm, q).r;",
      "  return v * v;",
      "}",
      "void main(){",
      "  vec2 uv = clamp(vUv, vec2(.001), vec2(.999));",
      "  float yW = mix(uExt.z, uExt.w, vUv.y);",
      "  float xW = mix(uExt.x, uExt.y, vUv.x);",
      "  float a = tile(0.0, uv);",
      "  float moonT = tile(1.0, uv) * uSc[1];",
      "  vec3 c = moonT * vec3(.46, .46, .72) * uAmb.x;",
      "  c += tile(2.0, uv) * uSc[2] * vec3(1.0, .52, .22) * uAmb.y;",
      "  vec3 fl = vec3(tile(3.0, uv) * uSc[3], tile(4.0, uv) * uSc[4], tile(5.0, uv) * uSc[5]);",
      "  c += dot(fl, uFl) * (.38 + 1.1 * moonT) * vec3(.58, .42, 1.0);",
      "  float n = vnoise(vec2(xW * 9.0 + uTime * .03, yW * 9.0)) * .6 + vnoise(vec2(xW * 23.0, yW * 23.0 - uTime * .02)) * .4;",
      "  c += (1.0 - smoothstep(.0, .7, yW)) * a * vec3(.07, .06, .15) * (1.0 + .25 * uFl.y);",
      "  float fade = smoothstep(.06, .36, yW + (n - .5) * .16);",
      "  float aS = smoothstep(0.0, .8, a);",
      "  c *= aS / max(a, 1e-3); a = aS;",
      "  float rim = pow(clamp(a * (1.0 - a) * 4.0, 0.0, 1.0), 1.6);",
      "  c += vec3(.55, .45, 1.0) * rim * (.02 + .012 * dot(uFl, vec3(1.0)));",
      "  a *= fade; c *= fade;",
      "  vec3 bo = vec3(tile(6.0, uv) * uSc[6], tile(7.0, uv) * uSc[7], tile(8.0, uv) * uSc[8]);",
      "  float bolt = dot(bo, uBo);",
      "  c += bolt * vec3(.78, .80, 1.0) * 4.0;",
      "  gl_FragColor = vec4(c, a);",
      "}"
    ].join("\n");

    /* ── ТЕКСТУРЫ ──────────────────────────────────────────────────── */
    var пустышка = new T.DataTexture(new Uint8Array([0, 0, 0, 255]), 1, 1);
    пустышка.needsUpdate = true;
    var текстуры = [];
    function взять(имя, цветная, куда, ключ) {
      о.загрузить(ПУТЬ + имя, цветная).then(function (т) {
        if (уничтожена) { т.dispose(); return; }
        т.wrapS = т.wrapT = T.ClampToEdgeWrapping;
        текстуры.push(т);
        куда.uniforms[ключ].value = т;
        if (ключ === "tSpace") подогнатьКосмос();
      }).catch(function () {});
    }
    var уничтожена = false;

    var землиМат = new T.ShaderMaterial({
      vertexShader: VERT_SCREEN, fragmentShader: EARTH,
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
        tNight: { value: пустышка }, tCloud: { value: пустышка }, tSpace: { value: пустышка },
        uSpaceTf: { value: new T.Vector4(1, 1, 0, 0) },
        uSpill: { value: new T.Vector4(0, 0, 0, 100) }
      }
    });
    var земля = new T.Mesh(new T.PlaneGeometry(1, 1), землиМат);
    земля.frustumCulled = false;
    сцена.add(земля);

    var грозыМат = new T.ShaderMaterial({
      vertexShader: VERT_SCREEN, fragmentShader: STORM,
      depthTest: false, depthWrite: false, transparent: true, side: T.DoubleSide,
      blending: T.CustomBlending, blendEquation: T.AddEquation,
      blendSrc: T.OneFactor, blendDst: T.OneMinusSrcAlphaFactor,
      uniforms: {
        tStorm: { value: пустышка },
        uAmb: { value: new T.Vector2(1, 1) },
        uFl: { value: new T.Vector3() }, uBo: { value: new T.Vector3() },
        uExt: { value: new T.Vector4(ГРОЗА.X0, ГРОЗА.X1, ГРОЗА.Y0, ГРОЗА.Y1) },
        uSc: { value: МАСШТАБ_ГРОЗЫ.slice() },
        uTime: { value: 0 }
      }
    });
    var гроза = new T.Mesh(new T.PlaneGeometry(1, 1), грозыМат);
    гроза.frustumCulled = false;
    гроза.visible = false;
    сцена.add(гроза);

    взять("космос.webp", true, землиМат, "tSpace");
    взять("огни.webp", true, землиМат, "tNight");
    взять("облака.webp", false, землиМат, "tCloud");
    о.загрузить(ПУТЬ + "гроза.webp", false).then(function (т) {
      if (уничтожена) { т.dispose(); return; }
      т.wrapS = т.wrapT = T.ClampToEdgeWrapping;
      текстуры.push(т);
      грозыМат.uniforms.tStorm.value = т;
      гроза.visible = true;
    }).catch(function () {});

    /* ── КАМЕРА ПО ЯКОРЯМ ──────────────────────────────────────────
       Решение горизонта. В координатах объектива (x вправо, y вверх,
       фокус 1) камера наклонена вниз на δ и смотрит ровно в горизонт.
       Точка горизонта при смещении X удовлетворяет
         y cos δ - sin δ + sin δ sqrt(X² + y² + 1) = 0,  y < 0.
       Корень ищется делением: в нуле левая часть положительна, ниже
       становится отрицательной. Прогиб в точках: -y f. */
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
      ш: 1, в: 1, f: 1, δ: .8, cx: 0, cy: 0,
      кнопка: { x: 0, y: 0, r: 0 }, списокY: 400,
      исток: { x: 0, y: 0 }, наклон: 0, масштаб: 1
    };
    var век = {
      s: new T.Vector3(), N: new T.Vector3(), E: new T.Vector3(), H: new T.Vector3(),
      F: new T.Vector3(), R: new T.Vector3(), U: new T.Vector3(), P: new T.Vector3(),
      тмп: new T.Vector3()
    };

    /* Запуск не с главного экрана: пропорции главного экрана телефона
       430x932, чтобы потом не было скачка. */
    var главные = null;

    function разложить() {
      var W = вид.ш, H = вид.в;
      var к = главные || { x: W / 2, y: H * .17, r: H * .0617, ly: H * .455 };
      вид.кнопка = { x: к.x, y: к.y, r: к.r };
      вид.списокY = к.ly;

      var ya = к.y + .35 * к.r;
      var прогиб = .95 * к.r;
      var f = (H / 2) / Math.tan(ОБЗОР / 2);
      /* узкий экран: не даём горизонтальному обзору схлопнуться */
      f = Math.min(f, W * 1.45);
      var X = Math.max(к.x, W - к.x) / f;
      var lo = .15, hi = 1.25;
      for (var i = 0; i < 40; i++) {
        var m = (lo + hi) / 2;
        if (-горизонтY(X, m) * f > прогиб) hi = m; else lo = m;
      }
      var δ = (lo + hi) / 2;
      вид.f = f; вид.δ = δ; вид.cx = к.x; вид.cy = ya;

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
      /* Луна сверху слева за спиной: суша у горизонта чуть серебрится. */
      у.uMoon.value.copy(s).multiplyScalar(.55).addScaledVector(E, -.55).addScaledVector(N, .35).normalize();

      земля.scale.set(W, H, 1);
      земля.position.set(W / 2, -H / 2, 0);

      /* Гроза. Точка A (главная вспышка) стоит там, куда велит бриф:
         x = кнопка.x + 1.85r, y = кнопка.y + 0.25r. Наклон - по
         касательной к дуге горизонта в этой точке, считается тем же
         решением горизонта. */
      var ix = Math.min(к.x + 1.85 * к.r, W - .35 * к.r);
      var iy = к.y + .25 * к.r;
      var dx = 4;
      var y1 = ya - f * горизонтY((ix - dx - к.x) / f, δ);
      var y2 = ya - f * горизонтY((ix + dx - к.x) / f, δ);
      var θ = Math.atan2(y2 - y1, 2 * dx) * .8;
      var sc = 1.12 * к.r;
      вид.наклон = θ; вид.масштаб = sc;
      вид.исток.x = ix; вид.исток.y = iy;
      var cs = Math.cos(θ), sn = Math.sin(θ);
      /* центр плитки относительно точки A в единицах грозы */
      /* Гроза отражена по горизонтали: наковальня тянется влево, над
         кнопкой, и видна сквозь линзу, а башня стоит в свободном поле
         справа и целиком помещается в экран. */
      var ux = (-(ГРОЗА.X0 + ГРОЗА.X1) / 2 + ГРОЗА.ax) * sc;
      var uy = -((ГРОЗА.Y0 + ГРОЗА.Y1) / 2 - ГРОЗА.ay) * sc;
      var cxp = ix + ux * cs - uy * sn;
      var cyp = iy + ux * sn + uy * cs;
      гроза.position.set(cxp, -cyp, 1);
      гроза.rotation.z = -θ;
      гроза.scale.set(-(ГРОЗА.X1 - ГРОЗА.X0) * sc, (ГРОЗА.Y1 - ГРОЗА.Y0) * sc, 1);
      у.uSpill.value.set(ix, iy + .5 * к.r, 0, 1.5 * к.r);

      камера.left = 0; камера.right = W; камера.top = 0; камера.bottom = -H;
      камера.updateProjectionMatrix();
    }

    function подогнатьКосмос() {
      var т = землиМат.uniforms.tSpace.value;
      if (!т || !т.image || !т.image.width) return;
      var ia = т.image.width / т.image.height, sa = вид.ш / вид.в;
      var sx = 1, sy = 1;
      if (sa < ia) sx = sa / ia; else sy = ia / sa;
      /* запас 6% на медленный дрейф */
      вид.космос = { sx: sx * .94, sy: sy * .94 };
    }

    /* ── ВСПЫШКИ ───────────────────────────────────────────────────
       Хэш без состояния: один и тот же t даёт одну и ту же вспышку.
       Ячейка 5.2 с, внутри неё удар в случайный момент, в случайной
       точке A/B/C, с двумя-четырьмя повторными разрядами - так бьёт
       настоящая молния: канал зажигается несколько раз подряд. */
    function хэш(n) { var x = Math.sin(n * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); }
    var вспышка = [0, 0, 0], молния = [0, 0, 0];
    function мягко(f) { return 4.2 * (1 - Math.exp(-f / 2.2)); }
    var ЯЧЕЙКА = 5.2;
    function разряды(t) {
      вспышка[0] = вспышка[1] = вспышка[2] = 0;
      молния[0] = молния[1] = молния[2] = 0;
      var k0 = Math.floor(t / ЯЧЕЙКА);
      for (var k = k0 - 1; k <= k0; k++) {
        var нач = k * ЯЧЕЙКА + хэш(k) * 3.4;
        if (t < нач) continue;
        var к = Math.floor(хэш(k + .31) * 3) % 3;
        var сила = .7 + хэш(k + .57) * .9;
        var штрихов = 2 + Math.floor(хэш(k + .77) * 3);
        var шт = нач;
        for (var j = 0; j < штрихов; j++) {
          if (t >= шт) {
            var e = Math.exp(-(t - шт) / .07) * (j === 0 ? 1 : .75);
            вспышка[к] += сила * e * 2.2;
            молния[к] += сила * e * (j === 0 ? 1 : .8);
          }
          шт += .06 + хэш(k * 3.1 + j) * .11;
        }
        вспышка[к] += сила * .35 * Math.exp(-(t - нач) / .55);
        /* соседняя точка вторит слабее: гроза светится вся */
        вспышка[(к + 1) % 3] += сила * .25 * Math.exp(-(t - нач - .05) / .3);
      }
    }

    /* ── СОБЫТИЯ ───────────────────────────────────────────────────
       Время события запоминается по t последнего кадра, реакция
       считается от него: заморозка и тут даёт повторяемый кадр. */
    var сейчас = 0;
    var удар = -1e9;
    var ряды = [-1e9, -1e9, -1e9, -1e9], рядыЖивые = [1, 1, 1, 1], рядКуда = 0;
    var связь = { цель: 0, от: 0, было: 0, с: -1e9, заряд: -1e9 };

    function уровеньСвязи(t) {
      var k = Math.min(1, Math.max(0, (t - связь.с) / 1.4));
      k = k * k * (3 - 2 * k);
      return связь.было + (связь.цель - связь.было) * k;
    }
    function задатьСвязь(цель, t) {
      связь.было = уровеньСвязи(t);
      связь.цель = цель; связь.с = t;
    }

    function стробУдара(dt0) {
      /* каскад: A сразу, C ползёт по наковальне, B уходит вниз */
      var r = [0, 0, 0], м = [0, 0, 0];
      if (dt0 < 0 || dt0 > 2.5) return { в: r, м: м };
      var шА = [0, .085, .2, .36];
      for (var i = 0; i < шА.length; i++) {
        var q = dt0 - шА[i];
        if (q >= 0) { var e = Math.exp(-q / .085); r[0] += e * (i ? 3.2 : 5.5); м[0] += e * (i ? 1.8 : 3.0); }
      }
      r[0] += 1.6 * Math.exp(-dt0 / .5);
      var qC = dt0 - .12;
      if (qC >= 0) { var eC = Math.exp(-qC / .1); r[2] += eC * 2.6 + .6 * Math.exp(-qC / .45); м[2] += eC * 1.3; }
      var qB = dt0 - .26;
      if (qB >= 0) { var eB = Math.exp(-qB / .09); r[1] += eB * 2.4 + .5 * Math.exp(-qB / .4); м[1] += eB * 1.4; }
      return { в: r, м: м };
    }

    /* Якоря главного экрана. Кнопка при нажатии сжимается, а при смене
       раздела исчезает: пересобрать мир на каждое такое движение значит
       заставить Землю дышать вместе с пальцем. Поэтому новая раскладка
       принимается, только когда якоря простояли на новом месте полсекунды
       (30 кадров), а на экранах без кнопки держится последняя главная. */
    var кандидат = null, стабильно = 0;
    function снятьГлавные() {
      var к = я.кнопка;
      if (!(к.видна && к.r > 4)) return null;
      var ly = (я.список.видна && я.список.в > 0) ? я.список.y : (главные ? главные.ly : к.y + 4.9 * к.r);
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
        разложить(); подогнатьКосмос();
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
        var маятник = 26 * Math.PI / 180 * Math.sin(2 * Math.PI * t / 7200);
        у.uRot.value = маятник;
        у.uCloudRot.value = маятник * 1.12 + t * .00006;
        var св = уровеньСвязи(t);
        у.uConnect.value = св;
        if (вид.космос) {
          var др = .03 * Math.sin(t * .011), др2 = .03 * Math.cos(t * .008);
          /* Верх экрана стоит на 0.2 высоты снимка: ядро Млечного Пути
             (0.44 снимка) уходит ровно за лимб и подсвечивает его сзади,
             а полоса тянется над кнопкой вверх-влево, как в концепте. */
          у.uSpaceTf.value.set(вид.космос.sx, вид.космос.sy,
            (1 - вид.космос.sx) / 2 + др * (1 - вид.космос.sx),
            .8 - вид.космос.sy + др2 * .02);
        }

        разряды(t);
        var су = стробУдара(t - удар);
        var fA = вспышка[0] + су.в[0], fB = вспышка[1] + су.в[1], fC = вспышка[2] + су.в[2];
        var bA = молния[0] + су.м[0], bB = молния[1] + су.м[1], bC = молния[2] + су.м[2];
        for (var i = 0; i < 4; i++) {
          var q = t - ряды[i];
          if (q >= 0 && q < 1.5) {
            var e = Math.exp(-q / .08) * (рядыЖивые[i] ? 1 : .35);
            if (i % 2) { fB += e * 1.3; bB += e * .7; } else { fC += e * 1.3; bC += e * .6; }
          }
        }
        /* подключение: гроза заряжается - мелкая частая дрожь */
        var зq = t - связь.заряд;
        if (зq >= 0 && зq < 6 && связь.цель < .5) {
          var др3 = .5 + .5 * Math.sin(t * 23.0) * Math.sin(t * 7.3 + 1.0);
          fA += др3 * .9; fB += др3 * .4;
        }
        /* постоянное тлеющее свечение: гроза видна и между ударами */
        var тлеет = 2.5 + .5 * Math.sin(t * 1.7) * Math.sin(t * .63 + 2.0) + 1.1 * св;
        var гу = грозыМат.uniforms;
        /* Вспышка упирается в мягкий потолок: без него удар заливал
           облако ровной белизной и съедал его рельеф. */
        гу.uFl.value.set(тлеет + мягко(fA), тлеет + мягко(fB), тлеет * .7 + мягко(fC));
        гу.uBo.value.set(bA, bB, bC);
        гу.uAmb.value.set(.5 + .12 * св, .08);
        гу.uTime.value = t;
        у.uSpill.value.z = Math.min(2.2, fA * .35 + (fB + fC) * .15 + тлеет * .05);
      },

      размер: function (ш, в) {
        вид.ш = ш; вид.в = в;
        главные = снятьГлавные() || главные;
        разложить();
        подогнатьКосмос();
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
      }
    };
  });
})();
