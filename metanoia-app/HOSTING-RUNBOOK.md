# МЕТАНОЙА · HOSTING RUNBOOK (развёртывание backend)

Пошаговое руководство для инженера/администратора. Frontend — статический (уже
задеплоен отдельно), обращается к API по HTTPS. Здесь описан деплой PHP+MySQL API.

---

## 0. Требования к хостингу

| Компонент | Требование |
|-----------|-----------|
| PHP | 8.1+ (расширения: pdo_mysql, mbstring, openssl, curl, json) |
| MySQL | 8.0+ (или MariaDB 10.5+), кодировка `utf8mb4` |
| HTTPS | обязателен (Let's Encrypt), включая HSTS |
| Cron | для фоновых задач (проверка истёкших подписок) |
| Права ФС | каталог `config/` — вне web-root, `.env` с правами `600` |

Composer не требуется — backend без сторонних зависимостей (нативный PHP).

---

## 1. Размещение файлов

```
/var/www/metanoia/
├── public_html/        ← DocumentRoot фронта (уже есть) ИЛИ отдельный поддомен api
├── api/                ← точка входа API (api/v1/index.php)
│   └── v1/{routes,core}/
├── config/
│   ├── .env            ← создать из .env.example, chmod 600
│   └── .env.example
└── db/
    ├── schema.sql
    └── seed.sql
```

Рекомендуется отдать API на поддомене `api.<домен>` с DocumentRoot `.../api`.
Front — на `app.<домен>` (или корень). CORS настроить на `APP_ORIGIN`.

```bash
git clone <repo> /var/www/metanoia && cd /var/www/metanoia
cp config/.env.example config/.env
chmod 600 config/.env
chown www-data:www-data config/.env
```

---

## 2. База данных

```bash
mysql -u root -p -e "CREATE DATABASE metanoia CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"
mysql -u root -p -e "CREATE USER 'metanoia'@'localhost' IDENTIFIED BY '<СИЛЬНЫЙ_ПАРОЛЬ>';"
mysql -u root -p -e "GRANT ALL PRIVILEGES ON metanoia.* TO 'metanoia'@'localhost'; FLUSH PRIVILEGES;"
mysql -u metanoia -p metanoia < db/schema.sql
mysql -u metanoia -p metanoia < db/seed.sql   # демо-данные (опционально на проде)
```

---

## 3. Заполнение `config/.env`

Обязательные для запуска переменные:

```ini
# База
DB_HOST=localhost
DB_NAME=metanoia
DB_USER=metanoia
DB_PASS=<пароль_из_шага_2>

# Приложение
APP_ORIGIN=https://app.<домен>       # точный origin фронта (для CORS и cookie)
APP_DEBUG=0
JWT_SECRET=<openssl rand -hex 32>     # длинный случайный секрет

# Оплата Lava.top (X-Api-Key). Отдельного секрета у Lava нет — LAVA_SECRET можно оставить пустым.
LAVA_API_KEY=<ключ_из_кабинета_Lava>
LAVA_OFFER_MONTH=3cecb188-cc10-43b4-a034-3b773473a41e   # «Метанойя +» 690 ₽/мес

# Соц-входы
GOOGLE_OAUTH_CLIENT_ID=<из Google Cloud Console>
TELEGRAM_BOT_TOKEN=<токен @BotFather — ПЕРЕВЫПУСТИТЬ перед продом>

# Почта (100 писем/день бесплатно)
SENDGRID_API_KEY=<ключ SendGrid>
MAIL_FROM=noreply@<домен>
```

Опционально/позже (не блокируют запуск): `LAVA_OFFER_YEAR`, `LAVA_OFFER_LIFETIME`,
`LAVA_OFFER_DONATION`, `YOUTUBE_API_KEY`, `FIREBASE_SERVER_KEY`.

---

## 4. Внешние интеграции

**Lava.top вебхук.** В кабинете Lava указать URL вебхука:
`https://api.<домен>/api/v1/webhooks/lava`. Backend проверяет подпись HMAC-SHA256
и обрабатывает события идемпотентно (по `lava_invoice_id`).

**Google OAuth.** В Google Cloud Console → OAuth 2.0 Client (тип Web):
- Authorized JavaScript origins: `https://app.<домен>`
- Authorized redirect URI: `https://api.<домен>/api/v1/oauth/google/callback`

**Telegram Login.** У @BotFather: `/setdomain` → `app.<домен>`. Проверка данных
виджета — HMAC-SHA256, `secret = SHA256(bot_token)`.

---

## 5. Веб-сервер

Nginx (пример для API-поддомена):

```nginx
server {
  listen 443 ssl http2;
  server_name api.<домен>;
  root /var/www/metanoia/api;
  index index.php;
  location / { try_files $uri $uri/ /v1/index.php?$query_string; }
  location ~ \.php$ { include fastcgi_params; fastcgi_pass unix:/run/php/php8.1-fpm.sock;
                      fastcgi_param SCRIPT_FILENAME $document_root$fastcgi_script_name; }
  # config/ вне root — доступ извне невозможен по построению
}
```

CORS: backend отдаёт `Access-Control-Allow-Origin: $APP_ORIGIN`,
`Allow-Credentials: true`. Cookie сессии — `Secure; HttpOnly; SameSite=None`.

---

## 6. Smoke-тесты после деплоя

```bash
# health
curl -s https://api.<домен>/api/v1/health            # → {"ok":true}

# регистрация
curl -s -X POST https://api.<домен>/api/v1/auth/register \
  -H 'Content-Type: application/json' \
  -d '{"email":"test@ex.ru","password":"Test1234","name":"Тест"}'

# профиль родителя со списком детей
curl -s https://api.<домен>/api/v1/users/me -H 'Authorization: Bearer <accessToken>'

# положить и забрать снимок прогресса ребёнка
curl -s -X PUT https://api.<домен>/api/v1/progress/1 \
  -H 'Authorization: Bearer <accessToken>' -H 'Content-Type: application/json' \
  -d '{"rev":1,"state":{"keys":{"mt_lesson_1":"{\"read\":true}"},"xp":5,"level":1}}'
curl -s https://api.<домен>/api/v1/progress/1 -H 'Authorization: Bearer <accessToken>'

# создание счёта Lava — только если школа вернёт платный тариф
curl -s -X POST https://api.<домен>/api/v1/subscriptions/checkout \
  -H 'Authorization: Bearer <accessToken>' -H 'Content-Type: application/json' \
  -d '{"offer":"month"}'
```

После проверки API включить синхронизацию во фронте: в `public_html/index.html`
заполнить мета-тег `mt-api` адресом вида `https://api.<домен>/api/v1`. Пустое
значение оставляет приложение целиком на устройстве.

Проверить: вход Google/Telegram (колбэки), приход вебхука Lava после тестовой
оплаты, письмо-подтверждение от SendGrid.

---

## 7. Типичные проблемы

| Симптом | Причина / решение |
|---------|-------------------|
| 500 на всех запросах | нет прав на чтение `config/.env` или ошибка в нём; смотреть php-fpm error log |
| CORS-ошибка в браузере | `APP_ORIGIN` не совпадает с origin фронта до символа |
| «кракозябры» в БД | база/таблицы не `utf8mb4`; пересоздать с нужной кодировкой |
| Вебхук Lava не проходит | неверная подпись/URL; проверить, что тело читается «сырым» до JSON-парсинга |
| Google redirect_uri_mismatch | URI в консоли не совпадает с реальным колбэком (протокол/слэш) |

---

## 8. Безопасность (обязательно перед продом)

- [ ] **Перевыпустить токен Telegram-бота** у @BotFather (прежний засветился в переписке).
- [ ] `APP_DEBUG=0`, скрыть вывод ошибок наружу.
- [ ] `.env` — `chmod 600`, вне web-root, не в git (`.gitignore` уже настроен).
- [ ] HTTPS-only, HSTS, `Secure`+`HttpOnly`+`SameSite` на cookie.
- [ ] Уникальный `JWT_SECRET`, БД-пользователь без прав на другие схемы.
- [ ] Регулярный бэкап БД (mysqldump по cron).
