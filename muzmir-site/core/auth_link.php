<?php
/**
 * ССЫЛКА ИЗ ПИСЬМА ОТКРЫВАЕТ КАБИНЕТ СРАЗУ.
 *
 * Письмо с результатом зовёт «открыть личный кабинет», но ведёт на форму входа.
 * Пароль человек либо не заводил вовсе (заявку подавали за него), либо забыл: по
 * базе видно, что у части участников last_login пустой — они не заходили ни разу.
 * Дальше начинается то, ради чего этой ссылки и не хватало: заказ наград требует
 * заявку, гость её номера не помнит, форма отвечает отказом, человек уходит.
 *
 * Здесь одноразовый ключ, который кладётся в ссылки писем: перешёл — вошёл, и
 * сразу видишь свои заявки, результаты и кнопку заказа наград.
 *
 * ЧЕМ ЭТО ОГРАНИЧЕНО:
 *   • ключ живёт 60 дней — ровно окно заказа наград плюс запас на «прочитаю
 *     позже»; дальше он мёртв, а письмо остаётся в почте навсегда;
 *   • ключ длинный и случайный (32 байта), подобрать нельзя;
 *   • ключ привязан к одному человеку и даёт ровно его кабинет;
 *   • перехода по ключу достаточно для входа, но не для смены пароля и не для
 *     удаления учётной записи — это по-прежнему требует пароля.
 *
 * Так работают все почтовые «войти по ссылке»: письмо и так лежит в личном ящике
 * человека, и тот, кто его прочёл, и есть владелец адреса.
 */
declare(strict_types=1);

/** Мягкая миграция таблицы ключей. */
function auth_link_migrate(): void {
    static $done = false;
    if ($done) return;
    $done = true;
    try {
        db()->exec("CREATE TABLE IF NOT EXISTS login_links (
            token      TEXT PRIMARY KEY,
            user_id    INTEGER NOT NULL,
            expires_at TEXT NOT NULL,
            used_at    TEXT DEFAULT '',
            created_at TEXT DEFAULT (datetime('now','localtime')))");
        db()->exec("CREATE INDEX IF NOT EXISTS idx_login_links_user ON login_links(user_id)");
    } catch (\Throwable $e) { /* уже есть */ }
}

/**
 * Ключ входа для пользователя. Пустая строка — пользователя нет.
 *
 * Ключ переиспользуется, пока жив: письмо о результате, напоминание о заказе и
 * письмо с наградными материалами приходят в разные дни, и плодить на каждое
 * свой ключ незачем.
 */
function auth_link_token(int $uid): string {
    if ($uid <= 0) return '';
    auth_link_migrate();
    try {
        $r = one("SELECT token FROM login_links
                   WHERE user_id=? AND datetime(expires_at) > datetime('now','localtime')
                   ORDER BY created_at DESC LIMIT 1", [$uid]);
        if ($r && trim((string) $r['token']) !== '') return (string) $r['token'];
        $token = bin2hex(random_bytes(24));
        insert('login_links', [
            'token'      => $token,
            'user_id'    => $uid,
            'expires_at' => date('Y-m-d H:i:s', time() + 60 * 86400),
        ]);
        return $token;
    } catch (\Throwable $e) { return ''; }
}

/**
 * Адрес с ключом входа: /cabinet?k=… Без пользователя возвращает обычный адрес,
 * поэтому вызывающему коду не нужно ничего проверять.
 */
function auth_link_url(string $path, ?int $uid): string {
    $url = function_exists('url') ? url($path) : $path;
    $uid = (int) $uid;
    if ($uid <= 0) return $url;
    $token = auth_link_token($uid);
    if ($token === '') return $url;
    return $url . (str_contains($url, '?') ? '&' : '?') . 'k=' . $token;
}

/**
 * Вход по ключу из ссылки. Возвращает id пользователя или 0.
 *
 * Уже вошедшего не трогаем: человек мог открыть старое письмо, сидя в своём
 * кабинете, и переключать его на другую учётную запись мы не вправе.
 */
function auth_link_consume(string $token): int {
    $token = trim($token);
    if ($token === '' || !preg_match('~^[a-f0-9]{32,64}$~', $token)) return 0;
    auth_link_migrate();
    try {
        $r = one("SELECT user_id, expires_at FROM login_links WHERE token=?", [$token]);
        if (!$r) return 0;
        if (strtotime((string) $r['expires_at']) < time()) return 0;
        $uid = (int) $r['user_id'];
        $u = one("SELECT id, blocked FROM users WHERE id=?", [$uid]);
        if (!$u || (int) ($u['blocked'] ?? 0) === 1) return 0;
        try { q("UPDATE login_links SET used_at=? WHERE token=?", [date('Y-m-d H:i:s'), $token]); } catch (\Throwable $e) {}
        return $uid;
    } catch (\Throwable $e) { return 0; }
}
