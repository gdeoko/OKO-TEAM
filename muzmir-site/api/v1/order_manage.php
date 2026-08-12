<?php
/**
 * Управление СВОИМИ заказами наград из кабинета:
 *   action=pay    — создать (пере)платёж для неоплаченного заказа → confirmation_url;
 *   action=delete — удалить неоплаченный заказ (только свой, только status='new').
 * Оплаченные/изготовленные заказы трогать нельзя.
 */
declare(strict_types=1);
require __DIR__ . '/_boot.php';
require_post();

if (!request_same_origin_oa() || !csrf_check()) {
    json_out(['ok' => false, 'error' => 'Недопустимый источник запроса'], 403);
}

$u = current_user();
if (!$u) json_out(['ok' => false, 'error' => 'Требуется вход в кабинет'], 401);
$uid = (int) $u['id'];

$action = input('action');
$orderId = (int) input('order_id');
if ($orderId <= 0) json_out(['ok' => false, 'error' => 'Заказ не указан'], 400);

$o = one("SELECT * FROM awards_orders WHERE id=? AND user_id=?", [$orderId, $uid]);
if (!$o) json_out(['ok' => false, 'error' => 'Заказ не найден'], 404);

// Оплачивать/удалять можно ТОЛЬКО неоплаченный заказ.
if ((string) $o['status'] !== 'new') {
    json_out(['ok' => false, 'error' => 'Этот заказ уже в работе — изменить нельзя.'], 409);
}

if ($action === 'delete') {
    q("DELETE FROM awards_orders WHERE id=? AND user_id=? AND status='new'", [$orderId, $uid]);
    if (tbl_exists('payments')) q("DELETE FROM payments WHERE order_id=? AND status IN ('pending','')", [$orderId]);
    audit('order_delete_self', 'awards_orders', $orderId, ['user' => $uid]);
    json_out(['ok' => true, 'deleted' => true]);
}

if ($action === 'pay') {
    $amount = (int) $o['amount'];
    if ($amount <= 0) json_out(['ok' => false, 'error' => 'Сумма заказа нулевая — оплата не требуется.'], 400);
    $payment = yukassa_create_payment($amount, 'Наградные материалы, заказ №' . $orderId, [
        'order_id' => $orderId, 'email' => mb_strtolower((string) $o['email']),
    ]);
    if (!$payment || empty($payment['id'])) {
        json_out(['ok' => false, 'error' => 'Не удалось создать платёж. Попробуйте позже.'], 502);
    }
    // Гасим прежние НЕзавершённые платежи этого заказа, чтобы повторный клик «Оплатить»
    // не плодил висящие pending-платежи (двойная реальная оплата → дубль письма/уведомления).
    if (tbl_exists('payments')) {
        q("UPDATE payments SET status='canceled' WHERE order_id=? AND status IN ('pending','waiting_for_capture','')", [$orderId]);
    }
    update('awards_orders', ['payment_id' => $payment['id']], 'id=:id', ['id' => $orderId]);
    if (tbl_exists('payments')) {
        insert('payments', [
            'order_id' => $orderId, 'amount' => $amount, 'method' => 'yukassa',
            'status' => $payment['status'] ?? 'pending', 'yukassa_id' => $payment['id'], 'purpose' => 'awards',
        ]);
    }
    audit('order_pay_self', 'awards_orders', $orderId, ['user' => $uid, 'amount' => $amount]);
    json_out([
        'ok' => true,
        'confirmation_url' => $payment['confirmation_url'] ?? null,
        'payment' => ['id' => $payment['id'], 'status' => $payment['status'] ?? 'pending', 'confirmation_url' => $payment['confirmation_url'] ?? null],
    ]);
}

json_out(['ok' => false, 'error' => 'Неизвестное действие'], 400);

/** Проверка Origin/Referer своего домена. */
function request_same_origin_oa(): bool {
    $hosts = [];
    if ($bu = cfgv('base_url')) { $h = parse_url((string) $bu, PHP_URL_HOST); if ($h) $hosts[] = strtolower($h); }
    foreach (['domain', 'domain_puny'] as $k) { if ($d = cfgv($k)) $hosts[] = strtolower((string) $d); }
    $hosts = array_values(array_unique(array_filter($hosts)));
    if (!$hosts) return true;
    $src = $_SERVER['HTTP_ORIGIN'] ?? ($_SERVER['HTTP_REFERER'] ?? '');
    if ($src === '') return false;
    $srcHost = strtolower((string) parse_url($src, PHP_URL_HOST));
    return $srcHost !== '' && in_array($srcHost, $hosts, true);
}
