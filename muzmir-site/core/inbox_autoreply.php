<?php
/**
 * ПОЧТА ЦЕНТРА ТОЛЬКО ОТПРАВЛЯЕТ. ВХОДЯЩИЕ — В КОЛЛ-ЦЕНТР.
 *
 * Решение владельца. Ящики центра рассылают результаты, наградные материалы и
 * уведомления, но входящую переписку на них никто не ведёт: писем приходит
 * больше, чем можно разобрать руками, а живой ответ участник ждёт в тот же день.
 * Молчание в ответ хуже отказа — человек считает, что его не услышали.
 *
 * Поэтому на каждое письмо живого человека уходит один автоответ: почта для
 * писем центра, а вопросы — в колл-центр, и сразу две двери туда — чат на сайте
 * и сообщения сообщества ВКонтакте. Обе работают в тот же день.
 *
 * ЧЕГО ЭТОТ ОТВЕТ НЕ ДЕЛАЕТ:
 *   • не отвечает роботам, отбойникам и чужим автоответам — иначе два робота
 *     будут писать друг другу до конца времён;
 *   • не отвечает на служебные письма систем (постмастер, подтверждения);
 *   • не отвечает ведомствам и учреждениям из нашей базы: с ними центр ведёт
 *     переписку сам, и отправить министерству «пишите нам во ВКонтакте» — значит
 *     оборвать разговор, ради которого письмо и посылали;
 *   • не пишет одному адресу чаще раза в неделю, сколько бы писем он ни прислал.
 */
declare(strict_types=1);

/** Включён ли автоответ (можно выключить из настроек, не трогая код). */
function iar_enabled(): bool {
    return (string) (function_exists('setting') ? setting('inbox_autoreply', '1') : '1') === '1';
}

/** Уже отвечали этому адресу за последние N дней? */
function iar_recently_answered(string $email, int $days = 7): bool {
    $email = mb_strtolower(trim($email));
    if ($email === '') return true;
    try {
        return (bool) scalar(
            "SELECT 1 FROM mail_queue
              WHERE mb_lower(to_email)=? AND subject LIKE ?
                AND datetime(created_at) > datetime('now','localtime', ?) LIMIT 1",
            [$email, '%колл-центр%', '-' . max(1, $days) . ' days']);
    } catch (\Throwable $e) { return true; }   // не знаем — лучше промолчать
}

/** Это ведомство или учреждение из нашей базы? С ними переписку ведёт центр. */
function iar_is_institution(string $email): bool {
    $email = mb_strtolower(trim($email));
    if ($email === '') return false;
    foreach (['institutions', 'ministries'] as $t) {
        try {
            if (!function_exists('tbl_exists') || !tbl_exists($t)) continue;
            if (scalar("SELECT 1 FROM $t WHERE mb_lower(COALESCE(email,''))=? LIMIT 1", [$email])) return true;
        } catch (\Throwable $e) { /* таблицы может не быть */ }
    }
    return false;
}

/**
 * Текст автоответа: коротко о том, почему на почте не отвечают, и две двери в
 * колл-центр. Ссылки — кнопками: человек читает с телефона и должен нажать, а
 * не переписывать адрес.
 */
function iar_html(string $name = ''): string {
    $site = rtrim((string) (function_exists('cfgv') ? cfgv('base_url', '') : ''), '/');
    $vk   = (string) (function_exists('cfgv') ? cfgv('vk_group_url', 'https://vk.com/muzmir') : 'https://vk.com/muzmir');
    $chat = $site . '/cabinet';
    $hi   = trim($name) !== '' ? 'Здравствуйте, ' . htmlspecialchars($name, ENT_QUOTES, 'UTF-8') . '!' : 'Здравствуйте!';

    $btn = static fn(string $href, string $label, bool $primary): string =>
        '<a href="' . htmlspecialchars($href, ENT_QUOTES, 'UTF-8') . '" style="display:inline-block;'
        . 'padding:13px 22px;border-radius:10px;text-decoration:none;font-weight:700;font-size:15px;'
        . ($primary ? 'background:#17307A;color:#fff;' : 'background:#fff;color:#17307A;border:2px solid #17307A;')
        . 'margin:0 8px 10px 0">' . $label . '</a>';

    return '<div style="font-family:Georgia,\'Times New Roman\',serif;font-size:15px;line-height:1.65;color:#222;max-width:600px">'
        . '<p style="margin:0 0 14px">' . $hi . '</p>'
        . '<p style="margin:0 0 16px">Ваше письмо получено, но <b>этот почтовый ящик не читают</b>: '
        . 'с него уходят результаты конкурсов, наградные материалы и уведомления сайта, '
        . 'а на письма отсюда не отвечают.</p>'
        . '<p style="margin:0 0 8px"><b>Мы обязательно ответим — напишите нам в колл-центр:</b></p>'
        . '<div style="margin:0 0 6px">'
        . $btn($chat, 'Написать на сайте', true)
        . $btn($vk, 'Написать во ВКонтакте', false)
        . '</div>'
        . '<p style="margin:0 0 16px;color:#555;font-size:13.5px">'
        . 'На сайте чат открывается в личном кабинете — там же видны Ваши заявки, результаты '
        . 'и наградные материалы. Во ВКонтакте пишите в сообщения сообщества.</p>'
        . '<p style="margin:18px 0 0;color:#555;font-size:13px">С уважением,<br>'
        . 'Оргкомитет Культурного центра «Музыкальный Мир»</p></div>';
}

/**
 * Отправить автоответ на входящее письмо, если он положен.
 *
 * @param array $msg строка inbox_messages
 * @return string что сделано: 'sent' | причина пропуска
 */
function iar_reply(array $msg): string {
    if (!iar_enabled()) return 'выключено';

    $from = mb_strtolower(trim((string) ($msg['from_email'] ?? '')));
    if ($from === '' || !filter_var($from, FILTER_VALIDATE_EMAIL)) return 'нет адреса';

    // Свои же ящики: центр пишет сам себе — отвечать некому.
    if (function_exists('inbox_own_emails') && in_array($from, (array) inbox_own_emails(), true)) return 'свой ящик';

    // Роботы, отбойники, чужие автоответы: переписка двух автоматов не нужна никому.
    $kind = (string) ($msg['kind'] ?? '');
    if (in_array($kind, ['service', 'bounce', 'auto'], true)) return 'служебное (' . $kind . ')';
    if ((int) ($msg['is_auto'] ?? 0) === 1) return 'автоответ';
    if (preg_match('~(no-?reply|noreply|mailer-daemon|postmaster|do-?not-?reply|robot|notification|support@|billing@)~i', $from)) {
        return 'робот';
    }
    $subj = (string) ($msg['subject'] ?? '');
    if (preg_match('~(автоответ|out of office|automatic reply|отпуск|недоставлен|undelivered|delivery status)~ui', $subj)) {
        return 'автоответ по теме';
    }

    // Ведомства и учреждения: с ними центр ведёт переписку сам.
    if (iar_is_institution($from)) return 'учреждение/ведомство';

    if (iar_recently_answered($from)) return 'уже отвечали на этой неделе';

    /* НАРУЖУ — ТОЛЬКО В РАБОЧЕЕ ОКНО (правило владельца: пн-сб, 09:00-19:00 МСК).
     *
     * Проверка стоит ПОСЛЕДНЕЙ, после всех причин промолчать. Иначе письмо, на
     * которое отвечать и не надо — от учреждения, от робота, — откладывалось бы
     * «до утра» и заново разбиралось при каждом заходе крона до понедельника.
     *
     * Автоответ уходит от имени центра, и письмо, пришедшее в час ночи или в
     * воскресенье, читается как работа робота. Письмо никуда не денется:
     * разбор входящих идёт по расписанию и ответит утром, когда окно откроется. */
    if (!function_exists('outreach_window_ok') && is_file(BASE_PATH . '/core/outreach_window.php')) {
        require_once BASE_PATH . '/core/outreach_window.php';
    }
    if (function_exists('outreach_window_ok') && !outreach_window_ok()) {
        return 'вне рабочего окна' . (function_exists('outreach_window_reason')
            ? ' (' . outreach_window_reason() . ')' : '');
    }

    if (!function_exists('mail_queue')) return 'почта недоступна';
    $name = trim((string) ($msg['from_name'] ?? ''));
    $id = mail_queue($from, $name, 'Ваш вопрос — напишите нам в колл-центр', iar_html($name));
    if ($id <= 0) return 'не поставилось в очередь';

    if (function_exists('audit')) {
        audit('inbox_autoreply', 'inbox_messages', (int) ($msg['id'] ?? 0), ['to' => $from]);
    }
    return 'sent';
}
