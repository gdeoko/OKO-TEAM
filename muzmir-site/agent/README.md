# Мозг-агент КЦ «Музыкальный Мир»

Отдельный ИИ-агент Центра для соцсетей и поддержки (аналог OKO-агента, под Музмир).
Отвечает в чат-виджете сайта, публикует посты-афиши при событиях конкурсов
(открыт приём, закрыт приём, опубликованы результаты), помогает модерации.

Реальные соц-доступы Музмира ещё не переданы: адаптеры читают креды из окружения
и при их отсутствии делают тихий фолбэк (лог + `skipped`), поэтому весь конвейер
запускается и тестируется уже сейчас.

## Состав

```
agent/
  brain.py            ядро: answer(question, user_context) через Gemini-прокси OKO
  knowledge.md        база знаний КЦ (контекст для brain)
  content.py          генерация текста поста-афиши под событие + подпись
  server.py           HTTP-сервер: POST /chat, POST /event, GET /health
  social/
    __init__.py       broadcast() по всем площадкам
    _base.py          общий HTTP/лог/TLS-бандл
    vk.py             VKAdapter.post -> сообщество music_world.online
    telegram.py       TelegramAdapter.post -> канал @kc_mus_mir
    youtube.py        YouTubeAdapter.post/upload -> канал-витрина КЦ
  README.md           этот файл
```

## Переменные окружения (секреты в git не класть)

Общие:
- `MUZMIR_AGENT_TOKEN` — токен авторизации сервера агента (совпадает с
  `agent_token` в `config.php` сайта). Если пуст — сервер без авторизации (dev).
- `MUZMIR_AGENT_PORT` — порт сервера (по умолчанию 8090).

LLM (Gemini-прокси OKO):
- `GEMINI_API_KEY` — один ключ или несколько через запятую (ротация).
  Также поддерживаются `GEMINI_API_KEY_1..9`.
- `GEMINI_PROXY_URL` — базовый URL (по умолчанию
  `https://gemini-proxy.okoteam.workers.dev`).
- `GEMINI_MODEL` — модель (по умолчанию `gemini-flash-latest`).

Соцсети (передаст заказчик):
- ВК: `MUZMIR_VK_TOKEN`, `MUZMIR_VK_GROUP_ID`, `MUZMIR_VK_API_VERSION`.
- Telegram: `MUZMIR_TG_BOT_TOKEN`, `MUZMIR_TG_CHANNEL` (по умолч. `@kc_mus_mir`).
- YouTube: `MUZMIR_YT_ACCESS_TOKEN` (OAuth), `MUZMIR_YT_API_KEY`,
  `MUZMIR_YT_CHANNEL_ID`.

Сеть в этом окружении идёт через corporate-прокси; TLS проверяется по бандлу
`/root/.ccr/ca-bundle.crt` (используется автоматически, если файл есть).

## Запуск

```bash
# сервер (рекомендуемый способ - подхватывает agent/.env, если есть)
./agent/run.sh

# или напрямую
MUZMIR_AGENT_TOKEN=secret GEMINI_API_KEY=... python3 agent/server.py

# быстрый ответ из CLI
python3 agent/brain.py "Как подать заявку и когда придут результаты?"

# демо постов-афиш
python3 agent/content.py
```

`agent/run.sh` читает секреты из окружения; для локальной разработки можно
положить их в `agent/.env` (в git не класть) - скрипт подхватит файл сам.

Проверка компиляции: `python3 -m py_compile agent/*.py agent/social/*.py`.

## Эндпоинты сервера

```
GET  /health                    -> {"ok":true,"service":"muzmir-agent"}
POST /chat                      -> {"ok":true,"reply":"..."}
      body: {"text":"...", "user":{...опц. контекст...}}
POST /event                     -> {"ok":true,"event":"open","post":{...},"delivery":{...}}
      body: {"type":"open|closing|closed|results", "competition":{...}}
```

Авторизация: заголовок `Authorization: Bearer <MUZMIR_AGENT_TOKEN>` или `?token=`.
Пути сайта `/api/v1/agent/chat` и `/api/v1/agent/webhook` тоже принимаются
(суффиксы `/chat`, `/event`, `/webhook`).

Пример события:

```json
POST /event
{
  "type": "open",
  "competition": {
    "name": "Мировая Сцена",
    "type": "международный",
    "end_date": "31 марта 2026",
    "url": "https://музыкальный-мир.рф/konkurs/mirovaya-scena-2026"
  }
}
```

Пример чата:

```json
POST /chat
{ "text": "Какие возрастные категории?", "user": {"name": "Анна"} }
```

## Как стыкуется с сайтом

Сайт (`config.php`) хранит:
- `agent_url` (`MUZMIR_AGENT_URL`) — базовый URL этого сервера;
- `agent_token` (`MUZMIR_AGENT_TOKEN`) — общий токен.

Связка по ТЗ (раздел 7 контекста, раздел 7 TZ_MAIN):

1. Чат-виджет: фронт сайта -> `POST /api/v1/chat.php` на сайте ->
   `agent_chat_proxy()` (в `api/v1/_boot.php`) POST-ом шлёт `{text, session,
   user_id}` на **базовый** `agent_url` -> сервер агента трактует корневой путь
   `/` (и `/chat`) как чат -> `brain.answer()` -> `{"ok":true,"reply":"..."}`.
   PHP читает поле `reply`. Формат сохранён - менять `chat.php` не требуется.

2. События конкурсов: при смене статуса конкурса в админке (`admin/competitions.php`)
   сайт зовёт `emit_event($type, $data)` (`core/events.php`), который POST-ом
   шлёт `{type, competition:{...}}` на `agent_url + '/event'` с Bearer-токеном
   и пишет строку в `events_log`. Соответствие статус -> событие:
   `open -> competition_open`, `closed -> competition_closed`,
   `finished -> results_published`. Агент собирает пост по правилам КЦ
   (`content.py`) и рассылает через `social.broadcast()` в ВК/TG/YouTube.
   Другие типы (`new_application`, `payment_success`) - для будущих сценариев.

3. Модерация комментариев: адаптеры дают доступ к площадкам; типовые ответы
   формирует `brain.answer()`, сложные случаи эскалируются в админку сайта
   (обрабатывается на стороне сайта).

## Правила текстов (соблюдаются в brain и content)

Обращение «Вы», без эмодзи, короткие тире «-», кавычки «ёлочки», без AI-лексики,
без Telegram-ссылок в ответах, без упоминания гендиректора (только «Оргкомитет»).
`brain.sanitize()` — финальная страховка над любым сгенерированным текстом.
```
