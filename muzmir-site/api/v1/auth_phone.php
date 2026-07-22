<?php
/**
 * Вход по телефону через OTP — мгновенная регистрация. Ответы — JSON.
 *
 * action=request → нормализуем номер (v_phone), генерируем 4-6 значный код, храним с TTL,
 *   отправляем SMS (если задан провайдер cfgv('sms_*')); иначе {ok:true, dev_hint} (код в hint
 *   только в debug, в проде не раскрываем).
 * action=verify → сверяем код, создаём/логиним users(phone), сессия, subscribers при наличии email.
 *
 * rate-limit по IP и по номеру, Origin-check (auth_origin_ok).
 */
declare(strict_types=1);
require __DIR__ . '/_boot.php';
require_post();

if (!auth_origin_ok()) {
    json_out(['ok' => false, 'error' => 'Недопустимый источник запроса'], 403);
}

$ip = client_ip();
if (!rate_ok('auth_phone:' . $ip, 30, 3600)) {
    json_out(['ok' => false, 'error' => 'Слишком много попыток, попробуйте позже'], 429);
}

$action  = input('action', 'request');
$phoneIn = input('phone');

// Нормализация номера к формату +7 (XXX) XXX-XX-XX и к 11-значным цифрам (7XXXXXXXXXX).
$digits = preg_replace('/\D+/', '', $phoneIn);
if (strlen($digits) === 11 && ($digits[0] === '8' || $digits[0] === '7')) {
    $digits = '7' . substr($digits, 1);
} elseif (strlen($digits) === 10) {
    $digits = '7' . $digits;
}
$vp = function_exists('v_phone') ? v_phone($phoneIn)
    : ['ok' => (strlen($digits) === 11 && $digits[0] === '7'), 'formatted' => $phoneIn];
if (!($vp['ok'] ?? false) || strlen($digits) !== 11 || $digits[0] !== '7') {
    json_out(['ok' => false, 'error' => 'Проверьте номер телефона'], 422);
}
$formatted = (string) ($vp['formatted'] ?? ('+' . $digits));

/* -------------------- action=request -------------------- */
if ($action === 'request') {
    if (!rate_ok('auth_phone_req:' . $digits, 5, 900)) {
        json_out(['ok' => false, 'error' => 'Слишком часто. Подождите пару минут'], 429);
    }

    $code = auth_gen_code(5);
    auth_store_code('phone', $digits, $code, 600);   // TTL 10 минут

    $text = 'Код для входа на сайт Музыкальный Мир: ' . $code;
    $sent = auth_send_sms($digits, $text);

    $out = ['ok' => true, 'sent' => $sent, 'need_verify' => true, 'phone' => $formatted,
            'message' => $sent ? 'Код отправлен по SMS' : 'Код сгенерирован'];
    // Код показываем ТОЛЬКО в debug и только если SMS реально не ушла (dev/локально).
    if (!$sent && cfgv('debug')) $out['dev_hint'] = $code;
    if (!$sent && !cfgv('debug')) {
        // Прод без настроенного SMS-провайдера — не раскрываем код, честно сообщаем.
        $out['message'] = 'SMS-вход временно недоступен. Войдите через VK, MAX или почту.';
        $out['sms_unavailable'] = true;
    }
    json_out($out);
}

/* -------------------- action=verify -------------------- */
if ($action === 'verify') {
    $code = trim((string) ($_POST['code'] ?? ''));
    if ($code === '' || !auth_check_code('phone', $digits, $code)) {
        json_out(['ok' => false, 'error' => 'Неверный или просроченный код'], 401);
    }

    $name  = input('name');
    $email = mb_strtolower(input('email'));

    // Ищем по нормализованному номеру (сравниваем и с формат-строкой, и с цифрами).
    $user = one("SELECT * FROM users WHERE phone=? OR phone=?", [$formatted, $digits]);
    if ($user) {
        $upd = [];
        if (($user['full_name'] ?? '') === '' && $name !== '') $upd['full_name'] = $name;
        if (($user['phone'] ?? '') === '')                     $upd['phone'] = $formatted;
        if ($upd) update('users', $upd, 'id=:id', ['id' => (int)$user['id']]);
        $uid = (int) $user['id'];
    } else {
        $uid = (int) insert('users', [
            'phone'     => $formatted,
            'email'     => $email !== '' && filter_var($email, FILTER_VALIDATE_EMAIL) ? $email : null,
            'full_name' => $name !== '' ? $name : ('Гость ' . substr($digits, -4)),
            'role'      => 'user',
        ]);
    }

    $isNewUser = !$user;   // запись не найдена → создан новый пользователь

    login_user($uid);
    // В subscribers попадёт только при наличии валидного email (ключ рассылок — email).
    auth_add_subscriber($email, $name, 'phone');
    audit('auth_phone_otp', 'user', $uid, ['phone' => $formatted]);

    // Приветственное письмо — один раз, только новым пользователям и при наличии email.
    if ($isNewUser && $email !== '' && function_exists('mail_queue') && function_exists('mail_template')) {
        mail_queue($email, $name, 'Добро пожаловать в «Музыкальный Мир»', mail_template('welcome', ['name' => $name]));
    }

    json_out(['ok' => true, 'registered' => true, 'redirect' => '/cabinet?auth=ok']);
}

json_out(['ok' => false, 'error' => 'Неизвестное действие'], 400);
