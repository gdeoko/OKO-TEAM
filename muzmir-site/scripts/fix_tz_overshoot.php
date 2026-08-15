<?php
/**
 * ЗАПИСИ, СДВИНУТЫЕ ДВАЖДЫ.
 *
 * Общий сдвиг времени (scripts/fix_timezone.php) поднимал на три часа всё, что
 * записал SQLite. Но между выкладкой исправленного кода и самим сдвигом прошло
 * несколько секунд, и записи, успевшие лечь в этот промежуток, уже были
 * московскими — им сдвиг не полагался. Они уехали на три часа вперёд, и в списках
 * видно время, которого ещё не было.
 *
 * Здесь такие записи возвращаются назад. Признак простой и надёжный: время
 * события не может быть в будущем. Колонки, где будущее законно (следующее
 * списание в клубе), исключены поимённо.
 *
 *   php scripts/fix_tz_overshoot.php           — показать
 *   php scripts/fix_tz_overshoot.php --apply   — исправить
 */
declare(strict_types=1);
if (PHP_SAPI !== 'cli') { fwrite(STDERR, "CLI only\n"); exit(1); }

define('BASE_PATH', dirname(__DIR__));
$GLOBALS['CFG'] = require BASE_PATH . '/config.php';
require_once BASE_PATH . '/core/db.php';
require_once BASE_PATH . '/core/helpers.php';

$apply = in_array('--apply', $argv, true);
$line  = str_repeat('=', 78);
$HOURS = 3;                       // на столько сдвигал общий проход
$SKIP  = ['club_members.next_charge_at'];   // тут будущее — норма

/* Колонки времени: те, у которых в схеме стоит умолчание со временем, плюс те,
   которым время проставляет запрос. Список тот же, что у общего сдвига. */
$targets = [];
foreach (all("SELECT name FROM sqlite_master WHERE type='table' AND sql LIKE '%localtime%'") as $t) {
    foreach (all("PRAGMA table_info(\"" . $t['name'] . "\")") as $c) {
        if (strpos((string) ($c['dflt_value'] ?? ''), 'datetime') !== false) {
            $targets[(string) $t['name']][] = (string) $c['name'];
        }
    }
}
foreach ([
    'institutions'     => ['updated_at'],
    'competitions'     => ['results_published_at'],
    'inbox_messages'   => ['handled_at', 'replied_at'],
    'ministry_replies' => ['replied_at'],
    'mail_events'      => ['handled_at'],
] as $t => $cols) {
    foreach ($cols as $c) {
        try { $info = all("PRAGMA table_info(\"$t\")"); } catch (\Throwable $e) { continue; }
        foreach ($info as $h) if ((string) $h['name'] === $c) $targets[$t][] = $c;
    }
}

echo "ЗАПИСИ СО ВРЕМЕНЕМ ИЗ БУДУЩЕГО\n$line\n";
$now = date('Y-m-d H:i:s', time() + 120);   // две минуты запаса на разбег часов
$found = [];
$total = 0;
foreach ($targets as $t => $cols) {
    foreach (array_unique($cols) as $c) {
        if (in_array("$t.$c", $SKIP, true)) continue;
        try {
            $n = (int) (scalar("SELECT COUNT(*) FROM \"$t\" WHERE \"$c\" > ? AND \"$c\" LIKE '____-__-__ __:__%'", [$now]) ?? 0);
        } catch (\Throwable $e) { continue; }
        if ($n === 0) continue;
        $mx = (string) scalar("SELECT MAX(\"$c\") FROM \"$t\"");
        printf("  %-20s %-22s %5d  до %s\n", $t, $c, $n, $mx);
        $found[] = [$t, $c];
        $total += $n;
    }
}
if (!$total) { echo "  таких записей нет\n"; exit(0); }
printf("  ВСЕГО: %d\n", $total);

if (!$apply) { echo "\nничего не меняли — запустите с --apply\n"; exit(0); }

echo "\nВОЗВРАЩАЕМ НАЗАД НА $HOURS Ч.\n$line\n";
$done = 0;
db()->beginTransaction();
try {
    foreach ($found as [$t, $c]) {
        q("UPDATE \"$t\" SET \"$c\" = datetime(\"$c\", '-$HOURS hours')
            WHERE \"$c\" > ? AND \"$c\" LIKE '____-__-__ __:__%'", [$now]);
        $n = (int) db()->query("SELECT changes()")->fetchColumn();
        if ($n > 0) { printf("  %-20s %-22s %5d\n", $t, $c, $n); $done += $n; }
    }
    db()->commit();
} catch (\Throwable $e) {
    db()->rollBack();
    echo "  ОТКАТ: " . $e->getMessage() . "\n";
    exit(1);
}
printf("\nисправлено значений: %d\n", $done);
