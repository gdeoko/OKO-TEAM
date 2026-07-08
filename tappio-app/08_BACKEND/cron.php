<?php
/*
 * SMART APPS · CRON
 * Запуск дожимов. Установить в cron:
 *   1,31 * * * * php /home/USER/public_html/cron.php >> /home/USER/cron.log 2>&1
 *
 * Просто дёргает api.php?action=drip с admin-ключом.
 */

require_once __DIR__ . '/api-config.php'; // вынести ADMIN_KEY туда же или продублировать

if (!defined('ADMIN_KEY')) {
    define('ADMIN_KEY', 'tappio_2026_secret_key'); // тот же что в api.php
}

$url = 'http://localhost/api.php?action=drip&key=' . ADMIN_KEY;

// Через CLI: php cron.php
if (php_sapi_name() === 'cli') {
    $r = @file_get_contents($url);
    echo '['.date('Y-m-d H:i:s').'] '.($r ?: 'NO RESPONSE')."\n";
    exit;
}

// Если запустили через HTTP — тоже сработает
header('Content-Type: text/plain');
echo @file_get_contents($url);
