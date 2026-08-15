<?php
/**
 * ПРОВЕРКА: ВЕЗДЕ ЛИ ВРЕМЯ ПО МОСКВЕ.
 *
 * Смотрит на время не по коду, а по данным — так, как его увидит человек в
 * админке и в кабинете. Проверяет четыре вещи:
 *
 *   1. Часы сходятся: PHP, сервер и SQLite показывают одно и то же.
 *   2. В схеме не осталось умолчаний со всемирным временем.
 *   3. Новая запись ложится с московским временем — проверяется настоящей
 *      вставкой во временную таблицу.
 *   4. Прошлые записи сошлись между собой: время подачи заявки и время письма
 *      о ней, время платежа и время его записи в журнале. Раньше между ними
 *      было ровно три часа — теперь разрыва быть не должно.
 *
 *   php scripts/check_timezone.php
 */
declare(strict_types=1);
if (PHP_SAPI !== 'cli') { fwrite(STDERR, "CLI only\n"); exit(1); }

define('BASE_PATH', dirname(__DIR__));
$GLOBALS['CFG'] = require BASE_PATH . '/config.php';
require_once BASE_PATH . '/core/db.php';
require_once BASE_PATH . '/core/helpers.php';

$line = str_repeat('=', 78);
$bad = 0; $good = 0;
$ok   = function (string $s, string $extra = '') use (&$good) { $good++; echo "  [ок]    $s" . ($extra !== '' ? " — $extra" : '') . "\n"; };
$fail = function (string $s, string $extra = '') use (&$bad)  { $bad++;  echo "  [СБОЙ]  $s" . ($extra !== '' ? " — $extra" : '') . "\n"; };

/* ── 1. Часы ──────────────────────────────────────────────────────────────── */
echo "ЧАСЫ\n$line\n";
$phpNow    = date('Y-m-d H:i:s');
$sqliteNow = (string) scalar("SELECT datetime('now','localtime')");
$sysNow    = trim((string) @shell_exec('date "+%Y-%m-%d %H:%M:%S" 2>/dev/null'));
printf("  часовой пояс PHP: %s\n  PHP: %s\n  SQLite (localtime): %s\n  система: %s\n",
    date_default_timezone_get(), $phpNow, $sqliteNow, $sysNow ?: '(не спросить)');

date_default_timezone_get() === 'Europe/Moscow'
    ? $ok('PHP настроен на Москву')
    : $fail('PHP не на Москве', date_default_timezone_get());

abs(strtotime($phpNow) - strtotime($sqliteNow)) <= 5
    ? $ok('SQLite и PHP показывают одно время')
    : $fail('SQLite и PHP расходятся', $sqliteNow . ' против ' . $phpNow);

if ($sysNow !== '') {
    abs(strtotime($phpNow) - strtotime($sysNow)) <= 5
        ? $ok('часы сервера совпадают с PHP')
        : $fail('часы сервера расходятся с PHP', $sysNow);
}

/* ── 2. Схема ─────────────────────────────────────────────────────────────── */
echo "\nУМОЛЧАНИЯ В СХЕМЕ\n$line\n";
$leftUtc = all("SELECT name FROM sqlite_master
                 WHERE (sql LIKE '%datetime(''now'')%' AND sql NOT LIKE '%localtime%')
                    OR sql LIKE '%CURRENT_TIMESTAMP%'");
$leftUtc
    ? $fail('остались таблицы со всемирным временем в умолчании', implode(', ', array_column($leftUtc, 'name')))
    : $ok('ни одного умолчания со всемирным временем');

$withLocal = (int) scalar("SELECT COUNT(*) FROM sqlite_master WHERE sql LIKE '%localtime%'");
$ok('таблиц с московским умолчанием', (string) $withLocal);

/* ── 3. Новая запись ──────────────────────────────────────────────────────── */
echo "\nНОВАЯ ЗАПИСЬ\n$line\n";
db()->exec("CREATE TABLE IF NOT EXISTS tz_check (id INTEGER PRIMARY KEY AUTOINCREMENT,
            note TEXT DEFAULT '', created_at TEXT DEFAULT (datetime('now','localtime')))");
// Через умолчание SQLite.
db()->exec("INSERT INTO tz_check (note) VALUES ('умолчание')");
// Через нашу вставку insert() — она проставляет время сама.
insert('tz_check', ['note' => 'через insert()']);
foreach (all("SELECT note, created_at FROM tz_check ORDER BY id DESC LIMIT 2") as $r) {
    $d = abs(time() - strtotime((string) $r['created_at']));
    $d <= 120
        ? $ok('запись «' . $r['note'] . '» легла по Москве', (string) $r['created_at'])
        : $fail('запись «' . $r['note'] . '» легла не по Москве', (string) $r['created_at'] . ", разрыв {$d} с.");
}
db()->exec("DROP TABLE tz_check");

/* ── 4. Прошлые записи сошлись между собой ────────────────────────────────── */
echo "\nСХОДЯТСЯ ЛИ ВРЕМЕНА ОДНОГО СОБЫТИЯ\n$line\n";

/**
 * Заявка и письмо о ней. Письмо ставится в очередь в тот же миг, что и заявка,
 * поэтому разрыв между ними должен быть минутами, а не часами. Именно здесь
 * трёхчасовой сдвиг был виден в админке нагляднее всего.
 */
$pairs = all("SELECT a.id, a.created_at AS app_at, MIN(m.created_at) AS mail_at
                FROM applications a
                JOIN mail_queue m ON LOWER(m.to_email)=LOWER(a.email)
                                 AND m.created_at >= a.created_at
               WHERE TRIM(COALESCE(a.email,''))<>''
               GROUP BY a.id ORDER BY a.id DESC LIMIT 25");
$worst = 0; $worstId = 0; $n = 0;
foreach ($pairs as $p) {
    $gap = (strtotime((string) $p['mail_at']) - strtotime((string) $p['app_at'])) / 60;
    if ($gap < 0 || $gap > 24 * 60) continue;   // письма другого повода в счёт не берём
    $n++;
    if ($gap > $worst) { $worst = $gap; $worstId = (int) $p['id']; }
}
if ($n === 0) {
    echo "  пар «заявка + письмо» для сверки не нашлось\n";
} else {
    $worst <= 60
        ? $ok("заявка и письмо о ней сходятся по времени (проверено пар: $n)",
              sprintf('худший разрыв %d мин., заявка #%d', (int) $worst, $worstId))
        : $fail("между заявкой и письмом о ней разрыв (проверено пар: $n)",
              sprintf('%d мин., заявка #%d', (int) $worst, $worstId));
}

/** Свежесть последних записей: они не должны оказаться в будущем или в прошлом веке. */
$tables = [
    'applications' => 'created_at', 'users' => 'created_at', 'payments' => 'created_at',
    'mail_queue'   => 'created_at', 'audit_log' => 'created_at', 'site_events' => 'ts',
    'chat_messages'=> 'created_at', 'notifications' => 'created_at', 'inbox_messages' => 'created_at',
    'institutions' => 'updated_at', 'official_letters' => 'created_at', 'mail_events' => 'created_at',
];
echo "\nПОСЛЕДНЯЯ ЗАПИСЬ В КАЖДОЙ ТАБЛИЦЕ\n$line\n";
foreach ($tables as $t => $c) {
    try { $v = (string) scalar("SELECT MAX(\"$c\") FROM \"$t\" WHERE TRIM(COALESCE(\"$c\",''))<>''"); }
    catch (\Throwable $e) { continue; }
    if ($v === '') continue;
    $ts = strtotime($v);
    $ahead = $ts - time();
    $label = $ahead > 300 ? 'В БУДУЩЕМ на ' . (int) ($ahead / 60) . ' мин.'
           : 'назад ' . ru_relative_time($v);
    printf("  %-18s %-20s %s\n", $t, $v, $label);
    if ($ahead > 300) $fail("$t.$c показывает будущее", $v);
}

/* ── Итог ─────────────────────────────────────────────────────────────────── */
echo "\n$line\n";
printf("ПРОВЕРОК ПРОЙДЕНО: %d, СБОЕВ: %d\n", $good, $bad);
exit($bad > 0 ? 1 : 0);
