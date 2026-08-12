<?php
/**
 * Вход через Telegram Login Widget.
 * Виджет присылает поля id, first_name, last_name, username, photo_url, auth_date, hash.
 * Проверка подписи: secret = SHA256(bot_token) (raw), data_check_string = отсортированные
 * пары key=value через "\n" (без hash), затем HMAC-SHA256. find-or-create по tg_id, вход.
 * (Отличается от Mini App, где секрет = HMAC(bot_token, "WebAppData") — см. tma_auth.php.)
 */
declare(strict_types=1);
require __DIR__ . '/_boot.php';

$botToken = (string) cfgv('tg_bot_token');
if ($botToken === '') {
    flash('Вход через Telegram скоро будет доступен.', 'info');
    redirect('/login');
}

// Данные приходят GET-редиректом от виджета (или POST).
$data = !empty($_GET) ? $_GET : $_POST;
$hash = (string)($data['hash'] ?? '');
unset($data['hash']);

if ($hash === '' || empty($data['id'])) {
    flash('Нет данных авторизации Telegram.', 'error');
    redirect('/login');
}

// Проверка подписи.
$pairs = [];
foreach ($data as $k => $v) {
    if (in_array($k, ['_csrf', 'next'], true)) continue;
    $pairs[] = $k . '=' . $v;
}
sort($pairs);
$dcs    = implode("\n", $pairs);
$secret = hash('sha256', $botToken, true);
$calc   = hash_hmac('sha256', $dcs, $secret);
if (!hash_equals($calc, $hash)) {
    flash('Подпись Telegram недействительна.', 'error');
    redirect('/login');
}

// Свежесть данных (24 часа).
if (!empty($data['auth_date']) && (time() - (int)$data['auth_date']) > 86400) {
    flash('Данные авторизации Telegram устарели. Попробуйте ещё раз.', 'error');
    redirect('/login');
}

$tgId = (string)($data['id'] ?? '');
if ($tgId === '') { flash('Нет идентификатора Telegram.', 'error'); redirect('/login'); }

$name = trim((string)($data['first_name'] ?? '') . ' ' . (string)($data['last_name'] ?? ''));
$photo = (string)($data['photo_url'] ?? '');

$user = one("SELECT * FROM users WHERE tg_id=? AND tg_id<>''", [$tgId]);
if ($user) {
    $upd = [];
    if (($user['full_name'] ?? '') === '' && $name !== '') $upd['full_name'] = $name;
    if (($user['avatar'] ?? '') === '' && $photo !== '')   $upd['avatar'] = $photo;
    if ($upd) update('users', $upd, 'id=:id', ['id' => (int)$user['id']]);
    $uid = (int)$user['id'];
} else {
    $uid = insert('users', [
        'tg_id'     => $tgId,
        'full_name' => $name !== '' ? $name : ('Гость tg' . $tgId),
        'avatar'    => $photo,
        'role'      => 'user',
    ]);
}

login_user($uid);
audit('login_telegram', 'user', $uid, ['tg_id' => $tgId]);
flash('Вы вошли через Telegram.', 'success');
redirect('/cabinet');
