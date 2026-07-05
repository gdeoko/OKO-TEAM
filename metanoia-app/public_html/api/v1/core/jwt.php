<?php
/** JWT HS256 — собственная реализация (без зависимостей). */

declare(strict_types=1);

final class JWT
{
    private static function b64(string $data): string
    {
        return rtrim(strtr(base64_encode($data), '+/', '-_'), '=');
    }

    private static function unb64(string $data): string|false
    {
        return base64_decode(strtr($data, '-_', '+/'));
    }

    /** @param array $claims  доп. поля (sub, role...) */
    public static function issue(array $claims, int $ttlSeconds): string
    {
        $header  = self::b64(json_encode(['alg' => 'HS256', 'typ' => 'JWT']));
        $payload = self::b64(json_encode($claims + [
            'iat' => time(),
            'exp' => time() + $ttlSeconds,
        ]));
        $sig = self::b64(hash_hmac('sha256', "$header.$payload",
            (string) Config::get('JWT_SECRET', ''), true));
        return "$header.$payload.$sig";
    }

    /** @return array|null  claims или null, если токен невалиден/просрочен */
    public static function verify(string $token): ?array
    {
        $parts = explode('.', $token);
        if (count($parts) !== 3) return null;
        [$h, $p, $s] = $parts;
        $expected = self::b64(hash_hmac('sha256', "$h.$p",
            (string) Config::get('JWT_SECRET', ''), true));
        if (!hash_equals($expected, $s)) return null;
        $claims = json_decode(self::unb64($p) ?: '', true);
        if (!is_array($claims)) return null;
        if (($claims['exp'] ?? 0) < time()) return null;
        return $claims;
    }
}
