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
    for (var i = 0; i < a.count; i++) {
      for (var j = 0; j < n; j++) {
        var п = от + i * шаг + j * Тип.BYTES_PER_ELEMENT;
        плотно[i * n + j] = Тип === Float32Array ? сырьё.getFloat32(п, true)
          : (Тип === Uint16Array ? сырьё.getUint16(п, true)
          : (Тип === Uint32Array ? сырьё.getUint32(п, true) : сырьё.getUint8(п)));
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

g.RV_GLB = { взять: взять, разобрать: разобрать, геометрия: геометрия };

})(window);
