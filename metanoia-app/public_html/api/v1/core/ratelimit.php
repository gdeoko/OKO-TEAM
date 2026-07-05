<?php
/** Простой rate-limit на файлах (shared-hosting, без Redis). */

declare(strict_types=1);

final class RateLimit
{
    public static function check(string $key, int $limit, int $windowSec): void
    {
        $dir = sys_get_temp_dir() . '/metanoia-rl';
        if (!is_dir($dir)) @mkdir($dir, 0700, true);
        $file = $dir . '/' . sha1($key);
        $now = time();

        $data = ['start' => $now, 'count' => 0];
        if (is_readable($file)) {
            $stored = json_decode((string) file_get_contents($file), true);
            if (is_array($stored) && ($now - ($stored['start'] ?? 0)) < $windowSec) {
                $data = $stored;
            }
        }
        $data['count']++;

        if ($data['count'] > $limit) {
            header('Retry-After: ' . (string) max(1, $windowSec - ($now - $data['start'])));
            Response::error('Слишком много запросов, попробуйте позже', 429);
        }
        @file_put_contents($file, json_encode($data), LOCK_EX);
    }
}
