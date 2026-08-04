<?php
/**
 * Вход через VK ID (id.vk.com, OAuth 2.1 + PKCE) — мгновенная регистрация в 1 клик.
 * Старый флоу oauth.vk.com для новых приложений VK возвращает 401 и не работает —
 * приложение 54700545 создано в VK ID, поэтому:
 *   Шаг 1 (без ?code): генерим state + code_verifier (PKCE), редирект на
 *     https://id.vk.com/authorize с code_challenge (S256) и scope=email.
 *   Шаг 2 (возврат с ?code&device_id): POST https://id.vk.com/oauth2/auth
 *     (grant_type=authorization_code + code_verifier + device_id) → access_token,
 *     затем POST https://id.vk.com/oauth2/user_info → имя, аватар, email, телефон.
 * Дальше upsert users (по vk_id / email), логин, subscribers, /cabinet?auth=ok.
 * Redirect URI должен буквально совпадать с «Доверенным Redirect URL» в настройках
 * приложения VK ID (cfgv('vk_redirect')).
 */
declare(strict_types=1);
require __DIR__ . '/_boot.php';

$clientId    = (string) cfgv('vk_client_id');
$redirectUri = ($ov = (string) cfgv('vk_redirect')) !== '' ? $ov : url('/api/v1/oauth_vk');

// Креды не заданы — мягкий JSON для фронта (кнопка покажет подсказку).
if ($clientId === '') {
    json_out([
        'ok'         => false,
        'need_setup' => true,
        'provider'   => 'vk',
        'hint'       => 'Вход через VK ещё не настроен: задайте MUZMIR_VK_CLIENT_ID в окружении.',
    ]);
}

$code  = input('code');
$state = input('state');
$err   = input('error');

if ($err !== '') {
    flash('Вход через VK отменён.', 'error');
    redirect('/login');
}

// --- Шаг 1: инициация (PKCE) ---
if ($code === '') {
    $st       = bin2hex(random_bytes(16));
    $verifier = rtrim(strtr(base64_encode(random_bytes(48)), '+/', '-_'), '=');
    $_SESSION['oauth_vk_state']    = $st;
    $_SESSION['oauth_vk_verifier'] = $verifier;
    $challenge = rtrim(strtr(base64_encode(hash('sha256', $verifier, true)), '+/', '-_'), '=');
    $auth = 'https://id.vk.com/authorize?' . http_build_query([
        'response_type'         => 'code',
        'client_id'             => $clientId,
        'redirect_uri'          => $redirectUri,
        'scope'                 => 'email',
        'state'                 => $st,
        'code_challenge'        => $challenge,
        'code_challenge_method' => 's256',
    ]);
    redirect($auth);
}

// --- Шаг 2: возврат с кодом ---
if ($state === '' || !hash_equals((string)($_SESSION['oauth_vk_state'] ?? ''), $state)) {
    flash('Сессия входа устарела. Попробуйте ещё раз.', 'error');
    redirect('/login');
}
$verifier = (string)($_SESSION['oauth_vk_verifier'] ?? '');
unset($_SESSION['oauth_vk_state'], $_SESSION['oauth_vk_verifier']);
$deviceId = input('device_id');

// Обмен кода на access_token (VK ID: POST form-data, PKCE вместо client_secret).
$ch = curl_init('https://id.vk.com/oauth2/auth');
curl_setopt_array($ch, [
    CURLOPT_POST => true,
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_TIMEOUT => 15,
    CURLOPT_POSTFIELDS => http_build_query([
        'grant_type'    => 'authorization_code',
        'code'          => $code,
        'code_verifier' => $verifier,
        'client_id'     => $clientId,
        'device_id'     => $deviceId,
        'redirect_uri'  => $redirectUri,
        'state'         => $state,
    ]),
]);
$resp = curl_exec($ch);
$cerr = curl_errno($ch);
curl_close($ch);
if ($cerr || !$resp) { flash('Не удалось связаться с VK. Попробуйте позже.', 'error'); redirect('/login'); }

$tok = json_decode((string)$resp, true) ?: [];
$accessToken = (string)($tok['access_token'] ?? '');
$vkUserId    = (string)($tok['user_id'] ?? '');
if ($accessToken === '' || $vkUserId === '') {
    error_log('oauth_vk: token exchange failed: ' . substr((string)$resp, 0, 300));
    flash('VK отклонил вход. Попробуйте ещё раз.', 'error');
    redirect('/login');
}

// Профиль VK ID: имя, аватар, email (если пользователь разрешил).
$name = ''; $avatar = ''; $email = '';
$ch = curl_init('https://id.vk.com/oauth2/user_info');
curl_setopt_array($ch, [
    CURLOPT_POST => true,
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_TIMEOUT => 10,
    CURLOPT_POSTFIELDS => http_build_query([
        'access_token' => $accessToken,
        'client_id'    => $clientId,
    ]),
]);
$pr = curl_exec($ch);
curl_close($ch);
if ($pr) {
    $pd = json_decode((string)$pr, true);
    $u  = $pd['user'] ?? [];
    $name   = trim((string)($u['first_name'] ?? '') . ' ' . (string)($u['last_name'] ?? ''));
    $avatar = (string)($u['avatar'] ?? '');
    $email  = mb_strtolower(trim((string)($u['email'] ?? '')));
}

// upsert users (по vk_id / email), сохранение имени + аватара, вход.
// Фиксируем максимальный id до upsert: если после вернётся больший id — это новый пользователь.
$maxIdBefore = (int) (one("SELECT MAX(id) AS m FROM users")['m'] ?? 0);
$uid = auth_upsert_social('vk', $vkUserId, $name, $email, $avatar);
$isNewUser = $uid > $maxIdBefore;

login_user($uid);
auth_add_subscriber($email, $name, 'vk');   // email может отсутствовать — тогда no-op
audit('login_vk', 'user', $uid, ['vk_user_id' => $vkUserId]);

// Приветственное письмо — один раз, только новым пользователям и при наличии email.
if ($isNewUser && $email !== '' && function_exists('mail_queue') && function_exists('mail_template')) {
    mail_queue($email, $name, 'Добро пожаловать в «Музыкальный Мир»', mail_template('welcome', ['name' => $name]));
}
redirect('/cabinet?auth=ok');
