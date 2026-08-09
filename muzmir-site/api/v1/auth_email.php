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

    // OTP-код живёт 15 минут — гнать его через воркер очереди (крон раз в минуту)
    // рискованно: если очередь встанет или отправитель уйдёт в карантин, участник
    // будет ждать несколько минут. Ящик gmail в этот момент часто уже не примет
    // просроченный код, а на mail.ru просто «письмо не пришло». Поэтому шлём
    // синхронно через mail_send_failover — с фолбэком по всему пулу tx — и только
    // если не удалось живьём, кладём в очередь как резервный путь.
    if (!function_exists('mail_send_failover')) require_once BASE_PATH . '/core/mailer.php';

    $subject = 'Код для входа: ' . $code . ' — Культурный центр «Музыкальный Мир»';
    $html = function_exists('mail_template')
        ? mail_template('otp_code', [
            'name'        => (string) input('name'),
            'code'        => $code,
            'ttl_minutes' => 15,
            'preheader'   => 'Ваш код для входа на сайт центра. Действует 15 минут.',
          ])
        : '<p>Код для входа: <b style="font-size:28px;letter-spacing:6px;">' . h($code) . '</b>. Действует 15 минут.</p>';

    $sent = false;
    try {
        $sent = (bool) mail_send_failover($email, $subject, $html, ['pool' => 'tx']);
    } catch (\Throwable $e) { $sent = false; }

    // Если синхронно не удалось (все ящики отказали) — ставим в очередь, чтобы
    // воркер попробовал ещё раз при первой возможности; всё равно уведомляем
    // участника honest'ом «Код отправлен», но помечаем sent=false для JS.
    if (!$sent && function_exists('mail_queue')) {
        // ВАЖНО: НЕ трогаем priority. В этой системе priority = 0 означает «личное,
        // отправить немедленно», а priority > 0 — «массовая рассылка, по дневной квоте
        // и вне окна не уходит». Раньше здесь стояло priority=5 «чтобы не утонуло»:
        // это отправляло код входа в ХВОСТ массовой очереди за 8000 писем волны, и
        // 15-минутный код приходил бы через недели. mail_queue() и так ставит 0.
        mail_queue($email, (string) input('name'), $subject, $html);
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
