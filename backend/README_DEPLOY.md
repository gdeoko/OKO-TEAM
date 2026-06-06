# DUCK'S — деплой бэкенда (webhost1 / любой PHP-хостинг)

Технология: **PHP + SQLite (PDO) + Gmail App Password (CURL SMTP) + cron**.
Фронтенд (Vite) и бэкенд (PHP) живут вместе в корне сайта.

## 1. Что куда кладётся (всё в корень `public_html/`)

```
public_html/
├── index.html              ← фронт (из dist/)
├── assets/ cards/ draco/ models/   ← фронт
├── .htaccess               ← красивые ссылки + SPA
├── system.html             ← /system
├── magnets/                ← /poker-pravila, /chitat-lyudey, /igry-dlya-mozga, /10-shagov
├── config.php  db.php  mailer.php  templates.php  api.php  cron.php
├── admin/index.php         ← /admin (PIN-вход)
└── data/                   ← БД и контент (нужны права на ЗАПИСЬ 0775)
    ├── ducks.sqlite        ← создастся сам при первом запросе
    └── content.json        ← тексты сайта (правятся в админке)
```

Проще всего: `bash scripts/package.sh` → получаешь `ducks-deploy.zip` → распаковать в корень.

## 2. Заполни `config.php`

| Параметр | Что вписать |
|---|---|
| `MAIL_PASS` | App Password Gmail (уже стоит `axcswwobaplhprjh`) — проверь актуальность |
| `ADMIN_EMAILS` | почты руководителей (новые заявки/купоны) |
| `TG_BOT_TOKEN` | **токен @ducks_gameclub_bot из @BotFather** (пока пусто → ТГ-уведомления выключены) |
| `TG_ADMIN_CHATS` | **chat_id руководителей** (узнать у @userinfobot) |
| `ADMIN_PIN` | **PIN для входа в /admin** (по умолчанию `2002` — поменяй) |
| `INVITE_DELAY_MIN` | задержка авто-приглашения (по умолчанию 15 мин) |

Адрес клуба, тексты писем, лид-магнит — правятся прямо в **админке → Настройки** (без кода).

## 3. Cron (авто-приглашения и досыл писем)

`cron.php` шлёт приглашения через 15 мин и досылает welcome/магниты.
Внутри он крутит цикл 6×10 сек, поэтому ставь запуск **раз в минуту**:

```
* * * * * php /home/USERNAME/public_html/cron.php >/dev/null 2>&1
```

(в панели webhost1: Cron Jobs → каждую минуту → команда выше с твоим путём).

## 4. Права на запись

Папке `data/` нужны права **0775** (чтобы создались `ducks.sqlite` и писался `content.json`).

## 5. Проверка

1. Открой сайт → заполни форму «Записаться» → должно прийти письмо «Заявка принята» + магнит.
2. Через 15 мин (или кнопкой в админке) → письмо-приглашение с адресом.
3. Дартс 150 очков → форма купона → письмо с именным купоном (вложение `.html`).
4. `/admin` → PIN → Сводка/База/Купоны/Тексты/Рассылки/Настройки.
5. `/system`, `/poker-pravila` и др. — открываются без `.html`.

## 6. Заменить лид-магниты / систему на свои

Если есть готовые файлы — положи их вместо плейсхолдеров:
`system.html` в корень, файлы магнитов в `magnets/` под теми же именами
(`poker-pravila.html`, `chitat-lyudey.html`, `igry-dlya-mozga.html`, `10-shagov.html`) —
красивые ссылки продолжат работать.
