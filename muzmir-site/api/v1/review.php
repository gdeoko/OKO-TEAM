<?php
/** POST отзыва (требует авторизации) → reviews (pending). Поддержка вложений (фото/видео)
 *  и авто-ответ Оргкомитета по смыслу отзыва (Gemini/Claude → фолбэк). */
declare(strict_types=1);
require __DIR__ . '/_boot.php';
require_post();

// --- Защита от CSRF: строгий same-origin + токен формы (_csrf) ---
if (!auth_origin_ok() || !csrf_check()) {
    json_out(['ok' => false, 'error' => 'Недопустимый источник запроса'], 403);
}

$u = current_user();
if (!$u) json_out(['ok' => false, 'error' => 'Требуется вход в личный кабинет'], 401);

if (!rate_ok('review:' . $u['id'], 5, 86400)) {
    json_out(['ok' => false, 'error' => 'Слишком часто, попробуйте позже'], 429);
}

$text = normalize_text(input('text'));
if (mb_strlen($text) < 5) json_out(['ok' => false, 'error' => 'Отзыв слишком короткий'], 422);

$rating = max(1, min(5, (int) input('rating', '5')));

// Мягко добавляем колонку вложений (JSON-массив путей) — схему БД не ломаем.
try { db()->exec("ALTER TABLE reviews ADD COLUMN attachments TEXT DEFAULT ''"); } catch (\Throwable $e) {}

// --- Вложения: фото дипломов и видео (по необходимости), до 5 файлов ---
$attachments = [];
if (!empty($_FILES['files']) && is_array($_FILES['files']['name'])) {
    $dir = BASE_PATH . '/public/uploads/reviews/';
    if (!is_dir($dir)) @mkdir($dir, 0775, true);
    $imgExt = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'heic', 'heif'];
    $vidExt = ['mp4', 'mov', 'webm', 'm4v', '3gp'];
    $cnt = count($_FILES['files']['name']);
    for ($i = 0; $i < $cnt && count($attachments) < 5; $i++) {
        if (($_FILES['files']['error'][$i] ?? UPLOAD_ERR_NO_FILE) !== UPLOAD_ERR_OK) continue;
        $tmp = $_FILES['files']['tmp_name'][$i];
        if (!is_uploaded_file($tmp)) continue;
        if ((int) ($_FILES['files']['size'][$i] ?? 0) > 25 * 1024 * 1024) continue; // до 25 МБ
        $ext = strtolower(pathinfo((string) $_FILES['files']['name'][$i], PATHINFO_EXTENSION));
        $kind = in_array($ext, $imgExt, true) ? 'image' : (in_array($ext, $vidExt, true) ? 'video' : '');
        if ($kind === '') continue;
        $mime = function_exists('mime_content_type') ? (string) @mime_content_type($tmp) : '';
        if ($mime !== '' && !preg_match('~^(image|video)/~', $mime)) continue;
        $name = 'rev_' . date('Ymd') . '_' . bin2hex(random_bytes(6)) . '.' . $ext;
        if (@move_uploaded_file($tmp, $dir . $name)) {
            $attachments[] = ['url' => 'uploads/reviews/' . $name, 'kind' => $kind];
        }
    }
}

$author = $u['full_name'] ?: input('author');

// --- Осмысленный авто-ответ Оргкомитета по содержанию отзыва (не шаблон) ---
$reply = '';
if (is_file(BASE_PATH . '/core/review_reply.php')) {
    require_once BASE_PATH . '/core/review_reply.php';
    try { $reply = review_org_reply($text, (string) $author, $rating); } catch (\Throwable $e) { $reply = ''; }
}

$id = insert('reviews', [
    'user_id'        => $u['id'],
    'competition_id' => (int) input('competition_id', '0') ?: null,
    'author'         => $author,
    'text'           => $text,
    'rating'         => $rating,
    'status'         => 'pending',
    'admin_reply'    => $reply,
    'attachments'    => $attachments ? json_encode($attachments, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES) : '',
]);
audit('review', 'reviews', $id, ['attachments' => count($attachments), 'auto_reply' => $reply !== '']);

json_out(['ok' => true, 'id' => $id, 'attachments' => count($attachments),
          'message' => 'Спасибо! Отзыв отправлен на модерацию' . ($attachments ? ' вместе с вложениями.' : '.')]);
