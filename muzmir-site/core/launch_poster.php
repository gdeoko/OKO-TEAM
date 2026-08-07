<?php
/**
 * core/launch_poster.php — генерация композит-афиш для ОБЩИХ постов запуска
 * («осталось 3 дня», «последний день», «приём закрыт») и для поста результатов
 * длинного конкурса. Собирается на лету через GD: сетка из афиш всех открытых
 * конкурсов + фирменный фон + крупная надпись. Кэшируется по хэшу входа.
 *
 * Требует GD + FreeType (есть на сервере). Кириллический шрифт — DejaVuSans-Bold.
 * Возвращает АБСОЛЮТНЫЙ путь к PNG (для ВК-фото) или null при сбое.
 */
declare(strict_types=1);

/** Путь к жирному кириллическому TTF. */
function lp_font_bold(): string {
    foreach ([
        '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf',
        '/usr/share/fonts/truetype/dejavu/DejaVuSansCondensed-Bold.ttf',
        BASE_PATH . '/public/assets/fonts/Montserrat-Bold.ttf',
    ] as $f) if (is_file($f)) return $f;
    return '';
}

/** Заголовок для общего поста по волне. */
function lp_wave_caption(string $wave): string {
    return match ($wave) {
        'd3'      => 'ОСТАЛОСЬ 3 ДНЯ ДО КОНЦА ПРИЁМА ЗАЯВОК',
        'last'    => 'ПОСЛЕДНИЙ ДЕНЬ ПРИЁМА ЗАЯВОК',
        'closed'  => 'ПРИЁМ ЗАЯВОК ЗАКРЫТ',
        'results' => 'РЕЗУЛЬТАТЫ КОНКУРСА',
        default   => '',
    };
}

/** Перенос строки по ширине (imagettfbbox), учитывая размер шрифта. */
function lp_wrap(string $text, string $font, float $size, int $maxW): array {
    $words = preg_split('~\s+~u', trim($text)) ?: [];
    $lines = []; $cur = '';
    foreach ($words as $w) {
        $try = $cur === '' ? $w : ($cur . ' ' . $w);
        $bb = imagettfbbox($size, 0, $font, $try);
        $wpx = abs($bb[2] - $bb[0]);
        if ($wpx > $maxW && $cur !== '') { $lines[] = $cur; $cur = $w; }
        else $cur = $try;
    }
    if ($cur !== '') $lines[] = $cur;
    return $lines;
}

/** Загружает афишу конкурса как GD-ресурс (jpg/png), либо null. */
function lp_load_cover(array $c) {
    $cover = trim((string) ($c['cover'] ?? ''));
    if ($cover === '') return null;
    $cover = preg_replace('~^https?://[^/]+~i', '', $cover);
    $p = BASE_PATH . '/public/' . ltrim($cover, '/');
    if (!is_file($p)) return null;
    $ext = strtolower(pathinfo($p, PATHINFO_EXTENSION));
    try {
        if (in_array($ext, ['jpg', 'jpeg'], true)) return @imagecreatefromjpeg($p);
        if ($ext === 'png') return @imagecreatefrompng($p);
        if ($ext === 'webp' && function_exists('imagecreatefromwebp')) return @imagecreatefromwebp($p);
    } catch (\Throwable $e) {}
    return null;
}

/**
 * Композит-афиша для общего поста (d3/last/closed) или результатов.
 * @param string $wave  d3|last|closed|results
 * @param array  $comps конкурсы, чьи афиши включить (открытые — для общих; [конкурс] — для результатов)
 * @param string $extra доп. подпись (напр. название конкурса для результатов)
 * @return string|null  абсолютный путь к PNG
 */
function launch_poster(string $wave, array $comps, string $extra = ''): ?string {
    if (!function_exists('imagecreatetruecolor') || !function_exists('imagettftext')) return null;
    $font = lp_font_bold();
    if ($font === '') return null;
    $caption = lp_wave_caption($wave);
    if ($caption === '') return null;

    // Кэш по хэшу (волна + список афиш + подпись).
    $sig = $wave . '|' . $extra;
    foreach ($comps as $c) $sig .= '|' . ($c['id'] ?? '') . ':' . ($c['cover'] ?? '') . ':' . @filemtime(BASE_PATH . '/public/' . ltrim(preg_replace('~^https?://[^/]+~i', '', (string) ($c['cover'] ?? '')), '/'));
    $key = substr(md5($sig), 0, 16);
    $dir = BASE_PATH . '/public/uploads/launch/';
    if (!is_dir($dir)) @mkdir($dir, 0775, true);
    $out = $dir . 'poster_' . $wave . '_' . $key . '.png';
    if (is_file($out)) return $out;

    $W = 1200; $H = 630;
    $img = imagecreatetruecolor($W, $H);
    // Фон — тёмно-синий градиент (бренд).
    for ($y = 0; $y < $H; $y++) {
        $t = $y / $H;
        $r = (int) (13 + $t * 10); $g = (int) (16 + $t * 24); $b = (int) (40 + $t * 50);
        $col = imagecolorallocate($img, $r, $g, $b);
        imageline($img, 0, $y, $W, $y, $col);
    }
    $gold  = imagecolorallocate($img, 212, 175, 55);
    $white = imagecolorallocate($img, 255, 255, 255);
    $shadow= imagecolorallocatealpha($img, 0, 0, 0, 55);

    // Сетка афиш вверху (до 4 в ряд), с рамкой.
    $covers = [];
    foreach ($comps as $c) { $g0 = lp_load_cover($c); if ($g0) $covers[] = $g0; }
    $n = count($covers);
    if ($n > 0) {
        $n = min($n, 4);
        $gap = 18; $areaW = $W - 80; $cw = (int) (($areaW - $gap * ($n - 1)) / $n); $ch = (int) ($cw * 0.62);
        $x0 = 40; $y0 = 60;
        for ($i = 0; $i < $n; $i++) {
            $src = $covers[$i];
            $sw = imagesx($src); $sh = imagesy($src);
            // cover-fit
            $scale = max($cw / $sw, $ch / $sh);
            $nw = (int) ($sw * $scale); $nh = (int) ($sh * $scale);
            $tmp = imagecreatetruecolor($cw, $ch);
            imagecopyresampled($tmp, $src, 0, 0, (int) (($nw - $cw) / 2 / $scale), (int) (($nh - $ch) / 2 / $scale), $cw, $ch, (int) ($cw / $scale), (int) ($ch / $scale));
            $x = $x0 + $i * ($cw + $gap);
            imagecopy($img, $tmp, $x, $y0, 0, 0, $cw, $ch);
            imagerectangle($img, $x, $y0, $x + $cw - 1, $y0 + $ch - 1, $gold);
            imagedestroy($tmp);
        }
        foreach ($covers as $g0) imagedestroy($g0);
    }

    // Затемняющая плашка снизу под текст.
    $band = imagecreatetruecolor($W, 250);
    imagefilledrectangle($band, 0, 0, $W, 250, imagecolorallocate($band, 8, 10, 26));
    imagecopymerge($img, $band, 0, $H - 250, 0, 0, $W, 250, 78);
    imagedestroy($band);

    // Заголовок волны — крупно, по центру, с автопереносом.
    $size = 54;
    $lines = lp_wrap($caption, $font, $size, $W - 120);
    while (count($lines) > 2 && $size > 34) { $size -= 4; $lines = lp_wrap($caption, $font, $size, $W - 120); }
    $lh = (int) ($size * 1.35);
    $blockH = $lh * count($lines);
    $ty = $H - 150 + (int) (($blockH <= 120 ? (120 - $blockH) / 2 : 0));
    foreach ($lines as $ln) {
        $bb = imagettfbbox($size, 0, $font, $ln);
        $tw = abs($bb[2] - $bb[0]);
        $tx = (int) (($W - $tw) / 2);
        imagettftext($img, $size, 0, $tx + 2, $ty + $lh + 2, $shadow, $font, $ln);
        imagettftext($img, $size, 0, $tx, $ty + $lh, $gold, $font, $ln);
        $ty += $lh;
    }
    // Доп. подпись (название конкурса для результатов) — под заголовком, белым.
    if ($extra !== '') {
        $s2 = 30; $el = lp_wrap($extra, $font, $s2, $W - 140);
        $ln = $el[0] ?? $extra;
        $bb = imagettfbbox($s2, 0, $font, $ln); $tw = abs($bb[2] - $bb[0]);
        imagettftext($img, $s2, 0, (int) (($W - $tw) / 2), $H - 40, $white, $font, $ln);
    }

    imagepng($img, $out, 6);
    imagedestroy($img);
    return is_file($out) ? $out : null;
}
