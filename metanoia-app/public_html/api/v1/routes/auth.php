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

            письмоПодтверждения($user);
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

        // ── POST /auth/forgot — письмо со ссылкой на новый пароль ──
        // Отвечаем одинаково и на знакомую, и на незнакомую почту: иначе по
        // ответу можно перебрать, кто в школе учится.
        case 'POST forgot':
            RateLimit::check('forgot:' . ($_SERVER['REMOTE_ADDR'] ?? ''), 10, 3600);
            $email = strtolower(trim($in['email'] ?? ''));
            $ответ = ['sent' => true];

            $user = $email !== ''
                ? DB::query('SELECT * FROM users WHERE email = ?', [$email])->fetch()
                : null;

            if ($user && (int) $user['is_blocked'] === 0) {
                DB::query('DELETE FROM password_resets WHERE user_id = ? AND used_at IS NULL',
                    [(int) $user['id']]);
                $ключ = bin2hex(random_bytes(32));
                DB::query(
                    'INSERT INTO password_resets (user_id, token_hash, expires_at)
                     VALUES (?, ?, DATE_ADD(NOW(), INTERVAL 2 HOUR))',
                    [(int) $user['id'], hash('sha256', $ключ)]
                );
                $адрес = rtrim((string) Config::get('APP_URL', ''), '/') . '/?reset=' . $ключ;
                $текст = "Здравствуйте!\n\n"
                    . "Вы просили новый пароль в приложении школы «Метанойя».\n"
                    . "Откройте ссылку и задайте его:\n\n$адрес\n\n"
                    . "Ссылка живёт два часа. Если это были не вы, письмо можно удалить: "
                    . "пароль останется прежним.\n\nШкола «Метанойя»";
                Mail::send($email, 'Новый пароль в школе «Метанойя»', $текст);
            }
            Response::ok($ответ);

        // ── POST /auth/reset — задать новый пароль по ссылке ──
        case 'POST reset':
            RateLimit::check('reset:' . ($_SERVER['REMOTE_ADDR'] ?? ''), 20, 3600);
            $ключ = (string) ($in['token'] ?? '');
            $pass = (string) ($in['password'] ?? '');
            if (mb_strlen($pass) < 8) {
                Response::error('Пароль короче восьми знаков', 422);
            }
            $строка = DB::query(
                'SELECT * FROM password_resets
                  WHERE token_hash = ? AND used_at IS NULL AND expires_at > NOW()',
                [hash('sha256', $ключ)]
            )->fetch();
            if (!$строка) {
                Response::error('Ссылка устарела. Попросите новую и откройте письмо заново.', 400);
            }
            DB::query('UPDATE users SET password_hash = ? WHERE id = ?',
                [password_hash($pass, PASSWORD_DEFAULT), (int) $строка['user_id']]);
            DB::query('UPDATE password_resets SET used_at = NOW() WHERE id = ?',
                [(int) $строка['id']]);
            // Все прежние входы гасим: пароль меняют и тогда, когда его увели.
            DB::query('DELETE FROM sessions WHERE user_id = ?', [(int) $строка['user_id']]);

            $user = DB::query('SELECT * FROM users WHERE id = ?',
                [(int) $строка['user_id']])->fetch();
            Response::ok(['user' => publicUser($user)] + issueTokens($user));

        // ── POST /auth/verify — подтвердить почту по ссылке ──
        case 'POST verify':
            RateLimit::check('verify:' . ($_SERVER['REMOTE_ADDR'] ?? ''), 30, 3600);
            $ключ = (string) ($in['token'] ?? '');
            $строка = DB::query(
                'SELECT * FROM email_verifications
                  WHERE token_hash = ? AND used_at IS NULL AND expires_at > NOW()',
                [hash('sha256', $ключ)]
            )->fetch();
            if (!$строка) {
                Response::error('Ссылка устарела. Попросите новую в профиле.', 400);
            }
            DB::query('UPDATE users SET email_verified_at = NOW() WHERE id = ?',
                [(int) $строка['user_id']]);
            DB::query('UPDATE email_verifications SET used_at = NOW() WHERE id = ?',
                [(int) $строка['id']]);
            $user = DB::query('SELECT * FROM users WHERE id = ?',
                [(int) $строка['user_id']])->fetch();
            Response::ok(['user' => publicUser($user)]);

        // ── POST /auth/resend — прислать письмо ещё раз ──────
        case 'POST resend':
            $me = Auth::requireUser();
            RateLimit::check('resend:' . (int) $me['id'], 5, 3600);
            if (($me['email_verified_at'] ?? null) !== null) {
                Response::ok(['sent' => false, 'already' => true]);
            }
            письмоПодтверждения($me);
            Response::ok(['sent' => true]);

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

/**
 * Письмо со ссылкой подтверждения почты. Ссылка живёт сутки: родитель
 * заводит аккаунт вечером, а до почты добирается на следующий день.
 * Школой можно пользоваться и без подтверждения: ребёнку нельзя мешать
 * учиться из-за письма, которое застряло у почтовика.
 */
function письмоПодтверждения(array $user): void
{
    DB::query('DELETE FROM email_verifications WHERE user_id = ? AND used_at IS NULL',
        [(int) $user['id']]);
    $ключ = bin2hex(random_bytes(32));
    DB::query(
        'INSERT INTO email_verifications (user_id, token_hash, expires_at)
         VALUES (?, ?, DATE_ADD(NOW(), INTERVAL 24 HOUR))',
        [(int) $user['id'], hash('sha256', $ключ)]
    );
    $адрес = rtrim((string) Config::get('APP_URL', ''), '/') . '/?verify=' . $ключ;
    $текст = "Здравствуйте!\n\n"
        . "Вы завели аккаунт в школе «Метанойя». Подтвердите почту, чтобы мы\n"
        . "могли прислать новый пароль, если старый забудется:\n\n$адрес\n\n"
        . "Ссылка живёт сутки. Школой можно пользоваться и не дожидаясь письма.\n\n"
        . "Школа «Метанойя»";
    Mail::send((string) $user['email'], 'Подтвердите почту в школе «Метанойя»', $текст);
}
