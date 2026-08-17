<?php
/**
 * ПРИВЕСТИ В ПОРЯДОК СТРАНУ И ГОРОД ВО ВСЕЙ БАЗЕ.
 *
 * Справочник знал только ближнее зарубежье, поэтому всё незнакомое молча
 * получало российское гражданство: участник из Дубая записан как «Россия,
 * г. Дубай», а тот, кто написал «Беларусь Гомель» до починки разбора, — как
 * «Россия, г. Беларусь Гомель». Отдельно копился мусор: регион вместо города
 * («г. Краснодарский Край») и двойная приставка («г. Р.п. Нахабино»).
 *
 * Здесь каждая сохранённая запись прогоняется через исправленный разбор
 * (city_normalize) и переписывается, если результат отличается. Разбор
 * идемпотентен: правильное значение остаётся собой.
 *
 * Ничего не выдумывает: если город распознать не удалось, значение остаётся
 * прежним — лучше оставить как есть, чем стереть данные участника.
 *
 *   php scripts/fix_city_country.php --dry   — показать, что изменится
 *   php scripts/fix_city_country.php         — исправить
 */
declare(strict_types=1);
if (PHP_SAPI !== 'cli') { fwrite(STDERR, "CLI only\n"); exit(1); }

define('BASE_PATH', dirname(__DIR__));
$GLOBALS['CFG'] = require BASE_PATH . '/config.php';
require_once BASE_PATH . '/core/db.php';
require_once BASE_PATH . '/core/helpers.php';
require_once BASE_PATH . '/core/text_format.php';

$dry  = in_array('--dry', $argv, true);
$line = str_repeat('=', 78);

/**
 * Где хранится населённый пункт УЧАСТНИКА — то есть то, что видит человек и что
 * печатается в дипломе.
 *
 * Справочник учреждений сюда намеренно не входит: там город лежит голым именем
 * («Москва», «Верхняя Синячиха») и в таком виде используется для поиска
 * сообществ и для писем. Приписать ему «Россия, г.» значило бы сломать поиск
 * ради красоты в поле, которого никто не видит.
 */
const CITY_FIELDS = [
    ['applications', 'city'],
    ['users',        'city'],
];

echo "СТРАНА И ГОРОД ПО ВСЕЙ БАЗЕ\n$line\n";

$totalSeen = $totalFix = 0;
$samples = [];

foreach (CITY_FIELDS as [$table, $col]) {
    if (function_exists('tbl_exists') && !tbl_exists($table)) continue;
    try {
        $rows = all("SELECT id, $col AS v FROM $table WHERE TRIM(COALESCE($col,'')) <> ''");
    } catch (\Throwable $e) { echo "  $table: пропуск ({$e->getMessage()})\n"; continue; }

    $fix = 0;
    foreach ($rows as $r) {
        $old = (string) $r['v'];
        $new = city_normalize($old);
        if ($new === '' || $new === $old) continue;
        $fix++;
        if (count($samples) < 20) $samples[] = [$table, $old, $new];
        if (!$dry) {
            try { q("UPDATE $table SET $col = :v WHERE id = :id", ['v' => $new, 'id' => (int) $r['id']]); }
            catch (\Throwable $e) { $fix--; }
        }
    }
    printf("  %-14s записей %-6d %s %d\n", $table, count($rows), $dry ? 'изменилось бы' : 'исправлено', $fix);
    $totalSeen += count($rows);
    $totalFix  += $fix;
}

if ($samples) {
    echo "\nПРИМЕРЫ\n$line\n";
    foreach ($samples as [$t, $o, $n]) printf("  %-14s %-34s → %s\n", $t, mb_substr($o, 0, 34), $n);
}

printf("\n%s\n  просмотрено %s, %s %s\n", $line,
    number_format($totalSeen, 0, '.', ' '),
    $dry ? 'изменилось бы' : 'исправлено',
    number_format($totalFix, 0, '.', ' '));

if ($dry) echo "  сухой прогон: ничего не изменено\n";
