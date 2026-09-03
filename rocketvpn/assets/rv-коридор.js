/* Rocket VPN. Коридор перегонов: обломки с вращением и бегущие маяки
   вдоль пути камеры.

   Перегон между станциями это сотни единиц пустоты. Пыль даёт скорость,
   но не глубину: у неё нет предметов, о которые глаз мерит расстояние.
   Здесь на перегонах ставятся два плана. Обломки (тёмный металл, без
   свечения) в трубе вокруг кривой камеры: ближние на шести-десяти
   единицах проносятся мимо, дальние на сорока ползут, и разница их хода
   это и есть параллакс, по которому читается полёт. Маяки (кольца на
   самой кривой) размечают маршрут, а бегущий по ним огонь показывает,
   куда летим, раньше, чем впереди проявилась станция.

   ОТКУДА КРИВАЯ. Мир свою кривую наружу не отдаёт, а править ядро этой
   работе нельзя. Поэтому позы актов перехватываются на входе
   (RV_WORLD.поза оборачивается до того, как акты её позовут: этот файл
   стоит в разметке раньше актов) и кривая собирается заново ПО ТОЙ ЖЕ
   формуле, что в ядре: три узла на станцию, пролог, эпилог,
   центростремительный Катмулл-Ром. Если ядро когда-нибудь отдаст
   RV_WORLD.кривая(), она берётся вместо своей.

   Всё за ступенью качества: на нищей ступени коридора нет вовсе. */
(function (g, d) {
  "use strict";

  var ОБЛОМКОВ = [0, 900, 1800];
  var МАЯКОВ_МАКС = 120;
  var ШАГ_МАЯКА = 24;      /* единиц дуги между кольцами */
  var КРАЙ = 0.15;         /* доля узла, свободная от обломков у станций */
  var ДЫРКА_СТАНЦИИ = 28;  /* единиц вокруг точки взгляда станции */

  if (!g.RV_WORLD || !g.RV_WORLD["поза"]) return;

  /* ── Перехват поз ───────────────────────────────────────────────
     Значения по умолчанию повторяют ядро слово в слово: кривая обязана
     совпасть с ходом камеры, иначе кольца встанут мимо объектива. */
  var ПОЗЫ = {};
  var изменилось = false;
  var прежняяПоза = g.RV_WORLD["поза"];
  g.RV_WORLD["поза"] = function (имя, п) {
    var было = ПОЗЫ[имя];
    ПОЗЫ[имя] = {
      "на": п["на"], "от": п["от"],
      "подход": п["подход"] == null ? 6 : п["подход"],
      "уход": п["уход"] == null ? -2 : п["уход"],
      "бок": п["бок"] || [0, 0, 0],
      "пролог": п["пролог"] == null ? (было ? было["пролог"] : 80) : п["пролог"],
      "эпилог": п["эпилог"] == null ? (было ? было["эпилог"] : 30) : п["эпилог"]
    };
    изменилось = true;
    отложитьПересборку();
    return прежняяПоза.apply(this, arguments);
  };

  function своюКривую(T) {
    var секции = d.querySelectorAll(".rv-акт[data-акт]");
    var станции = [], i, с, имя;
    for (i = 0; i < секции.length; i++) {
      имя = секции[i].getAttribute("data-акт");
      if (ПОЗЫ[имя]) станции.push({ имя: имя, поза: ПОЗЫ[имя] });
    }
    if (!станции.length) return null;
    var точки = [];
    var вбок = new T.Vector3(), вверх = new T.Vector3(0, 1, 0);
    с = станции[0];
    var от0 = new T.Vector3().fromArray(с.поза["от"]);
    var на0 = new T.Vector3().fromArray(с.поза["на"]);
    var назад = new T.Vector3().copy(от0).sub(на0).normalize();
    точки.push(от0.clone().addScaledVector(назад, с.поза["пролог"]));
    for (i = 0; i < станции.length; i++) {
      с = станции[i];
      с.на = new T.Vector3().fromArray(с.поза["на"]);
      с.от = new T.Vector3().fromArray(с.поза["от"]);
      с.назад = new T.Vector3().copy(с.от).sub(с.на).normalize();
      вбок.crossVectors(вверх, с.назад).normalize();
      var б = с.поза["бок"];
      точки.push(с.от.clone().addScaledVector(с.назад, с.поза["подход"]).addScaledVector(вбок, б[0]));
      точки.push(с.от.clone().addScaledVector(вбок, б[1]));
      точки.push(с.от.clone().addScaledVector(с.назад, с.поза["уход"]).addScaledVector(вбок, б[2]));
      с.индекс = 2 + 3 * i;
    }
    с = станции[станции.length - 1];
    точки.push(с.от.clone().addScaledVector(с.назад, с.поза["уход"] - с.поза["эпилог"]));
    var путь = new T.CatmullRomCurve3(точки, false, "centripetal", 0.5);
    return { "путь": путь, "узлов": точки.length, "станции": станции };
  }

  function взятьКривую(T) {
    var к = null;
    try {
      if (g.RV_WORLD["кривая"]) к = g.RV_WORLD["кривая"]();
    } catch (e) { к = null; }
    if (к && к["путь"] && к["станции"] && к["узлов"] >= 2) return к;
    return своюКривую(T);
  }

  /* ── Шейдерные вставки ──────────────────────────────────────────
     Внутри GLSL только латиница. */
  var ВРАЩЕНИЕ = [
    "float ang = aSpin.w * uTime;",
    "float cs = cos(ang), sn = sin(ang);",
    "vec3 kk = aSpin.xyz;"
  ].join("\n");

  function родриг(v) {
    return v + " = " + v + " * cs + cross(kk, " + v + ") * sn + kk * dot(kk, " + v + ") * (1.0 - cs);";
  }

  var униф = null;

  function материалОбломков(T, ст) {
    var м = null;
    var о = { цвет: 0x3A4468, металл: 0.7, шерох: 0.5, свет: 0x05070F, жар: 0.25 };
    if (g.RV_REAL && g.RV_REAL["корпус"]) {
      try { м = g.RV_REAL["корпус"](T, о); } catch (e) { м = null; }
    }
    if (!м) {
      м = new T.MeshStandardMaterial({ color: о.цвет, metalness: о.металл, roughness: о.шерох });
    }
    /* Своя вставка идёт ПОВЕРХ вставки корпуса: та даёт фактуру и
       кромку, эта вращение и растворение вдали. Ключ программы тоже
       наращивается, иначе рисовальщик подсунет программу корпуса без
       вращения. */
    var прежняя = м.onBeforeCompile;
    var прежнийКлюч = м.customProgramCacheKey;
    м.onBeforeCompile = function (ш, r) {
      if (прежняя) прежняя.call(м, ш, r);
      ш.uniforms.uTime = униф.uTime;
      ш.uniforms.uCam = униф.uCam;
      ш.vertexShader = ш.vertexShader
        .replace("#include <common>",
          "#include <common>\nattribute vec4 aSpin;\nuniform float uTime;\nuniform vec3 uCam;")
        .replace("#include <beginnormal_vertex>",
          "#include <beginnormal_vertex>\n{\n" + ВРАЩЕНИЕ + "\n" + родриг("objectNormal") + "\n}")
        .replace("#include <begin_vertex>",
          "#include <begin_vertex>\n{\n" + ВРАЩЕНИЕ + "\n" + родриг("transformed") + "\n"
          /* Дальше пятисот единиц обломок ужимается в точку: там он
             всё равно тонет в тумане, а треугольники стоят. */
          + "vec3 ic = (instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0)).xyz;\n"
          + "transformed *= 1.0 - smoothstep(420.0, 520.0, distance(ic, uCam));\n}");
    };
    м.customProgramCacheKey = function () {
      return (прежнийКлюч ? прежнийКлюч.call(м) : "") + "-rv-oblomki";
    };
    м.needsUpdate = true;
    return м;
  }

  /* Одна геометрия из икосаэдра и прибитого к нему бруска: у чистого
     икосаэдра силуэт одинаков с любой стороны, и стая из тысячи таких
     читается бусинами. Слияние руками: утилит слияния в ядре three нет,
     а обе геометрии без индекса, так что массивы просто дописываются. */
  function геометрияОбломка(T) {
    var а = new T.IcosahedronGeometry(1, 0);
    var б = new T.BoxGeometry(0.6, 0.3, 1.4).toNonIndexed();
    var па = а.attributes.position.array, нa = а.attributes.normal.array;
    var пб = б.attributes.position.array, нб = б.attributes.normal.array;
    var поз = new Float32Array(па.length + пб.length);
    var нор = new Float32Array(нa.length + нб.length);
    поз.set(па, 0); поз.set(пб, па.length);
    нор.set(нa, 0); нор.set(нб, нa.length);
    var гео = new T.BufferGeometry();
    гео.setAttribute("position", new T.BufferAttribute(поз, 3));
    гео.setAttribute("normal", new T.BufferAttribute(нор, 3));
    /* Развёртка нужна корпусу для карт фактуры: без неё материал не
       соберётся. Проекция по нормали грубая, но обломок мелкий. */
    var уф = new Float32Array((поз.length / 3) * 2);
    for (var i = 0; i < поз.length / 3; i++) {
      уф[i * 2] = поз[i * 3] * 0.5 + 0.5;
      уф[i * 2 + 1] = поз[i * 3 + 1] * 0.5 + 0.5;
    }
    гео.setAttribute("uv", new T.BufferAttribute(уф, 2));
    а.dispose(); б.dispose();
    return гео;
  }

  function материалМаяков(T) {
    var м = new T.MeshBasicMaterial({
      color: 0x8A9CFF,
      transparent: true,
      blending: T.AdditiveBlending,
      depthWrite: false,
      fog: true
    });
    м.onBeforeCompile = function (ш) {
      ш.uniforms.uTime = униф.uTime;
      ш.vertexShader = ш.vertexShader
        .replace("#include <common>",
          "#include <common>\nattribute float aIndex;\nuniform float uTime;\nvarying float vBr;")
        .replace("#include <begin_vertex>",
          "#include <begin_vertex>\n"
          /* Огонь бежит по кольцам к следующей станции: фаза растёт с
             номером кольца, время её сдвигает вперёд. Шестая степень
             делает горящее кольцо одним из семи, остальные тлеют. */
          + "vBr = 0.22 + 0.78 * pow(0.5 + 0.5 * sin(aIndex * 0.9 - uTime * 2.2), 6.0);");
      ш.fragmentShader = ш.fragmentShader
        .replace("#include <common>", "#include <common>\nvarying float vBr;")
        .replace("#include <color_fragment>",
          "#include <color_fragment>\ndiffuseColor.rgb *= vBr * 1.9;");
    };
    м.customProgramCacheKey = function () { return "rv-mayaki"; };
    return м;
  }

  /* ── Сборка ─────────────────────────────────────────────────────*/
  var W = null, обломки = null, маяки = null, спин = null, номер = null;
  var узловБыло = 0, такт = 0, ждём = 0;

  function собрать() {
    var T = W.T, ст = W.ступень;
    var n = ОБЛОМКОВ[ст] || 0;
    if (!n) return;
    униф = { uTime: { value: 0 }, uCam: { value: new T.Vector3() } };

    обломки = new T.InstancedMesh(геометрияОбломка(T), материалОбломков(T, ст), n);
    спин = new T.InstancedBufferAttribute(new Float32Array(n * 4), 4);
    обломки.geometry.setAttribute("aSpin", спин);
    обломки.instanceMatrix.setUsage(T.DynamicDrawUsage);
    обломки.name = "rv-обломки";
    обломки.frustumCulled = false;
    обломки.count = 0;

    маяки = new T.InstancedMesh(new T.TorusGeometry(1.6, 0.09, 6, 28), материалМаяков(T), МАЯКОВ_МАКС);
    номер = new T.InstancedBufferAttribute(new Float32Array(МАЯКОВ_МАКС), 1);
    маяки.geometry.setAttribute("aIndex", номер);
    маяки.instanceMatrix.setUsage(T.DynamicDrawUsage);
    маяки.name = "rv-маяки";
    маяки.frustumCulled = false;
    маяки.renderOrder = -1;
    маяки.count = 0;

    /* Униформы обновляются рисовальщиком на каждом живом кадре: своего
       цикла у модуля нет. Раз в тридцать кадров проверяется, не
       переобъявились ли позы (узлов стало иначе): тогда пересборка. */
    обломки.onBeforeRender = function (r, сц, кам) {
      униф.uTime.value = W.часы;
      униф.uCam.value.copy(кам.position);
      if ((++такт % 30) === 0) {
        var у = 0;
        try { у = g.RV_WORLD["ход"]()["узлов"]; } catch (e) {}
        if (у && у !== узловБыло) отложитьПересборку();
      }
    };
    W.scene.add(обломки);
    W.scene.add(маяки);
    расставить();
  }

  var т1 = null, т2 = null, кас = null, н1 = null, н2 = null, пт = null, кв = null, мат = null, цв = null;

  function расставить() {
    изменилось = false;
    if (!обломки) return;
    var T = W.T;
    var к = взятьКривую(T);
    if (!к) return;
    var путь = к["путь"], узлов = к["узлов"], станции = к["станции"];
    узловБыло = узлов;
    if (!т1) {
      т1 = new T.Vector3(); т2 = new T.Vector3(); кас = new T.Vector3();
      н1 = new T.Vector3(); н2 = new T.Vector3(); пт = new T.Vector3();
      кв = new T.Quaternion(); мат = new T.Matrix4(); цв = new T.Color();
    }
    var вверх = new T.Vector3(0, 1, 0), ось = new T.Vector3(0, 0, 1), единица = new T.Vector3(1, 1, 1);
    var i, j, s = 7654321;
    function сл() { s = (s * 1103515245 + 12345) % 2147483648; return s / 2147483648; }

    /* Перегоны: от узла ухода станции i до узла подхода станции i+1.
       Длина каждого меряется по дуге, чтобы короткий перегон рубка-пуск
       не получил столько же обломков, сколько четырёхсотединичный. */
    var перегоны = [], всего = 0;
    for (i = 0; i + 1 < станции.length; i++) {
      var a = станции[i]["индекс"] + 1, b = станции[i + 1]["индекс"] - 1;
      var дл = 0;
      путь.getPoint(a / (узлов - 1), т1);
      for (j = 1; j <= 32; j++) {
        путь.getPoint((a + (b - a) * j / 32) / (узлов - 1), т2);
        дл += т1.distanceTo(т2); т1.copy(т2);
      }
      перегоны.push({ a: a, b: b, длина: дл });
      всего += дл;
    }
    if (!всего) return;
    /* Точки взгляда станций: у своей кривой это Vector3, у кривой ядра
       массив из трёх чисел. Приводим к одному виду, иначе дырка вокруг
       станции молча не сработает. */
    var центры = [];
    for (i = 0; i < станции.length; i++) {
      var на = станции[i]["на"];
      if (на && на.isVector3) центры.push(на);
      else if (на && на.length === 3) центры.push(new T.Vector3().fromArray(на));
      else if (станции[i]["поза"]) центры.push(new T.Vector3().fromArray(станции[i]["поза"]["на"]));
    }

    function базис(t) {
      путь.getTangent(t, кас).normalize();
      н1.crossVectors(кас, вверх);
      if (н1.lengthSq() < 1e-6) н1.set(1, 0, 0); else н1.normalize();
      н2.crossVectors(кас, н1).normalize();
    }

    /* Обломки. */
    var ёмк = обломки.instanceMatrix.count, м = 0, п;
    for (i = 0; i < перегоны.length && м < ёмк; i++) {
      п = перегоны[i];
      var доля = Math.round(ёмк * п.длина / всего);
      for (j = 0; j < доля && м < ёмк; j++) {
        var pp = (п.a + КРАЙ) + сл() * ((п.b - КРАЙ) - (п.a + КРАЙ));
        var t = pp / (узлов - 1);
        путь.getPoint(t, пт);
        базис(t);
        /* Радиус со сдвигом к дальним: ближних мало, и каждый заметен,
           дальние держат плотность фона. Крупные только на удалении:
           глыба в семи единицах от объектива закрыла бы текст. */
        var r = 7 + 33 * Math.pow(сл(), 0.7);
        var уг = сл() * 6.2832;
        пт.addScaledVector(н1, Math.cos(уг) * r).addScaledVector(н2, Math.sin(уг) * r);
        var далеко = true;
        for (var q = 0; q < центры.length; q++) {
          if (пт.distanceTo(центры[q]) < ДЫРКА_СТАНЦИИ) { далеко = false; break; }
        }
        if (!далеко) continue;
        var ск = 0.15 * Math.pow(1.2 / 0.15, сл());
        if (r < 14) ск = Math.min(ск, 0.5);
        т1.set(ск * (0.7 + 0.6 * сл()), ск * (0.7 + 0.6 * сл()), ск * (0.7 + 0.6 * сл()));
        кв.setFromEuler(new T.Euler(сл() * 6.2832, сл() * 6.2832, сл() * 6.2832));
        мат.compose(пт, кв, т1);
        обломки.setMatrixAt(м, мат);
        цв.setHex(0x3A4670).lerp(new T.Color(0x8090C0), сл());
        обломки.setColorAt(м, цв);
        т2.set(сл() - 0.5, сл() - 0.5, сл() - 0.5).normalize();
        спин.setXYZW(м, т2.x, т2.y, т2.z, (0.1 + 0.5 * сл()) * (сл() < 0.5 ? -1 : 1));
        м++;
      }
    }
    обломки.count = м;
    обломки.instanceMatrix.needsUpdate = true;
    if (обломки.instanceColor) обломки.instanceColor.needsUpdate = true;
    спин.needsUpdate = true;

    /* Маяки: каждые ШАГ_МАЯКА единиц дуги, кольцо поперёк касательной.
       Номер сквозной по всему пути: огонь бежит от станции к станции
       без разрыва фазы на стыке перегонов. */
    var мк = 0;
    for (i = 0; i < перегоны.length && мк < МАЯКОВ_МАКС; i++) {
      п = перегоны[i];
      var шагов = 64, прошли = 0, следующий = ШАГ_МАЯКА * 0.5;
      путь.getPoint(п.a / (узлов - 1), т1);
      for (j = 1; j <= шагов && мк < МАЯКОВ_МАКС; j++) {
        var tt = (п.a + (п.b - п.a) * j / шагов) / (узлов - 1);
        путь.getPoint(tt, т2);
        var отрезок = т1.distanceTo(т2);
        while (прошли + отрезок >= следующий && мк < МАЯКОВ_МАКС) {
          var f = (следующий - прошли) / Math.max(1e-6, отрезок);
          пт.copy(т1).lerp(т2, f);
          базис(tt);
          кв.setFromUnitVectors(ось, кас);
          мат.compose(пт, кв, единица);
          маяки.setMatrixAt(мк, мат);
          номер.setX(мк, мк);
          мк++;
          следующий += ШАГ_МАЯКА;
        }
        прошли += отрезок;
        т1.copy(т2);
      }
    }
    маяки.count = мк;
    маяки.instanceMatrix.needsUpdate = true;
    номер.needsUpdate = true;
  }

  /* Пересборка откладывается в свободный промежуток и склеивается:
     поворот телефона присылает несколько переобъявлений подряд. */
  function отложитьПересборку() {
    if (ждём || !обломки) return;
    ждём = 1;
    setTimeout(function () {
      ждём = 0;
      var f = function () { try { расставить(); } catch (e) {} };
      if (g.requestIdleCallback) g.requestIdleCallback(f, { timeout: 1500 }); else setTimeout(f, 40);
    }, 250);
  }

  function встать() {
    if (!g.RV_WORLD["мир"]) return;
    W = g.RV_WORLD["мир"]();
    if (!W || !W.готов || !W.ступень) return;
    /* В очередь прогрева: сборка это десятки миллисекунд, кадру она не
       достаётся. К моменту прогрева все позы уже объявлены: акты встают
       по тому же событию сразу после нас. */
    g.RV_WORLD["работа"]("коридор", function () { try { собрать(); } catch (e) {} });
  }

  g.RV_КОРИДОР = {
    "обломки": function () { return обломки; },
    "маяки": function () { return маяки; },
    "кривая": function () { return W ? взятьКривую(W.T) : null; }
  };

  if (g.RV_WORLD["готов"] && g.RV_WORLD["готов"]()) встать();
  else g.addEventListener("rv:мир", встать);
})(window, document);
