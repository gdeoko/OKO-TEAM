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

if (!function_exists('addr_validate')) {
    /**
     * ГОДИТСЯ ЛИ АДРЕС ДЛЯ ПОЧТЫ РОССИИ.
     *
     * Правило владельца: адрес берётся из подсказок, а не печатается на глаз.
     * Проверяем это на сервере, потому что в браузере проверку можно обойти, а
     * посылка уедет по тому, что записано.
     *
     * Годным считаем адрес, который сервис разобрал ДО ДОМА и для которого знает
     * почтовый индекс: без индекса Почта России посылку не примет, а без дома её
     * некуда везти.
     *
     * ЧЕГО СЕРВИС НЕ ЗНАЕТ — А ЛЮДИ ТАМ ЖИВУТ. Справочник ФИАС не всеведущ:
     * новостройки попадают в него с опозданием, в частном секторе бывают номера
     * без улицы, есть абонентские ящики и «до востребования», а адреса Беларуси,
     * Казахстана и дальнего зарубежья он знает куда хуже российских. Поэтому
     * отказ здесь не окончательный: у формы остаётся выход «моего адреса нет в
     * списке», и такой заказ помечается для проверки человеком, а не теряется.
     *
     * @return array{ok:bool, value:string, postal:string, reason:string}
     */
    function addr_validate(string $addr): array {
        $addr = trim($addr);
        $out = ['ok' => false, 'value' => '', 'postal' => '', 'reason' => ''];
        if ($addr === '') { $out['reason'] = 'адрес не указан'; return $out; }
        if (mb_strlen($addr) < 10) { $out['reason'] = 'адрес слишком короткий'; return $out; }

        $token = (string) (function_exists('cfgv') ? cfgv('dadata_token', '') : '');
        if ($token === '') {
            // Ключа нет — проверять нечем. Пропускаем: лучше принять заказ, чем
            // отказать всем из-за отсутствующей настройки.
            return ['ok' => true, 'value' => $addr, 'postal' => '', 'reason' => 'проверка недоступна'];
        }

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
        $raw  = (string) curl_exec($ch);
        $code = (int) curl_getinfo($ch, CURLINFO_HTTP_CODE);
        curl_close($ch);
        if ($code !== 200 || $raw === '') {
            // Сервис не ответил — заказ не заворачиваем: это наша беда, не человека.
            return ['ok' => true, 'value' => $addr, 'postal' => '', 'reason' => 'сервис недоступен'];
        }

        $j = json_decode($raw, true);
        $s = (array) (($j['suggestions'] ?? [])[0] ?? []);
        $d = (array) ($s['data'] ?? []);
        $value  = trim((string) ($s['value'] ?? ''));
        $postal = trim((string) ($d['postal_code'] ?? ''));
        $house  = trim((string) ($d['house'] ?? ''));

        if ($value === '') { $out['reason'] = 'такой адрес не найден'; return $out; }

        // Сервис мог понять запрос совсем по-своему — сверяем с написанным по ядру.
        if (!function_exists('og_norm_address') && is_file(BASE_PATH . '/core/order_group.php')) {
            require_once BASE_PATH . '/core/order_group.php';
        }
        if (function_exists('og_addr_same')
            && !og_addr_same(og_norm_address($value), og_norm_address($addr))) {
            $out['reason'] = 'такого адреса в справочнике нет';
            return $out;
        }

        /* ПРОВЕРЯЕМ СТРОГО ТО, БЕЗ ЧЕГО ПОСЫЛКА НЕ УЕДЕТ, И НИЧЕГО СВЕРХ.
         *
         * Первая версия требовала и разбор до дома, и почтовый индекс. На живых
         * адресах это оказалось капканом: «Россия, г Москва, ул Маршала
         * Тухачевского, д 21» — настоящий адрес из подсказки, по которому уже
         * уехал заказ, — отклонялся, потому что сервис не вернул индекс.
         * Заворачивать оплаченный заказ из-за пустого поля в чужом ответе нельзя.
         *
         * Осталось одно требование: сервис должен УЗНАТЬ дом. Индекс полезен, но
         * его отсутствие — не повод отказывать: Почта принимает и по адресу. */
        if ($house === '') {
            $out['reason'] = 'адрес распознан без номера дома';
            return $out;
        }

        /* И НОМЕР ДОМА ИЗ ОТВЕТА ОБЯЗАН НАЙТИСЬ В НАПИСАННОМ.
         *
         * На «Забайкальский край п.Горный ул.Дружбы дом180» сервис уверенно
         * ответил «ул Дружбы, д 1»: дома 180 он не знает и предложил ближайший.
         * Принять такое — отправить посылку не туда, и человек узнает об этом
         * последним. */
        if (!preg_match('~(^|\D)' . preg_quote($house, '~') . '(\D|$)~u', $addr)) {
            $out['reason'] = 'номер дома не совпал со справочником — выберите вариант из подсказок';
            return $out;
        }

        return ['ok' => true, 'value' => $value, 'postal' => $postal, 'reason' => ''];
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
