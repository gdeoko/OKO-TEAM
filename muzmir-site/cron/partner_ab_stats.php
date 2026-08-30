<?php
/**
 * ПЕРЕСЧЁТ СРАВНЕНИЯ ПАРТНЁРСКИХ ПИСЕМ — В ФОНЕ, А НЕ ПРИ ОТКРЫТИИ РАЗДЕЛА.
 *
 * Считать это в запросе админки нельзя: сравнение идёт по 20 тысячам записей,
 * 39 тысячам учреждений и 77 тысячам событий почты. Раздел «Партнёры» из-за
 * этого перестал открываться вовсе — страница висела минутами.
 *
 * Здесь тот же расчёт, но в фоне: результат ложится в настройку
 * partner_ab_stats, а админка только читает готовое. Цифры сравнения меняются
 * за часы, так что раз в час более чем достаточно.
 *
 * Строка расписания (CRON_TZ=Europe/Moscow):
 *   7 * * * * php /var/www/muzmir/cron/partner_ab_stats.php >> data/logs/cron.log 2>&1
 */
declare(strict_types=1);
if (PHP_SAPI !== 'cli') { fwrite(STDERR, "CLI only\n"); exit(1); }

define('BASE_PATH', dirname(__DIR__));
$GLOBALS['CFG'] = require BASE_PATH . '/config.php';
require_once BASE_PATH . '/core/db.php';
require_once BASE_PATH . '/core/helpers.php';
require_once BASE_PATH . '/core/partner_ab.php';
require_once __DIR__ . '/_lib.php';

const JOB = 'partner_ab_stats';

if (!cron_lock(JOB, 1800)) { cron_log(JOB, 'предыдущий заход ещё идёт'); exit(0); }

try {
    $t0 = microtime(true);
    $s = pab_stats(true);
    $a = (array) ($s['a'] ?? []);
    $b = (array) ($s['b'] ?? []);
    cron_log(JOB, sprintf('пересчитано за %.1f с: А — учреждений %d, согласий %d; Б — учреждений %d, согласий %d',
        microtime(true) - $t0,
        (int) ($a['n'] ?? 0), (int) ($a['partners'] ?? 0),
        (int) ($b['n'] ?? 0), (int) ($b['partners'] ?? 0)));
} catch (\Throwable $e) {
    cron_log(JOB, 'ОШИБКА: ' . $e->getMessage());
} finally {
    cron_unlock(JOB);
}
