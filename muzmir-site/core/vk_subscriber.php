<?php
/**
 * ПОДПИСКА НА СООБЩЕСТВО ВКОНТАКТЕ И БОНУС ЗА НЕЁ.
 *
 * Решение владельца от 21.10.2026: подписчику сообщества — 2% скидки на
 * ЭЛЕКТРОННЫЕ наградные документы (kind='digital': основной и дополнительный
 * дипломы, именной диплом, благодарность). На оригиналы, изделия, оргвзнос и
 * членство в клубе бонус не распространяется.
 *
 * ПОЧЕМУ ВООБЩЕ ТАК, А НЕ «ПОДПИСЫВАЕМ САМИ».
 * ВКонтакте не даёт сообществу ни одного способа добавить себе подписчика:
 * groups.join вызывается только ключом самого человека, а у публичной страницы
 * (наше сообщество — type=page) недоступны даже приглашения — API отвечает
 * can_invite=0. Подписка всегда остаётся действием человека. Поэтому мы её не
 * делаем за него, а даём повод сделать самому и честно проверяем результат.
 *
 * КАК ПРОВЕРЯЕМ. groups.isMember работает ключом СООБЩЕСТВА (личный ключ
 * владельца для этого не нужен — см. правило 24 в памяти проекта) и принимает
 * до 500 человек за запрос. Поэтому:
 *   • раз в сутки cron/vk_subs_sync.php сверяет всех, у кого есть vk_id;
 *   • при заказе и по кнопке «Я подписался» спрашиваем точечно, но не чаще
 *     VK_SUB_FRESH_SEC — иначе каждая перерисовка корзины била бы по API.
 * Ответ кладётся в users.vk_sub / users.vk_sub_at и дальше читается из базы:
 * ходить в ВК во время отрисовки страницы нельзя, на этом уже обожглись
 * подписи диалогов (см. cron/vk_names_fill.php).
 *
 * БЕЗ ПРИВЯЗКИ ВК БОНУСА НЕТ — и это не придирка: не зная vk_id, мы не можем
 * отличить подписчика от любого другого человека. Привязка делается одной
 * кнопкой в кабинете (/api/v1/oauth_vk?bind=1).
 *
 * ОТПИСАЛСЯ — БОНУС УХОДИТ. Сверка двусторонняя: vk_sub снимается так же
 * спокойно, как ставится. Уже оплаченные заказы это не трогает.
 */
declare(strict_types=1);

/** Бонус подписчика сообщества, % — по умолчанию 2 (настройка vk_sub_bonus_pct). */
const VK_SUB_BONUS_PCT = 2;

/** Сколько секунд точечная проверка считается свежей (10 минут). */
const VK_SUB_FRESH_SEC = 600;

/** Колонки признака заводятся лениво — core/db.php не трогаем. */
function vk_sub_boot(): void {
    static $done = false;
    if ($done) return;
    $done = true;
    foreach ([
        'vk_sub'    => "INTEGER DEFAULT 0",   // 1 — подписан на сообщество
        'vk_sub_at' => "TEXT DEFAULT ''",     // когда сверяли в последний раз
    ] as $col => $decl) {
        try { db()->exec("ALTER TABLE users ADD COLUMN $col $decl"); } catch (\Throwable $e) { /* уже есть */ }
    }
}

/** Колонки бонуса в заказе — чтобы в админке и письме было видно, за что скидка. */
function vk_sub_order_boot(): void {
    static $done = false;
    if ($done) return;
    $done = true;
    foreach ([
        'vk_bonus_pct' => "INTEGER DEFAULT 0",
        'vk_bonus_rub' => "INTEGER DEFAULT 0",
    ] as $col => $decl) {
        try { db()->exec("ALTER TABLE awards_orders ADD COLUMN $col $decl"); } catch (\Throwable $e) { /* уже есть */ }
    }
}

/** Размер бонуса из настроек, % (0 — бонус выключен). */
function vk_sub_bonus_pct(): int {
    $pct = function_exists('setting') ? (int) setting('vk_sub_bonus_pct', (string) VK_SUB_BONUS_PCT) : VK_SUB_BONUS_PCT;
    return max(0, min(100, $pct));
}

/** id сообщества, на которое смотрим. */
function vk_sub_group_id(): string {
    $g = function_exists('cfgv') ? (string) cfgv('vk_group_id') : '';
    if ($g === '' && function_exists('setting')) $g = (string) setting('vk_group_id', '');
    return trim($g, " \t\n\r\0\x0B-");
}

/** Адрес сообщества для ссылок и кнопок. */
function vk_sub_group_url(): string {
    $u = function_exists('cfgv') ? (string) cfgv('org_vk', '') : '';
    return $u !== '' ? $u : 'https://vk.com/music_world.online';
}

/**
 * Подписан ли человек — ПО БАЗЕ, без обращения к ВКонтакте.
 * Именно это читают страницы: отрисовка не имеет права ждать сеть.
 */
function vk_sub_is(?int $userId): bool {
    if (!$userId) return false;
    vk_sub_boot();
    $row = one("SELECT COALESCE(vk_sub,0) s FROM users WHERE id=?", [(int) $userId]);
    return $row && (int) $row['s'] === 1;
}

/**
 * Бонус конкретного человека, % — 0, если бонус выключен или человек не подписан.
 * Единственный источник правды для заказа, корзины и писем.
 */
function vk_sub_user_pct(?int $userId): int {
    $pct = vk_sub_bonus_pct();
    if ($pct <= 0) return 0;
    return vk_sub_is($userId) ? $pct : 0;
}

/** Записывает результат сверки. Возвращает true, если признак изменился. */
function vk_sub_store(int $userId, bool $member): bool {
    vk_sub_boot();
    $was = (int) (scalar("SELECT COALESCE(vk_sub,0) FROM users WHERE id=?", [$userId]) ?? 0);
    $now = $member ? 1 : 0;
    update('users', ['vk_sub' => $now, 'vk_sub_at' => date('Y-m-d H:i:s')], 'id=:id', ['id' => $userId]);
    return $was !== $now;
}

/**
 * ТОЧЕЧНАЯ СВЕРКА ОДНОГО ЧЕЛОВЕКА.
 *
 * $force — спросить ВКонтакте даже если запись свежая (кнопка «Я подписался»:
 * человек только что нажал «Подписаться» и ждёт, что мы это увидим).
 * Сеть недоступна или ВК в отказе по темпу — возвращаем то, что знаем, и
 * молчим: бонус не та вещь, ради которой стоит ронять оформление заказа.
 */
function vk_sub_check(int $userId, bool $force = false): bool {
    vk_sub_boot();
    $u = one("SELECT id, vk_id, COALESCE(vk_sub,0) vk_sub, COALESCE(vk_sub_at,'') vk_sub_at FROM users WHERE id=?", [$userId]);
    if (!$u) return false;
    $vkId = trim((string) $u['vk_id']);
    if ($vkId === '') return false;                     // без привязки сверять нечего

    if (!$force) {
        $at = trim((string) $u['vk_sub_at']);
        if ($at !== '' && (time() - (int) strtotime($at)) < VK_SUB_FRESH_SEC) {
            return (int) $u['vk_sub'] === 1;            // запись свежая, в ВК не идём
        }
    }

    $gid = vk_sub_group_id();
    if ($gid === '') return (int) $u['vk_sub'] === 1;

    if (!function_exists('vk_api') && is_file(BASE_PATH . '/core/vk.php')) require_once BASE_PATH . '/core/vk.php';
    if (!function_exists('vk_api')) return (int) $u['vk_sub'] === 1;

    try {
        $r = vk_api('groups.isMember', ['group_id' => $gid, 'user_id' => $vkId]);
    } catch (\Throwable $e) {
        return (int) $u['vk_sub'] === 1;
    }
    if (!isset($r['response'])) return (int) $u['vk_sub'] === 1;   // ошибка/отказ по темпу — не трогаем признак

    $member = is_array($r['response'])
        ? !empty($r['response']['member'])
        : ((int) $r['response'] === 1);
    vk_sub_store($userId, $member);
    return $member;
}

/**
 * СВЕРКА ПАЧКОЙ — для суточного задания.
 *
 * groups.isMember берёт до 500 человек за один запрос, поэтому вся база
 * привязавших ВК (сейчас это полторы сотни человек) сверяется за считаные
 * запросы. Возвращает ['всего'=>, 'подписаны'=>, 'изменилось'=>, 'запросов'=>].
 */
function vk_sub_sync(int $limitUsers = 5000): array {
    vk_sub_boot();
    $out = ['всего' => 0, 'подписаны' => 0, 'изменилось' => 0, 'запросов' => 0];
    $gid = vk_sub_group_id();
    if ($gid === '') return $out;
    if (!function_exists('vk_api') && is_file(BASE_PATH . '/core/vk.php')) require_once BASE_PATH . '/core/vk.php';
    if (!function_exists('vk_api')) return $out;

    $rows = all("SELECT id, vk_id FROM users WHERE COALESCE(vk_id,'')<>'' ORDER BY id LIMIT ?", [$limitUsers]);
    $out['всего'] = count($rows);
    if (!$rows) return $out;

    /* Ключ у vk_id, а не наоборот: один и тот же человек ВКонтакте мог
       оказаться в двух записях сайта (почта и соц-вход), и ответ ВК надо
       разложить на обе. */
    $byVk = [];
    foreach ($rows as $r) $byVk[(string) $r['vk_id']][] = (int) $r['id'];

    foreach (array_chunk(array_keys($byVk), 500) as $chunk) {
        try {
            $r = vk_api('groups.isMember', ['group_id' => $gid, 'user_ids' => implode(',', $chunk)]);
        } catch (\Throwable $e) {
            continue;
        }
        $out['запросов']++;
        $list = $r['response'] ?? null;
        if (!is_array($list)) continue;                 // отказ по темпу/ошибка — пачку пропускаем
        foreach ($list as $x) {
            $vkId   = (string) ($x['user_id'] ?? '');
            $member = !empty($x['member']);
            if ($member) $out['подписаны']++;
            foreach ($byVk[$vkId] ?? [] as $uid) {
                if (vk_sub_store($uid, $member)) $out['изменилось']++;
            }
        }
    }
    return $out;
}

/**
 * Сколько в заказе стоят ЭЛЕКТРОННЫЕ позиции — на них и считается бонус.
 * Строки заказа приходят уже нормализованными сервером (kind/price), поэтому
 * подменить вид позиции из браузера нельзя.
 */
function vk_sub_digital_sum(array $items): int {
    $sum = 0;
    foreach ($items as $it) {
        if (!is_array($it)) continue;
        if ((string) ($it['kind'] ?? '') !== 'digital') continue;
        $sum += (int) ($it['price'] ?? 0) * max(1, (int) ($it['qty'] ?? 1));
    }
    return $sum;
}

/** Строка для писем и страниц: «2% на электронные наградные документы». */
function vk_sub_bonus_text(): string {
    $pct = vk_sub_bonus_pct();
    return $pct > 0 ? $pct . '% на электронные наградные документы' : '';
}
