<?php
/**
 * POST загрузки видеорецензии члена жюри (30-60 сек, mp4) к заявке.
 * Проверяет формат/размер, сохраняет в public/uploads/reviews/, привязывает к диплому.
 * Поля формы: application_id, video (файл), _csrf.
 */
declare(strict_types=1);
require __DIR__ . '/_boot.php';
require_once BASE_PATH . '/core/jury.php';
require_post();

$u = current_user();
if (!$u) json_out(['ok' => false, 'error' => 'Требуется вход в аккаунт'], 401);
if (!user_can('jury')) json_out(['ok' => false, 'error' => 'Раздел доступен только жюри'], 403);
if (!csrf_check()) json_out(['ok' => false, 'error' => 'Сессия устарела. Обновите страницу и попробуйте снова'], 419);
if (!rate_ok('jury_video:' . $u['id'], 30, 3600)) {
    json_out(['ok' => false, 'error' => 'Слишком много запросов, попробуйте позже'], 429);
}

jury_ensure_schema();

$appId = (int) input('application_id');
$app = $appId ? one("SELECT * FROM applications WHERE id=?", [$appId]) : null;
if (!$app) json_out(['ok' => false, 'error' => 'Заявка не найдена'], 404);

// Модераторы/админ/владелец могут прикрепить видео к любой заявке.
// Обычный член жюри — только если назначен на заявку или уже её оценил.
if (!user_can('moderator')) {
    $assigned = one("SELECT id FROM jury_assignments WHERE application_id=? AND jury_id=?", [$appId, $u['id']]);
    $graded   = one("SELECT id FROM jury_grades WHERE application_id=? AND jury_id=?", [$appId, $u['id']]);
    if (!$assigned && !$graded) json_out(['ok' => false, 'error' => 'Вы не назначены на эту заявку'], 403);
}

if (empty($_FILES['video']) || ($_FILES['video']['error'] ?? UPLOAD_ERR_NO_FILE) !== UPLOAD_ERR_OK) {
    json_out(['ok' => false, 'error' => 'Видеофайл не загружен или повреждён'], 422);
}
$f = $_FILES['video'];
if (!is_uploaded_file($f['tmp_name'])) json_out(['ok' => false, 'error' => 'Ошибка загрузки файла'], 422);

$ext  = strtolower(pathinfo((string) $f['name'], PATHINFO_EXTENSION));
$mime = function_exists('mime_content_type') ? (string) mime_content_type($f['tmp_name']) : '';
$okExt  = $ext === 'mp4';
$okMime = $mime === '' || in_array($mime, ['video/mp4', 'application/mp4'], true);
if (!$okExt || !$okMime) json_out(['ok' => false, 'error' => 'Видеорецензия должна быть в формате mp4'], 422);

$size = (int) $f['size'];
$maxSize = 80 * 1024 * 1024; // с запасом для mp4 30-60 сек
if ($size > $maxSize) json_out(['ok' => false, 'error' => 'Файл слишком большой (максимум 80 МБ)'], 413);
if ($size < 10 * 1024) json_out(['ok' => false, 'error' => 'Файл слишком мал для видеорецензии'], 422);

// Необязательная проверка длительности (30-60 сек) через ffprobe, если он доступен на сервере.
$duration = null;
$ffprobe = trim((string) @shell_exec('command -v ffprobe 2>/dev/null'));
if ($ffprobe !== '') {
    $out = @shell_exec(
        escapeshellarg($ffprobe) . ' -v error -show_entries format=duration -of csv=p=0 '
        . escapeshellarg($f['tmp_name']) . ' 2>/dev/null'
    );
    if ($out !== null && is_numeric(trim((string) $out))) $duration = (float) trim((string) $out);
}
if ($duration !== null && ($duration < 15 || $duration > 90)) {
    json_out(['ok' => false, 'error' => 'Видеорецензия должна длиться примерно 30-60 секунд (получено: ' . round($duration) . ' сек)'], 422);
}

$dir = BASE_PATH . '/public/uploads/reviews/';
if (!is_dir($dir)) @mkdir($dir, 0775, true);
$name = 'review_' . $appId . '_' . (int) $u['id'] . '_' . substr(bin2hex(random_bytes(4)), 0, 8) . '.mp4';
if (!@move_uploaded_file($f['tmp_name'], $dir . $name)) {
    json_out(['ok' => false, 'error' => 'Не удалось сохранить видеофайл'], 500);
}
$rel = 'uploads/reviews/' . $name;

jury_video_save($appId, (int) $u['id'], $rel);

audit('jury_video_upload', 'application', $appId, ['jury_id' => (int) $u['id'], 'path' => $rel, 'duration' => $duration]);

json_out([
    'ok'      => true,
    'path'    => $rel,
    'url'     => url($rel),
    'message' => 'Видеорецензия сохранена и прикреплена к диплому участника',
]);
