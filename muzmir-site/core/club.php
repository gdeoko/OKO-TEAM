<?php
/**
 * Клуб постоянных участников Культурного центра «Музыкальный Мир» — членство и его выгоды.
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
    // Автопродление: период оплаты, флаг автосписания, идентификатор способа оплаты
    // ЮKassa (payment_method_id) — по нему списываем следующий период без участия
    // плательщика, и служебные метки последней/следующей попытки.
    foreach ([
        ['period',            "TEXT DEFAULT 'month'"],   // month|year
        ['auto_renew',        'INTEGER DEFAULT 1'],
        ['payment_method_id', "TEXT DEFAULT ''"],
        ['last_charge_at',    "TEXT DEFAULT ''"],
        ['next_charge_at',    "TEXT DEFAULT ''"],
        ['charge_fails',      'INTEGER DEFAULT 0'],
        ['cancelled_at',      "TEXT DEFAULT ''"],
    ] as [$col, $decl]) {
        try { db()->exec("ALTER TABLE club_members ADD COLUMN $col $decl"); } catch (\Throwable $e) { /* есть */ }
    }
}

/**
 * Продлевает или создаёт членство пользователя на $months месяцев.
 * Если членство ещё действует — продлеваем ОТ текущего срока (expires_at),
 * иначе — от «сейчас». Идемпотентно по своей природе: один успешный платёж
 * = один вызов = +$months (payment_apply_status уже защищён от повторов).
 * Возвращает актуальный статус членства (см. club_status).
 */
function club_grant(int $userId, int $months = 1, string $source = 'payment', array $opt = []): array {
    club_boot();
    if ($userId <= 0) return club_status($userId);
    $months = max(1, min(120, $months));
    $source = mb_substr(trim($source) ?: 'payment', 0, 32);
    // Период списания и способ оплаты для автопродления (передаёт core/payments.php).
    $period = ($opt['period'] ?? ($months >= 12 ? 'year' : 'month')) === 'year' ? 'year' : 'month';
    $pmId   = mb_substr((string) ($opt['payment_method_id'] ?? ''), 0, 80);

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
    // Настройки автопродления: следующее списание — в день окончания оплаченного срока.
    $upd = ['period' => $period, 'auto_renew' => 1, 'charge_fails' => 0, 'cancelled_at' => '',
            'last_charge_at' => date('Y-m-d H:i:s')];
    if ($pmId !== '') $upd['payment_method_id'] = $pmId;
    update('club_members', $upd, 'user_id=:uid', ['uid' => $userId]);
    q("UPDATE club_members SET next_charge_at = COALESCE(expires_at,'') WHERE user_id=?", [$userId]);

    return club_status($userId);
}

/**
 * Отключает автопродление (участник отказался). Членство доживает оплаченный срок,
 * после чего привилегии снимаются автоматически — club_is_active вернёт false.
 */
function club_cancel_auto_renew(int $userId): bool {
    club_boot();
    if ($userId <= 0) return false;
    update('club_members', ['auto_renew' => 0, 'cancelled_at' => date('Y-m-d H:i:s')],
           'user_id=:uid', ['uid' => $userId]);
    return true;
}

/** Членства, у которых подошёл срок списания (для cron/club_billing.php). */
function club_due_for_charge(int $limit = 50): array {
    club_boot();
    return all(
        "SELECT m.*, u.email, u.full_name
           FROM club_members m JOIN users u ON u.id = m.user_id
          WHERE m.active = 1 AND COALESCE(m.auto_renew,0) = 1
            AND COALESCE(m.charge_fails,0) < 3
            AND m.expires_at IS NOT NULL AND m.expires_at <= datetime('now')
          ORDER BY m.expires_at ASC LIMIT ?", [$limit]
    );
}

/** Членства, срок которых истёк и продлевать не будем — привилегии уже не действуют. */
function club_expired(int $limit = 100): array {
    club_boot();
    return all(
        "SELECT m.*, u.email, u.full_name
           FROM club_members m JOIN users u ON u.id = m.user_id
          WHERE m.active = 1
            AND m.expires_at IS NOT NULL AND m.expires_at <= datetime('now')
            AND (COALESCE(m.auto_renew,0) = 0 OR COALESCE(m.charge_fails,0) >= 3)
          ORDER BY m.expires_at ASC LIMIT ?", [$limit]
    );
}

/* ==================== КОМАНДА ЦЕНТРА: БЕЗЛИМИТНЫЙ ДОСТУП ====================
 * Владелец и оргкомитет пользуются всеми привилегиями клуба постоянно: подписка
 * им не продаётся, не истекает и не списывается. Опознаём по роли и по почте —
 * почта надёжнее, если роль в базе ещё не проставлена.
 */

/** Почты команды центра (безлимитный ВИП, синяя галочка). */
function club_staff_emails(): array {
    $extra = array_filter(array_map('trim', explode(',', (string) (function_exists('setting') ? setting('club_staff_emails', '') : ''))));
    return array_values(array_unique(array_map('mb_strtolower', array_merge([
        'okoteam.top@gmail.com',   // оргкомитет
        'zamis76@mail.ru',         // владелец, генеральный директор Ильясов А.И.
    ], $extra))));
}

/** Относится ли адрес к команде центра. */
function club_is_staff_email(string $email): bool {
    $email = mb_strtolower(trim($email));
    return $email !== '' && in_array($email, club_staff_emails(), true);
}

/** Относится ли пользователь к команде центра (по роли или по почте). */
function club_is_staff(int $userId): bool {
    if ($userId <= 0) return false;
    $u = one("SELECT email, role FROM users WHERE id=?", [$userId]);
    if (!$u) return false;
    if (in_array((string) ($u['role'] ?? ''), ['owner', 'admin', 'orgcom'], true)) return true;
    return club_is_staff_email((string) ($u['email'] ?? ''));
}

/**
 * Активны ли привилегии клуба прямо сейчас.
 * Для команды центра — всегда да (безлимит), для участников — пока действует оплата.
 */
function club_is_active(int $userId): bool {
    club_boot();
    if ($userId <= 0) return false;
    if (club_is_staff($userId)) return true;          // безлимитная подписка команды
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
    $out = ['active' => false, 'expires_at' => null, 'started_at' => null, 'source' => null,
            'discount' => 0, 'staff' => false, 'auto_renew' => false, 'period' => ''];
    if ($userId <= 0) return $out;
    // Команда центра: привилегии без срока и без списаний.
    if (club_is_staff($userId)) {
        return ['active' => true, 'expires_at' => null, 'started_at' => null, 'source' => 'staff',
                'discount' => club_discount_percent($userId), 'staff' => true,
                'auto_renew' => false, 'period' => 'unlimited'];
    }
    $row = one("SELECT * FROM club_members WHERE user_id=?", [$userId]);
    if (!$row) return $out;
    $out['auto_renew'] = (int) ($row['auto_renew'] ?? 0) === 1;
    $out['period']     = (string) ($row['period'] ?? 'month');
    $exp = $row['expires_at'] ?? null;
    $active = ((int) ($row['active'] ?? 0) === 1) && $exp !== null && strtotime((string) $exp) > time();
    $out['active']     = $active;
    $out['expires_at'] = $exp;
    $out['started_at'] = $row['started_at'] ?? null;
    $out['source']     = $row['source'] ?? null;
    $out['discount']   = $active ? club_discount_percent($userId) : 0;
    return $out;
}
