<?php
/**
 * core/pdf_lib.php — внутренний слой рендера (без composer).
 *
 * Единый стек: GD + FreeType (шрифты DejaVu, полная кириллица) → страница-картинка
 * → PDF (каждая страница вставляется как JPEG-XObject через /DCTDecode).
 * Это гарантирует корректную кириллицу и премиум-оформление во всех генераторах
 * (положения, дипломы), а афиши используют те же примитивы рисования.
 *
 * Экспортирует: работу со шрифтами, загрузку/вставку изображений, измерение и
 * перенос текста, премиум-фоны и сборку многостраничного PDF.
 */
declare(strict_types=1);

/* ------------------------------- Шрифты ----------------------------------- */
function pl_font(string $weight = 'regular'): string {
    $base = '/usr/share/fonts/truetype/dejavu/';
    $local = BASE_PATH . '/public/assets/fonts/';
    $map = [
        'regular'     => 'DejaVuSans.ttf',
        'bold'        => 'DejaVuSans-Bold.ttf',
        'serif'       => 'DejaVuSerif.ttf',
        'serif-bold'  => 'DejaVuSerif-Bold.ttf',
    ];
    $file = $map[$weight] ?? $map['regular'];
    if (is_file($local . $file)) return $local . $file;
    if (is_file($base . $file)) return $base . $file;
    return $base . 'DejaVuSans.ttf';
}

/* --------------------------- Изображения ---------------------------------- */
/** Безопасно грузит PNG/JPG в GD-ресурс (или null). */
function pl_load(string $path) {
    if (!is_file($path)) return null;
    try {
        $info = @getimagesize($path);
        if (!$info) return null;
        return match ($info[2]) {
            IMAGETYPE_PNG  => @imagecreatefrompng($path),
            IMAGETYPE_JPEG => @imagecreatefromjpeg($path),
            IMAGETYPE_GIF  => @imagecreatefromgif($path),
            IMAGETYPE_WEBP => @imagecreatefromwebp($path),
            default        => null,
        } ?: null;
    } catch (\Throwable $e) { return null; }
}

/**
 * Рисует картинку на холст с сохранением альфы и пропорций.
 * Если задан только один из $w/$h — второй считается по аспекту.
 * $opacity 0..100.
 */
function pl_image($dst, string $path, int $x, int $y, ?int $w = null, ?int $h = null, int $opacity = 100): array {
    $src = pl_load($path);
    if (!$src) return [0, 0];
    $sw = imagesx($src); $sh = imagesy($src);
    if ($w === null && $h === null) { $w = $sw; $h = $sh; }
    elseif ($w === null) { $w = (int) round($sw * ($h / $sh)); }
    elseif ($h === null) { $h = (int) round($sh * ($w / $sw)); }
    imagealphablending($dst, true);
    if ($opacity >= 100) {
        imagecopyresampled($dst, $src, $x, $y, 0, 0, $w, $h, $sw, $sh);
    } else {
        // масштабируем во временный и накладываем с прозрачностью
        $tmp = imagecreatetruecolor($w, $h);
        imagealphablending($tmp, false); imagesavealpha($tmp, true);
        imagefilledrectangle($tmp, 0, 0, $w, $h, imagecolorallocatealpha($tmp, 0, 0, 0, 127));
        imagecopyresampled($tmp, $src, 0, 0, 0, 0, $w, $h, $sw, $sh);
        imagecopymergegray($dst, $tmp, $x, $y, 0, 0, $w, $h, $opacity);
        imagedestroy($tmp);
    }
    imagedestroy($src);
    return [$w, $h];
}

/* ------------------------------ Текст ------------------------------------- */
/** Ширина строки в пикселях для данного шрифта/размера. */
function pl_text_w($size, string $font, string $text): float {
    if ($text === '') return 0.0;
    $b = imagettfbbox($size, 0, $font, $text);
    return abs($b[2] - $b[0]);
}

/** Перенос текста по словам под максимальную ширину. Возвращает массив строк. */
function pl_wrap(string $text, $size, string $font, float $maxW): array {
    $out = [];
    foreach (preg_split('/\R/u', $text) as $para) {
        $words = preg_split('/\s+/u', trim($para));
        if ($words === [''] || $words === false) { $out[] = ''; continue; }
        $line = '';
        foreach ($words as $w) {
            $try = $line === '' ? $w : $line . ' ' . $w;
            if (pl_text_w($size, $font, $try) <= $maxW || $line === '') {
                $line = $try;
            } else {
                $out[] = $line;
                $line = $w;
            }
        }
        if ($line !== '') $out[] = $line;
    }
    return $out;
}

/** Рисует строку. $align: left|center|right (относительно $x или пары [x1,x2] при center). */
function pl_text($img, $x, int $y, $size, array $rgb, string $font, string $text, string $align = 'left', ?float $rightX = null): void {
    if ($text === '') return;
    $c = imagecolorallocate($img, $rgb[0], $rgb[1], $rgb[2]);
    if ($align === 'center') {
        $x2 = $rightX ?? (imagesx($img) - $x);
        $w = pl_text_w($size, $font, $text);
        $x = (int) round(($x + $x2 - $w) / 2);
    } elseif ($align === 'right') {
        $w = pl_text_w($size, $font, $text);
        $x = (int) round(($rightX ?? $x) - $w);
    }
    imagettftext($img, $size, 0, (int)$x, $y, $c, $font, $text);
}

/** Разрядка букв (letter-spacing) — для «премиум» заголовков капслоком. */
function pl_text_spaced($img, int $x, int $y, $size, array $rgb, string $font, string $text, float $spacing, string $align = 'left', ?int $rightX = null): int {
    $chars = preg_split('//u', $text, -1, PREG_SPLIT_NO_EMPTY);
    $total = 0;
    foreach ($chars as $ch) $total += pl_text_w($size, $font, $ch) + $spacing;
    $total -= $spacing;
    if ($align === 'center') {
        $x2 = $rightX ?? (imagesx($img) - $x);
        $x = (int) round(($x + $x2 - $total) / 2);
    } elseif ($align === 'right') {
        $x = (int) round(($rightX ?? $x) - $total);
    }
    $c = imagecolorallocate($img, $rgb[0], $rgb[1], $rgb[2]);
    $cx = $x;
    foreach ($chars as $ch) {
        imagettftext($img, $size, 0, $cx, $y, $c, $font, $ch);
        $cx += (int) round(pl_text_w($size, $font, $ch) + $spacing);
    }
    return $cx;
}

/* ------------------------------ Фоны/рамки -------------------------------- */
function pl_fill($img, array $rgb): void {
    imagefilledrectangle($img, 0, 0, imagesx($img), imagesy($img), imagecolorallocate($img, $rgb[0], $rgb[1], $rgb[2]));
}

/** Вертикальный градиент. */
function pl_gradient($img, array $top, array $bottom): void {
    $h = imagesy($img); $w = imagesx($img);
    for ($y = 0; $y < $h; $y++) {
        $t = $y / max(1, $h - 1);
        $r = (int) round($top[0] + ($bottom[0] - $top[0]) * $t);
        $g = (int) round($top[1] + ($bottom[1] - $top[1]) * $t);
        $b = (int) round($top[2] + ($bottom[2] - $top[2]) * $t);
        $c = imagecolorallocate($img, $r, $g, $b);
        imageline($img, 0, $y, $w, $y, $c);
    }
}

/** Радиальное свечение из центра (мягкий премиум-виньет наоборот). */
function pl_radial($img, array $inner, array $outer, float $cx = 0.5, float $cy = 0.42): void {
    $w = imagesx($img); $h = imagesy($img);
    $ccx = $w * $cx; $ccy = $h * $cy;
    $max = sqrt($ccx*$ccx + $ccy*$ccy);
    for ($y = 0; $y < $h; $y += 2) {
        for ($x = 0; $x < $w; $x += 2) {
            $d = sqrt(($x-$ccx)**2 + ($y-$ccy)**2) / $max;
            $d = min(1, $d);
            $r = (int)round($inner[0] + ($outer[0]-$inner[0])*$d);
            $g = (int)round($inner[1] + ($outer[1]-$inner[1])*$d);
            $b = (int)round($inner[2] + ($outer[2]-$inner[2])*$d);
            $c = imagecolorallocate($img, $r, $g, $b);
            imagefilledrectangle($img, $x, $y, $x+1, $y+1, $c);
        }
    }
}

/** Двойная рамка с золотыми линиями и уголками. */
function pl_frame($img, int $margin, array $gold, int $thick = 3): void {
    $w = imagesx($img); $h = imagesy($img);
    $c = imagecolorallocate($img, $gold[0], $gold[1], $gold[2]);
    imagesetthickness($img, $thick);
    imagerectangle($img, $margin, $margin, $w - $margin, $h - $margin, $c);
    imagesetthickness($img, 1);
    $in = $margin + 10;
    imagerectangle($img, $in, $in, $w - $in, $h - $in, $c);
    imagesetthickness($img, 1);
}

/** Тонкая горизонтальная линейка (разделитель). */
function pl_rule($img, int $x1, int $y, int $x2, array $rgb, int $thick = 2): void {
    imagesetthickness($img, $thick);
    imageline($img, $x1, $y, $x2, $y, imagecolorallocate($img, $rgb[0], $rgb[1], $rgb[2]));
    imagesetthickness($img, 1);
}

/* --------------------------- Сборка PDF ----------------------------------- */
/**
 * Собирает многостраничный PDF из GD-изображений (по одному на страницу).
 * Каждая страница кодируется в JPEG и вставляется как XObject /DCTDecode.
 * $dpi задаёт физический размер страницы (пиксели → пункты).
 */
function pl_pdf_from_images(array $images, string $path, int $dpi = 150, int $quality = 90): void {
    $dir = dirname($path);
    if (!is_dir($dir)) @mkdir($dir, 0775, true);

    $objects = [];               // тело каждого объекта (строка), индекс = номер-1
    $addObj = function (string $body) use (&$objects): int {
        $objects[] = $body;
        return count($objects);  // 1-based
    };

    // 1: Catalog, 2: Pages (заполним kids позже)
    $catalogId = $addObj('');    // placeholder 1
    $pagesId   = $addObj('');    // placeholder 2
    $kids = [];

    foreach ($images as $img) {
        ob_start();
        imagejpeg($img, null, $quality);
        $jpeg = ob_get_clean();
        $iw = imagesx($img); $ih = imagesy($img);
        $pw = round($iw * 72 / $dpi, 2);
        $ph = round($ih * 72 / $dpi, 2);

        $imgId = $addObj(
            "<< /Type /XObject /Subtype /Image /Width $iw /Height $ih "
            . "/ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode "
            . "/Length " . strlen($jpeg) . " >>\nstream\n" . $jpeg . "\nendstream"
        );
        $content = "q\n$pw 0 0 $ph 0 0 cm\n/Im0 Do\nQ\n";
        $contId = $addObj("<< /Length " . strlen($content) . " >>\nstream\n$content\nendstream");
        $pageId = $addObj(
            "<< /Type /Page /Parent $pagesId /MediaBox [0 0 $pw $ph] "
            . "/Resources << /XObject << /Im0 $imgId 0 R >> >> /Contents $contId 0 R >>"
        );
        $kids[] = "$pageId 0 R";
    }

    $objects[$catalogId - 1] = "<< /Type /Catalog /Pages $pagesId 0 R >>";
    $objects[$pagesId - 1]   = "<< /Type /Pages /Kids [" . implode(' ', $kids) . "] /Count " . count($kids) . " >>";

    // сборка файла с xref
    $pdf = "%PDF-1.4\n%\xE2\xE3\xCF\xD3\n";
    $offsets = [];
    foreach ($objects as $i => $body) {
        $offsets[$i] = strlen($pdf);
        $pdf .= ($i + 1) . " 0 obj\n" . $body . "\nendobj\n";
    }
    $xrefPos = strlen($pdf);
    $count = count($objects) + 1;
    $pdf .= "xref\n0 $count\n0000000000 65535 f \n";
    foreach ($offsets as $off) {
        $pdf .= sprintf("%010d 00000 n \n", $off);
    }
    $pdf .= "trailer\n<< /Size $count /Root $catalogId 0 R >>\nstartxref\n$xrefPos\n%%EOF";

    file_put_contents($path, $pdf);
}

/** Транслитерация для безопасных имён файлов из кириллицы. */
function pl_slug(string $s): string {
    $s = mb_strtolower($s, 'UTF-8');
    $map = ['а'=>'a','б'=>'b','в'=>'v','г'=>'g','д'=>'d','е'=>'e','ё'=>'e','ж'=>'zh','з'=>'z','и'=>'i','й'=>'y','к'=>'k','л'=>'l','м'=>'m','н'=>'n','о'=>'o','п'=>'p','р'=>'r','с'=>'s','т'=>'t','у'=>'u','ф'=>'f','х'=>'h','ц'=>'c','ч'=>'ch','ш'=>'sh','щ'=>'sch','ъ'=>'','ы'=>'y','ь'=>'','э'=>'e','ю'=>'yu','я'=>'ya',' '=>'-'];
    $s = strtr($s, $map);
    $s = preg_replace('/[^a-z0-9\-]+/', '-', $s);
    return trim(preg_replace('/-+/', '-', $s), '-') ?: 'file';
}
