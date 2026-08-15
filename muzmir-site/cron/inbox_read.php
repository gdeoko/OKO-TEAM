<?php
/**
 * ЧТЕНИЕ ВСЕХ ЯЩИКОВ ЦЕНТРА. Только читает и раскладывает — ничего не отвечает
 * и ничего не удаляет. Разбор и автодействия живут отдельно.
 *
 * Крон (каждые 5 минут):
 *   строка расписания — в scripts/crontab.txt, интервал пять минут
 *
 * Вручную:
 *   php cron/inbox_read.php            — за последние 14 дней
 *   php cron/inbox_read.php days 60    — глубже, для первого прогона
 */
declare(strict_types=1);
if (PHP_SAPI !== 'cli') { fwrite(STDERR, "CLI only\n"); exit(1); }

define('BASE_PATH', dirname(__DIR__));
$GLOBALS['CFG'] = require BASE_PATH . '/config.php';
require_once BASE_PATH . '/core/db.php';
require_once BASE_PATH . '/core/helpers.php';
require_once BASE_PATH . '/core/mailer.php';
require_once BASE_PATH . '/core/inbox_reader.php';
require_once __DIR__ . '/_lib.php';

const JOB = 'inbox_read';

$days = 14;
foreach ($argv as $i => $a) if ($a === 'days') $days = max(1, (int) ($argv[$i + 1] ?? 14));

if (!cron_lock(JOB, 900)) { cron_log(JOB, 'предыдущий прогон ещё идёт'); exit(0); }

$total = ['seen' => 0, 'new' => 0, 'errors' => 0];
try {
    foreach (array_keys(inbox_boxes()) as $alias) {
        $r = inbox_scan($alias, $days);
        foreach ($total as $k => $_) $total[$k] += $r[$k];
        if ($r['new'] > 0 || $r['errors'] > 0) {
            cron_log(JOB, sprintf('%s: просмотрено %d, новых %d, ошибок %d', $alias, $r['seen'], $r['new'], $r['errors']));
        }
        echo sprintf("%-9s просмотрено %3d, новых %3d, ошибок %d\n", $alias, $r['seen'], $r['new'], $r['errors']);
    }

    // Сводка нужна не ради красоты: по ней видно, что ящики читаются, а не молчат.
    if ($total['new'] > 0) {
        $wait = (int) (scalar("SELECT COUNT(*) FROM inbox_messages WHERE handled_by=''") ?? 0);
        cron_log(JOB, 'итог: новых писем ' . $total['new'] . ', ждут разбора ' . $wait);
    }
} catch (\Throwable $e) {
    cron_log(JOB, 'ОШИБКА: ' . $e->getMessage());
} finally {
    cron_unlock(JOB);
}

echo sprintf("ВСЕГО: просмотрено %d, новых %d, ошибок %d\n", $total['seen'], $total['new'], $total['errors']);
