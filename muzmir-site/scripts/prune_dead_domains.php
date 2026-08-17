<?php
/**
 * ОТСЕЯТЬ МЁРТВЫЕ АДРЕСА ДО ОТПРАВКИ, А НЕ ПОСЛЕ.
 *
 * За первый день, когда события доставки пошли по-настоящему, из 3 932 адресов
 * 1 472 отбились намертво — тридцать семь процентов. Механизм чистки сработал:
 * все они ушли в стоп-лист. Но заплатили мы за это репутацией домена, потому
 * что каждый такой адрес это отказ, который почтовые службы записывают на нас.
 *
 * Часть мёртвых видна заранее, без единой отправки: у домена нет почтовых
 * записей MX, значит принимать письма он не может физически. Опечатки
 * («mail.ru» с лишней буквой), закрытые сайты школ, домены, которые перестали
 * продлевать. Здесь такие домены находятся и их адреса снимаются с очереди.
 *
 * Проверяется ДОМЕН, а не ящик: существование конкретного ящика по MX не
 * узнать, и гадать мы не будем. Домены с MX остаются в очереди как были.
 *
 * Результат кэшируется в таблице mail_domains: доменов в базе тысячи, а
 * повторять один и тот же запрос к DNS ради каждого адреса бессмысленно.
 *
 *   php scripts/prune_dead_domains.php --dry    — показать, что отсеется
 *   php scripts/prune_dead_domains.php          — отсеять
 *   php scripts/prune_dead_domains.php --limit=500  — проверить часть доменов
 */
declare(strict_types=1);
if (PHP_SAPI !== 'cli') { fwrite(STDERR, "CLI only\n"); exit(1); }

define('BASE_PATH', dirname(__DIR__));
$GLOBALS['CFG'] = require BASE_PATH . '/config.php';
require_once BASE_PATH . '/core/db.php';
require_once BASE_PATH . '/core/helpers.php';
require_once BASE_PATH . '/core/mailer.php';

$dry   = in_array('--dry', $argv, true);
$limit = 0;
foreach ($argv as $a) if (preg_match('~^--limit=(\d+)$~', $a, $m)) $limit = (int) $m[1];
$line = str_repeat('=', 78);

db()->exec("CREATE TABLE IF NOT EXISTS mail_domains (
    domain     TEXT PRIMARY KEY,
    has_mx     INTEGER DEFAULT 0,
    checked_at TEXT DEFAULT (datetime('now','localtime')))");

echo "ПРОВЕРКА ДОМЕНОВ В ОЧЕРЕДИ\n$line\n";

/* Домены, которые ещё ждут отправки и ни разу не проверялись. */
$sql = "SELECT LOWER(SUBSTR(to_email, INSTR(to_email,'@') + 1)) AS d, COUNT(*) c
          FROM mail_queue
         WHERE status = 'queued' AND INSTR(to_email,'@') > 0
           AND LOWER(SUBSTR(to_email, INSTR(to_email,'@') + 1)) NOT IN (SELECT domain FROM mail_domains)
         GROUP BY 1 ORDER BY c DESC";
if ($limit > 0) $sql .= " LIMIT $limit";
$rows = all($sql);

printf("  новых доменов к проверке: %s\n", number_format(count($rows), 0, '.', ' '));
if (!$rows) {
    printf("  всего проверено ранее: %s, из них без почты: %s\n",
        number_format((int) (scalar("SELECT COUNT(*) FROM mail_domains") ?? 0), 0, '.', ' '),
        number_format((int) (scalar("SELECT COUNT(*) FROM mail_domains WHERE has_mx=0") ?? 0), 0, '.', ' '));
}

$dead = [];
$checked = 0;
foreach ($rows as $r) {
    $d = trim((string) $r['d']);
    if ($d === '' || !preg_match('~^[a-z0-9.\-]+\.[a-z]{2,}$~i', $d)) {
        $dead[$d] = (int) $r['c'];   // домен вообще не похож на домен
        continue;
    }
    // MX или, как запасной вариант, A-запись: некоторые мелкие хосты принимают
    // почту прямо на адрес домена, и объявлять их мёртвыми нельзя.
    $ok = @checkdnsrr($d, 'MX') || @checkdnsrr($d, 'A');
    $checked++;
    if (!$ok) $dead[$d] = (int) $r['c'];
    if (!$dry) {
        q("INSERT OR REPLACE INTO mail_domains (domain, has_mx, checked_at)
           VALUES (:d, :m, datetime('now','localtime'))", ['d' => $d, 'm' => $ok ? 1 : 0]);
    }
    usleep(20000);   // не долбим резолвер
}

printf("  проверено: %s, без почтовых записей: %s\n",
    number_format($checked, 0, '.', ' '), number_format(count($dead), 0, '.', ' '));

if ($dead) {
    echo "\nДОМЕНЫ БЕЗ ПОЧТЫ (адресов в очереди)\n$line\n";
    arsort($dead);
    $i = 0;
    foreach ($dead as $d => $c) {
        printf("  %-42s %s\n", $d !== '' ? $d : '(пустой)', number_format($c, 0, '.', ' '));
        if (++$i >= 25) { printf("  … и ещё %d\n", count($dead) - 25); break; }
    }
}

$total = array_sum($dead);
printf("\n  писем к снятию с очереди: %s\n", number_format($total, 0, '.', ' '));

if ($dry) { echo "\n  сухой прогон: ничего не изменено\n"; exit(0); }
if (!$dead) exit(0);

/* Снимаем письма и закрываем адреса, чтобы они не вернулись со следующей волной. */
$off = $stopped = 0;
foreach (array_keys($dead) as $d) {
    $st = q("UPDATE mail_queue SET status='cancelled', error='домен не принимает почту'
              WHERE status='queued' AND LOWER(SUBSTR(to_email, INSTR(to_email,'@') + 1)) = :d", ['d' => $d]);
    $off += $st->rowCount();

    foreach (all("SELECT DISTINCT LOWER(email) e FROM subscribers
                   WHERE LOWER(SUBSTR(email, INSTR(email,'@') + 1)) = :d", ['d' => $d]) as $s) {
        try {
            q("INSERT OR IGNORE INTO mail_stop (email, reason) VALUES (:e, 'домен не принимает почту')",
              ['e' => (string) $s['e']]);
            $stopped++;
        } catch (\Throwable $e) {}
    }
}

printf("\nСДЕЛАНО\n%s\n  снято с очереди: %s\n  адресов закрыто: %s\n", $line,
    number_format($off, 0, '.', ' '), number_format($stopped, 0, '.', ' '));
