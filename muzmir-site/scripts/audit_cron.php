<?php
/**
 * ПРОВЕРКА РАСПИСАНИЯ: ЧАС ЗАПУСКА ПРОТИВ ТОГО, ЧТО ЗАДАНИЕ УМЕЕТ.
 *
 * Проверяется то, что ломалось вживую и не было видно ни в одном журнале.
 *
 * ПЕРВОЕ. Задание стояло на 08:00, а внутри само отказывалось работать раньше
 * 09:00 (рабочее окно владельца). Каждый день оно выходило на первой строке, не
 * сделав ничего; вывод уходил в /dev/null, поэтому и в cron.log не появлялось
 * даже строки об отказе. Так пропали напоминания о заказе наград, а окно заказа
 * всего 60 дней. Здесь час из расписания сверяется с окном для КАЖДОГО задания,
 * у которого внутри есть проверка outreach_window_ok().
 *
 * ВТОРОЕ. Эталон scripts/crontab.txt отставал от живого crontab, а команда
 * восстановления в документации замещает расписание целиком: всё, чего в файле
 * нет, исчезает молча. Здесь видно, какие файлы из cron/ в эталоне не значатся
 * вообще — ни строкой, ни комментарием.
 *
 * Сверку эталона с ЖИВЫМ crontab делает scripts/check_crontab.php (ему нужен
 * сервер). Этот аудит работает на одном репозитории и годится для проверки перед
 * выкладкой.
 *
 *   php scripts/audit_cron.php
 */
declare(strict_types=1);
if (PHP_SAPI !== 'cli') { fwrite(STDERR, "CLI only\n"); exit(1); }

define('BASE_PATH', dirname(__DIR__));
$GLOBALS['CFG'] = require BASE_PATH . '/config.php';
require_once BASE_PATH . '/core/outreach_window.php';

$line = str_repeat('=', 78);
$ok = $bad = 0;
$say = function (bool $good, string $what, string $note = '') use (&$ok, &$bad): void {
    if ($good) { $ok++;  printf("  [ок]   %s%s\n", $what, $note !== '' ? ' — ' . $note : ''); }
    else       { $bad++; printf("  [СБОЙ] %s%s\n", $what, $note !== '' ? ' — ' . $note : ''); }
};

$refFile = BASE_PATH . '/scripts/crontab.txt';
if (!is_file($refFile)) { fwrite(STDERR, "Нет эталона: $refFile\n"); exit(1); }
// Только настоящие переводы строки: \R без флага u рвёт текст по байту 0x85,
// который стоит внутри русских букв, и комментарий распадается на огрызки.
$refLines = preg_split('~\r\n|\n|\r~', (string) file_get_contents($refFile)) ?: [];

/**
 * Развернуть поле crontab в список значений: звёздочка, диапазон 9-18,
 * перечисление 0,15,30 и шаг (звёздочка со слешем — записать её здесь нельзя,
 * последовательность закрыла бы комментарий).
 * Возвращает null, если поле разобрать не удалось — тогда час не проверяем,
 * а сообщаем о непонятной строке отдельно.
 */
function ac_expand(string $field, int $min, int $max): ?array {
    $out = [];
    foreach (explode(',', $field) as $part) {
        $step = 1;
        if (str_contains($part, '/')) {
            [$part, $s] = explode('/', $part, 2);
            if (!ctype_digit($s) || (int) $s < 1) return null;
            $step = (int) $s;
        }
        if ($part === '*') { $from = $min; $to = $max; }
        elseif (preg_match('~^(\d+)-(\d+)$~', $part, $m)) { $from = (int) $m[1]; $to = (int) $m[2]; }
        elseif (ctype_digit($part)) { $from = $to = (int) $part; }
        else return null;
        if ($from < $min || $to > $max || $from > $to) return null;
        for ($v = $from; $v <= $to; $v += $step) $out[] = $v;
    }
    sort($out);
    return array_values(array_unique($out));
}

/* ── Разбор эталона ──────────────────────────────────────────────────────── */
$jobs = [];        // активные строки: script => [hours, dows, line]
$mentioned = [];   // все упомянутые скрипты, включая выключенные комментарием
$badLines = [];

foreach ($refLines as $raw) {
    $l = trim($raw);
    if ($l === '') continue;
    $isComment = $l[0] === '#';
    if (preg_match('~(?:cron|scripts)/([a-z0-9_]+\.php)~i', $l, $m)) $mentioned[$m[1]] = true;
    if ($isComment) continue;
    if (preg_match('~^(?:CRON_TZ|MAILTO)=~', $l)) continue;

    $f = preg_split('~\s+~', $l, 6);
    if (!$f || count($f) < 6) { $badLines[] = $l; continue; }
    if (!preg_match('~(?:cron|scripts)/([a-z0-9_]+\.php)~i', $f[5], $m)) { $badLines[] = $l; continue; }
    $jobs[$m[1]] = ['hours' => ac_expand($f[1], 0, 23), 'dow' => ac_expand($f[4], 0, 7), 'line' => $l];
}

echo "СТРОКИ ЭТАЛОНА РАЗБИРАЮТСЯ\n$line\n";
$say(!$badLines, 'все активные строки в формате «5 полей + команда»',
     $badLines ? implode(' | ', array_slice($badLines, 0, 3)) : count($jobs) . ' заданий');
$say(isset($jobs['check_crontab.php']),
     'сторож расхождений стоит в расписании',
     'без него эталон снова тихо отстанет от сервера');

/* ── Час запуска против рабочего окна ────────────────────────────────────── */
echo "\nЧАС ЗАПУСКА ВНУТРИ РАБОЧЕГО ОКНА (пн-сб "
   . OUTREACH_HOUR_FROM . ':00-' . OUTREACH_HOUR_TO . ":00 МСК)\n$line\n";

$guarded = [];
foreach (glob(BASE_PATH . '/cron/*.php') ?: [] as $path) {
    $src = (string) file_get_contents($path);
    // Задание отказывается работать вне окна — значит его час обязан попадать в окно.
    if (str_contains($src, 'outreach_window_ok(')) $guarded[basename($path)] = true;
}
$say(!empty($guarded), 'задания с проверкой окна найдены', implode(', ', array_keys($guarded)));

foreach (array_keys($guarded) as $name) {
    if (!isset($jobs[$name])) continue;               // не в расписании — это другой раздел
    $hours = $jobs[$name]['hours'];
    $dow   = $jobs[$name]['dow'];
    if ($hours === null || $dow === null) { $say(false, "$name: поля расписания не разобраны", $jobs[$name]['line']); continue; }

    $inside  = array_values(array_filter($hours, static fn($h) => $h >= OUTREACH_HOUR_FROM && $h < OUTREACH_HOUR_TO));
    $outside = array_values(array_diff($hours, $inside));
    // Ни одного часа внутри окна — задание не сработает никогда, и молча.
    $say(!empty($inside), "$name: есть час внутри окна",
         $inside ? 'часы ' . implode(',', $inside) . ($outside ? ' (вне окна ' . implode(',', $outside) . ' — их отсекает сам скрипт)' : '')
                 : 'расписание ' . implode(',', $hours) . ' целиком вне окна, задание не делает ничего');

    // Только воскресенье — то же самое: скрипт наружу не пойдёт ни разу.
    $workdays = array_values(array_filter($dow, static fn($d) => $d !== 0 && $d !== 7));
    $say(!empty($workdays), "$name: есть рабочий день недели",
         $workdays ? 'дни ' . implode(',', $workdays) : 'стоит только на воскресенье');
}

/* ── Отказ по окну должен быть виден ─────────────────────────────────────── */
echo "\nОТКАЗ ПО ОКНУ ПОПАДАЕТ В ЖУРНАЛ\n$line\n";
foreach (['award_order_reminders.php', 'calendar_reminders.php'] as $name) {
    if (!isset($jobs[$name])) { $say(false, "$name: нет в расписании"); continue; }
    // /dev/null съедал единственное сообщение об отказе, и задание просто
    // исчезало из cron.log — пропажу было нечем заметить.
    $say(!str_contains($jobs[$name]['line'], '/dev/null'),
         "$name: вывод идёт в журнал, а не в /dev/null");
    $src = (string) file_get_contents(BASE_PATH . '/cron/' . $name);
    $say((bool) preg_match('~cron_log\(JOB,\s*\'вне рабочего окна~u', $src),
         "$name: отказ по окну пишется через cron_log");
}

/* ── Эталон против содержимого cron/ ─────────────────────────────────────── */
echo "\nВСЕ ЗАДАНИЯ ИЗ cron/ УЧТЕНЫ В ЭТАЛОНЕ\n$line\n";
$unlisted = [];
foreach (glob(BASE_PATH . '/cron/*.php') ?: [] as $path) {
    $name = basename($path);
    if ($name === '_lib.php') continue;               // общая библиотека, не задание
    if (!isset($mentioned[$name])) $unlisted[] = $name;
}
$say(!$unlisted, 'каждый файл cron/ записан в scripts/crontab.txt',
     $unlisted ? 'не значатся: ' . implode(', ', $unlisted)
               . ' — при восстановлении расписания их не будет'
               : count($mentioned) . ' упоминаний');

echo "\n$line\nПРОЙДЕНО: $ok · СБОЕВ: $bad\n";
exit($bad > 0 ? 1 : 0);
