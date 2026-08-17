<?php
/**
 * КТО СИДИТ НА ВЕДОМСТВЕННОМ ШЛЮЗЕ И СКОЛЬКО ИХ.
 *
 * Пересчитывает список доменов, которым сервис рассылок недоступен, по журналу
 * событий доставки, и показывает, сколько писем это касается. Запускается
 * кроном раз в сутки: шлюзы перенастраивают, и список должен стареть сам.
 *
 *   php scripts/mail_domain_policy.php            — пересчитать и показать
 *   php scripts/mail_domain_policy.php --show     — только показать
 */
declare(strict_types=1);
if (PHP_SAPI !== 'cli') { fwrite(STDERR, "CLI only\n"); exit(1); }

define('BASE_PATH', dirname(__DIR__));
$GLOBALS['CFG'] = require BASE_PATH . '/config.php';
require_once BASE_PATH . '/core/db.php';
require_once BASE_PATH . '/core/helpers.php';
require_once BASE_PATH . '/core/mail_domain_policy.php';

$line = str_repeat('=', 78);
echo "ДОМЕНЫ С ЗАКРЫТЫМ РАССЫЛОЧНЫМ КАНАЛОМ\n$line\n";

if (!in_array('--show', $argv, true)) {
    $r = mdp_learn(14);
    printf("  добавлено: %d%s\n", count($r['added']), $r['added'] ? ' (' . implode(', ', $r['added']) . ')' : '');
    printf("  снято:     %d%s\n", count($r['removed']), $r['removed'] ? ' (' . implode(', ', $r['removed']) . ')' : '');
}

mdp_ensure();
$rows = all("SELECT * FROM mail_domain_policy WHERE policy='official' ORDER BY bounced DESC");
if (!$rows) { echo "\n  список пуст: все домены принимают рассылку\n"; exit(0); }

echo "\n  домен                           отбито  писем в очереди  причина\n";
$queued = 0;
foreach ($rows as $r) {
    $d = (string) $r['domain'];
    $n = (int) (scalar("SELECT COUNT(*) FROM mail_queue
                         WHERE status='queued' AND COALESCE(priority,0)>0
                           AND LOWER(SUBSTR(to_email, INSTR(to_email,'@') + 1)) = ?", [$d]) ?? 0);
    $queued += $n;
    printf("  %-30s %6d  %15d  %s\n", $d, (int) $r['bounced'], $n,
        mb_substr((string) $r['reason'], 0, 40));
}

$cap = max(1, (int) setting('nl_gov_daily', '150'));
printf("\n%s\n  писем к отправке через почту центра: %s, норма в сутки %d → %d дн.\n", $line,
    number_format($queued, 0, '.', ' '), $cap, (int) ceil($queued / $cap));
