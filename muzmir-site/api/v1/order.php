<?php
/** POST заказа наградных материалов → awards_orders + заглушка платежа ЮKassa. */
declare(strict_types=1);
require __DIR__ . '/_boot.php';
require_post();

if (!rate_ok('order:' . client_ip(), 30, 3600)) {
    json_out(['ok' => false, 'error' => 'Слишком много запросов, попробуйте позже'], 429);
}

// Позиции заказа: массив или JSON-строка.
$items = $_POST['items'] ?? input('items');
if (is_string($items) && $items !== '') {
    $decoded = json_decode($items, true);
    if (is_array($decoded)) $items = $decoded;
}
$amount = (int) input('amount', '0');
$uid = current_user()['id'] ?? null;

$orderId = insert('awards_orders', [
    'application_id' => (int) input('application_id', '0') ?: null,
    'user_id'        => $uid,
    'full_name'      => input('full_name'),
    'competition'    => input('competition'),
    'result'         => input('result'),
    'items'          => is_array($items) ? json_encode($items, JSON_UNESCAPED_UNICODE) : (string) $items,
    'amount'         => $amount,
    'email'          => mb_strtolower(input('email')),
    'phone'          => input('phone'),
    'address'        => input('address'),
    'status'         => 'new',
]);

// --- заглушка создания платежа ЮKassa ---
$payment = yukassa_create_payment($amount, 'Наградные материалы, заказ №' . $orderId, ['order_id' => $orderId, 'email' => mb_strtolower(input('email'))]);
if ($payment && !empty($payment['id'])) {
    update('awards_orders', ['payment_id' => $payment['id']], 'id=:id', ['id' => $orderId]);
    if (tbl_exists('payments')) {
        insert('payments', [
            'order_id'   => $orderId,
            'amount'     => $amount,
            'method'     => 'yukassa',
            'status'     => $payment['status'] ?? 'pending',
            'yukassa_id' => $payment['id'],
            'purpose'    => 'awards',
        ]);
    }
}
audit('order', 'awards_orders', $orderId, ['amount' => $amount]);

json_out([
    'ok'       => true,
    'order_id' => $orderId,
    'payment'  => $payment ? [
        'id'               => $payment['id'],
        'status'           => $payment['status'] ?? 'pending',
        'confirmation_url' => $payment['confirmation_url'] ?? null,
    ] : null,
]);
