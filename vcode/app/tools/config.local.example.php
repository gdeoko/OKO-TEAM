<?php
/**
 * Пример боевых настроек. На сервере лежит как core/config.local.php
 * и в git НЕ попадает (см. .gitignore).
 */
return [
  'bot_token'  => 'ТОКЕН_БОТА',            // @vcodemedia_bot
  'bot_secret' => 'СЕКРЕТ_ВЕБХУКА',        // любая длинная строка
  'admin_ids'  => [111111111, 222222222],  // telegram id владельца и Владимира
  'admin_pass' => 'ПАРОЛЬ_ПАНЕЛИ',
  'base_url'   => 'https://lionoff.okoteam.top',
  'support'    => '@Vladimir_12609',
  'lava'       => ['key' => '', 'offer_pro' => '', 'offer_course' => ''],
  'yookassa'   => ['shop' => '', 'secret' => ''],
  'plan_price' => ['pro' => 1490, 'mentor' => 4900],
];
