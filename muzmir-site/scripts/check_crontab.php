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
 * ОБА НАПРАВЛЕНИЯ РАСХОЖДЕНИЯ ОПАСНЫ, и раньше ловилось только одно. Задание,
 * которое есть на сервере, но не записано в эталон, тихо исчезает в тот момент,
 * когда человек выполняет документированную команду восстановления: так под нож
 * попадали постинг ВК, приглашения педагогам и почтовая гигиена. Поэтому здесь
 * тревога идёт и на пропажу, и на непрописанное задание. Осознанно выключенные
 * задания эталон держит в закомментированных строках — они считаются известными
 * и молчат.
 *
 * Половина живого расписания лежит в scripts/, а не в cron/, поэтому имена
 * снимаются из обеих папок: пока разбирался только cron/, восемь заданий
 * почтовой гигиены были для сторожа невидимы в принципе.
 *
 * Запуск вручную: php scripts/check_crontab.php
 * В расписании:   0 7 * * * (строка стоит в scripts/crontab.txt)
 */
declare(strict_types=1);
if (PHP_SAPI !== 'cli') { fwrite(STDERR, "CLI only\n"); exit(1); }

define('BASE_PATH', dirname(__DIR__));
$GLOBALS['CFG'] = require BASE_PATH . '/config.php';
require_once BASE_PATH . '/core/db.php';
require_once BASE_PATH . '/core/helpers.php';

/**
 * Имена запускаемых скриптов из строк crontab-подобного текста.
 * $withComments — брать и закомментированные строки: в эталоне так записаны
 * осознанно выключенные и разовые задания, и посторонними они не считаются.
 */
function cc_scripts(string $text, bool $withComments = false): array {
    $out = [];
    // Разбиваем только по настоящим переводам строки. Шаблон \R в PCRE без
    // флага u считает переводом ещё и одиночный байт 0x85, а он стоит внутри
    // русских букв («х» это D1 85) — комментарии рвались посреди слова, и
    // огрызок выключенной строки читался как действующее задание.
    foreach (preg_split('~\r\n|\n|\r~', $text) ?: [] as $line) {
        $line = trim($line);
        if ($line === '') continue;
        if ($line[0] === '#' && !$withComments) continue;
        // Задания лежат и в cron/, и в scripts/ — вторую папку сторож раньше не видел.
        if (preg_match('~(?:cron|scripts)/([a-z0-9_]+\.php)~i', $line, $m)) $out[$m[1]] = true;
    }
    ksort($out);
    return array_keys($out);
}

$refFile = BASE_PATH . '/scripts/crontab.txt';
if (!is_file($refFile)) { fwrite(STDERR, "Нет эталона: $refFile\n"); exit(1); }
$refText = (string) file_get_contents($refFile);
$want    = cc_scripts($refText);            // что эталон предписывает запускать
$known   = cc_scripts($refText, true);      // плюс записанные, но выключенные

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
// «Лишнее» — это задание, которое работает на сервере и НИГДЕ не записано в
// эталоне, даже строкой-комментарием. Именно оно исчезает без следа при команде
// восстановления, поэтому молчать о нём нельзя.
$extra   = array_values(array_diff($have, $known));

echo "эталон: " . count($want) . " заданий, на сервере: " . count($have) . "\n";
if ($missing) echo "НЕ ХВАТАЕТ (" . count($missing) . "): " . implode(', ', $missing) . "\n";
if ($extra)   echo "НЕ ЗАПИСАНО В ЭТАЛОН (" . count($extra) . "): " . implode(', ', $extra) . "\n";
if (!$missing && !$extra) { echo "совпадает полностью\n"; exit(0); }

$alerts = [];
if ($missing) {
    $alerts[] = 'в crontab не хватает заданий — ' . implode(', ', $missing)
              . '. Восстановить: crontab ' . $refFile;
}
if ($extra) {
    $alerts[] = 'на сервере работают задания, которых нет в эталоне — '
              . implode(', ', $extra) . '. Дописать в ' . $refFile
              . ', иначе замена расписания их сотрёт.';
}
if ($alerts && function_exists('tg_notify_admin')) {
    try { tg_notify_admin('Музыкальный Мир: ' . implode(' / ', $alerts)); } catch (\Throwable $e) {}
}
// 3 — пропажа (что-то не работает), 4 — эталон отстал (мина под восстановление).
exit($missing ? 3 : 4);
