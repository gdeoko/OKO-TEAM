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

    // --- Сверка суммы ПЕРЕД любыми изменениями (защита от подмены суммы в вебхуке) ---
    // Сравниваем object.amount.value (руб.) с сохранённой payments.amount. При расхождении —
    // НЕ помечаем оплаченным, логируем и выходим. Если суммы в объекте нет (напр. pull без
    // amount) — полагаемся на совпадение payment_id (существование строки payments).
    if ($status === 'succeeded' && $pay) {
        $objVal = $obj['amount']['value'] ?? null;
        if ($objVal !== null && $objVal !== '') {
            $paidRub  = (int) round((float) $objVal);
            $expected = (int) ($pay['amount'] ?? 0);
            if ($expected > 0 && $paidRub !== $expected) {
                if (function_exists('audit')) {
                    audit('payment_amount_mismatch', 'payments', (int) ($pay['id'] ?? 0),
                          ['yukassa_id' => $paymentId, 'expected' => $expected, 'paid' => $paidRub]);
                }
                return false;
            }
        }
    }

    $prev = (string) ($pay['status'] ?? '');
    if ($pay && $prev !== $status) {
        update('payments', ['status' => $status], 'yukassa_id=:pid', ['pid' => $paymentId]);
    }
    if ($status !== 'succeeded') return false;

    $firstTime = ($prev !== 'succeeded');   // эффекты — один раз
    if (!$firstTime) return false;

    $meta    = $obj['metadata'] ?? [];
    // Пакетная оплата: metadata.application_ids = "12,15,18" — помечаем ВСЕ как paid.
    $batchIds = [];
    if (!empty($meta['application_ids'])) {
        $batchIds = array_values(array_unique(array_filter(array_map('intval', explode(',', (string) $meta['application_ids'])))));
    }
    $appId   = ($pay['application_id'] ?? null) ?: ($meta['application_id'] ?? null);
    if (!$batchIds && $appId) $batchIds = [(int) $appId];
    $orderId = ($pay['order_id'] ?? null) ?: ($meta['order_id'] ?? null);

    $email = ''; $name = '';
    if ($batchIds) {
        foreach ($batchIds as $aid) {
            update('applications', ['is_paid' => 1, 'status' => 'paid'], 'id=:id', ['id' => (int) $aid]);
        }
        // Первая заявка — источник email/имени для письма
        $app = one("SELECT * FROM applications WHERE id=?", [(int) $batchIds[0]]);
        if ($app) { $email = (string) ($app['email'] ?? ''); $name = (string) ($app['full_name'] ?? ''); }
        // Синхронизируем локальную переменную для обратной совместимости
        $appId = (int) $batchIds[0];

        // Реф-бонус педагогу — по первой заявке (единый чек)
        if (!function_exists('referral_confirm_payment') && is_file(__DIR__ . '/loyalty.php')) {
            require_once __DIR__ . '/loyalty.php';
        }
        if (function_exists('referral_confirm_payment')) {
            $refReward = referral_confirm_payment((int) $appId);
            if ($refReward > 0 && function_exists('audit')) {
                audit('referral_paid', 'applications', (int) $appId, ['reward' => $refReward, 'payment_id' => $paymentId, 'batch' => count($batchIds)]);
            }
        }
    }
    if ($orderId) {
        update('awards_orders', ['status' => 'paid'], 'id=:id', ['id' => (int) $orderId]);
        if ($email === '') {
            $ord = one("SELECT * FROM awards_orders WHERE id=?", [(int) $orderId]);
            if ($ord) { $email = (string) ($ord['email'] ?? ''); $name = (string) ($ord['full_name'] ?? ''); }
        }
        // Клубное членство — активируем при успешной оплате (годовая подписка).
        $ordRow = one("SELECT user_id, email, items FROM awards_orders WHERE id=?", [(int) $orderId]);
        if ($ordRow && strpos((string) ($ordRow['items'] ?? ''), '"kind":"club"') !== false) {
            if (!function_exists('club_grant') && is_file(__DIR__ . '/club.php')) require_once __DIR__ . '/club.php';
            $cuid = (int) ($ordRow['user_id'] ?? 0);
            if (!$cuid && !empty($ordRow['email'])) {
                $cu = one("SELECT id FROM users WHERE email=?", [mb_strtolower((string) $ordRow['email'])]);
                $cuid = (int) ($cu['id'] ?? 0);
            }
            if ($cuid > 0 && function_exists('club_grant')) { club_grant($cuid, 1, 'payment'); }
        }
    }

    $amount = $pay['amount'] ?? ($obj['amount']['value'] ?? '');

    // In-app уведомление пользователю об оплате
    if ($appId && is_file(__DIR__ . '/notifications.php')) {
        require_once __DIR__ . '/notifications.php';
        $usr = one("SELECT user_id FROM applications WHERE id=?", [(int) $appId]);
        $uidNotif = (int) ($usr['user_id'] ?? 0);
        if ($uidNotif > 0) {
            $bodyMsg = 'Спасибо! Мы получили оргвзнос ' . (int)($pay['amount'] ?? 0) . ' ₽.';
            if (count($batchIds) > 1) $bodyMsg .= ' Оплачено ' . count($batchIds) . ' заявок одним чеком.';
            notify_user($uidNotif, 'Оплата получена', $bodyMsg, '/cabinet#apps', 'pay');
        }
    }

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
