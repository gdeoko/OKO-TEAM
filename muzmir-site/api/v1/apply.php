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
    // ГЕЙТ ЗАПУСКА: заявки принимаются только на запущенные конкурсы.
    if ((int) ($c['launched'] ?? 0) !== 1) {
        json_out(['ok' => false, 'error' => 'Приём заявок для конкурса «'.$c['name'].'» ещё не открыт.'], 409);
    }
}
// Для сохранения совместимости с проверками ниже — $comp = первый выбранный
$comp = $comps[0];

$errors = [];

// Нормализация ввода (ФИО / коллектив / название номера).
if (is_file(BASE_PATH . '/core/text_format.php')) require_once BASE_PATH . '/core/text_format.php';

// Солист ИЛИ коллектив — строго одно из двух. При коллективе ФИО НЕ вносится, и наоборот.
$isGroup = (int) (input('is_group') ? 1 : 0);
$groupRaw = trim((string) input('group_name'));
$fioRaw   = function_exists('v_fio') ? v_fio(input('full_name')) : trim((string) input('full_name'));

if ($isGroup) {
    // Коллектив: имя коллектива в «ёлочках», ФИО очищаем.
    if ($groupRaw === '') $errors['group_name'] = 'Укажите название коллектива';
    $group_name = function_exists('collective_normalize') ? collective_normalize($groupRaw) : $groupRaw;
    $full_name  = '';
} else {
    // Солист: полное ФИО (Фамилия Имя Отчество), название коллектива очищаем.
    $full_name = function_exists('fio_normalize') ? fio_normalize($fioRaw) : $fioRaw;
    if ($full_name === '') $errors['full_name'] = 'Укажите ФИО участника';
    elseif (function_exists('fio_is_full') && !fio_is_full($full_name))
        $errors['full_name'] = 'Укажите ПОЛНОСТЬЮ: Фамилия Имя Отчество';
    $group_name = '';
}

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

    // Полная проверка ссылки: существование, открытый доступ, что это видео/работа,
    // и возраст (старше 1 года — п. 8.11 — не принимается). Блокируем только при
    // уверенном нарушении; если сеть не дала ответа — по этому пункту не блокируем.
    if (empty($errors['video_url'])) {
        if (is_file(BASE_PATH . '/core/link_check.php')) require_once BASE_PATH . '/core/link_check.php';
        if (function_exists('video_verify')) {
            $vr = video_verify($video);
            if (!($vr['ok'] ?? false)) $errors['video_url'] = (string)($vr['reason'] ?? 'Ссылка не прошла проверку.');
            if (!empty($vr['platform'])) $platform = (string) $vr['platform'];
        }
    }
}

// Номинация — строго по справочнику NOMINATIONS().
$nomination = input('nomination');
$nomList = array_keys(NOMINATIONS());
if ($nomination === '') {
    $errors['nomination'] = 'Выберите номинацию';
} elseif (!in_array($nomination, $nomList, true)) {
    $errors['nomination'] = 'Выберите номинацию из списка';
}

// Подраздел — строго из подразделов выбранной номинации (если у неё они есть).
$subgroup = trim((string) input('subgroup'));
if ($nomination !== '' && in_array($nomination, $nomList, true)) {
    $subList = NOMINATIONS()[$nomination] ?? [];
    if ($subList && $subgroup !== '' && !in_array($subgroup, $subList, true)) {
        $errors['subgroup'] = 'Выберите подраздел из списка';
    }
}

// Форма исполнения — строго из набора, допустимого для ВЫБРАННОЙ номинации.
// Иначе в заявку попадал «Хор» у хореографии и «Ансамбль» у изобразительного искусства.
$formation = trim((string) input('formation'));
if ($formation === '') {
    $errors['formation'] = 'Выберите форму исполнения';
} elseif ($nomination !== '' && in_array($nomination, $nomList, true)
          && !in_array($formation, FORMATIONS_FOR($nomination), true)) {
    $errors['formation'] = 'Эта форма исполнения не подходит для номинации «' . $nomination . '»';
}

// Возрастная категория — по справочнику AGE_CATEGORIES() (если указана).
$ageCategory = input('age_category');
if ($ageCategory !== '' && !in_array($ageCategory, AGE_CATEGORIES(), true)) {
    $errors['age_category'] = 'Выберите возрастную категорию из списка';
}

// Дату рождения (birth_date) больше не запрашиваем: работаем только с возрастной
// категорией — именно она попадает в диплом и в правила номинаций.

// Город/населённый пункт — ОБЯЗАТЕЛЕН. Авто-нормализация в «Страна, г. Город»
// («Москва»→«Россия, г. Москва», «Минск»→«Республика Беларусь, г. Минск» и т.п.).
$cityRaw = trim((string) input('city'));
if ($cityRaw === '') {
    $errors['city'] = 'Укажите город или населённый пункт';
} else {
    $cityNorm = function_exists('city_normalize') ? city_normalize($cityRaw) : $cityRaw;
    if ($cityNorm === '') $errors['city'] = 'Укажите город или населённый пункт';
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
        'is_group'       => $isGroup,
        'group_name'     => $group_name,
        // birth_date убран: работаем только с возрастной категорией.
        'age_category'   => input('age_category'),
        'nomination'     => $nomination,
        'subgroup'       => $subgroup,
        'formation'      => $formation,
        'work_title'     => function_exists('quote_title') ? quote_title((string) input('work_title')) : input('work_title'),
        'teacher'        => input('teacher'),
        'institution'    => input('institution'),
        'city'           => (function_exists('city_normalize') && ($cn = city_normalize((string) input('city'))) !== '')
                                ? $cn : input('city'),
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

// --- Разделяем заявки на бесплатные (принимаются сразу) и платные (ждут оплаты) ---
// ПРАВИЛО (Даниэль): платная заявка НЕ существует для админов/владельца, пока не
// оплачена. До оплаты: НЕ шлём письмо о принятии, НЕ уведомляем в Telegram/владельца,
// НЕ показываем в админке (там фильтр по is_paid). Участник видит заявку в кабинете
// с кнопкой оплаты; письмо о принятии и все уведомления уходят из core/payments.php
// в момент подтверждения оплаты. Бесплатные заявки принимаются как раньше — сразу.
$freeAppIds = [];   // заявки на бесплатные конкурсы — принимаются немедленно
$freeComps  = [];   // соответствующие конкурсы (для письма/уведомления)
$paidAppIds = [];   // заявки на платные конкурсы — ждут оплаты (для metadata платежа)
foreach ($comps as $i => $ci) {
    if (!(int) $ci['is_paid']) { $freeAppIds[] = $appIds[$i]; $freeComps[] = $ci; }
    else { $paidAppIds[] = $appIds[$i]; }
}
$hasPaidPending = count($freeAppIds) < count($appIds); // есть неоплаченные платные

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
    // Промокод — один раз на участника, максимум 5%. Свой собственный код не принимается.
    [$refPct, $promoDeny] = referral_discount_for($ref, $uid, $email);
    if ($refPct <= 0) $ref = null;

    // Владелец промокода получил разовую скидку 5% за приглашённого — тратим её здесь,
    // если участник не применяет чужой код (складывать две реферальные нельзя).
    $creditPct = 0;
    if ($refPct <= 0 && $uid) $creditPct = referral_credit_percent((int) $uid);
    $effectiveRefPct = max($refPct, $creditPct);

    // Потолки: без клуба суммарно ≤10%; с клубом — клуб + до 5% реферальных.
    $disc = discount_breakdown($loyaltyPct, $effectiveRefPct, $clubPct);
    $totalPct = (int) $disc['total'];
    $amount = loyalty_apply($basePriceSum, $totalPct);

    // Платный конкурс с нулевым итогом (price=0 у платного — мисконфиг) НЕ должен
    // «зависать» невидимой заявкой: принимаем такие заявки как бесплатные (is_paid=1,
    // письмо/уведомление/приём сразу), иначе они не попадут никуда.
    if ($amount <= 0 && $paidAppIds) {
        foreach ($comps as $i => $ci) {
            if ((int) $ci['is_paid'] && !in_array($appIds[$i], $freeAppIds, true)) {
                update('applications', ['is_paid' => 1], 'id=:id', ['id' => (int) $appIds[$i]]);
                $freeAppIds[] = $appIds[$i]; $freeComps[] = $ci;
            }
        }
        $paidAppIds = [];
    }

    /* Расшифровку цены сохраняем НА ЗАЯВКЕ. Без этого админка и кабинет видели голую
       сумму и не могли объяснить, почему участник заплатил 400 вместо 500. Пишем долю
       каждой платной заявки в общем чеке — при пакетной подаче суммы должны сходиться. */
    $__nPaid = max(1, count($paidComps));
    foreach ($comps as $__i => $__c) {
        if (!(int) $__c['is_paid']) continue;
        $__aid = (int) ($appIds[$__i] ?? 0);
        if ($__aid <= 0) continue;
        $__base  = (int) $__c['price'];
        $__share = loyalty_apply($__base, $totalPct);
        update('applications', [
            'price_base'    => $__base,
            'discount_pct'  => $totalPct,
            'amount_paid'   => in_array($__aid, $freeAppIds, true) ? 0 : $__share,
            'discount_info' => json_encode([
                'loyalty_pct'    => (int) $disc['loyalty'],
                'referral_pct'   => (int) $disc['referral'],
                'club_pct'       => (int) $disc['club'],
                'total_pct'      => $totalPct,
                'promo_code'     => (string) ($ref['code'] ?? ''),
                'credit_applied' => $refPct <= 0 && $creditPct > 0,
                'batch'          => $__nPaid,
            ], JSON_UNESCAPED_UNICODE),
        ], 'id=:id', ['id' => $__aid]);
    }

    $priceInfo = [
        'base_price'     => $basePriceSum,
        'paid_count'     => count($paidComps),
        'free_count'     => $freeCount,
        'loyalty_pct'    => (int) $disc['loyalty'],
        'referral_pct'   => (int) $disc['referral'],
        'club_pct'       => (int) $disc['club'],
        'promo_applied'  => (bool) $ref,
        'credit_applied' => $refPct <= 0 && $creditPct > 0,
        'promo_denied'   => $promoDeny,          // причина, если код не сработал
        'discount_pct'   => $totalPct,
        'discount_cap'   => (int) $disc['cap'],
        'amount'         => $amount,
    ];

    if ($amount > 0) {
        $descNames = implode(', ', array_map(fn($c)=>$c['name'], $paidComps));
        if (mb_strlen($descNames) > 120) $descNames = mb_substr($descNames, 0, 117).'...';
        $payment = yukassa_create_payment(
            $amount,
            'Оргвзнос за участие в конкурсах: ' . $descNames,
            [
                // ТОЛЬКО платные заявки — иначе при оплате бесплатные в смешанном батче
                // получат дубль письма и ложную плашку «Оплата получена» (core/payments.php).
                'application_ids' => implode(',', $paidAppIds ?: $appIds),
                'application_id'  => (int)($paidAppIds[0] ?? $appId), // для обратной совместимости
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
        } elseif ($creditPct > 0 && $uid) {
            // Потрачена собственная разовая скидка приглашающего — списываем её.
            if (referral_credit_spend((int) $uid, 'application:' . $appId)) {
                audit('referral_credit_spend', 'applications', $appId, ['pct' => $creditPct]);
            }
        }
    }
}

// --- Письмо-подтверждение (фирменный шаблон, ТОЛЬКО по бесплатным заявкам) ---
// Платные заявки письмо о принятии получат из core/payments.php после оплаты.
$compsList = implode(', ', array_map(fn($c)=>$c['name'], $comps));
$freeCompsList = implode(', ', array_map(fn($c)=>$c['name'], $freeComps));
if ($freeAppIds && is_file(BASE_PATH . '/core/result_mail.php')) {
    require_once BASE_PATH . '/core/result_mail.php';
    foreach ($freeAppIds as $aid) {
        try { application_mail_send((int) $aid); } catch (\Throwable $e) { /* тихо, в mail.log */ }
    }
} elseif ($freeAppIds && function_exists('mail_queue')) {
    // Фолбэк на случай отсутствия модуля фирменных писем.
    $freeNums = [];
    foreach ($comps as $i => $ci) if (!(int) $ci['is_paid']) $freeNums[] = $numbers[$i];
    $numsList = implode(', ', $freeNums);
    $subject  = 'Заявка №' . ($freeNums[0] ?? $number) . ' принята — Культурного центра «Музыкальный Мир»';
    $fallbackMsg = (count($freeNums) > 1 ? 'Ваши заявки ' : 'Ваша заявка ') . $numsList . ' на '
        . (count($freeComps) > 1 ? 'конкурсы' : 'конкурс') . ' «' . $freeCompsList . '» принят' . (count($freeComps) > 1 ? 'ы' : 'а')
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

// --- уведомление админу (ТОЛЬКО о бесплатных заявках; платные — после оплаты) ---
if ($freeAppIds && function_exists('tg_notify_admin')) {
    $freeNums2 = [];
    foreach ($comps as $i => $ci) if (!(int) $ci['is_paid']) $freeNums2[] = $numbers[$i];
    tg_notify_admin(
        (count($freeNums2) > 1 ? "Новые заявки (".count($freeNums2)."):\n" : "Новая заявка {$freeNums2[0]}\n")
        . "{$freeCompsList}\n{$full_name}\n{$nomination}"
    );
}

// --- уведомление владельца в 3 канала + серверная аналитика ---
// ВАЖНО (Даниэль): владельцу шлём событие ТОЛЬКО о бесплатных заявках. По платной,
// ещё НЕ оплаченной заявке владелец НЕ уведомляется — он получит уведомление
// «Оплата получена» из вебхука ЮKassa (core/payments.php), когда деньги реально
// придут. Так владелец видит только принятые (оплаченные/бесплатные) заявки, а
// неоплаченные платные не создают шум и «не существуют» до оплаты.
if ($freeAppIds && is_file(BASE_PATH . '/core/notify_owner.php')) {
    require_once BASE_PATH . '/core/notify_owner.php';
    try {
        $freeNums3 = [];
        foreach ($comps as $i => $ci) if (!(int) $ci['is_paid']) $freeNums3[] = $numbers[$i];
        // Полное письмо центру со всеми полями заявки + кнопкой «Оценить» (дип-линк в админку).
        $firstFreeId = (int) ($freeAppIds[0] ?? 0);
        $extraFields = [
            'Оргвзнос' => 'бесплатно',
            '_event'   => 'application',
            '_path'    => '/apply',
            '_meta'    => ['number' => ($freeNums3[0] ?? $number), 'count' => count($freeNums3), 'amount' => 0],
        ];
        if (count($freeNums3) > 1) $extraFields['Заявок в пакете'] = (string) count($freeNums3) . ' (' . implode(', ', $freeNums3) . ')';
        owner_notify(
            'ЗАЯВКИ',
            count($freeNums3) > 1 ? 'Новые заявки (' . count($freeNums3) . ')' : 'Новая заявка ' . ($freeNums3[0] ?? $number),
            '',
            $firstFreeId > 0 && function_exists('owner_app_data')
                ? owner_app_data($firstFreeId, $extraFields)
                : [
                    'Номер' => implode(', ', $freeNums3), 'ФИО' => $full_name,
                    'Конкурс' => $freeCompsList, 'Номинация' => $nomination, 'Оргвзнос' => 'бесплатно',
                    '_event' => 'application', '_path' => '/apply',
                    '_meta' => ['number' => ($freeNums3[0] ?? $number), 'count' => count($freeNums3), 'amount' => 0],
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
