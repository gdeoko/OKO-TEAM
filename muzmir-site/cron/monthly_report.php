<?php
/**
 * Сводка за прошедший месяц. Запуск: 1-го числа каждого месяца.
 *
 * Заявки, оплаты, регистрации, топ-5 конкурсов по числу заявок за предыдущий
 * календарный месяц -> tg_notify_admin() (кратко) + письмо владельцу на
 * cfgv('org_email') (через mail_queue, полный текст).
 *
 * Идемпотентно: если отчёт за этот месяц уже отправлялся (settings.monthly_report_last),
 * повторный запуск в тот же день/месяц ничего не делает.
 *
 * Запуск: php cron/monthly_report.php
 */
declare(strict_types=1);
if (PHP_SAPI !== 'cli') { fwrite(STDERR, "CLI only\n"); exit(1); }

define('BASE_PATH', dirname(__DIR__));
$GLOBALS['CFG'] = require BASE_PATH . '/config.php';
require_once BASE_PATH . '/core/db.php';
require_once BASE_PATH . '/core/helpers.php';
require_once BASE_PATH . '/core/mailer.php';
require_once BASE_PATH . '/core/telegram.php';
require_once __DIR__ . '/_lib.php';

const JOB = 'monthly_report';

try {
    if (!function_exists('scalar')) {
        cron_log(JOB, 'БД недоступна - выход');
        exit(0);
    }

    // Метка месяца, за который формируем отчёт (предыдущий календарный месяц).
    $periodLabel = date('Y-m', strtotime('first day of last month'));
    $already = function_exists('setting') ? (string) setting('monthly_report_last', '') : '';
    if ($already === $periodLabel) {
        cron_log(JOB, "отчёт за $periodLabel уже отправлялся, выход");
        exit(0);
    }

    $start = date('Y-m-01', strtotime('first day of last month'));
    $end   = date('Y-m-t', strtotime('last day of last month'));
    $paidStatuses = "('paid','succeeded')";

    $appsCount = (int) scalar("SELECT COUNT(*) FROM applications WHERE date(created_at) BETWEEN ? AND ?", [$start, $end]);
    $paidApps  = (int) scalar("SELECT COUNT(*) FROM applications WHERE is_paid=1 AND date(created_at) BETWEEN ? AND ?", [$start, $end]);
    $paySum    = (int) scalar("SELECT COALESCE(SUM(amount),0) FROM payments WHERE status IN $paidStatuses AND date(created_at) BETWEEN ? AND ?", [$start, $end]);
    $payCount  = (int) scalar("SELECT COUNT(*) FROM payments WHERE status IN $paidStatuses AND date(created_at) BETWEEN ? AND ?", [$start, $end]);
    $regsCount = (int) scalar("SELECT COUNT(*) FROM users WHERE date(created_at) BETWEEN ? AND ?", [$start, $end]);
    $subsCount = (int) scalar("SELECT COUNT(*) FROM subscribers WHERE date(created_at) BETWEEN ? AND ?", [$start, $end]);
    $awardsSum = (int) scalar("SELECT COALESCE(SUM(amount),0) FROM awards_orders WHERE date(created_at) BETWEEN ? AND ?", [$start, $end]);

    $topComps = all(
        "SELECT c.name, COUNT(a.id) AS cnt
           FROM applications a JOIN competitions c ON c.id = a.competition_id
          WHERE date(a.created_at) BETWEEN ? AND ?
       GROUP BY c.id ORDER BY cnt DESC LIMIT 5",
        [$start, $end]
    );

    $monthsRu = [1=>'Январь',2=>'Февраль',3=>'Март',4=>'Апрель',5=>'Май',6=>'Июнь',
                 7=>'Июль',8=>'Август',9=>'Сентябрь',10=>'Октябрь',11=>'Ноябрь',12=>'Декабрь'];
    $monthTitle = $monthsRu[(int) date('n', strtotime($start))] . ' ' . date('Y', strtotime($start));

    $topLines = [];
    foreach ($topComps as $i => $t) {
        $topLines[] = ($i + 1) . '. ' . $t['name'] . ' - ' . $t['cnt'];
    }
    $topText = $topLines ? implode("\n", $topLines) : 'заявок не было';

    $summary = "Отчёт за $monthTitle\n\n"
        . "Заявки: $appsCount (оплачено: $paidApps)\n"
        . "Платежи: $payCount на сумму " . number_format($paySum, 0, ',', ' ') . " ₽\n"
        . "Заказы наград: на сумму " . number_format($awardsSum, 0, ',', ' ') . " ₽\n"
        . "Новые регистрации: $regsCount\n"
        . "Новые подписчики рассылки: $subsCount\n\n"
        . "Топ конкурсов по заявкам:\n$topText";

    if (function_exists('tg_notify_admin')) {
        tg_notify_admin($summary);
    }

    // Отчёт — админам, во входящий ящик, а не на публичный адрес центра.
    $orgEmail = (string) cfgv('owner_email', (string) cfgv('org_email', ''));
    if ($orgEmail !== '' && function_exists('mail_queue')) {
        $message = nl2br(h($summary));
        $html = function_exists('mail_template') ? mail_template('monthly_report', [
            'month_title' => $monthTitle,
            'message'     => $summary,
            'admin_url'   => rtrim((string) cfgv('base_url'), '/') . '/admin/?page=analytics',
            'preheader'   => 'Сводка за ' . $monthTitle,
        ]) : $message;
        mail_queue($orgEmail, (string) cfgv('org_name', ''), 'Отчёт за ' . $monthTitle, $html);
    }

    if (function_exists('set_setting')) set_setting('monthly_report_last', $periodLabel);
    cron_log(JOB, "отчёт за $periodLabel отправлен (заявок $appsCount, платежей $payCount на $paySum ₽)");
} catch (\Throwable $e) {
    cron_log(JOB, 'ОШИБКА: ' . $e->getMessage());
}
