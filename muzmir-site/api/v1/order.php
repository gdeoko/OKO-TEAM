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

    // Клубное членство — цена из настроек (не из awards_prices), активируется при оплате.
    if ($kind === 'club') {
        $price = (int) setting('club_price', '500');
        $serverAmount += $price;
        $normItems[] = ['item' => $itemName, 'kind' => 'club', 'price' => $price];
        continue;
    }

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

// application_id: напрямую, либо резолвим по номеру заявки (для гостей).
$applicationId = (int) input('application_id', '0');
if (!$applicationId) {
    $appNum = trim((string) input('application_number'));
    if ($appNum !== '') {
        $ar = one("SELECT id FROM applications WHERE number=? LIMIT 1", [$appNum]);
        if ($ar) $applicationId = (int) $ar['id'];
    }
}

// ПРАВИЛО (Даниэль): наградной материал заказывается ТОЛЬКО по оценённой заявке
// (есть результат/звание). Клубное членство — исключение (это не награда за конкурс).
$isClubOrder = strpos(json_encode($normItems, JSON_UNESCAPED_UNICODE), '"kind":"club"') !== false;
if (!$isClubOrder) {
    if (!$applicationId) {
        json_out(['ok' => false, 'error' => 'Заказать награды можно только по оценённой заявке. Дождитесь результатов или подайте заявку на участие.'], 422);
    }
    try { db()->exec("ALTER TABLE competitions ADD COLUMN results_published_at TEXT"); } catch (\Throwable $e) {}
    $appRow = one("SELECT a.id, a.result, a.status, c.results_mode, c.results_published_at
                   FROM applications a LEFT JOIN competitions c ON c.id=a.competition_id
                   WHERE a.id=?", [$applicationId]);
    if (!$appRow || trim((string) ($appRow['result'] ?? '')) === '') {
        json_out(['ok' => false, 'error' => 'По этой заявке ещё нет результата оценки — заказ наград недоступен. Дождитесь публикации результатов.'], 422);
    }
    // Длинный конкурс: заказ наград доступен ТОЛЬКО после публикации результатов.
    if ((string) ($appRow['results_mode'] ?? '') === 'list'
        && trim((string) ($appRow['results_published_at'] ?? '')) === '') {
        json_out(['ok' => false, 'error' => 'Результаты этого конкурса ещё не опубликованы. Заказ наград откроется после публикации итогов.'], 422);
    }
}

$orderId = insert('awards_orders', [
    'application_id' => $applicationId ?: null,
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
    static fn($it) => $it['item'] . (!empty($it['fio']) ? ' — ' . $it['fio'] : '') . ' (' . $it['kind'] . ') - ' . money((int) $it['price']),
    $normItems
));

// --- ГЕЙТ ПО ОПЛАТЕ (Даниэль): до оплаты заказ «не существует» ---
// Пока заказ НЕ оплачен: НЕ шлём письмо-подтверждение покупателю, НЕ уведомляем
// админа/владельца в Telegram, заказ НЕ показывается в админ-разделе «Заказы»
// (там фильтр по статусу оплаты). Покупатель видит заказ в кабинете и может его
// оплатить или удалить; дожим «оплатите» шлёт cron. Все уведомления и письмо-
// подтверждение уходят из core/payments.php в момент подтверждения оплаты.
// Единственное исключение — БЕСПЛАТНЫЙ заказ (amount<=0): принимаем сразу.
$orderIsFree = ($amount <= 0);

if ($orderIsFree) {
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

    // --- уведомление владельца в 3 канала + серверная аналитика ---
    if (is_file(BASE_PATH . '/core/notify_owner.php')) {
        require_once BASE_PATH . '/core/notify_owner.php';
        try {
            $isClub = strpos(json_encode($normItems, JSON_UNESCAPED_UNICODE), '"kind":"club"') !== false;
            owner_notify(
                $isClub ? 'ВИП-КЛУБ' : 'ЗАКАЗЫ НАГРАД',
                $isClub ? 'Заявка на вступление в клуб (заказ №' . $orderId . ')' : 'Новый заказ наград №' . $orderId,
                '',
                [
                    'Покупатель' => $buyerName,
                    'Email'      => $buyerEmail,
                    'Конкурс'    => $compName,
                    'Состав'     => $itemsText,
                    'Сумма'      => money($amount),
                    '_event'     => $isClub ? 'club_order' : 'order',
                    '_path'      => '/order-awards',
                    '_meta'      => ['order_id' => $orderId, 'amount' => $amount],
                ]
            );
        } catch (\Throwable $e) { /* тихо */ }
    }

    // --- письмо-подтверждение покупателю в очередь ---
    if ($buyerEmail !== '' && filter_var($buyerEmail, FILTER_VALIDATE_EMAIL)) {
        $subject = 'Заказ наградного материала принят';
        $orderCard = '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 8px;background:#F4F6FC;border:1px solid #DCE3F3;border-radius:14px;">'
            . '<tr><td style="padding:20px 24px;font-size:14px;line-height:1.9;color:#33406B;">'
            . '<div style="font-weight:600;color:#17307A;font-size:13px;letter-spacing:.08em;text-transform:uppercase;margin-bottom:10px;">Детали заказа</div>'
            . '<div><span style="color:#6B7699;">Номер заказа:</span> <b style="color:#17307A;">№' . h((string) $orderId) . '</b></div>'
            . '<div><span style="color:#6B7699;">Состав:</span> ' . h($itemsText) . '</div>'
            . '<div><span style="color:#6B7699;">Сумма:</span> <b style="color:#17307A;">' . h(money($amount)) . '</b></div>'
            . '</td></tr></table>';
        $html = function_exists('mail_template')
            ? mail_template('generic', [
                'title'     => 'Заказ наград принят',
                'name'      => $buyerName,
                'message'   => '<p style="margin:0 0 16px;">Ваш заказ наградного материала принят.</p>' . $orderCard
                    . '<p style="margin:16px 0 0;">Мы изготовим и отправим материалы, а трек-номер для отслеживания пришлём на этот адрес.</p>',
                'cta_url'   => rtrim((string) cfgv('base_url'), '/') . '/cabinet',
                'cta_text'  => 'Личный кабинет',
                'preheader' => 'Заказ №' . $orderId . ' принят.',
              ])
            : '<p>Здравствуйте' . ($buyerName !== '' ? ', ' . h($buyerName) : '') . '!</p>'
              . '<p>Ваш заказ наградного материала <b>№' . h((string) $orderId) . '</b> принят.</p>'
              . '<p><b>Состав заказа:</b> ' . h($itemsText) . '</p>';
        if (function_exists('mail_queue')) {
            mail_queue($buyerEmail, $buyerName, $subject, $html);
        } elseif (tbl_exists('mail_queue')) {
            insert('mail_queue', ['to_email' => $buyerEmail, 'to_name' => $buyerName, 'subject' => $subject, 'body' => $html]);
        }
    }
}

// Заказ наград тоже открывает личный кабинет (идемпотентно, дублей нет).
if (function_exists('auth_ensure_account') && $buyerEmail !== '') {
    try { auth_ensure_account($buyerEmail, (string) $buyerName); } catch (\Throwable $e) {}
}

json_out([
    'ok'       => true,
    'order_id' => $orderId,
    'amount'   => $amount,
    'confirmation_url' => $payment['confirmation_url'] ?? null,
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
