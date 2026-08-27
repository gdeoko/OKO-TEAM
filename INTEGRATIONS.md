# OKO TEAM · Паспорт интеграций Claude Code (полный)

Обновлено: 08.07.2026 (добавлен ФУЛЛ-ПАК видеоконвейера из чата V.CODE + всё из чата ЗооОпт).
Единый файл всего, что подключено к Claude во всех чатах.
Значения ключей: `secrets.env.b64` (base64, рядом в корне). Расшифровка и загрузка
происходят АВТОМАТИЧЕСКИ при старте каждой сессии (SessionStart-хук в
`.claude/settings.json` пишет source-строку в профиль шелла).
Если переменная не видна в конкретном shell: `source <(base64 -d secrets.env.b64)`.

## 1. API-ключи в secrets.env.b64 (проверены боем)

| Переменная | Сервис | Что даёт | Проверка |
|---|---|---|---|
| HF_TOKEN | Hugging Face (okoteam) | Квоты ZeroGPU: FLUX-кадры, Wan-видео, 3D из фото через gradio_client | `curl -H "Authorization: Bearer $HF_TOKEN" https://huggingface.co/api/whoami-v2` |
| PEXELS_API_KEY | Pexels | Настоящие 4К видео и фото, 200 req/час. Главный видеосток роликов V.CODE (все цветочные кадры j004/j005) | `curl -H "Authorization: $PEXELS_API_KEY" "https://api.pexels.com/videos/search?query=test&per_page=1"` |
| PIXABAY_API_KEY | Pixabay | Запасной видеосток, cdn отдаёт напрямую | `curl "https://pixabay.com/api/videos/?key=$PIXABAY_API_KEY&q=test"` |
| FAL_KEY | fal.ai | Платные генерации 1080p (5-15 руб/клип), Wan/Kling без очередей. Баланс 0 — ждёт пополнения | 404 (не 401) на `curl -H "Authorization: Key $FAL_KEY" https://queue.fal.run/fal-ai/flux/requests/0/status` |
| SKETCHFAB_API_TOKEN | Sketchfab | Download API: тысячи CC 3D-моделей (роза и Studio Camera для роликов взяты отсюда). ГРАБЛЯ 08.07: search иногда отдаёт `{}` — ретраить, менять query | `curl -H "Authorization: Token $SKETCHFAB_API_TOKEN" https://api.sketchfab.com/v3/me` |
| FREESOUND_CLIENT_ID + FREESOUND_API_KEY | Freesound | Звуки CC: вуши, чаймы, cha-ching, поп, эмбиент + ФОНОВАЯ МУЗЫКА целыми треками через preview-hq-mp3 (фильтр `filter=duration:[45 TO 180]`) | `curl "https://freesound.org/apiv2/search/text/?query=engine&token=$FREESOUND_API_KEY"` |
| TWENTY_FIRST_API_KEY | 21st.dev Magic | Библиотека wow-компонентов UI | POST api.21st.dev/api/search, заголовок x-api-key |
| CLOUDFLARE_API_TOKEN + CLOUDFLARE_ACCOUNT_ID | Cloudflare | Хостинг Pages | ОТЛОЖЕНО решением Даниэля 07.07: токену не хватает прав, не поднимать тему |
| HF_S3_ENDPOINT + HF_S3_ACCESS_KEY_ID + HF_S3_SECRET_ACCESS_KEY | HF S3 | Хранилище файлов okoteam (boto3, verify=/root/.ccr/ca-bundle.crt) | list_buckets |
| R2_ENDPOINT + R2_ACCESS_KEY_ID + R2_SECRET_ACCESS_KEY | Cloudflare R2 | S3-хранилище тяжёлых видео/ассетов (из чата ЗооОпт). БЛОКЕР: домен r2.cloudflarestorage.com не в network policy окружения — добавить в allowlist | boto3 list_buckets (сейчас connect 000) |
| SHOTSTACK_SANDBOX_KEY / SHOTSTACK_PROD_KEY | Shotstack (подключён 16.07) | Облачный ПРОГРАММНЫЙ монтаж по JSON: таймлайн, титры, переходы, караоке-субтитры, футаж, музыка → рендер MP4. Ядро «крутого монтажа под ключ», встраивается в reels-machine. Sandbox бесплатный (вотермарк), prod платный. Заголовок `x-api-key`. Endpoints: sandbox `https://api.shotstack.io/edit/stage/render`, prod `.../edit/v1/render`. Ассеты — `.../ingest/{stage}`, шаблоны — `.../edit/{stage}/templates`. | `curl -H "x-api-key: $SHOTSTACK_SANDBOX_KEY" https://api.shotstack.io/edit/stage/render/0000...` → 400 (auth ок), 403 = чужой stage |
| CREATOMATE_API_KEY + CREATOMATE_PUBLIC_TOKEN | Creatomate (подключён 16.07) | Шаблонный видео-рендер по template_id + modifications (соцролики, автоматизация из данных). API key — серверный (Bearer), public token (`public-...`) — для клиентского preview, в браузер отдавать можно. | `curl -X POST -H "Authorization: Bearer $CREATOMATE_API_KEY" -d '{}' https://api.creatomate.com/v1/renders` → 400 «нужен template_id» = ключ ок |

Правила: ключи НЕ вписывать в код сайтов и не отдавать в браузер. Сеть — только
curl (urllib и node fetch ходят мимо прокси). Новый ключ: дописать в secrets.env,
`base64 -w0 secrets.env > secrets.env.b64`, закоммитить ТОЛЬКО b64
(plaintext secrets.env в .gitignore, GitHub push protection режет открытые ключи).

### 1б. Клон голоса Даниэля (студийный PRO) — для озвучки контент-завода
- **ГЛАВНЫЙ: `.claude/skills/reels-machine/pipeline/social/oko_voice_pro.py`**
  `python oko_voice_pro.py "текст" out.mp3 --ref <ref.wav>` — весь конвейер одной командой:
  словарь ударений (`stress_dict.txt`, ОКО→О́КО, формат acute/юникод) → OmniVoice ns=64
  (движок A, лучший тембр) → resemble-enhance RK4/nfe128 (студийная чистота+живость) →
  мастеринг 1.7× + презенс + 44.1кГц. Ударения правим ТОЧЕЧНО (полный ruaccent портит
  естественность — Даниэль выбрал acute на фирменные слова).
- **Безлимит движка A** = HF PRO ($9/мес) на аккаунте okoteam (оформлено 19.07, isPro:True).
- Скрипт-ротатор (фолбэк/бесплатно): `oko_voice.py` — перебирает бесплатные HF-спейсы
  (OmniVoice→VoxCPM→Qwen3→MegaTTS3), берёт доступный по квоте. Длинный текст режется на
  фрагменты и склеивается (ffmpeg) → озвучка ЛЮБОЙ длины.
- Референсы (чистые записи Даниэля без музыки): `.claude/skills/reels-machine/assets/voice/`
  `daniel_ref_15s.wav`, `daniel_ref_28s.wav`. Выбранный движок качества — «A» = OmniVoice.
- Зависит от `gradio_client` + `imageio-ffmpeg` + `HF_TOKEN`. Квота ZeroGPU у каждого
  спейса своя (дневная) — ротатор суммирует → сотни клипов/день бесплатно.
- Готовый пользовательский набор: ZIP `OKO_voice_clone` (Даниэлю отдан в чат 18.07).
- Турбо-режим (платно, копейки, с разрешения): fal.ai TTS — честный безлимит без квот.

## 1а. ВИДЕОЗАВОД reels-machine v6 — фулл-пак (чат V.CODE, проверено боем на j001..j013)

Скилл: `.claude/skills/reels-machine/` (SKILL.md + pipeline/motion + pipeline/three +
reference/ + fonts/ + logo). Публичная версия: **github.com/gdeoko/oko-magic-skill →
skills/reels-machine** (без лицензионных шрифтов/лого клиента).

**v6 — ТРИ ЗАКОНА РАЗНООБРАЗИЯ (читать `reference/DIVERSITY_LAWS.md` ДО сборки):**
1) каждый ролик с нуля под сценарий, анимации/инфографика/беспоук пишутся заново, ассеты
   качаются заново; неизменны только бренд-константы (голос, шрифт+цвет субтитров, лого).
2) 10–14 УНИКАЛЬНЫХ кадров на ролик (клип не повторяется), смена каждые 3–5с, ≥2 бренд-кадра.
3) реестры-память `reference/USED_FOOTAGE.md` + `USED_ANIM.md` запрещают повторы.
**Обложка** — ЦЕЛИКОМ нейросетью **Nano Banana Pro** (Higgsfield, модель `nano_banana_pro`,
Ultra-подписка безлимит), детальный промпт, гамма ЛОГО (оранж `#EA5920`+белый, БЕЗ зелёного),
+ композит реального `logo_hd.png`. Рецепт: `pipeline/cover_nanobanana.md`. Карусели 4:5 — так же.
Субтитры-выделение — оранж `&H2059EA&` (из лого), не зелёный. Higgsfield ТОЛЬКО на обложку/
карусели, кредиты на контент роликов НЕ жжём (всё бесплатно локально). Движки анимаций:
`pipeline/motion/fx_engine.js`(+fx_page.html), `lottie_render.js`, `three/three_render.js`(3D-оверлей).
Бренд-профиль (единственное, что меняем под клиента): `reference/BRAND_PROFILE.md`.
Делает готовый Reels 1080x1920 из сценария уровня топ-монтажёра. АРХИТЕКТУРА ЗАВОДА:
на каждый ролик режиссёрский манифест → проверка реестра `reference/USED_EFFECTS.md`
(приём ≤1 раза в 3 ролика, финалы/переходы всегда разные) → сборка → чек новизны → запись.
Каталог приёмов — `reference/EFFECTS_CATALOG.md`, грейды — `GRADES.md`, ниши — `NICHE_PLAYBOOK.md`.
Новое в v5 (проверено): gl-transitions (125 шейдерных переходов, `pipeline/motion/transitions_gl.cjs`),
2.5D-параллакс из фото (Depth-Anything ONNX, `depth_parallax.py`), 3D-объект внутри
живого кадра / 3D-текст / частицы-в-лого / туннель / турнтейбл (`pipeline/three/`),
инфографика Remotion (график/донат/гейдж/бары/одометр/до-после, `infographics.tsx`+`counter_gauge.ts`),
кинетическая типографика (`kinetic_type.ts`), световые лики (@remotion/light-leaks),
карта-флайовер MapLibre (`map_fly.html`), rembg-коллаж, ч/б-панч.
Аватары/липсинк — только платный HeyGen/Higgsfield по запросу (локальный wav2lip слабый).

### Озвучка и тайминг слов (без ключа)
- **edge-tts 7.2.8** (pip): голос `ru-RU-DmitryNeural`, rate="+8%",
  `boundary="WordBoundary"` (иначе тайминги слов пустые!), ретраи 4-5 раз.
  Ударения — символ U+0301 после гласной (те́сто, муки́).
  SSL: `cat /root/.ccr/ca-bundle.crt >> $(python3 -m certifi)`.

### Стоки (ключи из секции 1)
- **Pexels API** — главный: `orientation=portrait`, фильтр h>=1900, height>width.
- **Pixabay API** — запасной видеосток.
- **Freesound API** — SFX + фоновая музыка (preview-hq-mp3, качается curl'ом без OAuth).
- **Mixkit** — БЕЗ ключа; ГРАБЛЯ 08.07: прямые ссылки assets.mixkit.co/music отдают
  AccessDenied — музыку брать с Freesound; sfx/видео Mixkit проверять поштучно.

### Анимации и графика (все локально, без ключей)
- **LottieFiles GraphQL** — БЕЗ ключа: `POST https://graphql.lottiefiles.com/2022-08`,
  query `searchPublicAnimations(query:"...", first:N){edges{node{jsonUrl}}}` →
  jsonUrl качается curl'ом. Рендер в PNG-секвенцию: lottie-web (node_modules) в
  Playwright-странице, `goToAndStop(frame)` + screenshot omitBackground.
- **Playwright + Chromium** (`/opt/pw-browsers/chromium`, `--no-sandbox`) — фабрика
  PNG-оверлеев с альфой: канвас-анимации (лепестки, 5 видов переходов), DOM-карточки
  (DM-сообщения, инста-пост, пин с маршрутом, камера-UI). Шрифты — base64 @font-face.
- **GSAP** (node_modules) — твины в тех же Playwright-страницах.
- **Remotion 4.0.486** (node_modules) — программные моушн-номера (пружинный одометр,
  кольцевой гейдж х3). Рецепт этой среды: `remotion render entry.ts <comp> out_dir
  --sequence --image-format=png --gl=swiftshader
  --browser-executable=/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell`.
  Шрифты — base64-модуль fonts_b64.ts. Компоненты — React.createElement без JSX.
- **three.js + GLTFLoader** (локальные модули) — 3D-турнтейблы моделей Sketchfab.
  Только через `python3 -m http.server` (file:// режет CORS), флаг
  `--enable-unsafe-swiftshader`. ГРАБЛЯ: у моделей с центром вдали от нуля сначала
  `obj.scale.setScalar(sc)`, потом `obj.position.copy(center).multiplyScalar(-sc)` —
  иначе модель улетает из кадра (так чинилась «невидимая» роза). SpecGloss-материалы
  (KHR_materials_pbrSpecularGlossiness) не поддержаны — override:
  `MeshStandardMaterial({map: texture, side: DoubleSide})` на traverse.
- **rembg локально** — вырезка объектов из кадров (букет для инста-коллажа).
  Модель: `~/.u2net/u2net.onnx`, качать с
  `https://huggingface.co/tomjackson2023/rembg/resolve/main/u2net.onnx` (github 403).

### Генерации ZeroGPU (HF_TOKEN, gradio_client, SSL_CERT_FILE=/root/.ccr/ca-bundle.crt)
- `black-forest-labs/FLUX.1-schnell` — кадры 768x1344, steps=4, api `/infer`.
- `multimodalart/wan-2-2-first-last-frame` — морф между двумя кадрами.
- `Lightricks/ltx-video-distilled` — i2v б-ролл. `KwaiVGI/LivePortrait` — говорящий аватар.
- `Tongyi-MAI/Z-Image-Turbo` — кадры фиксированным seed (конвейер ЗооОпт).
- Квота ДНЕВНАЯ и общая: сожжена — не долбить, ретраить воркером раз в 15 мин.

### Сборка ffmpeg (3 отдельных этапа — мега-граф ломает тайминги)
- Stage1: нарезка шотов (точный `-ss` до `-i` на входе + trim), scale
  `1080:1920:force_original_aspect_ratio=increase,crop`, fps=30, zoompan
  (4 режима движения: зум-ин/аут/пан-лево/право), обложка 1-м кадром, вотермарк,
  оранжевый прогресс-бар, грейд eq+colorbalance+vignette+noise.
- Stage2: PNG-секвенции оверлеев с `setpts=PTS+T/TB` + `overlay=eof_action=pass`;
  переходы поверх всего; блик через `format=gbrp` + `blend=screen` (иначе фиолетовое).
  ВСЕ `-loop 1` картинки строго с `-framerate 30` и конечным `-t` (иначе 25fps
  ломает framesync).
- Stage3: караоке-ASS (Союз Гротеск 76, тень 40-50%, свечение, активное слово
  #9CF806, клампинг строк) + аудио: VO amix→dynaudnorm, музыка volume 0.15 +
  sidechaincompress от голоса, SFX по смыслу, мастер loudnorm I=-14:TP=-1.5.
- QC: точный сик `-i файл -ss T` (наоборот — keyframe-ложь), tile-гриды fps=1.

### Шрифты и бренд V.CODE (в .claude/skills/reels-machine/fonts/)
soyuz.ttf (Союз Гротеск — субтитры), Montserrat Black (цифры), Manrope 800 (подписи),
logo_hd.png. Цвета: #0d0d0d / #e8842a / лайм #9CF806 (акцент, с лого OKO — сам лого
OKO нигде не использовать).

## 2. Ключи в Environment variables облака (НЕ в git)

Заданы в настройках cloud environment «OKO TEAM» на claude.ai. Даниэль присылал
их в чат 05.07.2026. Если в сессии их нет — попросить Даниэля добавить в
Environment variables окружения:

| Переменная | Сервис |
|---|---|
| SUPABASE_PAT (Management API) | Supabase, проект tkjewndtlzhnmqwmrnil, SQL через api.supabase.com |
| TELEGRAM_BOT_TOKEN | бот @okoappbot — ПОЛУЧЕН 16.07, лежит в secrets.env (getMe→okoappbot, проверен) |
| S3 twcstorage (key + secret) | s3.twcstorage.ru, бакеты oko-media, oko-tmp |
| GEMINI_API_KEY (3 ключа) | Gemini: текст бесплатно, картинки при включённом биллинге |
| MUZMIR_GEMINI_KEYS (2 ключа) | «Мозг» чат-бота сайта музыкальный-мир.рф, см. раздел ниже |
| ANTHROPIC_API_KEY | Claude API, баланс пополняет Даниэль |

### Gemini для «Музыкального Мира» — две грабли, на которые уже наступили

Ключи центра лежат на проде в `config.local.php` (`MUZMIR_GEMINI_KEYS`, через
запятую) и в `secrets.env`. Два отдельных проекта Google AI Studio:

| Очередь | Проект | Ключ | Тариф |
|---|---|---|---|
| 1 | OKO FREE (712746390236) | MUZMIR FREE | бесплатный |
| 2 | OKO PAY (oko-team) | MUZMIR PAY | Tier 1 Prepay |

**Порядок в списке — это порядок перебора, и менять его нельзя.** Пока жива
бесплатная квота, центр не платит ни копейки. Когда первый ключ отвечает `429`,
он помечается исчерпанным до конца суток (`settings`, ключ `gemquota:<хеш>`) и до
завтра пропускается — иначе каждое сообщение участника ждало бы лишний отказ.
Назавтра он снова первый: суточные лимиты сбрасываются по календарю. Разговор при
переключении не прерывается, человек ничего не замечает.

Две вещи, из-за которых бот молчал и отвечал шаблонами вместо ответов:

- **Прямой доступ к Gemini из России Google блокирует** — `User location is not
  supported for the API use`. Работать можно только через прокси:
  `MUZMIR_GEMINI_BASE=https://gemini-proxy.okoteam.workers.dev` (путь API тот же).
- **Модель `gemini-2.5-flash` снята с обслуживания** и отвечает 404 любому ключу.
  Рабочая — `gemini-flash-latest` (`MUZMIR_GEMINI_MODEL`).

Проверка живьём: `chat_brain_reply("Какое сегодня число?", ...)` должен ответить
текстом с настоящей датой. Если пришёл общий шаблон про конкурсы — «мозг» не
ответил, смотреть код ответа Gemini.

## 2а. Соцсети OKO — доступы и оперативка (Даниэль, 16.07.2026)

**Все логины/пароли/телефоны/токен бота — в `secrets.env` (переменные `OKO_*` и
`TELEGRAM_BOT_TOKEN`), в открытый паспорт НЕ вписаны.** Публичное:
- Единый никнейм: **daniel.oko.app** (YouTube: **daniel.okoapp**).
- Telegram-канал: https://t.me/gdeoko · бот приложения: **@okoappbot**.
- Аккаунты (логины-почты/телефоны в secrets): TikTok, Instagram, Likee, YouTube,
  ВКонтакте, Telegram. Общие пароли — `OKO_COMMON_PASSWORD_1/2` в secrets.
- Переменные: `OKO_SOCIAL_HANDLE`, `OKO_*_EMAIL`, `OKO_VK_PHONE/PASSWORD`,
  `OKO_TG_PHONE/PASSWORD`, `OKO_TG_CHANNEL`, `OKO_BOT_USERNAME`.

Оперативка (для соцавтопилота):
- **YouTube, ВКонтакте, Telegram** — агент уже залогинен.
- **Likee** — агент залогинен (18.07): вход email+пароль (`OKO_LIKEE_PASSWORD=181202`),
  но submit формы срабатывает только JS-кликом по `.likee-btn.clickable` (не Playwright-клик).
  Профиль браузера: VPS `/opt/oko-poster/cfg/likee_profile`. Постинг работает:
  uploadvideo → setInputFiles → поле «Add video description» (getByPlaceholder) →
  кнопка `.plist-upload` (div, не button) → saveVideo code:0. Ролик выходит через ~30 мин.
- **Instagram** — агент залогинен (18.07) как daniel.oko.app (ds_user_id 14590089612).
  ВАЖНО: reCAPTCHA Enterprise появляется ТОЛЬКО в headless — вход делать **headed через
  xvfb**. Форма грузится, submit по Enter (у IG кнопки — div, не button). На новом
  устройстве IG просит подтверждение → Даниэль одобряет в приложении → сессия проходит.
  Профиль: VPS `/opt/oko-poster/cfg/ig_oko_profile`, стейт `cfg/ig_oko_state.json`.
  Грабли: веб-создатель постов (create → Далее) отдаёт «Произошла ошибка» — НЕ через веб.
  РАБОЧИЙ ПОСТИНГ: instagrapi по sessionid из ig_oko_state.json →
  `.claude/skills/reels-machine/pipeline/social/ig_photo_post.py <img> <caption>`
  (фото — photo_upload; рилс — clip_upload, см. VPS ig_post_reel.py). Проверено 18.07:
  пост https://www.instagram.com/p/Da73MxFCWtP/ опубликован через instagrapi.
- **TikTok** — вход через Hooppy.ru; прямой вход агента не идёт (нужен человеческий IP).
- **VK-пароль** Даниэль просил обновить — при работе с VK сверять/менять.
- Приглашение в MAX-мессенджер (max.ru/join/...) прислано — вступать по запросу.

## 3. MCP-коннекторы (подключаются на claude.ai -> Settings -> Connectors)

| Коннектор | Статус | Что даёт |
|---|---|---|
| Higgsfield | работает | генерация фото/видео/3D (кредиты), хостинг сайтов с публичной ссылкой |
| Hugging Face | работает (okoteam) | поиск моделей/спейсов; генерации напрямую через gradio_client |
| GitHub | работает | PR, issues, CI, пуш в репозитории |
| Gmail | работает | письма, черновики, ярлыки |
| Figma | работает | макеты в обе стороны, скриншоты, диаграммы |
| Canva | работает | дизайны, экспорт, бренд-шаблоны |
| Adobe for creativity | работает | обработка изображений, PDF, шрифты, Express |
| Magic Patterns | работает | генерация UI |
| Zapier | работает | 9000+ приложений через actions |
| Zoom | работает | записи и саммари встреч |
| Claude Code Remote | работает | окружения, Routines (расписания), send_later |
| Descript | работает (подключён 16.07) | МОНТАЖ видео по промптам: import_media, prompt_project_agent (тримминг, перестановка, удаление слов-паразитов, субтитры, сток), publish → share URL |
| HyperFrames by HeyGen | работает (подключён 16.07) | моушен-графика/анимированные слайды из HTML → render_video (MP4/WebM/MOV). compose/render только из hosted-клиента (claude.ai), из CLI — read-only |
| Shutterstock | работает (подключён 16.07, без ключа) | поиск стока image/video/music/sfx, отдаёт preview mp4/webm 4K. Read-only (без лицензирования/скачивания) |
| Brandfetch | работает (подключён 16.07) | бренд-ассеты: brand_search, get_brand, логотипы/иконки/символы через CDN, цвета/шрифты бренда |
| Google Drive | работает (подключён 16.07) | хранилище: search_files, read/download, create_file. Импорт медиа в Descript принимает Drive share-ссылки как есть |
| Adobe Marketing | НЕ авторизован | нужна кнопка Connect на claude.ai (только Даниэль может), про рекламные кампании — не про монтаж |

## 4. Скиллы (.claude/skills, собраны со ВСЕХ чатов)

- **oko-magic — ГЛАВНЫЙ**: производственный регламент любой задачи, все пайплайны
  и грабли среды. Читать первым.
- **reels-machine — ВИДЕОЗАВОД V.CODE**: весь конвейер роликов из раздела 1а
  (стоки, озвучка, караоке, оверлеи, Remotion/3D/Lottie/rembg, 3-этапный ffmpeg).
- Медиа и генерация: gemini-media, remotion-video (рецепт рендера этой среды: обёртка headless_shell + --gl=swangle, дописан в конец его SKILL.md; смоук-MP4 пройден), banner-design, design,
  design-system, theme-factory, slides, web-fx, motion-ui.
- UI/UX: ui-ux-pro-max, ui-styling, frontend-design, frontend-design-direction,
  frontend-patterns, frontend-a11y, react-patterns, react-performance,
  web-artifacts-builder, webapp-testing, expo-ui, expo-deployment, upgrading-expo,
  native-data-fetching.
- Маркетинг и бренд: brand, brand-guidelines, seo (на ветке
  github-marketing-skills ещё: content-matrix, content-strategy, copywriting).
- Процесс: brainstorming, writing-plans, executing-plans, test-driven-development,
  systematic-debugging, verification-before-completion, karpathy-guidelines,
  api-design, deployment-patterns, dispatching-parallel-agents,
  subagent-driven-development, using-git-worktrees, using-superpowers,
  receiving-code-review, requesting-code-review, finishing-a-development-branch,
  skill-creator, writing-skills.

## 5. Хостинг и деплой

- Higgsfield websites: ЗооОпт spicy-panther-317 (id 5c654873...),
  OKO true-journey-418 (id 5426760c-49ec-46c4-b3ff-b22a6dd598a5),
  V.CODE контент-план vcode-plan (id d324f5e0-6f16-488c-9d21-8fec0a4652c5,
  https://vcode-plan.higgsfield.app),
  PandaGo превью forest-beach-360 (id 96269fa0-7465-4a92-89d5-bdc51f4cec87).
  deploy_website: таймаут 60с это норма, проверять curl-маркером
  (`<meta name="build">`). Хостинг НЕ отдаёт Range: видео на сайтах грузить
  fetch->blob, иначе Safari не играет.
- Прод PandaGo: FastPanel клиента, zip в чат (config.php с сервера не перезаписывать).
- Supabase: база OKO, 28 таблиц. SQL только через Management API (порт 5432 закрыт).

### Бесплатные зеркала-хостинг без аккаунтов (проверено 08.07, чат ЗооОпт)
Схема: push статики в ПУБЛИЧНЫЙ GitHub-репо → постоянная ссылка
`https://rawcdn.githack.com/<owner>/<repo>/<commit-sha>/<path>/index.html`
(привязана к коммиту, CDN кэширует навечно; большие файлы отдаются 301 на raw.githubusercontent — браузеры ок).
Короткие ссылки: `curl "https://tinyurl.com/api-create.php?url=..."`.
Живые зеркала ЗооОпт (репо gdeoko/oko-magic-skill, ветка `sites`, commit 4858473):
- маркет v4-фильм: https://tinyurl.com/22cyfoj2
- космос v3 (3D-скролл): https://tinyurl.com/28jry3nq
Основной live ЗооОпт: https://spicy-panther-317.higgsfield.app (curl-маркер `zoopt-v4-film`).
jsDelivr для HTML НЕ годится (text/plain). Cloudflare Pages — токен без прав (отложено).

### Публичный репозиторий
gdeoko/oko-magic-skill — витрина скиллов OKO (MIT), два скилла:
- `skills/oko-magic` — веб-студия (сайты, 3D-скролл, генерации) + ветка `sites` с зеркалами.
- `skills/reels-machine` — видеозавод роликов (публичная версия, README EN/RU, BRAND_SETUP).
Создать НОВЫЙ репо через сессию нельзя (GitHub App без прав, «sessions bound to repos»).
Публиковать сюда: `add_repo gdeoko/oko-magic-skill` → clone → добавить в `skills/` → push main.

## 6. Как это попадает в каждый чат

1. Файлы `secrets.env.b64` + `.claude/settings.json` (хук) + `.claude/skills/` +
   этот паспорт лежат на дефолтной ветке репозитория — каждый НОВЫЙ чат клонирует
   их автоматически.
2. SessionStart-хук расшифровывает ключи и подключает их к шеллам сессии.
3. CLAUDE.md указывает на этот файл — Claude читает его в начале работы.
4. Память проектов: `brain/Claude/Projects/`, сессии: `brain/Claude/Sessions/`.

### Конвейер «фильм» ЗооОпт (статус 08.07)
Кадры: Z-Image-Turbo (`Tongyi-MAI/Z-Image-Turbo` /generate, seed фикс, '1280x720 ( 16:9 )').
Кириллица на вывесках косячит — чинится типографикой PIL (Unbounded-Bold + glow-слои).
Видео: `multimodalart/wan-2-2-first-last-frame` (влёт фасад→интерьер) +
`zerogpu-aoti/wan2-2-fp8da-aoti-faster` i2v (лупы: пёс идёт, кот играет, рыбки, корм из пачки).
Сжатие: ffmpeg -crf 26 -g 4 (плавный scrub) -movflags +faststart, цель <3MB.
Страница v4 подхватывает mp4 АВТОМАТИЧЕСКИ (assets/scene_*.mp4), код не трогать.
Фоновый воркер: scratchpad/film/worker.py — ретраит по квоте каждые 15 мин.
БЛОКЕР: ZeroGPU-квота сожжена, fal.ai баланс 0 (оба ключа), Higgsfield 0.5 кр.

## 7. Что может добавить только Даниэль (опционально)

1. GEMINI_API_KEY и ключи инфраструктуры OKO -> в Environment variables окружения.
2. Adobe Marketing: кнопка Connect в коннекторах claude.ai.
3. Кредиты Higgsfield: 4К-апскейл видео, 3D из фото.
4. Mixamo: разово скачать FBX-пак персонажей вручную и прислать в чат.
5. Cloudflare Pages: отложено, не поднимать.

## VPS-агент OKO как «руки» для скачивания/аналитики (V.CODE и др.)
- Endpoint `OKO_POSTER_URL` (`.../poster/exec`) + `OKO_POSTER_TOKEN` — выполняет
  shell на VPS `okoposter@msk-1-vm` (чистый IP). Установлены yt-dlp+curl_cffi+ffmpeg,
  залогиненный Chrome-профиль `/opt/oko-poster/profile` (IG-стелс).
- Обёртка: `vcode/vps.py` — `meta <url>` (views/likes/comments), `dl <url> out.mp4`
  (скачать+забрать base64 ≤45МБ), `exec '<sh>'`. Проверка: `python3 vcode/vps.py meta "<yt-url>"`.
- Грабли: полный `yt-dlp -J` не влезает в канал exec — извлекать поля НА VPS;
  TikTok иногда пусто (ретрай); IG без кук закрыт (нужен `--cookies-from-browser chromium:/opt/oko-poster/profile`).

## XTTS-v2 — озвучка роликов (локальный клон голоса, бесплатно)
- Основной голос роликов V.CODE: мужской, клон тембра по образцу `ref_male.wav`.
- Обёртка: `.claude/skills/reels-machine/pipeline/motion/xtts_voice.py` — `say(text,out,ref)`;
  XTTS-v2 если доступен, иначе фолбэк edge-tts (ru-RU-DmitryNeural, +8%, WordBoundary для караоке).
- Установка (изолированный venv, обход конфликтов torchcodec/coqpit/transformers):
  `python3 -m venv xtts-venv && xtts-venv/bin/pip install torch==2.4.1 torchaudio==2.4.1
   --index-url https://download.pytorch.org/whl/cpu && xtts-venv/bin/pip install coqui-tts==0.25.3`
  (даёт coqpit-config 0.1.2 + transformers 4.46.2; НЕ torch≥2.9 — иначе тянет torchcodec).
  Путь к python задаётся `XTTS_PY`. Первый запуск качает модель ~1.8ГБ (COQUI_TOS_AGREED=1).
- Скорость на CPU: загрузка модели ~33с, ~14с на короткую фразу. Референс — чистый wav 22050/моно.
- Грабли: coqui-tts<0.25 тянет старый `coqpit` (падает на типах Py3.11); нужен spacy→`click`.

## ChatGPT Pro — генерация картинок браузером агента (23.08.2026)

Подписка ChatGPT оплачена Даниэлем, тариф `prolite` (Pro). Ключа API нет и не нужен:
работаем веб-кабинетом через браузер агента на VPS, как с Runway. Из Москвы кабинет
открывается напрямую, туннель не нужен. `curl` на chatgpt.com всегда отдаёт 403 —
это защита от не-браузеров, не блокировка страны, проверять только браузером.

Что даёт: генерация картинок (`image_gen_tool_enabled`, DALL·E 3), GPT-5 Pro для текста.
Отдаёт PNG 1536x1024. Качество на уровне референсов заказчика, проверено первой сборкой
кабины Rocket CDN.

Вход: аккаунт `okoteam.top@gmail.com` через кнопку «Continue with Google». Сессия Google
в профиле браузера живая, вход проходит без пароля и капчи.

Драйвер: `/opt/oko-poster/gpt_image.mjs` на VPS.

    cd /opt/oko-poster
    node gpt_image.mjs <файл-с-промптом> <куда.png> [ждать-секунд]

Промпт кладём в файл, а не в аргумент: он длинный, вставляется через буфер обмена.
По правилу проекта — от 2000 знаков, на английском, со сценой, материалами, светом,
объективом, композицией и цветами в HEX.

Грабли, на которые уже наступили:
- Картинка приходит адресом `chatgpt.com/backend-api/estuary/content?...`, а не
  `oaiusercontent`. Ловить по нему плюс `naturalWidth >= 512`.
- Скрипты через CDP плодят вкладки. Закрывать за собой, иначе браузер зарастает
  (набралось 20 штук за один заход).
- Мост `vexec` режет ответ на 120 000 знаков. Большие файлы забирать кусками или
  уменьшать превью перед base64.
- Запускать генерацию только отвязанным процессом (`nohup ... &` без удержания
  соединения): один кадр идёт две-пять минут, мост столько не ждёт.

### Кабинет ЖИВ, дело было в селекторе (24.08.2026)

Запись ниже про «ответ не приходит НИКОГДА» оказалась ошибкой замера, а
не поломкой. Кабинет отвечает и рисует: правка кадра рубки приходит за
55-75 секунд. Что было не так:

- Ответ в новом интерфейсе НЕ помечен `data-message-author-role="assistant"`.
  Драйвер искал картинку внутри этого узла, не находил ничего и писал
  «ответа ещё нет» при готовом ответе на экране. Свой снимок узнавать по
  подписи: `img[alt^="Generated image"]`, у вложения там имя файла.
- Выходы соксов не равны: 10840 (31.56.185.77) сейчас отбивается
  Cloudflare («Just a moment...»), 10811 (166.1.62.114) проходит.
  Браузер на порту **9222** ходит через 10811 и работает, на 9333 - нет.
  Проверять браузером, `curl` на chatgpt.com всегда 403.

Драйвер правки с вложением: `/opt/oko-poster/gpt_edit.mjs`

    cd /opt/oko-poster
    CDP_URL=http://127.0.0.1:9222 nohup node gpt_edit.mjs \
      <картинка> <файл-с-задачей> <куда.png> 600 > лог 2>&1 &

Кладёт файл прямо в `input[type=file]` (кнопку не трогает), ждёт образец
вложения, вставляет задачу через буфер, шлёт, ловит картинку. Забрать
готовую из беседы отдельно: `node cab/grab.mjs <кусок-адреса> <куда.png>`.

Чем это пригодилось: пульт рубки Rocket CDN очищен от нарисованных
кнопок и экранов настоящей правкой кадра, а не размывом.

### ChatGPT перестал отдавать картинки, 23.08.2026 вечером

Кабинет закрылся в тот же день, что и открылся. Замеры живьём:

- Прямой выход сервера отбивается Cloudflare и по шестой версии адреса
  (`2a03:6f00:a::2:def2`), и по четвёртой (`104.171.132.45`): страница
  «Unable to load site». Принудительный IPv4 правилом резолвера Chrome
  (`startbrowser4.sh`) не помогает - блокируется сам адрес сервера.
- Через нидерландский сокс 10840 и американский 10811 страница
  открывается, вход живой, тариф Pro на месте, сообщение уходит. Ответ
  не приходит НИКОГДА: висит синяя точка и `stop-button`, элемент ответа
  пустой. Проверено на задаче в 87 знаков «нарисуй яблоко» - четыре
  минуты пустоты. Значит дело не в длине промпта и не в модели: сокс
  ломает поток ответа, а не загрузку страницы.
- Переключателя модели в новом кабинете нет вовсе, `?model=` в адресе
  не действует. Меню «плюс» отдаёт только вложения и поиск по плагинам.

Разбираться дальше: нужен выход, который держит длинные потоки (SSE), а
не только открывает страницу. Пока такого нет, кадры берём ZeroGPU.

Диагностика теперь встроена: `/opt/oko-poster/gpt_image2.mjs` пишет в
журнал ответ модели раз в минуту и кладёт снимок вкладки при неудаче.
Первая редакция молчала строкой «картинка не появилась», и по ней нельзя
было понять ничего.

### Кабинет ChatGPT снова работает, 25.08.2026

Вчерашняя запись «ответ не приходит НИКОГДА» верна только для браузера
на порту 9333 (профиль `google_nl`, сокс 10840): его выход Cloudflare
теперь отбивает, страница встречает «Just a moment...».

Рабочий путь - **браузер на порту 9222**: профиль `/opt/oko-poster/profiles/google`,
сокс `127.0.0.1:10811`, выход 166.1.62.114. Кабинет открыт, вход живой,
поле ввода и вложения на месте, ответ приходит за одну-две минуты.

    CDP_URL=http://127.0.0.1:9222 node gpt_edit.mjs <вложение> <файл-задачи> <куда.png> [секунд]

Новый драйвер `/opt/oko-poster/gpt_edit.mjs` отличается от `gpt_image2.mjs`
тем, что перед отправкой кладёт в поле ФАЙЛ. Это нужно, когда просим не
нарисовать заново, а переделать имеющийся кадр. Поле спрятано за
кнопкой, но есть в разметке: `input[type=file]` заполняем напрямую,
кнопку не трогаем. Картинку из ответа ловим только внутри
`[data-message-author-role="assistant"]`, иначе подхватывается своё же
вложение.

Грабли:
- **Пропорции берутся от вложения, а не от текста.** Просьба «сделай
  4:3» на широком образце не работает вовсе: кабинет отдаёт ту же
  ширину. Нужен образец нужной формы - сначала получить кадр 4:3, потом
  править уже его.
- Вкладки за собой закрывать: `cab/clean.mjs` на VPS. Двадцать штук за
  заход набегает быстро, и следующий запуск падает с «Target page,
  context or browser has been closed».
- Прогон отвязанным процессом (`nohup ... &`): один кадр идёт две-пять
  минут, мост столько не ждёт.

Чем сделано в этот заход: три кадра рубки (широкий, 4:3, телефон) с
пустым пультом под свои кнопки и дальний план звёздного неба
(`rocketcdn/assets/gen/deep-sky.webp`, 301 КБ).

## ZeroGPU: кадры рубки, когда всё остальное закрыто (23.08.2026)

Единственный путь генерации, который в этот день работал: Spaces
`black-forest-labs/FLUX.1-dev` (28 шагов) и `FLUX.1-schnell` (4 шага)
через `gradio_client` с `HF_TOKEN`. Бесплатно, из облачной сессии
Claude напрямую, без сервера и без браузера.

    pip install gradio_client
    source <(base64 -d secrets.env.b64)
    python3 rocketcdn/tools/cabflux.py широкая 3

Грабли: у FLUX текстовая часть обрывается около 512 токенов, поэтому
промпт держим в полторы тысячи знаков, а не в четыре с половиной, как
для ChatGPT. Длинный промпт не ошибка, просто хвост не читается.

Заодно проверено и закрыто в тот же день:
- Higgsfield: 0.58 кредита, `nano_banana_pro` безлимит не поддерживает.
- Gemini (`gemini-2.5-flash-image` через `gemini-proxy.okoteam.workers.dev`):
  платный ключ - 429 «prepayment credits are depleted», бесплатный - 429
  по квоте.
- HF Inference Providers (fal-ai, replicate, wavespeed через router):
  это платные провайдеры со счётом на аккаунт HF, не ZeroGPU. Не трогаем
  без разрешения Даниэля.

## ElevenLabs — звуковые эффекты для сайтов и роликов (27.08.2026)

Тариф Creator, оплачен 20.08.2026, аккаунт `okoteam.top@gmail.com`, рабочее
пространство «OKO's Workspace». Проверено боем: банк из 26 эффектов для сайта
Rocket CDN снят целиком за один заход.

Ключ `ELEVEN_KEY` лежит только на VPS, в `/opt/oko-poster/cfg/secrets.env`, и
наружу его не выносим: генерация идёт там же, в репозиторий приезжает готовый
звук. Рядом `ELEVEN_LOGIN`, `ELEVEN_PAROL`, `ELEVEN_SOCKS`, `ELEVEN_MODEL`.

**Про страну.** Российский адрес ElevenLabs не пускает. Ходить в API только
через нидерландский выход `127.0.0.1:10840`:

    curl --socks5-hostname 127.0.0.1:10840 https://api.elevenlabs.io/v1/user/subscription \
         -H "xi-api-key: $ELEVEN_KEY"

Отдаёт тариф и остаток символов. На 27.08.2026 было израсходовано 4 894 из
295 684, и целый банк эффектов этот счётчик не сдвинул: эффекты считаются
отдельно от речи.

**Генерация эффекта.** `POST https://api.elevenlabs.io/v1/sound-generation`,
тело `{"text": "...", "duration_seconds": 2.0, "prompt_influence": 0.55}`, для
петли добавить `"loop": true`. Отдаёт `audio/mpeg` 128 кбит стерео.

Промпт пишем по-английски и описываем звук, а не предмет: из чего он состоит,
какая атака, какой хвост, сухо или с залом. В конце обязательно `no music,
no voice` — иначе модель подкладывает подложку. `prompt_influence` около 0.5
держит золотую середину: выше — буквальнее и суше, ниже — красивее и мимо.

**Готовые скрипты на VPS**, `/opt/oko-poster/rcsnd`:

    bash run.sh              # весь банк по списку из rcsnd_bank.py
    bash run.sh click hyper  # только названные, остальные не трогает
    bash post.sh             # сведение в моно 80 кбит + таблица замеров

`rcsnd_bank.py` пропускает то, что уже лежит в `out/`, так что перегенерация
одного эффекта не тратит остальные. `post.sh` печатает по каждому файлу
длину, пик и RMS — пустышку и перегруз видно сразу, без прослушивания.

Кабинет: https://elevenlabs.io/app/sound-effects, вход через «Continue with
Google» в браузере агента, сессия живая. Там же История и Избранное — можно
слушать и переснимать руками.

## Envato и Runway — что уже открыто в браузере агента (27.08.2026)

Один и тот же профиль Chrome на VPS (`/opt/oko-poster/profiles/google`, порт
отладки 9222) держит живые сессии: ChatGPT и Envato под `okoteam.top@gmail.com`,
Runway под `claude.okoteam@gmail.com`. Пароли спрашивать не нужно, вход уже
пройден. Подключаться из любого чата:

    import pkg from "/opt/oko-poster/node_modules/playwright-core/index.js";
    const b = await pkg.chromium.connectOverCDP("http://127.0.0.1:9222");
    const p = await b.contexts()[0].newPage();

Envato отдаёт шаблоны After Effects, звук и графику по подписке; каталог
живёт на `app.envato.com`. Готовые примеры вызовов лежат рядом в
`/opt/oko-poster/_env_poisk.mjs` и `_env_kredit.mjs`.
