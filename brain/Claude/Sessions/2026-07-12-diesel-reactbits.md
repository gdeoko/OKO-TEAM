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
