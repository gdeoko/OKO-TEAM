<?php
/**
 * ОБЛЕГЧЁННЫЕ КАРТИНКИ ДЛЯ ОФИЦИАЛЬНОГО БЛАНКА.
 *
 * Исходные гербы, печать и логотип рисовались под печать дипломов и весят от
 * четверти мегабайта до шести. На бланке они занимают полтора сантиметра, и
 * тащить в письмо оригиналы бессмысленно: документ раздувается до двух с лишним
 * мегабайт, а почтовые службы такое письмо обрезают — адресат не видит ни
 * подписи, ни печати, они как раз в самом низу.
 *
 * Скрипт делает уменьшенные копии в public/assets/img/letter/. Прозрачность PNG
 * сохраняется: печать и подпись накладываются поверх текста.
 *
 * Запуск: php scripts/make_letter_assets.php
 * Повторный запуск безопасен — файлы просто перезаписываются.
 */
declare(strict_types=1);
if (PHP_SAPI !== 'cli') { fwrite(STDERR, "CLI only\n"); exit(1); }

define('BASE_PATH', dirname(__DIR__));

$src = BASE_PATH . '/public/assets/img';
$dst = $src . '/letter';
if (!is_dir($dst) && !@mkdir($dst, 0775, true)) {
    fwrite(STDERR, "Не удалось создать $dst\n");
    exit(1);
}

// [источник, имя копии, размер по большей стороне в пикселях]
// Печать крупнее прочего намеренно: она накладывается на подпись и должна
// оставаться разборчивой при печати документа на бумаге.
$jobs = [
    ['logo_muzmir_256.png',          'logo.png',         200],
    ['diploma/seal.png',             'seal.png',         360],
    ['diploma/sig2.png',             'sig.png',          300],
    ['diploma/logo_prokultura.png',  'e_prok.png',       180],
    ['diploma/logo_minkult.png',     'e_minkult.png',    180],
    ['diploma/logo_minprosvet.png',  'e_minprosvet.png', 180],
    ['diploma/logo_rossia.png',      'e_rossia.png',     180],
    ['diploma/logo_natsproekty.png', 'e_nats.png',       180],
];

$total = 0;
foreach ($jobs as [$in, $out, $max]) {
    $p = $src . '/' . $in;
    if (!is_file($p)) { echo "  нет исходника: $in\n"; continue; }

    $im = @imagecreatefrompng($p);
    if (!$im) { echo "  не открылся: $in\n"; continue; }

    $w = imagesx($im); $h = imagesy($im);
    $k = $max / max($w, $h);
    if ($k > 1) $k = 1.0;                       // мельче исходника не увеличиваем
    $nw = max(1, (int) round($w * $k));
    $nh = max(1, (int) round($h * $k));

    $o = imagecreatetruecolor($nw, $nh);
    imagealphablending($o, false);
    imagesavealpha($o, true);
    imagefill($o, 0, 0, imagecolorallocatealpha($o, 0, 0, 0, 127));
    imagecopyresampled($o, $im, 0, 0, 0, 0, $nw, $nh, $w, $h);
    imagepng($o, $dst . '/' . $out, 9);
    imagedestroy($im); imagedestroy($o);

    $sz = (int) filesize($dst . '/' . $out);
    $total += $sz;
    printf("  %-20s %6d КБ -> %5d КБ  (%dx%d)\n", $out, (int) (filesize($p) / 1024), (int) ($sz / 1024), $nw, $nh);
}

printf("\nитого: %d КБ\n", (int) ($total / 1024));
