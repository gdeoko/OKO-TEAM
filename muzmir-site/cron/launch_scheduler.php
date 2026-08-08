<?php
/**
 * cron/launch_scheduler.php — выполняет запланированные запуски конкурсов
 * (launch_jobs) по наступлении времени. Ставить в crontab каждую минуту:
 *   * * * * * php /var/www/muzmir/cron/launch_scheduler.php >/dev/null 2>&1
 */
declare(strict_types=1);

define('BASE_PATH', dirname(__DIR__));
$CFG = require BASE_PATH . '/config.php';
$GLOBALS['CFG'] = $CFG;

require_once BASE_PATH . '/core/db.php';
require_once BASE_PATH . '/core/data.php';
require_once BASE_PATH . '/core/helpers.php';
require_once BASE_PATH . '/core/launch_run.php';
require_once BASE_PATH . '/core/newsletter.php';

// СТОП-КРАН: пока массовые коммуникации выключены в пульте запуска, запланированные
// волны (посты ВК, письма по базе) не выполняются — задания просто ждут своего часа.
if (function_exists('mass_sending_enabled') && !mass_sending_enabled()) {
    exit(0);
}

$n = launch_run_due();
if ($n > 0) echo date('c') . " launch_scheduler: выполнено запусков — $n\n";
