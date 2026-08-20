<?php
/**
 * РАЗБОР РАСХОЖДЕНИЙ С ЖЮРИ.
 *
 * Жюри поставило не то звание, что предложила подсказка. Задание берёт такую
 * работу, пересматривает запись заново — уже зная решение жюри — и записывает,
 * что именно было переоценено или упущено. Разбор идёт в задание следующих
 * оценок по той же номинации: система проверяет ровно то, на чём ошиблась.
 *
 * Совпавшие решения не разбираются: там учиться нечему.
 *
 * Запуск: раз в 15 минут (scripts/crontab.txt), плюс сразу после правки в
 * админке — фоном, чтобы сохранение итога не ждало разбора записи.
 *
 *   php cron/grade_learn.php              — разобрать очередь (по умолчанию 5 работ)
 *   php cron/grade_learn.php --app=123    — разобрать одну работу
 *   php cron/grade_learn.php --limit=10
 */
declare(strict_types=1);
if (PHP_SAPI !== 'cli') { fwrite(STDERR, "CLI only\n"); exit(1); }

define('BASE_PATH', dirname(__DIR__));
$GLOBALS['CFG'] = require BASE_PATH . '/config.php';
require_once BASE_PATH . '/core/db.php';
require_once BASE_PATH . '/core/data.php';
require_once BASE_PATH . '/core/helpers.php';
require_once BASE_PATH . '/core/grade_feedback.php';
require_once __DIR__ . '/_lib.php';

const JOB = 'grade_learn';

$only = 0; $limit = 5;
foreach ($argv as $a) {
    if (preg_match('~^--app=(\d+)$~', $a, $m))   $only  = (int) $m[1];
    if (preg_match('~^--limit=(\d+)$~', $a, $m)) $limit = max(1, (int) $m[1]);
}

// Разбор одной работы запускается из админки сразу после правки, поэтому общий
// замок берём только для очереди: иначе фоновый вызов молча уходил бы ни с чем.
if ($only === 0 && !cron_lock(JOB, 1800)) { cron_log(JOB, 'предыдущий заход ещё идёт'); exit(0); }

gfb_migrate();

$rows = $only > 0
    ? [['application_id' => $only]]
    : all("SELECT application_id FROM grade_feedback
            WHERE steps <> 0 AND COALESCE(lesson,'') = ''
         ORDER BY id DESC LIMIT " . (int) $limit);

if (!$rows) {
    if ($only === 0) cron_unlock(JOB);
    exit(0);
}

$done = 0; $skip = 0;
foreach ($rows as $r) {
    $appId = (int) $r['application_id'];
    try {
        $res = gfb_learn($appId);
        if (!empty($res['ok'])) {
            $done++;
            cron_log(JOB, "заявка $appId: разобрано расхождение — " . mb_substr((string) $res['why'], 0, 300));
        } else {
            $skip++;
            cron_log(JOB, "заявка $appId: пропуск — " . (string) ($res['why'] ?? ''));
        }
    } catch (\Throwable $e) {
        $skip++;
        cron_log(JOB, "заявка $appId: сбой разбора — " . $e->getMessage());
    }
}

if ($only === 0) {
    cron_log(JOB, sprintf('разобрано %d, пропущено %d', $done, $skip));
    cron_unlock(JOB);
}
exit(0);
