<?php
/** POST заказа наградных материалов → awards_orders + заглушка платежа ЮKassa.
 *  Сумма ВСЕГДА пересчитывается на сервере по awards_prices (клиентский amount не платёжеспособен). */
declare(strict_types=1);
require __DIR__ . '/_boot.php';
require_post();

// --- Строгая проверка источника (Origin/Referer принадлежит своему домену) + CSRF-токен ---
if (!request_same_origin() || !csrf_check()) {
    json_out(['ok' => false, 'error' => 'Недопустимый источник запроса'], 403);
}

if (!rate_ok('order:' . client_ip(), 30, 3600)) {
    json_out(['ok' => false, 'error' => 'Слишком много запросов, попробуйте позже'], 429);
}

// Позиции заказа: массив или JSON-строка.
$items = $_POST['items'] ?? input('items');
if (is_string($items) && $items !== '') {
    $decoded = json_decode($items, true);
    if (is_array($decoded)) $items = $decoded;
}
if (!is_array($items)) $items = [];

// --- Конкурс: по slug/code/id (нужен competition_id для персонального прайса) ---
$compRef = input('competition');
$comp = $compRef !== ''
    ? one("SELECT id,slug,name FROM competitions WHERE slug=? OR code=? OR id=?",
          [$compRef, $compRef, ctype_digit($compRef) ? (int) $compRef : 0])
    : null;
$compId = $comp ? (int) $comp['id'] : null;

// --- Серверный пересчёт суммы по прайсу awards_prices (защита от оплаты за 1₽) ---
// Клиентский amount игнорируем при оплате: платим ТОЛЬКО по серверной сумме.
$clientAmount = (int) input('amount', '0');
$serverAmount = 0;
$normItems = [];
$badItems  = [];
foreach ($items as $it) {
    if (!is_array($it)) continue;
    $itemName = trim((string) ($it['item'] ?? ''));
    $kind     = trim((string) ($it['kind'] ?? 'original'));
    if ($itemName === '') continue;
    if ($kind === '') $kind = 'original';

    // Персональный прайс конкурса имеет приоритет над общим (competition_id IS NULL).
    $price = null;
    if ($compId !== null) {
        $price = scalar(
            "SELECT price FROM awards_prices WHERE competition_id=? AND item=? AND kind=? LIMIT 1",
            [$compId, $itemName, $kind]
        );
    }
    if ($price === null || $price === false) {
        $price = scalar(
            "SELECT price FROM awards_prices WHERE competition_id IS NULL AND item=? AND kind=? LIMIT 1",
            [$itemName, $kind]
        );
    }
    if ($price === null || $price === false) {
        $badItems[] = $itemName . ' / ' . $kind;
        continue;
    }
    $price = (int) $price;
    $serverAmount += $price;
    $normItems[] = ['item' => $itemName, 'kind' => $kind, 'price' => $price];
}

if (!$normItems) {
    json_out(['ok' => false, 'error' => 'Не удалось определить позиции заказа или их цены. Свяжитесь с Оргкомитетом.',
              'unknown_items' => $badItems], 422);
}

// Сверка с клиентским значением (только для лога/диагностики, платим по серверной сумме).
if ($clientAmount !== $serverAmount) {
    audit('order_amount_mismatch', 'awards_orders', null,
          ['client' => $clientAmount, 'server' => $serverAmount, 'items' => $normItems]);
}

$amount = $serverAmount;
$uid = current_user()['id'] ?? null;

$orderId = insert('awards_orders', [
    'application_id' => (int) input('application_id', '0') ?: null,
    'user_id'        => $uid,
    'full_name'      => input('full_name'),
    'competition'    => $comp['name'] ?? input('competition'),
    'result'         => input('result'),
    'items'          => json_encode($normItems, JSON_UNESCAPED_UNICODE),
    'amount'         => $amount,
    'email'          => mb_strtolower(input('email')),
    'phone'          => input('phone'),
    'address'        => input('address'),
    'status'         => 'new',
]);

// --- заглушка создания платежа ЮKassa (сумма — серверная) ---
$payment = yukassa_create_payment($amount, 'Наградные материалы, заказ №' . $orderId, ['order_id' => $orderId, 'email' => mb_strtolower(input('email'))]);
if ($payment && !empty($payment['id'])) {
    update('awards_orders', ['payment_id' => $payment['id']], 'id=:id', ['id' => $orderId]);
    if (tbl_exists('payments')) {
        insert('payments', [
            'order_id'   => $orderId,
            'amount'     => $amount,
            'method'     => 'yukassa',
            'status'     => $payment['status'] ?? 'pending',
            'yukassa_id' => $payment['id'],
            'purpose'    => 'awards',
        ]);
    }
}
audit('order', 'awards_orders', $orderId, ['amount' => $amount]);

// --- Данные заказа для уведомлений ---
$buyerName  = input('full_name');
$buyerEmail = mb_strtolower(input('email'));
$compName   = $comp['name'] ?? input('competition');
$itemsText  = implode(', ', array_map(
    static fn($it) => $it['item'] . ' (' . $it['kind'] . ') - ' . money((int) $it['price']),
    $normItems
));

// --- уведомление админу (по образцу apply.php) ---
if (function_exists('tg_notify_admin')) {
    tg_notify_admin(
        "Новый заказ наградных материалов №{$orderId}\n"
        . ($compName !== '' ? $compName . "\n" : '')
        . ($buyerName !== '' ? $buyerName . "\n" : '')
        . $itemsText . "\n"
        . 'Сумма: ' . money($amount)
    );
}

// --- письмо-подтверждение покупателю в очередь ---
if ($buyerEmail !== '' && filter_var($buyerEmail, FILTER_VALIDATE_EMAIL)) {
    $subject = 'Заказ наградного материала принят';
    $html = '<p>Здравствуйте' . ($buyerName !== '' ? ', ' . h($buyerName) : '') . '!</p>'
          . '<p>Ваш заказ наградного материала <b>№' . h((string) $orderId) . '</b> принят.</p>'
          . '<p><b>Состав заказа:</b> ' . h($itemsText) . '</p>'
          . '<p><b>Сумма к оплате:</b> ' . h(money($amount)) . '</p>'
          . '<p>После оплаты мы изготовим и отправим материалы, а трек-номер для отслеживания '
          . 'пришлём на этот адрес.</p>';
    if (function_exists('mail_queue')) {
        mail_queue($buyerEmail, $buyerName, $subject, $html);
    } elseif (tbl_exists('mail_queue')) {
        insert('mail_queue', ['to_email' => $buyerEmail, 'to_name' => $buyerName, 'subject' => $subject, 'body' => $html]);
    }
}

json_out([
    'ok'       => true,
    'order_id' => $orderId,
    'amount'   => $amount,
    'payment'  => $payment ? [
        'id'               => $payment['id'],
        'status'           => $payment['status'] ?? 'pending',
        'confirmation_url' => $payment['confirmation_url'] ?? null,
    ] : null,
]);

/** Проверка принадлежности Origin/Referer своему домену (строгая). */
function request_same_origin(): bool {
    static $fn;
    // Собираем список разрешённых хостов из конфигурации.
    $hosts = [];
    if ($bu = cfgv('base_url')) { $h = parse_url((string) $bu, PHP_URL_HOST); if ($h) $hosts[] = strtolower($h); }
    foreach (['domain', 'domain_puny'] as $k) {
        if ($d = cfgv($k)) $hosts[] = strtolower((string) $d);
    }
    $hosts = array_values(array_unique(array_filter($hosts)));
    // Если домены не сконфигурированы — не блокируем (не ломаем локальную разработку).
    if (!$hosts) return true;
    $src = $_SERVER['HTTP_ORIGIN'] ?? ($_SERVER['HTTP_REFERER'] ?? '');
    if ($src === '') return false; // POST от браузера всегда несёт Origin или Referer
    $srcHost = strtolower((string) parse_url($src, PHP_URL_HOST));
    return $srcHost !== '' && in_array($srcHost, $hosts, true);
}
