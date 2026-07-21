<?php
/** Авторизация: сессии, роли, вход/регистрация. */
declare(strict_types=1);

function current_user(): ?array {
    static $u = false;
    if ($u !== false) return $u;
    $u = null;
    $token = $_COOKIE['muzmir_sess'] ?? '';
    if ($token) {
        $row = one("SELECT u.* FROM sessions s JOIN users u ON u.id=s.user_id
                    WHERE s.token=? AND (s.expires_at IS NULL OR s.expires_at > datetime('now'))", [$token]);
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
    if ($u && $u['password_hash'] && password_verify($password, $u['password_hash'])) return $u;
    return null;
}
