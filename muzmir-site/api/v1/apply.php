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

// --- конкурс: по slug / id / коду ---
$compRef = input('competition_id');
if ($compRef === '') $compRef = input('competition');
if ($compRef === '') $compRef = input('slug');
$comp = one(
    "SELECT * FROM competitions WHERE slug=? OR code=? OR id=?",
    [$compRef, $compRef, ctype_digit($compRef) ? (int) $compRef : 0]
);
if (!$comp) json_out(['ok' => false, 'error' => 'Конкурс не найден'], 404);
if (!in_array($comp['status'], ['open', 'judging'], true)) {
    json_out(['ok' => false, 'error' => 'Приём заявок на этот конкурс закрыт'], 409);
}

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

// --- номер и запись ---
$number = gen_application_number($comp);
$uid = current_user()['id'] ?? null;

$appId = insert('applications', [
    'number'         => $number,
    'competition_id' => (int) $comp['id'],
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
    'is_paid'        => (int) $comp['is_paid'] ? 0 : 1,
    'status'         => 'new',
]);
audit('apply', 'applications', $appId, ['number' => $number, 'competition' => $comp['slug']]);

// --- оплата оргвзноса (для платного конкурса) ---
$payment = null;
$confirmationUrl = null;
$priceInfo = null;
if ((int) $comp['is_paid']) {
    $basePrice = (int) $comp['price'];

    // Скидка лояльности за число состоявшихся участий.
    $loyaltyPct = loyalty_discount($uid, $email);

    // Промокод педагога: доп. скидка участнику + метка реферала.
    $promoCode = strtoupper(preg_replace('/[^A-Z0-9]/', '', strtoupper(input('promo_code'))));
    $ref = $promoCode !== '' ? referral_lookup($promoCode) : null;
    // Свой код применять нельзя.
    if ($ref && $uid && (int) $ref['teacher_user_id'] === (int) $uid) $ref = null;
    $refPct = $ref ? (int) $ref['percent'] : 0;

    // Итоговая скидка суммируется, но не более 40%.
    $totalPct = min(40, $loyaltyPct + $refPct);
    $amount = loyalty_apply($basePrice, $totalPct);

    $priceInfo = [
        'base_price'     => $basePrice,
        'loyalty_pct'    => $loyaltyPct,
        'referral_pct'   => $refPct,
        'promo_applied'  => (bool) $ref,
        'discount_pct'   => $totalPct,
        'amount'         => $amount,
    ];

    if ($amount > 0) {
        $payment = yukassa_create_payment(
            $amount,
            'Оргвзнос за участие - ' . $comp['name'] . ' (' . $number . ')',
            ['application_id' => $appId, 'number' => $number, 'email' => $email, 'promo' => $ref['code'] ?? '']
        );
        if ($payment && !empty($payment['id']) && tbl_exists('payments')) {
            insert('payments', [
                'application_id' => $appId,
                'amount'         => $amount,
                'method'         => 'yukassa',
                'status'         => $payment['status'] ?? 'pending',
                'yukassa_id'     => $payment['id'],
                'purpose'        => 'application',
            ]);
        }
        $confirmationUrl = $payment['confirmation_url'] ?? null;

        // Начисление вознаграждения педагогу по его коду.
        if ($ref) {
            $reward = referral_record_use($ref, $appId, $uid, $email, $amount);
            audit('referral_use', 'applications', $appId, ['code' => $ref['code'], 'reward' => $reward, 'amount' => $amount]);
        }
    }
}

// --- письмо-подтверждение в очередь ---
$subject = 'Заявка ' . $number . ' принята - ' . $comp['name'];
$html = function_exists('mail_template')
    ? mail_template('application_confirm', [
        'number' => $number, 'full_name' => $full_name, 'competition' => $comp['name'], 'nomination' => $nomination,
    ])
    : '<p>Здравствуйте, ' . h($full_name) . '!</p>'
      . '<p>Ваша заявка <b>' . h($number) . '</b> на конкурс «' . h($comp['name']) . '» принята.</p>'
      . '<p>Мы сообщим о результатах на этот адрес.</p>';

if (function_exists('mail_queue')) {
    mail_queue($email, $full_name, $subject, $html);
} elseif (tbl_exists('mail_queue')) {
    insert('mail_queue', ['to_email' => $email, 'to_name' => $full_name, 'subject' => $subject, 'body' => $html]);
}

// --- уведомление админу ---
if (function_exists('tg_notify_admin')) {
    tg_notify_admin("Новая заявка {$number}\n{$comp['name']}\n{$full_name}\n{$nomination}");
}

$resp = ['ok' => true, 'number' => $number];
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
