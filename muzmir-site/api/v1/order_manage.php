<?php
/**
 * Управление СВОИМИ заказами наград из кабинета:
 *   action=pay    — создать (пере)платёж для неоплаченного заказа → confirmation_url;
 *   action=delete — удалить неоплаченный заказ (только свой, только status='new').
 * Оплаченные/изготовленные заказы трогать нельзя.
 */
declare(strict_types=1);
require __DIR__ . '/_boot.php';
require_post();

if (!request_same_origin_oa() || !csrf_check()) {
    json_out(['ok' => false, 'error' => 'Недопустимый источник запроса'], 403);
}

$u = current_user();
if (!$u) json_out(['ok' => false, 'error' => 'Требуется вход в кабинет'], 401);
$uid = (int) $u['id'];

$action = input('action');
$orderId = (int) input('order_id');
if ($orderId <= 0) json_out(['ok' => false, 'error' => 'Заказ не указан'], 400);

$o = one("SELECT * FROM awards_orders WHERE id=? AND user_id=?", [$orderId, $uid]);
if (!$o) json_out(['ok' => false, 'error' => 'Заказ не найден'], 404);

/* АДРЕС ДОСТАВКИ МОЖНО ДОПОЛНИТЬ ПОСЛЕ ОПЛАТЫ.
 *
 * Всё остальное в оплаченном заказе трогать нельзя, но адрес — исключение, и
 * ровно он чаще всего оказывается незаполненным: заказ оплачен, изготовить
 * можно, а отправить некуда. Раньше человеку оставалось писать в поддержку и
 * ждать, пока адрес внесут руками; теперь он вносит его сам, и адрес сразу
 * попадает во все заказы этой посылки.
 */
if ($action === 'set_address') {
    if (!in_array((string) $o['status'], ['new', 'paid', 'made'], true)) {
        json_out(['ok' => false, 'error' => 'Заказ уже отправлен — адрес изменить нельзя, напишите нам.'], 409);
    }
    $addr  = trim((string) input('address'));
    $fio   = trim((string) input('full_name')) ?: (string) $o['full_name'];
    $phone = trim((string) input('phone'))     ?: (string) $o['phone'];
    $index = trim((string) input('postal_index'));

    // Требования те же, что на оформлении: без дома Почта России не примет.
    $hasHouse  = (bool) preg_match('~(^|[\s,.])(д(ом)?\.?\s*)?\d+~iu', $addr);
    $hasStreet = (bool) preg_match('~(ул|улиц|просп|пр-?кт|пер(еул)?|шоссе|бульв|наб|аллея|проезд|тракт|мкр|микрорайон|кварт|деревн|село|посёл|поселок|станиц)~iu', $addr);
    if ($addr === '' || !$hasHouse || !$hasStreet) {
        json_out(['ok' => false, 'error' => 'Укажите полный адрес: город, улицу и номер дома.'], 422);
    }
    $fioParts = array_values(array_filter(preg_split('~\s+~u', $fio) ?: [], static fn($w) => mb_strlen($w) >= 2));
    if (count($fioParts) < 3) {
        json_out(['ok' => false, 'error' => 'Укажите ФИО получателя полностью: фамилию, имя и отчество.'], 422);
    }

    $upd = ['address' => mb_substr($addr, 0, 500), 'full_name' => mb_substr($fio, 0, 200),
            'phone' => mb_substr($phone, 0, 40)];
    if ($index !== '') $upd['postal_index'] = mb_substr($index, 0, 20);
    update('awards_orders', $upd, 'id=:id', ['id' => $orderId]);

    // Тот же адрес проставляем другим заказам этого человека, которые ещё ждут
    // адреса: посылка одна, и спрашивать одно и то же трижды незачем.
    $also = 0;
    foreach (all("SELECT id, items FROM awards_orders
                   WHERE user_id=? AND id<>? AND status IN ('paid','made') AND TRIM(COALESCE(address,''))=''",
                 [$uid, $orderId]) as $other) {
        if (strpos((string) $other['items'], '"kind":"original"') === false) continue;
        update('awards_orders', $upd, 'id=:id', ['id' => (int) $other['id']]);
        $also++;
    }
    audit('order_set_address', 'awards_orders', $orderId, ['user' => $uid, 'also' => $also]);
    json_out(['ok' => true, 'address' => $upd['address'], 'also' => $also]);
}

// Оплачивать/удалять можно ТОЛЬКО неоплаченный заказ.
if ((string) $o['status'] !== 'new') {
    json_out(['ok' => false, 'error' => 'Этот заказ уже в работе — изменить нельзя.'], 409);
}

if ($action === 'delete') {
    q("DELETE FROM awards_orders WHERE id=? AND user_id=? AND status='new'", [$orderId, $uid]);
    /* Строку платежа не удаляем, а закрываем: удалённая строка уносит из учёта
     * след денег, и оплату, пришедшую перед самой отменой, потом не найти. */
    if (tbl_exists('payments')) {
        q("UPDATE payments SET status='canceled' WHERE order_id=? AND status IN ('pending','')", [$orderId]);
    }
    audit('order_delete_self', 'awards_orders', $orderId, ['user' => $uid]);
    json_out(['ok' => true, 'deleted' => true]);
}

if ($action === 'pay') {
    $amount = (int) $o['amount'];
    if ($amount <= 0) json_out(['ok' => false, 'error' => 'Сумма заказа нулевая — оплата не требуется.'], 400);
    $payment = yukassa_create_payment($amount, 'Наградные материалы, заказ №' . $orderId, [
        'order_id' => $orderId, 'email' => mb_strtolower((string) $o['email']),
    ]);
    if (!$payment || empty($payment['id'])) {
        json_out(['ok' => false, 'error' => 'Не удалось создать платёж. Попробуйте позже.'], 502);
    }
    // Гасим прежние НЕзавершённые счета этого заказа, чтобы повторный клик «Оплатить»
    // не плодил живые ссылки на оплату. Спрашиваем кассу по каждому: уже оплаченный
    // счёт не гасится, а проводится — см. payments_close_open().
    payments_close_open('order', $orderId);
    update('awards_orders', ['payment_id' => $payment['id']], 'id=:id', ['id' => $orderId]);
    if (tbl_exists('payments')) {
        insert('payments', [
            'order_id' => $orderId, 'amount' => $amount, 'method' => 'yukassa',
            'status' => $payment['status'] ?? 'pending', 'yukassa_id' => $payment['id'], 'purpose' => 'awards',
        ]);
    }
    audit('order_pay_self', 'awards_orders', $orderId, ['user' => $uid, 'amount' => $amount]);
    json_out([
        'ok' => true,
        'confirmation_url' => $payment['confirmation_url'] ?? null,
        'payment' => ['id' => $payment['id'], 'status' => $payment['status'] ?? 'pending', 'confirmation_url' => $payment['confirmation_url'] ?? null],
    ]);
}

json_out(['ok' => false, 'error' => 'Неизвестное действие'], 400);

/** Проверка Origin/Referer своего домена. */
function request_same_origin_oa(): bool {
    $hosts = [];
    if ($bu = cfgv('base_url')) { $h = parse_url((string) $bu, PHP_URL_HOST); if ($h) $hosts[] = strtolower($h); }
    foreach (['domain', 'domain_puny'] as $k) { if ($d = cfgv($k)) $hosts[] = strtolower((string) $d); }
    $hosts = array_values(array_unique(array_filter($hosts)));
    if (!$hosts) return true;
    $src = $_SERVER['HTTP_ORIGIN'] ?? ($_SERVER['HTTP_REFERER'] ?? '');
    if ($src === '') return false;
    $srcHost = strtolower((string) parse_url($src, PHP_URL_HOST));
    return $srcHost !== '' && in_array($srcHost, $hosts, true);
}
