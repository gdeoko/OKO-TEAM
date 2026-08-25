<?php
/**
 * ВСТАВКА НАСТОЯЩИХ ГЕРБОВ В ЗАГЛУШКИ СГЕНЕРИРОВАННОЙ АФИШИ.
 *
 * Афиша целиком рисуется нейросетью — вместе с русским текстом, и текст выходит
 * правильным. А вот гербы ведомств она рисовать не должна: двуглавый орёл у неё
 * получается похожим, но не тем, и афишу с таким орлом нельзя отправить ни в
 * школу, ни в отдел культуры. Поэтому в промпте на их месте просятся ПУСТЫЕ
 * светлые круги, а сюда приходит готовая картинка, в которой эти круги надо
 * найти и заменить настоящими эмблемами.
 *
 * Круги ищутся, а не задаются координатами: от генерации к генерации ряд гуляет
 * по высоте и ширине на десятки пикселей, и жёсткие координаты означали бы гербы
 * мимо кругов на каждой второй афише.
 *
 * afisha_fill_emblems(string $src, array $logos, string $dst): array — отчёт.
 */
declare(strict_types=1);

/**
 * Ищет ряд светлых круглых заглушек в нижней половине картинки.
 *
 * Как работает. Заглушки — самые светлые крупные пятна на тёмном фоне афиши.
 * Идём по сетке, отмечаем светлые точки, собираем их в связные пятна
 * (обход в ширину), отсеиваем всё, что не похоже на круг: слишком мелкое,
 * слишком вытянутое, слишком большое. Остаются заглушки.
 *
 * @return array список ['cx','cy','r'] слева направо
 */
function afisha_find_placeholders(string $file, array $opt = []): array {
    $info = @getimagesize($file);
    if (!$info) return [];
    $im = match ($info[2]) {
        IMAGETYPE_PNG  => @imagecreatefrompng($file),
        IMAGETYPE_JPEG => @imagecreatefromjpeg($file),
        IMAGETYPE_WEBP => @imagecreatefromwebp($file),
        default        => null,
    };
    if (!$im) return [];

    $W = imagesx($im); $H = imagesy($im);
    // Заглушки стоят в нижней части афиши. Верх не смотрим вовсе: там светлые
    // буквы и блики, из которых легко слепить ложное «пятно».
    $y0 = (int) ($H * (float) ($opt['from'] ?? 0.55));
    $y1 = (int) ($H * (float) ($opt['to']   ?? 0.98));
    $step = max(2, (int) round($W / 480));          // шаг сетки: точность против скорости

    /* Светлым считаем тёплый кремовый тон заглушки. Границы взяты с живой
     * генерации: просили #F6F1E4, нейросеть отдала #FBEAC7 — заметно теплее.
     * Первый вариант фильтра требовал разницу красного и синего меньше 52, а
     * тут она ровно 52, и ни одна заглушка не нашлась. Держим коридор с запасом,
     * но не настолько широкий, чтобы в него попало золото букв. */
    $isLight = static function (int $rgb): bool {
        $r = ($rgb >> 16) & 255; $g = ($rgb >> 8) & 255; $b = $rgb & 255;
        if ($r < 205 || $g < 195 || $b < 165) return false;
        // Отсекаем холодные блики и насыщенное золото: у золота синий проваливается.
        return abs($r - $g) < 34 && ($r - $b) < 90 && ($r - $b) > -12;
    };

    $cols = [];
    for ($y = $y0; $y < $y1; $y += $step) {
        for ($x = 0; $x < $W; $x += $step) {
            if ($isLight(imagecolorat($im, $x, $y))) $cols[($y << 16) | $x] = [$x, $y];
        }
    }
    if (!$cols) { imagedestroy($im); return []; }

    // Связные пятна: обход в ширину по соседям на расстоянии шага.
    $seen = []; $blobs = [];
    foreach ($cols as $key => $pt) {
        if (isset($seen[$key])) continue;
        $queue = [$key]; $seen[$key] = true;
        $minX = $maxX = $pt[0]; $minY = $maxY = $pt[1]; $n = 0;
        while ($queue) {
            $k = array_pop($queue);
            [$cx, $cy] = $cols[$k];
            $n++;
            if ($cx < $minX) $minX = $cx; if ($cx > $maxX) $maxX = $cx;
            if ($cy < $minY) $minY = $cy; if ($cy > $maxY) $maxY = $cy;
            for ($dy = -$step; $dy <= $step; $dy += $step) {
                for ($dx = -$step; $dx <= $step; $dx += $step) {
                    if (!$dx && !$dy) continue;
                    $nk = (($cy + $dy) << 16) | ($cx + $dx);
                    if (isset($cols[$nk]) && !isset($seen[$nk])) { $seen[$nk] = true; $queue[] = $nk; }
                }
            }
        }
        $w = $maxX - $minX; $h = $maxY - $minY;
        if ($w < $W * 0.025 || $w > $W * 0.22) continue;      // не мелочь и не полполотна
        if ($h < 1 || $w / $h < 0.72 || $w / $h > 1.38) continue;  // круг, а не полоса
        $fill = $n / max(1, ($w / $step) * ($h / $step));
        if ($fill < 0.55) continue;                            // круг заполнен, кольцо — нет
        $blobs[] = ['cx' => (int) (($minX + $maxX) / 2), 'cy' => (int) (($minY + $maxY) / 2),
                    'r'  => (int) (($w + $h) / 4)];
    }
    imagedestroy($im);

    if (count($blobs) < 2) return $blobs;

    /* Заглушки стоят ОДНИМ РЯДОМ. Всё, что заметно выше или ниже основной линии,
     * — не заглушка, а случайное светлое пятно (блик на полу, край занавеса).
     * Берём медиану высоты и держимся её. */
    $ys = array_column($blobs, 'cy');
    sort($ys);
    $mid = $ys[intdiv(count($ys), 2)];
    $rs  = array_column($blobs, 'r');
    sort($rs);
    $rMid = $rs[intdiv(count($rs), 2)];
    $row = array_values(array_filter($blobs, static fn($b) =>
        abs($b['cy'] - $mid) <= max(12, $rMid * 0.7) && abs($b['r'] - $rMid) <= max(8, $rMid * 0.45)));

    usort($row, static fn($a, $b) => $a['cx'] <=> $b['cx']);
    return $row;
}

/**
 * Вписывает эмблемы в найденные заглушки.
 *
 * @param string   $src   сгенерированная афиша
 * @param string[] $logos пути к файлам эмблем (public-relative или абсолютные)
 * @param string   $dst   куда сохранить результат
 * @return array ['ok'=>bool,'found'=>int,'placed'=>int,'error'=>string]
 */
function afisha_fill_emblems(string $src, array $logos, string $dst): array {
    $spots = afisha_find_placeholders($src);
    if (!$spots) return ['ok' => false, 'found' => 0, 'placed' => 0, 'error' => 'заглушки не найдены'];

    $info = @getimagesize($src);
    $im = match ($info[2] ?? 0) {
        IMAGETYPE_PNG  => @imagecreatefrompng($src),
        IMAGETYPE_JPEG => @imagecreatefromjpeg($src),
        IMAGETYPE_WEBP => @imagecreatefromwebp($src),
        default        => null,
    };
    if (!$im) return ['ok' => false, 'found' => count($spots), 'placed' => 0, 'error' => 'картинка не открылась'];

    imagealphablending($im, true);
    $placed = 0;
    foreach ($spots as $i => $s) {
        if (!isset($logos[$i])) break;
        $lp = $logos[$i];
        if (!str_starts_with($lp, '/')) $lp = BASE_PATH . '/public/' . ltrim($lp, '/');
        if (!is_file($lp)) continue;
        $li = @getimagesize($lp);
        if (!$li) continue;
        $logo = match ($li[2]) {
            IMAGETYPE_PNG  => @imagecreatefrompng($lp),
            IMAGETYPE_JPEG => @imagecreatefromjpeg($lp),
            IMAGETYPE_WEBP => @imagecreatefromwebp($lp),
            default        => null,
        };
        if (!$logo) continue;

        /* Вписываем в круг с полем: герб не должен упираться в золотое кольцо
         * заглушки, иначе он выглядит наклейкой поверх, а не частью афиши. */
        $box = (int) round($s['r'] * 2 * 0.80);
        $lw = imagesx($logo); $lh = imagesy($logo);
        $k  = min($box / $lw, $box / $lh);
        $nw = max(1, (int) round($lw * $k)); $nh = max(1, (int) round($lh * $k));
        $dx = $s['cx'] - (int) round($nw / 2);
        $dy = $s['cy'] - (int) round($nh / 2);

        imagealphablending($logo, true);
        imagesavealpha($logo, true);
        imagecopyresampled($im, $logo, $dx, $dy, 0, 0, $nw, $nh, $lw, $lh);
        imagedestroy($logo);
        $placed++;
    }

    $dir = dirname($dst);
    if (!is_dir($dir)) @mkdir($dir, 0775, true);
    $ok = str_ends_with(strtolower($dst), '.png') ? imagepng($im, $dst) : imagejpeg($im, $dst, 92);
    imagedestroy($im);
    @chmod($dst, 0664);

    return ['ok' => (bool) $ok, 'found' => count($spots), 'placed' => $placed, 'error' => ''];
}
