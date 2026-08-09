<?php
/**
 * ТЕСТОВАЯ ОТПРАВКА объединённого письма запуска владельцу.
 *
 * Показывает письмо ровно в том виде, в каком его получат участники 10 августа:
 * конкурсы месяца → доступ в личный кабинет → приглашение в клуб.
 *
 * БЕЗОПАСНО:
 *   • пароль в письме ПОКАЗНОЙ — users.password_hash никому не меняется
 *     (в отличие от боевой волны, которая выдаёт временный пароль тем, кто
 *      ещё ни разу не входил);
 *   • письмо уходит синхронно через пул 'tx' и НЕ попадает в mail_queue,
 *     значит не тратит дневную квоту массовых и не зависит от окна 1-24;
 *   • ничего не пишется в newsletters / launch_jobs.
 *
 * Тело письма — БАЙТ В БАЙТ то, что уйдёт людям. Отличается только тема:
 * к ней спереди добавлено «[ТЕСТ]», чтобы письмо не путалось с боевым.
 *
 * Запуск: php scripts/test_combo_mail.php [адрес1] [адрес2] ...
 * Без аргументов — на адреса владельца из базы (owner/admin).
 */
declare(strict_types=1);

define('BASE_PATH', dirname(__DIR__));
$GLOBALS['CFG'] = require BASE_PATH . '/config.php';
foreach (['db', 'helpers', 'send_timing', 'newsletter', 'mailer', 'mail_campaigns',
          'kabinet_onboarding', 'club', 'launch_combo'] as $m) {
    $p = BASE_PATH . '/core/' . $m . '.php';
    if (is_file($p)) require_once $p;
}

$to = array_values(array_filter(array_slice($argv, 1), fn($a) => str_contains($a, '@')));
if (!$to) {
    foreach (all("SELECT email FROM users WHERE role IN ('owner','admin') AND COALESCE(email,'')<>'' ORDER BY id") as $r) {
        $to[] = (string) $r['email'];
    }
}
$to = array_values(array_unique($to));
if (!$to) { fwrite(STDERR, "Не найдено ни одного адреса\n"); exit(1); }

echo "Тестовая отправка объединённого письма запуска\n";
echo str_repeat('=', 68) . "\n";
echo "Адреса: " . implode(', ', $to) . "\n\n";

$subject = launch_combo_subject();
echo "Тема (боевая):  $subject\n";
echo "Тема (тестовая): [ТЕСТ] $subject\n\n";

// Собираем письмо ровно как боевое: оба блока включены, чтобы было видно всё.
// Пароль показной — реальный никому не меняем.
$demoPass = 'demo' . random_int(1000, 9999);

$ok = 0;
foreach ($to as $addr) {
    $name = (string) (one("SELECT full_name FROM users WHERE LOWER(email)=?", [mb_strtolower($addr)])['full_name'] ?? '');
    if ($name === '') $name = 'участник';

    $inner = launch_combo_inner(true, true, $addr, $name, $demoPass);

    // Ссылка отписки — настоящая, чтобы проверить и её.
    [$tok, ] = nl_ensure_subscriber(mb_strtolower($addr), $name, 'newsletter');
    $unsub = rtrim((string) cfgv('base_url'), '/') . '/api/v1/unsubscribe.php?token=' . urlencode((string) $tok);

    $body = nl_wrap_email($inner, $unsub, '', mb_substr(trim(strip_tags($inner)), 0, 120), ['vip' => false]);

    $sent = false;
    try { $sent = (bool) mail_send_failover($addr, '[ТЕСТ] ' . $subject, $body, ['pool' => 'tx']); }
    catch (\Throwable $e) { echo "  ОШИБКА $addr: " . $e->getMessage() . "\n"; }

    printf("  %-34s %s  (%d КБ)\n", $addr, $sent ? 'ОТПРАВЛЕНО' : 'НЕ УШЛО: ' . mail_last_error(),
           (int) round(strlen($body) / 1024));
    if ($sent) $ok++;
}

echo "\nУспешно: $ok из " . count($to) . "\n";
echo "Пароль в письме показной ($demoPass) — ничей реальный пароль не менялся.\n";
