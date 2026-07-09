<?php
/**
 * /api/v1/subscriptions/* — подписка Метанойя+ и разовые платежи (Lava.top).
 *   GET  /subscriptions/me      — текущий статус подписки
 *   POST /subscriptions/create  — {plan: monthly|yearly|lifetime} → ссылка на оплату
 *   POST /subscriptions/trial   — активировать пробные 7 дней
 *   POST /subscriptions/cancel  — отменить подписку (доступ до конца оплаченного)
 *   POST /subscriptions/donate  — {amount, display_name?} → ссылка на пожертвование
 */

declare(strict_types=1);

require_once __DIR__ . '/../core/lava.php';

/** Активна ли подписка/триал прямо сейчас. */
function subActive(int $userId): ?array
{
    $s = DB::query(
        "SELECT * FROM subscriptions
         WHERE user_id = ? AND status IN ('active','trial')
           AND (expires_at IS NULL OR expires_at > NOW())
         ORDER BY id DESC LIMIT 1",
        [$userId]
    )->fetch();
    return $s ?: null;
}

function handle(array $segments, string $method): never
{
    $action = $segments[1] ?? '';
    $user = Auth::requireUser();
    $uid = (int) $user['id'];
    $in = Response::input();

    switch ("$method $action") {

        // ── GET /subscriptions/me ──────────────────────────
        case 'GET me': {
            $s = subActive($uid);
            Response::ok([
                'active'      => $s !== null,
                'plan'        => $s['plan'] ?? null,
                'status'      => $s['status'] ?? 'none',
                'expires_at'  => $s['expires_at'] ?? null,
                'next_charge' => $s['next_charge_at'] ?? null,
            ]);
        }

        // ── POST /subscriptions/trial ──────────────────────
        case 'POST trial': {
            if (subActive($uid)) Response::error('Подписка уже активна', 409);
            // повторный триал запрещаем
            $had = DB::query("SELECT 1 FROM subscriptions WHERE user_id = ? AND plan = 'trial' LIMIT 1", [$uid])->fetch();
            if ($had) Response::error('Пробный период уже использован', 409);

            DB::query(
                "INSERT INTO subscriptions (user_id, plan, status, started_at, expires_at)
                 VALUES (?, 'trial', 'trial', NOW(), DATE_ADD(NOW(), INTERVAL 7 DAY))",
                [$uid]
            );
            Response::ok(['active' => true, 'status' => 'trial', 'days' => 7]);
        }

        // ── POST /subscriptions/create ─────────────────────
        case 'POST create': {
            $plan = in_array($in['plan'] ?? '', ['monthly', 'yearly', 'lifetime'], true) ? $in['plan'] : 'monthly';
            if (!Lava::configured()) {
                Response::error('Приём оплаты ещё не подключён. Мы сообщим, как только Метанойя+ станет доступна.', 503);
            }
            $offer = Lava::offerFor($plan);
            if (!$offer) Response::error('Тариф недоступен', 400);

            try {
                $invoice = Lava::createInvoice($user['email'], $offer);
            } catch (Throwable $e) {
                error_log('[subscriptions] ' . $e->getMessage());
                Response::error('Не удалось создать счёт, попробуйте позже', 502);
            }

            DB::query(
                "INSERT INTO payments (user_id, amount, kind, status, lava_invoice_id, meta)
                 VALUES (?, 0, 'subscription', 'pending', ?, ?)",
                [$uid, $invoice['id'], json_encode(['plan' => $plan], JSON_UNESCAPED_UNICODE)]
            );
            Response::ok(['payment_url' => $invoice['url']]);
        }

        // ── POST /subscriptions/cancel ─────────────────────
        case 'POST cancel': {
            $s = subActive($uid);
            if (!$s) Response::error('Активной подписки нет', 404);
            DB::query(
                "UPDATE subscriptions SET status = 'cancelled', cancelled_at = NOW() WHERE id = ?",
                [(int) $s['id']]
            );
            // TODO: при интеграции — отменить рекуррент в Lava по lava_subscription_id
            Response::ok(['status' => 'cancelled', 'access_until' => $s['expires_at']]);
        }

        // ── POST /subscriptions/donate ─────────────────────
        case 'POST donate': {
            $amount = (float) ($in['amount'] ?? 0);
            if ($amount < 10 || $amount > 100000) Response::error('Некорректная сумма', 400);
            if (!Lava::configured()) Response::error('Приём пожертвований ещё не подключён', 503);

            $offer = Config::get('LAVA_OFFER_DONATION');
            if (!$offer) Response::error('Пожертвования временно недоступны', 400);

            try {
                $invoice = Lava::createInvoice($user['email'], $offer);
            } catch (Throwable $e) {
                Response::error('Не удалось создать счёт', 502);
            }
            DB::query(
                "INSERT INTO payments (user_id, amount, kind, status, lava_invoice_id, meta)
                 VALUES (?, ?, 'donation', 'pending', ?, ?)",
                [$uid, $amount, $invoice['id'], json_encode(['display_name' => substr(trim($in['display_name'] ?? ''), 0, 120)], JSON_UNESCAPED_UNICODE)]
            );
            Response::ok(['payment_url' => $invoice['url']]);
        }

        default:
            Response::error('Не найдено', 404);
    }
}
