<?php
/**
 * /api/v1/webhooks/lava — приём событий оплаты от Lava.top.
 * БЕЗ авторизации пользователя: подлинность — по подписи (LAVA_SECRET).
 * Идемпотентно по lava_invoice_id (UNIQUE в payments).
 *
 * CONFIRM по доке Lava.top: имя заголовка подписи и поля тела
 * (invoiceId/status). Логика ниже — рабочая для стандартной схемы.
 */

declare(strict_types=1);

require_once __DIR__ . '/../core/lava.php';

function planDuration(string $plan): ?string
{
    return match ($plan) {
        'monthly'  => '1 MONTH',
        'yearly'   => '1 YEAR',
        'lifetime' => '100 YEAR',
        default    => '1 MONTH',
    };
}

function handle(array $segments, string $method): never
{
    $provider = $segments[1] ?? '';
    if ($provider !== 'lava' || $method !== 'POST') {
        Response::error('Не найдено', 404);
    }

    $raw = file_get_contents('php://input') ?: '';
    // CONFIRM: заголовок подписи по доке Lava.top
    $sig = $_SERVER['HTTP_X_SIGNATURE'] ?? ($_SERVER['HTTP_X_API_SIGNATURE'] ?? null);

    if (!Lava::verifyWebhook($raw, $sig)) {
        error_log('[webhook:lava] неверная подпись');
        Response::error('Неверная подпись', 401);
    }

    $ev = json_decode($raw, true);
    if (!is_array($ev)) Response::error('Некорректное тело', 400);

    $invoiceId = (string) ($ev['invoiceId'] ?? ($ev['id'] ?? ''));
    $status    = (string) ($ev['status'] ?? '');
    if ($invoiceId === '') Response::error('Нет invoiceId', 400);

    $pay = DB::query('SELECT * FROM payments WHERE lava_invoice_id = ? LIMIT 1', [$invoiceId])->fetch();
    if (!$pay) {
        // счёт не наш или ещё не создан — подтверждаем приём, чтобы Lava не ретраила бесконечно
        Response::ok(['ignored' => true]);
    }
    if ($pay['status'] === 'success') {
        Response::ok(['already' => true]); // идемпотентность
    }

    $success = in_array($status, ['success', 'paid', 'completed'], true);
    $failed  = in_array($status, ['failed', 'cancelled', 'expired'], true);
    $refund  = in_array($status, ['refunded', 'refund'], true);

    $pdo = DB::pdo();
    $pdo->beginTransaction();
    try {
        if ($success) {
            DB::query("UPDATE payments SET status = 'success' WHERE id = ?", [(int) $pay['id']]);
            $meta = json_decode($pay['meta'] ?? '{}', true) ?: [];

            if ($pay['kind'] === 'subscription') {
                $plan = $meta['plan'] ?? 'monthly';
                $planEnum = $plan === 'lifetime' ? 'yearly' : $plan; // ENUM без lifetime → yearly + дальняя дата
                $dur = planDuration($plan);
                DB::query(
                    "INSERT INTO subscriptions (user_id, plan, status, lava_subscription_id, started_at, next_charge_at, expires_at)
                     VALUES (?, ?, 'active', ?, NOW(),
                             " . ($plan === 'lifetime' ? 'NULL' : "DATE_ADD(NOW(), INTERVAL $dur)") . ",
                             DATE_ADD(NOW(), INTERVAL $dur))",
                    [(int) $pay['user_id'], $planEnum, (string) ($ev['subscriptionId'] ?? '')]
                );
                DB::query('UPDATE payments SET subscription_id = LAST_INSERT_ID() WHERE id = ?', [(int) $pay['id']]);
            } elseif ($pay['kind'] === 'donation') {
                DB::query(
                    "INSERT INTO donations (user_id, payment_id, amount, display_name)
                     VALUES (?, ?, ?, ?)",
                    [(int) $pay['user_id'], (int) $pay['id'], (float) $pay['amount'], $meta['display_name'] ?? null]
                );
            }
        } elseif ($refund) {
            DB::query("UPDATE payments SET status = 'refunded' WHERE id = ?", [(int) $pay['id']]);
            if ($pay['subscription_id']) {
                DB::query("UPDATE subscriptions SET status = 'expired', expires_at = NOW() WHERE id = ?", [(int) $pay['subscription_id']]);
            }
        } elseif ($failed) {
            DB::query("UPDATE payments SET status = 'failed' WHERE id = ?", [(int) $pay['id']]);
        }
        $pdo->commit();
    } catch (Throwable $e) {
        $pdo->rollBack();
        error_log('[webhook:lava] ' . $e->getMessage());
        Response::error('Ошибка обработки', 500);
    }

    Response::ok(['processed' => true]);
}
