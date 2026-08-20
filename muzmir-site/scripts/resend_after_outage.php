<?php
/**
 * ПЕРЕОТПРАВКА ПИСЕМ, НЕ ДОШЕДШИХ ИЗ-ЗА ЗАКРЫТЫХ ЯЩИКОВ.
 *
 * 17 августа Яндекс закрыл наружу kc@ и nagradi.on@, и на двое суток центр
 * остался без канала для служебных писем. Часть из них система пометила
 * отправленными: письмо ушло в сервис рассылки от имени kc@ (пул unisender-kc),
 * сервис его принял, но до человека оно не дошло — репутация домена в этот
 * момент была подбита, адреса на mail.ru попали в подавление. Внешне всё
 * выглядело благополучно, а участники писали, что подтверждения нет.
 *
 * Здесь такие письма находятся и ставятся заново — через тот канал, который
 * сейчас работает (почта сайта временно идёт с gmail-адреса центра).
 *
 * ЧТО ПЕРЕОТПРАВЛЯЕТСЯ: подтверждения заявок, доступы в кабинет и пароли,
 * письма об оплате, результаты, наградные материалы, дипломы кураторов.
 * ЧТО НЕТ: обращения в ведомства и учреждения. Их нельзя слать с gmail —
 * государственные адреса такие письма не принимают, и повтор ничего не даст;
 * они ждут восстановления kc@.
 *
 *   php scripts/resend_after_outage.php            — показать, кого касается
 *   php scripts/resend_after_outage.php --apply    — поставить письма в очередь
 *   php scripts/resend_after_outage.php --apply --now  — не ждать рабочего окна
 */
declare(strict_types=1);
if (PHP_SAPI !== 'cli') { fwrite(STDERR, "CLI only\n"); exit(1); }

define('BASE_PATH', dirname(__DIR__));
$GLOBALS['CFG'] = require BASE_PATH . '/config.php';
require_once BASE_PATH . '/core/db.php';
require_once BASE_PATH . '/core/helpers.php';
if (is_file(BASE_PATH . '/core/outreach_window.php')) require_once BASE_PATH . '/core/outreach_window.php';

$apply = in_array('--apply', $argv, true);
$now   = in_array('--now', $argv, true);
$line  = str_repeat('=', 78);

/* ── Период сбоя ─────────────────────────────────────────────────────────── */
$from = '2026-08-17 00:00:00';
$to   = '2026-08-20 07:00:00';   // с семи утра 20-го письма снова доходят

/* ── Кого касается ───────────────────────────────────────────────────────────
 * Берём ровно то, что доказанно не дошло, а не всё подряд за эти дни:
 *   • письма, ушедшие в сервис рассылки от имени закрытого kc@ (пул
 *     unisender-kc) — именно про них писали участники, что подтверждения нет;
 *   • письма, ушедшие напрямую с kc@ и nagradi.on@ после того, как почтовая
 *     служба закрыла эти ящики (вечер 17 августа и позже);
 *   • служебные письма, застрявшие в очереди с тех же суток.
 * Массовые рассылки сюда не попадают: у них своя история и свой канал, и
 * повторять их людям не надо.
 */
$suspect = all(
    "SELECT id, to_email, to_name, subject, body, attach, sent_via, status, created_at, campaign_type
       FROM mail_queue
      WHERE (campaign_type IS NULL OR campaign_type = '' OR campaign_type = 'teacher')
        AND (
              sent_via = 'unisender-kc'
           OR ((sent_via LIKE 'kc@%' OR sent_via LIKE 'nagradi%') AND sent_at >= '2026-08-17 18:00:00')
           OR (status IN ('queued','paused','failed') AND created_at BETWEEN ? AND ?)
        )
   ORDER BY id", [$from, $to]);

/** Письмо человеку, а не в ведомство: только такие можно повторить с gmail. */
$isPersonal = static function (array $r): bool {
    $s = mb_strtolower((string) $r['subject']);
    // Уведомления оргкомитету о новых заявках повторять некому: они и так лежат
    // в админке, а человек их не ждёт.
    // Служебные уведомления оргкомитету (в теме идут в квадратных скобках:
    // [ЗАЯВКИ], [РЕГИСТРАЦИИ], [ЧАТ-БОТ]) человеку повторять незачем.
    if (str_starts_with(trim((string) $r['subject']), '[')) return false;
    foreach (['принята', 'парол', 'кабинет', 'оплат', 'счёт', 'счет', 'результат', 'итоги',
              'диплом', 'наград', 'благодарност', 'сертификат', 'подтвердите почту',
              'добро пожаловать'] as $w) {
        if (str_contains($s, $w)) return true;
    }
    return false;
};

/** Государственный или ведомственный адрес: gmail туда не доходит. */
$isOfficialAddr = static function (string $email): bool {
    $d = mb_strtolower(substr(strrchr($email, '@') ?: '', 1));
    if ($d === '') return true;
    foreach (['.gov.ru', 'minobr', 'minkult', 'admin', 'edu.ru', '.mos.ru', 'gov'] as $w) {
        if (str_contains($d, $w)) return true;
    }
    return in_array($d, ['gmail.com', 'mail.ru', 'yandex.ru', 'ya.ru', 'bk.ru', 'inbox.ru', 'list.ru',
                         'rambler.ru', 'internet.ru', 'icloud.com', 'outlook.com', 'qq.com', 'yandex.com'], true) ? false : true;
};

$take = $skipOfficial = $skipOther = 0;
$plan = [];
foreach ($suspect as $r) {
    $email = trim((string) $r['to_email']);
    if ($email === '' || !filter_var($email, FILTER_VALIDATE_EMAIL)) { $skipOther++; continue; }
    // Собственные ящики центра: копии писем самому себе повторять не надо.
    $lower = mb_strtolower($email);
    foreach (['kulturniy.centr.mir', 'kc@', 'nagradi', 'news@', 'novosti@'] as $own) {
        if (str_contains($lower, $own)) { $skipOther++; continue 2; }
    }
    if (!$isPersonal($r))                { $skipOther++;    continue; }
    if ($isOfficialAddr($email))         { $skipOfficial++; continue; }
    // Уже повторено этим же скриптом — второй раз не шлём.
    $dup = one("SELECT id FROM mail_queue WHERE to_email=? AND subject=? AND id > ? AND campaign_type='resend'",
               [$email, (string) $r['subject'], (int) $r['id']]);
    if ($dup) { $skipOther++; continue; }
    $plan[] = $r;
    $take++;
}

/* ── Отчёт ───────────────────────────────────────────────────────────────── */
echo "ПИСЬМА, НЕ ДОШЕДШИЕ ИЗ-ЗА ЗАКРЫТЫХ ЯЩИКОВ\n$line\n";
printf("  проверено писем за %s — %s: %d\n", mb_substr($from, 0, 10), mb_substr($to, 0, 10), count($suspect));
printf("  к повторной отправке:            %d\n", $take);
printf("  пропущено (ведомства, gmail не примут): %d\n", $skipOfficial);
printf("  пропущено (не письмо участнику или уже повторено): %d\n\n", $skipOther);

$byKind = $byAddr = [];
foreach ($plan as $r) {
    $s = mb_strtolower((string) $r['subject']);
    $k = str_contains($s, 'принята') ? 'подтверждение заявки'
       : (str_contains($s, 'парол') || str_contains($s, 'кабинет') ? 'доступ в кабинет'
       : (str_contains($s, 'диплом') || str_contains($s, 'наград') || str_contains($s, 'благодарност') ? 'наградные материалы'
       : (str_contains($s, 'оплат') || str_contains($s, 'счёт') || str_contains($s, 'счет') ? 'оплата'
       : (str_contains($s, 'результат') || str_contains($s, 'итоги') ? 'результаты' : 'прочее'))));
    $byKind[$k] = ($byKind[$k] ?? 0) + 1;
    $byAddr[mb_strtolower(trim((string) $r['to_email']))] = true;
}
echo "  ПО ВИДАМ ПИСЕМ:\n";
foreach ($byKind as $k => $n) printf("    %-24s %d\n", $k, $n);
printf("\n  всего адресатов: %d\n\n", count($byAddr));

if (!$apply) {
    echo "  чтобы отправить: php scripts/resend_after_outage.php --apply\n";
    exit(0);
}

/* ── Постановка в очередь ────────────────────────────────────────────────────
 * Наружу центр пишет только в рабочее время, поэтому письма ставятся на
 * ближайшее рабочее окно, а не на «сейчас», если сейчас ночь или воскресенье.
 */
$when = date('Y-m-d H:i:s');
if (!$now && function_exists('outreach_window_ok') && !outreach_window_ok()) {
    $t = new DateTime();
    if ((int) $t->format('H') < 9) {
        $t->setTime(9, 0);                       // раннее утро — ждём девяти
    } else {
        $t->modify('+1 day')->setTime(9, 0);     // вечер — на завтра
        while ((int) $t->format('w') === 0) $t->modify('+1 day');
    }
    $when = $t->format('Y-m-d H:i:s');
    echo "  сейчас нерабочее время: письма поставлены на " . $when . "\n";
}

// Пояснение сверху письма: человек должен понимать, почему получил его повторно
// и почему с другого адреса, иначе повтор выглядит как ошибка или подделка.
$notice = '<div style="background:#fff8e6;border:1px solid #f0dfae;border-radius:10px;padding:14px 16px;margin:0 0 18px;'
        . 'font:400 14px/1.55 Georgia,serif;color:#5b4a1f">'
        . '<b>Отправляем повторно.</b> С 17 по 19 августа почтовая служба ограничила отправку с адресов нашего центра, '
        . 'и часть служебных писем до адресатов не дошла. Ниже письмо, которое Вы должны были получить. '
        . 'Приносим извинения за задержку: заявки, оплаты и наградные материалы при этом не пострадали, '
        . 'все данные сохранены в личном кабинете.'
        . '</div>';

$ok = 0;
foreach ($plan as $r) {
    $body = (string) $r['body'];
    // Вставляем пояснение сразу после открывающего body, а если разметка
    // неожиданная — просто в начало: письмо важнее аккуратности вёрстки.
    if (preg_match('~<body[^>]*>~i', $body, $m, PREG_OFFSET_CAPTURE)) {
        $pos  = $m[0][1] + strlen($m[0][0]);
        $body = substr($body, 0, $pos) . $notice . substr($body, $pos);
    } else {
        $body = $notice . $body;
    }
    try {
        insert('mail_queue', [
            'to_email'      => (string) $r['to_email'],
            'to_name'       => (string) $r['to_name'],
            'subject'       => (string) $r['subject'],
            'body'          => $body,
            'attach'        => (string) ($r['attach'] ?? ''),
            'status'        => 'queued',
            // Приоритет ноль — это НЕ «неважное». В этой очереди ноль означает
            // личное письмо: такие уходят сразу, без дневного лимита и без
            // проверки на отписку от рассылки. Массовые идут с priority > 0 и
            // ждут окна. Подтверждение заявки обязано дойти всегда, поэтому ноль.
            'priority'      => 0,
            'scheduled_at'  => $when,
            'campaign_type' => 'resend',
        ]);
        $ok++;
    } catch (\Throwable $e) {
        fwrite(STDERR, '  не удалось поставить письмо для ' . $r['to_email'] . ': ' . $e->getMessage() . "\n");
    }
}
printf("\n  поставлено в очередь: %d писем, отправка с %s\n", $ok, $when);
if (function_exists('audit')) audit('resend_after_outage', 'mail', 0, ['count' => $ok, 'when' => $when]);
