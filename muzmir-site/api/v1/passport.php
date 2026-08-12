<?php
/**
 * GET /api/v1/passport
 * Отдаёт «Паспорт участника» — все дипломы текущего пользователя одним PDF
 * (Content-Disposition: attachment; filename=passport.pdf).
 * Требует залогиненного пользователя. Rate-limit как в остальных эндпоинтах.
 */
declare(strict_types=1);
require __DIR__ . '/_boot.php';
require_once BASE_PATH . '/core/passport.php';

// Только авторизованный участник.
$user = current_user();
if (!$user) {
    json_out(['ok' => false, 'error' => 'Требуется вход в личный кабинет'], 401);
}
$uid = (int)$user['id'];

// Rate-limit: не чаще 10 сборок за 10 минут на пользователя (генерация тяжёлая).
if (!rate_ok('passport:' . $uid, 10, 600)) {
    json_out(['ok' => false, 'error' => 'Слишком много запросов, попробуйте позже'], 429);
}

$path = passport_pdf($uid);
if ($path === '' || !is_file($path)) {
    json_out(['ok' => false, 'error' => 'У Вас пока нет дипломов для паспорта'], 404);
}

// Отдаём файл на скачивание и убираем временный PDF.
$size = (int)@filesize($path);
if (function_exists('header_remove')) header_remove('Content-Type');
header('Content-Type: application/pdf');
header('Content-Disposition: attachment; filename="passport.pdf"');
header('Content-Transfer-Encoding: binary');
header('Cache-Control: private, no-store, no-cache, must-revalidate');
header('Pragma: no-cache');
if ($size > 0) header('Content-Length: ' . $size);

readfile($path);
@unlink($path);
exit;
