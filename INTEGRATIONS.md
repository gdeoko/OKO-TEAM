# OKO TEAM · Паспорт интеграций Claude Code (полный)

Обновлено: 15.07.2026 (Tappio: браузер-агент/сервер, аккаунты IG/YT/TikTok, Hooppy). 08.07.2026 (добавлен ФУЛЛ-ПАК видеоконвейера из чата V.CODE + всё из чата ЗооОпт).
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

## 1b. Браузер-агент и сервер (полный доступ в интернет)

Собственный сервер-агент: логинится в любые сервисы по логину/паролю, постит,
читает коды с почты, ходит на любой сайт — как человек.

| Переменная | Что |
|---|---|
| OKO_VPS_CTRL_URL (=CONTROL_URL) | HTTPS-эндпоинт управления сервером, `.../exec` |
| OKO_VPS_CTRL_TOKEN (=CONTROL_TOKEN) | Bearer-токен к /exec |

- Сервер okoagents.okoteam.top. Запуск команд: POST `{"cmd":"..."}` c `Authorization: Bearer $OKO_VPS_CTRL_TOKEN` на `$OKO_VPS_CTRL_URL/exec`. Обёртка: `tappio-app/factory/vps/vps_exec.py` (`vexec`) или `/tmp/vps.py`.
- Пользователь `okoposter`, в группе **docker** (root-уровень сети через контейнеры), sudo нет. Папка `/opt/oko-poster`, сессии/конфиги в `/opt/oko-poster/cfg`.
- Стелс-браузер **patchright** (форк Playwright, обходит бот-детект) + chromium (`npm i patchright && npx patchright install chromium`).
- Обход IP: `/opt/oko-poster/warp` (wgcf+wireproxy → SOCKS5 WARP), `/opt/oko-poster/ts` (tailscale userspace). Для жёсткого анти-бота (TikTok) нужен резид/моб прокси на аккаунт.

## 1c. Аккаунты Tappio (соцсети) — статус и вход

| Сеть | Логин | Секрет (в secrets.env) | Статус |
|---|---|---|---|
| Instagram | tappio.app.pro (почта okoteam.top@gmail.com = TAPPIO_IG_EMAIL) | TAPPIO_IG_PASSWORD | **ПОДКЛЮЧЕН.** Стелс-вход без прокси, сессия на VPS `cfg/ig_state.json` + профиль `cfg/ig_patchright_profile`. Постинг работает (`ig_post_desktop.mjs`, desktop create flow). Коды входа — с okoteam.top через Gmail-коннектор. |
| YouTube | канал TAPPIO (TAPPIO_YT_CHANNEL_ID) | TAPPIO_YT_CLIENT_ID/_CLIENT_SECRET/_REFRESH_TOKEN | **ПОДКЛЮЧЕН**, официальный Data API. |
| TikTok | @tappio.app (почта tappio.app@gmail.com = TAPPIO_TT_EMAIL) | TAPPIO_TT_PASSWORD, username TAPPIO_TT_LOGIN | Прямой вход с серверного IP блокируется (нужен резид/моб прокси). Подключаем **через Hooppy** (офиц. TikTok OAuth). Код входа на tappio.app@gmail.com — даёт Даниэль. |

Скрипты: `tappio-app/factory/vps/` — ig_patchright.mjs, ig_post_desktop.mjs, ig_verify.mjs, tk_login.mjs, tk_qr.mjs.

## 1d. Hooppy (кросс-постинг бэкенд)

| Переменная | Что |
|---|---|
| HOOPPY_LOGIN / HOOPPY_PASSWORD | Вход в кабинет hooppy.ru |
| HOOPPY_API_TOKEN | Bearer к API |
| HOOPPY_API_BASE | https://api.hooppy.ru/api |

- Браузер-логин: `hooppy_login.mjs` → `cfg/hooppy_session.json`.
- Подключение аккаунтов `/accounts/connect` — офиц. OAuth платформ. TikTok: `tiktok.com/v2/auth/authorize`, redirect `hooppy.ru/oauth/14`, scope `video.upload,video.publish`. Ссылка БЕЗ `state` → привязка по сессии Hooppy (клиенту голую ссылку слать нельзя — нужен свой OAuth со state).
- source_id: 1=VK, 3=Facebook, 9=Telegram-канал, 11=Telegram-юзер, 14=YouTube, 17/18/29=прочее. IG/TikTok source_id — при подключении.
- Даниэль знаком с владельцем Hooppy → возможен безлимит аккаунтов + партнёрский/white-label API (детали в `brain/Claude/Projects/Tappio.md`).


## 1e. Клиенты (мульти-проект) — аккаунты и доступы

Секреты в secrets.env.b64. Пароль в колонке — он же для соцсетей и почты (клиент дал один).
Коды верификации приходят на почту клиента (Gmail-коннектор читает только okoteam.top —
для клиентских почт логинимся в их Gmail стелс-браузером по паролю ИЛИ клиент даёт код).

| Проект | Почта (=Google/YouTube) | Пароль | Instagram | TikTok | Сайт |
|---|---|---|---|---|---|
| **Tappio** | okoteam.top@gmail.com (IG) / tappio.app@gmail.com (TikTok) | TAPPIO_IG_PASSWORD / TAPPIO_TT_PASSWORD | tappio.app.pro (ПОДКЛЮЧЕН) | @tappio.app (в Hooppy) | tappio.pro |
| **Екатерина \| духовное воспитание** | CLIENT_EKAT_EMAIL (ekaterinasbogom@gmail.com) | CLIENT_EKAT_PASSWORD | mama_s_bogom | mama.s.bogom (в Hooppy) | — |
| **DIESEL** | CLIENT_DIESEL_EMAIL (cargo.panda.go@gmail.com) | CLIENT_DIESEL_PASSWORD | diesel_cargo | diesel_cargo (в Hooppy) | dieselcompany.pro (CLIENT_DIESEL_SITE) |

Статус подключения: Tappio IG+YouTube — готово; TikTok всех — через Hooppy (OAuth с телефона).
Екатерина IG+YouTube — ГОТОВО. DIESEL IG+YouTube — ГОТОВО. YT-токены: CLIENT_EKAT_YT_REFRESH_TOKEN/_CHANNEL_ID, CLIENT_DIESEL_YT_* (общий app CLIENT_YT_CLIENT_ID/SECRET=TAPPIO_YT_*).
Переменные клиентов: CLIENT_EKAT_* , CLIENT_DIESEL_* (NAME/EMAIL/PASSWORD/IG/TT[/SITE]).
Бот аналитики/отчётов Екатерины (Метанойя): `@metanoiaorder_bot` («МЕТАНОЙА · analytics») —
`CLIENT_EKAT_ANALYTICS_BOT_TOKEN` / `CLIENT_EKAT_ANALYTICS_BOT_USERNAME`. Сюда social-autopilot
шлёт ежедневный отчёт по контент-заводу Метанойи. TikTok Метанойи: `HOOPPY_TT_PAGE_EKAT` (2352065)
через общий `HOOPPY_API_TOKEN`. Логотип бренда: `brand/metanoia-logo.png` + `brand/metanoia-logo-b64.txt`.


## 2. Ключи в Environment variables облака (НЕ в git)

Заданы в настройках cloud environment «OKO TEAM» на claude.ai. Даниэль присылал
их в чат 05.07.2026. Если в сессии их нет — попросить Даниэля добавить в
Environment variables окружения:

| Переменная | Сервис |
|---|---|
| SUPABASE_PAT (Management API) | Supabase, проект tkjewndtlzhnmqwmrnil, SQL через api.supabase.com |
| TELEGRAM_BOT_TOKEN | бот @okoappbot |
| S3 twcstorage (key + secret) | s3.twcstorage.ru, бакеты oko-media, oko-tmp |
| GEMINI_API_KEY (3 ключа) | Gemini: текст бесплатно, картинки при включённом биллинге |
| ANTHROPIC_API_KEY | Claude API, баланс пополняет Даниэль |

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

---

## Обновление 15.07.2026 — арсенал беспоук-монтажа (из чата «ролик Михаила», гориз. 16:9)

- **Скилл `/reels-machine` → `reference/MOTION_ARSENAL.md`** — полный боевой арсенал:
  библиотека форм вставок (круг/телефон/ромб/шестиугольник/полоса/наклон/арка/TV/…, маски+
  лаймовые кольца в `pipeline/horizontal/shapes/`), раскладки place, движок `anim.js`
  (беспоук-инфографика → webm с альфой), 3D-GLB (three.js + gltf-transform децимация),
  WebGL/Lottie/Spine, звук с SFX по смыслу, законы «ноль статики / лицо не перекрывать /
  контраст затемнением, а не плашкой / микс форм и фулл-экрана». Готовый код —
  `.claude/skills/reels-machine/pipeline/horizontal/` (compose3/drive3/fmts/audio_v2/anim/).
- **КРИТИЧНЫЕ грабли:** webm-альфу читать `-c:v libvpx-vp9` ПЕРЕД `-i` (иначе альфа →
  чёрный прямоугольник); фон.ffmpeg реапается ~2-3мин → резать грейд/4K на куски; база с
  частыми keyframe (`-g 15`) для быстрого seek; чат-лимит 30МБ → хостить Higgsfield
  `media_upload`→PUT curl→`media_confirm`→CDN; zoompan zoom-out/pan даёт ЧЁРНЫЙ кадр —
  фулл-экран движение только crop-pan.

| Интеграция | Что даёт | Заметки |
|---|---|---|
| MIND (MCP `mcp__MIND__*`) | генерация и АНИМАЦИЯ 3D: `start_model_generation`, `start_material_generation`, `start_world_generation`, `animate_generated_model` | альтернатива tripo/Sketchfab для крутящихся 3D-фигур |
| Higgsfield `video_analysis_create`/`_status` | посценовый анализ готового ролика | poll до completed; коннектор бывает нестабилен |
| Higgsfield `virality_predictor` | хук/удержание/виральность | дашборд по загруженному видео |
| Higgsfield `media_upload`+`media_confirm` | хостинг файла → публичный CDN-URL | обход 30МБ-лимита чата; PUT байтов curl'ом |

## Обновление 16.07.2026 — МЕТАНОЙА · контент-завод (движок social-autopilot)

- **Проект:** христианская школа Екатерины «Метанойя». Ведение соцсетей — скилл
  `/social-autopilot` (аналитика → разведка 1М+ → сценарии → humanizer → сборка
  reels-machine → кросс-пост TikTok+IG+YouTube → отчёт в бот). Ниша/тон: духовное
  воспитание, семья, забота, наука о мозге/памяти × вера.
- **Аккаунты** (в secrets как `CLIENT_EKAT_*`): почта/YouTube `ekaterinasbogom@gmail.com`,
  IG `mama_s_bogom`, TikTok `@mama.s.bogom` (Hooppy page `2352065`, source_id 14),
  YouTube channel `UCHQL8pDtCadNY-m1b8H_AaQ` (OAuth: общий `CLIENT_YT_CLIENT_ID/SECRET`,
  `CLIENT_EKAT_YT_REFRESH_TOKEN`). Коды входа IG/TikTok приходят на почту Екатерины.
- **Бот отчётов:** `@metanoiaorder_bot` — `CLIENT_EKAT_ANALYTICS_BOT_TOKEN`.
- **Логотип бренда** (μ + золотые крылья, navy/gold на кремовом): `brand/metanoia-logo.png`,
  data-URI `brand/metanoia-logo-b64.txt`. Не искажать пропорции, не менять цвета.
- **Контент-план:** `КОНТЕНТ-ЗАВОД/` (мастер-бриф, старт-7-дней, план-90-дней),
  контекст проекта — `METANOYA_CONTEXT.txt`. Приложение (снимать демо):
  https://nimble-bean-709.higgsfield.app
- **Правило:** плейнтекст-паспорт с паролями в git НЕ кладём; ключи — только в
  `secrets.env` (коммитим `secrets.env.b64`).
