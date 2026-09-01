<?php
/**
 * НАПОМИНАНИЕ О НЕОПЛАЧЕННОМ ЗАКАЗЕ НАГРАД.
 *
 * В день оглашения итогов «Величия России» из двадцати двух заказов пять
 * остались неоплаченными — четыре с половиной тысячи рублей, которые человек
 * уже решил потратить. Причины бытовые: отвлекли, не прошла карта, закрыл
 * вкладку ЮKassa. Заказ при этом цел и лежит в кабинете со всеми позициями, но
 * участник об этом не знает: письмо приходит только ПОСЛЕ оплаты. Центр молча
 * терял деньги, а человек — награду, которую сам себе выбрал.
 *
 * Здесь два напоминания и ни одного больше:
 *   через 3 часа — «оплата не прошла, всё сохранено»;
 *   через сутки  — короткое повторное.
 * Дальше молчим: третье письмо про деньги — уже давление, а центр не магазин.
 *
 * Что НЕ трогаем:
 *   • заказы клубного членства (их оплачивают иначе, и напоминание про клуб
 *     звучит как навязывание подписки);
 *   • заказы старше семи дней — там человек уже передумал;
 *   • отменённые и оплаченные, разумеется.
 *
 * Окно отправки — общее правило центра: пн–сб 09:00–19:00 МСК
 * (core/outreach_window.php). Ночью и в воскресенье наружу не уходит ничего.
 *
 * Идемпотентность: reminder_log (app_id = id заказа со сдвигом, kind =
 * order_unpaid_<шаг>) — тот же журнал, что у дожимов по наградам, и та же
 * защита от повторной отправки при догоняющем запуске.
 *
 * Строка crontab (МСК):
 *   0 10,15 * * 1-6 php /var/www/muzmir/cron/order_unpaid_reminder.php >> data/logs/cron.log 2>&1
 *
 * Запуск вручную: php cron/order_unpaid_reminder.php [--dry] [--force]
 */
declare(strict_types=1);
if (PHP_SAPI !== 'cli') { fwrite(STDERR, "CLI only\n"); exit(1); }

define('BASE_PATH', dirname(__DIR__));
$GLOBALS['CFG'] = require BASE_PATH . '/config.php';
require_once BASE_PATH . '/core/db.php';
require_once BASE_PATH . '/core/helpers.php';
require_once BASE_PATH . '/core/mailer.php';
require_once BASE_PATH . '/core/outreach_window.php';
require_once __DIR__ . '/_lib.php';

const JOB = 'order_unpaid_reminder';
/** Часы после создания заказа, когда напоминаем. Больше двух шагов не будет. */
const UNPAID_STEPS = [3, 24];
/** Позже этого срока заказ считаем брошенным окончательно. */
const UNPAID_MAX_DAYS = 7;

$dry   = in_array('--dry', $argv, true);
$force = in_array('--force', $argv, true);

if (!$force && !outreach_window_ok()) {
    // Вне рабочего окна не делаем ничего: письмо о деньгах, пришедшее ночью,
    // читается как спам робота — и запоминается именно так.
    echo "вне рабочего окна, выходим\n";
    exit(0);
}
if (!$dry && !cron_lock(JOB, 900)) { echo "уже выполняется\n"; exit(0); }

/* Журнал отправок — общий с дожимами по наградам. Ключ заказа сдвигаем, чтобы
   не столкнуться с ключами заявок: там app_id — это id заявки. */
$logKey = static fn(int $orderId): int => 900000 + $orderId;

$sent = 0; $skipped = 0;
/* ОДНО НАПОМИНАНИЕ НА ЧЕЛОВЕКА ЗА ПРОГОН.
 *
 * Заказы перебираются по одному, и у кого их три (собрал награды за три
 * конкурса и ни один не оплатил), тот 01.09 получил три одинаковых письма
 * подряд, с разницей в две секунды. Это читается как сбой робота, а не как
 * забота, и по письму о деньгах особенно.
 *
 * Пишем про один заказ, остальные ждут следующего прогона: он в тот же день
 * в 15:00 или назавтра в 10:00 — человек увидит второе напоминание отдельным
 * письмом, а не пачкой. В журнал попадает только отправленный заказ, так что
 * ничего не теряется. */
$writtenTo = [];
try {
    $rows = all("SELECT * FROM awards_orders
                  WHERE status = 'new'
                    AND COALESCE(email,'') <> ''
                    AND COALESCE(items,'') NOT LIKE '%\"kind\":\"club\"%'
                    AND created_at >= datetime('now','localtime','-" . UNPAID_MAX_DAYS . " day')
               ORDER BY id");
} catch (\Throwable $e) { $rows = []; }

foreach ($rows as $o) {
    $orderId = (int) $o['id'];
    $created = strtotime((string) $o['created_at']);
    if (!$created) { $skipped++; continue; }
    $hours = (time() - $created) / 3600;

    // Берём самый поздний подошедший шаг: при догоняющем запуске человек
    // получит одно письмо, а не оба сразу.
    $step = 0;
    foreach (UNPAID_STEPS as $s) if ($hours >= $s) $step = $s;
    if ($step === 0) { $skipped++; continue; }

    $kind = 'order_unpaid_' . $step;
    try {
        $done = (int) scalar("SELECT COUNT(*) FROM reminder_log WHERE app_id=? AND kind=?",
                             [$logKey($orderId), $kind]);
        if ($done > 0) { $skipped++; continue; }
    } catch (\Throwable $e) { /* журнала нет — создадим ниже вставкой */ }

    $box = mb_strtolower(trim((string) ($o['email'] ?? '')));
    if (isset($writtenTo[$box])) { $skipped++; continue; }   // этому человеку уже написали в этом прогоне

    $items = json_decode((string) ($o['items'] ?? '[]'), true);
    if (!is_array($items) || !$items) { $skipped++; continue; }

    $base = rtrim((string) cfgv('base_url'), '/');
    $html = function_exists('mail_template')
        ? mail_template('award_order_unpaid', [
            'order' => $o, 'items' => $items, 'name' => (string) $o['full_name'],
            'cabinet_url' => $base . '/cabinet', 'second' => $step >= 24,
            '_tx' => [
                'preheader' => 'Заказ №' . $orderId . ' на изготовление наградного материала ждёт оплаты.',
                'hero'      => mm_cta_primary($base . '/cabinet#awards', 'Оплатить заказ',
                                              'Заказ №' . $orderId . ' · ' . (int) $o['amount'] . ' ₽'),
                'actions'   => [['Перейти в личный кабинет', $base . '/cabinet']],
            ],
        ])
        : '<p>Ваш заказ №' . $orderId . ' ожидает оплаты в личном кабинете.</p>';

    $subject = $step >= 24
        ? 'Заказ наградного материала ждёт оплаты — Культурный центр «Музыкальный Мир»'
        : 'Оплата заказа не прошла — Культурный центр «Музыкальный Мир»';

    if ($dry) {
        echo "СУХОЙ ПРОГОН: заказ #$orderId, шаг $step ч, {$o['email']}, {$o['amount']} ₽\n";
        $writtenTo[$box] = true;
        $sent++;
        continue;
    }

    $ok = false;
    try { $ok = mail_send((string) $o['email'], $subject, $html); } catch (\Throwable $e) { $ok = false; }
    if ($ok) {
        $writtenTo[$box] = true;
        try { insert('reminder_log', ['app_id' => $logKey($orderId), 'kind' => $kind]); } catch (\Throwable $e) {}
        // Уведомление в кабинет — человек может зайти туда раньше, чем в почту.
        if (function_exists('notify_user') && (int) ($o['user_id'] ?? 0) > 0) {
            try {
                notify_user((int) $o['user_id'], 'Заказ ждёт оплаты',
                    'Заказ №' . $orderId . ' на ' . (int) $o['amount'] . ' ₽ сохранён. Оплатить можно здесь.',
                    '/cabinet#awards', 'pay');
            } catch (\Throwable $e) {}
        }
        $sent++;
        echo "напоминание по заказу #$orderId ($step ч) → {$o['email']}\n";
    } else {
        echo "ОШИБКА отправки по заказу #$orderId: " . (function_exists('mail_last_error') ? mail_last_error() : '') . "\n";
    }
}

if (!$dry) cron_unlock(JOB);
echo "итого: отправлено $sent, пропущено $skipped\n";
