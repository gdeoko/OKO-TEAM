<?php
/**
 * ПРЕВЬЮ ФОТОГРАФИЙ НАГРАД ДЛЯ ПИСЕМ.
 *
 * Снимки кубков, статуэток и медалей лежат в public/assets/img/awards/<конкурс>/
 * в исходном качестве — по два мегабайта каждый. Для сайта это нормально, для
 * письма нет: почтовые клиенты грузят такие картинки долго, на телефоне через
 * мобильный интернет человек увидит серые прямоугольники и закроет письмо.
 *
 * Здесь из каждого снимка делается версия шириной 560 точек — столько занимает
 * колонка письма на любом экране. Вес падает примерно в тридцать раз, вид не
 * страдает: письмо открывается сразу, награда видна.
 *
 * Запускать после замены фотографий наград:
 *   php scripts/award_previews.php
 */
declare(strict_types=1);
if (PHP_SAPI !== 'cli') { fwrite(STDERR, "CLI only\n"); exit(1); }

define('BASE_PATH', dirname(__DIR__));

// Снимки наград сняты в высоком разрешении: распакованный кадр занимает сотни
// мегабайт, и на обычном лимите PHP просто падает без объяснений. Поднимаем
// лимит для этого скрипта и держим наготове ffmpeg — он ужимает потоком, не
// разворачивая картинку в память целиком.
ini_set('memory_limit', '768M');

const AW_WIDTH   = 560;
const AW_QUALITY = 82;

$root = BASE_PATH . '/public/assets/img/awards';
if (!is_dir($root)) { fwrite(STDERR, "нет папки с фотографиями наград\n"); exit(1); }

$made = $skipped = $failed = 0;
foreach (glob($root . '/*', GLOB_ONLYDIR) ?: [] as $dir) {
    $out = $dir . '/mail';
    if (!is_dir($out)) @mkdir($out, 0775, true);

    foreach (glob($dir . '/*.jpg') ?: [] as $src) {
        $name = basename($src);
        $dst  = $out . '/' . $name;
        // Уже сделано и не устарело — не тратим время.
        if (is_file($dst) && filemtime($dst) >= filemtime($src)) { $skipped++; continue; }

        $img = @imagecreatefromjpeg($src);
        if (!$img) {
            // Не хватило памяти или битый файл — пробуем ffmpeg.
            @exec('ffmpeg -y -v error -i ' . escapeshellarg($src)
                . ' -vf scale=' . AW_WIDTH . ':-2 -q:v 4 ' . escapeshellarg($dst) . ' 2>&1', $o, $rc);
            if ($rc === 0 && is_file($dst)) {
                printf("  %-28s %6d КБ → %4d КБ (ffmpeg)\n", basename($dir) . '/' . $name,
                    (int) round(filesize($src) / 1024), (int) round(filesize($dst) / 1024));
                $made++;
            } else {
                $failed++;
            }
            continue;
        }
        $w = imagesx($img); $h = imagesy($img);
        if ($w <= 0 || $h <= 0) { imagedestroy($img); $failed++; continue; }

        $nw = min(AW_WIDTH, $w);
        $nh = (int) round($h * $nw / $w);
        $thumb = imagecreatetruecolor($nw, $nh);
        // Белая подложка: у части снимков прозрачные края, на тёмной теме почты
        // они дали бы грязный контур.
        imagefill($thumb, 0, 0, imagecolorallocate($thumb, 255, 255, 255));
        imagecopyresampled($thumb, $img, 0, 0, 0, 0, $nw, $nh, $w, $h);
        $ok = @imagejpeg($thumb, $dst, AW_QUALITY);
        imagedestroy($thumb); imagedestroy($img);

        if ($ok) {
            printf("  %-28s %6d КБ → %4d КБ\n", basename($dir) . '/' . $name,
                (int) round(filesize($src) / 1024), (int) round(filesize($dst) / 1024));
            $made++;
        } else {
            $failed++;
        }
    }
}
printf("\nготово: сделано %d, пропущено %d, не удалось %d\n", $made, $skipped, $failed);
