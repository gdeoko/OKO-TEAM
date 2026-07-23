<?php
/**
 * Клуб постоянных участников КЦ «Музыкальный Мир» — членство и его выгоды.
 *
 * Оплата членства проходит через api/v1/order.php → ЮKassa (awards_orders,
 * competition = «Клуб постоянных участников»). Этот модуль отвечает ТОЛЬКО за
 * состояние членства: срок действия, продление и гейтинг привилегий (скидка 20%,
 * приоритетная модерация и т.п.). Начисление членства (club_grant) вызывается из
 * core/payments.php при переходе платежа в succeeded — подключается там отдельно.
 *
 * Своя таблица создаётся идемпотентно (club_boot), core/db.php не трогаем.
 * Файл НИЧЕГО не подключает и не выполняет при require — только определяет функции;
 * таблица заводится лениво при первом обращении к любой club_*-функции.
 */
declare(strict_types=1);

/** Идемпотентное создание таблицы членства. Лениво вызывается каждой club_*-функцией. */
function club_boot(): void {
    static $done = false;
    if ($done) return;
    $done = true;
    db()->exec("
    CREATE TABLE IF NOT EXISTS club_members (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL UNIQUE,        -- одно членство на пользователя
        started_at TEXT DEFAULT (datetime('now')), -- дата первого вступления
        expires_at TEXT,                        -- срок действия членства (UTC datetime)
        source TEXT DEFAULT 'payment',          -- payment|manual|import и т.п.
        active INTEGER DEFAULT 1,               -- админ-выключатель; срок проверяется отдельно
        created TEXT DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_club_user ON club_members(user_id);
    CREATE INDEX IF NOT EXISTS idx_club_exp  ON club_members(expires_at);
    ");
}

/**
 * Продлевает или создаёт членство пользователя на $months месяцев.
 * Если членство ещё действует — продлеваем ОТ текущего срока (expires_at),
 * иначе — от «сейчас». Идемпотентно по своей природе: один успешный платёж
 * = один вызов = +$months (payment_apply_status уже защищён от повторов).
 * Возвращает актуальный статус членства (см. club_status).
 */
function club_grant(int $userId, int $months = 1, string $source = 'payment'): array {
    club_boot();
    if ($userId <= 0) return club_status($userId);
    $months = max(1, min(120, $months));
    $source = mb_substr(trim($source) ?: 'payment', 0, 32);

    $exists = one("SELECT id FROM club_members WHERE user_id=?", [$userId]);
    if ($exists) {
        // Продление: от большего из (текущий срок, сейчас) — не «съедаем» оплаченный остаток.
        q(
            "UPDATE club_members
                SET expires_at = datetime(
                        CASE WHEN expires_at IS NOT NULL AND expires_at > datetime('now')
                             THEN expires_at ELSE datetime('now') END,
                        '+' || ? || ' months'),
                    active = 1,
                    source = ?
              WHERE user_id = ?",
            [$months, $source, $userId]
        );
    } else {
        q(
            "INSERT INTO club_members (user_id, started_at, expires_at, source, active)
             VALUES (?, datetime('now'), datetime('now', '+' || ? || ' months'), ?, 1)",
            [$userId, $months, $source]
        );
    }
    return club_status($userId);
}

/** Активно ли членство прямо сейчас (включено И срок не истёк). */
function club_is_active(int $userId): bool {
    club_boot();
    if ($userId <= 0) return false;
    $n = (int) scalar(
        "SELECT COUNT(*) FROM club_members
          WHERE user_id=? AND active=1 AND expires_at IS NOT NULL AND expires_at > datetime('now')",
        [$userId]
    );
    return $n > 0;
}

/**
 * Скидка члена Клуба, %. Действует только при активном членстве.
 * Размер настраивается через settings.club_discount (по умолчанию 20).
 */
function club_discount_percent(int $userId): int {
    if (!club_is_active($userId)) return 0;
    $pct = (int) setting('club_discount', '20');
    if ($pct <= 0) $pct = 20;
    return max(0, min(100, $pct));
}

/**
 * Статус членства для UI/логики.
 * @return array{active:bool, expires_at:?string, started_at:?string, source:?string, discount:int}
 */
function club_status(int $userId): array {
    club_boot();
    $out = ['active' => false, 'expires_at' => null, 'started_at' => null, 'source' => null, 'discount' => 0];
    if ($userId <= 0) return $out;
    $row = one("SELECT * FROM club_members WHERE user_id=?", [$userId]);
    if (!$row) return $out;
    $exp = $row['expires_at'] ?? null;
    $active = ((int) ($row['active'] ?? 0) === 1) && $exp !== null && strtotime((string) $exp) > time();
    $out['active']     = $active;
    $out['expires_at'] = $exp;
    $out['started_at'] = $row['started_at'] ?? null;
    $out['source']     = $row['source'] ?? null;
    $out['discount']   = $active ? club_discount_percent($userId) : 0;
    return $out;
}
