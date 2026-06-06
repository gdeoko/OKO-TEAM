<?php
/* ============================================================
   DUCK'S GAME SPACE — конфигурация бэкенда
   Залить ВСЕ файлы из backend/ в КОРЕНЬ сайта (рядом с index.html).
   Заполни плейсхолдеры ниже (TG-токен, chat_id, PIN) — остальное готово.
   ============================================================ */

// --- Почта (Gmail Web App Password) ---
// Ящик клуба и App Password (16 символов без пробелов внутри CURL).
define('MAIL_USER', 'ducks.game.space@gmail.com');
define('MAIL_PASS', 'axcswwobaplhprjh');           // App Password (пробелы убраны)
define('MAIL_FROM', 'ducks.game.space@gmail.com');
define('MAIL_FROM_NAME', "DUCK'S GAME SPACE");
define('SMTP_HOST', 'smtps://smtp.gmail.com:465');  // SSL-порт для CURL

// --- Письма руководителям (новые заявки/купоны) ---
// Можно несколько через запятую.
define('ADMIN_EMAILS', 'ducks.game.space@gmail.com, okoteam.top@gmail.com');

// --- Telegram-бот (уведомления + бот клиентам) ---
// !!! ЗАПОЛНИ: токен бота @ducks_gameclub_bot из @BotFather
define('TG_BOT_TOKEN', '');                         // напр. 1234567:AAAA...
// !!! ЗАПОЛНИ: chat_id руководителей (узнать у @userinfobot). Несколько через запятую.
define('TG_ADMIN_CHATS', '');                       // напр. 123456789,987654321
define('TG_CHANNEL', 'https://t.me/duckspokerspace');
define('TG_BOT_LINK', 'https://t.me/ducks_gameclub_bot');

// --- Админ-панель ---
// !!! ЗАПОЛНИ: PIN для входа в админку (4-6 цифр). По умолчанию 2002 — поменяй.
define('ADMIN_PIN', '2002');

// --- Авто-приглашение ---
// Через сколько минут после заявки клиенту авто-уходит приглашение в клуб.
define('INVITE_DELAY_MIN', 15);

// --- Сайт ---
define('SITE_URL', 'https://ducks.games');
define('BRAND_RED', '#CC0000');
define('BRAND_BG', '#080808');

// --- Файлы данных (в той же папке) ---
define('DB_FILE', __DIR__ . '/data/ducks.sqlite');
define('CONTENT_FILE', __DIR__ . '/data/content.json');
define('UPLOAD_DIR', __DIR__ . '/data/uploads');

// --- Часовой пояс ---
date_default_timezone_set('Europe/Moscow');

// Адрес клуба и тексты приглашения редактируются в админке (settings),
// значения по умолчанию — в db.php при первой инициализации.
