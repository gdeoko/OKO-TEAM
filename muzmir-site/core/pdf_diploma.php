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
    pl_corner_gold($img, 60, $h - 92, 30, $gold, 'bl');
    pl_corner_gold($img, $w - 60, $h - 92, 30, $gold, 'br');
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
    // центр — лого КЦ (крупно); опущено ниже правовых строк, чтобы не налазило
    $ms = 200; $put('logo_muzmir_main.png', (int)($w / 2 - $ms / 2), 168, $ms, $ms);
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

/**
 * Канонический номер диплома по базовому номеру заявки (CODE-ГГГГ-NNNNN) и типу.
 * Именно эту строку кодирует QR И записывает admin/diplomas.php в diplomas.number,
 * поэтому verify.php всегда находит запись. Спец-награды получают уникальный суффикс
 * -E{N} (N — позиция награды в справочнике), чтобы 8 наград одной заявки не конфликтовали.
 */
function diploma_make_number(string $base, string $type = 'main', int $extraIndex = 0): string {
    $base = trim($base);
    if ($base === '') {
        $base = 'MM-' . date('Y') . '-' . str_pad((string)random_int(1, 999999), 6, '0', STR_PAD_LEFT);
    }
    switch ($type) {
        /* ИМЕННОЙ — КАЖДОМУ УЧАСТНИКУ СВОЙ, ЗНАЧИТ И НОМЕР СВОЙ.
         * Номер был один на заявку: ансамбль заказал девять именных дипломов на
         * девять детей, а завести в реестре удалось ровно один — номер занят.
         * Первый сохраняет прежний вид, остальные получают -N2, -N3 и дальше. */
        case 'named':  return $base . '-N' . ($extraIndex > 1 ? $extraIndex : '');
        // У коллектива бывает два руководителя, и благодарность выписывается
        // каждому своя. Пока номер был один на заявку, вторая благодарность
        // просто не заводилась в реестре: номер занят, запись не создать, в
        // кабинете и в админке её нет, проверка подлинности ведёт на коллегу.
        // Первый педагог сохраняет прежний номер, второй и далее получают -T2, -T3.
        case 'thanks': return $base . '-T' . ($extraIndex > 1 ? $extraIndex : '');
        case 'extra':  return $base . '-E' . ($extraIndex > 0 ? $extraIndex : 1);
        case 'main':   return $base;
        default:       return $base . '-S';
    }
}

/**
 * НОМЕР ПОЛУЧАТЕЛЯ БЛАГОДАРНОСТИ в списке педагогов заявки (1 это первый, 0 это не найден).
 *
 * Единая точка расчёта: этим же индексом печатается номер на бланке
 * (/diploma-render) и заводится запись реестра (core/orders.php). Пока индекс
 * считался в двух местах по-разному, на бланке стоял «-T2», а в diplomas.number
 * лежал «-T-2», и QR с оплаченного бланка вёл в «диплом не найден».
 */
function diploma_person_index(string $teachers, string $person, int $fallback = 0): int {
    $person = trim($person);
    if ($person === '') return $fallback;
    if (!function_exists('_dh_teachers') && is_file(BASE_PATH . '/core/diploma_html.php')) {
        require_once BASE_PATH . '/core/diploma_html.php';
    }
    if (!function_exists('_dh_teachers')) return $fallback;
    [, $joined] = _dh_teachers($teachers);
    $list = array_values(array_filter(array_map('trim', explode(',', $joined)), static fn($x) => $x !== ''));
    foreach ($list as $i => $one) {
        if (mb_strtolower($one) === mb_strtolower($person)) return $i + 1;
    }
    return $fallback;
}

/** Арабские номера степеней → римские (ЛАУРЕАТ 1 степени → ЛАУРЕАТ I степени). */
function _dip_roman(string $s): string {
    $map = [1 => 'I', 2 => 'II', 3 => 'III', 4 => 'IV', 5 => 'V'];
    return (string)preg_replace_callback('/(?<!\d)([1-5])(?!\d)/u', static function ($m) use ($map) {
        return $map[(int)$m[1]] ?? $m[1];
    }, $s);
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
        /* ИМЕННОЙ ДИПЛОМ — НА ИМЯ РЕБЁНКА, А НЕ АНСАМБЛЯ.
         * Ради этого его и заказывают: диплом коллектива уже есть, а ребёнку нужен
         * свой, с фамилией. ФИО приходит из заказа — там его вводит руководитель. */
        $personOpt = trim((string)($application['person'] ?? ''));
        if ($type === 'named' && $personOpt !== '') $recipient = $personOpt;

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
        // Канонический номер: если админка передала diploma_number — используем ровно его
        // (он же записан в diplomas.number, его же кодирует QR → verify находит запись).
        $explicit = trim((string)($application['diploma_number'] ?? ''));
        if ($explicit !== '') {
            $dipNumber = $explicit;
        } else {
            $suffix = ['main' => '', 'extra' => '-D', 'named' => '-N', 'thanks' => '-T'][$type] ?? '-S';
            $dipNumber = $number . $suffix;
        }
        $year = (int)date('Y', strtotime((string)($application['created_at'] ?? 'now')) ?: time());

        // Типы: known = main|named|extra|thanks. Всё остальное трактуем как СПЕЦ-НАГРАДУ.
        $knownTypes = ['main', 'named', 'extra', 'thanks'];
        $isSpecial  = ($type === 'extra') || !in_array($type, $knownTypes, true);
        // Титул спец-награды: явный special_award → переданный result → сам $type → дефолт.
        $specialSrc = (string)($application['special_award'] ?? '');
        if ($specialSrc === '') {
            // СЫРОЙ КОД ТИПА НА БЛАНК НЕ ПЕЧАТАЕМ. Раньше сюда попадало само значение
            // $type — и на диплом крупным золотом выходило «MAIN_CLEAN», потому что
            // такого типа генератор не знает. Технический идентификатор не может быть
            // названием награды: берём результат заявки, а его нет — общее звание.
            $looksLikeCode = $type === '' || (bool) preg_match('~^[a-z0-9_\-]+$~', $type);
            if (!$looksLikeCode && !in_array($type, $knownTypes, true)) $specialSrc = $type;
            elseif ($result !== '')                                     $specialSrc = $result;
            else                                                        $specialSrc = 'За артистизм';
        }
        $special = mb_strtoupper($specialSrc, 'UTF-8');

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

        // при инф. поддержке — авто-подгон кегля под ширину контента
        foreach (['При информационной поддержке Министерства культуры и образования',
                  'субъектов Российской Федерации и государственного портала «Pro Культура»'] as $l) {
            $fs = 21;
            while ($fs > 13 && pl_text_w($fs, $fBold, $l) > $contentW) $fs--;
            pl_text($img, 0, $y, $fs, $head, $fBold, $l, 'center', $W);
            $y += 28;
        }
        $y += 16;

        if ($type === 'thanks') {
            // ---- БЛАГОДАРНОСТЬ ----
            $y += 78;
            pl_text_gold($img, $cX, $y, 78, $fSerB, 'БЛАГОДАРНОСТЬ', 'center', ['sparkle' => true]);
            $y += 46;
            /* Благодарность — ОДНОМУ педагогу, чьё ФИО указано в заказе.
             * Поле teacher в заявке бывает списком из двух руководителей, и
             * печатать его целиком нельзя: благодарность выписывается каждому
             * своя. Заявка остаётся запасным вариантом. */
            $who = $personOpt !== '' ? $personOpt : ($teacher !== '' ? $teacher : $recipient);
            // ФИО — синим рукописным: истинный курсив-serif если есть (shear=0), иначе эмуляция наклоном.
            $handFont  = pl_font_hand();
            $handShear = pl_font_hand_is_italic() ? 0.0 : 0.20;
            $hs = 56;
            while ($hs > 30 && pl_text_w($hs, $handFont, $who) > $contentW - 20) $hs--;
            pl_text_hand($img, $cX, $y + 40, $hs, [28, 56, 150], $handFont, $who, 'center', $handShear);
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

            // степень / спец-награда (авто-подгон кегля под ширину контента)
            $titleStr = $isSpecial ? $special : ($result !== '' ? _dip_roman(mb_strtoupper($result, 'UTF-8')) : '');
            if ($titleStr !== '') {
                $ts = 58;
                while ($ts > 34 && pl_text_w($ts, $fSerB, $titleStr) > $contentW - 20) $ts--;
                $y += $ts;
                pl_text_gold($img, $cX, $y, $ts, $fSerB, $titleStr, 'center', ['sparkle' => true]);
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
            // Название коллектива — как в референсе; не дублируем, если оно уже в «награждается».
            if ($groupNm !== '' && mb_strtolower(trim($groupNm), 'UTF-8') !== mb_strtolower(trim($recipient), 'UTF-8'))
                $rows[] = ['Название коллектива: ', $groupNm];
            if ($ageCat)     $rows[] = ['Возрастная категория: ', $ageCat];
            if ($nomination) $rows[] = ['Номинация: ', $nomination];
            // Сам себе педагог: имя не печатается дважды (см. diploma_html.php).
            if ($teacher && mb_strtolower(trim($teacher)) !== mb_strtolower(trim($recipient)))
                $rows[] = ['Преподаватель: ', $teacher];
            // Учреждение и город — разные строки: город в графе «Название
            // учреждения» превращал её в адрес на полторы строки.
            if ($inst) {
                // Город из названия — только служебным хвостом; см. institution_clean_city().
                if (!function_exists('institution_clean_city') && is_file(BASE_PATH . '/core/text_format.php')) {
                    require_once BASE_PATH . '/core/text_format.php';
                }
                $rows[] = ['Название учреждения: ', function_exists('institution_clean_city')
                    ? institution_clean_city($inst, $city) : $inst];
            }
            if ($city) {
                if (!function_exists('country_city_line') && is_file(BASE_PATH . '/core/text_format.php'))
                    require_once BASE_PATH . '/core/text_format.php';
                $cc = function_exists('country_city_line') ? country_city_line($city) : $city;
                if ($cc !== '') $rows[] = ['Страна, город: ', $cc];
            }
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
        $s1d = _dip_setting('sign1_desc', 'Председатель Оргкомитета');
        $s2n = _dip_setting('sign2_name', 'Ильясов Альберт Ильясович');
        $s2d = _dip_setting('sign2_desc', 'Генеральный директор Культурного центра «Музыкальный Мир», заслуженный деятель культуры');

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
            pl_text($img, 120, $H - 44, 24, $head, $fBold, 'Российская Федерация, город Москва - ' . $year, 'center', $W - 120);
        } else {
            pl_text($img, 120, $H - 56, 26, $head, $fBold, 'Российская Федерация, город Москва - ' . $year, 'center', $W - 120);
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
