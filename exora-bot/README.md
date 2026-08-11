# Exora — Telegram-бот обмена криптовалют

Проект для клиента Ангелина (Exora, обмен USDT ⇄ RUB). Заявка от 02.08.2026.

**Состав:** бот @exorappbot + mini-app в Telegram + панель управления.

## Ссылки

| Что | URL |
|---|---|
| Бот | https://t.me/exorappbot |
| Mini-app | https://exora-app.higgsfield.app/miniapp/ |
| Панель | https://exora-app.higgsfield.app/admin/ |
| API | https://okoteam.top/exora-api/ |

## Как устроено

- **Бот** `bot/bot.py` — aiogram 3, long-polling, SQLite. Заявки, курс, AML,
  алерты по курсу, рассылка, админ-команды. Внутри же REST API на `127.0.0.1:8093`,
  который наружу отдаётся nginx'ом как `https://okoteam.top/exora-api/`.
- **Mini-app** `miniapp/index.html` — один самодостаточный файл. Экраны
  Главная / Обмен / Заявки / О сервисе + условия, политика, FAQ.
- **Панель** `admin/index.html` — заявки, аналитика, алерты, лог, настройки,
  рассылка, тексты.

### Единый источник курса

Курс, наценки и лимиты живут **только** в настройках бота. Mini-app и панель
берут их из `GET /api/public/config` — раньше каждый держал свои константы,
и правка наценки в панели не доходила до клиента.

Режимы курса:
- `rate_mode=auto` — курс с биржи (Binance, запасной CoinGecko);
- `rate_mode=manual` — курс задаёт оператор (`rate_manual`), биржа не учитывается.

Переключается в панели («Источник курса») или в боте: `/admin_rate 95.5`,
возврат — `/admin_rate auto`.

## Доступ в панель

Два пути, пароля в коде страницы нет:
1. **Из бота** — команда `/admin` → кнопка «Открыть панель управления».
   Telegram передаёт подписанный `initData`, бот проверяет подпись и то,
   что оператор есть в списке админов. Вводить ничего не нужно.
2. **В браузере** — ключ `EXORA_API_TOKEN`, вводится один раз и остаётся
   в этом браузере.

Ключ `exora-admin-2026` отозван: он лежал в открытом HTML, и любой человек
со ссылкой на панель мог читать заявки клиентов и менять курс.

## Env-переменные бота

```
EXORA_BOT_TOKEN     — токен @exorappbot
EXORA_MINIAPP_URL   — HTTPS URL mini-app
EXORA_ADMIN_URL     — HTTPS URL панели (для кнопки в /admin)
EXORA_ADMIN_IDS     — TG id админов через запятую
EXORA_API_TOKEN     — ключ доступа к панели из браузера (обязателен)
EXORA_SUPPORT       — @username поддержки
EXORA_BRAND         — Exora
EXORA_ADDR          — режим работы
EXORA_DB            — путь к SQLite
EXORA_API_PORT      — порт REST API (8093)
EXORA_LOG_LEVEL     — INFO / DEBUG
```

Живые значения — в `/opt/oko-poster/exora-bot/keepalive.sh` на VPS.

## Настройки (меняются из панели или `/admin_set`)

`rate_mode`, `rate_manual`, `markup_buy`, `markup_sell`, `min_usdt`, `max_usdt`,
`wallet_trc20/erc20/bep20/ton/rub`, `welcome_text`, `about_text`.

Значения проверяются на входе: неизвестный ключ или нечисловая наценка
отвергаются, а не уходят молча в базу.

## Деплой

**Бот** (VPS `104.171.132.45`, `/opt/oko-poster/exora-bot/`):

```bash
BOT_B64=$(base64 -w0 exora-bot/bot/bot.py)
vexec "echo '$BOT_B64' | base64 -d > /opt/oko-poster/exora-bot/bot.py"
vexec 'pkill -f "python.*/opt/oko-poster/exora-bot/bot\.py"'   # cron поднимет заново
```

**Mini-app и панель** (Higgsfield, website_id `17b4361d-8f22-4ecd-8c3f-4f98fad6f12d`):

```bash
# website_repo_access → клонировать репо сайта
cp exora-bot/miniapp/index.html <repo>/app/public/miniapp/index.html
cp exora-bot/admin/index.html   <repo>/app/public/admin/index.html
git add -A && git commit -m "exora: update" && git push origin main
# затем deploy_website
```

Версия правится в `<meta name="build">` — по ней проверяется, что прод обновился.
CDN кэширует статику: проверять с `?v=<timestamp>`.

## Бренд

Логотип — концепт **A · Exchange Diamond** (выбран клиентом): четыре ромба
и светлый центр. Файлы: `brand/exora-mark.svg` (для светлого фона),
`brand/exora-mark-light.svg` (для тёмного). В mini-app и панели знак вставлен
инлайном, чтобы не зависеть от путей при переезде на домен клиента.
Цвета: `#1B5E3A` / `#2E8B57`, акцент `#7CC576` / `#8FE3A6`.

В интерфейсе — только SVG-иконки, без эмодзи.

## Осталось сделать

- [ ] Домен клиента → перенести mini-app и панель, обновить `EXORA_MINIAPP_URL`,
      `EXORA_ADMIN_URL` и `API` в обоих HTML
- [ ] Реквизиты кошельков компании — заполнить в панели (поля есть, пустые)
- [ ] Юридические тексты под конкретное юрлицо
- [ ] Регулярный бэкап `data/exora.sqlite`
