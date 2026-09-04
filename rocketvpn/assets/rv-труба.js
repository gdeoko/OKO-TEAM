/* Rocket VPN. Труба прокола: устройство снято с igloo.inc по числам.

   ЗАЧЕМ ЭТОТ ФАЙЛ. Владелец повторил трижды: «ТУНЕЛЬ 1:1 - igloo должен
   быть». Прежний тоннель у нас собирался из полусотни повторяющихся
   колец обшивки, и он честно читался коридором из колец. У них устроено
   иначе, и разница принципиальная.

   ЧТО У НИХ (разбор их боевого кода, docs/РАЗБОР-IGLOO-ДВИЖЕНИЕ.md):

   1. ТРУБА ОДНА. Цилиндр радиусом 1.3 и длиной 9, 64 сегмента по кругу и
      32 по высоте, без крышек, ВЫВЕРНУТЫЙ НАИЗНАНКУ масштабом -1 по X.
      Никаких повторяющихся колец. Стенка не имеет своей текстуры вовсе:
      весь рисунок это три выборки ОДНОГО шума ветра на масштабах 3, 4 и
      6, перемноженные, потом куб альфы и умножение на три. Складывается
      аддитивно. От перемножения трёх выборок получаются редкие яркие
      прожилки вместо ровной мути: там, где все три совпали, ярко, где
      хоть одна провалилась, пусто.

   2. КОЛЕЦ-ПРОЛОМОВ ТРИ, они лежат ПЛАШМЯ поперёк трубы на высотах
      -1.65, -4.15 и -6.65, то есть с шагом 2.5. Камера проходит их
      насквозь одно за другим.

   3. ГЛАВНОЕ: КОЛЬЦО РАЗЛЕТАЕТСЯ ОТ РАССТОЯНИЯ ДО КАМЕРЫ, а не по
      таймлайну. Ни одного твина. Осколок отъезжает на 7.5-15 процентов
      своего центроида, дышит ещё на пять, поворачивается вокруг
      случайной оси и вместе со всем кольцом закручивается до 54 градусов
      по двум плоскостям. Всё это функции расстояния, поэтому кольцо
      живёт от того, КАК ЧЕЛОВЕК К НЕМУ ЕДЕТ, а не от того, сколько
      прошло секунд. Отмотал назад - кольцо собралось обратно.

   4. КОЛЬЦО НЕ ВКЛЮЧАЕТСЯ, А ПРОСТУПАЕТ. Оно подмешивается к тому же
      экранному градиенту, которым красится небо, и всплывает из фона
      примерно с шестнадцати единиц.

   ЧТО ЗДЕСЬ НАШЕ. Их моделей у нас нет и быть не может: это чужая
   работа. Осколок кольца собирается своей геометрией - дуга сектора с
   толщиной, и таких секторов двадцать восемь с неровными зазорами.
   Механика движения повторена по числам, форма своя.

   ПОЧЕМУ РАССТОЯНИЕ СЧИТАЕТСЯ В ВЕРШИННОМ ШЕЙДЕРЕ. Осколков под сотню на
   кольцо, и считать им матрицы в JS значит гонять три сотни матриц
   каждый кадр. У них это делает видеокарта, и у нас будет так же:
   положение экземпляра приходит атрибутом, расстояние берётся от него до
   камеры прямо в шейдере. */
(function (g, d) {
  "use strict";

  var М = {};
  var T = null, W = null;
  var собрано = false;

  /* ── Шум ветра ────────────────────────────────────────────────
     У них лежит готовая карта 256x256, которой красятся и дым, и позёмка,
     и стенка трубы. У нас такая же роль у шума Луны; если его нет (акт
     Луны не поднялся), печатаем свой такой же величины. */
  function шум() {
    if (g.RV_ЛУНА && g.RV_ЛУНА["шум"]) {
      var ш = g.RV_ЛУНА["шум"]();
      if (ш) return ш;
    }
    var Р = 256;
    var х = d.createElement("canvas");
    х.width = х.height = Р;
    var к = х.getContext("2d");
    var им = к.createImageData(Р, Р);
    /* Ценностный шум на решётке 32 с четырьмя октавами: ровно та фактура,
       что нужна для прожилок после перемножения трёх выборок. */
    var С = 32, семя = 7;
    function сл() { семя = (семя * 9301 + 49297) % 233280; return семя / 233280; }
    var сет = new Float32Array(С * С);
    for (var i0 = 0; i0 < сет.length; i0++) сет[i0] = сл();
    function узел(x, y) { return сет[((y % С + С) % С) * С + ((x % С + С) % С)]; }
    function зн(u, v) {
      var x0 = Math.floor(u), y0 = Math.floor(v), fx = u - x0, fy = v - y0;
      fx = fx * fx * (3 - 2 * fx); fy = fy * fy * (3 - 2 * fy);
      var a = узел(x0, y0), b = узел(x0 + 1, y0), c = узел(x0, y0 + 1), e = узел(x0 + 1, y0 + 1);
      return (a + (b - a) * fx) * (1 - fy) + (c + (e - c) * fx) * fy;
    }
    for (var j = 0; j < Р; j++) for (var i = 0; i < Р; i++) {
      var s = 0, амп = 1, ч = 4, сум = 0;
      for (var k = 0; k < 4; k++) { s += зн(i / Р * ч, j / Р * ч) * амп; сум += амп; амп *= 0.5; ч *= 2; }
      var v = Math.round(s / сум * 255);
      var о = (j * Р + i) * 4;
      им.data[о] = им.data[о + 1] = им.data[о + 2] = v; им.data[о + 3] = 255;
    }
    к.putImageData(им, 0, 0);
    var т = new T.CanvasTexture(х);
    т.wrapS = т.wrapT = T.RepeatWrapping;
    return т;
  }

  /* ── Стенка трубы ─────────────────────────────────────────────
     Их шейдер по строкам. Развёртка сжата по высоте в четыре раза и
     сдвинута по диагонали (uv.x += uv.y): от этого прожилки идут не
     кольцами поперёк трубы, а винтом вдоль неё, и полёт читается
     вращением. */
  var В_ТРУБА = [
    "varying vec2 vUv;",
    "void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }"
  ].join("\n");

  var Ф_ТРУБА = [
    "uniform sampler2D tWind;",
    "uniform float uTime;",
    "uniform float uSila;",
    "uniform vec3 uCvet;",
    "varying vec2 vUv;",
    "void main(){",
    "  vec2 uv = vUv * vec2(1.0, 0.25);",
    "  uv.x += uv.y;",
    "  float t = uTime * 0.05;",
    "  vec2 hod = vec2(-t, t * 0.7);",
    "  float value  = texture2D(tWind, uv * 3.0 + hod).r;",
    "  value       *= texture2D(tWind, uv * 4.0 + hod).r;",
    "  value       *= texture2D(tWind, uv * 6.0 + hod).r;",
    /* Края трубы гасятся, иначе видно её торцы срезом. */
    "  float fade = smoothstep(0.0, 0.2, vUv.y) * smoothstep(1.0, 0.9, vUv.y);",
    "  value *= fade;",
    "  float alpha = pow(value, 3.0) * 3.0 * uSila;",
    "  gl_FragColor = vec4(uCvet, clamp(alpha, 0.0, 1.0));",
    "}"
  ].join("\n");

  /* ── Осколок кольца ───────────────────────────────────────────
     Дуга сектора с толщиной. Их модель заменить нечем и не нужно: важна
     не форма куска, а закон его движения. */
  function осколок(вн, нар, толщ, угол, сегм) {
    var поз = [], норм = [], инд = [];
    var шаг = угол / сегм;
    function точка(r, a, y) { return [Math.cos(a) * r, y, Math.sin(a) * r]; }
    /* Четыре кольца вершин: низ-внутри, низ-снаружи, верх-снаружи,
       верх-внутри. Обходим их лентой и замыкаем торцы. */
    var ряды = [
      { r: вн, y: -толщ * 0.5 }, { r: нар, y: -толщ * 0.5 },
      { r: нар, y: толщ * 0.5 }, { r: вн, y: толщ * 0.5 }
    ];
    for (var р = 0; р < 4; р++) {
      for (var i = 0; i <= сегм; i++) {
        var a = -угол * 0.5 + шаг * i;
        var т = точка(ряды[р].r, a, ряды[р].y);
        поз.push(т[0], т[1], т[2]);
        var н = (р === 0 || р === 3) ? [-Math.cos(a), 0, -Math.sin(a)]
              : [Math.cos(a), 0, Math.sin(a)];
        if (р === 1 || р === 2) н = [Math.cos(a), 0, Math.sin(a)];
        if (р === 2 || р === 3) н = [0, 1, 0];
        if (р === 0) н = [0, -1, 0];
        норм.push(н[0], н[1], н[2]);
      }
    }
    var ш = сегм + 1;
    for (var р2 = 0; р2 < 4; р2++) {
      var сл2 = (р2 + 1) % 4;
      for (var i2 = 0; i2 < сегм; i2++) {
        var a0 = р2 * ш + i2, a1 = a0 + 1;
        var b0 = сл2 * ш + i2, b1 = b0 + 1;
        инд.push(a0, b0, a1, a1, b0, b1);
      }
    }
    var гео = new T.BufferGeometry();
    гео.setAttribute("position", new T.Float32BufferAttribute(поз, 3));
    гео.setAttribute("normal", new T.Float32BufferAttribute(норм, 3));
    гео.setIndex(инд);
    return гео;
  }

  var В_КОЛЬЦО = [
    "attribute vec3 aCentr;",
    "attribute vec3 aRand;",
    "uniform float uTime;",
    "varying float vFade;",
    "varying float vSvet;",
    "varying vec3 vNor;",
    /* Насколько камера БЛИЗКО: ноль дальше «дали», единица ближе «близи».
       У них это falloffsmooth с четырьмя числами; здесь та же ступенька
       записана прямо, потому что читается она так же, а спорных
       параметров у неё вдвое меньше. */
    "float bli(float dist, float dal, float bliz){",
    "  return 1.0 - smoothstep(bliz, dal, dist);",
    "}",
    "vec2 rot2(vec2 p, float a){ float s = sin(a), c = cos(a); return vec2(p.x*c - p.y*s, p.x*s + p.y*c); }",
    "vec3 rot3(vec3 p, vec3 axis, float a){",
    "  float s = sin(a), c = cos(a);",
    "  return p * c + cross(axis, p) * s + axis * dot(axis, p) * (1.0 - c);",
    "}",
    "void main(){",
    "  vec3 pos = position;",
    /* Мировое место экземпляра: по нему считается расстояние до камеры. */
    "  vec3 tr = (modelMatrix * instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0)).xyz;",
    "  float dist = distance(cameraPosition, tr);",
    "  float razlet = bli(dist, 13.0, 2.0);",
    "  vFade = bli(dist, 16.0, 9.0);",
    "  vSvet = razlet;",
    /* Поворот куска вокруг своей случайной оси. */
    "  vec3 sc = aCentr * 0.3;",
    "  vec3 axis = normalize(aRand * 2.0 - 1.0 + 0.0001);",
    "  float angle = 0.5 * razlet;",
    "  pos -= sc; pos = rot3(pos, axis, angle); pos += sc;",
    /* Разлёт по центроиду: 7.5-15 процентов, разброс от третьего числа. */
    "  pos += aCentr * razlet * mix(0.075, 0.15, aRand.z);",
    /* Дыхание разлёта: ещё до пяти процентов, фаза от места куска. */
    "  pos += aRand.y * aCentr * razlet * sin(aRand.x * 5.0 + uTime * 0.5 + dot(aCentr, vec3(15.0))) * 0.05;",
    /* Закрутка кольца целиком по двум плоскостям, до 54 градусов, с
       разными окнами по расстоянию: крутиться оно начинает раньше, чем
       разлетаться. */
    "  float sp1 = bli(dist, 8.0, 5.0);",
    "  float sp2 = bli(dist, 10.0, 8.0);",
    "  pos.xz = rot2(pos.xz, sp1 * 3.14159 * 0.3);",
    "  pos.xy = rot2(pos.xy, sp2 * 3.14159 * 0.3 + tr.y * 0.25 + 1.5);",
    "  vNor = normalize(normalMatrix * mat3(instanceMatrix) * normal);",
    "  gl_Position = projectionMatrix * modelViewMatrix * instanceMatrix * vec4(pos, 1.0);",
    "}"
  ].join("\n");

  var Ф_КОЛЬЦО = [
    "uniform vec3 uCvet;",
    "uniform vec3 uGlow;",
    "uniform vec3 uFon;",
    "varying float vFade;",
    "varying float vSvet;",
    "varying vec3 vNor;",
    "void main(){",
    "  vec3 n = normalize(vNor);",
    "  float sol = clamp(dot(n, normalize(vec3(-0.4, 0.85, 0.3))), 0.0, 1.0);",
    "  vec3 c = uCvet * (0.35 + 0.85 * sol);",
    "  c += uGlow * vSvet * 0.34;",
    /* Кольцо не включается, а проступает из того же воздуха, которым
       красится фон. Их приём: подмешать фон по vFade. */
    "  c = mix(uFon, c, clamp(vFade, 0.0, 1.0) * 0.95);",
    "  gl_FragColor = vec4(c, 1.0);",
    "}"
  ].join("\n");

  /* ── ТРИ СЛОЯ, КОТОРЫЕ ЛЕТЯТ ВМЕСТЕ С КОЛЬЦОМ ─────────────────
     У них у каждого кольца не один объект, а четыре: сам пролом,
     силовое поле перед ним, плазма вокруг и дымный след за ним
     (docs/РАЗБОР-IGLOO-ДВИЖЕНИЕ.md, таблица слоёв). У нас до этой
     правки было только кольцо, и оттого пролёт читался пролётом сквозь
     решётку, а не сквозь преграду, которую пробивают.

     Владелец просил тоннель «1:1 по всем эффектам, свету и тд». Их
     моделей (.drc) у нас нет и быть не может, это чужая работа. Взяты
     ЧИСЛА и роли: положения по высоте, окна видимости, степени альфы,
     разворот на 90 градусов между кольцами. Форма считается шумом
     ветра - тем же, которым красится стенка трубы, чтобы все слои
     тоннеля оказались одной выделки.

     СИЛОВОЕ ПОЛЕ. Плоскость поперёк трубы в 0.15 перед кольцом. Это
     мембрана: пока камера далеко, она стоит ровным натяжением, у
     самого подлёта идёт волнами от центра и рвётся. Альфа гаснет с
     расстоянием, поэтому проход сквозь неё это именно проход, а не
     исчезновение по таймеру. */
  var В_ПОЛЕ = [
    "varying vec2 vUv;",
    "varying float vDist;",
    "void main(){",
    "  vUv = uv;",
    "  vec4 mv = modelViewMatrix * vec4(position, 1.0);",
    "  vDist = -mv.z;",
    "  gl_Position = projectionMatrix * mv;",
    "}"
  ].join("\n");

  var Ф_ПОЛЕ = [
    "uniform sampler2D tWind;",
    "uniform float uTime;",
    "uniform float uFaza;",
    "uniform vec3 uCvet;",
    "varying vec2 vUv;",
    "varying float vDist;",
    "void main(){",
    "  vec2 c = vUv - 0.5;",
    "  float r = length(c) * 2.0;",
    "  if (r > 1.0) discard;",
    /* Волны от середины наружу. Частота высокая, ход медленный: поле
       натянуто, а не кипит. */
    "  float volna = sin(r * 26.0 - uTime * 2.4 + uFaza) * 0.5 + 0.5;",
    "  float sh = texture2D(tWind, vUv * 2.0 + vec2(uTime * 0.03, -uTime * 0.02)).r;",
    /* Кромка мембраны ярче середины: натяжение держится по краю. */
    "  float kromka = smoothstep(0.62, 0.99, r);",
    "  float telo = (0.16 + 0.5 * volna) * (0.4 + 0.9 * sh) * (1.0 - r * 0.7);",
    "  float a = (telo + kromka * 0.85) * smoothstep(1.0, 0.86, r);",
    /* Ближе тридцати сотых единицы поле уже пройдено и гаснет: камера
       внутри мембраны, снаружи её больше нет. */
    "  a *= smoothstep(0.0, 1.2, vDist) * smoothstep(15.0, 5.0, vDist);",
    "  if (a < 0.004) discard;",
    "  gl_FragColor = vec4(uCvet, clamp(a, 0.0, 1.0));",
    "}"
  ].join("\n");

  /* ПЛАЗМА. Венец горячего вокруг пролома: кольцо, которое только что
     разорвали, светится по месту разрыва. Альфа в четвёртой степени от
     полутора значений шума - их число: степень отсекает всё, кроме
     редких ярких языков, и вместо ровной дымки получается огонь. */
  var Ф_ПЛАЗМА = [
    "uniform sampler2D tWind;",
    "uniform float uTime;",
    "uniform float uFaza;",
    "uniform vec3 uCvet;",
    "varying vec2 vUv;",
    "varying float vDist;",
    "void main(){",
    "  vec2 c = vUv - 0.5;",
    "  float r = length(c) * 2.0;",
    "  float ug = atan(c.y, c.x) + uFaza;",
    /* Развёртка кольца в полосу: угол по горизонтали, радиус по
       вертикали. Шум по этой полосе даёт языки вдоль кольца. */
    "  vec2 uv = vec2(ug * 0.159, r);",
    "  float t = uTime * 0.16;",
    "  float v  = texture2D(tWind, uv * 3.0 + vec2(t, -t * 0.6)).r;",
    "  v       *= texture2D(tWind, uv * 5.0 + vec2(-t * 0.8, t * 0.4)).r;",
    /* Живёт узкой полосой по месту разрыва, а не по всему диску. */
    "  float polosa = smoothstep(0.52, 0.78, r) * smoothstep(1.02, 0.84, r);",
    "  float a = pow(v * 1.7, 4.0) * polosa * 2.2;",
    "  a *= smoothstep(0.0, 2.0, vDist) * smoothstep(16.0, 4.0, vDist);",
    "  if (a < 0.004) discard;",
    "  gl_FragColor = vec4(uCvet, clamp(a, 0.0, 1.0));",
    "}"
  ].join("\n");

  /* ДЫМНЫЙ СЛЕД. То, что тянется за проломом навстречу камере: у них
     он живёт дольше кольца (окно с нуля до 0.37 против 0.34), то есть
     виден ещё до того, как кольцо проступило, и после того, как оно
     ушло за спину. Альфа в кубе от значения, помноженного на 2.75. */
  var Ф_ДЫМ = [
    "uniform sampler2D tWind;",
    "uniform float uTime;",
    "uniform float uFaza;",
    "uniform vec3 uCvet;",
    "varying vec2 vUv;",
    "varying float vDist;",
    "void main(){",
    "  float t = uTime * 0.09;",
    "  vec2 uv = vec2(vUv.x + uFaza * 0.16, vUv.y * 0.5);",
    "  float v  = texture2D(tWind, uv * 2.0 + vec2(t, -t)).r;",
    "  v       *= texture2D(tWind, uv * 3.5 + vec2(-t * 0.7, t * 0.5)).r;",
    /* Гаснет к обоим торцам конуса: у следа нет ни начала, ни среза. */
    "  float fade = smoothstep(0.0, 0.28, vUv.y) * smoothstep(1.0, 0.55, vUv.y);",
    "  float a = pow(v * 2.75, 3.0) * fade * 1.1;",
    "  a *= smoothstep(0.0, 2.5, vDist) * smoothstep(20.0, 3.0, vDist);",
    "  if (a < 0.003) discard;",
    "  gl_FragColor = vec4(uCvet, clamp(a, 0.0, 1.0));",
    "}"
  ].join("\n");

  /* ── Снег в трубе ─────────────────────────────────────────────
     У них двести точек, падение 0.4-0.7 единицы в секунду по спирали
     радиусом 0.4. Точки нужны затем, чтобы труба не читалась пустой:
     скорость видна по тому, что мимо что-то летит. */
  var В_СНЕГ = [
    "attribute float aSeed;",
    "uniform float uTime;",
    "uniform float uH;",
    "varying float vA;",
    "void main(){",
    "  float sp = 0.4 + fract(aSeed * 7.13) * 0.3;",
    "  float y = mod(position.y - uTime * sp, 9.0) - 8.0;",
    "  float a = aSeed * 6.2831 + uTime * 0.35;",
    "  float r = 0.4 + fract(aSeed * 3.77) * 0.72;",
    "  vec3 p = vec3(cos(a) * r, y, sin(a) * r);",
    "  vec4 mv = modelViewMatrix * vec4(p, 1.0);",
    "  vA = smoothstep(0.0, 1.2, -mv.z) * smoothstep(14.0, 5.0, -mv.z);",
    "  gl_PointSize = clamp(uH * 0.9 / max(0.4, -mv.z), 1.0, 5.0);",
    "  gl_Position = projectionMatrix * mv;",
    "}"
  ].join("\n");
  var Ф_СНЕГ = [
    "uniform vec3 uCvet;",
    "varying float vA;",
    "void main(){",
    "  float r = length(gl_PointCoord - 0.5) * 2.0;",
    "  float a = pow(1.0 - clamp(r, 0.0, 1.0), 1.7) * vA;",
    "  if (a < 0.01) discard;",
    "  gl_FragColor = vec4(uCvet, a);",
    "}"
  ].join("\n");

  /* ── Сборка ───────────────────────────────────────────────────*/
  function собрать(мир, гнездо) {
    if (собрано) return М.корень;
    W = мир; T = W.T;
    var ст = W.ступень;

    М.корень = new T.Group();
    М.корень.name = "труба";
    М.uTime = { value: 0 };
    М.uСила = { value: 0.5 };
    М.uФон = { value: new T.Color(0x0B1026) };
    /* Карта шума ветра одна на весь тоннель: стенка трубы, силовое поле,
       плазма и дымный след красятся ею же. Так все слои оказываются из
       одного воздуха, а не из четырёх разных. */
    М.uШум = { value: шум() };

    /* ТРУБА. Их числа как есть: радиус 1.3, длина 9, 64 на 32, без
       крышек, вывернута масштабом -1 по X, поднята на единицу. */
    var сегК = ст === 0 ? 32 : 64;
    var сегВ = ст === 0 ? 12 : 32;
    var гТ = new T.CylinderGeometry(1.3, 1.3, 9, сегК, сегВ, true);
    гТ.translate(0, -4.5, 0);
    гТ.scale(-1, 1, 1);
    М.мТруба = new T.ShaderMaterial({
      uniforms: {
        tWind: М.uШум, uTime: М.uTime, uSila: М.uСила,
        uCvet: { value: new T.Color(0xAEC2E8) }
      },
      vertexShader: В_ТРУБА, fragmentShader: Ф_ТРУБА,
      transparent: true, depthWrite: false, blending: T.AdditiveBlending,
      side: T.DoubleSide, fog: false
    });
    М.труба = new T.Mesh(гТ, М.мТруба);
    М.труба.position.y = 1;
    М.труба.renderOrder = 1;
    М.труба.frustumCulled = false;
    М.корень.add(М.труба);

    /* ТРИ КОЛЬЦА-ПРОЛОМА на -1.65, -4.15, -6.65, плашмя. */
    var осколков = ст === 0 ? 16 : 28;
    var гО = осколок(1.20, 1.86, 0.13, Math.PI * 2 / осколков * 0.84, 5);
    М.мКольцо = new T.ShaderMaterial({
      uniforms: {
        uTime: М.uTime,
        uCvet: { value: new T.Color(0x6C7695) },
        uGlow: { value: new T.Color(0x7FA8FF) },
        uFon: М.uФон
      },
      vertexShader: В_КОЛЬЦО, fragmentShader: Ф_КОЛЬЦО, fog: false
    });
    /* Общая геометрия спутников кольца: диск для поля и плазмы, конус
       для следа. Одна на все три кольца - меняются только материалы, а
       в них только фаза шума. */
    var гПлоскость = new T.PlaneGeometry(1, 1, 1, 1);
    var гСлед = new T.CylinderGeometry(0.62, 1.42, 2.3, ст === 0 ? 16 : 40, 1, true);
    function спутникМат(фрагмент, цвет, сила) {
      return new T.ShaderMaterial({
        uniforms: {
          tWind: М.uШум, uTime: М.uTime,
          uFaza: { value: 0 }, uCvet: { value: new T.Color(цвет) }
        },
        vertexShader: В_ПОЛЕ, fragmentShader: фрагмент,
        transparent: true, depthWrite: false, side: T.DoubleSide,
        blending: T.AdditiveBlending, fog: false
      });
    }
    function полеМат(ф) { var м = спутникМат(Ф_ПОЛЕ, 0x8FB6FF); м.uniforms.uFaza.value = ф; return м; }
    function плазмаМат(ф) { var м = спутникМат(Ф_ПЛАЗМА, 0xB6D2FF); м.uniforms.uFaza.value = ф; return м; }
    function дымМат(ф) { var м = спутникМат(Ф_ДЫМ, 0x6E86C4); м.uniforms.uFaza.value = ф; return м; }

    М.кольца = [];
    М.поля = []; М.плазма = []; М.дым = [];
    var y = -1.65;
    for (var к = 0; к < 3; к++) {
      var меш = new T.InstancedMesh(гО, М.мКольцо, осколков);
      var центр = new Float32Array(осколков * 3);
      var случ = new Float32Array(осколков * 3);
      var м4 = new T.Matrix4(), кв = new T.Quaternion(), е = new T.Euler();
      var семя = 13 + к * 97;
      function сл2() { семя = (семя * 9301 + 49297) % 233280; return семя / 233280; }
      for (var i = 0; i < осколков; i++) {
        var a = (i / осколков) * Math.PI * 2;
        /* Зазоры неровные: ровные читаются штампованной решёткой. */
        var сдв = (сл2() - 0.5) * 0.06;
        е.set(0, -a + сдв, 0);
        кв.setFromEuler(е);
        м4.compose(new T.Vector3(0, 0, 0), кв, new T.Vector3(1, 1, 1));
        меш.setMatrixAt(i, м4);
        /* Центроид куска: направление от середины кольца наружу. Именно
           по нему кусок и уезжает. */
        var р = 1.53;
        центр[i * 3] = Math.cos(a) * р;
        центр[i * 3 + 1] = 0;
        центр[i * 3 + 2] = Math.sin(a) * р;
        случ[i * 3] = сл2(); случ[i * 3 + 1] = сл2(); случ[i * 3 + 2] = сл2();
      }
      меш.instanceMatrix.needsUpdate = true;
      меш.geometry.setAttribute("aCentr", new T.InstancedBufferAttribute(центр, 3));
      меш.geometry.setAttribute("aRand", new T.InstancedBufferAttribute(случ, 3));
      меш.position.y = y;
      меш.userData.базаY = y;
      меш.frustumCulled = false;
      меш.renderOrder = 2;
      М.корень.add(меш);
      М.кольца.push(меш);

      /* Три спутника кольца. Фаза каждого следующего развёрнута на
         девяносто градусов - их приём: одна модель, три разных вида.
         Здесь моделей нет, разворачивается фаза шума, и результат тот
         же: три пролома не выглядят тремя оттисками одного штампа. */
      var фаза = к * Math.PI * 0.5;
      var поле = new T.Mesh(гПлоскость, полеМат(фаза));
      поле.rotation.x = -Math.PI / 2;
      поле.position.y = y + 0.15;
      поле.scale.setScalar(0.65 * 3.0);
      поле.frustumCulled = false;
      поле.renderOrder = 4;
      М.корень.add(поле);
      М.поля.push(поле);

      var плазма = new T.Mesh(гПлоскость, плазмаМат(фаза));
      плазма.rotation.x = -Math.PI / 2;
      плазма.position.y = y + 0.05;
      плазма.scale.setScalar(3.9);
      плазма.frustumCulled = false;
      плазма.renderOrder = 5;
      М.корень.add(плазма);
      М.плазма.push(плазма);

      /* След тянется НАВСТРЕЧУ камере, то есть вверх по трубе: камера
         идёт сверху вниз, и дым, сорванный с пролома, остаётся у неё за
         спиной. Конус открыт кверху и без крышек. */
      var дым = new T.Mesh(гСлед, дымМат(фаза));
      дым.position.y = y + 1.15;
      дым.frustumCulled = false;
      дым.renderOrder = 4;
      М.корень.add(дым);
      М.дым.push(дым);

      y -= 2.5;
    }

    /* СНЕГ: двести точек внутри трубы. */
    var точек = ст === 0 ? 60 : 200;
    var гС = new T.BufferGeometry();
    var поз = new Float32Array(точек * 3), сем = new Float32Array(точек);
    for (var s = 0; s < точек; s++) {
      поз[s * 3] = 0; поз[s * 3 + 1] = Math.random() * 9; поз[s * 3 + 2] = 0;
      сем[s] = Math.random();
    }
    гС.setAttribute("position", new T.BufferAttribute(поз, 3));
    гС.setAttribute("aSeed", new T.BufferAttribute(сем, 1));
    М.мСнег = new T.ShaderMaterial({
      uniforms: { uTime: М.uTime, uH: { value: 800 }, uCvet: { value: new T.Color(0xC9D8FF) } },
      vertexShader: В_СНЕГ, fragmentShader: Ф_СНЕГ,
      transparent: true, depthWrite: false, blending: T.AdditiveBlending, fog: false
    });
    М.снег = new T.Points(гС, М.мСнег);
    М.снег.frustumCulled = false;
    М.снег.renderOrder = 3;
    М.корень.add(М.снег);

    (гнездо || W.scene).add(М.корень);
    собрано = true;
    return М.корень;
  }

  /* ── Кадр ─────────────────────────────────────────────────────
     Труба и кольца проворачиваются вслед за креном камеры, но МЕДЛЕННЕЕ
     её: у них 0.65 у трубы и 0.4 у колец против единицы у камеры. От
     этого читается, что крутится камера, а не мир. */
  function кадр(доля, dt, часы, крен) {
    if (!собрано) return;
    М.uTime.value = часы;
    if (М.мСнег && W.r && W.r.getDrawingBufferSize) {
      var р = new T.Vector2();
      W.r.getDrawingBufferSize(р);
      М.мСнег.uniforms.uH.value = р.y || 800;
    }
    var к = крен || 0;
    if (М.труба) М.труба.rotation.y = к * 0.65;
    for (var i = 0; i < М.кольца.length; i++) М.кольца[i].rotation.z = к * 0.4;
    /* Труба видна, пока идёт прокол: у них порог 0.52 доли сцены. */
    var видно = доля > 0.001 && доля < 0.995;
    М.корень.visible = видно;
  }

  /* СДВИГ КОЛЕЦ ВДОЛЬ ТРУБЫ.

     У igloo камера ПАДАЕТ сквозь неподвижные кольца. У нас камера идёт
     по общей кривой мира и внутри акта стоит на постоянном выносе,
     поэтому проход устроен зеркально: неподвижна камера, а кольца едут
     ей навстречу. Для шейдера разницы нет вовсе - он считает расстояние
     до камеры, и разлёт получается тот же самый.

     Величина 8.6 подобрана так, чтобы три кольца прошли мимо объектива
     на долях примерно 0.29, 0.58 и 0.87: они расставлены по акту ровно,
     и ни одно не остаётся непройденным. */
  function сдвигКолец(v) {
    if (!М.кольца) return;
    for (var i = 0; i < М.кольца.length; i++) {
      М.кольца[i].position.y = М.кольца[i].userData.базаY + v;
    }
  }

  function фон(цвет) { if (М.uФон) М.uФон.value.setHex(цвет); }
  function сила(с) { if (М.uСила) М.uСила.value = с; }

  g.RV_ТРУБА = {
    "собрать": собрать,
    "кадр": кадр,
    "фон": фон,
    "сдвигКолец": сдвигКолец,
    "сила": сила,
    "корень": function () { return М.корень || null; },
    "замер": function () {
      return {
        "собрано": собрано,
        "колец": М.кольца ? М.кольца.length : 0,
        "осколков": М.кольца && М.кольца[0] ? М.кольца[0].count : 0,
        "снега": М.снег ? М.снег.geometry.attributes.position.count : 0,
        /* Шесть слоёв igloo: труба, кольца, силовые поля, плазма,
           дымные следы, снег. Замер называет каждый, чтобы чёрный
           кадр можно было объяснить числами, а не догадками. */
        "полей": М.поля ? М.поля.length : 0,
        "плазмы": М.плазма ? М.плазма.length : 0,
        "следов": М.дым ? М.дым.length : 0
      };
    }
  };
})(window, document);
