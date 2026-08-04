<?php
/**
 * core/passport.php — «Паспорт участника» Культурного центра «Музыкальный Мир».
 *
 * passport_pdf(int $userId): string
 *   Собирает ВСЕ дипломы пользователя в ОДИН многостраничный PDF:
 *     стр.1 — титул (ФИО, сводка: кол-во дипломов, конкурсы, звания, общий QR);
 *     стр.2..N — страницы каждого диплома.
 *
 *   Страницы дипломов НЕ рисуются заново: переиспользуется существующий генератор
 *   pdf_diploma() (core/pdf_diploma.php). Он отдаёт одностраничный PDF, куда
 *   страница вшита как JPEG (/DCTDecode) через pl_pdf_from_images(). Отсюда
 *   извлекается JPEG обратно в GD-изображение, и все изображения (титул + дипломы)
 *   склеиваются тем же pl_pdf_from_images() в единый паспорт.
 *
 *   Всё в try/catch, тихие фолбэки. Возвращает путь к файлу или '' при неудаче.
 */
declare(strict_types=1);

require_once __DIR__ . '/pdf_lib.php';
require_once __DIR__ . '/pdf_diploma.php';
require_once __DIR__ . '/qr.php';

/**
 * Достаёт вшитую в одностраничный диплом-PDF картинку (JPEG /DCTDecode) обратно
 * в GD-изображение. Формат PDF детерминирован — его пишет pl_pdf_from_images().
 */
function _passport_page_from_pdf(string $pdfPath): ?\GdImage {
    if ($pdfPath === '' || !is_file($pdfPath)) return null;
    $raw = @file_get_contents($pdfPath);
    if ($raw === false || $raw === '') return null;
    // Ищем image-XObject с фильтром DCTDecode и его длиной, затем сам поток.
    if (!preg_match('#/Subtype\s*/Image\b.*?/Filter\s*/DCTDecode.*?/Length\s+(\d+)\s*>>\s*stream\r?\n#s', $raw, $m, PREG_OFFSET_CAPTURE)) {
        return null;
    }
    $len   = (int) $m[1][0];
    $start = $m[0][1] + strlen($m[0][0]);
    $jpeg  = substr($raw, $start, $len);
    if ($jpeg === '') return null;
    $img = @imagecreatefromstring($jpeg);
    return ($img instanceof \GdImage) ? $img : null;
}

/** Страница диплома как GD: сперва по сохранённому pdf_path, иначе — свежая генерация. */
function _passport_render_diploma(array $diploma): ?\GdImage {
    // 1) Готовый PDF из diplomas.pdf_path (если это локальный файл).
    $stored = trim((string)($diploma['pdf_path'] ?? ''));
    if ($stored !== '' && !preg_match('#^https?://#i', $stored) && is_file($stored)) {
        $img = _passport_page_from_pdf($stored);
        if ($img) return $img;
    }
    // 2) Пересобираем через существующий генератор диплома.
    if (!function_exists('pdf_diploma')) return null;
    $appId = (int)($diploma['application_id'] ?? 0);
    if ($appId <= 0) return null;
    $app = one("SELECT a.*, c.code FROM applications a
                LEFT JOIN competitions c ON c.id = a.competition_id
                WHERE a.id = ?", [$appId]);
    if (!$app) return null;

    $type = (string)($diploma['type'] ?? 'main');
    // Канонический номер и спец-награда — чтобы QR совпал с записью в diplomas.
    $app['diploma_number'] = (string)($diploma['number'] ?? '');
    if ($type === 'extra' && trim((string)($diploma['result'] ?? '')) !== '') {
        $app['special_award'] = (string)$diploma['result'];
    }
    try {
        $pdf = pdf_diploma($app, $type);
    } catch (\Throwable $e) {
        error_log('passport: pdf_diploma failed - ' . $e->getMessage());
        return null;
    }
    return _passport_page_from_pdf($pdf);
}

/** Титульная страница паспорта (тот же премиум-стиль, что и у диплома). */
function _passport_title_page(string $recipient, array $summary): \GdImage {
    $W = 1240; $H = 1754;
    $cX = (int)($W / 2);
    $mL = 118; $mR = $W - 118; $contentW = $mR - $mL;
    $dir = BASE_PATH . '/public/assets/img/';

    $gold  = [201, 158, 62];
    $ink   = [238, 240, 246];
    $muted = [176, 178, 188];
    $head  = [244, 246, 250];

    $img = imagecreatetruecolor($W, $H);
    // Фон и рамка — переиспользуем оформление диплома «чёрное золото».
    if (function_exists('_dip_bg_black_gold')) {
        _dip_bg_black_gold($img);
    } else {
        pl_fill($img, [7, 8, 12]);
        pl_frame($img, 30, $gold, 4);
    }
    if (function_exists('_dip_herbs')) _dip_herbs($img, $dir);

    $fReg = pl_font('regular'); $fBold = pl_font('bold');
    $fSerB = pl_font('serif-bold');

    // Шапка организации.
    pl_text($img, 0, 74, 30, $head, $fBold, 'Культурный центр «Музыкальный Мир»', 'center', $W);
    pl_text($img, 0, 104, 15, $muted, $fReg, 'Международный многожанровый конкурс культуры и искусства', 'center', $W);

    // Титул золотом.
    $y = 470;
    pl_glow($img, $cX, $y - 26, 360, 130, [130, 100, 30], 0.5);
    pl_text_gold($img, $cX, $y, 96, $fSerB, 'ПАСПОРТ', 'center', ['sparkle' => true]);
    $y += 92;
    pl_text_gold($img, $cX, $y, 60, $fSerB, 'УЧАСТНИКА', 'center', ['sparkle' => true]);
    $y += 60;

    pl_rule($img, $cX - 220, $y, $cX + 220, $gold, 2);
    $y += 46;

    // ФИО получателя.
    pl_text($img, 0, $y, 26, $head, $fBold, 'Выдан участнику:', 'center', $W);
    $y += 46;
    foreach (pl_wrap($recipient, 50, $fSerB, $contentW - 60) as $ln) {
        $y += 52;
        pl_text_gold($img, $cX, $y, 50, $fSerB, $ln, 'center', ['sparkle' => false]);
    }
    $y += 60;

    // Сводка.
    $rows = [];
    $rows[] = ['Дипломов и наград: ', (string)($summary['count'] ?? 0)];
    if (!empty($summary['competitions'])) {
        $rows[] = ['Конкурсы: ', implode(', ', $summary['competitions'])];
    }
    if (!empty($summary['titles'])) {
        $rows[] = ['Звания и награды: ', implode(', ', $summary['titles'])];
    }
    foreach ($rows as [$lab, $val]) {
        foreach (pl_wrap($lab . $val, 24, $fBold, $contentW - 10) as $ln) {
            pl_text($img, 0, $y, 24, $ink, $fBold, $ln, 'center', $W);
            $y += 38;
        }
        $y += 6;
    }

    // Общий QR (нижний-левый угол над футером) → официальный сайт КЦ.
    $siteUrl = rtrim((function_exists('cfgv') ? (string)cfgv('base_url') : ''), '/');
    if ($siteUrl === '') $siteUrl = 'https://muzmir';
    $tmpQr = sys_get_temp_dir() . '/qr_' . bin2hex(random_bytes(5)) . '.png';
    try {
        qr_png($siteUrl, $tmpQr, 6, 2);
        $qrS = 92;
        $qrX = $mL; $qrY = $H - 168;
        imagefilledrectangle($img, $qrX - 5, $qrY - 5, $qrX + $qrS + 5, $qrY + $qrS + 5, imagecolorallocate($img, 255, 255, 255));
        pl_image($img, $tmpQr, $qrX, $qrY, $qrS, $qrS, 100);
        pl_text($img, $qrX + $qrS + 12, $qrY + 34, 15, $muted, $fReg, 'Официальный сайт', 'left');
        pl_text($img, $qrX + $qrS + 12, $qrY + 58, 14, $muted, $fReg, $siteUrl, 'left');
    } catch (\Throwable $e) {
        /* тихо */
    } finally {
        if (is_file($tmpQr)) @unlink($tmpQr);
    }

    // Футер.
    $year = (int)date('Y');
    pl_text($img, 120, $H - 56, 26, $head, $fBold, 'Российская Федерация, город Москва - ' . $year, 'center', $W - 120);

    return $img;
}

/**
 * Единый PDF «Паспорт участника» со всеми дипломами пользователя.
 * Возвращает путь к готовому файлу (во временной директории) или '' при неудаче
 * либо при отсутствии дипломов.
 */
function passport_pdf(int $userId): string {
    try {
        $u = one("SELECT full_name, email FROM users WHERE id = ?", [$userId]);
        $recipient = trim((string)($u['full_name'] ?? '')) ?: 'Участник';

        $diplomas = all(
            "SELECT d.id, d.number, d.type, d.result, d.pdf_path, d.application_id,
                    a.full_name, a.is_group, a.group_name, a.result AS app_result,
                    c.name AS comp_name
               FROM diplomas d
               JOIN applications a ON a.id = d.application_id
               LEFT JOIN competitions c ON c.id = a.competition_id
              WHERE a.user_id = ?
              ORDER BY d.created_at ASC, d.id ASC",
            [$userId]
        );
        if (!$diplomas) return '';

        // Сводка для титула.
        $typeLabels = ['main' => 'Диплом', 'named' => 'Именной диплом', 'extra' => 'Спец-награда', 'thanks' => 'Благодарность'];
        $comps = []; $titles = [];
        foreach ($diplomas as $d) {
            $cn = trim((string)($d['comp_name'] ?? ''));
            if ($cn !== '') $comps[$cn] = true;
            $t = trim((string)($d['result'] ?? '')) ?: trim((string)($d['app_result'] ?? ''));
            if ($t === '') $t = $typeLabels[$d['type']] ?? 'Диплом';
            $titles[$t] = true;
        }
        $summary = [
            'count'        => count($diplomas),
            'competitions' => array_keys($comps),
            'titles'       => array_keys($titles),
        ];

        // Собираем изображения: титул + страницы дипломов.
        $images = [];
        $images[] = _passport_title_page($recipient, $summary);
        foreach ($diplomas as $d) {
            $page = _passport_render_diploma($d);
            if ($page) $images[] = $page;
        }

        // Даже если ни один диплом не отрисовался — отдаём хотя бы титул со сводкой.
        $outDir = sys_get_temp_dir();
        $out = $outDir . '/passport_u' . $userId . '_' . bin2hex(random_bytes(4)) . '.pdf';
        pl_pdf_from_images($images, $out, 150, 92);

        foreach ($images as $im) { if ($im instanceof \GdImage) imagedestroy($im); }
        return is_file($out) ? $out : '';
    } catch (\Throwable $e) {
        error_log('passport_pdf: ' . $e->getMessage());
        return '';
    }
}
