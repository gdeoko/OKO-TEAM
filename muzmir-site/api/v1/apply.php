<?php
/** POST заявки на конкурс: серверная валидация, номер CODE-ГГГГ-NNNNN, письмо в очередь, уведомление админу. */
declare(strict_types=1);
require __DIR__ . '/_boot.php';
require_once BASE_PATH . '/core/loyalty.php';
require_post();

// --- Строгая проверка источника (Origin/Referer принадлежит своему домену) + CSRF-токен ---
if (!apply_same_origin() || !csrf_check()) {
    json_out(['ok' => false, 'error' => 'Недопустимый источник запроса'], 403);
}

// --- Honeypot: скрытое поле website должно быть пустым; бот его заполняет ---
// Тихо возвращаем успех-заглушку, ничего не записывая в БД.
if (input('website') !== '') {
    json_out(['ok' => true, 'number' => 'MM-' . date('Y') . '-00000']);
}

$ip = client_ip();
if (!rate_ok('apply:' . $ip, 10, 3600)) {
    json_out(['ok' => false, 'error' => 'Слишком много заявок с одного адреса, попробуйте позже'], 429);
}

// --- конкурсы: массив competition_ids[] ИЛИ одиночный competition_id (backward-compat) ---
$compIds = $_POST['competition_ids'] ?? [];
if (!is_array($compIds)) $compIds = [$compIds];
$compIds = array_values(array_unique(array_filter(array_map('intval', $compIds))));
if (!$compIds) {
    $singleRef = input('competition_id');
    if ($singleRef === '') $singleRef = input('competition');
    if ($singleRef === '') $singleRef = input('slug');
    if ($singleRef !== '') {
        $c1 = one("SELECT id FROM competitions WHERE slug=? OR code=? OR id=?",
                  [$singleRef, $singleRef, ctype_digit($singleRef) ? (int)$singleRef : 0]);
        if ($c1) $compIds = [(int)$c1['id']];
    }
}
if (!$compIds) json_out(['ok' => false, 'error' => 'Конкурс не выбран'], 400);

// Все конкурсы должны существовать и быть открыты
$placeholders = implode(',', array_fill(0, count($compIds), '?'));
$comps = all("SELECT * FROM competitions WHERE id IN ($placeholders)", $compIds);
if (count($comps) !== count($compIds)) json_out(['ok' => false, 'error' => 'Один или несколько конкурсов не найдены'], 404);
foreach ($comps as $c) {
    if (!in_array($c['status'], ['open', 'judging'], true)) {
        json_out(['ok' => false, 'error' => 'Приём заявок закрыт для конкурса «'.$c['name'].'»'], 409);
    }
}
// Для сохранения совместимости с проверками ниже — $comp = первый выбранный
$comp = $comps[0];

$errors = [];

// ФИО
$full_name = function_exists('v_fio') ? v_fio(input('full_name')) : trim(input('full_name'));
if (mb_strlen($full_name) < 3) $errors['full_name'] = 'Укажите ФИО участника';

// Email
$email = mb_strtolower(input('email'));
$ev = function_exists('v_email')
    ? v_email($email)
    : ['ok' => (bool) filter_var($email, FILTER_VALIDATE_EMAIL), 'reason' => 'Некорректный адрес'];
if (!($ev['ok'] ?? false)) $errors['email'] = $ev['reason'] ?? 'Проверьте электронную почту';

// Телефон
$phoneRaw = input('phone');
$pv = function_exists('v_phone')
    ? v_phone($phoneRaw)
    : ['ok' => (bool) preg_match('/\d{10,}/', preg_replace('/\D/', '', $phoneRaw)), 'formatted' => $phoneRaw];
if (!($pv['ok'] ?? false)) $errors['phone'] = 'Проверьте номер телефона';
$phone = $pv['formatted'] ?? $phoneRaw;

// Видео (конкурсная ссылка)
$video = input('video_url');
$platform = '';
if ($video !== '') {
    $vv = function_exists('v_video')
        ? v_video($video)
        : ['ok' => (bool) filter_var($video, FILTER_VALIDATE_URL), 'platform' => '', 'reason' => 'Проверьте ссылку'];
    if (!($vv['ok'] ?? false)) $errors['video_url'] = $vv['reason'] ?? 'Недопустимая ссылка на видео';
    $platform = $vv['platform'] ?? '';
}

// Номинация — строго по справочнику NOMINATIONS().
$nomination = input('nomination');
$nomList = array_keys(NOMINATIONS());
if ($nomination === '') {
    $errors['nomination'] = 'Выберите номинацию';
} elseif (!in_array($nomination, $nomList, true)) {
    $errors['nomination'] = 'Выберите номинацию из списка';
}

// Возрастная категория — по справочнику AGE_CATEGORIES() (если указана).
$ageCategory = input('age_category');
if ($ageCategory !== '' && !in_array($ageCategory, AGE_CATEGORIES(), true)) {
    $errors['age_category'] = 'Выберите возрастную категорию из списка';
}

// Дата рождения — формат ГГГГ-ММ-ДД, не в будущем (если указана).
$birthDate = input('birth_date');
if ($birthDate !== '') {
    $dt = DateTime::createFromFormat('Y-m-d', $birthDate);
    if (!$dt || $dt->format('Y-m-d') !== $birthDate) {
        $errors['birth_date'] = 'Проверьте дату рождения (ГГГГ-ММ-ДД)';
    } elseif ($birthDate > date('Y-m-d')) {
        $errors['birth_date'] = 'Дата рождения не может быть в будущем';
    }
}

// --- Конкурсная работа обязательна для исполнительских/видео- и ИЗО/фото-номинаций ---
// Исполнительские/видео: обязательна конкурсная ВИДЕО-ссылка. ИЗО/фото: допускается фото-ссылка.
$performingNoms = [
    'Вокальное искусство', 'Инструментальное исполнительство', 'Театральное искусство',
    'Художественное слово', 'Хореография', 'Цирковое искусство',
];
$imageNoms = ['Изобразительное искусство', 'Фото- и видеоискусство'];
$needsMedia = in_array($nomination, $performingNoms, true) || in_array($nomination, $imageNoms, true);
if ($needsMedia && $video === '' && empty($errors['video_url'])) {
    $errors['video_url'] = in_array($nomination, $performingNoms, true)
        ? 'Для этой номинации нужна ссылка на конкурсное видео выступления'
        : 'Приложите ссылку на конкурсную работу (фото или изображение)';
}

// Подтверждение конкурсных требований (без монтажа, ≥480p, не старше года, ссылка открыта).
if ($needsMedia && !input('agree_rules')) {
    $errors['agree_rules'] = 'Подтвердите соответствие материала конкурсным требованиям';
}

// Обязательные согласия (серверная проверка): регистрация заявки и обработка перс. данных.
if (!input('agree_reg')) {
    $errors['agree_reg'] = 'Необходимо согласие на регистрацию заявки на конкурс';
}
if (!input('agree_pd')) {
    $errors['agree_pd'] = 'Необходимо согласие на обработку персональных данных';
}

if ($errors) {
    json_out(['ok' => false, 'error' => 'Проверьте заполнение формы', 'fields' => $errors], 422);
}

// --- Создаём заявку(и) по каждому выбранному конкурсу ---
$uid = current_user()['id'] ?? null;

// Гость подаёт заявку — авто-создаём профиль (без пароля), логиним, отправляем письмо с
// одноразовой ссылкой для установки пароля. Учаcтник сразу попадёт в кабинет.
if (!$uid && $email !== '') {
    $existing = one("SELECT * FROM users WHERE email=?", [$email]);
    if ($existing) {
        $uid = (int) $existing['id'];
    } else {
        $uid = (int) insert('users', [
            'email'         => $email,
            'password_hash' => '',
            'full_name'     => $full_name,
            'phone'         => $phone,
            'role'          => 'user',
            'email_verified'=> 0,
            'category'      => 'participant',
        ]);
        if (function_exists('login_user')) login_user($uid);
        if (function_exists('mail_queue')) {
            $link = rtrim((string) cfgv('base_url'), '/') . '/cabinet#settings';
            $html = function_exists('mail_template')
                ? mail_template('generic', [
                    'title'     => 'Ваш личный кабинет создан',
                    'name'      => $full_name,
                    'message'   => 'Мы создали для Вас личный кабинет на сайте центра — там Ваши заявки, статусы, оплаты и дипломы. Осталось установить пароль для входа.',
                    'cta_url'   => $link,
                    'cta_text'  => 'Установить пароль',
                    'preheader' => 'Личный кабинет создан — установите пароль для входа.',
                  ])
                : '<p>Здравствуйте, ' . h($full_name) . '.</p><p>Мы создали для Вас личный кабинет — установите пароль для входа в разделе настроек кабинета на сайте центра.</p>';
            mail_queue($email, $full_name, 'Ваш кабинет создан — Культурного центра «Музыкальный Мир»', $html);
        }
        audit('auto_register_on_apply', 'user', $uid, ['email' => $email]);
    }
}
$numbers = [];
$appIds  = [];
$appMap  = []; // number -> comp_name

foreach ($comps as $ci) {
    $num = gen_application_number($ci);
    $aid = insert('applications', [
        'number'         => $num,
        'competition_id' => (int) $ci['id'],
        'user_id'        => $uid,
        'full_name'      => $full_name,
        'is_group'       => input('is_group') ? 1 : 0,
        'group_name'     => input('group_name'),
        'birth_date'     => input('birth_date'),
        'age_category'   => input('age_category'),
        'nomination'     => $nomination,
        'subgroup'       => input('subgroup'),
        'formation'      => input('formation'),
        'work_title'     => input('work_title'),
        'teacher'        => input('teacher'),
        'institution'    => input('institution'),
        'city'           => input('city'),
        'email'          => $email,
        'phone'          => $phone,
        'video_url'      => $video,
        'video_platform' => $platform,
        'address'        => input('address'),
        'postal_index'   => input('postal_index'),
        'is_paid'        => (int) $ci['is_paid'] ? 0 : 1,
        'status'         => 'new',
    ]);
    $numbers[] = $num;
    $appIds[]  = $aid;
    $appMap[$num] = $ci['name'];
    audit('apply', 'applications', $aid, ['number' => $num, 'competition' => $ci['slug']]);
}
// Совместимость: если одна заявка — сохраняем прежние переменные
$number = $numbers[0];
$appId  = $appIds[0];

// --- Одна оплата за все платные заявки (сумма 500₽ × количество платных) ---
$payment = null;
$confirmationUrl = null;
$priceInfo = null;

$paidComps  = array_values(array_filter($comps, fn($c)=> (int)$c['is_paid']));
$freeCount  = count($comps) - count($paidComps);

if ($paidComps) {
    $basePriceSum = array_sum(array_map(fn($c)=>(int)$c['price'], $paidComps));

    // Скидки применяются ко ВСЕЙ сумме одинаково.
    $loyaltyPct = loyalty_discount($uid, $email);
    $clubPct = 0;
    if ($uid && is_file(BASE_PATH . '/core/club.php')) {
        require_once BASE_PATH . '/core/club.php';
        if (function_exists('club_is_active') && club_is_active((int) $uid)) {
            $clubPct = club_discount_percent((int) $uid);
        }
    }
    $promoCode = strtoupper(preg_replace('/[^A-Z0-9]/', '', strtoupper(input('promo_code'))));
    $ref = $promoCode !== '' ? referral_lookup($promoCode) : null;
    if ($ref && $uid && (int) $ref['teacher_user_id'] === (int) $uid) $ref = null;
    $refPct = $ref ? (int) $ref['percent'] : 0;
    $totalPct = min(40, max($loyaltyPct, $clubPct) + $refPct);
    $amount = loyalty_apply($basePriceSum, $totalPct);

    $priceInfo = [
        'base_price'    => $basePriceSum,
        'paid_count'    => count($paidComps),
        'free_count'    => $freeCount,
        'loyalty_pct'   => $loyaltyPct,
        'referral_pct'  => $refPct,
        'promo_applied' => (bool) $ref,
        'discount_pct'  => $totalPct,
        'amount'        => $amount,
    ];

    if ($amount > 0) {
        $descNames = implode(', ', array_map(fn($c)=>$c['name'], $paidComps));
        if (mb_strlen($descNames) > 120) $descNames = mb_substr($descNames, 0, 117).'...';
        $payment = yukassa_create_payment(
            $amount,
            'Оргвзнос за участие в конкурсах: ' . $descNames,
            [
                'application_ids' => implode(',', $appIds),
                'application_id'  => (int)$appId, // для обратной совместимости
                'numbers'         => implode(',', $numbers),
                'number'          => $number,
                'email'           => $email,
                'promo'           => $ref['code'] ?? '',
            ]
        );
        if ($payment && !empty($payment['id']) && tbl_exists('payments')) {
            // Одна запись в payments — привязана к первой заявке, но покрывает все.
            insert('payments', [
                'application_id' => $appId,
                'amount'         => $amount,
                'method'         => 'yukassa',
                'status'         => $payment['status'] ?? 'pending',
                'yukassa_id'     => $payment['id'],
                'purpose'        => count($appIds) > 1 ? 'application_batch' : 'application',
            ]);
        }
        $confirmationUrl = $payment['confirmation_url'] ?? null;

        // Реферальное вознаграждение — на суммарный чек (учтётся при webhook confirmed)
        if ($ref) {
            $reward = referral_record_use($ref, $appId, $uid, $email, $amount);
            audit('referral_use', 'applications', $appId, ['code' => $ref['code'], 'reward' => $reward, 'amount' => $amount]);
        }
    }
}

// --- Письмо-подтверждение (фирменный шаблон, по одному письму на заявку) ---
$compsList = implode(', ', array_map(fn($c)=>$c['name'], $comps));
if (is_file(BASE_PATH . '/core/result_mail.php')) {
    require_once BASE_PATH . '/core/result_mail.php';
    foreach ($appIds as $aid) {
        try { application_mail_send((int) $aid); } catch (\Throwable $e) { /* тихо, в mail.log */ }
    }
} elseif (function_exists('mail_queue')) {
    // Фолбэк на случай отсутствия модуля фирменных писем.
    $numsList = implode(', ', $numbers);
    $subject  = 'Заявка №' . $number . ' принята — Культурного центра «Музыкальный Мир»';
    $fallbackMsg = (count($numbers) > 1 ? 'Ваши заявки ' : 'Ваша заявка ') . $numsList . ' на '
        . (count($comps) > 1 ? 'конкурсы' : 'конкурс') . ' «' . $compsList . '» принят' . (count($comps) > 1 ? 'ы' : 'а')
        . '. Мы сообщим о результатах на этот адрес.';
    $html = function_exists('mail_template')
        ? mail_template('generic', [
            'title'     => 'Заявка принята',
            'name'      => $full_name,
            'message'   => $fallbackMsg,
            'cta_url'   => rtrim((string) cfgv('base_url'), '/') . '/cabinet',
            'cta_text'  => 'Личный кабинет',
            'preheader' => 'Заявка зарегистрирована и передана оргкомитету.',
          ])
        : '<p>Здравствуйте, ' . h($full_name) . '!</p><p>' . h($fallbackMsg) . '</p>';
    mail_queue($email, $full_name, $subject, $html);
}

// --- уведомление админу ---
if (function_exists('tg_notify_admin')) {
    tg_notify_admin(
        (count($numbers) > 1 ? "Новые заявки (".count($numbers)."):\n" : "Новая заявка {$number}\n")
        . "{$compsList}\n{$full_name}\n{$nomination}"
    );
}

// --- уведомление владельца в 3 канала + серверная аналитика ---
if (is_file(BASE_PATH . '/core/notify_owner.php')) {
    require_once BASE_PATH . '/core/notify_owner.php';
    try {
        $sumText = $priceInfo !== null
            ? (money((int) $priceInfo['amount']) . ($priceInfo['discount_pct'] > 0 ? ' (скидка ' . $priceInfo['discount_pct'] . '%)' : ''))
            : 'бесплатно';
        owner_notify(
            'ЗАЯВКИ',
            count($numbers) > 1 ? 'Новые заявки (' . count($numbers) . ')' : 'Новая заявка ' . $number,
            '',
            [
                'Номер'     => implode(', ', $numbers),
                'ФИО'       => $full_name,
                'Конкурс'   => $compsList,
                'Номинация' => $nomination,
                'Сумма'     => $sumText,
                '_event'    => 'application',
                '_path'     => '/apply',
                '_meta'     => ['number' => $number, 'count' => count($numbers),
                                'amount' => (int) ($priceInfo['amount'] ?? 0)],
            ]
        );
    } catch (\Throwable $e) { /* тихо */ }
}

// --- in-app уведомление пользователю ---
if ($uid && is_file(BASE_PATH . '/core/notifications.php')) {
    require_once BASE_PATH . '/core/notifications.php';
    $title = count($numbers) > 1
        ? 'Заявки приняты (' . count($numbers) . ')'
        : 'Заявка ' . $number . ' принята';
    $body  = count($comps) > 1 ? 'Конкурсы: ' . $compsList : $compsList;
    if ($confirmationUrl) $body .= ' · Оплатите оргвзнос по ссылке.';
    notify_user($uid, $title, $body, $confirmationUrl ?: url('/cabinet#apps'), 'diploma');
}

$resp = ['ok' => true, 'number' => $number, 'numbers' => $numbers, 'batch' => count($numbers) > 1];
if ($priceInfo !== null) $resp['price'] = $priceInfo;
if ($payment !== null) {
    $resp['payment'] = [
        'id'               => $payment['id'] ?? null,
        'status'           => $payment['status'] ?? 'pending',
        'confirmation_url' => $confirmationUrl,
    ];
}
if ($confirmationUrl) $resp['confirmation_url'] = $confirmationUrl;
json_out($resp);

/** Проверка принадлежности Origin/Referer своему домену (строгая, для POST). */
function apply_same_origin(): bool {
    $hosts = [];
    if ($bu = cfgv('base_url')) { $h = parse_url((string) $bu, PHP_URL_HOST); if ($h) $hosts[] = strtolower($h); }
    foreach (['domain', 'domain_puny'] as $k) {
        if ($d = cfgv($k)) $hosts[] = strtolower((string) $d);
    }
    $hosts = array_values(array_unique(array_filter($hosts)));
    if (!$hosts) return true; // домены не сконфигурированы — не блокируем (dev)
    $src = $_SERVER['HTTP_ORIGIN'] ?? ($_SERVER['HTTP_REFERER'] ?? '');
    if ($src === '') return false;
    $srcHost = strtolower((string) parse_url($src, PHP_URL_HOST));
    return $srcHost !== '' && in_array($srcHost, $hosts, true);
}
