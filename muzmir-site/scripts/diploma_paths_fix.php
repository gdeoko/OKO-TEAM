<?php
/**
 * ПУТЬ К БЛАНКУ В РЕЕСТРЕ ХРАНИТСЯ ОТ public, А НЕ ОТ КОРНЯ ДИСКА.
 *
 *   php scripts/diploma_paths_fix.php [--dry]
 *
 * Админка и кабинет строят ссылку на файл как BASE_PATH.'/public/'.pdf_path.
 * У 59 дипломов в pdf_path лежал абсолютный путь (/var/www/muzmir/public/...):
 * ссылка складывалась в /public//var/www/... и «файл» в админке не открывался,
 * хотя сам бланк лежал на месте. Нормализация той же меркой, что и у записи
 * (diploma_store_path): файл не трогаем, правим только строку в реестре.
 */
declare(strict_types=1);
if (PHP_SAPI !== 'cli') { fwrite(STDERR, "CLI only\n"); exit(1); }
define('BASE_PATH', dirname(__DIR__));
$GLOBALS['CFG'] = require BASE_PATH . '/config.php';
require_once BASE_PATH . '/core/db.php';
require_once BASE_PATH . '/core/helpers.php';
require_once BASE_PATH . '/core/diploma_render.php';

$dry  = in_array('--dry', $argv, true);
$root = rtrim(BASE_PATH . '/public', '/');
$fix = 0; $skip = 0; $gone = 0;
foreach (all("SELECT id, number, pdf_path FROM diplomas WHERE pdf_path <> ''") as $d) {
    $p = trim((string) $d['pdf_path']);
    if ($p === '' || str_starts_with($p, 'http') || !str_starts_with($p, '/var') && !str_starts_with($p, '/home') && !str_starts_with($p, '/opt')) { continue; }
    $new = diploma_store_path($p);
    if ($new === $p) { $skip++; echo "  [мимо] {$d['number']}: путь не внутри public — {$p}\n"; continue; }
    if (!is_file($root . $new)) { $gone++; echo "  [нет файла] {$d['number']}: {$new}\n"; }
    echo "  {$d['number']}: {$p}\n          -> {$new}\n";
    if (!$dry) update('diplomas', ['pdf_path' => $new], 'id=:id', ['id' => (int) $d['id']]);
    $fix++;
}
echo "Исправлено: $fix" . ($dry ? ' (сухой прогон)' : '') . ", вне public: $skip, без файла на диске: $gone\n";
