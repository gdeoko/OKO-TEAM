<?php
/** Приём callback-уведомлений ЮKassa (push). Логика применения статуса — в core/payments.php
 *  (та же, что у крон-реконсилера cron/reconcile_payments.php, который опрашивает статус pull'ом). */
declare(strict_types=1);
require __DIR__ . '/_boot.php';

$raw = file_get_contents('php://input') ?: '';
$data = json_decode($raw, true);
audit('yukassa_webhook', '', null, ['raw' => mb_substr($raw, 0, 500)]);

if (!is_array($data)) json_out(['ok' => false], 400);

$event = (string) ($data['event'] ?? '');
$obj = $data['object'] ?? [];
$paymentId = (string) ($obj['id'] ?? '');
$status = (string) ($obj['status'] ?? '');

// Проверка подписи (если секрет задан в настройках; иначе ЮKassa опирается на whitelist IP).
$secret = cfgv('yukassa_webhook_secret');
if ($secret) {
    $sig = $_SERVER['HTTP_X_YOOKASSA_SIGNATURE'] ?? '';
    $calc = base64_encode(hash_hmac('sha256', $raw, $secret, true));
    if (!hash_equals($calc, $sig)) json_out(['ok' => false, 'error' => 'bad signature'], 403);
}

// refund.succeeded → статус платежа не меняем на succeeded, помечаем возврат.
if ($event === 'refund.succeeded') {
    $rid = (string) ($obj['payment_id'] ?? '');
    if ($rid !== '' && tbl_exists('payments')) {
        update('payments', ['status' => 'refunded'], 'yukassa_id=:pid', ['pid' => $rid]);
    }
    json_out(['ok' => true]);
}

if ($paymentId !== '' && function_exists('payment_apply_status')) {
    payment_apply_status($paymentId, $status ?: ($event === 'payment.succeeded' ? 'succeeded' : ''), $obj);
}

json_out(['ok' => true]);
