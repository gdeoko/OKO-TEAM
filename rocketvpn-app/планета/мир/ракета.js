/* СЦЕНА ТЕМЫ «РАКЕТА»: НОЧНОЙ СТАРТ, ФАКЕЛ СТЕКАЕТ К СПИСКУ

   Концепт владельца (концепты/ракета-1-ночной-старт.jpg): ракета стоит
   вертикально в правом верхнем углу, её факел льётся ВНИЗ по правой
   стороне экрана за стеклянными карточками и превращается в струю искр,
   которая бежит по столбцу пингов. Слово владельца про связь: «анимации
   должны идти от какого-то элемента фона: огонь, вода, молния». Здесь
   этот элемент - сопла ракеты. След замера не рождается у списка, он
   вытекает из двигателя.

   ── ПОЧЕМУ КАМЕРА ОРТОГОНАЛЬНАЯ ─────────────────────────────────────
   Одна единица мира здесь равна одной css-точке экрана: x вправо, y
   вниз со знаком минус. Композиция строится от якорей интерфейса
   (кнопка, список, ось пингов), и в такой камере «сопло над осью
   пингов» это просто одинаковый x, без пересчёта перспективы на каждом
   размере экрана. Ракета при этом остаётся объёмной: у неё настоящий
   корпус из вращения профиля, металл с отражениями и свет от факела.

   ── ИЗ ЧЕГО СОБРАН КАДР ─────────────────────────────────────────────
     подложка      облака-ночь.webp, 4K: звёзды и море облаков, справа
                   подсвеченных огнём. Прижата правым краем к экрану:
                   освещённая сторона облаков стоит под факелом.
     ракета        центральная ступень и два боковых ускорителя, металл
                   с картой окружения, индиговая полоса бренда.
     факел         лента из треугольников вдоль кривой от сопел к оси
                   пингов; шейдер огня: белое ядро (ярче единицы, из него
                   рождается свечение), жёлтое, оранжевое, красное, дым.
     дым           тёмные клубы вокруг факела, подсвеченные им снизу.
     искры         тысяча частиц на видеокарте: позиция каждой считается
                   из времени, а не копится по кадрам, поэтому замороженный
                   кадр повторяется точь-в-точь.
     свет          точечный тёплый свет у сопел и холодный лунный сверху
                   слева: пламя освещает низ корпуса, луна - кромку.

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
    function держать(x) { всё.push(x); return x; }

    /* ── ОБЩИЙ ШУМ ДЛЯ ШЕЙДЕРОВ ОГНЯ И ДЫМА ─────────────────────────
       Значение шума в узлах решётки и плавная склейка между ними, сверху
       пять октав. Пламя без шума читается градиентом, а шум в одну
       октаву - кипящей кашей: огонь живёт на трёх-пяти масштабах разом. */
    var ШУМ = [
      "float hash(vec2 p){ p = fract(p*vec2(123.34, 456.21)); p += dot(p, p+45.32); return fract(p.x*p.y); }",
      "float noise(vec2 p){ vec2 i = floor(p), f = fract(p); vec2 u = f*f*(3.0-2.0*f);",
      "  return mix(mix(hash(i), hash(i+vec2(1,0)), u.x), mix(hash(i+vec2(0,1)), hash(i+vec2(1,1)), u.x), u.y); }",
      "float fbm(vec2 p){ float s = 0.0, a = .5; for (int i = 0; i < 5; i++){ s += a*noise(p); p = p*2.03 + 17.1; a *= .5; } return s; }"
    ].join("\n");

    /* ── ПОДЛОЖКА ─────────────────────────────────────────────────── */
    var подложкаМат = держать(new T.MeshBasicMaterial({ color: 0xffffff, depthWrite: false }));
    подложкаМат.color.setScalar(.62);
    var подложка = new T.Mesh(держать(new T.PlaneGeometry(1, 1)), подложкаМат);
    подложка.position.z = -1500;
    сцена.add(подложка);
    var пропорцияПодложки = 2160 / 3840;
    о.загрузить("ассеты/мир/ракета/облака-ночь.webp").then(function (т) {
      держать(т);
      подложкаМат.map = т;
      подложкаМат.needsUpdate = true;
    }).catch(function () {});

    /* Подсветка облаков под факелом: тёплое пятно, которое дышит вместе
       с пламенем. Облака на подложке уже освещены, но статично; живой
       огонь обязан живо их и подсвечивать, иначе факел висит отдельно. */
    var засветМат = держать(new T.ShaderMaterial({
      uniforms: { uTime: { value: 0 }, uPower: { value: 1 } },
      vertexShader: "varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.0); }",
      fragmentShader: [
        "uniform float uTime, uPower; varying vec2 vUv;",
        "void main(){",
        "  vec2 d = vUv - .5; float r = length(d*vec2(1.0, 1.35));",
        "  float g = exp(-r*r*9.0) * (1.0 - smoothstep(.36, .5, max(abs(d.x), abs(d.y))));",
        "  float f = .86 + .14*sin(uTime*23.0) * sin(uTime*7.3 + 1.7);",
        "  vec3 c = vec3(1.0, .42, .12) * g * .14 * uPower * f;",
        "  gl_FragColor = vec4(c, 1.0);",
        "}"
      ].join("\n"),
      blending: T.AdditiveBlending, transparent: true, depthWrite: false
    }));
    var засвет = new T.Mesh(держать(new T.PlaneGeometry(1, 1)), засветМат);
    засвет.position.z = -1400;
    сцена.add(засвет);

    /* ── ЗВЁЗДЫ, КОТОРЫЕ МЕРЦАЮТ ───────────────────────────────────── */
    var ЗВЁЗД = 160;
    var звГеом = держать(new T.BufferGeometry());
    var звПоз = new Float32Array(ЗВЁЗД * 3), звСид = new Float32Array(ЗВЁЗД);
    for (var i = 0; i < ЗВЁЗД; i++) {
      звПоз[i*3] = Math.random(); звПоз[i*3+1] = Math.random() * .52; звПоз[i*3+2] = -1300;
      звСид[i] = Math.random();
    }
    звГеом.setAttribute("position", new T.BufferAttribute(звПоз, 3));
    звГеом.setAttribute("seed", new T.BufferAttribute(звСид, 1));
    var звМат = держать(new T.ShaderMaterial({
      uniforms: { uTime: { value: 0 }, uSize: { value: new T.Vector2(430, 932) }, uPx: { value: 2 } },
      vertexShader: [
        "attribute float seed; uniform float uTime, uPx; uniform vec2 uSize; varying float vA;",
        "void main(){",
        "  vec3 p = vec3(position.x*uSize.x, -position.y*uSize.y, position.z);",
        "  vA = (.35 + .65*fract(seed*91.7)) * (.55 + .45*sin(uTime*(1.2 + seed*2.6) + seed*40.0));",
        "  gl_PointSize = (1.1 + 1.6*fract(seed*37.1)) * uPx;",
        "  gl_Position = projectionMatrix*modelViewMatrix*vec4(p, 1.0);",
        "}"
      ].join("\n"),
      fragmentShader: [
        "varying float vA;",
        "void main(){ vec2 d = gl_PointCoord - .5; float r = length(d); float a = (1.0 - smoothstep(.0, .5, r));",
        "  gl_FragColor = vec4(vec3(.85, .9, 1.0) * a * vA * 1.4, 1.0); }"
      ].join("\n"),
      blending: T.AdditiveBlending, transparent: true, depthWrite: false
    }));
    var звёзды = new T.Points(звГеом, звМат);
    звёзды.frustumCulled = false;
    сцена.add(звёзды);

    /* ── РАКЕТА ──────────────────────────────────────────────────────
       Корпус - тело вращения по профилю: обтекатель огивой, цилиндр,
       межступенчатое кольцо, юбка. Боковые ускорители - то же, короче и
       со своими носами. Размеры в долях длины L, сама L ставится по
       якорям в раскладке. */
    var ракета = new T.Group();
    var корпус = new T.Group();
    ракета.add(корпус);
    сцена.add(ракета);

    /* Карта окружения: маленькая сцена-градиент, снизу оранжевая от
       пламени, сверху тёмно-синяя ночь, сбоку холодное лунное пятно.
       Без неё металл плоский: ему нечего отражать. */
    var окружение = (function () {
      var ос = new T.Scene();
      var сфера = new T.Mesh(new T.SphereGeometry(10, 32, 16), new T.ShaderMaterial({
        side: T.BackSide,
        vertexShader: "varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.0); }",
        fragmentShader: [
          "varying vec3 vP;",
          "void main(){",
          "  float y = vP.y;",
          "  vec3 night = mix(vec3(.02,.03,.07), vec3(.06,.09,.2), smoothstep(-.1, .9, y));",
          "  vec3 fire = vec3(2.4, .9, .25) * smoothstep(.0, -.9, y);",
          "  float moon = pow(max(dot(vP, normalize(vec3(-.6, .55, .6))), 0.0), 40.0) * 3.0;",
          "  gl_FragColor = vec4(night + fire + vec3(.75,.82,1.0)*moon, 1.0);",
          "}"
        ].join("\n")
      }));
      ос.add(сфера);
      var пм = new T.PMREMGenerator(о.рендерер);
      var ц = пм.fromScene(ос, 0.02);
      сфера.geometry.dispose(); сфера.material.dispose(); пм.dispose();
      return ц;
    })();
    держать(окружение);

    var металл = держать(new T.MeshStandardMaterial({
      color: 0xc9ced8, metalness: .82, roughness: .24, envMap: окружение.texture, envMapIntensity: 1.5
    }));
    var тёмный = держать(new T.MeshStandardMaterial({
      color: 0x1b202b, metalness: .7, roughness: .38, envMap: окружение.texture, envMapIntensity: .9
    }));
    var индиго = держать(new T.MeshStandardMaterial({
      color: 0x5b5bf0, metalness: .35, roughness: .3, emissive: 0x2a2ab8, emissiveIntensity: .35,
      envMap: окружение.texture, envMapIntensity: .8
    }));
    var сопло = держать(new T.MeshStandardMaterial({
      color: 0x2a2f3a, metalness: .92, roughness: .3, envMap: окружение.texture,
      emissive: 0xff5a1a, emissiveIntensity: .0, side: T.DoubleSide
    }));

    function профиль(точки) {
      return точки.map(function (p) { return new T.Vector2(p[0], p[1]); });
    }
    /* Все профили в единицах «радиус ступени = 1, длина по y». */
    var профильЯдра = профиль([
      [0.00, 9.60], [0.18, 9.50], [0.42, 9.25], [0.66, 8.90], [0.86, 8.45], [0.97, 8.00],
      [1.00, 7.70], [1.00, 1.10], [1.04, 1.00], [1.04, 0.72], [0.96, 0.60], [0.92, 0.00]
    ]);
    var профильБокового = профиль([
      [0.00, 7.35], [0.30, 7.15], [0.62, 6.80], [0.86, 6.40], [0.98, 6.00],
      [1.00, 5.75], [1.00, 0.95], [1.03, 0.85], [1.03, 0.62], [0.95, 0.50], [0.90, 0.00]
    ]);
    var профильСопла = профиль([[0.30, 0.00], [0.34, -0.12], [0.48, -0.42], [0.62, -0.70], [0.70, -0.82]]);

    var геомЯдро = держать(new T.LatheGeometry(профильЯдра, 48));
    var геомБок = держать(new T.LatheGeometry(профильБокового, 40));
    var геомСопло = держать(new T.LatheGeometry(профильСопла, 28));
    var геомПолоса = держать(new T.CylinderGeometry(1.015, 1.015, .22, 48, 1, true));
    var геомКольцо = держать(new T.CylinderGeometry(1.03, 1.03, .34, 48, 1, true));
    var геомОпора = держать(new T.BoxGeometry(.16, 1.1, .16));

    function ступень(геом, сПолосой) {
      var гр = new T.Group();
      гр.add(new T.Mesh(геом, металл));
      if (сПолосой) {
        var п = new T.Mesh(геомПолоса, индиго); п.position.y = 6.2; гр.add(п);
        var к = new T.Mesh(геомКольцо, тёмный); к.position.y = 4.4; гр.add(к);
      } else {
        var к2 = new T.Mesh(геомКольцо, тёмный); к2.position.y = 5.0; к2.scale.set(1, .6, 1); гр.add(к2);
      }
      var с = new T.Mesh(геомСопло, сопло); гр.add(с);
      for (var i = 0; i < 3; i++) {
        var оп = new T.Mesh(геомОпора, тёмный);
        var у = i / 3 * Math.PI * 2 + .4;
        оп.position.set(Math.cos(у) * .95, .45, Math.sin(у) * .95);
        оп.rotation.z = Math.cos(у) * .25; оп.rotation.x = -Math.sin(у) * .25;
        гр.add(оп);
      }
      return гр;
    }
    var ядро = ступень(геомЯдро, true);
    var левый = ступень(геомБок, false);
    var правый = ступень(геомБок, false);
    левый.position.set(-2.08, 0, 0);
    правый.position.set(2.08, 0, 0);
    корпус.add(ядро); корпус.add(левый); корпус.add(правый);
    /* Лёгкий поворот к зрителю: иначе ракета стоит строго в профиль и
       теряет объём - свет ложится одинаково на все три ступени. */
    корпус.rotation.y = -.38;

    var луна = new T.DirectionalLight(0xa9bcff, 1.35);
    луна.position.set(-1, 1.2, 1.4);
    сцена.add(луна);
    var небо = new T.HemisphereLight(0x1a2448, 0x3a1608, .28);
    сцена.add(небо);
    var жар = new T.PointLight(0xff7a2e, 0, 0, 0);
    сцена.add(жар);
    /* Контровой холодный свет справа сзади: обводит правый край корпуса
       тонкой линией, и тело отделяется от неба. Без него металл на
       тёмном фоне сливался в плоскую бледную заливку. */
    var контр = new T.DirectionalLight(0x8fb0ff, 2.2);
    контр.position.set(1.6, .5, -.6);
    сцена.add(контр);

    /* ── ФАКЕЛ: ЛЕНТА ВДОЛЬ КРИВОЙ ────────────────────────────────────
       Кривая Безье от сопел до входа в столбец пингов, касательные на
       обоих концах вертикальные: пламя вырывается из сопел вниз и входит
       в столбец вниз, без излома на стыке со следом интерфейса.

       Лента строится заново только при смене якорей: она дешёвая (две
       сотни треугольников), а форма огня живёт в шейдере. */
    var КУСКОВ = 96;
    function лента(ширинаОт, ширинаДо) {
      var г = new T.BufferGeometry();
      var поз = new Float32Array((КУСКОВ + 1) * 2 * 3);
      var уф = new Float32Array((КУСКОВ + 1) * 2 * 2);
      var инд = [];
      for (var i = 0; i < КУСКОВ; i++) {
        var а = i * 2, б = а + 1, в = а + 2, гг = а + 3;
        инд.push(а, в, б, б, в, гг);
      }
      for (var j = 0; j <= КУСКОВ; j++) {
        уф[j*4] = 0; уф[j*4+1] = j / КУСКОВ;
        уф[j*4+2] = 1; уф[j*4+3] = j / КУСКОВ;
      }
      г.setAttribute("position", new T.BufferAttribute(поз, 3));
      г.setAttribute("uv", new T.BufferAttribute(уф, 2));
      г.setIndex(инд);
      г.userData = { от: ширинаОт, до: ширинаДо };
      return держать(г);
    }

    /* Огонь.
       uv.x поперёк ленты (0..1), uv.y вдоль (0 у сопла, 1 у входа в
       список). Турбулентность течёт ОТ сопла: координата шума едет по y
       со временем. У сопла узкое белое ядро ярче единицы с ударными
       ромбами (яркость пульсирует вдоль оси), дальше жёлтое и оранжевое
       тело, к концу красное и тонкое - оно и становится струёй искр
       следа. uBoost поднимает всё при ударе и подключении. */
    var огоньМат = держать(new T.ShaderMaterial({
      uniforms: { uTime: { value: 0 }, uBoost: { value: 1 } },
      vertexShader: "varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.0); }",
      fragmentShader: [
        "uniform float uTime, uBoost; varying vec2 vUv;",
        ШУМ,
        "void main(){",
        "  float a = vUv.y;",
        "  float x = vUv.x*2.0 - 1.0;",
        "  vec2 q = vec2(x*1.7, a*7.0 - uTime*4.2);",
        "  float w = fbm(q*1.4 + vec2(0.0, fbm(q*2.1 + uTime*.9)*1.3));",
        "  float lick = fbm(vec2(x*3.0, a*16.0 - uTime*7.5));",
        "  float edge = abs(x) + (w - .5)*.9*smoothstep(.02, .3, a);",
        "  float body = (1.0 - smoothstep(.15, 1.0, edge));",
        "  float core = exp(-x*x*18.0) * (1.0 - smoothstep(.0, .34, a));",
        "  float shock = .75 + .25*sin(a*120.0 - uTime*2.0) * (1.0 - smoothstep(.0, .12, a));",
        "  vec3 hot  = vec3(1.0, .93, .78) * 7.5 * shock;",
        "  vec3 yel  = vec3(1.0, .72, .28) * 3.2;",
        "  vec3 org  = vec3(1.0, .42, .10) * 1.7;",
        "  vec3 red  = vec3(.75, .16, .04) * .8;",
        "  vec3 c = mix(red, org, smoothstep(.15, .6, w*body));",
        "  c = mix(c, yel, smoothstep(.55, .9, w*body) * (1.0 - smoothstep(.2, .7, a)));",
        "  c = mix(c, hot, core);",
        "  float fade = 1.0 - smoothstep(.42, 1.0, a);",
        "  float bright = body * (.5 + .55*lick) * fade * (1.0 - .45*smoothstep(.3, .8, a)) + core*.9;",
        "  gl_FragColor = vec4(c * bright * uBoost, 1.0);",
        "}"
      ].join("\n"),
      blending: T.AdditiveBlending, transparent: true, depthWrite: false, depthTest: false,
      side: T.DoubleSide
    }));

    /* Дым: шире огня, обычное смешивание, тёмно-серый с рыжей подсветкой
       снизу. Клубится медленнее пламени - дым тяжелее огня. */
    var дымМат = держать(new T.ShaderMaterial({
      uniforms: { uTime: { value: 0 }, uBoost: { value: 1 } },
      vertexShader: "varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.0); }",
      fragmentShader: [
        "uniform float uTime, uBoost; varying vec2 vUv;",
        ШУМ,
        "void main(){",
        "  float a = vUv.y, x = vUv.x*2.0 - 1.0;",
        "  vec2 q = vec2(x*1.3, a*4.2 - uTime*1.3);",
        "  float n = fbm(q + vec2(fbm(q*1.6 - uTime*.25), 0.0));",
        "  float body = 1.0 - smoothstep(.25, 1.0, abs(x) + (n - .5)*.8);",
        "  float fade = smoothstep(.0, .12, a) * (1.0 - smoothstep(.55, .98, a));",
        "  float alpha = body * fade * smoothstep(.3, .75, n) * .62;",
        "  vec3 lit = mix(vec3(.05,.05,.06), vec3(.95,.38,.12)*uBoost, (1.0 - a) * .35 * n);",
        "  gl_FragColor = vec4(lit, alpha);",
        "}"
      ].join("\n"),
      transparent: true, depthWrite: false, depthTest: false, side: T.DoubleSide
    }));

    var геомОгня = лента(1, 1), геомДыма = лента(1, 1);
    var дым = new T.Mesh(геомДыма, дымМат); дым.frustumCulled = false; дым.renderOrder = 1;
    var огонь = new T.Mesh(геомОгня, огоньМат); огонь.frustumCulled = false; огонь.renderOrder = 3;
    дым.position.z = 10; огонь.position.z = 20;
    сцена.add(дым); сцена.add(огонь);

    /* Короткие факелы трёх сопел: у самого среза каждое сопло горит
       своим пламенем и только ниже они сливаются в общую ленту. Без этого
       огонь выглядит одной трубой, приклеенной к корпусу. */
    var факелМат = держать(new T.ShaderMaterial({
      uniforms: { uTime: { value: 0 }, uBoost: { value: 1 }, uSeed: { value: 0 } },
      vertexShader: "varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.0); }",
      fragmentShader: [
        "uniform float uTime, uBoost, uSeed; varying vec2 vUv;",
        ШУМ,
        "void main(){",
        "  float a = 1.0 - vUv.y, x = vUv.x*2.0 - 1.0;",
        "  float n = fbm(vec2(x*2.0 + uSeed, a*5.0 - uTime*6.0));",
        "  float wdt = mix(.28, 1.0, smoothstep(.0, .7, a));",
        "  float body = 1.0 - smoothstep(0.0, 1.0, abs(x)/wdt + (n - .5)*.5);",
        "  float fade = 1.0 - smoothstep(.45, 1.0, a);",
        "  vec3 c = mix(vec3(1.0,.55,.16)*2.2, vec3(1.0,.95,.85)*8.0, exp(-x*x*9.0/(wdt*wdt)) * (1.0 - smoothstep(.0, .5, a)));",
        "  gl_FragColor = vec4(c * body * fade * uBoost, 1.0);",
        "}"
      ].join("\n"),
      blending: T.AdditiveBlending, transparent: true, depthWrite: false, depthTest: false
    }));
    var геомФакела = держать(new T.PlaneGeometry(1, 1));
    var факелы = [0, 1, 2].map(function (i) {
      var м = факелМат.clone(); держать(м);
      м.uniforms.uSeed.value = i * 3.7;
      var ф = new T.Mesh(геомФакела, м);
      ф.renderOrder = 4; ф.position.z = 30; ф.frustumCulled = false;
      сцена.add(ф);
      return ф;
    });

    /* Свечение у сопел: большое мягкое пятно ярче единицы. Из него
       движок делает свечение объектива, и низ ракеты тонет в свете. */
    var сияниеМат = держать(new T.ShaderMaterial({
      uniforms: { uTime: { value: 0 }, uBoost: { value: 1 } },
      vertexShader: "varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.0); }",
      fragmentShader: [
        "uniform float uTime, uBoost; varying vec2 vUv;",
        "void main(){ vec2 d = vUv - .5; float r = length(d);",
        "  float g = (exp(-r*r*30.0)*.95 + exp(-r*r*7.0)*.22) * (1.0 - smoothstep(.28, .5, r));",
        "  float f = .9 + .1*sin(uTime*31.0)*sin(uTime*11.0);",
        "  gl_FragColor = vec4(vec3(1.0,.55,.2) * g * uBoost * f, 1.0); }"
      ].join("\n"),
      blending: T.AdditiveBlending, transparent: true, depthWrite: false, depthTest: false
    }));
    var сияние = new T.Mesh(держать(new T.PlaneGeometry(1, 1)), сияниеМат);
    сияние.renderOrder = 5; сияние.position.z = 40; сияние.frustumCulled = false;
    сцена.add(сияние);

    /* ── ИСКРЫ ────────────────────────────────────────────────────────
       Каждая искра - точка на той же кривой, что и факел: у неё свой
       сдвиг по времени, своя скорость и свой разлёт поперёк. Возраст
       считается как дробная часть от времени, поэтому искры бесконечно
       рождаются у сопел и гаснут у списка, и ни одна не копит состояние. */
    var ИСКР = 520;
    var искГеом = держать(new T.BufferGeometry());
    var искСид = new Float32Array(ИСКР * 4);
    var искПоз = new Float32Array(ИСКР * 3);
    for (var k = 0; k < ИСКР; k++) {
      искСид[k*4] = Math.random(); искСид[k*4+1] = Math.random();
      искСид[k*4+2] = Math.random(); искСид[k*4+3] = Math.random();
    }
    искГеом.setAttribute("position", new T.BufferAttribute(искПоз, 3));
    искГеом.setAttribute("seed", new T.BufferAttribute(искСид, 4));
    var искМат = держать(new T.ShaderMaterial({
      uniforms: {
        uTime: { value: 0 }, uBoost: { value: 1 }, uPx: { value: 2 },
        uP0: { value: new T.Vector2() }, uP1: { value: new T.Vector2() },
        uP2: { value: new T.Vector2() }, uP3: { value: new T.Vector2() },
        uW0: { value: 10 }, uW1: { value: 30 }
      },
      vertexShader: [
        "attribute vec4 seed;",
        "uniform float uTime, uBoost, uPx, uW0, uW1;",
        "uniform vec2 uP0, uP1, uP2, uP3;",
        "varying float vAge; varying float vHeat;",
        "vec2 bez(float s){ float g = 1.0 - s; return g*g*g*uP0 + 3.0*g*g*s*uP1 + 3.0*g*s*s*uP2 + s*s*s*uP3; }",
        "vec2 tang(float s){ float g = 1.0 - s; return normalize(3.0*g*g*(uP1-uP0) + 6.0*g*s*(uP2-uP1) + 3.0*s*s*(uP3-uP2)); }",
        "void main(){",
        "  float life = mix(.9, 2.4, seed.x);",
        "  float age = fract(uTime/life + seed.y);",
        "  float reach = mix(.55, 1.08, seed.z);",
        "  float s = age * reach;",
        "  vec2 c = bez(min(s, 1.0));",
        "  vec2 t = tang(min(s, .999));",
        "  vec2 n = vec2(-t.y, t.x);",
        "  float spread = (seed.w - .5) * mix(uW0, uW1, s) * (1.3 + .7*seed.x);",
        "  float wob = sin(uTime*(3.0 + seed.x*5.0) + seed.w*30.0) * 4.0 * s;",
        "  vec2 p = c + n*(spread + wob) + vec2(0.0, -max(s - 1.0, 0.0)*60.0);",
        "  vAge = age; vHeat = 1.0 - s;",
        "  gl_PointSize = (.9 + 1.6*seed.w*seed.x + .8*(1.0 - s)) * uPx * (.8 + .4*uBoost);",
        "  gl_Position = projectionMatrix*viewMatrix*vec4(p, 50.0, 1.0);",
        "}"
      ].join("\n"),
      fragmentShader: [
        "uniform float uBoost; varying float vAge; varying float vHeat;",
        "void main(){",
        "  vec2 d = gl_PointCoord - .5; float r = length(d);",
        "  float a = (1.0 - smoothstep(.0, .5, r));",
        "  vec3 c = mix(vec3(.9,.2,.04), vec3(1.0,.62,.2), smoothstep(.1, .6, vHeat));",
        "  c = mix(c, vec3(1.0,.95,.8), smoothstep(.75, 1.0, vHeat));",
        "  float fade = (1.0 - smoothstep(.7, 1.0, vAge)) * smoothstep(.0, .04, vAge);",
        "  gl_FragColor = vec4(c * a * fade * (1.6 + 2.2*vHeat) * uBoost, 1.0);",
        "}"
      ].join("\n"),
      blending: T.AdditiveBlending, transparent: true, depthWrite: false, depthTest: false
    }));
    var искры = new T.Points(искГеом, искМат);
    искры.frustumCulled = false; искры.renderOrder = 6;
    сцена.add(искры);

    /* ── РАСКЛАДКА ОТ ЯКОРЕЙ ───────────────────────────────────────── */
    var раскладка = { ш: 0, в: 0, кх: 0, ку: 0, кр: 0, ось: 0, сп: 0, ok: false };
    var кривая = { p0: new T.Vector2(), p1: new T.Vector2(), p2: new T.Vector2(), p3: new T.Vector2() };
    var сопла = [new T.Vector2(), new T.Vector2(), new T.Vector2()];

    function взятьЯкоря() {
      var к = я.кнопка, с = я.список;
      /* Кнопки нет на экране (другой раздел) - держим прежнюю композицию:
         прыжок ракеты при переходе на «Серверы» выглядел бы поломкой. */
      if (!к.видна && раскладка.ok) return false;
      var новая = {
        ш: я.ширина, в: я.высота,
        кх: к.видна ? к.x : я.ширина / 2,
        ку: к.видна ? к.y : я.высота * .157,
        кр: к.видна ? к.r : я.высота * .079,
        ось: с.видна ? с.ось : я.ширина * .85,
        сп: с.видна ? с.y : я.высота * .455
      };
      var сдвиг = Math.abs(новая.ш - раскладка.ш) + Math.abs(новая.в - раскладка.в) +
        Math.abs(новая.кх - раскладка.кх) + Math.abs(новая.ку - раскладка.ку) +
        Math.abs(новая.кр - раскладка.кр) + Math.abs(новая.ось - раскладка.ось) + Math.abs(новая.сп - раскладка.сп);
      if (раскладка.ok && сдвиг < 2) return false;
      for (var ключ in новая) раскладка[ключ] = новая[ключ];
      раскладка.ok = true;
      return true;
    }

    function заполнитьЛенту(г, ширинаОт, ширинаДо, выпуклость) {
      var поз = г.attributes.position.array;
      var P0 = кривая.p0, P1 = кривая.p1, P2 = кривая.p2, P3 = кривая.p3;
      for (var j = 0; j <= КУСКОВ; j++) {
        var s = j / КУСКОВ, g = 1 - s;
        var x = g*g*g*P0.x + 3*g*g*s*P1.x + 3*g*s*s*P2.x + s*s*s*P3.x;
        var y = g*g*g*P0.y + 3*g*g*s*P1.y + 3*g*s*s*P2.y + s*s*s*P3.y;
        var tx = 3*g*g*(P1.x-P0.x) + 6*g*s*(P2.x-P1.x) + 3*s*s*(P3.x-P2.x);
        var ty = 3*g*g*(P1.y-P0.y) + 6*g*s*(P2.y-P1.y) + 3*s*s*(P3.y-P2.y);
        var дл = Math.hypot(tx, ty) || 1;
        var nx = -ty / дл, ny = tx / дл;
        /* Ширина быстро растёт от сопел, держится в середине и к списку
           сужается до шестой части: там огонь становится струёй следа. */
        var рост = s < .32 ? (s / .32) * (s / .32) * (3 - 2 * s / .32) : 1;
        var хвост = s > .55 ? Math.min(1, (s - .55) / .45) : 0;
        хвост = хвост * хвост * (3 - 2 * хвост);
        var ш = ширинаОт + (ширинаДо - ширинаОт) * рост * (1 - хвост * .84) * (1 + выпуклость * .15 * Math.sin(Math.PI * s));
        поз[j*6]   = x - nx * ш / 2; поз[j*6+1] = y - ny * ш / 2; поз[j*6+2] = 0;
        поз[j*6+3] = x + nx * ш / 2; поз[j*6+4] = y + ny * ш / 2; поз[j*6+5] = 0;
      }
      г.attributes.position.needsUpdate = true;
      г.computeBoundingSphere();
    }

    function построить() {
      var Ш = раскладка.ш, В = раскладка.в, р = раскладка.кр;
      камера.left = 0; камера.right = Ш; камера.top = 0; камера.bottom = -В;
      камера.updateProjectionMatrix();

      /* Подложка по высоте экрана, правым краем к правому краю: светлая
         сторона облаков стоит под факелом, тёмная уходит за кнопку. */
      var пв = В * 1.03, пш = пв * пропорцияПодложки;
      if (пш < Ш) { пш = Ш * 1.03; пв = пш / пропорцияПодложки; }
      подложка.scale.set(пш, пв, 1);
      подложка.position.x = Ш - пш / 2 + Ш * .01;
      подложка.position.y = -В / 2;

      /* Ракета. Центр корпуса правее кнопки на два её радиуса, нос у
         верхнего края, сопла чуть ниже центра кнопки. На узком экране
         ракета не вылезает за край: центр прижат с запасом в полкорпуса. */
      var носY = В * .05, соплоY = раскладка.ку + р * .25;
      var L = соплоY - носY;
      var масштаб = L / 9.6;                 /* профиль ядра длиной 9.6 */
      var полШирины = 3.1 * масштаб;         /* ядро плюс ускорители */
      var цх = Math.min(раскладка.кх + р * 2.05, Ш - полШирины - 6);
      цх = Math.max(цх, раскладка.кх + р + полШирины + 10);
      раскладка.рх = цх;
      ракета.position.set(цх, -соплоY, 100);
      ракета.scale.setScalar(масштаб);

      /* Сопла в css-точках: ядро и два ускорителя, с учётом поворота. */
      var cosУ = Math.cos(корпус.rotation.y);
      var смещ = 2.08 * масштаб * cosУ;
      var срез = .82 * масштаб;
      сопла[0].set(цх, соплоY + срез);
      сопла[1].set(цх - смещ, соплоY + срез);
      сопла[2].set(цх + смещ, соплоY + срез);

      /* Кривая факела: от сопел вниз, к оси пингов у верхней строки. */
      var вход = { x: раскладка.ось, y: раскладка.сп };
      var старт = { x: цх, y: соплоY + срез * 1.2 };
      var дл = вход.y - старт.y;
      кривая.p0.set(старт.x, -старт.y);
      кривая.p1.set(старт.x, -(старт.y + дл * .45));
      кривая.p2.set(вход.x, -(вход.y - дл * .38));
      кривая.p3.set(вход.x, -вход.y);

      var ширСопел = смещ * 2 + 2.2 * масштаб;
      заполнитьЛенту(геомОгня, ширСопел * .9, ширСопел * 2.6, .55);
      заполнитьЛенту(геомДыма, ширСопел * 1.6, ширСопел * 5.2, .8);

      факелы.forEach(function (ф, i) {
        var дл2 = (i === 0 ? 2.6 : 2.2) * масштаб * 3.2;
        ф.scale.set(1.5 * масштаб * (i === 0 ? 1.1 : .95), дл2, 1);
        ф.position.set(сопла[i].x, -(сопла[i].y + дл2 / 2), 30);
      });
      /* Свечение меньше и ниже сопел: крупное и по центру ракеты оно
         заливало корпус рыжим светом, и металл терял форму. */
      сияние.scale.set(ширСопел * 2.3, ширСопел * 2.3, 1);
      сияние.position.set(цх, -(соплоY + срез * 3.6), 40);

      засвет.scale.set(Ш * 1.2, В * .7, 1);
      засвет.position.set(Ш * .8, -(раскладка.сп + В * .16), -1400);

      жар.position.set(цх, -(соплоY + срез * 3), 160);
      жар.distance = L * 1.8;

      var у = искМат.uniforms;
      у.uP0.value.copy(кривая.p0); у.uP1.value.copy(кривая.p1);
      у.uP2.value.copy(кривая.p2); у.uP3.value.copy(кривая.p3);
      у.uW0.value = ширСопел * .35; у.uW1.value = ширСопел * 1.1;

      звМат.uniforms.uSize.value.set(Ш, В);
    }

    /* ── СОБЫТИЯ ИНТЕРФЕЙСА ──────────────────────────────────────────
       Всё от времени события, а не от счётчиков кадров: замороженный
       кадр для раскадровки обязан совпасть с живым. */
    var событие = { удар: -99, ряд: -99, подключено: false, подкл: -99 };

    function форсаж(t) {
      var u = t - событие.удар;
      var f = u >= 0 && u < 1.2 ? Math.sin(Math.min(1, u / .12) * Math.PI / 2) * (1 - smooth(.35, 1.2, u)) : 0;
      var р = t - событие.ряд;
      var fr = р >= 0 && р < .35 ? (1 - р / .35) * .25 : 0;
      var постоянный = событие.подключено ? .22 * Math.min(1, (t - событие.подкл) / .8) : 0;
      return 1 + f * .75 + fr + постоянный;
    }
    function smooth(а, б, x) { var k = Math.min(1, Math.max(0, (x - а) / (б - а))); return k * k * (3 - 2 * k); }

    var tПоследнее = 0;

    о.линза([1.0, .45, .18], 1);
    о.свечение(1.05, 1.0);

    if (window.МИР_ОТЛАДКА) window.МИР_ОТЛАДКА.ракета = { огонь: огонь, геом: геомОгня, кривая: кривая, раскладка: раскладка };
    return {
      сцена: сцена,
      камера: камера,

      кадр: function (t) {
        tПоследнее = t;
        if (взятьЯкоря()) построить();
        var б = форсаж(t);
        /* Мелкая дрожь корпуса от тяги, не больше полуточки: крупнее
           она читается тряской камеры, а не работой двигателя. */
        ракета.position.x = раскладка.рх + .45 * Math.sin(t * 63.0) * Math.sin(t * 17.0);

        огоньМат.uniforms.uTime.value = t; огоньМат.uniforms.uBoost.value = б;
        дымМат.uniforms.uTime.value = t; дымМат.uniforms.uBoost.value = б;
        факелы.forEach(function (ф) { ф.material.uniforms.uTime.value = t; ф.material.uniforms.uBoost.value = б; });
        сияниеМат.uniforms.uTime.value = t; сияниеМат.uniforms.uBoost.value = б;
        искМат.uniforms.uTime.value = t; искМат.uniforms.uBoost.value = б;
        искМат.uniforms.uPx.value = я.dpr;
        звМат.uniforms.uTime.value = t; звМат.uniforms.uPx.value = я.dpr;
        засветМат.uniforms.uTime.value = t; засветМат.uniforms.uPower.value = б;
        сопло.emissiveIntensity = .9 * б;
        жар.intensity = 2.6 * б * (.9 + .1 * Math.sin(t * 29.0));
        /* подложка еле дышит по вертикали: стоячий кадр за живым огнём
           читался бы наклейкой */
        подложка.position.y = -раскладка.в / 2 + Math.sin(t * .21) * 3.0;
      },

      размер: function () { раскладка.ok = false; взятьЯкоря(); построить(); },

      /* Исток следа - то место, где факел входит в столбец пингов: огонь
         уже стёк туда сам, и интерфейс продолжает его по строкам прямо с
         этой точки, без подвода. */
      источник: function () {
        return { x: раскладка.ось, y: раскладка.сп - 2 };
      },

      событие: function (имя, д) {
        if (имя === "удар" && д && д.фаза === "начало") событие.удар = tПоследнее;
        else if (имя === "ряд" && д && д.живой) событие.ряд = tПоследнее;
        else if (имя === "подключено") { событие.подключено = true; событие.подкл = tПоследнее; }
        else if (имя === "отключено") событие.подключено = false;
      },

      уничтожить: function () {
        всё.forEach(function (x) { try { x.dispose(); } catch (е) {} });
        всё.length = 0;
      }
    };
  });
})();
