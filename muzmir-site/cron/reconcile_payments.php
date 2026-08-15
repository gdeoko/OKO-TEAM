<?php
/**
 * Сверка статусов платежей ЮKassa (pull). Запуск: каждые 2 минуты.
 *
 * Зачем: HTTP-уведомления (webhook) в ЛК ЮKassa могут быть не настроены — тогда push
 * не приходит. Этот воркер сам опрашивает GET /v3/payments/{id} по всем «висящим»
 * платежам и применяет статус через ту же payment_apply_status(), что и вебхук.
 * Так оплата подтверждается (заявка/заказ → paid, письмо, уведомление админу) без
 * каких-либо действий в кабинете ЮKassa.
 *
 * Запуск: php cron/reconcile_payments.php
 */
declare(strict_types=1);
if (PHP_SAPI !== 'cli') { fwrite(STDERR, "CLI only\n"); exit(1); }

define('BASE_PATH', dirname(__DIR__));
$GLOBALS['CFG'] = require BASE_PATH . '/config.php';
require_once BASE_PATH . '/core/db.php';
require_once BASE_PATH . '/core/data.php';
require_once BASE_PATH . '/core/helpers.php';
foreach (['mailer', 'telegram', 'payments'] as $svc) {
    $f = BASE_PATH . '/core/' . $svc . '.php';
    if (is_file($f)) require_once $f;
}
require_once __DIR__ . '/_lib.php';

const JOB = 'reconcile_payments';

if (!function_exists('yukassa_get_payment') || !function_exists('payment_apply_status')) {
    cron_log(JOB, 'core/payments.php не подключился — выход');
    exit(0);
}
if (!cfgv('yukassa_shop') || !cfgv('yukassa_secret')) {
    cron_log(JOB, 'ключи ЮKassa не заданы — выход');
    exit(0);
}
if (!cron_lock(JOB, 300)) { exit(0); }

try {
    db();
    // Незавершённые платежи за последние 3 суток (реальные, не stub), не старше — чтобы не дёргать API вечно.
    $rows = all(
        "SELECT * FROM payments
         WHERE status IN ('pending','waiting_for_capture')
           AND yukassa_id != '' AND yukassa_id NOT LIKE 'stub-%'
           AND created_at >= datetime('now','localtime','-3 days')
         ORDER BY created_at DESC LIMIT 100"
    );
    $checked = 0; $succeeded = 0; $changed = 0;
    foreach ($rows as $p) {
        $pid = (string) $p['yukassa_id'];
        $obj = yukassa_get_payment($pid);
        $checked++;
        if (!$obj) continue;
        $newStatus = (string) ($obj['status'] ?? '');
        if ($newStatus === '' || $newStatus === $p['status']) continue;
        $became = payment_apply_status($pid, $newStatus, $obj);
        $changed++;
        if ($became) $succeeded++;
    }
    cron_log(JOB, "проверено:$checked изменено:$changed оплачено:$succeeded");
} catch (\Throwable $e) {
    cron_log(JOB, 'исключение: ' . $e->getMessage());
} finally {
    cron_unlock(JOB);
}
