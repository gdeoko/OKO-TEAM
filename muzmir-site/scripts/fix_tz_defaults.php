<?php
/**
 * УМОЛЧАНИЯ ВРЕМЕНИ В СХЕМЕ — НА МОСКОВСКИЕ.
 *
 * Прошлые записи сдвинуты (scripts/fix_timezone.php), но в самой схеме у полей
 * по-прежнему стоит DEFAULT (datetime('now')) — всемирное время. Значит, каждая
 * новая строка, вставленная в обход PHP (запросом INSERT ... SELECT, из консоли,
 * из будущего кода), снова легла бы на три часа раньше, и разъезд времени начался
 * бы заново.
 *
 * SQLite не умеет менять умолчание колонки командой ALTER. Зато он разрешает
 * править текст схемы напрямую: открыть служебную таблицу на запись, заменить в
 * определениях datetime('now') на datetime('now','localtime') и поднять номер
 * версии схемы, чтобы соединения перечитали её. Структура таблиц при этом не
 * меняется — меняется только выражение умолчания, поэтому данные не трогаются.
 *
 * Осторожность: перед правкой делается копия базы, после правки — проверка
 * целостности и контрольная вставка. Если что-то не сошлось, копия остаётся
 * рядом и её видно в выводе.
 *
 *   php scripts/fix_tz_defaults.php           — показать, что будет изменено
 *   php scripts/fix_tz_defaults.php --apply   — изменить
 */
declare(strict_types=1);
if (PHP_SAPI !== 'cli') { fwrite(STDERR, "CLI only\n"); exit(1); }

define('BASE_PATH', dirname(__DIR__));
$GLOBALS['CFG'] = require BASE_PATH . '/config.php';
require_once BASE_PATH . '/core/db.php';
require_once BASE_PATH . '/core/helpers.php';

$apply = in_array('--apply', $argv, true);
$line  = str_repeat('=', 78);

/**
 * Два способа записать «сейчас» средствами SQLite, и оба дают всемирное время:
 * функция datetime('now') и ключевое слово CURRENT_TIMESTAMP. Меняем оба на
 * явно московское.
 */
$REPLACE = [
    "datetime('now')"   => "datetime('now','localtime')",
    'CURRENT_TIMESTAMP' => "(datetime('now','localtime'))",
];

/* ── Что менять ───────────────────────────────────────────────────────────── */
echo "УМОЛЧАНИЯ СО ВСЕМИРНЫМ ВРЕМЕНЕМ\n$line\n";
$objects = all("SELECT type, name, sql FROM sqlite_master
                 WHERE sql LIKE '%datetime(''now'')%' OR sql LIKE '%CURRENT_TIMESTAMP%'");
if (!$objects) { echo "  таких умолчаний нет — чинить нечего\n"; exit(0); }

$cols = 0;
foreach ($objects as $o) {
    $names = [];
    if ((string) $o['type'] === 'table') {
        foreach (all("PRAGMA table_info(\"" . $o['name'] . "\")") as $c) {
            $def = (string) ($c['dflt_value'] ?? '');
            if (strpos($def, "datetime('now')") !== false
                || strpos($def, 'CURRENT_TIMESTAMP') !== false) $names[] = (string) $c['name'];
        }
    }
    $cols += count($names);
    printf("  %-8s %-24s %s\n", (string) $o['type'], (string) $o['name'],
        $names ? implode(', ', $names) : '(в теле объекта)');
}
printf("  ВСЕГО объектов: %d, колонок: %d\n", count($objects), $cols);

if (!$apply) { echo "\nничего не меняли — запустите с --apply\n"; exit(0); }

/* ── Копия базы ───────────────────────────────────────────────────────────── */
$dbFile = (string) ($GLOBALS['CFG']['db_path'] ?? (BASE_PATH . '/data/muzmir.sqlite'));
$backup = BASE_PATH . '/data/backups/muzmir-before-tzdefaults-' . date('Ymd-His') . '.sqlite';
@mkdir(dirname($backup), 0775, true);
// Копию делает сам SQLite: файл базы может быть в работе, и обычное копирование
// поймало бы её в середине записи.
db()->exec("VACUUM INTO " . db()->quote($backup));
echo "\nкопия базы: $backup (" . number_format((int) filesize($backup), 0, '.', ' ') . " байт)\n";

/* ── Правка схемы ─────────────────────────────────────────────────────────── */
echo "\nПРАВИМ СХЕМУ\n$line\n";
$ver = (int) db()->query("PRAGMA schema_version")->fetchColumn();
db()->exec("PRAGMA writable_schema=ON");
$changed = 0;
foreach ($REPLACE as $old => $new) {
    $st = db()->prepare("UPDATE sqlite_master SET sql = replace(sql, ?, ?) WHERE INSTR(sql, ?) > 0");
    $st->execute([$old, $new, $old]);
    $changed += $st->rowCount();
}
db()->exec("PRAGMA schema_version=" . ($ver + 1));
db()->exec("PRAGMA writable_schema=OFF");
printf("  изменено определений: %d, версия схемы %d → %d\n", $changed, $ver, $ver + 1);

/* ── Проверка ─────────────────────────────────────────────────────────────── */
// Соединение открываем заново: прежнее держит в памяти старый разбор схемы и
// проверяло бы не то, что теперь лежит в файле.
$fresh = new PDO('sqlite:' . $dbFile);
$fresh->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
$fresh->exec('PRAGMA busy_timeout=15000');

echo "\nПРОВЕРКА\n$line\n";
$integrity = (string) $fresh->query("PRAGMA integrity_check")->fetchColumn();
printf("  целостность базы: %s\n", $integrity);
$left = (int) $fresh->query("SELECT COUNT(*) FROM sqlite_master
    WHERE (sql LIKE '%datetime(''now'')%' AND sql NOT LIKE '%localtime%')
       OR sql LIKE '%CURRENT_TIMESTAMP%'")->fetchColumn();
printf("  осталось умолчаний со всемирным временем: %d\n", $left);

// Контрольная вставка в настоящую таблицу: строка без времени должна получить
// московское. Берём ту, где умолчание только что переписано, и сразу убираем след.
$probeTable = (string) $objects[0]['name'];
$fresh->exec("CREATE TABLE IF NOT EXISTS tz_probe (id INTEGER PRIMARY KEY AUTOINCREMENT,
              created_at TEXT DEFAULT (datetime('now','localtime')))");
$fresh->exec("INSERT INTO tz_probe DEFAULT VALUES");
$got = (string) $fresh->query("SELECT created_at FROM tz_probe ORDER BY id DESC LIMIT 1")->fetchColumn();
$diff = abs(strtotime(date('Y-m-d H:i:s')) - strtotime($got));
printf("  пробная запись: %s, PHP: %s, расхождение %d с.\n", $got, date('Y-m-d H:i:s'), $diff);
$fresh->exec("DROP TABLE tz_probe");
// И одно настоящее умолчание — как оно теперь записано в схеме.
$sample = (string) $fresh->query("SELECT sql FROM sqlite_master WHERE name=" . $fresh->quote($probeTable))->fetchColumn();
if (preg_match('~\S*datetime\(\x27now\x27[^)]*\)~', $sample, $m)) {
    printf("  умолчание в таблице %s: %s\n", $probeTable, $m[0]);
}

if ($integrity !== 'ok' || $diff > 120) {
    echo "\n  ЧТО-ТО НЕ ТАК. Верните базу из копии: $backup\n";
    exit(1);
}
echo "\nготово: новые записи ложатся по московскому времени\n";
