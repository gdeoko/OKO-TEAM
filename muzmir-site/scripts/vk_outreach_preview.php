<?php
/**
 * КАК ВЫГЛЯДИТ ПАРТНЁРСКОЕ ОБРАЩЕНИЕ ВО ВКОНТАКТЕ.
 *
 * Собирает то же самое, что уходит адресату: текст сообщения и бланк PDF.
 * Ничего не отправляет; исходящий номер, выписанный для пробы, из реестра
 * убирается, а файл бланка удаляется — реестр обращений должен отражать
 * настоящие письма, а не примерки.
 *
 *   php scripts/vk_outreach_preview.php        — первый адресат очереди
 *   php scripts/vk_outreach_preview.php 3      — сколько показать
 */
declare(strict_types=1);
if (PHP_SAPI !== 'cli') { fwrite(STDERR, "CLI only\n"); exit(1); }

define('BASE_PATH', dirname(__DIR__));
$GLOBALS['CFG'] = require BASE_PATH . '/config.php';
require_once BASE_PATH . '/core/db.php';
require_once BASE_PATH . '/core/helpers.php';
require_once BASE_PATH . '/core/mailer.php';
require_once BASE_PATH . '/core/vk_outreach.php';

$n    = max(1, (int) ($argv[1] ?? 1));
$line = str_repeat('=', 78);

vko_ensure();
$comps = vko_comps();
$queue = vko_queue($n);

printf("ОЧЕРЕДЬ ОБРАЩЕНИЙ ВКОНТАКТЕ\n%s\n", $line);
$total = (int) (scalar("SELECT COUNT(*) FROM vk_targets t JOIN institutions i ON i.id=t.institution_id
                         LEFT JOIN vk_outreach_log l ON l.institution_id=i.id
                        WHERE t.score>=12 AND l.id IS NULL
                          AND COALESCE(i.partner_status,'') NOT IN ('accepted','declined','blocked')") ?? 0);
$closed = (int) (scalar("SELECT COUNT(*) FROM vk_targets t JOIN institutions i ON i.id=t.institution_id
                          LEFT JOIN vk_outreach_log l ON l.institution_id=i.id
                         WHERE t.score>=12 AND l.id IS NULL AND t.can_post=0 AND t.can_suggest=0
                           AND COALESCE(i.partner_status,'') NOT IN ('accepted','declined','blocked')") ?? 0);
printf("  всего адресатов: %d, из них со стеной закрытой наглухо: %d\n", $total, $closed);
printf("  конкурсов в обращении: %d\n\n", count($comps));

foreach ($queue as $row) {
    $L = vko_letter($row, $comps);
    $msg = vko_message($row, $L['number'], $comps, partner_join_url((int) $row['id']));

    printf("%s\nvk.com/club%d · %s · %s подписчиков · стена %s\n%s\n",
        $line, (int) $row['group_id'], (string) $row['name'],
        number_format((int) $row['members'], 0, '.', ' '),
        (int) $row['can_post'] === 1 ? 'открыта' : ((int) $row['can_suggest'] === 1 ? 'предложка' : 'закрыта'),
        $line);
    echo $msg, "\n\n";
    printf("  символов в сообщении: %d из 4096\n", mb_strlen($msg));
    printf("  бланк: %s\n", $L['pdf'] !== '' && is_file($L['pdf'])
        ? basename($L['pdf']) . ', ' . round(filesize($L['pdf']) / 1024) . ' КБ'
        : 'НЕ СОБРАЛСЯ');

    // Проба не должна оставлять следов в реестре обращений.
    if ($L['pdf'] !== '' && is_file($L['pdf'])) @unlink($L['pdf']);
    if ($L['number'] !== '') q("DELETE FROM official_letters WHERE number=?", [$L['number']]);
}
