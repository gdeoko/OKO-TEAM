/* СЦЕНА ТЕМЫ «РАКЕТА»: НОЧНОЙ СТАРТ, ФАКЕЛ СТЕКАЕТ К СПИСКУ

   Концепт владельца (концепты/ракета-1-ночной-старт.jpg): ракета стоит
   вертикально справа вверху, между знаком и короной шапки, из сопел бьёт
   белый огонь, ниже он сливается в широкий янтарный столб, столб
   клубится светящимся дымом, течёт вниз по правой стороне за стеклянными
   карточками и у списка серверов сужается в струю искр по столбцу
   пингов. Слово владельца: «анимации идут от элемента фона». Элемент
   здесь - сопла: след замера не рождается у списка, он вытекает из
   двигателя.

   ── ПОЧЕМУ КАМЕРА ОРТОГОНАЛЬНАЯ ─────────────────────────────────────
   Одна единица мира равна одной css-точке экрана: x вправо, y вниз со
   знаком минус. Композиция строится от якорей интерфейса, и «факел входит
   в ось пингов» в такой камере это просто одинаковый x на любом экране.
   Ракета при этом объёмная: тело вращения, металл с картой окружения,
   луна сверху слева, жар факела снизу.

   ── ИЗ ЧЕГО СОБРАН КАДР (снизу вверх) ───────────────────────────────
     подложка   облака-ночь.webp: звёзды неподвижны, море облаков под
                горизонтом медленно уходит вниз (ракета поднимается), и
                никогда не едет обратно. Облака греет факел: тёплые
                пиксели снимка дышат вместе с пламенем, под концом факела
                стоит отсвет.
     звёзды     полторы сотни мерцающих точек поверх снимка.
     дым        широкая лента вдоль пути факела, клубы со светотенью и
                горячей кромкой со стороны огня, тлеющий цвет до самого
                списка.
     огонь      лента уже, аддитивная, шкала температуры: белое ядро ярче
                единицы (из него движок делает свечение), жёлтое,
                оранжевое, тёмно-красное. Остывает по длине плавно, а не
                в первых пятнадцати процентах.
     струи      пять коротких струй из сопел, сливаются в общий факел.
     ракета     центральная ступень и четыре ускорителя, текстуры
                корпуса рисуются кодом.
     искры      тысяча шестьсот точек на видеокарте, позиция каждой -
                функция времени, поэтому замороженный кадр повторяется.

   ШЕЙДЕРЫ ТОЛЬКО ЛАТИНИЦЕЙ: GLSL не принимает кириллицу даже в
   комментариях. Пояснения к ним здесь, в JavaScript. */

(function () {
  "use strict";

  МИР.сцена("ракета", function (о) {
    var T = о.THREE;
    var я = о.якоря;

    var сцена = new T.Scene();
    var камера = new T.OrthographicCamera(0, 430, 0, -932, -3000, 3000);
    камера.position.set(0, 0, 1000);

    var всё = [];          /* что освободить в уничтожить() */
    var жива = true;
    function держать(x) { всё.push(x); return x; }

    /* Детерминированный случай: звёзды и искры одни и те же при каждом
       открытии, раскадровка не зависит от удачи. */
    var зерно = 1234567;
    function случ() { зерно = (зерно * 1664525 + 1013904223) % 4294967296; return зерно / 4294967296; }
    function гладко(а, б, x) { var k = Math.min(1, Math.max(0, (x - а) / (б - а))); return k * k * (3 - 2 * k); }

    /* Слабый телефон (движок снизил внутреннее разрешение) получает три
       октавы шума вместо четырёх: огонь чуть проще, кадр на треть дешевле. */
    function октав() { var м = МИР.масштаб ? МИР.масштаб() : 1; return (м < .99 || я.dpr < 1.5) ? 3 : 4; }

    /* Шум для огня и дыма: значение в узлах решётки, плавная склейка,
       октавы с поворотом и сдвигом (без поворота октавы ложатся сеткой).
       Хэш без sin: на мобильных видеокартах sin от больших чисел даёт
       полосы. Число октав - униформа с break: цикл в GLSL ES 1.0 обязан
       иметь постоянную границу, выход раньше разрешён. */
    var ШУМ = [
      "uniform float uOct;",
      "float hash(vec2 p){ vec3 p3 = fract(vec3(p.xyx) * .1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }",
      "float noise(vec2 p){ vec2 i = floor(p), f = fract(p); vec2 u = f*f*(3.0-2.0*f);",
      "  return mix(mix(hash(i), hash(i+vec2(1.0,0.0)), u.x), mix(hash(i+vec2(0.0,1.0)), hash(i+vec2(1.0,1.0)), u.x), u.y); }",
      "float fbm(vec2 p){ float s = 0.0, a = .5; for (int i = 0; i < 4; i++){ if (float(i) >= uOct) break; s += a*noise(p); p = mat2(1.6, 1.2, -1.2, 1.6)*p + vec2(7.3, 3.1); a *= .5; } return s + a*.5; }",
      "float fbm3(vec2 p){ float s = 0.0, a = .5; for (int i = 0; i < 3; i++){ s += a*noise(p); p = mat2(1.6, 1.2, -1.2, 1.6)*p + vec2(7.3, 3.1); a *= .5; } return s + a*.5; }"
    ].join("\n");

    /* Боковое колыхание факела. Одна и та же функция в лентах и в
       искрах, иначе искры отстанут от огня. Нулевое у сопел (огонь
       вылетает ровно из двигателя) и у входа в список (след попадает
       точно в ось пингов). */
    var КОЛЫХАНИЕ = [
      "float sway(float s, float t){ float sc = clamp(s, 0.0, 1.0);",
      "  return (sin(sc*8.0 - t*1.1 + 1.0)*.6 + sin(sc*15.0 - t*1.9 + 4.0)*.4) * 9.0 * sin(3.14159*sc) * smoothstep(.04, .3, sc); }"
    ].join("\n");

    /* Вершинный шейдер лент: поперёк (-1..1), вдоль в точках, доля пути,
       полуширина в точках - из атрибутов раскладки; x и y экрана уходят
       во фрагментный шейдер, чтобы приглушать огонь за списком. */
    var ВЕРШИНА_ЛЕНТЫ = [
      "attribute vec2 aA; attribute float aS; attribute float aW;",
      "uniform float uTime;",
      "varying vec2 vA; varying float vS; varying float vW; varying float vY; varying float vX;",
      КОЛЫХАНИЕ,
      "void main(){ vec3 p = position; p.x += sway(aS, uTime);",
      "  vA = aA; vS = aS; vW = aW; vY = -p.y; vX = p.x;",
      "  gl_Position = projectionMatrix*modelViewMatrix*vec4(p,1.0); }"
    ].join("\n");

    /* ── ПОДЛОЖКА ─────────────────────────────────────────────────────
       Звёзды выше горизонта стоят. Облака ниже горизонта уходят вниз:
       камера, поднимаясь, видит, как море облаков опускается от
       горизонта. В перспективе это растяжение по вертикали от линии
       горизонта (по горизонтали точки не двигаются), поэтому выборка
       берётся по d/z, где d - расстояние до горизонта, z растёт. Цикл
       из двух копий со сдвигом в полфазы и треугольными весами: одна
       копия растёт, вторая сменяет её, пока первая невидима. Направление
       не меняется никогда, края снимка не видны: выборка всегда внутри.
       Сдвиг за цикл мал (у низа экрана около 13 точек за 20 секунд), и
       двоения на мягких краях облаков глаз не находит.

       Горизонт снимка горел клином на правом краю, как восход. Полоса
       горизонта приглушена, правый край сильнее; вместо него облака
       освещает отсвет под концом факела, и он дышит с тягой. Под списком
       снимок глубже - там белый текст. На ударе правая половина облаков
       вспыхивает. */
    var подложкаМат = держать(new T.ShaderMaterial({
      uniforms: {
        tMap: { value: null }, uHave: { value: 0 }, uTime: { value: 0 },
        uHorV: { value: .425 }, uHorY: { value: 540 }, uW: { value: 430 },
        uWarm: { value: 1 }, uStrike: { value: 0 }, uListY: { value: 424 },
        uGlowC: { value: new T.Vector2(365, 484) }, uGlowK: { value: .5 }, uGlowR: { value: 110 }
      },
      vertexShader: "varying vec2 vUv; varying vec2 vP; void main(){ vUv = uv; vec4 w = modelMatrix*vec4(position,1.0); vP = vec2(w.x, -w.y); gl_Position = projectionMatrix*viewMatrix*w; }",
      fragmentShader: [
        "precision highp float;",
        "uniform sampler2D tMap; uniform float uHave, uTime, uHorV, uHorY, uW, uWarm, uStrike, uListY, uGlowK, uGlowR; uniform vec2 uGlowC;",
        "varying vec2 vUv; varying vec2 vP;",
        "void main(){",
        "  vec2 uv = vUv;",
        "  float d = max(uHorV - uv.y, 0.0);",
        "  float ph1 = fract(uTime / 20.0), ph2 = fract(ph1 + .5);",
        "  float w1 = 1.0 - abs(2.0*ph1 - 1.0);",
        "  vec2 u1 = vec2(uv.x, uHorV - d / (1.0 + .03*ph1));",
        "  vec2 u2 = vec2(uv.x, uHorV - d / (1.0 + .03*ph2));",
        "  vec3 c = uv.y >= uHorV ? texture2D(tMap, uv).rgb : texture2D(tMap, u1).rgb*w1 + texture2D(tMap, u2).rgb*(1.0 - w1);",
        "  c *= uHave * .82;",
        "  float sx = vP.x / uW;",
        "  float band = smoothstep(uHorY - 70.0, uHorY - 20.0, vP.y) * (1.0 - smoothstep(uHorY + 15.0, uHorY + 60.0, vP.y));",
        "  c *= 1.0 - band*(.3 + .45*smoothstep(.55, 1.0, sx));",
        "  float under = smoothstep(uListY - 40.0, uListY + 40.0, vP.y);",
        "  float edge = max(1.0 - smoothstep(.02, .07, sx), smoothstep(.93, .98, sx));",
        "  float rows = under * (1.0 - edge);",
        "  c *= mix(1.0, mix(.36, .8, edge), under) * (1.0 - .3*rows*smoothstep(.45, .85, sx));",
        "  c = mix(c, vec3(dot(c, vec3(.3, .55, .15))), .4*rows);",
        "  float warm = clamp((c.r - c.b) * 2.2, 0.0, 1.0);",
        "  float flick = .94 + .06*sin(uTime*17.0)*sin(uTime*6.1 + 1.3);",
        "  float gain = (uWarm*flick - 1.0)*.9 + uStrike*.8*smoothstep(.35, .7, sx);",
        "  c *= 1.0 + warm*gain*(1.0 - .5*under);",
        "  vec2 g = (vP - uGlowC) / vec2(uGlowR*1.5, uGlowR);",
        "  float cloud = smoothstep(uHorY - 10.0, uHorY + 30.0, vP.y);",
        "  c *= 1.0 + vec3(1.0, .5, .2) * uGlowK * exp(-dot(g, g)) * cloud * (1.0 - .7*rows);",
        "  gl_FragColor = vec4(c, 1.0);",
        "}"
      ].join("\n"),
      depthWrite: false, depthTest: false
    }));
    var подложка = new T.Mesh(держать(new T.PlaneGeometry(1, 1)), подложкаМат);
    подложка.renderOrder = -10; подложка.frustumCulled = false;
    сцена.add(подложка);
    var пропорцияПодложки = 2160 / 3840;
    var ГОРИЗОНТ = .575;        /* линия горизонта снимка, доля высоты сверху */
    /* Снимок по плотности экрана: 4K нужен только телефону с dpr 3, на
       обычном dpr 2 он лишь тратит сорок мегабайт видеопамяти. */
    var файлПодложки = (я.высота * я.dpr > 2100) ? "облака-ночь.webp" : "облака-ночь-1440.webp";
    о.загрузить("ассеты/мир/ракета/" + файлПодложки).then(function (т) {
      if (!жива) { т.dispose(); return; }
      держать(т);
      подложкаМат.uniforms.tMap.value = т;
      подложкаМат.uniforms.uHave.value = 1;
    }).catch(function () {});

    /* ── МЕРЦАЮЩИЕ ЗВЁЗДЫ ────────────────────────────────────────────── */
    var ЗВЁЗД = 150;
    var звГеом = держать(new T.BufferGeometry());
    var звПоз = new Float32Array(ЗВЁЗД * 3), звСид = new Float32Array(ЗВЁЗД);
    for (var i = 0; i < ЗВЁЗД; i++) {
      звПоз[i*3] = случ(); звПоз[i*3+1] = Math.pow(случ(), 1.3) * .5; звПоз[i*3+2] = 0;
      звСид[i] = случ();
    }
    звГеом.setAttribute("position", new T.BufferAttribute(звПоз, 3));
    звГеом.setAttribute("seed", new T.BufferAttribute(звСид, 1));
    var звМат = держать(new T.ShaderMaterial({
      uniforms: { uTime: { value: 0 }, uSize: { value: new T.Vector2(430, 932) }, uPx: { value: 2 } },
      vertexShader: [
        "attribute float seed; uniform float uTime, uPx; uniform vec2 uSize; varying float vA;",
        "void main(){",
        "  vec3 p = vec3(position.x*uSize.x, -position.y*uSize.y, -1200.0);",
        "  float tw = .5 + .5*sin(uTime*(.8 + seed*2.2) + seed*40.0);",
        "  vA = (.25 + .75*fract(seed*91.7)) * (.35 + .65*tw*tw);",
        "  gl_PointSize = (1.0 + 1.4*fract(seed*37.1)) * uPx;",
        "  gl_Position = projectionMatrix*modelViewMatrix*vec4(p, 1.0);",
        "}"
      ].join("\n"),
      fragmentShader: [
        "varying float vA;",
        "void main(){ vec2 d = gl_PointCoord - .5; float a = 1.0 - smoothstep(.15, .5, length(d));",
        "  gl_FragColor = vec4(vec3(.8, .88, 1.0) * a * vA * .9, 1.0); }"
      ].join("\n"),
      blending: T.AdditiveBlending, transparent: true, depthWrite: false, depthTest: false
    }));
    var звёзды = new T.Points(звГеом, звМат);
    звёзды.frustumCulled = false; звёзды.renderOrder = -9;
    сцена.add(звёзды);

    /* ── ТЕКСТУРЫ КОРПУСА, НАРИСОВАННЫЕ КОДОМ ─────────────────────────
       Металл «настоящий» не из-за формы, а из-за мелочей: швы панелей,
       шлифовка вдоль корпуса, смена материала белая краска - титан,
       тёмный пояс между ступенями, копоть и цвета побежалости у
       двигателей (металл у сопел темнеет и отливает бронзой и синевой).
       Две карты: цвет и шероховатость/металличность (three.js берёт
       шероховатость из зелёного, металл из синего канала). Полосы
       задаются долями высоты снизу вверх. */
    function холстКорпуса(полосы, швы, копоть) {
      var Ш = 256, В = 1024;
      var цв = document.createElement("canvas"); цв.width = Ш; цв.height = В;
      var рм = document.createElement("canvas"); рм.width = Ш; рм.height = В;
      var к = цв.getContext("2d"), м = рм.getContext("2d");
      полосы.forEach(function (п) {
        var y0 = В - п[1] * В, y1 = В - п[0] * В;
        к.fillStyle = п[2]; к.fillRect(0, y0, Ш, y1 - y0);
        м.fillStyle = "rgb(0," + Math.round(п[3] * 255) + "," + Math.round(п[4] * 255) + ")";
        м.fillRect(0, y0, Ш, y1 - y0);
      });
      /* шлифовка: тонкие продольные штрихи разной яркости и гладкости */
      for (var i = 0; i < 900; i++) {
        var x = случ() * Ш, y = случ() * В, дл = 40 + случ() * 260;
        var с = случ() < .5 ? 255 : 0;
        к.fillStyle = "rgba(" + с + "," + с + "," + с + "," + (.025 + случ() * .04) + ")";
        к.fillRect(x, y, 1, дл);
        м.fillStyle = "rgba(0," + (случ() < .5 ? 110 : 40) + ",0," + (.10 + случ() * .12) + ")";
        м.fillRect(x, y, 1, дл);
      }
      /* копоть снизу: плотная у среза, рваными языками вверх */
      var yК = В - копоть * В;
      var гр = к.createLinearGradient(0, В, 0, yК);
      гр.addColorStop(0, "rgba(14,10,8,.92)"); гр.addColorStop(.35, "rgba(40,26,18,.55)");
      гр.addColorStop(.7, "rgba(90,70,60,.18)"); гр.addColorStop(1, "rgba(0,0,0,0)");
      к.fillStyle = гр; к.fillRect(0, yК, Ш, В - yК);
      for (var j2 = 0; j2 < 70; j2++) {
        var xх = случ() * Ш, вх = (.3 + случ() * .9) * (В - yК);
        к.fillStyle = "rgba(20,14,10," + (.06 + случ() * .12) + ")";
        к.fillRect(xх, В - вх, 2 + случ() * 6, вх);
      }
      /* побежалость: бронза и синева узкими поясами над копотью */
      к.fillStyle = "rgba(170,110,50,.16)"; к.fillRect(0, В - копоть * В * 1.25, Ш, копоть * В * .25);
      к.fillStyle = "rgba(70,80,170,.12)"; к.fillRect(0, В - копоть * В * 1.45, Ш, копоть * В * .2);
      м.fillStyle = "rgba(0,200,60,.6)"; м.fillRect(0, yК, Ш, В - yК);
      /* швы панелей: кольцевые и продольные, тёмные с бликом снизу */
      швы.forEach(function (д) {
        var y = В - д * В;
        к.fillStyle = "rgba(10,12,18,.55)"; к.fillRect(0, y, Ш, 2);
        к.fillStyle = "rgba(255,255,255,.16)"; к.fillRect(0, y + 2, Ш, 1);
      });
      for (var j = 0; j < 8; j++) {
        к.fillStyle = "rgba(10,12,18,.28)"; к.fillRect(j * Ш / 8, 0, 1, В);
      }
      var тц = new T.CanvasTexture(цв); тц.colorSpace = T.SRGBColorSpace;
      var тм = new T.CanvasTexture(рм);
      [тц, тм].forEach(function (т) {
        т.wrapS = T.RepeatWrapping; т.anisotropy = 4;
        держать(т);
      });
      return { цвет: тц, рм: тм };
    }

    /* Ядро, доли высоты 17 единиц: низ двигательный отсек, титановый
       бак, тёмный межступенчатый пояс, белая верхняя ступень с полосой
       бренда, белый обтекатель с тёмным наконечником. Полоса вдвое
       шире прежней: в тридцать точек корпуса тонкая полоса терялась. */
    var тЯдро = холстКорпуса([
      [0.00, 0.05, "#3b404a", .45, .85],
      [0.05, 0.54, "#a3abb8", .28, .95],
      [0.54, 0.575, "#1d2129", .5, .7],
      [0.575, 0.80, "#e4e7ec", .36, .05],
      [0.72, 0.755, "#5b5bf0", .30, .2],
      [0.80, 0.985, "#eceef2", .30, .05],
      [0.985, 1.00, "#2a2e36", .35, .8]
    ], [.12, .19, .26, .33, .40, .47, .62, .69, .80, .86, .92], .16);
    /* Ускоритель, доли высоты 7.4 единицы: светлый титан, полоса бренда,
       пояс, белый нос. Прежний тёмный металл отражал ночное небо и
       читался чёрной палкой. */
    var тБок = холстКорпуса([
      [0.00, 0.06, "#3b404a", .45, .85],
      [0.06, 0.80, "#b9c1cd", .32, .9],
      [0.66, 0.70, "#5b5bf0", .30, .2],
      [0.80, 0.83, "#20242c", .5, .7],
      [0.83, 1.00, "#e6e8ed", .32, .05]
    ], [.20, .34, .48, .62, .90], .22);

    /* Карта окружения: маленькая сцена-градиент. Снизу оранжевая от
       пламени, сверху ночь. Три вертикальные световые полосы, как
       софтбоксы в студии: белая чуть левее камеры (чёткая продольная
       линия блика на цилиндре, по ней глаз узнаёт полированный металл),
       холодная слева (луна), тёплая справа (отсвет облаков). */
    var окружение = (function () {
      var ос = new T.Scene();
      var гс = new T.SphereGeometry(10, 64, 32);
      var мс = new T.ShaderMaterial({
        side: T.BackSide,
        vertexShader: "varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.0); }",
        fragmentShader: [
          "varying vec3 vP;",
          "void main(){",
          "  float y = vP.y; float az = atan(vP.x, vP.z);",
          "  vec3 night = mix(vec3(.02,.025,.05), vec3(.05,.07,.15), smoothstep(-.1, .9, y));",
          "  vec3 fire = vec3(2.4, .9, .25) * smoothstep(-.45, -.95, y);",
          "  float vert = smoothstep(-.5, .2, y) * (1.0 - smoothstep(.75, .95, y));",
          "  float sa = az + .42; float soft = exp(-sa*sa*90.0) * vert;",
          "  float ca = az + 1.15; float cool = exp(-ca*ca*22.0) * vert;",
          "  float wa = az - 1.25; float warmS = exp(-wa*wa*14.0) * smoothstep(-.6, .1, y) * (1.0 - smoothstep(.4, .8, y));",
          "  float moon = pow(max(dot(vP, normalize(vec3(-.6, .6, .5))), 0.0), 60.0) * 6.0;",
          "  gl_FragColor = vec4(night + fire + vec3(1.0)*soft*7.0 + vec3(.7,.8,1.0)*(cool*3.5 + moon) + vec3(1.0,.5,.2)*warmS*2.2, 1.0);",
          "}"
        ].join("\n")
      });
      ос.add(new T.Mesh(гс, мс));
      var пм = new T.PMREMGenerator(о.рендерер);
      var ц = пм.fromScene(ос, 0.0);
      гс.dispose(); мс.dispose(); пм.dispose();
      return ц;
    })();
    держать(окружение);
    var карта = окружение.texture;

    /* Белая краска под лаком: clearcoat даёт второй, резкий блик поверх
       матовой краски - так выглядит настоящий окрашенный корпус. */
    var металлЯдра = держать(new T.MeshPhysicalMaterial({
      map: тЯдро.цвет, roughnessMap: тЯдро.рм, metalnessMap: тЯдро.рм,
      roughness: 1, metalness: 1, envMap: карта, envMapIntensity: 1.6,
      clearcoat: .6, clearcoatRoughness: .12
    }));
    var металлБока = держать(new T.MeshPhysicalMaterial({
      map: тБок.цвет, roughnessMap: тБок.рм, metalnessMap: тБок.рм,
      roughness: 1, metalness: 1, envMap: карта, envMapIntensity: 1.7,
      clearcoat: .5, clearcoatRoughness: .15
    }));
    var тёмный = держать(new T.MeshStandardMaterial({
      color: 0x2a2e36, metalness: .85, roughness: .35, envMap: карта, envMapIntensity: 1.3
    }));
    /* Раскалённый край сопла: карта свечения по длине колокола, у среза
       оранжево-красный, у горловины тёмный металл. */
    var жарКолокола = (function () {
      var х = document.createElement("canvas"); х.width = 4; х.height = 64;
      var к = х.getContext("2d");
      var г = к.createLinearGradient(0, 0, 0, 64);
      г.addColorStop(0, "#ffb070"); г.addColorStop(.12, "#c0400c"); г.addColorStop(.4, "#300800"); г.addColorStop(1, "#000000");
      к.fillStyle = г; к.fillRect(0, 0, 4, 64);
      var т = new T.CanvasTexture(х); т.colorSpace = T.SRGBColorSpace;
      return держать(т);
    })();
    var сопло = держать(new T.MeshStandardMaterial({
      color: 0x2c313b, metalness: .9, roughness: .3, envMap: карта, envMapIntensity: 1.4,
      emissive: 0xffffff, emissiveMap: жарКолокола, emissiveIntensity: .6, side: T.DoubleSide
    }));

    function профиль(точки) { return точки.map(function (p) { return new T.Vector2(p[0], p[1]); }); }
    /* Касательная огива: так выглядят обтекатели настоящих ракет, конус
       читался бы карандашом. Точки сверху вниз. */
    function огива(R, y0, Ln, шагов) {
      var ρ = (R * R + Ln * Ln) / (2 * R), т = [];
      for (var k = шагов; k >= 0; k--) {
        var у = Ln * k / шагов;
        т.push([Math.max(0, Math.sqrt(Math.max(0, ρ * ρ - у * у)) + R - ρ), y0 + у]);
      }
      return т;
    }
    /* uv.y по настоящей высоте, а не по номеру точки профиля: иначе
       полосы и швы съезжают на огиве, где точек густо. */
    function токарная(точки, сегм, высота) {
      var г = new T.LatheGeometry(профиль(точки), сегм);
      var п = г.attributes.position, у = г.attributes.uv;
      for (var i = 0; i < п.count; i++) у.setY(i, Math.min(1, Math.max(0, п.getY(i) / высота)));
      у.needsUpdate = true;
      return держать(г);
    }

    var ВЫСОТА = 17.0, ВЫСОТА_БОКА = 7.4, СРЕЗ = .95;   /* в радиусах ядра */
    var КОЛ_ЯДРА = 1.05, КОЛ_БОКА = .66, ПОДЪЁМ_БОКА = .15;
    var геомЯдро = токарная(огива(1, 13.6, 3.4, 16).concat([
      [1.0, 13.55], [1.0, 0.55], [1.06, 0.46], [1.06, 0.12], [0.82, 0.0], [0.3, 0.0]
    ]), 64, ВЫСОТА);
    var РБ = .62;
    var геомБок = токарная(огива(РБ, 6.15, 1.25, 12).concat([
      [РБ, 6.1], [РБ, 0.40], [РБ + .04, 0.32], [РБ + .04, 0.08], [.48, 0.0], [.2, 0.0]
    ]), 40, ВЫСОТА_БОКА);
    var геомКолокол = держать(new T.LatheGeometry(профиль([
      [0.30, 0.02], [0.33, -0.10], [0.46, -0.38], [0.60, -0.66], [0.70, -0.86], [0.72, -СРЕЗ]
    ]), 32));
    var геомКольцо = держать(new T.CylinderGeometry(1.035, 1.035, .38, 64, 1, true));
    var геомСтойка = держать(new T.BoxGeometry(.5, .09, .09));
    var геомРешётка = держать(new T.BoxGeometry(.42, .34, .035));
    var геомОпора = держать(new T.BoxGeometry(.07, 2.3, .07));

    /* РАКЕТА РИСУЕТСЯ ОТДЕЛЬНО, С ЧЕСТНЫМ СГЛАЖИВАНИЕМ. Движок рисует
       мир в буфер без сглаживания, и тонкий корпус выходил лесенкой.
       Ракета отрисовывается в свой маленький буфер ровно по её рамке:
       вдвое плотнее экрана и с четырёхкратным MSAA, а в мир ложится
       готовым листом с альфой. Проход идёт через кадр: мерцание жара на
       корпусе еле заметно, а цена прохода вдвое меньше. На ударе и при
       смене раскладки - каждый кадр. */
    var сценаРакеты = new T.Scene();
    var камераРакеты = new T.OrthographicCamera(0, 1, 0, -1, -3000, 3000);
    камераРакеты.position.set(0, 0, 1000);
    var ракета = new T.Group();
    var корпус = new T.Group();
    ракета.add(корпус);
    сценаРакеты.add(ракета);
    var цельРакеты = null;
    var гл2 = !!о.рендерер.capabilities.isWebGL2;
    var листМат = держать(new T.ShaderMaterial({
      uniforms: { tMap: { value: null } },
      vertexShader: "varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.0); }",
      fragmentShader: "uniform sampler2D tMap; varying vec2 vUv; void main(){ gl_FragColor = texture2D(tMap, vUv); }",
      transparent: true, depthWrite: false, depthTest: false,
      blending: T.CustomBlending, blendSrc: T.OneFactor, blendDst: T.OneMinusSrcAlphaFactor,
      blendSrcAlpha: T.OneFactor, blendDstAlpha: T.OneMinusSrcAlphaFactor
    }));
    var лист = new T.Mesh(держать(new T.PlaneGeometry(1, 1)), листМат);
    лист.renderOrder = 3; лист.frustumCulled = false;
    сцена.add(лист);
    var цветОчистки = new T.Color();

    корпус.add(new T.Mesh(геомЯдро, металлЯдра));
    var пояс = new T.Mesh(геомКольцо, тёмный); пояс.position.y = 9.45; корпус.add(пояс);
    var колЯдра = new T.Mesh(геомКолокол, сопло); колЯдра.scale.setScalar(КОЛ_ЯДРА); корпус.add(колЯдра);

    /* Четыре ускорителя крестом. Поворот корпуса раскладывает их по
       экрану на четыре разных x: два по краям, один перед ядром и один за
       ним - объём читается сразу, как на концепте. */
    var ПОВОРОТ = .35, РАССТ = 1 + РБ + .03;
    var уголки = [0, Math.PI / 2, Math.PI, Math.PI * 1.5];
    уголки.forEach(function (θ) {
      var гр = new T.Group();
      гр.position.set(Math.cos(θ) * РАССТ, ПОДЪЁМ_БОКА, Math.sin(θ) * РАССТ);
      гр.add(new T.Mesh(геомБок, металлБока));
      var кл = new T.Mesh(геомКолокол, сопло); кл.scale.setScalar(КОЛ_БОКА); гр.add(кл);
      var оп = new T.Mesh(геомОпора, тёмный);
      оп.position.set(Math.cos(θ) * (РБ + .03), 1.6, Math.sin(θ) * (РБ + .03));
      гр.add(оп);
      корпус.add(гр);
      [1.0, 5.7].forEach(function (у) {
        var ст = new T.Mesh(геомСтойка, тёмный);
        ст.position.set(Math.cos(θ) * (РАССТ * .6), у, Math.sin(θ) * (РАССТ * .6));
        ст.rotation.y = -θ;
        корпус.add(ст);
      });
      var ф = θ + Math.PI / 4;
      var рш = new T.Mesh(геомРешётка, тёмный);
      рш.position.set(Math.cos(ф) * 1.2, 9.0, Math.sin(ф) * 1.2);
      рш.rotation.y = -ф + Math.PI / 2;
      корпус.add(рш);
    });
    корпус.rotation.y = ПОВОРОТ;

    var луна = new T.DirectionalLight(0xb4c4ff, 2.0);
    луна.position.set(-1.4, .9, .8);
    сценаРакеты.add(луна);
    /* контровой холодный свет слева сзади: светлая кромка по левому
       краю корпуса отделяет ракету от ночного неба */
    var контр = new T.DirectionalLight(0x9fb4ff, 2.2);
    контр.position.set(-1.4, .3, -1.0);
    сценаРакеты.add(контр);
    var небо = new T.HemisphereLight(0x2a3868, 0x5a2a0e, .28);
    сценаРакеты.add(небо);
    var жар = new T.PointLight(0xff7a2e, 0, 0, 0);
    сценаРакеты.add(жар);
    /* заливка снизу: факел освещает юбки ускорителей и низ ступени */
    var снизу = new T.DirectionalLight(0xff8f45, 1.2);
    снизу.position.set(.2, -1, .6);
    сценаРакеты.add(снизу);

    /* ── ЛЕНТЫ ФАКЕЛА ─────────────────────────────────────────────────
       Путь: кубическая кривая от сопел до входа в столбец пингов, и
       короткий хвост в столбец (до восьми процентов длины). Дальше огонь
       несут искры. Касательные на концах вертикальные: пламя вырывается
       из сопел вниз и входит в столбец вниз, без излома.

       Лента пересобирается только при смене якорей. Массивы выделены один
       раз: в кадре ничего не создаётся. Форма огня живёт в шейдере. */
    var КУСКОВ = 150;
    var ДОЛЯ_ХВОСТА = .08;
    function новаяЛента() {
      var г = new T.BufferGeometry();
      var n = (КУСКОВ + 1) * 2;
      г.setAttribute("position", new T.BufferAttribute(new Float32Array(n * 3), 3));
      г.setAttribute("aA", new T.BufferAttribute(new Float32Array(n * 2), 2));
      г.setAttribute("aS", new T.BufferAttribute(new Float32Array(n), 1));
      г.setAttribute("aW", new T.BufferAttribute(new Float32Array(n), 1));
      var инд = [];
      for (var i = 0; i < КУСКОВ; i++) { var а = i * 2; инд.push(а, а + 2, а + 1, а + 1, а + 2, а + 3); }
      г.setIndex(инд);
      return держать(г);
    }
    var путьX = new Float32Array(КУСКОВ + 1), путьY = new Float32Array(КУСКОВ + 1);
    var путьS = new Float32Array(КУСКОВ + 1), путьL = new Float32Array(КУСКОВ + 1);

    /* Огонь (аддитивный).
       Прежний огонь остывал в первых пятнадцати процентах пути, и ниже
       висела тёмная верёвка дыма. Теперь температура падает по длине как
       exp(-s/0.45): у сопел белое, у карточек янтарь, у списка тлеющий
       красный, и нигде не гаснет в ноль.
       Шум: доменное искажение fbm, и искажение меняется вдоль пути (сдвиг
       зерна от s), поэтому узор не повторяется витками, как у прежней
       «карамельной» верёвки. Масштаб шума растёт как (1+2s): клубы
       расширяются по мере удаления от сопла, а не едут по картинке.
       Вторая, крупная октава (billow) лепит из факела кучевой объём.
       Белое ядро у сопел объединяет струи в один факел (мягкое
       объединение: пять струй тонут в общем ядре за три десятка точек).
       За списком огонь гасится везде, кроме узкой полосы по оси пингов,
       и яркость там ограничена: белый текст строк читается. */
    var огоньМат = держать(new T.ShaderMaterial({
      uniforms: {
        uTime: { value: 0 }, uBoost: { value: 1 }, uReach: { value: 1 }, uOct: { value: 4 },
        uCardY: { value: 230 }, uListY: { value: 424 }, uAxis: { value: 365 }, uLen: { value: 300 }
      },
      vertexShader: ВЕРШИНА_ЛЕНТЫ,
      fragmentShader: [
        "precision highp float;",
        "uniform float uTime, uBoost, uReach, uCardY, uListY, uAxis, uLen;",
        "varying vec2 vA; varying float vS; varying float vW; varying float vY; varying float vX;",
        ШУМ,
        "void main(){",
        "  float s = vS, x = vA.x, sc = min(s, 1.0);",
        "  float grow = 1.0 + 1.4*sc;",
        "  vec2 p = vec2(x*vW/grow, .5*uLen*log(1.0 + 2.0*vA.y/uLen));",
        "  vec2 wq = vec2(p.x, p.y - uTime*70.0) / 34.0 + vec2(s*2.3, 0.0);",
        "  vec2 warp = vec2(fbm3(wq), fbm3(wq + vec2(5.2, 1.3 - s*1.7))) - .5;",
        "  vec2 q = vec2(p.x, p.y - uTime*150.0) / 15.0 + vec2(0.0, s*3.7);",
        "  float n = fbm(q + warp*2.2);",
        "  float bl = fbm3(vec2(p.x, p.y - uTime*55.0) / 60.0 + vec2(11.0, s*1.3));",
"  float prof = 1.0 - x*x;",
        "  float dens = smoothstep(.22, .8, prof*1.1 + (n - .5)*1.5 + (bl - .5)*1.2);",
        "  float Ls = .45*uReach;",
        "  float Tm = exp(-sc/Ls);",
        "  float T = Tm * (.25 + 1.5*n*n) * (.3 + .7*prof);",
        "  T += exp(-x*x*9.0) * exp(-s/(.075*uReach)) * .95;",
        "  T += exp(-x*x*8.0) * smoothstep(.72, 1.0, s) * (1.0 - smoothstep(1.0, 1.08, s)) * .22;",
        "  T = max(T, .12*prof);",
        "  vec3 c = vec3(.34, .08, .018);",
        "  c = mix(c, vec3(.85, .2, .03), smoothstep(.12, .30, T));",
        "  c = mix(c, vec3(1.5, .5, .08), smoothstep(.30, .52, T));",
        "  c = mix(c, vec3(2.8, 1.45, .4), smoothstep(.55, .8, T));",
        "  c = mix(c, vec3(6.5, 5.4, 4.0), smoothstep(.82, 1.08, T));",
        "  c *= dens * (.5 + .5*uBoost);",
        "  c *= (1.0 - smoothstep(.97, 1.08, s)) * smoothstep(.0, .05, s);",
        "  c *= 1.0 - smoothstep(.85, 1.0, abs(x));",
        "  float card = smoothstep(uCardY - 30.0, uCardY + 20.0, vY);",
        "  c = min(c, vec3(mix(9.0, 2.2, card)));",
        "  float inL = smoothstep(uListY - 34.0, uListY + 2.0, vY);",
        "  float axis = 1.0 - smoothstep(6.0, 12.0, abs(vX - uAxis));",
        "  c *= mix(1.0, mix(.25, 1.0, axis), inL);",
        "  c = min(c, vec3(mix(9.0, 1.3, inL)));",
        "  gl_FragColor = vec4(c, 1.0);",
        "}"
      ].join("\n"),
      blending: T.AdditiveBlending, transparent: true, depthWrite: false, depthTest: false, side: T.DoubleSide
    }));

    /* Дым (обычное смешивание).
       Клубы - шум крупнее и медленнее огня: дым тяжелее пламени. Объём
       даёт светотень: плотность меряется второй раз со сдвигом к оси
       факела и к соплам, разница - сторона клуба, обращённая к огню. Она
       горит кромкой, середина плотного клуба темнее (самозатенение).
       Цвет не опускается ниже тлеющего уголька (0.35, 0.12, 0.04): так
       дым везде читается частью огня, а не серой трубой на горизонте.
       Над списком дым сходится в узкий поток, в списке гаснет. */
    var дымМат = держать(new T.ShaderMaterial({
      uniforms: {
        uTime: { value: 0 }, uBoost: { value: 1 }, uOct: { value: 4 },
        uCardY: { value: 230 }, uListY: { value: 424 }, uAxis: { value: 365 }, uLen: { value: 300 }
      },
      vertexShader: ВЕРШИНА_ЛЕНТЫ,
      fragmentShader: [
        "precision highp float;",
        "uniform float uTime, uBoost, uCardY, uListY, uAxis, uLen;",
        "varying vec2 vA; varying float vS; varying float vW; varying float vY; varying float vX;",
        ШУМ,
        "void main(){",
        "  float s = vS, x = vA.x, sc = min(s, 1.0);",
        "  float grow = 1.0 + 1.1*sc;",
        "  vec2 p = vec2(x*vW/grow, .5*uLen*log(1.0 + 2.0*vA.y/uLen));",
        "  vec2 wq = vec2(p.x, p.y - uTime*30.0) / 34.0 + vec2(s*1.9, 3.0);",
        "  vec2 warp = vec2(fbm3(wq), fbm3(wq + vec2(8.1, 2.9 + s*1.3))) - .5;",
        "  vec2 q = vec2(p.x, p.y - uTime*62.0) / 15.0 + vec2(1.7, s*2.9);",
        "  vec2 qq = q + warp*2.0;",
        "  float n = fbm(qq);",
        "  float nb = fbm(qq + vec2(-x*.28, -.16));",
        "  float bl = fbm3(vec2(p.x, p.y - uTime*26.0) / 36.0 + vec2(4.0, s*1.1));",
        "  float lit = clamp((n - nb)*5.0 + .5, 0.0, 1.0);",
        "  float xw = x + warp.x*.55 + (bl - .5)*.45;",
        "  float prof = 1.0 - xw*xw;",
        "  float shape = prof*1.15 + (n - .5)*1.9 + (bl - .5)*1.6;",
        "  float densN = smoothstep(.2, .8, shape);",
        "  float env = smoothstep(.0, .06, s) * (1.0 - smoothstep(.96, 1.06, s)) * (1.0 - smoothstep(.6, 1.0, abs(x)));",
        "  float dens = densN * env;",
        "  float core = exp(-x*x*2.2);",
        "  float warmth = exp(-sc/.6);",
        "  float selfSh = smoothstep(.5, .85, n*.6 + bl*.6);",
        "  vec3 ember = vec3(.32, .085, .018) * (.6 + .4*uBoost);",
        "  vec3 c = mix(vec3(.035, .018, .015), ember, clamp(core*(.15 + .75*lit), 0.0, 1.0));",
        "  c *= 1.0 - .5*selfSh*(1.0 - lit);",
        "  c += vec3(1.1, .3, .04) * core * warmth * (.08 + .6*lit) * uBoost;",
        "  float rim = smoothstep(.2, .5, densN) * (1.0 - smoothstep(.55, .9, densN)) * lit * env;",
        "  c += vec3(1.0, .32, .05) * rim * (.3 + .7*warmth);",
"  float card = smoothstep(uCardY - 30.0, uCardY + 20.0, vY);",
        "  c = min(c, vec3(mix(4.0, 1.6, card)));",
        "  float inL = smoothstep(uListY - 34.0, uListY + 2.0, vY);",
        "  float axis = 1.0 - smoothstep(6.0, 12.0, abs(vX - uAxis));",
        "  dens *= mix(1.0, axis, inL);",
        "  gl_FragColor = vec4(c, dens*(.5 + .45*smoothstep(.3, .7, n + .15*bl)));",
        "}"
      ].join("\n"),
      transparent: true, depthWrite: false, depthTest: false, side: T.DoubleSide
    }));

    var геомДыма = новаяЛента(), геомОгня = новаяЛента();
    var дым = new T.Mesh(геомДыма, дымМат); дым.frustumCulled = false; дым.renderOrder = 1;
    var огонь = new T.Mesh(геомОгня, огоньМат); огонь.frustumCulled = false; огонь.renderOrder = 2;
    сцена.add(дым); сцена.add(огонь);

    /* Струи сопел. Плоскость вдоль струи, uv.y = 1 у среза сопла.
       Прежние струи были пятью белыми карандашами с параллельными краями.
       Теперь граница струи расширяется от среза (газ расширяется), ядро
       короткое, с двумя ударными ромбами, и вся струя за три десятка
       точек тонет в общем ядре огня. Длина и яркость у каждой струи своя
       и плавает по своей фазе. Квадрат пишется умножением, а не
       pow(x, 2.0): pow от отрицательного в GLSL не определён. */
    var струяМат = держать(new T.ShaderMaterial({
      uniforms: { uTime: { value: 0 }, uBoost: { value: 1 }, uSeed: { value: 0 }, uDim: { value: 1 }, uOct: { value: 3 } },
      vertexShader: "varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.0); }",
      fragmentShader: [
        "precision highp float;",
        "uniform float uTime, uBoost, uSeed, uDim; varying vec2 vUv;",
        ШУМ,
        "void main(){",
        "  float a = 1.0 - vUv.y, x = vUv.x*2.0 - 1.0;",
        "  float len = .62 + .3*noise(vec2(uTime*3.1 + uSeed, uSeed*1.7)) + .25*(uBoost - 1.0);",
        "  float w = mix(.26, .8, smoothstep(.0, .8, a));",
        "  float dia = pow(max(0.0, sin(a*22.0 + .6)), 8.0) * (1.0 - smoothstep(.05, .35, a));",
        "  float fl = fbm3(vec2(x*3.0 + uSeed, a*6.0 - uTime*9.0));",
        "  float xc = x/(w*.7*(1.0 + .3*dia)); float xs = x/w;",
        "  float core = exp(-xc*xc*3.0) * (1.0 - smoothstep(.05, .45*len, a));",
        "  float shell = exp(-xs*xs*2.0) * smoothstep(1.05, .3, a) * (.6 + .7*fl);",
        "  float lip = smoothstep(.0, .04, a);",
        "  float br = .85 + .3*noise(vec2(uTime*5.3 + uSeed*3.0, 2.0));",
        "  vec3 c = vec3(1.0, .93, .82) * core * (3.8 + 3.0*dia) + vec3(1.0, .58, .2) * shell * 1.7;",
        "  c *= lip * (1.0 - x*x) * uBoost * uDim * br;",
        "  gl_FragColor = vec4(c, 1.0);",
        "}"
      ].join("\n"),
      blending: T.AdditiveBlending, transparent: true, depthWrite: false, depthTest: false
    }));
    var геомСтруи = держать(new T.PlaneGeometry(1, 1));
    var струи = [];
    for (var с5 = 0; с5 < 5; с5++) {
      var мс = держать(струяМат.clone());
      мс.uniforms.uSeed.value = с5 * 3.7 + 1.3;
      var стр = new T.Mesh(геомСтруи, мс);
      стр.renderOrder = 4; стр.frustumCulled = false;
      сцена.add(стр);
      струи.push(стр);
    }

    /* Сияние у сопел и вспышка форсажа. Пятно ярче единицы, из него
       свечение объектива. На ударе первые 0.12 с в центре горит значение
       выше десяти: это та самая вспышка, которую глаз ловит сразу.
       Функция гаснет РОВНО в ноль на краю квадрата (гаусс минус его
       значение на краю), иначе на небе виден прямоугольник. */
    var сияниеМат = держать(new T.ShaderMaterial({
      uniforms: { uTime: { value: 0 }, uBoost: { value: 1 }, uFlash: { value: 0 } },
      vertexShader: "varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.0); }",
      fragmentShader: [
        "uniform float uTime, uBoost, uFlash; varying vec2 vUv;",
        "void main(){ vec2 d = (vUv - .5)*2.0; float r2 = dot(d, d);",
        "  float g = max(exp(-r2*9.0) - exp(-9.0), 0.0)*.3 + max(exp(-r2*2.6) - exp(-2.6), 0.0)*.05;",
        "  float f = .92 + .08*sin(uTime*31.0)*sin(uTime*11.0);",
        "  vec3 c = vec3(1.0, .52, .18) * g * f * uBoost;",
        "  c += vec3(1.0, .86, .62) * max(exp(-r2*22.0) - exp(-22.0), 0.0) * uFlash * 14.0;",
        "  c += vec3(1.0, .55, .2) * max(exp(-r2*4.0) - exp(-4.0), 0.0) * uFlash * 1.2;",
        "  gl_FragColor = vec4(c, 1.0); }"
      ].join("\n"),
      blending: T.AdditiveBlending, transparent: true, depthWrite: false, depthTest: false
    }));
    var сияние = new T.Mesh(держать(new T.PlaneGeometry(1, 1)), сияниеМат);
    сияние.renderOrder = 5; сияние.frustumCulled = false;
    сцена.add(сияние);

    /* Анаморфный штрих вспышки: тонкая горизонтальная полоса через сопла,
       живёт только на ударе. Так снимает вспышку кинообъектив, и именно
       этот штрих отличает кадр «из фильма» от кадра «из игры». */
    var штрихМат = держать(new T.ShaderMaterial({
      uniforms: { uFlash: { value: 0 } },
      vertexShader: "varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.0); }",
      fragmentShader: [
        "uniform float uFlash; varying vec2 vUv;",
        "void main(){ float x = (vUv.x - .5)*2.0, y = (vUv.y - .5)*2.0;",
        "  float h = max(exp(-x*x*5.0) - exp(-5.0), 0.0) * max(exp(-y*y*7.0) - exp(-7.0), 0.0);",
        "  gl_FragColor = vec4(vec3(1.0, .62, .32) * h * uFlash * 2.6, 1.0); }"
      ].join("\n"),
      blending: T.AdditiveBlending, transparent: true, depthWrite: false, depthTest: false
    }));
    var штрих = new T.Mesh(держать(new T.PlaneGeometry(1, 1)), штрихМат);
    штрих.renderOrder = 5; штрих.frustumCulled = false; штрих.visible = false;
    сцена.add(штрих);

    /* ── ИСКРЫ ────────────────────────────────────────────────────────
       Режимы, и каждый - чистая функция времени (возраст = дробная часть
       времени, ни одна искра не копит состояние):
         поток   - искры по всему факелу, клубятся вместе с ним;
         струя   - двести шестьдесят искр в последней трети пути, не
                   дальше шести точек от кривой, сходятся ровно в исток
                   следа (источник()): видимая струя огня в ось пингов;
         ручей   - редкие искры стекают по оси пингов вниз по списку,
                   гаснут к середине списка;
         форсаж  - на ударе треть искр срывается из сопел и мчится ВНИЗ
                   вдоль факела, расходясь веером;
         строка  - строка списка загорелась: горсть искр брызгает из
                   истока. */
    var ИСКР = 1600;
    var искГеом = держать(new T.BufferGeometry());
    var искСид = new Float32Array(ИСКР * 4);
    for (var k = 0; k < ИСКР * 4; k++) искСид[k] = случ();
    искГеом.setAttribute("position", new T.BufferAttribute(new Float32Array(ИСКР * 3), 3));
    искГеом.setAttribute("seed", new T.BufferAttribute(искСид, 4));
    var искМат = держать(new T.ShaderMaterial({
      uniforms: {
        uTime: { value: 0 }, uBoost: { value: 1 }, uPx: { value: 2 },
        uP0: { value: new T.Vector2() }, uP1: { value: new T.Vector2() },
        uP2: { value: new T.Vector2() }, uP3: { value: new T.Vector2() },
        uW0: { value: 10 }, uW1: { value: 30 }, uCol: { value: 400 },
        uBurst: { value: -99 }, uRow: { value: -99 }
      },
      vertexShader: [
        "precision highp float;",
        "attribute vec4 seed;",
        "uniform float uTime, uBoost, uPx, uW0, uW1, uCol, uBurst, uRow;",
        "uniform vec2 uP0, uP1, uP2, uP3;",
        "varying float vFade; varying float vHeat;",
        КОЛЫХАНИЕ,
        "vec2 bez(float s){ float g = 1.0 - s; vec2 b = g*g*g*uP0 + 3.0*g*g*s*uP1 + 3.0*g*s*s*uP2 + s*s*s*uP3; return b + vec2(sway(s, uTime), 0.0); }",
        "vec2 tang(float s){ float g = 1.0 - s; return normalize(3.0*g*g*(uP1-uP0) + 6.0*g*s*(uP2-uP1) + 3.0*s*s*(uP3-uP2) + vec2(0.0, -1e-3)); }",
        "void main(){",
        "  float cat = seed.y;",
        "  vec2 p; float fade; float heat; float size;",
        "  if (cat < .165) {",
        "    float life = mix(.8, 1.5, seed.x);",
        "    float age = fract(uTime/life + seed.z*7.0);",
        "    float s = .66 + .34*pow(age, 1.25);",
        "    vec2 t = tang(min(s, .999)); vec2 n = vec2(-t.y, t.x);",
        "    p = bez(s) + n*(seed.w - .5)*12.0*(1.0 - .75*age);",
        "    fade = smoothstep(0.0, .12, age) * (1.0 - smoothstep(.9, 1.0, age));",
        "    heat = .75 + .25*seed.x; size = .7 + .9*seed.x;",
        "  } else if (cat < .225) {",
        "    float age = fract(uTime/mix(1.7, 3.0, seed.x) + seed.z*5.0);",
        "    p = uP3 + vec2((seed.w - .5)*5.0, -age*uCol*.6);",
        "    fade = smoothstep(0.0, .05, age) * (1.0 - age)*(1.0 - age) * .85;",
        "    heat = .7 - .4*age; size = .6 + .7*seed.x;",
        "  } else {",
        "    float life = mix(1.1, 2.6, seed.x);",
        "    float age = fract(uTime/life + seed.y*3.0);",
        "    float s = age * mix(.6, 1.0, seed.z);",
        "    vec2 t = tang(min(s, .999)); vec2 n = vec2(-t.y, t.x);",
        "    float sw = seed.w - .5; float spread = sign(sw)*(.55 + .9*abs(sw)) * .5 * mix(uW0, uW1, sin(3.1416*min(s*1.4, 1.0))) * (1.0 + .5*seed.x) * (1.0 - .8*smoothstep(.6, 1.0, s));",
        "    float wob = sin(uTime*(2.0 + seed.x*4.0) + seed.w*30.0) * 4.0 * s;",
        "    p = bez(s) + n*(spread + wob);",
        "    fade = (1.0 - smoothstep(.7, 1.0, age)) * smoothstep(.0, .04, age) * smoothstep(.06, .2, s);",
        "    heat = 1.0 - s*.8; size = .5 + .9*seed.w*seed.x + .4*(1.0 - s); fade *= .55*step(.5, fract(seed.z*13.7));",
        "  }",
        "  float ub = uTime - uBurst;",
        "  float ud = ub - seed.z*.3;",
        "  if (cat >= .225 && cat < .56 && ud >= 0.0 && ub < 1.0) {",
        "    float u = ud / (1.0 - seed.z*.3);",
        "    float sp = mix(.45, 1.25, seed.x);",
        "    float s = min(u*sp*(1.3 - .6*u), 1.02);",
        "    vec2 t = tang(min(s, .999)); vec2 n = vec2(-t.y, t.x);",
        "    float lat = (seed.w - .5) * mix(18.0, 140.0, seed.z) * sqrt(u) * (1.0 - .7*smoothstep(.7, 1.0, s));",
        "    p = bez(s) + n*lat + vec2(0.0, -40.0*u*u*seed.z);",
        "    fade = (1.0 - smoothstep(.5, 1.0, u)) * smoothstep(0.0, .03, u);",
        "    heat = 1.0 - u*.55; size = .9 + 1.4*seed.x;",
        "  }",
        "  float ur = uTime - uRow;",
        "  if (cat >= .56 && cat < .63 && ur >= 0.0 && ur < .7) {",
        "    float u = ur * mix(.8, 1.2, seed.z);",
        "    float ang = (seed.w - .5) * 2.6;",
        "    vec2 v = vec2(sin(ang), cos(ang)) * mix(20.0, 110.0, seed.x*seed.x);",
        "    p = uP3 + v*(u + .04) + vec2(0.0, -260.0*u*u);",
        "    fade = (1.0 - smoothstep(.2, .7, u)) * smoothstep(0.0, .06, u) * .7;",
        "    heat = .85 - u*.6; size = .7 + 1.0*seed.x;",
        "  }",
        "  vFade = fade; vHeat = heat;",
        "  gl_PointSize = size * uPx * (.85 + .25*uBoost);",
        "  gl_Position = projectionMatrix*viewMatrix*vec4(p, 60.0, 1.0);",
        "}"
      ].join("\n"),
      fragmentShader: [
        "uniform float uBoost; varying float vFade; varying float vHeat;",
        "void main(){",
        "  vec2 d = gl_PointCoord - .5; float r = length(d);",
        "  float a = 1.0 - smoothstep(.12, .5, r);",
        "  vec3 c = mix(vec3(.95,.22,.04), vec3(1.0,.62,.2), smoothstep(.15, .6, vHeat));",
        "  c = mix(c, vec3(1.0,.92,.75), smoothstep(.8, 1.0, vHeat));",
        "  gl_FragColor = vec4(c * a * vFade * (1.0 + 1.6*vHeat) * min(uBoost, 1.8), 1.0);",
        "}"
      ].join("\n"),
      blending: T.AdditiveBlending, transparent: true, depthWrite: false, depthTest: false
    }));
    var искры = new T.Points(искГеом, искМат);
    искры.frustumCulled = false; искры.renderOrder = 6;
    сцена.add(искры);

    /* ── РАСКЛАДКА ОТ ЯКОРЕЙ ───────────────────────────────────────── */
    var раскладка = { ш: 0, в: 0, кх: 0, ку: 0, кр: 0, ось: 0, сп: 0, св: 0, рем: 10, рх: 0, лх: 0, ok: false };
    var кривая = { p0: new T.Vector2(), p1: new T.Vector2(), p2: new T.Vector2(), p3: new T.Vector2() };
    var сопла = [];
    for (var с0 = 0; с0 < 5; с0++) сопла.push({ x: 0, y: 0, z: 0, р: 1 });

    function взятьЯкоря() {
      var к = я.кнопка, с = я.список;
      /* Кнопки нет (другой раздел) - держим прежнюю композицию: прыжок
         ракеты при переходе на «Серверы» выглядел бы поломкой. */
      if (!к.видна && раскладка.ok) return false;
      var кх = к.видна ? к.x : я.ширина / 2;
      var ку = к.видна ? к.y : я.высота * .157;
      var кр = к.видна ? к.r : я.высота * .062;
      var ось = с.видна ? с.ось : я.ширина * .85;
      var сп = с.видна ? с.y : я.высота * .455;
      var св = с.видна ? с.в : я.высота * .45;
      var сдвиг = Math.abs(я.ширина - раскладка.ш) + Math.abs(я.высота - раскладка.в) +
        Math.abs(кх - раскладка.кх) + Math.abs(ку - раскладка.ку) + Math.abs(кр - раскладка.кр) +
        Math.abs(ось - раскладка.ось) + Math.abs(сп - раскладка.сп) + Math.abs(св - раскладка.св) * .2;
      if (раскладка.ok && сдвиг < 2) return false;
      раскладка.ш = я.ширина; раскладка.в = я.высота;
      раскладка.кх = кх; раскладка.ку = ку; раскладка.кр = кр;
      раскладка.ось = ось; раскладка.сп = сп; раскладка.св = св;
      раскладка.рем = я.рем || 10;
      раскладка.ok = true;
      return true;
    }

    /* Путь в точках экрана (y вниз положительный) в заранее выделенные
       массивы: кривая плюс короткий прямой хвост по столбцу. */
    function собратьПуть() {
      var P0 = кривая.p0, P1 = кривая.p1, P2 = кривая.p2, P3 = кривая.p3;
      var главных = Math.round(КУСКОВ / (1 + ДОЛЯ_ХВОСТА));
      var дл = 0, i;
      for (i = 0; i <= главных; i++) {
        var s = i / главных, g = 1 - s;
        путьX[i] = g*g*g*P0.x + 3*g*g*s*P1.x + 3*g*s*s*P2.x + s*s*s*P3.x;
        путьY[i] = -(g*g*g*P0.y + 3*g*g*s*P1.y + 3*g*s*s*P2.y + s*s*s*P3.y);
        if (i) дл += Math.hypot(путьX[i] - путьX[i-1], путьY[i] - путьY[i-1]);
        путьL[i] = дл;
      }
      for (i = 0; i <= главных; i++) путьS[i] = путьL[i] / дл;
      for (i = главных + 1; i <= КУСКОВ; i++) {
        var д = (i - главных) / (КУСКОВ - главных) * ДОЛЯ_ХВОСТА;
        путьX[i] = путьX[главных]; путьY[i] = путьY[главных] + д * дл;
        путьL[i] = дл * (1 + д); путьS[i] = 1 + д;
      }
      return дл;
    }

    function заполнитьЛенту(г, ширина) {
      var поз = г.attributes.position.array, аА = г.attributes.aA.array;
      var аS = г.attributes.aS.array, аW = г.attributes.aW.array;
      for (var j = 0; j <= КУСКОВ; j++) {
        var jа = Math.max(0, j - 1), jб = Math.min(КУСКОВ, j + 1);
        var tx = путьX[jб] - путьX[jа], ty = путьY[jб] - путьY[jа];
        var дл = Math.hypot(tx, ty) || 1;
        var nx = -ty / дл, ny = tx / дл;
        var w = ширина(путьS[j]);
        for (var сторона = 0; сторона < 2; сторона++) {
          var зн = сторона ? 1 : -1, в = j * 2 + сторона;
          поз[в*3] = путьX[j] + nx * w * зн;
          поз[в*3+1] = -(путьY[j] + ny * w * зн);
          поз[в*3+2] = 0;
          аА[в*2] = зн; аА[в*2+1] = путьL[j];
          аS[в] = путьS[j]; аW[в] = w;
        }
      }
      г.attributes.position.needsUpdate = true; г.attributes.aA.needsUpdate = true;
      г.attributes.aS.needsUpdate = true; г.attributes.aW.needsUpdate = true;
      г.computeBoundingSphere();
    }

    /* Ширина факела (полуширина в точках). У сопел - ширина ракеты,
       к уровню первой карточки дым раздувается до 2.5 ширины ракеты и
       держит её до середины пути, у списка сходится в поток не уже 0.6
       ширины сопел (дальше его сужает до ленточки приглушение в самом
       шейдере). Огонь внутри дыма, у сопел почти во всю ширину. */
    var шир = { w0: 10, wmax: 36, wEnd: 8, sMax: .35 };
    function ширинаДыма(s) {
      if (s > 1) return шир.wEnd * (1 - .5 * (s - 1) / ДОЛЯ_ХВОСТА);
      var раздув = гладко(0, шир.sMax, s);
      var база = шир.w0 + (шир.wmax - шир.w0) * Math.sqrt(раздув);
      var к = гладко(.68, 1.0, s);
      return база * (1 - к) + шир.wEnd * к;
    }
    function ширинаОгня(s) {
      var д = ширинаДыма(s);
      return Math.max(4, д * (.95 - .33 * гладко(0, .3, s)));
    }

    var точка = new T.Vector3();
    var осьY = new T.Vector3(0, 1, 0);
    function построить() {
      var Ш = раскладка.ш, В = раскладка.в, р = раскладка.кр, рем = раскладка.рем;
      камера.left = 0; камера.right = Ш; камера.top = 0; камера.bottom = -В;
      камера.updateProjectionMatrix();

      /* Подложка: cover по экрану с запасом 4 %, правым краем к правому
         краю: светлая сторона облаков встаёт под факел. */
      var пв = В * 1.04, пш = пв * пропорцияПодложки;
      if (пш < Ш * 1.02) { пш = Ш * 1.02; пв = пш / пропорцияПодложки; }
      подложка.scale.set(пш, пв, 1);
      подложка.position.set(Ш - пш / 2 + Ш * .01, -В / 2, -1500);
      var верхПодложки = В / 2 - пв / 2;
      var уп = подложкаМат.uniforms;
      уп.uHorV.value = 1 - ГОРИЗОНТ;
      уп.uHorY.value = верхПодложки + ГОРИЗОНТ * пв;
      уп.uW.value = Ш;
      уп.uListY.value = раскладка.сп;
      уп.uGlowC.value.set(раскладка.ось, Math.max(раскладка.сп + 60, уп.uHorY.value + 50));
      уп.uGlowR.value = Ш * .26;

      /* РАКЕТА. Нос на 2 % высоты экрана, срез сопел на четверть радиуса
         кнопки ниже её центра. Вертикальный масштаб мВ из этой длины.
         Прежняя ракета стояла на 2.05 r правее кнопки - ровно под короной
         шапки, и корона прятала нос и межступенчатый пояс. Теперь она, как
         на концепте, стоит в просвете между неоновым ободом кнопки (не
         ближе 8 точек) и короной: корпус ядра левее короны, ускорители
         ниже шапки могут выходить правее. Ракета на 40 % толще прежней
         (масштаб по x и z больше, чем по y): в тридцать точек ширины она
         читалась игрушкой, концепт - около пятидесяти. */
      var носY = В * .02, соплоY = раскладка.ку + р * .25;
      var L = соплоY - носY;
      var срезЯдра = СРЕЗ * КОЛ_ЯДРА;
      var мВ = L / (ВЫСОТА + срезЯдра);
      var охват = Math.cos(ПОВОРОТ) * РАССТ + РБ + .05;     /* полуширина в радиусах ядра */
      var обод = раскладка.кх + р * 1.05 + 8;
      var правый = Ш - 8;
      var корона = Ш - 6.2 * рем - 6;                        /* левый край короны шапки */
      var м = мВ * 1.4;
      м = Math.min(м, (правый - обод) / (2 * охват));
      м = Math.min(м, (корона - обод) / (охват + 1.05));
      м = Math.max(м, мВ * .8);
      var цх = обод + охват * м;
      цх = Math.min(цх, правый - охват * м);
      раскладка.рх = цх;
      ракета.scale.set(м, мВ, м);
      ракета.position.set(цх, -(соплоY - срезЯдра * мВ), 200);
      var рамкаЛ = цх - охват * м - 4, рамкаП = цх + охват * м + 4;
      var рамкаВ = носY - 4, рамкаН = соплоY + 4;
      камераРакеты.left = рамкаЛ; камераРакеты.right = рамкаП;
      камераРакеты.top = -рамкаВ; камераРакеты.bottom = -рамкаН;
      камераРакеты.updateProjectionMatrix();
      лист.scale.set(рамкаП - рамкаЛ, рамкаН - рамкаВ, 1);
      лист.position.set((рамкаЛ + рамкаП) / 2, -(рамкаВ + рамкаН) / 2, 200);
      раскладка.лх = лист.position.x;
      var плотность = я.dpr * (МИР.масштаб ? МИР.масштаб() : 1) * 2;
      var пшР = Math.min(1024, Math.ceil((рамкаП - рамкаЛ) * плотность));
      var пвР = Math.min(2048, Math.ceil((рамкаН - рамкаВ) * плотность));
      if (!цельРакеты || цельРакеты.width !== пшР || цельРакеты.height !== пвР) {
        if (цельРакеты) цельРакеты.dispose();
        цельРакеты = new T.WebGLRenderTarget(пшР, пвР, {
          type: гл2 ? T.HalfFloatType : T.UnsignedByteType, format: T.RGBAFormat,
          minFilter: T.LinearFilter, magFilter: T.LinearFilter, depthBuffer: true,
          samples: гл2 ? 4 : 0
        });
        цельРакеты.texture.colorSpace = T.LinearSRGBColorSpace;
        листМат.uniforms.tMap.value = цельРакеты.texture;
      }
      нужнаРакета = true;

      /* Срезы пяти сопел в точках экрана с учётом поворота корпуса. */
      var срезБока = СРЕЗ * КОЛ_БОКА - ПОДЪЁМ_БОКА;
      сопла[0].x = цх; сопла[0].y = соплоY; сопла[0].z = 9; сопла[0].р = .72 * КОЛ_ЯДРА * м;
      for (var i = 0; i < 4; i++) {
        точка.set(Math.cos(уголки[i]) * РАССТ, 0, Math.sin(уголки[i]) * РАССТ).applyAxisAngle(осьY, ПОВОРОТ);
        var с = сопла[i + 1];
        с.x = цх + точка.x * м;
        с.y = соплоY - (срезЯдра - срезБока) * мВ;
        с.z = точка.z;
        с.р = .72 * КОЛ_БОКА * м;
      }
      var крайX = 0;
      for (i = 0; i < 5; i++) крайX = Math.max(крайX, Math.abs(сопла[i].x - цх) + сопла[i].р);

      /* Струи: около трёх десятков точек, дальше они тонут в общем ядре.
         Струя за ядром (z < 0) тусклее - видна сквозь чужой огонь. */
      for (i = 0; i < 5; i++) {
        var сп = сопла[i], дл = (i === 0 ? 4.2 : 3.4) * мВ;
        струи[i].scale.set(сп.р * 2 * 3.0, дл, 1);
        струи[i].position.set(сп.x, -(сп.y + дл / 2 - .3), 150 + сп.z);
        струи[i].material.uniforms.uDim.value = сп.z < -.1 ? .55 : 1;
      }

      /* Путь факела: от сопел вниз к оси пингов у верхней строки. */
      var старт = соплоY + .3 * мВ;
      var D = раскладка.сп - старт;
      кривая.p0.set(цх, -старт);
      кривая.p1.set(цх, -(старт + D * .45));
      кривая.p2.set(раскладка.ось, -(раскладка.сп - D * .45));
      кривая.p3.set(раскладка.ось, -раскладка.сп);
      var длПути = собратьПуть();

      /* Раздув до 2.5 ширины ракеты к верху первой карточки. Карточка
         начинается около 230 точек на телефоне 430x932: это чуть ниже
         обода кнопки. */
      var низКнопки = раскладка.ку + р * 1.1;
      шир.w0 = крайX + 2;
      шир.wmax = Math.min(Ш * .17, шир.w0 * 2.3);
      шир.wEnd = Math.max(7, шир.w0 * .6 * .5 * 2);
      шир.sMax = Math.min(.45, Math.max(.2, (низКнопки + 30 - старт) / Math.max(1, D)));
      заполнитьЛенту(геомДыма, ширинаДыма);
      заполнитьЛенту(геомОгня, ширинаОгня);

      [огоньМат, дымМат].forEach(function (м2) {
        м2.uniforms.uCardY.value = низКнопки;
        м2.uniforms.uListY.value = раскладка.сп;
        м2.uniforms.uAxis.value = раскладка.ось;
        м2.uniforms.uLen.value = длПути;
      });

      сияние.scale.set(шир.w0 * 2.2, шир.w0 * 2.2, 1);
      сияние.position.set(цх, -(соплоY + 1.8 * мВ), 170);
      штрих.scale.set(Ш * .9, 10, 1);
      штрих.position.set(цх, -(соплоY + 1.8 * мВ), 171);

      жар.position.set(цх, -(соплоY + 1.5 * мВ), 260);
      жар.distance = L * .35;

      var у = искМат.uniforms;
      у.uP0.value.copy(кривая.p0); у.uP1.value.copy(кривая.p1);
      у.uP2.value.copy(кривая.p2); у.uP3.value.copy(кривая.p3);
      у.uW0.value = шир.w0 * 1.3; у.uW1.value = шир.wmax * 1.5;
      у.uCol.value = раскладка.св;

      звМат.uniforms.uSize.value.set(Ш, В);

      var ок = октав();
      огоньМат.uniforms.uOct.value = ок; дымМат.uniforms.uOct.value = ок;
    }

    /* ── СОБЫТИЯ ИНТЕРФЕЙСА ──────────────────────────────────────────
       Всё от времени события: замороженный кадр для раскадровки обязан
       совпасть с живым.
       Удар - форсаж: тяга за 0.06 с взлетает почти втрое и спадает по
       ease-out к секунде; горячее ядро удлиняется на 70 %, первые 0.12 с
       у сопел вспышка со штрихом, облака справа вспыхивают. */
    var событие = { удар: -99, ряд: -99, подключено: false, подкл: -99, откл: -99, готовимся: -99 };
    var форс = { тяга: 1, вспышка: 0, дальность: 1, удар: 0 };
    var нужнаРакета = true;

    function форсаж(t) {
      var u = t - событие.удар;
      var f = 0, вс = 0;
      if (u >= 0 && u < 1.0) {
        var k = 1 - u / 1.0;
        f = гладко(0, .06, u) * k * k;
        вс = u < .3 ? гладко(0, .025, u) * Math.pow(1 - u / .3, 2.2) : 0;
      }
      var р = t - событие.ряд;
      var fr = р >= 0 && р < .5 ? (1 - р / .5) * .25 : 0;
      var г = t - событие.готовимся;
      var fg = г >= 0 && г < 2.5 && !событие.подключено ? .12 * (.5 + .5 * Math.sin(г * 18)) : 0;
      var пк = событие.подключено ? .35 * гладко(0, 1.0, t - событие.подкл)
        : (событие.откл > 0 ? .35 * (1 - гладко(0, .8, t - событие.откл)) : 0);
      форс.тяга = 1 + f * 1.8 + fr + fg + пк;
      форс.вспышка = вс;
      форс.удар = f;
      форс.дальность = 1 + f * .7 + пк * .5;
      return форс;
    }

    var tПоследнее = 0;
    var номерКадра = 0;

    о.линза([1.0, .45, .18], 1);
    о.свечение(.55, 1.2);

    /* ручка для стенда: снимки по слоям */
    if (window.МИР_ОТЛАДКА) window.МИР_ОТЛАДКА.ракета = { искры: искры, огонь: огонь, дым: дым, струи: струи, сияние: сияние, лист: лист, подложка: подложка, звёзды: звёзды };
    return {
      сцена: сцена,
      камера: камера,

      кадр: function (t) {
        tПоследнее = t;
        номерКадра += 1;
        if (взятьЯкоря()) построить();
        /* Время шейдеров по модулю десяти минут: у float на телефоне мало
           разрядов, и через час шум огня пошёл бы ступенями. Шесть сотен
           делятся на цикл облаков (20 с) нацело - облака не прыгают. */
        var тш = t % 600;
        var ф = форсаж(t);
        /* Дрожь корпуса от тяги, не больше 0.6 точки */
        лист.position.x = раскладка.лх + (.35 * Math.sin(t * 61.0) * Math.sin(t * 13.7) + .12 * Math.sin(t * 97.0)) * Math.min(ф.тяга, 1.25);

        огоньМат.uniforms.uTime.value = тш; огоньМат.uniforms.uBoost.value = ф.тяга;
        огоньМат.uniforms.uReach.value = ф.дальность;
        дымМат.uniforms.uTime.value = тш; дымМат.uniforms.uBoost.value = Math.min(ф.тяга, 1.8);
        for (var i = 0; i < струи.length; i++) {
          var у = струи[i].material.uniforms;
          у.uTime.value = тш; у.uBoost.value = ф.тяга;
        }
        сияниеМат.uniforms.uTime.value = тш; сияниеМат.uniforms.uBoost.value = ф.тяга;
        сияниеМат.uniforms.uFlash.value = ф.вспышка;
        штрихМат.uniforms.uFlash.value = ф.вспышка;
        штрих.visible = ф.вспышка > .002;
        var иу = искМат.uniforms;
        иу.uTime.value = тш; иу.uBoost.value = ф.тяга; иу.uPx.value = я.dpr;
        иу.uBurst.value = событие.удар - t + тш; иу.uRow.value = событие.ряд - t + тш;
        звМат.uniforms.uTime.value = тш; звМат.uniforms.uPx.value = я.dpr;
        var уп = подложкаМат.uniforms;
        уп.uTime.value = тш;
        уп.uWarm.value = 1 + (ф.тяга - 1) * .5;
        уп.uStrike.value = ф.удар;
        уп.uGlowK.value = .55 * Math.min(ф.тяга, 2.2) * (.93 + .07 * Math.sin(t * 23.0));
        сопло.emissiveIntensity = .7 * ф.тяга;
        жар.intensity = 3.4 * ф.тяга * (.92 + .08 * Math.sin(t * 29.0));
        снизу.intensity = 1.1 * Math.min(ф.тяга, 2.2);

        /* свой проход ракеты через кадр; на форсаже - каждый кадр */
        if (цельРакеты && (нужнаРакета || (номерКадра & 1) === 0 || ф.тяга > 1.05)) {
          нужнаРакета = false;
          var р = о.рендерер, пред = р.getRenderTarget();
          р.getClearColor(цветОчистки); var альфа = р.getClearAlpha();
          р.setRenderTarget(цельРакеты);
          р.setClearColor(0x000000, 0); р.clear();
          р.render(сценаРакеты, камераРакеты);
          р.setRenderTarget(пред);
          р.setClearColor(цветОчистки, альфа);
        }
      },

      размер: function () { раскладка.ok = false; взятьЯкоря(); построить(); },

      /* Исток следа - то место, где факел входит в столбец пингов: огонь
         и струя искр уже стекли туда сами, интерфейс продолжает их по
         строкам. */
      источник: function () {
        if (!раскладка.ok && взятьЯкоря()) построить();
        return { x: раскладка.ось, y: раскладка.сп - .4 * (я.рем || 10) };
      },

      событие: function (имя, д) {
        if (имя === "удар" && д && д.фаза === "начало") событие.удар = tПоследнее;
        else if (имя === "ряд" && д && д.живой) событие.ряд = tПоследнее;
        else if (имя === "подключаемся") событие.готовимся = tПоследнее;
        else if (имя === "подключено") { if (!событие.подключено) событие.подкл = tПоследнее; событие.подключено = true; }
        else if (имя === "отключено") { if (событие.подключено) событие.откл = tПоследнее; событие.подключено = false; }
      },

      уничтожить: function () {
        жива = false;
        if (цельРакеты) { цельРакеты.dispose(); цельРакеты = null; }
        всё.forEach(function (x) { try { x.dispose(); } catch (е) {} });
        всё.length = 0;
      }
    };
  });
})();
