<?php
/**
 * КВАДРАТНЫЕ ПРЕВЬЮ ОБРАЗЦОВ НАГРАД ДЛЯ ПИСЕМ.
 *
 * В письме образцы стоят одной строкой. Снимки же разные по пропорциям: кубок
 * горизонтальный, дипломы и благодарность вертикальные. В ряду из-за этого
 * карточки выходили разной высоты, и витрина выглядела как сломанная вёрстка.
 *
 * Здесь каждый снимок из mail/ обрезается по центру в квадрат 360×360 и
 * кладётся в mail/sq/. Ряд из таких превью ровный при любом наборе позиций.
 * Запускать после того, как обновились снимки наград (scripts/award_previews.php).
 *
 *   php scripts/award_squares.php
 */
declare(strict_types=1);
if (PHP_SAPI !== 'cli') { fwrite(STDERR, "CLI only\n"); exit(1); }

const AW_SQ = 360;

$made = 0;
foreach (glob(dirname(__DIR__) . '/public/assets/img/awards/*/mail', GLOB_ONLYDIR) ?: [] as $dir) {
    $out = $dir . '/sq';
    if (!is_dir($out) && !@mkdir($out, 0775, true)) { fwrite(STDERR, "нет папки $out\n"); continue; }
    foreach (glob($dir . '/*.jpg') ?: [] as $f) {
        $src = @imagecreatefromjpeg($f);
        if (!$src) { fwrite(STDERR, "не открылся: $f\n"); continue; }
        $w = imagesx($src); $h = imagesy($src); $s = min($w, $h);
        $dst = imagecreatetruecolor(AW_SQ, AW_SQ);
        imagecopyresampled($dst, $src, 0, 0, (int) (($w - $s) / 2), (int) (($h - $s) / 2),
                           AW_SQ, AW_SQ, $s, $s);
        imagejpeg($dst, $out . '/' . basename($f), 86);
        imagedestroy($src); imagedestroy($dst);
        $made++;
    }
    echo $out . ': ' . count(glob($out . '/*.jpg') ?: []) . " шт\n";
}
echo "готово: $made превью\n";
