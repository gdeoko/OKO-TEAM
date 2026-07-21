<?php
/**
 * core/pdf_diploma.php — генератор ДИПЛОМА (A4 ПОРТРЕТ, премиум).
 *
 * pdf_diploma(array $application, string $type='main'): string
 *   Строго вертикальный A4 (1240×1754, 150 dpi). Богатый фон с темой,
 *   ряд гербов из реальных ассетов, металлические золотые заголовки
 *   (pl_text_gold), блок данных, синяя печать + подписи, QR → /verify,
 *   футер «Российская Федерация, город Москва - ГГГГ».
 *
 *   Тема: $competition['diploma_bg'] (png-подложка) → $competition['diploma_theme']
 *   → авто по типу/направлению: black_gold (по умолчанию), white_baroque
 *   (благодарности/«талант»), patriotic (direction=patriotic).
 *
 *   Типы: main | named (лауреатская степень + данные) | extra (спец-награда,
 *   крупный титул) | thanks (благодарность, бело-барочная тема, ФИО синим).
 *
 *   Всё в try/catch, тихие фолбэки, сохранение в public/diplomas/.
 */
declare(strict_types=1);

require_once __DIR__ . '/pdf_lib.php';
require_once __DIR__ . '/qr.php';

/* ------------------------------------------------------------------ Темы --- */

/** Золотая двойная рамка + угловые завитки. */
function _dip_frame(\GdImage $img, array $gold): void {
    $w = imagesx($img); $h = imagesy($img);
    imagesetthickness($img, 4);
    $c = imagecolorallocate($img, $gold[0], $gold[1], $gold[2]);
    imagerectangle($img, 30, 30, $w - 30, $h - 30, $c);
    imagesetthickness($img, 2);
    imagerectangle($img, 44, 44, $w - 44, $h - 44, $c);
    imagesetthickness($img, 1);
    $g2 = imagecolorallocatealpha($img, $gold[0], $gold[1], $gold[2], 60);
    imagerectangle($img, 52, 52, $w - 52, $h - 52, $g2);
    pl_corner_gold($img, 70, 70, 46, $gold, 'tl');
    pl_corner_gold($img, $w - 70, 70, 46, $gold, 'tr');
    pl_corner_gold($img, 70, $h - 70, 46, $gold, 'bl');
    pl_corner_gold($img, $w - 70, $h - 70, 46, $gold, 'br');
}

/** Тема «чёрное золото» (основной диплом лауреата). */
function _dip_bg_black_gold(\GdImage $img): void {
    $w = imagesx($img); $h = imagesy($img);
    pl_fill($img, [7, 8, 12]);
    // мягкое сине-золотое свечение сверху-центр
    pl_glow($img, (int)($w / 2), 460, 620, 460, [24, 30, 58], 0.55);
    pl_glow($img, (int)($w / 2), 900, 460, 340, [40, 34, 14], 0.30);
    // нижняя графитовая панель под подписи (как в референсе)
    for ($y = (int)($h * 0.70); $y < $h; $y++) {
        $t = ($y - $h * 0.70) / ($h - $h * 0.70);
        $r = (int) round(14 + 42 * $t);
        $g = (int) round(15 + 44 * $t);
        $b = (int) round(20 + 52 * $t);
        imageline($img, 0, $y, $w, $y, imagecolorallocate($img, $r, $g, $b));
    }
    pl_noise($img, 8, 118, 2);
    _dip_frame($img, [176, 138, 58]);
}

/** Тема «бело-барочная» (благодарности, «Талант года»). */
function _dip_bg_white_baroque(\GdImage $img): void {
    $w = imagesx($img); $h = imagesy($img);
    pl_radial($img, [255, 253, 248], [226, 217, 201], 0.5, 0.42);
    // барочные «лепные» завитки по краям — мягкие светлые/золотые дуги
    for ($i = 0; $i < 26; $i++) {
        $side = ($i % 2 === 0) ? 0 : 1;
        $bx = $side ? mt_rand($w - 190, $w - 60) : mt_rand(60, 190);
        $by = mt_rand(120, $h - 120);
        $rr = mt_rand(40, 150);
        $wht = imagecolorallocatealpha($img, 255, 255, 255, mt_rand(80, 110));
        imagesetthickness($img, mt_rand(6, 14));
        imagearc($img, $bx, $by, $rr, $rr, mt_rand(0, 180), mt_rand(200, 360), $wht);
        $shd = imagecolorallocatealpha($img, 208, 196, 172, 108);
        imagearc($img, $bx + 4, $by + 4, $rr, $rr, mt_rand(0, 180), mt_rand(200, 360), $shd);
    }
    imagesetthickness($img, 1);
    // золотые «жемчужины»-акценты
    for ($i = 0; $i < 60; $i++) {
        $gx = (mt_rand(0, 1)) ? mt_rand(60, 210) : mt_rand($w - 210, $w - 60);
        $gy = mt_rand(120, $h - 120);
        $gc = imagecolorallocatealpha($img, 201, 164, 74, mt_rand(40, 120));
        imagefilledellipse($img, $gx, $gy, mt_rand(6, 16), mt_rand(6, 16), $gc);
    }
    pl_noise($img, 6, 120, 2);
    _dip_frame($img, [186, 150, 66]);
}

/** Тема «патриотическая» (тёмно-синий + триколор + золото). */
function _dip_bg_patriotic(\GdImage $img): void {
    $w = imagesx($img); $h = imagesy($img);
    pl_gradient($img, [16, 24, 56], [7, 11, 28]);
    pl_glow($img, (int)($w / 2), 520, 560, 420, [40, 40, 96], 0.45);
    pl_glow($img, (int)($w / 2), 900, 440, 320, [46, 38, 16], 0.28);
    // триколор-лента под гербами
    $ry = 372; $rx1 = 150; $rx2 = $w - 150; $bh = 9;
    foreach ([[245, 245, 250], [30, 60, 160], [200, 30, 45]] as $k => $col) {
        $c = imagecolorallocatealpha($img, $col[0], $col[1], $col[2], 24);
        imagefilledrectangle($img, $rx1, $ry + $k * $bh, $rx2, $ry + ($k + 1) * $bh, $c);
    }
    pl_noise($img, 8, 118, 2);
    _dip_frame($img, [190, 150, 62]);
}

/** Ряд гербов сверху (центральное лого КЦ крупнее, эмблемы по бокам). */
function _dip_herbs(\GdImage $img, string $dir): void {
    $w = imagesx($img);
    $put = function (string $f, int $x, int $y, ?int $ww, ?int $hh) use ($img, $dir) {
        if (is_file($dir . $f)) pl_image($img, $dir . $f, $x, $y, $ww, $hh, 100);
    };
    // центр — лого КЦ (крупно)
    $ms = 208; $put('logo_muzmir_main.png', (int)($w / 2 - $ms / 2), 150, $ms, $ms);
    // орлы по бокам от центра
    $put('emblem_minobrazovaniya.png', 330, 185, null, 150);
    $put('emblem_roskomnadzor.png', $w - 330 - 138, 185, null, 150);
    // верхние углы
    $put('prokultura_prok.png', 116, 178, 94, 94);
    $put('natsproekty_kultura.png', $w - 116 - 118, 172, 118, null);
    // нижние медальоны
    $put('logo_rossia_nota.png', 120, 292, 112, 112);
    $put('emblem_minkultury_rf.png', $w - 120 - 104, 300, null, 104);
}

/* ---------------------------------------------------------------- Данные --- */

/** Значение настройки подписанта с дефолтом (без хардкода на публичных страницах). */
function _dip_setting(string $key, string $default): string {
    if (function_exists('setting')) {
        try { $v = setting($key); if (is_string($v) && $v !== '') return $v; } catch (\Throwable $e) {}
    }
    return $default;
}

function pdf_diploma(array $application, string $type = 'main'): string {
    $tmpQr = '';
    try {
        $W = 1240; $H = 1754;                    // A4 портрет @150dpi
        $dir = BASE_PATH . '/public/assets/img/';
        $cX = (int)($W / 2);
        $mL = 118; $mR = $W - 118; $contentW = $mR - $mL;

        // --- конкурс (массив / БД) ---
        $competition = (string)($application['competition'] ?? '');
        $direction = (string)($application['direction'] ?? '');
        $themeSet = (string)($application['diploma_theme'] ?? '');
        $bgFile = (string)($application['diploma_bg'] ?? '');
        if (!empty($application['competition_id']) && function_exists('one')) {
            try {
                $c = one('SELECT name, direction, diploma_theme, diploma_bg FROM competitions WHERE id=?', [(int)$application['competition_id']]);
                if ($c) {
                    if ($competition === '') $competition = (string)$c['name'];
                    if ($direction === '')   $direction = (string)($c['direction'] ?? '');
                    if ($themeSet === '')    $themeSet = (string)($c['diploma_theme'] ?? '');
                    if ($bgFile === '')      $bgFile = (string)($c['diploma_bg'] ?? '');
                }
            } catch (\Throwable $e) {}
        }
        $competition = $competition ?: (function_exists('cfgv') ? (string)cfgv('org_name') : 'Музыкальный Мир');

        // --- тема ---
        $theme = $themeSet ?: '';
        if ($theme === '') {
            if ($type === 'thanks')                 $theme = 'white_baroque';
            elseif ($direction === 'patriotic')     $theme = 'patriotic';
            else                                    $theme = 'black_gold';
        }
        $isLight = ($theme === 'white_baroque');

        // палитра под тему
        $gold  = [201, 158, 62];
        if ($isLight) { $ink = [26, 40, 84]; $muted = [96, 90, 76]; $head = [22, 34, 74]; }
        else          { $ink = [238, 240, 246]; $muted = [176, 178, 188]; $head = [244, 246, 250]; }

        // --- получатель / данные ---
        $isGroup = (int)($application['is_group'] ?? 0) === 1;
        $recipient = trim((string)($isGroup ? ($application['group_name'] ?: $application['full_name']) : ($application['full_name'] ?? ''))) ?: 'Участник';

        $result = (string)($application['result'] ?? '');
        if ($result === '' && isset($application['score']) && $application['score'] !== null && $application['score'] !== '' && function_exists('score_to_result')) {
            $result = score_to_result((float)$application['score']);
        }
        $nomination = (string)($application['nomination'] ?? '');
        $sub = (string)($application['subgroup'] ?? '');
        if ($sub) $nomination = trim($nomination . ' / ' . $sub, ' /');
        $ageCat  = (string)($application['age_category'] ?? '');
        $teacher = (string)($application['teacher'] ?? '');
        $inst    = (string)($application['institution'] ?? '');
        $city    = (string)($application['city'] ?? '');
        $groupNm = (string)($application['group_name'] ?? '');
        $work    = (string)($application['work_title'] ?? '');

        // номер + дата
        $number = (string)($application['number'] ?? '');
        if ($number === '') $number = 'MM-' . date('Y') . '-' . str_pad((string)(($application['id'] ?? random_int(1, 999999))), 6, '0', STR_PAD_LEFT);
        $suffix = ['main' => '', 'extra' => '-D', 'named' => '-N', 'thanks' => '-T'][$type] ?? '';
        $dipNumber = $number . $suffix;
        $year = (int)date('Y', strtotime((string)($application['created_at'] ?? 'now')) ?: time());

        // спец-награда
        $special = mb_strtoupper((string)($application['special_award'] ?? 'За артистизм'), 'UTF-8');

        // --- холст + тема ---
        $img = imagecreatetruecolor($W, $H);
        if ($bgFile !== '') {
            $bgPath = is_file($bgFile) ? $bgFile : (BASE_PATH . '/public/' . ltrim($bgFile, '/'));
            $bg = pl_load($bgPath);
            if ($bg) {
                imagecopyresampled($img, $bg, 0, 0, 0, 0, $W, $H, imagesx($bg), imagesy($bg));
                imagedestroy($bg);
                _dip_frame($img, $gold);
            } else { $bgFile = ''; }
        }
        if ($bgFile === '') {
            match ($theme) {
                'white_baroque' => _dip_bg_white_baroque($img),
                'patriotic'     => _dip_bg_patriotic($img),
                default         => _dip_bg_black_gold($img),
            };
        }

        $fReg = pl_font('regular'); $fBold = pl_font('bold');
        $fSer = pl_font('serif');   $fSerB = pl_font('serif-bold');

        // --- шапка: организация + правовые основания ---
        pl_text($img, 0, 74, 30, $head, $fBold, 'Культурный центр «Музыкальный Мир»', 'center', $W);
        $legal = [
            'Зарегистрирован в официальном российском федеральном органе исполнительной власти Роскомнадзор от 24.06.2025 №094084',
            'Конкурс проводится на основании закона «Гражданский кодекс Российской Федерации (часть вторая)» от 26.01.1996',
            'N 14-ФЗ (ред. от 01.07.2021, с изм. от 08.07.2021) (с изм. и доп., вступ. в силу с 01.01.2022) ГК РФ Глава 57 - публичный конкурс.',
            'Выполнение указа Президента РФ «Об утверждении Основ государственной культурной политики» № 808 от 24 декабря 2014 года.',
        ];
        $ly = 100;
        foreach ($legal as $l) {
            $fs = 12;
            while ($fs > 9 && pl_text_w($fs, $fReg, $l) > $contentW + 40) $fs--;
            pl_text($img, 0, $ly, $fs, $muted, $fReg, $l, 'center', $W); $ly += 20;
        }

        // --- ряд гербов ---
        _dip_herbs($img, $dir);

        // --- тело ---
        $y = 408;
        pl_text($img, 0, $y, 25, $head, $fBold, 'Международный многожанровый конкурс', 'center', $W);
        $y += 22;

        // НАЗВАНИЕ КОНКУРСА (золото)
        $nameSize = 56;
        $nameLines = pl_wrap(mb_strtoupper($competition, 'UTF-8'), $nameSize, $fSerB, $contentW - 30);
        if (count($nameLines) > 2) { $nameSize = 44; $nameLines = pl_wrap(mb_strtoupper($competition, 'UTF-8'), $nameSize, $fSerB, $contentW - 30); }
        pl_glow($img, $cX, $y + 8 + (int)($nameSize * count($nameLines) / 2), (int)($contentW / 2), (int)($nameSize * count($nameLines) / 1.4), [120, 96, 30], $isLight ? 0.20 : 0.42);
        foreach ($nameLines as $ln) {
            $y += $nameSize + 6;
            pl_text_gold($img, $cX, $y, $nameSize, $fSerB, $ln, 'center', ['sparkle' => true]);
        }
        $y += 26;

        // при инф. поддержке
        foreach (['При информационной поддержке Министерства культуры и образования',
                  'субъектов Российской Федерации и государственного портала «Pro Культура»'] as $l) {
            pl_text($img, 0, $y, 21, $head, $fBold, $l, 'center', $W);
            $y += 28;
        }
        $y += 16;

        if ($type === 'thanks') {
            // ---- БЛАГОДАРНОСТЬ ----
            $y += 78;
            pl_text_gold($img, $cX, $y, 78, $fSerB, 'БЛАГОДАРНОСТЬ', 'center', ['sparkle' => true]);
            $y += 46;
            $who = $teacher !== '' ? $teacher : $recipient;
            pl_text_hand($img, $cX, $y + 40, 50, [30, 58, 150], $fSerB, $who, 'center');
            $y += 84;
            $bless = 'Культурный центр «Музыкальный Мир» и оргкомитет международного многожанрового '
                . 'конкурса культуры и искусства «' . $competition . '» при информационной поддержке '
                . 'Министерства культуры и образования субъектов Российской Федерации и государственного '
                . 'портала «Pro Культура» выражает Вам благодарность за высокий профессионализм и '
                . 'индивидуальный подход к раскрытию творческого потенциала Ваших учеников, а так же за '
                . 'целеустремлённость и деятельность по приобщению творческих поколений к культуре и '
                . 'искусству, посредством участия в международных культурных мероприятиях. Желаем Вам '
                . 'творческих успехов, процветания и новых побед!';
            foreach (pl_wrap($bless, 24, $fBold, $contentW - 40) as $ln) {
                pl_text($img, 0, $y, 24, $ink, $fBold, $ln, 'center', $W);
                $y += 34;
            }
        } else {
            // ---- ДИПЛОМ ----
            $y += 96;
            pl_glow($img, $cX, $y - 26, 320, 120, [130, 100, 30], $isLight ? 0.18 : 0.5);
            pl_text_gold($img, $cX, $y, 100, $fSerB, 'ДИПЛОМ', 'center', ['sparkle' => true]);
            $y += 30;

            // степень / спец-награда
            if ($type === 'extra') {
                $y += 58;
                pl_text_gold($img, $cX, $y, 58, $fSerB, $special, 'center', ['sparkle' => true]);
            } elseif ($result !== '') {
                $y += 58;
                pl_text_gold($img, $cX, $y, 58, $fSerB, mb_strtoupper($result, 'UTF-8'), 'center', ['sparkle' => true]);
            }
            $y += 44;

            // награждается + ФИО
            pl_text($img, 0, $y, 28, $head, $fBold, 'награждается:', 'center', $W);
            $y += 40;
            foreach (pl_wrap($recipient, 50, $fSerB, $contentW - 60) as $ln) {
                $y += 52;
                pl_text_gold($img, $cX, $y, 50, $fSerB, $ln, 'center', ['sparkle' => false]);
            }
            $y += 44;

            // блок данных
            $rows = [];
            if ($groupNm)    $rows[] = ['Название коллектива: ', $groupNm];
            if ($ageCat)     $rows[] = ['Возрастная категория: ', $ageCat];
            if ($nomination) $rows[] = ['Номинация: ', $nomination];
            if ($teacher)    $rows[] = ['Преподаватель: ', $teacher];
            if ($inst)       $rows[] = ['Название учреждения: ', trim($inst . ($city ? ', ' . $city : ''))];
            if ($work)       $rows[] = ['Конкурсный номер: ', $work];
            foreach ($rows as [$lab, $val]) {
                foreach (pl_wrap($lab . $val, 24, $fBold, $contentW - 10) as $ln) {
                    pl_text($img, 0, $y, 24, $ink, $fBold, $ln, 'center', $W);
                    $y += 38;
                }
            }
        }

        // --- подписанты / печать / подписи ---
        $s1n = _dip_setting('sign1_name', 'Галиулин Данил Дамирович');
        $s1d = _dip_setting('sign1_desc', 'Лауреат международных и всероссийских конкурсов и фестивалей, председатель оргкомитета международного конкурса культуры и искусства «' . $competition . '»');
        $s2n = _dip_setting('sign2_name', 'Ильясов Альберт Ильясович');
        $s2d = _dip_setting('sign2_desc', 'Лауреат международных и всероссийских конкурсов и фестивалей, заслуженный деятель культуры, генеральный директор Культурного центра «Музыкальный Мир»');

        $sigTop = 1408;
        $descW = 430;
        // подписант 1
        pl_text($img, $mL, $sigTop, 21, $head, $fBold, $s1n, 'left');
        pl_rule($img, $mL, $sigTop + 7, $mL + (int)pl_text_w(21, $fBold, $s1n), $ink, 1);
        $dy = $sigTop + 28;
        foreach (array_slice(pl_wrap($s1d, 16, $fReg, $descW), 0, 3) as $ln) { pl_text($img, $mL, $dy, 16, $muted, $fReg, $ln, 'left'); $dy += 22; }
        // подписант 2
        $sig2 = $sigTop + 110;
        pl_text($img, $mL, $sig2, 21, $head, $fBold, $s2n, 'left');
        pl_rule($img, $mL, $sig2 + 7, $mL + (int)pl_text_w(21, $fBold, $s2n), $ink, 1);
        $dy = $sig2 + 28;
        foreach (array_slice(pl_wrap($s2d, 16, $fReg, $descW), 0, 3) as $ln) { pl_text($img, $mL, $dy, 16, $muted, $fReg, $ln, 'left'); $dy += 22; }

        // подписи справа над линиями
        if (is_file($dir . 'podpis_albert.png')) pl_image($img, $dir . 'podpis_albert.png', 900, $sigTop - 4, 180, null, 100);
        pl_rule($img, 880, $sigTop + 46, 1096, $muted, 1);
        if (is_file($dir . 'podpis_2.png'))      pl_image($img, $dir . 'podpis_2.png', 906, $sig2 - 2, 172, null, 100);
        pl_rule($img, 880, $sig2 + 46, 1096, $muted, 1);

        // синяя печать по центру (перекрывает линии — как в референсе)
        if (is_file($dir . 'pechat_kc_muzmir.png')) pl_image($img, $dir . 'pechat_kc_muzmir.png', 600, $sigTop + 18, 200, 200, 100);

        // QR → проверка подлинности (нижний-левый угол над футером)
        $verifyUrl = rtrim((function_exists('cfgv') ? (string)cfgv('base_url') : ''), '/') . '/verify/' . rawurlencode($dipNumber);
        $tmpQr = sys_get_temp_dir() . '/qr_' . bin2hex(random_bytes(5)) . '.png';
        qr_png($verifyUrl, $tmpQr, 6, 2);
        $qrS = 82;
        $qrX = $mL; $qrY = $H - 150;
        // белая подложка под QR для читаемости на тёмных темах
        imagefilledrectangle($img, $qrX - 5, $qrY - 5, $qrX + $qrS + 5, $qrY + $qrS + 5, imagecolorallocate($img, 255, 255, 255));
        pl_image($img, $tmpQr, $qrX, $qrY, $qrS, $qrS, 100);
        pl_text($img, $qrX + $qrS + 12, $qrY + 30, 15, $muted, $fReg, 'Проверка подлинности', 'left');
        pl_text($img, $qrX + $qrS + 12, $qrY + 54, 14, $muted, $fReg, 'Диплом № ' . $dipNumber, 'left');

        // --- футер ---
        if ($isLight && is_file($dir . 'prokultura_full_horizontal.png')) {
            pl_image($img, $dir . 'prokultura_full_horizontal.png', $cX - 150, $H - 108, 300, null, 100);
            pl_text($img, 0, $H - 44, 24, $head, $fBold, 'Российская Федерация, город Москва - ' . $year, 'center', $W);
        } else {
            pl_text($img, 0, $H - 60, 27, $head, $fBold, 'Российская Федерация, город Москва - ' . $year, 'center', $W);
        }

        // --- сохранение ---
        $outDir = BASE_PATH . '/public/diplomas/';
        if (!is_dir($outDir)) @mkdir($outDir, 0775, true);
        $out = $outDir . 'diploma_' . pl_slug($dipNumber) . '.pdf';
        pl_pdf_from_images([$img], $out, 150, 92);
        imagedestroy($img);
        if ($tmpQr && is_file($tmpQr)) @unlink($tmpQr);
        return $out;
    } catch (\Throwable $e) {
        if ($tmpQr && is_file($tmpQr)) @unlink($tmpQr);
        error_log('pdf_diploma: ' . $e->getMessage());
        return '';
    }
}
