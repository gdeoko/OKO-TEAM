<?php
/**
 * ДОМЕНЫ, КОТОРЫМ РАССЫЛОЧНЫЙ КАНАЛ ЗАКРЫТ.
 *
 * Часть учреждений сидит на ведомственной почте региона: mosreg.ru, nso.ru,
 * govvrn.ru, kult.permkrai.ru. Их почтовые шлюзы режут всё, что приходит через
 * сервисы рассылок, и отвечают одинаково: «550 5.7.1 This message is blocked
 * due to security reason». Не адрес плохой и не письмо — канал не тот. По
 * mosreg.ru за три дня 35 отказов и ноль доставленных, по nso.ru 17 и ноль.
 *
 * Ровно на этом центр уже обжигался с ведомствами: обращения, отправленные с
 * Gmail, отбивались с формулировкой «принимаем письма только с доменов .RU и
 * .SU». Лечится тем же способом — писать с собственного российского домена
 * напрямую, а не через сервис рассылок.
 *
 * Список ведётся ПО ФАКТУ, а не по догадке. Большинство ведомственных доменов
 * письма принимает прекрасно (volganet.ru, sev.gov.ru, obl72.ru доставляют без
 * единого отказа), и записывать их в особые было бы вредно: канал с kc@ в разы
 * медленнее. В список попадает домен, который отбил не меньше трёх писем, не
 * доставил ни одного и отбивал именно блокировкой, а не «ящика нет».
 *
 * Домен выходит из списка сам, как только с него приходит хоть одна доставка.
 */
declare(strict_types=1);

if (!function_exists('mrep_bounce_is_proof') && is_file(BASE_PATH . '/core/mail_reputation.php')) {
    require_once BASE_PATH . '/core/mail_reputation.php';
}

function mdp_ensure(): void {
    static $done = false;
    if ($done) return;
    $done = true;
    db()->exec("CREATE TABLE IF NOT EXISTS mail_domain_policy (
        domain     TEXT PRIMARY KEY,
        policy     TEXT DEFAULT '',        -- '' обычный канал | official — только с kc@
        delivered  INTEGER DEFAULT 0,
        bounced    INTEGER DEFAULT 0,
        reason     TEXT DEFAULT '',
        updated_at TEXT DEFAULT (datetime('now','localtime')))");
}

/** Отказ выглядит как блокировка канала, а не как отсутствие ящика? */
function mdp_looks_blocked(string $reason): bool {
    $r = mb_strtolower($reason);
    if (trim($r) === '') return false;
    foreach (['security reason', 'spam', 'blocked', 'blacklist', 'policy',
              'not allowed', 'rejected by', 'err_spam_rejected', 'err_blacklisted'] as $w) {
        if (str_contains($r, $w)) return true;
    }
    return false;
}

/**
 * ПЕРЕСЧЁТ СПИСКА ПО ЖУРНАЛУ СОБЫТИЙ.
 *
 * Окно намеренно короткое (две недели): шлюзы перенастраивают, и домен, который
 * блокировал в августе, в сентябре может принимать. Пусть список стареет сам.
 */
function mdp_learn(int $days = 14): array {
    mdp_ensure();

    $rows = all("SELECT LOWER(SUBSTR(email, INSTR(email,'@') + 1)) d, status, COALESCE(comment,'') c
                   FROM mail_events
                  WHERE created_at >= datetime('now','localtime', ?)
                    AND status IN ('delivered','hard_bounced') AND INSTR(email,'@') > 0",
                ['-' . max(1, $days) . ' days']);

    $agg = [];
    foreach ($rows as $r) {
        $d = (string) $r['d'];
        if ($d === '') continue;
        if (!isset($agg[$d])) $agg[$d] = ['delivered' => 0, 'bounced' => 0, 'blocked' => 0, 'reason' => ''];
        if ((string) $r['status'] === 'delivered') { $agg[$d]['delivered']++; continue; }
        $agg[$d]['bounced']++;
        if (mdp_looks_blocked((string) $r['c'])) {
            $agg[$d]['blocked']++;
            if ($agg[$d]['reason'] === '') $agg[$d]['reason'] = mb_substr(trim((string) $r['c']), 0, 160);
        }
    }

    $added = $removed = [];
    foreach ($agg as $d => $s) {
        // Публичные почтовики в особый канал не отправляем никогда: их зажимы
        // временные и лечатся паузой (mrep_paused_domains), а поток с kc@ они
        // не выдержат по объёму.
        if (in_array($d, mdp_public_mailers(), true)) continue;

        $isOfficial = $s['delivered'] === 0 && $s['bounced'] >= 3 && $s['blocked'] >= 1;
        $was = (string) (scalar("SELECT policy FROM mail_domain_policy WHERE domain=?", [$d]) ?? '');

        if ($isOfficial) {
            q("INSERT INTO mail_domain_policy (domain, policy, delivered, bounced, reason, updated_at)
               VALUES (:d,'official',:dl,:b,:r,datetime('now','localtime'))
               ON CONFLICT(domain) DO UPDATE SET policy='official', delivered=:dl, bounced=:b,
                    reason=:r, updated_at=datetime('now','localtime')",
              ['d' => $d, 'dl' => $s['delivered'], 'b' => $s['bounced'], 'r' => $s['reason']]);
            if ($was !== 'official') $added[] = $d;
        } elseif ($was === 'official' && $s['delivered'] > 0) {
            // Домен снова принимает — возвращаем в обычный канал.
            q("UPDATE mail_domain_policy SET policy='', delivered=:dl, bounced=:b,
                      reason='снова принимает', updated_at=datetime('now','localtime')
                WHERE domain=:d", ['d' => $d, 'dl' => $s['delivered'], 'b' => $s['bounced']]);
            $removed[] = $d;
        }
    }
    return ['added' => $added, 'removed' => $removed];
}

/** Публичные почтовые службы: их в особый канал не уводим. */
function mdp_public_mailers(): array {
    return ['mail.ru', 'yandex.ru', 'ya.ru', 'gmail.com', 'bk.ru', 'list.ru', 'inbox.ru',
            'rambler.ru', 'internet.ru', 'icloud.com', 'mail.com', 'outlook.com', 'hotmail.com',
            'yandex.by', 'yandex.kz', 'yandex.ua', 'yandex.com', 'narod.ru', 'vk.com'];
}

/** Домены особого канала — один запрос на прогон. */
function mdp_official_domains(): array {
    static $cache = null;
    if ($cache !== null) return $cache;
    mdp_ensure();
    $cache = [];
    try {
        foreach (all("SELECT domain FROM mail_domain_policy WHERE policy='official'") as $r) {
            $cache[(string) $r['domain']] = true;
        }
    } catch (\Throwable $e) {}
    return $cache;
}

/** Этому адресу можно писать только с почты центра напрямую? */
function mdp_needs_official(string $email): bool {
    $at = mb_strrpos($email, '@');
    if ($at === false) return false;
    return isset(mdp_official_domains()[mb_strtolower(trim(mb_substr($email, $at + 1)))]);
}
