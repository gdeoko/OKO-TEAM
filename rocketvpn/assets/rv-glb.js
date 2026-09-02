/* ═══════════════════════════════════════════════════════════
   Rocket VPN · чтение модели GLB

   ЗАЧЕМ СВОЙ РАЗБОР, А НЕ ГОТОВЫЙ ЗАГРУЗЧИК. Штатный GLTFLoader живёт
   в примерах three и с версии r150 существует только модулем ES,
   который импортирует сам three по имени пакета. Сайт подключает three
   обычным скриптом, поэтому загрузчик потянул бы за собой ВТОРУЮ копию
   движка: лишние семьсот килобайт и два разных класса Vector3 в одной
   сцене.

   Нам от формата нужна одна вещь: сетка. Ни материалов, ни анимации,
   ни скинов, ни узлов - материалы сайт назначает сам, потому что цвет
   станции зависит от того, зажжена она или нет. Такой разбор занимает
   сотню строк и не тянет ничего.

   Что читаем: заголовок GLB, кусок JSON, кусок BIN, из них примитивы
   первой сетки - POSITION, NORMAL, TEXCOORD_0 и указатели. Всё
   остальное честно пропускаем.

   Чего файл НЕ делает намеренно: не поддерживает сжатие Draco,
   разрежённые доступы и чересстрочные буферы с шагом. Экспорт из
   Blender их не даёт, а поддержка «на всякий случай» это код, который
   некому проверить.
   ═══════════════════════════════════════════════════════════ */
(function (g) {
"use strict";

var ТИПЫ = {
  5120: Int8Array, 5121: Uint8Array, 5122: Int16Array,
  5123: Uint16Array, 5125: Uint32Array, 5126: Float32Array
};
var ЧИСЛО = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4, MAT4: 16 };

function разобрать(буфер) {
  var вид = new DataView(буфер);
  if (вид.getUint32(0, true) !== 0x46546C67) throw new Error("не GLB");
  var длина = вид.getUint32(8, true);
  var сдвиг = 12, json = null, bin = null;
  while (сдвиг < длина) {
    var дл = вид.getUint32(сдвиг, true);
    var тип = вид.getUint32(сдвиг + 4, true);
    var начало = сдвиг + 8;
    if (тип === 0x4E4F534A) {
      json = JSON.parse(new TextDecoder().decode(new Uint8Array(буфер, начало, дл)));
    } else if (тип === 0x004E4942) {
      bin = буфер.slice(начало, начало + дл);
    }
    сдвиг = начало + дл + ((4 - (дл % 4)) % 4);
  }
  if (!json || !bin) throw new Error("в GLB нет кусков");
  return { json: json, bin: bin };
}

function доступ(json, bin, номер) {
  var a = json.accessors[номер];
  var v = json.bufferViews[a.bufferView];
  var Тип = ТИПЫ[a.componentType];
  var n = ЧИСЛО[a.type] || 1;
  var от = (v.byteOffset || 0) + (a.byteOffset || 0);
  /* Шаг между элементами. Blender пишет буферы плотно, но формат
     разрешает чересстрочность, и молча отдать мусор нельзя. */
  var шаг = v.byteStride || 0;
  if (шаг && шаг !== n * Тип.BYTES_PER_ELEMENT) {
    var плотно = new Тип(a.count * n);
    var сырьё = new DataView(bin);
    /* Чтение по типу, а не «всё остальное как байт»: ужатые модели
       держат положения в int16 и нормали в int8 с шагом 8 и 4, и
       прежняя ветка читала их как uint8. Станция рассыпалась в горсть
       точек (снимок стенда), молча. */
    var читать = Тип === Float32Array ? function (п) { return сырьё.getFloat32(п, true); }
      : Тип === Uint16Array ? function (п) { return сырьё.getUint16(п, true); }
      : Тип === Int16Array ? function (п) { return сырьё.getInt16(п, true); }
      : Тип === Uint32Array ? function (п) { return сырьё.getUint32(п, true); }
      : Тип === Int8Array ? function (п) { return сырьё.getInt8(п); }
      : function (п) { return сырьё.getUint8(п); };
    for (var i = 0; i < a.count; i++) {
      for (var j = 0; j < n; j++) {
        плотно[i * n + j] = читать(от + i * шаг + j * Тип.BYTES_PER_ELEMENT);
      }
    }
    return плотно;
  }
  return new Тип(bin, от, a.count * n);
}

/* Собирает ОДНУ геометрию из всех примитивов файла: модель станции это
   один слитый предмет, и делить его на части сайту незачем. */
function геометрия(T, разбор) {
  var json = разбор.json, bin = разбор.bin;
  var поз = [], нор = [], уф = [], инд = [];
  var сдвигВершин = 0;
  (json.meshes || []).forEach(function (сетка) {
    (сетка.primitives || []).forEach(function (п) {
      if (п.attributes.POSITION == null) return;
      var P = доступ(json, bin, п.attributes.POSITION);
      var N = п.attributes.NORMAL != null ? доступ(json, bin, п.attributes.NORMAL) : null;
      var U = п.attributes.TEXCOORD_0 != null ? доступ(json, bin, п.attributes.TEXCOORD_0) : null;
      var I = п.indices != null ? доступ(json, bin, п.indices) : null;
      var к;
      for (к = 0; к < P.length; к++) поз.push(P[к]);
      if (N) for (к = 0; к < N.length; к++) нор.push(N[к]);
      if (U) for (к = 0; к < U.length; к++) уф.push(U[к]);
      var вершин = P.length / 3;
      if (I) { for (к = 0; к < I.length; к++) инд.push(I[к] + сдвигВершин); }
      else { for (к = 0; к < вершин; к++) инд.push(к + сдвигВершин); }
      сдвигВершин += вершин;
    });
  });
  var г = new T.BufferGeometry();
  г.setAttribute("position", new T.Float32BufferAttribute(поз, 3));
  if (нор.length === поз.length) г.setAttribute("normal", new T.Float32BufferAttribute(нор, 3));
  if (уф.length === (поз.length / 3) * 2) г.setAttribute("uv", new T.Float32BufferAttribute(уф, 2));
  г.setIndex(инд);
  if (!нор.length) г.computeVertexNormals();
  г.computeBoundingSphere();
  return г;
}

var кэш = {};

/* Отдаёт обещание с геометрией. Один адрес читается один раз: станций
   в кадре несколько, а сетка у них общая. */
function взять(адрес) {
  if (кэш[адрес]) return кэш[адрес];
  кэш[адрес] = fetch(адрес, { credentials: "same-origin" })
    .then(function (о) {
      if (!о.ok) throw new Error("модель не отдалась: " + о.status);
      return о.arrayBuffer();
    })
    .then(function (буфер) {
      var T = g.THREE;
      if (!T) throw new Error("нет three");
      return геометрия(T, разобрать(буфер));
    })
    .catch(function (e) {
      /* Модель это украшение поверх работающей сцены. Не доехала -
         сцена рисует прежнюю геометрию кодом, а не падает. */
      delete кэш[адрес];
      throw e;
    });
  return кэш[адрес];
}

/* ═══ МОДЕЛЬ С МАТЕРИАЛАМИ ═════════════════════════════════════
   Настоящие аппараты (NASA 3D Resources, общественное достояние) идут с
   настоящими материалами: золотая фольга, панели батарей, радиаторы,
   карты нормалей. Ради них читаются узлы, материалы и картинки. Берём
   ровно то, что three покажет без загрузчика из примеров: узлы с
   матрицей или TRS, примитивы-треугольники, материал
   metallicRoughness с четырьмя картами. Анимацию, скины, морфы,
   второй набор координат и KHR_texture_transform пропускаем: в наших
   файлах их нет (проверено разбором), а код без проверки это
   обещание, которое некому сдержать.

   Картинки декодирует браузер: createImageBitmap читает JPEG и PNG
   прямо из байтов файла, без base64 и без второго похода на сервер.
   Где его нет (старый Safari), тот же байтовый кусок идёт через Image
   и объектный адрес. */
function битмап(json, bin, номер) {
  var im = json.images[номер];
  if (!im || im.bufferView == null) return Promise.resolve(null);
  var v = json.bufferViews[im.bufferView];
  var байты = new Uint8Array(bin, v.byteOffset || 0, v.byteLength);
  var кусок = new Blob([байты], { type: im.mimeType || "image/png" });
  var поКартинке = function () {
    return new Promise(function (ок) {
      var адрес = URL.createObjectURL(кусок);
      var img = new Image();
      img.onload = function () { URL.revokeObjectURL(адрес); ок(img); };
      img.onerror = function () { URL.revokeObjectURL(адрес); ок(null); };
      img.src = адрес;
    });
  };
  if (typeof createImageBitmap !== "function") return поКартинке();
  /* Без переворота и без предумножения: glTF считает начало координат
     картинки сверху, three по умолчанию снизу; проще не переворачивать
     картинку и сказать текстуре flipY = false. */
  return createImageBitmap(кусок, { imageOrientation: "none", premultiplyAlpha: "none", colorSpaceConversion: "none" })
    .catch(поКартинке);
}

/* Геометрия одного примитива. Кэш по номеру доступа положений: у
   нескольких станций в кадре модель одна, и три копии одной сетки в
   памяти ни к чему. */
function примитивГеометрия(T, json, bin, п, кэшГео) {
  var ключ = п.attributes.POSITION + "/" + (п.indices == null ? "-" : п.indices) + "/" + (п.attributes.TEXCOORD_0 == null ? "-" : п.attributes.TEXCOORD_0);
  if (кэшГео[ключ]) return кэшГео[ключ];
  var г = new T.BufferGeometry();
  /* Ужатые модели (KHR_mesh_quantization) держат положения в int16, а
     нормали в int8 с признаком normalized: three читает такие
     атрибуты сам, если признак передать. Переводить в float32 незачем,
     файл и память втрое меньше. */
  function атрибут(номер, n) {
    var a = json.accessors[номер];
    return new T.BufferAttribute(доступ(json, bin, номер), n, !!a.normalized);
  }
  г.setAttribute("position", атрибут(п.attributes.POSITION, 3));
  if (п.attributes.NORMAL != null) г.setAttribute("normal", атрибут(п.attributes.NORMAL, 3));
  if (п.attributes.TEXCOORD_0 != null) г.setAttribute("uv", атрибут(п.attributes.TEXCOORD_0, 2));
  if (п.indices != null) {
    var I = доступ(json, bin, п.indices);
    г.setIndex(new T.BufferAttribute(I, 1));
  }
  if (п.attributes.NORMAL == null) г.computeVertexNormals();
  г.computeBoundingSphere();
  кэшГео[ключ] = г;
  return г;
}

/* Собирает предмет с материалами. Отдаёт обещание с группой, у которой
   есть список материалов и метод жар(v): зажигание, как у корпуса из
   rv-real.js, чтобы актам было всё равно, модель перед ними или
   прежний примитив. Материалы у каждого вызова свои (зажигается одна
   станция, а не все три), картинки и сетки общие. */
function модель(T, разбор, опции) {
  опции = опции || {};
  var json = разбор.json, bin = разбор.bin;
  var кэшГео = разбор.кэшГео || (разбор.кэшГео = {});
  if (!разбор.битмапы) {
    разбор.битмапы = Promise.all((json.images || []).map(function (_, i) { return битмап(json, bin, i); }));
  }
  return разбор.битмапы.then(function (картинки) {
    var кэшТек = {};
    function текстура(инфо, цветная) {
      if (!инфо || !json.textures || !json.textures[инфо.index]) return null;
      var т = json.textures[инфо.index];
      if (т.source == null || !картинки[т.source]) return null;
      var ключ = т.source + (цветная ? "c" : "l");
      if (кэшТек[ключ]) return кэшТек[ключ];
      var тек = new T.Texture(картинки[т.source]);
      тек.flipY = false;
      тек.colorSpace = цветная ? T.SRGBColorSpace : T.NoColorSpace;
      тек.wrapS = тек.wrapT = T.RepeatWrapping;
      тек.anisotropy = опции.анизотропия || 1;
      тек.needsUpdate = true;
      кэшТек[ключ] = тек;
      return тек;
    }
    var материалы = [];
    function материал(номер) {
      var м = (json.materials || [])[номер] || {};
      var pbr = м.pbrMetallicRoughness || {};
      var мат = new T.MeshStandardMaterial({
        metalness: pbr.metallicFactor == null ? 1 : pbr.metallicFactor,
        roughness: pbr.roughnessFactor == null ? 1 : pbr.roughnessFactor,
        side: м.doubleSided ? T.DoubleSide : T.FrontSide,
        envMapIntensity: опции.отражения == null ? 1 : опции.отражения
      });
      var ф = pbr.baseColorFactor || [1, 1, 1, 1];
      мат.color.setRGB(ф[0], ф[1], ф[2], T.LinearSRGBColorSpace);
      if (ф[3] < 1) { мат.transparent = true; мат.opacity = ф[3]; }
      var э = м.emissiveFactor || [0, 0, 0];
      мат.emissive.setRGB(э[0], э[1], э[2], T.LinearSRGBColorSpace);
      мат.map = текстура(pbr.baseColorTexture, true);
      var мш = текстура(pbr.metallicRoughnessTexture, false);
      if (мш) { мат.metalnessMap = мш; мат.roughnessMap = мш; }
      мат.normalMap = текстура(м.normalTexture, false);
      if (мат.normalMap && м.normalTexture.scale != null) мат.normalScale.setScalar(м.normalTexture.scale);
      мат.emissiveMap = текстура(м.emissiveTexture, true);
      if (м.alphaMode === "BLEND") { мат.transparent = true; мат.depthWrite = false; }
      else if (м.alphaMode === "MASK") { мат.alphaTest = м.alphaCutoff == null ? 0.5 : м.alphaCutoff; }
      /* Свечение зажигания подмешивается только туда, где нет своей
         карты свечения: иначе огни аппарата сменились бы ровной заливкой. */
      мат.rvЗажигаемый = !мат.emissiveMap;
      материалы.push(мат);
      return мат;
    }
    var поМатериалу = {};
    function материалПоНомеру(номер) {
      var ключ = номер == null ? "-" : номер;
      if (!поМатериалу[ключ]) поМатериалу[ключ] = материал(номер);
      return поМатериалу[ключ];
    }
    function узел(номер) {
      var n = json.nodes[номер];
      var о = new T.Group();
      о.name = n.name || "";
      if (n.matrix) {
        о.matrix.fromArray(n.matrix);
        о.matrix.decompose(о.position, о.quaternion, о.scale);
      } else {
        if (n.translation) о.position.fromArray(n.translation);
        if (n.rotation) о.quaternion.fromArray(n.rotation);
        if (n.scale) о.scale.fromArray(n.scale);
      }
      if (n.mesh != null && json.meshes[n.mesh]) {
        (json.meshes[n.mesh].primitives || []).forEach(function (п) {
          if (п.attributes.POSITION == null) return;
          if (п.mode != null && п.mode !== 4) return;
          о.add(new T.Mesh(примитивГеометрия(T, json, bin, п, кэшГео), материалПоНомеру(п.material)));
        });
      }
      (n.children || []).forEach(function (д) { о.add(узел(д)); });
      return о;
    }
    var корни;
    if (json.scenes && json.scenes.length) корни = json.scenes[json.scene || 0].nodes || [];
    else {
      var дети = {};
      (json.nodes || []).forEach(function (n) { (n.children || []).forEach(function (д) { дети[д] = 1; }); });
      корни = (json.nodes || []).map(function (_, i) { return i; }).filter(function (i) { return !дети[i]; });
    }
    var группа = new T.Group();
    корни.forEach(function (i) { группа.add(узел(i)); });
    группа.материалы = материалы;
    var свет = опции.свет == null ? 0x121B45 : опции.свет;
    var прибавка = опции.прибавка == null ? 0.5 : опции.прибавка;
    группа.жар = function (v) {
      for (var i = 0; i < материалы.length; i++) {
        if (!материалы[i].rvЗажигаемый) continue;
        материалы[i].emissive.setHex(свет);
        материалы[i].emissiveIntensity = Math.max(0, v) * прибавка;
      }
    };
    return группа;
  });
}

var кэшРазбора = {};

/* Модель с материалами по адресу. Файл читается и разбирается один
   раз, дальше каждый вызов собирает свою группу поверх общих сеток и
   картинок. */
function взятьМодель(адрес, опции) {
  if (!кэшРазбора[адрес]) {
    кэшРазбора[адрес] = fetch(адрес, { credentials: "same-origin" })
      .then(function (о) {
        if (!о.ok) throw new Error("модель не отдалась: " + о.status);
        return о.arrayBuffer();
      })
      .then(function (буфер) { return разобрать(буфер); })
      .catch(function (e) { delete кэшРазбора[адрес]; throw e; });
  }
  return кэшРазбора[адрес].then(function (разбор) {
    var T = g.THREE;
    if (!T) throw new Error("нет three");
    return модель(T, разбор, опции);
  });
}

g.RV_GLB = { взять: взять, разобрать: разобрать, геометрия: геометрия, модель: модель, взятьМодель: взятьМодель };

})(window);
