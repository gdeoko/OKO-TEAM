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
    "SELECT d.*, a.full_name, a.nomination, a.work_title, a.city, a.age_category,
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

json_out([
    'ok'      => true,
    'valid'   => true,
    'diploma' => [
        'number'       => $d['number'],
        'type'         => $d['type'],
        'result'       => $d['result'],
        'full_name'    => $d['full_name'],
        'nomination'   => $d['nomination'],
        'work_title'   => $d['work_title'],
        'city'         => $d['city'],
        'age_category' => $d['age_category'],
        'competition'  => $d['competition_name'],
        'lang'         => $d['lang'] ?? 'ru',
        'issued_at'    => $d['created_at'],
    ],
]);
