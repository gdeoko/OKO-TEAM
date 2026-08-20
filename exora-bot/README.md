# Exora — Telegram-бот обмена криптовалют

Проект для клиента Ангелина (Exora, обмен USDT ⇄ RUB). Заявка от 02.08.2026.

**Состав:** бот @exorappbot + mini-app в Telegram + панель управления.

## Ссылки

| Что | URL |
|---|---|
| Бот | https://t.me/exorappbot |
| Сайт | https://exoraexchange.ru/ |
| Mini-app | https://exoraexchange.ru/miniapp/ |
| Панель | https://exoraexchange.ru/admin/ |
| API | https://api.exoraexchange.ru/ |

Прежние адреса на `exora-app.higgsfield.app` и `okoteam.top/exora-api` остаются
рабочими как резерв, но бот и фронтенд ходят уже на домен клиента.

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

**Сайт, mini-app и панель** — статика на том же VPS, каталог `/var/www/exora`,
nginx-конфиг `/etc/nginx/sites-available/exora-site`:

```bash
vexec "/opt/oko-poster/cfg/wh/rx.sh 'cp /opt/oko-poster/cfg/wh/dist/miniapp.html /var/www/exora/miniapp/index.html'"
```

Файлы кладутся в `/opt/oko-poster/cfg/wh/dist/` (доступно пользователю `okoposter`),
оттуда root-обёрткой `rx.sh` копируются в `/var/www/exora`. Версия правится в
`<meta name="build">` — по ней проверяется, что прод обновился.

Копия сайта лежит и на хостинге клиента (FTP `deploy@s139.webhost1.ru`,
каталог `/www/exoraexchange.ru`), но домен смотрит на VPS: на shared-хостинге
Webhost1 SSL-виртхост не поднимается, панель выпускает только самоподписанный
сертификат, а Telegram mini-app без валидного HTTPS не работает.

Прежняя площадка (Higgsfield, website_id `17b4361d-8f22-4ecd-8c3f-4f98fad6f12d`)
осталась как резерв и больше не обновляется.

## Бренд

Логотип — концепт **A · Exchange Diamond** (выбран клиентом): четыре ромба
и светлый центр. Файлы: `brand/exora-mark.svg` (для светлого фона),
`brand/exora-mark-light.svg` (для тёмного). В mini-app и панели знак вставлен
инлайном, чтобы не зависеть от путей при переезде на домен клиента.
Цвета: `#1B5E3A` / `#2E8B57`, акцент `#7CC576` / `#8FE3A6`.

В интерфейсе — только SVG-иконки, без эмодзи.

## Домен клиента

Домен `exoraexchange.ru` куплен у Webhost1 (аккаунт `angel110604@mail.ru`,
заказ #274444), DNS-зона там же, NS `ns1-ns2.webhost1.com`, `ns3-ns4.webhost1.org`.

| Запись | Куда | Что обслуживает |
|---|---|---|
| `exoraexchange.ru` A | 104.171.132.45 | сайт, mini-app, панель (VPS) |
| `www` A | 104.171.132.45 | редирект на основной домен |
| `api` A | 104.171.132.45 | REST API бота |
| `ftp`, `mail`, `smtp`, `pop` | 91.236.136.29 | хостинг Webhost1 (почта, FTP) |

Сертификаты Let's Encrypt на VPS: `exoraexchange.ru` (плюс `www`) и
`api.exoraexchange.ru`, продление автоматическое. Для основного домена проверка
идёт через DNS: хук `/opt/oko-poster/cfg/wh/dns_hook.sh` кладёт TXT-запись
через API панели Webhost1, потому что nginx хостинга не отдаёт `/.well-known/`.

## Осталось сделать

- [ ] Реквизиты кошельков компании — заполнить в панели (поля есть, пустые)
- [ ] Юридические тексты под конкретное юрлицо
- [ ] Почта на домене (`mail.exoraexchange.ru` уже указывает на хостинг клиента)
- [ ] Решить судьбу хостинга Webhost1: либо добиваться от поддержки рабочего
      SSL и возвращать сайт туда, либо использовать его под почту и резерв
