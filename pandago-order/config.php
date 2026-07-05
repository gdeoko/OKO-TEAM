<?php
/* ============================================================
   PandaGo Order - конфигурация
   Все токены и ID вынесены сюда.
   ============================================================ */

/* Telegram-бот заявок */
const TG_BOT_TOKEN = 'REPLACE-WITH-BOT-TOKEN';
const TG_BOT_USERNAME = 'pandago_order_bot';

/* Админы бота и уведомлений */
const ADMINS = [
    ['id' => 1966985736, 'label' => 'Даниэль Ильясов',  'tg' => '@ktodaniel'],
    ['id' => 8637446193, 'label' => 'Работник',          'tg' => 'work'],
    ['id' => 8748082826, 'label' => 'Konstantin Panda GO','tg' => '@pandaGO_media'],
    ['id' => 1238533009, 'label' => 'Виктория Кынтикова','tg' => '@kyntikova'],
];

/* Публичный TG для клиентов */
const PUBLIC_TG_USERNAME = 'pandaGO_media';

/* Email для рассылок и дублей */
const SMTP_HOST = 'smtp.gmail.com';
const SMTP_PORT = 587;
const SMTP_USER = 'cargo.panda.go@gmail.com';
const SMTP_PASS = 'REPLACE-WITH-GMAIL-APP-PASSWORD';
const SMTP_FROM = 'cargo.panda.go@gmail.com';
const SMTP_FROM_NAME = 'PandaGo Cargo';

/* Пути */
const DATA_FILE  = __DIR__ . '/data.json';
const LOG_DIR    = __DIR__ . '/logs';
const LOCK_FILE  = __DIR__ . '/data.lock';

/* Токен доступа к админ-API (передаётся заголовком X-Admin-Token) */
const ADMIN_TOKEN = 'PANDA-a4f8c2e9b1d3-CHANGE-ME';

/* Домен */
const SITE_URL = 'https://cargo-pandago.online/order/';
const CATALOG_URL = 'https://cargo-pandago.online/catalog/';

/* Курс USD/RUB (значение по умолчанию, переопределяется из data.json) */
const DEFAULT_RATE = 95;

/* Дожимы */
const NUDGE_1H_SEC  = 3600;         /* 1 час после заявки */
const NUDGE_24H_SEC = 86400;        /* 24 часа после заявки */
const DIGEST_HOUR   = 9;            /* Дайджест в 09:00 МСК */
const TZ            = 'Europe/Moscow';

/* Инициализация папок */
if (!is_dir(LOG_DIR)) @mkdir(LOG_DIR, 0755, true);
date_default_timezone_set(TZ);
