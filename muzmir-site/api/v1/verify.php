<?php
/** GET ?number= → данные диплома в JSON (проверка подлинности). */
declare(strict_types=1);
require __DIR__ . '/_boot.php';

$number = trim(input('number'));
if ($number === '') json_out(['ok' => false, 'error' => 'Укажите номер диплома'], 422);

if (!rate_ok('verify:' . client_ip(), 60, 3600)) {
    json_out(['ok' => false, 'error' => 'Слишком много запросов, попробуйте позже'], 429);
}

$d = one(
    "SELECT d.*, a.full_name, a.group_name, a.is_group, a.nomination, a.work_title,
            a.city, a.age_category, a.teacher,
            c.name AS competition_name
       FROM diplomas d
       LEFT JOIN applications a ON a.id = d.application_id
       LEFT JOIN competitions c ON c.id = a.competition_id
      WHERE d.number = ?",
    [$number]
);

if (tbl_exists('verify_log')) {
    insert('verify_log', ['diploma_number' => $number, 'ip' => client_ip()]);
}

if (!$d) {
    json_out(['ok' => true, 'valid' => false, 'message' => 'Диплом с таким номером не найден'], 404);
}

update('diplomas', ['verified_count' => (int) $d['verified_count'] + 1], 'id=:id', ['id' => $d['id']]);

// Отображаемое имя: для коллектива — название коллектива, иначе ФИО.
$recipient = ((int)($d['is_group'] ?? 0) === 1 && trim((string)($d['group_name'] ?? '')) !== '')
    ? (string) $d['group_name']
    : (string) ($d['full_name'] ?? '');

$typeLabels = ['main'=>'Диплом','named'=>'Именной диплом','extra'=>'Спец-награда','thanks'=>'Благодарность'];

json_out([
    'ok'      => true,
    'valid'   => true,
    'diploma' => [
        'number'       => $d['number'],
        'type'         => $d['type'],
        'type_label'   => $typeLabels[$d['type']] ?? 'Диплом',
        'result'       => $d['result'],
        'full_name'    => $recipient,
        'teacher'      => $d['teacher'] ?? '',
        'nomination'   => $d['nomination'],
        'work_title'   => $d['work_title'],
        'city'         => $d['city'],
        'age_category' => $d['age_category'],
        'competition'  => $d['competition_name'],
        'lang'         => $d['lang'] ?? 'ru',
        'issued_at'    => $d['created_at'],
    ],
]);
