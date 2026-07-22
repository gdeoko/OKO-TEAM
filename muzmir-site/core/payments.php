<?php
/**
 * Платёжный модуль КЦ «Музыкальный Мир» — единая логика применения статуса ЮKassa.
 * Используется и вебхуком (api/v1/webhook_yukassa.php), и крон-реконсилером
 * (cron/reconcile_payments.php), чтобы платежи подтверждались даже без настроенных
 * в ЛК HTTP-уведомлений: реконсилер сам опрашивает статус по API (pull), вебхук — push.
 * Все функции идемпотентны и мягкие (не бросают наружу). Требует core/db.php + helpers.
 */
declare(strict_types=1);

/**
 * Запрос статуса платежа в ЮKassa: GET /v3/payments/{id}.
 * @return array|null полный объект платежа или null при недоступности/stub.
 */
function yukassa_get_payment(string $id): ?array {
    $shop = cfgv('yukassa_shop');
    $secret = cfgv('yukassa_secret');
    if (!$shop || !$secret || $id === '' || str_starts_with($id, 'stub-')) return null;
    $ch = curl_init('https://api.yookassa.ru/v3/payments/' . rawurlencode($id));
    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_USERPWD        => $shop . ':' . $secret,
        CURLOPT_HTTPHEADER     => ['Content-Type: application/json'],
        CURLOPT_TIMEOUT        => 12,
    ]);
    $resp = curl_exec($ch);
    $err = curl_errno($ch);
    curl_close($ch);
    if ($err || !$resp) return null;
    $d = json_decode($resp, true);
    return (is_array($d) && !empty($d['id'])) ? $d : null;
}

/**
 * Применяет статус платежа к БД. Идемпотентно: бизнес-эффекты (пометка заявки/заказа
 * оплаченными, письмо, уведомление админу) выполняются только при ПЕРЕХОДЕ в succeeded.
 * @param string $paymentId  ЮKassa payment id (совпадает с payments.yukassa_id)
 * @param string $status     новый статус (succeeded|canceled|waiting_for_capture|pending|...)
 * @param array  $obj        object платежа из вебхука/GET (для metadata/amount) — опционально
 * @return bool true, если платёж только что стал succeeded (первое применение).
 */
function payment_apply_status(string $paymentId, string $status, array $obj = []): bool {
    if ($paymentId === '' || !function_exists('tbl_exists') || !tbl_exists('payments')) return false;

    $pay = one("SELECT * FROM payments WHERE yukassa_id=?", [$paymentId]);
    $prev = (string) ($pay['status'] ?? '');
    if ($pay && $prev !== $status) {
        update('payments', ['status' => $status], 'yukassa_id=:pid', ['pid' => $paymentId]);
    }
    if ($status !== 'succeeded') return false;

    $firstTime = ($prev !== 'succeeded');   // эффекты — один раз
    if (!$firstTime) return false;

    $meta    = $obj['metadata'] ?? [];
    $appId   = ($pay['application_id'] ?? null) ?: ($meta['application_id'] ?? null);
    $orderId = ($pay['order_id'] ?? null) ?: ($meta['order_id'] ?? null);

    $email = ''; $name = '';
    if ($appId) {
        update('applications', ['is_paid' => 1, 'status' => 'paid'], 'id=:id', ['id' => (int) $appId]);
        $app = one("SELECT * FROM applications WHERE id=?", [(int) $appId]);
        if ($app) { $email = (string) ($app['email'] ?? ''); $name = (string) ($app['full_name'] ?? ''); }
    }
    if ($orderId) {
        update('awards_orders', ['status' => 'paid'], 'id=:id', ['id' => (int) $orderId]);
        if ($email === '') {
            $ord = one("SELECT * FROM awards_orders WHERE id=?", [(int) $orderId]);
            if ($ord) { $email = (string) ($ord['email'] ?? ''); $name = (string) ($ord['full_name'] ?? ''); }
        }
    }

    $amount = $pay['amount'] ?? ($obj['amount']['value'] ?? '');

    // Письмо об успешной оплате (в очередь — воркер разошлёт).
    if ($email !== '' && function_exists('mail_queue')) {
        $html = function_exists('mail_template')
            ? mail_template('payment_success', ['name' => $name, 'full_name' => $name, 'amount' => $amount, 'payment_id' => $paymentId, 'cabinet_url' => rtrim((string) cfgv('base_url'), '/') . '/cabinet'])
            : '<p>Здравствуйте' . ($name ? ', ' . h($name) : '') . '!</p><p>Оплата успешно получена. Благодарим Вас!</p>';
        mail_queue($email, $name, 'Оплата получена — КЦ «Музыкальный Мир»', $html);
    }

    if (function_exists('tg_notify_admin')) {
        tg_notify_admin('Оплата прошла: ' . $paymentId . ' на сумму ' . $amount . ' ₽');
    }
    if (function_exists('audit')) {
        audit('payment_succeeded', 'payments', (int) ($pay['id'] ?? 0), ['yukassa_id' => $paymentId, 'amount' => $amount]);
    }
    return true;
}
