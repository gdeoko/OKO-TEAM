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

require_once BASE_PATH . '/cron/_lib.php';
require_once BASE_PATH . '/core/db.php';
require_once BASE_PATH . '/core/data.php';
require_once BASE_PATH . '/core/helpers.php';
require_once BASE_PATH . '/core/launch_run.php';
require_once BASE_PATH . '/core/newsletter.php';

// ЗАЩИТА ОТ НАЛОЖЕНИЯ ЗАПУСКОВ. Крон идёт раз в минуту, а задание помечается
// выполненным только ПОСЛЕ отправки. Публикация волны запуска — это 4 поста ВК,
// 4 сторис и рассылка в личку: она заведомо длиннее минуты, а при флуд-контроле
// ВК (коды 6/9) — тем более. Без лока следующий запуск подхватывал бы то же
// задание, и один и тот же пост появлялся бы на стене два-три раза.
// TTL 1 час: почтовая волна кладёт в очередь 8200 персональных писем и занимает
// минуты. При TTL 15 минут лок протухал прямо посреди волны, и следующая минута
// заходила в неё второй раз. Сам повтор отправки от этого не случится — задание
// захватывается атомарно в launch_run_due(), — но параллельная работа над одной
// базой ни к чему.
if (!cron_lock('launch_scheduler', 3600)) exit(0);
register_shutdown_function(static function () { cron_unlock('launch_scheduler'); });

// СТОП-КРАН: пока массовые коммуникации выключены в пульте запуска, запланированные
// волны (посты ВК, письма по базе) не выполняются — задания просто ждут своего часа.
if (function_exists('mass_sending_enabled') && !mass_sending_enabled()) {
    exit(0);
}

$n = launch_run_due();
if ($n > 0) echo date('c') . " launch_scheduler: выполнено запусков — $n\n";
