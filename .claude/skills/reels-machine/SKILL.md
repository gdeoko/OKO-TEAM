---
name: reels-machine
description: Монтажёр вертикальных роликов под ключ. Из текстового сценария собирает готовый Reels/Shorts/TikTok 1080x1920 уровня топового моушн-дизайнера — стоковые кадры, русская нейроозвучка, караоке-субтитры, 3D-графика, инфографика, шейдерные переходы, музыка. Контент-завод: под каждый ролик своя ниша, свои приёмы, без повторов. Использовать когда просят сделать/собрать/смонтировать ролик, рилс, видео для соцсетей, промо, рекламу по сценарию.
---

# Reels Machine v5 — контент-завод роликов под ключ

Из сценария → готовый вертикальный ролик 1080×1920, 15–50 сек, уровня студийного
монтажёра. Всё бесплатно и локально (стоки, озвучка, 3D, инфографика, переходы).
Проверено боем: 7+ роликов V.CODE с итерациями клиента (пекарня, цветочный, продакшн).

**Главная идея — ЗАВОД, а не шаблон.** Каждый ролик собирается заново под свою нишу,
смысл и настроение. Постоянны ТОЛЬКО бренд-константы (лого, цвета, шрифт субтитров,
финальная карточка). Всё остальное — кадры, эффекты, переходы, 3D, инфографика,
грейд, музыка — подбирается под сценарий и НЕ повторяется между роликами.

---

## АРХИТЕКТУРА ЗАВОДА (выполнять по порядку на КАЖДЫЙ ролик)

### Шаг 0. Режиссёрский манифест (перед любым рендером)
Прочитать сценарий и письменно зафиксировать:
- **Ниша и тон**: цветы = нежность/пастель; авто = мощь/тил-оранж; еда = аппетит/тепло;
  бьюти = глянец; стройка = брутал; финансы = чистота/данные.
- **Грейд** под тон (см. `GRADES` в build_reel.py / reference/GRADES.md).
- **Темп**: смена кадра 2.5–3 с; хук в первые 0.5 с (обложка первым кадром).
- **3–5 приёмов ролика** из каталога ниже — РАЗНЫЕ, по смыслу конкретных фраз.
- **Музыка**: новый трек, которого не было в прошлых роликах (ротация — обязательна).

### Шаг 1. Проверка по реестру (запрет повторов)
Открыть `reference/USED_EFFECTS.md`. Правило: **один приём — не чаще 1 раза в 3 ролика**;
**финалы и переходы всегда разные**. Если приём был недавно — взять другой из каталога.

### Шаг 2. Сборка (пайплайн ниже).

### Шаг 3. Чек новизны (перед отправкой)
Спросить себя: «Что зритель видит в этом ролике ВПЕРВЫЕ, чего не было в прошлом?».
Если ответа нет — вернуться к каталогу и заменить повторяющийся блок.

### Шаг 4. Запись в реестр
Дописать в `reference/USED_EFFECTS.md`: дата, ниша, использованные приёмы, переходы,
музыка, грейд. Это память завода — она не даёт скатиться в шаблон.

---

## УСТАНОВКА ОКРУЖЕНИЯ (один раз за сессию)

```bash
sudo apt-get install -y -qq ffmpeg
pip3 install -q edge-tts rembg onnxruntime pillow numpy
cat /root/.ccr/ca-bundle.crt >> $(python3 -m certifi)          # TLS через агент-прокси
# node-модули для моушна (ставить в рабочую папку проекта):
npm i playwright gsap lottie-web three remotion @remotion/cli @remotion/bundler \
      @remotion/renderer @remotion/transitions @remotion/light-leaks @remotion/media \
      gl-transitions maplibre-gl @turf/turf react react-dom
# браузер уже в /opt/pw-browsers/chromium ; НЕ запускать playwright install
export RM_NODE_MODULES="$PWD/node_modules"                     # для transitions_gl.cjs
```

Ключи в `secrets.env` (корень репо): `source secrets.env` перед сетевой работой.
Сеть — ТОЛЬКО через curl с `--cacert /root/.ccr/ca-bundle.crt` (urllib/node fetch идут мимо прокси).

---

## ПАЙПЛАЙН

### 1. Сценарий → сегменты озвучки
5–6 предложений (s1..sN). Текст: числа прописью, без длинных тире, без «не X а Y».
Ударения принудительно через U+0301: те́сто, муки́, догово́р.

### 2. Озвучка с тайм-кодами слов — edge-tts (БЕСПЛАТНО)
`ru-RU-DmitryNeural` (мужской реалистичный), rate="+8%", `boundary="WordBoundary"`
(иначе тайминги слов пустые!). Сохранять `vo/sN.mp3` + `vo/sN.json` со словами
`{w, t, d}` — на них строятся караоке и привязка анимаций к словам. Ретраи 4–5 раз.
Женский голос: `ru-RU-SvetlanaNeural`. (Платный премиум-голос/аватар — HeyGen/Higgsfield,
подключать только по запросу с оплатой; локальный wav2lip даёт слабый рот — НЕ использовать.)

### 3. Стоки — приоритет источников (ключи в secrets.env)
1. **Pexels API** (`PEXELS_API_KEY`) — ГЛАВНЫЙ. Нативные вертикальные:
   `api.pexels.com/videos/search?query=...&orientation=portrait&size=medium&per_page=6`,
   фильтр `height>width & height>=1900`. Скрипт `pipeline/fetch_pexels.py`.
   Фото-фоны: `api.pexels.com/v1/search?...&orientation=portrait`.
2. **Pixabay API** (`PIXABAY_API_KEY`) — запасной видеосток.
3. **Mixkit** — без ключа (video/sfx живы; музыка отдаёт AccessDenied — брать с Freesound).
Скейл любой ориентации: `scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920`.
Отбор кадров: качать 5–6 кандидатов, делать tile-грид (fps=1) и выбирать глазами лучший —
не брать первый попавшийся. Вплетать кадры продакшна (камера, монтаж, площадка) под бренд.

**Звуки/музыка — Freesound API** (`FREESOUND_API_KEY`):
`freesound.org/apiv2/search/text/?query=...&token=...&fields=id,name,duration,previews`
→ качать `previews.preview-hq-mp3` (без OAuth). Музыка целыми треками:
фильтр `duration:[45 TO 180]`, качать через эндпоинт sound (`/sounds/{id}/?fields=previews`).
Держать ротацию — на каждый ролик СВОЙ трек и СВОЙ набор SFX.

### 4. Каталог моушн-приёмов — ВЫБИРАТЬ 3–5 РАЗНЫХ под смысл сценария
Полный список с кодом — `reference/EFFECTS_CATALOG.md`. Кратко по категориям:

**A. Шейдерные переходы (gl-transitions, 125 шт)** — главный «дорогой» вид.
`pipeline/motion/transitions_gl.cjs` прогоняет два кадра склейки через GLSL-переход →
PNG-секвенция поверх stage2. Каждый ролик — ДРУГОЙ набор из 125: WaterDrop, ripple,
doorway, morph, CrossZoom, DreamyZoom, LinearBlur, DefocusBlur, powerKaleido, GridFlip,
cube, InvertedPageCurl, ButterflyWaveScrawler, FilmBurn… (`require('gl-transitions')`).

**B. 3D через three.js** (`pipeline/three/`, все с альфой, `--enable-unsafe-swiftshader`):
- `obj_in_scene.html` — 3D-объект ниши ВНУТРИ живого стокового кадра (контактная тень,
  свет сцены, орбита камеры, параллакс фона). Ставить объект по смыслу: роза, колесо, чашка.
- `model_turntable.html` / `model_alpha_overlay.html` — вращение модели Sketchfab
  (соло или оверлеем на видео).
- `text3d.html` — 3D-типографика (металл, фаски, clearcoat, цветной свет). Кадрировать
  так, чтобы слово влезало в 9:16 (size ≤ 0.95, камера дальше).
- `particles_logo.html` — частицы слетаются в логотип/фигуру ниши.
- `petals3d.html` — пролёт камеры сквозь 3D-туннель частиц (лепестки/деньги/искры под нишу).
- `parallax.html` + `motion/depth_parallax.py` — 2.5D: оживление ЛЮБОГО фото картой
  глубины (Depth-Anything ONNX, локально). Камера не должна влетать глубже лица.
- `map_fly.html` — карта MapLibre, облёт к городу клиента (тайлы OSM качать локально,
  headless не ходит в сеть; можно и Remotion-версия с `@remotion/media`).
ГРАБЛЯ моделей: у моделей с центром вдали от нуля сначала `obj.scale.setScalar(sc)`,
потом `obj.position.copy(center).multiplyScalar(-sc)`. SpecGloss (KHR_materials_pbr…) не
поддержан — override `MeshStandardMaterial({map, side:DoubleSide})` на traverse.

**C. Инфографика Remotion** (`pipeline/motion/infographics.tsx` + `counter_gauge.ts`):
линейный график роста со свечением, пончик-процент, кольцевой гейдж «x3», бар-чарт с
пружинами, счётчики-строки, одометр, слайдер «до/после». Рендер:
`remotion render infographics.tsx <comp> out_dir --sequence --image-format=png
--gl=swiftshader --browser-executable=/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell`.
Разнообразить: в каждом ролике — ДРУГОЙ вид графика под конкретную цифру сценария.

**D. Кинетическая типографика** (`pipeline/motion/kinetic_type.ts`): слова вбиваются
пружиной с blur-шлейфом и ударной волной. НЕ ставить на голый чёрный фон (читается
черновиком) — только поверх кадра/грейда или с фактурным фоном.

**E. Световые лики** (`@remotion/light-leaks`, WebGL): живой `<LightLeak seed hueShift>`
на склейках/выходах вместо статичной текстуры. Рендерить с `--gl=angle`.

**F. Playwright-оверлеи** (`pipeline/overlays*.js`): DOM/canvas анимации с альфой —
стеклянные DM-карточки, инста-пост с лайв-лайками, пин с маршрутом+печать города,
камера-UI (таймкод/REC/фокус), лепестковый дождь, счётчики, чат-переписка, штампы.

**G. Lottie без ключа**: `POST https://graphql.lottiefiles.com/2022-08`
`searchPublicAnimations(query,first){edges{node{jsonUrl downloads}}}` → jsonUrl curl-ом →
рендер lottie-web в Playwright `goToAndStop(frame)` + omitBackground. Сортировать по downloads.

**H. rembg-коллаж** (локально): вырезать объект из кадра → PNG альфа → инста-коллаж,
обложка, композит на бренд-фоне со свечением. Модель `~/.u2net/u2net.onnx` с
`huggingface.co/tomjackson2023/rembg/resolve/main/u2net.onnx`.

**I. Ч/б-панч**: на смешном/ударном моменте кадр на ~0.6 с в нуар (`hue=s=0,eq=contrast=1.3`)
через split+overlay — популярный приём. По смыслу, 1 раз на ролик.

**J. Генерации ZeroGPU** (`HF_TOKEN`, `SSL_CERT_FILE=/root/.ccr/ca-bundle.crt`, дневная квота):
FLUX.1-schnell (кадры), Lightricks/ltx-video-distilled (i2v б-ролл),
multimodalart/wan-2-2-first-last-frame (морф-переход между кадрами). Квоту НЕ жечь на
тесты — одна попытка, при «exceeded» ждать следующего дня. Платно без очередей — fal.ai.

Все анимации ПРИВЯЗЫВАТЬ к словам озвучки (время из json шага 2).
Оверлеи НЕ должны накладываться по времени — разносить и проверять расписание (см. build_reel).

### 5. Обложка — первым кадром (0.30 с)
Стиль аккаунта: жирный заголовок сверху (белый + бренд-строка), драматичный кадр,
бейдж студии. PIL или HTML→скриншот 1080×1920. Всегда РАЗНАЯ композиция.

### 6. Сборка — ТРИ ЭТАПА ffmpeg (`pipeline/build_reel.py`)
НЕ собирать одним мега-графом — плывут тайминги.
1. **stage1**: обложка + шоты (4 режима движения чередуются: zoom-in/out, pan-l/r;
   chromashift-глитч на склейках) + concat + вотермарк лого + прогресс-бар + грейд.
   Шоты могут быть `SEQ:<dir>` (PNG-секвенция как полноэкранный шот — параллакс/3D/карта).
2. **stage2**: gl-переходы (`make_gl_transitions`) + все PNG-оверлеи
   (`setpts=PTS+T/TB`, `overlay=eof_action=pass`). Блик/лик — `format=gbrp`+`blend=screen`.
3. **stage3**: караоке-ASS + аудио-микс.
КРИТИЧНО: всем `-loop 1` картинкам `-framerate 30` и конечный `-t`.

### 7. Караоке-субтитры (ASS, вшиваются в stage3)
Союз Гротеск Bold (`fonts/soyuz.ttf`) 76, строчные, 1 строка 2–3 слова (≤16 симв),
появление по слову. Активное слово — лайм `&H06F89C&`, прошлые белые. Без обводки:
мягкая тень (Shadow 4, BackColour &H78..) + слой свечения (\blur14, alpha &HC8&).
Строки клампятся: конец ≤ старт следующей − 0.05.

### 8. Звук
Голос: amix по adelay + dynaudnorm. Музыка: volume 0.13–0.15 + `sidechaincompress`
от голоса (threshold 0.03, ratio 5) — дакинг. SFX: РАЗНЫЕ whoosh на переходы + смысловые
(cha-ching на деньги, поп на лайк, чайм, затвор). Мастер: `loudnorm I=-14:TP=-1.5` (Instagram).

### 9. Контроль качества
Извлечь 12–15 кадров точным сиком (`ffmpeg -i FILE -ss T`), склеить сеткой, смотреть глазами:
тайминг футажа, субтитры, оверлеи на местах и НЕ внахлёст, цвет не фиолетовый (=сломан blend),
3D-объекты в кадре (не улетели), переходы читаются.

---

## Брендинг (пример V.CODE — менять под клиента)
Чёрный `#0d0d0d`, оранжевый `#e8842a`, лайм-акцент `#9CF806`. Лого `logo_hd.png`.
Шрифты: Союз Гротеск (субтитры), Montserrat Black (цифры/заголовки). Финалка: лого +
CTA-плашка. Под другого клиента — свои цвета/лого/шрифт, механика та же.

## Файлы скилла
- `pipeline/build_reel.py` — оркестратор 3 этапов (эталон-скелет).
- `pipeline/fetch_pexels.py` — отбор вертикальных стоков.
- `pipeline/motion/` — transitions_gl.cjs (gl-переходы), infographics.tsx, counter_gauge.ts,
  kinetic_type.ts, depth_parallax.py (2.5D).
- `pipeline/three/` — 3D-сцены (объект в кадре, турнтейбл, 3D-текст, частицы, туннель,
  параллакс, карта) + three.js рантайм + шрифт.
- `pipeline/overlays*.js` — Playwright-генераторы DOM/canvas оверлеев.
- `fonts/`, `logo_hd.png` — бренд-ассеты.
- `reference/EFFECTS_CATALOG.md` — полный каталог приёмов с кодом.
- `reference/GRADES.md` — грейды под ниши.
- `reference/USED_EFFECTS.md` — реестр запрета повторов (память завода).

## Ограничения / грабли (проверено болью)
- edge-tts моргает — обязательны ретраи; WordBoundary иначе пустой.
- Mixkit music = AccessDenied → музыка с Freesound.
- Sketchfab search иногда `{}` → ретраить/менять query.
- ZeroGPU квота дневная — не долбить.
- headless не ходит в сеть за тайлами/стилями карт — качать локально, поднимать http.server.
- ES-модули three требуют `python3 -m http.server` (file:// режет CORS).
- Remotion: `browser-executable` = headless_shell (обычный chromium не годится);
  light-leaks/effects — `--gl=angle`; остальное — `--gl=swiftshader`.
