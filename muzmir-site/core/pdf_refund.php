<?php
/**
 * core/pdf_refund.php — ПОДТВЕРЖДЕНИЕ ВОЗВРАТА (PDF).
 *
 * ПОЧЕМУ НЕ КАССОВЫЙ ЧЕК. Магазин центра в ЮKassa чеки не выпускает вовсе:
 * `/v3/receipts` пуст и по платежам, и по возвратам — фискальные документы
 * владелец оформляет отдельно, в «Мой налог» (НПД). Поэтому здесь не чек, и
 * называть его чеком нельзя. Это подтверждение центра: кому, сколько, за что,
 * каким платежом и под каким номером возврата деньги ушли обратно.
 *
 * Документ нужен обеим сторонам. Участнику — чтобы он видел не просто приход на
 * карту, а расшифровку: за какую именно позицию вернули и по какому заказу.
 * Центру — чтобы в переписке и в отчётности была бумага с номерами, по которым
 * возврат находится в кассе за секунду.
 *
 * refund_confirmation_pdf(array $data): string — путь к готовому PDF.
 *   data: number, date, full_name, email, rows[] (order, competition, item, amount),
 *         total, payments[] (order => yukassa_id), refunds[] (order => refund_id)
 */
declare(strict_types=1);

require_once __DIR__ . '/pdf_lib.php';

function refund_confirmation_pdf(array $data): string
{
    $W = 1240; $H = 1754;                    // A4 при 150 dpi
    $img = imagecreatetruecolor($W, $H);
    pl_fill($img, [255, 255, 255]);

    $ink   = [26, 26, 26];
    $muted = [110, 110, 110];
    $line  = [208, 208, 208];
    $gold  = [139, 111, 31];

    $reg  = pl_font('regular');
    $bold = pl_font('bold');
    $ser  = pl_font('serif-bold');

    $L = 96; $R = $W - 120; $y = 120;

    // Шапка: лого центра, если есть, и название.
    $logo = BASE_PATH . '/public/assets/img/logo_muzmir_256.webp';
    if (!is_file($logo)) $logo = BASE_PATH . '/public/assets/img/logo.png';
    if (is_file($logo)) { pl_image($img, $logo, $L, $y - 18, 78, null); }

    pl_text($img, $L + (is_file($logo) ? 96 : 0), $y + 4, 26, $ink, $ser, 'Культурный центр «Музыкальный Мир»');
    pl_text($img, $L + (is_file($logo) ? 96 : 0), $y + 40, 15, $muted, $reg, 'музыкальный-мир.рф · kc@музыкальный-мир.рф');
    $y += 118;

    pl_rule($img, $L, $y, $R, $line, 2);
    $y += 54;

    pl_text($img, $L, $y, 30, $ink, $bold, 'Подтверждение возврата');
    $y += 46;
    pl_text($img, $L, $y, 16, $muted, $reg,
        '№ ' . (string) ($data['number'] ?? '') . ' от ' . (string) ($data['date'] ?? date('d.m.Y')));
    $y += 62;

    pl_text($img, $L, $y, 17, $muted, $reg, 'Получатель');
    pl_text($img, $L + 280, $y, 17, $ink, $bold, (string) ($data['full_name'] ?? ''));
    $y += 34;
    pl_text($img, $L, $y, 17, $muted, $reg, 'Электронная почта');
    pl_text($img, $L + 280, $y, 17, $ink, $reg, (string) ($data['email'] ?? ''));
    $y += 60;

    pl_rule($img, $L, $y, $R, $line, 1);
    $y += 40;
    pl_text($img, $L, $y, 15, $muted, $reg, 'Заказ');
    pl_text($img, $L + 150, $y, 15, $muted, $reg, 'Конкурс');
    pl_text($img, $L + 620, $y, 15, $muted, $reg, 'Позиция');
    pl_text($img, $R, $y, 15, $muted, $reg, 'Сумма', 'right');
    $y += 30;
    pl_rule($img, $L, $y, $R, $line, 1);
    $y += 36;

    foreach ((array) ($data['rows'] ?? []) as $row) {
        pl_text($img, $L, $y, 17, $ink, $reg, '№ ' . (string) ($row['order'] ?? ''));
        foreach (pl_wrap((string) ($row['competition'] ?? ''), 17, $reg, 440) as $i => $ln) {
            pl_text($img, $L + 150, $y + $i * 26, 17, $ink, $reg, $ln);
        }
        foreach (pl_wrap((string) ($row['item'] ?? ''), 17, $reg, 300) as $i => $ln) {
            pl_text($img, $L + 620, $y + $i * 26, 17, $ink, $reg, $ln);
        }
        pl_text($img, $R, $y, 17, $ink, $bold, number_format((float) ($row['amount'] ?? 0), 0, ',', ' ') . ' ₽', 'right');
        $y += 46;
    }

    $y += 10;
    pl_rule($img, $L, $y, $R, $line, 2);
    $y += 44;
    pl_text($img, $L, $y, 20, $ink, $bold, 'Итого возвращено');
    pl_text($img, $R, $y, 24, $gold, $bold,
        number_format((float) ($data['total'] ?? 0), 0, ',', ' ') . ' ₽', 'right');
    $y += 72;

    /* Номера — самое ценное в документе: по ним возврат находится в кассе. */
    pl_text($img, $L, $y, 15, $muted, $reg, 'Идентификаторы операций в платёжной системе');
    $y += 34;
    foreach ((array) ($data['refs'] ?? []) as $ref) {
        pl_text($img, $L, $y, 14, $ink, $reg, (string) $ref);
        $y += 26;
    }
    $y += 40;

    foreach (pl_wrap((string) ($data['note'] ?? ''), 15, $reg, $R - $L) as $ln) {
        pl_text($img, $L, $y, 15, $muted, $reg, $ln);
        $y += 26;
    }

    // Подпись внизу листа.
    $sy = $H - 210;
    pl_rule($img, $L, $sy, $L + 360, $line, 1);
    pl_text($img, $L, $sy + 22, 15, $muted, $reg, 'Председатель аттестационной комиссии');
    pl_text($img, $L, $sy + 50, 17, $ink, $reg, 'А. И. Ильясов');

    $dir = BASE_PATH . '/public/uploads/refunds';
    if (!is_dir($dir)) @mkdir($dir, 0775, true);
    $path = $dir . '/refund_' . pl_slug((string) ($data['number'] ?? date('Ymd_His'))) . '.pdf';
    pl_pdf_from_images([$img], $path, 150, 92);
    imagedestroy($img);
    return $path;
}
