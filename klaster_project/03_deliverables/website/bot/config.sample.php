<?php
// Образец конфига бота. Реальный лежит на сервере в data/bot/config.php и в git НЕ кладётся.
return [
    'token'       => 'СЮДА_ТОКЕН_БОТА',
    'secret'      => 'СЛУЧАЙНАЯ_СТРОКА_ДЛЯ_URL_ВЕБХУКА',
    'bot'         => 'klaster_broker_bot',
    'channel'     => '@radialnya',
    'channel_url' => 'https://t.me/radialnya',
    'salt'        => 'случайная-соль-для-hmac',
    'admins'      => [1966985736, 985763484, 1042498250, 1197270901],
    'prizes'      => 3,
    'proxy'       => '',   // пусто: сервер ходит в Telegram API напрямую
];
