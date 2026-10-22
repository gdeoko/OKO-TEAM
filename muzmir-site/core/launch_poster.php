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
 * ВЕРТИКАЛЬНАЯ КАРТИНКА ДЛЯ СТОРИС (1080×1920).
 *
 * Сторис ВК — кадр 9:16, и широкий постер волны в нём либо срезается по
 * краям, либо съёживается до полоски с нечитаемыми гербами. Здесь афиши стоят
 * одна под другой, каждая целиком, под той же золотой плашкой-заголовком.
 * Слово владельца 22.10.2026: афиши везде видны полностью, с рядом гербов.
 */
function launch_story_poster(string $wave, array $comps, string $extra = ''): ?string {
    if (!function_exists('imagecreatetruecolor') || !function_exists('imagettftext')) return null;
    $font = lp_font_bold();
    $caption = lp_wave_caption($wave);
    if ($font === '' || $caption === '') return null;

    $sig = 'story-v3|' . $wave . '|' . $extra;
    foreach ($comps as $c) $sig .= '|' . ($c['id'] ?? '') . ':' . ($c['cover'] ?? '') . ':' . @filemtime(BASE_PATH . '/public/' . ltrim(preg_replace('~^https?://[^/]+~i', '', (string) ($c['cover'] ?? '')), '/'));
    $dir = BASE_PATH . '/public/uploads/launch/';
    if (!is_dir($dir)) @mkdir($dir, 0775, true);
    // JPEG, не PNG: сторис со ссылкой ВК в PNG не берёт — «error_code 4603, Upload failed»
    // приходит внутри upload_result, проверено 22.10.2026; без ссылки PNG проходит.
    $out = $dir . 'story_' . $wave . '_' . substr(md5($sig), 0, 16) . '.jpg';
    if (is_file($out)) return $out;

    $covers = [];
    foreach ($comps as $c) { $g0 = lp_load_cover($c); if ($g0) $covers[] = $g0; }
    $n = min(count($covers), 4);
    if ($n === 0) return null;

    $W = 1080; $H = 1920;
    /* Безопасные поля: сверху ВК кладёт полосу просмотра и имя сообщества,
       снизу — кнопку ссылки и поле ответа. В них ни текста, ни гербов. */
    $safeTop = 120; $safeBot = 180;
    $capH = 190; $gap = 10; $pad = 16;
    $botH = $extra !== '' ? 90 : 0;
    $img = imagecreatetruecolor($W, $H);
    for ($y = 0; $y < $H; $y++) {
        $t = $y / $H;
        imageline($img, 0, $y, $W, $y, imagecolorallocate($img, (int) (12 + $t * 10), (int) (18 + $t * 20), (int) (44 + $t * 46)));
    }
    $navy = imagecolorallocate($img, 12, 22, 58);
    $gold = imagecolorallocate($img, 224, 190, 92);

    // Афиши столбиком: ширина — сколько позволяет высота, но не шире кадра.
    $availH = $H - $safeTop - $capH - $botH - $safeBot - $pad * 2 - $gap * ($n - 1);
    $maxW = $W - $pad * 2;
    $sumAr = 0.0;
    for ($i = 0; $i < $n; $i++) $sumAr += imagesy($covers[$i]) / max(1, imagesx($covers[$i]));
    $wFit = (int) floor(min($maxW, $availH / max(0.01, $sumAr)));
    $y = $safeTop + $capH + $pad + (int) (($availH - $wFit * $sumAr) / 2);
    for ($i = 0; $i < $n; $i++) {
        $src = $covers[$i]; $sw = imagesx($src); $sh = imagesy($src);
        $dw = $wFit; $dh = (int) round($sh * $dw / $sw);
        $x = (int) (($W - $dw) / 2);
        imagefilledrectangle($img, $x - 3, $y - 3, $x + $dw + 2, $y + $dh + 2, $gold);
        imagecopyresampled($img, $src, $x, $y, 0, 0, $dw, $dh, $sw, $sh);
        $y += $dh + $gap;
        imagedestroy($src);
    }

    // Плашка-заголовок.
    $goldA = [212, 175, 55]; $goldB = [176, 138, 44];
    for ($yy = 0; $yy < $capH; $yy++) {
        $t = $yy / $capH;
        imageline($img, 0, $safeTop + $yy, $W, $safeTop + $yy, imagecolorallocate($img,
            (int) ($goldA[0] + ($goldB[0] - $goldA[0]) * $t), (int) ($goldA[1] + ($goldB[1] - $goldA[1]) * $t), (int) ($goldA[2] + ($goldB[2] - $goldA[2]) * $t)));
    }
    imagefilledrectangle($img, 0, $safeTop, $W, $safeTop + 5, $navy);
    imagefilledrectangle($img, 0, $safeTop + $capH - 6, $W, $safeTop + $capH - 1, $navy);
    $size = 60;
    $lines = lp_wrap($caption, $font, $size, $W - 90);
    while (count($lines) > 2 && $size > 36) { $size -= 4; $lines = lp_wrap($caption, $font, $size, $W - 90); }
    $lh = (int) ($size * 1.2);
    $ty = $safeTop + (int) (($capH - $lh * count($lines)) / 2);
    foreach ($lines as $ln) {
        $bb = imagettfbbox($size, 0, $font, $ln);
        imagettftext($img, $size, 0, (int) (($W - abs($bb[2] - $bb[0])) / 2), $ty + $size, $navy, $font, $ln);
        $ty += $lh;
    }
    if ($botH > 0) {
        $s2 = 40; $ln = lp_wrap($extra, $font, $s2, $W - 100)[0] ?? $extra;
        $bb = imagettfbbox($s2, 0, $font, $ln);
        imagettftext($img, $s2, 0, (int) (($W - abs($bb[2] - $bb[0])) / 2), $H - $safeBot - (int) (($botH - $s2) / 2), $gold, $font, $ln);
    }

    $tmp = $out . '.tmp' . getmypid();
    $ok = @imagejpeg($img, $tmp, 92);
    imagedestroy($img);
    if ($ok && is_file($tmp)) { @chmod($tmp, 0664); if (@rename($tmp, $out)) return $out; @unlink($tmp); }
    return is_file($out) ? $out : null;
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
    $sig = 'contain-v3|' . $wave . '|' . $extra;   // v3: афиши целиком, без обрезки, холст 2400
    foreach ($comps as $c) $sig .= '|' . ($c['id'] ?? '') . ':' . ($c['cover'] ?? '') . ':' . @filemtime(BASE_PATH . '/public/' . ltrim(preg_replace('~^https?://[^/]+~i', '', (string) ($c['cover'] ?? '')), '/'));
    $key = substr(md5($sig), 0, 16);
    $dir = BASE_PATH . '/public/uploads/launch/';
    if (!is_dir($dir)) @mkdir($dir, 0775, true);
    $out = $dir . 'poster_' . $wave . '_' . $key . '.png';
    if (is_file($out)) return $out;

    /* АФИША ВИДНА ЦЕЛИКОМ (слово владельца 22.10.2026).
     *
     * Раньше холст был 1200×630, и каждая афиша растягивалась на свою клетку
     * с обрезкой (cover-fit): у 2×2 клетка 600×249, а афиша 16:9 — срезались
     * верх с надписью о регистрации и низ с рядом гербов. Теперь высота холста
     * считается от пропорции самих афиш: клетка ровно по афише, вписывание без
     * обрезки, гербы видны все. Подпись под итогами — отдельной полосой ниже
     * афиш, а не затемнением поверх них. */
    $covers = [];
    foreach ($comps as $c) { $g0 = lp_load_cover($c); if ($g0) $covers[] = $g0; }
    $n = min(count($covers), 4);
    $ars = [];
    for ($i = 0; $i < $n; $i++) $ars[] = imagesx($covers[$i]) / max(1, imagesy($covers[$i]));
    sort($ars);
    $ar = $ars ? $ars[(int) floor((count($ars) - 1) / 2)] : 16 / 9;   // медиана пропорций
    $ar = max(1.0, min(2.4, $ar));

    /* Холст вдвое крупнее прежнего: мелкие строки афиш и гербы при 1200 px
       расплывались, а ВК и МАКС берут картинку до 2560 px. Все размеры — через $k. */
    $k = 2;
    $W = 1200 * $k;
    $capH  = 132 * $k;                         // высота верхней золотой плашки-заголовка
    $cols  = $n <= 1 ? 1 : 2;
    $rows  = max(1, (int) ceil($n / $cols));
    $cellW = (int) ($W / $cols);
    $cellH = (int) round($cellW / $ar);
    $botH  = $extra !== '' ? 84 * $k : 0;      // полоса подписи (название конкурса у итогов)
    $areaY = $capH;
    $H = $capH + $rows * $cellH + $botH;

    $img = imagecreatetruecolor($W, $H);
    // Фон — тёмно-синий градиент (бренд), виден по краям, если пропорции афиш разные.
    for ($y = 0; $y < $H; $y++) {
        $t = $y / $H;
        $r = (int) (12 + $t * 10); $g = (int) (18 + $t * 20); $b = (int) (44 + $t * 46);
        imageline($img, 0, $y, $W, $y, imagecolorallocate($img, $r, $g, $b));
    }
    $goldA = [212, 175, 55]; $goldB = [176, 138, 44];
    $navy  = imagecolorallocate($img, 12, 22, 58);
    $gold  = imagecolorallocate($img, 224, 190, 92);

    // Клетки: 1 — во всю ширину; 2 — рядом; 3 — две сверху и одна по центру снизу; 4 — 2×2.
    $rects = [];
    for ($i = 0; $i < $n; $i++) {
        $row = intdiv($i, $cols); $col = $i % $cols;
        $x = $col * $cellW;
        if ($n === 3 && $i === 2) $x = (int) (($W - $cellW) / 2);
        $rects[] = [$x, $areaY + $row * $cellH, $cellW, $cellH];
    }
    for ($i = 0; $i < $n; $i++) {
        [$rx, $ry, $rw, $rh] = $rects[$i];
        $src = $covers[$i]; $sw = imagesx($src); $sh = imagesy($src);
        $scale = min($rw / $sw, $rh / $sh);           // contain: без обрезки
        $dw = (int) round($sw * $scale); $dh = (int) round($sh * $scale);
        imagecopyresampled($img, $src, $rx + (int) (($rw - $dw) / 2), $ry + (int) (($rh - $dh) / 2), 0, 0, $dw, $dh, $sw, $sh);
    }
    foreach ($covers as $g0) imagedestroy($g0);

    // Тонкие золотые разделители между афишами.
    if ($n >= 2) {
        $vEnd = $n === 3 ? $areaY + $cellH : $areaY + $rows * $cellH;
        imagefilledrectangle($img, (int) ($W / 2) - $k, $areaY, (int) ($W / 2) + $k - 1, $vEnd, $gold);
        for ($r = 1; $r < $rows; $r++) {
            $yy = $areaY + $r * $cellH;
            imagefilledrectangle($img, 0, $yy - $k, $W, $yy + $k - 1, $gold);
        }
        if ($n === 3) {
            $x3 = $rects[2][0];
            imagefilledrectangle($img, $x3 - $k, $areaY + $cellH, $x3 + $k - 1, $areaY + 2 * $cellH, $gold);
            imagefilledrectangle($img, $x3 + $cellW - $k, $areaY + $cellH, $x3 + $cellW + $k - 1, $areaY + 2 * $cellH, $gold);
        }
    }

    // Полоса подписи под афишами.
    if ($botH > 0) {
        imagefilledrectangle($img, 0, $H - $botH, $W, $H, imagecolorallocate($img, 8, 12, 30));
        imagefilledrectangle($img, 0, $H - $botH, $W, $H - $botH + 2 * $k, $gold);
    }

    // === ВЕРХ: золотая плашка-заголовок (текст тёмно-синим, высокий контраст, не поверх афиш) ===
    for ($y = 0; $y < $capH; $y++) {
        $t = $y / $capH;
        $r = (int) ($goldA[0] + ($goldB[0] - $goldA[0]) * $t);
        $g = (int) ($goldA[1] + ($goldB[1] - $goldA[1]) * $t);
        $b = (int) ($goldA[2] + ($goldB[2] - $goldA[2]) * $t);
        imageline($img, 0, $y, $W, $y, imagecolorallocate($img, $r, $g, $b));
    }
    imagefilledrectangle($img, 0, $capH - 4 * $k, $W, $capH - 1, $navy);   // нижняя грань плашки

    $size = 52 * $k;
    $lines = lp_wrap($caption, $font, $size, $W - 120 * $k);
    while (count($lines) > 2 && $size > 30 * $k) { $size -= 4 * $k; $lines = lp_wrap($caption, $font, $size, $W - 120 * $k); }
    if (count($lines) === 1) { while ($size < 62 * $k) { $t2 = lp_wrap($caption, $font, $size + 2 * $k, $W - 120 * $k); if (count($t2) > 1) break; $size += 2 * $k; } }
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
        $s2 = 34 * $k; $el = lp_wrap($extra, $font, $s2, $W - 160 * $k);
        $ln = $el[0] ?? $extra;
        $bb = imagettfbbox($s2, 0, $font, $ln); $tw = abs($bb[2] - $bb[0]);
        imagettftext($img, $s2, 0, (int) (($W - $tw) / 2), $H - (int) (($botH - $s2) / 2), $gold, $font, $ln);
    }

    // Пишем во временный файл и подменяем атомарно. Прямая запись поверх готового
    // файла падала с «Permission denied», если постер создал другой процесс (например,
    // CLI-крон от root, а веб идёт от www-data): в лог сыпались предупреждения, а на
    // странице конкурсов постер молча не обновлялся.
    $tmp = $out . '.tmp' . getmypid();
    $okWrite = @imagepng($img, $tmp, 6);
    imagedestroy($img);
    if ($okWrite && is_file($tmp)) {
        @chmod($tmp, 0664);
        if (@rename($tmp, $out)) return $out;
        @unlink($tmp);
    }
    // Перезаписать не вышло — отдаём ранее собранный постер, если он на месте:
    // лучше вчерашняя афиша, чем пост вообще без афиши.
    return is_file($out) ? $out : null;
}
