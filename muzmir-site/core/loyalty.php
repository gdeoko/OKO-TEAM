<?php
/**
 * Программа лояльности и реферальная система КЦ «Музыкальный Мир».
 *
 * Лояльность: скидка за число завершённых/оплаченных участий (по email или user_id).
 *   5 и более участий - 10%, 10 и более - 15%, 20 и более - 20%.
 * Рефералы: промокод педагога даёт участнику дополнительную скидку
 *   и начисляет педагогу вознаграждение при оплате по его коду.
 *
 * Свои таблицы создаются идемпотентно здесь, core/db.php не трогаем.
 */
declare(strict_types=1);

/** Идемпотентное создание таблиц реферальной системы. Вызывается при подключении файла. */
function loyalty_boot(): void {
    static $done = false;
    if ($done) return;
    $done = true;
    db()->exec("
    CREATE TABLE IF NOT EXISTS referrals (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        code TEXT UNIQUE NOT NULL,
        teacher_user_id INTEGER NOT NULL,
        percent INTEGER DEFAULT 5,          -- доп. скидка участнику, %
        reward_percent INTEGER DEFAULT 10,  -- вознаграждение педагогу от суммы оплаты, %
        uses INTEGER DEFAULT 0,             -- число оплаченных применений
        active INTEGER DEFAULT 1,
        note TEXT DEFAULT '',
        created TEXT DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS promo_uses (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        referral_id INTEGER NOT NULL,
        code TEXT DEFAULT '',
        application_id INTEGER,
        user_id INTEGER,                    -- участник (если авторизован)
        email TEXT DEFAULT '',
        amount INTEGER DEFAULT 0,           -- сумма к оплате со скидкой, руб.
        reward INTEGER DEFAULT 0,           -- начислено педагогу, руб.
        status TEXT DEFAULT 'pending',      -- pending|paid
        created TEXT DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_ref_teacher ON referrals(teacher_user_id);
    CREATE INDEX IF NOT EXISTS idx_promo_ref ON promo_uses(referral_id);
    CREATE INDEX IF NOT EXISTS idx_promo_app ON promo_uses(application_id);
    ");
}

/**
 * Скидка лояльности по числу завершённых/оплаченных участий.
 * Считаем заявки, привязанные к email ИЛИ user_id, которые уже оплачены
 * или дошли до судейства/итога (то есть состоявшиеся участия).
 */
function loyalty_discount(?int $userId, string $email): int {
    $email = mb_strtolower(trim($email));
    if ($email === '' && !$userId) return 0;
    $done = "(is_paid=1 OR status IN ('paid','judging','graded','sent'))";
    $n = (int) scalar(
        "SELECT COUNT(*) FROM applications
         WHERE $done AND ( (email!='' AND email=?) OR (user_id IS NOT NULL AND user_id=?) )",
        [$email, $userId ?? 0]
    );
    if ($n >= 20) return 20;
    if ($n >= 10) return 15;
    if ($n >= 5)  return 10;
    return 0;
}

/** Цена после применения скидки в процентах (округление до рубля, не ниже нуля). */
function loyalty_apply(int $price, int $pct): int {
    if ($price <= 0) return 0;
    $pct = max(0, min(100, $pct));
    return (int) max(0, round($price * (100 - $pct) / 100));
}

/** Поиск активного реферального промокода. Возвращает строку referrals или null. */
function referral_lookup(string $code): ?array {
    loyalty_boot();
    $code = strtoupper(preg_replace('/[^A-Z0-9]/', '', strtoupper(trim($code))));
    if ($code === '') return null;
    return one("SELECT * FROM referrals WHERE code=? AND active=1", [$code]);
}

/**
 * Регистрация ОЖИДАЮЩЕГО применения промокода педагога при подаче заявки.
 * Пишет строку promo_uses со status='pending'. Счётчик применений (referrals.uses)
 * и подтверждение вознаграждения выполняются ТОЛЬКО при успешной оплате —
 * см. referral_confirm_payment(), вызываемый из core/payments.php при succeeded.
 * $amount - итоговая сумма к оплате (со скидками). Возвращает расчётное вознаграждение, руб.
 */
function referral_record_use(array $ref, ?int $applicationId, ?int $userId, string $email, int $amount): int {
    loyalty_boot();
    $reward = (int) max(0, round($amount * ((int) ($ref['reward_percent'] ?? 0)) / 100));
    insert('promo_uses', [
        'referral_id'    => (int) $ref['id'],
        'code'           => $ref['code'] ?? '',
        'application_id' => $applicationId,
        'user_id'        => $userId,
        'email'          => mb_strtolower(trim($email)),
        'amount'         => $amount,
        'reward'         => $reward,
        'status'         => 'pending',
    ]);
    // ВНИМАНИЕ: uses НЕ инкрементируем здесь — только при оплате (referral_confirm_payment).
    return $reward;
}

/**
 * Подтверждение реферального вознаграждения при УСПЕШНОЙ ОПЛАТЕ заявки.
 * Переводит ожидающие строки promo_uses (по application_id) в status='paid'
 * и увеличивает счётчик оплаченных применений referrals.uses. Идемпотентна:
 * повторный вызов не найдёт pending-строк и ничего не сделает.
 * Возвращает суммарно подтверждённое вознаграждение, руб.
 */
function referral_confirm_payment(?int $applicationId): int {
    loyalty_boot();
    if (!$applicationId) return 0;
    $rows = all("SELECT * FROM promo_uses WHERE application_id=? AND status='pending'", [(int) $applicationId]);
    $total = 0;
    foreach ($rows as $r) {
        update('promo_uses', ['status' => 'paid'], 'id=:id', ['id' => (int) $r['id']]);
        q("UPDATE referrals SET uses = uses + 1 WHERE id=?", [(int) $r['referral_id']]);
        $total += (int) $r['reward'];
    }
    return $total;
}

/** Создание промокода педагога. Возвращает строку referrals. */
function referral_create(int $teacherId, string $wantCode = '', int $percent = 5, int $rewardPercent = 10, string $note = ''): array {
    loyalty_boot();
    $percent = max(0, min(20, $percent));
    $rewardPercent = max(0, min(20, $rewardPercent));
    $code = strtoupper(preg_replace('/[^A-Z0-9]/', '', strtoupper(trim($wantCode))));
    if (mb_strlen($code) < 4 || mb_strlen($code) > 16 || one("SELECT id FROM referrals WHERE code=?", [$code])) {
        $code = referral_gen_code();
    }
    $id = insert('referrals', [
        'code'           => $code,
        'teacher_user_id' => $teacherId,
        'percent'        => $percent,
        'reward_percent' => $rewardPercent,
        'note'           => mb_substr($note, 0, 120),
    ]);
    return one("SELECT * FROM referrals WHERE id=?", [$id]) ?? ['id' => $id, 'code' => $code];
}

/** Генерация свободного кода вида ABCD1234. */
function referral_gen_code(): string {
    $alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    for ($t = 0; $t < 12; $t++) {
        $code = '';
        for ($i = 0; $i < 7; $i++) $code .= $alphabet[random_int(0, strlen($alphabet) - 1)];
        if (!one("SELECT id FROM referrals WHERE code=?", [$code])) return $code;
    }
    return 'R' . strtoupper(bin2hex(random_bytes(3)));
}

/** Сводка по кодам педагога: применения и сумма начислений. */
function referral_stats(int $teacherId): array {
    loyalty_boot();
    $codes = all("SELECT * FROM referrals WHERE teacher_user_id=? ORDER BY created DESC", [$teacherId]);
    $out = [];
    foreach ($codes as $r) {
        // Считаем ТОЛЬКО оплаченные применения — педагог видит подтверждённые начисления.
        $agg = one(
            "SELECT COUNT(*) c, COALESCE(SUM(reward),0) reward, COALESCE(SUM(amount),0) amount
             FROM promo_uses WHERE referral_id=? AND status='paid'",
            [(int) $r['id']]
        ) ?: ['c' => 0, 'reward' => 0, 'amount' => 0];
        $out[] = [
            'code'           => $r['code'],
            'percent'        => (int) $r['percent'],
            'reward_percent' => (int) $r['reward_percent'],
            'active'         => (int) $r['active'],
            'uses'           => (int) $agg['c'],
            'reward_total'   => (int) $agg['reward'],
            'amount_total'   => (int) $agg['amount'],
            'created'        => $r['created'] ?? '',
        ];
    }
    return $out;
}

loyalty_boot();
