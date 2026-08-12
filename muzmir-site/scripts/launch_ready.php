<?php
/**
 * ПРЕДПОЛЁТНАЯ ПРОВЕРКА ЗАПУСКА (только чтение + мягкая миграция схемы).
 *
 * Отвечает на один вопрос: «когда наступит час запуска, всё сработает само?»
 * Ничего не отправляет и не публикует.
 *
 * Запуск на проде:  cd /var/www/muzmir && php scripts/launch_ready.php
 * Код выхода: 0 — замечаний нет, 1 — есть что разобрать.
 */
declare(strict_types=1);

define('BASE_PATH', dirname(__DIR__));
$GLOBALS['CFG'] = require BASE_PATH . '/config.php';
foreach (['db', 'data', 'helpers', 'send_timing', 'newsletter', 'mailer', 'mail_campaigns',
          'kabinet_onboarding', 'club', 'launch_combo', 'launch_run', 'launch_control'] as $m) {
    $p = BASE_PATH . '/core/' . $m . '.php';
    if (is_file($p)) require_once $p;
}

$bad = 0; $warn = 0;
$ok = static function (bool $good, string $what, string $detail = '') use (&$bad): void {
    if (!$good) $bad++;
    printf("  [%s] %-48s %s\n", $good ? ' ОК ' : 'СБОЙ', $what, $detail);
};
$note = static function (string $what, string $detail = '') use (&$warn): void {
    $warn++;
    printf("  [ ?  ] %-48s %s\n", $what, $detail);
};
$info = static function (string $s): void { printf("        %s\n", $s); };

echo "ПРЕДПОЛЁТНАЯ ПРОВЕРКА ЗАПУСКА — " . date('d.m.Y H:i:s') . " (время сервера)\n";
echo str_repeat('=', 80) . "\n\n";

// ── 1. Схема и план ─────────────────────────────────────────────────────────
echo "1. Задания запуска\n";
launch_migrate();
$cols = [];
foreach (all("PRAGMA table_info(launch_jobs)") as $r) $cols[] = (string) $r['name'];
$ok(in_array('started_at', $cols, true), 'колонка started_at (атомарный захват задания)');

$jobs = all("SELECT id, wave, channels, run_at, status FROM launch_jobs
              WHERE status IN ('scheduled','running','failed') ORDER BY run_at ASC, id ASC");
foreach ($jobs as $j) {
    printf("        #%-3d %-16s %-19s %-10s %s\n", $j['id'], $j['wave'], $j['run_at'], $j['status'], $j['channels']);
}
$sched = count(array_filter($jobs, fn($j) => $j['status'] === 'scheduled'));
$stuck = count($jobs) - $sched;
$ok($sched > 0, 'есть запланированные волны', "в плане: $sched");
$ok($stuck === 0, 'нет зависших (running) и упавших (failed) волн', $stuck ? "внимание: $stuck" : '');

// Порядок при одинаковом времени: посты ВК должны идти раньше почтовой волны
// (почта занимает минуты, ВК — секунды; иначе посты выходят с задержкой).
$vk = null; $ml = null;
foreach ($jobs as $j) {
    if ($j['status'] !== 'scheduled') continue;
    if ($j['wave'] === 'launch_vk'   && $vk === null) $vk = $j;
    if ($j['wave'] === 'launch_mail' && $ml === null) $ml = $j;
}
if ($vk && $ml) {
    $good = $vk['run_at'] < $ml['run_at'] || ($vk['run_at'] === $ml['run_at'] && (int) $vk['id'] < (int) $ml['id']);
    $ok($good, 'посты ВК выполняются раньше почтовой волны', "ВК #{$vk['id']} → почта #{$ml['id']}");
} else {
    $ok(false, 'в плане есть и посты ВК, и почтовая волна', 'одной из волн нет');
}
// Отдельных волн ВИП и кабинета быть не должно: письмо одно, объединённое.
$extra = array_filter($jobs, fn($j) => in_array($j['wave'], ['campaign_vip', 'campaign_kabinet'], true));
$ok(!$extra, 'нет отдельных волн ВИП/кабинета (письмо объединённое)', $extra ? count($extra) . ' лишних' : '');

// ── 2. Разрешения на отправку ───────────────────────────────────────────────
echo "\n2. Разрешения\n";
$mass = mass_sending_enabled();
$cronGo = '';
foreach (['/var/spool/cron/crontabs/root', '/var/spool/cron/root'] as $cf) {
    if (is_readable($cf)) {
        foreach (file($cf) as $line) {
            if (str_contains($line, 'launch_go.php') && !str_starts_with(trim($line), '#')) $cronGo = trim($line);
        }
    }
}
if ($mass) {
    $ok(true, 'массовые коммуникации включены');
} elseif ($cronGo !== '') {
    $ok(true, 'стоп-кран снимется автоматически по крону', 'launch_go.php');
    $info($cronGo);
} else {
    $ok(false, 'массовые выключены И нет крона launch_go.php',
        'ни волны, ни рассылка не пойдут — включить в пульте запуска');
}
$ok(is_file(BASE_PATH . '/scripts/launch_go.php'), 'scripts/launch_go.php на месте');
$ok(is_file(BASE_PATH . '/cron/launch_scheduler.php'), 'cron/launch_scheduler.php на месте');
$ok(is_file(BASE_PATH . '/cron/_lib.php'), 'cron/_lib.php (блокировки крона) на месте');

$w = nl_bulk_window_open();
$info('окно рассылки сейчас: ' . ($w['open'] ? 'открыто' : 'закрыто — ' . ($w['why'] ?? '')));
$d = (int) date('j');
$ok($d >= 1 && $d <= 24, 'сегодня внутри окна 1–24 числа', "число: $d");

// ── 3. Почта ────────────────────────────────────────────────────────────────
echo "\n3. Почтовые ящики и квоты\n";
$boxes = mail_fallback_accounts([], 'bulk');
$ok(count($boxes) >= 2, 'ящиков в пуле массовых', (string) count($boxes));
foreach ($boxes as $b) {
    $u = mb_strtolower((string) ($b['user'] ?? ''));
    $q = mail_account_penalty($b) ? 'В КАРАНТИНЕ' : 'здоров';
    if (mail_account_penalty($b)) $warn++;
    $info(sprintf('%-46s %-20s %s, сегодня ушло %d из %d',
        $u, (string) ($b['host'] ?? ''), $q, nl_box_sent_today($u), nl_per_box_cap()));
}
$capDay  = nl_daily_cap();
$peak    = nl_ramp_peak();
$boxCap  = nl_per_box_cap() * max(1, count($boxes));
$ok($peak > 0 && $boxCap >= $peak, 'ёмкость ящиков покрывает дневной потолок',
    "потолок $peak, ёмкость $boxCap");
$info("дневная квота СЕГОДНЯ: $capDay (день кампании " . nl_campaign_day() . ", потолок $peak)");
$info('распределение по типам: ' . json_encode(nl_daily_split(), JSON_UNESCAPED_UNICODE));

$act = (int) (scalar("SELECT COUNT(*) FROM subscribers WHERE active=1") ?? 0);
$off = (int) (scalar("SELECT COUNT(*) FROM subscribers WHERE COALESCE(active,1)=0") ?? 0);
$ok($act > 0, 'активных получателей в базе', "$act (отключено: $off)");
$dirty = (int) (scalar("SELECT COUNT(*) FROM subscribers WHERE active=1 AND (email NOT LIKE '%@%' OR email LIKE '% %')") ?? 0);
$ok($dirty === 0, 'нет мусорных адресов среди активных', $dirty ? "мусора: $dirty" : '');

// ── 4. Содержимое письма ────────────────────────────────────────────────────
echo "\n4. Объединённое письмо запуска\n";
$subj = function_exists('launch_combo_subject') ? launch_combo_subject() : '';
$ok($subj !== '', 'тема письма собирается', $subj);
$html = '';
try { $html = launch_combo_inner(true, true, 'test@example.com', 'Проверка', 'demo0000'); }
catch (\Throwable $e) { $html = ''; $info('ошибка сборки: ' . $e->getMessage()); }
$ok(strlen($html) > 3000, 'тело письма собирается', strlen($html) . ' байт');
$ok(str_contains($html, 'demo0000'), 'блок доступа в кабинет подставляет пароль');
$ok(!str_contains($html, '{{'), 'не осталось неподставленных меток {{...}}');
$ok(!preg_match('~href="[^"]*/vip["/]~', $html), 'нет ссылки на несуществующий /vip');

// Все ссылки письма должны вести на боевой домен и на существующие разделы.
preg_match_all('~href="(https?://[^"]+)"~', $html, $m);
$links = array_values(array_unique($m[1] ?? []));
$base  = rtrim((string) cfgv('base_url'), '/');
$alien = array_values(array_filter($links, fn($l) => !str_starts_with($l, $base) && !str_contains($l, 'vk.com') && !str_contains($l, 'mailto')));
$ok(!$alien, 'все ссылки ведут на свой домен или ВК', $alien ? implode(' ', array_slice($alien, 0, 3)) : count($links) . ' ссылок');

// ── 5. Конкурсы месяца ──────────────────────────────────────────────────────
echo "\n5. Конкурсы к запуску\n";
$comps = function_exists('launch_open_comps') ? launch_open_comps() : [];
$ok(count($comps) > 0, 'конкурсы месяца заведены', (string) count($comps));
foreach ($comps as $c) {
    $cover = trim((string) ($c['cover'] ?? ''));
    $has   = $cover !== '';
    if (!$has) { $bad++; }
    printf("        %-44s афиша: %s\n", mb_substr((string) $c['name'], 0, 44), $has ? 'есть' : 'НЕТ');
}

echo "\n" . str_repeat('=', 80) . "\n";
printf("Сбоев: %d, обратить внимание: %d\n", $bad, $warn);
echo $bad === 0 ? "К ЗАПУСКУ ГОТОВО.\n" : "ЕСТЬ СБОИ — разобрать до запуска.\n";
exit($bad === 0 ? 0 : 1);
