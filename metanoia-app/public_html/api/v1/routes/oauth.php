<?php
/**
 * /api/v1/oauth/* — вход через Google и Telegram.
 *   POST /oauth/google    — {id_token}      (Google Identity Services)
 *   POST /oauth/telegram  — {...login data} (Telegram Login Widget)
 *
 * ⚠ ПОДКЛЮЧЕНИЕ:
 *   GOOGLE_OAUTH_CLIENT_ID — Client ID из Google Cloud Console.
 *   TELEGRAM_BOT_TOKEN     — токен бота @metanoia_180_bot (BotFather).
 * Логика и проверка подписи — рабочие, ключи из /config/.env.
 */

declare(strict_types=1);

/** Найти пользователя по столбцу или создать нового (OAuth). */
function oauthUpsert(string $col, string|int $id, string $email, string $name, ?string $avatar): array
{
    $u = DB::query("SELECT * FROM users WHERE $col = ? LIMIT 1", [$id])->fetch();
    if ($u) return $u;

    // связать с существующим email, если есть
    if ($email !== '') {
        $byEmail = DB::query('SELECT * FROM users WHERE email = ? LIMIT 1', [strtolower($email)])->fetch();
        if ($byEmail) {
            DB::query("UPDATE users SET $col = ?, email_verified_at = COALESCE(email_verified_at, NOW()) WHERE id = ?",
                [$id, (int) $byEmail['id']]);
            return DB::query('SELECT * FROM users WHERE id = ?', [(int) $byEmail['id']])->fetch();
        }
    }

    // создать нового родителя (без пароля)
    $email = $email !== '' ? strtolower($email) : ('oauth_' . bin2hex(random_bytes(6)) . '@metanoia.local');
    DB::query(
        "INSERT INTO users (email, name, role, avatar, $col, email_verified_at)
         VALUES (?, ?, 'parent', ?, ?, NOW())",
        [$email, $name !== '' ? $name : 'Друг', $avatar, $id]
    );
    return DB::query('SELECT * FROM users WHERE id = LAST_INSERT_ID()')->fetch();
}

function handle(array $segments, string $method): never
{
    $provider = $segments[1] ?? '';
    $in = Response::input();
    if ($method !== 'POST') Response::error('Метод не поддерживается', 405);

    RateLimit::check('oauth:' . ($_SERVER['REMOTE_ADDR'] ?? ''), 20, 3600);

    switch ($provider) {

        // ── Google Identity Services ───────────────────────
        case 'google': {
            $idToken = (string) ($in['id_token'] ?? '');
            $clientId = (string) Config::get('GOOGLE_OAUTH_CLIENT_ID', '');
            if ($idToken === '') Response::error('Нет id_token', 400);
            if ($clientId === '') Response::error('Вход через Google ещё не подключён', 503);

            // Проверка токена у Google
            $ch = curl_init('https://oauth2.googleapis.com/tokeninfo?id_token=' . urlencode($idToken));
            curl_setopt_array($ch, [CURLOPT_RETURNTRANSFER => true, CURLOPT_TIMEOUT => 15]);
            $resp = curl_exec($ch);
            $code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
            curl_close($ch);
            $claims = json_decode($resp ?: 'null', true);
            if ($code !== 200 || !is_array($claims)) Response::error('Google: токен недействителен', 401);
            if (($claims['aud'] ?? '') !== $clientId) Response::error('Google: чужой токен', 401);
            if (($claims['email_verified'] ?? 'false') !== 'true' && ($claims['email_verified'] ?? false) !== true) {
                Response::error('Google: email не подтверждён', 401);
            }

            $user = oauthUpsert('google_id', (string) $claims['sub'], $claims['email'] ?? '', $claims['name'] ?? '', $claims['picture'] ?? null);
            $tokens = issueTokens($user);
            Response::ok(['user' => publicUser($user)] + $tokens);
        }

        // ── Telegram Login Widget ──────────────────────────
        case 'telegram': {
            $botToken = (string) Config::get('TELEGRAM_BOT_TOKEN', '');
            if ($botToken === '') Response::error('Вход через Telegram ещё не подключён', 503);

            $data = $in;
            $hash = (string) ($data['hash'] ?? '');
            unset($data['hash']);
            if ($hash === '' || empty($data['id'])) Response::error('Нет данных Telegram', 400);

            // проверка подписи: HMAC-SHA256(data_check_string, SHA256(bot_token))
            ksort($data);
            $pairs = [];
            foreach ($data as $k => $v) $pairs[] = "$k=$v";
            $checkString = implode("\n", $pairs);
            $secret = hash('sha256', $botToken, true);
            $calc = hash_hmac('sha256', $checkString, $secret);
            if (!hash_equals($calc, $hash)) Response::error('Telegram: неверная подпись', 401);

            // свежесть (не старше суток)
            if (time() - (int) ($data['auth_date'] ?? 0) > 86400) Response::error('Telegram: данные устарели', 401);

            $name = trim(($data['first_name'] ?? '') . ' ' . ($data['last_name'] ?? '')) ?: ($data['username'] ?? 'Друг');
            $user = oauthUpsert('telegram_id', (int) $data['id'], '', $name, $data['photo_url'] ?? null);
            $tokens = issueTokens($user);
            Response::ok(['user' => publicUser($user)] + $tokens);
        }

        default:
            Response::error('Провайдер не поддерживается', 404);
    }
}
