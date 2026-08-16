<?php
/**
 * ПАРТНЁРСКОЕ ПРЕДЛОЖЕНИЕ УЧРЕЖДЕНИЮ ВТОРЫМ КАНАЛОМ — ВКОНТАКТЕ.
 *
 * Почтой мы шлём учреждению официальное обращение: приглашение принять статус
 * информационного партнёра, бланк с подписью и печатью во вложении, именная
 * ссылка для согласия одним нажатием. Канал рабочий, но у него есть предел:
 * письмо приходит на официальный ящик, который в школе или доме культуры
 * открывают раз в неделю, а часть адресов и вовсе мертва.
 *
 * Здесь то же самое предложение идёт в сообщения сообщества учреждения. Читает
 * его тот же человек, который ведёт страницу, и читает в тот же день. Ничего
 * нового мы не придумываем: и текст, и документ, и ссылка согласия те же самые,
 * что в письме, поэтому учреждение видит одно предложение, а не два разных.
 *
 * ЧТО УХОДИТ АДРЕСАТУ
 *   1. Текст обращения с исходящим номером — деловой, как письмо, но короче:
 *      в мессенджере длинное полотно не читают.
 *   2. Официальный бланк PDF с тем же номером — документом ВКонтакте.
 *   3. Именная ссылка согласия: то же partner_join_url, что и в письме, поэтому
 *      согласие по любому каналу включает одну и ту же цепочку.
 *
 * ОДИН РАЗ НА УЧРЕЖДЕНИЕ. Повторных обращений нет: адресат помечается в журнале
 * сразу, и второй раз в очередь не попадает, даже если у учреждения несколько
 * сообществ. Тем, кто уже партнёр или отказался, не пишем вовсе.
 *
 * БЛАНК НЕ КОПИТСЯ. PDF нужен ровно на время загрузки в ВКонтакте: после
 * отправки локальный файл удаляется, документ живёт у адресата в диалоге.
 */
declare(strict_types=1);

require_once __DIR__ . '/vk.php';
require_once __DIR__ . '/partner.php';

/** Журнал обращений: кому написали, каким номером, чем кончилось. */
function vko_ensure(): void {
    static $done = false;
    if ($done) return;
    $done = true;
    db()->exec("CREATE TABLE IF NOT EXISTS vk_outreach_log (
        id             INTEGER PRIMARY KEY AUTOINCREMENT,
        institution_id INTEGER NOT NULL,
        group_id       INTEGER NOT NULL,
        letter_no      TEXT    DEFAULT '',
        outcome        TEXT    DEFAULT 'sent',
        error          TEXT    DEFAULT '',
        has_doc        INTEGER DEFAULT 0,
        created_at     TEXT    DEFAULT (datetime('now','localtime')))");
    db()->exec("CREATE UNIQUE INDEX IF NOT EXISTS idx_vkout_inst ON vk_outreach_log(institution_id)");
    db()->exec("CREATE INDEX IF NOT EXISTS idx_vkout_created ON vk_outreach_log(created_at)");
}

/** Конкурсы сезона: бесплатный первым, как в письме. */
function vko_comps(): array {
    $c = all("SELECT id, slug, name, is_paid, price, end_date FROM competitions
               WHERE status='open' ORDER BY is_paid ASC, sort ASC, id ASC");
    return $c ?: [];
}

/**
 * Официальное обращение для этого учреждения: номер в реестре и бланк PDF.
 *
 * Номер настоящий и проверяемый: страница /letter/<номер> собирается из базы,
 * поэтому учреждение может убедиться, что документ наш, даже если файл потеряется.
 *
 * @return array{number:string, pdf:string}
 */
function vko_letter(array $inst, array $comps): array {
    if (!function_exists('ol_create'))            require_once __DIR__ . '/letter_texts.php';
    if (!function_exists('pdf_official_letter'))  require_once __DIR__ . '/pdf_letter.php';

    $org = (string) ($inst['name'] ?? '');
    $o = [
        'kind'        => 'institution',
        'org'         => $org,
        'person'      => '',
        'person_role' => 'Руководителю ' . $org,
        'region'      => (string) ($inst['region'] ?? ''),
        'city'        => trim((string) ($inst['city'] ?? '')),
        'email'       => (string) ($inst['email'] ?? ''),
        'channel'     => 'vk',
    ];
    try { $L = ol_create($o); } catch (\Throwable $e) { return ['number' => '', 'pdf' => '']; }

    $number = (string) $L['number'];
    $pdf = '';
    try {
        $pdf = pdf_official_letter($o + [
            'number'      => $number,
            'title'       => 'Обращение',
            'addressee'   => ['Руководителю ' . $org],
            'salutation'  => 'Уважаемые коллеги!',
            'attachments' => ['Положения конкурсов сезона (по ссылке на официальном сайте).'],
            'body'        => ol_body_institution($comps, [
                'org'      => $org,
                'join_url' => partner_join_url((int) ($inst['id'] ?? 0)),
            ]),
        ]);
    } catch (\Throwable $e) { $pdf = ''; }

    return ['number' => $number, 'pdf' => is_string($pdf) ? $pdf : ''];
}

/**
 * Загрузить файл в диалог как документ ВКонтакте.
 * Возвращает строку вложения doc<owner>_<id> или '' при неудаче.
 */
function vko_upload_doc(int $peerId, string $path, string $title): string {
    if ($path === '' || !is_file($path)) return '';

    $s = vk_api('docs.getMessagesUploadServer', ['type' => 'doc', 'peer_id' => $peerId]);
    $url = (string) ($s['response']['upload_url'] ?? '');
    if ($url === '') return '';

    $ch = curl_init($url);
    curl_setopt_array($ch, [
        CURLOPT_POST => true,
        CURLOPT_POSTFIELDS => ['file' => new CURLFile($path, 'application/pdf', basename($path))],
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_TIMEOUT => 90,
    ]);
    $raw = (string) curl_exec($ch);
    curl_close($ch);
    $up = json_decode($raw, true);
    if (!is_array($up) || empty($up['file'])) return '';

    $save = vk_api('docs.save', ['file' => (string) $up['file'], 'title' => mb_substr($title, 0, 120)]);
    $doc = $save['response']['doc'] ?? ($save['response'][0] ?? []);
    if (!$doc) return '';
    return 'doc' . (int) ($doc['owner_id'] ?? 0) . '_' . (int) ($doc['id'] ?? 0);
}

/**
 * Текст обращения для мессенджера.
 *
 * Тот же смысл и тот же порядок, что в письме: кому, о чём, привилегии партнёра,
 * конкурсы сезона, как согласиться. Отличие одно — короче: в переписке никто не
 * читает полторы страницы, а всё подробное лежит в приложенном бланке.
 */
function vko_message(array $inst, string $number, array $comps, string $joinUrl): string {
    $org  = trim((string) ($inst['name'] ?? ''));
    $site = (string) cfgv('domain', 'музыкальный-мир.рф');
    $tel  = (string) cfgv('org_phone', '');
    $box  = function_exists('ol_box_email') ? ol_box_email('partner') : (string) cfgv('org_email', '');

    $dl = '';
    foreach ($comps as $c) {
        $d = trim((string) ($c['end_date'] ?? ''));
        if ($d !== '' && ($dl === '' || $d < $dl)) $dl = $d;
    }
    $dlRu = $dl !== '' ? preg_replace('~\s+\d{4}$~u', '', ru_date($dl)) : '';

    $list = '';
    foreach ($comps as $c) {
        $nm = trim((string) ($c['name'] ?? ''));
        if ($nm === '') continue;
        $list .= '• ' . $nm . ((int) ($c['is_paid'] ?? 0) === 1
            ? ' — оргвзнос ' . (int) ($c['price'] ?? 0) . ' ₽'
            : ' — участие бесплатное') . "\n";
    }

    $t  = 'Руководителю ' . $org . "\n";
    if ($number !== '') $t .= 'Исходящий № ' . $number . ' от ' . ru_date(date('Y-m-d')) . "\n";
    $t .= "\nУважаемые коллеги!\n\n";
    $t .= 'Культурный центр «Музыкальный Мир» приглашает ' . $org . ' принять статус '
        . "Информационного партнёра и рассмотреть участие обучающихся и педагогов в дистанционных "
        . "конкурсах культуры и искусства: вокал, хореография, инструментальное исполнительство, "
        . "изобразительное и декоративно-прикладное творчество, художественное слово, театр.\n\n";

    $t .= "Статус партнёра даёт учреждению:\n"
        . "1. Именной сертификат на бланке центра с подписью и печатью, действителен год.\n"
        . "2. Право использовать статус на сайте учреждения и в отчётности.\n"
        . "3. Благодарственные письма руководству и педагогам-кураторам — бесплатно, с 5 заявок.\n"
        . "4. Промокод на скидку 10% для участников — с 10 заявок.\n"
        . "5. Приоритетную аттестацию: результаты и дипломы за 4 рабочих дня вместо 5.\n"
        . "6. Кабинет партнёра на сайте: заявки, статистика, документы.\n"
        . "7. Персональную ссылку — заявки автоматически учитываются за учреждением.\n\n";

    if ($list !== '') {
        $t .= 'Конкурсы сезона' . ($dlRu !== '' ? ' (приём заявок до ' . $dlRu . ')' : '') . ":\n" . $list . "\n";
    }

    $t .= "Участие дистанционное: работа принимается видеозаписью или изображением по ссылке, "
        . "приезжать никуда не нужно. Каждый участник получает электронный диплом с результатом "
        . "аттестации жюри.\n\n";

    $t .= "Подтвердить партнёрство можно одним нажатием, ответное письмо не требуется:\n"
        . link_human($joinUrl) . "\n\n";

    $t .= "К сообщению приложено официальное обращение на бланке центра (PDF).\n\n"
        . 'Положения конкурсов и форма заявки: ' . $site . "\n"
        . 'Партнёрский отдел: ' . $tel . ($box !== '' ? ', ' . $box : '') . "\n"
        . "Режим работы: Пн–Пт 09:00–18:00 (МСК).\n\n"
        . 'С уважением, Оргкомитет Культурного центра «Музыкальный Мир»';

    // Предел сообщения ВКонтакте — 4096 символов. Обрезаем не текст целиком, а
    // перечень конкурсов: он повторяется в приложенном бланке.
    if (mb_strlen($t) > 4000) $t = mb_substr($t, 0, 3990) . '…';
    return $t;
}

/**
 * Написать одному учреждению: обращение + бланк + ссылка согласия.
 *
 * @return array{ok:bool, error:string, fatal:bool, number:string, doc:bool}
 */
function vko_send(array $inst, int $groupId, array $comps): array {
    vko_ensure();
    $instId = (int) ($inst['id'] ?? 0);
    $peer   = -$groupId;

    $L   = vko_letter($inst, $comps);
    $doc = $L['pdf'] !== '' ? vko_upload_doc($peer, $L['pdf'], 'Обращение № ' . $L['number'] . '.pdf') : '';
    // Бланк нужен был только на время загрузки: дальше он живёт у адресата.
    if ($L['pdf'] !== '' && is_file($L['pdf'])) @unlink($L['pdf']);

    $msg = vko_message($inst, $L['number'], $comps, partner_join_url($instId));

    $params = ['peer_id' => $peer, 'message' => $msg, 'random_id' => random_int(1, PHP_INT_MAX)];
    if ($doc !== '') $params['attachment'] = $doc;
    $r = vk_api('messages.send', $params);

    if (isset($r['error'])) {
        $code = (int) ($r['error']['error_code'] ?? 0);
        $emsg = (string) ($r['error']['error_msg'] ?? '?');
        q("INSERT OR IGNORE INTO vk_outreach_log (institution_id, group_id, letter_no, outcome, error)
           VALUES (:i,:g,:n,'error',:e)",
          ['i' => $instId, 'g' => $groupId, 'n' => $L['number'], 'e' => mb_substr($emsg, 0, 200)]);
        return ['ok' => false, 'error' => $emsg, 'fatal' => in_array($code, [6, 9, 29], true),
                'number' => $L['number'], 'doc' => $doc !== ''];
    }

    q("INSERT OR IGNORE INTO vk_outreach_log (institution_id, group_id, letter_no, outcome, has_doc)
       VALUES (:i,:g,:n,'sent',:d)",
      ['i' => $instId, 'g' => $groupId, 'n' => $L['number'], 'd' => $doc !== '' ? 1 : 0]);
    // Отметка в истории партнёра: видно, что предложение ушло и каким каналом.
    partner_log_event($instId, 'vk_outreach', json_encode(
        ['no' => $L['number'], 'group' => $groupId, 'doc' => $doc !== ''], JSON_UNESCAPED_UNICODE));

    return ['ok' => true, 'error' => '', 'fatal' => false, 'number' => $L['number'], 'doc' => $doc !== ''];
}

/**
 * Очередь адресатов.
 *
 * Порядок не случайный, а по нужде во втором канале:
 *   1. учреждения, чья почта отбила письмо — до них почта не дошла вовсе;
 *   2. те, у кого адреса нет;
 *   3. те, у кого стена закрыта — анонс им не положишь, остаётся только диалог;
 *   4. остальные профильные, от крупных к мелким.
 * Не берём тех, кому уже писали, кто уже партнёр, кто отказался и кто в стоп-листе.
 */
function vko_queue(int $limit): array {
    vko_ensure();
    return all("SELECT i.*, t.group_id, t.can_post, t.can_suggest, t.members
                  FROM vk_targets t
                  JOIN institutions i ON i.id = t.institution_id
                  LEFT JOIN vk_outreach_log l ON l.institution_id = i.id
                 WHERE t.score >= 12
                   AND i.id > 0
                   AND l.id IS NULL
                   AND COALESCE(i.partner_status,'') NOT IN ('accepted','declined','blocked')
                   AND COALESCE(i.status,'') <> 'unsubscribed'
                   AND NOT EXISTS (SELECT 1 FROM mail_stop s WHERE LOWER(s.email) = LOWER(i.email))
                 ORDER BY (COALESCE(i.bounce_count,0) > 0) DESC,
                          (COALESCE(i.email,'') = '') DESC,
                          (t.can_post = 0 AND t.can_suggest = 0) DESC,
                          t.members DESC
                 LIMIT :l", ['l' => $limit]);
}
