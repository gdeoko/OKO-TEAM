<?php
/**
 * cron/ai_grade.php — аттестация конкурсных работ без человека.
 *
 * Берёт заявки, у которых ещё нет результата, прогоняет каждую через
 * core/ai_grader.php и, если режим позволяет, переносит оценку в заявку.
 *
 * ТРИ РЕЖИМА, ПЕРЕКЛЮЧАТЕЛЬ В АДМИНКЕ (настройка auto_grading_mode):
 *   off    — ничего не делаем;
 *   assist — оцениваем и складываем результат в разбор, но в заявку не пишем:
 *            жюри видит готовую оценку с обоснованием и утверждает её одним
 *            нажатием;
 *   auto   — оценка сразу становится результатом заявки, дальше работает
 *            обычный конвейер: письмо участнику, диплом, наградные материалы.
 *
 * ЧТО НЕ УХОДИТ В АВТОМАТ ДАЖЕ В РЕЖИМЕ auto (см. ag_can_apply): формальные
 * нарушения положения, тревожные признаки (подозрение на фонограмму, чужое
 * исполнение, монтаж), низкая уверенность модели, Гран-при и работы без звания.
 * Всё это остаётся человеку: цена ошибки там выше, чем сутки ожидания.
 *
 * ТЕМП. Заявок бывает много, а сервис оценки не бесконечный, поэтому за один
 * заход берём ограниченное число работ (grade_batch, по умолчанию 10) и делаем
 * паузу между ними. Задание идёт раз в 10 минут, догоняя очередь постепенно.
 *
 * Запуск: раз в 10 минут (строка в scripts/crontab.txt).
 *   php cron/ai_grade.php --dry           — прогнать и показать, ничего не меняя
 *   php cron/ai_grade.php --app=123       — одна конкретная заявка
 *   php cron/ai_grade.php --limit=3
 */
declare(strict_types=1);
if (PHP_SAPI !== 'cli') { fwrite(STDERR, "CLI only\n"); exit(1); }

define('BASE_PATH', dirname(__DIR__));
$GLOBALS['CFG'] = require BASE_PATH . '/config.php';
require_once BASE_PATH . '/core/db.php';
require_once BASE_PATH . '/core/data.php';
require_once BASE_PATH . '/core/helpers.php';
require_once BASE_PATH . '/core/ai_grader.php';
require_once __DIR__ . '/_lib.php';

const JOB = 'ai_grade';

$dry   = in_array('--dry', $argv, true);
$only  = 0;
$limit = 0;
foreach ($argv as $a) {
    if (preg_match('~^--app=(\d+)$~', $a, $m))   $only  = (int) $m[1];
    if (preg_match('~^--limit=(\d+)$~', $a, $m)) $limit = (int) $m[1];
}

if (!cron_lock(JOB, 3600)) { cron_log(JOB, 'предыдущий заход ещё идёт'); exit(0); }

ag_migrate();
$mode = ag_mode();
if ($mode === 'off' && $only === 0) {
    cron_log(JOB, 'автоматическая аттестация выключена в админке');
    cron_unlock(JOB);
    exit(0);
}

$batch = $limit > 0 ? $limit : max(1, (int) setting('grade_batch', '10'));
$pause = max(0, (int) setting('grade_pause_sec', '5'));

/* Кого оцениваем: заявка принята, оплачена (если конкурс платный), результата
   ещё нет, ссылка на работу есть, и по ней ещё не было удачной оценки. */
$sql = "SELECT a.id
          FROM applications a
          JOIN competitions c ON c.id = a.competition_id
         WHERE COALESCE(a.result,'') = ''
           AND a.status NOT IN ('rejected','draft')
           AND TRIM(COALESCE(a.video_url,'')) <> ''
           AND (COALESCE(c.is_paid,0) = 0 OR COALESCE(a.is_paid,0) = 1)
           AND NOT EXISTS (SELECT 1 FROM grading_runs g
                            WHERE g.application_id = a.id AND g.status = 'ok')
         ORDER BY a.id ASC
         LIMIT " . (int) $batch;
$rows = $only > 0 ? [['id' => $only]] : all($sql);

if (!$rows) {
    cron_log(JOB, 'работ для аттестации нет');
    cron_unlock(JOB);
    exit(0);
}

$done = $applied = $held = $failed = 0;
foreach ($rows as $r) {
    $appId = (int) $r['id'];
    $res = ag_grade_application($appId);
    if (!$res['ok']) {
        $failed++;
        cron_log(JOB, "заявка $appId: не оценена — " . $res['why']);
        if ($pause > 0) sleep($pause);
        continue;
    }
    $done++;
    $run = one("SELECT * FROM grading_runs WHERE id=?", [(int) $res['run_id']]);
    [$can, $why] = ag_can_apply((array) $run);

    cron_log(JOB, sprintf('заявка %d: %.1f балла → %s (уверенность %.2f)%s',
        $appId, (float) $run['total'], (string) $run['title'], (float) $run['confidence'],
        $can ? '' : ' — человеку: ' . $why));

    if ($dry || $mode !== 'auto' || !$can) {
        if (!$can) $held++;
        if ($pause > 0) sleep($pause);
        continue;
    }

    // ПЕРЕНОС РЕЗУЛЬТАТА В ЗАЯВКУ.
    // Дальше включается обычный конвейер центра: срок отправки результата,
    // письмо участнику, изготовление наградных материалов. Отдельной логики для
    // автоматической оценки там нет и не нужно: заявка выглядит как оценённая.
    try {
        $upd = [
            'result'       => (string) $run['title'],
            'jury_comment' => (string) $run['jury_comment'],
            'status'       => 'graded',
        ];
        // Дополнительный диплом переносится только если человек его ещё не
        // ставил: ручное решение всегда старше машинного предложения.
        $extra = trim((string) ($run['extra_award'] ?? ''));
        if ($extra !== '' && trim((string) (scalar("SELECT extra_diploma FROM applications WHERE id=?", [$appId]) ?? '')) === '') {
            $upd['extra_diploma'] = $extra;
        }
        update('applications', $upd, 'id=:id', ['id' => $appId]);
        q("UPDATE applications SET graded_at=? WHERE id=? AND COALESCE(graded_at,'')=''",
          [date('Y-m-d H:i:s'), $appId]);
        q("UPDATE grading_runs SET applied=1, applied_at=? WHERE id=?", [date('Y-m-d H:i:s'), (int) $run['id']]);
        if (function_exists('audit')) {
            audit('ai_grade_applied', 'application', $appId,
                  ['total' => (float) $run['total'], 'title' => (string) $run['title'],
                   'model' => (string) $run['model'], 'confidence' => (float) $run['confidence'],
                   'extra' => (string) ($upd['extra_diploma'] ?? '')]);
        }
        $applied++;
    } catch (\Throwable $e) {
        cron_log(JOB, "заявка $appId: оценка получена, но не применена — " . $e->getMessage());
    }
    if ($pause > 0) sleep($pause);
}

cron_log(JOB, sprintf('режим %s: оценено %d, применено %d, отдано человеку %d, не удалось %d',
    $mode, $done, $applied, $held, $failed));

/* Работы, которые ждут человека, не должны лежать молча: раз в сутки владелец
   получает сводку, иначе «полный автомат» превращается в тихую очередь. */
try {
    $wait = (int) (scalar("SELECT COUNT(*) FROM grading_runs WHERE status='ok' AND applied=0
                            AND date(created_at) >= date('now','localtime','-7 days')") ?? 0);
    $last = (string) setting('grade_notify_date', '');
    if ($wait > 0 && $last !== date('Y-m-d') && function_exists('tg_notify_admin')) {
        tg_notify_admin('Аттестация: ' . $wait . ' работ ждут решения человека (Гран-при, спорные, формальные нарушения). Раздел «Оценка» в админке.');
        set_setting('grade_notify_date', date('Y-m-d'));
    }
} catch (\Throwable $e) {}

cron_unlock(JOB);
exit(0);
