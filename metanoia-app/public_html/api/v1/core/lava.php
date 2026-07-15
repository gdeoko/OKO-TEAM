<?php
/**
 * Lava.top — клиент приёма платежей (подписки + разовые).
 * Ключи берутся из /config/.env: LAVA_API_KEY, LAVA_SECRET, LAVA_OFFER_*.
 *
 * ⚠ ПОДКЛЮЧЕНИЕ (когда Даниэль даст ключ):
 *   1. LAVA_API_KEY  — ключ API (личный кабинет Lava.top → API).
 *   2. LAVA_SECRET   — секрет для проверки подписи вебхука.
 *   3. LAVA_OFFER_MONTH / _YEAR / _LIFETIME — id «предложений» (offer) из ЛК.
 *   4. Сверить с актуальной докой Lava.top: базовый URL, имя заголовка подписи
 *      (отмечено «CONFIRM»). Всё остальное — рабочее.
 */

declare(strict_types=1);

final class Lava
{
    private const BASE = 'https://gate.lava.top';

    public static function configured(): bool
    {
        return (string) Config::get('LAVA_API_KEY', '') !== '';
    }

    /** offerId по коду тарифа. */
    public static function offerFor(string $plan): ?string
    {
        return match ($plan) {
            'monthly'  => Config::get('LAVA_OFFER_MONTH'),
            'yearly'   => Config::get('LAVA_OFFER_YEAR'),
            'lifetime' => Config::get('LAVA_OFFER_LIFETIME'),
            default    => null,
        };
    }

    /**
     * Создать счёт. Возвращает ['id' => invoiceId, 'url' => paymentUrl].
     * Контракт подтверждён на боевом API Lava.top (POST /api/v2/invoice → 201).
     * @throws RuntimeException при ошибке шлюза.
     */
    public static function createInvoice(string $email, string $offerId, string $currency = 'RUB', string $periodicity = 'MONTHLY'): array
    {
        $payload = [
            'email'        => $email,
            'offerId'      => $offerId,
            'currency'     => $currency,
            'periodicity'  => $periodicity,   // MONTHLY / PERIOD_90_DAYS / ...
            'buyerLanguage' => 'RU',
        ];
        $res = self::request('POST', '/api/v2/invoice', $payload);
        // Ответ Lava.top: {id, status, amountTotal, paymentUrl}
        $id  = $res['id'] ?? null;
        $url = $res['paymentUrl'] ?? ($res['url'] ?? null);
        if (!$id || !$url) {
            throw new RuntimeException('Lava: неожиданный ответ шлюза');
        }
        return ['id' => (string) $id, 'url' => (string) $url];
    }

    /**
     * Проверка подписи вебхука.
     * CONFIRM: имя заголовка подписи и схема — по доке Lava.top.
     * Стандартный вариант: HMAC-SHA256(сырое_тело, LAVA_SECRET) в hex.
     */
    public static function verifyWebhook(string $rawBody, ?string $signature): bool
    {
        $secret = (string) Config::get('LAVA_SECRET', '');
        if ($secret === '' || $signature === null) return false;
        $calc = hash_hmac('sha256', $rawBody, $secret);
        return hash_equals($calc, $signature);
    }

    private static function request(string $method, string $path, array $body): array
    {
        $ch = curl_init(self::BASE . $path);
        curl_setopt_array($ch, [
            CURLOPT_CUSTOMREQUEST  => $method,
            CURLOPT_POSTFIELDS     => json_encode($body, JSON_UNESCAPED_UNICODE),
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_TIMEOUT        => 20,
            CURLOPT_HTTPHEADER     => [
                'Content-Type: application/json',
                'Accept: application/json',
                'X-Api-Key: ' . (string) Config::get('LAVA_API_KEY', ''),
            ],
        ]);
        $out  = curl_exec($ch);
        $code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        $err  = curl_error($ch);
        curl_close($ch);

        if ($out === false) {
            throw new RuntimeException('Lava: сеть недоступна: ' . $err);
        }
        $data = json_decode($out, true);
        if ($code >= 400 || !is_array($data)) {
            error_log('[lava] HTTP ' . $code . ' ' . $out);
            throw new RuntimeException('Lava: ошибка шлюза (' . $code . ')');
        }
        return $data;
    }
}
