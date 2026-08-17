<?php
/**
 * ВЕРНУТЬ В БАЗУ ЛЮДЕЙ, ВЫЧЕРКНУТЫХ ПО ОТКАЗУ БЕЗ ОБЪЯСНЕНИЯ.
 *
 * 17 августа mail.ru три часа отбивал письма пачкой, а на четвёртом принял те же
 * самые адреса: в 08:00 из 800 писем отбилось 388, в 11:00 из 808 — шестнадцать.
 * Темп отправки при этом не менялся. Это не мёртвая база, это почтовая служба
 * придерживала незнакомого отправителя.
 *
 * Разбор событий тогда работал по-старому: любой «жёсткий отказ» = адреса нет.
 * За утро из базы выбыло около полутора тысяч живых людей — их сняли с рассылки,
 * а письма из очереди пометили как несостоявшиеся.
 *
 * Здесь они возвращаются. Признак ложного отказа: почтовик не назвал причину,
 * либо назвал такую, которая говорит о канале, а не об адресе (см.
 * mrep_bounce_is_proof). Адреса, про которые прямо сказано «такого ящика нет»,
 * остаются вычеркнутыми — они и правда мёртвые.
 *
 *   php scripts/restore_false_bounces.php --dry        — показать, кого вернём
 *   php scripts/restore_false_bounces.php              — вернуть за сегодня
 *   php scripts/restore_false_bounces.php --days=3     — за последние 3 дня
 */
declare(strict_types=1);
if (PHP_SAPI !== 'cli') { fwrite(STDERR, "CLI only\n"); exit(1); }

define('BASE_PATH', dirname(__DIR__));
$GLOBALS['CFG'] = require BASE_PATH . '/config.php';
require_once BASE_PATH . '/core/db.php';
require_once BASE_PATH . '/core/helpers.php';
require_once BASE_PATH . '/core/mail_reputation.php';

$dry  = in_array('--dry', $argv, true);
$days = 0;
foreach ($argv as $a) if (preg_match('~^--days=(\d+)$~', $a, $m)) $days = (int) $m[1];
$line = str_repeat('=', 78);

echo "ВОЗВРАТ АДРЕСОВ ПОСЛЕ ОТКАЗОВ БЕЗ ОБЪЯСНЕНИЯ\n$line\n";

$since = $days > 0 ? "datetime('now','localtime','-$days days')" : "date('now','localtime')";
$rows = all("SELECT DISTINCT LOWER(email) e, COALESCE(comment,'') c
               FROM mail_events
              WHERE status='hard_bounced' AND created_at >= $since");

$false = $true = [];
foreach ($rows as $r) {
    $e = (string) $r['e'];
    if ($e === '') continue;
    if (mrep_bounce_is_proof((string) $r['c'])) $true[$e] = true; else $false[$e] = true;
}
// Адрес, про который хоть раз сказали прямо «ящика нет», не возвращаем.
foreach (array_keys($true) as $e) unset($false[$e]);

printf("  отказов за период: %s адресов\n", number_format(count($rows), 0, '.', ' '));
printf("  из них доказанных (ящика нет): %s\n", number_format(count($true), 0, '.', ' '));
printf("  без объяснения — вернём: %s\n", number_format(count($false), 0, '.', ' '));

if (!$false) exit(0);

if ($dry) {
    $i = 0;
    echo "\nПРИМЕРЫ\n$line\n";
    foreach (array_keys($false) as $e) { echo "  $e\n"; if (++$i >= 15) break; }
    echo "\n  сухой прогон: ничего не изменено\n";
    exit(0);
}

$stat = ['подписчики' => 0, 'учреждения' => 0, 'стоп-лист' => 0, 'очередь' => 0];
$chg  = static fn(): int => (int) db()->query("SELECT changes()")->fetchColumn();

foreach (array_keys($false) as $e) {
    // Подписчик снова активен, метка отказа снята.
    try {
        q("UPDATE subscribers
              SET active = 1,
                  tags = TRIM(REPLACE(REPLACE(COALESCE(tags,''), 'bounced', ''), ',,', ','), ' ,')
            WHERE LOWER(email) = ? AND active = 0", [$e]);
        $stat['подписчики'] += $chg();
    } catch (\Throwable $ex) {}

    // Учреждение возвращаем в «приглашено»: письмо ему мы отправляли, а вот
    // отказ адреса не подтверждён.
    try {
        q("UPDATE institutions SET status='invited', updated_at=datetime('now','localtime')
            WHERE status='bounced' AND LOWER(email) = ?", [$e]);
        $stat['учреждения'] += $chg();
    } catch (\Throwable $ex) {}

    // Из стоп-листа убираем ТОЛЬКО «ящика не существует» — вердикт, который и
    // оказался ложным. Отписки, жалобы на спам и кривые адреса остаются: их
    // ставил человек или разбор самого адреса, а не сегодняшний зажим почтовика.
    try {
        q("DELETE FROM mail_stop WHERE LOWER(email) = ? AND reason = 'ящика не существует'", [$e]);
        $stat['стоп-лист'] += $chg();
    } catch (\Throwable $ex) {}

    // Письма, снятые «по событию доставки», возвращаем в очередь.
    try {
        q("UPDATE mail_queue SET status='queued', tries=0, error=''
            WHERE status='failed' AND LOWER(to_email) = ?
              AND (error LIKE '%по событию доставки%' OR error LIKE '%отказ адресата%')", [$e]);
        $stat['очередь'] += $chg();
    } catch (\Throwable $ex) {}
}

echo "\nСДЕЛАНО\n$line\n";
foreach ($stat as $k => $v) printf("  %-12s %s\n", $k, number_format($v, 0, '.', ' '));
