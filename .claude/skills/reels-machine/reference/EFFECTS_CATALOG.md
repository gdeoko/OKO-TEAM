# Каталог приёмов Reels Machine (код + когда применять)

Выбирать 3–5 РАЗНЫХ на ролик под смысл фраз сценария. Не повторять чаще 1 раза в 3 ролика.

---

## A. Шейдерные переходы — gl-transitions (125 шт)

Когда: между сценами. Даёт «дорогой» AE-вид. Каждый ролик — другой набор.

```js
// pipeline/motion/transitions_gl.cjs прогоняет пару кадров склейки через GLSL.
// В build_reel: make_gl_transitions(stage1_mp4, [('WaterDrop','g1'),('ripple','g2'),...], bounds)
const transitions = require('gl-transitions');  // .name, .glsl, .defaultParams, .paramsTypes
// Топ по «дороговизне»: WaterDrop, ripple, morph, CrossZoom, DreamyZoom, LinearBlur,
// DefocusBlur, Dreamy, powerKaleido, GridFlip, cube, doorway, InvertedPageCurl,
// ButterflyWaveScrawler, FilmBurn, Swirl, RotateScaleVanish, Overexposure, wind, kaleidoscope.
```

Смысловой подбор: капля воды/ripple для воды/цветов; cube/doorway для «перехода в другое»;
CrossZoom/DreamyZoom для энергии; FilmBurn/Overexposure для тёплого; powerKaleido для бьюти.

---

## B. 3D-объект ВНУТРИ живого кадра — `pipeline/three/obj_in_scene.html`

Когда: wow-момент, показать предмет ниши объёмно в реальной сцене.
- Кладёт фон-кадр на дальний plane, объект three.js спереди, контактная тень (canvas-градиент),
  свет сцены (ambient+key+rim+point), орбита камеры + параллакс фона.
- assets/: `demo_bg.jpg` (кадр сцены), `models/<name>/scene.gltf`.
- `window.renderObj(t)` t∈[0,1]. Playwright omitBackground НЕ нужен (фон в кадре).
Объект под нишу: цветы→роза, авто→колесо/диск, кофе→чашка, стройка→каска, финансы→монета.

## B2. 3D-типографика — `text3d.html`
Металл/фаски/clearcoat + цветной свет + пол-отражение + искры. size≤0.95, камера дальше,
иначе слово не влезает в 9:16. FontLoader+TextGeometry (addons рядом), helvetiker_bold.json.

## B3. Частицы в логотип — `particles_logo.html`
Сэмплит альфу PNG-лого → точки слетаются из сферы в форму лого, свирл-выброс на выходе.
Под нишу можно целить в любую фигуру (ножницы, чашка) — подменить `img.src`.

## B4. 3D-туннель частиц — `petals3d.html`
Пролёт камеры сквозь облако спрайтов + бренд-точки. Спрайт рисуется на canvas — менять
форму/цвет под нишу (лепестки/деньги/снег/искры).

## B5. 2.5D-параллакс — `parallax.html` + `motion/depth_parallax.py`
Оживление ЛЮБОГО фото. Шаг1: `python depth_parallax.py in.jpg assets/par_depth.png`
(нужна `depth_v2_small.onnx` с onnx-community/depth-anything-v2-small). Шаг2: положить
`assets/par_src.png`(=фото) и depth, рендерить `window.renderPar(t)`. Камера НЕ глубже лица
(z не слишком мал), иначе «влетает в лицо».

## B6. Турнтейбл модели — `model_turntable.html` (соло) / `model_alpha_overlay.html` (оверлей)
Sketchfab CC-модель, `window.renderAt(angle, tilt)`. Overlay-версия с omitBackground кладётся
поверх живого b-roll (тень запечена в альфу).

## B7. Карта-флайовер — `map_fly.html`
MapLibre облёт к городу клиента. Тайлы OSM качать локально (headless без сети):
```python
# deg2num(lat,lon,z) → качать https://tile.openstreetmap.org/{z}/{x}/{y}.png с UA, z=0..6
```
Стиль raster на `http://localhost:PORT/tiles/{z}/{x}/{y}.png`. `window.setMapFrame(t)`.
Есть и Remotion-версия (maplibre-gl+@turf/turf, rule maplibre.md) — рендер `--gl=angle`.

Рендер 3D-секвенций (общий паттерн):
```js
const { chromium } = require('playwright');
const b = await chromium.launch({ executablePath:'/opt/pw-browsers/chromium',
  args:['--no-sandbox','--enable-unsafe-swiftshader'] });
// http.server в корне сцен; goto scene.html; waitForFunction('window.ready===true')
// for i: page.evaluate(`window.renderXXX(${i/(N-1)})`); screenshot({omitBackground:true|false})
```

---

## C. Инфографика Remotion — `pipeline/motion/infographics.tsx` + `counter_gauge.ts`

Виды (в каждом ролике ДРУГОЙ под конкретную цифру): линейный график роста (свечение,
заливка, точка-голова), пончик-процент, кольцевой гейдж «x3» с частицами, бар-чарт с
пружинами по очереди, счётчики-строки, одометр с прокруткой цифр, слайдер «до/после».
```bash
remotion render infographics.tsx linechart out_dir --sequence --image-format=png \
  --gl=swiftshader --browser-executable=/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell --concurrency=2
```
Правило: инфографики НЕ накладывать по времени — разносить (в build_reel проверять расписание).

## D. Кинетическая типографика — `kinetic_type.ts`
Слова пружиной + blur-шлейф + ударное кольцо. Только поверх кадра/фона, НЕ на голом чёрном.

## E. Световые лики — `@remotion/light-leaks`
`<LightLeak durationInFrames seed hueShift>` (0=жёлто-оранж,120=зелёный,240=синий).
На чёрном фоне → рендер `--gl=angle` → в ffmpeg `lumakey` или `blend=screen`(format=gbrp).

## F. Playwright DOM/canvas оверлеи — `pipeline/overlays*.js`
Стеклянные DM-карточки, инста-пост с лайв-лайками, пин+маршрут+печать города, камера-UI
(таймкод/REC/фокус/экспонометр), лепестковый дождь, чат-переписка, штампы, счётчики.
База: HTML со шрифтами base64 @font-face, покадровый screenshot omitBackground, setpts в ffmpeg.

## G. Lottie без ключа
```bash
curl --cacert $CA https://graphql.lottiefiles.com/2022-08 -H 'Content-Type: application/json' \
 -d '{"query":"query{searchPublicAnimations(query:\"fire\",first:8){edges{node{jsonUrl downloads}}}}"}'
```
jsonUrl curl-ом → рендер lottie-web в Playwright. Сортировать по downloads.

## H. rembg-коллаж (локально, без квот)
`from rembg import remove` → вырезать объект/человека → PNG альфа → коллаж/обложка/композит
на бренд-фоне со свечением (PIL: MaxFilter+GaussianBlur для ореола, тень, грейд, зерно).

## I. Ч/б-панч
```python
# split, короткий кусок в нуар, наложить обратно по времени T ударной фразы
"[0:v]split=2[main][bw];[bw]trim=T:T+0.65,setpts=PTS-STARTPTS,hue=s=0,eq=contrast=1.3,"
"setpts=PTS+T/TB[bwp];[main][bwp]overlay=0:0:eof_action=pass"
```

## J. Генерации ZeroGPU (HF_TOKEN, дневная квота, SSL_CERT_FILE=CA)
```python
from gradio_client import Client, handle_file
Client("black-forest-labs/FLUX.1-schnell", token=HF).predict(
  prompt=..., width=768, height=1344, num_inference_steps=4, api_name="/infer")   # кадр
Client("multimodalart/wan-2-2-first-last-frame", token=HF)                        # морф между кадрами
Client("Lightricks/ltx-video-distilled", token=HF)                               # i2v б-ролл
```
Одна попытка, при «exceeded quota» — следующий день. Платно без очередей — fal.ai (FAL_KEY).
