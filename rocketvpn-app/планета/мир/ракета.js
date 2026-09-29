/* СЦЕНА ТЕМЫ «РАКЕТА»: НОЧНОЙ СТАРТ, ФАКЕЛ СТЕКАЕТ К СПИСКУ

   Концепт владельца (концепты/ракета-1-ночной-старт.jpg): тонкая ракета
   стоит вертикально в правом верхнем углу, из сопел бьют белые струи,
   ниже они сливаются в огненный столб, столб клубится светящимся дымом,
   течёт вниз по правой стороне за стеклянными карточками и к списку
   серверов сужается в струю искр по столбцу пингов. Слово владельца:
   «анимации идут от элемента фона». Элемент здесь - сопла: след замера
   не рождается у списка, он вытекает из двигателя.

   ── ПОЧЕМУ КАМЕРА ОРТОГОНАЛЬНАЯ ─────────────────────────────────────
   Одна единица мира равна одной css-точке экрана: x вправо, y вниз со
   знаком минус. Композиция строится от якорей интерфейса, и «сопло над
   осью пингов» в такой камере это просто одинаковый x на любом размере
   экрана. Ракета при этом объёмная: тело вращения, металл с картой
   окружения, свет луны сверху слева и жар факела снизу.

   ── ИЗ ЧЕГО СОБРАН КАДР (снизу вверх) ───────────────────────────────
     подложка   облака-ночь.webp 4K: звёзды и море облаков, справа
                подсвеченных огнём. Прижата правым краем: освещённые
                облака стоят под факелом. Тёплые пиксели снимка дышат
                вместе с пламенем - облака живо подсвечены живым огнём.
     звёзды     полторы сотни мерцающих точек поверх снимка.
     дым        широкая лента вдоль пути факела, клубы со светотенью
                (свет изнутри, от огня).
     огонь      лента уже, аддитивная, шкала температуры: белое ядро
                ярче единицы (из него движок делает свечение), жёлтое,
                оранжевое, тёмно-красное.
     струи      пять белых струй из сопел с ударными ромбами.
     ракета     центральная ступень и четыре ускорителя, текстуры
                корпуса рисуются кодом: шлифованный титан, белая
                керамика, швы панелей, индиговая полоса бренда.
     искры      полторы тысячи точек на видеокарте, позиция каждой -
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

    /* Шум для огня и дыма: значение в узлах решётки, плавная склейка,
       сверху октавы с поворотом (без поворота октавы ложатся сеткой).
       Пламя без шума читается градиентом, в одну октаву - кашей. Хэш без
       sin: на мобильных видеокартах sin от больших чисел даёт полосы. */
    var ШУМ = [
      "float hash(vec2 p){ vec3 p3 = fract(vec3(p.xyx) * .1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }",
      "float noise(vec2 p){ vec2 i = floor(p), f = fract(p); vec2 u = f*f*(3.0-2.0*f);",
      "  return mix(mix(hash(i), hash(i+vec2(1.0,0.0)), u.x), mix(hash(i+vec2(0.0,1.0)), hash(i+vec2(1.0,1.0)), u.x), u.y); }",
      "float fbm(vec2 p){ float s = 0.0, a = .5; for (int i = 0; i < 5; i++){ s += a*noise(p); p = mat2(1.6, 1.2, -1.2, 1.6)*p + 7.3; a *= .5; } return s; }",
      "float fbm3(vec2 p){ float s = 0.0, a = .5; for (int i = 0; i < 3; i++){ s += a*noise(p); p = mat2(1.6, 1.2, -1.2, 1.6)*p + 7.3; a *= .5; } return s; }"
    ].join("\n");

    /* Вершинный шейдер лент: поперёк (-1..1), вдоль в точках, доля пути,
       полуширина в точках - всё из атрибутов, собранных в раскладке. */
    var ВЕРШИНА_ЛЕНТЫ = [
      "attribute vec2 aA; attribute float aS; attribute float aW;",
      "varying vec2 vA; varying float vS; varying float vW; varying float vY;",
      "void main(){ vA = aA; vS = aS; vW = aW; vY = -position.y;",
      "  gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.0); }"
    ].join("\n");

    /* ── ПОДЛОЖКА ─────────────────────────────────────────────────────
       uWarm поднимает тёплые пиксели снимка: это облака, освещённые
       огнём, и они обязаны вспыхивать вместе с двигателем. Низ кадра
       чуть глубже: там белый текст на стеклянных карточках. */
    var подложкаМат = держать(new T.ShaderMaterial({
      uniforms: { tMap: { value: null }, uWarm: { value: 1 }, uTime: { value: 0 }, uH: { value: 932 }, uHave: { value: 0 } },
      vertexShader: "varying vec2 vUv; varying float vY; void main(){ vUv = uv; vec4 w = modelMatrix*vec4(position,1.0); vY = w.y; gl_Position = projectionMatrix*viewMatrix*w; }",
      fragmentShader: [
        "precision highp float;",
        "uniform sampler2D tMap; uniform float uWarm, uTime, uH, uHave; varying vec2 vUv; varying float vY;",
        "void main(){",
        "  vec3 c = texture2D(tMap, vUv).rgb * uHave;",
        "  float sy = clamp(-vY / uH, 0.0, 1.0);",
        "  float warm = clamp((c.r - c.b) * 2.2, 0.0, 1.0);",
        "  float flick = .93 + .07*sin(uTime*17.0)*sin(uTime*6.1 + 1.3);",
        "  c *= .82 * mix(1.0, .72, smoothstep(.42, 1.0, sy));",
        "  c *= 1.0 + warm * (uWarm*flick - 1.0) * .9;",
        "  gl_FragColor = vec4(c, 1.0);",
        "}"
      ].join("\n"),
      depthWrite: false, depthTest: false
    }));
    var подложка = new T.Mesh(держать(new T.PlaneGeometry(1, 1)), подложкаМат);
    подложка.renderOrder = -10; подложка.frustumCulled = false;
    сцена.add(подложка);
    var пропорцияПодложки = 2160 / 3840;
    о.загрузить("ассеты/мир/ракета/облака-ночь.webp").then(function (т) {
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
       Ракета занимает на экране около трёхсот точек в высоту, и на таком
       размере металл «настоящий» не из-за формы, а из-за мелочей: швы
       панелей, шлифовка вдоль корпуса, смена материала белая керамика -
       титан, тёмный пояс между ступенями. Без них это пластиковая
       игрушка. Две карты: цвет и шероховатость/металличность (three.js
       берёт шероховатость из зелёного, металл из синего канала).
       Полосы задаются долями высоты снизу вверх. */
    function холстКорпуса(полосы, швы) {
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

    /* Ядро, доли высоты 17 единиц: низ двигательный отсек, титановый бак,
       тёмный межступенчатый пояс, белая верхняя ступень с полосой
       бренда, белый обтекатель с тёмным наконечником. */
    var тЯдро = холстКорпуса([
      [0.00, 0.05, "#3b404a", .45, .85],
      [0.05, 0.54, "#8f97a4", .26, .95],
      [0.54, 0.575, "#1d2129", .5, .7],
      [0.575, 0.80, "#cfd3da", .34, .08],
      [0.735, 0.752, "#5b5bf0", .30, .25],
      [0.80, 0.985, "#d6d9df", .30, .08],
      [0.985, 1.00, "#2a2e36", .35, .8]
    ], [.12, .19, .26, .33, .40, .47, .62, .69, .80, .86, .92]);
    /* Ускоритель, доли высоты 7.4 единицы: титан, пояс, белый нос. */
    var тБок = холстКорпуса([
      [0.00, 0.06, "#3b404a", .45, .85],
      [0.06, 0.80, "#8a929f", .26, .95],
      [0.70, 0.72, "#5b5bf0", .30, .25],
      [0.80, 0.83, "#20242c", .5, .7],
      [0.83, 1.00, "#cdd1d8", .32, .1]
    ], [.20, .34, .48, .62, .90]);

    /* Карта окружения: маленькая сцена-градиент. Снизу оранжевая от
       пламени, сверху ночь, слева холодная световая полоса (луна), справа
       сзади тёплая (отсвет облаков). Полосы дают металлу чёткий продольный
       блик, по которому глаз узнаёт полированный цилиндр. */
    var окружение = (function () {
      var ос = new T.Scene();
      var гс = new T.SphereGeometry(10, 48, 24);
      var мс = new T.ShaderMaterial({
        side: T.BackSide,
        vertexShader: "varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.0); }",
        fragmentShader: [
          "varying vec3 vP;",
          "void main(){",
          "  float y = vP.y; float az = atan(vP.x, vP.z);",
          "  vec3 night = mix(vec3(.008,.01,.025), vec3(.03,.05,.12), smoothstep(-.1, .9, y));",
          "  vec3 fire = vec3(1.7, .62, .16) * smoothstep(-.3, -.95, y);",
          "  float ca = az + 1.05; float cool = exp(-ca*ca*14.0) * smoothstep(-.3, .5, y) * (1.0 - smoothstep(.85, 1.0, y));",
          "  float wa = az - 2.0; float warmS = exp(-wa*wa*10.0) * smoothstep(-.6, .2, y) * (1.0 - smoothstep(.4, .8, y));",
          "  float moon = pow(max(dot(vP, normalize(vec3(-.6, .6, .5))), 0.0), 60.0) * 6.0;",
          "  gl_FragColor = vec4(night + fire + vec3(.7,.8,1.0)*(cool*3.2 + moon) + vec3(1.0,.5,.2)*warmS*1.3, 1.0);",
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

    var металлЯдра = держать(new T.MeshStandardMaterial({
      map: тЯдро.цвет, roughnessMap: тЯдро.рм, metalnessMap: тЯдро.рм,
      roughness: 1, metalness: 1, envMap: карта, envMapIntensity: 1.0
    }));
    var металлБока = держать(new T.MeshStandardMaterial({
      map: тБок.цвет, roughnessMap: тБок.рм, metalnessMap: тБок.рм,
      roughness: 1, metalness: 1, envMap: карта, envMapIntensity: 1.0
    }));
    var тёмный = держать(new T.MeshStandardMaterial({
      color: 0x22262e, metalness: .85, roughness: .4, envMap: карта, envMapIntensity: .9
    }));
    /* Раскалённый край сопла: карта свечения по длине колокола, у среза
       оранжево-красный, у горловины тёмный металл. uv.y колокола идёт от
       горловины (0) к срезу (1), холст переворачивается при загрузке:
       поэтому яркое сверху холста. */
    var жарКолокола = (function () {
      var х = document.createElement("canvas"); х.width = 4; х.height = 64;
      var к = х.getContext("2d");
      var г = к.createLinearGradient(0, 0, 0, 64);
      г.addColorStop(0, "#ff7a2a"); г.addColorStop(.35, "#a02a0a"); г.addColorStop(1, "#000000");
      к.fillStyle = г; к.fillRect(0, 0, 4, 64);
      var т = new T.CanvasTexture(х); т.colorSpace = T.SRGBColorSpace;
      return держать(т);
    })();
    var сопло = держать(new T.MeshStandardMaterial({
      color: 0x2c313b, metalness: .9, roughness: .35, envMap: карта,
      emissive: 0xffffff, emissiveMap: жарКолокола, emissiveIntensity: 1.2, side: T.DoubleSide
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
       мир в буфер без сглаживания (полуточный буфер с MSAA дорог на весь
       экран), и тонкий корпус шириной в тридцать точек выходил лесенкой.
       Поэтому ракета отрисовывается в свой маленький буфер ровно по её
       рамке: вдвое плотнее экрана и с четырёхкратным MSAA, а в мир
       ложится готовым листом с альфой. Рамка - около 50 на 150 css-точек,
       цена прохода меньше процента кадра. */
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
      /* сложенная опора посадки по внешней стороне */
      var оп = new T.Mesh(геомОпора, тёмный);
      оп.position.set(Math.cos(θ) * (РБ + .03), 1.6, Math.sin(θ) * (РБ + .03));
      гр.add(оп);
      корпус.add(гр);
      /* две стойки крепления к ядру */
      [1.0, 5.7].forEach(function (у) {
        var ст = new T.Mesh(геомСтойка, тёмный);
        ст.position.set(Math.cos(θ) * (РАССТ * .6), у, Math.sin(θ) * (РАССТ * .6));
        ст.rotation.y = -θ;
        корпус.add(ст);
      });
      /* решётчатые рули под поясом, между ускорителями */
      var ф = θ + Math.PI / 4;
      var рш = new T.Mesh(геомРешётка, тёмный);
      рш.position.set(Math.cos(ф) * 1.2, 9.0, Math.sin(ф) * 1.2);
      рш.rotation.y = -ф + Math.PI / 2;
      корпус.add(рш);
    });
    корпус.rotation.y = ПОВОРОТ;

    var луна = new T.DirectionalLight(0xb4c4ff, 2.2);
    луна.position.set(-1, 1.1, 1.2);
    сценаРакеты.add(луна);
    /* контровой холодный свет слева сзади: тонкая светлая кромка по
       левому краю корпуса отделяет ракету от ночного неба */
    var контр = new T.DirectionalLight(0x9fb4ff, 1.6);
    контр.position.set(-1.4, .3, -1.0);
    сценаРакеты.add(контр);
    var небо = new T.HemisphereLight(0x1c2850, 0x3a1a0a, .2);
    сценаРакеты.add(небо);
    var жар = new T.PointLight(0xff7a2e, 0, 0, 0);
    сценаРакеты.add(жар);

    /* ── ЛЕНТЫ ФАКЕЛА ─────────────────────────────────────────────────
       Путь: кубическая кривая от сопел до входа в столбец пингов, дальше
       прямо вниз по столбцу (хвост тлеет под карточками и гаснет - огонь
       интерфейса продолжает огонь мира, а не начинается из ничего).
       Касательные на концах вертикальные: пламя вырывается из сопел вниз
       и входит в столбец вниз, без излома.

       Лента пересобирается только при смене якорей. Массивы выделены один
       раз: в кадре ничего не создаётся. Форма огня живёт в шейдере. */
    var КУСКОВ = 140;
    var ДОЛЯ_ХВОСТА = .42;       /* хвост под списком в долях главного пути */
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
       vA.x поперёк, vA.y вдоль в точках, vS доля пути. Шум в ТОЧКАХ
       экрана, а не в долях ленты: на любом телефоне зерно пламени одного
       размера. Шум течёт от сопел (вдоль минус время), поверх - искажение
       вторым шумом: языки загибаются, а не ползут ровными полосами.
       Температура = профиль поперёк + шум, гаснет к середине пути; цвет по
       шкале чёрного тела. За карточками (ниже uCap.x) огонь приглушён:
       текст на стекле читается. */
    var огоньМат = держать(new T.ShaderMaterial({
      uniforms: { uTime: { value: 0 }, uBoost: { value: 1 }, uReach: { value: 1 }, uCap: { value: new T.Vector2(215, 290) } },
      vertexShader: ВЕРШИНА_ЛЕНТЫ,
      fragmentShader: [
        "precision highp float;",
        "uniform float uTime, uBoost, uReach; uniform vec2 uCap;",
        "varying vec2 vA; varying float vS; varying float vW; varying float vY;",
        ШУМ,
        "void main(){",
        "  float s = vS, x = vA.x;",
        "  vec2 q = vec2(x*vW, vA.y - uTime*150.0) / 17.0;",
        "  vec2 wq = vec2(x*vW, vA.y - uTime*90.0) / 40.0;",
        "  vec2 warp = vec2(fbm3(wq), fbm3(wq + vec2(5.2, 1.3))) - .5;",
        "  float n = fbm(q + warp*2.4);",
        "  float n2 = fbm3(q*2.3 + warp*1.5 - vec2(0.0, uTime*1.7));",
        "  float reach = mix(.55, .92, clamp(uReach - .6, 0.0, 1.0));",
        "  float shape = (1.0 - abs(x)) * 1.15 + (n - .5)*1.25*(.35 + s) + (n2 - .5)*.35;",
        "  float along = 1.0 - smoothstep(reach*.45, reach*1.08, s);",
        "  float Tm = smoothstep(.12, 1.05, shape) * along * mix(1.0, .45, smoothstep(.0, .5, s));",
        "  Tm += exp(-x*x*12.0) * (1.0 - smoothstep(.0, .12*uReach, s)) * .45;",
        "  Tm *= mix(1.0, uBoost, .3);",
        "  vec3 c = vec3(0.0);",
        "  c = mix(c, vec3(.38, .05, .01), smoothstep(.06, .24, Tm));",
        "  c = mix(c, vec3(1.0, .28, .04), smoothstep(.22, .44, Tm));",
        "  c = mix(c, vec3(1.6, .78, .18), smoothstep(.44, .68, Tm));",
        "  c = mix(c, vec3(3.0, 2.5, 1.8), smoothstep(.72, .97, Tm));",
        "  float edge = 1.0 - smoothstep(.82, 1.0, abs(x));",
        "  float cap = mix(1.0, .42, smoothstep(uCap.x, uCap.y, vY));",
        "  c *= .45 + .55*uBoost;",
        "  gl_FragColor = vec4(min(c * edge, vec3(9.0)) * cap, 1.0);",
        "}"
      ].join("\n"),
      blending: T.AdditiveBlending, transparent: true, depthWrite: false, depthTest: false, side: T.DoubleSide
    }));

    /* Дым (обычное смешивание).
       Клубы - шум крупнее и медленнее огня: дым тяжелее пламени. Объём
       даёт светотень: плотность меряется второй раз со сдвигом к оси
       факела, разница - сторона клуба, обращённая к огню. Освещённая
       сторона оранжево-золотая, теневая - тёмно-бурая, как на концепте.
       Жар дыма гаснет к списку, там клубы тёмные, и белый текст на
       стекле ложится на глубокий фон. */
    var дымМат = держать(new T.ShaderMaterial({
      uniforms: { uTime: { value: 0 }, uBoost: { value: 1 }, uCap: { value: new T.Vector2(215, 300) } },
      vertexShader: ВЕРШИНА_ЛЕНТЫ,
      fragmentShader: [
        "precision highp float;",
        "uniform float uTime, uBoost; uniform vec2 uCap;",
        "varying vec2 vA; varying float vS; varying float vW; varying float vY;",
        ШУМ,
        "void main(){",
        "  float s = vS, x = vA.x;",
        "  float sp = 70.0 - 30.0*clamp(s, 0.0, 1.0);",
        "  vec2 q = vec2(x*vW*(1.0 - .25*min(s, 1.0)), vA.y - uTime*sp) / 30.0;",
        "  vec2 warp = vec2(fbm3(q*.6 + vec2(1.7, uTime*.12)), fbm3(q*.6 + vec2(8.1, 2.9))) - .5;",
        "  vec2 qq = q + warp*1.8;",
        "  float n = fbm(qq);",
        "  vec2 toAxis = vec2(-x*.3, -.16);",
        "  float nb = fbm(qq + toAxis);",
        "  float lit = clamp((n - nb)*5.0 + .5, 0.0, 1.0);",
        "  float shape = (1.0 - abs(x))*1.1 + (n - .5)*1.5;",
        "  float dens = smoothstep(.18, .62, shape);",
        "  dens *= smoothstep(.0, .10, s) * (1.0 - smoothstep(1.0, 1.40, s));",
        "  dens *= 1.0 - smoothstep(.84, 1.0, abs(x));",
        "  float heat = exp(-x*x*1.8) * (1.0 - smoothstep(.1, 1.15, s));",
        "  heat = clamp(heat * (.55 + .9*n), 0.0, 1.0);",
        "  vec3 dark = vec3(.030, .024, .026);",
        "  vec3 lift = vec3(.20, .085, .035) * (.35 + .65*lit);",
        "  vec3 glow = vec3(1.15, .45, .12) * heat * (.3 + 1.1*lit) * uBoost;",
        "  vec3 c = dark + lift*(1.0 - .5*min(s, 1.0)) + glow;",
        "  c *= mix(1.0, .55, smoothstep(uCap.x, uCap.y, vY));",
        "  gl_FragColor = vec4(c, dens*.95);",
        "}"
      ].join("\n"),
      transparent: true, depthWrite: false, depthTest: false, side: T.DoubleSide
    }));

    var геомДыма = новаяЛента(), геомОгня = новаяЛента();
    var дым = new T.Mesh(геомДыма, дымМат); дым.frustumCulled = false; дым.renderOrder = 1;
    var огонь = new T.Mesh(геомОгня, огоньМат); огонь.frustumCulled = false; огонь.renderOrder = 2;
    сцена.add(дым); сцена.add(огонь);

    /* Струи сопел. Плоскость вдоль струи, uv.y = 1 у среза сопла.
       Ядро сужается карандашом, на нём неподвижные ударные ромбы (они и
       правда стоят на месте - это волны давления, а не газ), снаружи
       мерцающая оболочка. Гаснет ровно до нуля к краям плоскости, иначе
       прямоугольник виден. Квадрат пишется умножением, а не pow(x, 2.0):
       pow от отрицательного числа в GLSL не определён, на части видеокарт
       это NaN, и на форсаже левая половина струи рисовала белый диск с
       ореолом свечения на полэкрана. */
    var струяМат = держать(new T.ShaderMaterial({
      uniforms: { uTime: { value: 0 }, uBoost: { value: 1 }, uSeed: { value: 0 }, uDim: { value: 1 } },
      vertexShader: "varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.0); }",
      fragmentShader: [
        "precision highp float;",
        "uniform float uTime, uBoost, uSeed, uDim; varying vec2 vUv;",
        ШУМ,
        "void main(){",
        "  float a = 1.0 - vUv.y, x = vUv.x*2.0 - 1.0;",
        "  float w = mix(.40, .16, smoothstep(.0, .8, a));",
        "  float dia = pow(max(0.0, sin(a*26.0 + .6)), 8.0) * (1.0 - smoothstep(.1, .55, a));",
        "  float fl = fbm3(vec2(x*3.0 + uSeed, a*6.0 - uTime*9.0));",
        "  float xc = x/(w*(1.0 + .25*dia)); float xs = x/(w*2.1);",
        "  float core = exp(-xc*xc*3.0) * (1.0 - smoothstep(.25, .95, a));",
        "  float shell = exp(-xs*xs*2.5) * (1.0 - smoothstep(.1, .8, a)) * (.6 + .6*fl);",
        "  float lip = smoothstep(.0, .035, a);",
        "  vec3 c = vec3(1.0, .93, .82) * core * (4.2 + 3.5*dia) + vec3(1.0, .55, .18) * shell * 1.9;",
        "  c *= lip * (1.0 - x*x) * uBoost * uDim;",
        "  gl_FragColor = vec4(c, 1.0);",
        "}"
      ].join("\n"),
      blending: T.AdditiveBlending, transparent: true, depthWrite: false, depthTest: false
    }));
    var геомСтруи = держать(new T.PlaneGeometry(1, 1));
    var струи = [];
    for (var с5 = 0; с5 < 5; с5++) {
      var мс = держать(струяМат.clone());
      мс.uniforms.uSeed.value = с5 * 3.7;
      var стр = new T.Mesh(геомСтруи, мс);
      стр.renderOrder = 4; стр.frustumCulled = false;
      сцена.add(стр);
      струи.push(стр);
    }

    /* Сияние у сопел: пятно ярче единицы, из него свечение объектива.
       Функция гаснет РОВНО в ноль на краю квадрата (гаусс минус его
       значение на краю) - прежняя версия оставляла на небе видимый
       прямоугольник. */
    var сияниеМат = держать(new T.ShaderMaterial({
      uniforms: { uTime: { value: 0 }, uBoost: { value: 1 } },
      vertexShader: "varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.0); }",
      fragmentShader: [
        "uniform float uTime, uBoost; varying vec2 vUv;",
        "void main(){ vec2 d = (vUv - .5)*2.0; float r2 = dot(d, d);",
        "  float g = max(exp(-r2*9.0) - exp(-9.0), 0.0)*.45 + max(exp(-r2*2.6) - exp(-2.6), 0.0)*.08;",
        "  float f = .92 + .08*sin(uTime*31.0)*sin(uTime*11.0);",
        "  gl_FragColor = vec4(vec3(1.0, .52, .18) * g * f * uBoost, 1.0); }"
      ].join("\n"),
      blending: T.AdditiveBlending, transparent: true, depthWrite: false, depthTest: false
    }));
    var сияние = new T.Mesh(держать(new T.PlaneGeometry(1, 1)), сияниеМат);
    сияние.renderOrder = 5; сияние.frustumCulled = false;
    сцена.add(сияние);

    /* ── ИСКРЫ ────────────────────────────────────────────────────────
       Три режима, и каждый - чистая функция времени:
         поток  - искра на пути факела со своим сдвигом, скоростью и
                  разлётом; к списку поток сужается и бежит по столбцу
                  пингов, это и есть струя искр концепта;
         форсаж - на ударе треть искр веером вылетает из сопел и падает
                  по параболе;
         строка - строка списка загорелась: горсть искр брызгает вверх
                  из точки входа огня в столбец.
       Возраст = дробная часть времени, поэтому искры бесконечно рождаются
       и ни одна не копит состояние. */
    var ИСКР = 1100;
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
        uW0: { value: 10 }, uW1: { value: 30 }, uLen: { value: 300 },
        uBurst: { value: -99 }, uRow: { value: -99 }, uSpan: { value: 30 }
      },
      vertexShader: [
        "precision highp float;",
        "attribute vec4 seed;",
        "uniform float uTime, uBoost, uPx, uW0, uW1, uLen, uBurst, uRow, uSpan;",
        "uniform vec2 uP0, uP1, uP2, uP3;",
        "varying float vFade; varying float vHeat;",
        "vec2 bez(float s){ float g = 1.0 - s; return g*g*g*uP0 + 3.0*g*g*s*uP1 + 3.0*g*s*s*uP2 + s*s*s*uP3; }",
        "vec2 tang(float s){ float g = 1.0 - s; return normalize(3.0*g*g*(uP1-uP0) + 6.0*g*s*(uP2-uP1) + 3.0*s*s*(uP3-uP2) + vec2(0.0, -1e-3)); }",
        "void main(){",
        "  float life = mix(1.1, 2.6, seed.x);",
        "  float age = fract(uTime/life + seed.y);",
        "  float reach = mix(.7, 1.42, seed.z*seed.z);",
        "  float s = age * reach;",
        "  float sc = min(s, 1.0);",
        "  vec2 c = bez(sc);",
        "  vec2 t = tang(min(sc, .999));",
        "  vec2 n = vec2(-t.y, t.x);",
        "  float tailK = max(s - 1.0, 0.0);",
        "  float spread = (seed.w - .5) * mix(uW0, uW1, sin(3.1416*sc*.9)) * (1.0 + .8*seed.x) * (1.0 - .85*smoothstep(.7, 1.0, s));",
        "  float wob = sin(uTime*(2.0 + seed.x*4.0) + seed.w*30.0) * 3.5 * sc * (1.0 - .7*smoothstep(.8, 1.0, s));",
        "  vec2 p = c + n*(spread + wob)*(1.0 - smoothstep(.95, 1.05, s)) + vec2((seed.w - .5)*3.0*smoothstep(.95, 1.05, s), -tailK*uLen);",
        "  float fade = (1.0 - smoothstep(.72, 1.0, age)) * smoothstep(.0, .03, age);",
        "  fade *= 1.0 - smoothstep(1.05, 1.4, s);",
        "  fade *= 1.0 - .55*step(1.0, s);",
        "  float heat = 1.0 - sc*.85;",
        "  float size = .5 + .9*seed.w*seed.x + .4*(1.0 - sc);",
        "  fade *= mix(.3, 1.0, smoothstep(.5, .9, s));",
        "  fade *= smoothstep(.1, .3, s);",
        "  float ub = uTime - uBurst;",
        "  if (seed.y < .38 && ub >= 0.0 && ub < 1.1) {",
        "    float u = ub * mix(.8, 1.25, seed.z);",
        "    float ang = (seed.w - .5) * 2.8;",
        "    vec2 v = vec2(sin(ang), -cos(ang)) * mix(30.0, 230.0, seed.x*seed.x);",
        "    vec2 o0 = bez(seed.z*seed.z*.4) + vec2((fract(seed.z*17.3) - .5)*uSpan, 0.0);",
        "    p = o0 + v*(u + .02) + vec2(0.0, -150.0*u*u);",
        "    fade = (1.0 - smoothstep(.35, 1.0, u)) * smoothstep(.0, .07, u);",
        "    heat = 1.0 - u*.7; size = .8 + 1.2*seed.x;",
        "  }",
        "  float ur = uTime - uRow;",
        "  if (seed.y >= .38 && seed.y < .45 && ur >= 0.0 && ur < .7) {",
        "    float u = ur * mix(.8, 1.2, seed.z);",
        "    float ang = (seed.w - .5) * 2.6;",
        "    vec2 v = vec2(sin(ang), cos(ang)) * mix(20.0, 110.0, seed.x*seed.x);",
        "    p = uP3 + v*(u + .04) + vec2(0.0, -260.0*u*u);",
        "    fade = (1.0 - smoothstep(.2, .7, u)) * smoothstep(.0, .06, u) * .6;",
        "    heat = .8 - u*.6; size = .7 + 1.0*seed.x;",
        "  }",
        "  vFade = fade; vHeat = heat;",
        "  gl_PointSize = size * uPx * (.85 + .3*uBoost);",
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
        "  gl_FragColor = vec4(c * a * vFade * (1.0 + 1.6*vHeat) * uBoost, 1.0);",
        "}"
      ].join("\n"),
      blending: T.AdditiveBlending, transparent: true, depthWrite: false, depthTest: false
    }));
    var искры = new T.Points(искГеом, искМат);
    искры.frustumCulled = false; искры.renderOrder = 6;
    сцена.add(искры);

    /* ── РАСКЛАДКА ОТ ЯКОРЕЙ ───────────────────────────────────────── */
    var раскладка = { ш: 0, в: 0, кх: 0, ку: 0, кр: 0, ось: 0, сп: 0, рх: 0, ok: false };
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
      var сдвиг = Math.abs(я.ширина - раскладка.ш) + Math.abs(я.высота - раскладка.в) +
        Math.abs(кх - раскладка.кх) + Math.abs(ку - раскладка.ку) + Math.abs(кр - раскладка.кр) +
        Math.abs(ось - раскладка.ось) + Math.abs(сп - раскладка.сп);
      if (раскладка.ok && сдвиг < 2) return false;
      раскладка.ш = я.ширина; раскладка.в = я.высота;
      раскладка.кх = кх; раскладка.ку = ку; раскладка.кр = кр;
      раскладка.ось = ось; раскладка.сп = сп;
      раскладка.ok = true;
      return true;
    }

    /* Путь в точках экрана (y вниз положительный) в заранее выделенные
       массивы: кривая плюс прямой хвост по столбцу. */
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

    /* Ширины факела, заданные в построить(): полуширина у сопел, в теле
       и на входе в столбец. Функции ниже созданы один раз. */
    var шир = { w0: 10, wmax: 36, wEnd: 6 };
    function ширинаДыма(s) {
      if (s > 1) return шир.wEnd * (1 - .45 * (s - 1) / ДОЛЯ_ХВОСТА);
      var база = шир.w0 + (шир.wmax - шир.w0) * гладко(0, .3, s);
      var к = гладко(.5, 1.0, s);
      return (база * (1 - к) + шир.wEnd * к) * (1 + .12 * Math.sin(Math.PI * s));
    }
    function ширинаОгня(s) { return Math.max(3, ширинаДыма(s) * .8); }

    var точка = new T.Vector3();
    var осьY = new T.Vector3(0, 1, 0);
    function построить() {
      var Ш = раскладка.ш, В = раскладка.в, р = раскладка.кр;
      камера.left = 0; камера.right = Ш; камера.top = 0; камера.bottom = -В;
      камера.updateProjectionMatrix();

      /* Подложка: cover по экрану с запасом 4 % на дрейф, правым краем к
         правому краю. Светлая сторона облаков встаёт под факел. */
      var пв = В * 1.04, пш = пв * пропорцияПодложки;
      if (пш < Ш * 1.02) { пш = Ш * 1.02; пв = пш / пропорцияПодложки; }
      подложка.scale.set(пш, пв, 1);
      подложка.position.set(Ш - пш / 2 + Ш * .01, -В / 2, -1500);
      подложкаМат.uniforms.uH.value = В;

      /* Ракета. Нос на 2 % высоты экрана, срез сопел на четверть радиуса
         ниже центра кнопки. Длина L от этого, радиус ядра L/17.95 - та же
         стройность, что у ракеты концепта. Центр правее кнопки на 2.05 r,
         но не ближе 8 точек к неоновому ободу (1.18 r от центра) и к
         правому краю. Не влезает - ракета становится тоньше, а не
         наезжает на кнопку. */
      var носY = В * .02, соплоY = раскладка.ку + р * .25;
      var L = соплоY - носY;
      var срезЯдра = СРЕЗ * КОЛ_ЯДРА;
      var м = L / (ВЫСОТА + срезЯдра);
      var охват = Math.cos(ПОВОРОТ) * РАССТ + РБ + .05;     /* полуширина в радиусах ядра */
      var обод = раскладка.кх + р * 1.18 + 8;
      var правый = Ш - 8;
      var мШ = (правый - обод) / (2 * охват);
      var мВ = м;
      if (мШ < м) м = мШ;
      var цх = раскладка.кх + р * 2.05;
      цх = Math.max(цх, обод + охват * м);
      цх = Math.min(цх, правый - охват * м);
      раскладка.рх = цх;
      /* ракета тоньше, чем нужно по высоте: масштаб по x и z меньше, по y
         прежний - нос всё равно у верхнего края */
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
      var пш = Math.min(1024, Math.ceil((рамкаП - рамкаЛ) * плотность));
      var пвв = Math.min(2048, Math.ceil((рамкаН - рамкаВ) * плотность));
      if (!цельРакеты || цельРакеты.width !== пш || цельРакеты.height !== пвв) {
        if (цельРакеты) цельРакеты.dispose();
        цельРакеты = new T.WebGLRenderTarget(пш, пвв, {
          type: гл2 ? T.HalfFloatType : T.UnsignedByteType, format: T.RGBAFormat,
          minFilter: T.LinearFilter, magFilter: T.LinearFilter, depthBuffer: true,
          samples: гл2 ? 4 : 0
        });
        цельРакеты.texture.colorSpace = T.LinearSRGBColorSpace;
        листМат.uniforms.tMap.value = цельРакеты.texture;
      }

      /* Срезы пяти сопел в точках экрана с учётом поворота корпуса. */
      var срезБока = СРЕЗ * КОЛ_БОКА - ПОДЪЁМ_БОКА;   /* ниже нуля корпуса */
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

      /* Струи: у ядра длиннее. Струя за ядром (z < 0) тусклее - она
         видна сквозь чужой огонь. */
      for (i = 0; i < 5; i++) {
        var сп = сопла[i], дл = (i === 0 ? 5.2 : 3.8) * мВ;
        струи[i].scale.set(сп.р * 2 * 2.3, дл, 1);
        струи[i].position.set(сп.x, -(сп.y + дл / 2 - .3), 150 + сп.z);
        струи[i].material.uniforms.uDim.value = сп.z < -.1 ? .6 : 1;
      }

      /* Путь факела: от сопел вниз к оси пингов у верхней строки. */
      var старт = соплоY + 1.4 * мВ;
      var D = раскладка.сп - старт;
      кривая.p0.set(цх, -старт);
      кривая.p1.set(цх, -(старт + D * .5));
      кривая.p2.set(раскладка.ось, -(раскладка.сп - D * .4));
      кривая.p3.set(раскладка.ось, -раскладка.сп);
      var длПути = собратьПуть();

      шир.w0 = крайX + 2;
      шир.wmax = Math.max(шир.w0 * 1.7, Ш * .08);
      шир.wEnd = 6;
      заполнитьЛенту(геомДыма, ширинаДыма);
      заполнитьЛенту(геомОгня, ширинаОгня);

      /* Приглушение огня за карточками: от низа кнопки и на 75 точек ниже. */
      var низКнопки = раскладка.ку + р * 1.05;
      огоньМат.uniforms.uCap.value.set(низКнопки, низКнопки + 75);
      дымМат.uniforms.uCap.value.set(низКнопки, низКнопки + 85);

      сияние.scale.set(шир.w0 * 3.6, шир.w0 * 3.6, 1);
      сияние.position.set(цх, -(соплоY + 1.8 * мВ), 170);

      жар.position.set(цх, -(соплоY + 1.5 * мВ), 260);
      жар.distance = L * .3;

      var у = искМат.uniforms;
      у.uP0.value.copy(кривая.p0); у.uP1.value.copy(кривая.p1);
      у.uP2.value.copy(кривая.p2); у.uP3.value.copy(кривая.p3);
      у.uW0.value = шир.w0 * 1.3; у.uW1.value = шир.wmax * 1.7;
      у.uLen.value = длПути; у.uSpan.value = шир.w0 * 1.6;

      звМат.uniforms.uSize.value.set(Ш, В);
    }

    /* ── СОБЫТИЯ ИНТЕРФЕЙСА ──────────────────────────────────────────
       Всё от времени события: замороженный кадр для раскадровки обязан
       совпасть с живым. */
    var событие = { удар: -99, ряд: -99, подключено: false, подкл: -99, откл: -99, готовимся: -99 };
    var форс = { тяга: 1, вспышка: 0, дальность: 1 };

    function форсаж(t) {
      var u = t - событие.удар;
      var f = u >= 0 && u < 1.1 ? Math.sin(Math.min(1, u / .1) * Math.PI / 2) * (1 - гладко(.25, 1.1, u)) : 0;
      var р = t - событие.ряд;
      var fr = р >= 0 && р < .4 ? (1 - р / .4) * .18 : 0;
      var г = t - событие.готовимся;
      var fg = г >= 0 && г < 2.5 && !событие.подключено ? .1 * (.5 + .5 * Math.sin(г * 18)) : 0;
      var пк = событие.подключено ? .28 * гладко(0, 1.0, t - событие.подкл)
        : (событие.откл > 0 ? .28 * (1 - гладко(0, .8, t - событие.откл)) : 0);
      форс.тяга = 1 + f * .8 + fr + fg + пк;
      форс.вспышка = f;
      форс.дальность = 1 + f * .55 + пк * 1.2;
      return форс;
    }

    var tПоследнее = 0;

    о.линза([1.0, .45, .18], 1);
    о.свечение(.5, 1.2);

    /* ручка для стенда: снимки по слоям, событий в живом режиме нет */
    if (window.МИР_ОТЛАДКА) window.МИР_ОТЛАДКА.ракета = { искры: искры, огонь: огонь, дым: дым, струи: струи, сияние: сияние, лист: лист, подложка: подложка, звёзды: звёзды };
    return {
      сцена: сцена,
      камера: камера,

      кадр: function (t) {
        tПоследнее = t;
        if (взятьЯкоря()) построить();
        /* Время шейдеров по модулю десяти минут: у float на телефоне мало
           разрядов, и через час шум огня пошёл бы ступенями. Скачок раз
           в десять минут в кипящем огне глазу не виден. */
        var тш = t % 600;
        var ф = форсаж(t);
        /* Дрожь корпуса от тяги, не больше 0.6 точки: крупнее она
           читается тряской камеры, а не работой двигателя. */
        лист.position.x = раскладка.лх + .4 * Math.sin(t * 61.0) * Math.sin(t * 13.7) + .15 * Math.sin(t * 97.0);

        огоньМат.uniforms.uTime.value = тш; огоньМат.uniforms.uBoost.value = ф.тяга;
        огоньМат.uniforms.uReach.value = ф.дальность;
        дымМат.uniforms.uTime.value = тш; дымМат.uniforms.uBoost.value = ф.тяга;
        for (var i = 0; i < струи.length; i++) {
          var у = струи[i].material.uniforms;
          у.uTime.value = тш; у.uBoost.value = ф.тяга;
        }
        сияниеМат.uniforms.uTime.value = тш; сияниеМат.uniforms.uBoost.value = ф.тяга * (1 + ф.вспышка * .6);
        var иу = искМат.uniforms;
        иу.uTime.value = тш; иу.uBoost.value = ф.тяга; иу.uPx.value = я.dpr;
        /* моменты событий в той же шкале, что и время шейдера */
        иу.uBurst.value = событие.удар - t + тш; иу.uRow.value = событие.ряд - t + тш;
        звМат.uniforms.uTime.value = тш; звМат.uniforms.uPx.value = я.dpr;
        подложкаМат.uniforms.uTime.value = тш;
        подложкаМат.uniforms.uWarm.value = 1 + (ф.тяга - 1) * .9;
        сопло.emissiveIntensity = 1.1 * ф.тяга;
        жар.intensity = 3.2 * ф.тяга * (.92 + .08 * Math.sin(t * 29.0));
        /* Дрейф подложки: медленный маятник на две с половиной минуты,
           амплитуда меньше запаса обрезки - край снимка не виден никогда. */
        подложка.position.y = -раскладка.в / 2 - Math.sin(t * 2 * Math.PI / 150) * раскладка.в * .016;

        /* свой проход ракеты; прежние цель и цвет очистки возвращаются */
        if (цельРакеты) {
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
         уже стёк туда сам, интерфейс продолжает его по строкам. */
      источник: function () {
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
