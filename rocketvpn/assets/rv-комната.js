/* Rocket VPN. Комната внизу: то, куда падает человек из шахты.

   ЗАЧЕМ. Владелец описал ход дословно: «дальше у них движение камеры
   после туннеля сразу выходит на фигуру частицами, также и у нас, и фон
   такой же как у них сделать, где частицы, 1:1 чисто точно такой же». И
   следом: «только у нас в комнате с частицами ещё по скроллу мы обходим
   вокруг, потом ещё смотрим разделы с текстом и анкету и кнопки всякие.
   Главное, что текст не перекрывает наши 3D объекты и сцену, текст часть
   этой сцены, как у igloo».

   ЧТО У НИХ (docs/РАЗБОР-IGLOO-ДВИЖЕНИЕ.md, «Комната внизу»). Падение
   кончается, и на последней трети таймлайна включаются шесть объектов:

     пол                    3.4 с, прозрачность 0 к 1 за 5 с
     дымка у пола           3.4 с, масштаб (5, 0.1, 5)
     окружающие частицы     3.4 с, шестьдесят точек
     силовое поле           4.0 с, Cylinder(1,1,3,64,6), y -10.13, масштаб 0.28
     цилиндр с текстом      4.5 с, y -10.33, две копии: 1.75 и 3.5 с поворотом
     дымка у потолка        4.5 с

   Ни одного твина прозрачности на самих предметах: включаются
   переключением видимости, а мягкость даёт шейдер по расстоянию.

   НАШ МАСШТАБ ВЧЕТВЕРО. Их падение идёт одиннадцать единиц (с 1.5 на
   -9.83), наше сорок шесть. Все их числа умножены на четыре, поэтому
   комната относительно человека выглядит так же, как у них.

   ЦИЛИНДР ТЕКСТА ЭТО ФОН, А НЕ СОДЕРЖАНИЕ. У них на нём размытые
   четырёхугольники из атласа 256x256 - буквы, которые не читаются и не
   должны. Он делает воздух комнаты текстовым. Читаемые разделы стоят
   отдельно, буквами поля расстояний (rv-слово3d.js), и появляются по
   ходу обхода. Так текст оказывается частью сцены и при этом ничего не
   закрывает: у фона своя глубина, у слов своя.

   API:
     RV_КОМНАТА.собрать(мир, о) -> Group | null
     RV_КОМНАТА.кадр(доля, dt, часы)
     RV_КОМНАТА.видно(да)
     RV_КОМНАТА.замер() */
(function (g, d) {
  "use strict";

  var W = null, T = null;
  var М = {};
  var собрано = false;
  var просят = {};

  /* Их числа, помноженные на четыре: наше падение вчетверо длиннее. */
  var К = 4.0;

  function зажать(v, н, в) { return v < н ? н : (v > в ? в : v); }
  function мягко(a, b, x) { x = зажать((x - a) / (b - a), 0, 1); return x * x * (3 - 2 * x); }

  /* ── Пол ──────────────────────────────────────────────────────
     Настоящей тени в сцене нет ни одной, и у igloo её тоже нет: контакт
     предмета с полом нарисован формулой. Их строки:

       float shadow = min(1.0, length(vPos * 1.5 + vec3(1.15, 0.0, -0.55)));
       shadow = pow(shadow, 2.0);
       shadow += sin(time * 3.3 + vPos.z * 5.0) * 0.1 + 0.1;
       shadow += sin(time * 3.1 + vPos.x * 4.0) * 0.1 + 0.1;
       shadow = mix(0.5, 1.0, shadow);
       color *= mix(vec3(0.5, 0.7, 1.0) * 0.1, vec3(1.0), shadow);

     Смещение ставит центр тени под предметом, квадрат даёт мягкий спад,
     две синусоиды с частотами 3.3 и 3.1 по разным осям дают тени
     дыхание. Главное в последней строке: тень уходит НЕ В ЧЁРНОЕ, а в
     тёмно-синее (0.05, 0.07, 0.10). Тот же синий (0.5, 0.7, 1.0) кочует
     по всей их сцене как единый цвет холодного отражённого света. */
  var В_ПОЛ = [
    "varying vec3 vPos;",
    "varying vec2 vUv;",
    "void main(){",
    "  vPos = position;",
    "  vUv = uv;",
    "  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);",
    "}"
  ].join("\n");

  var Ф_ПОЛ = [
    "uniform vec3 uC1;",
    "uniform vec3 uC2;",
    "uniform float uTime;",
    "uniform float uAlpha;",
    "varying vec3 vPos;",
    "varying vec2 vUv;",
    "float hash12(vec2 p){",
    "  vec3 p3 = fract(vec3(p.xyx) * 0.1031);",
    "  p3 += dot(p3, p3.yzx + 33.33);",
    "  return fract((p3.x + p3.y) * p3.z);",
    "}",
    "void main(){",
    "  vec2 c = vPos.xz / 24.0;",
    "  float r = length(c);",
    "  vec3 color = mix(uC2, uC1, clamp(r * 1.2, 0.0, 1.0));",
    /* Поддельная тень под фигурой, их формула в наших единицах. */
    "  float shadow = min(1.0, length(vPos * 0.0625 + vec3(1.15, 0.0, -0.55)));",
    "  shadow = pow(shadow, 2.0);",
    "  shadow += sin(uTime * 3.3 + vPos.z * 0.31) * 0.1 + 0.1;",
    "  shadow += sin(uTime * 3.1 + vPos.x * 0.25) * 0.1 + 0.1;",
    "  shadow = mix(0.5, 1.0, shadow);",
    "  color *= mix(vec3(0.5, 0.7, 1.0) * 0.1, vec3(1.0), shadow);",
    /* Их же фальшивый ключ сбоку: пол светлее с одной стороны. */
    "  color *= mix(0.65, 1.0, vPos.x * 0.0208 + 0.5);",
    "  color += (vPos.x * 0.0417 + 1.0) * 0.02;",
    /* Пол растворяется к краю: у комнаты нет стен, и обрубленный диск
       выдал бы её размер. */
    "  float край = 1.0 - smoothstep(0.72, 1.0, r);",
    "  color += (hash12(gl_FragCoord.xy + uTime) - 0.5) / 255.0;",
    "  gl_FragColor = vec4(color, край * uAlpha);",
    "}"
  ].join("\n");

  /* ── Цилиндр фонового текста ──────────────────────────────────
     У них это размытые четырёхугольники из атласа. Своего атласа
     размытых букв у нас нет, и печатать его ради фона незачем: рисунок
     считается. Столбцы знаков идут по окружности, каждый знак это мягкое
     пятно, и всё вместе читается стеной текста, набранного слишком
     мелко, чтобы разобрать. Ровно та роль, что у них.

     Их гашение по строкам:
       alpha *= clamp(vPos.y * 2.0, 0.0, 1.0);
       alpha *= sin(time*2.0 + vRand*10.0 + (vPos.x*2.0 + vPos.z*2.0))*0.5 + 0.5;
       alpha *= falloffsmooth(length(vPos.xz), 0.0, 10.0, 3.0, uAlpha);
       alpha *= 0.7 * uAlpha; */
  var В_ЦИЛ = [
    "varying vec2 vUv;",
    "varying vec3 vPos;",
    "void main(){",
    "  vUv = uv; vPos = position;",
    "  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);",
    "}"
  ].join("\n");

  var Ф_ЦИЛ = [
    "uniform vec3 uCvet;",
    "uniform float uTime;",
    "uniform float uAlpha;",
    "varying vec2 vUv;",
    "varying vec3 vPos;",
    "float hash12(vec2 p){",
    "  vec3 p3 = fract(vec3(p.xyx) * 0.1031);",
    "  p3 += dot(p3, p3.yzx + 33.33);",
    "  return fract((p3.x + p3.y) * p3.z);",
    "}",
    "void main(){",
    /* Решётка знаков: сто двадцать по окружности, двадцать восемь по
       высоте. Моноширинная сетка - тот же ритм, что у нашего шрифта. */
    "  vec2 сетка = vec2(120.0, 28.0);",
    "  vec2 кл = floor(vUv * сетка);",
    "  vec2 вн = fract(vUv * сетка);",
    "  float есть = step(0.28, hash12(кл));",
    /* Знак это вертикальный штрих с рваными краями: на расстоянии
       буква любого шрифта читается именно так. */
    "  float ш = smoothstep(0.14, 0.30, вн.x) * smoothstep(0.86, 0.70, вн.x);",
    "  float в = smoothstep(0.10, 0.26, вн.y) * smoothstep(0.90, 0.74, вн.y);",
    "  float знак = ш * в * есть * (0.5 + 0.5 * hash12(кл + 7.3));",
    "  float a = знак;",
    /* Их четыре множителя гашения. */
    "  a *= clamp(vPos.y * 0.5 + 0.5, 0.0, 1.0);",
    "  a *= sin(uTime * 2.0 + hash12(кл) * 10.0 + (vPos.x * 0.5 + vPos.z * 0.5)) * 0.5 + 0.5;",
    "  a *= 0.7 * uAlpha;",
    "  if (a < 0.004) discard;",
    "  gl_FragColor = vec4(uCvet, a);",
    "}"
  ].join("\n");

  /* ── Дымка ────────────────────────────────────────────────────
     Плоский слой у пола и у потолка. У них поземка считается как
     pow(value*3, 3) + pow(screenUv.x, 2)*fade*0.15. */
  var Ф_ДЫМКА = [
    "uniform sampler2D tWind;",
    "uniform vec3 uCvet;",
    "uniform float uTime;",
    "uniform float uAlpha;",
    "varying vec2 vUv;",
    "varying vec3 vPos;",
    "void main(){",
    "  float t = uTime * 0.04;",
    "  float v = texture2D(tWind, vUv * 2.0 + vec2(t, -t * 0.6)).r;",
    "  v *= texture2D(tWind, vUv * 3.5 + vec2(-t * 0.7, t * 0.4)).r;",
    "  float a = pow(v * 3.0, 3.0);",
    "  vec2 экр = gl_FragCoord.xy / 1440.0;",
    "  a += pow(экр.x, 2.0) * 0.15;",
    "  float r = length(vPos.xz) / 24.0;",
    "  a *= 1.0 - smoothstep(0.55, 1.0, r);",
    "  a *= uAlpha * 0.6;",
    "  if (a < 0.004) discard;",
    "  gl_FragColor = vec4(uCvet, clamp(a, 0.0, 1.0));",
    "}"
  ].join("\n");

  function шум() {
    if (g.RV_ЛУНА && g.RV_ЛУНА["шум"]) {
      var ш = g.RV_ЛУНА["шум"]();
      if (ш) return ш;
    }
    return null;
  }

  function собрать(мир, о) {
    if (собрано) return М.корень;
    W = мир || W;
    if (!W || !W.T) return null;
    T = W.T;
    о = о || {};

    М.корень = new T.Group();
    М.корень.name = "комната";
    М.корень.visible = false;
    /* Комната стоит под шахтой: та же ось x и z, что у проёма в кладке,
       дно на четыре единицы ниже, чем кончается падение. */
    М.корень.position.set(о["x"] || 0, о["y"] == null ? -34 : о["y"], о["z"] || 76);
    W.scene.add(М.корень);

    М.uTime = { value: 0 };
    М.uАльфаПол = { value: 0 };
    М.uАльфаЦил = { value: 0 };
    М.uАльфаДым = { value: 0 };

    /* ПОЛ. Диск, а не квадрат: у комнаты нет углов, и квадратный край
       выдал бы её как декорацию. */
    М.мПол = new T.ShaderMaterial({
      uniforms: {
        /* Их цвета пола: #6a6f7d и #e1e6f1. */
        uC1: { value: new T.Color(0x6a6f7d) },
        uC2: { value: new T.Color(0xe1e6f1) },
        uTime: М.uTime, uAlpha: М.uАльфаПол
      },
      vertexShader: В_ПОЛ, fragmentShader: Ф_ПОЛ,
      transparent: true, depthWrite: false, fog: false, side: T.DoubleSide
    });
    М.пол = new T.Mesh(new T.CircleGeometry(24, W.ступень === 0 ? 32 : 64), М.мПол);
    М.пол.name = "пол комнаты";
    М.пол.rotation.x = -Math.PI / 2;
    М.пол.renderOrder = 1;
    М.корень.add(М.пол);

    /* ЦИЛИНДР ТЕКСТА: две копии, как у них - 1.75 и 3.5 с поворотом.
       В наших единицах это семь и четырнадцать. Ближний рисуется вторым
       (renderOrder 1), дальний первым, как у них. */
    М.мЦил = new T.ShaderMaterial({
      uniforms: { uCvet: { value: new T.Color(0xB6C4E4) }, uTime: М.uTime, uAlpha: М.uАльфаЦил },
      vertexShader: В_ЦИЛ, fragmentShader: Ф_ЦИЛ,
      transparent: true, depthWrite: false, side: T.BackSide,
      blending: T.AdditiveBlending, fog: false
    });
    var гЦил = new T.CylinderGeometry(1, 1, 1.2, W.ступень === 0 ? 24 : 48, 1, true);
    М.цилБлиж = new T.Mesh(гЦил, М.мЦил);
    М.цилБлиж.name = "текст комнаты ближний";
    М.цилБлиж.scale.set(7 * К * 0.25, 7 * К * 0.25, 7 * К * 0.25);
    М.цилБлиж.position.y = 5;
    М.цилБлиж.renderOrder = 1;
    М.корень.add(М.цилБлиж);
    М.цилДаль = new T.Mesh(гЦил, М.мЦил);
    М.цилДаль.name = "текст комнаты дальний";
    М.цилДаль.scale.set(14 * К * 0.25, 14 * К * 0.25, 14 * К * 0.25);
    М.цилДаль.rotation.y = Math.PI * 0.5;
    М.цилДаль.position.y = 8;
    М.цилДаль.renderOrder = 0;
    М.корень.add(М.цилДаль);

    /* ДЫМКА у пола и у потолка. Без карты шума слой не строим: ровная
       заливка вместо дыма хуже, чем его отсутствие. */
    var ш = шум();
    if (ш) {
      М.мДым = new T.ShaderMaterial({
        uniforms: { tWind: { value: ш }, uCvet: { value: new T.Color(0x8FA6D8) },
                    uTime: М.uTime, uAlpha: М.uАльфаДым },
        vertexShader: В_ПОЛ, fragmentShader: Ф_ДЫМКА,
        transparent: true, depthWrite: false, side: T.DoubleSide,
        blending: T.AdditiveBlending, fog: false
      });
      М.дымПол = new T.Mesh(new T.CircleGeometry(22, 40), М.мДым);
      М.дымПол.rotation.x = -Math.PI / 2;
      М.дымПол.position.y = 0.4;
      М.дымПол.renderOrder = 2;
      М.корень.add(М.дымПол);
      М.дымВерх = new T.Mesh(new T.CircleGeometry(20, 40), М.мДым);
      М.дымВерх.rotation.x = Math.PI / 2;
      М.дымВерх.position.y = 17;
      М.дымВерх.renderOrder = 2;
      М.корень.add(М.дымВерх);
    }

    /* СИЛОВОЕ ПОЛЕ под фигурой: их Cylinder(1,1,3,64,6) с масштабом
       0.28 на высоте -10.13, то есть подставка, на которой стоит
       фигура. В наших единицах радиус чуть больше единицы. */
    if (g.RV_ТРУБА) {
      /* Материал поля живёт в модуле трубы: это тот же приём, и делать
         его дважды незачем. Если труба не поднялась - обойдёмся. */
    }

    /* ОКРУЖАЮЩИЕ ЧАСТИЦЫ: их шестьдесят точек. Комната без них читается
       вакуумом, а не помещением с воздухом. */
    var точек = W.ступень === 0 ? 24 : 60;
    var гТ = new T.BufferGeometry();
    var поз = new Float32Array(точек * 3), сем = new Float32Array(точек);
    var семя = 991;
    function сл() { семя = (семя * 9301 + 49297) % 233280; return семя / 233280; }
    for (var i = 0; i < точек; i++) {
      var уг = сл() * Math.PI * 2, рад = 3 + сл() * 17;
      поз[i * 3] = Math.cos(уг) * рад;
      поз[i * 3 + 1] = 1 + сл() * 15;
      поз[i * 3 + 2] = Math.sin(уг) * рад;
      сем[i] = сл();
    }
    гТ.setAttribute("position", new T.BufferAttribute(поз, 3));
    гТ.setAttribute("aSeed", new T.BufferAttribute(сем, 1));
    М.мПыль = new T.ShaderMaterial({
      uniforms: { uTime: М.uTime, uAlpha: М.uАльфаПол,
                  uCvet: { value: new T.Color(0xD6E2FF) }, uH: { value: 900 } },
      vertexShader: [
        "attribute float aSeed;",
        "uniform float uTime;",
        "uniform float uH;",
        "varying float vA;",
        "void main(){",
        "  vec3 p = position;",
        "  p.y += sin(uTime * 0.4 + aSeed * 12.0) * 1.4;",
        "  p.x += cos(uTime * 0.3 + aSeed * 9.0) * 1.0;",
        "  vec4 mv = modelViewMatrix * vec4(p, 1.0);",
        "  vA = 0.35 + 0.65 * aSeed;",
        "  gl_PointSize = (uH / 900.0) * 26.0 / max(1.0, -mv.z);",
        "  gl_Position = projectionMatrix * mv;",
        "}"
      ].join("\n"),
      fragmentShader: [
        "uniform vec3 uCvet;",
        "uniform float uAlpha;",
        "varying float vA;",
        "void main(){",
        "  float r = length(gl_PointCoord - 0.5) * 2.0;",
        "  float a = pow(1.0 - clamp(r, 0.0, 1.0), 1.7) * vA * uAlpha;",
        "  if (a < 0.01) discard;",
        "  gl_FragColor = vec4(uCvet, a);",
        "}"
      ].join("\n"),
      transparent: true, depthWrite: false, blending: T.AdditiveBlending, fog: false
    });
    М.пыль = new T.Points(гТ, М.мПыль);
    М.пыль.name = "воздух комнаты";
    М.пыль.frustumCulled = false;
    М.пыль.renderOrder = 3;
    М.корень.add(М.пыль);

    /* ── ФИГУРА В СЕРЕДИНЕ ────────────────────────────────────
       Ракета, снятая точками с собственной поверхности. Строит её
       КОМНАТА, а не акт: модуль частиц одиночка, и кто позвал его
       первым, тот и получает рой себе в корень. Пуск звал его раньше
       прокола, и фигура оказывалась в акте пуска, а не на дне шахты -
       замер показал её на местной высоте 1.6 вместо 7.5.

       Место у неё теперь одно, и принадлежит оно комнате. Кто хочет ею
       управлять - зовёт RV_ЧАСТИЦЫ по имени, а не строит заново. */
    if (g.RV_ЧАСТИЦЫ && g.RV_ЧАСТИЦЫ["собрать"]) {
      М.фигура = g.RV_ЧАСТИЦЫ["собрать"](W, М.корень, { размер: 11.0 });
      if (М.фигура) {
        М.фигура.position.set(0, 8.0, 0);
        М.фигура.scale.setScalar(4.6);
      }
    }

    собрано = true;
    return М.корень;
  }

  /* Времянка их таймлайна, переведённая в долю акта. У них комната
     включается на 3.4 из 9.2 (то есть 0.37), цилиндр текста на 4.5
     (0.49). Здесь то же в долях падения: пол проступает с 0.55, цилиндр
     с 0.72 - к этому времени человек уже видит дно. */
  function кадр(доля, dt, часы) {
    if (!собрано) return;
    М.uTime.value = часы || 0;
    М.uАльфаПол.value = мягко(0.55, 0.92, доля);
    М.uАльфаДым.value = мягко(0.58, 0.95, доля);
    М.uАльфаЦил.value = мягко(0.72, 1.0, доля);
    /* Цилиндры текста медленно расходятся в стороны: ближний в одну,
       дальний в другую. Комната от этого дышит, а не стоит макетом. */
    /* Фигура живёт всегда, пока комната в кадре: у igloo облако точек
       крутится само на 43 градуса в секунду и не замирает никогда. */
    if (g.RV_ЧАСТИЦЫ && М.фигура) {
      g.RV_ЧАСТИЦЫ["кадр"](dt, часы);
      М.фигура.rotation.y = -(часы || 0) * 0.75;
    }
    М.цилБлиж.rotation.y = (часы || 0) * 0.014;
    М.цилДаль.rotation.y = Math.PI * 0.5 - (часы || 0) * 0.009;
  }

  g.RV_КОМНАТА = {
    "собрать": собрать,
    "кадр": кадр,
    /* Спрашивают комнату три акта: прокол приводит в неё, ангар и пуск
       по ней ходят. Гаснет она только когда её отпустил последний -
       иначе акт, уходящий из кадра, утаскивал бы пол из-под соседа. */
    "видно": function (да, кто) {
      if (!собрано) return;
      просят[кто || "прокол"] = !!да;
      var хоть = false;
      for (var к in просят) if (просят[к]) { хоть = true; break; }
      М.корень.visible = хоть;
    },
    "узел": function () { return собрано ? М.корень : null; },
    "замер": function () {
      if (!собрано) return { "собрано": false };
      return {
        "собрано": true,
        "видно": !!М.корень.visible,
        "пол": +М.uАльфаПол.value.toFixed(3),
        "цилиндр": +М.uАльфаЦил.value.toFixed(3),
        "дымка": +М.uАльфаДым.value.toFixed(3),
        "точек": М.пыль ? М.пыль.geometry.attributes.position.count : 0,
        "место": [М.корень.position.x, М.корень.position.y, М.корень.position.z]
      };
    }
  };
})(window, document);
