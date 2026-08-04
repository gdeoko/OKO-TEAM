<?php
/**
 * Регистрация / вход по e-mail — мгновенно, в 1 клик. Ответы — JSON.
 *
 * action=request:
 *   - если передан пароль → регистрация/вход по паролю сразу (создаём users при первом входе);
 *   - если пароль пуст → magic-code: шлём 6-значный код письмом (mail_queue), ждём verify.
 * action=verify:
 *   - сверяем код из письма → создаём/логиним пользователя (email подтверждён), сессия.
 *
 * Все регистрации → subscribers(source='email', active=1). Валидация email (v_email),
 * rate-limit по IP и по email, Origin-check (auth_origin_ok).
 */
declare(strict_types=1);
require __DIR__ . '/_boot.php';
require_post();

if (!auth_origin_ok()) {
    json_out(['ok' => false, 'error' => 'Недопустимый источник запроса'], 403);
}

$ip = client_ip();
if (!rate_ok('auth_email:' . $ip, 30, 3600)) {
    json_out(['ok' => false, 'error' => 'Слишком много попыток, попробуйте позже'], 429);
}

$action = input('action', 'request');
$emailRaw = mb_strtolower(input('email'));

$v = function_exists('v_email') ? v_email($emailRaw)
    : ['ok' => (bool) filter_var($emailRaw, FILTER_VALIDATE_EMAIL), 'reason' => 'Проверьте адрес электронной почты'];
if (!($v['ok'] ?? false)) {
    json_out(['ok' => false, 'error' => $v['reason'] ?? 'Проверьте адрес электронной почты'], 422);
}
$email = $emailRaw;

/* -------------------- action=request -------------------- */
if ($action === 'request') {
    if (!rate_ok('auth_email_req:' . $email, 6, 900)) {
        json_out(['ok' => false, 'error' => 'Слишком часто. Подождите пару минут'], 429);
    }
    $password = (string) ($_POST['password'] ?? '');

    // --- Режим пароля: моментальная регистрация или вход ---
    if ($password !== '') {
        if (mb_strlen($password) < 6) {
            json_out(['ok' => false, 'error' => 'Пароль слишком короткий (минимум 6 символов)'], 422);
        }
        $name = input('name');
        $user = one("SELECT * FROM users WHERE email=?", [$email]);

        if ($user) {
            if (($user['password_hash'] ?? '') !== '') {
                // Есть пароль — это вход.
                if (!password_verify($password, $user['password_hash'])) {
                    json_out(['ok' => false, 'error' => 'Неверная почта или пароль'], 401);
                }
                $uid = (int) $user['id'];
            } else {
                // Аккаунт заведён через соцсеть/OTP — устанавливаем пароль и входим.
                $upd = ['password_hash' => password_hash($password, PASSWORD_DEFAULT)];
                if (($user['full_name'] ?? '') === '' && $name !== '') $upd['full_name'] = $name;
                update('users', $upd, 'id=:id', ['id' => (int)$user['id']]);
                $uid = (int) $user['id'];
            }
        } else {
            $uid = (int) insert('users', [
                'email'          => $email,
                'password_hash'  => password_hash($password, PASSWORD_DEFAULT),
                'full_name'      => $name,
                'role'           => 'user',
                'email_verified' => 0,
            ]);
        }

        $isNewUser = !$user;   // запись не найдена → создан новый пользователь

        login_user($uid);
        auth_add_subscriber($email, input('name'), 'email');
        audit('auth_email_password', 'user', $uid, []);

        // Приветственное письмо — один раз, только новым пользователям и при наличии email.
        if ($isNewUser && $email !== '' && function_exists('mail_queue') && function_exists('mail_template')) {
            mail_queue($email, $name, 'Добро пожаловать в «Музыкальный Мир»', mail_template('welcome', ['name' => $name]));
        }

        if ($isNewUser && is_file(BASE_PATH . '/core/notify_owner.php')) {
            require_once BASE_PATH . '/core/notify_owner.php';
            owner_notify('РЕГИСТРАЦИИ', 'Новая регистрация (email + пароль)', '', [
                'Имя'    => $name,
                'Email'  => $email,
                '_event' => 'register',
                '_path'  => '/register',
                '_meta'  => ['user_id' => $uid, 'via' => 'email_password'],
            ]);
        }

        json_out(['ok' => true, 'registered' => true, 'redirect' => '/cabinet?auth=ok']);
    }

    // --- Режим magic-code: отправляем код письмом ---
    $code = auth_gen_code(6);
    auth_store_code('email', $email, $code, 900);

    $sent = false;
    if (function_exists('mail_queue')) {
        $logo = function_exists('logo_data_uri') ? logo_data_uri() : '';
        $html = '<div style="font-family:Montserrat,Arial,sans-serif;max-width:480px;margin:0 auto;padding:24px;color:#1a1a1a">'
              . ($logo ? '<div style="text-align:center;margin-bottom:16px"><img src="' . h($logo) . '" alt="Музыкальный Мир" style="height:56px"></div>' : '')
              . '<h2 style="text-align:center;margin:0 0 8px">Код для входа</h2>'
              . '<p style="text-align:center;margin:0 0 16px;color:#555">КЦ «Музыкальный Мир»</p>'
              . '<div style="font-size:34px;letter-spacing:8px;font-weight:700;text-align:center;padding:16px;background:#f4f4f6;border-radius:12px">' . h($code) . '</div>'
              . '<p style="text-align:center;color:#888;font-size:13px;margin-top:16px">Код действует 15 минут. Если вы не запрашивали вход — просто игнорируйте письмо.</p>'
              . '</div>';
        $sent = (bool) mail_queue($email, input('name'), 'Код для входа - КЦ «Музыкальный Мир»', $html);
    }

    $out = ['ok' => true, 'sent' => $sent, 'need_verify' => true, 'message' => 'Код отправлен на почту'];
    if (cfgv('debug') && !$sent) $out['dev_hint'] = $code;   // только в debug и только если письмо не ушло
    json_out($out);
}

/* -------------------- action=verify -------------------- */
if ($action === 'verify') {
    $code = trim((string) ($_POST['code'] ?? ''));
    if ($code === '' || !auth_check_code('email', $email, $code)) {
        json_out(['ok' => false, 'error' => 'Неверный или просроченный код'], 401);
    }

    $user = one("SELECT * FROM users WHERE email=?", [$email]);
    if ($user) {
        if ((int)($user['email_verified'] ?? 0) !== 1) {
            update('users', ['email_verified' => 1], 'id=:id', ['id' => (int)$user['id']]);
        }
        $uid = (int) $user['id'];
    } else {
        $uid = (int) insert('users', [
            'email'          => $email,
            'full_name'      => input('name'),
            'role'           => 'user',
            'email_verified' => 1,
        ]);
    }

    $isNewUser = !$user;   // запись не найдена → создан новый пользователь

    login_user($uid);
    auth_add_subscriber($email, input('name'), 'email');
    audit('auth_email_magic', 'user', $uid, []);

    // Приветственное письмо — один раз, только новым пользователям и при наличии email.
    if ($isNewUser && $email !== '' && function_exists('mail_queue') && function_exists('mail_template')) {
        $welcomeName = (string) input('name');
        mail_queue($email, $welcomeName, 'Добро пожаловать в «Музыкальный Мир»', mail_template('welcome', ['name' => $welcomeName]));
    }

    if ($isNewUser && is_file(BASE_PATH . '/core/notify_owner.php')) {
        require_once BASE_PATH . '/core/notify_owner.php';
        owner_notify('РЕГИСТРАЦИИ', 'Новая регистрация (email, код)', '', [
            'Имя'    => (string) input('name'),
            'Email'  => $email,
            '_event' => 'register',
            '_path'  => '/register',
            '_meta'  => ['user_id' => $uid, 'via' => 'email_magic'],
        ]);
    }

    json_out(['ok' => true, 'registered' => true, 'redirect' => '/cabinet?auth=ok']);
}

json_out(['ok' => false, 'error' => 'Неизвестное действие'], 400);
