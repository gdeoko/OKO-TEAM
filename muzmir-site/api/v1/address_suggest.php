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

$token = (string) cfgv('dadata_token', '');
if ($token === '') {
    // Ключ не настроен — подсказок нет, но поле продолжает работать как обычное.
    json_out(['ok' => true, 'suggestions' => [], 'reason' => 'no_token']);
}

$payload = ['query' => $q, 'count' => 7];
// В режиме city ограничиваем поиск DaData уровнем «город» — иначе первыми в списке
// оказываются улицы того же города, и участник промахивается мимо своего города.
if ($mode === 'city') {
    $payload['from_bound'] = ['value' => 'city'];
    $payload['to_bound']   = ['value' => 'settlement'];
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
    // Молча отдаём пустой список: поле остаётся рабочим, ввод руками не блокируется.
    json_out(['ok' => true, 'suggestions' => [], 'reason' => $err !== '' ? 'net' : ('http_' . $code)]);
}

$data = json_decode((string) $raw, true);
$out  = [];
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

    $out[] = [
        // value — что подставится в поле (полный адрес), а короткий вариант DaData
        // остаётся в `short` для компактного показа в списке.
        'value'       => $full !== '' ? $full : (string) ($s['value'] ?? ''),
        'short'       => (string) ($s['value'] ?? ''),
        'postal_code' => (string) ($d['postal_code'] ?? ''),
        'region'      => $region,
        'city'        => (string) ($d['city'] ?? $d['settlement'] ?? ''),
        'street'      => $street,
        'house'       => $house,
    ];
}
json_out(['ok' => true, 'suggestions' => $out]);
