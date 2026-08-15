<?php
/**
 * Статус оплаты для страницы ожидания /pay-status.
 * Находит последний платёж текущего пользователя (по его заявкам/заказам),
 * при необходимости СВЕРЯЕТ его со ЮKassa прямо сейчас (pull) и применяет статус,
 * чтобы окно успеха показалось сразу, не дожидаясь крон-реконсилера.
 *
 * Ответ: { ok, status: 'paid'|'pending'|'none', kind:'application'|'order'|'', number, amount }
 */
declare(strict_types=1);
require __DIR__ . '/_boot.php';

$u = current_user();
if (!$u) json_out(['ok' => true, 'status' => 'none', 'reason' => 'guest']);
$uid = (int) $u['id'];

if (!tbl_exists('payments')) json_out(['ok' => true, 'status' => 'none']);

// Последний платёж пользователя за последний час (по его заявкам или заказам).
$pay = one(
    "SELECT p.* FROM payments p
       LEFT JOIN applications a ON a.id = p.application_id
       LEFT JOIN awards_orders o ON o.id = p.order_id
      WHERE (a.user_id = ? OR o.user_id = ?)
        AND p.created_at >= datetime('now','localtime','-2 hours')
        AND p.yukassa_id <> '' AND p.yukassa_id NOT LIKE 'stub-%'
      ORDER BY p.id DESC LIMIT 1",
    [$uid, $uid]
);
if (!$pay) json_out(['ok' => true, 'status' => 'none']);

$status = (string) $pay['status'];
$pid = (string) $pay['yukassa_id'];

// Если ещё не succeeded — сверяем со ЮKassa и применяем (мгновенное подтверждение).
if ($status !== 'succeeded' && function_exists('yukassa_get_payment') && function_exists('payment_apply_status')) {
    $obj = yukassa_get_payment($pid);
    if ($obj && !empty($obj['status'])) {
        $newStatus = (string) $obj['status'];
        if ($newStatus !== $status) {
            payment_apply_status($pid, $newStatus, $obj);
            $status = $newStatus;
        }
    }
}

$kind = ''; $number = ''; $amount = (int) ($pay['amount'] ?? 0);
if (!empty($pay['application_id'])) {
    $kind = 'application';
    $ap = one("SELECT number FROM applications WHERE id=?", [(int) $pay['application_id']]);
    $number = (string) ($ap['number'] ?? '');
} elseif (!empty($pay['order_id'])) {
    $kind = 'order';
    $number = '№' . (int) $pay['order_id'];
}

$out = ($status === 'succeeded') ? 'paid' : (($status === 'canceled') ? 'canceled' : 'pending');
json_out(['ok' => true, 'status' => $out, 'kind' => $kind, 'number' => $number, 'amount' => $amount]);
