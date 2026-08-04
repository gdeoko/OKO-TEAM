# Exora — Telegram-бот обмена криптовалют

Проект для клиента Ангелина (проект Exora, крипто-обменник). Заявка от 02.08.2026.

**Итог:** полноценный Telegram-бот @exorappbot с mini-app в стиле fintech + админ-панель.

## Что сделано

- **Бот** `bot/bot.py` — aiogram 3.30, Python 3.14, long-polling, SQLite для заявок.
  Приветствие с курсом, reply-клавиатура (Обмен, Курс, Мои заявки, AML, Реферальная, О нас, Поддержка),
  команды `/start /rate /myorders /about /support /admin /admin_orders /admin_set /admin_broadcast`,
  callback-модерация заявок (в работу / готово / отмена), уведомления клиенту при смене статуса.
- **Mini-app** `miniapp/index.html` — single-file SPA, тёмная/светлая темы, mobile-first,
  экраны Home / Exchange / Orders / About. Курс USDT/RUB с Binance (fallback CoinGecko),
  4 сети (TRC-20 / ERC-20 / BEP-20 / TON), валидация min 300 / max 100 000 USDT,
  расчёт с наценкой, `tg.sendData` → бот получает заявку и уведомляет админов.
- **Админка** `admin/index.html` — витрина статистики + таблица заявок,
  фильтры по статусу, экспорт CSV, ссылки на бот-команды для управления.
- **Деплой mini-app + admin** — public repo `gdeoko/oko-magic-skill` ветка `exora-app`
  → CDN `raw.githack.com` (постоянный HTTPS).
- **Деплой бота** — VPS OKO `/opt/oko-poster/exora-bot/`,
  venv, cron-keepalive (`* * * * * keepalive.sh`).

## Ссылки

| Что | URL |
|---|---|
| Bot | https://t.me/exorappbot |
| Mini-app | https://raw.githack.com/gdeoko/oko-magic-skill/exora-app/exora/miniapp/index.html |
| Admin | https://raw.githack.com/gdeoko/oko-magic-skill/exora-app/exora/admin/index.html |
| Mini-app (short) | https://tinyurl.com/288abbfc |
| Admin (short) | https://tinyurl.com/27x57m7r |

## Настройка бота (уже применено через Bot API)

- **Имя:** Exora 🪙
- **Username:** @exorappbot
- **Описание:** "Exora — быстрый обмен USDT ⇄ RUB онлайн. Работаем 24/7, комиссия 0%, курс лучший…"
- **Short desc:** "Обмен криптовалют · 24/7 · 0% комиссии · лучший курс USDT"
- **Команды:** /start /rate /myorders /about /support
- **Menu button:** «💱 Обмен USDT» → mini-app URL

## Env-переменные бота

```
EXORA_BOT_TOKEN     — токен @exorappbot
EXORA_MINIAPP_URL   — HTTPS URL mini-app
EXORA_ADMIN_IDS     — TG id админов через запятую
EXORA_SUPPORT       — @username поддержки
EXORA_BRAND         — Exora
EXORA_ADDR          — адрес/режим (Онлайн · Россия · 24/7)
EXORA_DB            — путь к SQLite
EXORA_LOG_LEVEL     — INFO / DEBUG
```

## Как обновить mini-app / admin

```bash
# Отредактировать exora-bot/miniapp/index.html или admin/index.html
# затем:
cd /workspace/oko-magic-skill
git checkout exora-app
cp /home/user/OKO-TEAM/exora-bot/miniapp/index.html exora/miniapp/index.html
cp /home/user/OKO-TEAM/exora-bot/admin/index.html   exora/admin/index.html
git add exora/ && git commit -m "exora: update" && git push
# CDN подхватит новый файл через ~1-5 минут
```

## Как обновить бота

```bash
# Через vexec: залить bot.py в base64
BOT_B64=$(base64 -w0 /home/user/OKO-TEAM/exora-bot/bot/bot.py)
vexec "echo '$BOT_B64' | base64 -d > /opt/oko-poster/exora-bot/bot.py"
# Убить старый — cron перезапустит:
vexec 'pkill -f "python.*/opt/oko-poster/exora-bot/bot\.py"'
```

## TODO (после демо клиенту)

- [ ] Домен клиента (Webhost1) → перенести mini-app туда, обновить `EXORA_MINIAPP_URL`
- [ ] TG-контакт заявок клиента (сейчас — Даниэль) → обновить `EXORA_ADMIN_IDS` и `EXORA_SUPPORT`
- [ ] Полноценный REST API для админки (сейчас — управление через бот-команды)
- [ ] Реквизиты кошельков компании (TRC-20 / ERC-20 / BEP-20 / TON) в бот-настройки
- [ ] Юридические тексты (политика, соглашение) — по требованию клиента
