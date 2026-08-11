<?php
/**
 * СТОРОЖ ОПЛАЧЕННОГО ОБЪЁМА СЕРВИСА РАССЫЛОК.
 *
 * Тариф оплачен помесячно, а волна растёт каждый день, и кончится квота не в
 * конце месяца, а на третий-четвёртый день. Узнать об этом по молчанию очереди —
 * худший вариант: письма встанут, а причина будет видна только в логе.
 *
 * Поэтому раз в сутки считаем расход и предупреждаем владельца заранее: на 70%,
 * на 90% и в момент, когда объём выбран. Предупреждение каждого уровня уходит
 * один раз за месяц — сторож не должен превращаться в ежедневный спам.
 *
 * Крон: раз в сутки утром, до открытия окна рассылки.
 *   0 8 * * * php /var/www/muzmir/cron/quota_watch.php
 *
 * Вручную:
 *   php cron/quota_watch.php          — проверить и предупредить при необходимости
 *   php cron/quota_watch.php status   — только показать расход
 *   php cron/quota_watch.php test     — прислать отчёт владельцу прямо сейчас
 */

declare(strict_types=1);
if (PHP_SAPI !== 'cli') { fwrite(STDERR, "CLI only\n"); exit(1); }

define('BASE_PATH', dirname(__DIR__));
$GLOBALS['CFG'] = require BASE_PATH . '/config.php';
require_once BASE_PATH . '/core/db.php';
require_once BASE_PATH . '/core/helpers.php';
require_once BASE_PATH . '/core/newsletter.php';
require_once __DIR__ . '/_lib.php';

const JOB = 'quota_watch';

$mode = strtolower(trim((string) ($argv[1] ?? 'auto')));

/** Отчёт о расходе — одинаковый и для лога, и для сообщения владельцу. */
function qw_report(array $u): string {
    $left = $u['left'] < 0 ? 'без ограничения' : (string) $u['left'];

    // Сколько дней протянем при сегодняшнем темпе. Считаем по факту последних
    // трёх суток, а не по плану: план растёт, а квота одна.
    $recent = (int) (scalar("SELECT COUNT(*) FROM mail_queue
                              WHERE status='sent' AND COALESCE(priority,0) > 0
                                AND sent_at >= datetime('now','-3 day')") ?? 0);
    $perDay = max(1, (int) round($recent / 3));
    $days   = $u['left'] < 0 ? 0 : (int) floor($u['left'] / $perDay);

    $s = sprintf("Оплаченный объём рассылок: %d из %d (%d%%), остаток %s.",
                 $u['sent'], $u['cap'], $u['pct'], $left);
    if ($u['left'] >= 0) {
        $s .= sprintf("\nТемп последних суток: около %d писем в день — остатка хватит примерно на %d %s.",
                      $perDay, $days, qw_plural($days, 'день', 'дня', 'дней'));
    }
    return $s;
}

function qw_plural(int $n, string $one, string $few, string $many): string {
    $n = abs($n) % 100;
    if ($n >= 11 && $n <= 14) return $many;
    $n %= 10;
    if ($n === 1) return $one;
    if ($n >= 2 && $n <= 4) return $few;
    return $many;
}

/** Сообщение владельцу — в Телеграм и на официальную почту центра. */
function qw_notify(string $title, string $body): void {
    if (is_file(BASE_PATH . '/core/notify_owner.php')) {
        require_once BASE_PATH . '/core/notify_owner.php';
        if (function_exists('owner_tg_send')) {
            try { owner_tg_send('analytics', '<b>' . $title . '</b>' . "\n" . $body); } catch (\Throwable $e) {}
        }
    }
    $to = trim((string) cfgv('owner_email', (string) cfgv('org_email', '')));
    if ($to !== '' && function_exists('mail_send')) {
        try {
            mail_send($to, $title, '<p>' . nl2br(h($body)) . '</p>', ['pool' => 'tx']);
        } catch (\Throwable $e) {}
    }
}

$u = nl_service_month_usage();

if ($mode === 'status') {
    echo qw_report($u), "\n";
    exit(0);
}

if ($mode === 'test') {
    qw_notify('Расход тарифа рассылок', qw_report($u));
    echo "отчёт отправлен владельцу\n";
    exit(0);
}

if ($u['cap'] <= 0) { echo "месячная квота не задана — сторожить нечего\n"; exit(0); }

// Каждый порог срабатывает один раз за месяц.
$month = date('Y-m');
$done  = (string) setting('nl_quota_warned', '');   // формат «2026-08:70,90»
[$m, $list] = array_pad(explode(':', $done, 2), 2, '');
$warned = ($m === $month && $list !== '') ? array_map('intval', explode(',', $list)) : [];

$level = null;
foreach ([100, 90, 70] as $t) {
    if ($u['pct'] >= $t && !in_array($t, $warned, true)) { $level = $t; break; }
}

if ($level === null) {
    cron_log(JOB, sprintf('расход %d%% (%d из %d) — предупреждать не о чем', $u['pct'], $u['sent'], $u['cap']));
    exit(0);
}

$title = $level >= 100
    ? 'Оплаченный объём рассылок закончился'
    : sprintf('Оплаченный объём рассылок израсходован на %d%%', $level);

$body = qw_report($u) . "\n\n" . ($level >= 100
    ? 'Отправка через сервис остановлена автоматически, письма ждут в очереди и '
      . 'уйдут сразу после расширения тарифа. Ничего не потеряно.'
    : 'Пора расширять тариф Unisender, иначе волна остановится посреди рассылки.');

qw_notify($title, $body);
$warned[] = $level;
set_setting('nl_quota_warned', $month . ':' . implode(',', array_unique($warned)));
cron_log(JOB, sprintf('владелец предупреждён: расход %d%% (%d из %d)', $u['pct'], $u['sent'], $u['cap']));
echo $title, "\n", $body, "\n";
