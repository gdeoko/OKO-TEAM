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

/**
 * Обрезает полностью прозрачные поля.
 *
 * Печать и подпись нарисованы по центру квадратного холста, и вокруг них до
 * трети картинки пустоты. Если вставлять такую картинку в бланк, видимый штрих
 * получается втрое мельче отведённого места, а при попытке растянуть его до
 * нужного размера ломаются пропорции — подпись выглядит «кривой». Обрезаем
 * пустоту один раз здесь, и дальше картинка занимает ровно то, что ей отвели.
 */
function trim_alpha($im) {
    $w = imagesx($im); $h = imagesy($im);
    $x1 = $w; $y1 = $h; $x2 = -1; $y2 = -1;
    for ($y = 0; $y < $h; $y++) {
        for ($x = 0; $x < $w; $x++) {
            if (((imagecolorat($im, $x, $y) >> 24) & 0x7F) >= 118) continue;   // почти прозрачно
            if ($x < $x1) $x1 = $x;
            if ($x > $x2) $x2 = $x;
            if ($y < $y1) $y1 = $y;
            if ($y > $y2) $y2 = $y;
        }
    }
    if ($x2 < 0) return $im;                                   // картинка пустая — не трогаем
    $pad = 2;
    $x1 = max(0, $x1 - $pad); $y1 = max(0, $y1 - $pad);
    $x2 = min($w - 1, $x2 + $pad); $y2 = min($h - 1, $y2 + $pad);
    $nw = $x2 - $x1 + 1; $nh = $y2 - $y1 + 1;
    if ($nw === $w && $nh === $h) return $im;

    $o = imagecreatetruecolor($nw, $nh);
    imagealphablending($o, false); imagesavealpha($o, true);
    imagefill($o, 0, 0, imagecolorallocatealpha($o, 0, 0, 0, 127));
    imagecopy($o, $im, 0, 0, $x1, $y1, $nw, $nh);
    imagedestroy($im);
    return $o;
}

$total = 0;
foreach ($jobs as [$in, $out, $max]) {
    $p = $src . '/' . $in;
    if (!is_file($p)) { echo "  нет исходника: $in\n"; continue; }

    $im = @imagecreatefrompng($p);
    if (!$im) { echo "  не открылся: $in\n"; continue; }

    $im = trim_alpha($im);
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
