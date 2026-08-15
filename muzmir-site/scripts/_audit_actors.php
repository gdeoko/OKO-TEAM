<?php
/**
 * ВРЕМЕННЫЕ УЧЁТНЫЕ ЗАПИСИ ДЛЯ ПРОВЕРОК.
 *
 * Проверки писались под местный отладочный сервер с заранее заведёнными
 * admin@test.local и user@test.local. На боевом сервере их нет, и весь блок
 * проверок молча превращался в «пропуск»: отчёт выглядел спокойным, не проверив
 * ничего. Здесь заводятся временные участник и администратор, живущие ровно
 * столько, сколько идёт проверка, и удаляемые даже при падении.
 *
 * Настоящие учётные записи не трогаются, пароли нигде не сохраняются.
 */
declare(strict_types=1);

if (!function_exists('audit_actor')) {

/**
 * Подбираем хвосты прошлых прогонов.
 *
 * Уборка в конце работы срабатывает не всегда: если вывод проверки прогнали
 * через `head`, процесс умирает по SIGPIPE, и до неё дело не доходит. Поэтому
 * при старте сносим временные записи старше часа — свежие трогать нельзя, рядом
 * может идти другой прогон.
 */
function audit_actor_sweep(): void {
    static $done = false;
    if ($done) return;
    $done = true;
    try {
        $old = all("SELECT id FROM users
                     WHERE email LIKE 'audit-%@example.test'
                       AND created_at < datetime('now','-1 hour')");
        foreach ($old as $u) {
            $id = (int) $u['id'];
            q("DELETE FROM diplomas WHERE application_id IN (SELECT id FROM applications WHERE user_id=?)", [$id]);
            q("DELETE FROM applications WHERE user_id=?", [$id]);
            q("DELETE FROM sessions WHERE user_id=?", [$id]);
            q("DELETE FROM users WHERE id=?", [$id]);
        }
    } catch (\Throwable $e) { /* уборка не должна ронять проверку */ }
}

/** Список того, что нужно убрать за собой. */
function audit_actor_registry(): array {
    static $reg = ['users' => [], 'apps' => []];
    return $reg;
}

/**
 * Заводит временного пользователя с нужной ролью и возвращает
 * ['id'=>…, 'email'=>…, 'password'=>…].
 */
function audit_actor(string $role = 'user'): array {
    static $made = [];
    if (isset($made[$role])) return $made[$role];
    audit_actor_sweep();

    $mail = 'audit-' . $role . '-' . bin2hex(random_bytes(4)) . '@example.test';
    $pass = 'Aud-' . bin2hex(random_bytes(5));
    $id = (int) insert('users', [
        'email' => $mail, 'password_hash' => password_hash($pass, PASSWORD_DEFAULT),
        'full_name' => $role === 'user' ? 'Проверка Участник' : 'Проверка Админ',
        'role' => $role, 'email_verified' => 1,
    ]);
    $GLOBALS['__audit_users'][] = $id;
    $made[$role] = ['id' => $id, 'email' => $mail, 'password' => $pass];
    return $made[$role];
}

/** Заводит временную заявку этого участника на первый открытый конкурс. */
function audit_actor_app(int $uid, array $over = []): int {
    $comp = one("SELECT id FROM competitions WHERE status='open' ORDER BY sort LIMIT 1");
    if (!$comp) return 0;
    $id = (int) insert('applications', array_merge([
        'number' => 'AUDIT-' . date('Y') . '-' . random_int(10000, 99999),
        'competition_id' => (int) $comp['id'], 'user_id' => $uid,
        'full_name' => 'Проверка Участник', 'is_group' => 0,
        'nomination' => '', 'work_title' => '«Проба пера»', 'teacher' => '',
        'institution' => '', 'city' => 'Россия, г. Москва',
        'email' => (string) (scalar("SELECT email FROM users WHERE id=?", [$uid]) ?? ''),
        'phone' => '+79000000000', 'video_url' => 'https://rutube.ru/video/audit/',
        'status' => 'new', 'is_paid' => 1, 'created_at' => date('Y-m-d H:i:s'),
    ], $over));
    $GLOBALS['__audit_apps'][] = $id;
    return $id;
}

// Уборка при любом исходе: и при успехе, и при падении с ошибкой.
register_shutdown_function(static function (): void {
    foreach ($GLOBALS['__audit_apps'] ?? [] as $a) {
        try { q("DELETE FROM diplomas WHERE application_id=?", [(int) $a]); } catch (\Throwable $e) {}
        try { q("DELETE FROM applications WHERE id=?", [(int) $a]); } catch (\Throwable $e) {}
    }
    foreach ($GLOBALS['__audit_users'] ?? [] as $u) {
        try { q("DELETE FROM sessions WHERE user_id=?", [(int) $u]); } catch (\Throwable $e) {}
        try { q("DELETE FROM users WHERE id=?", [(int) $u]); } catch (\Throwable $e) {}
    }
});

}
