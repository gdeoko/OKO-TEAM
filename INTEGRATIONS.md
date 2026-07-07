# OKO TEAM · Паспорт интеграций Claude Code

Обновлено: 07.07.2026. Все ключи проверены боем из облачной среды.
Значения ключей: `secrets.env.b64` (base64). Расшифровка и загрузка происходят
АВТОМАТИЧЕСКИ при старте каждой сессии (SessionStart-хук в `.claude/settings.json`
пишет source-строку в профиль шелла). Вручную: `source <(base64 -d secrets.env.b64)`.

## API-ключи (env-переменные, доступны в каждом Bash)

| Переменная | Сервис | Что даёт | Проверка | Восстановить |
|---|---|---|---|---|
| HF_TOKEN | Hugging Face | Квоты ZeroGPU: FLUX-кадры, Wan-видео, 3D из фото через gradio_client | `curl -H "Authorization: Bearer $HF_TOKEN" https://huggingface.co/api/whoami-v2` | hf.co/settings/tokens |
| PEXELS_API_KEY | Pexels | Реальные 4К-видео и фото, 200 req/час | `curl -H "Authorization: $PEXELS_API_KEY" "https://api.pexels.com/videos/search?query=test&per_page=1"` | pexels.com/api |
| PIXABAY_API_KEY | Pixabay | Запасной видеосток, cdn напрямую | `curl "https://pixabay.com/api/videos/?key=$PIXABAY_API_KEY&q=test"` | pixabay.com/api/docs |
| FAL_KEY | fal.ai | ПЛАТНЫЕ генерации 1080p (~5-15 руб/клип), Wan/Kling без очередей | код 404 (не 401) на `curl -H "Authorization: Key $FAL_KEY" https://queue.fal.run/fal-ai/flux/requests/0/status` | fal.ai/dashboard/keys |
| SKETCHFAB_API_TOKEN | Sketchfab | Download API: тысячи CC 3D-моделей | `curl -H "Authorization: Token $SKETCHFAB_API_TOKEN" https://api.sketchfab.com/v3/me` | sketchfab.com/settings/password |
| FREESOUND_API_KEY | Freesound | Звуки CC: моторы, трасса, эмбиент | `curl "https://freesound.org/apiv2/search/text/?query=engine&token=$FREESOUND_API_KEY"` | freesound.org/apiv2/apply |
| TWENTY_FIRST_API_KEY | 21st.dev Magic | Библиотека wow-компонентов | POST api.21st.dev/api/search с заголовком x-api-key | 21st.dev |
| CLOUDFLARE_API_TOKEN + CLOUDFLARE_ACCOUNT_ID | Cloudflare | Хостинг Pages (wrangler) | `npx wrangler pages project list` | НЕ РАБОТАЕТ: пересоздать токен по шаблону "Cloudflare Pages: Edit" |
| HF_S3_* | HF S3 | Хранилище файлов okoteam (boto3, verify=/root/.ccr/ca-bundle.crt) | list_buckets | hf.co (Storage) |

Правила: ключи НЕ вписывать в код сайтов и не отдавать в браузер. Только curl
(urllib и node fetch ходят мимо прокси). Новый ключ: дописать в secrets.env,
`base64 -w0 secrets.env > secrets.env.b64`, закоммитить b64.

## MCP-коннекторы (подключаются на claude.ai, доступны как mcp__*)

| Коннектор | Статус | Что даёт |
|---|---|---|
| Higgsfield | работает | генерация фото/видео/3D (кредиты Даниэля), хостинг сайтов с публичной ссылкой |
| Hugging Face | работает (okoteam) | поиск моделей и спейсов; генерации напрямую через gradio_client |
| Gmail | работает | письма, черновики, ярлыки |
| GitHub | работает | PR, issues, CI |
| Figma | работает | макеты в обе стороны |
| Canva | работает | дизайны, экспорт |
| Adobe Creative | работает | обработка изображений, PDF, шрифты |
| Magic Patterns | работает | генерация UI |
| Zapier | работает | 9000+ приложений |
| Zoom | работает | записи и саммари |
| Adobe Marketing | НЕ авторизован | claude.ai -> Settings -> Connectors -> Connect (нужен только для рекламных кампаний Adobe) |

## Хостинг и деплой
- Основной: Higgsfield websites. ЗооОпт spicy-panther-317 (id 5c654873...), OKO true-journey-418 (id 5426760c...), PandaGo превью forest-beach-360 (id 96269fa0...). deploy_website таймаут 60с = норма, проверять curl-маркером.
- Запасной: Cloudflare Pages (после пересоздания токена).
- Прод PandaGo: FastPanel клиента, zip в чат.

## Что осталось добить (опционально)
1. Cloudflare: пересоздать токен по шаблону "Cloudflare Pages: Edit" (текущему не хватает прав).
2. GEMINI_API_KEY: aistudio.google.com/apikey (бесплатный Gemini).
3. Кредиты Higgsfield: 4К-апскейл видео, 3D из фото.
4. Mixamo: разово скачать FBX-пак персонажей вручную и прислать в чат.
5. Adobe Marketing: кнопка Connect в коннекторах claude.ai.

## Как этим пользуются новые чаты
1. Хук сам расшифровывает ключи и подключает их к каждому shell.
2. Скилл `/oko-magic` (грузится автоматически) знает все пайплайны: генерации,
   видео-скраб, 3D-путешествие, стоки, печать, деплой, self-QA.
3. Память проектов: `brain/Claude/Projects/` и записи сессий.
