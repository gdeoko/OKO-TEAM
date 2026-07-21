<?php
/** Генератор афиш КЦ «Музыкальный Мир»: 5 типов × 3 формата, GD, премиум тёмно-золотой стиль. */
declare(strict_types=1);
require_once __DIR__ . '/pdf_lib.php';
require_once __DIR__ . '/qr.php';

/** @return array{w:int,h:int} */
function poster_dims(string $format): array {
    return match ($format) {
        '16x9' => ['w' => 1280, 'h' => 720],
        '9x16' => ['w' => 1080, 'h' => 1920],
        default => ['w' => 1080, 'h' => 1080], // 1x1
    };
}

function poster_headline(string $type): array {
    // [надзаголовок, крупный заголовок, акцентный цвет]
    return match ($type) {
        '5days'   => ['До завершения приёма', 'ОСТАЛОСЬ 5 ДНЕЙ'],
        '3days'   => ['До завершения приёма', 'ОСТАЛОСЬ 3 ДНЯ'],
        'lastday' => ['Успейте подать заявку', 'ПОСЛЕДНИЙ ДЕНЬ ПРИЁМА'],
        'results' => ['Итоги подведены', 'РЕЗУЛЬТАТЫ КОНКУРСА'],
        default   => ['Приглашаем к участию', 'ПРИЁМ ЗАЯВОК ОТКРЫТ'],
    };
}

/**
 * Собирает афишу и возвращает путь к PNG.
 * @param array $competition строка из таблицы competitions
 */
function poster_generate(array $competition, string $type = 'open', string $format = '1x1'): string {
    try {
        $d = poster_dims($format);
        $W = $d['w']; $H = $d['h'];
        $img = imagecreatetruecolor($W, $H);

        // Фон: глубокий тёмно-синий → почти чёрный с золотым сиянием
        pl_gradient($img, [26, 30, 54], [8, 9, 18]);
        pl_radial($img, [46, 42, 24], [10, 11, 22], 0.5, 0.30);

        $gold = [201, 168, 76];
        $goldLight = [230, 200, 120];
        $cream = [250, 246, 238];
        $muted = [170, 172, 190];

        $scale = min($W, $H) / 1080.0;
        $s = fn($v) => (int) round($v * $scale);

        // Рамка
        pl_frame($img, $s(38), $gold, max(2, $s(3)));

        // Логотип КЦ сверху по центру
        $logo = BASE_PATH . '/public/assets/img/logo_muzmir_256.png';
        $logoSize = $s(150);
        $topY = $s(70);
        if (is_file($logo)) {
            pl_image($img, $logo, ($W - $logoSize) >> 1, $topY, $logoSize, $logoSize, 100);
        }

        $bold = pl_font('bold');
        $reg = pl_font('regular');
        $y = $topY + $logoSize + $s(34);

        // Организация
        pl_text($img, $W >> 1, $y, $s(24), $cream, $bold, 'КУЛЬТУРНЫЙ ЦЕНТР «МУЗЫКАЛЬНЫЙ МИР»', 'center');
        $y += $s(52);

        // Надзаголовок / заголовок по типу
        [$eyebrow, $head] = poster_headline($type);
        pl_text_spaced($img, $W >> 1, $y, $s(20), $gold, $reg, mb_strtoupper($eyebrow), 3.0, 'center');
        $y += $s(46);

        // Крупный заголовок (перенос)
        $lines = pl_wrap($head, $s(58), $bold, $W - $s(160));
        foreach ($lines as $ln) {
            pl_text($img, $W >> 1, $y, $s(58), $goldLight, $bold, $ln, 'center');
            $y += $s(66);
        }
        $y += $s(18);

        // Золотой разделитель
        pl_rule($img, $s(120), $y, $W - $s(120), $gold, max(1, $s(2)));
        $y += $s(40);

        // Название конкурса
        $nameLines = pl_wrap((string) $competition['name'], $s(52), $bold, $W - $s(150));
        foreach ($nameLines as $ln) {
            pl_text($img, $W >> 1, $y, $s(52), $cream, $bold, $ln, 'center');
            $y += $s(62);
        }
        $y += $s(8);

        // Тип конкурса
        $ctype = ($competition['type'] ?? 'international') === 'international' ? 'Международный конкурс' : 'Всероссийский конкурс';
        pl_text($img, $W >> 1, $y, $s(26), $muted, $reg, $ctype, 'center');
        $y += $s(56);

        // Даты / дедлайн
        if (in_array($type, ['5days', '3days', 'lastday'], true) && !empty($competition['end_date'])) {
            $days = max(0, (int) floor((strtotime($competition['end_date']) - time()) / 86400));
            $daysTxt = $type === 'lastday' ? 'Сегодня последний день' : "Осталось дней: $days";
            pl_text($img, $W >> 1, $y, $s(30), $goldLight, $bold, $daysTxt, 'center');
            $y += $s(50);
        }
        if (!empty($competition['end_date'])) {
            $end = date('d.m.Y', strtotime($competition['end_date']));
            pl_text($img, $W >> 1, $y, $s(24), $cream, $reg, "Приём заявок до $end", 'center');
            $y += $s(46);
        }

        // QR внизу → страница конкурса или сайт
        $base = rtrim((string) cfgv('base_url'), '/');
        $slug = $competition['slug'] ?? '';
        $qrData = $slug ? "$base/competition/$slug" : "$base/";
        $qrTmp = sys_get_temp_dir() . '/poster_qr_' . md5($qrData) . '.png';
        try {
            qr_png($qrData, $qrTmp);
            $qrSize = $s(150);
            $qrY = $H - $s(60) - $qrSize;
            // белая подложка под QR
            $wc = imagecolorallocate($img, 255, 255, 255);
            imagefilledrectangle($img, ($W - $qrSize) >> 1 | 0, $qrY - $s(10), (($W - $qrSize) >> 1) + $qrSize + $s(10), $qrY + $qrSize + $s(10), $wc);
            pl_image($img, $qrTmp, ($W - $qrSize) >> 1, $qrY, $qrSize, $qrSize, 100);
            pl_text($img, $W >> 1, $qrY + $qrSize + $s(20), $s(18), $muted, $reg, 'музыкальный-мир.рф', 'center');
            @unlink($qrTmp);
        } catch (\Throwable $e) { /* без QR не критично */ }

        $dir = BASE_PATH . '/public/posters';
        if (!is_dir($dir)) mkdir($dir, 0775, true);
        $out = $dir . '/poster_' . pl_slug($slug ?: 'competition') . "_{$type}_{$format}.png";
        imagepng($img, $out, 6);
        imagedestroy($img);
        return $out;
    } catch (\Throwable $e) {
        error_log('poster_generate: ' . $e->getMessage());
        return '';
    }
}
