<?php
/**
 * POST групповой заявки педагога: несколько учеников на один конкурс разом,
 * единый платёж ЮKassa на сумму со скидкой за коллектив.
 * Скидка: 3-4 ученика - 10%, 5-9 - 15%, 10 и более - 20%.
 */
declare(strict_types=1);
require __DIR__ . '/_boot.php';
require_post();

$user = current_user();
if (!$user) json_out(['ok' => false, 'error' => 'Требуется вход в аккаунт'], 401);
if (!user_can('teacher')) json_out(['ok' => false, 'error' => 'Раздел доступен только педагогам'], 403);
if (!csrf_check()) json_out(['ok' => false, 'error' => 'Сессия устарела. Обновите страницу и попробуйте снова'], 419);
if (!rate_ok('teacher_group:' . $user['id'], 20, 3600)) {
    json_out(['ok' => false, 'error' => 'Слишком много запросов, попробуйте позже'], 429);
}

/** Скидка за размер коллектива, в процентах. */
function group_discount_percent(int $n): int {
    if ($n >= 10) return 20;
    if ($n >= 5) return 15;
    if ($n >= 3) return 10;
    return 0;
}

// --- конкурс ---
$compRef = input('competition_id');
$comp = one("SELECT * FROM competitions WHERE slug=? OR code=? OR id=?", [$compRef, $compRef, ctype_digit($compRef) ? (int) $compRef : 0]);
if (!$comp) json_out(['ok' => false, 'error' => 'Конкурс не найден'], 404);
if (!in_array($comp['status'], ['open', 'judging'], true)) {
    json_out(['ok' => false, 'error' => 'Приём заявок на этот конкурс закрыт'], 409);
}

$formation = input('formation');
$workTitle = input('work_title');
$groupName = input('group_name');
$institution = input('institution');
$city = input('city');

// --- строки учеников: rows[i][full_name|birth_date|age_category|nomination|video_url] ---
$rowsIn = $_POST['rows'] ?? [];
if (!is_array($rowsIn)) $rowsIn = [];

$errors = [];
$valid = [];
foreach (array_values($rowsIn) as $i => $r) {
    if (!is_array($r)) continue;
    $rowNum = $i + 1;
    $fullNameRaw = trim((string) ($r['full_name'] ?? ''));
    $fullName = function_exists('v_fio') && $fullNameRaw !== '' ? v_fio($fullNameRaw) : $fullNameRaw;
    if (mb_strlen($fullName) < 3) {
        $errors[] = ['row' => $rowNum, 'message' => 'Не указано или некорректно ФИО ученика']; continue;
    }
    $age = trim((string) ($r['age_category'] ?? ''));
    if ($age === '') { $errors[] = ['row' => $rowNum, 'message' => 'Не указана возрастная категория']; continue; }
    $nom = trim((string) ($r['nomination'] ?? ''));
    if ($nom === '') { $errors[] = ['row' => $rowNum, 'message' => 'Не указана номинация']; continue; }
    $birth = trim((string) ($r['birth_date'] ?? ''));

    $videoRaw = trim((string) ($r['video_url'] ?? ''));
    $video = ''; $platform = '';
    if ($videoRaw !== '') {
        $vv = function_exists('v_video')
            ? v_video($videoRaw)
            : ['ok' => (bool) filter_var($videoRaw, FILTER_VALIDATE_URL), 'platform' => '', 'reason' => 'Проверьте ссылку'];
        if (!($vv['ok'] ?? false)) {
            $errors[] = ['row' => $rowNum, 'message' => $vv['reason'] ?? 'Недопустимая ссылка на выступление']; continue;
        }
        $video = $videoRaw;
        $platform = $vv['platform'] ?? '';
    }

    $valid[] = [
        'full_name' => $fullName, 'birth_date' => $birth, 'age_category' => $age,
        'nomination' => $nom, 'video_url' => $video, 'video_platform' => $platform,
    ];
}

if (!$valid) {
    json_out(['ok' => false, 'error' => 'Добавьте хотя бы одного ученика с корректными данными', 'errors' => $errors], 422);
}

// --- создание заявок ---
$numbers = [];
$appIds = [];
foreach ($valid as $row) {
    $number = gen_application_number($comp);
    $appId = insert('applications', [
        'number'         => $number,
        'competition_id' => (int) $comp['id'],
        'user_id'        => (int) $user['id'],
        'full_name'      => $row['full_name'],
        'is_group'       => 1,
        'group_name'     => $groupName,
        'birth_date'     => $row['birth_date'],
        'age_category'   => $row['age_category'],
        'nomination'     => $row['nomination'],
        'formation'      => $formation,
        'work_title'     => $workTitle,
        'teacher'        => $user['full_name'],
        'institution'    => $institution,
        'city'           => $city,
        'email'          => $user['email'],
        'phone'          => $user['phone'],
        'video_url'      => $row['video_url'],
        'video_platform' => $row['video_platform'],
        'is_paid'        => (int) $comp['is_paid'] ? 0 : 1,
        'status'         => 'new',
    ]);
    $numbers[] = $number;
    $appIds[] = $appId;
    audit('teacher_group', 'applications', $appId, ['number' => $number, 'competition' => $comp['slug']]);
}

// --- единый платёж со скидкой за коллектив ---
$count = count($valid);
$discount = group_discount_percent($count);
$amount = (int) $comp['is_paid']
    ? (int) round(((int) $comp['price']) * $count * (100 - $discount) / 100)
    : 0;

$payment = null;
if ($amount > 0) {
    $payment = yukassa_create_payment(
        $amount,
        'Групповая заявка (' . $count . ' уч.) - ' . $comp['name'],
        ['application_ids' => $appIds, 'teacher' => $user['full_name'], 'email' => $user['email']]
    );
    if ($payment && !empty($payment['id']) && tbl_exists('payments')) {
        insert('payments', [
            'application_id' => $appIds[0] ?? null,
            'amount'         => $amount,
            'method'         => 'yukassa',
            'status'         => $payment['status'] ?? 'pending',
            'yukassa_id'     => $payment['id'],
            'purpose'        => 'teacher_group',
        ]);
    }
}

audit('teacher_group_submit', 'applications', null, ['numbers' => $numbers, 'competition' => $comp['slug'], 'amount' => $amount, 'discount' => $discount]);

if (function_exists('tg_notify_admin')) {
    tg_notify_admin("Групповая заявка от педагога: {$user['full_name']}\n{$comp['name']}\nУчастников: {$count}, скидка {$discount}%");
}

json_out([
    'ok'               => true,
    'numbers'          => $numbers,
    'count'            => $count,
    'discount_percent' => $discount,
    'amount'           => $amount,
    'errors'           => $errors,
    'payment'          => $payment ? [
        'id'               => $payment['id'],
        'status'           => $payment['status'] ?? 'pending',
        'confirmation_url' => $payment['confirmation_url'] ?? null,
    ] : null,
]);
