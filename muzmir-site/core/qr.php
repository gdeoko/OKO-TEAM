<?php
/**
 * core/qr.php — чистый PHP QR-энкодер (без внешних сервисов и composer).
 * Байтовый режим, уровень коррекции M, версии 1-10 (авто-выбор).
 * Полный конвейер: Рид-Соломон, размещение модулей, 8 масок, выбор лучшей.
 *
 * Публичные функции:
 *   qr_svg(string $data): string          — SVG-разметка QR (для инлайна в HTML).
 *   qr_png(string $data, string $path): void — PNG-файл (для вставки в PDF/GD).
 *   qr_matrix(string $data): array        — матрица 0/1 (внутреннее, для рендера).
 */
declare(strict_types=1);

/* ---------------------------------------------------------------------------
 * Таблицы уровня M для версий 1-10.
 * [версия => [ecPerBlock, [[blocks, dataPerBlock], ...]]]
 * ------------------------------------------------------------------------- */
function _qr_blocks_M(): array {
    return [
        1  => [10, [[1, 16]]],
        2  => [16, [[1, 28]]],
        3  => [26, [[1, 44]]],
        4  => [18, [[2, 32]]],
        5  => [24, [[2, 43]]],
        6  => [16, [[4, 27]]],
        7  => [18, [[4, 31]]],
        8  => [22, [[2, 38], [2, 39]]],
        9  => [22, [[3, 36], [2, 37]]],
        10 => [26, [[4, 43], [1, 44]]],
    ];
}
/** Центры выравнивающих узоров по версии. */
function _qr_align(int $v): array {
    static $t = [
        1 => [], 2 => [6, 18], 3 => [6, 22], 4 => [6, 26], 5 => [6, 30],
        6 => [6, 34], 7 => [6, 22, 38], 8 => [6, 24, 42], 9 => [6, 26, 46], 10 => [6, 28, 50],
    ];
    return $t[$v] ?? [];
}
/** Остаточные биты по версии. */
function _qr_remainder(int $v): int {
    static $t = [1=>0,2=>7,3=>7,4=>7,5=>7,6=>7,7=>0,8=>0,9=>0,10=>0];
    return $t[$v] ?? 0;
}
/** 15-битные строки информации о формате, уровень M, маски 0-7 (BCH готовые). */
function _qr_format_M(int $mask): int {
    static $t = [0x5412,0x5125,0x5E7C,0x5B4B,0x45F9,0x40CE,0x4F97,0x4AA0];
    return $t[$mask];
}
/** 18-битная информация о версии (v>=7). */
function _qr_version_info(int $v): int {
    static $t = [7=>0x07C94,8=>0x085BC,9=>0x09A99,10=>0x0A4D3];
    return $t[$v] ?? 0;
}

/* --------------------------- Галуа GF(256) -------------------------------- */
function _qr_gf(): array {
    static $exp = null, $log = null;
    if ($exp === null) {
        $exp = array_fill(0, 512, 0);
        $log = array_fill(0, 256, 0);
        $x = 1;
        for ($i = 0; $i < 255; $i++) {
            $exp[$i] = $x;
            $log[$x] = $i;
            $x <<= 1;
            if ($x & 0x100) $x ^= 0x11d;
        }
        for ($i = 255; $i < 512; $i++) $exp[$i] = $exp[$i - 255];
    }
    return [$exp, $log];
}
/** Reed-Solomon ECC для одного блока данных. */
function _qr_rs(array $data, int $ecLen): array {
    [$exp, $log] = _qr_gf();
    // генераторный полином
    $gen = [1];
    for ($i = 0; $i < $ecLen; $i++) {
        $next = array_fill(0, count($gen) + 1, 0);
        foreach ($gen as $j => $c) {
            $next[$j]     ^= $c;
            $next[$j + 1] ^= ($c ? $exp[($log[$c] + $i) % 255] : 0);
        }
        $gen = $next;
    }
    $res = array_merge($data, array_fill(0, $ecLen, 0));
    $n = count($data);
    for ($i = 0; $i < $n; $i++) {
        $coef = $res[$i];
        if ($coef === 0) continue;
        $lc = $log[$coef];
        foreach ($gen as $j => $g) {
            $res[$i + $j] ^= $exp[($log[$g] + $lc) % 255];
        }
    }
    return array_slice($res, $n, $ecLen);
}

/* ------------------------- Кодирование данных ----------------------------- */
function _qr_pick_version(int $len): int {
    foreach (_qr_blocks_M() as $v => [$ec, $groups]) {
        $dataCw = 0;
        foreach ($groups as [$b, $d]) $dataCw += $b * $d;
        $cci = ($v >= 10) ? 16 : 8;
        $cap = intdiv($dataCw * 8 - 4 - $cci, 8);
        if ($len <= $cap) return $v;
    }
    throw new RuntimeException('QR: данные слишком длинные (>216 байт)');
}

function qr_matrix(string $data): array {
    $len = strlen($data);
    $v = _qr_pick_version($len);
    [$ecLen, $groups] = _qr_blocks_M()[$v];
    $dataCw = 0;
    foreach ($groups as [$b, $d]) $dataCw += $b * $d;

    // --- битовый поток: режим 0100 + счётчик + данные ---
    $cci = ($v >= 10) ? 16 : 8;
    $bits = '0100';
    $bits .= str_pad(decbin($len), $cci, '0', STR_PAD_LEFT);
    for ($i = 0; $i < $len; $i++) {
        $bits .= str_pad(decbin(ord($data[$i])), 8, '0', STR_PAD_LEFT);
    }
    // терминатор
    $cap = $dataCw * 8;
    $term = min(4, $cap - strlen($bits));
    $bits .= str_repeat('0', max(0, $term));
    // до границы байта
    if (strlen($bits) % 8) $bits .= str_repeat('0', 8 - (strlen($bits) % 8));
    // паддинг-байты
    $pad = ['11101100', '00010001'];
    $pi = 0;
    while (strlen($bits) < $cap) { $bits .= $pad[$pi & 1]; $pi++; }

    // байты данных
    $dataBytes = [];
    for ($i = 0; $i < $cap; $i += 8) $dataBytes[] = bindec(substr($bits, $i, 8));

    // --- разбивка на блоки + ECC ---
    $dataBlocks = [];
    $ecBlocks = [];
    $pos = 0;
    foreach ($groups as [$b, $d]) {
        for ($k = 0; $k < $b; $k++) {
            $blk = array_slice($dataBytes, $pos, $d);
            $pos += $d;
            $dataBlocks[] = $blk;
            $ecBlocks[] = _qr_rs($blk, $ecLen);
        }
    }
    // --- интерливинг ---
    $final = [];
    $maxData = 0;
    foreach ($dataBlocks as $blk) $maxData = max($maxData, count($blk));
    for ($i = 0; $i < $maxData; $i++) {
        foreach ($dataBlocks as $blk) if ($i < count($blk)) $final[] = $blk[$i];
    }
    for ($i = 0; $i < $ecLen; $i++) {
        foreach ($ecBlocks as $blk) $final[] = $blk[$i];
    }
    // финальный битовый поток + остаточные биты
    $stream = '';
    foreach ($final as $byte) $stream .= str_pad(decbin($byte), 8, '0', STR_PAD_LEFT);
    $stream .= str_repeat('0', _qr_remainder($v));

    // --- построение матрицы ---
    $n = 17 + 4 * $v;
    $m = array_fill(0, $n, array_fill(0, $n, 0));   // модули 0/1
    $fn = array_fill(0, $n, array_fill(0, $n, false)); // функциональные (нельзя маскировать)

    $setFinder = function ($r, $c) use (&$m, &$fn, $n) {
        for ($dr = -1; $dr <= 7; $dr++) {
            for ($dc = -1; $dc <= 7; $dc++) {
                $rr = $r + $dr; $cc = $c + $dc;
                if ($rr < 0 || $rr >= $n || $cc < 0 || $cc >= $n) continue;
                $in = ($dr >= 0 && $dr <= 6 && $dc >= 0 && $dc <= 6);
                $dark = $in && (($dr == 0 || $dr == 6 || $dc == 0 || $dc == 6) ||
                                ($dr >= 2 && $dr <= 4 && $dc >= 2 && $dc <= 4));
                $m[$rr][$cc] = $dark ? 1 : 0;
                $fn[$rr][$cc] = true;
            }
        }
    };
    $setFinder(0, 0);
    $setFinder(0, $n - 7);
    $setFinder($n - 7, 0);

    // timing
    for ($i = 8; $i < $n - 8; $i++) {
        $b = ($i % 2 == 0) ? 1 : 0;
        if (!$fn[6][$i]) { $m[6][$i] = $b; $fn[6][$i] = true; }
        if (!$fn[$i][6]) { $m[$i][6] = $b; $fn[$i][6] = true; }
    }

    // alignment
    $ap = _qr_align($v);
    foreach ($ap as $ar) {
        foreach ($ap as $ac) {
            // не поверх finder
            if (($ar <= 8 && $ac <= 8) || ($ar <= 8 && $ac >= $n - 9) || ($ar >= $n - 9 && $ac <= 8)) continue;
            for ($dr = -2; $dr <= 2; $dr++) {
                for ($dc = -2; $dc <= 2; $dc++) {
                    $rr = $ar + $dr; $cc = $ac + $dc;
                    $dark = (max(abs($dr), abs($dc)) != 1) ? 1 : 0;
                    $m[$rr][$cc] = $dark;
                    $fn[$rr][$cc] = true;
                }
            }
        }
    }

    // тёмный модуль
    $m[$n - 8][8] = 1; $fn[$n - 8][8] = true;

    // резерв под формат (метим функциональными)
    for ($i = 0; $i <= 8; $i++) {
        if (!$fn[8][$i]) $fn[8][$i] = true;
        if (!$fn[$i][8]) $fn[$i][8] = true;
    }
    for ($i = 0; $i < 8; $i++) {
        $fn[8][$n - 1 - $i] = true;
        $fn[$n - 1 - $i][8] = true;
    }

    // резерв под версию (v>=7)
    if ($v >= 7) {
        for ($i = 0; $i < 6; $i++) {
            for ($j = 0; $j < 3; $j++) {
                $fn[$n - 11 + $j][$i] = true;
                $fn[$i][$n - 11 + $j] = true;
            }
        }
    }

    // --- размещение данных зигзагом ---
    $bitIdx = 0;
    $blen = strlen($stream);
    $col = $n - 1;
    $up = true;
    while ($col > 0) {
        if ($col == 6) $col--; // пропуск timing-столбца
        for ($i = 0; $i < $n; $i++) {
            $row = $up ? ($n - 1 - $i) : $i;
            for ($c = 0; $c < 2; $c++) {
                $cc = $col - $c;
                if ($fn[$row][$cc]) continue;
                $bit = ($bitIdx < $blen) ? (int)$stream[$bitIdx] : 0;
                $bitIdx++;
                $m[$row][$cc] = $bit;
            }
        }
        $col -= 2;
        $up = !$up;
    }

    // --- выбор маски ---
    $best = null; $bestPenalty = PHP_INT_MAX; $bestMask = 0;
    for ($mask = 0; $mask < 8; $mask++) {
        $cand = $m;
        for ($r = 0; $r < $n; $r++) {
            for ($c = 0; $c < $n; $c++) {
                if ($fn[$r][$c]) continue;
                if (_qr_mask($mask, $r, $c)) $cand[$r][$c] ^= 1;
            }
        }
        _qr_place_format($cand, $n, _qr_format_M($mask));
        if ($v >= 7) _qr_place_version($cand, $n, _qr_version_info($v));
        $p = _qr_penalty($cand, $n);
        if ($p < $bestPenalty) { $bestPenalty = $p; $best = $cand; $bestMask = $mask; }
    }
    return $best;
}

function _qr_mask(int $mask, int $r, int $c): bool {
    switch ($mask) {
        case 0: return ($r + $c) % 2 == 0;
        case 1: return $r % 2 == 0;
        case 2: return $c % 3 == 0;
        case 3: return ($r + $c) % 3 == 0;
        case 4: return (intdiv($r, 2) + intdiv($c, 3)) % 2 == 0;
        case 5: return (($r * $c) % 2) + (($r * $c) % 3) == 0;
        case 6: return (((($r * $c) % 2) + (($r * $c) % 3)) % 2) == 0;
        case 7: return (((($r + $c) % 2) + (($r * $c) % 3)) % 2) == 0;
    }
    return false;
}

function _qr_place_format(array &$m, int $n, int $fmt): void {
    for ($i = 0; $i <= 5; $i++)  $m[8][$i] = ($fmt >> $i) & 1;
    $m[8][7] = ($fmt >> 6) & 1;
    $m[8][8] = ($fmt >> 7) & 1;
    $m[7][8] = ($fmt >> 8) & 1;
    for ($i = 9; $i <= 14; $i++) $m[14 - $i][8] = ($fmt >> $i) & 1;
    // копия 2
    for ($i = 0; $i <= 6; $i++)  $m[$n - 1 - $i][8] = ($fmt >> $i) & 1;
    for ($i = 7; $i <= 14; $i++) $m[8][$n - 15 + $i] = ($fmt >> $i) & 1;
}

function _qr_place_version(array &$m, int $n, int $vinfo): void {
    for ($i = 0; $i < 18; $i++) {
        $bit = ($vinfo >> $i) & 1;
        $a = intdiv($i, 3); $b = $i % 3;
        $m[$n - 11 + $b][$a] = $bit;
        $m[$a][$n - 11 + $b] = $bit;
    }
}

function _qr_penalty(array $m, int $n): int {
    $p = 0;
    // правило 1: ряды >=5 подряд
    for ($r = 0; $r < $n; $r++) {
        $run = 1;
        for ($c = 1; $c < $n; $c++) {
            if ($m[$r][$c] == $m[$r][$c - 1]) { $run++; }
            else { if ($run >= 5) $p += 3 + ($run - 5); $run = 1; }
        }
        if ($run >= 5) $p += 3 + ($run - 5);
    }
    for ($c = 0; $c < $n; $c++) {
        $run = 1;
        for ($r = 1; $r < $n; $r++) {
            if ($m[$r][$c] == $m[$r - 1][$c]) { $run++; }
            else { if ($run >= 5) $p += 3 + ($run - 5); $run = 1; }
        }
        if ($run >= 5) $p += 3 + ($run - 5);
    }
    // правило 2: блоки 2x2
    for ($r = 0; $r < $n - 1; $r++) {
        for ($c = 0; $c < $n - 1; $c++) {
            $v = $m[$r][$c];
            if ($v == $m[$r][$c + 1] && $v == $m[$r + 1][$c] && $v == $m[$r + 1][$c + 1]) $p += 3;
        }
    }
    // правило 3: паттерн 1:1:3:1:1
    $pat1 = [1,0,1,1,1,0,1,0,0,0,0];
    $pat2 = [0,0,0,0,1,0,1,1,1,0,1];
    for ($r = 0; $r < $n; $r++) {
        for ($c = 0; $c <= $n - 11; $c++) {
            $ok1 = true; $ok2 = true;
            for ($k = 0; $k < 11; $k++) {
                if ($m[$r][$c + $k] != $pat1[$k]) $ok1 = false;
                if ($m[$r][$c + $k] != $pat2[$k]) $ok2 = false;
            }
            if ($ok1 || $ok2) $p += 40;
        }
    }
    for ($c = 0; $c < $n; $c++) {
        for ($r = 0; $r <= $n - 11; $r++) {
            $ok1 = true; $ok2 = true;
            for ($k = 0; $k < 11; $k++) {
                if ($m[$r + $k][$c] != $pat1[$k]) $ok1 = false;
                if ($m[$r + $k][$c] != $pat2[$k]) $ok2 = false;
            }
            if ($ok1 || $ok2) $p += 40;
        }
    }
    // правило 4: баланс тёмных
    $dark = 0;
    for ($r = 0; $r < $n; $r++) for ($c = 0; $c < $n; $c++) $dark += $m[$r][$c];
    $ratio = $dark * 100 / ($n * $n);
    $p += (int)(floor(abs($ratio - 50) / 5) * 10);
    return $p;
}

/* ------------------------------ Рендер ------------------------------------ */
/** Возвращает SVG QR-кода (масштаб/тихая зона встроены). */
function qr_svg(string $data): string {
    try {
        $m = qr_matrix($data);
    } catch (\Throwable $e) {
        return '<svg xmlns="http://www.w3.org/2000/svg" width="120" height="120"></svg>';
    }
    $n = count($m);
    $quiet = 4;
    $size = $n + 2 * $quiet;
    $scale = 8;
    $px = $size * $scale;
    $rects = '';
    for ($r = 0; $r < $n; $r++) {
        for ($c = 0; $c < $n; $c++) {
            if ($m[$r][$c]) {
                $x = ($c + $quiet) * $scale;
                $y = ($r + $quiet) * $scale;
                $rects .= "<rect x=\"$x\" y=\"$y\" width=\"$scale\" height=\"$scale\"/>";
            }
        }
    }
    return "<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"$px\" height=\"$px\" viewBox=\"0 0 $px $px\" shape-rendering=\"crispEdges\">"
         . "<rect width=\"$px\" height=\"$px\" fill=\"#ffffff\"/><g fill=\"#000000\">$rects</g></svg>";
}

/** Пишет PNG QR-кода в $path (для вставки в PDF/GD). */
function qr_png(string $data, string $path, int $scale = 10, int $quiet = 4): void {
    try {
        $m = qr_matrix($data);
        $n = count($m);
        $size = ($n + 2 * $quiet) * $scale;
        $img = imagecreatetruecolor($size, $size);
        $white = imagecolorallocate($img, 255, 255, 255);
        $black = imagecolorallocate($img, 0, 0, 0);
        imagefilledrectangle($img, 0, 0, $size, $size, $white);
        for ($r = 0; $r < $n; $r++) {
            for ($c = 0; $c < $n; $c++) {
                if ($m[$r][$c]) {
                    $x = ($c + $quiet) * $scale;
                    $y = ($r + $quiet) * $scale;
                    imagefilledrectangle($img, $x, $y, $x + $scale - 1, $y + $scale - 1, $black);
                }
            }
        }
        $dir = dirname($path);
        if (!is_dir($dir)) @mkdir($dir, 0775, true);
        imagepng($img, $path);
        imagedestroy($img);
    } catch (\Throwable $e) {
        // тихий фолбэк: пустой PNG-плейсхолдер
        $img = imagecreatetruecolor(120, 120);
        $w = imagecolorallocate($img, 255, 255, 255);
        imagefilledrectangle($img, 0, 0, 120, 120, $w);
        @imagepng($img, $path);
        imagedestroy($img);
    }
}
