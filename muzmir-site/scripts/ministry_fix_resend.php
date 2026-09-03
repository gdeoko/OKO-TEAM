<?php
/**
 * ministry_fix_resend.php — переоформление обращений по замечаниям ведомств.
 *
 * ДВА ЗАМЕЧАНИЯ, ПРИШЕДШИЕ 02.09.2026.
 *
 * 1. Комитет по сохранению культурного наследия Ленинградской области:
 *    «Просим Вас исправить в обращении фамилию председателя комитета и
 *    направить с приложениями через интернет приемную комитета».
 *    Фамилия в реестре верная — печаталась она в ИМЕНИТЕЛЬНОМ падеже под
 *    должностью в дательном («Цой Владимир Олегович» вместо «В. О. Цою»), и
 *    канцелярия прочла это как ошибку. Реквизит «Адресат» исправлен по ГОСТ
 *    Р 7.0.97-2016 в ol_html_for()/lm_addressee(). Через интернет-приёмную центр
 *    не подаёт НИЧЕГО и нигде — правило владельца от 03.09.2026. Ведомству,
 *    которое принимает только через свою форму, уходит короткий ответ в
 *    переписку, и на этом оно из базы выбывает (status='excluded').
 *
 * 2. Портал «Культура.РФ» (ФКУ «Цифровая культура»), дважды:
 *    «Документ к рассмотрению не принимается – отсутствует сопроводительное
 *    письмо». Их СЭД регистрирует входящим сопроводительное, а всё остальное
 *    считает приложениями. Ведомству проставлен needs_cover=1, и обращение
 *    уходит с сопроводительным ПЕРВЫМ файлом (lm_cover_pdf()).
 *
 * Запуск: php scripts/ministry_fix_resend.php --dry
 *         php scripts/ministry_fix_resend.php --send
 */
declare(strict_types=1);
define('BASE_PATH', '/var/www/muzmir');
$GLOBALS['CFG'] = require BASE_PATH . '/config.php';
foreach (['db', 'data', 'helpers', 'mailer', 'letter_texts', 'official_letter',
          'letter_mail', 'ministries', 'ministry_mailing', 'ministry_reply', 'outreach_window'] as $m) {
    require_once BASE_PATH . '/core/' . $m . '.php';
}

$send  = in_array('--send', $argv, true);
$force = in_array('--force-window', $argv, true);
if (!$send && !in_array('--dry', $argv, true)) { fwrite(STDERR, "укажи --dry или --send\n"); exit(2); }
if ($send && !outreach_window_guard($force)) exit(0);

min_migrate();
ol_migrate();

$free = ol_comps(true);
if (!$free) { fwrite(STDERR, "нет бесплатных конкурсов — обращение отправлять не с чем\n"); exit(1); }
$att = mm_attachments($free);

foreach ([50, 25] as $mid) {
    $r = one("SELECT * FROM ministries WHERE id=?", [$mid]);
    if (!$r) { echo "ведомство #$mid не найдено\n"; continue; }

    $email = mb_strtolower(trim((string) $r['email']));
    echo "\n=== #{$mid} " . mb_substr((string) $r['org'], 0, 52) . " ({$email})\n";

    $L      = ol_create(['kind' => 'support', 'org' => (string) $r['org'], 'person' => (string) $r['person'],
                         'person_role' => (string) $r['person_role'], 'region' => (string) $r['region'],
                         'email' => $email]);
    $number = (string) $L['number'];
    $r['branch'] = (string) ($r['branch'] ?? 'main');
    $mail = lm_mail_support($r, $number, $free);

    $files = [];
    if ((int) ($r['needs_cover'] ?? 0) === 1) {
        $cover = lm_cover_pdf($r, $number, ['Положение о конкурсе (бесплатное участие)', 'Афиша конкурса']);
        if ($cover === '') { echo "  СОПРОВОДИТЕЛЬНОЕ НЕ СОБРАЛОСЬ — не отправляю\n"; continue; }
        $files[] = $cover;
        echo "  сопроводительное: " . basename($cover) . " (" . number_format((int) filesize($cover)) . " б)\n";
    }
    $pdf = (string) ($mail['pdf'] ?? '');
    if ($pdf !== '' && is_file($pdf)) $files[] = $pdf;
    $files = array_merge($files, $att);
    echo "  обращение исх. №{$number}: " . ($pdf !== '' ? basename($pdf) : 'НЕ СОБРАЛОСЬ') . "\n";
    echo "  всего вложений: " . count($files) . "\n";
    if ($pdf === '' || !is_file($pdf)) { echo "  бланк не собрался — пропуск\n"; continue; }

    /* Ведомству, требующему интернет-приёмную, письмо уходит не как новое
       обращение, а как ответ на его замечание. Про приёмную в ответе ни слова:
       центр туда не подаёт, а обещать то, чего не сделаешь, нельзя. */
    $portal = (int) ($r['portal_only'] ?? 0) === 1;

    if ($portal) {
        $subject = 'Переоформленное обращение об информационной поддержке (исх. №' . $number . ')';
        $body = '<div style="font-family:Georgia,\'Times New Roman\',serif;font-size:15px;line-height:1.62;color:#1B2340;max-width:640px">'
            . '<p>' . h(lm_salut((string) $r['person'])) . '</p>'
            . '<p>Благодарим за замечание к нашему обращению. Оно учтено: реквизит «Адресат» '
            . 'приведён к требованиям ГОСТ Р 7.0.97-2016, фамилия и инициалы указаны в дательном '
            . 'падеже. Переоформленное обращение прилагается — исх. №' . h($number) . ' от '
            . h(date('d.m.Y')) . '.</p>'
            . '<p>Направляем его в ту же переписку, чтобы замечание не осталось без ответа.</p>'
            . '<p>Участие в конкурсах бесплатное. Приносим извинения за неточность в первом документе.</p>'
            . '<p>С уважением,<br>оргкомитет Культурного центра «Музыкальный Мир»</p></div>';
    } else {
        $subject = (string) $mail['subject'];
        $body = '<div style="font-family:Georgia,\'Times New Roman\',serif;font-size:15px;line-height:1.62;color:#1B2340;max-width:640px">'
            . '<p>' . h(lm_salut((string) $r['person'])) . '</p>'
            . '<p>Наше обращение было возвращено с указанием на отсутствие сопроводительного '
            . 'письма. Замечание учтено: направляем повторно, первым файлом — сопроводительное '
            . 'письмо, далее обращение исх. №' . h($number) . ' от ' . h(date('d.m.Y'))
            . ' и приложения к нему.</p>'
            . '<p>Участие в конкурсах бесплатное. Просим рассмотреть обращение по существу.</p>'
            . '<p>С уважением,<br>оргкомитет Культурного центра «Музыкальный Мир»</p></div>';
    }

    echo "  тема: $subject\n";
    if (!$send) { echo "  (сухой прогон, письмо не отправлено)\n"; continue; }

    $qid = mrep_queue_official($email, (string) $r['org'], $subject, $body, $files);
    if ($qid > 0) {
        echo "  поставлено в очередь официальной почты: #$qid\n";
        try {
            update('official_letters', ['file' => $pdf, 'queue_id' => $qid, 'status' => 'queued'],
                   'id=:id', ['id' => (int) $L['id']]);
        } catch (\Throwable $e) {}
    } else {
        echo "  В ОЧЕРЕДЬ НЕ ВСТАЛО\n";
    }
}
echo "\nготово\n";
