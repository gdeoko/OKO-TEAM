<?php
/**
 * ПУСК: снимает стоп-кран массовых коммуникаций ровно в момент запуска.
 *
 * Вызывается одноразовой строкой крона на 10 августа 2026, 10:00 МСК:
 *   0 10 10 8 * php /var/www/muzmir/scripts/launch_go.php >> /var/www/muzmir/data/logs/launch.log 2>&1
 *
 * Делает ровно то же, что кнопка «Включить массовые» в пульте запуска
 * (admin/launch.php, do=ctl_mass&on=1), плюс две вещи, которых у кнопки нет:
 *
 *   1. Ставит nl_campaign_start = сегодня. Без этого nl_campaign_day()=0 и
 *      прогревочная кривая квот (60→90→120→…→400 писем/день) НЕ включается —
 *      потолок навсегда застревает на ручных 130/день. Именно так и стояло
 *      на проде до запуска.
 *   2. Пишет в audit_log и в лог-файл, во сколько реально сняли стоп-кран.
 *
 * Идемпотентно: повторный запуск ничего не ломает (mass_sending уже '1',
 * nl_campaign_start не перезаписывается, если уже стоит).
 *
 * Отменить пуск до срабатывания: убрать строку из crontab (crontab -e).
 */
declare(strict_types=1);

define('BASE_PATH', dirname(__DIR__));
$GLOBALS['CFG'] = require BASE_PATH . '/config.php';
foreach (['db', 'helpers', 'newsletter'] as $m) require_once BASE_PATH . '/core/' . $m . '.php';

$now = date('Y-m-d H:i:s');
echo "[$now] launch_go: старт\n";

$was = (string) setting('mass_sending', '0');
if ($was === '1') {
    echo "[$now] launch_go: массовые уже включены — ничего не делаю\n";
} else {
    mass_sending_set(true);
    // Возвращаем в очередь письма, снятые предыдущей остановкой (как делает пульт).
    q("UPDATE mail_queue SET status='queued' WHERE status='paused'");
    echo "[$now] launch_go: СТОП-КРАН СНЯТ — массовые рассылки и посты пошли\n";
}

// Старт кампании: включает прогревочную кривую дневных квот (60→90→…→потолок).
// ВАЖНО: ключ настройки именно 'bulk_campaign_start' — его читает nl_campaign_start().
// Без него nl_campaign_day() = 0 и кривая не работает: потолок застревает на ручных 130/день.
$campStart = nl_campaign_start();
if ($campStart === '') {
    set_setting('bulk_campaign_start', date('Y-m-d'));
    echo "[$now] launch_go: bulk_campaign_start = " . date('Y-m-d') . " (прогрев квот включён)\n";
} else {
    echo "[$now] launch_go: старт кампании уже стоит ($campStart)\n";
}

echo "[$now] launch_go: дневная квота сегодня = " . nl_daily_cap()
   . ", распределение = " . json_encode(nl_daily_split(), JSON_UNESCAPED_UNICODE) . "\n";

$due = (int) scalar("SELECT COUNT(*) FROM launch_jobs WHERE status='scheduled' AND run_at <= ?", [$now]);
$fut = (int) scalar("SELECT COUNT(*) FROM launch_jobs WHERE status='scheduled' AND run_at > ?", [$now]);
echo "[$now] launch_go: заданий готово к выполнению сейчас — $due, ждут своего времени — $fut\n";
echo "[$now] launch_go: их подхватит cron/launch_scheduler.php в течение минуты\n";

if (function_exists('audit')) {
    audit('launch_go', 'competition', 0, ['was' => $was, 'due' => $due, 'future' => $fut]);
}
