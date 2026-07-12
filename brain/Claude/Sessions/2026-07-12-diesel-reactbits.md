# 2026-07-12 · DIESEL CARGO — реальные компоненты с React Bits + бесшовный шоукейс

## Контекст
Даниэль (в ярости) требовал: (1) реально использовать 3 сайта (React Bits, UIverse,
21st.dev) — минимум 10-15 живых компонентов, не «по мотивам»; (2) переделать сценарий
шоукейса в бесшовный full-bleed: видео разлёт→сборка→бесшовно 3D→квадрик выезжает,
слева мото, справа лодка.

## Что реально скачано (22 живых файла на диске: scratchpad/rbits/, scratchpad/r21/)
- React Bits (reactbits.dev/r/<Name>-JS-CSS, shadcn-JSON с оригинальным GLSL) — 20 шт:
  Aurora, Iridescence, LiquidChrome, Silk, Lightning, DarkVeil, Beams, Threads, Orb,
  Galaxy, Particles, Ribbons, Balatro, Ballpit, Hyperspeed, Dither, Waves, Squares,
  LetterGlitch, GridMotion. (ogl/three/pure-webgl/canvas/gsap).
- 21st.dev (по TWENTY_FIRST_API_KEY): minhxthanh/animated-shader-background,
  designali-in/web-gl-shader — 2 шт.
- UIverse: ЗАБЛОКИРОВАН Cloudflare — 403 и через curl, и через WebFetch. Не смог, честно
  сказал Даниэлю, добрал с двух других сайтов.

## Что встроено ЖИВЫМ (движок RB в index.html, оригинальный шейдерный код, порт OGL→WebGL1)
5 реальных шейдеров разведены по секциям через `<canvas class="rb" data-shader="...">`:
- aurora — фон калькулятора (#calc) + фон 3D-сцены (#shBg)
- silk — фон «Сравнение» (#compare) + фон формы заявки (#lead2)
- liquidchrome — маршрутная панель Гуанчжоу→Москва (жидкий металл)
- iridescence — фон отзывов (#reviews)
- lightning — вспышка на бесшовном стыке видео→3D (#flash, mix-blend:screen)
Движок: fullscreen-triangle, ES1, DPR≤1.4, IntersectionObserver пауза оффскрин.
Грабли: Aurora был WebGL2 (#version 300 es, struct+COLOR_RAMP с динамич. индексацией) —
переписал color-ramp через if/else (const-индексы) под WebGL1. `#define` требует \n перед #.

## Сценарий шоукейса — переделан в full-bleed
`#showcase .stage` теперь 100vw / 86vh (моб 78vh), без рамки/радиуса, кинематографич.
вигнетка ::after. Порядок: #shBg(aurora) → explodeVid(разлёт/сборка) → stage3d → #flash.
goLive() при переходе видео→3D дёргает doFlash() (Lightning 0.92→0.4→0 за 640мс) — «без
швов». Модели металлик-навы (bmat: metalness .9, fresnel cyan rim), мото слева/лодка
справа выезжают из ±9 в слот. Портрет — одиночная активная модель + табы.

## Деплой
forest-beach-360 (id 96269fa0-7465-4a92-89d5-bdc51f4cec87) = DIESEL CARGO.
Корень = app/public/index.html. dc/ ассеты (48M) уже в репо, index самодостаточный
(шейдеры инлайн). Коммит c9e54df, deploy_website → deployed. Прод проверен curl:
маркер «сборка v1.2 · react bits webgl» + 5 data-shader присутствуют.
Live: https://forest-beach-360.higgsfield.app

## QA (Playwright + swiftshader, scratchpad/site_build/qlite.mjs)
errs=0 шейдерных (остались только software-WebGL warning'и среды), overflow=false,
rbCanvases=7 (все получили контекст), calcTotal считается. Скриншоты d_calc/d_3d/d_trust
— Aurora/Silk/LiquidChrome/Iridescence рендерятся, 3D full-bleed со свечением.

## TODO (если Даниэль захочет)
- Добавить ещё из скачанных: Orb (светящаяся сфера за 3D), Threads, Galaxy, LetterGlitch.
- UIverse — попробовать через другой прокси/зеркало, если критично.
- Реальные цены каталога + бэкенд формы (Supabase + Telegram).

## v1.3 — визуальный QA каждого блока (Даниэль: «стало хуже, хуйня полная»)
Открыл прод в Playwright, отснял КАЖДЫЙ блок desktop+mobile, смотрел глазами, сэмплил
пиксели. Нашёл корневой баг и добил детали:

### ГЛАВНЫЙ БАГ (почему «стало хуже»): stacked chapter-scrims
Все 5 `.chapter` (герой/шаги/статы/каталог/финал) — `position:absolute; inset:0`,
наложены друг на друга. У каждой был `.wrap::before` тёмный скрим rgba(5,12,26,.78).
4 неактивные главы своими скримами закрывали активную → весь кинокадр+герой темнели
в ~4 слоя (замерил: заголовок белый по computed, но пиксель (44,51,62); красный
!important выходил (60,10,20)). Диагностика: `document.elementsFromPoint` вводит в
заблуждение (пропускает pointer-events:none) — помог `*{pointer-events:auto}` + walk.
ФИКС: убрал per-chapter `.wrap::before` полностью; легибилити теперь ОДИН слой в
`#grade` (под текстом, z1 < overlays z3): добавил левый градиент
`linear-gradient(90deg, rgba(5,14,31,.82), .5 30%, 0 62%)`. Заголовок стал (245,248,252).
Плёнка (герой-склад, конвой фур под сиянием, горный перевал) — теперь видна во всей
красе. Это был самый большой регресс.

### Прочие детали
- Iridescence за отзывами был кислотно-яркий → uColor [0.05,0.10,0.22], всё темнее;
  `.canvas-bg` opacity .82 + радиальный скрим слева + отдельный мобильный скрим.
- Silk/LiquidChrome тоже притушил (тёмная премиум-текстура, не залив).
- Мобайл 3D: квадрик был гигантский/обрезан → camRest portrait pz 6.9, py1.15, ty0.92.
- Desktop 3D: пустота+шов → stage 70vh (mob 62vh), landscape cam pz6.5/py1.2/ty0.82,
  подписи категорий теперь на одном экране с моделями, верхний шов убран top-fade 24%.
- Калькулятор: сумма рвалась «488 94/0 ₽» → white-space:nowrap + clamp 28..52.
- Лоадер ждал ВСЕ 355 кадров → reveal после 18% (frame0 ready), остальное фоном.
Деплой 7d267da → v1.3. Прод проверен: маркер + скрим убран (grep old_scrim=0).

## v1.4 — полноэкранные WebGL-сцены посередине (Даниэль: «нет webgl фона посередине»)
Портировал ещё 2 больших живых шейдера React Bits в движок RB (Python-инъекция, чтобы
без опечаток; правил vec3-resolution через uniform3f, передачу tt в setter, bool через
uniform1i):
- **Galaxy** (звёздное поле, snoise-звёзды, twinkle) — новая full-screen секция #fxGalaxy
  ПОСЛЕ шоукейса: «От завода в Гуанчжоу до вашего двора» + бейджи 30/2400+/100%.
- **Orb** (светящееся кольцо, snoise3) — full-screen #fxOrb ПЕРЕД формой: CTA «Ваша
  техника уже в пути». Грабли: hue=205 увёл в тёплый (бренд запрещает тёплое) → hue=-28
  = холодный сине-циан.
CSS `.fx`: 100vw / 90vh, canvas full-opacity (шейдер — герой), радиальный скрим ::after,
sheen-заголовок, бейджи. Обе добавлены в scroll-snap. 9 WebGL-контекстов всего,
IntersectionObserver пауза оффскрин. Компиляция чистая (qcheck: 0 shader errs).
Деплой b8e72f1 → v1.4. Прод: маркер + data-shader galaxy/orb присутствуют.

Живых эффектов на сайте сейчас: film-scroll (webp seq) + video→3D(GLB)+Lightning-вспышка
+ Galaxy + Aurora + Silk + LiquidChrome + Iridescence + Orb + Lottie(pulse) + SVG-spine.
В запасе скачаны (не встроены): Beams, DarkVeil, Threads, Ribbons, Particles, LetterGlitch,
Balatro, Hyperspeed, Dither, Waves, GridMotion.

## v1.5 — скролл-сцена + чёрная дыра + доскролл + ориентация моделей (детальный фидбек Даниэля со скринами)
Открыл прод, отснял мобайл-скрины Даниэля глазами. Проблемы и фиксы:
- **Чёрная дыра после фуры**: film-done прятал #stage (последние ~35vh трека = чёрное до
  шоукейса). Фикс: film-done прячет только #overlays/#spine, последний кадр (фура) остаётся;
  шоукейс (opaque, z5) наезжает сверху. #shBg (aurora) теперь виден всегда (opacity .4), не чёрный.
- **Сцена не привязана к скроллу**: переписал шоукейс в sticky-pin. #showcase height:260vh,
  .show-sticky position:sticky top:0 height:100vh (head сверху, stage flex:1, labels снизу — всё на 1 экране).
  showProg()=−rect.top/(H−vh). render() по sp: goLive при sp>0.18||vid.ended; камера camFrom(pz3.4)→camRest
  по fp=(sp-0.12)/0.5; мото/лодка выезжают из ±9 в slot*spread по sl=(sp-0.16)/0.5. Дыхание: bob y=sin,
  sway=sin*0.14. Убрал таймерный goLive (liveT0). Портрет: тоже трио (spread 0.44, camRest pz8.2).
- **Доскролл в фильме 1-5**: SNAP=[0.03,0.29,0.51,0.71,0.96]; scroll-idle 180мс → smooth к ближайшей
  главе если bd<0.17. Флаг snapping чтобы не драться.
- **Билд-маркер перекрывал карточки на мобиле**: сделал solid-bg pill + pointer-events:none.
- **Модели стояли боком** → нашёл фронт по angle-grid рендерам (angle.html): quad/moto front=+90°,
  поставил всем 3/4 фронт baseRot=1.745. **Лодка сначала вышла кормой** (я принял 270°=нос, а это
  корма; проверил рендером 0/45/90/135/180 — нос bow на +90°) → jetski baseRot=1.745 (нос ведёт).
- fx-секции 90vh→84vh (меньше пустоты). 3D IO init раньше (threshold .05 + rootMargin 600px).
QA: Playwright scroll-through, 0 JS-ошибок, overflowX=false. Скрины d_face/m_face/d_jetski_crop.
Деплой 9f21e9e → v1.5 (маркер «сборка v1.5 · скролл-сцена»). Прод: sticky+doscroll в HTML.

## v1.6-v1.7 — автономный режим «сделай шикарно» (Даниэль дал 5ч, «не цепляйся к правкам, ты режиссёр»)
Даниэль прислал референсы (TikTok @webloved/weblove — курс «строю с Claude+Lovable», $20/мес):
VECTR (светлая изо-диорама), CIRO (тёмные летающие банки с отражениями+scroll), Cartier
(кино-сцена «ателье» с часами-героем, золотые цилиндры, силуэты). Спросил, нужны ли ему курсы.
Ответ: НЕТ — это те же приёмы (Three.js, WebGL, scroll-scrub, glossy-материалы, кино-свет),
что уже применяю. Доказал делом.
- **v1.6**: убрал ОБА автоскролла (filmSnap + funnel scrollIntoView) — Даниэль: «лагают
  ускоряют». Починил футер: CSS был `.foot .col a` а элемент `id="foot"` (нет класса .foot)
  → ссылки инлайн слипались «КвадроциклыМотоциклы» → заменил на `#foot .col a/h4`. Вычистил
  ВСЕ инструкции-объяснялки (Листайте/Двигайте/Смотрите/Соберите и рассмотрите/выезжает из
  фуры) → продающий копирайт. Кнопки .btn-glass ярче (cyan-tint). Отступы секций 11vh→8.5vh.
- **v1.7 (уровень референсов)**: 3D-сцена — glossy mirror-reflections под каждой моделью
  (reflGrp = clone(root), scale.y=-1, faded 0.22 opacity, DoubleSide; без жёсткого пола чтоб
  не перекрывал), FogExp2(0x050c1a,0.052) для глубины, драм-свет (key 3.2 + rim 6.0 + rim2 4.0
  + SpotLight сверху 2.4), материалы стеклянные (metalness 1.0, roughness 0.24, envMap 2.4).
  Маслянистый скролл: демпфер smP+=(rawSp-smP)*0.13, камера/фанаут по smP (goLive по rawSp).
QA: Playwright 0 JS-ошибок, overflowX=false обе вьюхи. Скрины d_scene_up/m_scene_up —
отражения+туман+глянец рендерятся. Деплой 7b3ec50 → v1.7. Модели лицом (baseRot 1.745 все три).

## v1.9-v2.0 — мобильная обрезка + новый UI-язык карточек (Даниэль: «карточки не нравятся, найди другое в интеграциях»)
- **v1.9 мобильная обрезка карточек** (Даниэль требовал 3+ раза): главы фильма — fixed 100vh
  оверлеи, контент > экрана резался. На ≤380px шаги шли в 1 колонку (4 стопкой). Фикс:
  `.steps` 2×2 на ВСЕХ мобилах (убрал 380-правило 1fr), каталог `.cat` компактные горизонт.
  строки (flex-row, desc на всю ширину order:3), `.chapter` центр + padding 5vh. Проверил
  360/390 — всё влезает (03/04 не видны на 0.28 = staggered-раскрытие, не баг).
  Оживил: `.btn-primary` пульс-свечение (ctaGlow 3s), дышащие рамки (позже заменил на beam).
- **v2.0 новый UI карточек через 21st.dev** (Даниэль не любит стеклянные карточки):
  21st.dev free = 2 компонента/день. Вытащил **Border Beam** (dillionverma/Magic UI) —
  бегущий по рамке светящийся луч (offset-path rect + mask, портировал в vanilla `.beamL`).
  JS-инжект `.beamL` в `.cat/.stat/#calc .result/#calc .panel/#lead2 .form/.route-panel/.bar.win`
  (11 панелей). Облегчил базу карточек (было тяжёлое стекло rgba .66 → .5, рамка мягче .32),
  убрал borderBreath. offset-path поддержан (CSS.supports=true). Каталог 21st: aceternity/
  glowing-effect, bento-grid, dillionverma/shine-border, animated-shiny-text, number-ticker,
  aceternity/spotlight — в top.tsv (можно тянуть по 2/день или membership).
Деплой 221e6ac → v2.0. QA 0 ошибок обе вьюхи. 
TODO из фидбека Даниэля (не сделано, крупное): (1) explode как scroll-scrubbed image-seq
вместо video (он про глюки MP4 при скролле — прав, film уже webp-seq, но explode ещё video);
(2) новое HG-видео переход фура→квадрик в 4K; (3) NeRF/3DGS идея (Luma/Polycam→.ply→Spline)
— тяжёлый эксперимент, отложено. Интеграции-паспорт: OKO_ACCESSES.md (секреты в код НЕ вставлять).

## v2.1 — разлёт квадрика на СКРОЛЛЕ (Даниэль просил 3+ раза: «связаннее, круче»)
Перевёл explode из video в scroll-scrubbed webp-секвенцию (ffmpeg: explode.mp4 142к →
every 2nd → 71 webp 1280w q78 = 2.3МБ в dc/explode/seq/e_%04d.webp). Убрал <video id=explodeVid>
+ play-cta, добавил <canvas id="expSeq">. IIFE preload 71 кадр + rAF рисует кадр по прогрессу
шоукейса (sp/EXPLODE_END=0.16 → frame 0..70, object-fit cover вручную). Стык: при sp>0.16
goLive (3D) + Lightning-вспышка прикрывает свап; #showcase.live #expSeq opacity 0. 3D-модуль:
убрал vid/playCta/playVideo/ended-listener, goLive по rawSp>0.16, IO без playVideo.
Теперь ВЕСЬ путь — одна связная scroll-сцена: фильм-фура → выезд квадрика → [скролл] разлёт
(колёса/панели/энергия/дым, плавно, БЕЗ MP4-глюков) → сборка → бесшовно 3D → разъезд мото/лодка.
QA d_exp_a/b/3d: 0 ошибок, разлёт и стык рендерятся. Деплой a81f0e5 → v2.1. Прод: frame35=200.
Осталось из идей Даниэля: HG-видео фура→квадрик 4K для ещё более плавного въезда; NeRF/3DGS.

## v2.2 — единая хореография движения (Даниэль: «продумай сценарий движения каждого элемента, больше анимации»)
Переписал систему появления `[data-rv]`: ease-out-expo cubic-bezier(.16,1,.3,1) + blur(5px)→0 +
scale(.99)→1 + translateY, направления left/right/scale, авто-стаггер `--i` по индексу в секции
(волна). Заголовки (.section .sec-title, .fx h2, #foot .foot-brand) — раскрытие ПО СЛОВАМ:
JS split на `<span class=wr><span --wi>`, overflow-hidden, слова выезжают снизу со стаггером .045s,
градиент text-clip сохраняется (fill transparent на span). Триггер раньше (threshold .08 +
rootMargin -6%). Грабли: мой скрин на 1.6с ловил opacity 0 (переход ещё шёл) — на 4с =1, при
живом скролле норм. QA 0 ошибок обе вьюхи. Деплой 55d3b63 → v2.2.
Итог motion-стек: film-scroll + scroll-scrub разлёт(v2.1) + 3D фанаут с отражениями(v1.7) +
Border Beam(v2.0) + choreographed reveal + word-headings(v2.2) + 9 WebGL-шейдеров + Galaxy/Orb.

## v2.3 — бесшовный вход: A→B видео (фура→квадрик) сцеплено с разлётом (Даниэль прислал 2 фото)
Даниэль прислал 2 фото (A=фура+квадрик на рампе, B=один квадрик на тёмной студии), просил
A→B видео и связать всё без швов. Грабли по цене: сначала взял Seedance 2.0 = 45кр, Даниэль:
«ты гонишь, дорого! мы делали за 10кр». Нашёл в памяти (cine/README): всё делалось
**Minimax Hailuo variant=minimax, 1080/6с, FLF → 4К-апскейл ByteDance aigc**. Сгенерил A→B
этой моделью = **6 кредитов** (job 339336a7, вышло 1376×768, 142к). Проверил кадры: старт=фура
с выездом квадрика, финал=один квадрик (ровно фото B). Извлёк 71 webp (dc/ab/a_%04d.webp,
2.1МБ). СЦЕПИЛ в движке expSeq: SEQ = 71 A→B + 71 explode = 142 кадра, scroll-scrub sp 0→0.22,
draw по im.naturalWidth (A→B 1376, explode 1280). goLive 0.16→0.22, fanout fp=(sp-0.22)/.48,
sl=(sp-0.26)/.48. Теперь ВЕСЬ вход одна секвенция: фильм-фура → квадрик выезжает → один квадрик
→ разлёт → сборка → бесшовно 3D → разъезд. Всё webp-scrub (без MP4-глюков). Плёнка DPR 2.5→2.
QA d_seq_ab_a/ab_b/explode/3d: 0 ошибок. Деплой 23bb103 → v2.3. Прод: a_0035.webp=200.
Баланс Higgsfield: 2685→~2679 (потрачено 6кр). ДЕШЁВАЯ модель = minimax_hailuo, НЕ Seedance.
