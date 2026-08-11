<?php
/** Авторизация: сессии, роли, вход/регистрация. */
declare(strict_types=1);

function current_user(): ?array {
    static $u = false;
    if ($u !== false) return $u;
    $u = null;
    $token = $_COOKIE['muzmir_sess'] ?? '';
    if ($token) {
        // ЗАБЛОКИРОВАННЫЙ АККАУНТ НЕ АВТОРИЗУЕТСЯ. Здесь не было условия по blocked,
        // и блокировка в админке ни на что не влияла: у человека оставалась живая
        // сессия на 30 дней, и он спокойно продолжал работать — включая админку,
        // если у него была роль. Блокировка «срабатывала» только при новом входе.
        $row = one("SELECT u.* FROM sessions s JOIN users u ON u.id=s.user_id
                    WHERE s.token=? AND (s.expires_at IS NULL OR s.expires_at > datetime('now'))
                      AND COALESCE(u.blocked,0)=0", [$token]);
        if ($row) $u = $row;
    }
    return $u;
}

function login_user(int $userId, bool $remember = true): void {
    $token = bin2hex(random_bytes(32));
    insert('sessions', [
        'token' => $token, 'user_id' => $userId,
        'ip' => client_ip(), 'ua' => substr($_SERVER['HTTP_USER_AGENT'] ?? '', 0, 255),
        'expires_at' => date('Y-m-d H:i:s', time() + 60 * 60 * 24 * 30),
    ]);
    update('users', ['last_login' => date('Y-m-d H:i:s')], 'id=:id', ['id' => $userId]);
    setcookie('muzmir_sess', $token, [
        'expires' => time() + 60 * 60 * 24 * 30, 'path' => '/',
        'httponly' => true, 'samesite' => 'Lax',
        'secure' => (($_SERVER['HTTPS'] ?? '') === 'on'),
    ]);
}

function logout_user(): void {
    $token = $_COOKIE['muzmir_sess'] ?? '';
    if ($token) q("DELETE FROM sessions WHERE token=?", [$token]);
    setcookie('muzmir_sess', '', ['expires' => time() - 3600, 'path' => '/']);
}

const ROLE_RANK = ['user'=>1,'teacher'=>2,'jury'=>3,'designer'=>3,'accountant'=>3,'moderator'=>4,'admin'=>5,'owner'=>6];
function user_can(string $minRole): bool {
    $u = current_user();
    if (!$u) return false;
    return (ROLE_RANK[$u['role']] ?? 0) >= (ROLE_RANK[$minRole] ?? 99);
}
function require_role(string $minRole): void {
    if (!user_can($minRole)) {
        if (!current_user()) redirect('login?next=' . urlencode($_SERVER['REQUEST_URI'] ?? '/'));
        http_response_code(403); echo 'Доступ запрещён'; exit;
    }
}
function require_login(): void {
    if (!current_user()) redirect('login?next=' . urlencode($_SERVER['REQUEST_URI'] ?? '/'));
}

function register_user(string $email, string $password, string $name = ''): array {
    $email = mb_strtolower(trim($email));
    if (one("SELECT id FROM users WHERE email=?", [$email])) {
        return ['ok' => false, 'error' => 'Пользователь с такой почтой уже существует'];
    }
    $token = bin2hex(random_bytes(16));
    $id = insert('users', [
        'email' => $email, 'password_hash' => password_hash($password, PASSWORD_DEFAULT),
        'full_name' => $name, 'verify_token' => $token, 'role' => 'user',
    ]);
    return ['ok' => true, 'id' => $id, 'verify_token' => $token];
}

function attempt_login(string $email, string $password): ?array {
    $u = one("SELECT * FROM users WHERE email=?", [mb_strtolower(trim($email))]);
    if ($u && $u['password_hash'] && password_verify($password, $u['password_hash'])) {
        // Заблокированный админом аккаунт войти не может.
        if ((int)($u['blocked'] ?? 0) === 1) return null;
        return $u;
    }
    return null;
}

/* =====================================================================
 *  Расширение: соц-вход, подписчики, OTP/magic-коды, геттеры профиля.
 *  Добавлено для мгновенной регистрации (VK / MAX / email / телефон).
 * ===================================================================== */

/** Геттеры профиля текущего пользователя (для шапки/кабинета). */
function current_user_name(): string {
    $u = current_user();
    return $u ? trim((string)($u['full_name'] ?? '')) : '';
}
function current_user_avatar(): string {
    $u = current_user();
    return $u ? (string)($u['avatar'] ?? '') : '';
}

/**
 * Идемпотентно добавляет столбец в таблицу users (SQLite ALTER TABLE ADD COLUMN).
 * Нужно для внешних ID соц-провайдеров, которых нет в исходной схеме (vk_id, max_id).
 */
function ensure_user_column(string $col, string $decl = "TEXT DEFAULT ''"): void {
    static $cache = [];
    if (isset($cache[$col])) return;
    $cols = all("PRAGMA table_info(users)");
    foreach ($cols as $c) {
        if (($c['name'] ?? '') === $col) { $cache[$col] = true; return; }
    }
    // Имя столбца строго валидируем (не пользовательский ввод, но на всякий случай).
    if (!preg_match('/^[a-z_][a-z0-9_]*$/i', $col)) return;
    try { db()->exec("ALTER TABLE users ADD COLUMN $col $decl"); } catch (\Throwable $e) { /* уже есть */ }
    $cache[$col] = true;
}

/** Провайдер → имя столбца внешнего ID в users. */
function auth_provider_column(string $provider): string {
    $map = ['google' => 'google_id', 'tg' => 'tg_id', 'telegram' => 'tg_id', 'vk' => 'vk_id', 'max' => 'max_id'];
    return $map[$provider] ?? (preg_replace('/[^a-z0-9]/', '', strtolower($provider)) . '_id');
}

/**
 * Находит/создаёт пользователя по внешнему ID соц-провайдера, пишет имя/аватар.
 * Порядок связки: по <provider>_id → по email (если задан) → создание нового.
 * Возвращает user_id. Роль новичка — 'user' (участник).
 */
function auth_upsert_social(string $provider, string $extId, string $name = '', string $email = '', string $avatar = ''): int {
    $col   = auth_provider_column($provider);
    ensure_user_column($col);
    $extId = trim($extId);
    $email = mb_strtolower(trim($email));
    $name  = trim($name);

    $user = null;
    if ($extId !== '') {
        $user = one("SELECT * FROM users WHERE $col = ? AND $col <> ''", [$extId]);
    }
    if (!$user && $email !== '') {
        $user = one("SELECT * FROM users WHERE email = ?", [$email]);
    }

    if ($user) {
        $upd = [];
        if ($extId !== '' && (string)($user[$col] ?? '') === '')        $upd[$col] = $extId;
        if ($email !== '' && (string)($user['email'] ?? '') === '')     $upd['email'] = $email;
        if ($email !== '' && (int)($user['email_verified'] ?? 0) !== 1) $upd['email_verified'] = 1;
        if ($name  !== '' && (string)($user['full_name'] ?? '') === '') $upd['full_name'] = $name;
        if ($avatar !== '' && (string)($user['avatar'] ?? '') === '')   $upd['avatar'] = $avatar;
        if ($upd) update('users', $upd, 'id=:id', ['id' => (int)$user['id']]);
        return (int)$user['id'];
    }

    $data = [
        'full_name'      => $name !== '' ? $name : ('Гость ' . $provider),
        'avatar'         => $avatar,
        'role'           => 'user',
    ];
    if ($email !== '') { $data['email'] = $email; $data['email_verified'] = 1; }
    if ($extId !== '') $data[$col] = $extId;
    return (int) insert('users', $data);
}

/**
 * Добавляет адрес в subscribers (для рассылок). Идемпотентно, реактивирует отписанных.
 * В схеме subscribers статус хранится в столбце active (1 = confirmed). Пустой email — no-op.
 */
function auth_add_subscriber(string $email, string $name = '', string $source = 'site'): void {
    $email = mb_strtolower(trim($email));
    if ($email === '' || !filter_var($email, FILTER_VALIDATE_EMAIL)) return;
    $row = one("SELECT id, active FROM subscribers WHERE email=?", [$email]);
    if ($row) {
        if (!(int)$row['active']) update('subscribers', ['active' => 1], 'id=:id', ['id' => (int)$row['id']]);
        return;
    }
    try {
        insert('subscribers', [
            'email'       => $email,
            'name'        => $name,
            'source'      => $source,
            'unsub_token' => bin2hex(random_bytes(16)),
            'active'      => 1,
        ]);
    } catch (\Throwable $e) { /* гонка по UNIQUE(email) — ок */ }
}

/** Проверка Origin/Referer запроса против своих доменов (защита от чужих форм). */
function auth_origin_ok(): bool {
    $allowed = [];
    if ($bu = cfgv('base_url')) $allowed[] = rtrim($bu, '/');
    foreach (['domain', 'domain_puny'] as $k) {
        if ($d = cfgv($k)) { $allowed[] = 'https://' . $d; $allowed[] = 'http://' . $d; }
    }
    $origin = $_SERVER['HTTP_ORIGIN'] ?? '';
    if ($origin === '') {
        // Нет Origin (не-CORS POST) — сверяем по Referer, иначе пропускаем (same-origin форма).
        $ref = $_SERVER['HTTP_REFERER'] ?? '';
        if ($ref === '') return true;
        $origin = preg_replace('#^(https?://[^/]+).*#', '$1', $ref);
    }
    return in_array(rtrim($origin, '/'), $allowed, true);
}

/* ---- Одноразовые коды (OTP e-mail / SMS) поверх таблицы settings ---- */

/** Сгенерировать числовой код заданной длины (по умолчанию 6 знаков). */
function auth_gen_code(int $len = 6): string {
    $len = max(4, min(8, $len));
    $code = '';
    for ($i = 0; $i < $len; $i++) $code .= (string) random_int(0, 9);
    return $code;
}

/** Сохранить хэш кода с TTL. scope: 'email'|'phone'. ident — нормализованный адрес/телефон. */
function auth_store_code(string $scope, string $ident, string $code, int $ttl = 900): void {
    set_setting('otp:' . $scope . ':' . $ident, json_encode([
        'h'     => hash('sha256', $code),
        'exp'   => time() + $ttl,
        'tries' => 0,
    ], JSON_UNESCAPED_UNICODE));
}

/** Сверить код. Ограничение попыток (5). Успех/просрочка удаляют запись. */
function auth_check_code(string $scope, string $ident, string $code): bool {
    $key = 'otp:' . $scope . ':' . $ident;
    $raw = setting($key);
    if (!$raw) return false;
    $d = json_decode((string)$raw, true);
    if (!is_array($d)) { q("DELETE FROM settings WHERE key=?", [$key]); return false; }
    if ((int)($d['exp'] ?? 0) < time()) { q("DELETE FROM settings WHERE key=?", [$key]); return false; }
    if ((int)($d['tries'] ?? 0) >= 5)   { q("DELETE FROM settings WHERE key=?", [$key]); return false; }
    if (hash_equals((string)($d['h'] ?? ''), hash('sha256', trim($code)))) {
        q("DELETE FROM settings WHERE key=?", [$key]);
        return true;
    }
    $d['tries'] = (int)($d['tries'] ?? 0) + 1;
    set_setting($key, json_encode($d, JSON_UNESCAPED_UNICODE));
    return false;
}

/**
 * Отправка SMS с кодом. Возвращает true при успехе провайдера.
 * Провайдер по умолчанию — SMS.RU (api_id). Без ключа — false (dev-режим у вызывающего).
 * Все ошибки cURL — тихий false.
 */
function auth_send_sms(string $phoneDigits, string $text): bool {
    $provider = (string) cfgv('sms_provider', 'smsru');
    $apiId    = (string) cfgv('sms_api_id', '');
    if ($apiId === '' || $phoneDigits === '') return false;

    if ($provider === 'smsru') {
        $params = ['api_id' => $apiId, 'to' => $phoneDigits, 'msg' => $text, 'json' => 1];
        if ($from = (string) cfgv('sms_from', '')) $params['from'] = $from;
        $ch = curl_init('https://sms.ru/sms/send?' . http_build_query($params));
        curl_setopt_array($ch, [CURLOPT_RETURNTRANSFER => true, CURLOPT_TIMEOUT => 12]);
        $resp = curl_exec($ch);
        $err  = curl_errno($ch);
        curl_close($ch);
        if ($err || !$resp) return false;
        $d = json_decode((string)$resp, true);
        return is_array($d) && (int)($d['status_code'] ?? 0) === 100;
    }
    // Неизвестный провайдер — считаем не настроенным.
    return false;
}

/**
 * Гарантирует личный кабинет по адресу почты (автосоздание из любой точки:
 * подписка, заказ наград, заявка). Если аккаунт уже есть — возвращает его id,
 * дублей не создаёт. Новому пользователю генерируется пароль и в очередь
 * (после транзакционных, priority 5) уходит письмо с логином, паролем
 * и кнопкой входа. Возвращает id пользователя или 0.
 */
function auth_ensure_account(string $email, string $name = ''): int {
    $email = mb_strtolower(trim($email));
    if ($email === '' || !filter_var($email, FILTER_VALIDATE_EMAIL)) return 0;

    $u = one("SELECT id FROM users WHERE email=?", [$email]);
    if ($u) return (int) $u['id'];

    $alphabet = 'abcdefghjkmnpqrstuvwxyz23456789';
    $pass = '';
    for ($i = 0; $i < 9; $i++) $pass .= $alphabet[random_int(0, strlen($alphabet) - 1)];

    $uid = (int) insert('users', [
        'email'          => $email,
        'full_name'      => trim($name),
        'role'           => 'user',
        'password_hash'  => password_hash($pass, PASSWORD_DEFAULT),
        'email_verified' => 1,
    ]);
    audit('account_autocreate', 'user', $uid, ['email' => $email]);

    if (function_exists('mm_email_layout') && function_exists('mm_email_btn') && function_exists('mail_queue')) {
        try {
            $base = rtrim((string) cfgv('base_url'), '/');
            $inner = '<p style="margin:0 0 14px;font-size:15px;color:#2a2a3a;">Здравствуйте'
                . ($name !== '' ? ', ' . h($name) : '') . '! Мы открыли для Вас личный кабинет'
                . ' на сайте Культурного центра «Музыкальный Мир»: заявки, результаты,'
                . ' электронные дипломы и заказ наград - в одном месте.</p>'
                . '<div style="margin:0 0 16px;padding:16px 18px;border:1.5px solid #C79322;border-radius:12px;background:#FCF9F0;text-align:center;">'
                . '<div style="font-size:13px;color:#6b5d3f;margin-bottom:6px;">Ваш логин</div>'
                . '<div style="font-size:16px;font-weight:bold;color:#17307A;margin-bottom:10px;">' . h($email) . '</div>'
                . '<div style="font-size:13px;color:#6b5d3f;margin-bottom:6px;">Временный пароль</div>'
                . '<div style="font-family:monospace;font-size:22px;font-weight:bold;letter-spacing:3px;color:#17307A;">' . h($pass) . '</div>'
                . '<div style="font-size:12px;color:#8a7b58;margin-top:8px;">После входа пароль можно сменить в настройках кабинета.</div>'
                . '</div>'
                . mm_email_btn($base . '/login', 'Войти в личный кабинет');
            $html = mm_email_layout($inner, ['title' => 'Ваш личный кабинет открыт']);
            try { db()->exec("ALTER TABLE mail_queue ADD COLUMN priority INTEGER DEFAULT 0"); } catch (\Throwable $e) {}
            insert('mail_queue', ['to_email' => $email, 'to_name' => $name,
                'subject' => 'Ваш личный кабинет - «Музыкальный Мир»',
                'body' => $html, 'status' => 'queued', 'priority' => 5]);
        } catch (\Throwable $e) { /* письмо не должно ломать основной сценарий */ }
    }
    return $uid;
}
