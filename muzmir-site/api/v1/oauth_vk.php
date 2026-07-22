<?php
/**
 * Вход через VK (OAuth 2.0, oauth.vk.com) — мгновенная регистрация в 1 клик.
 * Без ?code — инициация: редирект на экран разрешений VK (scope=email).
 * С ?code — обмен на access_token (в ответе user_id + email), тянем имя + фото (photo_200),
 * upsert users (роль participant='user'), сохраняем avatar+имя, логиним, пишем в subscribers,
 * редирект /cabinet?auth=ok.
 * Связка: по vk_id (добавляется в users при первом входе) и по подтверждённому email из VK.
 * Креды VK — из env через cfgv(); если не заданы — JSON {ok:false, need_setup:true}.
 */
declare(strict_types=1);
require __DIR__ . '/_boot.php';

$clientId     = (string) cfgv('vk_client_id');
$clientSecret = (string) cfgv('vk_client_secret');
$redirectUri  = ($ov = (string) cfgv('vk_redirect')) !== '' ? $ov : url('/api/v1/oauth_vk');

// Креды не заданы — мягкий JSON для фронта (кнопка покажет подсказку).
if ($clientId === '' || $clientSecret === '') {
    json_out([
        'ok'         => false,
        'need_setup' => true,
        'provider'   => 'vk',
        'hint'       => 'Вход через VK ещё не настроен: задайте MUZMIR_VK_CLIENT_ID и MUZMIR_VK_CLIENT_SECRET в окружении.',
    ]);
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
curl_setopt_array($ch, [CURLOPT_RETURNTRANSFER => true, CURLOPT_TIMEOUT => 15]);
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

// Профиль: имя + фото (photo_200). Best-effort через users.get; тихий фолбэк.
$name = ''; $avatar = '';
$ch = curl_init('https://api.vk.com/method/users.get?' . http_build_query([
    'user_ids'     => $vkUserId,
    'fields'       => 'photo_200',
    'access_token' => $accessToken,
    'v'            => '5.199',
]));
curl_setopt_array($ch, [CURLOPT_RETURNTRANSFER => true, CURLOPT_TIMEOUT => 10]);
$pr = curl_exec($ch);
curl_close($ch);
if ($pr) {
    $pd    = json_decode((string)$pr, true);
    $first = $pd['response'][0]['first_name'] ?? '';
    $last  = $pd['response'][0]['last_name'] ?? '';
    $name  = trim($first . ' ' . $last);
    $avatar = (string)($pd['response'][0]['photo_200'] ?? '');
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
