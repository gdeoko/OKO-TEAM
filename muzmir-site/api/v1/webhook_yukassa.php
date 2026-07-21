<?php
/** Приём callback-уведомлений ЮKassa. Заглушка: логирует, меняет статус payments/applications/orders при succeeded. */
declare(strict_types=1);
require __DIR__ . '/_boot.php';

$raw = file_get_contents('php://input') ?: '';
$data = json_decode($raw, true);
audit('yukassa_webhook', '', null, ['raw' => mb_substr($raw, 0, 500)]);

if (!is_array($data)) json_out(['ok' => false], 400);

$event = $data['event'] ?? '';
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

$pay = null;
if ($paymentId !== '' && tbl_exists('payments')) {
    update('payments', ['status' => $status], 'yukassa_id=:pid', ['pid' => $paymentId]);
    $pay = one("SELECT * FROM payments WHERE yukassa_id=?", [$paymentId]);
}

if ($status === 'succeeded' || $event === 'payment.succeeded') {
    $meta = $obj['metadata'] ?? [];
    $appId = $pay['application_id'] ?? ($meta['application_id'] ?? null);
    $orderId = $pay['order_id'] ?? ($meta['order_id'] ?? null);
    if ($appId) update('applications', ['is_paid' => 1, 'status' => 'paid'], 'id=:id', ['id' => (int) $appId]);
    if ($orderId) update('awards_orders', ['status' => 'paid'], 'id=:id', ['id' => (int) $orderId]);
    if (function_exists('tg_notify_admin')) {
        tg_notify_admin('Оплата прошла: ' . $paymentId . ' ' . ($obj['amount']['value'] ?? ''));
    }
}

json_out(['ok' => true]);
