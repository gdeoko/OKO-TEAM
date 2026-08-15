<?php
/**
 * ЧТО СЕЙЧАС СТОИТ В ОЧЕРЕДИ ПИСЕМ И КОГДА ЭТО УЙДЁТ.
 *
 * В очереди больше одиннадцати тысяч писем. Пока не видно, что это за письма,
 * кому они и с какой скоростью уходят, любая оценка «всё в порядке» — гадание.
 * Здесь очередь разложена по типам и срокам, посчитан реальный темп отправки за
 * последние сутки и срок, за который очередь разойдётся. Отдельно ищутся вещи,
 * которые уходить не должны: письма отписавшимся, мёртвым адресам и дубли.
 *
 *   php scripts/report_queue.php
 */
declare(strict_types=1);
if (PHP_SAPI !== 'cli') { fwrite(STDERR, "CLI only\n"); exit(1); }

define('BASE_PATH', dirname(__DIR__));
$GLOBALS['CFG'] = require BASE_PATH . '/config.php';
require_once BASE_PATH . '/core/db.php';
require_once BASE_PATH . '/core/helpers.php';

$line = str_repeat('=', 78);

/* ── 1. Из чего состоит очередь ───────────────────────────────────────────── */
echo "ОЧЕРЕДЬ ПИСЕМ\n$line\n";
foreach (all("SELECT status, COUNT(*) n FROM mail_queue GROUP BY 1 ORDER BY 2 DESC") as $r) {
    printf("  %-10s %6d\n", (string) $r['status'], (int) $r['n']);
}

echo "\nЧТО ИМЕННО ЖДЁТ ОТПРАВКИ\n$line\n";
foreach (all("SELECT COALESCE(NULLIF(campaign_type,''),'(без типа)') t, COUNT(*) n,
                     MIN(COALESCE(NULLIF(scheduled_at,''),created_at)) s1,
                     MAX(COALESCE(NULLIF(scheduled_at,''),created_at)) s2
                FROM mail_queue WHERE status='queued' GROUP BY 1 ORDER BY 2 DESC") as $r) {
    printf("  %-14s %6d   с %s по %s\n", (string) $r['t'], (int) $r['n'],
        substr((string) $r['s1'], 0, 16), substr((string) $r['s2'], 0, 16));
}

echo "\nПО ТЕМАМ (первые десять)\n$line\n";
foreach (all("SELECT subject, COUNT(*) n FROM mail_queue WHERE status='queued'
              GROUP BY 1 ORDER BY 2 DESC LIMIT 10") as $r) {
    printf("  %6d  %s\n", (int) $r['n'], mb_substr((string) $r['subject'], 0, 62));
}

/* ── 2. Темп и срок ───────────────────────────────────────────────────────── */
echo "\nТЕМП ОТПРАВКИ\n$line\n";
$sent24 = (int) (scalar("SELECT COUNT(*) FROM mail_queue WHERE status='sent' AND sent_at > datetime('now','-1 day')") ?? 0);
$sent1h = (int) (scalar("SELECT COUNT(*) FROM mail_queue WHERE status='sent' AND sent_at > datetime('now','-1 hour')") ?? 0);
$queued = (int) (scalar("SELECT COUNT(*) FROM mail_queue WHERE status='queued'") ?? 0);
printf("  за последний час:   %d\n  за последние сутки: %d\n", $sent1h, $sent24);
if ($sent24 > 0) {
    printf("  при таком темпе очередь разойдётся за %.1f дн.\n", $queued / $sent24);
} else {
    echo "  за сутки не ушло ни одного письма — очередь стоит\n";
}
// Ближайшее письмо: если оно в прошлом, а очередь стоит, значит что-то держит.
$next = (string) (scalar("SELECT MIN(COALESCE(NULLIF(scheduled_at,''),created_at)) FROM mail_queue WHERE status='queued'") ?? '');
if ($next !== '') printf("  самое раннее письмо в очереди: %s\n", substr($next, 0, 16));

/* ── 3. Что уходить не должно ─────────────────────────────────────────────── */
echo "\nЧЕГО В ОЧЕРЕДИ БЫТЬ НЕ ДОЛЖНО\n$line\n";
$checks = [
    'письма отписавшимся' => "SELECT COUNT(*) FROM mail_queue q JOIN subscribers s ON LOWER(s.email)=LOWER(q.to_email)
                               WHERE q.status='queued' AND s.active=0",
    'письма адресам с жёстким отказом' => "SELECT COUNT(*) FROM mail_queue q
                               JOIN mail_events e ON LOWER(e.email)=LOWER(q.to_email)
                               WHERE q.status='queued' AND e.status IN ('hard_bounced','spam')",
    'письма учреждениям, снятым с рассылки' => "SELECT COUNT(*) FROM mail_queue q
                               JOIN institutions i ON LOWER(i.email)=LOWER(q.to_email)
                               WHERE q.status='queued' AND i.status IN ('bounced','unsubscribed','banned')",
    'письма на наши же ящики' => "SELECT COUNT(*) FROM mail_queue WHERE status='queued'
                               AND (LOWER(to_email) LIKE 'kc@%' OR LOWER(to_email) LIKE 'news@%'
                                    OR LOWER(to_email) LIKE 'novosti@%' OR LOWER(to_email) LIKE 'nagradi%')",
    'письма без адреса' => "SELECT COUNT(*) FROM mail_queue WHERE status='queued' AND TRIM(COALESCE(to_email,''))=''",
];
$bad = 0;
foreach ($checks as $what => $sql) {
    try { $n = (int) (scalar($sql) ?? 0); } catch (\Throwable $e) { $n = -1; }
    if ($n > 0) $bad += $n;
    printf("  %-42s %s\n", $what, $n < 0 ? 'не проверить' : ($n === 0 ? 'нет' : $n));
}

// Дубли: одно и то же письмо одному адресу больше одного раза.
$dups = all("SELECT to_email, subject, COUNT(*) n FROM mail_queue WHERE status='queued'
             GROUP BY LOWER(to_email), subject HAVING n > 1 ORDER BY n DESC LIMIT 10");
printf("  %-42s %s\n", 'повторы одного письма одному адресу', $dups ? count($dups) . ' случаев' : 'нет');
foreach ($dups as $d) printf("      %sx  %-32s %s\n", $d['n'], mb_substr((string) $d['to_email'], 0, 32),
    mb_substr((string) $d['subject'], 0, 34));

/* ── 4. Отказы ────────────────────────────────────────────────────────────── */
echo "\nПОЧЕМУ ПИСЬМА НЕ УХОДИЛИ\n$line\n";
$fails = all("SELECT COALESCE(NULLIF(error,''),'(без причины)') e, COUNT(*) n FROM mail_queue
              WHERE status='failed' GROUP BY 1 ORDER BY 2 DESC LIMIT 8");
if (!$fails) echo "  отказов нет\n";
foreach ($fails as $f) printf("  %5d  %s\n", (int) $f['n'], mb_substr((string) $f['e'], 0, 66));

echo "\n$line\n";
echo $bad === 0 ? "Лишнего в очереди нет.\n" : "ЛИШНИХ ПИСЕМ В ОЧЕРЕДИ: $bad\n";
