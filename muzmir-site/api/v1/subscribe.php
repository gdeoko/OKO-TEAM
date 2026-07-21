<?php
/** POST email → подписка на новости (дедуп, unsub_token). */
declare(strict_types=1);
require __DIR__ . '/_boot.php';
require_post();

if (!rate_ok('subscribe:' . client_ip(), 20, 3600)) {
    json_out(['ok' => false, 'message' => 'Слишком много запросов, попробуйте позже'], 429);
}

$email = mb_strtolower(input('email'));
$valid = function_exists('v_email') ? v_email($email) : ['ok' => (bool) filter_var($email, FILTER_VALIDATE_EMAIL)];
if (!($valid['ok'] ?? false)) {
    json_out(['ok' => false, 'message' => 'Проверьте адрес электронной почты'], 422);
}

$existing = one("SELECT id, active FROM subscribers WHERE email=?", [$email]);
if ($existing) {
    if (!(int) $existing['active']) {
        update('subscribers', ['active' => 1], 'id=:id', ['id' => $existing['id']]);
    }
    json_out(['ok' => true, 'message' => 'Вы уже подписаны на новости']);
}

$token = bin2hex(random_bytes(16));
insert('subscribers', [
    'email'       => $email,
    'name'        => input('name'),
    'source'      => input('source', 'site'),
    'unsub_token' => $token,
    'active'      => 1,
]);
audit('subscribe', 'subscribers', null, ['email' => $email]);

json_out(['ok' => true, 'message' => 'Подписка оформлена. Спасибо!']);
