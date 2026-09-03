/* Rocket VPN. Акт «Станция»: лунный купол из блоков, первый экран.

   ЧТО ЭТО. Предмет-основа первого экрана: купол из плотно сложенных
   блоков с аркой входа, ледяные глыбы сверху со свечением изнутри,
   синяя тень на реголите. Он проявляется на старте снизу вверх, дышит,
   приподнимает верхние блоки под курсором и открывается по ходу
   прокрутки, пропуская человека дальше в фильм.

   ЗАКОН ДВИЖЕНИЯ СНЯТ С igloo.inc ДОСЛОВНО (класс U3 их бандла), и это
   главное отличие от первой сборки, где блоки разлетались во все
   стороны кувырком. У них:
     · каждый кусок ходит НАРУЖУ ПО РАДИУСУ: position = centroid +
       centroid * displacement, никаких случайных направлений;
     · двигаются только ВЕРХНИЕ ряды: множитель smoothstep(0.45, 0.7, y)
       для дыхания и курсора, smoothstep(0.3, 1, y) для прокрутки;
     · величины небольшие: дыхание до 0.4 * mix(0.5, 2, rand) * 0.5,
       курсор поднимает куски в кольце 1..3 единиц на 0.5 + 0.3 * колебание,
       прокрутка на старте держит верх раздвинутым до двух радиусов и к
       0.4 хода собирает;
     · всё через ДВА последовательных лерпа по 0.05-0.075, пересчитанных
       на долю кадра;
     · поворот куска: cos(displacement * 2 + rand * 30) * displacement * 0.5
       по каждой оси плюс scrollDisplacement * rand * -1.5;
     · старт это не сборка из осколков, а ПРОЯВЛЕНИЕ снизу вверх:
       falloffsmooth(y, верх, низ, 1.5, uIntroMaterialize) с синей
       светящейся кромкой и решёткой треугольников на ней.
   Матрицы кусков считаются на стороне JS каждый кадр и уходят в
   InstancedMesh: ровно их архитектура (батч с матрицами в текстуре).

   МАТЕРИАЛ. Их фрагментный шейдер повторён по строкам: две карты света
   (собранное и разлетевшееся) смешиваются по clamp(5 * displacement),
   эмиссия по displacement синим, покойная эмиссия пульсом
   sin(x - time + 3.2), подсветка внутренней стороны, ложный
   подповерхностный свет боковым градиентом, отскок от грунта снизу.
   Карт света у нас нет, вместо них затенение по кускам, посчитанное при
   сборке для обоих состояний.

   ПОЧЕМУ В СЦЕНЕ, А НЕ В ГНЕЗДЕ. Гнездо акта развёрнуто лицом к камере и
   при камере выше предмета наклонено; горизонт с таким наклоном виден
   сразу. Станция стоит в мировых координатах в точке «на». */
(function (g, d) {
  "use strict";

  var W = null, T = null;
  var М = {};
  var собрано = false;

  var ИМЯ = "станция";
  /* КУДА СМОТРИТ КАМЕРА АКТА. Стояло: глаз на 13.2, прицел на 11, то
     есть объектив ВЫШЕ купола, и полусфера проецировалась диском. У
     igloo камера стоит ниже дома и ловит его силуэт на фоне неба.

     Теперь глаз на 12.6, прицел на 12.2: взгляд почти горизонтальный,
     макушка купола на 14.0 остаётся выше объектива, и дом виден домом.
     Глаз отодвинут с 92 до 99, чтобы крупный купол целиком помещался в
     кадр и рядом осталось место грунту и валунам. */
  var НА = [0, 12.2, 80];
  var ОТ = [0, 12.6, 99];
  /* РАДИУС КУПОЛА. Стоял 2.3, и купол читался плоским кольцом. Причина
     не в кладке, а в том, ОТКУДА на него смотрят: камера акта стоит на
     высоте 13.2-14, основание купола на 11, макушка при радиусе 2.3
     выходила на 13.3. То есть объектив был ВЫШЕ верхушки, и полусфера
     проецировалась диском, как монета сверху.

     У igloo обратное: камера ниже дома и ловит его силуэт на фоне неба,
     оттого дом и читается домом. При радиусе 4.0 макушка встаёт на 15.0,
     на единицу выше камеры, и купол наконец виден сбоку. Заодно он
     занимает в кадре ту же долю, что их иглу.

     Всё остальное в акте меряется в долях R и едет за ним само: кладка,
     арка, валуны, плоскость тени, кольцо дымки. */
  var R = 3.0;

  function зажать(v, н, в) { return v < н ? н : (v > в ? в : v); }
  function плавно(a, b, x) { x = зажать((x - a) / (b - a), 0, 1); return x * x * (3 - 2 * x); }
  function fit(v, a, b, c, e) { return c + (e - c) * зажать((v - a) / (b - a), 0, 1); }
  /* Их lerpCoefFPS: коэффициент, пересчитанный на долю кадра к 60 Гц. */
  function лерпК(k, dt) {
    var раз = dt * 60;
    if (раз > 4) раз = 4;
    if (!(раз > 0.05)) раз = 0.05;
    return 1 - Math.pow(1 - k, раз);
  }

  /* ── GLSL ─────────────────────────────────────────────────────*/
  var ОБЩЕЕ = [
    "uniform vec3 uColor1;",
    "uniform vec3 uColor2;",
    "uniform vec2 uResolution;",
    "uniform float uTime;",
    "uniform float uDen;",
    "vec3 nebo(){",
    "  vec2 screenUv = gl_FragCoord.xy / uResolution;",
    "  float grad = pow((screenUv.x + screenUv.y) * 0.5, 2.0);",
    "  return mix(uColor2, uColor1, grad);",
    "}",
    "vec3 tuman(vec3 color, float mvz, float wy){",
    "  float distanceFog = clamp(-mvz * 0.005, 0.0, 1.0);",
    "  float heightFog = clamp(1.0 - wy * 0.35, 0.0, 1.0) * 0.25;",
    "  return mix(color, nebo(), clamp(distanceFog + heightFog, 0.0, 1.0));",
    "}",
    "float hash12(vec2 p){",
    "  vec3 p3 = fract(vec3(p.xyx) * 0.1031);",
    "  p3 += dot(p3, p3.yzx + 33.33);",
    "  return fract((p3.x + p3.y) * p3.z);",
    "}",
    "vec3 dizer(vec3 c){ return c + (hash12(gl_FragCoord.xy + uTime) - 0.5) / 255.0; }",
    "float falloffsmooth(float x, float s, float e, float m, float p){",
    "  float d = mix(s, e - m, clamp(x, 0.0, 1.0));",
    "  return smoothstep(d, d + m, p);",
    "}"
  ].join("\n");

  var В_БЛОК = [
    "attribute float aDisp;",
    "attribute float aBounce;",
    "attribute float aAO;",
    "attribute float aAOex;",
    "attribute float aInner;",
    /* Семя блока. Нужно затем, чтобы фотоскан не лёг на все двести
       блоков одним и тем же куском: без сдвига координат кладка
       превращается в стену клонов, и это видно сразу. */
    "attribute float aSeed;",
    "uniform float uOutline;",
    "varying vec3 vNor;",
    "varying vec3 vLocN;",
    "varying vec3 vWorld;",
    "varying vec3 vPos;",
    "varying float vMvz;",
    "varying float vDisp;",
    "varying float vBounce;",
    "varying float vAO;",
    "varying float vInner;",
    "varying vec2 vUv;",
    "varying float vSeed;",
    "void main(){",
    "  vUv = uv;",
    "  vSeed = aSeed;",
    "  vLocN = normal;",
    "  vec3 p = position * (1.0 + uOutline * 0.018);",
    "  vec4 loc = instanceMatrix * vec4(p, 1.0);",
    "  vPos = loc.xyz;",
    "  vec4 w = modelMatrix * loc;",
    "  vWorld = w.xyz;",
    "  vNor = normalize(normalMatrix * mat3(instanceMatrix) * normal);",
    "  vDisp = aDisp; vBounce = aBounce; vInner = aInner;",
    "  vAO = mix(aAO, aAOex, clamp(5.0 * aDisp, 0.0, 1.0));",
    "  vec4 mv = viewMatrix * w;",
    "  vMvz = mv.z;",
    "  gl_Position = projectionMatrix * mv;",
    "}"
  ].join("\n");

  var Ф_БЛОК = [
    ОБЩЕЕ,
    "uniform vec3 uKamen;",
    "uniform vec3 uTen;",
    "uniform vec3 uVerh;",
    "uniform vec3 uNiz;",
    "uniform vec3 uGlow;",
    "uniform float uOutline;",
    /* Фотоскан панели: настоящая поверхность вместо хеш-крупы. uTex это
       доля подмеса, она встаёт в единицу только когда файлы доехали. */
    "uniform sampler2D tBlok;",
    "uniform sampler2D tBlokN;",
    "uniform float uTex;",
    "uniform float uIntro;",
    "uniform float uH;",
    "varying vec3 vNor;",
    "varying vec3 vLocN;",
    "varying vec3 vWorld;",
    "varying vec3 vPos;",
    "varying float vMvz;",
    "varying float vDisp;",
    "varying float vBounce;",
    "varying float vAO;",
    "varying float vInner;",
    "varying vec2 vUv;",
    "varying float vSeed;",
    "void main(){",
    /* Проявление снизу вверх, их формула: всё выше кромки отбрасывается,
       у кромки синее свечение с решёткой. Решётка у них из текстуры, у
       нас из хеша по мировым координатам. */
    "  vec3 blue = vec3(0.5, 0.7, 1.0);",
    /* Кромка проявления идёт снизу вверх по высоте купола: при uIntro 0
       всё выше кромки отброшено, при 1 кромка выше верха и купол целый.
       Их falloffsmooth с их числами (3.95, -0.4, 1.5) считает в их
       единицах высоты и на нашем радиусе не сходится, поэтому та же
       ступенька записана по нормированной высоте. */
    "  float kY = vPos.y / uH;",
        /* КРОМКА ДОЛЖНА УХОДИТЬ ВЫШЕ САМОГО ВЫСОКОГО БЛОКА, ИНАЧЕ ОНА ЕГО
       СРЕЗАЕТ. Стояло uIntro * 1.45: при готовом проявлении кромка
       вставала на 1.23 по нормированной высоте, и всё, что выше 1.37
       радиуса, отбрасывалось насовсем. Пока радиус был 2.3, верх купола
       туда не доставал. С радиусом 3.0 и крупной кладкой достал, и
       владелец увидел ровно это: плоское кольцо вместо дома, потому что
       вся верхняя половина просто не рисовалась.

       Замер: коробка кладки в мире 6.5 на 6.6 единицы, на экране 529 на
       490 точек, все 52 блока собраны, смещение ноль - а видна была
       полоса в восемьдесят точек. Множитель поднят до 2.6: кромка
       доходит до 2.38, выше любого блока с любым разлётом. */
    "  float kromka = uIntro * 2.6 - 0.22;",
    "  float introEmissive = 1.0 - smoothstep(kY - 0.14, kY + 0.14, kromka);",
    "  if (introEmissive > 0.9999) discard;",
    /* ОБВОДКА ТЁМНАЯ, А НЕ БЕЛАЯ. Оболочка рисуется задней стороной на
       1.8 процента крупнее блока и видна только по силуэту. У igloo она
       почти белая (0.91, 0.93, 0.97) при прозрачности 0.5, и это верно
       для снега: у снежного блока кромка светится изнутри. Наш блок
       каменный, и белый ореол вокруг каждого складывался на перекрытиях
       в белёсую плёнку, от которой купол читался плоским пятном. Тёмная
       обводка делает обратное и правильное: разводит блоки по глубине
       тенью в стыке, как на любой настоящей кладке. */
    "  if (uOutline > 0.5) {",
    "    vec3 oc = tuman(vec3(0.055, 0.065, 0.10), vMvz, vWorld.y);",
    "    gl_FragColor = vec4(oc, 0.42 * (1.0 - introEmissive));",
    "    return;",
    "  }",
    "  vec3 n = normalize(vNor);",
    /* Кромка блока: где нормаль скруглённого бруска уходит от осей, там
       ребро. Ребро светлее и с изморозью, это их светлые швы кладки. */
    "  vec3 an = abs(normalize(vLocN));",
    "  float edge = 1.0 - max(an.x, max(an.y, an.z));",
    "  edge = smoothstep(0.05, 0.4, edge);",
    /* Фактура камня: два масштаба хеша по мировым координатам. */
    /* ФОТОСКАН ПАНЕЛИ. Координаты сдвинуты семенем блока, поэтому один
       и тот же кусок скана не ложится на всю кладку: каждый блок берёт
       свой участок поверхности, как и бывает у настоящих панелей.
       Множитель 1.35 подобран так, чтобы зерно материала читалось на
       блоке шириной около метра. */
    "  vec2 uvT = vUv * 1.35 + vec2(vSeed, fract(vSeed * 7.31));",
    "  vec3 fot = texture2D(tBlok, uvT).rgb;",
    "  vec3 fotN = texture2D(tBlokN, uvT).xyz * 2.0 - 1.0;",
    "  vec3 zerno = vec3(hash12(vWorld.xy * 48.0), hash12(vWorld.yz * 48.0 + 3.1), hash12(vWorld.zx * 48.0 + 7.7)) - 0.5;",
    /* Пока файлы едут, рельеф даёт хеш-крупа. Как только доехали,
       вместо неё встаёт настоящая карта нормалей. */
    "  n = normalize(n + mix(zerno * 0.16, fotN * 0.40, uTex));",
    "  vec3 sun = normalize(vec3(-0.55, 0.78, 0.3));",
    "  float hemi = n.y * 0.5 + 0.5;",
    "  vec3 svet = mix(uNiz, uVerh, hemi);",
    "  float sol = smoothstep(0.02, 0.42, dot(n, sun));",
    "  vec3 vv = normalize(cameraPosition - vWorld);",
    "  float blik = pow(max(0.0, dot(normalize(sun + vv), n)), 20.0) * 0.3;",
    "  vec3 base = mix(uTen, uKamen, 0.3 + 0.7 * sol);",
    "  base *= 0.9 + 0.2 * hash12(floor(vWorld.xz * 2.1) + floor(vWorld.y * 2.1));",
    /* Цвет скана заходит делением на его же среднюю (0.68 из замера
       блок-цвет.webp). Так панель получает настоящую пятнистость, а
       общая светлота кладки остаётся той, на которую настроен весь акт. */
    "  base *= mix(vec3(1.0), fot / 0.68, uTex);",
    "  float ao = mix(0.3, 1.0, vAO);",
    /* ЛУННОЕ СОЛНЦЕ, А НЕ ПАВИЛЬОН. У Луны нет атмосферы, рассеивать
       свет нечем, и теневая сторона камня там уходит почти в чёрное.
       Стояло 0.55 подсветки к 0.7 солнца: это земной пасмурный день, от
       него камень читался пластиком. Теперь тень глубже, а солнце
       сильнее, и форма блока рисуется контрастом, как на снимках Аполлона. */
        /* Подсветка теневой стороны поднята с 0.30 до 0.46. Ноль атмосферы
       на Луне верен физически, но у igloo дом светится изнутри, и его
       теневые блоки читаются камнем, а не чёрными дырами. У нас станция
       тоже обитаемая, поэтому пол теневой стороны есть. */
    "  vec3 color = base * svet * ao * (0.46 + 0.92 * sol) + uVerh * blik * ao;",
    /* ШВЫ ТЁМНЫЕ, А НЕ СВЕТЯЩИЕСЯ. У igloo блоки снежные, и кромка у них
       светлее тела: там изморозь. У нас камень, и светлый кант на каждом
       ребре превращал кладку в груду светящихся кубиков, ровно то, на
       что владелец и жаловался. У настоящей кладки ребро ловит немного
       света, а ЩЕЛЬ между блоками уходит в темноту. Здесь оба слагаемых:
       глубокая щель гасится до 0.62, ребро подхватывает свет на 0.12. */
    "  color *= mix(1.0, 0.62, smoothstep(0.5, 1.0, edge));",
    "  color = mix(color, uVerh * 1.02, edge * 0.12);",
    /* Их строки, по порядку: эмиссия по смещению, покойная эмиссия
       пульсом, свечение внутренней стороны, ложный подповерхностный
       свет, отскок от грунта. */
    /* СВЕТ ИЗНУТРИ, А НЕ РАСКАЛЁННЫЙ КАМЕНЬ.

       У igloo это свет лампы, проходящий СКВОЗЬ снежный блок: снег
       полупрозрачный, и внутренняя сторона свода у них честно светится.
       Наш блок каменный, сквозь него не светит ничего, и та же сила
       выбивала верхние ряды в белое пятно с решёткой. На снимке доля
       точек ярче 200 доходила до 3.6 процента, и весь купол читался
       раскалённым, а не освещённым.

       Свет оставлен, потому что станция обитаемая и проём должен
       выдавать жильё. Сила опущена втрое с лишним, и добавка идёт ОДИН
       раз вместо двух: второе слагаемое по диагонали складывалось с
       первым и удваивало пик ровно на верхних рядах. */
    "  color += pow(vInner, 2.0) * clamp(1.0 * vDisp, 0.0, 1.0) * blue * 0.32;",
    "  vec3 powEmission = pow(vInner, 8.0) * blue * 0.15;",
    "  color += powEmission * (sin(vPos.x - uTime * 1.0 + 3.2) * 0.5 + 0.5);",
    /* Общий подъём чёрного. Стоял 0.12 и поднимал ВЕСЬ купол ровной
       плёнкой, съедая контраст лунной тени. */
    "  color += (vPos.x * 0.1 + 0.4) * 0.3 * min(vPos.y / uH + 0.5, 1.0) * 0.045;",
    "  color = clamp(color, vec3(0.0), vec3(1.0));",
    "  color += (1.0 - smoothstep(-0.4, 0.3, vPos.y / uH)) * vBounce * vec3(0.8, 0.9, 1.0) * 0.25;",
    /* Кромка проявления: синее свечение с решёткой. */
    "  float tri = step(0.5, fract((vWorld.x + vWorld.y) * 6.0)) * step(0.5, fract((vWorld.z - vWorld.y) * 6.0));",
    "  introEmissive += clamp(introEmissive * tri * 13.0, 0.0, 1.0);",
    "  color += introEmissive * blue;",
    "  color = tuman(color, vMvz, vWorld.y);",
    "  gl_FragColor = vec4(dizer(color), 1.0);",
    "}"
  ].join("\n");

  /* ── Единичный скруглённый брусок ─────────────────────────────
     Один брусок на все блоки: InstancedMesh масштабирует его матрицей.
     Коробка 3x3x3 сегмента тянется к эллипсоиду на 0.38 - это скругление
     кромок, по которому шейдер находит рёбра. Швы вершин склеены, чтобы
     нормали шли через ребро гладко. */
  function брусок() {
    var гео = new T.BoxGeometry(1, 1, 1, 4, 4, 4);
    var p = гео.attributes.position;
    var карта = {}, нов = [], перенос = new Int32Array(p.count);
    for (var a = 0; a < p.count; a++) {
      var v = new T.Vector3(p.getX(a), p.getY(a), p.getZ(a));
      /* Скругление 0.26: при 0.38 блоки читались булыжником, у igloo это
         плоские плиты с мягкой кромкой. */
      var сф = v.clone().normalize().multiplyScalar(0.5);
      v.lerp(сф, 0.26);
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
    return г;
  }

  /* ── Кладка ───────────────────────────────────────────────────
     Ряды на полусфере, каждый следующий сдвинут на полблока, блоки
     касаются друг друга (зазора нет, шов даёт скругление кромок), без
     случайных наклонов: у igloo всё ровно. Арка входа впереди. */
  function кладка() {
    var куски = [];
    var семя = 31;
    function сл() { семя = (семя * 9301 + 49297) % 233280; return семя / 233280; }
    function кусок(центр, кват, разм, внутр) {
      куски.push({
        центр: центр, кват: кват, разм: разм,
        rand: new T.Vector3(сл(), сл(), сл()),
        внутр: внутр,
        disp: 0, td1: 0, td2: 0, bounce: 0, tb1: 0, tb2: 0, sd1: 0, sd2: 0,
        ao: 1, aoEx: 1
      });
    }
    /* КЛАДКА КРУПНАЯ, КАК У НИХ. Стояло восемь рядов при ширине блока в
       0.30 радиуса: на экваторе выходило под двадцать кусков в ряду и
       две сотни на купол. Такая кладка читается щебнем, а не кладкой -
       владелец сказал прямо, что домика не видно вовсе.

       У igloo на своде пять рядов и около десяти блоков в ряду, всего
       под полсотни. Блок там крупный, с ладонь по кадру, и именно
       поэтому он читается блоком: видно и его грань, и шов рядом.
       Ставим те же пропорции. */
    var рядов = W.ступень === 0 ? 4 : 5;
    var толщ = R * 0.20;
    for (var ряд = 0; ряд < рядов; ряд++) {
      var фи = (ряд + 0.5) / (рядов + 0.35) * (Math.PI / 2);
      var rРяда = Math.cos(фи) * R, yРяда = Math.sin(фи) * R;
      var выс = R * 0.26;
      var шир0 = R * 0.52;
      var n = Math.max(6, Math.round(2 * Math.PI * rРяда / шир0));
      var шир = 2 * Math.PI * rРяда / n;   /* без зазора, блоки касаются */
      var сдвиг = (ряд % 2) * 0.5;
      for (var i = 0; i < n; i++) {
        var th = ((i + сдвиг) / n) * Math.PI * 2;
        var кЦентру = Math.abs(Math.atan2(Math.sin(th), Math.cos(th)) - Math.PI / 2);
        if (ряд < 3 && кЦентру < 0.46) continue;
        var центр = new T.Vector3(Math.cos(th) * rРяда, yРяда, Math.sin(th) * rРяда);
        var норм = центр.clone().normalize();
        var q = new T.Quaternion().setFromUnitVectors(new T.Vector3(0, 0, 1), норм);
        /* Довернуть вокруг нормали так, чтобы «ширина» шла по кольцу. */
        var вдоль = new T.Vector3(-Math.sin(th), 0, Math.cos(th));
        var локX = new T.Vector3(1, 0, 0).applyQuaternion(q);
        var угл = Math.atan2(локX.clone().cross(вдоль).dot(норм), локX.dot(вдоль));
        q.premultiply(new T.Quaternion().setFromAxisAngle(норм, угл));
        кусок(центр, q, new T.Vector3(шир * 1.01, выс * 0.98, толщ), true);
      }
    }
    кусок(new T.Vector3(0, R * 0.99, 0), new T.Quaternion().setFromUnitVectors(new T.Vector3(0, 0, 1), new T.Vector3(0, 1, 0)), new T.Vector3(R * 0.34, R * 0.34, толщ), true);
    /* Арка: клинья полукольцом плюс опоры, вынесены вперёд. */
    var rАрки = R * 0.52, zАрки = R * 1.02, глА = R * 0.52;
    for (var a = 0; a < 7; a++) {
      var t = a / 6 * Math.PI;
      var ц = new T.Vector3(Math.cos(t) * rАрки, Math.sin(t) * rАрки + R * 0.06, zАрки);
      var нз = new T.Vector3(Math.cos(t), Math.sin(t), 0);
      var qa = new T.Quaternion().setFromUnitVectors(new T.Vector3(0, 1, 0), нз);
      кусок(ц, qa, new T.Vector3(R * 0.23, R * 0.26, глА), false);
    }
    for (var s = 0; s < 2; s++) for (var h = 0; h < 2; h++) {
      кусок(new T.Vector3((s ? 1 : -1) * rАрки, R * 0.06 + h * R * 0.2 - R * 0.13, zАрки), new T.Quaternion(), new T.Vector3(R * 0.15, R * 0.2, глА), false);
    }

    /* Затенение по кускам для двух состояний: 12 лучей из центра куска
       по полусфере вокруг его нормали против сфер соседей. Это их две
       карты света, посчитанные на месте. */
    var лучи = [];
    for (var l = 0; l < 12; l++) {
      var z = (l + 0.5) / 12, rr = Math.sqrt(1 - z * z), ph = l * 2.39996;
      лучи.push(new T.Vector3(Math.cos(ph) * rr, Math.sin(ph) * rr, z));
    }
    function затен(разлёт) {
      var центры = куски.map(function (к) {
        return разлёт ? к.центр.clone().addScaledVector(к.центр, 0.9 * плавно(0.3, 1, к.центр.y / R)) : к.центр;
      });
      for (var i2 = 0; i2 < куски.length; i2++) {
        var к = куски[i2], c = центры[i2];
        var норм = к.центр.clone().normalize();
        var баз = new T.Matrix4().lookAt(new T.Vector3(), норм.clone().negate(), new T.Vector3(0, 1, 0));
        var откр = 0;
        for (var l2 = 0; l2 < 12; l2++) {
          var dir = лучи[l2].clone().applyMatrix4(баз).normalize();
          var задет = 0;
          for (var b2 = 0; b2 < куски.length; b2++) {
            if (b2 === i2) continue;
            var o = центры[b2].clone().sub(c);
            var tt = o.dot(dir);
            if (tt <= 0 || tt > R * 1.2) continue;
            var qd = o.sub(dir.clone().multiplyScalar(tt)).lengthSq();
            var rb = куски[b2].разм.length() * 0.5;
            if (qd < rb * rb * 0.7) { задет = 1; break; }
          }
          if (!задет) откр += лучи[l2].z;
        }
        var v = зажать(откр / 6.0, 0, 1);
        if (разлёт) к.aoEx = v; else к.ao = v;
      }
    }
    затен(false); затен(true);
    return куски;
  }

  /* ── Валуны у подножия ────────────────────────────────────────

     БЫЛ ЛЁД, СТАЛ КАМЕНЬ, И ЭТО ПРАВКА ПО РЕАЛИЗМУ. У igloo дом стоит в
     зимних горах, и ледяные глыбы на своде там на месте. Мы перенесли
     дом на Луну, а глыбы приехали вместе с ним: полупрозрачные белые
     куски висели над куполом справа, ловили весь свет кадра и читались
     как ошибка. Льда на солнечной стороне Луны нет вовсе, он там не
     держится.

     Вместо них валуны выброса. Вокруг любого лунного кратера лежат
     камни, поднятые ударом, и по ним глаз считывает и масштаб станции,
     и то, что грунт настоящий. Материал тот же фотоскан, что у грунта,
     поэтому камни и поверхность родня друг другу.

     Лежат НА ГРУНТЕ вокруг купола, а не на своде: на своде они держались
     бы только рисунком. Радиус разлёта от 1.35 до 2.4 радиуса купола,
     чтобы не спорить с аркой входа и не лезть под слова слева. */
  function лёд(гео) {
    var гр = new T.Group();
    /* Своя геометрия, а не кирпич кладки. Кирпич скруглён, но остаётся
       кирпичом: пять таких у подножия читались бы обломками стены, а не
       валунами выброса. Двадцатигранник с шумом по вершинам даёт
       угловатый камень с гранями, ровно такой, какие лежат на снимках
       Аполлона. Нормали пересчитываются после сдвига, иначе свет ляжет
       по исходной сфере и камень будет гладким на вид при рваной форме. */
    var кам = new T.IcosahedronGeometry(1, 2);
    (function () {
      var п = кам.attributes.position, с = 7.1;
      function ш(x, y, z) {
        var v = Math.sin(x * 1.7 + с) * Math.sin(y * 2.3 - с) * Math.sin(z * 1.9 + с * 0.5);
        return v * 0.5 + Math.sin(x * 4.1) * Math.sin(z * 3.7) * 0.22;
      }
      for (var i = 0; i < п.count; i++) {
        var x = п.getX(i), y = п.getY(i), z = п.getZ(i);
        var k = 1 + ш(x, y, z) * 0.34;
        п.setXYZ(i, x * k, y * k, z * k);
      }
      п.needsUpdate = true;
      кам.computeVertexNormals();
      if (g.RV_ПБР && g.RV_ПБР["готовьГео"]) g.RV_ПБР["готовьГео"](кам);
    })();
    var мат = new T.MeshStandardMaterial({
      color: 0xFFFFFF, roughness: 0.95, metalness: 0.0, envMapIntensity: 0.55
    });
    if (g.RV_ПБР && g.RV_ПБР["одеть"]) {
      g.RV_ПБР["одеть"](мат, "реголит", { повтор: 2.4, рельеф: 1.0, затенение: 0.9 });
    }
    М.лёдМат = мат;
    /* угол, радиус, доля утопания в грунт, три полуоси, поворот */
    var места = [
      [0.62, 1.52, 0.34, 0.30, 0.24, 0.26, 0.4],
      [1.95, 1.38, 0.42, 0.22, 0.16, 0.20, -0.9],
      [3.40, 2.05, 0.30, 0.38, 0.27, 0.32, 1.3],
      [4.35, 1.72, 0.46, 0.18, 0.13, 0.17, 0.2],
      [5.55, 2.35, 0.36, 0.26, 0.19, 0.23, -0.5]
    ];
    for (var i = 0; i < места.length; i++) {
      var м = места[i];
      var mesh = new T.Mesh(кам, мат);
      /* Камень утоплен в грунт на свою долю: валун, поставленный НА
         поверхность ровно, читается приклеенным шариком. */
      mesh.position.set(Math.cos(м[0]) * м[1] * R, (м[4] * (0.5 - м[2])) * R, Math.sin(м[0]) * м[1] * R);
      mesh.scale.set(м[3] * R, м[4] * R, м[5] * R);
      mesh.rotation.set(м[6] * 0.5, м[6], м[6] * 0.3);
      гр.add(mesh);
    }
    return гр;
  }

  /* ── Сборка ───────────────────────────────────────────────────*/
  function построить(мир) {
    if (собрано) return true;
    W = мир || W;
    if (!W || !W.T || !W.scene || !W.r) return false;
    T = W.T;

    М.корень = new T.Group();
    М.корень.name = "станция";
    М.корень.position.fromArray(НА);
    М.корень.visible = false;
    W.scene.add(М.корень);

    var град = g.RV_ЛУНА ? g.RV_ЛУНА["градиент"] : null;
    if (g.RV_ЛУНА) {
      var луна = g.RV_ЛУНА["собрать"](W);
      if (луна) М.корень.add(луна);
      М.тень = g.RV_ЛУНА["тень"](0, 0, R * 1.35);
    }
    if (!град) {
      град = { uColor1: { value: new T.Color(0x202A48) }, uColor2: { value: new T.Color(0x05070F) },
               uResolution: { value: new T.Vector2(1, 1) }, uTime: { value: 0 }, uDen: { value: 0 } };
    }
    М.град = град;
    М.купол = new T.Group();
    /* Имя нужно приборной разметке (rv-опознаватели.js): она находит
       предмет по имени и снимает его настоящую габаритную коробку,
       поэтому точки съёма ложатся НА купол при любой раскладке. */
    М.купол.name = "купол";
    М.корень.add(М.купол);
    М.сдвиг = new T.Vector3();

    М.куски = кладка();
    var N = М.куски.length;
    var гео = брусок();
    var aDisp = new Float32Array(N), aBounce = new Float32Array(N), aAO = new Float32Array(N), aAOex = new Float32Array(N), aInner = new Float32Array(N);
    var aSeed = new Float32Array(N);
    for (var i = 0; i < N; i++) {
      var к = М.куски[i];
      /* Семя блока для сдвига координат фотоскана. Берётся от центра
         куска, а не от счётчика: у соседей по кладке центры разные, и
         соседние блоки гарантированно возьмут разные участки скана. */
      aSeed[i] = ((к.центр.x * 12.9898 + к.центр.y * 78.233 + к.центр.z * 37.719) * 43758.5453) % 1;
      if (aSeed[i] < 0) aSeed[i] += 1;
      aAO[i] = к.ao; aAOex[i] = к.aoEx;
      /* Эмиссия у них запечена по вершинам; у нас куску целиком: блоки
         арки не светят, верхние ряды светят сильнее. */
      aInner[i] = к.внутр ? зажать(0.35 + 0.65 * (к.центр.y / R), 0, 1) : 0;
    }
    гео.setAttribute("aDisp", new T.InstancedBufferAttribute(aDisp, 1));
    гео.setAttribute("aBounce", new T.InstancedBufferAttribute(aBounce, 1));
    гео.setAttribute("aAO", new T.InstancedBufferAttribute(aAO, 1));
    гео.setAttribute("aAOex", new T.InstancedBufferAttribute(aAOex, 1));
    гео.setAttribute("aInner", new T.InstancedBufferAttribute(aInner, 1));
    гео.setAttribute("aSeed", new T.InstancedBufferAttribute(aSeed, 1));
    гео.attributes.aDisp.setUsage(T.DynamicDrawUsage);
    гео.attributes.aBounce.setUsage(T.DynamicDrawUsage);
    М.aDisp = гео.attributes.aDisp; М.aBounce = гео.attributes.aBounce;

    /* Карты панели общие для кладки и обводки: обводка идёт тем же
       фрагментным шейдером, и без этих униформ он бы просто не собрался.
       Объекты униформ ОДНИ И ТЕ ЖЕ, поэтому доехавший файл появляется
       сразу в обоих материалах. */
    М.uТек = { value: null };
    М.uТекН = { value: null };
    М.uТекДоля = { value: 0 };
    var общие = {
      uColor1: град.uColor1, uColor2: град.uColor2, uResolution: град.uResolution,
      uTime: град.uTime, uDen: град.uDen, uIntro: { value: 0 }, uH: { value: R },
      tBlok: М.uТек, tBlokN: М.uТекН, uTex: М.uТекДоля
    };

    /* Фотоскан панели (ambientCG, CC0). Едет лениво: до приезда кладка
       живёт на хеш-крупе и выглядит как раньше, поломки нет. Доля
       подмеса поднимается только когда пришли ОБЕ карты, иначе рельеф
       встал бы без цвета и панель на секунду позеленела бы. */
    (function () {
      var загр = new T.TextureLoader(), пришло = 0;
      var анизо = 4;
      try {
        if (W && W.r && W.r.capabilities) анизо = Math.max(1, Math.min(8, W.r.capabilities.getMaxAnisotropy()));
      } catch (e) {}
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
    М.кладкаМат = new T.ShaderMaterial({
      uniforms: Object.assign({}, общие, {
        uOutline: { value: 0 },
        uKamen: { value: new T.Color(0x7A7D86) }, uTen: { value: new T.Color(0x3E4658) },
        uVerh: { value: new T.Color(0x9BA2B2) }, uNiz: { value: new T.Color(0x4C5468) },
        uGlow: { value: new T.Color(0xBFD4FF) }
      }),
      vertexShader: В_БЛОК, fragmentShader: Ф_БЛОК, fog: false
    });
    М.кладка = new T.InstancedMesh(гео, М.кладкаМат, N);
    /* Имя для приборной разметки. Целимся именно в кладку, а не в группу
       купола: в группе лежат ещё плоскость тени размером в семь радиусов
       и валуны на подножии, и габариты группы выходят вшестеро больше
       самого купола. Точки съёма от такой коробки улетают в пустое небо. */
    М.кладка.name = "кладка";
    М.кладка.frustumCulled = false;
    М.кладка.renderOrder = 10;
    М.кладка.instanceMatrix.setUsage(T.DynamicDrawUsage);
    М.купол.add(М.кладка);

    if (W.ступень > 0) {
      М.обводкаМат = new T.ShaderMaterial({
        uniforms: Object.assign({}, общие, {
          uOutline: { value: 1 },
          uKamen: { value: new T.Color(0) }, uTen: { value: new T.Color(0) },
          uVerh: { value: new T.Color(0) }, uNiz: { value: new T.Color(0) }, uGlow: { value: new T.Color(0) }
        }),
        vertexShader: В_БЛОК, fragmentShader: Ф_БЛОК,
        side: T.BackSide, transparent: true, depthWrite: false, fog: false
      });
      М.обводкаМат.uniforms.uIntro = М.кладкаМат.uniforms.uIntro;
      М.обводка = new T.InstancedMesh(гео, М.обводкаМат, N);
      М.обводка.instanceMatrix = М.кладка.instanceMatrix;
      М.обводка.frustumCulled = false;
      М.обводка.renderOrder = 9;
      М.купол.add(М.обводка);

      /* Настоящая тень от блоков на грунт: карта теней от источника
         нулевой силы (он ничего не освещает, чтобы не засветить соседние
         акты), принимает её плоскость с ShadowMaterial, синяя. */
      if (!W.r.shadowMap.enabled) { W.r.shadowMap.enabled = true; W.r.shadowMap.type = T.PCFSoftShadowMap; }
      М.солнце = new T.DirectionalLight(0xffffff, 0);
      М.солнце.position.set(-5.5, 7.8, 3.0);
      М.солнце.castShadow = true;
      М.солнце.shadow.mapSize.set(W.ступень === 2 ? 1024 : 512, W.ступень === 2 ? 1024 : 512);
      var ск = М.солнце.shadow.camera;
      ск.left = -R * 3.5; ск.right = R * 3.5; ск.top = R * 3.5; ск.bottom = -R * 3.5; ск.near = 0.5; ск.far = 30;
      М.солнце.shadow.bias = -0.0015;
      М.купол.add(М.солнце); М.купол.add(М.солнце.target);
      М.кладка.castShadow = true;
      М.тень3д = new T.Mesh(new T.PlaneGeometry(R * 7, R * 7), new T.ShadowMaterial({ color: 0x1C2A5E, opacity: 0.55, transparent: true }));
      М.тень3д.rotation.x = -Math.PI / 2;
      М.тень3д.position.y = 0.012;
      М.тень3д.receiveShadow = true;
      М.тень3д.renderOrder = -5;
      М.купол.add(М.тень3д);

      М.лёд = лёд(гео);
      М.лёд.children.forEach(function (m) { m.castShadow = true; });
      М.купол.add(М.лёд);

      var шум = g.RV_ЛУНА && g.RV_ЛУНА["шум"] ? g.RV_ЛУНА["шум"]() : null;
      if (шум) {
        var лучМат = new T.ShaderMaterial({
          uniforms: { uColor1: град.uColor1, uColor2: град.uColor2, uResolution: град.uResolution,
                      uTime: град.uTime, uDen: град.uDen, tMap: { value: шум },
                      uCol: { value: new T.Color(0x9FC4FF) }, uAlpha: { value: 0.08 } },
          vertexShader: "varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }",
          fragmentShader: [
            ОБЩЕЕ,
            "uniform sampler2D tMap; uniform vec3 uCol; uniform float uAlpha; varying vec2 vUv;",
            "void main(){",
            "  float t = uTime * 0.12;",
            "  float noise = texture2D(tMap, vUv * vec2(1.0, 0.46) + vec2(t, t * 0.323)).r;",
            "  noise += texture2D(tMap, vUv * vec2(0.5, 0.25) + vec2(-t * 0.77, -t * 0.414)).r;",
            "  float circularGradient = pow(1.0 - clamp(length(vUv - 0.5) * 2.0, 0.0, 1.0), 2.0);",
            "  float a = noise * circularGradient * uAlpha;",
            "  gl_FragColor = vec4(uCol * a, a);",
            "}"
          ].join("\n"),
          transparent: true, depthWrite: false, blending: T.AdditiveBlending, fog: false
        });
        М.луч = new T.Mesh(new T.PlaneGeometry(1, 1), лучМат);
        М.луч.position.set(0, R * 0.55, R * 1.5);
        М.луч.scale.set(R * 0.9, R * 1.6, 1);
        М.луч.rotation.x = -40 * Math.PI / 180;
        М.луч.renderOrder = 11;
        М.купол.add(М.луч);
      }
    }

    М.интро = 0;
    /* Модулятор вступления обязан быть числом ДО первой записи матриц:
       умножение на undefined давало NaN, и NaN пережил все лерпы - купол
       не рисовался вовсе (четвёртая сборка, кадр без единого блока). */
    М.интроМод = 0;
    М.мышь = new T.Vector3(0, R * 0.5, 0);
    М.мышьЦель = new T.Vector3(0, R * 0.5, 0);
    М.мышьСкор = 0;
    М.естьМышь = false;
    М.наведено = false;
    М.кусокПосл = 0;
    М.открытоБыло = false;
    М.сбор = 0;
    указатель();
    раскладка();
    g.addEventListener("rv-тема", function (е) { тема(е && е.detail); });
    тема(d.documentElement.getAttribute("data-тема") === "светлая" ? "светлая" : "тёмная");
    собрано = true;
    писатьМатрицы(0, 0, 1 / 60, 0);
    return true;
  }

  /* Место купола в кадре. Широкий кадр: купол вправо на 3.2 (слова
     слева). Узкий: купол на месте, а ВЫШЕ поднимается точка, на которую
     смотрит камера, - тогда купол уходит в нижнюю половину под слова.
     Опускать сам купол нельзя: он уходит под грунт (шестая сборка,
     купол пропал под поверхностью). Поза переобъявляется, как это
     делает акт «выход» на узком экране. */
  function раскладка() {
    if (!М.купол) return;
    var ш = g.innerWidth || 1, в = g.innerHeight || 1;
    var широкий = ш / в > 1.1;
    М.сдвиг.set(широкий ? 4.4 : 0, 0, широкий ? 0 : 1.2);
    М.купол.position.copy(М.сдвиг);
    М.купол.scale.setScalar(широкий ? 1 : 1.12);
    if (М.тень) М.тень.set(М.сдвиг.x, М.сдвиг.z, R * (широкий ? 1.35 : 1.5));
    поза(широкий);
  }

  var позаБыла = null;
  function поза(широкий) {
    if (!g.RV_WORLD) return;
    var ключ = широкий ? "ш" : "у";
    if (позаБыла === ключ) return;
    позаБыла = ключ;
    var подъём = широкий ? 0 : 3.1;
    g.RV_WORLD["поза"](ИМЯ, {
      "на": [НА[0], НА[1] + подъём, НА[2]],
      "от": [ОТ[0], ОТ[1] + подъём, ОТ[2]],
      "подход": 4.0, "уход": -3.0,
      "поле": [50, 47, 44],
      "бок": [1.6, 0.3, -0.8],
      "крен": [0, 0, 0],
      /* Пролог короче, чем у оболочки (80): при 60 разбег до станции
         давал размах скорости 29 при пороге 25, а высота 14 - спуск к
         оболочке в 8.5 единицы за кадр флика на телефоне при пороге 8. */
      "пролог": 45
    });
  }

  function тема(имя) {
    if (!М.кладкаМат) return;
    var у = М.кладкаМат.uniforms;
    /* ПАЛИТРА КУПОЛА СИДИТ НА ЛУННОМ АЛЬБЕДО, А НЕ НА СНЕЖНОМ.

       Стояли снежные числа: камень 0x9A9CA3, верхний свет 0xE2E6EE. У
       igloo так и надо, у них дом снежный. У нас купол сложен из того же
       грунта, что под ним, а грунт после правки сидит на средней 110 из
       255. Светлый камень поверх тёмного грунта давал разрыв: низ
       читался Луной, верх выбитой в белое крышей, и купол выходил
       плоским пятном.

       Верхний свет это не солнце, а отсвет Земли и звёзд, он не может
       быть ярче самого камня под солнцем. Отсюда 0xA6ADBC вместо белого.
       Тень глубокая: атмосферы нет, рассеивать нечем. */
    if (имя === "светлая") {
      у.uKamen.value.setHex(0x8E9199); у.uTen.value.setHex(0x4A5164);
      у.uVerh.value.setHex(0xC4CAD6); у.uNiz.value.setHex(0x5A637C);
    } else {
      у.uKamen.value.setHex(0x7A7D86); у.uTen.value.setHex(0x3E4658);
      у.uVerh.value.setHex(0x9BA2B2); у.uNiz.value.setHex(0x4C5468);
    }
  }

  /* Их planeInteraction: точка экрана на плоскость поперёк взгляда через
     центр купола, честным лучом. */
  function указатель() {
    var луч = new T.Vector3(), пл = new T.Plane(), точка = new T.Vector3();
    function на(x, y) {
      if (!W.cam) return;
      var nx = (x / (g.innerWidth || 1)) * 2 - 1;
      var ny = -(y / (g.innerHeight || 1)) * 2 + 1;
      луч.set(nx, ny, 0.5).unproject(W.cam).sub(W.cam.position).normalize();
      var вперёд = new T.Vector3(); W.cam.getWorldDirection(вперёд);
      var центр = new T.Vector3().copy(М.сдвиг).add(new T.Vector3(0, R * 0.5, 0)).add(new T.Vector3().fromArray(НА));
      пл.setFromNormalAndCoplanarPoint(вперёд, центр);
      if (!new T.Ray(W.cam.position, луч).intersectPlane(пл, точка)) return;
      М.мышьЦель.set(точка.x - НА[0] - М.сдвиг.x, точка.y - НА[1] - М.сдвиг.y, точка.z - НА[2] - М.сдвиг.z);
      if (М.купол.scale.x !== 1) М.мышьЦель.divideScalar(М.купол.scale.x);
      М.естьМышь = true;
    }
    g.addEventListener("pointermove", function (е) { if (е.pointerType !== "touch") на(е.clientX, е.clientY); }, { passive: true });
    g.addEventListener("touchstart", function (е) { var t = е.touches[0]; if (t) на(t.clientX, t.clientY); }, { passive: true });
    g.addEventListener("touchmove", function (е) { var t = е.touches[0]; if (t) на(t.clientX, t.clientY); }, { passive: true });
    g.addEventListener("touchend", function () { М.мышьЦель.set(99, 99, 99); }, { passive: true });
  }

  function событие(что, сила) {
    try { g.dispatchEvent(new CustomEvent("rv:станция", { detail: { "что": что, "сила": сила || 0 } })); } catch (e) {}
  }

  /* ── Кадр: их update() по строкам ────────────────────────────── */
  var _м = null, _q = null, _v = null, _s = null;
  function писатьМатрицы(доля, t, dt, часы) {
    if (!_м) { _м = new T.Matrix4(); _q = new T.Quaternion(); _v = new T.Vector3(); _s = new T.Vector3(); }
    var кс = лерпК(0.05, dt), кд = лерпК(0.06, dt);
    /* Прокрутка: s = ease(fit(progress, 0, 0.4, 1, 0), sine.in) - на старте
       верх раздвинут, к 0.4 собран. У нас плюс раскрытие на уходе:
       после 0.72 те же куски снова приподнимаются, пропуская камеру. */
    var s0 = fit(доля, 0, 0.4, 1, 0);
    var s = 1 - Math.cos(s0 * Math.PI / 2);          /* sine.in */
    var раскр = плавно(0.72, 1.0, доля) * 1.15;
    s = Math.max(s, раскр);
    var n = лерпК(0.075, dt);
    var сумма = 0;
    for (var i = 0; i < М.куски.length; i++) {
      var a = М.куски[i];
      /* Дыхание: их формула. */
      var l = 0.4;
      l *= Math.sin(-часы * 2 + a.центр.x) * 0.5 + 0.5;
      l *= Math.cos(-часы) * 0.5 + 0.5;
      l *= 0.5 + 1.5 * a.rand.z;
      l *= 0.5;
      l *= М.интроМод;
      /* Курсор: кольцо 1..3 их единиц, у нас в долях R (их иглу ~4 R). */
      var c = Math.sin(часы + a.rand.x * 12.342) * a.rand.y;
      var dm = _v.copy(a.центр).sub(М.мышь).length() / (R * 0.25);
      var h = fit(плавно(1, 3, dm), 0, 1, 0.5 + 0.3 * c, 0);
      l = Math.max(l, h * t);
      a.tb1 = l;
      a.tb2 += (a.tb1 - a.tb2) * кс;
      a.bounce += (a.tb2 - a.bounce) * кс;
      var dY = плавно(0.45, 0.7, a.центр.y / R);
      l *= dY;
      l = Math.max(0, l);
      a.td1 = l;
      a.td2 += (a.td1 - a.td2) * кд;
      a.disp += (a.td2 - a.disp) * кд;
      var u = плавно(0.3, 1, a.центр.y / R);
      var f = fit(a.rand.x, 0.4, 1, 0, 1) * 2;
      var p = s * u * f;
      a.sd1 += (p - a.sd1) * n;
      a.sd2 += (a.sd1 - a.sd2) * n;
      /* position = centroid + centroid * displacement (радиально). */
      _v.copy(a.центр).addScaledVector(a.центр, a.disp).addScaledVector(a.центр, a.sd2);
      var A = a.sd2 * a.rand.x * -1.5, Bm = a.sd2 * a.rand.y * -1.5, C = a.sd2 * a.rand.z * -1.5;
      _q.copy(a.кват);
      _q.multiply(new T.Quaternion().setFromAxisAngle(new T.Vector3(0, 1, 0), Math.cos(a.disp * 2 + a.rand.z * 30) * a.disp * 0.5 + A));
      _q.multiply(new T.Quaternion().setFromAxisAngle(new T.Vector3(0, 0, 1), Math.cos(a.disp * 2 + a.rand.x * 30) * a.disp * 0.5 + Bm));
      _q.multiply(new T.Quaternion().setFromAxisAngle(new T.Vector3(1, 0, 0), Math.cos(a.disp * 2 + a.rand.y * 30) * a.disp * 0.5 + C));
      _м.compose(_v, _q, a.разм);
      М.кладка.setMatrixAt(i, _м);
      М.aDisp.array[i] = a.disp; М.aBounce.array[i] = a.bounce;
      сумма += a.sd2;
    }
    М.кладка.instanceMatrix.needsUpdate = true;
    if (М.обводка) М.обводка.instanceMatrix = М.кладка.instanceMatrix;
    М.aDisp.needsUpdate = true; М.aBounce.needsUpdate = true;
    М.сбор = 1 - зажать(сумма / (М.куски.length * 0.5), 0, 1);
    return s;
  }

  function кадр(доля, dt, часы) {
    if (!собрано || !М.корень.visible) return;
    /* Проявление снизу вверх за 2.4 с; дыхание и курсор включаются после. */
    М.интро = Math.min(1, М.интро + dt / 2.4);
    М.кладкаМат.uniforms.uIntro.value = 1 - Math.pow(1 - М.интро, 2);
    М.интроМод = М.интро >= 1 ? 1 : 0;
    /* Курсор: их лерп 0.05 и скорость с трением 0.98. */
    М.мышь.lerp(М.мышьЦель, лерпК(0.05, dt));
    М.мышьСкор += _v ? _v.copy(М.мышьЦель).sub(М.мышь).length() * 0.01 : 0;
    М.мышьСкор *= Math.pow(0.98, зажать(dt * 60, 0.05, 4));
    М.мышьСкор = зажать(М.мышьСкор, 0, 1);
    var t = М.интро >= 1 ? 1 : 0;
    var s = писатьМатрицы(доля, t, dt, часы);
    if (!М.сборБыл && М.интро >= 1) { М.сборБыл = true; событие("сбор", 1); }
    if (!М.открытоБыло && доля > 0.75) { М.открытоБыло = true; событие("разлёт", 1); }
    if (М.открытоБыло && доля < 0.7) М.открытоБыло = false;
    var рядом = М.мышь.distanceTo(new T.Vector3(0, R * 0.5, 0)) < R * 1.2;
    if (рядом && !М.наведено) { М.наведено = true; событие("наведение", 1); }
    if (!рядом) М.наведено = false;
    if (рядом && М.мышьСкор > 0.05 && часы - М.кусокПосл > 0.125) { М.кусокПосл = часы; событие("кусок", М.мышьСкор); }
    /* Валуны лежат на грунте и никуда не едут. Прежде тут поднималась
       эмиссия ледяных глыб от курсора и раскрытия и вся группа всплывала
       на треть радиуса. Камень не светится от того, что мимо провели
       мышью, и с земли сам не встаёт. */
    if (g.RV_ЛУНА) g.RV_ЛУНА["кадр"](доля, dt, часы, W.cam);
    else { М.град.uTime.value = часы; if (W.r && W.r.getDrawingBufferSize) W.r.getDrawingBufferSize(М.град.uResolution.value); }
  }

  var МОДУЛЬ = {
    "собрать": function (мир) { построить(мир); },
    "показать": function (да) {
      if (да && !собрано) построить(g.RV_WORLD ? g.RV_WORLD["мир"]() : null);
      if (собрано) М.корень.visible = !!да;
    },
    "кадр": кадр,
    "размер": function () { if (собрано) раскладка(); }
  };

  function встать() {
    if (!g.RV_WORLD) return false;
    var ш = g.innerWidth || 1, в = g.innerHeight || 1;
    поза(ш / в > 1.1);
    g.RV_WORLD["акт"](ИМЯ, МОДУЛЬ);
    return true;
  }
  if (!встать()) {
    var попыток = 0;
    var т = g.setInterval(function () { if (встать() || ++попыток > 50) g.clearInterval(т); }, 200);
  }

  g.RV_СТАНЦИЯ = {
    "положение": function () { return НА.slice(); },
    /* Габариты ПОКОЯЩЕГОСЯ купола для приборной разметки.

       Снимать их габаритной коробкой нельзя: по закону igloo блоки
       расходятся наружу по радиусу весь акт, и коробка вырастает вместе
       с ними. Замер на середине акта давал верх на 16.5 при настоящей
       макушке 13.3, и точки съёма улетали в небо над куполом.

       Здесь отдаётся то, что не меняется: мировая середина основания
       купола и его радиус. Сдвиг раскладки (вправо на широком экране) и
       масштаб (крупнее на узком) учтены, потому что берутся живьём. */
    "габариты": function () {
      if (!собрано || !М.купол) return null;
      var м = М.купол.scale ? М.купол.scale.x : 1;
      return {
        /* Середина это ОСНОВАНИЕ купола, а не его полувысота. Купол
           полусфера, стоящая на грунте: её поверхность это радиус от
           точки на грунте, и точка съёма ложится на неё как центр плюс
           радиус на единичное направление. Полувысота увела бы все
           точки ровно на полрадиуса вверх, мимо купола. */
        "центр": [НА[0] + М.сдвиг.x, НА[1], НА[2] + М.сдвиг.z],
        "радиус": R * м
      };
    },
    "состояние": function () {
      return { "сбор": М.сбор || 0, "кусков": М.куски ? М.куски.length : 0, "наведено": !!М.наведено, "собрано": собрано };
    }
  };
})(window, document);
