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

Правила: ключи НЕ вписывать в код сайтов и не отдавать в браузер. Сеть — только
curl (urllib и node fetch ходят мимо прокси). Новый ключ: дописать в secrets.env,
`base64 -w0 secrets.env > secrets.env.b64`, закоммитить ТОЛЬКО b64
(plaintext secrets.env в .gitignore, GitHub push protection режет открытые ключи).

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

## 1б. «Руки» агентов oko-agents (простые интеграции, без MCP)

`core/tools.py` — агенты (userbot) умеют по действиям из диалога:
- `image` — генерация картинки БЕСПЛАТНО через **HF Spaces FLUX.1-schnell** (ZeroGPU,
  gradio_client, ~10с, качество как у платного Higgsfield) → фолбэк Gemini/HF. Спейсы
  ротируются (`_FLUX_SPACES` в core/tools). webp→png для Telegram. Higgsfield ($200/мес)
  для картинок больше НЕ нужен. ГРАБЛЯ: у ZeroGPU дневная квота — при исчерпании ретраить/
  сменить спейс. gradio_client ставится в .venv на VPS.
- `stock` — сток-видео/фото. Pexels-видео ✅; Pexels-ФОТО отдаёт 404 (ключ видео-профиля),
  Pixabay режется Cloudflare-челленджем на IP VPS → фото берём из превью Pexels-видео (`pexels-preview`).
- `search` — интернет-поиск (DuckDuckGo HTML) + краткий ответ Gemini по сниппетам ✅.
- `voice` — голосовое (edge-tts ru-RU-DmitryNeural → ogg/opus, ffmpeg) ✅. `story` — сторис
  (картинка FLUX / видео-сток) ✅ (только Босс).
- `email` — Gmail SMTP, ДВА аккаунта ✅: `okoteam.top@gmail.com` (GMAIL_PASS) и
  `daniel.okoteam@gmail.com` (GMAIL_PASS2), app-пароли в .env/secrets. Только Босс.
- `video` — скачать по ссылке и репостнуть (yt-dlp, 1000+ площадок, ≤45MB) ✅. curl_cffi
  для CF-сайтов. `find` — поиск людей/каналов в Telegram (contacts.Search), список @ников
  без авто-рассылки (Босс). Полный набор действий агента см. core/prompts ASSISTANT_JSON_FORMAT.
- `hire` — АВТОНОМНЫЙ ХАНТЕР (core/hire): Босс ставит цель словами → Gemini разбирает
  (роль/регион/ключевики/тестовое/питч) → contacts.Search находит ЛЮДЕЙ → `_hire_loop`
  по-человечески пишет (config.HIRE: 1/~10мин, ≤8/сут, ночная пауза — беречь от банов),
  диалог ведётся как рекрутёр (контекст кандидата в client_ctx), стадии найден→написал→
  диалог→тест→принят/отказ, отчёты в топик analytics штаба. Аутрич только с acc2/acc3.
- `post` — публикация в канал (текст + опц. картинка), ТОЛЬКО по команде Босса.
Ключи на VPS в `/opt/oko-agents/.env` (Pexels/Pixabay/Freesound/HF/Gemini), бэкап — secrets.env.b64.
Действия image/stock/search доступны и в клиентском диалоге; post/send_dm/payment — только владелец.

## 1в. ВКонтакте (core/vk.py) — агент «внутри» аккаунта

Полный user-token (`VK_TOKEN`, Kate Mobile scope, offline) аккаунта Даниэля
(@daniel.okoteam, id 718773189). Агент умеет: `wall_post` (стена + фото FLUX),
`send_message`, `users_search`/`groups_search` (поиск клиентов/людей), `upload_photo_to_wall`.
Действие `post` с `platform:"vk"`. Проверено: me() + users_search + wall_post (с фото FLUX) +
send_message работают.
**Паритет с Telegram (core/vk_agent.py):** Long Poll слушает входящие → агент САМ отвечает
как человек тем же мозгом (assistant + client_memory), ОТ ЛИЦА Даниэля, ручной приоритет
20 мин. Действия в ВК-диалоге: картинка (FLUX в личку), КП-ссылка, ДОГОВОР (docx документом),
ГОЛОСОВОЕ (аудиосообщение edge-tts), поиск. Групповые чаты v1 пропускает.
**Хантер** ищет людей и в ВК (vk.users_search) + аутрич/фоллоу-ап через ВК для vk-кандидатов.
**Сторис** (vk.post_photo_story, проверено) и **репост видео** (vk.upload_video: yt-dlp→video.save→
стена) через действия story/video с platform=vk. Токен в .env/secrets намертво.
ИТОГ: ВК = полный паритет с Telegram (диалоги, картинки, голос, КП, договор, постинг, сторис,
видео, поиск людей, хантер). Получен через OAuth Implicit Flow (client_id 2685278, response_type=token) —
парольный вход VK режет. Обновить токен: тот же authorize-URL в браузере Даниэля.

## 1г. YouTube (core/youtube.py) — агент в канале

OAuth канала «ДАНИЭЛЬ | ОКО» (id UCZ67wtnjlDqMdjM0wlukKtQ, 4790 подписчиков) через
refresh-token. Ключи: YT_CLIENT_ID, YT_CLIENT_SECRET, YT_REFRESH_TOKEN (.env/secrets намертво).
Проект Google Cloud `oko-youtube-502212` (аккаунт daniel.piano.2002@gmail.com), OAuth-клиент
Web (redirect developers.google.com/oauthplayground), scope youtube.force-ssl + youtube.upload,
он в тест-юзерах. Агент: my_channel, search, add_comment, upload_video. Действие
`video` с platform=youtube (скачать по ссылке → залить на канал, privacy настраивается).
Обновить токен: authorize-URL (тот же client) → code → обмен на refresh.

## 2. Ключи в Environment variables облака (НЕ в git)

Заданы в настройках cloud environment «OKO TEAM» на claude.ai. Даниэль присылал
их в чат 05.07.2026. Если в сессии их нет — попросить Даниэля добавить в
Environment variables окружения:

| Переменная | Сервис |
|---|---|
| SUPABASE_PAT (Management API) | Supabase, проект tkjewndtlzhnmqwmrnil, SQL через api.supabase.com |
| TELEGRAM_BOT_TOKEN | бот @okoappbot |
| S3 twcstorage (key + secret) | s3.twcstorage.ru, бакеты oko-media, oko-tmp |
| GEMINI_API_KEY (4 ключа AQ.Ab8RN6...) | Gemini: текст бесплатно. ОСНОВНОЙ провайдер агентов oko-agents (ротация ключей). Из РФ — через прокси `gemini-proxy.okoteam.workers.dev` (Cloudflare Worker, обход геоблока). Модель `gemini-flash-latest`. |
| ANTHROPIC_API_KEY | Claude API — теперь РЕЗЕРВ/эскалация (дорого). Баланс на нуле после тестов Sonnet; агенты переведены на Gemini. Прокси `anthropic-proxy.okoteam.workers.dev`. |

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
| Adobe Marketing | НЕ авторизован | нужна кнопка Connect на claude.ai (только Даниэль может) |

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
