<?php
/**
 * СВЕРКА БОЕВОЙ БАЗЫ С НОЧНЫМ СРЕЗОМ.
 *
 * После того как проверка админки обнулила часть полей у конкурса, недостаточно
 * починить один конкурс: надо убедиться, что больше нигде ничего не пропало.
 * Скрипт сравнивает справочные таблицы (конкурсы, настройки, страницы, блоки) с
 * резервной копией и показывает, где значение БЫЛО, а стало пустым. Растущие
 * данные (заявки, письма, участники) не сравниваются — там расхождения нормальны.
 *
 *   php scripts/diff_backup.php                      — с последним ночным срезом
 *   php scripts/diff_backup.php data/backups/x.sqlite
 */
declare(strict_types=1);
if (PHP_SAPI !== 'cli') { fwrite(STDERR, "CLI only\n"); exit(1); }

define('BASE_PATH', dirname(__DIR__));
$GLOBALS['CFG'] = require BASE_PATH . '/config.php';
require_once BASE_PATH . '/core/db.php';
require_once BASE_PATH . '/core/helpers.php';

$line = str_repeat('=', 78);

/* Какой срез берём. */
$path = $argv[1] ?? '';
if ($path === '') {
    $files = glob(BASE_PATH . '/data/backups/muzmir_*.sqlite') ?: [];
    sort($files);
    $path = $files ? end($files) : '';
}
if ($path === '' || !is_file($path)) { echo "не найден срез базы для сравнения\n"; exit(1); }
echo "СВЕРКА С " . basename($path) . "\n$line\n";

$old = new PDO('sqlite:' . $path, null, null, [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION]);

/**
 * Таблицы-справочники: их содержимое задаётся руками и потерять его нельзя.
 * Ключ — по чему сопоставлять строки.
 */
$tables = ['competitions' => 'id', 'settings' => 'key', 'pages' => 'id', 'blocks' => 'id'];

$lost = 0; $changed = 0;
foreach ($tables as $t => $key) {
    try { $oldRows = $old->query("SELECT * FROM $t")->fetchAll(PDO::FETCH_ASSOC); }
    catch (\Throwable $e) { continue; }
    if (!$oldRows) continue;

    try { $newRows = all("SELECT * FROM $t"); } catch (\Throwable $e) { continue; }
    $newBy = [];
    foreach ($newRows as $r) $newBy[(string) ($r[$key] ?? '')] = $r;

    $head = false;
    foreach ($oldRows as $o) {
        $k = (string) ($o[$key] ?? '');
        $n = $newBy[$k] ?? null;
        if ($n === null) {
            if (!$head) { echo "\n$t\n" . str_repeat('-', 78) . "\n"; $head = true; }
            printf("  ✗ строка %s пропала целиком\n", $k);
            $lost++;
            continue;
        }
        foreach ($o as $col => $wasRaw) {
            if (!array_key_exists($col, $n)) continue;
            $was = trim((string) $wasRaw);
            $now = trim((string) $n[$col]);
            if ($was === $now) continue;
            // Пустое вместо заполненного — почти всегда потеря.
            $isLoss = $was !== '' && $now === '';
            if (!$head) { echo "\n$t\n" . str_repeat('-', 78) . "\n"; $head = true; }
            printf("  %s %-10s %-18s было «%s» стало «%s»\n",
                $isLoss ? '✗' : '·', $k, $col,
                mb_substr($was, 0, 26), mb_substr($now, 0, 26));
            $isLoss ? $lost++ : $changed++;
        }
    }
}

echo "\n$line\n";
printf("потерь: %d, прочих отличий: %d\n", $lost, $changed);
echo $lost === 0
    ? "Ничего не пропало.\n"
    : "Есть поля, которые были заполнены, а стали пустыми — смотрите строки со знаком ✗.\n";
