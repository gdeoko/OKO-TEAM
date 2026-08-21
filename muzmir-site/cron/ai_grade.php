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

/* ────────────────────────────────────────────────────────────────────────────
 * ГОТОВЫЕ ПОДСКАЗКИ ПРИМЕНЯЮТСЯ ПРИ ВКЛЮЧЕНИИ АВТОМАТА.
 *
 * В режиме подсказки центр заранее разбирает всю очередь: у каждой работы есть
 * предложенное звание, обоснование и комментарий. Но выборка ниже намеренно
 * пропускает заявки, у которых разбор уже есть, — иначе одна и та же работа
 * оценивалась бы заново каждый заход.
 *
 * Из-за этого переключение в «полный автомат» не давало ничего: новых работ нет,
 * старые пропускаются, и вся заготовленная работа осталась бы лежать. Владелец
 * ждёт обратного: один щелчок — и всё готовое уходит в дело.
 *
 * Поэтому в режиме auto сначала разбираем накопленное: берём разборы, которые
 * ещё не применены, и применяем их обычным путём — с теми же проверками, что и
 * свежие. Что не проходит проверку (Гран-при, тревожные признаки, низкая
 * уверенность), по-прежнему остаётся человеку.
 * ──────────────────────────────────────────────────────────────────────────── */
$fromStock = 0;
if ($mode === 'auto' && !$dry && $only === 0) {
    require_once BASE_PATH . '/core/grade_apply.php';
    $stock = all("SELECT g.* FROM grading_runs g
                    JOIN applications a ON a.id = g.application_id
                   WHERE g.status='ok' AND COALESCE(g.applied,0)=0
                     AND COALESCE(a.result,'')='' AND COALESCE(a.graded_at,'')=''
                     AND a.status NOT IN ('rejected','draft')
                ORDER BY g.id ASC
                   LIMIT " . (int) max($batch, 50));
    foreach ($stock as $run) {
        $appId = (int) $run['application_id'];
        [$can, $why] = ag_can_apply((array) $run);
        if (!$can) { cron_log(JOB, "заявка $appId: готовая подсказка оставлена человеку — $why"); continue; }
        try {
            $extra = trim((string) (scalar("SELECT extra_diploma FROM applications WHERE id=?", [$appId]) ?? ''));
            if ($extra === '') $extra = trim((string) ($run['extra_award'] ?? ''));
            $ap = grade_apply_result($appId, (string) $run['title'], [
                'extra_diploma' => $extra,
                'jury_comment'  => (string) $run['jury_comment'],
                'send_mode'     => 'auto',
                'source'        => 'ai',
                'run_id'        => (int) $run['id'],
            ]);
            if ($ap['ok']) {
                q("UPDATE grading_runs SET applied=1, applied_at=? WHERE id=?", [date('Y-m-d H:i:s'), (int) $run['id']]);
                $fromStock++;
            }
        } catch (\Throwable $e) {
            cron_log(JOB, "заявка $appId: готовая подсказка не применена — " . $e->getMessage());
        }
    }
    if ($fromStock > 0) cron_log(JOB, "применено готовых подсказок: $fromStock");
}

/* КОГО ОЦЕНИВАЕМ.
 *
 * Только то, к чему человек ещё не притрагивался: нет звания И нет отметки о
 * судействе. Одного пустого звания мало — заявку могли открыть, поправить
 * данные и отложить решение; graded_at при этом уже стоит, и машина не должна
 * лезть в чужую работу. Отклонённые, черновики и неоплаченные платные не берём,
 * повторно оценённые — тоже: один удачный разбор на заявку.
 *
 * Свежие вперёд не лезут: очередь идёт по возрастанию номера, то есть в порядке
 * подачи — тот же порядок, в каком судит жюри. */
$sql = "SELECT a.id
          FROM applications a
          JOIN competitions c ON c.id = a.competition_id
         WHERE COALESCE(a.result,'') = ''
           AND COALESCE(a.graded_at,'') = ''
           AND a.status NOT IN ('rejected','draft')
           AND TRIM(COALESCE(a.video_url,'')) <> ''
           AND (COALESCE(c.is_paid,0) = 0 OR COALESCE(a.is_paid,0) = 1)
           AND NOT EXISTS (SELECT 1 FROM grading_runs g
                            WHERE g.application_id = a.id AND g.status = 'ok')
           /* НЕУДАЧУ НЕ ПОВТОРЯЕМ КАЖДЫЕ ДЕСЯТЬ МИНУТ.
              Половина сбоев — закрытая или удалённая запись ВКонтакте: она не
              откроется от того, что мы попробуем ещё раз через десять минут.
              Такие заявки забивали каждый заход и не давали дойти до работ,
              которые оценить можно. Ждём шесть часов: за это время участник
              успевает открыть доступ по нашему письму. */
           AND NOT EXISTS (SELECT 1 FROM grading_runs f
                            WHERE f.application_id = a.id AND f.status = 'failed'
                              AND f.created_at >= datetime('now','localtime','-6 hours'))
           /* Три неудачи подряд — вопрос к ссылке, а не к очереди: дальше это
              работа человека, он напишет участнику или отклонит заявку. */
           AND (SELECT COUNT(*) FROM grading_runs f2
                 WHERE f2.application_id = a.id AND f2.status = 'failed') < 3
         ORDER BY a.id ASC
         LIMIT " . (int) $batch;
$rows = $only > 0 ? [['id' => $only]] : all($sql);

if (!$rows) {
    cron_log(JOB, 'работ для аттестации нет');
    cron_unlock(JOB);
    exit(0);
}

$done = $applied = $held = $failed = $rejected = 0;
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

    /* НАРУШЕНИЕ ПОЛОЖЕНИЯ — ЭТО ОТКАЗ, А НЕ ОЖИДАНИЕ.
     *
     * Работа с монтажом, с наложенным студийным вокалом, с несколькими номерами
     * в одной заявке или не той номинации по положению не может получить звание.
     * Такие заявки копились в очереди к человеку, и участник неделями ждал
     * результата, которого не будет. В полном автомате они отклоняются сразу:
     * с причиной словами положения, с возвратом оргвзноса и письмом о том, как
     * исправить и подать заново. Список нарушений намеренно узкий, а порог
     * уверенности высокий — см. ag_auto_reject. */
    if (!$dry && $mode === 'auto' && !$can) {
        $compRow = one("SELECT c.* FROM competitions c JOIN applications a ON a.competition_id=c.id WHERE a.id=?", [$appId]);
        [$doReject, $reason] = ag_auto_reject((array) $run, (array) $compRow);
        if ($doReject) {
            require_once BASE_PATH . '/core/grade_apply.php';
            $rj = grade_reject_application($appId, $reason, 'ai');
            if ($rj['ok']) {
                q("UPDATE grading_runs SET applied=1, applied_at=? WHERE id=?", [date('Y-m-d H:i:s'), (int) $run['id']]);
                $rejected++;
                cron_log(JOB, "заявка $appId: отклонена по положению — " . mb_substr(strtok($reason, "\n"), 0, 160)
                              . ' ' . $rj['msg']);
                if ($pause > 0) sleep($pause);
                continue;
            }
            cron_log(JOB, "заявка $appId: отклонить не удалось — " . $rj['msg']);
        }
    }

    if ($dry || $mode !== 'auto' || !$can) {
        if (!$can) $held++;
        if ($pause > 0) sleep($pause);
        continue;
    }

    /* ПЕРЕНОС РЕЗУЛЬТАТА В ЗАЯВКУ — ТЕМ ЖЕ ПУТЁМ, ЧТО И У ЖЮРИ.
     *
     * Здесь стояли три поля: звание, комментарий, статус. Всё остальное, что
     * делает карточка жюри, не делалось вовсе — а именно там живёт конвейер
     * центра: срок отправки результата по правилу «5 рабочих дней от подачи, ВИП
     * — 3», письмо участнику, уведомление в кабинет, переделка наградных
     * документов под новое звание, пересчёт статуса заявки и отдельный порядок
     * для длинного конкурса, где письма нет вовсе.
     *
     * Без даты отправки письмо не уходило никогда: cron/send_diplomas ищет
     * заявки по result_send_at, а он оставался пустым. Автомат складывал работы
     * в тихую очередь и выглядел работающим.
     *
     * Теперь и жюри, и автомат зовут одну функцию (core/grade_apply.php).
     * Разница только в источнике решения, который пишется в журнал. */
    try {
        require_once BASE_PATH . '/core/grade_apply.php';
        // Спец-номинацию машина предлагает, но ручное решение всегда старше:
        // если человек уже вписал свою, машинную не подставляем.
        $extra = trim((string) (scalar("SELECT extra_diploma FROM applications WHERE id=?", [$appId]) ?? ''));
        if ($extra === '') $extra = trim((string) ($run['extra_award'] ?? ''));

        $ap = grade_apply_result($appId, (string) $run['title'], [
            'extra_diploma' => $extra,
            'jury_comment'  => (string) $run['jury_comment'],
            'send_mode'     => 'auto',          // строго по срокам центра
            'source'        => 'ai',
            'run_id'        => (int) $run['id'],
        ]);
        if (!$ap['ok']) {
            cron_log(JOB, "заявка $appId: оценка получена, но не применена — " . $ap['msg']);
        } else {
            q("UPDATE grading_runs SET applied=1, applied_at=? WHERE id=?", [date('Y-m-d H:i:s'), (int) $run['id']]);
            cron_log(JOB, "заявка $appId: " . $ap['msg']);
            $applied++;
        }
    } catch (\Throwable $e) {
        cron_log(JOB, "заявка $appId: оценка получена, но не применена — " . $e->getMessage());
    }
    if ($pause > 0) sleep($pause);
}

cron_log(JOB, sprintf('режим %s: оценено %d, применено %d, отклонено по положению %d, отдано человеку %d, не удалось %d',
    $mode, $done, $applied, $rejected, $held, $failed));

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
