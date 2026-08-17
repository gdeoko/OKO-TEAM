<?php
/**
 * Подсказки адреса (DaData) — СЕРВЕРНЫЙ прокси.
 *
 * Зачем прокси: раньше подсказки работали только на странице /awards и дергали
 * DaData прямо из браузера с токеном в исходнике страницы. Это, во-первых,
 * светило ключ, во-вторых — на форме заказа /order-awards подсказок не было вовсе,
 * поэтому «выпадающий список срабатывал не всегда».
 *
 * Теперь: токен остаётся на сервере, а подсказки доступны на любой странице
 * через общий компонент public/assets/js/address.js.
 *
 * GET|POST /api/v1/address_suggest?q=<строка>
 * Ответ: {ok:true, suggestions:[{value, postal_code, city, street, house}]}
 */
declare(strict_types=1);
require __DIR__ . '/_boot.php';
// Свой справочник городов: без него подсказки знают только Россию.
if (!function_exists('city_geo')) require_once BASE_PATH . '/core/text_format.php';

$q = trim((string) input('q'));
// Режим city: пользователь ищет только город/населённый пункт (шаг «Город» в заявке).
// Для города достаточно 2 символов, для полного адреса — 3.
$mode = (string) input('mode');
$minLen = ($mode === 'city') ? 2 : 3;
if (mb_strlen($q) < $minLen) json_out(['ok' => true, 'suggestions' => []]);

// Защита от перебора чужим ключом: не больше 60 запросов в минуту с адреса.
if (function_exists('rate_ok') && !rate_ok('addr:' . client_ip(), 60, 60)) {
    json_out(['ok' => true, 'suggestions' => []]);
}

/* СВОИ ПОДСКАЗКИ ИДУТ ПЕРВЫМИ.
 *
 * DaData ищет по России, и на «Минск» она честно предлагает село Минское в
 * Костромской области и деревню Минск в Красноярском крае. Участник из Минска
 * выбирает первое попавшееся и оказывается россиянином. Поэтому сначала
 * отвечает наш собственный справочник городов (core/text_format.php): он знает
 * и ближнее зарубежье, и Дубай, и отдаёт сразу канонический вид
 * «Страна, г. Город» — ровно то, что должно лежать в заявке.
 */
$localOut = [];
if ($mode === 'city' && function_exists('city_geo')) {
    $needle = str_replace('ё', 'е', mb_strtolower($q, 'UTF-8'));
    foreach (city_geo() as $key => [$country, $stem, $display]) {
        if (mb_strpos($key, $needle) !== 0) continue;
        $value = $country . ', г. ' . $display;
        $localOut[$value] = [
            'value'       => $value,
            'short'       => $display . ' (' . $country . ')',
            'postal_code' => '',
            'region'      => '',
            'city'        => $display,
            'street'      => '',
            'house'       => '',
        ];
        if (count($localOut) >= 7) break;
    }
}

$token = (string) cfgv('dadata_token', '');
if ($token === '') {
    // Ключ не настроен — остаются наши подсказки, поле продолжает работать.
    json_out(['ok' => true, 'suggestions' => array_values($localOut), 'reason' => 'no_token']);
}

$payload = ['query' => $q, 'count' => 7];
// В режиме city ограничиваем поиск DaData уровнем «город» — иначе первыми в списке
// оказываются улицы того же города, и участник промахивается мимо своего города.
if ($mode === 'city') {
    $payload['from_bound'] = ['value' => 'city'];
    $payload['to_bound']   = ['value' => 'settlement'];
    // Ищем не только по России: конкурсы международные, участники пишут из
    // Минска, Алматы и Дубая. Если тариф зарубежные страны не отдаёт, ответ
    // просто не изменится — свои подсказки уже собраны выше.
    $payload['locations'] = [['country_iso_code' => '*']];
}

$ch = curl_init('https://suggestions.dadata.ru/suggestions/api/4_1/rs/suggest/address');
curl_setopt_array($ch, [
    CURLOPT_POST           => true,
    CURLOPT_POSTFIELDS     => json_encode($payload, JSON_UNESCAPED_UNICODE),
    CURLOPT_HTTPHEADER     => [
        'Content-Type: application/json',
        'Accept: application/json',
        'Authorization: Token ' . $token,
    ],
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_TIMEOUT        => 6,
    CURLOPT_CONNECTTIMEOUT => 4,
]);
$raw  = curl_exec($ch);
$err  = curl_error($ch);
$code = (int) curl_getinfo($ch, CURLINFO_HTTP_CODE);
curl_close($ch);

if ($raw === false || $code !== 200) {
    // Молча отдаём то, что знаем сами: поле остаётся рабочим, ввод не блокируется.
    json_out(['ok' => true, 'suggestions' => array_values($localOut),
              'reason' => $err !== '' ? 'net' : ('http_' . $code)]);
}

$data = json_decode((string) $raw, true);
$out  = $localOut;   // свои подсказки первыми, дальше DaData
foreach ((array) ($data['suggestions'] ?? []) as $s) {
    $d = (array) ($s['data'] ?? []);

    // ПОЛНЫЙ адрес для подстановки в поле: страна, регион (область/республика/край),
    // район, город/посёлок, улица, дом. DaData в своём `value` регион у крупных
    // городов опускает — для почтовой отправки это неудобно, отправителю нужен
    // адрес целиком. Собираем сами и не дублируем то, что уже есть в value.
    $parts = [];
    $country = trim((string) ($d['country'] ?? ''));
    $region  = trim((string) ($d['region_with_type'] ?? ''));
    $area    = trim((string) ($d['area_with_type'] ?? ''));
    $city    = trim((string) ($d['city_with_type'] ?? ''));
    $settl   = trim((string) ($d['settlement_with_type'] ?? ''));
    $street  = trim((string) ($d['street_with_type'] ?? ''));
    $house   = trim((string) ($d['house'] ?? ''));
    $houseT  = trim((string) ($d['house_type'] ?? 'д'));

    if ($country !== '') $parts[] = $country;
    // У городов федерального значения регион и город совпадают («г Москва») — не дублируем.
    if ($region !== '' && $region !== $city) $parts[] = $region;
    if ($area !== '')  $parts[] = $area;
    if ($city !== '')  $parts[] = $city;
    if ($settl !== '' && $settl !== $city) $parts[] = $settl;
    if ($street !== '') $parts[] = $street;
    if ($house !== '')  $parts[] = ($houseT !== '' ? $houseT . ' ' : '') . $house;
    $full = implode(', ', $parts);

    /* В режиме города в поле должно попасть «Страна, г. Город», а не почтовый
     * адрес с областью и районом: человек указывает город участника, а не куда
     * везти посылку. Разбор всё равно приведёт строку к этому виду, но человек
     * должен видеть в поле то же самое, что увидит потом в дипломе. */
    $valueFull = $full !== '' ? $full : (string) ($s['value'] ?? '');
    if ($mode === 'city') {
        $short = $city !== '' ? $city : $settl;
        /* Подсказка должна отвечать на введённое слово. На «моск» DaData находит
         * и «Московское шоссе» в Рязани — в списке городов это выглядит как
         * предложение поехать в Рязань. Оставляем только те, где название
         * населённого пункта действительно начинается с введённого. */
        $needleLow = str_replace('ё', 'е', mb_strtolower($q, 'UTF-8'));
        $shortLow  = str_replace('ё', 'е', mb_strtolower($short, 'UTF-8'));
        if ($short === '' || mb_strpos($shortLow, $needleLow) !== 0) continue;
        if ($short !== '' && function_exists('city_normalize')) {
            $canon = city_normalize(($country !== '' ? $country . ', ' : '') . $short);
            if ($canon !== '') $valueFull = $canon;
        }
    }
    if (isset($out[$valueFull])) continue;      // уже пришло из своего справочника

    $out[$valueFull] = [
        // value — что подставится в поле, а короткий вариант DaData остаётся
        // в `short` для компактного показа в списке.
        'value'       => $valueFull,
        'short'       => (string) ($s['value'] ?? ''),
        'postal_code' => (string) ($d['postal_code'] ?? ''),
        'region'      => $region,
        'city'        => (string) ($d['city'] ?? $d['settlement'] ?? ''),
        'street'      => $street,
        'house'       => $house,
    ];
}
json_out(['ok' => true, 'suggestions' => array_values($out)]);
