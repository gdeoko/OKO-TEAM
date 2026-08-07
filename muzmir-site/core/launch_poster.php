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
    // Фон — тёмно-синий градиент (бренд), на случай пустых зон.
    for ($y = 0; $y < $H; $y++) {
        $t = $y / $H;
        $r = (int) (12 + $t * 10); $g = (int) (18 + $t * 20); $b = (int) (44 + $t * 46);
        imageline($img, 0, $y, $W, $y, imagecolorallocate($img, $r, $g, $b));
    }
    $goldA = [212, 175, 55]; $goldB = [176, 138, 44];
    $navy  = imagecolorallocate($img, 12, 22, 58);
    $gold  = imagecolorallocate($img, 224, 190, 92);
    $white = imagecolorallocate($img, 255, 255, 255);

    // === НИЗ: афиши заполняют всю область под шапкой (без «мёртвого» синего поля) ===
    $covers = [];
    foreach ($comps as $c) { $g0 = lp_load_cover($c); if ($g0) $covers[] = $g0; }
    $n = min(count($covers), 4);
    $capH  = 132;                         // высота верхней золотой плашки-заголовка
    $areaX = 0; $areaY = $capH; $areaW = $W; $areaH = $H - $capH;

    // Раскладка прямоугольников под N афиш: 1 — во всю область; 2 — рядом; 3 — 2 сверху + 1 снизу; 4 — 2×2.
    $rects = [];
    if ($n === 1) {
        $rects[] = [$areaX, $areaY, $areaW, $areaH];
    } elseif ($n === 2) {
        $halfW = (int) ($areaW / 2);
        $rects[] = [$areaX, $areaY, $halfW, $areaH];
        $rects[] = [$areaX + $halfW, $areaY, $areaW - $halfW, $areaH];
    } elseif ($n === 3) {
        $halfH = (int) ($areaH / 2); $halfW = (int) ($areaW / 2);
        $rects[] = [$areaX, $areaY, $halfW, $halfH];
        $rects[] = [$areaX + $halfW, $areaY, $areaW - $halfW, $halfH];
        $rects[] = [$areaX, $areaY + $halfH, $areaW, $areaH - $halfH];
    } elseif ($n >= 4) {
        $halfH = (int) ($areaH / 2); $halfW = (int) ($areaW / 2);
        $rects[] = [$areaX, $areaY, $halfW, $halfH];
        $rects[] = [$areaX + $halfW, $areaY, $areaW - $halfW, $halfH];
        $rects[] = [$areaX, $areaY + $halfH, $halfW, $areaH - $halfH];
        $rects[] = [$areaX + $halfW, $areaY + $halfH, $areaW - $halfW, $areaH - $halfH];
    }
    for ($i = 0; $i < $n; $i++) {
        [$rx, $ry, $rw, $rh] = $rects[$i];
        $src = $covers[$i]; $sw = imagesx($src); $sh = imagesy($src);
        $scale = max($rw / $sw, $rh / $sh);           // cover-fit
        $srcW = (int) ($rw / $scale); $srcH = (int) ($rh / $scale);
        $srcX = (int) (($sw - $srcW) / 2); $srcY = (int) (($sh - $srcH) / 2);
        imagecopyresampled($img, $src, $rx, $ry, $srcX, $srcY, $rw, $rh, $srcW, $srcH);
    }
    foreach ($covers as $g0) imagedestroy($g0);

    // Тонкие золотые разделители между афишами.
    if ($n >= 2) {
        if ($n === 2) { imagefilledrectangle($img, (int) ($W / 2) - 2, $areaY, (int) ($W / 2) + 1, $H, $gold); }
        else { // 3/4 — крест
            imagefilledrectangle($img, (int) ($W / 2) - 2, $areaY, (int) ($W / 2) + 1, $H, $gold);
            imagefilledrectangle($img, 0, $areaY + (int) ($areaH / 2) - 2, $W, $areaY + (int) ($areaH / 2) + 1, $gold);
        }
    }

    // Мягкое затемнение афиш снизу — чтобы нижняя подпись (название конкурса) читалась.
    if ($extra !== '') {
        $shade = imagecreatetruecolor($W, 96);
        imagefilledrectangle($shade, 0, 0, $W, 96, imagecolorallocate($shade, 8, 12, 30));
        imagecopymerge($img, $shade, 0, $H - 96, 0, 0, $W, 96, 62);
        imagedestroy($shade);
    }

    // === ВЕРХ: золотая плашка-заголовок (текст тёмно-синим, высокий контраст, не поверх афиш) ===
    for ($y = 0; $y < $capH; $y++) {
        $t = $y / $capH;
        $r = (int) ($goldA[0] + ($goldB[0] - $goldA[0]) * $t);
        $g = (int) ($goldA[1] + ($goldB[1] - $goldA[1]) * $t);
        $b = (int) ($goldA[2] + ($goldB[2] - $goldA[2]) * $t);
        imageline($img, 0, $y, $W, $y, imagecolorallocate($img, $r, $g, $b));
    }
    imagefilledrectangle($img, 0, $capH - 4, $W, $capH - 1, $navy);   // нижняя грань плашки

    $size = 52;
    $lines = lp_wrap($caption, $font, $size, $W - 120);
    while (count($lines) > 2 && $size > 30) { $size -= 4; $lines = lp_wrap($caption, $font, $size, $W - 120); }
    if (count($lines) === 1) { while ($size < 62) { $t2 = lp_wrap($caption, $font, $size + 2, $W - 120); if (count($t2) > 1) break; $size += 2; } }
    $lh = (int) ($size * 1.18);
    $blockH = $lh * count($lines);
    $ty = (int) (($capH - $blockH) / 2);
    foreach ($lines as $ln) {
        $bb = imagettfbbox($size, 0, $font, $ln); $tw = abs($bb[2] - $bb[0]);
        $tx = (int) (($W - $tw) / 2);
        imagettftext($img, $size, 0, $tx, $ty + $size, $navy, $font, $ln);
        $ty += $lh;
    }

    // Нижняя подпись (название конкурса для результатов) — золотом по центру над низом.
    if ($extra !== '') {
        $s2 = 34; $el = lp_wrap($extra, $font, $s2, $W - 160);
        $ln = $el[0] ?? $extra;
        $bb = imagettfbbox($s2, 0, $font, $ln); $tw = abs($bb[2] - $bb[0]);
        imagettftext($img, $s2, 0, (int) (($W - $tw) / 2), $H - 34, $gold, $font, $ln);
    }

    imagepng($img, $out, 6);
    imagedestroy($img);
    return is_file($out) ? $out : null;
}
