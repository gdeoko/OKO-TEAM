<?php
/**
 * ТЕСТ дипломов: по каждому открытому конкурсу генерирует 4 наградных документа —
 * основной (аттестационный результат), дополнительный (спецноминация), именной
 * (участник в составе коллектива) и благодарность (педагогу) — и отправляет
 * красивым письмом на почту центра С ОТПРАВИТЕЛЯ nagradi@музыкальный-мир.рф.
 * Всего 4 конкурса × 4 = 16 файлов. К письму — PDF-дипломы + картинки-превью.
 *
 * Запуск: php scripts/test_diplomas_email.php [target-email]
 * Временные заявки создаются и удаляются; на боевые данные не влияет.
 */
declare(strict_types=1);
if (PHP_SAPI !== 'cli') { fwrite(STDERR, "CLI only\n"); exit(1); }

define('BASE_PATH', dirname(__DIR__));
$GLOBALS['CFG'] = require BASE_PATH . '/config.php';
require_once BASE_PATH . '/core/db.php';
require_once BASE_PATH . '/core/helpers.php';
require_once BASE_PATH . '/core/mailer.php';
require_once BASE_PATH . '/core/diploma_render.php';

$target = $argv[1] ?? 'kulturniy.centr.mir@gmail.com';
$base   = rtrim((string) cfgv('base_url'), '/') ?: 'https://xn----7sbugdeiegh1b0a9hen.xn--p1ai';
$nagradi = (mail_senders()['nagradi'] ?? []);
if (!$nagradi) { fwrite(STDERR, "нет отправителя nagradi\n"); exit(1); }

$comps = all("SELECT id, slug, name, type, is_paid FROM competitions WHERE status='open' ORDER BY sort, id");
if (!$comps) { fwrite(STDERR, "нет открытых конкурсов\n"); exit(1); }

$prevDir = BASE_PATH . '/public/diplomas';
if (!is_dir($prevDir)) @mkdir($prevDir, 0775, true);

/** Конвертирует 1-ю страницу PDF в PNG (pdftoppm), возвращает абсолютный путь png или ''. */
function pdf_first_png(string $pdf, string $outPrefix): string {
    if (!is_file($pdf)) return '';
    @exec('pdftoppm -png -r 90 -f 1 -l 1 ' . escapeshellarg($pdf) . ' ' . escapeshellarg($outPrefix) . ' 2>&1');
    foreach ([$outPrefix . '-1.png', $outPrefix . '-01.png', $outPrefix . '.png'] as $c) {
        if (is_file($c)) return $c;
    }
    return '';
}

$totalFiles = 0; $log = [];

foreach ($comps as $c) {
    $cid = (int) $c['id'];
    $cname = (string) $c['name'];

    // 4 типа наградных документов = 4 временные заявки с подходящими данными.
    $specs = [
        'main' => [
            'label' => 'Основной диплом',
            'app' => ['full_name'=>'Смирнова Екатерина Александровна','result'=>'ЛАУРЕАТ I СТЕПЕНИ',
                'nomination'=>'Вокал (эстрадный)','work_title'=>'«Я люблю тебя, Россия»','teacher'=>'Петрова Ольга Ивановна',
                'institution'=>'ДШИ №1','city'=>'Казань','age_category'=>'10–12 лет'],
            'opt' => [],
        ],
        'extra' => [
            'label' => 'Дополнительный диплом (спецноминация)',
            'app' => ['full_name'=>'Смирнова Екатерина Александровна','result'=>'ЛАУРЕАТ I СТЕПЕНИ',
                'extra_diploma'=>'ЗА АРТИСТИЗМ','nomination'=>'Вокал (эстрадный)','work_title'=>'«Я люблю тебя, Россия»',
                'teacher'=>'Петрова Ольга Ивановна','city'=>'Казань','age_category'=>'10–12 лет'],
            'opt' => ['extra'=>true],
        ],
        'named' => [
            'label' => 'Именной диплом (в составе коллектива)',
            'app' => ['full_name'=>'Соловьёва Анна Дмитриевна','result'=>'ГРАН-ПРИ','is_group'=>1,
                'group_name'=>'Образцовый ансамбль «Вдохновение»','nomination'=>'Хореография (народная)',
                'work_title'=>'«Русский перепляс»','teacher'=>'Кузнецова Марина Сергеевна','city'=>'Екатеринбург','age_category'=>'смешанная'],
            'opt' => [],
        ],
        'thanks' => [
            'label' => 'Благодарность (педагогу)',
            'app' => ['full_name'=>'Смирнова Екатерина Александровна','result'=>'ЛАУРЕАТ I СТЕПЕНИ',
                'teacher'=>'Петрова Ольга Ивановна','institution'=>'ДШИ №1','city'=>'Казань'],
            'opt' => ['thanks'=>true],
        ],
    ];

    $items = [];   // [label, pdf, png, number]
    foreach ($specs as $key => $spec) {
        $num = 'TEST-' . strtoupper($c['slug'] ?? $cid) . '-' . strtoupper($key);
        $num = 'MM-' . date('Y') . '-' . substr(md5($cid . $key), 0, 6);
        $row = array_merge([
            'number'=>$num,'competition_id'=>$cid,'user_id'=>null,'email'=>$target,
            'status'=>'graded','is_paid'=>1,'created_at'=>date('Y-m-d H:i:s'),'graded_at'=>date('Y-m-d H:i:s'),
        ], $spec['app']);
        $appId = insert('applications', $row);
        $row['id'] = $appId;

        $pdf = null;
        try { $pdf = diploma_pdf_html($row, $spec['opt']); } catch (\Throwable $e) { $pdf = null; }
        $png = '';
        if ($pdf && is_file($pdf)) {
            $png = pdf_first_png($pdf, $prevDir . '/preview_' . $cid . '_' . $key);
        }
        $items[] = ['label'=>$spec['label'],'pdf'=>$pdf,'png'=>$png,'number'=>$num,'result'=>$spec['app']['result'] ?? '','extra'=>$spec['app']['extra_diploma'] ?? ''];
        $log[] = "$cname / {$spec['label']}: " . ($pdf ? 'PDF ok' : 'PDF FAIL') . ($png ? ', PNG ok' : ', PNG -');
        if ($pdf) $totalFiles++;
        // Убираем временную заявку сразу после рендера.
        q("DELETE FROM applications WHERE id=?", [(int)$appId]);
    }

    // --- Красивое письмо по конкурсу (4 документа) ---
    $navy = MM_NAVY; $gold = MM_GOLD; $ink = MM_INK; $muted = MM_MUTED; $line = MM_LINE;
    $cards = '';
    foreach ($items as $it) {
        $imgUrl = $it['png'] ? ($base . '/diplomas/' . basename($it['png'])) : '';
        $img = $imgUrl !== ''
            ? '<img src="' . h($imgUrl) . '" alt="' . h($it['label']) . '" width="516" style="display:block;width:100%;max-width:516px;height:auto;border-radius:10px;border:1px solid ' . $line . ';">'
            : '<div style="padding:24px;text-align:center;color:#B00;border:1px solid ' . $line . ';border-radius:10px;">Превью недоступно</div>';
        $meta = $it['extra'] !== '' ? ('Спецноминация: ' . h($it['extra'])) : ('Аттестационный результат: ' . h($it['result']));
        $cards .= '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 22px;border:1px solid ' . $line . ';border-radius:12px;overflow:hidden;">'
            . '<tr><td style="padding:14px 16px 6px;">'
            . '<div style="font-family:Georgia,serif;font-weight:700;color:' . $navy . ';font-size:16px;">' . h($it['label']) . '</div>'
            . '<div style="font-size:13px;color:' . $muted . ';margin:3px 0 2px;">' . $meta . '</div>'
            . '<div style="font-size:12px;color:' . $muted . ';">№ ' . h($it['number']) . ' · QR-проверка подлинности в правом нижнем углу · PDF во вложении</div>'
            . '</td></tr><tr><td style="padding:8px 16px 16px;">' . $img . '</td></tr></table>';
    }
    $inner = '<p style="margin:0 0 6px;font-size:16px;color:' . $ink . ';">Тестовые наградные документы конкурса</p>'
        . '<h2 style="margin:0 0 16px;font-family:Georgia,serif;font-size:22px;color:' . $navy . ';">«' . h($cname) . '»</h2>'
        . '<p style="margin:0 0 18px;font-size:14px;color:' . $muted . ';line-height:1.6;">Ниже — 4 документа по этому конкурсу: основной диплом (аттестационный результат), '
        . 'дополнительный (спецноминация), именной (участник в составе коллектива) и благодарность педагогу. '
        . 'Каждый — с номером и QR-кодом проверки подлинности. Файлы PDF приложены к письму.</p>'
        . $cards;

    $html = mm_email_layout($inner, [
        'preheader' => 'Тест наградных документов: ' . $cname . ' (4 файла)',
        'audience_note' => 'Служебное тестовое письмо наградного отдела.',
    ]);

    $atts = array_values(array_filter(array_map(fn($it) => $it['pdf'], $items), fn($p) => $p && is_file($p)));
    $subject = 'ТЕСТ наградных документов — «' . $cname . '» (4 файла)';
    $ok = mail_send($target, $subject, $html, ['account' => $nagradi, 'attachments' => $atts, 'from_name' => 'Наградный отдел — Музыкальный Мир']);
    $log[] = "письмо по «$cname»: " . ($ok ? 'ОТПРАВЛЕНО' : 'НЕ ОТПРАВЛЕНО') . " (вложений: " . count($atts) . ")";
}

echo "Всего сгенерировано PDF: $totalFiles из " . (count($comps) * 4) . "\n";
echo implode("\n", $log) . "\n";
