<?php
/**
 * /api/v1/auth/* — регистрация, вход, refresh, me, logout.
 * Access-токен: 1 час. Refresh: 30 дней (hash в таблице sessions).
 */

declare(strict_types=1);

// issueTokens(), publicUser(), ACCESS_TTL, REFRESH_TTL → core/tokens.php
// (общие для /auth и /oauth, подключаются в index.php).

function handle(array $segments, string $method): never
{
    $action = $segments[1] ?? '';
    $in = Response::input();

    switch ("$method $action") {

        // ── POST /auth/register ────────────────────────────
        case 'POST register':
            RateLimit::check('reg:' . ($_SERVER['REMOTE_ADDR'] ?? ''), 10, 3600);

            $errors = [];
            $email = strtolower(trim($in['email'] ?? ''));
            $pass  = (string) ($in['password'] ?? '');
            $name  = trim($in['name'] ?? '');
            $confession = $in['confession'] ?? 'undecided';
            $role  = in_array($in['role'] ?? '', ['parent', 'student12'], true) ? $in['role'] : 'parent';

            if (!filter_var($email, FILTER_VALIDATE_EMAIL)) $errors['email'] = 'Некорректный email';
            if (strlen($pass) < 8 || !preg_match('/\d/', $pass) || !preg_match('/\p{L}/u', $pass))
                $errors['password'] = 'Пароль: минимум 8 символов, хотя бы 1 буква и 1 цифра';
            if (mb_strlen($name) < 2) $errors['name'] = 'Введите имя';
            if (!in_array($confession, ['orthodox','protestant','catholic','other','undecided'], true))
                $errors['confession'] = 'Выберите конфессию из списка';
            if ($errors) Response::error('Проверьте поля формы', 422, $errors);

            if (DB::query('SELECT id FROM users WHERE email = ?', [$email])->fetch())
                Response::error('Этот email уже зарегистрирован', 409);

            DB::query(
                'INSERT INTO users (email, password_hash, name, role, confession, country, city)
                 VALUES (?, ?, ?, ?, ?, ?, ?)',
                [
                    $email,
                    password_hash($pass, PASSWORD_BCRYPT, ['cost' => 12]),
                    $name, $role, $confession,
                    trim($in['country'] ?? '') ?: null,
                    trim($in['city'] ?? '') ?: null,
                ]
            );
            $user = DB::query('SELECT * FROM users WHERE email = ?', [$email])->fetch();
            DB::query('INSERT INTO user_settings (user_id) VALUES (?)', [(int) $user['id']]);

            // Первый ребёнок (если роль — родитель и данные переданы)
            if ($role === 'parent' && !empty($in['child']['name'])) {
                DB::query(
                    'INSERT INTO children (parent_id, name, age, gender) VALUES (?, ?, ?, ?)',
                    [
                        (int) $user['id'],
                        trim($in['child']['name']),
                        max(5, min(14, (int) ($in['child']['age'] ?? 7))),
                        in_array($in['child']['gender'] ?? '', ['m', 'f'], true) ? $in['child']['gender'] : null,
                    ]
                );
                DB::query('INSERT INTO streaks (child_id) VALUES (?)',
                    [(int) DB::pdo()->lastInsertId()]);
            }

            DB::query('INSERT INTO audit_log (user_id, action, ip) VALUES (?, "register", ?)',
                [(int) $user['id'], $_SERVER['REMOTE_ADDR'] ?? null]);

            // TODO этап 2: письмо верификации email
            Response::ok(['user' => publicUser($user)] + issueTokens($user), 201);

        // ── POST /auth/login ───────────────────────────────
        case 'POST login':
            RateLimit::check('login:' . ($_SERVER['REMOTE_ADDR'] ?? ''), 20, 900);

            $email = strtolower(trim($in['email'] ?? ''));
            $user = DB::query('SELECT * FROM users WHERE email = ?', [$email])->fetch();
            if (!$user || !$user['password_hash']
                || !password_verify((string) ($in['password'] ?? ''), $user['password_hash'])) {
                Response::error('Неверный email или пароль', 401);
            }
            if ((int) $user['is_blocked'] === 1) {
                Response::error('Аккаунт заблокирован. Напишите в поддержку.', 403);
            }
            DB::query('UPDATE users SET last_seen_at = NOW() WHERE id = ?', [(int) $user['id']]);
            Response::ok(['user' => publicUser($user)] + issueTokens($user));

        // ── POST /auth/refresh ─────────────────────────────
        case 'POST refresh':
            $token = (string) ($in['refresh_token'] ?? '');
            $claims = JWT::verify($token);
            if ($claims === null || ($claims['typ'] ?? '') !== 'refresh') {
                Response::error('Refresh-токен недействителен', 401);
            }
            $hash = hash('sha256', $token);
            $session = DB::query(
                'SELECT * FROM sessions WHERE refresh_token_hash = ? AND expires_at > NOW()',
                [$hash])->fetch();
            if (!$session) Response::error('Сессия не найдена или истекла', 401);

            $user = DB::query('SELECT * FROM users WHERE id = ? AND is_blocked = 0',
                [(int) $session['user_id']])->fetch();
            if (!$user) Response::error('Пользователь не найден', 401);

            // ротация: старый refresh гасим, выдаём новый
            DB::query('DELETE FROM sessions WHERE id = ?', [(int) $session['id']]);
            Response::ok(issueTokens($user));

        // ── GET /auth/me ───────────────────────────────────
        case 'GET me':
            $user = Auth::requireUser();
            $children = DB::query(
                'SELECT c.id, c.name, c.age, c.gender, c.avatar_key, c.xp, c.rank_level,
                        COALESCE(s.current_days, 0) AS streak_days
                 FROM children c
                 LEFT JOIN streaks s ON s.child_id = c.id
                 WHERE c.parent_id = ?', [(int) $user['id']])->fetchAll();
            Response::ok(['user' => publicUser($user), 'children' => $children]);

        // ── POST /auth/logout ──────────────────────────────
        case 'POST logout':
            $token = (string) ($in['refresh_token'] ?? '');
            if ($token !== '') {
                DB::query('DELETE FROM sessions WHERE refresh_token_hash = ?',
                    [hash('sha256', $token)]);
            }
            Response::ok(['logged_out' => true]);

        default:
            Response::error('Не найдено', 404);
    }
}
