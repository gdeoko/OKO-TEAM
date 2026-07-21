<?php
/**
 * core/pdf_diploma.php — генератор ДИПЛОМА (PDF + QR).
 *
 * pdf_diploma(array $application, string $type='main'): string
 *   Ландшафтный премиум-диплом A4. Поля: ФИО (или коллектив), звание по
 *   score_to_result(score), номинация, возрастная категория, педагог,
 *   учреждение, конкурс, дата, номер диплома, QR → cfgv('base_url')/verify/{number},
 *   печать и подпись. Подложка: competition.diploma_template (если задан) либо
 *   премиум-фон, сгенерированный программно. Сохраняет в public/diplomas/.
 *   Массовая генерация быстрая: фон собирается лёгкими GD-примитивами.
 *   Типы: main | extra | named | thanks. Тихие фолбэки, try/catch.
 */
declare(strict_types=1);

require_once __DIR__ . '/pdf_lib.php';
require_once __DIR__ . '/qr.php';

/** Строит премиум-фон диплома (ландшафт). */
function _diploma_bg(int $w, int $h, string $template = ''): \GdImage {
    $img = imagecreatetruecolor($w, $h);
    if ($template && is_file($template)) {
        $bg = pl_load($template);
        if ($bg) {
            imagecopyresampled($img, $bg, 0, 0, 0, 0, $w, $h, imagesx($bg), imagesy($bg));
            imagedestroy($bg);
            return $img;
        }
    }
    // программный премиум-фон: тёплое кремовое свечение
    pl_radial($img, [255, 253, 246], [244, 236, 220], 0.5, 0.42);
    // водяной знак-лого по центру (очень слабый)
    $logo = BASE_PATH . '/public/assets/img/logo_muzmir_main.png';
    if (is_file($logo)) {
        $ls = (int) round($h * 0.62);
        pl_image($img, $logo, (int)(($w - $ls) / 2), (int)(($h - $ls) / 2), $ls, $ls, 7);
    }
    // золотые рамки
    $gold = [176, 135, 58];
    pl_frame($img, 48, $gold, 4);
    // угловые ромбы
    $g = imagecolorallocate($img, $gold[0], $gold[1], $gold[2]);
    foreach ([[70, 70], [$w - 70, 70], [70, $h - 70], [$w - 70, $h - 70]] as [$cx, $cy]) {
        imagefilledpolygon($img, [$cx, $cy - 12, $cx + 12, $cy, $cx, $cy + 12, $cx - 12, $cy], $g);
    }
    return $img;
}

function pdf_diploma(array $application, string $type = 'main'): string {
    $tmpQr = '';
    try {
        $W = 1754; $H = 1240;   // A4 landscape @150dpi
        $imgDir = BASE_PATH . '/public/assets/img/';
        $navy = [18, 34, 58]; $gold = [166, 124, 46]; $ink = [40, 40, 44]; $muted = [92, 92, 100];

        // --- данные ---
        $isGroup = (int)($application['is_group'] ?? 0) === 1;
        $recipient = $isGroup
            ? ((string)($application['group_name'] ?: $application['full_name']))
            : (string)($application['full_name'] ?? 'Участник');
        $recipient = trim($recipient) ?: 'Участник';

        $result = (string)($application['result'] ?? '');
        if ($result === '' && isset($application['score']) && $application['score'] !== null && $application['score'] !== '') {
            $result = score_to_result((float)$application['score']);
        }
        $nomination = (string)($application['nomination'] ?? '');
        $sub        = (string)($application['subgroup'] ?? '');
        if ($sub) $nomination = trim($nomination . ' / ' . $sub, ' /');
        $ageCat  = (string)($application['age_category'] ?? '');
        $teacher = (string)($application['teacher'] ?? '');
        $inst    = (string)($application['institution'] ?? '');
        $city    = (string)($application['city'] ?? '');

        // конкурс: из массива или из БД по competition_id
        $competition = (string)($application['competition'] ?? '');
        if ($competition === '' && !empty($application['competition_id']) && function_exists('one')) {
            try {
                $c = one('SELECT name FROM competitions WHERE id=?', [(int)$application['competition_id']]);
                if ($c) $competition = (string)$c['name'];
            } catch (\Throwable $e) { /* тихо */ }
        }
        $competition = $competition ?: cfgv('org_name');

        // номер диплома и дата
        $number = (string)($application['number'] ?? '');
        if ($number === '') $number = 'MM-' . date('Y') . '-' . str_pad((string)(($application['id'] ?? random_int(1, 999999))), 6, '0', STR_PAD_LEFT);
        $suffix = ['main' => '', 'extra' => '-D', 'named' => '-N', 'thanks' => '-T'][$type] ?? '';
        $dipNumber = $number . $suffix;
        $date = ru_date($application['created_at'] ?? date('Y-m-d'));

        // --- фон ---
        $template = '';
        if (!empty($application['diploma_template'])) $template = (string)$application['diploma_template'];
        elseif (!empty($application['competition_id']) && function_exists('one')) {
            try {
                $c = one('SELECT diploma_template FROM competitions WHERE id=?', [(int)$application['competition_id']]);
                if ($c && $c['diploma_template']) {
                    $t = $c['diploma_template'];
                    $template = is_file($t) ? $t : (BASE_PATH . '/public/' . ltrim($t, '/'));
                }
            } catch (\Throwable $e) { /* тихо */ }
        }
        $img = _diploma_bg($W, $H, $template);

        // --- шапка: логотипы ---
        pl_image($img, $imgDir . 'emblem_minkultury_rf.png', 130, 96, null, 84);
        pl_image($img, $imgDir . 'logo_muzmir_main.png', $W - 130 - 84, 96, 84, 84);
        pl_text($img, 0, 128, 20, $muted, pl_font('regular'), cfgv('org_full'), 'center', $W);
        pl_text($img, 0, 156, 15, $muted, pl_font('regular'), 'Регистрация ' . cfgv('org_reg'), 'center', $W);

        // --- заголовок ---
        $thanks = ($type === 'thanks');
        $titleText = $thanks ? 'БЛАГОДАРСТВЕННОЕ ПИСЬМО' : 'ДИПЛОМ';
        pl_text_spaced($img, 0, 268, $thanks ? 58 : 76, $navy, pl_font('serif-bold'), $titleText, $thanks ? 8 : 14, 'center', $W);
        pl_rule($img, (int)($W/2 - 120), 300, (int)($W/2 + 120), $gold, 3);

        // звание (для наградных типов)
        $y = 360;
        if (!$thanks && $result !== '') {
            pl_text_spaced($img, 0, $y + 34, 34, $gold, pl_font('serif-bold'), mb_strtoupper($result, 'UTF-8'), 4, 'center', $W);
            $y += 70;
        }

        // «награждается / выражается благодарность»
        $lead = $thanks ? 'выражается благодарность' : 'награждается';
        pl_text($img, 0, $y + 22, 24, $muted, pl_font('serif'), $lead, 'center', $W);
        $y += 54;

        // получатель (ФИО / коллектив / педагог для благодарности)
        $who = $thanks ? ($teacher ?: $recipient) : $recipient;
        $whoSize = 52;
        foreach (pl_wrap($who, $whoSize, pl_font('serif-bold'), $W - 320) as $ln) {
            pl_text($img, 0, $y + $whoSize, $whoSize, $navy, pl_font('serif-bold'), $ln, 'center', $W);
            $y += $whoSize + 8;
        }
        $y += 14;

        // подробности
        $details = [];
        if ($thanks) {
            $details[] = 'за подготовку участника конкурса';
        } else {
            if ($nomination) $details[] = 'в номинации «' . $nomination . '»';
            if ($ageCat)     $details[] = 'возрастная категория: ' . $ageCat;
        }
        foreach ($details as $d) {
            pl_text($img, 0, $y + 24, 24, $ink, pl_font('regular'), $d, 'center', $W);
            $y += 38;
        }
        $y += 6;
        // конкурс
        foreach (pl_wrap((($thanks) ? '' : '') . $competition, 28, pl_font('serif-bold'), $W - 400) as $ln) {
            pl_text($img, 0, $y + 28, 28, $gold, pl_font('serif-bold'), $ln, 'center', $W);
            $y += 40;
        }
        // педагог / учреждение (для наградных)
        if (!$thanks) {
            $meta = [];
            if ($teacher) $meta[] = 'Педагог: ' . $teacher;
            if ($inst)    $meta[] = $inst . ($city ? ', ' . $city : '');
            foreach ($meta as $m) {
                pl_text($img, 0, $y + 22, 21, $muted, pl_font('regular'), $m, 'center', $W);
                $y += 32;
            }
        }

        // --- подвал: дата/номер слева, QR справа, печать+подпись ---
        $baseY = $H - 210;
        // дата и номер
        pl_text($img, 150, $baseY + 20, 22, $ink, pl_font('regular'), 'Дата выдачи: ' . $date);
        pl_text($img, 150, $baseY + 56, 20, $muted, pl_font('regular'), 'Диплом № ' . $dipNumber);
        pl_rule($img, 150, $baseY - 6, 470, $gold, 1);

        // QR → проверка
        $verifyUrl = rtrim((string)cfgv('base_url'), '/') . '/verify/' . rawurlencode($dipNumber);
        $tmpQr = sys_get_temp_dir() . '/qr_' . bin2hex(random_bytes(5)) . '.png';
        qr_png($verifyUrl, $tmpQr, 8, 2);
        $qrS = 150;
        pl_image($img, $tmpQr, (int)($W/2 - $qrS/2), $baseY - 26, $qrS, $qrS);
        pl_text($img, 0, $baseY + 150, 15, $muted, pl_font('regular'), 'Проверка подлинности', 'center', $W);

        // подпись + печать справа
        pl_text($img, $W - 470, $baseY + 6, 20, $navy, pl_font('serif-bold'), 'Оргкомитет', 'left');
        if (is_file($imgDir . 'podpis_albert.png'))
            pl_image($img, $imgDir . 'podpis_albert.png', $W - 470, $baseY + 12, 180, null);
        if (is_file($imgDir . 'pechat_kc_muzmir.png'))
            pl_image($img, $imgDir . 'pechat_kc_muzmir.png', $W - 260, $baseY - 40, 170, 170, 90);

        // --- сохранение ---
        $dir = BASE_PATH . '/public/diplomas/';
        if (!is_dir($dir)) @mkdir($dir, 0775, true);
        $out = $dir . 'diploma_' . pl_slug($dipNumber) . '.pdf';
        pl_pdf_from_images([$img], $out, 150, 90);
        imagedestroy($img);
        if ($tmpQr && is_file($tmpQr)) @unlink($tmpQr);
        return $out;
    } catch (\Throwable $e) {
        if ($tmpQr && is_file($tmpQr)) @unlink($tmpQr);
        error_log('pdf_diploma: ' . $e->getMessage());
        return '';
    }
}
