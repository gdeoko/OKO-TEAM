<?php
/**
 * ПРИГЛАШЕНИЯ УЧРЕЖДЕНИЯМ — ПОСТАНОВКА В ОЧЕРЕДЬ.
 *
 * Здесь письма только ГОТОВЯТСЯ. Ни одно не отправляется: они ложатся в mail_queue
 * как массовые (priority = 5), а наружу их выпускает общий воркер — по дневной норме,
 * ровным темпом, в окно 09:00–18:00 и только при поднятом стоп-кране. Разделение
 * намеренное: подготовить тысячу писем должно быть безопасно и обратимо, а решение
 * «отправляем» принимается один раз и в другом месте.
 *
 * ЧТО ДЕЛАЕТ ЭТО ПИСЬМО ЗАКОННЫМ И НЕ СПАМОМ:
 *   • адрес взят с официального сайта учреждения или из его открытой карточки —
 *     то есть опубликован самой организацией как способ связи;
 *   • адресат — организация, а не человек; в письме нет персональных обращений;
 *   • отписка в один клик, ссылка в подвале и в заголовке List-Unsubscribe;
 *   • одно письмо на учреждение за волну, повторы считаются;
 *   • отказ — окончательный: статус 'unsubscribed', больше не пишем никогда.
 */
declare(strict_types=1);

if (!function_exists('inst_pick_for_invite')) require_once __DIR__ . '/institutions.php';

/**
 * Конкурсы, которые предлагаем в письме: открытые, с приёмом заявок.
 * Бесплатный ставится первым — учреждению важно видеть, что участие возможно
 * и без бюджета (сортировка внутри invite_institution_body).
 */
function invite_open_comps(): array {
    try {
        return all("SELECT name, is_paid, price, slug, end_date
                      FROM competitions
                     WHERE status='open'
                     ORDER BY sort ASC, id ASC");
    } catch (\Throwable $e) { return []; }
}

/**
 * Ставит приглашения в очередь для учреждений со статусом «Новое».
 *
 * @return array ['queued'=>int, 'skipped'=>int, 'comps'=>int]
 */
function invite_queue_institutions(int $limit = 500): array {
    inst_migrate();

    $comps = invite_open_comps();
    if (!$comps) return ['queued' => 0, 'skipped' => 0, 'comps' => 0, 'error' => 'нет открытых конкурсов'];

    if (!function_exists('invite_institution_email')) require_once __DIR__ . '/invite_institution.php';
    if (!function_exists('nl_ensure_subscriber'))     require_once __DIR__ . '/newsletter.php';
    if (!function_exists('nl_ensure_campaign_type_col')) require_once __DIR__ . '/newsletter.php';
    nl_ensure_campaign_type_col();

    // Срок приёма — по самому раннему закрытию среди открытых конкурсов: обещать
    // больше, чем есть, нельзя.
    $deadline = '';
    foreach ($comps as $c) {
        $d = trim((string) ($c['end_date'] ?? ''));
        if ($d === '') continue;
        if ($deadline === '' || $d < $deadline) $deadline = $d;
    }
    $deadlineHuman = $deadline !== '' ? date('d.m.Y', strtotime($deadline)) : date('d.m.Y', strtotime('last day of this month'));

    $base    = rtrim((string) cfgv('base_url'), '/');
    $rows    = inst_pick_for_invite($limit);
    $queued  = 0;
    $skipped = 0;

    foreach ($rows as $r) {
        $email = trim((string) $r['email']);
        if ($email === '' || !filter_var($email, FILTER_VALIDATE_EMAIL)) { $skipped++; continue; }

        // Отписка обязательна и обязана работать. Токен заводим через тот же
        // механизм, что и для обычных подписчиков: тогда переход по ссылке
        // отпишет адрес и в subscribers, и в базе учреждений.
        [$token, $active] = nl_ensure_subscriber($email, (string) $r['name'], 'institution');
        if (!$active) {                      // уже отписывались — не трогаем
            try { update('institutions', ['status' => 'unsubscribed'], 'id=:id', ['id' => (int) $r['id']]); } catch (\Throwable $e) {}
            $skipped++;
            continue;
        }
        $unsub = $base . '/api/v1/unsubscribe.php?token=' . urlencode($token);

        // ИМЕННОЕ ОБРАЩЕНИЕ, ЕСЛИ ЗНАЕМ ДИРЕКТОРА.
        // «Уважаемая Мария Петровна» и «Уважаемые коллеги» — письма разной судьбы:
        // первое читают, второе удаляют не открыв. ФИО руководителей пришли из
        // официального реестра Минкультуры, так что имя в письме — не выдумка.
        $letter = null;
        $fio = trim((string) ($r['director'] ?? ''));
        if ($fio !== '') {
            $letter = invite_official_letter($r, $fio);
        }

        $mail = $letter
            ? ['subject' => $letter['subject'], 'html' => $letter['html'] . invite_unsub_line($unsub)]
            : invite_institution_email($comps, $unsub, ['deadline' => $deadlineHuman]);

        try {
            $qid = (int) insert('mail_queue', [
                'to_email'      => mb_strtolower($email),
                'to_name'       => (string) $r['name'],
                'subject'       => (string) $mail['subject'],
                'body'          => (string) $mail['html'],
                'status'        => 'queued',
                'priority'      => 5,          // МАССОВОЕ: пойдёт через bulk-пул по норме
                'campaign_type' => 'konkurs',
            ]);
            // Реестр исходящих узнаёт, каким письмом ушло обращение: пока письмо
            // не отправлено, страница проверки подлинности по его номеру молчит.
            if ($letter && $qid > 0) {
                try {
                    update('official_letters', ['queue_id' => $qid, 'status' => 'queued'],
                           'id=:id', ['id' => (int) $letter['id']]);
                } catch (\Throwable $e) {}
            }
            inst_mark_invited((int) $r['id']);
            $queued++;
        } catch (\Throwable $e) {
            $skipped++;
        }
    }

    return ['queued' => $queued, 'skipped' => $skipped, 'comps' => count($comps)];
}

/**
 * Официальное обращение в учреждение — бланком прямо в теле письма.
 *
 * Вложением PDF здесь НЕ отправляем сознательно. Во-первых, тридцать тысяч
 * писем с гигабайтами вложений — это часы отправки и почти гарантированный
 * спам-фильтр. Во-вторых, вложение надо открыть, а бланк в теле виден сразу,
 * с логотипом, подписью, печатью, исходящим номером и QR-кодом проверки.
 * Картинки идут ссылками на наш сайт, поэтому письмо весит килобайты.
 */
function invite_official_letter(array $inst, string $fio): ?array {
    if (!function_exists('ol_create'))  require_once __DIR__ . '/letter_texts.php';
    if (!function_exists('ol_migrate')) require_once __DIR__ . '/official_letter.php';

    $city = trim((string) ($inst['city'] ?? ''));
    $o = [
        'kind'        => 'institution',
        'org'         => (string) ($inst['name'] ?? ''),
        'person'      => $fio,
        'person_role' => 'Руководителю ' . (string) ($inst['name'] ?? ''),
        'region'      => (string) ($inst['region'] ?? ''),
        'city'        => $city,
        'email'       => (string) ($inst['email'] ?? ''),
        'embed'       => false,          // картинки ссылками — письмо лёгкое
    ];

    try { $L = ol_create($o); } catch (\Throwable $e) { return null; }

    $parts = preg_split('~\s+~u', $fio) ?: [];
    $name  = count($parts) >= 3 ? ($parts[1] . ' ' . $parts[2]) : $fio;

    return [
        'id'      => (int) $L['id'],
        'number'  => (string) $L['number'],
        'subject' => $name . ', приглашаем учреждение к участию в конкурсах (исх. №' . $L['number'] . ')',
        'html'    => (string) $L['html'],
    ];
}

/**
 * ПОВТОРНОЕ ПРИГЛАШЕНИЕ — раз в квартал, не чаще.
 *
 * Отдельная функция, а не флаг у первой: у повтора другая выборка (кому уже
 * писали и кто промолчал) и другой смысл — напомнить о новом сезоне. Текст тот
 * же: конкурсы в нём каждый раз новые, а значит, письмо не повторяется.
 */
function invite_requeue_institutions(int $limit = 500, int $months = 3): array {
    inst_migrate();

    $comps = invite_open_comps();
    if (!$comps) return ['queued' => 0, 'skipped' => 0, 'comps' => 0, 'error' => 'нет открытых конкурсов'];

    if (!function_exists('invite_institution_email')) require_once __DIR__ . '/invite_institution.php';
    if (!function_exists('nl_ensure_subscriber'))     require_once __DIR__ . '/newsletter.php';
    nl_ensure_campaign_type_col();

    $base    = rtrim((string) cfgv('base_url'), '/');
    $rows    = inst_pick_for_reinvite($limit, $months);
    $queued  = 0; $skipped = 0;

    foreach ($rows as $r) {
        $email = trim((string) $r['email']);
        if ($email === '' || !filter_var($email, FILTER_VALIDATE_EMAIL)) { $skipped++; continue; }

        [$token, $active] = nl_ensure_subscriber($email, (string) $r['name'], 'institution');
        if (!$active) {
            try { update('institutions', ['status' => 'unsubscribed'], 'id=:id', ['id' => (int) $r['id']]); } catch (\Throwable $e) {}
            $skipped++;
            continue;
        }
        $unsub = $base . '/api/v1/unsubscribe.php?token=' . urlencode($token);

        $fio    = trim((string) ($r['director'] ?? ''));
        $letter = $fio !== '' ? invite_official_letter($r, $fio) : null;
        $mail   = $letter
            ? ['subject' => $letter['subject'], 'html' => $letter['html'] . invite_unsub_line($unsub)]
            : invite_institution_email($comps, $unsub, []);

        try {
            $qid = (int) insert('mail_queue', [
                'to_email'      => mb_strtolower($email),
                'to_name'       => (string) $r['name'],
                'subject'       => (string) $mail['subject'],
                'body'          => (string) $mail['html'],
                'status'        => 'queued',
                'priority'      => 5,
                'campaign_type' => 'konkurs',
            ]);
            if ($letter && $qid > 0) {
                try {
                    update('official_letters', ['queue_id' => $qid, 'status' => 'queued'],
                           'id=:id', ['id' => (int) $letter['id']]);
                } catch (\Throwable $e) {}
            }
            inst_mark_invited((int) $r['id']);
            $queued++;
        } catch (\Throwable $e) { $skipped++; }
    }

    return ['queued' => $queued, 'skipped' => $skipped, 'comps' => count($comps)];
}

/**
 * БЛАГОДАРНОСТЬ УЧРЕЖДЕНИЮ — сама, бесплатно, тем, кто откликнулся.
 *
 * Откликнулся — значит ответил на обращение или его педагоги привели участников
 * (статус 'replied' ставится и в том, и в другом случае). Документ стоит нам
 * ноль, а учреждению нужен: он идёт в годовой отчёт о работе с одарёнными детьми.
 *
 * Благодарность выдаётся один раз за сезон: спасибо, сказанное дважды в месяц,
 * перестаёт быть спасибо.
 */
function invite_queue_thanks(int $limit = 200): array {
    inst_migrate();
    if (!function_exists('ol_create')) require_once __DIR__ . '/letter_texts.php';
    if (!function_exists('nl_ensure_campaign_type_col')) require_once __DIR__ . '/newsletter.php';
    nl_ensure_campaign_type_col();

    $season = date('Y');
    $rows = [];
    try {
        $rows = all(
            "SELECT i.* FROM institutions i
              WHERE i.email <> '' AND i.status = 'replied'
                AND NOT EXISTS (SELECT 1 FROM official_letters l
                                 WHERE l.email = i.email AND l.kind='thanks' AND l.season LIKE ?)
              ORDER BY i.replied_at DESC LIMIT ?",
            [$season . '-%', max(1, min(1000, $limit))]
        );
    } catch (\Throwable $e) { $rows = []; }

    $queued = 0;
    foreach ($rows as $r) {
        $fio = trim((string) ($r['director'] ?? ''));
        $o = [
            'kind'        => 'thanks',
            'org'         => (string) $r['name'],
            'person'      => $fio,
            'person_role' => $fio !== '' ? ('Руководителю ' . (string) $r['name']) : '',
            'region'      => (string) $r['region'],
            'email'       => (string) $r['email'],
            'season'      => $season,
            'embed'       => false,
        ];

        try { $L = ol_create($o); } catch (\Throwable $e) { continue; }

        try {
            $qid = (int) insert('mail_queue', [
                'to_email'      => mb_strtolower((string) $r['email']),
                'to_name'       => (string) $r['name'],
                'subject'       => 'Благодарственное письмо Культурного центра «Музыкальный Мир» (исх. №' . $L['number'] . ')',
                'body'          => (string) $L['html'],
                'status'        => 'queued',
                'priority'      => 0,          // это личное письмо, а не рассылка
                'campaign_type' => 'official',
            ]);
            if ($qid > 0) {
                update('official_letters', ['queue_id' => $qid, 'status' => 'queued'],
                       'id=:id', ['id' => (int) $L['id']]);
                $queued++;
            }
        } catch (\Throwable $e) {}
    }

    return ['queued' => $queued, 'candidates' => count($rows)];
}

/** Строка отписки под бланком — обязательна даже в официальном письме. */
function invite_unsub_line(string $unsub): string {
    return '<div style="max-width:210mm;margin:14px auto 0;font:12px/1.5 Arial,sans-serif;'
         . 'color:#8a8a95;text-align:center">'
         . 'Письмо направлено на официальный адрес учреждения, опубликованный в открытых источниках. '
         . 'Если рассылка не нужна — <a href="' . h($unsub) . '" style="color:#8a8a95">откажитесь в один клик</a>, '
         . 'и мы больше не напишем.'
         . '</div>';
}
