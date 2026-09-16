# Разбор igloo.inc: текст, взаимодействие, переходы, загрузка, мобильное, пост

Третья часть. Первые две - `РАЗБОР-IGLOO.md` (19 приёмов рендера) и
`РАЗБОР-IGLOO-ДВИЖЕНИЕ.md` (скролл, камера, тоннель, частицы, звук). Здесь
шесть тем, которых там нет. Всё снято с боевого бандла
`assets/App3D-f554a111.js` (1.49 МБ), загрузчика `assets/index-2eb69c09.js`
(16.5 КБ), воркера `assets/msdfworker-ac346fa7.js` (3.2 КБ) и с самих ассетов -
разбором кода и заголовков файлов, а не на глаз.

Их шрифт, модели, текстуры и звук сюда не входят: это чужая работа. Здесь
устройство, формулы и числа.

Смещения в бандле даны для сверки: `python3 -c "s=open('app3d.js').read();
print(s[1265587:1270000])"`.

---

# 1. ТЕКСТ

## 1.1. Весь текст сайта - это MSDF в WebGL. DOM-текста нет вообще

**Что это:** приём · работы примерно два дня

**Как устроено у них**

В `index.html` тег `<body>` пустой. Загрузчик создаёт ровно три DOM-узла:
`div#app`, `div#loader` (полоска ASCII) и `div#webgl`. Поиск по бандлу даёт
`innerHTML` два раза (сообщение «WebGL2 не поддержан» и парсер SVG внутри
загрузчика текстур) и `textContent` два раза (та же заглушка и строка стилей
`div#webgl{...}`). Ни одного заголовка, абзаца или ссылки в разметке нет.

Значит весь текст сайта - заголовки проектов, манифест, даты, температуры,
подписи UI, копирайт, тексты внутри карточек проектов - нарисован в сцене как
MSDF-геометрия. Шрифт подключён и в CSS (`@font-face IBMPlexMono-Medium`,
woff2 + woff), но нужен он только на случай выделения и для доступности; сам
кадр его не использует.

Единственный настоящий DOM-текст на сайте:
`"Seems like WebGL2 is not supported by your browser 😰 Please update it to
access the experience."`

**Где видно в их коде**

`<body></body>` в index.html; `if(!q.capabilities.webgl2){s(()=>!1),t(2,c=!0);return}`
в загрузке App3D; 16 вызовов `new Ui(` (класс MSDF-текста) на весь сайт

## 1.2. Атлас глифов: MSDF 512x1024, сетка 8 x 13, 100 глифов, ноль кернинга

**Что это:** ассет · работы примерно полдня

**Как устроено у них**

Пара файлов на шрифт:

| Файл | Размер | Что внутри |
|---|---|---|
| `assets/fonts/IBMPlexMono-Medium.json` | 24 308 Б | метрики и координаты глифов |
| `assets/fonts/IBMPlexMono-Medium-datatexture.ktx2` | 110 330 Б | сам атлас, 512x1024, RGBA8, один уровень, zstd |

Заголовок JSON дословно:

```json
"atlas": { "type":"msdf", "distanceRange":4, "size":42,
           "width":512, "height":1024, "yOrigin":"bottom",
           "grid": { "cellWidth":64, "cellHeight":64,
                     "columns":8, "rows":13,
                     "originX":0.45, "originY":0.4404761904761905 } },
"metrics": { "emSize":1, "lineHeight":1.3, "ascender":1.025,
             "descender":-0.275, "underlineY":-0.161,
             "underlineThickness":0.077 }
```

Сто глифов, `kerning` - пустой массив (моноширинный шрифт, кернинг не нужен, и
код кернинга в воркере по факту всегда возвращает 0). Кегль 42 пикселя на em,
ячейка 64x64, дальность поля расстояний 4 пикселя. Восемь столбцов сетки - это
то самое число 8, которое всплывёт в шейдере анимации появления (пункт 1.4).

Отдельно лежат две вспомогательные текстуры-строки:

| Файл | Размер | Габарит | Для чего |
|---|---|---|---|
| `images/numbers-datatexture.ktx2` | 13 540 Б | 280x36 RGBA8 | MSDF-полоса десяти цифр, 28 пикселей на цифру |
| `images/igloo/numbers.ktx2` | 4 862 Б | 32x1024, 11 уровней, BasisLZ | цифры для частиц вступления |

**Где видно в их коде**

`le.load("../fonts/IBMPlexMono-Medium-datatexture.ktx2","data")` 15 раз;
`le.load("numbers-datatexture.ktx2","data")` 2 раза

## 1.3. Геометрию строки собирает веб-воркер и отдаёт семь атрибутов

**Что это:** приём · работы примерно день

**Как устроено у них**

Класс `AR` (загрузчик MSDF) держит пул воркеров
`new Worker("/assets/msdfworker-ac346fa7.js")`, кеширует разобранный JSON шрифта
в `Map` и на каждую строку шлёт задачу в воркер. Обратно приходит готовый
`BufferGeometry`:

```js
n.setIndex(new We(a.index,1));
n.setAttribute("position",   new We(a.position,3));
n.setAttribute("uv",         new We(a.uv,2));
n.setAttribute("uvMask",     new We(a.uvMask,4));
n.setAttribute("textWeights",new We(a.textWeights,2));
n.setAttribute("lineWeights",new We(a.lineWeights,3));
n.setAttribute("centr",      new We(a.centr,3));
n._maxLineHeight = a.maxLineHeight;
n._maxUVDisp     = a.maxUVDisp;
```

Четыре вершины и шесть индексов на глиф, пробелы и переводы строк места не
занимают (`c.replace(/[ \n]/g,"").length`). Что в атрибутах:

- `position` - четырёхугольник глифа в единицах кегля: `planeBounds * (size / lineHeight)`
- `uv` - координаты в атласе, `atlasBounds / 512` и `/1024`
- `uvMask` - `vec4(left, right, bottom, top)` той же ячейки атласа, чтобы можно
  было ездить по UV внутри глифа и не залезть в соседний
- `centr` - центр глифа, `vec3`, одинаковый на все четыре вершины
- `textWeights.x` - сквозной номер глифа делённый на (всего глифов - 1)
- `textWeights.y` - сквозной номер слова делённый на (всего слов - 1)
- `lineWeights.x` - номер глифа ВНУТРИ строки, нормированный
- `lineWeights.y` - номер слова внутри строки, нормированный
- `lineWeights.z` - номер строки делённый на (всего строк - 1)

Пять весов - пять разных законов, по которым текст может проявляться: по буквам
подряд, по словам подряд, по буквам внутри строки, по словам внутри строки, по
строкам. Считается это один раз при сборке геометрии, в шейдере остаётся один
`falloff`.

Перенос строк воркер делает сам: копит ширину, при выходе за `options.width`
либо режет по слову (`wordBreak:false`, откат к последнему пробелу), либо по
букве (`wordBreak:true`). Выравнивание сдвигает всю строку: `center` вычитает
половину ширины, `right` - всю ширину.

**Где видно в их коде**

`function pR(){return new Worker("/assets/msdfworker-ac346fa7.js")}`; класс `AR`
с `jsonCache` и `workerPool`; сам воркер - один `onmessage`

## 1.4. Появление текста: буквы перебирают восемь чужих глифов и садятся на свой

**Что это:** приём · работы примерно полдня

**Как устроено у них**

Главный приём подачи текста на всём сайте. В библиотеке есть две штатные
анимации (`ANIMATION_TRANSLATE` - глиф въезжает геометрией, `ANIMATION_MASK` -
UV едет внутри своей ячейки с зажимом по `uvMask`), но на боевом сайте не
включена НИ ОДНА: поиск `ANIMATION_TRANSLATE:1..5` и `ANIMATION_MASK:1..5` даёт
ноль совпадений. Все шестнадцать текстов передают свой вершинный и фрагментный
шейдер, и он везде один и тот же:

```glsl
float tr1 = falloff(textWeights.x, 0.0, 1.0, 0.1, clamp(uShow1, 0.0, 1.0));
float tr2 = falloff(textWeights.x, 0.0, 1.0, 1.0, clamp(uShow2, 0.0, 1.0));

vUv = uv;
vUv.x = mod(uv.x + 0.125 * mod(floor((1.0 - tr2) * 5.753), 8.0), 1.0);
vAlpha = tr1;

gl_Position = projectionMatrix * viewMatrix * billboardModelMatrix() * vec4(position, 1.0);
```

Как это читается. `0.125` - это ровно `1/8`, ширина одного столбца сетки атласа
(в шрифте `columns: 8`). `mod(floor((1-tr2)*5.753), 8.0)` даёт целое от 0 до 7,
которое меняется 5.753 раза за пробег `tr2` от 0 до 1. То есть UV глифа
прыгает горизонтально по соседним ячейкам атласа: буква успевает показать
пять-шесть ЧУЖИХ глифов и садится на свой, когда `tr2` доходит до 1. Дробное
5.753 взято, чтобы буквы не мигали в такт друг другу.

Две скорости на текст:

```js
gsap.to(uShow1,   {value:1, duration:0.4,  ease:"none"});   // проявление, поле 0.1
gsap.fromTo(uShow2,{value:0},{value:1, duration:0.75, ease:"none"}); // перебор, поле 1.0
```

`uShow1` с полем 0.1 идёт коротким жёстким фронтом слева направо (это
непрозрачность), `uShow2` с полем 1.0 размазан на всю строку (это перебор
глифов). Гашение - тот же `uShow1` в ноль за 0.2 с.

Сама функция поля:

```glsl
float _linstep(float b,float e,float t){return clamp((t-b)/(e-b),0.0,1.0);}
float falloff(float x,float start,float end,float margin,float progress){
  float m = margin*sign(end-start);
  float p = mix(start-m, end, progress);
  return _linstep(p+m, p, x);
}
```

Это волна шириной `margin`, которая едет по значению веса от `start-margin` до
`end` по мере роста `progress`. Одна формула закрывает и появление, и исчезание,
и любой из пяти весов.

`billboardModelMatrix()` разворачивает текст лицом к камере: матрица модели
пересобирается из осей вида (`getViewRight/Up/Back`), масштаб и положение
берутся из исходной. Текст в сцене всегда читается фронтально при любом
положении камеры.

**Где видно в их коде**

Класс `YL` (заголовок проекта, смещение ~1265587), `qL` (дата), `L3` (манифест),
`Yh` (тексты карточки) - у всех одинаковая строка с `0.125` и `5.753`

## 1.5. Приборные подписи: линия-выноска рисуется LineSegments из двух отрезков

**Что это:** приём · работы примерно день

**Как устроено у них**

Подпись `PORTFOLIO_CO_01 PUDGY PENGUINS` с уголком-выноской - это два объекта:
`LineSegments` с динамической геометрией и MSDF-текст, оба с `renderOrder 999`,
`depthTest:false`, `depthWrite:false`, аддитивным блендингом.

Точка крепления берётся из габаритной коробки самого куба и переводится в мир:

```js
const n = this.parent.mesh.geometry.boundingBox;
El.set(mix(n.min.x, n.max.x, 0.35),
       mix(n.max.y, n.min.y, 0.15),
       mix(n.min.z, n.max.z, 0.93));
El.applyMatrix4(this.parent.mesh.matrixWorld);
```

Дальше строятся два колена в экранных осях сцены (`_LEFT` и `_UP` - векторные
произведения оси взгляда с `camera.up`):

```js
wp = El + _LEFT*(-0.3) + _UP*0.3;   // конец первого колена
Ep = wp + _LEFT*(-0.5);             // конец второго, горизонтального
Wh = lerp(El, wp, fit(animationProgress, 0,   0.5, 0, 1));
Jx = lerp(Wh, Ep, fit(animationProgress, 0.5, 1,   0, 1));
lineMesh.geometry.setAttribute("position", new BufferAttribute([...El,...Wh,...Wh,...Jx], 3));
```

То есть выноска ВЫРАСТАЕТ: первую половину прогресса тянется наклонное колено,
вторую - горизонтальная полка, и на её конце садится текст. Прогресс -
`gsap.to(animationProgress, {value:1, duration:0.2, ease:"none"})`, гашение 0.2 с.

Размер подписи держится постоянным на экране:
`text.scale.setScalar(Math.min(0.8, 0.5/(screen.h/1300)))` - опорная высота окна
1300 пикселей, потолок масштаба 0.8. Текст ставится на полку со сдвигом вверх на
`size.y*0.5*scale.y + 0.05`.

У даты (`qL`) выноска короче - одно колено `Cl -> Cl + _LEFT*0.7`, точка
крепления `(0.7, 0.75, 0.95)` по коробке, поле зрения появления
`fit(t, -1.2, 0.5, -1, 1)`.

Текст даты и призыва набирается одной строкой с переводом:

```js
text: `D ${date.replaceAll("/",".")}\n${(interior.enabled ? Be.click : Be.clickDisabled).toUpperCase()}`
// Be.click = "Click to explore"
// Be.clickDisabled = "???????????????"
// align:"right", width:1, lineHeight:0.8, size:0.115
```

Пятнадцать вопросительных знаков вместо «CLICK TO EXPLORE» - это заглушка для
кубов без внутренней страницы. Длина подобрана так, чтобы блок не прыгал.

Заголовок: `align:"left", width:1, lineHeight:0.8, size:0.13`.

Показ и скрытие завязаны на положение куба на экране, а не на скролл напрямую:
`1 - Math.abs(fit(t, -1.6, 0.5, -1, 1)) === 0` - куб уехал, гасим. При каждом
появлении дёргается писк (пункт 1.7).

**Где видно в их коде**

Классы `YL` (~1265587) и `qL` (~1269379); `Be.cubes[]` с полями `title`, `date`,
`temp`, `hash`, `interior.enabled`

## 1.6. TEMP 35.42: восемь плиток-цифр, знак рисуется двумя aastep, всё в одном меше

**Что это:** приём · работы примерно день

**Как устроено у них**

Самый плотный кусок текстовой работы на сайте. Класс `XL`. Меш собирается один
раз из разнородных кусков и потом только меняет один целочисленный атрибут.

Сборка (`init`):

```js
const e = new Ui({font:"IBMPlexMono-Medium", text:"TEMP", width:.75, align:"left", lineHeight:.8, size:.1});
const t = new Ui({font:"IBMPlexMono-Medium", text:".",    width:.75, align:"left", lineHeight:.8, size:.1});
// у обеих геометрий сносим centr / lineWeights / textWeights / uvMask
// и добавляем целочисленный атрибут isNum = -1 (это буквы)

const o = new PlaneGeometry(.06,.06);        // плитка под одну цифру
o.setAttribute("isNum", Int32Array заполнен 1);
o.scale(.77777, 1, 1);                        // пропорция моноширинного знака

let l = .3, c = 0;
for (let f = 0; f < 8; f++) {
  const p = o.clone(); l += .045; p.translate(l, .024 + c, 0); r.push(p);
  if (f === 1 || f === 5) { l += .025; точка.translate(l, c, 0); r.push(точка); l += .025; }
  if (f === 3) { c = -.1; l = .3; знак = o.clone(); знак.isNum.fill(-2); знак.translate(l - .015, .024 + c, 0); r.push(знак); }
}
```

Шаг между цифрами 0.045, точка вставляется после второй и шестой цифры, после
четвёртой цифры каретка опускается на 0.1 вниз и возвращается влево - получаются
две строки: Цельсий сверху, Фаренгейт снизу, и знак `+`/`-` перед нижней.
Всё склеивается `mergeGeometries` в один меш, `renderOrder 999`.

Одна текстура на цифры, одна на буквы, разбор по `isNum` во фрагменте:

```glsl
if (vIsNum == -1) {                      // буквы TEMP
    alpha *= msdf(tMap, uv);
} else if (vIsNum < -1) {                // знак: -2 минус, -3 плюс
    vec2 signUV = abs(uv * 2.0 - 1.0);
    alpha  = aastep(signUV.y, 0.18) * aastep(signUV.x, 0.8);
    if (vIsNum == -3) alpha = max(alpha, aastep(signUV.x, 0.2) * aastep(signUV.y, 0.7));
    alpha *= step(0.99, vAlpha);
} else {                                 // цифры
    float numStep = 1.0 / 10.0;
    uv = vec2(numStep * vUv.x + float(vIsNum) * numStep, vUv.y);
    uv.x = uv.x + numStep * mod(floor((1.0 - vAlpha2) * 5.753), 8.0);
    alpha *= msdf(tNums, uv);
}
```

Знак `+` и `-` не нарисованы нигде: минус - это горизонтальная полоска
(`|y| < 0.18` и `|x| < 0.8`), плюс - она же плюс вертикальная (`|x| < 0.2`,
`|y| < 0.7`), обе через `aastep`. Экономия одной текстуры и полная свобода в
толщине.

Цифры сдвигаются по полосе десяти знаков тем же трюком перебора (`5.753`,
`mod ... 8.0`), только шаг здесь `1/10`, а не `1/8`.

Само число живёт и дышит:

```js
this.temp = this.targetTemp + Math.sin(Fe.time * 0.05 + this.random1) * 2;
const a = this.temp.toFixed(2).split(".");
if (this.temp >= 0) a[0] = `+${a[0]}`;
if (a[0].length === 2) a[0] = `${a[0][0]}0${a[0][1]}`;   // ведущий ноль
const c = (this.temp * 1.8 + 32).toFixed(2).split(".");  // Фаренгейт
[4,5,7,8]   .forEach((u,f)=>{ ... }); // верхняя строка
[10,11,13,14].forEach((u,f)=>{ ... }); // нижняя строка
[9]         .forEach(...);             // знак: temp < 0 ? -2 : -3
this.mesh.geometry.attributes.isNum.needsUpdate = true;
```

Базовые температуры прописаны в конфиге кубов: `temp: 0`, `-3`, `-5`. Плюс
синус амплитудой 2 градуса и периодом `2π/0.05 ≈ 126` секунд, со случайной
фазой на каждый куб. Каждый кадр в GPU уезжает только `Int32Array` из
шестнадцати чисел.

Появление: `uShow1` 0.4 с, `uShow2` 0.75 с, гашение `uShow1` за 0.2 с. Точка
крепления `(0.7, 0.15, 0.93)` по коробке куба, сдвиг влево на 0.3.

**Где видно в их коде**

Класс `XL`, смещение ~1273400

## 1.7. Писк при каждом появлении подписи, три варианта, не чаще одного в 0.4 с

**Что это:** приём · работы примерно час

**Как устроено у них**

```js
playBeep(){
  if (Fe.time - this.lastBeepPlayed < .4) return;
  this.lastBeepPlayed = Fe.time;
  switch (Math.floor(Math.random()*3)) {
    case 0: Q.emit("webgl_play_audio","beeps");  break;
    case 1: Q.emit("webgl_play_audio","beeps2"); break;
    case 2: Q.emit("webgl_play_audio","beeps3"); break;
  }
}
```

Три файла `beeps.ogg`, `beeps2.ogg`, `beeps3.ogg`, громкость 0.5, у каждого ещё
и собственный предохранитель `minTimeBetweenPlays: 0.4`. Заголовок, дата и
температура появляются почти одновременно, но писк раздаётся один: кто первый
успел, тот и занял окно.

## 1.8. Номера у точек: это округлённое расстояние от куска до его центроида

**Что это:** приём · работы примерно полдня

**Как устроено у них**

Двузначные номерки, которые всплывают у узлов сетки при наведении на иглу, ничего
не значат по смыслу - они посчитаны из геометрии:

```js
const s = e[t].centroid.distanceTo(e[t].position);
let n = `${Math.floor(s * 50)}`.slice(-2);
if (n.length < 2) n = `0${n}`;
nums[t*2]   = n[0];
nums[t*2+1] = n[1];
```

Расстояние от куска до его центра умножается на 50, округляется вниз, берутся
две последние цифры, при нужде дописывается ведущий ноль. Число меняется, пока
кусок дышит, и выглядит как показания прибора.

Рисуется это `InstancedMesh` на `maxPlexusPoints = 5` экземпляров. Каждый
экземпляр - два четырёхугольника со своим атрибутом `side` (-1 и +1), склеенных
в одну геометрию. Во фрагменте выбирается цифра:

```glsl
float numStep = 1.0 / 10.0;
float num = float(vSide < 0 ? vNums.x : vNums.y);
vec2 uv = vec2(numStep * vUv.x + num * numStep, vUv.y);
float a = msdf(tNums, uv);
```

Двузначное число - две плитки в одном экземпляре, левая читает `nums.x`, правая
`nums.y`. Ставится группа сбоку от точки, причём сторона выбирается по знаку
экранной координаты, чтобы номер не уезжал за край кадра:

```glsl
vec4 projPos = projectionMatrix * viewMatrix * instanceMatrix * vec4(0.0,0.0,0.0,1.0);
float screenSide = -sign(projPos.x / projPos.w);
pos.xyz += left * screenSide * uSize * 1.75;
pos.xyz += up   * 1.0 * uSize;
```

Кегль опять привязан к окну: `uSize = Math.min(0.1, 0.08/(screen.h/1300))`.
Появление номера - `position * size * power1In(progress)`, то есть плитка
раскрывается из нуля по квадратичной кривой.

**Где видно в их коде**

Классы `D3` (номера, ~1165900) и `R3` (сетка) в сцене иглу

## 1.9. Размытый текст на фоне: запечённая .drc-простыня, рисуется в экранных координатах

**Что это:** и приём и ассет · работы примерно день

**Как устроено у них**

Дальний фоновый текст сцены кубов набран заранее и лежит готовой геометрией:

| Файл | Размер | Что это |
|---|---|---|
| `geometries/blurrytext.drc` | 1 187 Б | плоское поле четырёхугольников |
| `geometries/blurrytext_cylinder.drc` | 5 571 Б | то же, свёрнутое в цилиндр |
| `images/cubes/blurrytext_atlas.ktx2` | 7 781 Б | 256x256, 9 уровней, BasisLZ |

Читается только канал R атласа. Восемь килобайт на весь фоновый текст сцены.

Ключевой ход: меш рисуется НЕ через матрицу проекции. Вершинный шейдер сам
кладёт результат в отсечённые координаты:

```glsl
vec3 localpos = position - centr;   // глиф относительно своего центра
vec3 offset   = centr;              // где стоит глиф
offset.x /= aspect;

float depth = offset.z * 0.5 + 0.5; // z атласа работает как глубина

localpos.x /= aspect;
localpos *= 2.5;
localpos *= mix(1.0, 2.0, depth);   // дальние крупнее вдвое

offset.y = fract((offset.y*0.5+0.5) + uProgress*1.25*depth) * 2.0 - 1.0; // бесконечная лента
offset *= 1.7;                      // разлёт

vec3 pos = localpos + offset;
vAlpha = texture2D(tPerlin, pos.xz*3.0 + time*0.075 + offset.z*10.0).r;
vAlpha = smoothstep(0.1, 0.6, vAlpha);

gl_Position = vec4(pos, 1.0);       // закомментирована строка с projectionMatrix
```

Отсюда три вещи сразу. Первое: текст не крутится вместе с камерой и не имеет
перспективы, он живёт на плоскости экрана. Второе: `fract(... + uProgress*1.25*depth)`
даёт бесконечную прокрутку с параллаксом - слои с разной `z` едут с разной
скоростью. Третье: глубина не размывает текст, она его УВЕЛИЧИВАЕТ (`mix(1,2,depth)`),
а размытие уже впечено в атлас. Настоящей глубины резкости на сайте нет вообще
(метод `addDOF` в библиотеке есть, вызовов ноль).

Растворение слоёв - перлин по `pos.xz*3.0 + time*0.075`, порог
`smoothstep(0.1, 0.6)`. Итоговая непрозрачность `texture(tMap,uv).r * vAlpha * 1.2`.

Цилиндрический вариант (сцена входа) уже с обычной проекцией, поставлен на
`y = -10.33`, две копии одной геометрии: масштаб 1.75 (`renderOrder 1`) и 3.5 с
поворотом на 90 градусов (`renderOrder 0`). Гашение:

```glsl
alpha *= clamp(vPos.y * 2.0, 0.0, 1.0);                        // по высоте
alpha *= sin(time*2.0 + vRand*10.0 + (vPos.x*2.0 + vPos.z*2.0))*0.5 + 0.5;
alpha *= falloffsmooth(length(vPos.xz), 0.0, 10.0, 3.0, uAlpha); // по радиусу на скролле
alpha *= 0.7 * uAlpha;
```

**Где видно в их коде**

Классы `z3` (плоский, ~1206234) и `fF` (цилиндр)

## 1.10. Тексты карточки проекта: 24 px на мониторе, 18 на узком, колонка не шире 500

**Что это:** приём · работы примерно полдня

**Как устроено у них**

Текст внутри открытой карточки проекта тоже MSDF, только в ортографической
UI-сцене, где единица - пиксель:

```js
resize(){
  const e = this.scene.small ? 18 : 24;   // кегль
  const t = 500, s = 20;                  // потолок колонки и поле по краю
  this.width = Math.min(q.screen.width - s*2, t);
  const n = 25;                           // отбивка между блоками
  const r = Math.max(s, (q.screen.width - this.width)*0.5);  // левое поле
  ...
  this.scrollMax = Math.max(0, a - (q.screen.height - this.scrollMargin*4));
  if (this.scrollMax > 0) o = this.scrollMargin*2;
  else o = (q.screen.height - a)*0.5;     // короткий текст центрируется
}
```

`scrollMargin = 65`, `lineHeight: 1`, `baseOffset: -0.65`. Внутренняя прокрутка
карточки - `lerpFPS(scrollY, scrollTargetY, 0.1)`, колесо один к одному,
стрелки по 150 пикселей.

Растворение у краёв экрана считается прямо во фрагменте, чтобы текст не резался
жёсткой границей:

```glsl
alpha *= smoothstep(-uFadeMargin,                  -uFadeMargin*3.0,                  wPosY);
alpha *= smoothstep(-resolutionUI.y + uFadeMargin, -resolutionUI.y + uFadeMargin*3.0, wPosY);
```

Появление блоков каскадом: длинный текст (>100 знаков) появляется за 0.75 с и
задерживает следующий на 0.3 с, короткий - за 0.25 с и задерживает на 0.1 с.

Цвета из конфига: заголовок `#67707E`, тело `#A1AAB7`, белый `#ffffff`,
заголовки в сцене иглу `#3C3C54`.

**Где видно в их коде**

Классы `zF` (карточка), `Yh` (блок текста), `kF` (ссылка `[X]`, `[IG]`, `[LI]`, `[TK]`)

---

# 2. ВЗАИМОДЕЙСТВИЕ

## 2.1. Два разных механизма: луч там, где нужен клик, и плоскость там, где нужна близость

**Что это:** приём · работы примерно день

**Как устроено у них**

На сайте живут два независимых способа поймать курсор, и выбраны они по задаче.

**Луч** (`Raycaster` в классе `Er`, он же `pA`) стоит везде, где нужен клик или
курсор-палец: кубы портфолио, логотип, кнопка звука, кнопка закрытия, стрелки
переключения, ссылки в карточке. Конструктор:

```js
new Er({ meshes:[...], camera, onHover, onTouch, onMove, onDrag, onClick,
         performant:false, performantMode:"bounding_sphere",
         finger:0, interactWhileTouching:false, hoverCursor:false, grabCursor:false });
```

Есть дешёвый режим `performant:true`, который вместо честного пересечения
проверяет только габаритную сферу или коробку:

```js
this._meshes.forEach(h=>{
  const d = h[o] !== undefined ? h : h.geometry;   // o = "boundingSphere" | "boundingBox"
  if (d[o] === null) d[l]();                       // computeBoundingSphere()
  if (this._raycaster.ray[c](r.copy(d[o]).applyMatrix4(h.matrixWorld))) s.push({object:h});
});
```

На кубах включён `three-mesh-bvh` и `firstHitOnly`:

```js
this.interaction._raycaster.firstHitOnly = !0;
```

BVH обходит дерево и останавливается на первом попадании, лучу не нужно
перебирать все треугольники куба и сортировать результат.

Куб без внутренней страницы просто глушится, а не удаляется из списка:

```js
!!this.parent.options.interior.enabled || (this.interaction.enable = ()=>{}, this.interaction.disable = ()=>{});
```

**Плоскость** стоит там, где нужна только близость курсора и точка попадания
никого не интересует. Иглу и земля под ней не проверяются лучом вообще:

```js
Si.planeInteraction.setCamera(this.scene.camera);
Si.planeInteraction.setPlaneFromCameraTargetAndDistance(19.25);
Ls.copy($t.get(0).position11);                                // курсор в -1..1
const e = Si.planeInteraction.getPointPositionOnPlane(Ls);    // распроецировали
this.mousePosition.lerp(e, ie.lerpCoefFPS(0.05));             // догоняем с инерцией
```

Плоскость ставится перпендикулярно взгляду в 19.25 единицах от цели камеры, курсор
на неё распроецируется, и дальше вся сцена работает с обычной трёхмерной точкой.
Один `unproject` на кадр вместо обхода восьмидесяти тысяч треугольников.

**Где видно в их коде**

Класс `pA`/`Er` (~1062878); класс `Pw` (`planeInteraction`); `U3.update()` в
сцене иглу (~1180814)

## 2.2. Отклик иглу: сила по расстоянию, две ступени лерпа, ничего резкого

**Что это:** приём · работы примерно день

**Как устроено у них**

Восемьдесят с лишним кусков иглу реагируют на курсор без единого луча:

```js
const c = Math.sin(Fe.time + a.rand.x * 12.342) * a.rand.y;   // личная фаза куска
const h = ie.fit( ie.smoothstep(1, 3, a.centroid.distanceTo(this.mousePosition)),
                  0, 1, 0.5 + 0.3*c, 0 );
l = Math.max(l, h * t);        // t - раскрытие по скроллу

a.targetBounce1 = l;
a.targetBounce2 = ie.lerpFPS(a.targetBounce2, a.targetBounce1, 0.05);
a.bounce        = ie.lerpFPS(a.bounce,        a.targetBounce2, 0.05);

const d = ie.smoothstep(0.45, 0.7, a.centroid.y);   // верх иглу отвечает сильнее
l *= d; l = Math.max(0, l);
a.targetDisplacement1 = l;
a.targetDisplacement2 = ie.lerpFPS(a.targetDisplacement2, a.targetDisplacement1, 0.06);
a.displacement        = ie.lerpFPS(a.displacement,        a.targetDisplacement2, 0.06);
```

Числа. Радиус влияния - от 1 до 3 единиц (`smoothstep(1,3,...)`), внутри единицы
отклик полный, дальше трёх нулевой. Амплитуда `0.5 + 0.3*c`, то есть от 0.2 до
0.8 в зависимости от собственного колебания куска: два соседних куска на одном
расстоянии от курсора отвечают по-разному.

Инерция сделана ДВОЙНЫМ лерпом с одинаковым коэффициентом (0.05 на подскок,
0.06 на смещение). Один лерп даёт экспоненту, два подряд - S-образную кривую с
разгоном и торможением. Это дешёвая пружина без пружинного решателя: отклик
запаздывает, но никогда не дёргается.

Сам курсор тоже с инерцией (`lerpCoefFPS(0.05)`), и отдельно копится скорость:

```js
this.mouseVelocity += Ls.sub(this.mousePosition).length() * 0.01;
this.mouseVelocity *= ie.frictionFPS(0.98);
this.mouseVelocity = ie.clamp(this.mouseVelocity, 0, 1);
```

Трение 0.98 за кадр при 60 кадрах в секунду - половина спадает примерно за 34
кадра, около 0.6 секунды.

Все три величины (`0.05`, `0.06`, `0.98`) пропущены через `lerpFPS` и
`frictionFPS`, то есть пересчитаны на реальный шаг кадра. На ноутбуке в 30
кадров и на мониторе в 144 движение одинаковое.

**Где видно в их коде**

`U3.update()` в сцене иглу, смещение ~1180814

## 2.3. Сетка узлов у курсора: пять точек, две связи, одна смена за кадр

**Что это:** приём · работы примерно день

**Как устроено у них**

Класс `R3`. Числа объявлены прямо в конструкторе:

```js
this.maxPlexusPoints      = 5;      // сколько узлов держим
this.maxPlexusConnections = 2;      // сколько линий на узел
this.animateLineInTime    = 0.1;    // появление узла
this.animateLineOutTime   = 0.06;   // исчезание
```

Отбор кандидатов каждый кадр:

```js
Ya.copy(mousePosition).addScaledVector(направлениеНаКамеру, 1);       // точка чуть ближе к камере
const s = this.lastMousePosition.distanceTo(Ya) > 0.05;               // курсор реально двинулся
let n = objects.map(u => (u.__plexusDistance = u.position.distanceToSquared(Ya), u));
n.sort((u,f) => u.__plexusDistance - f.__plexusDistance);
n = n.filter(u => u.displacement > 0.1);                              // только уже раскрытые куски
n = n.slice(0, 5);
n = n.filter(u => u.__plexusDistance < 2);                            // радиус 2 единицы
```

Сортировка идёт по КВАДРАТУ расстояния, корень берётся только для пяти
финалистов - экономия восьмидесяти `Math.sqrt` на кадр.

И главное: за один кадр добавляется или убирается РОВНО ОДИН узел, дальше стоит
замок `isPlexusTransitioning`, пока твин не доиграет. Сетка не может мигнуть
целиком, она всегда перестраивается по одному узлу за 0.06-0.1 секунды.

Точка подвеса узла отодвигается от центра иглу на 0.2, чтобы маркер не тонул в
геометрии:

```js
u.__UIPos = Ih.copy(u.position).addScaledVector(Ya.copy(u.centroid).normalize(), 0.2).toArray();
```

Линия между двумя узлами рисуется не сразу целиком: она дотягивается по
прогрессу того узла, который появился позже.

Маркер узла - точка `Points` с размером `uSize=50`, поворотом по прогрессу и
формой в виде квадратной рамки:

```glsl
vec2 uv = rotateUV(gl_PointCoord.xy, mix(1.3, 0.0, vProgress));   // рамка доворачивается
uv = uv*2.0 - 1.0;
const float size = 0.1;
float shape = 1.0 - aastep(size, abs(uv.x)) * aastep(size, abs(uv.y));
vec3 col = mix(vec3(0.0), uColor, smoothstep(0.75, 1.5, length(wPos)));  // центр гаснет
gl_PointSize = size / length(viewPos.xyz) * (resolution.y / 1300.0);
```

Цвет точек `#666666`, линий `#7f7f7f` с непрозрачностью 0.25, аддитивный
блендинг, `depthTest` у линий выключен.

**Где видно в их коде**

Классы `R3`, `ZL` (точки), `D3` (номера)

## 2.4. Наведение на куб рисует по нему иней. Это отдельный буфер 512x512 с волной

**Что это:** приём · работы примерно два дня

**Как устроено у них**

Лучший приём взаимодействия на сайте. Куб не подсвечивается - по нему
РАСПОЛЗАЕТСЯ иней вслед за курсором, и след живёт своей жизнью после ухода
курсора.

Буфер на куб:

```js
this.options = { width:512, height:512 };
const s = new WebGLRenderTarget(512, 512, { type: HalfFloatType, depthBuffer: false });
this.rts = [s, s.clone()];   // пинг-понг
```

Шаг симуляции - один полноэкранный четырёхугольник, не чаще чем раз в 0.015
секунды (около 66 раз в секунду):

```glsl
// снос шумом
vec2 advect = (texture2D(tAdvect, vUv*3.0).xy * 2.0 - 1.0) * 1.0;
uv += advect * invResolution;

// распространение волны: берём максимум из четырёх соседей
float wavespeed = 1.0;
vec2 offset = invResolution * wavespeed;
float l = texture2D(tBuffer, uv - vec2(offset.x,0.0)).r;
float r = texture2D(tBuffer, uv + vec2(offset.x,0.0)).r;
float t = texture2D(tBuffer, uv + vec2(0.0,offset.y)).r;
float b = texture2D(tBuffer, uv - vec2(0.0,offset.y)).r;
float nextVal = max(max(max(l,r),t),b);

// клякса вдоль отрезка от прошлого положения курсора к текущему
float radius = 0.05 * smoothstep(0.1, 1.0, uSplatRadius);
float splat  = cubicIn(clamp(1.0 - line(vUv, uSplatPrevCoords.xy, uSplatCoords.xy)/radius, 0.0, 1.0));
nextVal += splat;

nextVal *= 0.985;                 // затухание
nextVal = min(nextVal, 1.0);
float rim = nextVal - texture2D(tBuffer, uv).r;   // кромка: насколько выросло за шаг

gl_FragColor = vec4(nextVal, rim, 0.0, 1.0);
```

Три вещи, ради которых это и сделано. `max` из четырёх соседей вместо
диффузии - иней РАСТЁТ, а не размывается, у него остаётся резкая кромка. Второй
канал `rim` - производная по времени, и именно она даёт светящийся передний
край. Затухание 0.985 за шаг: половина спадает примерно за 46 шагов, то есть
около 0.7 секунды.

Клякса ставится отрезком между прошлым и текущим положением курсора (`line()` -
расстояние до отрезка). Точка на этом месте оставляла бы пунктир при быстром
движении мыши.

Радиус кляксы зависит от скорости курсора, и скорость считается со своей
инерцией:

```js
let e = this.splatPosition.distanceTo(this.splatLastPosition);
if (Fe.time - this.splatLastMoveTime > 0.15 || this.splatHovered || e > 0.3) {
  this.splatLastPosition.copy(this.splatPosition);
  this.splatTargetVelocity = 0; this.soundVelocity = 0; e = 0;   // телепорт курсора не считаем
}
this.splatTargetVelocity += e * 6;
this.splatTargetVelocity *= 0.88;
this.splatTargetVelocity  = ie.clamp(this.splatTargetVelocity, 0, 1);
this.splatVelocity = ie.lerp(this.splatVelocity, ie.ease(this.splatTargetVelocity, "power4.out"), 0.1);

this.soundVelocity += e * 4;
this.soundVelocity *= 0.98;
```

Два предохранителя от рывка: пауза больше 0.15 с и скачок больше 0.3 по UV
сбрасывают историю. Копление `*6`, трение 0.88, потом ещё лерп 0.1 через
`power4.out` - три ступени сглаживания на одну величину.

Отдельная скорость для звука с более мягким трением 0.98 крутит громкость
петли `shard.ogg`.

Координата берётся из ВТОРОГО набора UV меша, а не из экрана:

```js
onMouseMove(e){ const t = e.interactions[0]; if(!t) return; this.splatPosition.copy(t.uv1); }
```

Как буфер входит в материал куба. Материал - расширенный `MeshPhysicalMaterial`
через `onBeforeCompile`, три врезки:

```glsl
// 1. читаем буфер по второму UV
vec2 mousefrostdata = texture2D(tMouseFrost, vUv1).rg;
float mousefrost    = mousefrostdata.r;
float mousefrostrim = mousefrostdata.g;

// 2. иней делает поверхность зеркальной и гасит рельеф
float roughnessFactor = roughness;
roughnessFactor *= 1.0 - mousefrost;
...
mapN.xy *= normalScale;
mapN.xy *= 1.0 - mousefrost;

// 3. кромка светится, треугольная сетка проступает
totalEmissiveRadiance += mousefrostrim * uColorFrost;                     // uColorFrost = #83a1c5
float triangles = texture2D(tTriangles, vNormalMapUv * (9.0 * min(1.0, uResolution.y/1300.0))).r;
totalEmissiveRadiance += triangles * mousefrostrim * 10.0;
totalEmissiveRadiance += triangles * pow(mousefrost, 2.0);
```

Множитель 10 на кромке - вот откуда яркая бегущая линия. Основное поле входит в
квадрате (`pow(mousefrost,2.0)`), то есть светится заметно слабее.

Клик по кубу:

```js
onMouseClick(e){
  this.interaction.disable();
  Q.emit("webgl_switch_scene", `portfolio/${this.parent.options.hash}`);
}
```

Взаимодействие сразу глушится, чтобы двойной клик не запустил переход дважды.
Дальше идёт роутер (`/portfolio/:project`), меняется адрес в строке браузера, и
уже роутер разворачивает карточку. Ссылки в карточке ведут наружу через
`window.open(url, "_blank").focus()`.

**Где видно в их коде**

Классы `JL` (материал симуляции) и `jL` (обвязка, ~1282577); `WL` - материал
куба с врезками

## 2.5. Курсор. Никакого своего курсора нет, меняется системный

**Что это:** приём · работы примерно час

**Как устроено у них**

Своего нарисованного курсора на сайте нет ни в DOM, ни в сцене. Меняется
системный, тремя строками внутри класса взаимодействия:

```js
this._hoverCursor && (he.interactionNode.style.cursor = this.hovering ? "pointer" : "");
this._grabCursor && !this.dragging && (he.interactionNode.style.cursor = this.hovering ? "grab" : "");
// и в _performTouch:
this._grabCursor && (he.interactionNode.style.cursor = this.touching ? "grabbing" : this.hovering ? "grab" : "");
```

`hoverCursor: true` стоит у кубов, кнопки звука, кнопки закрытия, стрелок и
ссылок. `grabCursor` в боевом коде не включён нигде.

В стилях лежит правило `html body .click { cursor: pointer }`, но класс `.click`
на элементы не вешается ни разу: остаток от прошлой сборки.

## 2.6. Наведение на элементы UI: сдвиг блоками и мигание, три ступени за анимацию

**Что это:** приём · работы примерно полдня

**Как устроено у них**

Логотип, звук, закрытие, стрелки, ссылки - все нарисованы MSDF-иконками
(`ui/logo-datatexture.ktx2`, `close-datatexture.ktx2` 64x64 и так далее, по
826 байт). При наведении иконка глючит вместо того, чтобы подсветиться:

```glsl
if (uShow < 1.0) {
    float steps = 3.0;                                        // всего три состояния
    vec2 hash   = hash21(floor(uShow*steps)/steps + uRand*3.342);
    vec2 offset = hash*2.0 - 1.0;
    vec2 scale  = vec2(0.1, 0.15);
    vec2 blocksUV = uv*scale + uRand*12.4242 + offset*uRand*4.543;
    float blocks1 = texture2D(tBlocks, blocksUV).g * 2.0 - 1.0;   // зелёный канал scroll-datatexture
    uv += vec2(blocks1, 0.0) * 0.025;                             // сдвиг блоками

    a *= sin(uShow*30.0 + uRand*12.4242) * 0.15 + 0.85;           // мигание
    a *= step(0.01, uShow);
}
a *= msdf(tMap, uv);
```

Три ступени, а не плавный сдвиг (`floor(uShow*3)/3`), - изображение прыгает
тремя рывками. Амплитуда сдвига 0.025 UV. Мигание 30 колебаний за анимацию с
глубиной 0.15. `uRand` заново берётся при каждом показе, поэтому глюк никогда не
повторяется.

Длительности: наведение показывает элемент за `0.3 * 0.75 = 0.225` с, гашение
0.15 с с `power2.out`. Каждое наведение дёргает `ui-long.ogg` (громкость 0.3),
логотип - `logo.ogg`.

Стрелки листания карточек показываются на 0.2 с и гаснут за 0.1 с, причём
показывается только та сторона, на которую наведён курсор
(`c.interactions[0].object._arrow` даёт `"left"` или `"right"`).

Клавиатура: `Escape` закрывает карточку (`Q.emit("webgl_switch_scene","")`),
стрелки вверх и вниз двигают скролл на 150 пикселей.

## 2.7. Текст в карточке проекта светится там, где по нему провели мышью

**Что это:** приём · работы примерно день

**Как устроено у них**

В открытой карточке крутится настоящая симуляция жидкости с мишенями в пять раз
меньше экрана:

```js
resize(){
  const t = Math.floor(he.uniforms.resolution.value.x / 5);
  const s = Math.floor(he.uniforms.resolution.value.y / 5);
  this.rts.forEach(n => n.setSize(t, s));
}
```

Её результат читают тексты карточки прямо в вершинном шейдере:

```glsl
vec4 ppos = modelMatrix * vec4(centr, 1.0);
vec2 uvScreen = abs(ppos.xy) / resolutionUI;
vec2 val = texture2D(tSim, vec2(uvScreen.x, 1.0 - uvScreen.y)).xy;
tr    = fit(val.g, 0.01, 1.0, 0.0, 5.0);   // подмешиваем в перебор глифов
illum = val.r;                              // и в цвет

vUv.x = mod(uv.x + 0.125 * mod(floor((1.0 - tr2 + tr) * 5.654), 8.0), 1.0);
```

```glsl
gl_FragColor = vec4(mix(uColor, vec3(0.8), fit(illum, 0.6, 0.8, 0.0, 1.0)), alpha);
```

То есть буквы под курсором заново начинают перебирать глифы (`tr` добавляется в
ту же формулу перебора) и одновременно светлеют до `0.8`. Читают они текстуру по
центру глифа, один семпл на глиф, в вершине.

Те же десять тысяч мелких частиц в карточке растут и разгораются по той же
жидкости:

```glsl
vec2 fluid = texture(tSim, ndc*0.5 + 0.5).rb;
float sim  = fit(fluid.y, 1e-8, 0.3, 0.0, 1.0);
float size = mix(3.0, 10.0, random.x * sim);
gl_PointSize = size * (resolution.y * 0.002);
```

---

# 3. ПЕРЕХОДЫ МЕЖДУ СЦЕНАМИ

## 3.1. Три сцены живут одновременно, но рисуются максимум две

**Что это:** приём · работы примерно день

**Как устроено у них**

Сцен четыре: три прокручиваемых и одна для карточки проекта.

```js
const ty = { igloo: F3, cubes: aF, entry: UF };
// высоты в единицах прокрутки:
// igloo  height = 2.35
// cubes  height = 3      (по числу кубов)
// entry  height = 5.5
// сумма  10.85, прокрутка зациклена (this.scroll.y % this.scroll.total)
```

Каждая сцена - свой композер (`tA`), у каждого своя пара мишеней. Каждый кадр
вычисляется, какие сцены попадают в кадр:

```js
const s = this.scroll.y % this.scroll.total;
const n = this.scroll.y >= 0 ? s : this.scroll.total - Math.abs(s);
const r = n + 1;                       // низ окна на единицу ниже верха
const a = r % this.scroll.total;

for (let p = 0; p < this.scrollComposers.length; p++) {
  const A = сцена(p);
  const x = n >= A.__top && n <  A.__bottom;   // верх окна внутри сцены
  const v = a >  A.__top && a <= A.__bottom;   // низ окна внутри сцены
  if (x || v) { A.progress = (…) / (A.height + 1); A.isSceneVisible = true; if (x) o = p; else { l = p; c = a - A.__top; } }
  else A.isSceneVisible = false;
}
```

Окно прокрутки высотой ровно 1 единица. Значит зона перехода между двумя
сценами - тоже ровно 1 единица, и `c` (положение низа окна внутри следующей
сцены) и есть прогресс перехода от 0 до 1.

```js
if (o !== null) { this.scrollComposers[o].render(); this.material.uniforms.tScene1.value = …readBuffer.texture; }
if (l !== null) { this.scrollComposers[l].render(); this.material.uniforms.tScene2.value = …readBuffer.texture; }
this.material.uniforms.uProgress.value    = c;
this.material.uniforms.uProgressVel.value = this.scroll.velocity;
```

Вне перехода `l === null`, рисуется одна сцена, `uProgress = 0`, и шейдер сшивки
просто копирует `tScene1`. При открытой карточке на полную
(`uDetailProgress === 1`) не рисуется ни одна прокручиваемая сцена, только
композер карточки. Экономия честная: из четырёх сцен в кадре максимум две.

При множителе прокрутки `75e-5` одна единица - это примерно 1333 пикселя дельты
колеса. То есть переход длится столько, сколько пользователь крутит эти 1333
пикселя, плюс инерция подтяжки. Никакого таймера у перехода нет.

**Где видно в их коде**

`jF.render()`, смещение ~1476000

## 3.2. Ледяной разрез: одна текстура 1024x1024, три канала, три разных дела

**Что это:** и приём и ассет · работы примерно два дня

**Как устроено у них**

Стык двух сцен закрывается материалом `f3` на полноэкранном треугольнике. Одна
текстура `images/scroll-datatexture.ktx2` (1024x1024, RGBA8, zstd, 1 286 436
байт - самый тяжёлый файл сайта) делает всю работу, её каналы разведены по
задачам:

- **R** - маска ледяного разлома, по ней идёт сам разрез
- **G** - техническое смещение (блоки, глюк)
- **B** - искривление линии разреза

```glsl
vec2 uvTex = vUv - 0.5;  uvTex.x *= aspect;  uvTex += 0.5;
vec3 scrollTex = texture2D(tScroll, uvTex).rgb;

// наклон линии реза, искривлённый синим каналом
float slopeDisp   = (scrollTex.b * 2.0 - 1.0) * 0.4;
float slope       = -0.2 * aspect * step(0.0, uProgress);
float inclination = mix(1.0 - vUv.x + slopeDisp, vUv.x + slopeDisp, step(slope, 0.0));
float incProgress = fit(uProgress, 0.0, 1.0, 0.0, 1.0 + abs(slope));

// три волны с РАЗНОЙ шириной поля от одной и той же линии
float cutDiagonalBlur         = falloff(vUv.y + inclination*abs(slope), 0.0, 1.0, 2.0, incProgress); // 2.0
float cutDiagonalDisplacement = falloff(vUv.y + inclination*abs(slope), 0.0, 1.0, 0.9, incProgress); // 0.9
float cutDiagonal             = falloff(vUv.y + inclination*abs(slope), 0.0, 1.0, 0.2, incProgress); // 0.2

float cutDisp = falloff(scrollTex.g, 0.0, 1.0, 1.0, cutDiagonalDisplacement);
float cut     = falloff(scrollTex.r, 0.0, 1.0, 2.0, cutDiagonal);
```

Ключ ко всему - три ширины поля от ОДНОЙ линии. Поле 0.2 - это сам рез, узкий и
почти жёсткий. Поле 0.9 - смещение, оно идёт впереди и позади реза. Поле 2.0 -
хроматика, она размазана на две высоты кадра и потому чувствуется как атмосфера,
а не как эффект. Хроматика начинается задолго до того, как рез дойдёт до этого
места, и заканчивается сильно после.

Собственно смешение:

```glsl
const float parallaxY   = 0.4;
const float displacement = 0.025;
vec4 noise = getNoise(tBlue, gl_FragCoord.xy, uBlueOffset);   // синий шум против швов

float modulator = 12.0 * smoothstep(1.0, 0.7, abs(vUv.x*2.0-1.0))
                       * smoothstep(1.0, 0.7, abs(vUv.y*2.0-1.0));

vec3 scene1 = vec3(0.0), scene2 = vec3(0.0);
if (cut < 1.0) scene1 = chromatic_aberration(tScene1, vUv - vec2(0.0, parallaxY*power2In(uProgress)       + displacement*cutDisp),        modulator, cutDiagonalBlur*noise.r).rgb;
if (cut > 0.0) scene2 = chromatic_aberration(tScene2, vUv + vec2(0.0, parallaxY*power2In(1.0 - uProgress) + displacement*(1.0 - cutDisp)), modulator, (1.0 - cutDiagonalBlur)*noise.g).rgb;
color = clamp(mix(scene1, scene2, cut), vec3(0.0), vec3(1.0));
```

Четыре приёма в шести строках:

1. **Параллакс кадров.** Уходящая сцена уезжает вверх на 0.4 экрана по кубической
   `power2In`, приходящая приезжает снизу по той же кривой в обратную сторону.
   Кадры двигаются, а не просто растворяются.
2. **Экономия выборок.** `if (cut < 1.0)` и `if (cut > 0.0)` - там, где рез уже
   прошёл насквозь, вторая сцена вообще не читается. По пять выборок хроматики
   на сцену, и половину кадра одна из них не выполняется.
3. **Модулятор хроматики затухает к краям кадра.** `smoothstep(1.0, 0.7, ...)`
   по обеим осям: в центре сила 12, у краёв ноль. Иначе бы вылезали цветные
   каёмки по рамке.
4. **Синий шум в аргумент искажения.** `cutDiagonalBlur * noise.r` - величина
   искажения дрожит попиксельно, и ступеньки хроматики не собираются в видимые
   кольца. Смещение шума заново берётся каждый кадр:
   `uBlueOffset.set(Math.random()*10, Math.random()*12.5)`.

Хроматика (общая на весь сайт):

```glsl
#ifndef CA_ITERATIONS
const int CA_ITERATIONS = 5;
#endif
const float RECI_ITER = 1.0/float(CA_ITERATIONS);

vec2 ca_barrelDistortion(vec2 coord, float amt){
  vec2 cc = coord - 0.5; float dist = dot(cc,cc);
  return coord + cc*dist*amt;                       // бочка, сила растёт с квадратом радиуса
}
vec4 ca_spectrum_offset(float t){
  float lo = step(t,0.5), hi = 1.0-lo;
  float w  = ca_linterp(ca_remap(t, 1.0/6.0, 5.0/6.0));
  vec4 ret = vec4(lo,1.0,hi,1.0) * vec4(1.0-w, w, 1.0-w, 1.0);
  return pow(ret, vec4(1.0/2.2));                   // веса в гамме, а не в линейном
}
vec4 chromatic_aberration(sampler2D text, vec2 uv, float maxdistort, float bendAmount){
  vec4 sumcol = vec4(0.0), sumw = vec4(0.0);
  for (int i = 0; i < CA_ITERATIONS; ++i) {
    float t = float(i)*RECI_ITER;
    vec4 w  = ca_spectrum_offset(t);
    sumw   += w;
    sumcol += w * texture2D(text, ca_barrelDistortion(uv, bendAmount*maxdistort*t));
  }
  return sumcol / sumw;
}
```

Пять выборок, каждая со своей силой бочки (0, 1/5, 2/5, 3/5, 4/5 от полной) и
своим спектральным весом: первые дают красный конец, последние синий, середина
зелёный. Нормировка на сумму весов - яркость не плывёт. `pow(ret, 1/2.2)` - веса
взяты в гамме, потому что смешивать спектр по-честному в линейном тут не нужно,
нужен «фотографический» вид.

В сцене иглу есть закомментированный дешёвый RGB-сдвиг (три выборки со
смещением `pow(0.08*length(uv-0.5), 2.0)`) - от него отказались в пользу общей
функции с пятью итерациями.

Есть и вторая, закомментированная, версия реза - горизонтальный рез, скорость
которого зависит от скорости прокрутки:

```glsl
// float slope = 0.15 * uProgressVel * aspect * step(0.0, uProgress);
```

Живая версия наклон берёт постоянным (`-0.2 * aspect`), а `uProgressVel` в
шейдер всё равно передаётся.

**Где видно в их коде**

Класс `f3`, смещение ~1091845; кусок `d3` с хроматикой, ~1087553

## 3.3. Открытие карточки проекта: две шкалы прогресса со сдвигом 0.75 секунды

**Что это:** приём · работы примерно день

**Как устроено у них**

Переход от куба к карточке - другой механизм, у него есть свой таймер.

Открытие:

```js
const a = this.centerDetailScene() * 0.5;      // сначала доводим куб в центр экрана

gsap.to(uDetailProgress,  { value:1, ease:"power3.in", delay:a,        duration:1.25 });
gsap.to(uDetailProgress2, { value:1, ease:"sine.out",  delay:a + 0.75, duration:1.25 });
scrollComposers[1].passes[0].scene.detailAnimationIn(a);
this.detailScene.playInAnimation(this.detailIndex, a);
Q.emit("webgl_play_audio","click-project");
gsap.delayedCall(a, () => Q.emit("webgl_play_audio","enter-project"));
await Sc.wait(a + 0.75 + 1.25);                // полная длина
```

Доводка куба в центр сама по себе занимает до 1.5 секунды:

```js
const r = Math.abs(n);                                       // сколько ехать
let a = 0;
if (e > 0) a = ie.ease(ie.fit(r, 0, 0.2, 0.05, 1), "expo.out") * 1.5;
this.centerScroll(this.scroll.y + n, a);
```

`fit(r, 0, 0.2, 0.05, 1)` - если куб уже почти по центру, время 0.05 от полутора
секунд (75 миллисекунд), если далеко - все 1.5. `expo.out` делает так, что даже
маленькое отклонение получает заметное время, а большое не растягивается вдвое.

Значит худший случай открытия: 1.5 (доводка) + 0.75 (сдвиг второй шкалы) + 1.25
= 3.5 секунды, лучший около 0.075 + 0.75 + 1.25 = 2.1 секунды.

Закрытие быстрее и не ждёт доводки:

```js
this.centerDetailScene(0);                    // мгновенная доводка
gsap.to(uDetailProgress,  { value:0, ease:"power2.out", duration:1.25 });
gsap.to(uDetailProgress2, { value:0, ease:"power2.out", duration:0.6 });
this.scrollComposers[1].passes[0].scene.detailAnimationOut();
this.detailScene.playOutAnimation();
Q.emit("webgl_play_audio","leave-project");
await gsap.delayedCall(1, () => { this.isDetailOpen = false; this.enableScroll(); });
```

Зачем две шкалы. `uDetailProgress` - лёд, `uDetailProgress2` - техника:

```glsl
float transition = fit(uDetailProgress, 0.4, 1.0, 0.0, 1.0);   // смена картинки только со второй половины

// техническое смещение по зелёному каналу той же scroll-datatexture
vec2 techDisp = (uvTex - 0.5) * 0.1;
float tTech   = texture(tScroll, techDisp).g * 2.0 - 1.0;
vec2 dispTech = vec2(1.0, 0.0) * tTech * 0.005;                // только по горизонтали, сила 0.005

// ледяное смещение по frost-datatexture, масштаб СЖИМАЕТСЯ по ходу перехода
vec2 uvDisp = (uvTex - 0.5) * 5.0 * (1.0 - uDetailProgress);
float tDisp = texture(tFrost, uvDisp).r * 2.0 - 1.0;
vec2 disp   = vec2(1.0,0.0)*tDisp*0.1 + vec2(0.0,1.0)*tDisp*0.1;  // по обеим осям, сила 0.1

if (transition < 1.0) scene  = chromatic_aberration(tCubes,  vUv + disp*power1In(fit(uDetailProgress,0.1,0.9,0.0,1.0))
                                                                 + dispTech*power4Out(uDetailProgress),
                                                    modulator, power2Out(uDetailProgress)*noise.r).rgb;
if (transition > 0.0) detail = chromatic_aberration(tDetail, vUv + disp*fit(uDetailProgress,0.1,0.9,1.0,0.0)
                                                                 + dispTech*fit(uDetailProgress2,0.7,1.0,1.0,0.0),
                                                    modulator, power2Out(1.0 - uDetailProgress2)*noise.r).rgb;
color = mix(scene, detail, transition);
```

Ледяное смещение вдвадцатеро сильнее технического (0.1 против 0.005) и идёт по
обеим осям, техническое - только по горизонтали. Масштаб выборки льда сжимается
от 5 до 0 (`(1.0 - uDetailProgress)`), поэтому узор льда как будто наезжает на
зрителя. Модулятор здесь мягче, чем на стыке сцен: 8 вместо 12 и порог 0.5
вместо 0.7.

Когда обе шкалы дошли до 1, шейдер уходит на короткую ветку
`color = texture2D(tDetail, vUv).rgb` - ни одной лишней выборки.

Внутри карточки:

```js
playInAnimation(e, t = 0){
  gsap.to(объектыВращение, { value:1, duration:1, delay:t + 1.5, ease:"power1.out" });
  gsap.fromTo(displayUIvar, {value:0}, {value:1, duration:0.7, delay:t + 0.5,
    onComplete:() => { this.mouseSim.reset(); Q.emit("webgl_project_show", e); Q.emit("webgl_play_audio","project-text"); }});
  gsap.fromTo(camera.basePosition, {z:4}, {z:2.5, duration:2, delay:t + 0.5, ease:"inOut1"});
}
playOutAnimation(){
  gsap.to(camera.basePosition, {z:4, duration:0.6, ease:"none"});
  gsap.to(объектыВращение,     {value:0, duration:0.6, ease:"power1.in"});
}
```

Камера наезжает с z=4 до z=2.5 за 2 секунды, объект начинает крутиться только
через 1.5 секунды после начала, тексты появляются через 0.5. Уход втрое быстрее
захода (0.6 против 2).

**Где видно в их коде**

`jF.navigateToSection()` (~1481500), `JF.playInAnimation()` (~1474400)

## 3.4. Пять именных кривых, нарисованных в редакторе, а не выбранных из списка

**Что это:** приём · работы примерно час

**Как устроено у них**

Перед подъёмом рисовальщика регистрируются пять своих кривых GSAP CustomEase
прямо путями SVG:

```js
Ei.create("inOut5",       "M0,0 C0.171,0 0.77,-0.013 0.842,0.272 0.972,0.794 0.972,0.85 1,1");
Ei.create("entry_ease",   "M0,0 C0.358,0 0.336,0.209 0.442,0.519 0.59,0.952 0.768,0.918 1,1", {precision:2});
Ei.create("entry_ease_2", "M0,0 C0.388,0.082 0.924,0.862 1,1", {precision:2});
Ei.create("entry_ease_3", "M0,0 C0.272,0 0.472,0.454 0.496,0.496 0.66,0.79 0.685,1 1,1", {precision:2});
Ei.create("igloo_ease_1", "M0,0 C0.662,0.073 0.047,1 1,1", {precision:2});
```

У `inOut5` вторая контрольная точка уходит в -0.013, то есть кривая слегка
проседает ниже нуля на старте - движение сначала чуть отходит назад. У
`entry_ease` и `entry_ease_3` четыре сегмента: разгон, полка на середине, второй
разгон. Такое из готового набора `power1..4` не собрать.

---

# 4. ЗАГРУЗКА

## 4.1. Что происходит по порядку

**Что это:** приём · работы примерно день

**Как устроено у них**

Полная цепочка от пустой страницы до первого кадра:

1. Браузер тянет `index.html` (1 410 байт) и `assets/index-2eb69c09.js`
   (16 546 байт). Ни одного `<link rel=preload>` на ассеты сцены в разметке нет.
2. Загрузчик вставляет `<style>` (сброс, `--bgColor: #A0A5B1`, два `@font-face`
   IBM Plex Mono), правит `<meta viewport>`, создаёт `div#app`.
3. Показывается загрузчик - Svelte-компонент `div#loader` с одной ASCII-строкой
   (пункт 4.3).
4. Динамическим импортом тянется `assets/App3D-f554a111.js` (1 487 415 байт).
5. Проверка `q.capabilities.webgl2`. Нет - показывается текстовая заглушка и всё
   останавливается.
6. `await Promise.all([LE(), h()])` - на деле это `tick()` Svelte и пустая
   async-функция. Никакого предзагрузчика ассетов здесь нет.
7. Регистрируются пять кривых CustomEase.
8. Считается плотность точек и поднимается рисовальщик:
   ```js
   const u = window.devicePixelRatio <= 2 ? Math.min(window.devicePixelRatio, 1.15)
                                          : Math.min(window.devicePixelRatio, 1.5);
   await he.init({ canvasCnt:o, interactionNode:r, relativePath:a, fingers:2,
                   audioContext:true, contextMenu:false, DPR:u || 1,
                   adaptiveDPR:true, shadowMap:true, shadowMapType:PCFSoftShadowMap });
   ```
9. `const f = new jF; await f.ready;` - здесь и происходит вся загрузка сцен.
10. `f.start()` - включается рендер и роутер.
11. Загрузчик гасится: ASCII за 250 мс, вся плашка за 750 мс, кривая
    `easeInOutCubic`, потом `$destroy`.
12. Роутер срабатывает на текущий адрес, идёт вступительный твин
    `uIntro` 0 -> 1 за 1 секунду с `inOut3`.

Холст лежит в **закрытом теневом корне**, а не в обычном DOM:

```js
const t = document.createElement("div");
t.attachShadow({mode:"closed"}).append(this.renderer.domElement);
this.canvasNode = t;
```

Достать `<canvas>` из консоли нельзя, чужие стили на него не действуют.

**Где видно в их коде**

Хвост `main.js`; функция `sN` в App3D, смещение ~1486285

## 4.2. Прогрева шейдеров нет как отдельного этапа. Он встроен в каждую сцену

**Что это:** приём · работы примерно день

**Как устроено у них**

Базовый класс сцены `Jo` при готовности сам себя прогревает:

```js
this.ready = new Promise(r => { this.isReady = r }).then(() => { this._upload() });

async _upload(){
  this.traverse(t => {
    if (t.material?.isMaterial) {
      // считаем габаритные сферы заранее
      if (t.frustumCulled) { … computeBoundingSphere() … }
      // собираем ВСЕ текстуры со всех униформ и полей материала
      Object.entries(t.material.uniforms).forEach(([o,l]) => { if (l.value?.isTexture && l.value._loaded) this._textures.add(l.value) });
      Object.entries(t.material).forEach(([o,l]) => { if (l?.isTexture && l._loaded) this._textures.add(l) });
      // запоминаем состояние и ВКЛЮЧАЕМ всё насильно
      t.__uploadVars = { cull:t.frustumCulled, visible:t.visible, materialVisible:t.material.visible, … };
      t.frustumCulled = false; t.visible = true; t.material.visible = true;
    }
  });

  const e = [];
  Je.webgl.setRenderTarget(this.customUploadRT || Ax);      // Ax = мишень 2x2, HalfFloat
  e.push(Je.webgl.compileAsync(this, this.camera));
  this._textures.size > 0 && e.push(...Array.from(this._textures).map(t => t._loaded.then(() => Je.webgl.initTexture(t))));
  await Promise.all(e);

  Je.webgl.setRenderTarget(this.customUploadRT || Ax);
  Je.webgl.render(this, this.camera);                       // ОДИН честный кадр в мишень 2x2

  // возвращаем всё как было
  this.traverse(t => { … });
  this._isUploaded();
}
```

Три вещи разом. `compileAsync` компилирует и линкует все программы сцены без
блокировки главного потока. `initTexture` заливает каждую текстуру в GPU. И
последний штрих - один настоящий кадр в мишень 2x2 при насильно включённой
видимости и выключенном отсечении по пирамиде: это добивает всё, что
`compileAsync` мог пропустить (варианты программ под конкретные состояния,
загрузку буферов атрибутов).

Мишень 2x2 не даёт стоимости: рисуется четыре пикселя, но состояния GPU
трогаются все.

Сколько кадров: ровно один на сцену, четыре на весь сайт. Никакого «прогонки N
кадров» нет.

`this.uploaded` ждёт главный контроллер:

```js
await Promise.all([ this.uiScene.uploaded,
                    ...this.scrollComposers.map(e => e.passes[0].scene.uploaded),
                    this.detailComposer.passes[0].scene.uploaded ]);
```

Отдельно прогревается сам полноэкранный треугольник сшивки, и вручную ОБОИМИ
материалами:

```js
this.mainMesh.material = this.material;      he.renderPass.scene._upload();
this.mainMesh.material = this.materialLoad;  he.renderPass.scene._upload();
```

Иначе первый кадр после смены материала дал бы фриз на компиляции.

**Где видно в их коде**

`class Jo extends No`, метод `_upload()`, смещение ~880900

## 4.3. Что показывается пока грузится: одна ASCII-строка на сто ключевых кадров

**Что это:** приём · работы примерно час

**Как устроено у них**

Загрузчик - `div#loader` во весь экран, цвет фона `var(--bgColor)` = `#A0A5B1`
(тот же, что у неба сцены), по центру псевдоэлемент:

```css
.ascii:before {
  position: relative;
  color: #ffffff;
  content: '----------';
  font-size: 17px;
  font-family: monospace;
  font-weight: bold;
  animation-name: head;
  animation-duration: 5s;
  animation-iteration-count: infinite;
  text-shadow: 0px 0px 5px rgba(255,255,255,0.4);
}
@keyframes head {
  0%  {content: '---===+++='}
  1%  {content: '----===+++'}
  2%  {content: '-----===++'}
  …
  100%{content: '===+++===-'}
}
```

Сто одна строка ключевых кадров, каждая - десять знаков из набора `-`, `=`, `+`.
Цикл 5 секунд, то есть 20 смен в секунду, ровно один кадр анимации на 50
миллисекунд. Волна из плотных знаков идёт вправо, зацикливается по кругу.

Ни одного `<img>`, ни SVG, ни спиннера. Стоимость - несколько килобайт CSS в
том же бандле, работает до того, как загрузится хоть один ассет сцены.

Гашение:

```js
o = W(e, J, { duration: 250, easing: G });   // .ascii
c = W(n, J, { duration: 750, easing: G });   // #loader
function G(t){ return t < .5 ? 4*t*t*t : .5*Math.pow(2*t-2,3)+1 }   // easeInOutCubic
function J(t,{delay=0,duration=400,easing=Z}={}){
  const r = +getComputedStyle(t).opacity;
  return { delay, duration, easing, css: i => `opacity: ${i*r}` };
}
```

Строка исчезает первой (250 мс), плашка тремя четвертями секунды позже. За
плашкой в это время уже стоит первый кадр сцены, покрытый цветом `#8b909d`
(материал `p3`), который расходится за 1 секунду. Три оттенка серо-синего -
`#A0A5B1` (плашка), `#8b909d` (вступительная заливка), `#b3bac9` (`uIntroColor`
неба) - подобраны так, чтобы ни на одной из трёх стыковок не было вспышки.

## 4.4. Прогресс загрузки нигде не считается и не показывается

**Что это:** решение · работы ноль

**Как устроено у них**

Полосы или процентов на сайте нет. Более того, в служебной библиотеке есть
готовый предзагрузчик с обратным вызовом прогресса:

```js
preload(i = [], e){
  if (!(i && i.length)) { e?.(1); return Promise.resolve(); }
  const t = [...new Set(i)], s = t.length;
  let n = 0;
  const r = async a => {
    try { const l = await fetch(a); l.ok && await l.blob(); }
    catch(l){ console.warn(`${l} ${a}`); }
    e?.(++n / s);
  };
  return Promise.all(t.map(a => r(a)));
}
```

Поиск по бандлу даёт ноль вызовов `Sc.preload(` в коде приложения (единственное
совпадение `.preload(` - внутренний `dracoLoader.preload()` из three.js).
Значит и списка ассетов на предзагрузку у них нет.

Единственный сигнал готовности - обещание `jF.ready`, которое разрешается, когда
все четыре сцены собраны, скомпилированы и прогреты. Пока оно не разрешилось,
крутится ASCII, и сколько осталось - неизвестно ни пользователю, ни коду.

Ставка тут понятная. Честный процент требует знать вес всех ассетов заранее,
иначе он врёт и стоит на месте. Неопределённая анимация, которая двигается
всегда одинаково, врёт меньше.

## 4.5. Что откладывается: звук грузится уже после того, как загрузчик ушёл

**Что это:** приём · работы примерно час

**Как устроено у них**

```js
async init(){
  this.initGlobalPlane();
  await this.createScenes();          // ждём ВСЕ сцены
  this.audioController = new u3(this); // а звук НЕ ждём
  he.renderPass.scene.beforeRenderCbs.push(() => { this.render() });
  …
  this.isReady();
}
```

Восемнадцать дорожек `.ogg` добавляются одной пачкой в конструкторе `u3` и
никем не ожидаются. К моменту, когда загрузчик уходит, музыка может ещё не
приехать - и это нормально, потому что звук по умолчанию заглушен
(`muted: true`), а фоновые петли стоят на `autoPlay: true` и подхватятся, когда
файл дойдёт.

Всё остальное грузится синхронно с построением сцен и ждётся. Ленивой подгрузки
по мере скролла нет: третья сцена (вход, 5.5 единиц прокрутки, самая тяжёлая)
собирается вместе с первой.

Три сцены строятся ПАРАЛЛЕЛЬНО: конструкторы синхронные, их `init()`
асинхронные, `Promise.all` ждёт все сразу. Загрузка идёт настолько широко,
насколько браузер разрешит соединений.

Пути и загрузчики:

```js
Gw.setPath (`${absolutePath}/assets/geometries/`);   // glTF
hd.setDecoderPath(`${absolutePath}/assets/libs/draco/`);
hd.setPath (`${absolutePath}/assets/geometries/`);   // Draco
Ag.setPath (`${absolutePath}/assets/fonts/`);        // MSDF json
In.setTranscoderPath(`${absolutePath}/assets/libs/basis/`);
In.setPath (`${absolutePath}/assets/images/`);       // KTX2
```

Три пула воркеров: Draco, Basis/KTX2 и MSDF. Ни один не блокирует главный поток.

---

# 5. МОБИЛЬНОЕ ПОВЕДЕНИЕ

## 5.1. Определение слабого устройства ЕСТЬ в коде, но не используется ни разу

**Что это:** решение · работы ноль

**Как устроено у них**

В бандле лежит полный UAParser, и глобальный объект `q` заполняется:

```js
device: "desktop",                         // становится "mobile" | "tablet" по UAInfo.device.type
os:     { name, fullVersion, version },    // mac | ios | windows | android | linux
browser:{ name, fullVersion, version },    // chrome | firefox | safari | edge | opera | ie | facebook
oldIphone: false,
capabilities: {
  webgl2:         ND.isWebGL2Available(),
  touch:          "ontouchstart" in window || navigator.maxTouchPoints > 0 || navigator.msMaxTouchPoints > 0,
  offscreenCanvas:!!HTMLCanvasElement.prototype.transferControlToOffscreen,
  imageBitmap:    true,
  …
}
```

Есть даже отдельное правило для iPad, притворяющегося маком, и для старого
iPhone:

```js
this.os.name === "mac" && this.capabilities.touch && (this.device = "tablet", this.os.name = "ios");
this.device === "mobile" && this.os.name === "ios" && window.devicePixelRatio < 3 && (this.oldIphone = true);
```

И вот итог: поиск по бандлу даёт **ноль** чтений `q.device` и **ноль** чтений
`q.oldIphone` в коде приложения. Оба поля вычисляются и не используются.

Реально из этого блока работают три вещи:

- `q.capabilities.webgl2` - без него сайт не запускается вообще
- `q.capabilities.imageBitmap` глушится на старых движках, и загрузчик текстур
  идёт другой веткой:
  ```js
  (browser.name === "safari" && browser.version < 17.5) ||
  (browser.name === "firefox" && browser.version < 100) ||
  (os.name === "ios" && browser.name !== "safari")
    && (this.capabilities.imageBitmap = false);
  ```
- на `<html>` вешаются классы языка, устройства, ОС и браузера (для CSS, который
  ими не пользуется)
- задержка обработки resize: **500 мс на iOS, 50 мс везде**
  (`Sc.debounce(..., ec ? 500 : 50)`), потому что iOS шлёт resize пачками при
  показе и скрытии адресной строки

Никакой ступени качества, никакого урезания частиц, никакого понижения
разрешения по типу устройства.

**Где видно в их коде**

Класс `_m`/`uu`, смещение ~1094000 (объявление) и весь блок разбора UA

## 5.2. Единственная настоящая адаптация - плотность точек, и она по КАДРАМ, а не по железу

**Что это:** приём · работы примерно час

**Как устроено у них**

Подробно разобрано в первом документе (пункт 13). Коротко, чтобы держать числа в
одном месте:

Старт: `dpr <= 2 ? min(dpr, 1.15) : min(dpr, 1.5)`. Обычный монитор и ретина -
1.15, телефон с плотностью 3 - 1.5.

Дальше класс `UU` крутит множитель по средней частоте кадров: прогрев 2 с, окно
не меньше 4 с и не меньше 5 замеров, порог понижения 30 кадров, порог повышения
60, шаг 0.1, диапазон 0.6..1.0, после 4 смен направления слой выключается
насовсем с предупреждением в консоль.

Худший случай `1.15 * 0.6 = 0.69`, лучший 1.5.

То есть слабое устройство определяется по факту, а паспорт железа никто не
спрашивает: тянет - рисуем полно, не тянет - опускаем плотность. Телефон с
хорошим чипом получает 1.5, ноутбук с плохой видеокартой опустится до 0.69.

## 5.3. Слово mobile на сайте означает ширину экрана, а не устройство

**Что это:** приём · работы примерно полдня

**Как устроено у них**

Конфиг:

```js
const Be = {
  gridSize: 125, gridSizeLow: 50, gridSizeMobile: 25,   // боковое поле UI
  topMargin: 90, topMarginLow: 45, topMarginMobile: 25, // верхнее поле UI
  breakpointW: 1600, breakpointH: 800, breakPointMobile: 640,
  …
};
```

Разбор:

```js
this.small  = q.screen.width < Be.breakpointW     || q.screen.height < Be.breakpointH;      // < 1600 или < 800
this.mobile = q.screen.width < Be.breakPointMobile || q.screen.height < Be.breakPointMobile; // < 640
this.meshMarginLeft = this.mobile ? 25 : this.small ? 50 : 125;
this.meshMarginTop  = this.mobile ? 25 : this.small ? 45 : 90;
```

Заметьте `||`, а не `&&`: ноутбук 1440x900 уже `small`, а любое окно ниже 640
пикселей по высоте (например ландшафтный телефон) считается `mobile`. Это
чистая раскладка, к железу отношения не имеет.

Что меняется по этим трём ступеням:

| Элемент | mobile (<640) | small (<1600 / <800) | обычный |
|---|---|---|---|
| боковое поле UI | 25 | 50 | 125 |
| верхнее поле UI | 25 | 45 | 90 |
| ширина логотипа | 140 | 160 | 200 |
| ширина кнопки закрытия | 85 | 95 | 120 |
| ширина кнопки visit | 150 | 180 | 220 |
| кегль текста карточки | 18 | 18 | 24 |
| нижний отступ кнопки | 80 | 20 | 20 |

Плюс два правила, работающие вообще без порогов:

```js
// кегль подписей: опорная высота окна 1300 пикселей, потолок 0.8
this.text.scale.setScalar(Math.min(0.8, 0.5 / (q.screen.h / 1300)));
this.mesh.material.uniforms.uSize.value = Math.min(0.1, 0.08 / (q.screen.h / 1300));

// масштаб сцены кубов по пропорции кадра
this.camera.zoom = Math.min(1, q.screen.aspectRatio * 1.25);

// ширина колонки текста
this.width = Math.min(q.screen.width - 40, 500);
```

`Math.min(1, aspectRatio * 1.25)` - на мониторе 16:9 (1.78) получается 1, на
телефоне 9:19.5 (0.46) получается 0.577, то есть камера отъезжает почти вдвое.
Одна строка вместо отдельной раскладки под телефон.

Ширина плашки со стрелками тоже переключается по ориентации:
`q.screen.w < q.screen.h ? … : …`.

## 5.4. Касания: два пальца, перетаскивание вместо колеса, ускорение 1.25

**Что это:** приём · работы примерно час

**Как устроено у них**

```js
await he.init({ …, fingers: 2, … });
```

Два пальца - и их видят все системы взаимодействия (`finger: 0` по умолчанию,
жидкость в карточке подписывается на `touch_start` / `touch_move` по каждому
пальцу).

Прокрутка пальцем:

```js
onTouchDrag(e){
  if (this.scrollBlocked) return;
  this.stopAutoCenter();
  this.scroll.targetY2 += e.delta11.y * 1.25;
}
```

`delta11` - смещение в нормированных координатах -1..1, помноженное на 1.25.
Колесо идёт через `e.delta.y * this.scrollMultiplier` (75e-5, пиксели), то есть
у пальца и колеса разные единицы и разные множители, подобранные отдельно.

Внутри карточки палец листает текст один к одному (`e.delta.y`, без множителя).

Ещё одна мелочь, ради тач-устройств:

```js
e === U(qi,as).TOUCH_END && (this.hovering && $t.get(this._finger).currentInput === "touch" && this._performHover());
```

На отпускании пальца наведение принудительно снимается, но только если ввод был
касанием. На мыши после клика наведение остаётся, как и положено.

`contextMenu: false` - долгое нажатие не вызывает меню браузера.

## 5.5. Чего НЕТ на телефоне: ничего. Сцена одна и та же

**Что это:** решение · работы ноль

**Как устроено у них**

Проверено по бандлу: число частиц не зависит ни от чего
(`r = 1e4` для мелких частиц карточки, 150 000 для главной системы - константы),
размеры мишеней считаются от разрешения холста (`resolution / 5` для жидкости,
512x512 для инея - константа), число проходов поста одинаковое, LUT те же,
хроматика те же пять итераций, отражения кубов те же.

Единственное, что реально уменьшается на слабом устройстве, - разрешение самого
холста, через плотность точек. И это делается по замеру частоты кадров, а не по
догадке.

Позиция понятная: содержимое остаётся полным, страдает только чёткость. Обратный
подход (резать объекты) даёт то, что пользователь описывает словами «в какой-то
момент всё пропадает».

---

# 6. ПОСТ-ОБРАБОТКА, ЧЕГО НЕТ В ПЕРВОМ РАЗБОРЕ

## 6.1. Полный порядок проходов: два уровня композеров, а не один

**Что это:** приём · работы примерно день

**Как устроено у них**

В первом документе сказано «весь пост это три прохода». Точнее так: композеров
пять, и они в двух уровнях.

**Нижний уровень.** Свой композер (`tA`) на каждую сцену:

```
[RenderPass сцены] -> [EffectPass с LUT этой сцены] -> readBuffer
```

LUT добавляется в композер СВОЕЙ сцены:

```js
async function A3(i, e){ const t = new Eg(new m3); t.isIglooColorCorrectionPass = !0; e.addPass(t); await t.material.uniforms.tLUT.value._loaded }
async function O3(i, e){ const t = new Eg(new N3);                                    e.addPass(t); await t.material.uniforms.tLUT.value._loaded }
// вызов: A3(this, this.composer) в renderOptions() сцены
```

У сцены иглу свой LUT `igloo/igloo_scene.ktx2`, у сцены кубов свой
`cubes/cube_scene.ktx2`. Оба 32x32x32, полуплавающие, 14 484 и 41 384 байта.
Разные сцены получают разный грейд, и стык между ними уже сшивается по
готовым цветам.

**Верхний уровень.** Один общий композер `he.composer`:

```
[RenderPass со сшивающим треугольником f3] -> [Bloom] -> [RenderPass UI-сцены, clear=false] -> [SMAA/гамма]
```

Порядок держится хитростью в `addPass`:

```js
addPass(e){
  super.addPass(e);
  e.scene?.camera && (e.scene.composer = this);
  this.passes.sort((s,n) => {
    const r = [s,n].map(a => a.isGammaCorrectionPass ? 1 : 0);
    return r[0] - r[1];
  });
}
```

Сортировка стабильная, и единственный проход с флагом `isGammaCorrectionPass`
(это SMAA) всегда уезжает в конец, куда бы его ни добавили. Bloom вешается
лениво из `renderOptions()` любой сцены, которая построилась первой, под
однократным флагом:

```js
const e = q.devScene ? this.composer : he.composer;
e.__hasBloomPass || (e.__hasBloomPass = !0, e.addPass(new Fd().addBloom({ debug:q.devScene, levels:6, luminanceThreshold:0.2, intensity:1, radius:0.85 })));
```

Итого на кадр: 1 или 2 нижних композера (RenderPass + LUT каждый), плюс верхний
(треугольник сшивки, Bloom, UI, SMAA). При открытой карточке нижние заменяются
одним композером карточки.

**Важно про UI.** Интерфейс рисуется ПОСЛЕ Bloom и с `clear = false`. Значит
логотип, кнопки и подписи не светятся и не участвуют в ореоле, а SMAA их всё
равно сглаживает. Ортографическая камера UI-сцены ставится по пикселям:

```js
this.camera.basePosition.set(q.screen.w * 0.5, -q.screen.h * 0.5, this.camera.basePosition.z);
```

**Где видно в их коде**

`AE = function(){ this.composer = new tA({renderToScreen:!0}); … }`, смещение
~1034000; `tA.addPass` с сортировкой, ~1027124

## 6.2. Разрешения промежуточных мишеней

**Что это:** справка

**Как устроено у них**

Все числа в одном месте:

| Мишень | Размер | Тип | Где |
|---|---|---|---|
| композер сцены (rt1/rt2) | полное разрешение x DPR | `HalfFloatType` | каждый из 5 композеров, по 2 штуки |
| мишень прозрачности кубов | полное разрешение x DPR | `HalfFloatType`, `generateMipmaps:true`, `samples:0` | сцена кубов |
| иней на кубе | 512 x 512 | `HalfFloatType`, без глубины | по 2 на каждый куб (пинг-понг) |
| жидкость в карточке | разрешение / 5 | `HalfFloatType`, без глубины | 2 штуки (пинг-понг) |
| прогревочная мишень | 2 x 2 | `HalfFloatType` | одна на всё приложение |
| Bloom | mipmapBlur, 6 уровней | внутри postprocessing | верхний композер |

Мишени композера создаются с `minFilter: LinearFilter, magFilter: LinearFilter`,
`generateMipmaps: false`, без буфера глубины (глубина заказывается отдельным
флагом и на боевом сайте не заказана ни разу).

Рисовальщик поднят так:

```js
new WebGLRenderer({ alpha:false, antialias:false, stencil:false, depth:false })
```

Глубины у самого холста нет вообще: сцены рисуют в свои мишени, а на экран идёт
только полноэкранный треугольник.

Три штуки на 0.5 миллисекунды каждая, но их три:

```js
const c3 = new l3();   // геометрия полноэкранного ТРЕУГОЛЬНИКА, не квадрата
this.setAttribute("position", new nt([-1,3,0, -1,-1,0, 3,-1,0], 3));
this.setAttribute("uv",       new nt([0,2, 0,0, 2,0], 2));
```

Треугольник вместо двух треугольников квадрата: нет диагонального шва, на 30
процентов меньше вызовов фрагментного шейдера на границе блоков GPU.

## 6.3. Зерна нет. Оно написано и закомментировано

**Что это:** решение

**Как устроено у них**

В проходе цветокоррекции сцены иглу лежит готовое зерно, выключенное:

```glsl
vec3 hash32(vec2 p) {
    vec3 p3 = fract(vec3(p.xyx) * vec3(.1031, .1030, .0973));
    p3 += dot(p3, p3.yxz + 33.33);
    return fract((p3.xxy + p3.yzz) * p3.zyx);
}
…
// film grain
// vec3 noise = hash32(uv * 1000.0 + time);
// noise *= 2.0;
// noise -= 1.0;
// sceneColor += noise * 0.05;
```

Сила 0.05, масштаб 1000, сдвиг по времени. Функция `hash32` осталась в обоих
проходах цветокоррекции и не вызывается ни разу.

Вместо зерна работает **синий шум**, и он стоит в трёх местах и с другой целью -
против полос, а не для фактуры:

```glsl
vec4 noise = getNoise(tBlue, gl_FragCoord.xy, uBlueOffset);
color += noise.rgb * 0.05;                    // фон сцены кубов
// и как аргумент искажения хроматики на стыке сцен
```

Текстура `noises/blue-8-128-rgb.ktx2`, читается один к одному по пикселю:

```glsl
vec4 getNoise(sampler2D tex, vec2 uv, vec2 offset){
  float invSize = 1.0 / float(textureSize(tex, 0).x);
  return texture(tex, uv * invSize + offset);
}
```

Смещение перебрасывается каждый кадр (`Math.random()*10`, `Math.random()*12.5`),
поэтому шум не залипает узором.

Разница по смыслу. Зерно - это фактура, её видно и она добавляет плотности.
Синий шум силой 0.05 на кадр глазу не виден, он только ломает ступеньки
градиента. Здесь выбрали второе.

## 6.4. Виньетки нет. Есть диагональное затемнение и оно выключено по умолчанию

**Что это:** приём · работы примерно час

**Как устроено у них**

Радиальной виньетки в бандле нет ни одной. Вместо неё в проходе LUT сцены иглу:

```glsl
vec3 scene = texture2D(tDiffuse, uv).rgb;
float gradient = mix(0.8, 1.0, (uv.x + uv.y) * 0.5);
gradient = mix(1.0, gradient, uGradientAlpha);
scene *= gradient;
vec3 sceneColor = apply3DLUTTetrahedral(scene.rgb, tLUT, uLUTSize, uLUTIntensity);
```

Это тот же диагональный градиент, что у неба и тумана (первый документ, пункты 2
и 3), только применённый к кадру: левый нижний угол темнее на 20 процентов,
правый верхний не трогается. `uGradientAlpha` стартует в 0, то есть по умолчанию
затемнения нет, оно включается твином на нужных участках.

Затемнение стоит ДО LUT. Значит LUT видит уже затемнённый пиксель и красит его
по своей таблице, а не после неё. Тени в углу уходят по кривой таблицы, а не в
серый.

В сцене кубов даже этого нет - там проход LUT состоит из одной строки применения
таблицы.

**Где видно в их коде**

Классы `m3` (иглу, ~1103125) и `N3` (кубы, ~1201269)

## 6.5. Экспозиция: её нет ни в каком виде, всё решает таблица

**Что это:** решение

**Как устроено у них**

Собрано в одно место:

- `toneMapping = NoToneMapping` (`dr = 0`), приложение его не трогает
- `toneMappingExposure` остаётся 1, ни одного присваивания в бандле
- никакого измерения средней яркости кадра, никакой автоэкспозиции, никаких
  мипмап-пирамид для замера
- никакого `uExposure` в шейдерах приложения

Вместо экспозиции - три вещи:

1. **3D LUT 32x32x32 на сцену.** Тетраэдральная интерполяция, четыре выборки
   вместо восьми у трилинейной:
   ```glsl
   vec3 apply3DLUTTetrahedral(vec3 color, sampler3D lutTexture, float lutSize, float lutIntensity){
     float scale = lutSize - 1.0;
     float texelSize = 1.0 / lutSize;
     vec3 col = LUTLinearTosRGB(color);           // в гамму
     vec3 rgb = clamp(col, 0.0, 1.0) * scale;
     vec3 p = floor(rgb), f = rgb - p;
     vec3 v1 = (p + 0.5) * texelSize, v4 = (p + 1.5) * texelSize;
     … выбор тетраэдра по порядку f.r, f.g, f.b …
     vec4 weights = vec4(1.0 - frac.x, frac.x - frac.y, frac.y - frac.z, frac.z);
     vec4 result  = weights * mat4(…);
     return LUTsRGBToLinear(mix(col, result.rgb, lutIntensity));
   }
   ```
   Обратите внимание на порядок: линейное в гамму, таблица применяется в ГАММЕ,
   потом обратно в линейное. Таблицы из DaVinci и Lightroom так и построены.
   Размер таблицы читается из самой текстуры после загрузки:
   `this.uniforms.uLUTSize.value = e.image.width`.
2. **Ручное зажатие в конце каждого материала.** У кубов:
   `outgoingLight = clamp(outgoingLight, vec3(0.0), vec3(1.0))`. На стыке сцен:
   `color = clamp(mix(scene1, scene2, cut), vec3(0.0), vec3(1.0))`.
3. **Порог Bloom 0.2.** Именно он и работает как «экспозиция света»: всё, что
   ярче 0.2, начинает светиться. В сцене входа порог опущен в 0
   (`luminanceThreshold: 0`) - светится всё, отсюда мягкий туманный вход.

Мишени при этом полуплавающие, то есть значения выше 1 в них живут до самого
LUT. Зажатие стоит в конце, а не в начале.

## 6.6. Стекло кубов: два полных прохода сцены на кадр

**Что это:** приём · работы примерно день

**Как устроено у них**

В первом документе (пункт 5) сказано, что фон для преломления подставляется
статичной картинкой. Точнее так: проходов два, и статичная картинка работает
только в первом.

```js
// ПРОХОД 1: собираем то, что будет видно СКВОЗЬ стекло
this.cubes.forEach(r => {
  r.mesh.material.side = BackSide;
  r.mesh.material.needsUpdate = true;
  r.mesh.material.uniforms.tTransmissionSamplerMap.value = this._bgTex;    // cubes/bg.png, 1 803 байта
  r.mesh.material.uniforms.uTransmissionSamplerSize.value.set(4, 4);       // ЧЕТЫРЕ на четыре
  r.mesh3.visible = true; r.mesh2.visible = false; r.plexus.group.visible = false;
});
this.textsGroup.visible = false; this.blurrytext.mesh.visible = false; this.backgroundshapes.mesh.visible = false;

const t = renderer.getRenderTarget();
renderer.setRenderTarget(this._transmissionRT);
renderer.clear(true, true, true);
renderer.render(this, this.camera);
renderer.setRenderTarget(t);

// ПРОХОД 2: обычный, но стекло теперь читает результат первого
this.cubes.forEach(r => {
  r.mesh.material.side = FrontSide;
  r.mesh.material.needsUpdate = true;
  r.mesh.material.uniforms.tTransmissionSamplerMap.value = this._transmissionRT.texture;
  r.mesh.material.uniforms.uTransmissionSamplerSize.value.set(this._transmissionRT.width, this._transmissionRT.height);
  r.mesh3.visible = false; r.mesh2.visible = true; r.plexus.group.visible = true;
});
this.textsGroup.visible = true; this.blurrytext.mesh.visible = true; this.backgroundshapes.mesh.visible = true;
```

Заявленный размер сэмплера 4x4 в первом проходе - это подмена: three.js по нему
считает уровень мипмапы, и картинка 1803 байта читается как полностью
размытая заливка. Стекло на задней стороне получает ровный цвет вместо мусора.

Мишень `_transmissionRT` создана 2x2 и раздувается до полного разрешения в
`resize()`:

```js
this._transmissionRT.setSize(he.uniforms.resolution.value.x, he.uniforms.resolution.value.y);
// создание: new WebGLRenderTarget(2, 2, { generateMipmaps:true, type:HalfFloatType, minFilter:LinearMipmapLinearFilter, samples:0 })
```

`generateMipmaps: true` и `minFilter` с мипмапами - вот откуда шероховатое
преломление: чем больше `roughness`, тем выше уровень мипмапы читает стекло.

Что скрывается в первом проходе: тексты, размытый фоновый текст, фоновые фигуры,
сетка узлов, внутренний объект (`mesh2`) - и вместо него показывается `mesh3`.
То есть сквозь стекло видно упрощённую версию мира без интерфейса. Это и
дешевле, и правильнее: подписи не должны преломляться.

Цена: полный лишний проход сцены в полном разрешении каждый кадр, пока сцена
кубов видна.

**Где видно в их коде**

`aF.update()`, смещение ~1307250

## 6.7. Один UBO на всё, и он же несёт время и отношение шага кадра

**Что это:** приём · работы примерно полдня

**Как устроено у них**

Первый документ упоминает единый UBO (пункт 14). Что в нём лежит:

```glsl
uniform Global {
  vec2  resolution;    // разрешение холста с учётом плотности точек
  vec2  resolutionUI;  // разрешение в CSS-пикселях, БЕЗ плотности
  float aspect;
  float time;
  float dtRatio;       // отношение реального шага кадра к 1/60
};
```

Два разрешения - это ключ ко всей раскладке. Постобработка и шейдеры работают в
`resolution`, интерфейс и тексты - в `resolutionUI`. При смене плотности точек
интерфейс не прыгает.

Обновляется он двумя строками на кадр:

```js
_i.time.value    = i;
_i.dtRatio.value = ie.deltaRatio();
// и при resize:
_i.resolution.value.set(i, e).multiplyScalar(this.currentDPR).floor();
_i.aspect.value      = _i.resolution.value.x / _i.resolution.value.y;
_i.resolutionUI.value.set(i, e);
```

`dtRatio` в шейдерах нужен для того же, для чего `lerpFPS` и `frictionFPS` в
коде: чтобы движение не зависело от частоты кадров.

---

# Что забираем в Rocket VPN

Ниже - только то, что реально применимо к нашему коду, с конкретными числами и
местами.

## 1. Приборные подписи актов - MSDF вместо спрайтов и канваса

Сейчас: подписи в `rv-act-exit.js` - `T.Sprite` из заранее нарисованных
материалов двух размеров (`512/168` и `320/108`, `scale 11.2 x 3.7`), небо и
пыль - `CanvasTexture`. Каждая новая подпись требует нового растра.

Забираем: один MSDF-атлас на кириллицу и один воркер сборки строк. Числа под
копирование:

- атлас 512x1024, `distanceRange: 4`, кегль 42, сетка 8 столбцов x 13 строк,
  ячейка 64x64 (у нас глифов больше из-за кириллицы, значит либо 512x2048, либо
  кегль 32 и ячейка 48)
- две текстуры на шрифт: json метрик (~24 КБ) и ktx2 атласа (~110 КБ) - это
  дешевле, чем один `CanvasTexture` 1024x512
- функция msdf дословно:
  ```glsl
  float median(sampler2D tMap, vec2 uv){
    vec3 tex = texture2D(tMap, uv).rgb;
    return max(min(tex.r,tex.g), min(max(tex.r,tex.g), tex.b)) - 0.5;
  }
  float msdf(sampler2D tMap, vec2 uv){
    float d = fwidth(median(tMap, uv));
    return smoothstep(-d, d, median(tMap, uv));
  }
  ```
  Одна выборка, `fwidth` берёт на себя всю работу по чёткости на любом
  расстоянии. Подпись на станции будет читаться и вплотную, и с полусотни единиц.

Работы: два дня на пайплайн (msdf-atlas-gen на кириллицу, воркер, класс текста),
плюс полдня на перевод существующих подписей.

## 2. Появление текста через перебор глифов - забрать целиком

Наш `rv-fill.js` и акты показывают текст сменой непрозрачности. Забираем шейдер
дословно, он не зависит ни от чего:

```glsl
float tr1 = falloff(textWeights.x, 0.0, 1.0, 0.1, clamp(uShow1, 0.0, 1.0));
float tr2 = falloff(textWeights.x, 0.0, 1.0, 1.0, clamp(uShow2, 0.0, 1.0));
vUv.x = mod(uv.x + КОЛОНКА * mod(floor((1.0 - tr2) * 5.753), СТОЛБЦОВ), 1.0);
vAlpha = tr1;
```

Где `КОЛОНКА = 1/СТОЛБЦОВ` сетки атласа. Числа: `uShow1` за 0.4 с с полем 0.1,
`uShow2` за 0.75 с с полем 1.0, гашение `uShow1` за 0.2 с. Кривая `none`
(линейная) - у них везде так, и правильно: поле `falloff` само даёт нелинейность.

Для Rocket VPN это прямо в тему: техничный перебор знаков читается как загрузка
канала, а не как декоративная анимация.

Работы: полдня после пункта 1.

## 3. Иней от курсора - под щит рубки и линзу прокола

Приём переносится один в один на любой предмет со вторым набором UV:

- мишень 512x512 `HalfFloatType`, без буфера глубины, пинг-понг из двух
- шаг не чаще раза в 0.015 с
- распространение через `max` четырёх соседей, шаг `1/512`
- затухание 0.985 за шаг (половина за ~0.7 с)
- клякса вдоль ОТРЕЗКА от прошлой позиции к текущей, радиус
  `0.05 * smoothstep(0.1, 1.0, скорость)`
- второй канал `rim = nextVal - prevVal`, он и даёт светящуюся кромку
- в материал: `roughness *= 1 - frost`, `normalScale *= 1 - frost`,
  `emissive += rim * ЦВЕТ` и `emissive += сетка * rim * 10.0`
- предохранители: пауза > 0.15 с или скачок > 0.3 сбрасывают историю
- сглаживание скорости: `+= d*6`, `*= 0.88`, зажать 0..1, потом
  `lerp(v, ease(target,"power4.out"), 0.1)`

У нас есть ровно то место, где это выстрелит: щит рубки в `rv-act-shell.js` и
линза прокола в `rv-act-dock.js`. Сейчас они статичные. Множитель 10 на кромке
даёт бирюзовую бегущую линию под наш `БИРЮЗА`.

Работы: два дня.

## 4. Отклик по расстоянию с двойным лерпом - вместо луча

Сейчас у нас один `Raycaster` на весь сайт (`rv-act-exit.js:849`). Для отклика
станции на курсор луч не нужен:

```js
плоскость.setPlaneFromCameraTargetAndDistance(РАССТОЯНИЕ);
const точка = плоскость.getPointPositionOnPlane(курсор11);
мышь.lerp(точка, lerpCoefFPS(0.05));

// на каждый узел:
const сила = fit(smoothstep(БЛИЗКО, ДАЛЕКО, узел.centroid.distanceTo(мышь)), 0, 1, 0.5 + 0.3*фаза, 0);
цель2 = lerpFPS(цель2, сила,  0.05);
знач  = lerpFPS(знач,  цель2, 0.05);
```

Числа у них: радиус 1..3 единицы, амплитуда 0.5 ± 0.3, коэффициенты 0.05 и 0.06.
Двойной лерп - это и есть вся инерция, пружинный решатель не нужен.

Один `unproject` на кадр против обхода восьмидесяти тысяч треугольников. У нас
станция под 80 тысяч вершин, разница будет заметна сразу.

Работы: день.

## 5. Сшивка актов ледяным разрезом - под наши перегоны

Сейчас переходы между актами в `rv-motion.js` идут камерой и мягкой ступенькой.
Забираем механику разреза как ОТДЕЛЬНЫЙ слой поверх:

- одна текстура 1024x1024 RGBA, три канала: R - маска разлома, G - техническое
  смещение, B - искривление линии
- три ширины поля от одной линии: **0.2** сам рез, **0.9** смещение, **2.0**
  хроматика. Это главное число всего приёма: хроматика в десять раз шире реза,
  поэтому переход чувствуется, а не видится
- параллакс кадров: уходящий уезжает на **0.4** экрана по `power2In`, приходящий
  приезжает по той же кривой навстречу
- смещение по технической маске **0.025**
- модулятор хроматики **12.0** с затуханием `smoothstep(1.0, 0.7, |uv*2-1|)` по
  обеим осям
- синий шум в аргумент искажения, смещение перебрасывать каждый кадр
- `if (cut < 1.0)` и `if (cut > 0.0)` вокруг выборок - половину кадра одна из
  сцен не читается

Хроматику берём их функцией целиком, 5 итераций, бочка `coord + cc*dot(cc,cc)*amt`,
спектральные веса в гамме.

Работы: два дня, включая рисование текстуры разлома.

## 6. Загрузчик: ASCII вместо процентов

Сейчас в `frame.html` загрузчика нет вовсе. Забираем их подход:

- плашка во весь экран цветом фона сцены
- одна строка моноширинного текста, десять знаков, `@keyframes` по `content` на
  сто ключевых кадров, цикл 5 секунд (20 смен в секунду)
- никакого процента: честный процент требует знать вес всех ассетов, а неточный
  врёт заметнее, чем неопределённая анимация
- гашение: строка за 250 мс, плашка за 750 мс, `easeInOutCubic`
- три оттенка на стыках (плашка -> вступительная заливка -> небо), подобранные
  так, чтобы не было вспышки. У них `#A0A5B1` -> `#8b909d` -> `#b3bac9`. У нас
  под тёмную тему: фон плашки под `--bgColor` тёмной темы, заливка на пол-шага
  светлее, небо своё.

Работы: полдня.

## 7. Прогрев шейдеров - забрать метод целиком

Это самое дешёвое из всего списка и самое заметное на слабых машинах. Наш
`rv-world.js` собирает акты в свободном промежутке, и первый кадр каждого акта
даёт фриз на компиляции.

Метод дословно:

```js
// 1. запомнить и насильно включить всё
traverse(o => { o.__save = {cull:o.frustumCulled, vis:o.visible, mvis:o.material.visible};
                o.frustumCulled = false; o.visible = true; o.material.visible = true; });
// 2. собрать все загруженные текстуры со всех униформ И полей материала
// 3. compileAsync(scene, camera) + initTexture на каждую текстуру
// 4. ОДИН настоящий render в мишень 2x2 HalfFloat
// 5. вернуть всё как было
```

Мишень 2x2 - четыре пикселя, но все состояния GPU трогаются. Один кадр на акт,
восемь на весь сайт. Мишень создаётся один раз и переиспользуется, у неё
переопределены `setSize` и `dispose` в пустые функции, чтобы её никто не сломал.

Работы: полдня. Отдача: пропадают рывки на входе в каждый акт.

## 8. Плотность точек - заменить статичную ступень на адаптивную

Сейчас у нас (`rv-world.js:82-95`) ступень ставится ОДИН РАЗ при подъёме:

```js
var пам = navigator.deviceMemory || 8;
var ядер = navigator.hardwareConcurrency || 4;
var узко = Math.min(innerWidth, innerHeight) < 520;
if (пам <= 2 || ядер <= 2) return 0;
if (пам <= 4 || ядер <= 4 || узко) return 1;
return 2;
// плотность: 1.0 / 1.35 / 1.8
```

Проблема известная: `deviceMemory` не отдаёт Safari вообще, `hardwareConcurrency`
на телефонах врёт (восемь ядер, из которых четыре энергоэффективные), и
телефон с хорошим чипом получает ступень 1 ни за что.

Забираем их слой поверх нашего, НЕ ломая ступень (ступень пусть решает
геометрию и число частиц, как сейчас, это правильно):

- стартовая плотность оставить нашу (1.0 / 1.35 / 1.8), но добавить их правило
  для плотных экранов: `dpr <= 2 ? min(dpr, потолок) : min(dpr, потолок * 1.3)`
- поверх - множитель по средней частоте кадров: прогрев **2 с**, окно **4 с** и
  не меньше **5 замеров**, порог понижения **30**, порог повышения **60**, шаг
  **0.1**, диапазон **0.6..1.0**
- после **4** смен направления подряд слой выключить совсем с предупреждением

Худший случай на ступени 2: `1.8 * 0.6 = 1.08`. Худший на ступени 0:
`1.0 * 0.6 = 0.6`. Это ровно тот запас, которого нам не хватает на слабых
Андроидах, где сейчас ступень 1 всё равно не тянет.

Работы: час.

## 9. Виньетку не делать радиальной, делать диагональной

У нас в `rv-real.js` плёнка. Если будем добавлять затемнение краёв, забираем их
форму:

```glsl
float gradient = mix(0.8, 1.0, (uv.x + uv.y) * 0.5);
gradient = mix(1.0, gradient, uGradientAlpha);
scene *= gradient;                       // ДО таблицы грейда, не после
```

Два соображения. Диагональ согласована с диагональным градиентом неба и тумана
(первый документ, пункты 2 и 3) - виньетка не спорит с направлением света.
И применять её ДО грейда, чтобы затемнённые углы уходили по кривой таблицы, а
не в мёртвый серый.

Сила 0.8 (двадцать процентов), `uGradientAlpha` стартует в нуле и поднимается
твином только там, где нужно.

Работы: час.

## 10. Зерно - не добавлять. Добавить синий шум

У igloo зерно написано и отключено, а работает синий шум силой **0.05**,
читаемый один к одному по пикселю, со смещением, перебрасываемым каждый кадр:

```glsl
vec4 getNoise(sampler2D tex, vec2 uv, vec2 offset){
  float invSize = 1.0 / float(textureSize(tex, 0).x);
  return texture(tex, uv * invSize + offset);
}
// каждый кадр: uBlueOffset.set(Math.random()*10, Math.random()*12.5)
```

У нас градиенты неба и тумана - главный источник полос, особенно на тёмной теме,
где диапазон узкий. Синий шум 0.05 их убирает, и его не видно. Зерно на техничном
сайте про канал связи выглядит чужеродно.

Работы: час (текстура синего шума 128x128 RGB лежит в открытом доступе, или
генерируется скриптом).

## 11. Полноэкранный треугольник вместо квадрата

Мелочь на пять минут, которую стоит внести везде, где у нас `PlaneGeometry(2,2)`
под пост:

```js
setAttribute("position", new BufferAttribute([-1,3,0, -1,-1,0, 3,-1,0], 3));
setAttribute("uv",       new BufferAttribute([0,2, 0,0, 2,0], 2));
```

Нет диагонального шва, меньше вызовов фрагментного шейдера на границе. У них так
сделано во всех проходах поста.

## 12. Два разрешения в UBO

Забираем разделение:

```glsl
uniform Global {
  vec2 resolution;    // холст с учётом плотности точек - для шейдеров и поста
  vec2 resolutionUI;  // CSS-пиксели без плотности - для текста и интерфейса
  float aspect, time, dtRatio;
};
```

Как только мы включим адаптивную плотность (пункт 8), интерфейс, считающий
размеры от `resolution`, начнёт прыгать при каждом изменении множителя.
Разделение на два поля закрывает это заранее.

Плюс опорная высота окна для кегля - у них 1300:

```js
scale = Math.min(ПОТОЛОК, БАЗА / (screen.h / 1300));
```

## Сводка чисел к переносу

| Что | Значение |
|---|---|
| Атлас MSDF | 512x1024, distanceRange 4, кегль 42, сетка 8x13, ячейка 64 |
| Перебор глифов | шаг `1/столбцов`, множитель 5.753, по модулю числа столбцов |
| Появление текста | uShow1 0.4 с поле 0.1 · uShow2 0.75 с поле 1.0 · гашение 0.2 с |
| Выноска подписи | два колена, прогресс 0.2 с, деление 0.5/0.5 |
| Кегль от окна | `min(0.8, 0.5/(h/1300))` |
| Иней: мишень | 512x512 HalfFloat, шаг не чаще 0.015 с |
| Иней: затухание | 0.985 за шаг · радиус `0.05*smoothstep(0.1,1,v)` · кромка x10 |
| Иней: скорость | `+= d*6`, `*=0.88`, зажать 0..1, `lerp(…, power4.out, 0.1)` |
| Отклик по расстоянию | smoothstep(1, 3), амплитуда 0.5 ± 0.3, двойной лерп 0.05 и 0.06 |
| Сетка узлов | 5 точек, 2 связи, радиус 2, вход 0.1 с, выход 0.06 с, одна смена за кадр |
| Разрез сцен | поля 0.2 / 0.9 / 2.0 · параллакс 0.4 · смещение 0.025 · модулятор 12 |
| Хроматика | 5 итераций, бочка `cc*dot(cc,cc)*amt`, веса в гамме |
| Карточка проекта | лёд 0.1 по двум осям · техника 0.005 по одной · модулятор 8 |
| Открытие карточки | доводка до 1.5 с · шкала1 1.25 с power3.in · шкала2 +0.75 с sine.out |
| Закрытие карточки | шкала1 1.25 с · шкала2 0.6 с · обе power2.out |
| Загрузчик | 100 ключевых кадров, цикл 5 с, гашение 250 и 750 мс, easeInOutCubic |
| Прогрев | compileAsync + initTexture + ОДИН кадр в мишень 2x2 |
| Плотность точек | старт `dpr<=2 ? min(dpr,1.15) : min(dpr,1.5)` |
| Адаптивная плотность | прогрев 2 с, окно 4 с, 5 замеров, 30/60, шаг 0.1, 0.6..1.0, лимит 4 |
| Пороги раскладки | 1600 / 800 / 640, поля 125-50-25 и 90-45-25 |
| Синий шум | сила 0.05, один к одному по пикселю, смещение каждый кадр |
| Виньетка | диагональ `mix(0.8, 1.0, (uv.x+uv.y)*0.5)`, ДО таблицы грейда |
| Bloom | 6 уровней, порог 0.2 (в тумане 0), сила 1, радиус 0.85 |
| Debounce resize | 500 мс на iOS, 50 мс везде |
