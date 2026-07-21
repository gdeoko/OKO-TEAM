<?php
/**
 * Вход через VK (OAuth 2.0, oauth.vk.com).
 * Без ?code — инициация: редирект на экран разрешений VK (scope=email).
 * С ?code — обмен на access_token (в ответе приходят user_id и email), find-or-create по email, вход.
 * В схеме users нет отдельного столбца vk_id, поэтому связка идёт по подтверждённому email из VK.
 */
declare(strict_types=1);
require __DIR__ . '/_boot.php';

$clientId     = (string) cfgv('vk_client_id');
$clientSecret = (string) cfgv('vk_client_secret');
$redirectUri  = url('/api/v1/oauth_vk');

if ($clientId === '' || $clientSecret === '') {
    flash('Вход через VK скоро будет доступен.', 'info');
    redirect('/login');
}

$code  = input('code');
$state = input('state');
$err   = input('error');

if ($err !== '') {
    flash('Вход через VK отменён.', 'error');
    redirect('/login');
}

// --- Шаг 1: инициация ---
if ($code === '') {
    $st = bin2hex(random_bytes(16));
    $_SESSION['oauth_vk_state'] = $st;
    $auth = 'https://oauth.vk.com/authorize?' . http_build_query([
        'client_id'     => $clientId,
        'redirect_uri'  => $redirectUri,
        'response_type' => 'code',
        'scope'         => 'email',
        'state'         => $st,
        'display'       => 'page',
        'v'             => '5.199',
    ]);
    redirect($auth);
}

// --- Шаг 2: возврат с кодом ---
if ($state === '' || !hash_equals((string)($_SESSION['oauth_vk_state'] ?? ''), $state)) {
    flash('Сессия входа устарела. Попробуйте ещё раз.', 'error');
    redirect('/login');
}
unset($_SESSION['oauth_vk_state']);

// Обмен кода на access_token (VK отдаёт JSON с access_token, user_id, email).
$ch = curl_init('https://oauth.vk.com/access_token?' . http_build_query([
    'client_id'     => $clientId,
    'client_secret' => $clientSecret,
    'redirect_uri'  => $redirectUri,
    'code'          => $code,
]));
curl_setopt_array($ch, [
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_TIMEOUT        => 15,
]);
$resp = curl_exec($ch);
$cerr = curl_errno($ch);
curl_close($ch);
if ($cerr || !$resp) { flash('Не удалось связаться с VK. Попробуйте позже.', 'error'); redirect('/login'); }

$tok = json_decode((string)$resp, true) ?: [];
$accessToken = (string)($tok['access_token'] ?? '');
$vkUserId    = (string)($tok['user_id'] ?? '');
$email       = mb_strtolower(trim((string)($tok['email'] ?? '')));
if ($accessToken === '' || $vkUserId === '') {
    flash('VK отклонил вход. Попробуйте ещё раз.', 'error');
    redirect('/login');
}

// Имя пользователя (best-effort через users.get; тихий фолбэк).
$name = '';
$ch = curl_init('https://api.vk.com/method/users.get?' . http_build_query([
    'user_ids'     => $vkUserId,
    'access_token' => $accessToken,
    'v'            => '5.199',
]));
curl_setopt_array($ch, [CURLOPT_RETURNTRANSFER => true, CURLOPT_TIMEOUT => 10]);
$pr = curl_exec($ch);
curl_close($ch);
if ($pr) {
    $pd = json_decode((string)$pr, true);
    $first = $pd['response'][0]['first_name'] ?? '';
    $last  = $pd['response'][0]['last_name'] ?? '';
    $name  = trim($first . ' ' . $last);
}

// VK не всегда отдаёт email. Без email надёжной связки нет — предлагаем обычный вход.
if ($email === '') {
    flash('VK не передал адрес почты. Войдите по почте или через Google.', 'error');
    redirect('/login');
}

// find-or-create по email.
$user = one("SELECT * FROM users WHERE email=?", [$email]);
if ($user) {
    $upd = [];
    if ((int)($user['email_verified'] ?? 0) !== 1) $upd['email_verified'] = 1;
    if (($user['full_name'] ?? '') === '' && $name !== '') $upd['full_name'] = $name;
    if ($upd) update('users', $upd, 'id=:id', ['id' => (int)$user['id']]);
    $uid = (int)$user['id'];
} else {
    $uid = insert('users', [
        'email'          => $email,
        'full_name'      => $name,
        'email_verified' => 1,
        'role'           => 'user',
    ]);
}

login_user($uid);
audit('login_vk', 'user', $uid, ['vk_user_id' => $vkUserId]);
flash('Вы вошли через VK.', 'success');
redirect('/cabinet');
