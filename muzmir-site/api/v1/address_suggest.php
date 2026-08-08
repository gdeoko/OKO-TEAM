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
if (mb_strlen($q) < 3) json_out(['ok' => true, 'suggestions' => []]);

// Защита от перебора чужим ключом: не больше 60 запросов в минуту с адреса.
if (function_exists('rate_ok') && !rate_ok('addr:' . client_ip(), 60, 60)) {
    json_out(['ok' => true, 'suggestions' => []]);
}

$token = (string) cfgv('dadata_token', '');
if ($token === '') {
    // Ключ не настроен — подсказок нет, но поле продолжает работать как обычное.
    json_out(['ok' => true, 'suggestions' => [], 'reason' => 'no_token']);
}

$ch = curl_init('https://suggestions.dadata.ru/suggestions/api/4_1/rs/suggest/address');
curl_setopt_array($ch, [
    CURLOPT_POST           => true,
    CURLOPT_POSTFIELDS     => json_encode(['query' => $q, 'count' => 7], JSON_UNESCAPED_UNICODE),
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
    $out[] = [
        'value'       => (string) ($s['value'] ?? ''),
        'postal_code' => (string) ($d['postal_code'] ?? ''),
        'city'        => (string) ($d['city'] ?? $d['settlement'] ?? ''),
        'street'      => (string) ($d['street_with_type'] ?? ''),
        'house'       => (string) ($d['house'] ?? ''),
    ];
}
json_out(['ok' => true, 'suggestions' => $out]);
