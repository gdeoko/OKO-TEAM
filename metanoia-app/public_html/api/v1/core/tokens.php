<?php
/**
 * Общие помощники выдачи токенов и публичного представления пользователя.
 * Используются и в /auth, и в /oauth.
 */

declare(strict_types=1);

const ACCESS_TTL  = 3600;          // 1 час
const REFRESH_TTL = 30 * 86400;    // 30 дней

function issueTokens(array $user): array
{
    $access = JWT::issue([
        'typ' => 'access', 'sub' => (int) $user['id'], 'role' => $user['role'],
    ], ACCESS_TTL);

    $refresh = JWT::issue([
        'typ' => 'refresh', 'sub' => (int) $user['id'], 'jti' => bin2hex(random_bytes(16)),
    ], REFRESH_TTL);

    DB::query(
        'INSERT INTO sessions (user_id, refresh_token_hash, user_agent, ip, expires_at)
         VALUES (?, ?, ?, ?, DATE_ADD(NOW(), INTERVAL ? SECOND))',
        [
            (int) $user['id'],
            hash('sha256', $refresh),
            substr($_SERVER['HTTP_USER_AGENT'] ?? '', 0, 255),
            $_SERVER['REMOTE_ADDR'] ?? null,
            REFRESH_TTL,
        ]
    );

    return ['access_token' => $access, 'refresh_token' => $refresh];
}

function publicUser(array $u): array
{
    return [
        'id' => (int) $u['id'],
        'email' => $u['email'],
        'name' => $u['name'],
        'role' => $u['role'],
        'confession' => $u['confession'] ?? null,
        'country' => $u['country'] ?? null,
        'city' => $u['city'] ?? null,
        'avatar' => $u['avatar'] ?? null,
        'email_verified' => ($u['email_verified_at'] ?? null) !== null,
    ];
}
