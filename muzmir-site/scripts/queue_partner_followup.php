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
 * РЕЖИМ --opened — ВТОРОЕ КАСАНИЕ ТЕМ, КТО ПИСЬМО ОТКРЫЛ.
 *
 * Отдельная и самая тёплая группа: письмо с кнопкой они получили, открыли, но не
 * нажали ничего. Причина обычно не в отказе, а в том, что письмо читает секретарь
 * или делопроизводитель, а решение принимает директор, и до него письмо не дошло.
 * Поэтому текст здесь другой: три строки, одна кнопка и прямая просьба переслать
 * тому, кто решает. Ни перечня конкурсов, ни списка выгод, ни вложений.
 *
 *   php scripts/queue_partner_followup.php --dry
 *   php scripts/queue_partner_followup.php --limit=500
 *   php scripts/queue_partner_followup.php
 *   php scripts/queue_partner_followup.php --opened --dry
 *   php scripts/queue_partner_followup.php --opened
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

$dry    = in_array('--dry', $argv, true);
$opened = in_array('--opened', $argv, true);
// --delivered: письмо доставлено, но отметки об открытии нет. Не значит «не читал»:
// открытия считаются по картинке в письме, а её блокирует и почтовый клиент, и
// корпоративный шлюз школы. Поэтому таким тоже уходит напоминание, но спокойнее
// по тону и обычной очередью, а не впереди первых касаний.
$delivered = in_array('--delivered', $argv, true);
if ($delivered) $opened = true;   // выборка и текст те же, отличаются тема и очередь
$limit = 0;
foreach ($argv as $a) if (preg_match('~^--limit=(\d+)$~', $a, $m)) $limit = (int) $m[1];
$line = str_repeat('=', 78);

nl_ensure_campaign_type_col();
$GLOBALS['pf_delivered'] = $delivered;

echo "ВТОРОЕ ПИСЬМО: ТОЛЬКО ПРО ПАРТНЁРСТВО\n$line\n";

/**
 * Кому. Учреждение получило письмо, в котором кнопки не было, живо, не
 * отписывалось, не стало партнёром и не стоит в очереди прямо сейчас.
 */
$common = "TRIM(COALESCE(i.email,'')) <> ''
           AND i.status NOT IN ('unsubscribed','banned','excluded')
           AND COALESCE(i.partner_status,'') = ''
           AND LOWER(i.email) NOT IN (SELECT LOWER(email) FROM mail_stop)";

if ($opened) {
    // Письмо с кнопкой ушло не меньше суток назад, человек его открыл, но не нажал
    // и заявок от учреждения нет. Второе такое письмо не шлём: одно напоминание это
    // помощь, два подряд это давление.
    $sql = "SELECT i.id, i.name, i.email, i.city, i.region, i.partner_slug
              FROM institutions i
             WHERE $common
               AND EXISTS (SELECT 1 FROM mail_queue q
                            WHERE LOWER(q.to_email) = LOWER(i.email) AND q.status='sent'
                              AND COALESCE(q.body,'') LIKE '%partner-join%'
                              AND q.sent_at <= datetime('now','localtime','-1 day'))
               AND EXISTS (SELECT 1 FROM mail_events e
                            WHERE LOWER(e.email) = LOWER(i.email)
                              AND e.status = '" . ($delivered ? 'delivered' : 'opened') . "')
               " . ($delivered ? "AND NOT EXISTS (SELECT 1 FROM mail_events e2
                            WHERE LOWER(e2.email) = LOWER(i.email) AND e2.status='opened')" : '') . "
               AND NOT EXISTS (SELECT 1 FROM applications a WHERE a.institution_id = i.id)
               AND NOT EXISTS (SELECT 1 FROM mail_queue q3
                                WHERE LOWER(q3.to_email) = LOWER(i.email)
                                  AND (q3.subject LIKE 'Вы открывали наше письмо%'
                                    OR q3.subject LIKE 'Партнёрство: остаётся подтвердить%'))
             ORDER BY i.id ASC";
} else {
    $sql = "SELECT i.id, i.name, i.email, i.city, i.region
              FROM institutions i
             WHERE $common
               AND EXISTS (SELECT 1 FROM mail_queue q
                            WHERE LOWER(q.to_email) = LOWER(i.email) AND q.status='sent'
                              AND COALESCE(q.priority,0) > 0
                              AND COALESCE(q.body,'') NOT LIKE '%partner-join%')
               AND NOT EXISTS (SELECT 1 FROM mail_queue q2
                                WHERE LOWER(q2.to_email) = LOWER(i.email)
                                  AND COALESCE(q2.body,'') LIKE '%partner-join%')
             ORDER BY i.id ASC";
}
if ($limit > 0) $sql .= " LIMIT $limit";
$rows = all($sql);

printf("  адресатов: %s\n", number_format(count($rows), 0, '.', ' '));
if (!$rows) exit(0);

$base    = rtrim((string) cfgv('base_url'), '/');
$boxPart = function_exists('ol_box_email') ? ol_box_email('partner') : 'novosti@музыкальный-мир.рф';
$phone   = (string) cfgv('org_phone', '');

/**
 * КОРОТКОЕ ПИСЬМО ТЕМ, КТО ОТКРЫЛ И НЕ НАЖАЛ.
 *
 * Здесь важно не добавить доводов, а убрать всё лишнее. Человек уже видел полное
 * обращение со списком конкурсов, положениями и выгодами: повторять их значит
 * заставить читать второй раз то, что он уже прочёл. Остаётся ровно то, чего в
 * первом письме не хватило: напоминание о сроке, одно действие и просьба
 * переслать письмо тому, кто в учреждении принимает решение.
 */
$buildShort = static function (array $inst, string $unsub) use ($base, $boxPart, $phone): array {
    $org  = trim((string) ($inst['name'] ?? ''));
    $id   = (int) $inst['id'];
    $slug = trim((string) ($inst['partner_slug'] ?? ''));

    // Срок приёма — из открытых конкурсов, чтобы письмо не обещало вчерашний день.
    $end = '';
    try {
        $end = (string) (scalar("SELECT MIN(end_date) FROM competitions WHERE status='open' AND end_date IS NOT NULL") ?? '');
    } catch (\Throwable $e) {}
    $endRu = $end !== '' && function_exists('ru_date') ? ru_date($end) : ($end !== '' ? date('d.m.Y', strtotime($end)) : '');

    $inner  = lm_head('Информационное партнёрство', 'Культурный центр «Музыкальный Мир»');
    $inner .= lm_p('Уважаемые коллеги!');
    $inner .= lm_p('Мы направляли в ваш адрес приглашение к участию в конкурсах и предложение о '
        . 'партнёрстве. Аккаунт вашего учреждения уже оформлен, остаётся подтвердить его одним '
        . 'нажатием: договор не подписывается, платежей и обязательств нет.');
    $inner .= mm_email_btn(partner_join_url($id), 'Подтвердить партнёрство', 'navy');
    if ($endRu !== '') {
        $inner .= lm_p('Приём заявок текущего сезона идёт до <b>' . h($endRu) . '</b>. '
            . 'Педагоги, подготовившие участников, получают благодарственные письма и дипломы '
            . 'кураторов бесплатно.');
    }
    if ($slug !== '') {
        $link = $base . '/p/' . $slug;
        $inner .= lm_p('Постоянная ссылка учреждения для заявок: '
            . '<a href="' . h($link) . '" style="color:#8B6F1F">' . h($link) . '</a> — '
            . 'её можно переслать преподавателям, заявки по ней засчитываются учреждению.',
            'font-size:14px;color:#4a4a55');
    }
    $inner .= lm_p('Если решение принимает не Вы, будем признательны за пересылку этого письма '
        . 'руководителю или заместителю по учебной работе.', 'font-size:14px;color:#4a4a55');
    $inner .= lm_p('Вопросы: <b>' . h($phone) . '</b>, '
        . '<a href="mailto:' . h($boxPart) . '" style="color:#8B6F1F">' . h($boxPart) . '</a>.',
        'font-size:13.5px;color:#6b6b75');

    $html = mm_email_layout($inner, [
        'vip'             => false,
        'preheader'       => 'Подтверждение партнёрства — одно нажатие, без договора и платежей.',
        'unsubscribe_url' => $unsub,
        'audience_note'   => 'Письмо направлено на официальный адрес учреждения, '
                           . 'опубликованный в открытых источниках.',
    ]);
    // Тема честная: тому, кто письмо открывал, так и пишем; остальным нейтрально.
    // Утверждать «вы открывали» там, где отметки об открытии нет, нельзя: она может
    // не сработать, и человек прочтёт заведомую неправду о себе.
    $subj = $GLOBALS['pf_delivered']
        ? 'Партнёрство: остаётся подтвердить' . ($org !== '' ? ' — ' . mb_substr($org, 0, 60) : '')
        : 'Вы открывали наше письмо о партнёрстве' . ($org !== '' ? ' — ' . mb_substr($org, 0, 60) : '');
    return ['subject' => $subj, 'html' => $html];
};

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
    $mail = $opened ? $buildShort($rows[0], $base . '/api/v1/unsubscribe.php?token=preview')
                    : $build($rows[0], $base . '/api/v1/unsubscribe.php?token=preview');
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

    if (!function_exists('inst_unsub_token')) require_once BASE_PATH . '/core/institutions.php';
    $token  = inst_unsub_token((int) $r['id']);   // учреждение не заводим в базу участников
    $active = 1;
    if (!$active) {                                  // отписан — не трогаем
        try { update('institutions', ['status' => 'unsubscribed'], 'id=:id', ['id' => (int) $r['id']]); }
        catch (\Throwable $e) {}
        $skipped++;
        continue;
    }
    $unsub = $base . '/api/v1/unsubscribe.php?token=' . urlencode($token);

    if ($dry) { $queued++; continue; }
    try {
        $mail = $opened ? $buildShort($r, $unsub) : $build($r, $unsub);
        insert('mail_queue', [
            'to_email'      => $email,
            'to_name'       => (string) $r['name'],
            'subject'       => $mail['subject'],
            'body'          => $mail['html'],
            'attach'        => '',
            'status'        => 'queued',
            // Открывшим — вперёд очереди: это самая тёплая группа. Остальным обычная
            // очередь: первое касание для тех, кто письма ещё не видел, важнее второго.
            'priority'      => $delivered ? 5 : 7,
            'campaign_type' => 'inst',                // та же волна, тот же ящик novosti@
        ]);
        $queued++;
    } catch (\Throwable $e) { $skipped++; }
}

printf("\n%s\n  %s: %s, пропущено: %s\n", $line,
    $dry ? 'поставили бы' : 'поставлено в очередь',
    number_format($queued, 0, '.', ' '), number_format($skipped, 0, '.', ' '));
if ($dry) echo "  сухой прогон: ничего не изменено\n";
