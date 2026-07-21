<?php
/**
 * Проверка доступности сайта. Запуск: каждые 5 минут.
 *
 * Self-ping на cfgv('base_url'). При недоступности - tg_notify_admin(), но только
 * при СМЕНЕ состояния (up->down), чтобы не спамить админа каждые 5 минут; при
 * восстановлении (down->up) шлётся отдельное уведомление. Состояние хранится
 * в settings (health_last_state) - тот же key-value, что использует весь сайт.
 *
 * Запуск: php cron/health_check.php
 */
declare(strict_types=1);
if (PHP_SAPI !== 'cli') { fwrite(STDERR, "CLI only\n"); exit(1); }

define('BASE_PATH', dirname(__DIR__));
$GLOBALS['CFG'] = require BASE_PATH . '/config.php';
require_once BASE_PATH . '/core/db.php';
require_once BASE_PATH . '/core/helpers.php';
require_once BASE_PATH . '/core/telegram.php';
require_once __DIR__ . '/_lib.php';

const JOB = 'health_check';

try {
    $url = rtrim((string) cfgv('base_url', ''), '/');
    if ($url === '') {
        cron_log(JOB, 'base_url не задан - выход');
        exit(0);
    }

    $ch = curl_init($url . '/');
    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_NOBODY         => false,
        CURLOPT_FOLLOWLOCATION => true,
        CURLOPT_MAXREDIRS      => 3,
        CURLOPT_TIMEOUT        => 10,
        CURLOPT_CONNECTTIMEOUT => 5,
        CURLOPT_SSL_VERIFYPEER => true,
        CURLOPT_USERAGENT      => 'MuzmirHealthCheck/1.0',
    ]);
    curl_exec($ch);
    $code = (int) curl_getinfo($ch, CURLINFO_HTTP_CODE);
    $err  = curl_errno($ch);
    $errMsg = curl_error($ch);
    curl_close($ch);

    // 2xx-4xx - сайт отвечает (даже 404/403 значит веб-сервер жив); 5xx/сеть - недоступен.
    $ok = !$err && $code > 0 && $code < 500;

    $prevState = function_exists('setting') ? (string) setting('health_last_state', 'unknown') : 'unknown';

    if ($ok) {
        if ($prevState === 'down' && function_exists('tg_notify_admin')) {
            tg_notify_admin('Сайт снова доступен: ' . $url . ' (код ' . $code . ')');
        }
        if (function_exists('set_setting')) set_setting('health_last_state', 'up');
        cron_log(JOB, "OK код=$code");
    } else {
        if ($prevState !== 'down' && function_exists('tg_notify_admin')) {
            tg_notify_admin('Внимание: сайт недоступен - ' . $url
                . ($err ? " (curl#$err: $errMsg)" : " (код $code)"));
        }
        if (function_exists('set_setting')) set_setting('health_last_state', 'down');
        cron_log(JOB, "НЕДОСТУПЕН код=$code curl#$err $errMsg");
    }
} catch (\Throwable $e) {
    cron_log(JOB, 'ОШИБКА: ' . $e->getMessage());
}
