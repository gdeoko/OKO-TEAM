# ДИЗАЙН 3D: как собрать кадр уровня key art и CGI-рекламы

Разбор для бизнес-парка «Кластер» (ООО «Активити»). Собрано 26.08.2026 по 30+ источникам:
разборы постеров и key art, гайды по product CGI, техническая 3D-визуализация, компоузинг,
операторская оптика, цветокоррекция рекламных кадров, промышленная фотография.

Палитра проекта: амбер `#E8A400`, приглушённое золото `#C9A233`, графит `#14171C`,
чернильно-чёрный `#0E1116`, тёплый белый `#F5F1E8`. Шрифт: плотный гротеск капителью.

Задача документа: заменить схему «фон + текст» на насыщенные многослойные сцены.
Разделы 3 и 4 - рабочие блоки, вставляются в промпт как есть, без перевода.

---

## 1. Что делает кадр «дорогим»: 12 приёмов и физика за ними

### 1.1. Три плана с разной резкостью
Передний план, средний и дальний должны различаться по резкости, а не только по размеру.
Физика: глубина резкости обратно пропорциональна квадрату диафрагменного числа и прямо
пропорциональна квадрату дистанции. На 85 мм и f/2.0 с трёх метров в резкости лежит около
15 см, всё остальное уходит в размытие естественно. Дешёвый кадр резок целиком, потому что
у генератора по умолчанию нет физической камеры. Требовать в промпте конкретную оптику
и дистанцию - самый дешёвый способ получить глубину.

### 1.2. Атмосферная перспектива
Дальний план обязан быть светлее, холоднее и менее контрастным, чем ближний. Физика:
рассеяние Ми на пыли и водяном паре добавляет к дальним объектам слой рассеянного света,
он поднимает чёрную точку и сжимает диапазон. В цеху на 60 метрах разница уже видна.
Приём даёт ощущение объёма пространства без единого дополнительного объекта.

### 1.3. Контровой свет и отделение силуэта
Тонкая световая кромка по контуру объекта отрывает его от фона. Физика: коэффициент
Френеля растёт к скользящим углам, у диэлектриков отражение на 80-89 градусах доходит
почти до единицы. Поэтому источник за объектом и чуть выше даёт яркую линию по краю даже
на матовом бетоне. Без контрового объект слипается с фоном, и кадр читается как плоская
аппликация.

### 1.4. Объёмный свет
Луч виден, только если в воздухе есть на чём рассеяться. Физика: однократное рассеяние
на взвеси, интенсивность падает по экспоненте от плотности среды и длины пути. На съёмках
это hazer с глицериновой или масляной взвесью, в рендере - volumetric scattering. Дым
даёт мягкие клубы, хейз - равномерную дымку и ровный конус луча. Для промышленного кадра
нужен именно хейз: он не читается как эффект, но добавляет глубину каждому плану.

### 1.5. Разная шероховатость материалов в одном кадре
Ключ к дороговизне: бетон, сталь, порошковая краска и стекло в одном кадре должны
по-разному ловить один и тот же свет. Физика микрофасеточная: при roughness 0.05 блик
собирается в точку, при 0.7 растягивается в широкое пятно с падением яркости. Слабый
кадр приводит все поверхности к одному пластиковому отклику, и материал перестаёт
читаться. В промпте: бетон 0.75, шлифованная сталь 0.25 с анизотропией вдоль проката,
амбер-порошок 0.35 с клиркоутом 0.05, стекло 0.02 при IOR 1.52.

### 1.6. Подповерхностное рассеяние
Свет входит в материал, гуляет внутри и выходит рядом. Физика: у толстого стекла, смолы,
пластика, воска и кожи это даёт мягкое свечение на просвет и отсутствие резкой границы
тени. Для «Кластера» применимо к прозрачным полимерным заготовкам, эпоксидной заливке,
матовым плафонам. Один такой объект в кадре мгновенно поднимает уровень рендера.

### 1.7. Каустика
Сфокусированные преломлением или отражением световые пятна. Физика: искривлённая
поверхность работает как линза, собирая пучок на плоскости за собой. Дорогая деталь,
потому что дешёвые рендеры её не считают: у них под стеклом просто тень. Стакан, лужа
масла, металлический жёлоб на бетоне - и каустика ставит кадр на уровень выше.

### 1.8. Боке и кружок нерезкости
Размытие фона - не просто «мыло». Форма боке определяется формой диафрагмы: 9 лепестков
дают почти круг, анаморфот - горизонтальный овал 2:1. Физика: точечный источник вне
плоскости фокуса проецируется в диск диаметром, равным проекции апертуры. Отсюда правило:
в фоне должны быть точечные источники, иначе размывать нечего. Ставить в фон гирлянду
светильников, искры, блики на металле.

### 1.9. Смаз движения как след времени
Выдержка - это интервал интегрирования. При 1/30 движущаяся стружка рисует дугу, при
1/8000 замирает в воздухе с сохранением фактуры. Кинематографическое правило 180 градусов
даёт при 25 кадрах выдержку 1/50, отсюда естественный смаз. Мощный приём: комбинировать
замороженный главный объект и смазанное окружение (проводка камерой), тогда динамика
есть, а герой читается.

### 1.10. Разделённая тонировка светов и теней
Тени в холодный циан, света и кожа в тёплый амбер. Физика восприятия: комплементарные
пары дают максимальный цветовой контраст при равной светлоте, глаз считывает это как
«объём». Для «Кластера» вместо голливудского teal-orange берём графит-амбер: тени
уводим к `#14171C` с лёгкой холодной прожилкой, света к `#E8A400`, средние тона держим
нейтральными, чтобы бетон не позеленел.

### 1.11. Поднятая чёрная точка, зерно и ореол
Абсолютно чёрный пиксель в кадре - признак цифры. На плёнке чёрная точка сидит около
6-10 из 255 из-за вуали основы и рассеяния в эмульсии. Halation - красноватый ореол
вокруг ярких источников от переотражения от подложки. Зерно неравномерно: в тенях
крупнее, в светах почти не видно. Три этих признака вместе снимают ощущение
стерильного рендера.

### 1.12. Контактные тени и затенение полости
В месте касания двух поверхностей свет физически не может попасть в щель, там тень
почти чёрная и резкая. Физика: ambient occlusion - доля полусферы, закрытая геометрией.
Дешёвый кадр вешает объект в воздухе без контактной тени, и мозг сразу читает подделку.
Требовать: тёмная резкая тень в точках опоры, мягкая и растянутая дальше.

---

## 2. Разбор 10 реальных примеров

### 2.1. Strelka: структура композиции киноплаката
https://strelka.co.uk/composition-and-structure-in-film-posters/
**Что там.** Пять рабочих схем: вид сверху (In the Heart of the Sea), вид с уровня земли
снизу (San Andreas), сплит-скрин, рамочный приём (Once Upon a Time in Hollywood),
негативное пространство (The Lobster, Uncut Gems) и «плавающие головы» над пейзажем.
Тезис студии: «кино - это то, что в кадре, и то, что за кадром».
**Берём.** Вид снизу для кадров с цехом и станком, негативное пространство под заголовок,
схему «объект крупно сверху + пространство парка снизу» для обложек.

### 2.2. Athena Productions: как делают иконическое key art
https://www.athena-productions.com/read/how-to-create-iconic-key-art-20
**Что там.** Разбор пайплайна key art: идея, композиция в чёрно-белом, тангенты, блокинг,
свет, рендер, пост. Отдельно - работа в оттенках серого до цвета, чтобы структура держалась
без цветовой поддержки.
**Берём.** Правило проверки: если кадр не читается в чёрно-белом на 300 px, цвет его
не спасёт. Ставим это в чек-лист перед генерацией серии.

### 2.3. Magna Ludum: key art для игр и вишлисты
https://magnaludumcreatives.artstation.com/blog/v3pOW/how-to-create-great-video-game-key-art-and-earn-more-game-wishlists-expert-tips-and-examples
**Что там.** Силуэт как главный носитель информации, читаемость в миниатюре, иерархия
«герой - логотип - фон», контровой свет для отделения.
**Берём.** Силуэт объекта (станок, кран-балка, фигура рабочего) прорабатываем до цвета,
логотип ставим в зону, где силуэт не спорит.

### 2.4. XO3D: материалы в product CGI
https://xo3d.co.uk/resources/3d-rendering/product-rendering/material-guide/
**Что там.** Разбор PBR по слоям: base colour, roughness, metalness, normal; анизотропия
для шлифованной стали; клиркоут для порошковой покраски; SSS для дерева и камня;
преломление, дисперсия и поглощение отдельно для каждого стекла.
**Берём.** Словарь материалов для промптов. В каждом промпте по «Кластеру» перечисляем
минимум три материала с разной шероховатостью.

### 2.5. XO3D: exploded views
https://xo3d.co.uk/resources/3d-rendering/product-rendering/exploded-views/
**Что там.** Компоненты разносятся вдоль одной оси, сохраняя пропорции по CAD. Тезис
источника: разрез премиального изделия сразу коммуницирует качество, потому что показывает
слои инженерии и тем оправдывает цену.
**Берём.** Главная идея под «Кластер»: разрезать не изделие, а сам блок аренды. Пол с
нагрузкой 4000 кг/м², кран-балка, потолок 12 м, ввод 100 кВт - как слои одного объекта.

### 2.6. Transparent House: exploded и x-ray для инженерии
https://www.transparenthouse.com/post/exploded-view-x-ray-renderings-for-engineering
**Что там.** X-ray подача: корпус делается полупрозрачным, внутренние узлы остаются
плотными. Плюс подписи, цветовое кодирование групп узлов.
**Берём.** Полупрозрачная оболочка здания с плотной начинкой инженерии внутри - готовая
система для кадра «что внутри 50 000 м²».

### 2.7. Aitor Echeveste: волюметрические god rays в Nuke
https://aitorecheveste.com/aevolumerays-a-free-volumetric-god-rays-tool-for-nuke/
**Что там.** Инструмент строит лучи от источника с контролем длины, спада и рассеяния,
работает поверх рендера как отдельный слой.
**Берём.** Луч - отдельный слой поверх сцены, а не свойство источника. В промпте
описываем его отдельным предложением с указанием угла и плотности.

### 2.8. Pixel Monkey: атмосфера в компоузинге
https://pixel-monkey.com/posts/creating-convincing-atmospheric-effects-in-photo-composites/
**Что там.** Конкретика: слой дымки в Overlay или Soft Light на 15-25%; пыль из фильтра
Clouds, обесцвеченная, Screen, 3-8% прозрачности; туман - белым по Screen с разной
непрозрачностью мазков. Главный тезис: атмосфера должна чувствоваться, а не замечаться.
**Берём.** Числовые ориентиры плотности. Если эффект виден как эффект - его слишком много.

### 2.9. Lightmap: студийный свет через HDRI
https://www.lightmap.co.uk/learning/studio-lighting-techniques-with-hdri-maps/
**Что там.** Свет собирается прямо на HDRI-карте: софтбоксы, стрипы, градиентные карты,
отражающие панели ставятся в любую точку сферы, и блик едет туда, куда нужно арт-директору.
**Берём.** Описывать не «студийный свет», а конкретную расстановку: большой софтбокс сверху
слева, узкий стрип справа сзади для кромки, градиентная карта снизу для подсветки нижних
рёбер.

### 2.10. VideoPhoto Studio: съёмка промышленных станков
https://www.videophoto.studio/post/industrial-machine-photography-professional-guide-to-photographing-machinery/
**Что там.** Фокусные 50-85 мм на среднее оборудование и 70-135 мм на детали, диафрагмы
f/11-f/16 ради сквозной резкости, три четверти как основной ракурс, сверхширики запрещены -
они врут про длину и высоту машины. Масштаб передаётся через оператора рядом и через точки
входа-выхода материала.
**Берём.** Для каталожных и доказательных кадров - эта дисциплина. Для обложек и key art
сознательно нарушаем: широкий низкий ракурс и открытая диафрагма ради драмы.

### Дополнительные источники разбора
- https://www.cined.com/behind-the-cinematic-look-of-anamorphic-lenses-a-short-guide-for-beginners/ - сжатие 2x, овальное боке, горизонтальные стрики
- https://www.strayspark.studio/blog/anamorphic-film-look-ue5 - 2.39:1, фокусные вдвое длиннее привычных, «анаморф умирает от передоза быстрее, чем от нехватки»
- https://filmpac.com/why-should-i-use-haze-or-fog-on-set/ - зачем хейз, разница с дымом
- https://en.wikipedia.org/wiki/Haze_machine - как устроен хейзер, масляная и гликолевая взвесь
- https://en.wikipedia.org/wiki/Volumetric_lighting - определение и механика god rays
- https://www.studiobinder.com/blog/what-is-a-rim-light-photography-definition/ - контровой и кикер, отделение от тёмного фона
- https://www.shutterstock.com/blog/color-temperature-3-point-lighting-basics - кельвины в трёхточечной схеме
- https://learn.zoner.com/color-grading-step-by-step-iii-how-to-get-the-popular-teal-orange-look/ - механика разделённой тонировки
- https://www.passionfuelsambition.com/glossary-what-is-teal-and-orange/ - тени в циан, света в амбер
- https://drawpaintacademy.com/atmospheric-perspective/ - воздушная перспектива, падение контраста с дистанцией
- https://www.d5render.com/posts/atmospheric-perspective-for-aerial-rendering - воздушка в рендере
- https://www.diyphotography.net/high-speed-photography-guide/ - длительность вспышки как реальная «выдержка»
- https://www.masteryour.photography/blog/freeze-frame-master-high-speed-photography - заморозка движения
- https://www.diyphotography.net/how-to-capture-motion-trails-while-freezing-subjects-using-shutter-drag/ - shutter drag, след плюс замороженный герой
- https://www.diyphotography.net/panning-photography-technique/ - проводка, резкий объект и смазанный фон
- https://www.premiumbeat.com/blog/how-to-frame-a-low-angle-shot-like-a-master-cinematographer/ - ракурс снизу и доминирование
- https://en.wikipedia.org/wiki/Low-angle_shot - определение hero-shot
- https://www.canon.ca/en/Articles/2025/how-to-get-started-with-macro-photography - макро, ГРИП 2-3 мм на 1:1
- https://progradedigital.com/unlocking-depth-and-detail-understanding-and-using-focus-stacking-in-macro-photography/ - стекинг по фокусу
- https://www.360render.com/3d-rendering/3d-industrial-rendering-for-product-launches-how-manufacturers-use-cgi-to-replace-factory-photography/ - CGI вместо съёмки цеха
- https://www.thepixellab.net/the-ultimate-guide-to-3d-fluid-simulation - симуляция жидкости в рекламе
- https://fyfluiddynamics.com/2025/07/crown-splash/ - корона всплеска, физика
- https://vanschneider.com/blog/creating-3d-typography-using-adobe-dimension/ - буквы как объекты сцены
- https://designmagazine.com.au/3d-typography-building-letters-as-objects/ - материал буквы определяет реализм
- https://morphic.com/resources/how-to/create-isometric-diorama-illustrations - изометрия без перспективных искажений
- https://www.kittl.com/blogs/object-typography-explained/ - объектная типографика
- https://www.playbook.com/blog/brutalism-in-graphic-design/ - брутализм, тяжёлая сетка, чёрный и жёлтый
- https://what.digital/ai-generated-visuals-not-look-cheap/ - почему ИИ-визуал выглядит дёшево
- https://zsky.ai/blog/why-ai-images-look-bad/ - плоский свет по умолчанию как главная беда
- https://ripli.ai/blog/why-ai-product-photos-still-look-fake - потеря разницы материалов

---

## 3. ГЛАВНОЕ: 10 визуальных систем для генератора

Каждый блок вставляется в промпт как есть, английским текстом, без правок.
Плейсхолдер `[SUBJECT]` заменяем на объект кадра, `[HEADLINE]` - на текст заголовка.

---

### Система 1. INDUSTRIAL CUTAWAY - архитектурный разрез

```
Architectural cutaway of [SUBJECT] in four planes. Foreground: the cut edge of a
concrete slab with exposed rebar, sharp at f/8, lower left. Hero: a production bay
sliced along one vertical plane so floor, crane rail and roof truss read as a single
section, parts offset 40 to 120 mm along that axis. Background: graphite void at eight
percent luminance, no horizon. Key is a 5600K HMI raked fifteen degrees camera left
through a window grid, throwing hard parallel shadow bars; a 3200K practical burns
inside the section; a 6500K strip behind lays a cold Fresnel rim on every top edge.
Materials: fair-face concrete roughness 0.75, brushed steel 0.25 anisotropic along the
roll, amber #E8A400 powder coat 0.35 under 0.05 clearcoat, glass at IOR 1.52. One pixel
muted gold #C9A233 leaders link the separated parts. Type is extruded condensed caps
standing on the slab, 60 mm deep, catching the HMI on its top bevel and dropping hard
contact shadows. Grade: shadows toward #14171C, highlights toward #E8A400, neutral
midtones, black point 7/255. 35 mm, f/8, 1/125, camera at 1.2 m.
```

---

### Система 2. FREEZE FRAME ACTION - замороженный экшен-момент

```
Freeze frame of [SUBJECT] at peak energy. Foreground: incandescent steel chips arcing at
the lens, the nearest three defocused into hot amber discs, the rest tack sharp. Hero:
tool meeting workpiece at optical centre, white hot particles leaving along a tangent.
Background: a dark hall falling off through haze, gantry silhouettes at twenty percent
contrast. Frozen by 1/8000 flash duration, not shutter: a bare 5600K head camera right
at forty five degrees as key, a gridded 5600K strip behind at eighty degrees rimming
every wet metal edge, a 2900K fill from below. Materials: oiled steel roughness 0.18
with smeared specular streaks, cast iron 0.8, amber #E8A400 on the guard, concrete under
a coolant film reading as a broken mirror. Motion is trajectory, not blur: each particle
keeps its shape plus a 3 mm tail. Type is heavy condensed caps flush left in the upper
dead zone, lit by the spark burst, warm at its left edge, near black at its right.
Grade: graphite shadows, amber highlight core, halation on the hottest particles, grain
heavier in shadow. 50 mm, f/4, low angle at 0.9 m.
```

---

### Система 3. PARTICLE COMPOSITE - композит с частицами

```
Composite of [SUBJECT] from four separated depth layers. One, foreground: concrete dust
and metal filings blown into soft overlapping discs, occupying the outer eighteen
percent as a vignette of matter. Two: the hero volume in full sharpness, isolated with a
clean hard edge. Three: scaffolding and racking dropped two stops and cooled. Four: a
ground graduating from ink black #0E1116 to graphite #14171C. One large 5600K source
high behind camera left as key, a 6000K narrow source directly behind the subject
haloing through the dust, a 3000K amber bounce off the floor. The particulate is what
makes the light visible: low density single scatter, denser in the beam cone. Materials:
primed steel roughness 0.45, rubber 0.9 with zero specular, amber #E8A400 anodised
aluminium 0.2. All filings share one vector with 4 to 8 mm streaks. Type is a flat
condensed caps block in #F5F1E8 laid over the composite, crossed by a six percent dust
overlay so it shares the same air. Grade: cyan lean in shadow, amber in highlight, black
point 9/255, 35 mm grain. 85 mm, f/2.8, subject at four metres.
```

---

### Система 4. DIMENSIONAL TYPE - буквы как объекты сцены

```
Dimensional typography scene where [HEADLINE] is the physical subject. Foreground: the
free edge of the first letter, cropped and defocused, its extruded side wall filling the
lower third with a slow specular gradient. Hero: the full wordmark in dense condensed
caps, extruded 180 mm with a 3 mm chamfer, standing on poured concrete at three
quarters, letters staggered in depth so each casts onto the next. Background: a dark
volume fading through haze with one distant amber practical as a bokeh point. Key is a
4x6 foot 5600K softbox high camera left; a 6500K strip skims the right, laying a bright
Fresnel line down every vertical edge; a 3000K floor kicker fills the undersides.
Materials: letter faces in amber #E8A400 powder coat roughness 0.35 under 0.05
clearcoat, side walls in milled aluminium 0.22 with tool paths running along the
extrusion, polished concrete 0.3 returning a blurred forty percent mirror. Motion is
only dust drifting through the beam. Grade: graphite shadows, amber highlights, neutral
midtones so the concrete stays grey. 65 mm, f/4, camera at letter mid height.
```

---

### Система 5. MACRO SHALLOW - макро с малой глубиной

```
Extreme macro of [SUBJECT] at 1:1. Foreground: a blurred sliver of the same material
entering lower right, reduced to a wash of tone. Hero: a 30 mm band of surface in true
focus, depth of field about 3 mm, machined ridges crisp at centre and dissolving within
a centimetre either side. Background: the object collapsing into gradient with two or
three speculars blooming into round bokeh discs. A single 5600K strip softbox raked at
ten degrees to the surface so every tool mark and pore casts its own micro shadow, a
3200K low fill to keep the shadow side alive, a 6500K pinpoint behind for a hot ridge
rim. Materials must differ inside one frame: milled aluminium roughness 0.22 with
directional anisotropy, a bead of cured epoxy whose subsurface scattering carries light
2 mm into the body, a smear of oil at 0.06 acting as a broken mirror. Motion is one
droplet suspended in surface tension. Type stays off the surface: a small condensed caps
caption in #F5F1E8. Grade: amber core, graphite falloff, black point 8/255, very fine
grain. 100 mm macro, f/5.6, focus stacked.
```

---

### Система 6. ISOMETRIC DIORAMA - изометрия

```
Isometric diorama of [SUBJECT] as a precision scale model, orthographic, camera at
thirty degrees elevation and forty five degrees rotation. Foreground: the cut edge of
the base, a graphite #14171C slab with a 4 mm amber #E8A400 inlay. Mid: the model
itself, production bays, crane, docks and yard on a modular grid, blocks separated so
nothing occludes anything. Background: pure void in ink black #0E1116, the model
floating with one soft shadow beneath. A large 5600K overhead area source gives even top
light and clean forty five degree shadows; a 6500K rim from the far corner cuts the
silhouette from the void; a 2800K glow leaks from every window and open gate. Materials:
matte resin roughness 0.6, brushed steel 0.25 for rails and rooftop plant, amber #E8A400
acrylic 0.15 for accent volumes that glow from within. Motion is one gantry crane mid
travel with a 20 mm smear on its trolley alone. Type floats as flat condensed caps
labels on hairline #C9A233 leaders, plus one extruded headline resting on the base edge.
Grade: neutral midtones, cool shadows, amber accents, no grain.
```

---

### Система 7. DOUBLE EXPOSURE - двойная экспозиция

```
Double exposure of [SUBJECT] where two images share one negative. Base: a hard edged
silhouette, a worker in profile or the outline of a production block, a solid mass on a
field graduating from warm white #F5F1E8 at top to graphite #14171C at bottom. Inner: a
real shop floor with receding overhead lighting, visible only inside the silhouette,
exposed so its highlights punch through the silhouette edge and its shadows leave that
edge razor sharp. Depth comes from the inner scene: near machinery sharp, far end fading
into haze at fifteen percent contrast. Inside, 4000K linear fixtures recede in
perspective and a 5600K daylight wedge enters from a distant roof light,. Materials
matter only inside: polished concrete roughness 0.3 with a blurred mirror return, steel
0.25, one amber #E8A400 machine as the single saturated accent. Motion is one figure
ghosted at 1/15. Type is a condensed caps block placed entirely in the empty gradient
outside the silhouette, in graphite. Grade: duotone of graphite and amber with muted
gold #C9A233 in the transitions, black point 10/255, visible grain.
```

---

### Система 8. CUTOUT COLLAGE - коллаж-вырезка

```
Collage of [SUBJECT] from hard cutouts laid over rendered depth. Plate: a real
production hall interior defocused to f/1.8 softness and dropped two stops, functioning
purely as atmosphere. Mid: two or three photographic cutouts with knife sharp edges and
a 2 px warm white #F5F1E8 keyline, each with its own hard drop shadow offset 12 px down
right at forty percent so it reads as a physical layer. Foreground: a flat amber #E8A400
bar or quadrant with zero texture, plus a 40 lpi halftone patch in muted gold #C9A233
bleeding off one edge. Every cutout is keyed from upper left at 5600K: consistent
direction stops a collage looking random. Materials read only inside the cutouts:
brushed steel roughness 0.25, concrete 0.75, amber powder coat under clearcoat. Motion
is graphic, a repeated echo of one cutout at three falling opacities. Type is the
loudest element, dense condensed caps in graphite #14171C over the amber shape, letters
overlapping the cutout edges so the layers interlock. Grade: plate desaturated toward
graphite, saturation only in amber and gold, print grain.
```

---

### Система 9. VOLUMETRIC LIGHT - объёмный свет

```
Volumetric light study of [SUBJECT] in a hazed industrial volume. Foreground: the near
black defocused mass of a column filling the left quarter. Hero: the subject standing in
the beam path, top surfaces carved out in amber, lower body descending into graphite.
Background: the hall receding sixty metres, contrast falling until the far wall sits at
twelve percent. Haze is low and even, enough that a 5600K HMI through a high window grid
resolves into three parallel shafts with clean edges and gentle falloff. A 2900K sodium
practical deep in the hall glows as a warm point; a 6500K narrow source behind rims the
subject. Materials: concrete roughness 0.75 taking the beam as a bright floor pool,
steel 0.25 returning one long specular streak per beam, amber #E8A400 surfaces appearing
to emit inside the shaft. Motion is dust drifting through the shafts, motes resolved at
1/60 as 5 mm streaks. Type sits in the darkest quadrant in muted gold #C9A233 condensed
caps. Grade: warm shafts, cool ambient, black point 10/255, halation at the window
openings. 35 mm, f/2.8, floor level looking up.
```

---

### Система 10. HYPERREAL PRODUCT - гиперреалистичный продукт-шот

```
Hyperreal product shot of [SUBJECT] treated as a premium object. Foreground: a shallow
pool of wet polished concrete entering the bottom eighth defocused, carrying an inverted
amber smear of the subject. Hero: the object dead centre at three quarters, sixty
percent of frame height, every edge resolved. Background: a seamless sweep from graphite
#14171C behind the top to ink black #0E1116 at the base. HDRI studio rig: a 1.5 m 5600K
softbox overhead as key, two vertical 5600K strips at seventy degrees for the long
specular runs down the flanks, a 6500K kicker behind for the top rim. Materials carry
the shot: machined aluminium roughness 0.22 anisotropic, amber #E8A400 powder coat 0.35
under a 0.05 clearcoat, rubber 0.9 with almost no specular, glass at IOR 1.52 throwing a
small caustic onto the concrete. Motion is absent, replaced by one dust mote catching
the kicker. Type is a small dense condensed caps lockup in #F5F1E8 in the upper right
negative space. Grade: true neutral greys, amber highlights, cool shadows, black point
6/255, almost no grain. 100 mm, f/8, focus stacked.
```

---

## 4. Пятнадцать модификаторов эффекта

Добавляются одним предложением поверх любой системы. Больше двух за раз не ставить.

**1. Искры**
```
Add a burst of incandescent steel sparks leaving the contact point along tangent
trajectories, each particle frozen at 1/8000 with a 3 mm tail, colour running from 2200K
white hot at origin to deep amber #E8A400 as they cool, brightest elements in frame.
```

**2. Пар**
```
Add pressurised steam venting from a side port, a tight white plume that expands and
loses density within 600 mm, backlit by a 6500K source so it glows on its far edge and
stays near neutral grey on the camera side, with visible turbulence at the boundary.
```

**3. Дождь на стекле**
```
Add rain beading on a glass pane between camera and subject, droplets 2 to 5 mm, backlit
so each acts as a lens carrying an inverted miniature of the amber highlights behind it,
the pane surface in focus and the subject softened to f/2.0 behind it.
```

**4. Световые утечки**
```
Add an analogue light leak entering from the upper right corner, a soft diagonal wash of
amber #E8A400 falling to muted gold #C9A233, screened over the frame at fifteen percent,
lifting the black point in that corner and never crossing the main subject.
```

**5. Дым**
```
Add low lying smoke drifting across the floor plane, dense enough to hide the ground
contact line at the far end and thin enough to stay transparent near camera, lit from
behind at 5600K so it separates from the dark background as a luminous ribbon.
```

**6. Пыль в луче**
```
Add suspended dust made visible only inside the light shafts, individual motes resolved
at 1/60 as 5 mm streaks sharing one slow drift vector, density high in the beam cone and
falling to nothing outside it, so the beam edge stays crisp.
```

**7. Отражения в мокром бетоне**
```
Add a thin film of water on the polished concrete floor, roughness 0.06, returning a
vertically stretched blurred mirror of the subject and every amber light source at forty
percent strength, broken by shallow ripples in two places near the frame edge.
```

**8. Боке**
```
Add a field of out of focus point sources deep in the background, rendered as clean
circular discs 40 to 90 px wide with a slightly brighter edge, amber and muted gold only,
overlapping without merging, occupying the upper third behind the subject.
```

**9. Хроматическая аберрация**
```
Add restrained lateral chromatic aberration, zero at the optical centre and rising toward
the corners, red fringing outward and cyan inward, at most 1.5 px at the frame edge,
applied only on high contrast boundaries so the centre stays clinically clean.
```

**10. Плёночное зерно**
```
Add fine 35 mm film grain distributed non uniformly, coarser and more visible in the
shadows and midtones, nearly absent in the highlights, with the black point lifted to
8/255 and a warm halation ring bleeding around the brightest sources.
```

**11. Блики объектива**
```
Add an anamorphic lens flare from the strongest source: one horizontal blue streak
crossing the frame with soft falloff, a faint oval ghost on the opposite diagonal, and a
low contrast veiling glare across the nearest quadrant, kept under fifteen percent.
```

**12. Объёмный туман**
```
Add even volumetric fog at low density filling the whole space, raising the black point
with distance so contrast falls steadily from the foreground to twelve percent at sixty
metres, cooling the far plane while leaving foreground colour intact.
```

**13. Электрическая дуга**
```
Add a welding arc as the brightest point source in frame, a small 4500K core blowing to
pure white with a hard blue violet corona, throwing hard sharp shadows outward in every
direction and lighting the nearest surfaces two stops above the ambient key.
```

**14. Стружка в воздухе**
```
Add curled metal swarf thrown into the air, ribbons 20 to 60 mm long tumbling on
individual axes, sharp at the frozen plane and streaked into 15 mm arcs closer to camera,
catching the rim light on their inner curve and going near black on their outer face.
```

**15. Брызги масла**
```
Add cutting oil thrown off the tool as a crown splash, a rising rim of liquid breaking
into a ring of secondary droplets at its edge, viscous and slow with thick ligaments,
amber tinted and translucent, refracting the key light through its thinner sheets.
```

---

## 5. Что запрещено: от чего кадр выглядит дёшево

1. **Плоский равномерный свет.** Дефолт генератора: один софтбокс размером с ангар,
   всё освещено одинаково. Если в промпте не задан тип, направление, мягкость и кельвины
   источника, кадр будет мёртвым. Всегда указывать минимум два источника с разной
   температурой.
2. **Одна шероховатость на все материалы.** Бетон, сталь, резина и стекло с одинаковым
   пластиковым бликом читаются как игрушка. Минимум три материала с разной roughness
   в каждом кадре.
3. **Абсолютно чёрный и абсолютно белый.** Значения 0 и 255 в кадре - подпись «цифра».
   Чёрная точка 6-10, света с сохранённой деталью.
4. **Отсутствие контактной тени.** Объект без тёмной резкой тени в точках опоры висит
   в пустоте и разваливает кадр мгновенно.
5. **Сквозная резкость по всей глубине.** Если резко всё, камеры не было. Кроме
   каталожных кадров, где это осознанная задача.
6. **Текст поверх без интеграции.** Заголовок, наклеенный сверху без тени, без
   перекрытия, без общей атмосферы, - главная примета «фон плюс текст», от которой
   отказался клиент.
7. **Симметрия по центру всего.** Объект строго по центру, текст строго по центру,
   свет строго фронтально. Смещать по третям, свет держать сбоку.
8. **Больше двух эффектов сразу.** Искры плюс дым плюс дождь плюс блики плюс аберрация -
   каша. Правило источников: эффект умирает от передоза быстрее, чем от нехватки.
9. **Эффект, который видно как эффект.** Дымка выше двадцати пяти процентов, пыль выше
   восьми, блик через полкадра - всё это читается как фильтр, а не как воздух.
10. **Сверхширик на технику.** Искажает длину и высоту машины, кадр становится
    неправдоподобным для человека, который эту машину видел. Для каталога 50-135 мм.
11. **Три и больше кегля в одном макете.** Плотный гротеск капителью работает на
    контрасте двух размеров, третий убивает иерархию.
12. **Больше одного акцентного цвета.** Амбер - единственный насыщенный цвет в кадре.
    Синие, зелёные, красные подсветки ломают бренд.
13. **Стоковые пиктограммы и эмодзи.** В интерфейсе и на макетах только SVG-иконки
    в стиле бренда.
14. **Идеально чистая поверхность.** Новый бетон без пор, сталь без следов инструмента,
    пол без пыли - выдаёт рендер. Нужны потёртости, следы фрезы, пыль в углах.
15. **Градиент вместо сцены.** Объект на голом градиенте без переднего плана - это и есть
    «фон плюс текст» в трёхмерном исполнении. Передний план обязателен всегда, хотя бы
    расфокусированной кромкой.
16. **Случайное направление света между слоями.** В коллаже и композите все вырезки
    должны быть освещены с одной стороны, иначе слои не склеиваются.
17. **Логотип в мусорной зоне.** Знак не ставить туда, где он спорит с силуэтом объекта
    или пересекается со сложной фактурой. Восьмипроцентные поля держать чистыми.
