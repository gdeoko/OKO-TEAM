<?php
/**
 * Программа лояльности и реферальная система Культурного центра «Музыкальный Мир».
 *
 * ПРАВИЛА (Даниэль, август 2026) — жёсткие потолки:
 *   • Достижения (лояльность): максимум 5%. Считаются ТОЛЬКО за текущий сезон —
 *     сезон = календарный год, 1 января достижения обнуляются и копятся заново.
 *   • Реферальная программа: 5% приглашённому + 5% пригласившему = 10% общих, не 15%.
 *   • Промокод срабатывает ОДИН раз на участника: либо на одну заявку на участие,
 *     либо на один заказ наградного материала.
 *   • За каждое подтверждённое (оплаченное) применение промокода владельцу кода
 *     начисляется ОДНА одноразовая скидка 5% (referral_credits) — не деньги.
 *   • Суммарная скидка на аккаунт БЕЗ ВИП-клуба — не больше 10%.
 *     С клубом: клубная скидка + до 5% реферальных.
 *
 * Свои таблицы создаются идемпотентно здесь, core/db.php не трогаем.
 */
declare(strict_types=1);

/** Потолок скидки за достижения (лояльность), %. */
const LOYALTY_MAX_PCT = 5;
/** Потолок реферальной скидки участнику, %. */
const REFERRAL_MAX_PCT = 5;
/** Потолок разовой скидки владельцу промокода, %. */
const REFERRAL_REWARD_MAX_PCT = 5;
/** Суммарный потолок скидки на аккаунт без ВИП-клуба, %. */
const DISCOUNT_CAP_NO_CLUB = 10;

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

    -- Одноразовые скидки 5% владельцу промокода: по одной за каждое оплаченное
    -- применение его кода. Тратится на ближайшую оплату (заявка или награды).
    CREATE TABLE IF NOT EXISTS referral_credits (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,           -- владелец промокода (кому положена скидка)
        referral_id INTEGER,
        promo_use_id INTEGER,               -- за какое применение начислено (антидубль)
        percent INTEGER DEFAULT 5,
        status TEXT DEFAULT 'available',    -- available|used
        used_at TEXT DEFAULT '',
        used_ref TEXT DEFAULT '',           -- где потрачено: application:12 / order:34
        created TEXT DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_credit_user ON referral_credits(user_id, status);
    ");
    // Промокод — один раз на участника: помечаем применение к заказу наград.
    foreach ([['promo_uses', 'order_id', 'INTEGER'], ['promo_uses', 'season', 'TEXT']] as $c) {
        try { db()->exec("ALTER TABLE {$c[0]} ADD COLUMN {$c[1]} {$c[2]}"); } catch (\Throwable $e) { /* уже есть */ }
    }
    // Приводим ранее созданные коды к новым потолкам (были 5/10 и вплоть до 20/20).
    try {
        q("UPDATE referrals SET percent=? WHERE percent > ?", [REFERRAL_MAX_PCT, REFERRAL_MAX_PCT]);
        q("UPDATE referrals SET reward_percent=? WHERE reward_percent > ?", [REFERRAL_REWARD_MAX_PCT, REFERRAL_REWARD_MAX_PCT]);
    } catch (\Throwable $e) { /* не критично */ }
}

/** Текущий сезон программы лояльности (календарный год). Достижения сбрасываются 1 января. */
function loyalty_season(): string { return date('Y'); }

/** Начало текущего сезона (для выборок по датам). */
function loyalty_season_start(): string { return loyalty_season() . '-01-01 00:00:00'; }

/**
 * Число состоявшихся участий за ТЕКУЩИЙ сезон (календарный год).
 * Сезонность — требование владельца: каждый год достижения начинаются заново.
 */
function loyalty_season_apps(?int $userId, string $email): int {
    $email = mb_strtolower(trim($email));
    if ($email === '' && !$userId) return 0;
    // Состоявшееся участие: оплачено ЛИБО дошло до результата. Список кодов статуса
    // здесь не перечисляем — лестница расширяется, счёт достижений не должен ломаться.
    $done = "status <> 'rejected' AND (is_paid=1 OR (result IS NOT NULL AND result<>''))";
    return (int) scalar(
        "SELECT COUNT(*) FROM applications
         WHERE $done AND created_at >= ?
           AND ( (email!='' AND email=?) OR (user_id IS NOT NULL AND user_id=?) )",
        [loyalty_season_start(), $email, $userId ?? 0]
    );
}

/**
 * Скидка за достижения (лояльность) — ТОЛЬКО за текущий сезон, потолок 5%.
 * Шкала: 3+ участия — 3%, 5+ участий — 5%. Больше 5% достижения не дают никогда.
 */
function loyalty_discount(?int $userId, string $email): int {
    $n = loyalty_season_apps($userId, $email);
    if ($n >= 5) return LOYALTY_MAX_PCT;      // 5%
    if ($n >= 3) return 3;
    return 0;
}

/** Пороги достижений сезона — для показа прогресса в личном кабинете. */
function loyalty_tiers(): array {
    return [
        ['apps' => 3, 'pct' => 3],
        ['apps' => 5, 'pct' => LOYALTY_MAX_PCT],
    ];
}

/**
 * Итоговая скидка на аккаунт с соблюдением потолков.
 * Возвращает разбор: ['loyalty'=>%, 'referral'=>%, 'club'=>%, 'total'=>%, 'cap'=>%].
 * Без клуба суммарно не больше DISCOUNT_CAP_NO_CLUB (10%);
 * с клубом — клубная скидка плюс до REFERRAL_MAX_PCT реферальных.
 */
function discount_breakdown(int $loyaltyPct, int $referralPct, int $clubPct): array {
    $loyaltyPct  = max(0, min(LOYALTY_MAX_PCT, $loyaltyPct));
    $referralPct = max(0, min(REFERRAL_MAX_PCT, $referralPct));
    $clubPct     = max(0, $clubPct);

    if ($clubPct > 0) {
        // Клуб заменяет достижения (он всегда выгоднее) и складывается с реферальной.
        $cap   = $clubPct + REFERRAL_MAX_PCT;
        $total = min($cap, $clubPct + $referralPct);
    } else {
        $cap   = DISCOUNT_CAP_NO_CLUB;
        $total = min($cap, $loyaltyPct + $referralPct);
    }
    return [
        'loyalty'  => $clubPct > 0 ? 0 : $loyaltyPct,
        'referral' => $referralPct,
        'club'     => $clubPct,
        'total'    => (int) $total,
        'cap'      => (int) $cap,
    ];
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
 * Промокод действует ОДИН раз на участника — на одну заявку ИЛИ на один заказ наград.
 * Проверяем по user_id и по email (гость мог заказывать без аккаунта).
 * Отменённые/неоплаченные применения не блокируют: учитываем pending и paid,
 * но pending старше суток считаем брошенными и не блокируем ими код.
 */
function referral_already_used(?int $userId, string $email): bool {
    loyalty_boot();
    $email = mb_strtolower(trim($email));
    if ($email === '' && !$userId) return false;
    $row = one(
        "SELECT id FROM promo_uses
          WHERE ( (user_id IS NOT NULL AND user_id=?) OR (email<>'' AND email=?) )
            AND ( status='paid' OR (status='pending' AND created >= datetime('now','-1 day')) )
          LIMIT 1",
        [$userId ?? 0, $email]
    );
    return (bool) $row;
}

/**
 * Реферальная скидка участнику: код валиден, не свой собственный и ещё не был
 * использован этим участником. Возвращает [процент, причина отказа|''].
 */
function referral_discount_for(?array $ref, ?int $userId, string $email): array {
    if (!$ref) return [0, ''];
    if ($userId && (int) ($ref['teacher_user_id'] ?? 0) === (int) $userId) {
        return [0, 'Свой собственный промокод применить нельзя.'];
    }
    if (referral_already_used($userId, $email)) {
        return [0, 'Промокод уже был использован — он действует один раз.'];
    }
    $pct = (int) ($ref['percent'] ?? 0);
    return [max(0, min(REFERRAL_MAX_PCT, $pct)), ''];
}

/* ===================== Одноразовые скидки владельцу промокода ===================== */

/** Доступная разовая скидка владельца промокода, % (0, если кредитов нет). */
function referral_credit_percent(?int $userId): int {
    if (!$userId) return 0;
    loyalty_boot();
    $row = one("SELECT percent FROM referral_credits WHERE user_id=? AND status='available' ORDER BY id ASC LIMIT 1", [$userId]);
    return $row ? max(0, min(REFERRAL_REWARD_MAX_PCT, (int) $row['percent'])) : 0;
}

/** Число неиспользованных разовых скидок (для показа в кабинете). */
function referral_credits_count(?int $userId): int {
    if (!$userId) return 0;
    loyalty_boot();
    return (int) scalar("SELECT COUNT(*) FROM referral_credits WHERE user_id=? AND status='available'", [$userId]);
}

/** Списывает одну разовую скидку владельца кода. $ref — 'application:12' или 'order:34'. */
function referral_credit_spend(?int $userId, string $usedRef): bool {
    if (!$userId) return false;
    loyalty_boot();
    $row = one("SELECT id FROM referral_credits WHERE user_id=? AND status='available' ORDER BY id ASC LIMIT 1", [$userId]);
    if (!$row) return false;
    update('referral_credits', [
        'status'   => 'used',
        'used_at'  => date('Y-m-d H:i:s'),
        'used_ref' => mb_substr($usedRef, 0, 60),
    ], 'id=:id', ['id' => (int) $row['id']]);
    return true;
}

/** Начисляет владельцу кода одну разовую скидку 5% за оплаченное применение (антидубль по promo_use_id). */
function referral_credit_grant(int $promoUseId, int $referralId, int $ownerUserId): bool {
    loyalty_boot();
    if (!$ownerUserId || !$promoUseId) return false;
    if (one("SELECT id FROM referral_credits WHERE promo_use_id=?", [$promoUseId])) return false;  // уже начислено
    insert('referral_credits', [
        'user_id'      => $ownerUserId,
        'referral_id'  => $referralId,
        'promo_use_id' => $promoUseId,
        'percent'      => REFERRAL_REWARD_MAX_PCT,
        'status'       => 'available',
    ]);
    return true;
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
        // Владельцу кода — ОДНА разовая скидка 5% (не деньги), по правилу владельца.
        $owner = (int) (scalar("SELECT teacher_user_id FROM referrals WHERE id=?", [(int) $r['referral_id']]) ?? 0);
        if ($owner) referral_credit_grant((int) $r['id'], (int) $r['referral_id'], $owner);
        $total += (int) $r['reward'];
    }
    return $total;
}

/** То же для ЗАКАЗА наградного материала (промокод действует и на заказ). */
function referral_confirm_order(?int $orderId): int {
    loyalty_boot();
    if (!$orderId) return 0;
    $rows = all("SELECT * FROM promo_uses WHERE order_id=? AND status='pending'", [(int) $orderId]);
    $total = 0;
    foreach ($rows as $r) {
        update('promo_uses', ['status' => 'paid'], 'id=:id', ['id' => (int) $r['id']]);
        q("UPDATE referrals SET uses = uses + 1 WHERE id=?", [(int) $r['referral_id']]);
        $owner = (int) (scalar("SELECT teacher_user_id FROM referrals WHERE id=?", [(int) $r['referral_id']]) ?? 0);
        if ($owner) referral_credit_grant((int) $r['id'], (int) $r['referral_id'], $owner);
        $total += (int) $r['reward'];
    }
    return $total;
}

/** Регистрация применения промокода к ЗАКАЗУ наград (аналог referral_record_use). */
function referral_record_use_order(array $ref, ?int $orderId, ?int $userId, string $email, int $amount): int {
    loyalty_boot();
    $reward = (int) max(0, round($amount * ((int) ($ref['reward_percent'] ?? 0)) / 100));
    insert('promo_uses', [
        'referral_id' => (int) $ref['id'],
        'code'        => $ref['code'] ?? '',
        'order_id'    => $orderId,
        'user_id'     => $userId,
        'email'       => mb_strtolower(trim($email)),
        'amount'      => $amount,
        'reward'      => $reward,
        'status'      => 'pending',
        'season'      => loyalty_season(),
    ]);
    return $reward;
}

/** Создание промокода педагога. Возвращает строку referrals. */
function referral_create(int $teacherId, string $wantCode = '', int $percent = REFERRAL_MAX_PCT, int $rewardPercent = REFERRAL_REWARD_MAX_PCT, string $note = ''): array {
    loyalty_boot();
    // Потолки жёсткие: 5% приглашённому и 5% пригласившему (было 20/20 — не по правилам).
    $percent = max(0, min(REFERRAL_MAX_PCT, $percent));
    $rewardPercent = max(0, min(REFERRAL_REWARD_MAX_PCT, $rewardPercent));
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

/* ═══════════════════════════════════════════════════════════════════════════
   РАСШИФРОВКА ОПЛАТЫ ЗАЯВКИ — один источник правды для админки и кабинета.
   Раньше «Сумма участия» считалась ТОЛЬКО по таблице payments, поэтому у заявок,
   оплаченных без чека ЮKassa (ручная отметка админом, нулевой итог, старые данные),
   в карточке писало «не оплачено», хотя is_paid=1. И нигде не было видно, почему
   участник заплатил 400 вместо 500.
   ═══════════════════════════════════════════════════════════════════════════ */

/**
 * Полная картина денег по заявке.
 *
 * @return array{
 *   free:bool, paid:bool, base:int, amount:int, pct:int, source:string,
 *   lines:array<int,string>, label:string
 * }
 */
function app_payment_view(array $a): array {
    $appId  = (int) ($a['id'] ?? 0);
    $free   = (int) ($a['comp_paid'] ?? 1) === 0;
    $base   = (int) ($a['price_base'] ?? 0) ?: (int) ($a['comp_price'] ?? 0);

    // 1) Деньги, реально прошедшие через кассу. В списках сумма уже посчитана одним
    //    запросом (a.paid_sum) — тогда второй раз в базу не ходим, иначе это N+1.
    $payd = array_key_exists('paid_sum', $a)
        ? (int) $a['paid_sum']
        : (int) (scalar("SELECT COALESCE(SUM(amount),0) FROM payments
                          WHERE application_id=? AND status IN ('succeeded','paid')", [$appId]) ?? 0);
    // 2) Сумма, зафиксированная на самой заявке (пакетная оплата, ручная отметка).
    $stored = (int) ($a['amount_paid'] ?? 0);

    $amount = $payd > 0 ? $payd : $stored;
    $source = $payd > 0 ? 'kassa' : ($stored > 0 ? 'app' : '');
    $paid   = (int) ($a['is_paid'] ?? 0) === 1;

    $pct  = (int) ($a['discount_pct'] ?? 0);
    $info = json_decode((string) ($a['discount_info'] ?? ''), true);
    if (!is_array($info)) $info = [];
    // Если процент не сохранён (старые заявки) — выводим его из чисел.
    if ($pct <= 0 && $base > 0 && $amount > 0 && $amount < $base) {
        $pct = (int) round(($base - $amount) / $base * 100);
    }
    // Скидку показываем ТОЛЬКО если по факту заплачено меньше прайса. Иначе выходила
    // бессмыслица вида «500 ₽, скидка 5%, к оплате 500 ₽»: расчётная скидка сохранена
    // на заявке, а касса приняла полную сумму (доплата, пересчёт, старые данные).
    $discountReal = $base > 0 && $amount > 0 && $amount < $base;
    if (!$discountReal) { $pct = 0; $info = []; }

    $lines = [];
    if (!$free) {
        if ($base > 0) $lines[] = 'Взнос по прайсу — ' . number_format($base, 0, '.', ' ') . ' ₽';
        foreach (app_discount_reasons($info, $pct) as $why) $lines[] = $why;
        if ($amount > 0) {
            $lines[] = 'К оплате — ' . number_format($amount, 0, '.', ' ') . ' ₽'
                     . ($source === 'kassa' ? ' (подтверждено кассой)' : ' (отмечено вручную)');
        } elseif ($paid) {
            $lines[] = 'Отмечено оплаченным без чека — суммы в кассе нет';
        }
    }

    $label = $free ? 'Бесплатный конкурс'
           : ($paid || $amount > 0
               ? ($amount > 0 ? number_format($amount, 0, '.', ' ') . ' ₽ · оплачено' : 'оплачено')
               : number_format($base, 0, '.', ' ') . ' ₽ — не оплачено');

    return ['free' => $free, 'paid' => $paid || $amount > 0, 'base' => $base,
            'amount' => $amount, 'pct' => $pct, 'source' => $source,
            'lines' => $lines, 'label' => $label];
}

/** Человеческие причины скидки из сохранённого разбора. */
function app_discount_reasons(array $info, int $pct): array {
    $out = [];
    $club  = (int) ($info['club_pct'] ?? 0);
    $loy   = (int) ($info['loyalty_pct'] ?? 0);
    $ref   = (int) ($info['referral_pct'] ?? 0);
    if ($club > 0) $out[] = 'Скидка ' . $club . '% — участник ВИП-клуба';
    if ($loy  > 0) $out[] = 'Скидка ' . $loy . '% — за достижения профиля';
    if ($ref  > 0) {
        $code = trim((string) ($info['promo_code'] ?? ''));
        $out[] = 'Скидка ' . $ref . '% — ' . (!empty($info['credit_applied'])
            ? 'бонус за приглашённого участника'
            : ('реферальный промокод' . ($code !== '' ? ' ' . $code : '')));
    }
    // Разбор не сохранён (заявка до этой версии) — показываем хотя бы итог.
    if (!$out && $pct > 0) $out[] = 'Скидка ' . $pct . '% (детали не сохранены)';
    return $out;
}

loyalty_boot();
