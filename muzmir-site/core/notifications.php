<?php
/**
 * In-app уведомления пользователей — простой хранилище + счётчик непрочитанных.
 * Таблица notifications(id, user_id, title, body, url, icon, is_read, created_at).
 */
declare(strict_types=1);

/** Создаёт запись уведомления для пользователя. Возвращает id или 0 если не удалось. */
function notify_user(int $userId, string $title, string $body = '', string $url = '', string $icon = 'bell'): int {
    if ($userId <= 0 || $title === '') return 0;
    if (!function_exists('tbl_exists') || !tbl_exists('notifications')) return 0;
    try {
        return (int) insert('notifications', [
            'user_id' => $userId,
            'title'   => $title,
            'body'    => $body,
            'url'     => $url,
            'icon'    => $icon,
        ]);
    } catch (\Throwable $e) { return 0; }
}

/** Количество непрочитанных уведомлений пользователя. Кэш в статике на запрос. */
function notify_unread_count(int $userId): int {
    static $cache = [];
    if ($userId <= 0) return 0;
    if (isset($cache[$userId])) return $cache[$userId];
    if (!function_exists('tbl_exists') || !tbl_exists('notifications')) return $cache[$userId] = 0;
    try {
        $n = (int) scalar("SELECT COUNT(*) FROM notifications WHERE user_id=? AND is_read=0", [$userId]);
    } catch (\Throwable $e) { $n = 0; }
    return $cache[$userId] = $n;
}

/** Последние N уведомлений пользователя. */
function notify_list(int $userId, int $limit = 50): array {
    if ($userId <= 0 || !function_exists('tbl_exists') || !tbl_exists('notifications')) return [];
    return all("SELECT * FROM notifications WHERE user_id=? ORDER BY created_at DESC LIMIT " . max(1,min(200,$limit)), [$userId]);
}

/** Пометить все уведомления пользователя прочитанными. */
function notify_mark_read_all(int $userId): int {
    if ($userId <= 0 || !function_exists('tbl_exists') || !tbl_exists('notifications')) return 0;
    return q("UPDATE notifications SET is_read=1 WHERE user_id=? AND is_read=0", [$userId])->rowCount();
}

/**
 * Любое письмо пользователю дублируется в приложение как уведомление «от чат-бота».
 * Находит пользователя по e-mail; если это не зарегистрированный пользователь — тихо 0.
 * Транзиентные письма-коды (вход/пароль/подтверждение) в приложение НЕ кладём.
 */
function notify_from_email(string $toEmail, string $subject, string $html = '', array $ctx = []): int {
    $toEmail = trim(mb_strtolower($toEmail));
    $subject = trim($subject);
    if ($toEmail === '' || $subject === '') return 0;
    if (!function_exists('tbl_exists') || !tbl_exists('notifications')) return 0;
    // Пропускаем одноразовые коды/сброс пароля — в приложении бессмысленны.
    if (preg_match('~код подтвержд|ваш код|код для вход|подтверждение вход|сброс пароля|восстановлен\w* пароля|one[- ]?time|verification code~ui', $subject)) return 0;
    try {
        $u = one("SELECT id FROM users WHERE lower(email)=? LIMIT 1", [$toEmail]);
    } catch (\Throwable $e) { return 0; }
    if (!$u) return 0;

    // Иконка по смыслу темы письма.
    $icon = 'bell';
    if     (preg_match('~оплат|платеж|к оплате|ждёт оплаты|счёт|счет~ui', $subject)) $icon = 'pay';
    elseif (preg_match('~диплом|благодарн~ui', $subject))                             $icon = 'diploma';
    elseif (preg_match('~результат|принят|лауреат|награ~ui', $subject))               $icon = 'trophy';
    elseif (preg_match('~вип|vip|клуб~ui', $subject))                                 $icon = 'star';

    $body = trim((string)($ctx['body'] ?? ''));
    $url  = (string)($ctx['url'] ?? '/cabinet');
    return notify_user((int) $u['id'], $subject, $body, $url, $icon);
}

/** Пометить одно уведомление прочитанным (только своё). */
function notify_mark_read(int $userId, int $id): bool {
    if ($userId <= 0 || $id <= 0) return false;
    return q("UPDATE notifications SET is_read=1 WHERE id=? AND user_id=?", [$id, $userId])->rowCount() > 0;
}
