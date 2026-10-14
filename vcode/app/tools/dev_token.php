<?php
/** Тестовый вход без Телеграма: php tools/dev_token.php [tg_id] — печатает токен. */
require_once __DIR__ . '/../core/auth.php';
$tg = (int)($argv[1] ?? 777000111);
$u = vc_user_upsert(['id' => $tg, 'username' => 'vcode_test', 'first_name' => 'Тест',
                     'last_name' => 'Креатор'], 'dev');
echo vc_token_make((int)$u['id']), "\n";
