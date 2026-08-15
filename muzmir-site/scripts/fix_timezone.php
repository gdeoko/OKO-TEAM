<?php
/**
 * ВРЕМЯ ВЕЗДЕ ПО МОСКВЕ.
 *
 * Сайт живёт по Москве: PHP настроен на Europe/Moscow, сервер тоже. А SQLite
 * функция datetime('now') отдаёт ВСЕМИРНОЕ время, без часового пояса. Ровно она
 * стоит умолчанием у полей created_at почти во всех таблицах. Получилось, что
 * время подачи заявки сохранялось на три часа раньше настоящего, а время
 * отправки письма (его пишет PHP) — правильно. В админке и в кабинете рядом
 * стояли два времени одного события с разницей в три часа, и понять, когда
 * человек подал заявку, было нельзя.
 *
 * Скрипт сдвигает на +3 часа те колонки, которые заполнялись средствами SQLite,
 * и не трогает те, что писал PHP. Список колонок — ниже, он составлен по схеме
 * (DEFAULT datetime('now')) и по местам, где SQL сам проставляет время.
 *
 *   php scripts/fix_timezone.php           — показать, что будет сделано
 *   php scripts/fix_timezone.php --apply   — сделать
 *
 * Повторный запуск безопасен: отметка о выполненном сдвиге хранится в настройках,
 * и второй раз время не поедет.
 */
declare(strict_types=1);
if (PHP_SAPI !== 'cli') { fwrite(STDERR, "CLI only\n"); exit(1); }

define('BASE_PATH', dirname(__DIR__));
$GLOBALS['CFG'] = require BASE_PATH . '/config.php';
require_once BASE_PATH . '/core/db.php';
require_once BASE_PATH . '/core/helpers.php';

$apply = in_array('--apply', $argv, true);
$line  = str_repeat('=', 78);

/* Разница между тем, что пишет SQLite, и московским временем. Считаем, а не
   задаём числом: перевод часов или смена пояса сервера не должны ломать разбор. */
$sqliteNow = (string) scalar("SELECT datetime('now')");
$phpNow    = date('Y-m-d H:i:s');
$diffHours = (int) round((strtotime($phpNow) - strtotime($sqliteNow)) / 3600);

echo "ЧАСОВОЙ ПОЯС\n$line\n";
printf("  PHP (Москва):   %s\n  SQLite:         %s\n  разница:        %+d ч.\n",
    $phpNow, $sqliteNow, $diffHours);

if ((string) setting('tz_fixed_at', '') !== '') {
    echo "\n  сдвиг уже выполнялся " . setting('tz_fixed_at', '') . " — повторно не трогаем\n";
    if (!$apply) exit(0);
    echo "  (для повторного прогона снимите настройку tz_fixed_at)\n";
    exit(0);
}
if ($diffHours === 0) { echo "\n  расхождения нет, чинить нечего\n"; exit(0); }

/**
 * КОЛОНКИ, КОТОРЫЕ ЗАПОЛНЯЛ SQLITE.
 *
 * Берём из самой схемы: у них в определении стоит DEFAULT (datetime('now')).
 * Так список не разъедется с базой, если появятся новые таблицы.
 */
$targets = [];
foreach (all("SELECT name, sql FROM sqlite_master WHERE type='table'") as $t) {
    $sql = (string) $t['sql'];
    if (mb_strpos($sql, "datetime('now')") === false) continue;
    foreach (all("PRAGMA table_info(\"" . $t['name'] . "\")") as $c) {
        $col = (string) $c['name'];
        $def = (string) ($c['dflt_value'] ?? '');
        if (mb_strpos($def, "datetime('now')") !== false) $targets[(string) $t['name']][] = $col;
    }
}
// Колонки, которым время проставляет SQL в запросах (не умолчанием).
$byQuery = [
    'institutions'     => ['updated_at'],
    'competitions'     => ['results_published_at'],
    'inbox_messages'   => ['handled_at', 'replied_at'],
    'ministry_replies' => ['replied_at'],
    'club_members'     => ['next_charge_at'],
    'mail_events'      => ['handled_at'],
];
foreach ($byQuery as $t => $cols) {
    foreach ($cols as $c) {
        try { $has = all("PRAGMA table_info(\"$t\")"); } catch (\Throwable $e) { continue; }
        foreach ($has as $h) if ((string) $h['name'] === $c) $targets[$t][] = $c;
    }
}

echo "\nЧТО СДВИГАЕМ\n$line\n";
$total = 0;
foreach ($targets as $t => $cols) {
    $targets[$t] = array_values(array_unique($cols));
    foreach ($targets[$t] as $c) {
        try {
            $n = (int) (scalar("SELECT COUNT(*) FROM \"$t\" WHERE TRIM(COALESCE(\"$c\",''))<>''") ?? 0);
        } catch (\Throwable $e) { continue; }
        if ($n === 0) continue;
        $total += $n;
        $mn = (string) scalar("SELECT MIN(\"$c\") FROM \"$t\" WHERE TRIM(COALESCE(\"$c\",''))<>''");
        $mx = (string) scalar("SELECT MAX(\"$c\") FROM \"$t\" WHERE TRIM(COALESCE(\"$c\",''))<>''");
        printf("  %-20s %-22s %6d  с %s по %s\n", $t, $c, $n, substr($mn, 0, 16), substr($mx, 0, 16));
    }
}
printf("  ВСЕГО значений: %d\n", $total);

if (!$apply) { echo "\nничего не меняли — запустите с --apply\n"; exit(0); }

/* ── Сдвиг ────────────────────────────────────────────────────────────────── */
echo "\nСДВИГАЕМ\n$line\n";
$mod = ($diffHours > 0 ? '+' : '') . $diffHours . ' hours';
$done = 0;
db()->beginTransaction();
try {
    foreach ($targets as $t => $cols) {
        foreach ($cols as $c) {
            // Двигаем только то, что похоже на дату-время: строки вида
            // «ГГГГ-ММ-ДД ЧЧ:ММ». Чистые даты без времени не трогаем — сдвиг
            // превратил бы их в другой день.
            $sql = "UPDATE \"$t\" SET \"$c\" = datetime(\"$c\", '$mod')
                     WHERE \"$c\" LIKE '____-__-__ __:__%'";
            try { q($sql); $n = (int) db()->query("SELECT changes()")->fetchColumn(); }
            catch (\Throwable $e) { echo "  $t.$c: " . $e->getMessage() . "\n"; continue; }
            if ($n > 0) { printf("  %-20s %-22s %6d\n", $t, $c, $n); $done += $n; }
        }
    }
    set_setting('tz_fixed_at', date('Y-m-d H:i:s'));
    db()->commit();
} catch (\Throwable $e) {
    db()->rollBack();
    echo "  ОТКАТ: " . $e->getMessage() . "\n";
    exit(1);
}
printf("\nсдвинуто значений: %d\n", $done);
echo "отметка о выполнении записана, повторный запуск ничего не тронет\n";
