<?php
/** POST заявки на конкурс: серверная валидация, номер CODE-ГГГГ-NNNNN, письмо в очередь, уведомление админу. */
declare(strict_types=1);
require __DIR__ . '/_boot.php';
require_once BASE_PATH . '/core/loyalty.php';
require_once BASE_PATH . '/core/paylink.php';   // pay_link_app() — запасная ссылка на оплату
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
    /* КОНКУРС КЛУБА — ЗАМОК НА СЕРВЕРЕ, А НЕ ПОДПИСЬ В ФОРМЕ.
     *
     * Форма показывает пометку и ведёт на страницу Клуба, но пометку в браузере
     * можно обойти в две минуты, а положение обещает участникам Клуба, что
     * конкурс их и только их. Обещание держится здесь. Ответ отдаём с адресом
     * страницы Клуба, чтобы форма могла сразу предложить вступить, а не просто
     * сказать «нельзя». */
    if ((int) ($c['club_only'] ?? 0) === 1) {
        if (!function_exists('club_is_active')) require_once BASE_PATH . '/core/club.php';
        $uidNow = current_user()['id'] ?? null;
        $inClub = $uidNow && function_exists('club_is_active') && club_is_active((int) $uidNow);
        if (!$inClub) {
            json_out([
                'ok'         => false,
                'club_only'  => true,
                'club_url'   => url('/club'),
                'error'      => 'Конкурс «' . $c['name'] . '» проводится только для участников Клуба. '
                              . 'Участие в нём входит в членство — отдельный организационный взнос не взимается.',
            ], 403);
        }
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
$linkCheck = '';
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
            /* Номинацию читаем здесь же: по изобразительному искусству и
               фотографии работа присылается изображением, и проверка ссылки
               должна об этом знать — иначе она требует видео там, где видео не
               бывает. Полная сверка номинации со справочником идёт ниже. */
            $nomForLink = trim((string) input('nomination'));
            $vr = video_verify($video, $nomForLink);
            // Площадка не ответила — пробуем ещё раз, прежде чем пропускать.
            // Одна секундная заминка на стороне ВК или Диска не должна
            // превращаться в непроверенную заявку, за которой потом кто-то
            // ходит руками.
            if ((string) ($vr['state'] ?? '') === 'unknown') {
                usleep(400000);
                $second = video_verify($video, $nomForLink);
                if ((string) ($second['state'] ?? '') !== 'unknown') $vr = $second;
            }
            if (!($vr['ok'] ?? false)) $errors['video_url'] = (string)($vr['reason'] ?? 'Ссылка не прошла проверку.');
            if (!empty($vr['platform'])) $platform = (string) $vr['platform'];
            // Итог проверки кладём в заявку: в админке видно, какие ссылки
            // проверены площадкой, а какие приняты вслепую из-за молчания сети.
            $linkCheck = json_encode([
                'state'    => (string) ($vr['state'] ?? ''),
                'platform' => (string) ($vr['platform'] ?? ''),
                'ts'       => $vr['ts'] ?? null,
                'at'       => date('Y-m-d H:i:s'),
            ], JSON_UNESCAPED_UNICODE);
        }

        /* ОДНА ССЫЛКА — ОДНА ЗАЯВКА В КОНКУРСЕ, И НЕ НА ПАПКУ.
         *
         * Школа искусств прислала 37 заявок на разных детей, а ссылка во всех
         * одна: общая папка облака со всеми рисунками. Жюри такое оценить не
         * может — по ссылке открывается список файлов, и какая работа чья,
         * непонятно. Проверяем при подаче, пока это ещё можно исправить в форме,
         * а не письмами постфактум. Отклонённые заявки ссылку не занимают: мы
         * сами просим исправить причину и подать заново. */
        if (empty($errors['video_url']) && is_file(BASE_PATH . '/core/link_unique.php')) {
            require_once BASE_PATH . '/core/link_unique.php';
            if (function_exists('lu_check')) {
                // Заявку можно подать сразу на несколько конкурсов: проверяем
                // каждый, потому что занятость ссылки считается внутри конкурса.
                foreach ($comps as $cCheck) {
                    $lu = lu_check($video, (int) $cCheck['id'], 0, $nomForLink);
                    if (!$lu['ok']) {
                        $errors['video_url'] = count($comps) > 1
                            ? '«' . (string) $cCheck['name'] . '»: ' . $lu['reason']
                            : $lu['reason'];
                        break;
                    }
                }
            }
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

/* ОДНА ЗАЯВКА — ОДИН КОНКУРСНЫЙ МАТЕРИАЛ (п. 8.1 положения).
 *
 * В поле «конкурсный номер» приходит программа целиком: «2. Е.Дербенко «Первые
 * шаги» 1)Раз-два. Веселый марш. 2) Вальс снежинок. 3)Тик-так. 4)Плясовая» —
 * пять произведений одной заявкой. Жюри оценивает такое как один номер, на
 * дипломе печатается вся простыня, а по положению это вообще не принимается.
 * Ловим на подаче, а не отклонением после оценки: человек тут же исправляет
 * поле и подаёт заново, без снятия с конкурса и без возврата взноса.
 *
 * Считаем списком только явную нумерацию — «1)», «2.», «1 -» подряд не меньше
 * двух раз. Название с цифрой внутри («Соната №2», «Прелюдия 1») под это не
 * попадает: там нумерация одна, а не перечень. */
$wt = trim((string) input('work_title'));
if ($wt !== '') {
    $marks = preg_match_all('~(?<![\d,.])\b[1-9]\s*[\)\.\-–]\s*(?=[\p{Lu}\p{Ll}«"])~u', $wt) ?: 0;
    if ($marks >= 2) {
        $errors['work_title'] = 'В заявке указано несколько произведений. По положению одна заявка — '
            . 'один конкурсный материал (п. 8.1): оставьте в этом поле только тот номер, который '
            . 'записан на видео. На остальные произведения подайте отдельные заявки.';
    }
}

if ($errors) {
    json_out(['ok' => false, 'error' => 'Проверьте заполнение формы', 'fields' => $errors], 422);
}

// --- Создаём заявку(и) по каждому выбранному конкурсу ---
$uid = current_user()['id'] ?? null;

// Гость подаёт заявку — авто-создаём профиль (без пароля), логиним, отправляем письмо с
// одноразовой ссылкой для установки пароля. Учаcтник сразу попадёт в кабинет.
if (!$uid && $email !== '') {
    // КАБИНЕТ ПОЯВЛЯЕТСЯ СРАЗУ И С ПАРОЛЕМ.
    // Раньше учётная запись создавалась без пароля, и человеку приходило письмо
    // «установите пароль» — лишний шаг, на котором часть людей отваливалась.
    // Теперь выдаём готовый логин и временный пароль тем же блоком, что и в
    // письме запуска: зашёл — и весь кабинет доступен, а имя, фото, пароль и
    // подтверждение почты меняются уже внутри.
    foreach (['kabinet_onboarding', 'person_name'] as $__m) {
        $__p = BASE_PATH . '/core/' . $__m . '.php';
        if (is_file($__p)) require_once $__p;
    }
    $existing = one("SELECT * FROM users WHERE LOWER(email)=?", [mb_strtolower($email)]);
    $freshPass = '';
    if ($existing) {
        // ЧУЖОЙ АККАУНТ ЗДЕСЬ НЕ ОТКРЫВАЕТСЯ.
        //
        // Раньше на этом месте стояли выдача нового пароля и login_user(): человек
        // назвал в форме адрес — и получал сессию его владельца. Форму может
        // отправить кто угодно и без всякой проверки почты, так что достаточно
        // было знать адрес администратора, чтобы войти в админку со всеми
        // заявками, платежами и рассылками. Адрес центра указан на самом сайте.
        //
        // Заявку к найденной учётной записи привязываем — это тот же человек по
        // адресу, и его заявки должны быть в его кабинете. Но доступ выдаётся
        // только через вход с паролем: подача заявки владения почтой не доказывает.
        $uid = (int) $existing['id'];
    } else {
        $freshPass = function_exists('kabinet_gen_password') ? kabinet_gen_password() : bin2hex(random_bytes(4));
        $uid = (int) insert('users', [
            'email'         => $email,
            'password_hash' => password_hash($freshPass, PASSWORD_DEFAULT),
            'full_name'     => $full_name,
            'phone'         => $phone,
            'role'          => 'user',
            'email_verified'=> 0,
            'category'      => 'participant',
        ]);
        if (function_exists('login_user')) login_user($uid);
        audit('auto_register_on_apply', 'user', $uid, ['email' => $email]);
    }

    // Отдельное письмо о кабинете — только если пароль реально выдан.
    // У того, кто уже пользуется кабинетом, ничего не меняется и письма нет.
    if ($freshPass !== '' && function_exists('mail_queue')) {
        $inner = function_exists('kabinet_onboarding_inner') ? kabinet_onboarding_inner() : '';
        if ($inner !== '') {
            $inner = str_replace(
                ['{{name}}', '{{login}}', '{{password}}'],
                [h($full_name !== '' ? $full_name : 'участник'), h($email), h($freshPass)],
                $inner
            );
            $html = function_exists('nl_wrap_email')
                ? nl_wrap_email($inner, '', '', 'Личный кабинет создан: логин и пароль внутри')
                : $inner;
        } else {
            $link = rtrim((string) cfgv('base_url'), '/') . '/login';
            $html = '<p>Здравствуйте, ' . h($full_name) . '.</p>'
                  . '<p>Для Вас создан личный кабинет на сайте центра — там заявки, статусы, оплаты и дипломы.</p>'
                  . '<p>Логин: <b>' . h($email) . '</b><br>Временный пароль: <b>' . h($freshPass) . '</b></p>'
                  . '<p><a href="' . h($link) . '">Войти в кабинет</a>. Пароль, имя и фото можно поменять в настройках кабинета.</p>';
        }
        mail_queue($email, $full_name, 'Ваш личный кабинет создан — логин и пароль внутри', $html);
    }
}

// Учреждение-партнёр, по чьей персональной ссылке пришёл человек (0 — сам по себе).
$partnerInstId = 0;
if (is_file(BASE_PATH . '/core/partner.php')) {
    require_once BASE_PATH . '/core/partner.php';
    if (function_exists('partner_cookie_id')) $partnerInstId = partner_cookie_id();
}

// Канал, который привёл человека (utm_source в ссылке анонса или письма).
$srcTag = '';
if (is_file(BASE_PATH . '/core/traffic.php')) {
    require_once BASE_PATH . '/core/traffic.php';
    $srcTag = traffic_src();
}

$numbers = [];
$appIds  = [];
$appMap  = []; // number -> comp_name

foreach ($comps as $ci) {
    $num = gen_application_number($ci);
    $aid = insert('applications', [
        'number'         => $num,
        'src'            => $srcTag,
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
        'link_check'     => $linkCheck ?? '',
        'address'        => input('address'),
        'postal_index'   => input('postal_index'),
        'is_paid'        => (int) $ci['is_paid'] ? 0 : 1,
        'status'         => 'new',
    ]);
    // ЗАЯВКА, ПРИШЕДШАЯ ПО ПЕРСОНАЛЬНОЙ ССЫЛКЕ ПАРТНЁРА, ЗАСЧИТЫВАЕТСЯ ЕМУ.
    //
    // Метку оставляет переход по /p/<slug> (cookie на 90 дней). Без этой привязки
    // счётчик заявок учреждения стоит на нуле, и пороги партнёрской программы —
    // пять заявок на благодарности, десять на промокод — не наступают никогда.
    if ($partnerInstId > 0) partner_attach_application((int) $aid, $partnerInstId);

    $numbers[] = $num;
    $appIds[]  = $aid;
    $appMap[$num] = $ci['name'];
    audit('apply', 'applications', $aid, ['number' => $num, 'competition' => $ci['slug']]);
}
// ЗАЯВИТЕЛЬ — ЭТО НАША БАЗА.
//
// Человек, подавший заявку, оставил адрес нам сам: он должен попасть в список
// подписчиков, иначе не получит ни анонса конкурсов, ни напоминания о награде,
// а рассылка живёт на старой выгрузке. Проверка 19 августа: из 128 адресов в
// заявках 30 в подписчиках отсутствовали, и все свежие. Добавляем сразу после
// приёма заявки. Кто отписался раньше, остаётся отписанным: nl_ensure_subscriber
// существующую запись не трогает и active не поднимает.
if (!function_exists('nl_ensure_subscriber') && is_file(BASE_PATH . '/core/newsletter.php')) {
    require_once BASE_PATH . '/core/newsletter.php';
}
if ($email !== '' && function_exists('nl_ensure_subscriber')) {
    try { nl_ensure_subscriber($email, (string) ($full_name ?: $group_name), 'apply'); }
    catch (\Throwable $e) { /* подписка не должна ломать приём заявки */ }
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
    $promoRaw  = trim((string) input('promo_code'));
    $promoCode = strtoupper(preg_replace('/[^A-Z0-9]/', '', strtoupper($promoRaw)));
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

    // ПАРТНЁРСКИЙ ПРОМОКОД УЧРЕЖДЕНИЯ (PART-2026-XXXX) ПРИНИМАЕТСЯ ТЕМ ЖЕ ПОЛЕМ.
    //
    // Реферальный поиск вырезает из строки дефисы, поэтому партнёрский код в нём
    // не находился никогда: письмо о десяти заявках и кабинет партнёра обещали
    // скидку 10%, а форма заявки её не давала.
    $partnerPct   = 0;
    $partnerPromo = '';
    // $basePriceSum=0 — мисконфиг платного конкурса, заявка станет бесплатной ниже:
    // тратить на неё использование партнёра нельзя.
    if (!$ref && $promoRaw !== '' && $basePriceSum > 0 && function_exists('partner_promo_check')) {
        [$partnerInst, $partnerDeny] = partner_promo_check($promoRaw);
        if ($partnerInst) {
            // Партнёрская скидка идёт ВМЕСТО остальных, а не поверх них: она и так
            // равна общему потолку. Если своя скидка не меньше, код не тратим —
            // у учреждения их всего десять.
            if ($totalPct >= PARTNER_PROMO_PCT) {
                $partnerDeny = 'Ваша скидка уже не меньше партнёрской — промокод не потребовался.';
            } else {
                // Списываем сразу, вместе с расчётом счёта: так нельзя выдать больше
                // обещанных учреждению использований даже при одновременных заявках.
                // Адрес участника передаём вместе с кодом: одно использование на
                // человека, иначе десять скидок школы выбирает один педагог.
                $used = partner_apply_promo((string) $partnerInst['partner_promo_code'], (int) $appId, (string) $email);
                if ($used) {
                    $partnerPct   = (int) $used['discount_pct'];
                    $partnerPromo = (string) $used['promo_code'];
                    $totalPct     = $partnerPct;
                    // Свою разовую скидку участник в этой заявке не тратит.
                    $creditPct = 0;
                    $disc = ['loyalty' => 0, 'referral' => 0, 'club' => 0,
                             'total' => $partnerPct, 'cap' => max((int) $disc['cap'], $partnerPct)];
                    audit('partner_promo_use', 'applications', $appId,
                          ['code' => $partnerPromo, 'inst' => (int) $used['institution_id'], 'pct' => $partnerPct]);
                } else {
                    // Причина одна из двух: у школы кончились десять использований
                    // или этот участник уже применял её код. Обе для человека
                    // означают одно: скидки по коду в этот раз не будет.
                    $partnerDeny = 'Партнёрский промокод больше не действует: у учреждения '
                                 . 'закончились использования либо Вы уже применяли этот код.';
                }
            }
        }
        if ($promoDeny === '' && $partnerDeny !== '') $promoDeny = $partnerDeny;
    }

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
                'partner_pct'    => $partnerPct,
                'total_pct'      => $totalPct,
                'promo_code'     => $partnerPromo !== '' ? $partnerPromo : (string) ($ref['code'] ?? ''),
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
        'partner_pct'    => $partnerPct,
        'promo_applied'  => (bool) $ref || $partnerPct > 0,
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
                'promo'           => $partnerPromo !== '' ? $partnerPromo : ($ref['code'] ?? ''),
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
            // ПАКЕТ ПОМЕЧАЕТСЯ СРАЗУ, А НЕ ПОСЛЕ ОПЛАТЫ. Раньше batch_id проставлялся
            // только в момент подтверждения платежа, и до оплаты связь «эти заявки
            // оплачиваются одним чеком» жила исключительно в metadata ЮKassa. Из-за
            // этого сайт не знал о пакете: удаление одной заявки из кабинета сносило
            // платёжную строку всего чека, а остальные заявки оставались с живым, но
            // уже ничьим счётом.
            $__ids = $paidAppIds ?: $appIds;
            if (count($__ids) > 1) {
                try {
                    $__in = implode(',', array_map('intval', $__ids));
                    q("UPDATE applications SET batch_id=? WHERE id IN ($__in)", [(string) $payment['id']]);
                } catch (\Throwable $e) {}
            }
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

// ПЛАТЁЖНАЯ ФОРМА НЕ ОТКРЫЛАСЬ — ЧЕЛОВЕК ДОЛЖЕН ОБ ЭТОМ УЗНАТЬ.
// Заявки пишутся в базу до создания платежа, и если касса не ответила (сеть, тайм-аут,
// неверные ключи), confirmation_url остаётся пустым. Раньше ответ всё равно был
// «ok: true», клиент показывал экран «Заявка принята. Подтверждение направлено на Вашу
// электронную почту» — и на этом всё заканчивалось: письма нет (по платным заявкам оно
// уходит только после оплаты), редиректа нет, счёта нет. Человек уходил в полной
// уверенности, что подал работу.
if ($hasPaidPending && !$confirmationUrl) {
    $resp['payment_error'] = true;
    $resp['pay_url']       = function_exists('pay_link_app') ? pay_link_app((int) ($paidAppIds[0] ?? $appId)) : url('/cabinet#apps');
    $resp['message']       = 'Заявка сохранена, но платёжная форма не открылась. '
                           . 'Оплатить оргвзнос можно из личного кабинета — заявка ждёт оплаты и никуда не денется.';
}

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
