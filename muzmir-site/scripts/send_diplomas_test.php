<?php
/**
 * Отправка ТЕСТОВЫХ наградных документов, УЖЕ сгенерированных scripts/test_diplomas_email.php
 * (переиспользует готовые PDF+PNG в public/diplomas/, без повторного рендера). Лёгкий
 * транзакционный шаблон (без маркетинговой обёртки — иначе Яндекс режет как спам).
 * Отправитель — nagradi@. Запуск: php scripts/send_diplomas_test.php [email]
 */
declare(strict_types=1);
if (PHP_SAPI !== 'cli') { fwrite(STDERR, "CLI only\n"); exit(1); }
define('BASE_PATH', dirname(__DIR__));
$GLOBALS['CFG'] = require BASE_PATH . '/config.php';
require_once BASE_PATH . '/core/db.php';
require_once BASE_PATH . '/core/helpers.php';
require_once BASE_PATH . '/core/mailer.php';

$target = $argv[1] ?? 'kulturniy.centr.mir@gmail.com';
$base   = rtrim((string) cfgv('base_url'), '/') ?: 'https://xn----7sbugdeiegh1b0a9hen.xn--p1ai';
$nagradi = mail_senders()['nagradi'] ?? [];
if (!$nagradi) { fwrite(STDERR, "нет nagradi\n"); exit(1); }
$dir = BASE_PATH . '/public/diplomas';
$onlyId = (int) ($argv[2] ?? 0);   // необязательный фильтр: слать только этот конкурс
$comps = all("SELECT id, slug, name FROM competitions WHERE status='open'"
    . ($onlyId ? " AND id=" . $onlyId : "") . " ORDER BY sort, id");

$types = [
    'main'   => ['Основной диплом', 'main',   'Аттестационный результат: ЛАУРЕАТ I СТЕПЕНИ'],
    'extra'  => ['Дополнительный диплом (спецноминация)', 'extra', 'Спецноминация: ЗА АРТИСТИЗМ'],
    'named'  => ['Именной диплом (в составе коллектива)', 'main', 'Аттестационный результат: ГРАН-ПРИ'],
    'thanks' => ['Благодарность (педагогу)', 'thanks', 'Педагогу за подготовку участников'],
];

$logo = h(mm_logo_url());
$sent = 0; $log = [];
foreach ($comps as $c) {
    $cid = (int) $c['id']; $cname = (string) $c['name'];
    $items = [];
    foreach ($types as $key => [$label, $renderType, $meta]) {
        $num  = 'MM-' . date('Y') . '-' . substr(md5($cid . $key), 0, 6);
        $slug = trim(strtolower((string) preg_replace('/[^a-z0-9]+/i', '-', $num . '-' . $renderType)), '-');
        $pdf  = $dir . '/diploma_' . $slug . '.pdf';
        $png  = '';
        foreach ([$dir . '/preview_' . $cid . '_' . $key . '-1.png', $dir . '/preview_' . $cid . '_' . $key . '.png'] as $cand) {
            if (is_file($cand)) { $png = $cand; break; }
        }
        $items[] = ['label' => $label, 'meta' => $meta, 'num' => $num, 'pdf' => is_file($pdf) ? $pdf : '', 'png' => $png];
    }

    $cards = '';
    foreach ($items as $it) {
        $imgUrl = $it['png'] ? ($base . '/diplomas/' . basename($it['png'])) : '';
        $img = $imgUrl ? '<img src="' . h($imgUrl) . '" alt="" width="516" style="display:block;width:100%;max-width:516px;height:auto;border-radius:10px;border:1px solid #DCE3F3;">' : '';
        $cards .= '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 20px;border:1px solid #DCE3F3;border-radius:12px;overflow:hidden;">'
            . '<tr><td style="padding:13px 16px 4px;"><div style="font-family:Georgia,serif;font-weight:700;color:#17307A;font-size:16px;">' . h($it['label']) . '</div>'
            . '<div style="font-size:13px;color:#6B7699;margin:3px 0;">' . h($it['meta']) . '</div>'
            . '<div style="font-size:12px;color:#6B7699;">№ ' . h($it['num']) . ' · QR проверки подлинности в правом нижнем углу · PDF во вложении</div></td></tr>'
            . '<tr><td style="padding:8px 16px 16px;">' . $img . '</td></tr></table>';
    }

    $html = '<!DOCTYPE html><html lang="ru"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>'
        . '<body style="margin:0;background:#F4F6FC;font-family:\'Segoe UI\',Arial,sans-serif;color:#1D2B55;">'
        . '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F4F6FC;padding:24px 12px;"><tr><td align="center">'
        . '<table role="presentation" width="600" cellpadding="0" cellspacing="0" style="width:600px;max-width:100%;background:#FFFFFF;border-radius:14px;overflow:hidden;border:1px solid #DCE3F3;">'
        . '<tr><td style="background:#17307A;padding:22px 32px;text-align:center;"><img src="' . $logo . '" alt="" width="64" height="64" style="width:64px;height:64px;border-radius:50%;background:#fff;border:2px solid #C79322;">'
        . '<div style="margin-top:8px;font-family:Georgia,serif;color:#C79322;font-weight:700;font-size:16px;">Наградный отдел · «Музыкальный Мир»</div></td></tr>'
        . '<tr><td style="padding:26px 32px;"><p style="margin:0 0 4px;font-size:16px;">Наградные документы конкурса</p>'
        . '<h2 style="margin:0 0 14px;font-family:Georgia,serif;font-size:22px;color:#17307A;">«' . h($cname) . '»</h2>'
        . '<p style="margin:0 0 18px;font-size:14px;color:#6B7699;line-height:1.6;">Четыре документа: основной (аттестационный результат), дополнительный (спецноминация), именной (в составе коллектива) и благодарность педагогу. Каждый — с номером и QR проверки подлинности. PDF приложены к письму.</p>'
        . $cards . '</td></tr>'
        . '<tr><td style="padding:14px 32px 22px;border-top:1px solid #DCE3F3;font-size:12px;color:#6B7699;">Культурный центр «Музыкальный Мир» · ' . h((string) cfgv('org_phone')) . ' · ' . h((string) cfgv('org_email')) . '</td></tr>'
        . '</table></td></tr></table></body></html>';

    $atts = array_values(array_filter(array_map(fn($it) => $it['pdf'], $items), fn($p) => $p && is_file($p)));
    // Пауза между тяжёлыми письмами — иначе Яндекс троттлит быстрые крупные отправки подряд.
    static $first = true; if (!$first) sleep(12); $first = false;
    $subj = 'Наградные документы — «' . $cname . '» (4 файла)';
    $sendOpt = ['account' => $nagradi, 'attachments' => $atts, 'from_name' => 'Наградный отдел «Музыкальный Мир»'];
    $ok = mail_send($target, $subj, $html, $sendOpt);
    if (!$ok) { sleep(15); $ok = mail_send($target, $subj, $html, $sendOpt); }   // повтор один раз
    if ($ok) $sent++;
    $log[] = "«$cname»: " . ($ok ? 'ОТПРАВЛЕНО' : 'НЕ ОТПРАВЛЕНО') . " (вложений " . count($atts) . ", превью " . count(array_filter($items, fn($i) => $i['png'])) . ")";
}
echo "Отправлено писем: $sent из " . count($comps) . " (всего файлов: " . ($sent * 4) . ")\n" . implode("\n", $log) . "\n";
