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
    // is_paid нужен ниже: в платном конкурсе электронные основной/доп. входят в оргвзнос.
    ? one("SELECT id,slug,name,is_paid FROM competitions WHERE slug=? OR code=? OR id=?",
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
    // period: 'year' → годовая (10000 ₽, 12 мес), иначе месячная (1000 ₽, 1 мес).
    if ($kind === 'club') {
        $period = trim((string) ($it['period'] ?? 'month'));
        if ($period === 'year') {
            $price = (int) setting('club_price_year', '10000');
        } else {
            $period = 'month';
            $price = (int) setting('club_price', '1000');
        }
        $serverAmount += $price;
        $normItems[] = ['item' => $itemName, 'kind' => 'club', 'period' => $period, 'price' => $price];
        continue;
    }

    // Персональный прайс конкурса имеет приоритет над общим (competition_id IS NULL).
    //
    // Ищем и по присланному имени, и по КАНОНИЧЕСКОМУ (award_canon_item). В прайсе одна
    // и та же награда заведена по-разному: у конкурсов 19 и 20 это «Кубок»/«Статуэтка»/
    // «Медаль», у остальных и в общем прайсе — «Кубок Гран-при»/«Статуэтка лауреата»/
    // «Медаль дипломанта». Форма заказа шлёт длинные имена, поэтому персональные цены
    // конкурсов 19 и 20 не находились никогда: заказ молча уходил на общий прайс, и
    // выставленная для конкурса цена игнорировалась.
    if (!function_exists('award_canon_item') && is_file(BASE_PATH . '/core/orders.php')) {
        require_once BASE_PATH . '/core/orders.php';
    }
    // Сравниваем по КАНОНУ с обеих сторон: и присланное имя, и имя строки прайса
    // приводим к одному виду. Сопоставлять просто по строке нельзя — канонизация
    // односторонняя (короткое → длинное), а в базе лежат оба варианта.
    $canon = function_exists('award_canon_item') ? award_canon_item($itemName) : $itemName;

    $pickPrice = static function (array $rows) use ($canon, $itemName): ?int {
        foreach ($rows as $r) {
            $it = (string) $r['item'];
            $rc = function_exists('award_canon_item') ? award_canon_item($it) : $it;
            if ($it === $itemName || $rc === $canon) return (int) $r['price'];
        }
        return null;
    };

    $price = null;
    if ($compId !== null) {
        $price = $pickPrice(all("SELECT item, price FROM awards_prices WHERE competition_id=? AND kind=?", [$compId, $kind]));
    }
    if ($price === null) {
        $price = $pickPrice(all("SELECT item, price FROM awards_prices WHERE competition_id IS NULL AND kind=?", [$kind]));
    }
    if ($price === null || $price === false) {
        $badItems[] = $itemName . ' / ' . $kind;
        continue;
    }
    $price = (int) $price;
    // В ПЛАТНОМ конкурсе электронные основной и дополнительный дипломы входят в стоимость
    // участия (оргвзнос) — при заказе они бесплатны. В бесплатном — по прайсу.
    if ($kind === 'digital'
        && in_array($itemName, ['Основной диплом', 'Дополнительный диплом'], true)
        && $comp && (int) ($comp['is_paid'] ?? 0) === 1) {
        $price = 0;
    }
    $serverAmount += $price;
    // ФИО получателя обязано дожить до состава заказа. core/orders.php читает его
    // как $it['fio'] ($person) и печатает на именном дипломе и благодарности, а ещё
    // строит по нему ключ дедупликации «тип + получатель». Раньше поле здесь молча
    // терялось, поэтому: документы уходили с пустым ФИО, а заказ пяти именных
    // дипломов схлопывался в ОДИН документ — у всех пяти ключ дедупа был одинаковый
    // (тип + пустая строка). Правило владельца: одна благодарность = один педагог =
    // одно ФИО, то есть заказали пять — должно получиться пять разных документов.
    $ni = ['item' => $itemName, 'kind' => $kind, 'price' => $price];
    $fio = trim((string) ($it['fio'] ?? ''));
    if ($fio !== '') $ni['fio'] = mb_substr($fio, 0, 200);
    $normItems[] = $ni;
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

// Признак «покупается само членство в клубе» — нужен и здесь (скидка на него не
// распространяется), и ниже в проверках состава заказа.
$isClubOrder = strpos(json_encode($normItems, JSON_UNESCAPED_UNICODE), '"kind":"club"') !== false;

// СКИДКА ВИП-КЛУБА НА НАГРАДЫ (её здесь не было вовсе — клубная скидка работала
// только при подаче заявки). Членство даёт 20% на весь наградной материал.
$clubPctOrder = 0;
if ($uid && !$isClubOrder) {
    if (is_file(BASE_PATH . '/core/club.php')) require_once BASE_PATH . '/core/club.php';
    if (function_exists('club_discount_percent')) $clubPctOrder = (int) club_discount_percent((int) $uid);
}
$amountBeforeDiscount = $amount;
if ($clubPctOrder > 0 && $amount > 0) {
    if (is_file(BASE_PATH . '/core/loyalty.php')) require_once BASE_PATH . '/core/loyalty.php';
    $amount = function_exists('loyalty_apply')
        ? loyalty_apply($amount, $clubPctOrder)
        : (int) round($amount * (100 - $clubPctOrder) / 100);
}

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
// $isClubOrder уже вычислен выше — вместе с расчётом клубной скидки.
$appRow = null;   // используется ниже и при клубном заказе остаётся null
if (!$isClubOrder) {
    if (!$applicationId) {
        json_out(['ok' => false, 'error' => 'Заказать награды можно только по оценённой заявке. Дождитесь результатов или подайте заявку на участие.'], 422);
    }
    try { db()->exec("ALTER TABLE competitions ADD COLUMN results_published_at TEXT"); } catch (\Throwable $e) {}
    $appRow = one("SELECT a.id, a.result, a.status, a.user_id, a.result_sent_at,
                          c.id AS comp_id, c.name AS comp_name, c.is_paid AS comp_is_paid,
                          c.results_mode, c.results_published_at, c.status AS comp_status, c.end_date
                   FROM applications a LEFT JOIN competitions c ON c.id=a.competition_id
                   WHERE a.id=?", [$applicationId]);
    // Привязка к покупателю: авторизованный пользователь может заказывать награды только
    // по СВОЕЙ заявке (не подставить чужой application_id). Гость (без сессии) — по номеру.
    if ($appRow && $uid && !empty($appRow['user_id']) && (int) $appRow['user_id'] !== (int) $uid) {
        json_out(['ok' => false, 'error' => 'Эта заявка принадлежит другому участнику — заказ по ней недоступен.'], 403);
    }
    if (!$appRow || trim((string) ($appRow['result'] ?? '')) === '') {
        json_out(['ok' => false, 'error' => 'По этой заявке ещё нет результата оценки — заказ наград недоступен. Дождитесь публикации результатов.'], 422);
    }
    // Короткий конкурс: заказ открывается только после того, как результат РЕАЛЬНО
    // отправлен участнику на почту — до этого он не должен знать своё звание.
    if ((string) ($appRow['results_mode'] ?? '') !== 'list'
        && trim((string) ($appRow['result_sent_at'] ?? '')) === '') {
        json_out(['ok' => false, 'error' => 'Результат по этой заявке ещё не направлен участнику. Заказ наград откроется после получения результата на почту.'], 422);
    }
    // Длинный конкурс: заказ наград доступен ТОЛЬКО после публикации результатов.
    if ((string) ($appRow['results_mode'] ?? '') === 'list'
        && trim((string) ($appRow['results_published_at'] ?? '')) === '') {
        json_out(['ok' => false, 'error' => 'Результаты этого конкурса ещё не опубликованы. Заказ наград откроется после публикации итогов.'], 422);
    }
    // Окно заказа: два месяца со дня закрытия приёма. Дальше награды по конкурсу
    // не изготавливаются, и принимать деньги за них нельзя (core/orders.php).
    if (!function_exists('awards_window_open')) require_once BASE_PATH . '/core/orders.php';
    $__win = ['status' => (string) ($appRow['comp_status'] ?? ''), 'end_date' => (string) ($appRow['end_date'] ?? '')];
    if (!awards_window_open($__win)) {
        $__end = awards_window_end($__win);
        json_out(['ok' => false, 'error' => 'Срок заказа наградного материала по этому конкурсу истёк'
            . ($__end !== '' ? ' ' . date('d.m.Y', strtotime($__end)) : '')
            . '. Награды изготавливаются в течение двух месяцев после закрытия приёма заявок.'], 422);
    }
}

// --- ПРАВИЛА СОСТАВА НАГРАД (сервер — источник истины) ---
// Трофей строго по аттестационному результату ЗАЯВКИ (не по тому, что прислал клиент);
// электронные основной/дополнительный в платном конкурсе не заказываются.
// Раньше проверка была только в JS: подменой запроса дипломант мог заказать кубок.
if (!$isClubOrder && $applicationId) {
    require_once BASE_PATH . '/core/orders.php';
    // Результат и платность берём из ЗАЯВКИ (её конкурс), а не из полей запроса —
    // иначе состав наград определялся бы тем, что подставил клиент.
    $appResult  = (string) ($appRow['result'] ?? '');
    $compIsPaid = (int) ($appRow['comp_is_paid'] ?? 0) === 1;
    foreach ($normItems as $ni) {
        [$allowed, $why] = award_item_allowed(
            (string) ($ni['item'] ?? ''), (string) ($ni['kind'] ?? 'original'), $appResult, $compIsPaid
        );
        if (!$allowed) {
            json_out(['ok' => false, 'error' => 'Позиция «' . (string) ($ni['item'] ?? '') . '»: ' . $why], 422);
        }
    }
}

// --- Серверная валидация получателя и адреса (зеркало клиентской проверки) ---
// ФИО — ПОЛНОСТЬЮ (Фамилия Имя Отчество). Адрес — полный (город/улица/ДОМ), только если
// в заказе есть ОРИГИНАЛ (kind=original), т.е. нужна почтовая доставка. Клубное членство —
// без этих требований (это не отправляемый материал).
$hasOriginal = false;
foreach ($normItems as $ni) { if ((string) ($ni['kind'] ?? '') === 'original') { $hasOriginal = true; break; } }
if (!$isClubOrder) {
    $fio = trim((string) input('full_name'));
    $fioParts = array_values(array_filter(preg_split('~\s+~u', $fio) ?: [], static fn($w) => mb_strlen($w) >= 2));
    if (count($fioParts) < 3) {
        json_out(['ok' => false, 'error' => 'Укажите ФИО получателя ПОЛНОСТЬЮ: Фамилия, Имя и Отчество.'], 422);
    }
}
if ($hasOriginal) {
    $addr = trim((string) input('address'));
    $hasHouse  = (bool) preg_match('~(^|[\s,.])(д(ом)?\.?\s*)?\d+~iu', $addr);
    $hasStreet = (bool) preg_match('~(ул|улиц|просп|пр-?кт|пер(еул)?|шоссе|бульв|наб|аллея|проезд|тракт|мкр|микрорайон|кварт|деревн|село|посёл|поселок|станиц)~iu', $addr);
    if ($addr === '' || !$hasHouse || !$hasStreet) {
        json_out(['ok' => false, 'error' => 'Адрес должен быть ПОЛНЫМ: город, улица и дом (номер квартиры — по желанию). Без дома отправить нельзя.'], 422);
    }
}

$orderId = insert('awards_orders', [
    'application_id' => $applicationId ?: null,
    'user_id'        => $uid,
    'full_name'      => input('full_name'),
    // Конкурс и результат фиксируются по заявке — клиентские значения не принимаем.
    'competition'    => (string) ($appRow['comp_name'] ?? $comp['name'] ?? input('competition')),
    'result'         => (string) ($appRow['result'] ?? input('result')),
    'items'          => json_encode($normItems, JSON_UNESCAPED_UNICODE),
    'amount'         => $amount,
    // Полная цена до клубной скидки и её размер — для чека, админки и писем.
    'amount_full'    => $amountBeforeDiscount,
    'discount_pct'   => $clubPctOrder,
    'email'          => mb_strtolower(input('email')),
    'phone'          => input('phone'),
    'address'        => input('address'),
    'status'         => 'new',
]);

// --- заглушка создания платежа ЮKassa (сумма — серверная) ---
$payment = yukassa_create_payment(
    $amount,
    $isClubOrder ? 'Членство в ВИП-клубе «Музыкальный Мир»' : ('Наградные материалы, заказ №' . $orderId),
    [
        'order_id' => $orderId,
        'email'    => mb_strtolower(input('email')),
        // Для подписки клуба просим сохранить способ оплаты — следующие периоды
        // спишутся автоматически (ежемесячно либо раз в год).
        'save_payment_method' => $isClubOrder,
    ]
);
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
                    '_actions'   => [['Открыть заказ в админке', rtrim((string) cfgv('base_url'), '/') . '/admin/?p=orders&id=' . $orderId]],
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
