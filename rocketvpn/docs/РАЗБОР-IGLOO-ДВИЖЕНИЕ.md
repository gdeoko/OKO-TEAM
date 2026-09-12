# Разбор igloo.inc: движение и частицы

Второй заход в тот же боевой бандл (`/tmp/ig/app3d.js`, 1.49 МБ, минифицированный
`App3D-f554a111.js`). Первый разбор (`РАЗБОР-IGLOO.md`) снял с них РЕНДЕР: свет,
туман, каустику, LUT, блум, дизеринг. Здесь снято ДВИЖЕНИЕ: прокрутка, камера,
тоннель, частицы, звук. Пересечений с первым файлом нет.

Все числа взяты дословно из кода. Где число не нашлось, так и написано.
Их модели, текстуры, объёмы и музыка сюда не входят, это чужая работа.

Ключевые классы бандла, чтобы можно было сверяться:
`jF` главный контроллер прокрутки · `F3` сцена иглу · `aF` сцена кубов ·
`UF` сцена входа (тоннель) · `SF` тоннель · `cF` кольца · `lF` материал колец ·
`wF` объёмные частицы · `u3` звук.

---

## 1. Скорость и шаг прокрутки

### Сколько скролла на сцену

Мира три, они идут по кругу без конца: `ty={igloo:F3, cubes:aF, entry:UF}`,
композер под каждый, склейка по остатку от деления. Единица прокрутки у них
это ОДИН ЭКРАН, а не пиксель.

| сцена | `height` | ход прогресса `height+1` | колесо, px | щелчков колеса |
|---|---|---|---|---|
| иглу (`F3`) | 2.35 | 3.35 | 4 467 | 45 |
| кубы (`aF`) | 3 (число проектов) | 4 | 5 333 | 53 |
| вход, тоннель (`UF`) | 5.5 | 6.5 | 8 667 | 87 |
| **весь круг** | **10.85** | | **14 467** | **145** |

Пересчёт колеса в единицы:

```js
this.scrollMultiplier = 75e-5;                  // 0.00075 единицы на пиксель deltaY
onScroll(e){ this.scroll.targetY2 += e.delta.y * this.scrollMultiplier }
onKeyDown(e){ ... += 150 * this.scrollMultiplier }   // 0.1125 единицы на нажатие
onTouchDrag(e){ ... += e.delta11.y * 1.25 }          // свайп во весь экран = 1.25 экрана
```

Один экран = `1 / 0.00075` = **1333 px** колеса. Щелчок колеса в Chrome даёт
100 px, значит **13.3 щелчка на экран**. Высота кубов равна числу проектов
(`this.height = this.options.cubes.length`), три штуки: добавили проект, лента
удлинилась сама.

Firefox с `deltaMode === 1` умножается на 33 (`te(Fl, ap, 33)`), это единственная
поправка на браузер. Сырое колесо копится в `position`, наружу отдаётся разница
между кадрами, и своя скорость колеса гаснет трением 0.97.

### Сглаживание: ДВЕ подтяжки плюс поводок

```js
const e = this.scroll.y;
this.scroll.targetY1 = ie.lerpFPSLimited(this.scroll.targetY1, this.scroll.targetY2, .075, 100*this.scrollMultiplier);
this.scroll.y        = ie.lerpFPS(this.scroll.y, this.scroll.targetY1, .15);
const t = 750 * this.scrollMultiplier;
this.scroll.targetY2 = ie.clamp(this.scroll.targetY2, this.scroll.y - t, this.scroll.y + t);
if (Math.abs(this.scroll.y - this.scroll.targetY2) < .1*this.scrollMultiplier) {
  this.scroll.y = this.scroll.targetY2; this.scroll.targetY1 = this.scroll.targetY2;
}
```

Разбор чисел.

- **Первая подтяжка 0.075** от `targetY2` к `targetY1`. Постоянная времени
  `-1/(60*ln(1-0.075))` = **0.214 с**.
- **Вторая подтяжка 0.15** от `targetY1` к `y`. Постоянная времени **0.103 с**.
  Две подтяжки подряд дают s-образный ход с нулевой производной на старте:
  прокрутка трогается с места, а не выскакивает.
- **Ограничение скорости** стоит на ПЕРВОЙ подтяжке четвёртым доводом
  `lerpFPSLimited`: не больше `100*0.00075 = 0.075` экрана за кадр при 60 Гц,
  то есть **4.5 экрана в секунду**, или 6000 px колеса в секунду. Быстрее
  прокрутить нельзя физически.
- **Поводок ±0.5625 экрана** (`750*0.00075`): цель не может уехать от текущего
  положения дальше, чем на 750 px колеса. Накрутил десять оборотов подряд, лента
  всё равно доедет и встанет, а не будет ещё пять секунд догонять.
- **Порог схлопывания 7.5e-5** экрана (0.1 px колеса): у ленты есть точный
  конец, экспонента не звенит бесконечно.

```js
lerpCoefFPS(i){ return this.damp(i, Fe.ratio) }
damp(i,e){ return 1 - Math.exp(Math.log(1-i)*e) }
lerpFPSLimited(i,e,t,s=1/0){ const n=this.lerpFPS(i,e,t), r=s*Fe.ratio; return i + this.clamp(n-i,-r,r) }
frictionFPS(i){ return Math.exp(Math.log(i)*Fe.ratio) }
```

`Fe.ratio = Math.min(5, delta_ms / (1000/60))` - доля кадра при 60 Гц, ЗАЖАТАЯ
СВЕРХУ ПЯТЁРКОЙ. Это защита от возврата из фона: между двумя кадрами прошло
десять секунд, а подтяжка отработает максимум как пять кадров подряд.

### Скорость как отдельная величина

```js
this.scroll.velocity += Math.abs(this.scroll.y - e) * 1;
this.scroll.velocity *= ie.frictionFPS(.98);          // постоянная времени 0.825 с
this.scroll.velocity  = ie.clamp(this.scroll.velocity, 0, 1);
if (Math.abs(this.scroll.velocity) < .001) this.scroll.velocity = 0;
```

Скорость зажата в 0..1 и живёт почти секунду после остановки. Её едят два места:
переход между сценами (`uProgressVel`) и **поле зрения камеры в сцене кубов**
(раздел 2).

### Снап к сценам: есть, и он трёхэтажный

Снап включается через **1.4 секунды** после последнего изменения цели:

```js
if (this.autoCenter.needed && !this.autoCenter.animating && Fe.time - this.autoCenter.lastTime > 1.4) { ... }
```

Дальше две ветки.

**Между сценами** (когда на экране два мира сразу, `c % 1 !== 0`): перебираются
четыре пары «верх/низ сцены против верха/низа экрана», берётся наименьший сдвиг,
и лента едет туда твином gsap. База длительности **2 секунды**, ease `inOut3`
(своя кривая `M0,0 C0.6,0 0,1 1,1`). Поверх ставится доводка на «правильное
место» сцены:

```js
const M = 1/(C.height+1);
const _ = ((w===o ? 1-C.finalScrollAutocenter : C.initialScrollAutocenter) - M) * (C.height+1);
y += _*Math.sign(v);  S += _*2;
```

Точки прицела у сцен:

| сцена | `initialScrollAutocenter` | `finalScrollAutocenter` |
|---|---|---|
| иглу | 0.495 | 0.495 |
| кубы | нет полей | нет полей |
| вход | 0.2 | 0.76 |

**Внутри сцены** снап отдан самой сцене методом `autoCenter`. У иглу его НЕТ,
там ничего не подтягивается. У остальных:

```js
// кубы: к ближайшему проекту (centeredProgress = 0.25 / 0.5 / 0.75)
const r = n*(this.height+1);
const a = ie.clamp(Math.abs(r)*6, 1.6, 2.4);      // длительность 1.6 .. 2.4 с
e.centerScroll(e.scroll.y + r, a);

// вход: к 0.76, но только после четверти пути
if (this.progress > .15) {
  const s = (this.finalScrollAutocenter - this.progress)*(this.height+1);
  const n = ie.clamp(Math.abs(s)*4, 2, 20);       // длительность 2 .. 20 с
  e.centerScroll(e.scroll.y + s, n);
}
```

Двадцатисекундный потолок у входа не описка: если человек бросил прокрутку в
начале тоннеля, лента сама медленно доводит его до комнаты внизу.

Любое касание колеса, стрелки или пальца снимает снап на месте
(`stopAutoCenter` вызывает `re.killTweensOf(this.scroll)`), поэтому перебить его
можно в любой кадр.

### Как считается прогресс сцены

```js
const s = this.scroll.y % this.scroll.total;
const n = this.scroll.y >= 0 ? s : this.scroll.total - Math.abs(s);
const r = n + 1, a = r % this.scroll.total;
// для каждой сцены:
const S = A.__bottom - A.__top;              // = A.height
A.progress = (y - A.__top) / (S + 1);        // y = r для верхней сцены, a для нижней
```

Экран это отрезок длиной ровно 1. Прогресс идёт от 0 до 1 за `height+1` единиц
хода: сцена держит кадр `height` экранов и ещё по половине экрана уходит на
въезд и выезд. Переменная `c = a - A.__top` это доля второй сцены на экране, она
же `uProgress` в шейдере склейки.

---

## 2. Ход камеры

### Одна камера на всё

Перспективная, по умолчанию **fov 45, near 0.1, far 1000**, базовая позиция
`(0,0,6)`. Спрайнов, `CatmullRomCurve3` и `CubicBezierCurve3` в коде движения
НЕТ ни одного: `CatmullRom` в бандле встречается только внутри загрузчика кривых
three.js. Камера ходит по **ключевым кадрам gsap**, а timeline прокручивается
прогрессом сцены:

```js
update(){ this.timeline.progress(this.progress); ... }
```

`lookAt` каждый кадр тоже не вызывается. Кватернион пересчитывается только когда
что-то реально изменилось:

```js
(!this.position.equals(this._prevPosition) || !this.target.equals(this._prevTarget) || !this.up.equals(this._prevUp))
  && (this.quaternion.setFromRotationMatrix(GD.lookAt(this.position, this.target, this.up)))
```

### Поле зрения по сценам

| сцена | fov | меняется |
|---|---|---|
| иглу | 30 | нет |
| кубы | 45 | **да, от скорости прокрутки**: `fov = 45 - 5*Math.abs(scroll.velocity)` → 40..45 |
| вход, тоннель | 25 базовое | **да, по timeline**: `set fov 22` в нуле, `to fov 30` за 7.2 с, `power1.inOut` |
| деталь проекта | 45 | нет |

Приём с кубами стоит отдельного внимания: чем быстрее человек крутит, тем УЖЕ
угол, кадр поджимается и скорость читается сильнее.

Плюс зум под пропорции экрана, чтобы на телефоне кадр не разъезжался:

```js
// иглу
this.camera.zoom = Math.min(1, q.screen.aspectRatio * 1.25);
// вход
this.camera.zoom = Math.min(1, q.screen.aspectRatio * 1.5);
```

### Ключевые кадры сцены иглу (timeline на 21 виртуальную секунду)

```js
this.timelinePosition.set(-13.25, 2.5, 13.25);
this.timelineTarget.set(0, 1, 0);
this.timeline.fromTo(this.timelinePosition, {y: 2.5+9}, {y: 2.5,  duration:14, ease:"power2.out"}, 0);
this.timeline.fromTo(this.timelineTarget,   {y: 1+14},  {y: 1,    duration:14, ease:"power2.out"}, 0);
this.timeline.fromTo(this.timelinePosition, {x:-13.25, z:13.25},
                                            {x:-15.25, z:23.25,   duration:14, ease:"power1.inOut"}, 7);
```

Читается так: камера падает с высоты 11.5 на 2.5 (девять единиц) за первые две
трети прогресса, точка взгляда падает с 15 на 1 (четырнадцать единиц) синхронно,
и с середины прогресса камера отъезжает на 10 единиц назад по Z и на 2 влево.
Взгляд падает быстрее камеры, поэтому в начале это вид сверху, к концу почти
горизонт.

Вступление подмешано отдельным весом, а не отдельной камерой:

```js
this.camera.basePosition.lerpVectors(this.introPosition, this.timelinePosition, this.introWeight.value);
this.camera.baseTarget.lerpVectors(this.introTarget, this.timelineTarget, this.introWeight.value);
// introPosition (-14, 21, 14), introTarget (0, 0.5, 0), introWeight 0→1 за 5.5 с, ease inOut1
```

### Ключевые кадры сцены входа (timeline на 9.2 виртуальные секунды)

```js
this.timelinePosition.set(0, 1.5, -2);  this.timelineTarget.set(0, -2.5, -1);
tl.to(pos,  {z:0, x:0,   duration:2.5, ease:"power2.out"},    0);
tl.to(tgt,  {z:0, x:0,   duration:2.5, ease:"power2.out"},    0);
tl.to(pos,  {y:-9.83,    duration:7,   ease:"entry_ease_3"},  0.2);
tl.to(tgt,  {y:-10,      duration:3,   ease:"power1.inOut"},  0.2);
tl.to(tgt,  {y:-9.81,    duration:2.5, ease:"power1.inOut"},  3.2);
tl.to(add,  {upRotation:Math.PI, duration:5.25, ease:"power3.inOut"}, 1);
tl.to(add,  {upOriginal:1,       duration:3.7,  ease:"entry_ease"},   3.5);
tl.to(pos,  {z:-1.5,     duration:3.7, ease:"entry_ease"},    3.5);
tl.to(pos,  {z:-3,       duration:2,   ease:"entry_ease_2"},  7.2);
tl.to(tgt,  {y:-10.35,   duration:2,   ease:"power2.in"},     7.2);
tl.set(this.camera, {fov:22}, 0);
tl.to(this.camera,  {fov:30, duration:7.2, ease:"power1.inOut"}, 0);
```

Самое интересное здесь **разворот вектора верха камеры**, это и есть ощущение
падения через кольца:

```js
this.camera.baseUp.set(0, 0, -1);
this.camera.baseUp.applyAxisAngle(new b(0,1,0), this.timelineAdditional.upRotation);   // 0 → PI
this.camera.baseUp.lerp(new b(0,1,0), this.timelineAdditional.upOriginal).normalize(); // 0 → 1
```

Верх начинается как `(0,0,-1)` (то есть камера смотрит строго вниз и «верхом»
для неё служит горизонтальная ось), крутится на 180 градусов вокруг Y за 5.25 с,
и параллельно тянется к нормальному `(0,1,0)` за 3.7 с. Кадр проворачивается на
пол-оборота, пока камера падает, и к посадке встаёт ровно.

Свои кривые (CustomEase, SVG-пути):

```js
Ei.create("inOut1",      "M0,0 C0.5,0 0.1,1 1,1");
Ei.create("inOut2",      "M0,0 C0.56,0 0,1 1,1");
Ei.create("inOut3",      "M0,0 C0.6,0 0,1 1,1");
Ei.create("inOut4",      "M0,0 C0.4,0 -0.06,1 1,1");
Ei.create("inOut5",      "M0,0 C0.171,0 0.77,-0.013 0.842,0.272 0.972,0.794 0.972,0.85 1,1");
Ei.create("entry_ease",  "M0,0 C0.358,0 0.336,0.209 0.442,0.519 0.59,0.952 0.768,0.918 1,1");
Ei.create("entry_ease_2","M0,0 C0.388,0.082 0.924,0.862 1,1");
Ei.create("entry_ease_3","M0,0 C0.272,0 0.472,0.454 0.496,0.496 0.66,0.79 0.685,1 1,1");
Ei.create("igloo_ease_1","M0,0 C0.662,0.073 0.047,1 1,1");
```

`entry_ease_3` (падение в тоннель) имеет полку ровно посередине: около 0.5 кривая
идёт почти линейно, а разгон и торможение вынесены по краям. Это не стандартная
`inOut`, а специально выточенное падение с ровным серединным ходом.

Умолчания gsap на весь сайт: `ease "power2.inOut"`, `duration 0.6`,
`overwrite "auto"`.

### Параллакс от курсора

Курсор в нормали -1..1 переводится в УГОЛ, максимум которого 90 градусов,
умноженный на коэффициент сцены:

```js
const Ch = Math.PI * 0.5;
r = ie.fit(position11.x, -1, 1, -Ch, Ch) * this.touchAmount;   // горизонталь
a = ie.fit(position11.y, 1, -1, -Ch, Ch) * this.touchAmount;   // вертикаль
this._additionalSphericalPosition.theta = ie.lerpFPS(theta, r*this.displacement.position.x, this.lerpPosition*n);
```

| сцена | `displacement.position` | предел угла | `lerpPosition` / `lerpTarget` / `lerpRotation` |
|---|---|---|---|
| иглу | (0.07, 0.025) | ±6.3° / ±2.25° | 0.035 / 0.035 / 0.035 (умолчание) |
| кубы | (0.10, 0.05) | ±9.0° / ±4.5° | 0.035 / 0.035 / 0.035 |
| вход | (0.07, 0.025) | ±6.3° / ±2.25° | **0.02 / 0.015 / 0.02** |
| деталь | (0, 0) | нет | 0.02 |

Во входе к этому по timeline подмешивается ещё и смещение ТОЧКИ ВЗГЛЯДА
(`displacementTar` до -0.03, -0.01 за 2 с с 4-й секунды) и крен
(`displacementRot` до 0.05), причём крен считается по СКОРОСТИ курсора:

```js
this._additionalRotationUp = ie.lerpFPS(this._additionalRotationUp,
  $t.get(0).velocity.x * this.displacement.rotation * this.touchAmount, this.lerpRotation*n);
```

На пальце параллакс глушится: если ввод «touch» и палец отпущен, вход обнуляется,
а коэффициент подтяжки делится пополам (`n = 0.5`).

### Тряска: есть, шесть синусов, в РАДИАНАХ

```js
const o = Of.sineNoise1(12.23, 3.44, -3.234 + Fe.time*this.shakeSpeed.x) * this.shake.x * this.touchAmount;
const l = Of.sineNoise1(-2.45, 4.789, 7.343 + Fe.time*this.shakeSpeed.y) * this.shake.y * this.touchAmount;
Kn.applyAxisAngle(Gr, phi + l).applyAxisAngle(Qf, theta + o);
```

`sineNoise1` это тот же шум из шести синусов, что и в шейдерах (см. приём 17
первого разбора), только на JS: шесть `Math.sin(dot(p, частоты))`, делённые на 6,
диапазон -1..1.

| сцена | `shake` (радианы) | в градусах | `shakeSpeed` |
|---|---|---|---|
| иглу | 0.01 | 0.57° | 0.5 |
| кубы | 0.02 | 1.15° | 0.1 |
| вход | 0.02 | 1.15° | 0.25 |
| деталь проекта | 0.05 | 2.86° | 0.05 |

Тряска приложена к НАПРАВЛЕНИЮ ВЗГЛЯДА, а не к позиции: камера не дёргается в
пространстве, у неё плывёт прицел. Оси X и Y с разными фазами и одинаковой
скоростью, ось Z (крен) отдельно.

### Переход между сценами

Никакого затемнения. Обе сцены рисуются в свои мишени, и полноэкранный
треугольник смешивает их шейдером по «ледяному разрезу»:

```glsl
float slope = -0.2 * aspect;
float inclination = mix(1.0 - vUv.x + slopeDisp, vUv.x + slopeDisp, step(slope, 0.0));
float incProgress = fit(uProgress, 0.0, 1.0, 0.0, 1.0 + abs(slope));
float cutDiagonalBlur         = falloff(vUv.y + inclination*abs(slope), 0.0, 1.0, 2.0, incProgress);
float cutDiagonalDisplacement = falloff(vUv.y + inclination*abs(slope), 0.0, 1.0, 0.9, incProgress);
float cutDiagonal             = falloff(vUv.y + inclination*abs(slope), 0.0, 1.0, 0.2, incProgress);
float cutDisp = falloff(scrollTex.g, 0.0, 1.0, 1.0, cutDiagonalDisplacement);
float cut     = falloff(scrollTex.r, 0.0, 1.0, 2.0, cutDiagonal);

const float parallaxY = 0.4;
const float displacement = 0.025;
float modulator = 12.0 * smoothstep(1.0,0.7,abs(vUv.x*2.0-1.0)) * smoothstep(1.0,0.7,abs(vUv.y*2.0-1.0));
if (cut < 1.0) scene1 = chromatic_aberration(tScene1, vUv - vec2(0.0, parallaxY*power2In(uProgress) + displacement*cutDisp), modulator, cutDiagonalBlur*noise.r).rgb;
if (cut > 0.0) scene2 = chromatic_aberration(tScene2, vUv + vec2(0.0, parallaxY*power2In(1.0-uProgress) + displacement*(1.0-cutDisp)), modulator, (1.0-cutDiagonalBlur)*noise.g).rgb;
color = clamp(mix(scene1, scene2, cut), vec3(0.0), vec3(1.0));
```

Числа: наклон разреза 0.2 от ширины кадра, параллакс уходящей сцены 0.4 экрана,
смещение по разрезу 0.025, хроматика 5 итераций с силой 12 в центре, кромка
разреза берётся из текстуры `scroll-datatexture.ktx2` (красный канал даёт форму
льдинок, зелёный смещение), поверх сыпется синий шум `blue-8-128-rgb.ktx2` со
случайным покадровым сдвигом, чтобы швы хроматики не читались. Две выборки
экономятся условиями `if (cut < 1.0)` и `if (cut > 0.0)`: в чистых зонах читается
только одна сцена.

---

## 3. Тоннель

### Геометрия

```js
const t = new Md(1.3, 1.3, 9, 64, 32, !0);   // CylinderGeometry(r, r, height, radial, height, openEnded)
t.translate(0, -9*.5, 0);
t.scale(-1, 1, 1);                            // вывернуть наизнанку
this.mesh.position.y = 1;
```

**Один цилиндр радиусом 1.3, длиной 9, на 64 сегмента по кругу и 32 по высоте,
без крышек, вывернутый наизнанку.** Никаких колец из повторяющихся кусков. После
сдвигов труба стоит от y = -8 до y = +1.

### Куда и с какой скоростью летит камера

Камера падает **вниз по Y**: с 1.5 до **-9.83**, то есть 11.33 единицы. Это
происходит на отрезке timeline 0.2..7.2 из 9.2, значит по прогрессу сцены
0.022..0.783.

Пересчёт в прокрутку: 0.76 прогресса × 6.5 единиц хода = **4.94 экрана**
= 6 587 px колеса = 66 щелчков. Выходит **581 px колеса на одну мировую единицу
падения**. Кривая `entry_ease_3` с полкой посередине: середина падения идёт почти
линейно, разгон и торможение по краям.

Тоннель виден пока `progress < 0.52` и крутится вместе с креном камеры:

```js
update(){ const e = this.scene.timelineAdditional.upRotation * .65; this.mesh.rotation.y = e }
```

Коэффициент 0.65 против единицы у камеры: труба проворачивается медленнее кадра,
и от этого читается, что крутится именно камера, а не мир.

### Шейдер стенки

```glsl
vec2 uv = vUv * vec2(1.0, 0.25);
uv.x += uv.y;                       // диагональный сдвиг развёртки
float t = time * 0.05;
float value  = texture2D(tWind, uv*3.0 + vec2(-t, t*0.7)).r;
value       *= texture2D(tWind, uv*4.0 + vec2(-t, t*0.7)).r;
value       *= texture2D(tWind, uv*6.0 + vec2(-t, t*0.7)).r;
float fade = smoothstep(0.0, 0.2, vUv.y) * smoothstep(1.0, 0.9, vUv.y);
value *= fade;
float alpha = pow(value, 3.0) * 3.0;
vec3 color = vec3(0.85, 0.9, 1.0);
```

Три выборки одной `wind_noise.ktx2` (256×256) на масштабах **3, 4, 6**,
перемноженные, потом куб альфы и умножение на 3. Аддитивное сложение,
`renderOrder = 1`. Ни одной своей текстуры под тоннель, весь эффект из шума ветра,
который уже лежит в памяти под дым и позёмку.

### Кольца-проломы (shattered_ring)

Три кольца из ДВУХ чередующихся моделей:

```js
const e = [{name:"shattered_ring2", geometry: await zt.load("shattered_ring2.drc")},
           {name:"shattered_ring",  geometry: await zt.load("shattered_ring.drc")}];
const t = 3, s = 2.5;  let n = 1.65;
for (let r = 0; r < t; r++) {
  const a = e[r % e.length];
  this[`mesh${r}`] = new Ce(a.geometry, new lF);
  ...uniforms.tMap  = le.load(`${a.name}_color.ktx2`, "srgb-repeat");
  ...uniforms.tGlow = le.load(`${a.name}_ao.ktx2`,    "srgb-repeat");
  this[`mesh${r}`].position.y = -n;
  this[`mesh${r}`].rotation.x = -3.14159*.5;    // положить плашмя
  n += s;                                        // -1.65, -4.15, -6.65
}
update(){ const e = this.scene.timelineAdditional.upRotation*.4; this.meshes.forEach(t => t.rotation.z = e) }
```

Кольца лежат на y = **-1.65, -4.15, -6.65** с шагом **2.5**, повёрнуты плашмя,
крутятся вместе с креном камеры с коэффициентом **0.4**.

### Как кольцо разлетается: всё от РАССТОЯНИЯ ДО КАМЕРЫ

Ни одного твина, вся механика в вершинном шейдере `lF`. У каждого осколка есть
атрибуты `centr` (центроид) и `rand` (три случайных числа).

```glsl
float dist = distance(cameraPosition, translation);

vFalloff = falloffsmooth(dist, 14.0, 2.0, 13.0, 0.75);
float glowFalloff = 1.0 - smoothstep(0.2, 0.4, 1.0 - vFalloff);

// поворот осколка вокруг своей случайной оси
vec3 scaledCentr = centr * 0.3;
vec3 axis = normalize(rand*2.0 - 1.0);
float angle = 0.5*smoothstep(1.5, 12.0, -vPos.z) + firstRingMask*camFactor*0.5;
pos -= scaledCentr;  pos = rotate3D(pos, axis, angle);  pos += scaledCentr;

// разлёт по центроиду
pos += centr * glowFalloff * mix(0.075, 0.15, rand.z);
// дыхание разлёта
pos += rand.y * centr * glowFalloff * sin(rand.x*5.0 + time*0.5 + (centr.x+centr.y+centr.z)*15.0) * 0.05;
// добавка при подъезде камеры
pos += centr * camFactor * 0.15 * firstRingMask;

// закрутка кольца целиком
float spinFalloff  = falloffsmooth(dist,  8.0, 2.0, 5.0, 0.5);
float spinFalloff2 = falloffsmooth(dist, 10.0, 2.0, 8.0, 0.5);
pos.xz = rotate(pos.xz, spinFalloff*3.14159*0.3);
pos.xy = rotate(pos.xy, spinFalloff2*3.14159*0.3 + translation.y*0.25 + 1.5);

// проявление
vFade = min(1.0, falloffsmooth(dist, 2.0, 16.0, 9.0, 0.5));
```

Числа читаются так:

- **Разлёт**: от 0.075 до 0.15 своего центроида, то есть осколок отъезжает на
  7.5-15 процентов расстояния от центра кольца. Разброс задан `rand.z`, поэтому
  куски расходятся неровно.
- **Дыхание**: ещё до 5 процентов, синусом с частотой 0.5 по времени и фазой от
  положения куска. Кольцо не стоит замороженным.
- **Поворот куска**: до 0.5 радиана (28.6°) при подлёте камеры, плюс столько же
  у первого кольца при въезде сцены.
- **Закрутка кольца**: до `PI*0.3` = 54° по двум плоскостям, с разными окнами по
  расстоянию (5-8 и 8-10 единиц). Кольцо начинает крутиться раньше, чем
  разлетается.
- **Проявление**: `falloffsmooth(dist, 2, 16, 9, 0.5)`, кольцо всплывает из фона
  на расстоянии около 16 единиц. В пикселе оно подмешивается к тому же экранному
  диагональному градиенту, что и небо (приём 3 первого разбора):
  `color = mix(bg, color, vFade * 0.95)`, где `bg = mix(uColor1, uColor2, diagonalGradient) * 1.1`.
  Кольцо не «включается», оно проступает из воздуха.
- Свечение: `color += texture2D(tGlow, vUv).r * vec3(0.5,0.7,1.0) * n1 * glowFalloff * 0.8 * camFactor`,
  тот же синий `(0.5, 0.7, 1.0)`, что и во всей сцене.

### Что летит рядом с кольцами

| слой | класс | модель/геометрия | y | окна видимости по прогрессу |
|---|---|---|---|---|
| кольцо | `cF` | `shattered_ring2/.drc` | -1.65, -4.15, -6.65 | <0.34 · <0.43 · <0.52 |
| силовое поле кольца | `bF` | Plane 1×1, scale 0.65 | -1.5, -4.0, -6.5 | 0.10-0.34 · 0.25-0.43 · 0.36-0.52 |
| плазма | `MF` | `shattered_ring_smoke.drc` | -1.6, -4.1, -6.6 | 0.06-0.34 · 0.25-0.43 · 0.35-0.52 |
| дымный след | `EF` | `smoke_trail.drc` | -1.6, -4.1, -6.6 | 0-0.37 · 0-0.47 · 0-0.56 |
| сама труба | `SF` | Cylinder 1.3×9 | +1 | <0.52 |
| снег в трубе | `CF` | 200 точек | 0 | <0.52 |
| кольцо комнаты | `oF` | Plane 1×1, scale 0.57 | -10.26 | >0.53 |

Все проявляются и гаснут ПЕРЕКЛЮЧЕНИЕМ `visible` в `onUpdate` таймлайна, а мягкость
даёт шейдер по расстоянию до камеры. Ни одного `opacity`-твина на кольцах.

Плазма и дым разложены по фазе: `initialRotation = a*3.14*2*0.25`, то есть каждый
следующий развёрнут на 90 градусов. Одна модель, три разных вида.

Альфы дописаны степенями: плазма `pow(value*1.7, 4)`, дым `pow(value*2.75, 3)`,
поземка у пола `pow(value*3, 3) + pow(screenUv.x, 2)*fade*0.15`.

### Комната внизу

Появляется тремя объектами на последней трети:

```js
tl.set(this.floor.mesh, {visible:!0}, 3.4);
tl.fromTo(this.floor.mesh.material.uniforms.uAlpha, {value:0}, {value:1, duration:5, ease:"power2.out"}, 3.4);
tl.set(this.textcylinder.mesh, {visible:!0}, 4.5);      // цилиндр с текстом
tl.set(this.forcefield.mesh,   {visible:!0}, 4);        // Cylinder(1,1,3,64,6), y -10.13, scale 0.28
tl.set(this.groundsmoke.mesh,  {visible:!0}, 3.4);      // y -10.17, scale (5, 0.1, 5)
tl.set(this.ceilingsmoke.mesh, {visible:!0}, 4.5);
tl.set(this.ambientparticles.mesh, {visible:!0}, 3.4);  // 60 точек
```

---

## 4. Частицы

Главное открытие: **точки на поверхности меша они НЕ берут**. `MeshSurfaceSampler`
в бандле отсутствует, `scatter` и `dissolve` как приёмы тоже. Форму задаёт
**трёхмерная текстура знакового расстояния (SDF из VDB)**, а частицы просто
притягиваются к её нулевому уровню.

### Главная система: 150 000 точек, GPGPU, объём вместо меша

```js
class wF {
  constructor(e){
    this.cubeSize = .65;
    this.particles = 150*1e3;              // 150 000
    this.fluidSim = new $U({borders:!1, simRes:128, dyeRes:128, curlStrength:0,
      splatRadius:.22, splatForce:35, pressureIterations:2,
      densityDissipation:.88, velocityDissipation:.98, pressureDissipation:.86,
      splatRadiusVelocity:!1, renderEvent:!1});
    this.vdbs = [];
    this.vdbScales = Be.links.map(t => t.scale);
  }
}
```

**Чем рисуются.** `THREE.Points` (в фабрике `gE` при `geometry === "points"`
берётся `Fn` = Points, иначе `OA` = InstancedMesh). Одна частица это ОДИН
`gl_Point`, никакой геометрии у неё нет.

**Сколько.** 150 000 штук. Состояние лежит в двух float-мишенях
`388 × 388` (`getTextureSizeParticles(150000)` = `ceil(sqrt(150000)/4)*4` = 388,
то есть 150 544 текселя): в первой позиция + затенение, во второй скорость +
сглаженный модуль скорости.

**Откуда берётся форма.** Три объёма, испечённые из VDB в KTX2 и загруженные
режимом `"3d-data"`:

```js
links: [
  {title:"LinkedIn",    url:"...", vdb:"peachesbody_64", scale:1.2},   // тело пингвина
  {title:"X / Twitter", url:"...", vdb:"x_64",           scale:1.3},   // знак X
  {title:"Medium",      url:"...", vdb:"medium_32",      scale:1.25}   // буква M
]
```

Разрешение зашито в имя: **64³, 64³ и 32³**. Файлы лежат в `assets/volumes/`.
В шейдере читается один `sampler3D`:

```glsl
vec3 samplePos = rotMatrix * (currentPos.xyz / uCubeSize) * uVolumeScale + 0.5;
vec4 volData = texture(tVolume, samplePos);
vec3 grad = normalize(volData.rgb*2.0 - 1.0) * rotMatrix;   // направление к поверхности
float dist = (volData.a*2.0 - 1.0) * 2.0;                    // знаковое расстояние
```

То есть RGB это ГРАДИЕНТ (куда толкать), альфа это знаковое расстояние (внутри
или снаружи и насколько далеко). 64³ объёма RGBA хватает на форму, к которой
липнет 150 тысяч точек.

**Стартовые позиции.** Ровный случай внутри куба стороной 0.65:

```js
for (let l = 0; l < this.particles; l++) {
  s[l*4+0] = ie.fit(Math.random(), 0, 1, -this.cubeSize*.5, this.cubeSize*.5);
  s[l*4+1] = ...; s[l*4+2] = ...; s[l*4+3] = Math.random();
}
```

Третья копия того же массива хранится как `tOrig`: точка помнит своё «домашнее»
случайное место и всегда тянется обратно.

**Силы за кадр** (всё умножено на `dtRatio`, зажатый пятёркой):

```glsl
// 1. толчок от симуляции жидкости под курсором
float pushForce = 0.0005;
currentVel.xyz += disp * pushForce * dtRatio * uInteractForce;
float invFluidStrength = 1.0 - length(vel) * 0.65 * uInteractForce;

// 2. завихрение (bitangent noise 4D)
float force1 = 0.0002*(0.7 + 0.3*vRand.z) + 0.0004*additionalNoise;
currentVel.xyz += BitangentNoise4D(vec4(currentPos.xyz*7.0, time*(1.0 + 0.7*vRand.y))) * force1 * dtRatio;

// 3. пружина к своему домашнему месту
currentVel.xyz += (origPos.xyz - currentPos.xyz) * 0.001 * dtRatio * invFluidStrength;

// 4. притяжение к поверхности объёма
float force2 = 0.0015*(0.7 + 0.3*vRand.w);
float signForce = mix(0.0, -0.3, sign(dist) + 1.0);
currentVel.xyz += grad * force2 * signForce * dtRatio * invFluidStrength;

// 5. трение
currentVel.xyz *= frictionFPS(0.9, dtRatio);
currentPos.xyz += currentVel.xyz * dtRatio;
```

`signForce` считается так: снаружи `sign(dist)` = 1, значит `mix(0, -0.3, 2)` =
**-0.6**, точка вжимается в поверхность с силой `0.0015 * 0.6`. Внутри
`sign(dist)` = -1, значит **0**, и точка внутри объёма плавает свободно. Отсюда
объёмность фигуры: оболочка плотная, нутро живое.

Трение 0.9 за кадр при 60 Гц даёт постоянную времени 0.158 с.

**Границы.** Не куб, а цилиндр, и это записано прямо в комментарии:

```glsl
// clamp position to a cube -> switch to cylinder
currentPos.y = clamp(currentPos.y, -0.34, 0.35);
currentPos.xz = normalize(currentPos.xz) * clamp(length(currentPos.xz), 0.0, 0.275);
```

Высота 0.69, радиус 0.275. Фигура стоит в вазе, и точки не улетают за её стенки.

**Размер частицы**:

```glsl
gl_PointSize = uSize / length(vPos.xyz) * (resolution.y / 1300.0);   // uSize = 10
```

На расстоянии 1 единицы и высоте экрана 1300 px точка займёт 10 px. Деление на
расстояние даёт настоящую перспективу, множитель по высоте экрана делает размер
одинаковым на телефоне и мониторе. **Поворота у частицы нет вовсе**, точка круглая.

**Освещение частицы.** Форма шара строится из `gl_PointCoord`, нормаль
восстанавливается аналитически:

```glsl
float alpha = step(length(gl_PointCoord.xy - 0.5), 0.5) * uVisible;
if (alpha < 0.001) discard;
vec2 uv = 2.0*gl_PointCoord.xy - 1.0;
vec3 n = vec3(uv, sqrt(1.0 - clamp(dot(uv,uv), 0.0, 1.0)));
n.y = 1.0 - n.y;
float lightShadow = max(0.0, dot(normalize(rotateY(3.1416) * uLightPos), normalize(n)));
float ramp = lightShadow * vShadow;
vec3 color = mix(uColorDark, uColorLight, ramp);
```

Каждая точка притворяется маленьким шариком: у неё есть своя нормаль и свой
ламберт. Отсюда объём у облака вместо плоской пыли. Источник один,
`uLightPos = (-0.75, 1, -0.1)`.

**Мягкая тень от объёма** считается в вычислительном шейдере по рецепту GPU Gems
(глава 16, подповерхностное рассеяние) и кладётся в альфу позиции:

```glsl
vec3 lightPos = normalize(uLightPos);
float wrap = 0.25;
float dp = dot(lightPos, grad);
float wrapDiffuse = max(0.0, (dp + wrap) / (1.0 + wrap));
dp = -dp;  wrapDiffuse += max(0.0, dp) * 0.1;                   // отскок с обратной стороны
float targetShadow = mix(wrapDiffuse*0.2, wrapDiffuse, smoothstep(-0.05, -0.001, dist));
currentPos.a = mix(targetShadow, currentPos.a, additionalNoise);
```

Точки ВНУТРИ объёма темнее в пять раз (`wrapDiffuse * 0.2`), переход по
знаковому расстоянию на отрезке -0.05..-0.001. Поэтому фигура не выглядит
проволочной сеткой, у неё есть тёмная сердцевина.

**Цвета и свечение.**

```js
uColorInitial: "#b5d5ff",  uColorLight: "#bdc6d4",
uColorDark:    "#222b42",  uColorFast:  "#d7ebfa"
```

```glsl
// быстрые частицы светлеют
color = mix(color, uColorFast, pow(fit(vVel, 0.003, 0.005, 0.0, 1.0), 2.0));
// бедняцкое смазывание: быстрые полупрозрачнее
alpha *= max(uInitialGlow, pow(fit(vVel, 0.002, 0.007, 1.0, 0.0), 2.0)*0.5 + 0.5);
```

Свечение сделано ДВУМЯ вещами, и обе бесплатны.

Первое, свой режим смешивания:

```js
blending: cy /*CustomBlending*/, blendEquation: ar /*Add*/,
blendSrc: Ou /*SrcAlphaFactor*/, blendDst: hy /*SrcColorFactor*/,
depthTest: !0, depthWrite: !0
```

Результат = `src*srcAlpha + dst*srcColor`. Фон умножается на ЦВЕТ частицы:
тёмная частица гасит то, что за ней, светлая просвечивает и добавляет. Один
проход даёт и перекрытие, и свечение, при живом буфере глубины.

Второе, блум сцены входа стоит с **нулевым порогом**:

```js
e.addPass(new Fd().addBloom({levels:6, luminanceThreshold:0, intensity:1, radius:.85}))
```

В остальных сценах порог 0.2. Здесь светится вообще всё, и облако точек получает
ореол целиком.

**Сборка и рассыпание.** Отдельной функции нет, всё делается через
`additionalNoise = max(uAdditionalNoise, uShowNoise)`:

- сила завихрения растёт с `0.0002` до `0.0006` (втрое),
- затенение перестаёт обновляться (`mix(targetShadow, currentPos.a, additionalNoise)`),
  форма теряет объём и белеет.

Времянка сборки в таймлайне сцены:

```js
tl.set(mesh, {visible:!1}, 0);
tl.set(mesh, {visible:!0}, 1.5);
tl.fromTo(uAlpha,       {value:0}, {value:1, duration:2.5, ease:"power2.inOut"}, 1.5);
tl.fromTo(uShowNoise,   {value:1}, {value:0, duration:1.5, ease:"power1.inOut"}, 3.5);
tl.fromTo(uInitialGlow, {value:1}, {value:0, duration:1,   ease:"power1.inOut"}, 3.9);
```

По прогрессу сцены (делить на 9.2): облако появляется на **0.163**, собирается в
форму с **0.380 по 0.543**, свечение сборки гаснет к **0.533**. Обратный ход
работает сам, потому что это прокрутка timeline, а не событие.

Смена формы на другую подставляет другой объём и разворачивает облако:

```js
this.parent.mesh.computationMaterial.uniforms.uRotation.value = Math.PI*1.5;
```

Постоянное вращение всей фигуры:

```js
this.mesh.computationMaterial.uniforms.uRotation.value -= Fe.delta * 75e-5;
```

`Fe.delta` в миллисекундах, значит 0.75 рад/с, около **43 градусов в секунду**.

**Окно интерактива**:

```js
const s = ie.smoothstep(.45, .65, this.scene.progress);
const n = 1 - ie.smoothstep(.8, .93, this.scene.progress);
this.mesh.computationMaterial.uniforms.uInteractForce.value = s*n;
```

Фигуру можно разгонять курсором с прогресса 0.45 по 0.93, вне этого окна она
живёт сама.

**Прогрев.** Перед первым показом гоняется тысяча кадров вычислений в фоне, и
только потом `uVisible = 1`:

```js
initializeShape(){ let e=0; const t=()=>{ e+=Fe.delta; this.mesh.compute(...);
  if (e>1e3) { Q.off("webgl_prerender", t); this.mesh.material.uniforms.uVisible.value = 1 } };
  Q.on("webgl_prerender", t) }
```

Человек никогда не видит, как облако собирается из случайного куба.

### Остальные системы частиц

| система | класс | сколько | чем | геометрия одной | где |
|---|---|---|---|---|---|
| объёмная фигура | `wF` | **150 000** | Points, GPGPU 388² ×2 | точка, size 10/dist | вход |
| снег иглу | `B3` | **1 200** | InstancedMesh, GPGPU | Plane 0.075 × 0.15 | иглу |
| пыль детали | `XF` | **10 000** | Points | точка, size 3..10 | деталь проекта |
| снег тоннеля | `CF` | **200** | Points | точка, size 50/dist | вход |
| пыль комнаты | `BF` | **60** | Points | точка, size 7..12 | вход |
| плексус | `R3` | 18 точек, 5 узлов × 2 связи | Points + Lines | точка, uSize 200 | иглу, кубы |

**Снег иглу (1 200)** это единственное место, где частица не круглая. Плоскость
0.075 × 0.15, три случайных поворота, размер с разбросом 15 процентов:

```glsl
pos *= mix(0.85, 1.15, step(rand.x, 0.5));
mat2 rot0 = rotateAngle(time*mix(0.75, 1.25, rand.z) + rand.z*3.14*2.0);
mat2 rot1 = rotateAngle((rand.y + rand.z + rand.x)*3.14*2.0);
mat2 rot2 = rotateAngle(rand.x*3.14*2.0);
pos.xy = rot0*pos.xy;  pos.zx = rot1*pos.zx;  pos.yz = rot2*pos.yz;
```

Первый поворот крутится со временем, два других постоянные. Падение:

```glsl
currentVel.x += (sin(time*0.2 + w*15.6547) + sign(w-0.5)*2.0) * 0.00075 * dtRatio;
currentVel.x += 0.0025 * dtRatio;
currentVel.y -= 0.004 * mix(0.5, 0.8, fract(w*31.342)) * dtRatio;
currentVel.z += 0.0025 * dtRatio;
```

Объём 50 × 20 × 50 единиц, гашение по трём границам плюс у камеры, у земли и у
иглу. Цвета `#cda05e` / `#ab8349`, контур `#904619`: тёплая песочная крошка,
под снег это никогда не красили.

**Снег тоннеля (200)** летит вниз по спирали:

```glsl
pos.y -= mix(0.4, 0.7, fract(random.x+random.z+random.y)) * time;   // 0.4..0.7 ед/с
float angle = t*0.5 + pos.y;
pos.x += sin(angle)*0.4;  pos.z += cos(angle)*0.4;                   // спираль радиусом 0.4
pos.xz = rotate(pos.xz, t*0.5);                                       // и весь столб крутится
pos = treadmill(pos, vec3(3.0, 4.0, 3.0));                            // бесшовное зацикливание
gl_PointSize = 50.0 / length(mvPos.xyz) * (resolution.y / 1300.0);
vAlpha *= 0.3;
```

`treadmill` это готовая функция бесшовного зацикливания из общего чанка:
`float treadmill(float p, float margin){ float n = fract((p+margin)/(2.0*margin)); return n*2.0*margin - margin; }`.
Двести точек создают ощущение бесконечного снега в трубе, потому что улетевшая
вниз мгновенно возвращается наверх.

**Пыль детали (10 000)** реагирует на симуляцию жидкости под курсором:

```glsl
vec2 fluid = texture(tSim, ndc*0.5 + 0.5).rb;
float sim = fit(fluid.y, 1e-8, 0.3, 0.0, 1.0);
float size = mix(3.0, 10.0, random.x * sim);
gl_PointSize = size * (resolution.y * 0.002);
float flick = (sin(time*0.8 + random.y*12.43)*0.5+0.5) * (sin(time*1.73 + random.z*7.16)*0.5+0.5);
vLightFalloff = mix(0.5, 1.0, flick) * sim;
```

Точка вне следа курсора имеет размер 0 и яркость 0, то есть её не видно совсем.
Двойное мерцание с несоразмерными частотами 0.8 и 1.73 не даёт периода.

### Разлёт иглу на куски (для сравнения с частицами)

Иглу собрано `zt.batched("igloo.drc")`, матрицы кусков лежат в текстуре, а
параметры разлёта в своей четырёхканальной data-текстуре. Число кусков берётся из
файла модели, в коде его нет.

```js
let l = .4;
l *= Math.sin(-Fe.time*2 + a.centroid.x)*.5 + .5;
l *= Math.cos(-Fe.time)*.5 + .5;
l *= ie.mix(.5, 2, a.rand.z);
l *= .5;
l *= this.introDisplacementModulator.value;
// подъём от курсора
const c = Math.sin(Fe.time + a.rand.x*12.342) * a.rand.y;
const h = ie.fit(ie.smoothstep(1, 3, дистанцияДоКурсора), 0, 1, .5 + .3*c, 0);
l = Math.max(l, h*t);
a.targetBounce2  = ie.lerpFPS(a.targetBounce2,  a.targetBounce1, .05);
a.bounce         = ie.lerpFPS(a.bounce,         a.targetBounce2, .05);
a.targetDisplacement2 = ie.lerpFPS(a.targetDisplacement2, a.targetDisplacement1, .06);
a.displacement        = ie.lerpFPS(a.displacement,        a.targetDisplacement2, .06);
a.position.copy(a.centroid).addScaledVector(a.centroid, a.displacement);
```

Опять **две подтяжки подряд** (0.05 и 0.05 для отскока, 0.06 и 0.06 для разлёта),
тот же приём, что и в прокрутке. Поворот куска идёт от его же смещения:

```js
a.quaternion.multiply(cp.setFromAxisAngle(Ls.set(0,1,0), Math.cos(a.displacement*2 + a.rand.z*30)*a.displacement*.5 + A));
```

Разлёт по прокрутке гасится сверху вниз: `u = smoothstep(.3, 1, centroid.y)`, то
есть куски у земли почти не двигаются, купол разлетается сильнее.

---

## 5. Звук

### Восемнадцать дорожек, все .ogg

```js
addAudio({name:"music-bg",      url:"music-highq.ogg",  volume:.2,  autoPlay:!0, loop:!0});
addAudio({name:"room-bg",       url:"room.ogg",         volume:.45, autoPlay:!0, loop:!0});
addAudio({name:"wind",          url:"wind.ogg",         volume:0,   autoPlay:!0, loop:!0});
addAudio({name:"igloo",         url:"igloo.ogg",        volume:0,   autoPlay:!0, loop:!0});
addAudio({name:"shard",         url:"shard.ogg",        volume:0,   autoPlay:!0, loop:!0});
addAudio({name:"portals",       url:"circles.ogg",      volume:0,   autoPlay:!0, loop:!0});
addAudio({name:"particles",     url:"particles.ogg",    volume:0,   autoPlay:!0, loop:!0});
addAudio({name:"beeps",         url:"beeps.ogg",        volume:.5,  minTimeBetweenPlays:.4});
addAudio({name:"beeps2",        url:"beeps2.ogg",       volume:.5,  minTimeBetweenPlays:.4});
addAudio({name:"beeps3",        url:"beeps3.ogg",       volume:.5,  minTimeBetweenPlays:.4});
addAudio({name:"click-project", url:"click-project.ogg", volume:.5});
addAudio({name:"enter-project", url:"enter-project.ogg", volume:.5});
addAudio({name:"leave-project", url:"leave-project.ogg", volume:.5});
addAudio({name:"project-text",  url:"project-text.ogg",  volume:.5});
addAudio({name:"logo",          url:"logo.ogg",          volume:.3});
addAudio({name:"ui-long",       url:"ui-long.ogg",       volume:.3});
addAudio({name:"ui-short",      url:"ui-short.ogg",      volume:.3});
addAudio({name:"manifesto",     url:"manifesto.ogg",     volume:.3});
```

**Семь петель** заводятся сразу и крутятся весь сеанс, пять из них на нулевой
громкости. Пуска петли по требованию нет нигде: щелчок входа дороже, чем
крутящаяся тихая дорожка. **Одиннадцать разовых.**

Пространственного звука в приложении нет: `addPositionalAudio` в библиотеке
объявлен, вызовов ноль.

### Что чем управляет

| дорожка | что двигает громкость | формула |
|---|---|---|
| `music-bg` | ничего, постоянно 0.2 | |
| `room-bg` | ничего, постоянно 0.45 | |
| `wind` | прогресс сцены иглу | `fit(p, .05, .2, 0, 1) * fit(p, .75, .95, 1, 0)`, отдаётся `×0.4` |
| `igloo` | активность плексуса × ветер | `lerpFPS(текущее, ветер, .1)`, отдаётся `×0.5` |
| `portals` | близость к кольцу | `ease(fit(minDist, 0, .04, 1, 0), "power2.out") * .9` |
| `particles` | окно интерактива + скорость курсора | `.04*окно + splatVelocity*.21` |
| `shard` | скорость руки по кубу | `lerpFPS(текущее, soundVelocity, .2 вверх / .05 вниз)`, отдаётся `×0.5` |

Ключевые куски:

```js
// ветер: включается на 5-20 процентах сцены, гаснет на 75-95
this._windVolume = ie.fit(this.progress,.05,.2,0,1) * ie.fit(this.progress,.75,.95,1,0);
Q.emit("webgl_set_audio_volume", "wind", this._windVolume*.4);

// порталы: три кольца по прогрессу 0.28 / 0.375 / 0.465, окно 0.04
let n = 1/0;
[.28,.375,.465].forEach(r => { n = Math.min(n, Math.abs(this.progress - r)) });
this._portalsVolume = ie.ease(ie.fit(n, 0, .04, 1, 0), "power2.out") * .9;

// осколки: разная скорость на подъём и на спад
const r = this.cubes[n].mouseFrost.soundVelocity > this._shardVolume ? .2 : .05;
this._shardVolume = ie.lerpFPS(this._shardVolume, this.cubes[n].mouseFrost.soundVelocity, r);
```

Приём с осколками стоит забрать целиком: **звук нарастает вчетверо быстрее, чем
спадает** (0.2 против 0.05). Так ведёт себя настоящий шум трения, и это одна
строка.

Пороги порталов совпадают с окнами видимости колец из раздела 3: гул нарастает
ровно там, где кольцо влетает в кадр.

### Кроссфейд

Отдельного кроссфейда нет. Все громкости идут через один узел усиления с
экспоненциальным подходом:

```js
setVolume(e){ return this.gain.gain.setTargetAtTime(e, this.context.currentTime, .01), this }   // дорожка
setMasterVolume(e){ return this.gain.gain.setTargetAtTime(e, this.context.currentTime, .01) }   // микшер
// общий выключатель
U(this,js).gain.gain.setTargetAtTime(U(this,xo), Math.max(.1, he.audio.context.currentTime), .35);
```

**Постоянная времени 0.01 с на дорожку** и **0.35 с на общий выключатель**. Дальше
всё делают формулы прогресса: две петли просто едут по своим кривым, и там, где
одна гаснет, вторая уже звучит. Кроссфейд получается сам из перекрытия окон
`fit`.

Общая громкость `Be.volume = 1`, **старт приглушённый** (`muted: !0`). Уход со
вкладки глушит микшер в ноль тем же подходом 0.35 с:

```js
cA = function(i){ i ? (et(this,er,!0), nr.call(this, U(this,sn))) : (et(this,er,!1), nr.call(this, 0)) }
```

### Разовые: два предохранителя от повтора

Первый в самом контроллере, второй в вызывающем коде:

```js
playAudio(e="default", t=0){
  const s = U(this,bn).get(e);
  if (!s || !Bu.call(this)) return;
  if (Fe.time - s._timeLastPlayed > s._minTimeBetweenPlays) { s._timeLastPlayed = Fe.time; s.stop().play(t) }
}
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

Писк выбирается СЛУЧАЙНО из трёх файлов и не чаще, чем раз в 0.4 с. Три файла
вместо одного стоят копейки и полностью снимают эффект «одна и та же нота».

Манифест озвучен построчно, звук идёт на каждой ЧЁТНОЙ строке
(`onStart: () => { t % 2 === 0 && Q.emit("webgl_play_audio","manifesto") }`).

---

## Что из этого забираем в Rocket VPN

Rocket VPN ходит на родной прокрутке страницы с липкими кадрами (`rv-motion.js`,
девять актов высотой 190-300 svh в `frame.html`), igloo перехватывает колесо.
Перехват мы НЕ берём: он ломает поиск по странице, тачпадные жесты и историю. Всё
остальное переносится один в один.

### 1. Длина акта: удлинить на треть

У igloo прогресс сцены идёт `height+1` экранов: 3.35, 4 и 6.5. У нас акт даёт
`высота - экран`, то есть 0.9-2.0 экрана. Тоннель igloo длиннее нашего самого
длинного акта в 3.25 раза, и именно поэтому у них падение читается падением.

Правка в `frame.html`: акт «прокол» с 300svh до **400svh** (ход 3.0 экрана),
акты «оболочка» и «рубка» с 220 и 290 до **280 и 340** (ход 1.8 и 2.4), остальные
не трогать. Нижний предел хода в `ходАкта` поднять с `высотаОкна*0.6` до
`высотаОкна*0.9`: короткий акт при отключённом движении сейчас получает почти
двоичную долю.

### 2. Скорость прокрутки: добавить ограничитель и поводок

В `rv-motion.js` сейчас две подтяжки по `МЯГКОСТЬ = 0.30` (постоянная времени
`-1/(60*ln(0.7))` = 0.047 с на каждую). У igloo 0.075 и 0.15, то есть 0.214 и
0.103 с. Наша лента вчетверо резче, и это ровно та жалоба на «резко».

Конкретно:

```js
var МЯГКОСТЬ1 = 0.075;   // первая подтяжка, было 0.30
var МЯГКОСТЬ2 = 0.15;    // вторая подтяжка, было 0.30
var ПРЕДЕЛ    = 0.075;   // не больше 7.5 сотых хода акта за кадр при 60 Гц
```

и ограничение скорости в первой подтяжке по образцу `lerpFPSLimited`:

```js
var шаг1 = (a.цель - a.сыр) * сгл1;
var предел = ПРЕДЕЛ * раз;                    // раз = dt*60, тот же, что в подтяжке
if (шаг1 >  предел) шаг1 =  предел;
if (шаг1 < -предел) шаг1 = -предел;
a.сыр += шаг1;
a.д   += (a.сыр - a.д) * сгл2;
```

Потолок `раз` у нас 4, у igloo 5. Оставить 4, разница несущественная.

Порог схлопывания у нас 0.0005, у igloo 7.5e-5 в единицах экрана, что при нашем
ходе 1.5 экрана даёт 5e-5. Опустить до **0.0001**: сейчас лента встаёт на
полутысячной от цели, и на длинных актах это видно как недоезд.

### 3. Скорость как отдельная величина и поле зрения от неё

У нас скорости прокрутки нет вообще. Добавить в `rv-motion.js` рядом с долей:

```js
var скорость = 0;
// в шаг():
скорость += Math.abs(a.д - былоД);
скорость *= Math.exp(Math.log(0.98) * раз);   // постоянная времени 0.825 с
if (скорость > 1) скорость = 1;
if (скорость < 0.001) скорость = 0;
```

и отдать её сцене. Первое применение по образцу сцены кубов: **поле зрения
камеры сужать на скорости**. В `rv-real.js` камера сейчас с постоянным fov;
поставить `fov = базовый - 5 * скорость`, при базовом 45 это 40..45. Кадр
поджимается на разгоне и отпускает на остановке, и лента получает вес без единой
новой геометрии.

Второе применение: тот же множитель в силу ореола и в амплитуду тряски.

### 4. Тряска камеры: шесть синусов, в радианах, на ПРИЦЕЛ

Готовый рецепт, стоит час работы. `sineNoise1` у нас уже есть в шейдерах после
первого разбора (приём 17), нужна версия на JS:

```js
function синШум(x, y, z) {
  var s = 0;
  s += Math.sin(x*1.5    + y*3.4598 + z*1.234);
  s += Math.sin(x*3.12   - y*3.234  + z*4.221);
  s += Math.sin(x*0.355  + y*2.3    - z*1.375);
  s += Math.sin(-x*0.156 - y*3.34   - z*0.4566);
  s += Math.sin(-x*4.1235- y*0.485  - z*1.45);
  s += Math.sin(x*2.54   - y*0.879  - z*2.123);
  return s / 6;
}
```

Числа под наши акты: спокойные акты (станция, видно, периметр, стыковка)
**0.01 рад со скоростью 0.5**; акты с ходом (оболочка, выход, рубка)
**0.02 рад со скоростью 0.25**; прокол и пуск **0.03 рад со скоростью 0.6**.
Прикладывать к направлению взгляда, а не к позиции камеры: тряска позиции ломает
параллакс, тряска прицела читается как живая рука.

### 5. Параллакс курсора: перевести в углы

В `rv-world.js` параллакс сейчас сдвигает камеру. Перевести на схему igloo:
курсор в -1..1 умножается на `PI/2` и на коэффициент сцены, и результат
поворачивает вектор от прицела к камере вокруг двух осей. Числа: **0.07 по
горизонтали и 0.025 по вертикали** (±6.3° и ±2.25°) на обзорных актах,
**0.10 и 0.05** на близких планах (оболочка, рубка). Подтяжка **0.02 для
позиции, 0.015 для прицела**. На касании глушить вход в ноль и делить подтяжку
пополам.

### 6. Тоннель прокола: один вывернутый цилиндр вместо колец

`rv-коридор.js` сейчас 426 строк. Заменить на схему igloo:

```js
var г = new THREE.CylinderGeometry(1.3, 1.3, 9, 64, 32, true);
г.translate(0, -4.5, 0);
г.scale(-1, 1, 1);
```

Стенка одним аддитивным шейдером на три выборки нашего шума ветра на масштабах
**3, 4, 6**, скорость `time*0.05`, развёртка `vUv*vec2(1.0, 0.25)` со сдвигом
`uv.x += uv.y`, альфа `pow(value*fade, 3.0)*3.0`, цвет `(0.85, 0.9, 1.0)`.
Гашение по краям `smoothstep(0.0,0.2,vUv.y) * smoothstep(1.0,0.9,vUv.y)`.

Камера падает **11.3 единицы за 0.76 прогресса акта**. При акте «прокол» в
400svh на экране 800 px это 2400 px прокрутки на падение, то есть **212 px
прокрутки на мировую единицу**. Кривая падения: наша `entry_ease_3` через
`CustomEase` или готовый `cubic-bezier(0.272,0,0.685,1)` как приближение.

Три кольца-пролома на **y = -1.65, -4.15, -6.65** с шагом **2.5**, плашмя,
кручение с коэффициентом **0.4** от крена камеры, сама труба **0.65**.

### 7. Разлёт кольца от расстояния, а не от твина

Забрать целиком в `rv-плиты.js` и в акт «оболочка». Нужны два атрибута на кусок:
`centr` (центроид) и `rand` (три случайных). Числа igloo переносятся один в один:

```glsl
float dist = distance(cameraPosition, translation);
float vFalloff = falloffsmooth(dist, 14.0, 2.0, 13.0, 0.75);
float glowFalloff = 1.0 - smoothstep(0.2, 0.4, 1.0 - vFalloff);
pos += centr * glowFalloff * mix(0.075, 0.15, rand.z);
pos += rand.y * centr * glowFalloff * sin(rand.x*5.0 + time*0.5 + (centr.x+centr.y+centr.z)*15.0) * 0.05;
pos = rotate3D(pos - centr*0.3, normalize(rand*2.0-1.0), 0.5*smoothstep(1.5, 12.0, -vPos.z)) + centr*0.3;
float vFade = min(1.0, falloffsmooth(dist, 2.0, 16.0, 9.0, 0.5));
```

Функции `falloff` и `falloffsmooth` уже намечены к переносу в первом разборе
(приём 19), здесь они окупаются второй раз. Плюс: оболочка отматывается назад
идеально, потому что всё считается от расстояния до камеры, а не от событий.

### 8. Крен камеры на пол-оборота в проколе

Один из самых сильных приёмов igloo и один из самых дешёвых. В акте «прокол»:

```js
камера.up.set(0, 0, -1);
камера.up.applyAxisAngle(ОСЬ_Y, крен);          // крен: 0 → PI на доле 0.11..0.68
камера.up.lerp(ВЕРХ, возврат).normalize();      // возврат: 0 → 1 на доле 0.38..0.78
```

Кадр проворачивается на 180 градусов, пока корабль идёт по тоннелю, и встаёт
ровно к выходу. Ноль геометрии, две строки.

### 9. Частицы: перейти с точек по поверхности на объём

Это самая крупная и самая ценная правка, работы примерно на два дня.

Сейчас в `rv-рой.js` и `rv-пыль.js` частицы стоят по геометрии. Схема igloo:
трёхмерная текстура знакового расстояния плюс GPGPU-облако, которое к ней липнет.

Что делать конкретно:

- **Объёмы 64³ RGBA** на каждую форму: знак Rocket VPN, замок, глобус. Печём
  скриптом из наших GLB (расстояние до ближайшего треугольника + нормализованный
  градиент), кладём в KTX2. Один объём весит порядка 40-60 КБ после сжатия.
  Чужие `peachesbody_64`, `x_64`, `medium_32` не берём.
- **Число частиц: 60 000 на ступени 2, 25 000 на ступени 1, 8 000 на ступени 0.**
  У igloo 150 000, но у них сцена без тяжёлых моделей NASA; наш бюджет меньше.
  Текстура состояния: `ceil(sqrt(60000)/4)*4` = 248, то есть 248×248 ×2 мишени.
- **Силы**: пружина к домашней точке 0.001, притяжение к поверхности
  0.0015 с множителем -0.6 снаружи и 0 внутри, завихрение
  0.0002 при частоте `pos*7.0`, трение 0.9. Всё умножать на долю кадра, зажатую
  пятёркой.
- **Границы цилиндром**, а не кубом: `y = clamp(y, -0.34, 0.35)`,
  `xz = normalize(xz)*clamp(length(xz), 0, 0.275)`, масштабировать под наш размер.
- **Размер точки** `10.0 / length(viewPos) * (resolution.y / 1300.0)`.
- **Нормаль из `gl_PointCoord`** и ламберт по ней: это то, чего у нашей пыли нет
  совсем, и именно оно даёт облаку объём.
- **Мягкая тень объёма**: `wrap = 0.25`, отскок 0.1, точки внутри объёма темнее
  в пять раз, переход `smoothstep(-0.05, -0.001, dist)`.
- **Смешивание**: `CustomBlending`, `AddEquation`, `blendSrc = SrcAlphaFactor`,
  `blendDst = SrcColorFactor`, глубина включена на запись и на чтение. Это даёт
  свечение и перекрытие одним проходом.
- **Сборка и рассыпание одним числом**: поднять шум втрое (0.0002 → 0.0006) и
  заморозить затенение. Никаких отдельных состояний.
- **Прогрев тысячей кадров** перед первым показом.

Порог блума на актах с частицами опустить до **0** (у igloo так во всей сцене
входа), в остальных оставить 0.2-0.3 из первого разбора.

### 10. Снег и пыль: числа под замену

- **Пыль комнаты** (акт «рубка»): 60 точек в коробке 2.5 × 0.5 × 2.5, размер
  `mix(7,12,rand)*resH*0.002`, мерцание `sin(time*1.8 + rand*22.43)*0.4+0.6`,
  аддитив. Две строки, читается как воздух.
- **Снег тоннеля** (акт «прокол»): 200 точек, падение 0.4-0.7 ед/с, спираль
  радиусом 0.4, кручение столба 0.5 рад/с, зацикливание через `treadmill` по
  ±3/±4/±3, альфа 0.3, размер `50/dist`. Двести точек вместо тысяч.
- **Пыль под курсором** (акты «видно», «стыковка»): 10 000 точек, размер и
  яркость умножены на след жидкости, вне следа точка невидима. Двойное мерцание
  с частотами 0.8 и 1.73.

Функцию `treadmill` перенести в общий чанк шейдеров вместе с `falloff`.

### 11. Звук: три правки к тому, что уже есть

У Rocket VPN звук уже богаче: девять подложек и тринадцать разовых против
семи и одиннадцати у igloo, плюс своя схема двух источников на подложку со
встречными дугами синуса и косинуса, которой у igloo нет вовсе. Забирать оттуда
целиком нечего, но три числа полезны.

- **Разная скорость на подъём и на спад.** У igloo `0.2` вверх против `0.05`
  вниз для звука трения. В `rv-sound.js` громкость подложек сейчас идёт одной
  скоростью. Поставить подъём вчетверо быстрее спада на `prokol`, `stena`,
  `pusk` и на подложке `tonnel`.
- **Постоянные времени.** У igloo 0.01 с на дорожку и 0.35 с на общий
  выключатель. Проверить наши: общий выключатель должен быть именно медленным,
  иначе переключение звука щёлкает.
- **Случайный выбор из трёх файлов** на часто повторяющийся звук с окном 0.4 с.
  У нас `tap`, `hover` и `klik` звучат по одному файлу; на длинной ленте это
  слышно как ритм. Три варианта на каждый плюс окно 0.4 с снимают вопрос.

### Сводка чисел к переносу

| что | у igloo | у нас сейчас | ставим |
|---|---|---|---|
| подтяжка ленты, первая | 0.075 (τ 0.214 с) | 0.30 (τ 0.047 с) | 0.075 |
| подтяжка ленты, вторая | 0.15 (τ 0.103 с) | 0.30 | 0.15 |
| ограничитель скорости | 0.075 экрана/кадр | нет | 0.075 хода/кадр |
| поводок цели | ±0.5625 экрана | нет | ±0.5 хода |
| порог схлопывания | 7.5e-5 экрана | 0.0005 | 0.0001 |
| потолок доли кадра | 5 | 4 | 4 |
| трение скорости | 0.98 (τ 0.825 с) | нет | 0.98 |
| задержка перед снапом | 1.4 с | нет (снап CSS) | оставить CSS proximity |
| fov от скорости | 45 - 5·v | нет | база - 5·v |
| параллакс, углы | ±6.3° / ±2.25° | сдвиг камеры | ±6.3° / ±2.25° |
| подтяжка параллакса | 0.02 / 0.015 | 0.15-0.18 | 0.02 / 0.015 |
| тряска прицела | 0.01-0.02 рад | нет | 0.01-0.03 рад |
| тоннель | Cylinder 1.3×9, 64×32 | 426 строк колец | Cylinder 1.3×9, 64×32 |
| выборок шума на стенку | 3 (масштабы 3, 4, 6) | заливка | 3 (3, 4, 6) |
| падение камеры | 11.33 ед за 0.76 доли | нет | 11.3 ед за 0.76 доли |
| кольца | 3 шт, шаг 2.5, y -1.65 | нет | 3 шт, шаг 2.5 |
| разлёт осколка | 0.075..0.15 центроида | твины | 0.075..0.15 |
| частиц в фигуре | 150 000 | по геометрии | 60k / 25k / 8k |
| объём формы | 64³ SDF из VDB | нет | 64³ SDF из GLB |
| размер точки | 10/dist · resH/1300 | постоянный | 10/dist · resH/1300 |
| трение частиц | 0.9 | нет | 0.9 |
| порог блума на частицах | 0 | 0.62 | 0 |
| подъём/спад громкости | 0.2 / 0.05 | одинаковые | 0.2 / 0.05 |
| разовых файлов на звук | 3 (писки) | 1 | 3 на tap/hover/klik |
