<?php
/**
 * Платёжный модуль Культурного центра «Музыкальный Мир» — единая логика применения статуса ЮKassa.
 * Используется и вебхуком (api/v1/webhook_yukassa.php), и крон-реконсилером
 * (cron/reconcile_payments.php), чтобы платежи подтверждались даже без настроенных
 * в ЛК HTTP-уведомлений: реконсилер сам опрашивает статус по API (pull), вебхук — push.
 * Все функции идемпотентны и мягкие (не бросают наружу). Требует core/db.php + helpers.
 */
declare(strict_types=1);

/**
 * Создание платежа ЮKassa (заглушка, пока магазин не верифицирован).
 * Если ключи не заданы — возвращает stub. Все ошибки cURL — тихий фолбэк на null.
 */
function yukassa_create_payment(int $amount, string $description, array $meta = []): ?array {
    $shop = cfgv('yukassa_shop');
    $secret = cfgv('yukassa_secret');
    if (!$shop || !$secret || $amount <= 0) {
        return ['id' => 'stub-' . bin2hex(random_bytes(6)), 'status' => 'pending', 'stub' => true, 'confirmation_url' => null];
    }
    $body = [
        'amount'       => ['value' => number_format($amount, 2, '.', ''), 'currency' => 'RUB'],
        'capture'      => true,
        // Подписка ВИП-клуба: просим ЮKassa сохранить способ оплаты, чтобы следующие
        // периоды списывались автоматически (cron/club_billing.php) без участия плательщика.
        'save_payment_method' => !empty($meta['save_payment_method']),
        // Возврат с ЮKassa — на страницу ожидания оплаты (спиннер → окно успеха).
        // Путь можно переопределить через meta.return_path.
        'confirmation' => ['type' => 'redirect', 'return_url' => rtrim(cfgv('base_url'), '/') . ((string) ($meta['return_path'] ?? '/pay-status'))],
        'description'  => mb_substr($description, 0, 128),
        'metadata'     => $meta,
    ];
    // Чек 54-ФЗ (для самозанятого/НПД ЮKassa регистрирует чек). Добавляем, если есть email.
    $email = $meta['email'] ?? '';
    if ($email !== '' && filter_var($email, FILTER_VALIDATE_EMAIL)) {
        $body['receipt'] = [
            'customer' => ['email' => $email],
            'items'    => [[
                'description'     => mb_substr($description, 0, 128),
                'quantity'        => '1.00',
                'amount'          => ['value' => number_format($amount, 2, '.', ''), 'currency' => 'RUB'],
                'vat_code'        => 1,              // без НДС (самозанятый/НПД)
                'payment_mode'    => 'full_payment',
                'payment_subject' => 'service',
            ]],
        ];
    }
    $payload = json_encode($body, JSON_UNESCAPED_UNICODE);
    $ch = curl_init('https://api.yookassa.ru/v3/payments');
    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_POST           => true,
        CURLOPT_POSTFIELDS     => $payload,
        CURLOPT_USERPWD        => $shop . ':' . $secret,
        CURLOPT_HTTPHEADER     => ['Content-Type: application/json', 'Idempotence-Key: ' . bin2hex(random_bytes(16))],
        CURLOPT_TIMEOUT        => 10,
    ]);
    $resp = curl_exec($ch);
    $err = curl_errno($ch);
    curl_close($ch);
    if ($err || !$resp) return null;
    $data = json_decode($resp, true);
    if (!is_array($data) || empty($data['id'])) return null;
    return [
        'id'               => $data['id'],
        'status'           => $data['status'] ?? 'pending',
        'confirmation_url' => $data['confirmation']['confirmation_url'] ?? null,
        // Сохранённый способ оплаты — по нему списываются следующие периоды подписки.
        'payment_method_id' => (!empty($data['payment_method']['saved']) && !empty($data['payment_method']['id']))
            ? (string) $data['payment_method']['id'] : '',
    ];
}

/**
 * Автосписание по сохранённому способу оплаты (рекуррент ЮKassa).
 * Используется для продления подписки ВИП-клуба без участия плательщика.
 * Возвращает ['id','status'] или null при ошибке сети/конфигурации.
 */
function yukassa_charge_saved(int $amount, string $paymentMethodId, string $description, array $meta = []): ?array {
    $shop = cfgv('yukassa_shop'); $secret = cfgv('yukassa_secret');
    if (!$shop || !$secret || $amount <= 0 || trim($paymentMethodId) === '') return null;
    $body = [
        'amount'            => ['value' => number_format($amount, 2, '.', ''), 'currency' => 'RUB'],
        'capture'           => true,
        'payment_method_id' => $paymentMethodId,
        'description'       => mb_substr($description, 0, 128),
        'metadata'          => $meta,
    ];
    $email = (string) ($meta['email'] ?? '');
    if ($email !== '' && filter_var($email, FILTER_VALIDATE_EMAIL)) {
        $body['receipt'] = [
            'customer' => ['email' => $email],
            'items'    => [[
                'description'     => mb_substr($description, 0, 128),
                'quantity'        => '1.00',
                'amount'          => ['value' => number_format($amount, 2, '.', ''), 'currency' => 'RUB'],
                'vat_code'        => 1, 'payment_mode' => 'full_payment', 'payment_subject' => 'service',
            ]],
        ];
    }
    $ch = curl_init('https://api.yookassa.ru/v3/payments');
    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_POST           => true,
        CURLOPT_POSTFIELDS     => json_encode($body, JSON_UNESCAPED_UNICODE),
        CURLOPT_USERPWD        => $shop . ':' . $secret,
        CURLOPT_HTTPHEADER     => ['Content-Type: application/json', 'Idempotence-Key: ' . bin2hex(random_bytes(16))],
        CURLOPT_TIMEOUT        => 15,
    ]);
    $resp = curl_exec($ch); $err = curl_errno($ch); curl_close($ch);
    if ($err || !$resp) return null;
    $data = json_decode($resp, true);
    if (!is_array($data) || empty($data['id'])) return null;
    return ['id' => (string) $data['id'], 'status' => (string) ($data['status'] ?? 'pending')];
}

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
 * Находит УСПЕШНЫЙ платёж, покрывающий заявку (для возврата при отклонении).
 * Прямое совпадение payments.application_id. Возвращает строку payments или null.
 */
function payment_for_application(int $appId): ?array {
    if ($appId <= 0 || !function_exists('tbl_exists') || !tbl_exists('payments')) return null;
    // Успешный, ещё не возвращённый платёж по этой заявке.
    $p = one("SELECT * FROM payments WHERE application_id=? AND status='succeeded'
              AND (yukassa_id<>'' AND yukassa_id NOT LIKE 'stub-%') ORDER BY id DESC LIMIT 1", [$appId]);
    return $p ?: null;
}

/**
 * Возврат средств в ЮKassa: POST /v3/refunds. Полный или частичный.
 * @param string $paymentId  ЮKassa payment id (succeeded).
 * @param float  $amountRub  сумма к возврату в рублях (>0).
 * @param string $reason     причина (уходит в description, до 250 симв.).
 * @return array ['ok'=>bool, 'id'=>?string, 'status'=>?string, 'error'=>?string]
 */
function yukassa_refund(string $paymentId, float $amountRub, string $reason = ''): array {
    $shop = cfgv('yukassa_shop');
    $secret = cfgv('yukassa_secret');
    if (!$shop || !$secret) return ['ok' => false, 'error' => 'ЮKassa не настроена (нет shop/secret).'];
    if ($paymentId === '' || str_starts_with($paymentId, 'stub-')) return ['ok' => false, 'error' => 'Некорректный id платежа.'];
    if ($amountRub <= 0) return ['ok' => false, 'error' => 'Сумма возврата должна быть > 0.'];

    $body = [
        'payment_id' => $paymentId,
        'amount'     => ['value' => number_format($amountRub, 2, '.', ''), 'currency' => 'RUB'],
    ];
    if ($reason !== '') $body['description'] = mb_substr($reason, 0, 250);

    $ik = 'rf-' . $paymentId . '-' . substr(hash('sha256', $paymentId . '|' . $amountRub . '|' . $reason), 0, 16);
    $ch = curl_init('https://api.yookassa.ru/v3/refunds');
    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_POST           => true,
        CURLOPT_USERPWD        => $shop . ':' . $secret,
        CURLOPT_HTTPHEADER     => ['Content-Type: application/json', 'Idempotence-Key: ' . $ik],
        CURLOPT_POSTFIELDS     => json_encode($body, JSON_UNESCAPED_UNICODE),
        CURLOPT_TIMEOUT        => 20,
    ]);
    $resp = curl_exec($ch);
    $code = (int) curl_getinfo($ch, CURLINFO_HTTP_CODE);
    $cerr = curl_errno($ch) ? curl_error($ch) : '';
    curl_close($ch);
    if ($cerr) return ['ok' => false, 'error' => 'Сеть ЮKassa: ' . $cerr];
    $d = json_decode((string) $resp, true);
    if ($code >= 200 && $code < 300 && is_array($d) && !empty($d['id'])) {
        return ['ok' => true, 'id' => (string) $d['id'], 'status' => (string) ($d['status'] ?? 'pending')];
    }
    $msg = is_array($d) ? ((string) ($d['description'] ?? $d['type'] ?? '') ?: ('HTTP ' . $code)) : ('HTTP ' . $code);
    return ['ok' => false, 'error' => $msg, 'http' => $code, 'raw' => is_array($d) ? $d : null];
}

/**
 * Полный сценарий возврата по заявке при отклонении платного конкурса.
 * Находит платёж, вызывает возврат, помечает payments.status='refunded', пишет audit.
 * @return array ['ok'=>bool, 'amount'=>int, 'error'=>?string, 'refund_id'=>?string]
 */
function refund_application(int $appId, string $reason = ''): array {
    $pay = payment_for_application($appId);
    if (!$pay) return ['ok' => false, 'amount' => 0, 'error' => 'Успешный платёж по заявке не найден (возможно, бесплатный конкурс или оплата вручную).'];
    if ((string) ($pay['status'] ?? '') === 'refunded') {
        return ['ok' => true, 'amount' => (int) ($pay['amount'] ?? 0), 'already' => true, 'refund_id' => ''];
    }
    $amount = (float) (int) ($pay['amount'] ?? 0);
    if ($amount <= 0) {
        // Сумма 0 (бесплатно) — возвращать нечего, но не ошибка.
        return ['ok' => true, 'amount' => 0, 'error' => null, 'refund_id' => ''];
    }
    $res = yukassa_refund((string) $pay['yukassa_id'], $amount, $reason !== '' ? ('Возврат оргвзноса: ' . $reason) : 'Возврат оргвзноса по отклонённой заявке');
    if (!$res['ok']) {
        if (function_exists('audit')) audit('refund_failed', 'payments', (int) $pay['id'], ['app' => $appId, 'error' => $res['error'] ?? '', 'yukassa_id' => $pay['yukassa_id']]);
        return ['ok' => false, 'amount' => (int) $amount, 'error' => $res['error'] ?? 'Не удалось выполнить возврат.'];
    }
    update('payments', ['status' => 'refunded'], 'id=:id', ['id' => (int) $pay['id']]);
    if (function_exists('audit')) audit('refund_succeeded', 'payments', (int) $pay['id'], ['app' => $appId, 'amount' => (int) $amount, 'refund_id' => $res['id'], 'yukassa_id' => $pay['yukassa_id']]);
    return ['ok' => true, 'amount' => (int) $amount, 'error' => null, 'refund_id' => (string) $res['id']];
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
        // Сумму чека раскладываем по заявкам батча — чтобы «Сумма участия» в админке и
        // кабинете была реальной у КАЖДОЙ заявки, а не только у первой (к ней привязан
        // платёж). Остаток от деления отдаём первой заявке, чтобы итог сходился до рубля.
        $__total = (int) round(((float) ($obj['amount']['value'] ?? 0)) * 100) / 100;
        $__total = (int) $__total;
        $__n     = count($batchIds);
        $__share = $__n > 0 ? intdiv($__total, $__n) : 0;
        $__rest  = $__total - $__share * $__n;
        // batch_id — идентификатор пакета, одинаковый у всех заявок одного чека.
        // Берём yukassa_id платежа: он гарантированно уникален и позволяет по любой
        // заявке батча найти всех «соседей» без обращения к metadata ЮKassa.
        $__batchId = (string) ($pay['yukassa_id'] ?? $paymentId);
        $__payId   = (int) ($pay['id'] ?? 0);
        foreach ($batchIds as $__k => $aid) {
            $__upd = ['is_paid' => 1, 'status' => 'paid', 'batch_id' => $__batchId, 'payment_id' => $__payId];
            if ($__total > 0) $__upd['amount_paid'] = $__share + ($__k === 0 ? $__rest : 0);
            update('applications', $__upd, 'id=:id', ['id' => (int) $aid]);
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

        // Письмо «Заявка принята» (с плашкой «Оплата получена») — только СЕЙЧАС, после
        // подтверждения оплаты. До оплаты платная заявка не слала письмо о принятии
        // (api/v1/apply.php). Для платных заявок это письмо заменяет общий payment_success
        // (ниже он для app-батчей подавляется, чтобы не было дубля).
        if (is_file(__DIR__ . '/result_mail.php')) {
            require_once __DIR__ . '/result_mail.php';
            if (function_exists('application_mail_send')) {
                foreach ($batchIds as $aid) {
                    try { application_mail_send((int) $aid, true); } catch (\Throwable $e) { /* тихо, в mail.log */ }
                }
            }
        }
    }
    if ($orderId) {
        update('awards_orders', ['status' => 'paid'], 'id=:id', ['id' => (int) $orderId]);
        // ОРИГИНАЛЫ: сразу (не ждём) собираем производственный пакет — чистые дипломы
        // (без подписи/печати, с номером+QR) + состав/адрес → в Telegram-ветку и в админку.
        if (is_file(__DIR__ . '/orders.php')) {
            require_once __DIR__ . '/orders.php';
            if (function_exists('order_dispatch_production')) {
                try { order_dispatch_production((int) $orderId); } catch (\Throwable $e) { error_log('order_dispatch_production: ' . $e->getMessage()); }
            }
            // ЭЛЕКТРОННЫЕ: создаём наградные документы и планируем отправку —
            // ВИП-клуб через 3 рабочих дня, остальные через 5 (важно для длинного
            // бесплатного конкурса, где награды не входят в участие и заказываются).
            if (function_exists('order_fulfill_digital')) {
                try { order_fulfill_digital((int) $orderId); } catch (\Throwable $e) { error_log('order_fulfill_digital: ' . $e->getMessage()); }
            }
        }
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
            if ($cuid > 0 && function_exists('club_grant')) {
                // Период членства: годовой (12 мес) если в items period=year, иначе 1 месяц.
                $clubMonths = (strpos((string) ($ordRow['items'] ?? ''), '"period":"year"') !== false) ? 12 : 1;
                // Сохранённый способ оплаты → автопродление следующего периода
                // (месяц или год) без участия участника: cron/club_billing.php.
                $clubSt = club_grant($cuid, $clubMonths, 'payment', [
                    'period' => $clubMonths >= 12 ? 'year' : 'month',
                    'payment_method_id' => (string) (($obj['payment_method']['saved'] ?? false) ? ($obj['payment_method']['id'] ?? '') : ''),
                ]);
                // Уведомление владельца: вступление/продление ВИП-клуба.
                if (!function_exists('owner_notify') && is_file(__DIR__ . '/notify_owner.php')) {
                    require_once __DIR__ . '/notify_owner.php';
                }
                if (function_exists('owner_notify')) {
                    $cu2 = one("SELECT full_name, email FROM users WHERE id=?", [$cuid]);
                    owner_notify('ВИП-КЛУБ', 'Новое членство в клубе', 'Оплата подписки клуба прошла успешно.', [
                        'Участник'  => trim((string) ($cu2['full_name'] ?? '')) ?: ('user #' . $cuid),
                        'Email'     => (string) ($cu2['email'] ?? ''),
                        'Действует до' => (string) ($clubSt['expires_at'] ?? ''),
                        'Платёж'    => $paymentId,
                        '_event'    => 'club_join',
                        '_meta'     => ['user_id' => $cuid, 'payment' => $paymentId],
                    ]);
                }
            }
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
    // Для заявок-батчей общий payment_success НЕ шлём — участник уже получил
    // фирменное «Заявка принята» с плашкой «Оплата получена» (см. выше). Общее
    // письмо об оплате оставляем для заказов наград и одиночных платежей.
    $suppressPaySuccess = !empty($batchIds) && empty($orderId);
    if (!$suppressPaySuccess && $email !== '' && function_exists('mail_queue')) {
        $baseCab = rtrim((string) cfgv('base_url'), '/');
        if ($orderId) {
            // Заказ наградных материалов оплачен — письмо «принят в производство».
            $preheader = 'Заявка на изготовление наградного материала принята. Заказ передан в изготовление.';
            $heroSub   = 'Заказ №' . (int) $orderId . ' · передан в изготовление';
            $actions   = [['Отследить в кабинете', $baseCab . '/cabinet'], ['Оставить отзыв', $baseCab . '/reviews']];
            $subjectPay = 'Заявка на изготовление наград принята — Культурный центр «Музыкальный Мир»';
        } else {
            $preheader = 'Оплата участия получена. Работа передана жюри.';
            $heroSub   = 'Оплата подтверждена';
            // «Другие конкурсы» убрана — в подвале письма уже есть «Другие конкурсы центра».
            $actions   = [['Оставить отзыв', $baseCab . '/reviews']];
            $subjectPay = 'Оплата получена — Культурный центр «Музыкальный Мир»';
        }
        $html = function_exists('mail_template')
            ? mail_template('payment_success', ['name' => $name, 'full_name' => $name, 'amount' => $amount, 'payment_id' => $paymentId, 'cabinet_url' => $baseCab . '/cabinet',
                '_tx' => [
                    'preheader' => $preheader,
                    'hero'      => mm_cta_primary($baseCab . '/cabinet', 'Перейти в личный кабинет', $heroSub),
                    'actions'   => $actions,
                    'thanks'    => true,
                ]])
            : '<p>Здравствуйте' . ($name ? ', ' . h($name) : '') . '!</p><p>Оплата успешно получена. Благодарим Вас!</p>';
        mail_queue($email, $name, $subjectPay, $html);
    }

    if (function_exists('tg_notify_admin')) {
        tg_notify_admin('Оплата прошла: ' . $paymentId . ' на сумму ' . $amount . ' ₽');
    }

    // --- Уведомление владельца в 3 канала + серверная аналитика ---
    if (!function_exists('owner_notify') && is_file(__DIR__ . '/notify_owner.php')) {
        require_once __DIR__ . '/notify_owner.php';
    }
    if (function_exists('owner_notify')) {
        try {
            if ($orderId) {
                // Оплата заказа наградных материалов — в ветку заказов.
                owner_notify('ЗАКАЗЫ НАГРАД', 'Заказ наград №' . (int) $orderId . ' оплачен', '', [
                    'Заказ'      => '№' . (int) $orderId,
                    'Покупатель' => $name,
                    'Email'      => $email,
                    'Сумма'      => (int) $amount . ' ₽',
                    'Платёж'     => $paymentId,
                    '_event'     => 'order_paid',
                    '_meta'      => ['order_id' => (int) $orderId, 'amount' => (int) $amount],
                ]);
            }
            if ($batchIds) {
                $numsRow = all('SELECT number FROM applications WHERE id IN ('
                    . implode(',', array_map('intval', $batchIds)) . ')');
                $nums = implode(', ', array_map(static fn($r) => (string) $r['number'], $numsRow));
                // Полное письмо центру: все поля заявки + оплата + кнопка «Оценить».
                $payExtra = [
                    'Оргвзнос' => (int) $amount . ' ₽ · ОПЛАЧЕНО',
                    'Платёж'   => $paymentId,
                    '_event'   => 'payment',
                    '_meta'    => ['payment' => $paymentId, 'amount' => (int) $amount, 'apps' => count($batchIds)],
                ];
                if (count($batchIds) > 1) $payExtra['Заявок в чеке'] = (string) count($batchIds) . ' (' . ($nums ?: '') . ')';
                owner_notify('ОПЛАТЫ', 'Оплата оргвзноса получена — заявка принята', '',
                    function_exists('owner_app_data')
                        ? owner_app_data((int) $batchIds[0], $payExtra)
                        : [
                            'Заявки' => $nums ?: ('#' . implode(', #', $batchIds)),
                            'Участник' => $name, 'Email' => $email, 'Сумма' => (int) $amount . ' ₽',
                            'Платёж' => $paymentId, '_event' => 'payment',
                            '_meta' => ['payment' => $paymentId, 'amount' => (int) $amount, 'apps' => count($batchIds)],
                          ]
                );
            } elseif (!$orderId) {
                owner_notify('ОПЛАТЫ', 'Оплата получена', '', [
                    'Сумма'  => (int) $amount . ' ₽',
                    'Платёж' => $paymentId,
                    '_event' => 'payment',
                    '_meta'  => ['payment' => $paymentId, 'amount' => (int) $amount],
                ]);
            }
        } catch (\Throwable $e) { /* тихо */ }
    }
    if (function_exists('audit')) {
        audit('payment_succeeded', 'payments', (int) ($pay['id'] ?? 0), ['yukassa_id' => $paymentId, 'amount' => $amount]);
    }
    return true;
}
