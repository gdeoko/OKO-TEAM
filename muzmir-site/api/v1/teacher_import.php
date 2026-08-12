<?php
/**
 * POST импорта учеников из CSV в личном кабинете педагога.
 * Столбцы строки: ФИО; возрастная категория; номинация; ссылка на выступление (необязательно).
 * mode=preview — разобрать и провалидировать файл без записи в базу.
 * mode=commit  — создать заявки (status=new, номер CODE-ГГГГ-NNNNN, привязка к педагогу).
 */
declare(strict_types=1);
require __DIR__ . '/_boot.php';
require_post();

$user = current_user();
if (!$user) json_out(['ok' => false, 'error' => 'Требуется вход в аккаунт'], 401);
if (!user_can('teacher')) json_out(['ok' => false, 'error' => 'Раздел доступен только педагогам'], 403);
if (!csrf_check()) json_out(['ok' => false, 'error' => 'Сессия устарела. Обновите страницу и попробуйте снова'], 419);
if (!rate_ok('teacher_import:' . $user['id'], 20, 3600)) {
    json_out(['ok' => false, 'error' => 'Слишком много запросов, попробуйте позже'], 429);
}

$mode = input('mode', 'preview') === 'commit' ? 'commit' : 'preview';

// --- конкурс ---
$compRef = input('competition_id');
$comp = one("SELECT * FROM competitions WHERE slug=? OR code=? OR id=?", [$compRef, $compRef, ctype_digit($compRef) ? (int) $compRef : 0]);
if (!$comp) json_out(['ok' => false, 'error' => 'Конкурс не найден'], 404);
if (!in_array($comp['status'], ['open', 'judging'], true)) {
    json_out(['ok' => false, 'error' => 'Приём заявок на этот конкурс закрыт'], 409);
}

$institution = input('institution');
$city = input('city');
$hasHeader = input('has_header') === '1';

// --- файл ---
if (empty($_FILES['file']) || ($_FILES['file']['error'] ?? UPLOAD_ERR_NO_FILE) !== UPLOAD_ERR_OK) {
    json_out(['ok' => false, 'error' => 'Файл не загружен или повреждён'], 422);
}
$tmpPath = $_FILES['file']['tmp_name'];
if (!is_uploaded_file($tmpPath)) json_out(['ok' => false, 'error' => 'Ошибка загрузки файла'], 422);
if ((int) $_FILES['file']['size'] > 2 * 1024 * 1024) json_out(['ok' => false, 'error' => 'Файл слишком большой (максимум 2 МБ)'], 413);

$raw = file_get_contents($tmpPath);
if ($raw === false) json_out(['ok' => false, 'error' => 'Не удалось прочитать файл'], 422);
$raw = preg_replace('/^\xEF\xBB\xBF/', '', $raw); // BOM

// Определяем разделитель по первой непустой строке.
$firstLine = '';
foreach (preg_split('/\r\n|\r|\n/', $raw) as $l) { if (trim($l) !== '') { $firstLine = $l; break; } }
$delimiter = substr_count($firstLine, ';') > substr_count($firstLine, ',') ? ';' : ',';

$lines = [];
$fh = fopen('php://temp', 'r+');
fwrite($fh, $raw);
rewind($fh);
while (($row = fgetcsv($fh, 0, $delimiter)) !== false) {
    if (count($row) === 1 && trim((string) $row[0]) === '') continue; // пустая строка
    $lines[] = $row;
}
fclose($fh);

if ($hasHeader && $lines) array_shift($lines);

if (!$lines) json_out(['ok' => false, 'error' => 'В файле не найдено ни одной строки с данными'], 422);
if (count($lines) > 500) json_out(['ok' => false, 'error' => 'Слишком много строк за один раз (максимум 500)'], 422);

$valid = [];
$errors = [];
foreach ($lines as $i => $row) {
    $rowNum = $i + 1 + ($hasHeader ? 1 : 0);
    $fullNameRaw = trim((string) ($row[0] ?? ''));
    $ageRaw = trim((string) ($row[1] ?? ''));
    $nomRaw = trim((string) ($row[2] ?? ''));
    $videoRaw = trim((string) ($row[3] ?? ''));
    // Дата рождения из импортируемого файла больше не нужна — оставляем только категорию.

    $fullName = function_exists('v_fio') && $fullNameRaw !== '' ? v_fio($fullNameRaw) : $fullNameRaw;
    if (mb_strlen($fullName) < 3) {
        $errors[] = ['row' => $rowNum, 'message' => 'Не указано или некорректно ФИО ученика'];
        continue;
    }
    if ($ageRaw === '') {
        $errors[] = ['row' => $rowNum, 'message' => 'Не указана возрастная категория'];
        continue;
    }
    if ($nomRaw === '') {
        $errors[] = ['row' => $rowNum, 'message' => 'Не указана номинация'];
        continue;
    }
    $video = '';
    $platform = '';
    if ($videoRaw !== '') {
        $vv = function_exists('v_video')
            ? v_video($videoRaw)
            : ['ok' => (bool) filter_var($videoRaw, FILTER_VALIDATE_URL), 'platform' => '', 'reason' => 'Проверьте ссылку'];
        if (!($vv['ok'] ?? false)) {
            $errors[] = ['row' => $rowNum, 'message' => $vv['reason'] ?? 'Недопустимая ссылка на выступление'];
            continue;
        }
        $video = $videoRaw;
        $platform = $vv['platform'] ?? '';
    }

    $valid[] = [
        'full_name'    => $fullName,
        'age_category' => $ageRaw,
        'nomination'   => $nomRaw,
        'video_url'    => $video,
        'video_platform' => $platform,
    ];
}

if ($mode === 'preview') {
    json_out([
        'ok'      => true,
        'total'   => count($lines),
        'valid'   => count($valid),
        'errors'  => $errors,
        'preview' => array_slice($valid, 0, 50),
    ]);
}

// --- mode=commit: создаём заявки ---
if (!$valid) json_out(['ok' => false, 'error' => 'Нет ни одной корректной строки для загрузки', 'errors' => $errors], 422);

$numbers = [];
$created = 0;
foreach ($valid as $row) {
    $number = gen_application_number($comp);
    $appId = insert('applications', [
        'number'         => $number,
        'competition_id' => (int) $comp['id'],
        'user_id'        => (int) $user['id'],
        'full_name'      => $row['full_name'],
        'age_category'   => $row['age_category'],
        'nomination'     => $row['nomination'],
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
    $created++;
    audit('teacher_import', 'applications', $appId, ['number' => $number, 'competition' => $comp['slug']]);
}

if (function_exists('tg_notify_admin')) {
    tg_notify_admin("Импорт от педагога: {$user['full_name']}\n{$comp['name']}\nСоздано заявок: {$created}");
}
if ($created && $user['email'] && function_exists('mail_queue')) {
    $html = function_exists('mail_template')
        ? mail_template('generic', [
            'title'     => 'Импорт учеников завершён',
            'name'      => (string) ($user['full_name'] ?: 'коллега'),
            'message'   => 'Импорт учеников на конкурс «' . $comp['name'] . '» завершён. Создано заявок: ' . $created . '.'
                . "\nНомера заявок: " . implode(', ', $numbers) . '.',
            'cta_url'   => rtrim((string) cfgv('base_url'), '/') . '/cabinet',
            'cta_text'  => 'Открыть кабинет',
            'preheader' => 'Создано заявок: ' . $created . '. Все статусы — в кабинете.',
          ])
        : '<p>Здравствуйте, ' . h($user['full_name'] ?: 'коллега') . '!</p>'
          . '<p>Импорт учеников на конкурс «' . h($comp['name']) . '» завершён. Создано заявок: <b>' . $created . '</b>.</p>'
          . '<p>Номера заявок: ' . h(implode(', ', $numbers)) . '.</p>';
    mail_queue($user['email'], $user['full_name'], 'Импорт учеников завершён — ' . $comp['name'], $html);
}

json_out(['ok' => true, 'created' => $created, 'numbers' => $numbers, 'errors' => $errors]);
