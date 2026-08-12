<?php
/**
 * СТОРОЖ АКТУАЛЬНОСТИ БАЗЫ ВЕДОМСТВ.
 *
 * Обращение в министерство именное и отправляется один раз: переделать его
 * нельзя. 12.08.2026 письма ушли по данным из реестра Минкультуры — и департамент
 * культуры Тюменской области ответил отказом в регистрации, потому что названный
 * руководитель сменился ещё в феврале 2025-го. Реестр оказался снимком, а не
 * живыми данными.
 *
 * Поэтому база должна сверяться с официальными сайтами ведомств заново, и этот
 * сторож следит, чтобы к очередному запуску сверка не протухла. Сам он ничего не
 * сверяет — сверку делают агенты, — а считает, сколько адресатов готово, сколько
 * просрочено, и заранее предупреждает владельца.
 *
 * Крон (ежедневно в 08:20 МСК):
 *   20 8 * * * php /var/www/muzmir/cron/ministry_verify_watch.php
 *
 * Вручную:
 *   php cron/ministry_verify_watch.php          — показать состояние
 *   php cron/ministry_verify_watch.php notify   — показать и уведомить владельца
 */
declare(strict_types=1);
if (PHP_SAPI !== 'cli') { fwrite(STDERR, "CLI only\n"); exit(1); }

define('BASE_PATH', dirname(__DIR__));
$GLOBALS['CFG'] = require BASE_PATH . '/config.php';
require_once BASE_PATH . '/core/db.php';
require_once BASE_PATH . '/core/data.php';
require_once BASE_PATH . '/core/helpers.php';
require_once BASE_PATH . '/core/ministries.php';
require_once __DIR__ . '/_lib.php';

min_migrate();

$ttl = min_verify_ttl_days();
$all = all("SELECT * FROM ministries WHERE status NOT IN ('excluded','unsub','bounced','declined')");

$ready = 0; $stale = 0; $never = 0; $press = 0;
foreach ($all as $m) {
    if ((string) ($m['branch'] ?? 'main') === 'press') { $press++; continue; }
    if (min_is_verified($m))                            { $ready++; continue; }
    trim((string) ($m['verified_at'] ?? '')) === '' ? $never++ : $stale++;
}

// Сколько дней до первого числа — дня, когда автомат рассылает обращения.
$next = new DateTime('first day of next month');
$days = (int) (new DateTime('today'))->diff($next)->days;

$lines = [
    "Ведомства: готовы к обращению $ready, просрочена сверка $stale, ни разу не сверялись $never.",
    "Пресс-служб и редакций (им ФИО не нужно): $press.",
    "Сверка считается свежей $ttl дней. До запуска обращений (1-е число): $days дн.",
];
$msg = implode("\n", $lines);
echo $msg . "\n";
cron_log('ministry_verify_watch', str_replace("\n", ' ', $msg));

/* ── Предупреждаем заранее, а не в день запуска ──────────────────────────── */

$needWarn = ($never + $stale) > 0 && $days <= 7;
if ($needWarn && (($argv[1] ?? '') === 'notify' || ($argv[1] ?? '') === '')) {
    // Раз в сутки, не чаще: сторож ходит ежедневно.
    $mark = 'ministry_verify_warn_' . date('Y-m-d');
    if ((string) setting($mark, '') === '') {
        set_setting($mark, '1');
        $text = "Обращения в ведомства уйдут через $days дн., а сверены не все.\n\n" . $msg
              . "\n\nНесверенные письма не получат — так устроен min_recipients(). "
              . "Чтобы они попали в рассылку, нужно сверить ФИО и адреса с официальными сайтами "
              . "и применить сверку: php scripts/apply_ministry_verify.php apply";
        if (function_exists('notify_owner_text'))      { try { notify_owner_text($text); } catch (\Throwable $e) {} }
        elseif (function_exists('tg_notify_owner'))    { try { tg_notify_owner($text); } catch (\Throwable $e) {} }
        elseif (function_exists('mail_send')) {
            try { mail_send((string) cfgv('owner_email', 'okoteam.top@gmail.com'),
                            'Ведомства: сверка не завершена, до запуска ' . $days . ' дн.',
                            nl2br(h($text))); } catch (\Throwable $e) {}
        }
        echo "владельцу отправлено предупреждение\n";
    }
}
