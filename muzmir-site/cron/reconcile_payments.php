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
    /* ВСТРЕЧНАЯ СВЕРКА: ИДЁМ ОТ КАССЫ, А НЕ ОТ СВОЕЙ БАЗЫ.
     *
     * Проверка выше обходит платежи в статусе pending — то есть видит ровно то,
     * что база считает незавершённым. Если оплату потеряли у себя (28.08.2026
     * повторный клик «Оплатить» пометил уже оплаченный счёт отменённым, и
     * реконсилер перестал его опрашивать), такая сверка её не найдёт никогда:
     * она про этот платёж больше не спрашивает.
     *
     * Поэтому второй заход — с другой стороны: берём в кассе все успешные
     * платежи за последние трое суток и смотрим, проведён ли каждый у нас.
     * Не проведён — проводим. Это ловит потерю денег независимо от причины:
     * оборванный запрос, наша ошибка в коде, ручная правка в базе. */
    $recovered = 0;
    try {
        $from = gmdate('Y-m-d\TH:i:s.000\Z', time() - 3 * 86400);
        $cursor = ''; $pages = 0;
        do {
            $url = 'https://api.yookassa.ru/v3/payments?limit=100&status=succeeded'
                 . '&created_at.gte=' . rawurlencode($from)
                 . ($cursor !== '' ? '&cursor=' . rawurlencode($cursor) : '');
            $ch = curl_init($url);
            curl_setopt_array($ch, [CURLOPT_RETURNTRANSFER => true, CURLOPT_TIMEOUT => 25,
                CURLOPT_USERPWD => (string) cfgv('yukassa_shop') . ':' . (string) cfgv('yukassa_secret')]);
            $raw = (string) curl_exec($ch); curl_close($ch);
            $j = json_decode($raw, true);
            if (!is_array($j)) break;
            foreach ((array) ($j['items'] ?? []) as $obj) {
                $pid = (string) ($obj['id'] ?? '');
                if ($pid === '') continue;
                $row = one("SELECT id, status FROM payments WHERE yukassa_id=?", [$pid]);
                if (!$row || (string) $row['status'] === 'succeeded') continue;
                // У нас платёж не проведён, а деньги пришли. Возвращаем в работу и
                // применяем: payment_apply_status сам поставит заказу/заявке «оплачено»,
                // изготовит наградные материалы и отправит письмо.
                q("UPDATE payments SET status='pending' WHERE yukassa_id=?", [$pid]);
                if (payment_apply_status($pid, 'succeeded', $obj)) {
                    $recovered++;
                    if (function_exists('audit')) {
                        audit('payment_recovered', 'payments', (int) $row['id'],
                              ['yukassa_id' => $pid, 'was' => (string) $row['status'],
                               'amount' => (string) ($obj['amount']['value'] ?? '')]);
                    }
                    if (function_exists('tg_notify_admin')) {
                        try {
                            tg_notify_admin('Найдена потерянная оплата: ' . (string) ($obj['amount']['value'] ?? '')
                                . ' ₽ — ' . mb_substr((string) ($obj['description'] ?? ''), 0, 60)
                                . '. Проведена, наградные материалы запущены.');
                        } catch (\Throwable $e) {}
                    }
                }
            }
            $cursor = (string) ($j['next_cursor'] ?? '');
            $pages++;
        } while ($cursor !== '' && $pages < 5);
    } catch (\Throwable $e) {
        cron_log(JOB, 'встречная сверка не прошла: ' . $e->getMessage());
    }

    cron_log(JOB, "проверено:$checked изменено:$changed оплачено:$succeeded восстановлено:$recovered");
} catch (\Throwable $e) {
    cron_log(JOB, 'исключение: ' . $e->getMessage());
} finally {
    cron_unlock(JOB);
}
