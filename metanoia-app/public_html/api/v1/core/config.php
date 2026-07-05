<?php
/** Конфиг из .env (лежит в /config/.env, ВНЕ public_html). */

declare(strict_types=1);

final class Config
{
    private static ?array $env = null;

    private static function load(): void
    {
        if (self::$env !== null) return;
        self::$env = [];
        // /public_html/api/v1/core → корень проекта → config/.env
        $file = dirname(__DIR__, 4) . '/config/.env';
        if (is_readable($file)) {
            foreach (file($file, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES) as $line) {
                if ($line[0] === '#' || !str_contains($line, '=')) continue;
                [$k, $v] = explode('=', $line, 2);
                self::$env[trim($k)] = trim($v);
            }
        }
    }

    public static function get(string $key, ?string $default = null): ?string
    {
        self::load();
        return self::$env[$key] ?? getenv($key) ?: $default;
    }
}
