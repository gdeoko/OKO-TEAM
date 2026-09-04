/* Rocket VPN. Ракета из частиц: механика и вид igloo.inc, один в один.

   ЗАЧЕМ ПЕРЕПИСАНО. Владелец: «частицы вообще не похожи ни коем образом
   на igloo ... модель ракеты должна быть с такими же частицами 1:1 как
   igloo». Прежний рой светился аддитивно мягкими голубыми пятнами и
   читался пылью. У них не так, и разбор их сборки это показывает прямо
   (docs/РАЗБОР-IGLOO-ТОННЕЛЬ.md, раздел про фигуру):

   ЧАСТИЦА У НИХ ЭТО ЗАТЕНЁННЫЙ ШАРИК, А НЕ ИСКРА. В кадре считается
   нормаль полушария, по ней берётся свет от источника (-0.75, 1, -0.1),
   и цвет идёт от тёмно-синего #222b42 в тени до светло-серого #bdc6d4 на
   свету. Быстрые точки уходят в #d7ebfa. Смешивание СВОЁ: источник по
   своей прозрачности, приёмник по ЦВЕТУ источника - тёмная частица
   ЗАТЕМНЯЕТ фон, а не подсвечивает его. Из этого и получается статуя из
   песка вместо роя светлячков.

   Их числа, перенесённые сюда дословно:

     uSize 10, gl_PointSize = uSize / length(viewPos) * (высота / 1300)
     uColorDark #222b42  uColorLight #bdc6d4
     uColorFast #d7ebfa  uColorInitial #b5d5ff
     uLightPos (-0.75, 1, -0.1), обёрнутый диффуз с wrap 0.25 и отскоком 0.1
     alpha *= max(uInitialGlow, pow(fit(vVel, 0.002, 0.007, 1.0, 0.0), 2.0) * 0.5 + 0.5)
     depthTest true, depthWrite true
     blending Custom, equation Add, src SrcAlpha, dst SrcColor
     вращение фигуры 0.75 радиана в секунду

   ЧТО ОСТАЛОСЬ НАШИМ И ПОЧЕМУ. Форму они берут из объёмной текстуры
   знакового расстояния, испечённой из модели отдельным конвейером (VDB).
   Такого конвейера у нас нет, и качать чужой объём нельзя. Но нужен он
   им ровно для двух чисел: КУДА тянуть точку и КАКАЯ ТАМ НОРМАЛЬ. Оба мы
   знаем без него - точка снимается С САМОЙ ПОВЕРХНОСТИ ракеты при сборке,
   и нормаль её треугольника запоминается рядом. Поэтому решателя на
   видеокарте здесь нет, а вид получается тот же: затенение считается по
   настоящей нормали поверхности, а не по выдуманной.

   СНЯТИЕ ТОЧЕК ПО ПЛОЩАДИ, А НЕ ПО ВЕРШИНАМ. Если брать вершины меша,
   рой повторит его сетку: густо там, где мелкие треугольники, пусто на
   крупных гранях. Точка ставится в случайное место случайного
   треугольника, а треугольник выбирается с весом своей площади. */
(function (g, d) {
  "use strict";

  var T = null, W = null;

  /* ── Ракета: своя геометрия ───────────────────────────────────
     Корпус, носовой конус, юбка сопла и четыре киля. Собирается из
     примитивов и сплавляется в один список треугольников: рою всё равно,
     из чего снята поверхность, ему нужны только треугольники. */
  function ракетаГео() {
    var части = [];
    function влить(гео, сдвиг, поворот, масштаб) {
      var м = new T.Matrix4();
      var кв = new T.Quaternion();
      if (поворот) кв.setFromEuler(new T.Euler(поворот[0], поворот[1], поворот[2]));
      м.compose(new T.Vector3(сдвиг[0], сдвиг[1], сдвиг[2]), кв,
                new T.Vector3(масштаб ? масштаб[0] : 1, масштаб ? масштаб[1] : 1, масштаб ? масштаб[2] : 1));
      гео.applyMatrix4(м);
      части.push(гео.index ? гео.toNonIndexed() : гео);
    }
    /* Корпус: чуть сужается кверху, как у настоящей ступени. */
    влить(new T.CylinderGeometry(0.30, 0.34, 1.70, 28, 1, true), [0, 0.15, 0]);
    /* Носовой конус. */
    влить(new T.ConeGeometry(0.30, 0.78, 28, 1, true), [0, 1.39, 0]);
    /* Юбка сопла. */
    влить(new T.CylinderGeometry(0.34, 0.21, 0.30, 24, 1, true), [0, -0.85, 0]);
    /* Четыре киля, развёрнутые крестом. */
    for (var k = 0; k < 4; k++) {
      var г = new T.BoxGeometry(0.03, 0.46, 0.34);
      влить(г, [Math.cos(k * Math.PI / 2) * 0.40, -0.55, Math.sin(k * Math.PI / 2) * 0.40],
            [0, -k * Math.PI / 2, 0]);
    }
    /* Сплав: три числа на вершину, всё подряд. */
    var всего = 0, i;
    for (i = 0; i < части.length; i++) всего += части[i].attributes.position.count;
    var поз = new Float32Array(всего * 3);
    var о = 0;
    for (i = 0; i < части.length; i++) {
      поз.set(части[i].attributes.position.array, о);
      о += части[i].attributes.position.count * 3;
      части[i].dispose();
    }
    return поз;
  }

  /* Снятие точек с поверхности по площади треугольников. Вместе с местом
     запоминается НОРМАЛЬ треугольника: у igloo её роль играет градиент
     объёмной текстуры, и без неё затенение частицы посчитать нечем. */
  function снять(поз, сколько, семя) {
    var треуг = Math.floor(поз.length / 9);
    var площ = new Float64Array(треуг);
    var нормТр = new Float32Array(треуг * 3);
    var сум = 0, i;
    for (i = 0; i < треуг; i++) {
      var a = i * 9;
      var ax = поз[a], ay = поз[a + 1], az = поз[a + 2];
      var bx = поз[a + 3], by = поз[a + 4], bz = поз[a + 5];
      var cx = поз[a + 6], cy = поз[a + 7], cz = поз[a + 8];
      var ux = bx - ax, uy = by - ay, uz = bz - az;
      var vx = cx - ax, vy = cy - ay, vz = cz - az;
      var nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
      var дл = Math.sqrt(nx * nx + ny * ny + nz * nz);
      сум += 0.5 * дл;
      площ[i] = сум;
      дл = дл || 1;
      нормТр[i * 3] = nx / дл; нормТр[i * 3 + 1] = ny / дл; нормТр[i * 3 + 2] = nz / дл;
    }
    var с = семя || 1;
    function сл() { с = (с * 1103515245 + 12345) % 2147483648; return с / 2147483648; }
    var дом = new Float32Array(сколько * 3);
    var нор = new Float32Array(сколько * 3);
    var шум = new Float32Array(сколько * 3);
    for (var p = 0; p < сколько; p++) {
      /* Треугольник выбирается двоичным поиском по накопленной площади:
         большая грань получает пропорционально больше точек. */
      var ц = сл() * сум, лев = 0, прав = треуг - 1;
      while (лев < прав) { var с2 = (лев + прав) >> 1; if (площ[с2] < ц) лев = с2 + 1; else прав = с2; }
      var b = лев * 9;
      /* Равномерная точка внутри треугольника: корень первой случайной
         снимает скос к одной вершине. */
      var r1 = Math.sqrt(сл()), r2 = сл();
      var w0 = 1 - r1, w1 = r1 * (1 - r2), w2 = r1 * r2;
      дом[p * 3] = поз[b] * w0 + поз[b + 3] * w1 + поз[b + 6] * w2;
      дом[p * 3 + 1] = поз[b + 1] * w0 + поз[b + 4] * w1 + поз[b + 7] * w2;
      дом[p * 3 + 2] = поз[b + 2] * w0 + поз[b + 5] * w1 + поз[b + 8] * w2;
      нор[p * 3] = нормТр[лев * 3];
      нор[p * 3 + 1] = нормТр[лев * 3 + 1];
      нор[p * 3 + 2] = нормТр[лев * 3 + 2];
      шум[p * 3] = сл(); шум[p * 3 + 1] = сл(); шум[p * 3 + 2] = сл();
    }
    return { дом: дом, норм: нор, шум: шум };
  }

  /* ── Шейдеры ──────────────────────────────────────────────────*/
  var В_РОЙ = [
    "attribute vec3 aHome;",
    "attribute vec3 aNorm;",
    "attribute vec3 aRnd;",
    "uniform float uTime;",
    "uniform float uScatter;",
    "uniform float uH;",
    "uniform float uSize;",
    "uniform float uScale;",
    "uniform vec3 uLightPos;",
    "varying float vShadow;",
    "varying float vVel;",
    /* Завихрение: три синуса по месту и времени. Их curl-шум четвёртого
       порядка стоит втрое дороже на точку, а отличается только рисунком
       вихря, которого на размере частицы всё равно не видно. */
    "vec3 vihr(vec3 p, float t){",
    "  return vec3(",
    "    sin(p.y * 3.1 + t * 0.7) + sin(p.z * 2.3 - t * 0.5),",
    "    sin(p.z * 2.7 - t * 0.6) + sin(p.x * 3.3 + t * 0.4),",
    "    sin(p.x * 2.9 + t * 0.5) + sin(p.y * 2.1 - t * 0.8));",
    "}",
    "void main(){",
    "  vec3 p = aHome;",
    /* Покойное дыхание роя: точка всегда чуть гуляет вокруг дома, иначе
       рой читается пыльной моделью, а не живым облаком. */
    "  vec3 w = vihr(aHome * 1.7 + aRnd * 6.28, uTime);",
    "  p += w * 0.006;",
    /* Разлёт: та же сила, но множителем наружу и с разбросом по точке. */
    "  p += w * uScatter * mix(0.10, 0.55, aRnd.x);",
    "  p += normalize(aHome + 0.001) * uScatter * mix(0.05, 0.40, aRnd.z);",
    "  vec4 mv = modelViewMatrix * vec4(p, 1.0);",
    /* ЗАТЕНЕНИЕ ТОЧКИ - их обёрнутый диффуз по нормали поверхности.
       У них нормаль приходит градиентом объёмной текстуры, у нас лежит
       атрибутом: считается одно и то же. wrap 0.25 разводит свет за
       терминатор, отскок в десятую долю не даёт теневой стороне упасть
       в чёрное. */
    "  vec3 L = normalize(uLightPos);",
    "  float dp = dot(L, normalize(aNorm));",
    "  float wrap = 0.25;",
    "  float wrapDiffuse = max(0.0, (dp + wrap) / (1.0 + wrap));",
    "  wrapDiffuse += max(0.0, -dp) * 0.1;",
    "  vShadow = wrapDiffuse;",
    /* Скорость точки. У них она приходит из решателя и красит быстрые
       частицы в светлый. Разлёт это и есть быстрое движение, поэтому
       скорость берём из него и из размаха завихрения - в тех же
       единицах, в которых их шейдер её потом растягивает. */
    "  vVel = 0.0016 + length(w) * 0.0004 + uScatter * 0.006;",
    /* Их формула размера. Множитель масштаба нужен потому, что фигура у
       нас крупнее их в несколько раз и камера стоит во столько же раз
       дальше: без него точки схлопнулись бы в субпиксель. */
    "  gl_PointSize = clamp(uSize * uScale / max(0.35, -mv.z) * (uH / 1300.0), 1.0, 14.0);",
    "  gl_Position = projectionMatrix * mv;",
    "}"
  ].join("\n");

  /* Фрагментный шейдер - их, слово в слово. */
  var Ф_РОЙ = [
    "uniform vec3 uColorLight;",
    "uniform vec3 uColorDark;",
    "uniform vec3 uColorInitial;",
    "uniform vec3 uColorFast;",
    "uniform vec3 uLightPos;",
    "uniform float uVisible;",
    "uniform float uAlpha;",
    "uniform float uInitialGlow;",
    "varying float vShadow;",
    "varying float vVel;",
    "float fitl(float x, float a1, float a2, float b1, float b2){",
    "  float v = b1 + ((x - a1) * (b2 - b1)) / (a2 - a1);",
    "  return clamp(v, min(b1, b2), max(b1, b2));",
    "}",
    "void main(){",
    "  float alpha = step(length(gl_PointCoord.xy - 0.5), 0.5) * uVisible;",
    "  if (alpha < 0.001) discard;",
    /* Нормаль полушария: точка это шарик, а не плоский кружок. */
    "  vec2 uv = 2.0 * gl_PointCoord.xy - 1.0;",
    "  vec3 n = vec3(uv, sqrt(1.0 - clamp(dot(uv, uv), 0.0, 1.0)));",
    "  n.y = 1.0 - n.y;",
    /* Их источник повёрнут на пол-оборота вокруг Y. */
    "  vec3 L = normalize(vec3(-uLightPos.x, uLightPos.y, -uLightPos.z));",
    "  float lightShadow = max(0.0, dot(L, normalize(n)));",
    "  float ramp = lightShadow * vShadow;",
    "  vec3 color = mix(uColorDark, uColorLight, ramp);",
    "  color = mix(color, uColorFast, pow(fitl(vVel, 0.003, 0.005, 0.0, 1.0), 2.0));",
    /* Их «бедняцкое смазывание»: быстрая точка бледнее. */
    "  alpha *= max(uInitialGlow, pow(fitl(vVel, 0.002, 0.007, 1.0, 0.0), 2.0) * 0.5 + 0.5);",
    /* Их приём проявления: спрятанное состояние это alpha 0, свечение 1
       и белый цвет; сначала едет прозрачность, цвет подтягивается за ней. */
    "  vec3 fadeInColor = mix(vec3(1.0), uColorInitial, clamp(uAlpha, 0.0, 1.0));",
    "  color = mix(color, fadeInColor, uInitialGlow);",
    "  gl_FragColor = vec4(clamp(color, 0.0, 1.0), alpha * uAlpha);",
    "}"
  ].join("\n");

  /* ── Сборка ───────────────────────────────────────────────────*/
  var М = {};
  var собрано = false;

  function собрать(мир, гнездо, опц) {
    if (собрано) return М.рой;
    W = мир; T = W.T;
    опц = опц || {};
    var ст = W.ступень;
    /* У них полтораста тысяч. Точка стоит дёшево, дорога только её
       заливка, а здесь точка мелкая; на полной ступени берём их число
       целиком - без него рой рвётся на просвет и статуи не выходит. */
    var сколько = ст === 0 ? 22000 : (ст === 1 ? 65000 : 150000);

    var поз = ракетаГео();
    var снято = снять(поз, сколько, 2024);

    var гео = new T.BufferGeometry();
    /* position нужен движку для отсечения по объёму; настоящее место
       точки считает шейдер из aHome. */
    гео.setAttribute("position", new T.BufferAttribute(снято.дом.slice(), 3));
    гео.setAttribute("aHome", new T.BufferAttribute(снято.дом, 3));
    гео.setAttribute("aNorm", new T.BufferAttribute(снято.норм, 3));
    гео.setAttribute("aRnd", new T.BufferAttribute(снято.шум, 3));

    М.uTime = { value: 0 };
    М.uScatter = { value: 0 };
    М.uVisible = { value: 1 };
    М.uAlpha = { value: 1 };
    М.uInitialGlow = { value: 0 };
    М.uScale = { value: опц["масштаб"] != null ? опц["масштаб"] : 1 };
    М.мат = new T.ShaderMaterial({
      uniforms: {
        uTime: М.uTime, uScatter: М.uScatter,
        uH: { value: 900 },
        uSize: { value: опц["размер"] != null ? опц["размер"] : 10.0 },
        uScale: М.uScale,
        uVisible: М.uVisible, uAlpha: М.uAlpha, uInitialGlow: М.uInitialGlow,
        uLightPos: { value: new T.Vector3(-0.75, 1, -0.1) },
        uColorLight: { value: new T.Color(0xbdc6d4) },
        uColorDark: { value: new T.Color(0x222b42) },
        uColorFast: { value: new T.Color(0xd7ebfa) },
        uColorInitial: { value: new T.Color(0xb5d5ff) }
      },
      vertexShader: В_РОЙ, fragmentShader: Ф_РОЙ,
      transparent: true,
      /* ИХ СМЕШИВАНИЕ, А НЕ СЛОЖЕНИЕ. Приёмник умножается на ЦВЕТ
         источника: тёмная частица гасит фон под собой, светлая пропускает
         его. Сложение, стоявшее здесь раньше, умело только подсвечивать,
         и рой светился насквозь вместо того, чтобы стоять телом. */
      blending: T.CustomBlending,
      blendEquation: T.AddEquation,
      blendSrc: T.SrcAlphaFactor,
      blendDst: T.SrcColorFactor,
      depthTest: true, depthWrite: true, fog: false
    });
    М.рой = new T.Points(гео, М.мат);
    М.рой.name = "ракета-рой";
    М.рой.frustumCulled = false;
    М.рой.renderOrder = 6;
    (гнездо || W.scene).add(М.рой);
    собрано = true;
    return М.рой;
  }

  function кадр(dt, часы) {
    if (!собрано) return;
    М.uTime.value = часы;
    if (W.r && W.r.getDrawingBufferSize) {
      if (!М._р) М._р = new T.Vector2();
      W.r.getDrawingBufferSize(М._р);
      М.мат.uniforms.uH.value = М._р.y || 900;
    }
  }

  function разлёт(v) { if (М.uScatter) М.uScatter.value = v; }

  /* Проявление по их ленте: сначала прозрачность за две с половиной
     секунды, потом свечение уходит за одну. */
  function проявить(альфа, свечение) {
    if (!собрано) return;
    М.uAlpha.value = альфа == null ? 1 : Math.max(0, Math.min(1, альфа));
    М.uInitialGlow.value = свечение == null ? 0 : Math.max(0, Math.min(1, свечение));
    М.uVisible.value = М.uAlpha.value > 0.002 ? 1 : 0;
  }

  /* Масштаб фигуры в мире: нужен формуле размера точки. Ставит его тот,
     кто ставит саму фигуру, иначе точки схлопываются в субпиксель. */
  function масштаб(k) { if (М.uScale) М.uScale.value = k > 0 ? k : 1; }

  g.RV_ЧАСТИЦЫ = {
    "собрать": собрать,
    "кадр": кадр,
    "разлёт": разлёт,
    "проявить": проявить,
    "масштаб": масштаб,
    "узел": function () { return М.рой || null; },
    "замер": function () {
      return {
        "собрано": собрано,
        "точек": М.рой ? М.рой.geometry.attributes.position.count : 0,
        "разлёт": М.uScatter ? +М.uScatter.value.toFixed(3) : 0,
        "альфа": М.uAlpha ? +М.uAlpha.value.toFixed(3) : 0,
        "свечение": М.uInitialGlow ? +М.uInitialGlow.value.toFixed(3) : 0,
        "масштаб": М.uScale ? +М.uScale.value.toFixed(2) : 1
      };
    }
  };
})(window, document);
