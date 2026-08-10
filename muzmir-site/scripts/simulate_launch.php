<?php
/**
 * ПОЛНАЯ РЕПЕТИЦИЯ ЗАПУСКА НА КОПИИ БАЗЫ.
 *
 * Отвечает на вопрос «что произойдёт в 10:00» не рассуждением, а прогоном:
 * берёт копию боевой базы, проигрывает на ней все волны и показывает результат.
 *
 * НАРУЖУ НЕ УХОДИТ НИЧЕГО:
 *   • волны ВК прогоняются в сухом режиме (launch_fire(dry=true)) — ни постов,
 *     ни сторис, ни сообщений в личку;
 *   • почтовая волна выполняется по-настоящему, но она только КЛАДЁТ письма
 *     в очередь; отправкой занимается отдельный крон, который здесь не зовётся;
 *   • всё это происходит на копии /tmp/sim_launch.sqlite — боевая база
 *     не меняется вообще (в том числе пароли участников).
 *
 * Запуск: php scripts/simulate_launch.php
 */
declare(strict_types=1);
if (PHP_SAPI !== 'cli') { fwrite(STDERR, "только из командной строки\n"); exit(1); }

define('BASE_PATH', dirname(__DIR__));
$CFG = require BASE_PATH . '/config.php';

// ── Копия базы ──────────────────────────────────────────────────────────────
$src = (string) $CFG['db_path'];
$dst = '/tmp/sim_launch.sqlite';
foreach ([$dst, $dst . '-wal', $dst . '-shm'] as $f) @unlink($f);
if (!@copy($src, $dst)) { fwrite(STDERR, "не удалось скопировать базу\n"); exit(1); }
foreach (['-wal', '-shm'] as $sfx) if (is_file($src . $sfx)) @copy($src . $sfx, $dst . $sfx);

$CFG['db_path'] = $dst;
$GLOBALS['CFG'] = $CFG;

foreach (['db', 'data', 'helpers', 'send_timing', 'newsletter', 'mailer', 'mail_campaigns',
          'kabinet_onboarding', 'club', 'launch_combo', 'launch_run', 'launch_control'] as $m) {
    $p = BASE_PATH . '/core/' . $m . '.php';
    if (is_file($p)) require_once $p;
}

echo "РЕПЕТИЦИЯ ЗАПУСКА НА КОПИИ БАЗЫ — " . date('d.m.Y H:i:s') . "\n";
echo "копия: $dst (боевая база не затрагивается)\n";
echo str_repeat('=', 80) . "\n\n";

$bad = 0;
$ok = static function (bool $good, string $what, string $detail = '') use (&$bad): void {
    if (!$good) $bad++;
    printf("  [%s] %-50s %s\n", $good ? ' ОК ' : 'СБОЙ', $what, $detail);
};

// ── 1. Волны ВК — сухой прогон ──────────────────────────────────────────────
echo "1. Посты ВКонтакте (сухой прогон, наружу ничего не идёт)\n";
$jobs = all("SELECT * FROM launch_jobs WHERE status='scheduled' ORDER BY run_at ASC, id ASC");
$vkJobs = array_values(array_filter($jobs, fn($j) => (string) $j['wave'] === 'launch_vk'));
$ok(count($vkJobs) === 4, 'заданий на посты ВК', (string) count($vkJobs));
foreach ($vkJobs as $j) {
    $ch = array_filter(array_map('trim', explode(',', (string) $j['channels'])));
    $res = launch_fire((int) $j['competition_id'], 'launch_vk', $ch, '', true);
    $rep = json_encode($res['report'] ?? [], JSON_UNESCAPED_UNICODE);
    $ok(!empty($res['ok']), 'волна ВК конкурса #' . (int) $j['competition_id'], mb_substr($rep, 0, 90));
}

// ── 2. Почтовая волна — по-настоящему, но только в очередь копии ────────────
echo "\n2. Почтовая волна (кладёт письма в очередь копии)\n";
$t0 = microtime(true);
$mailJob = null;
foreach ($jobs as $j) if ((string) $j['wave'] === 'launch_mail') { $mailJob = $j; break; }
$ok($mailJob !== null, 'задание почтовой волны найдено');
if ($mailJob) {
    $ch  = array_filter(array_map('trim', explode(',', (string) $mailJob['channels'])));
    $res = launch_fire((int) $mailJob['competition_id'], 'launch_mail', $ch, '', false);
    printf("        волна отработала за %.1f мин\n", (microtime(true) - $t0) / 60);
    $ok(!empty($res['ok']), 'волна выполнена', mb_substr(json_encode($res['report'] ?? [], JSON_UNESCAPED_UNICODE), 0, 120));
}

// ── 3. Что легло в очередь ──────────────────────────────────────────────────
echo "\n3. Очередь после волны\n";
$q  = (int) scalar("SELECT COUNT(*) FROM mail_queue WHERE status='queued' AND COALESCE(priority,0)>0");
$ok($q > 7000, 'массовых писем в очереди', (string) $q);
// Дубли считаем ВНУТРИ волны этого месяца: письма прошлых кампаний (в т.ч. снятые)
// к делу не относятся — у них своя строка рассылки и свой адресат.
$nlId = (int) (scalar("SELECT id FROM newsletters WHERE audience=? ORDER BY id DESC LIMIT 1", ['combo:' . date('Y-m')]) ?? 0);
$dups = (int) scalar("SELECT COUNT(*) FROM (SELECT to_email FROM mail_queue
                        WHERE newsletter_id=? AND status IN ('queued','sent')
                        GROUP BY to_email HAVING COUNT(*)>1)", [$nlId]);
$ok($dups === 0, 'ни одному адресу не поставлено два письма волны', $dups ? "дублей: $dups" : '');
$tok = (int) scalar("SELECT COUNT(*) FROM mail_queue WHERE COALESCE(priority,0)>0 AND (body LIKE '%{{%' OR subject LIKE '%{{%')");
$ok($tok === 0, 'нет неподставленных меток {{...}} в письмах', $tok ? "писем с метками: $tok" : '');
$mark = (int) scalar("SELECT COUNT(*) FROM mail_queue WHERE COALESCE(priority,0)>0 AND body LIKE '%БЛОК:%'");
$ok($mark === 0, 'служебные метки блоков в письма не попали', $mark ? "писем с метками: $mark" : '');
$noname = (int) scalar("SELECT COUNT(*) FROM mail_queue WHERE COALESCE(priority,0)>0 AND COALESCE(to_name,'')=''");
printf("        писем без имени получателя (обращение «участник»): %d\n", $noname);

// Персонализация: пароль в письме должен подходить к паролю в базе копии.
$row = one("SELECT to_email, body FROM mail_queue WHERE COALESCE(priority,0)>0 AND body LIKE '%Временный пароль%' LIMIT 1");
if (!$row) $row = one("SELECT to_email, body FROM mail_queue WHERE COALESCE(priority,0)>0 LIMIT 1");
if ($row && preg_match('~([A-Za-z0-9]{8,16})~', (string) preg_replace('~<[^>]+>~', ' ', (string) $row['body']), $mm)) {
    // Точную проверку пароля делаем ниже перебором кандидатов из письма.
    $cands = [];
    preg_match_all('~>\s*([A-Za-z0-9]{8,16})\s*<~', (string) $row['body'], $c2);
    foreach ($c2[1] ?? [] as $cand) $cands[$cand] = true;
    $hash = (string) (scalar("SELECT password_hash FROM users WHERE LOWER(email)=?", [mb_strtolower((string) $row['to_email'])]) ?? '');
    $hit = false;
    foreach (array_keys($cands) as $cand) if ($hash !== '' && password_verify($cand, $hash)) { $hit = true; break; }
    $ok($hit, 'пароль из письма реально подходит к аккаунту', $hit ? (string) $row['to_email'] : 'не совпал (проверить вручную)');
}

// ── 4. Кому каким ящиком пойдёт ─────────────────────────────────────────────
echo "\n4. Маршрутизация и квоты\n";
$subj = (string) (scalar("SELECT subject FROM mail_queue WHERE COALESCE(priority,0)>0 LIMIT 1") ?? '');
$pool = mail_pool_for(['priority' => 5, 'subject' => $subj]);
$ok($pool === 'bulk', 'массовое письмо идёт пулом рассылки', "пул=$pool");
$chain = array_map(fn($a) => (string) $a['user'], mail_fallback_accounts([], 'bulk'));
$ok(count($chain) >= 2, 'ящиков в цепочке', implode(' → ', $chain));
$perDay = nl_ramp_peak();
$days = $perDay > 0 ? (int) ceil($q / $perDay) : 0;
printf("        при потолке %d писем/день база пройдётся за ~%d дней отправки\n", $perDay, $days);
printf("        темп: одно письмо в %d сек с каждого ящика, по %d на ящик в день\n", nl_box_gap_sec(), nl_per_box_cap());

// ── 5. Смежная автоматика не должна дублировать волны ───────────────────────
echo "\n5. Старая автоматика уступает пульту\n";
$panelOwns = (int) scalar("SELECT COUNT(*) FROM launch_jobs WHERE status IN ('scheduled','running','done') AND strftime('%Y-%m', run_at)=?", [date('Y-m')]);
$ok($panelOwns > 0, 'пульт владеет кампанией месяца (mailings.php отойдёт в сторону)', "заданий: $panelOwns");
$resOwns = (int) scalar("SELECT COUNT(*) FROM launch_jobs WHERE wave='results' AND status IN ('scheduled','running','done') AND strftime('%Y-%m', run_at)=?", [date('Y-m')]);
$ok($resOwns > 0, 'итоги 28-го ведёт пульт (publish_results_vk отойдёт в сторону)', "заданий: $resOwns");

// ── 6. Состояние заданий после прогона ──────────────────────────────────────
echo "\n6. Задания после прогона\n";
foreach (all("SELECT wave, status, COUNT(*) n FROM launch_jobs GROUP BY 1,2 ORDER BY 1,2") as $r) {
    printf("        %-16s %-10s %d\n", $r['wave'], $r['status'], (int) $r['n']);
}

echo "\n" . str_repeat('=', 80) . "\n";
echo $bad === 0 ? "РЕПЕТИЦИЯ ПРОШЛА БЕЗ ЗАМЕЧАНИЙ.\n" : "ЗАМЕЧАНИЙ: $bad\n";
echo "Копия базы оставлена в $dst — можно посмотреть письма глазами.\n";
exit($bad === 0 ? 0 : 1);
