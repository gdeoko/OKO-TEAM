/* Rocket VPN. Кирпичная стена, которую пробивают насквозь.

   ЗАЧЕМ ОНА ЕСТЬ. Сценарий владельца идёт одной ниткой: домик на Луне
   разбирается и собирается в стену из тех же блоков, а следующим
   поворотом колеса «этаже стена пробивается и превращается в туннель».
   Слово «этаже» тут главное. Пробивать надо ТУ ЖЕ стену, а не другую
   похожую: если на прокол выехало бы кольцо из шейдера, а кладка
   осталась в прошлом акте, обещание сценария не сдержано.

   ПОЧЕМУ ОТДЕЛЬНЫЙ ФАЙЛ, А НЕ ПРОДОЛЖЕНИЕ СТАНЦИИ. Станции разнесены по
   миру на сотни единиц, и одна кладка физически не может стоять сразу в
   двух гнёздах. Непрерывность тут не пространственная, а зрительная:
   кадр кончается стеной во весь экран и начинается стеной во весь
   экран. Ровно так склеены сцены у igloo - непрерывно по прокрутке,
   раздельно по миру. Поэтому здесь СВОЯ кладка, но из того же бруска, с
   тем же фотосканом и с той же перевязкой рядов.

   КАК ПРОБИВАЕТСЯ. У igloo разлёт осколков считается от РАССТОЯНИЯ ДО
   КАМЕРЫ: чем ближе осколок, тем сильнее его уводит с пути. Здесь тот
   же закон, но от центра пробоя: кирпич у оси взгляда снимается первым и
   уходит на камеру, дальние держатся дольше, у самого края стена стоит
   до конца и проходит мимо стенами коридора. Дыра растёт быстрее, чем
   успевает вырасти сама стена в кадре, поэтому «приехали в стену» не
   наступает никогда - к моменту, когда камера доходит до плоскости,
   дыра уже шире кадра.

   ЧИСЛА. Стена сорок шесть на тридцать единиц - это кадр целиком на
   доле 0.15, когда до неё ещё тридцать единиц хода. Сетка выводится из
   числа кирпичей при отношении сторон кирпича два к одному, ряды
   сдвинуты на полкирпича. Скругление бруска 0.15, как у станции: при
   0.26 растянутый кирпич читается подушкой.

   API:
     RV_КИРПИЧИ.собрать(мир, родитель, о) -> Group | null
     RV_КИРПИЧИ.кадр(пробой, dt, часы)
     RV_КИРПИЧИ.видно(да)
     RV_КИРПИЧИ.замер() -> объект для живых проверок */
(function (g) {
  "use strict";

  var W = null, T = null;
  var М = {};
  var собрано = false;

  function зажать(v, н, в) { return v < н ? н : (v > в ? в : v); }
  function плавно(a, b, x) { x = зажать((x - a) / (b - a), 0, 1); return x * x * (3 - 2 * x); }

  /* ── Брусок ────────────────────────────────────────────────────
     Тот же скруглённый кирпич, что у станции: коробка 4x4x4 сегмента,
     подтянутая к шару на 0.15, со склеенными швами вершин. Повторён, а
     не вынесен в общий файл, намеренно: станция строится и живёт даже
     когда прокол ещё не подгружен, и связывать их порядком загрузки
     значит ставить оба акта в зависимость от очереди скриптов. */
  function брусок() {
    var гео = new T.BoxGeometry(1, 1, 1, 4, 4, 4);
    var p = гео.attributes.position;
    var карта = {}, нов = [], перенос = new Int32Array(p.count);
    for (var a = 0; a < p.count; a++) {
      var v = new T.Vector3(p.getX(a), p.getY(a), p.getZ(a));
      var сф = v.clone().normalize().multiplyScalar(0.5);
      v.lerp(сф, 0.15);
      var кл = Math.round(v.x * 1e4) + "_" + Math.round(v.y * 1e4) + "_" + Math.round(v.z * 1e4);
      if (карта[кл] === undefined) { карта[кл] = нов.length / 3; нов.push(v.x, v.y, v.z); }
      перенос[a] = карта[кл];
    }
    var ind = гео.index, новИнд = [];
    for (var b = 0; b < ind.count; b++) новИнд.push(перенос[ind.getX(b)]);
    var г = new T.BufferGeometry();
    г.setAttribute("position", new T.Float32BufferAttribute(нов, 3));
    г.setIndex(новИнд);
    г.computeVertexNormals();
    /* UV по местным координатам: фотоскан должен лечь на грань, а
       коробка после склейки швов свою развёртку потеряла. */
    var поз = г.attributes.position, uv = new Float32Array(поз.count * 2);
    for (var u = 0; u < поз.count; u++) {
      uv[u * 2] = поз.getX(u) + 0.5;
      uv[u * 2 + 1] = поз.getY(u) + 0.5;
    }
    г.setAttribute("uv", new T.Float32BufferAttribute(uv, 2));
    return г;
  }

  var В_КИРПИЧ = [
    "attribute float aSeed;",
    "attribute float aRaz;",
    "varying vec3 vNor;",
    "varying vec3 vLocN;",
    "varying vec2 vUv;",
    "varying float vSeed;",
    "varying float vRaz;",
    "varying float vMvz;",
    "varying vec3 vWorldPos;",
    "void main(){",
    "  vUv = uv; vSeed = aSeed; vRaz = aRaz; vLocN = normal;",
    "  vec4 loc = instanceMatrix * vec4(position, 1.0);",
    "  vNor = normalize(normalMatrix * mat3(instanceMatrix) * normal);",
    "  vec4 w = modelMatrix * loc;",
    "  vWorldPos = loc.xyz;",
    "  vec4 mv = viewMatrix * w;",
    "  vMvz = mv.z;",
    "  gl_Position = projectionMatrix * mv;",
    "}"
  ].join("\n");

  var Ф_КИРПИЧ = [
    "uniform vec3 uKamen;",
    "uniform vec3 uTen;",
    "uniform vec3 uVerh;",
    "uniform vec3 uGlow;",
    "uniform sampler2D tBlok;",
    "uniform sampler2D tBlokN;",
    "uniform float uTex;",
    "uniform float uBright;",
    "uniform float uTime;",
    "uniform vec3 uHits[5];",
    "uniform float uHitPow[5];",
    "varying vec3 vNor;",
    "varying vec3 vLocN;",
    "varying vec2 vUv;",
    "varying float vSeed;",
    "varying float vRaz;",
    "varying float vMvz;",
    "varying vec3 vWorldPos;",
    "float hash12(vec2 p){",
    "  vec3 p3 = fract(vec3(p.xyx) * 0.1031);",
    "  p3 += dot(p3, p3.yzx + 33.33);",
    "  return fract((p3.x + p3.y) * p3.z);",
    "}",
    "void main(){",
    "  vec3 an = abs(normalize(vLocN));",
    "  float edge = 1.0 - max(an.x, max(an.y, an.z));",
    "  edge = smoothstep(0.05, 0.4, edge);",
    /* Фотоскан со сдвигом по семени кирпича: без сдвига вся стена
       становится полем клонов, и это видно с первого взгляда. */
    "  vec2 uvT = vUv * 1.2 + vec2(vSeed, fract(vSeed * 7.31));",
    "  vec3 fot = texture2D(tBlok, uvT).rgb;",
    "  vec3 fotN = texture2D(tBlokN, uvT).xyz * 2.0 - 1.0;",
    "  vec3 n = normalize(vNor + fotN * 0.35 * uTex);",
    /* Свет коридора идёт спереди и сверху: источник в трубе один, и он
       за спиной у человека. Солнца тут нет, мы под поверхностью. */
    "  vec3 sun = normalize(vec3(-0.25, 0.55, 0.79));",
    "  float sol = smoothstep(-0.05, 0.55, dot(n, sun));",
    "  float hemi = n.y * 0.5 + 0.5;",
    "  vec3 base = mix(uTen, uKamen, 0.22 + 0.72 * sol);",
    "  base *= mix(vec3(1.0), fot / 0.68, uTex);",
    /* ТОНОВАЯ КРИВАЯ НИЖЕ ЕДИНИЦЫ. Стояло (0.34 + 0.86 * sol): на
       кирпиче, повёрнутом к свету, множитель доходил до 1.2, и близкий
       осколок выбивался в белое. На снимке доли 0.30 разлетающиеся
       кирпичи читались белыми плитами, а не камнем - при том, что
       позади них тёмный тоннель, и глаз шёл к ним, а не в проём. */
    "  vec3 color = base * (0.28 + 0.66 * sol) * mix(0.86, 1.04, hemi);",
    "  color *= mix(1.0, 0.6, smoothstep(0.5, 1.0, edge));",
    "  color = mix(color, uVerh * 1.02, edge * 0.14);",
    /* Разлом светится по кромке: кирпич, снявшийся с места, ловит свет
       из проёма. Пик на середине пути, на концах ноль. */
    "  float lom = vRaz * (1.0 - vRaz) * 4.0;",
    "  color += uGlow * lom * (0.22 + edge * 0.5) * 0.26;",
    /* ── ТРЕЩИНЫ ОТ ПОПАДАНИЙ ────────────────────────────────────
       Сценарий владельца: «по мере каждой карточки у стены появляется
       всё больше трещин и внутри этих трещин свечение ярче».

       Трещины СЧИТАЮТСЯ, а не рисуются картинкой: их рисунок зависит от
       того, куда именно попал снаряд, и заранее его не нарисуешь. Из
       каждой точки удара расходятся лучи, число лучей нечётное (семь),
       чтобы рисунок не выглядел снежинкой.

       Луч это узкая долина по углу вокруг точки удара, затухающая с
       расстоянием. Внутри долины камень уходит в темноту, а по её дну
       идёт свет: так выглядит щель, за которой что-то горит. */
    "  float shcheli = 0.0;",
    "  for (int h = 0; h < 5; h++) {",
    "    float sila = uHitPow[h];",
    "    if (sila <= 0.001) continue;",
    "    vec2 d = vWorldPos.xy - uHits[h].xy;",
    "    float r = length(d);",
    "    float ug = atan(d.y, d.x);",
    /* Семь лучей: модуль угла по 2*PI/7 даёт долину каждые 51 градус.
       Смещение по номеру удара разворачивает звёзды друг относительно
       друга, иначе все пять выглядели бы одним штампом. */
    "    float luch = abs(fract(ug * 1.1141 + float(h) * 0.37) - 0.5) * 2.0;",
    "    float uzost = smoothstep(0.86, 1.0, luch);",
    /* Дальше от точки удара трещина тоньше и глуше. Радиус растёт с
       силой: свежая трещина короткая, устоявшаяся расходится дальше. */
    "    float dalnost = 1.0 - smoothstep(0.0, 4.5 * sila + 1.0, r);",
    "    shcheli = max(shcheli, uzost * dalnost * sila);",
    "  }",
    "  color *= mix(1.0, 0.22, shcheli);",
    "  color += uGlow * pow(shcheli, 1.6) * 1.35;",
    /* Стена гаснет вдаль сама: у прокола нет тумана сцены, а без
       затухания дальние кирпичи спорят яркостью с ближними. */
    "  float dal = 1.0 - smoothstep(20.0, 96.0, -vMvz);",
    "  color *= mix(0.35, 1.0, dal) * uBright;",
    "  color += (hash12(gl_FragCoord.xy + uTime) - 0.5) / 255.0;",
    "  gl_FragColor = vec4(color, 1.0);",
    "}"
  ].join("\n");

  function собрать(мир, родитель, о) {
    if (собрано) return М.корень;
    W = мир || W;
    if (!W || !W.T || !родитель) return null;
    T = W.T;
    о = о || {};

    var ширина = о["ширина"] || 46;
    var высота = о["высота"] || 30;
    /* Кирпичей столько, чтобы сетка была видна кладкой, а не мозаикой.
       На слабой ступени их меньше: кирпич крупнее, разлёт тот же. */
    var сколько = W.ступень === 0 ? 96 : (W.ступень === 1 ? 154 : 216);
    var стлб = Math.max(4, Math.round(Math.sqrt(сколько * ширина / (2 * высота))));
    var рядов = Math.max(3, Math.ceil(сколько / стлб));
    var кШ = ширина / стлб, кВ = высота / рядов;
    var толщ = о["толщина"] || 1.5;
    var N = стлб * рядов;

    М.куски = [];
    var семя = 7717;
    function сл() { семя = (семя * 9301 + 49297) % 233280; return семя / 233280; }
    for (var р = 0; р < рядов; р++) {
      var сдв = (р % 2) ? кШ * 0.5 : 0;
      for (var с = 0; с < стлб; с++) {
        var x = (с - (стлб - 1) / 2) * кШ + сдв;
        var y = (р - (рядов - 1) / 2) * кВ;
        /* Расстояние до оси взгляда в ЕДИНИЦАХ КАДРА, а не в единицах
           мира: кадр шире, чем выше, и по кругу дыра прорвала бы верх и
           низ раньше, чем края. По эллипсу пробой раскрывается в кадре
           ровно, и стена уходит из него сразу со всех четырёх сторон. */
        var r = Math.sqrt((x / (ширина * 0.5)) * (x / (ширина * 0.5)) +
                          (y / (высота * 0.5)) * (y / (высота * 0.5)));
        М.куски.push({
          поз: new T.Vector3(x, y, 0),
          разм: new T.Vector3(кШ * 1.004, кВ * 0.985, толщ * (0.8 + 0.4 * сл())),
          r: r,
          rnd: new T.Vector3(сл(), сл(), сл()),
          /* Ось кувырка своя у каждого кирпича, иначе разлёт читается
             одним движением всей стены. */
          ось: new T.Vector3(сл() - 0.5, сл() - 0.5, сл() - 0.5).normalize()
        });
      }
    }

    var гео = брусок();
    var aSeed = new Float32Array(N), aRaz = new Float32Array(N);
    for (var i = 0; i < N; i++) {
      var к = М.куски[i];
      aSeed[i] = ((к.поз.x * 12.9898 + к.поз.y * 78.233) * 43758.5453) % 1;
      if (aSeed[i] < 0) aSeed[i] += 1;
    }
    гео.setAttribute("aSeed", new T.InstancedBufferAttribute(aSeed, 1));
    гео.setAttribute("aRaz", new T.InstancedBufferAttribute(aRaz, 1));
    гео.attributes.aRaz.setUsage(T.DynamicDrawUsage);
    М.aRaz = гео.attributes.aRaz;

    М.uТек = { value: null };
    М.uТекН = { value: null };
    М.uТекДоля = { value: 0 };
    М.мат = new T.ShaderMaterial({
      uniforms: {
        uKamen: { value: new T.Color(0x646D7C) },
        uTen: { value: new T.Color(0x2A3350) },
        uVerh: { value: new T.Color(0x9FA9BC) },
        uGlow: { value: new T.Color(0x8FB4FF) },
        tBlok: М.uТек, tBlokN: М.uТекН, uTex: М.uТекДоля,
        uBright: { value: 1 }, uTime: { value: 0 },
        uHits: { value: [new T.Vector3(), new T.Vector3(), new T.Vector3(),
                         new T.Vector3(), new T.Vector3()] },
        uHitPow: { value: [0, 0, 0, 0, 0] }
      },
      vertexShader: В_КИРПИЧ, fragmentShader: Ф_КИРПИЧ, fog: false
    });

    /* Фотоскан общий со станцией: файл в кеше браузера один, второй
       раз он по сети не поедет. Доля подмеса встаёт только когда
       доехали ОБЕ карты, иначе рельеф встанет без цвета. */
    (function () {
      var загр = new T.TextureLoader(), пришло = 0, анизо = 4;
      try { if (W.r && W.r.capabilities) анизо = Math.max(1, Math.min(8, W.r.capabilities.getMaxAnisotropy())); } catch (e) {}
      function готово() { if (++пришло >= 2) М.uТекДоля.value = 1; }
      загр.load("assets/gen/pbr/блок-цвет.webp", function (т) {
        т.colorSpace = T.SRGBColorSpace || т.colorSpace;
        т.wrapS = т.wrapT = T.RepeatWrapping; т.anisotropy = анизо;
        М.uТек.value = т; готово();
      });
      загр.load("assets/gen/pbr/блок-норм.webp", function (т) {
        т.colorSpace = T.NoColorSpace || T.LinearSRGBColorSpace || т.colorSpace;
        т.wrapS = т.wrapT = T.RepeatWrapping; т.anisotropy = анизо;
        М.uТекН.value = т; готово();
      });
    })();

    М.корень = new T.Group();
    М.корень.name = "кирпичная стена";
    М.кладка = new T.InstancedMesh(гео, М.мат, N);
    М.кладка.name = "кирпичи прокола";
    М.кладка.frustumCulled = false;
    М.кладка.instanceMatrix.setUsage(T.DynamicDrawUsage);
    М.кладка.renderOrder = 3;
    М.корень.add(М.кладка);
    родитель.add(М.корень);

    М.сетка = { стлб: стлб, рядов: рядов, шир: ширина, выс: высота, кШ: кШ, кВ: кВ };
    М.пробой = 0;
    собрано = true;
    кадр(0, 1 / 60, 0);
    return М.корень;
  }

  var _м = null, _q = null, _v = null, _s = null;
  function кадр(пробой, dt, часы) {
    if (!собрано) return;
    if (!_м) { _м = new T.Matrix4(); _q = new T.Quaternion(); _v = new T.Vector3(); _s = new T.Vector3(); }
    М.пробой = зажать(пробой || 0, 0, 1);
    М.мат.uniforms.uTime.value = часы || 0;
    var п = М.пробой;
    /* Радиус дыры в долях полукадра. Растёт быстрее самой стены в
       кадре: к моменту, когда камера доходит до плоскости, дыра уже
       шире экрана, и «приехали в стену» не наступает. */
    var радиус = п * 1.75;
    for (var i = 0; i < М.куски.length; i++) {
      var к = М.куски[i];
      /* Кирпич снимается, когда дыра дошла до него. Полоса перехода в
         0.42 радиуса: кромка пробоя не режет кладку по линейке, у неё
         есть рваный край в два-три кирпича. */
      var раз = зажать((радиус - к.r) / 0.42, 0, 1);
      раз = раз * раз * (3 - 2 * раз);
      /* Дрожь перед срывом: кирпич, до которого дыра почти дошла,
         подрагивает. Это их приём с дыханием кладки, укороченный до
         предвестника. */
      var дрожь = плавно(0.0, 0.22, раз) * (1 - плавно(0.22, 0.5, раз));
      var тр = дрожь * 0.32 * Math.sin((часы || 0) * 26 + к.rnd.x * 30);
      /* Разлёт: НА камеру и в стороны от оси. Вдоль оси взгляда сильнее,
         чем поперёк - осколок уходит мимо объектива, а не разлетается
         веером по плоскости стены, как это было бы от взрыва. */
      var вперёд = раз * раз * (14 + к.rnd.z * 22);
      var вбок = раз * (1.4 + к.rnd.y * 3.0);
      _v.set(к.поз.x * (1 + вбок * 0.06) + тр,
             к.поз.y * (1 + вбок * 0.06) + тр * 0.6,
             к.поз.z + вперёд);
      var угол = раз * раз * (2.6 + к.rnd.x * 4.2);
      _q.setFromAxisAngle(к.ось, угол);
      /* Осколок, ушедший далеко, съёживается: без этого дальний край
         разлёта висит в кадре крупными плитами и не даёт увидеть трубу. */
      var ужим = 1 - раз * раз * 0.55;
      _s.copy(к.разм).multiplyScalar(ужим);
      _м.compose(_v, _q, _s);
      М.кладка.setMatrixAt(i, _м);
      М.aRaz.array[i] = раз;
    }
    М.кладка.instanceMatrix.needsUpdate = true;
    М.aRaz.needsUpdate = true;
  }

  g.RV_КИРПИЧИ = {
    "собрать": собрать,
    "кадр": кадр,
    "видно": function (да) { if (собрано) М.корень.visible = !!да; },
    "яркость": function (v) { if (собрано) М.мат.uniforms.uBright.value = зажать(v, 0, 2); },
    /* Трещины ставит тот, кто бьёт: снаряды знают, куда попали, стена
       знает только как это нарисовать. */
    "удары": function (точки, силы) {
      if (!собрано || !точки || !силы) return;
      var у = М.мат.uniforms;
      for (var i = 0; i < 5; i++) {
        у.uHits.value[i].set(точки[i * 3] || 0, точки[i * 3 + 1] || 0, точки[i * 3 + 2] || 0);
        у.uHitPow.value[i] = силы[i] || 0;
      }
    },
    "корень": function () { return собрано ? М.корень : null; },
    "замер": function () {
      if (!собрано) return { "собрано": false };
      var целых = 0;
      for (var i = 0; i < М.aRaz.array.length; i++) if (М.aRaz.array[i] < 0.02) целых++;
      return {
        "собрано": true, "кирпичей": М.куски.length, "сетка": М.сетка,
        "пробой": +М.пробой.toFixed(3), "целых": целых,
        "видно": !!(М.корень && М.корень.visible)
      };
    }
  };
})(window);
