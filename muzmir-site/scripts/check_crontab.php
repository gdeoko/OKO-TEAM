<?php
/**
 * СВЕРКА РЕАЛЬНОГО CRONTAB С ЭТАЛОНОМ scripts/crontab.txt.
 *
 * Зачем: crontab на VPS живёт отдельно от репозитория. Он слетает при
 * переустановке, его правят руками и забывают вернуть строку. Пропажу заметить
 * невозможно — крон не падает, он просто не запускается, и всё выглядит нормально
 * ровно до того дня, когда не открылся новый месяц или не ушла волна запуска.
 *
 * Скрипт сравнивает список ЗАПУСКАЕМЫХ ФАЙЛОВ (не строк целиком: пути и
 * перенаправления вывода на разных серверах отличаются законно) и сообщает,
 * чего не хватает. При расхождении — уведомление владельцу в Telegram.
 *
 * Запуск вручную:            php scripts/check_crontab.php
 * Раз в сутки (по желанию):  0 7 * * * php /var/www/muzmir/scripts/check_crontab.php
 */
declare(strict_types=1);
if (PHP_SAPI !== 'cli') { fwrite(STDERR, "CLI only\n"); exit(1); }

define('BASE_PATH', dirname(__DIR__));
$GLOBALS['CFG'] = require BASE_PATH . '/config.php';
require_once BASE_PATH . '/core/db.php';
require_once BASE_PATH . '/core/helpers.php';

/** Имена cron-скриптов из строк crontab-подобного текста. */
function cc_scripts(string $text): array {
    $out = [];
    foreach (preg_split('~\R~', $text) as $line) {
        $line = trim($line);
        if ($line === '' || $line[0] === '#') continue;
        if (preg_match('~cron/([a-z0-9_]+\.php)~i', $line, $m)) $out[$m[1]] = true;
    }
    ksort($out);
    return array_keys($out);
}

$refFile = BASE_PATH . '/scripts/crontab.txt';
if (!is_file($refFile)) { fwrite(STDERR, "Нет эталона: $refFile\n"); exit(1); }
$want = cc_scripts((string) file_get_contents($refFile));

$live = shell_exec('crontab -l 2>/dev/null');
if ($live === null || trim((string) $live) === '') {
    $msg = 'CRONTAB ПУСТ. Ни одно задание сайта не выполняется. Восстановить: '
         . 'crontab ' . $refFile;
    echo $msg . "\n";
    if (function_exists('tg_notify_admin')) { try { tg_notify_admin('Музыкальный Мир: ' . $msg); } catch (\Throwable $e) {} }
    exit(2);
}
$have = cc_scripts((string) $live);

$missing = array_values(array_diff($want, $have));
$extra   = array_values(array_diff($have, $want));

echo "эталон: " . count($want) . " заданий, на сервере: " . count($have) . "\n";
if ($missing) echo "НЕ ХВАТАЕТ (" . count($missing) . "): " . implode(', ', $missing) . "\n";
if ($extra)   echo "лишние, нет в эталоне (" . count($extra) . "): " . implode(', ', $extra) . "\n";
if (!$missing && !$extra) { echo "совпадает полностью\n"; exit(0); }

// Молчим о «лишних» — их мог добавить владелец осознанно. Тревожим только о пропаже.
if ($missing && function_exists('tg_notify_admin')) {
    try {
        tg_notify_admin("Музыкальный Мир: в crontab не хватает заданий — "
            . implode(', ', $missing) . ". Восстановить: crontab $refFile");
    } catch (\Throwable $e) {}
}
exit($missing ? 3 : 0);
