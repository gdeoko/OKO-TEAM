<?php
/** Middleware аутентификации: Bearer access-token. */

declare(strict_types=1);

final class Auth
{
    /**
     * Заголовок Authorization как он до нас дошёл. На части хостингов
     * Apache отдаёт его под другим именем или только через getallheaders(),
     * поэтому смотрим во все три места, иначе вход молча отвечает 401.
     */
    public static function bearerHeader(): string
    {
        foreach (['HTTP_AUTHORIZATION', 'REDIRECT_HTTP_AUTHORIZATION'] as $ключ) {
            if (!empty($_SERVER[$ключ])) return (string) $_SERVER[$ключ];
        }
        if (function_exists('getallheaders')) {
            foreach (getallheaders() as $имя => $значение) {
                if (strcasecmp($имя, 'Authorization') === 0) return (string) $значение;
            }
        }
        return '';
    }

    /** Текущий пользователь или 401. @return array строка users */
    public static function requireUser(): array
    {
        $header = self::bearerHeader();
        if (!preg_match('/^Bearer\s+(\S+)$/', $header, $m)) {
            Response::error('Требуется авторизация', 401);
        }
        $claims = JWT::verify($m[1]);
        if ($claims === null || ($claims['typ'] ?? '') !== 'access') {
            Response::error('Токен недействителен или истёк', 401);
        }
        $user = DB::query('SELECT * FROM users WHERE id = ? AND is_blocked = 0',
            [(int) $claims['sub']])->fetch();
        if (!$user) {
            Response::error('Пользователь не найден', 401);
        }
        return $user;
    }

    public static function requireSuperadmin(): array
    {
        $user = self::requireUser();
        if ($user['role'] !== 'superadmin') {
            Response::error('Недостаточно прав', 403);
        }
        return $user;
    }
}
