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
            $letter = invite_official_letter($r, $fio, $comps, $unsub);
        }

        $mail = $letter
            ? ['subject' => $letter['subject'], 'html' => $letter['html']]
            : invite_institution_email($comps, $unsub, ['deadline' => $deadlineHuman]);

        try {
            $pdf = $letter ? (string) ($letter['pdf'] ?? '') : '';
            $qid = (int) insert('mail_queue', [
                'to_email'      => mb_strtolower($email),
                'to_name'       => (string) $r['name'],
                'subject'       => (string) $mail['subject'],
                'body'          => (string) $mail['html'],
                // Документ уходит файлом: его распечатывают и подшивают, а из тела
                // письма подшить нечего.
                'attach'        => $pdf !== '' && is_file($pdf) ? $pdf : '',
                'status'        => 'queued',
                'priority'      => 5,          // МАССОВОЕ: пойдёт через bulk-пул по норме
                // Свой тип кампании: у писем учреждениям отдельная суточная доля,
                // иначе они встали бы в очередь ЗА волной по своей базе и начали
                // уходить через две недели, когда приём уже закрыт.
                'campaign_type' => 'inst',
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
 * Официальное обращение в учреждение — письмом с ИЗОБРАЖЕНИЕМ документа.
 *
 * Раньше бланк вставлялся в тело письма разметкой. В браузере он выглядел
 * ровным листом А4, а в почте разваливался: клиенты не поддерживают ни grid,
 * ни flex, ни миллиметры — печать растягивалась во весь экран, QR занимал
 * пол-письма. Теперь лист рисуется картинкой и вставляется одним изображением,
 * а вокруг идёт обычный фирменный шаблон письма с кнопками и текстом.
 */
function invite_official_letter(array $inst, string $fio, array $comps, string $unsub = ''): ?array {
    if (!function_exists('ol_create'))          require_once __DIR__ . '/letter_texts.php';
    if (!function_exists('lm_mail_institution')) require_once __DIR__ . '/letter_mail.php';

    $o = [
        'kind'        => 'institution',
        'org'         => (string) ($inst['name'] ?? ''),
        'person'      => $fio,
        'person_role' => 'Руководителю ' . (string) ($inst['name'] ?? ''),
        'region'      => (string) ($inst['region'] ?? ''),
        'city'        => trim((string) ($inst['city'] ?? '')),
        'email'       => (string) ($inst['email'] ?? ''),
    ];

    try { $L = ol_create($o); } catch (\Throwable $e) { return null; }

    $inst['director'] = $fio;
    try {
        $mail = lm_mail_institution($inst, (string) $L['number'], $comps, $unsub);
    } catch (\Throwable $e) { return null; }

    return [
        'id'      => (int) $L['id'],
        'number'  => (string) $L['number'],
        'subject' => (string) $mail['subject'],
        'html'    => (string) $mail['html'],
        'pdf'     => (string) ($mail['pdf'] ?? ''),
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
        $letter = $fio !== '' ? invite_official_letter($r, $fio, $comps, $unsub) : null;
        $mail   = $letter
            ? ['subject' => $letter['subject'], 'html' => $letter['html']]
            : invite_institution_email($comps, $unsub, []);

        try {
            $pdf = $letter ? (string) ($letter['pdf'] ?? '') : '';
            $qid = (int) insert('mail_queue', [
                'to_email'      => mb_strtolower($email),
                'to_name'       => (string) $r['name'],
                'subject'       => (string) $mail['subject'],
                'body'          => (string) $mail['html'],
                'attach'        => $pdf !== '' && is_file($pdf) ? $pdf : '',
                'status'        => 'queued',
                'priority'      => 5,
                'campaign_type' => 'inst',
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
    if (!function_exists('ol_create'))     require_once __DIR__ . '/letter_texts.php';
    if (!function_exists('lm_mail_thanks')) require_once __DIR__ . '/letter_mail.php';
    if (!function_exists('nl_ensure_campaign_type_col')) require_once __DIR__ . '/newsletter.php';
    nl_ensure_campaign_type_col();

    $season = date('Y');

    // БЛАГОДАРИМ ТОЛЬКО ТЕХ, КТО ДЕЙСТВИТЕЛЬНО УЧАСТВОВАЛ ИЛИ ОТВЕТИЛ.
    // Разослать благодарность «за поддержку» тому, кто нам ни разу не ответил и
    // никого не выставил, значит соврать в документе с печатью. Такое письмо
    // обесценивает все остальные и злит адресата.
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

        // Кто из педагогов этого учреждения выставлял учеников. Название
        // учреждения участник вписывает руками, поэтому сравниваем по нормали:
        // без кавычек, регистра и лишних пробелов.
        [$teachers, $works] = invite_thanks_teachers((string) $r['name']);

        $o = [
            'kind'        => 'thanks',
            'org'         => (string) $r['name'],
            'person'      => $fio,
            'person_role' => $fio !== '' ? ('Руководителю ' . (string) $r['name']) : '',
            'region'      => (string) $r['region'],
            'email'       => (string) $r['email'],
            'season'      => $season,
            'teachers'    => $teachers,
            'works'       => $works,
        ];

        try { $L = ol_create($o); } catch (\Throwable $e) { continue; }

        try { $mail = lm_mail_thanks($r + ['director' => $fio], (string) $L['number'], $works, $teachers); }
        catch (\Throwable $e) { continue; }

        // К письму директору прикладываем и его благодарность, и персональные
        // благодарности каждому педагогу: их вручают на педсовете.
        $files = [];
        $pdf = (string) ($mail['pdf'] ?? '');
        if ($pdf !== '' && is_file($pdf)) $files[] = $pdf;
        foreach ($teachers as $t) {
            $f = invite_thanks_teacher_pdf((string) $r['name'], (string) ($t['name'] ?? ''), (int) ($t['works'] ?? 0));
            if ($f !== '') $files[] = $f;
        }

        try {
            $qid = (int) insert('mail_queue', [
                'to_email'      => mb_strtolower((string) $r['email']),
                'to_name'       => (string) $r['name'],
                'subject'       => (string) $mail['subject'],
                'body'          => (string) $mail['html'],
                'attach'        => $files
                    ? json_encode($files, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES) : '',
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

/** Название учреждения без кавычек, регистра и сокращений, для сравнения. */
function invite_norm_org(string $s): string {
    $s = mb_strtolower(trim($s));
    $s = str_replace(['«', '»', '"', "'", '.', ','], ' ', $s);
    $s = preg_replace('~\b(мбу|мау|мбоу|маоу|гбу|гау|моу|му|до|дод|оу)\b~u', ' ', $s) ?? $s;
    return trim(preg_replace('~\s+~u', ' ', $s) ?? $s);
}

/**
 * Педагоги учреждения, чьи ученики прошли аттестацию, и общее число работ.
 *
 * @return array{0: array<int, array{name:string, works:int}>, 1: int}
 */
function invite_thanks_teachers(string $org): array {
    $key = invite_norm_org($org);
    if ($key === '') return [[], 0];

    $rows = [];
    try {
        $rows = all("SELECT teacher, institution FROM applications
                      WHERE COALESCE(teacher,'') <> '' AND COALESCE(institution,'') <> ''
                        AND COALESCE(status,'') NOT IN ('rejected','draft')");
    } catch (\Throwable $e) { return [[], 0]; }

    $by = []; $works = 0;
    foreach ($rows as $r) {
        if (invite_norm_org((string) $r['institution']) !== $key) continue;
        $t = trim((string) $r['teacher']);
        if ($t === '') continue;
        $k = mb_strtolower($t);
        if (!isset($by[$k])) $by[$k] = ['name' => $t, 'works' => 0];
        $by[$k]['works']++;
        $works++;
    }

    usort($by, fn($a, $b) => $b['works'] <=> $a['works']);
    return [array_values($by), $works];
}

/**
 * Персональная благодарность педагогу файлом.
 * Возвращает путь к PDF или пустую строку.
 */
function invite_thanks_teacher_pdf(string $org, string $teacher, int $works): string {
    $teacher = trim($teacher);
    if ($teacher === '') return '';
    if (!function_exists('pdf_official_letter')) require_once __DIR__ . '/pdf_letter.php';
    if (!function_exists('ol_create'))           require_once __DIR__ . '/letter_texts.php';

    try {
        $L = ol_create([
            'kind'        => 'thanks',
            'org'         => $org,
            'person'      => $teacher,
            'person_role' => 'Преподавателю ' . $org,
            'season'      => date('Y'),
        ]);
        return pdf_official_letter([
            'number'     => (string) $L['number'],
            'title'      => 'Благодарственное письмо',
            'addressee'  => array_values(array_filter(['Преподавателю ' . $org, $teacher])),
            'salutation' => lm_salut($teacher),
            'body'       => ol_body_teacher($teacher, $org, $works),
            'no_approve' => true,
        ]);
    } catch (\Throwable $e) { return ''; }
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
