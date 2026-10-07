<?php
/* Выдача файлов архива передачи. Файлы лежат ВНЕ веб-корня, отдаются только
   с паролем. Путь проверяется на выход за пределы архива. */
declare(strict_types=1);

const ПАРОЛЬ = 'Klaster-2026-Peredacha';
const АРХИВ  = '/opt/oko-poster/peredacha/arhiv';

$ключ = isset($_GET['k']) ? (string)$_GET['k'] : (isset($_COOKIE['klp']) ? (string)$_COOKIE['klp'] : '');
if (!hash_equals(ПАРОЛЬ, $ключ)) {
    http_response_code(401);
    header('Content-Type: text/plain; charset=utf-8');
    echo 'Нужен пароль';
    exit;
}
setcookie('klp', ПАРОЛЬ, time() + 60 * 60 * 24 * 14, '/peredacha/', '', true, true);

$путь = isset($_GET['p']) ? (string)$_GET['p'] : '';
$полный = realpath(АРХИВ . '/' . $путь);
if ($полный === false || strpos($полный, realpath(АРХИВ)) !== 0 || !is_file($полный)) {
    http_response_code(404);
    header('Content-Type: text/plain; charset=utf-8');
    echo 'Файл не найден';
    exit;
}

$типы = ['jpg' => 'image/jpeg', 'jpeg' => 'image/jpeg', 'png' => 'image/png',
         'webp' => 'image/webp', 'gif' => 'image/gif', 'svg' => 'image/svg+xml',
         'mp4' => 'video/mp4', 'mov' => 'video/quicktime', 'ogg' => 'audio/ogg',
         'mp3' => 'audio/mpeg', 'pdf' => 'application/pdf', 'zip' => 'application/zip',
         'txt' => 'text/plain; charset=utf-8', 'md' => 'text/plain; charset=utf-8',
         'json' => 'application/json; charset=utf-8',
         'docx' => 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
         'xlsx' => 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
         'pptx' => 'application/vnd.openxmlformats-officedocument.presentationml.presentation'];
$расш = strtolower(pathinfo($полный, PATHINFO_EXTENSION));
header('Content-Type: ' . ($типы[$расш] ?? 'application/octet-stream'));
header('Content-Length: ' . filesize($полный));
header('X-Robots-Tag: noindex, nofollow');
header('Cache-Control: private, max-age=600');
if (isset($_GET['d'])) {
    header('Content-Disposition: attachment; filename="' . rawurlencode(basename($полный)) . '"');
}
readfile($полный);
