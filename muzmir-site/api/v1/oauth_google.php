<?php
/**
 * Вход через Google (OAuth 2.0 / OpenID Connect).
 * Без ?code — инициация: редирект на consent-экран Google.
 * С ?code — обмен кода на токен, профиль (email/sub), find-or-create по google_id, вход.
 */
declare(strict_types=1);
require __DIR__ . '/_boot.php';

$clientId     = (string) cfgv('google_client_id');
$clientSecret = (string) cfgv('google_client_secret');
$redirectUri  = url('/api/v1/oauth_google');

if ($clientId === '' || $clientSecret === '') {
    flash('Вход через Google скоро будет доступен.', 'info');
    redirect('/login');
}

$code  = input('code');
$state = input('state');
$err   = input('error');

if ($err !== '') {
    flash('Вход через Google отменён.', 'error');
    redirect('/login');
}

// --- Шаг 1: инициация ---
if ($code === '') {
    $st = bin2hex(random_bytes(16));
    $_SESSION['oauth_google_state'] = $st;
    $auth = 'https://accounts.google.com/o/oauth2/v2/auth?' . http_build_query([
        'client_id'     => $clientId,
        'redirect_uri'  => $redirectUri,
        'response_type' => 'code',
        'scope'         => 'openid email profile',
        'state'         => $st,
        'access_type'   => 'online',
        'prompt'        => 'select_account',
    ]);
    redirect($auth);
}

// --- Шаг 2: возврат с кодом ---
if ($state === '' || !hash_equals((string)($_SESSION['oauth_google_state'] ?? ''), $state)) {
    flash('Сессия входа устарела. Попробуйте ещё раз.', 'error');
    redirect('/login');
}
unset($_SESSION['oauth_google_state']);

// Обмен кода на токен.
$ch = curl_init('https://oauth2.googleapis.com/token');
curl_setopt_array($ch, [
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_POST           => true,
    CURLOPT_POSTFIELDS     => http_build_query([
        'code'          => $code,
        'client_id'     => $clientId,
        'client_secret' => $clientSecret,
        'redirect_uri'  => $redirectUri,
        'grant_type'    => 'authorization_code',
    ]),
    CURLOPT_TIMEOUT        => 15,
]);
$resp = curl_exec($ch);
$cerr = curl_errno($ch);
curl_close($ch);
if ($cerr || !$resp) { flash('Не удалось связаться с Google. Попробуйте позже.', 'error'); redirect('/login'); }
$tok = json_decode((string)$resp, true);
$accessToken = $tok['access_token'] ?? '';
if ($accessToken === '') { flash('Google отклонил вход. Попробуйте ещё раз.', 'error'); redirect('/login'); }

// Профиль пользователя.
$ch = curl_init('https://openidconnect.googleapis.com/v1/userinfo');
curl_setopt_array($ch, [
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_HTTPHEADER     => ['Authorization: Bearer ' . $accessToken],
    CURLOPT_TIMEOUT        => 15,
]);
$pr = curl_exec($ch);
$perr = curl_errno($ch);
curl_close($ch);
if ($perr || !$pr) { flash('Не удалось получить профиль Google.', 'error'); redirect('/login'); }
$profile = json_decode((string)$pr, true) ?: [];

$sub   = (string)($profile['sub'] ?? '');
$email = mb_strtolower(trim((string)($profile['email'] ?? '')));
$name  = trim((string)($profile['name'] ?? ''));
$pic   = (string)($profile['picture'] ?? '');
if ($sub === '') { flash('Google не вернул идентификатор аккаунта.', 'error'); redirect('/login'); }

// find-or-create по google_id, затем по email.
$user = one("SELECT * FROM users WHERE google_id=? AND google_id<>''", [$sub]);
if (!$user && $email !== '') $user = one("SELECT * FROM users WHERE email=?", [$email]);

if ($user) {
    $upd = [];
    if (($user['google_id'] ?? '') === '')  $upd['google_id'] = $sub;
    if ((int)($user['email_verified'] ?? 0) !== 1) $upd['email_verified'] = 1;
    if (($user['avatar'] ?? '') === '' && $pic !== '') $upd['avatar'] = $pic;
    if (($user['full_name'] ?? '') === '' && $name !== '') $upd['full_name'] = $name;
    if ($upd) update('users', $upd, 'id=:id', ['id' => (int)$user['id']]);
    $uid = (int)$user['id'];
} else {
    $uid = insert('users', [
        'email'          => $email,
        'google_id'      => $sub,
        'full_name'      => $name,
        'avatar'         => $pic,
        'email_verified' => 1,
        'role'           => 'user',
    ]);
}

login_user($uid);
audit('login_google', 'user', $uid, ['google_id' => $sub]);
flash('Вы вошли через Google.', 'success');
redirect('/cabinet');
