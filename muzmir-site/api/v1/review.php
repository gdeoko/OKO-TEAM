<?php
/** POST отзыва (требует авторизации) → reviews со статусом pending. */
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

$id = insert('reviews', [
    'user_id'        => $u['id'],
    'competition_id' => (int) input('competition_id', '0') ?: null,
    'author'         => $u['full_name'] ?: input('author'),
    'text'           => $text,
    'rating'         => $rating,
    'status'         => 'pending',
]);
audit('review', 'reviews', $id);

json_out(['ok' => true, 'id' => $id, 'message' => 'Спасибо! Отзыв отправлен на модерацию']);
