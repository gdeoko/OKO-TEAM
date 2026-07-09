# МЕТАНОЙА — подключение бэкенда (инструкция OKO TEAM)

Код бэкенда написан «под ключ»: как только появятся хостинг и ключи, он включается
почти без правок. Ниже — что и куда вставить.

---

## 1. Хостинг + база данных

1. Залить папку `metanoia-app/public_html/` в корень сайта (например `app.metanoia-180.ru`).
2. Папку `config/` разместить **вне** `public_html` (на уровень выше).
3. Создать БД MySQL 8.0 / MariaDB, импортировать:
   - `db/schema.sql` (структура, ~30 таблиц)
   - `db/seed.sql` (аккаунт Екатерины-суперадмина, игры, значки, стикеры)
4. Скопировать `config/.env.example` → `config/.env`, заполнить `DB_*` и `JWT_SECRET`
   (`openssl rand -hex 32`).
5. Проверка: `GET https://app.metanoia-180.ru/api/v1/health` → `{"success":true,...}`.

Фронтенд переключается с демо-данных на API одним флагом конфигурации (в `assets/js`).

---

## 2. Оплата Lava.top (подписки Метанойя+) — ⭐ приоритет

Готовые эндпоинты:
- `GET  /api/v1/subscriptions/me` — статус подписки
- `POST /api/v1/subscriptions/create` `{plan: monthly|yearly|lifetime}` → `{payment_url}`
- `POST /api/v1/subscriptions/trial` — пробные 7 дней
- `POST /api/v1/subscriptions/cancel`
- `POST /api/v1/subscriptions/donate` `{amount, display_name?}` — пожертвование
- `POST /api/v1/webhooks/lava` — приём событий (успех/отмена/возврат/рекуррент)

Что вставить в `config/.env`:
```
LAVA_API_KEY=...        # ЛК Lava.top → API
LAVA_SECRET=...         # секрет подписи вебхука
LAVA_OFFER_MONTH=...    # id «предложений» (offer) по тарифам
LAVA_OFFER_YEAR=...
LAVA_OFFER_LIFETIME=...
LAVA_OFFER_DONATION=...
```
В ЛК Lava.top указать URL вебхука: `https://app.metanoia-180.ru/api/v1/webhooks/lava`.

> Два пункта сверить с актуальной докой Lava.top (помечены `CONFIRM` в коде
> `core/lava.php` и `routes/webhooks.php`): точный базовый URL API и имя заголовка
> подписи вебхука. Всё остальное — рабочее и покрыто логикой идемпотентности.

---

## 3. Соц-входы

Эндпоинты: `POST /api/v1/oauth/google` `{id_token}`, `POST /api/v1/oauth/telegram` `{...}`.

- **Google:** Google Cloud Console → OAuth 2.0 Client ID (тип Web) →
  `GOOGLE_OAUTH_CLIENT_ID`. На фронте — кнопка Google Identity Services.
- **Telegram:** @BotFather → токен бота `@metanoia_180_bot` → `TELEGRAM_BOT_TOKEN`.
  Подпись Login Widget проверяется на сервере.

---

## 4. Почта (верификация email, восстановление пароля)

`SENDGRID_API_KEY` (sendgrid.com, 100 писем/день бесплатно) + `MAIL_FROM`.

---

## 5. Cron (когда дойдём до этапа 7)

```
*/5 * * * *  php .../scripts/lessons_autogen.php   # AI-фабрика уроков (YouTube→материалы)
0   3 * * *  php .../scripts/streak_reset.php       # обнуление streak
0  19 * * *  php .../scripts/streak_remind.php       # push-напоминания
```

---

## 6. Что ещё впереди (этапы 6–7)

Realtime-чаты (long-polling/SSE), серверная модерация, push (Firebase),
YouTube + Claude API (автогенерация уроков), админ-панель Екатерины,
остальные 12 премиум-игр. Схема БД под всё это уже готова.

---

## Три вопроса, на которые нужен ответ Даниэля

1. **Lava.top** зарегистрирована? (без ключа монетизация стоит)
2. Согласие Екатерины на клон её голоса (ElevenLabs) — для озвучки уроков?
3. Аккаунт разработчика Google Play (её ФИО + карта, 2 300 ₽ разово)?

*OKO TEAM · okoteam.top · +7 (977) 995-55-66*
