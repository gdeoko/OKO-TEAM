---
name: reels-machine
description: Собрать готовый вертикальный ролик для Instagram Reels (1080x1920) из текстового сценария - стоковые кадры, русская нейроозвучка, караоке-субтитры, моушн-дизайн, музыка, SFX, обложка первым кадром. Использовать когда просят сделать/собрать/смонтировать ролик, рилс, видео для соцсетей по сценарию из контент-плана V.CODE или любому другому.
---

# Reels Machine - конвейер сборки роликов уровня топовых монтажёров

Собирает ролик 15-50 сек по сценарию: hook-история → стоковые кадры → озвучка → монтаж с эффектами. Проверен на ролике v001 «Пекарня» (V.CODE, 7 итераций с клиентом).

## Установка окружения (один раз за сессию)

```bash
sudo apt-get install -y -qq ffmpeg
pip3 install -q edge-tts
cat /root/.ccr/ca-bundle.crt >> $(python3 -m certifi)   # TLS через агент-прокси
npm i playwright   # браузер уже в /opt/pw-browsers/chromium
```

## Шаги конвейера

### 1. Сценарий → сегменты озвучки
Разбить текст на 5-6 предложений (сегменты s1..sN). Правила текста: числа прописью,
без длинных тире, без «не X а Y». Ударения принудительно через U+0301: те́сто, муки́.

### 2. Озвучка с тайм-кодами слов (edge-tts, БЕСПЛАТНО)
Голос: `ru-RU-DmitryNeural` (мужской реалистичный), rate="+8%", `boundary="WordBoundary"`.
Сохранять mp3 + json со словами `{w, t, d}` - на них строятся караоке-субтитры и
привязка анимаций к конкретным словам. Ретраи 4 раза (сервис моргает).

### 3. Стоковые кадры - ПРИОРИТЕТ ИСТОЧНИКОВ
Ключи в secrets.env (корень репо, source перед работой: `source secrets.env`).
1. **Pexels API** (PEXELS_API_KEY) - ГЛАВНЫЙ: нативные вертикальные 1080x1920+,
   `api.pexels.com/videos/search?query=...&orientation=portrait&size=medium` -
   скрипт pipeline/fetch_pexels.py. curl с --cacert /root/.ccr/ca-bundle.crt.
2. **Pixabay API** (PIXABAY_API_KEY) - запасной: `pixabay.com/api/videos/?key=...&q=...`
3. **Mixkit** - без ключа (см. ниже), кадры в основном landscape 720/1080.
Скейл для любой ориентации: `scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920`.
Звуки точные: **Freesound API** (FREESOUND_API_KEY):
`freesound.org/apiv2/search/text/?query=...&token=...&fields=id,name,previews` -
качать previews.preview-hq-mp3 (без OAuth). Пример: живой эмбиент пекарни, хруст корки.
Уникальные кадры которых нет в стоках: fal.ai (FAL_KEY, ~5-15р/клип) или
HF ZeroGPU (HF_TOKEN, FLUX/Wan через gradio_client) - подключать по запросу.

### 3б. Mixkit (без ключей, бесплатная лицензия)
- Категории: `https://mixkit.co/free-stock-video/{категория}/` (curl с UA Mozilla)
- Слаги видео в HTML, файлы: `https://assets.mixkit.co/videos/{id}/{id}-1080.mp4` (или -720)
- Curl к pexels/pixabay режется Cloudflare - не тратить время
- На сцену 2-4 кадра, смена каждые 2.5-3 сек. Вплетать кадры видеопродакшна
  (камеры, монтаж, телефон снимает) - связка с брендом V.CODE
- Музыка: `https://assets.mixkit.co/music/{id}/{id}.mp3` (ambient/cinematic из JSON-LD страницы)
- SFX: `https://assets.mixkit.co/active_storage/sfx/{id}/{id}-preview.mp3`
  Проверенные: whooshes 1492/1489/1486/1714/1490, затвор 1133, пуш 2354, толпа 368

### 4. Моушн-дизайн (Playwright → PNG-секвенции с альфой)
Генераторы в `pipeline/overlays*.js`: HTML/CSS/canvas анимация, покадровый скриншот
с `omitBackground: true`. Готовые элементы (переиспользовать, менять тексты):
- лого-заставка со взрывом частиц (overlays3: sting2)
- белый счётчик с бегущими цифрами + летящие иконки (overlays: counter)
- штамп «ПРОДАНО» с ударом (overlays4: stamp)
- переписка клиентов - чат-пузыри (overlays4: msgs)
- конфетти на финалку (overlays4: confetti)
- график роста с лаймовой линией и «x3» (overlays3: chart)
- геопин города с пульс-кольцами (overlays5: pin)
- часы-перемотка (overlays5: clock)
- телефон со скролл-стопом ленты (overlays5: scroll)
- вайп-шторка переходов, световой блик, видоискатель REC (overlays2)
- плашки «снято на телефон/профкамеру» (overlays: plates)
Анимации ПРИВЯЗЫВАТЬ к словам озвучки (время слова из json шага 2).

### 4б. Продвинутый моушн (ВСЁ ПРОВЕРЕНО БОЕМ, использовать активно)
Установка: `npm i gsap lottie-web three remotion @remotion/cli @remotion/bundler @remotion/renderer react react-dom`

**GSAP** - в Playwright-генераторах вместо ручных ease-функций:
`page.addScriptTag({content: fs.readFileSync('node_modules/gsap/dist/gsap.min.js','utf8')})`,
твины с paused:true, по кадрам `tw.progress(f/N)`. Изящные back/elastic/stagger.

**Lottie** - готовые дизайнерские анимации (огонь, лайки, стрелки, взрывы):
JSON качается напрямую: `https://assets{1..10}.lottiefiles.com/packages/lf20_XXXX.json`
(id брать со страницы анимации на lottiefiles.com, бесплатные паки; аккаунт не нужен).
Рендер: lottie-web (node_modules/lottie-web/build/player/lottie.min.js) в Playwright,
`loadAnimation({renderer:'svg', autoplay:false, animationData})`, по кадрам
`a.goToAndStop(f, true)` + скриншот omitBackground. Проверенный пример: lf20_touohxv0 (кубок).

**3D-вставки Sketchfab + three.js** - ОБЯЗАТЕЛЬНО использовать для wow-моментов
(вращающаяся камера/продукт/предмет ниши поверх кадра):
1. Поиск CC-моделей: `api.sketchfab.com/v3/search?type=models&q=...&downloadable=true`
   (Authorization: Token $SKETCHFAB_API_TOKEN), фильтровать license=CC Attribution
2. `api.sketchfab.com/v3/models/{uid}/download` → gltf.url → zip → unzip
3. Рендер: pipeline/three_scene/scene.html (importmap: three.module.min.js И
   three.core.min.js рядом + examples/jsm/loaders/GLTFLoader.js + examples/jsm/utils/)
4. ГРАБЛИ: ES-модули НЕ работают с file:// (CORS) - поднять `python3 -m http.server 8777`;
   WebGL в headless - флаг `--enable-unsafe-swiftshader`; свет ставить ярче (ambient 2+)
5. В титрах ролика/описании указывать автора модели (CC Attribution)

**Remotion** - программные композиции уровня After Effects (спринги, стагеры):
рендер через @remotion/renderer с `browserExecutable:
'/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell'`
(обычный chromium не может - старый headless удалён), `chromiumOptions:{gl:'swiftshader'}`,
codec 'prores' + proResProfile '4444' + `pixelFormat:'yuva444p10le'` для АЛЬФЫ →
.mov оверлей кладётся в stage2 как обычный вход. Демо: pipeline/remotion_demo.ts.
Лицензия: бесплатно до 3 человек в команде.

**HF ZeroGPU генерация** (HF_TOKEN) - бесплатные FLUX-кадры при наличии квоты:
`gradio_client.Client("black-forest-labs/FLUX.1-schnell", token=$HF_TOKEN)`,
`predict(prompt=..., width=768, height=1344, num_inference_steps=4, api_name="/infer")`.
Квота маленькая и дневная - если "exceeded quota" попробовать позже, не долбить.
SSL: `os.environ['SSL_CERT_FILE']='/root/.ccr/ca-bundle.crt'`.

### 5. Обложка (cover_template.html)
Стиль аккаунта: жирный заголовок сверху (белый + оранжевая строка), драматичный
кадр из клипа, лого внизу. Скриншот 1080x1920 → вшивается ПЕРВЫМ кадром ролика (0.3с).

### 6. Сборка - ТРИ ЭТАПА ffmpeg (pipeline/build_video.py)
НЕ собирать одним мега-графом - плывут тайминги. Этапы:
1. **stage1**: cover + шоты (zoompan-зумы попеременно in/out, chromashift-глитч на
   склейках) + concat + водяной знак + прогресс-бар + цветокор/виньетка/зерно
2. **stage2**: вайпы, световой блик (blend=screen ТОЛЬКО через format=gbrp!),
   видоискатель, все PNG-секвенции анимаций (setpts=PTS+T/TB, eof_action=pass)
3. **stage3**: караоке-субтитры (ASS) + аудио-микс

КРИТИЧНО: всем image-входам (-loop 1) задавать `-framerate 30` и конечный `-t`,
иначе 25fps-потоки ломают framesync и видео сжимается/зависает на кадре.

### 7. Караоке-субтитры (ASS, вшиваются в stage3)
- Шрифт: Союз Гротеск Bold (fonts/soyuz.ttf), размер 76, строчные буквы
- Одна строка, 2-3 слова (лимит 16 символов), появление по одному слову
- Активное (звучащее) слово - лайм `&H06F89C&` (#9CF806 с лого OKO), прошлые белые
- Без обводки: мягкая тень (Shadow 4, BackColour &H78..) + слой свечения (\blur14, alpha &HC8&)
- Строки НЕ пересекаются: конец строки клампится к старту следующей

### 8. Звук
- Голос: amix сегментов по adelay + dynaudnorm
- Музыка: volume 0.15, sidechaincompress от голоса (threshold 0.03, ratio 5) - дакинг
- SFX: разные whoosh на каждый переход, затвор/пуш/толпа по смыслу сцен, ~0.45
- Финал: loudnorm I=-14:TP=-1.5 (стандарт Instagram)

### 9. Контроль качества
Извлечь 8-10 кадров по таймлайну (ffmpeg -ss), склеить hstack, посмотреть глазами:
тайминг футажа, субтитры, анимации на местах, цвет не фиолетовый (= сломан blend).

## Брендинг V.CODE
Чёрный #0d0d0d, оранжевый #e8842a, лайм-акцент #9CF806. Лого: logo_hd.png (прозрачный).
Шрифты: Союз Гротеск (субтитры), Montserrat Black (цифры/заголовки), Oswald (обложки).
Финальная карточка: лого + «НАПИШИТЕ СЪЕМКА» + конфетти.

## Ограничения
- Higgsfield-генерация кадров: от 2 кредитов/изображение - проверять balance
- edge-tts иногда отдаёт пустой результат - обязательны ретраи
- Соблюдать правила текстов из vcode/VCODE_CONTEXT.txt (Раздел 11)
