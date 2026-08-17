<?php
/**
 * Обработчик очереди писем (mail_queue). Запуск: каждую минуту.
 *
 * Берёт пачку status='queued' размером cfgv('mail_batch_size'), но не больше,
 * чем осталось от суточного лимита cfgv('mail_daily_limit') (Gmail SMTP),
 * шлёт через mail_send(), проставляет status=sent|failed и tries++.
 *
 * Если core/newsletter.php подключён и содержит newsletter_process_queue(int $limit) -
 * вся обработка делегируется ей (мягкая проверка function_exists); иначе применяется
 * упрощённая логика ниже (тот же контракт полей mail_queue).
 *
 * Запуск: php cron/process_newsletter_queue.php
 */
declare(strict_types=1);
if (PHP_SAPI !== 'cli') { fwrite(STDERR, "CLI only\n"); exit(1); }

define('BASE_PATH', dirname(__DIR__));
$GLOBALS['CFG'] = require BASE_PATH . '/config.php';
require_once BASE_PATH . '/core/db.php';
require_once BASE_PATH . '/core/helpers.php';
require_once BASE_PATH . '/core/mailer.php';
require_once __DIR__ . '/_lib.php';
// Опциональный будущий модуль полноценных рассылок.
if (is_file(BASE_PATH . '/core/newsletter.php')) require_once BASE_PATH . '/core/newsletter.php';

const JOB = 'process_newsletter_queue';

if (!cron_lock(JOB, 300)) {
    cron_log(JOB, 'предыдущий запуск ещё выполняется, выход');
    exit(0);
}

try {
    /* Доля жёстких отказов за сутки. Отдельные предохранители смотрели на
     * подряд идущие отказы и на рост лестницы, но не на день целиком: за
     * семнадцатое августа отбилось 37% адресов, и остановить это было некому.
     * Проверка стоит до отправки, потому что после неё уже поздно. */
    if (function_exists('nl_bounce_guard') && nl_bounce_guard()) {
        cron_log(JOB, 'массовая отправка остановлена: доля жёстких отказов выше порога');
        cron_unlock(JOB);
        exit(0);
    }

    // Антибан-темп: не чаще 1 письма в 30 секунд (2 за минутный запуск).
    $batch = max(1, (int) cfgv('mail_throttle_per_run', 2));

    // Если подключён специализированный модуль обработки очереди - используем его.
    if (function_exists('newsletter_process_queue')) {
        $n = newsletter_process_queue($batch);
        cron_log(JOB, "обработано через core/newsletter.php::newsletter_process_queue(): отправлено $n");
        cron_unlock(JOB);
        exit(0);
    }

    if (!function_exists('mail_send')) {
        cron_log(JOB, 'mail_send() недоступна (core/mailer.php не подключился) - выход');
        cron_unlock(JOB);
        exit(0);
    }

    $dailyLimit = max(0, (int) cfgv('mail_daily_limit', 400));

    // Отправлено сегодня. Единая шкала времени с записью sent_at ниже - локальное
    // время сайта (date(), Europe/Moscow из config.php), как и во всём остальном
    // коде проекта (auth.php::login_user, core/newsletter.php::nl_sent_today и т.д.).
    $dayStart = date('Y-m-d 00:00:00');
    $sentToday = (int) scalar(
        "SELECT COUNT(*) FROM mail_queue WHERE status='sent' AND sent_at >= ?",
        [$dayStart]
    );
    $remaining = $dailyLimit > 0 ? max(0, $dailyLimit - $sentToday) : $batch;

    if ($remaining <= 0) {
        cron_log(JOB, "суточный лимит писем исчерпан ($sentToday/$dailyLimit)");
        cron_unlock(JOB);
        exit(0);
    }

    $take = min($batch, $remaining);
    $rows = all("SELECT * FROM mail_queue WHERE status='queued' ORDER BY created_at ASC LIMIT ?", [$take]);

    $sent = 0;
    $failed = 0;
    foreach ($rows as $row) {
        $ok = false;
        try {
            $ok = mail_send((string) $row['to_email'], (string) $row['subject'], (string) $row['body'], [
                'attach'     => (string) ($row['attach'] ?? ''),
                'from_queue' => true, // уведомление в приложении уже создано при постановке в очередь
            ]);
        } catch (\Throwable $e) {
            cron_log(JOB, 'mail_send() исключение #' . $row['id'] . ': ' . $e->getMessage());
        }

        $tries = (int) $row['tries'] + 1;
        if ($ok) {
            update('mail_queue', [
                'status'  => 'sent',
                'sent_at' => date('Y-m-d H:i:s'),
                'tries'   => $tries,
                'error'   => '',
            ], 'id=:wid', ['wid' => $row['id']]);

            if (!empty($row['newsletter_id'])) {
                try {
                    q("UPDATE newsletters SET stats_sent = stats_sent + 1 WHERE id=?", [$row['newsletter_id']]);
                } catch (\Throwable $e) { /* таблица могла быть удалена вручную - не критично */ }
            }
            $sent++;
        } else {
            // После 5 неудачных попыток письмо считается окончательно неотправляемым.
            $status = $tries >= 5 ? 'failed' : 'queued';
            update('mail_queue', [
                'status' => $status,
                'tries'  => $tries,
                'error'  => 'mail_send вернул false (см. data/logs/mail.log)',
            ], 'id=:wid', ['wid' => $row['id']]);
            $failed++;
        }
    }

    cron_log(JOB, sprintf(
        'пачка: взято %d, отправлено %d, неудачно %d (лимит суток %d/%d)',
        count($rows), $sent, $failed, $sentToday + $sent, $dailyLimit
    ));
} catch (\Throwable $e) {
    cron_log(JOB, 'ОШИБКА: ' . $e->getMessage());
} finally {
    cron_unlock(JOB);
}
