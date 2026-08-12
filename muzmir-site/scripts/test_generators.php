<?php
/** Прогон всех генераторов на первом конкурсе + фейковой заявке. */
declare(strict_types=1);
define('BASE_PATH', dirname(__DIR__));
$GLOBALS['CFG'] = require BASE_PATH . '/config.php';
require_once BASE_PATH . '/core/db.php';
require_once BASE_PATH . '/core/helpers.php';
require_once BASE_PATH . '/core/qr.php';
require_once BASE_PATH . '/core/pdf_regulation.php';
require_once BASE_PATH . '/core/pdf_diploma.php';
require_once BASE_PATH . '/core/poster.php';

function chk(string $label, string $path): void {
    if ($path && is_file($path)) {
        printf("  [OK]   %-22s -> %s (%.1f КБ)\n", $label, $path, filesize($path) / 1024);
    } else {
        printf("  [FAIL] %-22s -> %s\n", $label, $path ?: '(пусто)');
    }
}

$comp = one("SELECT * FROM competitions ORDER BY sort LIMIT 1");
printf("Конкурс: «%s» (slug=%s)\n\n", $comp['name'], $comp['slug']);

echo "1) QR\n";
$svg = qr_svg(cfgv('base_url') . '/verify/SZ-2026-000123');
printf("  [%s] qr_svg -> %d байт\n", $svg ? 'OK' : 'FAIL', strlen($svg));
$qp = sys_get_temp_dir() . '/_test_qr.png';
qr_png(cfgv('base_url') . '/verify/SZ-2026-000123', $qp);
chk('qr_png', $qp);

echo "\n2) Положение\n";
chk('pdf_regulation', pdf_regulation($comp));

echo "\n3) Дипломы\n";
$app = [
    'number' => 'SZ-2026-004242', 'full_name' => 'Соколова Анастасия Дмитриевна',
    'age_category' => '13-15 лет', 'nomination' => 'Вокальное искусство',
    'subgroup' => 'Эстрадный вокал', 'teacher' => 'Иванова Мария Петровна',
    'institution' => 'ДШИ №3', 'city' => 'Москва', 'result' => 'ЛАУРЕАТ 1 степени',
    'score' => 8.4, 'competition_id' => $comp['id'],
];
foreach (['main', 'named', 'extra', 'thanks'] as $t) {
    chk("pdf_diploma [$t]", pdf_diploma($app, $t));
}

echo "\n4) Афиши\n";
foreach (['open', '5days', '3days', 'lastday', 'results'] as $t) {
    chk("poster [$t 1x1]", poster_generate($comp, $t, '1x1'));
}
foreach (['16x9', '9x16'] as $f) {
    chk("poster [open $f]", poster_generate($comp, 'open', $f));
}
echo "\n=== Готово ===\n";
