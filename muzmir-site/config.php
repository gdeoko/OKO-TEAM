<?php
/**
 * КЦ «Музыкальный Мир» — конфигурация.
 * Секреты НЕ хранятся в git. Значения берутся из переменных окружения,
 * либо из config.local.php (в .gitignore). Здесь только безопасные дефолты.
 */
declare(strict_types=1);

date_default_timezone_set('Europe/Moscow');
mb_internal_encoding('UTF-8');

if (!defined('BASE_PATH')) define('BASE_PATH', __DIR__);

/** Достаёт значение из окружения с дефолтом. */
if (!function_exists('env')) {
function env(string $key, $default = null) {
    $v = getenv($key);
    if ($v === false || $v === '') return $default;
    return $v;
}
}

// Локальные секреты (не в git) переопределяют окружение.
$localCfg = [];
if (is_file(__DIR__ . '/config.local.php')) {
    $localCfg = require __DIR__ . '/config.local.php';
}
if (!function_exists('cfg')) {
function cfg(string $key, $default = null) {
    global $localCfg;
    if (array_key_exists($key, $localCfg)) return $localCfg[$key];
    return env($key, $default);
}
}

return [
    // Организация
    'org_name'       => 'КЦ «Музыкальный Мир»',
    'org_full'       => 'Культурный центр «Музыкальный Мир»',
    'org_short'      => 'Музыкальный Мир',
    'org_reg'        => 'Роскомнадзор №094084 от 24.06.2025',
    'org_address'    => '109240, г. Москва, ул. Солянка, д.14, стр.7',
    'org_phone'      => '8 (950) 945-99-00',
    'org_phone_raw'  => '+79509459900',
    'org_email'      => 'kulturniy.centr.mir@mail.ru',
    'org_hours'      => 'Пн–Пт 09:00–18:00, Сб 10:00–16:00, Вс/праздники — выходной (МСК)',
    'org_vk'         => 'https://vk.com/music_world.online',
    'org_tg_channel' => 'https://t.me/kc_mus_mir',

    // Домен
    'domain'         => 'музыкальный-мир.рф',
    'domain_puny'    => 'xn----7sbugdeiegh1b0a9hen.xn--p1ai',
    'base_url'       => cfg('MUZMIR_BASE_URL', 'http://localhost:8080'),

    // База данных
    'db_path'        => BASE_PATH . '/data/muzmir.sqlite',

    // Почта (SMTP через cURL) — секреты и хост из окружения/config.local.
    // Переключение на mail.ru делается на проде через config.local.php без правки кода:
    //   MUZMIR_SMTP_HOST=smtp.mail.ru, MUZMIR_SMTP_USER=kulturniy.centr.mir@mail.ru,
    //   MUZMIR_SMTP_PASS=<пароль для внешних приложений mail.ru>, MUZMIR_SMTP_PORT=465 (SSL).
    'smtp_host'      => cfg('MUZMIR_SMTP_HOST', 'smtp.gmail.com'),
    'smtp_port'      => (int) cfg('MUZMIR_SMTP_PORT', 465),
    'smtp_user'      => cfg('MUZMIR_SMTP_USER', 'kulturniy.centr.mir@gmail.com'),
    'smtp_pass'      => cfg('MUZMIR_SMTP_PASS', ''),   // App Password — только env/local
    'mail_from_name' => 'КЦ «Музыкальный Мир»',
    'mail_reply_to'  => 'kulturniy.centr.mir@mail.ru',
    // Дневной лимит Gmail — рассылки идут очередью батчами
    'mail_daily_limit' => (int) cfg('MUZMIR_MAIL_DAILY_LIMIT', 400),
    'mail_batch_size'  => (int) cfg('MUZMIR_MAIL_BATCH', 40),

    // Telegram
    'tg_bot_token'   => cfg('MUZMIR_TG_BOT_TOKEN', ''),
    'tg_bot_user'    => cfg('MUZMIR_TG_BOT_USER', 'kc_muz_mir_bot'),
    'tg_admin_chat'  => cfg('MUZMIR_TG_ADMIN_CHAT', ''),

    // OAuth (вход через соцсети) — секреты только из окружения/local
    'vk_client_id'         => cfg('MUZMIR_VK_CLIENT_ID', ''),
    'vk_client_secret'     => cfg('MUZMIR_VK_CLIENT_SECRET', ''),
    'vk_redirect'          => cfg('MUZMIR_VK_REDIRECT', ''),      // необязательно: переопределить callback URL

    // MAX (мессенджер Max, max.ru / Max ID OAuth) — секреты только из окружения/local
    'max_client_id'        => cfg('MUZMIR_MAX_CLIENT_ID', ''),
    'max_client_secret'    => cfg('MUZMIR_MAX_CLIENT_SECRET', ''),
    'max_redirect'         => cfg('MUZMIR_MAX_REDIRECT', ''),     // необязательно: переопределить callback URL
    // Точки OAuth MAX (переопределяемы, если провайдер сменит адреса)
    'max_authorize_url'    => cfg('MUZMIR_MAX_AUTHORIZE_URL', 'https://oauth.max.ru/authorize'),
    'max_token_url'        => cfg('MUZMIR_MAX_TOKEN_URL', 'https://oauth.max.ru/token'),
    'max_profile_url'      => cfg('MUZMIR_MAX_PROFILE_URL', 'https://oauth.max.ru/userinfo'),
    'max_scope'            => cfg('MUZMIR_MAX_SCOPE', 'openid profile email'),

    // SMS-провайдер для OTP входа по телефону (по умолчанию SMS.RU). Без ключа — dev-режим.
    'sms_provider'         => cfg('MUZMIR_SMS_PROVIDER', 'smsru'),
    'sms_api_id'           => cfg('MUZMIR_SMS_API_ID', ''),        // api_id SMS.RU (или ключ провайдера)
    'sms_from'             => cfg('MUZMIR_SMS_FROM', ''),          // имя отправителя (если одобрено)

    // ЮKassa (включается после верификации магазина)
    'yukassa_shop'   => cfg('MUZMIR_YUKASSA_SHOP', ''),
    'yukassa_secret' => cfg('MUZMIR_YUKASSA_SECRET', ''),

    // Внешние сервисы
    'dadata_token'   => cfg('MUZMIR_DADATA_TOKEN', ''),
    'dadata_secret'  => cfg('MUZMIR_DADATA_SECRET', ''),
    'recaptcha_site' => cfg('MUZMIR_RECAPTCHA_SITE', ''),
    'recaptcha_secret' => cfg('MUZMIR_RECAPTCHA_SECRET', ''),
    'metrika_id'     => cfg('MUZMIR_METRIKA_ID', ''),

    // Агент-мозг (внешний агент соцсетей Музмира)
    'agent_url'      => cfg('MUZMIR_AGENT_URL', ''),
    'agent_token'    => cfg('MUZMIR_AGENT_TOKEN', ''),

    'debug'          => (bool) cfg('MUZMIR_DEBUG', false),
    'year'           => (int) date('Y'),
];
