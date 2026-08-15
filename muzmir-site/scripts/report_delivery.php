<?php
/**
 * ДОХОДЯТ ЛИ НАШИ ПИСЬМА — ОТЧЁТ ПО ДАННЫМ СЕРВИСА РАССЫЛОК.
 *
 * В своих ящиках ответов почти нет, и по одному этому нельзя понять, молчат ли
 * получатели или письма до них вовсе не доходят. Сервис рассылок знает правду:
 * он ведёт список подавленных адресов — несуществующие ящики, жалобы на спам,
 * отписки. Здесь этот список забирается целиком, раскладывается по причинам и
 * сверяется с нашей базой: сколько таких адресов у нас ещё числится живыми и
 * сколько писем к ним стоит в очереди прямо сейчас.
 *
 *   php scripts/report_delivery.php            — только отчёт
 *   php scripts/report_delivery.php --apply    — ещё и погасить мёртвые адреса в базе
 */
declare(strict_types=1);
if (PHP_SAPI !== 'cli') { fwrite(STDERR, "CLI only\n"); exit(1); }

define('BASE_PATH', dirname(__DIR__));
$GLOBALS['CFG'] = require BASE_PATH . '/config.php';
require_once BASE_PATH . '/core/db.php';
require_once BASE_PATH . '/core/helpers.php';

$line  = str_repeat('=', 78);
$key   = trim((string) cfgv('unisender_api_key', ''));
$base  = rtrim((string) cfgv('unisender_api_url', 'https://go2.unisender.ru/ru/transactional/api/v1'), '/') . '/';
$apply = in_array('--apply', $argv, true);

/** Запрос к API сервиса рассылок. */
function uni(string $base, string $key, string $ep, array $params = []): array {
    $ch = curl_init($base . $ep);
    curl_setopt_array($ch, [
        CURLOPT_POST => true,
        CURLOPT_POSTFIELDS => json_encode(['api_key' => $key] + $params, JSON_UNESCAPED_UNICODE),
        CURLOPT_HTTPHEADER => ['Content-Type: application/json'],
        CURLOPT_RETURNTRANSFER => true, CURLOPT_TIMEOUT => 30,
    ]);
    $raw = (string) curl_exec($ch);
    $code = (int) curl_getinfo($ch, CURLINFO_RESPONSE_CODE);
    curl_close($ch);
    return ['code' => $code, 'raw' => $raw, 'data' => json_decode($raw, true)];
}

/* ── 1. Что ушло из нашей очереди ─────────────────────────────────────────── */
echo "СКОЛЬКО ПИСЕМ УШЛО ИЗ НАШЕЙ ОЧЕРЕДИ\n$line\n";
foreach (all("SELECT status, COUNT(*) n FROM mail_queue GROUP BY 1 ORDER BY 2 DESC") as $r) {
    printf("  %-12s %d\n", (string) $r['status'], (int) $r['n']);
}
try {
    foreach (all("SELECT COALESCE(campaign_type,'(без типа)') t, COUNT(*) n FROM mail_queue
                  WHERE status='sent' GROUP BY 1 ORDER BY 2 DESC LIMIT 12") as $r) {
        printf("    отправлено, тип %-16s %d\n", (string) $r['t'], (int) $r['n']);
    }
} catch (\Throwable $e) {}

if ($key === '') { echo "\nключ сервиса рассылок не задан — дальше проверять нечем\n"; exit(1); }

/* ── 2. Подавленные адреса ────────────────────────────────────────────────── */
echo "\nПОДАВЛЕННЫЕ АДРЕСА В СЕРВИСЕ РАССЫЛОК\n$line\n";
$causesRu = [
    'permanent_unavailable' => 'ящика не существует',
    'temporary_unavailable' => 'ящик временно недоступен',
    'spam_folder'           => 'письмо попало в папку «Спам»',
    'spam_complaint'        => 'пожаловались на спам',
    'unsubscribed'          => 'отписались',
    'blocked'               => 'адрес заблокирован',
];
$by = []; $emails = [];
$cursor = ''; $pages = 0;
do {
    $p = ['limit' => 100];
    if ($cursor !== '') $p['cursor'] = $cursor;
    $r = uni($base, $key, 'suppression/list.json', $p);
    if ($r['code'] >= 400 || !is_array($r['data'])) {
        echo '  сервис ответил HTTP ' . $r['code'] . ': ' . mb_substr(trim($r['raw']), 0, 200) . "\n";
        break;
    }
    $rows = $r['data']['suppressions'] ?? [];
    foreach ($rows as $s) {
        $e = mb_strtolower(trim((string) ($s['email'] ?? '')));
        if ($e === '') continue;
        $c = (string) ($s['cause'] ?? 'неизвестно');
        $by[$c] = ($by[$c] ?? 0) + 1;
        $emails[$e] = $c;
    }
    $cursor = (string) ($r['data']['cursor'] ?? '');
    $pages++;
} while ($cursor !== '' && $pages < 200 && $rows);

arsort($by);
$total = array_sum($by);
foreach ($by as $c => $n) printf("  %-28s %6d  %s\n", $c, $n, $causesRu[$c] ?? '');
printf("  %-28s %6d\n", 'ВСЕГО подавлено', $total);
if ($pages >= 200) echo "  (показаны первые 20 000 адресов — список длиннее)\n";

/* ── 3. Сверка с нашей базой ──────────────────────────────────────────────── */
echo "\nСКОЛЬКО ИЗ НИХ МЫ ЕЩЁ СЧИТАЕМ ЖИВЫМИ\n$line\n";
if (!$emails) { echo "  подавленных адресов не получено\n"; exit(0); }

// Временную недоступность в мёртвые не записываем: ящик переполнен или сервер
// адресата лежал — через неделю письмо уйдёт нормально. Гасим только то, что
// не оживёт: несуществующий ящик, жалоба на спам, отписка.
$dead = [];
foreach ($emails as $e => $c) {
    if (in_array($c, ['permanent_unavailable', 'complained', 'spam_complaint', 'unsubscribed', 'blocked'], true)) $dead[] = $e;
}
printf("  мёртвых навсегда: %d, временно недоступных: %d\n", count($dead), count($emails) - count($dead));

$chunks = array_chunk($dead, 400);
$hitQueue = 0; $hitList = [];
foreach ($chunks as $ch) {
    $in = implode(',', array_fill(0, count($ch), '?'));
    try {
        $hitQueue += (int) (scalar("SELECT COUNT(*) FROM mail_queue WHERE status='queued' AND LOWER(to_email) IN ($in)", $ch) ?? 0);
    } catch (\Throwable $e) {}
    foreach ([
        'institutions' => "SELECT COUNT(*) FROM institutions WHERE status NOT IN ('bounced','unsubscribed','banned') AND LOWER(email) IN ($in)",
        'subscribers'  => "SELECT COUNT(*) FROM subscribers  WHERE active=1 AND LOWER(email) IN ($in)",
        'users'        => "SELECT COUNT(*) FROM users        WHERE LOWER(email) IN ($in)",
    ] as $tbl => $sql) {
        try {
            $n = (int) (scalar($sql, $ch) ?? 0);
            if ($n) $hitList[$tbl] = ($hitList[$tbl] ?? 0) + $n;
        } catch (\Throwable $e) {}
    }
}
printf("  писем к мёртвым адресам ждёт в очереди: %d\n", $hitQueue);
foreach ($hitList as $t => $n) {
    $what = ['institutions' => 'учреждений ещё в рассылке', 'subscribers' => 'подписчиков ещё активны',
             'users' => 'участников с таким адресом (диплом до них не дойдёт)'][$t] ?? $t;
    printf("  %-52s %d\n", $what, $n);
}

/* ── 4. Гасим, если попросили ─────────────────────────────────────────────── */
if (!$apply) { echo "\n(ничего не меняли — запустите с --apply, чтобы снять мёртвые адреса с рассылки)\n"; exit(0); }

echo "\nСНИМАЕМ МЁРТВЫЕ АДРЕСА С РАССЫЛКИ\n$line\n";
$stat = ['очередь' => 0, 'учреждения' => 0, 'подписчики' => 0];
$chg = static fn(): int => (int) db()->query("SELECT changes()")->fetchColumn();
foreach ($chunks as $ch) {
    $in = implode(',', array_fill(0, count($ch), '?'));
    // Каждый запрос отдельно: если один упадёт, остальные должны отработать.
    foreach ([
        'очередь'    => "UPDATE mail_queue SET status='failed', error='адрес подавлен сервисом рассылок'
                          WHERE status='queued' AND LOWER(to_email) IN ($in)",
        'учреждения' => "UPDATE institutions SET status='bounced', updated_at=datetime('now')
                          WHERE status NOT IN ('bounced','unsubscribed','banned') AND LOWER(email) IN ($in)",
        'подписчики' => "UPDATE subscribers SET active=0 WHERE active=1 AND LOWER(email) IN ($in)",
    ] as $what => $sql) {
        try { q($sql, $ch); $stat[$what] += $chg(); }
        catch (\Throwable $e) { echo '  ' . $what . ': ' . $e->getMessage() . "\n"; }
    }
}
foreach ($stat as $what => $n) printf("  %-14s снято: %d\n", $what, $n);
// Участников не трогаем автоматически: у человека может быть заявка и оплата,
// и решение «его адрес мёртв» должен принимать человек, а не скрипт.
echo "  участники не изменены — их адреса разбираются вручную\n";
