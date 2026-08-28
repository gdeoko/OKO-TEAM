<?php
/**
 * Оплата СВОЕЙ неоплаченной заявки на платный конкурс из личного кабинета.
 *   action=pay    — создать (пере)платёж ЮKassa для неоплаченной платной заявки → confirmation_url;
 *   action=delete — удалить свою неоплаченную заявку (до оплаты её как бы «не существует»).
 * Логика применения оплаты — та же payment_apply_status() (metadata.application_ids).
 */
declare(strict_types=1);
require __DIR__ . '/_boot.php';
require_post();

if (!request_same_origin_ap() || !csrf_check()) {
    json_out(['ok' => false, 'error' => 'Недопустимый источник запроса'], 403);
}

$u = current_user();
if (!$u) json_out(['ok' => false, 'error' => 'Требуется вход в кабинет'], 401);
$uid = (int) $u['id'];

$action = input('action');
$appId  = (int) input('application_id');
if ($appId <= 0) json_out(['ok' => false, 'error' => 'Заявка не указана'], 400);

$a = one("SELECT a.*, c.name comp_name, c.is_paid comp_paid, c.price comp_price
          FROM applications a LEFT JOIN competitions c ON c.id=a.competition_id
          WHERE a.id=? AND a.user_id=?", [$appId, $uid]);
if (!$a) json_out(['ok' => false, 'error' => 'Заявка не найдена'], 404);

if ((int) $a['is_paid'] === 1) {
    json_out(['ok' => false, 'error' => 'Эта заявка уже оплачена.'], 409);
}

// ОТКЛОНЁННУЮ ЗАЯВКУ ОПЛАТИТЬ НЕЛЬЗЯ. После возврата денег заявка снова выглядит
// неоплаченной (is_paid=0), и раньше кнопка «Оплатить» на ней исправно работала:
// человек, которому центр отказал и вернул деньги, платил второй раз.
if ((string) ($a['status'] ?? '') === 'rejected') {
    json_out(['ok' => false, 'error' => 'Заявка отклонена — оплата по ней не требуется. '
        . 'Если оргвзнос был внесён, он возвращён на карту.'], 409);
}

if ($action === 'delete') {
    require_once BASE_PATH . '/core/payments.php';

    // ЧЕК ПАКЕТА НЕ УДАЛЯЕТСЯ ВСЛЕПУЮ.
    // При пакетной подаче на весь чек создаётся ОДНА строка payments, привязанная
    // к первой заявке пакета. Раньше здесь стоял «DELETE FROM payments WHERE
    // application_id=?» — и удаление одной своей заявки сносило платёжную строку
    // всего пакета: остальные заявки оставались неоплаченными и без счёта, а сам
    // счёт в кассе продолжал жить, так что деньги по нему приходили уже ни за что.
    //
    // Правильное поведение: состав пакета изменился — прежний счёт недействителен.
    // Гасим его в ЮKassa (не только у себя), а соседей по пакету отвязываем, чтобы
    // каждый из них платился отдельной кнопкой в кабинете.
    $batch = trim((string) ($a['batch_id'] ?? ''));
    $siblings = [];
    if ($batch !== '') {
        try {
            $siblings = all("SELECT id FROM applications WHERE batch_id=? AND id<>? AND is_paid=0", [$batch, $appId]);
        } catch (\Throwable $e) { $siblings = []; }
    }

    // Гасим живые счета этой заявки в кассе (для пакета счёт висит на первой заявке).
    $holder = $appId;
    if ($batch !== '' && tbl_exists('payments')) {
        $row = one("SELECT application_id FROM payments WHERE yukassa_id=? LIMIT 1", [$batch]);
        if ($row) $holder = (int) $row['application_id'];
    }
    try { yukassa_cancel_open_for_app($holder); } catch (\Throwable $e) {}

    q("DELETE FROM applications WHERE id=? AND user_id=? AND is_paid=0", [$appId, $uid]);

    if ($siblings) {
        $in = implode(',', array_map(fn($s) => (int) $s['id'], $siblings));
        try { q("UPDATE applications SET batch_id='' WHERE id IN ($in)"); } catch (\Throwable $e) {}
    }
    /* Строку платежа не стираем — она нужна реконсилеру и истории. Гасим счёт,
     * и только тот, что относится к удаляемой одиночной заявке. Через кассу:
     * если человек нажал «удалить» ровно тогда, когда оплата прошла, пометить
     * такой счёт отменённым — значит потерять пришедшие деньги. */
    payments_close_open('application', $holder);

    audit('application_delete_self', 'applications', $appId, [
        'user' => $uid, 'batch' => $batch, 'siblings_unlinked' => count($siblings),
    ]);
    json_out(['ok' => true, 'deleted' => true]);
}

if ($action === 'pay') {
    if ((int) $a['comp_paid'] !== 1) {
        json_out(['ok' => false, 'error' => 'Участие в этом конкурсе бесплатное — оплата не требуется.'], 400);
    }
    // Сумма — только через общий расчёт: со скидкой клуба, достижений и реферального
    // кредита, и с уважением к уже зафиксированной сумме заявки. Раньше здесь стояла
    // голая цена конкурса, и участник клуба видел в кабинете 400 ₽, а кассу получал
    // на 500 ₽.
    require_once BASE_PATH . '/core/loyalty.php';
    $due    = application_amount_due($a);
    $amount = (int) $due['amount'];
    if ($amount <= 0) json_out(['ok' => false, 'error' => 'Сумма участия нулевая — оплата не требуется.'], 400);

    // Прежний счёт гасим В КАССЕ до создания нового. Точек оплаты у одной заявки
    // две — кнопка в кабинете и ссылка из письма-напоминания, — и обе раньше просто
    // создавали новый платёж. Старая confirmation_url при этом оставалась рабочей,
    // так что заявку можно было оплатить дважды.
    require_once BASE_PATH . '/core/payments.php';
    try { yukassa_cancel_open_for_app($appId); } catch (\Throwable $e) {}

    $payment = yukassa_create_payment($amount, 'Оргвзнос за участие: ' . (string) $a['comp_name'], [
        'application_ids' => (string) $appId,
        'application_id'  => $appId,
        'number'          => (string) $a['number'],
        'numbers'         => (string) $a['number'],
        'email'           => mb_strtolower((string) $a['email']),
    ]);
    if (!$payment || empty($payment['id'])) {
        json_out(['ok' => false, 'error' => 'Не удалось создать платёж. Попробуйте позже.'], 502);
    }
    // Гасим прежние висящие счета этой заявки (повторный клик не плодит живые ссылки).
    // Через payments_close_open: уже оплаченный счёт не гасится, а проводится.
    payments_close_open('application', $appId);
    if (tbl_exists('payments')) {
        insert('payments', [
            'application_id' => $appId, 'amount' => $amount, 'method' => 'yukassa',
            'status' => $payment['status'] ?? 'pending', 'yukassa_id' => $payment['id'], 'purpose' => 'application',
        ]);
    }
    audit('application_pay_self', 'applications', $appId, ['user' => $uid, 'amount' => $amount]);
    json_out([
        'ok' => true,
        'confirmation_url' => $payment['confirmation_url'] ?? null,
        'payment' => ['id' => $payment['id'], 'status' => $payment['status'] ?? 'pending', 'confirmation_url' => $payment['confirmation_url'] ?? null],
    ]);
}

json_out(['ok' => false, 'error' => 'Неизвестное действие'], 400);

/** Проверка Origin/Referer своего домена. */
function request_same_origin_ap(): bool {
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
