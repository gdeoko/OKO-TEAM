<?php
/**
 * V.LIONOFF · настройки.
 *
 * Ключей в git нет и не будет: значения приезжают из окружения или из
 * config.local.php рядом (он в .gitignore и живёт только на сервере).
 */

$VC = [
  'name'        => 'V.LIONOFF',
  'tagline'     => 'Школа контент-креаторов и биржа заказов',
  'base_url'    => 'https://lionoff.okoteam.top',
  'bot'         => 'vcodemedia_bot',
  'bot_token'   => '',          // 8871345918:AA... — только в config.local.php
  'bot_secret'  => '',          // секрет вебхука telegram
  'admin_ids'   => [],          // telegram id администраторов
  'admin_pass'  => '',          // пароль входа в админку (хеш или строка)
  'db'          => __DIR__ . '/../data/vcode.db',
  'uploads'     => __DIR__ . '/../public_html/uploads',
  'session_key' => '',          // соль подписи токена сессии
  'lava'        => ['key' => '', 'offer_pro' => '', 'offer_course' => ''],
  'yookassa'    => ['shop' => '', 'secret' => ''],
  'support'     => '@Vladimir_12609',
  'channel'     => '',
  'fee_percent' => 20,
  'plan_price'  => ['pro' => 1490, 'mentor' => 4900],
  'debug'       => false,
];

foreach ([
  'VCODE_BOT_TOKEN'  => 'bot_token',
  'VCODE_BOT_SECRET' => 'bot_secret',
  'VCODE_ADMIN_PASS' => 'admin_pass',
  'VCODE_SESSION_KEY'=> 'session_key',
  'VCODE_BASE_URL'   => 'base_url',
] as $env => $key) {
  $v = getenv($env);
  if ($v !== false && $v !== '') { $VC[$key] = $v; }
}
if ($ids = getenv('VCODE_ADMIN_IDS')) {
  $VC['admin_ids'] = array_values(array_filter(array_map('intval', explode(',', $ids))));
}
if (is_file(__DIR__ . '/config.local.php')) {
  $local = require __DIR__ . '/config.local.php';
  if (is_array($local)) { $VC = array_replace_recursive($VC, $local); }
}
if ($VC['session_key'] === '') {
  // Без своей соли подпись сессии держится на токене бота: он уникален и
  // наружу не уходит. Пустой соли быть не должно никогда.
  $VC['session_key'] = $VC['bot_token'] !== '' ? hash('sha256', $VC['bot_token']) : 'vcode-dev-key';
}

return $VC;
