<?php
/**
 * КАНОНИЧЕСКИЙ КЛЮЧ АДРЕСА ДОСТАВКИ.
 *
 * Подсказки DaData на форме есть, но поле остаётся обычным текстом: человек
 * может напечатать адрес руками, вставить из буфера или поправить выбранное. По
 * базе так и вышло — шесть адресов из девятнадцати вписаны без подсказки. Один
 * педагог оформил четыре заказа за восемь минут и записал свой адрес двумя
 * способами:
 *
 *   «г.Балашиха, мкр. Железнодорожный, ул. Поликахина д.1, индекс 143980»
 *   «Россия, Московская обл, г Балашиха, мкр Железнодорожный, ул Поликахина»
 *
 * Для человека это одна квартира, для группировки — два разных адреса, и центр
 * собрал две посылки: две доставки, два трека, два похода на почту.
 *
 * ЗДЕСЬ АДРЕС ЧЕЛОВЕКА НЕ ПЕРЕПИСЫВАЕТСЯ. На конверте печатается ровно то, что
 * он написал: почтальон повезёт по этой строке, и подменять её догадкой сервиса
 * нельзя — DaData возвращает адрес без квартиры чаще, чем хотелось бы. Вместо
 * этого заказ получает ОТДЕЛЬНЫЙ ключ: канонический вид от DaData, приведённый
 * к набору значимых слов. Совпал ключ — одна посылка.
 *
 * Сервис недоступен или ключа нет — ключ считается по самой строке, как раньше.
 * Хуже прежнего не станет.
 */
declare(strict_types=1);

if (!function_exists('addr_dadata_canonical')) {
    /**
     * Канонический вид адреса по DaData: [значение, индекс]. Пустое — не вышло.
     *
     * @return array{0:string,1:string}
     */
    function addr_dadata_canonical(string $addr): array {
        $addr = trim($addr);
        if ($addr === '' || mb_strlen($addr) < 6) return ['', ''];
        $token = (string) (function_exists('cfgv') ? cfgv('dadata_token', '') : '');
        if ($token === '') return ['', ''];

        $ch = curl_init('https://suggestions.dadata.ru/suggestions/api/4_1/rs/suggest/address');
        curl_setopt_array($ch, [
            CURLOPT_POST           => true,
            CURLOPT_POSTFIELDS     => json_encode(['query' => $addr, 'count' => 1], JSON_UNESCAPED_UNICODE),
            CURLOPT_HTTPHEADER     => ['Content-Type: application/json', 'Accept: application/json',
                                       'Authorization: Token ' . $token],
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_TIMEOUT        => 6,
            CURLOPT_CONNECTTIMEOUT => 4,
        ]);
        $raw = (string) curl_exec($ch);
        $code = (int) curl_getinfo($ch, CURLINFO_HTTP_CODE);
        curl_close($ch);
        if ($code !== 200 || $raw === '') return ['', ''];

        $j = json_decode($raw, true);
        $s = (array) (($j['suggestions'] ?? [])[0] ?? []);
        $value = trim((string) ($s['value'] ?? ''));
        if ($value === '') return ['', ''];

        /* СЕРВИС МОГ ПОНЯТЬ АДРЕС СОВСЕМ НЕ ТАК.
         *
         * На обрывок он честно предлагает ближайшее похожее: «ул Новая» в другой
         * области, село с созвучным названием. Принять такое значит склеить две
         * разные посылки в одну — а это хуже, чем оставить их порознь. Берём
         * ответ только если он сходится с написанным по ядру. */
        if (!function_exists('og_norm_address') && is_file(BASE_PATH . '/core/order_group.php')) {
            require_once BASE_PATH . '/core/order_group.php';
        }
        if (function_exists('og_norm_address') && function_exists('og_addr_same')) {
            if (!og_addr_same(og_norm_address($value), og_norm_address($addr))) return ['', ''];
        }
        return [$value, trim((string) ($s['data']['postal_code'] ?? ''))];
    }
}

if (!function_exists('addr_key_migrate')) {
    /** Мягкая миграция: колонка ключа адреса у заказов. */
    function addr_key_migrate(): void {
        static $done = false;
        if ($done) return;
        $done = true;
        try { db()->exec("ALTER TABLE awards_orders ADD COLUMN addr_key TEXT DEFAULT ''"); }
        catch (\Throwable $e) { /* колонка уже есть */ }
    }
}

if (!function_exists('addr_key')) {
    /**
     * Ключ для группировки посылок. Канонический вид от DaData, приведённый к
     * набору значимых слов; сервис не ответил — та же нормализация по строке.
     */
    function addr_key(string $addr): string {
        if (!function_exists('og_norm_address') && is_file(BASE_PATH . '/core/order_group.php')) {
            require_once BASE_PATH . '/core/order_group.php';
        }
        if (!function_exists('og_norm_address')) return mb_strtolower(trim($addr));
        [$canon] = addr_dadata_canonical($addr);
        return og_norm_address($canon !== '' ? $canon : $addr);
    }
}
