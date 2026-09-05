<?php
/**
 * Еженедельный полный бэкап: БД + public/uploads + public/diplomas -> один zip-архив.
 * Запуск: раз в неделю (ночью, в выходной).
 *
 * Так же, как daily_backup.php: локальная копия всегда сохраняется в data/backups/
 * (ротация 90 дней - хранится дольше суточных), а при наличии ключей S3 архив
 * дополнительно грузится в S3-совместимое хранилище (s3.twcstorage.ru).
 *
 * Запуск: php cron/weekly_backup.php
 */
declare(strict_types=1);
if (PHP_SAPI !== 'cli') { fwrite(STDERR, "CLI only\n"); exit(1); }

define('BASE_PATH', dirname(__DIR__));
$GLOBALS['CFG'] = require BASE_PATH . '/config.php';
require_once BASE_PATH . '/core/db.php';
require_once BASE_PATH . '/core/helpers.php';
require_once __DIR__ . '/_lib.php';

const JOB = 'weekly_backup';
/* СКОЛЬКО ДЕРЖИМ НЕДЕЛЬНЫЕ АРХИВЫ.
 *
 * Было 90 дней. Архив весит 4.5 ГБ (в нём и база, и все выданные наградные
 * документы, и загруженные файлы), раздел — 38 ГБ: тринадцать архивов не
 * поместятся никогда, а переполнение диска останавливает не бэкап, а сайт —
 * SQLite перестаёт писать, PDF не сохраняются, рассылка встаёт.
 *
 * Две недели — это две полные копии, больше диск не выдержит. Настоящая
 * страховка от смерти диска — выгрузка наружу (S3), она включается ключами
 * S3_ACCESS_KEY/S3_SECRET_KEY; пока их нет, копия живёт рядом с оригиналом. */
const RETENTION_DAYS = 14;

/* Недельный архив — это база плюс выданные наградные документы и загрузки;
   на пике рядом лежат и временный снимок базы, и растущий zip. */
$__needGb = ((float) (@filesize((string) cfgv('db_path')) ?: 0)
           + (float) cron_dir_size(BASE_PATH . '/public/diplomas')
           + (float) cron_dir_size(BASE_PATH . '/public/uploads')) / 1073741824;
if (!cron_disk_ok(JOB, max(1.0, $__needGb * 1.2))) exit(0);

if (!cron_lock(JOB, 3600 * 12)) {
    cron_log(JOB, 'предыдущий запуск ещё выполняется, выход');
    exit(0);
}

/** Рекурсивно добавляет содержимое каталога в архив под именем $prefix/... */
function zip_add_dir(ZipArchive $zip, string $dir, string $prefix): int {
    if (!is_dir($dir)) return 0;
    $count = 0;
    $it = new RecursiveIteratorIterator(
        new RecursiveDirectoryIterator($dir, FilesystemIterator::SKIP_DOTS),
        RecursiveIteratorIterator::LEAVES_ONLY
    );
    foreach ($it as $file) {
        if (!$file->isFile()) continue;
        $local = $prefix . '/' . ltrim(substr($file->getPathname(), strlen($dir)), '/');
        $zip->addFile($file->getPathname(), $local);
        $count++;
    }
    return $count;
}

try {
    if (!class_exists('ZipArchive')) {
        cron_log(JOB, 'расширение zip недоступно - выход');
        cron_unlock(JOB);
        exit(0);
    }

    $dbPath = (string) cfgv('db_path');
    $backupDir = BASE_PATH . '/data/backups';
    if (!is_dir($backupDir)) @mkdir($backupDir, 0775, true);

    $stamp = date('Y-\WW_Y-m-d');
    $zipName = "muzmir_weekly_$stamp.zip";
    $zipPath = $backupDir . '/' . $zipName;

    // Согласованный снимок БД во временный файл (как в daily_backup.php).
    $dbTmp = sys_get_temp_dir() . '/muzmir_weekly_db_' . date('Ymd_His') . '_' . substr(md5(uniqid('', true)), 0, 6) . '.sqlite';
    if (is_file($dbPath)) {
        try {
            $quoted = "'" . str_replace("'", "''", $dbTmp) . "'";
            db()->exec('VACUUM INTO ' . $quoted);
        } catch (\Throwable $e) {
            cron_log(JOB, 'VACUUM INTO не удался (' . $e->getMessage() . ') - фолбэк на файловую копию БД');
            @copy($dbPath, $dbTmp);
        }
    }

    $zip = new ZipArchive();
    if ($zip->open($zipPath, ZipArchive::CREATE | ZipArchive::OVERWRITE) !== true) {
        cron_log(JOB, "не удалось создать архив $zipPath");
        cron_unlock(JOB);
        exit(1);
    }

    if (is_file($dbTmp)) {
        $zip->addFile($dbTmp, 'db/muzmir.sqlite');
    } elseif (is_file($dbPath)) {
        $zip->addFile($dbPath, 'db/muzmir.sqlite');
    }

    $filesUploads = zip_add_dir($zip, BASE_PATH . '/public/uploads', 'uploads');
    $filesDiplomas = zip_add_dir($zip, BASE_PATH . '/public/diplomas', 'diplomas');

    $zip->close();
    @unlink($dbTmp);

    if (!is_file($zipPath)) {
        cron_log(JOB, 'ОШИБКА: архив не создан');
        cron_unlock(JOB);
        exit(1);
    }
    cron_log(JOB, sprintf(
        'архив создан: %s (%.1f КБ, uploads=%d, diplomas=%d)',
        $zipPath, filesize($zipPath) / 1024, $filesUploads, $filesDiplomas
    ));

    if (s3_ready()) {
        $ok = s3_put_file($zipPath, 'weekly/' . $zipName);
        cron_log(JOB, $ok ? 'загружен в S3: weekly/' . $zipName : 'загрузка в S3 не удалась - оставлена только локальная копия');
    } else {
        cron_log(JOB, 'ключи S3 не заданы - только локальная копия');
    }

    $removed = cron_rotate_dir($backupDir, 'muzmir_weekly_*.zip', RETENTION_DAYS);
    if ($removed > 0) cron_log(JOB, "ротация: удалено старых архивов $removed (старше " . RETENTION_DAYS . " дн.)");
} catch (\Throwable $e) {
    cron_log(JOB, 'ОШИБКА: ' . $e->getMessage());
} finally {
    cron_unlock(JOB);
}
