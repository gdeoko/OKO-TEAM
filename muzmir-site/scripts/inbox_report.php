<?php
/**
 * ОТЧЁТ ПО ВХОДЯЩЕЙ ПОЧТЕ ЦЕНТРА.
 *
 *   php scripts/inbox_report.php              — за последние 14 дней
 *   php scripts/inbox_report.php --days=30
 *   php scripts/inbox_report.php --show=ведомства   — развернуть один раздел целиком
 *
 * Центр читает пять ящиков: news@, novosti@, kc@, nagradi.on@ и исторический
 * kulturniy.centr.mir@mail.ru, плюс Gmail. Ответы приходят вперемешку — от
 * ведомств, от учреждений, от участников, — и вперемешку с ними идут отбойники
 * почтовых серверов. Без разбора письмо министерства теряется среди тысячи
 * «Недоставленное сообщение».
 *
 * Отчёт раскладывает входящие по тому, КТО написал, и отдельно показывает, что
 * осталось без ответа. Разбор берётся из полей, которые проставляет разборщик
 * входящих (kind, ministry_id, inst_id, user_id), а не угадывается заново.
 *
 * Ничего не отправляет и ничего не меняет.
 */
declare(strict_types=1);
if (PHP_SAPI !== 'cli') { fwrite(STDERR, "CLI only\n"); exit(1); }

define('BASE_PATH', dirname(__DIR__));
$GLOBALS['CFG'] = require BASE_PATH . '/config.php';
require_once BASE_PATH . '/core/db.php';
require_once BASE_PATH . '/core/helpers.php';

$opt = [];
foreach (array_slice($argv, 1) as $a)
    if (preg_match('~^--([a-z-]+)(?:=(.*))?$~u', $a, $m)) $opt[$m[1]] = $m[2] ?? '1';
$days  = max(1, (int) ($opt['days'] ?? 14));
$show  = trim((string) ($opt['show'] ?? ''));
$since = date('Y-m-d H:i:s', time() - $days * 86400);

$rows = all("SELECT * FROM inbox_messages WHERE received_at >= ? ORDER BY received_at DESC", [$since]);
printf("ВХОДЯЩАЯ ПОЧТА ЗА %d ДНЕЙ (с %s по %s)\nВсего писем: %d\n",
       $days, substr($since, 0, 10), date('d.m.Y'), count($rows));
if (!$rows) exit(0);

/** Кто написал. Сначала верим разборщику, затем справочникам, затем адресу. */
function ir_kind(array $r): string {
    if ((int) ($r['ministry_id'] ?? 0) > 0) return 'ведомства';
    if ((int) ($r['inst_id'] ?? 0) > 0)     return 'учреждения';
    if ((int) ($r['user_id'] ?? 0) > 0)     return 'участники';

    $em = mb_strtolower(trim((string) ($r['from_email'] ?? '')));
    if ($em === '') return 'прочее';
    if (preg_match('~^mailer-daemon@|^postmaster@|mail delivery~i', $em)) return 'отбойники';

    if (scalar("SELECT 1 FROM ministries WHERE lower(email)=? LIMIT 1", [$em]))   return 'ведомства';
    if (scalar("SELECT 1 FROM institutions WHERE lower(email)=? LIMIT 1", [$em])) return 'учреждения';
    if (scalar("SELECT 1 FROM applications WHERE lower(email)=? LIMIT 1", [$em])) return 'участники';
    if (scalar("SELECT 1 FROM users WHERE lower(email)=? LIMIT 1", [$em]))        return 'участники';

    // Ведомственные домены узнаём по виду: gov.ru, admin-*, *.ru региональных органов.
    if (preg_match('~@(.+\.)?(gov|mos|mkrf|culture|minkult|adm|admin|sedo|sed)[.a-z0-9-]*\.(ru|su)$~i', $em)) return 'ведомства';
    if ((string) ($r['kind'] ?? '') === 'service' || (int) ($r['is_auto'] ?? 0) === 1) return 'служебные';
    return 'прочее';
}

$byKind = []; $byBox = []; $bucket = [];
foreach ($rows as $r) {
    $k = ir_kind((array) $r);
    $byKind[$k] = ($byKind[$k] ?? 0) + 1;
    $b = (string) ($r['mailbox'] ?? '—');
    $byBox[$b] = ($byBox[$b] ?? 0) + 1;
    $bucket[$k][] = $r;
}

echo "\nКТО ПИШЕТ\n";
arsort($byKind);
foreach ($byKind as $k => $n) printf("  %-12s %5d\n", $k, $n);

echo "\nНА КАКОЙ ЯЩИК\n";
arsort($byBox);
foreach ($byBox as $b => $n) printf("  %-12s %5d\n", $b, $n);

/* ЖИВЫЕ ПИСЬМА — ЭТО РАБОТА. Отбойники и служебные показываем числом: они
 * важны как сигнал о доставке, но отвечать на них некому. */
$order = ['ведомства', 'партнёры', 'учреждения', 'участники', 'прочее'];
foreach ($order as $k) {
    $list = $bucket[$k] ?? [];
    if (!$list) continue;
    $limit = ($show !== '' && mb_strtolower($show) === mb_strtolower($k)) ? 1000 : 12;
    printf("\n=== %s — %d\n", mb_strtoupper($k), count($list));
    $n = 0;
    foreach ($list as $r) {
        if ($n >= $limit) break;
        $noAnswer = trim((string) ($r['reply_sent_at'] ?? '')) === ''
                 && (string) ($r['handled_by'] ?? '') !== 'skip';
        printf("  %s  %-30s %-58s%s\n",
               substr((string) $r['received_at'], 0, 16),
               mb_substr((string) $r['from_email'], 0, 30),
               mb_substr(trim((string) ($r['subject'] ?? '')) ?: '(без темы)', 0, 58),
               $noAnswer ? '  ← без ответа' : '');
        $n++;
    }
    if (count($list) > $limit) printf("  … и ещё %d (показать: --show=%s)\n", count($list) - $limit, $k);
}

/* ОТБОЙНИКИ — ГЛАВНЫЙ СИГНАЛ О ТОМ, ЧТО ПИСЬМА НЕ ДОХОДЯТ. */
$bounces = $bucket['отбойники'] ?? [];
if ($bounces) {
    printf("\n=== ОТБОЙНИКИ ПОЧТОВЫХ СЕРВЕРОВ — %d\n", count($bounces));
    $bySrv = [];
    foreach ($bounces as $r) {
        $em = mb_strtolower((string) $r['from_email']);
        $srv = preg_replace('~^.*@~', '', $em);
        $bySrv[$srv] = ($bySrv[$srv] ?? 0) + 1;
    }
    arsort($bySrv);
    foreach (array_slice($bySrv, 0, 8, true) as $s => $n) printf("  %-28s %5d\n", $s, $n);
}

$svc = $byKind['служебные'] ?? 0;
if ($svc) printf("\nСлужебные и автоответы: %d — ответа не требуют.\n", $svc);

$wait = 0;
foreach ($order as $k) foreach ($bucket[$k] ?? [] as $r)
    if (trim((string) ($r['reply_sent_at'] ?? '')) === '' && (string) ($r['handled_by'] ?? '') !== 'skip') $wait++;
printf("\nЖДУТ ОТВЕТА: %d письмо(писем) от живых людей.\n", $wait);
