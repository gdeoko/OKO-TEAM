/* МИР: НАСТОЯЩИЙ 3D-ФОН ПРИЛОЖЕНИЯ ROCKET VPN

   Слово владельца: «хочу, чтобы было профессионально, круто, премиум 3D
   моушен дизайн с реальным реализмом, объёмом, неоновым стеклом, с
   чёткой 8К графикой, идеальным расположением элементов и связкой с
   фоном, и чтобы фон был шикарный».

   Прежний фон был нарисован градиентами CSS. Градиентом можно сделать
   красиво, но нельзя сделать настоящим: у градиента нет глубины, нет
   света, который падает на воду, нет волны, которая движется. Здесь фон
   это живая 3D-сцена на WebGL, одна на экран, и она отрисовывается с
   плотностью точек самого экрана - поэтому резкая на любом телефоне.

   ── КАК УСТРОЕН КАДР ──────────────────────────────────────────────

     1. Сцена темы рисуется в буфер с запасом яркости (HDR, половинная
        точность). Солнце там ярче единицы, и это не ошибка: из этого
        запаса и берётся свечение.
     2. Из того же кадра собирается уменьшенная размытая копия. Она
        нужна дважды: как матовое стекло под кнопкой и как основа
        свечения (bloom).
     3. Итоговый проход: кадр, свечение, ЛИНЗА кнопки подключения,
        тонмаппинг ACES, перевод в sRGB, виньетка, тонкое зерно.

   ── ЛИНЗА ЖИДКОГО СТЕКЛА ──────────────────────────────────────────
   Кнопка подключения это толстая стеклянная линза, как в iOS 26:
   середина почти плоская, а у кромки стекло гнёт свет сильно, и мир за
   кнопкой на краю заворачивается внутрь. CSS такого не умеет вовсе -
   backdrop-filter только размывает, преломления в нём нет. Поэтому
   линза рисуется здесь же, в итоговом проходе, по НАСТОЯЩЕМУ кадру мира:
   солнце, вода и молния видны через кнопку преломлёнными.

   ── ДОГОВОР СО СЦЕНОЙ ─────────────────────────────────────────────
   Сцена темы регистрируется так:

       МИР.сцена("океан", function (о) { return { ... }; });

   `о` отдаёт THREE, рендерер, якоря интерфейса (где кнопка, где список,
   где ось пингов) и загрузчик текстур. Сцена возвращает:

       сцена, камера        что рисовать
       кадр(t, dt)          движение, t в секундах
       размер(ш, в)         экран изменился (css-точки)
       источник()           {x, y} в css-точках: ОТКУДА идёт след замера.
                            Молния из грозы, огонь из сопла, вода из
                            солнечной дорожки - точка элемента фона.
       событие(имя, д)      интерфейс сообщает: пошёл удар, строка
                            загорелась, подключаемся, подключено
       уничтожить()         освободить видеопамять при смене темы

   Сцена сама решает, как ей выглядеть. Движок отвечает за то, чтобы все
   три темы одинаково честно светились, одинаково резко выводились и
   одинаково преломлялись в линзе. */

(function () {
  "use strict";

  var g = window;
  var THREE = g.THREE;
  var МИР = g.МИР = g.МИР || {};
  МИР.готов = false;
  МИР.жив = false;

  var фабрики = {};
  var ждёт = "";
  var холст, рендерер;
  var текущая = null, имяТекущей = "";
  var телефон;

  /* Якоря интерфейса в css-точках от левого верхнего угла телефона.
     Сцена строит композицию ОТ НИХ, а не от догадок: солнце обязано
     стоять над кнопкой, сопло ракеты - над осью пингов. */
  var якоря = МИР.якоря = {
    ширина: 0, высота: 0, dpr: 1,
    кнопка: { x: 0, y: 0, r: 0, видна: false },
    список: { x: 0, y: 0, ш: 0, в: 0, ось: 0, видна: false },
    рем: 10
  };

  /* ── ЗАПУСК ─────────────────────────────────────────────────────── */

  function можноЛи() {
    if (!THREE) return false;
    try {
      var п = document.createElement("canvas");
      return !!(п.getContext("webgl2") || п.getContext("webgl"));
    } catch (о) { return false; }
  }

  var цели = {};
  var пост = {};
  var квадрат, камераКв, сценаКв;
  var полуточность = true;
  var масштаб = 1, пределМасштаба = 2;
  var заморожено = null;
  var начало = 0, прошлое = 0;
  var замерКадров = { сумма: 0, число: 0 };
  var линза = { сила: 1, цвет: new (THREE ? THREE.Color : Object)(0x3fe0ff), вкл: 1 };
  var свечение = { сила: 0.9, порог: 1.0 };
  var экспозиция = 1.0;

  function создатьЦель(ш, в, глубина) {
    var ц = new THREE.WebGLRenderTarget(Math.max(1, ш), Math.max(1, в), {
      type: полуточность ? THREE.HalfFloatType : THREE.UnsignedByteType,
      format: THREE.RGBAFormat,
      minFilter: THREE.LinearFilter,
      magFilter: THREE.LinearFilter,
      depthBuffer: !!глубина,
      stencilBuffer: false,
      generateMipmaps: false
    });
    ц.texture.colorSpace = THREE.LinearSRGBColorSpace;
    return ц;
  }

  /* ШЕЙДЕРЫ ПИШУТСЯ ТОЛЬКО ЛАТИНИЦЕЙ. GLSL не принимает кириллицу нигде -
     ни в именах, ни в комментариях: первый запуск упал на «'?' : syntax
     error», и весь фон погас. Поэтому пояснения к шейдерам живут здесь,
     в JavaScript, а внутри строк шейдера только ASCII.

     DOWN    уменьшение: среднее четырёх соседей со сдвигом в полтекселя.
             Один отсчёт на каждый второй пиксель пропускает мелкие яркие
             точки, и блики на воде мигают от кадра к кадру.
     BLUR    Гаусс в девять отсчётов, отдельно по горизонтали и по
             вертикали: два прохода по девять дешевле одного на
             восемьдесят один, а глазу разницы нет.
     BRIGHT  мягкий порог свечения: жёсткий срез даёт вокруг бликов
             кольцо, мягкое колено пускает и то, что чуть ярче порога.
     FINAL   итог: кадр, свечение, линза кнопки, ACES, sRGB, виньетка,
             зерно. Линза: толщина стекла растёт к кромке, середина почти
             не гнёт свет, кромка гнёт сильно. Три канала преломляются
             чуть по-разному - радужная кайма, по которой глаз узнаёт
             стекло. Тело линзы темнее мира, и середина темнее кромки:
             там стоит белая надпись, а за кнопкой в океане горит
             солнечная дорожка - при ровном притенении «Подключиться»
             терялось в бликах. Блик по кромке сверху слева, как у всего
             интерфейса. Зерно и дизеринг: без них тёмные градиенты неба
             рвутся полосами. */
  var ВЕРШИНА = [
    "varying vec2 vUv;",
    "void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }"
  ].join("\n");

  var ВНИЗ = [
    "uniform sampler2D tSrc; uniform vec2 uStep; varying vec2 vUv;",
    "void main(){",
    "  vec3 c = texture2D(tSrc, vUv + uStep*vec2(-.5,-.5)).rgb;",
    "  c += texture2D(tSrc, vUv + uStep*vec2( .5,-.5)).rgb;",
    "  c += texture2D(tSrc, vUv + uStep*vec2(-.5, .5)).rgb;",
    "  c += texture2D(tSrc, vUv + uStep*vec2( .5, .5)).rgb;",
    "  gl_FragColor = vec4(c*.25, 1.0);",
    "}"
  ].join("\n");

  var РАЗМЫТЬ = [
    "uniform sampler2D tSrc; uniform vec2 uDir; varying vec2 vUv;",
    "void main(){",
    "  vec3 c = texture2D(tSrc, vUv).rgb * .2270270270;",
    "  c += texture2D(tSrc, vUv + uDir*1.3846153846).rgb * .3162162162;",
    "  c += texture2D(tSrc, vUv - uDir*1.3846153846).rgb * .3162162162;",
    "  c += texture2D(tSrc, vUv + uDir*3.2307692308).rgb * .0702702703;",
    "  c += texture2D(tSrc, vUv - uDir*3.2307692308).rgb * .0702702703;",
    "  gl_FragColor = vec4(c, 1.0);",
    "}"
  ].join("\n");

  var ЯРКОЕ = [
    "uniform sampler2D tSrc; uniform float uThr; varying vec2 vUv;",
    "void main(){",
    "  vec3 c = texture2D(tSrc, vUv).rgb;",
    "  float br = max(c.r, max(c.g, c.b));",
    "  float knee = uThr * .5;",
    "  float s = clamp(br - uThr + knee, 0.0, 2.0*knee);",
    "  s = s*s / (4.0*knee + 1e-4);",
    "  float w = max(s, br - uThr) / max(br, 1e-4);",
    "  gl_FragColor = vec4(c * w, 1.0);",
    "}"
  ].join("\n");

  var ИТОГ = [
    "uniform sampler2D tFrame; uniform sampler2D tFrost; uniform sampler2D tGlow1; uniform sampler2D tGlow2;",
    "uniform vec2 uRes;",
    "uniform vec4 uBtn;",
    "uniform vec3 uTint;",
    "uniform float uLens, uGlow, uExpo, uTime, uGrain;",
    "varying vec2 vUv;",
    "vec3 aces(vec3 x){ x *= .6; return clamp((x*(2.51*x+.03))/(x*(2.43*x+.59)+.14), 0.0, 1.0); }",
    "vec3 toSrgb(vec3 c){ c = max(c, 0.0); return mix(c*12.92, 1.055*pow(c, vec3(1.0/2.4)) - .055, step(.0031308, c)); }",
    "float hash(vec2 p){ return fract(sin(dot(p, vec2(12.9898,78.233))) * 43758.5453); }",
    "void main(){",
    "  vec2 uv = vUv;",
    "  vec3 c = texture2D(tFrame, uv).rgb;",
    "  vec3 glow = texture2D(tGlow1, uv).rgb * .65 + texture2D(tGlow2, uv).rgb * .9;",
    "  vec2 p = gl_FragCoord.xy;",
    "  vec2 d = p - uBtn.xy;",
    "  float dl = length(d);",
    "  float R = uBtn.z;",
    "  float inside = (uLens > .5 && uBtn.w > .5) ? 1.0 - smoothstep(R - 1.2, R + .6, dl) : 0.0;",
    "  if (inside > 0.0) {",
    "    float r = dl / R;",
    "    vec2 n = d / max(dl, 1e-3);",
    "    float edge = smoothstep(.52, 1.0, r);",
    "    float bend = pow(edge, 2.4);",
    "    vec2 off = -n * bend * R * .42 / uRes;",
    "    vec2 mag = -d * .075 / uRes;",
    "    vec2 q = uv + off + mag;",
    "    vec3 sharp = vec3(texture2D(tFrame, q).r, texture2D(tFrame, q + off*.07).g, texture2D(tFrame, q + off*.14).b);",
    "    vec3 frost = texture2D(tFrost, q).rgb;",
    "    vec3 L = mix(sharp, frost, .30 + .40*edge);",
    "    L *= mix(.44, .66, edge);",
    "    L += uTint * (.035 + .10*bend);",
    "    float rim = smoothstep(.86, .975, r) * (1.0 - smoothstep(.975, 1.0, r));",
    "    float side = dot(n, normalize(vec2(-.5, .86)));",
    "    L += rim * (.22 + 1.1*max(side, 0.0)) * vec3(1.0);",
    "    L += rim * .35 * max(-side, 0.0) * uTint;",
    "    vec2 gl = (d - vec2(0.0, R*.42)) / vec2(R*.78, R*.36);",
    "    L += vec3(1.0) * .085 * (1.0 - smoothstep(0.0, 1.0, dot(gl, gl))) * (1.0 - edge);",
    "    c = mix(c, L, inside);",
    "    glow *= mix(1.0, .55, inside);",
    "  }",
    "  c += glow * uGlow;",
    "  c *= uExpo;",
    "  c = aces(c);",
    "  vec2 v = uv - .5;",
    "  c *= 1.0 - .28 * smoothstep(.35, .95, dot(v*vec2(1.25,1.0), v*vec2(1.25,1.0))*2.0);",
    "  c = toSrgb(c);",
    "  float z = hash(p + fract(uTime*7.13)*100.0) - .5;",
    "  c += z * uGrain + (hash(p*1.37) - .5) / 255.0;",
    "  gl_FragColor = vec4(c, 1.0);",
    "}"
  ].join("\n");

  function материал(фраг, униформы) {
    return new THREE.ShaderMaterial({
      vertexShader: ВЕРШИНА, fragmentShader: фраг, uniforms: униформы,
      depthTest: false, depthWrite: false
    });
  }

  function проход(мат, цель) {
    квадрат.material = мат;
    рендерер.setRenderTarget(цель || null);
    рендерер.render(сценаКв, камераКв);
  }

  function построитьПост() {
    камераКв = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    сценаКв = new THREE.Scene();
    квадрат = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), null);
    квадрат.frustumCulled = false;
    сценаКв.add(квадрат);
    пост.вниз = материал(ВНИЗ, { tSrc: { value: null }, uStep: { value: new THREE.Vector2() } });
    пост.размыть = материал(РАЗМЫТЬ, { tSrc: { value: null }, uDir: { value: new THREE.Vector2() } });
    пост.яркое = материал(ЯРКОЕ, { tSrc: { value: null }, uThr: { value: 1.0 } });
    пост.итог = материал(ИТОГ, {
      tFrame: { value: null }, tFrost: { value: null }, tGlow1: { value: null }, tGlow2: { value: null },
      uRes: { value: new THREE.Vector2(1, 1) },
      uBtn: { value: new THREE.Vector4(0, 0, 0, 0) },
      uTint: { value: new THREE.Vector3(.25, .88, 1.0) },
      uLens: { value: 1 }, uGlow: { value: .9 }, uExpo: { value: 1 },
      uTime: { value: 0 }, uGrain: { value: .012 }
    });
  }

  function пересобратьЦели() {
    var ш = Math.round(якоря.ширина * якоря.dpr * масштаб);
    var в = Math.round(якоря.высота * якоря.dpr * масштаб);
    Object.keys(цели).forEach(function (к) { цели[к].dispose(); });
    цели.кадр = создатьЦель(ш, в, true);
    цели.пол = создатьЦель(ш >> 1, в >> 1);
    цели.четв = создатьЦель(ш >> 2, в >> 2);
    цели.четв2 = создатьЦель(ш >> 2, в >> 2);
    цели.свет = создатьЦель(ш >> 2, в >> 2);
    цели.свет2 = создатьЦель(ш >> 2, в >> 2);
    цели.восьм = создатьЦель(ш >> 3, в >> 3);
    цели.восьм2 = создатьЦель(ш >> 3, в >> 3);
    пост.итог.uniforms.uRes.value.set(ш, в);
  }

  function размыть(ц, пара, сила) {
    var т = ц.texture.image;
    пост.размыть.uniforms.tSrc.value = ц.texture;
    пост.размыть.uniforms.uDir.value.set(сила / т.width, 0);
    проход(пост.размыть, пара);
    пост.размыть.uniforms.tSrc.value = пара.texture;
    пост.размыть.uniforms.uDir.value.set(0, сила / т.height);
    проход(пост.размыть, ц);
  }

  function вниз(из, в) {
    var т = из.texture.image;
    пост.вниз.uniforms.tSrc.value = из.texture;
    пост.вниз.uniforms.uStep.value.set(1 / т.width, 1 / т.height);
    проход(пост.вниз, в);
  }

  /* ── ЯКОРЯ ИНТЕРФЕЙСА ───────────────────────────────────────────── */

  function мерка(узел, база) {
    if (!узел) return null;
    var к = узел.getBoundingClientRect();
    if (!к.width || !к.height) return null;
    return { x: к.left - база.left, y: к.top - база.top, ш: к.width, в: к.height };
  }

  function обновитьЯкоря() {
    if (!телефон) return;
    var б = телефон.getBoundingClientRect();
    якоря.ширина = б.width;
    якоря.высота = б.height;
    якоря.рем = parseFloat(getComputedStyle(document.documentElement).fontSize) || 10;

    /* Круг линзы это СТЕКЛЯННОЕ ядро кнопки, а не вся кнопка: снаружи
       ядра стоит неоновый обод, и преломлять его нечем. */
    var к = мерка(document.querySelector("#пуск .ядро"), б) || мерка(document.getElementById("пуск"), б);
    if (к) {
      якоря.кнопка.x = к.x + к.ш / 2;
      якоря.кнопка.y = к.y + к.в / 2;
      якоря.кнопка.r = Math.min(к.ш, к.в) / 2;
      якоря.кнопка.видна = true;
    } else {
      якоря.кнопка.видна = false;
    }

    var с = document.querySelector(".экран.тут .список");
    var сп = мерка(с, б);
    if (сп) {
      якоря.список.x = сп.x; якоря.список.y = сп.y;
      якоря.список.ш = сп.ш; якоря.список.в = сп.в;
      var ряд = с.querySelector(".ряд");
      var пинг = ряд && ряд.querySelector(".пинг");
      var звезда = ряд && ряд.querySelector(".звезда");
      if (пинг && звезда) {
        var пк = пинг.getBoundingClientRect(), зк = звезда.getBoundingClientRect();
        якоря.список.ось = (пк.right + зк.left) / 2 - б.left;
      } else {
        якоря.список.ось = сп.x + сп.ш * .84;
      }
      якоря.список.видна = true;
    } else {
      якоря.список.видна = false;
    }
  }
  МИР.обновитьЯкоря = обновитьЯкоря;

  /* ── РАЗМЕР ─────────────────────────────────────────────────────── */

  function подогнать() {
    обновитьЯкоря();
    якоря.dpr = Math.min(g.devicePixelRatio || 1, пределМасштаба);
    рендерер.setPixelRatio(якоря.dpr * масштаб);
    рендерер.setSize(якоря.ширина, якоря.высота, false);
    холст.style.width = якоря.ширина + "px";
    холст.style.height = якоря.высота + "px";
    пересобратьЦели();
    if (текущая && текущая.размер) текущая.размер(якоря.ширина, якоря.высота);
  }

  /* ── СМЕНА СЦЕНЫ ────────────────────────────────────────────────── */

  var текстуры = new (THREE ? THREE.TextureLoader : Object)();
  function загрузить(путь, цветная) {
    return new Promise(function (да, нет) {
      текстуры.load(путь, function (т) {
        if (цветная !== false) т.colorSpace = THREE.SRGBColorSpace;
        т.anisotropy = Math.min(8, рендерер.capabilities.getMaxAnisotropy());
        да(т);
      }, undefined, нет);
    });
  }

  function включить(имя) {
    if (!рендерер) { ждёт = имя; return; }
    if (имя === имяТекущей && текущая) return;
    var ф = фабрики[имя];
    if (текущая && текущая.уничтожить) {
      try { текущая.уничтожить(); } catch (о) {}
    }
    /* У темы ещё нет сцены (файл не пришёл, сцена не собралась): мир
       гаснет и уступает место нарисованному запасному фону. Оставить
       прежнюю сцену нельзя - в теме огня висел бы чужой океан. */
    if (!ф) {
      ждёт = имя; текущая = null; имяТекущей = "";
      document.documentElement.classList.remove("мир-живой");
      return;
    }
    текущая = null; имяТекущей = имя;
    обновитьЯкоря();
    try {
      текущая = ф({
        THREE: THREE, рендерер: рендерер, якоря: якоря,
        загрузить: загрузить,
        линза: function (цвет, сила) {
          if (цвет) пост.итог.uniforms.uTint.value.set(цвет[0], цвет[1], цвет[2]);
          if (сила !== undefined) линза.сила = сила;
        },
        свечение: function (сила, порог) {
          if (сила !== undefined) пост.итог.uniforms.uGlow.value = сила;
          if (порог !== undefined) пост.яркое.uniforms.uThr.value = порог;
        },
        экспозиция: function (э) { пост.итог.uniforms.uExpo.value = э; }
      });
      if (текущая && текущая.размер) текущая.размер(якоря.ширина, якоря.высота);
      document.documentElement.classList.add("мир-живой");
    } catch (ош) {
      if (g.console) console.error("МИР: сцена «" + имя + "» не собралась", ош);
      текущая = null;
      document.documentElement.classList.remove("мир-живой");
    }
  }

  МИР.сцена = function (имя, фабрика) {
    фабрики[имя] = фабрика;
    if (ждёт === имя || имяТекущей === имя) { имяТекущей = ""; включить(имя); }
  };
  МИР.тема = function (имя) { ждёт = имя; включить(имя); };
  МИР.сказать = function (событие, данные) {
    if (текущая && текущая.событие) {
      try { текущая.событие(событие, данные || {}); } catch (о) {}
    }
  };
  МИР.источник = function () {
    if (текущая && текущая.источник) {
      try { return текущая.источник(); } catch (о) {}
    }
    return null;
  };
  МИР.текущая = function () { return имяТекущей; };

  /* ── КАДР ───────────────────────────────────────────────────────── */

  function кадр(сейчас) {
    g.requestAnimationFrame(кадр);
    if (!текущая) return;
    if (document.hidden) return;

    var t = заморожено !== null ? заморожено : (сейчас - начало) / 1000;
    var dt = Math.min(.05, Math.max(0, t - прошлое));
    прошлое = t;

    обновитьЯкоряДёшево();
    try { текущая.кадр(t, dt); } catch (о) {}

    рендерер.setRenderTarget(цели.кадр);
    рендерер.clear();
    рендерер.render(текущая.сцена, текущая.камера);

    /* матовое стекло и основа свечения из одного уменьшения */
    вниз(цели.кадр, цели.пол);
    вниз(цели.пол, цели.четв);
    размыть(цели.четв, цели.четв2, 1.4);

    пост.яркое.uniforms.tSrc.value = цели.четв.texture;
    проход(пост.яркое, цели.свет);
    размыть(цели.свет, цели.свет2, 1.2);
    вниз(цели.свет, цели.восьм);
    размыть(цели.восьм, цели.восьм2, 1.6);
    размыть(цели.восьм, цели.восьм2, 2.6);

    var у = пост.итог.uniforms;
    у.tFrame.value = цели.кадр.texture;
    у.tFrost.value = цели.четв.texture;
    у.tGlow1.value = цели.свет.texture;
    у.tGlow2.value = цели.восьм.texture;
    var пк = якоря.dpr * масштаб;
    у.uBtn.value.set(
      якоря.кнопка.x * пк,
      (якоря.высота - якоря.кнопка.y) * пк,
      якоря.кнопка.r * пк,
      якоря.кнопка.видна ? 1 : 0);
    у.uLens.value = линза.сила > 0 ? 1 : 0;
    у.uTime.value = t;
    проход(пост.итог, null);

    следитьЗаСкоростью(сейчас);
  }

  /* Кнопку меряем каждый кадр: она сжимается при нажатии и уезжает при
     смене раздела, и линза, отставшая на полсекунды, выглядит
     приклеенной картинкой. Список меряем реже - он стоит на месте. */
  var счётЯкорей = 0;
  function обновитьЯкоряДёшево() {
    счётЯкорей += 1;
    if (счётЯкорей % 20 === 0) { обновитьЯкоря(); return; }
    var б = телефон.getBoundingClientRect();
    var к = мерка(document.querySelector("#пуск .ядро"), б);
    if (к) {
      якоря.кнопка.x = к.x + к.ш / 2;
      якоря.кнопка.y = к.y + к.в / 2;
      якоря.кнопка.r = Math.min(к.ш, к.в) / 2;
      якоря.кнопка.видна = true;
    } else {
      якоря.кнопка.видна = false;
    }
  }

  /* ── СКОРОСТЬ ───────────────────────────────────────────────────────
     Слабый телефон не должен платить за красоту дёрганой картинкой.
     Движок меряет время кадра и, если оно стабильно дольше 22 мс,
     снижает внутреннее разрешение фона ступенями. Интерфейс при этом
     остаётся в полной резкости: он рисуется браузером, а не здесь. */
  var прошлыйМиг = 0;
  function следитьЗаСкоростью(сейчас) {
    if (заморожено !== null) return;
    if (прошлыйМиг) {
      var мс = сейчас - прошлыйМиг;
      if (мс < 250) { замерКадров.сумма += мс; замерКадров.число += 1; }
    }
    прошлыйМиг = сейчас;
    if (замерКадров.число >= 90) {
      var среднее = замерКадров.сумма / замерКадров.число;
      замерКадров.сумма = 0; замерКадров.число = 0;
      if (среднее > 22 && масштаб > .55) {
        масштаб = Math.max(.55, масштаб - .15);
        подогнать();
      }
    }
  }

  /* ── ДЛЯ СБОРЩИКА КАДРОВ ────────────────────────────────────────────
     Живой кадр снимать нельзя: он всё время другой. Время замораживается
     на заданной секунде, и снимок повторяется точь-в-точь. */
  МИР.заморозить = function (t) {
    заморожено = (t === null || t === undefined) ? null : +t;
    прошлое = заморожено || 0;
  };
  МИР.масштаб = function (м) {
    if (м) { масштаб = м; подогнать(); }
    return масштаб;
  };

  /* ── ПОДЪЁМ ─────────────────────────────────────────────────────── */

  function поднять() {
    телефон = document.getElementById("телефон");
    if (!телефон || !можноЛи()) {
      document.documentElement.classList.add("мир-нет");
      return;
    }
    холст = document.createElement("canvas");
    холст.className = "мир-холст";
    холст.setAttribute("aria-hidden", "true");
    телефон.insertBefore(холст, телефон.firstChild);

    try {
      рендерер = new THREE.WebGLRenderer({
        canvas: холст, antialias: true, alpha: false,
        powerPreference: "high-performance", stencil: false
      });
    } catch (о) {
      холст.remove();
      document.documentElement.classList.add("мир-нет");
      return;
    }
    рендерер.autoClear = false;
    рендерер.setClearColor(0x000000, 1);
    рендерер.outputColorSpace = THREE.LinearSRGBColorSpace;
    рендерер.toneMapping = THREE.NoToneMapping;

    /* Половинная точность нужна свечению: в восьмибитном буфере солнце
       упирается в единицу и светится так же, как белая стена. Нет её у
       видеокарты - работаем в восьми битах, свечение станет скромнее. */
    var гл = рендерер.getContext();
    полуточность = !!(рендерер.capabilities.isWebGL2 &&
      (гл.getExtension("EXT_color_buffer_half_float") || гл.getExtension("EXT_color_buffer_float")));

    построитьПост();

    холст.addEventListener("webglcontextlost", function (е) {
      е.preventDefault();
      document.documentElement.classList.remove("мир-живой");
      document.documentElement.classList.add("мир-нет");
    });

    var тянуть = null;
    g.addEventListener("resize", function () {
      clearTimeout(тянуть);
      тянуть = setTimeout(подогнать, 120);
    });

    подогнать();
    начало = performance.now();
    МИР.жив = true;
    МИР.готов = true;
    if (ждёт) включить(ждёт);
    g.requestAnimationFrame(кадр);
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", поднять);
  else поднять();
})();
