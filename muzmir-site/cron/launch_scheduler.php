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
//
// ЗАКРЫТИЕ ПРИЁМА СТОП-КРАН НЕ ОСТАНАВЛИВАЕТ.
//
// Волна 'closed' — это не рассылка, а конец приёма заявок: она переводит
// конкурсы в 'closed', открывает публичное окно «новые конкурсы с 1 числа» и
// объявляет об этом постом. Час её выхода назван участникам, и он не зависит от
// того, дорассылали мы месячную кампанию или свернули её раньше. 25 августа
// владелец остановил массовые в 17:45, а приём закрывался в 18:00 — с общей
// проверкой приём остался бы открытым до следующего запуска пульта, то есть на
// сутки дольше объявленного.
//
// Личка ВК из этой волны при опущенном кране всё же убирается: остановка
// массовых — это в первую очередь про письма и сообщения людям. На стену пост
// уходит, приём закрывается, а в личку никто ничего не получает.
if (function_exists('mass_sending_enabled') && !mass_sending_enabled()) {
    $due = [];
    try {
        $due = all("SELECT id, channels FROM launch_jobs
                     WHERE status='scheduled' AND wave='closed' AND run_at <= ?",
                   [date('Y-m-d H:i:s')]);
    } catch (\Throwable $e) { $due = []; }
    if (!$due) exit(0);

    foreach ($due as $j) {
        $ch = array_values(array_filter(
            array_map('trim', explode(',', (string) $j['channels'])),
            static fn(string $c): bool => $c !== '' && $c !== 'vk_dm' && $c !== 'email'
        ));
        update('launch_jobs', ['channels' => implode(',', $ch)], 'id=:id', ['id' => (int) $j['id']]);
    }
    cron_log('launch_scheduler', 'стоп-кран опущен: выполняем только закрытие приёма (волна closed), личка и почта из неё убраны');
}

$n = launch_run_due();
if ($n > 0) echo date('c') . " launch_scheduler: выполнено запусков — $n\n";
