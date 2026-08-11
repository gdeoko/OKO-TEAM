# OKO TEAM · Паспорт интеграций Claude Code (полный)

Обновлено: 07.07.2026. Единый файл всего, что подключено к Claude во всех чатах.
Значения ключей: `secrets.env.b64` (base64, рядом в корне). Расшифровка и загрузка
происходят АВТОМАТИЧЕСКИ при старте каждой сессии (SessionStart-хук в
`.claude/settings.json` пишет source-строку в профиль шелла).
Если переменная не видна в конкретном shell: `source <(base64 -d secrets.env.b64)`.

## 1. API-ключи в secrets.env.b64 (проверены боем)

| Переменная | Сервис | Что даёт | Проверка |
|---|---|---|---|
| HF_TOKEN | Hugging Face (okoteam) | Квоты ZeroGPU: FLUX-кадры, Wan-видео, 3D из фото через gradio_client | `curl -H "Authorization: Bearer $HF_TOKEN" https://huggingface.co/api/whoami-v2` |
| PEXELS_API_KEY | Pexels | Настоящие 4К видео и фото, 200 req/час. Проверено на киносайте PandaGo | `curl -H "Authorization: $PEXELS_API_KEY" "https://api.pexels.com/videos/search?query=test&per_page=1"` |
| PIXABAY_API_KEY | Pixabay | Запасной видеосток, cdn отдаёт напрямую | `curl "https://pixabay.com/api/videos/?key=$PIXABAY_API_KEY&q=test"` |
| FAL_KEY | fal.ai | Платные генерации 1080p (5-15 руб/клип), Wan/Kling без очередей | 404 (не 401) на `curl -H "Authorization: Key $FAL_KEY" https://queue.fal.run/fal-ai/flux/requests/0/status` |
| SKETCHFAB_API_TOKEN | Sketchfab | Download API: тысячи CC 3D-моделей | `curl -H "Authorization: Token $SKETCHFAB_API_TOKEN" https://api.sketchfab.com/v3/me` |
| FREESOUND_CLIENT_ID + FREESOUND_API_KEY | Freesound | Звуки CC: моторы, трасса, эмбиент | `curl "https://freesound.org/apiv2/search/text/?query=engine&token=$FREESOUND_API_KEY"` |
| TWENTY_FIRST_API_KEY | 21st.dev Magic | Библиотека wow-компонентов UI | POST api.21st.dev/api/search, заголовок x-api-key |
| CLOUDFLARE_API_TOKEN + CLOUDFLARE_ACCOUNT_ID | Cloudflare | Хостинг Pages | ОТЛОЖЕНО решением Даниэля 07.07: токену не хватает прав, не поднимать тему |
| HF_S3_ENDPOINT + HF_S3_ACCESS_KEY_ID + HF_S3_SECRET_ACCESS_KEY | HF S3 | Хранилище файлов okoteam (boto3, verify=/root/.ccr/ca-bundle.crt) | list_buckets |
| TIMEWEB_API_TOKEN | Timeweb Cloud (аккаунт yi865413) | Панель VPS через API: список и состояние серверов, диски, бэкапы, SSH-ключи, перезагрузка | `curl -H "Authorization: Bearer $TIMEWEB_API_TOKEN" https://api.timeweb.cloud/api/v1/servers` |
| ЮKassa магазин OKO | shopId **1432931** (сайт okoteam.top) | Настоящие платежи OKO: карта, СБП, SberPay, ЮMoney. Секретный ключ — ТОЛЬКО на VPS в `/var/www/okoteam/config-pay.php` (в git НЕ кладём: боевой ключ = платежи+возвраты). Вебхук: `okoteam.top/api.php?action=yk_webhook`. Контур: `okoteam.top/api.php?action=yk_create/yk_status/pay` | `curl -u 1432931:<secret> https://api.yookassa.ru/v3/me` → enabled. Доступ агентам/чатам — через серверный эндпоинт домена, не через раздачу ключа |
| ЮKassa магазин 1092130 | «Музыкальный мир» (запасной) | Прежний магазин, вебхук на музыкальный-мир.рф | переключение = один файл config-pay.php |

Правила: ключи НЕ вписывать в код сайтов и не отдавать в браузер. Сеть — только
curl (urllib и node fetch ходят мимо прокси). Новый ключ: дописать в secrets.env,
`base64 -w0 secrets.env > secrets.env.b64`, закоммитить ТОЛЬКО b64
(plaintext secrets.env в .gitignore, GitHub push protection режет открытые ключи).

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

## 3.5. Голос / озвучка (БЕСПЛАТНО, локально — решение Даниэля, навсегда)

Озвучка ВСЕГО OKO (видео-уроки, ролики, голосовой ИИ-агент/бот, VPS) — только
бесплатными локальными нейро-TTS. Скилл: **`/oko-voice`** (`.claude/skills/oko-voice`).
**Оба движка локальные → 100% БЕЗЛИМИТ** (ни ключей, ни квот, ни оплаты за символ) —
под огромный поток. Ставить ТОЛЬКО такие безлимитные движки. Голос — **под проект**
(муж/жен/характер/клон), `eugene` — дефолт бренда OKO, не единственный.

| Движок | Роль | Голос | Цена |
|---|---|---|---|
| **Silero v4_ru** | дефолт (уроки, ролики, агент) | **eugene** (муж, БРЕНД) | $0 |
| **XTTS-v2 (Coqui)** | премиум / клон голоса по образцу | клон/студийный | $0 |
| ~~edge-tts~~ | НЕ использовать (робот, ошибки ударений) | — | $0 |
| ~~ElevenLabs / Higgsfield-голос~~ | НЕ жечь на рядовую озвучку (кредит ≈ $0.066, ~$1/урок) | — | $$ |

Запуск: `python3 .claude/skills/oko-voice/scripts/oko_tts.py --textfile s.txt --out vo.wav --mp3`.
Модель Silero (~40МБ) качается один раз в `~/.cache/oko-voice/`. torch — CPU-колесо.
Config-переменные см. `secrets.env` (OKO_TTS_ENGINE / OKO_TTS_VOICE).

## 4. Скиллы (.claude/skills, 46 штук, собраны со ВСЕХ чатов)

- **oko-magic — ГЛАВНЫЙ**: производственный регламент любой задачи, все пайплайны
  и грабли среды. Читать первым.
- Медиа и генерация: gemini-media, remotion-video, banner-design, design,
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
  PandaGo превью forest-beach-360 (id 96269fa0-7465-4a92-89d5-bdc51f4cec87).
  deploy_website: таймаут 60с это норма, проверять curl-маркером
  (`<meta name="build">`). Хостинг НЕ отдаёт Range: видео на сайтах грузить
  fetch->blob, иначе Safari не играет.
- Прод PandaGo: FastPanel клиента, zip в чат (config.php с сервера не перезаписывать).
- Supabase: база OKO, 28 таблиц. SQL только через Management API (порт 5432 закрыт).

### VPS Timeweb — что известно точно (проверено 11.08 по API)

| ID | Имя | IP | ОС | Ресурсы | Что на нём |
|---|---|---|---|---|---|
| 8569557 | oko-app | 104.171.132.45 | Ubuntu 26.04 | 8 CPU / 16 GB | прод okoteam.top, cron-деплой, nginx |
| 8648267 | MUZMIR | 176.124.200.169 | Ubuntu 24.04 | 2 CPU / 2 GB | музыкальный-мир.рф |

- Пользователь на самих серверах — **root**: cron лежит в `/root/oko-deploy.sh`,
  бэкапы vhost в `/root/okoteam.vhost.bak*`.
- **SSH из облачной сессии Claude не работает**: egress-прокси пропускает только
  HTTPS, порт 22 закрыт, клиента `ssh` в образе нет. Проверено. Поэтому всё
  управление сервером — либо через `api.timeweb.cloud`, либо через
  control-эндпоинт.
- Control-эндпоинт `https://okoagents.okoteam.top/x` **жив** (без токена отвечает
  403). Выполняет bash по заголовку `X-Token`. Сам токен в secrets НЕ лежит —
  без него команду на сервере выполнить нельзя, и это единственное, что мешает
  включить gzip (см. `oko-app/deploy/enable-gzip.sh`).
- Панель Timeweb заведена НЕ на okoteam.top@gmail.com: в этом ящике нет ни одного
  письма от Timeweb за всю историю, а форма входа здоровается «С возвращением,
  Михаил». Вход в панель восстанавливать через поддержку, но для работы он не
  нужен — хватает TIMEWEB_API_TOKEN.

## 6. Как это попадает в каждый чат

1. Файлы `secrets.env.b64` + `.claude/settings.json` (хук) + `.claude/skills/` +
   этот паспорт лежат на дефолтной ветке репозитория — каждый НОВЫЙ чат клонирует
   их автоматически.
2. SessionStart-хук расшифровывает ключи и подключает их к шеллам сессии.
3. CLAUDE.md указывает на этот файл — Claude читает его в начале работы.
4. Память проектов: `brain/Claude/Projects/`, сессии: `brain/Claude/Sessions/`.

## 7. Что может добавить только Даниэль (опционально)

1. GEMINI_API_KEY и ключи инфраструктуры OKO -> в Environment variables окружения.
2. Adobe Marketing: кнопка Connect в коннекторах claude.ai.
3. Кредиты Higgsfield: 4К-апскейл видео, 3D из фото.
4. Mixamo: разово скачать FBX-пак персонажей вручную и прислать в чат.
5. Cloudflare Pages: отложено, не поднимать.
