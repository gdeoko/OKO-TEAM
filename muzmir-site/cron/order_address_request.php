<?php
/**
 * ПРОСЬБА УКАЗАТЬ АДРЕС ДОСТАВКИ.
 *
 * Оплаченный заказ оригиналов без адреса — тупик: изготовить можно, отправить
 * некуда. Раньше это ловилось глазами при разборе заказов, а человек тем
 * временем ждал посылку и не знал, что от него чего-то ждут.
 *
 * Задание находит такие заказы и один раз пишет участнику письмо с просьбой
 * прислать адрес: с составом заказа, ссылкой в личный кабинет и понятным
 * объяснением, что именно указать. Повторно одному и тому же человеку письмо не
 * уходит — для этого есть таблица reminder_log.
 *
 * Наружу центр пишет только в рабочее время (правило владельца), поэтому вне
 * окна задание молча выходит.
 *
 * Строка расписания: 0 12 * * 1-6
 *   php cron/order_address_request.php          — показать, кому написали бы
 *   php cron/order_address_request.php --send   — отправить
 */
declare(strict_types=1);
if (PHP_SAPI !== 'cli') { fwrite(STDERR, "CLI only\n"); exit(1); }

define('BASE_PATH', dirname(__DIR__));
$GLOBALS['CFG'] = require BASE_PATH . '/config.php';
require_once BASE_PATH . '/core/db.php';
require_once BASE_PATH . '/core/helpers.php';
require_once BASE_PATH . '/core/mailer.php';
require_once BASE_PATH . '/core/order_group.php';
require_once BASE_PATH . '/core/result_mail.php';
require_once BASE_PATH . '/core/outreach_window.php';
require_once __DIR__ . '/_lib.php';

const JOB = 'order_address_request';

/* Журнал отправленных напоминаний общий с цепочкой заказа наград: те же две
   функции, но подключать ради них весь тот скрипт нельзя — он при загрузке
   выполняет свою работу. */
if (!function_exists('award_reminder_sent')) {
    function award_reminder_sent(int $appId, string $kind): bool {
        try { return (bool) one("SELECT id FROM reminder_log WHERE app_id=? AND kind=?", [$appId, $kind]); }
        catch (\Throwable $e) { return false; }
    }
}
if (!function_exists('award_reminder_mark')) {
    function award_reminder_mark(int $appId, string $kind): void {
        try { insert('reminder_log', ['app_id' => $appId, 'kind' => $kind, 'sent_at' => date('Y-m-d H:i:s')]); }
        catch (\Throwable $e) { /* уже отмечено */ }
    }
}

$send = in_array('--send', $argv, true);

if ($send && function_exists('outreach_window_ok') && !outreach_window_ok()) {
    cron_log(JOB, 'вне рабочего окна — письма не отправляем');
    exit(0);
}

$orders = og_missing_address();
if (!$orders) {
    cron_log(JOB, 'заказов без адреса нет');
    echo "Заказов оригиналов без адреса нет.\n";
    exit(0);
}

// Пишем по получателю, а не по заказу: у человека может быть три оплаченных
// заказа без адреса, и три одинаковых письма подряд — это неуважение.
$byPerson = [];
foreach ($orders as $o) {
    $key = mb_strtolower(trim((string) $o['email'])) ?: ('uid' . (int) $o['user_id']);
    $byPerson[$key][] = $o;
}

printf("Заказов без адреса: %d, адресатов: %d\n\n", count($orders), count($byPerson));

$sent = 0;
foreach ($byPerson as $email => $list) {
    $first = $list[0];
    $name  = trim((string) ($first['full_name'] ?? ''));
    if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
        printf("  пропуск: у заказа №%d нет почты\n", (int) $first['id']);
        continue;
    }
    $kind = 'order_addr_' . implode('_', array_map(static fn(array $o): int => (int) $o['id'], $list));
    if (function_exists('award_reminder_sent') && award_reminder_sent((int) $first['id'], $kind)) {
        printf("  уже писали: %s\n", $email);
        continue;
    }

    // Состав: человек должен узнать свой заказ, а не гадать, о чём письмо.
    $rows = '';
    $sum  = 0;
    foreach ($list as $o) {
        $sum += (int) ($o['amount'] ?? 0);
        foreach ((array) json_decode((string) ($o['items'] ?? '[]'), true) as $it) {
            if (!is_array($it)) continue;
            $rows .= '<tr>'
                   . '<td style="padding:7px 10px;border-bottom:1px solid #eee3cf;font-size:14px">' . h((string) ($it['item'] ?? '')) . '</td>'
                   . '<td style="padding:7px 10px;border-bottom:1px solid #eee3cf;font-size:14px;white-space:nowrap">№' . (int) $o['id'] . '</td>'
                   . '</tr>';
        }
    }

    $cabinet = url('/cabinet');
    $inner = '<p style="margin:0 0 14px;">' . ($name !== '' ? 'Здравствуйте, ' . h($name) . '!' : 'Здравствуйте!') . '</p>'
        . '<p style="margin:0 0 16px;">Ваш заказ наградных материалов оплачен и принят в работу. Осталось одно: '
        . '<b>мы не знаем, куда отправить посылку</b> — при оформлении адрес доставки не был указан.</p>'
        . '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 18px;border-collapse:collapse">' . $rows . '</table>'
        . '<p style="margin:0 0 10px;font-weight:700;color:' . RM_NAVY . ';">Что прислать</p>'
        . '<p style="margin:0 0 16px;font-size:14px;line-height:1.65;">Полный почтовый адрес: <b>индекс, регион, город или посёлок, улицу, номер дома</b> '
        . 'и квартиру, а также фамилию, имя и отчество получателя и телефон для извещения. Без номера дома Почта России посылку не примет.</p>'
        . '<p style="margin:0 0 16px;font-size:14px;line-height:1.65;">Удобнее всего указать адрес в личном кабинете — он сразу попадёт в заказ. '
        . 'Можно и просто ответить на это письмо: мы внесём адрес сами.</p>'
        . '<p style="margin:0 0 8px;font-size:13px;color:' . RM_MUTED . ';">Как только адрес появится, изготовление занимает до 7 рабочих дней, '
        . 'доставка Почтой России — до 14 рабочих дней. Трек-номер пришлём отдельным письмом.</p>';

    $html = mm_email_tx($inner, [
        'preheader' => 'Заказ оплачен, но не указан адрес доставки — подскажите, куда отправить.',
        'hero'      => mm_cta_primary($cabinet, 'Указать адрес в кабинете', 'Оплачено: ' . $sum . ' ₽'),
        'actions'   => [['Личный кабинет', $cabinet], ['Написать нам', 'mailto:' . (string) cfgv('mail_awards_from', 'nagradi.on@музыкальный-мир.рф')]],
    ]);

    printf("  %-38s заказов %d, сумма %d ₽\n", $email, count($list), $sum);
    if (!$send) continue;

    $subject = 'Куда отправить награды? Уточните адрес — «Музыкальный Мир»';
    if (mail_queue($email, $name, $subject, $html) > 0) {
        $sent++;
        if (function_exists('award_reminder_mark')) award_reminder_mark((int) $first['id'], $kind);
    }
}

if ($send) {
    cron_log(JOB, sprintf('просьба указать адрес: писем %d, заказов без адреса %d', $sent, count($orders)));
    printf("\nОтправлено писем: %d\n", $sent);
} else {
    echo "\nЭто предпросмотр. Отправить: php cron/order_address_request.php --send\n";
}
