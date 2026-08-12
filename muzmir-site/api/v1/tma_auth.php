<?php
/** POST initData из Telegram Mini App → проверка HMAC-подписи, вход/создание пользователя по tg_id. */
declare(strict_types=1);
require __DIR__ . '/_boot.php';
require_post();

$initData = input('initData');
if ($initData === '') $initData = input('init_data');
if ($initData === '') json_out(['ok' => false, 'error' => 'Нет данных авторизации'], 422);

$botToken = cfgv('tg_bot_token');
if (!$botToken) json_out(['ok' => false, 'error' => 'Бот не настроен'], 503);

parse_str($initData, $params);
$hash = $params['hash'] ?? '';
unset($params['hash'], $params['signature']);
if ($hash === '') json_out(['ok' => false, 'error' => 'Нет подписи'], 422);

ksort($params);
$pairs = [];
foreach ($params as $k => $v) $pairs[] = $k . '=' . $v;
$dcs = implode("\n", $pairs);

$secret = hash_hmac('sha256', $botToken, 'WebAppData', true);
$calc = hash_hmac('sha256', $dcs, $secret);
if (!hash_equals($calc, $hash)) json_out(['ok' => false, 'error' => 'Подпись недействительна'], 401);

// Свежесть данных (24 часа).
if (!empty($params['auth_date']) && (time() - (int) $params['auth_date']) > 86400) {
    json_out(['ok' => false, 'error' => 'Данные авторизации устарели'], 401);
}

$tgUser = json_decode($params['user'] ?? '{}', true) ?: [];
$tgId = (string) ($tgUser['id'] ?? '');
if ($tgId === '') json_out(['ok' => false, 'error' => 'Нет данных пользователя'], 422);

$row = one("SELECT * FROM users WHERE tg_id=?", [$tgId]);
if (!$row) {
    $name = trim(($tgUser['first_name'] ?? '') . ' ' . ($tgUser['last_name'] ?? ''));
    $uid = insert('users', [
        'tg_id'     => $tgId,
        'full_name' => $name !== '' ? $name : ('Гость tg' . $tgId),
        'avatar'    => $tgUser['photo_url'] ?? '',
        'role'      => 'user',
    ]);
} else {
    $uid = (int) $row['id'];
}

login_user($uid);
audit('tma_auth', 'users', $uid, ['tg_id' => $tgId]);

json_out(['ok' => true, 'user' => ['id' => $uid, 'tg_id' => $tgId]]);
