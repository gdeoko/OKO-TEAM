<?php
/**
 * Ежедневный бэкап БД (data/muzmir.sqlite). Запуск: раз в день (ночью).
 *
 * Снимок делается через `VACUUM INTO` (согласованная копия, безопасно даже при
 * параллельных записях в WAL) во временный файл, затем:
 *   - всегда сохраняется локальная копия в data/backups/ (ротация 30 дней);
 *   - если заданы ключи S3 (env S3_ACCESS_KEY/S3_SECRET_KEY либо
 *     OKO_S3_ACCESS_KEY/OKO_S3_SECRET_KEY, либо cfg('MUZMIR_S3_*')) - тот же файл
 *     дополнительно грузится в S3-совместимое хранилище (s3.twcstorage.ru).
 * Если ключей S3 нет - работает только локальная копия (согласно ТЗ).
 *
 * Запуск: php cron/daily_backup.php
 */
declare(strict_types=1);
if (PHP_SAPI !== 'cli') { fwrite(STDERR, "CLI only\n"); exit(1); }

define('BASE_PATH', dirname(__DIR__));
$GLOBALS['CFG'] = require BASE_PATH . '/config.php';
require_once BASE_PATH . '/core/db.php';
require_once BASE_PATH . '/core/helpers.php';
require_once __DIR__ . '/_lib.php';

const JOB = 'daily_backup';
const RETENTION_DAYS = 30;

if (!cron_lock(JOB, 3600 * 6)) {
    cron_log(JOB, 'предыдущий запуск ещё выполняется, выход');
    exit(0);
}

try {
    $dbPath = (string) cfgv('db_path');
    if (!is_file($dbPath)) {
        cron_log(JOB, "файл БД не найден ($dbPath) - нечего бэкапить");
        cron_unlock(JOB);
        exit(0);
    }

    $stamp = date('Y-m-d_His');
    $name = "muzmir_$stamp.sqlite";

    $backupDir = BASE_PATH . '/data/backups';
    if (!is_dir($backupDir)) @mkdir($backupDir, 0775, true);
    $localPath = $backupDir . '/' . $name;
    if (is_file($localPath)) {
        // Повторный запуск в ту же секунду (ручной тест и т.п.) - не даём VACUUM INTO
        // упасть на «file already exists», просто уникализируем имя.
        $name = "muzmir_{$stamp}_" . substr(md5(uniqid('', true)), 0, 6) . '.sqlite';
        $localPath = $backupDir . '/' . $name;
    }

    // Согласованный снимок через VACUUM INTO (безопасно при активном WAL).
    // Любая ошибка (например, файл всё же уже существует) - тихий фолбэк на копию файла.
    try {
        $quoted = "'" . str_replace("'", "''", $localPath) . "'";
        db()->exec('VACUUM INTO ' . $quoted);
    } catch (\Throwable $e) {
        cron_log(JOB, 'VACUUM INTO не удался (' . $e->getMessage() . ') - фолбэк на файловую копию');
    }

    if (!is_file($localPath) || filesize($localPath) === 0) {
        cron_log(JOB, 'VACUUM INTO не создал файл - фолбэк на файловую копию');
        @copy($dbPath, $localPath);
    }

    if (!is_file($localPath)) {
        cron_log(JOB, 'ОШИБКА: локальный бэкап не создан');
        cron_unlock(JOB);
        exit(1);
    }
    cron_log(JOB, 'локальный бэкап создан: ' . $localPath . ' (' . round(filesize($localPath) / 1024, 1) . ' КБ)');

    if (s3_ready()) {
        $ok = s3_put_file($localPath, 'daily/' . $name);
        cron_log(JOB, $ok ? 'загружен в S3: daily/' . $name : 'загрузка в S3 не удалась - оставлена только локальная копия');
    } else {
        cron_log(JOB, 'ключи S3 не заданы - только локальная копия');
    }

    $removed = cron_rotate_dir($backupDir, 'muzmir_*.sqlite', RETENTION_DAYS);
    if ($removed > 0) cron_log(JOB, "ротация: удалено старых копий $removed (старше " . RETENTION_DAYS . " дн.)");
} catch (\Throwable $e) {
    cron_log(JOB, 'ОШИБКА: ' . $e->getMessage());
} finally {
    cron_unlock(JOB);
}
