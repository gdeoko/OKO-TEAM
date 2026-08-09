<?php
/** Приём callback-уведомлений ЮKassa (push). Логика применения статуса — в core/payments.php
 *  (та же, что у крон-реконсилера cron/reconcile_payments.php, который опрашивает статус pull'ом). */
declare(strict_types=1);
require __DIR__ . '/_boot.php';

$raw = file_get_contents('php://input') ?: '';
$data = json_decode($raw, true);
audit('yukassa_webhook', '', null, ['raw' => mb_substr($raw, 0, 500)]);

if (!is_array($data)) json_out(['ok' => false], 400);

$event = (string) ($data['event'] ?? '');
$obj = $data['object'] ?? [];
$paymentId = (string) ($obj['id'] ?? '');
$status = (string) ($obj['status'] ?? '');

// Проверка подписи (если секрет задан в настройках); иначе — whitelist IP ЮKassa.
$secret = cfgv('yukassa_webhook_secret');
if ($secret) {
    $sig = $_SERVER['HTTP_X_YOOKASSA_SIGNATURE'] ?? '';
    $calc = base64_encode(hash_hmac('sha256', $raw, $secret, true));
    if (!hash_equals($calc, $sig)) json_out(['ok' => false, 'error' => 'bad signature'], 403);
} else {
    // Секрет не задан → допускаем callback только с известных IP-адресов ЮKassa.
    //
    // БЕРЁМ REMOTE_ADDR, А НЕ client_ip(). client_ip() первым читает заголовки
    // X-Forwarded-For / CF-Connecting-IP, а их подставляет кто угодно: одним curl
    // с чужим заголовком можно было выдать себя за ЮKassa и пометить оплаченными
    // любые заявки (payment_apply_status идёт по metadata.application_ids).
    // nginx проксирует в php-fpm напрямую, поэтому REMOTE_ADDR здесь — настоящий
    // адрес отправителя, и подделать его нельзя.
    $srcIp = (string) ($_SERVER['REMOTE_ADDR'] ?? '');
    if (!yukassa_ip_allowed($srcIp)) {
        audit('yukassa_webhook_badip', '', null, ['ip' => $srcIp, 'xff' => (string) ($_SERVER['HTTP_X_FORWARDED_FOR'] ?? '')]);
        json_out(['ok' => false, 'error' => 'forbidden'], 403);
    }
}

/** Принадлежит ли IP официальным диапазонам уведомлений ЮKassa. */
function yukassa_ip_allowed(string $ip): bool {
    if ($ip === '') return false;
    // Возможен список X-Forwarded-For: берём первый (клиентский) адрес.
    if (str_contains($ip, ',')) $ip = trim(explode(',', $ip)[0]);
    $ranges = [
        '185.71.76.0/27', '185.71.77.0/27',
        '77.75.153.0/25', '77.75.154.128/25',
        '77.75.156.11/32', '77.75.156.35/32',
        '2a02:5180::/32',
    ];
    foreach ($ranges as $cidr) {
        if (cidr_match($ip, $cidr)) return true;
    }
    return false;
}

/** Проверка попадания IPv4/IPv6 в CIDR-диапазон (по бинарному префиксу). */
function cidr_match(string $ip, string $cidr): bool {
    [$subnet, $bitsStr] = array_pad(explode('/', $cidr, 2), 2, null);
    $ipBin = @inet_pton($ip);
    $subBin = @inet_pton($subnet);
    if ($ipBin === false || $subBin === false || strlen($ipBin) !== strlen($subBin)) return false;
    $bits = $bitsStr === null ? strlen($ipBin) * 8 : (int) $bitsStr;
    $bytes = intdiv($bits, 8);
    $rem = $bits % 8;
    if ($bytes > 0 && strncmp($ipBin, $subBin, $bytes) !== 0) return false;
    if ($rem === 0) return true;
    $mask = chr(0xFF << (8 - $rem) & 0xFF);
    return (ord($ipBin[$bytes]) & ord($mask)) === (ord($subBin[$bytes]) & ord($mask));
}

// refund.succeeded → статус платежа не меняем на succeeded, помечаем возврат.
if ($event === 'refund.succeeded') {
    $rid = (string) ($obj['payment_id'] ?? '');
    if ($rid !== '' && tbl_exists('payments')) {
        update('payments', ['status' => 'refunded'], 'yukassa_id=:pid', ['pid' => $rid]);
    }
    json_out(['ok' => true]);
}

if ($paymentId !== '' && function_exists('payment_apply_status')) {
    payment_apply_status($paymentId, $status ?: ($event === 'payment.succeeded' ? 'succeeded' : ''), $obj);
}

json_out(['ok' => true]);
