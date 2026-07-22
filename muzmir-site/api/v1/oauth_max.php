<?php
/**
 * Вход через MAX (мессенджер Max, max.ru / Max ID OAuth 2.0) — мгновенная регистрация.
 * Флоу как у VK/Google: authorize → callback(code) → token → профиль → upsert users → вход.
 * Без ?code — редирект на consent MAX. С ?code — обмен на токен, профиль (id/email/name/avatar),
 * upsert users (роль 'user'), сохранение имени+фото, login, subscribers(source='max'),
 * редирект /cabinet?auth=ok.
 * Точки OAuth и креды — из env через cfgv(); если креды не заданы — JSON {ok:false, need_setup:true}.
 */
declare(strict_types=1);
require __DIR__ . '/_boot.php';

$clientId     = (string) cfgv('max_client_id');
$clientSecret = (string) cfgv('max_client_secret');
$redirectUri  = ($ov = (string) cfgv('max_redirect')) !== '' ? $ov : url('/api/v1/oauth_max');

$authorizeUrl = (string) cfgv('max_authorize_url', 'https://oauth.max.ru/authorize');
$tokenUrl     = (string) cfgv('max_token_url', 'https://oauth.max.ru/token');
$profileUrl   = (string) cfgv('max_profile_url', 'https://oauth.max.ru/userinfo');
$scope        = (string) cfgv('max_scope', 'openid profile email');

// Креды не заданы — мягкий JSON (кнопка на фронте покажет подсказку / ведёт на инструкцию).
if ($clientId === '' || $clientSecret === '') {
    json_out([
        'ok'         => false,
        'need_setup' => true,
        'provider'   => 'max',
        'hint'       => 'Вход через MAX ещё не настроен: задайте MUZMIR_MAX_CLIENT_ID и MUZMIR_MAX_CLIENT_SECRET в окружении (плюс, при необходимости, MUZMIR_MAX_AUTHORIZE_URL / MUZMIR_MAX_TOKEN_URL / MUZMIR_MAX_PROFILE_URL).',
    ]);
}

$code  = input('code');
$state = input('state');
$err   = input('error');

if ($err !== '') {
    flash('Вход через MAX отменён.', 'error');
    redirect('/login');
}

// --- Шаг 1: инициация ---
if ($code === '') {
    $st = bin2hex(random_bytes(16));
    $_SESSION['oauth_max_state'] = $st;
    $auth = $authorizeUrl . '?' . http_build_query([
        'client_id'     => $clientId,
        'redirect_uri'  => $redirectUri,
        'response_type' => 'code',
        'scope'         => $scope,
        'state'         => $st,
    ]);
    redirect($auth);
}

// --- Шаг 2: возврат с кодом ---
if ($state === '' || !hash_equals((string)($_SESSION['oauth_max_state'] ?? ''), $state)) {
    flash('Сессия входа устарела. Попробуйте ещё раз.', 'error');
    redirect('/login');
}
unset($_SESSION['oauth_max_state']);

// Обмен кода на токен (стандартный authorization_code).
$ch = curl_init($tokenUrl);
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
    CURLOPT_HTTPHEADER     => ['Accept: application/json'],
    CURLOPT_TIMEOUT        => 15,
]);
$resp = curl_exec($ch);
$cerr = curl_errno($ch);
curl_close($ch);
if ($cerr || !$resp) { flash('Не удалось связаться с MAX. Попробуйте позже.', 'error'); redirect('/login'); }

$tok = json_decode((string)$resp, true) ?: [];
$accessToken = (string)($tok['access_token'] ?? '');
if ($accessToken === '') { flash('MAX отклонил вход. Попробуйте ещё раз.', 'error'); redirect('/login'); }

// Профиль пользователя (Bearer). Поддерживаем и OIDC (sub), и «плоские» ответы.
$ch = curl_init($profileUrl);
curl_setopt_array($ch, [
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_HTTPHEADER     => ['Authorization: Bearer ' . $accessToken, 'Accept: application/json'],
    CURLOPT_TIMEOUT        => 15,
]);
$pr   = curl_exec($ch);
$perr = curl_errno($ch);
curl_close($ch);
if ($perr || !$pr) { flash('Не удалось получить профиль MAX.', 'error'); redirect('/login'); }

$profile = json_decode((string)$pr, true) ?: [];
// Разные провайдеры кладут поля по-разному — берём наиболее вероятные ключи.
$extId  = (string)($profile['sub'] ?? $profile['id'] ?? $profile['user_id'] ?? '');
$email  = mb_strtolower(trim((string)($profile['email'] ?? '')));
$name   = trim((string)($profile['name'] ?? trim(((string)($profile['first_name'] ?? '')) . ' ' . ((string)($profile['last_name'] ?? '')))));
$avatar = (string)($profile['picture'] ?? $profile['avatar'] ?? $profile['photo'] ?? $profile['photo_url'] ?? '');

if ($extId === '') { flash('MAX не вернул идентификатор аккаунта.', 'error'); redirect('/login'); }

// upsert users (по max_id / email), сохранение имени + аватара, вход.
// Фиксируем максимальный id до upsert: если после вернётся больший id — это новый пользователь.
$maxIdBefore = (int) (one("SELECT MAX(id) AS m FROM users")['m'] ?? 0);
$uid = auth_upsert_social('max', $extId, $name, $email, $avatar);
$isNewUser = $uid > $maxIdBefore;

login_user($uid);
auth_add_subscriber($email, $name, 'max');   // email может отсутствовать — тогда no-op
audit('login_max', 'user', $uid, ['max_id' => $extId]);

// Приветственное письмо — один раз, только новым пользователям и при наличии email.
if ($isNewUser && $email !== '' && function_exists('mail_queue') && function_exists('mail_template')) {
    mail_queue($email, $name, 'Добро пожаловать в «Музыкальный Мир»', mail_template('welcome', ['name' => $name]));
}
redirect('/cabinet?auth=ok');
