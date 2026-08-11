<?php
/**
 * ОБРАЩЕНИЯ В ВЕДОМСТВА — ПОДГОТОВКА И ПОСТАНОВКА В ОЧЕРЕДЬ.
 *
 * Первого числа каждого месяца, в день запуска новых конкурсов, по всем
 * министерствам культуры и образования, творческим союзам и профильным
 * порталам уходит официальное обращение с просьбой об информационной
 * поддержке. Каждое — именное, со своим исходящим номером, подписью, печатью
 * и QR-кодом проверки подлинности.
 *
 * ЧТО В ПИСЬМЕ:
 *   тело      — короткое сопроводительное письмо (ведомства просят «одно
 *               сообщение — одно письмо, при необходимости с приложением»);
 *   вложения  — обращение PDF, положение бесплатного конкурса, афиша, логотип.
 *
 * ПРО «БЕСПЛАТНО». В обращении указывается ТОЛЬКО бесплатный конкурс сезона и
 * прикладывается положение именно на него. Это не уловка: ведомство даёт
 * информационную поддержку мероприятию, и поддерживать оно будет ровно то, что
 * названо в письме, — бесплатный конкурс, куда может прийти любой ребёнок.
 * Платные конкурсы в обращении не упоминаются вовсе.
 *
 * ОТПРАВИТЕЛЬ. Только официальная почта центра (пул tx). Массовые ящики и
 * сервис рассылок сюда не допускаются: письмо в министерство, пришедшее с
 * рассылочного адреса, регистрируют как спам, а отвечать на него некуда.
 *
 * СТОП-КРАН. Пока в настройках не поднят флаг ministry_mailing_on, письма
 * ложатся в очередь со статусом paused и никуда не уходят.
 */
declare(strict_types=1);

require_once __DIR__ . '/db.php';
require_once __DIR__ . '/helpers.php';
require_once __DIR__ . '/mailer.php';
require_once __DIR__ . '/ministries.php';
require_once __DIR__ . '/official_letter.php';
require_once __DIR__ . '/letter_texts.php';
require_once __DIR__ . '/pdf_letter.php';

/** Включена ли автоматическая отправка обращений (стоп-кран). */
function mm_enabled(): bool {
    return (string) setting('ministry_mailing_on', '0') === '1';
}

function mm_set_enabled(bool $on): void {
    set_setting('ministry_mailing_on', $on ? '1' : '0');
}

/**
 * Вложения к обращению.
 *
 * Положение берём в PDF: docx у ведомства может открыться не так, как у нас, а
 * PDF выглядит одинаково везде. Если PDF ещё не собран — собираем на месте.
 */
function mm_attachments(array $free): array {
    $out = [];

    foreach ($free as $c) {
        $slug = (string) ($c['slug'] ?? '');
        if ($slug === '') continue;

        $pdf = BASE_PATH . '/public/uploads/regulations/' . $slug . '.pdf';
        if (!is_file($pdf)) {
            if (!function_exists('pdf_regulation') && is_file(BASE_PATH . '/core/pdf_regulation.php')) {
                require_once BASE_PATH . '/core/pdf_regulation.php';
            }
            if (function_exists('pdf_regulation')) {
                try { $pdf = pdf_regulation($c); } catch (\Throwable $e) { $pdf = ''; }
            }
        }
        if ($pdf !== '' && is_file($pdf)) $out[] = $pdf;

        // Афиша конкурса — та же картинка, что на сайте.
        $cover = trim((string) ($c['cover'] ?? ''));
        if ($cover !== '') {
            $abs = BASE_PATH . '/public/' . ltrim($cover, '/');
            if (is_file($abs)) $out[] = $abs;
        }
    }

    // Логотип центра — ведомства просят его для афиш и анонсов на своих ресурсах.
    $logo = BASE_PATH . '/public/assets/img/logo_muzmir_512.png';
    if (is_file($logo)) $out[] = $logo;

    return array_values(array_unique($out));
}

/** Тема письма. Номер в теме — чтобы ответ ведомства нашёлся по нему за секунду. */
function mm_subject(string $number): string {
    return 'Обращение об информационной поддержке всероссийского конкурса (исх. №' . $number . ')';
}

/**
 * Сопроводительное письмо — то, что видно в почтовом клиенте.
 *
 * Намеренно короткое. Документ приложен файлом; задача тела — за пять секунд
 * объяснить делопроизводителю, что это и что с этим делать. Длинное письмо в
 * ведомстве не читают, а короткое с приложением регистрируют.
 */
function mm_cover_html(array $r, string $number, array $free, bool $press): string {
    $site  = (string) cfgv('domain', 'музыкальный-мир.рф');
    $base  = rtrim((string) cfgv('base_url', ''), '/');
    $email = (string) cfgv('org_email', 'kulturniy.centr.mir@gmail.com');
    $phone = (string) cfgv('org_phone', '');
    $vk    = (string) cfgv('org_vk', '');

    $names = [];
    foreach ($free as $c) {
        $n = trim((string) ($c['name'] ?? ''));
        if ($n !== '') $names[] = '«' . $n . '»';
    }
    $list = $names ? implode(', ', $names) : 'всероссийского творческого конкурса';
    $dl   = ol_deadline($free);
    $dlRu = $dl !== '' ? (function_exists('ru_date') ? ru_date($dl) : date('d.m.Y', strtotime($dl))) : '';

    $salut = trim((string) ($r['person'] ?? '')) !== ''
        ? mm_salutation((string) $r['person'])
        : 'Уважаемые коллеги!';

    ob_start(); ?>
<p style="margin:0 0 14px"><b><?= h($salut) ?></b></p>

<p style="margin:0 0 14px">
  <?= $press
      ? 'Направляем информацию о всероссийском творческом конкурсе для детей и молодёжи '
      : 'Направляем официальное обращение об информационной поддержке всероссийского творческого конкурса ' ?>
  <b><?= h($list) ?></b> - <b>участие бесплатное</b>.
  <?= $dlRu !== '' ? 'Приём работ - до ' . h($dlRu) . '.' : '' ?>
</p>

<p style="margin:0 0 14px">
  Обращение за подписью генерального директора центра, с печатью и исходящим
  номером <b>№<?= h($number) ?></b>, приложено к настоящему письму отдельным файлом.
  Там же - положение о конкурсе, афиша и логотип центра для размещения на
  Ваших информационных ресурсах.
</p>

<p style="margin:0 0 14px">
  Подлинность обращения можно проверить по его номеру на официальном сайте центра:
  <a href="<?= h($base) ?>/letter/<?= h($number) ?>" style="color:#15224C"><?= h($site) ?>/letter/<?= h($number) ?></a>.
</p>

<p style="margin:0 0 6px">
  Будем признательны за ответ на фирменном бланке Вашего ведомства: полученные
  письма поддержки публикуются на сайте центра в разделе «Поддержка» - это
  подтверждает для участников и их родителей, что конкурс проводится открыто.
</p>

<p style="margin:18px 0 0;font-size:14px;color:#5a5a66">
  Культурный центр «Музыкальный Мир»<br>
  Сайт: <a href="<?= h($base) ?>" style="color:#15224C"><?= h($site) ?></a>
  <?php if ($email !== ''): ?> · Почта: <?= h($email) ?><?php endif; ?>
  <?php if ($phone !== ''): ?> · Телефон: <?= h($phone) ?><?php endif; ?>
  <?php if ($vk !== ''): ?><br>ВКонтакте: <a href="<?= h($vk) ?>" style="color:#15224C"><?= h($vk) ?></a><?php endif; ?>
</p>

<p style="margin:12px 0 0;font-size:12px;color:#8a8a95">
  Если письма от центра Вашему ведомству не нужны - ответьте одним словом «отписать»,
  и адрес будет исключён.
</p>
    <?php
    return mm_wrap((string) ob_get_clean());
}

/** Оборачивает текст в фирменный шаблон письма центра. */
function mm_wrap(string $inner): string {
    if (function_exists('mm_email_layout')) {
        return mm_email_layout($inner, ['preheader' => 'Обращение об информационной поддержке конкурса']);
    }
    return '<div style="font:16px/1.6 Georgia,serif;color:#26262c">' . $inner . '</div>';
}

/** «Уважаемая Мария Петровна!» по полному ФИО. */
function mm_salutation(string $fio): string {
    return ol_salutation($fio);
}

/**
 * Готовит и ставит в очередь обращения по всей базе ведомств.
 *
 * @param bool $activate ставить письма готовыми к отправке (иначе — paused)
 * @param int  $limit    0 — все
 * @return array сводка
 */
function mm_queue_all(bool $activate = false, int $limit = 0): array {
    min_migrate();
    ol_migrate();

    $free = ol_comps(true);
    if (!$free) {
        return ['queued' => 0, 'skipped' => 0, 'error' => 'нет ни одного бесплатного конкурса - обращение отправлять не с чем'];
    }

    $att     = mm_attachments($free);
    $attJson = json_encode($att, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    $season  = date('Y-m');
    $status  = $activate ? 'queued' : 'paused';

    $rows = min_recipients();
    if ($limit > 0) $rows = array_slice($rows, 0, $limit);

    $queued = 0; $skipped = 0;
    foreach ($rows as $r) {
        $email = (string) $r['email'];

        // Дважды за сезон одному адресу не пишем: ведомство одно, конкурсы те же.
        $dup = (int) scalar(
            "SELECT COUNT(*) FROM official_letters WHERE email=? AND season=? AND kind='support'",
            [$email, $season]
        );
        if ($dup > 0) { $skipped++; continue; }

        $press = ((string) ($r['branch'] ?? 'main')) === 'press';

        $o = [
            'kind'        => 'support',
            'org'         => (string) $r['org'],
            'person'      => (string) $r['person'],
            'person_role' => (string) $r['person_role'],
            'region'      => (string) $r['region'],
            'email'       => $email,
        ];

        // Письмо собирается новым шаблоном: фирменный лейаут, изображение
        // документа внутри и тот же PDF отдельным вложением. Бланк, вставленный
        // в тело письма разметкой, в почтовых клиентах разваливается.
        if (!function_exists('lm_mail_support')) require_once __DIR__ . '/letter_mail.php';

        $L = ol_create($o);
        $number = (string) $L['number'];

        $r['branch'] = (string) ($r['branch'] ?? 'main');
        try { $mail = lm_mail_support($r, $number, $free); }
        catch (\Throwable $e) { $skipped++; continue; }

        $pdf   = (string) ($mail['pdf'] ?? '');
        $files = $pdf !== '' && is_file($pdf) ? array_merge([$pdf], $att) : $att;

        $id = 0;
        try {
            $id = (int) insert('mail_queue', [
                'to_email'      => mb_strtolower(min_email_ascii($email)),
                'to_name'       => (string) $r['org'],
                'subject'       => (string) $mail['subject'],
                'body'          => (string) $mail['html'],
                'attach'        => json_encode($files, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES),
                'status'        => $status,
                'priority'      => 0,                 // официальная почта центра, не рассылка
                'campaign_type' => 'official',
            ]);
        } catch (\Throwable $e) { $id = 0; }

        if ($id > 0) {
            $queued++;
            // Дату отправки НЕ ставим здесь. Пока письмо не ушло, документа у
            // адресата нет, и страница проверки подлинности обязана молчать —
            // иначе по номеру можно «подтвердить» письмо, которого никто не получал.
            // Реальную дату проставит mm_sync_sent() по строке очереди.
            try {
                update('official_letters',
                    ['file' => $pdf, 'queue_id' => $id, 'status' => 'queued'],
                    'id=:id', ['id' => (int) $L['id']]);
            } catch (\Throwable $e) {}
        } else {
            $skipped++;
        }
    }

    unset($attJson);
    return ['queued' => $queued, 'skipped' => $skipped, 'attachments' => count($att), 'status' => $status];
}

/**
 * Сверяет реестр исходящих с очередью: что ушло — то отмечаем отправленным.
 *
 * Вызывается кроном. Именно с этого момента QR на бланке начинает работать:
 * страница проверки показывает документ только после фактической отправки.
 */
function mm_sync_sent(): int {
    ol_migrate();
    min_migrate();
    $n = 0;
    try {
        $rows = all("SELECT l.id, l.number, l.email, q.sent_at
                       FROM official_letters l
                       JOIN mail_queue q ON q.id = l.queue_id
                      WHERE l.queue_id > 0 AND (l.sent_at IS NULL OR l.sent_at='')
                        AND q.status='sent'");
        foreach ($rows as $r) {
            update('official_letters',
                ['sent_at' => (string) ($r['sent_at'] ?: date('Y-m-d H:i:s')), 'status' => 'sent'],
                'id=:id', ['id' => (int) $r['id']]);
            $m = one("SELECT id FROM ministries WHERE email=?", [mb_strtolower((string) $r['email'])]);
            if ($m) min_mark_sent((int) $m['id'], (string) $r['number']);
            $n++;
        }
    } catch (\Throwable $e) {}
    return $n;
}
