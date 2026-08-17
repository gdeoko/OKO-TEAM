<?php
/**
 * ВТОРОЕ ПИСЬМО УЧРЕЖДЕНИЯМ, КОТОРЫЕ ПОЛУЧИЛИ ПЕРВОЕ БЕЗ КНОПКИ.
 *
 * Согласие на партнёрство сначала можно было дать только ответным письмом:
 * «напишите нам "согласны"». На тысячах отправленных обращений это не сработало
 * ни разу. Кнопку с именной подписанной ссылкой сделали позже, и она попала
 * лишь в 1 953 письма из 5 340 — остальные три с половиной тысячи учреждений
 * получили приглашение, в котором согласиться одним нажатием было нечем.
 *
 * Это самая тёплая аудитория из всех: письмо от центра они уже видели, бланк
 * с исходящим номером у них есть. Здесь им уходит короткое второе письмо —
 * только про партнёрство и только с кнопкой, без повтора всего обращения и без
 * вложений. Тем, кто отписался, пожаловался или чей адрес закрыт, не уходит
 * ничего.
 *
 * Приоритет 7 (обычная волна идёт с пятым): выборка в очереди сортируется по
 * приоритету, поэтому второе касание уходит раньше первых касаний той же нормы.
 *
 *   php scripts/queue_partner_followup.php --dry
 *   php scripts/queue_partner_followup.php --limit=500
 *   php scripts/queue_partner_followup.php
 */
declare(strict_types=1);
if (PHP_SAPI !== 'cli') { fwrite(STDERR, "CLI only\n"); exit(1); }

define('BASE_PATH', dirname(__DIR__));
$GLOBALS['CFG'] = require BASE_PATH . '/config.php';
require_once BASE_PATH . '/core/db.php';
require_once BASE_PATH . '/core/helpers.php';
require_once BASE_PATH . '/core/mailer.php';
require_once BASE_PATH . '/core/newsletter.php';
require_once BASE_PATH . '/core/partner.php';
require_once BASE_PATH . '/core/letter_texts.php';
require_once BASE_PATH . '/core/letter_mail.php';

$dry   = in_array('--dry', $argv, true);
$limit = 0;
foreach ($argv as $a) if (preg_match('~^--limit=(\d+)$~', $a, $m)) $limit = (int) $m[1];
$line = str_repeat('=', 78);

nl_ensure_campaign_type_col();

echo "ВТОРОЕ ПИСЬМО: ТОЛЬКО ПРО ПАРТНЁРСТВО\n$line\n";

/**
 * Кому. Учреждение получило письмо, в котором кнопки не было, живо, не
 * отписывалось, не стало партнёром и не стоит в очереди прямо сейчас.
 */
$sql = "SELECT i.id, i.name, i.email, i.city, i.region
          FROM institutions i
         WHERE TRIM(COALESCE(i.email,'')) <> ''
           AND i.status NOT IN ('unsubscribed','banned','excluded')
           AND COALESCE(i.partner_status,'') = ''
           AND LOWER(i.email) NOT IN (SELECT LOWER(email) FROM mail_stop)
           AND EXISTS (SELECT 1 FROM mail_queue q
                        WHERE LOWER(q.to_email) = LOWER(i.email) AND q.status='sent'
                          AND COALESCE(q.priority,0) > 0
                          AND COALESCE(q.body,'') NOT LIKE '%partner-join%')
           AND NOT EXISTS (SELECT 1 FROM mail_queue q2
                            WHERE LOWER(q2.to_email) = LOWER(i.email)
                              AND COALESCE(q2.body,'') LIKE '%partner-join%')
         ORDER BY i.id ASC";
if ($limit > 0) $sql .= " LIMIT $limit";
$rows = all($sql);

printf("  адресатов: %s\n", number_format(count($rows), 0, '.', ' '));
if (!$rows) exit(0);

$base    = rtrim((string) cfgv('base_url'), '/');
$boxPart = function_exists('ol_box_email') ? ol_box_email('partner') : 'novosti@музыкальный-мир.рф';
$phone   = (string) cfgv('org_phone', '');

/** Тело письма. Коротко: почему пишем второй раз, что даёт статус, кнопка. */
$build = static function (array $inst, string $unsub) use ($base, $boxPart, $phone): array {
    $org = trim((string) ($inst['name'] ?? ''));
    $id  = (int) $inst['id'];

    $inner  = lm_head('Информационное партнёрство', 'Культурный центр «Музыкальный Мир»');
    $inner .= lm_p('Уважаемые коллеги!');
    $inner .= lm_p('Ранее мы направляли в ваш адрес обращение о всероссийских конкурсах '
        . 'и приглашали обучающихся и педагогов к участию. Отдельно предлагаем учреждению '
        . 'статус <b>информационного партнёра</b> центра.');
    $inner .= lm_p('Статус даёт:');
    $inner .= '<ul style="margin:0 0 14px 0;padding-left:20px;color:#2a2a33;font-size:15px;line-height:1.7">'
        . '<li>именной сертификат информационного партнёра на бланке центра;</li>'
        . '<li>персональную ссылку для участников учреждения;</li>'
        . '<li>кабинет партнёра на сайте: заявки, статусы, наградные документы;</li>'
        . '<li>благодарственные письма педагогам после пяти заявок от учреждения.</li>'
        . '</ul>';
    $inner .= lm_callout('Участие бесплатное, договор не требуется, обязательств по числу '
        . 'заявок нет. Статус можно прекратить в любой момент одним письмом.');
    $inner .= lm_p('Раньше согласие нужно было направлять ответным письмом. Теперь достаточно '
        . 'одного нажатия: ссылка ниже именная и закреплена за вашим учреждением.');
    $inner .= mm_email_btn(partner_join_url($id), 'Стать партнёром', 'navy');
    $inner .= lm_p('По вопросам партнёрства: <b>' . h($phone) . '</b>, '
        . '<a href="mailto:' . h($boxPart) . '" style="color:#8B6F1F">' . h($boxPart) . '</a>.',
        'font-size:14px;color:#4a4a55');
    $inner .= lm_p('Если предложение неактуально, письмо можно оставить без ответа.',
        'font-size:13px;color:#77777f');

    $html = mm_email_layout($inner, [
        'vip'             => false,
        'unsubscribe_url' => $unsub,
        // В подвале по умолчанию стоит «вы оставили заявку или подписку». Для
        // учреждения это неправда: адрес взят из открытого реестра, заявки оно
        // не оставляло. Писать неправду в письме, которое читает директор
        // школы, нельзя — это первое, за что письмо помечают спамом.
        'audience_note'   => 'Письмо направлено на официальный адрес учреждения, '
                           . 'опубликованный в открытых источниках.',
    ]);
    return [
        'subject' => 'Информационное партнёрство с Культурным центром «Музыкальный Мир»'
                   . ($org !== '' ? ' — ' . mb_substr($org, 0, 60) : ''),
        'html'    => $html,
    ];
};

/* Посмотреть письмо глазами до отправки: файл открывается по адресу сайта. */
if (in_array('--preview', $argv, true)) {
    $mail = $build($rows[0], $base . '/api/v1/unsubscribe.php?token=preview');
    $dir  = BASE_PATH . '/public/tests';
    if (!is_dir($dir)) @mkdir($dir, 0775, true);
    file_put_contents($dir . '/partner-followup.html', $mail['html']);
    echo "  тема:  " . $mail['subject'] . "\n";
    echo "  письмо: " . $base . "/tests/partner-followup.html\n";
    exit(0);
}

$queued = $skipped = 0;
foreach ($rows as $r) {
    $email = mb_strtolower(trim((string) $r['email']));
    if ($email === '' || !filter_var($email, FILTER_VALIDATE_EMAIL)) { $skipped++; continue; }

    [$token, $active] = nl_ensure_subscriber($email, (string) $r['name'], 'institution');
    if (!$active) {                                  // отписан — не трогаем
        try { update('institutions', ['status' => 'unsubscribed'], 'id=:id', ['id' => (int) $r['id']]); }
        catch (\Throwable $e) {}
        $skipped++;
        continue;
    }
    $unsub = $base . '/api/v1/unsubscribe.php?token=' . urlencode($token);

    if ($dry) { $queued++; continue; }
    try {
        $mail = $build($r, $unsub);
        insert('mail_queue', [
            'to_email'      => $email,
            'to_name'       => (string) $r['name'],
            'subject'       => $mail['subject'],
            'body'          => $mail['html'],
            'attach'        => '',
            'status'        => 'queued',
            'priority'      => 7,                     // раньше первых касаний
            'campaign_type' => 'inst',                // та же волна, тот же ящик novosti@
        ]);
        $queued++;
    } catch (\Throwable $e) { $skipped++; }
}

printf("\n%s\n  %s: %s, пропущено: %s\n", $line,
    $dry ? 'поставили бы' : 'поставлено в очередь',
    number_format($queued, 0, '.', ' '), number_format($skipped, 0, '.', ' '));
if ($dry) echo "  сухой прогон: ничего не изменено\n";
